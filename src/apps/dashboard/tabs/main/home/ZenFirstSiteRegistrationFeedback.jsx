import React, { useEffect, useRef } from 'react';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import './zenFirstSiteRegistration.css';

export default function ZenFirstSiteRegistrationFeedback({ receipt, onDismiss }) {
  const { t } = useAppTranslation('main');
  const statusRef = useRef(null);
  useEffect(() => {
    const timeout = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timeout);
  }, [receipt, onDismiss]);
  useEffect(() => {
    // At the last finite slot the invitation entry no longer exists. Preserve
    // keyboard continuation at the same water position without another action.
    if (document.activeElement === document.body) statusRef.current?.focus({ preventScroll: true });
  }, [receipt]);
  return (
    <div ref={statusRef} className="zen-first-site-feedback font-ui" tabIndex={-1}
      data-first-site-registration-feedback={receipt.domain} role="status" aria-live="polite" aria-atomic="true">
      <strong>{receipt.domain}</strong>
      <small>{t('first_use.protected')}
        {receipt.protectionApplied ? ' · ' + t('invitation_koi.protection_applied') : ''}</small>
    </div>
  );
}
