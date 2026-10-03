#!/usr/bin/env python3
"""Generator script for frontend/public/maps/floor1.tmj
Builds a Tiled 1.10 dimetric 2:1 map (44x32 tiles, 64x32 px grid) with 17 zones,
8 layers, and full interaction slot objects as specified in Blueprint Section 4.
"""

import json
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
ENV_JSON_PATH = ROOT_DIR / "frontend" / "public" / "sprites" / "environment.json"
TMJ_OUT_PATH = ROOT_DIR / "frontend" / "public" / "maps" / "floor1.tmj"
TSJ_OUT_PATH = ROOT_DIR / "frontend" / "public" / "maps" / "environment.tsj"

MAP_WIDTH = 44
MAP_HEIGHT = 32
TILE_WIDTH = 64
TILE_HEIGHT = 32

with open(ENV_JSON_PATH, "r", encoding="utf-8") as f:
    env_data = json.load(f)

frame_names = sorted(list(env_data.get("frames", {}).keys()))

# GID mapping (firstgid = 1)
sprite_to_gid = {name: idx + 1 for idx, name in enumerate(frame_names)}
gid_to_sprite = {idx + 1: name for idx, name in enumerate(frame_names)}

# Add collision tile as GID 123
COLLISION_GID = len(frame_names) + 1  # 123
COLLISION_TILE_ID = len(frame_names)   # 122

def get_gid(sprite_name: str) -> int:
    if sprite_name not in sprite_to_gid:
        raise ValueError(f"Unknown sprite name: {sprite_name}")
    return sprite_to_gid[sprite_name]

# 17 Zones definition
ZONES_DEF = [
    {"id": "Z01", "name": "Ruang CEO", "resident": "Jarvis", "gx_min": 0, "gx_max": 9, "gy_min": 0, "gy_max": 7, "floor": "tile_floor_z01_ceo.png"},
    {"id": "Z02", "name": "Boardroom", "resident": "Rapat", "gx_min": 10, "gx_max": 19, "gy_min": 0, "gy_max": 7, "floor": "tile_floor_z02_boardroom.png"},
    {"id": "Z03", "name": "Ruang Arsitektur", "resident": "Daedalus", "gx_min": 20, "gx_max": 27, "gy_min": 0, "gy_max": 7, "floor": "tile_floor_z03_architecture.png"},
    {"id": "Z04", "name": "Ruang Kelas", "resident": "Merlin", "gx_min": 28, "gx_max": 34, "gy_min": 0, "gy_max": 7, "floor": "tile_floor_z04_classroom.png"},
    {"id": "Z05", "name": "Perpustakaan", "resident": "Scribe", "gx_min": 35, "gx_max": 43, "gy_min": 0, "gy_max": 7, "floor": "tile_floor_z05_library.png"},
    {"id": "Z06", "name": "Lab Riset", "resident": "Oracle", "gx_min": 0, "gx_max": 8, "gy_min": 10, "gy_max": 19, "floor": "tile_floor_z06_lab.png"},
    {"id": "Z07", "name": "Studio Desain", "resident": "Muse", "gx_min": 9, "gx_max": 15, "gy_min": 10, "gy_max": 19, "floor": "tile_floor_z07_design.png"},
    {"id": "Z08", "name": "Dev Pods", "resident": "Prism, Forge, Nova", "gx_min": 16, "gx_max": 23, "gy_min": 10, "gy_max": 19, "floor": "tile_floor_z08_dev_pods.png"},
    {"id": "Z09", "name": "Graphics Lab", "resident": "Steward", "gx_min": 24, "gx_max": 27, "gy_min": 10, "gy_max": 19, "floor": "tile_floor_z09_graphics_lab.png"},
    {"id": "Z10", "name": "QA Station", "resident": "Sentinel", "gx_min": 28, "gx_max": 31, "gy_min": 10, "gy_max": 19, "floor": "tile_floor_z10_qa_station.png"},
    {"id": "Z11", "name": "Release Dock", "resident": "Relay", "gx_min": 32, "gx_max": 35, "gy_min": 10, "gy_max": 19, "floor": "tile_floor_z11_release_dock.png"},
    {"id": "Z12", "name": "Data Center & SOC", "resident": "Vector, Bastion", "gx_min": 36, "gx_max": 43, "gy_min": 10, "gy_max": 19, "floor": "tile_floor_z12_datacenter.png"},
    {"id": "Z13", "name": "Lobi", "resident": "Warden", "gx_min": 0, "gx_max": 9, "gy_min": 22, "gy_max": 31, "floor": "tile_floor_z13_lobby.png"},
    {"id": "Z14", "name": "Kafetaria & Lounge", "resident": "Semua", "gx_min": 10, "gx_max": 21, "gy_min": 22, "gy_max": 31, "floor": "tile_floor_z14_cafeteria.png"},
    {"id": "Z15", "name": "Arcade", "resident": "Semua", "gx_min": 22, "gx_max": 29, "gy_min": 22, "gy_max": 31, "floor": "tile_floor_z15_arcade.png"},
    {"id": "Z16", "name": "Musholla", "resident": "Semua", "gx_min": 30, "gx_max": 36, "gy_min": 22, "gy_max": 31, "floor": "tile_floor_z16_musholla.png"},
    {"id": "Z17", "name": "Kolam luar", "resident": "Semua", "gx_min": 37, "gx_max": 43, "gy_min": 22, "gy_max": 31, "floor": "tile_floor_z17_pool_deck.png"},
]

# Doors definition
DOORS_DEF = [
    # Row 1 South Doors (to North Corridor gy 8..9)
    {"name": "door_z01", "from": "Z01", "to": "corridor_north", "gx": 5, "gy": 7},
    {"name": "door_z02", "from": "Z02", "to": "corridor_north", "gx": 15, "gy": 7},
    {"name": "door_z03", "from": "Z03", "to": "corridor_north", "gx": 23, "gy": 7},
    {"name": "door_z04", "from": "Z04", "to": "corridor_north", "gx": 31, "gy": 7},
    {"name": "door_z05", "from": "Z05", "to": "corridor_north", "gx": 39, "gy": 7},

    # Row 2 North Doors (to North Corridor gy 8..9)
    {"name": "door_z06_north", "from": "Z06", "to": "corridor_north", "gx": 4, "gy": 10},
    {"name": "door_z07_north", "from": "Z07", "to": "corridor_north", "gx": 12, "gy": 10},
    {"name": "door_z08_north", "from": "Z08", "to": "corridor_north", "gx": 19, "gy": 10},
    {"name": "door_z09_north", "from": "Z09", "to": "corridor_north", "gx": 25, "gy": 10},
    {"name": "door_z10_north", "from": "Z10", "to": "corridor_north", "gx": 29, "gy": 10},
    {"name": "door_z11_north", "from": "Z11", "to": "corridor_north", "gx": 33, "gy": 10},
    {"name": "door_z12_north", "from": "Z12", "to": "corridor_north", "gx": 39, "gy": 10},

    # Row 2 South Doors (to South Corridor gy 20..21)
    {"name": "door_z06_south", "from": "Z06", "to": "corridor_south", "gx": 4, "gy": 19},
    {"name": "door_z07_south", "from": "Z07", "to": "corridor_south", "gx": 12, "gy": 19},
    {"name": "door_z08_south", "from": "Z08", "to": "corridor_south", "gx": 19, "gy": 19},
    {"name": "door_z09_south", "from": "Z09", "to": "corridor_south", "gx": 25, "gy": 19},
    {"name": "door_z10_south", "from": "Z10", "to": "corridor_south", "gx": 29, "gy": 19},
    {"name": "door_z11_south", "from": "Z11", "to": "corridor_south", "gx": 33, "gy": 19},
    {"name": "door_z12_south", "from": "Z12", "to": "corridor_south", "gx": 39, "gy": 19},

    # Production line connecting doors (Row 2 internal)
    {"name": "door_prod_z08_z09", "from": "Z08", "to": "Z09", "gx": 23, "gy": 14},
    {"name": "door_prod_z09_z10", "from": "Z09", "to": "Z10", "gx": 27, "gy": 14},
    {"name": "door_prod_z10_z11", "from": "Z10", "to": "Z11", "gx": 31, "gy": 14},
    {"name": "door_prod_z11_z12", "from": "Z11", "to": "Z12", "gx": 35, "gy": 14},

    # Row 3 Doors
    {"name": "door_z16_north", "from": "Z16", "to": "corridor_south", "gx": 33, "gy": 22},
    {"name": "door_z17_north", "from": "Z17", "to": "corridor_south", "gx": 39, "gy": 22},
    {"name": "door_lobby_entrance", "from": "Z13", "to": "outside", "gx": 4, "gy": 31},
]

