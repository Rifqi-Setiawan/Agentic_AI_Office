import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import { observeSceneLayout } from './SceneLayout';

function layoutFixture(headerBottom: number | null = 303, controlsHeight = 88) {
  const properties = new Map<string, string>();
  const geometry = { headerBottom, controlsHeight, sceneTop: 0, mobile: true };
  const header = { getBoundingClientRect: () => ({ bottom: geometry.headerBottom }) };
  let currentHeader: typeof header | null = headerBottom === null ? null : header;
  const hudRoot = {};
  const footerPanels: HTMLElement[] = [];
  const window = { addEventListener: vi.fn(), removeEventListener: vi.fn() };
  const document = { defaultView: window, querySelector: vi.fn(() => currentHeader),
    querySelectorAll: vi.fn(() => footerPanels), getElementById: vi.fn(() => hudRoot) };
  const style = { setProperty: vi.fn((key: string, value: string) => properties.set(key, value)),
    removeProperty: vi.fn((key: string) => properties.delete(key)) };
  const scene = { ownerDocument: document, style, getBoundingClientRect: () => ({ top: geometry.sceneTop, bottom: 844 }) } as unknown as HTMLElement;
  const controls = { getBoundingClientRect: () => ({ bottom: geometry.mobile
    ? geometry.sceneTop + Number.parseFloat(properties.get('--scene-hud-bottom') ?? '0') + geometry.controlsHeight : 0 }) } as HTMLElement;
  const resize = { observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() };
  const mount = { observe: vi.fn(), disconnect: vi.fn() };
  let onResize: () => void = () => {}, onMount: () => void = () => {};
  vi.stubGlobal('ResizeObserver', vi.fn(function (callback: () => void) { onResize = callback; return resize; }));
  vi.stubGlobal('MutationObserver', vi.fn(function (callback: () => void) { onMount = callback; return mount; }));
  return { scene, controls, header, hudRoot, footerPanels, geometry, document, window, style, properties, resize, mount,
    resized: () => onResize(), mounted: () => onMount(), setHeader: (next: typeof header | null) => { currentHeader = next; } };
}

afterEach(() => vi.unstubAllGlobals());

