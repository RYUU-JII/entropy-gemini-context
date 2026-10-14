import {
  TARGETING_HEALTH_ACTIVATION,
  TARGETING_HEALTH_DRIFT,
  TARGETING_HEALTH_EFFECT,
  TARGETING_HEALTH_OPPORTUNITY,
  TARGETING_HEALTH_OPPORTUNITY_SOURCE,
  TARGETING_HEALTH_RESOLUTION,
  TARGETING_HEALTH_VALIDITY,
  createTargetingHealthProjector,
} from '../../../core/targetingHealthContract.js';

export const SOCIAL_METRICS_TARGETING_HEALTH_OWNER_ID = 'social_metrics';

const projectTargetingHealth = createTargetingHealthProjector({
  ownerId: SOCIAL_METRICS_TARGETING_HEALTH_OWNER_ID,
  opportunitySource: TARGETING_HEALTH_OPPORTUNITY_SOURCE.OWNER,
});

const OPERATION_OUTCOMES = new Set(['unknown', 'completed', 'empty', 'failed', 'cancelled']);
const TERMINAL_OPERATION_OUTCOMES = new Set(['completed', 'empty', 'failed', 'cancelled']);
const TERMINAL_DISPOSITIONS = new Set(['unknown', 'apply', 'clear', 'mixed']);

function requireCount(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`SOCIAL_METRICS_TARGETING_HEALTH_${name.toUpperCase()}_INVALID`);
  }
  return value;
}

function requireBoolean(value, name) {
  if (typeof value !== 'boolean') {
    throw new Error(`SOCIAL_METRICS_TARGETING_HEALTH_${name.toUpperCase()}_INVALID`);
  }
  return value;
}

function requireEnum(value, values, name) {
  if (typeof value !== 'string' || !values.has(value)) {
    throw new Error(`SOCIAL_METRICS_TARGETING_HEALTH_${name.toUpperCase()}_INVALID`);
  }
  return value;
}

function validateOperationFacts({
  operationCount,
  auditEnabled,
  selectorHitCount,
  semanticHitCount,
  candidateEvidenceCount,
  revalidationEvidenceCount,
  resolvedTargetCount,
  lastOperationOutcome,
  terminalDisposition,
  terminalDispositionTargetCount,
  terminalApplyTargetCount,
  terminalClearTargetCount,
  terminalUnknownTargetCount,
  terminalUnclassifiedReconciliationWriteCount,
}) {
  const hasTerminalOperation = TERMINAL_OPERATION_OUTCOMES.has(lastOperationOutcome);
  const hasRecordedEvidence = [
    selectorHitCount,
    semanticHitCount,
    candidateEvidenceCount,
    revalidationEvidenceCount,
    resolvedTargetCount,
    terminalDispositionTargetCount,
    terminalApplyTargetCount,
    terminalClearTargetCount,
    terminalUnknownTargetCount,
    terminalUnclassifiedReconciliationWriteCount,
  ].some((count) => count > 0)
    || lastOperationOutcome !== 'unknown'
    || terminalDisposition !== 'unknown';

  if (operationCount === 0 && (auditEnabled || hasRecordedEvidence)) {
    throw new Error('SOCIAL_METRICS_TARGETING_HEALTH_OPERATION_EVIDENCE_WITHOUT_OPERATION');
  }
  if (auditEnabled !== hasTerminalOperation) {
    throw new Error('SOCIAL_METRICS_TARGETING_HEALTH_TERMINAL_AUDIT_EVIDENCE_MISMATCH');
  }
  if (
    terminalDispositionTargetCount
    !== terminalApplyTargetCount + terminalClearTargetCount + terminalUnknownTargetCount
  ) {
    throw new Error('SOCIAL_METRICS_TARGETING_HEALTH_TERMINAL_TARGET_COUNT_MISMATCH');
  }
  const homogeneousApply = terminalDispositionTargetCount > 0
    && terminalApplyTargetCount === terminalDispositionTargetCount
    && terminalClearTargetCount === 0
    && terminalUnknownTargetCount === 0;
  const homogeneousClear = terminalDispositionTargetCount > 0
    && terminalClearTargetCount === terminalDispositionTargetCount
    && terminalApplyTargetCount === 0
    && terminalUnknownTargetCount === 0;
  const classifiedMixed = terminalApplyTargetCount > 0
    && terminalClearTargetCount > 0
    && terminalUnknownTargetCount === 0;
  const unknownDisposition = terminalDispositionTargetCount === 0
    || terminalUnknownTargetCount > 0;
  const dispositionConsistent = (
    (terminalDisposition === 'apply' && homogeneousApply)
    || (terminalDisposition === 'clear' && homogeneousClear)
    || (terminalDisposition === 'mixed' && classifiedMixed)
    || (terminalDisposition === 'unknown' && unknownDisposition)
  );
  if (!dispositionConsistent) {
    throw new Error('SOCIAL_METRICS_TARGETING_HEALTH_TERMINAL_DISPOSITION_COUNT_MISMATCH');
  }
  if (
    lastOperationOutcome === 'completed'
    && (
      terminalDispositionTargetCount > 0
      || terminalUnclassifiedReconciliationWriteCount > 0
    )
    && (candidateEvidenceCount === 0 || resolvedTargetCount === 0)
    && !(revalidationEvidenceCount > 0
      && terminalApplyTargetCount === 0
      && terminalUnknownTargetCount === 0)
  ) {
    throw new Error('SOCIAL_METRICS_TARGETING_HEALTH_COMPLETED_TERMINAL_EVIDENCE_INVALID');
  }
  if (
    lastOperationOutcome === 'empty'
    && (
      selectorHitCount > 0
      || semanticHitCount > 0
      || candidateEvidenceCount > 0
      || revalidationEvidenceCount > 0
      || resolvedTargetCount > 0
      || terminalDispositionTargetCount > 0
      || terminalUnclassifiedReconciliationWriteCount > 0
      || terminalDisposition !== 'unknown'
    )
  ) {
    throw new Error('SOCIAL_METRICS_TARGETING_HEALTH_EMPTY_OPERATION_EVIDENCE_INVALID');
  }
}

