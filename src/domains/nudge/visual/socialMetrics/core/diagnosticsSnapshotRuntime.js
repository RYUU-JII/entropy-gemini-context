import { resolveSiteId } from '../../../targeting/siteIdentityCatalog.js';
import {
  createSelectorAuditState,
  createSocialMetricsDebugStats,
} from './debugInstrumentation.js';
import { roundMs } from './diagnosticsValueUtils.js';
import {
  projectSocialMetricsTargetingHealth,
} from './targetingHealthProjector.js';

const SOCIAL_METRICS_SCAN_PHASES = new Set([
  'settled',
  'collecting',
  'applying',
  'terminal_cleanup',
]);

function requireTargetingHealthCount(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`SOCIAL_METRICS_TARGETING_HEALTH_${field.toUpperCase()}_INVALID`);
  }
  return value;
}

function requireScanPhase(value) {
  if (!SOCIAL_METRICS_SCAN_PHASES.has(value)) {
    throw new Error('SOCIAL_METRICS_DIAGNOSTICS_SCAN_PHASE_INVALID');
  }
  return value;
}

function normalizeTargetingHealthActivationSignature(value) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function hasTargetingHealthObserverInterest(lifecycle) {
  const plan = lifecycle?.observerInterestPlan;
  return !!plan
    && Array.isArray(plan.observedAttributes)
    && plan.observedAttributes.length > 0
    && typeof plan.signature === 'string'
    && plan.signature.length > 0;
}

function countTargetingHealthPendingWork(scanSnapshot, ownedMutationSnapshot) {
  if (!Number.isSafeInteger(scanSnapshot?.queueLength)) {
    throw new Error('SOCIAL_METRICS_TARGETING_HEALTH_SCAN_QUEUE_REQUIRED');
  }
  if (!Number.isSafeInteger(scanSnapshot?.pendingMutationRootCount)) {
    throw new Error('SOCIAL_METRICS_TARGETING_HEALTH_PENDING_ROOTS_REQUIRED');
  }
  if (!ownedMutationSnapshot || typeof ownedMutationSnapshot !== 'object') {
    throw new Error('SOCIAL_METRICS_TARGETING_HEALTH_PENDING_LEDGER_REQUIRED');
  }
  const ownedMutationPendingCount = requireTargetingHealthCount(
    ownedMutationSnapshot.pendingCount,
    'pending_owned_mutation_count',
  );
  return requireTargetingHealthCount(scanSnapshot.queueLength, 'scan_queue_length')
    + requireTargetingHealthCount(
      scanSnapshot.pendingMutationRootCount,
      'pending_root_count',
    )
    + ownedMutationPendingCount
    + (scanSnapshot.currentScanContext ? 1 : 0)
    + (scanSnapshot.scanTimerScheduled ? 1 : 0)
    + (scanSnapshot.idleScheduled ? 1 : 0);
}

function readDiagnosticsState(statePort) {
  const state = statePort.readSnapshotState();
  if (!state || typeof state !== 'object') {
    throw new Error('SOCIAL_METRICS_DIAGNOSTICS_SNAPSHOT_STATE_REQUIRED');
  }
  if (!state.debugStats || typeof state.debugStats !== 'object') {
    throw new Error('SOCIAL_METRICS_DIAGNOSTICS_SNAPSHOT_STATS_REQUIRED');
  }
  if (typeof state.auditMode !== 'string' || state.auditMode.length === 0) {
    throw new Error('SOCIAL_METRICS_DIAGNOSTICS_SNAPSHOT_AUDIT_MODE_REQUIRED');
  }
  return state;
}

function readTargetingHealthMeasurementEpoch(state) {
  const measurementEpoch = requireTargetingHealthCount(
    state.measurementEpoch,
    'measurement_epoch',
  );
  const measurementEpochStartExecutedScans = requireTargetingHealthCount(
    state.measurementEpochStartExecutedScans,
    'measurement_epoch_start_executed_scans',
  );
  const executedScans = requireTargetingHealthCount(
    state.debugStats.executedScans,
    'executed_scan_count',
  );
  if (measurementEpochStartExecutedScans > executedScans) {
    throw new Error('SOCIAL_METRICS_TARGETING_HEALTH_MEASUREMENT_EPOCH_COUNT_INVALID');
  }
  return {
    measurementEpoch,
    operationCount: executedScans - measurementEpochStartExecutedScans,
    executedScans,
  };
}

