import {
  keyedProtectionEffects,
  globalProtectionEffects,
  withSentinelProtocolHost,
} from './ProtectionRegistry.js';
import {
  updateFeedObservationHistory,
  stopFeedObservationHistory,
} from './runtime/feedObservationSidecar.js';
import behaviorHub, {
  BEHAVIOR_HUB_EVENTS,
} from '../../nudge/behavior/BehaviorHub.js';
import { BEHAVIOR_SIGNAL_TYPES } from '../../nudge/behavior/BehaviorJudge.js';
import { isEffectFeatureKey } from '../protocol/contracts/featureKeys.js';
import StatusIndicator from '../../nudge/visual/statusIndicator.js';
import {
  runtimeOnMessageAddListener,
  runtimeOnMessageRemoveListener,
  runtimeSendMessage,
} from '../../../platform/chrome/ChromeService.js';
import { MESSAGE_TYPES } from '../../../platform/messaging/messageTypes.js';
import { runtimeSendMessageReliable } from '../../../platform/messaging/runtime/runtimeMessaging.js';
import { formatProtectionEffectFailure, isNudgeMessage } from './ProtectionStateApplier.js';
import {
  SENTINEL_ENTRY_SEAM_COMMITS,
  SENTINEL_ENTRY_SEAM_PROTOCOLS,
  beginSentinelEntrySeam,
} from '../../nudge/runtime/nudgeEntrySeamGate.js';
import {
  SENTINEL_PROTOCOL_ENTRY_MODES,
  resolveSentinelProtocolEntryPolicy,
} from '../../nudge/runtime/sentinelProtocolEntryPolicy.js';
import {
  dismissSentinelPresageSignal,
  showSentinelPresageSignal,
} from '../../nudge/runtime/nudgePresageSignal.js';
import { isProtectionUpdateMessage } from './core/index.js';
import {
  ACTIVATION_ENGINE_ERRORS,
  resolveActivationPlan,
} from './runtime/ProtectionActivationEngine.js';
import {
  applyProtectionRuntimeEffectsCooperatively,
  clearProtectionRuntimeEffects,
} from './runtime/ProtectionFrictionModifierRuntime.js';
import {
  removeGlobalSentinelResidueOverlay,
  updateGlobalSentinelResidueOverlay,
} from './runtime/GlobalSentinelResidueOverlay.js';
import { suppressPrepaintVisualEffects } from './prepaintVisualRuntime.js';
import {
  recordProtectionEnvironmentProbe,
  recordProtectionRuntimeActivationApplied,
  recordProtectionRuntimeActivationAttempt,
} from './runtime/protectionRuntimeDiagnostics.js';
import {
  isFrictionDebugEnabled,
} from '@friction-debug-flags';
import { normalizeDebugConfig } from '../../settings/config/debugConfig.js';
import { handleBuildCapabilityContentMessage } from '@build-capability-content-relay';
import interventionAdmissionClient from '../../nudge/runtime/interventionAdmissionClient.js';
import { getVideoElementObserverForDocument } from '../../nudge/video/VideoElementObserver.js';
import { classifyFurinEntrySurface, FURIN_ENTRY_SURFACE_MODES, isSameFurinFeedEntrySurface } from '../../nudge/runtime/furinEntryBoundary.js';
import { markSentinelNudgeAborted } from '../../nudge/nudge/nudgeGameLifecycle.js';
import { requireGoalEpisodeBinding } from '../../nudge/runtime/goalEpisodeBinding.js';

let isProtectionRuntimeReceiverInstalled = false;
let areProtectionRuntimeSidecarsStarted = false;
let lastResyncRequestAt = 0;
let protectionRuntimeListener = null;
let protectionRuntimeSidecarEpoch = 0;
let protectionRuntimeReceiverEpoch = 0;
let runtimeDebuggerRequestEpoch = 0;
let visualEffectBridgeUnsubscribe = null;
let visualEffectBridgeAbort = null;
let runtimeDebuggerPromise = null;
let runtimeDebuggerForcedByProtection = false;
let extensionFrameWorkerProbePromise = null;
const RESYNC_REQUEST_COOLDOWN_MS = 1500;
const CONTENT_DEBUG_TOOLS_ENABLED = (
  typeof __ENTROPY_BUILD_INCLUDE_DEBUG_TOOLS__ !== 'undefined'
    ? __ENTROPY_BUILD_INCLUDE_DEBUG_TOOLS__
    : true
);

function recordProtectionControllerFailure(
  phase,
  error,
  { logMessage = '[ProtectionController] runtime marker failure' } = {},
) {
  const diagnostic = {
    phase,
    error: formatProtectionEffectFailure(error),
  };
  recordProtectionEnvironmentProbe(diagnostic);
  if (typeof console !== 'undefined') {
    console.warn?.(`${logMessage} phase=${phase} error=${diagnostic.error}`, diagnostic);
  }
}

function shouldOpenRuntimeDebuggerForProtection({
  isBlockedDomain = false,
  debugConfig = null,
} = {}) {
  const normalizedDebugConfig = normalizeDebugConfig(debugConfig);
  return !!isBlockedDomain
    && normalizedDebugConfig.enabled === true
    && normalizedDebugConfig.runtimeDebuggerEnabled === true;
}

