/**
 * DiffNote — settings + LLM provider config (Epic 2, Story 11/13).
 *
 * API keys are stored XOR-obfuscated (via the user's XORNumberCipher, key
 * below) and decrypted ONLY at call time. Persisted in localStorage.
 *
 * ⚠️ SECURITY: XOR with a hardcoded key is OBFUSCATION, not encryption. The
 * decrypt key lives in this same file, so anyone with devtools can recover
 * any baked-in key. The Default gateway key is therefore effectively public
 * once deployed — treat it as a throwaway / rate-limited key and rotate it.
 * (The upstream XOR tool itself says: do not use for tokens in production.)
 */
(function (global) {
  'use strict';

  const XOR_KEY = '20260515';
  const STORAGE_KEY = 'diffnote-settings';
  const X = global.XORNumberCipher;

  const COMMIT_LEN_MIN = 20;
  const COMMIT_LEN_MAX = 500;
  const COMMIT_LEN_DEFAULT = 70;

  // User-editable instruction used to generate the commit message. {maxLen}
  // and {lang} are substituted at call time.
  const DEFAULT_COMMIT_PROMPT =
    'Write one commit message in {lang}, conventional-commit style ' +
    '(e.g. "fix(scope): ...", "feat: ...", "refactor: ..."). ' +
    'Imperative mood, no trailing period, at most {maxLen} characters.';

  // i18n: output language for generated change notes / commit message.
  const LANGUAGES = [
    { id: 'en', label: 'English', name: 'English' },
    { id: 'zh', label: 'Mandarin', name: 'Mandarin Chinese (简体中文)' },
    { id: 'vi', label: 'Vietnamese', name: 'Vietnamese (Tiếng Việt)' },
    { id: 'ms', label: 'Malay', name: 'Malay (Bahasa Melayu)' },
    { id: 'ja', label: 'Japanese', name: 'Japanese (日本語)' },
  ];
  const LANGUAGE_DEFAULT = 'en';

  function clampLen(n) {
    n = parseInt(n, 10);
    if (!Number.isFinite(n)) return COMMIT_LEN_DEFAULT;
    return Math.min(COMMIT_LEN_MAX, Math.max(COMMIT_LEN_MIN, n));
  }

  // gw_… key, XOR-obfuscated with XOR_KEY. Plaintext never appears in source.
  const DEFAULT_GW_KEY_CIPHER =
    '085071109003002001087084003002084015001086006001081000083087002004085002001086080087081002083012005081000001081002085087001082007087006087002006005000010';

  /**
   * Provider registry. `api` selects the request/response adapter in llm.js.
   * `bakedKeyCipher` is only set for the Default gateway.
   */
  const PROVIDERS = {
    default: {
      id: 'default',
      label: 'Default (my GPT gateway)',
      api: 'responses',
      endpoint: 'https://gpt.yapweijun1996.com/v1/responses',
      model: 'gpt-5.4-mini',
      bakedKeyCipher: DEFAULT_GW_KEY_CIPHER,
      keyEditable: false,
      endpointEditable: false,
      // Responses API reasoning.effort — always sent (defaults to low).
      supportsEffort: true,
      effortOptions: ['low', 'medium', 'high'],
      effortDefault: 'low',
    },
    gemini: {
      id: 'gemini',
      label: 'Gemini',
      api: 'gemini',
      endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
      model: 'gemini-2.5-flash',
      keyEditable: true,
      endpointEditable: true,
      // Thinking level → thinkingConfig.thinkingBudget (see llm.js).
      supportsThinking: true,
      thinkingOptions: ['', 'none', 'low', 'medium', 'high'],
      thinkingDefault: '',
    },
    openai: {
      id: 'openai',
      label: 'OpenAI',
      api: 'openai-chat',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      model: 'gpt-4o-mini',
      keyEditable: true,
      endpointEditable: true,
      // Reasoning effort → reasoning_effort (reasoning models only).
      supportsEffort: true,
      effortOptions: ['', 'low', 'medium', 'high'],
      effortDefault: '',
    },
    lmstudio: {
      id: 'lmstudio',
      label: 'LM Studio (local)',
      api: 'openai-chat',
      endpoint: 'http://localhost:1234/v1/chat/completions',
      model: 'local-model',
      keyEditable: true,
      endpointEditable: true,
    },
  };

  const PROVIDER_ORDER = ['default', 'gemini', 'openai', 'lmstudio'];

  function defaults() {
    return {
      provider: 'default',
      // Per-provider user overrides: { [id]: { endpoint, model, keyCipher } }
      providers: {},
      // Generation settings
      language: LANGUAGE_DEFAULT,
      commitMaxLen: COMMIT_LEN_DEFAULT,
      commitPrompt: DEFAULT_COMMIT_PROMPT,
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaults();
      const parsed = JSON.parse(raw);
      return Object.assign(defaults(), parsed, { providers: parsed.providers || {} });
    } catch (e) {
      return defaults();
    }
  }

  function save(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      return false;
    }
  }

  // --- XOR helpers (obfuscation only) ----------------------------------
  function encryptKey(plain) {
    if (!plain) return '';
    return X.encryptToNumbers(plain, XOR_KEY);
  }
  function decryptKey(cipher) {
    if (!cipher) return '';
    try { return X.decryptFromNumbers(cipher, XOR_KEY); } catch (e) { return ''; }
  }

  /**
   * Resolve the effective config for a provider: base registry values merged
   * with any user overrides. The plaintext key is decrypted here (call time).
   */
  function resolve(providerId) {
    const base = PROVIDERS[providerId];
    if (!base) throw new Error('Unknown provider: ' + providerId);
    const state = load();
    const override = state.providers[providerId] || {};

    const endpoint = (base.endpointEditable && override.endpoint) ? override.endpoint : base.endpoint;
    const model = override.model || base.model;

    // Key: baked (Default) takes precedence; otherwise user-entered cipher.
    const keyCipher = base.bakedKeyCipher || override.keyCipher || '';
    const apiKey = decryptKey(keyCipher);

    const cfg = { id: base.id, label: base.label, api: base.api, endpoint, model, apiKey };
    if (base.supportsEffort) cfg.effort = override.effort || base.effortDefault || '';
    if (base.supportsThinking) cfg.thinking = override.thinking || base.thinkingDefault || '';
    return cfg;
  }

  function getActive() {
    return resolve(load().provider);
  }

  // --- Generation settings ---------------------------------------------
  function getCommitMaxLen() { return clampLen(load().commitMaxLen); }
  function getCommitPrompt() {
    const p = load().commitPrompt;
    return (p && p.trim()) ? p : DEFAULT_COMMIT_PROMPT;
  }
  function getLanguage() {
    const id = load().language;
    return LANGUAGES.some((l) => l.id === id) ? id : LANGUAGE_DEFAULT;
  }
  function getLanguageName(id) {
    const lang = LANGUAGES.find((l) => l.id === (id || getLanguage()));
    return (lang || LANGUAGES[0]).name;
  }

  /** Resolve the commit instruction with {lang}/{maxLen} substituted. */
  function resolveCommitPrompt() {
    return getCommitPrompt()
      .replace(/\{lang\}/g, getLanguageName())
      .replace(/\{maxLen\}/g, String(getCommitMaxLen()));
  }

  global.DiffNoteSettings = {
    PROVIDERS,
    PROVIDER_ORDER,
    LANGUAGES,
    DEFAULT_COMMIT_PROMPT,
    COMMIT_LEN_MIN,
    COMMIT_LEN_MAX,
    COMMIT_LEN_DEFAULT,
    clampLen,
    load,
    save,
    encryptKey,
    decryptKey,
    resolve,
    getActive,
    getCommitMaxLen,
    getCommitPrompt,
    getLanguage,
    getLanguageName,
    resolveCommitPrompt,
  };
})(typeof self !== 'undefined' ? self : this);
