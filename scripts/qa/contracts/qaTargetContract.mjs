import path from 'node:path';
import { normalizeQaBrowserObservation } from './qaBrowserObservationContract.mjs';

import {
  createQaBrowserPresentationParameter,
  normalizeQaBrowserRequirements,
} from './qaBrowserRequirementContract.mjs';

export const QA_MODES = Object.freeze({
  HUMAN: 'human',
  AGENT: 'agent',
});

export const QA_TARGET_CONCURRENCY = Object.freeze({
  EXCLUSIVE_MEASUREMENT: 'exclusive_measurement',
  ISOLATED_FUNCTIONAL: 'isolated_functional',
});

export const QA_LANES = Object.freeze({
  RENDER: 'render',
  EFFECT: 'effect',
  EXTENSION: 'extension',
  REAL_SITE: 'real_site',
  RELEASE: 'release',
});

export const QA_RUN_STATUSES = Object.freeze({
  PASS: 'PASS',
  FAIL: 'FAIL',
  BLOCKED: 'BLOCKED',
  INCONCLUSIVE: 'INCONCLUSIVE',
  READY_FOR_HUMAN: 'READY_FOR_HUMAN',
});

const TARGET_ID_PATTERN = /^[a-z0-9]+(?:[/-][a-z0-9]+)*$/u;
const IDENTIFIER_PATTERN = /^[a-z][a-z0-9_]*$/u;
const PARAMETER_NAME_PATTERN = /^[a-z][a-zA-Z0-9]*$/u;
const PARAMETER_TYPES = new Set(['boolean', 'enum', 'integer', 'string']);
const PARAMETER_SCHEMA_KEYS = Object.freeze({
  boolean: new Set(['type', 'cliName', 'required', 'default']),
  enum: new Set(['type', 'cliName', 'required', 'default', 'values']),
  integer: new Set([
    'type',
    'cliName',
    'required',
    'default',
    'minimum',
    'maximum',
  ]),
  string: new Set(['type', 'cliName', 'required', 'default', 'absolutePath']),
});
const OPERATOR_HANDOFF_POLICY_KEYS = new Set(['focus', 'lifetime', 'cleanup']);
const OPERATOR_HANDOFF_POLICY_VALUES = Object.freeze({
  focus: 'operator_request_once',
  lifetime: 'until_explicit_cancel',
  cleanup: 'exact_owned_targets',
});

function fail(code, detail = '') {
  throw new Error(detail ? `${code}:${detail}` : code);
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertPlainData(value, pathLabel = 'target') {
  if (
    value === null
    || typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
  ) {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertPlainData(entry, `${pathLabel}[${index}]`));
    return;
  }
  if (!isPlainObject(value)) {
    fail('QA_TARGET_NON_DATA_VALUE_FORBIDDEN', pathLabel);
  }
  Object.entries(value).forEach(([key, entry]) => {
    if (entry === undefined || typeof entry === 'function' || typeof entry === 'symbol') {
      fail('QA_TARGET_NON_DATA_VALUE_FORBIDDEN', `${pathLabel}.${key}`);
    }
    assertPlainData(entry, `${pathLabel}.${key}`);
  });
}

function cloneFrozenPlainData(value) {
  if (Array.isArray(value)) {
    return Object.freeze(value.map((entry) => cloneFrozenPlainData(entry)));
  }
  if (isPlainObject(value)) {
    return Object.freeze(Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        cloneFrozenPlainData(entry),
      ]),
    ));
  }
  return value;
}

function normalizeIdentifier(value, code) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!IDENTIFIER_PATTERN.test(normalized)) fail(code, normalized || 'missing');
  return normalized;
}

function normalizeStringArray(values, code, {
  allowedValues = null,
  pattern = null,
  minimumLength = 0,
} = {}) {
  if (!Array.isArray(values) || values.length < minimumLength) fail(code);
  const normalized = values.map((value) => {
    if (typeof value !== 'string' || !value.trim() || value !== value.trim()) {
      fail(code);
    }
    if (pattern && !pattern.test(value)) fail(code, value);
    if (allowedValues && !allowedValues.includes(value)) fail(code, value);
    return value;
  });
  if (new Set(normalized).size !== normalized.length) fail(`${code}_DUPLICATE`);
  return Object.freeze(normalized);
}

