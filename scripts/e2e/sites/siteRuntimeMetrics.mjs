import { createHash } from 'node:crypto';

const URL_PROTOCOL_ALLOWLIST = new Set(['http:', 'https:', 'chrome-extension:']);
const EXTERNAL_MEASUREMENT_STATES = new Set([
  'inactive',
  'unavailable',
  'armed_idle',
  'insufficient',
  'broken',
  'measured',
]);

export const SITE_PERFORMANCE_OPERATING_ENVELOPE_VERSION = 1;
export const SITE_PERFORMANCE_WORKLOAD_FINGERPRINT_VERSION = 1;
const EXTERNAL_NORMALIZED_PERFORMANCE_METRICS = new Set([
  'taskDurationMsPerObservedSecond',
  'scriptDurationMsPerObservedSecond',
  'layoutDurationMsPerObservedSecond',
  'longTaskCountPerObservedMinute',
  'longTaskTotalMsPerObservedSecond',
]);

function createPerformanceEligibilityScope(eligible, reasons = []) {
  return {
    state: eligible ? 'eligible' : 'ineligible',
    eligible,
    reasons: [...new Set(reasons)],
  };
}

function classifyPerformanceWarning(contract) {
  const id = typeof contract?.id === 'string' ? contract.id : 'unknown_contract';
  if (id === 'approved_performance_baseline') {
    return {
      externalEligible: true,
      internalEligible: true,
      reason: 'baseline_contract_evaluated_after_sample_eligibility',
    };
  }
  if (id === 'page_uncaught_errors_absent' || id === 'page_network_errors_absent') {
    return {
      externalEligible: true,
      internalEligible: true,
      reason: 'page_runtime_noise_retained_as_advisory',
    };
  }
  if (id === 'long_task_instrumentation_available') {
    return {
      externalEligible: true,
      internalEligible: true,
      reason: 'long_task_metrics_self_exclude_when_unavailable',
    };
  }
  if (/^debugger_lifecycle_segment_\d+:/u.test(id)) {
    const measurementState = contract?.evidence?.check?.measurementState;
    if (measurementState === 'armed_idle') {
      return {
        externalEligible: true,
        internalEligible: true,
        reason: 'settled_lifecycle_segment_observed_no_scanner_work',
      };
    }
    return {
      externalEligible: true,
      internalEligible: false,
      reason: `lifecycle_segment_internal_evidence_${measurementState || 'unavailable'}`,
    };
  }
  if (
    id.startsWith('debugger_')
    || id.startsWith('scanner_')
    || id.startsWith('owned_mutation_')
  ) {
    return {
      externalEligible: true,
      internalEligible: false,
      reason: 'diagnostic_internal_contract_not_passed',
    };
  }
  return {
    externalEligible: false,
    internalEligible: false,
    reason: 'unclassified_nonpass_contract',
  };
}

/**
 * Classifies a run before any operating-envelope comparison. This is a
 * code-owned decision: page noise and a settled armed-idle document segment
 * remain visible advisories, while unknown WARNs fail closed. Invalid
 * diagnostic evidence excludes internal/phase metrics without discarding
 * otherwise valid CDP measurements.
 */
export function evaluateSitePerformanceSampleEligibility(run = {}) {
  const externalReasons = [];
  const internalReasons = [];
  const advisoryContracts = [];
  const blockingContracts = [];
  const activationMeasured = (
    run?.activation?.state === 'measured'
    || (
      run?.lane === 'release'
      && run?.activation?.state === 'unavailable_effect_confirmed'
    )
  );
  if (!activationMeasured) {
    externalReasons.push(`activation_${run?.activation?.state || 'unavailable'}`);
    internalReasons.push(`activation_${run?.activation?.state || 'unavailable'}`);
  }
  if (run?.observableEffect?.status !== 'measured') {
    externalReasons.push(`observable_effect_${run?.observableEffect?.status || 'unavailable'}`);
    internalReasons.push(`observable_effect_${run?.observableEffect?.status || 'unavailable'}`);
  }

  for (const contract of Array.isArray(run?.contracts) ? run.contracts : []) {
    if (contract?.status === 'PASS') continue;
    const id = typeof contract?.id === 'string' ? contract.id : 'unknown_contract';
    if (contract?.status === 'FAIL') {
      const reason = `contract_fail:${id}`;
      externalReasons.push(reason);
      internalReasons.push(reason);
      blockingContracts.push({ id, status: contract.status, reason });
      continue;
    }
    if (contract?.status !== 'WARN') {
      const reason = `contract_status_invalid:${id}`;
      externalReasons.push(reason);
      internalReasons.push(reason);
      blockingContracts.push({ id, status: contract?.status || null, reason });
      continue;
    }
    const disposition = classifyPerformanceWarning(contract);
    if (!disposition.externalEligible) {
      externalReasons.push(`contract_warn:${id}:${disposition.reason}`);
    }
    if (!disposition.internalEligible) {
      internalReasons.push(`contract_warn:${id}:${disposition.reason}`);
    }
    const target = disposition.externalEligible && disposition.internalEligible
      ? advisoryContracts
      : blockingContracts;
    target.push({
      id,
      status: contract.status,
      reason: disposition.reason,
      externalEligible: disposition.externalEligible,
      internalEligible: disposition.internalEligible,
    });
  }

  const external = createPerformanceEligibilityScope(externalReasons.length === 0, externalReasons);
  const internal = run?.lane === 'diagnostic'
    ? createPerformanceEligibilityScope(internalReasons.length === 0, internalReasons)
    : {
      state: 'not_applicable',
      eligible: false,
      reasons: ['runtime_debugger_not_in_release'],
    };
  return {
    policy: 'contract_scoped_performance_sample_eligibility',
    external,
    internal,
    phase: run?.lane === 'diagnostic'
      ? { ...internal }
      : {
        state: 'not_applicable',
        eligible: false,
        reasons: ['runtime_debugger_not_in_release'],
      },
    advisoryContracts,
    blockingContracts,
  };
}

function finiteNumber(value) {
  if (
    value === null
    || value === undefined
    || typeof value === 'boolean'
    || (typeof value === 'string' && value.trim() === '')
  ) {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function sanitizeSiteHarnessUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const parsed = new URL(value);
    if (!URL_PROTOCOL_ALLOWLIST.has(parsed.protocol)) return null;
    parsed.username = '';
    parsed.password = '';
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  } catch (_error) {
    return null;
  }
}

export function median(values = []) {
  const finite = values
    .map((value) => finiteNumber(value))
    .filter((value) => value !== null)
    .sort((left, right) => left - right);
  if (finite.length === 0) return null;
  const middle = Math.floor(finite.length / 2);
  if (finite.length % 2 === 1) return finite[middle];
  return (finite[middle - 1] + finite[middle]) / 2;
}

function roundRatio(value) {
  const numeric = finiteNumber(value);
  return numeric === null ? null : Math.round(numeric * 10_000) / 10_000;
}

function stableJsonValue(value) {
  if (Array.isArray(value)) return value.map(stableJsonValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value)
    .filter((key) => value[key] !== undefined)
    .sort((left, right) => left.localeCompare(right))
    .map((key) => [key, stableJsonValue(value[key])]));
}

function parseBrowserCohort(browserProduct) {
  const value = typeof browserProduct === 'string' ? browserProduct.trim() : '';
  const match = value.match(/^([^/]+)\/(\d+)/u);
  return {
    family: match?.[1] || (value || null),
    major: match ? Number(match[2]) : null,
  };
}

function selectLaneConditions(conditions, lane) {
  return (Array.isArray(conditions) ? conditions : [])
    .filter((condition) => condition?.lane === 'both' || condition?.lane === lane)
    .map((condition) => stableJsonValue(condition));
}