async function getRuntimeDebugger({ force = false } = {}) {
  if (!CONTENT_DEBUG_TOOLS_ENABLED) {
    return { default: null };
  }
  if (!force) {
    if (!isFrictionDebugEnabled()) return { default: null };
  }
  runtimeDebuggerPromise ||= import('@runtime-debugger');
  return runtimeDebuggerPromise;
}

function getExtensionFrameWorkerProbe() {
  extensionFrameWorkerProbePromise ||= import('../../nudge/runtime/NudgeExtensionFrameWorkerProbe.js');
  return extensionFrameWorkerProbePromise;
}

function startRuntimeDebuggerSidecar() {
  if (!CONTENT_DEBUG_TOOLS_ENABLED) return;
  const epoch = protectionRuntimeSidecarEpoch;
  const requestEpoch = runtimeDebuggerRequestEpoch;
  void getRuntimeDebugger()
    .then(({ default: RuntimeDebugger }) => {
      if (epoch !== protectionRuntimeSidecarEpoch || requestEpoch !== runtimeDebuggerRequestEpoch) return;
      RuntimeDebugger?.arm?.();
    })
    .catch((error) => {
      console.error('[ProtectionController] Failed to start runtime debugger.', error);
    });
}

function updateRuntimeDebuggerSidecar(state = {}) {
  if (!CONTENT_DEBUG_TOOLS_ENABLED) return;
  const requestEpoch = ++runtimeDebuggerRequestEpoch;
  const shouldOpen = shouldOpenRuntimeDebuggerForProtection(state);
  if (shouldOpen) {
    runtimeDebuggerForcedByProtection = true;
    const epoch = protectionRuntimeSidecarEpoch;
    void getRuntimeDebugger({ force: true })
      .then(({ default: RuntimeDebugger }) => {
        if (epoch !== protectionRuntimeSidecarEpoch || requestEpoch !== runtimeDebuggerRequestEpoch) return;
        RuntimeDebugger?.arm?.({ force: true, open: true });
      })
      .catch((error) => {
        console.error('[ProtectionController] Failed to update runtime debugger.', error);
      });
    return;
  }

  if (!runtimeDebuggerForcedByProtection || !runtimeDebuggerPromise) return;
  runtimeDebuggerForcedByProtection = false;
  void runtimeDebuggerPromise
    .then(({ default: RuntimeDebugger }) => {
      if (requestEpoch !== runtimeDebuggerRequestEpoch) return;
      if (typeof RuntimeDebugger?.releaseForcedArm !== 'function') {
        throw new Error('RUNTIME_DEBUGGER_FORCE_RELEASE_UNAVAILABLE');
      }
      RuntimeDebugger.releaseForcedArm();
    })
    .catch((error) => {
      console.error('[ProtectionController] Failed to teardown runtime debugger.', error);
    });
}

function teardownRuntimeDebuggerSidecar() {
  if (!runtimeDebuggerPromise) return;
  return runtimeDebuggerPromise
    .then(({ default: RuntimeDebugger }) => {
      return RuntimeDebugger?.teardown?.();
    })
    .catch((error) => {
      console.error('[ProtectionController] Failed to teardown runtime debugger.', error);
      throw error;
    });
}

function startVisualEffectBridge() {
  if (visualEffectBridgeUnsubscribe) return;
  const epoch = protectionRuntimeSidecarEpoch;
  const abort = new AbortController();
  visualEffectBridgeAbort = abort;
  visualEffectBridgeUnsubscribe = behaviorHub.subscribe(
    BEHAVIOR_HUB_EVENTS.BEHAVIOR_SIGNAL,
    (signal) => {
      if (epoch !== protectionRuntimeSidecarEpoch || signal?.type !== BEHAVIOR_SIGNAL_TYPES.PLAY_EFFECT) return;
      void import('../../nudge/effects/VisualEffectManager.js')
        .then(({ default: VisualEffectManager }) => {
          if (epoch !== protectionRuntimeSidecarEpoch) return;
          return VisualEffectManager.play(signal?.context?.effectType, { signal: abort.signal });
        })
        .catch((error) => {
          console.error('[ProtectionController] Failed to load visual effect manager.', error);
        });
    },
  );
}

function stopVisualEffectBridge() {
  visualEffectBridgeAbort?.abort();
  visualEffectBridgeAbort = null;
  if (visualEffectBridgeUnsubscribe) {
    visualEffectBridgeUnsubscribe();
    visualEffectBridgeUnsubscribe = null;
  }
}

let pendingNudgeEntrySeam = null;
let pendingNudgeEntrySeamMode = null;
let pendingNudgeEntrySeamRunId = null;

function cancelPendingNudgeEntrySeam(reason = 'entry_cancelled') {
  pendingNudgeEntrySeam?.cancel(reason);
  pendingNudgeEntrySeam = null;
  pendingNudgeEntrySeamMode = null;
  pendingNudgeEntrySeamRunId = null;
}

