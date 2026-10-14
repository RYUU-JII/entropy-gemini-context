import { SITE_RUN_OUTCOMES, combineSiteRunOutcomes } from './siteRuntimeReport.mjs';
import {
  analyzeRuntimeDebuggerScannerConservation,
  analyzeRuntimeDebuggerScannerEfficiency,
  createRuntimeDebuggerScannerWorkLedger,
  RUNTIME_DEBUGGER_SCANNER_WORK_LEDGER_VERSION,
} from '../../../src/domains/nudge/runtime-debugger/core/runtimeDebuggerAnalysis.js';
import {
  RUNTIME_DEBUGGER_SESSION_VERSION,
  RUNTIME_DEBUGGER_TOOL_ID,
} from '../../../src/domains/nudge/runtime-debugger/core/runtimeDebuggerSession.js';
import {
  TARGETING_HEALTH_VALIDITY,
  validateTargetingHealthSnapshot,
} from '../../../src/domains/nudge/core/targetingHealthContract.js';
import {
  matchFeedConsumptionJourney,
} from './feedConsumptionValidation.mjs';
import {
  analyzeLayoutCycleOracle,
} from './layoutCycleAnalysis.mjs';
import {
  SITE_SCENARIO_FEED_OPPORTUNITY_GATED_CONDITION_KINDS,
} from './scenarioContracts.mjs';

const MEASUREMENT_STATES = new Set(Object.values(TARGETING_HEALTH_VALIDITY));
const PROBE_TARGETING_HEALTH_OWNERS = Object.freeze({
  socialMetrics: 'social_metrics',
  shortForm: 'short_form',
});
const TARGETING_HEALTH_REQUIRED_PROBE_STATES = new Set([
  TARGETING_HEALTH_VALIDITY.ARMED_IDLE,
  TARGETING_HEALTH_VALIDITY.INSUFFICIENT,
  TARGETING_HEALTH_VALIDITY.MEASURED,
]);
const LAZY_SOCIAL_BASELINE_PROBE_ID = 'socialMetrics';
const LAZY_SOCIAL_BASELINE_PROBE_REASON = 'targeting_health_probe_contract_invalid';
const LAZY_SOCIAL_BASELINE_OPERATION_ERROR =
  'TARGETING_HEALTH_OPERATION_COUNT_INVALID:socialMetrics';

export const SITE_E2E_TARGETING_HEALTH_ACCEPTANCE_MODES = Object.freeze({
  ACTIVE: 'active',
  DISABLED: 'disabled',
});

const SITE_E2E_TARGETING_HEALTH_ACCEPTANCE_MODE_VALUES = new Set(
  Object.values(SITE_E2E_TARGETING_HEALTH_ACCEPTANCE_MODES),
);
const SITE_E2E_TARGETING_HEALTH_SCOPE_ID_PATTERN = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/u;

const OBSERVER_HUB_EFFICIENCY_SETTLE_FIELDS = Object.freeze([
  Object.freeze({ key: 'observerMutations', settledValue: 0 }),
]);

const SOCIAL_METRICS_EFFICIENCY_SETTLE_FIELDS = Object.freeze([
  Object.freeze({ key: 'socialQueue', settledValue: 0 }),
  Object.freeze({ key: 'socialDirtyRoots', settledValue: 0 }),
  Object.freeze({ key: 'socialOwnedMutations', settledValue: 0 }),
  Object.freeze({ key: 'socialTimer', settledValue: false }),
  Object.freeze({ key: 'socialIdle', settledValue: false }),
  Object.freeze({ key: 'socialCurrentScan', settledValue: false }),
  Object.freeze({ key: 'socialForceFullScan', settledValue: false }),
]);

const TEXT_SHUFFLE_EFFICIENCY_SETTLE_FIELDS = Object.freeze([
  Object.freeze({ key: 'textPendingNodes', settledValue: 0 }),
  Object.freeze({ key: 'textPendingSubtrees', settledValue: 0 }),
  Object.freeze({ key: 'textPendingSubtreeTasks', settledValue: 0 }),
  Object.freeze({ key: 'textFlushScheduled', settledValue: false }),
  Object.freeze({ key: 'textIdleChunkScheduled', settledValue: false }),
]);

const VISUAL_MEDIA_COST_COUNTER_KEYS = Object.freeze([
  'operations',
  'fullScans',
  'mutationScans',
  'recheckScans',
  'incomingRoots',
  'relevantRoots',
  'discoveredTargets',
  'uniqueTargets',
  'writes',
  'noops',
  'restores',
  'alreadyAppliedNoops',
  'compositeEffectCreates',
  'compositeEffectUpdates',
  'compositeEffectRecreates',
  'compositeEffectCancels',
  'compositeEffectCreateMs',
  'compositeEffectUpdateMs',
  'compositeEffectCancelMs',
  'zeroWorkMutationScans',
  'attributeRootsSkipped',
  'managedTargetStyleRootsSkipped',
  'candidateEvaluations',
  'acceptedEvaluations',
  'rechecksQueued',
  'rechecksRun',
]);

export const SITE_E2E_DEBUGGER_COST_PHASES = Object.freeze({
  ACTIVE_STIMULUS: 'active_stimulus',
  DISABLE_CLEANUP: 'disable_cleanup',
  REENABLE_STIMULUS: 'reenable_stimulus',
});

const SITE_E2E_DEBUGGER_COST_PHASE_VALUES = new Set(
  Object.values(SITE_E2E_DEBUGGER_COST_PHASES),
);

function sortedUnique(values = []) {
  return Array.from(new Set(Array.isArray(values) ? values : []), String)
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
}

function sameStringSet(left = [], right = []) {
  const normalizedLeft = sortedUnique(left);
  const normalizedRight = sortedUnique(right);
  return normalizedLeft.length === normalizedRight.length
    && normalizedLeft.every((value, index) => value === normalizedRight[index]);
}

function createContract(id, status, evidence = null, note = null) {
  return { id, status, evidence, note };
}

export function applyFeedOpportunityWorkloadGate({
  condition,
  status,
  evidence,
  feedJourney,
} = {}) {
  if (
    status !== 'FAIL'
    || !SITE_SCENARIO_FEED_OPPORTUNITY_GATED_CONDITION_KINDS.includes(condition?.kind)
  ) {
    return { status, evidence };
  }
  const expectedOpportunityCount = condition.minimumFeedOpportunityCount;
  if (!Number.isSafeInteger(expectedOpportunityCount) || expectedOpportunityCount < 1) {
    return { status, evidence };
  }
  const actualOpportunityCount = feedJourney?.counts?.opportunityCount;
  if (
    !Number.isSafeInteger(actualOpportunityCount)
    || actualOpportunityCount < 0
    || actualOpportunityCount >= expectedOpportunityCount
  ) {
    return { status, evidence };
  }
  return {
    status: 'WARN',
    evidence: {
      ...(evidence || {}),
      measurementState: 'workload_insufficient',
      workload: {
        expectedOpportunityCount,
        actualOpportunityCount,
        journeyState: feedJourney.state,
        journeyReason: feedJourney.reason,
      },
    },
  };
}

function readObjectPath(source, path) {
  return String(path || '').split('.').filter(Boolean).reduce((value, key) => (
    value && typeof value === 'object' ? value[key] : undefined
  ), source);
}

function readDebuggerSnapshotPath(payload, path, area = 'latest') {
  const normalizedPath = String(path || '').startsWith('effects.')
    ? String(path).slice('effects.'.length)
    : String(path || '');
  return readObjectPath(payload?.[area], normalizedPath);
}

function debuggerEventSeen(payload, condition) {
  const feature = condition?.feature || null;
  const expectedEvent = condition?.event || null;
  const featureAliases = new Set([
    feature,
    feature === 'videoSkipGuard' ? 'videoSkip' : null,
  ].filter(Boolean));
  const featureSnapshot = payload?.latest?.protection?.features?.[feature] || {};
  const probeSnapshot = Array.from(featureAliases)
    .map((key) => payload?.latest?.[key])
    .find((value) => value && typeof value === 'object') || {};
  const candidates = [
    ...(Array.isArray(payload?.events) ? payload.events : []),
    ...(Array.isArray(featureSnapshot.history) ? featureSnapshot.history : []),
    ...(Array.isArray(probeSnapshot.history) ? probeSnapshot.history : []),
    ...(Array.isArray(probeSnapshot.recentEvents) ? probeSnapshot.recentEvents : []),
  ];
  if (Number(featureSnapshot.eventCounts?.[expectedEvent]) > 0) return true;
  if (Number(probeSnapshot.eventCounts?.[expectedEvent]) > 0) return true;
  return candidates.some((entry) => {
    const eventName = entry?.event || entry?.eventName || entry?.name || entry?.type;
    const eventFeature = entry?.feature || entry?.featureKey || entry?.probeId || null;
    return eventName === expectedEvent
      && (!eventFeature || featureAliases.has(eventFeature));
  });
}

export function createDiagnosticConditionContracts(
  scenario,
  payload,
  {
    activePayload = payload,
    settlePayload = payload,
    shortFormCompleteness = null,
    eventPayloads = [payload],
    feedJourneyPayload = payload,
    actionResults = [],
  } = {},
) {
  const normalizedEventPayloads = (Array.isArray(eventPayloads) ? eventPayloads : [payload])
    .filter((entry) => entry && typeof entry === 'object');
  const conditions = [
    ...(scenario?.readiness?.conditions || []).map((condition) => ({
      condition,
      source: activePayload,
    })),
    ...(scenario?.observableEffects?.conditions || []).map((condition) => ({
      condition,
      source: activePayload,
    })),
    ...(scenario?.settle?.conditions || []).map((condition) => ({
      condition,
      source: settlePayload,
    })),
  ].filter(({ condition }) => condition?.lane === 'diagnostic');
  let feedJourney = null;
  const readFeedJourney = () => {
    if (feedJourney) return feedJourney;
    const ledger = readDebuggerSnapshotPath(feedJourneyPayload, 'feedFlow.ledger');
    feedJourney = matchFeedConsumptionJourney({
      actionResults,
      ledger,
    });
    return feedJourney;
  };
  return conditions.flatMap(({ condition, source }) => {
    let status = null;
    let evidence = null;
    if (condition.kind === 'debug_path_equals') {
      const actual = readDebuggerSnapshotPath(source, condition.path);
      status = Object.is(actual, condition.expected) ? 'PASS' : 'FAIL';
      evidence = { path: condition.path, expected: condition.expected, actual };
      if (condition.evidencePath) {
        evidence.context = readDebuggerSnapshotPath(source, condition.evidencePath);
      }
    } else if (condition.kind === 'debug_path_in') {
      const actual = readDebuggerSnapshotPath(source, condition.path);
      const expected = Array.isArray(condition.expected) ? condition.expected : [];
      status = expected.includes(actual)
        ? 'PASS'
        : condition.unmetState ? 'WARN' : 'FAIL';
      evidence = {
        path: condition.path,
        expected,
        actual,
        measurementState: expected.includes(actual) ? 'measured' : (condition.unmetState || 'broken'),
      };
      if (condition.evidencePath) {
        evidence.context = readDebuggerSnapshotPath(source, condition.evidencePath);
      }
    } else if (condition.kind === 'debug_paths_match') {
      const actual = Object.fromEntries(Object.keys(condition.expected || {}).map((path) => [
        path,
        readDebuggerSnapshotPath(source, path),
      ]));
      status = Object.entries(condition.expected || {}).every(([path, expected]) => (
        Object.is(actual[path], expected)
      )) ? 'PASS' : 'FAIL';
      evidence = { expected: condition.expected || {}, actual };
    } else if (condition.kind === 'debug_counter_increased') {
      const actual = Object.fromEntries((condition.paths || []).map((path) => {
        const rawValue = readDebuggerSnapshotPath(source, path, 'delta');
        const numericValue = finiteMetric(rawValue);
        return [path, numericValue];
      }));
      const unavailablePaths = Object.entries(actual)
        .filter(([, value]) => value === null)
        .map(([path]) => path);
      const measured = Object.values(actual).some((value) => (
        value !== null && value >= Number(condition.minimum || 1)
      ));
      status = measured ? 'PASS' : 'WARN';
      evidence = {
        minimum: Number(condition.minimum || 1),
        actual,
        measurementState: measured
          ? 'measured'
          : unavailablePaths.length > 0 ? 'unavailable' : 'armed_idle',
        reason: measured
          ? null
          : unavailablePaths.length > 0
            ? 'debug_counter_path_unavailable'
            : 'debug_counter_not_increased',
        unavailablePaths,
      };
    } else if (condition.kind === 'debug_number_at_least') {
      const actual = finiteMetric(
        readDebuggerSnapshotPath(source, condition.path),
      );
      const minimum = Number(condition.minimum);
      const measured = (
        actual !== null
        && Number.isFinite(minimum)
        && actual >= minimum
      );
      status = measured ? 'PASS' : 'FAIL';
      evidence = {
        path: condition.path,
        minimum,
        actual,
        measurementState: actual === null ? 'unavailable' : 'measured',
      };
    } else if (condition.kind === 'debug_event_seen') {
      const matchingPayloadIndexes = normalizedEventPayloads.flatMap((eventPayload, index) => (
        debuggerEventSeen(eventPayload, condition) ? [index] : []
      ));
      const seen = matchingPayloadIndexes.length > 0;
      status = seen ? 'PASS' : 'FAIL';
      evidence = {
        feature: condition.feature,
        event: condition.event,
        seen,
        payloadsExamined: normalizedEventPayloads.length,
        matchingPayloadIndexes,
      };
    } else if (condition.kind === 'debug_shortform_completeness') {
      const snapshot = shortFormCompleteness
        || readDebuggerSnapshotPath(source, condition.path);
      const state = MEASUREMENT_STATES.has(snapshot?.state)
        ? snapshot.state
        : 'unavailable';
      const opportunityCount = finiteMetric(snapshot?.counts?.opportunityCount);
      const terminalCount = finiteMetric(snapshot?.counts?.terminalCount);
      const causallyProvenTerminalCount = finiteMetric(
        snapshot?.counts?.causallyProvenTerminalCount,
      );
      const pendingCount = finiteMetric(snapshot?.counts?.pendingCount);
      const evidenceGapCount = finiteMetric(
        snapshot?.ledger?.evidenceGapCount ?? snapshot?.evidenceGapCount,
      );
      const measuredContractComplete = state === 'measured'
        && snapshot?.countConsistent === true
        && snapshot?.oracleAttached === true
        && snapshot?.ownerObserverAttached === true
        && snapshot?.observerSettled === true
        && opportunityCount !== null
        && opportunityCount > 0
        && terminalCount === opportunityCount
        && causallyProvenTerminalCount === terminalCount
        && pendingCount === 0
        && evidenceGapCount === 0;
      status = measuredContractComplete
        ? 'PASS'
        : state === 'measured'
          ? 'FAIL'
        : state === 'broken'
          ? 'FAIL'
          : state === 'armed_idle'
            ? (condition.noOpportunityStatus || 'WARN')
            : 'WARN';
      evidence = snapshot && typeof snapshot === 'object'
        ? snapshot
        : {
          state: 'unavailable',
          reason: 'short_form_completeness_snapshot_unavailable',
          agentInterpretationRequired: false,
        };
    } else if (condition.kind === 'debug_feed_consumption_journey') {
      const journey = condition.path && condition.path !== 'feedFlow.ledger'
        ? matchFeedConsumptionJourney({
          actionResults,
          ledger: readDebuggerSnapshotPath(feedJourneyPayload, condition.path),
        })
        : readFeedJourney();
      status = journey.state === 'measured'
        ? 'PASS'
        : journey.state === 'broken' ? 'FAIL' : 'WARN';
      evidence = journey;
    } else if (condition.kind === 'debug_baseline_covered') {
      const baselineLoaded = source?.baseline?.[condition.probeId]?.loaded === true;
      const probe = (source?.probes || []).find((entry) => entry?.probeId === condition.probeId);
      const probeCovered = probe?.details?.baselineCovered === true;
      const covered = baselineLoaded || probeCovered;
      status = covered ? 'PASS' : 'FAIL';
      evidence = {
        probeId: condition.probeId,
        covered,
        reason: covered ? null : 'baseline_coverage_missing',
      };
    }
    if (status === 'FAIL' && Object.hasOwn(condition, 'minimumFeedOpportunityCount')) {
      ({ status, evidence } = applyFeedOpportunityWorkloadGate({
        condition,
        status,
        evidence,
        feedJourney: readFeedJourney(),
      }));
    }
    return status === null ? [] : [createContract(condition.id, status, evidence)];
  });
}

export function extractShortFormCompletenessEvidence(payload = null) {
  const snapshot = payload?.latest?.shortForm?.completeness;
  if (snapshot && typeof snapshot === 'object') return snapshot;
  return {
    state: 'unavailable',
    reason: 'short_form_completeness_snapshot_unavailable',
    agentInterpretationRequired: false,
  };
}

