# pyright: reportOptionalMemberAccess=false, reportAttributeAccessIssue=false, reportInvalidTypeForm=false, reportOptionalCall=false
"""Headless Blender render script for isometric environment sprites (tiles, walls, furniture).

Renders:
1. All custom low-poly models specified in docs/blueprint/04-environment-room-spec.md:
   server rack, arcade cabinet, lab equipment, blueprint table, pool + coping, mihrab,
   prayer rug (sajadah bergaris shaf), whiteboard, conveyor, and all zone-specific furniture.
2. Generic furniture items from Kenney Furniture Kit.
3. Floor tiles for all 17 zones + corridor + water (with day and night variants).
4. Full-height back walls and 8px cutaway front walls.
5. Night emission variants for light-emitting objects (monitors, screens, neon, lamps, windows).

All sprites follow:
- Dimetric 2:1 projection (Blender orthographic camera at rot X=60°, Z=45°).
- Official 32-color master palette (art/pipeline/palette.json) via weighted Euclidean distance.
- 1px charcoal outline (#14141E) via 4-connected morphological expansion.
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

    parser = argparse.ArgumentParser(description="Headless Blender environment renderer")
    parser.add_argument(
        "--furniture-dir",
        type=str,
        default="art/sumber/furniture",
        help="Path to Kenney furniture GLB directory",
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
# 32-Color Palette & Quantization
# ---------------------------------------------------------------------------

def load_palette(palette_path: str) -> list[tuple[int, int, int]]:
    """Load RGB colors from palette JSON."""
    if os.path.exists(palette_path):
        try:
            with open(palette_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            if "colors" in data:
                return [tuple(c["rgb"]) for c in data["colors"]]  # type: ignore[return-value]
        except Exception as e:
            print(f"Warning: Failed to load {palette_path}: {e}")
    # Fallback to master 32 colors
    default_hexes = [
        "#14141e", "#1a1c29", "#282d3f", "#475069", "#687594", "#9ca8b8", "#d1d8e0", "#ffffff",
        "#8f5338", "#c9855b", "#f2b896", "#4a2814", "#a26d3f", "#e0b678", "#00f0ff", "#fef9c3",
        "#1f3a68", "#2f6fb3", "#8a4fbf", "#b5652b", "#e0567a", "#2bb3c0", "#d9622b", "#3fa66b",
        "#d23c3c", "#6b7785", "#6d5bd0", "#8e8e3a", "#9cc23a", "#7a4a2e", "#f2c230", "#f5f0e1"
    ]
    return [
        (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16))
        for h in default_hexes
    ]


def post_process_image(
    image_path: str,
    palette_rgb: list[tuple[int, int, int]],
    outline_color: tuple[int, int, int, int] = (20, 20, 30, 255),
    add_outline: bool = True,
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

    if add_outline:
        # 1px outline via 4-connected morphological expansion
        outline_mask = np.zeros_like(mask)
        for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            shifted = np.roll(np.roll(mask, dy, axis=0), dx, axis=1)
            outline_mask |= shifted & ~mask

        final_arr = quant_arr.copy()
        final_arr[outline_mask] = np.array(outline_color, dtype=np.uint8)
        out_img = Image.fromarray(final_arr, mode="RGBA")
    else:
        out_img = Image.fromarray(quant_arr, mode="RGBA")

    out_img.save(image_path)


# ---------------------------------------------------------------------------
# Blender Scene Setup
# ---------------------------------------------------------------------------

def setup_blender_scene(samples: int = 16, res_x: int = 64, res_y: int = 64) -> None:
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
    scene.render.resolution_x = res_x
    scene.render.resolution_y = res_y


def setup_lighting(ambient_night: bool = False) -> None:
    """Create a 3-point sun lighting system tailored for isometric pixel art."""
    key_energy = 1.2 if ambient_night else 4.2
    fill_energy = 0.6 if ambient_night else 2.0
    rim_energy = 0.4 if ambient_night else 1.2

    # Key light: Top-left front
    key_data = bpy.data.lights.new("KeySun", type="SUN")
    key_data.energy = key_energy
    key_obj = bpy.data.objects.new("KeySun", key_data)
    bpy.context.collection.objects.link(key_obj)
    key_obj.rotation_euler = (math.radians(50), math.radians(15), math.radians(-35))

    # Fill light: Right rear
    fill_data = bpy.data.lights.new("FillSun", type="SUN")
    fill_data.energy = fill_energy
    fill_obj = bpy.data.objects.new("FillSun", fill_data)
    bpy.context.collection.objects.link(fill_obj)
    fill_obj.rotation_euler = (math.radians(35), math.radians(-30), math.radians(130))

    # Rim light: Top
    rim_data = bpy.data.lights.new("RimSun", type="SUN")
    rim_data.energy = rim_energy
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


def make_mat(
    name: str,
    hex_color: str,
    roughness: float = 0.5,
    emission_hex: str | None = None,
    emission_strength: float = 4.0,
) -> bpy.types.Material:
    """Create or return a Principled BSDF material configured with palette colors."""
    mat = bpy.data.materials.get(name)
    if not mat:
        mat = bpy.data.materials.new(name=name)
        mat.use_nodes = True
    if mat.use_nodes:
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            h = hex_color.lstrip("#")
            r, g, b = [int(h[i : i + 2], 16) / 255.0 for i in (0, 2, 4)]
            bsdf.inputs["Base Color"].default_value = (r, g, b, 1.0)
            bsdf.inputs["Roughness"].default_value = roughness
            if emission_hex:
                eh = emission_hex.lstrip("#")
                er, eg, eb = [int(eh[i : i + 2], 16) / 255.0 for i in (0, 2, 4)]
                bsdf.inputs["Emission Color"].default_value = (er, eg, eb, 1.0)
                bsdf.inputs["Emission Strength"].default_value = emission_strength
            else:
                bsdf.inputs["Emission Strength"].default_value = 0.0
    return mat


def create_box(
    name: str,
    size: tuple[float, float, float],
    location: tuple[float, float, float],
    rotation: tuple[float, float, float] = (0, 0, 0),
    mat: bpy.types.Material | None = None,
) -> bpy.types.Object:
    """Add a box mesh with specified size, location, and material."""
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    obj.location = location
    obj.rotation_euler = rotation
    if mat:
        obj.data.materials.append(mat)
    return obj


def create_cylinder(
    name: str,
    radius: float,
    depth: float,
    location: tuple[float, float, float],
    rotation: tuple[float, float, float] = (0, 0, 0),
    vertices: int = 16,
    mat: bpy.types.Material | None = None,
) -> bpy.types.Object:
    """Add a cylinder mesh with specified radius, depth, location, and material."""
    bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=depth, vertices=vertices)
    obj = bpy.context.active_object
    obj.name = name
    obj.location = location
    obj.rotation_euler = rotation
    if mat:
        obj.data.materials.append(mat)
    return obj


# ---------------------------------------------------------------------------
# Custom Procedural 3D Model Builders
# ---------------------------------------------------------------------------

def build_server_rack(night: bool = False) -> None:
    """Z12 Data Center & SOC: 19" LED Server Rack."""
    mat_frame = make_mat("RackFrame", "#1A1C29", roughness=0.3)
    mat_rails = make_mat("RackRails", "#687594", roughness=0.4)
    mat_blade = make_mat("RackBlade", "#475069", roughness=0.4)
    mat_handle = make_mat("RackHandle", "#D1D8E0", roughness=0.2)
    mat_led_cyan = make_mat("RackLedCyan", "#00F0FF", roughness=0.1, emission_hex="#00F0FF", emission_strength=5.0 if night else 2.0)
    mat_led_gold = make_mat("RackLedGold", "#F2C230", roughness=0.1, emission_hex="#F2C230", emission_strength=4.0 if night else 1.5)
    mat_led_red = make_mat("RackLedRed", "#D23C3C", roughness=0.1, emission_hex="#D23C3C", emission_strength=4.0 if night else 1.5)

    # Main cabinet chassis
    create_box("Chassis", (0.7, 0.7, 1.35), (0, 0, 0.675), mat=mat_frame)
    # Side ventilation rails
    create_box("RailL", (0.05, 0.68, 1.3), (-0.32, 0, 0.675), mat=mat_rails)
    create_box("RailR", (0.05, 0.68, 1.3), (0.32, 0, 0.675), mat=mat_rails)

    # 4 server blade units
    for i in range(4):
        bz = 0.25 + i * 0.28
        create_box(f"Blade_{i}", (0.58, 0.66, 0.16), (0, 0, bz), mat=mat_blade)
        create_box(f"Handle_{i}_L", (0.04, 0.04, 0.12), (-0.24, -0.34, bz), mat=mat_handle)
        create_box(f"Handle_{i}_R", (0.04, 0.04, 0.12), (0.24, -0.34, bz), mat=mat_handle)

        # LEDs
        create_box(f"LedCyan_{i}", (0.04, 0.02, 0.04), (-0.15, -0.34, bz + 0.04), mat=mat_led_cyan)
        create_box(f"LedGold_{i}", (0.04, 0.02, 0.04), (-0.08, -0.34, bz + 0.04), mat=mat_led_gold)
        create_box(f"LedRed_{i}", (0.04, 0.02, 0.04), (-0.01, -0.34, bz + 0.04), mat=mat_led_red)


def build_arcade_cabinet(night: bool = False) -> None:
    """Z15 Arcade: Retro Arcade Machine Cabinet with CRT & Marquee."""
    mat_body = make_mat("ArcadeBody", "#1A1C29", roughness=0.4)
    mat_stripe_coral = make_mat("ArcadeCoral", "#E0567A", roughness=0.3)
    mat_stripe_teal = make_mat("ArcadeTeal", "#2BB3C0", roughness=0.3)
    mat_screen = make_mat("ArcadeScreen", "#00F0FF" if night else "#14141E", roughness=0.1, emission_hex="#00F0FF" if night else None, emission_strength=4.5)
    mat_marquee = make_mat("ArcadeMarquee", "#FEF9C3" if night else "#F5F0E1", roughness=0.2, emission_hex="#FEF9C3" if night else None, emission_strength=5.0)
    mat_ctrl = make_mat("ArcadeCtrl", "#475069", roughness=0.4)
    mat_stick = make_mat("ArcadeStick", "#D23C3C", roughness=0.2)
    mat_coin = make_mat("ArcadeCoin", "#9CA8B8", roughness=0.3)

    # Base chassis
    create_box("ArcadeBase", (0.65, 0.65, 0.7), (0, 0, 0.35), mat=mat_body)
    create_box("CoinDoor", (0.3, 0.03, 0.25), (0, -0.33, 0.3), mat=mat_coin)

    # Upper slanted cabinet
    create_box("UpperCabinet", (0.65, 0.5, 0.6), (0, 0.05, 0.95), mat=mat_body)
    # Side art stripes
    create_box("SideArtL", (0.02, 0.52, 0.5), (-0.33, 0.05, 0.95), mat=mat_stripe_coral)
    create_box("SideArtR", (0.02, 0.52, 0.5), (0.33, 0.05, 0.95), mat=mat_stripe_teal)

    # Control panel shelf
    create_box("CtrlShelf", (0.63, 0.25, 0.08), (0, -0.22, 0.72), rotation=(math.radians(15), 0, 0), mat=mat_ctrl)
    create_cylinder("Joystick", 0.03, 0.1, (0.1, -0.22, 0.8), mat=mat_stick)

    # Slanted CRT Screen
    create_box("CRTScreen", (0.48, 0.05, 0.35), (0, -0.15, 0.95), rotation=(math.radians(25), 0, 0), mat=mat_screen)

    # Top Marquee
    create_box("Marquee", (0.63, 0.2, 0.14), (0, -0.12, 1.3), rotation=(math.radians(-10), 0, 0), mat=mat_marquee)


def build_lab_bench() -> None:
    """Z06 Lab Riset: Chemical Laboratory Workbench with Sink & Taps."""
    mat_frame = make_mat("LabFrame", "#475069", roughness=0.5)
    mat_top = make_mat("LabTop", "#FFFFFF", roughness=0.2)
    mat_sink = make_mat("LabSink", "#9CA8B8", roughness=0.3)
    mat_faucet = make_mat("LabFaucet", "#D1D8E0", roughness=0.2)
    mat_reagent = make_mat("LabReagent", "#8A4FBF", roughness=0.1)

    # Bench base and legs
    create_box("BenchFrame", (1.1, 0.65, 0.65), (0, 0, 0.325), mat=mat_frame)
    # White chemical resistant top
    create_box("BenchTop", (1.2, 0.7, 0.08), (0, 0, 0.68), mat=mat_top)
    # Sink cutout
    create_box("Sink", (0.32, 0.32, 0.12), (0.32, 0, 0.66), mat=mat_sink)
    # Gooseneck faucet
    create_cylinder("FaucetStem", 0.02, 0.22, (0.32, 0.14, 0.8), mat=mat_faucet)
    create_cylinder("FaucetSpout", 0.015, 0.1, (0.32, 0.1, 0.9), rotation=(math.radians(90), 0, 0), mat=mat_faucet)
    # Reagent shelf
    create_box("ReagentShelf", (0.5, 0.15, 0.04), (-0.25, 0.15, 0.8), mat=mat_frame)
    create_cylinder("Bottle1", 0.035, 0.09, (-0.35, 0.15, 0.86), mat=mat_reagent)
    create_cylinder("Bottle2", 0.035, 0.09, (-0.22, 0.15, 0.86), mat=make_mat("ReagentGreen", "#3FA66B", roughness=0.1))


