import {
  buildPatchEnvelope,
  buildSnapshotEnvelope,
} from '../../../protocol/contracts/envelope.js';
import { FEATURE_KEY_SET } from '../../../protocol/contracts/featureKeys.js';
import { isKnownDomainClassId } from '../../../protocol/scope/classCatalog.js';
import { requireCoolingCurveRuntimeState } from '../../../contracts/coolingCurveRuntimeContract.js';

function isFeaturePayloadEqual(a, b) {
  return JSON.stringify(stableSerializeFeaturePayload(a ?? null))
    === JSON.stringify(stableSerializeFeaturePayload(b ?? null));
}

function stableSerializeFeaturePayload(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((entry) => stableSerializeFeaturePayload(entry));
  }
  if (typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = stableSerializeFeaturePayload(value[key]);
        return acc;
      }, {});
  }
  return value;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireHostname(hostname) {
  if (typeof hostname !== 'string' || !hostname.trim()) {
    throw new Error('PROTECTION_ENVELOPE_HOSTNAME_REQUIRED');
  }
  return hostname.trim().toLowerCase();
}

function requireDomainClassId(domainClassId, errorCode) {
  if (!isKnownDomainClassId(domainClassId)) {
    throw new Error(errorCode);
  }
  return domainClassId;
}

function requirePlainRecord(value, errorCode) {
  if (!isPlainObject(value)) {
    throw new Error(errorCode);
  }
  return value;
}

function requireKnownFeatureRecord(value, errorCode) {
  const record = requirePlainRecord(value, errorCode);
  const invalidKey = Object.keys(record).find((key) => !FEATURE_KEY_SET.has(key));
  if (invalidKey) {
    throw new Error(`${errorCode}_KEY_INVALID:${invalidKey}`);
  }
  return record;
}

function requirePlainFeatureRecord(value, errorCode) {
  const record = requireKnownFeatureRecord(value, errorCode);
  const invalidKey = Object.keys(record).find((key) => !isPlainObject(record[key]));
  if (invalidKey) {
    throw new Error(`${errorCode}_ENTRY_INVALID:${invalidKey}`);
  }
  return record;
}

function requireActivationState(activation, errors) {
  const resolvedActivation = requirePlainRecord(activation, errors.invalid);
  if (typeof resolvedActivation.main !== 'boolean') {
    throw new Error(errors.mainInvalid);
  }
  const features = requirePlainFeatureRecord(
    resolvedActivation.features,
    errors.featuresInvalid,
  );
  const invalidEnabledKey = Object.keys(features).find((key) => (
    typeof features[key].enabled !== 'boolean'
  ));
  if (invalidEnabledKey) {
    throw new Error(`${errors.featureEnabledInvalid}:${invalidEnabledKey}`);
  }
  return resolvedActivation;
}

function requireFeatureRevisionRecord(featureRevisions) {
  const resolvedFeatureRevisions = requireKnownFeatureRecord(
    featureRevisions,
    'PROTECTION_ENVELOPE_DECISION_FEATURE_REVISIONS_INVALID',
  );
  const invalidKey = Object.keys(resolvedFeatureRevisions).find((key) => (
    !Number.isInteger(resolvedFeatureRevisions[key])
    || resolvedFeatureRevisions[key] < 0
  ));
  if (invalidKey) {
    throw new Error(`PROTECTION_ENVELOPE_DECISION_FEATURE_REVISION_INVALID:${invalidKey}`);
  }
  return resolvedFeatureRevisions;
}

function requireFeatureHashRecord(featureHashes, errorCode) {
  const resolvedFeatureHashes = requireKnownFeatureRecord(featureHashes, errorCode);
  const invalidKey = Object.keys(resolvedFeatureHashes).find((key) => (
    typeof resolvedFeatureHashes[key] !== 'string'
  ));
  if (invalidKey) {
    throw new Error(`${errorCode}_VALUE_INVALID:${invalidKey}`);
  }
  return resolvedFeatureHashes;
}

