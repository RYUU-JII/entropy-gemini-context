import {
  normalizeInterventionPlan,
  normalizeLaneState,
  normalizeProtectionProfile,
} from '../../contracts/protectionContracts.js';
import { isKnownDomainClassId } from '../../protocol/scope/classCatalog.js';
import { validateProtectionEnvelope } from '../../protocol/contracts/envelope.js';
import { createFilterPlanCompiler } from '../policy/FilterPlanCompiler.js';
import { createEnvelopeAdapter } from './EnvelopeAdapter.js';
import { requireCoolingCurvePlan } from '../../runtime/coolingCurveResolver.js';
import { requireCoolingCurveRuntimeState } from '../../contracts/coolingCurveRuntimeContract.js';

function normalizeHost(hostname) {
  return typeof hostname === 'string' ? hostname.trim().toLowerCase() : '';
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireHostname(hostname) {
  const normalized = normalizeHost(hostname);
  if (!normalized) {
    throw new Error('PROTECTION_RUNTIME_SNAPSHOT_HOSTNAME_REQUIRED');
  }
  return normalized;
}

function requireNonNegativeInteger(value, errorCode) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(errorCode);
  }
  return value;
}

function readNullableNonEmptyString(record, key, errorCode) {
  if (!Object.prototype.hasOwnProperty.call(record, key)) {
    return null;
  }
  const value = record[key];
  if (value !== null && typeof value !== 'string') {
    throw new Error(errorCode);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      throw new Error(errorCode);
    }
    return trimmed;
  }
  return null;
}

function readNullableDomainClassId(record, key, errorCode) {
  const value = readNullableNonEmptyString(record, key, errorCode);
  if (value !== null && !isKnownDomainClassId(value)) {
    throw new Error(errorCode);
  }
  return value;
}

function requireOptionalPlainObject(value, errorCode) {
  if (value === null || value === undefined) {
    return null;
  }
  if (!isPlainObject(value)) {
    throw new Error(errorCode);
  }
  return value;
}

function dedupeReasonCodes(values = []) {
  return Array.from(new Set(
    (Array.isArray(values) ? values : [])
      .filter((item) => typeof item === 'string' && item.trim().length > 0)
  ));
}

function requireDispatchContext(dispatch) {
  if (!isPlainObject(dispatch)) {
    throw new Error('PROTECTION_RUNTIME_SNAPSHOT_DISPATCH_REQUIRED');
  }
  if (typeof dispatch.isBlockedDomain !== 'boolean') {
    throw new Error('PROTECTION_RUNTIME_SNAPSHOT_DISPATCH_FIELD_INVALID:isBlockedDomain');
  }
  const domainClassId = readNullableDomainClassId(
    dispatch,
    'domainClassId',
    'PROTECTION_RUNTIME_SNAPSHOT_DISPATCH_FIELD_INVALID:domainClassId',
  );
  if (
    Object.prototype.hasOwnProperty.call(dispatch, 'shouldApply')
    && typeof dispatch.shouldApply !== 'boolean'
  ) {
    throw new Error('PROTECTION_RUNTIME_SNAPSHOT_DISPATCH_FIELD_INVALID:shouldApply');
  }
  return {
    isBlockedDomain: dispatch.isBlockedDomain,
    shouldApply: Object.prototype.hasOwnProperty.call(dispatch, 'shouldApply')
      ? dispatch.shouldApply
      : null,
    domainClassId,
  };
}