const SHORT_FORM_COMPLETENESS_COUNT_KEYS = Object.freeze([
  'observedOpportunityCount',
  'opportunityCount',
  'retiredCount',
  'terminalCount',
  'hiddenCount',
  'removedCount',
  'pendingCount',
  'attributedTerminalCount',
  'unattributedTerminalCount',
  'causallyProvenTerminalCount',
  'unprovenTerminalCount',
]);

const SHORT_FORM_COMPLETENESS_LEDGER_COUNT_KEYS = Object.freeze([
  'mutationBatches',
  'observedRoots',
  'opportunityObservations',
  'duplicateOpportunityObservations',
  'queryFailureCount',
  'targetOutcomeReadFailureCount',
  'targetOutcomeMismatchCount',
  'productOperationContractFailureCount',
  'droppedOpportunityCount',
  'droppedOpportunityObservationCount',
  'droppedOpportunityOverflowCount',
  'evidenceGapCount',
]);

const SHORT_FORM_COMPLETENESS_OVERHEAD_SUM_KEYS = Object.freeze([
  'probeMs',
  'probeCount',
  'snapshotReadMs',
  'snapshotReadCount',
]);

const SHORT_FORM_COMPLETENESS_SITE_ID_OPTIONAL_STATES = new Set([
  TARGETING_HEALTH_VALIDITY.INACTIVE,
  TARGETING_HEALTH_VALIDITY.UNAVAILABLE,
]);

function isNonNegativeIntegerMetric(value) {
  const numeric = finiteMetric(value);
  return numeric !== null && Number.isSafeInteger(numeric) && numeric >= 0;
}

function isNonNegativeFiniteMetric(value) {
  const numeric = finiteMetric(value);
  return numeric !== null && numeric >= 0;
}

function sumFiniteSnapshotValues(snapshots, readValue) {
  const values = snapshots.map((snapshot) => finiteMetric(readValue(snapshot)));
  if (values.some((value) => value === null || value < 0)) return null;
  return values.reduce((total, value) => total + value, 0);
}

function maxFiniteSnapshotValues(snapshots, readValue) {
  const values = snapshots.map((snapshot) => finiteMetric(readValue(snapshot)));
  if (values.some((value) => value === null || value < 0)) return null;
  return Math.max(...values);
}

function validateShortFormCompletenessSegment(snapshot, segmentIndex) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return [{
      segmentIndex,
      path: '',
      reason: 'segment_snapshot_invalid',
    }];
  }
  if (!MEASUREMENT_STATES.has(snapshot.state)) {
    return [{
      segmentIndex,
      path: 'state',
      reason: 'segment_state_invalid',
      actual: snapshot.state ?? null,
    }];
  }
  if (snapshot.state === 'unavailable') return [];

  const errors = [];
  if (
    !SHORT_FORM_COMPLETENESS_SITE_ID_OPTIONAL_STATES.has(snapshot.state)
    && (typeof snapshot.siteId !== 'string' || snapshot.siteId.trim() === '')
  ) {
    errors.push({
      segmentIndex,
      path: 'siteId',
      reason: 'site_id_required',
      actual: snapshot.siteId ?? null,
    });
  }
  const requireBooleanField = (path, value) => {
    if (typeof value !== 'boolean') {
      errors.push({ segmentIndex, path, reason: 'boolean_required', actual: value ?? null });
    }
  };
  requireBooleanField('oracleAttached', snapshot.oracleAttached);
  requireBooleanField('ownerObserverAttached', snapshot.ownerObserverAttached);
  requireBooleanField('observerSettled', snapshot.observerSettled);
  requireBooleanField('countConsistent', snapshot.countConsistent);
  SHORT_FORM_COMPLETENESS_COUNT_KEYS.forEach((key) => {
    const value = snapshot.counts?.[key];
    if (!isNonNegativeIntegerMetric(value)) {
      errors.push({
        segmentIndex,
        path: `counts.${key}`,
        reason: 'non_negative_integer_required',
        actual: value ?? null,
      });
    }
  });
  SHORT_FORM_COMPLETENESS_LEDGER_COUNT_KEYS.forEach((key) => {
    const value = snapshot.ledger?.[key];
    if (!isNonNegativeIntegerMetric(value)) {
      errors.push({
        segmentIndex,
        path: `ledger.${key}`,
        reason: 'non_negative_integer_required',
        actual: value ?? null,
      });
    }
  });
  SHORT_FORM_COMPLETENESS_OVERHEAD_SUM_KEYS.forEach((key) => {
    const value = snapshot.overhead?.[key];
    if (!isNonNegativeFiniteMetric(value)) {
      errors.push({
        segmentIndex,
        path: `overhead.${key}`,
        reason: 'non_negative_number_required',
        actual: value ?? null,
      });
    }
  });
  [
    ['timing.totalEffectLatencyMs', snapshot.timing?.totalEffectLatencyMs],
    ['timing.maxEffectLatencyMs', snapshot.timing?.maxEffectLatencyMs],
    ['overhead.probeMaxMs', snapshot.overhead?.probeMaxMs],
    ['overhead.snapshotReadMaxMs', snapshot.overhead?.snapshotReadMaxMs],
  ].forEach(([path, value]) => {
    if (!isNonNegativeFiniteMetric(value)) {
      errors.push({
        segmentIndex,
        path,
        reason: 'non_negative_number_required',
        actual: value ?? null,
      });
    }
  });
  if (!Array.isArray(snapshot.ledger?.recentOpportunities)) {
    errors.push({
      segmentIndex,
      path: 'ledger.recentOpportunities',
      reason: 'array_required',
      actual: null,
    });
  }
  const counts = snapshot.counts || {};
  const countEquationsHold = snapshot.countConsistent === true
    && counts.observedOpportunityCount === counts.opportunityCount + counts.retiredCount
    && counts.terminalCount + counts.pendingCount === counts.opportunityCount
    && counts.hiddenCount + counts.removedCount === counts.terminalCount
    && counts.attributedTerminalCount + counts.unattributedTerminalCount
      === counts.terminalCount
    && counts.causallyProvenTerminalCount + counts.unprovenTerminalCount
      === counts.terminalCount;
  if (
    ['measured', 'armed_idle', 'insufficient'].includes(snapshot.state)
    && !countEquationsHold
  ) {
    errors.push({
      segmentIndex,
      path: 'counts',
      reason: 'segment_count_equation_invalid',
      actual: null,
    });
  }
  if (snapshot.state === 'measured') {
    const measuredStateInvariantHolds = countEquationsHold
      && snapshot.oracleAttached === true
      && snapshot.ownerObserverAttached === true
      && snapshot.observerSettled === true
      && counts.opportunityCount > 0
      && counts.causallyProvenTerminalCount === counts.terminalCount
      && counts.pendingCount === 0
      && snapshot.ledger?.evidenceGapCount === 0;
    if (!measuredStateInvariantHolds) {
      errors.push({
        segmentIndex,
        path: 'counts',
        reason: 'measured_segment_state_invariant_invalid',
        actual: null,
      });
    }
  }
  if (snapshot.state === 'armed_idle') {
    const armedIdleStateInvariantHolds = countEquationsHold
      && snapshot.oracleAttached === true
      && snapshot.ownerObserverAttached === true
      && snapshot.observerSettled === true
      && counts.observedOpportunityCount === counts.retiredCount
      && counts.opportunityCount === 0
      && counts.terminalCount === 0
      && counts.hiddenCount === 0
      && counts.removedCount === 0
      && counts.pendingCount === 0
      && counts.attributedTerminalCount === 0
      && counts.unattributedTerminalCount === 0
      && counts.causallyProvenTerminalCount === 0
      && counts.unprovenTerminalCount === 0
      && snapshot.ledger?.evidenceGapCount === 0;
    if (!armedIdleStateInvariantHolds) {
      errors.push({
        segmentIndex,
        path: 'state',
        reason: 'armed_idle_segment_state_invariant_invalid',
        actual: null,
      });
    }
  }
  return errors;
}

function resolveAggregateShortFormState(snapshots) {
  const states = snapshots.map((snapshot) => snapshot.state);
  if (states.includes('broken')) {
    return {
      state: 'broken',
      reason: 'short_form_completeness_segment_broken',
    };
  }
  if (states.includes('insufficient')) {
    return {
      state: 'insufficient',
      reason: 'short_form_completeness_segment_insufficient',
    };
  }
  if (states.includes('unavailable')) {
    return {
      state: 'unavailable',
      reason: 'short_form_completeness_segment_unavailable',
    };
  }
  if (states.includes('inactive')) {
    return {
      state: 'inactive',
      reason: 'short_form_completeness_segment_inactive',
    };
  }
  if (states.includes('measured')) {
    return {
      state: 'measured',
      reason: 'short_form_completeness_proven_across_segments',
    };
  }
  return {
    state: 'armed_idle',
    reason: 'no_short_form_opportunity_observed_across_segments',
  };
}

export function aggregateShortFormCompletenessEvidence(snapshots = []) {
  const measuredSnapshots = Array.isArray(snapshots) ? snapshots : [];
  if (measuredSnapshots.length === 0) {
    return extractShortFormCompletenessEvidence();
  }
  const segmentErrors = measuredSnapshots.flatMap((snapshot, index) => (
    validateShortFormCompletenessSegment(snapshot, index + 1)
  ));
  if (segmentErrors.length > 0) {
    return {
      state: 'broken',
      reason: 'short_form_completeness_segment_contract_drift',
      classification: 'contract_drift',
      measurable: false,
      agentInterpretationRequired: false,
      segmentCount: measuredSnapshots.length,
      segmentErrors,
      countConsistent: false,
    };
  }
  const siteIds = Array.from(new Set(
    measuredSnapshots
      .filter((snapshot) => (
        !SHORT_FORM_COMPLETENESS_SITE_ID_OPTIONAL_STATES.has(snapshot.state)
      ))
      .map((snapshot) => snapshot.siteId.trim()),
  )).sort((left, right) => left.localeCompare(right));
  if (siteIds.length > 1) {
    return {
      state: 'broken',
      reason: 'short_form_completeness_segment_contract_drift',
      classification: 'contract_drift',
      measurable: false,
      agentInterpretationRequired: false,
      segmentCount: measuredSnapshots.length,
      segmentErrors: [{
        segmentIndex: null,
        path: 'siteId',
        reason: 'cross_site_segments_forbidden',
        actual: siteIds,
      }],
      countConsistent: false,
    };
  }

  const counts = Object.fromEntries(SHORT_FORM_COMPLETENESS_COUNT_KEYS.map((key) => [
    key,
    sumFiniteSnapshotValues(measuredSnapshots, (snapshot) => snapshot.counts?.[key]),
  ]));
  const terminalCount = counts.terminalCount;
  const totalEffectLatencyMs = sumFiniteSnapshotValues(
    measuredSnapshots,
    (snapshot) => snapshot.timing?.totalEffectLatencyMs,
  );
  const overhead = Object.fromEntries(SHORT_FORM_COMPLETENESS_OVERHEAD_SUM_KEYS.map((key) => [
    key,
    (() => {
      const total = sumFiniteSnapshotValues(
        measuredSnapshots,
        (snapshot) => snapshot.overhead?.[key],
      );
      return total === null ? null : Number(total.toFixed(2));
    })(),
  ]));
  overhead.probeMaxMs = maxFiniteSnapshotValues(
    measuredSnapshots,
    (snapshot) => snapshot.overhead?.probeMaxMs,
  );
  overhead.snapshotReadMaxMs = maxFiniteSnapshotValues(
    measuredSnapshots,
    (snapshot) => snapshot.overhead?.snapshotReadMaxMs,
  );
  const ledger = Object.fromEntries(SHORT_FORM_COMPLETENESS_LEDGER_COUNT_KEYS.map((key) => [
    key,
    sumFiniteSnapshotValues(measuredSnapshots, (snapshot) => snapshot.ledger?.[key]),
  ]));
  ledger.recentOpportunities = measuredSnapshots.flatMap((snapshot, segmentIndex) => (
    Array.isArray(snapshot.ledger?.recentOpportunities)
      ? snapshot.ledger.recentOpportunities.map((opportunity) => ({
        ...opportunity,
        opportunityId: `s${segmentIndex + 1}:${opportunity.opportunityId || 'unknown'}`,
        segmentIndex: segmentIndex + 1,
      }))
      : []
  )).slice(-32);
  const aggregateState = resolveAggregateShortFormState(measuredSnapshots);
  return {
    ...aggregateState,
    measurable: aggregateState.state === 'measured',
    agentInterpretationRequired: false,
    segmentCount: measuredSnapshots.length,
    segmentStates: measuredSnapshots.map((snapshot, index) => ({
      segmentIndex: index + 1,
      state: snapshot.state,
      reason: snapshot.reason || null,
      opportunityCount: finiteMetric(snapshot.counts?.opportunityCount),
      pendingCount: finiteMetric(snapshot.counts?.pendingCount),
    })),
    siteId: siteIds.length === 1 ? siteIds[0] : null,
    oracleAttached: measuredSnapshots.every((snapshot) => snapshot.oracleAttached === true),
    ownerObserverAttached: measuredSnapshots.every(
      (snapshot) => snapshot.ownerObserverAttached === true,
    ),
    observerSettled: measuredSnapshots.every((snapshot) => snapshot.observerSettled === true),
    countConsistent: measuredSnapshots.every((snapshot) => snapshot.countConsistent === true),
    counts,
    timing: {
      totalEffectLatencyMs: totalEffectLatencyMs === null
        ? null
        : Number(totalEffectLatencyMs.toFixed(2)),
      maxEffectLatencyMs: maxFiniteSnapshotValues(
        measuredSnapshots,
        (snapshot) => snapshot.timing?.maxEffectLatencyMs,
      ),
      averageEffectLatencyMs: terminalCount !== null
        && terminalCount > 0
        && totalEffectLatencyMs !== null
        ? Number((totalEffectLatencyMs / terminalCount).toFixed(2))
        : null,
    },
    overhead,
    ledger,
  };
}

function resolvePayload(response) {
  if (!response || typeof response !== 'object') return null;
  if (response.result?.payload) return response.result.payload;
  if (response.result?.tool && response.result?.version) return response.result;
  return response.payload || response.snapshot || response.session || null;
}

export function analyzeDiagnosticActivation({
  response,
  expectedActiveFilterKeys = [],
  expectedSocial = null,
} = {}) {
  const payload = resolvePayload(response);
  if (!payload) {
    return {
      state: 'unavailable',
      activeFilterKeys: [],
      expectedActiveFilterKeys: sortedUnique(expectedActiveFilterKeys),
      social: null,
      contracts: [createContract(
        'runtime_debugger_payload_available',
        'FAIL',
        null,
        'Diagnostic lane did not return the canonical Runtime Debugger session payload.',
      )],
    };
  }
  const activeFilterKeys = sortedUnique(
    payload.latest?.protection?.summary?.runtime?.activeFilterKeys,
  );
  const expected = sortedUnique(expectedActiveFilterKeys);
  const activationMatches = sameStringSet(activeFilterKeys, expected);
  const socialSnapshot = payload.latest?.socialMetrics || {};
  const social = expectedSocial
    ? {
      activeMetricKeys: sortedUnique(socialSnapshot.activeMetricKeys),
      compiledPlanCount: Number.isFinite(Number(socialSnapshot.compiledPlanCount))
        ? Number(socialSnapshot.compiledPlanCount)
        : null,
      observerAttached: typeof socialSnapshot.observerAttached === 'boolean'
        ? socialSnapshot.observerAttached
        : null,
      loaded: socialSnapshot.loaded === true,
    }
    : null;
  let socialActivationMatches = true;
  const contracts = [createContract(
    'active_filter_keys_exact',
    activationMatches ? 'PASS' : 'FAIL',
    { expected, actual: activeFilterKeys },
  )];
  if (expectedSocial) {
    const metricKeysMatch = sameStringSet(
      social?.activeMetricKeys,
      expectedSocial.activeMetricKeys,
    );
    const compiledPlanCountMatches = (
      social?.compiledPlanCount === Number(expectedSocial.compiledPlanCount)
    );
    const observerAttachedMatches = social?.observerAttached === true;
    socialActivationMatches = (
      metricKeysMatch
      && compiledPlanCountMatches
      && observerAttachedMatches
    );
    contracts.push(createContract(
      'social_active_metric_keys_exact',
      metricKeysMatch ? 'PASS' : 'FAIL',
      { expected: sortedUnique(expectedSocial.activeMetricKeys), actual: social?.activeMetricKeys },
    ));
    contracts.push(createContract(
      'social_compiled_plan_count',
      compiledPlanCountMatches ? 'PASS' : 'FAIL',
      { expected: Number(expectedSocial.compiledPlanCount), actual: social?.compiledPlanCount },
    ));
    contracts.push(createContract(
      'social_observer_attached',
      observerAttachedMatches ? 'PASS' : 'FAIL',
      { actual: social?.observerAttached },
    ));
  }
  const activationState = !activationMatches
    ? (activeFilterKeys.length === 0 ? 'inactive' : 'broken')
    : (socialActivationMatches ? 'measured' : 'broken');
  return {
    state: activationState,
    activeFilterKeys,
    expectedActiveFilterKeys: expected,
    social,
    payload,
    contracts,
  };
}