door_positions = {(d["gx"], d["gy"]) for d in DOORS_DEF}

# All 116 Slots from Blueprint Section 4 table
SLOTS_DEF = [
    # Z01 Ruang CEO (0..9, 0..7) - Jarvis
    {"id": "slot_z01_desk_jarvis", "zone": "Z01", "type": "desk:jarvis", "capacity": 1, "gx": 4, "gy": 3, "facing": "SE", "anim": "sit_type", "y_offset": -6},
    {"id": "slot_z01_sofa_1", "zone": "Z01", "type": "sofa", "capacity": 1, "gx": 1, "gy": 5, "facing": "SE", "anim": "sit_type", "y_offset": -4},
    {"id": "slot_z01_sofa_2", "zone": "Z01", "type": "sofa", "capacity": 1, "gx": 2, "gy": 5, "facing": "SE", "anim": "sit_type", "y_offset": -4},
    {"id": "slot_z01_door_queue_1", "zone": "Z01", "type": "door_queue", "capacity": 1, "gx": 4, "gy": 6, "facing": "SE", "anim": "idle", "y_offset": 0},
    {"id": "slot_z01_door_queue_2", "zone": "Z01", "type": "door_queue", "capacity": 1, "gx": 5, "gy": 6, "facing": "SE", "anim": "idle", "y_offset": 0},
    {"id": "slot_z01_door_queue_3", "zone": "Z01", "type": "door_queue", "capacity": 1, "gx": 6, "gy": 6, "facing": "SE", "anim": "idle", "y_offset": 0},

    # Z02 Boardroom (10..19, 0..7) - Rapat
    {"id": "slot_z02_presenter", "zone": "Z02", "type": "presenter", "capacity": 1, "gx": 11, "gy": 2, "facing": "SW", "anim": "stand_talk", "y_offset": 0},
    {"id": "slot_z02_seat_1", "zone": "Z02", "type": "meeting_seat", "capacity": 1, "gx": 13, "gy": 2, "facing": "SE", "anim": "sit_type", "y_offset": -4},
    {"id": "slot_z02_seat_2", "zone": "Z02", "type": "meeting_seat", "capacity": 1, "gx": 14, "gy": 2, "facing": "SE", "anim": "sit_type", "y_offset": -4},
    {"id": "slot_z02_seat_3", "zone": "Z02", "type": "meeting_seat", "capacity": 1, "gx": 15, "gy": 2, "facing": "SE", "anim": "sit_type", "y_offset": -4},
    {"id": "slot_z02_seat_4", "zone": "Z02", "type": "meeting_seat", "capacity": 1, "gx": 16, "gy": 2, "facing": "SE", "anim": "sit_type", "y_offset": -4},
    {"id": "slot_z02_seat_5", "zone": "Z02", "type": "meeting_seat", "capacity": 1, "gx": 12, "gy": 3, "facing": "NE", "anim": "sit_type", "y_offset": -4},
    {"id": "slot_z02_seat_6", "zone": "Z02", "type": "meeting_seat", "capacity": 1, "gx": 12, "gy": 4, "facing": "NE", "anim": "sit_type", "y_offset": -4},
    {"id": "slot_z02_seat_7", "zone": "Z02", "type": "meeting_seat", "capacity": 1, "gx": 17, "gy": 3, "facing": "SW", "anim": "sit_type", "y_offset": -4},
    {"id": "slot_z02_seat_8", "zone": "Z02", "type": "meeting_seat", "capacity": 1, "gx": 17, "gy": 4, "facing": "SW", "anim": "sit_type", "y_offset": -4},
    {"id": "slot_z02_seat_9", "zone": "Z02", "type": "meeting_seat", "capacity": 1, "gx": 13, "gy": 5, "facing": "NW", "anim": "sit_type", "y_offset": -4},
    {"id": "slot_z02_seat_10", "zone": "Z02", "type": "meeting_seat", "capacity": 1, "gx": 14, "gy": 5, "facing": "NW", "anim": "sit_type", "y_offset": -4},
    {"id": "slot_z02_seat_11", "zone": "Z02", "type": "meeting_seat", "capacity": 1, "gx": 15, "gy": 5, "facing": "NW", "anim": "sit_type", "y_offset": -4},
    {"id": "slot_z02_seat_12", "zone": "Z02", "type": "meeting_seat", "capacity": 1, "gx": 16, "gy": 5, "facing": "NW", "anim": "sit_type", "y_offset": -4},

    # Z03 Ruang Arsitektur (20..27, 0..7) - Daedalus
    {"id": "slot_z03_desk_daedalus", "zone": "Z03", "type": "desk:daedalus", "capacity": 1, "gx": 23, "gy": 3, "facing": "SE", "anim": "sit_type", "y_offset": -6},
    {"id": "slot_z03_bp_1", "zone": "Z03", "type": "blueprint_table", "capacity": 1, "gx": 21, "gy": 5, "facing": "NE", "anim": "sit_type", "y_offset": -4},
    {"id": "slot_z03_bp_2", "zone": "Z03", "type": "blueprint_table", "capacity": 1, "gx": 25, "gy": 5, "facing": "NW", "anim": "sit_type", "y_offset": -4},

    # Z04 Ruang Kelas (28..34, 0..7) - Merlin
    {"id": "slot_z04_whiteboard", "zone": "Z04", "type": "whiteboard", "capacity": 1, "gx": 31, "gy": 2, "facing": "SW", "anim": "stand_talk", "y_offset": 0},
    {"id": "slot_z04_seat_1", "zone": "Z04", "type": "class_seat", "capacity": 1, "gx": 29, "gy": 4, "facing": "NE", "anim": "sit_type", "y_offset": -4},
    {"id": "slot_z04_seat_2", "zone": "Z04", "type": "class_seat", "capacity": 1, "gx": 31, "gy": 4, "facing": "NE", "anim": "sit_type", "y_offset": -4},
    {"id": "slot_z04_seat_3", "zone": "Z04", "type": "class_seat", "capacity": 1, "gx": 33, "gy": 4, "facing": "NE", "anim": "sit_type", "y_offset": -4},
    {"id": "slot_z04_seat_4", "zone": "Z04", "type": "class_seat", "capacity": 1, "gx": 29, "gy": 5, "facing": "NE", "anim": "sit_type", "y_offset": -4},
    {"id": "slot_z04_seat_5", "zone": "Z04", "type": "class_seat", "capacity": 1, "gx": 31, "gy": 5, "facing": "NE", "anim": "sit_type", "y_offset": -4},
    {"id": "slot_z04_seat_6", "zone": "Z04", "type": "class_seat", "capacity": 1, "gx": 33, "gy": 5, "facing": "NE", "anim": "sit_type", "y_offset": -4},

    # Z05 Perpustakaan (35..43, 0..7) - Scribe
    {"id": "slot_z05_desk_scribe", "zone": "Z05", "type": "desk:scribe", "capacity": 1, "gx": 36, "gy": 4, "facing": "SE", "anim": "sit_type", "y_offset": -6},
    {"id": "slot_z05_browse_1", "zone": "Z05", "type": "bookshelf_browse", "capacity": 1, "gx": 37, "gy": 2, "facing": "NW", "anim": "idle", "y_offset": 0},
    {"id": "slot_z05_browse_2", "zone": "Z05", "type": "bookshelf_browse", "capacity": 1, "gx": 39, "gy": 2, "facing": "NW", "anim": "idle", "y_offset": 0},
    {"id": "slot_z05_browse_3", "zone": "Z05", "type": "bookshelf_browse", "capacity": 1, "gx": 41, "gy": 2, "facing": "NW", "anim": "idle", "y_offset": 0},
    {"id": "slot_z05_chair_1", "zone": "Z05", "type": "reading_chair", "capacity": 1, "gx": 40, "gy": 4, "facing": "SE", "anim": "sit_type", "y_offset": -4},
    {"id": "slot_z05_chair_2", "zone": "Z05", "type": "reading_chair", "capacity": 1, "gx": 41, "gy": 4, "facing": "SE", "anim": "sit_type", "y_offset": -4},

    # Z06 Lab Riset (0..8, 10..19) - Oracle
    {"id": "slot_z06_desk_oracle", "zone": "Z06", "type": "desk:oracle", "capacity": 1, "gx": 6, "gy": 13, "facing": "SE", "anim": "sit_type", "y_offset": -6},
    {"id": "slot_z06_bench_1", "zone": "Z06", "type": "lab_bench", "capacity": 1, "gx": 2, "gy": 13, "facing": "NW", "anim": "stand_talk", "y_offset": 0},
    {"id": "slot_z06_bench_2", "zone": "Z06", "type": "lab_bench", "capacity": 1, "gx": 2, "gy": 17, "facing": "NW", "anim": "stand_talk", "y_offset": 0},
    {"id": "slot_z06_whiteboard", "zone": "Z06", "type": "whiteboard", "capacity": 1, "gx": 2, "gy": 15, "facing": "NW", "anim": "stand_talk", "y_offset": 0},

    # Z07 Studio Desain (9..15, 10..19) - Muse
    {"id": "slot_z07_desk_muse", "zone": "Z07", "type": "desk:muse", "capacity": 1, "gx": 10, "gy": 13, "facing": "SE", "anim": "sit_type", "y_offset": -6},
    {"id": "slot_z07_moodboard", "zone": "Z07", "type": "moodboard", "capacity": 1, "gx": 13, "gy": 14, "facing": "NE", "anim": "idle", "y_offset": 0},

    # Z08 Dev Pods (16..23, 10..19) - Prism, Forge, Nova
    {"id": "slot_z08_desk_prism", "zone": "Z08", "type": "desk:prism", "capacity": 1, "gx": 17, "gy": 12, "facing": "SE", "anim": "sit_type", "y_offset": -6},
    {"id": "slot_z08_desk_forge", "zone": "Z08", "type": "desk:forge", "capacity": 1, "gx": 17, "gy": 14, "facing": "SE", "anim": "sit_type", "y_offset": -6},
    {"id": "slot_z08_desk_nova", "zone": "Z08", "type": "desk:nova", "capacity": 1, "gx": 17, "gy": 16, "facing": "SE", "anim": "sit_type", "y_offset": -6},
    {"id": "slot_z08_desk_guest", "zone": "Z08", "type": "desk:guest", "capacity": 1, "gx": 17, "gy": 18, "facing": "SE", "anim": "sit_type", "y_offset": -6},
    {"id": "slot_z08_pair_1", "zone": "Z08", "type": "pair_stand", "capacity": 1, "gx": 21, "gy": 13, "facing": "NW", "anim": "stand_talk", "y_offset": 0},
    {"id": "slot_z08_pair_2", "zone": "Z08", "type": "pair_stand", "capacity": 1, "gx": 21, "gy": 17, "facing": "NW", "anim": "stand_talk", "y_offset": 0},

    # Z09 Graphics Lab (24..27, 10..19) - Steward
    {"id": "slot_z09_desk_steward", "zone": "Z09", "type": "desk:steward", "capacity": 1, "gx": 25, "gy": 12, "facing": "SE", "anim": "sit_type", "y_offset": -6},
    {"id": "slot_z09_tile_repair", "zone": "Z09", "type": "tile_repair", "capacity": 1, "gx": 25, "gy": 16, "facing": "SE", "anim": "idle", "y_offset": 0},

    # Z10 QA Station (28..31, 10..19) - Sentinel
    {"id": "slot_z10_desk_sentinel", "zone": "Z10", "type": "desk:sentinel", "capacity": 1, "gx": 29, "gy": 12, "facing": "SE", "anim": "sit_type", "y_offset": -6},
    {"id": "slot_z10_inspect", "zone": "Z10", "type": "inspect_stand", "capacity": 1, "gx": 29, "gy": 16, "facing": "NE", "anim": "stand_talk", "y_offset": 0},

    # Z11 Release Dock (32..35, 10..19) - Relay
    {"id": "slot_z11_desk_relay", "zone": "Z11", "type": "desk:relay", "capacity": 1, "gx": 33, "gy": 12, "facing": "SE", "anim": "sit_type", "y_offset": -6},
    {"id": "slot_z11_parcel_1", "zone": "Z11", "type": "parcel_rack", "capacity": 1, "gx": 33, "gy": 16, "facing": "NW", "anim": "idle", "y_offset": 0},
    {"id": "slot_z11_parcel_2", "zone": "Z11", "type": "parcel_rack", "capacity": 1, "gx": 33, "gy": 18, "facing": "NW", "anim": "idle", "y_offset": 0},

    # Z12 Data Center & SOC (36..43, 10..19) - Vector, Bastion
    {"id": "slot_z12_desk_vector", "zone": "Z12", "type": "desk:vector", "capacity": 1, "gx": 37, "gy": 13, "facing": "SE", "anim": "sit_type", "y_offset": -6},
    {"id": "slot_z12_desk_bastion", "zone": "Z12", "type": "desk:bastion", "capacity": 1, "gx": 41, "gy": 13, "facing": "SE", "anim": "sit_type", "y_offset": -6},
    {"id": "slot_z12_rack_1", "zone": "Z12", "type": "rack_inspect", "capacity": 1, "gx": 38, "gy": 16, "facing": "NW", "anim": "idle", "y_offset": 0},
    {"id": "slot_z12_rack_2", "zone": "Z12", "type": "rack_inspect", "capacity": 1, "gx": 38, "gy": 17, "facing": "NW", "anim": "idle", "y_offset": 0},
    {"id": "slot_z12_rack_3", "zone": "Z12", "type": "rack_inspect", "capacity": 1, "gx": 41, "gy": 16, "facing": "NE", "anim": "idle", "y_offset": 0},
    {"id": "slot_z12_rack_4", "zone": "Z12", "type": "rack_inspect", "capacity": 1, "gx": 41, "gy": 17, "facing": "NE", "anim": "idle", "y_offset": 0},

    # Z13 Lobi (0..9, 22..31) - Warden
    {"id": "slot_z13_desk_warden", "zone": "Z13", "type": "desk:warden", "capacity": 1, "gx": 4, "gy": 25, "facing": "SE", "anim": "sit_type", "y_offset": -6},
    {"id": "slot_z13_attendance", "zone": "Z13", "type": "attendance_board", "capacity": 1, "gx": 2, "gy": 25, "facing": "NW", "anim": "stand_talk", "y_offset": 0},
    {"id": "slot_z13_spawn", "zone": "Z13", "type": "spawn", "capacity": 1, "gx": 4, "gy": 30, "facing": "NE", "anim": "walk", "y_offset": 0},

    # Z14 Kafetaria & Lounge (10..21, 22..31) - Semua
    {"id": "slot_z14_seat_1", "zone": "Z14", "type": "cafe_seat", "capacity": 1, "gx": 11, "gy": 27, "facing": "SE", "anim": "sit_type", "y_offset": -4},
    {"id": "slot_z14_seat_2", "zone": "Z14", "type": "cafe_seat", "capacity": 1, "gx": 11, "gy": 29, "facing": "NW", "anim": "sit_type", "y_offset": -4},
    {"id": "slot_z14_seat_3", "zone": "Z14", "type": "cafe_seat", "capacity": 1, "gx": 14, "gy": 27, "facing": "SE", "anim": "sit_type", "y_offset": -4},
    {"id": "slot_z14_seat_4", "zone": "Z14", "type": "cafe_seat", "capacity": 1, "gx": 14, "gy": 29, "facing": "NW", "anim": "sit_type", "y_offset": -4},
    {"id": "slot_z14_seat_5", "zone": "Z14", "type": "cafe_seat", "capacity": 1, "gx": 17, "gy": 27, "facing": "SE", "anim": "sit_type", "y_offset": -4},
    {"id": "slot_z14_seat_6", "zone": "Z14", "type": "cafe_seat", "capacity": 1, "gx": 17, "gy": 29, "facing": "NW", "anim": "sit_type", "y_offset": -4},
    {"id": "slot_z14_seat_7", "zone": "Z14", "type": "cafe_seat", "capacity": 1, "gx": 20, "gy": 27, "facing": "SE", "anim": "sit_type", "y_offset": -4},
    {"id": "slot_z14_seat_8", "zone": "Z14", "type": "cafe_seat", "capacity": 1, "gx": 20, "gy": 29, "facing": "NW", "anim": "sit_type", "y_offset": -4},
    {"id": "slot_z14_queue_1", "zone": "Z14", "type": "counter_queue", "capacity": 1, "gx": 12, "gy": 25, "facing": "NW", "anim": "stand_talk", "y_offset": 0},
    {"id": "slot_z14_queue_2", "zone": "Z14", "type": "counter_queue", "capacity": 1, "gx": 13, "gy": 25, "facing": "NW", "anim": "stand_talk", "y_offset": 0},
    {"id": "slot_z14_queue_3", "zone": "Z14", "type": "counter_queue", "capacity": 1, "gx": 14, "gy": 25, "facing": "NW", "anim": "stand_talk", "y_offset": 0},
    {"id": "slot_z14_sofa_1", "zone": "Z14", "type": "lounge_sofa", "capacity": 1, "gx": 17, "gy": 24, "facing": "SE", "anim": "sit_type", "y_offset": -4},
    {"id": "slot_z14_sofa_2", "zone": "Z14", "type": "lounge_sofa", "capacity": 1, "gx": 18, "gy": 24, "facing": "SE", "anim": "sit_type", "y_offset": -4},
    {"id": "slot_z14_sofa_3", "zone": "Z14", "type": "lounge_sofa", "capacity": 1, "gx": 19, "gy": 24, "facing": "SE", "anim": "sit_type", "y_offset": -4},
    {"id": "slot_z14_sofa_4", "zone": "Z14", "type": "lounge_sofa", "capacity": 1, "gx": 20, "gy": 24, "facing": "SE", "anim": "sit_type", "y_offset": -4},

    # Z15 Arcade (22..29, 22..31) - Semua
    {"id": "slot_z15_arcade_1", "zone": "Z15", "type": "arcade", "capacity": 1, "gx": 23, "gy": 24, "facing": "NW", "anim": "stand_talk", "y_offset": 0},
    {"id": "slot_z15_arcade_2", "zone": "Z15", "type": "arcade", "capacity": 1, "gx": 24, "gy": 24, "facing": "NW", "anim": "stand_talk", "y_offset": 0},
    {"id": "slot_z15_arcade_3", "zone": "Z15", "type": "arcade", "capacity": 1, "gx": 25, "gy": 24, "facing": "NW", "anim": "stand_talk", "y_offset": 0},
    {"id": "slot_z15_billiard_1", "zone": "Z15", "type": "billiard", "capacity": 1, "gx": 26, "gy": 25, "facing": "SE", "anim": "stand_talk", "y_offset": 0},
    {"id": "slot_z15_billiard_2", "zone": "Z15", "type": "billiard", "capacity": 1, "gx": 29, "gy": 26, "facing": "NW", "anim": "stand_talk", "y_offset": 0},
    {"id": "slot_z15_beanbag_1", "zone": "Z15", "type": "beanbag", "capacity": 1, "gx": 24, "gy": 28, "facing": "SE", "anim": "sit_type", "y_offset": -4},
    {"id": "slot_z15_beanbag_2", "zone": "Z15", "type": "beanbag", "capacity": 1, "gx": 26, "gy": 28, "facing": "SE", "anim": "sit_type", "y_offset": -4},
    {"id": "slot_z15_beanbag_3", "zone": "Z15", "type": "beanbag", "capacity": 1, "gx": 28, "gy": 28, "facing": "SE", "anim": "sit_type", "y_offset": -4},

    # Z16 Musholla (30..36, 22..31) - Semua
    {"id": "slot_z16_imam", "zone": "Z16", "type": "imam", "capacity": 1, "gx": 33, "gy": 26, "facing": "NW", "anim": "pray", "y_offset": 0},
    # Shaf 1 (8 slots, gy=27..28)
    {"id": "slot_z16_shaf1_1", "zone": "Z16", "type": "prayer_row", "capacity": 1, "gx": 30, "gy": 27, "facing": "NW", "anim": "pray", "y_offset": 0},
    {"id": "slot_z16_shaf1_2", "zone": "Z16", "type": "prayer_row", "capacity": 1, "gx": 31, "gy": 27, "facing": "NW", "anim": "pray", "y_offset": 0},
    {"id": "slot_z16_shaf1_3", "zone": "Z16", "type": "prayer_row", "capacity": 1, "gx": 32, "gy": 27, "facing": "NW", "anim": "pray", "y_offset": 0},
    {"id": "slot_z16_shaf1_4", "zone": "Z16", "type": "prayer_row", "capacity": 1, "gx": 33, "gy": 27, "facing": "NW", "anim": "pray", "y_offset": 0},
    {"id": "slot_z16_shaf1_5", "zone": "Z16", "type": "prayer_row", "capacity": 1, "gx": 34, "gy": 27, "facing": "NW", "anim": "pray", "y_offset": 0},
    {"id": "slot_z16_shaf1_6", "zone": "Z16", "type": "prayer_row", "capacity": 1, "gx": 35, "gy": 27, "facing": "NW", "anim": "pray", "y_offset": 0},
    {"id": "slot_z16_shaf1_7", "zone": "Z16", "type": "prayer_row", "capacity": 1, "gx": 36, "gy": 27, "facing": "NW", "anim": "pray", "y_offset": 0},
    {"id": "slot_z16_shaf1_8", "zone": "Z16", "type": "prayer_row", "capacity": 1, "gx": 33, "gy": 28, "facing": "NW", "anim": "pray", "y_offset": 0},
    # Shaf 2 (8 slots, gy=29..30)
    {"id": "slot_z16_shaf2_1", "zone": "Z16", "type": "prayer_row", "capacity": 1, "gx": 30, "gy": 29, "facing": "NW", "anim": "pray", "y_offset": 0},
    {"id": "slot_z16_shaf2_2", "zone": "Z16", "type": "prayer_row", "capacity": 1, "gx": 31, "gy": 29, "facing": "NW", "anim": "pray", "y_offset": 0},
    {"id": "slot_z16_shaf2_3", "zone": "Z16", "type": "prayer_row", "capacity": 1, "gx": 32, "gy": 29, "facing": "NW", "anim": "pray", "y_offset": 0},
    {"id": "slot_z16_shaf2_4", "zone": "Z16", "type": "prayer_row", "capacity": 1, "gx": 34, "gy": 29, "facing": "NW", "anim": "pray", "y_offset": 0},
    {"id": "slot_z16_shaf2_5", "zone": "Z16", "type": "prayer_row", "capacity": 1, "gx": 35, "gy": 29, "facing": "NW", "anim": "pray", "y_offset": 0},
    {"id": "slot_z16_shaf2_6", "zone": "Z16", "type": "prayer_row", "capacity": 1, "gx": 36, "gy": 29, "facing": "NW", "anim": "pray", "y_offset": 0},
    {"id": "slot_z16_shaf2_7", "zone": "Z16", "type": "prayer_row", "capacity": 1, "gx": 32, "gy": 30, "facing": "NW", "anim": "pray", "y_offset": 0},
    {"id": "slot_z16_shaf2_8", "zone": "Z16", "type": "prayer_row", "capacity": 1, "gx": 34, "gy": 30, "facing": "NW", "anim": "pray", "y_offset": 0},
    # Wudhu (4 slots)
    {"id": "slot_z16_wudhu_1", "zone": "Z16", "type": "wudhu", "capacity": 1, "gx": 31, "gy": 24, "facing": "SE", "anim": "idle", "y_offset": 0},
    {"id": "slot_z16_wudhu_2", "zone": "Z16", "type": "wudhu", "capacity": 1, "gx": 32, "gy": 24, "facing": "SE", "anim": "idle", "y_offset": 0},
    {"id": "slot_z16_wudhu_3", "zone": "Z16", "type": "wudhu", "capacity": 1, "gx": 34, "gy": 24, "facing": "SW", "anim": "idle", "y_offset": 0},
    {"id": "slot_z16_wudhu_4", "zone": "Z16", "type": "wudhu", "capacity": 1, "gx": 35, "gy": 24, "facing": "SW", "anim": "idle", "y_offset": 0},

    # Z17 Kolam luar (37..43, 22..31) - Semua
    {"id": "slot_z17_swim_1", "zone": "Z17", "type": "pool_swim", "capacity": 1, "gx": 39, "gy": 26, "facing": "SE", "anim": "idle", "y_offset": 0},
    {"id": "slot_z17_swim_2", "zone": "Z17", "type": "pool_swim", "capacity": 1, "gx": 41, "gy": 26, "facing": "SW", "anim": "idle", "y_offset": 0},
    {"id": "slot_z17_swim_3", "zone": "Z17", "type": "pool_swim", "capacity": 1, "gx": 41, "gy": 27, "facing": "NW", "anim": "idle", "y_offset": 0},
    {"id": "slot_z17_swim_4", "zone": "Z17", "type": "pool_swim", "capacity": 1, "gx": 41, "gy": 28, "facing": "NW", "anim": "idle", "y_offset": 0},
    {"id": "slot_z17_swim_5", "zone": "Z17", "type": "pool_swim", "capacity": 1, "gx": 39, "gy": 28, "facing": "NE", "anim": "idle", "y_offset": 0},
    {"id": "slot_z17_swim_6", "zone": "Z17", "type": "pool_swim", "capacity": 1, "gx": 39, "gy": 27, "facing": "SE", "anim": "idle", "y_offset": 0},
    {"id": "slot_z17_lounger_1", "zone": "Z17", "type": "pool_lounger", "capacity": 1, "gx": 37, "gy": 24, "facing": "SE", "anim": "sit_type", "y_offset": -4},
    {"id": "slot_z17_lounger_2", "zone": "Z17", "type": "pool_lounger", "capacity": 1, "gx": 37, "gy": 26, "facing": "SE", "anim": "sit_type", "y_offset": -4},
    {"id": "slot_z17_lounger_3", "zone": "Z17", "type": "pool_lounger", "capacity": 1, "gx": 37, "gy": 28, "facing": "SE", "anim": "sit_type", "y_offset": -4},
]

