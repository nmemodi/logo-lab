import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

function loadEmbed(window) {
  const src = fs.readFileSync(
    path.resolve(__dirname, '../../shared/tools-embed.js'),
    'utf8'
  );
  // eslint-disable-next-line no-new-func
  const fn = new Function(
    'window', 'document', 'ResizeObserver', 'setTimeout', 'setInterval',
    src
  );
  fn(
    window,
    window.document,
    window.ResizeObserver,
    window.setTimeout.bind(window),
    window.setInterval.bind(window)
  );
}

describe('tools-embed — iframe detection', () => {
  it('does nothing when not in an iframe (window === window.parent)', () => {
    const dom = new JSDOM(
      '<html><body><div class="permalink-pill"></div></body></html>',
      { url: 'https://natemodi.com/logo/line-warp/' }
    );
    // jsdom: window.parent === window by default
    loadEmbed(dom.window);
    expect(dom.window.document.documentElement.getAttribute('data-embedded')).toBe(null);
  });

  it('sets data-embedded="true" when window !== window.parent', () => {
    const dom = new JSDOM(
      '<html><body></body></html>',
      { url: 'https://natemodi.com/logo/line-warp/' }
    );
    // Simulate iframe: rewire parent to a different window
    const fakeParent = { postMessage: vi.fn() };
    Object.defineProperty(dom.window, 'parent', {
      get() { return fakeParent; },
      configurable: true,
    });
    loadEmbed(dom.window);
    expect(dom.window.document.documentElement.getAttribute('data-embedded')).toBe('true');
  });

  it('handles SecurityError from window.parent access', () => {
    const dom = new JSDOM(
      '<html><body></body></html>',
      { url: 'https://natemodi.com/logo/line-warp/' }
    );
    Object.defineProperty(dom.window, 'parent', {
      get() { throw new Error('SecurityError'); },
      configurable: true,
    });
    // Should not throw
    expect(() => loadEmbed(dom.window)).not.toThrow();
    // And treat as not-embedded (can't confirm iframe → default to standalone)
    expect(dom.window.document.documentElement.getAttribute('data-embedded')).toBe(null);
  });

  it('posts height messages to parent with logo-lab-embed source', async () => {
    const dom = new JSDOM(
      '<html><body><div>content</div></body></html>',
      { url: 'https://natemodi.com/logo/line-warp/' }
    );
    // jsdom has no layout engine — stub scrollHeight so embed.js posts a positive height
    Object.defineProperty(dom.window.HTMLElement.prototype, 'scrollHeight', {
      configurable: true,
      get() { return 400; },
    });
    const posted = [];
    const fakeParent = {
      postMessage: (data, origin) => posted.push({ data, origin }),
    };
    Object.defineProperty(dom.window, 'parent', {
      get() { return fakeParent; },
      configurable: true,
    });
    loadEmbed(dom.window);
    // allow scheduled setTimeout(0/50) initial posts to fire
    await new Promise(r => setTimeout(r, 300));
    const heightPosts = posted.filter(p => p.data && p.data.source === 'logo-lab-embed');
    expect(heightPosts.length).toBeGreaterThan(0);
    expect(typeof heightPosts[0].data.height).toBe('number');
    expect(heightPosts[0].data.height).toBeGreaterThan(0);
  });
});

describe('tools-embed — message contract (parent-side validator spec)', () => {
  /* The landing page validates incoming messages strictly. This test
     documents the contract that lives in logo/index.html. */

  const ORIGIN = 'https://natemodi.com';

  function isValid(e) {
    if (e.origin !== ORIGIN) return false;
    if (!e.data || e.data.source !== 'logo-lab-embed') return false;
    const h = e.data.height;
    if (typeof h !== 'number' || !isFinite(h) || h <= 0 || h > 2000) return false;
    return true;
  }

  it('accepts a well-formed message from the same origin', () => {
    const e = { origin: ORIGIN, data: { source: 'logo-lab-embed', height: 400 } };
    expect(isValid(e)).toBe(true);
  });

  it('rejects a cross-origin message', () => {
    const e = { origin: 'https://evil.example', data: { source: 'logo-lab-embed', height: 400 } };
    expect(isValid(e)).toBe(false);
  });

  it('rejects a message without the expected source key', () => {
    const e = { origin: ORIGIN, data: { source: 'something-else', height: 400 } };
    expect(isValid(e)).toBe(false);
  });

  it('rejects a height above the upper bound (DOS guard)', () => {
    const e = { origin: ORIGIN, data: { source: 'logo-lab-embed', height: 99999 } };
    expect(isValid(e)).toBe(false);
  });

  it('rejects a non-number height', () => {
    const e = { origin: ORIGIN, data: { source: 'logo-lab-embed', height: '400' } };
    expect(isValid(e)).toBe(false);
  });

  it('rejects a zero or negative height', () => {
    expect(isValid({ origin: ORIGIN, data: { source: 'logo-lab-embed', height: 0 } })).toBe(false);
    expect(isValid({ origin: ORIGIN, data: { source: 'logo-lab-embed', height: -5 } })).toBe(false);
  });
});

describe('tools-embed — seed whitelist (embed URL contract)', () => {
  const SEED_RE = /^[a-zA-Z0-9_-]{1,32}$/;

  it('accepts plain digits', () => { expect(SEED_RE.test('42')).toBe(true); });
  it('accepts letters + digits + _-', () => { expect(SEED_RE.test('abc_123-xyz')).toBe(true); });
  it('rejects empty', () => { expect(SEED_RE.test('')).toBe(false); });
  it('rejects XSS attempt', () => { expect(SEED_RE.test('<script>')).toBe(false); });
  it('rejects length > 32', () => { expect(SEED_RE.test('a'.repeat(33))).toBe(false); });
  it('rejects spaces', () => { expect(SEED_RE.test('foo bar')).toBe(false); });
  it('rejects quote chars', () => { expect(SEED_RE.test("it's")).toBe(false); });
});
