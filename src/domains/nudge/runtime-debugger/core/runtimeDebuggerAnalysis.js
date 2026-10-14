import {
  TARGETING_HEALTH_VALIDITY,
} from '../../core/targetingHealthContract.js';
import { sanitizeRuntimeDebuggerValue } from './runtimeDebuggerSanitizer.js';

export const RUNTIME_DEBUGGER_PROBE_VALIDITY = TARGETING_HEALTH_VALIDITY;

const RUNTIME_DEBUGGER_PROBE_VALIDITY_VALUES = new Set(
  Object.values(RUNTIME_DEBUGGER_PROBE_VALIDITY),
);

const SCANNER_STRUCTURAL_CHECKS = Object.freeze([
  Object.freeze({
    id: 'scanner_duplicate_execution_absent',
    metric: 'duplicateScans',
    measurementKey: 'duplicateScans',
    detectedReason: 'duplicate_scan_execution_detected',
    absentReason: 'duplicate_scan_execution_absent',
  }),
  Object.freeze({
    id: 'scanner_avoidable_full_rescan_absent',
    metric: 'avoidableFullRescans',
    measurementKey: 'avoidableFullRescans',
    detectedReason: 'avoidable_full_rescan_detected',
    absentReason: 'avoidable_full_rescan_absent',
  }),
]);

const SCANNER_CONSERVATION_CHECKS = Object.freeze([
  Object.freeze({
    id: 'scanner_admission_conserved',
    left: ['scanAdmissions'],
    right: ['enqueuedScans', 'mergedScans'],
  }),
  Object.freeze({
    id: 'scanner_execution_shape_conserved',
    left: ['executedScans'],
    right: ['executedFullScans', 'executedDirtyScans'],
  }),
  Object.freeze({
    id: 'scanner_operation_outcomes_conserved',
    left: ['scanOperations'],
    right: [
      'completedScanOperations',
      'emptyScanOperations',
      'failedScanOperations',
      'cancelledScanOperations',
    ],
  }),
  Object.freeze({
    id: 'scanner_candidate_provenance_conserved',
    left: ['resolvedCandidates'],
    right: ['selectorOnlyHits', 'semanticOnlyHits', 'selectorSemanticOverlapHits'],
  }),
  Object.freeze({
    id: 'scanner_candidate_processing_conserved',
    left: ['processedCandidates'],
    right: ['decisionCount'],
  }),
  Object.freeze({
    id: 'scanner_decision_shape_conserved',
    left: ['decisionCount'],
    right: ['clearedDecisionCount', 'appliedDecisionCount'],
  }),
  Object.freeze({
    id: 'scanner_target_touch_identity_conserved',
    left: ['appliedTargetDecisionCount'],
    right: ['uniqueAppliedTargetDecisions', 'repeatedTargetDecisions'],
  }),
  Object.freeze({
    id: 'scanner_write_attempts_conserved',
    left: ['writeAttempts'],
    right: ['actualWrites', 'unchangedWriteAttempts'],
  }),
  Object.freeze({
    id: 'scanner_physical_write_phases_conserved',
    left: ['actualWrites'],
    right: ['applyActualWrites', 'cleanupActualWrites', 'configurationCleanupActualWrites'],
  }),
  Object.freeze({
    id: 'scanner_decision_outcomes_conserved',
    left: ['decisionCount'],
    right: ['actualWriteDecisions', 'unchangedNoopDecisions', 'noWriteDecisions'],
  }),
  Object.freeze({
    id: 'scanner_work_reasons_conserved',
    left: ['scanOperations'],
    right: [
      'relevantMutationScans',
      'activationConfigurationTransitionScans',
      'directOwnerRequestScans',
      'scheduledFullScopeScans',
      'unknownWorkReasonScans',
    ],
  }),
  Object.freeze({
    id: 'scanner_unknown_work_reason_absent',
    left: ['unknownWorkReasonScans'],
    right: [],
  }),
  Object.freeze({
    id: 'scanner_candidate_strategy_collections_conserved',
    left: ['candidateUnionCollections'],
    right: ['selectorCompleteCollections', 'semanticRequiredCollections'],
  }),
  Object.freeze({
    id: 'scanner_write_attempt_phases_conserved',
    left: ['writeAttempts'],
    right: [
      'applyWriteAttempts',
      'cleanupWriteAttempts',
      'configurationCleanupWriteAttempts',
    ],
  }),
  Object.freeze({
    id: 'scanner_unchanged_write_attempt_phases_conserved',
    left: ['unchangedWriteAttempts'],
    right: [
      'applyUnchangedWriteAttempts',
      'cleanupUnchangedWriteAttempts',
      'configurationCleanupUnchangedWriteAttempts',
    ],
  }),
]);

export const RUNTIME_DEBUGGER_SCANNER_BASELINE_METRICS = Object.freeze([
  'dirtyRootBreadth',
  'observerQueueWaitMs',
  'subscriberCallbackMs',
  'candidateYield',
  'candidateStrategyProjection',
  'zeroCandidateCollections',
  'repeatedTargetTouchShare',
  'writeRatios',
  'productTimings',
  'workloadNormalized',
]);

export const RUNTIME_DEBUGGER_SCANNER_WORK_LEDGER_VERSION = 3;
export const RUNTIME_DEBUGGER_CROSS_OWNER_DISCOVERY_LEDGER_VERSION = 2;

const SCANNER_WORK_LEDGER_REQUIRED_PATHS = Object.freeze([
  'observer.flushes',
  'observer.mutations',
  'observer.queueWaitMs',
  'observer.subscriberCallbackMs',
  'routing.admissions',
  'routing.merged',
  'routing.routedMutationGroups',
  'routing.dirtyRootTotal',
  'routing.executedFullScans',
  'routing.executedDirtyScans',
  'discovery.selectorHits',
  'discovery.selectorOnlyHits',
  'discovery.selectorSemanticOverlapHits',
  'discovery.resolvedCandidates',
  'discovery.candidateDecisions',
  'discovery.semanticCandidates',
  'discovery.semanticOnlyHits',
  'discovery.zeroCandidateCollections',
  'effect.writeAttempts',
  'effect.physicalWrites',
  'effect.unchangedWriteAttempts',
  'effect.applyWrites',
  'effect.postChunkCleanupWrites',
  'effect.configurationCleanupWrites',
  'effect.actualWriteDecisions',
  'timings.selectorMs',
  'timings.semanticMs',
  'timings.idleMs',
  'timings.applyMs',
  'timings.cleanupMs',
  'timings.configurationCleanupMs',
  'timings.totalMs',
  'timings.instrumentedElapsedMs',
  'timings.knownInPathDebuggerOverheadMs',
  'timings.estimatedProductElapsedMs',
]);

const CROSS_OWNER_DISCOVERY_IDS = Object.freeze([
  'socialMetrics',
  'shortForm',
]);
const CROSS_OWNER_DISCOVERY_ID_SET = new Set(CROSS_OWNER_DISCOVERY_IDS);
const CROSS_OWNER_SHARED_FLUSH_RETENTION_LIMIT = 32;
const CROSS_OWNER_EXACT_OVERLAP_RETENTION_LIMIT = 32;
const CROSS_OWNER_EXACT_PHASES = new Set([
  'scan_root',
  'candidate_visit',
  'effect_target',
]);

