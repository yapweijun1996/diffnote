/**
 * DiffNote — UI shell controller: theme toggle, inspector layout/drawers,
 * reset, and the user-controlled service worker update prompt. Diff + AI
 * logic live elsewhere.
 *
 * Theme: the INITIAL theme is set by a blocking inline script in <head> to
 * avoid flash. This file only handles the toggle + persistence afterward.
 */
(function () {
  'use strict';

  const root = document.documentElement;
  const app = document.querySelector('.app');
  const appBody = document.querySelector('.app-body');
  const scrim = document.getElementById('scrim');
  const resizeHandle = document.getElementById('inspectorResizeHandle');
  const collapseBtn = document.getElementById('inspectorCollapseBtn');
  const themeBtn = document.getElementById('themeBtn');
  const notesBtn = document.getElementById('notesBtn');
  const resetBtn = document.getElementById('resetBtn');
  const themeColorMeta = document.getElementById('themeColorMeta');
  const topLangSelect = document.getElementById('topLangSelect');

  const THEME_COLORS = { light: '#f5f5f7', dark: '#1d1d1f' };
  // Light theme → show moon (click for dark); dark → show sun.
  const THEME_ICON = { light: 'moon', dark: 'sun' };

  const isWide = () => window.matchMedia('(min-width: 901px)').matches;

  // Inspector sizing is presentation-only state. Keep it in this UI module so
  // diff/file state never depends on the user's preferred panel width.
  const INSPECTOR_WIDTH_KEY = 'diffnote-inspector-width';
  const DEFAULT_INSPECTOR_RATIO = 0.25;
  const MIN_INSPECTOR_WIDTH = 300;
  const MAX_INSPECTOR_RATIO = 0.5;
  const MIN_DIFF_WIDTH = 420;
  const RESIZE_HANDLE_WIDTH = 10;
  const KEYBOARD_STEP = 16;
  const KEYBOARD_LARGE_STEP = 64;

  let inspectorWidth = readStoredInspectorWidth();
  let expandedInspectorWidth = inspectorWidth;
  let resizeState = null;

  function readStoredInspectorWidth() {
    try {
      const value = Number.parseInt(localStorage.getItem(INSPECTOR_WIDTH_KEY), 10);
      return Number.isFinite(value) && value > 0 ? value : null;
    } catch (e) {
      return null;
    }
  }

  function persistInspectorWidth(width) {
    try { localStorage.setItem(INSPECTOR_WIDTH_KEY, String(Math.round(width))); }
    catch (e) { /* private mode or storage unavailable */ }
  }

  function getWidthBounds() {
    const bodyWidth = appBody ? appBody.clientWidth : window.innerWidth;
    const maxByDiff = Math.max(0, bodyWidth - RESIZE_HANDLE_WIDTH - MIN_DIFF_WIDTH);
    const maxByViewport = Math.floor(window.innerWidth * MAX_INSPECTOR_RATIO);
    const max = Math.max(MIN_INSPECTOR_WIDTH, Math.min(maxByDiff, maxByViewport));
    const min = Math.min(MIN_INSPECTOR_WIDTH, max);
    return { min, max };
  }

  function clampInspectorWidth(width) {
    const bounds = getWidthBounds();
    const value = Number.isFinite(Number(width)) ? Number(width) : bounds.min;
    return Math.round(Math.min(bounds.max, Math.max(bounds.min, value)));
  }

  function getDefaultInspectorWidth() {
    const bodyWidth = appBody ? appBody.clientWidth : window.innerWidth;
    return clampInspectorWidth(bodyWidth * DEFAULT_INSPECTOR_RATIO);
  }

  function updateResizeHandleA11y(width) {
    if (!resizeHandle) return;
    const bounds = getWidthBounds();
    const current = clampInspectorWidth(width);
    resizeHandle.setAttribute('aria-valuemin', String(Math.round(bounds.min)));
    resizeHandle.setAttribute('aria-valuemax', String(Math.round(bounds.max)));
    resizeHandle.setAttribute('aria-valuenow', String(current));
    resizeHandle.setAttribute('aria-valuetext', window.DiffNoteI18n.t('inspector.resizeValue', { width: current }));
  }

  function applyInspectorWidth(width, persist = false) {
    if (!appBody || !isWide()) return;
    const current = clampInspectorWidth(width);
    inspectorWidth = current;
    appBody.style.gridTemplateColumns = `minmax(${MIN_DIFF_WIDTH}px, 1fr) ${RESIZE_HANDLE_WIDTH}px ${current}px`;
    updateResizeHandleA11y(current);
    if (persist) persistInspectorWidth(current);
  }

  function syncWideInspectorLayout() {
    if (!appBody || !isWide() || app?.dataset.mode !== 'diff') return;
    const collapsed = appBody.classList.contains('notes-hidden');
    const hadStoredWidth = inspectorWidth != null;
    const candidate = expandedInspectorWidth || inspectorWidth || getDefaultInspectorWidth();
    const current = clampInspectorWidth(candidate);
    expandedInspectorWidth = current;
    if (collapsed) {
      appBody.style.gridTemplateColumns = 'minmax(0, 1fr) 0 0';
      updateResizeHandleA11y(current);
    } else applyInspectorWidth(current);
    if (hadStoredWidth && current !== candidate) {
      persistInspectorWidth(current);
    }
  }

  function setCollapseButtonState(collapsed) {
    if (collapseBtn) {
      window.DiffNoteIcons.set(collapseBtn, collapsed ? 'chevron-right' : 'chevron-left');
      const key = collapsed ? 'inspector.expand' : 'inspector.collapse';
      const label = window.DiffNoteI18n.t(key);
      collapseBtn.setAttribute('aria-expanded', String(!collapsed));
      collapseBtn.setAttribute('aria-label', label);
      collapseBtn.setAttribute('title', label);
    }
    if (notesBtn) notesBtn.setAttribute('aria-pressed', String(!collapsed));
  }

  function setInspectorCollapsed(collapsed) {
    if (!appBody || !isWide()) return;
    if (collapsed) {
      expandedInspectorWidth = clampInspectorWidth(expandedInspectorWidth || inspectorWidth || getDefaultInspectorWidth());
      appBody.classList.add('notes-hidden');
      appBody.style.gridTemplateColumns = 'minmax(0, 1fr) 0 0';
    } else {
      appBody.classList.remove('notes-hidden');
      applyInspectorWidth(expandedInspectorWidth || inspectorWidth || getDefaultInspectorWidth());
    }
    setCollapseButtonState(collapsed);
  }

  function resetInspectorWidth() {
    if (!isWide() || app?.dataset.mode !== 'diff') return;
    setInspectorCollapsed(false);
    const current = getDefaultInspectorWidth();
    expandedInspectorWidth = current;
    applyInspectorWidth(current, true);
  }

  function finishInspectorResize(event, persist = true) {
    if (!resizeState) return;
    if (event && event.pointerId !== resizeState.pointerId) return;
    const pointerId = resizeState.pointerId;
    if (persist && inspectorWidth != null) {
      expandedInspectorWidth = inspectorWidth;
      persistInspectorWidth(inspectorWidth);
    }
    try {
      if (resizeHandle && resizeHandle.hasPointerCapture(pointerId)) resizeHandle.releasePointerCapture(pointerId);
    } catch (e) { /* pointer capture may already be gone */ }
    document.body.classList.remove('is-resizing-inspector');
    if (resizeHandle) resizeHandle.classList.remove('is-dragging');
    resizeState = null;
  }

  function handleInspectorPointerDown(event) {
    if (!resizeHandle || !isWide() || app?.dataset.mode !== 'diff' || !event.isPrimary) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (event.pointerType !== 'mouse' && event.button !== 0) return;
    const current = clampInspectorWidth(expandedInspectorWidth || inspectorWidth || getDefaultInspectorWidth());
    resizeState = { pointerId: event.pointerId, startX: event.clientX, startWidth: current };
    event.preventDefault();
    resizeHandle.classList.add('is-dragging');
    document.body.classList.add('is-resizing-inspector');
    try { resizeHandle.setPointerCapture(event.pointerId); }
    catch (e) { /* pointer capture is optional; window cleanup remains active */ }
  }

  function handleInspectorPointerMove(event) {
    if (!resizeState || event.pointerId !== resizeState.pointerId) return;
    event.preventDefault();
    const delta = event.clientX - resizeState.startX;
    applyInspectorWidth(resizeState.startWidth - delta);
  }

  function handleInspectorKeydown(event) {
    if (!isWide() || app?.dataset.mode !== 'diff') return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const step = event.shiftKey ? KEYBOARD_LARGE_STEP : KEYBOARD_STEP;
    const current = clampInspectorWidth(expandedInspectorWidth || inspectorWidth || getDefaultInspectorWidth());
    const next = event.key === 'ArrowLeft' ? current + step : current - step;
    expandedInspectorWidth = clampInspectorWidth(next);
    applyInspectorWidth(expandedInspectorWidth, true);
  }

  function clearDesktopInspectorLayout() {
    if (!appBody) return;
    finishInspectorResize(null, false);
    appBody.style.removeProperty('grid-template-columns');
    appBody.classList.remove('notes-hidden');
    setCollapseButtonState(false);
  }

  function handleBreakpointChange() {
    if (isWide()) {
      closeDrawers();
      syncWideInspectorLayout();
    } else {
      clearDesktopInspectorLayout();
      closeDrawers();
    }
  }

  if (resizeHandle) {
    resizeHandle.addEventListener('pointerdown', handleInspectorPointerDown);
    resizeHandle.addEventListener('pointermove', handleInspectorPointerMove);
    resizeHandle.addEventListener('pointerup', (event) => finishInspectorResize(event));
    resizeHandle.addEventListener('pointercancel', (event) => finishInspectorResize(event, false));
    resizeHandle.addEventListener('lostpointercapture', (event) => finishInspectorResize(event));
    resizeHandle.addEventListener('dblclick', (event) => {
      if (!isWide()) return;
      event.preventDefault();
      resetInspectorWidth();
    });
    resizeHandle.addEventListener('keydown', handleInspectorKeydown);
    updateResizeHandleA11y(inspectorWidth || getDefaultInspectorWidth());
  }
  if (collapseBtn) collapseBtn.addEventListener('click', () => {
    setInspectorCollapsed(!appBody.classList.contains('notes-hidden'));
  });
  window.addEventListener('pointerup', (event) => finishInspectorResize(event));
  window.addEventListener('pointercancel', (event) => finishInspectorResize(event, false));
  window.addEventListener('resize', () => {
    if (isWide()) syncWideInspectorLayout();
    else clearDesktopInspectorLayout();
  });
  if (app) {
    new MutationObserver(() => {
      if (app.dataset.mode === 'diff') syncWideInspectorLayout();
      else clearDesktopInspectorLayout();
    }).observe(app, { attributes: true, attributeFilter: ['data-mode'] });
  }
  new MutationObserver(() => {
    if (inspectorWidth != null) updateResizeHandleA11y(inspectorWidth);
    setCollapseButtonState(appBody?.classList.contains('notes-hidden') || false);
  }).observe(root, { attributes: true, attributeFilter: ['lang'] });

  // ---- Inspector tabs --------------------------------------------------
  const inspectorTabs = Array.from(document.querySelectorAll('[data-inspector-tab]'));
  const inspectorPanels = inspectorTabs
    .map((tab) => document.getElementById(tab.getAttribute('aria-controls')))
    .filter(Boolean);

  function setInspectorTab(name, focus = false) {
    inspectorTabs.forEach((tab) => {
      const selected = tab.dataset.inspectorTab === name;
      tab.classList.toggle('is-selected', selected);
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected && focus) tab.focus();
    });
    inspectorPanels.forEach((panel) => {
      panel.hidden = panel.id !== name + 'Panel';
    });
  }

  inspectorTabs.forEach((tab, index) => {
    tab.addEventListener('click', () => setInspectorTab(tab.dataset.inspectorTab));
    tab.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return;
      e.preventDefault();
      let next = index;
      if (e.key === 'ArrowRight') next = (index + 1) % inspectorTabs.length;
      if (e.key === 'ArrowLeft') next = (index - 1 + inspectorTabs.length) % inspectorTabs.length;
      if (e.key === 'Home') next = 0;
      if (e.key === 'End') next = inspectorTabs.length - 1;
      setInspectorTab(inspectorTabs[next].dataset.inspectorTab, true);
    });
  });
  setInspectorTab('summary');

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

  // ---- Service worker update prompt -----------------------------------
  const updateBanner = document.getElementById('updateBanner');
  const updateBannerMessage = document.getElementById('updateBannerMessage');
  const updateNowBtn = document.getElementById('updateNowBtn');
  const updateLaterBtn = document.getElementById('updateLaterBtn');
  let updateHandlers = {};

  function applyUpdateText() {
    if (updateBanner && window.DiffNoteI18n) window.DiffNoteI18n.apply(updateBanner);
  }
  function setUpdateMessage(key) {
    if (!updateBannerMessage) return;
    updateBannerMessage.setAttribute('data-i18n', key);
    applyUpdateText();
  }
  function setUpdateActions(nowKey, laterKey) {
    if (updateNowBtn) updateNowBtn.setAttribute('data-i18n', nowKey);
    if (updateLaterBtn) updateLaterBtn.setAttribute('data-i18n', laterKey);
    applyUpdateText();
  }
  function showUpdateAvailable(handlers) {
    updateHandlers = handlers || {};
    setUpdateMessage('pwa.updatePrompt');
    setUpdateActions('pwa.updateNow', 'pwa.updateLater');
    if (updateNowBtn) updateNowBtn.disabled = false;
    if (updateLaterBtn) { updateLaterBtn.hidden = false; updateLaterBtn.disabled = false; }
    if (updateBanner) updateBanner.hidden = false;
  }
  function showUpdateProgress() {
    setUpdateMessage('pwa.updating');
    setUpdateActions('pwa.updating', 'pwa.updateLater');
    if (updateNowBtn) updateNowBtn.disabled = true;
    if (updateLaterBtn) { updateLaterBtn.hidden = true; updateLaterBtn.disabled = true; }
    if (updateBanner) updateBanner.hidden = false;
  }
  function showUpdateError(handlers) {
    updateHandlers = handlers || {};
    setUpdateMessage('pwa.updateFailed');
    setUpdateActions('pwa.retryUpdate', 'pwa.dismissUpdate');
    if (updateNowBtn) updateNowBtn.disabled = false;
    if (updateLaterBtn) { updateLaterBtn.hidden = false; updateLaterBtn.disabled = false; }
    if (updateBanner) updateBanner.hidden = false;
  }
  function hideUpdatePrompt() {
    if (updateBanner) updateBanner.hidden = true;
    updateHandlers = {};
  }
  if (updateNowBtn) {
    updateNowBtn.addEventListener('click', () => {
      if (updateHandlers.onUpdate) updateHandlers.onUpdate();
      else if (updateHandlers.onRetry) updateHandlers.onRetry();
    });
  }
  if (updateLaterBtn) {
    updateLaterBtn.addEventListener('click', () => {
      if (updateHandlers.onLater) updateHandlers.onLater();
      else if (updateHandlers.onDismiss) updateHandlers.onDismiss();
      else hideUpdatePrompt();
    });
  }

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
  window.DiffNoteUI = {
    syncLangSelect,
    showUpdateAvailable,
    showUpdateProgress,
    showUpdateError,
    hideUpdatePrompt,
  };

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
      setInspectorCollapsed(!appBody.classList.contains('notes-hidden'));
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

  // Reconcile docked and drawer presentation when crossing the breakpoint.
  window.matchMedia('(min-width: 901px)').addEventListener('change', handleBreakpointChange);
})();
