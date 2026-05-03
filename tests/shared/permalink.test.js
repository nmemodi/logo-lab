// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function loadSharedInto(name, globalObj) {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'shared', name), 'utf8');
  const fn = new Function('window', 'document', 'history', 'navigator', 'setTimeout', 'clearTimeout', 'requestAnimationFrame', 'console', 'URLSearchParams', src);
  fn(globalObj, globalObj.document, globalObj.history, globalObj.navigator, setTimeout, clearTimeout, requestAnimationFrame, console, URLSearchParams);
}

function makeSchema(LS) {
  return {
    c:  LS.INT_RANGE(1, 12, 3),
    bg: LS.COLOR('#111111'),
    sh: LS.ENUM(['circle', 'square'], 'circle'),
    sd: LS.SEED(0),
  };
}

function setup(hash = '') {
  // Reset window for a clean run
  if (hash) window.location.hash = hash;
  else history.replaceState(null, '', window.location.pathname);

  delete window.__hasPermalink;
  // Remove any injected permalink DOM from prior test
  document.querySelectorAll('.permalink-pill, .remix-chip, .toast, .permalink-help, .permalink-copy-modal').forEach(n => n.remove());

  loadSharedInto('schema-helpers.js', window);
  loadSharedInto('rng.js', window);
  loadSharedInto('permalink.js', window);

  const schema = makeSchema(window.LogoSchema);
  const state = { c: 3, bg: '#111111', sh: 'circle', sd: 0 };
  const applyState = vi.fn(s => Object.assign(state, s));

  const pm = new window.PermalinkManager({
    toolName: 'test-tool',
    schema,
    getState: () => ({ ...state }),
    applyState,
  });

  return { pm, state, applyState, schema };
}

describe('PermalinkManager basic lifecycle', () => {
  beforeEach(() => {
    history.replaceState(null, '', '/');
    document.body.innerHTML = '';
  });

  it('no hash → no decode, defaults preserved', () => {
    const { pm, applyState } = setup('');
    pm.decode();
    expect(applyState).not.toHaveBeenCalled();
  });

  it('sets window.__hasPermalink on construction', () => {
    setup('');
    expect(window.__hasPermalink).toBe(true);
  });

  it('injects the permalink pill into DOM', () => {
    setup('');
    expect(document.querySelector('.permalink-pill')).toBeTruthy();
  });
});

describe('PermalinkManager decode', () => {
  beforeEach(() => {
    history.replaceState(null, '', '/');
    document.body.innerHTML = '';
  });

  it('applies valid hash', () => {
    const { pm, applyState, state } = setup('#v=1&c=7&bg=ff0000&sh=square');
    pm.decode();
    expect(applyState).toHaveBeenCalled();
    expect(state.c).toBe(7);
    expect(state.bg).toBe('#ff0000');
    expect(state.sh).toBe('square');
  });

  it('clamps out-of-range value', () => {
    const { pm, state } = setup('#v=1&c=999');
    pm.decode();
    expect(state.c).toBe(12); // schema max
  });

  it('falls back to default for bad value (per-key recovery)', () => {
    const { pm, state } = setup('#v=1&c=7&bg=zzzzzz');
    pm.decode();
    expect(state.c).toBe(7);         // good key preserved
    expect(state.bg).toBe('#111111'); // bad key reverted to default
  });

  it('shows toast for malformed hash, does not apply', () => {
    // No v= parameter → malformed
    const { pm, applyState } = setup('#totally-broken');
    pm.decode();
    expect(applyState).not.toHaveBeenCalled();
    expect(document.querySelector('.toast')).toBeTruthy();
  });

  it('rejects version mismatch', () => {
    const { pm, applyState } = setup('#v=99&c=5');
    pm.decode();
    expect(applyState).not.toHaveBeenCalled();
    expect(document.querySelector('.toast')).toBeTruthy();
  });

  it('aborts on oversized hash', () => {
    const big = '#' + 'x'.repeat(3000);
    const { pm, applyState } = setup(big);
    pm.decode();
    expect(applyState).not.toHaveBeenCalled();
  });

  it('ignores unknown keys (forward compat)', () => {
    const { pm, state } = setup('#v=1&c=5&futureKey=xyz');
    pm.decode();
    expect(state.c).toBe(5);
  });

  it('rejects XSS attempt in text field, uses default', () => {
    const LS = (() => { const w = {}; new Function('window', fs.readFileSync(path.join(__dirname, '..', '..', 'shared', 'schema-helpers.js'), 'utf8'))(w); return w.LogoSchema; })();
    loadSharedInto('schema-helpers.js', window);
    loadSharedInto('rng.js', window);
    loadSharedInto('permalink.js', window);
    const schema = {
      ch: LS.TEXT({ charset: /^[A-Z]$/, maxLen: 1, def: 'A' }),
    };
    const state = { ch: 'A' };
    window.location.hash = '#v=1&ch=' + encodeURIComponent('<script>alert(1)</script>');
    const pm = new window.PermalinkManager({
      toolName: 'xss-test',
      schema,
      getState: () => ({ ...state }),
      applyState: s => Object.assign(state, s),
    });
    pm.decode();
    expect(state.ch).toBe('A');
  });

  it('shows remix chip after loading from hash', () => {
    const { pm } = setup('#v=1&c=5');
    pm.decode();
    expect(document.querySelector('.remix-chip')).toBeTruthy();
  });
});

