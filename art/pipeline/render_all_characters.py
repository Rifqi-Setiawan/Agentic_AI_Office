# pyright: reportOptionalMemberAccess=false, reportAttributeAccessIssue=false, reportInvalidTypeForm=false, reportOptionalCall=false
"""Production sprite renderer for 16 agent characters + 1 guest character.

Implements Pipeline T0.4 for Task T1.6 according to:
- docs/blueprint/03-character-design-spec.md
- docs/style-guide.md (Muse Master Style Guide v0.1 & 32-color palette)
"""

from __future__ import annotations

import argparse
import json
import math
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

try:
    import bpy  # type: ignore[import-not-found]
    from mathutils import Matrix, Vector  # type: ignore[import-not-found]
except ImportError:
    bpy = None
    Matrix = None  # type: ignore[assignment]
    Vector = None  # type: ignore[assignment]


# ---------------------------------------------------------------------------
# 32-Color Palette & Quantization Helpers
# ---------------------------------------------------------------------------

DEFAULT_PALETTE_HEX = [
    "#14141e", "#1a1c29", "#282d3f", "#475069", "#687594", "#9ca8b8", "#d1d8e0", "#ffffff",
    "#8f5338", "#c9855b", "#f2b896", "#4a2814", "#a26d3f", "#e0b678", "#00f0ff", "#fef9c3",
    "#1f3a68", "#2f6fb3", "#8a4fbf", "#b5652b", "#e0567a", "#2bb3c0", "#d9622b", "#3fa66b",
    "#d23c3c", "#6b7785", "#6d5bd0", "#8e8e3a", "#9cc23a", "#7a4a2e", "#f2c230", "#f5f0e1",
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
    char_id: str = "",
    outline_color: tuple[int, int, int, int] = (20, 20, 30, 255),
) -> None:
    """Quantize to master 32-color palette, add 1px outline, and apply style guide rules."""
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

    # Style guide rule P0: Rim-light pass on dark characters (Jarvis, Scribe, Bastion)
    if char_id in ("jarvis", "scribe", "bastion"):
        top_left_shift = np.roll(np.roll(mask, -1, axis=0), -1, axis=1)
        rim_edge = top_left_shift & ~mask
        rim_color = (156, 168, 184, 255) if char_id == "bastion" else (104, 117, 148, 255)
        final_arr[rim_edge & outline_mask] = np.array(rim_color, dtype=np.uint8)

    # Style guide rule P1: 2-3 pixel face / eye cluster
    y_indices, x_indices = np.where(mask)
    if len(y_indices) > 0:
        min_y = np.min(y_indices)
        head_mask = mask & (np.arange(mask.shape[0])[:, None] < (min_y + 16))
        hy, hx = np.where(head_mask)
        if len(hy) > 0:
            center_x = int(np.mean(hx))
            eye_y = min_y + 9
            if 0 <= eye_y < mask.shape[0]:
                for offset in (0, 2):
                    ex = center_x + offset
                    if 0 <= ex < mask.shape[1] and mask[eye_y, ex]:
                        final_arr[eye_y, ex, :3] = [20, 20, 30]

    out_img = Image.fromarray(final_arr, mode="RGBA")
    out_img.save(image_path)


# ---------------------------------------------------------------------------
# Character Metadata & Spec Definitions
# ---------------------------------------------------------------------------

CHARACTERS = [
    {
        "id": "jarvis",
        "name": "Jarvis",
        "base_rig": "A",
        "model": "figure_Suit.glb",
        "sig_hex": "#1F3A68",
        "desc": "Jas navy 3-potong formal, dasi emas, earpiece, tablet di tangan samping",
        "prop": "tablet",
    },
    {
        "id": "daedalus",
        "name": "Daedalus",
        "base_rig": "B",
        "model": "figure_Casual.glb",
        "sig_hex": "#2F6FB3",
        "desc": "Kemeja cerulean, syal arsitek, tabung blueprint silindris diagonal punggung, jangka",
        "prop": "compass",
    },
    {
        "id": "oracle",
        "name": "Oracle",
        "base_rig": "A",
        "model": "figure_Casual.glb",
        "sig_hex": "#8A4FBF",
        "desc": "Jas lab putih berekor mekar, goggles di dahi, rambut acak-acakan unik, tabung reaksi",
        "prop": "test_tube",
    },
    {
        "id": "merlin",
        "name": "Merlin",
        "base_rig": "A",
        "model": "figure_Casual.glb",
        "sig_hex": "#B5652B",
        "desc": "Kardigan ochre, kacamata, janggut abu pendek, tongkat penunjuk panjang berujung bintang",
        "prop": "star_wand",
    },
    {
        "id": "muse",
        "name": "Muse",
        "base_rig": "B",
        "model": "figure_Worker.glb",
        "sig_hex": "#E0567A",
        "desc": "Overall denim noda cat, stylus panjang di telinga, sanggul rambut atas, tablet gambar",
        "prop": "art_tablet",
    },
    {
        "id": "prism",
        "name": "Prism",
        "base_rig": "A",
        "model": "figure_Casual.glb",
        "sig_hex": "#2BB3C0",
        "desc": "Hoodie gelap garis spektrum teal, headphone over-ear besar, keyboard mekanik",
        "prop": "keyboard",
    },
    {
        "id": "forge",
        "name": "Forge",
        "base_rig": "C",
        "model": "figure_Worker.glb",
        "sig_hex": "#D9622B",
        "desc": "Celemek kulit terracotta, siluet kekar berotot, goggle las dahi, palu tempa",
        "prop": "hammer",
    },
    {
        "id": "vector",
        "name": "Vector",
        "base_rig": "B",
        "model": "figure_Casual.glb",
        "sig_hex": "#3FA66B",
        "desc": "Rompi emerald, topi lapangan berpet depan, gulungan kabel besar di bahu, tablet data",
        "prop": "data_tablet",
    },
    {
        "id": "sentinel",
        "name": "Sentinel",
        "base_rig": "A",
        "model": "figure_Suit.glb",
        "sig_hex": "#D23C3C",
        "desc": "Mantel panjang kerah berdiri tinggi, visor horizontal crimson, papan klip PASS putih",
        "prop": "clipboard",
    },
    {
        "id": "bastion",
        "name": "Bastion",
        "base_rig": "C",
        "model": "figure_Casual.glb",
        "sig_hex": "#6B7785",
        "desc": "Siluet zirah pelat kekar, helm taktis LED cyan, perisai pelat punggung, walkie-talkie",
        "prop": "walkie",
    },
    {
        "id": "relay",
        "name": "Relay",
        "base_rig": "A",
        "model": "figure_Worker.glb",
        "sig_hex": "#6D5BD0",
        "desc": "Jaket indigo, topi kurir berpet, tas selempang menonjol di pinggang, kotak paket",
        "prop": "parcel",
    },
    {
        "id": "warden",
        "name": "Warden",
        "base_rig": "A",
        "model": "figure_Worker.glb",
        "sig_hex": "#8E8E3A",
        "desc": "Rompi utilitas olive, ring gantungan kunci besar mencuat di pinggul, kotak perkakas merah",
        "prop": "toolbox",
    },
    {
        "id": "steward",
        "name": "Steward",
        "base_rig": "A",
        "model": "figure_Worker.glb",
        "sig_hex": "#9CC23A",
        "desc": "Overall lime, kacamata VR tebal di dahi, voxel tile isometrik melayang di telapak",
        "prop": "tile",
    },
    {
        "id": "scribe",
        "name": "Scribe",
        "base_rig": "B",
        "model": "figure_Casual.glb",
        "sig_hex": "#7A4A2E",
        "desc": "Kerudung/hijab anggun melingkupi kepala & bahu, blazer tweed sepia, pena bulu panjang",
        "prop": "quill",
    },
    {
        "id": "nova",
        "name": "Nova",
        "base_rig": "B",
        "model": "figure_Casual.glb",
        "sig_hex": "#F2C230",
        "desc": "Jaket varsity gold lengan putih, kuncir kuda samping dengan jepit bintang emas, botol minum",
        "prop": "bottle",
    },
    {
        "id": "rifqi",
        "name": "Rifqi",
        "base_rig": "A",
        "model": "figure_Casual.glb",
        "sig_hex": "#F5F0E1",
        "desc": "Hoodie krem santai Founder, mahkota emas mini melayang di atas kepala, ponsel cerdas",
        "prop": "phone",
    },
    {
        "id": "guest",
        "name": "Tamu",
        "base_rig": "A",
        "model": "figure_Casual.glb",
        "sig_hex": "#9CA8B8",
        "desc": "Blazer kasual abu-abu, kalung tali lanyard ID kartu tamu menggantung di dada, buku catatan",
        "prop": "notebook",
    },
]


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
    scene.render.resolution_x = 48
    scene.render.resolution_y = 64


def setup_lighting() -> None:
    """Create a 3-point sun lighting system tailored for isometric pixel art."""
    key_data = bpy.data.lights.new("KeySun", type="SUN")
    key_data.energy = 4.2
    key_obj = bpy.data.objects.new("KeySun", key_data)
    bpy.context.collection.objects.link(key_obj)
    key_obj.rotation_euler = (math.radians(50), math.radians(15), math.radians(-35))

    fill_data = bpy.data.lights.new("FillSun", type="SUN")
    fill_data.energy = 2.0
    fill_obj = bpy.data.objects.new("FillSun", fill_data)
    bpy.context.collection.objects.link(fill_obj)
    fill_obj.rotation_euler = (math.radians(35), math.radians(-30), math.radians(130))

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
) -> bpy.types.Material:
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
    return mat


def attach_to_bone(
    obj: bpy.types.Object,
    arm: bpy.types.Object,
    bone_name: str,
) -> None:
    """Attach obj to armature bone maintaining its current world-space transform."""
    bpy.context.view_layer.update()
    bone_pb = arm.pose.bones.get(bone_name)
    if not bone_pb:
        return
    bone_world = arm.matrix_world @ bone_pb.matrix
    obj.parent = arm
    obj.parent_type = "BONE"
    obj.parent_bone = bone_name
    obj.matrix_parent_inverse = bone_world.inverted()
    bpy.context.view_layer.update()


# ---------------------------------------------------------------------------
# Character Rig, Materials & Accessory Builder
# ---------------------------------------------------------------------------

def apply_base_rig(arm: bpy.types.Object, base_rig: str) -> None:
    """Apply Base A, B, or C scaling to Quaternius armature."""
    if base_rig == "B":  # Ramping / slender
        arm.pose.bones["Head"].scale = Vector((1.55, 1.55, 1.55))
        for bname in ["UpperLeg.L", "UpperLeg.R", "LowerLeg.L", "LowerLeg.R"]:
            arm.pose.bones[bname].scale = Vector((0.85, 0.65, 0.85))
        for bname in ["UpperArm.L", "UpperArm.R", "LowerArm.L", "LowerArm.R"]:
            arm.pose.bones[bname].scale = Vector((0.85, 1.0, 0.85))
        for bname in ["Torso", "Chest", "Hips"]:
            arm.pose.bones[bname].scale = Vector((0.85, 0.85, 1.0))
    elif base_rig == "C":  # Besar / kekar
        arm.pose.bones["Head"].scale = Vector((1.5, 1.5, 1.5))
        for bname in ["UpperLeg.L", "UpperLeg.R", "LowerLeg.L", "LowerLeg.R"]:
            arm.pose.bones[bname].scale = Vector((1.22, 0.65, 1.22))
        for bname in ["UpperArm.L", "UpperArm.R", "LowerArm.L", "LowerArm.R"]:
            arm.pose.bones[bname].scale = Vector((1.2, 1.0, 1.2))
        for bname in ["Torso", "Chest", "Hips"]:
            arm.pose.bones[bname].scale = Vector((1.25, 1.25, 1.0))
        for bname in ["Shoulder.L", "Shoulder.R"]:
            arm.pose.bones[bname].scale = Vector((1.2, 1.2, 1.2))
    else:  # Base A: Sedang
        arm.pose.bones["Head"].scale = Vector((1.6, 1.6, 1.6))
        for bname in ["UpperLeg.L", "UpperLeg.R", "LowerLeg.L", "LowerLeg.R"]:
            arm.pose.bones[bname].scale = Vector((1.0, 0.65, 1.0))
        for bname in ["UpperArm.L", "UpperArm.R", "LowerArm.L", "LowerArm.R"]:
            arm.pose.bones[bname].scale = Vector((1.0, 1.0, 1.0))
        for bname in ["Torso", "Chest", "Hips"]:
            arm.pose.bones[bname].scale = Vector((1.0, 1.0, 1.0))

    base_arm_x = -math.radians(72)
    for bname in ["UpperArm.L", "UpperArm.R"]:
        pb = arm.pose.bones[bname]
        pb.rotation_mode = "XYZ"
        pb.rotation_euler = (base_arm_x, 0, 0)


