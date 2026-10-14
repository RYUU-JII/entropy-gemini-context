import fs from 'node:fs/promises';
import path from 'node:path';

import {
  median,
  sanitizeSiteHarnessUrl,
  summarizeMetricRepeats,
} from './siteRuntimeMetrics.mjs';
import {
  SOCIAL_METRICS_SELECTOR_DRIFT_PILOT,
} from '../../../src/domains/nudge/visual/socialMetrics/core/selectorDriftRecoveryContract.js';

export const SITE_RUN_OUTCOMES = Object.freeze({
  PASS: 'PASS',
  WARN: 'WARN',
  FAIL: 'FAIL',
  INCONCLUSIVE: 'INCONCLUSIVE',
});

const OUTCOME_WEIGHT = Object.freeze({
  PASS: 0,
  WARN: 1,
  INCONCLUSIVE: 2,
  FAIL: 3,
});

const COMPARISON_LANES = Object.freeze(['diagnostic', 'release']);

const INTERNAL_COST_METRIC_PATHS = Object.freeze({
  duplicateScans: ['duplicateScans'],
  avoidableFullRescans: ['avoidableFullRescans'],
  duplicateScanEvaluations: ['duplicateScanEvidence', 'evaluations'],
  duplicateScanEvidenceUnavailable: ['duplicateScanEvidence', 'unavailableEvaluations'],
  avoidableFullRescanEvaluations: ['avoidableFullRescanEvidence', 'evaluations'],
  avoidableFullRescanMeasuredExecutions: ['avoidableFullRescanEvidence', 'measuredExecutions'],
  avoidableFullRescanEvidenceUnavailable: ['avoidableFullRescanEvidence', 'unavailableEvaluations'],
  admittedFullScans: ['scanShape', 'admittedFullScans'],
  admittedDirtyScans: ['scanShape', 'admittedDirtyScans'],
  executedFullScans: ['scanShape', 'executedFullScans'],
  executedDirtyScans: ['scanShape', 'executedDirtyScans'],
  scanAdmissions: ['scanRouting', 'admissions'],
  enqueuedScans: ['scanRouting', 'enqueued'],
  mergedScans: ['scanRouting', 'merged'],
  scanMergeSharePercent: ['scanRouting', 'mergeShare', 'percent'],
  routedMutationGroups: ['scanRouting', 'routedMutationGroups'],
  skippedMutationGroups: ['scanRouting', 'skippedMutationGroups'],
  mutationRuleSkips: ['scanRouting', 'mutationRuleSkips'],
  hostRootRelevanceSkips: ['scanRouting', 'hostRootRelevanceSkips'],
  selfMutationRecordsConsumed: ['scanRouting', 'selfMutationRecordsConsumed'],
  dirtyRootBreadthTotal: ['dirtyRootBreadth', 'total'],
  dirtyRootBreadthMax: ['dirtyRootBreadth', 'max'],
  observerFlushes: ['observer', 'flushes'],
  observerMutations: ['observer', 'mutations'],
  observerAttributeOnlyFlushes: ['observer', 'flushShape', 'attributeOnly'],
  observerChildOnlyFlushes: ['observer', 'flushShape', 'childOnly'],
  observerMixedFlushes: ['observer', 'flushShape', 'mixed'],
  observerTinyFlushes: ['observer', 'flushShape', 'tiny'],
  observerQueueWaitMs: ['observer', 'queueWaitMs'],
  observerSubscriberCallbackMs: ['observer', 'subscriberCallbackMs'],
  observerStyleMutations: ['observer', 'attributeMutationCounts', 'style'],
  observerClassMutations: ['observer', 'attributeMutationCounts', 'class'],
  visualMediaOperations: ['visualMedia', 'operations'],
  visualMediaMutationScans: ['visualMedia', 'mutationScans'],
  visualMediaIncomingRoots: ['visualMedia', 'incomingRoots'],
  visualMediaRelevantRoots: ['visualMedia', 'relevantRoots'],
  visualMediaWrites: ['visualMedia', 'writes'],
  visualMediaNoops: ['visualMedia', 'noops'],
  visualMediaManagedTargetStyleRootsSkipped: ['visualMedia', 'managedTargetStyleRootsSkipped'],
  visualMediaCompositeEffectCreates: ['visualMedia', 'compositeEffectCreates'],
  visualMediaCompositeEffectUpdates: ['visualMedia', 'compositeEffectUpdates'],
  visualMediaCompositeEffectRecreates: ['visualMedia', 'compositeEffectRecreates'],
  visualMediaCompositeEffectCancels: ['visualMedia', 'compositeEffectCancels'],
  visualMediaCompositeEffectCreateMs: ['visualMedia', 'compositeEffectCreateMs'],
  visualMediaCompositeEffectUpdateMs: ['visualMedia', 'compositeEffectUpdateMs'],
  visualMediaCompositeEffectCancelMs: ['visualMedia', 'compositeEffectCancelMs'],
  visualMediaTotalMs: ['visualMedia', 'totalMs'],
  visualMediaDebugOverheadMs: ['visualMedia', 'debugOverheadMs'],
  selectorHits: ['ratios', 'selectorHits'],
  resolvedTargets: ['ratios', 'resolvedCandidates'],
  nonClearCandidateDecisions: ['ratios', 'nonClearCandidateDecisions'],
  semanticCandidates: ['ratios', 'semanticCandidates'],
  candidateDecisions: ['ratios', 'candidateDecisions'],
  selectorOnlyHits: ['provenance', 'selectorOnlyHits'],
  semanticOnlyHits: ['provenance', 'semanticOnlyHits'],
  selectorSemanticOverlapHits: ['provenance', 'selectorSemanticOverlapHits'],
  semanticIncrementalYieldPercent: ['provenance', 'semanticIncrementalYield', 'percent'],
  selectorDriftRecoveryApplyTargets: [
    'provenance',
    'selectorDriftRecovery',
    'applyTargetCount',
  ],
  selectorDriftRecoveryActualWriteTargets: [
    'provenance',
    'selectorDriftRecovery',
    'actualWriteTargetCount',
  ],
  writeNonClearCandidateDecisions: ['writes', 'nonClearCandidateDecisions'],
  writeAttempts: ['writes', 'writeAttempts'],
  allPhysicalWritesIncludingCleanup: ['writes', 'allPhysicalWritesIncludingCleanup'],
  unchangedWriteAttempts: ['writes', 'unchangedWriteAttempts'],
  actualWriteTargetCount: ['writes', 'actualWriteTargetCount'],
  applyPhysicalWrites: ['writes', 'applyPhysicalWrites'],
  postChunkCleanupPhysicalWrites: ['writes', 'postChunkCleanupPhysicalWrites'],
  configurationCleanupPhysicalWrites: ['writes', 'configurationCleanupPhysicalWrites'],
  nonClearTargetTouches: ['writes', 'nonClearTargetTouches'],
  actualWriteDecisions: ['writes', 'actualWriteDecisions'],
  unchangedNoopDecisions: ['writes', 'unchangedNoopDecisions'],
  noWriteDecisions: ['writes', 'noWriteDecisions'],
  allWritesPerNonClearCandidateDecision: ['writes', 'allWritesPerNonClearCandidateDecision', 'ratio'],
  applyWritesPerNonClearCandidateDecision: ['writes', 'applyWritesPerNonClearCandidateDecision', 'ratio'],
  allWritesPerNonClearTargetTouch: ['writes', 'allWritesPerNonClearTargetTouch', 'ratio'],
  actualWriteRatePercent: ['writes', 'actualWriteRate', 'percent'],
  unchangedWriteRatePercent: ['writes', 'unchangedWriteRate', 'percent'],
  zeroCandidateCollections: ['zeroCandidateCollections'],
  repeatedTargetTouches: ['repeatedTargetTouches'],
  uniqueTargetTouches: ['uniqueTargetTouches'],
  targetTouchRepeatSharePercent: ['repeatedTargetTouchShare', 'percent'],
  selectorMs: ['timings', 'selectorMs'],
  semanticMs: ['timings', 'semanticMs'],
  idleMs: ['timings', 'idleMs'],
  applyMs: ['timings', 'applyMs'],
  cleanupMs: ['timings', 'cleanupMs'],
  postChunkCleanupMs: ['timings', 'postChunkCleanupMs'],
  configurationCleanupMs: ['timings', 'configurationCleanupMs'],
  ownedMutationRecordProductMs: ['timings', 'ownedMutationRecordProductMs'],
  ownedMutationFilterProductMs: ['timings', 'ownedMutationFilterProductMs'],
  instrumentedElapsedMs: ['timings', 'instrumentedElapsedMs'],
  knownInPathDebuggerOverheadMs: ['timings', 'knownInPathDebuggerOverheadMs'],
  estimatedProductElapsedMs: ['timings', 'estimatedProductElapsedMs'],
  ownedMutationFailOpenTotal: ['ownedMutationIntegrity', 'total'],
  ownedMutationExpiredByAge: ['ownedMutationIntegrity', 'expiredByAge'],
  ownedMutationExpiredByDelivery: ['ownedMutationIntegrity', 'expiredByDelivery'],
  ownedMutationEpochInvalidated: ['ownedMutationIntegrity', 'epochInvalidated'],
  ownedMutationRootInvalidated: ['ownedMutationIntegrity', 'rootInvalidated'],
  ownedMutationTargetUnobserved: ['ownedMutationIntegrity', 'targetUnobserved'],
  ownedMutationValueMismatch: ['ownedMutationIntegrity', 'valueMismatch'],
  ownedMutationExcessRecords: ['ownedMutationIntegrity', 'excessRecords'],
  totalMs: ['timings', 'totalMs'],
  pendingObserverMutations: ['pending', 'observerMutations'],
  pendingSocialQueue: ['pending', 'socialQueue'],
  pendingSocialDirtyRoots: ['pending', 'socialDirtyRoots'],
  pendingSocialOwnedMutations: ['pending', 'socialOwnedMutations'],
  pendingSocialOwnedMutationOldestAgeMs: ['pending', 'socialOwnedMutationOldestAgeMs'],
  snapshotReadMs: ['overhead', 'snapshotReadMs'],
  snapshotReadCount: ['overhead', 'snapshotReadCount'],
  observerBookkeepingMs: ['overhead', 'observerBookkeepingMs'],
  selectorProbeMs: ['overhead', 'selectorProbeMs'],
  provenanceProbeMs: ['overhead', 'provenanceProbeMs'],
  writeProbeMs: ['overhead', 'writeProbeMs'],
  scanEvidenceProbeMs: ['overhead', 'scanEvidenceProbeMs'],
  discoveryIdentityRecordOverheadMs: [
    'overhead',
    'discoveryIdentity',
    'recordOverheadMs',
  ],
  discoveryIdentitySocialRecordOverheadMs: [
    'overhead',
    'discoveryIdentity',
    'socialMetricsRecordOverheadMs',
  ],
  discoveryIdentityShortFormRecordOverheadMs: [
    'overhead',
    'discoveryIdentity',
    'shortFormRecordOverheadMs',
  ],
  discoveryIdentitySnapshotReadOverheadMs: [
    'overhead',
    'discoveryIdentity',
    'snapshotReadOverheadMs',
  ],
  discoveryIdentityRecordCallCount: [
    'overhead',
    'discoveryIdentity',
    'recordCallCount',
  ],
  discoveryIdentitySnapshotReadCount: [
    'overhead',
    'discoveryIdentity',
    'snapshotReadCount',
  ],
  discoveryIdentityUniqueNodes: [
    'discoveryOwnerLedger',
    'exactIdentity',
    'uniqueNodeCount',
  ],
  discoveryIdentityExactNodeOverlaps: [
    'discoveryOwnerLedger',
    'exactIdentity',
    'exactNodeOverlapCount',
  ],
  discoveryIdentityExactPhaseNodeOverlaps: [
    'discoveryOwnerLedger',
    'exactIdentity',
    'exactPhaseNodeOverlapCount',
  ],
  discoveryIdentityRootOverlaps: [
    'discoveryOwnerLedger',
    'exactIdentity',
    'phaseOverlapCounts',
    'scan_root',
  ],
  discoveryIdentityCandidateOverlaps: [
    'discoveryOwnerLedger',
    'exactIdentity',
    'phaseOverlapCounts',
    'candidate_visit',
  ],
  discoveryIdentityEffectTargetOverlaps: [
    'discoveryOwnerLedger',
    'exactIdentity',
    'phaseOverlapCounts',
    'effect_target',
  ],
  discoveryIdentitySameFlushReasonOverlaps: [
    'discoveryOwnerLedger',
    'exactIdentity',
    'sameFlushReasonNodeOverlapCount',
  ],
  discoveryIdentityDroppedVisits: [
    'discoveryOwnerLedger',
    'exactIdentity',
    'droppedVisitCount',
  ],
});

function safeSegment(value, fallback = 'run') {
  const normalized = String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/gu, '-');
  return normalized || fallback;
}

export function combineSiteRunOutcomes(values = []) {
  return values.reduce((worst, value) => {
    const normalized = Object.hasOwn(OUTCOME_WEIGHT, value)
      ? value
      : SITE_RUN_OUTCOMES.INCONCLUSIVE;
    return OUTCOME_WEIGHT[normalized] > OUTCOME_WEIGHT[worst]
      ? normalized
      : worst;
  }, SITE_RUN_OUTCOMES.PASS);
}

function renderList(values, empty = 'none') {
  if (!Array.isArray(values) || values.length === 0) return `- ${empty}`;
  return values.map((value) => `- ${typeof value === 'string' ? value : JSON.stringify(value)}`).join('\n');
}

function renderMetric(value, suffix = '') {
  return value === null || value === undefined ? 'unavailable' : `${value}${suffix}`;
}

function renderSeekPlaybackRestorationRows(actions = []) {
  const rows = actions
    .filter((action) => action?.kind === 'seek')
    .map((action, index) => {
      const restoration = action.playbackStateRestoration || {};
      return [
        `- Seek ${index + 1}: status=${restoration.status || 'unavailable'},`,
        `requested=${restoration.requestedState || 'unavailable'},`,
        `action=${restoration.action || 'none'},`,
        `paused before=${restoration.pausedBefore ?? 'unavailable'},`,
        `after seek=${restoration.pausedAfterSeek ?? 'unavailable'},`,
        `after restore=${restoration.pausedAfterRestore ?? 'unavailable'}`,
      ].join(' ');
    });
  return rows.length > 0 ? rows : ['- No trusted seek action in this scenario.'];
}

function renderTrustedPlayRows(actions = []) {
  const rows = actions
    .filter((action) => action?.kind === 'play')
    .map((action, index) => [
      `- Play ${index + 1}: status=${action.status || 'unavailable'},`,
      `reason=${action.reason || 'none'},`,
      `trusted gesture=${action.trustedGesture ?? 'unavailable'},`,
      `click required=${action.clickRequired ?? 'unavailable'},`,
      `paused before=${action.pausedBefore ?? 'unavailable'},`,
      `paused after=${action.pausedAfter ?? 'unavailable'},`,
      `dwell=${renderMetric(action.dwellMs, 'ms')}`,
    ].join(' '));
  return rows.length > 0 ? rows : ['- No trusted play action in this scenario.'];
}

function renderContentLoadCausalRows(actions = []) {
  const probes = actions.filter((action) => action?.kind === 'trusted_content_load_probe');
  if (probes.length === 0) return ['- No content-load probe in this scenario.'];
  return probes.flatMap((action) => {
    const causal = action?.runtimeCost?.causalWindow;
    const rows = [
      `- ${action.probeId || 'content-load'}: status=${action.status || 'unavailable'}, opportunity=${action.beforeOpportunityCount ?? 'unavailable'} -> ${action.afterOpportunityCount ?? 'unavailable'}, inputs=${action.inputCount ?? 'unavailable'}, first observed at=${renderMetric(action.firstOpportunityAtMs, ' ms')}, causal state=${causal?.state || 'unavailable'}`,
    ];
    for (const phase of causal?.phases || []) {
      rows.push(
        `  - ${phase.id}: ${renderMetric(phase.durationMs, ' ms')}; resources=${renderMetric(phase.resources?.count)} (${renderMetric(phase.resources?.transferSizeBytes, ' B')}), DOM records=${renderMetric(phase.domMutations?.recordCount)} (added=${renderMetric(phase.domMutations?.addedNodeCount)}), long tasks=${renderMetric(phase.longTasks?.count)} / ${renderMetric(phase.longTasks?.durationMs, ' ms')}, LoAF=${renderMetric(phase.longAnimationFrames?.count)} / blocking ${renderMetric(phase.longAnimationFrames?.blockingDurationMs, ' ms')}, scripts=${JSON.stringify(phase.longAnimationFrames?.scriptBuckets || {})}`,
      );
    }
    if ((causal?.largestResources || []).length > 0) {
      rows.push(`  - Largest sanitized resources: ${JSON.stringify(causal.largestResources)}`);
    }
    return rows;
  });
}

