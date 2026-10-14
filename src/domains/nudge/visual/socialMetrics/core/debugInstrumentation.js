import { recordRuntimeOwnerWork } from '@runtime-contention-ledger';
import {
  isSocialMetricsSelectorDriftPilotDecision,
  requireSocialMetricsCandidateProvenance,
} from './selectorDriftRecoveryContract.js';

const RECENT_OPERATION_LIMIT = 24;
const scanExecutionEvidenceByStats = new WeakMap();
const SOCIAL_METRICS_TERMINAL_DISPOSITIONS = new Set([
  'unknown',
  'apply',
  'clear',
]);
const SOCIAL_METRICS_EFFECT_BEARING_WRITE_OUTCOMES = new Set([
  'actual_write',
  'unchanged_noop',
]);
const SOCIAL_METRICS_SELECTOR_DRIFT_WRITE_OUTCOMES = new Set([
  'actual_write',
  'unchanged_noop',
]);

export const SOCIAL_METRICS_DEEP_COLLECTION_LIMIT = 12;
export const SOCIAL_METRICS_DEEP_SELECTOR_LIMIT = 8;
export const SOCIAL_METRICS_CORRELATION_LIMIT = 20;

export const SOCIAL_METRICS_AUDIT_MODES = Object.freeze({
  STANDARD: 'standard',
  DEEP: 'deep',
});

export const SOCIAL_METRICS_SCAN_WORK_REASONS = Object.freeze({
  RELEVANT_MUTATION: 'relevant_mutation',
  ACTIVATION_CONFIGURATION_TRANSITION: 'activation_configuration_transition',
  DIRECT_OWNER_REQUEST: 'direct_owner_request',
  SCHEDULED_FULL_SCOPE: 'scheduled_full_scope',
  UNKNOWN: 'unknown',
});

function resolveScanWorkReason(source) {
  if (source === 'mutation') return SOCIAL_METRICS_SCAN_WORK_REASONS.RELEVANT_MUTATION;
  if (source === 'update') {
    return SOCIAL_METRICS_SCAN_WORK_REASONS.ACTIVATION_CONFIGURATION_TRANSITION;
  }
  if (source === 'direct') return SOCIAL_METRICS_SCAN_WORK_REASONS.DIRECT_OWNER_REQUEST;
  if (source === 'scheduled_full') {
    return SOCIAL_METRICS_SCAN_WORK_REASONS.SCHEDULED_FULL_SCOPE;
  }
  return SOCIAL_METRICS_SCAN_WORK_REASONS.UNKNOWN;
}

function nowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function roundMs(value) {
  const num = Number(value);
  return Number.isFinite(num) ? Number(num.toFixed(2)) : 0;
}