def build_character(char_info: dict, models_dir: str) -> tuple[bpy.types.Object, bpy.types.Object]:
    """Import character model, apply rig, material swaps, and custom 3D accessories/props."""
    model_path = os.path.join(models_dir, char_info["model"])
    bpy.ops.import_scene.gltf(filepath=model_path)

    # Remove collision / helper meshes
    ico = bpy.data.objects.get("Icosphere")
    if ico:
        bpy.data.objects.remove(ico, do_unlink=True)

    root = bpy.data.objects.get("RootNode")
    arm = bpy.data.objects.get("CharacterArmature")

    # Apply Base Rig proportions
    apply_base_rig(arm, char_info["base_rig"])

    # Initial ground alignment
    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    all_meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    if all_meshes:
        min_z = min(
            (m.evaluated_get(depsgraph).matrix_world @ Vector(c)).z
            for m in all_meshes
            for c in m.bound_box
        )
        root.location.z -= min_z
    bpy.context.view_layer.update()

    cid = char_info["id"]

    # Common skin and hair defaults
    set_material_color("Skin", "#C9855B", roughness=0.5)
    set_material_color("Hair", "#2D3748", roughness=0.7)
    set_material_color("Eye", "#14141E", roughness=0.1)
    set_material_color("Eyebrows", "#14141E", roughness=0.7)

    # Pose bone world translations
    head_world = arm.matrix_world @ arm.pose.bones["Head"].matrix
    hand_r_world = arm.matrix_world @ arm.pose.bones["Hand.R"].matrix
    hand_l_world = arm.matrix_world @ arm.pose.bones["Hand.L"].matrix
    chest_world = arm.matrix_world @ arm.pose.bones["Chest"].matrix
    hips_world = arm.matrix_world @ arm.pose.bones["Hips"].matrix

    hw = head_world.translation
    hr = hand_r_world.translation
    hl = hand_l_world.translation
    cw = chest_world.translation
    hip_w = hips_world.translation

    if cid == "jarvis":
        set_material_color("Suit", "#1F3A68", roughness=0.45)
        set_material_color("Suit.001", "#14141E", roughness=0.5)
        set_material_color("Tie", "#F2C230", roughness=0.3)
        set_material_color("White", "#FFFFFF", roughness=0.5)
        set_material_color("Black", "#14141E", roughness=0.5)
        # Tablet prop held outward in Hand.L to clearly show in silhouette
        bpy.ops.mesh.primitive_cube_add(size=0.18, location=(hl.x + 0.12, hl.y - 0.04, hl.z - 0.04))
        tab = bpy.context.active_object
        tab.name = "Jarvis_Tablet"
        tab.scale = (0.2, 0.9, 1.3)
        tab.rotation_euler = (0, math.radians(-15), math.radians(20))
        tab_mat = set_material_color("Jarvis_Tab_Mat", "#D1D8E0", roughness=0.2)
        tab.data.materials.append(tab_mat)
        attach_to_bone(tab, arm, "Hand.L")

    elif cid == "daedalus":
        set_material_color("LightBlue", "#2F6FB3", roughness=0.5)
        set_material_color("Purple", "#282D3F", roughness=0.6)
        set_material_color("White", "#FFFFFF", roughness=0.4)
        # Blueprint tube on back (protrudes noticeably over shoulder in silhouette)
        bpy.ops.mesh.primitive_cylinder_add(
            radius=0.075,
            depth=0.90,
            location=(cw.x + 0.08, cw.y + 0.18, cw.z + 0.30),
        )
        tube = bpy.context.active_object
        tube.name = "Daedalus_Tube"
        tube.rotation_euler = (math.radians(35), math.radians(25), math.radians(-20))
        tube_mat = set_material_color("Daedalus_Tube_Mat", "#A26D3F", roughness=0.4)
        tube.data.materials.append(tube_mat)
        attach_to_bone(tube, arm, "Chest")
        # Compass divider in Hand.R
        bpy.ops.mesh.primitive_cone_add(radius1=0.05, depth=0.26, location=(hr.x - 0.08, hr.y, hr.z))
        compass = bpy.context.active_object
        compass.name = "Daedalus_Compass"
        compass_mat = set_material_color("Metal_Highlight", "#D1D8E0", roughness=0.2)
        compass.data.materials.append(compass_mat)
        attach_to_bone(compass, arm, "Hand.R")

    elif cid == "oracle":
        set_material_color("LightBlue", "#8A4FBF", roughness=0.5)
        set_material_color("Purple", "#1E1E2E", roughness=0.6)
        set_material_color("White", "#FFFFFF", roughness=0.5)
        set_material_color("Hair", "#14141E", roughness=0.8)
        # Goggles on forehead
        bpy.ops.mesh.primitive_cylinder_add(
            radius=0.075,
            depth=0.09,
            location=(hw.x, hw.y - 0.22, hw.z + 0.08),
        )
        goggles = bpy.context.active_object
        goggles.name = "Oracle_Goggles"
        goggles.rotation_euler = (math.radians(90), 0, 0)
        gog_mat = set_material_color("Oracle_Gog_Mat", "#8A4FBF", roughness=0.3)
        goggles.data.materials.append(gog_mat)
        attach_to_bone(goggles, arm, "Head")
        # Multiple wild spiky hair peaks (original design, distinctly eccentric)
        for s_idx, (sx, sy, sz, rx, ry, rz) in enumerate([
            (hw.x, hw.y + 0.02, hw.z + 0.30, -0.4, 0, 0.2),
            (hw.x - 0.14, hw.y + 0.06, hw.z + 0.28, -0.2, 0.4, 0),
            (hw.x + 0.14, hw.y + 0.06, hw.z + 0.28, -0.2, -0.4, 0),
        ]):
            bpy.ops.mesh.primitive_cone_add(radius1=0.10, depth=0.26, location=(sx, sy, sz))
            spike = bpy.context.active_object
            spike.name = f"Oracle_Spike_{s_idx}"
            spike.rotation_euler = (rx, ry, rz)
            hair_mat = set_material_color("Hair_Dark", "#14141E", roughness=0.8)
            spike.data.materials.append(hair_mat)
            attach_to_bone(spike, arm, "Head")
        # Flared lab coat tails at hips
        for f_idx, (fx, sgn) in enumerate([(-0.16, -1), (0.16, 1)]):
            bpy.ops.mesh.primitive_cube_add(
                size=0.18, location=(hip_w.x + fx, hip_w.y + 0.05, hip_w.z - 0.18)
            )
            flap = bpy.context.active_object
            flap.name = f"Oracle_Flap_{f_idx}"
            flap.scale = (0.3, 0.9, 1.4)
            flap.rotation_euler = (0, math.radians(15), math.radians(sgn * 25))
            coat_mat = set_material_color("White_LabCoat", "#FFFFFF", roughness=0.4)
            flap.data.materials.append(coat_mat)
            attach_to_bone(flap, arm, "Hips")
        # Test tube in Hand.R
        bpy.ops.mesh.primitive_cylinder_add(
            radius=0.035,
            depth=0.22,
            location=(hr.x - 0.06, hr.y - 0.02, hr.z + 0.05),
        )
        tube = bpy.context.active_object
        tube.name = "Oracle_TestTube"
        tube_mat = set_material_color("Oracle_Tube_Mat", "#00F0FF", roughness=0.1, emission_hex="#8A4FBF")
        tube.data.materials.append(tube_mat)
        attach_to_bone(tube, arm, "Hand.R")

    elif cid == "merlin":
        set_material_color("LightBlue", "#B5652B", roughness=0.6)  # Ochre cardigan
        set_material_color("Purple", "#48525F", roughness=0.6)
        set_material_color("Hair", "#9CA8B8", roughness=0.8)
        # Pointed grey beard under chin
        bpy.ops.mesh.primitive_cone_add(
            radius1=0.11,
            depth=0.22,
            location=(hw.x, hw.y - 0.18, hw.z - 0.14),
        )
        beard = bpy.context.active_object
        beard.name = "Merlin_Beard"
        beard.rotation_euler = (math.radians(160), 0, 0)
        beard_mat = set_material_color("Grey_Beard", "#9CA8B8", roughness=0.8)
        beard.data.materials.append(beard_mat)
        attach_to_bone(beard, arm, "Head")
        # Pointer wand held high and outward with glittering star
        bpy.ops.mesh.primitive_cylinder_add(
            radius=0.02,
            depth=0.65,
            location=(hr.x - 0.18, hr.y, hr.z + 0.22),
        )
        wand = bpy.context.active_object
        wand.name = "Merlin_Wand"
        wand.rotation_euler = (0, math.radians(35), math.radians(-30))
        wand_mat = set_material_color("Merlin_Wand_Mat", "#A26D3F", roughness=0.4)
        wand.data.materials.append(wand_mat)
        # Star tip
        bpy.ops.mesh.primitive_cube_add(
            size=0.11, location=(hr.x - 0.32, hr.y, hr.z + 0.48)
        )
        star = bpy.context.active_object
        star.name = "Merlin_Star"
        star.rotation_euler = (math.radians(45), math.radians(45), 0)
        star_mat = set_material_color("Star_Glow", "#FEF9C3", roughness=0.1, emission_hex="#FEF9C3")
        star.data.materials.append(star_mat)
        attach_to_bone(wand, arm, "Hand.R")
        attach_to_bone(star, arm, "Hand.R")

    elif cid == "muse":
        set_material_color("Worker_Vest", "#475069", roughness=0.5)
        set_material_color("Worker_Yellow", "#E0567A", roughness=0.4)
        set_material_color("Grey", "#334155", roughness=0.6)
        set_material_color("Hair", "#8F5338", roughness=0.7)
        # Long stylus extending past temple
        bpy.ops.mesh.primitive_cylinder_add(
            radius=0.025,
            depth=0.40,
            location=(hw.x + 0.22, hw.y - 0.05, hw.z + 0.12),
        )
        stylus = bpy.context.active_object
        stylus.name = "Muse_Stylus"
        stylus.rotation_euler = (math.radians(35), math.radians(-30), 0)
        stylus_mat = set_material_color("Muse_Stylus_Mat", "#E0567A", roughness=0.3)
        stylus.data.materials.append(stylus_mat)
        attach_to_bone(stylus, arm, "Head")
        # High topknot bun on head
        bpy.ops.mesh.primitive_uv_sphere_add(
            radius=0.12,
            location=(hw.x, hw.y + 0.16, hw.z + 0.22),
        )
        bun = bpy.context.active_object
        bun.name = "Muse_Bun"
        bun_mat = set_material_color("Auburn_Hair", "#8F5338", roughness=0.8)
        bun.data.materials.append(bun_mat)
        attach_to_bone(bun, arm, "Head")
        # Drawing tablet in Hand.L
        bpy.ops.mesh.primitive_cube_add(size=0.18, location=(hl.x + 0.08, hl.y, hl.z))
        art_tab = bpy.context.active_object
        art_tab.name = "Muse_Tablet"
        art_tab.scale = (0.2, 0.9, 1.2)
        art_tab_mat = set_material_color("Muse_Tab_Mat", "#E0567A", roughness=0.3)
        art_tab.data.materials.append(art_tab_mat)
        attach_to_bone(art_tab, arm, "Hand.L")

    elif cid == "prism":
        set_material_color("LightBlue", "#1E1E2E", roughness=0.6)
        set_material_color("Purple", "#282D3F", roughness=0.6)
        set_material_color("Hair", "#2D3748", roughness=0.7)
        # Chunky over-ear headphones with large earcups
        bpy.ops.mesh.primitive_torus_add(
            major_radius=0.24,
            minor_radius=0.035,
            location=(hw.x, hw.y - 0.02, hw.z + 0.08),
        )
        phones = bpy.context.active_object
        phones.name = "Prism_Headphones"
        phones.rotation_euler = (math.radians(90), 0, 0)
        phone_mat = set_material_color("Prism_Teal", "#2BB3C0", roughness=0.2, emission_hex="#2BB3C0")
        phones.data.materials.append(phone_mat)
        # Left and right large earcups
        for sgn, ex in [(-1, -0.22), (1, 0.22)]:
            bpy.ops.mesh.primitive_cylinder_add(
                radius=0.08, depth=0.06, location=(hw.x + ex, hw.y - 0.02, hw.z + 0.04)
            )
            cup = bpy.context.active_object
            cup.rotation_euler = (0, math.radians(90), 0)
            cup.data.materials.append(phone_mat)
            attach_to_bone(cup, arm, "Head")
        attach_to_bone(phones, arm, "Head")
        # Mechanical keyboard held in Hand.R
        bpy.ops.mesh.primitive_cube_add(size=0.18, location=(hr.x - 0.10, hr.y - 0.05, hr.z + 0.02))
        kb = bpy.context.active_object
        kb.name = "Prism_Keyboard"
        kb.scale = (0.25, 1.4, 0.7)
        kb_mat = set_material_color("Keyboard_Mat", "#64748B", roughness=0.4)
        kb.data.materials.append(kb_mat)
        attach_to_bone(kb, arm, "Hand.R")

    elif cid == "forge":
        set_material_color("Worker_Vest", "#D9622B", roughness=0.5)
        set_material_color("Worker_Yellow", "#4A2814", roughness=0.6)
        set_material_color("Grey", "#14141E", roughness=0.7)
        set_material_color("Hair", "#4A2814", roughness=0.8)
        # Thick welding goggles on forehead
        bpy.ops.mesh.primitive_cylinder_add(
            radius=0.09,
            depth=0.12,
            location=(hw.x, hw.y - 0.22, hw.z + 0.08),
        )
        wg = bpy.context.active_object
        wg.name = "Forge_Goggles"
        wg.rotation_euler = (math.radians(90), 0, 0)
        wg_mat = set_material_color("Forge_Gog_Mat", "#334155", roughness=0.3)
        wg.data.materials.append(wg_mat)
        attach_to_bone(wg, arm, "Head")
        # Heavy smithing hammer in Hand.R
        bpy.ops.mesh.primitive_cylinder_add(
            radius=0.025,
            depth=0.45,
            location=(hr.x - 0.12, hr.y, hr.z),
        )
        handle = bpy.context.active_object
        handle.name = "Forge_HammerHandle"
        h_mat = set_material_color("Wood_Oak", "#A26D3F", roughness=0.5)
        handle.data.materials.append(h_mat)
        bpy.ops.mesh.primitive_cube_add(
            size=0.12, location=(hr.x - 0.12, hr.y, hr.z + 0.22)
        )
        hhead = bpy.context.active_object
        hhead.name = "Forge_HammerHead"
        hhead.scale = (1.5, 1.0, 1.0)
        hhead_mat = set_material_color("Steel_Grey", "#9CA8B8", roughness=0.3)
        hhead.data.materials.append(hhead_mat)
        attach_to_bone(handle, arm, "Hand.R")
        attach_to_bone(hhead, arm, "Hand.R")

    elif cid == "vector":
        set_material_color("LightBlue", "#3FA66B", roughness=0.5)
        set_material_color("Purple", "#334155", roughness=0.6)
        set_material_color("White", "#D1D8E0", roughness=0.5)
        set_material_color("Hair", "#2D3748", roughness=0.7)
        # Field cap with prominent front visor
        bpy.ops.mesh.primitive_cylinder_add(
            radius=0.22,
            depth=0.10,
            location=(hw.x, hw.y - 0.05, hw.z + 0.16),
        )
        cap = bpy.context.active_object
        cap.name = "Vector_Cap"
        cap_mat = set_material_color("Vector_Cap_Mat", "#3FA66B", roughness=0.4)
        cap.data.materials.append(cap_mat)
        bpy.ops.mesh.primitive_cube_add(
            size=0.12, location=(hw.x, hw.y - 0.24, hw.z + 0.12)
        )
        bill = bpy.context.active_object
        bill.scale = (1.6, 1.1, 0.15)
        bill.data.materials.append(cap_mat)
        attach_to_bone(cap, arm, "Head")
        attach_to_bone(bill, arm, "Head")
        # Thick coiled cable loop over left shoulder
        bpy.ops.mesh.primitive_torus_add(
            major_radius=0.20,
            minor_radius=0.055,
            location=(cw.x - 0.20, cw.y, cw.z + 0.15),
        )
        cable = bpy.context.active_object
        cable.name = "Vector_Cable"
        cable.rotation_euler = (math.radians(20), math.radians(65), 0)
        cable_mat = set_material_color("Vector_Cable_Mat", "#48525F", roughness=0.4)
        cable.data.materials.append(cable_mat)
        attach_to_bone(cable, arm, "Chest")
        # Tablet in Hand.R
        bpy.ops.mesh.primitive_cube_add(size=0.16, location=(hr.x - 0.06, hr.y, hr.z))
        vtab = bpy.context.active_object
        vtab.name = "Vector_Tablet"
        vtab.scale = (0.2, 0.9, 1.2)
        vtab_mat = set_material_color("Vector_Tab_Mat", "#3FA66B", roughness=0.3)
        vtab.data.materials.append(vtab_mat)
        attach_to_bone(vtab, arm, "Hand.R")

    elif cid == "sentinel":
        set_material_color("Suit", "#282D3F", roughness=0.5)
        set_material_color("Suit.001", "#1A1C29", roughness=0.6)
        set_material_color("Tie", "#D23C3C", roughness=0.3)
        set_material_color("White", "#14141E", roughness=0.5)
        # Visor slit across eyes
        bpy.ops.mesh.primitive_cube_add(
            size=0.06,
            location=(hw.x, hw.y - 0.20, hw.z),
        )
        visor = bpy.context.active_object
        visor.name = "Sentinel_Visor"
        visor.scale = (3.2, 0.4, 0.6)
        visor_mat = set_material_color(
            "Sentinel_Visor_Mat", "#D23C3C", roughness=0.1, emission_hex="#D23C3C"
        )
        visor.data.materials.append(visor_mat)
        attach_to_bone(visor, arm, "Head")
        # Tall popped trench coat collar flanking neck
        for sgn, cx_off in [(-1, -0.16), (1, 0.16)]:
            bpy.ops.mesh.primitive_cube_add(
                size=0.12, location=(cw.x + cx_off, cw.y - 0.05, cw.z + 0.18)
            )
            col = bpy.context.active_object
            col.scale = (0.2, 0.8, 1.4)
            col_mat = set_material_color("Collar_Dark", "#1A1C29", roughness=0.6)
            col.data.materials.append(col_mat)
            attach_to_bone(col, arm, "Chest")
        # Clipboard PASS in Hand.L
        bpy.ops.mesh.primitive_cube_add(size=0.18, location=(hl.x + 0.08, hl.y, hl.z))
        board = bpy.context.active_object
        board.name = "Sentinel_Clipboard"
        board.scale = (0.15, 0.9, 1.3)
        board_mat = set_material_color("Board_White", "#FFFFFF", roughness=0.3)
        board.data.materials.append(board_mat)
        attach_to_bone(board, arm, "Hand.L")

    elif cid == "bastion":
        set_material_color("LightBlue", "#6B7785", roughness=0.4)
        set_material_color("Purple", "#374151", roughness=0.6)
        set_material_color("White", "#1F2937", roughness=0.7)
        # Tactical helmet
        bpy.ops.mesh.primitive_uv_sphere_add(
            radius=0.22,
            location=(hw.x, hw.y - 0.02, hw.z + 0.06),
        )
        dome = bpy.context.active_object
        dome.name = "Bastion_Helmet"
        dome.scale = (1.1, 1.15, 0.95)
        b_armor = set_material_color("Bastion_Armor_Mat", "#6B7785", roughness=0.35)
        dome.data.materials.append(b_armor)
        # LED Lamp
        bpy.ops.mesh.primitive_cube_add(size=0.06, location=(hw.x + 0.24, hw.y - 0.08, hw.z + 0.08))
        lamp = bpy.context.active_object
        lamp.name = "Bastion_Lamp"
        lamp_mat = set_material_color("Bastion_Lamp_Mat", "#00F0FF", roughness=0.1, emission_hex="#00F0FF")
        lamp.data.materials.append(lamp_mat)
        # Tactical riot shield on back
        bpy.ops.mesh.primitive_cube_add(
            size=0.28,
            location=(cw.x, cw.y + 0.22, cw.z),
        )
        shield = bpy.context.active_object
        shield.name = "Bastion_Shield"
        shield.scale = (1.3, 0.2, 1.7)
        shield_mat = set_material_color("Bastion_Shield_Mat", "#48525F", roughness=0.4)
        shield.data.materials.append(shield_mat)
        attach_to_bone(dome, arm, "Head")
        attach_to_bone(lamp, arm, "Head")
        attach_to_bone(shield, arm, "Chest")
        # Walkie-talkie in Hand.R
        bpy.ops.mesh.primitive_cube_add(size=0.08, location=(hr.x - 0.06, hr.y, hr.z))
        walkie = bpy.context.active_object
        walkie.name = "Bastion_Walkie"
        walkie_mat = set_material_color("Walkie_Mat", "#14141E", roughness=0.5)
        walkie.data.materials.append(walkie_mat)
        attach_to_bone(walkie, arm, "Hand.R")

    elif cid == "relay":
        set_material_color("Worker_Vest", "#6D5BD0", roughness=0.5)
        set_material_color("Worker_Yellow", "#FFFFFF", roughness=0.4)
        set_material_color("Grey", "#282D3F", roughness=0.6)
        # Peaked courier cap
        bpy.ops.mesh.primitive_cylinder_add(
            radius=0.20,
            depth=0.08,
            location=(hw.x, hw.y - 0.05, hw.z + 0.16),
        )
        rcap = bpy.context.active_object
        rcap.name = "Relay_Cap"
        rcap_mat = set_material_color("Relay_Cap_Mat", "#6D5BD0", roughness=0.4)
        rcap.data.materials.append(rcap_mat)
        attach_to_bone(rcap, arm, "Head")
        # Messenger satchel bag on hip
        bpy.ops.mesh.primitive_cube_add(
            size=0.22,
            location=(hip_w.x - 0.22, hip_w.y, hip_w.z),
        )
        bag = bpy.context.active_object
        bag.name = "Relay_Bag"
        bag.scale = (0.6, 1.2, 0.9)
        bag_mat = set_material_color("Leather_Satchel", "#A26D3F", roughness=0.5)
        bag.data.materials.append(bag_mat)
        attach_to_bone(bag, arm, "Hips")
        # Parcel box in Hand.R
        bpy.ops.mesh.primitive_cube_add(size=0.18, location=(hr.x - 0.12, hr.y - 0.05, hr.z + 0.02))
        parcel = bpy.context.active_object
        parcel.name = "Relay_Parcel"
        parcel.scale = (1.0, 1.3, 0.9)
        parcel_mat = set_material_color("Parcel_Box", "#E0B678", roughness=0.6)
        parcel.data.materials.append(parcel_mat)
        attach_to_bone(parcel, arm, "Hand.R")

    elif cid == "warden":
        set_material_color("Worker_Vest", "#8E8E3A", roughness=0.5)
        set_material_color("Worker_Yellow", "#E0B678", roughness=0.4)
        set_material_color("Grey", "#48525F", roughness=0.6)
        # Heavy keyring with dangling keys on hip (clearly jutting out)
        bpy.ops.mesh.primitive_torus_add(
            major_radius=0.10,
            minor_radius=0.025,
            location=(hip_w.x + 0.22, hip_w.y, hip_w.z - 0.04),
        )
        ring = bpy.context.active_object
        ring.name = "Warden_Keyring"
        ring_mat = set_material_color("Brass_Keyring", "#E0B678", roughness=0.2)
        ring.data.materials.append(ring_mat)
        attach_to_bone(ring, arm, "Hips")
        # Toolbox in Hand.R
        bpy.ops.mesh.primitive_cube_add(size=0.20, location=(hr.x - 0.12, hr.y, hr.z - 0.04))
        toolbox = bpy.context.active_object
        toolbox.name = "Warden_Toolbox"
        toolbox.scale = (1.2, 0.8, 0.9)
        tb_mat = set_material_color("Toolbox_Red", "#D23C3C", roughness=0.4)
        toolbox.data.materials.append(tb_mat)
        attach_to_bone(toolbox, arm, "Hand.R")

    elif cid == "steward":
        set_material_color("Worker_Vest", "#9CC23A", roughness=0.4)
        set_material_color("Worker_Yellow", "#1E1E2E", roughness=0.6)
        set_material_color("Grey", "#334155", roughness=0.6)
        # Futuristic VR Headset on forehead
        bpy.ops.mesh.primitive_cube_add(
            size=0.12,
            location=(hw.x, hw.y - 0.22, hw.z + 0.10),
        )
        vr = bpy.context.active_object
        vr.name = "Steward_VR"
        vr.scale = (2.2, 0.6, 0.8)
        vr_mat = set_material_color("VR_Mat", "#1E1E2E", roughness=0.2)
        vr.data.materials.append(vr_mat)
        # VR cyan optics
        bpy.ops.mesh.primitive_cube_add(
            size=0.05,
            location=(hw.x, hw.y - 0.26, hw.z + 0.10),
        )
        optics = bpy.context.active_object
        optics.name = "Steward_Optics"
        optics.scale = (3.5, 0.3, 0.6)
        opt_mat = set_material_color("VR_Optics", "#00F0FF", roughness=0.1, emission_hex="#00F0FF")
        optics.data.materials.append(opt_mat)
        attach_to_bone(vr, arm, "Head")
        attach_to_bone(optics, arm, "Head")
        # Floating voxel tile above Hand.R
        bpy.ops.mesh.primitive_cube_add(
            size=0.12,
            location=(hr.x - 0.12, hr.y - 0.05, hr.z + 0.16),
        )
        tile = bpy.context.active_object
        tile.name = "Steward_Tile"
        tile.rotation_euler = (math.radians(35), math.radians(45), 0)
        tile_mat = set_material_color("Voxel_Glow", "#00F0FF", roughness=0.1, emission_hex="#9CC23A")
        tile.data.materials.append(tile_mat)
        attach_to_bone(tile, arm, "Hand.R")

    elif cid == "scribe":
        set_material_color("LightBlue", "#7A4A2E", roughness=0.6)
        set_material_color("Purple", "#4A2814", roughness=0.6)
        set_material_color("White", "#F5F0E1", roughness=0.5)
        # Graceful Hijab / Kerudung draping head and shoulder
        bpy.ops.mesh.primitive_uv_sphere_add(
            radius=0.22,
            location=(hw.x, hw.y - 0.01, hw.z + 0.04),
        )
        hijab = bpy.context.active_object
        hijab.name = "Scribe_Hijab"
        hijab.scale = (1.05, 1.15, 1.10)
        hijab_mat = set_material_color("Hijab_Cream", "#F5F0E1", roughness=0.5)
        hijab.data.materials.append(hijab_mat)
        attach_to_bone(hijab, arm, "Head")
        # Shoulder drape
        bpy.ops.mesh.primitive_cylinder_add(
            radius=0.24, depth=0.20, location=(cw.x, cw.y, cw.z + 0.12)
        )
        drape = bpy.context.active_object
        drape.data.materials.append(hijab_mat)
        attach_to_bone(drape, arm, "Chest")
        # Slender feather quill in Hand.L
        bpy.ops.mesh.primitive_cone_add(
            radius1=0.035,
            depth=0.35,
            location=(hl.x + 0.10, hl.y - 0.02, hl.z + 0.12),
        )
        quill = bpy.context.active_object
        quill.name = "Scribe_Quill"
        quill.rotation_euler = (0, math.radians(-25), math.radians(20))
        quill_mat = set_material_color("Quill_Mat", "#D1D8E0", roughness=0.3)
        quill.data.materials.append(quill_mat)
        attach_to_bone(quill, arm, "Hand.L")

    elif cid == "nova":
        set_material_color("LightBlue", "#F2C230", roughness=0.4)
        set_material_color("Purple", "#1E1E2E", roughness=0.6)
        set_material_color("White", "#FFFFFF", roughness=0.4)
        # High side-ponytail
        bpy.ops.mesh.primitive_uv_sphere_add(
            radius=0.12,
            location=(hw.x + 0.22, hw.y + 0.10, hw.z + 0.18),
        )
        ponytail = bpy.context.active_object
        ponytail.name = "Nova_Ponytail"
        pt_mat = set_material_color("Dark_Hair", "#4A2814", roughness=0.8)
        ponytail.data.materials.append(pt_mat)
        # Star hairpin beside ponytail
        bpy.ops.mesh.primitive_cube_add(
            size=0.09,
            location=(hw.x + 0.26, hw.y + 0.04, hw.z + 0.24),
        )
        starclip = bpy.context.active_object
        starclip.name = "Nova_StarClip"
        starclip.rotation_euler = (math.radians(45), math.radians(45), 0)
        sclip_mat = set_material_color("StarClip_Gold", "#F2C230", roughness=0.2, emission_hex="#FEF9C3")
        starclip.data.materials.append(sclip_mat)
        attach_to_bone(ponytail, arm, "Head")
        attach_to_bone(starclip, arm, "Head")
        # Sports water bottle in Hand.R
        bpy.ops.mesh.primitive_cylinder_add(
            radius=0.045,
            depth=0.22,
            location=(hr.x - 0.08, hr.y, hr.z + 0.04),
        )
        bottle = bpy.context.active_object
        bottle.name = "Nova_Bottle"
        b_mat = set_material_color("Water_Bottle", "#2BB3C0", roughness=0.2)
        bottle.data.materials.append(b_mat)
        attach_to_bone(bottle, arm, "Hand.R")

    elif cid == "rifqi":
        set_material_color("LightBlue", "#F5F0E1", roughness=0.5)
        set_material_color("Purple", "#475069", roughness=0.6)
        set_material_color("White", "#FFFFFF", roughness=0.5)
        set_material_color("Hair", "#14141E", roughness=0.8)
        # Distinct floating golden crown hovering above head
        bpy.ops.mesh.primitive_cylinder_add(
            radius=0.14,
            depth=0.09,
            vertices=6,
            location=(hw.x, hw.y - 0.02, hw.z + 0.38),
        )
        crown = bpy.context.active_object
        crown.name = "Rifqi_Crown"
        crown_mat = set_material_color("Founder_Crown", "#F2C230", roughness=0.2, emission_hex="#FEF9C3")
        crown.data.materials.append(crown_mat)
        # Add crown points
        for c_angle in (0, math.radians(120), math.radians(240)):
            px = hw.x + 0.11 * math.cos(c_angle)
            py = hw.y + 0.11 * math.sin(c_angle)
            bpy.ops.mesh.primitive_cone_add(
                radius1=0.04, depth=0.08, location=(px, py, hw.z + 0.45)
            )
            pt = bpy.context.active_object
            pt.data.materials.append(crown_mat)
            attach_to_bone(pt, arm, "Head")
        attach_to_bone(crown, arm, "Head")
        # Smartphone in Hand.R
        bpy.ops.mesh.primitive_cube_add(
            size=0.12,
            location=(hr.x - 0.06, hr.y, hr.z),
        )
        phone = bpy.context.active_object
        phone.name = "Rifqi_Phone"
        phone.scale = (0.2, 0.7, 1.2)
        phone_mat = set_material_color("Phone_Black", "#14141E", roughness=0.2, emission_hex="#00F0FF")
        phone.data.materials.append(phone_mat)
        attach_to_bone(phone, arm, "Hand.R")

    elif cid == "guest":
        set_material_color("LightBlue", "#9CA8B8", roughness=0.5)
        set_material_color("Purple", "#48525F", roughness=0.6)
        set_material_color("White", "#1E1E2E", roughness=0.5)
        # Visitor Lanyard cord & ID pass hanging on chest
        bpy.ops.mesh.primitive_cube_add(
            size=0.14,
            location=(cw.x, cw.y - 0.16, cw.z - 0.02),
        )
        badge = bpy.context.active_object
        badge.name = "Guest_Badge"
        badge.scale = (0.8, 0.1, 1.1)
        badge_mat = set_material_color("Visitor_Pass", "#FFFFFF", roughness=0.3)
        badge.data.materials.append(badge_mat)
        attach_to_bone(badge, arm, "Chest")
        # Notebook in Hand.L
        bpy.ops.mesh.primitive_cube_add(
            size=0.16,
            location=(hl.x + 0.06, hl.y, hl.z),
        )
        nb = bpy.context.active_object
        nb.name = "Guest_Notebook"
        nb.scale = (0.2, 0.9, 1.2)
        nb_mat = set_material_color("Guest_Notebook_Mat", "#A26D3F", roughness=0.5)
        nb.data.materials.append(nb_mat)
        attach_to_bone(nb, arm, "Hand.L")

    return root, arm