export function createSitePerformanceWorkloadFingerprint({
  scenario,
  lane,
  browserProduct = null,
  headless = true,
} = {}) {
  if (!scenario?.id || !scenario?.siteId) {
    throw new Error('SITE_PERFORMANCE_WORKLOAD_FINGERPRINT_SCENARIO_INVALID');
  }
  if (!['diagnostic', 'release'].includes(lane)) {
    throw new Error(`SITE_PERFORMANCE_WORKLOAD_FINGERPRINT_LANE_INVALID:${lane}`);
  }
  const primaryUrl = sanitizeSiteHarnessUrl(scenario?.urls?.primary);
  if (!primaryUrl) {
    throw new Error('SITE_PERFORMANCE_WORKLOAD_FINGERPRINT_PRIMARY_URL_INVALID');
  }
  const browser = parseBrowserCohort(browserProduct);
  const actionContracts = (scenario.actions || [])
    .filter((action) => action?.lane === 'both' || action?.lane === lane)
    .map((action) => stableJsonValue(action));
  const readinessConditionContracts = selectLaneConditions(
    scenario.readiness?.conditions,
    lane,
  );
  const observableEffectConditionContracts = selectLaneConditions(
    scenario.observableEffects?.conditions,
    lane,
  );
  const settleConditionContracts = selectLaneConditions(
    scenario.settle?.conditions,
    lane,
  );
  const contract = stableJsonValue({
    schemaVersion: SITE_PERFORMANCE_WORKLOAD_FINGERPRINT_VERSION,
    scenarioId: scenario.id,
    siteId: scenario.siteId,
    featureGroup: scenario.featureGroup || null,
    lane,
    displayMode: headless ? 'headless' : 'headed',
    browser,
    urls: scenario.urls,
    settings: scenario.settings,
    expectedActivation: scenario.expectedActivation,
    feedConsumption: scenario.feedConsumption && typeof scenario.feedConsumption === 'object'
      ? scenario.feedConsumption
      : null,
    actionContracts,
    readinessConditionContracts,
    observableEffectConditionContracts,
    settleConditionContracts,
  });
  const digest = createHash('sha256')
    .update(JSON.stringify(contract))
    .digest('hex');
  return {
    schemaVersion: SITE_PERFORMANCE_WORKLOAD_FINGERPRINT_VERSION,
    id: `sha256:${digest}`,
    scenarioId: contract.scenarioId,
    siteId: contract.siteId,
    lane: contract.lane,
    displayMode: contract.displayMode,
    browser,
    primaryRoute: new URL(primaryUrl).pathname,
    activeFilterKeys: [...(scenario.expectedActivation?.activeFilterKeys || [])].sort(),
    actionKinds: actionContracts.map((action) => action.kind),
    readinessConditionIds: readinessConditionContracts.map((condition) => condition.id),
    observableEffectConditionIds: observableEffectConditionContracts
      .map((condition) => condition.id),
    settleConditionIds: settleConditionContracts.map((condition) => condition.id),
  };
}

function readRunMetric(run, path) {
  return path.reduce((value, key) => value?.[key], run);
}

function medianRunMetric(runs, path) {
  return median(runs.map((run) => readRunMetric(run, path)));
}

export function summarizeSitePerformanceWorkload(runs = []) {
  const measuredInternalRuns = runs.filter((run) => (
    run?.performanceEligibility?.internal?.eligible !== false
    &&
    run?.debugger?.availability === 'measured'
    && run?.debugger?.costEvidence?.measurementStates?.efficiency?.state === 'measured'
    && run?.debugger?.costEvidence?.measurementStates?.efficiency?.settled === true
    && run?.debugger?.costEvidence?.scannerStructuralAudit?.status === 'PASS'
    && run?.debugger?.costEvidence?.scannerConservationAudit?.status === 'PASS'
    && run?.debugger?.costEvidence?.workLedger?.state === 'measured'
  ));
  const measuredIdentityRuns = measuredInternalRuns.filter((run) => (
    run?.debugger?.costEvidence?.identityCardinality?.state === 'measured'
  ));
  return {
    sampleCount: runs.length,
    internalSampleCount: measuredInternalRuns.length,
    measurementWindowMs: medianRunMetric(runs, ['costs', 'measurementWindowMs']),
    observableCandidateCount: medianRunMetric(runs, ['observableEffect', 'candidateCount']),
    observableAppliedTargetCount: medianRunMetric(
      runs,
      ['observableEffect', 'appliedTargetCount'],
    ),
    shortFormOpportunityCount: medianRunMetric(
      runs,
      ['debugger', 'shortFormCompleteness', 'counts', 'opportunityCount'],
    ),
    shortFormObservedOpportunityCount: medianRunMetric(
      runs,
      ['debugger', 'shortFormCompleteness', 'counts', 'observedOpportunityCount'],
    ),
    shortFormRetiredOpportunityCount: medianRunMetric(
      runs,
      ['debugger', 'shortFormCompleteness', 'counts', 'retiredCount'],
    ),
    observerFlushes: medianRunMetric(
      measuredInternalRuns,
      ['debugger', 'costEvidence', 'observer', 'flushes'],
    ),
    observerMutations: medianRunMetric(
      measuredInternalRuns,
      ['debugger', 'costEvidence', 'observer', 'mutations'],
    ),
    scanAdmissions: medianRunMetric(
      measuredInternalRuns,
      ['debugger', 'costEvidence', 'scanRouting', 'admissions'],
    ),
    routedMutationGroups: medianRunMetric(
      measuredInternalRuns,
      ['debugger', 'costEvidence', 'scanRouting', 'routedMutationGroups'],
    ),
    dirtyRootBreadthTotal: medianRunMetric(
      measuredInternalRuns,
      ['debugger', 'costEvidence', 'dirtyRootBreadth', 'total'],
    ),
    selectorHits: medianRunMetric(
      measuredInternalRuns,
      ['debugger', 'costEvidence', 'ratios', 'selectorHits'],
    ),
    semanticCandidates: medianRunMetric(
      measuredInternalRuns,
      ['debugger', 'costEvidence', 'ratios', 'semanticCandidates'],
    ),
    candidateDecisions: medianRunMetric(
      measuredInternalRuns,
      ['debugger', 'costEvidence', 'ratios', 'candidateDecisions'],
    ),
    resolvedCandidates: medianRunMetric(
      measuredInternalRuns,
      ['debugger', 'costEvidence', 'ratios', 'resolvedCandidates'],
    ),
    uniqueAppliedTargets: medianRunMetric(
      measuredIdentityRuns,
      ['debugger', 'costEvidence', 'uniqueTargetTouches'],
    ),
    repeatedTargetTouches: medianRunMetric(
      measuredIdentityRuns,
      ['debugger', 'costEvidence', 'repeatedTargetTouches'],
    ),
    physicalWrites: medianRunMetric(
      measuredInternalRuns,
      ['debugger', 'costEvidence', 'writes', 'allPhysicalWritesIncludingCleanup'],
    ),
    observerQueueWaitMs: medianRunMetric(
      measuredInternalRuns,
      ['debugger', 'costEvidence', 'observer', 'queueWaitMs'],
    ),
    observerSubscriberCallbackMs: medianRunMetric(
      measuredInternalRuns,
      ['debugger', 'costEvidence', 'observer', 'subscriberCallbackMs'],
    ),
    observerStyleMutations: medianRunMetric(
      measuredInternalRuns,
      ['debugger', 'costEvidence', 'observer', 'attributeMutationCounts', 'style'],
    ),
    visualMediaOperations: medianRunMetric(
      measuredInternalRuns,
      ['debugger', 'costEvidence', 'visualMedia', 'operations'],
    ),
    visualMediaWrites: medianRunMetric(
      measuredInternalRuns,
      ['debugger', 'costEvidence', 'visualMedia', 'writes'],
    ),
    visualMediaManagedTargetStyleRootsSkipped: medianRunMetric(
      measuredInternalRuns,
      ['debugger', 'costEvidence', 'visualMedia', 'managedTargetStyleRootsSkipped'],
    ),
    visualMediaCompositeEffectCreates: medianRunMetric(
      measuredInternalRuns,
      ['debugger', 'costEvidence', 'visualMedia', 'compositeEffectCreates'],
    ),
    visualMediaCompositeEffectUpdates: medianRunMetric(
      measuredInternalRuns,
      ['debugger', 'costEvidence', 'visualMedia', 'compositeEffectUpdates'],
    ),
    visualMediaCompositeEffectRecreates: medianRunMetric(
      measuredInternalRuns,
      ['debugger', 'costEvidence', 'visualMedia', 'compositeEffectRecreates'],
    ),
    visualMediaCompositeEffectCancels: medianRunMetric(
      measuredInternalRuns,
      ['debugger', 'costEvidence', 'visualMedia', 'compositeEffectCancels'],
    ),
    visualMediaCompositeEffectCreateMs: medianRunMetric(
      measuredInternalRuns,
      ['debugger', 'costEvidence', 'visualMedia', 'compositeEffectCreateMs'],
    ),
    visualMediaCompositeEffectUpdateMs: medianRunMetric(
      measuredInternalRuns,
      ['debugger', 'costEvidence', 'visualMedia', 'compositeEffectUpdateMs'],
    ),
    visualMediaCompositeEffectCancelMs: medianRunMetric(
      measuredInternalRuns,
      ['debugger', 'costEvidence', 'visualMedia', 'compositeEffectCancelMs'],
    ),
    visualMediaElapsedMs: medianRunMetric(
      measuredInternalRuns,
      ['debugger', 'costEvidence', 'visualMedia', 'totalMs'],
    ),
    scanElapsedMs: medianRunMetric(
      measuredInternalRuns,
      ['debugger', 'costEvidence', 'timings', 'estimatedProductElapsedMs'],
    ),
  };
}

function normalizedRate(numerator, denominator, multiplier = 1) {
  const left = finiteNumber(numerator);
  const right = finiteNumber(denominator);
  if (left === null || right === null || right <= 0) return null;
  return roundRatio((left / right) * multiplier);
}