function readDiscoveryEventFlushIds(event) {
  const details = event?.details;
  if (!details || typeof details !== 'object' || Array.isArray(details)) return [];
  const rawIds = Array.isArray(details.flushIds)
    ? details.flushIds
    : details.flushId === null || details.flushId === undefined
      ? []
      : [details.flushId];
  return [...new Set(rawIds
    .map((value) => normalizeLedgerMetric(value))
    .filter((value) => Number.isInteger(value) && value > 0))]
    .sort((left, right) => left - right);
}

function createDiscoveryOwnerEntry(ownerId, events, ownerState, gapCount) {
  const active = ownerState?.active === true;
  const available = ownerState?.available === true;
  const observerAttached = ownerState?.observerAttached === true;
  const flushIds = [...new Set(events.flatMap(readDiscoveryEventFlushIds))]
    .sort((left, right) => left - right);
  const flushReferenceCount = events.reduce(
    (total, event) => total + readDiscoveryEventFlushIds(event).length,
    0,
  );
  const sumMetric = (primaryKey, secondaryKey) => events.reduce((total, event) => {
    const details = event?.details || {};
    const value = normalizeLedgerMetric(
      details[primaryKey] ?? details[secondaryKey],
    );
    return total + (value ?? 0);
  }, 0);
  let state = RUNTIME_DEBUGGER_PROBE_VALIDITY.MEASURED;
  let reason = 'owner_discovery_events_measured';
  if (!available) {
    state = RUNTIME_DEBUGGER_PROBE_VALIDITY.UNAVAILABLE;
    reason = 'owner_discovery_unavailable';
  } else if (!active) {
    state = RUNTIME_DEBUGGER_PROBE_VALIDITY.INACTIVE;
    reason = 'owner_discovery_inactive';
  } else if (!observerAttached) {
    state = RUNTIME_DEBUGGER_PROBE_VALIDITY.INSUFFICIENT;
    reason = 'owner_observer_not_attached';
  } else if (gapCount > 0) {
    state = RUNTIME_DEBUGGER_PROBE_VALIDITY.INSUFFICIENT;
    reason = 'owner_discovery_event_gap';
  } else if (events.length === 0) {
    state = RUNTIME_DEBUGGER_PROBE_VALIDITY.ARMED_IDLE;
    reason = 'owner_discovery_no_operation';
  }
  return {
    ownerId,
    state,
    reason,
    active,
    available,
    observerAttached,
    eventGapCount: gapCount,
    operationCount: events.length,
    flushBearingOperationCount: events.filter(
      (event) => readDiscoveryEventFlushIds(event).length > 0,
    ).length,
    uniqueFlushCount: flushIds.length,
    flushReferenceCount,
    rootAdmissions: sumMetric('rootCount', 'roots'),
    candidateVisits: sumMetric('candidateCount', 'candidates'),
    flushIds,
    semantics: ownerId === 'socialMetrics'
      ? {
        rootAdmissions: 'compiled_scan_group_roots',
        candidateVisits: 'resolved_social_metric_candidates',
      }
      : {
        rootAdmissions: 'short_form_prune_roots',
        candidateVisits: 'short_form_prune_candidates',
      },
  };
}

function normalizeExactDiscoveryRecord(record) {
  const ownerId = String(record?.ownerId || '');
  const phase = String(record?.phase || '');
  const nodeId = normalizeLedgerMetric(record?.nodeId);
  const visitCount = normalizeLedgerMetric(record?.visitCount);
  if (!CROSS_OWNER_DISCOVERY_ID_SET.has(ownerId)) return null;
  if (!CROSS_OWNER_EXACT_PHASES.has(phase)) return null;
  if (!Number.isInteger(nodeId) || nodeId < 1) return null;
  if (!Number.isInteger(visitCount) || visitCount < 1) return null;
  const flushIds = Array.isArray(record?.flushIds)
    ? [...new Set(record.flushIds
      .map((value) => normalizeLedgerMetric(value))
      .filter((value) => Number.isInteger(value) && value > 0))]
      .sort((left, right) => left - right)
    : [];
  return {
    ownerId,
    phase,
    nodeId,
    visitCount,
    flushIds,
    workReason: String(record?.workReason || 'unknown'),
  };
}

