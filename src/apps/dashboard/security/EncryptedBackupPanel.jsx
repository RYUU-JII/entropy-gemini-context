import React, { useEffect, useRef, useState } from 'react';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { MESSAGE_ACTIONS } from '../../../platform/messaging/messageTypes.js';
import { sendSecurityRuntimeRequest } from '../../shared/security/securityVaultClient.js';
import DataLockPanel from './DataLockPanel.jsx';
import DataLockUnlockForm from './DataLockUnlockForm.jsx';
import { useSecurityVaultController } from '../../shared/security/SecurityVaultControllerContext.jsx';
import { useDashboardProfileMutationController } from './DashboardProfileMutationController.jsx';
import { ENCRYPTED_BACKUP_MAX_FILE_BYTES } from '../../../platform/security/vaultCryptography.js';
import { SettingsActionButton, SettingsDisclosure, SettingsFeedback, SettingsGroup, SettingsTextInput } from '../tabs/settings/components/SettingsControlPrimitives.jsx';

function PasswordField({ label, value, onChange, disabled, autoComplete = 'new-password' }) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span>{label}</span>
      <SettingsTextInput required type="password" value={value} autoComplete={autoComplete} disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        />
    </label>
  );
}

export default function EncryptedBackupPanel({ hasPasscode, kind, isRuntimeActive = true }) {
  if (!['vault', 'backup'].includes(kind)) throw new Error('ENCRYPTED_BACKUP_SECTION_KIND_REQUIRED');
  return kind === 'vault' ? <DataLockPanel isRuntimeActive={isRuntimeActive} />
    : <EncryptedBackupControls hasPasscode={hasPasscode} isRuntimeActive={isRuntimeActive} />;
}