function normalizeSitePerformanceMetrics({
  metrics = {},
  workload = {},
} = {}) {
  const observedSeconds = finiteNumber(workload.measurementWindowMs) === null
    ? null
    : workload.measurementWindowMs / 1_000;
  return {
    taskDurationMsPerObservedSecond: normalizedRate(
      metrics.taskDurationMs,
      observedSeconds,
    ),
    scriptDurationMsPerObservedSecond: normalizedRate(
      metrics.scriptDurationMs,
      observedSeconds,
    ),
    layoutDurationMsPerObservedSecond: normalizedRate(
      metrics.layoutDurationMs,
      observedSeconds,
    ),
    longTaskCountPerObservedMinute: normalizedRate(
      metrics.longTaskCount,
      observedSeconds,
      60,
    ),
    longTaskTotalMsPerObservedSecond: normalizedRate(
      metrics.longTaskTotalMs,
      observedSeconds,
    ),
    observerQueueWaitMsPerFlush: normalizedRate(
      workload.observerQueueWaitMs,
      workload.observerFlushes,
    ),
    observerSubscriberCallbackMsPerThousandMutations: normalizedRate(
      workload.observerSubscriberCallbackMs,
      workload.observerMutations,
      1_000,
    ),
    dirtyRootsPerRoutedMutationGroup: normalizedRate(
      workload.dirtyRootBreadthTotal,
      workload.routedMutationGroups,
    ),
    selectorHitsPerResolvedCandidate: normalizedRate(
      workload.selectorHits,
      workload.resolvedCandidates,
    ),
    semanticCandidatesPerResolvedCandidate: normalizedRate(
      workload.semanticCandidates,
      workload.resolvedCandidates,
    ),
    candidateDecisionsPerUniqueAppliedTarget: normalizedRate(
      workload.candidateDecisions,
      workload.uniqueAppliedTargets,
    ),
    repeatedTargetTouchesPerUniqueAppliedTarget: normalizedRate(
      workload.repeatedTargetTouches,
      workload.uniqueAppliedTargets,
    ),
    physicalWritesPerUniqueAppliedTarget: normalizedRate(
      workload.physicalWrites,
      workload.uniqueAppliedTargets,
    ),
    scanElapsedMsPerResolvedCandidate: normalizedRate(
      workload.scanElapsedMs,
      workload.resolvedCandidates,
    ),
  };
}

function resolvePhaseMetricExclusionReason(evidence, measurement = null) {
  if (
    evidence?.boundary !== undefined
    && evidence.boundary !== null
    && evidence.boundary.state !== 'measured'
  ) {
    return `phase_boundary_${evidence?.boundary?.state || 'unavailable'}`;
  }
  const efficiency = evidence?.measurementStates?.efficiency;
  if (efficiency?.state !== 'measured') {
    return `phase_efficiency_${efficiency?.state || 'unavailable'}`;
  }
  if (efficiency.settled !== true) return 'phase_not_settled';
  if (evidence?.scannerStructuralAudit?.status !== 'PASS') {
    return `scanner_structural_audit_${String(
      evidence?.scannerStructuralAudit?.status || 'unavailable',
    ).toLowerCase()}`;
  }
  if (evidence?.scannerConservationAudit?.status !== 'PASS') {
    return `scanner_conservation_audit_${String(
      evidence?.scannerConservationAudit?.status || 'unavailable',
    ).toLowerCase()}`;
  }
  if (evidence?.workLedger?.state !== 'measured') {
    return `scanner_work_ledger_${evidence?.workLedger?.state || 'unavailable'}`;
  }
  if (
    measurement
    && (
      measurement.status !== 'measured'
      || finiteNumber(measurement.value) === null
    )
  ) {
    return `metric_${measurement.status || 'unavailable'}:${
      measurement.reason || 'value_unavailable'
    }`;
  }
  return null;
}

function readPhaseWorkLedgerMetricEntries(run) {
  const phaseEvidence = run?.debugger?.phaseCostEvidence;
  if (!phaseEvidence || typeof phaseEvidence !== 'object') return [];
  return Object.values(phaseEvidence).flatMap((evidence) => {
    const ledger = evidence?.workLedger;
    if (
      !ledger?.phase
      || !ledger.normalized
      || typeof ledger.normalized !== 'object'
    ) {
      return [];
    }
    return Object.entries(ledger.normalized).map(([metricName, measurement]) => {
      const key = `phase.${ledger.phase}.${metricName}`;
      const exclusionReason = run?.performanceEligibility?.phase?.eligible === false
        ? 'sample_phase_ineligible'
        : resolvePhaseMetricExclusionReason(evidence, measurement);
      return {
        key,
        value: exclusionReason === null ? finiteNumber(measurement.value) : null,
        exclusionReason,
      };
    });
  });
}

function normalizePhaseWorkLedgerMetrics(run) {
  return Object.fromEntries(readPhaseWorkLedgerMetricEntries(run).map((entry) => [
    entry.key,
    entry.value,
  ]));
}

export function summarizeNormalizedSitePerformanceMetrics({
  runs = null,
  metrics = {},
  workload = {},
} = {}) {
  if (!Array.isArray(runs) || runs.length === 0) {
    return normalizeSitePerformanceMetrics({ metrics, workload });
  }
  const perRun = runs.map((run) => ({
    ...normalizeSitePerformanceMetrics({
      metrics: summarizeMetricRepeats([run]),
      workload: summarizeSitePerformanceWorkload([run]),
    }),
    ...normalizePhaseWorkLedgerMetrics(run),
  }));
  const keys = Array.from(new Set(perRun.flatMap((entry) => Object.keys(entry))));
  return Object.fromEntries(keys.map((key) => [
    key,
    median(perRun.map((entry) => entry[key])),
  ]));
}

export function summarizeSitePerformanceMetricCoverage(runs = []) {
  const perRun = runs.map((run) => ({
    raw: summarizeMetricRepeats([run]),
    normalized: {
      ...normalizeSitePerformanceMetrics({
        metrics: summarizeMetricRepeats([run]),
        workload: summarizeSitePerformanceWorkload([run]),
      }),
      ...normalizePhaseWorkLedgerMetrics(run),
    },
    phaseMetricExclusions: Object.fromEntries(
      readPhaseWorkLedgerMetricEntries(run)
        .filter((entry) => entry.exclusionReason !== null)
        .map((entry) => [entry.key, entry.exclusionReason]),
    ),
  }));
  const summarizeCoverage = (scope) => {
    const keys = Array.from(new Set(perRun.flatMap((entry) => Object.keys(entry[scope]))));
    return Object.fromEntries(keys.map((key) => [
      key,
      perRun.reduce((count, entry) => (
        finiteNumber(entry[scope][key]) === null ? count : count + 1
      ), 0),
    ]));
  };
  return {
    sampleCount: runs.length,
    normalized: summarizeCoverage('normalized'),
    raw: summarizeCoverage('raw'),
    phaseMetricExclusions: Object.fromEntries(
      Array.from(new Set(perRun.flatMap((entry) => (
        Object.keys(entry.phaseMetricExclusions)
      )))).map((key) => {
        const reasons = perRun.map((entry) => entry.phaseMetricExclusions[key])
          .filter(Boolean);
        return [
          key,
          {
            excludedSampleCount: reasons.length,
            reasons: Object.fromEntries(Array.from(new Set(reasons)).map((reason) => [
              reason,
              reasons.filter((value) => value === reason).length,
            ])),
          },
        ];
      }),
    ),
  };
}

export function summarizeMetricRepeats(runs = []) {
  const longTaskMeasurementsComplete = runs.length > 0 && runs.every((run) => (
    ['armed_idle', 'measured'].includes(run?.costs?.after?.longTasks?.status)
  ));
  const metricPaths = Object.freeze({
    measurementWindowMs: (run) => run?.costs?.measurementWindowMs,
    heapGrowthBytes: (run) => run?.costs?.delta?.jsHeapUsedBytes,
    domNodeGrowth: (run) => run?.costs?.delta?.nodes,
    listenerGrowth: (run) => run?.costs?.delta?.jsEventListeners,
    mutationObserverGrowth: (run) => run?.costs?.delta?.objectCardinality?.mutationObservers,
    intersectionObserverGrowth: (run) => run?.costs?.delta?.objectCardinality?.intersectionObservers,
    resizeObserverGrowth: (run) => run?.costs?.delta?.objectCardinality?.resizeObservers,
    pageWorkerGrowth: (run) => run?.costs?.delta?.objectCardinality?.workers,
    taskDurationMs: (run) => run?.costs?.delta?.taskDurationMs,
    scriptDurationMs: (run) => run?.costs?.delta?.scriptDurationMs,
    layoutDurationMs: (run) => run?.costs?.delta?.layoutDurationMs,
    longTaskCount: (run) => longTaskMeasurementsComplete
      ? run?.costs?.after?.longTasks?.count
      : null,
    longTaskTotalMs: (run) => longTaskMeasurementsComplete
      ? run?.costs?.after?.longTasks?.totalMs
      : null,
    longTaskMaxMs: (run) => longTaskMeasurementsComplete
      ? run?.costs?.after?.longTasks?.maxMs
      : null,
    localStorageGrowthBytes: (run) => run?.costs?.storage?.localGrowthBytes,
    sessionStorageGrowthBytes: (run) => run?.costs?.storage?.sessionGrowthBytes,
    extensionDedicatedWorkersAfterClose: (run) => (
      Array.isArray(run?.costs?.targetsAfterClose?.extensionDedicatedWorkers)
        ? run.costs.targetsAfterClose.extensionDedicatedWorkers.length
        : null
    ),
    extensionServiceWorkersAfterClose: (run) => (
      Array.isArray(run?.costs?.targetsAfterClose?.extensionServiceWorkers)
        ? run.costs.targetsAfterClose.extensionServiceWorkers.length
        : null
    ),
    siteWorkersAfterClose: (run) => (
      Array.isArray(run?.costs?.targetsAfterClose?.siteWorkers)
        ? run.costs.targetsAfterClose.siteWorkers.length
        : null
    ),
  });
  return Object.fromEntries(Object.entries(metricPaths).map(([key, read]) => [
    key,
    median(runs.map(read)),
  ]));
}