function buildDebugControlBlockedOutcome() {
  return {
    ok: false,
    phase: 'rejected',
    rejectReason: 'debug_control_blocked_by_production',
    error: 'debug_control_blocked_by_production',
  };
}

function isProductionEntrySeamPending() {
  return !!pendingNudgeEntrySeam && pendingNudgeEntrySeamMode === 'auto';
}

async function withDebugNudgeMutationAdmission(mutate, assertCurrent) {
  if (isProductionEntrySeamPending()) {
    return buildDebugControlBlockedOutcome();
  }
  return withSentinelProtocolHost((host) => {
    assertCurrent();
    if (host.hasLifecycleOwnership() && host.getMode() !== 'debug') {
      return buildDebugControlBlockedOutcome();
    }
    return mutate(host);
  });
}

function recordNudgeEntrySeamDiagnostic(phase, details = {}) {
  recordProtectionEnvironmentProbe({
    phase,
    protocolScope: details.protocolScope || '',
    committedBy: details.committedBy || '',
    commitReason: details.commitReason || '',
    eventType: details.eventType || '',
    waitedMs: Number.isFinite(Number(details.waitedMs)) ? Math.max(0, Math.round(Number(details.waitedMs))) : 0,
  });
}

function resolveNudgeStartFailure(startResult = null) {
  if (startResult?.ok !== false) return '';
  return String(
    startResult.error
    || startResult.rejectReason
    || startResult.phase
    || 'NUDGE_START_REJECTED',
  );
}

function respondToNudgeStart(sendResponse, startResult = null) {
  const error = resolveNudgeStartFailure(startResult);
  if (!error) {
    sendResponse?.(startResult?.phase === 'entry_waiting'
      ? { ok: true, phase: 'entry_waiting', runId: startResult.runId }
      : { ok: true });
    return;
  }
  sendResponse?.({
    ok: false,
    phase: startResult?.phase || 'rejected',
    startResult,
    error,
  });
}

