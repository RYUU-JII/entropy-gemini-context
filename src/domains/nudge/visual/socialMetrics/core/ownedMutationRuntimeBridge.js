import observerHub from '../../../../../lib/dom/ObserverHub.js';
import {
  SOCIAL_METRIC_ATTRS,
} from '../../../core/index.js';
import {
  runWithFastStyleMutationRecorder,
} from '../../FastStyleEngine.js';
import {
  createOwnedMutationLedger,
} from './ownedMutationLedger.js';

const OWNED_MUTATION_ATTRIBUTE_NAMES = new Set([
  SOCIAL_METRIC_ATTRS.ENGAGEMENT,
  SOCIAL_METRIC_ATTRS.EXPOSURE,
  SOCIAL_METRIC_ATTRS.INSTAGRAM_COLLAPSE,
  SOCIAL_METRIC_ATTRS.FACEBOOK_REPLY_LABEL,
  'aria-label',
]);

function requirePortMethod(port, method, errorCode) {
  if (typeof port?.[method] !== 'function') {
    throw new Error(errorCode);
  }
}

export function createSocialMetricsOwnedMutationRuntime({
  nowMs,
  ownerPort,
  diagnosticsPort,
} = {}) {
  if (typeof nowMs !== 'function') {
    throw new Error('SOCIAL_METRICS_OWNED_MUTATION_RUNTIME_CLOCK_REQUIRED');
  }
  requirePortMethod(
    ownerPort,
    'isObserverAttached',
    'SOCIAL_METRICS_OWNED_MUTATION_OWNER_PORT_REQUIRED',
  );
  [
    'isAuditEnabled',
    'recordOwnedMutationLedgerAttempt',
    'recordOwnedMutationFilter',
    'recordWriteAttempt',
    'recordWriteProbeDuration',
    'getNodeIdentity',
    'formatNodeIdentity',
    'registerActualWriteTarget',
  ].forEach((method) => requirePortMethod(
    diagnosticsPort,
    method,
    `SOCIAL_METRICS_OWNED_MUTATION_DIAGNOSTICS_PORT_${method.toUpperCase()}_REQUIRED`,
  ));

  const state = {
    activeCandidateWriteCapture: null,
    activeReconciliationContext: null,
    scanChunkMutationCaptureActive: false,
    activeScanMutationContext: null,
    activeScanMutationPhase: null,
    ledger: createOwnedMutationLedger(),
    observationRoot: null,
    observationEpoch: 0,
    deliverySequence: 0,
    activeObservationContext: null,
  };

  function syncObservationContext() {
    const context = observerHub.getObservationContext?.();
    if (!context) {
      if (state.observationRoot) state.ledger.reset();
      state.observationRoot = null;
      state.observationEpoch = 0;
      state.deliverySequence = 0;
      state.activeObservationContext = null;
      return null;
    }
    if (
      context.observationRoot === state.observationRoot
      && context.observationEpoch === state.observationEpoch
      && context.deliverySequence === state.deliverySequence
    ) {
      return context;
    }
    state.ledger.setObservationContext(context);
    state.observationRoot = context.observationRoot;
    state.observationEpoch = context.observationEpoch;
    state.deliverySequence = context.deliverySequence;
    return context;
  }

  function recordFastStyleMutation(entry = {}, ctx = {}, phase = 'apply', debugEnabled = false) {
    const isOwnedMarker = entry.kind === 'attribute'
      && OWNED_MUTATION_ATTRIBUTE_NAMES.has(entry.name);
    const shouldArmOwnership = entry.changed
      && ownerPort.isObserverAttached()
      && (isOwnedMarker || entry.kind === 'childList');
    if (shouldArmOwnership) {
      const ledgerStartedAt = debugEnabled ? nowMs() : 0;
      const observation = state.activeObservationContext || syncObservationContext();
      const armed = observation ? state.ledger.recordMutation(entry) : false;
      diagnosticsPort.recordOwnedMutationLedgerAttempt({
        enabled: debugEnabled,
        armed,
        durationMs: debugEnabled ? Math.max(0, nowMs() - ledgerStartedAt) : 0,
      });
    }

    if (!debugEnabled) return;
    const probeStartedAt = nowMs();
    let uniqueTarget = false;
    let targetIdentity = null;
    if (entry.target instanceof Element) {
      targetIdentity = diagnosticsPort.getNodeIdentity(entry.target);
      uniqueTarget = entry.changed
        ? diagnosticsPort.registerActualWriteTarget(entry.target)
        : false;
    }
    diagnosticsPort.recordWriteAttempt(ctx, {
      changed: entry.changed === true,
      phase,
      reconciliationDisposition:
        phase === 'post_chunk_cleanup'
        && state.activeReconciliationContext?.target === entry.target
          ? state.activeReconciliationContext.disposition
          : null,
      reconciliationTargetIdentityKey:
        phase === 'post_chunk_cleanup'
        && state.activeReconciliationContext?.target === entry.target
        && targetIdentity
          ? diagnosticsPort.formatNodeIdentity(targetIdentity)
          : null,
      uniqueTarget,
    });
    if (state.activeCandidateWriteCapture) {
      state.activeCandidateWriteCapture.writeAttempts += 1;
      if (entry.changed) {
        state.activeCandidateWriteCapture.actualWrites += 1;
        if (targetIdentity) {
          state.activeCandidateWriteCapture.targetIdentityKeys.add(
            diagnosticsPort.formatNodeIdentity(targetIdentity),
          );
        }
      } else {
        state.activeCandidateWriteCapture.unchangedWriteAttempts += 1;
      }
    }
    diagnosticsPort.recordWriteProbeDuration(
      Math.max(0, nowMs() - probeStartedAt)
        + Math.max(0, Number(entry.evidenceReadMs) || 0),
    );
  }

  function runWithMutationCapture(ctx, phase, operation) {
    const debugEnabled = diagnosticsPort.isAuditEnabled();
    if (!ownerPort.isObserverAttached() && !debugEnabled) return operation();
    const previousObservationContext = state.activeObservationContext;
    state.activeObservationContext = ownerPort.isObserverAttached()
      ? syncObservationContext()
      : null;
    const record = (entry) => recordFastStyleMutation(
      entry,
      state.activeScanMutationContext || ctx,
      typeof phase === 'function' ? phase() : phase,
      debugEnabled,
    );
    const recorder = debugEnabled
      ? record
      : {
        record,
        attributeNames: OWNED_MUTATION_ATTRIBUTE_NAMES,
        includeText: true,
        changedOnly: true,
      };
    try {
      return runWithFastStyleMutationRecorder(recorder, operation);
    } finally {
      state.activeObservationContext = previousObservationContext;
    }
  }

  function runWithCandidateWriteCapture(ctx, operation) {
    const auditEnabled = diagnosticsPort.isAuditEnabled();
    state.activeCandidateWriteCapture = auditEnabled
      ? {
        writeAttempts: 0,
        actualWrites: 0,
        unchangedWriteAttempts: 0,
        targetIdentityKeys: new Set(),
      }
      : null;
    const previousContext = state.activeScanMutationContext;
    const previousPhase = state.activeScanMutationPhase;
    state.activeScanMutationContext = ctx;
    state.activeScanMutationPhase = 'candidate_apply';
    try {
      if (state.scanChunkMutationCaptureActive) return operation();
      return runWithMutationCapture(ctx, 'candidate_apply', operation);
    } finally {
      state.activeScanMutationContext = previousContext;
      state.activeScanMutationPhase = previousPhase;
      state.activeCandidateWriteCapture = null;
    }
  }

  function runWithScanChunkMutationCapture(scanContext, operation) {
    if (!scanContext || state.scanChunkMutationCaptureActive) return operation();
    state.scanChunkMutationCaptureActive = true;
    try {
      return runWithMutationCapture(
        scanContext,
        () => state.activeScanMutationPhase || 'post_chunk_cleanup',
        operation,
      );
    } finally {
      state.scanChunkMutationCaptureActive = false;
      state.activeScanMutationContext = null;
      state.activeScanMutationPhase = null;
    }
  }

  function runWithReconciliationDisposition(target, disposition, operation) {
    if (!(target instanceof Element)) {
      throw new Error('SOCIAL_METRICS_RECONCILIATION_TARGET_REQUIRED');
    }
    if (disposition !== 'apply' && disposition !== 'clear') {
      throw new Error('SOCIAL_METRICS_RECONCILIATION_DISPOSITION_INVALID');
    }
    if (typeof operation !== 'function') {
      throw new Error('SOCIAL_METRICS_RECONCILIATION_OPERATION_REQUIRED');
    }
    const previousContext = state.activeReconciliationContext;
    state.activeReconciliationContext = Object.freeze({ target, disposition });
    try {
      return operation();
    } finally {
      state.activeReconciliationContext = previousContext;
    }
  }

  function filterPayload(payload) {
    syncObservationContext();
    const debugEnabled = diagnosticsPort.isAuditEnabled();
    const filterStartedAt = debugEnabled ? nowMs() : 0;
    const result = state.ledger.filterPayload(payload);
    diagnosticsPort.recordOwnedMutationFilter({
      enabled: debugEnabled,
      consumedCount: result.consumedCount,
      durationMs: debugEnabled ? Math.max(0, nowMs() - filterStartedAt) : 0,
    });
    return result.payload;
  }

  function getActiveCandidateWriteCapture() {
    return state.activeCandidateWriteCapture;
  }

  function getPendingSnapshot() {
    return state.ledger.getPendingSnapshot();
  }

  function resetRuntimeState() {
    state.ledger.reset();
    state.observationRoot = null;
    state.observationEpoch = 0;
    state.deliverySequence = 0;
    state.activeObservationContext = null;
  }

  function resetCaptureState() {
    state.activeCandidateWriteCapture = null;
    state.activeReconciliationContext = null;
    state.scanChunkMutationCaptureActive = false;
    state.activeScanMutationContext = null;
    state.activeScanMutationPhase = null;
  }

  return Object.freeze({
    filterPayload,
    getActiveCandidateWriteCapture,
    getPendingSnapshot,
    resetCaptureState,
    resetRuntimeState,
    runWithCandidateWriteCapture,
    runWithMutationCapture,
    runWithReconciliationDisposition,
    runWithScanChunkMutationCapture,
    syncObservationContext,
  });
}