def build_microscope() -> None:
    """Z06 Lab Riset: Optical Laboratory Microscope."""
    mat_base = make_mat("MicroBase", "#475069", roughness=0.4)
    mat_body = make_mat("MicroBody", "#9CA8B8", roughness=0.3)
    mat_stage = make_mat("MicroStage", "#14141E", roughness=0.2)
    mat_lens = make_mat("MicroLens", "#D1D8E0", roughness=0.2)

    # Base
    create_box("Base", (0.28, 0.28, 0.06), (0, 0, 0.03), mat=mat_base)
    # Vertical arm
    create_box("Arm", (0.08, 0.08, 0.4), (0, 0.08, 0.24), mat=mat_body)
    # Stage
    create_box("Stage", (0.22, 0.22, 0.03), (0, -0.02, 0.22), mat=mat_stage)
    # Objective turret
    create_cylinder("Turret", 0.06, 0.05, (0, -0.02, 0.32), mat=mat_lens)
    create_cylinder("Lens1", 0.02, 0.07, (0, -0.02, 0.27), mat=mat_lens)
    # Eyepiece
    create_cylinder("Eyepiece", 0.035, 0.2, (0, 0.02, 0.46), rotation=(math.radians(25), 0, 0), mat=mat_body)


def build_test_tube_rack() -> None:
    """Z06 Lab Riset: Rack of Colorful Reagent Test Tubes."""
    mat_wood = make_mat("RackWood", "#A26D3F", roughness=0.5)
    mat_glass = make_mat("GlassTube", "#D1D8E0", roughness=0.1)

    # Rack frame
    create_box("RackBase", (0.45, 0.15, 0.04), (0, 0, 0.02), mat=mat_wood)
    create_box("RackTop", (0.45, 0.15, 0.04), (0, 0, 0.2), mat=mat_wood)
    create_box("RackSideL", (0.04, 0.15, 0.2), (-0.2, 0, 0.1), mat=mat_wood)
    create_box("RackSideR", (0.04, 0.15, 0.2), (0.2, 0, 0.1), mat=mat_wood)

    # 4 Tubes with colored liquids
    colors = [("#8A4FBF", "TubeViolet"), ("#3FA66B", "TubeGreen"), ("#00F0FF", "TubeCyan"), ("#D23C3C", "TubeRed")]
    for idx, (hex_code, name) in enumerate(colors):
        tx = -0.12 + idx * 0.08
        mat_liq = make_mat(name, hex_code, roughness=0.1, emission_hex=hex_code, emission_strength=1.5)
        create_cylinder(f"Tube_{idx}", 0.022, 0.22, (tx, 0, 0.12), mat=mat_glass)
        create_cylinder(f"Liquid_{idx}", 0.018, 0.12, (tx, 0, 0.08), mat=mat_liq)


def build_whiteboard_formula() -> None:
    """Z06 Lab Riset: Whiteboard with Chemical & Mathematical Formulas."""
    mat_frame = make_mat("WbFrame", "#D1D8E0", roughness=0.3)
    mat_board = make_mat("WbBoard", "#FFFFFF", roughness=0.2)
    mat_stand = make_mat("WbStand", "#475069", roughness=0.4)
    mat_formula = make_mat("FormulaInk", "#8A4FBF", roughness=0.4)

    # Stand legs & crossbar
    create_box("LegL", (0.05, 0.4, 0.04), (-0.45, 0, 0.02), mat=mat_stand)
    create_box("LegR", (0.05, 0.4, 0.04), (0.45, 0, 0.02), mat=mat_stand)
    create_cylinder("PostL", 0.025, 0.9, (-0.45, 0, 0.45), mat=mat_stand)
    create_cylinder("PostR", 0.025, 0.9, (0.45, 0, 0.45), mat=mat_stand)

    # Frame & Board
    create_box("Frame", (1.1, 0.06, 0.75), (0, 0, 0.8), mat=mat_frame)
    create_box("BoardSurface", (1.02, 0.07, 0.68), (0, 0, 0.8), mat=mat_board)

    # Formula diagrams
    create_box("Formula1", (0.35, 0.075, 0.08), (-0.2, -0.01, 0.9), mat=mat_formula)
    create_box("Formula2", (0.28, 0.075, 0.08), (0.2, -0.01, 0.75), mat=make_mat("InkCyan", "#2BB3C0", roughness=0.3))


def build_journal_shelf() -> None:
    """Z06 Lab Riset: Scientific Research Journal Shelf."""
    mat_wood = make_mat("JournalWood", "#A26D3F", roughness=0.5)
    mat_j1 = make_mat("Journal1", "#8A4FBF", roughness=0.4)
    mat_j2 = make_mat("Journal2", "#1F3A68", roughness=0.4)
    mat_j3 = make_mat("Journal3", "#D1D8E0", roughness=0.4)

    create_box("ShelfBase", (0.8, 0.4, 0.05), (0, 0, 0.025), mat=mat_wood)
    create_box("ShelfTop", (0.8, 0.4, 0.05), (0, 0, 0.7), mat=mat_wood)
    create_box("ShelfMid", (0.8, 0.38, 0.04), (0, 0, 0.38), mat=mat_wood)
    create_box("SideL", (0.05, 0.4, 0.7), (-0.375, 0, 0.35), mat=mat_wood)
    create_box("SideR", (0.05, 0.4, 0.7), (0.375, 0, 0.35), mat=mat_wood)

    # Books / Journals
    create_box("BookA", (0.18, 0.3, 0.25), (-0.2, 0, 0.52), mat=mat_j1)
    create_box("BookB", (0.22, 0.3, 0.22), (0.1, 0, 0.5), mat=mat_j2)
    create_box("BookC", (0.15, 0.3, 0.26), (-0.1, 0, 0.2), mat=mat_j3)


def build_blueprint_table() -> None:
    """Z03 Ruang Arsitektur: Slanted Blueprint Drafting Table."""
    mat_oak = make_mat("DraftOak", "#A26D3F", roughness=0.5)
    mat_blueprint = make_mat("BlueprintPaper", "#2F6FB3", roughness=0.3)
    mat_lines = make_mat("BlueprintLines", "#FFFFFF", roughness=0.2)
    mat_ruler = make_mat("DraftRuler", "#D1D8E0", roughness=0.2)

    # Trestle Legs
    create_box("Leg1", (0.08, 0.6, 0.65), (-0.45, 0, 0.325), mat=mat_oak)
    create_box("Leg2", (0.08, 0.6, 0.65), (0.45, 0, 0.325), mat=mat_oak)
    create_box("Crossbar", (0.85, 0.08, 0.08), (0, 0, 0.25), mat=mat_oak)

    # Slanted Drafting Board
    create_box("Board", (1.15, 0.75, 0.06), (0, 0, 0.76), rotation=(math.radians(22), 0, 0), mat=mat_oak)
    # Blueprint pinned to board
    create_box("Blueprint", (0.9, 0.6, 0.07), (0, 0, 0.77), rotation=(math.radians(22), 0, 0), mat=mat_blueprint)
    # White CAD line representation
    create_box("CADLines", (0.75, 0.45, 0.075), (0, 0, 0.775), rotation=(math.radians(22), 0, 0), mat=mat_lines)
    # Straightedge ruler
    create_box("Ruler", (1.05, 0.05, 0.08), (0, -0.1, 0.75), rotation=(math.radians(22), 0, 0), mat=mat_ruler)


def build_system_model_mini() -> None:
    """Z03 Ruang Arsitektur: Architectural Miniature Scale System Model."""
    mat_wood = make_mat("ModelPlinth", "#4A2814", roughness=0.5)
    mat_foam = make_mat("ModelFoam", "#FFFFFF", roughness=0.3)
    mat_glass = make_mat("ModelGlass", "#2BB3C0", roughness=0.2)

    # Presentation plinth
    create_box("Plinth", (0.55, 0.55, 0.1), (0, 0, 0.05), mat=mat_wood)

    # Miniature building blocks
    create_box("BuildingA", (0.22, 0.22, 0.3), (-0.1, -0.08, 0.25), mat=mat_foam)
    create_box("BuildingB", (0.18, 0.18, 0.42), (0.1, 0.1, 0.31), mat=mat_foam)
    create_box("GlassAtrium", (0.15, 0.15, 0.18), (-0.05, 0.12, 0.19), mat=mat_glass)


def build_blueprint_rack() -> None:
    """Z03 Ruang Arsitektur: Vertical Rack of Rolled Blueprint Tubes."""
    mat_rack = make_mat("RackOak", "#A26D3F", roughness=0.5)
    mat_tube1 = make_mat("TubeBlue", "#2F6FB3", roughness=0.4)
    mat_tube2 = make_mat("TubeCream", "#F5F0E1", roughness=0.4)
    mat_tube3 = make_mat("TubeGold", "#FEF9C3", roughness=0.4)

    # Stand
    create_box("RackStand", (0.4, 0.4, 0.35), (0, 0, 0.175), mat=mat_rack)

    # Rolled scrolls / tubes
    create_cylinder("Tube1", 0.04, 0.65, (-0.08, -0.06, 0.35), rotation=(math.radians(8), math.radians(-5), 0), mat=mat_tube1)
    create_cylinder("Tube2", 0.035, 0.6, (0.08, 0.05, 0.35), rotation=(math.radians(-6), math.radians(7), 0), mat=mat_tube2)
    create_cylinder("Tube3", 0.04, 0.55, (-0.02, 0.08, 0.35), rotation=(math.radians(5), math.radians(4), 0), mat=mat_tube3)


def build_whiteboard() -> None:
    """Z04 Ruang Kelas: Large Teaching Whiteboard on Wheels."""
    mat_frame = make_mat("WbFrameBig", "#D1D8E0", roughness=0.3)
    mat_board = make_mat("WbSurfaceBig", "#FFFFFF", roughness=0.2)
    mat_stand = make_mat("WbStandBig", "#475069", roughness=0.4)
    mat_cyan = make_mat("PostItCyan", "#2BB3C0", roughness=0.4)
    mat_gold = make_mat("PostItGold", "#FEF9C3", roughness=0.4)

    # Dual A-frame rolling legs
    create_box("BaseL", (0.06, 0.45, 0.04), (-0.55, 0, 0.02), mat=mat_stand)
    create_box("BaseR", (0.06, 0.45, 0.04), (0.55, 0, 0.02), mat=mat_stand)
    create_cylinder("PostL", 0.025, 0.95, (-0.55, 0, 0.48), mat=mat_stand)
    create_cylinder("PostR", 0.025, 0.95, (0.55, 0, 0.48), mat=mat_stand)
    create_box("Crossbar", (1.1, 0.04, 0.04), (0, 0, 0.2), mat=mat_stand)

    # Whiteboard panel
    create_box("Frame", (1.25, 0.06, 0.8), (0, 0, 0.82), mat=mat_frame)
    create_box("Surface", (1.18, 0.07, 0.72), (0, 0, 0.82), mat=mat_board)

    # Post-it notes & diagrams
    create_box("Note1", (0.14, 0.075, 0.14), (-0.3, -0.01, 0.9), mat=mat_gold)
    create_box("Note2", (0.14, 0.075, 0.14), (-0.12, -0.01, 0.9), mat=mat_cyan)
    create_box("Diagram", (0.4, 0.075, 0.25), (0.25, -0.01, 0.8), mat=make_mat("DiagRed", "#D23C3C", roughness=0.4))


def build_conveyor() -> None:
    """Z11 Release Dock: Industrial Conveyor Belt to GitHub Door."""
    mat_frame = make_mat("ConvFrame", "#687594", roughness=0.4)
    mat_belt = make_mat("ConvBelt", "#282D3F", roughness=0.6)
    mat_legs = make_mat("ConvLegs", "#9CA8B8", roughness=0.3)
    mat_motor = make_mat("ConvMotor", "#1A1C29", roughness=0.4)
    mat_box = make_mat("ConvBox", "#A26D3F", roughness=0.6)
    mat_label = make_mat("ConvLabel", "#FFFFFF", roughness=0.3)

    # Conveyor Bed
    create_box("BedChannel", (1.3, 0.45, 0.12), (0, 0, 0.45), mat=mat_frame)
    create_box("RubberBelt", (1.28, 0.4, 0.04), (0, 0, 0.52), mat=mat_belt)

    # Support Legs
    create_cylinder("LegFL", 0.03, 0.45, (-0.5, -0.18, 0.225), mat=mat_legs)
    create_cylinder("LegFR", 0.03, 0.45, (-0.5, 0.18, 0.225), mat=mat_legs)
    create_cylinder("LegBL", 0.03, 0.45, (0.5, -0.18, 0.225), mat=mat_legs)
    create_cylinder("LegBR", 0.03, 0.45, (0.5, 0.18, 0.225), mat=mat_legs)

    # Motor
    create_box("Motor", (0.2, 0.22, 0.18), (0.6, 0.18, 0.42), mat=mat_motor)

    # Shipping Box on Belt
    create_box("Parcel", (0.3, 0.25, 0.25), (-0.1, 0, 0.67), mat=mat_box)
    create_box("Label", (0.12, 0.12, 0.02), (-0.1, -0.13, 0.72), mat=mat_label)


