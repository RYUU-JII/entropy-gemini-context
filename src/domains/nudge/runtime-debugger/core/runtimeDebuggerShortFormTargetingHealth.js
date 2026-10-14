import {
  TARGETING_HEALTH_ACTIVATION,
  TARGETING_HEALTH_DRIFT,
  TARGETING_HEALTH_EFFECT,
  TARGETING_HEALTH_OPPORTUNITY,
  TARGETING_HEALTH_OPPORTUNITY_SOURCE,
  TARGETING_HEALTH_RESOLUTION,
  TARGETING_HEALTH_VALIDITY,
  createTargetingHealthProjector,
} from '../../core/targetingHealthContract.js';

const projectShortFormTargetingHealth = createTargetingHealthProjector({
  ownerId: 'short_form',
  opportunitySource: TARGETING_HEALTH_OPPORTUNITY_SOURCE.INDEPENDENT,
});

const INVALID_RESOLUTION_REASONS = new Set([
  'short_form_owner_observer_missing',
  'short_form_opportunity_oracle_missing',
  'short_form_opportunity_ledger_inconsistent',
  'short_form_site_evidence_mismatch',
]);

function requireBoolean(value, field) {
  if (typeof value !== 'boolean') {
    throw new Error(`RUNTIME_DEBUGGER_TARGETING_HEALTH_${field.toUpperCase()}_BOOLEAN_REQUIRED`);
  }
}

function requireCompleteness(completeness) {
  if (!completeness || typeof completeness !== 'object' || Array.isArray(completeness)) {
    throw new Error('RUNTIME_DEBUGGER_SHORT_FORM_COMPLETENESS_REQUIRED');
  }
  if (!Object.values(TARGETING_HEALTH_VALIDITY).includes(completeness.state)) {
    throw new Error('RUNTIME_DEBUGGER_SHORT_FORM_COMPLETENESS_STATE_INVALID');
  }
  if (typeof completeness.reason !== 'string' || completeness.reason.length === 0) {
    throw new Error('RUNTIME_DEBUGGER_SHORT_FORM_COMPLETENESS_REASON_REQUIRED');
  }
  requireBoolean(completeness.observerSettled, 'short_form_observer_settled');
  [
    'opportunityCount',
    'pendingCount',
    'evidenceGapCount',
  ].forEach((field) => {
    if (!Number.isSafeInteger(completeness[field]) || completeness[field] < 0) {
      throw new Error(`RUNTIME_DEBUGGER_SHORT_FORM_COMPLETENESS_${field.toUpperCase()}_INVALID`);
    }
  });
}

function resolveOpportunity({ active, completeness }) {
  if (!active) return TARGETING_HEALTH_OPPORTUNITY.UNKNOWN;
  if (completeness.opportunityCount > 0) return TARGETING_HEALTH_OPPORTUNITY.OBSERVED;
  if (completeness.state === TARGETING_HEALTH_VALIDITY.ARMED_IDLE) {
    return TARGETING_HEALTH_OPPORTUNITY.ABSENT;
  }
  return TARGETING_HEALTH_OPPORTUNITY.UNKNOWN;
}

function resolveResolution({ active, available, completeness }) {
  if (!active) return TARGETING_HEALTH_RESOLUTION.UNKNOWN;
  if (!available || completeness.state === TARGETING_HEALTH_VALIDITY.UNAVAILABLE) {
    return TARGETING_HEALTH_RESOLUTION.UNAVAILABLE;
  }
  if (INVALID_RESOLUTION_REASONS.has(completeness.reason)) {
    return TARGETING_HEALTH_RESOLUTION.INVALID;
  }
  if (completeness.state === TARGETING_HEALTH_VALIDITY.MEASURED) {
    return TARGETING_HEALTH_RESOLUTION.RESOLVED;
  }
  if (completeness.reason === 'short_form_opportunity_unhandled_after_settle') {
    return TARGETING_HEALTH_RESOLUTION.UNRESOLVED;
  }
  return TARGETING_HEALTH_RESOLUTION.UNKNOWN;
}

function resolveEffect({ active, opportunity, resolution, completeness }) {
  if (!active) return TARGETING_HEALTH_EFFECT.NOT_APPLICABLE;
  if (resolution === TARGETING_HEALTH_RESOLUTION.UNAVAILABLE) {
    return TARGETING_HEALTH_EFFECT.UNKNOWN;
  }
  if (
    resolution === TARGETING_HEALTH_RESOLUTION.UNRESOLVED
    && completeness.observerSettled === true
  ) return TARGETING_HEALTH_EFFECT.FAILED;
  if (completeness.pendingCount > 0) return TARGETING_HEALTH_EFFECT.PENDING;
  if (opportunity === TARGETING_HEALTH_OPPORTUNITY.ABSENT) {
    return TARGETING_HEALTH_EFFECT.NOT_APPLICABLE;
  }
  if (completeness.state === TARGETING_HEALTH_VALIDITY.MEASURED) {
    return TARGETING_HEALTH_EFFECT.APPLIED;
  }
  return TARGETING_HEALTH_EFFECT.UNKNOWN;
}

/**
 * Projects the independent Short-form completeness ledger into the shared
 * content-free health vocabulary. This function neither reuses nor changes the
 * product classifier and a single failure never receives drift authority.
 */
export function projectRuntimeDebuggerShortFormTargetingHealth({
  siteId,
  active,
  available,
  completeness,
} = {}) {
  requireBoolean(active, 'short_form_active');
  requireBoolean(available, 'short_form_available');
  requireCompleteness(completeness);

  const activation = active
    ? TARGETING_HEALTH_ACTIVATION.ACTIVE
    : TARGETING_HEALTH_ACTIVATION.INACTIVE;
  const opportunity = resolveOpportunity({ active, completeness });
  const resolution = resolveResolution({ active, available, completeness });
  const effect = resolveEffect({ active, opportunity, resolution, completeness });
  const terminalFailure = resolution === TARGETING_HEALTH_RESOLUTION.UNRESOLVED
    && completeness.observerSettled === true;
  // The independent oracle intentionally retains its legacy opportunity ledger
  // across activation changes. Once the product owner is inactive those counts
  // are historical evidence, not current owner work or a current evidence gap.
  const pendingCount = active
    ? (terminalFailure ? 0 : completeness.pendingCount)
    : 0;
  const evidenceGapCount = active ? completeness.evidenceGapCount : 0;
  const settled = active
    ? completeness.observerSettled && pendingCount === 0
    : true;
  const validity = active ? completeness.state : TARGETING_HEALTH_VALIDITY.INACTIVE;
  const drift = active && (
    validity === TARGETING_HEALTH_VALIDITY.MEASURED
    || validity === TARGETING_HEALTH_VALIDITY.ARMED_IDLE
  ) ? TARGETING_HEALTH_DRIFT.CLEAR : TARGETING_HEALTH_DRIFT.NOT_EVALUABLE;
  const reasonCode = active ? completeness.reason : 'canonical_activation_absent';

  return projectShortFormTargetingHealth({
    siteId,
    activation,
    opportunity,
    resolution,
    effect,
    settled,
    pendingCount,
    evidenceGapCount,
    validity,
    drift,
    reasonCode,
  });
}
