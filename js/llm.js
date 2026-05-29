/**
 * DiffNote — real LLM adapter (Epic 2, Story 12).
 *
 * Given a unified diff, asks the active provider for structured change notes
 * and returns the same shape as the mock generator:
 *   { overview, breakdown[], commit, risks[], tests[] }
 *
 * Adapters by `cfg.api`:
 *   - 'responses'    → OpenAI Responses API (the Default gateway)
 *   - 'openai-chat'  → OpenAI / LM Studio chat completions
 *   - 'gemini'       → Google Generative Language API
 */
(function (global) {
  'use strict';

  /**
   * Build the system prompt from generation options.
   * @param {{languageName:string, commitInstruction:string, maxLen:number}} opts
   */
  function buildSystem(opts) {
    const o = opts || {};
    const lang = o.languageName || 'English';
    const commit = o.commitInstruction ||
      'Write a conventional-commit style message (e.g. "fix(scope): ...").';
    const maxLen = o.maxLen || 70;
    return [
      'You are a senior software engineer writing concise change notes for a code diff.',
      `Write ALL human-readable text fields in ${lang}.`,
      'Respond with ONLY a JSON object (no markdown fences, no prose) with these keys:',
      '"overview" (string, 1-2 sentences),',
      '"breakdown" (array of short strings),',
      `"commit" (string). For the commit message: ${commit} Keep it at most ${maxLen} characters.`,
      '"risks" (array of short strings),',
      '"tests" (array of short strings).',
    ].join(' ');
  }

  function buildUserPrompt(diffText, fileName) {
    return `File: ${fileName || 'unknown'}\n\nUnified diff:\n\n${diffText}`;
  }

  /** Strip ```json fences and parse; tolerate extra prose around the object. */
  function parseNotes(text, maxLen) {
    if (!text) throw new Error('Empty LLM response.');
    let t = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
    const start = t.indexOf('{');
    const end = t.lastIndexOf('}');
    if (start !== -1 && end !== -1) t = t.slice(start, end + 1);
    const obj = JSON.parse(t);
    const arr = (v) => Array.isArray(v) ? v.map(String) : (v ? [String(v)] : []);
    const limit = maxLen || 70;
    let commit = String(obj.commit || '');
    if (commit.length > limit) commit = commit.slice(0, limit).trimEnd();
    return {
      overview: String(obj.overview || ''),
      breakdown: arr(obj.breakdown),
      commit,
      risks: arr(obj.risks),
      tests: arr(obj.tests),
    };
  }

  // --- Adapters: each returns the assistant's raw text -----------------
  async function callResponses(cfg, system, user) {
    const res = await fetch(cfg.endpoint, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + cfg.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: cfg.model,
        input: [
          { role: 'system', content: [{ type: 'input_text', text: system }] },
          { role: 'user', content: [{ type: 'input_text', text: user }] },
        ],
        stream: false,
        reasoning: { effort: 'low' },
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    const msg = (data.output || []).find((o) => o.type === 'message');
    const part = msg && (msg.content || []).find((c) => c.type === 'output_text');
    if (!part) throw new Error('No output_text in response.');
    return part.text;
  }

  async function callOpenAIChat(cfg, system, user) {
    const headers = { 'Content-Type': 'application/json' };
    if (cfg.apiKey) headers['Authorization'] = 'Bearer ' + cfg.apiKey;
    const body = {
      model: cfg.model,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      temperature: 0.2,
    };
    // Reasoning effort (only sent when chosen; ignored by non-reasoning models).
    if (cfg.effort) body.reasoning_effort = cfg.effort;
    const res = await fetch(cfg.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    const text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!text) throw new Error('No choices[0].message.content in response.');
    return text;
  }

  // Gemini "thinking level" → thinkingBudget (tokens). '' = model default.
  const THINKING_BUDGET = { none: 0, low: 1024, medium: 8192, high: 24576 };

  async function callGemini(cfg, system, user) {
    // endpoint = .../v1beta/models ; model + generateContent appended.
    const url = `${cfg.endpoint.replace(/\/$/, '')}/${cfg.model}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`;
    const body = {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
    };
    if (cfg.thinking && THINKING_BUDGET[cfg.thinking] != null) {
      body.generationConfig = { thinkingConfig: { thinkingBudget: THINKING_BUDGET[cfg.thinking], includeThoughts: false } };
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    const cand = data.candidates && data.candidates[0];
    const text = cand && cand.content && cand.content.parts && cand.content.parts.map((p) => p.text).join('');
    if (!text) throw new Error('No candidates[0].content.parts in response.');
    return text;
  }

  function adapterFor(api) {
    if (api === 'responses') return callResponses;
    if (api === 'openai-chat') return callOpenAIChat;
    if (api === 'gemini') return callGemini;
    throw new Error('Unknown provider api: ' + api);
  }

  /**
   * Generate structured change notes from a diff using the given config.
   * @param {object} opts { languageName, commitInstruction, maxLen }
   */
  async function generateNotes(cfg, diffText, fileName, opts) {
    if (!cfg.apiKey && cfg.api !== 'openai-chat') {
      throw new Error('No API key configured for this provider.');
    }
    const system = buildSystem(opts);
    const text = await adapterFor(cfg.api)(cfg, system, buildUserPrompt(diffText, fileName));
    return parseNotes(text, opts && opts.maxLen);
  }

  /** Lightweight connectivity check; resolves to a short status string. */
  async function testConnection(cfg) {
    const text = await adapterFor(cfg.api)(cfg, 'You are a connectivity probe.', 'Reply with exactly: OK');
    return text.trim().slice(0, 40);
  }

  global.DiffNoteLLM = { generateNotes, testConnection };
})(typeof self !== 'undefined' ? self : this);
