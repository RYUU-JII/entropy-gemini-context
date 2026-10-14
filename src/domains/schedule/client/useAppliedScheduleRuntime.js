import { useCallback, useEffect, useRef, useState } from 'react';
import { getScheduleRuntimeState } from './scheduleRuntimeClient.js';
import { runtimeOnMessageAddListener, runtimeOnMessageRemoveListener } from '../../../platform/chrome/ChromeService.js';
import { SCHEDULE_RUNTIME_CHANGED, requireScheduleRuntimeState } from '../contracts/scheduleRuntimeState.js';

// All surfaces consume applied receipts. A push invalidates older in-flight reads.
export function useAppliedScheduleRuntime(enabled = true) {
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const token = ++generation.current;
    try {
      const next = await getScheduleRuntimeState();
      if (generation.current === token) { setState(next); setError(null); }
      return next;
    } catch (failure) {
      if (generation.current === token) setError(failure);
      throw failure;
    }
  }, []);
  useEffect(() => {
    if (!enabled) return undefined;
    const update = () => { refresh().catch(() => {}); };
    const listener = (message) => {
      if (message.type !== SCHEDULE_RUNTIME_CHANGED) return false;
      ++generation.current;
      try { setState(requireScheduleRuntimeState(message.payload.state)); setError(null); }
      catch (failure) { setError(failure); }
      return false;
    };
    runtimeOnMessageAddListener(listener);
    update();
    const timer = setInterval(update, 15_000);
    return () => { ++generation.current; clearInterval(timer); runtimeOnMessageRemoveListener(listener); };
  }, [enabled, refresh]);
  return { state, error, refresh };
}