function normalizeParameterSchema(parameters) {
  if (parameters === undefined) return Object.freeze({});
  if (!isPlainObject(parameters)) fail('QA_TARGET_PARAMETERS_INVALID');
  const cliNames = new Set();
  const normalizedEntries = Object.entries(parameters).map(([name, rawSchema]) => {
    const normalizedName = typeof name === 'string' ? name.trim() : '';
    if (!PARAMETER_NAME_PATTERN.test(normalizedName)) {
      fail('QA_TARGET_PARAMETER_NAME_INVALID', normalizedName || 'missing');
    }
    if (!isPlainObject(rawSchema) || !PARAMETER_TYPES.has(rawSchema.type)) {
      fail('QA_TARGET_PARAMETER_SCHEMA_INVALID', normalizedName);
    }
    const allowedKeys = PARAMETER_SCHEMA_KEYS[rawSchema.type];
    const unknownKey = Object.keys(rawSchema).find((key) => !allowedKeys.has(key));
    if (unknownKey) {
      fail(
        'QA_TARGET_PARAMETER_SCHEMA_KEY_UNKNOWN',
        `${normalizedName}.${unknownKey}`,
      );
    }
    if (
      Object.prototype.hasOwnProperty.call(rawSchema, 'required')
      && typeof rawSchema.required !== 'boolean'
    ) {
      fail('QA_TARGET_PARAMETER_REQUIRED_INVALID', normalizedName);
    }
    if (
      rawSchema.required === true
      && Object.prototype.hasOwnProperty.call(rawSchema, 'default')
    ) {
      fail('QA_TARGET_PARAMETER_REQUIRED_DEFAULT_CONFLICT', normalizedName);
    }
    const cliName = typeof rawSchema.cliName === 'string' && rawSchema.cliName.trim()
      ? rawSchema.cliName.trim()
      : normalizedName.replace(/[A-Z]/gu, (match) => `-${match.toLowerCase()}`);
    if (!/^[a-z][a-z0-9-]*$/u.test(cliName) || cliNames.has(cliName)) {
      fail('QA_TARGET_PARAMETER_CLI_NAME_INVALID', cliName);
    }
    cliNames.add(cliName);
    const schema = {
      type: rawSchema.type,
      cliName,
      required: rawSchema.required === true,
      ...(Object.prototype.hasOwnProperty.call(rawSchema, 'default')
        ? { default: rawSchema.default }
        : {}),
    };
    if (rawSchema.type === 'integer') {
      if (
        Object.prototype.hasOwnProperty.call(rawSchema, 'minimum')
        && !Number.isSafeInteger(rawSchema.minimum)
      ) {
        fail('QA_TARGET_PARAMETER_MINIMUM_INVALID', normalizedName);
      }
      if (
        Object.prototype.hasOwnProperty.call(rawSchema, 'maximum')
        && !Number.isSafeInteger(rawSchema.maximum)
      ) {
        fail('QA_TARGET_PARAMETER_MAXIMUM_INVALID', normalizedName);
      }
      schema.minimum = rawSchema.minimum ?? Number.MIN_SAFE_INTEGER;
      schema.maximum = rawSchema.maximum ?? Number.MAX_SAFE_INTEGER;
      if (schema.minimum > schema.maximum) {
        fail('QA_TARGET_PARAMETER_RANGE_INVALID', normalizedName);
      }
    }
    if (rawSchema.type === 'enum') {
      schema.values = normalizeStringArray(
        rawSchema.values,
        'QA_TARGET_PARAMETER_ENUM_INVALID',
        { minimumLength: 1 },
      );
    }
    if (rawSchema.type === 'string' && rawSchema.absolutePath === true) {
      schema.absolutePath = true;
    }
    if (
      rawSchema.type === 'string'
      && Object.prototype.hasOwnProperty.call(rawSchema, 'absolutePath')
      && typeof rawSchema.absolutePath !== 'boolean'
    ) {
      fail('QA_TARGET_PARAMETER_ABSOLUTE_PATH_FLAG_INVALID', normalizedName);
    }
    if (Object.prototype.hasOwnProperty.call(schema, 'default')) {
      schema.default = parseParameterValue(schema.default, schema);
    }
    assertPlainData(schema, `parameters.${normalizedName}`);
    return [normalizedName, Object.freeze(schema)];
  });
  return Object.freeze(Object.fromEntries(normalizedEntries));
}