export function metricsArrayToMap(metrics = []) {
  const result = Object.create(null);
  for (const metric of metrics) {
    if (typeof metric?.name !== 'string') continue;
    const value = finiteNumber(metric.value);
    if (value !== null) result[metric.name] = value;
  }
  return result;
}

function roundMetric(value) {
  const numeric = finiteNumber(value);
  return numeric === null ? null : Math.round(numeric * 100) / 100;
}

const ACTION_RENDERER_DURATION_METRICS = Object.freeze({
  taskDurationMs: 'TaskDuration',
  scriptDurationMs: 'ScriptDuration',
  layoutDurationMs: 'LayoutDuration',
  recalcStyleDurationMs: 'RecalcStyleDuration',
});

const ACTION_RENDERER_COUNT_METRICS = Object.freeze({
  layoutCount: 'LayoutCount',
  recalcStyleCount: 'RecalcStyleCount',
});

export function createActionRendererMetricSnapshot(performanceMetrics = []) {
  const performance = metricsArrayToMap(performanceMetrics);
  return {
    durations: Object.fromEntries(Object.entries(ACTION_RENDERER_DURATION_METRICS)
      .map(([outputKey, metricName]) => {
        const seconds = finiteNumber(performance[metricName]);
        return [outputKey, roundMetric(seconds === null ? null : seconds * 1000)];
      })),
    counts: Object.fromEntries(Object.entries(ACTION_RENDERER_COUNT_METRICS)
      .map(([outputKey, metricName]) => [outputKey, finiteNumber(performance[metricName])])),
  };
}

export function diffActionRendererMetricSnapshots(before = {}, after = {}) {
  const diff = (left, right) => {
    const beforeValue = finiteNumber(left);
    const afterValue = finiteNumber(right);
    if (beforeValue === null || afterValue === null || afterValue < beforeValue) return null;
    return roundMetric(afterValue - beforeValue);
  };
  const durations = Object.fromEntries(Object.keys(ACTION_RENDERER_DURATION_METRICS)
    .map((key) => [key, diff(before?.durations?.[key], after?.durations?.[key])]));
  const counts = Object.fromEntries(Object.keys(ACTION_RENDERER_COUNT_METRICS)
    .map((key) => [key, diff(before?.counts?.[key], after?.counts?.[key])]));
  const complete = [...Object.values(durations), ...Object.values(counts)]
    .every((value) => value !== null);
  return {
    state: complete ? 'measured' : 'unavailable',
    reason: complete
      ? 'cdp_action_renderer_counters_measured'
      : 'cdp_action_renderer_counter_missing_or_non_monotonic',
    durations,
    counts,
  };
}

export function createActionRuntimeAttribution({
  renderer = null,
  contentionWindow = null,
} = {}) {
  const taskDurationMs = finiteNumber(renderer?.durations?.taskDurationMs);
  const instrumentedEntropyMs = finiteNumber(contentionWindow?.entropy?.coveredMs);
  const complete = renderer?.state === 'measured'
    && contentionWindow?.state === 'measured'
    && taskDurationMs !== null
    && instrumentedEntropyMs !== null;
  if (!complete) {
    return {
      state: 'unavailable',
      reason: renderer?.state !== 'measured'
        ? 'renderer_action_window_unavailable'
        : 'runtime_contention_window_unavailable',
      instrumentedEntropyMs,
      rendererResidualMs: null,
      ownerCoverageExcessMs: null,
      residualSemantics: 'page_browser_and_uninstrumented_entropy_combined',
    };
  }
  return {
    state: 'measured',
    reason: 'renderer_task_duration_minus_instrumented_entropy_owner_union',
    instrumentedEntropyMs: roundMetric(instrumentedEntropyMs),
    rendererResidualMs: roundMetric(Math.max(0, taskDurationMs - instrumentedEntropyMs)),
    ownerCoverageExcessMs: roundMetric(Math.max(0, instrumentedEntropyMs - taskDurationMs)),
    residualSemantics: 'page_browser_and_uninstrumented_entropy_combined',
  };
}

function mergeTimelineIntervals(intervals = []) {
  const ordered = intervals
    .flatMap((entry) => {
      const startedAt = finiteNumber(entry?.startedAt);
      const endedAt = finiteNumber(entry?.endedAt);
      return startedAt !== null && endedAt !== null && endedAt > startedAt
        ? [{ startedAt, endedAt }]
        : [];
    })
    .sort((left, right) => left.startedAt - right.startedAt);
  const merged = [];
  ordered.forEach((interval) => {
    const current = merged.at(-1);
    if (!current || interval.startedAt > current.endedAt) {
      merged.push({ ...interval });
      return;
    }
    current.endedAt = Math.max(current.endedAt, interval.endedAt);
  });
  return merged;
}

function timelineIntersectionMs(leftIntervals = [], rightIntervals = []) {
  const left = mergeTimelineIntervals(leftIntervals);
  const right = mergeTimelineIntervals(rightIntervals);
  let leftIndex = 0;
  let rightIndex = 0;
  let totalMs = 0;
  while (leftIndex < left.length && rightIndex < right.length) {
    totalMs += Math.max(0, Math.min(
      left[leftIndex].endedAt,
      right[rightIndex].endedAt,
    ) - Math.max(
      left[leftIndex].startedAt,
      right[rightIndex].startedAt,
    ));
    if (left[leftIndex].endedAt <= right[rightIndex].endedAt) leftIndex += 1;
    else rightIndex += 1;
  }
  return totalMs;
}

function frameInterval(frame) {
  const startedAt = finiteNumber(frame?.startTime);
  const durationMs = finiteNumber(frame?.duration);
  return startedAt !== null && durationMs !== null && durationMs >= 0
    ? { startedAt, endedAt: startedAt + durationMs }
    : null;
}

function styleAndLayoutPhaseInterval(frame) {
  const interval = frameInterval(frame);
  const startedAt = finiteNumber(frame?.styleAndLayoutStart);
  if (
    !interval
    || startedAt === null
    || startedAt < interval.startedAt
    || startedAt > interval.endedAt
  ) return null;
  return { startedAt, endedAt: interval.endedAt };
}

function intervalsOverlap(left, right) {
  return Boolean(
    left
    && right
    && left.startedAt < right.endedAt
    && left.endedAt > right.startedAt
  );
}

