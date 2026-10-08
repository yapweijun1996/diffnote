/**
 * DiffNote — service worker registration + automatic updates.
 *
 * Installed updates activate automatically. Reload waits until no local work
 * can be lost, unless the user explicitly chooses the optional refresh button.
 */
(function () {
  'use strict';

  const pageVersion = document.querySelector('meta[name="app-version"]')?.content || '';
  const versionBtn = document.getElementById('versionBtn');
  if (versionBtn) versionBtn.textContent = pageVersion;
  if (!('serviceWorker' in navigator)) {
    if (versionBtn) versionBtn.disabled = true;
    return;
  }

  const UPDATE_CHECK_INTERVAL = 15 * 60 * 1000;
  const UPDATE_WAIT_TIMEOUT = 15 * 1000;
  let hadController = !!navigator.serviceWorker.controller;
  let nextVersion = '';
  let deferredPromptShown = false;
  let readyToReload = false;
  let reloadTimer = null;
  let explicitRefresh = false;
  let registration = null;
  let activeUpdateWorker = null;
  let dismissedWorker = null;
  let reloading = false;
  let updateState = 'idle';
  let checkInFlight = null;
  let waitTimer = null;

  function workerVersion(worker) {
    return new Promise((resolve) => {
      const channel = new MessageChannel();
      const finish = (version) => {
        window.clearTimeout(timer);
        channel.port1.close();
        channel.port2.close();
        resolve(typeof version === 'string' && /^v[0-9]+(?:\+[a-f0-9]+)?$/.test(version) ? version : '');
      };
      const timer = window.setTimeout(() => finish(''), 2000);
      channel.port1.onmessage = (event) => finish(event.data && event.data.version);
      try { worker.postMessage({ type: 'GET_VERSION' }, [channel.port2]); }
      catch (_) { finish(''); }
    });
  }

  function reloadWhenSafe() {
    if (!readyToReload || reloading) return;
    const app = window.DiffNoteApp;
    const settingsOpen = !document.getElementById('settingsOverlay')?.hidden;
    const safe = app && app.canReloadForUpdate && app.canReloadForUpdate() && !settingsOpen;
    if (!explicitRefresh && (!safe || document.visibilityState === 'hidden')) {
      if (!deferredPromptShown && dismissedWorker !== activeUpdateWorker && window.DiffNoteUI && window.DiffNoteUI.showUpdateAvailable) {
        window.DiffNoteUI.showUpdateAvailable({ onUpdate: requestUpdate, onLater: deferUpdate }, nextVersion);
        deferredPromptShown = true;
      }
      window.clearTimeout(reloadTimer);
      reloadTimer = window.setTimeout(reloadWhenSafe, 1000);
      return;
    }
    reloading = true;
    window.clearTimeout(reloadTimer);
    updateState = 'reloading';
    if (window.DiffNoteUI && window.DiffNoteUI.showUpdateProgress) window.DiffNoteUI.showUpdateProgress(nextVersion);
    window.location.reload();
  }

  function clearWaitTimer() {
    if (waitTimer) {
      window.clearTimeout(waitTimer);
      waitTimer = null;
    }
  }

  function hideUpdatePrompt() {
    if (window.DiffNoteUI && window.DiffNoteUI.hideUpdatePrompt) {
      window.DiffNoteUI.hideUpdatePrompt();
    }
  }

  function deferUpdate() {
    dismissedWorker = activeUpdateWorker;
    updateState = 'idle';
    hideUpdatePrompt();
  }

  function failUpdate() {
    clearWaitTimer();
    updateState = 'update-failed';
    if (window.DiffNoteUI && window.DiffNoteUI.showUpdateError) {
      window.DiffNoteUI.showUpdateError({
        onRetry: requestUpdate,
        onDismiss: deferUpdate,
      }, nextVersion);
    }
  }

  function showAvailable(worker) {
    if (!worker || worker === navigator.serviceWorker.controller || reloading ||
        updateState === 'updating' || updateState === 'discovering') return;
    activeUpdateWorker = worker;
    updateState = 'discovering';
    workerVersion(worker).then((version) => {
      if (worker !== activeUpdateWorker || worker.state === 'redundant') return;
      if (!version) {
        // An old waiting worker cannot protect legacy tabs during activation.
        // Fetch its replacement rather than forcing it to take control.
        updateState = 'idle';
        registration.update().catch((err) => console.warn('SW replacement check failed:', err));
        return;
      }
      nextVersion = version;
      activateWaitingWorker(worker);
    });
  }

  function inspectWaiting() {
    if (registration && registration.waiting) {
      showAvailable(registration.waiting);
    }
  }

  function watchInstalling(worker) {
    if (!worker) return;

    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed') inspectWaiting();
      if (worker.state === 'redundant' && (updateState === 'updating' || updateState === 'discovering')) failUpdate();
    });
  }

  function watchRegistration(reg) {
    registration = reg;
    reg.addEventListener('updatefound', () => watchInstalling(reg.installing));
    watchInstalling(reg.installing);
    inspectWaiting();
  }

  function activateWaitingWorker(worker, force) {
    if (!worker || (updateState === 'updating' && !force) || reloading) return;

    activeUpdateWorker = worker;
    updateState = 'updating';
    clearWaitTimer();
    if (window.DiffNoteUI && window.DiffNoteUI.showUpdateProgress) {
      window.DiffNoteUI.showUpdateProgress(nextVersion);
    }

    try {
      worker.postMessage({ type: 'ACTIVATE_UPDATE' });
    } catch (err) {
      failUpdate();
      return;
    }

    waitTimer = window.setTimeout(() => {
      if (updateState === 'updating' && !reloading) failUpdate();
    }, UPDATE_WAIT_TIMEOUT);
  }

  function requestUpdate() {
    if (!registration || updateState === 'updating' || reloading) return;
    if (readyToReload) { explicitRefresh = true; reloadWhenSafe(); return; }

    const waiting = registration.waiting || activeUpdateWorker;
    if (waiting && waiting.state !== 'redundant') {
      activateWaitingWorker(waiting);
      return;
    }

    updateState = 'updating';
    if (window.DiffNoteUI && window.DiffNoteUI.showUpdateProgress) {
      window.DiffNoteUI.showUpdateProgress(nextVersion);
    }

    registration.update()
      .then(() => {
        const next = registration && registration.waiting;
        if (next) {
          activateWaitingWorker(next, true);
        } else {
          failUpdate();
        }
      })
      .catch((err) => {
        console.warn('SW update request failed:', err);
        failUpdate();
      });
  }

  function checkForUpdate(force) {
    if (!registration || updateState === 'updating' || updateState === 'discovering' || readyToReload || reloading) return Promise.resolve();
    if (document.visibilityState === 'hidden' && !force) return Promise.resolve();
    if (checkInFlight) return checkInFlight;

    updateState = 'checking';
    checkInFlight = registration.update()
      .then(() => inspectWaiting())
      .catch((err) => {
        console.warn('SW update check failed:', err);
      })
      .then(() => {
        checkInFlight = null;
        if (updateState === 'checking') updateState = 'idle';
      });

    return checkInFlight;
  }

  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'CHECK_SAFE_REFRESH' && event.ports[0]) {
      event.ports[0].postMessage({ safeRefresh: true });
    }
    if (event.data && event.data.type === 'UPDATE_DEFERRED' && event.source === activeUpdateWorker) {
      clearWaitTimer();
      updateState = 'idle';
      hideUpdatePrompt();
      window.setTimeout(inspectWaiting, 5000);
    }
  });

  navigator.serviceWorker.addEventListener('controllerchange', async () => {
    clearWaitTimer();
    if (!hadController) { hadController = true; updateState = 'idle'; hideUpdatePrompt(); return; }
    if (reloading) return;
    const controller = navigator.serviceWorker.controller;
    if (!controller) return;
    activeUpdateWorker = controller;
    nextVersion = await workerVersion(controller) || nextVersion;
    // A freshly loaded page may already contain this release's assets.
    if (nextVersion && nextVersion === pageVersion) {
      updateState = 'idle';
      hideUpdatePrompt();
      return;
    }
    deferredPromptShown = false;
    updateState = 'ready';
    readyToReload = true;
    reloadWhenSafe();
  });

  if (versionBtn) versionBtn.addEventListener('click', () => {
    dismissedWorker = null;
    deferredPromptShown = false;
    if (readyToReload) { reloadWhenSafe(); return; }
    checkForUpdate(true);
  });

  window.addEventListener('focus', () => {
    dismissedWorker = null;
    checkForUpdate(true);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      dismissedWorker = null;
      checkForUpdate(true);
    }
  });

  window.setInterval(() => checkForUpdate(false), UPDATE_CHECK_INTERVAL);

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        watchRegistration(reg);
        return checkForUpdate(true);
      })
      .catch((err) => console.warn('SW registration failed:', err));
  });
})();
