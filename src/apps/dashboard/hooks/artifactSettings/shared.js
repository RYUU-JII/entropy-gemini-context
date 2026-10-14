import {
  buildTextRhythmFilterPatch,
} from '../../../../domains/settings/config/index.js';

export const ARTIFACT_CHILD_CONTROL_MODES = Object.freeze({
  BINARY: 'binary',
  CHOICE: 'choice',
});

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function assertArtifactConfigObject(value, contractId, fieldSchema) {
  if (!isPlainObject(value) || !isPlainObject(fieldSchema)) {
    throw new Error(`ARTIFACT_CONFIG_SHAPE_INVALID:${contractId}`);
  }
  const expectedFields = Object.keys(fieldSchema);
  const actualFields = Object.keys(value);
  if (
    actualFields.length !== expectedFields.length
    || expectedFields.some((field) => !Object.prototype.hasOwnProperty.call(value, field))
  ) {
    throw new Error(`ARTIFACT_CONFIG_SHAPE_INVALID:${contractId}`);
  }
  expectedFields.forEach((field) => {
    const validator = fieldSchema[field];
    const valid = typeof validator === 'function'
      ? validator(value[field])
      : typeof value[field] === validator;
    if (!valid) {
      throw new Error(`ARTIFACT_CONFIG_FIELD_INVALID:${contractId}:${field}`);
    }
  });
  return value;
}

export function assertArtifactFamilyConfig(config, familyId, childSchemas) {
  if (!isPlainObject(config) || !isPlainObject(childSchemas)) {
    throw new Error(`ARTIFACT_CONFIG_SHAPE_INVALID:${familyId}`);
  }
  Object.keys(config).forEach((childId) => {
    const fieldSchema = childSchemas[childId];
    if (!fieldSchema) {
      throw new Error(`ARTIFACT_CONFIG_CHILD_UNKNOWN:${familyId}:${childId}`);
    }
    assertArtifactConfigObject(config[childId], `${familyId}.${childId}`, fieldSchema);
  });
  return config;
}

export function createArtifactBinaryChildState({
  enabled = false,
  ...rest
} = {}) {
  return Object.freeze({
    controlMode: ARTIFACT_CHILD_CONTROL_MODES.BINARY,
    enabled: !!enabled,
    ...rest,
  });
}

export function createArtifactChoiceChildState({
  enabled = false,
  value,
  ...rest
} = {}) {
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new Error('ARTIFACT_CHOICE_VALUE_REQUIRED');
  }
  return Object.freeze({
    controlMode: ARTIFACT_CHILD_CONTROL_MODES.CHOICE,
    enabled: !!enabled,
    value,
    ...rest,
  });
}

export function createArtifactBinaryChildHandlers({
  toggle,
  ...rest
} = {}) {
  return Object.freeze({
    controlMode: ARTIFACT_CHILD_CONTROL_MODES.BINARY,
    ...(typeof toggle === 'function' ? { toggle } : {}),
    ...rest,
  });
}

export function createArtifactChoiceChildHandlers({
  toggle,
  setValue,
  ...rest
} = {}) {
  return Object.freeze({
    controlMode: ARTIFACT_CHILD_CONTROL_MODES.CHOICE,
    ...(typeof toggle === 'function' ? { toggle } : {}),
    ...(typeof setValue === 'function' ? { setValue } : {}),
    ...rest,
  });
}

export function resolveToggleChecked(nextValue) {
  if (typeof nextValue === 'boolean') return nextValue;
  if (nextValue?.target && typeof nextValue.target.checked === 'boolean') {
    return nextValue.target.checked;
  }
  return !!nextValue;
}

export function buildTextRhythmPatch(nextChecked) {
  return buildTextRhythmFilterPatch(nextChecked);
}
