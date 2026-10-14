import { isKnownDomainClassId } from '../scope/classCatalog.js';
import { FEATURE_KEY_SET } from './featureKeys.js';
import { requireCoolingCurveRuntimeState } from '../../contracts/coolingCurveRuntimeContract.js';

export const PROTECTION_ENVELOPE_VERSION = 2;
export const PROTECTION_ENVELOPE_MODE = Object.freeze({
  SNAPSHOT: 'snapshot',
  PATCH: 'patch',
});

const SNAPSHOT_ENVELOPE_KEYS = Object.freeze([
  'version',
  'mode',
  'hostname',
  'domainClassId',
  'revision',
  'activation',
  'compiledFeatures',
  'featureRevisions',
  'trace',
  'coolingCurve',
]);
const PATCH_ENVELOPE_KEYS = Object.freeze([
  'version',
  'mode',
  'hostname',
  'domainClassId',
  'revision',
  'baseRevision',
  'patch',
  'featureRevisions',
  'trace',
  'coolingCurve',
]);
const ACTIVATION_KEYS = Object.freeze(['main', 'features']);
const PATCH_KEYS = Object.freeze([
  'main',
  'activationUpserts',
  'activationRemoves',
  'compiledUpserts',
  'compiledRemoves',
]);
const TRACE_KEYS = Object.freeze(['traceId', 'reasonCodes', 'source']);

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value, expectedKeys) {
  if (!isPlainObject(value)) return false;
  const actualKeys = Object.keys(value).sort();
  const canonicalKeys = [...expectedKeys].sort();
  return actualKeys.length === canonicalKeys.length
    && actualKeys.every((key, index) => key === canonicalKeys[index]);
}

function requirePlainObject(value, error) {
  if (!isPlainObject(value)) {
    throw new Error(error);
  }
  return value;
}

function requireHostname(hostname) {
  if (typeof hostname !== 'string' || !hostname.trim()) {
    throw new Error('ENVELOPE_HOSTNAME_REQUIRED');
  }
  return hostname.trim().toLowerCase();
}

function requireDomainClassId(domainClassId) {
  if (!isKnownDomainClassId(domainClassId)) {
    throw new Error('ENVELOPE_DOMAIN_CLASS_REQUIRED');
  }
  return domainClassId;
}

function requireNonNegativeInteger(value, error) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(error);
  }
  return value;
}

function cloneRecord(value, error) {
  const record = requirePlainObject(value, error);
  return Object.entries(value).reduce((acc, [key, item]) => {
    if (isPlainObject(item)) {
      acc[key] = { ...item };
      return acc;
    }
    acc[key] = item;
    return acc;
  }, {});
}

function cloneFeatureRecord(value, error) {
  const record = cloneRecord(value, error);
  const invalidKey = Object.keys(record).find((key) => !FEATURE_KEY_SET.has(key));
  if (invalidKey) {
    throw new Error(`${error}_KEY_INVALID:${invalidKey}`);
  }
  const invalidEntryKey = Object.keys(record).find((key) => !isPlainObject(record[key]));
  if (invalidEntryKey) {
    throw new Error(`${error}_ENTRY_INVALID:${invalidEntryKey}`);
  }
  return record;
}

function cloneActivation(activation) {
  const resolvedActivation = requirePlainObject(activation, 'ENVELOPE_ACTIVATION_REQUIRED');
  if (!hasExactKeys(resolvedActivation, ACTIVATION_KEYS)) {
    throw new Error('ENVELOPE_ACTIVATION_FIELDS_INVALID');
  }
  if (typeof resolvedActivation.main !== 'boolean') {
    throw new Error('ENVELOPE_ACTIVATION_MAIN_REQUIRED');
  }
  const features = cloneFeatureRecord(
    resolvedActivation.features,
    'ENVELOPE_FEATURE_ACTIVATION_REQUIRED',
  );
  const invalidEnabledKey = Object.keys(features).find((key) => (
    typeof features[key].enabled !== 'boolean'
  ));
  if (invalidEnabledKey) {
    throw new Error(`ENVELOPE_FEATURE_ACTIVATION_ENABLED_REQUIRED:${invalidEnabledKey}`);
  }
  return {
    main: resolvedActivation.main,
    features,
  };
}

