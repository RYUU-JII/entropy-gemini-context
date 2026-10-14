import { useEffect } from 'react';
import { runtimeOnMessageAddListener, runtimeOnMessageRemoveListener } from '@/platform/chrome/ChromeService.js';
import { MESSAGE_TYPES } from '@/platform/messaging/messageTypes.js';
import { isProgressionStateChangedMessage } from '@/domains/progression/contracts/progressionStateChanged.js';
import { requireDashboardProfileGeneration } from '@/apps/dashboard/bootstrap/dashboardProfileGenerationOwner.js';

// Broadcasts invalidate a read only. Eligibility and profile generation are
// rechecked by the background service, never copied from an event payload.
export function useGuidanceStateChanges(refresh, onError) {
  useEffect(() => {
    const listener = (message) => {
      if (message?.type === MESSAGE_TYPES.PROGRESSION_STATE_CHANGED) {
        if (!isProgressionStateChangedMessage(message)) return;
        let generation;
        try { generation = requireDashboardProfileGeneration(); } catch { return; }
        if (generation !== message.profileGeneration) return;
      } else if (message?.type !== MESSAGE_TYPES.GUIDANCE_STATE_CHANGED) return;
      void refresh().catch(onError);
    };
    runtimeOnMessageAddListener(listener);
    return () => runtimeOnMessageRemoveListener(listener);
  }, [refresh, onError]);
}