describe('mobile scene clearance below the independent HUD root', () => {
  it('uses the complete measured HUD rather than the old 232px/255px mobile offsets', () => {
    const f = layoutFixture(303.25, 88.5);
    const cleanup = observeSceneLayout(f.scene, f.controls);
    expect(f.document.querySelector).toHaveBeenCalledWith('[data-hud-header]');
    expect(f.resize.observe.mock.calls).toEqual([[f.controls], [f.header]]);
    expect(f.properties.get('--scene-hud-bottom')).toBe('304px');
    expect(f.properties.get('--scene-controls-bottom')).toBe('393px');
    cleanup();
  });

  it.each([377.25, 195])('follows a HUD resized to %spx and measures controls after moving them', headerBottom => {
    const f = layoutFixture();
    const cleanup = observeSceneLayout(f.scene, f.controls);
    f.geometry.headerBottom = headerBottom;
    f.resized();
    expect(f.properties.get('--scene-hud-bottom')).toBe(`${Math.ceil(headerBottom)}px`);
    expect(f.properties.get('--scene-controls-bottom')).toBe(`${Math.ceil(headerBottom) + 88}px`);
    cleanup();
  });

  it('reserves additional space when the notice or room toggle wraps without a window resize', () => {
    const f = layoutFixture();
    const cleanup = observeSceneLayout(f.scene, f.controls);
    f.geometry.controlsHeight = 127;
    f.resized();
    expect(f.properties.get('--scene-controls-bottom')).toBe('430px');
    cleanup();
  });

  it('remeasures across desktop/mobile breakpoints and uses scene-relative coordinates', () => {
    const f = layoutFixture(112);
    f.geometry.mobile = false;
    const cleanup = observeSceneLayout(f.scene, f.controls);
    expect(f.properties.get('--scene-controls-bottom')).toBe('112px');
    const [event, callback] = f.window.addEventListener.mock.calls[0];
    expect(event).toBe('resize');
    f.geometry.mobile = true;
    f.geometry.sceneTop = 20;
    f.geometry.headerBottom = 323;
    callback();
    expect(f.properties.get('--scene-hud-bottom')).toBe('303px');
    expect(f.properties.get('--scene-controls-bottom')).toBe('391px');
    cleanup();
    expect(f.window.removeEventListener).toHaveBeenCalledWith('resize', callback);
  });

  it('discovers a HUD mounted after the scene and detaches any replaced header', () => {
    const f = layoutFixture(null);
    const cleanup = observeSceneLayout(f.scene, f.controls);
    expect(f.properties.get('--scene-hud-bottom')).toBe('0px');
    expect(f.mount.observe).toHaveBeenCalledWith(f.hudRoot, { childList: true, subtree: true });
    f.geometry.headerBottom = 303;
    f.setHeader(f.header);
    f.mounted();
    expect(f.resize.observe).toHaveBeenCalledWith(f.header);
    expect(f.properties.get('--scene-controls-bottom')).toBe('391px');
    const replacement = { getBoundingClientRect: () => ({ bottom: 340 }) };
    f.setHeader(replacement);
    f.mounted();
    expect(f.resize.unobserve).toHaveBeenCalledWith(f.header);
    expect(f.resize.observe).toHaveBeenCalledWith(replacement);
    expect(f.properties.get('--scene-controls-bottom')).toBe('428px');
    cleanup();
  });

  it('disconnects on unmount and ignores already queued callbacks before a new mount', () => {
    const f = layoutFixture();
    const cleanup = observeSceneLayout(f.scene, f.controls);
    cleanup();
    expect(f.resize.disconnect).toHaveBeenCalledOnce();
    expect(f.mount.disconnect).toHaveBeenCalledOnce();
    expect(f.properties.size).toBe(0);
    f.style.setProperty.mockClear();
    f.resize.observe.mockClear();
    f.setHeader({ getBoundingClientRect: () => ({ bottom: 600 }) });
    f.resized();
    f.mounted();
    expect(f.style.setProperty).not.toHaveBeenCalled();
    expect(f.resize.observe).not.toHaveBeenCalled();
    const cleanupNext = observeSceneLayout(f.scene, f.controls);
    expect(f.properties.get('--scene-controls-bottom')).toBe('688px');
    cleanupNext();
  });

  it('keeps the scrollable menu above visible snapshot/activity panels and follows expansion', () => {
    const f = layoutFixture();
    const snapshotRect = { top: 711, width: 222, height: 39 };
    const snapshot = { getBoundingClientRect: () => snapshotRect } as HTMLElement;
    const activity = { getBoundingClientRect: () => ({ top: 761, width: 320, height: 39 }) } as HTMLElement;
    f.footerPanels.push(snapshot, activity);
    const cleanup = observeSceneLayout(f.scene, f.controls);
    expect(f.resize.observe).toHaveBeenCalledWith(snapshot);
    expect(f.resize.observe).toHaveBeenCalledWith(activity);
    expect(f.properties.get('--scene-nav-bottom')).toBe('133px');
    snapshotRect.top = 580; snapshotRect.height = 170;
    f.resized();
    expect(f.properties.get('--scene-nav-bottom')).toBe('264px');
    expect(f.properties.get('--scene-controls-bottom')).toBe('391px');
    snapshotRect.width = 0; snapshotRect.height = 0;
    f.resized();
    expect(f.properties.get('--scene-nav-bottom')).toBe('83px');
    f.footerPanels.splice(0);
    f.mounted();
    expect(f.resize.unobserve).toHaveBeenCalledWith(snapshot);
    expect(f.resize.unobserve).toHaveBeenCalledWith(activity);
    expect(f.properties.get('--scene-nav-bottom')).toBe('0px');
    cleanup();
  });

  it('applies measured offsets only below 700px while retaining desktop geometry and scrolling', () => {
    const css = postcss.parse(readFileSync(new URL('./scene.css', import.meta.url), 'utf8'));
    const desktop = (selector: string, property: string) => {
      const rule = css.nodes.find(node => node.type === 'rule' && node.selector === selector);
      if (rule?.type !== 'rule') throw new Error(`Missing desktop rule: ${selector}`);
      const declaration = rule.nodes.find(node => node.type === 'decl' && node.prop === property);
      return declaration?.type === 'decl' ? declaration.value : undefined;
    };
    expect(desktop('.scene-controls', 'display')).toBe('contents');
    expect(desktop('.scene-viewport', 'inset')).toBe('145px 0 0 202px');
    expect(desktop('.scene-nav', 'top')).toBe('132px');
    expect(desktop('.scene-nav', 'bottom')).toBe('72px');
    expect(desktop('.scene-nav', 'overflow-y')).toBe('auto');
    expect(desktop('.migration-notice', 'top')).toBe('118px');
    expect(desktop('.mobile-room-toggle', 'display')).toBe('none');
    const measured = new Set<string>();
    css.walkDecls(declaration => {
      if (!declaration.value.includes('var(--scene-')) return;
      measured.add(declaration.prop);
      const media = declaration.parent?.parent;
      expect(media?.type).toBe('atrule');
      if (media?.type === 'atrule') expect([media.name, media.params]).toEqual(['media', '(max-width:700px)']);
    });
    expect([...measured].sort()).toEqual(['bottom', 'inset', 'top']);
  });
});