function EncryptedBackupControls({ hasPasscode, isRuntimeActive }) {
  const { t } = useAppTranslation('common');
  const restoreController = useDashboardProfileMutationController();
  const vault = useSecurityVaultController();
  const [backupPassword, setBackupPassword] = useState('');
  const [confirmBackup, setConfirmBackup] = useState('');
  const [pin, setPin] = useState('');
  const [file, setFile] = useState(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [busy, setBusy] = useState(false);
  const mutationPending = useRef(false);
  const [feedback, setFeedback] = useState(null);
  const [openOperation, setOpenOperation] = useState(null);
  const clearPasswords = () => {
    setBackupPassword(''); setConfirmBackup('');
    setPin('');
  };
  useEffect(() => {
    if (isRuntimeActive) return;
    clearPasswords(); setFile(null); setConfirmReplace(false);
    setOpenOperation(null);
  }, [isRuntimeActive]);
  const changeDisclosure = (operation, open) => {
    if (!open && openOperation !== operation) return;
    clearPasswords(); setFile(null); setConfirmReplace(false); setFeedback(null);
    setOpenOperation(open ? operation : null);
  };
  const run = async (task, successKey) => {
    if (mutationPending.current || !isRuntimeActive) return;
    mutationPending.current = true;
    setBusy(true);
    setFeedback(null);
    try {
      await task();
      clearPasswords();
      setFeedback({ success: true, message: t(successKey) });
    } catch (error) {
      setFeedback({ success: false, message: t(error?.message === 'SECURITY_VAULT_CONFIRMATION_MISMATCH'
        ? 'security_vault.mismatch' : 'security_vault.backup_failed'), code: error.code || error.message });
    } finally {
      mutationPending.current = false;
      setBusy(false);
    }
  };
  const matching = (value, confirmation) => {
    if (value !== confirmation) throw new Error('SECURITY_VAULT_CONFIRMATION_MISMATCH');
  };
  const exportBackup = (event) => {
    event.preventDefault();
    void run(async () => {
      matching(backupPassword, confirmBackup);
      const response = await sendSecurityRuntimeRequest({
        action: MESSAGE_ACTIONS.EXPORT_STORAGE_SNAPSHOT,
        backupPassphrase: backupPassword,
        authorization: { kind: 'passcode', passcode: pin },
      }, { timeoutMs: 60_000 });
      if (response?.success !== true || response.snapshot?.format !== 'entropy-encrypted-storage-snapshot') {
        throw new Error('SECURITY_VAULT_BACKUP_FAILED');
      }
      const url = URL.createObjectURL(new Blob([JSON.stringify(response.snapshot)], { type: 'application/json' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'entropy-backup-' + new Date().toISOString().slice(0, 10) + '.json';
      try {
        anchor.click();
      } finally {
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    }, 'security_vault.exported');
  };
  const restoreBackup = async (event) => {
    event.preventDefault();
    if (mutationPending.current || !isRuntimeActive) return;
    mutationPending.current = true; setBusy(true); setFeedback(null);
    try {
      if (!confirmReplace || !file || file.size > ENCRYPTED_BACKUP_MAX_FILE_BYTES) {
        throw new Error('SECURITY_VAULT_BACKUP_FILE_INVALID');
      }
      await restoreController.restore({
        snapshot: JSON.parse(await file.text()),
        backupPassphrase: backupPassword,
        authorization: { kind: 'passcode', passcode: pin },
      });
      clearPasswords();
      setFile(null);
      setConfirmReplace(false);
    } catch (error) {
      setFeedback({ success: false, message: t('security_vault.backup_failed'), code: error.code || error.message });
      mutationPending.current = false; setBusy(false);
    }
  };
  const pinField = hasPasscode ? <PasswordField label={t('security_vault.pin')} value={pin} onChange={setPin} disabled={busy} autoComplete="off" /> : null;
  return (
    <SettingsGroup title={t('security_vault.backup_title')} description={t('security_vault.backup_description')}>
      <div aria-busy={busy}>
        <SettingsDisclosure title={t('security_vault.export')} open={openOperation === 'export'} onOpenChange={(open) => changeDisclosure('export', open)}>
          {vault.status.state === 'locked' ? <div className="mt-4">
            <DataLockUnlockForm isRuntimeActive={isRuntimeActive} onBusyChange={setBusy} />
          </div> : <form onSubmit={exportBackup} className="mt-4 max-w-lg space-y-4">
            <p className="text-xs text-on-surface-muted">{t('security_vault.backup_description')}</p>
            <PasswordField label={t('security_vault.backup_passphrase')} value={backupPassword} onChange={setBackupPassword} disabled={busy} />
            <PasswordField label={t('security_vault.confirm_backup_passphrase')} value={confirmBackup} onChange={setConfirmBackup} disabled={busy} />
            {pinField}
            <SettingsActionButton type="submit" disabled={busy}>{t('security_vault.export')}</SettingsActionButton>
          </form>}
        </SettingsDisclosure>
        <SettingsDisclosure title={t('security_vault.restore')} open={openOperation === 'restore'} onOpenChange={(open) => changeDisclosure('restore', open)}>
          <form onSubmit={restoreBackup} className="mt-4 max-w-lg space-y-4">
            <label className="block space-y-1.5 text-sm"><span>{t('security_vault.backup_file')}</span><input type="file" accept="application/json,.json" disabled={busy} onChange={(event) => setFile(event.target.files?.[0] || null)} className="block w-full" /></label>
            <PasswordField label={t('security_vault.backup_passphrase')} value={backupPassword} onChange={setBackupPassword} disabled={busy} autoComplete="current-password" />
            <p className="text-xs leading-relaxed text-on-surface-muted">{t('security_vault.restore_local_description')}</p>
            {pinField}
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmReplace} disabled={busy} onChange={(event) => setConfirmReplace(event.target.checked)} /><span>{t('security_vault.replace_confirmation')}</span></label>
            <SettingsActionButton type="submit" tone="danger" disabled={busy || !confirmReplace || !file}>{t('security_vault.restore')}</SettingsActionButton>
          </form>
        </SettingsDisclosure>
      <SettingsFeedback message={feedback?.message} tone={feedback?.success ? 'neutral' : 'danger'} />
      {feedback?.code ? <code className="block break-all text-xs">{feedback.code}</code> : null}
      </div>
    </SettingsGroup>
  );
}