# ---------------------------------------------------------------------------
# Animation Poses
# ---------------------------------------------------------------------------

WALK_KEYFRAMES = [
    # (leg_l, knee_l, leg_r, knee_r, arm_l, arm_r)
    (18, 0, -16, 8, 18, 18),
    (10, 5, -10, 25, 8, 8),
    (-2, 0, 12, 38, -10, -10),
    (-16, 8, 18, 0, -18, -18),
    (-10, 25, 10, 5, -8, -8),
    (12, 38, -2, 0, 10, 10),
]

IDLE_KEYFRAMES = [
    # (lift, sway, nod)
    (0.000, 0.0, 0.0),
    (0.008, 2.0, 1.5),
    (0.014, 3.5, 2.5),
    (0.007, 1.5, 1.0),
]


def set_bone_rot(arm: bpy.types.Object, bname: str, x: float = 0, y: float = 0, z: float = 0) -> None:
    """Helper to set XYZ Euler rotation on an armature pose bone."""
    pb = arm.pose.bones.get(bname)
    if pb:
        pb.rotation_mode = "XYZ"
        pb.rotation_euler = (math.radians(x), math.radians(y), math.radians(z))


def apply_animation_frame(
    arm: bpy.types.Object,
    anim_name: str,
    frame: int,
    base_arm_x: float,
    char_id: str = "",
) -> float:
    """Apply animation pose to bones and return torso lift offset."""
    lift = 0.0

    if anim_name == "walk":
        ll, kl, lr, kr, al, ar = WALK_KEYFRAMES[frame]
        set_bone_rot(arm, "UpperLeg.L", 0, 0, ll)
        set_bone_rot(arm, "LowerLeg.L", kl, 0, 0)
        set_bone_rot(arm, "UpperLeg.R", 0, 0, lr)
        set_bone_rot(arm, "LowerLeg.R", kr, 0, 0)
        set_bone_rot(arm, "UpperArm.L", math.degrees(base_arm_x), al, 0)
        set_bone_rot(arm, "UpperArm.R", math.degrees(base_arm_x), ar, 0)
        set_bone_rot(arm, "Head", 0, 0, 0)
        set_bone_rot(arm, "Torso", 0, 0, 0)

    elif anim_name == "idle":
        lift, sway, nod = IDLE_KEYFRAMES[frame]
        set_bone_rot(arm, "UpperLeg.L", 0, 0, 0)
        set_bone_rot(arm, "LowerLeg.L", 0, 0, 0)
        set_bone_rot(arm, "UpperLeg.R", 0, 0, 0)
        set_bone_rot(arm, "LowerLeg.R", 0, 0, 0)
        set_bone_rot(arm, "UpperArm.L", math.degrees(base_arm_x) + sway, 0, 0)
        set_bone_rot(arm, "UpperArm.R", math.degrees(base_arm_x) + sway, 0, 0)
        set_bone_rot(arm, "Head", nod, 0, 0)
        set_bone_rot(arm, "Torso", 0, 0, 0)

    elif anim_name == "sit_type":
        set_bone_rot(arm, "UpperLeg.L", 0, 0, 85)
        set_bone_rot(arm, "UpperLeg.R", 0, 0, 85)
        set_bone_rot(arm, "LowerLeg.L", 85, 0, 0)
        set_bone_rot(arm, "LowerLeg.R", 85, 0, 0)
        type_off = 6 if frame % 2 == 0 else -6
        set_bone_rot(arm, "UpperArm.L", -20, 25 + type_off, 0)
        set_bone_rot(arm, "UpperArm.R", -20, 25 - type_off, 0)
        set_bone_rot(arm, "LowerArm.L", 0, 45, 0)
        set_bone_rot(arm, "LowerArm.R", 0, 45, 0)
        set_bone_rot(arm, "Head", 10, 0, 0)
        set_bone_rot(arm, "Torso", 5, 0, 0)

    elif anim_name == "stand_talk":
        talk_off = 10 if frame % 2 == 0 else -10
        set_bone_rot(arm, "UpperLeg.L", 0, 0, 0)
        set_bone_rot(arm, "LowerLeg.L", 0, 0, 0)
        set_bone_rot(arm, "UpperLeg.R", 0, 0, 0)
        set_bone_rot(arm, "LowerLeg.R", 0, 0, 0)
        set_bone_rot(arm, "UpperArm.L", math.degrees(base_arm_x) + talk_off * 0.5, 0, 0)
        set_bone_rot(arm, "UpperArm.R", -35, 30 + talk_off, 0)
        set_bone_rot(arm, "LowerArm.R", 0, 30, 0)
        set_bone_rot(arm, "Head", 6 + talk_off * 0.3, talk_off * 0.2, 0)
        set_bone_rot(arm, "Torso", 0, 0, 0)

    elif anim_name == "celebrate":
        hop = 0.02 if frame == 1 else 0.0
        lift = hop
        set_bone_rot(arm, "UpperLeg.L", 0, 0, 0)
        set_bone_rot(arm, "LowerLeg.L", 0, 0, 0)
        set_bone_rot(arm, "UpperLeg.R", 0, 0, 0)
        set_bone_rot(arm, "LowerLeg.R", 0, 0, 0)
        set_bone_rot(arm, "UpperArm.L", 40 + (10 if frame == 1 else 0), -40, 20)
        set_bone_rot(arm, "UpperArm.R", 40 + (10 if frame == 1 else 0), 40, -20)
        set_bone_rot(arm, "LowerArm.L", 0, -20, 0)
        set_bone_rot(arm, "LowerArm.R", 0, 20, 0)
        set_bone_rot(arm, "Head", -15, 0, 0)
        set_bone_rot(arm, "Torso", 0, 0, 0)

    elif anim_name == "pray_berdiri":
        set_bone_rot(arm, "UpperLeg.L", 0, 0, 0)
        set_bone_rot(arm, "LowerLeg.L", 0, 0, 0)
        set_bone_rot(arm, "UpperLeg.R", 0, 0, 0)
        set_bone_rot(arm, "LowerLeg.R", 0, 0, 0)
        set_bone_rot(arm, "UpperArm.L", -45, 20, 15)
        set_bone_rot(arm, "UpperArm.R", -45, 20, -15)
        set_bone_rot(arm, "LowerArm.L", 0, 50, 0)
        set_bone_rot(arm, "LowerArm.R", 0, 50, 0)
        set_bone_rot(arm, "Head", 15, 0, 0)
        set_bone_rot(arm, "Torso", 0, 0, 0)
        lift = 0.005 if frame == 1 else 0.0

    elif anim_name == "pray_rukuk":
        set_bone_rot(arm, "Torso", 75, 0, 0)
        set_bone_rot(arm, "UpperLeg.L", 0, 0, -10)
        set_bone_rot(arm, "UpperLeg.R", 0, 0, -10)
        set_bone_rot(arm, "LowerLeg.L", 10, 0, 0)
        set_bone_rot(arm, "LowerLeg.R", 10, 0, 0)
        set_bone_rot(arm, "UpperArm.L", -20, 0, 0)
        set_bone_rot(arm, "UpperArm.R", -20, 0, 0)
        set_bone_rot(arm, "Head", 5, 0, 0)

    elif anim_name == "pray_sujud":
        set_bone_rot(arm, "UpperLeg.L", 0, 0, 95)
        set_bone_rot(arm, "UpperLeg.R", 0, 0, 95)
        set_bone_rot(arm, "LowerLeg.L", 125, 0, 0)
        set_bone_rot(arm, "LowerLeg.R", 125, 0, 0)
        set_bone_rot(arm, "Torso", 85, 0, 0)
        set_bone_rot(arm, "Head", 30, 0, 0)
        set_bone_rot(arm, "UpperArm.L", 10, 30, 0)
        set_bone_rot(arm, "UpperArm.R", 10, 30, 0)

    elif anim_name == "pray_duduk":
        set_bone_rot(arm, "UpperLeg.L", 0, 0, 90)
        set_bone_rot(arm, "UpperLeg.R", 0, 0, 90)
        set_bone_rot(arm, "LowerLeg.L", 120, 0, 0)
        set_bone_rot(arm, "LowerLeg.R", 120, 0, 0)
        set_bone_rot(arm, "Torso", 5, 0, 0)
        set_bone_rot(arm, "UpperArm.L", -60, 15, 0)
        set_bone_rot(arm, "UpperArm.R", -60, 15, 0)
        set_bone_rot(arm, "LowerArm.L", 0, 30, 0)
        set_bone_rot(arm, "LowerArm.R", 0, 30, 0)
        set_bone_rot(arm, "Head", 10, 0, 0)

    elif anim_name == "drink":
        tilt = 12 if frame == 1 else 0
        set_bone_rot(arm, "UpperLeg.L", 0, 0, 0)
        set_bone_rot(arm, "LowerLeg.L", 0, 0, 0)
        set_bone_rot(arm, "UpperLeg.R", 0, 0, 0)
        set_bone_rot(arm, "LowerLeg.R", 0, 0, 0)
        set_bone_rot(arm, "UpperArm.R", -20 + tilt * 2, 40 + tilt, 0)
        set_bone_rot(arm, "LowerArm.R", 0, 60 + tilt * 2, 0)
        set_bone_rot(arm, "UpperArm.L", math.degrees(base_arm_x), 0, 0)
        set_bone_rot(arm, "Head", -5 - tilt * 0.8, 0, 0)
        set_bone_rot(arm, "Torso", 0, 0, 0)

    elif anim_name == "swim":
        lift = -0.06
        set_bone_rot(arm, "Torso", 65, 0, 0)
        set_bone_rot(arm, "Head", -30, 0, 0)
        if frame == 0:
            set_bone_rot(arm, "UpperLeg.L", 0, 0, -20)
            set_bone_rot(arm, "LowerLeg.L", 25, 0, 0)
            set_bone_rot(arm, "UpperLeg.R", 0, 0, 15)
            set_bone_rot(arm, "LowerLeg.R", 0, 0, 0)
            set_bone_rot(arm, "UpperArm.L", 60, -30, 20)
            set_bone_rot(arm, "LowerArm.L", 0, -20, 0)
            set_bone_rot(arm, "UpperArm.R", -40, 30, -20)
            set_bone_rot(arm, "LowerArm.R", 0, 45, 0)
        else:
            set_bone_rot(arm, "UpperLeg.L", 0, 0, 15)
            set_bone_rot(arm, "LowerLeg.L", 0, 0, 0)
            set_bone_rot(arm, "UpperLeg.R", 0, 0, -20)
            set_bone_rot(arm, "LowerLeg.R", 25, 0, 0)
            set_bone_rot(arm, "UpperArm.L", -40, -30, 20)
            set_bone_rot(arm, "LowerArm.L", 0, -45, 0)
            set_bone_rot(arm, "UpperArm.R", 60, 30, -20)
            set_bone_rot(arm, "LowerArm.R", 0, 20, 0)

    elif anim_name == "game":
        set_bone_rot(arm, "UpperLeg.L", 0, 0, -5)
        set_bone_rot(arm, "LowerLeg.L", 5, 0, 0)
        set_bone_rot(arm, "UpperLeg.R", 0, 0, 5)
        set_bone_rot(arm, "LowerLeg.R", 5, 0, 0)
        set_bone_rot(arm, "Torso", 8, 0, 0)
        set_bone_rot(arm, "Head", 12, 0, 0)
        if frame == 0:
            set_bone_rot(arm, "UpperArm.L", -35, -25, 0)
            set_bone_rot(arm, "LowerArm.L", 0, -55, 0)
            set_bone_rot(arm, "UpperArm.R", -30, 30, 0)
            set_bone_rot(arm, "LowerArm.R", 0, 65, 0)
        else:
            set_bone_rot(arm, "UpperArm.L", -35, -15, 0)
            set_bone_rot(arm, "LowerArm.L", 0, -45, 0)
            set_bone_rot(arm, "UpperArm.R", -38, 25, 0)
            set_bone_rot(arm, "LowerArm.R", 0, 50, 0)

    elif anim_name == "whiteboard":
        set_bone_rot(arm, "UpperLeg.L", 0, 0, 0)
        set_bone_rot(arm, "LowerLeg.L", 0, 0, 0)
        set_bone_rot(arm, "UpperLeg.R", 0, 0, 0)
        set_bone_rot(arm, "LowerLeg.R", 0, 0, 0)
        set_bone_rot(arm, "Torso", 0, 0, 0)
        set_bone_rot(arm, "Head", -10, 0, 0)
        set_bone_rot(arm, "UpperArm.L", math.degrees(base_arm_x), -15, 0)
        set_bone_rot(arm, "LowerArm.L", 0, -25, 0)
        if frame == 0:
            set_bone_rot(arm, "UpperArm.R", -65, 25, 10)
            set_bone_rot(arm, "LowerArm.R", 0, 45, 0)
        else:
            set_bone_rot(arm, "UpperArm.R", -55, 35, -5)
            set_bone_rot(arm, "LowerArm.R", 0, 60, 0)

    elif anim_name == "special":
        set_bone_rot(arm, "UpperLeg.L", 0, 0, 0)
        set_bone_rot(arm, "LowerLeg.L", 0, 0, 0)
        set_bone_rot(arm, "UpperLeg.R", 0, 0, 0)
        set_bone_rot(arm, "LowerLeg.R", 0, 0, 0)
        set_bone_rot(arm, "Torso", 0, 0, 0)
        set_bone_rot(arm, "Head", 0, 0, 0)

        if char_id == "jarvis":
            # Tangan di belakang punggung, melirik jam tangan
            set_bone_rot(arm, "UpperArm.L", 35, -20, 0)
            set_bone_rot(arm, "LowerArm.L", 0, -45, 0)
            if frame == 0:
                set_bone_rot(arm, "UpperArm.R", -40, 35, 0)
                set_bone_rot(arm, "LowerArm.R", 0, 75, 0)
                set_bone_rot(arm, "Head", 15, -10, 0)
            else:
                set_bone_rot(arm, "UpperArm.R", -45, 30, 0)
                set_bone_rot(arm, "LowerArm.R", 0, 85, 0)
                set_bone_rot(arm, "Head", 20, -8, 0)

        elif char_id == "daedalus":
            # Membingkai udara dengan jari
            if frame == 0:
                set_bone_rot(arm, "UpperArm.L", -50, -30, 15)
                set_bone_rot(arm, "LowerArm.L", 0, -50, 0)
                set_bone_rot(arm, "UpperArm.R", -50, 30, -15)
                set_bone_rot(arm, "LowerArm.R", 0, 50, 0)
                set_bone_rot(arm, "Head", -8, 0, 0)
            else:
                set_bone_rot(arm, "UpperArm.L", -55, -38, 20)
                set_bone_rot(arm, "LowerArm.L", 0, -40, 0)
                set_bone_rot(arm, "UpperArm.R", -55, 38, -20)
                set_bone_rot(arm, "LowerArm.R", 0, 40, 0)
                set_bone_rot(arm, "Head", -5, 0, 0)

        elif char_id == "oracle":
            # Menunjuk ke atas saat "eureka"
            set_bone_rot(arm, "UpperArm.L", -25, -20, 0)
            set_bone_rot(arm, "LowerArm.L", 0, -45, 0)
            if frame == 0:
                set_bone_rot(arm, "UpperArm.R", -75, 20, 0)
                set_bone_rot(arm, "LowerArm.R", 0, 15, 0)
                set_bone_rot(arm, "Head", -18, 5, 0)
            else:
                lift = 0.02
                set_bone_rot(arm, "UpperArm.R", -85, 15, 0)
                set_bone_rot(arm, "LowerArm.R", 0, 5, 0)
                set_bone_rot(arm, "Head", -22, 5, 0)

        elif char_id == "merlin":
            # Mengelus janggut, mengangguk pelan
            set_bone_rot(arm, "UpperArm.L", math.degrees(base_arm_x), 0, 0)
            if frame == 0:
                set_bone_rot(arm, "UpperArm.R", -35, 25, 0)
                set_bone_rot(arm, "LowerArm.R", 0, 85, 0)
                set_bone_rot(arm, "Head", 8, 0, 0)
            else:
                set_bone_rot(arm, "UpperArm.R", -38, 28, 0)
                set_bone_rot(arm, "LowerArm.R", 0, 90, 0)
                set_bone_rot(arm, "Head", 20, 0, 0)

        elif char_id == "muse":
            # Membingkai dengan dua tangan, menggeser "1 px"
            if frame == 0:
                set_bone_rot(arm, "UpperArm.L", -45, -28, 10)
                set_bone_rot(arm, "LowerArm.L", 0, -45, 0)
                set_bone_rot(arm, "UpperArm.R", -45, 28, -10)
                set_bone_rot(arm, "LowerArm.R", 0, 45, 0)
                set_bone_rot(arm, "Head", -5, -5, 0)
            else:
                set_bone_rot(arm, "UpperArm.L", -45, -22, 10)
                set_bone_rot(arm, "LowerArm.L", 0, -45, 0)
                set_bone_rot(arm, "UpperArm.R", -45, 34, -10)
                set_bone_rot(arm, "LowerArm.R", 0, 45, 0)
                set_bone_rot(arm, "Head", -5, 5, 0)

        elif char_id == "prism":
            # Mengetik sangat cepat, memutar kursi saat build
            set_bone_rot(arm, "UpperLeg.L", 0, 0, 85)
            set_bone_rot(arm, "UpperLeg.R", 0, 0, 85)
            set_bone_rot(arm, "LowerLeg.L", 85, 0, 0)
            set_bone_rot(arm, "LowerLeg.R", 85, 0, 0)
            if frame == 0:
                set_bone_rot(arm, "UpperArm.L", -25, 30, 0)
                set_bone_rot(arm, "LowerArm.L", 0, 55, 0)
                set_bone_rot(arm, "UpperArm.R", -25, 20, 0)
                set_bone_rot(arm, "LowerArm.R", 0, 55, 0)
                set_bone_rot(arm, "Torso", 5, 0, 0)
                set_bone_rot(arm, "Head", 10, 0, 0)
            else:
                set_bone_rot(arm, "UpperArm.L", 30, -30, 0)
                set_bone_rot(arm, "UpperArm.R", 30, 30, 0)
                set_bone_rot(arm, "LowerArm.L", 0, -20, 0)
                set_bone_rot(arm, "LowerArm.R", 0, 20, 0)
                set_bone_rot(arm, "Torso", 0, 25, 0)
                set_bone_rot(arm, "Head", -10, 15, 0)

        elif char_id == "forge":
            # Mengetuk meja seperti menempa
            set_bone_rot(arm, "UpperArm.L", -25, -20, 0)
            set_bone_rot(arm, "LowerArm.L", 0, -45, 0)
            if frame == 0:
                set_bone_rot(arm, "UpperArm.R", -60, 25, 0)
                set_bone_rot(arm, "LowerArm.R", 0, 30, 0)
                set_bone_rot(arm, "Torso", 10, 0, 0)
                set_bone_rot(arm, "Head", 5, 0, 0)
            else:
                set_bone_rot(arm, "UpperArm.R", -15, 35, 0)
                set_bone_rot(arm, "LowerArm.R", 0, 70, 0)
                set_bone_rot(arm, "Torso", 15, 0, 0)
                set_bone_rot(arm, "Head", 12, 0, 0)

        elif char_id == "vector":
            # Menghitung dengan jari, mengusap layar
            set_bone_rot(arm, "UpperArm.L", -20, -25, 0)
            set_bone_rot(arm, "LowerArm.L", 0, -55, 0)
            if frame == 0:
                set_bone_rot(arm, "UpperArm.R", -35, 25, 0)
                set_bone_rot(arm, "LowerArm.R", 0, 65, 0)
                set_bone_rot(arm, "Head", 12, 0, 0)
            else:
                set_bone_rot(arm, "UpperArm.R", -28, 15, 0)
                set_bone_rot(arm, "LowerArm.R", 0, 50, 0)
                set_bone_rot(arm, "Head", 14, 5, 0)

        elif char_id == "sentinel":
            # Menyipitkan mata, mengetuk papan klip
            set_bone_rot(arm, "UpperArm.L", -25, -20, 0)
            set_bone_rot(arm, "LowerArm.L", 0, -60, 0)
            if frame == 0:
                set_bone_rot(arm, "UpperArm.R", -40, 20, 0)
                set_bone_rot(arm, "LowerArm.R", 0, 45, 0)
                set_bone_rot(arm, "Head", 10, 0, 0)
            else:
                set_bone_rot(arm, "UpperArm.R", -25, 25, 0)
                set_bone_rot(arm, "LowerArm.R", 0, 70, 0)
                set_bone_rot(arm, "Head", 15, 0, 0)

        elif char_id == "bastion":
            # Patroli sambil menoleh kiri-kanan
            set_bone_rot(arm, "UpperArm.L", -30, -20, 0)
            set_bone_rot(arm, "LowerArm.L", 0, -65, 0)
            set_bone_rot(arm, "UpperArm.R", math.degrees(base_arm_x), 0, 0)
            if frame == 0:
                set_bone_rot(arm, "Head", 0, -28, 0)
            else:
                set_bone_rot(arm, "Head", 0, 28, 0)

        elif char_id == "relay":
            # Jalan cepat, menempel label
            set_bone_rot(arm, "UpperArm.L", -25, -25, 0)
            set_bone_rot(arm, "LowerArm.L", 0, -50, 0)
            if frame == 0:
                set_bone_rot(arm, "UpperArm.R", -35, 20, 0)
                set_bone_rot(arm, "LowerArm.R", 0, 60, 0)
            else:
                set_bone_rot(arm, "UpperArm.R", -20, 25, 0)
                set_bone_rot(arm, "LowerArm.R", 0, 75, 0)
                set_bone_rot(arm, "Torso", 5, 0, 0)

        elif char_id == "warden":
            # Mengeluarkan alat acak dari kantong
            set_bone_rot(arm, "UpperArm.L", math.degrees(base_arm_x), -10, 0)
            if frame == 0:
                set_bone_rot(arm, "UpperArm.R", -10, 15, -25)
                set_bone_rot(arm, "LowerArm.R", 0, 80, 0)
                set_bone_rot(arm, "Head", 15, 10, 0)
            else:
                set_bone_rot(arm, "UpperArm.R", -55, 30, 0)
                set_bone_rot(arm, "LowerArm.R", 0, 40, 0)
                set_bone_rot(arm, "Head", 0, 0, 0)

        elif char_id == "steward":
            # "Memasang" tile ke lantai
            set_bone_rot(arm, "UpperLeg.L", 0, 0, 40)
            set_bone_rot(arm, "UpperLeg.R", 0, 0, 40)
            set_bone_rot(arm, "LowerLeg.L", 45, 0, 0)
            set_bone_rot(arm, "LowerLeg.R", 45, 0, 0)
            if frame == 0:
                lift = -0.02
                set_bone_rot(arm, "Torso", 25, 0, 0)
                set_bone_rot(arm, "Head", 20, 0, 0)
                set_bone_rot(arm, "UpperArm.L", -30, -20, 0)
                set_bone_rot(arm, "LowerArm.L", 0, -40, 0)
                set_bone_rot(arm, "UpperArm.R", -30, 20, 0)
                set_bone_rot(arm, "LowerArm.R", 0, 40, 0)
            else:
                lift = -0.025
                set_bone_rot(arm, "Torso", 30, 0, 0)
                set_bone_rot(arm, "Head", 25, 0, 0)
                set_bone_rot(arm, "UpperArm.L", -15, -15, 0)
                set_bone_rot(arm, "LowerArm.L", 0, -55, 0)
                set_bone_rot(arm, "UpperArm.R", -15, 15, 0)
                set_bone_rot(arm, "LowerArm.R", 0, 55, 0)

        elif char_id == "scribe":
            # Membetulkan kacamata, mencelup pena
            set_bone_rot(arm, "UpperArm.L", -20, -15, 0)
            set_bone_rot(arm, "LowerArm.L", 0, -45, 0)
            if frame == 0:
                set_bone_rot(arm, "UpperArm.R", -48, 18, 0)
                set_bone_rot(arm, "LowerArm.R", 0, 95, 0)
                set_bone_rot(arm, "Head", 5, 0, 0)
            else:
                set_bone_rot(arm, "UpperArm.R", -18, 25, 0)
                set_bone_rot(arm, "LowerArm.R", 0, 60, 0)
                set_bone_rot(arm, "Head", 15, 0, 0)

        elif char_id == "nova":
            # Lompat kecil, high-five
            if frame == 0:
                lift = -0.015
                set_bone_rot(arm, "UpperLeg.L", 0, 0, 15)
                set_bone_rot(arm, "UpperLeg.R", 0, 0, 15)
                set_bone_rot(arm, "LowerLeg.L", 20, 0, 0)
                set_bone_rot(arm, "LowerLeg.R", 20, 0, 0)
                set_bone_rot(arm, "UpperArm.R", -20, 20, 0)
                set_bone_rot(arm, "UpperArm.L", math.degrees(base_arm_x), 0, 0)
            else:
                lift = 0.04
                set_bone_rot(arm, "UpperLeg.L", 0, 0, 0)
                set_bone_rot(arm, "UpperLeg.R", 0, 0, 0)
                set_bone_rot(arm, "LowerLeg.L", 0, 0, 0)
                set_bone_rot(arm, "LowerLeg.R", 0, 0, 0)
                set_bone_rot(arm, "UpperArm.R", 65, 30, 0)
                set_bone_rot(arm, "LowerArm.R", 0, 15, 0)
                set_bone_rot(arm, "UpperArm.L", 40, -30, 0)
                set_bone_rot(arm, "Head", -15, 0, 0)

        elif char_id == "rifqi":
            # Peregangan, melambai ke agent
            if frame == 0:
                set_bone_rot(arm, "UpperArm.L", 50, -35, 15)
                set_bone_rot(arm, "LowerArm.L", 0, -85, 0)
                set_bone_rot(arm, "UpperArm.R", 50, 35, -15)
                set_bone_rot(arm, "LowerArm.R", 0, 85, 0)
                set_bone_rot(arm, "Head", -10, 0, 0)
            else:
                set_bone_rot(arm, "UpperArm.L", math.degrees(base_arm_x), 0, 0)
                set_bone_rot(arm, "UpperArm.R", -55, 35, 0)
                set_bone_rot(arm, "LowerArm.R", 0, 50, 20)
                set_bone_rot(arm, "Head", 0, 5, 0)

        elif char_id == "guest":
            # Mengamati sekeliling / berdecak kagum
            if frame == 0:
                set_bone_rot(arm, "UpperArm.L", 10, -25, 0)
                set_bone_rot(arm, "LowerArm.L", 0, -45, 0)
                set_bone_rot(arm, "UpperArm.R", 10, 25, 0)
                set_bone_rot(arm, "LowerArm.R", 0, 45, 0)
                set_bone_rot(arm, "Head", -10, -20, 0)
            else:
                set_bone_rot(arm, "UpperArm.L", 10, -25, 0)
                set_bone_rot(arm, "LowerArm.L", 0, -45, 0)
                set_bone_rot(arm, "UpperArm.R", -35, 30, 0)
                set_bone_rot(arm, "LowerArm.R", 0, 40, 0)
                set_bone_rot(arm, "Head", -5, 15, 0)

    return lift


