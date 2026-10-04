export class MockElement {
  public tagName: string;
  public className: string = '';
  public id: string = '';
  public style: Record<string, string> = {};
  public dataset: Record<string, string> = {};
  public attributes: Record<string, string> = {};
  public textContent: string = '';
  public children: MockElement[] = [];
  public parentNode: MockElement | null = null;
  public offsetWidth: number = 180;
  public offsetHeight: number = 50;

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase();
  }

  appendChild<T extends MockElement>(child: T): T {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  removeChild<T extends MockElement>(child: T): T {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      child.parentNode = null;
    }
    return child;
  }

  remove(): void {
    if (this.parentNode) {
      this.parentNode.removeChild(this);
    }
  }

  setAttribute(name: string, value: string): void {
    this.attributes[name] = value;
    if (name === 'id') this.id = value;
    if (name === 'class') this.className = value;
  }

  getAttribute(name: string): string | null {
    if (name === 'id') return this.id || null;
    if (name === 'class') return this.className || null;
    return this.attributes[name] ?? null;
  }

  querySelector<T extends MockElement>(selector: string): T | null {
    const all = this.querySelectorAll<T>(selector);
    return all.length > 0 ? all[0] : null;
  }

  querySelectorAll<T extends MockElement>(selector: string): T[] {
    const results: T[] = [];
    const check = (el: MockElement) => {
      if (this.matches(el, selector)) {
        results.push(el as unknown as T);
      }
      for (const c of el.children) {
        check(c);
      }
    };
    for (const c of this.children) {
      check(c);
    }
    return results;
  }

  private matches(el: MockElement, selector: string): boolean {
    if (selector.startsWith('#')) {
      return el.id === selector.slice(1);
    }
    if (selector.includes('[style*="display: block"]')) {
      const withoutStyle = selector.replace('[style*="display: block"]', '');
      const styleMatch = el.style.display === 'block';
      return styleMatch && (withoutStyle ? this.matches(el, withoutStyle) : true);
    }
    if (selector.startsWith('.')) {
      const className = selector.slice(1);
      const classes = (el.className || '').split(/\s+/);
      return classes.includes(className);
    }
    return el.tagName.toLowerCase() === selector.toLowerCase();
  }
}

export function createDomElement(tagName: string): HTMLElement {
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    return document.createElement(tagName);
  }
  return new MockElement(tagName) as unknown as HTMLElement;
}

export function createMockContainer(): HTMLElement {
  return new MockElement('DIV') as unknown as HTMLElement;
}