function requireDecisionTrace(trace) {
  const resolvedTrace = requirePlainRecord(trace, 'PROTECTION_ENVELOPE_DECISION_TRACE_INVALID');
  const traceKeys = Object.keys(resolvedTrace).sort();
  const expectedTraceKeys = ['reasonCodes', 'source', 'traceId'];
  if (traceKeys.length !== expectedTraceKeys.length
    || traceKeys.some((key, index) => key !== expectedTraceKeys[index])) {
    throw new Error('PROTECTION_ENVELOPE_DECISION_TRACE_FIELDS_INVALID');
  }
  if (typeof resolvedTrace.traceId !== 'string' || !resolvedTrace.traceId.trim()) {
    throw new Error('PROTECTION_ENVELOPE_DECISION_TRACE_ID_INVALID');
  }
  if (!Array.isArray(resolvedTrace.reasonCodes)) {
    throw new Error('PROTECTION_ENVELOPE_DECISION_TRACE_REASONS_INVALID');
  }
  const invalidReasonCode = resolvedTrace.reasonCodes.find((reasonCode) => (
    typeof reasonCode !== 'string' || !reasonCode.trim()
  ));
  if (invalidReasonCode !== undefined) {
    throw new Error('PROTECTION_ENVELOPE_DECISION_TRACE_REASON_INVALID');
  }
  if (typeof resolvedTrace.source !== 'string' || !resolvedTrace.source.trim()) {
    throw new Error('PROTECTION_ENVELOPE_DECISION_TRACE_SOURCE_INVALID');
  }
  return {
    traceId: resolvedTrace.traceId.trim(),
    reasonCodes: resolvedTrace.reasonCodes.map((reasonCode) => reasonCode.trim()),
    source: resolvedTrace.source.trim(),
  };
}

function requireEnvelopeDecision(decision) {
  if (!isPlainObject(decision)) {
    throw new Error('PROTECTION_ENVELOPE_DECISION_INVALID');
  }
  return {
    ...decision,
    coolingCurve: { ...requireCoolingCurveRuntimeState(decision.coolingCurve) },
    domainClassId: requireDomainClassId(
      decision.domainClassId,
      'PROTECTION_ENVELOPE_DOMAIN_CLASS_INVALID',
    ),
    activation: requireActivationState(
      decision.activation,
      {
        invalid: 'PROTECTION_ENVELOPE_DECISION_ACTIVATION_INVALID',
        mainInvalid: 'PROTECTION_ENVELOPE_DECISION_ACTIVATION_MAIN_INVALID',
        featuresInvalid: 'PROTECTION_ENVELOPE_DECISION_ACTIVATION_FEATURES_INVALID',
        featureEnabledInvalid: 'PROTECTION_ENVELOPE_DECISION_ACTIVATION_FEATURE_ENABLED_INVALID',
      },
    ),
    compiledFeatures: requirePlainFeatureRecord(
      decision.compiledFeatures,
      'PROTECTION_ENVELOPE_DECISION_COMPILED_INVALID',
    ),
    featureRevisions: requireFeatureRevisionRecord(decision.featureRevisions),
    featureHashes: requireFeatureHashRecord(
      decision.featureHashes,
      'PROTECTION_ENVELOPE_DECISION_HASHES_INVALID',
    ),
    decisionTrace: requireDecisionTrace(decision.decisionTrace),
  };
}

function requireEnvelopeRevision(value, errorCode) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(errorCode);
  }
  return value;
}

