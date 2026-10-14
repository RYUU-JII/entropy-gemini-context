import { getHostname } from '../../../../lib/index.js';
import { isProtectionForegroundDispatchCancellation } from '../../../../domains/protection/background/protocol/dispatch/ProtectionForegroundDispatch.js';
import { normalizeDomain } from '../../../../lib/domain.js';
import { createProtectionRuntimeSnapshotEventEmitter } from '../../../../domains/protection/background/runtime/protectionRuntimeSnapshotEvents.js';
import { shouldSyncPrepaintVisualAfterBroadcast } from '../../../../domains/settings/config/settingsUpdateKeys.js';
import {
  requireSettingsPropagationContext,
  throwIfSettingsPropagationCancelled,
} from '../../../../domains/settings/contracts/settingsPropagationContext.js';
import {
  isProtectionTabUpdatedDispatchOutcome,
} from '../../../../domains/protection/background/protocol/dispatch/ProtectionTabUpdatedDispatchProtocol.js';
import {
  requireExpectedContentDocumentId,
  requireProtectionDispatchAbortSignal,
  throwIfProtectionDispatchAborted,
} from '../../../../domains/protection/background/protocol/dispatch/ProtectionDispatchTransport.js';

function resolveDispatcher(getProtectionDispatcher) {
  const dispatcher = typeof getProtectionDispatcher === 'function'
    ? getProtectionDispatcher()
    : null;
  if (!dispatcher) {
    throw new Error('PROTECTION_DISPATCHER_UNAVAILABLE');
  }
  return dispatcher;
}

function warnProtectionRuntimeBestEffortFailure(code, error, context = {}) {
  const payload = {
    code,
    ...context,
    error: error?.message || String(error || code),
  };
  if (error?.details && typeof error.details === 'object') {
    payload.details = error.details;
  }
  console.warn('[ProtectionRuntimeCoordinator] best-effort runtime step failed', payload);
}

function normalizeSnapshotTabId(tabId, fallbackTabId = null) {
  if (tabId === null || tabId === undefined || tabId === '') {
    return fallbackTabId;
  }
  const value = Number(tabId);
  return Number.isInteger(value) ? value : fallbackTabId;
}

function shouldSyncPrepaintAfterProtectionUpdateResult(result) {
  if (!result?.runtimeSnapshot) return false;
  if (result?.sendResult?.ok === true) return true;
  if (result?.skipped === 'unchanged_signature') return true;
  if (result?.handled === 'gate_interstitial') return true;
  return false;
}

async function readProtectionRuntimeTelemetryContext({
  trackingProtectionService,
  hostname,
  now,
} = {}) {
  if (
    !hostname
    || typeof trackingProtectionService?.getProtectionRuntimeTelemetryContext !== 'function'
  ) {
    return null;
  }
  try {
    return await trackingProtectionService.getProtectionRuntimeTelemetryContext({
      hostname,
      now,
    });
  } catch (error) {
    warnProtectionRuntimeBestEffortFailure('PROTECTION_RUNTIME_TELEMETRY_CONTEXT_READ_FAILED', error);
    return null;
  }
}