function summarizeActionLongAnimationFrameContention(action, frames) {
  const timeline = action?.runtimeCost?.contentionWindow?.entropy?.timeline;
  if (!timeline) {
    return {
      state: 'not_requested',
      reason: 'runtime_contention_timeline_not_requested',
      semantics: 'same_frame_temporal_overlap_not_causal_proof',
    };
  }
  if (timeline.state !== 'measured' || !Array.isArray(timeline.entries)) {
    return {
      state: 'incomplete',
      reason: timeline.reason || 'runtime_contention_timeline_incomplete',
      semantics: 'same_frame_temporal_overlap_not_causal_proof',
    };
  }

  const ownerEntries = timeline.entries.flatMap((entry) => {
    const startedAt = finiteNumber(entry?.startedAt);
    const endedAt = finiteNumber(entry?.endedAt);
    if (
      typeof entry?.ownerId !== 'string'
      || startedAt === null
      || endedAt === null
      || endedAt <= startedAt
    ) return [];
    return [{
      ownerId: entry.ownerId,
      startedAt,
      endedAt,
    }];
  });
  const ownerIntervals = mergeTimelineIntervals(ownerEntries);
  const loafIntervals = frames.map(frameInterval).filter(Boolean);
  const styleAndLayoutIntervals = frames.map(styleAndLayoutPhaseInterval).filter(Boolean);
  const extensionScriptTimelineMeasured = frames.every((frame) => (
    frame?.scriptTimeline?.state === 'measured'
    && Array.isArray(frame.scriptTimeline.entries)
  ));
  const extensionScriptIntervals = extensionScriptTimelineMeasured
    ? frames.flatMap((frame) => frame.scriptTimeline.entries.flatMap((script) => (
      script?.source === 'entropy_extension'
        ? [{ startedAt: script.startedAt, endedAt: script.endedAt }]
        : []
    )))
    : [];

  const frameDetails = frames.map((frame) => {
    const interval = frameInterval(frame);
    const styleInterval = styleAndLayoutPhaseInterval(frame);
    const extensionIntervals = frame?.scriptTimeline?.state === 'measured'
      ? frame.scriptTimeline.entries.flatMap((script) => (
        script?.source === 'entropy_extension'
          ? [{ startedAt: script.startedAt, endedAt: script.endedAt }]
          : []
      ))
      : [];
    const owners = Array.from(new Set(ownerEntries.map((entry) => entry.ownerId)))
      .flatMap((ownerId) => {
        const intervals = ownerEntries.filter((entry) => entry.ownerId === ownerId);
        const frameOverlapMs = interval
          ? timelineIntersectionMs(intervals, [interval])
          : 0;
        const styleAndLayoutPhaseOverlapMs = styleInterval
          ? timelineIntersectionMs(intervals, [styleInterval])
          : 0;
        const extensionScriptOverlapMs = timelineIntersectionMs(intervals, extensionIntervals);
        return frameOverlapMs > 0 || styleAndLayoutPhaseOverlapMs > 0
          ? [{
            ownerId,
            frameOverlapMs: roundMetric(frameOverlapMs),
            styleAndLayoutPhaseOverlapMs: roundMetric(styleAndLayoutPhaseOverlapMs),
            extensionScriptOverlapMs: roundMetric(extensionScriptOverlapMs),
          }]
          : [];
      })
      .sort((left, right) => right.frameOverlapMs - left.frameOverlapMs)
      .slice(0, 8);
    return {
      startTime: finiteNumber(frame?.startTime),
      durationMs: finiteNumber(frame?.duration),
      blockingDurationMs: finiteNumber(frame?.blockingDuration),
      styleAndLayoutPhaseDurationMs: styleInterval
        ? roundMetric(styleInterval.endedAt - styleInterval.startedAt)
        : null,
      ownerOverlapMs: interval
        ? roundMetric(timelineIntersectionMs(ownerIntervals, [interval]))
        : 0,
      ownerStyleAndLayoutPhaseOverlapMs: styleInterval
        ? roundMetric(timelineIntersectionMs(ownerIntervals, [styleInterval]))
        : 0,
      ownerExtensionScriptOverlapMs: roundMetric(
        timelineIntersectionMs(ownerIntervals, extensionIntervals),
      ),
      entropyExtensionForcedStyleAndLayoutDurationMs: roundMetric(
        finiteNumber(
          frame?.scriptBuckets?.entropy_extension?.forcedStyleAndLayoutDurationMs,
        ) || 0,
      ),
      owners,
    };
  });
  const byOwner = Array.from(new Set(ownerEntries.map((entry) => entry.ownerId)))
    .map((ownerId) => {
      const intervals = ownerEntries.filter((entry) => entry.ownerId === ownerId);
      return {
        ownerId,
        overlappingFrameCount: frames.filter((frame) => (
          intervals.some((interval) => intervalsOverlap(interval, frameInterval(frame)))
        )).length,
        frameOverlapMs: roundMetric(timelineIntersectionMs(intervals, loafIntervals)),
        styleAndLayoutPhaseOverlapMs: roundMetric(
          timelineIntersectionMs(intervals, styleAndLayoutIntervals),
        ),
        extensionScriptOverlapMs: extensionScriptTimelineMeasured
          ? roundMetric(timelineIntersectionMs(intervals, extensionScriptIntervals))
          : null,
      };
    })
    .filter((entry) => entry.frameOverlapMs > 0)
    .sort((left, right) => right.frameOverlapMs - left.frameOverlapMs);

  return {
    state: 'measured',
    reason: 'loaf_frame_and_entropy_owner_timeline_correlated',
    semantics: 'same_frame_temporal_overlap_not_causal_proof',
    scriptTimingState: frames.length === 0 || extensionScriptTimelineMeasured
      ? 'measured'
      : 'incomplete',
    ownerOverlappingFrameCount: frameDetails.filter((frame) => frame.ownerOverlapMs > 0).length,
    ownerStyleAndLayoutPhaseOverlappingFrameCount: frameDetails.filter(
      (frame) => frame.ownerStyleAndLayoutPhaseOverlapMs > 0,
    ).length,
    ownerExtensionScriptOverlappingFrameCount: extensionScriptTimelineMeasured
      ? frameDetails.filter((frame) => frame.ownerExtensionScriptOverlapMs > 0).length
      : null,
    ownerOverlapMs: roundMetric(timelineIntersectionMs(ownerIntervals, loafIntervals)),
    ownerStyleAndLayoutPhaseOverlapMs: roundMetric(
      timelineIntersectionMs(ownerIntervals, styleAndLayoutIntervals),
    ),
    ownerExtensionScriptOverlapMs: extensionScriptTimelineMeasured
      ? roundMetric(timelineIntersectionMs(ownerIntervals, extensionScriptIntervals))
      : null,
    byOwner,
    worstFrames: [...frameDetails]
      .sort((left, right) => (
        (right.blockingDurationMs || 0) - (left.blockingDurationMs || 0)
        || (right.durationMs || 0) - (left.durationMs || 0)
      ))
      .slice(0, 8),
  };
}

function summarizeActionLongAnimationFrames(
  measuredActions,
  longAnimationFrames,
  measurement,
) {
  if (measurement?.state !== 'measured') {
    return {
      state: measurement?.state || 'unavailable',
      reason: measurement?.reason || 'long_animation_frame_measurement_unavailable',
      measuredActionCount: measuredActions.length,
      longAnimationFrameCount: null,
      totalDurationMs: null,
      totalBlockingDurationMs: null,
      maxDurationMs: null,
      byScriptSource: null,
      byAction: [],
    };
  }
  const frames = Array.isArray(longAnimationFrames) ? longAnimationFrames : [];
  const uniqueFrames = new Map();
  const byAction = measuredActions.map((action) => {
    const startedAt = finiteNumber(action?.runtimeCost?.window?.startedAt);
    const endedAt = finiteNumber(action?.runtimeCost?.window?.endedAt);
    const overlapping = startedAt === null || endedAt === null
      ? []
      : frames.filter((frame) => {
        const frameStart = finiteNumber(frame?.startTime);
        const frameDuration = finiteNumber(frame?.duration);
        if (frameStart === null || frameDuration === null) return false;
        return frameStart < endedAt && (frameStart + frameDuration) > startedAt;
      });
    overlapping.forEach((frame) => uniqueFrames.set(
      `${finiteNumber(frame?.startTime)}:${finiteNumber(frame?.duration)}`,
      frame,
    ));
    const contention = summarizeActionLongAnimationFrameContention(action, overlapping);
    return {
      kind: action.kind,
      stepId: action.stepId || action.probeId || null,
      longAnimationFrameCount: overlapping.length,
      totalDurationMs: roundMetric(overlapping.reduce(
        (total, frame) => total + (finiteNumber(frame?.duration) || 0),
        0,
      )),
      totalBlockingDurationMs: roundMetric(overlapping.reduce(
        (total, frame) => total + (finiteNumber(frame?.blockingDuration) || 0),
        0,
      )),
      maxDurationMs: roundMetric(Math.max(
        0,
        ...overlapping.map((frame) => finiteNumber(frame?.duration) || 0),
      )),
      contention,
    };
  });
  const retainedFrames = Array.from(uniqueFrames.values());
  const byScriptSource = new Map();
  retainedFrames.forEach((frame) => {
    Object.entries(frame?.scriptBuckets || {}).forEach(([source, counters]) => {
      const current = byScriptSource.get(source) || {
        source,
        scriptCount: 0,
        durationMs: 0,
        forcedStyleAndLayoutDurationMs: 0,
      };
      current.scriptCount += finiteNumber(counters?.scriptCount) || 0;
      current.durationMs += finiteNumber(counters?.durationMs) || 0;
      current.forcedStyleAndLayoutDurationMs += (
        finiteNumber(counters?.forcedStyleAndLayoutDurationMs) || 0
      );
      byScriptSource.set(source, current);
    });
  });
  const measuredContention = byAction.filter((entry) => entry.contention.state === 'measured');
  const contentionState = measuredContention.length === 0
    ? (byAction.some((entry) => entry.contention.state === 'incomplete')
      ? 'incomplete'
      : 'not_requested')
    : measuredContention.length === byAction.length
      ? 'measured'
      : 'partial';
  const sortedByImpact = [...byAction].sort((left, right) => (
    right.totalBlockingDurationMs - left.totalBlockingDurationMs
    || right.maxDurationMs - left.maxDurationMs
  ));
  return {
    state: 'measured',
    reason: 'long_animation_frames_overlapping_trusted_action_windows',
    thresholdMs: 50,
    measuredActionCount: measuredActions.length,
    longAnimationFrameCount: retainedFrames.length,
    totalDurationMs: roundMetric(retainedFrames.reduce(
      (total, frame) => total + (finiteNumber(frame?.duration) || 0), 0,
    )),
    totalBlockingDurationMs: roundMetric(retainedFrames.reduce(
      (total, frame) => total + (finiteNumber(frame?.blockingDuration) || 0), 0,
    )),
    maxDurationMs: roundMetric(Math.max(
      0,
      ...retainedFrames.map((frame) => finiteNumber(frame?.duration) || 0),
    )),
    byScriptSource: Array.from(byScriptSource.values())
      .map((entry) => ({
        ...entry,
        durationMs: roundMetric(entry.durationMs),
        forcedStyleAndLayoutDurationMs: roundMetric(
          entry.forcedStyleAndLayoutDurationMs,
        ),
      }))
      .sort((left, right) => right.durationMs - left.durationMs),
    contentionState,
    ownerOverlappingFrameCount: contentionState === 'measured'
      ? measuredContention.reduce(
        (total, entry) => total + entry.contention.ownerOverlappingFrameCount,
        0,
      )
      : null,
    ownerStyleAndLayoutPhaseOverlappingFrameCount: contentionState === 'measured'
      ? measuredContention.reduce(
        (total, entry) => (
          total + entry.contention.ownerStyleAndLayoutPhaseOverlappingFrameCount
        ),
        0,
      )
      : null,
    ownerOverlapMs: contentionState === 'measured'
      ? roundMetric(measuredContention.reduce(
        (total, entry) => total + entry.contention.ownerOverlapMs,
        0,
      ))
      : null,
    ownerStyleAndLayoutPhaseOverlapMs: contentionState === 'measured'
      ? roundMetric(measuredContention.reduce(
        (total, entry) => total + entry.contention.ownerStyleAndLayoutPhaseOverlapMs,
        0,
      ))
      : null,
    entropyExtensionForcedStyleAndLayoutDurationMs: roundMetric(
      byScriptSource.get('entropy_extension')?.forcedStyleAndLayoutDurationMs || 0,
    ),
    worstAction: sortedByImpact[0] || null,
    byAction,
  };
}

