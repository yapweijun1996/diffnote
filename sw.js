/**
 * DiffNote service worker — NETWORK-FIRST ("always latest").
 *
 * Strategy: try the network for every GET; fall back to cache only when
 * offline. This guarantees the freshest source on each online load (the real
 * fix for "force auto reload latest") while still working offline once cached.
 *
 * sw-register.js automatically activates installed updates and reloads only
 * when the page has no comparison or settings draft to lose.
 *
 * Bump CACHE_VERSION when the offline fallback set should be refreshed.
 */
const CACHE_VERSION = 'diffnote-v11';
const APP_SHELL = [
  './',
  './index.html',
  './css/styles.css',
  './js/xor-number-cipher.js',
  './js/icons.js',
  './js/diff.js',
  './js/ai-mock.js',
  './js/settings.js',
  './js/i18n.js',
  './js/llm.js',
  './js/ui.js',
  './js/settings-ui.js',
  './js/app.js',
  './js/sw-register.js',
  './manifest.webmanifest',
  './icons/logo.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
});

// Older open tabs reload unconditionally on controllerchange. Wait until all
// scoped tabs support safe refresh before automatically taking control.
async function activateForSafeClients(source) {
  const clients = (await self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
    .filter((client) => client.url.startsWith(self.registration.scope));
  const supported = await Promise.all(clients.map((client) => new Promise((resolve) => {
    const channel = new MessageChannel();
    const finish = (safe) => {
      clearTimeout(timer);
      channel.port1.close();
      channel.port2.close();
      resolve(safe);
    };
    const timer = setTimeout(() => finish(false), 1500);
    channel.port1.onmessage = (reply) => finish(reply.data && reply.data.safeRefresh === true);
    try { client.postMessage({ type: 'CHECK_SAFE_REFRESH' }, [channel.port2]); }
    catch (_) { finish(false); }
  })));
  if (supported.every(Boolean)) await self.skipWaiting();
  else if (source) source.postMessage({ type: 'UPDATE_DEFERRED' });
}

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data && event.data.type === 'ACTIVATE_UPDATE') {
    event.waitUntil(activateForSafeClients(event.source));
  }
  if (event.data && event.data.type === 'GET_VERSION' && event.ports[0]) {
    event.ports[0].postMessage({ version: CACHE_VERSION.replace(/^diffnote-/, '') });
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('diffnote-') && k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((resp) => {
        // Refresh the cache copy for offline use on every successful fetch.
        if (resp && resp.status === 200 && resp.type === 'basic') {
          const clone = resp.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
        }
        return resp;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html')))
  );
});
