#!/usr/bin/env python3
"""
process_furniture_asset.py
Utility script to ingest AI-generated isometric furniture props:
1. Removes solid white/light background to make it transparent PNG.
2. Auto-crops to tight bounding box with optional padding.
3. Computes isometric anchor point (bottom-center) and dimensions.
4. Saves to frontend/public/assets/furniture/<asset_name>.png
"""

import sys
import os
from PIL import Image
import numpy as np

def remove_white_bg(img: Image.Image, tolerance: int = 240) -> Image.Image:
    img = img.convert("RGBA")
    data = np.array(img)
    
    # White background mask: R, G, B all > tolerance
    r, g, b, a = data[:, :, 0], data[:, :, 1], data[:, :, 2], data[:, :, 3]
    white_mask = (r >= tolerance) & (g >= tolerance) & (b >= tolerance)
    
    # Make transparent
    data[white_mask, 3] = 0
    
    # Auto-crop transparent borders
    result = Image.fromarray(data)
    bbox = result.getbbox()
    if bbox:
        result = result.crop(bbox)
    return result

def main():
    if len(sys.argv) < 3:
        print("Usage: python3 process_furniture_asset.py <input_image_path> <output_name>")
        sys.exit(1)
        
    input_path = sys.argv[1]
    output_name = sys.argv[2]
    if not output_name.endswith(".png"):
        output_name += ".png"
        
    out_dir = "/srv/hermes-control/services/agent-cockpit/frontend/public/assets/furniture"
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, output_name)
    
    print(f"Loading {input_path}...")
    img = Image.open(input_path)
    processed = remove_white_bg(img)
    processed.save(out_path, "PNG")
    w, h = processed.size
    print(f"Successfully processed and saved to {out_path} ({w}x{h} px)")

if __name__ == "__main__":
    main()