export function createProtectionRuntimeCoordinator({
  trackingProtectionService,
  getProtectionDispatcher,
  getActiveTabInfo,
  runProfileMutationAdmittedTask,
  clearFrictionBootstrapSnapshots = null,
  browserPort,
} = {}) {
  if (typeof runProfileMutationAdmittedTask !== 'function') {
    throw new Error('PROTECTION_RUNTIME_DETACHED_TASK_OWNER_REQUIRED');
  }
  const snapshotEventEmitter = createProtectionRuntimeSnapshotEventEmitter({ browserPort });
  let syncManagedContentScriptsForPrepaint = null;
  let prepaintSyncRequested = false;
  let latestPrepaintSyncReason = null;
  let prepaintSyncTask = null;

  function getProtectionRuntimeSnapshot({ hostname } = {}) {
    return trackingProtectionService.getProtectionRuntimeSnapshot({ hostname });
  }

  function getActiveProtectionRuntimeScope() {
    const activeInfo = typeof getActiveTabInfo === 'function'
      ? getActiveTabInfo()
      : null;
    return {
      hostname: normalizeDomain(activeInfo?.hostname || ''),
      tabId: Number.isInteger(Number(activeInfo?.tabId)) ? Number(activeInfo.tabId) : null,
    };
  }

  async function emitActiveProtectionRuntimeSnapshot({
    tabId = null,
    hostname = '',
    runtime = undefined,
    source = 'active_tab',
    now = Date.now(),
  } = {}) {
    const activeScope = getActiveProtectionRuntimeScope();
    const normalizedHostname = normalizeDomain(hostname || activeScope.hostname || '');
    const normalizedTabId = normalizeSnapshotTabId(tabId, activeScope.tabId);

    if (!Number.isInteger(activeScope.tabId) || activeScope.tabId < 0) {
      return false;
    }
    if (normalizedTabId !== activeScope.tabId) {
      return false;
    }

    const nextRuntime = runtime === undefined
      ? (normalizedHostname ? trackingProtectionService.getProtectionRuntimeSnapshot({ hostname: normalizedHostname }) : null)
      : runtime;

    const telemetryContext = nextRuntime?.telemetryContext
      || await readProtectionRuntimeTelemetryContext({
        trackingProtectionService,
        hostname: normalizedHostname,
        now,
      });

    return snapshotEventEmitter.emitProtectionRuntimeSnapshotUpdated({
      hostname: normalizedHostname,
      tabId: normalizedTabId,
      runtime: nextRuntime,
      telemetryContext,
      source,
    });
  }

  async function refreshProtectionRuntimeSnapshot({ hostname, now = Date.now() } = {}) {
    const runtime = await trackingProtectionService.refreshProtectionRuntimeSnapshot({ hostname, now });
    await emitActiveProtectionRuntimeSnapshot({
      hostname,
      runtime,
      now,
    });
    return runtime;
  }

  async function resolveProtectionRuntime(
    hostname,
    {
      now = Date.now(),
      filterSettings = null,
      capStateOverride = null,
      directTriggers = [],
      feedFlowSource = null,
      gateDetourSourceTabId = null,
      tabId = null,
      previousEnvelopeState = null,
      previousRevision = 0,
      forceSnapshot = false,
    } = {},
  ) {
    return trackingProtectionService.resolveProtectionRuntime(hostname, {
      now,
      filterSettings,
      capStateOverride,
      directTriggers,
      feedFlowSource,
      gateDetourSourceTabId,
      tabId,
      previousEnvelopeState,
      previousRevision,
      forceSnapshot,
    });
  }

  async function maybeTriggerProtectionNudge(
    tabId,
    url,
    {
      force = false,
      runtimeOverride = null,
      nowOverride = null,
      debugOverrides = null,
      foregroundSource,
    } = {},
  ) {
    const protectionDispatcher = resolveDispatcher(getProtectionDispatcher);
    const dispatchOptions = {
      force,
      runtimeOverride,
      nowOverride,
    };
    if (debugOverrides && typeof debugOverrides === 'object') {
      dispatchOptions.debugOverrides = debugOverrides;
    }
    if (typeof foregroundSource !== 'undefined') dispatchOptions.foregroundSource = foregroundSource;
    return protectionDispatcher.maybeTriggerProtectionNudge(tabId, url, dispatchOptions);
  }

  async function sendProtectionUpdate(
    tabId,
    url,
    {
      nowOverride = null,
      filterSettingsOverride = null,
      capStateOverride = null,
      directTriggersOverride = [],
      gateDetourSourceTabId = null,
      gatePresentationMode = 'blocking',
      skipSettingsEnsure = false,
      forceSnapshot = false,
      expectedDocumentId = null,
      abortSignal = null,
      tabUpdatedIngressReceipt,
      foregroundSource,
    } = {},
  ) {
    const expectedDispatchDocumentId = requireExpectedContentDocumentId(expectedDocumentId);
    const dispatchAbortSignal = requireProtectionDispatchAbortSignal(abortSignal);
    throwIfProtectionDispatchAborted(dispatchAbortSignal, 'coordinator_start');
    const protectionDispatcher = resolveDispatcher(getProtectionDispatcher);
    const dispatchOptions = {
      nowOverride,
      filterSettingsOverride,
      capStateOverride,
      directTriggersOverride,
      gateDetourSourceTabId,
      gatePresentationMode,
      skipSettingsEnsure,
      forceSnapshot,
      expectedDocumentId: expectedDispatchDocumentId,
      abortSignal: dispatchAbortSignal,
    };
    if (typeof tabUpdatedIngressReceipt !== 'undefined') {
      dispatchOptions.tabUpdatedIngressReceipt = tabUpdatedIngressReceipt;
    }
    if (typeof foregroundSource !== 'undefined') dispatchOptions.foregroundSource = foregroundSource;
    const result = await protectionDispatcher.sendProtectionUpdate(tabId, url, dispatchOptions);
    const tabUpdatedOutcome = isProtectionTabUpdatedDispatchOutcome(result) ? result : null;
    if (typeof tabUpdatedIngressReceipt !== 'undefined' && !tabUpdatedOutcome) {
      throw new Error('PROTECTION_TAB_UPDATED_DISPATCH_OUTCOME_REQUIRED');
    }
    if (isProtectionForegroundDispatchCancellation(result)) return result;
    if (tabUpdatedOutcome?.status === 'superseded') return tabUpdatedOutcome;
    const dispatchResult = tabUpdatedOutcome?.status === 'applied'
      ? tabUpdatedOutcome.dispatchResult
      : result;
    if (dispatchResult?.documentDisposition !== 'redirected') {
      throwIfProtectionDispatchAborted(dispatchAbortSignal, 'coordinator_dispatch_complete');
    }
    if (expectedDispatchDocumentId !== null) {
      return tabUpdatedOutcome === null ? dispatchResult : tabUpdatedOutcome;
    }
    if (
      typeof syncManagedContentScriptsForPrepaint === 'function'
      && shouldSyncPrepaintAfterProtectionUpdateResult(dispatchResult)
    ) {
      schedulePrepaintVisualContentScriptSync('prepaint_visual_after_dispatch');
    }
    await emitActiveProtectionRuntimeSnapshot({
      tabId,
      hostname: getHostname(url),
      runtime: dispatchResult?.runtimeSnapshot,
      now: nowOverride || Date.now(),
    });
    return tabUpdatedOutcome === null ? dispatchResult : tabUpdatedOutcome;
  }

  async function broadcastSettingsUpdate({ capStateOverride = null, changedKeys = null,
    propagationContext = null, nowOverride = null } = {}) {
    requireSettingsPropagationContext(propagationContext);
    throwIfSettingsPropagationCancelled(propagationContext, 'runtime_broadcast_start');
    let frictionBootstrapSnapshotsCleared = false;
    if (shouldSyncPrepaintVisualAfterBroadcast(changedKeys) && typeof clearFrictionBootstrapSnapshots === 'function') {
      try {
        await clearFrictionBootstrapSnapshots({ changedKeys });
        frictionBootstrapSnapshotsCleared = true;
      } catch (error) {
        throwIfSettingsPropagationCancelled(propagationContext, 'runtime_broadcast_snapshot_cleanup_cancelled');
        warnProtectionRuntimeBestEffortFailure('FRICTION_BOOTSTRAP_SNAPSHOT_CLEAR_FAILED', error);
      }
    }
    throwIfSettingsPropagationCancelled(propagationContext, 'runtime_broadcast_snapshots_cleared');
    const protectionDispatcher = resolveDispatcher(getProtectionDispatcher);
    const result = await protectionDispatcher.broadcastSettingsUpdate({
      capStateOverride, changedKeys, propagationContext, nowOverride,
    });
    throwIfSettingsPropagationCancelled(propagationContext, 'runtime_broadcast_dispatched');
    if (
      typeof syncManagedContentScriptsForPrepaint === 'function'
      && (frictionBootstrapSnapshotsCleared || shouldSyncPrepaintVisualAfterBroadcast(changedKeys))
    ) {
      await syncPrepaintVisualContentScriptsBestEffort('prepaint_visual_after_broadcast', propagationContext);
    }
    throwIfSettingsPropagationCancelled(propagationContext, 'runtime_broadcast_prepaint_settled');
    await emitActiveProtectionRuntimeSnapshot();
    throwIfSettingsPropagationCancelled(propagationContext, 'runtime_broadcast_completed');
    return result;
  }

  async function syncPrepaintVisualContentScriptsBestEffort(reason, propagationContext = null) {
    if (typeof syncManagedContentScriptsForPrepaint !== 'function') return;
    try {
      await syncManagedContentScriptsForPrepaint({
        injectOpenTabs: false,
        reason,
        ...(propagationContext ? { propagationContext } : {}),
      });
    } catch (error) {
      throwIfSettingsPropagationCancelled(propagationContext, 'runtime_broadcast_prepaint_cancelled');
      warnProtectionRuntimeBestEffortFailure(
        'PREPAINT_VISUAL_CONTENT_SCRIPT_SYNC_FAILED',
        error,
        { reason },
      );
    }
  }

  function schedulePrepaintVisualContentScriptSync(reason) {
    if (typeof syncManagedContentScriptsForPrepaint !== 'function') return false;
    prepaintSyncRequested = true;
    latestPrepaintSyncReason = reason;
    if (prepaintSyncTask) return true;

    let ownedTask;
    try {
      ownedTask = runProfileMutationAdmittedTask({
        label: 'protection_runtime:prepaint_registration_sync',
        task: async () => {
          for (let pass = 0; pass < 2 && prepaintSyncRequested; pass += 1) {
            prepaintSyncRequested = false;
            const passReason = latestPrepaintSyncReason;
            await syncPrepaintVisualContentScriptsBestEffort(passReason);
          }
        },
      });
    } catch (error) {
      prepaintSyncRequested = false;
      latestPrepaintSyncReason = null;
      warnProtectionRuntimeBestEffortFailure(
        'PREPAINT_VISUAL_CONTENT_SCRIPT_SYNC_ADMISSION_FAILED',
        error,
        { reason },
      );
      return false;
    }
    if (!ownedTask || typeof ownedTask.then !== 'function') {
      prepaintSyncRequested = false;
      latestPrepaintSyncReason = null;
      throw new Error('PROTECTION_RUNTIME_DETACHED_TASK_RESULT_INVALID');
    }
    prepaintSyncTask = ownedTask
      .catch((error) => {
        warnProtectionRuntimeBestEffortFailure(
          'PREPAINT_VISUAL_CONTENT_SCRIPT_SYNC_TASK_FAILED',
          error,
          { reason: latestPrepaintSyncReason || reason },
        );
      })
      .finally(() => {
        prepaintSyncTask = null;
        if (prepaintSyncRequested) {
          schedulePrepaintVisualContentScriptSync(latestPrepaintSyncReason || reason);
        } else {
          latestPrepaintSyncReason = null;
        }
      });
    return true;
  }

  function configureSettingsPipeline({
    settingsService,
    schedulePostCommitSettingsEffects,
    waitForPostCommitSettingsTask,
    syncManagedContentScripts,
    invalidateBootPrewarmSnapshot,
  } = {}) {
    syncManagedContentScriptsForPrepaint = syncManagedContentScripts;
    settingsService?.configureChangePipeline?.({
      schedulePostCommitSettingsEffects,
      waitForPostCommitSettingsTask,
      invalidateBootPrewarmSnapshot,
    });
  }

  return {
    getProtectionRuntimeSnapshot,
    refreshProtectionRuntimeSnapshot,
    resolveProtectionRuntime,
    maybeTriggerProtectionNudge,
    sendProtectionUpdate,
    broadcastSettingsUpdate,
    configureSettingsPipeline,
  };
}