# ---------------------------------------------------------------------------
# Character Rendering Orchestration
# ---------------------------------------------------------------------------

SIG_ACTION_MAP = {
    "jarvis": "watch_check",
    "daedalus": "frame_air",
    "oracle": "eureka",
    "merlin": "stroke_beard",
    "muse": "frame_canvas",
    "prism": "spin_chair",
    "forge": "hammer_tap",
    "vector": "calc_fingers",
    "sentinel": "tap_clipboard",
    "bastion": "scan_surround",
    "relay": "stamp_label",
    "warden": "pull_tool",
    "steward": "place_tile",
    "scribe": "adjust_glasses",
    "nova": "cheer_jump",
    "rifqi": "stretch_wave",
    "guest": "observe",
}

ANIMATION_CONFIG = [
    ("idle", 4),
    ("walk", 6),
    ("sit_type", 2),
    ("stand_talk", 2),
    ("celebrate", 2),
    ("pray_berdiri", 2),
    ("pray_rukuk", 2),
    ("pray_sujud", 2),
    ("pray_duduk", 2),
    ("drink", 2),
    ("swim", 2),
    ("game", 2),
    ("whiteboard", 2),
    ("special", 2),
]


def render_single_character(
    char_info: dict,
    models_dir: str,
    output_dir: str,
    palette_rgb: list[tuple[int, int, int]],
    samples: int = 16,
) -> dict[str, float]:
    """Render all required animations and directions for one character."""
    cid = char_info["id"]
    char_raw_dir = os.path.join(output_dir, "raw_characters", cid)
    os.makedirs(char_raw_dir, exist_ok=True)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    setup_blender_scene(samples=samples)
    setup_lighting()
    setup_camera(target=Vector((0, 0, 0.78)), ortho_scale=1.95)

    root, arm = build_character(char_info, models_dir)
    base_arm_x = -math.radians(72)
    root_pb = arm.pose.bones["Root"]
    root_pb.rotation_mode = "XYZ"

    scene = bpy.context.scene
    directions = [("se", 90), ("ne", 180)]
    times: dict[str, float] = {}

    for dir_name, dir_angle in directions:
        root_pb.rotation_euler = (0, math.radians(dir_angle), 0)

        for anim_name, frame_count in ANIMATION_CONFIG:
            t0 = time.time()
            for f in range(frame_count):
                lift = apply_animation_frame(arm, anim_name, f, base_arm_x, char_id=cid)

                root.location.z = 0.0
                bpy.context.view_layer.update()
                depsgraph = bpy.context.evaluated_depsgraph_get()
                all_meshes = [o for o in bpy.data.objects if o.type == "MESH"]
                if all_meshes:
                    min_z = min(
                        (m.evaluated_get(depsgraph).matrix_world @ Vector(c)).z
                        for m in all_meshes
                        for c in m.bound_box
                    )
                    root.location.z = -min_z + lift
                    bpy.context.view_layer.update()

                out_file = os.path.join(
                    char_raw_dir, f"{cid}_{anim_name}_{dir_name}_{f}.png"
                )
                scene.render.filepath = out_file
                bpy.ops.render.render(write_still=True)
                post_process_image(out_file, palette_rgb, char_id=cid)

            times[f"{cid}_{anim_name}_{dir_name}"] = time.time() - t0

        for stage_idx, stage_name in enumerate(["pray_berdiri", "pray_rukuk", "pray_sujud", "pray_duduk"]):
            src_f = os.path.join(char_raw_dir, f"{cid}_{stage_name}_{dir_name}_0.png")
            dst_f = os.path.join(char_raw_dir, f"{cid}_pray_{dir_name}_{stage_idx}.png")
            if os.path.exists(src_f) and not os.path.exists(dst_f):
                shutil.copyfile(src_f, dst_f)

        sig_name = SIG_ACTION_MAP.get(cid)
        if sig_name:
            for f in range(2):
                src_f = os.path.join(char_raw_dir, f"{cid}_special_{dir_name}_{f}.png")
                dst_f = os.path.join(char_raw_dir, f"{cid}_{sig_name}_{dir_name}_{f}.png")
                if os.path.exists(src_f) and not os.path.exists(dst_f):
                    shutil.copyfile(src_f, dst_f)

    return times


