import { hasEnabledGoalEnd } from '../../../../settings/config/nudgeConfig.js';
import {
  getHostname,
} from '../../../../../lib/index.js';
import {
  createNudgeRunId,
  getNudgeDayKey,
  getNudgeGlobalProtocolDayKey,
} from '../../../../nudge/runtime/session/nudgeSessionShared.js';
import { readFurinDailyReceipt, decideFurinDailyDelivery } from '../../../../nudge/runtime/session/furinDailyPolicy.js';
import { createGoalEpisodeBinding } from '../../../../nudge/runtime/goalEpisodeBinding.js';
import { markNudgeEntryWaiting } from '../../../../nudge/runtime/session/nudgeSessionDispatchState.js';
import {
  normalizeNudgePresageConfig,
} from '../../../../settings/config/nudgeConfig.js';
import {
  PROTECTION_RUNTIME_ARTIFACT_IDS,
} from '../../../contracts/artifactIds.js';
import {
  isArtifactState,
} from '../../../contracts/protectionContracts.js';
import {
  createProtectionNudgeDispatchGate,
} from './ProtectionNudgeDispatchGate.js';
import {
  buildProtectionNudgeCandidateProtocolClaim,
  buildProtectionNudgePresageMessage,
  buildProtectionNudgeStartMessage,
} from './ProtectionNudgeDispatchMessageBuilder.js';
import {
  createProtectionNudgeDispatchTimeline,
} from './ProtectionNudgeDispatchTimeline.js';
import { projectSentinelStartFailureDiagnostics } from '../../../debug/SentinelProtocolTimeline.js';
import {
  formatDispatchDiagnostic,
  isWebUrl,
  sendMessageWithRecovery,
  toErrorMessage,
} from './ProtectionDispatchTransport.js';

