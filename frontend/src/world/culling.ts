import { Container, Sprite } from 'pixi.js';

export interface ViewportBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CullingStats {
  total: number;
  visible: number;
  culled: number;
}

/**
 * CullingManager mengelola culling sprite di luar layar (frustum/AABB culling).
 * Mematikan `renderable = false` pada sprite yang berada di luar viewport visible bounds
 * untuk menghemat draw call dan instruksi rendering GPU.
 */
export class CullingManager {
  private sprites: Set<Sprite | Container> = new Set();
  private margin: number;

  constructor(margin: number = 64) {
    this.margin = margin;
  }

  public register(target: Sprite | Container): void {
    this.sprites.add(target);
  }

  public registerMany(targets: Array<Sprite | Container>): void {
    for (const t of targets) {
      this.sprites.add(t);
    }
  }

  public unregister(target: Sprite | Container): void {
    this.sprites.delete(target);
  }

  public clear(): void {
    this.sprites.clear();
  }

  public size(): number {
    return this.sprites.size;
  }

  /**
   * Evaluasi seluruh sprite terdaftar terhadap batas viewport saat ini.
   */
  public update(bounds: ViewportBounds): CullingStats {
    let visible = 0;
    let culled = 0;

    const minViewX = bounds.x - this.margin;
    const maxViewX = bounds.x + bounds.width + this.margin;
    const minViewY = bounds.y - this.margin;
    const maxViewY = bounds.y + bounds.height + this.margin;

    for (const item of this.sprites) {
      // Perkirakan bounding box sprite
      const w = item.width || 64;
      const h = item.height || 64;
      // Gunakan anchor jika sprite, default 0.5
      const anchorX = 'anchor' in item && item.anchor ? (item.anchor as { x: number }).x : 0.5;
      const anchorY = 'anchor' in item && item.anchor ? (item.anchor as { y: number }).y : 0.5;

      const itemMinX = item.x - w * anchorX;
      const itemMaxX = itemMinX + w;
      const itemMinY = item.y - h * anchorY;
      const itemMaxY = itemMinY + h;

      const isInside =
        itemMaxX >= minViewX &&
        itemMinX <= maxViewX &&
        itemMaxY >= minViewY &&
        itemMinY <= maxViewY;

      item.renderable = isInside;
      if (isInside) {
        visible++;
      } else {
        culled++;
      }
    }

    return {
      total: this.sprites.size,
      visible,
      culled,
    };
  }
}