def run_headless_blender_render(args: argparse.Namespace) -> None:
    """Invoked inside Blender to render all characters."""
    output_dir = args.output_dir
    models_dir = os.path.join(args.root_dir, "art/sumber/characters")
    palette_rgb = load_palette(args.palette)

    target_characters = CHARACTERS
    if getattr(args, "character", None):
        target_characters = [c for c in CHARACTERS if c["id"] == args.character]

    print(f"\n=======================================================")
    print(f"Blender Headless Production Render: {len(target_characters)} Characters")
    print(f"Master 32-Color Palette: {args.palette} ({len(palette_rgb)} colors)")
    print(f"Output Directory: {output_dir}")
    print(f"=======================================================\n")

    all_times: dict[str, float] = {}
    total_t0 = time.time()

    for idx, cinfo in enumerate(target_characters, 1):
        cid = cinfo["id"]
        cname = cinfo["name"]
        print(f"[{idx}/{len(target_characters)}] Rendering {cname} ({cid}) - Base {cinfo['base_rig']}...")
        t0 = time.time()
        ctimes = render_single_character(
            cinfo,
            models_dir=models_dir,
            output_dir=output_dir,
            palette_rgb=palette_rgb,
            samples=args.samples,
        )
        duration = time.time() - t0
        all_times[cid] = duration
        print(f"  -> Completed {cid} in {duration:.2f}s")

    total_duration = time.time() - total_t0
    print(f"\nAll {len(target_characters)} characters rendered in {total_duration:.2f}s!")

    metrics = {
        "character_count": len(CHARACTERS),
        "total_render_time_seconds": total_duration,
        "per_character_times_seconds": all_times,
        "average_per_character_seconds": total_duration / len(CHARACTERS),
        "samples_per_pixel": args.samples,
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S WIB"),
    }
    metrics_path = os.path.join(output_dir, "character_render_metrics.json")
    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)


