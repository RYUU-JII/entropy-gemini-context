import { useEffect, useRef, useState } from 'react';

// A document-local, monotonic clock. Hidden/unfocused time never buys entry.
export function useZenGateWait({ enabled, sessionId, waitMs, resetToken }) {
  if (!Number.isFinite(waitMs) || waitMs <= 0) throw new Error('ZEN_GATE_WAIT_INVALID');
  const clock = useRef({ remainingMs: waitMs, startedAt: null });
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    clock.current = { remainingMs: waitMs, startedAt: null };
    setIsReady(false);
  }, [sessionId, waitMs, resetToken]);

  useEffect(() => {
    let timer = null;
    const stop = () => {
      window.clearTimeout(timer);
      timer = null;
      const state = clock.current;
      if (state.startedAt !== null) {
        state.remainingMs = Math.max(0, state.remainingMs - (performance.now() - state.startedAt));
        state.startedAt = null;
      }
    };
    const resume = () => {
      stop();
      if (!enabled || document.visibilityState !== 'visible' || !document.hasFocus()) return;
      const state = clock.current;
      if (state.remainingMs === 0) { setIsReady(true); return; }
      state.startedAt = performance.now();
      timer = window.setTimeout(() => {
        stop();
        if (document.visibilityState === 'visible' && document.hasFocus()) {
          state.remainingMs = 0;
          setIsReady(true);
        }
      }, state.remainingMs);
    };
    resume();
    window.addEventListener('focus', resume);
    window.addEventListener('blur', stop);
    window.addEventListener('pagehide', stop);
    document.addEventListener('visibilitychange', resume);
    return () => {
      stop();
      window.removeEventListener('focus', resume);
      window.removeEventListener('blur', stop);
      window.removeEventListener('pagehide', stop);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [enabled, sessionId, waitMs, resetToken]);

  return isReady;
}
