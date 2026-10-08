const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const cfg = { api: 'demo-responses', endpoint: 'https://gateway.example/demo/v1/responses', model: 'demo-auto', projectId: 'github-pages', effort: 'medium' };
const notes = { overview: '修改成功', breakdown: ['change'], commit: 'fix: test', risks: [], tests: [] };
const text = JSON.stringify(notes);
const sse = (events, delimiter = '\n') => events.map(e => `data: ${typeof e === 'string' ? e : JSON.stringify(e)}${delimiter}${delimiter}`).join('');
const completed = (answer = text) => ({ type: 'response.completed', response: { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: answer }] }] } });
function stream(events, width = 7, delimiter = '\n') {
  const bytes = new TextEncoder().encode(sse(events, delimiter));
  return new Response(new ReadableStream({ start(controller) {
    for (let i = 0; i < bytes.length; i += width) controller.enqueue(bytes.slice(i, i + width));
    controller.close();
  } }), { headers: { 'Content-Type': 'text/event-stream' } });
}
function setup(responder) {
  const calls = [];
  const context = { Response, TextDecoder, URL, Date, console,
    fetch: async (url, options) => {
      const call = { url, ...options, body: JSON.parse(options.body) };
      calls.push(call);
      return responder(call, calls);
    } };
  context.self = context;
  vm.runInNewContext(fs.readFileSync('js/llm.js', 'utf8'), context);
  return { llm: context.DiffNoteLLM, calls, context };
}
const session = () => Response.json({ token: 'dmo_test_only' });

test('Demo uses session auth, explicit effort, JSON and SSE with split Unicode/CRLF', async () => {
  const { llm, calls } = setup(call => call.url.endsWith('/session') ? session() : stream([
    { type: 'response.created' }, { type: 'response.output_text.delta', delta: text }, completed(), '[DONE]'
  ], 1, '\r\n'));
  const result = await llm.generateNotes(cfg, '+new', 'test.js');
  assert.equal(result.overview, notes.overview);
  assert.equal(calls[0].headers.Authorization, undefined);
  assert.deepEqual(calls[0].body, { project_id: 'github-pages' });
  assert.equal(calls[1].headers.Authorization, 'Bearer dmo_test_only');
  assert.equal(calls[1].body.stream, true);
  assert.equal(calls[1].body.reasoning.effort, 'medium');
  assert.equal(calls[1].body.text, undefined);
  assert.equal(calls[1].headers.Origin, undefined);
  await llm.testConnection(cfg);
  assert.equal(calls.filter(c => c.url.endsWith('/session')).length, 1);
});

test('Concurrent callers share the pending session', async () => {
  const { llm, calls } = setup(async call => {
    if (call.url.endsWith('/session')) { await new Promise(r => setTimeout(r, 10)); return session(); }
    return stream([completed()]);
  });
  await Promise.all([llm.generateNotes(cfg, '', ''), llm.generateNotes(cfg, '', '')]);
  assert.equal(calls.filter(c => c.url.endsWith('/session')).length, 1);
});

test('Refreshes expired sessions and isolates projects', async () => {
  const { llm, calls, context } = setup(call => call.url.endsWith('/session') ? session() : stream([completed()]));
  let now = 1000;
  context.Date = { now: () => now };
  await llm.testConnection(cfg);
  now += 14 * 60 * 1000;
  await llm.testConnection(cfg);
  await llm.testConnection({ ...cfg, projectId: 'another-project' });
  assert.equal(calls.filter(c => c.url.endsWith('/session')).length, 3);
  assert.equal(calls[4].body.project_id, 'another-project');
});

test('Invalid session credentials never reach inference', async () => {
  for (const token of [null, 'private_test_only', 42]) {
    const { llm, calls } = setup(() => Response.json({ token }));
    await assert.rejects(llm.testConnection(cfg), /invalid token/);
    assert.equal(calls.length, 1);
  }
});

test('Auth rejection refreshes once; a second rejection fails', async () => {
  const { llm, calls } = setup(call => call.url.endsWith('/session') ? session() : Response.json({}, { status: 401 }));
  await assert.rejects(llm.testConnection(cfg), /HTTP 401/);
  assert.equal(calls.length, 4);
});

test('Auth rejection can recover without using a private key', async () => {
  let attempts = 0;
  const { llm } = setup(call => call.url.endsWith('/session') ? session() : ++attempts === 1 ? Response.json({}, { status: 401 }) : stream([completed()]));
  assert.equal((await llm.generateNotes(cfg, '', '')).commit, notes.commit);
});