function requirePreviousEnvelopeState(previousEnvelopeState) {
  if (previousEnvelopeState === null) {
    return null;
  }
  if (!isPlainObject(previousEnvelopeState)) {
    throw new Error('PROTECTION_ENVELOPE_PREVIOUS_STATE_INVALID');
  }
  requireEnvelopeRevision(
    previousEnvelopeState.revision,
    'PROTECTION_ENVELOPE_PREVIOUS_STATE_REVISION_INVALID',
  );
  return {
    ...previousEnvelopeState,
    coolingCurve: { ...requireCoolingCurveRuntimeState(previousEnvelopeState.coolingCurve) },
    hostname: requireHostname(previousEnvelopeState.hostname),
    domainClassId: requireDomainClassId(
      previousEnvelopeState.domainClassId,
      'PROTECTION_ENVELOPE_PREVIOUS_STATE_DOMAIN_CLASS_INVALID',
    ),
    activation: requireActivationState(
      previousEnvelopeState.activation,
      {
        invalid: 'PROTECTION_ENVELOPE_PREVIOUS_STATE_ACTIVATION_INVALID',
        mainInvalid: 'PROTECTION_ENVELOPE_PREVIOUS_STATE_ACTIVATION_MAIN_INVALID',
        featuresInvalid: 'PROTECTION_ENVELOPE_PREVIOUS_STATE_ACTIVATION_FEATURES_INVALID',
        featureEnabledInvalid: 'PROTECTION_ENVELOPE_PREVIOUS_STATE_ACTIVATION_FEATURE_ENABLED_INVALID',
      },
    ),
    compiledFeatures: requirePlainFeatureRecord(
      previousEnvelopeState.compiledFeatures,
      'PROTECTION_ENVELOPE_PREVIOUS_STATE_COMPILED_INVALID',
    ),
    featureHashes: requireFeatureHashRecord(
      previousEnvelopeState.featureHashes,
      'PROTECTION_ENVELOPE_PREVIOUS_STATE_HASHES_INVALID',
    ),
  };
}

function buildEnvelopePatchDelta(previousEnvelopeState, decision) {
  const previousActivation = previousEnvelopeState.activation.features;
  const previousCompiled = previousEnvelopeState.compiledFeatures;
  const previousHashes = previousEnvelopeState.featureHashes;

  const nextActivation = decision.activation.features;
  const nextCompiled = decision.compiledFeatures;
  const nextHashes = decision.featureHashes;

  const activationUpserts = {};
  const activationRemoves = [];
  const compiledUpserts = {};
  const compiledRemoves = [];

  const keys = Array.from(new Set([
    ...Object.keys(previousActivation),
    ...Object.keys(nextActivation),
    ...Object.keys(previousCompiled),
    ...Object.keys(nextCompiled),
    ...Object.keys(previousHashes),
    ...Object.keys(nextHashes),
  ]));

  keys.forEach((featureKey) => {
    const prevActivationEntry = previousActivation[featureKey];
    const nextActivationEntry = nextActivation[featureKey];
    const prevCompiledHash = previousHashes[featureKey];
    const nextCompiledHash = nextHashes[featureKey];
    const hasPreviousHash = typeof prevCompiledHash === 'string' && prevCompiledHash.length > 0;
    const hasNextHash = typeof nextCompiledHash === 'string' && nextCompiledHash.length > 0;
    const compiledChanged = hasPreviousHash && hasNextHash
      ? prevCompiledHash !== nextCompiledHash
      : !isFeaturePayloadEqual(previousCompiled[featureKey], nextCompiled[featureKey]);
    const hasNextCompiled = Object.prototype.hasOwnProperty.call(nextCompiled, featureKey);
    const hasPreviousCompiled = Object.prototype.hasOwnProperty.call(previousCompiled, featureKey);

    if (nextActivationEntry && !isFeaturePayloadEqual(prevActivationEntry, nextActivationEntry)) {
      activationUpserts[featureKey] = nextActivationEntry;
    } else if (prevActivationEntry && !nextActivationEntry) {
      activationRemoves.push(featureKey);
    }

    if (hasNextCompiled && compiledChanged) {
      compiledUpserts[featureKey] = nextCompiled[featureKey];
    } else if (!hasNextCompiled && hasPreviousCompiled) {
      compiledRemoves.push(featureKey);
    }
  });

  const hasMainChange = previousEnvelopeState.activation.main !== decision.activation.main;

  const changedCount = Object.keys(activationUpserts).length
    + activationRemoves.length
    + Object.keys(compiledUpserts).length
    + compiledRemoves.length
    + (hasMainChange ? 1 : 0);

  return {
    changedCount,
    totalFeatureCount: keys.length,
    patch: {
      ...(hasMainChange ? { main: decision.activation.main } : {}),
      activationUpserts,
      activationRemoves,
      compiledUpserts,
      compiledRemoves,
    },
  };
}

