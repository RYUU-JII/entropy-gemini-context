import { createFeedFlowRuntimeStateOwner } from '../../../../domains/protection/background/runtime/FeedFlowRuntimeStateOwner.js';
import { createGateRuntimeStateOwner } from '../../../../domains/protection/background/runtime/GateRuntimeStateOwner.js';
import { createProtectionRuntimeSnapshotStore } from '../../../../domains/protection/background/runtime/ProtectionRuntimeSnapshotStore.js';
import { createStrategyEffectivenessTracker } from '../../../../domains/protection/background/strategy/StrategyEffectivenessTracker.js';

function normalizeHost(hostname) {
  return typeof hostname === 'string' ? hostname.trim().toLowerCase() : '';
}

function resolveRecoveryHost({ hostname = '', key = '' } = {}) {
  const normalizedHostname = normalizeHost(hostname);
  if (normalizedHostname) return normalizedHostname;
  if (typeof key !== 'string') return '';
  const separatorAt = key.indexOf('|');
  if (separatorAt <= 0 || separatorAt >= key.length - 1) return '';
  return normalizeHost(key.slice(separatorAt + 1));
}

function createEmptyAggressionSignalCacheSnapshot() {
  return {
    checkedAt: 0,
    scores: [],
  };
}

function createAggressionSignalCacheError(fieldName) {
  return new Error(`PROTECTION_AGGRESSION_SIGNAL_CACHE_INVALID:${fieldName}`);
}

function requireAggressionSignalCacheTimestamp(value, fieldName) {
  if (!Number.isInteger(value) || value < 0) {
    throw createAggressionSignalCacheError(fieldName);
  }
  return value;
}

function requireAggressionSignalScore(value, index) {
  if (!Number.isFinite(value) || value < 0) {
    throw createAggressionSignalCacheError(`scores.${index}`);
  }
  return value;
}

function requireAggressionSignalCacheSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw createAggressionSignalCacheError('snapshot');
  }
  if (!Array.isArray(snapshot.scores)) {
    throw createAggressionSignalCacheError('scores');
  }
  return {
    checkedAt: requireAggressionSignalCacheTimestamp(snapshot.checkedAt, 'checkedAt'),
    scores: snapshot.scores.map((score, index) => requireAggressionSignalScore(score, index)),
  };
}

function cloneAggressionSignalCacheSnapshot(snapshot) {
  return {
    checkedAt: snapshot.checkedAt,
    scores: [...snapshot.scores],
  };
}

