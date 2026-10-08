const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function target() {
  const listeners = new Map();
  return {
    addEventListener(name, listener) { if (!listeners.has(name)) listeners.set(name, []); listeners.get(name).push(listener); },
    async emit(name, event) { await Promise.all((listeners.get(name) || []).map(fn => fn(event))); },
  };
}
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
function setup({ safe = true, settingsOpen = false, visibility = 'visible', controlled = true, pageVersion = 'v10', waiting = true, versionSupport = true, activates = true, offline = false } = {}) {
  const timers = new Map();
  let nextTimer = 0, reloads = 0, skips = 0, checks = 0;
  const ui = [];
  const button = target();
  const sw = target();
  sw.controller = controlled ? { old: true } : null;
  const worker = { ...target(), state: 'installed', postMessage(message, ports) {
    if (message.type === 'GET_VERSION' && versionSupport) queueMicrotask(() => ports[0].other.onmessage({ data: { version: 'v11' } }));
    if (message.type === 'ACTIVATE_UPDATE') {
      skips++;
      if (activates) queueMicrotask(() => { worker.state = 'activated'; registration.waiting = null; sw.controller = worker; sw.emit('controllerchange'); });
    }
  } };
  const registration = { ...target(), waiting: waiting ? worker : null, installing: null, update: async () => { checks++; if (offline) throw Error('offline'); } };
  sw.register = async () => registration;
  const settings = { hidden: !settingsOpen };
  const document = { ...target(), visibilityState: visibility, querySelector: () => ({ content: pageVersion }), getElementById: id => id === 'settingsOverlay' ? settings : button };
  const app = { canReloadForUpdate: () => safe };
  const window = { ...target(), DiffNoteApp: app, DiffNoteUI: {
    showUpdateAvailable: (handlers, version) => ui.push({ state: 'ready', handlers, version }),
    showUpdateProgress: version => ui.push({ state: 'progress', version }),
    showUpdateError: (handlers, version) => ui.push({ state: 'error', handlers, version }),
    hideUpdatePrompt: () => ui.push({ state: 'hidden' }),
  }, location: { reload: () => reloads++ }, setTimeout(fn, delay) { const id = ++nextTimer; timers.set(id, { fn, delay }); return id; }, clearTimeout: id => timers.delete(id), setInterval: () => {} };
  class Channel { constructor() { this.port1 = { close() {} }; this.port2 = { close() {}, other: this.port1 }; } }
  vm.runInNewContext(fs.readFileSync('js/sw-register.js','utf8'), { window, navigator: { serviceWorker: sw }, document, MessageChannel: Channel, console: { warn() {} } });
  return { window, sw, worker, registration, ui, button, settings, document,
    async load() { await window.emit('load'); await flush(); },
    async timer(delay) { const entry = [...timers.entries()].find(([, t]) => t.delay === delay); assert.ok(entry, `Expected timer ${delay}`); timers.delete(entry[0]); entry[1].fn(); await flush(); },
    setSafe(value) { safe = value; },
    counts: () => ({ reloads, skips, checks }),
  };
}

test('Automatically activates and reloads once without a user click', async () => {
  const env = setup(); await env.load();
  assert.equal(env.counts().skips, 1);
  assert.equal(env.counts().reloads, 1);
  await env.sw.emit('controllerchange'); await flush();
  assert.equal(env.counts().reloads, 1);
});

test('Protects local work, shows target version, and automatically refreshes when safe', async () => {
  const env = setup({ safe: false }); await env.load();
  assert.equal(env.counts().skips, 1);
  assert.equal(env.counts().reloads, 0);
  assert.equal(env.ui.at(-1).state, 'ready');
  assert.equal(env.ui.at(-1).version, 'v11');
  env.setSafe(true); await env.timer(1000);
  assert.equal(env.counts().reloads, 1);
});

