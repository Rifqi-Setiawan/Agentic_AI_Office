export interface AtlasFrame {
  frame: { x: number; y: number; w: number; h: number };
  rotated: boolean; trimmed: boolean;
  spriteSourceSize: { x: number; y: number; w: number; h: number };
  sourceSize: { w: number; h: number };
}
export interface SpriteAtlas { frames: Record<string, AtlasFrame>; meta: { image: string; size: { w: number; h: number }; exportScale?: number }; }
export interface DepthProp {
  id: string; sprite: string; gx: number; gy: number; x: number; y: number; z: number;
  bounds: { x: number; y: number; width: number; height: number };
}
export interface PreviewAssets {
  schemaVersion: number; styleVersion: string; exportScale: number;
  floor: { file: string; x: number; y: number; width: number; height: number };
  props: DepthProp[];
  logicalMapSha256: string;
}

/** Trim offsets are explicit. Rotated packing must be re-exported for CSS. */
export function applyAtlasFrame(el: HTMLElement, atlas: SpriteAtlas, name: string, url: string) {
  const entry = atlas.frames[name];
  if (!entry) throw new Error(`Missing atlas frame: ${name}`);
  if (entry.rotated) throw new Error(`CSS atlas requires rotated=false: ${name}`);
  const scale = atlas.meta.exportScale ?? 1;
  if (!Number.isFinite(scale) || scale <= 0) throw new Error('Invalid atlas export scale');
  el.style.width = `${entry.frame.w / scale}px`; el.style.height = `${entry.frame.h / scale}px`;
  el.style.backgroundImage = `url("${url}")`;
  el.style.backgroundPosition = `${-entry.frame.x / scale}px ${-entry.frame.y / scale}px`;
  el.style.backgroundSize = `${atlas.meta.size.w / scale}px ${atlas.meta.size.h / scale}px`;
  return entry;
}

export function animationFrames(atlas: SpriteAtlas, id: string, action: string, direction: string) {
  const prefix = `${id}_${action}_${direction.toLowerCase()}_`;
  return Object.keys(atlas.frames).filter(name => name.startsWith(prefix))
    .sort((a, b) => Number(a.slice(prefix.length).replace('.png', '')) - Number(b.slice(prefix.length).replace('.png', '')));
}