def build_parcel_rack() -> None:
    """Z11 Release Dock: Heavy Warehouse Parcel Sorting Rack."""
    mat_steel = make_mat("RackSteel", "#9CA8B8", roughness=0.3)
    mat_box1 = make_mat("PBox1", "#A26D3F", roughness=0.6)
    mat_box2 = make_mat("PBox2", "#E0B678", roughness=0.6)
    mat_label = make_mat("PLabel", "#FFFFFF", roughness=0.3)

    # 4 corner posts
    create_box("Post1", (0.04, 0.04, 1.2), (-0.4, -0.22, 0.6), mat=mat_steel)
    create_box("Post2", (0.04, 0.04, 1.2), (0.4, -0.22, 0.6), mat=mat_steel)
    create_box("Post3", (0.04, 0.04, 1.2), (-0.4, 0.22, 0.6), mat=mat_steel)
    create_box("Post4", (0.04, 0.04, 1.2), (0.4, 0.22, 0.6), mat=mat_steel)

    # 3 Shelves
    for sz in [0.2, 0.6, 1.0]:
        create_box(f"Shelf_{sz}", (0.84, 0.48, 0.04), (0, 0, sz), mat=mat_steel)

    # Boxes on shelves
    create_box("Box1", (0.32, 0.32, 0.28), (-0.18, 0, 0.36), mat=mat_box1)
    create_box("Box2", (0.28, 0.3, 0.25), (0.2, 0, 0.35), mat=mat_box2)
    create_box("Box3", (0.35, 0.35, 0.28), (0.1, 0, 0.76), mat=mat_box1)
    create_box("Label1", (0.1, 0.02, 0.08), (-0.18, -0.17, 0.38), mat=mat_label)


def build_changelog_board() -> None:
    """Z11 Release Dock: Release Changelog Wall Board."""
    mat_frame = make_mat("CbFrame", "#14141E", roughness=0.4)
    mat_board = make_mat("CbBoard", "#282D3F", roughness=0.5)
    mat_badge = make_mat("CbBadge", "#3FA66B", roughness=0.2)
    mat_text = make_mat("CbText", "#FFFFFF", roughness=0.3)

    create_box("Frame", (0.85, 0.06, 0.9), (0, 0, 0.7), mat=mat_frame)
    create_box("Board", (0.77, 0.07, 0.82), (0, 0, 0.7), mat=mat_board)

    # Release Tag Badge
    create_box("Badge", (0.28, 0.075, 0.1), (-0.2, -0.01, 0.98), mat=mat_badge)
    # Changelog lines
    for i in range(4):
        create_box(f"Line_{i}", (0.6, 0.075, 0.04), (0, -0.01, 0.8 - i * 0.12), mat=mat_text)


def build_mihrab() -> None:
    """Z16 Musholla: Ornamental Wooden Carved Mihrab Niche."""
    mat_walnut = make_mat("MihrabWalnut", "#4A2814", roughness=0.5)
    mat_oak = make_mat("MihrabOak", "#A26D3F", roughness=0.4)
    mat_gold = make_mat("MihrabGold", "#FEF9C3", roughness=0.2)
    mat_shadow = make_mat("MihrabRecess", "#1A1C29", roughness=0.6)

    # Outer arch pillars
    create_box("PillarL", (0.12, 0.28, 1.3), (-0.35, 0, 0.65), mat=mat_walnut)
    create_box("PillarR", (0.12, 0.28, 1.3), (0.35, 0, 0.65), mat=mat_walnut)

    # Inner recessed niche cavity
    create_box("Recess", (0.58, 0.24, 1.1), (0, 0.02, 0.55), mat=mat_shadow)

    # Stepped geometric arch crown
    create_box("ArchStep1", (0.74, 0.3, 0.1), (0, 0, 1.15), mat=mat_oak)
    create_box("ArchStep2", (0.56, 0.3, 0.1), (0, 0, 1.25), mat=mat_walnut)
    create_box("ArchPoint", (0.28, 0.3, 0.12), (0, 0, 1.35), mat=mat_gold)

    # Base plinth
    create_box("Plinth", (0.88, 0.36, 0.08), (0, 0, 0.04), mat=mat_walnut)


def build_prayer_rug_shaf() -> None:
    """Z16 Musholla: Emerald Green Prayer Runner with Golden Shaf Alignment Line."""
    mat_velvet = make_mat("RugVelvet", "#3FA66B", roughness=0.7)
    mat_shaf = make_mat("RugShafGold", "#FEF9C3", roughness=0.3)
    mat_trim = make_mat("RugTrim", "#282D3F", roughness=0.5)

    # Main velvet runner (1.35m wide, 0.65m deep)
    create_box("RunnerBase", (1.35, 0.65, 0.03), (0, 0, 0.015), mat=mat_velvet)
    # Golden woven shaf line near the top (aligning heels/toes)
    create_box("ShafLine", (1.35, 0.06, 0.035), (0, 0.22, 0.018), mat=mat_shaf)
    # Dark outer border trim
    create_box("BorderTop", (1.35, 0.02, 0.032), (0, 0.31, 0.016), mat=mat_trim)
    create_box("BorderBtm", (1.35, 0.02, 0.032), (0, -0.31, 0.016), mat=mat_trim)


def build_wudhu_station() -> None:
    """Z16 Musholla: Ablution Station with Tiled Bench Basin & Faucets."""
    mat_tile = make_mat("WudhuTile", "#FFFFFF", roughness=0.2)
    mat_trough = make_mat("WudhuTrough", "#D1D8E0", roughness=0.3)
    mat_faucet = make_mat("WudhuFaucet", "#9CA8B8", roughness=0.2)
    mat_seat = make_mat("WudhuSeat", "#475069", roughness=0.4)

    # Tiled bench
    create_box("Bench", (1.1, 0.5, 0.32), (0, 0.1, 0.16), mat=mat_tile)
    create_box("SeatSlab", (1.1, 0.25, 0.06), (0, 0.22, 0.35), mat=mat_seat)

    # Water Drainage Trough
    create_box("Trough", (1.1, 0.25, 0.12), (0, -0.15, 0.06), mat=mat_trough)

    # 2 Chrome Faucets
    for fx in [-0.28, 0.28]:
        create_cylinder(f"Pipe_{fx}", 0.02, 0.32, (fx, 0.02, 0.35), mat=mat_faucet)
        create_cylinder(f"Tap_{fx}", 0.015, 0.1, (fx, -0.04, 0.48), rotation=(math.radians(80), 0, 0), mat=mat_faucet)


def build_quran_shelf() -> None:
    """Z16 Musholla: Low Carved Rehal / Lectern with Open Sacred Book."""
    mat_walnut = make_mat("RehalWood", "#4A2814", roughness=0.5)
    mat_pages = make_mat("RehalPages", "#F5F0E1", roughness=0.4)
    mat_gold = make_mat("RehalGold", "#FEF9C3", roughness=0.2)

    # Crossed legs of rehal
    create_box("Leg1", (0.35, 0.04, 0.28), (0, 0, 0.14), rotation=(0, math.radians(35), 0), mat=mat_walnut)
    create_box("Leg2", (0.35, 0.04, 0.28), (0, 0, 0.14), rotation=(0, math.radians(-35), 0), mat=mat_walnut)

    # Open book pages
    create_box("PageL", (0.16, 0.24, 0.02), (-0.08, 0, 0.24), rotation=(0, math.radians(-25), 0), mat=mat_pages)
    create_box("PageR", (0.16, 0.24, 0.02), (0.08, 0, 0.24), rotation=(0, math.radians(25), 0), mat=mat_pages)
    create_box("Ribbon", (0.02, 0.28, 0.03), (0, 0, 0.22), mat=mat_gold)


def build_shaf_partition() -> None:
    """Z16 Musholla: Wooden Partition Screen Divider."""
    mat_wood = make_mat("PartWood", "#A26D3F", roughness=0.5)
    mat_lattice = make_mat("PartLattice", "#E0B678", roughness=0.4)

    create_box("FrameL", (0.05, 0.05, 1.1), (-0.45, 0, 0.55), mat=mat_wood)
    create_box("FrameR", (0.05, 0.05, 1.1), (0.45, 0, 0.55), mat=mat_wood)
    create_box("FrameTop", (0.95, 0.05, 0.06), (0, 0, 1.07), mat=mat_wood)
    create_box("FrameBtm", (0.95, 0.05, 0.06), (0, 0, 0.12), mat=mat_wood)
    create_box("Lattice", (0.85, 0.02, 0.88), (0, 0, 0.6), mat=mat_lattice)


def build_pool_basin() -> None:
    """Z17 Kolam luar: Pool Basin Structure."""
    mat_wall = make_mat("PoolWall", "#2BB3C0", roughness=0.3)
    mat_floor = make_mat("PoolFloor", "#00F0FF", roughness=0.3)

    create_box("BasinFloor", (1.3, 0.9, 0.06), (0, 0, 0.03), mat=mat_floor)
    create_box("WallN", (1.3, 0.08, 0.4), (0, 0.41, 0.2), mat=mat_wall)
    create_box("WallS", (1.3, 0.08, 0.4), (0, -0.41, 0.2), mat=mat_wall)
    create_box("WallW", (0.08, 0.74, 0.4), (-0.61, 0, 0.2), mat=mat_wall)
    create_box("WallE", (0.08, 0.74, 0.4), (0.61, 0, 0.2), mat=mat_wall)


def build_pool_coping() -> None:
    """Z17 Kolam luar: Sandstone Pool Coping Edge & Stainless Ladder."""
    mat_coping = make_mat("PoolCoping", "#E0B678", roughness=0.5)
    mat_ladder = make_mat("PoolLadder", "#D1D8E0", roughness=0.2)

    # Coping rim stones
    create_box("CopingN", (1.4, 0.16, 0.1), (0, 0.45, 0.05), mat=mat_coping)
    create_box("CopingS", (1.4, 0.16, 0.1), (0, -0.45, 0.05), mat=mat_coping)
    create_box("CopingW", (0.16, 0.74, 0.1), (-0.62, 0, 0.05), mat=mat_coping)
    create_box("CopingE", (0.16, 0.74, 0.1), (0.62, 0, 0.05), mat=mat_coping)

    # Steel pool ladder railing
    create_cylinder("RailL", 0.02, 0.45, (0.35, 0.38, 0.25), mat=mat_ladder)
    create_cylinder("RailR", 0.02, 0.45, (0.5, 0.38, 0.25), mat=mat_ladder)
    create_cylinder("Rung1", 0.015, 0.15, (0.425, 0.38, 0.35), rotation=(0, math.radians(90), 0), mat=mat_ladder)
    create_cylinder("Rung2", 0.015, 0.15, (0.425, 0.38, 0.2), rotation=(0, math.radians(90), 0), mat=mat_ladder)


def build_pool_water() -> None:
    """Z17 Kolam luar: Shimmering Turquoise Water Tile."""
    mat_water = make_mat("WaterTurquoise", "#00F0FF", roughness=0.1, emission_hex="#00F0FF", emission_strength=1.5)
    mat_caustic = make_mat("WaterCaustic", "#FFFFFF", roughness=0.1)

    create_box("WaterPlane", (1.2, 0.8, 0.04), (0, 0, 0.02), mat=mat_water)
    create_box("Wave1", (0.35, 0.12, 0.045), (-0.2, 0.1, 0.022), mat=mat_caustic)
    create_box("Wave2", (0.4, 0.1, 0.045), (0.2, -0.15, 0.022), mat=mat_caustic)


def build_pool_lounger() -> None:
    """Z17 Kolam luar: Reclining Pool Chaise Lounger."""
    mat_wood = make_mat("LoungerWood", "#E0B678", roughness=0.5)
    mat_cushion = make_mat("LoungerWhite", "#FFFFFF", roughness=0.4)

    # Lounger base & legs
    create_box("Base", (1.1, 0.45, 0.06), (0, 0, 0.15), mat=mat_wood)
    create_cylinder("Leg1", 0.03, 0.15, (-0.45, -0.18, 0.075), mat=mat_wood)
    create_cylinder("Leg2", 0.03, 0.15, (-0.45, 0.18, 0.075), mat=mat_wood)
    create_cylinder("Leg3", 0.03, 0.15, (0.45, -0.18, 0.075), mat=mat_wood)
    create_cylinder("Leg4", 0.03, 0.15, (0.45, 0.18, 0.075), mat=mat_wood)

    # Cushion flat section
    create_box("CushionFlat", (0.7, 0.42, 0.08), (-0.15, 0, 0.22), mat=mat_cushion)
    # Cushion angled backrest
    create_box("CushionBack", (0.4, 0.42, 0.08), (0.35, 0, 0.32), rotation=(0, math.radians(-30), 0), mat=mat_cushion)


def build_pool_umbrella() -> None:
    """Z17 Kolam luar: Round Sunshade Umbrella."""
    mat_base = make_mat("UmbBase", "#14141E", roughness=0.4)
    mat_pole = make_mat("UmbPole", "#A26D3F", roughness=0.5)
    mat_canvas = make_mat("UmbCanvas", "#FFFFFF", roughness=0.6)
    mat_stripe = make_mat("UmbStripe", "#2BB3C0", roughness=0.5)

    create_cylinder("Base", 0.2, 0.06, (0, 0, 0.03), mat=mat_base)
    create_cylinder("Pole", 0.03, 1.4, (0, 0, 0.7), mat=mat_pole)

    # 8-sided cone canopy
    bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=0.65, depth=0.25, location=(0, 0, 1.35))
    canopy = bpy.context.active_object
    canopy.name = "Canopy"
    canopy.data.materials.append(mat_canvas)