export function summarizeActionRuntimeAttribution(
  actionResults = [],
  {
    longAnimationFrames = [],
    longAnimationFrameMeasurement = null,
  } = {},
) {
  const supportedKinds = new Set([
    'trusted_scroll_probe',
    'trusted_content_load_probe',
    'trusted_wheel',
    'trusted_key_scroll',
    'trusted_touch_swipe',
  ]);
  const performed = (Array.isArray(actionResults) ? actionResults : []).filter((entry) => (
    supportedKinds.has(entry?.kind) && entry?.status === 'performed'
  ));
  const rendererMeasured = performed.filter((entry) => (
    entry?.runtimeCost?.renderer?.state === 'measured'
  ));
  const attributed = rendererMeasured.filter((entry) => (
    entry?.runtimeCost?.attribution?.state === 'measured'
  ));
  const contentionRequested = performed.filter((entry) => (
    entry?.runtimeCost?.contentionWindow
    && typeof entry.runtimeCost.contentionWindow === 'object'
  ));
  const sum = (entries, read, { empty = 0 } = {}) => {
    if (entries.length === 0) return empty;
    return roundMetric(entries.reduce((total, entry) => {
      const value = finiteNumber(read(entry));
      return total + (value === null ? 0 : value);
    }, 0));
  };
  const max = (entries, read, { empty = 0 } = {}) => {
    const values = entries.map(read).map(finiteNumber).filter((value) => value !== null);
    return roundMetric(values.length > 0 ? Math.max(...values) : empty);
  };
  const sumRenderer = (read) => sum(rendererMeasured, read);
  const sumAttributed = (read) => sum(attributed, read, { empty: null });
  const maxRenderer = (read) => max(rendererMeasured, read);
  const maxAttributed = (read) => max(attributed, read, { empty: null });
  const ownerTotals = new Map();
  attributed.forEach((entry) => {
    (entry.runtimeCost.contentionWindow?.entropy?.byOwner || []).forEach((owner) => {
      const coveredMs = finiteNumber(owner?.coveredMs);
      const operationCount = finiteNumber(owner?.operationCount);
      if (typeof owner?.ownerId !== 'string' || coveredMs === null) return;
      const current = ownerTotals.get(owner.ownerId) || {
        ownerId: owner.ownerId,
        coveredMs: 0,
        operationCount: 0,
      };
      current.coveredMs += coveredMs;
      current.operationCount += operationCount || 0;
      ownerTotals.set(owner.ownerId, current);
    });
  });
  const state = performed.length === 0
    ? 'unavailable'
    : rendererMeasured.length === performed.length
      ? 'measured'
      : 'partial';
  const contentionState = contentionRequested.length === 0
    ? 'not_requested'
    : attributed.length === performed.length
      ? 'measured'
      : 'partial';
  const worstByTask = [...rendererMeasured].sort((left, right) => (
    (finiteNumber(right.runtimeCost.renderer?.durations?.taskDurationMs) || 0)
    - (finiteNumber(left.runtimeCost.renderer?.durations?.taskDurationMs) || 0)
  ))[0] || null;
  return {
    schemaVersion: 1,
    state,
    reason: state === 'measured'
      ? 'all_performed_runtime_actions_renderer_measured'
      : state === 'partial'
        ? 'some_performed_runtime_actions_renderer_unmeasured'
        : 'no_performed_runtime_action_available',
    performedActionCount: performed.length,
    measuredActionCount: rendererMeasured.length,
    attributedActionCount: attributed.length,
    contentionState,
    semantics: {
      entropy: 'union_of_instrumented_entropy_owner_wall_time',
      rendererResidual: 'page_browser_and_uninstrumented_entropy_combined',
      additiveAcrossActions: true,
    },
    totals: {
      rendererTaskMs: sumRenderer((entry) => entry.runtimeCost.renderer?.durations?.taskDurationMs),
      rendererScriptMs: sumRenderer((entry) => entry.runtimeCost.renderer?.durations?.scriptDurationMs),
      rendererLayoutMs: sumRenderer((entry) => entry.runtimeCost.renderer?.durations?.layoutDurationMs),
      rendererRecalcStyleMs: sumRenderer(
        (entry) => entry.runtimeCost.renderer?.durations?.recalcStyleDurationMs,
      ),
      instrumentedEntropyMs: sumAttributed(
        (entry) => entry.runtimeCost.attribution?.instrumentedEntropyMs,
      ),
      rendererResidualMs: sumAttributed(
        (entry) => entry.runtimeCost.attribution?.rendererResidualMs,
      ),
      longTaskResidualMs: sumAttributed(
        (entry) => entry.runtimeCost.contentionWindow?.longTasks?.residualCoveredMs,
      ),
    },
    maxima: {
      rendererTaskMs: maxRenderer(
        (entry) => entry.runtimeCost.renderer?.durations?.taskDurationMs,
      ),
      rendererLayoutMs: maxRenderer(
        (entry) => entry.runtimeCost.renderer?.durations?.layoutDurationMs,
      ),
      instrumentedEntropyMs: maxAttributed(
        (entry) => entry.runtimeCost.attribution?.instrumentedEntropyMs,
      ),
      rendererResidualMs: maxAttributed(
        (entry) => entry.runtimeCost.attribution?.rendererResidualMs,
      ),
    },
    byOwner: Array.from(ownerTotals.values())
      .map((entry) => ({
        ...entry,
        coveredMs: roundMetric(entry.coveredMs),
      }))
      .sort((left, right) => right.coveredMs - left.coveredMs),
    responsiveness: summarizeActionLongAnimationFrames(
      rendererMeasured,
      longAnimationFrames,
      longAnimationFrameMeasurement,
    ),
    worstAction: worstByTask
      ? {
        kind: worstByTask.kind,
        stepId: worstByTask.stepId || worstByTask.probeId || null,
        rendererTaskMs: finiteNumber(
          worstByTask.runtimeCost.renderer?.durations?.taskDurationMs,
        ),
        rendererLayoutMs: finiteNumber(
          worstByTask.runtimeCost.renderer?.durations?.layoutDurationMs,
        ),
        instrumentedEntropyMs: finiteNumber(
          worstByTask.runtimeCost.attribution?.instrumentedEntropyMs,
        ),
        rendererResidualMs: finiteNumber(
          worstByTask.runtimeCost.attribution?.rendererResidualMs,
        ),
      }
      : null,
  };
}

export function createRuntimeActionAttributionContract(
  runtimeAttribution,
  { requireContention = false } = {},
) {
  const measured = runtimeAttribution.state === 'measured'
    && (!requireContention || runtimeAttribution.contentionState === 'measured');

  return {
    id: 'runtime_action_attribution_measured',
    status: measured
      ? 'PASS'
      : (
        runtimeAttribution.state === 'partial'
        || runtimeAttribution.contentionState === 'partial'
      ) ? 'FAIL' : 'WARN',
    evidence: runtimeAttribution,
  };
}