// Feed goals use the shared Horizon owner. Non-feed goals consume a prepared
// permit on a classified native action; neither timers nor media controls open Furin.
async function startSentinelProtocolHostAtEntrySeam(startSentinelProtocolHost, cfg, reason, runId = null, key = null, goalBinding = null) {
  if (reason === 'debug' && isProductionEntrySeamPending()) {
    return buildDebugControlBlockedOutcome();
  }
  const entryPolicy = resolveSentinelProtocolEntryPolicy({
    config: cfg,
    reason,
  });
  if (entryPolicy.mode === SENTINEL_PROTOCOL_ENTRY_MODES.IMMEDIATE) {
    cancelPendingNudgeEntrySeam();
    return startSentinelProtocolHost();
  }
  if (pendingNudgeEntrySeam && reason === 'auto') {
    return pendingNudgeEntrySeamRunId === runId
      ? { ok: true, phase: 'entry_waiting', runId }
      : { ok: false, rejectReason: 'production_entry_owned' };
  }
  cancelPendingNudgeEntrySeam();
  if (entryPolicy.mode === SENTINEL_PROTOCOL_ENTRY_MODES.INTEGRATED_RITUAL) {
    recordNudgeEntrySeamDiagnostic(
      entryPolicy.diagnostic.phase,
      entryPolicy.diagnostic,
    );
    return startSentinelProtocolHost(entryPolicy.startConfig);
  }
  if (typeof runId !== 'string' || !runId || typeof key !== 'string' || !key) {
    throw new Error('FURIN_ENTRY_RUN_IDENTITY_REQUIRED');
  }
  const binding = requireGoalEpisodeBinding(goalBinding);
  if (binding.key !== key || binding.runId !== runId
    || binding.purpose !== (cfg.protocolScope === 'global' ? 'global_goal' : 'site_goal')) throw new Error('FURIN_ENTRY_GOAL_BINDING_MISMATCH');
  const kind = cfg.protocolScope === 'global' ? 'global_sentinel' : 'site_furin';
  let seam = null;
  let coordinator = null;
  let ended = false;
  let handedOff = false;
  let entryLease = null;
  let cancelStartedHost = null;
  const retainStartingHost = host => {
    if (ended) throw new Error('FURIN_ENTRY_OWNER_ENDED');
    cancelStartedHost = () => {
      if (host.hasLifecycleOwnership() && host.getMode() === 'auto' && host.getRunId() === runId) host.stop();
    };
  };
  const videoElementObserver = getVideoElementObserverForDocument(document);
  const releaseInventory = videoElementObserver.subscribeMediaMutations({
    synchronousInitialInventory: true,
    debugLabel: 'ProtectionController.furinEntry',
    onMutation() {},
  });
  const readSurface = () => classifyFurinEntrySurface(document, { mediaSnapshot: videoElementObserver.getMediaSnapshot() });
  const clearPending = () => {
    if (pendingNudgeEntrySeam !== owner) return;
    pendingNudgeEntrySeam = null;
    pendingNudgeEntrySeamMode = null;
    pendingNudgeEntrySeamRunId = null;
  };
  const finish = (endReason, { abort = true } = {}) => {
    if (ended) return;
    if (abort) cancelStartedHost?.();
    releaseInventory();
    ended = true;
    clearPending();
    if (!abort) return;
    const result = markSentinelNudgeAborted({ activeNudgeKey: key, activeNudgeRunId: runId,
      mode: 'auto', reason: endReason });
    void result.lifecycleSendPromise?.catch(error => recordProtectionControllerFailure('nudge_entry_abort', error));
  };
  const owner = { cancel(endReason) {
    seam?.cancel();
    coordinator?.cancelGoalEntry(endReason, { runId });
    interventionAdmissionClient.cancelPending({ kind, source: 'furin_entry_action' });
    if (!cancelStartedHost && entryLease && interventionAdmissionClient.currentLease(kind) === entryLease) {
      interventionAdmissionClient.release(entryLease, endReason);
    }
    finish(endReason);
  } };
  pendingNudgeEntrySeam = owner;
  pendingNudgeEntrySeamMode = 'auto';
  pendingNudgeEntrySeamRunId = runId;
  try {
    const surface = readSurface();
    if (surface.mode === FURIN_ENTRY_SURFACE_MODES.FEED_REQUIRED) {
      ({ default: coordinator } = await import('../../nudge/feed-flow/FeedBoundaryEpisodeCoordinator.js'));
      if (ended) return { ok: false, rejectReason: 'entry_cancelled' };
      const result = coordinator.requestGoalEntry({ kind, purpose: kind === 'site_furin' ? 'site_goal' : 'global_goal', runId, goalBinding: binding,
        onCancelled: endReason => finish(endReason),
        onContinue: async handoff => {
          if (ended || !isSameFurinFeedEntrySurface(surface, readSurface())) {
            return { ok: false, rejectReason: 'entry_surface_changed' };
          }
          const startResult = await startSentinelProtocolHost({ ...entryPolicy.startConfig, __entryHandoff: handoff }, retainStartingHost);
          if (ended) return { ok: false, rejectReason: 'entry_cancelled' };
          if (startResult?.ok === true) { handedOff = true; finish('furin_handoff', { abort: false }); }
          return startResult;
        },
      });
      if (result.ok !== true) finish(result.rejectReason);
      return result;
    }
    if (surface.mode !== FURIN_ENTRY_SURFACE_MODES.ACTION_BOUNDARY) {
      finish(surface.reason);
      return { ok: false, rejectReason: surface.reason };
    }
    const scope = { kind, source: 'furin_entry_action', manual: false, goalBinding: binding };
    const permission = await interventionAdmissionClient.prepare(scope);
    if (permission.accepted) entryLease = permission.lease;
    if (ended || !permission.accepted) {
      if (permission.accepted) interventionAdmissionClient.release(permission.lease, 'entry_cancelled');
      const rejectReason = ended ? 'entry_cancelled' : permission.reason;
      finish(rejectReason);
      return { ok: false, rejectReason };
    }
    seam = beginSentinelEntrySeam({ ...entryPolicy.seamOptions, presage: false, capMs: 5_000, idleMs: 5_000,
      getBoundaryEvidence: () => ({ surface: readSurface(),
        getMediaSnapshot: () => videoElementObserver.getMediaSnapshot(),
        consumePreparedPermit: () => interventionAdmissionClient.tryReserve(scope) }),
    });
    void seam.settled.then(async result => {
      recordNudgeEntrySeamDiagnostic('nudge_entry_seam_commit', result);
      if (ended) return;
      if (result.committedBy !== SENTINEL_ENTRY_SEAM_COMMITS.BOUNDARY) {
        interventionAdmissionClient.cancelPending(scope);
        finish(result.commitReason);
        return;
      }
      const lease = result.boundaryProof.lease;
      const startResult = await startSentinelProtocolHost({ ...entryPolicy.startConfig,
        __entryHandoff: { kind, source: scope.source, leaseId: lease.leaseId } }, retainStartingHost);
      if (ended) return;
      if (startResult?.ok !== true) {
        finish(resolveNudgeStartFailure(startResult));
        if (interventionAdmissionClient.currentLease(kind) === lease) interventionAdmissionClient.release(lease, 'entry_start_failed');
        return;
      }
      handedOff = true;
      finish('furin_handoff', { abort: false });
    }).catch(error => {
      if (!ended) interventionAdmissionClient.cancelPending(scope);
      recordProtectionControllerFailure('nudge_entry_seam_start', error);
      finish('entry_start_failed');
      if (entryLease && interventionAdmissionClient.currentLease(kind) === entryLease) {
        interventionAdmissionClient.release(entryLease, 'entry_start_failed');
      }
    }).finally(() => seam.release());
    recordNudgeEntrySeamDiagnostic('nudge_entry_seam_armed', entryPolicy.seamOptions);
    return { ok: true, phase: 'entry_waiting', runId };
  } catch (error) {
    if (!handedOff) owner.cancel('entry_failed');
    recordProtectionControllerFailure('nudge_entry_seam_start', error);
    throw error;
  }
}