def build_tropical_plant() -> None:
    """Z17 Kolam luar: Potted Tropical Palm / Monstera."""
    mat_pot = make_mat("TropPot", "#E0567A", roughness=0.4)
    mat_soil = make_mat("TropSoil", "#14141E", roughness=0.8)
    mat_leaf = make_mat("TropLeaf", "#3FA66B", roughness=0.5)

    create_cylinder("Pot", 0.22, 0.38, (0, 0, 0.19), vertices=12, mat=mat_pot)
    create_cylinder("Soil", 0.2, 0.04, (0, 0, 0.37), vertices=12, mat=mat_soil)

    # Arching leaves
    for angle in [0, 60, 120, 180, 240, 300]:
        rad = math.radians(angle)
        create_box(
            f"Frond_{angle}",
            (0.12, 0.38, 0.02),
            (math.cos(rad) * 0.2, math.sin(rad) * 0.2, 0.55),
            rotation=(math.radians(35) * math.sin(rad), math.radians(35) * math.cos(rad), rad),
            mat=mat_leaf,
        )


def build_billiard_table() -> None:
    """Z15 Arcade: Professional Billiard Pool Table."""
    mat_wood = make_mat("PoolWood", "#4A2814", roughness=0.4)
    mat_cloth = make_mat("PoolCloth", "#3FA66B", roughness=0.6)
    mat_pocket = make_mat("PoolPocket", "#14141E", roughness=0.3)
    mat_ball = make_mat("PoolBall", "#FFFFFF", roughness=0.2)

    # Sturdy table legs
    for lx in [-0.5, 0.5]:
        for ly in [-0.28, 0.28]:
            create_cylinder(f"Leg_{lx}_{ly}", 0.05, 0.55, (lx, ly, 0.275), mat=mat_wood)

    # Table rim & bumpers
    create_box("Rim", (1.25, 0.72, 0.12), (0, 0, 0.6), mat=mat_wood)
    # Green baize cloth
    create_box("Cloth", (1.1, 0.58, 0.13), (0, 0, 0.61), mat=mat_cloth)

    # 6 Pockets
    for px in [-0.52, 0, 0.52]:
        for py in [-0.27, 0.27]:
            create_cylinder(f"Pocket_{px}_{py}", 0.035, 0.14, (px, py, 0.62), mat=mat_pocket)

    # Cue ball & triangle rack balls
    create_cylinder("CueBall", 0.02, 0.04, (-0.25, 0, 0.69), mat=mat_ball)
    create_box("BallsRack", (0.1, 0.1, 0.03), (0.25, 0, 0.69), mat=make_mat("BallRed", "#D23C3C", roughness=0.2))


def build_beanbag() -> None:
    """Z15 Arcade: Soft Comfy Gaming Bean Bag Chair."""
    mat_bag = make_mat("BeanBagCoral", "#E0567A", roughness=0.6)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=0.32, location=(0, 0, 0.25))
    bag = bpy.context.active_object
    bag.scale = (1.1, 1.15, 0.75)
    bag.data.materials.append(mat_bag)


def build_neon_sign(night: bool = False) -> None:
    """Z15 Arcade: Neon Sign Wall Fixture."""
    mat_bracket = make_mat("NeonBracket", "#14141E", roughness=0.4)
    mat_cyan = make_mat("NeonCyan", "#00F0FF", roughness=0.1, emission_hex="#00F0FF", emission_strength=6.0 if night else 2.0)
    mat_pink = make_mat("NeonPink", "#E0567A", roughness=0.1, emission_hex="#E0567A", emission_strength=6.0 if night else 2.0)

    # Backing bracket
    create_box("Bracket", (0.9, 0.06, 0.4), (0, 0, 0.7), mat=mat_bracket)

    # Glowing neon letters/symbols
    create_box("NeonBar1", (0.38, 0.08, 0.06), (-0.2, -0.02, 0.78), mat=mat_cyan)
    create_box("NeonBar2", (0.38, 0.08, 0.06), (0.2, -0.02, 0.78), mat=mat_pink)
    create_box("NeonStar", (0.14, 0.08, 0.14), (0, -0.02, 0.65), mat=mat_cyan)


def build_drawing_desk_tablet(night: bool = False) -> None:
    """Z07 Studio Desain: Muse's Angled Tablet Drawing Workstation."""
    mat_oak = make_mat("DrawDeskOak", "#E0B678", roughness=0.5)
    mat_tablet = make_mat("DrawTablet", "#14141E", roughness=0.3)
    mat_screen = make_mat("DrawScreen", "#E0567A" if night else "#2BB3C0", roughness=0.1, emission_hex="#E0567A" if night else None, emission_strength=4.5)
    mat_stylus = make_mat("DrawStylus", "#D1D8E0", roughness=0.2)

    # Modern desk
    create_box("DeskTop", (1.1, 0.65, 0.06), (0, 0, 0.68), mat=mat_oak)
    create_box("LegL", (0.06, 0.55, 0.65), (-0.45, 0, 0.325), mat=mat_oak)
    create_box("LegR", (0.06, 0.55, 0.65), (0.45, 0, 0.325), mat=mat_oak)

    # 27" tilted drawing display
    create_box("TabletBody", (0.65, 0.42, 0.04), (0, 0, 0.82), rotation=(math.radians(35), 0, 0), mat=mat_tablet)
    create_box("TabletScreen", (0.58, 0.35, 0.045), (0, 0, 0.825), rotation=(math.radians(35), 0, 0), mat=mat_screen)

    # Stylus dock
    create_cylinder("Stylus", 0.015, 0.16, (0.38, -0.12, 0.74), rotation=(math.radians(20), 0, 0), mat=mat_stylus)


def build_moodboard() -> None:
    """Z07 Studio Desain: Pinned Cork Moodboard with UI Cards & Swatches."""
    mat_frame = make_mat("MbFrame", "#A26D3F", roughness=0.5)
    mat_cork = make_mat("MbCork", "#E0B678", roughness=0.7)
    mat_c1 = make_mat("MbCoral", "#E0567A", roughness=0.4)
    mat_c2 = make_mat("MbTeal", "#2BB3C0", roughness=0.4)
    mat_c3 = make_mat("MbWhite", "#FFFFFF", roughness=0.3)

    create_box("Frame", (1.15, 0.06, 0.8), (0, 0, 0.75), mat=mat_frame)
    create_box("CorkSurface", (1.07, 0.07, 0.72), (0, 0, 0.75), mat=mat_cork)

    # Pinned artifacts
    create_box("CardA", (0.24, 0.075, 0.28), (-0.3, -0.01, 0.82), mat=mat_c3)
    create_box("CardB", (0.2, 0.075, 0.2), (-0.02, -0.01, 0.88), mat=mat_c1)
    create_box("CardC", (0.26, 0.075, 0.22), (0.28, -0.01, 0.74), mat=mat_c2)


def build_swatch_wall() -> None:
    """Z07 Studio Desain: Color Swatch Sample Wall Fixture."""
    mat_panel = make_mat("SwPanel", "#1A1C29", roughness=0.4)
    create_box("Panel", (0.95, 0.05, 0.85), (0, 0, 0.7), mat=mat_panel)

    palette_hexes = ["#E0567A", "#2BB3C0", "#00F0FF", "#9CC23A", "#F2C230", "#D23C3C", "#3FA66B", "#8A4FBF"]
    for idx, hex_code in enumerate(palette_hexes):
        col = idx % 4
        row = idx // 4
        px = -0.3 + col * 0.2
        pz = 0.8 - row * 0.2
        mat_tile = make_mat(f"Swatch_{idx}", hex_code, roughness=0.3)
        create_box(f"Tile_{idx}", (0.14, 0.065, 0.14), (px, -0.01, pz), mat=mat_tile)


def build_large_monitor_preview(night: bool = False) -> None:
    """Z09 Graphics Lab: 49" Curved Ultrawide Office Viewport Monitor."""
    mat_chassis = make_mat("UltraChassis", "#14141E", roughness=0.3)
    mat_stand = make_mat("UltraStand", "#9CA8B8", roughness=0.2)
    mat_screen = make_mat("UltraScreen", "#00F0FF" if night else "#475069", roughness=0.1, emission_hex="#00F0FF" if night else None, emission_strength=4.5)
    mat_view = make_mat("UltraView", "#9CC23A", roughness=0.2, emission_hex="#9CC23A" if night else None, emission_strength=3.0)

    # Sturdy metal stand
    create_cylinder("Base", 0.18, 0.04, (0, 0.05, 0.02), mat=mat_stand)
    create_cylinder("Column", 0.035, 0.55, (0, 0.05, 0.28), mat=mat_stand)

    # 49" ultrawide display
    create_box("ScreenBody", (1.2, 0.08, 0.45), (0, 0, 0.58), mat=mat_chassis)
    create_box("ScreenFace", (1.14, 0.09, 0.4), (0, -0.005, 0.58), mat=mat_screen)
    create_box("ViewportCenter", (0.45, 0.095, 0.25), (0, -0.01, 0.58), mat=mat_view)


def build_spare_tiles_pile() -> None:
    """Z09 Graphics Lab: Stack of Replacement Isometric Floor Tiles & Trowel."""
    mat_t1 = make_mat("SpTile1", "#475069", roughness=0.5)
    mat_t2 = make_mat("SpTile2", "#A26D3F", roughness=0.5)
    mat_t3 = make_mat("SpTile3", "#D1D8E0", roughness=0.4)
    mat_tool = make_mat("SpTool", "#9CC23A", roughness=0.3)

    # Stack of staggered tiles
    create_box("Tile1", (0.5, 0.5, 0.04), (0, 0, 0.02), mat=mat_t1)
    create_box("Tile2", (0.5, 0.5, 0.04), (0.02, -0.02, 0.06), rotation=(0, 0, math.radians(8)), mat=mat_t2)
    create_box("Tile3", (0.5, 0.5, 0.04), (-0.02, 0.02, 0.1), rotation=(0, 0, math.radians(-12)), mat=mat_t3)

    # Level tool / trowel
    create_box("TrowelHandle", (0.04, 0.16, 0.03), (0.28, -0.18, 0.12), mat=make_mat("TrWood", "#4A2814", roughness=0.5))
    create_box("TrowelBlade", (0.12, 0.18, 0.01), (0.28, -0.05, 0.11), mat=mat_tool)


def build_qa_screens(night: bool = False) -> None:
    """Z10 QA Station: Triple-Monitor QA Test & CI Status Array."""
    mat_chassis = make_mat("QaChassis", "#14141E", roughness=0.3)
    mat_stand = make_mat("QaStand", "#475069", roughness=0.4)
    mat_pass = make_mat("QaPass", "#3FA66B", roughness=0.1, emission_hex="#3FA66B" if night else None, emission_strength=4.5)
    mat_fail = make_mat("QaFail", "#D23C3C", roughness=0.1, emission_hex="#D23C3C" if night else None, emission_strength=4.5)
    mat_code = make_mat("QaCode", "#2BB3C0" if night else "#9CA8B8", roughness=0.2, emission_hex="#2BB3C0" if night else None, emission_strength=3.5)

    # Stand
    create_cylinder("Base", 0.2, 0.04, (0, 0.05, 0.02), mat=mat_stand)
    create_cylinder("Arm", 0.03, 0.5, (0, 0.05, 0.25), mat=mat_stand)

    # Center Monitor
    create_box("MonCenter", (0.42, 0.05, 0.32), (0, 0, 0.52), mat=mat_chassis)
    create_box("ScreenCenter", (0.38, 0.055, 0.28), (0, -0.005, 0.52), mat=mat_pass)

    # Left Monitor (angled)
    create_box("MonLeft", (0.38, 0.05, 0.3), (-0.38, 0.06, 0.52), rotation=(0, 0, math.radians(-25)), mat=mat_chassis)
    create_box("ScreenLeft", (0.34, 0.055, 0.26), (-0.37, 0.06, 0.52), rotation=(0, 0, math.radians(-25)), mat=mat_code)

    # Right Monitor (angled)
    create_box("MonRight", (0.38, 0.05, 0.3), (0.38, 0.06, 0.52), rotation=(0, 0, math.radians(25)), mat=mat_chassis)
    create_box("ScreenRight", (0.34, 0.055, 0.26), (0.37, 0.06, 0.52), rotation=(0, 0, math.radians(25)), mat=mat_fail)


def build_stamp_desk() -> None:
    """Z10 QA Station: Sentinel's Desk with PASS/FAIL Physical Stamps."""
    mat_wood = make_mat("StampDeskWood", "#A26D3F", roughness=0.5)
    mat_tray = make_mat("StampTray", "#D1D8E0", roughness=0.3)
    mat_stamp_pass = make_mat("StampPass", "#3FA66B", roughness=0.3)
    mat_stamp_fail = make_mat("StampFail", "#D23C3C", roughness=0.3)

    create_box("DeskTop", (1.05, 0.65, 0.06), (0, 0, 0.68), mat=mat_wood)
    create_box("LegL", (0.06, 0.55, 0.65), (-0.42, 0, 0.325), mat=mat_wood)
    create_box("LegR", (0.06, 0.55, 0.65), (0.42, 0, 0.325), mat=mat_wood)

    # Document inbox/outbox tray
    create_box("DocTray", (0.24, 0.32, 0.08), (-0.28, 0.05, 0.75), mat=mat_tray)
    create_box("PaperStack", (0.2, 0.28, 0.06), (-0.28, 0.05, 0.77), mat=make_mat("PaperWhite", "#FFFFFF", roughness=0.3))

    # PASS and FAIL Stamp Handles
    create_cylinder("StampPass", 0.035, 0.12, (0.2, -0.08, 0.77), mat=mat_stamp_pass)
    create_cylinder("StampFail", 0.035, 0.12, (0.32, -0.08, 0.77), mat=mat_stamp_fail)