function resolveTerminalEffect({
  active,
  evaluable,
  pendingCount,
  opportunity,
  resolution,
  lastOperationOutcome,
  terminalDisposition,
  terminalDispositionTargetCount,
  terminalUnclassifiedReconciliationWriteCount,
}) {
  if (!active) {
    return {
      effect: TARGETING_HEALTH_EFFECT.NOT_APPLICABLE,
      ambiguous: false,
    };
  }
  if (!evaluable) {
    return {
      effect: TARGETING_HEALTH_EFFECT.UNKNOWN,
      ambiguous: false,
    };
  }
  if (pendingCount > 0) {
    return {
      effect: TARGETING_HEALTH_EFFECT.PENDING,
      ambiguous: false,
    };
  }
  if (terminalUnclassifiedReconciliationWriteCount > 0) {
    return {
      effect: TARGETING_HEALTH_EFFECT.UNKNOWN,
      ambiguous: true,
    };
  }
  if (lastOperationOutcome === 'failed') {
    return {
      effect: opportunity === TARGETING_HEALTH_OPPORTUNITY.OBSERVED
        && resolution === TARGETING_HEALTH_RESOLUTION.INVALID
        && terminalDispositionTargetCount === 0
        ? TARGETING_HEALTH_EFFECT.FAILED
        : TARGETING_HEALTH_EFFECT.UNKNOWN,
      ambiguous: terminalDispositionTargetCount > 0,
    };
  }
  if (lastOperationOutcome !== 'completed') {
    return {
      effect: TARGETING_HEALTH_EFFECT.UNKNOWN,
      ambiguous: terminalDispositionTargetCount > 0,
    };
  }
  if (resolution !== TARGETING_HEALTH_RESOLUTION.RESOLVED) {
    return {
      effect: TARGETING_HEALTH_EFFECT.UNKNOWN,
      ambiguous: terminalDispositionTargetCount > 0,
    };
  }
  if (terminalDisposition === 'apply') {
    return {
      effect: TARGETING_HEALTH_EFFECT.APPLIED,
      ambiguous: false,
    };
  }
  if (terminalDisposition === 'clear') {
    return {
      effect: TARGETING_HEALTH_EFFECT.RESTORED,
      ambiguous: false,
    };
  }
  return {
    effect: TARGETING_HEALTH_EFFECT.UNKNOWN,
    ambiguous: terminalDispositionTargetCount > 0,
  };
}

