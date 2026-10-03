# pyright: reportOptionalMemberAccess=false, reportAttributeAccessIssue=false, reportInvalidTypeForm=false, reportOptionalCall=false
"""Headless Blender render script for isometric pixel-art sprites.

This script executes either:
1. Directly via Python CLI:
       python3 art/pipeline/render.py [options]
   which invokes headless Blender and then packs the sprite atlas.
2. Inside Blender 4.x headless:
       blender -b -P art/pipeline/render.py -- [options]

Target projection:
    Dimetric 2:1 projection with Blender orthographic camera at rot X=60°, Z=45°.
    Canvas size: 48x64 px for characters, 64x64 px for furniture.
    Palette: 32-color master temporary palette with 1px outline.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import subprocess
import sys
import time
from pathlib import Path

# Attempt bpy import when running inside Blender
try:
    import bpy  # type: ignore[import-not-found]
    from mathutils import Vector  # type: ignore[import-not-found]
except ImportError:
    bpy = None
    Vector = None  # type: ignore[assignment]


# ---------------------------------------------------------------------------
# CLI Argument Parsing
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    """Parse CLI arguments passed after '--' in Blender or directly from shell."""
    argv = sys.argv
    if "--" in argv:
        custom_args = argv[argv.index("--") + 1 :]
    else:
        custom_args = argv[1:]

    parser = argparse.ArgumentParser(description="Headless Blender sprite renderer")
    parser.add_argument(
        "--character-model",
        type=str,
        default="art/sumber/characters/figure_Casual.glb",
        help="Path to input character GLB model",
    )
    parser.add_argument(
        "--furniture-dir",
        type=str,
        default="art/sumber/furniture",
        help="Path to furniture GLB models directory",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="art/pipeline/dist",
        help="Output directory for raw and packed sprites",
    )
    parser.add_argument(
        "--palette",
        type=str,
        default="art/pipeline/palette.json",
        help="Path to 32-color master palette JSON",
    )
    parser.add_argument(
        "--samples",
        type=int,
        default=16,
        help="Cycles render samples per pixel (deterministic)",
    )
    return parser.parse_args(custom_args)


# ---------------------------------------------------------------------------
# 32-Color Palette & Quantization Helpers
# ---------------------------------------------------------------------------

DEFAULT_PALETTE_HEX = [
    "#14141e", "#1e1e2e", "#2d3748", "#334155", "#48525f", "#64748b", "#6b7785", "#8e9aa8",
    "#94a3b8", "#cbd5e1", "#e2e8f0", "#ffffff", "#4e2e18", "#875529", "#c79a63", "#f4e2c7",
    "#8c5338", "#c6865a", "#f0b58d", "#ffd7b5", "#b45309", "#d97706", "#fbbf24", "#fef08a",
    "#0369a1", "#0284c7", "#38bdf8", "#00f0ff", "#10b981", "#ef4444", "#6366f1", "#0f172a",
]


def load_palette(palette_path: str) -> list[tuple[int, int, int]]:
    """Load RGB colors from palette JSON or return defaults."""
    if os.path.exists(palette_path):
        try:
            with open(palette_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            if "colors" in data:
                return [tuple(c["rgb"]) for c in data["colors"]]  # type: ignore[return-value]
        except Exception as e:
            print(f"Warning: Failed to load {palette_path}: {e}")
    return [
        (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16))
        for h in DEFAULT_PALETTE_HEX
    ]


def hex_to_rgba_float(hex_str: str) -> list[float]:
    """Convert hex string to sRGB float list [r, g, b, 1.0]."""
    h = hex_str.lstrip("#")
    return [int(h[i : i + 2], 16) / 255.0 for i in (0, 2, 4)] + [1.0]


def post_process_image(
    image_path: str,
    palette_rgb: list[tuple[int, int, int]],
    outline_color: tuple[int, int, int, int] = (20, 20, 30, 255),
) -> None:
    """Quantize to master 32-color palette and add a crisp 1px outline."""
    import numpy as np  # type: ignore[import-not-found]
    from PIL import Image  # type: ignore[import-not-found]

    img = Image.open(image_path).convert("RGBA")
    arr = np.array(img)
    alpha = arr[:, :, 3]
    mask = alpha > 40

    if not np.any(mask):
        return

    # Quantize non-transparent pixels
    palette_arr = np.array(palette_rgb, dtype=np.float32)
    pixels = arr[mask, :3].astype(np.float32)

    diff = pixels[:, np.newaxis, :] - palette_arr[np.newaxis, :, :]
    weights = np.array([2.0, 4.0, 3.0], dtype=np.float32)
    dist_sq = np.sum((diff**2) * weights, axis=2)
    best_match = np.argmin(dist_sq, axis=1)

    quant_arr = np.zeros_like(arr)
    quant_arr[mask, :3] = palette_arr[best_match].astype(np.uint8)
    quant_arr[mask, 3] = 255

    # 1px outline via 4-connected morphological expansion
    outline_mask = np.zeros_like(mask)
    for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
        shifted = np.roll(np.roll(mask, dy, axis=0), dx, axis=1)
        outline_mask |= shifted & ~mask

    final_arr = quant_arr.copy()
    final_arr[outline_mask] = np.array(outline_color, dtype=np.uint8)

    out_img = Image.fromarray(final_arr, mode="RGBA")
    out_img.save(image_path)


# ---------------------------------------------------------------------------
# Blender Scene Setup
# ---------------------------------------------------------------------------

def setup_blender_scene(samples: int = 16) -> None:
    """Configure Blender scene with deterministic Cycles CPU and transparent film."""
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = samples
    scene.cycles.preview_samples = 4
    scene.cycles.seed = 42
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"


def setup_lighting() -> None:
    """Create a 3-point sun lighting system tailored for isometric pixel art."""
    # Key light: Top-left front
    key_data = bpy.data.lights.new("KeySun", type="SUN")
    key_data.energy = 4.2
    key_obj = bpy.data.objects.new("KeySun", key_data)
    bpy.context.collection.objects.link(key_obj)
    key_obj.rotation_euler = (math.radians(50), math.radians(15), math.radians(-35))

    # Fill light: Right rear
    fill_data = bpy.data.lights.new("FillSun", type="SUN")
    fill_data.energy = 2.0
    fill_obj = bpy.data.objects.new("FillSun", fill_data)
    bpy.context.collection.objects.link(fill_obj)
    fill_obj.rotation_euler = (math.radians(35), math.radians(-30), math.radians(130))

    # Rim light: Top
    rim_data = bpy.data.lights.new("RimSun", type="SUN")
    rim_data.energy = 1.2
    rim_obj = bpy.data.objects.new("RimSun", rim_data)
    bpy.context.collection.objects.link(rim_obj)
    rim_obj.rotation_euler = (math.radians(10), 0, math.radians(180))


def setup_camera(target: Vector, ortho_scale: float = 1.95) -> bpy.types.Object:
    """Set up orthographic camera with rot X=60°, Y=0, Z=45° (2:1 dimetric)."""
    cam_data = bpy.data.cameras.new("IsoCam")
    cam_data.type = "ORTHO"
    cam_data.sensor_fit = "VERTICAL"
    cam_data.ortho_scale = ortho_scale
    cam_obj = bpy.data.objects.new("IsoCam", cam_data)
    bpy.context.collection.objects.link(cam_obj)
    bpy.context.scene.camera = cam_obj

    cam_obj.rotation_mode = "XYZ"
    cam_obj.rotation_euler = (math.radians(60), 0, math.radians(45))
    bpy.context.view_layer.update()

    forward = cam_obj.matrix_world.to_3x3() @ Vector((0, 0, -1))
    cam_obj.location = target - forward * 10.0
    return cam_obj


def set_material_color(
    mat_name: str,
    hex_color: str,
    roughness: float = 0.5,
    emission_hex: str | None = None,
) -> None:
    """Set or create a Principled BSDF material with specific hex color."""
    mat = bpy.data.materials.get(mat_name)
    if not mat:
        mat = bpy.data.materials.new(name=mat_name)
        mat.use_nodes = True
    if mat.use_nodes:
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Base Color"].default_value = hex_to_rgba_float(hex_color)
            bsdf.inputs["Roughness"].default_value = roughness
            if emission_hex:
                bsdf.inputs["Emission Color"].default_value = hex_to_rgba_float(
                    emission_hex
                )
                bsdf.inputs["Emission Strength"].default_value = 3.0


# ---------------------------------------------------------------------------
# Character Setup: Chibi Scaling & Bastion Equipment
# ---------------------------------------------------------------------------

def setup_bastion_character(model_path: str) -> tuple[bpy.types.Object, bpy.types.Object]:
    """Load Quaternius character, apply chibi proportions, Bastion colors, and helmet."""
    bpy.ops.import_scene.gltf(filepath=model_path)

    # Remove collision / helper meshes
    ico = bpy.data.objects.get("Icosphere")
    if ico:
        bpy.data.objects.remove(ico, do_unlink=True)

    root = bpy.data.objects.get("RootNode")
    arm = bpy.data.objects.get("CharacterArmature")

    # 1. Chibi scaling: 1.6x head bone, shorten legs
    arm.pose.bones["Head"].scale = Vector((1.6, 1.6, 1.6))
    for bname in ["UpperLeg.L", "UpperLeg.R", "LowerLeg.L", "LowerLeg.R"]:
        arm.pose.bones[bname].scale = Vector((1.0, 0.65, 1.0))

    # Base resting arms
    base_arm_x = -math.radians(72)
    for bname in ["UpperArm.L", "UpperArm.R"]:
        pb = arm.pose.bones[bname]
        pb.rotation_mode = "XYZ"
        pb.rotation_euler = (base_arm_x, 0, 0)

    # Initial ground alignment
    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    feet_mesh = bpy.data.objects.get("Casual_Feet") or bpy.data.objects.get("Worker_Feet")
    if feet_mesh:
        eval_f = feet_mesh.evaluated_get(depsgraph)
        min_z = min((eval_f.matrix_world @ Vector(c)).z for c in eval_f.bound_box)
        root.location.z -= min_z
    bpy.context.view_layer.update()

    # 2. Material Swap: Bastion signature (#6B7785 slate gray, dark slate pants, boots)
    set_material_color("LightBlue", "#6B7785", roughness=0.4)
    set_material_color("Worker_Vest", "#6B7785", roughness=0.4)
    set_material_color("Worker_Yellow", "#374151", roughness=0.5)
    set_material_color("Purple", "#374151", roughness=0.6)
    set_material_color("White", "#1F2937", roughness=0.7)
    set_material_color("Hair", "#2D3748", roughness=0.8)

    # 3. Bastion Tactical Helmet with Cyan LED Lamp
    set_material_color("Bastion_Armor_Mat", "#6B7785", roughness=0.35)
    set_material_color("Bastion_Visor_Mat", "#111827", roughness=0.2)
    set_material_color("Bastion_Lamp_Mat", "#00F0FF", roughness=0.1, emission_hex="#00F0FF")

    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=0.28)
    dome = bpy.context.active_object
    dome.name = "Bastion_Helmet_Dome"
    dome.scale = (1.1, 1.15, 0.95)
    dome.data.materials.append(bpy.data.materials["Bastion_Armor_Mat"])

    bpy.ops.mesh.primitive_cylinder_add(radius=0.29, depth=0.06, vertices=16)
    visor = bpy.context.active_object
    visor.name = "Bastion_Helmet_Visor"
    visor.location = (0, -0.04, -0.05)
    visor.scale = (1.1, 1.12, 1.0)
    visor.data.materials.append(bpy.data.materials["Bastion_Visor_Mat"])

    bpy.ops.mesh.primitive_cube_add(size=0.07)
    lamp = bpy.context.active_object
    lamp.name = "Bastion_Helmet_Lamp"
    lamp.location = (0.31, -0.10, 0.04)
    lamp.scale = (0.7, 1.2, 0.7)
    lamp.data.materials.append(bpy.data.materials["Bastion_Lamp_Mat"])

    with bpy.context.temp_override(active_object=dome, selected_editable_objects=[dome, visor, lamp]):
        bpy.ops.object.join()

    helmet = dome
    helmet.name = "Bastion_Helmet"
    helmet.scale = (0.01, 0.01, 0.01)
    helmet.parent = arm
    helmet.parent_type = "BONE"
    helmet.parent_bone = "Head"
    helmet.location = (0, -0.04, 0.42)
    bpy.context.view_layer.update()

    return root, arm


# ---------------------------------------------------------------------------
# Animation Keyframes
# ---------------------------------------------------------------------------

WALK_KEYFRAMES = [
    # (leg_l, knee_l, leg_r, knee_r, arm_l, arm_r)
    # f=0: Contact 1 (L forward, R back)
    (18, 0, -16, 8, 18, 18),
    # f=1: Down/Recoil (L absorbs weight, R lifting off)
    (10, 5, -10, 25, 8, 8),
    # f=2: Passing 1 (L straight support, R knee high swinging through)
    (-2, 0, 12, 38, -10, -10),
    # f=3: Contact 2 (R forward, L back)
    (-16, 8, 18, 0, -18, -18),
    # f=4: Down/Recoil (R absorbs weight, L lifting off)
    (-10, 25, 10, 5, -8, -8),
    # f=5: Passing 2 (R straight support, L knee high swinging through)
    (12, 38, -2, 0, 10, 10),
]

IDLE_KEYFRAMES = [
    # (torso_lift, arm_sway, head_nod)
    (0.000, 0.0, 0.0),
    (0.008, 2.0, 1.5),
    (0.014, 3.5, 2.5),
    (0.007, 1.5, 1.0),
]


def render_character_animations(
    root: bpy.types.Object,
    arm: bpy.types.Object,
    output_dir: str,
    palette_rgb: list[tuple[int, int, int]],
) -> dict[str, float]:
    """Render idle and walk animations for SE and NE orientations with dynamic grounding."""
    scene = bpy.context.scene
    scene.render.resolution_x = 48
    scene.render.resolution_y = 64

    feet_mesh = bpy.data.objects.get("Casual_Feet") or bpy.data.objects.get("Worker_Feet")
    base_arm_x = -math.radians(72)
    root_pb = arm.pose.bones["Root"]
    root_pb.rotation_mode = "XYZ"

    # Directions: SE = Y rot 90°, NE = Y rot 180°
    directions = [("se", 90), ("ne", 180)]
    times: dict[str, float] = {}

    for dir_name, dir_angle in directions:
        root_pb.rotation_euler = (0, math.radians(dir_angle), 0)

        # 1. Render Walk Cycle (6 frames)
        t0 = time.time()
        for f, (ll, kl, lr, kr, al, ar) in enumerate(WALK_KEYFRAMES):
            arm.pose.bones["UpperLeg.L"].rotation_mode = "XYZ"
            arm.pose.bones["UpperLeg.L"].rotation_euler = (0, 0, math.radians(ll))
            arm.pose.bones["LowerLeg.L"].rotation_mode = "XYZ"
            arm.pose.bones["LowerLeg.L"].rotation_euler = (math.radians(kl), 0, 0)

            arm.pose.bones["UpperLeg.R"].rotation_mode = "XYZ"
            arm.pose.bones["UpperLeg.R"].rotation_euler = (0, 0, math.radians(lr))
            arm.pose.bones["LowerLeg.R"].rotation_mode = "XYZ"
            arm.pose.bones["LowerLeg.R"].rotation_euler = (math.radians(kr), 0, 0)

            arm.pose.bones["UpperArm.L"].rotation_mode = "XYZ"
            arm.pose.bones["UpperArm.L"].rotation_euler = (base_arm_x, math.radians(al), 0)
            arm.pose.bones["UpperArm.R"].rotation_mode = "XYZ"
            arm.pose.bones["UpperArm.R"].rotation_euler = (base_arm_x, math.radians(ar), 0)

            # Ground weight-bearing foot dynamically to z=0
            root.location.z = 0.0
            bpy.context.view_layer.update()
            if feet_mesh:
                depsgraph = bpy.context.evaluated_depsgraph_get()
                eval_f = feet_mesh.evaluated_get(depsgraph)
                f_min_z = min((eval_f.matrix_world @ Vector(c)).z for c in eval_f.bound_box)
                root.location.z = -f_min_z
                bpy.context.view_layer.update()

            out_file = os.path.join(output_dir, f"bastion_walk_{dir_name}_{f}.png")
            scene.render.filepath = out_file
            bpy.ops.render.render(write_still=True)
            post_process_image(out_file, palette_rgb)
        times[f"walk_{dir_name}"] = time.time() - t0

        # 2. Render Idle Cycle (4 frames)
        t0 = time.time()
        for f, (lift, sway, nod) in enumerate(IDLE_KEYFRAMES):
            arm.pose.bones["UpperLeg.L"].rotation_euler = (0, 0, 0)
            arm.pose.bones["LowerLeg.L"].rotation_euler = (0, 0, 0)
            arm.pose.bones["UpperLeg.R"].rotation_euler = (0, 0, 0)
            arm.pose.bones["LowerLeg.R"].rotation_euler = (0, 0, 0)

            arm.pose.bones["UpperArm.L"].rotation_euler = (
                base_arm_x + math.radians(sway),
                0,
                0,
            )
            arm.pose.bones["UpperArm.R"].rotation_euler = (
                base_arm_x + math.radians(sway),
                0,
                0,
            )
            arm.pose.bones["Head"].rotation_mode = "XYZ"
            arm.pose.bones["Head"].rotation_euler = (math.radians(nod), 0, 0)

            root.location.z = 0.0
            bpy.context.view_layer.update()
            if feet_mesh:
                depsgraph = bpy.context.evaluated_depsgraph_get()
                eval_f = feet_mesh.evaluated_get(depsgraph)
                f_min_z = min((eval_f.matrix_world @ Vector(c)).z for c in eval_f.bound_box)
                root.location.z = -f_min_z + lift
                bpy.context.view_layer.update()

            out_file = os.path.join(output_dir, f"bastion_idle_{dir_name}_{f}.png")
            scene.render.filepath = out_file
            bpy.ops.render.render(write_still=True)
            post_process_image(out_file, palette_rgb)
        times[f"idle_{dir_name}"] = time.time() - t0

    return times


# ---------------------------------------------------------------------------
# Furniture Rendering
# ---------------------------------------------------------------------------

FURNITURE_MODELS = [
    ("desk.glb", "furniture_desk.png"),
    ("chairDesk.glb", "furniture_chair.png"),
    ("computerScreen.glb", "furniture_screen.png"),
]


def render_furniture_items(
    furniture_dir: str,
    output_dir: str,
    palette_rgb: list[tuple[int, int, int]],
) -> dict[str, float]:
    """Render 3 Kenney furniture items with matching isometric camera and palette."""
    times: dict[str, float] = {}

    for model_name, out_filename in FURNITURE_MODELS:
        t0 = time.time()
        bpy.ops.wm.read_factory_settings(use_empty=True)
        setup_blender_scene(samples=16)
        setup_lighting()

        filepath = os.path.join(furniture_dir, model_name)
        if not os.path.exists(filepath):
            print(f"Warning: Furniture file not found: {filepath}")
            continue

        bpy.ops.import_scene.gltf(filepath=filepath)

        # Center in X and Y, ground at Z=0
        meshes = [o for o in bpy.data.objects if o.type == "MESH"]
        depsgraph = bpy.context.evaluated_depsgraph_get()
        all_pts = [
            m.evaluated_get(depsgraph).matrix_world @ Vector(c)
            for m in meshes
            for c in m.bound_box
        ]
        min_x, max_x = min(pt.x for pt in all_pts), max(pt.x for pt in all_pts)
        min_y, max_y = min(pt.y for pt in all_pts), max(pt.y for pt in all_pts)
        min_z, max_z = min(pt.z for pt in all_pts), max(pt.z for pt in all_pts)

        center_offset = Vector(((min_x + max_x) / 2, (min_y + max_y) / 2, min_z))
        for obj in bpy.data.objects:
            if obj.parent is None:
                obj.location -= center_offset

        # Camera setup
        target = Vector((0, 0, (max_z - min_z) * 0.4))
        setup_camera(target=target, ortho_scale=1.95)

        scene = bpy.context.scene
        scene.render.resolution_x = 64
        scene.render.resolution_y = 64

        out_path = os.path.join(output_dir, out_filename)
        scene.render.filepath = out_path
        bpy.ops.render.render(write_still=True)
        post_process_image(out_path, palette_rgb)
        times[model_name] = time.time() - t0

    return times


# ---------------------------------------------------------------------------
# Master Execution Logic
# ---------------------------------------------------------------------------

def run_blender_pipeline(args: argparse.Namespace) -> None:
    """Entry point when running inside Blender."""
    raw_dir = os.path.join(args.output_dir, "raw_sprites")
    os.makedirs(raw_dir, exist_ok=True)

    palette_rgb = load_palette(args.palette)
    print(f"Loaded {len(palette_rgb)} palette colors for quantization.")

    # 1. Setup scene & render character
    print("Initializing character scene...")
    bpy.ops.wm.read_factory_settings(use_empty=True)
    setup_blender_scene(samples=args.samples)
    setup_lighting()
    setup_camera(target=Vector((0, 0, 0.78)), ortho_scale=1.95)

    root, arm = setup_bastion_character(args.character_model)
    char_times = render_character_animations(root, arm, raw_dir, palette_rgb)

    # 2. Render furniture items
    print("Rendering 3 Kenney furniture items...")
    furn_times = render_furniture_items(args.furniture_dir, raw_dir, palette_rgb)

    # 3. Save benchmark metrics
    metrics = {
        "character_model": args.character_model,
        "character_times_seconds": char_times,
        "total_character_time_seconds": sum(char_times.values()),
        "furniture_times_seconds": furn_times,
        "total_furniture_time_seconds": sum(furn_times.values()),
        "total_render_time_seconds": sum(char_times.values()) + sum(furn_times.values()),
        "samples_per_pixel": args.samples,
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S WIB"),
    }
    metrics_path = os.path.join(args.output_dir, "render_metrics.json")
    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)

    print("\n--- RENDER BENCHMARKS ---")
    print(f"Character Total Render Time: {metrics['total_character_time_seconds']:.2f}s")
    for k, v in char_times.items():
        print(f"  - {k}: {v:.2f}s")
    print(f"Furniture Total Render Time: {metrics['total_furniture_time_seconds']:.2f}s")
    for k, v in furn_times.items():
        print(f"  - {k}: {v:.2f}s")
    print(f"Metrics saved to: {metrics_path}")


def main() -> None:
    """Main CLI entry point."""
    args = parse_args()

    if bpy is not None:
        # Running inside Blender
        run_blender_pipeline(args)
        return

    # Running from host Python CLI: orchestrate Blender and texture packer
    print("=== T0.4 Isometric Sprite Rendering Pipeline ===")
    root_dir = Path(__file__).resolve().parent.parent.parent

    # 1. Execute headless Blender render
    blender_bin = "blender"
    blender_cmd = [
        blender_bin,
        "-b",
        "-P",
        str(Path(__file__).resolve()),
        "--",
        "--character-model",
        args.character_model,
        "--furniture-dir",
        args.furniture_dir,
        "--output-dir",
        args.output_dir,
        "--palette",
        args.palette,
        "--samples",
        str(args.samples),
    ]

    print(f"Launching Blender: {' '.join(blender_cmd)}")
    t0 = time.time()
    result = subprocess.run(blender_cmd, cwd=str(root_dir))
    if result.returncode != 0:
        print(f"Error: Blender render process exited with code {result.returncode}")
        sys.exit(result.returncode)
    blender_duration = time.time() - t0
    print(f"Blender render completed in {blender_duration:.2f}s.")

    # 2. Run Texture Packer (free-tex-packer-core)
    pack_script = Path(__file__).resolve().parent / "pack.js"
    raw_dir = Path(args.output_dir) / "raw_sprites"
    pack_cmd = ["node", str(pack_script), str(raw_dir), str(args.output_dir)]

    print(f"\nLaunching Texture Packer: {' '.join(pack_cmd)}")
    pack_res = subprocess.run(pack_cmd, cwd=str(root_dir))
    if pack_res.returncode != 0:
        print(f"Error: Texture packer failed with code {pack_res.returncode}")
        sys.exit(pack_res.returncode)

    print("\n=== PIPELINE EXECUTION SUCCESSFUL ===")
    print(f"Output files in: {args.output_dir}")


if __name__ == "__main__":
    main()
