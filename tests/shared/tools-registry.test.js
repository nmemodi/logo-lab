import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

function loadRegistry(window) {
  const src = fs.readFileSync(
    path.resolve(__dirname, '../../shared/tools-registry.js'),
    'utf8'
  );
  // eslint-disable-next-line no-new-func
  const fn = new Function('window', 'document', 'location', src);
  fn(window, window.document, window.location);
}

describe('tools-registry', () => {
  let dom;
  let window;

  beforeEach(() => {
    dom = new JSDOM('<html><body></body></html>', { url: 'https://natemodi.com/logo/line-warp/' });
    window = dom.window;
    loadRegistry(window);
  });

  it('exposes window.LogoTools', () => {
    expect(window.LogoTools).toBeDefined();
    expect(Array.isArray(window.LogoTools.TOOLS)).toBe(true);
  });

  it('has exactly 10 tools', () => {
    expect(window.LogoTools.TOOLS.length).toBe(10);
  });

  it('every tool has required fields', () => {
    window.LogoTools.TOOLS.forEach(t => {
      expect(typeof t.slug).toBe('string');
      expect(t.slug.length).toBeGreaterThan(0);
      expect(/^[a-z-]+$/.test(t.slug)).toBe(true);
      expect(typeof t.name).toBe('string');
      expect(typeof t.tagline).toBe('string');
      expect(typeof t.blurb).toBe('string');
      expect(typeof t.defaultSeed).toBe('string');
      expect(/^[a-zA-Z0-9_-]{1,32}$/.test(t.defaultSeed)).toBe(true);
      expect(typeof t.svg).toBe('string');
      expect(t.svg.startsWith('<svg')).toBe(true);
    });
  });

  it('every tool has a well-formed credit block', () => {
    window.LogoTools.TOOLS.forEach(t => {
      expect(t.credit).toBeDefined();
      expect(typeof t.credit.work).toBe('string');
      expect(t.credit.work.length).toBeGreaterThan(0);
      expect(Array.isArray(t.credit.designers)).toBe(true);
      expect(t.credit.designers.length).toBeGreaterThan(0);
      // year is number or decade-string like "1970s"
      expect(['number', 'string']).toContain(typeof t.credit.year);
      // work url is either a logobook.com /logo/ URL or null
      if (t.credit.url !== null) {
        expect(typeof t.credit.url).toBe('string');
        expect(t.credit.url.startsWith('https://logobook.com/logo/')).toBe(true);
      }
      // each designer is an object with name and an optional url
      t.credit.designers.forEach(d => {
        expect(typeof d).toBe('object');
        expect(typeof d.name).toBe('string');
        expect(d.name.length).toBeGreaterThan(0);
        if (d.url) {
          expect(typeof d.url).toBe('string');
          expect(d.url.startsWith('https://logobook.com/designer/')).toBe(true);
        }
      });
    });
  });

  it('all slugs are unique', () => {
    const slugs = window.LogoTools.TOOLS.map(t => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('toolPath builds /logo/<slug>/ correctly', () => {
    expect(window.LogoTools.toolPath('line-warp')).toBe('/logo/line-warp/');
  });

  it('findBySlug returns the matching tool or null', () => {
    expect(window.LogoTools.findBySlug('line-warp').slug).toBe('line-warp');
    expect(window.LogoTools.findBySlug('does-not-exist')).toBe(null);
  });

  it('currentIndex returns 0 for line-warp at /logo/line-warp/', () => {
    expect(window.LogoTools.currentIndex()).toBe(0);
  });

  it('currentIndex returns -1 for a non-tool path', () => {
    const otherDom = new JSDOM('<html><body></body></html>', { url: 'https://natemodi.com/' });
    loadRegistry(otherDom.window);
    expect(otherDom.window.LogoTools.currentIndex()).toBe(-1);
  });
});
