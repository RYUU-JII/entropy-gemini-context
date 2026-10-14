import React, { useEffect, useRef, useState } from 'react';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { MESSAGE_ACTIONS } from '../../../platform/messaging/messageTypes.js';
import { requestSecurityVault } from '../../shared/security/securityVaultClient.js';
import { useSecurityVaultController } from '../../shared/security/SecurityVaultControllerContext.jsx';
import { SettingsActionButton, SettingsFeedback, SettingsTextInput } from '../tabs/settings/components/SettingsControlPrimitives.jsx';

export default function DataLockUnlockForm({ isRuntimeActive = true, onUnlocked, onBusyChange }) {
  const { t } = useAppTranslation('common');
  const vault = useSecurityVaultController();
  const [passphrase, setPassphrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null);
  const pending = useRef(false);
  useEffect(() => { if (!isRuntimeActive) { setPassphrase(''); setFailure(null); } }, [isRuntimeActive]);
  const submit = async event => {
    event.preventDefault();
    if (pending.current || !isRuntimeActive) return;
    pending.current = true; setBusy(true); onBusyChange?.(true); setFailure(null);
    try {
      const status = await requestSecurityVault(MESSAGE_ACTIONS.UNLOCK_SECURITY_VAULT, { passphrase });
      setPassphrase('');
      vault.publish(status);
      onUnlocked?.();
    } catch (error) {
      setFailure({ message: t('security_vault.operation_failed'), code: error.code || error.message });
    } finally { pending.current = false; setBusy(false); onBusyChange?.(false); }
  };
  return <form onSubmit={submit} className="max-w-lg space-y-4" aria-busy={busy}>
    <p className="text-sm leading-relaxed text-on-surface-muted">{t('security_vault.logs_locked_description')}</p>
    <label className="block space-y-1.5 text-sm">
      <span>{t('security_vault.passphrase')}</span>
      <SettingsTextInput required type="password" autoComplete="current-password" value={passphrase}
        disabled={busy || !isRuntimeActive} data-settings-task-autofocus="true"
        onChange={event => setPassphrase(event.target.value)} />
    </label>
    <SettingsActionButton type="submit" disabled={busy || !isRuntimeActive || !passphrase}>
      {t('security_vault.unlock')}
    </SettingsActionButton>
    <SettingsFeedback message={failure?.message} tone="danger" />
    {failure?.code ? <code className="block break-all text-xs">{failure.code}</code> : null}
  </form>;
}