function compactError(error, limit = 96) {
  const text = String(error?.message || error || '').replace(/\s+/g, ' ').trim();
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

function pushRecent(list, entry, limit) {
  list.push(entry);
  if (list.length > limit) list.splice(0, list.length - limit);
}

function getScanExecutionEvidenceState(stats, measurementEpoch = 0) {
  const normalizedEpoch = Number.isFinite(Number(measurementEpoch))
    ? Number(measurementEpoch)
    : 0;
  const current = scanExecutionEvidenceByStats.get(stats);
  if (current?.measurementEpoch === normalizedEpoch) return current;
  const next = {
    measurementEpoch: normalizedEpoch,
    lastExecutionKey: null,
    executionCountsByKey: new Map(),
  };
  scanExecutionEvidenceByStats.set(stats, next);
  return next;
}

function normalizeNodeIdentity(identity) {
  const generation = Number(identity?.generation);
  const nodeId = Number(identity?.nodeId);
  if (!Number.isInteger(generation) || generation < 1) return null;
  if (!Number.isInteger(nodeId) || nodeId < 1) return null;
  return `g${generation}:n${nodeId}`;
}

function resolveScanRootIdentitySet(entry, getNodeIdentity) {
  if (typeof getNodeIdentity !== 'function') {
    return { state: 'unavailable', reason: 'node_identity_registry_unavailable' };
  }
  const rootsMode = entry.roots === null ? 'full' : 'dirty';
  const roots = rootsMode === 'full'
    ? [globalThis.document?.documentElement]
    : (Array.isArray(entry.roots) ? entry.roots : []);
  if (roots.length === 0 || roots.some((root) => root == null)) {
    return { state: 'unavailable', reason: 'scan_root_identity_unavailable' };
  }

  const identities = [];
  for (const root of roots) {
    let identity = null;
    try {
      identity = normalizeNodeIdentity(getNodeIdentity(root));
    } catch {
      return { state: 'unavailable', reason: 'scan_root_identity_failed' };
    }
    if (!identity) {
      return { state: 'unavailable', reason: 'scan_root_identity_unavailable' };
    }
    identities.push(identity);
  }
  return {
    state: 'measured',
    key: `${rootsMode}:${Array.from(new Set(identities)).sort().join('|')}`,
  };
}

function resolveScanCausalSignature(operation) {
  const source = String(operation.source || '').trim();
  const flushIds = Array.from(new Set(operation.flushIds || []))
    .map(Number)
    .filter(Number.isFinite)
    .sort((left, right) => left - right);
  if (!source) return { state: 'unavailable', reason: 'scan_source_unavailable' };
  if (flushIds.length === 0 && source !== 'update' && source !== 'direct') {
    return { state: 'unavailable', reason: 'scan_causal_flush_identity_unavailable' };
  }
  return {
    state: 'measured',
    key: [
      source,
      `flush:${flushIds.join(',')}`,
      `kinds:${Array.from(new Set(operation.mutationKinds || [])).sort().join(',')}`,
      `attrs:${Array.from(new Set(operation.attributeNames || [])).sort().join(',')}`,
    ].join('|'),
  };
}

function recordDuplicateScanEvidence(
  manager,
  entry,
  operation,
  { activationSignature = null, getNodeIdentity = null, measurementEpoch = 0 } = {},
) {
  const audit = manager._debugStats.audit;
  const probeStartedAt = nowMs();
  const signatureCandidate = activationSignature ?? entry.activationSignature;
  const resolvedActivationSignature = typeof signatureCandidate === 'string'
    && signatureCandidate.length > 0
    ? signatureCandidate
    : null;
  const rootIdentitySet = resolveScanRootIdentitySet(entry, getNodeIdentity);
  const causalSignature = resolveScanCausalSignature(operation);
  if (
    !resolvedActivationSignature
    || rootIdentitySet.state !== 'measured'
    || causalSignature.state !== 'measured'
  ) {
    const reason = !resolvedActivationSignature
      ? 'activation_signature_unavailable'
      : (rootIdentitySet.state !== 'measured' ? rootIdentitySet.reason : causalSignature.reason);
    const evidence = {
      state: 'unavailable',
      reason,
      operationId: operation.id,
      group: operation.group,
      rootsMode: operation.rootsMode,
      rootCount: operation.rootCount,
    };
    audit.duplicateScanEvidenceUnavailable += 1;
    if (audit.duplicateScanEvaluations === 0) audit.duplicateScanEvidenceState = 'unavailable';
    audit.lastDuplicateScanEvidence = evidence;
    operation.duplicateScanEvidence = evidence;
    audit.scanEvidenceProbeMs += Math.max(0, nowMs() - probeStartedAt);
    return;
  }

  const state = getScanExecutionEvidenceState(manager._debugStats, measurementEpoch);
  const executionKey = [
    operation.group || '-',
    resolvedActivationSignature,
    rootIdentitySet.key,
    causalSignature.key,
  ].join('\u0000');
  const priorExecutionCount = state.executionCountsByKey.get(executionKey) || 0;
  const duplicate = priorExecutionCount > 0;
  const repeatKind = duplicate
    ? (state.lastExecutionKey === executionKey ? 'immediate' : 'repeated')
    : null;
  state.executionCountsByKey.set(executionKey, priorExecutionCount + 1);
  state.lastExecutionKey = executionKey;

  audit.duplicateScanEvaluations += 1;
  audit.duplicateScanEvidenceState = 'measured';
  if (duplicate) {
    audit.duplicateScans += 1;
    if (repeatKind === 'immediate') audit.immediateDuplicateScans += 1;
    else audit.repeatedDuplicateScans += 1;
  }
  const evidence = {
    state: 'measured',
    duplicate,
    repeatKind,
    priorExecutionCount,
    operationId: operation.id,
    group: operation.group,
    rootsMode: operation.rootsMode,
    rootCount: operation.rootCount,
  };
  audit.lastDuplicateScanEvidence = evidence;
  operation.duplicateScanEvidence = evidence;
  audit.scanEvidenceProbeMs += Math.max(0, nowMs() - probeStartedAt);
}

function recordAvoidableFullRescanEvidence(manager, entry, operation) {
  if (operation.rootsMode !== 'full') return;
  const audit = manager._debugStats.audit;
  audit.avoidableFullRescanEvaluations += 1;
  const dirtyRootsSufficient = entry.fullScanEvidence?.dirtyRootsSufficient;
  if (typeof dirtyRootsSufficient !== 'boolean') {
    const evidence = {
      state: 'unavailable',
      reason: entry.fullScanEvidence?.reason || 'dirty_root_sufficiency_unavailable',
      operationId: operation.id,
      group: operation.group,
      source: operation.source,
    };
    audit.avoidableFullRescanEvidenceUnavailable += 1;
    if (audit.avoidableFullRescanMeasuredExecutions === 0) {
      audit.avoidableFullRescanEvidenceState = 'unavailable';
    }
    audit.lastAvoidableFullRescanEvidence = evidence;
    operation.avoidableFullRescanEvidence = evidence;
    return;
  }

  audit.avoidableFullRescanMeasuredExecutions += 1;
  audit.avoidableFullRescanEvidenceState = 'measured';
  if (dirtyRootsSufficient) audit.avoidableFullRescans += 1;
  const evidence = {
    state: 'measured',
    avoidable: dirtyRootsSufficient,
    reason: entry.fullScanEvidence?.reason || (
      dirtyRootsSufficient ? 'dirty_roots_sufficient' : 'full_scope_required'
    ),
    operationId: operation.id,
    group: operation.group,
    source: operation.source,
    dirtyRootCount: Math.max(0, Number(entry.fullScanEvidence?.dirtyRootCount) || 0),
  };
  audit.lastAvoidableFullRescanEvidence = evidence;
  operation.avoidableFullRescanEvidence = evidence;
}

export function normalizeSocialMetricsAuditMode(mode) {
  const normalized = String(mode || '').trim().toLowerCase();
  if (Object.values(SOCIAL_METRICS_AUDIT_MODES).includes(normalized)) return normalized;
  throw new Error(`SOCIAL_METRICS_AUDIT_MODE_INVALID:${normalized || 'empty'}`);
}

export function createSelectorAuditState(mode = SOCIAL_METRICS_AUDIT_MODES.STANDARD) {
  return {
    enabled: false,
    mode,
    selectorCollections: 0,
    selectorQueries: 0,
    configuredSelectors: 0,
    selectorHits: 0,
    selectorUniqueHits: 0,
    selectorQueryMs: 0,
    selectorProbeMs: 0,
    selectorProbeQueries: 0,
    selectorProbeHits: 0,
    selectorProbeUniqueHits: 0,
    deepProbeCollections: 0,
    deepProbeSkippedCollections: 0,
    semanticHits: 0,
    selectorOnlyHits: 0,
    semanticOnlyHits: 0,
    selectorSemanticOverlapHits: 0,
    candidateUnionCollections: 0,
    selectorCompleteCollections: 0,
    semanticRequiredCollections: 0,
    semanticZeroIncrementCollections: 0,
    provenanceProbeMs: 0,
    semanticQueryMs: 0,
    resolvedCandidates: 0,
    decisionCount: 0,
    appliedDecisionCount: 0,
    appliedTargetDecisionCount: 0,
    clearedDecisionCount: 0,
    repeatedTargetDecisions: 0,
    uniqueAppliedTargetDecisions: 0,
    writeAttempts: 0,
    actualWrites: 0,
    unchangedWriteAttempts: 0,
    applyWriteAttempts: 0,
    applyUnchangedWriteAttempts: 0,
    cleanupWriteAttempts: 0,
    cleanupUnchangedWriteAttempts: 0,
    configurationCleanupWriteAttempts: 0,
    configurationCleanupUnchangedWriteAttempts: 0,
    actualWriteTargetCount: 0,
    applyActualWrites: 0,
    cleanupActualWrites: 0,
    configurationCleanupActualWrites: 0,
    writeProbeMs: 0,
    ownedMutationRecordProductMs: 0,
    ownedMutationFilterProductMs: 0,
    ownedMutationRecordAttempts: 0,
    ownedMutationRecordsArmed: 0,
    ownedMutationRecordRejects: 0,
    actualWriteDecisions: 0,
    unchangedNoopDecisions: 0,
    noWriteDecisions: 0,
    duplicateScans: 0,
    duplicateScanEvaluations: 0,
    duplicateScanEvidenceUnavailable: 0,
    duplicateScanEvidenceState: 'armed_idle',
    avoidableFullRescans: 0,
    avoidableFullRescanEvaluations: 0,
    avoidableFullRescanMeasuredExecutions: 0,
    avoidableFullRescanEvidenceUnavailable: 0,
    avoidableFullRescanEvidenceState: 'armed_idle',
    scanEvidenceProbeMs: 0,
    zeroCandidateCollections: 0,
    deepProbeCollectionLimit: SOCIAL_METRICS_DEEP_COLLECTION_LIMIT,
    deepProbeSelectorLimit: SOCIAL_METRICS_DEEP_SELECTOR_LIMIT,
    immediateDuplicateScans: 0,
    repeatedDuplicateScans: 0,
    lastDuplicateScanEvidence: null,
    lastAvoidableFullRescanEvidence: null,
    lowYieldCollections: 0,
    stackSamples: 0,
    lastCollection: null,
    lastDecision: null,
    recentCollections: [],
    recentDecisions: [],
    targetDecisionCounts: {},
    appliedTargetDecisionCounts: {},
    zeroCandidateCollectionCounts: {},
  };
}

function createScanTimingState() {
  return {
    queueWaitTotalMs: 0,
    queueWaitMaxMs: 0,
    selectorQueryTotalMs: 0,
    semanticQueryTotalMs: 0,
    selectorProbeOverheadTotalMs: 0,
    idleWaitTotalMs: 0,
    idleWaitMaxMs: 0,
    chunkTotalMs: 0,
    chunkMaxMs: 0,
    chunkCount: 0,
    applyTotalMs: 0,
    applyMaxMs: 0,
    applyCount: 0,
    cleanupTotalMs: 0,
    cleanupMaxMs: 0,
    cleanupCount: 0,
    configurationCleanupTotalMs: 0,
    configurationCleanupMaxMs: 0,
    configurationCleanupCount: 0,
    scanTotalMs: 0,
    scanMaxMs: 0,
  };
}

function createSelectorDriftRecoveryStats() {
  return {
    operations: 0,
    observedOperations: 0,
    identityIncompleteOperations: 0,
    decisions: 0,
    applyTargetCount: 0,
    clearTargetCount: 0,
    actualWriteTargetCount: 0,
    unchangedTargetCount: 0,
  };
}

export function createSocialMetricsDebugStats(
  auditMode = SOCIAL_METRICS_AUDIT_MODES.STANDARD,
) {
  return {
    mutationSchedules: 0,
    zeroRootSchedules: 0,
    selectorRootTotal: 0,
    semanticRootTotal: 0,
    rootTotal: 0,
    maxMutationRootCount: 0,
    lastMutationPayload: {
      addedNodes: 0,
      textNodes: 0,
      attributeTargets: 0,
    },
    lastSelectorRootCount: 0,
    lastSemanticRootCount: 0,
    lastMutationRootCount: 0,
    queuedScans: 0,
    scanAdmissions: 0,
    enqueuedScans: 0,
    mergedScans: 0,
    routedMutationGroups: 0,
    skippedMutationGroups: 0,
    routedRuleSkips: 0,
    hostRootRelevanceSkips: 0,
    selfMutationRecordsConsumed: 0,
    lastMutationRouting: null,
    skippedIrrelevantScans: 0,
    admittedFullScans: 0,
    admittedDirtyScans: 0,
    fullScans: 0,
    rootScans: 0,
    executedScans: 0,
    executedFullScans: 0,
    executedDirtyScans: 0,
    candidateCollections: 0,
    lastCandidateCount: 0,
    maxCandidateCount: 0,
    processedCandidates: 0,
    scanOperations: 0,
    completedScanOperations: 0,
    emptyScanOperations: 0,
    failedScanOperations: 0,
    cancelledScanOperations: 0,
    lastQueuedScan: null,
    lastCandidateCollection: null,
    lastScanOperation: null,
    recentScanOperations: [],
    selectorDriftRecovery: createSelectorDriftRecoveryStats(),
    workReasonCounts: Object.fromEntries(
      Object.values(SOCIAL_METRICS_SCAN_WORK_REASONS).map((reason) => [reason, 0]),
    ),
    timings: createScanTimingState(),
    audit: createSelectorAuditState(auditMode),
  };
}

function getCurrentOperation(manager, entry) {
  const operation = entry?._debugOperation;
  if (!operation || operation._statsRef !== manager._debugStats) return null;
  return operation;
}

function summarizeTerminalDisposition(operation) {
  let terminalApplyTargetCount = 0;
  let terminalClearTargetCount = 0;
  let terminalUnknownTargetCount = operation._terminalUnidentifiedTargetCount;
  operation._terminalDispositionByTarget.forEach((disposition) => {
    if (disposition === 'apply') terminalApplyTargetCount += 1;
    else if (disposition === 'clear') terminalClearTargetCount += 1;
    else terminalUnknownTargetCount += 1;
  });
  const terminalDispositionTargetCount = terminalApplyTargetCount
    + terminalClearTargetCount
    + terminalUnknownTargetCount;
  let terminalDisposition = 'unknown';
  if (terminalUnknownTargetCount === 0 && terminalApplyTargetCount > 0) {
    terminalDisposition = terminalClearTargetCount > 0 ? 'mixed' : 'apply';
  } else if (terminalUnknownTargetCount === 0 && terminalClearTargetCount > 0) {
    terminalDisposition = 'clear';
  }
  return {
    terminalDisposition,
    terminalDispositionTargetCount,
    terminalApplyTargetCount,
    terminalClearTargetCount,
    terminalUnknownTargetCount,
  };
}

export function startSocialMetricsScanOperation(
  manager,
  entry = {},
  {
    enabled = false,
    activationSignature = null,
    getNodeIdentity = null,
    measurementEpoch = 0,
    siteId = null,
  } = {},
) {
  if (!Number.isSafeInteger(measurementEpoch) || measurementEpoch < 0) {
    throw new Error('SOCIAL_METRICS_SCAN_MEASUREMENT_EPOCH_INVALID');
  }
  if (siteId !== null && (typeof siteId !== 'string' || siteId.length === 0)) {
    throw new Error('SOCIAL_METRICS_SCAN_SITE_ID_INVALID');
  }
  const stats = manager._debugStats;
  entry.revalidationEvidenceCount = 0;
  stats.executedScans += 1;
  if (entry.roots === null) stats.executedFullScans += 1;
  else stats.executedDirtyScans += 1;
  if (!enabled) return null;
  const startedAt = nowMs();
  const scheduledAt = Number(entry.debugScheduleContext?.scheduledAt);
  const queueWaitMs = Number.isFinite(scheduledAt)
    ? Math.max(0, startedAt - scheduledAt)
    : 0;
  const flushIds = Array.isArray(entry.debugScheduleContext?.flushIds)
    ? entry.debugScheduleContext.flushIds.filter((value) => Number.isFinite(Number(value))).map(Number)
    : [];
  const signatureCandidate = activationSignature ?? entry.activationSignature;
  const resolvedActivationSignature = typeof signatureCandidate === 'string'
    && signatureCandidate.length > 0
    ? signatureCandidate
    : null;
  const operation = {
    id: ++manager._debugScanSequence,
    executionOrdinal: stats.executedScans,
    measurementEpoch,
    siteId,
    activationSignature: resolvedActivationSignature,
    group: entry.group || null,
    filterKeys: Array.isArray(entry.filterKeys) ? [...entry.filterKeys] : [],
    source: entry.scanSource || 'unknown',
    workReason: resolveScanWorkReason(entry.scanSource || 'unknown'),
    rootsMode: entry.roots === null ? 'full' : 'dirty',
    rootCount: Array.isArray(entry.roots) ? entry.roots.length : 0,
    flushIds: Array.from(new Set(flushIds)).slice(-SOCIAL_METRICS_CORRELATION_LIMIT),
    mutationKinds: Array.isArray(entry.routingEvidence?.mutationKinds)
      ? [...entry.routingEvidence.mutationKinds]
      : [],
    attributeNames: Array.isArray(entry.routingEvidence?.attributeNames)
      ? [...entry.routingEvidence.attributeNames]
      : [],
    candidateCount: 0,
    selectorHitCount: 0,
    semanticHitCount: 0,
    decisionCount: 0,
    lastDecisionKind: 'unknown',
    lastDecisionWriteOutcome: 'unknown',
    terminalUnclassifiedReconciliationWriteCount: 0,
    processedCandidates: 0,
    chunks: 0,
    queueWaitMs,
    selectorQueryMs: 0,
    selectorProbeMs: 0,
    semanticQueryMs: 0,
    idleWaitMs: 0,
    chunkMs: 0,
    applyMs: 0,
    cleanupMs: 0,
    writeAttempts: 0,
    actualWrites: 0,
    unchangedWriteAttempts: 0,
    applyActualWrites: 0,
    cleanupActualWrites: 0,
    _terminalDispositionByTarget: new Map(),
    _terminalUnidentifiedTargetCount: 0,
    _candidateProvenanceByNode: new WeakMap(),
    _selectorDriftRecoveryByTarget: new Map(),
    _selectorDriftRecoveryUnidentifiedTargetCount: 0,
    _selectorDriftRecoveryDecisionCount: 0,
    _startedAt: startedAt,
    _idleScheduledAt: null,
    _statsRef: manager._debugStats,
  };
  entry._debugOperation = operation;
  stats.scanOperations += 1;
  stats.workReasonCounts[operation.workReason] += 1;
  recordDuplicateScanEvidence(manager, entry, operation, {
    activationSignature,
    getNodeIdentity,
    measurementEpoch,
  });
  recordAvoidableFullRescanEvidence(manager, entry, operation);
  stats.timings.queueWaitTotalMs += queueWaitMs;
  if (queueWaitMs > stats.timings.queueWaitMaxMs) stats.timings.queueWaitMaxMs = queueWaitMs;
  return operation;
}

export function recordSocialMetricsCandidateProvenance(
  manager,
  entry = {},
  candidate = null,
  provenance = null,
) {
  const operation = getCurrentOperation(manager, entry);
  if (!operation || !(candidate instanceof Element)) return;
  operation._candidateProvenanceByNode.set(
    candidate,
    requireSocialMetricsCandidateProvenance(provenance),
  );
}

export function readSocialMetricsCandidateProvenance(manager, entry = {}, candidate = null) {
  const operation = getCurrentOperation(manager, entry);
  if (!operation || !(candidate instanceof Element)) return null;
  return operation._candidateProvenanceByNode.get(candidate) || null;
}

export function recordSocialMetricsSelectorDriftRecovery(
  manager,
  entry = {},
  {
    siteId = null,
    matchedKey = null,
    provenance = null,
    surface = null,
    disposition = 'unknown',
    targetIdentityKeys = [],
    actualWriteTargetIdentityKeys = [],
    unidentifiedTargetCount = 0,
    writeOutcome = 'no_write',
  } = {},
) {
  const operation = getCurrentOperation(manager, entry);
  if (!operation || !isSocialMetricsSelectorDriftPilotDecision({
    siteId,
    matchedKey,
    provenance,
    surface,
  })) return;
  operation._selectorDriftRecoveryDecisionCount += 1;
  if (!SOCIAL_METRICS_SELECTOR_DRIFT_WRITE_OUTCOMES.has(writeOutcome)) return;
  if (!SOCIAL_METRICS_TERMINAL_DISPOSITIONS.has(disposition)) {
    throw new Error('SOCIAL_METRICS_SELECTOR_DRIFT_DISPOSITION_INVALID');
  }
  if (!Array.isArray(targetIdentityKeys)) {
    throw new Error('SOCIAL_METRICS_SELECTOR_DRIFT_TARGET_IDENTITIES_INVALID');
  }
  if (!Array.isArray(actualWriteTargetIdentityKeys)) {
    throw new Error('SOCIAL_METRICS_SELECTOR_DRIFT_WRITE_TARGET_IDENTITIES_INVALID');
  }
  if (!Number.isSafeInteger(unidentifiedTargetCount) || unidentifiedTargetCount < 0) {
    throw new Error('SOCIAL_METRICS_SELECTOR_DRIFT_UNIDENTIFIED_TARGET_COUNT_INVALID');
  }
  const normalizedTargetIdentityKeys = Array.from(new Set(targetIdentityKeys));
  const normalizedActualWriteTargetIdentityKeys = Array.from(
    new Set(actualWriteTargetIdentityKeys),
  );
  if (normalizedTargetIdentityKeys.some((key) => typeof key !== 'string' || key.length === 0)) {
    throw new Error('SOCIAL_METRICS_SELECTOR_DRIFT_TARGET_IDENTITY_INVALID');
  }
  if (normalizedActualWriteTargetIdentityKeys.some((key) => (
    typeof key !== 'string' || key.length === 0
  ))) {
    throw new Error('SOCIAL_METRICS_SELECTOR_DRIFT_WRITE_TARGET_IDENTITY_INVALID');
  }
  if (writeOutcome === 'actual_write') {
    const expected = [...normalizedTargetIdentityKeys].sort();
    const actual = [...normalizedActualWriteTargetIdentityKeys].sort();
    const identityExact = expected.length > 0
      && expected.length === actual.length
      && expected.every((key, index) => key === actual[index]);
    if (!identityExact) {
      operation._selectorDriftRecoveryUnidentifiedTargetCount += Math.max(
        1,
        unidentifiedTargetCount,
        normalizedTargetIdentityKeys.length,
      );
      return;
    }
  }
  normalizedTargetIdentityKeys.forEach((key) => {
    const current = operation._selectorDriftRecoveryByTarget.get(key);
    operation._selectorDriftRecoveryByTarget.set(key, {
      disposition,
      matchedKey,
      surface,
      writeOutcome: current?.writeOutcome === 'actual_write'
        ? 'actual_write'
        : writeOutcome,
    });
  });
  operation._selectorDriftRecoveryUnidentifiedTargetCount += unidentifiedTargetCount;
}

function summarizeSelectorDriftRecovery(operation) {
  let applyTargetCount = 0;
  let clearTargetCount = 0;
  let unknownTargetCount = operation._selectorDriftRecoveryUnidentifiedTargetCount;
  let actualWriteTargetCount = 0;
  let unchangedTargetCount = 0;
  const filterKeys = new Set();
  const surfaces = new Set();
  operation._selectorDriftRecoveryByTarget.forEach((evidence) => {
    filterKeys.add(evidence.matchedKey);
    if (evidence.surface) surfaces.add(evidence.surface);
    if (evidence.disposition === 'apply') applyTargetCount += 1;
    else if (evidence.disposition === 'clear') clearTargetCount += 1;
    else unknownTargetCount += 1;
    if (evidence.writeOutcome === 'actual_write') actualWriteTargetCount += 1;
    else if (evidence.writeOutcome === 'unchanged_noop') unchangedTargetCount += 1;
  });
  const terminalTargetCount = applyTargetCount + clearTargetCount + unknownTargetCount;
  let state = 'not_observed';
  if (unknownTargetCount > 0) state = 'identity_incomplete';
  else if (applyTargetCount > 0) state = 'recovered';
  else if (operation._selectorDriftRecoveryDecisionCount > 0) state = 'no_effect_applied';
  return Object.freeze({
    state,
    decisionCount: operation._selectorDriftRecoveryDecisionCount,
    terminalTargetCount,
    applyTargetCount,
    clearTargetCount,
    unknownTargetCount,
    actualWriteTargetCount,
    unchangedTargetCount,
    filterKeys: Object.freeze(Array.from(filterKeys).sort()),
    surfaces: Object.freeze(Array.from(surfaces).sort()),
    effectOwner: 'social_metrics_owned_mutation_ledger',
    runtimeSelectorGenerated: false,
    canonicalProfileWritten: false,
  });
}

export function recordSocialMetricsTerminalDisposition(
  manager,
  entry = {},
  {
    disposition = 'unknown',
    targetIdentityKeys = [],
    unidentifiedTargetCount = 0,
    writeOutcome = 'no_write',
  } = {},
) {
  const operation = getCurrentOperation(manager, entry);
  if (!operation) return;
  if (!SOCIAL_METRICS_EFFECT_BEARING_WRITE_OUTCOMES.has(writeOutcome)) return;
  if (!SOCIAL_METRICS_TERMINAL_DISPOSITIONS.has(disposition)) {
    throw new Error('SOCIAL_METRICS_TERMINAL_DISPOSITION_INVALID');
  }
  if (!Array.isArray(targetIdentityKeys)) {
    throw new Error('SOCIAL_METRICS_TERMINAL_TARGET_IDENTITIES_INVALID');
  }
  if (!Number.isSafeInteger(unidentifiedTargetCount) || unidentifiedTargetCount < 0) {
    throw new Error('SOCIAL_METRICS_TERMINAL_UNIDENTIFIED_TARGET_COUNT_INVALID');
  }
  const normalizedTargetIdentityKeys = Array.from(new Set(targetIdentityKeys));
  if (normalizedTargetIdentityKeys.some((key) => typeof key !== 'string' || key.length === 0)) {
    throw new Error('SOCIAL_METRICS_TERMINAL_TARGET_IDENTITY_INVALID');
  }
  normalizedTargetIdentityKeys.forEach((key) => {
    operation._terminalDispositionByTarget.set(key, disposition);
  });
  operation._terminalUnidentifiedTargetCount += unidentifiedTargetCount;
}

export function recordSocialMetricsScanCollection(manager, entry = {}, details = {}) {
  const operation = getCurrentOperation(manager, entry);
  if (!operation) return;
  operation.candidateCount = Math.max(0, Number(details.candidateCount) || 0);
  operation.selectorQueryMs += Math.max(0, Number(details.selectorQueryMs) || 0);
  operation.selectorProbeMs += Math.max(0, Number(details.selectorProbeMs) || 0);
  operation.semanticQueryMs += Math.max(0, Number(details.semanticQueryMs) || 0);
  const timings = manager._debugStats.timings;
  timings.selectorQueryTotalMs += Math.max(0, Number(details.selectorQueryMs) || 0);
  timings.selectorProbeOverheadTotalMs += Math.max(0, Number(details.selectorProbeMs) || 0);
  timings.semanticQueryTotalMs += Math.max(0, Number(details.semanticQueryMs) || 0);
}

export function recordSocialMetricsScanIdleScheduled(manager, entry = {}) {
  const operation = getCurrentOperation(manager, entry);
  if (operation) operation._idleScheduledAt = nowMs();
}

export function beginSocialMetricsScanChunk(manager, entry = {}) {
  const operation = getCurrentOperation(manager, entry);
  if (!operation) return null;
  const startedAt = nowMs();
  if (Number.isFinite(operation._idleScheduledAt)) {
    const idleWaitMs = Math.max(0, startedAt - operation._idleScheduledAt);
    operation.idleWaitMs += idleWaitMs;
    manager._debugStats.timings.idleWaitTotalMs += idleWaitMs;
    if (idleWaitMs > manager._debugStats.timings.idleWaitMaxMs) {
      manager._debugStats.timings.idleWaitMaxMs = idleWaitMs;
    }
  }
  operation._idleScheduledAt = null;
  return startedAt;
}

export function finishSocialMetricsScanChunk(
  manager,
  entry = {},
  { startedAt = null, processed = 0 } = {},
) {
  const operation = getCurrentOperation(manager, entry);
  if (!operation || !Number.isFinite(startedAt)) return;
  const durationMs = Math.max(0, nowMs() - startedAt);
  operation.chunks += 1;
  operation.processedCandidates += Math.max(0, Number(processed) || 0);
  operation.chunkMs += durationMs;
  const timings = manager._debugStats.timings;
  timings.chunkCount += 1;
  timings.chunkTotalMs += durationMs;
  if (durationMs > timings.chunkMaxMs) timings.chunkMaxMs = durationMs;
  recordRuntimeOwnerWork({
    ownerId: 'socialMetrics',
    phase: 'scan_chunk',
    source: operation.source,
    startedAt,
    endedAt: startedAt + durationMs,
    units: processed,
    flushId: operation.flushIds.at(-1) || null,
  });
}

export function recordSocialMetricsScanApply(manager, entry = {}, durationMs = 0) {
  const operation = getCurrentOperation(manager, entry);
  if (!operation) return;
  const resolvedDurationMs = Math.max(0, Number(durationMs) || 0);
  operation.applyMs += resolvedDurationMs;
  const timings = manager._debugStats.timings;
  timings.applyCount += 1;
  timings.applyTotalMs += resolvedDurationMs;
  if (resolvedDurationMs > timings.applyMaxMs) timings.applyMaxMs = resolvedDurationMs;
}

export function recordSocialMetricsScanCleanup(manager, entry = {}, durationMs = 0) {
  const operation = getCurrentOperation(manager, entry);
  if (!operation) return;
  const resolvedDurationMs = Math.max(0, Number(durationMs) || 0);
  operation.cleanupMs += resolvedDurationMs;
  const timings = manager._debugStats.timings;
  timings.cleanupCount += 1;
  timings.cleanupTotalMs += resolvedDurationMs;
  if (resolvedDurationMs > timings.cleanupMaxMs) timings.cleanupMaxMs = resolvedDurationMs;
}

export function recordSocialMetricsConfigurationCleanup(manager, durationMs = 0) {
  const timings = manager._debugStats?.timings;
  if (!timings) return;
  const resolvedDurationMs = Math.max(0, Number(durationMs) || 0);
  timings.configurationCleanupCount += 1;
  timings.configurationCleanupTotalMs += resolvedDurationMs;
  if (resolvedDurationMs > timings.configurationCleanupMaxMs) {
    timings.configurationCleanupMaxMs = resolvedDurationMs;
  }
}

export function recordSocialMetricsWriteAttempt(
  manager,
  entry = {},
  {
    changed = false,
    phase = 'apply',
    reconciliationDisposition = null,
    reconciliationTargetIdentityKey = null,
    uniqueTarget = false,
  } = {},
) {
  if (
    reconciliationDisposition !== null
    && reconciliationDisposition !== 'apply'
    && reconciliationDisposition !== 'clear'
  ) {
    throw new Error('SOCIAL_METRICS_RECONCILIATION_DISPOSITION_INVALID');
  }
  if (
    reconciliationTargetIdentityKey !== null
    && (
      typeof reconciliationTargetIdentityKey !== 'string'
      || reconciliationTargetIdentityKey.length === 0
    )
  ) {
    throw new Error('SOCIAL_METRICS_RECONCILIATION_TARGET_IDENTITY_INVALID');
  }
  const audit = manager._debugStats?.audit;
  if (!audit) return;
  const normalizedPhase = phase === 'post_chunk_cleanup'
    ? 'post_chunk_cleanup'
    : phase === 'configuration_cleanup'
      ? 'configuration_cleanup'
      : 'apply';
  audit.writeAttempts += 1;
  if (normalizedPhase === 'post_chunk_cleanup') audit.cleanupWriteAttempts += 1;
  else if (normalizedPhase === 'configuration_cleanup') {
    audit.configurationCleanupWriteAttempts += 1;
  } else audit.applyWriteAttempts += 1;
  if (changed) {
    audit.actualWrites += 1;
    if (uniqueTarget) audit.actualWriteTargetCount += 1;
    if (phase === 'post_chunk_cleanup') audit.cleanupActualWrites += 1;
    else if (phase === 'configuration_cleanup') audit.configurationCleanupActualWrites += 1;
    else audit.applyActualWrites += 1;
  } else {
    audit.unchangedWriteAttempts += 1;
    if (normalizedPhase === 'post_chunk_cleanup') audit.cleanupUnchangedWriteAttempts += 1;
    else if (normalizedPhase === 'configuration_cleanup') {
      audit.configurationCleanupUnchangedWriteAttempts += 1;
    } else audit.applyUnchangedWriteAttempts += 1;
  }

  const operation = getCurrentOperation(manager, entry);
  if (!operation) return;
  operation.writeAttempts += 1;
  if (changed) {
    operation.actualWrites += 1;
    if (phase === 'post_chunk_cleanup') {
      operation.cleanupActualWrites += 1;
      if (reconciliationDisposition && reconciliationTargetIdentityKey) {
        operation._terminalDispositionByTarget.set(
          reconciliationTargetIdentityKey,
          reconciliationDisposition,
        );
      } else {
        operation.terminalUnclassifiedReconciliationWriteCount += 1;
      }
    } else if (phase !== 'configuration_cleanup') operation.applyActualWrites += 1;
  } else {
    operation.unchangedWriteAttempts += 1;
  }
}

export function finishSocialMetricsScanOperation(
  manager,
  entry = {},
  outcome = 'completed',
  error = null,
) {
  const operation = entry?._debugOperation;
  if (!operation) return;
  delete entry._debugOperation;
  if (operation._statsRef !== manager._debugStats) return;
  const totalMs = Math.max(0, nowMs() - operation._startedAt);
  const terminalDisposition = summarizeTerminalDisposition(operation);
  const selectorDriftRecovery = summarizeSelectorDriftRecovery(operation);
  const record = {
    id: operation.id,
    executionOrdinal: operation.executionOrdinal,
    measurementEpoch: operation.measurementEpoch,
    siteId: operation.siteId,
    activationSignature: operation.activationSignature,
    group: operation.group,
    filterKeys: [...operation.filterKeys],
    source: operation.source,
    workReason: operation.workReason,
    rootsMode: operation.rootsMode,
    rootCount: operation.rootCount,
    flushIds: [...operation.flushIds],
    mutationKinds: [...operation.mutationKinds],
    attributeNames: [...operation.attributeNames],
    outcome,
    error: error ? compactError(error) : null,
    candidateCount: operation.candidateCount,
    revalidationEvidenceCount: entry.revalidationEvidenceCount,
    selectorHitCount: operation.selectorHitCount,
    semanticHitCount: operation.semanticHitCount,
    collectionState: entry.collectionState || 'unknown',
    decisionCount: operation.decisionCount,
    lastDecisionKind: operation.lastDecisionKind,
    lastDecisionWriteOutcome: operation.lastDecisionWriteOutcome,
    ...terminalDisposition,
    selectorDriftRecovery,
    terminalUnclassifiedReconciliationWriteCount:
      operation.terminalUnclassifiedReconciliationWriteCount,
    processedCandidates: operation.processedCandidates,
    chunks: operation.chunks,
    queueWaitMs: roundMs(operation.queueWaitMs),
    selectorQueryMs: roundMs(operation.selectorQueryMs),
    selectorProbeMs: roundMs(operation.selectorProbeMs),
    semanticQueryMs: roundMs(operation.semanticQueryMs),
    idleWaitMs: roundMs(operation.idleWaitMs),
    chunkMs: roundMs(operation.chunkMs),
    applyMs: roundMs(operation.applyMs),
    cleanupMs: roundMs(operation.cleanupMs),
    writeAttempts: operation.writeAttempts,
    actualWrites: operation.actualWrites,
    unchangedWriteAttempts: operation.unchangedWriteAttempts,
    applyActualWrites: operation.applyActualWrites,
    cleanupActualWrites: operation.cleanupActualWrites,
    duplicateScanEvidence: operation.duplicateScanEvidence
      ? { ...operation.duplicateScanEvidence }
      : null,
    avoidableFullRescanEvidence: operation.avoidableFullRescanEvidence
      ? { ...operation.avoidableFullRescanEvidence }
      : null,
    totalMs: roundMs(totalMs),
  };
  const stats = manager._debugStats;
  const recoveryStats = stats.selectorDriftRecovery;
  recoveryStats.operations += 1;
  recoveryStats.decisions += selectorDriftRecovery.decisionCount;
  recoveryStats.applyTargetCount += selectorDriftRecovery.applyTargetCount;
  recoveryStats.clearTargetCount += selectorDriftRecovery.clearTargetCount;
  recoveryStats.actualWriteTargetCount +=
    selectorDriftRecovery.actualWriteTargetCount;
  recoveryStats.unchangedTargetCount += selectorDriftRecovery.unchangedTargetCount;
  if (selectorDriftRecovery.state === 'recovered') {
    recoveryStats.observedOperations += 1;
  } else if (selectorDriftRecovery.state === 'identity_incomplete') {
    recoveryStats.identityIncompleteOperations += 1;
  }
  if (outcome === 'completed') stats.completedScanOperations += 1;
  else if (outcome === 'empty') stats.emptyScanOperations += 1;
  else if (outcome === 'failed') stats.failedScanOperations += 1;
  else if (outcome === 'cancelled') stats.cancelledScanOperations += 1;
  stats.timings.scanTotalMs += totalMs;
  if (totalMs > stats.timings.scanMaxMs) stats.timings.scanMaxMs = totalMs;
  stats.lastScanOperation = record;
  pushRecent(stats.recentScanOperations, record, RECENT_OPERATION_LIMIT);
}

export function recordSocialMetricsMutationSchedule(
  manager,
  debugContext = null,
  { enabled = false } = {},
) {
  if (!enabled) {
    manager._pendingMutationDebug = null;
    return;
  }
  if (!manager._pendingMutationDebug) {
    manager._pendingMutationDebug = {
      scheduledAt: nowMs(),
      flushIds: new Set(),
    };
  }
  const flushId = Number(debugContext?.flushId);
  if (Number.isFinite(flushId)) manager._pendingMutationDebug.flushIds.add(flushId);
}

export function consumeSocialMetricsMutationSchedule(manager, { enabled = false } = {}) {
  const pending = manager._pendingMutationDebug;
  manager._pendingMutationDebug = null;
  if (!pending || !enabled) return null;
  return {
    scheduledAt: pending.scheduledAt,
    flushIds: Array.from(pending.flushIds).slice(-SOCIAL_METRICS_CORRELATION_LIMIT),
  };
}
