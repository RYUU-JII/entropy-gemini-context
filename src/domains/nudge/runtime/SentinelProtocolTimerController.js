export const SENTINEL_PROTOCOL_TIMER_KEYS = Object.freeze({
  RITUAL_REVEAL: 'ritual_reveal',
  RITUAL_WATCH: 'ritual_watch',
  TERMINAL_SEQUENCE: 'terminal_sequence',
  GLOBAL_RIFT_INVITE: 'global_rift_invite',
  GLOBAL_STARTER_FEEDBACK: 'global_starter_feedback',
  GLOBAL_RUPTURE_REVEAL: 'global_rupture_reveal',
  ESCAPE_SEQUENCE: 'escape_sequence',
});

function resolveTimerApi(api = {}) {
  return {
    setTimeoutFn: api.setTimeoutFn || globalThis.setTimeout?.bind(globalThis),
    clearTimeoutFn: api.clearTimeoutFn || globalThis.clearTimeout?.bind(globalThis),
    setIntervalFn: api.setIntervalFn || globalThis.setInterval?.bind(globalThis),
    clearIntervalFn: api.clearIntervalFn || globalThis.clearInterval?.bind(globalThis),
  };
}

export function createSentinelProtocolTimerController(api = {}) {
  const {
    setTimeoutFn,
    clearTimeoutFn,
    setIntervalFn,
    clearIntervalFn,
  } = resolveTimerApi(api);
  const timeouts = new Map();
  const intervals = new Map();

  function clearTimeoutByKey(key) {
    if (!timeouts.has(key)) return false;
    clearTimeoutFn(timeouts.get(key));
    timeouts.delete(key);
    return true;
  }

  function clearIntervalByKey(key) {
    if (!intervals.has(key)) return false;
    clearIntervalFn(intervals.get(key));
    intervals.delete(key);
    return true;
  }

  return {
    scheduleTimeout(key, callback, delayMs = 0) {
      clearTimeoutByKey(key);
      const timeoutId = setTimeoutFn(() => {
        if (timeouts.get(key) === timeoutId) {
          timeouts.delete(key);
        }
        callback?.();
      }, Math.max(0, Number(delayMs) || 0));
      timeouts.set(key, timeoutId);
      return timeoutId;
    },

    scheduleInterval(key, callback, delayMs = 0) {
      clearIntervalByKey(key);
      const intervalId = setIntervalFn(() => {
        callback?.();
      }, Math.max(0, Number(delayMs) || 0));
      intervals.set(key, intervalId);
      return intervalId;
    },

    clearTimeout: clearTimeoutByKey,
    clearInterval: clearIntervalByKey,

    clearAll() {
      for (const key of [...timeouts.keys()]) {
        clearTimeoutByKey(key);
      }
      for (const key of [...intervals.keys()]) {
        clearIntervalByKey(key);
      }
    },

    hasTimeout(key) {
      return timeouts.has(key);
    },

    hasInterval(key) {
      return intervals.has(key);
    },
  };
}
