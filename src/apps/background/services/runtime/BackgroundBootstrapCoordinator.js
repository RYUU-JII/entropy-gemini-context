import { createTrackingServiceBootstrap } from '../../../../domains/tracking/background/trackingServiceBootstrap.js';
import { formatErrorCauseChain } from '../../../../platform/diagnostics/runtimeDiagnosticConsole.js';
import { createBackgroundReadinessMilestone } from './support/BackgroundReadinessMilestone.js';
import { initializeTrustedLocalStorageAccess } from '../../../../platform/storage/security/StorageTrustCapability.js';
import { requireSecurityVaultStatus } from '../../../../platform/security/securityVaultStatusContract.js';

const FULL_INIT_GATE_FAILURE_CODES = Object.freeze({
  unavailable: 'BACKGROUND_FULL_INIT_EVENT_GATE_UNAVAILABLE',
  rejected: 'BACKGROUND_FULL_INIT_EVENT_GATE_REJECTED',
  profileMutationRejected: 'BACKGROUND_PROFILE_MUTATION_EVENT_ADMISSION_REJECTED',
  handlerFailed: 'BACKGROUND_FULL_INIT_EVENT_HANDLER_FAILED',
});

const POST_DASHBOARD_BOOT_STAGE_MILESTONES = Object.freeze({
  bookmark_sync: Object.freeze({ started: 'post_dashboard_bookmark_sync_started', settled: 'post_dashboard_bookmark_sync_settled' }),
  nudge_debt: Object.freeze({ started: 'post_dashboard_nudge_debt_started', settled: 'post_dashboard_nudge_debt_settled' }),
  pending_sweep: Object.freeze({ started: 'post_dashboard_pending_sweep_started', settled: 'post_dashboard_pending_sweep_settled' }),
  global_cap: Object.freeze({ started: 'post_dashboard_global_cap_started', settled: 'post_dashboard_global_cap_settled' }),
  global_cap_settings: Object.freeze({ started: 'post_dashboard_global_cap_settings_started', settled: 'post_dashboard_global_cap_settings_settled' }),
  global_cap_cap: Object.freeze({ started: 'post_dashboard_global_cap_cap_started', settled: 'post_dashboard_global_cap_cap_settled' }),
  global_cap_session_read: Object.freeze({ started: 'post_dashboard_global_cap_session_read_started', settled: 'post_dashboard_global_cap_session_read_settled' }),
  global_cap_session_write: Object.freeze({ started: 'post_dashboard_global_cap_session_write_started', settled: 'post_dashboard_global_cap_session_write_settled' }),
  global_cap_broadcast: Object.freeze({ started: 'post_dashboard_global_cap_broadcast_started', settled: 'post_dashboard_global_cap_broadcast_settled' }),
  global_cap_notification: Object.freeze({ started: 'post_dashboard_global_cap_notification_started', settled: 'post_dashboard_global_cap_notification_settled' }),
  alarm: Object.freeze({ started: 'post_dashboard_alarm_started', settled: 'post_dashboard_alarm_settled' }),
  idle: Object.freeze({ started: 'post_dashboard_idle_started', settled: 'post_dashboard_idle_settled' }),
  focused_prime: Object.freeze({ started: 'post_dashboard_focused_prime_started', settled: 'post_dashboard_focused_prime_settled' }),
  managed_catchup: Object.freeze({ started: 'post_dashboard_managed_catchup_started', settled: 'post_dashboard_managed_catchup_settled' }),
});

function serializeFullInitGateError(error) {
  return {
    name: error?.name || 'Error',
    message: error?.message || String(error || 'UNKNOWN_FULL_INIT_GATE_ERROR'),
  };
}

function requireFullInitEventLabel(value) {
  const label = typeof value === 'string' && value.trim() ? value.trim() : null;
  if (!label) throw new Error('BACKGROUND_FULL_INIT_EVENT_LABEL_REQUIRED');
  return label;
}

function requireFullInitEventTask(task) {
  if (typeof task !== 'function') {
    throw new Error('BACKGROUND_FULL_INIT_EVENT_TASK_REQUIRED');
  }
  return task;
}