export function createCdpMetricSnapshot({
  label,
  performanceMetrics = [],
  domCounters = {},
  longTasks = [],
  longTaskMeasurement = null,
  targets = null,
  objectCardinality = null,
} = {}) {
  const performance = metricsArrayToMap(performanceMetrics);
  const durations = longTasks
    .map((entry) => finiteNumber(entry?.duration))
    .filter((value) => value !== null && value >= 0);
  const jsHeapUsedBytes = finiteNumber(performance.JSHeapUsedSize);
  const jsHeapTotalBytes = finiteNumber(performance.JSHeapTotalSize);
  const nodes = finiteNumber(domCounters?.nodes ?? performance.Nodes);
  const documents = finiteNumber(domCounters?.documents ?? performance.Documents);
  const jsEventListeners = finiteNumber(
    domCounters?.jsEventListeners ?? performance.JSEventListeners,
  );
  const requestedLongTaskState = typeof longTaskMeasurement?.state === 'string'
    ? longTaskMeasurement.state
    : 'measured';
  const longTaskState = EXTERNAL_MEASUREMENT_STATES.has(requestedLongTaskState)
    ? requestedLongTaskState
    : 'broken';
  const longTaskValuesAvailable = ['armed_idle', 'measured'].includes(longTaskState);
  const taskDuration = finiteNumber(performance.TaskDuration);
  const scriptDuration = finiteNumber(performance.ScriptDuration);
  const layoutDuration = finiteNumber(performance.LayoutDuration);
  const recalcStyleDuration = finiteNumber(performance.RecalcStyleDuration);
  return {
    label: typeof label === 'string' ? label : null,
    capturedAt: new Date().toISOString(),
    jsHeapUsedBytes: jsHeapUsedBytes === null ? null : Math.round(jsHeapUsedBytes),
    jsHeapTotalBytes: jsHeapTotalBytes === null ? null : Math.round(jsHeapTotalBytes),
    nodes: nodes === null ? null : Math.round(nodes),
    documents: documents === null ? null : Math.round(documents),
    jsEventListeners: jsEventListeners === null ? null : Math.round(jsEventListeners),
    taskDurationMs: roundMetric(taskDuration === null ? null : taskDuration * 1000),
    scriptDurationMs: roundMetric(scriptDuration === null ? null : scriptDuration * 1000),
    layoutDurationMs: roundMetric(layoutDuration === null ? null : layoutDuration * 1000),
    recalcStyleDurationMs: roundMetric(
      recalcStyleDuration === null ? null : recalcStyleDuration * 1000,
    ),
    longTasks: {
      status: longTaskState,
      reason: longTaskState === 'broken' && requestedLongTaskState !== 'broken'
        ? 'measurement_state_invalid'
        : typeof longTaskMeasurement?.reason === 'string'
        ? longTaskMeasurement.reason
        : null,
      count: longTaskValuesAvailable ? durations.length : null,
      totalMs: longTaskValuesAvailable
        ? roundMetric(durations.reduce((sum, value) => sum + value, 0))
        : null,
      maxMs: longTaskValuesAvailable
        ? roundMetric(durations.length > 0 ? Math.max(...durations) : 0)
        : null,
      observedEntryCount: durations.length,
      readyCount: finiteNumber(longTaskMeasurement?.readyCount),
      failureCount: finiteNumber(longTaskMeasurement?.failureCount),
    },
    targets,
    objectCardinality: objectCardinality && typeof objectCardinality === 'object'
      ? Object.fromEntries(Object.entries(objectCardinality).map(([key, value]) => [
        key,
        finiteNumber(value),
      ]))
      : null,
  };
}

export function diffCdpMetricSnapshots(before = {}, after = {}) {
  const diff = (key) => {
    const left = finiteNumber(before?.[key]);
    const right = finiteNumber(after?.[key]);
    return left === null || right === null ? null : Math.round((right - left) * 100) / 100;
  };
  const objectCardinalityKeys = Array.from(new Set([
    ...Object.keys(before?.objectCardinality || {}),
    ...Object.keys(after?.objectCardinality || {}),
  ])).sort((left, right) => left.localeCompare(right));
  const objectCardinality = Object.fromEntries(objectCardinalityKeys.map((key) => {
    const left = finiteNumber(before?.objectCardinality?.[key]);
    const right = finiteNumber(after?.objectCardinality?.[key]);
    return [key, left === null || right === null ? null : right - left];
  }));
  return {
    jsHeapUsedBytes: diff('jsHeapUsedBytes'),
    jsHeapTotalBytes: diff('jsHeapTotalBytes'),
    nodes: diff('nodes'),
    documents: diff('documents'),
    jsEventListeners: diff('jsEventListeners'),
    taskDurationMs: diff('taskDurationMs'),
    scriptDurationMs: diff('scriptDurationMs'),
    layoutDurationMs: diff('layoutDurationMs'),
    recalcStyleDurationMs: diff('recalcStyleDurationMs'),
    objectCardinality,
  };
}

export function summarizeStorageArea(values) {
  const source = values && typeof values === 'object' && !Array.isArray(values)
    ? values
    : {};
  const byteLength = (value) => Buffer.byteLength(JSON.stringify(value ?? null), 'utf8');
  return {
    bytes: byteLength(source),
    entries: Object.entries(source)
      .map(([key, value]) => ({ key, bytes: byteLength(value) }))
      .sort((left, right) => right.bytes - left.bytes),
  };
}

export function diffStorageSnapshots(before = {}, after = {}) {
  const growth = (areaName) => {
    const beforeBytes = finiteNumber(before?.[areaName]?.bytes);
    const afterBytes = finiteNumber(after?.[areaName]?.bytes);
    return beforeBytes === null || afterBytes === null
      ? null
      : Math.round(afterBytes - beforeBytes);
  };
  return {
    localGrowthBytes: growth('local'),
    sessionGrowthBytes: growth('session'),
  };
}

export const CONFIRMED_RUNTIME_BUDGETS = Object.freeze({
  maxLocalStorageGrowthBytes: 1024 * 1024,
  maxExtensionDedicatedWorkersAfterClose: 0,
  maxExtensionServiceWorkersAfterIdle: 1,
});

export function evaluateConfirmedRuntimeBudgets({
  storageGrowth = null,
  targetsAfterClose = null,
} = {}) {
  const checks = [];
  const add = (id, actual, limit, note) => {
    const numeric = finiteNumber(actual);
    checks.push({
      id,
      status: numeric === null ? 'WARN' : (numeric <= limit ? 'PASS' : 'FAIL'),
      actual: numeric,
      limit,
      note: numeric === null ? `${note}; metric unavailable` : note,
    });
  };
  add(
    'local_storage_growth',
    storageGrowth?.localGrowthBytes,
    CONFIRMED_RUNTIME_BUDGETS.maxLocalStorageGrowthBytes,
    'Existing CWS filter-runtime storage-growth budget',
  );
  add(
    'extension_dedicated_workers_after_close',
    targetsAfterClose?.extensionDedicatedWorkers?.length,
    CONFIRMED_RUNTIME_BUDGETS.maxExtensionDedicatedWorkersAfterClose,
    'Existing CWS extension dedicated/shared worker cleanup budget',
  );
  add(
    'extension_service_workers_after_idle',
    targetsAfterClose?.extensionServiceWorkers?.length,
    CONFIRMED_RUNTIME_BUDGETS.maxExtensionServiceWorkersAfterIdle,
    'Existing CWS extension service-worker idle cardinality budget',
  );
  return checks;
}

function compareMetricContracts(metrics, contracts, scope = 'legacy') {
  return Object.entries(contracts || {}).map(([key, contract]) => {
    const actual = finiteNumber(metrics?.[key]);
    const approved = finiteNumber(contract?.median);
    const maxRegressionPercent = finiteNumber(contract?.maxRegressionPercent);
    const maxRegressionAbsolute = finiteNumber(contract?.maxRegressionAbsolute);
    const relativeHeadroom = (
      approved === null || maxRegressionPercent === null
        ? null
        : Math.abs(approved) * (maxRegressionPercent / 100)
    );
    const invalidHeadroom = (
      (maxRegressionPercent !== null && maxRegressionPercent < 0)
      || (maxRegressionAbsolute !== null && maxRegressionAbsolute < 0)
      || (
        approved === 0
        && maxRegressionPercent !== null
        && maxRegressionAbsolute === null
      )
    );
    const headroom = Math.max(
      relativeHeadroom === null ? Number.NEGATIVE_INFINITY : relativeHeadroom,
      maxRegressionAbsolute === null ? Number.NEGATIVE_INFINITY : maxRegressionAbsolute,
    );
    if (
      actual === null
      || approved === null
      || invalidHeadroom
      || !Number.isFinite(headroom)
      || headroom < 0
    ) {
      return {
        key,
        scope,
        status: 'WARN',
        reason: 'baseline_contract_incomplete',
        actual,
        approved,
      };
    }
    const limit = approved + headroom;
    return {
      key,
      scope,
      status: actual <= limit ? 'PASS' : 'FAIL',
      actual,
      approved,
      limit,
      maxRegressionPercent,
      maxRegressionAbsolute,
    };
  });
}

