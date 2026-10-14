import React, { useEffect, useId, useRef, useState } from 'react';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { MESSAGE_ACTIONS } from '../../../platform/messaging/messageTypes.js';
import { requireStrongPassphrase } from '../../../platform/security/vaultCryptography.js';
import { requestSecurityVault } from '../../shared/security/securityVaultClient.js';
import { useSecurityVaultController } from '../../shared/security/SecurityVaultControllerContext.jsx';
import { isChangedVaultSessionFailure } from '../../shared/security/securityVaultStatusEvents.js';
import DataLockUnlockForm from './DataLockUnlockForm.jsx';
import {
  SettingsActionButton, SettingsFeedback, SettingsGroup, SettingsInlineTask, SettingsRow, SettingsTextInput,
} from '../tabs/settings/components/SettingsControlPrimitives.jsx';

export default function DataLockPanel({ isRuntimeActive = true }) {
  const { t } = useAppTranslation('common');
  const vault = useSecurityVaultController();
  const formId = useId();
  const [task, setTask] = useState(null);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null);
  const pending = useRef(false);
  const clear = () => { setCurrent(''); setNext(''); setConfirmation(''); };
  useEffect(() => {
    if (isRuntimeActive) return;
    setTask(null); setFailure(null); clear();
  }, [isRuntimeActive]);
  if (vault.status.protectionReady !== true || !['local', 'passphrase'].includes(vault.status.mode)) {
    throw new Error('SECURITY_VAULT_DATA_LOCK_ADMISSION_REQUIRED');
  }
  const enabled = vault.status.mode === 'passphrase';
  const locked = vault.status.state === 'locked';
  const legacy = vault.status.lockScope === 'profile';
  const close = () => { if (pending.current) return; setTask(null); setFailure(null); clear(); };
  const open = (kind) => { if (pending.current || !isRuntimeActive) return; clear(); setFailure(null); setTask(kind); };
  const removing = task === 'remove';
  const separating = task === 'separate';
  const submit = async (event) => {
    event.preventDefault();
    if (pending.current || !isRuntimeActive) return;
    setFailure(null);
    if (!removing && !separating) {
      if (next !== confirmation) { setFailure({ message: t('security_vault.mismatch') }); return; }
      try { requireStrongPassphrase(next).fill(0); }
      catch { setFailure({ message: t('security_vault.passphrase_help') }); return; }
    }
    pending.current = true; setBusy(true);
    try {
      const status = await requestSecurityVault(separating ? MESSAGE_ACTIONS.SEPARATE_SECURITY_VAULT_PROTECTION_KEYS
        : removing ? MESSAGE_ACTIONS.REMOVE_SECURITY_VAULT_PASSPHRASE
        : task === 'enable' ? MESSAGE_ACTIONS.SETUP_SECURITY_VAULT : MESSAGE_ACTIONS.CHANGE_SECURITY_VAULT_PASSPHRASE,
      separating ? { passphrase: current } : removing ? { currentPassphrase: current } : task === 'enable' ? { passphrase: next }
        : { currentPassphrase: current, newPassphrase: next });
      vault.publish(status);
      clear(); setTask(null);
    } catch (error) {
      setFailure({ message: t('security_vault.lock_operation_failed'), code: error.code || error.message });
    } finally { pending.current = false; setBusy(false); }
  };
  const field = (label, value, setter, autoComplete, autofocus = false) => <label className="block space-y-1.5 text-sm">
    <span>{t(label)}</span>
    <SettingsTextInput required type="password" autoComplete={autoComplete} value={value} disabled={busy}
      data-settings-task-autofocus={autofocus ? 'true' : undefined}
      onChange={event => setter(event.target.value)} />
  </label>;
  return <SettingsGroup title={t('security_vault.settings_title')} description={t('security_vault.settings_description')}>
    <SettingsRow title={t(locked ? 'security_vault.logs_locked' : enabled ? 'security_vault.lock_enabled' : 'security_vault.lock_disabled')}
      description={t(legacy ? 'security_vault.separate_description' : locked ? 'security_vault.logs_locked_description'
        : enabled ? 'security_vault.lock_enabled_description' : 'security_vault.lock_disabled_description')}>
      <div className="flex flex-wrap gap-2">
        <SettingsActionButton disabled={busy || !isRuntimeActive} onClick={() => open(legacy ? 'separate' : locked ? 'unlock' : enabled ? 'change' : 'enable')}>
          {t(legacy ? 'security_vault.separate_action' : locked ? 'security_vault.unlock' : enabled ? 'security_vault.change' : 'security_vault.enable_lock')}
        </SettingsActionButton>
        {enabled && !legacy ? <SettingsActionButton disabled={busy || !isRuntimeActive} onClick={() => open('remove')}>
          {t('security_vault.remove_lock')}
        </SettingsActionButton> : null}
      </div>
    </SettingsRow>
    {isChangedVaultSessionFailure(vault.status.reason) ? <SettingsFeedback tone="danger"
      message={t(vault.status.reason === 'SECURITY_VAULT_PASSPHRASE_REMOVAL_COMMIT_FAILED'
        ? 'security_vault.removal_unlock_required' : 'security_vault.changed_unlock_required')} /> : null}
    {task ? <SettingsInlineTask busy={busy} onClose={close}
      title={t(separating ? 'security_vault.separate_title' : task === 'unlock' ? 'security_vault.unlock'
        : removing ? 'security_vault.remove_lock' : task === 'enable' ? 'security_vault.enable_lock' : 'security_vault.change')}
      description={task === 'unlock' ? undefined : t(separating ? 'security_vault.separate_description'
        : removing ? 'security_vault.remove_lock_description' : 'security_vault.lock_enabled_description')}
      actions={task === 'unlock' ? undefined : <>
        <SettingsActionButton disabled={busy} onClick={close}>{t('action.cancel')}</SettingsActionButton>
        <SettingsActionButton type="submit" form={formId} disabled={busy || (enabled && !current) || (!removing && !separating && (!next || !confirmation))}>
          {t(separating ? 'security_vault.separate_action' : removing ? 'security_vault.remove_lock' : task === 'enable' ? 'security_vault.enable_lock' : 'security_vault.change')}
        </SettingsActionButton>
      </>}>
      {task === 'unlock' ? <DataLockUnlockForm isRuntimeActive={isRuntimeActive} onBusyChange={setBusy} onUnlocked={() => setTask(null)} />
        : <form id={formId} onSubmit={submit} className="max-w-lg space-y-4">
        {enabled ? field('security_vault.current_passphrase', current, setCurrent, 'current-password', true) : null}
        {!removing && !separating ? <>
          {field('security_vault.new_passphrase', next, setNext, 'new-password', !enabled)}
          {field('security_vault.confirm_passphrase', confirmation, setConfirmation, 'new-password')}
          <p className="text-xs leading-relaxed text-on-surface-muted">{t('security_vault.passphrase_help')}</p>
          <p className="text-xs leading-relaxed text-on-surface-muted">{t('security_vault.no_recovery')}</p>
        </> : null}
      </form>}
      <SettingsFeedback message={failure?.message} tone="danger" />
      {failure?.code ? <code className="block break-all text-xs">{failure.code}</code> : null}
    </SettingsInlineTask> : null}
  </SettingsGroup>;
}