function requireEnvelopeResult(envelopeResult) {
  if (!isPlainObject(envelopeResult)) {
    throw new Error('PROTECTION_RUNTIME_SNAPSHOT_ENVELOPE_RESULT_REQUIRED');
  }
  requireNonNegativeInteger(
    envelopeResult.revision,
    'PROTECTION_RUNTIME_SNAPSHOT_ENVELOPE_FIELD_INVALID:revision',
  );
  if (!isPlainObject(envelopeResult.state)) {
    throw new Error('PROTECTION_RUNTIME_SNAPSHOT_ENVELOPE_FIELD_INVALID:state');
  }
  requireNonNegativeInteger(
    envelopeResult.state.revision,
    'PROTECTION_RUNTIME_SNAPSHOT_ENVELOPE_FIELD_INVALID:state.revision',
  );
  if (envelopeResult.state.revision !== envelopeResult.revision) {
    throw new Error('PROTECTION_RUNTIME_SNAPSHOT_ENVELOPE_FIELD_INVALID:state.revision');
  }
  if (!isPlainObject(envelopeResult.state.compiledFeatures)) {
    throw new Error('PROTECTION_RUNTIME_SNAPSHOT_ENVELOPE_FIELD_INVALID:state.compiledFeatures');
  }
  if (!isPlainObject(envelopeResult.state.activation)) {
    throw new Error('PROTECTION_RUNTIME_SNAPSHOT_ENVELOPE_FIELD_INVALID:state.activation');
  }
  if (typeof envelopeResult.state.activation.main !== 'boolean') {
    throw new Error('PROTECTION_RUNTIME_SNAPSHOT_ENVELOPE_FIELD_INVALID:state.activation.main');
  }
  if (!isPlainObject(envelopeResult.state.activation.features)) {
    throw new Error('PROTECTION_RUNTIME_SNAPSHOT_ENVELOPE_FIELD_INVALID:state.activation.features');
  }
  if (!isPlainObject(envelopeResult.envelope)) {
    throw new Error('PROTECTION_RUNTIME_SNAPSHOT_ENVELOPE_FIELD_INVALID:envelope');
  }
  requireNonNegativeInteger(
    envelopeResult.envelope.revision,
    'PROTECTION_RUNTIME_SNAPSHOT_ENVELOPE_FIELD_INVALID:envelope.revision',
  );
  if (envelopeResult.envelope.revision !== envelopeResult.revision) {
    throw new Error('PROTECTION_RUNTIME_SNAPSHOT_ENVELOPE_FIELD_INVALID:envelope.revision');
  }
  if (!isKnownDomainClassId(envelopeResult.envelope.domainClassId)) {
    throw new Error('PROTECTION_RUNTIME_SNAPSHOT_ENVELOPE_FIELD_INVALID:envelope.domainClassId');
  }
  if (!isPlainObject(envelopeResult.envelope.trace)) {
    throw new Error('PROTECTION_RUNTIME_SNAPSHOT_ENVELOPE_FIELD_INVALID:envelope.trace');
  }
  const envelopeValidation = validateProtectionEnvelope(envelopeResult.envelope);
  if (!envelopeValidation.ok) {
    throw new Error(
      `PROTECTION_RUNTIME_SNAPSHOT_ENVELOPE_INVALID:${envelopeValidation.error}`,
    );
  }
  return envelopeResult;
}

function resolveRuntimeDispatch({ dispatchContext, envelopeResult }) {
  const shouldApply = envelopeResult.state.activation.main;
  const traceId = readNullableNonEmptyString(
    envelopeResult.envelope.trace,
    'traceId',
    'PROTECTION_RUNTIME_SNAPSHOT_ENVELOPE_FIELD_INVALID:envelope.trace.traceId',
  );
  if (dispatchContext.shouldApply !== null && dispatchContext.shouldApply !== shouldApply) {
    throw new Error('PROTECTION_RUNTIME_SNAPSHOT_DISPATCH_MISMATCH:shouldApply');
  }
  if (
    dispatchContext.domainClassId !== null
    && dispatchContext.domainClassId !== envelopeResult.envelope.domainClassId
  ) {
    throw new Error('PROTECTION_RUNTIME_SNAPSHOT_DISPATCH_MISMATCH:domainClassId');
  }
  return {
    isBlockedDomain: dispatchContext.isBlockedDomain,
    shouldApply,
    domainClassId: envelopeResult.envelope.domainClassId,
    traceId,
  };
}

function buildEffectiveRuntimePlan(normalizedPlan, compiledFeatures) {
  return normalizeInterventionPlan({
    ...normalizedPlan,
    filterPlan: compiledFeatures,
  });
}

