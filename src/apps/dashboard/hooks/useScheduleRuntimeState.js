import { useCallback, useState } from 'react';
import { endScheduleOccurrence } from '../../../domains/schedule/client/scheduleRuntimeClient.js';
import { useAppliedScheduleRuntime } from '../../../domains/schedule/client/useAppliedScheduleRuntime.js';
import { endSpecialSession } from '../../../domains/protection/client/specialSessionClient.js';

export function useScheduleRuntimeState(enabled) {
  const { state, error: readError, refresh } = useAppliedScheduleRuntime(enabled);
  const [actionError, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const end = useCallback(async () => {
    if (!state || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (state.source === 'schedule') await endScheduleOccurrence(state.sessionId);
      else if (state.source === 'manual') await endSpecialSession(state.sessionId);
      await refresh();
    } catch (failure) { setError(failure); }
    finally { setBusy(false); }
  }, [state, busy, refresh]);
  const retry = useCallback(async () => { setError(null); return refresh(); }, [refresh]);
  return { state, error: actionError || readError, busy, end, refresh: retry };
}
