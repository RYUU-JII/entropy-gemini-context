export const TARGETING_HEALTH_CONTRACT_VERSION = 1;

export const TARGETING_HEALTH_ACTIVATION = Object.freeze({
  UNKNOWN: 'unknown',
  INACTIVE: 'inactive',
  ACTIVE: 'active',
});

export const TARGETING_HEALTH_OPPORTUNITY = Object.freeze({
  UNKNOWN: 'unknown',
  ABSENT: 'absent',
  OBSERVED: 'observed',
});

export const TARGETING_HEALTH_OPPORTUNITY_SOURCE = Object.freeze({
  OWNER: 'owner',
  SHADOW: 'shadow',
  INDEPENDENT: 'independent',
});

export const TARGETING_HEALTH_RESOLUTION = Object.freeze({
  UNKNOWN: 'unknown',
  RESOLVED: 'resolved',
  UNRESOLVED: 'unresolved',
  INVALID: 'invalid',
  UNAVAILABLE: 'unavailable',
});

export const TARGETING_HEALTH_EFFECT = Object.freeze({
  UNKNOWN: 'unknown',
  NOT_APPLICABLE: 'not_applicable',
  PENDING: 'pending',
  APPLIED: 'applied',
  RESTORED: 'restored',
  FAILED: 'failed',
});

export const TARGETING_HEALTH_VALIDITY = Object.freeze({
  INACTIVE: 'inactive',
  UNAVAILABLE: 'unavailable',
  ARMED_IDLE: 'armed_idle',
  MEASURED: 'measured',
  BROKEN: 'broken',
  INSUFFICIENT: 'insufficient',
});

export const TARGETING_HEALTH_DRIFT = Object.freeze({
  NOT_EVALUABLE: 'not_evaluable',
  CLEAR: 'clear',
  SUSPECTED: 'suspected',
});

export const TARGETING_HEALTH_VOCABULARY = Object.freeze({
  activation: TARGETING_HEALTH_ACTIVATION,
  opportunity: TARGETING_HEALTH_OPPORTUNITY,
  opportunitySource: TARGETING_HEALTH_OPPORTUNITY_SOURCE,
  resolution: TARGETING_HEALTH_RESOLUTION,
  effect: TARGETING_HEALTH_EFFECT,
  validity: TARGETING_HEALTH_VALIDITY,
  drift: TARGETING_HEALTH_DRIFT,
});

const SNAPSHOT_INPUT_KEYS = Object.freeze([
  'ownerId',
  'siteId',
  'activation',
  'opportunity',
  'opportunitySource',
  'resolution',
  'effect',
  'settled',
  'pendingCount',
  'evidenceGapCount',
  'validity',
  'drift',
  'reasonCode',
]);
const SNAPSHOT_KEYS = Object.freeze([
  'contractVersion',
  ...SNAPSHOT_INPUT_KEYS,
]);
const PROJECTOR_INPUT_KEYS = Object.freeze(
  SNAPSHOT_INPUT_KEYS.filter((key) => key !== 'ownerId' && key !== 'opportunitySource'),
);
const PROJECTOR_CONFIG_KEYS = Object.freeze(['ownerId', 'opportunitySource']);
const OWNER_OR_SITE_ID_PATTERN = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/u;
const REASON_CODE_PATTERN = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/u;

function fail(code) {
  throw new Error(`TARGETING_HEALTH_${code}`);
}