export function createRuntimeSnapshotBuilder({
  envelopeAdapter = createEnvelopeAdapter(),
  filterPlanCompiler = createFilterPlanCompiler(),
} = {}) {
  function buildNoopPlan(reasonCodes = []) {
    return normalizeInterventionPlan({
      state: {
        level: 1,
        reasons: dedupeReasonCodes(reasonCodes),
      },
      lanes: normalizeLaneState({}),
      filterPlan: filterPlanCompiler.compile({ lanes: {} }),
      artifacts: {},
      trace: {
        budgetRatio: 0,
        pressureSignals: [],
        directTriggers: [],
      },
    });
  }

  function build({
    hostname,
    profile = null,
    plan = null,
    baseFilters = null,
    canonicalArtifacts = null,
    runtimeModifiers = [],
    coolingCurvePlan,
    coolingCurveApplicationOverride = null,
    scope = null,
    policy = null,
    dispatch = null,
    trace = null,
    previousEnvelopeState = null,
    previousRevision = 0,
    forceSnapshot = false,
    mainEnabled = null,
    strategy = null,
    recovery = null,
    effectiveness = null,
  } = {}) {
    const normalizedHostname = requireHostname(hostname);
    const normalizedCoolingCurvePlan = requireCoolingCurvePlan(coolingCurvePlan);
    const normalizedProfile = profile ? normalizeProtectionProfile(profile) : null;
    const normalizedPlan = plan
      ? normalizeInterventionPlan(plan)
      : buildNoopPlan(trace?.reasonCodes);
    const normalizedScope = requireOptionalPlainObject(
      scope,
      'PROTECTION_RUNTIME_SNAPSHOT_SCOPE_INVALID',
    );
    const normalizedPolicy = requireOptionalPlainObject(
      policy,
      'PROTECTION_RUNTIME_SNAPSHOT_POLICY_INVALID',
    );
    const normalizedStrategy = requireOptionalPlainObject(
      strategy,
      'PROTECTION_RUNTIME_SNAPSHOT_STRATEGY_INVALID',
    );
    const normalizedRecovery = requireOptionalPlainObject(
      recovery,
      'PROTECTION_RUNTIME_SNAPSHOT_RECOVERY_INVALID',
    );
    const normalizedEffectiveness = requireOptionalPlainObject(
      effectiveness,
      'PROTECTION_RUNTIME_SNAPSHOT_EFFECTIVENESS_INVALID',
    );
    const dispatchContext = requireDispatchContext(dispatch);
    const scopeDomainClassId = normalizedScope
      ? readNullableDomainClassId(
        normalizedScope,
        'domainClassId',
        'PROTECTION_RUNTIME_SNAPSHOT_SCOPE_FIELD_INVALID:domainClassId',
      )
      : null;
    const initialDomainClassId = dispatchContext.domainClassId
      ?? scopeDomainClassId
      ?? null;
    const envelopeResult = envelopeAdapter.buildEnvelope({
      hostname: normalizedHostname,
      profile: normalizedProfile,
      plan: normalizedPlan,
      baseFilters,
      canonicalArtifacts,
      runtimeModifiers,
      coolingCurvePlan: normalizedCoolingCurvePlan,
      coolingCurveApplicationOverride,
      previousEnvelopeState,
      previousRevision,
      forceSnapshot,
      domainClassId: initialDomainClassId,
      trace,
      mainEnabled,
    });
    const resolvedEnvelopeResult = requireEnvelopeResult(envelopeResult);
    const curveState = requireCoolingCurveRuntimeState(resolvedEnvelopeResult.state.coolingCurve);
    if (Object.keys(curveState).some(key => curveState[key] !== normalizedCoolingCurvePlan.coolingCurve[key]
      || resolvedEnvelopeResult.envelope.coolingCurve[key] !== curveState[key])) {
      throw new Error('PROTECTION_RUNTIME_SNAPSHOT_COOLING_CURVE_MISMATCH');
    }
    const resolvedTrace = resolvedEnvelopeResult.envelope.trace;
    const effectivePlan = buildEffectiveRuntimePlan(
      normalizedPlan,
      resolvedEnvelopeResult.state.compiledFeatures,
    );
    const runtimeDispatch = resolveRuntimeDispatch({
      dispatchContext,
      envelopeResult: resolvedEnvelopeResult,
    });

    return {
      hostname: normalizedHostname,
      coolingCurve: { ...normalizedCoolingCurvePlan.coolingCurve },
      profile: normalizedProfile,
      scope: normalizedScope,
      plan: effectivePlan,
      requestedPlan: normalizedPlan,
      policy: normalizedPolicy,
      dispatch: runtimeDispatch,
      trace: resolvedTrace,
      envelopeResult: resolvedEnvelopeResult,
      strategy: normalizedStrategy ? { ...normalizedStrategy } : null,
      recovery: normalizedRecovery ? { ...normalizedRecovery } : null,
      effectiveness: normalizedEffectiveness ? { ...normalizedEffectiveness } : null,
    };
  }

  return {
    build,
    buildNoopPlan,
  };
}
