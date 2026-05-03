/* ═══════════════════════════════════════════════════════════════
   LOGO TOOLS — Permalink Manager

   Encodes every tool parameter into the URL hash so any state is
   shareable via a simple copy-paste. Every export also copies a
   permalink to the clipboard. Zero infra — the "gallery" lives
   wherever designers already post.

   ┌──────────────────────────────────────────────────────────────┐
   │  LIFECYCLE                                                   │
   │                                                              │
   │  tool.init()                                                 │
   │    ▼                                                         │
   │  const pm = new PermalinkManager({ toolName, schema,         │
   │                                    getState, applyState })   │
   │    ▼                                                         │
   │  pm.decode()   ← called by tool AFTER its own init           │
   │    │                                                         │
   │    ├── hash present & valid ─► applyState(decoded) + chip    │
   │    ├── hash nil/empty       ─► noop, keep defaults           │
   │    └── hash malformed       ─► toast + defaults + canonical  │
   │                                                              │
   │  tool onInput ─► pm.update()  (debounced 200ms)              │
   │                   └── replaceState(#canonical)               │
   │                                                              │
   │  export / copy-link ─► pm.flush()+pm.getPermalink()          │
   │                                                              │
   └──────────────────────────────────────────────────────────────┘

   Schema values come from window.LogoSchema factories
   (INT_RANGE, COLOR, ENUM, SEED, TEXT, etc).

   All tools that wire this set window.__hasPermalink = true so the
   pill-nav Copy-Link icon can hide itself on tools that haven't
   migrated yet.
   ═══════════════════════════════════════════════════════════════ */

