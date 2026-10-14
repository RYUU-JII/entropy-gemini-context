import {
  buildActiveFilterContext,
  buildFiltersToApply,
  deriveProtectionActivationState,
} from '../ProtectionStateApplier.js';
import { FEATURE_KEY_SET } from '../../protocol/contracts/featureKeys.js';

export const ACTIVATION_ENGINE_ERRORS = Object.freeze({
  RESYNC_REQUIRED: 'RESYNC_REQUIRED',
  ENVELOPE_REQUIRED: 'ENVELOPE_REQUIRED',
  INVALID_COMPILED_FEATURES: 'INVALID_COMPILED_FEATURES',
  INVALID_COMPILED_FEATURE_KEYS: 'INVALID_COMPILED_FEATURE_KEYS',
  INVALID_COMPILED_FEATURE_PAYLOADS: 'INVALID_COMPILED_FEATURE_PAYLOADS',
});

const ENVELOPE_SOURCES = new Set([
  'envelope_v2_snapshot',
  'envelope_v2_patch',
]);

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function validateCompiledFeatures(value) {
  if (!isPlainObject(value)) {
    return { ok: false, error: ACTIVATION_ENGINE_ERRORS.INVALID_COMPILED_FEATURES };
  }
  const keys = Object.keys(value);
  if (keys.length === 0) {
    return { ok: false, error: ACTIVATION_ENGINE_ERRORS.INVALID_COMPILED_FEATURES };
  }
  const unknownKeys = keys.filter((key) => !FEATURE_KEY_SET.has(key));
  if (unknownKeys.length > 0) {
    return {
      ok: false,
      error: ACTIVATION_ENGINE_ERRORS.INVALID_COMPILED_FEATURE_KEYS,
      unknownKeys,
    };
  }
  const invalidPayloadKey = keys.find((key) => !isPlainObject(value[key]));
  if (invalidPayloadKey) {
    return {
      ok: false,
      error: ACTIVATION_ENGINE_ERRORS.INVALID_COMPILED_FEATURE_PAYLOADS,
      invalidPayloadKey,
    };
  }
  return { ok: true, error: null };
}

function createNoopPlan({
  activationState,
  error = null,
} = {}) {
  return {
    source: activationState?.source ?? 'unknown',
    error,
    activationState,
    domainClassId: activationState?.domainClassId ?? null,
    shouldActivate: !!activationState?.shouldActivate,
    shouldClear: false,
    shouldMutate: false,
    filters: {},
    activeFilterContext: '',
  };
}

/**
 * A plan for an update the runtime could not read.
 *
 * "Unreadable" is not "unprotected". The only thing that licenses taking
 * friction off a page is a valid envelope that says this page is not protected;
 * an envelope that is missing or malformed says nothing at all. Clearing on it
 * fails open - the one direction a friction engine must never fail - and does
 * it silently, so a page that is still protected renders unprotected until the
 * next good dispatch happens to arrive.
 *
 * So this holds: whatever is applied stays applied, and the error is carried
 * out for the caller to report.
 */
function createFailedPlan({
  activationState,
  error,
} = {}) {
  return {
    source: activationState?.source ?? 'unknown',
    error,
    activationState,
    domainClassId: activationState?.domainClassId ?? null,
    shouldActivate: false,
    shouldClear: false,
    shouldMutate: false,
    filters: {},
    activeFilterContext: '',
  };
}

export function resolveActivationPlan(request) {
  const activationState = deriveProtectionActivationState(request);

  if (activationState?.needsResync) {
    return createNoopPlan({
      activationState,
      error: ACTIVATION_ENGINE_ERRORS.RESYNC_REQUIRED,
    });
  }

  if (activationState?.isStale) {
    return createNoopPlan({
      activationState,
    });
  }

  if (!ENVELOPE_SOURCES.has(String(activationState?.source || ''))) {
    return createFailedPlan({
      activationState,
      error: ACTIVATION_ENGINE_ERRORS.ENVELOPE_REQUIRED,
    });
  }

  const envelope = activationState?.envelope;
  const sourceFilters = envelope?.compiledFeatures;
  const compiledValidation = validateCompiledFeatures(sourceFilters);
  if (!compiledValidation.ok) {
    return createFailedPlan({
      activationState,
      error: compiledValidation.error,
    });
  }

  const filters = buildFiltersToApply(sourceFilters, {
    activation: activationState?.activation,
  });

  return {
    source: activationState.source,
    error: null,
    activationState,
    domainClassId: activationState.domainClassId,
    shouldActivate: !!activationState.shouldActivate,
    shouldClear: !activationState.shouldActivate,
    shouldMutate: true,
    filters,
    activeFilterContext: buildActiveFilterContext(filters),
  };
}