function renderPendingTrajectorySample(sample) {
  const pending = sample?.pending || {};
  return [
    `${renderMetric(sample?.attempt)}@${renderMetric(sample?.elapsedMs, 'ms')}`,
    `settled=${sample?.settled ?? 'unavailable'}`,
    `observer=${renderMetric(pending.observerMutations)}`,
    `queue=${renderMetric(pending.socialQueue)}`,
    `dirty=${renderMetric(pending.socialDirtyRoots)}`,
    `owned=${renderMetric(pending.socialOwnedMutations)}`,
    `ownedAge=${renderMetric(pending.socialOwnedMutationOldestAgeMs, 'ms')}`,
    `timer=${pending.socialTimer ?? 'unavailable'}`,
    `idle=${pending.socialIdle ?? 'unavailable'}`,
    `scan=${pending.socialCurrentScan ?? 'unavailable'}`,
    `forceFull=${pending.socialForceFullScan ?? 'unavailable'}`,
    `mediaRechecks=${renderMetric(pending.visualPendingRechecks)}`,
  ].join(',');
}

function renderDebuggerSettleTrajectory(label, evidence) {
  if (!evidence) return null;
  const trajectory = Array.isArray(evidence.pendingTrajectory)
    ? evidence.pendingTrajectory
    : [];
  const samples = trajectory.map(renderPendingTrajectorySample).join('; ');
  return [
    `- ${label}: state=${evidence.state || 'unavailable'},`,
    `settled=${evidence.settled ?? 'unavailable'},`,
    `timedOut=${evidence.timedOut ?? 'unavailable'},`,
    `retained=${trajectory.length}/${renderMetric(evidence.attempts)},`,
    `truncated=${evidence.pendingTrajectoryTruncated === true};`,
    ...(evidence.conditionWait ? [
      `conditionsSettled=${evidence.conditionWait.settled},`,
      `conditionTimedOut=${evidence.conditionWait.timedOut},`,
      `conditionWait=${renderMetric(evidence.conditionWait.elapsedMs, 'ms')},`,
      `pendingConditions=${evidence.conditionWait.pendingConditionIds.join(',') || 'none'};`,
    ] : []),
    samples || 'no pending samples',
  ].join(' ');
}

function renderDebuggerSettleTrajectoryRows(debuggerEvidence = {}) {
  const phaseRows = [
    ['active_stimulus', debuggerEvidence.settleTrajectories?.activeStimulus],
    ['disable_cleanup', debuggerEvidence.settleTrajectories?.disableCleanup],
    ['reenable_stimulus', debuggerEvidence.settleTrajectories?.reenableStimulus],
  ].map(([label, evidence]) => renderDebuggerSettleTrajectory(label, evidence))
    .filter(Boolean);
  const lifecycleRows = (debuggerEvidence.lifecycleSegments || [])
    .map((segment, index) => renderDebuggerSettleTrajectory(
      `lifecycle_${index + 1}_before_${segment.endedBeforeAction || 'boundary'}`,
      segment.finalSettle,
    ))
    .filter(Boolean);
  const rows = [...phaseRows, ...lifecycleRows];
  return rows.length > 0 ? rows : ['- unavailable'];
}

function renderRatioPercent(evidence) {
  const percent = evidence?.percent;
  const state = evidence?.status || 'unavailable';
  if (percent === null || percent === undefined) return `unavailable (${state})`;
  return `${Math.round(percent * 100) / 100}% (${state})`;
}

function renderRatioFactor(evidence) {
  const ratio = evidence?.ratio;
  const state = evidence?.status || 'unavailable';
  if (ratio === null || ratio === undefined) return `unavailable (${state})`;
  return `${Math.round(ratio * 100) / 100}x (${state})`;
}

function renderObserverSubscriberCosts(costs) {
  if (!Array.isArray(costs) || costs.length === 0) return 'unavailable';
  return costs.slice(0, 8).map((entry) => (
    `${entry.label}=${renderMetric(entry.totalMs, ' ms')}`
    + `/${renderMetric(entry.calls)} calls`
    + ` (avg=${renderMetric(entry.avgMs, ' ms')})`
  )).join(', ');
}

function readPath(value, segments) {
  return segments.reduce((current, segment) => current?.[segment], value);
}

function uniqueStates(values, fallback = 'unavailable') {
  return Array.from(new Set(values.map((value) => value ?? fallback)));
}

function booleanState(value) {
  if (value === true) return 'true';
  if (value === false) return 'false';
  return 'unavailable';
}

function summarizeObserverSubscriberCosts(runs) {
  const labels = Array.from(new Set(runs.flatMap((run) => (
    Array.isArray(run?.debugger?.costEvidence?.observer?.subscriberCosts)
      ? run.debugger.costEvidence.observer.subscriberCosts.map((entry) => entry.label)
      : []
  )))).sort((left, right) => left.localeCompare(right));

  return labels.map((label) => {
    const entries = runs.map((run) => (
      run?.debugger?.costEvidence?.observer?.subscriberCosts
        ?.find((entry) => entry.label === label)
    ));
    const totalMs = median(entries.map((entry) => entry?.totalMs));
    const calls = median(entries.map((entry) => entry?.calls));
    return {
      label,
      totalMs,
      calls,
      avgMs: calls > 0 && totalMs !== null
        ? Math.round((totalMs / calls) * 100) / 100
        : null,
    };
  }).sort((left, right) => (
    (right.totalMs ?? -1) - (left.totalMs ?? -1)
    || left.label.localeCompare(right.label)
  ));
}

function summarizeInternalCostRepeats(runs) {
  const scalarCosts = Object.fromEntries(Object.entries(INTERNAL_COST_METRIC_PATHS).map(([key, segments]) => [
    key,
    median(runs.map((run) => {
      if (
        key === 'duplicateScans'
        && run?.debugger?.costEvidence?.measurementStates?.duplicateScans?.state !== 'measured'
      ) return null;
      if (
        key === 'avoidableFullRescans'
        && run?.debugger?.costEvidence?.measurementStates?.avoidableFullRescans?.state !== 'measured'
      ) return null;
      return readPath(run?.debugger?.costEvidence, segments);
    })),
  ]));
  return {
    ...scalarCosts,
    observerSubscriberCosts: summarizeObserverSubscriberCosts(runs),
  };
}

function isValidInternalCostRun(run) {
  const efficiency = run?.debugger?.costEvidence?.measurementStates?.efficiency;
  return run?.activation?.state === 'measured'
    && run?.debugger?.availability === 'measured'
    && efficiency?.state === 'measured'
    && efficiency?.settled === true;
}

function hasSelectorDriftRecoveryEffectParity(run) {
  return run?.observableEffect?.status === 'measured'
    && run?.observableEffect?.cleanupState === 'measured'
    && run?.observableEffect?.reenabled === true
    && run?.cleanup?.pendingQueuesSettled === true;
}

function readVerifiedRepeatIsolationEpoch(run) {
  const epoch = run?.configuration?.repeatIsolation;
  if (
    !epoch
    || epoch.version !== 1
    || epoch.mode !== 'fresh_disposable_browser'
    || !Number.isSafeInteger(epoch.epochOrdinal)
    || epoch.epochOrdinal < 1
    || !/^sha256:[a-f0-9]{64}$/u.test(epoch.browserEpochDigest || '')
    || !/^sha256:[a-f0-9]{64}$/u.test(epoch.profileEpochDigest || '')
    || epoch.browserProcessOwnership !== 'owned'
    || epoch.profileOwnership !== 'harness_disposable'
    || epoch.profileRetained !== false
    || epoch.temporaryExtensionRetained !== false
    || epoch.cleanupState !== 'completed'
  ) return null;
  return epoch;
}

function summarizeSelectorDriftRecovery(validInternalRuns) {
  const youtubeRuns = validInternalRuns.filter((run) => (
    run?.siteId === SOCIAL_METRICS_SELECTOR_DRIFT_PILOT.siteId
  ));
  const brokenEvidenceCount = youtubeRuns.filter((run) => (
    run?.debugger?.costEvidence?.provenance?.selectorDriftRecovery?.state === 'broken'
  )).length;
  const observedRuns = youtubeRuns.filter((run) => (
    run?.debugger?.costEvidence?.provenance?.selectorDriftRecovery?.state === 'recovered'
  ));
  const parityRuns = observedRuns.filter(hasSelectorDriftRecoveryEffectParity);
  const epochs = parityRuns.map(readVerifiedRepeatIsolationEpoch).filter(Boolean);
  const uniqueBrowserEpochs = new Set(epochs.map((epoch) => epoch.browserEpochDigest));
  const uniqueProfileEpochs = new Set(epochs.map((epoch) => epoch.profileEpochDigest));
  const independentEpochCount = Math.min(
    uniqueBrowserEpochs.size,
    uniqueProfileEpochs.size,
  );
  const parityFailureCount = observedRuns.length - parityRuns.length;
  let state = youtubeRuns.length > 0 ? 'not_observed' : 'not_applicable';
  if (brokenEvidenceCount > 0 || parityFailureCount > 0) state = 'broken';
  else if (
    independentEpochCount >= SOCIAL_METRICS_SELECTOR_DRIFT_PILOT.certificationEpochs
  ) state = 'certified';
  else if (observedRuns.length > 0) state = 'observed';
  return {
    state,
    requiredIndependentEpochCount:
      SOCIAL_METRICS_SELECTOR_DRIFT_PILOT.certificationEpochs,
    observedRunCount: observedRuns.length,
    effectParityRunCount: parityRuns.length,
    parityFailureCount,
    brokenEvidenceCount,
    independentEpochCount,
    alert: state === 'certified'
      ? 'selector_drift_recovered_human_review_required'
      : null,
    productRecoveryActive: observedRuns.length > 0,
    automaticCanonicalProfileWrite: false,
    runtimeSelectorGenerated: false,
  };
}

function summarizeLaneRuns(runs) {
  if (runs.length === 0) return null;
  const validInternalRuns = runs.filter(isValidInternalCostRun);
  return {
    sampleCount: runs.length,
    internalCostSamples: {
      validSampleCount: validInternalRuns.length,
      totalSampleCount: runs.length,
      excludedSampleCount: runs.length - validInternalRuns.length,
    },
    outcome: combineSiteRunOutcomes(runs.map((run) => run.outcome)),
    classifications: uniqueStates(
      runs.map((run) => run.classification).filter(Boolean),
      'none',
    ),
    progressionStates: uniqueStates(runs.map((run) => run.progression?.state)),
    activationStates: uniqueStates(runs.map((run) => run.activation?.state)),
    observableEffectStates: uniqueStates(runs.map((run) => run.observableEffect?.status)),
    pendingQueueStates: uniqueStates(runs.map((run) => {
      const settled = run.cleanup?.pendingQueuesSettled;
      if (settled === true) return 'settled';
      if (settled === false) return 'not_settled';
      return 'unavailable';
    })),
    performanceStates: uniqueStates(runs.map((run) => run.performance?.status)),
    debuggerAvailability: uniqueStates(runs.map((run) => run.debugger?.availability)),
    shortFormCompletenessStates: uniqueStates(
      runs.map((run) => run.debugger?.shortFormCompleteness?.state),
    ),
    scannerStructuralStates: uniqueStates(
      validInternalRuns.map((run) => run.debugger?.costEvidence?.scannerStructuralAudit?.status),
    ),
    exactDiscoveryIdentityStates: uniqueStates(
      validInternalRuns.map(
        (run) => run.debugger?.costEvidence?.discoveryOwnerLedger?.exactIdentity?.state,
      ),
    ),
    exactDiscoveryCompletenessStates: uniqueStates(
      validInternalRuns.map((run) => booleanState(
        run.debugger?.costEvidence?.discoveryOwnerLedger?.exactIdentity?.complete,
      )),
    ),
    exactDiscoveryOverlapProofStates: uniqueStates(
      validInternalRuns.map((run) => booleanState(
        run.debugger?.costEvidence?.discoveryOwnerLedger?.exactNodeOverlapProven,
      )),
    ),
    sameFlushReasonOverlapProofStates: uniqueStates(
      validInternalRuns.map((run) => booleanState(
        run.debugger?.costEvidence?.discoveryOwnerLedger
          ?.sameFlushReasonNodeOverlapProven,
      )),
    ),
    longTaskMeasurementStates: uniqueStates(
      runs.map((run) => run.costs?.collectors?.longTasks?.status),
    ),
    longAnimationFrameMeasurementStates: uniqueStates(
      runs.map((run) => run.costs?.collectors?.longAnimationFrames?.status),
    ),
    extensionWorkerCollectorStates: uniqueStates(
      runs.map((run) => run.costs?.collectors?.extensionServiceWorker?.availability),
    ),
    debuggerPendingTimerStates: {
      socialTimer: uniqueStates(runs.map((run) => (
        booleanState(run.debugger?.costEvidence?.pending?.socialTimer)
      ))),
      socialIdle: uniqueStates(runs.map((run) => (
        booleanState(run.debugger?.costEvidence?.pending?.socialIdle)
      ))),
    },
    selectorDriftRecovery: summarizeSelectorDriftRecovery(validInternalRuns),
    medianCosts: {
      external: summarizeMetricRepeats(runs),
      internal: summarizeInternalCostRepeats(validInternalRuns),
    },
    actionRuntime: summarizeTrustedActionRuns(runs),
  };
}

function summarizeControlRuns(runs) {
  if (runs.length === 0) return null;
  const validRuns = runs.filter((run) => run?.measurementState === 'measured');
  return {
    sampleCount: runs.length,
    validSampleCount: validRuns.length,
    excludedSampleCount: runs.length - validRuns.length,
    outcome: combineSiteRunOutcomes(runs.map((run) => run.outcome)),
    classifications: uniqueStates(
      runs.map((run) => run.classification).filter(Boolean),
      'none',
    ),
    measurementStates: uniqueStates(runs.map((run) => run.measurementState)),
    longTaskMeasurementStates: uniqueStates(
      runs.map((run) => run.costs?.collectors?.longTasks?.status),
    ),
    medianClockDriftMs: median(validRuns.map((run) => run.costs?.clockDriftMs)),
    medianCosts: {
      external: summarizeMetricRepeats(validRuns),
    },
    actionRuntime: summarizeTrustedActionRuns(validRuns),
  };
}

const TRUSTED_ACTION_RUNTIME_METRICS = Object.freeze({
  rendererTaskMs: (action) => action?.runtimeCost?.renderer?.durations?.taskDurationMs,
  rendererScriptMs: (action) => action?.runtimeCost?.renderer?.durations?.scriptDurationMs,
  rendererLayoutMs: (action) => action?.runtimeCost?.renderer?.durations?.layoutDurationMs,
  rendererRecalcStyleMs: (action) => (
    action?.runtimeCost?.renderer?.durations?.recalcStyleDurationMs
  ),
});

function trustedActionKey(action) {
  const kind = typeof action?.kind === 'string' ? action.kind : 'unknown';
  const stepId = action?.stepId || action?.probeId || 'unidentified';
  return `${kind}:${stepId}`;
}

function summarizeTrustedActionRuns(runs = []) {
  const validRuns = runs.filter((run) => run?.runtimeAttribution?.state === 'measured');
  const byAction = new Map();
  const ownerSamples = new Map();
  validRuns.forEach((run) => {
    const responsivenessByKey = new Map(
      (run.runtimeAttribution?.responsiveness?.byAction || [])
        .map((action) => [trustedActionKey(action), action]),
    );
    (run.actions || []).forEach((action) => {
      if (
        action?.status !== 'performed'
        || action?.runtimeCost?.renderer?.state !== 'measured'
      ) return;
      const key = trustedActionKey(action);
      const current = byAction.get(key) || {
        key,
        kind: action.kind,
        stepId: action.stepId || action.probeId || null,
        samples: [],
      };
      const responsiveness = responsivenessByKey.get(key);
      current.samples.push({
        ...Object.fromEntries(Object.entries(TRUSTED_ACTION_RUNTIME_METRICS)
          .map(([metric, read]) => [metric, read(action)])),
        longAnimationFrameCount: responsiveness?.longAnimationFrameCount ?? null,
        longAnimationFrameBlockingMs: responsiveness?.totalBlockingDurationMs ?? null,
        longAnimationFrameMaxMs: responsiveness?.maxDurationMs ?? null,
        ownerOverlappingFrameCount: responsiveness?.contention
          ?.ownerOverlappingFrameCount ?? null,
        ownerStyleAndLayoutPhaseOverlappingFrameCount: responsiveness?.contention
          ?.ownerStyleAndLayoutPhaseOverlappingFrameCount ?? null,
        ownerOverlapMs: responsiveness?.contention?.ownerOverlapMs ?? null,
        ownerStyleAndLayoutPhaseOverlapMs: responsiveness?.contention
          ?.ownerStyleAndLayoutPhaseOverlapMs ?? null,
        ownerExtensionScriptOverlapMs: responsiveness?.contention
          ?.ownerExtensionScriptOverlapMs ?? null,
      });
      byAction.set(key, current);
    });
    (run.runtimeAttribution?.byOwner || []).forEach((owner) => {
      if (typeof owner?.ownerId !== 'string') return;
      const samples = ownerSamples.get(owner.ownerId) || [];
      samples.push(owner);
      ownerSamples.set(owner.ownerId, samples);
    });
  });
  const totalMetricNames = [
    'rendererTaskMs',
    'rendererScriptMs',
    'rendererLayoutMs',
    'rendererRecalcStyleMs',
    'instrumentedEntropyMs',
    'rendererResidualMs',
    'longTaskResidualMs',
  ];
  const responsivenessMetricNames = [
    'longAnimationFrameCount',
    'totalDurationMs',
    'totalBlockingDurationMs',
    'maxDurationMs',
    'ownerOverlappingFrameCount',
    'ownerStyleAndLayoutPhaseOverlappingFrameCount',
    'ownerOverlapMs',
    'ownerStyleAndLayoutPhaseOverlapMs',
    'entropyExtensionForcedStyleAndLayoutDurationMs',
  ];
  const medianObject = (objects, names) => Object.fromEntries(names.map((name) => [
    name,
    median(objects.map((object) => object?.[name])),
  ]));
  return {
    sampleCount: runs.length,
    validSampleCount: validRuns.length,
    medianTotals: medianObject(
      validRuns.map((run) => run.runtimeAttribution?.totals),
      totalMetricNames,
    ),
    medianResponsiveness: medianObject(
      validRuns.map((run) => run.runtimeAttribution?.responsiveness),
      responsivenessMetricNames,
    ),
    byAction: Array.from(byAction.values())
      .map((entry) => ({
        key: entry.key,
        kind: entry.kind,
        stepId: entry.stepId,
        sampleCount: entry.samples.length,
        medians: medianObject(entry.samples, [
          ...Object.keys(TRUSTED_ACTION_RUNTIME_METRICS),
          'longAnimationFrameCount',
          'longAnimationFrameBlockingMs',
          'longAnimationFrameMaxMs',
          'ownerOverlappingFrameCount',
          'ownerStyleAndLayoutPhaseOverlappingFrameCount',
          'ownerOverlapMs',
          'ownerStyleAndLayoutPhaseOverlapMs',
          'ownerExtensionScriptOverlapMs',
        ]),
      }))
      .sort((left, right) => left.key.localeCompare(right.key)),
    byOwner: Array.from(ownerSamples.entries())
      .map(([ownerId, samples]) => ({
        ownerId,
        sampleCount: samples.length,
        medianCoveredMs: median(samples.map((sample) => sample?.coveredMs)),
        medianOperationCount: median(samples.map((sample) => sample?.operationCount)),
      }))
      .sort((left, right) => (
        (right.medianCoveredMs || 0) - (left.medianCoveredMs || 0)
      )),
  };
}