function cloneFeatureRevisions(featureRevisions) {
  const record = cloneRecord(featureRevisions, 'ENVELOPE_FEATURE_REVISIONS_REQUIRED');
  const invalidKey = Object.keys(record).find((key) => !FEATURE_KEY_SET.has(key));
  if (invalidKey) {
    throw new Error(`ENVELOPE_FEATURE_REVISIONS_KEY_INVALID:${invalidKey}`);
  }
  const invalidValueKey = Object.keys(record).find((key) => (
    !Number.isInteger(record[key]) || record[key] < 0
  ));
  if (invalidValueKey) {
    throw new Error(`ENVELOPE_FEATURE_REVISIONS_VALUE_REQUIRED:${invalidValueKey}`);
  }
  return record;
}

function cloneFeatureKeyList(keys, error) {
  if (!Array.isArray(keys)) {
    throw new Error(error);
  }
  const invalidKey = keys.find((key) => typeof key !== 'string' || !FEATURE_KEY_SET.has(key));
  if (invalidKey !== undefined) {
    throw new Error(`${error}_KEY_INVALID:${invalidKey}`);
  }
  return [...keys];
}

function validateKnownFeatureRecordKeys(record, error) {
  const unknownKeys = Object.keys(record).filter((key) => !FEATURE_KEY_SET.has(key));
  if (unknownKeys.length > 0) {
    return { ok: false, error, unknownKeys };
  }
  return { ok: true, error: null };
}

function validateKnownFeatureKeyList(keys, error) {
  const unknownKeys = keys.filter((key) => typeof key !== 'string' || !FEATURE_KEY_SET.has(key));
  if (unknownKeys.length > 0) {
    return { ok: false, error, unknownKeys };
  }
  return { ok: true, error: null };
}

function validatePlainFeatureEntries(record, error) {
  const invalidKey = Object.keys(record).find((key) => !isPlainObject(record[key]));
  if (invalidKey) {
    return { ok: false, error, invalidKey };
  }
  return { ok: true, error: null };
}

function validateActivationFeatureEntries(record, entryError, enabledError) {
  const entryValidation = validatePlainFeatureEntries(record, entryError);
  if (!entryValidation.ok) return entryValidation;

  const invalidKey = Object.keys(record).find((key) => typeof record[key].enabled !== 'boolean');
  if (invalidKey) {
    return {
      ok: false,
      error: enabledError,
      invalidKey,
    };
  }
  return { ok: true, error: null };
}

function validateFeatureRevisions(record) {
  const keyValidation = validateKnownFeatureRecordKeys(
    record,
    'ENVELOPE_FEATURE_REVISIONS_KEYS_INVALID',
  );
  if (!keyValidation.ok) return keyValidation;

  const invalidKey = Object.keys(record).find((key) => (
    typeof record[key] !== 'number'
    || !Number.isFinite(record[key])
    || !Number.isInteger(record[key])
    || record[key] < 0
  ));
  if (invalidKey) {
    return {
      ok: false,
      error: 'ENVELOPE_FEATURE_REVISIONS_VALUE_INVALID',
      invalidKey,
    };
  }
  return { ok: true, error: null };
}

function requireTrace(trace) {
  const resolvedTrace = requirePlainObject(trace, 'ENVELOPE_TRACE_REQUIRED');
  if (!hasExactKeys(resolvedTrace, TRACE_KEYS)) {
    throw new Error('ENVELOPE_TRACE_FIELDS_INVALID');
  }
  if (resolvedTrace.traceId !== null
    && (typeof resolvedTrace.traceId !== 'string' || !resolvedTrace.traceId.trim())) {
    throw new Error('ENVELOPE_TRACE_ID_REQUIRED');
  }
  if (!Array.isArray(resolvedTrace.reasonCodes)
    || resolvedTrace.reasonCodes.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new Error('ENVELOPE_TRACE_REASON_CODES_REQUIRED');
  }
  if (typeof resolvedTrace.source !== 'string' || !resolvedTrace.source.trim()) {
    throw new Error('ENVELOPE_TRACE_SOURCE_REQUIRED');
  }
  return {
    traceId: resolvedTrace.traceId === null ? null : resolvedTrace.traceId.trim(),
    reasonCodes: resolvedTrace.reasonCodes.map((item) => item.trim()),
    source: resolvedTrace.source.trim(),
  };
}