export function createBackgroundBootstrapCoordinator(dependencies = {}) {
  const { initializeStorageTrust = initializeTrustedLocalStorageAccess, prepareSecurityVault, readSecurityVaultStatus } = dependencies;
  if (typeof initializeStorageTrust !== 'function') throw new Error('BACKGROUND_STORAGE_TRUST_OWNER_REQUIRED');
  if (typeof prepareSecurityVault !== 'function') throw new Error('BACKGROUND_SECURITY_VAULT_PREPARATION_OWNER_REQUIRED');
  if (typeof readSecurityVaultStatus !== 'function') throw new Error('BACKGROUND_SECURITY_VAULT_OWNER_REQUIRED');
  if (
    !dependencies.profileMutationRuntimeGate
    || typeof dependencies.profileMutationRuntimeGate.runAdmittedLocal !== 'function'
    || typeof dependencies.profileMutationRuntimeGate.capture !== 'function'
    || typeof dependencies.profileMutationRuntimeGate.runCaptured !== 'function'
  ) {
    throw new Error('BACKGROUND_BOOTSTRAP_PROFILE_MUTATION_RUNTIME_GATE_REQUIRED');
  }
  if (
    !dependencies.serviceWorkerWakeTelemetry
    || typeof dependencies.serviceWorkerWakeTelemetry.markMilestone !== 'function'
  ) {
    throw new Error('BACKGROUND_BOOTSTRAP_WAKE_TELEMETRY_REQUIRED');
  }
  const { serviceWorkerWakeTelemetry } = dependencies;
  const runProfileMutationAdmittedTask = (
    dependencies.profileMutationRuntimeGate.runAdmittedLocal.bind(
      dependencies.profileMutationRuntimeGate,
    )
  );
  const captureProfileMutationRuntimeAdmission = (
    dependencies.profileMutationRuntimeGate.capture.bind(
      dependencies.profileMutationRuntimeGate,
    )
  );
  const runCapturedProfileMutationRuntimeTask = (
    dependencies.profileMutationRuntimeGate.runCaptured.bind(
      dependencies.profileMutationRuntimeGate,
    )
  );
  const profileGenerationBootSettlement = createBackgroundReadinessMilestone({
    duplicateErrorCode: 'BACKGROUND_PROFILE_GENERATION_BOOT_SETTLEMENT_DUPLICATE',
  });
  const dashboardBootReadiness = createBackgroundReadinessMilestone({
    duplicateErrorCode: 'BACKGROUND_DASHBOARD_BOOT_READINESS_DUPLICATE',
  });

  let serviceStarted = false;
  let listenersRegistered = false;
  let initPending = false;
  let initFailed = false;
  let initPromise = null;
  let vaultBootstrapPaused = false;
  let fullInitEventSequence = 0;
  let fullInitEventTail = Promise.resolve();

  const recordFullInitGateDiagnostic = async ({ code, label, sequence, error }) => {
    const serializedError = serializeFullInitGateError(error);
    console.error(`[BackgroundFullInitGate] ${code}:${label}`, error);
    if (typeof dependencies.eventLogStore?.append !== 'function') return;
    try {
      const receipt = await dependencies.eventLogStore.append({
        id: `background-full-init-gate-${sequence}-${Date.now()}`,
        timestamp: Date.now(),
        type: 'background_full_init_event_gate_diagnostic',
        severity: 'error',
        code,
        label,
        sequence,
        error: serializedError,
      });
      if (receipt?.accepted === false && receipt.reason === 'data_locked') return;
      if (receipt?.accepted !== true) throw new Error('BACKGROUND_FULL_INIT_EVENT_DIAGNOSTIC_RECEIPT_INVALID');
    } catch (diagnosticError) {
      console.error(
        `[BackgroundFullInitGate] BACKGROUND_FULL_INIT_EVENT_DIAGNOSTIC_WRITE_FAILED:${label}`,
        diagnosticError,
      );
    }
  };

  function waitForFullInit({ label: rawLabel, task: rawTask } = {}) {
    const label = requireFullInitEventLabel(rawLabel);
    const task = requireFullInitEventTask(rawTask);
    const sequence = ++fullInitEventSequence;
    const admissionPromise = captureProfileMutationRuntimeAdmission({
      label: `browser_event:${label}`,
    });
    void admissionPromise.catch(() => undefined);
    const scheduled = fullInitEventTail.then(async () => {
      let admission;
      try {
        admission = await admissionPromise;
      } catch (error) {
        await recordFullInitGateDiagnostic({
          code: FULL_INIT_GATE_FAILURE_CODES.profileMutationRejected,
          label,
          sequence,
          error,
        });
        return {
          processed: false,
          code: FULL_INIT_GATE_FAILURE_CODES.profileMutationRejected,
        };
      }
      const ownedInitPromise = initPromise;
      if (!ownedInitPromise) {
        const error = new Error(FULL_INIT_GATE_FAILURE_CODES.unavailable);
        await recordFullInitGateDiagnostic({
          code: FULL_INIT_GATE_FAILURE_CODES.unavailable,
          label,
          sequence,
          error,
        });
        return { processed: false, code: FULL_INIT_GATE_FAILURE_CODES.unavailable };
      }

      try {
        await ownedInitPromise;
      } catch (error) {
        if (vaultBootstrapPaused) {
          return { processed: false, code: error.code };
        }
        await recordFullInitGateDiagnostic({
          code: FULL_INIT_GATE_FAILURE_CODES.rejected,
          label,
          sequence,
          error,
        });
        return { processed: false, code: FULL_INIT_GATE_FAILURE_CODES.rejected };
      }

      try {
        return {
          processed: true,
          value: await runCapturedProfileMutationRuntimeTask({
            admission,
            task,
          }),
        };
      } catch (error) {
        const code = String(error?.code || '').startsWith('PROFILE_MUTATION_RUNTIME_')
          ? FULL_INIT_GATE_FAILURE_CODES.profileMutationRejected
          : FULL_INIT_GATE_FAILURE_CODES.handlerFailed;
        await recordFullInitGateDiagnostic({
          code,
          label,
          sequence,
          error,
        });
        return { processed: false, code };
      }
    });
    fullInitEventTail = scheduled;
    return scheduled;
  }

  const trackingServiceBootstrap = createTrackingServiceBootstrap({
    ...dependencies,
    reportProfileGenerationBootSettled: (payload) => {
      serviceWorkerWakeTelemetry.markMilestone('profile_generation_boot_settled', {
        status: payload?.success === false ? 'failed' : 'ready',
        errorCode: payload?.error?.message || null,
      });
      return profileGenerationBootSettlement.report(payload);
    },
    reportDashboardBootReadReady: (payload) => {
      serviceWorkerWakeTelemetry.markMilestone('dashboard_boot_read_ready');
      return dashboardBootReadiness.report(payload);
    },
    reportPostDashboardBootStage: (stage, { phase, failed = false } = {}) => {
      if (!Object.hasOwn(POST_DASHBOARD_BOOT_STAGE_MILESTONES, stage)
        || !['started', 'settled'].includes(phase) || typeof failed !== 'boolean') {
        throw new Error('BACKGROUND_POST_DASHBOARD_BOOT_STAGE_INVALID');
      }
      return serviceWorkerWakeTelemetry.markMilestone(POST_DASHBOARD_BOOT_STAGE_MILESTONES[stage][phase], {
        status: failed ? 'failed' : 'ready',
      });
    },
    waitForFullInit,
    runProfileMutationAdmittedTask,
  });

  async function init() {
    vaultBootstrapPaused = false;
    initFailed = false;
    try {
      await initializeStorageTrust();
      try {
        await runProfileMutationAdmittedTask({
          label: 'security_vault_prepare',
          task: prepareSecurityVault,
        });
      } catch (error) {
        const code = typeof error?.code === 'string' ? error.code : error?.message;
        // Preparation has not admitted any key-dependent runtime owner yet.
        // An explicit status retry may finish storage preparation and resume
        // these same milestones, but a closed generation stays terminal.
        vaultBootstrapPaused = !(typeof code === 'string' && code.startsWith('PROFILE_MUTATION_RUNTIME_'));
        throw error;
      }
      const vaultStatus = requireSecurityVaultStatus(await readSecurityVaultStatus());
      if (!vaultStatus.protectionReady) {
        vaultBootstrapPaused = true;
        const code = Object.hasOwn(vaultStatus, 'reason')
          ? vaultStatus.reason
          : 'SECURITY_VAULT_' + vaultStatus.state.toUpperCase();
        const error = new Error(code);
        error.code = code;
        throw error;
      }
      vaultBootstrapPaused = false;
      const result = await trackingServiceBootstrap.init();
      if (profileGenerationBootSettlement.isPending()) {
        throw new Error('BACKGROUND_PROFILE_GENERATION_BOOT_SETTLEMENT_NOT_REPORTED');
      }
      if (dashboardBootReadiness.isPending()) {
        const error = new Error('BACKGROUND_DASHBOARD_BOOT_READINESS_NOT_REPORTED');
        throw error;
      }
      serviceWorkerWakeTelemetry.markMilestone('full_init_ready');
      return result;
    } catch (error) {
      if (vaultBootstrapPaused) throw error;
      if (profileGenerationBootSettlement.isPending()) {
        profileGenerationBootSettlement.report(Object.freeze({
          success: false,
          error: serializeFullInitGateError(error),
        }));
      }
      dashboardBootReadiness.reject(error);
      serviceWorkerWakeTelemetry.markMilestone('full_init_failed', {
        status: 'failed',
        errorCode: error?.code || error?.message,
      });
      throw error;
    }
  }

  function registerListeners() {
    if (listenersRegistered) {
      return { registered: true, reused: true };
    }
    try {
      trackingServiceBootstrap.registerListeners();
      listenersRegistered = true;
      serviceWorkerWakeTelemetry.markMilestone('sync_listeners_ready');
    } catch (error) {
      serviceWorkerWakeTelemetry.markMilestone('listener_registration_failed', {
        status: 'failed',
        errorCode: error?.code || error?.message,
      });
      throw error;
    }
    return { registered: true, reused: false };
  }

  function getInitPromise() {
    return initPending || initFailed || vaultBootstrapPaused ? initPromise : null;
  }

  function getDashboardBootReadinessPromise() {
    if (vaultBootstrapPaused) return initPromise;
    return dashboardBootReadiness.getPendingPromise();
  }

  function getProfileGenerationBootSettlementPromise() {
    if (vaultBootstrapPaused) return initPromise;
    return profileGenerationBootSettlement.getPromise();
  }

  function start() {
    if (serviceStarted && (!vaultBootstrapPaused || initPending)) {
      if (!listenersRegistered) registerListeners();
      return initPromise;
    }
    serviceStarted = true;
    serviceWorkerWakeTelemetry.markMilestone('bootstrap_started');
    initPending = true;
    initPromise = init()
      .catch((error) => {
        initFailed = !vaultBootstrapPaused;
        throw error;
      })
      .finally(() => {
        initPending = false;
      });
    void initPromise.catch((error) => {
      if (vaultBootstrapPaused) return;
      const message = typeof error?.message === 'string' && error.message.trim()
        ? error.message.trim()
        : String(error || 'BACKGROUND_STARTUP_FAILED');
      const causeChain = formatErrorCauseChain(error);
      console.error(
        `[Background] Startup failed: ${message}${causeChain ? ` cause=${causeChain}` : ''}`,
      );
    });
    registerListeners();
    return initPromise;
  }

  function resumeAfterVaultUnlock() {
    const task = Promise.resolve(initPromise).catch((error) => {
      if (!vaultBootstrapPaused) throw error;
    }).then(() => (vaultBootstrapPaused ? start() : initPromise));
    void task.catch((error) => console.error('[Background] Vault bootstrap resume failed.', error));
    return task;
  }

  return {
    init,
    registerListeners,
    getInitPromise,
    getDashboardBootReadinessPromise,
    getProfileGenerationBootSettlementPromise,
    waitForFullInit,
    resumeAfterVaultUnlock,
    start,
  };
}
