/* ═══════════════════════════════════════════════════════════════
   LOGO TOOLS — Seeded RNG
   Deterministic pseudo-random number generator for reproducible
   Randomize output. Pinned to mulberry32 for schema v=1.

   DO NOT change the algorithm — shared URLs with a seed rely on
   this exact sequence forever. A new algorithm requires a new
   schema version tag in permalink.js.
   ═══════════════════════════════════════════════════════════════ */

(function () {
  function coerceSeed(seed) {
    const n = Math.floor(Number(seed));
    if (!Number.isFinite(n) || n <= 0) return 1;
    return n >>> 0;
  }

  function mulberry32(seedInput) {
    let a = coerceSeed(seedInput);
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randomSeed() {
    return (Math.floor(Math.random() * 0xFFFFFFFF) >>> 0) || 1;
  }

  window.LogoRNG = {
    mulberry32,
    randomSeed,
    coerceSeed,
  };
})();