function resolveNudgePresageSignalOptions(request = {}) {
  const payload = request.payload || {};
  const cfg = payload.config || {};
  const protocolProfile = payload.protocolProfile || {};
  const presage = payload.presage || cfg.presage || null;
  return {
    protocolScope: cfg.protocolScope || protocolProfile.protocolScope || SENTINEL_ENTRY_SEAM_PROTOCOLS.SITE,
    protocolIntensity: cfg.protocolIntensity || protocolProfile.protocolIntensity || 0.62,
    count: presage?.count || 1,
    presageConfig: presage || cfg.presage || null,
  };
}

function handleNudgeMessage(request, sendResponse) {
  if (!isNudgeMessage(request, { includeDebug: CONTENT_DEBUG_TOOLS_ENABLED })) return false;
  const epoch = protectionRuntimeReceiverEpoch;
  const assertCurrent = () => {
    if (epoch !== protectionRuntimeReceiverEpoch || !isProtectionRuntimeReceiverInstalled) {
      throw new Error('PROTECTION_RECEIVER_OPERATION_CANCELLED');
    }
  };
  const withCurrentHost = (callback) => withSentinelProtocolHost((host) => {
    assertCurrent();
    return callback(host);
  });
  const withCurrentDebugHost = (callback) => withDebugNudgeMutationAdmission(callback, assertCurrent);

  Promise.resolve().then(async () => {
    assertCurrent();
    const runtimeContext = request.payload?.runtimeContext || null;
    if (request.type === MESSAGE_TYPES.NUDGE_PRESAGE) {
      await showSentinelPresageSignal(resolveNudgePresageSignalOptions(request));
    } else if (request.type === MESSAGE_TYPES.NUDGE_START) {
      const cfg = request.payload?.config || {};
      const startReason = 'auto';
      const candidateObservedAt = Date.now();
      // Admission precedes the attention seam: an automatic trigger must not
      // arm a delayed replacement underneath an operator-owned QA session.
      const debugSessionActive = await withCurrentHost((host) => (
        host.hasLifecycleOwnership() && host.getMode() === 'debug'
      ));
      assertCurrent();
      if (debugSessionActive) {
        respondToNudgeStart(sendResponse, {
          ok: false,
          phase: 'rejected',
          rejectReason: 'production_control_blocked_by_debug',
        });
        return;
      }
      const startResult = await startSentinelProtocolHostAtEntrySeam((entryConfig = cfg, retainHost = null) => withCurrentHost((host) => {
        retainHost?.(host);
        return host.start({
          ...entryConfig,
          __mode: startReason,
          __nudgeKey: request.payload?.key,
          __nudgeRunId: request.payload?.runId,
          __candidateObservedAt: candidateObservedAt,
          __goalBinding: request.payload.goalBinding,
          __runtimeContext: runtimeContext,
        });
      }), cfg, startReason, request.payload?.runId, request.payload?.key, request.payload?.goalBinding);
      respondToNudgeStart(sendResponse, startResult);
      return;
    } else if (request.type === MESSAGE_TYPES.NUDGE_STOP) {
      // Production tab/blur teardown owns auto sessions. Debug realization has
      // its own explicit STOP transport and must survive an operator handoff.
      const stopResult = await withCurrentHost(async (host) => {
        const runIds = request.payload?.runIds;
        if (!Array.isArray(runIds) || runIds.some(id => typeof id !== 'string' || !id)) {
          return { ok: false, error: 'NUDGE_STOP_RUN_IDS_INVALID' };
        }
        const ownsDebugHost = host.hasLifecycleOwnership() && host.getMode() === 'debug';
        const matchesHost = !ownsDebugHost && runIds.includes(host.getRunId());
        const matchesPending = runIds.includes(pendingNudgeEntrySeamRunId);
        if (!matchesHost && !matchesPending) {
          return { ok: true, stopped: false, cleaned: true, runIds,
            reason: ownsDebugHost ? 'debug_session_owned' : 'stale_stop' };
        }
        if (matchesPending) cancelPendingNudgeEntrySeam();
        dismissSentinelPresageSignal({ immediate: true });
        if (matchesHost) await host.stop();
        return { ok: true, stopped: true, cleaned: true, runIds };
      });
      sendResponse?.(stopResult);
      return;
    } else if (CONTENT_DEBUG_TOOLS_ENABLED && request.type === MESSAGE_TYPES.NUDGE_DEBUG_START) {
      const cfg = request.payload?.config || {};
      const nextRuntimeContext = request.payload?.runtimeContext || runtimeContext;
      const startResult = await startSentinelProtocolHostAtEntrySeam((entryConfig = cfg) => withCurrentHost((host) => host.start({
        ...entryConfig,
        __mode: 'debug',
        __runtimeContext: nextRuntimeContext,
      })), cfg, 'debug');
      if (startResult?.ok !== false) {
        dismissSentinelPresageSignal({ immediate: true });
      }
      respondToNudgeStart(sendResponse, startResult);
      return;
    } else if (CONTENT_DEBUG_TOOLS_ENABLED && request.type === MESSAGE_TYPES.NUDGE_DEBUG_CONFIG) {
      const nextRuntimeContext = request.payload?.runtimeContext || runtimeContext;
      const configResult = await withCurrentDebugHost((host) => {
        if (nextRuntimeContext) {
          host.setRuntimeContext(nextRuntimeContext);
        }
        host.setConfig(request.payload?.config);
        return { ok: true };
      });
      sendResponse?.(configResult);
      return;
    } else if (CONTENT_DEBUG_TOOLS_ENABLED && request.type === MESSAGE_TYPES.NUDGE_DEBUG_SPAWN) {
      const spawnResult = await withCurrentDebugHost((host) => host.spawnDebug({
        config: request.payload?.config || {},
        runtimeContext: request.payload?.runtimeContext || runtimeContext,
        runtimeHost: request.payload?.runtimeHost || null,
        spawnHint: request.payload?.spawnHint || null,
      }));
      sendResponse?.({
        ok: spawnResult?.ok === true,
        phase: spawnResult?.phase || null,
        spawnResult,
        error: spawnResult?.ok === true ? null : (spawnResult?.rejectReason || spawnResult?.phase || 'SPAWN_NOT_RENDERED'),
      });
      return;
    } else if (CONTENT_DEBUG_TOOLS_ENABLED && request.type === MESSAGE_TYPES.NUDGE_DEBUG_SNAPSHOT) {
      const snapshotResult = await withCurrentDebugHost((host) => ({
        ok: true,
        active: host.isActive(),
        mode: host.getMode(),
        snapshot: host._debugGetRuntimeSnapshot(),
      }));
      sendResponse?.(snapshotResult);
      return;
    } else if (CONTENT_DEBUG_TOOLS_ENABLED && request.type === MESSAGE_TYPES.NUDGE_DEBUG_STOP) {
      const stopResult = await withCurrentDebugHost(async (host) => {
        if (!host.hasLifecycleOwnership()) return { ok: true, stopped: false };
        await host.stop();
        return { ok: true, stopped: true };
      });
      sendResponse?.(stopResult);
      return;
    } else if (CONTENT_DEBUG_TOOLS_ENABLED && request.type === MESSAGE_TYPES.NUDGE_DEBUG_WORKER_PROBE) {
      const workerProbe = await withCurrentHost((host) => host.probeWorkerAdmission({
        config: request.payload?.config || {},
        runtimeContext: request.payload?.runtimeContext || runtimeContext,
        timeoutMs: request.payload?.timeoutMs,
      }));
      sendResponse?.({
        ok: workerProbe?.ok === true,
        phase: workerProbe?.phase || null,
        workerProbe,
        error: workerProbe?.ok === true ? null : (workerProbe?.error || workerProbe?.phase || 'WORKER_PROBE_FAILED'),
      });
      return;
    } else if (CONTENT_DEBUG_TOOLS_ENABLED && request.type === MESSAGE_TYPES.NUDGE_DEBUG_FRAME_WORKER_PROBE) {
      const { runNudgeExtensionFrameWorkerProbe } = await getExtensionFrameWorkerProbe();
      assertCurrent();
      const frameWorkerProbe = await runNudgeExtensionFrameWorkerProbe({
        durationMs: request.payload?.durationMs,
        timeoutMs: request.payload?.timeoutMs,
        renderMode: request.payload?.renderMode,
        config: request.payload?.config || {},
        runtimeContext: request.payload?.runtimeContext || runtimeContext,
      });
      sendResponse?.({
        ok: frameWorkerProbe?.ok === true,
        phase: frameWorkerProbe?.phase || null,
        frameWorkerProbe,
        error: frameWorkerProbe?.ok === true
          ? null
          : (frameWorkerProbe?.error || frameWorkerProbe?.phase || 'FRAME_WORKER_PROBE_FAILED'),
      });
      return;
    }
    sendResponse?.({ ok: true });
  }).catch((e) => {
    sendResponse?.({ ok: false, error: String(e?.message || e) });
  });

  return true;
}