export function analyzeDebuggerValidity(payload = null) {
  const probes = Array.isArray(payload?.probes) ? payload.probes : [];
  const byProbe = Object.fromEntries(probes.map((probe, index) => {
    const probeId = typeof probe?.probeId === 'string' && probe.probeId.length > 0
      ? probe.probeId
      : `invalid_probe_${index}`;
    return [probeId, analyzeCanonicalProbeMeasurement(probe)];
  }));
  return byProbe;
}

function requireTargetingHealthAcceptanceScopeId(scopeId) {
  if (
    typeof scopeId !== 'string'
    || !SITE_E2E_TARGETING_HEALTH_SCOPE_ID_PATTERN.test(scopeId)
  ) {
    throw new Error('SITE_E2E_TARGETING_HEALTH_ACCEPTANCE_SCOPE_ID_INVALID');
  }
  return scopeId;
}

function requireTargetingHealthAcceptanceMode(mode) {
  if (!SITE_E2E_TARGETING_HEALTH_ACCEPTANCE_MODE_VALUES.has(mode)) {
    throw new Error('SITE_E2E_TARGETING_HEALTH_ACCEPTANCE_MODE_INVALID');
  }
  return mode;
}

function requireTargetingHealthProbeIds(requiredProbeIds) {
  if (!Array.isArray(requiredProbeIds)) {
    throw new Error('SITE_E2E_TARGETING_HEALTH_REQUIRED_PROBE_IDS_ARRAY_REQUIRED');
  }
  const seen = new Set();
  return requiredProbeIds.map((probeId) => {
    if (!Object.hasOwn(PROBE_TARGETING_HEALTH_OWNERS, probeId)) {
      throw new Error(`SITE_E2E_TARGETING_HEALTH_REQUIRED_PROBE_UNKNOWN:${probeId}`);
    }
    if (seen.has(probeId)) {
      throw new Error(`SITE_E2E_TARGETING_HEALTH_REQUIRED_PROBE_DUPLICATE:${probeId}`);
    }
    seen.add(probeId);
    return probeId;
  });
}

function resolveTargetingHealthIntegrityReason({
  probeMatchCount,
  measurement,
}) {
  if (probeMatchCount === 0) return 'required_probe_missing';
  if (probeMatchCount > 1) return 'required_probe_duplicate';
  if (!measurement) return 'required_probe_analysis_missing';
  if (measurement.state === TARGETING_HEALTH_VALIDITY.BROKEN) {
    return measurement.reason || 'required_probe_analysis_broken';
  }
  if (measurement.targetingHealthValidity === null) {
    return 'targeting_health_snapshot_missing';
  }
  if (measurement.targetingHealthContractError !== null) {
    return 'targeting_health_contract_invalid';
  }
  if (measurement.targetingHealthValidityMatchesProbe !== true) {
    return 'targeting_health_probe_validity_mismatch';
  }
  if (measurement.targetingHealthOperationMatchesProbe !== true) {
    return 'targeting_health_probe_operation_mismatch';
  }
  return null;
}

function projectTargetingHealthStateStatus(mode, measurement, integrityReason) {
  if (integrityReason !== null || !measurement) return 'FAIL';
  if (mode === SITE_E2E_TARGETING_HEALTH_ACCEPTANCE_MODES.ACTIVE) {
    if (measurement.state === TARGETING_HEALTH_VALIDITY.MEASURED) return 'PASS';
    if ([
      TARGETING_HEALTH_VALIDITY.ARMED_IDLE,
      TARGETING_HEALTH_VALIDITY.INSUFFICIENT,
    ].includes(measurement.state)) return 'WARN';
    return 'FAIL';
  }
  if (measurement.state === TARGETING_HEALTH_VALIDITY.INACTIVE) return 'PASS';
  if (measurement.state === TARGETING_HEALTH_VALIDITY.UNAVAILABLE) return 'WARN';
  return 'FAIL';
}

/**
 * Converts canonical Social/Short-form debugger probe evidence into acceptance
 * contracts without reading DOM content or reusing either product classifier.
 * Contract integrity and phase-state policy remain separate report rows so a
 * valid unavailable envelope cannot be confused with a malformed envelope.
 */
export function projectTargetingHealthAcceptanceContracts({
  scopeId,
  mode,
  payload = null,
  requiredProbeIds,
} = {}) {
  const normalizedScopeId = requireTargetingHealthAcceptanceScopeId(scopeId);
  const normalizedMode = requireTargetingHealthAcceptanceMode(mode);
  const normalizedProbeIds = requireTargetingHealthProbeIds(requiredProbeIds);
  const probes = Array.isArray(payload?.probes) ? payload.probes : [];
  const validity = analyzeDebuggerValidity(payload);

  return normalizedProbeIds.flatMap((probeId) => {
    const probeMatchCount = probes.filter((probe) => probe?.probeId === probeId).length;
    const measurement = Object.hasOwn(validity, probeId) ? validity[probeId] : null;
    const integrityReason = resolveTargetingHealthIntegrityReason({
      probeMatchCount,
      measurement,
    });
    const stateStatus = projectTargetingHealthStateStatus(
      normalizedMode,
      measurement,
      integrityReason,
    );
    const sharedEvidence = {
      evidenceClass: 'content_free_targeting_health',
      scopeId: normalizedScopeId,
      mode: normalizedMode,
      probeId,
      expectedOwnerId: PROBE_TARGETING_HEALTH_OWNERS[probeId],
      probeMatchCount,
    };
    return [
      createContract(
        `targeting_health_contract_integrity:${normalizedScopeId}:${probeId}`,
        integrityReason === null ? 'PASS' : 'FAIL',
        {
          ...sharedEvidence,
          integrityReason,
          analyzerState: measurement?.state || null,
          analyzerReason: measurement?.reason || null,
          operationCount: measurement?.operationCount ?? null,
          targetingHealthValidity: measurement?.targetingHealthValidity || null,
          targetingHealthReasonCode: measurement?.targetingHealthReasonCode || null,
          targetingHealthContractError:
            measurement?.targetingHealthContractError || null,
          targetingHealthValidityMatchesProbe:
            measurement?.targetingHealthValidityMatchesProbe ?? null,
          targetingHealthOperationMatchesProbe:
            measurement?.targetingHealthOperationMatchesProbe ?? null,
        },
      ),
      createContract(
        `targeting_health_state_acceptance:${normalizedScopeId}:${probeId}`,
        stateStatus,
        {
          ...sharedEvidence,
          state: measurement?.state || null,
          reason: measurement?.reason || (integrityReason === null
            ? null
            : integrityReason),
          contractIntegrity: integrityReason === null ? 'valid' : 'invalid',
          passStates: normalizedMode === SITE_E2E_TARGETING_HEALTH_ACCEPTANCE_MODES.ACTIVE
            ? [TARGETING_HEALTH_VALIDITY.MEASURED]
            : [TARGETING_HEALTH_VALIDITY.INACTIVE],
          warnStates: normalizedMode === SITE_E2E_TARGETING_HEALTH_ACCEPTANCE_MODES.ACTIVE
            ? [
              TARGETING_HEALTH_VALIDITY.ARMED_IDLE,
              TARGETING_HEALTH_VALIDITY.INSUFFICIENT,
            ]
            : [TARGETING_HEALTH_VALIDITY.UNAVAILABLE],
        },
      ),
    ];
  });
}

function monotonicDelta(latest, baseline) {
  if (
    latest === null
    || latest === undefined
    || baseline === null
    || baseline === undefined
    || typeof latest === 'boolean'
    || typeof baseline === 'boolean'
  ) {
    return null;
  }
  const right = Number(latest);
  const left = Number(baseline);
  if (!Number.isFinite(right) || !Number.isFinite(left)) return null;
  const delta = right - left;
  if (delta < 0) return null;
  return Math.round(delta * 100) / 100;
}

function monotonicCounterRecordDelta(latest = {}, baseline = {}, keys = []) {
  return Object.fromEntries(keys.map((key) => [
    key,
    monotonicDelta(latest?.[key], baseline?.[key]),
  ]));
}

function finiteMetric(value) {
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

function inspectProbeTargetingHealth(probe) {
  const expectedOwnerId = PROBE_TARGETING_HEALTH_OWNERS[probe?.probeId] || null;
  if (!expectedOwnerId) {
    return { targetingHealth: null, contractError: null };
  }
  const snapshot = probe?.details?.targetingHealth;
  if (snapshot === null || snapshot === undefined) {
    return {
      targetingHealth: null,
      contractError: TARGETING_HEALTH_REQUIRED_PROBE_STATES.has(probe?.status)
        ? `targeting_health_snapshot_missing:${expectedOwnerId}`
        : null,
    };
  }
  try {
    const targetingHealth = validateTargetingHealthSnapshot(snapshot);
    if (targetingHealth.ownerId !== expectedOwnerId) {
      return {
        targetingHealth: null,
        contractError:
          `targeting_health_owner_mismatch:${expectedOwnerId}:${targetingHealth.ownerId}`,
      };
    }
    return { targetingHealth, contractError: null };
  } catch (error) {
    return {
      targetingHealth: null,
      contractError: String(error?.message || error || 'targeting_health_snapshot_invalid'),
    };
  }
}

function analyzeCanonicalProbeMeasurement(probe) {
  if (!probe || typeof probe !== 'object' || Array.isArray(probe)) {
    return {
      state: TARGETING_HEALTH_VALIDITY.UNAVAILABLE,
      reason: 'probe_result_missing',
      operationCount: null,
      measurable: false,
      targetingHealthValidity: null,
      targetingHealthReasonCode: null,
      targetingHealthContractError: null,
      targetingHealthValidityMatchesProbe: null,
      targetingHealthOperationMatchesProbe: null,
    };
  }
  const statusValid = MEASUREMENT_STATES.has(probe.status);
  const operationCount = Number.isSafeInteger(probe.operationCount) && probe.operationCount >= 0
    ? probe.operationCount
    : null;
  const operationCountValid = operationCount !== null;
  const healthInspection = inspectProbeTargetingHealth(probe);
  const healthValidityMatchesProbe = healthInspection.targetingHealth === null
    ? null
    : healthInspection.targetingHealth.validity === probe.status;
  const healthOperationMatchesProbe = healthInspection.targetingHealth === null
    ? null
    : (
      healthInspection.targetingHealth.validity !== TARGETING_HEALTH_VALIDITY.MEASURED
      || (
        healthInspection.targetingHealth.validity === TARGETING_HEALTH_VALIDITY.MEASURED
        && operationCount > 0
      )
    );
  let state = statusValid ? probe.status : TARGETING_HEALTH_VALIDITY.BROKEN;
  let reason = probe.reason || null;
  if (!statusValid) reason = 'probe_status_invalid';
  else if (!operationCountValid) {
    state = TARGETING_HEALTH_VALIDITY.BROKEN;
    reason = 'probe_operation_count_invalid';
  } else if (healthInspection.contractError !== null) {
    state = TARGETING_HEALTH_VALIDITY.BROKEN;
    reason = 'targeting_health_contract_invalid';
  } else if (healthValidityMatchesProbe === false) {
    state = TARGETING_HEALTH_VALIDITY.BROKEN;
    reason = 'targeting_health_probe_validity_mismatch';
  } else if (healthOperationMatchesProbe === false) {
    state = TARGETING_HEALTH_VALIDITY.BROKEN;
    reason = 'targeting_health_probe_operation_mismatch';
  }
  return {
    state,
    reason,
    operationCount: operationCountValid ? operationCount : null,
    measurable: state === TARGETING_HEALTH_VALIDITY.MEASURED,
    targetingHealthValidity: healthInspection.targetingHealth?.validity || null,
    targetingHealthReasonCode: healthInspection.targetingHealth?.reasonCode || null,
    targetingHealthContractError: healthInspection.contractError,
    targetingHealthValidityMatchesProbe: healthValidityMatchesProbe,
    targetingHealthOperationMatchesProbe: healthOperationMatchesProbe,
  };
}

function sumMeasuredMetrics(...values) {
  const metrics = values.map(finiteMetric);
  if (metrics.some((value) => value === null)) return null;
  return Math.round(metrics.reduce((total, value) => total + value, 0) * 100) / 100;
}

function subtractMeasuredMetrics(total, ...subtrahends) {
  const resolvedTotal = finiteMetric(total);
  const resolvedSubtrahends = subtrahends.map(finiteMetric);
  if (
    resolvedTotal === null
    || resolvedSubtrahends.some((value) => value === null)
  ) return null;
  const difference = resolvedTotal
    - resolvedSubtrahends.reduce((sum, value) => sum + value, 0);
  if (difference < -0.01) return null;
  return Math.round(Math.max(0, difference) * 100) / 100;
}

function booleanMetric(value) {
  return typeof value === 'boolean' ? value : null;
}

function readProbeMeasurement(payload, probeId) {
  const probe = Array.isArray(payload?.probes)
    ? payload.probes.find((entry) => entry?.probeId === probeId)
    : null;
  return analyzeCanonicalProbeMeasurement(probe);
}

export function createSocialMetricsPhaseTransitionMeasurement(payload = null, {
  phase,
  expectedBaselineActive,
  expectedLatestActive,
} = {}) {
  if (typeof phase !== 'string' || phase.length === 0) {
    throw new Error('SITE_E2E_SOCIAL_PHASE_REQUIRED');
  }
  if (typeof expectedBaselineActive !== 'boolean' || typeof expectedLatestActive !== 'boolean') {
    throw new Error('SITE_E2E_SOCIAL_PHASE_ACTIVE_CONTRACT_REQUIRED');
  }
  const baseline = payload?.baseline?.socialMetrics;
  const latest = payload?.latest?.socialMetrics;
  if (!baseline || !latest || baseline.loaded !== true || latest.loaded !== true) {
    return {
      state: 'unavailable',
      reason: 'social_phase_owner_snapshot_unavailable',
      operationCount: null,
      phase,
    };
  }
  if (
    baseline.active !== expectedBaselineActive
    || latest.active !== expectedLatestActive
  ) {
    return {
      state: 'broken',
      reason: 'social_phase_activation_transition_mismatch',
      operationCount: null,
      phase,
      expectedBaselineActive,
      expectedLatestActive,
      actualBaselineActive: baseline.active,
      actualLatestActive: latest.active,
    };
  }
  const scanOperations = monotonicDelta(
    latest.stats?.scanOperations,
    baseline.stats?.scanOperations,
  );
  const configurationCleanupWriteAttempts = monotonicDelta(
    latest.stats?.audit?.configurationCleanupWriteAttempts,
    baseline.stats?.audit?.configurationCleanupWriteAttempts,
  );
  if (scanOperations === null || configurationCleanupWriteAttempts === null) {
    return {
      state: 'unavailable',
      reason: 'social_phase_transition_counters_unavailable',
      operationCount: null,
      phase,
    };
  }
  return {
    state: 'measured',
    reason: 'social_phase_activation_transition_measured',
    operationCount: scanOperations + configurationCleanupWriteAttempts,
    phase,
    expectedBaselineActive,
    expectedLatestActive,
  };
}

function createMetricMeasurement(value, ownerMeasurement, missingReason) {
  if (value === null) {
    return { state: 'unavailable', reason: missingReason };
  }
  return {
    state: ownerMeasurement.state,
    reason: ownerMeasurement.reason,
  };
}

function createOwnedMutationIntegrityEvidence(socialBaseline, socialLatest, ownerMeasurement) {
  const counters = {
    expiredByAge: monotonicDelta(
      socialLatest.expiredOwnedMutationByAgeCount,
      socialBaseline.expiredOwnedMutationByAgeCount,
    ),
    expiredByDelivery: monotonicDelta(
      socialLatest.expiredOwnedMutationByDeliveryCount,
      socialBaseline.expiredOwnedMutationByDeliveryCount,
    ),
    epochInvalidated: monotonicDelta(
      socialLatest.epochInvalidatedOwnedMutationCount,
      socialBaseline.epochInvalidatedOwnedMutationCount,
    ),
    rootInvalidated: monotonicDelta(
      socialLatest.rootInvalidatedOwnedMutationCount,
      socialBaseline.rootInvalidatedOwnedMutationCount,
    ),
    targetUnobserved: monotonicDelta(
      socialLatest.unobservedOwnedMutationTargetCount,
      socialBaseline.unobservedOwnedMutationTargetCount,
    ),
    valueMismatch: monotonicDelta(
      socialLatest.mismatchedOwnedMutationCount,
      socialBaseline.mismatchedOwnedMutationCount,
    ),
    excessRecords: monotonicDelta(
      socialLatest.excessOwnedMutationRecordCount,
      socialBaseline.excessOwnedMutationRecordCount,
    ),
  };
  if (ownerMeasurement.state !== 'measured') {
    return {
      state: ownerMeasurement.state,
      reason: ownerMeasurement.reason || 'owner_probe_not_measured',
      clean: null,
      total: null,
      ...counters,
    };
  }
  if (Object.values(counters).some((value) => value === null)) {
    return {
      state: 'unavailable',
      reason: 'owned_mutation_integrity_counter_unavailable',
      clean: null,
      total: null,
      ...counters,
    };
  }
  const total = Object.values(counters).reduce((sum, value) => sum + value, 0);
  return {
    state: 'measured',
    reason: total === 0
      ? 'owned_mutation_integrity_clean'
      : 'owned_mutation_fail_open_events_observed',
    clean: total === 0,
    total,
    ...counters,
  };
}

function createScannerEvidenceMeasurement({
  ownerMeasurement,
  evidenceState,
  evaluationCount,
  measuredExecutionCount = evaluationCount,
  unavailableCount,
  counterValue,
  prefix,
}) {
  if (ownerMeasurement.state !== 'measured') {
    return {
      state: ownerMeasurement.state,
      reason: ownerMeasurement.reason || 'owner_probe_not_measured',
      evidenceState,
      evaluationCount,
      measuredExecutionCount,
      unavailableCount,
    };
  }
  if (
    counterValue === null
    || evaluationCount === null
    || measuredExecutionCount === null
    || unavailableCount === null
    || !['armed_idle', 'unavailable', 'measured'].includes(evidenceState)
  ) {
    return {
      state: 'unavailable',
      reason: `${prefix}_evidence_contract_unavailable`,
      evidenceState,
      evaluationCount,
      measuredExecutionCount,
      unavailableCount,
    };
  }
  if (unavailableCount > 0 && measuredExecutionCount > 0) {
    return {
      state: 'insufficient',
      reason: `${prefix}_evidence_partial_coverage`,
      evidenceState,
      evaluationCount,
      measuredExecutionCount,
      unavailableCount,
    };
  }
  if (unavailableCount > 0 || evidenceState === 'unavailable') {
    return {
      state: 'unavailable',
      reason: `${prefix}_evidence_unavailable`,
      evidenceState,
      evaluationCount,
      measuredExecutionCount,
      unavailableCount,
    };
  }
  if (measuredExecutionCount === 0) {
    return {
      state: 'armed_idle',
      reason: `${prefix}_not_evaluated`,
      evidenceState,
      evaluationCount,
      measuredExecutionCount,
      unavailableCount,
    };
  }
  return {
    state: 'measured',
    reason: `${prefix}_evidence_measured`,
    evidenceState,
    evaluationCount,
    measuredExecutionCount,
    unavailableCount,
  };
}

function createRatioEvidence(numerator, denominator, ownerMeasurement) {
  if (numerator === null || denominator === null) {
    return {
      status: 'unavailable',
      reason: 'counter_unavailable',
      numerator,
      denominator,
      ratio: null,
      percent: null,
    };
  }
  if (ownerMeasurement.state !== 'measured') {
    return {
      status: ownerMeasurement.state,
      reason: ownerMeasurement.reason || 'owner_probe_not_measured',
      numerator,
      denominator,
      ratio: null,
      percent: null,
    };
  }
  if (denominator === 0) {
    return {
      status: 'insufficient',
      reason: 'zero_denominator',
      numerator,
      denominator,
      ratio: null,
      percent: null,
    };
  }
  const ratio = numerator / denominator;
  return {
    status: 'measured',
    reason: 'denominator_available',
    numerator,
    denominator,
    ratio,
    percent: ratio * 100,
  };
}

function createSubscriberCallbackCostDeltas(observerBaseline, observerLatest) {
  if (
    !observerLatest?.subscriberCounters
    || typeof observerLatest.subscriberCounters !== 'object'
    || Array.isArray(observerLatest.subscriberCounters)
  ) {
    return null;
  }
  const baselineCounters = observerBaseline?.subscriberCounters;
  if (
    baselineCounters !== undefined
    && (
      !baselineCounters
      || typeof baselineCounters !== 'object'
      || Array.isArray(baselineCounters)
    )
  ) {
    return null;
  }
  const costs = [];
  for (const [label, latestEntry] of Object.entries(observerLatest.subscriberCounters)) {
    const latestTotalMs = finiteMetric(latestEntry?.totalMs);
    const latestCalls = finiteMetric(latestEntry?.calls);
    if (latestTotalMs === null || latestCalls === null) return null;
    const baselineEntry = baselineCounters?.[label];
    const baselineTotalMs = baselineEntry === undefined
      ? 0
      : finiteMetric(baselineEntry?.totalMs);
    const baselineCalls = baselineEntry === undefined
      ? 0
      : finiteMetric(baselineEntry?.calls);
    if (baselineTotalMs === null || baselineCalls === null) return null;
    const totalMs = monotonicDelta(latestTotalMs, baselineTotalMs);
    const calls = monotonicDelta(latestCalls, baselineCalls);
    if (totalMs === null || calls === null) return null;
    costs.push({
      label,
      calls,
      totalMs,
      avgMs: calls > 0 ? Math.round((totalMs / calls) * 100) / 100 : 0,
    });
  }
  return costs.sort((left, right) => (
    right.totalMs - left.totalMs || left.label.localeCompare(right.label)
  ));
}

function sumSubscriberCallbackDelta(subscriberCosts) {
  if (!Array.isArray(subscriberCosts)) return null;
  return Math.round(
    subscriberCosts.reduce((total, entry) => total + entry.totalMs, 0) * 100,
  ) / 100;
}

function currentScanActivity(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || !Object.hasOwn(snapshot, 'currentScan')) {
    return null;
  }
  return snapshot.currentScan !== null;
}

