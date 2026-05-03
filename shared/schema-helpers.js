/* ═══════════════════════════════════════════════════════════════
   LOGO TOOLS — Schema Helpers
   Typed field factories for permalink schemas + XML escape for
   safe SVG serialization of user-supplied strings.

   Every tool defines its schema using these factories:
     const schema = {
       c:  INT_RANGE(1, 12, 3),
       bg: COLOR('#111111'),
       sh: ENUM(['circle','square','triangle'], 'circle'),
       ch: TEXT({ charset: /^[\p{L}\p{N}\p{P}\p{S}]$/u, maxLen: 1, def: 'A' }),
       sd: SEED(),
     };

   Each factory returns { type, default, encode, decode, validate }.
   ═══════════════════════════════════════════════════════════════ */

(function () {
  /* ─── INT_RANGE: clamped integer ─── */
  function INT_RANGE(min, max, def) {
    return {
      type: 'int',
      default: def,
      min, max,
      encode(v) { return String(v | 0); },
      decode(s) {
        const n = parseInt(s, 10);
        if (!Number.isFinite(n)) return { ok: false, value: def, reason: 'not-int' };
        if (n < min) return { ok: true, value: min, reason: 'clamped-lo', clamped: true };
        if (n > max) return { ok: true, value: max, reason: 'clamped-hi', clamped: true };
        return { ok: true, value: n };
      },
      randomize(rng) {
        return Math.floor(min + rng() * (max - min + 1));
      },
    };
  }

  /* ─── FLOAT_RANGE: clamped float with fixed precision ─── */
  function FLOAT_RANGE(min, max, def, precision = 3) {
    const roundTo = Math.pow(10, precision);
    return {
      type: 'float',
      default: def,
      min, max, precision,
      encode(v) {
        const rounded = Math.round(v * roundTo) / roundTo;
        return String(rounded);
      },
      decode(s) {
        const n = parseFloat(s);
        if (!Number.isFinite(n)) return { ok: false, value: def, reason: 'not-float' };
        if (n < min) return { ok: true, value: min, reason: 'clamped-lo', clamped: true };
        if (n > max) return { ok: true, value: max, reason: 'clamped-hi', clamped: true };
        return { ok: true, value: Math.round(n * roundTo) / roundTo };
      },
      randomize(rng) {
        const v = min + rng() * (max - min);
        return Math.round(v * roundTo) / roundTo;
      },
    };
  }

  /* ─── UNIT_FLOAT: 0..1 clamped, convenience wrapper ─── */
  function UNIT_FLOAT(def, precision = 3) {
    return FLOAT_RANGE(0, 1, def, precision);
  }

  /* ─── Smart color-pair generator (full-color mode) ───
     Pure-random hex pairs produce muddy/clashing combinations most of the
     time. Instead, pick a *scheme*, then sample within it. Schemes and
     weights are derived from the homepage variants — saturated-bg + cream-fg
     dominates, with supporting roles for dark+saturated, deep-with-hue +
     cream, light-neutral + electric, pastel + same-hue dark, and pure-black
     + electric accent. Every pair is contrast-safe by construction. */
  function _hsl2hex(h, s, l) {
    h = ((h % 360) + 360) % 360;
    s = Math.max(0, Math.min(100, s)) / 100;
    l = Math.max(0, Math.min(100, l)) / 100;
    const a = s * Math.min(l, 1 - l);
    const ch = (n) => {
      const k = (n + h / 30) % 12;
      const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
      return Math.round(255 * c).toString(16).padStart(2, '0');
    };
    return '#' + ch(0) + ch(8) + ch(4);
  }

  /* Relative luminance per WCAG. */
  function _relLum(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const f = (x) => x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  }
  function _contrastRatio(a, b) {
    const la = _relLum(a), lb = _relLum(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  function _generateRawPair(rng) {
    const r = (lo, hi) => lo + rng() * (hi - lo);
    const pick = (arr) => arr[Math.floor(rng() * arr.length)];
    const schemes = [
      /* (1) Saturated bg + cream/white fg. Bg L pulled down to 25-38 so
         even green/yellow bgs clear AAA against cream. */
      [6, () => {
        const bg = _hsl2hex(r(0, 360), r(70, 95), r(25, 38));
        const fg = _hsl2hex(r(30, 60), r(3, 18), r(96, 99));
        return [bg, fg];
      }],
      /* (2) PURE near-black bg + saturated bright fg. */
      [3, () => {
        const bg = _hsl2hex(r(0, 360), r(0, 8), r(2, 6));
        const fg = _hsl2hex(r(0, 360), r(70, 90), r(58, 72));
        return [bg, fg];
      }],
      /* (3) Deep dark with subtle hue + warm cream — oxblood/forest/navy. */
      [2, () => {
        const bg = _hsl2hex(r(0, 360), r(40, 70), r(5, 11));
        const fg = _hsl2hex(r(35, 55), r(15, 30), r(94, 97));
        return [bg, fg];
      }],
      /* (4) Cream/warm-light bg + near-black fg. */
      [3, () => {
        const bg = _hsl2hex(r(35, 60), r(10, 25), r(95, 98));
        const fg = _hsl2hex(r(0, 360), r(0, 15), r(4, 11));
        return [bg, fg];
      }],
      /* (5) Pure white bg + brand-saturated fg. L pulled darker so even
         red/blue brand colors clear AAA against white. */
      [2, () => {
        const bg = '#ffffff';
        const brandHues = [0, 14, 28, 200, 220, 245, 280, 320];
        const fh = pick(brandHues) + r(-8, 8);
        const fg = _hsl2hex(fh, r(75, 95), r(28, 42));
        return [bg, fg];
      }],
      /* (6) Pastel bg + same-hue saturated dark fg. Wider L gap (was 56pt,
         now 62pt) for AAA. */
      [1, () => {
        const h = r(0, 360);
        const bg = _hsl2hex(h, r(40, 60), r(90, 95));
        const fg = _hsl2hex(h, r(75, 95), r(15, 28));
        return [bg, fg];
      }],
      /* (7) Pure black bg + electric accent. */
      [1.5, () => {
        const electricHues = [55, 75, 100, 175, 210, 280, 320];
        const fh = pick(electricHues) + r(-8, 8);
        const fg = _hsl2hex(fh, r(85, 100), r(58, 70));
        return ['#000000', fg];
      }],
    ];
    const total = schemes.reduce((s, x) => s + x[0], 0);
    let pickW = rng() * total;
    for (const [w, gen] of schemes) {
      pickW -= w;
      if (pickW <= 0) return gen();
    }
    return schemes[schemes.length - 1][1]();
  }

  /* Rejection sampling targets WCAG AAA (7.0:1) — logos need decisive
     contrast, not the legal minimum. Retry up to 12 attempts; fall back
     to black/white (21:1) if everything fails. */
  function _smartColorPair(rng) {
    for (let i = 0; i < 12; i++) {
      const pair = _generateRawPair(rng);
      if (_contrastRatio(pair[0], pair[1]) >= 7.0) return pair;
    }
    return ['#000000', '#ffffff'];
  }

  /* ─── COLOR: 6-digit lowercase hex, no leading # in URL ─── */
  function COLOR(def) {
    const defClean = normalizeHex(def);
    return {
      type: 'color',
      default: defClean,
      encode(v) { return normalizeHex(v).slice(1); },
      decode(s) {
        if (typeof s !== 'string') return { ok: false, value: defClean, reason: 'not-string' };
        const raw = s.startsWith('#') ? s : '#' + s;
        if (!/^#[0-9a-fA-F]{6}$/.test(raw)) return { ok: false, value: defClean, reason: 'bad-hex' };
        return { ok: true, value: raw.toLowerCase() };
      },
      /* Randomization behavior by palette + field role:
         MONO palette:
           - bg/fg use a pre-computed contrast pair on opts (from permalink).
           - Other color fields use a tightened ramp (no muddy mid-grays).
         FULL palette:
           - bg/fg use _smartColorPair: a scheme-weighted pair generator
             whose schemes mirror the homepage variants. The pair is
             generated once per render and cached on opts so both fields
             draw from the same scheme.
           - Other color fields (borders, accents) stay independent random,
             leaving room for accent pops. */
      randomize(rng, opts, key) {
        if (opts && opts.palette === 'mono') {
          if (key === 'bg' && opts.monoBg) return opts.monoBg;
          if (key === 'fg' && opts.monoFg) return opts.monoFg;
          const ramp = ['#000000','#0d0d0d','#1a1a1a','#e8e8e8','#f4f4f4','#ffffff'];
          return ramp[Math.floor(rng() * ramp.length)];
        }
        if ((key === 'bg' || key === 'fg') && opts) {
          if (!opts._fullPair) opts._fullPair = _smartColorPair(rng);
          return key === 'bg' ? opts._fullPair[0] : opts._fullPair[1];
        }
        const hex = Math.floor(rng() * 0x1000000).toString(16).padStart(6, '0');
        return '#' + hex;
      },
    };
  }

  function normalizeHex(v) {
    if (typeof v !== 'string') return '#000000';
    const raw = v.startsWith('#') ? v : '#' + v;
    return /^#[0-9a-fA-F]{6}$/.test(raw) ? raw.toLowerCase() : '#000000';
  }

  /* ─── ENUM: allowed string set ─── */
  function ENUM(values, def) {
    const set = new Set(values);
    if (!set.has(def)) throw new Error(`ENUM default "${def}" not in values`);
    return {
      type: 'enum',
      default: def,
      values,
      encode(v) { return String(v); },
      decode(s) {
        if (!set.has(s)) return { ok: false, value: def, reason: 'not-in-enum' };
        return { ok: true, value: s };
      },
      randomize(rng) {
        return values[Math.floor(rng() * values.length)];
      },
    };
  }

  /* ─── BOOL: 0 | 1 ─── */
  function BOOL(def) {
    return {
      type: 'bool',
      default: !!def,
      encode(v) { return v ? '1' : '0'; },
      decode(s) {
        if (s === '1') return { ok: true, value: true };
        if (s === '0') return { ok: true, value: false };
        return { ok: false, value: !!def, reason: 'not-bool' };
      },
      randomize(rng) {
        return rng() < 0.5;
      },
    };
  }

  /* ─── WEIGHTED_INT_RANGE / WEIGHTED_FLOAT_RANGE ───
     Same slider/decode bounds as INT_RANGE / FLOAT_RANGE, but the random
     shuffle is biased and/or cropped:
       opts.rmin, opts.rmax — narrower bounds for the random draw only
                              (manual UI input still spans full [min, max])
       opts.pow             — 1 = uniform, <1 biases toward rmax,
                              >1 biases toward rmin
     Use this to keep a control's full range in the UI while preventing
     the random shuffle from picking values that produce ugly outputs. */
  function WEIGHTED_INT_RANGE(min, max, def, opts) {
    const rmin = (opts && opts.rmin !== undefined) ? opts.rmin : min;
    const rmax = (opts && opts.rmax !== undefined) ? opts.rmax : max;
    const pow  = (opts && opts.pow  !== undefined) ? opts.pow  : 1;
    const base = INT_RANGE(min, max, def);
    return Object.assign({}, base, {
      randomize(rng) {
        const u = Math.pow(rng(), pow);
        return Math.floor(rmin + u * (rmax - rmin + 1));
      },
    });
  }
  function WEIGHTED_FLOAT_RANGE(min, max, def, precision, opts) {
    const prec = (precision === undefined) ? 3 : precision;
    const rmin = (opts && opts.rmin !== undefined) ? opts.rmin : min;
    const rmax = (opts && opts.rmax !== undefined) ? opts.rmax : max;
    const pow  = (opts && opts.pow  !== undefined) ? opts.pow  : 1;
    const roundTo = Math.pow(10, prec);
    const base = FLOAT_RANGE(min, max, def, prec);
    return Object.assign({}, base, {
      randomize(rng) {
        const u = Math.pow(rng(), pow);
        const v = rmin + u * (rmax - rmin);
        return Math.round(v * roundTo) / roundTo;
      },
    });
  }

  /* ─── BIMODAL ───
     Behaves like INT_RANGE for slider/decode (full range), but the
     random shuffle snaps to one of two anchor values. Use this for
     params where the visually pleasing values cluster at extremes
     (e.g. a "ridge" effect that's clean at 0 or 100 but blobby in the
     middle). opts.weight = probability of picking `high`. */
  function BIMODAL(low, high, def, opts) {
    const weight = (opts && opts.weight !== undefined) ? opts.weight : 0.5;
    const lo = Math.min(low, high);
    const hi = Math.max(low, high);
    const base = INT_RANGE(lo, hi, def);
    return Object.assign({}, base, {
      randomize(rng) {
        return rng() < weight ? high : low;
      },
    });
  }

  /* ─── ENUM_WEIGHTED ───
     Like ENUM, but the random shuffle uses per-item weights. Pass items
     as either [{ value, weight }] or [['value', weight], ...]. Decode
     and the values list still treat all entries as valid. */
  function ENUM_WEIGHTED(items, def) {
    const normalized = items.map(item => Array.isArray(item)
      ? { value: item[0], weight: item[1] }
      : { value: item.value, weight: (item.weight === undefined ? 1 : item.weight) });
    const values = normalized.map(x => x.value);
    const total = normalized.reduce((s, x) => s + x.weight, 0);
    const base = ENUM(values, def);
    return Object.assign({}, base, {
      randomize(rng) {
        let r = rng() * total;
        for (const item of normalized) {
          r -= item.weight;
          if (r <= 0) return item.value;
        }
        return normalized[normalized.length - 1].value;
      },
    });
  }

  /* ─── SEED: 32-bit unsigned integer (generated if missing) ─── */
  function SEED(def) {
    const defSeed = (def === undefined) ? 1 : (def >>> 0);
    return {
      type: 'seed',
      default: defSeed,
      encode(v) { return (v >>> 0).toString(36); },
      decode(s) {
        const n = parseInt(s, 36);
        if (!Number.isFinite(n) || n < 0) return { ok: false, value: defSeed, reason: 'bad-seed' };
        return { ok: true, value: n >>> 0 };
      },
      randomize(rng) {
        return Math.floor(rng() * 0xffffffff) >>> 0;
      },
    };
  }

  /* ─── TEXT: charset-whitelisted, length-clamped string ─── */
  /* `randomChoices` (optional) is a string of characters to pick from when
     randomizing. Defaults to uppercase A–Z, which validates against every
     letter-style charset currently in use across the tools. */
  function TEXT({ charset, maxLen, def, randomChoices }) {
    const pool = randomChoices || 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    return {
      type: 'text',
      default: def,
      maxLen,
      encode(v) {
        const s = String(v).slice(0, maxLen);
        return encodeURIComponent(s);
      },
      decode(raw) {
        if (typeof raw !== 'string') return { ok: false, value: def, reason: 'not-string' };
        let s;
        try { s = decodeURIComponent(raw); }
        catch (e) { return { ok: false, value: def, reason: 'bad-encoding' }; }
        if (s.length === 0) return { ok: false, value: def, reason: 'empty' };
        if (s.length > maxLen) s = s.slice(0, maxLen);
        if (charset && !charset.test(s)) return { ok: false, value: def, reason: 'bad-charset' };
        return { ok: true, value: s };
      },
      /* opts.monogram (string) overrides the default A–Z pool, so brand
         initials propagate to every letter-based tool in a Mosaic. */
      randomize(rng, opts) {
        const source = (opts && opts.monogram) ? opts.monogram : pool;
        if (source.length === 0) return def;
        const ch = source[Math.floor(rng() * source.length)];
        if (charset && !charset.test(ch)) return def;
        return ch;
      },
    };
  }

  /* ─── xmlEscape: safe SVG text embedding ─── */
  const XML_ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };
  function xmlEscape(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, (c) => XML_ESC[c]);
  }

  window.LogoSchema = {
    INT_RANGE,
    FLOAT_RANGE,
    UNIT_FLOAT,
    WEIGHTED_INT_RANGE,
    WEIGHTED_FLOAT_RANGE,
    BIMODAL,
    ENUM_WEIGHTED,
    COLOR,
    ENUM,
    BOOL,
    SEED,
    TEXT,
    xmlEscape,
    normalizeHex,
  };
})();