function subtractExternalMetrics(product = null, control = null) {
  const keys = Array.from(new Set([
    ...Object.keys(product || {}),
    ...Object.keys(control || {}),
  ])).sort((left, right) => left.localeCompare(right));
  return Object.fromEntries(keys.map((key) => {
    const productValue = product?.[key];
    const controlValue = control?.[key];
    if (
      productValue === null
      || productValue === undefined
      || typeof productValue === 'boolean'
      || controlValue === null
      || controlValue === undefined
      || typeof controlValue === 'boolean'
    ) return [key, null];
    const left = Number(productValue);
    const right = Number(controlValue);
    return [key, Number.isFinite(left) && Number.isFinite(right)
      ? Math.round((left - right) * 100) / 100
      : null];
  }));
}

function hasMeasuredExternalMetrics(metrics = null) {
  if (!metrics || typeof metrics !== 'object') return false;
  return Object.values(metrics).some((value) => (
    value !== null
    && value !== undefined
    && typeof value !== 'boolean'
    && Number.isFinite(Number(value))
  ));
}

function subtractTrustedActionRuntime(product = null, control = null) {
  if (!product || !control) return null;
  const controlByKey = new Map((control.byAction || []).map((entry) => [entry.key, entry]));
  return {
    medianTotals: subtractExternalMetrics(product.medianTotals, control.medianTotals),
    medianResponsiveness: subtractExternalMetrics(
      product.medianResponsiveness,
      control.medianResponsiveness,
    ),
    byAction: (product.byAction || []).map((entry) => {
      const reference = controlByKey.get(entry.key);
      return {
        key: entry.key,
        kind: entry.kind,
        stepId: entry.stepId,
        productSampleCount: entry.sampleCount,
        controlSampleCount: reference?.sampleCount || 0,
        medians: reference
          ? subtractExternalMetrics(entry.medians, reference.medians)
          : null,
      };
    }),
  };
}

function summarizePairedTrustedActionDeltas(productRuns = [], controlRuns = []) {
  const controlByRepeat = new Map(
    controlRuns
      .filter((run) => run?.runtimeAttribution?.state === 'measured')
      .map((run) => [run.repeatIndex, run]),
  );
  const pairs = productRuns.flatMap((productRun) => {
    if (productRun?.runtimeAttribution?.state !== 'measured') return [];
    const controlRun = controlByRepeat.get(productRun.repeatIndex);
    if (!controlRun) return [];
    const product = summarizeTrustedActionRuns([productRun]);
    const control = summarizeTrustedActionRuns([controlRun]);
    const delta = subtractTrustedActionRuntime(product, control);
    return [{ repeatIndex: productRun.repeatIndex, delta }];
  });
  if (pairs.length === 0) return null;
  const summarizeObjects = (objects) => {
    const keys = Array.from(new Set(objects.flatMap((object) => Object.keys(object || {}))));
    return Object.fromEntries(keys.map((key) => {
      const values = objects
        .map((object) => object?.[key])
        .filter((value) => (
          value !== null
          && value !== undefined
          && typeof value !== 'boolean'
          && !(typeof value === 'string' && value.trim() === '')
          && Number.isFinite(Number(value))
        ))
        .map(Number);
      return [key, {
        median: median(values),
        minimum: values.length > 0 ? Math.min(...values) : null,
        maximum: values.length > 0 ? Math.max(...values) : null,
      }];
    }));
  };
  const actionKeys = Array.from(new Set(pairs.flatMap((pair) => (
    (pair.delta?.byAction || []).map((entry) => entry.key)
  )))).sort((left, right) => left.localeCompare(right));
  return {
    pairCount: pairs.length,
    policy: 'median_of_repeat_matched_product_minus_control_action_deltas',
    totals: summarizeObjects(pairs.map((pair) => pair.delta?.medianTotals)),
    responsiveness: summarizeObjects(
      pairs.map((pair) => pair.delta?.medianResponsiveness),
    ),
    byAction: actionKeys.map((key) => ({
      key,
      metrics: summarizeObjects(pairs.map((pair) => (
        pair.delta?.byAction?.find((entry) => entry.key === key)?.medians || {}
      ))),
    })),
    pairs: pairs.map((pair) => ({
      repeatIndex: pair.repeatIndex,
      totals: pair.delta?.medianTotals || null,
      responsiveness: pair.delta?.medianResponsiveness || null,
    })),
  };
}

function buildExternalAttribution(lanes, control, rawRuns = {}) {
  const controlExternal = control?.medianCosts?.external || null;
  const releaseExternal = lanes.release?.medianCosts?.external || null;
  const diagnosticExternal = lanes.diagnostic?.medianCosts?.external || null;
  const controlMeasured = (control?.validSampleCount || 0) > 0;
  const releaseMeasured = hasMeasuredExternalMetrics(releaseExternal);
  const diagnosticMeasured = hasMeasuredExternalMetrics(diagnosticExternal);
  const releaseAttributionMeasured = controlMeasured && releaseMeasured;
  const diagnosticAttributionMeasured = controlMeasured && diagnosticMeasured;
  const controlActionMeasured = (control?.actionRuntime?.validSampleCount || 0) > 0;
  const releaseActionMeasured = (lanes.release?.actionRuntime?.validSampleCount || 0) > 0;
  const diagnosticActionMeasured = (lanes.diagnostic?.actionRuntime?.validSampleCount || 0) > 0;
  return {
    state: releaseAttributionMeasured || diagnosticAttributionMeasured
      ? 'measured'
      : 'unavailable',
    reason: !controlMeasured
      ? 'extension_disabled_control_unavailable'
      : releaseAttributionMeasured || diagnosticAttributionMeasured
        ? 'product_and_control_measurements_available'
        : 'product_measurement_unavailable',
    controlReferenceState: controlMeasured ? 'measured' : 'unavailable',
    releaseAttributionState: releaseAttributionMeasured ? 'measured' : 'unavailable',
    diagnosticAttributionState: diagnosticAttributionMeasured ? 'measured' : 'unavailable',
    policy: 'product_median_minus_extension_disabled_control_median',
    automaticHardGate: false,
    releaseMinusControl: releaseAttributionMeasured
      ? subtractExternalMetrics(releaseExternal, controlExternal)
      : null,
    diagnosticMinusControl: diagnosticAttributionMeasured
      ? subtractExternalMetrics(diagnosticExternal, controlExternal)
      : null,
    trustedAction: {
      state: controlActionMeasured && (releaseActionMeasured || diagnosticActionMeasured)
        ? 'measured'
        : 'unavailable',
      policy: 'paired_scenario_action_medians_product_minus_extension_disabled_control',
      control: control?.actionRuntime || null,
      release: lanes.release?.actionRuntime || null,
      diagnostic: lanes.diagnostic?.actionRuntime || null,
      releaseMinusControl: controlActionMeasured && releaseActionMeasured
        ? summarizePairedTrustedActionDeltas(
          rawRuns.release || [],
          rawRuns.control || [],
        )
        : null,
      diagnosticMinusControl: controlActionMeasured && diagnosticActionMeasured
        ? summarizePairedTrustedActionDeltas(
          rawRuns.diagnostic || [],
          rawRuns.control || [],
        )
        : null,
    },
  };
}

export function buildScenarioLaneComparisons(runs = [], controlRuns = []) {
  const grouped = new Map();
  for (const run of [...runs, ...controlRuns]) {
    const scenarioId = String(run?.scenarioId || 'unknown');
    const current = grouped.get(scenarioId) || {
      scenarioId,
      siteId: run?.siteId || null,
      routeId: run?.routeId || null,
      url: sanitizeSiteHarnessUrl(run?.url),
      features: Array.isArray(run?.features) ? [...run.features] : [],
      laneRuns: { diagnostic: [], release: [] },
      controlRuns: [],
    };
    if (COMPARISON_LANES.includes(run?.lane)) current.laneRuns[run.lane].push(run);
    if (run?.runKind === 'extension_disabled_control') current.controlRuns.push(run);
    grouped.set(scenarioId, current);
  }
  return Array.from(grouped.values(), (entry) => {
    const lanes = Object.fromEntries(COMPARISON_LANES.map((lane) => [
      lane,
      summarizeLaneRuns(entry.laneRuns[lane]),
    ]));
    const control = summarizeControlRuns(entry.controlRuns);
    return {
      scenarioId: entry.scenarioId,
      siteId: entry.siteId,
      routeId: entry.routeId,
      url: entry.url,
      features: entry.features,
      lanes,
      control,
      externalAttribution: buildExternalAttribution(lanes, control, {
        diagnostic: entry.laneRuns.diagnostic,
        release: entry.laneRuns.release,
        control: entry.controlRuns,
      }),
    };
  });
}

function renderStateSet(values) {
  return Array.isArray(values) && values.length > 0 ? values.join(', ') : 'unavailable';
}

function renderCompactNumber(value) {
  if (
    value === null
    || value === undefined
    || typeof value === 'boolean'
    || (typeof value === 'string' && value.trim() === '')
  ) return 'unavailable';
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return 'unavailable';
  return String(Math.round(numericValue * 10000) / 10000);
}

function renderNamedCounters(counters = null) {
  if (!counters || typeof counters !== 'object') return 'unavailable';
  const entries = Object.entries(counters)
    .filter(([, value]) => renderCompactNumber(value) !== 'unavailable');
  if (entries.length === 0) return 'none';
  return entries
    .map(([key, value]) => `${key}=${renderCompactNumber(value)}`)
    .join(', ');
}

function renderNormalizedLedgerRatios(normalized = null) {
  if (!normalized || typeof normalized !== 'object') return 'unavailable';
  const entries = Object.entries(normalized);
  if (entries.length === 0) return 'none';
  return entries.map(([key, ratio]) => {
    const status = ratio?.status || 'unavailable';
    const value = renderCompactNumber(ratio?.value);
    const unit = typeof ratio?.unit === 'string' && ratio.unit
      ? ` ${ratio.unit}`
      : '';
    return `${key}=${value}${unit} (${status})`;
  }).join('; ');
}

function renderConservationChecks(audit = null) {
  if (!Array.isArray(audit?.checks) || audit.checks.length === 0) return 'unavailable';
  return audit.checks.map((check) => {
    const left = renderCompactNumber(check?.left?.total);
    const right = renderCompactNumber(check?.right?.total);
    const delta = renderCompactNumber(check?.delta);
    return `${check.id}=${check.status || 'unavailable'}`
      + ` (state=${check.measurementState || 'unavailable'}, left=${left}, right=${right}, delta=${delta})`;
  }).join('; ');
}

function renderStrategyProjection(projection = null) {
  if (!projection || typeof projection !== 'object') return 'unavailable';
  const strategies = Object.entries(projection.strategies || {}).map(([key, strategy]) => (
    `${key}=${renderMetric(strategy?.candidateCount)} candidates`
    + `, missing=${renderMetric(strategy?.missingCandidateCount)}`
    + `, coverage=${renderCompactNumber(strategy?.candidateUnionCoverage?.value)}`
    + `, challenge=${strategy?.challenge?.status || 'unavailable'}`
    + `, experiment eligible=${strategy?.challenge?.eligibleForControlledCostExperiment ?? 'unavailable'}`
  )).join('; ');
  return `state=${projection.state || 'unavailable'}, owner scope=${projection.ownerScope || 'unavailable'}, cross-owner comparable=${projection.crossOwnerComparable ?? 'unavailable'}, universe=${renderMetric(projection.candidateUniverseCount)}, consistent=${projection.countConsistent ?? 'unavailable'}, oracle completeness proven=${projection.oracleCompletenessProven ?? 'unavailable'}, automatic winner selection=${projection.automaticWinnerSelection ?? 'unavailable'}, eligible challengers=${(projection.eligibleChallengers || []).join(', ') || 'none'}, extra DOM reads=${renderMetric(projection.extraDomReads)}, ${strategies || 'strategies=unavailable'}`;
}

function renderIdentityCardinality(evidence = null, ledger = null) {
  const identity = evidence?.identityCardinality || ledger?.identityCardinality;
  const partialMeasurements = Array.isArray(ledger?.partialMeasurements)
    ? ledger.partialMeasurements.join(', ') || 'none'
    : 'unavailable';
  return `state=${identity?.state || 'unavailable'}, scope=${identity?.scope || 'unavailable'}, unique touches=${renderMetric(identity?.uniqueTargetTouches)}, repeated touches=${renderMetric(identity?.repeatedTargetTouches)}, unique physical-write targets=${renderMetric(identity?.uniquePhysicalWriteTargets)}, partial=${partialMeasurements}`;
}

function renderWorkLedgerRows(evidence = null) {
  const ledger = evidence?.workLedger;
  const conservation = evidence?.scannerConservationAudit;
  const discoveryOwners = evidence?.discoveryOwnerLedger;
  const exactDiscovery = discoveryOwners?.exactIdentity;
  const discoveryOwnerSummary = Object.entries(discoveryOwners?.owners || {})
    .map(([ownerId, owner]) => (
      `${ownerId}=${owner?.state || 'unavailable'}`
      + `, operations=${renderMetric(owner?.operationCount)}`
      + `, flushes=${renderMetric(owner?.uniqueFlushCount)}`
      + `, roots=${renderMetric(owner?.rootAdmissions)}`
      + `, candidates=${renderMetric(owner?.candidateVisits)}`
    ))
    .join('; ');
  return [
    `- Scanner counter conservation: ${conservation?.status || 'unavailable'} (policy=${conservation?.policy || 'unavailable'}, counter coverage completeness proven=${conservation?.instrumentationCompletenessProven ?? 'unavailable'}, agent interpretation required=${conservation?.agentInterpretationRequired ?? 'unavailable'})`,
    `- Conservation equations: ${renderConservationChecks(conservation)}`,
    `- Scanner work ledger: phase=${ledger?.phase || 'unavailable'}, state=${ledger?.state || 'unavailable'}, reason=${ledger?.reason || 'unavailable'}, settled=${ledger?.settled ?? 'unavailable'}, schema=${renderMetric(ledger?.schemaVersion)}, optimality proven=${ledger?.optimalityProven ?? 'unavailable'}, counter coverage completeness proven=${ledger?.instrumentationCompletenessProven ?? 'unavailable'}, timing dimensions additive=${ledger?.timingDimensionsAreAdditive ?? 'unavailable'}, approved envelope required=${ledger?.approvedOperatingEnvelopeRequired ?? 'unavailable'}, automatic hard gate=${ledger?.automaticHardGate ?? 'unavailable'}`,
    `- Scanner work reasons: ${renderNamedCounters(ledger?.workReasons)}`,
    `- Workload-normalized scanner ratios: ${renderNormalizedLedgerRatios(ledger?.normalized)}`,
    `- Candidate strategy shadow projection: ${renderStrategyProjection(ledger?.strategyProjection)}`,
    `- Cross-owner discovery co-activity: state=${discoveryOwners?.state || 'unavailable'}, policy=${discoveryOwners?.policy || 'unavailable'}, shared flushes=${renderMetric(discoveryOwners?.overlap?.sharedFlushCount)}/${renderMetric(discoveryOwners?.overlap?.unionFlushCount)}, duplicate discovery proven=${discoveryOwners?.duplicateDiscoveryProven ?? 'unavailable'}, redundant work proven=${discoveryOwners?.redundantWorkProven ?? 'unavailable'}, owner dimensions comparable=${discoveryOwners?.ownerDimensionsComparable ?? 'unavailable'}, extra DOM reads=${renderMetric(discoveryOwners?.extraDomReads)}; ${discoveryOwnerSummary || 'owners=unavailable'}`,
    `- Cross-owner exact identity: state=${exactDiscovery?.state || 'unavailable'}, complete=${exactDiscovery?.complete ?? 'unavailable'}, unique nodes=${renderMetric(exactDiscovery?.uniqueNodeCount)}, exact node overlaps=${renderMetric(exactDiscovery?.exactNodeOverlapCount)}, phase-node overlaps=${renderMetric(exactDiscovery?.exactPhaseNodeOverlapCount)} (roots=${renderMetric(exactDiscovery?.phaseOverlapCounts?.scan_root)}, candidates=${renderMetric(exactDiscovery?.phaseOverlapCounts?.candidate_visit)}, effect targets=${renderMetric(exactDiscovery?.phaseOverlapCounts?.effect_target)}), same flush+reason overlaps=${renderMetric(exactDiscovery?.sameFlushReasonNodeOverlapCount)}, exact overlap proven=${exactDiscovery?.exactNodeOverlapProven ?? 'unavailable'}, redundant work proven=${exactDiscovery?.redundantWorkProven ?? 'unavailable'}, dropped visits=${renderMetric(exactDiscovery?.droppedVisitCount)}, extra DOM reads=${renderMetric(exactDiscovery?.instrumentation?.extraDomReads)}, record overhead=${renderMetric(exactDiscovery?.instrumentation?.recordOverheadMs, ' ms')} (${renderMetric(exactDiscovery?.instrumentation?.recordCallCount)} calls; social=${renderMetric(exactDiscovery?.instrumentation?.recordOverheadByOwner?.socialMetrics, ' ms')}, short-form=${renderMetric(exactDiscovery?.instrumentation?.recordOverheadByOwner?.shortForm, ' ms')}), snapshot overhead=${renderMetric(exactDiscovery?.instrumentation?.snapshotReadOverheadMs, ' ms')} (${renderMetric(exactDiscovery?.instrumentation?.snapshotReadCount)} reads)`,
    `- Identity cardinality: ${renderIdentityCardinality(evidence, ledger)}`,
  ];
}