/**
 * Projects Social Metrics owner facts into the shared content-free envelope.
 * The caller supplies scalar diagnostics only; this function performs no DOM
 * reads, selector queries, persistence, recovery, or actuation.
 */
export function projectSocialMetricsTargetingHealth({
  siteId,
  available,
  active,
  observerAttached,
  observerInterestReady,
  activationContextReady,
  pendingCount,
  operationCount,
  auditEnabled,
  selectorHitCount,
  semanticHitCount,
  candidateEvidenceCount,
  revalidationEvidenceCount,
  resolvedTargetCount,
  lastOperationOutcome,
  terminalDisposition,
  terminalDispositionTargetCount,
  terminalApplyTargetCount,
  terminalClearTargetCount,
  terminalUnknownTargetCount,
  terminalUnclassifiedReconciliationWriteCount,
} = {}) {
  const normalizedAvailable = requireBoolean(available, 'available');
  const normalizedActive = requireBoolean(active, 'active');
  const normalizedObserverAttached = requireBoolean(observerAttached, 'observer_attached');
  const normalizedObserverInterestReady = requireBoolean(
    observerInterestReady,
    'observer_interest_ready',
  );
  const normalizedActivationContextReady = requireBoolean(
    activationContextReady,
    'activation_context_ready',
  );
  const normalizedAuditEnabled = requireBoolean(auditEnabled, 'audit_enabled');
  const normalizedPendingCount = requireCount(pendingCount, 'pending_count');
  const normalizedOperationCount = requireCount(operationCount, 'operation_count');
  const normalizedSelectorHitCount = requireCount(selectorHitCount, 'selector_hit_count');
  const normalizedSemanticHitCount = requireCount(semanticHitCount, 'semantic_hit_count');
  const normalizedCandidateEvidenceCount = requireCount(
    candidateEvidenceCount,
    'candidate_evidence_count',
  );
  const normalizedRevalidationEvidenceCount = requireCount(
    revalidationEvidenceCount,
    'revalidation_evidence_count',
  );
  const normalizedResolvedTargetCount = requireCount(
    resolvedTargetCount,
    'resolved_target_count',
  );
  const normalizedTerminalDispositionTargetCount = requireCount(
    terminalDispositionTargetCount,
    'terminal_disposition_target_count',
  );
  const normalizedTerminalApplyTargetCount = requireCount(
    terminalApplyTargetCount,
    'terminal_apply_target_count',
  );
  const normalizedTerminalClearTargetCount = requireCount(
    terminalClearTargetCount,
    'terminal_clear_target_count',
  );
  const normalizedTerminalUnknownTargetCount = requireCount(
    terminalUnknownTargetCount,
    'terminal_unknown_target_count',
  );
  const normalizedTerminalUnclassifiedReconciliationWriteCount = requireCount(
    terminalUnclassifiedReconciliationWriteCount,
    'terminal_unclassified_reconciliation_write_count',
  );
  const normalizedOperationOutcome = requireEnum(
    lastOperationOutcome,
    OPERATION_OUTCOMES,
    'last_operation_outcome',
  );
  const normalizedTerminalDisposition = requireEnum(
    terminalDisposition,
    TERMINAL_DISPOSITIONS,
    'terminal_disposition',
  );

  validateOperationFacts({
    operationCount: normalizedOperationCount,
    auditEnabled: normalizedAuditEnabled,
    selectorHitCount: normalizedSelectorHitCount,
    semanticHitCount: normalizedSemanticHitCount,
    candidateEvidenceCount: normalizedCandidateEvidenceCount,
    revalidationEvidenceCount: normalizedRevalidationEvidenceCount,
    resolvedTargetCount: normalizedResolvedTargetCount,
    lastOperationOutcome: normalizedOperationOutcome,
    terminalDisposition: normalizedTerminalDisposition,
    terminalDispositionTargetCount: normalizedTerminalDispositionTargetCount,
    terminalApplyTargetCount: normalizedTerminalApplyTargetCount,
    terminalClearTargetCount: normalizedTerminalClearTargetCount,
    terminalUnknownTargetCount: normalizedTerminalUnknownTargetCount,
    terminalUnclassifiedReconciliationWriteCount:
      normalizedTerminalUnclassifiedReconciliationWriteCount,
  });

  const activation = normalizedActive
    ? TARGETING_HEALTH_ACTIVATION.ACTIVE
    : TARGETING_HEALTH_ACTIVATION.INACTIVE;
  const runtimeAvailable = normalizedAvailable
    && (!normalizedActive || (siteId !== null && siteId !== 'unknown'));
  const ownerLifecycleReady = !normalizedActive || (
    normalizedObserverAttached
    && normalizedObserverInterestReady
    && normalizedActivationContextReady
  );
  const hasTerminalOperation = TERMINAL_OPERATION_OUTCOMES.has(normalizedOperationOutcome);
  const settled = !normalizedActive
    ? normalizedPendingCount === 0
    : ownerLifecycleReady && normalizedPendingCount === 0 && hasTerminalOperation;
  const hasObservedCandidate = normalizedActive && (
    normalizedSelectorHitCount > 0
    || normalizedSemanticHitCount > 0
    || normalizedCandidateEvidenceCount > 0
    || normalizedRevalidationEvidenceCount > 0
    || normalizedResolvedTargetCount > 0
    || normalizedTerminalDispositionTargetCount > 0
  );
  const opportunity = hasObservedCandidate
    ? TARGETING_HEALTH_OPPORTUNITY.OBSERVED
    : TARGETING_HEALTH_OPPORTUNITY.UNKNOWN;

  let resolution = TARGETING_HEALTH_RESOLUTION.UNKNOWN;
  if (!normalizedActive) {
    resolution = TARGETING_HEALTH_RESOLUTION.UNKNOWN;
  } else if (!runtimeAvailable) {
    resolution = TARGETING_HEALTH_RESOLUTION.UNAVAILABLE;
  } else if (!ownerLifecycleReady && normalizedActive) {
    resolution = TARGETING_HEALTH_RESOLUTION.INVALID;
  } else if (normalizedOperationOutcome === 'failed') {
    resolution = TARGETING_HEALTH_RESOLUTION.INVALID;
  } else if (
    normalizedOperationOutcome === 'completed'
    && (normalizedResolvedTargetCount > 0 || normalizedRevalidationEvidenceCount > 0)
  ) {
    resolution = TARGETING_HEALTH_RESOLUTION.RESOLVED;
  }

  const terminalEffect = resolveTerminalEffect({
    active: normalizedActive,
    evaluable: runtimeAvailable && ownerLifecycleReady,
    pendingCount: normalizedPendingCount,
    opportunity,
    resolution,
    lastOperationOutcome: normalizedOperationOutcome,
    terminalDisposition: normalizedTerminalDisposition,
    terminalDispositionTargetCount: normalizedTerminalDispositionTargetCount,
    terminalUnclassifiedReconciliationWriteCount:
      normalizedTerminalUnclassifiedReconciliationWriteCount,
  });

  let evidenceGapCount = 0;
  if (normalizedActive && runtimeAvailable && !ownerLifecycleReady) {
    evidenceGapCount += 1;
  } else if (
    normalizedActive
    && runtimeAvailable
    && ownerLifecycleReady
    && normalizedPendingCount === 0
  ) {
    if (!hasTerminalOperation) evidenceGapCount += 1;
    if (hasTerminalOperation && opportunity === TARGETING_HEALTH_OPPORTUNITY.UNKNOWN) {
      evidenceGapCount += 1;
    }
    if (
      opportunity === TARGETING_HEALTH_OPPORTUNITY.OBSERVED
      && resolution === TARGETING_HEALTH_RESOLUTION.UNKNOWN
    ) {
      evidenceGapCount += 1;
    }
    if (
      resolution === TARGETING_HEALTH_RESOLUTION.RESOLVED
      && terminalEffect.effect === TARGETING_HEALTH_EFFECT.UNKNOWN
    ) {
      evidenceGapCount += 1;
    }
    if (terminalEffect.ambiguous) evidenceGapCount += 1;
    if (normalizedOperationOutcome === 'failed') evidenceGapCount += 1;
    if (normalizedOperationOutcome === 'cancelled') evidenceGapCount += 1;
    if (normalizedOperationCount > 0 && !normalizedAuditEnabled) evidenceGapCount += 1;
  }

  let validity = TARGETING_HEALTH_VALIDITY.INSUFFICIENT;
  if (!normalizedActive) {
    validity = TARGETING_HEALTH_VALIDITY.INACTIVE;
  } else if (!runtimeAvailable) {
    validity = TARGETING_HEALTH_VALIDITY.UNAVAILABLE;
  } else if (!ownerLifecycleReady) {
    validity = TARGETING_HEALTH_VALIDITY.BROKEN;
  } else if (normalizedOperationOutcome === 'failed') {
    validity = TARGETING_HEALTH_VALIDITY.BROKEN;
  } else if (
    settled
    && opportunity === TARGETING_HEALTH_OPPORTUNITY.OBSERVED
    && resolution === TARGETING_HEALTH_RESOLUTION.RESOLVED
    && evidenceGapCount === 0
  ) {
    validity = TARGETING_HEALTH_VALIDITY.MEASURED;
  }

  // These are owner-observed targets. Successful terminal effects do not
  // establish how many opportunities remain outside the observed target set.
  const drift = TARGETING_HEALTH_DRIFT.NOT_EVALUABLE;

  let reasonCode = 'targeting_evidence_insufficient';
  if (!normalizedActive) reasonCode = 'feature_inactive';
  else if (!runtimeAvailable) reasonCode = 'runtime_unavailable';
  else if (!normalizedObserverAttached) reasonCode = 'owner_observer_missing';
  else if (!normalizedObserverInterestReady) reasonCode = 'observer_interest_missing';
  else if (!normalizedActivationContextReady) reasonCode = 'activation_context_missing';
  else if (normalizedOperationOutcome === 'failed') reasonCode = 'scan_operation_failed';
  else if (normalizedPendingCount > 0) reasonCode = 'owner_work_pending';
  else if (normalizedOperationOutcome === 'cancelled') reasonCode = 'scan_operation_cancelled';
  else if (!hasTerminalOperation) reasonCode = normalizedOperationCount > 0 && !normalizedAuditEnabled
    ? 'terminal_evidence_unavailable'
    : 'owner_operation_not_observed';
  else if (opportunity === TARGETING_HEALTH_OPPORTUNITY.UNKNOWN) {
    reasonCode = 'opportunity_denominator_unknown';
  } else if (resolution === TARGETING_HEALTH_RESOLUTION.UNKNOWN) {
    reasonCode = 'candidate_resolution_unknown';
  } else if (terminalEffect.ambiguous) reasonCode = 'terminal_effect_ambiguous';
  else if (terminalEffect.effect === TARGETING_HEALTH_EFFECT.UNKNOWN) {
    reasonCode = 'terminal_effect_unknown';
  } else if (terminalEffect.effect === TARGETING_HEALTH_EFFECT.RESTORED) {
    reasonCode = 'observed_target_effect_restored_coverage_unknown';
  } else if (terminalEffect.effect === TARGETING_HEALTH_EFFECT.APPLIED) {
    reasonCode = 'observed_target_effect_applied_coverage_unknown';
  }

  return projectTargetingHealth({
    siteId,
    activation,
    opportunity,
    resolution,
    effect: terminalEffect.effect,
    settled,
    pendingCount: normalizedPendingCount,
    evidenceGapCount,
    validity,
    drift,
    reasonCode,
  });
}