/**
 * Protection Controller
 *
 * Orchestrates protection plans through the protection effect registry.
 */

async function handleProtectionUpdateMessage(request, sendResponse, receiverEpoch) {
  const receivedAt = isFrictionDebugEnabled() ? performance.now() : null;
  if (CONTENT_DEBUG_TOOLS_ENABLED) {
    console.debug(
      '[ProtectionController] Message Received:',
      request.type || request.action || 'Unknown',
      {
        traceId: request?.envelope?.trace?.traceId || request?.trace?.traceId || null,
        request,
      },
    );
  }

  const activationPlan = resolveActivationPlan(request);
  const { activationState, shouldActivate } = activationPlan;
  const traceId = activationState?.envelope?.trace?.traceId
    || request?.envelope?.trace?.traceId
    || null;
  const isReceiverCurrent = () => isProtectionRuntimeReceiverInstalled
    && receiverEpoch === protectionRuntimeReceiverEpoch;
  const respondIfReceiverCancelled = () => {
    if (isReceiverCurrent()) return false;
    sendResponse?.({
      ok: false,
      error: 'PROTECTION_RECEIVER_OPERATION_CANCELLED',
      source: activationPlan.source,
      traceId,
      superseded: true,
    });
    return true;
  };
  const activeFilterKeys = Object.entries(activationPlan.filters || {})
    .filter(([key, config]) => isEffectFeatureKey(key) && config?.isActive)
    .map(([key]) => key);
  recordProtectionRuntimeActivationAttempt({
    source: activationPlan.source,
    shouldActivate,
    shouldClear: activationPlan.shouldClear,
    shouldMutate: activationPlan.shouldMutate,
    error: activationPlan.error,
    staleIgnored: activationState.isStale === true,
    staleReason: activationState.staleReason,
    needsResync: activationState.needsResync === true,
    resyncReason: activationState.resyncReason,
    domainClassId: activationPlan.domainClassId,
    traceId,
    expectedBaseRevision: activationState.expectedBaseRevision,
    receivedBaseRevision: activationState.receivedBaseRevision
      ?? request?.envelope?.baseRevision,
    expectedRevision: activationState.expectedRevision,
    receivedRevision: activationState.receivedRevision
      ?? request?.envelope?.revision,
  });

  if (activationState.needsResync) {
    const now = Date.now();
    if ((now - lastResyncRequestAt) >= RESYNC_REQUEST_COOLDOWN_MS) {
      lastResyncRequestAt = now;
      runtimeSendMessage({
        type: MESSAGE_TYPES.PROTECTION_RESYNC_REQUEST,
        payload: {
          reason: activationState.resyncReason || 'PATCH_APPLY_FAILED',
          expectedBaseRevision: activationState.expectedBaseRevision,
          receivedBaseRevision: activationState.receivedBaseRevision,
          source: 'content_protection_controller',
          traceId,
        },
      }).catch((error) => {
        console.error('[ProtectionController] Failed to request protection resync.', error, {
          reason: activationState.resyncReason || 'PATCH_APPLY_FAILED',
          expectedBaseRevision: activationState.expectedBaseRevision,
          receivedBaseRevision: activationState.receivedBaseRevision,
          traceId,
        });
      });
    }
  }

  if (activationPlan.shouldMutate !== false) {
    const historyStatus = await updateFeedObservationHistory(request.precisionInsightsAllowed === true)
      .then(
        (applied) => applied ? 'applied' : 'superseded',
        (error) => {
          recordProtectionControllerFailure('feed_observation_history_apply', error);
          return 'failed';
        },
      );
    if (respondIfReceiverCancelled()) return;
    if (historyStatus === 'superseded') {
      sendResponse?.({ ok: true, source: activationPlan.source, traceId, superseded: true });
      return;
    }
    updateGlobalSentinelResidueOverlay({
      releaseReason: request.releaseReason,
      globalSentinelOutcome: request.globalSentinelOutcome,
    });

    const updateBehaviorContext = () => behaviorHub.updateContext({
      activeFilters: activationPlan.activeFilterContext,
      domainClassId: activationPlan.domainClassId,
      protectionMainActive: shouldActivate,
      precisionInsightsAllowed: request.precisionInsightsAllowed === true,
    });

    let applyResult = null;
    if (activationPlan.shouldClear) {
      cancelPendingNudgeEntrySeam('protection_cleared');
      updateBehaviorContext();
      if (!activationPlan.error) {
        suppressPrepaintVisualEffects();
      }
      applyResult = await clearProtectionRuntimeEffects();
    } else {
      applyResult = await applyProtectionRuntimeEffectsCooperatively(activationPlan.filters, {
        onStartupApplied: (timing) => {
          if (!isReceiverCurrent()) return;
          if (receivedAt !== null && timing) {
            recordProtectionEnvironmentProbe({
              phase: 'effect_startup', traceId,
              rootStartMs: timing.rootStartedAt === null ? null : timing.rootStartedAt - receivedAt,
              inputStartMs: timing.inputStartedAt === null ? null : timing.inputStartedAt - receivedAt,
            });
          }
          updateBehaviorContext();
        },
        globalEffects: globalProtectionEffects,
        keyedEffects: keyedProtectionEffects,
        context: {
          revision: activationState?.envelope?.revision ?? null,
          domainClassId: activationPlan.domainClassId,
          trace: activationState?.envelope?.trace || null,
          activation: activationState?.activation || null,
        },
      });
    }
    if (respondIfReceiverCancelled()) return;
    if (applyResult?.superseded) {
      sendResponse?.({
        ok: true,
        source: activationPlan.source,
        traceId,
        superseded: true,
      });
      return;
    }
    if (!activationPlan.shouldClear) {
      suppressPrepaintVisualEffects();
    }

    recordProtectionRuntimeActivationApplied({
      source: activationPlan.source,
      shouldActivate,
      shouldClear: activationPlan.shouldClear,
      shouldMutate: true,
      domainClassId: activationPlan.domainClassId,
      traceId,
      revision: activationState?.envelope?.revision,
      featureStates: activationState?.activation?.features,
      activeFilterKeys,
    });

    StatusIndicator.update({
      isBlocked: shouldActivate,
      isBlockedDomain: request.isBlockedDomain,
      filters: activationPlan.filters,
      indicatorConfig: request.indicatorConfig,
      indicatorEnabled: request.indicatorEnabled,
      policy: request.policy,
    });
    updateRuntimeDebuggerSidecar({
      isBlocked: shouldActivate,
      isBlockedDomain: request.isBlockedDomain,
      debugConfig: request.debugConfig,
      policy: request.policy,
    });
  }

  if (activationPlan.error) {
    sendResponse?.({
      ok: false,
      error: activationPlan.error,
      source: activationPlan.source,
      traceId,
      resyncRequested: activationPlan.error === ACTIVATION_ENGINE_ERRORS.RESYNC_REQUIRED,
      expectedBaseRevision: activationState.expectedBaseRevision,
      receivedBaseRevision: activationState.receivedBaseRevision,
      expectedRevision: activationState.expectedRevision,
      receivedRevision: activationState.receivedRevision,
    });
    return;
  }

  if (receivedAt !== null) {
    recordProtectionEnvironmentProbe({ phase: 'effect_ack_ready', traceId, elapsedMs: performance.now() - receivedAt });
  }
  sendResponse?.({
    ok: true,
    source: activationPlan.source,
    traceId,
    staleIgnored: activationState.isStale === true,
    staleReason: activationState.staleReason,
    expectedBaseRevision: activationState.expectedBaseRevision,
    receivedBaseRevision: activationState.receivedBaseRevision,
    expectedRevision: activationState.expectedRevision,
    receivedRevision: activationState.receivedRevision,
  });
}

