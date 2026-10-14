import { useCallback, useState } from 'react';
import {
  addSpecialSessionTemporaryAllowedSite,
  endSpecialSession,
  startSpecialSession,
} from '../../../domains/protection/client/specialSessionClient.js';
import { useAppliedScheduleRuntime } from '../../../domains/schedule/client/useAppliedScheduleRuntime.js';
import { endScheduleOccurrence } from '../../../domains/schedule/client/scheduleRuntimeClient.js';
import { normalizeSpecialSessionState } from '../../../domains/settings/config/specialSession.js';

export function useSpecialSessionController({ enabled = true } = {}) {
  const runtime = useAppliedScheduleRuntime(enabled);
  const [saving, setSaving] = useState(false);
  const [actionError, setError] = useState(null);
  const session = runtime.state
    ? { ...runtime.state.isolationSession, source: runtime.state.source }
    : normalizeSpecialSessionState(null);
  const mutate = useCallback(async (task) => {
    setSaving(true);
    setError(null);
    try {
      await task();
      return (await runtime.refresh()).isolationSession;
    } catch (failure) {
      setError(failure);
      return null;
    } finally { setSaving(false); }
  }, [runtime.refresh]);
  const start = useCallback((payload = {}) => mutate(() => startSpecialSession(payload)), [mutate]);
  const end = useCallback(() => mutate(() => session.source === 'schedule'
    ? endScheduleOccurrence(session.id) : endSpecialSession(session.id)), [mutate, session.source, session.id]);
  const addTemporaryAllowedSite = useCallback((hostname) => mutate(async () => {
    if (session.source !== 'manual') throw new Error('SPECIAL_SESSION_MANUAL_REQUIRED');
    await addSpecialSessionTemporaryAllowedSite(hostname, session.id);
  }), [mutate, session.source, session.id]);
  return {
    addTemporaryAllowedSite,
    busy: saving || !runtime.state || Boolean(runtime.error),
    end,
    error: actionError || runtime.error,
    refresh: runtime.refresh,
    session,
    start,
  };
}
export default useSpecialSessionController;
