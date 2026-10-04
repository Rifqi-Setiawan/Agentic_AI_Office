"""Opt-in native-view candidate renderer. Never writes the legacy/public atlases.

Planning works in ordinary Python. Rendering requires Blender and is deliberately
separate from packing, identity review, environment art and release acceptance.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import shutil
import sys
from pathlib import Path

import render_all_characters as legacy

ROOT = Path(__file__).resolve().parents[2]
STYLE = "AO_CLAUDE_2P5D_V1_CANDIDATE"
# Extend the source rig's actual SE/NE rotations; west views are rendered, never flipped.
# Labels must still pass the asymmetric-prop contact-sheet review.
DIRECTIONS = {"se": 90, "sw": 0, "ne": 180, "nw": 270}
SCALE = 2
LOGICAL_SIZE = (64, 96)
PIXELS_PER_UNIT = 32 / math.sqrt(.5)
ORTHO = LOGICAL_SIZE[1] / PIXELS_PER_UNIT


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def plan(character=None, sample=False):
    selected = [c for c in legacy.CHARACTERS if character is None or c["id"] == character]
    if not selected:
        raise ValueError(f"Unknown character: {character}")
    animations = dict(legacy.ANIMATION_CONFIG)
    if sample:
        animations = {a: animations[a] for a in ("idle", "walk", "sit_type")}
    jobs = []
    for char in selected:
        model = ROOT / "art/sumber/characters" / char["model"]
        if not model.is_file():
            raise FileNotFoundError(model)
        for direction, angle in DIRECTIONS.items():
            for action, count in animations.items():
                for frame in range(count):
                    jobs.append({"character": char["id"], "direction": direction,
                                 "rootBoneDegrees": angle, "action": action, "frame": frame,
                                 "file": f"{char['id']}/{char['id']}_{action}_{direction}_{frame}.png"})
    return {"schemaVersion": 1, "styleVersion": STYLE, "finalArt": False,
            "rendererSourceSha256": digest(__file__),
            "legacySourceSha256": digest(legacy.__file__),
            "logicalMapSha256": digest(ROOT / "frontend/public/maps/floor1.tmj"),
            "exportScale": SCALE, "logicalCanvas": LOGICAL_SIZE, "anchor": [.5, .92],
            "camera": {"rotationDegrees": [60, 0, 45], "orthoScale": ORTHO,
                       "logicalPixelsPerGroundUnit": PIXELS_PER_UNIT,
                       "gridToBlender": "(gx, -gy, height)", "calibration": "required before rendering"},
            "models": [{"id": c["id"], "source": f"art/sumber/characters/{c['model']}",
                        "sha256": digest(ROOT / "art/sumber/characters" / c["model"]),
                        "license": "Quaternius CC0; see LICENSES.md", "identity": c}
                       for c in selected],
            "sampleOnly": sample, "jobs": jobs,
            "pendingReviews": ["asymmetric accessories and four facing labels",
                               "identity silhouettes/materials", "foot anchors in scene",
                               "layered environment and browser acceptance"]}


def safe_output(value):
    output = Path(value).resolve()
    protected = [ROOT / "frontend/public", ROOT / "art/sumber", ROOT / "art/pipeline/dist"]
    for directory in protected:
        if output == directory or directory in output.parents:
            raise ValueError(f"Candidate output cannot overwrite {directory}")
    if output == ROOT or output in ROOT.parents:
        raise ValueError("An isolated candidate output directory is required")
    return output


def calibrate(output):
    """Measure rendered emission-marker centroids, not just camera equations."""
    bpy = legacy.bpy
    Vector = legacy.Vector
    bpy.ops.wm.read_factory_settings(use_empty=True)
    legacy.setup_blender_scene(samples=8)
    scene = bpy.context.scene
    scene.render.resolution_x = scene.render.resolution_y = 256
    scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = "Standard"
    legacy.setup_camera(Vector((0, 0, 0)), ortho_scale=256 * math.sqrt(.5) / 64)
    markers = [("origin", (0, 0, 0), (1, 1, 1)),
               ("gx", (1, 0, 0), (1, 0, 0)),
               ("gy", (0, -1, 0), (0, 1, 0)),
               ("up", (0, 0, 1), (0, 0, 1))]
    for name, location, color in markers:
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=.04, location=location)
        mat = bpy.data.materials.new(name)
        mat.use_nodes = True
        nodes = mat.node_tree.nodes
        nodes.clear()
        emission = nodes.new("ShaderNodeEmission")
        emission.inputs["Color"].default_value = (*color, 1)
        emission.inputs["Strength"].default_value = 1
        sink = nodes.new("ShaderNodeOutputMaterial")
        mat.node_tree.links.new(emission.outputs[0], sink.inputs["Surface"])
        bpy.context.object.data.materials.append(mat)
    path = output / "camera-markers.png"
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    image = bpy.data.images.load(str(path), check_existing=False)
    pixels = list(image.pixels[:])
    centers = {}
    for name, _, color in markers:
        points = []
        for index in range(256 * 256):
            r, g, b, a = pixels[index * 4:index * 4 + 4]
            rgb = (r, g, b)
            if a > .8 and all(v > .8 if c else v < .1 for v, c in zip(rgb, color)):
                points.append((index % 256 + .5, 255 - index // 256 + .5))
        if not points:
            raise RuntimeError(f"Calibration marker not visible: {name}")
        centers[name] = [sum(p[i] for p in points) / len(points) for i in range(2)]
    origin = centers["origin"]
    measured = {name: [p[i] - origin[i] for i in range(2)] for name, p in centers.items() if name != "origin"}
    expected = {"gx": [64, 32], "gy": [-64, 32], "up": [0, -2 * PIXELS_PER_UNIT * math.sqrt(.75)]}
    passed = all(abs(measured[name][i] - vector[i]) <= 1.25 for name, vector in expected.items() for i in range(2))
    report = {"passed": passed, "source": "PNG rendered marker centroids", "exportScale": 2,
              "expectedRasterVectors": expected, "measuredRasterVectors": measured,
              "toleranceRasterPixels": 1.25, "imageSha256": digest(path)}
    (output / "camera-calibration.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    bpy.data.images.remove(image)
    if not passed:
        raise RuntimeError("Camera calibration failed; refusing the character batch")


def studio_style():
    """Candidate finish: soft area light and continuous materials, no pixel quantization."""
    bpy = legacy.bpy
    scene = bpy.context.scene
    scene.view_settings.view_transform = "AgX"
    scene.world = bpy.data.worlds.new("CandidateStudio")
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = (.72, .78, .88, 1)
    scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = .35
    for name, location, power, size, color in [
        ("SoftKey", (-3, -4, 6), 450, 4, (1, .88, .72)),
        ("SoftFill", (3, 1, 4), 180, 3, (.72, .84, 1)),
    ]:
        data = bpy.data.lights.new(name, "AREA")
        data.energy, data.size, data.color = power, size, color
        light = bpy.data.objects.new(name, data)
        bpy.context.collection.objects.link(light)
        light.location = location
        light.rotation_euler = (-light.location).to_track_quat('-Z', 'Y').to_euler()
    # The legacy builder specifies sRGB hex values as node inputs. Convert those
    # inputs once to linear RGB for the continuous-color candidate render.
    for mat in bpy.data.materials:
        if not mat.use_nodes:
            continue
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            color = bsdf.inputs["Base Color"].default_value
            color[:3] = [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in color[:3]]
            bsdf.inputs["Roughness"].default_value = max(.35, bsdf.inputs["Roughness"].default_value)
    for obj in bpy.data.objects:
        if obj.type == "MESH" and obj.parent_type == "BONE" and len(obj.data.polygons) <= 6:
            bevel = obj.modifiers.new("CandidateEdge", "BEVEL")
            bevel.width, bevel.segments = .008, 2


def render_character(cid, jobs, output, samples):
    bpy, Vector = legacy.bpy, legacy.Vector
    info = next(c for c in legacy.CHARACTERS if c["id"] == cid)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    legacy.setup_blender_scene(samples=samples)
    scene = bpy.context.scene
    scene.render.resolution_x = LOGICAL_SIZE[0] * SCALE
    scene.render.resolution_y = LOGICAL_SIZE[1] * SCALE
    scene.render.resolution_percentage = 100
    # Ground origin projects to sourceCanvas (.5, .92); trim keeps this pivot.
    legacy.setup_camera(Vector((0, 0, .42 * ORTHO / math.sqrt(.75))), ORTHO)
    root, arm = legacy.build_character(info, str(ROOT / "art/sumber/characters"))
    studio_style()
    rest_pose = {bone.name: bone.matrix_basis.copy() for bone in arm.pose.bones}
    records = []
    for job in jobs:
        # Some baseline poses leave forearm rotations behind. Reset every bone
        # before each pose so results do not depend on render job ordering.
        for bone in arm.pose.bones:
            bone.matrix_basis = rest_pose[bone.name].copy()
        lift = legacy.apply_animation_frame(arm, job["action"], job["frame"], -math.radians(72), char_id=cid)
        bone = arm.pose.bones["Root"]
        bone.rotation_mode = "XYZ"
        bone.rotation_euler = (0, math.radians(job["rootBoneDegrees"]), 0)
        root.location.z = 0
        bpy.context.view_layer.update()
        graph = bpy.context.evaluated_depsgraph_get()
        meshes = [o for o in bpy.data.objects if o.type == "MESH"]
        floor = min((m.evaluated_get(graph).matrix_world @ Vector(c)).z for m in meshes for c in m.bound_box)
        root.location.z = -floor + lift
        bpy.context.view_layer.update()
        path = output / job["file"]
        path.parent.mkdir(exist_ok=True)
        scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
        image = bpy.data.images.load(str(path), check_existing=False)
        width, height = image.size
        pixels = list(image.pixels[:])
        edge = [x for x in range(width)] + [(height - 1) * width + x for x in range(width)]
        edge += [y * width for y in range(height)] + [y * width + width - 1 for y in range(height)]
        clipped = any(pixels[index * 4 + 3] > .01 for index in edge)
        visible = any(pixels[index] > .01 for index in range(3, len(pixels), 4))
        bpy.data.images.remove(image)
        if clipped or not visible:
            raise RuntimeError(f"Frame is clipped or empty; preserved for review: {path}")
        records.append({**job, "sha256": digest(path), "nativeView": True, "mirrored": False})
    # Retain the source pipeline's semantic aliases without a second render or
    # mirror. Their ledger names the exact already-rendered native source frame.
    aliases = []
    for direction in DIRECTIONS:
        for stage, action in enumerate(("pray_berdiri", "pray_rukuk", "pray_sujud", "pray_duduk")):
            aliases.append((f"{cid}_{action}_{direction}_0.png", f"{cid}_pray_{direction}_{stage}.png"))
        action = legacy.SIG_ACTION_MAP[cid]
        aliases.extend((f"{cid}_special_{direction}_{frame}.png", f"{cid}_{action}_{direction}_{frame}.png") for frame in range(2))
    for source_name, target_name in aliases:
        source = output / cid / source_name
        if source.is_file():
            target = output / cid / target_name
            shutil.copyfile(source, target)
            records.append({"file": f"{cid}/{target_name}", "aliasOf": f"{cid}/{source_name}",
                            "sha256": digest(target), "nativeView": True, "mirrored": False})
    (output / cid / "render-ledger.json").write_text(json.dumps({"finalArt": False, "frames": records}, indent=2), encoding="utf-8")


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--plan", action="store_true", help="Validate input models and write jobs without Blender")
    parser.add_argument("--character", choices=[c["id"] for c in legacy.CHARACTERS])
    parser.add_argument("--sample", action="store_true", help="Only idle/walk/sit_type; never final coverage")
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--samples", type=int, default=32)
    args = parser.parse_args(argv)
    if args.samples < 1:
        parser.error("samples must be positive")
    output = safe_output(args.output_dir)
    if output.exists() and any(output.iterdir()):
        parser.error("Use a fresh output directory; existing candidates are preserved")
    document = plan(args.character, args.sample)
    if not args.plan and legacy.bpy is None:
        parser.error("Blender is unavailable. --plan is preparation only; no render has run.")
    output.mkdir(parents=True, exist_ok=True)
    (output / "render-plan.json").write_text(json.dumps(document, indent=2), encoding="utf-8")
    if args.plan:
        print(json.dumps({"plannedFrames": len(document["jobs"]), "rendered": False, "finalArt": False}))
        return
    calibrate(output)
    for model in document["models"]:
        render_character(model["id"], [j for j in document["jobs"] if j["character"] == model["id"]], output, args.samples)
    print(json.dumps({"renderedFrames": len(document["jobs"]), "calibrationPassed": True, "finalArt": False}))


if __name__ == "__main__":
    main()
