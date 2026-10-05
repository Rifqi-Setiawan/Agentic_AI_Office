/** Keep the mobile scene below the real HUD and naturally wrapping scene controls. */
export function observeSceneLayout(scene: HTMLElement, controls: HTMLElement): () => void {
  const document = scene.ownerDocument;
  const window = document.defaultView!;
  let header: HTMLElement | null = null;
  let footerPanels: HTMLElement[] = [];
  let disposed = false;

  const measure = () => {
    if (disposed) return;
    const bounds = scene.getBoundingClientRect(), origin = bounds.top;
    const headerBottom = Math.max(0, Math.ceil((header?.getBoundingClientRect().bottom ?? origin) - origin));
    scene.style.setProperty('--scene-hud-bottom', `${headerBottom}px`);
    // Read after setting the header offset: moving the controls alone does not
    // trigger ResizeObserver, but their bottom must still follow the header.
    const controlsBottom = Math.max(headerBottom, Math.ceil(controls.getBoundingClientRect().bottom - origin));
    scene.style.setProperty('--scene-controls-bottom', `${controlsBottom}px`);
    // The HUD panels are above the world in a separate stacking context. Leave
    // their full content visible and keep scrollable room buttons above them.
    const panels = footerPanels.map(panel => panel.getBoundingClientRect()).filter(rect => rect.width > 0 && rect.height > 0);
    const footerClearance = Math.max(0, ...panels.map(rect => Math.ceil(bounds.bottom - rect.top)));
    scene.style.setProperty('--scene-nav-bottom', `${footerClearance}px`);
  };
  const resize = new ResizeObserver(measure);
  const findHud = () => {
    if (disposed) return;
    const next = document.querySelector<HTMLElement>('[data-hud-header]');
    let changed = next !== header;
    if (changed) {
      if (header) resize.unobserve(header);
      header = next;
      if (header) resize.observe(header);
    }
    const nextPanels = Array.from(document.querySelectorAll<HTMLElement>('[data-snapshot-panel], #activity-feed'));
    for (const panel of footerPanels) if (!nextPanels.includes(panel)) { resize.unobserve(panel); changed = true; }
    for (const panel of nextPanels) if (!footerPanels.includes(panel)) { resize.observe(panel); changed = true; }
    footerPanels = nextPanels;
    if (changed) measure();
  };
  resize.observe(controls);
  findHud();
  measure();
  // HUD and scene use separate React roots, so either may mount first.
  const hudRoot = document.getElementById('hud-root');
  const mount = new MutationObserver(findHud);
  if (hudRoot) mount.observe(hudRoot, { childList: true, subtree: true });
  window.addEventListener('resize', measure);
  return () => {
    disposed = true;
    resize.disconnect();
    mount.disconnect();
    window.removeEventListener('resize', measure);
    scene.style.removeProperty('--scene-hud-bottom');
    scene.style.removeProperty('--scene-controls-bottom');
    scene.style.removeProperty('--scene-nav-bottom');
  };
}