function createExactDiscoveryIdentityEvidence(exactEvidence) {
  if (exactEvidence === null || exactEvidence === undefined) {
    return {
      state: RUNTIME_DEBUGGER_PROBE_VALIDITY.UNAVAILABLE,
      reason: 'runtime_discovery_identity_evidence_unavailable',
      complete: false,
      exactNodeOverlapProven: false,
      sameFlushReasonNodeOverlapProven: false,
      redundantWorkProven: false,
    };
  }
  if (!exactEvidence || typeof exactEvidence !== 'object' || Array.isArray(exactEvidence)) {
    return {
      state: RUNTIME_DEBUGGER_PROBE_VALIDITY.BROKEN,
      reason: 'runtime_discovery_identity_evidence_invalid',
      complete: false,
      exactNodeOverlapProven: false,
      sameFlushReasonNodeOverlapProven: false,
      redundantWorkProven: false,
    };
  }
  const records = Array.isArray(exactEvidence.records)
    ? exactEvidence.records.map(normalizeExactDiscoveryRecord)
    : null;
  const droppedVisitCount = normalizeLedgerMetric(exactEvidence.droppedVisitCount);
  if (
    records === null
    || records.some((record) => record === null)
    || !Number.isInteger(droppedVisitCount)
    || droppedVisitCount < 0
  ) {
    return {
      state: RUNTIME_DEBUGGER_PROBE_VALIDITY.BROKEN,
      reason: 'runtime_discovery_identity_record_contract_invalid',
      complete: false,
      exactNodeOverlapProven: false,
      sameFlushReasonNodeOverlapProven: false,
      redundantWorkProven: false,
    };
  }

  const recordsByPhaseNode = new Map();
  records.forEach((record) => {
    const key = `${record.phase}:${record.nodeId}`;
    const grouped = recordsByPhaseNode.get(key) || [];
    grouped.push(record);
    recordsByPhaseNode.set(key, grouped);
  });
  const exactPhaseNodeGroups = [];
  const exactNodeIds = new Set();
  const sameFlushReasonKeys = new Set();
  const sameFlushReasonOverlaps = [];
  const phaseOverlapCounts = {
    scan_root: 0,
    candidate_visit: 0,
    effect_target: 0,
  };

  recordsByPhaseNode.forEach((group) => {
    const socialRecords = group.filter((record) => record.ownerId === 'socialMetrics');
    const shortFormRecords = group.filter((record) => record.ownerId === 'shortForm');
    if (socialRecords.length === 0 || shortFormRecords.length === 0) return;
    exactPhaseNodeGroups.push(group);
    exactNodeIds.add(group[0].nodeId);
    phaseOverlapCounts[group[0].phase] += 1;

    socialRecords.forEach((socialRecord) => {
      shortFormRecords.forEach((shortFormRecord) => {
        if (socialRecord.workReason !== shortFormRecord.workReason) return;
        const shortFlushIds = new Set(shortFormRecord.flushIds);
        socialRecord.flushIds.forEach((flushId) => {
          if (!shortFlushIds.has(flushId)) return;
          const key = [
            socialRecord.phase,
            socialRecord.nodeId,
            socialRecord.workReason,
            flushId,
          ].join(':');
          if (sameFlushReasonKeys.has(key)) return;
          sameFlushReasonKeys.add(key);
          if (sameFlushReasonOverlaps.length < CROSS_OWNER_EXACT_OVERLAP_RETENTION_LIMIT) {
            sameFlushReasonOverlaps.push({
              phase: socialRecord.phase,
              nodeId: socialRecord.nodeId,
              flushId,
              workReason: socialRecord.workReason,
              socialMetricsVisitCount: socialRecord.visitCount,
              shortFormVisitCount: shortFormRecord.visitCount,
            });
          }
        });
      });
    });
  });

  const complete = exactEvidence.complete === true && droppedVisitCount === 0;
  const rawInstrumentation = exactEvidence.instrumentation
    && typeof exactEvidence.instrumentation === 'object'
    && !Array.isArray(exactEvidence.instrumentation)
    ? exactEvidence.instrumentation
    : {};
  const rawOwnerOverhead = rawInstrumentation.recordOverheadByOwner
    && typeof rawInstrumentation.recordOverheadByOwner === 'object'
    && !Array.isArray(rawInstrumentation.recordOverheadByOwner)
    ? rawInstrumentation.recordOverheadByOwner
    : {};
  const rawOwnerCallCounts = rawInstrumentation.recordCallCountByOwner
    && typeof rawInstrumentation.recordCallCountByOwner === 'object'
    && !Array.isArray(rawInstrumentation.recordCallCountByOwner)
    ? rawInstrumentation.recordCallCountByOwner
    : {};
  const evidenceState = String(exactEvidence.state || '');
  const state = !complete
    ? RUNTIME_DEBUGGER_PROBE_VALIDITY.INSUFFICIENT
    : records.length > 0 || evidenceState === RUNTIME_DEBUGGER_PROBE_VALIDITY.MEASURED
      ? RUNTIME_DEBUGGER_PROBE_VALIDITY.MEASURED
      : evidenceState === RUNTIME_DEBUGGER_PROBE_VALIDITY.ARMED_IDLE
        ? RUNTIME_DEBUGGER_PROBE_VALIDITY.ARMED_IDLE
        : RUNTIME_DEBUGGER_PROBE_VALIDITY.INACTIVE;
  const reason = state === RUNTIME_DEBUGGER_PROBE_VALIDITY.MEASURED
    ? 'runtime_discovery_identity_overlap_measured'
    : state === RUNTIME_DEBUGGER_PROBE_VALIDITY.ARMED_IDLE
      ? 'runtime_discovery_identity_armed_idle'
      : state === RUNTIME_DEBUGGER_PROBE_VALIDITY.INSUFFICIENT
        ? 'runtime_discovery_identity_retention_incomplete'
        : 'runtime_discovery_identity_session_inactive';

  return {
    state,
    reason,
    complete,
    generation: normalizeLedgerMetric(exactEvidence.generation),
    recordCount: records.length,
    visitCount: normalizeLedgerMetric(exactEvidence.visitCount),
    uniqueNodeCount: normalizeLedgerMetric(exactEvidence.uniqueNodeCount),
    droppedVisitCount,
    ownerRecordCounts: Object.fromEntries(CROSS_OWNER_DISCOVERY_IDS.map((ownerId) => [
      ownerId,
      records.filter((record) => record.ownerId === ownerId).length,
    ])),
    exactNodeOverlapCount: exactNodeIds.size,
    exactPhaseNodeOverlapCount: exactPhaseNodeGroups.length,
    phaseOverlapCounts,
    sameFlushReasonNodeOverlapCount: sameFlushReasonKeys.size,
    sameFlushReasonOverlaps,
    sameFlushReasonOverlapsTruncated:
      sameFlushReasonKeys.size > sameFlushReasonOverlaps.length,
    exactNodeOverlapProven: exactNodeIds.size > 0,
    sameFlushReasonNodeOverlapProven: sameFlushReasonKeys.size > 0,
    exactIdentityDimensionsComparable: true,
    redundantWorkProven: false,
    redundancyReason: 'same_node_scope_can_serve_distinct_feature_outputs',
    instrumentation: {
      identity: String(rawInstrumentation.identity || 'weakmap_numeric_node_id'),
      retainsDomNodes: rawInstrumentation.retainsDomNodes === true,
      extraDomReads: normalizeLedgerMetric(rawInstrumentation.extraDomReads) ?? 0,
      recordOverheadMs: normalizeLedgerMetric(rawInstrumentation.recordOverheadMs),
      recordOverheadMaxMs: normalizeLedgerMetric(rawInstrumentation.recordOverheadMaxMs),
      recordCallCount: normalizeLedgerMetric(rawInstrumentation.recordCallCount),
      recordOverheadByOwner: Object.fromEntries(
        CROSS_OWNER_DISCOVERY_IDS.map((ownerId) => [
          ownerId,
          normalizeLedgerMetric(rawOwnerOverhead[ownerId]),
        ]),
      ),
      recordCallCountByOwner: Object.fromEntries(
        CROSS_OWNER_DISCOVERY_IDS.map((ownerId) => [
          ownerId,
          normalizeLedgerMetric(rawOwnerCallCounts[ownerId]),
        ]),
      ),
      snapshotReadOverheadMs:
        normalizeLedgerMetric(rawInstrumentation.snapshotReadOverheadMs),
      snapshotReadOverheadMaxMs:
        normalizeLedgerMetric(rawInstrumentation.snapshotReadOverheadMaxMs),
      snapshotReadCount: normalizeLedgerMetric(rawInstrumentation.snapshotReadCount),
    },
  };
}

/**
 * Correlates existing owner events by ObserverHub flush identity. It performs
 * no DOM work and deliberately reports co-activity rather than redundancy:
 * each owner retains different candidate/effect semantics.
 */
