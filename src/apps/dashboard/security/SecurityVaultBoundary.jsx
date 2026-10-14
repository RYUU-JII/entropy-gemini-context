import React, { useEffect, useRef, useState } from 'react';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { MESSAGE_ACTIONS } from '../../../platform/messaging/messageTypes.js';
import { startProfileMutationResponseAck } from '../bootstrap/profileMutationResponseAckClient.js';
import { requestSecurityVault, sendSecurityRuntimeRequest } from '../../shared/security/securityVaultClient.js';
import { isChangedVaultSessionFailure } from '../../shared/security/securityVaultStatusEvents.js';
import DashboardSetupCanvas from '../components/DashboardSetupCanvas.jsx';

export default function SecurityVaultBoundary({ children, vault, onResetFlowRetentionChange }) {
  const { t } = useAppTranslation('common');
  const [passphrase, setPassphrase] = useState('');
  const [pin, setPin] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [busy, setBusy] = useState(false);
  const mutationPending = useRef(false);
  const [failure, setFailure] = useState('');
  const [failureCode, setFailureCode] = useState('');
  const [committedResetResponse, setCommittedResetResponse] = useState(null);
  const [resetRequested, setResetRequested] = useState(false);
  const resetFlowActive = resetRequested || committedResetResponse !== null;
  const isSetup = vault.status.state === 'setup_required';
  const isIncompatible = vault.status.state === 'incompatible';
  const isWaiting = vault.status.state === 'checking';
  const isFailed = vault.status.state === 'failed';
  useEffect(() => {
    if (vault.status.state !== 'unlocked') return;
    setPassphrase('');
    setPin('');
  }, [vault.status.state]);
  if (vault.status.protectionReady === true && !resetFlowActive) return children;

  const submit = async (event) => {
    event.preventDefault();
    if (mutationPending.current || resetFlowActive) return;
    setFailure('');
    setFailureCode('');
    mutationPending.current = true;
    setBusy(true);
    try {
      const next = await requestSecurityVault(MESSAGE_ACTIONS.SEPARATE_SECURITY_VAULT_PROTECTION_KEYS, { passphrase });
      setPassphrase('');
      vault.publish(next);
    } catch (error) {
      const code = error.code || error.message;
      setFailureCode(code);
      setFailure(t(code === 'SECURITY_ENVELOPE_AUTHENTICATION_FAILED' || code.startsWith('SECURITY_PASSPHRASE_')
        ? 'security_vault.operation_failed' : 'security_vault.separate_failed'));
    } finally {
      mutationPending.current = false;
      setBusy(false);
    }
  };
  const retry = async () => {
    if (mutationPending.current || resetFlowActive) return;
    mutationPending.current = true;
    setBusy(true);
    try { await vault.refresh(); } catch { /* The shared controller exposes the owner failure. */ }
    finally { mutationPending.current = false; setBusy(false); }
  };
  const reset = async () => {
    if (mutationPending.current || (committedResetResponse === null && !confirmReset)) return;
    mutationPending.current = true;
    setResetRequested(true);
    onResetFlowRetentionChange?.(true);
    setBusy(true);
    setFailure('');
    setFailureCode('');
    let successfulResponse = committedResetResponse;
    try {
      if (successfulResponse === null) {
        const response = await sendSecurityRuntimeRequest({
          action: MESSAGE_ACTIONS.RESET_APP_DATA,
          authorization: { kind: 'passcode', passcode: pin },
        }, { timeoutMs: 60_000 });
        if (response?.success !== true) throw new Error('SECURITY_VAULT_RESET_FAILED');
        successfulResponse = response;
        setCommittedResetResponse(response);
        setPin('');
      }
      startProfileMutationResponseAck({ response: successfulResponse });
    } catch (error) {
      const code = typeof error?.code === 'string' && error.code.trim()
        ? error.code : error instanceof Error && error.message.trim()
          ? error.message : 'SECURITY_VAULT_RESET_FAILED';
      setFailureCode(code);
      setFailure(t(successfulResponse !== null ? 'security_vault.reset_handoff_failed'
        : code === 'RESET_AUTH_REQUIRED' || code === 'RESET_AUTH_FAILED'
          ? 'security_vault.reset_auth_failed' : 'security_vault.reset_failed'));
      mutationPending.current = false;
      setBusy(false);
      if (successfulResponse === null) {
        setResetRequested(false);
        onResetFlowRetentionChange?.(false);
      }
    }
  };
  const inputClass = 'w-full rounded-lg border border-border bg-surface px-3 py-2 text-on-surface';
  return (
    <DashboardSetupCanvas busy={busy || isWaiting || isSetup} presented={!isWaiting}
      title={t(resetFlowActive ? 'security_vault.reset' : isIncompatible ? 'security_vault.incompatible_title'
        : isSetup || isWaiting || isFailed ? 'security_vault.preparing_title' : 'security_vault.separate_title')}
      description={t(isIncompatible ? 'security_vault.incompatible_description'
        : isSetup || isWaiting || isFailed ? 'security_vault.preparing_description' : 'security_vault.separate_description')}>
        {isIncompatible ? <code className="mt-3 block break-all text-xs text-on-surface-muted">{vault.status.reason}</code> : null}
        {isChangedVaultSessionFailure(vault.status.reason) ? (
          <p role="alert" className="mt-3 text-sm">{t(vault.status.reason === 'SECURITY_VAULT_PASSPHRASE_REMOVAL_COMMIT_FAILED'
            ? 'security_vault.removal_unlock_required' : 'security_vault.changed_unlock_required')}</p>
        ) : null}
        {(isWaiting || isSetup) && !resetFlowActive ? <p role="status" className="mt-6">{t('status.loading')}</p> : null}
        {(isFailed || isSetup) && !resetFlowActive ? (
          <button type="button" disabled={busy} onClick={() => { void retry(); }}
            className="mt-6 rounded-lg border border-border px-4 py-2">
            {t('security_vault.retry')}
          </button>
        ) : null}
        {!resetFlowActive && vault.status.state === 'locked' ? (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block space-y-2 text-sm">
              <span>{t('security_vault.passphrase')}</span>
              <input required type="password" autoComplete="current-password"
                value={passphrase} disabled={busy} onChange={(event) => setPassphrase(event.target.value)} className={inputClass} />
            </label>
            <button disabled={busy} type="submit" className="w-full rounded-lg bg-accent px-4 py-3 font-semibold text-on-accent disabled:opacity-50">{t('security_vault.separate_action')}</button>
          </form>
        ) : null}
        {(resetFlowActive || isIncompatible || vault.status.state === 'locked') ? (
          <details className="mt-8 text-sm">
            <summary>{t('security_vault.reset_title')}</summary>
            {committedResetResponse !== null ? (
              <>
                <p role="status" className="mt-3 text-on-surface-muted">{t('security_vault.reset_committed')}</p>
                <button type="button" onClick={reset} disabled={busy}
                  className="mt-4 rounded-lg border border-border px-4 py-2 disabled:opacity-50">
                  {t(busy ? 'security_vault.reset_finishing' : 'security_vault.reset_retry_handoff')}
                </button>
              </>
            ) : (
              <>
                <p className="mt-3 text-on-surface-muted">{t('security_vault.reset_description')}</p>
                <label className="mt-4 block space-y-2">
                  <span>{t('security_vault.pin')}</span>
                  <input type="password" autoComplete="off" disabled={busy} value={pin}
                    onChange={(event) => setPin(event.target.value)} className={inputClass} />
                </label>
                <label className="mt-4 flex items-start gap-2">
                  <input type="checkbox" disabled={busy} checked={confirmReset}
                    onChange={(event) => setConfirmReset(event.target.checked)} />
                  <span>{t('security_vault.reset_confirmation')}</span>
                </label>
                <button type="button" onClick={reset} disabled={busy || !confirmReset}
                  className="mt-4 rounded-lg border border-danger px-4 py-2 text-danger disabled:opacity-50">
                  {t('security_vault.reset')}
                </button>
              </>
            )}
          </details>
        ) : null}
        {(failure || isFailed) ? <div role="alert" className="mt-4 text-sm text-danger">
          <p>{failure || t('security_vault.preparing_failed')}</p>
          {failureCode ? <code className="mt-2 block break-all text-xs">{failureCode}</code> : null}
          {isFailed && vault.error ? <code className="mt-2 block break-all text-xs">{vault.error.code || vault.error.message}</code> : null}
        </div> : null}
    </DashboardSetupCanvas>
  );
}
