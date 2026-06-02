/**
 * DiffNote — main application controller.
 *
 * Wires file inputs (drag/drop + click), runs the diff engine, renders the
 * visual diff, fills the mock AI panel, and handles the commit-message copy
 * action. All reading happens in-browser via FileReader; nothing is uploaded.
 */
(function () {
  'use strict';

  const MAX_BYTES = 2 * 1024 * 1024; // 2MB guard for the local-first MVP.

  const state = {
    before: { name: null, text: null },
    after: { name: null, text: null },
  };

  // --- DOM refs -------------------------------------------------------------
  const els = {
    appRoot: document.querySelector('.app'),
    startupZones: document.getElementById('startupZones'),
    inspectorDropHost: document.getElementById('dropzones'),
    statsBar: document.getElementById('statsBar'),
    statsEmpty: document.getElementById('statsEmpty'),
    statAdded: document.getElementById('statAdded'),
    statDeleted: document.getElementById('statDeleted'),
    statBlocks: document.getElementById('statBlocks'),
    diffViewer: document.getElementById('diffViewer'),
    diffMinimap: document.getElementById('diffMinimap'),
    minimapViewport: document.getElementById('minimapViewport'),
    changesOnlyToggle: document.getElementById('changesOnlyToggle'),
    copyDiffBtn: document.getElementById('copyDiffBtn'),
    prevDiffBtn: document.getElementById('prevDiffBtn'),
    nextDiffBtn: document.getElementById('nextDiffBtn'),
    aiContent: document.getElementById('aiContent'),
    generateBtn: document.getElementById('generateBtn'),
    notesBadge: document.getElementById('notesBadge'),
  };

  // Cache the original AI-placeholder markup so reset can restore it.
  const EMPTY_AI_HTML = els.aiContent.innerHTML;

  // --- Startup gate ---------------------------------------------------------
  // The file inputs are only useful before a diff exists. At startup they sit
  // centered (#startupZones); once both files load they collapse into the
  // sidebar (#dropzones). Moving the SAME nodes preserves their listeners.
  function placeDropzones(host) {
    host.append(document.getElementById('dropBefore'), document.getElementById('dropAfter'));
  }
  function setMode(mode) { els.appRoot.dataset.mode = mode; }

  let lastResult = null; // latest diff result, for on-demand AI generation

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

  async function handleFile(side, file) {
    const zone = document.getElementById(side === 'before' ? 'dropBefore' : 'dropAfter');
    const hint = zone.querySelector('[data-hint]');
    const nameEl = zone.querySelector('[data-filename]');
    try {
      const text = await readFile(file);
      state[side] = { name: file.name, text };
      nameEl.textContent = file.name;
      nameEl.hidden = false;
      hint.hidden = true;
      zone.classList.remove('has-error');
      zone.classList.add('has-file');
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
    renderAI(result); // instant mock baseline
    setBadge('mock');
    placeDropzones(els.inspectorDropHost); // collapse inputs into the inspector
    setMode('diff');
    buildMinimap(); // after the diff area is visible so rows have height
    showRegenButton();
    generate(); // auto-upgrade the mock baseline to real AI notes
  }

  // Serialize diff rows into a unified-diff-style text for the LLM prompt.
  function buildUnifiedDiff(rows) {
    return rows.map((r) => {
      const sign = r.type === 'added' ? '+' : r.type === 'deleted' ? '-' : ' ';
      return sign + r.text;
    }).join('\n');
  }

  function renderStats(stats) {
    els.statAdded.textContent = stats.added;
    els.statDeleted.textContent = stats.deleted;
    els.statBlocks.textContent = stats.blocks;
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

  // --- Change navigation + "changes only" filter ---------------------------
  let blockEls = [];
  let currentBlock = -1;

  function refreshBlocks() {
    blockEls = Array.from(els.diffViewer.querySelectorAll('.diff-block-start'));
    currentBlock = -1;
  }

  function gotoBlock(step) {
    if (!blockEls.length) return;
    currentBlock = (currentBlock + step + blockEls.length) % blockEls.length;
    const el = blockEls[currentBlock];
    blockEls.forEach((b) => b.classList.remove('diff-block-active'));
    el.classList.add('diff-block-active');
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function applyChangesOnly() {
    const on = els.changesOnlyToggle && els.changesOnlyToggle.checked;
    els.diffViewer.classList.toggle('changes-only', !!on);
    buildMinimap(); // row heights changed → redraw the map
  }

  // Copy the whole diff (with filenames) so it can be pasted into another AI.
  async function copyDiff() {
    if (!lastResult) return;
    const before = state.before.name || 'before';
    const after = state.after.name || 'after';
    const text = `--- ${before}\n+++ ${after}\n\n` + buildUnifiedDiff(lastResult.rows);
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

  function renderAI(result) {
    const maxLen = DiffNoteSettings.getCommitMaxLen();
    renderNotes(DiffNoteAI.generate(result, state.after.name || state.before.name, maxLen));
  }

  // Render a structured notes object (shared by mock + real LLM).
  function renderNotes(ai) {
    const T = window.DiffNoteI18n.t;
    els.aiContent.innerHTML = '';
    els.aiContent.append(
      section(T('notes.overview'), textBlock(ai.overview)),
      section(T('notes.breakdown'), list(ai.breakdown)),
      commitSection(ai.commit),
      section(T('notes.risks'), list(ai.risks)),
      section(T('notes.tests'), list(ai.tests))
    );
  }

  // --- Badge + on-demand AI generation -------------------------------------
  function setBadge(text) {
    if (els.notesBadge) els.notesBadge.textContent = text;
  }

  function generateLabelEl() {
    return els.generateBtn.querySelector('.btn-label');
  }

  // On-demand re-run of the LLM (notes also auto-generate after each diff).
  function showRegenButton() {
    if (!els.generateBtn) return;
    generateLabelEl().textContent = window.DiffNoteI18n.t('generate.regen');
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
    setBadge(active.id + ' …');
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
      setBadge(active.id);
    } catch (err) {
      // Fall back to mock + surface the error; never leave a broken panel.
      renderAI(lastResult);
      setBadge('mock (AI failed)');
      const warn = document.createElement('p');
      warn.className = 'ai-error';
      warn.textContent = window.DiffNoteI18n.t('error.aiFailed', { msg: err.message });
      els.aiContent.prepend(warn);
    } finally {
      els.aiContent.classList.remove('is-generating');
      els.generateBtn.disabled = false;
      labelEl.textContent = prevLabel;
    }
  }

  // Dim the current (mock) notes and show a spinner while the LLM runs.
  // renderNotes()/renderAI() rebuild #aiContent, clearing the banner.
  function showLoading() {
    if (!els.aiContent) return;
    els.aiContent.classList.add('is-generating');
    const banner = document.createElement('div');
    banner.className = 'ai-loading';
    banner.setAttribute('role', 'status');
    const sp = document.createElement('span');
    sp.className = 'spinner';
    const tx = document.createElement('span');
    tx.textContent = window.DiffNoteI18n.t('notes.generating');
    banner.append(sp, tx);
    els.aiContent.prepend(banner);
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

  // --- Wiring ---------------------------------------------------------------
  function wireDropzone(side) {
    const zoneId = side === 'before' ? 'dropBefore' : 'dropAfter';
    const inputId = side === 'before' ? 'fileBefore' : 'fileAfter';
    const zone = document.getElementById(zoneId);
    const input = document.getElementById(inputId);

    zone.addEventListener('click', () => input.click());
    zone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        input.click();
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
    zone.addEventListener('drop', (e) => {
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) handleFile(side, file);
    });
  }

  wireDropzone('before');
  wireDropzone('after');
  setMode('startup'); // inputs-only until both files load

  // Change navigation + "changes only" filter.
  if (els.nextDiffBtn) els.nextDiffBtn.addEventListener('click', () => gotoBlock(1));
  if (els.prevDiffBtn) els.prevDiffBtn.addEventListener('click', () => gotoBlock(-1));
  if (els.changesOnlyToggle) els.changesOnlyToggle.addEventListener('change', applyChangesOnly);
  if (els.copyDiffBtn) els.copyDiffBtn.addEventListener('click', copyDiff);

  // Change-location map: track scroll, click-to-jump, rebuild on resize.
  if (els.diffViewer) els.diffViewer.addEventListener('scroll', updateMinimapViewport, { passive: true });
  if (els.diffMinimap) els.diffMinimap.addEventListener('click', (e) => {
    const rect = els.diffMinimap.getBoundingClientRect();
    const frac = (e.clientY - rect.top) / rect.height;
    els.diffViewer.scrollTop = frac * els.diffViewer.scrollHeight - els.diffViewer.clientHeight / 2;
  });
  window.addEventListener('resize', () => { if (lastResult) buildMinimap(); });

  // --- Reset ----------------------------------------------------------------
  function reset() {
    state.before = { name: null, text: null };
    state.after = { name: null, text: null };

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
    if (els.statsEmpty) els.statsEmpty.hidden = false;
    els.diffViewer.innerHTML = '';
    els.aiContent.innerHTML = EMPTY_AI_HTML;
    // Restored markup may carry stale-language text — re-translate it.
    window.DiffNoteI18n.apply(els.aiContent);
    placeDropzones(els.startupZones); // bring inputs back to the startup screen
    setMode('startup');
    lastResult = null;
    if (els.generateBtn) els.generateBtn.hidden = true;
    setBadge('mock');
  }

  if (els.generateBtn) els.generateBtn.addEventListener('click', generate);

  // Expose a minimal API for the UI shell (reset + settings live elsewhere).
  window.DiffNoteApp = {
    reset,
    // Settings panel / topbar switcher call this to relocalize live UI.
    onLanguageChange() {
      window.DiffNoteI18n.apply(document);
      if (window.DiffNoteUI) window.DiffNoteUI.syncLangSelect();
      if (lastResult) { showRegenButton(); renderAI(lastResult); setBadge('mock'); }
    },
  };
})();
