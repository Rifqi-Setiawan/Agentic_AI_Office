import { MAX_ACTIVE_BUBBLES } from './types';
import { createDomElement } from './mockDom';

export class BubblePool {
  private container: HTMLElement;
  private pool: HTMLElement[] = [];
  private activeElements = new Set<HTMLElement>();
  private readonly maxElements: number;

  constructor(container: HTMLElement, maxElements: number = MAX_ACTIVE_BUBBLES) {
    this.container = container;
    this.maxElements = maxElements;
    this.initPool();
  }

  /**
   * Membuat pool elemen DOM overlay awal.
   */
  private initPool(): void {
    for (let i = 0; i < this.maxElements; i++) {
      const el = this.createBubbleElement(i);
      this.container.appendChild(el);
      this.pool.push(el);
    }
  }

  /**
   * Konstruksi satu elemen DOM speech bubble berarsitektur cozy-tech & anti-AI-slop:
   * - Void/Outline charcoal theme (#1a1c29)
   * - Tabular-nums untuk angka finansial/metrik
   * - Pointer events none agar klik tembus ke Pixi canvas
   * - Downward tail pointing to agent anchor
   */
  private createBubbleElement(index: number): HTMLElement {
    const wrapper = createDomElement('div');
    wrapper.className = 'agent-bubble-wrapper fixed top-0 left-0 pointer-events-none select-none transition-opacity duration-150 ease-out';
    wrapper.dataset.poolIndex = String(index);
    wrapper.style.display = 'none';
    wrapper.style.opacity = '0';
    wrapper.style.transform = 'translate3d(-9999px, -9999px, 0)';
    wrapper.style.willChange = 'transform, opacity';
    wrapper.style.zIndex = '15';
    wrapper.setAttribute('role', 'status');
    wrapper.setAttribute('aria-live', 'polite');

    const bubbleBox = createDomElement('div');
    bubbleBox.className = 'agent-bubble-box relative bg-[#1a1c29]/95 border border-[#3b4261] rounded-lg px-2.5 py-1.5 shadow-[0_8px_20px_-2px_rgba(0,0,0,0.65),0_2px_6px_-1px_rgba(0,0,0,0.4)] text-xs text-[#f5f0e1] max-w-[220px] backdrop-blur-[2px]';

    // Header: Dot warna khas agen + nama agen
    const header = createDomElement('div');
    header.className = 'agent-bubble-header flex items-center gap-1.5 mb-0.5 text-[10px] font-semibold text-[#8892b0]';

    const dot = createDomElement('span');
    dot.className = 'agent-bubble-dot w-1.5 h-1.5 rounded-full inline-block shrink-0';
    dot.style.backgroundColor = '#2bb3c0';

    const nameText = createDomElement('span');
    nameText.className = 'agent-bubble-name font-medium tracking-tight';
    nameText.textContent = 'Agent';

    header.appendChild(dot);
    header.appendChild(nameText);

    // Body: Teks dialog dengan tabular-nums
    const bodyText = createDomElement('p');
    bodyText.className = 'agent-bubble-text text-[#f5f0e1] leading-tight font-normal break-words m-0 tabular-nums';

    // Tail / Panah penunjuk ke bawah
    const tailOuter = createDomElement('div');
    tailOuter.className = 'agent-bubble-tail-outer absolute left-1/2 -bottom-[6px] -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-[#3b4261] pointer-events-none';

    const tailInner = createDomElement('div');
    tailInner.className = 'agent-bubble-tail-inner absolute -top-[7px] -left-[5px] w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[5px] border-t-[#1a1c29]';
    tailOuter.appendChild(tailInner);

    bubbleBox.appendChild(header);
    bubbleBox.appendChild(bodyText);
    bubbleBox.appendChild(tailOuter);
    wrapper.appendChild(bubbleBox);

    return wrapper;
  }

  /**
   * Mengambil elemen DOM kosong dari pool.
   * Mengembalikan null jika pool sedang penuh.
   */
  public acquire(): HTMLElement | null {
    const el = this.pool.pop();
    if (!el) {
      return null;
    }
    this.activeElements.add(el);
    return el;
  }

  /**
   * Mengembalikan elemen DOM ke pool dan mereset status tampilannya.
   */
  public release(el: HTMLElement): void {
    if (!this.activeElements.has(el)) {
      return;
    }
    this.activeElements.delete(el);
    this.hide(el);
    this.pool.push(el);
  }

  /**
   * Memperbarui konten visual bubble (nama agen, warna, teks).
   */
  public setContent(
    el: HTMLElement,
    data: { agentName: string; text: string; signatureColor?: string },
  ): void {
    const nameEl = el.querySelector<HTMLElement>('.agent-bubble-name');
    const dotEl = el.querySelector<HTMLElement>('.agent-bubble-dot');
    const textEl = el.querySelector<HTMLElement>('.agent-bubble-text');
    const boxEl = el.querySelector<HTMLElement>('.agent-bubble-box');

    if (nameEl) nameEl.textContent = data.agentName;
    if (dotEl && data.signatureColor) dotEl.style.backgroundColor = data.signatureColor;
    if (textEl) textEl.textContent = data.text;
    if (boxEl && data.signatureColor) {
      // Aksen border halus sesuai signature color
      boxEl.style.borderColor = `${data.signatureColor}66`;
    }
  }

  /**
   * Memperbarui posisi koordinat layar (screenX, screenY) secara langsung per frame (tanpa React).
   */
  public setPosition(
    el: HTMLElement,
    screenX: number,
    screenY: number,
    screenWidth: number = typeof window !== 'undefined' ? window.innerWidth : 1280,
    screenHeight: number = typeof window !== 'undefined' ? window.innerHeight : 720,
  ): void {
    // Ukuran estimasi bubble box
    const width = el.offsetWidth || 180;
    const height = el.offsetHeight || 50;
    const tailOffset = 8;

    // Anchor titik ujung panah berada di (screenX, screenY)
    let left = screenX - width / 2;
    let top = screenY - height - tailOffset;

    // Viewport edge clamping
    const margin = 12;
    if (left < margin) left = margin;
    if (left + width > screenWidth - margin) left = screenWidth - width - margin;
    if (top < margin) {
      // Jika mentok di atas layar, letakkan di bawah karakter
      top = screenY + 20;
    }
    if (top + height > screenHeight - margin) top = screenHeight - height - margin;

    el.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
  }

  public show(el: HTMLElement): void {
    el.style.display = 'block';
    // Force reflow singkat jika perlu transisi halus
    void el.offsetWidth;
    el.style.opacity = '1';
  }

  public hide(el: HTMLElement): void {
    el.style.opacity = '0';
    el.style.display = 'none';
    el.style.transform = 'translate3d(-9999px, -9999px, 0)';
  }

  public getActiveCount(): number {
    return this.activeElements.size;
  }

  public getAvailableCount(): number {
    return this.pool.length;
  }

  public destroy(): void {
    for (const el of this.pool) {
      el.remove();
    }
    for (const el of this.activeElements) {
      el.remove();
    }
    this.pool = [];
    this.activeElements.clear();
  }
}