export function createRuntimeDebuggerCrossOwnerDiscoveryLedger({
  events = [],
  evidenceGaps = [],
  owners = {},
  exactEvidence = null,
} = {}) {
  if (!Array.isArray(events) || !Array.isArray(evidenceGaps)) {
    return sanitizeRuntimeDebuggerValue({
      schemaVersion: RUNTIME_DEBUGGER_CROSS_OWNER_DISCOVERY_LEDGER_VERSION,
      state: RUNTIME_DEBUGGER_PROBE_VALIDITY.BROKEN,
      reason: 'cross_owner_discovery_event_contract_invalid',
      automaticHardGate: false,
      duplicateDiscoveryProven: false,
      redundantWorkProven: false,
      ownerDimensionsComparable: false,
      owners: {},
      overlap: null,
      exactIdentity: createExactDiscoveryIdentityEvidence(exactEvidence),
    });
  }
  const exactIdentity = createExactDiscoveryIdentityEvidence(exactEvidence);
  const ownerEntries = Object.fromEntries(CROSS_OWNER_DISCOVERY_IDS.map((ownerId) => {
    const ownerEvents = events.filter((event) => event?.probeId === ownerId);
    const gapCount = evidenceGaps.filter((gap) => gap?.probeId === ownerId).length;
    return [ownerId, createDiscoveryOwnerEntry(
      ownerId,
      ownerEvents,
      owners?.[ownerId],
      gapCount,
    )];
  }));
  const flushOwners = new Map();
  Object.values(ownerEntries).forEach((entry) => {
    entry.flushIds.forEach((flushId) => {
      const ownerIds = flushOwners.get(flushId) || new Set();
      ownerIds.add(entry.ownerId);
      flushOwners.set(flushId, ownerIds);
    });
  });
  const unionFlushIds = [...flushOwners.keys()].sort((left, right) => left - right);
  const sharedFlushIds = unionFlushIds.filter(
    (flushId) => flushOwners.get(flushId)?.size === CROSS_OWNER_DISCOVERY_ID_SET.size,
  );
  const requiredEntries = Object.values(ownerEntries);
  const allMeasured = requiredEntries.every(
    (entry) => entry.state === RUNTIME_DEBUGGER_PROBE_VALIDITY.MEASURED,
  );
  const allHaveFlushEvidence = requiredEntries.every(
    (entry) => entry.uniqueFlushCount > 0,
  );
  const state = allMeasured
    ? allHaveFlushEvidence
      ? RUNTIME_DEBUGGER_PROBE_VALIDITY.MEASURED
      : RUNTIME_DEBUGGER_PROBE_VALIDITY.ARMED_IDLE
    : requiredEntries.some((entry) => entry.state === RUNTIME_DEBUGGER_PROBE_VALIDITY.BROKEN)
      ? RUNTIME_DEBUGGER_PROBE_VALIDITY.BROKEN
      : RUNTIME_DEBUGGER_PROBE_VALIDITY.INSUFFICIENT;
  const reason = state === RUNTIME_DEBUGGER_PROBE_VALIDITY.MEASURED
    ? 'shared_flush_coactivity_measured'
    : state === RUNTIME_DEBUGGER_PROBE_VALIDITY.ARMED_IDLE
      ? 'shared_flush_evidence_armed_idle'
      : 'cross_owner_discovery_evidence_incomplete';
  const retainedSharedFlushIds = sharedFlushIds.slice(
    -CROSS_OWNER_SHARED_FLUSH_RETENTION_LIMIT,
  );
  return sanitizeRuntimeDebuggerValue({
    schemaVersion: RUNTIME_DEBUGGER_CROSS_OWNER_DISCOVERY_LEDGER_VERSION,
    state,
    reason,
    policy: 'shared_flush_coactivity_not_duplicate_work',
    automaticHardGate: false,
    agentInterpretationRequired: false,
    extraDomReads: 0,
    duplicateDiscoveryProven: false,
    redundantWorkProven: false,
    ownerDimensionsComparable: false,
    owners: ownerEntries,
    exactNodeOverlapProven: exactIdentity.exactNodeOverlapProven === true,
    sameFlushReasonNodeOverlapProven:
      exactIdentity.sameFlushReasonNodeOverlapProven === true,
    exactIdentity,
    overlap: {
      unionFlushCount: unionFlushIds.length,
      sharedFlushCount: sharedFlushIds.length,
      sharedFlushShare: createScaledLedgerRatio(
        sharedFlushIds.length,
        unionFlushIds.length,
        {
          state,
          unit: 'observer_flush_share',
        },
      ),
      retainedSharedFlushIds,
      sharedFlushIdsTruncated: sharedFlushIds.length > retainedSharedFlushIds.length,
    },
  });
}

function normalizeCount(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`RUNTIME_DEBUGGER_${field.toUpperCase()}_INVALID`);
  }
  return value;
}

/**
 * Classifies a conditional effect contract. A feature with no observed
 * opportunity is armed, not proven; once an opportunity exists every item must
 * reach one terminal effect after the shared observer settles.
 */
export function analyzeRuntimeDebuggerShortFormCompleteness({
  active,
  available,
  ownerObserverAttached,
  oracleAttached,
  oracleCoverageEstablished,
  siteEvidenceCurrent,
  observerSettled,
  opportunityCount = 0,
  terminalCount = 0,
  causallyProvenTerminalCount = 0,
  pendingCount = 0,
  evidenceGapCount = 0,
} = {}) {
  requireBoolean(active, 'short_form_active');
  requireBoolean(available, 'short_form_available');
  requireBoolean(ownerObserverAttached, 'short_form_owner_observer_attached');
  requireBoolean(oracleAttached, 'short_form_oracle_attached');
  requireBoolean(oracleCoverageEstablished, 'short_form_oracle_coverage_established');
  requireBoolean(siteEvidenceCurrent, 'short_form_site_evidence_current');
  requireBoolean(observerSettled, 'short_form_observer_settled');
  const opportunities = normalizeCount(opportunityCount, 'short_form_opportunity_count');
  const terminal = normalizeCount(terminalCount, 'short_form_terminal_count');
  const causallyProven = normalizeCount(
    causallyProvenTerminalCount,
    'short_form_causally_proven_terminal_count',
  );
  const pending = normalizeCount(pendingCount, 'short_form_pending_count');
  const evidenceGaps = normalizeCount(evidenceGapCount, 'short_form_evidence_gap_count');
  const unprovenTerminal = terminal - causallyProven;
  const countConsistent = terminal + pending === opportunities
    && causallyProven <= terminal;

  let state;
  let reason;
  if (!active) {
    state = RUNTIME_DEBUGGER_PROBE_VALIDITY.INACTIVE;
    reason = 'canonical_activation_absent';
  } else if (!available) {
    state = RUNTIME_DEBUGGER_PROBE_VALIDITY.UNAVAILABLE;
    reason = 'short_form_owner_unavailable';
  } else if (!ownerObserverAttached || !oracleAttached) {
    state = RUNTIME_DEBUGGER_PROBE_VALIDITY.BROKEN;
    reason = !ownerObserverAttached
      ? 'short_form_owner_observer_missing'
      : 'short_form_opportunity_oracle_missing';
  } else if (!siteEvidenceCurrent) {
    state = RUNTIME_DEBUGGER_PROBE_VALIDITY.BROKEN;
    reason = 'short_form_site_evidence_mismatch';
  } else if (!countConsistent) {
    state = RUNTIME_DEBUGGER_PROBE_VALIDITY.BROKEN;
    reason = 'short_form_opportunity_ledger_inconsistent';
  } else if (evidenceGaps > 0) {
    state = RUNTIME_DEBUGGER_PROBE_VALIDITY.INSUFFICIENT;
    reason = 'short_form_opportunity_evidence_gap';
  } else if (!oracleCoverageEstablished) {
    state = RUNTIME_DEBUGGER_PROBE_VALIDITY.INSUFFICIENT;
    reason = 'short_form_opportunity_coverage_missing';
  } else if (!observerSettled) {
    state = RUNTIME_DEBUGGER_PROBE_VALIDITY.INSUFFICIENT;
    reason = 'short_form_opportunity_effect_in_flight';
  } else if (opportunities === 0) {
    state = RUNTIME_DEBUGGER_PROBE_VALIDITY.ARMED_IDLE;
    reason = 'no_short_form_opportunity_observed';
  } else if (pending > 0) {
    state = RUNTIME_DEBUGGER_PROBE_VALIDITY.BROKEN;
    reason = 'short_form_opportunity_unhandled_after_settle';
  } else if (unprovenTerminal > 0) {
    state = RUNTIME_DEBUGGER_PROBE_VALIDITY.INSUFFICIENT;
    reason = 'short_form_terminal_causality_unproven';
  } else {
    state = RUNTIME_DEBUGGER_PROBE_VALIDITY.MEASURED;
    reason = 'all_short_form_opportunities_reached_terminal_effect';
  }

  return sanitizeRuntimeDebuggerValue({
    state,
    reason,
    measurable: state === RUNTIME_DEBUGGER_PROBE_VALIDITY.MEASURED,
    agentInterpretationRequired: false,
    opportunityCount: opportunities,
    terminalCount: terminal,
    causallyProvenTerminalCount: causallyProven,
    unprovenTerminalCount: Math.max(0, unprovenTerminal),
    pendingCount: pending,
    evidenceGapCount: evidenceGaps,
    oracleCoverageEstablished,
    siteEvidenceCurrent,
    observerSettled,
    countConsistent,
  });
}