describe('PermalinkManager encode/update/flush', () => {
  beforeEach(() => {
    history.replaceState(null, '', '/');
    document.body.innerHTML = '';
  });

  it('getPermalink returns canonical URL with version tag', () => {
    const { pm } = setup('');
    const url = pm.getPermalink();
    expect(url).toContain('#v=1');
  });

  it('strips default values for brevity', () => {
    const { pm } = setup('');
    const url = pm.getPermalink();
    // All params are defaults → only v= should be present
    expect(url.split('&').length).toBe(1);
    expect(url).toMatch(/#v=1$/);
  });

  it('encodes keys in sorted order', () => {
    const { pm, state } = setup('');
    state.c = 5; state.sh = 'square';
    const url = pm.getPermalink();
    const hash = url.split('#')[1];
    const keys = hash.split('&').map(p => p.split('=')[0]);
    const noV = keys.filter(k => k !== 'v');
    const sorted = [...noV].sort();
    expect(noV).toEqual(sorted);
  });

  it('flush writes hash immediately', () => {
    const { pm, state } = setup('');
    state.c = 9;
    pm.flush();
    expect(window.location.hash).toContain('c=9');
  });

  it('update debounces and eventually writes', async () => {
    vi.useFakeTimers();
    const { pm, state } = setup('');
    state.c = 4;
    pm.update();
    expect(window.location.hash).not.toContain('c=4');
    vi.advanceTimersByTime(250);
    expect(window.location.hash).toContain('c=4');
    vi.useRealTimers();
  });

  it('canonicalizes on decode (re-encodes after load)', () => {
    const { pm } = setup('#v=1&c=3');  // c=3 is default → should be stripped
    pm.decode();
    // After canonicalize, c=3 should be gone (it's the default)
    expect(window.location.hash).not.toContain('c=3');
    expect(window.location.hash).toContain('v=1');
  });
});

describe('PermalinkManager round-trip', () => {
  beforeEach(() => {
    history.replaceState(null, '', '/');
    document.body.innerHTML = '';
  });

  it('encode → decode yields same state', () => {
    const { pm, state } = setup('');
    state.c = 7;
    state.bg = '#abcdef';
    state.sh = 'square';
    state.sd = 42;
    const url = pm.getPermalink();
    const hash = url.split('#')[1];

    // Fresh setup with produced hash
    history.replaceState(null, '', '/');
    document.body.innerHTML = '';
    const fresh = setup('#' + hash);
    fresh.pm.decode();
    expect(fresh.state.c).toBe(7);
    expect(fresh.state.bg).toBe('#abcdef');
    expect(fresh.state.sh).toBe('square');
    expect(fresh.state.sd).toBe(42);
  });
});
