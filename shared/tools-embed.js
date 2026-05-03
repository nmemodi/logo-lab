/* ═══════════════════════════════════════════════════════════════
   LOGO TOOLS — Embed helper
   Runs inside every tool page. When the page is loaded in an
   iframe (window !== window.parent), this script:

     1. Adds [data-embedded="true"] to <html> so CSS can hide
        the permalink pill, remix chip, and switcher dropdown.
     2. Blocks the global keyboard hotkeys from tools-nav.js
        that would otherwise cycle tools / jump via 1-9, so
        keypresses inside the iframe stay scoped to the embed.
     3. Reports its scrollHeight to the parent via postMessage
        and keeps the parent in sync when the canvas or controls
        resize (ResizeObserver).

   Must be loaded BEFORE permalink.js and tools-nav.js so the
   data-embedded attribute is in place before those scripts
   render their UI.
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Iframe detection. Guarded for sandbox SecurityError. ── */
  let isEmbedded = false;
  try {
    isEmbedded = window.parent && window.parent !== window;
  } catch (e) {
    isEmbedded = false;
  }

  if (!isEmbedded) return;

  /* Set the attribute immediately so CSS can respond before paint. */
  document.documentElement.setAttribute('data-embedded', 'true');

  /* ── Hotkey suppression.
     tools-nav.js binds a keydown listener on document in the capture
     phase = false (default). We register in capture phase = true with
     a stopImmediatePropagation guard so our handler runs first and
     neutralises the conflicting keys before tools-nav sees them. ── */
  const SUPPRESSED_KEYS = new Set([
    'ArrowLeft', 'ArrowRight', 't', 'T',
    '1', '2', '3', '4', '5', '6', '7', '8', '9'
  ]);

  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (SUPPRESSED_KEYS.has(e.key)) {
      e.stopImmediatePropagation();
    }
  }, /* capture */ true);

  /* ── Height reporting via postMessage.
     Parent validates { source: 'logo-lab-embed', height: <number> }
     with strict origin check before applying. ── */
  const parentOrigin = (function () {
    try { return document.referrer ? new URL(document.referrer).origin : ''; }
    catch (e) { return ''; }
  })();

  function currentHeight() {
    return Math.max(
      document.documentElement.scrollHeight || 0,
      document.body ? document.body.scrollHeight : 0
    );
  }

  let lastReported = -1;
  function postHeight() {
    const h = currentHeight();
    if (h <= 0 || h === lastReported) return;
    lastReported = h;
    try {
      const target = parentOrigin || window.location.origin;
      window.parent.postMessage(
        { source: 'logo-lab-embed', height: h },
        target
      );
    } catch (e) {
      /* parent closed or origin mismatch → silently ignore */
    }
  }

  function scheduleInitialPosts() {
    /* Post immediately and at a few short intervals to cover the
       race where the parent listener attaches just after load. */
    postHeight();
    setTimeout(postHeight, 50);
    setTimeout(postHeight, 250);
    setTimeout(postHeight, 750);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleInitialPosts);
  } else {
    scheduleInitialPosts();
  }

  window.addEventListener('load', postHeight);

  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(function () { postHeight(); });
    if (document.body) ro.observe(document.body);
    else document.addEventListener('DOMContentLoaded', function () {
      ro.observe(document.body);
    });
  } else {
    setInterval(postHeight, 1000);
  }
})();