function normalizeOperatorHandoffPolicy(value, targetId) {
  if (value === undefined || value === null) return null;
  if (!isPlainObject(value)) {
    fail('QA_TARGET_OPERATOR_HANDOFF_POLICY_INVALID', targetId);
  }
  const unknownKey = Object.keys(value).find(
    (key) => !OPERATOR_HANDOFF_POLICY_KEYS.has(key),
  );
  if (unknownKey) {
    fail('QA_TARGET_OPERATOR_HANDOFF_POLICY_KEY_UNKNOWN', `${targetId}:${unknownKey}`);
  }
  for (const [key, expected] of Object.entries(OPERATOR_HANDOFF_POLICY_VALUES)) {
    if (value[key] !== expected) {
      fail('QA_TARGET_OPERATOR_HANDOFF_POLICY_INVALID', `${targetId}:${key}`);
    }
  }
  return Object.freeze({ ...OPERATOR_HANDOFF_POLICY_VALUES });
}

export function defineQaTarget(rawTarget) {
  if (!isPlainObject(rawTarget)) fail('QA_TARGET_INVALID');
  assertPlainData(rawTarget);
  const id = typeof rawTarget.id === 'string' ? rawTarget.id.trim() : '';
  if (!TARGET_ID_PATTERN.test(id)) fail('QA_TARGET_ID_INVALID', id || 'missing');
  const title = typeof rawTarget.title === 'string' ? rawTarget.title.trim() : '';
  if (!title) fail('QA_TARGET_TITLE_REQUIRED', id);
  const family = normalizeIdentifier(
    rawTarget.family || id.split('/')[0],
    'QA_TARGET_FAMILY_INVALID',
  );
  const protocolId = normalizeIdentifier(
    rawTarget.protocolId,
    'QA_TARGET_PROTOCOL_ID_INVALID',
  );
  const lane = typeof rawTarget.lane === 'string' ? rawTarget.lane.trim() : '';
  if (!Object.values(QA_LANES).includes(lane)) {
    fail('QA_TARGET_LANE_INVALID', lane || 'missing');
  }
  const supportedModes = normalizeStringArray(
    rawTarget.supportedModes,
    'QA_TARGET_MODES_INVALID',
    {
      allowedValues: Object.values(QA_MODES),
      minimumLength: 1,
    },
  );
  const environmentId = rawTarget.environmentId === null
    || rawTarget.environmentId === undefined
    ? null
    : normalizeIdentifier(
      rawTarget.environmentId,
      'QA_TARGET_ENVIRONMENT_ID_INVALID',
    );
  const browserRequirements = normalizeQaBrowserRequirements(
    rawTarget.browserRequirements,
    { environmentId },
  );
  const artifactId = rawTarget.artifactId === null
    || rawTarget.artifactId === undefined
    ? null
    : normalizeIdentifier(rawTarget.artifactId, 'QA_TARGET_ARTIFACT_ID_INVALID');
  const resourceClaims = normalizeStringArray(
    rawTarget.resourceClaims || [],
    'QA_TARGET_RESOURCE_CLAIMS_INVALID',
    { pattern: /^[a-z][a-z0-9_.:/-]*$/u },
  );
  const concurrency = rawTarget.concurrency === undefined
    ? QA_TARGET_CONCURRENCY.EXCLUSIVE_MEASUREMENT
    : rawTarget.concurrency;
  if (!Object.values(QA_TARGET_CONCURRENCY).includes(concurrency)) {
    fail('QA_TARGET_CONCURRENCY_INVALID', id);
  }
  if (Object.prototype.hasOwnProperty.call(rawTarget.parameters || {}, 'presentation')) {
    fail('QA_TARGET_PRESENTATION_PARAMETER_RESERVED', id);
  }
  const presentationParameter = createQaBrowserPresentationParameter(
    browserRequirements,
  );
  const parameters = normalizeParameterSchema({
    ...(presentationParameter ? { presentation: presentationParameter } : {}),
    ...(rawTarget.parameters || {}),
  });
  const browserObservation = normalizeQaBrowserObservation(rawTarget.browserObservation,
    { parameters, browserRequirements, supportedModes });
  const protocolOptions = rawTarget.protocolOptions || {};
  assertPlainData(protocolOptions, 'protocolOptions');
  const operatorHandoffPolicy = normalizeOperatorHandoffPolicy(
    rawTarget.operatorHandoffPolicy,
    id,
  );
  if (operatorHandoffPolicy && !supportedModes.includes(QA_MODES.HUMAN)) {
    fail('QA_TARGET_OPERATOR_HANDOFF_HUMAN_MODE_REQUIRED', id);
  }
  return Object.freeze({
    id,
    title,
    family,
    lane,
    protocolId,
    supportedModes,
    environmentId,
    browserRequirements,
    browserObservation,
    artifactId,
    resourceClaims,
    concurrency,
    parameters,
    operatorHandoffPolicy,
    protocolOptions: cloneFrozenPlainData(protocolOptions),
  });
}

