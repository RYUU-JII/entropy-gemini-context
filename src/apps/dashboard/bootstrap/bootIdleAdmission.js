import { BOOT_POST_REVEAL_QUIET_MS } from './bootConfig.js';

const INPUT_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'];

// Own one quiet clock across both speculative waves. Intent-driven navigation
// never uses this admission path. A deadline skips work; it does not force it.
export function createBootIdleAdmission({ signal, quietMs = BOOT_POST_REVEAL_QUIET_MS } = {}) {
  let lastActivityAt = performance.now();
  const onActivity = () => { lastActivityAt = performance.now(); };
  for (const type of INPUT_EVENTS) window.addEventListener(type, onActivity, { passive: true, capture: true });
  document.addEventListener('visibilitychange', onActivity);
  const dispose = () => {
    for (const type of INPUT_EVENTS) window.removeEventListener(type, onActivity, true);
    document.removeEventListener('visibilitychange', onActivity);
    signal?.removeEventListener('abort', dispose);
  };
  signal?.addEventListener('abort', dispose, { once: true });

  const wait = ({ deadlineMs, signal: entrySignal = signal }) => new Promise((resolve) => {
    let timer = 0;
    let idle = 0;
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (idle) window.cancelIdleCallback(idle);
      entrySignal?.removeEventListener('abort', abort);
      resolve(result);
    };
    const abort = () => finish({ cancelled: true, timedOut: false });
    const check = () => {
      if (entrySignal?.aborted) return abort();
      const remaining = deadlineMs - performance.now();
      if (remaining <= 0) return finish({ cancelled: false, timedOut: true });
      const quietRemaining = quietMs - (performance.now() - lastActivityAt);
      if (document.hidden || quietRemaining > 0) {
        timer = setTimeout(check, Math.min(remaining, document.hidden ? 100 : Math.max(1, quietRemaining)));
        return;
      }
      if (typeof window.requestIdleCallback !== 'function') {
        // Existing platform degradation seam: yield once, then recheck input.
        timer = setTimeout(() => admit(false, 8), Math.min(24, remaining));
        return;
      }
      idle = window.requestIdleCallback((deadline) => {
        idle = 0;
        admit(deadline.didTimeout, deadline.timeRemaining());
      }, { timeout: Math.max(1, remaining) });
    };
    const admit = (didTimeout, idleMs) => {
      if (entrySignal?.aborted) return abort();
      if (performance.now() >= deadlineMs) return finish({ cancelled: false, timedOut: true });
      if (didTimeout || idleMs < 4 || document.hidden || performance.now() - lastActivityAt < quietMs) {
        timer = setTimeout(check, 16);
        return;
      }
      finish({ cancelled: false, timedOut: false });
    };
    entrySignal?.addEventListener('abort', abort, { once: true });
    check();
  });
  return { wait, dispose };
}