function requireBoolean(value, field) {
  if (typeof value !== 'boolean') {
    throw new Error(`RUNTIME_DEBUGGER_PROBE_${field.toUpperCase()}_BOOLEAN_REQUIRED`);
  }
}

function requireNonNegativeNumber(value, field) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error(`RUNTIME_DEBUGGER_${field.toUpperCase()}_INVALID`);
  }
  return numeric;
}

export function classifyRuntimeDebuggerProbe({
  probeId,
  label = probeId,
  active,
  activationKnown = true,
  available,
  ready,
  baselineCovered = true,
  operationCount,
  minimumOperationCount = 1,
  details = {},
} = {}) {
  if (typeof probeId !== 'string' || probeId.length === 0) {
    throw new Error('RUNTIME_DEBUGGER_PROBE_ID_REQUIRED');
  }
  requireBoolean(active, 'active');
  requireBoolean(activationKnown, 'activation_known');
  requireBoolean(available, 'available');
  requireBoolean(ready, 'ready');
  requireBoolean(baselineCovered, 'baseline_covered');
  const resolvedOperationCount = requireNonNegativeNumber(operationCount, 'operation_count');
  const resolvedMinimum = requireNonNegativeNumber(
    minimumOperationCount,
    'minimum_operation_count',
  );
  if (resolvedMinimum < 1) throw new Error('RUNTIME_DEBUGGER_MINIMUM_OPERATION_COUNT_INVALID');

  let status;
  let reason;
  if (!activationKnown) {
    status = RUNTIME_DEBUGGER_PROBE_VALIDITY.UNAVAILABLE;
    reason = 'activation_state_unavailable';
  } else if (!active) {
    status = RUNTIME_DEBUGGER_PROBE_VALIDITY.INACTIVE;
    reason = 'canonical_activation_absent';
  } else if (!available) {
    status = RUNTIME_DEBUGGER_PROBE_VALIDITY.UNAVAILABLE;
    reason = 'probe_owner_unavailable';
  } else if (!ready) {
    status = RUNTIME_DEBUGGER_PROBE_VALIDITY.BROKEN;
    reason = 'active_probe_contract_incomplete';
  } else if (!baselineCovered) {
    status = RUNTIME_DEBUGGER_PROBE_VALIDITY.INSUFFICIENT;
    reason = 'baseline_coverage_missing';
  } else if (resolvedOperationCount === 0) {
    status = RUNTIME_DEBUGGER_PROBE_VALIDITY.ARMED_IDLE;
    reason = 'no_session_operation';
  } else if (resolvedOperationCount < resolvedMinimum) {
    status = RUNTIME_DEBUGGER_PROBE_VALIDITY.INSUFFICIENT;
    reason = 'insufficient_session_operations';
  } else {
    status = RUNTIME_DEBUGGER_PROBE_VALIDITY.MEASURED;
    reason = 'measurement_valid';
  }

  return sanitizeRuntimeDebuggerValue({
    probeId,
    label,
    status,
    measurable: status === RUNTIME_DEBUGGER_PROBE_VALIDITY.MEASURED,
    reason,
    operationCount: resolvedOperationCount,
    minimumOperationCount: resolvedMinimum,
    details,
  });
}

export function createRuntimeDebuggerRatio(numerator, denominator) {
  const resolvedNumerator = requireNonNegativeNumber(numerator, 'ratio_numerator');
  const resolvedDenominator = requireNonNegativeNumber(denominator, 'ratio_denominator');
  if (resolvedDenominator === 0) {
    return {
      status: 'not_measured',
      reason: 'zero_denominator',
      numerator: resolvedNumerator,
      denominator: resolvedDenominator,
      ratio: null,
      percent: null,
    };
  }
  const ratio = resolvedNumerator / resolvedDenominator;
  return {
    status: 'measured',
    reason: 'denominator_available',
    numerator: resolvedNumerator,
    denominator: resolvedDenominator,
    ratio,
    percent: ratio * 100,
  };
}

function readObjectPath(source, path) {
  return path.split('.').reduce((current, segment) => current?.[segment], source);
}

function normalizeLedgerMetric(value) {
  if (
    value === null
    || value === undefined
    || typeof value === 'boolean'
    || (typeof value === 'string' && value.trim() === '')
  ) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
}

function createUnavailableLedgerRatio(state, reason, {
  numerator = null,
  denominator = null,
  scale = 1,
  unit = 'ratio',
} = {}) {
  return {
    status: state,
    reason,
    numerator: normalizeLedgerMetric(numerator),
    denominator: normalizeLedgerMetric(denominator),
    scale,
    unit,
    ratio: null,
    percent: null,
    value: null,
  };
}

function createScaledLedgerRatio(
  numerator,
  denominator,
  {
    state = RUNTIME_DEBUGGER_PROBE_VALIDITY.MEASURED,
    scale = 1,
    unit = 'ratio',
  } = {},
) {
  if (state !== RUNTIME_DEBUGGER_PROBE_VALIDITY.MEASURED) {
    return createUnavailableLedgerRatio(state, 'scanner_workload_not_measured', {
      numerator,
      denominator,
      scale,
      unit,
    });
  }
  const ratio = createRuntimeDebuggerRatio(numerator, denominator);
  return {
    ...ratio,
    scale,
    unit,
    value: ratio.ratio === null ? null : ratio.ratio * scale,
  };
}

function createCandidateStrategyEntry({
  id,
  candidateCount,
  candidateUniverseCount,
  missingCandidateCount,
  state,
}) {
  const measured = state === RUNTIME_DEBUGGER_PROBE_VALIDITY.MEASURED;
  const isReference = id === 'currentUnion';
  const candidateUnionNonInferior = measured
    && candidateUniverseCount > 0
    && missingCandidateCount === 0;
  const reducesCandidateBreadth = measured
    && candidateUniverseCount > 0
    && candidateCount < candidateUniverseCount;
  return {
    candidateCount,
    missingCandidateCount,
    candidateUnionCoverage: createScaledLedgerRatio(
      candidateCount,
      candidateUniverseCount,
      { state, unit: 'candidate_union_share' },
    ),
    challenge: {
      status: isReference
        ? 'REFERENCE'
        : !measured || candidateUniverseCount === 0
          ? 'WARN'
          : candidateUnionNonInferior ? 'PASS' : 'FAIL',
      reason: isReference
        ? 'current_union_reference'
        : !measured
          ? 'candidate_union_challenge_not_measured'
          : candidateUniverseCount === 0
            ? 'candidate_union_empty'
            : candidateUnionNonInferior
              ? 'candidate_union_noninferior'
              : 'candidate_union_coverage_loss',
      candidateUnionNoninferiorityProven: isReference
        ? null
        : candidateUnionNonInferior,
      productCorrectnessNoninferiorityProven: false,
      reducesCandidateBreadth,
      eligibleForControlledCostExperiment: !isReference
        && candidateUnionNonInferior,
    },
  };
}