function analyzeOwnerEfficiencySettle(source, fields, {
  owner,
  ownerMeasurement = null,
  required = true,
} = {}) {
  if (!required) {
    return {
      owner,
      required: false,
      state: 'inactive',
      reason: 'owner_inactive',
      settled: null,
      unsettledFields: [],
      unavailableFields: [],
    };
  }
  const unsettledFields = [];
  const unavailableFields = [];
  for (const { key, settledValue } of fields) {
    const value = source[key];
    if (value === null || value === undefined) {
      unavailableFields.push(key);
    } else if (!Object.is(value, settledValue)) {
      unsettledFields.push(key);
    }
  }
  if (ownerMeasurement?.state === 'broken' || ownerMeasurement?.state === 'unavailable') {
    return {
      owner,
      required: true,
      state: 'unavailable',
      reason: 'owner_probe_not_measurable',
      ownerState: ownerMeasurement.state,
      ownerReason: ownerMeasurement.reason,
      settled: null,
      unsettledFields,
      unavailableFields,
    };
  }
  if (unsettledFields.length > 0) {
    return {
      owner,
      required: true,
      state: 'insufficient',
      reason: 'final_snapshot_unsettled',
      settled: false,
      unsettledFields,
      unavailableFields,
    };
  }
  if (unavailableFields.length > 0) {
    return {
      owner,
      required: true,
      state: 'unavailable',
      reason: 'final_snapshot_settle_state_unavailable',
      settled: null,
      unsettledFields,
      unavailableFields,
    };
  }
  return {
    owner,
    required: true,
    state: 'measured',
    reason: 'final_snapshot_settled',
    settled: true,
    unsettledFields,
    unavailableFields,
  };
}

export function analyzeDebuggerEfficiencySettle(pending = null, {
  observerHubMeasurement = null,
  socialMetricsMeasurement = null,
  textShuffleMeasurement = null,
  requireSocialMetrics = false,
  requireTextShuffle = false,
} = {}) {
  const source = pending && typeof pending === 'object' && !Array.isArray(pending)
    ? pending
    : {};
  const observerHub = analyzeOwnerEfficiencySettle(
    source,
    OBSERVER_HUB_EFFICIENCY_SETTLE_FIELDS,
    {
      owner: 'observerHub',
      ownerMeasurement: observerHubMeasurement,
    },
  );
  const socialMetrics = analyzeOwnerEfficiencySettle(
    source,
    SOCIAL_METRICS_EFFICIENCY_SETTLE_FIELDS,
    {
      owner: 'socialMetrics',
      ownerMeasurement: socialMetricsMeasurement,
      required: requireSocialMetrics || socialMetricsMeasurement?.state !== 'inactive',
    },
  );
  const textShuffle = analyzeOwnerEfficiencySettle(
    source,
    TEXT_SHUFFLE_EFFICIENCY_SETTLE_FIELDS,
    {
      owner: 'textShuffle',
      ownerMeasurement: textShuffleMeasurement,
      required: requireTextShuffle,
    },
  );
  const requiredOwners = [observerHub, socialMetrics, textShuffle]
    .filter((entry) => entry.required);
  const unsettledFields = requiredOwners.flatMap((entry) => entry.unsettledFields);
  const unavailableFields = requiredOwners.flatMap((entry) => entry.unavailableFields);
  let state = 'measured';
  let reason = 'final_snapshot_settled';
  let settled = true;
  if (requiredOwners.some((entry) => entry.settled === false)) {
    state = 'insufficient';
    reason = 'final_snapshot_unsettled';
    settled = false;
  } else if (requiredOwners.some((entry) => entry.settled !== true)) {
    state = 'unavailable';
    reason = 'final_snapshot_settle_state_unavailable';
    settled = null;
  }
  return {
    state,
    reason,
    settled,
    unsettledFields,
    unavailableFields,
    owners: { observerHub, socialMetrics, textShuffle },
  };
}

function applyEfficiencySettleToMeasurement(ownerMeasurement, settleMeasurement) {
  if (ownerMeasurement.state !== 'measured' || settleMeasurement.state === 'measured') {
    return ownerMeasurement;
  }
  return {
    ...ownerMeasurement,
    state: settleMeasurement.state,
    reason: settleMeasurement.reason,
    ownerState: ownerMeasurement.state,
    ownerReason: ownerMeasurement.reason,
    unsettledFields: [...settleMeasurement.unsettledFields],
    unavailableFields: [...settleMeasurement.unavailableFields],
  };
}

const PHASE_BOUNDARY_MONOTONIC_OWNER_COUNTER_PATHS = Object.freeze([
  Object.freeze(['observerHub', 'flushes']),
  Object.freeze(['observerHub', 'mutations']),
  Object.freeze(['socialMetrics', 'stats', 'scanAdmissions']),
  Object.freeze(['socialMetrics', 'stats', 'executedScans']),
  Object.freeze(['socialMetrics', 'stats', 'scanOperations']),
  Object.freeze(['socialMetrics', 'stats', 'audit', 'decisionCount']),
  Object.freeze(['socialMetrics', 'stats', 'audit', 'writeAttempts']),
]);

function readOwnerCounter(snapshot, path) {
  return path.reduce((value, segment) => value?.[segment], snapshot);
}

function collectRegressedOwnerCounters(startSnapshot, endSnapshot) {
  return PHASE_BOUNDARY_MONOTONIC_OWNER_COUNTER_PATHS.flatMap((path) => {
    const start = finiteMetric(readOwnerCounter(startSnapshot, path));
    const end = finiteMetric(readOwnerCounter(endSnapshot, path));
    return start !== null && end !== null && end < start
      ? [{
        path: path.join('.'),
        start,
        end,
      }]
      : [];
  });
}

function analyzeActiveDebuggerSessionBoundary(phase, payload) {
  const violations = [];
  if (payload?.tool !== RUNTIME_DEBUGGER_TOOL_ID) violations.push('tool_mismatch');
  if (payload?.version !== RUNTIME_DEBUGGER_SESSION_VERSION) violations.push('version_mismatch');
  if (payload?.scope?.type !== 'full') violations.push('full_scope_required');
  if (!payload?.baseline || typeof payload.baseline !== 'object') {
    violations.push('baseline_snapshot_required');
  }
  if (!payload?.latest || typeof payload.latest !== 'object') {
    violations.push('latest_snapshot_required');
  }
  const timestamps = {
    startedAt: finiteMetric(payload?.session?.startedAt),
    baselineCapturedAt: finiteMetric(payload?.session?.baselineCapturedAt),
    startLatestCapturedAt: finiteMetric(payload?.session?.baselineCapturedAt),
    endLatestCapturedAt: finiteMetric(payload?.session?.latestCapturedAt),
  };
  if (Object.values(timestamps).some((value) => value === null)) {
    violations.push('session_timestamp_unavailable');
  } else if (
    timestamps.startedAt > timestamps.baselineCapturedAt
    || timestamps.baselineCapturedAt > timestamps.endLatestCapturedAt
  ) {
    violations.push('session_timestamp_order_invalid');
  }
  if (typeof payload?.url !== 'string' || payload.url.length === 0) {
    violations.push('session_url_unavailable');
  }

  const regressedCounters = collectRegressedOwnerCounters(
    payload?.baseline,
    payload?.latest,
  );
  if (regressedCounters.length > 0) violations.push('owner_counter_regressed');

  const baselineSocialLoaded = payload?.baseline?.socialMetrics?.loaded === true;
  const latestSocialLoaded = payload?.latest?.socialMetrics?.loaded === true;
  const startEpoch = finiteMetric(payload?.baseline?.socialMetrics?.measurementEpoch);
  const endEpoch = finiteMetric(payload?.latest?.socialMetrics?.measurementEpoch);
  if (baselineSocialLoaded !== latestSocialLoaded) {
    violations.push('social_owner_load_state_mismatch');
  } else if (
    baselineSocialLoaded
    && (startEpoch === null || endEpoch === null || startEpoch !== endEpoch)
  ) {
    violations.push('social_measurement_epoch_mismatch');
  }

  return {
    state: violations.length === 0 ? 'measured' : 'broken',
    reason: violations.length === 0
      ? 'phase_boundary_continuity_verified'
      : 'phase_boundary_mismatch',
    classification: violations.length === 0 ? null : 'contract_drift',
    phase,
    violations,
    timestamps,
    socialMeasurementEpoch: {
      start: startEpoch,
      end: endEpoch,
    },
    regressedCounters,
  };
}

export function analyzeDebuggerPhaseBoundary({
  phase,
  startPayload = null,
  endPayload = null,
} = {}) {
  if (
    phase === SITE_E2E_DEBUGGER_COST_PHASES.ACTIVE_STIMULUS
    && startPayload === null
  ) {
    return analyzeActiveDebuggerSessionBoundary(phase, endPayload);
  }
  const violations = [];
  if (
    startPayload?.tool !== RUNTIME_DEBUGGER_TOOL_ID
    || endPayload?.tool !== RUNTIME_DEBUGGER_TOOL_ID
  ) violations.push('tool_mismatch');
  if (
    startPayload?.version !== RUNTIME_DEBUGGER_SESSION_VERSION
    || endPayload?.version !== RUNTIME_DEBUGGER_SESSION_VERSION
  ) violations.push('version_mismatch');
  if (startPayload?.scope?.type !== 'full' || endPayload?.scope?.type !== 'full') {
    violations.push('full_scope_required');
  }
  if (startPayload?.session?.startedAt !== endPayload?.session?.startedAt) {
    violations.push('session_started_at_mismatch');
  }
  if (startPayload?.session?.baselineCapturedAt !== endPayload?.session?.baselineCapturedAt) {
    violations.push('baseline_captured_at_mismatch');
  }
  const timestamps = {
    startedAt: finiteMetric(startPayload?.session?.startedAt),
    baselineCapturedAt: finiteMetric(startPayload?.session?.baselineCapturedAt),
    startLatestCapturedAt: finiteMetric(startPayload?.session?.latestCapturedAt),
    endLatestCapturedAt: finiteMetric(endPayload?.session?.latestCapturedAt),
  };
  if (Object.values(timestamps).some((value) => value === null)) {
    violations.push('session_timestamp_unavailable');
  } else if (
    timestamps.startedAt > timestamps.baselineCapturedAt
    || timestamps.baselineCapturedAt > timestamps.startLatestCapturedAt
    || timestamps.startLatestCapturedAt > timestamps.endLatestCapturedAt
  ) {
    violations.push('session_timestamp_order_invalid');
  }
  if (startPayload?.url !== endPayload?.url) violations.push('session_url_mismatch');

  const regressedCounters = collectRegressedOwnerCounters(
    startPayload?.latest,
    endPayload?.latest,
  );
  if (regressedCounters.length > 0) violations.push('owner_counter_regressed');

  const startSocialLoaded = startPayload?.latest?.socialMetrics?.loaded === true;
  const endSocialLoaded = endPayload?.latest?.socialMetrics?.loaded === true;
  const startEpoch = finiteMetric(startPayload?.latest?.socialMetrics?.measurementEpoch);
  const endEpoch = finiteMetric(endPayload?.latest?.socialMetrics?.measurementEpoch);
  if (startSocialLoaded !== endSocialLoaded) {
    violations.push('social_owner_load_state_mismatch');
  } else if (
    startSocialLoaded
    && (startEpoch === null || endEpoch === null || startEpoch !== endEpoch)
  ) {
    violations.push('social_measurement_epoch_mismatch');
  }

  return {
    state: violations.length === 0 ? 'measured' : 'broken',
    reason: violations.length === 0
      ? 'phase_boundary_continuity_verified'
      : 'phase_boundary_mismatch',
    classification: violations.length === 0 ? null : 'contract_drift',
    phase,
    violations,
    timestamps,
    socialMeasurementEpoch: {
      start: startEpoch,
      end: endEpoch,
    },
    regressedCounters,
  };
}