def build_floor_layer() -> list[int]:
    """Generates 44x32 GIDs for the floor layer."""
    data = [0] * (MAP_WIDTH * MAP_HEIGHT)
    for gy in range(MAP_HEIGHT):
        for gx in range(MAP_WIDTH):
            idx = gy * MAP_WIDTH + gx
            # Corridors
            if 8 <= gy <= 9 or 20 <= gy <= 21:
                data[idx] = get_gid("tile_floor_corridor.png")
                continue
            # Pool water
            if 38 <= gx <= 42 and 25 <= gy <= 29:
                data[idx] = get_gid("tile_floor_pool_water.png")
                continue
            # Room floor
            for z in ZONES_DEF:
                if z["gx_min"] <= gx <= z["gx_max"] and z["gy_min"] <= gy <= z["gy_max"]:
                    data[idx] = get_gid(z["floor"])
                    break
    return data

def build_walls_back_layer() -> list[int]:
    """Generates 44x32 GIDs for the full-height back walls."""
    data = [0] * (MAP_WIDTH * MAP_HEIGHT)

    # North perimeter wall along gy=0
    for gx in range(MAP_WIDTH):
        idx = 0 * MAP_WIDTH + gx
        if gx == 0:
            data[idx] = get_gid("wall_back_corner_n.png")
        elif gx in [3, 8, 14, 18, 24, 30, 38, 42]:
            data[idx] = get_gid("wall_back_window_day.png")
        else:
            data[idx] = get_gid("wall_back_ne.png")

    # West perimeter back wall along gx=0
    for gy in range(1, MAP_HEIGHT):
        idx = gy * MAP_WIDTH + 0
        data[idx] = get_gid("wall_back_nw.png")

    # Row 1 dividing walls (gy 1..6)
    for wx in [9, 19, 27, 34]:
        for gy in range(1, 7):
            idx = gy * MAP_WIDTH + wx
            data[idx] = get_gid("wall_back_nw.png")

    # Row 2 North boundary along gy=10
    door_gxs_r2 = {d["gx"] for d in DOORS_DEF if d["gy"] == 10}
    for gx in range(1, MAP_WIDTH):
        idx = 10 * MAP_WIDTH + gx
        if gx in door_gxs_r2:
            data[idx] = get_gid("wall_back_doorway.png")
        else:
            data[idx] = get_gid("wall_back_ne.png")

    # Row 2 dividing walls (gy 11..18)
    for wx in [8, 15, 23, 27, 31, 35]:
        for gy in range(11, 19):
            idx = gy * MAP_WIDTH + wx
            if (wx, gy) in door_positions:
                data[idx] = get_gid("wall_back_doorway.png")
            else:
                data[idx] = get_gid("wall_back_nw.png")

    # Row 3 back walls:
    # Musholla north wall along gy=22 (gx 30..36)
    for gx in range(30, 37):
        idx = 22 * MAP_WIDTH + gx
        if (gx, 22) in door_positions:
            data[idx] = get_gid("wall_back_doorway.png")
        else:
            data[idx] = get_gid("wall_back_ne.png")

    # Arcade / Musholla divider (gx=29, gy=22..30)
    for gy in range(22, 31):
        idx = gy * MAP_WIDTH + 29
        data[idx] = get_gid("wall_back_nw.png")

    # Musholla / Pool divider (gx=36, gy=23..30)
    for gy in range(23, 31):
        idx = gy * MAP_WIDTH + 36
        data[idx] = get_gid("wall_back_nw.png")

    return data

