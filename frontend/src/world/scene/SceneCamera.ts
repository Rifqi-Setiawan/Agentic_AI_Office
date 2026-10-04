import { gridToScreen, screenToGrid, getMapWorldBounds } from '../projection';
import type { ZoneDef } from '../../navigation/types';

/** One camera matrix is used by painting, bubbles and hit testing. */
export class SceneCamera {
  panX = 0; panY = 0; zoom = 1;
  private width = 1; private height = 1;
  private initialized = false;
  private flight: { elapsed: number; duration: number; zone: ZoneDef; from: number[]; to: number[]; done?: () => void } | null = null;
  constructor(private viewport: HTMLElement, private world: HTMLElement) {}
  resize() {
    const bounds = this.viewport.getBoundingClientRect();
    const center = this.toWorld(this.width / 2, this.height / 2);
    this.width = bounds.width; this.height = bounds.height;
    if (!this.initialized) { this.initialized = true; this.overview(); }
    else {
      this.centerOn(center.x, center.y);
      if (this.flight) {
        // Continue from the current world center, but fit the destination to the new viewport.
        this.flight.duration -= this.flight.elapsed;
        this.flight.elapsed = 0;
        this.flight.from = [this.panX, this.panY, this.zoom];
        this.flight.to = this.focusTransform(this.flight.zone);
      }
    }
  }
  overview() {
    this.cancelFlight();
    const b = getMapWorldBounds();
    this.zoom = Math.max(.12, Math.min((this.width - 60) / b.width, (this.height - 60) / b.height, 1));
    this.centerOn((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2);
  }
  centerOn(x: number, y: number) {
    this.panX = this.width / 2 - this.zoom * x;
    this.panY = this.height / 2 - this.zoom * y;
    this.paint();
  }
  pan(dx: number, dy: number) { this.cancelFlight(); this.panX += dx; this.panY += dy; this.paint(); }
  zoomAt(value: number, x = this.width / 2, y = this.height / 2) {
    this.cancelFlight();
    const w = this.toWorld(x, y);
    this.zoom = Math.max(.12, Math.min(3, value));
    this.panX = x - this.zoom * w.x; this.panY = y - this.zoom * w.y;
    this.paint();
  }
  private focusTransform(zone: ZoneDef) {
    const points = [gridToScreen(zone.gx_min, zone.gy_min), gridToScreen(zone.gx_max + 1, zone.gy_min),
      gridToScreen(zone.gx_min, zone.gy_max + 1), gridToScreen(zone.gx_max + 1, zone.gy_max + 1)];
    const w = Math.max(...points.map(p => p.x)) - Math.min(...points.map(p => p.x));
    const h = Math.max(...points.map(p => p.y)) - Math.min(...points.map(p => p.y)) + 100;
    const zoom = Math.max(.3, Math.min(2, (this.width - 90) / w, (this.height - 80) / h));
    const p = gridToScreen((zone.gx_min + zone.gx_max) / 2, (zone.gy_min + zone.gy_max) / 2);
    return [this.width / 2 - zoom * p.x, this.height / 2 - zoom * (p.y - 20), zoom];
  }
  focus(zone: ZoneDef, immediate = false, done?: () => void) {
    const to = this.focusTransform(zone);
    if (immediate) { this.flight = null; [this.panX, this.panY, this.zoom] = to; this.paint(); done?.(); }
    else this.flight = { elapsed: 0, duration: 1.25, zone, from: [this.panX, this.panY, this.zoom], to, done };
  }
  /** Baseline 1.25s power2.inOut, advanced by the simulation's rAF, no second timer. */
  update(dt: number) {
    const flight = this.flight;
    if (!flight) return;
    flight.elapsed = Math.min(flight.duration, flight.elapsed + dt);
    const t = flight.elapsed / flight.duration;
    const eased = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    [this.panX, this.panY, this.zoom] = flight.from.map((v, i) => v + (flight.to[i] - v) * eased);
    this.paint();
    if (t === 1) { this.flight = null; flight.done?.(); }
  }
  cancelFlight() { const wasFlying = this.flight !== null; this.flight = null; return wasFlying; }
  toWorld(x: number, y: number) { return { x: (x - this.panX) / this.zoom, y: (y - this.panY) / this.zoom }; }
  clientToGrid(clientX: number, clientY: number) {
    const rect = this.viewport.getBoundingClientRect();
    const p = this.toWorld(clientX - rect.left, clientY - rect.top);
    return screenToGrid(p.x, p.y);
  }
  toScreen(x: number, y: number) {
    const rect = this.viewport.getBoundingClientRect();
    return { x: rect.left + this.panX + this.zoom * x, y: rect.top + this.panY + this.zoom * y };
  }
  getVisibleBounds() { const p = this.toWorld(0, 0); return { ...p, width: this.width / this.zoom, height: this.height / this.zoom }; }
  getViewport() { return this; }
  paint() { this.world.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`; }
}
