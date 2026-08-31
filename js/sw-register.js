/**
 * DiffNote — service worker registration + user-controlled updates.
 *
 * A new worker stays in the waiting state until the user chooses to update.
 * Once activated, the page reloads exactly once after controllerchange.
 */
(function () {
  'use strict';

  if (!('serviceWorker' in navigator)) return;

  const UPDATE_CHECK_INTERVAL = 15 * 60 * 1000;
  const UPDATE_WAIT_TIMEOUT = 15 * 1000;
  const hadController = !!navigator.serviceWorker.controller;
  let registration = null;
  let activeUpdateWorker = null;
  let dismissedWorker = null;
  let reloading = false;
  let updateState = 'idle';
  let checkInFlight = null;
  let waitTimer = null;

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
      });
    }
  }

  function showAvailable(worker, force) {
    if (!hadController || !worker || worker === navigator.serviceWorker.controller || reloading || updateState === 'updating') return;
    if (!force && dismissedWorker === worker) return;

    activeUpdateWorker = worker;
    updateState = 'update-available';
    if (window.DiffNoteUI && window.DiffNoteUI.showUpdateAvailable) {
      window.DiffNoteUI.showUpdateAvailable({
        onUpdate: requestUpdate,
        onLater: deferUpdate,
      });
    }
  }

  function inspectWaiting(force) {
    if (registration && registration.waiting) {
      showAvailable(registration.waiting, force);
    }
  }

  function watchInstalling(worker) {
    if (!worker) return;

    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed') inspectWaiting(false);
      if (worker.state === 'redundant' && updateState === 'updating') failUpdate();
    });
  }

  function watchRegistration(reg) {
    registration = reg;
    reg.addEventListener('updatefound', () => watchInstalling(reg.installing));
    watchInstalling(reg.installing);
    inspectWaiting(true);
  }

  function activateWaitingWorker(worker, force) {
    if (!worker || (updateState === 'updating' && !force) || reloading) return;

    activeUpdateWorker = worker;
    updateState = 'updating';
    clearWaitTimer();
    if (window.DiffNoteUI && window.DiffNoteUI.showUpdateProgress) {
      window.DiffNoteUI.showUpdateProgress();
    }

    try {
      worker.postMessage({ type: 'SKIP_WAITING' });
    } catch (err) {
      failUpdate();
      return;
    }

    waitTimer = window.setTimeout(() => {
      if (!reloading) failUpdate();
    }, UPDATE_WAIT_TIMEOUT);
  }

  function requestUpdate() {
    if (!registration || updateState === 'updating' || reloading) return;

    const waiting = registration.waiting || activeUpdateWorker;
    if (waiting && waiting.state !== 'redundant') {
      activateWaitingWorker(waiting);
      return;
    }

    updateState = 'updating';
    if (window.DiffNoteUI && window.DiffNoteUI.showUpdateProgress) {
      window.DiffNoteUI.showUpdateProgress();
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
    if (!registration || updateState === 'updating' || reloading) return Promise.resolve();
    if (document.visibilityState === 'hidden' && !force) return Promise.resolve();
    if (checkInFlight) return checkInFlight;

    updateState = 'checking';
    checkInFlight = registration.update()
      .then(() => inspectWaiting(force))
      .catch((err) => {
        console.warn('SW update check failed:', err);
      })
      .then(() => {
        checkInFlight = null;
        if (updateState === 'checking') updateState = 'idle';
      });

    return checkInFlight;
  }

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;

    reloading = true;
    clearWaitTimer();
    updateState = 'reloading';
    if (window.DiffNoteUI && window.DiffNoteUI.showUpdateProgress) {
      window.DiffNoteUI.showUpdateProgress();
    }
    window.location.reload();
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