/**
 * Projects already-collected selector and semantic candidate sets into shadow
 * strategies. This performs no extra DOM reads and deliberately does not claim
 * feature completeness: the independent feature oracle remains the correctness
 * owner.
 */
export function createRuntimeDebuggerCandidateStrategyProjection({
  measurementState = RUNTIME_DEBUGGER_PROBE_VALIDITY.UNAVAILABLE,
  selectorOnlyHits = null,
  semanticOnlyHits = null,
  selectorSemanticOverlapHits = null,
  resolvedCandidates = null,
} = {}) {
  const recognizedState = RUNTIME_DEBUGGER_PROBE_VALIDITY_VALUES.has(measurementState);
  const requestedState = recognizedState
    ? measurementState
    : RUNTIME_DEBUGGER_PROBE_VALIDITY.BROKEN;
  const selectorOnly = normalizeLedgerMetric(selectorOnlyHits);
  const semanticOnly = normalizeLedgerMetric(semanticOnlyHits);
  const overlap = normalizeLedgerMetric(selectorSemanticOverlapHits);
  const resolved = normalizeLedgerMetric(resolvedCandidates);
  const countsAvailable = [selectorOnly, semanticOnly, overlap, resolved]
    .every((value) => value !== null);
  const candidateUniverseCount = countsAvailable
    ? selectorOnly + semanticOnly + overlap
    : null;
  const countConsistent = countsAvailable
    ? candidateUniverseCount === resolved
    : null;
  const state = requestedState === RUNTIME_DEBUGGER_PROBE_VALIDITY.MEASURED
    && (!countsAvailable || countConsistent === false)
    ? RUNTIME_DEBUGGER_PROBE_VALIDITY.BROKEN
    : requestedState;
  const reason = !recognizedState
    ? 'candidate_strategy_measurement_state_invalid'
    : requestedState !== RUNTIME_DEBUGGER_PROBE_VALIDITY.MEASURED
      ? 'candidate_strategy_not_measured'
      : !countsAvailable
        ? 'candidate_strategy_counts_unavailable'
        : countConsistent === false
          ? 'candidate_strategy_provenance_inconsistent'
          : candidateUniverseCount === 0
            ? 'candidate_union_empty'
            : 'candidate_union_shadow_projection_measured';
  const ratioState = state === RUNTIME_DEBUGGER_PROBE_VALIDITY.MEASURED
    ? state
    : requestedState === RUNTIME_DEBUGGER_PROBE_VALIDITY.MEASURED
      ? RUNTIME_DEBUGGER_PROBE_VALIDITY.BROKEN
      : requestedState;
  const selectorCandidateCount = countsAvailable ? selectorOnly + overlap : null;
  const semanticCandidateCount = countsAvailable ? semanticOnly + overlap : null;

  return sanitizeRuntimeDebuggerValue({
    state,
    reason,
    policy: 'candidate_union_shadow_projection',
    experimentPolicy: 'shadow_first_independent_oracle_required',
    ownerScope: 'social_metrics_candidate_discovery',
    crossOwnerComparable: false,
    automaticWinnerSelection: false,
    agentInterpretationRequired: false,
    extraDomReads: 0,
    oracleCompletenessProven: false,
    candidateUniverseCount,
    countConsistent,
    strategies: {
      currentUnion: createCandidateStrategyEntry({
        id: 'currentUnion',
        candidateCount: candidateUniverseCount,
        candidateUniverseCount,
        missingCandidateCount: countsAvailable ? 0 : null,
        state: ratioState,
      }),
      selectorOnly: createCandidateStrategyEntry({
        id: 'selectorOnly',
        candidateCount: selectorCandidateCount,
        candidateUniverseCount,
        missingCandidateCount: semanticOnly,
        state: ratioState,
      }),
      semanticOnly: createCandidateStrategyEntry({
        id: 'semanticOnly',
        candidateCount: semanticCandidateCount,
        candidateUniverseCount,
        missingCandidateCount: selectorOnly,
        state: ratioState,
      }),
    },
    semanticIncrementalYield: createScaledLedgerRatio(
      semanticOnly,
      countsAvailable ? semanticOnly + overlap : null,
      { state: ratioState, unit: 'semantic_candidate_share' },
    ),
    eligibleChallengers: [
      {
        id: 'selectorOnly',
        candidateCount: selectorCandidateCount,
        missingCandidateCount: semanticOnly,
      },
      {
        id: 'semanticOnly',
        candidateCount: semanticCandidateCount,
        missingCandidateCount: selectorOnly,
      },
    ].filter((entry) => (
      state === RUNTIME_DEBUGGER_PROBE_VALIDITY.MEASURED
      && candidateUniverseCount > 0
      && entry.missingCandidateCount === 0
    )).map((entry) => entry.id),
  });
}

/**
 * Builds a deterministic, workload-normalized scanner ledger. Absolute
 * distribution-sensitive values remain approved-envelope inputs; this ledger
 * does not silently turn a lower number into a new target or hard gate.
 */
