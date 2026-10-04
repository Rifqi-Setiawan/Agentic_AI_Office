/** Renderer-neutral HUD command port. The selected world alone owns simulation. */
export interface WorldController {
  flyToZone(zoneId: string, onComplete?: () => void): boolean;
  setZoomLevel(level: 1 | 2 | 3): void;
  getZoomLevel(): number;
  handleAgentClick(agentId: string): boolean;
  getCharacterScreenPosition(id: string): { x: number; y: number } | null;
  destroy(): void;
}
let active: WorldController | null = null;
export const worldController = {
  attach(controller: WorldController | null) { active = controller; },
  flyToZone(id: string, done?: () => void) { return active?.flyToZone(id, done) ?? false; },
  setZoomLevel(level: 1 | 2 | 3) { active?.setZoomLevel(level); },
  getZoomLevel() { return active?.getZoomLevel() ?? 1; },
  handleAgentClick(id: string) { return active?.handleAgentClick(id) ?? false; },
  getCharacterScreenPosition(id: string) { return active?.getCharacterScreenPosition(id) ?? null; },
};