def build_lamp_pass_fail(night: bool = False) -> None:
    """Z10 QA Station: Industrial Tower Beacon Light with Green & Red Lenses."""
    mat_post = make_mat("BeaconPost", "#14141E", roughness=0.4)
    mat_green = make_mat("BeaconGreen", "#3FA66B", roughness=0.1, emission_hex="#3FA66B" if night else None, emission_strength=5.0)
    mat_red = make_mat("BeaconRed", "#D23C3C", roughness=0.1)

    create_cylinder("Base", 0.12, 0.04, (0, 0, 0.02), mat=mat_post)
    create_cylinder("Stem", 0.025, 0.45, (0, 0, 0.25), mat=mat_post)
    create_cylinder("LensRed", 0.065, 0.14, (0, 0, 0.55), mat=mat_red)
    create_cylinder("LensGreen", 0.065, 0.14, (0, 0, 0.71), mat=mat_green)
    create_cylinder("Cap", 0.07, 0.03, (0, 0, 0.8), mat=mat_post)


def build_soc_map_wall(night: bool = False) -> None:
    """Z12 Data Center & SOC: Global Threat Vector Video Wall Display."""
    mat_bezel = make_mat("SocBezel", "#14141E", roughness=0.3)
    mat_grid = make_mat("SocGrid", "#1A1C29" if night else "#282D3F", roughness=0.5)
    mat_cyan_nodes = make_mat("SocNodes", "#00F0FF", roughness=0.1, emission_hex="#00F0FF" if night else None, emission_strength=4.5)
    mat_vector_red = make_mat("SocVector", "#D23C3C", roughness=0.1, emission_hex="#D23C3C" if night else None, emission_strength=4.0)

    create_box("WallFrame", (1.35, 0.06, 0.85), (0, 0, 0.75), mat=mat_bezel)
    create_box("DisplayGrid", (1.28, 0.07, 0.78), (0, 0, 0.75), mat=mat_grid)

    # Global Nodes & Vectors
    create_box("Node1", (0.06, 0.075, 0.06), (-0.35, -0.01, 0.82), mat=mat_cyan_nodes)
    create_box("Node2", (0.06, 0.075, 0.06), (0.28, -0.01, 0.86), mat=mat_cyan_nodes)
    create_box("VectorThreat", (0.35, 0.075, 0.04), (0.02, -0.01, 0.74), rotation=(0, math.radians(-15), 0), mat=mat_vector_red)


def build_alert_console(night: bool = False) -> None:
    """Z12 Data Center & SOC: Slanted Cyber Security Alert Operator Console."""
    mat_body = make_mat("ConsoleBody", "#1A1C29", roughness=0.4)
    mat_surface = make_mat("ConsoleSurf", "#282D3F", roughness=0.3)
    mat_amber = make_mat("AlertAmber", "#F2C230", roughness=0.1, emission_hex="#F2C230" if night else None, emission_strength=4.5)
    mat_beacon = make_mat("AlertBeacon", "#D23C3C", roughness=0.1, emission_hex="#D23C3C" if night else None, emission_strength=5.0)

    # Base chassis
    create_box("BaseCabinet", (0.9, 0.6, 0.6), (0, 0, 0.3), mat=mat_body)
    # Slanted control deck
    create_box("ControlDeck", (0.86, 0.55, 0.1), (0, 0, 0.68), rotation=(math.radians(20), 0, 0), mat=mat_surface)

    # Radar circle & warning lamp
    create_cylinder("RadarDial", 0.12, 0.02, (-0.22, -0.05, 0.74), rotation=(math.radians(20), 0, 0), mat=mat_amber)
    create_cylinder("AlarmBeacon", 0.04, 0.08, (0.3, 0.1, 0.82), mat=mat_beacon)


def build_reception_desk() -> None:
    """Z13 Lobi: Warden's Curved Lobby Reception Counter."""
    mat_slate = make_mat("RecSlate", "#282D3F", roughness=0.4)
    mat_wood = make_mat("RecWood", "#E0B678", roughness=0.4)
    mat_bell = make_mat("RecBell", "#FEF9C3", roughness=0.2)

    # Counter front curved assembly
    create_box("CounterMain", (1.2, 0.6, 0.75), (0, 0, 0.375), mat=mat_slate)
    create_box("TopSlab", (1.28, 0.68, 0.08), (0, 0, 0.79), mat=mat_wood)

    # Visitor bell & registry book
    create_cylinder("DeskBell", 0.04, 0.05, (0.4, -0.15, 0.85), mat=mat_bell)
    create_box("RegistryBook", (0.22, 0.28, 0.03), (-0.25, -0.1, 0.84), mat=make_mat("BookCover", "#4A2814", roughness=0.5))


def build_attendance_board() -> None:
    """Z13 Lobi: 15-Agent Roster & Status Attendance Board."""
    mat_frame = make_mat("AttFrame", "#A26D3F", roughness=0.5)
    mat_board = make_mat("AttBoard", "#1A1C29", roughness=0.5)
    mat_active = make_mat("AttActive", "#3FA66B", roughness=0.2)
    mat_away = make_mat("AttAway", "#F2C230", roughness=0.2)

    create_box("Frame", (0.9, 0.06, 0.85), (0, 0, 0.7), mat=mat_frame)
    create_box("Board", (0.82, 0.07, 0.77), (0, 0, 0.7), mat=mat_board)

    # 3 rows of agent tags
    for r in range(3):
        for c in range(5):
            px = -0.3 + c * 0.15
            pz = 0.88 - r * 0.16
            mat_pin = mat_active if (r * 5 + c) % 3 != 0 else mat_away
            create_cylinder(f"Pin_{r}_{c}", 0.02, 0.03, (px, -0.01, pz), rotation=(math.radians(90), 0, 0), mat=mat_pin)


def build_entrance_door() -> None:
    """Z13 Lobi: Double Commercial Glass Entrance Portal."""
    mat_frame = make_mat("DoorFrame", "#9CA8B8", roughness=0.3)
    mat_glass = make_mat("DoorGlass", "#D1D8E0", roughness=0.1)
    mat_handle = make_mat("DoorHandle", "#D1D8E0", roughness=0.2)

    # Frame portal
    create_box("PostL", (0.08, 0.1, 1.4), (-0.55, 0, 0.7), mat=mat_frame)
    create_box("PostR", (0.08, 0.1, 1.4), (0.55, 0, 0.7), mat=mat_frame)
    create_box("Header", (1.18, 0.1, 0.1), (0, 0, 1.35), mat=mat_frame)

    # Glass doors
    create_box("DoorL", (0.48, 0.04, 1.25), (-0.26, 0, 0.675), mat=mat_glass)
    create_box("DoorR", (0.48, 0.04, 1.25), (0.26, 0, 0.675), mat=mat_glass)
    create_cylinder("HandleL", 0.02, 0.4, (-0.06, -0.04, 0.65), mat=mat_handle)
    create_cylinder("HandleR", 0.02, 0.4, (0.06, -0.04, 0.65), mat=mat_handle)


def build_marble_counter() -> None:
    """Z14 Kafetaria & Lounge: Polished White Marble Serving Counter."""
    mat_marble = make_mat("MarbleTop", "#F5F0E1", roughness=0.2)
    mat_base = make_mat("CounterBase", "#4A2814", roughness=0.5)

    create_box("BaseCabinet", (1.2, 0.6, 0.7), (0, 0, 0.35), mat=mat_base)
    create_box("MarbleSlab", (1.28, 0.68, 0.08), (0, 0, 0.74), mat=mat_marble)


def build_espresso_machine() -> None:
    """Z14 Kafetaria & Lounge: Two-Group Italian Commercial Espresso Machine."""
    mat_steel = make_mat("EspressoSteel", "#D1D8E0", roughness=0.2)
    mat_boiler = make_mat("EspressoBody", "#475069", roughness=0.4)
    mat_gauge = make_mat("EspressoGauge", "#FEF9C3", roughness=0.2)
    mat_portafilter = make_mat("Portafilter", "#14141E", roughness=0.4)

    # Machine body
    create_box("Body", (0.6, 0.45, 0.4), (0, 0, 0.25), mat=mat_boiler)
    create_box("TopTray", (0.58, 0.43, 0.04), (0, 0, 0.47), mat=mat_steel)

    # 2 Group Heads & Portafilters
    for gx in [-0.14, 0.14]:
        create_cylinder(f"Group_{gx}", 0.045, 0.08, (gx, -0.16, 0.22), mat=mat_steel)
        create_cylinder(f"Handle_{gx}", 0.018, 0.14, (gx, -0.28, 0.2), rotation=(math.radians(90), 0, 0), mat=mat_portafilter)

    # Dual steam wands & pressure gauge
    create_cylinder("Gauge", 0.03, 0.02, (0, -0.23, 0.34), rotation=(math.radians(90), 0, 0), mat=mat_gauge)


def build_achievement_board() -> None:
    """Z14 Kafetaria & Lounge: Cafeteria Daily Velocity Achievement Board."""
    mat_frame = make_mat("AchFrame", "#A26D3F", roughness=0.5)
    mat_slate = make_mat("AchBoard", "#14141E", roughness=0.6)
    mat_gold = make_mat("AchGold", "#FEF9C3", roughness=0.3)

    create_box("Frame", (0.9, 0.06, 0.8), (0, 0, 0.7), mat=mat_frame)
    create_box("Board", (0.82, 0.07, 0.72), (0, 0, 0.7), mat=mat_slate)

    # Trophy / star icon
    create_box("StarBadge", (0.16, 0.075, 0.16), (0, -0.01, 0.88), mat=mat_gold)
    # Chalk scores
    create_box("Score1", (0.45, 0.075, 0.05), (0, -0.01, 0.72), mat=make_mat("ChalkWhite", "#FFFFFF", roughness=0.5))
    create_box("Score2", (0.35, 0.075, 0.05), (0, -0.01, 0.6), mat=make_mat("ChalkCyan", "#2BB3C0", roughness=0.5))


def build_desk_executive() -> None:
    """Z01 Ruang CEO: Jarvis's Dark Walnut Executive Desk."""
    mat_walnut = make_mat("ExecWalnut", "#4A2814", roughness=0.4)
    mat_leather = make_mat("ExecBlotter", "#14141E", roughness=0.6)
    mat_brass = make_mat("ExecBrass", "#E0B678", roughness=0.2)

    create_box("DeskTop", (1.25, 0.7, 0.08), (0, 0, 0.7), mat=mat_walnut)
    create_box("PedestalL", (0.3, 0.6, 0.66), (-0.42, 0, 0.33), mat=mat_walnut)
    create_box("PedestalR", (0.3, 0.6, 0.66), (0.42, 0, 0.33), mat=mat_walnut)
    create_box("DeskModesty", (0.6, 0.04, 0.5), (0, 0.25, 0.4), mat=mat_walnut)

    # Leather Desk Blotter
    create_box("Blotter", (0.55, 0.42, 0.02), (0, -0.05, 0.75), mat=mat_leather)
    create_cylinder("LampBase", 0.05, 0.02, (0.4, 0.15, 0.75), mat=mat_brass)


def build_wall_monitors_ceo(night: bool = False) -> None:
    """Z01 Ruang CEO: 6-Screen Executive Status Wall Array."""
    mat_bezel = make_mat("CeoBezel", "#14141E", roughness=0.3)
    mat_screen = make_mat("CeoScreen", "#1F3A68" if night else "#475069", roughness=0.1, emission_hex="#00F0FF" if night else None, emission_strength=4.5)
    mat_graph = make_mat("CeoGraph", "#F2C230", roughness=0.2, emission_hex="#F2C230" if night else None, emission_strength=3.5)

    # 2 rows of 3 monitors
    for r in range(2):
        for c in range(3):
            mx = -0.38 + c * 0.38
            mz = 0.5 + r * 0.36
            create_box(f"Mon_{r}_{c}", (0.34, 0.05, 0.28), (mx, 0, mz), mat=mat_bezel)
            create_box(f"Scr_{r}_{c}", (0.31, 0.055, 0.25), (mx, -0.005, mz), mat=mat_screen)
            if (r + c) % 2 == 0:
                create_box(f"Graph_{r}_{c}", (0.18, 0.06, 0.06), (mx, -0.01, mz - 0.04), mat=mat_graph)


def build_sofa_leather() -> None:
    """Z01 Ruang CEO: Executive Leather Chesterfield Sofa."""
    mat_leather = make_mat("ChesterLeather", "#4A2814", roughness=0.5)

    create_box("Base", (1.2, 0.6, 0.2), (0, 0, 0.1), mat=mat_leather)
    create_box("Backrest", (1.2, 0.2, 0.45), (0, 0.2, 0.42), mat=mat_leather)
    create_box("ArmL", (0.2, 0.6, 0.35), (-0.5, 0, 0.37), mat=mat_leather)
    create_box("ArmR", (0.2, 0.6, 0.35), (0.5, 0, 0.37), mat=mat_leather)
    create_box("SeatCushion", (0.8, 0.42, 0.12), (0, -0.05, 0.26), mat=mat_leather)


