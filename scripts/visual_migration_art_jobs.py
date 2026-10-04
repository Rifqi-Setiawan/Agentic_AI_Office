"""Generate map-derived art jobs and validate honest preview coverage. No renderer/install."""
import argparse
import hashlib
import importlib.util
import json
import re
from pathlib import Path
from visual_migration_contract import canonical

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs/visual-migration"
DIRECTIONS = ("se", "sw", "ne", "nw")

def build_jobs():
    source = ROOT / "art/pipeline/render_all_characters.py"
    spec = importlib.util.spec_from_file_location("office_character_pipeline", source)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    map_path = ROOT / "frontend/public/maps/floor1.tmj"
    layout = canonical(json.loads(map_path.read_text(encoding="utf-8")))
    roster_source = (ROOT / "frontend/src/world/simulation/roster.ts").read_text(encoding="utf-8")
    roster = re.findall(r"id: '([^']+)'", roster_source)
    assert sorted(roster) == sorted(c["id"] for c in module.CHARACTERS), "Roster/pipeline identity mismatch"
    return {
        "schemaVersion": 1, "styleVersion": "AO_CLAUDE_2P5D_V1", "finalArt": False,
        "projection": {"tileWidth":64,"tileHeight":32,"origin":[1088,64],"world":[2560,1440],
                       "cameraRotationDegrees":[60,0,45],"exportScale":2,"calibration":"pending Blender axis-marker render"},
        "mapSha256":hashlib.sha256(map_path.read_bytes()).hexdigest(),
        "directions":list(DIRECTIONS), "minimumAnimations":dict(module.ANIMATION_CONFIG),
        "characters":[{"id":c["id"],"identitySource":c,"requiredViews":list(DIRECTIONS),"status":"missing native four-view final art"} for c in module.CHARACTERS],
        "zones":[{"zone":z,"slots":[s for s in layout["slots"] if s.get("zone")==z["zone_id"]],
                  "doors":[d for d in layout["doors"] if z["zone_id"] in (d.get("from"),d.get("to"))],
                  "status":"baseline preview only; final layers/recomposition pending",
                  "layers":["static floor","back walls","split occluding furniture","door frames","front cutaway walls"]}
                 for z in layout["zones"]],
        "corridors":{"rows":[8,9,20,21],"allColumns":44,"mustRemainWalkable":True},
        "releaseGates":["native directions calibrated","all character identities reviewed","all zone layers recomposed",
                        "global occlusion browser checks","production provenance/freshness browser checks"],
    }

def coverage(jobs):
    result = {"finalArtReady":False,"characters":[],"missingGroups":0,"invalidRotatedFrames":[],
              "note":"Baseline-only data; a successful preview check does not approve release art."}
    for char in jobs["characters"]:
        cid=char["id"]
        atlas=json.loads((ROOT / f"frontend/public/sprites/characters/{cid}.json").read_text())
        missing=[]
        for action,count in jobs["minimumAnimations"].items():
            for direction in DIRECTIONS:
                expected=[f"{cid}_{action}_{direction}_{i}.png" for i in range(count)]
                if any(name not in atlas["frames"] for name in expected):
                    missing.append({"action":action,"direction":direction,"minimumFrames":count})
        result["characters"].append({"id":cid,"missing":missing})
        result["missingGroups"]+=len(missing)
        result["invalidRotatedFrames"] += [name for name,frame in atlas["frames"].items() if frame.get("rotated")]
    return result

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--preview",action="store_true",help="Report gaps without approving final art")
    args=parser.parse_args()
    jobs=build_jobs(); report=coverage(jobs)
    (DOCS/"art-jobs.json").write_text(json.dumps(jobs,indent=2),encoding="utf-8")
    (DOCS/"art-coverage.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
    print(json.dumps({"characters":len(jobs["characters"]),"zones":len(jobs["zones"]),
                      "missingAnimationDirectionGroups":report["missingGroups"],"finalArtReady":report["finalArtReady"]}))
    return 0 if args.preview else 1

if __name__=="__main__":
    raise SystemExit(main())
