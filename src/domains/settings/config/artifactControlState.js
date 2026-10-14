import {
  CANONICAL_PROTECTION_ARTIFACT_PREFERENCE_IDS,
} from '../../protection/runtime/canonicalArtifactRuntimeBinding.js';

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function requireBoolean(value, field) {
  if (typeof value !== 'boolean') throw new Error('ARTIFACT_CONTROL_VALUE_INVALID:' + field);
  return value;
}

function requireFields(value, fields, field) {
  if (!isPlainObject(value) || Object.keys(value).some((key) => !fields.includes(key))) {
    throw new Error('ARTIFACT_CONTROL_SHAPE_INVALID:' + field);
  }
  return value;
}

export const ARTIFACT_CONTROL_FAMILY_IDS = Object.freeze([
  ...CANONICAL_PROTECTION_ARTIFACT_PREFERENCE_IDS,
]);

export const DEFAULT_ARTIFACT_FAMILY_SUSPENSIONS = Object.freeze(
  ARTIFACT_CONTROL_FAMILY_IDS.reduce((acc, familyId) => {
    acc[familyId] = false;
    return acc;
  }, {}),
);

export const DEFAULT_ARTIFACT_CONTROL_STATE = Object.freeze({
  globalPaused: false,
  familySuspensions: DEFAULT_ARTIFACT_FAMILY_SUSPENSIONS,
});

export function normalizeArtifactFamilySuspensions(rawValue, fallbackValue = DEFAULT_ARTIFACT_FAMILY_SUSPENSIONS) {
  const source = rawValue === undefined ? {} : requireFields(rawValue, ARTIFACT_CONTROL_FAMILY_IDS, 'familySuspensions');
  const fallback = requireFields(fallbackValue, ARTIFACT_CONTROL_FAMILY_IDS, 'defaults.familySuspensions');
  return ARTIFACT_CONTROL_FAMILY_IDS.reduce((acc, familyId) => {
    acc[familyId] = requireBoolean(Object.hasOwn(source, familyId) ? source[familyId] : fallback[familyId], familyId);
    return acc;
  }, {});
}

export function normalizeArtifactControlState(rawValue, { defaults } = {}) {
  const source = rawValue === undefined ? {} : requireFields(rawValue, ['globalPaused', 'familySuspensions'], 'state');
  const fallback = defaults === undefined ? DEFAULT_ARTIFACT_CONTROL_STATE : requireArtifactControlState(defaults);
  return {
    globalPaused: requireBoolean(Object.hasOwn(source, 'globalPaused') ? source.globalPaused : fallback.globalPaused, 'globalPaused'),
    familySuspensions: normalizeArtifactFamilySuspensions(
      source.familySuspensions,
      fallback.familySuspensions,
    ),
  };
}

export function requireArtifactControlState(value) {
  requireFields(value, ['globalPaused', 'familySuspensions'], 'state');
  if (!Object.hasOwn(value, 'globalPaused') || !Object.hasOwn(value, 'familySuspensions')) {
    throw new Error('ARTIFACT_CONTROL_SNAPSHOT_INCOMPLETE');
  }
  requireBoolean(value.globalPaused, 'globalPaused');
  requireFields(value.familySuspensions, ARTIFACT_CONTROL_FAMILY_IDS, 'familySuspensions');
  for (const familyId of ARTIFACT_CONTROL_FAMILY_IDS) {
    requireBoolean(value.familySuspensions[familyId], familyId);
  }
  return value;
}

export function isArtifactControlGloballyPaused(rawValue) {
  return normalizeArtifactControlState(rawValue).globalPaused;
}

export function isArtifactFamilySuspended(rawValue, familyId) {
  if (typeof familyId !== 'string' || !familyId.trim()) return false;
  const normalized = normalizeArtifactControlState(rawValue);
  return !!normalized.familySuspensions[familyId];
}