function parseBoolean(value, cliName) {
  if (value === true || value === false) return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  fail('QA_RUN_PARAMETER_BOOLEAN_INVALID', `${cliName}=${String(value)}`);
}

function parseParameterValue(value, schema) {
  if (schema.type === 'boolean') return parseBoolean(value, schema.cliName);
  if (schema.type === 'integer') {
    const numeric = Number(value);
    if (
      !Number.isSafeInteger(numeric)
      || numeric < schema.minimum
      || numeric > schema.maximum
    ) {
      fail('QA_RUN_PARAMETER_INTEGER_INVALID', `${schema.cliName}=${String(value)}`);
    }
    return numeric;
  }
  if (schema.type === 'enum') {
    if (!schema.values.includes(value)) {
      fail('QA_RUN_PARAMETER_ENUM_INVALID', `${schema.cliName}=${String(value)}`);
    }
    return value;
  }
  if (typeof value !== 'string' || !value.trim() || value !== value.trim()) {
    fail('QA_RUN_PARAMETER_STRING_INVALID', schema.cliName);
  }
  if (schema.absolutePath && !path.isAbsolute(value)) {
    fail('QA_RUN_PARAMETER_ABSOLUTE_PATH_REQUIRED', schema.cliName);
  }
  return schema.absolutePath ? path.normalize(value) : value;
}

export function normalizeQaTargetParameters(target, rawParameters = {}) {
  if (!isPlainObject(rawParameters)) fail('QA_RUN_PARAMETERS_INVALID');
  const schemaByCliName = new Map(
    Object.entries(target.parameters).map(([name, schema]) => [
      schema.cliName,
      { name, schema },
    ]),
  );
  Object.keys(rawParameters).forEach((cliName) => {
    if (!schemaByCliName.has(cliName)) {
      fail('QA_RUN_PARAMETER_UNKNOWN', cliName);
    }
  });
  const normalized = {};
  schemaByCliName.forEach(({ name, schema }, cliName) => {
    if (Object.prototype.hasOwnProperty.call(rawParameters, cliName)) {
      normalized[name] = parseParameterValue(rawParameters[cliName], schema);
    } else if (Object.prototype.hasOwnProperty.call(schema, 'default')) {
      normalized[name] = parseParameterValue(schema.default, schema);
    } else if (schema.required) {
      fail('QA_RUN_PARAMETER_REQUIRED', cliName);
    }
  });
  return Object.freeze(normalized);
}