function requireRecord(value, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${code}_REQUIRED`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    fail(`${code}_PLAIN_OBJECT_REQUIRED`);
  }
  return value;
}

function requireExactKeys(value, keys, code) {
  const expected = new Set(keys);
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some((key) => typeof key !== 'string')) {
    fail(`${code}_SYMBOL_FIELD_INVALID`);
  }
  const actual = ownKeys;
  const unexpected = actual.find((key) => !expected.has(key));
  if (unexpected) fail(`${code}_UNKNOWN_FIELD_${unexpected.toUpperCase()}`);
  for (const key of actual) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor) fail(`${code}_FIELD_${key.toUpperCase()}_DESCRIPTOR_INVALID`);
    if (!Object.hasOwn(descriptor, 'value')) {
      fail(`${code}_FIELD_${key.toUpperCase()}_DATA_PROPERTY_REQUIRED`);
    }
    if (descriptor.enumerable !== true) {
      fail(`${code}_FIELD_${key.toUpperCase()}_NOT_ENUMERABLE`);
    }
  }
  const actualSet = new Set(actual);
  const missing = keys.find((key) => !actualSet.has(key));
  if (missing) fail(`${code}_MISSING_FIELD_${missing.toUpperCase()}`);
}

function requireIdentifier(value, field, { nullable = false, reasonCode = false } = {}) {
  if (nullable && value === null) return;
  const limit = reasonCode ? 128 : 64;
  const pattern = reasonCode ? REASON_CODE_PATTERN : OWNER_OR_SITE_ID_PATTERN;
  if (typeof value !== 'string' || value.length === 0 || value.length > limit || !pattern.test(value)) {
    fail(`${field.toUpperCase()}_INVALID`);
  }
}

function requireEnum(value, vocabulary, field) {
  if (!Object.values(vocabulary).includes(value)) fail(`${field.toUpperCase()}_INVALID`);
}

function requireCount(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) fail(`${field.toUpperCase()}_INVALID`);
}

function validateCanonicalInvariants(snapshot) {
  const hasKnownSite = snapshot.siteId !== null && snapshot.siteId !== 'unknown';
  const hasPendingEffect = snapshot.effect === TARGETING_HEALTH_EFFECT.PENDING;
  if (
    hasPendingEffect
    && (
      snapshot.activation !== TARGETING_HEALTH_ACTIVATION.ACTIVE
      || snapshot.pendingCount === 0
    )
  ) {
    fail('PENDING_EFFECT_EVIDENCE_INVALID');
  }
  const isInactive = snapshot.activation === TARGETING_HEALTH_ACTIVATION.INACTIVE;
  const hasInactiveValidity = snapshot.validity === TARGETING_HEALTH_VALIDITY.INACTIVE;
  if (isInactive !== hasInactiveValidity) fail('INACTIVE_VALIDITY_MISMATCH');
  if (
    isInactive
    && (
      snapshot.pendingCount !== 0
      || snapshot.effect !== TARGETING_HEALTH_EFFECT.NOT_APPLICABLE
      || snapshot.opportunity !== TARGETING_HEALTH_OPPORTUNITY.UNKNOWN
      || snapshot.resolution !== TARGETING_HEALTH_RESOLUTION.UNKNOWN
      || snapshot.settled !== true
      || snapshot.evidenceGapCount !== 0
      || snapshot.drift !== TARGETING_HEALTH_DRIFT.NOT_EVALUABLE
    )
  ) fail('INACTIVE_EFFECT_INVALID');
  if (snapshot.settled === true && snapshot.pendingCount > 0) {
    fail('SETTLED_PENDING_COUNT_MISMATCH');
  }

  const hasUnavailableResolution = (
    snapshot.resolution === TARGETING_HEALTH_RESOLUTION.UNAVAILABLE
  );
  const hasUnavailableValidity = snapshot.validity === TARGETING_HEALTH_VALIDITY.UNAVAILABLE;
  if (hasUnavailableResolution !== hasUnavailableValidity) {
    fail('UNAVAILABLE_RESOLUTION_VALIDITY_MISMATCH');
  }
  if (
    hasUnavailableValidity
    && (
      snapshot.effect !== TARGETING_HEALTH_EFFECT.UNKNOWN
      || snapshot.drift !== TARGETING_HEALTH_DRIFT.NOT_EVALUABLE
    )
  ) fail('UNAVAILABLE_EVIDENCE_INVALID');

  const hasTerminalResolution = [
    TARGETING_HEALTH_RESOLUTION.RESOLVED,
    TARGETING_HEALTH_RESOLUTION.UNRESOLVED,
  ].includes(snapshot.resolution);
  if (
    hasTerminalResolution
    && snapshot.opportunity !== TARGETING_HEALTH_OPPORTUNITY.OBSERVED
  ) fail('RESOLUTION_OPPORTUNITY_MISMATCH');

  if (
    snapshot.resolution === TARGETING_HEALTH_RESOLUTION.INVALID
    && snapshot.validity !== TARGETING_HEALTH_VALIDITY.BROKEN
  ) fail('INVALID_RESOLUTION_VALIDITY_MISMATCH');

  const hasSuccessfulEffect = [
    TARGETING_HEALTH_EFFECT.APPLIED,
    TARGETING_HEALTH_EFFECT.RESTORED,
  ].includes(snapshot.effect);
  if (
    hasSuccessfulEffect
    && (
      snapshot.activation !== TARGETING_HEALTH_ACTIVATION.ACTIVE
      || snapshot.opportunity !== TARGETING_HEALTH_OPPORTUNITY.OBSERVED
      || snapshot.resolution !== TARGETING_HEALTH_RESOLUTION.RESOLVED
      || snapshot.settled !== true
      || snapshot.pendingCount !== 0
    )
  ) fail('TERMINAL_EFFECT_EVIDENCE_INVALID');

  if (
    snapshot.effect === TARGETING_HEALTH_EFFECT.FAILED
    && (
      snapshot.activation !== TARGETING_HEALTH_ACTIVATION.ACTIVE
      || snapshot.opportunity !== TARGETING_HEALTH_OPPORTUNITY.OBSERVED
      || ![
        TARGETING_HEALTH_RESOLUTION.UNRESOLVED,
        TARGETING_HEALTH_RESOLUTION.INVALID,
      ].includes(snapshot.resolution)
      || snapshot.settled !== true
      || snapshot.pendingCount !== 0
      || snapshot.validity !== TARGETING_HEALTH_VALIDITY.BROKEN
    )
  ) fail('FAILED_EFFECT_EVIDENCE_INVALID');

  if (snapshot.validity === TARGETING_HEALTH_VALIDITY.ARMED_IDLE) {
    if (
      !hasKnownSite
      || snapshot.activation !== TARGETING_HEALTH_ACTIVATION.ACTIVE
      || snapshot.opportunity !== TARGETING_HEALTH_OPPORTUNITY.ABSENT
      || snapshot.resolution !== TARGETING_HEALTH_RESOLUTION.UNKNOWN
      || snapshot.effect !== TARGETING_HEALTH_EFFECT.NOT_APPLICABLE
      || snapshot.settled !== true
      || snapshot.pendingCount !== 0
      || snapshot.evidenceGapCount !== 0
      || snapshot.drift !== TARGETING_HEALTH_DRIFT.CLEAR
    ) fail('ARMED_IDLE_EVIDENCE_INVALID');
  }

  if (snapshot.validity === TARGETING_HEALTH_VALIDITY.MEASURED) {
    if (
      !hasKnownSite
      || snapshot.activation !== TARGETING_HEALTH_ACTIVATION.ACTIVE
      || snapshot.opportunity !== TARGETING_HEALTH_OPPORTUNITY.OBSERVED
      || snapshot.resolution !== TARGETING_HEALTH_RESOLUTION.RESOLVED
      || !hasSuccessfulEffect
      || snapshot.settled !== true
      || snapshot.pendingCount !== 0
      || snapshot.evidenceGapCount !== 0
      || ![
        TARGETING_HEALTH_DRIFT.CLEAR,
        TARGETING_HEALTH_DRIFT.NOT_EVALUABLE,
      ].includes(snapshot.drift)
    ) fail('MEASURED_EVIDENCE_INVALID');
  }

  if (snapshot.drift === TARGETING_HEALTH_DRIFT.CLEAR) {
    // A successful owner operation proves its observed effects, not the
    // completeness of discovery. Only an independent opportunity denominator
    // can support a claim that selector drift is absent.
    if (snapshot.opportunitySource !== TARGETING_HEALTH_OPPORTUNITY_SOURCE.INDEPENDENT) {
      fail('CLEAR_DRIFT_INDEPENDENT_OPPORTUNITY_REQUIRED');
    }
    const absenceProven = snapshot.opportunity === TARGETING_HEALTH_OPPORTUNITY.ABSENT
      && snapshot.effect === TARGETING_HEALTH_EFFECT.NOT_APPLICABLE;
    const resolutionProven = snapshot.opportunity === TARGETING_HEALTH_OPPORTUNITY.OBSERVED
      && snapshot.resolution === TARGETING_HEALTH_RESOLUTION.RESOLVED
      && hasSuccessfulEffect;
    if (
      !hasKnownSite
      || snapshot.activation !== TARGETING_HEALTH_ACTIVATION.ACTIVE
      || snapshot.settled !== true
      || snapshot.evidenceGapCount !== 0
      || ![
        TARGETING_HEALTH_VALIDITY.ARMED_IDLE,
        TARGETING_HEALTH_VALIDITY.MEASURED,
      ].includes(snapshot.validity)
      || (!absenceProven && !resolutionProven)
    ) fail('CLEAR_DRIFT_EVIDENCE_INVALID');
  }

  if (snapshot.drift === TARGETING_HEALTH_DRIFT.SUSPECTED) {
    if (
      !hasKnownSite
      || snapshot.activation !== TARGETING_HEALTH_ACTIVATION.ACTIVE
      || snapshot.opportunity !== TARGETING_HEALTH_OPPORTUNITY.OBSERVED
      || snapshot.resolution !== TARGETING_HEALTH_RESOLUTION.UNRESOLVED
      || snapshot.effect !== TARGETING_HEALTH_EFFECT.FAILED
      || snapshot.settled !== true
      || snapshot.pendingCount !== 0
      || snapshot.evidenceGapCount !== 0
      || snapshot.validity !== TARGETING_HEALTH_VALIDITY.BROKEN
    ) fail('SUSPECTED_DRIFT_EVIDENCE_INVALID');
  }
}

/**
 * Validates an already-materialized canonical snapshot. Unknown fields fail
 * loudly so DOM, selector, text, path, storage, or recovery payloads cannot be
 * smuggled through this cross-nudge contract.
 */
export function validateTargetingHealthSnapshot(snapshot) {
  requireRecord(snapshot, 'SNAPSHOT');
  requireExactKeys(snapshot, SNAPSHOT_KEYS, 'SNAPSHOT');
  if (snapshot.contractVersion !== TARGETING_HEALTH_CONTRACT_VERSION) {
    fail('CONTRACT_VERSION_INVALID');
  }
  requireIdentifier(snapshot.ownerId, 'owner_id');
  requireIdentifier(snapshot.siteId, 'site_id', { nullable: true });
  requireEnum(snapshot.activation, TARGETING_HEALTH_ACTIVATION, 'activation');
  requireEnum(snapshot.opportunity, TARGETING_HEALTH_OPPORTUNITY, 'opportunity');
  requireEnum(
    snapshot.opportunitySource,
    TARGETING_HEALTH_OPPORTUNITY_SOURCE,
    'opportunity_source',
  );
  requireEnum(snapshot.resolution, TARGETING_HEALTH_RESOLUTION, 'resolution');
  requireEnum(snapshot.effect, TARGETING_HEALTH_EFFECT, 'effect');
  if (typeof snapshot.settled !== 'boolean') fail('SETTLED_INVALID');
  requireCount(snapshot.pendingCount, 'pending_count');
  requireCount(snapshot.evidenceGapCount, 'evidence_gap_count');
  requireEnum(snapshot.validity, TARGETING_HEALTH_VALIDITY, 'validity');
  requireEnum(snapshot.drift, TARGETING_HEALTH_DRIFT, 'drift');
  requireIdentifier(snapshot.reasonCode, 'reason_code', { reasonCode: true });
  validateCanonicalInvariants(snapshot);
  return snapshot;
}

/**
 * Materializes and freezes the canonical content-free envelope. Contract
 * version ownership stays here rather than with individual producers.
 */
export function createTargetingHealthSnapshot(fields) {
  requireRecord(fields, 'SNAPSHOT_INPUT');
  requireExactKeys(fields, SNAPSHOT_INPUT_KEYS, 'SNAPSHOT_INPUT');
  const snapshot = {
    contractVersion: TARGETING_HEALTH_CONTRACT_VERSION,
    ...fields,
  };
  validateTargetingHealthSnapshot(snapshot);
  return Object.freeze(snapshot);
}

/**
 * Binds owner identity and evidence provenance without taking over domain
 * inference. The returned projector performs no DOM reads, persistence, or
 * recovery; its caller must explicitly supply every owner-derived state.
 */
export function createTargetingHealthProjector(config) {
  requireRecord(config, 'PROJECTOR_CONFIG');
  requireExactKeys(config, PROJECTOR_CONFIG_KEYS, 'PROJECTOR_CONFIG');
  requireIdentifier(config.ownerId, 'owner_id');
  requireEnum(
    config.opportunitySource,
    TARGETING_HEALTH_OPPORTUNITY_SOURCE,
    'opportunity_source',
  );
  const ownerId = config.ownerId;
  const opportunitySource = config.opportunitySource;
  return Object.freeze((fields) => {
    requireRecord(fields, 'PROJECTOR_INPUT');
    requireExactKeys(fields, PROJECTOR_INPUT_KEYS, 'PROJECTOR_INPUT');
    return createTargetingHealthSnapshot({
      ownerId,
      opportunitySource,
      ...fields,
    });
  });
}
