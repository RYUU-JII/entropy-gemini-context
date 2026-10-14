import React from 'react';

import { useSpecialSessionController } from '../../../hooks/useSpecialSessionController.js';
import { useProtocolStore } from '../../../stores/useProtocolStore.js';
import ScheduleSpecialSessionPanel from './ScheduleSpecialSessionPanel.jsx';

export default function ScheduleSpecialSessionWorkspace({
  t,
  typography,
  visualTokens,
}) {
  const allowedUrls = useProtocolStore((state) => state.allowedUrls);
  const specialSession = useSpecialSessionController({ enabled: true });

  return (
    <ScheduleSpecialSessionPanel
      allowedUrls={allowedUrls}
      busy={specialSession.busy}
      error={specialSession.error}
      onAddTemporaryAllowedSite={specialSession.addTemporaryAllowedSite}
      onEnd={specialSession.end}
      onStart={specialSession.start}
      onRetry={() => { void specialSession.refresh().catch((error) => {
        console.error('[ScheduleSession] Runtime refresh failed:', error);
      }); }}
      visualTokens={visualTokens}
      typography={typography}
      session={specialSession.session}
      t={t}
    />
  );
}
