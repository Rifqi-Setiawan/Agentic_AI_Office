"""Export repository facts for the handoff; never load runtime settings or Hermes files."""
from __future__ import annotations

import ast
import hashlib
import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs/reference/office-facts-20261005.json"


def read_json(rel: str) -> dict:
    return json.loads((ROOT / rel).read_text(encoding="utf-8"))


def props(obj: dict) -> dict:
    return {p["name"]: p["value"] for p in obj.get("properties", [])}


def main() -> None:
    map_path = "frontend/public/maps/floor1.tmj"
    roster_path = "frontend/src/world/simulation/roster.ts"
    profiles_path = "backend/src/office/sources/profiles.py"
    manifest_path = "frontend/public/visual-migration/environment-foundation-v1/assets.json"
    tiled = read_json(map_path)
    layers = {layer["name"]: layer for layer in tiled["layers"]}
    slots = [{"id": obj["name"], **props(obj)} for obj in layers["slots"]["objects"]]
    slot_lookup = {s["id"]: s for s in slots}
    zones = [props(obj) for obj in layers["zones"]["objects"]]
    slot_counts = Counter(s["zone"] for s in slots)
    for zone in zones:
        zone["slotCount"] = slot_counts[zone["zone_id"]]
    doors = [{"id": obj["name"], **props(obj)} for obj in layers["doors"]["objects"]]

    # Extract the literal only. Importing profiles would load application dependencies.
    profile_ast = ast.parse((ROOT / profiles_path).read_text(encoding="utf-8"))
    profile_node = next(n for n in profile_ast.body if isinstance(n, ast.AnnAssign)
                        and isinstance(n.target, ast.Name) and n.target.id == "STATIC_AGENT_METADATA")
    profiles = ast.literal_eval(profile_node.value)
    roster_text = (ROOT / roster_path).read_text(encoding="utf-8")
    roster = []
    for block in re.findall(r"\{\s*id: '(.*?)',([\s\S]*?)\n  \}", roster_text):
        agent_id, fields = block
        row = {"id": agent_id}
        for key, value in re.findall(r"(\w+): '([^']*)'", fields):
            row[key] = value
        for key, value in re.findall(r"(fallbackG[xy]): (\d+)", fields):
            row[key] = int(value)
        row["defaultSlot"] = slot_lookup.get(row["defaultSlotId"])
        row["defaultSlotExists"] = row["defaultSlot"] is not None
        row["profileMetadata"] = profiles.get(agent_id)
        roster.append(row)

    manifest = read_json(manifest_path)
    animations = {}
    for agent_id, atlas_url in manifest["characterOverrides"].items():
        atlas_rel = "frontend/public" + atlas_url
        atlas = read_json(atlas_rel)
        counts: dict[str, dict[str, int]] = {}
        for filename in atlas["frames"]:
            action, direction, _ = filename.removeprefix(agent_id + "_").removesuffix(".png").rsplit("_", 2)
            counts.setdefault(action, {}).setdefault(direction.upper(), 0)
            counts[action][direction.upper()] += 1
        animations[agent_id] = {"atlas": atlas_rel, "frameCount": len(atlas["frames"]), "actions": counts}
    assert (tiled["width"], tiled["height"], len(zones), len(slots), len(doors), len(roster), len(profiles)) == (44, 32, 17, 133, 26, 17, 16)
    sources = [map_path, roster_path, profiles_path, manifest_path] + [v["atlas"] for v in animations.values()]
    facts = {
        "snapshotDate": "2026-10-05",
        "scope": "repository facts; not an inventory of live Hermes registrations",
        "sourceSha256": {p: hashlib.sha256((ROOT / p).read_bytes()).hexdigest() for p in sources},
        "map": {"width": tiled["width"], "height": tiled["height"], "tileWidth": tiled["tilewidth"],
                "tileHeight": tiled["tileheight"], "layers": list(layers), "zones": zones, "doors": doors, "slots": slots},
        "roster": roster,
        "visibleCharacterAnimations": animations,
        "styleVersion": manifest["styleVersion"],
        "finalArt": manifest["finalArt"],
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(facts, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(OUTPUT.relative_to(ROOT)), "zones": len(zones), "slots": len(slots),
                      "doors": len(doors), "spawnEntries": len(roster), "profileIdentities": len(profiles),
                      "visibleAtlases": animations}, ensure_ascii=False))


if __name__ == "__main__":
    main()