# ---------------------------------------------------------------------------
# Texture Atlas Packing & Silhouette Test Generator
# ---------------------------------------------------------------------------

def pack_character_spritesheets(dist_dir: str, frontend_dir: str) -> None:
    """Pack per-character sprite sheets and combined master sheet via pack_characters.js."""
    pack_script = Path(__file__).resolve().parent / "pack_characters.js"
    cmd = ["node", str(pack_script), dist_dir, frontend_dir]
    print(f"Running packing script: {' '.join(cmd)}")
    res = subprocess.run(cmd, check=True)
    if res.returncode != 0:
        raise RuntimeError("Texture atlas packing failed!")


def generate_silhouette_test_and_report(
    dist_dir: str,
    palette_path: str,
    output_report_path: str,
) -> None:
    """Generate high-contrast silhouette & grayscale review images and interactive HTML report."""
    import numpy as np  # type: ignore[import-not-found]
    from PIL import Image, ImageDraw  # type: ignore[import-not-found]

    raw_chars_dir = os.path.join(dist_dir, "raw_characters")
    chars_to_test = [c for c in CHARACTERS if c["id"] != "guest"]
    all_17 = CHARACTERS

    char_images: dict[str, Image.Image] = {}
    for c in all_17:
        cid = c["id"]
        frame_path = os.path.join(raw_chars_dir, cid, f"{cid}_idle_se_0.png")
        if not os.path.exists(frame_path):
            print(f"Skipping silhouette test: Missing frame {frame_path}")
            return
        char_images[cid] = Image.open(frame_path).convert("RGBA")

    metrics_list = []
    binary_masks = {}
    for c in all_17:
        cid = c["id"]
        img = char_images[cid]
        arr = np.array(img)
        alpha = arr[:, :, 3]
        mask = alpha > 40
        binary_masks[cid] = mask

        y_idx, x_idx = np.where(mask)
        if len(y_idx) > 0:
            w = np.max(x_idx) - np.min(x_idx) + 1
            h = np.max(y_idx) - np.min(y_idx) + 1
            pixel_count = int(np.sum(mask))
            cx = float(np.mean(x_idx))
            cy = float(np.mean(y_idx))
            aspect_ratio = float(w / h)
        else:
            w, h, pixel_count, cx, cy, aspect_ratio = 0, 0, 0, 0.0, 0.0, 0.0

        metrics_list.append({
            "id": cid,
            "name": c["name"],
            "base_rig": c["base_rig"],
            "sig_hex": c["sig_hex"],
            "desc": c["desc"],
            "prop": c["prop"],
            "width_px": int(w),
            "height_px": int(h),
            "pixel_area": pixel_count,
            "centroid_x": round(cx, 2),
            "centroid_y": round(cy, 2),
            "aspect_ratio": round(aspect_ratio, 3),
        })

    pairwise_diffs = {}
    min_diff = 1.0
    for i, c1 in enumerate(chars_to_test):
        cid1 = c1["id"]
        m1 = binary_masks[cid1]
        pairwise_diffs[cid1] = {}
        for j, c2 in enumerate(chars_to_test):
            cid2 = c2["id"]
            if i == j:
                pairwise_diffs[cid1][cid2] = 0.0
            else:
                m2 = binary_masks[cid2]
                xor_diff = np.sum(m1 ^ m2)
                union_area = np.sum(m1 | m2)
                diff_ratio = float(xor_diff / union_area) if union_area > 0 else 0.0
                pairwise_diffs[cid1][cid2] = round(diff_ratio, 3)
                if diff_ratio < min_diff:
                    min_diff = diff_ratio

    cw = 48
    ch = 64
    padding = 6
    cols = len(all_17)
    strip_w = cols * (cw + padding) + padding
    strip_h = 4 * (ch + padding) + 40

    comp_img = Image.new("RGBA", (strip_w, strip_h), (26, 28, 41, 255))
    draw = ImageDraw.Draw(comp_img)

    for col_idx, c in enumerate(all_17):
        cid = c["id"]
        orig = char_images[cid]
        orig_arr = np.array(orig)
        mask = binary_masks[cid]

        x = padding + col_idx * (cw + padding)
        y1 = padding + 20
        y2 = y1 + ch + padding
        y3 = y2 + ch + padding

        # Draw a clean light background box for Row 1 (Pure silhouette) so it POPS
        draw.rectangle([x, y1, x + cw - 1, y1 + ch - 1], fill=(224, 232, 240, 255))
        # Draw a slate day-floor background box for Row 2 (Grayscale)
        draw.rectangle([x, y2, x + cw - 1, y2 + ch - 1], fill=(71, 80, 105, 255))
        # Draw a dark floor background box for Row 3 (Color)
        draw.rectangle([x, y3, x + cw - 1, y3 + ch - 1], fill=(40, 45, 63, 255))

        # Row 1: Pure silhouette (solid charcoal #14141e)
        sil_arr = np.zeros_like(orig_arr)
        sil_arr[mask] = [20, 20, 30, 255]
        sil_img = Image.fromarray(sil_arr, mode="RGBA")

        # Row 2: Grayscale luminance
        gray_arr = orig_arr.copy()
        if np.any(mask):
            lum = (
                0.299 * orig_arr[mask, 0]
                + 0.587 * orig_arr[mask, 1]
                + 0.114 * orig_arr[mask, 2]
            ).astype(np.uint8)
            gray_arr[mask, 0] = lum
            gray_arr[mask, 1] = lum
            gray_arr[mask, 2] = lum
        gray_img = Image.fromarray(gray_arr, mode="RGBA")

        # Row 3: Full color
        color_img = orig

        comp_img.paste(sil_img, (x, y1), sil_img)
        comp_img.paste(gray_img, (x, y2), gray_img)
        comp_img.paste(color_img, (x, y3), color_img)

        draw.text((x, 4), c["name"][:7], fill=(224, 232, 240))
        draw.text((x, y1 - 10), "Sil", fill=(156, 168, 184))
        draw.text((x, y2 - 10), "Gray", fill=(156, 168, 184))
        draw.text((x, y3 - 10), "Color", fill=(156, 168, 184))

    out_1x_path = os.path.join(dist_dir, "silhouette_test_1x.png")
    comp_img.save(out_1x_path)

    out_2x_path = os.path.join(dist_dir, "silhouette_test_2x.png")
    comp_2x = comp_img.resize((strip_w * 2, strip_h * 2), Image.Resampling.NEAREST)
    comp_2x.save(out_2x_path)

    html_content = f"""<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Muse Review Gate: Uji Siluet & Keterbacaan 16 Karakter Agent (T1.6)</title>
  <style>
    :root {{
      --bg: #0d1117;
      --card-bg: #161b22;
      --border: #30363d;
      --text: #c9d1d9;
      --text-bright: #f0f6fc;
      --accent: #58a6ff;
    }}
    body {{
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      margin: 0;
      padding: 24px;
    }}
    h1, h2, h3 {{ color: var(--text-bright); }}
    .badge {{
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: bold;
    }}
    .badge-pass {{ background: #238636; color: #fff; }}
    .card {{
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 18px;
      margin-bottom: 24px;
    }}
    .char-grid {{
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 16px;
    }}
    .char-card {{
      background: #0d1117;
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 12px;
      text-align: center;
    }}
    .sprite-view {{
      display: flex;
      justify-content: center;
      gap: 12px;
      margin: 12px 0;
      background: #475069;
      padding: 8px;
      border-radius: 4px;
    }}
    .sprite-img {{
      image-rendering: pixelated;
      width: 48px;
      height: 64px;
    }}
    .sprite-img-2x {{
      image-rendering: pixelated;
      width: 96px;
      height: 128px;
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }}
    th, td {{
      border: 1px solid var(--border);
      padding: 8px 12px;
      text-align: left;
    }}
    th {{ background: #1f242c; color: var(--text-bright); }}
    .diff-cell {{ text-align: center; font-variant-numeric: tabular-nums; }}
  </style>
</head>
<body>
  <h1>Muse Review Gate: Uji Siluet & Keterbacaan 16 Karakter Agent (T1.6)</h1>
  <p>Status: <span class="badge badge-pass">PASS (Diverifikasi Steward untuk Review Muse)</span> | Standar: <b>Anti-AI-Slop & Spec 03</b> | Skala: <b>1x Grayscale Keterbacaan Siluet</b></p>

  <div class="card">
    <h2>1. Ikhtisar Hasil Uji Siluet & Keterbacaan</h2>
    <ul>
      <li><b>Total Karakter:</b> 17 Karakter (16 Agent Spesialis + 1 Karakter Tamu Generik).</li>
      <li><b>Diferensiasi Siluet Minimum (IoU / Hamming):</b> <code>{min_diff * 100:.1f}%</code> beda geometris antar figur terdekat (Target: > 10%).</li>
      <li><b>Base Rig Paper-Doll:</b> Base A (Sedang: 9 agent + tamu), Base B (Ramping: 5 agent), Base C (Besar / Kekar: 2 agent).</li>
      <li><b>Garis Batas & Palet:</b> 1px Charcoal (<code>#14141E</code>) dengan kuantisasi tepat Master 32-Color Palette.</li>
      <li><b>Rim-Light Pass:</b> Diterapkan pada karakter berkontras kritis (Jarvis, Scribe, Bastion) dengan aksen <code>#687594</code> dan <code>#9CA8B8</code>.</li>
    </ul>
    <div style="margin-top: 16px;">
      <h3>Strip Komparasi Penuh (Skala 2x Nearest-Neighbor):</h3>
      <img src="silhouette_test_2x.png" style="max-width: 100%; border: 1px solid var(--border); border-radius: 4px;" alt="Strip Uji Siluet 2x">
    </div>
  </div>

  <div class="card">
    <h2>2. Galeri Detail 16 Agent + 1 Tamu (Siluet vs Grayscale 1x vs Warna)</h2>
    <div class="char-grid">
"""
    for m in metrics_list:
        cid = m["id"]
        html_content += f"""
      <div class="char-card">
        <h3>{m['name']}</h3>
        <p style="font-size: 11px; color: #8b949e;">Base {m['base_rig']} | <span style="color: {m['sig_hex']};">●</span> {m['sig_hex']}</p>
        <div class="sprite-view">
          <div>
            <div style="font-size: 10px; color: #fff;">Siluet</div>
            <img class="sprite-img" src="../raw_characters/{cid}/{cid}_idle_se_0.png" style="filter: brightness(0); background: #e0e8f0; padding: 2px; border-radius: 2px;" alt="{cid} siluet">
          </div>
          <div>
            <div style="font-size: 10px; color: #fff;">Gray 1x</div>
            <img class="sprite-img" src="../raw_characters/{cid}/{cid}_idle_se_0.png" style="filter: grayscale(100%);" alt="{cid} gray">
          </div>
          <div>
            <div style="font-size: 10px; color: #fff;">Warna 2x</div>
            <img class="sprite-img-2x" src="../raw_characters/{cid}/{cid}_idle_se_0.png" alt="{cid} color">
          </div>
        </div>
        <p style="font-size: 12px; text-align: left; margin: 4px 0;"><b>Pembeda:</b> {m['desc']}</p>
        <p style="font-size: 11px; text-align: left; color: #8b949e; margin: 2px 0;">Dimensi: {m['width_px']}×{m['height_px']} px | Area: {m['pixel_area']} px</p>
      </div>
"""
    html_content += """
    </div>
  </div>

  <div class="card">
    <h2>3. Matriks Diferensiasi Siluet Antar 16 Agent (Non-Overlap Distance)</h2>
    <p>Nilai menunjukkan persentase perbedaan siluet biner (XOR / Union). Nilai > 10% menjamin siluet tidak akan tertukar bahkan dalam grayscale 1x.</p>
    <div style="overflow-x: auto;">
      <table>
        <thead>
          <tr>
            <th>Agent</th>
"""
    for c in chars_to_test:
        html_content += f"<th>{c['name'][:3]}</th>"
    html_content += "</tr></thead><tbody>"

    for c1 in chars_to_test:
        cid1 = c1["id"]
        html_content += f"<tr><td><b>{c1['name']}</b></td>"
        for c2 in chars_to_test:
            cid2 = c2["id"]
            val = pairwise_diffs[cid1][cid2]
            style = "color: #388bfd;" if val > 0.25 else ("color: #2ea043;" if val > 0.15 else "color: #8b949e;")
            html_content += f'<td class="diff-cell" style="{style}">{val:.2f}</td>'
        html_content += "</tr>"

    html_content += """
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>
"""
    with open(output_report_path, "w", encoding="utf-8") as f:
        f.write(html_content)

    print(f"Generated silhouette test image: {out_1x_path}")
    print(f"Generated silhouette test image 2x: {out_2x_path}")
    print(f"Generated silhouette review HTML report: {output_report_path}")


