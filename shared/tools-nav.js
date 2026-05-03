/* ═══════════════════════════════════════════════════════════════
   LOGO TOOLS — Switcher Dropdown
   Enhances the tool-header title into a dropdown trigger.
   Keyboard: ← → cycle, 1–9 jump, T to /logo/, Esc to close panel.

   Requires /shared/tools-registry.js to be loaded first — pulls
   the canonical TOOLS array from window.LogoTools.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  if (!window.LogoTools) {
    console.warn('[logo-lab] tools-nav: registry missing; load tools-registry.js before tools-nav.js');
    return;
  }

  const TOOLS       = window.LogoTools.TOOLS;
  const INDEX_PATH  = window.LogoTools.INDEX_PATH;
  const toolPath    = window.LogoTools.toolPath;
  const currentIndex = window.LogoTools.currentIndex;

  function navigateTo(idx) {
    if (idx < 0) idx = TOOLS.length - 1;
    if (idx >= TOOLS.length) idx = 0;
    location.href = toolPath(TOOLS[idx].slug);
  }

  let header, button, panel;
  let open = false;

  function setOpen(next) {
    if (next === open) return;
    open = next;
    header.classList.toggle('is-open', open);
    button.setAttribute('aria-expanded', String(open));
  }

  function renderIndexLink() {
    const sidebar = document.querySelector('.tool-sidebar');
    if (!sidebar || sidebar.querySelector('.tool-index-link')) return;
    const link = document.createElement('a');
    link.className = 'tool-index-link';
    link.href = INDEX_PATH;
    link.innerHTML =
      '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" ' +
        'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" ' +
        'aria-hidden="true"><path d="M7.5 3L4.5 6L7.5 9"/></svg>' +
      'Index';
    sidebar.insertBefore(link, sidebar.firstChild);
  }

  function render() {
    renderIndexLink();

    header = document.querySelector('.tool-header');
    if (!header) return;

    const curIdx = currentIndex();
    const curName = curIdx >= 0 ? TOOLS[curIdx].name
                                : (header.querySelector('.tool-header__title') || {}).textContent || 'Tools';

    // Replace header contents with the switcher.
    header.innerHTML = '';
    header.classList.add('tool-switcher');

    button = document.createElement('button');
    button.type = 'button';
    button.className = 'tool-switcher__button';
    button.setAttribute('aria-haspopup', 'listbox');
    button.setAttribute('aria-expanded', 'false');
    button.innerHTML =
      '<span class="tool-switcher__title">' + curName + '</span>' +
      '<svg class="tool-switcher__chev" viewBox="0 0 12 12" fill="none" ' +
        'stroke="currentColor" stroke-width="1.5" stroke-linecap="round" ' +
        'stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M3 4.75L6 7.75L9 4.75"/></svg>';

    panel = document.createElement('div');
    panel.className = 'tool-switcher__panel';
    panel.setAttribute('role', 'listbox');

    TOOLS.forEach((t, i) => {
      const item = document.createElement('a');
      item.href = toolPath(t.slug);
      item.className = 'tool-switcher__item' + (i === curIdx ? ' is-current' : '');
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', i === curIdx ? 'true' : 'false');
      item.innerHTML =
        '<span class="tool-switcher__glyph">' + t.svg + '</span>' +
        '<span class="tool-switcher__name">' + t.name + '</span>' +
        '<kbd class="tool-switcher__key">' + (i + 1) + '</kbd>';
      panel.appendChild(item);
    });

    header.appendChild(button);
    header.appendChild(panel);

    // Open / close behavior.
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      setOpen(!open);
    });
    document.addEventListener('click', (e) => {
      if (open && !header.contains(e.target)) setOpen(false);
    });
    // Also close after internal nav click (before the browser navigates).
    panel.addEventListener('click', () => setOpen(false));
  }

  function handleKey(e) {
    // Ignore while typing in inputs.
    const t = e.target;
    if (t && t.matches && t.matches('input, textarea, select, [contenteditable="true"]')) return;

    // Esc always closes the panel.
    if (e.key === 'Escape' && open) {
      setOpen(false);
      e.preventDefault();
      return;
    }

    if (e.metaKey || e.ctrlKey || e.altKey) return;

    const cur = currentIndex();

    if (e.key === 'ArrowLeft') {
      navigateTo(cur - 1);
      e.preventDefault();
    } else if (e.key === 'ArrowRight') {
      navigateTo(cur + 1);
      e.preventDefault();
    } else if (e.key === 't' || e.key === 'T') {
      location.href = INDEX_PATH;
      e.preventDefault();
    } else if (/^[1-9]$/.test(e.key)) {
      const idx = parseInt(e.key, 10) - 1;
      if (idx < TOOLS.length) {
        navigateTo(idx);
        e.preventDefault();
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
  document.addEventListener('keydown', handleKey);
})();