function normalizePatchPayload(patch) {
  const resolvedPatch = requirePlainObject(patch, 'ENVELOPE_PATCH_REQUIRED');
  const invalidPatchKey = Object.keys(resolvedPatch).find((key) => !PATCH_KEYS.includes(key));
  const missingPatchKey = [
    'activationUpserts',
    'activationRemoves',
    'compiledUpserts',
    'compiledRemoves',
  ].find((key) => !Object.prototype.hasOwnProperty.call(resolvedPatch, key));
  if (invalidPatchKey || missingPatchKey) {
    throw new Error('ENVELOPE_PATCH_FIELDS_INVALID');
  }
  if (
    resolvedPatch.main !== null
    && resolvedPatch.main !== undefined
    && typeof resolvedPatch.main !== 'boolean'
  ) {
    throw new Error('ENVELOPE_PATCH_MAIN_REQUIRED');
  }

  return {
    main: typeof resolvedPatch.main === 'boolean' ? resolvedPatch.main : null,
    activationUpserts: cloneFeatureRecord(
      resolvedPatch.activationUpserts,
      'ENVELOPE_PATCH_ACTIVATION_UPSERTS_REQUIRED',
    ),
    activationRemoves: cloneFeatureKeyList(
      resolvedPatch.activationRemoves,
      'ENVELOPE_PATCH_ACTIVATION_REMOVES_REQUIRED',
    ),
    compiledUpserts: cloneFeatureRecord(
      resolvedPatch.compiledUpserts,
      'ENVELOPE_PATCH_COMPILED_UPSERTS_REQUIRED',
    ),
    compiledRemoves: cloneFeatureKeyList(
      resolvedPatch.compiledRemoves,
      'ENVELOPE_PATCH_COMPILED_REMOVES_REQUIRED',
    ),
  };
}

export function buildSnapshotEnvelope({
  hostname,
  coolingCurve,
  domainClassId,
  revision,
  activation,
  compiledFeatures,
  featureRevisions,
  trace,
} = {}) {
  return {
    version: PROTECTION_ENVELOPE_VERSION,
    mode: PROTECTION_ENVELOPE_MODE.SNAPSHOT,
    hostname: requireHostname(hostname),
    coolingCurve: { ...requireCoolingCurveRuntimeState(coolingCurve) },
    domainClassId: requireDomainClassId(domainClassId),
    revision: requireNonNegativeInteger(revision, 'ENVELOPE_REVISION_REQUIRED'),
    activation: cloneActivation(activation),
    compiledFeatures: cloneFeatureRecord(
      compiledFeatures,
      'ENVELOPE_COMPILED_FEATURES_REQUIRED',
    ),
    featureRevisions: cloneFeatureRevisions(featureRevisions),
    trace: requireTrace(trace),
  };
}

export function buildPatchEnvelope({
  hostname,
  coolingCurve,
  domainClassId,
  revision,
  baseRevision,
  patch,
  featureRevisions,
  trace,
} = {}) {
  return {
    version: PROTECTION_ENVELOPE_VERSION,
    mode: PROTECTION_ENVELOPE_MODE.PATCH,
    hostname: requireHostname(hostname),
    coolingCurve: { ...requireCoolingCurveRuntimeState(coolingCurve) },
    domainClassId: requireDomainClassId(domainClassId),
    revision: requireNonNegativeInteger(revision, 'ENVELOPE_REVISION_REQUIRED'),
    baseRevision: requireNonNegativeInteger(
      baseRevision,
      'ENVELOPE_PATCH_BASE_REVISION_REQUIRED',
    ),
    patch: normalizePatchPayload(patch),
    featureRevisions: cloneFeatureRevisions(featureRevisions),
    trace: requireTrace(trace),
  };
}