export function createRuntimeDebuggerScannerWorkLedger({
  phase = 'session',
  measurementState = RUNTIME_DEBUGGER_PROBE_VALIDITY.UNAVAILABLE,
  identityMeasurementState = measurementState,
  identityScope = 'measurement_epoch',
  settled = null,
  workload = {},
} = {}) {
  if (typeof phase !== 'string' || phase.trim().length === 0) {
    throw new Error('RUNTIME_DEBUGGER_SCANNER_WORK_LEDGER_PHASE_REQUIRED');
  }
  const recognizedState = RUNTIME_DEBUGGER_PROBE_VALIDITY_VALUES.has(measurementState);
  const recognizedIdentityState = RUNTIME_DEBUGGER_PROBE_VALIDITY_VALUES.has(
    identityMeasurementState,
  );
  const unavailableFields = SCANNER_WORK_LEDGER_REQUIRED_PATHS.filter((path) => (
    normalizeLedgerMetric(readObjectPath(workload, path)) === null
  ));
  const identityUnavailableFields = [
    'discovery.uniqueTargetTouches',
    'discovery.repeatedTargetTouches',
  ].filter((path) => normalizeLedgerMetric(readObjectPath(workload, path)) === null);
  const measuredInput = recognizedState
    && measurementState === RUNTIME_DEBUGGER_PROBE_VALIDITY.MEASURED;
  const workValues = SCANNER_WORK_LEDGER_REQUIRED_PATHS
    .map((path) => normalizeLedgerMetric(readObjectPath(workload, path)))
    .filter((value) => value !== null);
  const workObserved = workValues.some((value) => value > 0);

  let state = recognizedState
    ? measurementState
    : RUNTIME_DEBUGGER_PROBE_VALIDITY.BROKEN;
  let reason = recognizedState
    ? 'scanner_workload_not_measured'
    : 'scanner_workload_measurement_state_invalid';
  if (measuredInput && settled !== true) {
    state = RUNTIME_DEBUGGER_PROBE_VALIDITY.INSUFFICIENT;
    reason = 'scanner_workload_not_settled';
  } else if (measuredInput && unavailableFields.length > 0) {
    state = RUNTIME_DEBUGGER_PROBE_VALIDITY.BROKEN;
    reason = 'scanner_workload_fields_unavailable';
  } else if (measuredInput && !workObserved) {
    state = RUNTIME_DEBUGGER_PROBE_VALIDITY.ARMED_IDLE;
    reason = 'no_phase_scanner_work';
  } else if (measuredInput) {
    state = RUNTIME_DEBUGGER_PROBE_VALIDITY.MEASURED;
    reason = 'scanner_workload_normalized';
  }
  if (
    state === RUNTIME_DEBUGGER_PROBE_VALIDITY.MEASURED
    && (
      !recognizedIdentityState
      || (
        identityMeasurementState === RUNTIME_DEBUGGER_PROBE_VALIDITY.MEASURED
        && identityUnavailableFields.length > 0
      )
    )
  ) {
    state = RUNTIME_DEBUGGER_PROBE_VALIDITY.BROKEN;
    reason = !recognizedIdentityState
      ? 'scanner_identity_measurement_state_invalid'
      : 'scanner_identity_fields_unavailable';
  }

  let ratioState = state;
  let identityRatioState = state === RUNTIME_DEBUGGER_PROBE_VALIDITY.MEASURED
    ? identityMeasurementState
    : state;
  const observer = workload.observer || {};
  const routing = workload.routing || {};
  const discovery = workload.discovery || {};
  const effect = workload.effect || {};
  const timings = workload.timings || {};
  const overhead = workload.overhead || {};
  const executedScans = (
    normalizeLedgerMetric(routing.executedFullScans) ?? 0
  ) + (
    normalizeLedgerMetric(routing.executedDirtyScans) ?? 0
  );
  const semanticProvenanceCount = (
    normalizeLedgerMetric(discovery.semanticOnlyHits) ?? 0
  ) + (
    normalizeLedgerMetric(discovery.selectorSemanticOverlapHits) ?? 0
  );
  const strategyProjection = createRuntimeDebuggerCandidateStrategyProjection({
    measurementState: ratioState,
    selectorOnlyHits: discovery.selectorOnlyHits,
    semanticOnlyHits: discovery.semanticOnlyHits,
    selectorSemanticOverlapHits: discovery.selectorSemanticOverlapHits,
    resolvedCandidates: discovery.resolvedCandidates,
  });
  if (
    state === RUNTIME_DEBUGGER_PROBE_VALIDITY.MEASURED
    && strategyProjection.state === RUNTIME_DEBUGGER_PROBE_VALIDITY.BROKEN
  ) {
    state = RUNTIME_DEBUGGER_PROBE_VALIDITY.BROKEN;
    reason = strategyProjection.reason;
    ratioState = state;
    identityRatioState = state;
  }

  return sanitizeRuntimeDebuggerValue({
    schemaVersion: RUNTIME_DEBUGGER_SCANNER_WORK_LEDGER_VERSION,
    phase: phase.trim(),
    state,
    reason,
    settled,
    unavailableFields,
    partialMeasurements: identityMeasurementState === RUNTIME_DEBUGGER_PROBE_VALIDITY.MEASURED
      ? []
      : ['identity_cardinality'],
    automaticHardGate: false,
    approvedOperatingEnvelopeRequired: true,
    optimalityProven: false,
    instrumentationCompletenessProven: false,
    timingDimensionsAreAdditive: false,
    workload,
    workReasons: workload.workReasons || {},
    identityCardinality: {
      state: recognizedIdentityState
        ? identityMeasurementState
        : RUNTIME_DEBUGGER_PROBE_VALIDITY.BROKEN,
      scope: identityScope,
      unavailableFields: identityUnavailableFields,
      uniqueTargetTouches: normalizeLedgerMetric(discovery.uniqueTargetTouches),
      repeatedTargetTouches: normalizeLedgerMetric(discovery.repeatedTargetTouches),
    },
    strategyProjection,
    normalized: {
      mutationsPerFlush: createScaledLedgerRatio(
        observer.mutations,
        observer.flushes,
        { state: ratioState, unit: 'mutations_per_flush' },
      ),
      queueWaitMsPerFlush: createScaledLedgerRatio(
        observer.queueWaitMs,
        observer.flushes,
        { state: ratioState, unit: 'ms_per_flush' },
      ),
      subscriberCallbackMsPer1000Mutations: createScaledLedgerRatio(
        observer.subscriberCallbackMs,
        observer.mutations,
        { state: ratioState, scale: 1000, unit: 'ms_per_1000_mutations' },
      ),
      dirtyRootsPerRoutedMutationGroup: createScaledLedgerRatio(
        routing.dirtyRootTotal,
        routing.routedMutationGroups,
        { state: ratioState, unit: 'roots_per_routed_group' },
      ),
      fullScanShare: createScaledLedgerRatio(
        routing.executedFullScans,
        executedScans,
        { state: ratioState, unit: 'executed_scan_share' },
      ),
      mergeShare: createScaledLedgerRatio(
        routing.merged,
        routing.admissions,
        { state: ratioState, unit: 'scan_admission_share' },
      ),
      candidateDecisionsPerResolvedCandidate: createScaledLedgerRatio(
        discovery.candidateDecisions,
        discovery.resolvedCandidates,
        { state: ratioState, unit: 'decisions_per_candidate' },
      ),
      candidateDecisionsPerUniqueTarget: createScaledLedgerRatio(
        discovery.candidateDecisions,
        discovery.uniqueTargetTouches,
        { state: identityRatioState, unit: 'decisions_per_unique_target' },
      ),
      repeatedTouchesPerUniqueTarget: createScaledLedgerRatio(
        discovery.repeatedTargetTouches,
        discovery.uniqueTargetTouches,
        { state: identityRatioState, unit: 'repeated_touches_per_unique_target' },
      ),
      zeroCandidateCollectionShare: createScaledLedgerRatio(
        discovery.zeroCandidateCollections,
        executedScans,
        { state: ratioState, unit: 'executed_scan_share' },
      ),
      semanticCandidatesPerIncrementalTarget: createScaledLedgerRatio(
        discovery.semanticCandidates,
        discovery.semanticOnlyHits,
        { state: ratioState, unit: 'semantic_candidates_per_incremental_target' },
      ),
      semanticIncrementalYield: createScaledLedgerRatio(
        discovery.semanticOnlyHits,
        semanticProvenanceCount,
        { state: ratioState, unit: 'semantic_candidate_share' },
      ),
      selectorMsPer100ResolvedCandidates: createScaledLedgerRatio(
        timings.selectorMs,
        discovery.resolvedCandidates,
        { state: ratioState, scale: 100, unit: 'ms_per_100_resolved_candidates' },
      ),
      semanticMsPerIncrementalTarget: createScaledLedgerRatio(
        timings.semanticMs,
        discovery.semanticOnlyHits,
        { state: ratioState, unit: 'ms_per_incremental_target' },
      ),
      scanElapsedMsPer100UniqueTargets: createScaledLedgerRatio(
        timings.estimatedProductElapsedMs,
        discovery.uniqueTargetTouches,
        {
          state: identityRatioState,
          scale: 100,
          unit: 'estimated_product_elapsed_ms_per_100_unique_targets',
        },
      ),
      applyWritesPerActualWriteDecision: createScaledLedgerRatio(
        effect.applyWrites,
        effect.actualWriteDecisions,
        { state: ratioState, unit: 'writes_per_actual_write_decision' },
      ),
      unchangedWriteAttemptShare: createScaledLedgerRatio(
        effect.unchangedWriteAttempts,
        effect.writeAttempts,
        { state: ratioState, unit: 'write_attempt_share' },
      ),
    },
    debuggerOverhead: overhead,
  });
}