test('Protects unsaved settings until the dialog closes', async () => {
  const env = setup({ settingsOpen: true }); await env.load();
  assert.equal(env.counts().reloads, 0);
  env.settings.hidden = true; await env.timer(1000);
  assert.equal(env.counts().reloads, 1);
});

test('Does not reload hidden tabs until visible', async () => {
  const env = setup({ visibility: 'hidden' }); await env.load();
  assert.equal(env.counts().reloads, 0);
  env.document.visibilityState = 'visible'; await env.timer(1000);
  assert.equal(env.counts().reloads, 1);
});

test('Fresh page assets already match the activated worker: no redundant reload', async () => {
  const env = setup({ pageVersion: 'v11' }); await env.load();
  assert.equal(env.counts().skips, 1);
  assert.equal(env.counts().reloads, 0);
  assert.equal(env.ui.at(-1).state, 'hidden');
});

test('First install never reloads an uncontrolled page', async () => {
  const env = setup({ controlled: false }); await env.load();
  assert.equal(env.counts().reloads, 0);
});

test('Updates after the first controller claim still reload automatically', async () => {
  const env = setup({ controlled: false }); await env.load();
  await env.sw.emit('controllerchange'); await flush();
  assert.equal(env.counts().reloads, 1);
});

test('Deferred polling does not repeatedly announce the same banner', async () => {
  const env = setup({ safe: false }); await env.load();
  const announcements = env.ui.filter(item => item.state === 'ready').length;
  await env.timer(1000);
  assert.equal(env.ui.filter(item => item.state === 'ready').length, announcements);
});

test('Optional explicit refresh works while comparison is open', async () => {
  const env = setup({ safe: false }); await env.load();
  env.ui.at(-1).handlers.onUpdate();
  assert.equal(env.counts().reloads, 1);
});

test('Dismissing the banner does not prevent automatic refresh after work ends', async () => {
  const env = setup({ safe: false }); await env.load();
  env.ui.at(-1).handlers.onLater();
  assert.equal(env.ui.at(-1).state, 'hidden');
  await env.timer(1000);
  assert.equal(env.ui.at(-1).state, 'hidden');
  env.setSafe(true); await env.timer(1000);
  assert.equal(env.counts().reloads, 1);
});

test('Activation timeout exposes a retry and can recover', async () => {
  const env = setup({ activates: false }); await env.load();
  await env.timer(15000);
  assert.equal(env.ui.at(-1).state, 'error');
  env.ui.at(-1).handlers.onRetry();
  assert.equal(env.counts().skips, 2);
});

test('Unknown old waiting worker is replaced without unsafe activation', async () => {
  const env = setup({ versionSupport: false }); await env.load();
  assert.equal(env.counts().skips, 0);
  await env.timer(2000);
  assert.equal(env.counts().skips, 0);
  assert.equal(env.counts().checks, 1);
  assert.equal(env.counts().reloads, 0);
});

test('Another tab activating a worker cannot discard this tab\'s comparison', async () => {
  const env = setup({ safe: false, waiting: false }); await env.load();
  env.sw.controller = env.worker;
  await env.sw.emit('controllerchange'); await flush();
  assert.equal(env.counts().reloads, 0);
  env.setSafe(true); await env.timer(1000);
  assert.equal(env.counts().reloads, 1);
});

test('Version button checks updates; offline checks do not reload', async () => {
  const env = setup({ waiting: false, offline: true }); await env.load();
  assert.equal(env.button.textContent, 'v10');
  const checks = env.counts().checks;
  await env.button.emit('click'); await flush();
  assert.equal(env.counts().checks, checks + 1);
  assert.equal(env.counts().reloads, 0);
});