export function buildProtectionEnvelope({
  hostname,
  decision,
  previousEnvelopeState = null,
  previousRevision = 0,
  forceSnapshot = false,
  patchTraceSource = 'protection_dispatcher_patch',
} = {}) {
  const resolvedHostname = requireHostname(hostname);
  const resolvedDecision = requireEnvelopeDecision(decision);
  const resolvedPreviousEnvelopeState = requirePreviousEnvelopeState(previousEnvelopeState);
  if (typeof patchTraceSource !== 'string' || !patchTraceSource.trim()) {
    throw new Error('PROTECTION_ENVELOPE_PATCH_TRACE_SOURCE_INVALID');
  }
  const decisionRevision = requireEnvelopeRevision(
    resolvedDecision.decisionRevision,
    'PROTECTION_ENVELOPE_DECISION_REVISION_INVALID',
  );
  const resolvedPreviousRevision = requireEnvelopeRevision(
    previousRevision,
    'PROTECTION_ENVELOPE_PREVIOUS_REVISION_INVALID',
  );
  const nextEnvelopeRevision = Math.max(
    decisionRevision,
    resolvedPreviousRevision + 1,
  );

  const canPatch = !forceSnapshot
    && !!resolvedPreviousEnvelopeState
    && resolvedPreviousEnvelopeState.hostname === resolvedHostname
    && resolvedPreviousEnvelopeState.domainClassId === resolvedDecision.domainClassId;

  let envelope = null;
  if (canPatch) {
    const delta = buildEnvelopePatchDelta(resolvedPreviousEnvelopeState, resolvedDecision);
    const hasPatchBenefit = delta.changedCount > 0
      && delta.changedCount < Math.max(1, delta.totalFeatureCount * 2);

    if (hasPatchBenefit) {
      envelope = buildPatchEnvelope({
        hostname: resolvedHostname,
        coolingCurve: resolvedDecision.coolingCurve,
        domainClassId: resolvedDecision.domainClassId,
        revision: nextEnvelopeRevision,
        baseRevision: resolvedPreviousEnvelopeState.revision,
        patch: delta.patch,
        featureRevisions: resolvedDecision.featureRevisions,
        trace: {
          ...resolvedDecision.decisionTrace,
          source: patchTraceSource.trim(),
        },
      });
    }
  }

  if (!envelope) {
    envelope = buildSnapshotEnvelope({
      hostname: resolvedHostname,
      coolingCurve: resolvedDecision.coolingCurve,
      domainClassId: resolvedDecision.domainClassId,
      revision: nextEnvelopeRevision,
      activation: resolvedDecision.activation,
      compiledFeatures: resolvedDecision.compiledFeatures,
      featureRevisions: resolvedDecision.featureRevisions,
      trace: resolvedDecision.decisionTrace,
    });
  }

  return {
    envelope,
    revision: nextEnvelopeRevision,
    state: {
      hostname: resolvedHostname,
      coolingCurve: resolvedDecision.coolingCurve,
      domainClassId: resolvedDecision.domainClassId,
      revision: nextEnvelopeRevision,
      activation: resolvedDecision.activation,
      compiledFeatures: resolvedDecision.compiledFeatures,
      featureHashes: resolvedDecision.featureHashes,
    },
  };
}