function assessScannerStructuralCheck(definition, values, measurementStates) {
  const measurement = measurementStates?.[definition.measurementKey];
  const measurementState = measurement?.state;
  const rawValue = values?.[definition.metric];
  const numericValue = Number(rawValue);
  const valueMeasured = rawValue !== null
    && rawValue !== undefined
    && Number.isFinite(numericValue)
    && numericValue >= 0;

  if (!RUNTIME_DEBUGGER_PROBE_VALIDITY_VALUES.has(measurementState)) {
    return {
      id: definition.id,
      metric: definition.metric,
      status: 'FAIL',
      measurementState: measurementState || 'missing',
      value: valueMeasured ? numericValue : null,
      reason: 'scanner_measurement_contract_missing',
      evidence: measurement || null,
    };
  }
  if (measurementState === RUNTIME_DEBUGGER_PROBE_VALIDITY.BROKEN) {
    return {
      id: definition.id,
      metric: definition.metric,
      status: 'FAIL',
      measurementState,
      value: valueMeasured ? numericValue : null,
      reason: measurement?.reason || 'scanner_measurement_contract_broken',
      evidence: measurement,
    };
  }
  if (measurementState !== RUNTIME_DEBUGGER_PROBE_VALIDITY.MEASURED) {
    return {
      id: definition.id,
      metric: definition.metric,
      status: 'WARN',
      measurementState,
      value: valueMeasured ? numericValue : null,
      reason: measurement?.reason || 'scanner_measurement_not_measured',
      evidence: measurement,
    };
  }
  if (!valueMeasured) {
    return {
      id: definition.id,
      metric: definition.metric,
      status: 'FAIL',
      measurementState: RUNTIME_DEBUGGER_PROBE_VALIDITY.BROKEN,
      value: null,
      reason: 'scanner_measured_counter_invalid',
      evidence: measurement,
    };
  }
  return {
    id: definition.id,
    metric: definition.metric,
    status: numericValue === 0 ? 'PASS' : 'FAIL',
    measurementState,
    value: numericValue,
    reason: numericValue === 0 ? definition.absentReason : definition.detectedReason,
    evidence: measurement,
  };
}

/**
 * Converts proof-carrying scanner counters into deterministic contracts.
 * Distribution-sensitive cost signals intentionally remain baseline-only: a
 * real-site DOM or duration is not a structural defect by itself.
 */
export function analyzeRuntimeDebuggerScannerEfficiency({
  duplicateScans = null,
  avoidableFullRescans = null,
  measurementStates = {},
} = {}) {
  const values = { duplicateScans, avoidableFullRescans };
  const checks = SCANNER_STRUCTURAL_CHECKS.map((definition) => (
    assessScannerStructuralCheck(definition, values, measurementStates)
  ));
  const status = checks.some((check) => check.status === 'FAIL')
    ? 'FAIL'
    : checks.some((check) => check.status === 'WARN') ? 'WARN' : 'PASS';

  return sanitizeRuntimeDebuggerValue({
    status,
    policy: 'proof_based_structural_contracts',
    agentInterpretationRequired: false,
    approvedBaselineRequired: false,
    checks,
    baselineOnlyMetrics: RUNTIME_DEBUGGER_SCANNER_BASELINE_METRICS,
  });
}

function sumConservationFields(counters, fields) {
  const values = fields.map((field) => normalizeLedgerMetric(counters?.[field]));
  return {
    available: values.every((value) => value !== null),
    values: Object.fromEntries(fields.map((field, index) => [field, values[index]])),
    total: values.every((value) => value !== null)
      ? values.reduce((sum, value) => sum + value, 0)
      : null,
  };
}

/**
 * Verifies that the scanner's monotonic counters form a self-consistent work
 * ledger. These equations prove instrumentation integrity; they intentionally
 * make no claim that the measured amount of work is globally optimal.
 */
export function analyzeRuntimeDebuggerScannerConservation({
  measurementState = RUNTIME_DEBUGGER_PROBE_VALIDITY.UNAVAILABLE,
  counters = {},
} = {}) {
  const recognizedState = RUNTIME_DEBUGGER_PROBE_VALIDITY_VALUES.has(measurementState);
  const checks = SCANNER_CONSERVATION_CHECKS.map((definition) => {
    const left = sumConservationFields(counters, definition.left);
    const right = sumConservationFields(counters, definition.right);
    if (!recognizedState) {
      return {
        id: definition.id,
        status: 'FAIL',
        measurementState: RUNTIME_DEBUGGER_PROBE_VALIDITY.BROKEN,
        reason: 'scanner_conservation_measurement_state_invalid',
        left,
        right,
      };
    }
    if (measurementState === RUNTIME_DEBUGGER_PROBE_VALIDITY.BROKEN) {
      return {
        id: definition.id,
        status: 'FAIL',
        measurementState,
        reason: 'scanner_conservation_owner_broken',
        left,
        right,
      };
    }
    if (measurementState !== RUNTIME_DEBUGGER_PROBE_VALIDITY.MEASURED) {
      return {
        id: definition.id,
        status: 'WARN',
        measurementState,
        reason: 'scanner_conservation_not_measured',
        left,
        right,
      };
    }
    if (!left.available || !right.available) {
      return {
        id: definition.id,
        status: 'FAIL',
        measurementState: RUNTIME_DEBUGGER_PROBE_VALIDITY.BROKEN,
        reason: 'scanner_conservation_counter_missing',
        left,
        right,
      };
    }
    const conserved = left.total === right.total;
    return {
      id: definition.id,
      status: conserved ? 'PASS' : 'FAIL',
      measurementState,
      reason: conserved
        ? 'scanner_counter_equation_conserved'
        : 'scanner_counter_equation_violated',
      left,
      right,
      delta: left.total - right.total,
    };
  });
  return sanitizeRuntimeDebuggerValue({
    status: checks.some((check) => check.status === 'FAIL')
      ? 'FAIL'
      : checks.some((check) => check.status === 'WARN') ? 'WARN' : 'PASS',
    policy: 'proof_based_counter_conservation',
    agentInterpretationRequired: false,
    approvedBaselineRequired: false,
    optimalityProven: false,
    instrumentationCompletenessProven: false,
    checks,
  });
}
