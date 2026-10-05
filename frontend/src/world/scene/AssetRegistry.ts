export interface AtlasFrame {
  frame: { x: number; y: number; w: number; h: number };
  rotated: boolean; trimmed: boolean;
  spriteSourceSize: { x: number; y: number; w: number; h: number };
  sourceSize: { w: number; h: number };
}
export interface SpriteAtlas { frames: Record<string, AtlasFrame>; meta: { image: string; size: { w: number; h: number }; exportScale?: number; footAnchor?: {x:number;y:number}; animationFps?: Record<string,number>; candidate?: boolean; allowMirror?: boolean }; }
/** Source PNG remains intact; each visible plane is registered to the map in CSS. */
export interface RegisteredSpriteLayer {
  id: string; width: number; height: number;
  clipPath: string; matrix: number[];
}
export interface DepthProp {
  id: string; sprite: string; gx: number; gy: number; x: number; y: number; z: number;
  bounds: { x: number; y: number; width: number; height: number };
  file?: string; runtimeFile?: string; nightFile?: string; artKind?: string;
  componentId?: string; artLayers?: RegisteredSpriteLayer[]; artClipPath?: string;
  wallPresentation?: {
    role: 'exterior-backdrop' | 'interior-cutaway';
    sourceHeight: number; height: number;
  };
}
/** Unedited generated ground PNG, registered at render time to canonical tiles.
 * Vertices are ordered top/right/bottom/left in native source-image pixels. */
export interface GroundSurfaceDefinition {
  id: string; file: string; runtimeFile?: string;
  sourceSize: { width: number; height: number };
  sourceQuad: [[number, number], [number, number], [number, number], [number, number]];
  floorSprites: string[];
  /** Canonical baked furniture cells, painted over their existing base floor. */
  overlaySprites?: string[];
  repeatTiles: number;
  underlayColor: string;
}
export interface PreviewAssets {
  schemaVersion: number; styleVersion: string; exportScale: number;
  floor: { file: string; x: number; y: number; width: number; height: number };
  props: DepthProp[];
  logicalMapSha256: string;
  characterOverrides?: Record<string,string>;
  groundSurfaces?: GroundSurfaceDefinition[];
}

/** A verified, full-resolution lossless encoding may replace only the fetch
 * URL. The original file and all source-pixel registration remain canonical. */
export function propArtworkFile(prop: DepthProp, night = false) {
  return night && prop.nightFile ? prop.nightFile : prop.runtimeFile ?? prop.file;
}

/** Registered planes own their image. Painting the original PNG on their
 * wrapper as well leaks unregistered pixels behind the wall's clipped mesh. */
export function applyPropArtwork(el: HTMLElement, prop: DepthProp, night: boolean) {
  if (!prop.file) return;
  const file = propArtworkFile(prop, night);
  if (el.dataset.assetFile === file) return;
  const image = `url("${file}")`;
  if (prop.artLayers?.length) {
    el.style.backgroundImage = 'none';
    for (const plane of el.querySelectorAll<HTMLElement>('[data-art-plane]')) plane.style.backgroundImage = image;
  } else el.style.backgroundImage = image;
  el.dataset.assetFile = file;
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