function renderPhaseBoundary(evidence = null, ownerPhase = null) {
  if (!evidence || typeof evidence !== 'object') return 'unavailable';
  const boundary = evidence?.boundary;
  if (!boundary && ownerPhase === 'active_stimulus') {
    return 'session_baseline (Runtime Debugger baseline -> active phase endpoint)';
  }
  if (!boundary) return 'unavailable';
  const violations = Array.isArray(boundary.violations) && boundary.violations.length > 0
    ? boundary.violations.join(', ')
    : 'none';
  return `${boundary.state || 'unavailable'} (${boundary.reason || 'unavailable'}; violations=${violations})`;
}

function renderPhaseCostEvidenceRows(phaseCostEvidence = null) {
  const phases = [
    {
      reportPhase: 'active_stimulus',
      ownerPhase: 'active_stimulus',
      evidence: phaseCostEvidence?.activeStimulus || phaseCostEvidence?.active_stimulus,
    },
    {
      reportPhase: 'disable_cleanup',
      ownerPhase: 'disable_cleanup',
      evidence: phaseCostEvidence?.disableCleanup || phaseCostEvidence?.disable_cleanup,
    },
    {
      reportPhase: 'reenable_settle',
      ownerPhase: 'reenable_stimulus',
      evidence: phaseCostEvidence?.reenableStimulus
        || phaseCostEvidence?.reenable_stimulus
        || phaseCostEvidence?.reenable_settle,
    },
  ];
  return phases.flatMap((phase) => {
    const settle = phase.evidence?.measurementStates?.efficiency;
    const ownerDisclosure = phase.reportPhase === phase.ownerPhase
      ? ''
      : ` (owner phase=${phase.ownerPhase})`;
    return [
      `### ${phase.reportPhase}${ownerDisclosure}`,
      '',
      `- Measurement: state=${settle?.state || phase.evidence?.workLedger?.state || 'unavailable'}, reason=${settle?.reason || phase.evidence?.workLedger?.reason || 'unavailable'}, settled=${settle?.settled ?? phase.evidence?.workLedger?.settled ?? 'unavailable'}`,
      `- Boundary continuity: ${renderPhaseBoundary(phase.evidence, phase.ownerPhase)}`,
      ...renderWorkLedgerRows(phase.evidence),
      '',
    ];
  });
}

function renderInternalEvidenceRows(evidence = null) {
  const scannerAudit = evidence?.scannerStructuralAudit;
  const scannerChecks = Array.isArray(scannerAudit?.checks)
    ? scannerAudit.checks.map((check) => (
      `${check.id}=${check.status} (state=${check.measurementState}, value=${renderMetric(check.value)})`
    )).join('; ')
    : 'unavailable';
  const observer = evidence?.observer;
  const observerAttributes = observer?.attributeMutationCounts;
  const visualMedia = evidence?.visualMedia;
  const ratios = evidence?.ratios;
  const scanRouting = evidence?.scanRouting;
  const provenance = evidence?.provenance;
  const writes = evidence?.writes;
  const timings = evidence?.timings;
  const pending = evidence?.pending;
  const overhead = evidence?.overhead;
  const ownedMutationIntegrity = evidence?.ownedMutationIntegrity;
  return [
    `- Code-owned scanner verdict: ${scannerAudit?.status || 'unavailable'} (policy=${scannerAudit?.policy || 'unavailable'}, agent interpretation required=${scannerAudit?.agentInterpretationRequired ?? 'unavailable'})`,
    `- Structural scanner checks: ${scannerChecks}`,
    ...renderWorkLedgerRows(evidence),
    `- Duplicate scans: ${renderMetric(evidence?.duplicateScans)} (state=${evidence?.duplicateScanEvidence?.state || 'unavailable'}, evaluations=${renderMetric(evidence?.duplicateScanEvidence?.evaluations)}, unavailable=${renderMetric(evidence?.duplicateScanEvidence?.unavailableEvaluations)})`,
    `- Avoidable full rescans: ${renderMetric(evidence?.avoidableFullRescans)} (state=${evidence?.avoidableFullRescanEvidence?.state || 'unavailable'}, evaluations=${renderMetric(evidence?.avoidableFullRescanEvidence?.evaluations)}, measured executions=${renderMetric(evidence?.avoidableFullRescanEvidence?.measuredExecutions)}, unavailable=${renderMetric(evidence?.avoidableFullRescanEvidence?.unavailableEvaluations)})`,
    `- Scan shape: admitted full=${renderMetric(evidence?.scanShape?.admittedFullScans)}, admitted dirty=${renderMetric(evidence?.scanShape?.admittedDirtyScans)}, executed full=${renderMetric(evidence?.scanShape?.executedFullScans)}, executed dirty=${renderMetric(evidence?.scanShape?.executedDirtyScans)}`,
    `- Scan admission/merge: admitted=${renderMetric(scanRouting?.admissions)}, enqueued=${renderMetric(scanRouting?.enqueued)}, merged=${renderMetric(scanRouting?.merged)}, merge share=${renderRatioPercent(scanRouting?.mergeShare)}`,
    `- Mutation routing: routed groups=${renderMetric(scanRouting?.routedMutationGroups)}, skipped groups=${renderMetric(scanRouting?.skippedMutationGroups)} (rule=${renderMetric(scanRouting?.mutationRuleSkips)}, host-root=${renderMetric(scanRouting?.hostRootRelevanceSkips)}), self-echo records consumed=${renderMetric(scanRouting?.selfMutationRecordsConsumed)}`,
    `- Dirty-root breadth: total=${renderMetric(evidence?.dirtyRootBreadth?.total)}, max=${renderMetric(evidence?.dirtyRootBreadth?.max)}`,
    `- ObserverHub flush shape: total=${renderMetric(observer?.flushes)}, attributes=${renderMetric(observer?.flushShape?.attributeOnly)}, children=${renderMetric(observer?.flushShape?.childOnly)}, mixed=${renderMetric(observer?.flushShape?.mixed)}, tiny=${renderMetric(observer?.flushShape?.tiny)}`,
    `- ObserverHub cost: queue wait=${renderMetric(observer?.queueWaitMs, ' ms')}, subscriber callbacks=${renderMetric(observer?.subscriberCallbackMs, ' ms')}`,
    `- ObserverHub subscriber attribution: ${renderObserverSubscriberCosts(observer?.subscriberCosts)}`,
    `- ObserverHub attribute pressure: style=${renderMetric(observerAttributes?.style)}, class=${renderMetric(observerAttributes?.class)}, href=${renderMetric(observerAttributes?.href)}, src=${renderMetric(observerAttributes?.src)}, srcset=${renderMetric(observerAttributes?.srcset)}`,
    `- Visual media cost: state=${visualMedia?.state || 'unavailable'}, operations=${renderMetric(visualMedia?.operations)} (mutation=${renderMetric(visualMedia?.mutationScans)}, recheck=${renderMetric(visualMedia?.recheckScans)}), roots=${renderMetric(visualMedia?.incomingRoots)} -> relevant=${renderMetric(visualMedia?.relevantRoots)}, managed style roots skipped=${renderMetric(visualMedia?.managedTargetStyleRootsSkipped)}, effect writes=${renderMetric(visualMedia?.writes)}, no-ops=${renderMetric(visualMedia?.noops)}, composite effects=create ${renderMetric(visualMedia?.compositeEffectCreates)} (${renderMetric(visualMedia?.compositeEffectCreateMs, ' ms')}), update ${renderMetric(visualMedia?.compositeEffectUpdates)} (${renderMetric(visualMedia?.compositeEffectUpdateMs, ' ms')}), recreate ${renderMetric(visualMedia?.compositeEffectRecreates)}, cancel ${renderMetric(visualMedia?.compositeEffectCancels)} (${renderMetric(visualMedia?.compositeEffectCancelMs, ' ms')}), elapsed=${renderMetric(visualMedia?.totalMs, ' ms')} (debug overhead=${renderMetric(visualMedia?.debugOverheadMs, ' ms')})`,
    `- Selector/candidate decision flow: selector hits=${renderMetric(ratios?.selectorHits)} -> resolved candidates=${renderMetric(ratios?.resolvedCandidates)} -> non-clear candidate decisions=${renderMetric(ratios?.nonClearCandidateDecisions)}`,
    `- Candidate decision shape: semantic candidates=${renderMetric(ratios?.semanticCandidates)}, all candidate decisions=${renderMetric(ratios?.candidateDecisions)}, non-clear candidate decisions=${renderMetric(ratios?.nonClearCandidateDecisions)}`,
    `- Candidate provenance: selector-only=${renderMetric(provenance?.selectorOnlyHits)}, semantic-only=${renderMetric(provenance?.semanticOnlyHits)}, overlap=${renderMetric(provenance?.selectorSemanticOverlapHits)}, semantic incremental yield=${renderRatioPercent(provenance?.semanticIncrementalYield)}`,
    `- Non-clear decisions vs physical writes: non-clear candidate decisions=${renderMetric(writes?.nonClearCandidateDecisions)}, write attempts=${renderMetric(writes?.writeAttempts)}, all physical writes including cleanup=${renderMetric(writes?.allPhysicalWritesIncludingCleanup)}, unchanged/no-op attempts=${renderMetric(writes?.unchangedWriteAttempts)}`,
    `- Decision write outcomes: actual-write=${renderMetric(writes?.actualWriteDecisions)}, unchanged/no-op=${renderMetric(writes?.unchangedNoopDecisions)}, no-write=${renderMetric(writes?.noWriteDecisions)}`,
    `- Physical write shape: actual-write targets=${renderMetric(writes?.actualWriteTargetCount)}, apply-phase writes=${renderMetric(writes?.applyPhysicalWrites)}, post-chunk cleanup writes=${renderMetric(writes?.postChunkCleanupPhysicalWrites)}, configuration cleanup writes=${renderMetric(writes?.configurationCleanupPhysicalWrites)}`,
    `- Cross-scope write ratios: all writes including cleanup/non-clear candidate decision=${renderRatioFactor(writes?.allWritesPerNonClearCandidateDecision)}, apply writes/non-clear candidate decision=${renderRatioFactor(writes?.applyWritesPerNonClearCandidateDecision)}, all writes including cleanup/non-clear target touch=${renderRatioFactor(writes?.allWritesPerNonClearTargetTouch)}, actual/attempts=${renderRatioPercent(writes?.actualWriteRate)}, unchanged/attempts=${renderRatioPercent(writes?.unchangedWriteRate)}`,
    `- Zero-candidate collections: ${renderMetric(evidence?.zeroCandidateCollections)}`,
    `- Target touches: non-clear touches=${renderMetric(evidence?.nonClearTargetTouchCount)}, repeated=${renderMetric(evidence?.repeatedTargetTouches)}, unique=${renderMetric(evidence?.uniqueTargetTouches)}, repeat share=${renderRatioPercent(evidence?.repeatedTargetTouchShare)}`,
    `- Instrumented scanner timing (components are non-additive): selector=${renderMetric(timings?.selectorMs, ' ms')}, semantic=${renderMetric(timings?.semanticMs, ' ms')}, idle=${renderMetric(timings?.idleMs, ' ms')}, apply=${renderMetric(timings?.applyMs, ' ms')}, cleanup total=${renderMetric(timings?.cleanupMs, ' ms')} (post-chunk=${renderMetric(timings?.postChunkCleanupMs, ' ms')}, configuration=${renderMetric(timings?.configurationCleanupMs, ' ms')}), owned-write record=${renderMetric(timings?.ownedMutationRecordProductMs, ' ms')}, owned-write filter=${renderMetric(timings?.ownedMutationFilterProductMs, ' ms')}`,
    `- Elapsed separation: instrumented=${renderMetric(timings?.instrumentedElapsedMs, ' ms')}, known in-path debugger overhead=${renderMetric(timings?.knownInPathDebuggerOverheadMs, ' ms')}, estimated product=${renderMetric(timings?.estimatedProductElapsedMs, ' ms')} (estimate excludes only measured in-path probes)`,
    `- Owned-write fail-open integrity: state=${ownedMutationIntegrity?.state || 'unavailable'}, total=${renderMetric(ownedMutationIntegrity?.total)}, age expiry=${renderMetric(ownedMutationIntegrity?.expiredByAge)}, delivery expiry=${renderMetric(ownedMutationIntegrity?.expiredByDelivery)}, epoch invalidation=${renderMetric(ownedMutationIntegrity?.epochInvalidated)}, root invalidation=${renderMetric(ownedMutationIntegrity?.rootInvalidated)}, target unobserved=${renderMetric(ownedMutationIntegrity?.targetUnobserved)}, value mismatch=${renderMetric(ownedMutationIntegrity?.valueMismatch)}, excess records=${renderMetric(ownedMutationIntegrity?.excessRecords)}`,
    `- Pending queues: observer mutations=${renderMetric(pending?.observerMutations)}, social queue=${renderMetric(pending?.socialQueue)}, social dirty roots=${renderMetric(pending?.socialDirtyRoots)}, owned self-writes=${renderMetric(pending?.socialOwnedMutations)} (oldest=${renderMetric(pending?.socialOwnedMutationOldestAgeMs, ' ms')})`,
    `- Pending scheduling: social timer=${pending?.socialTimer ?? 'unavailable'}, social idle=${pending?.socialIdle ?? 'unavailable'}`,
    `- Debugger overhead: snapshot read=${renderMetric(overhead?.snapshotReadMs, ' ms')} (${renderMetric(overhead?.snapshotReadCount)} reads), observer bookkeeping=${renderMetric(overhead?.observerBookkeepingMs, ' ms')}, selector/deep audit=${renderMetric(overhead?.selectorProbeMs, ' ms')}, provenance probe=${renderMetric(overhead?.provenanceProbeMs, ' ms')}, write probe=${renderMetric(overhead?.writeProbeMs, ' ms')}, scan-evidence probe=${renderMetric(overhead?.scanEvidenceProbeMs, ' ms')}, discovery identity record=${renderMetric(overhead?.discoveryIdentity?.recordOverheadMs, ' ms')} (social=${renderMetric(overhead?.discoveryIdentity?.socialMetricsRecordOverheadMs, ' ms')}, short-form=${renderMetric(overhead?.discoveryIdentity?.shortFormRecordOverheadMs, ' ms')}), discovery identity snapshot=${renderMetric(overhead?.discoveryIdentity?.snapshotReadOverheadMs, ' ms')}`,
    `- Measurement states: ${JSON.stringify(evidence?.measurementStates || {})}`,
  ];
}

