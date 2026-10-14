import React, { useEffect, useId, useRef, useState } from 'react';

import { runtimeSendMessage } from '../../../platform/chrome/ChromeService.js';
import { MESSAGE_ACTIONS } from '../../../platform/messaging/messageTypes.js';
import { tDashboardRuntime as tRuntime } from '../../../domains/settings/i18n/dashboardRuntime.js';
import { ENTROPY_RUNTIME_BUILD_INFO } from '../../../platform/build/runtimeBuildInfo.js';
import {
  PROFILE_COMPATIBILITY_RECOVERY_ACTION,
  normalizeProfileCompatibilityRecovery,
} from '../../../platform/storage/model/ProfileCompatibilityContract.js';
import { startProfileMutationLifecycleAck, startProfileMutationResponseAck } from './profileMutationResponseAckClient.js';
import { normalizeSettingsProfileRecovery } from '../../../platform/storage/settings/SettingsProfileRecoveryContract.js';
import { reportDashboardBootRecoverySurfaceReady } from './bootEvents.js';

function resolveRecoveryBodyKey(status) {
  if (status === 'resetting') {
    return 'common:profile_mutation_recovery.resetting_body';
  }
  if (status === 'committed') {
    return 'common:profile_mutation_recovery.committed_body';
  }
  if (status === 'failed') {
    return 'common:profile_mutation_recovery.failed_body';
  }
  if (status === 'complete') {
    return 'common:profile_mutation_recovery.complete_body';
  }
  throw new Error(`DASHBOARD_PROFILE_MUTATION_RECOVERY_STATUS_INVALID:${status}`);
}