export function createProtectionRuntimeStateCoordinator({
  runtimeSnapshotStore = createProtectionRuntimeSnapshotStore(),
  strategyEffectivenessTracker = createStrategyEffectivenessTracker(),
  feedFlowSourceLimit,
  entryApprovalRepository,
  returnLockRepository,
} = {}) {
  let decisionRevision = 0;
  let aggressionSignalCache = createEmptyAggressionSignalCacheSnapshot();
  const feedFlowRuntimeStateOwner = createFeedFlowRuntimeStateOwner({
    sourceLimit: feedFlowSourceLimit,
  });
  const gateRuntimeStateOwner = createGateRuntimeStateOwner({ entryApprovalRepository, returnLockRepository });
  const {
    getFeedFlowSnapshot,
    prepareFeedFlowSnapshot,
    commitFeedFlowSnapshot,
    setFeedFlowSnapshot,
    clearFeedFlowSnapshot,
    noteFeedFlowTabNavigation,
    noteFeedFlowTabClosed,
  } = feedFlowRuntimeStateOwner;
  const {
    getGateEntryApproval,
    releaseGateEntryApprovalForQa,
    observeGateEntryPresence,
    observeGateSitePresence,
    getGateReturnLock,
    noteGateForegroundTab,
    noteGateActiveNavigation,
    noteGateForegroundBlur,
    noteGateTabClosed,
    applyGateInterventionDecision,
    recordGateInterventionShown,
    getGateHostSnapshot,
    observeGateDetourSpreadLevel,
  } = gateRuntimeStateOwner;

  function nextDecisionRevision() {
    decisionRevision += 1;
    return decisionRevision;
  }

  function getAggressionSignalCache() {
    return cloneAggressionSignalCacheSnapshot(aggressionSignalCache);
  }

  function setAggressionSignalCache(snapshot) {
    aggressionSignalCache = requireAggressionSignalCacheSnapshot(snapshot);
    return getAggressionSignalCache();
  }

  function getProtectionRuntimeSnapshot({ hostname } = {}) {
    const normalizedHostname = normalizeHost(hostname);
    if (!normalizedHostname) return null;
    return runtimeSnapshotStore.get(normalizedHostname);
  }

  function setProtectionRuntimeSnapshot({
    hostname,
    plan,
    observation,
    revision,
    strategy = null,
    recovery = null,
    effectiveness = null,
    coolingCurve,
  } = {}) {
    return runtimeSnapshotStore.set({
      hostname,
      plan,
      observation,
      revision,
      strategy,
      recovery,
      effectiveness,
      coolingCurve,
    });
  }

  function clearProtectionRuntimeSnapshot({ hostname } = {}) {
    const normalizedHostname = normalizeHost(hostname);
    if (!normalizedHostname) return;
    runtimeSnapshotStore.clear(normalizedHostname);
  }

  function noteStrategySnapshot({
    hostname = '',
    strategy = null,
    observation = null,
    now = Date.now(),
  } = {}) {
    const normalizedHostname = normalizeHost(hostname);
    if (!normalizedHostname) return null;
    return strategyEffectivenessTracker.noteStrategySnapshot({
      host: normalizedHostname,
      strategy,
      observation,
      now,
    });
  }

  function getStrategyEffectivenessSnapshot({ hostname = '' } = {}) {
    return strategyEffectivenessTracker.getRuntimeSummary(normalizeHost(hostname));
  }

  function recordRecoveryPresented({
    hostname = '',
    key = '',
    runId = '',
    now = Date.now(),
  } = {}) {
    const resolvedHost = resolveRecoveryHost({ hostname, key });
    if (!resolvedHost || !runId) return null;
    const runtime = runtimeSnapshotStore.get(resolvedHost);
    return strategyEffectivenessTracker.markRecoveryPresented({
      host: resolvedHost,
      key,
      runId,
      strategy: runtime?.strategy,
      observation: runtime?.observation,
      now,
    });
  }

  function recordRecoveryOutcome({
    hostname = '',
    key = '',
    runId = '',
    outcome = 'aborted',
    reason = '',
    durationMs = 0,
    now = Date.now(),
  } = {}) {
    const resolvedHost = resolveRecoveryHost({ hostname, key });
    if (!resolvedHost) {
      return {
        entry: null,
        hostname: '',
        runtime: null,
        effectiveness: null,
      };
    }

    const entry = strategyEffectivenessTracker.markRecoveryOutcome({
      host: resolvedHost,
      key,
      runId,
      outcome,
      reason,
      durationMs,
      now,
    });

    return {
      entry,
      hostname: resolvedHost,
      runtime: runtimeSnapshotStore.get(resolvedHost),
      effectiveness: strategyEffectivenessTracker.getRuntimeSummary(resolvedHost),
    };
  }

  return {
    nextDecisionRevision,
    getAggressionSignalCache,
    setAggressionSignalCache,
    getFeedFlowSnapshot,
    prepareFeedFlowSnapshot,
    commitFeedFlowSnapshot,
    setFeedFlowSnapshot,
    clearFeedFlowSnapshot,
    noteFeedFlowTabNavigation,
    noteFeedFlowTabClosed,
    getProtectionRuntimeSnapshot,
    setProtectionRuntimeSnapshot,
    clearProtectionRuntimeSnapshot,
    noteStrategySnapshot,
    getStrategyEffectivenessSnapshot,
    recordRecoveryPresented,
    recordRecoveryOutcome,
    getGateEntryApproval,
    releaseGateEntryApprovalForQa,
    observeGateEntryPresence,
    observeGateSitePresence,
    getGateReturnLock,
    noteGateForegroundTab,
    noteGateActiveNavigation,
    noteGateForegroundBlur,
    noteGateTabClosed,
    applyGateInterventionDecision,
    recordGateInterventionShown,
    getGateHostSnapshot,
    observeGateDetourSpreadLevel,
  };
}