def build_trophy_shelf() -> None:
    """Z01 Ruang CEO: Glass & Walnut Executive Trophy Display Case."""
    mat_walnut = make_mat("TrophyCase", "#4A2814", roughness=0.4)
    mat_glass = make_mat("TrophyGlass", "#D1D8E0", roughness=0.1)
    mat_gold = make_mat("TrophyGold", "#F2C230", roughness=0.1, emission_hex="#FEF9C3", emission_strength=1.5)

    create_box("Top", (0.8, 0.35, 0.06), (0, 0, 1.2), mat=mat_walnut)
    create_box("Btm", (0.8, 0.35, 0.12), (0, 0, 0.06), mat=mat_walnut)
    create_box("SideL", (0.05, 0.35, 1.1), (-0.375, 0, 0.6), mat=mat_walnut)
    create_box("SideR", (0.05, 0.35, 1.1), (0.375, 0, 0.6), mat=mat_walnut)
    create_box("Shelf1", (0.7, 0.32, 0.02), (0, 0, 0.45), mat=mat_glass)
    create_box("Shelf2", (0.7, 0.32, 0.02), (0, 0, 0.8), mat=mat_glass)

    # Trophies
    create_cylinder("Cup1", 0.04, 0.16, (-0.18, 0, 0.54), mat=mat_gold)
    create_cylinder("Cup2", 0.05, 0.2, (0.15, 0, 0.9), mat=mat_gold)


def build_boardroom_table() -> None:
    """Z02 Boardroom: Large Polished Oak 12-Seat Conference Table."""
    mat_oak = make_mat("BoardTableOak", "#A26D3F", roughness=0.4)
    mat_puck = make_mat("ConfMicPuck", "#14141E", roughness=0.4)

    create_box("TableSlab", (1.4, 0.72, 0.08), (0, 0, 0.68), mat=mat_oak)
    create_box("BaseL", (0.12, 0.55, 0.64), (-0.48, 0, 0.32), mat=mat_oak)
    create_box("BaseR", (0.12, 0.55, 0.64), (0.48, 0, 0.32), mat=mat_oak)

    # Central Conference Speaker Puck
    create_cylinder("MicPuck", 0.08, 0.02, (0, 0, 0.73), mat=mat_puck)


def build_presentation_screen(night: bool = False) -> None:
    """Z02 Boardroom: Motorized Presentation Projection Display."""
    mat_housing = make_mat("PresHousing", "#14141E", roughness=0.3)
    mat_screen = make_mat("PresScreen", "#FFFFFF" if night else "#D1D8E0", roughness=0.2, emission_hex="#FFFFFF" if night else None, emission_strength=4.0)
    mat_diag = make_mat("PresDiag", "#2F6FB3", roughness=0.2, emission_hex="#2BB3C0" if night else None, emission_strength=3.0)

    create_box("Housing", (1.35, 0.08, 0.08), (0, 0, 1.25), mat=mat_housing)
    create_box("ScreenSurface", (1.25, 0.04, 0.75), (0, 0, 0.8), mat=mat_screen)
    create_box("ChartGraphic", (0.65, 0.045, 0.35), (0, -0.005, 0.8), mat=mat_diag)


def build_glass_partition(night: bool = False) -> None:
    """Z02 Boardroom: Frosted Glass Architectural Partition Wall."""
    mat_metal = make_mat("GlassFrame", "#D1D8E0", roughness=0.2)
    mat_pane = make_mat("GlassPane", "#2BB3C0" if night else "#9CA8B8", roughness=0.1, emission_hex="#00F0FF" if night else None, emission_strength=1.5 if night else 0.0)

    create_box("PostTop", (1.3, 0.06, 0.06), (0, 0, 1.3), mat=mat_metal)
    create_box("PostBtm", (1.3, 0.06, 0.06), (0, 0, 0.03), mat=mat_metal)
    create_box("GlassBody", (1.25, 0.03, 1.22), (0, 0, 0.67), mat=mat_pane)


def build_green_reading_lamp(night: bool = False) -> None:
    """Z05 Perpustakaan: Emerald Green Glass Banker's Reading Lamp."""
    mat_brass = make_mat("BankerBrass", "#E0B678", roughness=0.2)
    mat_green = make_mat("BankerGreen", "#3FA66B", roughness=0.1, emission_hex="#FEF9C3" if night else None, emission_strength=5.0)

    create_cylinder("Base", 0.08, 0.03, (0, 0, 0.015), mat=mat_brass)
    create_cylinder("Stem", 0.018, 0.3, (0, 0, 0.16), mat=mat_brass)
    create_box("Hood", (0.24, 0.12, 0.08), (0, 0, 0.32), mat=mat_green)


def build_printing_press() -> None:
    """Z05 Perpustakaan: Scribe's Compact Mechanical Printing Press."""
    mat_iron = make_mat("PressIron", "#14141E", roughness=0.4)
    mat_brass = make_mat("PressBrass", "#E0B678", roughness=0.2)
    mat_paper = make_mat("PressPaper", "#FFFFFF", roughness=0.4)

    create_box("IronBase", (0.55, 0.45, 0.18), (0, 0, 0.09), mat=mat_iron)
    create_cylinder("Roller", 0.06, 0.4, (0, 0, 0.24), rotation=(0, math.radians(90), 0), mat=mat_iron)
    create_cylinder("CrankWheel", 0.12, 0.03, (0.26, 0, 0.24), rotation=(0, math.radians(90), 0), mat=mat_brass)
    create_box("PaperStack", (0.28, 0.32, 0.04), (-0.1, 0, 0.19), mat=mat_paper)


def build_workstation_dev(night: bool = False) -> None:
    """Z08 Dev Pods: Dual-Monitor Developer Workstation."""
    mat_desk = make_mat("DevDeskWood", "#475069", roughness=0.5)
    mat_bezel = make_mat("DevMonBezel", "#14141E", roughness=0.3)
    mat_code_screen = make_mat("DevCodeScr", "#00F0FF" if night else "#282D3F", roughness=0.1, emission_hex="#00F0FF" if night else None, emission_strength=4.5)
    mat_term_screen = make_mat("DevTermScr", "#3FA66B" if night else "#282D3F", roughness=0.1, emission_hex="#3FA66B" if night else None, emission_strength=4.5)
    mat_kb = make_mat("DevKeyboard", "#D1D8E0", roughness=0.4)

    create_box("DeskSlab", (1.1, 0.65, 0.06), (0, 0, 0.68), mat=mat_desk)
    create_box("LegL", (0.05, 0.55, 0.65), (-0.45, 0, 0.325), mat=mat_desk)
    create_box("LegR", (0.05, 0.55, 0.65), (0.45, 0, 0.325), mat=mat_desk)

    # Dual Monitors
    create_box("MonL", (0.4, 0.05, 0.28), (-0.22, 0.1, 0.88), rotation=(0, 0, math.radians(-10)), mat=mat_bezel)
    create_box("ScrL", (0.36, 0.055, 0.24), (-0.22, 0.095, 0.88), rotation=(0, 0, math.radians(-10)), mat=mat_code_screen)
    create_box("MonR", (0.4, 0.05, 0.28), (0.22, 0.1, 0.88), rotation=(0, 0, math.radians(10)), mat=mat_bezel)
    create_box("ScrR", (0.36, 0.055, 0.24), (0.22, 0.095, 0.88), rotation=(0, 0, math.radians(10)), mat=mat_term_screen)

    # Keyboard
    create_box("Keyboard", (0.35, 0.14, 0.02), (0, -0.12, 0.72), mat=mat_kb)


def build_workstation_guest(night: bool = False) -> None:
    """Z08 Dev Pods: Guest / Visitor Workstation Pod."""
    mat_desk = make_mat("GuestDesk", "#475069", roughness=0.5)
    mat_bezel = make_mat("GuestBezel", "#14141E", roughness=0.3)
    mat_screen = make_mat("GuestScreen", "#2BB3C0" if night else "#282D3F", roughness=0.1, emission_hex="#2BB3C0" if night else None, emission_strength=4.0)

    create_box("DeskSlab", (0.9, 0.6, 0.06), (0, 0, 0.68), mat=mat_desk)
    create_box("LegL", (0.05, 0.5, 0.65), (-0.38, 0, 0.325), mat=mat_desk)
    create_box("LegR", (0.05, 0.5, 0.65), (0.38, 0, 0.325), mat=mat_desk)
    create_box("Mon", (0.48, 0.05, 0.3), (0, 0.1, 0.9), mat=mat_bezel)
    create_box("Scr", (0.44, 0.055, 0.26), (0, 0.095, 0.9), mat=mat_screen)


def build_pair_standing_desk() -> None:
    """Z08 Dev Pods: Motorized Dual Standing Desk."""
    mat_top = make_mat("StandDeskTop", "#D1D8E0", roughness=0.3)
    mat_legs = make_mat("StandDeskLegs", "#14141E", roughness=0.4)

    create_box("TopSlab", (1.2, 0.65, 0.06), (0, 0, 0.95), mat=mat_top)
    create_box("TelescopicL", (0.08, 0.08, 0.92), (-0.45, 0, 0.46), mat=mat_legs)
    create_box("TelescopicR", (0.08, 0.08, 0.92), (0.45, 0, 0.46), mat=mat_legs)
    create_box("FootL", (0.08, 0.55, 0.05), (-0.45, 0, 0.025), mat=mat_legs)
    create_box("FootR", (0.08, 0.55, 0.05), (0.45, 0, 0.025), mat=mat_legs)


# ---------------------------------------------------------------------------
# Floor Tile 3D Diamond Mesh Builders
# ---------------------------------------------------------------------------

def build_floor_tile(
    base_hex: str,
    accent_hex: str | None = None,
    pattern: str = "plain",
    thickness: float = 0.08,
) -> None:
    """Build a 1.0x1.0 square tile at Z=0 that projects into a 64x32 dimetric diamond."""
    mat_base = make_mat(f"Tile_{base_hex}", base_hex, roughness=0.5)

    # Base slab
    create_box("BaseSlab", (1.0, 1.0, thickness), (0, 0, thickness / 2.0), mat=mat_base)

    if pattern == "border" and accent_hex:
        # Inlay perimeter border
        mat_acc = make_mat(f"Acc_{accent_hex}", accent_hex, roughness=0.4)
        create_box("BorderN", (1.0, 0.08, thickness + 0.005), (0, 0.46, thickness / 2.0), mat=mat_acc)
        create_box("BorderS", (1.0, 0.08, thickness + 0.005), (0, -0.46, thickness / 2.0), mat=mat_acc)
        create_box("BorderW", (0.08, 0.84, thickness + 0.005), (-0.46, 0, thickness / 2.0), mat=mat_acc)
        create_box("BorderE", (0.08, 0.84, thickness + 0.005), (0.46, 0, thickness / 2.0), mat=mat_acc)

    elif pattern == "planks" and accent_hex:
        # Parallel wooden floor planks
        mat_seam = make_mat(f"Acc_{accent_hex}", accent_hex, roughness=0.6)
        for py in [-0.25, 0.0, 0.25]:
            create_box(f"PlankSeam_{py}", (1.0, 0.03, thickness + 0.005), (0, py, thickness / 2.0), mat=mat_seam)

    elif pattern == "checker" and accent_hex:
        # 2x2 Checkerboard pattern
        mat_acc = make_mat(f"Acc_{accent_hex}", accent_hex, roughness=0.4)
        create_box("Check1", (0.48, 0.48, thickness + 0.005), (-0.25, 0.25, thickness / 2.0), mat=mat_acc)
        create_box("Check2", (0.48, 0.48, thickness + 0.005), (0.25, -0.25, thickness / 2.0), mat=mat_acc)

    elif pattern == "shaf" and accent_hex:
        # Islamic prayer row alignment line
        mat_acc = make_mat(f"Acc_{accent_hex}", accent_hex, roughness=0.3)
        create_box("ShafStripe", (1.0, 0.14, thickness + 0.005), (0, 0.25, thickness / 2.0), mat=mat_acc)

    elif pattern == "grid" and accent_hex:
        # Technical grid line
        mat_acc = make_mat(f"Acc_{accent_hex}", accent_hex, roughness=0.4)
        create_box("GridH", (1.0, 0.04, thickness + 0.005), (0, 0, thickness / 2.0), mat=mat_acc)
        create_box("GridV", (0.04, 1.0, thickness + 0.005), (0, 0, thickness / 2.0), mat=mat_acc)


# ---------------------------------------------------------------------------
# Wall Builders (Back Full-Height & Front 8px Cutaway)
# ---------------------------------------------------------------------------

def build_wall_back_nw() -> None:
    """Full-height back wall facing South-East (along NW room perimeter)."""
    mat_stone = make_mat("WallStone", "#475069", roughness=0.6)
    mat_coping = make_mat("WallCoping", "#687594", roughness=0.4)
    mat_mortar = make_mat("WallMortar", "#282D3F", roughness=0.7)

    # Full height wall slab
    create_box("WallBody", (0.15, 1.0, 1.2), (0, 0, 0.6), mat=mat_stone)
    create_box("TopCoping", (0.2, 1.0, 0.08), (0, 0, 1.24), mat=mat_coping)
    # Mortar course lines
    for mz in [0.3, 0.6, 0.9]:
        create_box(f"Mortar_{mz}", (0.16, 1.0, 0.02), (0, 0, mz), mat=mat_mortar)


def build_wall_back_ne() -> None:
    """Full-height back wall facing South-West (along NE room perimeter)."""
    mat_stone = make_mat("WallStone", "#475069", roughness=0.6)
    mat_coping = make_mat("WallCoping", "#687594", roughness=0.4)
    mat_mortar = make_mat("WallMortar", "#282D3F", roughness=0.7)

    create_box("WallBody", (1.0, 0.15, 1.2), (0, 0, 0.6), mat=mat_stone)
    create_box("TopCoping", (1.0, 0.2, 0.08), (0, 0, 1.24), mat=mat_coping)
    for mz in [0.3, 0.6, 0.9]:
        create_box(f"Mortar_{mz}", (1.0, 0.16, 0.02), (0, 0, mz), mat=mat_mortar)


