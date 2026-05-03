/* ═══════════════════════════════════════════════════════════════
   LOGO TOOLS — Shared Export Engine
   Provides unified PNG/SVG export with resolution picker,
   transparent background toggle, and clipboard copy.
   ═══════════════════════════════════════════════════════════════ */

class ToolExporter {
  /**
   * @param {Object} opts
   * @param {string}   opts.toolName       — kebab-case name for filenames
   * @param {Function} opts.getCanvas      — () => HTMLCanvasElement (the visible canvas)
   * @param {Function} opts.getSVG         — ({width, height, transparent}) => string (SVG markup)
   * @param {Function} [opts.renderToCanvas] — (ctx, width, height, {transparent}) => void
   *   If provided, enables re-rendering at arbitrary sizes & transparent bg.
   *   If omitted, PNG export simply copies the visible canvas (no transparent support).
   * @param {Function} [opts.getBackgroundColor] — () => string (current bg hex)
   * @param {number}   [opts.baseWidth]    — base canvas width (default: reads from canvas)
   * @param {number}   [opts.baseHeight]   — base canvas height (default: reads from canvas)
   * @param {Object}   [opts.paperProject] — Paper.js project (enables Paper.js PNG export)
   * @param {Function} [opts.getPermalink] — () => string; if provided, enables Copy Link
   *   button + auto-copies permalink to clipboard alongside PNG download.
   * @param {Function} [opts.flushPermalink] — () => void; called before getPermalink()
   *   to flush pending debounced hash updates. Optional.
   */
  constructor(opts) {
    this.toolName = opts.toolName;
    this.getCanvas = opts.getCanvas;
    this.getSVG = opts.getSVG;
    this.renderToCanvas = opts.renderToCanvas || null;
    this.getBackgroundColor = opts.getBackgroundColor || (() => '#111111');
    this.baseWidth = opts.baseWidth || null;
    this.baseHeight = opts.baseHeight || null;
    this.paperProject = opts.paperProject || null;
    this.getPermalink = opts.getPermalink || null;
    this.flushPermalink = opts.flushPermalink || null;

    this.currentFormat = 'png';
    this.currentScale = 2;
    this.transparent = false;

    this._injectPanel();
    this._bindEvents();
    this._bindKeyboard();
  }

  /* ─── DOM injection ─── */

