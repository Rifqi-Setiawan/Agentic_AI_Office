"""Headless Blender render script for isometric pixel-art sprites.

This script executes inside Blender (Blender 4.x headless mode):
    blender -b -P art/pipeline/render.py -- [options]

Target projection:
    Dimetric 2:1 projection with Blender orthographic camera at rot X=60°, Z=45°.
    Canvas size: 48x64 px for characters, centered bottom anchor.
"""

from __future__ import annotations

import argparse
import sys

# Attempt bpy import when running inside Blender
try:
    import bpy  # type: ignore[import-not-found]
except ImportError:
    bpy = None  # type: ignore[assignment]


def parse_args() -> argparse.Namespace:
    """Parse CLI arguments passed after '--' in Blender CLI."""
    argv = sys.argv
    if "--" in argv:
        custom_args = argv[argv.index("--") + 1 :]
    else:
        custom_args = []

    parser = argparse.ArgumentParser(description="Headless Blender sprite renderer")
    parser.add_argument("--model", type=str, default="", help="Path to input GLB model")
    parser.add_argument(
        "--output", type=str, default="dist/sprites", help="Output directory"
    )
    parser.add_argument(
        "--palette", type=str, default="", help="Path to 32-color master palette"
    )
    return parser.parse_args(custom_args)


def main() -> None:
    """Entry point for Blender script execution."""
    args = parse_args()
    if bpy is None:
        print("art/pipeline/render.py: must run inside Blender 4.x (blender -b -P ...)")
        return
    print(f"Renderer initialized with model={args.model}, output={args.output}")


if __name__ == "__main__":
    main()