export function buildSiteRunMarkdown(run) {
  const activation = run?.activation || {};
  const effect = run?.observableEffect || {};
  const costs = run?.costs || {};
  const delta = costs.delta || {};
  const disabled = costs.disabled || {};
  const longTasks = costs.after?.longTasks || {};
  const collectors = costs.collectors || {};
  const performance = run?.performance || {};
  const debuggerEvidence = run?.debugger || {};
  const shortFormCompleteness = debuggerEvidence.shortFormCompleteness || null;
  const progression = run?.progression || {};
  const internalEvidence = debuggerEvidence.costEvidence || null;
  const runtimeAttribution = run?.runtimeAttribution || {};
  const failedContracts = (run?.contracts || []).filter((entry) => entry.status === 'FAIL');
  const warnedContracts = (run?.contracts || []).filter((entry) => entry.status === 'WARN');
  return [
    `# ${run.outcome} · ${run.scenarioId} · ${run.lane}`,
    '',
    `- Site: ${run.siteId}`,
    `- Route: ${run.routeId}`,
    `- Feature: ${(run.features || []).join(', ') || 'none'}`,
    `- Scenario: ${run.scenarioId}`,
    `- URL: ${sanitizeSiteHarnessUrl(run.url) || 'unavailable'}`,
    `- Repeat: ${run.repeatIndex}`,
    `- Classification: ${run.classification || 'none'}`,
    `- Blocker evidence: ${run.blocker ? JSON.stringify(run.blocker) : 'none'}`,
    '',
    '## Artifact disclosure precondition',
    '',
    `- State: ${progression.state || 'unavailable'}`,
    `- Reason: ${progression.reason || 'none'}`,
    `- Preparation: ${progression.preparationMode || 'unavailable'}`,
    `- Required families: ${(progression.requiredFamilyIds || []).join(', ') || 'unavailable'}`,
    `- Eligible families: ${(progression.eligibleFamilyIds || []).join(', ') || 'none'}`,
    `- Locked families: ${(progression.lockedFamilyIds || []).join(', ') || 'none'}`,
    `- Unlock source/day: ${progression.unlockProgress?.source || 'unavailable'} / ${renderMetric(progression.unlockProgress?.qualifiedUseDayCount)}`,
    `- First-vision fixture: ${progression.firstVision?.state || 'not_used'}`,
    '',
    '## Activation',
    '',
    `- State: ${activation.state || 'unavailable'}`,
    `- Expected activeFilterKeys: ${(activation.expectedActiveFilterKeys || []).join(', ') || 'none'}`,
    `- Observed activeFilterKeys: ${(activation.activeFilterKeys || []).join(', ') || 'unavailable'}`,
    `- Social activeMetricKeys: ${(activation.social?.activeMetricKeys || []).join(', ') || 'unavailable'}`,
    `- Social compiledPlanCount: ${renderMetric(activation.social?.compiledPlanCount)}`,
    `- Social observerAttached: ${activation.social?.observerAttached ?? 'unavailable'}`,
    '',
    '## Observable effect',
    '',
    `- Status: ${effect.status || 'unavailable'}`,
    `- Applied targets: ${renderMetric(effect.appliedTargetCount)}`,
    `- Eligible candidates: ${renderMetric(effect.candidateCount)}`,
    `- User-settings disable propagation: ${run.configuration?.disabledPropagation?.state || 'unavailable'}`,
    `- User-settings-owned cleanup: ${effect.cleanupState || 'unavailable'}`,
    `- Full runtime/artifact cleanup: ${effect.fullRuntimeCleanupState || 'unavailable'}`,
    `- Re-enabled: ${effect.reenabled === true ? 'yes' : effect.reenabled === false ? 'no' : 'unavailable'}`,
    `- Targeting positive coverage: matched=${renderMetric(effect.targeting?.positive?.matchedSampleCount)}, changed=${renderMetric(effect.targeting?.positive?.changedSampleCount)}, unchanged=${renderMetric(effect.targeting?.positive?.unchangedSampleCount)}`,
    `- Targeting negative controls: matched=${renderMetric(effect.targeting?.negative?.matchedSampleCount)}, changed=${renderMetric(effect.targeting?.negative?.changedSampleCount)}, unchanged=${renderMetric(effect.targeting?.negative?.unchangedSampleCount)}`,
    `- Targeting re-enable coverage: matched=${renderMetric(effect.targeting?.reenabledPositive?.matchedSampleCount)}, changed=${renderMetric(effect.targeting?.reenabledPositive?.changedSampleCount)}, unchanged=${renderMetric(effect.targeting?.reenabledPositive?.unchangedSampleCount)}`,
    '',
    '## Harness-safe media restoration',
    '',
    ...renderTrustedPlayRows(run.actions),
    ...renderSeekPlaybackRestorationRows(run.actions),
    '',
    '## Short-form completeness proof',
    '',
    `- State: ${shortFormCompleteness?.state || 'unavailable'}`,
    `- Reason: ${shortFormCompleteness?.reason || 'short_form_completeness_snapshot_unavailable'}`,
    `- Opportunity ledger: active=${renderMetric(shortFormCompleteness?.counts?.opportunityCount)}, terminal=${renderMetric(shortFormCompleteness?.counts?.terminalCount)}, hidden=${renderMetric(shortFormCompleteness?.counts?.hiddenCount)}, removed=${renderMetric(shortFormCompleteness?.counts?.removedCount)}, pending=${renderMetric(shortFormCompleteness?.counts?.pendingCount)}`,
    ...(
      shortFormCompleteness?.counts?.observedOpportunityCount !== undefined
      || shortFormCompleteness?.counts?.retiredCount !== undefined
        ? [
          `- Opportunity reconciliation: total observed=${renderMetric(shortFormCompleteness?.counts?.observedOpportunityCount)}, active opportunities=${renderMetric(shortFormCompleteness?.counts?.opportunityCount)}, retired after owner reconciliation=${renderMetric(shortFormCompleteness?.counts?.retiredCount)}`,
        ]
        : []
    ),
    `- Causal proof: proven terminal=${renderMetric(shortFormCompleteness?.counts?.causallyProvenTerminalCount)}, unproven terminal=${renderMetric(shortFormCompleteness?.counts?.unprovenTerminalCount)}, owner/marker attributed=${renderMetric(shortFormCompleteness?.counts?.attributedTerminalCount)}, unattributed=${renderMetric(shortFormCompleteness?.counts?.unattributedTerminalCount)}`,
    `- Oracle integrity: duplicate observations=${renderMetric(shortFormCompleteness?.ledger?.duplicateOpportunityObservations)}, target-outcome read failures=${renderMetric(shortFormCompleteness?.ledger?.targetOutcomeReadFailureCount)}, target-outcome mismatches=${renderMetric(shortFormCompleteness?.ledger?.targetOutcomeMismatchCount)}, owner-operation contract failures=${renderMetric(shortFormCompleteness?.ledger?.productOperationContractFailureCount)}, dropped opportunities=${renderMetric(shortFormCompleteness?.ledger?.droppedOpportunityCount)}, evidence gaps=${renderMetric(shortFormCompleteness?.ledger?.evidenceGapCount)}`,
    `- Effect latency: average=${renderMetric(shortFormCompleteness?.timing?.averageEffectLatencyMs, ' ms')}, max=${renderMetric(shortFormCompleteness?.timing?.maxEffectLatencyMs, ' ms')}`,
    `- Oracle overhead: probe=${renderMetric(shortFormCompleteness?.overhead?.probeMs, ' ms')} (${renderMetric(shortFormCompleteness?.overhead?.probeCount)} passes), snapshot=${renderMetric(shortFormCompleteness?.overhead?.snapshotReadMs, ' ms')} (${renderMetric(shortFormCompleteness?.overhead?.snapshotReadCount)} reads)`,
    `- Agent interpretation required: ${shortFormCompleteness?.agentInterpretationRequired ?? 'unavailable'}`,
    '',
    '## Cost and leak signals',
    '',
    `- Heap delta: ${renderMetric(delta.jsHeapUsedBytes, ' B')}`,
    `- DOM node delta: ${renderMetric(delta.nodes)}`,
    `- JS listener delta: ${renderMetric(delta.jsEventListeners)}`,
    `- Observer cardinality delta: mutation=${renderMetric(delta.objectCardinality?.mutationObservers)}, intersection=${renderMetric(delta.objectCardinality?.intersectionObservers)}, resize=${renderMetric(delta.objectCardinality?.resizeObservers)}`,
    `- Page Worker object delta: ${renderMetric(delta.objectCardinality?.workers)}`,
    `- Cardinality after disable: listeners=${renderMetric(disabled.jsEventListeners)}, mutation observers=${renderMetric(disabled.objectCardinality?.mutationObservers)}, intersection observers=${renderMetric(disabled.objectCardinality?.intersectionObservers)}, resize observers=${renderMetric(disabled.objectCardinality?.resizeObservers)}, workers=${renderMetric(disabled.objectCardinality?.workers)}`,
    `- Long tasks: state=${longTasks.status || 'unavailable'}, reason=${longTasks.reason || 'none'}, count=${renderMetric(longTasks.count)}, total=${renderMetric(longTasks.totalMs, ' ms')}, max=${renderMetric(longTasks.maxMs, ' ms')}`,
    `- Long animation frames: state=${collectors.longAnimationFrames?.status || 'unavailable'}, reason=${collectors.longAnimationFrames?.reason || 'none'}, observed=${renderMetric(collectors.longAnimationFrames?.observedEntryCount)}`,
    `- Extension worker error collector: state=${collectors.extensionServiceWorker?.availability || 'unavailable'}, reason=${collectors.extensionServiceWorker?.reason || 'none'}, restarts=${renderMetric(collectors.extensionServiceWorker?.restartCount)}, reattachments=${renderMetric(collectors.extensionServiceWorker?.reattachCount)}, coverage gaps=${renderMetric(collectors.extensionServiceWorker?.coverageGapCount)}`,
    `- Local storage growth: ${renderMetric(costs.storage?.localGrowthBytes, ' B')}`,
    `- Session storage growth: ${renderMetric(costs.storage?.sessionGrowthBytes, ' B')}`,
    `- Workers after page close: extension dedicated/shared=${renderMetric(costs.targetsAfterClose?.extensionDedicatedWorkers?.length)}, extension service=${renderMetric(costs.targetsAfterClose?.extensionServiceWorkers?.length)}, site=${renderMetric(costs.targetsAfterClose?.siteWorkers?.length)}`,
    `- Pending queues settled: ${run.cleanup?.pendingQueuesSettled ?? 'unavailable'}`,
    '',
    '## Trusted-action runtime attribution',
    '',
    `- State: ${runtimeAttribution.state || 'not_requested'} (${runtimeAttribution.reason || 'none'})`,
    `- Action coverage: ${renderMetric(runtimeAttribution.measuredActionCount)}/${renderMetric(runtimeAttribution.performedActionCount)}`,
    `- Contention coverage: state=${runtimeAttribution.contentionState || 'not_requested'}, attributed=${renderMetric(runtimeAttribution.attributedActionCount)}/${renderMetric(runtimeAttribution.performedActionCount)}`,
    `- Renderer totals: task=${renderMetric(runtimeAttribution.totals?.rendererTaskMs, ' ms')}, script=${renderMetric(runtimeAttribution.totals?.rendererScriptMs, ' ms')}, layout=${renderMetric(runtimeAttribution.totals?.rendererLayoutMs, ' ms')}, style recalc=${renderMetric(runtimeAttribution.totals?.rendererRecalcStyleMs, ' ms')}`,
    `- Instrumented Entropy union: ${renderMetric(runtimeAttribution.totals?.instrumentedEntropyMs, ' ms')}`,
    `- Mixed renderer residual: ${renderMetric(runtimeAttribution.totals?.rendererResidualMs, ' ms')} (page + browser + uninstrumented Entropy)`,
    `- Long-task residual: ${renderMetric(runtimeAttribution.totals?.longTaskResidualMs, ' ms')}`,
    `- Instrumented owners: ${JSON.stringify(runtimeAttribution.byOwner || [])}`,
    `- User-perceived hitch signal: ${JSON.stringify(runtimeAttribution.responsiveness || null)}`,
    `- LoAF / Entropy same-frame correlation: state=${runtimeAttribution.responsiveness?.contentionState || 'unavailable'}, owner-overlapping frames=${renderMetric(runtimeAttribution.responsiveness?.ownerOverlappingFrameCount)}, owner overlap=${renderMetric(runtimeAttribution.responsiveness?.ownerOverlapMs, ' ms')}, style/layout-phase frames=${renderMetric(runtimeAttribution.responsiveness?.ownerStyleAndLayoutPhaseOverlappingFrameCount)}, style/layout-phase overlap=${renderMetric(runtimeAttribution.responsiveness?.ownerStyleAndLayoutPhaseOverlapMs, ' ms')}`,
    `- Entropy-extension forced style/layout inside LoAF: ${renderMetric(runtimeAttribution.responsiveness?.entropyExtensionForcedStyleAndLayoutDurationMs, ' ms')}`,
    `- Worst action: ${JSON.stringify(runtimeAttribution.worstAction || null)}`,
    '',
    '## Content-load causal windows',
    '',
    ...renderContentLoadCausalRows(run.actions),
    '',
    '## Approved performance operating envelope',
    '',
    `- State: ${performance.status || 'unavailable'}`,
    `- Reason: ${performance.reason || 'none'}`,
    `- Policy: ${performance.policy || 'unavailable'}`,
    `- Workload fingerprint: ${performance.workloadFingerprint?.id || 'unavailable'}`,
    `- Samples: ${renderMetric(performance.workload?.sampleCount)}; required=${renderMetric(performance.minimumSampleCount)}`,
    `- Sample eligibility: external=${performance.sampleEligibility?.external?.state || 'unavailable'}, internal=${performance.sampleEligibility?.internal?.state || 'unavailable'}, phase=${performance.sampleEligibility?.phase?.state || 'unavailable'}`,
    `- Cohort eligibility: external=${renderMetric(performance.cohortEligibility?.externalEligibleSampleCount)}/${renderMetric(performance.cohortEligibility?.totalSampleCount)}, internal=${renderMetric(performance.cohortEligibility?.internalEligibleSampleCount)}/${renderMetric(performance.cohortEligibility?.totalSampleCount)}`,
    `- Eligibility advisories: ${JSON.stringify(performance.sampleEligibility?.advisoryContracts || [])}`,
    `- Eligibility blockers: ${JSON.stringify(performance.sampleEligibility?.blockingContracts || [])}`,
    `- Valid samples by metric: ${JSON.stringify(performance.metricSampleCounts || {})}`,
    `- Phase metric exclusions: ${JSON.stringify(performance.metricSampleCounts?.phaseMetricExclusions || {})}`,
    `- Insufficient metric samples: ${JSON.stringify(performance.insufficientMetricSamples || [])}`,
    `- Workload checks: ${JSON.stringify(performance.workloadChecks || [])}`,
    `- Normalized median metrics: ${JSON.stringify(performance.normalizedMedian || performance.normalizedMetrics || {})}`,
    `- Automatic baseline update: forbidden`,
    '',
    '## Runtime Debugger separation',
    '',
    `- Lane availability: ${debuggerEvidence.availability || 'unavailable'}`,
    `- Lifecycle session segments: ${renderMetric(debuggerEvidence.lifecycleSegments?.length)}`,
    `- Probe validity: ${JSON.stringify(debuggerEvidence.validity || {})}`,
    `- Snapshot/read overhead: ${renderMetric(debuggerEvidence.overhead?.snapshotReadMs, ' ms')}`,
    `- Selector/deep-audit overhead: ${renderMetric(debuggerEvidence.overhead?.selectorProbeMs, ' ms')}`,
    `- Primary cost payload: ${debuggerEvidence.provenance?.primaryCostPayload || 'unavailable'}`,
    `- Post-measurement REPORT overhead: ${JSON.stringify(debuggerEvidence.postMeasurementOverhead?.report || {})}`,
    `- Post-measurement STOP overhead: ${JSON.stringify(debuggerEvidence.postMeasurementOverhead?.stop || {})}`,
    '',
    '## Runtime Debugger settle trajectories',
    '',
    ...renderDebuggerSettleTrajectoryRows(debuggerEvidence),
    '',
    '## Runtime Debugger internal cost and leak evidence',
    '',
    ...renderInternalEvidenceRows(internalEvidence),
    '',
    '## Runtime Debugger scanner phase ledger',
    '',
    ...renderPhaseCostEvidenceRows(debuggerEvidence.phaseCostEvidence),
    '## Failed contracts',
    '',
    renderList(failedContracts, 'none'),
    '',
    '## Warnings',
    '',
    renderList(warnedContracts, 'none'),
    '',
    '## Errors',
    '',
    renderList(run?.errors, 'none'),
    '',
    '## Reproduction',
    '',
    '```bash',
    run.reproductionCommand,
    '```',
    '',
    '## Artifacts',
    '',
    renderList(Object.entries(run?.artifacts || {}).map(([key, value]) => `${key}: ${value}`), 'none'),
    '',
  ].join('\n');
}

function renderComparisonMetricRow(label, diagnostic, release, suffix = '') {
  return `| ${label} | ${renderMetric(diagnostic, suffix)} | ${renderMetric(release, suffix)} |`;
}

function renderControlAttributionMetricRow(
  label,
  key,
  control,
  attribution,
  suffix = '',
) {
  return `| ${label} | ${renderMetric(control?.[key], suffix)} | ${renderMetric(attribution?.releaseMinusControl?.[key], suffix)} | ${renderMetric(attribution?.diagnosticMinusControl?.[key], suffix)} |`;
}

