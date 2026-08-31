/**
 * DiffNote — main application controller.
 *
 * Wires file inputs (drag/drop + click), runs the diff engine, renders the
 * visual diff, fills the analysis panels, and handles the commit-message copy
 * action. All reading happens in-browser via FileReader; nothing is uploaded.
 */
(function () {
  'use strict';

  const MAX_BYTES = 2 * 1024 * 1024; // 2MB guard for the local-first MVP.

  // `handle` is a FileSystemFileHandle when the file was opened via the File
  // System Access API (Chrome/Edge/Opera). It re-reads live disk content, so
  // Refresh actually reflects edits. Drag/drop + <input> only give a `file`
  // snapshot that goes stale once the file is edited on disk.
  const supportsFsAccess = typeof window.showOpenFilePicker === 'function';

  const state = {
    before: { name: null, text: null, file: null, handle: null },
    after: { name: null, text: null, file: null, handle: null },
  };

  // --- DOM refs -------------------------------------------------------------
  const els = {
    appRoot: document.querySelector('.app'),
    inspector: document.getElementById('inspector'),
    startupZones: document.getElementById('startupZones'),
    inspectorDropHost: document.getElementById('dropzones'),
    statsBar: document.getElementById('statsBar'),
    statsEmpty: document.getElementById('statsEmpty'),
    statAdded: document.getElementById('statAdded'),
    statDeleted: document.getElementById('statDeleted'),
    statBlocks: document.getElementById('statBlocks'),
    headerBeforeName: document.getElementById('headerBeforeName'),
    headerAfterName: document.getElementById('headerAfterName'),
    diffHeaderStats: document.getElementById('diffHeaderStats'),
    headerStatAdded: document.getElementById('headerStatAdded'),
    headerStatDeleted: document.getElementById('headerStatDeleted'),
    headerStatBlocks: document.getElementById('headerStatBlocks'),
    diffViewer: document.getElementById('diffViewer'),
    diffMinimap: document.getElementById('diffMinimap'),
    minimapViewport: document.getElementById('minimapViewport'),
    allLinesBtn: document.getElementById('allLinesBtn'),
    changesOnlyBtn: document.getElementById('changesOnlyBtn'),
    copyDiffBtn: document.getElementById('copyDiffBtn'),
    refreshBtn: document.getElementById('refreshBtn'),
    prevDiffBtn: document.getElementById('prevDiffBtn'),
    nextDiffBtn: document.getElementById('nextDiffBtn'),
    diffPosition: document.getElementById('diffPosition'),
    aiContent: document.getElementById('aiContent'),
    risksContent: document.getElementById('risksContent'),
    testsContent: document.getElementById('testsContent'),
    commitContent: document.getElementById('commitContent'),
    inspectorPanels: document.getElementById('inspectorTabPanels'),
    analysisLoading: document.getElementById('analysisLoading'),
    generateBtn: document.getElementById('generateBtn'),
  };

  // Cache the original placeholders so reset can restore each tab in place.
  const EMPTY_PANEL_HTML = {
    summary: els.aiContent.innerHTML,
    risks: els.risksContent.innerHTML,
    tests: els.testsContent.innerHTML,
    commit: els.commitContent.innerHTML,
  };

  // --- Startup gate ---------------------------------------------------------
  // The file inputs are only useful before a diff exists. At startup they sit
  // centered (#startupZones); once both files load they collapse into the
  // sidebar (#dropzones). Moving the SAME nodes preserves their listeners.
  function placeDropzones(host) {
    host.append(document.getElementById('dropBefore'), document.getElementById('dropAfter'));
  }
  function setMode(mode) { els.appRoot.dataset.mode = mode; }

  function renderFileMeta() {
    if (els.headerBeforeName) els.headerBeforeName.textContent = state.before.name || '—';
    if (els.headerAfterName) els.headerAfterName.textContent = state.after.name || '—';
  }

  let lastResult = null; // latest diff result, for on-demand AI generation
  let changesOnly = false;

  // --- File reading ---------------------------------------------------------
  function readFile(file) {
    return new Promise((resolve, reject) => {
      if (file.size > MAX_BYTES) {
        reject(new Error(window.DiffNoteI18n.t('error.fileTooLarge', { kb: Math.round(file.size / 1024) })));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error(window.DiffNoteI18n.t('error.fileRead')));
      reader.readAsText(file);
    });
  }

  async function handleFile(side, file, handle = null) {
    const zone = document.getElementById(side === 'before' ? 'dropBefore' : 'dropAfter');
    const hint = zone.querySelector('[data-hint]');
    const nameEl = zone.querySelector('[data-filename]');
    try {
      const text = await readFile(file);
      // Keep the handle (live disk) when we have one, else the File snapshot.
      state[side] = { name: file.name, text, file, handle };
      nameEl.textContent = file.name;
      nameEl.hidden = false;
      hint.hidden = true;
      zone.classList.remove('has-error');
      zone.classList.add('has-file');
      renderFileMeta();
      maybeCompare();
    } catch (err) {
      // Story 3 AC: error shown when a file cannot be read.
      zone.classList.add('has-error');
      hint.hidden = false;
      hint.textContent = err.message;
      nameEl.hidden = true;
    }
  }

  // --- Compare + render -----------------------------------------------------
  function maybeCompare() {
    if (state.before.text === null || state.after.text === null) return;
    const result = DiffNoteDiff.compute(state.before.text, state.after.text);
    lastResult = result;
    renderStats(result.stats);
    renderDiff(result.rows);
    renderAI(result); // local baseline keeps the app useful offline
    placeDropzones(els.inspectorDropHost); // collapse inputs into the inspector
    setMode('diff');
    buildMinimap(); // after the diff area is visible so rows have height
    showRegenButton();
    generate(); // auto-upgrade the local baseline to real AI notes
  }

  // Serialize diff rows into a unified-diff-style text for the LLM prompt.
  // Unchanged lines are collapsed to at most CONTEXT lines around each change
  // block so historical file content doesn't pollute the LLM's context.
  function buildUnifiedDiff(rows) {
    const CONTEXT = 3;
    const changed = rows.map((r) => r.type !== 'unchanged');
    const keep = changed.map((_, i) => {
      if (changed[i]) return true;
      for (let d = 1; d <= CONTEXT; d++) {
        if (changed[i - d] || changed[i + d]) return true;
      }
      return false;
    });

    const lines = [];
    let ellipsis = false;
    for (let i = 0; i < rows.length; i++) {
      if (!keep[i]) {
        if (!ellipsis) { lines.push('...'); ellipsis = true; }
        continue;
      }
      ellipsis = false;
      const r = rows[i];
      const sign = r.type === 'added' ? '+' : r.type === 'deleted' ? '-' : ' ';
      lines.push(sign + r.text);
    }
    return lines.join('\n');
  }

  function renderStats(stats) {
    els.statAdded.textContent = stats.added;
    els.statDeleted.textContent = stats.deleted;
    els.statBlocks.textContent = stats.blocks;
    if (els.headerStatAdded) els.headerStatAdded.textContent = stats.added;
    if (els.headerStatDeleted) els.headerStatDeleted.textContent = stats.deleted;
    if (els.headerStatBlocks) els.headerStatBlocks.textContent = stats.blocks;
    if (els.diffHeaderStats) els.diffHeaderStats.hidden = false;
    els.statsBar.hidden = false;
    if (els.statsEmpty) els.statsEmpty.hidden = true;
  }

  function renderDiff(rows) {
    const frag = document.createDocumentFragment();
    const table = document.createElement('table');
    table.className = 'diff-table';

    let inBlock = false;
    for (const row of rows) {
      const tr = document.createElement('tr');
      tr.className = 'diff-row diff-' + row.type;

      // Mark the first row of each contiguous change block for nav + separators.
      if (row.type === 'unchanged') {
        inBlock = false;
      } else if (!inBlock) {
        tr.classList.add('diff-block-start');
        inBlock = true;
      }

      const beforeNo = document.createElement('td');
      beforeNo.className = 'line-no';
      beforeNo.textContent = row.beforeLine == null ? '' : row.beforeLine;

      const afterNo = document.createElement('td');
      afterNo.className = 'line-no';
      afterNo.textContent = row.afterLine == null ? '' : row.afterLine;

      const marker = document.createElement('td');
      marker.className = 'line-marker';
      marker.textContent = row.type === 'added' ? '+' : row.type === 'deleted' ? '-' : ' ';

      const code = document.createElement('td');
      code.className = 'line-code';
      code.textContent = row.text;

      tr.append(beforeNo, afterNo, marker, code);
      frag.append(tr);
    }

    table.append(frag);
    els.diffViewer.innerHTML = '';
    els.diffViewer.append(table);
    refreshBlocks();
  }

  // --- Change-location map (overview) --------------------------------------
  // Draws a compressed bar of where the file changed, plus a viewport box.
  function buildMinimap() {
    const map = els.diffMinimap;
    const dv = els.diffViewer;
    if (!map || !dv) return;
    map.querySelectorAll('.minimap-seg').forEach((s) => s.remove());
    const totalH = dv.scrollHeight;
    if (totalH < 1) return;
    const dvTop = dv.getBoundingClientRect().top;
    const frag = document.createDocumentFragment();
    let runType = null;
    let runTop = 0;
    let runBottom = 0;
    const flush = () => {
      if (!runType) return;
      const seg = document.createElement('div');
      seg.className = 'minimap-seg minimap-' + runType;
      seg.style.top = (runTop / totalH * 100) + '%';
      seg.style.height = Math.max(0.4, (runBottom - runTop) / totalH * 100) + '%';
      frag.appendChild(seg);
    };
    dv.querySelectorAll('.diff-row').forEach((r) => {
      const rect = r.getBoundingClientRect();
      if (rect.height === 0) return; // hidden by "changes only"
      const type = r.classList.contains('diff-added') ? 'added'
        : r.classList.contains('diff-deleted') ? 'deleted' : null;
      const top = rect.top - dvTop + dv.scrollTop;
      if (type !== runType) { flush(); runType = type; runTop = top; runBottom = top + rect.height; }
      else { runBottom = top + rect.height; }
    });
    flush();
    map.appendChild(frag);
    updateMinimapViewport();
  }

  function updateMinimapViewport() {
    const vp = els.minimapViewport;
    const dv = els.diffViewer;
    if (!vp || !dv) return;
    const h = dv.scrollHeight || 1;
    vp.style.top = (dv.scrollTop / h * 100) + '%';
    vp.style.height = Math.min(100, dv.clientHeight / h * 100) + '%';
  }

  // Map a minimap pointer position to the same centered jump used by click.
  function scrollToMinimapPosition(clientY) {
    const map = els.diffMinimap;
    const dv = els.diffViewer;
    if (!map || !dv) return;
    const rect = map.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (clientY - rect.top) / (rect.height || 1)));
    const maxScrollTop = Math.max(0, dv.scrollHeight - dv.clientHeight);
    const target = fraction * dv.scrollHeight - dv.clientHeight / 2;
    dv.scrollTop = Math.max(0, Math.min(maxScrollTop, target));
  }

  // --- Change navigation + "changes only" filter ---------------------------
  let blockEls = [];
  let currentBlock = -1;

  function refreshBlocks() {
    blockEls = Array.from(els.diffViewer.querySelectorAll('.diff-block-start'));
    currentBlock = -1;
    updateBlockNav();
  }

  function updateBlockNav() {
    if (els.diffPosition) {
      const position = currentBlock < 0 ? '—' : String(currentBlock + 1);
      els.diffPosition.textContent = blockEls.length ? `${position} of ${blockEls.length}` : '—';
    }
    const disabled = blockEls.length === 0;
    if (els.prevDiffBtn) els.prevDiffBtn.disabled = disabled;
    if (els.nextDiffBtn) els.nextDiffBtn.disabled = disabled;
  }

  function gotoBlock(step) {
    if (!blockEls.length) return;
    currentBlock = (currentBlock + step + blockEls.length) % blockEls.length;
    const el = blockEls[currentBlock];
    blockEls.forEach((b) => b.classList.remove('diff-block-active'));
    el.classList.add('diff-block-active');
    updateBlockNav();
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function applyChangesOnly(on) {
    changesOnly = !!on;
    els.diffViewer.classList.toggle('changes-only', changesOnly);
    if (els.allLinesBtn) {
      els.allLinesBtn.classList.toggle('is-selected', !changesOnly);
      els.allLinesBtn.setAttribute('aria-pressed', String(!changesOnly));
    }
    if (els.changesOnlyBtn) {
      els.changesOnlyBtn.classList.toggle('is-selected', changesOnly);
      els.changesOnlyBtn.setAttribute('aria-pressed', String(changesOnly));
    }
    buildMinimap(); // row heights changed → redraw the map
  }

  // Copy the whole diff (with filenames) so it can be pasted into another AI.
  async function copyDiff() {
    if (!lastResult) return;
    const before = state.before.name || 'before';
    const after = state.after.name || 'after';
    // WYSIWYG: match the "changes only" filter — copy just the +/- lines when on.
    const rows = changesOnly
      ? lastResult.rows.filter((r) => r.type !== 'unchanged')
      : lastResult.rows;
    const text = `--- ${before}\n+++ ${after}\n\n` + buildUnifiedDiff(rows);
    const T = window.DiffNoteI18n.t;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove();
      }
      if (window.DiffNoteToast) window.DiffNoteToast.show(T('toolbar.diffCopied'), 'success');
    } catch (e) {
      if (window.DiffNoteToast) window.DiffNoteToast.show(T('copy.failed'), 'error');
    }
  }

  // Re-read the already-picked files and re-run the diff. Manual on purpose:
  // the user edits + saves on disk, then clicks Refresh. Re-renders the diff +
  // instant local baseline only — the costly LLM call stays behind Regenerate.
  // A handle (File System Access) reads live disk content; a bare File is a
  // snapshot that throws once edited, so we tell the user to re-drop it.
  async function refresh() {
    if (!state.before.file || !state.after.file) return;
    const T = window.DiffNoteI18n.t;
    try {
      for (const side of ['before', 'after']) {
        const s = state[side];
        const file = s.handle ? await s.handle.getFile() : s.file;
        s.text = await readFile(file);
        s.file = file;
      }
    } catch (e) {
      // A bare-File reference goes stale once the file is edited on disk.
      if (window.DiffNoteToast) window.DiffNoteToast.show(T('error.refreshStale'), 'error');
      return;
    }
    const result = DiffNoteDiff.compute(state.before.text, state.after.text);
    lastResult = result;
    renderStats(result.stats);
    renderDiff(result.rows);
    renderAI(result); // refresh the local baseline
    buildMinimap();
    if (window.DiffNoteToast) window.DiffNoteToast.show(T('toolbar.refreshed'), 'success');
  }

  function renderAI(result) {
    const maxLen = DiffNoteSettings.getCommitMaxLen();
    renderNotes(DiffNoteAI.generate(result, state.after.name || state.before.name, maxLen));
  }

  // Render one structured notes object into the four focused inspector tabs.
  function renderNotes(ai) {
    const T = window.DiffNoteI18n.t;
    els.aiContent.innerHTML = '';
    els.aiContent.append(
      section(T('notes.overview'), textBlock(ai.overview)),
      section(T('notes.keyChanges'), list(ai.breakdown)),
      section(T('notes.highestRisk'), list([ai.risks[0] || 'No notable risk identified.']))
    );
    els.risksContent.innerHTML = '';
    els.risksContent.append(section(T('notes.risks'), list(ai.risks)));
    els.testsContent.innerHTML = '';
    els.testsContent.append(section(T('notes.tests'), list(ai.tests)));
    els.commitContent.innerHTML = '';
    els.commitContent.append(commitSection(ai.commit));
  }

  function generateLabelEl() {
    return els.generateBtn.querySelector('.btn-label');
  }

  // On-demand re-run of the LLM (notes also auto-generate after each diff).
  function showRegenButton() {
    if (!els.generateBtn) return;
    generateLabelEl().textContent = window.DiffNoteI18n.t('generate.regenAnalysis');
    els.generateBtn.hidden = false;
  }

  async function generate() {
    if (!lastResult) return;
    const active = DiffNoteSettings.getActive();
    const fileName = state.after.name || state.before.name;
    const diffText = buildUnifiedDiff(lastResult.rows);

    els.generateBtn.disabled = true;
    const labelEl = generateLabelEl();
    const prevLabel = labelEl.textContent;
    labelEl.textContent = window.DiffNoteI18n.t('generate.loading');
    showLoading();

    try {
      const opts = {
        languageName: DiffNoteSettings.getLanguageName(),
        commitLanguageName: DiffNoteSettings.getCommitLanguageName(),
        commitInstruction: DiffNoteSettings.resolveCommitPrompt(),
        maxLen: DiffNoteSettings.getCommitMaxLen(),
      };
      const notes = await DiffNoteLLM.generateNotes(active, diffText, fileName, opts);
      renderNotes(notes);
    } catch (err) {
      // Fall back to the local baseline + surface the error; never leave a broken panel.
      renderAI(lastResult);
      const warn = document.createElement('p');
      warn.className = 'ai-error';
      warn.textContent = window.DiffNoteI18n.t('error.aiFailed', { msg: err.message });
      els.aiContent.prepend(warn);
    } finally {
      if (els.inspectorPanels) els.inspectorPanels.classList.remove('is-generating');
      if (els.analysisLoading) els.analysisLoading.hidden = true;
      els.generateBtn.disabled = false;
      labelEl.textContent = prevLabel;
    }
  }

  // Dim the current notes and show a spinner while the LLM runs.
  function showLoading() {
    if (els.inspectorPanels) els.inspectorPanels.classList.add('is-generating');
    if (els.analysisLoading) {
      els.analysisLoading.hidden = false;
      window.DiffNoteI18n.apply(els.analysisLoading);
    }
  }

  // --- AI panel builders ----------------------------------------------------
  function section(title, body) {
    const wrap = document.createElement('div');
    wrap.className = 'ai-section';
    const h = document.createElement('h3');
    h.textContent = title;
    wrap.append(h, body);
    return wrap;
  }

  function textBlock(text) {
    const p = document.createElement('p');
    p.textContent = text;
    return p;
  }

  function list(items) {
    const ul = document.createElement('ul');
    for (const item of items) {
      const li = document.createElement('li');
      li.textContent = item;
      ul.append(li);
    }
    return ul;
  }

  function commitSection(message) {
    const wrap = document.createElement('div');
    wrap.className = 'ai-section';
    const h = document.createElement('h3');
    h.textContent = window.DiffNoteI18n.t('notes.commit');

    const row = document.createElement('div');
    row.className = 'commit-row';

    const code = document.createElement('code');
    code.className = 'commit-msg';
    code.textContent = message;

    const btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.type = 'button';
    const btnIcon = document.createElement('span');
    btnIcon.className = 'btn-icon';
    btnIcon.innerHTML = window.DiffNoteIcons.get('copy');
    const btnLabel = document.createElement('span');
    btnLabel.className = 'btn-label';
    btnLabel.textContent = window.DiffNoteI18n.t('copy.label');
    btn.append(btnIcon, btnLabel);
    btn.addEventListener('click', () => copyToClipboard(message, btn));

    row.append(code, btn);
    wrap.append(h, row);
    return wrap;
  }

  async function copyToClipboard(text, btn) {
    const T = window.DiffNoteI18n.t;
    const label = btn.querySelector('.btn-label');
    const done = () => {
      label.textContent = T('copy.done');
      btn.classList.add('copied');
      setTimeout(() => {
        label.textContent = T('copy.label');
        btn.classList.remove('copied');
      }, 1500);
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for non-secure contexts / older browsers.
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.append(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      done();
    } catch (e) {
      label.textContent = T('copy.failed');
      setTimeout(() => (label.textContent = T('copy.label')), 1500);
    }
  }

  // Open via the File System Access picker so we keep a live handle. Must run
  // inside the user-gesture handler. Falls back to the <input> elsewhere.
  async function openWithPicker(side) {
    try {
      const [handle] = await window.showOpenFilePicker({ multiple: false });
      const file = await handle.getFile();
      await handleFile(side, file, handle);
    } catch (err) {
      if (err && err.name === 'AbortError') return; // user dismissed the dialog
      if (window.DiffNoteToast) window.DiffNoteToast.show(window.DiffNoteI18n.t('error.fileRead'), 'error');
    }
  }

  // --- Wiring ---------------------------------------------------------------
  function wireDropzone(side) {
    const zoneId = side === 'before' ? 'dropBefore' : 'dropAfter';
    const inputId = side === 'before' ? 'fileBefore' : 'fileAfter';
    const zone = document.getElementById(zoneId);
    const input = document.getElementById(inputId);

    const open = () => (supportsFsAccess ? openWithPicker(side) : input.click());
    zone.addEventListener('click', open);
    zone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    });

    input.addEventListener('change', () => {
      if (input.files && input.files[0]) handleFile(side, input.files[0]);
    });

    ['dragenter', 'dragover'].forEach((evt) =>
      zone.addEventListener(evt, (e) => {
        e.preventDefault();
        zone.classList.add('dragover');
      })
    );
    ['dragleave', 'drop'].forEach((evt) =>
      zone.addEventListener(evt, (e) => {
        e.preventDefault();
        zone.classList.remove('dragover');
      })
    );
    zone.addEventListener('drop', async (e) => {
      const dt = e.dataTransfer;
      if (!dt) return;
      // Prefer a live handle (Chromium) so Refresh reflects later edits;
      // fall back to the snapshot File when getAsFileSystemHandle is absent.
      const item = dt.items && dt.items[0];
      if (item && typeof item.getAsFileSystemHandle === 'function') {
        const handle = await item.getAsFileSystemHandle();
        if (handle && handle.kind === 'file') {
          handleFile(side, await handle.getFile(), handle);
          return;
        }
      }
      const file = dt.files && dt.files[0];
      if (file) handleFile(side, file);
    });
  }

  wireDropzone('before');
  wireDropzone('after');
  setMode('startup'); // inputs-only until both files load

  // Change navigation + "changes only" filter.
  if (els.nextDiffBtn) els.nextDiffBtn.addEventListener('click', () => gotoBlock(1));
  if (els.prevDiffBtn) els.prevDiffBtn.addEventListener('click', () => gotoBlock(-1));
  if (els.allLinesBtn) els.allLinesBtn.addEventListener('click', () => applyChangesOnly(false));
  if (els.changesOnlyBtn) els.changesOnlyBtn.addEventListener('click', () => applyChangesOnly(true));
  if (els.copyDiffBtn) els.copyDiffBtn.addEventListener('click', copyDiff);
  if (els.refreshBtn) els.refreshBtn.addEventListener('click', refresh);

  // Change-location map: track scroll, click/drag-to-jump, rebuild on resize.
  if (els.diffViewer) els.diffViewer.addEventListener('scroll', updateMinimapViewport, { passive: true });
  if (els.diffMinimap) {
    let minimapPointerId = null;
    let minimapDragStartY = 0;
    let minimapHasMoved = false;
    let suppressNextMinimapClick = false;
    let minimapDragEndX = 0;
    let minimapDragEndY = 0;
    let suppressClickTimer = null;

    els.diffMinimap.addEventListener('pointerdown', (e) => {
      if (!e.isPrimary || (e.button !== 0 && e.button !== -1)) return;
      minimapPointerId = e.pointerId;
      minimapDragStartY = e.clientY;
      minimapHasMoved = false;
      els.diffMinimap.classList.add('is-dragging');
      els.diffMinimap.setPointerCapture(e.pointerId);
    });

    els.diffMinimap.addEventListener('pointermove', (e) => {
      if (e.pointerId !== minimapPointerId) return;
      if (!minimapHasMoved && Math.abs(e.clientY - minimapDragStartY) <= 3) return;
      minimapHasMoved = true;
      e.preventDefault();
      scrollToMinimapPosition(e.clientY);
    });

    const finishMinimapPointer = (e, suppressClick) => {
      if (e.pointerId !== minimapPointerId) return;
      if (suppressClick && minimapHasMoved) {
        suppressNextMinimapClick = true;
        minimapDragEndX = e.clientX;
        minimapDragEndY = e.clientY;
        window.clearTimeout(suppressClickTimer);
        suppressClickTimer = window.setTimeout(() => {
          suppressNextMinimapClick = false;
          suppressClickTimer = null;
        }, 500);
      }
      if (els.diffMinimap.hasPointerCapture(e.pointerId)) {
        els.diffMinimap.releasePointerCapture(e.pointerId);
      }
      els.diffMinimap.classList.remove('is-dragging');
      minimapPointerId = null;
      minimapHasMoved = false;
    };

    els.diffMinimap.addEventListener('pointerup', (e) => finishMinimapPointer(e, true));
    els.diffMinimap.addEventListener('pointercancel', (e) => finishMinimapPointer(e, false));
    els.diffMinimap.addEventListener('lostpointercapture', (e) => finishMinimapPointer(e, false));

    els.diffMinimap.addEventListener('click', (e) => {
      const isSyntheticDragClick = suppressNextMinimapClick
        && Math.abs(e.clientX - minimapDragEndX) <= 6
        && Math.abs(e.clientY - minimapDragEndY) <= 6;
      if (isSyntheticDragClick) {
        suppressNextMinimapClick = false;
        window.clearTimeout(suppressClickTimer);
        suppressClickTimer = null;
        return;
      }
      suppressNextMinimapClick = false;
      window.clearTimeout(suppressClickTimer);
      suppressClickTimer = null;
      scrollToMinimapPosition(e.clientY);
    });
  }
  window.addEventListener('resize', () => { if (lastResult) buildMinimap(); });

  // --- Reset ----------------------------------------------------------------
  function reset() {
    state.before = { name: null, text: null, file: null, handle: null };
    state.after = { name: null, text: null, file: null, handle: null };

    ['dropBefore', 'dropAfter'].forEach((id) => {
      const zone = document.getElementById(id);
      zone.classList.remove('has-file', 'has-error', 'dragover');
      const hint = zone.querySelector('[data-hint]');
      const nameEl = zone.querySelector('[data-filename]');
      hint.hidden = false;
      hint.textContent = window.DiffNoteI18n.t('sidebar.dropHint');
      nameEl.hidden = true;
      nameEl.textContent = '';
    });
    document.getElementById('fileBefore').value = '';
    document.getElementById('fileAfter').value = '';

    els.statsBar.hidden = true;
    if (els.diffHeaderStats) els.diffHeaderStats.hidden = true;
    if (els.statsEmpty) els.statsEmpty.hidden = false;
    renderFileMeta();
    els.diffViewer.innerHTML = '';
    applyChangesOnly(false);
    els.aiContent.innerHTML = EMPTY_PANEL_HTML.summary;
    els.risksContent.innerHTML = EMPTY_PANEL_HTML.risks;
    els.testsContent.innerHTML = EMPTY_PANEL_HTML.tests;
    els.commitContent.innerHTML = EMPTY_PANEL_HTML.commit;
    window.DiffNoteI18n.apply(els.inspector);
    if (els.analysisLoading) els.analysisLoading.hidden = true;
    if (els.inspectorPanels) els.inspectorPanels.classList.remove('is-generating');
    refreshBlocks();
    placeDropzones(els.startupZones); // bring inputs back to the startup screen
    setMode('startup');
    lastResult = null;
    if (els.generateBtn) els.generateBtn.hidden = true;
  }

  if (els.generateBtn) els.generateBtn.addEventListener('click', generate);

  // Expose a minimal API for the UI shell (reset + settings live elsewhere).
  window.DiffNoteApp = {
    reset,
    // Settings panel / topbar switcher call this to relocalize live UI.
    onLanguageChange() {
      window.DiffNoteI18n.apply(document);
      if (window.DiffNoteUI) window.DiffNoteUI.syncLangSelect();
      if (lastResult) { showRegenButton(); renderAI(lastResult); }
    },
  };
})();
