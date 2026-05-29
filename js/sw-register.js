/**
 * DiffNote — service worker registration + safe auto-reload.
 *
 * When a new SW takes control we reload once so the user is always on the
 * latest code. Guards:
 *  - `reloading` flag prevents reload loops.
 *  - We only arm the reload if a controller already existed at startup, so the
 *    very first SW install on a fresh visit does NOT trigger a spurious reload.
 */
(function () {
  'use strict';
  if (!('serviceWorker' in navigator)) return;

  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then((reg) => {
      // Proactively check for an updated SW on each load.
      reg.update().catch(() => {});
    }).catch((err) => console.warn('SW registration failed:', err));
  });
})();