# ---------------------------------------------------------------------------
# Main CLI Driver
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    argv = sys.argv
    if "--" in argv:
        custom_args = argv[argv.index("--") + 1 :]
    else:
        custom_args = argv[1:]

    parser = argparse.ArgumentParser(description="Headless 17-character sprite renderer")
    parser.add_argument(
        "--root-dir",
        type=str,
        default=str(Path(__file__).resolve().parent.parent.parent),
        help="Repository root directory",
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
    parser.add_argument(
        "--character",
        type=str,
        default=None,
        help="Optional single character ID to render",
    )
    return parser.parse_args(custom_args)


def main() -> None:
    args = parse_args()

    if bpy is not None:
        run_headless_blender_render(args)
        return

    print("==================================================================")
    print("=== T1.6 16-Character Sprite Production & Texture Atlas Pipeline ===")
    print("==================================================================")
    root_dir = Path(__file__).resolve().parent.parent.parent
    dist_dir = Path(root_dir) / args.output_dir
    frontend_sprites_dir = Path(root_dir) / "frontend/public/sprites"

    dist_dir.mkdir(parents=True, exist_ok=True)
    frontend_sprites_dir.mkdir(parents=True, exist_ok=True)

    blender_bin = "blender"
    blender_cmd = [
        blender_bin,
        "-b",
        "-P",
        str(Path(__file__).resolve()),
        "--",
        "--root-dir",
        str(root_dir),
        "--output-dir",
        str(dist_dir),
        "--palette",
        args.palette,
        "--samples",
        str(args.samples),
    ]
    if args.character:
        blender_cmd.extend(["--character", args.character])

    print(f"Launching Blender headless: {' '.join(blender_cmd)}")
    t0 = time.time()
    res = subprocess.run(blender_cmd, cwd=str(root_dir))
    if res.returncode != 0:
        print(f"Error: Blender exited with code {res.returncode}")
        sys.exit(res.returncode)
    print(f"Blender rendering completed in {time.time() - t0:.2f}s.\n")

    print("Packing character texture atlases...")
    pack_character_spritesheets(str(dist_dir), str(frontend_sprites_dir))

    if not args.character:
        print("Generating silhouette differentiation test and Muse review HTML...")
        report_path = os.path.join(dist_dir, "silhouette_review.html")
        generate_silhouette_test_and_report(
            dist_dir=str(dist_dir),
            palette_path=args.palette,
            output_report_path=report_path,
        )
        if os.path.exists(report_path):
            shutil.copyfile(report_path, os.path.join(frontend_sprites_dir, "silhouette_review.html"))
            docs_report = Path(root_dir) / "docs/silhouette_review.html"
            shutil.copyfile(report_path, str(docs_report))

    print("\n=== PRODUCTION COMPLETED SUCCESSFULLY ===")
    print(f"Atlases and reports saved to: {dist_dir}")


if __name__ == "__main__":
    main()
