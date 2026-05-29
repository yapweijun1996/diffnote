/**
 * DiffNote — Settings modal controller.
 *
 * Renders the LLM provider radio list + per-provider config (endpoint / model
 * / API key), and wires Save + Test connection. API keys are XOR-obfuscated
 * via DiffNoteSettings before persisting.
 */
(function (global) {
  'use strict';

  const S = global.DiffNoteSettings;
  const LLM = global.DiffNoteLLM;

  const overlay = document.getElementById('settingsOverlay');
  const openBtn = document.getElementById('settingsBtn');
  const closeBtn = document.getElementById('settingsClose');
  const providerList = document.getElementById('providerList');
  const providerConfig = document.getElementById('providerConfig');
  const saveBtn = document.getElementById('saveSettingsBtn');
  const testBtn = document.getElementById('testConnBtn');
  const connStatus = document.getElementById('connStatus');
  const langSelect = document.getElementById('langSelect');
  const commitLenRange = document.getElementById('commitLenRange');
  const commitLenNumber = document.getElementById('commitLenNumber');
  const commitPrompt = document.getElementById('commitPrompt');
  const resetPromptBtn = document.getElementById('resetPromptBtn');

  let draft = null; // working copy until Save

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function renderProviders() {
    providerList.innerHTML = '';
    S.PROVIDER_ORDER.forEach((id) => {
      const p = S.PROVIDERS[id];
      const label = document.createElement('label');
      label.className = 'provider-card' + (draft.provider === id ? ' selected' : '');
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'provider';
      radio.value = id;
      radio.checked = draft.provider === id;
      radio.addEventListener('change', () => {
        draft.provider = id;
        connStatus.textContent = '';
        renderProviders();
        renderConfig();
      });
      const span = document.createElement('span');
      span.textContent = p.label;
      label.append(radio, span);
      providerList.append(label);
    });
  }

  function field(labelText, inputEl) {
    const wrap = document.createElement('div');
    wrap.className = 'field';
    const l = document.createElement('label');
    l.textContent = labelText;
    wrap.append(l, inputEl);
    return wrap;
  }

  function renderConfig() {
    const id = draft.provider;
    const base = S.PROVIDERS[id];
    const ov = draft.providers[id] || (draft.providers[id] = {});
    providerConfig.innerHTML = '';

    // Endpoint
    const endpoint = document.createElement('input');
    endpoint.type = 'text';
    endpoint.value = ov.endpoint || base.endpoint;
    endpoint.disabled = !base.endpointEditable;
    endpoint.addEventListener('input', () => { ov.endpoint = endpoint.value; });
    providerConfig.append(field('Endpoint', endpoint));

    // Model
    const model = document.createElement('input');
    model.type = 'text';
    model.value = ov.model || base.model;
    model.addEventListener('input', () => { ov.model = model.value; });
    providerConfig.append(field('Model', model));

    // API key
    if (base.keyEditable) {
      const key = document.createElement('input');
      key.type = 'password';
      key.autocomplete = 'off';
      key.placeholder = ov.keyCipher ? '•••••••• (saved — type to replace)' : 'Paste API key';
      key.addEventListener('input', () => {
        // Store plaintext transiently on the draft; encrypted only at Save.
        ov._plainKey = key.value;
      });
      providerConfig.append(field('API key', key));
    } else {
      const note = document.createElement('p');
      note.className = 'muted field-note';
      note.textContent = 'Uses the built-in gateway key (XOR-obfuscated in source).';
      providerConfig.append(note);
    }
  }

  // --- Global generation settings (language / commit length / prompt) ---
  function renderGlobal() {
    // Language options
    langSelect.innerHTML = '';
    S.LANGUAGES.forEach((l) => {
      const opt = document.createElement('option');
      opt.value = l.id;
      opt.textContent = l.label + (l.id === 'en' ? ' (Default)' : '');
      langSelect.append(opt);
    });
    langSelect.value = draft.language || 'en';

    const len = S.clampLen(draft.commitMaxLen);
    commitLenRange.value = len;
    commitLenNumber.value = len;
    commitPrompt.value = draft.commitPrompt || S.DEFAULT_COMMIT_PROMPT;
  }

  function setLen(v) {
    const n = S.clampLen(v);
    commitLenRange.value = n;
    commitLenNumber.value = n;
    draft.commitMaxLen = n;
  }

  function open() {
    draft = clone(S.load());
    if (!draft.providers) draft.providers = {};
    connStatus.textContent = '';
    renderProviders();
    renderConfig();
    renderGlobal();
    overlay.hidden = false;
  }
  function close() { overlay.hidden = true; }

  function commitDraftKeys() {
    // Encrypt any transient plaintext keys into ciphers before persisting.
    Object.keys(draft.providers).forEach((id) => {
      const ov = draft.providers[id];
      if (ov._plainKey != null && ov._plainKey !== '') {
        ov.keyCipher = S.encryptKey(ov._plainKey);
      }
      delete ov._plainKey;
    });
  }

  function save() {
    commitDraftKeys();
    // Pull the latest global-setting values off the form into the draft.
    draft.language = langSelect.value;
    draft.commitMaxLen = S.clampLen(commitLenNumber.value);
    draft.commitPrompt = commitPrompt.value.trim() || S.DEFAULT_COMMIT_PROMPT;
    const ok = S.save(draft);
    // Relocalize the live UI to the saved language.
    if (ok && global.DiffNoteApp && global.DiffNoteApp.onLanguageChange) {
      global.DiffNoteApp.onLanguageChange();
    } else if (global.DiffNoteI18n) {
      global.DiffNoteI18n.apply(document);
    }
    const T = global.DiffNoteI18n.t;
    if (ok) {
      close();                                   // auto-close on save
      if (global.DiffNoteToast) global.DiffNoteToast.show(T('status.saved'), 'success');
    } else {
      connStatus.textContent = T('status.saveFailed');
    }
  }

  // Build a live config from the current (unsaved) draft for Test connection.
  function draftConfig() {
    const id = draft.provider;
    const base = S.PROVIDERS[id];
    const ov = draft.providers[id] || {};
    const endpoint = (base.endpointEditable && ov.endpoint) ? ov.endpoint : base.endpoint;
    const model = ov.model || base.model;
    let apiKey;
    if (base.bakedKeyCipher) apiKey = S.decryptKey(base.bakedKeyCipher);
    else if (ov._plainKey) apiKey = ov._plainKey;
    else apiKey = S.decryptKey(ov.keyCipher || '');
    return { id: base.id, label: base.label, api: base.api, endpoint, model, apiKey };
  }

  async function test() {
    const T = global.DiffNoteI18n.t;
    connStatus.textContent = T('status.testing');
    testBtn.disabled = true;
    try {
      const reply = await LLM.testConnection(draftConfig());
      connStatus.textContent = T('status.connected', { reply });
    } catch (e) {
      connStatus.textContent = T('status.failed', { msg: e.message });
    } finally {
      testBtn.disabled = false;
    }
  }

  openBtn.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !overlay.hidden) close(); });
  saveBtn.addEventListener('click', save);
  testBtn.addEventListener('click', test);

  // Range ↔ number two-way sync for commit length.
  commitLenRange.addEventListener('input', () => setLen(commitLenRange.value));
  commitLenNumber.addEventListener('input', () => { draft.commitMaxLen = commitLenNumber.value; commitLenRange.value = S.clampLen(commitLenNumber.value); });
  commitLenNumber.addEventListener('change', () => setLen(commitLenNumber.value));
  langSelect.addEventListener('change', () => { draft.language = langSelect.value; });
  commitPrompt.addEventListener('input', () => { draft.commitPrompt = commitPrompt.value; });
  resetPromptBtn.addEventListener('click', () => {
    draft.commitPrompt = S.DEFAULT_COMMIT_PROMPT;
    commitPrompt.value = S.DEFAULT_COMMIT_PROMPT;
  });
})(typeof self !== 'undefined' ? self : this);