export default function DashboardProfileMutationRecovery({
  lifecycle = null,
  recovery = null,
  settingsRecovery = null,
} = {}) {
  const [passcode, setPasscode] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorCode, setErrorCode] = useState('');
  const [committedResponse, setCommittedResponse] = useState(null);
  const [handoffStarted, setHandoffStarted] = useState(false);
  const requestPending = useRef(false);
  const requestErrorId = useId();
  const normalizedRecovery = recovery === null
    ? null
    : normalizeProfileCompatibilityRecovery(recovery);
  const normalizedSettingsRecovery = settingsRecovery === null
    ? null
    : normalizeSettingsProfileRecovery(settingsRecovery);
  useEffect(() => {
    if (lifecycle !== null || recovery !== null || settingsRecovery !== null) {
      reportDashboardBootRecoverySurfaceReady('profile_recovery');
    }
  }, [lifecycle, recovery, settingsRecovery]);

  if ([lifecycle, normalizedRecovery, normalizedSettingsRecovery].filter((value) => value !== null).length > 1) {
    throw new Error('DASHBOARD_PROFILE_MUTATION_RECOVERY_OWNER_AMBIGUOUS');
  }
  if (lifecycle === null && normalizedRecovery === null && normalizedSettingsRecovery === null) {
    return <div className="h-full w-full bg-surface" />;
  }
  if (
    normalizedRecovery !== null
    && normalizedRecovery.recoveryAction !== PROFILE_COMPATIBILITY_RECOVERY_ACTION
  ) {
    throw new Error('DASHBOARD_PROFILE_COMPATIBILITY_RECOVERY_ACTION_INVALID');
  }

  const handleRecovery = async () => {
    if (requestPending.current) return;
    requestPending.current = true;
    let handoffDispatched = false;
    setBusy(true);
    setErrorCode('');
    try {
      if (committedResponse !== null) {
        startProfileMutationResponseAck({ response: committedResponse });
        handoffDispatched = true;
        setHandoffStarted(true);
        return;
      }
      if (lifecycle?.status === 'complete') {
        startProfileMutationLifecycleAck({
          lifecycle,
          onRejected: (error) => {
            requestPending.current = false;
            setHandoffStarted(false);
            setErrorCode(error.code);
          },
        });
        handoffDispatched = true;
        setHandoffStarted(true);
        return;
      }
      const request = {
        action: MESSAGE_ACTIONS.RESET_APP_DATA,
        authorization: {
          kind: 'passcode',
          passcode,
        },
      };
      if (lifecycle !== null) {
        request.profileMutationRecovery = {
          expectedResetId: lifecycle.resetId,
        };
      }
      const response = await runtimeSendMessage(request);
      if (response?.success !== true) {
        setErrorCode(String(response?.error || 'PROFILE_MUTATION_RECOVERY_FAILED'));
        return;
      }
      setCommittedResponse(response);
      startProfileMutationResponseAck({ response });
      handoffDispatched = true;
      setHandoffStarted(true);
    } catch (error) {
      setErrorCode(String(error?.code || error?.message || 'PROFILE_MUTATION_RECOVERY_FAILED'));
    } finally {
      if (!handoffDispatched) requestPending.current = false;
      setBusy(false);
    }
  };

  const lifecycleCode = normalizedSettingsRecovery?.failureCode || normalizedRecovery?.failureCode
    || lifecycle?.failureCode
    || `${lifecycle.operation}:${lifecycle.status}`;
  const bodyKey = committedResponse !== null
    ? 'common:profile_mutation_recovery.complete_body'
    : normalizedSettingsRecovery !== null
    ? 'common:profile_mutation_recovery.settings_reset_body'
    : normalizedRecovery === null
    ? resolveRecoveryBodyKey(lifecycle.status)
    : 'common:profile_mutation_recovery.contract_reset_body';
  const awaitsRuntimeHandoff = lifecycle?.status === 'complete' || committedResponse !== null;
  const requestFailureKey = errorCode === 'RESET_AUTH_REQUIRED' || errorCode === 'RESET_AUTH_FAILED'
    ? 'common:profile_mutation_recovery.auth_failed'
    : 'common:profile_mutation_recovery.request_failed';
  const observedBaseline = normalizedRecovery?.observedBaseline ?? 'legacy';
  const buildId = ENTROPY_RUNTIME_BUILD_INFO.buildId
    || tRuntime('common:error_boundary.unknown');

  return (
    <main data-dashboard-profile-recovery={normalizedSettingsRecovery !== null ? 'settings' : 'profile'} className="flex h-full min-h-screen w-full items-center justify-center bg-surface px-6 text-on-surface">
      <section className="w-full max-w-xl border border-border/70 bg-surface-elevated/80 p-8 shadow-2xl">
        <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
          {tRuntime('common:profile_mutation_recovery.eyebrow')}
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          {tRuntime('common:profile_mutation_recovery.title')}
        </h1>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          {tRuntime(bodyKey)}
        </p>
        <section aria-label={tRuntime('common:profile_mutation_recovery.diagnostics')}
          className="mt-5 border-y border-border/50 py-4 text-xs text-muted-foreground">
          <p className="font-medium text-on-surface">{tRuntime('common:profile_mutation_recovery.diagnostics')}</p>
          <dl className="mt-3 space-y-3">
            <div>
              <dt>{tRuntime('common:profile_mutation_recovery.lifecycle_code_label')}</dt>
              <dd className="mt-1"><code className="block break-all">{lifecycleCode}</code></dd>
            </div>
            {errorCode ? <div>
              <dt>{tRuntime('common:profile_mutation_recovery.request_code_label')}</dt>
              <dd className="mt-1"><code id={requestErrorId} className="block break-all text-danger">{errorCode}</code></dd>
            </div> : null}
          </dl>
          {normalizedSettingsRecovery !== null && (
            <p className="mt-2 break-all font-mono">
              {normalizedSettingsRecovery.documentKey}
              {normalizedSettingsRecovery.key === null ? '' : ` / ${normalizedSettingsRecovery.key}`}
            </p>
          )}
        </section>
        {normalizedRecovery !== null && (
          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-xs text-muted-foreground">
            <dt>{tRuntime('common:profile_mutation_recovery.baseline_label')}</dt>
            <dd className="font-mono text-on-surface">
              {String(observedBaseline)} → {String(normalizedRecovery.expectedBaseline)}
            </dd>
            <dt>{tRuntime('common:profile_mutation_recovery.reason_label')}</dt>
            <dd className="break-all font-mono text-on-surface">
              {normalizedRecovery.reason}
            </dd>
            <dt>{tRuntime('common:error_boundary.build_id')}</dt>
            <dd className="break-all font-mono text-on-surface">{buildId}</dd>
          </dl>
        )}

        {!awaitsRuntimeHandoff && (
          <>
            <label className="mt-6 block text-xs text-muted-foreground" htmlFor="profile-recovery-passcode">
              {tRuntime('common:profile_mutation_recovery.passcode_label')}
            </label>
            <input
              id="profile-recovery-passcode"
              className="mt-2 w-full border border-border bg-surface px-3 py-2 text-sm outline-hidden focus:border-foreground/50"
              type="password"
              value={passcode}
              onChange={(event) => setPasscode(event.target.value)}
              autoComplete="current-password"
            />
          </>
        )}

        {!awaitsRuntimeHandoff && errorCode && (
          <p role="alert" aria-describedby={requestErrorId} className="mt-4 text-xs text-danger">{tRuntime(requestFailureKey)}</p>
        )}

        {!awaitsRuntimeHandoff && (confirming ? (
          <div role="group" aria-label={tRuntime('common:profile_mutation_recovery.confirm_reset')} className="mt-6 border-t border-border/70 pt-5">
            <p className="text-sm leading-6 text-muted-foreground">
              {tRuntime('common:profile_mutation_recovery.confirm_body')}
            </p>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                className="border border-border px-4 py-2 text-sm"
                onClick={() => setConfirming(false)}
                disabled={busy}
              >
                {tRuntime('common:action.cancel')}
              </button>
              <button
                type="button"
                className="border border-danger/70 px-4 py-2 text-sm text-danger"
                onClick={handleRecovery}
                disabled={busy}
              >
                {tRuntime(busy
                  ? 'common:profile_mutation_recovery.recovering'
                  : 'common:profile_mutation_recovery.confirm_reset')}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="mt-6 border border-danger/70 px-4 py-2 text-sm text-danger"
            onClick={() => setConfirming(true)}
          >
            {tRuntime('common:profile_mutation_recovery.prepare_reset')}
          </button>
        ))}
        {awaitsRuntimeHandoff && !handoffStarted && (
          <div className="mt-6">
            {errorCode ? <p role="alert" aria-describedby={requestErrorId}
              className="text-sm text-danger">{tRuntime('common:profile_mutation_recovery.handoff_failed')}</p> : null}
            <button type="button" className="mt-4 border border-border px-4 py-2 text-sm" onClick={handleRecovery} disabled={busy}>
              {tRuntime('common:profile_mutation_recovery.retry_handoff')}
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
