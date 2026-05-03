import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

function loadFontDetect(window) {
  const src = fs.readFileSync(
    path.resolve(__dirname, '../../shared/font-detect.js'),
    'utf8'
  );
  // eslint-disable-next-line no-new-func
  const fn = new Function('window', 'document', src);
  fn(window, window.document);
}

describe('font-detect', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('preloads requested font weights before measuring availability', async () => {
    const dom = new JSDOM('<html><body></body></html>');
    const load = vi.fn(() => Promise.resolve([]));
    Object.defineProperty(dom.window.document, 'fonts', {
      configurable: true,
      value: { load, ready: Promise.resolve() },
    });

    const ctx = {
      font: '',
      measureText() {
        return { width: this.font.includes('"Orbitron"') ? 123 : 100 };
      },
    };
    vi.spyOn(dom.window.HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);

    loadFontDetect(dom.window);

    await expect(
      dom.window.FontDetect.detectAvailableFonts(['Orbitron'], ['900'])
    ).resolves.toEqual(['Orbitron']);
    expect(load).toHaveBeenCalledWith('900 72px "Orbitron"');
  });
});