function createBrokenPhaseCostEvidence(phase, boundary) {
  const check = {
    id: 'scanner_phase_boundary_continuity',
    status: 'FAIL',
    measurementState: 'broken',
    reason: boundary.reason,
    boundary,
  };
  return {
    phase,
    boundary,
    measurementStates: {
      efficiency: {
        state: 'broken',
        reason: boundary.reason,
        settled: null,
      },
      observerHub: { state: 'broken', reason: boundary.reason },
      socialMetrics: { state: 'broken', reason: boundary.reason },
      identityCardinality: { state: 'broken', reason: boundary.reason },
    },
    scannerStructuralAudit: {
      status: 'WARN',
      policy: 'phase_boundary_required_before_structural_analysis',
      checks: [],
    },
    scannerConservationAudit: {
      status: 'FAIL',
      policy: 'proof_based_counter_conservation',
      agentInterpretationRequired: false,
      approvedBaselineRequired: false,
      optimalityProven: false,
      instrumentationCompletenessProven: false,
      checks: [check],
    },
    workLedger: {
      schemaVersion: RUNTIME_DEBUGGER_SCANNER_WORK_LEDGER_VERSION,
      phase,
      state: 'broken',
      reason: boundary.reason,
      partialMeasurements: [],
      automaticHardGate: false,
      approvedOperatingEnvelopeRequired: true,
      optimalityProven: false,
      instrumentationCompletenessProven: false,
      timingDimensionsAreAdditive: false,
      boundary,
    },
  };
}

export function extractDebuggerPhaseCostEvidence({
  phase,
  startPayload = null,
  endPayload = null,
  requireSocialMetricsTransition = false,
} = {}) {
  if (!SITE_E2E_DEBUGGER_COST_PHASE_VALUES.has(phase)) {
    throw new Error(`SITE_E2E_DEBUGGER_COST_PHASE_INVALID:${phase || 'empty'}`);
  }
  if (!endPayload?.baseline || !endPayload?.latest) {
    throw new Error(`SITE_E2E_DEBUGGER_COST_PHASE_END_PAYLOAD_REQUIRED:${phase}`);
  }
  if (phase === SITE_E2E_DEBUGGER_COST_PHASES.ACTIVE_STIMULUS) {
    const boundary = analyzeDebuggerPhaseBoundary({
      phase,
      endPayload,
    });
    if (boundary.state !== 'measured') {
      return createBrokenPhaseCostEvidence(phase, boundary);
    }
    return {
      ...extractDebuggerCostEvidence(endPayload, {
        phase,
        identityScope: 'phase_local_measurement_epoch',
      }),
      boundary,
    };
  }
  if (!startPayload?.latest) {
    throw new Error(`SITE_E2E_DEBUGGER_COST_PHASE_START_PAYLOAD_REQUIRED:${phase}`);
  }
  const boundary = analyzeDebuggerPhaseBoundary({
    phase,
    startPayload,
    endPayload,
  });
  if (boundary.state !== 'measured') {
    return createBrokenPhaseCostEvidence(phase, boundary);
  }
  const phasePayload = {
    ...endPayload,
    baseline: startPayload.latest,
    latest: endPayload.latest,
  };
  const isDisable = phase === SITE_E2E_DEBUGGER_COST_PHASES.DISABLE_CLEANUP;
  const isReenable = phase === SITE_E2E_DEBUGGER_COST_PHASES.REENABLE_STIMULUS;
  const socialTransitionMeasurement = (isDisable || isReenable)
    && requireSocialMetricsTransition
    ? createSocialMetricsPhaseTransitionMeasurement(phasePayload, {
      phase,
      expectedBaselineActive: isDisable,
      expectedLatestActive: isReenable,
    })
    : null;
  return {
    ...extractDebuggerCostEvidence(phasePayload, {
      phase,
      requireSocialMetricsSettle: (isDisable || isReenable)
        && requireSocialMetricsTransition,
      socialTransitionMeasurement,
      identityMeasurementState: 'insufficient',
      identityScope: 'measurement_epoch_spans_phase_boundary',
    }),
    boundary,
  };
}

