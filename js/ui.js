/**
 * DiffNote — UI shell controller: theme toggle, sidebar/inspector drawers,
 * and reset. Layout/theme only; diff + AI logic live elsewhere.
 *
 * Theme: the INITIAL theme is set by a blocking inline script in <head> to
 * avoid flash. This file only handles the toggle + persistence afterward.
 */
(function () {
  'use strict';

  const root = document.documentElement;
  const appBody = document.querySelector('.app-body');
  const scrim = document.getElementById('scrim');
  const themeBtn = document.getElementById('themeBtn');
  const notesBtn = document.getElementById('notesBtn');
  const resetBtn = document.getElementById('resetBtn');
  const themeColorMeta = document.getElementById('themeColorMeta');
  const topLangSelect = document.getElementById('topLangSelect');

  const THEME_COLORS = { light: '#f5f5f7', dark: '#1d1d1f' };
  // Light theme → show moon (click for dark); dark → show sun.
  const THEME_ICON = { light: 'moon', dark: 'sun' };

  const isWide = () => window.matchMedia('(min-width: 769px)').matches;

  // ---- Theme ----------------------------------------------------------
  function applyThemeUI(theme) {
    window.DiffNoteIcons.set(themeBtn, THEME_ICON[theme]);
    if (themeColorMeta) themeColorMeta.setAttribute('content', THEME_COLORS[theme]);
  }
  applyThemeUI(root.dataset.theme || 'light');

  themeBtn.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('diffnote-theme', next); } catch (e) { /* private mode */ }
    applyThemeUI(next);
  });

  // ---- Toast (top-right) ----------------------------------------------
  const toastContainer = document.getElementById('toastContainer');
  function showToast(message, type) {
    if (!toastContainer) return;
    const el = document.createElement('div');
    el.className = 'toast toast-' + (type || 'success');
    el.setAttribute('role', 'status');
    const icon = document.createElement('span');
    icon.className = 'toast-icon';
    icon.innerHTML = window.DiffNoteIcons.get(type === 'error' ? 'alert' : 'check');
    const text = document.createElement('span');
    text.textContent = message;
    el.append(icon, text);
    toastContainer.append(el);
    // Animate in, then auto-dismiss.
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 300);
    }, 2600);
  }
  window.DiffNoteToast = { show: showToast };

  // ---- Topbar language quick-switch -----------------------------------
  function syncLangSelect() {
    if (topLangSelect) topLangSelect.value = window.DiffNoteSettings.getLanguage();
  }
  function buildLangSelect() {
    if (!topLangSelect) return;
    topLangSelect.innerHTML = '';
    window.DiffNoteSettings.LANGUAGES.forEach((l) => {
      const opt = document.createElement('option');
      opt.value = l.id;
      opt.textContent = l.label;
      topLangSelect.append(opt);
    });
    syncLangSelect();
  }
  buildLangSelect();
  if (topLangSelect) {
    topLangSelect.addEventListener('change', () => {
      const s = window.DiffNoteSettings.load();
      s.language = topLangSelect.value;
      window.DiffNoteSettings.save(s);
      if (window.DiffNoteApp && window.DiffNoteApp.onLanguageChange) {
        window.DiffNoteApp.onLanguageChange();
      } else {
        window.DiffNoteI18n.apply(document);
      }
    });
  }
  // Expose so other modules can re-sync the topbar selector after a change.
  window.DiffNoteUI = { syncLangSelect };

  // ---- Inspector drawer / scrim ---------------------------------------
  function updateScrim() {
    scrim.hidden = !appBody.classList.contains('notes-open');
  }
  function closeDrawers() {
    appBody.classList.remove('notes-open');
    updateScrim();
  }
  scrim.addEventListener('click', closeDrawers);

  // Notes (inspector): docked collapse-toggle on wide, overlay drawer on narrow.
  notesBtn.addEventListener('click', () => {
    if (isWide()) {
      const hidden = appBody.classList.toggle('notes-hidden');
      notesBtn.setAttribute('aria-pressed', String(!hidden));
    } else {
      const open = appBody.classList.toggle('notes-open');
      notesBtn.setAttribute('aria-pressed', String(open));
      updateScrim();
    }
  });

  // Reset clears comparison state (delegated to app.js).
  resetBtn.addEventListener('click', () => {
    if (window.DiffNoteApp && typeof window.DiffNoteApp.reset === 'function') {
      window.DiffNoteApp.reset();
    }
  });

  // Clean up drawer state when crossing back to wide layout.
  window.matchMedia('(min-width: 769px)').addEventListener('change', closeDrawers);
})();