export function createSocialMetricsDiagnosticsSnapshotRuntime({
  ownerPort,
  scanPort,
  ownedMutationPort,
  statePort,
} = {}) {
  if (
    typeof ownerPort?.getHost !== 'function'
    || typeof ownerPort?.readLifecycleSnapshot !== 'function'
  ) {
    throw new Error('SOCIAL_METRICS_DIAGNOSTICS_SNAPSHOT_OWNER_PORT_REQUIRED');
  }
  if (typeof scanPort?.readSnapshot !== 'function') {
    throw new Error('SOCIAL_METRICS_DIAGNOSTICS_SNAPSHOT_SCAN_PORT_REQUIRED');
  }
  if (
    typeof ownedMutationPort?.syncObservationContext !== 'function'
    || typeof ownedMutationPort?.getPendingSnapshot !== 'function'
  ) {
    throw new Error('SOCIAL_METRICS_DIAGNOSTICS_SNAPSHOT_OWNED_MUTATION_PORT_REQUIRED');
  }
  if (
    typeof statePort?.readSnapshotState !== 'function'
    || typeof statePort?.isAuditEnabled !== 'function'
  ) {
    throw new Error('SOCIAL_METRICS_DIAGNOSTICS_SNAPSHOT_STATE_PORT_REQUIRED');
  }

  const runtime = Object.freeze({
    getTargetingHealthSnapshot() {
      const lifecycle = ownerPort.readLifecycleSnapshot();
      const scanSnapshot = scanPort.readSnapshot();
      const ownedMutationSnapshot = ownedMutationPort.getPendingSnapshot();
      const state = readDiagnosticsState(statePort);
      const active = lifecycle.activeEngagement || lifecycle.activeExposure;
      const stats = state.debugStats || createSocialMetricsDebugStats(state.auditMode);
      const siteId = resolveSiteId(ownerPort.getHost());
      const {
        measurementEpoch,
        operationCount,
        executedScans,
      } = readTargetingHealthMeasurementEpoch(state);
      const activationSignature = normalizeTargetingHealthActivationSignature(
        lifecycle.lastUpdateSignature,
      );
      const recordedLastOperation = stats.lastScanOperation || null;
      const lastOperation = (
        operationCount > 0
        && recordedLastOperation?.executionOrdinal === executedScans
        && recordedLastOperation.measurementEpoch === measurementEpoch
        && recordedLastOperation.siteId === siteId
        && recordedLastOperation.activationSignature === activationSignature
      ) ? recordedLastOperation : null;
      if (!Array.isArray(lifecycle.compiledScanPlans)) {
        throw new Error('SOCIAL_METRICS_TARGETING_HEALTH_COMPILED_PLANS_REQUIRED');
      }
      return projectSocialMetricsTargetingHealth({
        siteId,
        available: !active || lifecycle.compiledScanPlans.length > 0,
        active,
        observerAttached: lifecycle.observerAttached,
        observerInterestReady: hasTargetingHealthObserverInterest(lifecycle),
        activationContextReady: activationSignature !== null,
        pendingCount: countTargetingHealthPendingWork(scanSnapshot, ownedMutationSnapshot),
        operationCount,
        auditEnabled: lastOperation !== null,
        selectorHitCount: lastOperation === null
          ? 0
          : requireTargetingHealthCount(lastOperation.selectorHitCount, 'selector_hit_count'),
        semanticHitCount: lastOperation === null
          ? 0
          : requireTargetingHealthCount(lastOperation.semanticHitCount, 'semantic_hit_count'),
        candidateEvidenceCount: lastOperation === null
          ? 0
          : requireTargetingHealthCount(lastOperation.candidateCount, 'candidate_evidence_count'),
        revalidationEvidenceCount: lastOperation === null
          ? 0
          : requireTargetingHealthCount(lastOperation.revalidationEvidenceCount, 'revalidation_evidence_count'),
        resolvedTargetCount: lastOperation === null
          ? 0
          : requireTargetingHealthCount(lastOperation.decisionCount, 'resolved_target_count'),
        lastOperationOutcome: lastOperation === null ? 'unknown' : lastOperation.outcome,
        terminalDisposition: lastOperation === null
          ? 'unknown'
          : lastOperation.terminalDisposition,
        terminalDispositionTargetCount: lastOperation === null
          ? 0
          : requireTargetingHealthCount(
            lastOperation.terminalDispositionTargetCount,
            'terminal_disposition_target_count',
          ),
        terminalApplyTargetCount: lastOperation === null
          ? 0
          : requireTargetingHealthCount(
            lastOperation.terminalApplyTargetCount,
            'terminal_apply_target_count',
          ),
        terminalClearTargetCount: lastOperation === null
          ? 0
          : requireTargetingHealthCount(
            lastOperation.terminalClearTargetCount,
            'terminal_clear_target_count',
          ),
        terminalUnknownTargetCount: lastOperation === null
          ? 0
          : requireTargetingHealthCount(
            lastOperation.terminalUnknownTargetCount,
            'terminal_unknown_target_count',
          ),
        terminalUnclassifiedReconciliationWriteCount: lastOperation === null
          ? 0
          : requireTargetingHealthCount(
            lastOperation.terminalUnclassifiedReconciliationWriteCount,
            'terminal_unclassified_reconciliation_write_count',
          ),
      });
    },

    getDebugSnapshot() {
      ownedMutationPort.syncObservationContext();
      const lifecycle = ownerPort.readLifecycleSnapshot();
      const scanSnapshot = scanPort.readSnapshot();
      const ownedMutationPending = ownedMutationPort.getPendingSnapshot();
      const state = readDiagnosticsState(statePort);
      const measurementEpochOperationCount = readTargetingHealthMeasurementEpoch(
        state,
      ).operationCount;
      const scanPhase = requireScanPhase(scanSnapshot.scanPhase);
      const currentScanContext = scanSnapshot.currentScanContext;
      const currentScan = currentScanContext
        ? {
          phase: scanPhase,
          group: currentScanContext.group || null,
          filterKeys: Array.isArray(currentScanContext.filterKeys)
            ? [...currentScanContext.filterKeys]
            : [],
          cursor: scanSnapshot.scanCursor,
          candidateCount: scanSnapshot.scanCandidateCount,
          rootsMode: currentScanContext.roots === null ? 'full' : 'dirty',
          rootCount: Array.isArray(currentScanContext.roots) ? currentScanContext.roots.length : 0,
          mutationKinds: Array.isArray(currentScanContext.routingEvidence?.mutationKinds)
            ? [...currentScanContext.routingEvidence.mutationKinds]
            : [],
          attributeNames: Array.isArray(currentScanContext.routingEvidence?.attributeNames)
            ? [...currentScanContext.routingEvidence.attributeNames]
            : [],
        }
        : null;
      const lastOperation = state.debugStats.lastScanOperation
        ? {
          ...state.debugStats.lastScanOperation,
          filterKeys: [...state.debugStats.lastScanOperation.filterKeys],
          flushIds: [...state.debugStats.lastScanOperation.flushIds],
          mutationKinds: [...state.debugStats.lastScanOperation.mutationKinds],
          attributeNames: [...state.debugStats.lastScanOperation.attributeNames],
        }
        : null;
      const recentOperations = state.debugStats.recentScanOperations.map((entry) => ({
        ...entry,
        filterKeys: [...entry.filterKeys],
        flushIds: [...entry.flushIds],
        mutationKinds: [...entry.mutationKinds],
        attributeNames: [...entry.attributeNames],
      }));
      const timings = Object.fromEntries(Object.entries(state.debugStats.timings).map((
        [key, value],
      ) => (
        [key, key.endsWith('Count') ? value : roundMs(value)]
      )));
      const audit = state.debugStats.audit
        ? {
          ...state.debugStats.audit,
          debugOverheadMs: roundMs(
            state.debugStats.audit.selectorProbeMs
            + state.debugStats.audit.provenanceProbeMs
            + state.debugStats.audit.writeProbeMs
            + state.debugStats.audit.scanEvidenceProbeMs,
          ),
          recentCollections: [...state.debugStats.audit.recentCollections],
          recentDecisions: [...state.debugStats.audit.recentDecisions],
          targetDecisionCounts: { ...state.debugStats.audit.targetDecisionCounts },
          appliedTargetDecisionCounts: { ...state.debugStats.audit.appliedTargetDecisionCounts },
          zeroCandidateCollectionCounts: { ...state.debugStats.audit.zeroCandidateCollectionCounts },
        }
        : createSelectorAuditState(state.auditMode);
      return {
        loaded: true,
        available: true,
        targetingHealth: runtime.getTargetingHealthSnapshot(),
        debugEnabled: statePort.isAuditEnabled(),
        host: ownerPort.getHost(),
        activeEngagement: lifecycle.activeEngagement,
        activeExposure: lifecycle.activeExposure,
        active: lifecycle.activeEngagement || lifecycle.activeExposure,
        activeMetricKeys: [...lifecycle.activeMetricKeys],
        activeScanGroups: lifecycle.activeScanGroups.map((entry) => ({
          group: entry.group,
          filterKeys: Array.isArray(entry.filterKeys) ? [...entry.filterKeys] : [],
        })),
        compiledPlanCount: lifecycle.compiledScanPlans.length,
        metricRootSelectorLength: lifecycle.metricRootSelector.length,
        observerAttached: lifecycle.observerAttached,
        redditShadowObserverRootCount: lifecycle.redditShadowObserverRootCount,
        queueLength: scanSnapshot.queueLength,
        pendingMutationRootCount: scanSnapshot.pendingMutationRootCount,
        pendingOwnedMutationCount: ownedMutationPending.pendingCount,
        oldestOwnedMutationAgeMs: ownedMutationPending.oldestAgeMs,
        ownedMutationMaxAgeMs: ownedMutationPending.maxPendingAgeMs,
        ownedMutationMaxDeliveryLag: ownedMutationPending.maxDeliveryLag,
        ownedMutationObservationEpoch: ownedMutationPending.observationEpoch,
        ownedMutationDeliverySequence: ownedMutationPending.deliverySequence,
        expiredOwnedMutationByAgeCount: ownedMutationPending.ageExpiredCount,
        expiredOwnedMutationByDeliveryCount: ownedMutationPending.deliveryExpiredCount,
        epochInvalidatedOwnedMutationCount: ownedMutationPending.epochInvalidatedCount,
        rootInvalidatedOwnedMutationCount: ownedMutationPending.rootInvalidatedCount,
        unobservedOwnedMutationTargetCount: ownedMutationPending.targetUnobservedCount,
        mismatchedOwnedMutationCount: ownedMutationPending.valueMismatchCount,
        excessOwnedMutationRecordCount: ownedMutationPending.excessRecordCount,
        forceFullScan: scanSnapshot.forceFullScan,
        scanPhase,
        scanTimerScheduled: scanSnapshot.scanTimerScheduled,
        idleScheduled: scanSnapshot.idleScheduled,
        currentScan,
        auditMode: state.auditMode,
        measurementEpoch: state.measurementEpoch,
        measurementEpochOperationCount,
        operations: state.debugStats.scanOperations,
        lastOperation,
        recentOperations,
        timings,
        stats: {
          ...state.debugStats,
          operations: state.debugStats.scanOperations,
          lastMutationPayload: { ...state.debugStats.lastMutationPayload },
          lastQueuedScan: state.debugStats.lastQueuedScan
            ? {
              ...state.debugStats.lastQueuedScan,
              filterKeys: [...state.debugStats.lastQueuedScan.filterKeys],
              mutationKinds: [...state.debugStats.lastQueuedScan.mutationKinds],
              attributeNames: [...state.debugStats.lastQueuedScan.attributeNames],
            }
            : null,
          lastSkippedScan: state.debugStats.lastSkippedScan
            ? {
              ...state.debugStats.lastSkippedScan,
              filterKeys: [...state.debugStats.lastSkippedScan.filterKeys],
            }
            : null,
          lastCandidateCollection: state.debugStats.lastCandidateCollection
            ? { ...state.debugStats.lastCandidateCollection }
            : null,
          lastMutationRouting: state.debugStats.lastMutationRouting
            ? {
              ...state.debugStats.lastMutationRouting,
              routes: state.debugStats.lastMutationRouting.routes.map((route) => ({
                ...route,
                filterKeys: [...route.filterKeys],
                mutationKinds: [...route.mutationKinds],
                attributeNames: [...route.attributeNames],
              })),
            }
            : null,
          lastScanOperation: lastOperation,
          lastOperation,
          recentScanOperations: recentOperations,
          recentOperations,
          workReasonCounts: { ...state.debugStats.workReasonCounts },
          timings,
          audit,
        },
      };
    },
  });
  return runtime;
}
