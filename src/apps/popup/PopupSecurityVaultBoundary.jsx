import React from 'react';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { runtimeGetURL } from '../../platform/chrome/popupBrowserClient.js';
import { useSecurityVaultStatus } from '../shared/security/useSecurityVaultStatus.js';

export default function PopupSecurityVaultBoundary({ children }) {
  const { t } = useAppTranslation('common');
  const { status, error, refresh } = useSecurityVaultStatus();
  if (status.protectionReady === true) return children;
  const checking = status.state === 'checking' || status.state === 'setup_required';
  const failed = status.state === 'failed';
  return (
    <main className="popup-security-vault" aria-busy={checking}>
      <h1>Entropy</h1>
      <p role={failed ? 'alert' : 'status'}>
        {t(checking ? 'security_vault.preparing_description' : failed ? 'security_vault.preparing_failed'
          : status.state === 'incompatible' ? 'security_vault.incompatible_description'
            : 'security_vault.popup_locked')}
      </p>
      {failed && error ? <code>{error.code || error.message}</code> : null}
      {status.state === 'incompatible' ? <code>{status.reason}</code> : null}
      {(failed || status.state === 'setup_required') ? <button type="button"
        className="popup-security-vault__dashboard" onClick={() => { void refresh().catch(() => {}); }}>
        {t('security_vault.retry')}
      </button> : null}
      <a href={runtimeGetURL('src/pages/dashboard.html')} target="_blank" rel="noreferrer"
        className="popup-security-vault__dashboard">
        {t('security_vault.open_dashboard')}
      </a>
    </main>
  );
}
