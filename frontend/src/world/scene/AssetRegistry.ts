export interface AtlasFrame {
  frame: { x: number; y: number; w: number; h: number };
  rotated: boolean; trimmed: boolean;
  spriteSourceSize: { x: number; y: number; w: number; h: number };
  sourceSize: { w: number; h: number };
}
export interface SpriteAtlas { frames: Record<string, AtlasFrame>; meta: { image: string; size: { w: number; h: number }; exportScale?: number; footAnchor?: {x:number;y:number}; animationFps?: Record<string,number>; candidate?: boolean; allowMirror?: boolean }; }
export interface DepthProp {
  id: string; sprite: string; gx: number; gy: number; x: number; y: number; z: number;
  bounds: { x: number; y: number; width: number; height: number };
  file?: string; nightFile?: string; artKind?: string;
}
export interface PreviewAssets {
  schemaVersion: number; styleVersion: string; exportScale: number;
  floor: { file: string; x: number; y: number; width: number; height: number };
  props: DepthProp[];
  logicalMapSha256: string;
  characterOverrides?: Record<string,string>;
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

export function atlasImageUrl(atlas: SpriteAtlas, fallback: string) {
  return atlas.meta.image.startsWith('/') ? atlas.meta.image : fallback;
}

/** Keep identity and facing within the supplied 2.5D atlas. Pending actions hold
 * one existing pose; old sprites and mirrored views are never substitutes. */
export function resolveActorAnimation(primary: SpriteAtlas, id: string, action: string, direction: string, fallbackPose = 'idle') {
  if (primary.meta.candidate) {
    const frames = animationFrames(primary,id,action,direction);
    if (frames.length) return {atlas:primary,frames,mirrored:false,source:'illustration',renderedAction:action,substituted:false};
    for (const pose of new Set([fallbackPose, 'idle'])) {
      const held = animationFrames(primary,id,pose,direction);
      if (held.length) return {atlas:primary,frames:held.slice(0,1),mirrored:false,source:'illustration',renderedAction:pose,substituted:true};
    }
  }
  return {atlas:primary,frames:[],mirrored:false,source:'missing',renderedAction:'',substituted:false};
}