def build_walls_front_layer() -> list[int]:
    """Generates 44x32 GIDs for 8px cutaway front walls."""
    data = [0] * (MAP_WIDTH * MAP_HEIGHT)

    # Row 1 South cutaways along gy=7
    door_gxs_r1 = {d["gx"] for d in DOORS_DEF if d["gy"] == 7}
    for gx in range(1, MAP_WIDTH):
        idx = 7 * MAP_WIDTH + gx
        if gx in door_gxs_r1:
            data[idx] = get_gid("wall_front_cutaway_doorway.png")
        else:
            data[idx] = get_gid("wall_front_cutaway_sw.png")

    # Row 2 South cutaways along gy=19
    door_gxs_r2_south = {d["gx"] for d in DOORS_DEF if d["gy"] == 19}
    for gx in range(1, MAP_WIDTH):
        idx = 19 * MAP_WIDTH + gx
        if gx in door_gxs_r2_south:
            data[idx] = get_gid("wall_front_cutaway_doorway.png")
        else:
            data[idx] = get_gid("wall_front_cutaway_sw.png")

    # Row 3 South cutaways along gy=31
    for gx in range(MAP_WIDTH):
        idx = 31 * MAP_WIDTH + gx
        if gx == 0 or gx == 43:
            data[idx] = get_gid("wall_front_cutaway_corner_s.png")
        elif (gx, 31) in door_positions:
            data[idx] = get_gid("wall_front_cutaway_doorway.png")
        else:
            data[idx] = get_gid("wall_front_cutaway_sw.png")

    # East perimeter cutaway along gx=43
    for gy in range(1, 31):
        idx = gy * MAP_WIDTH + 43
        data[idx] = get_gid("wall_front_cutaway_se.png")

    return data