for (const [label, events] of [
  ['disconnect', [{ type: 'response.output_text.delta', delta: text }]],
  ['early DONE', ['[DONE]']],
  ['failed response', [{ type: 'response.failed' }]],
  ['incomplete response', [{ type: 'response.incomplete' }]],
  ['invalid final status', [{ type: 'response.completed', response: { status: 'incomplete' } }]],
  ['error event', [{ type: 'error', message: 'redacted' }]],
]) test(`Rejects ${label} and never replays a started stream`, async () => {
  const { llm, calls } = setup(call => call.url.endsWith('/session') ? session() : stream(events));
  await assert.rejects(llm.generateNotes(cfg, '', ''));
  assert.equal(calls.length, 2);
});

test('Quota errors are surfaced without retry or raw upstream text', async () => {
  const { llm, calls } = setup(call => call.url.endsWith('/session') ? session() : Response.json({ error: { code: 'DEMO_SESSION_REQUEST_LIMIT', message: 'private upstream detail' } }, { status: 429 }));
  await assert.rejects(llm.testConnection(cfg), e => /DEMO_SESSION_REQUEST_LIMIT/.test(e.message) && !e.message.includes('private upstream'));
  assert.equal(calls.length, 2);
});

test('Disabled/forbidden session errors stop before inference', async () => {
  for (const status of [403, 503]) {
    const { llm, calls } = setup(() => Response.json({}, { status }));
    await assert.rejects(llm.testConnection(cfg), new RegExp(`HTTP ${status}`));
    assert.equal(calls.length, 1);
  }
});

test('Non-SSE response and malformed frames fail', async () => {
  for (const response of [Response.json({}), stream(['not json'])]) {
    const { llm } = setup(call => call.url.endsWith('/session') ? session() : response);
    await assert.rejects(llm.testConnection(cfg));
  }
});

test('Other provider adapters retain their auth and response contracts', async () => {
  const { llm, calls } = setup(call => call.url.includes('gemini.example') ? Response.json({ candidates: [{ content: { parts: [{ text }] } }] }) : Response.json({ choices: [{ message: { content: text } }] }));
  const openai = { api: 'openai-chat', endpoint: 'https://openai.example/chat', model: 'model', apiKey: 'test_only' };
  assert.equal((await llm.generateNotes(openai, '', '')).commit, notes.commit);
  assert.equal(calls[0].headers.Authorization, 'Bearer test_only');
  assert.ok(calls[0].body.messages);
  await llm.generateNotes({ ...openai, apiKey: '', endpoint: 'http://localhost:1234/chat' }, '', '');
  assert.equal(calls[1].headers.Authorization, undefined);
  await llm.generateNotes({ api: 'gemini', endpoint: 'https://gemini.example/models', model: 'flash', apiKey: 'test_only' }, '', '');
  assert.equal(calls[2].url, 'https://gemini.example/models/flash:generateContent?key=test_only');
});

test('Default settings ignore legacy private endpoint/model/key overrides', () => {
  let state = { provider: 'default', providers: { default: { endpoint: 'https://old.example/v1/responses', model: 'gpt-private', keyCipher: 'legacy' }, openai: { endpoint: 'https://custom.example/chat', model: 'custom' } } };
  const context = { localStorage: { getItem: () => JSON.stringify(state) }, XORNumberCipher: { decryptFromNumbers: () => { throw Error('Default must not decrypt a key'); } } };
  context.self = context;
  vm.runInNewContext(fs.readFileSync('js/settings.js', 'utf8'), context);
  const settings = context.DiffNoteSettings;
  const active = settings.getActive();
  assert.equal(active.api, 'demo-responses');
  assert.equal(active.apiKey, '');
  assert.equal(active.model, 'demo-auto');
  assert.equal(active.projectId, 'github-pages');
  assert.equal(active.endpoint, 'https://gpt.yapweijun1996.com/demo/v1/responses');
  assert.equal(settings.resolve('openai').endpoint, 'https://custom.example/chat');
  assert.equal(settings.resolve('openai').model, 'custom');
  state = null;
  assert.equal(settings.getActive().projectId, 'github-pages');
  assert.ok(!fs.readFileSync('js/settings.js', 'utf8').includes('DEFAULT_GW_KEY_CIPHER'));
});
