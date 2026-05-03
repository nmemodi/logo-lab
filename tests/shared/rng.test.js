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

let LogoRNG;
beforeAll(() => {
  LogoRNG = loadShared('rng.js').LogoRNG;
});

describe('rng.coerceSeed', () => {
  it('returns 1 for undefined/null/NaN', () => {
    expect(LogoRNG.coerceSeed(undefined)).toBe(1);
    expect(LogoRNG.coerceSeed(null)).toBe(1);
    expect(LogoRNG.coerceSeed(NaN)).toBe(1);
    expect(LogoRNG.coerceSeed('not a number')).toBe(1);
  });

  it('returns 1 for zero or negative seeds', () => {
    expect(LogoRNG.coerceSeed(0)).toBe(1);
    expect(LogoRNG.coerceSeed(-5)).toBe(1);
  });

  it('coerces valid seeds to uint32', () => {
    expect(LogoRNG.coerceSeed(42)).toBe(42);
    expect(LogoRNG.coerceSeed('123')).toBe(123);
    expect(LogoRNG.coerceSeed(3.7)).toBe(3);
  });
});

describe('rng.mulberry32', () => {
  it('is deterministic for the same seed', () => {
    const a = LogoRNG.mulberry32(42);
    const b = LogoRNG.mulberry32(42);
    for (let i = 0; i < 100; i++) {
      expect(a()).toBe(b());
    }
  });

  it('produces different sequences for different seeds', () => {
    const a = LogoRNG.mulberry32(1);
    const b = LogoRNG.mulberry32(2);
    let diffCount = 0;
    for (let i = 0; i < 20; i++) {
      if (a() !== b()) diffCount++;
    }
    expect(diffCount).toBeGreaterThan(15);
  });

  it('returns values in [0, 1)', () => {
    const r = LogoRNG.mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('algorithm is pinned — first 5 values for seed=42 (canary)', () => {
    // If this ever fails, someone changed the RNG algorithm and broke every
    // seeded permalink in the wild. Bump SCHEMA_VERSION in permalink.js instead.
    const r = LogoRNG.mulberry32(42);
    const got = [r(), r(), r(), r(), r()].map(v => v.toFixed(10));
    expect(got).toMatchSnapshot();
  });

  it('handles undefined seed without crashing', () => {
    const r = LogoRNG.mulberry32();
    expect(typeof r()).toBe('number');
  });
});

describe('rng.randomSeed', () => {
  it('returns a non-zero integer', () => {
    for (let i = 0; i < 50; i++) {
      const s = LogoRNG.randomSeed();
      expect(s).toBeGreaterThan(0);
      expect(Number.isInteger(s)).toBe(true);
    }
  });
});
