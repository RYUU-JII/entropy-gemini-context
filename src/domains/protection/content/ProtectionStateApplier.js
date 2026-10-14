import { MESSAGE_TYPES } from '../../../platform/messaging/messageTypes.js';
import { isFrictionDebugEnabled } from '@friction-debug-flags';
import {
  PROTECTION_ENVELOPE_MODE,
  pickEnvelopeFromMessage,
  validateProtectionEnvelope,
} from '../protocol/contracts/envelope.js';
import { FEATURE_KEY_SET, isEffectFeatureKey } from '../protocol/contracts/featureKeys.js';
import {
  MAIN_THREAD_COOPERATIVE_SCHEDULER_ERRORS,
  yieldMainThreadContinuation,
} from '../../../platform/scheduling/mainThreadCooperativeScheduler.js';

let envelopeRuntimeState = null;

const ENVELOPE_STALE_ERRORS = Object.freeze({
  SNAPSHOT_STALE_REVISION: 'SNAPSHOT_STALE_REVISION',
  PATCH_STALE_BASE_REVISION: 'PATCH_STALE_BASE_REVISION',
  PATCH_STALE_REVISION: 'PATCH_STALE_REVISION',
});

function getEnvelopeRevision(value) {
  const revision = Number(value);
  return Number.isFinite(revision) ? revision : null;
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function cloneRecord(value) {
  if (!isPlainObject(value)) return {};
  return Object.entries(value).reduce((acc, [key, entry]) => {
    if (isPlainObject(entry)) {
      acc[key] = { ...entry };
      return acc;
    }
    acc[key] = entry;
    return acc;
  }, {});
}

function applySnapshotEnvelope(envelope) {
  const nextRevision = getEnvelopeRevision(envelope.revision);
  const currentRevision = envelopeRuntimeState === null
    ? null
    : getEnvelopeRevision(envelopeRuntimeState.revision);

  if (
    currentRevision !== null
    && nextRevision !== null
    && nextRevision <= currentRevision
  ) {
    return {
      ok: true,
      stale: true,
      error: ENVELOPE_STALE_ERRORS.SNAPSHOT_STALE_REVISION,
      expectedRevision: currentRevision + 1,
      receivedRevision: nextRevision,
      envelope: envelopeRuntimeState,
    };
  }

  envelopeRuntimeState = {
    version: envelope.version,
    coolingCurve: { ...envelope.coolingCurve },
    mode: PROTECTION_ENVELOPE_MODE.SNAPSHOT,
    revision: nextRevision,
    hostname: envelope.hostname,
    domainClassId: envelope.domainClassId,
    activation: {
      main: envelope.activation.main,
      features: cloneRecord(envelope.activation.features),
    },
    compiledFeatures: cloneRecord(envelope.compiledFeatures),
    featureRevisions: cloneRecord(envelope.featureRevisions),
    trace: isPlainObject(envelope.trace) ? envelope.trace : null,
  };

  return {
    ok: true,
    stale: false,
    envelope: envelopeRuntimeState,
  };
}

function applyPatchEnvelope(envelope) {
  if (!envelopeRuntimeState) {
    return {
      ok: false,
      error: 'PATCH_WITHOUT_BASE_SNAPSHOT',
    };
  }

  const currentRevision = getEnvelopeRevision(envelopeRuntimeState.revision);
  const baseRevision = getEnvelopeRevision(envelope.baseRevision);
  const nextRevision = getEnvelopeRevision(envelope.revision);

  if (currentRevision === null || baseRevision === null || baseRevision > currentRevision) {
    return {
      ok: false,
      error: 'PATCH_BASE_REVISION_MISMATCH',
      expectedBaseRevision: currentRevision,
      receivedBaseRevision: baseRevision,
    };
  }

  if (baseRevision < currentRevision) {
    return {
      ok: true,
      stale: true,
      error: ENVELOPE_STALE_ERRORS.PATCH_STALE_BASE_REVISION,
      expectedBaseRevision: currentRevision,
      receivedBaseRevision: baseRevision,
      envelope: envelopeRuntimeState,
    };
  }

  if (nextRevision !== null && nextRevision <= currentRevision) {
    return {
      ok: true,
      stale: true,
      error: ENVELOPE_STALE_ERRORS.PATCH_STALE_REVISION,
      expectedRevision: currentRevision + 1,
      receivedRevision: nextRevision,
      expectedBaseRevision: currentRevision,
      receivedBaseRevision: baseRevision,
      envelope: envelopeRuntimeState,
    };
  }

  if (
    envelopeRuntimeState.hostname !== envelope.hostname
  ) {
    return {
      ok: false,
      error: 'PATCH_HOSTNAME_MISMATCH',
    };
  }

  if (
    envelopeRuntimeState.domainClassId !== envelope.domainClassId
  ) {
    return {
      ok: false,
      error: 'PATCH_CLASS_MISMATCH',
    };
  }

  const previousState = envelopeRuntimeState;
  const patch = envelope.patch;
  const nextActivationFeatures = cloneRecord(previousState.activation.features);
  Object.entries(cloneRecord(patch.activationUpserts)).forEach(([key, value]) => {
    nextActivationFeatures[key] = value;
  });
  patch.activationRemoves.forEach((key) => {
    delete nextActivationFeatures[key];
  });

  const nextCompiledFeatures = cloneRecord(previousState.compiledFeatures);
  Object.entries(cloneRecord(patch.compiledUpserts)).forEach(([key, value]) => {
    nextCompiledFeatures[key] = value;
  });
  patch.compiledRemoves.forEach((key) => {
    delete nextCompiledFeatures[key];
  });

  envelopeRuntimeState = {
    version: envelope.version,
    coolingCurve: { ...envelope.coolingCurve },
    mode: PROTECTION_ENVELOPE_MODE.SNAPSHOT,
    revision: nextRevision,
    hostname: envelope.hostname,
    domainClassId: envelope.domainClassId,
    activation: {
      main: typeof patch.main === 'boolean'
        ? patch.main
        : previousState.activation.main,
      features: nextActivationFeatures,
    },
    compiledFeatures: nextCompiledFeatures,
    featureRevisions: {
      ...cloneRecord(previousState.featureRevisions),
      ...cloneRecord(envelope.featureRevisions),
    },
    trace: isPlainObject(envelope.trace) ? envelope.trace : previousState.trace,
  };

  return {
    ok: true,
    stale: false,
    envelope: envelopeRuntimeState,
  };
}

function resolveEnvelopeRuntimeState(request) {
  const envelope = pickEnvelopeFromMessage(request);
  if (!envelope) return null;

  const validation = validateProtectionEnvelope(envelope);
  if (!validation.ok) {
    return {
      ok: false,
      error: validation.error || 'ENVELOPE_INVALID',
      envelope,
    };
  }

  if (envelope.mode === PROTECTION_ENVELOPE_MODE.SNAPSHOT) {
    const snapshotResult = applySnapshotEnvelope(envelope);
    if (snapshotResult.stale) {
      return {
        ok: true,
        stale: true,
        source: 'envelope_v2_stale_ignored',
        staleReason: snapshotResult.error || 'STALE_ENVELOPE',
        expectedRevision: snapshotResult.expectedRevision ?? null,
        receivedRevision: snapshotResult.receivedRevision ?? null,
        envelope: snapshotResult.envelope,
      };
    }

    return {
      ok: true,
      stale: false,
      source: 'envelope_v2_snapshot',
      envelope: snapshotResult.envelope,
    };
  }

  const patchResult = applyPatchEnvelope(envelope);
  if (patchResult.stale) {
    return {
      ok: true,
      stale: true,
      source: 'envelope_v2_stale_ignored',
      staleReason: patchResult.error || 'STALE_ENVELOPE',
      expectedBaseRevision: patchResult.expectedBaseRevision ?? null,
      receivedBaseRevision: patchResult.receivedBaseRevision ?? null,
      expectedRevision: patchResult.expectedRevision ?? null,
      receivedRevision: patchResult.receivedRevision ?? null,
      envelope: patchResult.envelope,
    };
  }

  if (!patchResult.ok) {
    return {
      ok: false,
      error: patchResult.error || 'PATCH_APPLY_FAILED',
      envelope,
      expectedBaseRevision: patchResult.expectedBaseRevision ?? null,
      receivedBaseRevision: patchResult.receivedBaseRevision ?? null,
    };
  }

  return {
    ok: true,
    stale: false,
    source: 'envelope_v2_patch',
    envelope: patchResult.envelope,
  };
}

export function deriveProtectionActivationState(request) {
  const envelopeResolution = resolveEnvelopeRuntimeState(request);
  if (envelopeResolution?.ok) {
    const envelope = envelopeResolution.envelope;
    return {
      shouldActivate: envelope.activation.main,
      isMonolithOverride: false,
      source: envelopeResolution.source,
      envelope,
      activation: envelope.activation,
      domainClassId: envelope.domainClassId,
      needsResync: false,
      isStale: !!envelopeResolution.stale,
      staleReason: envelopeResolution.staleReason ?? null,
      resyncReason: null,
      expectedBaseRevision: envelopeResolution.expectedBaseRevision ?? null,
      receivedBaseRevision: envelopeResolution.receivedBaseRevision ?? null,
      expectedRevision: envelopeResolution.expectedRevision ?? null,
      receivedRevision: envelopeResolution.receivedRevision ?? null,
    };
  }

  if (envelopeResolution && !envelopeResolution.ok) {
    return {
      shouldActivate: false,
      isMonolithOverride: false,
      source: 'envelope_patch_invalid',
      envelope: null,
      activation: null,
      domainClassId: isPlainObject(envelopeResolution.envelope)
        && typeof envelopeResolution.envelope.domainClassId === 'string'
        ? envelopeResolution.envelope.domainClassId
        : null,
      needsResync: true,
      isStale: false,
      staleReason: null,
      resyncReason: envelopeResolution.error || 'PATCH_APPLY_FAILED',
      expectedBaseRevision: envelopeResolution.expectedBaseRevision ?? null,
      receivedBaseRevision: envelopeResolution.receivedBaseRevision ?? null,
      expectedRevision: null,
      receivedRevision: null,
    };
  }

  return {
    shouldActivate: false,
    isMonolithOverride: false,
    source: 'envelope_required',
    envelope: null,
    activation: null,
    domainClassId: null,
    needsResync: false,
    isStale: false,
    staleReason: null,
    resyncReason: null,
    expectedBaseRevision: null,
    receivedBaseRevision: null,
    expectedRevision: null,
    receivedRevision: null,
  };
}

export function resetProtectionEnvelopeRuntimeStateForTest() {
  envelopeRuntimeState = null;
}

export function buildFiltersToApply(
  compiledFeatures,
  {
    activation = null,
  } = {}
) {
  if (!isPlainObject(compiledFeatures)) {
    throw new Error('COMPILED_FEATURES_INVALID');
  }
  if (!isPlainObject(activation) || !isPlainObject(activation.features)) {
    throw new Error('ACTIVATION_FEATURES_INVALID');
  }

  const next = {};
  for (const [key, value] of Object.entries(compiledFeatures)) {
    if (!FEATURE_KEY_SET.has(key)) {
      throw new Error(`COMPILED_FEATURE_KEY_INVALID:${key}`);
    }
    if (!isPlainObject(value)) {
      throw new Error(`COMPILED_FEATURE_PAYLOAD_INVALID:${key}`);
    }
    const hasActivationEntry = Object.prototype.hasOwnProperty.call(
      activation.features,
      key,
    );
    const activationEntry = hasActivationEntry ? activation.features[key] : null;
    if (hasActivationEntry && !isPlainObject(activationEntry)) {
      throw new Error(`ACTIVATION_FEATURE_PAYLOAD_INVALID:${key}`);
    }
    if (hasActivationEntry && typeof activationEntry.enabled !== 'boolean') {
      throw new Error(`ACTIVATION_FEATURE_ENABLED_INVALID:${key}`);
    }
    const featureEnabled = hasActivationEntry ? activationEntry.enabled === true : false;
    next[key] = {
      ...value,
      isActive: featureEnabled,
    };
  }
  return next;
}

export function buildActiveFilterContext(filters) {
  if (!isPlainObject(filters)) {
    throw new Error('ACTIVE_FILTER_CONTEXT_FILTERS_INVALID');
  }
  return Object.entries(filters)
    .filter(([key, value]) => {
      if (!FEATURE_KEY_SET.has(key)) {
        throw new Error(`ACTIVE_FILTER_CONTEXT_FEATURE_KEY_INVALID:${key}`);
      }
      if (!isPlainObject(value)) {
        throw new Error(`ACTIVE_FILTER_CONTEXT_PAYLOAD_INVALID:${key}`);
      }
      if (typeof value.isActive !== 'boolean') {
        throw new Error(`ACTIVE_FILTER_CONTEXT_ACTIVE_STATE_INVALID:${key}`);
      }
      return isEffectFeatureKey(key) && value.isActive;
    })
    .map(([key, value]) => {
      const labelValue = Object.prototype.hasOwnProperty.call(value, 'value')
        ? value.value
        : 'on';
      return `${key}:${labelValue}`;
    })
    .join(',');
}

function isPromiseLike(value) {
  return value && typeof value.then === 'function';
}

function rethrowCooperativeSchedulerFailure(error) {
  if (Object.values(MAIN_THREAD_COOPERATIVE_SCHEDULER_ERRORS).includes(
    String(error?.message || error),
  )) {
    throw error;
  }
}

export function formatProtectionEffectFailure(error) {
  const message = String(error?.message || error || 'PROTECTION_EFFECT_APPLY_FAILED');
  if (!Array.isArray(error?.errors) || error.errors.length === 0) return message;
  // Chrome's response boundary does not serialize AggregateError.errors.
  // Retain bounded causes without stacks or additional page/context data.
  const causes = error.errors.slice(0, 8).map((cause) => (
    String(cause?.message || cause).slice(0, 400)
  ));
  return `${message}:causes=${JSON.stringify(causes)}:omitted=${Math.max(0, error.errors.length - causes.length)}`;
}

export function applyProtectionEffects(filters, { globalEffects = [], keyedEffects = [], context = null } = {}) {
  globalEffects.forEach((effect) => {
    try {
      const result = effect.update(filters, context);
      if (isPromiseLike(result)) {
        void result.catch((err) => {
          console.warn(`[ProtectionController] Global Effect Error (${effect.label || 'unknown'}):`, err);
        });
      }
    } catch (err) {
      console.warn(`[ProtectionController] Global Effect Error (${effect.label || 'unknown'}):`, err);
    }
  });

  keyedEffects.forEach((effect) => {
    try {
      const config = filters?.[effect.key];
      const result = config?.isActive
        ? effect.mount(config.value, config, context)
        : effect.unmount();
      if (isPromiseLike(result)) {
        void result.catch((err) => {
          console.warn(`[ProtectionController] Keyed Effect Error (${effect.key}):`, err);
        });
      }
    } catch (err) {
      console.warn(`[ProtectionController] Keyed Effect Error (${effect.key}):`, err);
    }
  });
}

export async function applyProtectionEffectsCooperatively(
  filters,
  {
    globalEffects = [],
    keyedEffects = [],
    context = null,
    isCurrent = () => true,
    onStartupApplied = null,
  } = {},
) {
  if (typeof isCurrent !== 'function') {
    throw new Error('PROTECTION_EFFECT_COOPERATIVE_CURRENT_GUARD_REQUIRED');
  }
  const steps = [
    ...globalEffects.map((effect) => ({ kind: 'global', effect })),
    ...keyedEffects.map((effect) => ({ kind: 'keyed', effect })),
  ];
  let invokedEffects = 0;
  const failures = [];
  const startupSettlements = [];
  const measureStartup = isFrictionDebugEnabled();
  let rootStartedAt = null;
  let inputStartedAt = null;
  const startupSteps = [
    ...steps.filter(({ effect }) => effect.startupPhase === 'root'),
    ...steps.filter(({ effect }) => effect.startupPhase === 'input'),
  ];

  const invoke = async (step) => {
    invokedEffects += 1;
    if (step.kind === 'global') {
      try {
        await step.effect.update(filters, context);
      } catch (error) {
        console.warn(
          `[ProtectionController] Global Effect Error (${step.effect.label || 'unknown'}):`,
          error,
        );
        failures.push(error);
      }
    } else {
      try {
        const config = filters?.[step.effect.key];
        if (config?.isActive) {
          await step.effect.mount(config.value, config, context);
        } else {
          await step.effect.unmount();
        }
      } catch (error) {
        console.warn(`[ProtectionController] Keyed Effect Error (${step.effect.key}):`, error);
        failures.push(error);
      }
    }
  };

  // Root writes and input listener installation start in this turn. Their
  // asynchronous inventory work settles later, without delaying input binding.
  for (const step of startupSteps) {
    if (!isCurrent()) break;
    startupSettlements.push(invoke(step));
    if (measureStartup && step.effect.startupPhase === 'root') rootStartedAt = performance.now();
    if (measureStartup && step.effect.startupPhase === 'input') inputStartedAt = performance.now();
  }
  if (isCurrent() && onStartupApplied) {
    try {
      onStartupApplied({ rootStartedAt, inputStartedAt });
    } catch (error) {
      failures.push(error);
    }
  }
  try {
    for (const step of steps) {
      if (startupSteps.includes(step)) continue;
      if (!isCurrent()) break;
      if (invokedEffects > 0) await yieldMainThreadContinuation();
      if (!isCurrent()) break;
      await invoke(step);
    }
  } finally {
    // Each invoke contains and records its failure; none is left unobserved.
    await Promise.all(startupSettlements);
  }

  if (!isCurrent()) {
    return Object.freeze({ completed: false, superseded: true, invokedEffects });
  }
  failures.forEach(rethrowCooperativeSchedulerFailure);
  if (failures.length > 0) {
    throw new AggregateError(failures, 'PROTECTION_EFFECT_APPLICATION_FAILED');
  }
  return Object.freeze({ completed: true, superseded: false, invokedEffects });
}

export function isNudgeMessage(request, { includeDebug = true } = {}) {
  if (!request?.type) return false;
  return request.type === MESSAGE_TYPES.NUDGE_PRESAGE
    || request.type === MESSAGE_TYPES.NUDGE_START
    || request.type === MESSAGE_TYPES.NUDGE_STOP
    || (
      includeDebug
      && (
        request.type === MESSAGE_TYPES.NUDGE_DEBUG_START
        || request.type === MESSAGE_TYPES.NUDGE_DEBUG_CONFIG
        || request.type === MESSAGE_TYPES.NUDGE_DEBUG_SPAWN
        || request.type === MESSAGE_TYPES.NUDGE_DEBUG_SNAPSHOT
        || request.type === MESSAGE_TYPES.NUDGE_DEBUG_WORKER_PROBE
        || request.type === MESSAGE_TYPES.NUDGE_DEBUG_FRAME_WORKER_PROBE
        || request.type === MESSAGE_TYPES.NUDGE_DEBUG_STOP
      )
    );
}