def build_furniture_layer() -> list[int]:
    """Generates 44x32 GIDs for the furniture layer."""
    data = [0] * (MAP_WIDTH * MAP_HEIGHT)

    def set_f(gx: int, gy: int, sprite: str):
        if 0 <= gx < MAP_WIDTH and 0 <= gy < MAP_HEIGHT:
            data[gy * MAP_WIDTH + gx] = get_gid(sprite)

    # Z01 Ruang CEO
    set_f(4, 2, "furniture_wall_monitors_ceo.png")
    set_f(4, 4, "furniture_desk_executive.png")
    set_f(1, 4, "furniture_sofa_leather.png")
    set_f(8, 2, "furniture_trophy_shelf.png")

    # Z02 Boardroom
    set_f(14, 1, "furniture_presentation_screen.png")
    for gy in [3, 4]:
        for gx in [14, 15]:
            set_f(gx, gy, "furniture_boardroom_table.png")
    for gx in range(13, 17):
        set_f(gx, 2, "furniture_chair_cushion.png")
        set_f(gx, 5, "furniture_chair_cushion.png")
    set_f(12, 3, "furniture_chair_cushion.png")
    set_f(12, 4, "furniture_chair_cushion.png")
    set_f(17, 3, "furniture_chair_cushion.png")
    set_f(17, 4, "furniture_chair_cushion.png")
    for gy in [2, 4, 6]:
        set_f(10, gy, "furniture_glass_partition.png")

    # Z03 Ruang Arsitektur
    set_f(23, 2, "furniture_desk.png")
    set_f(21, 4, "furniture_blueprint_table.png")
    set_f(25, 4, "furniture_blueprint_table.png")
    set_f(21, 1, "furniture_system_model_mini.png")
    set_f(26, 1, "furniture_blueprint_rack.png")

    # Z04 Ruang Kelas
    set_f(31, 1, "furniture_whiteboard.png")
    for gx in [29, 31, 33]:
        for gy in [4, 5]:
            set_f(gx, gy, "furniture_chair_rounded.png")

    # Z05 Perpustakaan
    for gx in [36, 38, 40, 42]:
        set_f(gx, 1, "furniture_bookcase_tall.png")
    set_f(36, 3, "furniture_desk.png")
    set_f(37, 3, "furniture_green_reading_lamp.png")
    set_f(42, 5, "furniture_printing_press.png")
    set_f(40, 3, "furniture_lounge_chair.png")
    set_f(41, 3, "furniture_lounge_chair.png")

    # Z06 Lab Riset
    set_f(6, 12, "furniture_desk.png")
    set_f(1, 12, "furniture_lab_bench.png")
    set_f(1, 16, "furniture_lab_bench.png")
    set_f(1, 13, "furniture_microscope.png")
    set_f(1, 14, "furniture_whiteboard_formula.png")
    set_f(1, 15, "furniture_test_tube_rack.png")
    set_f(7, 16, "furniture_journal_shelf.png")

    # Z07 Studio Desain
    set_f(10, 12, "furniture_desk.png")
    set_f(10, 14, "furniture_drawing_desk_tablet.png")
    set_f(14, 14, "furniture_moodboard.png")
    set_f(14, 11, "furniture_swatch_wall.png")

    # Z08 Dev Pods
    for gy, sprite in [(12, "furniture_workstation_dev.png"),
                       (14, "furniture_workstation_dev.png"),
                       (16, "furniture_workstation_dev.png"),
                       (18, "furniture_workstation_guest.png")]:
        set_f(16, gy, sprite)
        set_f(18, gy, "furniture_chair.png")
    set_f(22, 13, "furniture_pair_standing_desk.png")
    set_f(22, 17, "furniture_pair_standing_desk.png")

    # Z09 Graphics Lab
    set_f(25, 13, "furniture_desk.png")
    set_f(26, 12, "furniture_large_monitor_preview.png")
    set_f(26, 16, "furniture_spare_tiles_pile.png")

    # Z10 QA Station
    set_f(29, 13, "furniture_stamp_desk.png")
    set_f(30, 12, "furniture_qa_screens.png")
    set_f(30, 13, "furniture_lamp_pass_fail.png")
    set_f(30, 16, "furniture_screen.png")

    # Z11 Release Dock
    set_f(33, 13, "furniture_desk.png")
    set_f(34, 11, "furniture_changelog_board.png")
    for gy in [14, 15, 16]:
        set_f(34, gy, "furniture_conveyor.png")
    set_f(32, 16, "furniture_parcel_rack.png")
    set_f(32, 18, "furniture_parcel_rack.png")
    set_f(33, 17, "furniture_cardboard_box.png")

    # Z12 Data Center & SOC
    set_f(39, 11, "furniture_soc_map_wall.png")
    set_f(39, 12, "furniture_alert_console.png")
    set_f(37, 12, "furniture_desk.png")
    set_f(41, 12, "furniture_desk.png")
    for gy in [16, 17, 18]:
        set_f(36, gy, "furniture_server_rack.png")
        set_f(42, gy, "furniture_server_rack.png")

    # Z13 Lobi
    set_f(4, 26, "furniture_reception_desk.png")
    set_f(5, 26, "furniture_reception_desk.png")
    set_f(1, 25, "furniture_attendance_board.png")
    set_f(4, 31, "furniture_entrance_door.png")
    set_f(5, 31, "furniture_entrance_door.png")
    set_f(1, 28, "furniture_potted_plant.png")
    set_f(8, 28, "furniture_potted_plant.png")

    # Z14 Kafetaria & Lounge
    for gx in [12, 13, 14]:
        set_f(gx, 24, "furniture_marble_counter.png")
    set_f(13, 23, "furniture_espresso_machine.png")
    for gx in [11, 14, 17, 20]:
        set_f(gx, 28, "furniture_table_round.png")
    for gx in [17, 18, 19]:
        set_f(gx, 23, "furniture_lounge_sofa.png")
    set_f(20, 23, "furniture_lounge_sofa_corner.png")
    set_f(10, 23, "furniture_achievement_board.png")
    set_f(10, 24, "furniture_kitchen_fridge.png")
    set_f(10, 25, "furniture_trashcan.png")

    # Z15 Arcade
    set_f(23, 23, "furniture_arcade_cabinet.png")
    set_f(24, 23, "furniture_arcade_cabinet.png")
    set_f(25, 23, "furniture_arcade_cabinet.png")
    set_f(27, 23, "furniture_neon_sign.png")
    for gx in [27, 28]:
        for gy in [25, 26]:
            set_f(gx, gy, "furniture_billiard_table.png")
    set_f(24, 27, "furniture_beanbag.png")
    set_f(26, 27, "furniture_beanbag.png")
    set_f(28, 27, "furniture_beanbag.png")

    # Z16 Musholla
    set_f(33, 25, "furniture_mihrab.png")
    set_f(30, 23, "furniture_quran_shelf.png")
    for gx in [31, 32, 34, 35]:
        set_f(gx, 23, "furniture_wudhu_station.png")
    set_f(30, 26, "furniture_shaf_partition.png")
    set_f(36, 26, "furniture_shaf_partition.png")
    for gy in [27, 29]:
        for gx in range(30, 37):
            set_f(gx, gy, "furniture_prayer_rug_shaf.png")

    # Z17 Kolam luar
    # Basin corners and edges
    for gx in range(38, 43):
        set_f(gx, 25, "furniture_pool_coping.png")
        set_f(gx, 29, "furniture_pool_coping.png")
    for gy in range(26, 29):
        set_f(38, gy, "furniture_pool_coping.png")
        set_f(42, gy, "furniture_pool_coping.png")
    for gy in [26, 27, 28]:
        for gx in [39, 40, 41]:
            set_f(gx, gy, "furniture_pool_water.png")
    set_f(37, 24, "furniture_pool_lounger.png")
    set_f(37, 26, "furniture_pool_lounger.png")
    set_f(37, 28, "furniture_pool_lounger.png")
    set_f(37, 25, "furniture_pool_umbrella.png")
    set_f(37, 27, "furniture_pool_umbrella.png")
    set_f(37, 30, "furniture_tropical_plant.png")
    set_f(43, 24, "furniture_tropical_plant.png")

    return data