export function extractDebuggerCostEvidence(payload = null, {
  phase = 'session',
  requireSocialMetricsSettle = false,
  socialTransitionMeasurement = null,
  identityMeasurementState = null,
  identityScope = 'measurement_epoch',
} = {}) {
  const baseline = payload?.baseline || {};
  const latest = payload?.latest || {};
  const observerBaseline = baseline.observerHub || {};
  const observerLatest = latest.observerHub || {};
  const visualBaseline = baseline.visual || {};
  const visualLatest = latest.visual || {};
  const visualBaselineStats = visualBaseline.stats || {};
  const visualLatestStats = visualLatest.stats || {};
  const socialBaseline = baseline.socialMetrics || {};
  const socialLatest = latest.socialMetrics || {};
  const textShuffleLatest = latest.textShuffle || {};
  const observerOwnerMeasurement = readProbeMeasurement(payload, 'observerHub');
  const socialProbeMeasurement = readProbeMeasurement(payload, 'socialMetrics');
  const textShuffleOwnerMeasurement = readProbeMeasurement(payload, 'textShuffle');
  const visualOwnerMeasurement = readProbeMeasurement(payload, 'visual');
  const socialOwnerMeasurement = socialTransitionMeasurement
    && typeof socialTransitionMeasurement === 'object'
    ? {
      state: MEASUREMENT_STATES.has(socialTransitionMeasurement.state)
        ? socialTransitionMeasurement.state
        : 'broken',
      reason: socialTransitionMeasurement.reason || 'social_transition_measurement',
      operationCount: finiteMetric(socialTransitionMeasurement.operationCount),
    }
    : socialProbeMeasurement;
  const socialBaselineStats = socialBaseline.stats || {};
  const socialLatestStats = socialLatest.stats || {};
  const socialBaselineAudit = socialBaselineStats.audit || {};
  const socialLatestAudit = socialLatestStats.audit || {};
  const socialBaselineSelectorDriftRecovery = socialBaselineStats.selectorDriftRecovery || {};
  const socialLatestSelectorDriftRecovery = socialLatestStats.selectorDriftRecovery || {};
  const discoveryBaselineInstrumentation =
    baseline.debugger?.discoveryOwnerLedger?.exactIdentity?.instrumentation || {};
  const discoveryLatestInstrumentation =
    latest.debugger?.discoveryOwnerLedger?.exactIdentity?.instrumentation || {};
  const socialBaselineTimings = socialBaseline.timings || {};
  const socialLatestTimings = socialLatest.timings || {};

  const duplicateScans = monotonicDelta(
    socialLatestAudit.duplicateScans,
    socialBaselineAudit.duplicateScans,
  );
  const duplicateScanEvaluations = monotonicDelta(
    socialLatestAudit.duplicateScanEvaluations,
    socialBaselineAudit.duplicateScanEvaluations,
  );
  const duplicateScanEvidenceUnavailable = monotonicDelta(
    socialLatestAudit.duplicateScanEvidenceUnavailable,
    socialBaselineAudit.duplicateScanEvidenceUnavailable,
  );
  const duplicateScanEvidenceState = typeof socialLatestAudit.duplicateScanEvidenceState === 'string'
    ? socialLatestAudit.duplicateScanEvidenceState
    : null;
  const duplicateScanBaselineEvidenceState = typeof socialBaselineAudit.duplicateScanEvidenceState === 'string'
    ? socialBaselineAudit.duplicateScanEvidenceState
    : null;
  const avoidableFullRescans = monotonicDelta(
    socialLatestAudit.avoidableFullRescans,
    socialBaselineAudit.avoidableFullRescans,
  );
  const avoidableFullRescanEvaluations = monotonicDelta(
    socialLatestAudit.avoidableFullRescanEvaluations,
    socialBaselineAudit.avoidableFullRescanEvaluations,
  );
  const avoidableFullRescanMeasuredExecutions = monotonicDelta(
    socialLatestAudit.avoidableFullRescanMeasuredExecutions,
    socialBaselineAudit.avoidableFullRescanMeasuredExecutions,
  );
  const avoidableFullRescanEvidenceUnavailable = monotonicDelta(
    socialLatestAudit.avoidableFullRescanEvidenceUnavailable,
    socialBaselineAudit.avoidableFullRescanEvidenceUnavailable,
  );
  const avoidableFullRescanEvidenceState = typeof socialLatestAudit.avoidableFullRescanEvidenceState === 'string'
    ? socialLatestAudit.avoidableFullRescanEvidenceState
    : null;
  const avoidableFullRescanBaselineEvidenceState = typeof socialBaselineAudit.avoidableFullRescanEvidenceState === 'string'
    ? socialBaselineAudit.avoidableFullRescanEvidenceState
    : null;
  const selectorHits = monotonicDelta(
    socialLatestAudit.selectorHits,
    socialBaselineAudit.selectorHits,
  );
  const resolvedCandidates = monotonicDelta(
    socialLatestAudit.resolvedCandidates,
    socialBaselineAudit.resolvedCandidates,
  );
  const decisionCount = monotonicDelta(
    socialLatestAudit.decisionCount,
    socialBaselineAudit.decisionCount,
  );
  const appliedDecisionCount = monotonicDelta(
    socialLatestAudit.appliedDecisionCount,
    socialBaselineAudit.appliedDecisionCount,
  );
  const semanticHits = monotonicDelta(
    socialLatestAudit.semanticHits,
    socialBaselineAudit.semanticHits,
  );
  const scanAdmissions = monotonicDelta(
    socialLatestStats.scanAdmissions,
    socialBaselineStats.scanAdmissions,
  );
  const enqueuedScans = monotonicDelta(
    socialLatestStats.enqueuedScans,
    socialBaselineStats.enqueuedScans,
  );
  const mergedScans = monotonicDelta(
    socialLatestStats.mergedScans,
    socialBaselineStats.mergedScans,
  );
  const routedMutationGroups = monotonicDelta(
    socialLatestStats.routedMutationGroups,
    socialBaselineStats.routedMutationGroups,
  );
  const skippedMutationGroups = monotonicDelta(
    socialLatestStats.skippedMutationGroups,
    socialBaselineStats.skippedMutationGroups,
  );
  const selfMutationRecordsConsumed = monotonicDelta(
    socialLatestStats.selfMutationRecordsConsumed,
    socialBaselineStats.selfMutationRecordsConsumed,
  );
  const selectorOnlyHits = monotonicDelta(
    socialLatestAudit.selectorOnlyHits,
    socialBaselineAudit.selectorOnlyHits,
  );
  const semanticOnlyHits = monotonicDelta(
    socialLatestAudit.semanticOnlyHits,
    socialBaselineAudit.semanticOnlyHits,
  );
  const selectorSemanticOverlapHits = monotonicDelta(
    socialLatestAudit.selectorSemanticOverlapHits,
    socialBaselineAudit.selectorSemanticOverlapHits,
  );
  const semanticProvenanceHits = semanticOnlyHits === null
    || selectorSemanticOverlapHits === null
    ? null
    : semanticOnlyHits + selectorSemanticOverlapHits;
  const writeAttempts = monotonicDelta(
    socialLatestAudit.writeAttempts,
    socialBaselineAudit.writeAttempts,
  );
  const actualWrites = monotonicDelta(
    socialLatestAudit.actualWrites,
    socialBaselineAudit.actualWrites,
  );
  const unchangedWriteAttempts = monotonicDelta(
    socialLatestAudit.unchangedWriteAttempts,
    socialBaselineAudit.unchangedWriteAttempts,
  );
  const actualWriteTargetCount = monotonicDelta(
    socialLatestAudit.actualWriteTargetCount,
    socialBaselineAudit.actualWriteTargetCount,
  );
  const applyActualWrites = monotonicDelta(
    socialLatestAudit.applyActualWrites,
    socialBaselineAudit.applyActualWrites,
  );
  const cleanupActualWrites = monotonicDelta(
    socialLatestAudit.cleanupActualWrites,
    socialBaselineAudit.cleanupActualWrites,
  );
  const configurationCleanupActualWrites = monotonicDelta(
    socialLatestAudit.configurationCleanupActualWrites,
    socialBaselineAudit.configurationCleanupActualWrites,
  );
  const appliedTargetDecisionCount = monotonicDelta(
    socialLatestAudit.appliedTargetDecisionCount,
    socialBaselineAudit.appliedTargetDecisionCount,
  );
  const actualWriteDecisions = monotonicDelta(
    socialLatestAudit.actualWriteDecisions,
    socialBaselineAudit.actualWriteDecisions,
  );
  const unchangedNoopDecisions = monotonicDelta(
    socialLatestAudit.unchangedNoopDecisions,
    socialBaselineAudit.unchangedNoopDecisions,
  );
  const noWriteDecisions = monotonicDelta(
    socialLatestAudit.noWriteDecisions,
    socialBaselineAudit.noWriteDecisions,
  );
  const scanOperations = monotonicDelta(
    socialLatestStats.scanOperations,
    socialBaselineStats.scanOperations,
  );
  const completedScanOperations = monotonicDelta(
    socialLatestStats.completedScanOperations,
    socialBaselineStats.completedScanOperations,
  );
  const emptyScanOperations = monotonicDelta(
    socialLatestStats.emptyScanOperations,
    socialBaselineStats.emptyScanOperations,
  );
  const failedScanOperations = monotonicDelta(
    socialLatestStats.failedScanOperations,
    socialBaselineStats.failedScanOperations,
  );
  const cancelledScanOperations = monotonicDelta(
    socialLatestStats.cancelledScanOperations,
    socialBaselineStats.cancelledScanOperations,
  );
  const executedScans = monotonicDelta(
    socialLatestStats.executedScans,
    socialBaselineStats.executedScans,
  );
  const executedFullScans = monotonicDelta(
    socialLatestStats.executedFullScans,
    socialBaselineStats.executedFullScans,
  );
  const executedDirtyScans = monotonicDelta(
    socialLatestStats.executedDirtyScans,
    socialBaselineStats.executedDirtyScans,
  );
  const processedCandidates = monotonicDelta(
    socialLatestStats.processedCandidates,
    socialBaselineStats.processedCandidates,
  );
  const clearedDecisionCount = monotonicDelta(
    socialLatestAudit.clearedDecisionCount,
    socialBaselineAudit.clearedDecisionCount,
  );
  const candidateUnionCollections = monotonicDelta(
    socialLatestAudit.candidateUnionCollections,
    socialBaselineAudit.candidateUnionCollections,
  );
  const selectorCompleteCollections = monotonicDelta(
    socialLatestAudit.selectorCompleteCollections,
    socialBaselineAudit.selectorCompleteCollections,
  );
  const semanticRequiredCollections = monotonicDelta(
    socialLatestAudit.semanticRequiredCollections,
    socialBaselineAudit.semanticRequiredCollections,
  );
  const semanticZeroIncrementCollections = monotonicDelta(
    socialLatestAudit.semanticZeroIncrementCollections,
    socialBaselineAudit.semanticZeroIncrementCollections,
  );
  const selectorDriftRecoveryOperations = monotonicDelta(
    socialLatestSelectorDriftRecovery.operations,
    socialBaselineSelectorDriftRecovery.operations,
  );
  const selectorDriftRecoveryObservedOperations = monotonicDelta(
    socialLatestSelectorDriftRecovery.observedOperations,
    socialBaselineSelectorDriftRecovery.observedOperations,
  );
  const selectorDriftRecoveryIdentityIncompleteOperations = monotonicDelta(
    socialLatestSelectorDriftRecovery.identityIncompleteOperations,
    socialBaselineSelectorDriftRecovery.identityIncompleteOperations,
  );
  const selectorDriftRecoveryDecisions = monotonicDelta(
    socialLatestSelectorDriftRecovery.decisions,
    socialBaselineSelectorDriftRecovery.decisions,
  );
  const selectorDriftRecoveryApplyTargetCount = monotonicDelta(
    socialLatestSelectorDriftRecovery.applyTargetCount,
    socialBaselineSelectorDriftRecovery.applyTargetCount,
  );
  const selectorDriftRecoveryClearTargetCount = monotonicDelta(
    socialLatestSelectorDriftRecovery.clearTargetCount,
    socialBaselineSelectorDriftRecovery.clearTargetCount,
  );
  const selectorDriftRecoveryActualWriteTargetCount = monotonicDelta(
    socialLatestSelectorDriftRecovery.actualWriteTargetCount,
    socialBaselineSelectorDriftRecovery.actualWriteTargetCount,
  );
  const selectorDriftRecoveryUnchangedTargetCount = monotonicDelta(
    socialLatestSelectorDriftRecovery.unchangedTargetCount,
    socialBaselineSelectorDriftRecovery.unchangedTargetCount,
  );
  const applyWriteAttempts = monotonicDelta(
    socialLatestAudit.applyWriteAttempts,
    socialBaselineAudit.applyWriteAttempts,
  );
  const applyUnchangedWriteAttempts = monotonicDelta(
    socialLatestAudit.applyUnchangedWriteAttempts,
    socialBaselineAudit.applyUnchangedWriteAttempts,
  );
  const cleanupWriteAttempts = monotonicDelta(
    socialLatestAudit.cleanupWriteAttempts,
    socialBaselineAudit.cleanupWriteAttempts,
  );
  const cleanupUnchangedWriteAttempts = monotonicDelta(
    socialLatestAudit.cleanupUnchangedWriteAttempts,
    socialBaselineAudit.cleanupUnchangedWriteAttempts,
  );
  const configurationCleanupWriteAttempts = monotonicDelta(
    socialLatestAudit.configurationCleanupWriteAttempts,
    socialBaselineAudit.configurationCleanupWriteAttempts,
  );
  const configurationCleanupUnchangedWriteAttempts = monotonicDelta(
    socialLatestAudit.configurationCleanupUnchangedWriteAttempts,
    socialBaselineAudit.configurationCleanupUnchangedWriteAttempts,
  );
  const workReasonKeys = Array.from(new Set([
    ...Object.keys(socialBaselineStats.workReasonCounts || {}),
    ...Object.keys(socialLatestStats.workReasonCounts || {}),
  ])).sort((left, right) => left.localeCompare(right));
  const workReasons = Object.fromEntries(workReasonKeys.map((reason) => [
    reason,
    monotonicDelta(
      socialLatestStats.workReasonCounts?.[reason] ?? 0,
      socialBaselineStats.workReasonCounts?.[reason] ?? 0,
    ),
  ]));
  const ownedMutationIntegrity = createOwnedMutationIntegrityEvidence(
    socialBaseline,
    socialLatest,
    socialOwnerMeasurement,
  );
  const observerPendingMutations = finiteMetric(observerLatest.pendingMutationCount);
  const pending = {
    observerMutations: observerPendingMutations,
    socialQueue: finiteMetric(socialLatest.queueLength),
    socialDirtyRoots: finiteMetric(socialLatest.pendingMutationRootCount),
    socialOwnedMutations: finiteMetric(socialLatest.pendingOwnedMutationCount),
    socialOwnedMutationOldestAgeMs: finiteMetric(socialLatest.oldestOwnedMutationAgeMs),
    socialTimer: booleanMetric(socialLatest.scanTimerScheduled),
    socialIdle: booleanMetric(socialLatest.idleScheduled),
    socialCurrentScan: currentScanActivity(socialLatest),
    socialForceFullScan: booleanMetric(socialLatest.forceFullScan),
    textPendingNodes: finiteMetric(textShuffleLatest.pendingTextNodeCount),
    textPendingSubtrees: finiteMetric(textShuffleLatest.pendingSubtreeCount),
    textPendingSubtreeTasks: finiteMetric(textShuffleLatest.pendingSubtreeTaskCount),
    textFlushScheduled: booleanMetric(textShuffleLatest.flushScheduled),
    textIdleChunkScheduled: booleanMetric(textShuffleLatest.idleChunkScheduled),
  };
  const efficiencySettle = analyzeDebuggerEfficiencySettle(pending, {
    observerHubMeasurement: observerOwnerMeasurement,
    socialMetricsMeasurement: socialOwnerMeasurement,
    textShuffleMeasurement: textShuffleOwnerMeasurement,
    requireSocialMetrics: requireSocialMetricsSettle,
    requireTextShuffle: textShuffleLatest.active === true,
  });
  efficiencySettle.settledWithOwnedMutationFailOpenEvents = (
    efficiencySettle.settled === true
    && ownedMutationIntegrity.state === 'measured'
    && ownedMutationIntegrity.clean === false
  );
  const observerMeasurement = applyEfficiencySettleToMeasurement(
    observerOwnerMeasurement,
    efficiencySettle.owners.observerHub,
  );
  const socialMeasurement = applyEfficiencySettleToMeasurement(
    socialOwnerMeasurement,
    efficiencySettle.owners.socialMetrics,
  );
  const textShuffleMeasurement = applyEfficiencySettleToMeasurement(
    textShuffleOwnerMeasurement,
    efficiencySettle.owners.textShuffle,
  );
  const identityMeasurement = identityMeasurementState === null
    ? socialMeasurement
    : {
      state: MEASUREMENT_STATES.has(identityMeasurementState)
        ? identityMeasurementState
        : 'broken',
      reason: identityMeasurementState === 'insufficient'
        ? 'identity_cardinality_spans_phase_boundary'
        : 'identity_cardinality_measurement_override',
    };
  const deepProbeCollections = monotonicDelta(
    socialLatestAudit.deepProbeCollections,
    socialBaselineAudit.deepProbeCollections,
  );
  const deepProbeSkippedCollections = monotonicDelta(
    socialLatestAudit.deepProbeSkippedCollections,
    socialBaselineAudit.deepProbeSkippedCollections,
  );
  const selectorProbeQueries = monotonicDelta(
    socialLatestAudit.selectorProbeQueries,
    socialBaselineAudit.selectorProbeQueries,
  );
  const deepAuditState = socialMeasurement.state !== 'measured'
    ? socialMeasurement.state
    : socialLatest.auditMode !== 'deep'
      ? 'inactive'
      : deepProbeCollections === null
        ? 'unavailable'
        : deepProbeCollections > 0 ? 'measured' : 'armed_idle';
  const duplicateScanMeasurement = createScannerEvidenceMeasurement({
    ownerMeasurement: socialMeasurement,
    evidenceState: duplicateScanEvidenceState,
    evaluationCount: duplicateScanEvaluations,
    unavailableCount: duplicateScanEvidenceUnavailable,
    counterValue: duplicateScans,
    prefix: 'duplicate_scan',
  });
  const avoidableFullRescanMeasurement = createScannerEvidenceMeasurement({
    ownerMeasurement: socialMeasurement,
    evidenceState: avoidableFullRescanEvidenceState,
    evaluationCount: avoidableFullRescanEvaluations,
    measuredExecutionCount: avoidableFullRescanMeasuredExecutions,
    unavailableCount: avoidableFullRescanEvidenceUnavailable,
    counterValue: avoidableFullRescans,
    prefix: 'avoidable_full_rescan',
  });
  const observerFlushes = monotonicDelta(observerLatest.flushes, observerBaseline.flushes);
  const observerMutations = monotonicDelta(observerLatest.mutations, observerBaseline.mutations);
  const observerQueueWaitMs = monotonicDelta(
    observerLatest.queueWaitTotalMs,
    observerBaseline.queueWaitTotalMs,
  );
  const subscriberCosts = createSubscriberCallbackCostDeltas(
    observerBaseline,
    observerLatest,
  );
  const subscriberCallbackMs = sumSubscriberCallbackDelta(subscriberCosts);
  const observerAttributeMutationCounts = monotonicCounterRecordDelta(
    observerLatest.attributeMutationCounts,
    observerBaseline.attributeMutationCounts,
    Array.from(new Set([
      ...Object.keys(observerBaseline.attributeMutationCounts || {}),
      ...Object.keys(observerLatest.attributeMutationCounts || {}),
    ])).sort((left, right) => left.localeCompare(right)),
  );
  const visualMediaCounters = monotonicCounterRecordDelta(
    visualLatestStats,
    visualBaselineStats,
    VISUAL_MEDIA_COST_COUNTER_KEYS,
  );
  const dirtyRootTotal = monotonicDelta(
    socialLatestStats.rootTotal,
    socialBaselineStats.rootTotal,
  );
  const zeroCandidateCollections = monotonicDelta(
    socialLatestAudit.zeroCandidateCollections,
    socialBaselineAudit.zeroCandidateCollections,
  );
  const repeatedTargetTouches = monotonicDelta(
    socialLatestAudit.repeatedTargetDecisions,
    socialBaselineAudit.repeatedTargetDecisions,
  );
  const uniqueTargetTouches = monotonicDelta(
    socialLatestAudit.uniqueAppliedTargetDecisions,
    socialBaselineAudit.uniqueAppliedTargetDecisions,
  );
  const postChunkCleanupMs = monotonicDelta(
    socialLatestTimings.cleanupTotalMs,
    socialBaselineTimings.cleanupTotalMs,
  );
  const configurationCleanupMs = monotonicDelta(
    socialLatestTimings.configurationCleanupTotalMs,
    socialBaselineTimings.configurationCleanupTotalMs,
  );
  const scanTotalMs = monotonicDelta(
    socialLatestTimings.scanTotalMs,
    socialBaselineTimings.scanTotalMs,
  );
  const selectorProbeMs = monotonicDelta(
    socialLatestTimings.selectorProbeOverheadTotalMs,
    socialBaselineTimings.selectorProbeOverheadTotalMs,
  );
  const provenanceProbeMs = monotonicDelta(
    socialLatestAudit.provenanceProbeMs,
    socialBaselineAudit.provenanceProbeMs,
  );
  const writeProbeMs = monotonicDelta(
    socialLatestAudit.writeProbeMs,
    socialBaselineAudit.writeProbeMs,
  );
  const scanEvidenceProbeMs = monotonicDelta(
    socialLatestAudit.scanEvidenceProbeMs,
    socialBaselineAudit.scanEvidenceProbeMs,
  );
  const discoveryIdentitySocialRecordOverheadLatest = finiteMetric(
    discoveryLatestInstrumentation.recordOverheadByOwner?.socialMetrics,
  );
  const discoveryIdentitySocialRecordOverheadMs =
    discoveryIdentitySocialRecordOverheadLatest === null
      ? 0
      : monotonicDelta(
        discoveryIdentitySocialRecordOverheadLatest,
        finiteMetric(
          discoveryBaselineInstrumentation.recordOverheadByOwner?.socialMetrics,
        ) ?? 0,
      );
  const discoveryIdentityShortFormRecordOverheadLatest = finiteMetric(
    discoveryLatestInstrumentation.recordOverheadByOwner?.shortForm,
  );
  const discoveryIdentityShortFormRecordOverheadMs =
    discoveryIdentityShortFormRecordOverheadLatest === null
      ? 0
      : monotonicDelta(
        discoveryIdentityShortFormRecordOverheadLatest,
        finiteMetric(
          discoveryBaselineInstrumentation.recordOverheadByOwner?.shortForm,
        ) ?? 0,
      );
  const discoveryIdentityRecordOverheadLatest = finiteMetric(
    discoveryLatestInstrumentation.recordOverheadMs,
  );
  const discoveryIdentityRecordOverheadMs =
    discoveryIdentityRecordOverheadLatest === null
      ? 0
      : monotonicDelta(
        discoveryIdentityRecordOverheadLatest,
        finiteMetric(discoveryBaselineInstrumentation.recordOverheadMs) ?? 0,
      );
  const discoveryIdentitySnapshotReadOverheadLatest = finiteMetric(
    discoveryLatestInstrumentation.snapshotReadOverheadMs,
  );
  const discoveryIdentitySnapshotReadOverheadMs =
    discoveryIdentitySnapshotReadOverheadLatest === null
      ? 0
      : monotonicDelta(
        discoveryIdentitySnapshotReadOverheadLatest,
        finiteMetric(discoveryBaselineInstrumentation.snapshotReadOverheadMs) ?? 0,
      );
  const instrumentedElapsedMs = sumMeasuredMetrics(
    scanTotalMs,
    configurationCleanupMs,
  );
  const knownInPathDebuggerOverheadMs = sumMeasuredMetrics(
    selectorProbeMs,
    provenanceProbeMs,
    writeProbeMs,
    scanEvidenceProbeMs,
    discoveryIdentitySocialRecordOverheadMs,
  );
  const estimatedProductElapsedMs = subtractMeasuredMetrics(
    instrumentedElapsedMs,
    knownInPathDebuggerOverheadMs,
  );
  const timingEvidence = {
    queueWaitMs: monotonicDelta(
      socialLatestTimings.queueWaitTotalMs,
      socialBaselineTimings.queueWaitTotalMs,
    ),
    selectorMs: monotonicDelta(
      socialLatestTimings.selectorQueryTotalMs,
      socialBaselineTimings.selectorQueryTotalMs,
    ),
    semanticMs: monotonicDelta(
      socialLatestTimings.semanticQueryTotalMs,
      socialBaselineTimings.semanticQueryTotalMs,
    ),
    idleMs: monotonicDelta(
      socialLatestTimings.idleWaitTotalMs,
      socialBaselineTimings.idleWaitTotalMs,
    ),
    chunkMs: monotonicDelta(
      socialLatestTimings.chunkTotalMs,
      socialBaselineTimings.chunkTotalMs,
    ),
    applyMs: monotonicDelta(
      socialLatestTimings.applyTotalMs,
      socialBaselineTimings.applyTotalMs,
    ),
    cleanupMs: sumMeasuredMetrics(postChunkCleanupMs, configurationCleanupMs),
    postChunkCleanupMs,
    configurationCleanupMs,
    ownedMutationRecordProductMs: monotonicDelta(
      socialLatestAudit.ownedMutationRecordProductMs,
      socialBaselineAudit.ownedMutationRecordProductMs,
    ),
    ownedMutationFilterProductMs: monotonicDelta(
      socialLatestAudit.ownedMutationFilterProductMs,
      socialBaselineAudit.ownedMutationFilterProductMs,
    ),
    totalMs: instrumentedElapsedMs,
    instrumentedElapsedMs,
    knownInPathDebuggerOverheadMs,
    estimatedProductElapsedMs,
    discoveryIdentityRecordOverheadMs,
    discoveryIdentitySocialRecordOverheadMs,
    discoveryIdentityShortFormRecordOverheadMs,
  };
  const overheadEvidence = {
    snapshotReadMs: monotonicDelta(
      observerLatest.debugSnapshotReadTotalMs,
      observerBaseline.debugSnapshotReadTotalMs,
    ),
    snapshotReadCount: monotonicDelta(
      observerLatest.debugSnapshotReadCount,
      observerBaseline.debugSnapshotReadCount,
    ),
    observerBookkeepingMs: monotonicDelta(
      observerLatest.debugFlushOverheadTotalMs,
      observerBaseline.debugFlushOverheadTotalMs,
    ),
    observerBookkeepingCount: monotonicDelta(
      observerLatest.debugFlushOverheadCount,
      observerBaseline.debugFlushOverheadCount,
    ),
    selectorProbeMs,
    provenanceProbeMs,
    writeProbeMs,
    scanEvidenceProbeMs,
    discoveryIdentity: {
      recordOverheadMs: discoveryIdentityRecordOverheadMs,
      socialMetricsRecordOverheadMs: discoveryIdentitySocialRecordOverheadMs,
      shortFormRecordOverheadMs: discoveryIdentityShortFormRecordOverheadMs,
      snapshotReadOverheadMs: discoveryIdentitySnapshotReadOverheadMs,
      recordCallCount: finiteMetric(discoveryLatestInstrumentation.recordCallCount),
      snapshotReadCount: finiteMetric(discoveryLatestInstrumentation.snapshotReadCount),
    },
    deepAudit: {
      state: deepAuditState,
      mode: typeof socialLatest.auditMode === 'string' ? socialLatest.auditMode : null,
      enabled: booleanMetric(socialLatestAudit.enabled),
      collections: deepProbeCollections,
      skippedCollections: deepProbeSkippedCollections,
      selectorProbeQueries,
    },
  };
  const scannerConservationCounters = {
    scanAdmissions,
    enqueuedScans,
    mergedScans,
    executedScans,
    executedFullScans,
    executedDirtyScans,
    scanOperations,
    completedScanOperations,
    emptyScanOperations,
    failedScanOperations,
    cancelledScanOperations,
    resolvedCandidates,
    selectorOnlyHits,
    semanticOnlyHits,
    selectorSemanticOverlapHits,
    processedCandidates,
    decisionCount,
    clearedDecisionCount,
    appliedDecisionCount,
    appliedTargetDecisionCount,
    uniqueAppliedTargetDecisions: uniqueTargetTouches,
    repeatedTargetDecisions: repeatedTargetTouches,
    writeAttempts,
    actualWrites,
    unchangedWriteAttempts,
    applyActualWrites,
    cleanupActualWrites,
    configurationCleanupActualWrites,
    actualWriteDecisions,
    unchangedNoopDecisions,
    noWriteDecisions,
    relevantMutationScans: workReasons.relevant_mutation,
    activationConfigurationTransitionScans:
      workReasons.activation_configuration_transition,
    directOwnerRequestScans: workReasons.direct_owner_request,
    scheduledFullScopeScans: workReasons.scheduled_full_scope,
    unknownWorkReasonScans: workReasons.unknown,
    candidateUnionCollections,
    selectorCompleteCollections,
    semanticRequiredCollections,
    selectorDriftRecoveryOperations,
    selectorDriftRecoveryObservedOperations,
    selectorDriftRecoveryDecisions,
    selectorDriftRecoveryApplyTargetCount,
    applyWriteAttempts,
    cleanupWriteAttempts,
    configurationCleanupWriteAttempts,
    applyUnchangedWriteAttempts,
    cleanupUnchangedWriteAttempts,
    configurationCleanupUnchangedWriteAttempts,
  };
  const scannerStructuralAudit = analyzeRuntimeDebuggerScannerEfficiency({
    duplicateScans,
    avoidableFullRescans,
    measurementStates: {
      duplicateScans: duplicateScanMeasurement,
      avoidableFullRescans: avoidableFullRescanMeasurement,
    },
  });
  const scannerConservationAudit = analyzeRuntimeDebuggerScannerConservation({
    measurementState: socialMeasurement.state,
    counters: scannerConservationCounters,
  });
  const workLedger = createRuntimeDebuggerScannerWorkLedger({
    phase,
    measurementState: socialMeasurement.state,
    identityMeasurementState: identityMeasurement.state,
    identityScope,
    settled: efficiencySettle.settled,
    workload: {
      observer: {
        flushes: observerFlushes,
        mutations: observerMutations,
        queueWaitMs: observerQueueWaitMs,
        subscriberCallbackMs,
      },
      routing: {
        admissions: scanAdmissions,
        enqueued: enqueuedScans,
        merged: mergedScans,
        routedMutationGroups,
        skippedMutationGroups,
        dirtyRootTotal,
        executedFullScans,
        executedDirtyScans,
      },
      discovery: {
        selectorHits,
        selectorOnlyHits,
        semanticOnlyHits,
        selectorSemanticOverlapHits,
        resolvedCandidates,
        candidateDecisions: decisionCount,
        nonClearCandidateDecisions: appliedDecisionCount,
        semanticCandidates: semanticHits,
        uniqueTargetTouches,
        repeatedTargetTouches,
        zeroCandidateCollections,
      },
      effect: {
        writeAttempts,
        physicalWrites: actualWrites,
        unchangedWriteAttempts,
        applyWriteAttempts,
        applyUnchangedWriteAttempts,
        postChunkCleanupWriteAttempts: cleanupWriteAttempts,
        postChunkCleanupUnchangedWriteAttempts: cleanupUnchangedWriteAttempts,
        configurationCleanupWriteAttempts,
        configurationCleanupUnchangedWriteAttempts,
        applyWrites: applyActualWrites,
        postChunkCleanupWrites: cleanupActualWrites,
        configurationCleanupWrites: configurationCleanupActualWrites,
        actualWriteDecisions,
        unchangedNoopDecisions,
        noWriteDecisions,
      },
      timings: timingEvidence,
      overhead: overheadEvidence,
      workReasons,
    },
  });

  return {
    measurementStates: {
      efficiency: efficiencySettle,
      observerHub: observerMeasurement,
      socialMetrics: socialMeasurement,
      textShuffle: textShuffleMeasurement,
      visualMedia: visualOwnerMeasurement,
      identityCardinality: identityMeasurement,
      duplicateScans: duplicateScanMeasurement,
      avoidableFullRescans: avoidableFullRescanMeasurement,
      observerPendingMutations: createMetricMeasurement(
        observerPendingMutations,
        observerMeasurement,
        'observer_pending_mutation_depth_not_exposed',
      ),
    },
    scannerStructuralAudit,
    scannerConservationAudit,
    workLedger,
    discoveryOwnerLedger: payload?.latest?.debugger?.discoveryOwnerLedger || null,
    identityCardinality: {
      state: identityMeasurement.state,
      reason: identityMeasurement.reason,
      scope: identityScope,
      repeatedTargetTouches,
      uniqueTargetTouches,
      uniquePhysicalWriteTargets: actualWriteTargetCount,
    },
    duplicateScans,
    avoidableFullRescans,
    duplicateScanEvidence: {
      state: duplicateScanMeasurement.state,
      baselineEvidenceState: duplicateScanBaselineEvidenceState,
      latestEvidenceState: duplicateScanEvidenceState,
      evaluations: duplicateScanEvaluations,
      unavailableEvaluations: duplicateScanEvidenceUnavailable,
    },
    avoidableFullRescanEvidence: {
      state: avoidableFullRescanMeasurement.state,
      baselineEvidenceState: avoidableFullRescanBaselineEvidenceState,
      latestEvidenceState: avoidableFullRescanEvidenceState,
      evaluations: avoidableFullRescanEvaluations,
      measuredExecutions: avoidableFullRescanMeasuredExecutions,
      unavailableEvaluations: avoidableFullRescanEvidenceUnavailable,
    },
    scanShape: {
      admittedFullScans: monotonicDelta(
        socialLatestStats.admittedFullScans,
        socialBaselineStats.admittedFullScans,
      ),
      admittedDirtyScans: monotonicDelta(
        socialLatestStats.admittedDirtyScans,
        socialBaselineStats.admittedDirtyScans,
      ),
      executedFullScans,
      executedDirtyScans,
      executedScans,
      operations: scanOperations,
      completedOperations: completedScanOperations,
      emptyOperations: emptyScanOperations,
      failedOperations: failedScanOperations,
      cancelledOperations: cancelledScanOperations,
    },
    queuedScans: monotonicDelta(socialLatestStats.queuedScans, socialBaselineStats.queuedScans),
    skippedIrrelevantScans: monotonicDelta(
      socialLatestStats.skippedIrrelevantScans,
      socialBaselineStats.skippedIrrelevantScans,
    ),
    scanRouting: {
      admissions: scanAdmissions,
      enqueued: enqueuedScans,
      merged: mergedScans,
      routedMutationGroups,
      skippedMutationGroups,
      mutationRuleSkips: monotonicDelta(
        socialLatestStats.routedRuleSkips,
        socialBaselineStats.routedRuleSkips,
      ),
      hostRootRelevanceSkips: monotonicDelta(
        socialLatestStats.hostRootRelevanceSkips,
        socialBaselineStats.hostRootRelevanceSkips,
      ),
      selfMutationRecordsConsumed,
      enqueueShare: createRatioEvidence(
        enqueuedScans,
        scanAdmissions,
        socialMeasurement,
      ),
      mergeShare: createRatioEvidence(
        mergedScans,
        scanAdmissions,
        socialMeasurement,
      ),
    },
    dirtyRootBreadth: {
      schedules: monotonicDelta(
        socialLatestStats.mutationSchedules,
        socialBaselineStats.mutationSchedules,
      ),
      total: dirtyRootTotal,
      selectorTotal: monotonicDelta(
        socialLatestStats.selectorRootTotal,
        socialBaselineStats.selectorRootTotal,
      ),
      semanticTotal: monotonicDelta(
        socialLatestStats.semanticRootTotal,
        socialBaselineStats.semanticRootTotal,
      ),
      last: finiteMetric(socialLatestStats.lastMutationRootCount),
      max: finiteMetric(socialLatestStats.maxMutationRootCount),
      endpointMaxScope: 'owner_lifetime_endpoint_not_phase_delta',
    },
    observer: {
      flushes: observerFlushes,
      mutations: observerMutations,
      flushDurationMs: monotonicDelta(
        observerLatest.flushDurationTotalMs,
        observerBaseline.flushDurationTotalMs,
      ),
      flushShape: {
        attributeOnly: monotonicDelta(
          observerLatest.attributeOnlyFlushes,
          observerBaseline.attributeOnlyFlushes,
        ),
        childOnly: monotonicDelta(
          observerLatest.childOnlyFlushes,
          observerBaseline.childOnlyFlushes,
        ),
        mixed: monotonicDelta(observerLatest.mixedFlushes, observerBaseline.mixedFlushes),
        tiny: monotonicDelta(observerLatest.tinyFlushes, observerBaseline.tinyFlushes),
      },
      queueWaitMs: observerQueueWaitMs,
      queueWaitMaxMs: finiteMetric(observerLatest.queueWaitMaxMs),
      queueWaitMaxScope: 'owner_lifetime_endpoint_not_phase_delta',
      subscriberCallbackMs,
      subscriberCosts,
      attributeMutationCounts: observerAttributeMutationCounts,
    },
    visualMedia: {
      state: visualOwnerMeasurement.state,
      reason: visualOwnerMeasurement.reason,
      active: booleanMetric(visualLatest.active),
      observerAttached: booleanMetric(visualLatest.observerAttached),
      trackedTargetCount: finiteMetric(visualLatest.trackedTargetCount),
      pendingRecheckCount: finiteMetric(visualLatest.pendingRecheckCount),
      ...visualMediaCounters,
      totalMs: monotonicDelta(visualLatestStats.totalMs, visualBaselineStats.totalMs),
      debugOverheadMs: monotonicDelta(
        visualLatestStats.debugOverheadMs,
        visualBaselineStats.debugOverheadMs,
      ),
    },
    ratios: {
      selectorHits,
      resolvedCandidates,
      candidateDecisions: decisionCount,
      nonClearCandidateDecisions: appliedDecisionCount,
      semanticCandidates: semanticHits,
      selectorToResolved: createRatioEvidence(
        resolvedCandidates,
        selectorHits,
        socialMeasurement,
      ),
      resolvedToNonClearDecision: createRatioEvidence(
        appliedDecisionCount,
        resolvedCandidates,
        socialMeasurement,
      ),
      candidateDecisionToNonClear: createRatioEvidence(
        appliedDecisionCount,
        decisionCount,
        socialMeasurement,
      ),
      semanticShare: createRatioEvidence(
        semanticHits,
        resolvedCandidates,
        socialMeasurement,
      ),
    },
    provenance: {
      selectorOnlyHits,
      semanticOnlyHits,
      selectorSemanticOverlapHits,
      candidateUnionCollections,
      selectorCompleteCollections,
      semanticRequiredCollections,
      semanticZeroIncrementCollections,
      semanticIncrementalYield: createRatioEvidence(
        semanticOnlyHits,
        semanticProvenanceHits,
        socialMeasurement,
      ),
      selectorDriftRecovery: (() => {
        const siteId = socialLatest.targetingHealth?.siteId || null;
        let state = 'not_applicable';
        if (siteId === 'youtube') {
          if (
            selectorDriftRecoveryOperations === null
            || selectorDriftRecoveryObservedOperations === null
            || selectorDriftRecoveryIdentityIncompleteOperations === null
            || selectorDriftRecoveryDecisions === null
            || selectorDriftRecoveryApplyTargetCount === null
            || selectorDriftRecoveryClearTargetCount === null
            || selectorDriftRecoveryActualWriteTargetCount === null
            || selectorDriftRecoveryUnchangedTargetCount === null
          ) state = 'unavailable';
          else if (selectorDriftRecoveryIdentityIncompleteOperations > 0) {
            state = 'broken';
          } else if (
            selectorDriftRecoveryObservedOperations > 0
            && selectorDriftRecoveryApplyTargetCount > 0
            && selectorDriftRecoveryActualWriteTargetCount > 0
          ) state = 'recovered';
          else if (selectorDriftRecoveryDecisions > 0) state = 'no_effect_applied';
          else state = 'not_observed';
        }
        return {
          state,
          siteId,
          operationCount: selectorDriftRecoveryOperations,
          observedOperationCount: selectorDriftRecoveryObservedOperations,
          identityIncompleteOperationCount:
            selectorDriftRecoveryIdentityIncompleteOperations,
          decisionCount: selectorDriftRecoveryDecisions,
          applyTargetCount: selectorDriftRecoveryApplyTargetCount,
          clearTargetCount: selectorDriftRecoveryClearTargetCount,
          actualWriteTargetCount: selectorDriftRecoveryActualWriteTargetCount,
          unchangedTargetCount: selectorDriftRecoveryUnchangedTargetCount,
          effectOwner: 'social_metrics_owned_mutation_ledger',
          runtimeSelectorGenerated: false,
          canonicalProfileWritten: false,
        };
      })(),
    },
    writes: {
      nonClearCandidateDecisions: appliedDecisionCount,
      writeAttempts,
      allPhysicalWritesIncludingCleanup: actualWrites,
      unchangedWriteAttempts,
      applyWriteAttempts,
      applyUnchangedWriteAttempts,
      postChunkCleanupWriteAttempts: cleanupWriteAttempts,
      postChunkCleanupUnchangedWriteAttempts: cleanupUnchangedWriteAttempts,
      configurationCleanupWriteAttempts,
      configurationCleanupUnchangedWriteAttempts,
      actualWriteTargetCount,
      actualWriteTargetIdentityScope: identityScope,
      applyPhysicalWrites: applyActualWrites,
      postChunkCleanupPhysicalWrites: cleanupActualWrites,
      configurationCleanupPhysicalWrites: configurationCleanupActualWrites,
      nonClearTargetTouches: appliedTargetDecisionCount,
      actualWriteDecisions,
      unchangedNoopDecisions,
      noWriteDecisions,
      allWritesPerNonClearCandidateDecision: createRatioEvidence(
        actualWrites,
        appliedDecisionCount,
        socialMeasurement,
      ),
      applyWritesPerNonClearCandidateDecision: createRatioEvidence(
        applyActualWrites,
        appliedDecisionCount,
        socialMeasurement,
      ),
      allWritesPerNonClearTargetTouch: createRatioEvidence(
        actualWrites,
        appliedTargetDecisionCount,
        socialMeasurement,
      ),
      actualWriteRate: createRatioEvidence(
        actualWrites,
        writeAttempts,
        socialMeasurement,
      ),
      unchangedWriteRate: createRatioEvidence(
        unchangedWriteAttempts,
        writeAttempts,
        socialMeasurement,
      ),
    },
    zeroCandidateCollections,
    repeatedTargetTouches,
    uniqueTargetTouches,
    nonClearTargetTouchCount: appliedTargetDecisionCount,
    repeatedTargetTouchShare: createRatioEvidence(
      repeatedTargetTouches,
      appliedTargetDecisionCount,
      identityMeasurement,
    ),
    timings: timingEvidence,
    ownedMutationIntegrity,
    pending,
    overhead: overheadEvidence,
  };
}