function renderScenarioComparison(comparison) {
  const diagnostic = comparison.lanes.diagnostic;
  const release = comparison.lanes.release;
  const diagnosticExternal = diagnostic?.medianCosts?.external;
  const releaseExternal = release?.medianCosts?.external;
  const diagnosticInternal = diagnostic?.medianCosts?.internal;
  const releaseInternal = release?.medianCosts?.internal;
  const control = comparison.control;
  const controlExternal = control?.medianCosts?.external;
  const attribution = comparison.externalAttribution;
  const trustedAction = attribution?.trustedAction;
  const statusRows = [
    `| Outcome | ${diagnostic?.outcome || 'unavailable'} | ${release?.outcome || 'unavailable'} |`,
    `| Repeat samples | ${renderMetric(diagnostic?.sampleCount)} | ${renderMetric(release?.sampleCount)} |`,
    `| Internal-cost valid samples | ${renderMetric(diagnostic?.internalCostSamples?.validSampleCount)} / ${renderMetric(diagnostic?.internalCostSamples?.totalSampleCount)} | ${renderMetric(release?.internalCostSamples?.validSampleCount)} / ${renderMetric(release?.internalCostSamples?.totalSampleCount)} |`,
    `| Artifact disclosure | ${renderStateSet(diagnostic?.progressionStates)} | ${renderStateSet(release?.progressionStates)} |`,
    `| Activation state | ${renderStateSet(diagnostic?.activationStates)} | ${renderStateSet(release?.activationStates)} |`,
    `| Observable effect | ${renderStateSet(diagnostic?.observableEffectStates)} | ${renderStateSet(release?.observableEffectStates)} |`,
    `| Short-form completeness | ${renderStateSet(diagnostic?.shortFormCompletenessStates)} | ${renderStateSet(release?.shortFormCompletenessStates)} |`,
    `| Pending queues settled | ${renderStateSet(diagnostic?.pendingQueueStates)} | ${renderStateSet(release?.pendingQueueStates)} |`,
    `| Performance baseline | ${renderStateSet(diagnostic?.performanceStates)} | ${renderStateSet(release?.performanceStates)} |`,
    `| Long-task measurement | ${renderStateSet(diagnostic?.longTaskMeasurementStates)} | ${renderStateSet(release?.longTaskMeasurementStates)} |`,
    `| Long-animation-frame measurement | ${renderStateSet(diagnostic?.longAnimationFrameMeasurementStates)} | ${renderStateSet(release?.longAnimationFrameMeasurementStates)} |`,
    `| Extension worker collector | ${renderStateSet(diagnostic?.extensionWorkerCollectorStates)} | ${renderStateSet(release?.extensionWorkerCollectorStates)} |`,
    `| Debugger availability | ${renderStateSet(diagnostic?.debuggerAvailability)} | ${renderStateSet(release?.debuggerAvailability)} |`,
    `| Code-owned scanner verdict | ${renderStateSet(diagnostic?.scannerStructuralStates)} | ${renderStateSet(release?.scannerStructuralStates)} |`,
    `| Exact discovery identity | state=${renderStateSet(diagnostic?.exactDiscoveryIdentityStates)}, complete=${renderStateSet(diagnostic?.exactDiscoveryCompletenessStates)}, exact overlap proven=${renderStateSet(diagnostic?.exactDiscoveryOverlapProofStates)}, same flush+reason proven=${renderStateSet(diagnostic?.sameFlushReasonOverlapProofStates)} | state=${renderStateSet(release?.exactDiscoveryIdentityStates)}, complete=${renderStateSet(release?.exactDiscoveryCompletenessStates)}, exact overlap proven=${renderStateSet(release?.exactDiscoveryOverlapProofStates)}, same flush+reason proven=${renderStateSet(release?.sameFlushReasonOverlapProofStates)} |`,
  ];
  const externalRows = [
    renderComparisonMetricRow('Measurement window median', diagnosticExternal?.measurementWindowMs, releaseExternal?.measurementWindowMs, ' ms'),
    renderComparisonMetricRow('Heap growth median', diagnosticExternal?.heapGrowthBytes, releaseExternal?.heapGrowthBytes, ' B'),
    renderComparisonMetricRow('DOM node growth median', diagnosticExternal?.domNodeGrowth, releaseExternal?.domNodeGrowth),
    renderComparisonMetricRow('Listener growth median', diagnosticExternal?.listenerGrowth, releaseExternal?.listenerGrowth),
    renderComparisonMetricRow('MutationObserver growth median', diagnosticExternal?.mutationObserverGrowth, releaseExternal?.mutationObserverGrowth),
    renderComparisonMetricRow('IntersectionObserver growth median', diagnosticExternal?.intersectionObserverGrowth, releaseExternal?.intersectionObserverGrowth),
    renderComparisonMetricRow('ResizeObserver growth median', diagnosticExternal?.resizeObserverGrowth, releaseExternal?.resizeObserverGrowth),
    renderComparisonMetricRow('Page Worker growth median', diagnosticExternal?.pageWorkerGrowth, releaseExternal?.pageWorkerGrowth),
    renderComparisonMetricRow('Task duration delta median', diagnosticExternal?.taskDurationMs, releaseExternal?.taskDurationMs, ' ms'),
    renderComparisonMetricRow('Script duration delta median', diagnosticExternal?.scriptDurationMs, releaseExternal?.scriptDurationMs, ' ms'),
    renderComparisonMetricRow('Layout duration delta median', diagnosticExternal?.layoutDurationMs, releaseExternal?.layoutDurationMs, ' ms'),
    renderComparisonMetricRow('Long-task count median', diagnosticExternal?.longTaskCount, releaseExternal?.longTaskCount),
    renderComparisonMetricRow('Long-task total median', diagnosticExternal?.longTaskTotalMs, releaseExternal?.longTaskTotalMs, ' ms'),
    renderComparisonMetricRow('Long-task maximum median', diagnosticExternal?.longTaskMaxMs, releaseExternal?.longTaskMaxMs, ' ms'),
    renderComparisonMetricRow('Local storage growth median', diagnosticExternal?.localStorageGrowthBytes, releaseExternal?.localStorageGrowthBytes, ' B'),
    renderComparisonMetricRow('Session storage growth median', diagnosticExternal?.sessionStorageGrowthBytes, releaseExternal?.sessionStorageGrowthBytes, ' B'),
    renderComparisonMetricRow('Extension dedicated workers after close', diagnosticExternal?.extensionDedicatedWorkersAfterClose, releaseExternal?.extensionDedicatedWorkersAfterClose),
    renderComparisonMetricRow('Extension service workers after close', diagnosticExternal?.extensionServiceWorkersAfterClose, releaseExternal?.extensionServiceWorkersAfterClose),
    renderComparisonMetricRow('Site workers after close', diagnosticExternal?.siteWorkersAfterClose, releaseExternal?.siteWorkersAfterClose),
  ];
  const internalRows = [
    renderComparisonMetricRow('Duplicate scans median', diagnosticInternal?.duplicateScans, releaseInternal?.duplicateScans),
    renderComparisonMetricRow('Avoidable full rescans median', diagnosticInternal?.avoidableFullRescans, releaseInternal?.avoidableFullRescans),
    `| Duplicate-scan evidence median | evaluations=${renderMetric(diagnosticInternal?.duplicateScanEvaluations)}, unavailable=${renderMetric(diagnosticInternal?.duplicateScanEvidenceUnavailable)} | evaluations=${renderMetric(releaseInternal?.duplicateScanEvaluations)}, unavailable=${renderMetric(releaseInternal?.duplicateScanEvidenceUnavailable)} |`,
    `| Avoidable-full evidence median | evaluations=${renderMetric(diagnosticInternal?.avoidableFullRescanEvaluations)}, measured executions=${renderMetric(diagnosticInternal?.avoidableFullRescanMeasuredExecutions)}, unavailable=${renderMetric(diagnosticInternal?.avoidableFullRescanEvidenceUnavailable)} | evaluations=${renderMetric(releaseInternal?.avoidableFullRescanEvaluations)}, measured executions=${renderMetric(releaseInternal?.avoidableFullRescanMeasuredExecutions)}, unavailable=${renderMetric(releaseInternal?.avoidableFullRescanEvidenceUnavailable)} |`,
    `| Scan shape median | admitted full=${renderMetric(diagnosticInternal?.admittedFullScans)}, admitted dirty=${renderMetric(diagnosticInternal?.admittedDirtyScans)}, executed full=${renderMetric(diagnosticInternal?.executedFullScans)}, executed dirty=${renderMetric(diagnosticInternal?.executedDirtyScans)} | admitted full=${renderMetric(releaseInternal?.admittedFullScans)}, admitted dirty=${renderMetric(releaseInternal?.admittedDirtyScans)}, executed full=${renderMetric(releaseInternal?.executedFullScans)}, executed dirty=${renderMetric(releaseInternal?.executedDirtyScans)} |`,
    `| Scan admission/merge median | admitted=${renderMetric(diagnosticInternal?.scanAdmissions)}, enqueued=${renderMetric(diagnosticInternal?.enqueuedScans)}, merged=${renderMetric(diagnosticInternal?.mergedScans)}, merge=${renderMetric(diagnosticInternal?.scanMergeSharePercent, '%')} | admitted=${renderMetric(releaseInternal?.scanAdmissions)}, enqueued=${renderMetric(releaseInternal?.enqueuedScans)}, merged=${renderMetric(releaseInternal?.mergedScans)}, merge=${renderMetric(releaseInternal?.scanMergeSharePercent, '%')} |`,
    `| Mutation routing median | routed groups=${renderMetric(diagnosticInternal?.routedMutationGroups)}, skipped groups=${renderMetric(diagnosticInternal?.skippedMutationGroups)} (rule=${renderMetric(diagnosticInternal?.mutationRuleSkips)}, host-root=${renderMetric(diagnosticInternal?.hostRootRelevanceSkips)}), self-echo consumed=${renderMetric(diagnosticInternal?.selfMutationRecordsConsumed)} | routed groups=${renderMetric(releaseInternal?.routedMutationGroups)}, skipped groups=${renderMetric(releaseInternal?.skippedMutationGroups)} (rule=${renderMetric(releaseInternal?.mutationRuleSkips)}, host-root=${renderMetric(releaseInternal?.hostRootRelevanceSkips)}), self-echo consumed=${renderMetric(releaseInternal?.selfMutationRecordsConsumed)} |`,
    `| Dirty-root breadth median | total=${renderMetric(diagnosticInternal?.dirtyRootBreadthTotal)}, max=${renderMetric(diagnosticInternal?.dirtyRootBreadthMax)} | total=${renderMetric(releaseInternal?.dirtyRootBreadthTotal)}, max=${renderMetric(releaseInternal?.dirtyRootBreadthMax)} |`,
    `| ObserverHub flush shape median | total=${renderMetric(diagnosticInternal?.observerFlushes)}, attributes=${renderMetric(diagnosticInternal?.observerAttributeOnlyFlushes)}, children=${renderMetric(diagnosticInternal?.observerChildOnlyFlushes)}, mixed=${renderMetric(diagnosticInternal?.observerMixedFlushes)}, tiny=${renderMetric(diagnosticInternal?.observerTinyFlushes)} | total=${renderMetric(releaseInternal?.observerFlushes)}, attributes=${renderMetric(releaseInternal?.observerAttributeOnlyFlushes)}, children=${renderMetric(releaseInternal?.observerChildOnlyFlushes)}, mixed=${renderMetric(releaseInternal?.observerMixedFlushes)}, tiny=${renderMetric(releaseInternal?.observerTinyFlushes)} |`,
    `| ObserverHub cost median | queue=${renderMetric(diagnosticInternal?.observerQueueWaitMs, ' ms')}, callbacks=${renderMetric(diagnosticInternal?.observerSubscriberCallbackMs, ' ms')} | queue=${renderMetric(releaseInternal?.observerQueueWaitMs, ' ms')}, callbacks=${renderMetric(releaseInternal?.observerSubscriberCallbackMs, ' ms')} |`,
    `| ObserverHub subscriber attribution median | ${renderObserverSubscriberCosts(diagnosticInternal?.observerSubscriberCosts)} | ${renderObserverSubscriberCosts(releaseInternal?.observerSubscriberCosts)} |`,
    `| ObserverHub attribute pressure median | style=${renderMetric(diagnosticInternal?.observerStyleMutations)}, class=${renderMetric(diagnosticInternal?.observerClassMutations)} | style=${renderMetric(releaseInternal?.observerStyleMutations)}, class=${renderMetric(releaseInternal?.observerClassMutations)} |`,
    `| Visual media cost median | operations=${renderMetric(diagnosticInternal?.visualMediaOperations)} (mutation=${renderMetric(diagnosticInternal?.visualMediaMutationScans)}), roots=${renderMetric(diagnosticInternal?.visualMediaIncomingRoots)} -> relevant=${renderMetric(diagnosticInternal?.visualMediaRelevantRoots)}, managed style roots skipped=${renderMetric(diagnosticInternal?.visualMediaManagedTargetStyleRootsSkipped)}, effect writes=${renderMetric(diagnosticInternal?.visualMediaWrites)}, no-ops=${renderMetric(diagnosticInternal?.visualMediaNoops)}, effects=create ${renderMetric(diagnosticInternal?.visualMediaCompositeEffectCreates)} (${renderMetric(diagnosticInternal?.visualMediaCompositeEffectCreateMs, ' ms')}), update ${renderMetric(diagnosticInternal?.visualMediaCompositeEffectUpdates)} (${renderMetric(diagnosticInternal?.visualMediaCompositeEffectUpdateMs, ' ms')}), recreate ${renderMetric(diagnosticInternal?.visualMediaCompositeEffectRecreates)}, cancel ${renderMetric(diagnosticInternal?.visualMediaCompositeEffectCancels)} (${renderMetric(diagnosticInternal?.visualMediaCompositeEffectCancelMs, ' ms')}), elapsed=${renderMetric(diagnosticInternal?.visualMediaTotalMs, ' ms')} | operations=${renderMetric(releaseInternal?.visualMediaOperations)} (mutation=${renderMetric(releaseInternal?.visualMediaMutationScans)}), roots=${renderMetric(releaseInternal?.visualMediaIncomingRoots)} -> relevant=${renderMetric(releaseInternal?.visualMediaRelevantRoots)}, managed style roots skipped=${renderMetric(releaseInternal?.visualMediaManagedTargetStyleRootsSkipped)}, effect writes=${renderMetric(releaseInternal?.visualMediaWrites)}, no-ops=${renderMetric(releaseInternal?.visualMediaNoops)}, effects=create ${renderMetric(releaseInternal?.visualMediaCompositeEffectCreates)} (${renderMetric(releaseInternal?.visualMediaCompositeEffectCreateMs, ' ms')}), update ${renderMetric(releaseInternal?.visualMediaCompositeEffectUpdates)} (${renderMetric(releaseInternal?.visualMediaCompositeEffectUpdateMs, ' ms')}), recreate ${renderMetric(releaseInternal?.visualMediaCompositeEffectRecreates)}, cancel ${renderMetric(releaseInternal?.visualMediaCompositeEffectCancels)} (${renderMetric(releaseInternal?.visualMediaCompositeEffectCancelMs, ' ms')}), elapsed=${renderMetric(releaseInternal?.visualMediaTotalMs, ' ms')} |`,
    `| Selector/candidate decision flow median | ${renderMetric(diagnosticInternal?.selectorHits)} -> ${renderMetric(diagnosticInternal?.resolvedTargets)} -> non-clear=${renderMetric(diagnosticInternal?.nonClearCandidateDecisions)} | ${renderMetric(releaseInternal?.selectorHits)} -> ${renderMetric(releaseInternal?.resolvedTargets)} -> non-clear=${renderMetric(releaseInternal?.nonClearCandidateDecisions)} |`,
    `| Candidate decision shape median | semantic candidates=${renderMetric(diagnosticInternal?.semanticCandidates)}, all decisions=${renderMetric(diagnosticInternal?.candidateDecisions)}, non-clear=${renderMetric(diagnosticInternal?.nonClearCandidateDecisions)} | semantic candidates=${renderMetric(releaseInternal?.semanticCandidates)}, all decisions=${renderMetric(releaseInternal?.candidateDecisions)}, non-clear=${renderMetric(releaseInternal?.nonClearCandidateDecisions)} |`,
    `| Candidate provenance median | selector-only=${renderMetric(diagnosticInternal?.selectorOnlyHits)}, semantic-only=${renderMetric(diagnosticInternal?.semanticOnlyHits)}, overlap=${renderMetric(diagnosticInternal?.selectorSemanticOverlapHits)}, semantic incremental=${renderMetric(diagnosticInternal?.semanticIncrementalYieldPercent, '%')} | selector-only=${renderMetric(releaseInternal?.selectorOnlyHits)}, semantic-only=${renderMetric(releaseInternal?.semanticOnlyHits)}, overlap=${renderMetric(releaseInternal?.selectorSemanticOverlapHits)}, semantic incremental=${renderMetric(releaseInternal?.semanticIncrementalYieldPercent, '%')} |`,
    `| YouTube selector-drift recovery | state=${renderMetric(diagnostic?.selectorDriftRecovery?.state)}, observed=${renderMetric(diagnostic?.selectorDriftRecovery?.observedRunCount)}, parity=${renderMetric(diagnostic?.selectorDriftRecovery?.effectParityRunCount)}, independent epochs=${renderMetric(diagnostic?.selectorDriftRecovery?.independentEpochCount)}/${renderMetric(diagnostic?.selectorDriftRecovery?.requiredIndependentEpochCount)}, alert=${renderMetric(diagnostic?.selectorDriftRecovery?.alert)} | state=${renderMetric(release?.selectorDriftRecovery?.state)}, observed=${renderMetric(release?.selectorDriftRecovery?.observedRunCount)}, parity=${renderMetric(release?.selectorDriftRecovery?.effectParityRunCount)}, independent epochs=${renderMetric(release?.selectorDriftRecovery?.independentEpochCount)}/${renderMetric(release?.selectorDriftRecovery?.requiredIndependentEpochCount)}, alert=${renderMetric(release?.selectorDriftRecovery?.alert)} |`,
    `| Non-clear decisions vs physical writes median | non-clear decisions=${renderMetric(diagnosticInternal?.writeNonClearCandidateDecisions)}, attempts=${renderMetric(diagnosticInternal?.writeAttempts)}, all writes incl cleanup=${renderMetric(diagnosticInternal?.allPhysicalWritesIncludingCleanup)}, unchanged/no-op=${renderMetric(diagnosticInternal?.unchangedWriteAttempts)} | non-clear decisions=${renderMetric(releaseInternal?.writeNonClearCandidateDecisions)}, attempts=${renderMetric(releaseInternal?.writeAttempts)}, all writes incl cleanup=${renderMetric(releaseInternal?.allPhysicalWritesIncludingCleanup)}, unchanged/no-op=${renderMetric(releaseInternal?.unchangedWriteAttempts)} |`,
    `| Decision write outcomes median | actual-write=${renderMetric(diagnosticInternal?.actualWriteDecisions)}, unchanged/no-op=${renderMetric(diagnosticInternal?.unchangedNoopDecisions)}, no-write=${renderMetric(diagnosticInternal?.noWriteDecisions)} | actual-write=${renderMetric(releaseInternal?.actualWriteDecisions)}, unchanged/no-op=${renderMetric(releaseInternal?.unchangedNoopDecisions)}, no-write=${renderMetric(releaseInternal?.noWriteDecisions)} |`,
    `| Physical write shape median | actual-write targets=${renderMetric(diagnosticInternal?.actualWriteTargetCount)}, apply=${renderMetric(diagnosticInternal?.applyPhysicalWrites)}, post-chunk=${renderMetric(diagnosticInternal?.postChunkCleanupPhysicalWrites)}, config=${renderMetric(diagnosticInternal?.configurationCleanupPhysicalWrites)} | actual-write targets=${renderMetric(releaseInternal?.actualWriteTargetCount)}, apply=${renderMetric(releaseInternal?.applyPhysicalWrites)}, post-chunk=${renderMetric(releaseInternal?.postChunkCleanupPhysicalWrites)}, config=${renderMetric(releaseInternal?.configurationCleanupPhysicalWrites)} |`,
    `| Cross-scope write ratios median | all incl cleanup/non-clear decision=${renderMetric(diagnosticInternal?.allWritesPerNonClearCandidateDecision, 'x')}, apply/non-clear decision=${renderMetric(diagnosticInternal?.applyWritesPerNonClearCandidateDecision, 'x')}, all incl cleanup/target touch=${renderMetric(diagnosticInternal?.allWritesPerNonClearTargetTouch, 'x')}, actual/attempts=${renderMetric(diagnosticInternal?.actualWriteRatePercent, '%')} | all incl cleanup/non-clear decision=${renderMetric(releaseInternal?.allWritesPerNonClearCandidateDecision, 'x')}, apply/non-clear decision=${renderMetric(releaseInternal?.applyWritesPerNonClearCandidateDecision, 'x')}, all incl cleanup/target touch=${renderMetric(releaseInternal?.allWritesPerNonClearTargetTouch, 'x')}, actual/attempts=${renderMetric(releaseInternal?.actualWriteRatePercent, '%')} |`,
    renderComparisonMetricRow('Zero-candidate collections median', diagnosticInternal?.zeroCandidateCollections, releaseInternal?.zeroCandidateCollections),
    `| Target touches median | touches=${renderMetric(diagnosticInternal?.nonClearTargetTouches)}, repeated=${renderMetric(diagnosticInternal?.repeatedTargetTouches)}, unique=${renderMetric(diagnosticInternal?.uniqueTargetTouches)}, repeat=${renderMetric(diagnosticInternal?.targetTouchRepeatSharePercent, '%')} | touches=${renderMetric(releaseInternal?.nonClearTargetTouches)}, repeated=${renderMetric(releaseInternal?.repeatedTargetTouches)}, unique=${renderMetric(releaseInternal?.uniqueTargetTouches)}, repeat=${renderMetric(releaseInternal?.targetTouchRepeatSharePercent, '%')} |`,
    `| Scanner timing median | selector=${renderMetric(diagnosticInternal?.selectorMs, ' ms')}, semantic=${renderMetric(diagnosticInternal?.semanticMs, ' ms')}, idle=${renderMetric(diagnosticInternal?.idleMs, ' ms')}, apply=${renderMetric(diagnosticInternal?.applyMs, ' ms')}, cleanup total=${renderMetric(diagnosticInternal?.cleanupMs, ' ms')} (post-chunk=${renderMetric(diagnosticInternal?.postChunkCleanupMs, ' ms')}, configuration=${renderMetric(diagnosticInternal?.configurationCleanupMs, ' ms')}), instrumented=${renderMetric(diagnosticInternal?.instrumentedElapsedMs, ' ms')}, known in-path debugger overhead=${renderMetric(diagnosticInternal?.knownInPathDebuggerOverheadMs, ' ms')}, estimated product=${renderMetric(diagnosticInternal?.estimatedProductElapsedMs, ' ms')} | selector=${renderMetric(releaseInternal?.selectorMs, ' ms')}, semantic=${renderMetric(releaseInternal?.semanticMs, ' ms')}, idle=${renderMetric(releaseInternal?.idleMs, ' ms')}, apply=${renderMetric(releaseInternal?.applyMs, ' ms')}, cleanup total=${renderMetric(releaseInternal?.cleanupMs, ' ms')} (post-chunk=${renderMetric(releaseInternal?.postChunkCleanupMs, ' ms')}, configuration=${renderMetric(releaseInternal?.configurationCleanupMs, ' ms')}), instrumented=${renderMetric(releaseInternal?.instrumentedElapsedMs, ' ms')}, known in-path debugger overhead=${renderMetric(releaseInternal?.knownInPathDebuggerOverheadMs, ' ms')}, estimated product=${renderMetric(releaseInternal?.estimatedProductElapsedMs, ' ms')} |`,
    `| Owned-write fail-open median | total=${renderMetric(diagnosticInternal?.ownedMutationFailOpenTotal)}, age=${renderMetric(diagnosticInternal?.ownedMutationExpiredByAge)}, delivery=${renderMetric(diagnosticInternal?.ownedMutationExpiredByDelivery)}, epoch=${renderMetric(diagnosticInternal?.ownedMutationEpochInvalidated)}, root=${renderMetric(diagnosticInternal?.ownedMutationRootInvalidated)}, unobserved=${renderMetric(diagnosticInternal?.ownedMutationTargetUnobserved)}, mismatch=${renderMetric(diagnosticInternal?.ownedMutationValueMismatch)}, excess=${renderMetric(diagnosticInternal?.ownedMutationExcessRecords)} | total=${renderMetric(releaseInternal?.ownedMutationFailOpenTotal)}, age=${renderMetric(releaseInternal?.ownedMutationExpiredByAge)}, delivery=${renderMetric(releaseInternal?.ownedMutationExpiredByDelivery)}, epoch=${renderMetric(releaseInternal?.ownedMutationEpochInvalidated)}, root=${renderMetric(releaseInternal?.ownedMutationRootInvalidated)}, unobserved=${renderMetric(releaseInternal?.ownedMutationTargetUnobserved)}, mismatch=${renderMetric(releaseInternal?.ownedMutationValueMismatch)}, excess=${renderMetric(releaseInternal?.ownedMutationExcessRecords)} |`,
    `| Pending queues median | observer=${renderMetric(diagnosticInternal?.pendingObserverMutations)}, social=${renderMetric(diagnosticInternal?.pendingSocialQueue)}, dirty roots=${renderMetric(diagnosticInternal?.pendingSocialDirtyRoots)}, owned writes=${renderMetric(diagnosticInternal?.pendingSocialOwnedMutations)} | observer=${renderMetric(releaseInternal?.pendingObserverMutations)}, social=${renderMetric(releaseInternal?.pendingSocialQueue)}, dirty roots=${renderMetric(releaseInternal?.pendingSocialDirtyRoots)}, owned writes=${renderMetric(releaseInternal?.pendingSocialOwnedMutations)} |`,
    `| Pending scheduling states | timer=${renderStateSet(diagnostic?.debuggerPendingTimerStates?.socialTimer)}, idle=${renderStateSet(diagnostic?.debuggerPendingTimerStates?.socialIdle)} | timer=${renderStateSet(release?.debuggerPendingTimerStates?.socialTimer)}, idle=${renderStateSet(release?.debuggerPendingTimerStates?.socialIdle)} |`,
    `| Debugger overhead median | read=${renderMetric(diagnosticInternal?.snapshotReadMs, ' ms')} (${renderMetric(diagnosticInternal?.snapshotReadCount)} reads), bookkeeping=${renderMetric(diagnosticInternal?.observerBookkeepingMs, ' ms')}, selector/deep=${renderMetric(diagnosticInternal?.selectorProbeMs, ' ms')}, provenance=${renderMetric(diagnosticInternal?.provenanceProbeMs, ' ms')}, write=${renderMetric(diagnosticInternal?.writeProbeMs, ' ms')}, scan evidence=${renderMetric(diagnosticInternal?.scanEvidenceProbeMs, ' ms')}, identity record=${renderMetric(diagnosticInternal?.discoveryIdentityRecordOverheadMs, ' ms')} (social=${renderMetric(diagnosticInternal?.discoveryIdentitySocialRecordOverheadMs, ' ms')}, short-form=${renderMetric(diagnosticInternal?.discoveryIdentityShortFormRecordOverheadMs, ' ms')}, calls=${renderMetric(diagnosticInternal?.discoveryIdentityRecordCallCount)}), identity snapshot=${renderMetric(diagnosticInternal?.discoveryIdentitySnapshotReadOverheadMs, ' ms')} (${renderMetric(diagnosticInternal?.discoveryIdentitySnapshotReadCount)} reads) | read=${renderMetric(releaseInternal?.snapshotReadMs, ' ms')} (${renderMetric(releaseInternal?.snapshotReadCount)} reads), bookkeeping=${renderMetric(releaseInternal?.observerBookkeepingMs, ' ms')}, selector/deep=${renderMetric(releaseInternal?.selectorProbeMs, ' ms')}, provenance=${renderMetric(releaseInternal?.provenanceProbeMs, ' ms')}, write=${renderMetric(releaseInternal?.writeProbeMs, ' ms')}, scan evidence=${renderMetric(releaseInternal?.scanEvidenceProbeMs, ' ms')}, identity record=${renderMetric(releaseInternal?.discoveryIdentityRecordOverheadMs, ' ms')} (social=${renderMetric(releaseInternal?.discoveryIdentitySocialRecordOverheadMs, ' ms')}, short-form=${renderMetric(releaseInternal?.discoveryIdentityShortFormRecordOverheadMs, ' ms')}, calls=${renderMetric(releaseInternal?.discoveryIdentityRecordCallCount)}), identity snapshot=${renderMetric(releaseInternal?.discoveryIdentitySnapshotReadOverheadMs, ' ms')} (${renderMetric(releaseInternal?.discoveryIdentitySnapshotReadCount)} reads) |`,
    `| Cross-owner exact identity median | unique nodes=${renderMetric(diagnosticInternal?.discoveryIdentityUniqueNodes)}, exact node overlaps=${renderMetric(diagnosticInternal?.discoveryIdentityExactNodeOverlaps)}, phase-node overlaps=${renderMetric(diagnosticInternal?.discoveryIdentityExactPhaseNodeOverlaps)} (roots=${renderMetric(diagnosticInternal?.discoveryIdentityRootOverlaps)}, candidates=${renderMetric(diagnosticInternal?.discoveryIdentityCandidateOverlaps)}, effect targets=${renderMetric(diagnosticInternal?.discoveryIdentityEffectTargetOverlaps)}), same flush+reason=${renderMetric(diagnosticInternal?.discoveryIdentitySameFlushReasonOverlaps)}, dropped visits=${renderMetric(diagnosticInternal?.discoveryIdentityDroppedVisits)} | unique nodes=${renderMetric(releaseInternal?.discoveryIdentityUniqueNodes)}, exact node overlaps=${renderMetric(releaseInternal?.discoveryIdentityExactNodeOverlaps)}, phase-node overlaps=${renderMetric(releaseInternal?.discoveryIdentityExactPhaseNodeOverlaps)} (roots=${renderMetric(releaseInternal?.discoveryIdentityRootOverlaps)}, candidates=${renderMetric(releaseInternal?.discoveryIdentityCandidateOverlaps)}, effect targets=${renderMetric(releaseInternal?.discoveryIdentityEffectTargetOverlaps)}), same flush+reason=${renderMetric(releaseInternal?.discoveryIdentitySameFlushReasonOverlaps)}, dropped visits=${renderMetric(releaseInternal?.discoveryIdentityDroppedVisits)} |`,
  ];
  const controlRows = [
    renderControlAttributionMetricRow('Measurement window median', 'measurementWindowMs', controlExternal, attribution, ' ms'),
    renderControlAttributionMetricRow('Heap growth median', 'heapGrowthBytes', controlExternal, attribution, ' B'),
    renderControlAttributionMetricRow('DOM node growth median', 'domNodeGrowth', controlExternal, attribution),
    renderControlAttributionMetricRow('Listener growth median', 'listenerGrowth', controlExternal, attribution),
    renderControlAttributionMetricRow('MutationObserver growth median', 'mutationObserverGrowth', controlExternal, attribution),
    renderControlAttributionMetricRow('IntersectionObserver growth median', 'intersectionObserverGrowth', controlExternal, attribution),
    renderControlAttributionMetricRow('ResizeObserver growth median', 'resizeObserverGrowth', controlExternal, attribution),
    renderControlAttributionMetricRow('Page Worker growth median', 'pageWorkerGrowth', controlExternal, attribution),
    renderControlAttributionMetricRow('Task duration delta median', 'taskDurationMs', controlExternal, attribution, ' ms'),
    renderControlAttributionMetricRow('Script duration delta median', 'scriptDurationMs', controlExternal, attribution, ' ms'),
    renderControlAttributionMetricRow('Layout duration delta median', 'layoutDurationMs', controlExternal, attribution, ' ms'),
    renderControlAttributionMetricRow('Long-task count median', 'longTaskCount', controlExternal, attribution),
    renderControlAttributionMetricRow('Long-task total median', 'longTaskTotalMs', controlExternal, attribution, ' ms'),
    renderControlAttributionMetricRow('Long-task maximum median', 'longTaskMaxMs', controlExternal, attribution, ' ms'),
    renderControlAttributionMetricRow('Extension dedicated workers after close', 'extensionDedicatedWorkersAfterClose', controlExternal, attribution),
    renderControlAttributionMetricRow('Extension service workers after close', 'extensionServiceWorkersAfterClose', controlExternal, attribution),
    renderControlAttributionMetricRow('Site workers after close', 'siteWorkersAfterClose', controlExternal, attribution),
  ];
  const actionControlTotals = trustedAction?.control?.medianTotals;
  const actionControlResponsiveness = trustedAction?.control?.medianResponsiveness;
  const actionDiagnosticResponsiveness = trustedAction?.diagnostic?.medianResponsiveness;
  const actionRows = [
    `| Renderer task across trusted actions | ${renderMetric(actionControlTotals?.rendererTaskMs, ' ms')} | ${renderMetric(trustedAction?.releaseMinusControl?.totals?.rendererTaskMs?.median, ' ms')} | ${renderMetric(trustedAction?.diagnosticMinusControl?.totals?.rendererTaskMs?.median, ' ms')} |`,
    `| Renderer script across trusted actions | ${renderMetric(actionControlTotals?.rendererScriptMs, ' ms')} | ${renderMetric(trustedAction?.releaseMinusControl?.totals?.rendererScriptMs?.median, ' ms')} | ${renderMetric(trustedAction?.diagnosticMinusControl?.totals?.rendererScriptMs?.median, ' ms')} |`,
    `| Renderer layout across trusted actions | ${renderMetric(actionControlTotals?.rendererLayoutMs, ' ms')} | ${renderMetric(trustedAction?.releaseMinusControl?.totals?.rendererLayoutMs?.median, ' ms')} | ${renderMetric(trustedAction?.diagnosticMinusControl?.totals?.rendererLayoutMs?.median, ' ms')} |`,
    `| Long animation frames across trusted actions | ${renderMetric(actionControlResponsiveness?.longAnimationFrameCount)} | ${renderMetric(trustedAction?.releaseMinusControl?.responsiveness?.longAnimationFrameCount?.median)} | ${renderMetric(trustedAction?.diagnosticMinusControl?.responsiveness?.longAnimationFrameCount?.median)} |`,
    `| LoAF blocking duration across trusted actions | ${renderMetric(actionControlResponsiveness?.totalBlockingDurationMs, ' ms')} | ${renderMetric(trustedAction?.releaseMinusControl?.responsiveness?.totalBlockingDurationMs?.median, ' ms')} | ${renderMetric(trustedAction?.diagnosticMinusControl?.responsiveness?.totalBlockingDurationMs?.median, ' ms')} |`,
    `| Worst LoAF duration across trusted actions | ${renderMetric(actionControlResponsiveness?.maxDurationMs, ' ms')} | ${renderMetric(trustedAction?.releaseMinusControl?.responsiveness?.maxDurationMs?.median, ' ms')} | ${renderMetric(trustedAction?.diagnosticMinusControl?.responsiveness?.maxDurationMs?.median, ' ms')} |`,
    `| Entropy-extension forced style/layout inside LoAF | ${renderMetric(actionControlResponsiveness?.entropyExtensionForcedStyleAndLayoutDurationMs, ' ms')} | ${renderMetric(trustedAction?.releaseMinusControl?.responsiveness?.entropyExtensionForcedStyleAndLayoutDurationMs?.median, ' ms')} | ${renderMetric(trustedAction?.diagnosticMinusControl?.responsiveness?.entropyExtensionForcedStyleAndLayoutDurationMs?.median, ' ms')} |`,
  ];
  const actionDeltaRows = (trustedAction?.releaseMinusControl?.byAction || []).map((entry) => {
    const diagnosticEntry = (trustedAction?.diagnosticMinusControl?.byAction || [])
      .find((candidate) => candidate.key === entry.key);
    return `| ${entry.key} | ${renderMetric(entry.metrics?.rendererTaskMs?.median, ' ms')} | ${renderMetric(diagnosticEntry?.metrics?.rendererTaskMs?.median, ' ms')} | ${renderMetric(entry.metrics?.longAnimationFrameBlockingMs?.median, ' ms')} |`;
  });
  return [
    `### ${comparison.scenarioId}`,
    '',
    `- Site: ${comparison.siteId || 'unavailable'}`,
    `- Route: ${comparison.routeId || 'unavailable'}`,
    `- URL: ${comparison.url || 'unavailable'}`,
    '',
    '| Signal | Diagnostic | Release |',
    '| --- | --- | --- |',
    ...statusRows,
    ...externalRows,
    ...internalRows,
    '',
    '#### Extension-disabled control attribution',
    '',
    `- Control outcome: ${control?.outcome || 'unavailable'}`,
    `- Control measurement states: ${renderStateSet(control?.measurementStates)}`,
    `- Valid control samples: ${renderMetric(control?.validSampleCount)} / ${renderMetric(control?.sampleCount)}`,
    `- Median control/reference clock drift: ${renderMetric(control?.medianClockDriftMs, ' ms')}`,
    `- Control reference state: ${attribution?.controlReferenceState || 'unavailable'}`,
    `- Release product attribution state: ${attribution?.releaseAttributionState || 'unavailable'}`,
    `- Diagnostic product attribution state: ${attribution?.diagnosticAttributionState || 'unavailable'}`,
    `- Attribution state: ${attribution?.state || 'unavailable'}; reason=${attribution?.reason || 'unavailable'}; policy=${attribution?.policy || 'unavailable'}; automatic hard gate=${attribution?.automaticHardGate ?? false}`,
    '',
    '| External signal | Control | Release - control | Diagnostic - control |',
    '| --- | ---: | ---: | ---: |',
    ...controlRows,
    '',
    '#### Trusted-action hitch attribution',
    '',
    `- State: ${trustedAction?.state || 'unavailable'}; policy=${trustedAction?.policy || 'unavailable'}`,
    `- Matched repeat pairs: release=${renderMetric(trustedAction?.releaseMinusControl?.pairCount)}, diagnostic=${renderMetric(trustedAction?.diagnosticMinusControl?.pairCount)}`,
    `- Diagnostic instrumented owners: ${JSON.stringify(trustedAction?.diagnostic?.byOwner || [])}`,
    `- Diagnostic same-frame correlation: owner-overlapping LoAF=${renderMetric(actionDiagnosticResponsiveness?.ownerOverlappingFrameCount)}, owner overlap=${renderMetric(actionDiagnosticResponsiveness?.ownerOverlapMs, ' ms')}, style/layout-phase LoAF=${renderMetric(actionDiagnosticResponsiveness?.ownerStyleAndLayoutPhaseOverlappingFrameCount)}, style/layout-phase overlap=${renderMetric(actionDiagnosticResponsiveness?.ownerStyleAndLayoutPhaseOverlapMs, ' ms')}`,
    '',
    '| Trusted-action signal | Control | Release - control | Diagnostic - control |',
    '| --- | ---: | ---: | ---: |',
    ...actionRows,
    '',
    '| Action | Release - control renderer task | Diagnostic - control renderer task | Release - control LoAF blocking |',
    '| --- | ---: | ---: | ---: |',
    ...(actionDeltaRows.length > 0 ? actionDeltaRows : ['| unavailable | - | - | - |']),
    '',
  ];
}