function compareWorkloadDimensions(workload, dimensions) {
  return Object.entries(dimensions || {}).map(([key, contract]) => {
    const actual = finiteNumber(workload?.[key]);
    const minimum = finiteNumber(contract?.minimum);
    const maximum = finiteNumber(contract?.maximum);
    const approvedMedian = finiteNumber(contract?.median);
    const maxDeviationPercent = finiteNumber(contract?.maxDeviationPercent);
    const deviation = (
      approvedMedian === null || maxDeviationPercent === null
        ? null
        : Math.abs(approvedMedian) * (maxDeviationPercent / 100)
    );
    const lowerBound = minimum !== null
      ? minimum
      : deviation === null ? null : approvedMedian - deviation;
    const upperBound = maximum !== null
      ? maximum
      : deviation === null ? null : approvedMedian + deviation;
    if (actual === null) {
      return {
        key,
        status: 'WARN',
        reason: 'workload_dimension_unavailable',
        actual,
        lowerBound,
        upperBound,
      };
    }
    if (lowerBound === null && upperBound === null) {
      return {
        key,
        status: 'WARN',
        reason: 'workload_dimension_contract_incomplete',
        actual,
        lowerBound,
        upperBound,
      };
    }
    const withinLowerBound = lowerBound === null || actual >= lowerBound;
    const withinUpperBound = upperBound === null || actual <= upperBound;
    return {
      key,
      status: withinLowerBound && withinUpperBound ? 'PASS' : 'WARN',
      reason: withinLowerBound && withinUpperBound
        ? 'workload_within_approved_envelope'
        : 'workload_outside_approved_envelope',
      actual,
      lowerBound,
      upperBound,
    };
  });
}

export function compareMetricsWithApprovedBaseline({
  metrics,
  normalizedMetrics = {},
  workloadFingerprint = null,
  workload = {},
  metricSampleCounts = {},
  baseline = null,
} = {}) {
  if (!baseline || typeof baseline !== 'object') {
    return {
      status: 'WARN',
      reason: 'approved_baseline_missing',
      policy: 'read_only_approved_operating_envelope',
      checks: [],
      metrics,
      normalizedMetrics,
      workload,
      workloadFingerprint,
    };
  }

  if (baseline.operatingEnvelopeVersion === undefined) {
    return {
      status: 'WARN',
      reason: 'approved_operating_envelope_version_required',
      classification: 'contract_drift',
      policy: 'read_only_approved_operating_envelope',
      checks: [],
      metrics,
      normalizedMetrics,
      workload,
      workloadFingerprint,
    };
  }

  if (baseline.operatingEnvelopeVersion !== SITE_PERFORMANCE_OPERATING_ENVELOPE_VERSION) {
    return {
      status: 'WARN',
      reason: 'approved_operating_envelope_version_unsupported',
      policy: 'read_only_approved_operating_envelope',
      checks: [],
      metrics,
      normalizedMetrics,
      workload,
      workloadFingerprint,
    };
  }

  const approvalValid = baseline.approval?.state === 'approved'
    && typeof baseline.approval?.approvedAt === 'string'
    && baseline.approval.approvedAt.trim() !== ''
    && typeof baseline.approval?.owner === 'string'
    && baseline.approval.owner.trim() !== '';
  if (!approvalValid) {
    return {
      status: 'WARN',
      reason: 'approved_operating_envelope_approval_missing',
      policy: 'read_only_approved_operating_envelope',
      checks: [],
      metrics,
      normalizedMetrics,
      workload,
      workloadFingerprint,
    };
  }

  const approvedFingerprintId = baseline.workloadFingerprint?.id;
  const currentFingerprintId = workloadFingerprint?.id;
  if (
    typeof approvedFingerprintId !== 'string'
    || typeof currentFingerprintId !== 'string'
  ) {
    return {
      status: 'WARN',
      reason: 'workload_fingerprint_unavailable',
      classification: 'inconclusive',
      policy: 'read_only_approved_operating_envelope',
      checks: [],
      metrics,
      normalizedMetrics,
      workload,
      workloadFingerprint,
      approvedWorkloadFingerprint: baseline.workloadFingerprint || null,
    };
  }
  if (approvedFingerprintId !== currentFingerprintId) {
    return {
      status: 'WARN',
      reason: 'workload_fingerprint_mismatch',
      classification: 'contract_drift',
      policy: 'read_only_approved_operating_envelope',
      checks: [],
      metrics,
      normalizedMetrics,
      workload,
      workloadFingerprint,
      approvedWorkloadFingerprint: baseline.workloadFingerprint,
    };
  }

  const minimumSampleCount = finiteNumber(baseline.workload?.minimumSampleCount);
  if (minimumSampleCount === null || minimumSampleCount < 1) {
    return {
      status: 'WARN',
      reason: 'workload_sample_contract_incomplete',
      policy: 'read_only_approved_operating_envelope',
      checks: [],
      metrics,
      normalizedMetrics,
      workload,
      workloadFingerprint,
    };
  }
  const sampleCount = finiteNumber(workload?.sampleCount);
  if (sampleCount === null || sampleCount < minimumSampleCount) {
    return {
      status: 'WARN',
      reason: 'workload_sample_insufficient',
      classification: 'inconclusive',
      policy: 'read_only_approved_operating_envelope',
      checks: [],
      workloadChecks: [],
      minimumSampleCount,
      metrics,
      normalizedMetrics,
      workload,
      workloadFingerprint,
    };
  }

  const workloadChecks = compareWorkloadDimensions(
    workload,
    baseline.workload?.dimensions,
  );
  const workloadMismatch = workloadChecks.find((check) => check.status === 'WARN');
  if (workloadMismatch) {
    return {
      status: 'WARN',
      reason: workloadMismatch.reason,
      policy: 'read_only_approved_operating_envelope',
      checks: [],
      workloadChecks,
      minimumSampleCount,
      metrics,
      normalizedMetrics,
      workload,
      workloadFingerprint,
    };
  }

  const normalizedContracts = baseline.metrics?.normalized;
  if (
    !normalizedContracts
    || typeof normalizedContracts !== 'object'
    || Array.isArray(normalizedContracts)
    || Object.keys(normalizedContracts).length === 0
  ) {
    return {
      status: 'WARN',
      reason: 'normalized_metric_contract_missing',
      policy: 'read_only_approved_operating_envelope',
      checks: [],
      workloadChecks,
      minimumSampleCount,
      metrics,
      normalizedMetrics,
      workload,
      workloadFingerprint,
    };
  }
  const requiresInternalSamples = Object.keys(normalizedContracts).some(
    (key) => !EXTERNAL_NORMALIZED_PERFORMANCE_METRICS.has(key),
  );
  const internalSampleCount = finiteNumber(workload?.internalSampleCount);
  if (
    requiresInternalSamples
    && (internalSampleCount === null || internalSampleCount < minimumSampleCount)
  ) {
    return {
      status: 'WARN',
      reason: 'internal_workload_sample_insufficient',
      classification: 'inconclusive',
      policy: 'read_only_approved_operating_envelope',
      checks: [],
      workloadChecks,
      minimumSampleCount,
      metrics,
      normalizedMetrics,
      workload,
      workloadFingerprint,
    };
  }

  const insufficientMetricSamples = [
    ...Object.keys(normalizedContracts).map((key) => ({
      key,
      scope: 'normalized',
      validSampleCount: finiteNumber(metricSampleCounts?.normalized?.[key]),
    })),
    ...Object.keys(baseline.metrics?.raw || {}).map((key) => ({
      key,
      scope: 'raw',
      validSampleCount: finiteNumber(metricSampleCounts?.raw?.[key]),
    })),
  ].filter((entry) => (
    entry.validSampleCount === null || entry.validSampleCount < minimumSampleCount
  ));
  if (insufficientMetricSamples.length > 0) {
    return {
      status: 'WARN',
      reason: 'metric_sample_insufficient',
      classification: 'inconclusive',
      policy: 'read_only_approved_operating_envelope',
      checks: [],
      workloadChecks,
      minimumSampleCount,
      insufficientMetricSamples,
      metricSampleCounts,
      metrics,
      normalizedMetrics,
      workload,
      workloadFingerprint,
    };
  }

  const checks = [
    ...compareMetricContracts(
      normalizedMetrics,
      normalizedContracts,
      'normalized',
    ),
    ...compareMetricContracts(
      metrics,
      baseline.metrics?.raw,
      'raw',
    ),
  ];
  return {
    status: checks.some((check) => check.status === 'FAIL')
      ? 'FAIL'
      : checks.some((check) => check.status === 'WARN') ? 'WARN' : 'PASS',
    reason: 'approved_operating_envelope_compared',
    policy: 'read_only_approved_operating_envelope',
    checks,
    metrics,
    normalizedMetrics,
    workload,
    workloadChecks,
    minimumSampleCount,
    metricSampleCounts,
    workloadFingerprint,
    approvedWorkloadFingerprint: baseline.workloadFingerprint,
  };
}
