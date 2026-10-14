import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { MESSAGE_ACTIONS } from '../../../platform/messaging/messageTypes.js';
import { sendSecurityRuntimeRequest } from '../../shared/security/securityVaultClient.js';
import { startProfileMutationResponseAck } from '../bootstrap/profileMutationResponseAckClient.js';
import DashboardSetupCanvas from '../components/DashboardSetupCanvas.jsx';

const ProfileMutationContext = createContext(null);

export function useDashboardProfileMutationOwner() {
  const [state, setState] = useState({ phase: 'idle', kind: null, error: null });
  const receipt = useRef(null);
  const pending = useRef(false);
  const mutationKind = useRef(null);
  const acknowledge = useCallback(() => {
    if (pending.current || receipt.current === null) return;
    pending.current = true;
    setState({ phase: 'handing_off', kind: mutationKind.current, error: null });
    try { startProfileMutationResponseAck({ response: receipt.current }); }
    catch (error) { pending.current = false; setState({ phase: 'committed', kind: mutationKind.current, error }); }
  }, []);
  const request = useCallback(async (kind, message) => {
    if (pending.current || receipt.current !== null) throw new Error('DASHBOARD_PROFILE_MUTATION_ALREADY_PENDING');
    pending.current = true;
    mutationKind.current = kind;
    setState({ phase: 'pending', kind, error: null });
    try {
      const response = await sendSecurityRuntimeRequest(message, { timeoutMs: 60_000 });
      receipt.current = response;
      pending.current = false;
      acknowledge();
    } catch (error) {
      pending.current = false;
      mutationKind.current = null;
      setState({ phase: 'idle', kind: null, error });
      throw error;
    }
  }, [acknowledge]);
  const restore = useCallback(({ snapshot, backupPassphrase, authorization }) => request('restore', {
    action: MESSAGE_ACTIONS.IMPORT_STORAGE_SNAPSHOT, snapshot, mode: 'replace', backupPassphrase, authorization,
  }), [request]);
  const reset = useCallback(({ authorization }) => request('reset', {
    action: MESSAGE_ACTIONS.RESET_APP_DATA, authorization,
  }), [request]);
  return { state, restore, reset, acknowledge, active: state.phase !== 'idle', warnings: receipt.current?.warnings };
}

export function DashboardProfileMutationProvider({ controller, children }) {
  return <ProfileMutationContext.Provider value={controller}>{children}</ProfileMutationContext.Provider>;
}

export function useDashboardProfileMutationController() {
  const controller = useContext(ProfileMutationContext);
  if (controller === null) throw new Error('DASHBOARD_PROFILE_MUTATION_OWNER_REQUIRED');
  return controller;
}

export function DashboardProfileMutationHandoff({ controller }) {
  const { t } = useAppTranslation('common');
  const { phase, kind, error } = controller.state;
  const busy = phase !== 'committed';
  const resetting = kind === 'reset';
  return <DashboardSetupCanvas busy={busy} title={t(resetting ? 'security_vault.reset' : 'security_vault.restore')} description={t(resetting ? 'security_vault.reset_return_description' : 'security_vault.restore_local_description')}>
    <p role="status">{t(phase === 'pending' ? 'status.loading' : resetting ? 'security_vault.reset_committed' : 'security_vault.restored')}</p>
    {controller.warnings?.map((warning) => <code key={warning.code} className="mt-2 block break-all text-xs">{warning.code}</code>)}
    {error ? <div role="alert" className="mt-4 text-sm text-danger">
      <p>{t(resetting ? 'security_vault.reset_handoff_failed' : 'security_vault.restore_handoff_failed')}</p>
      <code className="mt-2 block break-all text-xs">{error.code || error.message}</code>
    </div> : null}
    <button type="button" disabled={busy} onClick={controller.acknowledge}
      className="mt-6 rounded-lg border border-border px-4 py-2 disabled:opacity-50">
      {t(busy ? 'security_vault.reset_finishing' : 'security_vault.reset_retry_handoff')}
    </button>
  </DashboardSetupCanvas>;
}
