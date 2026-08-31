/**
 * DiffNote service worker — NETWORK-FIRST ("always latest").
 *
 * Strategy: try the network for every GET; fall back to cache only when
 * offline. This guarantees the freshest source on each online load (the real
 * fix for "force auto reload latest") while still working offline once cached.
 *
 * Update lifecycle: a new SW waits until the page asks it to activate;
 * sw-register.js owns the user prompt and guarded reload.
 *
 * Bump CACHE_VERSION when the offline fallback set should be refreshed.
 */
const CACHE_VERSION = 'diffnote-v9';
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

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
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