export function installProtectionRuntimeReceiver() {
  if (protectionRuntimeListener) return;
  protectionRuntimeReceiverEpoch += 1;
  const receiverEpoch = protectionRuntimeReceiverEpoch;
  isProtectionRuntimeReceiverInstalled = true;
  try {
    globalThis.__entropyProtectionRuntimeReceiverInstalled__ = true;
  } catch (error) {
    recordProtectionControllerFailure('receiver_installed_marker_write', error);
  }

  protectionRuntimeListener = (request, sender, sendResponse) => {
    if (!isProtectionRuntimeReceiverInstalled || receiverEpoch !== protectionRuntimeReceiverEpoch) return false;
    if (handleBuildCapabilityContentMessage(request, sender, sendResponse)) {
      return true;
    }

    // 1. Handle Nudge/Game Messages
    if (handleNudgeMessage(request, sendResponse)) {
      return true;
    }


    if (!isProtectionUpdateMessage(request)) return false;
    void handleProtectionUpdateMessage(request, sendResponse, receiverEpoch).catch((error) => {
      recordProtectionControllerFailure('cooperative_effect_apply', error, {
        logMessage: '[ProtectionController] cooperative effect apply failed',
      });
      sendResponse?.({
        ok: false,
        error: formatProtectionEffectFailure(error),
      });
    });
    return true;
  };

  runtimeOnMessageAddListener(protectionRuntimeListener);
}

