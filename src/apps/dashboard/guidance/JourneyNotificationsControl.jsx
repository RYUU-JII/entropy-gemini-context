import React, { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useProtocolStore } from '@/apps/dashboard/stores/index.js';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { ensureNotificationsPermissionStrict } from '@/platform/security/capabilityGate.js';

export default function JourneyNotificationsControl({ disabled = false }) {
  const { t } = useAppTranslation('guidance');
  const { enabled, setNotificationsConfig } = useProtocolStore(useShallow((state) => ({
    enabled: state.notificationsConfig.journey.enabled, setNotificationsConfig: state.setNotificationsConfig,
  })));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const toggle = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!enabled && !await ensureNotificationsPermissionStrict()) {
        setError(t('notifications.denied'));
        return;
      }
      const result = await setNotificationsConfig((current) => ({ ...current,
        journey: { enabled: !enabled },
      }));
      if (result?.error) throw result.error;
    } catch (failure) { setError(t('notifications.failed', { message: failure.message })); }
    finally { setBusy(false); }
  };
  return <div className="mt-3 border-t border-border/25 pt-3 text-xs">
    <div className="flex items-center justify-between gap-3">
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={enabled} disabled={disabled || busy} onChange={toggle} />
        <span>{t('notifications.enable')}</span>
      </label>
    </div>
    <p className="mt-1 text-on-surface-muted">{t('notifications.description')}</p>
    {error && <p role="alert" className="mt-2 text-danger">{error}</p>}
  </div>;
}