function buildAggregateMarkdown(report) {
  const runRows = report.runs.map((run) => (
    `| ${run.outcome} | ${run.lane} | ${run.scenarioId} | ${run.repeatIndex} | ${run.classification || ''} | ${sanitizeSiteHarnessUrl(run.url) || ''} |`
  ));
  const controlRows = (report.controls || []).map((run) => (
    `| ${run.outcome} | ${run.scenarioId} | ${run.repeatIndex} | ${run.measurementState || 'unavailable'} | ${run.classification || ''} | ${sanitizeSiteHarnessUrl(run.url) || ''} |`
  ));
  const baselineRows = Object.entries(report.performanceBaselines || {}).map(([key, value]) => (
    `- ${key}: ${value.status} (${value.reason}); fingerprint=${value.workloadFingerprint?.id || 'unavailable'}; policy=${value.policy || 'unavailable'}`
  ));
  const measurementProfile = report.options?.measurementProfile || null;
  const baselineFallback = ['contract', 'contention'].includes(measurementProfile)
    ? `- Approved-baseline evaluation was intentionally skipped by the ${measurementProfile} measurement profile.`
    : '- No approved baseline was available; real-site performance remains WARN-only.';
  const comparisons = report.scenarioComparisons
    || buildScenarioLaneComparisons(report.runs, report.controls || []);
  return [
    `# Entropy real-site E2E · ${report.outcome}`,
    '',
    `- Suite: ${report.suite}`,
    `- Lanes: ${report.lanes.join(', ')}`,
    `- Generated: ${report.generatedAt}`,
    `- Browser: ${report.browser?.product || 'unavailable'}`,
    `- Profile mode: ${report.profile?.mode || 'disposable'}`,
    `- Profile fixture provenance: ${report.profile?.fixtureProvenance?.kind || 'none'}`,
    `- Synthetic canonical progression day: ${renderMetric(report.profile?.fixtureProvenance?.qualifiedUseDayCount)}`,
    `- Extension-disabled control: ${report.extensionDisabledControl?.state || 'not_requested'}`,
    '',
    '| Result | Lane | Scenario | Repeat | Classification | URL |',
    '| --- | --- | --- | ---: | --- | --- |',
    ...runRows,
    '',
    '## Extension-disabled control runs',
    '',
    '| Result | Scenario | Repeat | Measurement state | Classification | URL |',
    '| --- | --- | ---: | --- | --- | --- |',
    ...(controlRows.length > 0 ? controlRows : ['| unavailable | - | - | - | - | - |']),
    '',
    '## Diagnostic vs release scenario medians',
    '',
    ...(comparisons.length > 0
      ? comparisons.flatMap(renderScenarioComparison)
      : ['- unavailable', '']),
    '## Performance baselines',
    '',
    ...(baselineRows.length > 0 ? baselineRows : [baselineFallback]),
    '',
    '## Takeover checkpoints',
    '',
    renderList(report.takeoverCheckpoints, 'none'),
    '',
    '## Commands',
    '',
    '```bash',
    ...(report.reproductionCommands || []),
    '```',
    '',
  ].join('\n');
}

