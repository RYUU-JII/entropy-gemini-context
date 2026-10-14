import { useEffect, useState } from 'react';
import { MESSAGE_ACTIONS } from '@/platform/messaging/messageTypes.js';
import { requestDashboardProgression } from './progressionRequestClient.js';

export function useDashboardFirstVisit({ ready }) {
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!ready) return undefined;
    let admitted = true;
    setError(null);
    void requestDashboardProgression(MESSAGE_ACTIONS.RECORD_DASHBOARD_FIRST_VISIT, {
      failureCode: 'DASHBOARD_FIRST_VISIT_RECORD_FAILED',
    })
      .then((response) => {
        if (response.access?.firstDashboardVisitRecorded !== true) {
          throw new Error('DASHBOARD_FIRST_VISIT_RECORD_FAILED');
        }
      })
      .catch((failure) => { if (admitted) setError(failure); });
    return () => { admitted = false; };
  }, [ready, attempt]);
  return { error, retry: () => setAttempt((value) => value + 1) };
}