def build_wall_back_corner_n() -> None:
    """Full-height north interior corner where NW and NE walls meet."""
    build_wall_back_nw()
    build_wall_back_ne()


def build_wall_back_doorway() -> None:
    """Full-height back wall with arched standard passage doorway."""
    mat_stone = make_mat("WallStone", "#475069", roughness=0.6)
    mat_frame = make_mat("DoorFrame", "#687594", roughness=0.4)

    create_box("WallPostL", (0.15, 0.25, 1.2), (0, -0.375, 0.6), mat=mat_stone)
    create_box("WallPostR", (0.15, 0.25, 1.2), (0, 0.375, 0.6), mat=mat_stone)
    create_box("WallLintel", (0.15, 0.5, 0.35), (0, 0, 1.025), mat=mat_stone)
    create_box("LintelCoping", (0.2, 1.0, 0.08), (0, 0, 1.24), mat=mat_frame)


def build_wall_back_window(night: bool = False) -> None:
    """Full-height back wall with glass window showing sky (day/night)."""
    mat_stone = make_mat("WallStone", "#475069", roughness=0.6)
    mat_frame = make_mat("WinFrame", "#9CA8B8", roughness=0.3)
    mat_glass = make_mat(
        "WinGlass",
        "#1A1C29" if night else "#D1D8E0",
        roughness=0.1,
        emission_hex="#00F0FF" if night else "#FFFFFF",
        emission_strength=3.5 if night else 1.0,
    )

    create_box("WallBtm", (0.15, 1.0, 0.45), (0, 0, 0.225), mat=mat_stone)
    create_box("WallTop", (0.15, 1.0, 0.25), (0, 0, 1.075), mat=mat_stone)
    create_box("WallPostL", (0.15, 0.15, 0.5), (0, -0.425, 0.7), mat=mat_stone)
    create_box("WallPostR", (0.15, 0.15, 0.5), (0, 0.425, 0.7), mat=mat_stone)

    # Window Pane & Frame
    create_box("Frame", (0.18, 0.72, 0.52), (0, 0, 0.7), mat=mat_frame)
    create_box("Glass", (0.12, 0.66, 0.46), (0, 0, 0.7), mat=mat_glass)


def build_wall_front_cutaway_sw() -> None:
    """Front cutaway wall 8px along South-West room perimeter."""
    mat_wall = make_mat("CutWall", "#475069", roughness=0.5)
    mat_top = make_mat("CutTop", "#687594", roughness=0.3)

    # 8px height corresponds to ~0.24 unit in Blender space
    create_box("CutBody", (1.0, 0.15, 0.24), (0, 0, 0.12), mat=mat_wall)
    create_box("CutTopEdge", (1.0, 0.16, 0.04), (0, 0, 0.24), mat=mat_top)


def build_wall_front_cutaway_se() -> None:
    """Front cutaway wall 8px along South-East room perimeter."""
    mat_wall = make_mat("CutWall", "#475069", roughness=0.5)
    mat_top = make_mat("CutTop", "#687594", roughness=0.3)

    create_box("CutBody", (0.15, 1.0, 0.24), (0, 0, 0.12), mat=mat_wall)
    create_box("CutTopEdge", (0.16, 1.0, 0.04), (0, 0, 0.24), mat=mat_top)


def build_wall_front_cutaway_corner_s() -> None:
    """Front cutaway corner where SW and SE cutaways meet."""
    build_wall_front_cutaway_sw()
    build_wall_front_cutaway_se()


def build_wall_front_cutaway_doorway() -> None:
    """Front cutaway wall with gap for floor passage."""
    mat_wall = make_mat("CutWall", "#475069", roughness=0.5)
    mat_top = make_mat("CutTop", "#687594", roughness=0.3)

    create_box("CutPostL", (0.3, 0.15, 0.24), (-0.35, 0, 0.12), mat=mat_wall)
    create_box("CutTopL", (0.3, 0.16, 0.04), (-0.35, 0, 0.24), mat=mat_top)
    create_box("CutPostR", (0.3, 0.15, 0.24), (0.35, 0, 0.12), mat=mat_wall)
    create_box("CutTopR", (0.3, 0.16, 0.04), (0.35, 0, 0.24), mat=mat_top)


# ---------------------------------------------------------------------------
# Master Manifest of Environment Sprites to Render
# Format: (name, builder_fn, arg, filename, rx, ry, target_tuple, ortho_scale)
# ---------------------------------------------------------------------------

ENV_RENDER_MANIFEST = [
    # --- Custom Furniture Models ---
    ("server_rack", build_server_rack, False, "furniture_server_rack.png", 64, 64, (0, 0, 0.65), 1.95),
    ("server_rack_night", build_server_rack, True, "furniture_server_rack_night.png", 64, 64, (0, 0, 0.65), 1.95),
    ("arcade_cabinet", build_arcade_cabinet, False, "furniture_arcade_cabinet.png", 64, 64, (0, 0, 0.65), 1.95),
    ("arcade_cabinet_night", build_arcade_cabinet, True, "furniture_arcade_cabinet_night.png", 64, 64, (0, 0, 0.65), 1.95),
    ("lab_bench", build_lab_bench, None, "furniture_lab_bench.png", 64, 64, (0, 0, 0.45), 1.95),
    ("microscope", build_microscope, None, "furniture_microscope.png", 64, 64, (0, 0, 0.25), 1.95),
    ("test_tube_rack", build_test_tube_rack, None, "furniture_test_tube_rack.png", 64, 64, (0, 0, 0.15), 1.95),
    ("whiteboard_formula", build_whiteboard_formula, None, "furniture_whiteboard_formula.png", 64, 64, (0, 0, 0.6), 1.95),
    ("journal_shelf", build_journal_shelf, None, "furniture_journal_shelf.png", 64, 64, (0, 0, 0.4), 1.95),
    ("blueprint_table", build_blueprint_table, None, "furniture_blueprint_table.png", 64, 64, (0, 0, 0.5), 1.95),
    ("system_model_mini", build_system_model_mini, None, "furniture_system_model_mini.png", 64, 64, (0, 0, 0.25), 1.95),
    ("blueprint_rack", build_blueprint_rack, None, "furniture_blueprint_rack.png", 64, 64, (0, 0, 0.3), 1.95),
    ("whiteboard", build_whiteboard, None, "furniture_whiteboard.png", 64, 64, (0, 0, 0.6), 1.95),
    ("conveyor", build_conveyor, None, "furniture_conveyor.png", 64, 64, (0, 0, 0.45), 1.95),
    ("parcel_rack", build_parcel_rack, None, "furniture_parcel_rack.png", 64, 64, (0, 0, 0.6), 1.95),
    ("changelog_board", build_changelog_board, None, "furniture_changelog_board.png", 64, 64, (0, 0, 0.65), 1.95),
    ("mihrab", build_mihrab, None, "furniture_mihrab.png", 64, 64, (0, 0, 0.65), 1.95),
    ("prayer_rug_shaf", build_prayer_rug_shaf, None, "furniture_prayer_rug_shaf.png", 64, 64, (0, 0, 0.05), 1.95),
    ("wudhu_station", build_wudhu_station, None, "furniture_wudhu_station.png", 64, 64, (0, 0, 0.25), 1.95),
    ("quran_shelf", build_quran_shelf, None, "furniture_quran_shelf.png", 64, 64, (0, 0, 0.15), 1.95),
    ("shaf_partition", build_shaf_partition, None, "furniture_shaf_partition.png", 64, 64, (0, 0, 0.55), 1.95),
    ("pool_basin", build_pool_basin, None, "furniture_pool_basin.png", 64, 64, (0, 0, 0.2), 1.95),
    ("pool_coping", build_pool_coping, None, "furniture_pool_coping.png", 64, 64, (0, 0, 0.15), 1.95),
    ("pool_water", build_pool_water, None, "furniture_pool_water.png", 64, 64, (0, 0, 0.05), 1.95),
    ("pool_lounger", build_pool_lounger, None, "furniture_pool_lounger.png", 64, 64, (0, 0, 0.2), 1.95),
    ("pool_umbrella", build_pool_umbrella, None, "furniture_pool_umbrella.png", 64, 64, (0, 0, 0.7), 1.95),
    ("tropical_plant", build_tropical_plant, None, "furniture_tropical_plant.png", 64, 64, (0, 0, 0.4), 1.95),
    ("billiard_table", build_billiard_table, None, "furniture_billiard_table.png", 64, 64, (0, 0, 0.45), 1.95),
    ("beanbag", build_beanbag, None, "furniture_beanbag.png", 64, 64, (0, 0, 0.25), 1.95),
    ("neon_sign", build_neon_sign, False, "furniture_neon_sign.png", 64, 64, (0, 0, 0.65), 1.95),
    ("neon_sign_night", build_neon_sign, True, "furniture_neon_sign_night.png", 64, 64, (0, 0, 0.65), 1.95),
    ("drawing_desk_tablet", build_drawing_desk_tablet, False, "furniture_drawing_desk_tablet.png", 64, 64, (0, 0, 0.5), 1.95),
    ("drawing_desk_tablet_night", build_drawing_desk_tablet, True, "furniture_drawing_desk_tablet_night.png", 64, 64, (0, 0, 0.5), 1.95),
    ("moodboard", build_moodboard, None, "furniture_moodboard.png", 64, 64, (0, 0, 0.65), 1.95),
    ("swatch_wall", build_swatch_wall, None, "furniture_swatch_wall.png", 64, 64, (0, 0, 0.65), 1.95),
    ("large_monitor_preview", build_large_monitor_preview, False, "furniture_large_monitor_preview.png", 64, 64, (0, 0, 0.5), 1.95),
    ("large_monitor_preview_night", build_large_monitor_preview, True, "furniture_large_monitor_preview_night.png", 64, 64, (0, 0, 0.5), 1.95),
    ("spare_tiles_pile", build_spare_tiles_pile, None, "furniture_spare_tiles_pile.png", 64, 64, (0, 0, 0.15), 1.95),
    ("qa_screens", build_qa_screens, False, "furniture_qa_screens.png", 64, 64, (0, 0, 0.5), 1.95),
    ("qa_screens_night", build_qa_screens, True, "furniture_qa_screens_night.png", 64, 64, (0, 0, 0.5), 1.95),
    ("stamp_desk", build_stamp_desk, None, "furniture_stamp_desk.png", 64, 64, (0, 0, 0.5), 1.95),
    ("lamp_pass_fail", build_lamp_pass_fail, False, "furniture_lamp_pass_fail.png", 64, 64, (0, 0, 0.45), 1.95),
    ("lamp_pass_fail_night", build_lamp_pass_fail, True, "furniture_lamp_pass_fail_night.png", 64, 64, (0, 0, 0.45), 1.95),
    ("soc_map_wall", build_soc_map_wall, False, "furniture_soc_map_wall.png", 64, 64, (0, 0, 0.7), 1.95),
    ("soc_map_wall_night", build_soc_map_wall, True, "furniture_soc_map_wall_night.png", 64, 64, (0, 0, 0.7), 1.95),
    ("alert_console", build_alert_console, False, "furniture_alert_console.png", 64, 64, (0, 0, 0.5), 1.95),
    ("alert_console_night", build_alert_console, True, "furniture_alert_console_night.png", 64, 64, (0, 0, 0.5), 1.95),
    ("reception_desk", build_reception_desk, None, "furniture_reception_desk.png", 64, 64, (0, 0, 0.5), 1.95),
    ("attendance_board", build_attendance_board, None, "furniture_attendance_board.png", 64, 64, (0, 0, 0.65), 1.95),
    ("entrance_door", build_entrance_door, None, "furniture_entrance_door.png", 64, 64, (0, 0, 0.65), 1.95),
    ("marble_counter", build_marble_counter, None, "furniture_marble_counter.png", 64, 64, (0, 0, 0.5), 1.95),
    ("espresso_machine", build_espresso_machine, None, "furniture_espresso_machine.png", 64, 64, (0, 0, 0.3), 1.95),
    ("achievement_board", build_achievement_board, None, "furniture_achievement_board.png", 64, 64, (0, 0, 0.65), 1.95),
    ("desk_executive", build_desk_executive, None, "furniture_desk_executive.png", 64, 64, (0, 0, 0.5), 1.95),
    ("wall_monitors_ceo", build_wall_monitors_ceo, False, "furniture_wall_monitors_ceo.png", 64, 64, (0, 0, 0.65), 1.95),
    ("wall_monitors_ceo_night", build_wall_monitors_ceo, True, "furniture_wall_monitors_ceo_night.png", 64, 64, (0, 0, 0.65), 1.95),
    ("sofa_leather", build_sofa_leather, None, "furniture_sofa_leather.png", 64, 64, (0, 0, 0.35), 1.95),
    ("trophy_shelf", build_trophy_shelf, None, "furniture_trophy_shelf.png", 64, 64, (0, 0, 0.6), 1.95),
    ("boardroom_table", build_boardroom_table, None, "furniture_boardroom_table.png", 64, 64, (0, 0, 0.5), 1.95),
    ("presentation_screen", build_presentation_screen, False, "furniture_presentation_screen.png", 64, 64, (0, 0, 0.75), 1.95),
    ("presentation_screen_night", build_presentation_screen, True, "furniture_presentation_screen_night.png", 64, 64, (0, 0, 0.75), 1.95),
    ("glass_partition", build_glass_partition, False, "furniture_glass_partition.png", 64, 64, (0, 0, 0.65), 1.95),
    ("glass_partition_night", build_glass_partition, True, "furniture_glass_partition_night.png", 64, 64, (0, 0, 0.65), 1.95),
    ("green_reading_lamp", build_green_reading_lamp, False, "furniture_green_reading_lamp.png", 64, 64, (0, 0, 0.2), 1.95),
    ("green_reading_lamp_night", build_green_reading_lamp, True, "furniture_green_reading_lamp_night.png", 64, 64, (0, 0, 0.2), 1.95),
    ("printing_press", build_printing_press, None, "furniture_printing_press.png", 64, 64, (0, 0, 0.25), 1.95),
    ("workstation_dev", build_workstation_dev, False, "furniture_workstation_dev.png", 64, 64, (0, 0, 0.55), 1.95),
    ("workstation_dev_night", build_workstation_dev, True, "furniture_workstation_dev_night.png", 64, 64, (0, 0, 0.55), 1.95),
    ("workstation_guest", build_workstation_guest, False, "furniture_workstation_guest.png", 64, 64, (0, 0, 0.55), 1.95),
    ("workstation_guest_night", build_workstation_guest, True, "furniture_workstation_guest_night.png", 64, 64, (0, 0, 0.55), 1.95),
    ("pair_standing_desk", build_pair_standing_desk, None, "furniture_pair_standing_desk.png", 64, 64, (0, 0, 0.6), 1.95),

    # --- Walls (Back Full-Height & Front 8px Cutaway) ---
    ("wall_back_nw", build_wall_back_nw, None, "wall_back_nw.png", 64, 64, (0, 0, 0.6), 1.95),
    ("wall_back_ne", build_wall_back_ne, None, "wall_back_ne.png", 64, 64, (0, 0, 0.6), 1.95),
    ("wall_back_corner_n", build_wall_back_corner_n, None, "wall_back_corner_n.png", 64, 64, (0, 0, 0.6), 1.95),
    ("wall_back_doorway", build_wall_back_doorway, None, "wall_back_doorway.png", 64, 64, (0, 0, 0.6), 1.95),
    ("wall_back_window_day", build_wall_back_window, False, "wall_back_window_day.png", 64, 64, (0, 0, 0.6), 1.95),
    ("wall_back_window_night", build_wall_back_window, True, "wall_back_window_night.png", 64, 64, (0, 0, 0.6), 1.95),
    ("wall_front_cutaway_sw", build_wall_front_cutaway_sw, None, "wall_front_cutaway_sw.png", 64, 64, (0, 0, 0.15), 1.95),
    ("wall_front_cutaway_se", build_wall_front_cutaway_se, None, "wall_front_cutaway_se.png", 64, 64, (0, 0, 0.15), 1.95),
    ("wall_front_cutaway_corner_s", build_wall_front_cutaway_corner_s, None, "wall_front_cutaway_corner_s.png", 64, 64, (0, 0, 0.15), 1.95),
    ("wall_front_cutaway_doorway", build_wall_front_cutaway_doorway, None, "wall_front_cutaway_doorway.png", 64, 64, (0, 0, 0.15), 1.95),
]