export function buildSiteControlMarkdown(run) {
  const costs = run?.costs || {};
  const delta = costs.delta || {};
  const longTasks = costs.after?.longTasks || {};
  const warnedContracts = (run?.contracts || []).filter((entry) => entry.status === 'WARN');
  return [
    `# ${run.outcome} · ${run.scenarioId} · extension-disabled control`,
    '',
    '- Interpretation: measurement validity only; this is not an Entropy activation PASS.',
    `- Measurement state: ${run.measurementState || 'unavailable'}`,
    `- Classification: ${run.classification || 'none'}`,
    `- Site: ${run.siteId}`,
    `- Route: ${run.routeId}`,
    `- URL: ${sanitizeSiteHarnessUrl(run.url) || 'unavailable'}`,
    `- Repeat: ${run.repeatIndex}`,
    `- Extension state: ${run.extension?.state || 'unavailable'} (${run.extension?.launchPolicy || 'unavailable'})`,
    '',
    '## Flow parity',
    '',
    `- Initial readiness: ${run.readiness?.initial?.readyState || run.readiness?.initial?.error || 'unavailable'}`,
    `- Post-lifecycle readiness: ${run.readiness?.postLifecycle?.readyState || run.readiness?.postLifecycle?.error || 'unavailable'}`,
    `- Site action results: ${JSON.stringify(run.actions || [])}`,
    '- Product configuration phases: not applicable because Entropy is absent.',
    `- Measurement window: ${renderMetric(costs.measurementWindowMs, ' ms')}`,
    `- Reference release window: ${renderMetric(costs.referenceMeasurementWindowMs, ' ms')}`,
    `- Clock drift: ${renderMetric(costs.clockDriftMs, ' ms')}`,
    '',
    '## External cost baseline',
    '',
    `- Heap delta: ${renderMetric(delta.jsHeapUsedBytes, ' B')}`,
    `- DOM node delta: ${renderMetric(delta.nodes)}`,
    `- JS listener delta: ${renderMetric(delta.jsEventListeners)}`,
    `- Observer cardinality delta: mutation=${renderMetric(delta.objectCardinality?.mutationObservers)}, intersection=${renderMetric(delta.objectCardinality?.intersectionObservers)}, resize=${renderMetric(delta.objectCardinality?.resizeObservers)}`,
    `- Page Worker object delta: ${renderMetric(delta.objectCardinality?.workers)}`,
    `- Task/script/layout delta: ${renderMetric(delta.taskDurationMs, ' ms')} / ${renderMetric(delta.scriptDurationMs, ' ms')} / ${renderMetric(delta.layoutDurationMs, ' ms')}`,
    `- Long tasks: state=${longTasks.status || 'unavailable'}, count=${renderMetric(longTasks.count)}, total=${renderMetric(longTasks.totalMs, ' ms')}, max=${renderMetric(longTasks.maxMs, ' ms')}`,
    `- Long animation frames: state=${costs.collectors?.longAnimationFrames?.status || 'unavailable'}, observed=${renderMetric(costs.collectors?.longAnimationFrames?.observedEntryCount)}`,
    `- Trusted-action renderer and hitch baseline: ${JSON.stringify(run.runtimeAttribution || null)}`,
    '',
    '## Content-load causal windows',
    '',
    ...renderContentLoadCausalRows(run.actions),
    `- Extension storage growth: unavailable (state=${costs.storage?.state || 'inactive'}, reason=${costs.storage?.reason || 'extension_disabled'})`,
    `- Workers after page close: extension dedicated/shared=${renderMetric(costs.targetsAfterClose?.extensionDedicatedWorkers?.length)}, extension service=${renderMetric(costs.targetsAfterClose?.extensionServiceWorkers?.length)}, site=${renderMetric(costs.targetsAfterClose?.siteWorkers?.length)}`,
    '',
    '## Contracts and warnings',
    '',
    renderList(run?.contracts, 'none'),
    '',
    '## Warnings',
    '',
    renderList(warnedContracts, 'none'),
    '',
    '## Errors',
    '',
    renderList(run?.errors, 'none'),
    '',
    '## Reproduction',
    '',
    '```bash',
    run.reproductionCommand,
    '```',
    '',
  ].join('\n');
}

export async function writeSiteRunArtifacts(run, reportRoot) {
  const runDir = path.join(
    reportRoot,
    'runs',
    safeSegment(run.lane),
    safeSegment(run.scenarioId),
    `repeat-${Math.max(1, Number(run.repeatIndex) || 1)}`,
  );
  await fs.mkdir(runDir, { recursive: true });
  const jsonPath = path.join(runDir, 'run.json');
  const markdownPath = path.join(runDir, 'summary.md');
  let debuggerEvidence = run.debugger || null;
  const debuggerArtifacts = {};
  if (debuggerEvidence?.payload) {
    const debuggerJsonPath = path.join(runDir, 'runtime-debugger.json');
    await fs.writeFile(
      debuggerJsonPath,
      `${JSON.stringify(debuggerEvidence.payload, null, 2)}\n`,
    );
    debuggerArtifacts.debuggerJson = debuggerJsonPath;
  }
  if (debuggerEvidence?.reportPayload) {
    const debuggerReportJsonPath = path.join(runDir, 'runtime-debugger-report.json');
    await fs.writeFile(
      debuggerReportJsonPath,
      `${JSON.stringify(debuggerEvidence.reportPayload, null, 2)}\n`,
    );
    debuggerArtifacts.debuggerReportJson = debuggerReportJsonPath;
  }
  if (debuggerEvidence?.stopPayload) {
    const debuggerStopJsonPath = path.join(runDir, 'runtime-debugger-stop.json');
    await fs.writeFile(
      debuggerStopJsonPath,
      `${JSON.stringify(debuggerEvidence.stopPayload, null, 2)}\n`,
    );
    debuggerArtifacts.debuggerStopJson = debuggerStopJsonPath;
  }
  if (
    typeof debuggerEvidence?.reportMarkdown === 'string'
    && debuggerEvidence.reportMarkdown.trim()
  ) {
    const debuggerReportMarkdownPath = path.join(runDir, 'runtime-debugger-report.md');
    await fs.writeFile(debuggerReportMarkdownPath, debuggerEvidence.reportMarkdown);
    debuggerArtifacts.debuggerReportMarkdown = debuggerReportMarkdownPath;
  }
  if (
    typeof debuggerEvidence?.stopMarkdown === 'string'
    && debuggerEvidence.stopMarkdown.trim()
  ) {
    const debuggerStopMarkdownPath = path.join(runDir, 'runtime-debugger-stop.md');
    await fs.writeFile(debuggerStopMarkdownPath, debuggerEvidence.stopMarkdown);
    debuggerArtifacts.debuggerStopMarkdown = debuggerStopMarkdownPath;
  }
  if (debuggerEvidence) {
    debuggerEvidence = {
      ...debuggerEvidence,
      payload: undefined,
      reportPayload: undefined,
      stopPayload: undefined,
      markdown: undefined,
      reportMarkdown: undefined,
      stopMarkdown: undefined,
    };
  }
  const artifacts = {
    ...(run.artifacts || {}),
    ...debuggerArtifacts,
    json: jsonPath,
    markdown: markdownPath,
  };
  const persisted = {
    ...run,
    url: sanitizeSiteHarnessUrl(run.url),
    debugger: debuggerEvidence,
    artifacts,
  };
  await fs.writeFile(jsonPath, `${JSON.stringify(persisted, null, 2)}\n`);
  await fs.writeFile(markdownPath, buildSiteRunMarkdown(persisted));
  return { run: persisted, jsonPath, markdownPath };
}

async function writeSiteControlArtifacts(run, reportRoot) {
  const runDir = path.join(
    reportRoot,
    'controls',
    safeSegment(run.scenarioId),
    `repeat-${Math.max(1, Number(run.repeatIndex) || 1)}`,
  );
  await fs.mkdir(runDir, { recursive: true });
  const jsonPath = path.join(runDir, 'run.json');
  const markdownPath = path.join(runDir, 'summary.md');
  const persisted = {
    ...run,
    url: sanitizeSiteHarnessUrl(run.url),
    artifacts: {
      ...(run.artifacts || {}),
      json: jsonPath,
      markdown: markdownPath,
    },
  };
  await fs.writeFile(jsonPath, `${JSON.stringify(persisted, null, 2)}\n`);
  await fs.writeFile(markdownPath, buildSiteControlMarkdown(persisted));
  return { run: persisted, jsonPath, markdownPath };
}

export async function writeSiteSuiteReport(report, reportDir) {
  const stamp = report.generatedAt.replace(/[:.]/gu, '-');
  const reportRoot = path.resolve(reportDir, `${safeSegment(report.suite)}-${stamp}`);
  await fs.mkdir(reportRoot, { recursive: true });
  const persistedRuns = [];
  for (const run of report.runs) {
    const written = await writeSiteRunArtifacts(run, reportRoot);
    persistedRuns.push(written.run);
  }
  const persistedControls = [];
  for (const run of report.controls || []) {
    const written = await writeSiteControlArtifacts(run, reportRoot);
    persistedControls.push(written.run);
  }
  const persistedReport = {
    ...report,
    runs: persistedRuns,
    controls: persistedControls,
    scenarioComparisons: buildScenarioLaneComparisons(persistedRuns, persistedControls),
    reportRoot,
  };
  const jsonPath = path.join(reportRoot, 'report.json');
  const markdownPath = path.join(reportRoot, 'summary.md');
  await fs.writeFile(jsonPath, `${JSON.stringify(persistedReport, null, 2)}\n`);
  await fs.writeFile(markdownPath, buildAggregateMarkdown(persistedReport));
  return { report: persistedReport, reportRoot, jsonPath, markdownPath };
}