export function validateProtectionEnvelope(envelope) {
  if (!isPlainObject(envelope)) {
    return { ok: false, error: 'ENVELOPE_NOT_OBJECT' };
  }

  if (envelope.version !== PROTECTION_ENVELOPE_VERSION) {
    return { ok: false, error: 'ENVELOPE_VERSION_MISMATCH' };
  }

  if (!Object.values(PROTECTION_ENVELOPE_MODE).includes(envelope.mode)) {
    return { ok: false, error: 'ENVELOPE_MODE_INVALID' };
  }

  const expectedEnvelopeKeys = envelope.mode === PROTECTION_ENVELOPE_MODE.SNAPSHOT
    ? SNAPSHOT_ENVELOPE_KEYS
    : PATCH_ENVELOPE_KEYS;
  if (!hasExactKeys(envelope, expectedEnvelopeKeys)) {
    return { ok: false, error: 'ENVELOPE_FIELDS_INVALID' };
  }
  try {
    requireCoolingCurveRuntimeState(envelope.coolingCurve);
  } catch {
    return { ok: false, error: 'ENVELOPE_COOLING_CURVE_INVALID' };
  }

  if (typeof envelope.hostname !== 'string'
    || !envelope.hostname.trim()
    || envelope.hostname !== envelope.hostname.trim().toLowerCase()) {
    return { ok: false, error: 'ENVELOPE_HOSTNAME_INVALID' };
  }

  if (!isKnownDomainClassId(envelope.domainClassId)) {
    return { ok: false, error: 'ENVELOPE_DOMAIN_CLASS_INVALID' };
  }

  if (!Number.isInteger(envelope.revision) || envelope.revision < 0) {
    return { ok: false, error: 'ENVELOPE_REVISION_INVALID' };
  }

  const revision = envelope.revision;

  if (!hasExactKeys(envelope.trace, TRACE_KEYS)) {
    return { ok: false, error: 'ENVELOPE_TRACE_FIELDS_INVALID' };
  }
  if (envelope.trace.traceId !== null
    && (typeof envelope.trace.traceId !== 'string' || !envelope.trace.traceId.trim())) {
    return { ok: false, error: 'ENVELOPE_TRACE_ID_INVALID' };
  }
  if (!Array.isArray(envelope.trace.reasonCodes)
    || envelope.trace.reasonCodes.some((item) => typeof item !== 'string' || !item.trim())) {
    return { ok: false, error: 'ENVELOPE_TRACE_REASON_CODES_INVALID' };
  }
  if (typeof envelope.trace.source !== 'string' || !envelope.trace.source.trim()) {
    return { ok: false, error: 'ENVELOPE_TRACE_SOURCE_INVALID' };
  }

  if (envelope.mode === PROTECTION_ENVELOPE_MODE.SNAPSHOT) {
    if (!isPlainObject(envelope.activation)) {
      return { ok: false, error: 'ENVELOPE_ACTIVATION_INVALID' };
    }
    if (!hasExactKeys(envelope.activation, ACTIVATION_KEYS)) {
      return { ok: false, error: 'ENVELOPE_ACTIVATION_FIELDS_INVALID' };
    }
    if (typeof envelope.activation.main !== 'boolean') {
      return { ok: false, error: 'ENVELOPE_ACTIVATION_MAIN_INVALID' };
    }
    if (!isPlainObject(envelope.activation.features)) {
      return { ok: false, error: 'ENVELOPE_FEATURE_ACTIVATION_INVALID' };
    }
    const activationKeyValidation = validateKnownFeatureRecordKeys(
      envelope.activation.features,
      'ENVELOPE_FEATURE_ACTIVATION_KEYS_INVALID',
    );
    if (!activationKeyValidation.ok) return activationKeyValidation;
    const activationEntryValidation = validateActivationFeatureEntries(
      envelope.activation.features,
      'ENVELOPE_FEATURE_ACTIVATION_ENTRIES_INVALID',
      'ENVELOPE_FEATURE_ACTIVATION_ENABLED_INVALID',
    );
    if (!activationEntryValidation.ok) return activationEntryValidation;
    if (!isPlainObject(envelope.compiledFeatures)) {
      return { ok: false, error: 'ENVELOPE_COMPILED_FEATURES_INVALID' };
    }
    const compiledKeyValidation = validateKnownFeatureRecordKeys(
      envelope.compiledFeatures,
      'ENVELOPE_COMPILED_FEATURE_KEYS_INVALID',
    );
    if (!compiledKeyValidation.ok) return compiledKeyValidation;
    const compiledEntryValidation = validatePlainFeatureEntries(
      envelope.compiledFeatures,
      'ENVELOPE_COMPILED_FEATURE_ENTRIES_INVALID',
    );
    if (!compiledEntryValidation.ok) return compiledEntryValidation;
  }

  if (envelope.mode === PROTECTION_ENVELOPE_MODE.PATCH) {
    if (!Number.isInteger(envelope.baseRevision) || envelope.baseRevision < 0) {
      return { ok: false, error: 'ENVELOPE_PATCH_BASE_REVISION_INVALID' };
    }
    if (revision <= envelope.baseRevision) {
      return { ok: false, error: 'ENVELOPE_PATCH_REVISION_INVALID' };
    }
    if (!isPlainObject(envelope.patch)) {
      return { ok: false, error: 'ENVELOPE_PATCH_INVALID' };
    }
    if (!hasExactKeys(envelope.patch, PATCH_KEYS)) {
      return { ok: false, error: 'ENVELOPE_PATCH_FIELDS_INVALID' };
    }
    if (!isPlainObject(envelope.patch.activationUpserts)) {
      return { ok: false, error: 'ENVELOPE_PATCH_ACTIVATION_UPSERTS_INVALID' };
    }
    const activationUpsertKeyValidation = validateKnownFeatureRecordKeys(
      envelope.patch.activationUpserts,
      'ENVELOPE_PATCH_ACTIVATION_KEYS_INVALID',
    );
    if (!activationUpsertKeyValidation.ok) return activationUpsertKeyValidation;
    const activationUpsertEntryValidation = validateActivationFeatureEntries(
      envelope.patch.activationUpserts,
      'ENVELOPE_PATCH_ACTIVATION_ENTRIES_INVALID',
      'ENVELOPE_PATCH_ACTIVATION_ENABLED_INVALID',
    );
    if (!activationUpsertEntryValidation.ok) return activationUpsertEntryValidation;
    if (!Array.isArray(envelope.patch.activationRemoves)) {
      return { ok: false, error: 'ENVELOPE_PATCH_ACTIVATION_REMOVES_INVALID' };
    }
    const activationRemoveKeyValidation = validateKnownFeatureKeyList(
      envelope.patch.activationRemoves,
      'ENVELOPE_PATCH_ACTIVATION_REMOVES_KEYS_INVALID',
    );
    if (!activationRemoveKeyValidation.ok) return activationRemoveKeyValidation;
    if (!isPlainObject(envelope.patch.compiledUpserts)) {
      return { ok: false, error: 'ENVELOPE_PATCH_COMPILED_UPSERTS_INVALID' };
    }
    const compiledUpsertKeyValidation = validateKnownFeatureRecordKeys(
      envelope.patch.compiledUpserts,
      'ENVELOPE_PATCH_COMPILED_KEYS_INVALID',
    );
    if (!compiledUpsertKeyValidation.ok) return compiledUpsertKeyValidation;
    const compiledUpsertEntryValidation = validatePlainFeatureEntries(
      envelope.patch.compiledUpserts,
      'ENVELOPE_PATCH_COMPILED_ENTRIES_INVALID',
    );
    if (!compiledUpsertEntryValidation.ok) return compiledUpsertEntryValidation;
    if (!Array.isArray(envelope.patch.compiledRemoves)) {
      return { ok: false, error: 'ENVELOPE_PATCH_COMPILED_REMOVES_INVALID' };
    }
    const compiledRemoveKeyValidation = validateKnownFeatureKeyList(
      envelope.patch.compiledRemoves,
      'ENVELOPE_PATCH_COMPILED_REMOVES_KEYS_INVALID',
    );
    if (!compiledRemoveKeyValidation.ok) return compiledRemoveKeyValidation;
  }

  if (!isPlainObject(envelope.featureRevisions)) {
    return { ok: false, error: 'ENVELOPE_FEATURE_REVISIONS_INVALID' };
  }
  const featureRevisionValidation = validateFeatureRevisions(envelope.featureRevisions);
  if (!featureRevisionValidation.ok) return featureRevisionValidation;

  return { ok: true, error: null };
}

export function pickEnvelopeFromMessage(request) {
  if (!isPlainObject(request)) return null;

  return isPlainObject(request.envelope) ? request.envelope : null;
}
