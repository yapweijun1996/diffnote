/**
 * DiffNote — real LLM adapter (Epic 2, Story 12).
 *
 * Given a unified diff, asks the active provider for structured change notes
 * and returns the same shape as the mock generator:
 *   { overview, breakdown[], commit, risks[], tests[] }
 *
 * Adapters by `cfg.api`:
 *   - 'demo-responses' → Demo sessions + streamed Responses (Default gateway)
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
    const commitLang = o.commitLanguageName || lang;
    const commit = o.commitInstruction ||
      'Write a conventional-commit style message (e.g. "fix(scope): ...").';
    const maxLen = o.maxLen || 70;
    return [
      'You are a senior software engineer writing concise change notes for a code diff.',
      `Write ALL human-readable text fields in ${lang}.`,
      'Lines beginning with a space are unchanged context — base your notes ONLY on lines beginning with "+" or "-".',
      'Respond with ONLY a JSON object (no markdown fences, no prose) with these keys:',
      '"overview" (string, 1-2 sentences),',
      '"breakdown" (array of short strings),',
      `"commit" (string, written in ${commitLang} — this may differ from the other fields). For the commit message: ${commit} Keep it at most ${maxLen} characters.`,
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
  // Session credentials stay in memory and are never written to settings/cache.
  let demoSession = null;
  let demoSessionPending = null;

  async function demoError(res, stage) {
    let code = '';
    try {
      const data = await res.json();
      const value = data.error && data.error.code || data.code;
      if (typeof value === 'string' && /^[A-Z0-9_]+$/.test(value)) code = value;
    } catch (_) { /* Do not expose upstream bodies or HTML error pages. */ }
    return new Error(`${stage}: HTTP ${res.status}${code ? ' (' + code + ')' : ''}`);
  }

  async function getDemoSession(cfg) {
    const origin = new URL(cfg.endpoint).origin;
    const key = `${origin}/${cfg.projectId}`;
    if (demoSession && demoSession.key === key && Date.now() < demoSession.expiresAt) {
      return demoSession;
    }
    if (demoSessionPending && demoSessionPending.key === key) return demoSessionPending.promise;
    const promise = (async () => {
      const res = await fetch(`${origin}/demo/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: cfg.projectId }),
      });
      if (!res.ok) throw await demoError(res, 'Demo session');
      const data = await res.json();
      if (typeof data.token !== 'string' || !data.token.startsWith('dmo_')) {
        throw new Error('Demo session returned an invalid token.');
      }
      // The gateway contract gives sessions 15 minutes; refresh one minute early.
      demoSession = { key, token: data.token, expiresAt: Date.now() + 14 * 60 * 1000 };
      return demoSession;
    })();
    const pending = { key, promise };
    demoSessionPending = pending;
    try { return await promise; }
    finally { if (demoSessionPending === pending) demoSessionPending = null; }
  }

  function responseText(response) {
    return (response.output || []).filter((item) => item.type === 'message')
      .flatMap((item) => item.content || [])
      .filter((part) => part.type === 'output_text').map((part) => part.text).join('');
  }

  async function readDemoStream(res) {
    if (!res.body || !(res.headers.get('content-type') || '').includes('text/event-stream')) {
      throw new Error('Demo gateway did not return an SSE stream.');
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let text = '';
    let completed = false;
    function frame(raw) {
      const data = raw.split(/\r?\n/).filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart()).join('\n');
      if (!data) return;
      if (data === '[DONE]') {
        if (!completed) throw new Error('Demo stream ended before response.completed.');
        return;
      }
      const event = JSON.parse(data);
      if (event.type === 'error' || event.type === 'response.failed' || event.type === 'response.incomplete') {
        throw new Error('Demo response failed or was incomplete.');
      }
      if (event.type === 'response.output_text.delta') text += event.delta || '';
      if (event.type === 'response.output_text.done' && !text) text = event.text || '';
      if (event.type === 'response.completed') {
        if (!event.response || event.response.status !== 'completed') {
          throw new Error('Demo response was not completed.');
        }
        text = responseText(event.response) || text;
        completed = true;
      }
    }
    try {
      while (!completed) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        let separator;
        while ((separator = /\r?\n\r?\n/.exec(buffer))) {
          const raw = buffer.slice(0, separator.index);
          buffer = buffer.slice(separator.index + separator[0].length);
          frame(raw);
          if (completed) break;
        }
        if (done) {
          if (!completed && buffer.trim()) frame(buffer);
          break;
        }
      }
      if (!completed) throw new Error('Demo stream disconnected before completion.');
      if (!text) throw new Error('No output_text in Demo response.');
      return text;
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  }

  async function callDemoResponses(cfg, system, user) {
    if (!cfg.projectId) throw new Error('No Demo project configured.');
    let session = await getDemoSession(cfg);
    const request = () => fetch(cfg.endpoint, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + session.token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: cfg.model,
        input: [
          { role: 'system', content: [{ type: 'input_text', text: system }] },
          { role: 'user', content: [{ type: 'input_text', text: user }] },
        ],
        stream: true,
        reasoning: { effort: cfg.effort || 'low' },
      }),
    });
    let res = await request();
    // Retry only an auth rejection, before any output. Never replay a started stream.
    if (res.status === 401) {
      if (res.body) await res.body.cancel();
      if (demoSession === session) demoSession = null;
      session = await getDemoSession(cfg);
      res = await request();
    }
    if (!res.ok) throw await demoError(res, 'Demo response');
    return readDemoStream(res);
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
    if (api === 'demo-responses') return callDemoResponses;
    if (api === 'openai-chat') return callOpenAIChat;
    if (api === 'gemini') return callGemini;
    throw new Error('Unknown provider api: ' + api);
  }

  /**
   * Generate structured change notes from a diff using the given config.
   * @param {object} opts { languageName, commitInstruction, maxLen }
   */
  async function generateNotes(cfg, diffText, fileName, opts) {
    if (!cfg.apiKey && cfg.api !== 'openai-chat' && cfg.api !== 'demo-responses') {
      throw new Error('No API key configured for this provider.');
    }
    const system = buildSystem(opts);
    const text = await adapterFor(cfg.api)(cfg, system, buildUserPrompt(diffText, fileName));
    return parseNotes(text, opts && opts.maxLen);
  }

  /** Lightweight connectivity check; resolves to a short status string. */
  async function testConnection(cfg) {
    const demo = cfg.api === 'demo-responses';
    const text = await adapterFor(cfg.api)(cfg,
      demo ? 'You are a connectivity probe. Respond with a JSON object.' : 'You are a connectivity probe.',
      demo ? 'Reply with exactly this JSON object: {\"status\":\"OK\"}' : 'Reply with exactly: OK');
    return text.trim().slice(0, 40);
  }

  global.DiffNoteLLM = { generateNotes, testConnection };
})(typeof self !== 'undefined' ? self : this);