function compareTargetingStyleSamples(
  activeSamples = [],
  comparisonSamples = [],
  styleProperties = [],
) {
  const comparisonByKey = new Map(
    (Array.isArray(comparisonSamples) ? comparisonSamples : [])
      .map((sample) => [sample?.key, sample]),
  );
  const matched = (Array.isArray(activeSamples) ? activeSamples : []).flatMap((sample) => {
    const comparison = comparisonByKey.get(sample?.key);
    if (!comparison) return [];
    const changedProperties = styleProperties.filter((property) => (
      sample?.style?.[property] !== undefined
      && comparison?.style?.[property] !== undefined
      && sample.style[property] !== comparison.style[property]
    ));
    return [{
      key: sample.key,
      changed: changedProperties.length > 0,
      changedProperties,
    }];
  });
  return {
    matchedSampleCount: matched.length,
    changedSampleCount: matched.filter((sample) => sample.changed).length,
    unchangedSampleCount: matched.filter((sample) => !sample.changed).length,
    changedPropertyCounts: Object.fromEntries(styleProperties.map((property) => [
      property,
      matched.filter((sample) => sample.changedProperties.includes(property)).length,
    ])),
  };
}

function analyzeTargetingOracle({
  activeObservation,
  disabledObservation,
  reenabledObservation,
  activationState,
}) {
  const activeTargeting = activeObservation?.targeting;
  if (!activeTargeting || typeof activeTargeting !== 'object') return null;
  const styleProperties = Array.isArray(activeTargeting.styleProperties)
    ? activeTargeting.styleProperties
    : [];
  const positive = compareTargetingStyleSamples(
    activeTargeting.positiveSamples,
    disabledObservation?.targeting?.positiveSamples,
    styleProperties,
  );
  const negative = compareTargetingStyleSamples(
    activeTargeting.negativeSamples,
    disabledObservation?.targeting?.negativeSamples,
    styleProperties,
  );
  const reenabledNegative = compareTargetingStyleSamples(
    reenabledObservation?.targeting?.negativeSamples,
    disabledObservation?.targeting?.negativeSamples,
    styleProperties,
  );
  const reenabledPositive = compareTargetingStyleSamples(
    reenabledObservation?.targeting?.positiveSamples,
    disabledObservation?.targeting?.positiveSamples,
    styleProperties,
  );
  const activeTargetingMeasurable = activationState === 'measured';
  const positiveStatus = positive.matchedSampleCount === 0
    ? 'WARN'
    : positive.unchangedSampleCount === 0
      ? 'PASS'
      : activeTargetingMeasurable ? 'FAIL' : 'WARN';
  const negativeControlRequired = activeTargeting.negativeControlRequired !== false;
  const negativeStatus = !negativeControlRequired
    ? 'PASS'
    : (
      negative.matchedSampleCount === 0
      || reenabledNegative.matchedSampleCount === 0
    )
    ? 'WARN'
    : (
      negative.changedSampleCount === 0
      && reenabledNegative.changedSampleCount === 0
    ) ? 'PASS' : 'FAIL';
  const reenabledStatus = reenabledPositive.matchedSampleCount === 0
    ? 'WARN'
    : reenabledPositive.unchangedSampleCount === 0 ? 'PASS' : 'FAIL';
  return {
    styleProperties,
    positive,
    negative,
    reenabledNegative,
    negativeControlRequired,
    reenabledPositive,
    contracts: [
      createContract(
        'targeting_positive_style_coverage',
        positiveStatus,
        {
          ...positive,
          activationState,
          measurementState: positive.matchedSampleCount > 0
            ? (
              positive.changedSampleCount > 0 || activeTargetingMeasurable
                ? 'measured'
                : activationState
            )
            : 'insufficient',
        },
      ),
      createContract(
        'targeting_negative_controls_unchanged',
        negativeStatus,
        {
          ...negative,
          reenabledComparison: reenabledNegative,
          measurementState: !negativeControlRequired
            ? 'not_applicable'
            : (
              negative.matchedSampleCount > 0
              && reenabledNegative.matchedSampleCount > 0
            )
            ? 'measured'
            : 'insufficient',
        },
      ),
      createContract(
        'targeting_reenable_positive_style_coverage',
        reenabledStatus,
        {
          ...reenabledPositive,
          measurementState: reenabledPositive.matchedSampleCount > 0
            ? 'measured'
            : 'insufficient',
        },
      ),
    ],
  };
}