def build_collision_layer() -> list[int]:
    """Generates 44x32 GIDs for the collision layer (0 = walkable, 123 = blocked)."""
    grid = [[0 for _ in range(MAP_WIDTH)] for _ in range(MAP_HEIGHT)]

    # Perimeter walls
    for gx in range(MAP_WIDTH):
        grid[0][gx] = COLLISION_GID
        if (gx, 31) not in door_positions:
            grid[31][gx] = COLLISION_GID
    for gy in range(MAP_HEIGHT):
        grid[gy][0] = COLLISION_GID
        grid[gy][43] = COLLISION_GID

    # Dividing walls Row 1 (gy 1..6)
    for wx in [9, 19, 27, 34]:
        for gy in range(1, 7):
            grid[gy][wx] = COLLISION_GID

    # Row 1 South Cutaway wall at gy=7
    for gx in range(1, MAP_WIDTH):
        if (gx, 7) not in door_positions:
            grid[7][gx] = COLLISION_GID

    # Row 2 North wall at gy=10
    for gx in range(1, MAP_WIDTH):
        if (gx, 10) not in door_positions:
            grid[10][gx] = COLLISION_GID

    # Dividing walls Row 2 (gy 11..18)
    for wx in [8, 15, 23, 27, 31, 35]:
        for gy in range(11, 19):
            if (wx, gy) not in door_positions:
                grid[gy][wx] = COLLISION_GID

    # Row 2 South Cutaway wall at gy=19
    for gx in range(1, MAP_WIDTH):
        if (gx, 19) not in door_positions:
            grid[19][gx] = COLLISION_GID

    # Row 3 Dividing walls
    for gy in range(22, 31):
        grid[gy][29] = COLLISION_GID
    for gx in range(30, 37):
        if (gx, 22) not in door_positions:
            grid[22][gx] = COLLISION_GID
    for gy in range(23, 31):
        grid[gy][36] = COLLISION_GID

    # Solid furniture items blocking movement
    solid_furniture = [
        (4, 2), (8, 2),  # CEO screens, trophy
        (14, 1), (14, 3), (15, 3), (14, 4), (15, 4), (10, 2), (10, 4), (10, 6), # Boardroom table, screen, partition
        (21, 1), (26, 1), # System model, blueprint rack
        (31, 1), # Whiteboard
        (36, 1), (38, 1), (40, 1), (42, 1), (42, 5), # Bookcases, press
        (1, 12), (1, 14), (1, 16), (7, 16), # Lab benches, journals
        (14, 11), (14, 14), # Swatches, moodboard
        (16, 12), (16, 14), (16, 16), (16, 18), (22, 13), (22, 17), # Dev workstations, pair desks
        (26, 12), (26, 16), # Ultrawide, spare tiles
        (30, 12), (30, 13), # QA screens, beacon
        (34, 11), (34, 14), (34, 15), (34, 16), (32, 16), (32, 18), # Conveyor, parcels
        (39, 11), (39, 12), (36, 16), (36, 17), (36, 18), (42, 16), (42, 17), (42, 18), # SOC map, console, server racks
        (4, 26), (5, 26), (1, 28), (8, 28), # Reception desk, plants
        (12, 24), (13, 24), (14, 24), (13, 23), (11, 28), (14, 28), (17, 28), (20, 28), (10, 23), (10, 24), # Cafe counter, espresso, tables, fridge
        (23, 23), (24, 23), (25, 23), (27, 23), (27, 25), (28, 25), (27, 26), (28, 26), # Arcade cabs, neon, billiard
        (33, 25), (30, 23), (31, 23), (32, 23), (34, 23), (35, 23), # Mihrab, quran, wudhu
    ]
    for fx, fy in solid_furniture:
        if 0 <= fx < MAP_WIDTH and 0 <= fy < MAP_HEIGHT:
            grid[fy][fx] = COLLISION_GID

    # Guarantee all doors are walkable
    for dx, dy in door_positions:
        grid[dy][dx] = 0

    # Guarantee all slot positions are walkable
    for s in SLOTS_DEF:
        grid[s["gy"]][s["gx"]] = 0

    data = []
    for row in grid:
        data.extend(row)
    return data