test('Worker reports its version and removes only older DiffNote caches', async () => {
  const listeners = new Map();
  const removed = [];
  let claims = 0;
  const self = { addEventListener: (type, callback) => listeners.set(type, callback), clients: { claim: async () => claims++ } };
  const caches = { keys: async () => ['diffnote-v10', 'diffnote-v11', 'another-app-v2'], delete: async key => removed.push(key) };
  vm.runInNewContext(fs.readFileSync('sw.js', 'utf8'), { self, caches });
  let version;
  listeners.get('message')({ data: { type: 'GET_VERSION' }, ports: [{ postMessage: data => version = data.version }] });
  assert.equal(version, 'v11');
  let activation;
  listeners.get('activate')({ waitUntil: promise => activation = promise });
  await activation;
  assert.deepEqual(removed, ['diffnote-v10']);
  assert.equal(claims, 1);
});

test('Failed app-shell install cannot activate the worker', async () => {
  const listeners = new Map();
  let skips = 0;
  const self = { addEventListener: (type, callback) => listeners.set(type, callback), skipWaiting: () => skips++ };
  const caches = { open: async () => ({ addAll: async () => { throw Error('offline'); } }) };
  vm.runInNewContext(fs.readFileSync('sw.js', 'utf8'), { self, caches });
  let installation;
  listeners.get('install')({ waitUntil: promise => installation = promise });
  await assert.rejects(installation, /offline/);
  assert.equal(skips, 0);
});

test('Automatic activation protects legacy tabs and ignores other app scopes', async () => {
  for (const legacy of [false, true]) {
    const listeners = new Map(), timers = new Map(), messages = [];
    let skips = 0, nextTimer = 0;
    class Channel { constructor() { this.port1 = { close() {} }; this.port2 = { close() {}, other: this.port1 }; } }
    const scopedClient = { url: 'https://example.test/diffnote/', postMessage: (_, ports) => {
      if (!legacy) queueMicrotask(() => ports[0].other.onmessage({ data: { safeRefresh: true } }));
    } };
    const foreignClient = { url: 'https://example.test/other/', postMessage: () => assert.fail('Other app scope must not be probed') };
    const self = { registration: { scope: 'https://example.test/diffnote/' },
      clients: { matchAll: async () => [scopedClient, foreignClient] },
      skipWaiting: async () => skips++, addEventListener: (type, callback) => listeners.set(type, callback) };
    vm.runInNewContext(fs.readFileSync('sw.js','utf8'), { self, MessageChannel: Channel,
      setTimeout: fn => { const id = ++nextTimer; timers.set(id, fn); return id; }, clearTimeout: id => timers.delete(id) });
    let activation;
    listeners.get('message')({ data: { type: 'ACTIVATE_UPDATE' }, source: { postMessage: data => messages.push(data.type) }, waitUntil: promise => activation = promise });
    await flush();
    for (const fn of timers.values()) fn();
    await activation;
    assert.equal(skips, legacy ? 0 : 1);
    assert.deepEqual(messages, legacy ? ['UPDATE_DEFERRED'] : []);
  }
});

test('Safe-refresh probe responds; legacy deferral is retried automatically', async () => {
  const env = setup({ activates: false }); await env.load();
  let reply;
  await env.sw.emit('message', { data: { type: 'CHECK_SAFE_REFRESH' }, ports: [{ postMessage: value => reply = value }] });
  assert.equal(reply.safeRefresh, true);
  await env.sw.emit('message', { data: { type: 'UPDATE_DEFERRED' }, source: env.worker });
  assert.equal(env.ui.at(-1).state, 'hidden');
  await env.timer(5000);
  assert.equal(env.counts().skips, 2);
  assert.equal(env.counts().reloads, 0);
});

test('Version remains visible without service-worker support', () => {
  const button = {};
  vm.runInNewContext(fs.readFileSync('js/sw-register.js','utf8'), { navigator: {}, document: {
    querySelector: () => ({ content: 'v11+abcdef0' }), getElementById: () => button,
  } });
  assert.equal(button.textContent, 'v11+abcdef0');
  assert.equal(button.disabled, true);
});
