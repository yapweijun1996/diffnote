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
    statsBar: document.getElementById('statsBar'),
    statsEmpty: document.getElementById('statsEmpty'),
    statAdded: document.getElementById('statAdded'),
    statDeleted: document.getElementById('statDeleted'),
    statBlocks: document.getElementById('statBlocks'),
    diffViewer: document.getElementById('diffViewer'),
    emptyState: document.getElementById('emptyState'),
    aiContent: document.getElementById('aiContent'),
    generateBtn: document.getElementById('generateBtn'),
    notesBadge: document.getElementById('notesBadge'),
  };

  // Cache the original empty-state + AI-placeholder markup so reset can restore it.
  const EMPTY_DIFF_HTML = els.diffViewer.innerHTML;
  const EMPTY_AI_HTML = els.aiContent.innerHTML;

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
    showGenerateButton();
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
    if (els.emptyState) els.emptyState.remove();

    const frag = document.createDocumentFragment();
    const table = document.createElement('table');
    table.className = 'diff-table';

    for (const row of rows) {
      const tr = document.createElement('tr');
      tr.className = 'diff-row diff-' + row.type;

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

  function showGenerateButton() {
    if (!els.generateBtn) return;
    const active = DiffNoteSettings.getActive();
    const provider = active.label.replace(/ \(.*\)$/, '');
    generateLabelEl().textContent = window.DiffNoteI18n.t('generate.btn', { provider });
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

    try {
      const opts = {
        languageName: DiffNoteSettings.getLanguageName(),
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
      els.generateBtn.disabled = false;
      labelEl.textContent = prevLabel;
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
    els.diffViewer.innerHTML = EMPTY_DIFF_HTML;
    els.aiContent.innerHTML = EMPTY_AI_HTML;
    // Restored markup may carry stale-language text — re-translate it.
    window.DiffNoteI18n.apply(els.diffViewer);
    window.DiffNoteI18n.apply(els.aiContent);
    lastResult = null;
    if (els.generateBtn) els.generateBtn.hidden = true;
    setBadge('mock');
  }

  if (els.generateBtn) els.generateBtn.addEventListener('click', generate);

  // Expose a minimal API for the UI shell (reset + settings live elsewhere).
  window.DiffNoteApp = {
    reset,
    // Settings panel calls this after a provider change so the button relabels.
    onProviderChange() { if (lastResult) showGenerateButton(); },
    // Settings panel / topbar switcher call this to relocalize live UI.
    onLanguageChange() {
      window.DiffNoteI18n.apply(document);
      if (window.DiffNoteUI) window.DiffNoteUI.syncLangSelect();
      if (lastResult) { showGenerateButton(); renderAI(lastResult); setBadge('mock'); }
    },
  };
})();