def build_slots_objects() -> list[dict]:
    """Builds object list for the slots layer."""
    objects = []
    for idx, s in enumerate(SLOTS_DEF, start=1):
        gx = s["gx"]
        gy = s["gy"]
        # Center coordinates in Tiled pixel coordinates
        px = gx * TILE_HEIGHT + (TILE_HEIGHT // 2)
        py = gy * TILE_HEIGHT + (TILE_HEIGHT // 2)

        obj = {
            "id": idx,
            "name": s["id"],
            "type": s["type"],
            "point": True,
            "x": px,
            "y": py,
            "width": 0,
            "height": 0,
            "visible": True,
            "properties": [
                {"name": "type", "type": "string", "value": s["type"]},
                {"name": "capacity", "type": "int", "value": s["capacity"]},
                {"name": "facing", "type": "string", "value": s["facing"]},
                {"name": "anim", "type": "string", "value": s["anim"]},
                {"name": "y_offset", "type": "int", "value": s["y_offset"]},
                {"name": "zone", "type": "string", "value": s["zone"]},
                {"name": "gx", "type": "int", "value": gx},
                {"name": "gy", "type": "int", "value": gy},
            ],
        }
        objects.append(obj)
    return objects

def build_doors_objects(start_id: int) -> list[dict]:
    """Builds object list for the doors layer."""
    objects = []
    for idx, d in enumerate(DOORS_DEF, start=start_id):
        gx = d["gx"]
        gy = d["gy"]
        px = gx * TILE_HEIGHT + (TILE_HEIGHT // 2)
        py = gy * TILE_HEIGHT + (TILE_HEIGHT // 2)

        obj = {
            "id": idx,
            "name": d["name"],
            "type": "door",
            "point": True,
            "x": px,
            "y": py,
            "width": 0,
            "height": 0,
            "visible": True,
            "properties": [
                {"name": "from", "type": "string", "value": d["from"]},
                {"name": "to", "type": "string", "value": d["to"]},
                {"name": "gx", "type": "int", "value": gx},
                {"name": "gy", "type": "int", "value": gy},
            ],
        }
        objects.append(obj)
    return objects

def build_zones_objects(start_id: int) -> list[dict]:
    """Builds polygon objects for all 17 zones."""
    objects = []
    for idx, z in enumerate(ZONES_DEF, start=start_id):
        gx_min = z["gx_min"]
        gx_max = z["gx_max"]
        gy_min = z["gy_min"]
        gy_max = z["gy_max"]

        w_tiles = (gx_max - gx_min + 1)
        h_tiles = (gy_max - gy_min + 1)

        # Polygon in isometric plane coordinates
        # Top-left is (0, 0), top-right is (w, 0), btm-right is (w, h), btm-left is (0, h)
        w_px = w_tiles * TILE_HEIGHT
        h_px = h_tiles * TILE_HEIGHT

        polygon = [
            {"x": 0, "y": 0},
            {"x": w_px, "y": 0},
            {"x": w_px, "y": h_px},
            {"x": 0, "y": h_px},
        ]

        obj = {
            "id": idx,
            "name": f"{z['id']} {z['name']}",
            "type": "zone",
            "x": gx_min * TILE_HEIGHT,
            "y": gy_min * TILE_HEIGHT,
            "width": w_px,
            "height": h_px,
            "visible": True,
            "polygon": polygon,
            "properties": [
                {"name": "zone_id", "type": "string", "value": z["id"]},
                {"name": "name", "type": "string", "value": z["name"]},
                {"name": "resident", "type": "string", "value": z["resident"]},
                {"name": "gx_min", "type": "int", "value": gx_min},
                {"name": "gx_max", "type": "int", "value": gx_max},
                {"name": "gy_min", "type": "int", "value": gy_min},
                {"name": "gy_max", "type": "int", "value": gy_max},
            ],
        }
        objects.append(obj)
    return objects

def build_tileset() -> dict:
    """Builds embedded tileset matching environment atlas + collision."""
    tiles = []
    for idx, frame_name in enumerate(frame_names):
        stem = frame_name.replace(".png", "")
        category = "tile" if stem.startswith("tile_") else ("wall" if stem.startswith("wall_") else "furniture")
        tile_def = {
            "id": idx,
            "type": stem,
            "image": frame_name,
            "imagewidth": 64,
            "imageheight": 64,
            "properties": [
                {"name": "sprite", "type": "string", "value": frame_name},
                {"name": "category", "type": "string", "value": category},
            ],
        }
        tiles.append(tile_def)

    # Collision tile at index 122 (GID 123)
    tiles.append({
        "id": COLLISION_TILE_ID,
        "type": "collision",
        "imagewidth": 64,
        "imageheight": 32,
        "properties": [
            {"name": "solid", "type": "bool", "value": True},
        ],
    })

    tileset = {
        "firstgid": 1,
        "name": "environment",
        "tilewidth": 64,
        "tileheight": 64,
        "tilecount": len(tiles),
        "columns": 1,
        "image": "../sprites/environment.png",
        "imagewidth": 2040,
        "imageheight": 2040,
        "margin": 0,
        "spacing": 0,
        "tiles": tiles,
    }
    return tileset

def main():
    print(f"Generating Tiled TMJ map: {TMJ_OUT_PATH}")

    slots_objs = build_slots_objects()
    doors_objs = build_doors_objects(start_id=len(slots_objs) + 1)
    zones_objs = build_zones_objects(start_id=len(slots_objs) + len(doors_objs) + 1)

    next_object_id = len(slots_objs) + len(doors_objs) + len(zones_objs) + 1

    layers = [
        # Layer 1: floor
        {
            "id": 1,
            "name": "floor",
            "type": "tilelayer",
            "width": MAP_WIDTH,
            "height": MAP_HEIGHT,
            "data": build_floor_layer(),
            "visible": True,
            "opacity": 1.0,
            "x": 0,
            "y": 0,
        },
        # Layer 2: walls_back
        {
            "id": 2,
            "name": "walls_back",
            "type": "tilelayer",
            "width": MAP_WIDTH,
            "height": MAP_HEIGHT,
            "data": build_walls_back_layer(),
            "visible": True,
            "opacity": 1.0,
            "x": 0,
            "y": 0,
        },
        # Layer 3: walls_front
        {
            "id": 3,
            "name": "walls_front",
            "type": "tilelayer",
            "width": MAP_WIDTH,
            "height": MAP_HEIGHT,
            "data": build_walls_front_layer(),
            "visible": True,
            "opacity": 1.0,
            "x": 0,
            "y": 0,
        },
        # Layer 4: furniture
        {
            "id": 4,
            "name": "furniture",
            "type": "tilelayer",
            "width": MAP_WIDTH,
            "height": MAP_HEIGHT,
            "data": build_furniture_layer(),
            "visible": True,
            "opacity": 1.0,
            "x": 0,
            "y": 0,
        },
        # Layer 5: collision
        {
            "id": 5,
            "name": "collision",
            "type": "tilelayer",
            "width": MAP_WIDTH,
            "height": MAP_HEIGHT,
            "data": build_collision_layer(),
            "visible": False,
            "opacity": 0.5,
            "x": 0,
            "y": 0,
        },
        # Layer 6: slots
        {
            "id": 6,
            "name": "slots",
            "type": "objectgroup",
            "objects": slots_objs,
            "visible": True,
            "opacity": 1.0,
            "x": 0,
            "y": 0,
            "draworder": "topdown",
        },
        # Layer 7: doors
        {
            "id": 7,
            "name": "doors",
            "type": "objectgroup",
            "objects": doors_objs,
            "visible": True,
            "opacity": 1.0,
            "x": 0,
            "y": 0,
            "draworder": "topdown",
        },
        # Layer 8: zones
        {
            "id": 8,
            "name": "zones",
            "type": "objectgroup",
            "objects": zones_objs,
            "visible": True,
            "opacity": 1.0,
            "x": 0,
            "y": 0,
            "draworder": "topdown",
        },
    ]

    tileset = build_tileset()

    map_doc = {
        "compressionlevel": -1,
        "width": MAP_WIDTH,
        "height": MAP_HEIGHT,
        "infinite": False,
        "orientation": "isometric",
        "renderorder": "right-down",
        "tilewidth": TILE_WIDTH,
        "tileheight": TILE_HEIGHT,
        "type": "map",
        "version": "1.10",
        "tiledversion": "1.10.2",
        "nextlayerid": len(layers) + 1,
        "nextobjectid": next_object_id,
        "properties": [
            {"name": "description", "type": "string", "value": "Hermes Office Floor 1 - 44x32 Dimetric 2:1"},
            {"name": "production_pipeline", "type": "string", "value": "Dev Pods -> QA Station -> Release Dock -> Data Center"},
            {"name": "zones_count", "type": "int", "value": len(ZONES_DEF)},
            {"name": "slots_count", "type": "int", "value": len(slots_objs)},
            {"name": "doors_count", "type": "int", "value": len(doors_objs)},
        ],
        "tilesets": [tileset],
        "layers": layers,
    }

    TMJ_OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(TMJ_OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(map_doc, f, indent=2)

    # Also export standalone TSJ tileset
    tsj_doc = dict(tileset)
    tsj_doc.pop("firstgid", None)
    tsj_doc["type"] = "tileset"
    tsj_doc["version"] = "1.10"
    tsj_doc["tiledversion"] = "1.10.2"
    with open(TSJ_OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(tsj_doc, f, indent=2)

    tmj_size_kb = TMJ_OUT_PATH.stat().st_size / 1024.0
    print(f"Successfully generated {TMJ_OUT_PATH} ({tmj_size_kb:.2f} KB)")
    print(f"Layers count: {len(layers)}")
    print(f"Zones count: {len(zones_objs)}")
    print(f"Slots count: {len(slots_objs)}")
    print(f"Doors count: {len(doors_objs)}")

if __name__ == "__main__":
    main()