export function analyzeObservableEffect({
  activeObservation = null,
  disabledObservation = null,
  reenabledObservation = null,
  activationState = 'measured',
  disablePropagation = null,
} = {}) {
  const candidateCount = Number(activeObservation?.candidateCount) || 0;
  const appliedTargetCount = Number(activeObservation?.appliedTargetCount) || 0;
  const activeRootSignals = Number(activeObservation?.activeRootSignalCount) || 0;
  const disabledApplied = Number(disabledObservation?.appliedTargetCount) || 0;
  const disabledRootSignals = Number(disabledObservation?.activeRootSignalCount) || 0;
  const disabledCleanupApplied = Number(
    disabledObservation?.disableCleanupAppliedTargetCount
      ?? disabledObservation?.appliedTargetCount,
  ) || 0;
  const disabledCleanupRootSignals = Number(
    disabledObservation?.disableCleanupRootSignalCount
      ?? disabledObservation?.activeRootSignalCount,
  ) || 0;
  const reenabledApplied = Number(reenabledObservation?.appliedTargetCount) || 0;
  const reenabledRootSignals = Number(reenabledObservation?.activeRootSignalCount) || 0;
  const targeting = analyzeTargetingOracle({
    activeObservation,
    disabledObservation,
    reenabledObservation,
    activationState,
  });
  const layoutCycleObserved = [
    activeObservation,
    disabledObservation,
    reenabledObservation,
  ].some((observation) => (
    observation?.layoutCycle !== null
    && observation?.layoutCycle !== undefined
  ));
  const layoutCycle = layoutCycleObserved
    ? analyzeLayoutCycleOracle({
      activeObservation,
      disabledObservation,
      reenabledObservation,
    })
    : null;
  const styleKeys = ['letterSpacing', 'filter', 'opacity', 'visibility', 'display'];
  const styleChanged = styleKeys.some((key) => (
    activeObservation?.candidateStyle?.[key] !== undefined
    && disabledObservation?.candidateStyle?.[key] !== undefined
    && activeObservation.candidateStyle[key] !== disabledObservation.candidateStyle[key]
  )) || Number(targeting?.positive?.changedSampleCount) > 0;
  const reenabledStyleChanged = styleKeys.some((key) => (
    reenabledObservation?.candidateStyle?.[key] !== undefined
    && disabledObservation?.candidateStyle?.[key] !== undefined
    && reenabledObservation.candidateStyle[key] !== disabledObservation.candidateStyle[key]
  )) || Number(targeting?.reenabledPositive?.changedSampleCount) > 0;
  const activeEffectObserved = appliedTargetCount > 0 || styleChanged;
  const disablePropagationState = disablePropagation?.state || 'measured';
  const cleanupEvidenceAvailable = disabledObservation !== null
    && ['measured', 'not_required'].includes(disablePropagationState);
  const cleanupPassed = cleanupEvidenceAvailable
    && disabledCleanupApplied === 0
    && disabledCleanupRootSignals === 0
    && (Number(disabledObservation?.settleSelectorCount) || 0) === 0;
  const reenabled = reenabledApplied > 0 || reenabledStyleChanged;
  let status = 'unavailable';
  if (activeEffectObserved) status = 'measured';
  else if (activationState !== 'measured' && MEASUREMENT_STATES.has(activationState)) {
    status = activationState;
  }
  else if (activeRootSignals > 0) status = 'armed_idle';
  else if (candidateCount > 0) status = 'broken';
  else if (activeObservation?.readinessSatisfied === true) status = 'insufficient';
  const effectContractStatus = status === 'measured'
    ? 'PASS'
    : status === 'broken' ? 'FAIL' : 'WARN';
  const reenableContractStatus = reenabled
    ? 'PASS'
    : (status === 'measured' || status === 'broken') ? 'FAIL' : 'WARN';
  return {
    status,
    candidateCount,
    appliedTargetCount,
    appliedHiddenCount: Number(activeObservation?.appliedHiddenCount) || 0,
    activeRootSignalCount: activeRootSignals,
    styleChanged,
    cleanupState: cleanupPassed
      ? 'measured'
      : cleanupEvidenceAvailable ? 'broken' : disablePropagationState,
    disableScope: disabledObservation?.disableCleanupScope || 'user_settings',
    fullRuntimeCleanupState: 'not_requested',
    reenabled,
    targeting,
    layoutCycle,
    contracts: [
      createContract(
        'observable_effect_applied',
        effectContractStatus,
        {
          candidateCount,
          appliedTargetCount,
          appliedHiddenCount: Number(activeObservation?.appliedHiddenCount) || 0,
          activeRootSignals,
          styleChanged,
        },
      ),
      createContract(
        'user_settings_disable_cleanup_complete',
        cleanupPassed ? 'PASS' : cleanupEvidenceAvailable ? 'FAIL' : 'WARN',
        {
          disableScope: disabledObservation?.disableCleanupScope || 'user_settings',
          fullRuntimeCleanupRequested: false,
          propagation: disablePropagation || { state: 'measured', reason: 'assumed_by_caller' },
          disabledApplied,
          disabledRootSignals,
          scopedCleanupApplied: disabledCleanupApplied,
          scopedCleanupRootSignals: disabledCleanupRootSignals,
          disabledSettleSelectors: Number(disabledObservation?.settleSelectorCount) || 0,
        },
      ),
      createContract(
        'reenable_effect_applied',
        reenableContractStatus,
        { reenabledApplied, reenabledRootSignals, reenabledStyleChanged },
      ),
      ...(targeting?.contracts || []),
      ...(layoutCycle === null ? [] : layoutCycle.contracts),
    ],
  };
}

export function analyzeUserSettingsDisableActivation(runtime = null, {
  propagation = null,
} = {}) {
  const activeFilterKeys = Array.isArray(runtime?.activeFilterKeys)
    ? [...runtime.activeFilterKeys]
    : [];
  const featureStates = runtime?.featureStates;
  const propagationState = propagation?.state || 'measured';
  const propagationCompleted = ['measured', 'not_required'].includes(propagationState);
  if (!runtime || !featureStates || typeof featureStates !== 'object') {
    return {
      state: propagationCompleted ? 'unavailable' : propagationState,
      sourceState: 'unavailable',
      propagationState,
      activeFilterKeys,
      runtimeArtifactActiveKeys: [],
      userSettingsOwnedActiveKeys: [],
      featureStates: null,
    };
  }
  const runtimeArtifactActiveKeys = activeFilterKeys.filter(
    (filterKey) => featureStates?.[filterKey]?.source === 'runtime_artifact',
  );
  const userSettingsOwnedActiveKeys = activeFilterKeys.filter(
    (filterKey) => featureStates?.[filterKey]?.source !== 'runtime_artifact',
  );
  const sourceState = userSettingsOwnedActiveKeys.length === 0 ? 'measured' : 'broken';
  return {
    state: propagationCompleted ? sourceState : propagationState,
    sourceState,
    propagationState,
    activeFilterKeys,
    runtimeArtifactActiveKeys,
    userSettingsOwnedActiveKeys,
    featureStates,
  };
}

export function classifySiteRun({
  blocker = null,
  contracts = [],
  performanceStatus = 'WARN',
} = {}) {
  if (blocker?.classification) {
    return {
      outcome: SITE_RUN_OUTCOMES.INCONCLUSIVE,
      classification: blocker.classification,
    };
  }
  const contractOutcomes = contracts.map((contract) => {
    if (contract.status === 'FAIL') return SITE_RUN_OUTCOMES.FAIL;
    if (contract.status === 'WARN') return SITE_RUN_OUTCOMES.WARN;
    return SITE_RUN_OUTCOMES.PASS;
  });
  const outcome = combineSiteRunOutcomes([
    ...contractOutcomes,
    performanceStatus === 'FAIL'
      ? SITE_RUN_OUTCOMES.FAIL
      : performanceStatus === 'WARN' ? SITE_RUN_OUTCOMES.WARN : SITE_RUN_OUTCOMES.PASS,
  ]);
  return { outcome, classification: null };
}

export function createRootVisualContinuityContracts(actionResults = []) {
  return (Array.isArray(actionResults) ? actionResults : [])
    .filter((result) => result?.kind === 'root_visual_continuity_probe')
    .map((result, index) => {
      const probeId = typeof result.probeId === 'string' && result.probeId
        ? result.probeId
        : `probe-${index + 1}`;
      if (result.status !== 'performed') {
        return createContract(
          `root_visual_continuity:${probeId}`,
          'WARN',
          {
            status: result.status || 'unavailable',
            reason: result.reason || null,
          },
          'The bounded same-document compositor probe did not produce enough valid evidence.',
        );
      }
      const expectedStrength = Number(result.expectedGrayscaleStrength);
      const minimumObservedStrength = Number(
        result.documentFrames?.minimumObservedStrength,
      );
      const maximumObservedChromaRatio = Number(
        result.compositor?.maximumObservedChromaRatio,
      );
      const maximumAllowedChromaRatio = Number(
        result.compositor?.maximumAllowedChromaRatio,
      );
      const documentFrameCount = Number(result.documentFrames?.frameCount);
      const compositorFrameCount = Number(result.compositor?.frameCount);
      const passed = (
        result.continuityHeld === true
        && result.trustedInput === true
        && result.sameDocument === true
        && result.routeReached === true
        && Number.isFinite(expectedStrength)
        && Number.isFinite(minimumObservedStrength)
        && minimumObservedStrength + 0.0005 >= expectedStrength
        && result.documentFrames?.belowStrengthFrameCount === 0
        && result.documentFrames?.missingFilterFrameCount === 0
        && Number.isFinite(documentFrameCount)
        && documentFrameCount >= Number(result.minimumAnimationFrameCount)
        && result.compositor?.invalidSignatureFrameCount === 0
        && result.compositor?.aboveChromaFrameCount === 0
        && Number.isFinite(maximumObservedChromaRatio)
        && Number.isFinite(maximumAllowedChromaRatio)
        && maximumObservedChromaRatio <= maximumAllowedChromaRatio
        && Number.isFinite(compositorFrameCount)
        && compositorFrameCount >= Number(result.minimumCompositorFrameCount)
        && result.compositor?.persistedFrameCount === 0
      );
      return createContract(
        `root_visual_continuity:${probeId}`,
        passed ? 'PASS' : 'FAIL',
        {
          trustedInput: result.trustedInput === true,
          sameDocument: result.sameDocument === true,
          routeReached: result.routeReached === true,
          expectedStrength,
          documentFrames: result.documentFrames || null,
          compositor: result.compositor || null,
        },
        passed
          ? null
          : 'At least one document or compositor frame fell below the declared grayscale floor.',
      );
    });
}

export function partitionPageRuntimeErrors(errors = [], policy = null) {
  const normalizedErrors = Array.isArray(errors) ? errors : [];
  const advisorySources = new Set(
    Array.isArray(policy?.advisorySources) ? policy.advisorySources : [],
  );
  return normalizedErrors.reduce((partition, error) => {
    const destination = advisorySources.has(error?.source)
      ? partition.advisory
      : partition.blocking;
    destination.push(error);
    return partition;
  }, { advisory: [], blocking: [] });
}

export function createPageRuntimeErrorContracts(errors, policy = null) {
  const { blocking, advisory } = partitionPageRuntimeErrors(errors, policy);
  const network = blocking.filter((entry) => entry.source === 'network');
  const runtime = blocking.filter((entry) => entry.source !== 'network');
  return [
    { id: 'page_uncaught_errors_absent', status: 'WARN', entries: runtime },
    { id: 'page_network_errors_absent', status: 'WARN', entries: network },
    { id: 'page_runtime_advisory_errors_classified', status: 'PASS', entries: advisory },
  ].filter(({ entries }) => entries.length > 0).map(({ id, status, entries }) => ({
    id, status,
    evidence: {
      count: entries.length,
      sources: [...new Set(entries.map((entry) => entry.source))].sort(),
      kinds: [...new Set(entries.map((entry) => entry.kind))].sort(),
    },
  }));
}

export function classifyRequiredScenarioActionBlocker(actionResults = []) {
  const unavailable = (Array.isArray(actionResults) ? actionResults : []).find((result) => (
    result?.requiredForEvaluation === true
    && result?.status !== 'performed'
  ));
  if (!unavailable) return null;
  return {
    classification: 'inconclusive',
    reason: 'required_scenario_action_unavailable',
    actionKind: unavailable.kind || null,
    actionStatus: unavailable.status || 'unavailable',
    actionReason: unavailable.reason || null,
  };
}

export function needsLazyBaselineReset(payload = null) {
  if (
    payload?.tool !== RUNTIME_DEBUGGER_TOOL_ID
    || payload?.version !== RUNTIME_DEBUGGER_SESSION_VERSION
  ) {
    return false;
  }
  const baseline = payload?.baseline?.socialMetrics;
  const latest = payload?.latest?.socialMetrics;
  if (
    !baseline
    || typeof baseline !== 'object'
    || Array.isArray(baseline)
    || baseline.loaded !== false
    || !latest
    || typeof latest !== 'object'
    || Array.isArray(latest)
    || latest.loaded !== true
    || latest.active !== true
  ) {
    return false;
  }
  const latestOperationCount = latest.operations
    ?? latest.stats?.operations
    ?? latest.stats?.scanOperations;
  if (!Number.isSafeInteger(latestOperationCount) || latestOperationCount < 0) {
    return false;
  }
  const matchingProbes = (Array.isArray(payload.probes) ? payload.probes : [])
    .filter((probe) => probe?.probeId === LAZY_SOCIAL_BASELINE_PROBE_ID);
  if (matchingProbes.length !== 1) return false;

  const probe = matchingProbes[0];
  const details = probe?.details;
  if (!details || typeof details !== 'object' || Array.isArray(details)) return false;
  let targetingHealth;
  try {
    targetingHealth = validateTargetingHealthSnapshot(details.targetingHealth);
  } catch (_error) {
    // A malformed health envelope is a general owner failure, never a reset permit.
    return false;
  }
  return probe.status === TARGETING_HEALTH_VALIDITY.BROKEN
    && probe.measurable === false
    && probe.reason === LAZY_SOCIAL_BASELINE_PROBE_REASON
    && probe.operationCount === 0
    && probe.minimumOperationCount === 1
    && details.canonicalActive === true
    && Array.isArray(details.activeMetricKeys)
    && details.activeMetricKeys.length > 0
    && Number.isSafeInteger(details.compiledPlanCount)
    && details.compiledPlanCount > 0
    && details.observerAttached === true
    && details.baselineCovered === false
    && details.targetingHealthContractError === null
    && details.targetingHealthActivationConsistent === true
    && details.baselineTargetingHealthContractError === null
    && details.baselineTargetingHealthActivationConsistent === true
    && details.targetingHealthSessionValidityConsistent === true
    && details.targetingHealthProbeContractError
      === LAZY_SOCIAL_BASELINE_OPERATION_ERROR
    && targetingHealth.ownerId === 'social_metrics'
    && targetingHealth.activation === 'active'
    && TARGETING_HEALTH_REQUIRED_PROBE_STATES.has(targetingHealth.validity);
}