export function startProtectionRuntimeSidecars() {
  if (areProtectionRuntimeSidecarsStarted) return;
  areProtectionRuntimeSidecarsStarted = true;
  protectionRuntimeSidecarEpoch += 1;
  behaviorHub.init();
  startVisualEffectBridge();
  // The authoritative update already carries indicator settings and status.
  // Sidecar startup may finish after that update; it must not reset its state.
  startRuntimeDebuggerSidecar();
}

export function teardownProtectionRuntimeReceiver() {
  protectionRuntimeReceiverEpoch += 1;
  isProtectionRuntimeReceiverInstalled = false;
  const failures = [];
  for (const cleanup of [
    cancelPendingNudgeEntrySeam,
    () => dismissSentinelPresageSignal({ immediate: true }),
    () => {
      if (protectionRuntimeListener) {
        runtimeOnMessageRemoveListener(protectionRuntimeListener);
        protectionRuntimeListener = null;
      }
    },
  ]) {
    try { cleanup(); } catch (error) { failures.push(error); }
  }
  lastResyncRequestAt = 0;
  try {
    globalThis.__entropyProtectionRuntimeReceiverInstalled__ = false;
  } catch (error) {
    recordProtectionControllerFailure('receiver_installed_marker_clear', error);
  }
  if (failures.length) throw new AggregateError(failures, 'PROTECTION_RECEIVER_CLEANUP_FAILED');
}

export async function teardownProtectionRuntimeSidecars() {
  protectionRuntimeSidecarEpoch += 1;
  runtimeDebuggerRequestEpoch += 1;
  areProtectionRuntimeSidecarsStarted = false;
  runtimeDebuggerForcedByProtection = false;
  const operations = [
    stopFeedObservationHistory,
    stopVisualEffectBridge,
    removeGlobalSentinelResidueOverlay,
    () => behaviorHub.teardown(),
    () => StatusIndicator.teardown(),
    teardownRuntimeDebuggerSidecar,
  ];
  const results = await Promise.allSettled(operations.map(async cleanup => cleanup()));
  const failures = results.filter(result => result.status === 'rejected').map(result => result.reason);
  if (failures.length) throw new AggregateError(failures, 'PROTECTION_SIDECAR_CLEANUP_FAILED');
}