(function () {
  const SCHEMA_VERSION = 1;
  const MAX_HASH_LENGTH = 2048;
  const DEBOUNCE_MS = 200;
  const HELP_SENTINEL = '?';

  /* Reserved hash keys that aren't part of any tool's schema:
     v    — schema version
     r    — randomize-all flag (drives Mosaic and any "lucky" links)
     seed — RNG seed for `r=1` mode (so URLs are deterministic)
     p    — palette mode for randomization ('mono' clamps colors to grayscale)
     m    — monogram pool for letter-based tools (string of allowed chars) */
  const RESERVED_KEYS = new Set(['v', 'r', 'seed', 'p', 'm']);

  /* FNV-1a 32-bit string hash → seed for the deterministic RNG. */
  function _hashSeed(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  /* Mulberry32 — small, fast, decent-quality 32-bit PRNG. */
  function _mulberry32(seed) {
    let t = seed >>> 0;
    return function () {
      t = (t + 0x6D2B79F5) >>> 0;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  class PermalinkManager {
    /**
     * @param {Object} opts
     * @param {string}   opts.toolName
     * @param {Object}   opts.schema        — { key: LogoSchema factory result }
     * @param {Function} opts.getState      — () => currentStateObject
     * @param {Function} opts.applyState    — (state) => void (sync DOM + rerender)
     * @param {Function} [opts.onChange]    — optional callback after every live update
     */
    constructor(opts) {
      this.toolName = opts.toolName;
      this.schema = opts.schema;
      this.getState = opts.getState;
      this.applyState = opts.applyState;
      this.onChange = opts.onChange || null;

      this._debounceTimer = null;
      this._replaceStateFailed = false;
      this._loadedFromHash = false;

      window.__hasPermalink = true;

      this._injectPill();
      this._bindKeyboard();
      this._checkHelpSentinel();
    }

    /* ─── Public API ─── */

    /** Read hash, decode, apply to tool. Tool should call this after its own init. */
    decode() {
      const raw = window.location.hash || '';
      if (!raw || raw === '#' || raw === '#' + HELP_SENTINEL) return;

      if (raw.length > MAX_HASH_LENGTH) {
        this._warn('parse', 'hash exceeds max length — aborting', { length: raw.length });
        this._toast('Shared link too long — starting fresh');
        this._canonicalize();
        return;
      }

      const body = raw.startsWith('#') ? raw.slice(1) : raw;
      const parsed = this._parse(body);
      if (!parsed) {
        this._toast("Couldn't read shared link — starting fresh");
        this._canonicalize();
        return;
      }

      if (parsed.v !== SCHEMA_VERSION) {
        this._warn('parse', 'schema version mismatch', { seen: parsed.v, known: SCHEMA_VERSION });
        this._toast('This link was made with a different version');
        this._canonicalize();
        return;
      }

      const { state, hadFailures } = this._validate(parsed);
      if (hadFailures) {
        this._toast('Some values in the link were invalid — showing defaults for those');
      }

      /* `r=1` → randomize every schema field that wasn't given an explicit
         value. Seeded from `seed=` so reloads are deterministic.
         Optional opts: p=mono (grayscale palette), m=ABC (monogram pool). */
      const isRandomMode = parsed.r === '1';
      if (isRandomMode) {
        const seedStr = parsed.seed || '0';
        const rng = _mulberry32(_hashSeed(seedStr));
        const opts = {};
        if (parsed.p === 'mono') {
          opts.palette = 'mono';
          /* Pre-compute a guaranteed-contrast bg/fg pair from tightened
             dark/light ramps. COLOR.randomize consumes opts.monoBg/monoFg
             when the field key is `bg` or `fg`. Other color fields (border,
             accent) fall back to an independent ramp pick. */
          const dark  = ['#000000','#0d0d0d','#1a1a1a'][Math.floor(rng() * 3)];
          const light = ['#f0f0f0','#f8f8f8','#ffffff'][Math.floor(rng() * 3)];
          if (rng() < 0.5) { opts.monoBg = dark;  opts.monoFg = light; }
          else             { opts.monoBg = light; opts.monoFg = dark;  }
        }
        if (parsed.m && typeof parsed.m === 'string' && parsed.m.length > 0) {
          opts.monogram = parsed.m;
        }
        for (const [key, field] of Object.entries(this.schema)) {
          if (parsed[key] !== undefined) continue;
          if (typeof field.randomize === 'function') {
            state[key] = field.randomize(rng, opts, key);
          }
        }
        /* Post-pass: a field's `post(state, rng, opts)` can derive its
           value from already-randomized siblings — used for coupling
           (e.g. line-warp's oy must track d so the displaced bump peak
           lands near the canvas center). Runs after every standard
           randomize so post hooks see the full state. */
        for (const [key, field] of Object.entries(this.schema)) {
          if (parsed[key] !== undefined) continue;
          if (typeof field.post === 'function') {
            state[key] = field.post(state, rng, opts);
          }
        }
      }

      try {
        this.applyState(state);
      } catch (e) {
        this._warn('apply', 'applyState threw', { error: e && e.message });
        this._toast('Failed to load shared link');
        return;
      }

      this._loadedFromHash = true;
      if (!isRandomMode) this._showRemixChip();
      this._canonicalize();
      this._updatePillLabel();
    }

    /** Called by tool on every input change. Debounced. */
    update() {
      if (this._debounceTimer) clearTimeout(this._debounceTimer);
      this._debounceTimer = setTimeout(() => {
        this._debounceTimer = null;
        this._writeHash();
        if (this.onChange) this.onChange();
      }, DEBOUNCE_MS);
    }

    /** Force an immediate encode + replaceState. Called before export / copy. */
    flush() {
      if (this._debounceTimer) {
        clearTimeout(this._debounceTimer);
        this._debounceTimer = null;
      }
      this._writeHash();
    }

    /** Get the current canonical permalink URL. */
    getPermalink() {
      this.flush();
      const base = window.location.origin + window.location.pathname;
      return base + this._encodeHash();
    }

    /** Apply an arbitrary hash string (e.g. a preset). Missing keys reset
        to schema defaults — this gives presets clean, deterministic state. */
    applyHash(hashStr) {
      if (!hashStr) return false;
      const body = String(hashStr).startsWith('#') ? String(hashStr).slice(1) : String(hashStr);
      const parsed = this._parse(body);
      if (!parsed) return false;
      if (parsed.v !== SCHEMA_VERSION) return false;
      const { state } = this._validate(parsed);
      try { this.applyState(state); }
      catch (e) {
        this._warn('applyHash', 'applyState threw', { error: e && e.message });
        return false;
      }
      this._writeHash();
      return true;
    }

    /** Apply a hash only if the URL has no meaningful hash. Used to make
        each tool's first-load state match the landing page's top-left embed. */
    applyDefaultIfEmpty(hashStr) {
      const raw = window.location.hash || '';
      if (raw && raw !== '#' && raw !== '#' + HELP_SENTINEL) return false;
      return this.applyHash(hashStr);
    }

    /** Build the 4 preset buttons from the registry's variants[] for this
        tool, and apply variants[0] as the initial state when no hash is
        present. The container element must already exist in the DOM
        (`<div class="presets" id="presets"></div>`). */
    setupPresets() {
      const tool = window.LogoTools && window.LogoTools.findBySlug
        ? window.LogoTools.findBySlug(this.toolName)
        : null;
      if (!tool || !Array.isArray(tool.variants) || tool.variants.length === 0) return;

      const container = document.getElementById('presets');
      if (container) {
        container.innerHTML = '';
        tool.variants.forEach((hash, i) => {
          const btn = document.createElement('button');
          btn.className = 'preset-btn';
          btn.type = 'button';
          btn.textContent = String(i + 1);
          btn.setAttribute('aria-label', tool.name + ' preset ' + (i + 1));
          btn.addEventListener('click', () => this.applyHash(hash));
          container.appendChild(btn);
        });
      }

      this.applyDefaultIfEmpty(tool.variants[0]);
    }

    /** Copy current permalink to clipboard. */
    async copyLink() {
      this.flush();
      const url = this.getPermalink();

      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(url);
          this._flashPillCopied();
          return true;
        }
      } catch (e) {
        this._warn('clipboard', 'writeText rejected', { error: e && e.message });
      }

      // Fallback 1: execCommand on hidden textarea
      try {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.top = '-9999px';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if (ok) {
          this._flashPillCopied();
          return true;
        }
      } catch (e) {
        this._warn('clipboard', 'execCommand fallback failed', { error: e && e.message });
      }

      // Fallback 2: selectable modal
      this._showCopyModal(url);
      return false;
    }

    /* ─── Internal: parse / validate ─── */

    _parse(body) {
      try {
        const params = new URLSearchParams(body);
        const out = {};
        for (const [k, v] of params) out[k] = v;
        if (!('v' in out)) {
          this._warn('parse', 'missing version tag', { body });
          return null;
        }
        out.v = parseInt(out.v, 10);
        if (!Number.isFinite(out.v)) return null;
        return out;
      } catch (e) {
        this._warn('parse', 'URLSearchParams threw', { error: e && e.message });
        return null;
      }
    }

    _validate(parsed) {
      const state = {};
      let hadFailures = false;
      const seenKeys = new Set(RESERVED_KEYS);

      for (const [key, field] of Object.entries(this.schema)) {
        seenKeys.add(key);
        const raw = parsed[key];
        if (raw === undefined) {
          state[key] = field.default;
          continue;
        }
        const result = field.decode(raw);
        if (!result.ok) {
          this._warn('validate', 'bad value — using default', {
            key, raw, reason: result.reason, expected: field.type,
          });
          hadFailures = true;
          state[key] = field.default;
        } else {
          if (result.clamped) {
            this._warn('validate', 'clamped', { key, raw, reason: result.reason });
          }
          state[key] = result.value;
        }
      }

      // Forward-compat: unknown keys ignored (warn once)
      for (const key of Object.keys(parsed)) {
        if (!seenKeys.has(key)) {
          this._warn('validate', 'unknown key ignored', { key, value: parsed[key] });
        }
      }

      return { state, hadFailures };
    }

    /* ─── Internal: encode ─── */

    _encodeHash() {
      const state = this.getState();
      const parts = ['v=' + SCHEMA_VERSION];

      const keys = Object.keys(this.schema).sort();
      for (const key of keys) {
        const field = this.schema[key];
        const cur = state[key];
        if (cur === undefined || cur === null) continue;

        // Strip defaults for canonical URL brevity
        if (this._equalsDefault(cur, field)) continue;

        const encoded = field.encode(cur);
        parts.push(key + '=' + encoded);
      }

      return '#' + parts.join('&');
    }

    _equalsDefault(v, field) {
      if (field.type === 'float') {
        return Math.abs(v - field.default) < 1e-9;
      }
      return v === field.default;
    }

    _writeHash() {
      const hash = this._encodeHash();
      try {
        history.replaceState(null, '', hash);
      } catch (e) {
        if (!this._replaceStateFailed) {
          this._replaceStateFailed = true;
          this._warn('update', 'replaceState failed — live sync disabled', { error: e && e.message });
        }
      }
      this._updatePillLabel();
    }

    _canonicalize() {
      this._writeHash();
    }

    /* ─── Internal: pill ─── */

    _injectPill() {
      this.pill = document.createElement('div');
      this.pill.className = 'permalink-pill';
      this.pill.setAttribute('role', 'button');
      this.pill.setAttribute('aria-label', 'Copy permalink');
      this.pill.setAttribute('tabindex', '0');
      this.pill.innerHTML = `
        <svg class="permalink-pill__icon" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
          <path d="M6.5 10.5L9.5 5.5"/>
          <path d="M10 9L12 7A2.5 2.5 0 008 3L6 5"/>
          <path d="M6 7L4 9A2.5 2.5 0 008 13L10 11"/>
        </svg>
        <span class="permalink-pill__label">link</span>
      `;
      document.body.appendChild(this.pill);

      const onCopy = () => this.copyLink();
      this.pill.addEventListener('click', onCopy);
      this.pill.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onCopy(); }
      });

      this._updatePillLabel();
    }

    _updatePillLabel() {
      if (!this.pill) return;
      const hash = this._encodeHash().slice(1);
      const short = hash.length > 6 ? '…' + hash.slice(-6) : hash;
      const label = this.pill.querySelector('.permalink-pill__label');
      if (label && !this.pill.classList.contains('permalink-pill--copied')) {
        label.textContent = short || 'link';
      }
    }

    _flashPillCopied() {
      if (!this.pill) return;
      const label = this.pill.querySelector('.permalink-pill__label');
      if (!label) return;
      const originalText = label.textContent;
      this.pill.classList.add('permalink-pill--copied');
      label.textContent = 'copied';
      setTimeout(() => {
        this.pill.classList.remove('permalink-pill--copied');
        this._updatePillLabel();
      }, 1500);
    }

    /* ─── Internal: keyboard ─── */

    _bindKeyboard() {
      document.addEventListener('keydown', (e) => {
        // Cmd+Shift+C / Ctrl+Shift+C → copy link
        if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'c' || e.key === 'C')) {
          // Don't steal focus from active text input
          const tag = document.activeElement && document.activeElement.tagName;
          if (tag === 'INPUT' || tag === 'TEXTAREA') return;
          e.preventDefault();
          this.copyLink();
        }
      });
    }

    /* ─── Internal: remix chip ─── */

    _showRemixChip() {
      if (document.querySelector('.remix-chip')) return;
      const chip = document.createElement('div');
      chip.className = 'remix-chip';
      chip.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 5h8a3 3 0 013 3v0a3 3 0 01-3 3H5"/>
          <path d="M6 2L3 5l3 3"/>
          <path d="M10 14l3-3-3-3"/>
        </svg>
        <span>Remixing — tweak to make it yours</span>
        <button class="remix-chip__close" aria-label="Dismiss">&times;</button>
      `;
      document.body.appendChild(chip);
      requestAnimationFrame(() => chip.classList.add('remix-chip--visible'));

      const close = () => {
        chip.classList.remove('remix-chip--visible');
        setTimeout(() => chip.remove(), 300);
      };
      chip.querySelector('.remix-chip__close').addEventListener('click', close);
      setTimeout(close, 6000);
    }

    /* ─── Internal: help sentinel (#?) ─── */

    _checkHelpSentinel() {
      if (window.location.hash === '#' + HELP_SENTINEL) {
        // Defer until after decode path has settled
        setTimeout(() => this._showHelpOverlay(), 0);
      }
    }

    _showHelpOverlay() {
      if (document.querySelector('.permalink-help')) return;
      const overlay = document.createElement('div');
      overlay.className = 'permalink-help';

      const rows = Object.entries(this.schema).map(([key, field]) => {
        let detail;
        switch (field.type) {
          case 'int':   detail = `integer ${field.min}..${field.max}`; break;
          case 'float': detail = `decimal ${field.min}..${field.max}`; break;
          case 'color': detail = 'hex color (6 digits, no #)'; break;
          case 'enum':  detail = field.values.join(' / '); break;
          case 'bool':  detail = '0 / 1'; break;
          case 'seed':  detail = 'seed for Randomize'; break;
          case 'text':  detail = `text (max ${field.maxLen} chars)`; break;
          default:      detail = field.type;
        }
        const defStr = field.type === 'color'
          ? String(field.default).replace('#', '')
          : String(field.default);
        return `<li><code>${this._esc(key)}</code> — ${this._esc(detail)} <span class="permalink-help__def">default: ${this._esc(defStr)}</span></li>`;
      }).join('');

      overlay.innerHTML = `
        <div class="permalink-help__panel">
          <div class="permalink-help__header">
            <h2>URL parameters — ${this._esc(this.toolName)}</h2>
            <button class="permalink-help__close" aria-label="Close">&times;</button>
          </div>
          <p class="permalink-help__intro">Edit the hash in the URL bar to tweak any parameter. Share the full URL to share this exact state.</p>
          <ul class="permalink-help__list">${rows}</ul>
          <p class="permalink-help__foot">Schema version: <code>v=${SCHEMA_VERSION}</code></p>
        </div>
      `;
      document.body.appendChild(overlay);

      const close = () => overlay.remove();
      overlay.querySelector('.permalink-help__close').addEventListener('click', close);
      overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
      document.addEventListener('keydown', function esc(e) {
        if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
      });
    }

    _esc(s) {
      return String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;' }[c]));
    }

    /* ─── Internal: copy-fallback modal ─── */

    _showCopyModal(url) {
      const overlay = document.createElement('div');
      overlay.className = 'permalink-copy-modal';
      overlay.innerHTML = `
        <div class="permalink-copy-modal__panel">
          <div class="permalink-copy-modal__header">
            <h3>Copy this link</h3>
            <button class="permalink-copy-modal__close" aria-label="Close">&times;</button>
          </div>
          <p>Your browser blocked auto-copy. Press <kbd>${this._cmdKey()}+C</kbd> to copy:</p>
          <textarea readonly rows="3"></textarea>
        </div>
      `;
      const ta = overlay.querySelector('textarea');
      ta.value = url;
      document.body.appendChild(overlay);
      requestAnimationFrame(() => { ta.focus(); ta.select(); });

      const close = () => overlay.remove();
      overlay.querySelector('.permalink-copy-modal__close').addEventListener('click', close);
      overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    }

    _cmdKey() {
      return /Mac|iPhone|iPad/.test(navigator.platform || '') ? '⌘' : 'Ctrl';
    }

    /* ─── Internal: toast (reuses ToolExporter's toast system) ─── */

    _toast(message, isError = false) {
      const existing = document.querySelector('.toast');
      if (existing) existing.remove();
      const toast = document.createElement('div');
      toast.className = `toast${isError ? ' toast--error' : ''}`;
      toast.textContent = message;
      document.body.appendChild(toast);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => toast.classList.add('toast--visible'));
      });
      setTimeout(() => {
        toast.classList.remove('toast--visible');
        setTimeout(() => toast.remove(), 300);
      }, 2400);
    }

    _warn(area, msg, ctx) {
      // eslint-disable-next-line no-console
      console.warn(`[permalink:${area}] ${msg}`, { tool: this.toolName, ...ctx });
    }
  }

  window.PermalinkManager = PermalinkManager;
  window.PermalinkManager.SCHEMA_VERSION = SCHEMA_VERSION;
})();
