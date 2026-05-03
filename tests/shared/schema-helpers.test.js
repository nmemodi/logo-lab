import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function loadShared(name) {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'shared', name), 'utf8');
  const fn = new Function('window', src);
  const w = {};
  fn(w);
  return w;
}

let LS;
beforeAll(() => {
  LS = loadShared('schema-helpers.js').LogoSchema;
});

describe('INT_RANGE', () => {
  it('clamps high', () => {
    const f = LS.INT_RANGE(1, 10, 5);
    expect(f.decode('99')).toEqual({ ok: true, value: 10, reason: 'clamped-hi', clamped: true });
  });
  it('clamps low', () => {
    const f = LS.INT_RANGE(1, 10, 5);
    expect(f.decode('-5')).toEqual({ ok: true, value: 1, reason: 'clamped-lo', clamped: true });
  });
  it('accepts valid value', () => {
    const f = LS.INT_RANGE(1, 10, 5);
    expect(f.decode('7')).toEqual({ ok: true, value: 7 });
  });
  it('rejects non-integer', () => {
    const f = LS.INT_RANGE(1, 10, 5);
    const r = f.decode('abc');
    expect(r.ok).toBe(false);
    expect(r.value).toBe(5);
  });
  it('encodes as integer string', () => {
    expect(LS.INT_RANGE(0, 10, 0).encode(3.7)).toBe('3');
  });
});

describe('FLOAT_RANGE', () => {
  it('rounds to precision on decode', () => {
    const f = LS.FLOAT_RANGE(0, 1, 0.5, 2);
    expect(f.decode('0.3456')).toEqual({ ok: true, value: 0.35 });
  });
  it('clamps', () => {
    const f = LS.FLOAT_RANGE(0, 1, 0.5, 2);
    expect(f.decode('2').value).toBe(1);
    expect(f.decode('-1').value).toBe(0);
  });
  it('rejects non-numeric', () => {
    const f = LS.FLOAT_RANGE(0, 1, 0.5, 2);
    expect(f.decode('zzz').ok).toBe(false);
  });
});

describe('COLOR', () => {
  it('accepts 6-digit hex with or without #', () => {
    const f = LS.COLOR('#000000');
    expect(f.decode('ff00aa')).toEqual({ ok: true, value: '#ff00aa' });
    expect(f.decode('#FF00AA')).toEqual({ ok: true, value: '#ff00aa' });
  });
  it('rejects malformed hex', () => {
    const f = LS.COLOR('#abcdef');
    expect(f.decode('zzzzzz').ok).toBe(false);
    expect(f.decode('zzzzzz').value).toBe('#abcdef');
    expect(f.decode('abc').ok).toBe(false);
    expect(f.decode('12345678').ok).toBe(false);
  });
  it('encodes without #', () => {
    const f = LS.COLOR('#000000');
    expect(f.encode('#ff00aa')).toBe('ff00aa');
  });
  it('normalizes invalid default to black', () => {
    const f = LS.COLOR('garbage');
    expect(f.default).toBe('#000000');
  });
});

describe('ENUM', () => {
  it('accepts declared value', () => {
    const f = LS.ENUM(['a', 'b', 'c'], 'a');
    expect(f.decode('b')).toEqual({ ok: true, value: 'b' });
  });
  it('rejects unknown value', () => {
    const f = LS.ENUM(['a', 'b', 'c'], 'a');
    const r = f.decode('x');
    expect(r.ok).toBe(false);
    expect(r.value).toBe('a');
  });
  it('throws if default not in values', () => {
    expect(() => LS.ENUM(['a'], 'z')).toThrow();
  });
});

describe('BOOL', () => {
  it('parses 0/1', () => {
    const f = LS.BOOL(false);
    expect(f.decode('1')).toEqual({ ok: true, value: true });
    expect(f.decode('0')).toEqual({ ok: true, value: false });
  });
  it('rejects other strings', () => {
    const f = LS.BOOL(true);
    const r = f.decode('yes');
    expect(r.ok).toBe(false);
    expect(r.value).toBe(true);
  });
});

describe('SEED', () => {
  it('base36 round-trip', () => {
    const f = LS.SEED(0);
    expect(f.decode(f.encode(123456))).toEqual({ ok: true, value: 123456 });
  });
  it('rejects garbage', () => {
    const f = LS.SEED(42);
    const r = f.decode('!!!');
    expect(r.ok).toBe(false);
    expect(r.value).toBe(42);
  });
});

describe('TEXT', () => {
  it('rejects chars outside charset', () => {
    const f = LS.TEXT({ charset: /^[A-Z]$/, maxLen: 1, def: 'A' });
    const r = f.decode('<');
    expect(r.ok).toBe(false);
    expect(r.value).toBe('A');
  });
  it('accepts valid char', () => {
    const f = LS.TEXT({ charset: /^[A-Z]$/, maxLen: 1, def: 'A' });
    expect(f.decode('Q')).toEqual({ ok: true, value: 'Q' });
  });
  it('truncates overlong input', () => {
    const f = LS.TEXT({ charset: /^.{1,3}$/u, maxLen: 3, def: 'x' });
    expect(f.decode('abcdef').value).toBe('abc');
  });
  it('decodes URI-encoded chars', () => {
    const f = LS.TEXT({ charset: /^.{1,2}$/u, maxLen: 2, def: 'A' });
    expect(f.decode(encodeURIComponent('é')).value).toBe('é');
  });
  it('rejects empty string', () => {
    const f = LS.TEXT({ charset: /^.$/u, maxLen: 1, def: 'X' });
    expect(f.decode('').ok).toBe(false);
  });
});

describe('xmlEscape', () => {
  it('escapes all five chars', () => {
    expect(LS.xmlEscape('<script>&"\'</script>')).toBe('&lt;script&gt;&amp;&quot;&apos;&lt;/script&gt;');
  });
  it('passes unicode through', () => {
    expect(LS.xmlEscape('日本語')).toBe('日本語');
  });
  it('handles null/undefined', () => {
    expect(LS.xmlEscape(null)).toBe('');
    expect(LS.xmlEscape(undefined)).toBe('');
  });
  it('handles empty string', () => {
    expect(LS.xmlEscape('')).toBe('');
  });
});