  _injectPanel() {
    // Overlay
    this.overlay = document.createElement('div');
    this.overlay.className = 'export-overlay';
    document.body.appendChild(this.overlay);

    // Panel
    this.panel = document.createElement('div');
    this.panel.className = 'export-panel';
    this.panel.innerHTML = `
      <div class="export-sheet">
        <div class="export-sheet__header">
          <h2>Export</h2>
          <button class="export-sheet__close" aria-label="Close">&times;</button>
        </div>

        <div class="export-formats">
          <button class="export-format-btn active" data-format="png">PNG</button>
          <button class="export-format-btn" data-format="svg">SVG</button>
        </div>

        <div class="export-options" id="exportPngOptions">
          <div class="control-group">
            <label>Resolution</label>
            <div style="display:flex;align-items:center;gap:8px">
              <div class="export-res-row">
                <button class="export-res-btn" data-scale="1">1x</button>
                <button class="export-res-btn active" data-scale="2">2x</button>
                <button class="export-res-btn" data-scale="4">4x</button>
              </div>
              <span class="export-dims"></span>
            </div>
          </div>

          <label class="toggle-row">
            <input type="checkbox" id="exportTransparent">
            <span>Transparent background</span>
          </label>
        </div>

        <div class="export-actions">
          <button class="btn btn-primary btn-full" id="exportDownload">Download</button>
          <button class="btn btn-secondary btn-full" id="exportClipboard">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="5" y="5" width="9" height="9" rx="1.5"/>
              <path d="M11 5V3.5A1.5 1.5 0 009.5 2h-6A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5"/>
            </svg>
            <span class="btn__label">Copy to Clipboard</span>
          </button>
          <button class="btn btn-secondary btn-full export-copylink" id="exportCopyLink" style="display:none">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6.5 10.5L9.5 5.5"/>
              <path d="M10 9L12 7A2.5 2.5 0 008 3L6 5"/>
              <path d="M6 7L4 9A2.5 2.5 0 008 13L10 11"/>
            </svg>
            <span class="btn__label">Copy Link</span>
          </button>
          <button class="btn btn-secondary btn-full export-share" id="exportShare" style="display:none">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M8 10V2"/>
              <path d="M5 5L8 2L11 5"/>
              <path d="M3 9v4a1 1 0 001 1h8a1 1 0 001-1V9"/>
            </svg>
            <span class="btn__label">Share…</span>
          </button>
          <div class="export-share-links" id="exportShareLinks" style="display:none">
            <a class="export-share-link" data-target="twitter" target="_blank" rel="noopener">Post to X</a>
            <a class="export-share-link" data-target="bluesky" target="_blank" rel="noopener">Post to Bluesky</a>
            <a class="export-share-link" data-target="sms">Send via Messages</a>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(this.panel);

    // Cache DOM refs
    this.dimsEl = this.panel.querySelector('.export-dims');
    this.pngOptions = this.panel.querySelector('#exportPngOptions');
    this.transparentCheckbox = this.panel.querySelector('#exportTransparent');
    this.copyLinkBtn = this.panel.querySelector('#exportCopyLink');
    this.shareBtn = this.panel.querySelector('#exportShare');
    this.shareLinks = this.panel.querySelector('#exportShareLinks');
  }

  /* ─── Event binding ─── */

  _bindEvents() {
    // Open trigger — find button with data-export or #openExport
    const trigger = document.querySelector('[data-export-trigger], #openExport, .btn-export');
    if (trigger) trigger.addEventListener('click', () => this.open());

    // Close
    this.overlay.addEventListener('click', () => this.close());
    this.panel.querySelector('.export-sheet__close').addEventListener('click', () => this.close());

    // Format tabs
    this.panel.querySelectorAll('.export-format-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.panel.querySelectorAll('.export-format-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentFormat = btn.dataset.format;
        this.pngOptions.style.display = this.currentFormat === 'png' ? '' : 'none';
      });
    });

    // Resolution pills
    this.panel.querySelectorAll('.export-res-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.panel.querySelectorAll('.export-res-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentScale = parseInt(btn.dataset.scale);
        this._updateDims();
      });
    });

    // Transparent toggle
    this.transparentCheckbox.addEventListener('change', () => {
      this.transparent = this.transparentCheckbox.checked;
    });

    // Download
    this.panel.querySelector('#exportDownload').addEventListener('click', () => this._download());

    // Clipboard
    this.panel.querySelector('#exportClipboard').addEventListener('click', () => this._copyToClipboard());

    // Copy Link (only active when getPermalink provided)
    if (this.getPermalink) {
      this.copyLinkBtn.style.display = '';
      this.copyLinkBtn.addEventListener('click', () => this._copyLink());
    }

    // Web Share (mobile) + "Open in…" deep links
    if (this.getPermalink) {
      if (navigator.share) {
        this.shareBtn.style.display = '';
        this.shareBtn.addEventListener('click', () => this._webShare());
      } else {
        // Desktop: show static deep links instead
        this.shareLinks.style.display = '';
      }
      this._bindShareLinks();
    }
  }

  _bindShareLinks() {
    const linkEls = this.shareLinks.querySelectorAll('.export-share-link');
    const updateHrefs = () => {
      if (!this.getPermalink) return;
      if (this.flushPermalink) this.flushPermalink();
      const url = this.getPermalink();
      const text = `Made with ${this.toolName} — natemodi.com`;
      linkEls.forEach(a => {
        const target = a.dataset.target;
        if (target === 'twitter') {
          a.href = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
        } else if (target === 'bluesky') {
          a.href = `https://bsky.app/intent/compose?text=${encodeURIComponent(text + ' ' + url)}`;
        } else if (target === 'sms') {
          a.href = `sms:?&body=${encodeURIComponent(text + ' ' + url)}`;
        }
      });
    };
    // Refresh hrefs each time modal opens
    this._updateShareHrefs = updateHrefs;
  }

  _bindKeyboard() {
    document.addEventListener('keydown', (e) => {
      // Cmd+E / Ctrl+E to open export
      if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
        e.preventDefault();
        if (this.panel.classList.contains('visible')) {
          this.close();
        } else {
          this.open();
        }
      }
      // Escape to close
      if (e.key === 'Escape' && this.panel.classList.contains('visible')) {
        this.close();
      }
    });
  }

  /* ─── Open / Close ─── */

  open() {
    this._updateDims();
    if (this._updateShareHrefs) this._updateShareHrefs();
    this.overlay.classList.add('visible');
    this.panel.classList.add('visible');
  }

  close() {
    this.overlay.classList.remove('visible');
    this.panel.classList.remove('visible');
  }

  /* ─── Dimension display ─── */

  _getBaseSize() {
    const canvas = this.getCanvas();
    const w = this.baseWidth || (canvas ? canvas.width : 800);
    const h = this.baseHeight || (canvas ? canvas.height : 800);
    return { w, h };
  }

  _updateDims() {
    const { w, h } = this._getBaseSize();
    const sw = w * this.currentScale;
    const sh = h * this.currentScale;
    this.dimsEl.textContent = `${sw} × ${sh}`;
  }

  /* ─── Export: PNG ─── */

  async _exportPNG() {
    const scale = this.currentScale;
    const transparent = this.transparent;

    // Paper.js path
    if (this.paperProject) {
      return this._exportPaperPNG(scale, transparent);
    }

    const srcCanvas = this.getCanvas();
    if (!srcCanvas) return null;

    // If renderToCanvas is provided, use it for clean re-render at scale
    if (this.renderToCanvas) {
      const { w, h } = this._getBaseSize();
      const offscreen = document.createElement('canvas');
      offscreen.width = w * scale;
      offscreen.height = h * scale;
      const ctx = offscreen.getContext('2d');

      if (!transparent) {
        ctx.fillStyle = this.getBackgroundColor();
        ctx.fillRect(0, 0, offscreen.width, offscreen.height);
      }

      ctx.save();
      ctx.scale(scale, scale);
      this.renderToCanvas(ctx, w, h, { transparent });
      ctx.restore();

      return new Promise(resolve => {
        offscreen.toBlob(blob => resolve(blob), 'image/png');
      });
    }

    // Fallback: copy visible canvas at scale
    const { w, h } = this._getBaseSize();
    const offscreen = document.createElement('canvas');
    offscreen.width = w * scale;
    offscreen.height = h * scale;
    const ctx = offscreen.getContext('2d');

    if (transparent && this.renderToCanvas) {
      // Already handled above
    } else {
      ctx.drawImage(srcCanvas, 0, 0, offscreen.width, offscreen.height);
    }

    return new Promise(resolve => {
      offscreen.toBlob(blob => resolve(blob), 'image/png');
    });
  }

  /* Paper.js PNG export */
  async _exportPaperPNG(scale, transparent) {
    const project = this.paperProject;
    if (!project || !project.activeLayer) return null;

    const view = project.view;
    const { w, h } = this._getBaseSize();

    const offscreen = document.createElement('canvas');
    offscreen.width = w * scale;
    offscreen.height = h * scale;
    const ctx = offscreen.getContext('2d');

    if (!transparent) {
      ctx.fillStyle = this.getBackgroundColor();
      ctx.fillRect(0, 0, offscreen.width, offscreen.height);
    }

    // Export SVG, draw to canvas via Image
    const svgString = this.getSVG({ width: w, height: h, transparent });
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, offscreen.width, offscreen.height);
        URL.revokeObjectURL(url);
        offscreen.toBlob(pngBlob => resolve(pngBlob), 'image/png');
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  }

  /* ─── Export: SVG ─── */

  _exportSVG() {
    const { w, h } = this._getBaseSize();
    const svgString = this.getSVG({ width: w, height: h, transparent: false });
    if (!svgString) return null;
    return new Blob([svgString], { type: 'image/svg+xml' });
  }

  /* ─── Download ─── */

  async _download() {
    let blob, ext;

    if (this.currentFormat === 'svg') {
      blob = this._exportSVG();
      ext = 'svg';
    } else {
      blob = await this._exportPNG();
      ext = 'png';
    }

    if (!blob) {
      this._toast('Export failed', true);
      return;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.toolName}-${this.currentScale}x.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Auto-copy permalink alongside download (best-effort, non-blocking)
    let linkNote = '';
    if (this.getPermalink) {
      try {
        if (this.flushPermalink) this.flushPermalink();
        const permalink = this.getPermalink();
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(permalink);
          linkNote = ' · link copied';
        }
      } catch (e) {
        // Silent — download already succeeded
      }
    }

    this._toast(`Saved ${this.toolName}.${ext}${linkNote}`);
    this.close();
  }

  /* ─── Clipboard ─── */

  async _copyToClipboard() {
    try {
      let blob;

      if (this.currentFormat === 'svg') {
        // SVG as text
        const { w, h } = this._getBaseSize();
        const svgString = this.getSVG({ width: w, height: h, transparent: false });
        if (!svgString) throw new Error('No SVG');
        blob = new Blob([svgString], { type: 'text/plain' });
        await navigator.clipboard.writeText(svgString);
      } else {
        // PNG as image
        blob = await this._exportPNG();
        if (!blob) throw new Error('No PNG');
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
      }

      this._flashBtnCopied(this.panel.querySelector('#exportClipboard'));
      this._toast('Copied to clipboard');
    } catch (e) {
      this._toast('Copy failed — try downloading instead', true);
    }
  }

  /* ─── Copy Link ─── */

  async _copyLink() {
    if (!this.getPermalink) return;
    if (this.flushPermalink) this.flushPermalink();
    const url = this.getPermalink();

    try {
      await navigator.clipboard.writeText(url);
      this._flashBtnCopied(this.copyLinkBtn);
      this._toast('Link copied');
      return;
    } catch (e) { /* fall through */ }

    try {
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.style.cssText = 'position:fixed;top:-9999px;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      if (ok) {
        this._flashBtnCopied(this.copyLinkBtn);
        this._toast('Link copied');
        return;
      }
    } catch (e) { /* fall through */ }

    this._toast('Copy failed — URL is in the address bar', true);
  }

  _flashBtnCopied(btn) {
    if (!btn) return;
    const labelEl = btn.querySelector('.btn__label');
    if (!labelEl) return;
    const original = labelEl.textContent;
    labelEl.textContent = 'Copied ✓';
    btn.classList.add('btn--copied');
    setTimeout(() => {
      labelEl.textContent = original;
      btn.classList.remove('btn--copied');
    }, 1500);
  }

  /* ─── Web Share (mobile) ─── */

  async _webShare() {
    if (!navigator.share || !this.getPermalink) return;
    if (this.flushPermalink) this.flushPermalink();
    const url = this.getPermalink();
    try {
      const shareData = {
        title: `${this.toolName} — natemodi.com`,
        text: 'Made this with Logo Lab',
        url,
      };
      // Try to include PNG file on capable devices
      try {
        const blob = await this._exportPNG();
        if (blob && navigator.canShare) {
          const file = new File([blob], `${this.toolName}.png`, { type: 'image/png' });
          if (navigator.canShare({ files: [file] })) {
            shareData.files = [file];
          }
        }
      } catch (e) { /* share without image */ }
      await navigator.share(shareData);
    } catch (e) {
      if (e && e.name !== 'AbortError') {
        this._toast('Share failed — try Copy Link instead', true);
      }
    }
  }

  /* ─── Toast ─── */

  _toast(message, isError = false) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast${isError ? ' toast--error' : ''}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        toast.classList.add('toast--visible');
      });
    });

    setTimeout(() => {
      toast.classList.remove('toast--visible');
      setTimeout(() => toast.remove(), 300);
    }, 2200);
  }
}

/* Make available globally */
window.ToolExporter = ToolExporter;