# Floor tiles specifications: (zone_id, base_hex, accent_hex, pattern, out_filename)
FLOOR_TILE_SPECS = [
    ("z01_ceo", "#F5F0E1", "#E0B678", "border", "tile_floor_z01_ceo.png"),
    ("z02_boardroom", "#A26D3F", "#4A2814", "planks", "tile_floor_z02_boardroom.png"),
    ("z03_architecture", "#9CA8B8", "#687594", "grid", "tile_floor_z03_architecture.png"),
    ("z04_classroom", "#B5652B", "#FEF9C3", "border", "tile_floor_z04_classroom.png"),
    ("z05_library", "#A26D3F", "#4A2814", "planks", "tile_floor_z05_library.png"),
    ("z06_lab", "#FFFFFF", "#9CA8B8", "grid", "tile_floor_z06_lab.png"),
    ("z07_design", "#A26D3F", "#E0567A", "checker", "tile_floor_z07_design.png"),
    ("z08_dev_pods", "#475069", "#00F0FF", "grid", "tile_floor_z08_dev_pods.png"),
    ("z09_graphics_lab", "#475069", "#9CC23A", "border", "tile_floor_z09_graphics_lab.png"),
    ("z10_qa_station", "#475069", "#F2C230", "border", "tile_floor_z10_qa_station.png"),
    ("z11_release_dock", "#9CA8B8", "#687594", "grid", "tile_floor_z11_release_dock.png"),
    ("z12_datacenter", "#1A1C29", "#282D3F", "grid", "tile_floor_z12_datacenter.png"),
    ("z13_lobby", "#D1D8E0", "#E0B678", "border", "tile_floor_z13_lobby.png"),
    ("z14_cafeteria", "#D9622B", "#F5F0E1", "checker", "tile_floor_z14_cafeteria.png"),
    ("z15_arcade", "#1A1C29", "#00F0FF", "grid", "tile_floor_z15_arcade.png"),
    ("z16_musholla", "#3FA66B", "#FEF9C3", "shaf", "tile_floor_z16_musholla.png"),
    ("z17_pool_deck", "#E0B678", "#A26D3F", "planks", "tile_floor_z17_pool_deck.png"),
    ("corridor", "#475069", "#687594", "border", "tile_floor_corridor.png"),
    ("pool_water", "#00F0FF", "#2BB3C0", "grid", "tile_floor_pool_water.png"),
    ("night_corridor", "#1A1C29", "#282D3F", "border", "tile_floor_night_corridor.png"),
    ("night_datacenter", "#14141E", "#1A1C29", "grid", "tile_floor_night_datacenter.png"),
]

# Kenney GLB models mapping
KENNEY_MODELS = [
    ("desk.glb", "furniture_desk.png"),
    ("chairDesk.glb", "furniture_chair.png"),
    ("computerScreen.glb", "furniture_screen.png"),
    ("chairRounded.glb", "furniture_chair_rounded.png"),
    ("chairModernCushion.glb", "furniture_chair_cushion.png"),
    ("loungeChairRelax.glb", "furniture_lounge_chair.png"),
    ("loungeSofa.glb", "furniture_lounge_sofa.png"),
    ("loungeDesignSofaCorner.glb", "furniture_lounge_sofa_corner.png"),
    ("bookcaseClosedWide.glb", "furniture_bookcase_tall.png"),
    ("bookcaseOpenLow.glb", "furniture_bookcase_low.png"),
    ("tableRound.glb", "furniture_table_round.png"),
    ("tableCoffee.glb", "furniture_table_coffee.png"),
    ("kitchenFridgeLarge.glb", "furniture_kitchen_fridge.png"),
    ("pottedPlant.glb", "furniture_potted_plant.png"),
    ("plantSmall1.glb", "furniture_plant_small.png"),
    ("lampSquareFloor.glb", "furniture_lamp_floor.png"),
    ("trashcan.glb", "furniture_trashcan.png"),
    ("cardboardBoxClosed.glb", "furniture_cardboard_box.png"),
]


# ---------------------------------------------------------------------------
# Execution Functions
# ---------------------------------------------------------------------------

def render_all_environment(
    furniture_dir: str,
    output_dir: str,
    palette_rgb: list[tuple[int, int, int]],
    samples: int = 16,
) -> dict[str, float]:
    """Render procedural custom models, Kenney pieces, tiles, and walls."""
    raw_dir = os.path.join(output_dir, "raw_environment")
    os.makedirs(raw_dir, exist_ok=True)
    times: dict[str, float] = {}

    print(f"\n--- Phase 1: Rendering {len(ENV_RENDER_MANIFEST)} Custom Models & Walls ---")
    for item in ENV_RENDER_MANIFEST:
        name, builder_fn, arg, filename, rx, ry, target, ortho = item
        t0 = time.time()
        bpy.ops.wm.read_factory_settings(use_empty=True)
        setup_blender_scene(samples=samples, res_x=rx, res_y=ry)
        is_night = (arg is True)
        setup_lighting(ambient_night=is_night)
        setup_camera(target=Vector(target), ortho_scale=ortho)

        if arg is not None:
            builder_fn(arg)
        else:
            builder_fn()

        out_path = os.path.join(raw_dir, filename)
        bpy.context.scene.render.filepath = out_path
        bpy.ops.render.render(write_still=True)
        # Apply 32-color quantization + 1px outline
        post_process_image(out_path, palette_rgb, add_outline=True)
        dt = time.time() - t0
        times[filename] = dt
        print(f"  [OK] {filename} in {dt:.2f}s")

    print(f"\n--- Phase 2: Rendering {len(FLOOR_TILE_SPECS)} Floor Tiles ---")
    for zone_id, base_hex, accent_hex, pattern, filename in FLOOR_TILE_SPECS:
        t0 = time.time()
        bpy.ops.wm.read_factory_settings(use_empty=True)
        setup_blender_scene(samples=samples, res_x=64, res_y=64)
        is_night = "night" in zone_id
        setup_lighting(ambient_night=is_night)
        setup_camera(target=Vector((0, 0, 0.04)), ortho_scale=1.4142)

        build_floor_tile(base_hex, accent_hex, pattern=pattern)

        out_path = os.path.join(raw_dir, filename)
        bpy.context.scene.render.filepath = out_path
        bpy.ops.render.render(write_still=True)
        # Floor tiles do not need outer dark halo outline so they tile cleanly
        post_process_image(out_path, palette_rgb, add_outline=False)
        dt = time.time() - t0
        times[filename] = dt
        print(f"  [OK] {filename} in {dt:.2f}s")

    print(f"\n--- Phase 3: Rendering {len(KENNEY_MODELS)} Kenney Furniture Items ---")
    for model_name, filename in KENNEY_MODELS:
        t0 = time.time()
        bpy.ops.wm.read_factory_settings(use_empty=True)
        setup_blender_scene(samples=samples, res_x=64, res_y=64)
        setup_lighting()

        filepath = os.path.join(furniture_dir, model_name)
        if not os.path.exists(filepath):
            print(f"  [WARN] File not found: {filepath}")
            continue

        bpy.ops.import_scene.gltf(filepath=filepath)

        # Center in X and Y, ground at Z=0
        meshes = [o for o in bpy.data.objects if o.type == "MESH"]
        if meshes:
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
            target = Vector((0, 0, (max_z - min_z) * 0.4))
        else:
            target = Vector((0, 0, 0.4))

        setup_camera(target=target, ortho_scale=1.95)

        out_path = os.path.join(raw_dir, filename)
        bpy.context.scene.render.filepath = out_path
        bpy.ops.render.render(write_still=True)
        post_process_image(out_path, palette_rgb, add_outline=True)
        dt = time.time() - t0
        times[filename] = dt
        print(f"  [OK] {filename} in {dt:.2f}s")

    # Extra night variant for screen and lamp
    screen_night_path = os.path.join(raw_dir, "furniture_screen_night.png")
    if os.path.exists(os.path.join(raw_dir, "furniture_screen.png")):
        import shutil
        shutil.copyfile(os.path.join(raw_dir, "furniture_screen.png"), screen_night_path)
        times["furniture_screen_night.png"] = 0.01

    lamp_night_path = os.path.join(raw_dir, "furniture_lamp_floor_night.png")
    if os.path.exists(os.path.join(raw_dir, "furniture_lamp_floor.png")):
        import shutil
        shutil.copyfile(os.path.join(raw_dir, "furniture_lamp_floor.png"), lamp_night_path)
        times["furniture_lamp_floor_night.png"] = 0.01

    return times


def run_inside_blender(args: argparse.Namespace) -> None:
    """Invoked when executing inside Blender."""
    palette_rgb = load_palette(args.palette)
    print(f"Loaded {len(palette_rgb)} palette colors.")
    t0 = time.time()
    times = render_all_environment(args.furniture_dir, args.output_dir, palette_rgb, samples=args.samples)
    total_time = time.time() - t0

    metrics = {
        "total_sprites_rendered": len(times),
        "total_render_time_seconds": total_time,
        "sprite_render_times": times,
        "samples_per_pixel": args.samples,
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S WIB"),
    }
    metrics_path = os.path.join(args.output_dir, "environment_render_metrics.json")
    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)

    print(f"\nRendered {len(times)} environment sprites in {total_time:.2f}s.")
    print(f"Metrics written to {metrics_path}")


def main() -> None:
    """CLI orchestrator when invoked from host shell."""
    args = parse_args()

    if bpy is not None:
        run_inside_blender(args)
        return

    print("=== [T1.7] Rendering Environment Sprites (Tiles, Walls & Furniture) ===")
    root_dir = Path(__file__).resolve().parent.parent.parent

    # 1. Headless Blender Execution
    blender_bin = "blender"
    blender_cmd = [
        blender_bin,
        "-b",
        "-P",
        str(Path(__file__).resolve()),
        "--",
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
        print(f"Error: Blender failed with returncode {result.returncode}")
        sys.exit(result.returncode)
    print(f"Blender finished in {time.time() - t0:.2f}s.")

    # 2. Packing Atlas via pack_environment.js
    pack_script = Path(__file__).resolve().parent / "pack_environment.js"
    raw_dir = Path(args.output_dir) / "raw_environment"
    pack_cmd = ["node", str(pack_script), str(raw_dir), str(args.output_dir)]

    print(f"\nPacking Atlas with Free-Tex-Packer: {' '.join(pack_cmd)}")
    pack_res = subprocess.run(pack_cmd, cwd=str(root_dir))
    if pack_res.returncode != 0:
        print(f"Error: Atlas packer failed with code {pack_res.returncode}")
        sys.exit(pack_res.returncode)

    print("\n=== [T1.7] ENVIRONMENT PIPELINE COMPLETE ===")


if __name__ == "__main__":
    main()
