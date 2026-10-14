import React, { useState } from 'react';
import { SiteReleaseControl } from '@/themes/core/widgets/shared/sites/index.js';

// Both policy state and its cancellable release remain owned by SitesTab.
export default function ZenSiteProtectionToggle({ domain, type, releaseControl, onProtect, t }) {
  const [pending, setPending] = useState(false);
  const change = async () => {
    if (pending) return;
    setPending(true);
    try { await onProtect(domain); } finally { setPending(false); }
  };
  return <div className="zen-site-protection">
    <span>{t(type === 'blocked' ? 'target_protocol.status_blocked' : type === 'allowed' ? 'target_protocol.status_allowed' : 'recording.unprotected')}</span>
    {releaseControl ? <SiteReleaseControl domain={domain} type={type} control={releaseControl} t={t} />
      : <button type="button" disabled={pending} aria-busy={pending} onClick={() => void change()}>{t('registry.tracked_action_protect')}</button>}
  </div>;
}