function isPermissionMissingReason(reason) {
  return reason === 'missing_host_permission' || reason === 'missing_scripting_permission';
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function requireRunnerMethod(owner, methodName, errorCode) {
  if (!owner || typeof owner[methodName] !== 'function') {
    throw new Error(errorCode);
  }
  return owner[methodName].bind(owner);
}

function resolveContentScriptRuntime(contentScriptRuntime) {
  return {
    ensureContentScriptReady: requireRunnerMethod(
      contentScriptRuntime,
      'ensureContentScriptReady',
      'PROTECTION_NUDGE_DISPATCH_CONTENT_RUNTIME_REQUIRED',
    ),
    getTabSession: requireRunnerMethod(
      contentScriptRuntime,
      'getTabSession',
      'PROTECTION_NUDGE_DISPATCH_CONTENT_RUNTIME_REQUIRED',
    ),
    markTabNavigated: requireRunnerMethod(
      contentScriptRuntime,
      'markTabNavigated',
      'PROTECTION_NUDGE_DISPATCH_CONTENT_RUNTIME_REQUIRED',
    ),
  };
}

function resolveNudgeDispatchContext(nudgeDispatchContext) {
  return {
    buildRecoveryAwareNudgeConfig: requireRunnerMethod(
      nudgeDispatchContext,
      'buildRecoveryAwareNudgeConfig',
      'PROTECTION_NUDGE_DISPATCH_CONTEXT_REQUIRED',
    ),
    normalizeSentinelFlareDebugOverrides: requireRunnerMethod(
      nudgeDispatchContext,
      'normalizeSentinelFlareDebugOverrides',
      'PROTECTION_NUDGE_DISPATCH_CONTEXT_REQUIRED',
    ),
    resolveNudgeTriggerCandidates: requireRunnerMethod(
      nudgeDispatchContext,
      'resolveNudgeTriggerCandidates',
      'PROTECTION_NUDGE_DISPATCH_CONTEXT_REQUIRED',
    ),
    resolveRuntimeContext: requireRunnerMethod(
      nudgeDispatchContext,
      'resolveRuntimeContext',
      'PROTECTION_NUDGE_DISPATCH_CONTEXT_REQUIRED',
    ),
  };
}

function resolveBrowserPort(browserPort) {
  if (
    !browserPort
    || typeof browserPort.tabsGet !== 'function'
    || typeof browserPort.tabsSendMessage !== 'function'
    || typeof browserPort.windowsGetLastFocused !== 'function'
  ) {
    throw new Error('PROTECTION_NUDGE_DISPATCH_BROWSER_PORT_REQUIRED');
  }
  return browserPort;
}

function requireNudgeConfig(config) {
  if (!isPlainObject(config)) {
    throw new Error('PROTECTION_NUDGE_DISPATCH_CONFIG_RESULT_REQUIRED');
  }
  if (typeof config.enabled !== 'boolean' || config.enabled !== hasEnabledGoalEnd(config)) {
    throw new Error('PROTECTION_NUDGE_DISPATCH_CONFIG_FIELD_INVALID:enabled');
  }
  return config;
}

function resolveContentMutationFence(value) {
  if (value === null || typeof value === 'undefined') return null;
  if (typeof value !== 'object' || typeof value.assertCurrent !== 'function') {
    throw new Error('PROTECTION_NUDGE_CONTENT_MUTATION_FENCE_INVALID');
  }
  return value;
}

function resolveContentMutationDocumentId(value, fence) {
  if (fence === null && (value === null || typeof value === 'undefined')) return null;
  if (typeof value !== 'string' || !value.trim() || value !== value.trim()) {
    throw new Error('PROTECTION_NUDGE_CONTENT_MUTATION_DOCUMENT_ID_INVALID');
  }
  return value;
}

function requireRuntimeSnapshot(runtimeSnapshot) {
  if (!isPlainObject(runtimeSnapshot)) {
    throw new Error('PROTECTION_NUDGE_DISPATCH_RUNTIME_SNAPSHOT_REQUIRED');
  }
  return runtimeSnapshot;
}

function requireRuntimeActivityDay(activityDay) {
  if (
    !isPlainObject(activityDay)
    || activityDay.basis !== 'activity-day'
    || !/^\d{4}-\d{2}-\d{2}$/.test(activityDay.dateStr)
    || !Number.isInteger(activityDay.resetHour)
    || activityDay.resetHour < 0 || activityDay.resetHour > 23
    || !Number.isInteger(activityDay.activeMs) || activityDay.activeMs < 0
  ) {
    throw new Error('PROTECTION_NUDGE_DISPATCH_ACTIVITY_DAY_INVALID');
  }
  return activityDay;
}

function requireRuntimeDispatch(dispatch) {
  if (!isPlainObject(dispatch)) {
    throw new Error('PROTECTION_NUDGE_DISPATCH_RUNTIME_FIELD_INVALID:dispatch');
  }
  if (typeof dispatch.isBlockedDomain !== 'boolean') {
    throw new Error('PROTECTION_NUDGE_DISPATCH_RUNTIME_FIELD_INVALID:dispatch.isBlockedDomain');
  }
  if (typeof dispatch.shouldApply !== 'boolean') {
    throw new Error('PROTECTION_NUDGE_DISPATCH_RUNTIME_FIELD_INVALID:dispatch.shouldApply');
  }
  return dispatch;
}

function requireSentinelFlareRuntimeEligibility(runtimeSnapshot) {
  const plan = runtimeSnapshot.plan;
  if (!isPlainObject(plan)) {
    throw new Error('PROTECTION_NUDGE_DISPATCH_RUNTIME_FIELD_INVALID:plan');
  }
  if (!isPlainObject(plan.artifacts)) {
    throw new Error('PROTECTION_NUDGE_DISPATCH_RUNTIME_FIELD_INVALID:plan.artifacts');
  }
  const state = plan.artifacts[PROTECTION_RUNTIME_ARTIFACT_IDS.SENTINEL_FLARE];
  if (!isArtifactState(state)) {
    throw new Error('PROTECTION_NUDGE_DISPATCH_RUNTIME_FIELD_INVALID:plan.artifacts.sentinelFlare');
  }
  return state !== 'disabled';
}

function requireNudgeSendResult(result) {
  if (!isPlainObject(result) || typeof result.ok !== 'boolean') {
    throw new Error('PROTECTION_NUDGE_DISPATCH_SEND_RESULT_INVALID');
  }
  if (!result.ok && !result.error) {
    throw new Error('PROTECTION_NUDGE_DISPATCH_SEND_FAILURE_INVALID');
  }
  return result;
}

function requireNudgeStartAcknowledgement(result, { expectedRunId, allowWaiting }) {
  const resolved = requireNudgeSendResult(result);
  if (!resolved.ok) return resolved;
  const response = resolved.response;
  const hasKeys = (keys) => isPlainObject(response)
    && Reflect.ownKeys(response).length === keys.length
    && keys.every(key => Object.prototype.propertyIsEnumerable.call(response, key));
  const rendered = hasKeys(['ok']) && response.ok === true;
  const waiting = allowWaiting === true && hasKeys(['ok', 'phase', 'runId']) && response.ok === true
    && response.phase === 'entry_waiting' && typeof expectedRunId === 'string' && expectedRunId.length > 0
    && response.runId === expectedRunId;
  if (!rendered && !waiting) {
    throw new Error('PROTECTION_NUDGE_START_ACK_INVALID');
  }
  return resolved;
}

function isExactNudgeEntryCancellation(result) {
  const response = result.response;
  const startResult = response?.startResult;
  return result.ok === false
    && isPlainObject(response)
    && Reflect.ownKeys(response).length === 4
    && ['ok', 'phase', 'error', 'startResult'].every((key) => (
      Object.prototype.propertyIsEnumerable.call(response, key)
    ))
    && response.ok === false
    && response.phase === 'rejected'
    && response.error === 'entry_cancelled'
    && isPlainObject(startResult)
    && Reflect.ownKeys(startResult).length === 2
    && ['ok', 'rejectReason'].every((key) => (
      Object.prototype.propertyIsEnumerable.call(startResult, key)
    ))
    && startResult.ok === false
    && startResult.rejectReason === 'entry_cancelled';
}

function isSameDocumentUrlInvalidation(error) {
  return error?.code === 'PROTECTION_DISPATCH_SERIAL_QUEUE_INVALIDATED'
    && error?.reason === 'web_navigation_history_state_updated';
}

function resolveBelowTargetTiming(readinessResult = {}) {
  if (readinessResult?.skipped !== 'below_target') return null;
  const observedMs = Number(readinessResult.observedMs);
  const targetMs = Number(readinessResult.targetMs);
  if (!Number.isFinite(observedMs) || !Number.isFinite(targetMs) || targetMs <= 0) return null;
  return {
    observedMs: Math.max(0, Math.round(observedMs)),
    targetMs: Math.max(0, Math.round(targetMs)),
  };
}

function isGlobalProtocolClaim(protocolClaim = null) {
  return protocolClaim?.protocolScope === 'global';
}

function resolvePresageDispatchPlan({
  config,
  readinessResult,
  key,
  presageDispatchedKeys,
  protocolClaim,
} = {}) {
  if (!isGlobalProtocolClaim(protocolClaim)) return null;
  const timing = resolveBelowTargetTiming(readinessResult);
  if (!timing) return null;
  const presage = normalizeNudgePresageConfig(config?.presage);
  const triggerAtMs = Math.floor(timing.targetMs * presage.triggerRatio);
  if (timing.observedMs < triggerAtMs || timing.observedMs >= timing.targetMs) return null;
  if (presageDispatchedKeys.has(key)) return null;

  return {
    ...timing,
    presage,
  };
}

function resolveNudgeDispatchKey({
  dateStr,
  siteKey,
  protocolClaim,
  force = false,
} = {}) {
  if (!force && isGlobalProtocolClaim(protocolClaim)) {
    return getNudgeGlobalProtocolDayKey(dateStr);
  }
  return siteKey;
}

export function createProtectionNudgeDispatchRunner({
  settingsCache,
  ensureSettingsCache,
  mergeNudgeConfig,
  resolveProtectionRuntime,
  nudgeDispatchContext,
  contentScriptRuntime,
  browserPort,
  recordDiagnostic,
  recordTimeline,
  readProfileGeneration,
} = {}) {
  if (!isPlainObject(settingsCache)) {
    throw new Error('PROTECTION_NUDGE_DISPATCH_SETTINGS_CACHE_REQUIRED');
  }
  if (typeof ensureSettingsCache !== 'function') {
    throw new Error('PROTECTION_NUDGE_DISPATCH_SETTINGS_READY_OWNER_REQUIRED');
  }
  if (typeof mergeNudgeConfig !== 'function') {
    throw new Error('PROTECTION_NUDGE_DISPATCH_CONFIG_OWNER_REQUIRED');
  }
  if (typeof resolveProtectionRuntime !== 'function') {
    throw new Error('PROTECTION_NUDGE_DISPATCH_RUNTIME_OWNER_REQUIRED');
  }
  if (typeof recordDiagnostic !== 'function') {
    throw new Error('PROTECTION_NUDGE_DISPATCH_DIAGNOSTICS_REQUIRED');
  }
  if (typeof recordTimeline !== 'function') {
    throw new Error('PROTECTION_NUDGE_DISPATCH_TIMELINE_REQUIRED');
  }
  if (typeof readProfileGeneration !== 'function') throw new Error('PROTECTION_NUDGE_PROFILE_GENERATION_OWNER_REQUIRED');

  const resolvedBrowserPort = resolveBrowserPort(browserPort);
  const contentRuntime = resolveContentScriptRuntime(contentScriptRuntime);
  const dispatchContext = resolveNudgeDispatchContext(nudgeDispatchContext);
  const dispatchGate = createProtectionNudgeDispatchGate({
    browserPort: resolvedBrowserPort,
    recordDiagnostic,
  });
  const presageDispatchedKeys = new Set();

  async function maybeDispatchNudgePresage({
    tabId,
    url,
    config,
    runtimeSnapshot,
    triggerTarget,
    readinessResult,
    protocolClaim,
    hostname,
    dateStr,
    key,
    contentMutationDocumentId = null,
    contentMutationFence = null,
  } = {}) {
    const plan = resolvePresageDispatchPlan({
      config,
      readinessResult,
      key,
      presageDispatchedKeys,
      protocolClaim,
    });
    if (!plan) return readinessResult;

    try {
      const {
        message,
        protocolProfile,
      } = await buildProtectionNudgePresageMessage({
        config,
        runtimeSnapshot,
        triggerTarget: {
          ...triggerTarget,
          targetMs: plan.targetMs,
          observedMs: plan.observedMs,
        },
        protocolClaim,
        dispatchContext,
        hostname,
        dateStr,
        key,
        presageConfig: plan.presage,
      });
      contentMutationFence?.assertCurrent('nudge_presage_message_built');
      const result = requireNudgeSendResult(
        await sendMessageWithRecovery(
          tabId,
          message,
          contentRuntime,
          {
            url,
            reason: 'nudge_presage',
            recordDiagnostic,
            browserPort: resolvedBrowserPort,
            bindToReadyDocument: contentMutationDocumentId !== null,
            expectedDocumentId: contentMutationDocumentId,
            contentMutationFence,
          },
        ),
      );
      contentMutationFence?.assertCurrent('nudge_presage_sent');
      if (!result.ok) {
        throw result.error;
      }

      presageDispatchedKeys.add(key);
      recordDiagnostic('nudge_presage_dispatched', {
        key,
        hostname,
        observedMs: plan.observedMs,
        targetMs: plan.targetMs,
        count: 1,
        protocolScope: protocolProfile.protocolScope,
        protocolVariant: protocolProfile.protocolVariant,
      });
      return {
        ...readinessResult,
        presageDispatched: true,
        presageCount: 1,
        protocolProfile,
      };
    } catch (error) {
      recordDiagnostic('nudge_presage_dispatch_failed', {
        key,
        hostname,
        error: toErrorMessage(error),
      });
      return {
        ...readinessResult,
        presageDispatched: false,
        presageError: toErrorMessage(error),
      };
    }
  }

  async function maybeTriggerProtectionNudge(
    tabId,
    url,
    {
      force = false,
      runtimeOverride = null,
      nowOverride = null,
      debugOverrides = null,
      contentMutationDocumentId = null,
      contentMutationFence = null,
    } = {},
  ) {
    const mutationFence = resolveContentMutationFence(contentMutationFence);
    const mutationDocumentId = resolveContentMutationDocumentId(
      contentMutationDocumentId,
      mutationFence,
    );
    mutationFence?.assertCurrent('nudge_start');
    const timeline = createProtectionNudgeDispatchTimeline({
      recordTimeline,
      force,
      tabId,
      url,
    });
    if (!tabId || !url) {
      timeline.failedValidation('invalid_target');
      return { dispatched: false, skipped: 'invalid_target' };
    }
    if (!isWebUrl(url)) {
      timeline.failedValidation('invalid_url');
      return { dispatched: false, skipped: 'invalid_url' };
    }

    const now = Number.isFinite(nowOverride) ? nowOverride : Date.now();
    const hostname = getHostname(url);
    timeline.setHostname(hostname);
    if (!hostname) {
      timeline.failedValidation('invalid_hostname');
      return { dispatched: false, skipped: 'invalid_hostname' };
    }
    timeline.accepted();

    await ensureSettingsCache();
    mutationFence?.assertCurrent('nudge_settings_ready');
    const config = requireNudgeConfig(mergeNudgeConfig(settingsCache.nudgeConfig));
    const hasRuntimeOverride = runtimeOverride !== null && runtimeOverride !== undefined;
    const runtimeSnapshotSource = hasRuntimeOverride
      ? runtimeOverride
      : await resolveProtectionRuntime(hostname, { now });
    mutationFence?.assertCurrent('nudge_runtime_ready');
    const runtimeSnapshot = requireRuntimeSnapshot(runtimeSnapshotSource);
    const dispatch = requireRuntimeDispatch(runtimeSnapshot.dispatch);
    let triggerTarget = null;

    if (!dispatch.isBlockedDomain) {
      timeline.protectionSkipped('unprotected_domain');
      return { dispatched: false, skipped: 'unprotected_domain', hostname };
    }
    if (!dispatch.shouldApply && !force) {
      timeline.protectionSkipped('protection_inactive');
      return { dispatched: false, skipped: 'protection_inactive', hostname };
    }
    if (!config.enabled && !force) {
      timeline.skipped('nudge_disabled');
      return { dispatched: false, skipped: 'nudge_disabled', hostname };
    }
    if (!force && !requireSentinelFlareRuntimeEligibility(runtimeSnapshot)) {
      timeline.skipped('artifact_ineligible', {
        artifactId: PROTECTION_RUNTIME_ARTIFACT_IDS.SENTINEL_FLARE,
      });
      return {
        dispatched: false,
        skipped: 'artifact_ineligible',
        artifactId: PROTECTION_RUNTIME_ARTIFACT_IDS.SENTINEL_FLARE,
        hostname,
      };
    }
    const activityDay = requireRuntimeActivityDay(runtimeSnapshot.activityDay);
    const dateStr = activityDay.dateStr;
    const candidates = dispatchContext.resolveNudgeTriggerCandidates(runtimeSnapshot, config);
    if (!Array.isArray(candidates) || candidates.some(candidate => !isPlainObject(candidate)
      || !['site_goal', 'global_protocol'].includes(candidate.source)
      || !Number.isSafeInteger(candidate.targetMs) || candidate.targetMs <= 0
      || !Number.isSafeInteger(candidate.observedMs) || candidate.observedMs < 0)) {
      throw new Error('PROTECTION_NUDGE_TRIGGER_CANDIDATES_INVALID');
    }
    const dailyReceipt = force ? null : await readFurinDailyReceipt();
    const eligible = candidates.filter(candidate => force || decideFurinDailyDelivery(dailyReceipt, {
      dateStr, hostname, protocolScope: candidate.source === 'global_protocol' ? 'global' : 'site',
    }).eligible);
    triggerTarget = eligible.find(candidate => candidate.observedMs >= candidate.targetMs)
      || eligible.find(candidate => candidate.source === 'global_protocol') || eligible[0] || null;
    if (triggerTarget?.episode?.mode === 'combined_goals'
      && !decideFurinDailyDelivery(dailyReceipt, { dateStr, hostname, protocolScope: 'site' }).eligible) {
      const globalOnly = { ...triggerTarget };
      delete globalOnly.episode;
      triggerTarget = globalOnly;
    }
    if (!triggerTarget && !force) {
      const reason = candidates.length > 0 ? decideFurinDailyDelivery(dailyReceipt, {
        dateStr, hostname, protocolScope: candidates[0].source === 'global_protocol' ? 'global' : 'site',
      }).reason : 'protocol_target_unavailable';
      timeline.skipped(reason);
      return {
        dispatched: false,
        skipped: reason,
        hostname,
      };
    }
    if (!triggerTarget) {
      triggerTarget = {
        targetMs: 0,
        source: 'debug',
      };
    }
    mutationFence?.assertCurrent('nudge_daily_receipt_read');
    const siteKey = getNudgeDayKey(dateStr, hostname);
    if (!Object.prototype.hasOwnProperty.call(triggerTarget, 'observedMs')) {
      triggerTarget = { ...triggerTarget, observedMs: activityDay.activeMs };
    }
    timeline.protectionAccepted(dispatch.traceId || null);

    const protocolClaim = buildProtectionNudgeCandidateProtocolClaim({
      runtimeSnapshot,
      triggerTarget,
      force,
    });
    const key = resolveNudgeDispatchKey({
      dateStr,
      siteKey,
      protocolClaim,
      force,
    });

    const readiness = await dispatchGate.evaluateReadiness({
      force,
      tabId,
      hostname,
      dateStr,
      key,
      now,
      triggerTarget,
      protocolClaim,
      timeline,
    });
    mutationFence?.assertCurrent('nudge_readiness_resolved');
    if (!readiness.ok) {
      return maybeDispatchNudgePresage({
        tabId,
        url,
        config,
        runtimeSnapshot,
        triggerTarget,
        readinessResult: readiness.result,
        protocolClaim,
        hostname,
        dateStr,
        key,
        contentMutationDocumentId: mutationDocumentId,
        contentMutationFence: mutationFence,
      });
    }
    presageDispatchedKeys.delete(key);
    const { hasDebt } = readiness;
    const dispatchProtocolClaim = protocolClaim;

    const inFlight = dispatchGate.reserveInFlight({
      force,
      key,
      hostname,
      timeline,
    });
    if (!inFlight.ok) return inFlight.result;

    const runId = createNudgeRunId();
    let dispatchBegun = false;
    let deliveryForm = null;
    let contentMutationDisposition = 'current';
    let entryCancelled = false;
    let startFailureDiagnostics = null;
    try {
      const goalBinding = force ? null : createGoalEpisodeBinding({
        hostname, tabId, documentId: mutationDocumentId, activityDay, triggerTarget, protocolClaim: dispatchProtocolClaim,
        runtimeSnapshot, settings: { ...settingsCache, nudgeConfig: config }, key, runId,
        profileGeneration: await readProfileGeneration(),
      });
      mutationFence?.assertCurrent('nudge_goal_bound');
      const begin = await dispatchGate.beginDispatch({
        force,
        key,
        tabId,
        now,
        runId,
        protocolClaim: dispatchProtocolClaim,
        goalBinding,
        hostname,
        preempted: readiness.preempted || null,
        timeline,
      });
      if (!begin.ok) {
        mutationFence?.assertCurrent('nudge_session_not_begun');
        return begin.result;
      }
      dispatchBegun = begin.dispatchBegun;
      deliveryForm = begin.deliveryForm;
      mutationFence?.assertCurrent('nudge_session_begun');

      const {
        message,
        nudgeReason,
        protocolProfile,
        runtimeContext,
      } = await buildProtectionNudgeStartMessage({
        config,
        runtimeSnapshot,
        triggerTarget,
        hasDebt,
        force,
        protocolClaim: dispatchProtocolClaim,
        debugOverrides,
        dispatchContext,
        hostname,
        dateStr,
        key,
        runId,
        deliveryForm,
        goalBinding,
      });
      mutationFence?.assertCurrent('nudge_message_built');
      recordDiagnostic('nudge_admission_bound', {
        tabId, hostname, runId: force ? null : runId,
        documentId: mutationDocumentId,
        traceId: dispatch.traceId ?? null,
        status: 'dispatching',
      });
      timeline.nudgeDispatched({
        runId,
        reason: nudgeReason,
        protocolProfile,
      });
      const result = requireNudgeStartAcknowledgement(
        await sendMessageWithRecovery(
          tabId,
          message,
          contentRuntime,
          {
            url,
            reason: 'nudge_dispatch',
            recordDiagnostic,
            browserPort: resolvedBrowserPort,
            bindToReadyDocument: mutationDocumentId !== null,
            expectedDocumentId: mutationDocumentId,
            contentMutationFence: mutationFence,
          },
        ),
        { expectedRunId: runId, allowWaiting: !force },
      );
      if (!result.ok) {
        startFailureDiagnostics = projectSentinelStartFailureDiagnostics(result.response?.startResult?.diagnostics);
        entryCancelled = !force && dispatchBegun && isExactNudgeEntryCancellation(result);
        const dispatchedError = result.error;
        if (result.diagnostic && dispatchedError && typeof dispatchedError === 'object') {
          dispatchedError.diagnostic = result.diagnostic;
        }
        throw dispatchedError;
      }
      try {
        mutationFence?.assertCurrent('nudge_message_sent');
      } catch (error) {
        if (!isSameDocumentUrlInvalidation(error)) throw error;
        contentMutationDisposition = 'same_document_url_overtaken';
        recordDiagnostic('nudge_start_acknowledged_before_same_document_url_change', {
          tabId,
          hostname,
          runId,
        });
      }
      timeline.contentReady({
        runId,
        ensureSource: result.ensureSource || null,
        delivery: result.delivery || null,
      });
      const entryWaiting = Object.hasOwn(result.response, 'phase') && result.response.phase === 'entry_waiting';
      if (entryWaiting) {
        if (await markNudgeEntryWaiting(key, { runId, tabId, now }) !== true) {
          throw new Error('PROTECTION_NUDGE_ENTRY_WAIT_OWNER_CHANGED');
        }
        recordDiagnostic('nudge_entry_waiting', { tabId, hostname, runId, key, phase: 'entry_waiting' });
      } else {
        timeline.contentRendered({
          runId,
          reason: nudgeReason,
          protocolProfile,
          ensureSource: result.ensureSource || null,
          delivery: result.delivery || null,
        });
      }
      return {
        dispatched: true,
        hostname,
        key,
        runId,
        reason: nudgeReason,
        protocolProfile,
        runtimeContext,
        contentMutationDisposition,
        ...(entryWaiting ? { phase: 'entry_waiting' } : {}),
      };
    } catch (e) {
      await dispatchGate.abortDispatchAfterFailure({
        dispatchBegun,
        key,
        runId,
        tabId,
        now,
        reason: entryCancelled ? 'entry_cancelled' : 'dispatch_failed',
        requireAbortedRun: entryCancelled,
      });
      if (entryCancelled) {
        recordDiagnostic('nudge_entry_cancelled', { tabId, hostname, runId });
        timeline.skipped('entry_cancelled', { runId });
        console.debug('[ProtectionNudgeDispatchRunner] Entry candidate cancelled', { tabId, runId });
        return { dispatched: false, skipped: 'entry_cancelled', hostname, runId };
      }
      const detail = formatDispatchDiagnostic(e?.diagnostic);
      const reason = e?.diagnostic?.reason || null;
      const log = isPermissionMissingReason(reason) ? console.debug : console.warn;
      log(`[ProtectionNudgeDispatchRunner] Failed to send nudge message to tab ${tabId}:`, {
        error: toErrorMessage(e),
        diagnostic: detail || null,
      });
      timeline.failedDispatch({
        runId,
        reason: reason || 'send_failed',
        error: toErrorMessage(e),
        startFailureDiagnostics,
      });
      return {
        dispatched: false,
        skipped: reason || 'send_failed',
        error: toErrorMessage(e),
        diagnostic: detail || null,
        startFailureDiagnostics,
        hostname,
        runId,
      };
    } finally {
      dispatchGate.finishInFlight({ force, key });
    }
  }

  function triggerDetached(tabId, url, options = {}, source = 'protection_dispatch') {
    maybeTriggerProtectionNudge(tabId, url, options).catch((error) => {
      recordDiagnostic('nudge_dispatch_detached_failed', {
        tabId,
        url,
        source,
        error: toErrorMessage(error),
      });
      console.warn('[ProtectionNudgeDispatchRunner] Detached protection nudge dispatch failed:', {
        tabId,
        url,
        source,
        error: toErrorMessage(error),
      });
    });
  }

  return {
    maybeTriggerProtectionNudge,
    triggerDetached,
  };
}
