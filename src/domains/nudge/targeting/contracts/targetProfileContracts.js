import { SUPPORTED_SITE_IDS, resolveSiteId } from '../siteIdentityCatalog.js';

const OWNER_ID_PATTERN = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/u;
const TARGET_FIELD_KEY_PATTERN = /^[a-z][A-Za-z0-9]*$/u;
const RESERVED_TARGET_KEYS = new Set([
  ...Object.getOwnPropertyNames(Object.prototype),
  'prototype',
]);

export const TARGET_VALUE_KINDS = Object.freeze({
  SELECTOR: 'selector',
  SELECTOR_LIST: 'selector_list',
  STRING_LIST: 'string_list',
  NUMBER: 'number',
  SELECTOR_MAP: 'selector_map',
  SELECTOR_LIST_MAP: 'selector_list_map',
});

export const TARGET_MERGE_POLICIES = Object.freeze({
  REPLACE: 'replace',
  EXTEND_SELECTOR: 'extend_selector',
  MERGE_MAP: 'merge_map',
});

function fail(ownerId, path, reason) {
  const normalizedOwnerId = typeof ownerId === 'string' && ownerId
    ? ownerId.toUpperCase()
    : 'UNKNOWN';
  const error = new Error(`TARGET_PROFILE_CONTRACT_INVALID:${normalizedOwnerId}:${path}:${reason}`);
  error.code = 'TARGET_PROFILE_CONTRACT_INVALID';
  error.details = Object.freeze({ ownerId, path, reason });
  throw error;
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validateRecordShape(value, ownerId, path, reason = 'object_required') {
  if (!isPlainObject(value)) fail(ownerId, path, reason);
  Reflect.ownKeys(value).forEach((key) => {
    if (typeof key !== 'string') fail(ownerId, path, 'symbol_property_forbidden');
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
      fail(ownerId, `${path}.${key}`, 'enumerable_data_property_required');
    }
  });
}

function readEnvelopeOwnerId(definition) {
  if (!isPlainObject(definition)) return 'unknown';
  const descriptor = Object.getOwnPropertyDescriptor(definition, 'ownerId');
  return descriptor && Object.hasOwn(descriptor, 'value')
    ? descriptor.value
    : 'unknown';
}

function validateDenseArray(value, ownerId, path) {
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.hasOwn(value, index)) fail(ownerId, `${path}[${index}]`, 'sparse_array_forbidden');
  }
  Reflect.ownKeys(value).forEach((key) => {
    if (key === 'length') return;
    if (
      typeof key !== 'string'
      || !/^(?:0|[1-9][0-9]*)$/u.test(key)
      || Number(key) >= value.length
    ) {
      fail(ownerId, `${path}.${String(key)}`, 'array_property_forbidden');
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
      fail(ownerId, `${path}.${key}`, 'enumerable_data_property_required');
    }
  });
}

function failTargetValue(reason) {
  const error = new Error(`TARGET_PROFILE_VALUE_INVALID:${reason}`);
  error.code = 'TARGET_PROFILE_VALUE_INVALID';
  error.details = Object.freeze({ reason });
  throw error;
}

function cloneTargetValue(value, ancestors) {
  if (Array.isArray(value)) {
    if (ancestors.has(value)) failTargetValue('cyclic_value');
    ancestors.add(value);
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.hasOwn(value, index)) failTargetValue('sparse_array');
    }
    Reflect.ownKeys(value).forEach((key) => {
      if (key === 'length') return;
      if (
        typeof key !== 'string'
        || !/^(?:0|[1-9][0-9]*)$/u.test(key)
        || Number(key) >= value.length
      ) {
        failTargetValue('array_property');
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
        failTargetValue('enumerable_data_property_required');
      }
    });
    const cloned = Object.freeze(value.map((entry) => cloneTargetValue(entry, ancestors)));
    ancestors.delete(value);
    return cloned;
  }
  if (isPlainObject(value)) {
    if (ancestors.has(value)) failTargetValue('cyclic_value');
    ancestors.add(value);
    const entries = Reflect.ownKeys(value).map((key) => {
      if (typeof key !== 'string') failTargetValue('symbol_property');
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
        failTargetValue('enumerable_data_property_required');
      }
      return [key, cloneTargetValue(descriptor.value, ancestors)];
    });
    const cloned = Object.freeze(Object.fromEntries(entries));
    ancestors.delete(value);
    return cloned;
  }
  if (
    value !== null
    && (typeof value === 'object' || typeof value === 'function')
  ) failTargetValue('unsupported_value_type');
  return value;
}

export function cloneAndFreezeTargetValue(value) {
  return cloneTargetValue(value, new WeakSet());
}

function validateString(value, ownerId, path, { allowEmpty = false } = {}) {
  if (typeof value !== 'string') fail(ownerId, path, 'string_required');
  if (value !== value.trim()) fail(ownerId, path, 'surrounding_whitespace_forbidden');
  if (!allowEmpty && value.length === 0) fail(ownerId, path, 'empty_string_forbidden');
}

function validateTargetFieldKey(value, ownerId, path) {
  validateString(value, ownerId, path);
  if (
    !TARGET_FIELD_KEY_PATTERN.test(value)
    || RESERVED_TARGET_KEYS.has(value)
  ) {
    fail(ownerId, path, 'canonical_target_field_key_required');
  }
}

function validateStringList(value, ownerId, path, { allowEmpty = false } = {}) {
  if (!Array.isArray(value)) fail(ownerId, path, 'array_required');
  if (!allowEmpty && value.length === 0) fail(ownerId, path, 'empty_array_forbidden');
  validateDenseArray(value, ownerId, path);
  const seen = new Set();
  value.forEach((entry, index) => {
    validateString(entry, ownerId, `${path}[${index}]`);
    if (seen.has(entry)) fail(ownerId, `${path}[${index}]`, 'duplicate_entry');
    seen.add(entry);
  });
}

function validateMap(value, descriptor, ownerId, path, siteId) {
  validateRecordShape(value, ownerId, path);
  const allowedKeys = new Set(descriptor.keys);
  Object.keys(value).forEach((key) => {
    if (!allowedKeys.has(key)) fail(ownerId, `${path}.${key}`, 'unknown_nested_key');
  });
  if (siteId === 'default' || descriptor.requireAllInOverrides) {
    allowedKeys.forEach((key) => {
      if (!Object.hasOwn(value, key)) fail(ownerId, `${path}.${key}`, 'required_nested_key_missing');
    });
  }
  Object.entries(value).forEach(([key, entry]) => {
    if (descriptor.kind === TARGET_VALUE_KINDS.SELECTOR_MAP) {
      validateString(entry, ownerId, `${path}.${key}`, {
        allowEmpty: descriptor.allowEmpty === true,
      });
    } else {
      validateStringList(entry, ownerId, `${path}.${key}`, {
        allowEmpty: descriptor.allowEmpty === true,
      });
    }
  });
}

function validateField(value, descriptor, ownerId, path, siteId) {
  if (!isPlainObject(descriptor)) fail(ownerId, path, 'schema_descriptor_required');
  switch (descriptor.kind) {
    case TARGET_VALUE_KINDS.SELECTOR:
      validateString(value, ownerId, path, { allowEmpty: descriptor.allowEmpty === true });
      return;
    case TARGET_VALUE_KINDS.SELECTOR_LIST:
    case TARGET_VALUE_KINDS.STRING_LIST:
      validateStringList(value, ownerId, path, { allowEmpty: descriptor.allowEmpty === true });
      return;
    case TARGET_VALUE_KINDS.NUMBER: {
      const minimum = Number.isFinite(descriptor.minimum) ? descriptor.minimum : 0;
      if (!Number.isFinite(value) || value < minimum) fail(ownerId, path, 'number_out_of_range');
      return;
    }
    case TARGET_VALUE_KINDS.SELECTOR_MAP:
    case TARGET_VALUE_KINDS.SELECTOR_LIST_MAP:
      validateMap(value, descriptor, ownerId, path, siteId);
      return;
    default:
      fail(ownerId, path, 'unsupported_field_kind');
  }
}

function validateSchemaDescriptor(descriptor, ownerId, fieldKey) {
  const path = `schema.${fieldKey}`;
  validateRecordShape(descriptor, ownerId, path, 'schema_descriptor_required');
  const kind = descriptor.kind;
  const simpleKinds = new Set([
    TARGET_VALUE_KINDS.SELECTOR,
    TARGET_VALUE_KINDS.SELECTOR_LIST,
    TARGET_VALUE_KINDS.STRING_LIST,
  ]);
  let allowedKeys = null;
  if (simpleKinds.has(kind)) {
    allowedKeys = new Set(['kind', 'allowEmpty']);
  } else if (kind === TARGET_VALUE_KINDS.NUMBER) {
    allowedKeys = new Set(['kind', 'minimum']);
  } else if (
    kind === TARGET_VALUE_KINDS.SELECTOR_MAP
    || kind === TARGET_VALUE_KINDS.SELECTOR_LIST_MAP
  ) {
    allowedKeys = new Set(['kind', 'keys', 'allowEmpty', 'requireAllInOverrides']);
    if (!Array.isArray(descriptor.keys) || descriptor.keys.length === 0) {
      fail(ownerId, `${path}.keys`, 'non_empty_key_list_required');
    }
    validateDenseArray(descriptor.keys, ownerId, `${path}.keys`);
    const seen = new Set();
    descriptor.keys.forEach((key, index) => {
      validateTargetFieldKey(key, ownerId, `${path}.keys[${index}]`);
      if (seen.has(key)) fail(ownerId, `${path}.keys[${index}]`, 'duplicate_entry');
      seen.add(key);
    });
  } else {
    fail(ownerId, `${path}.kind`, 'unsupported_field_kind');
  }
  Object.keys(descriptor).forEach((key) => {
    if (!allowedKeys.has(key)) fail(ownerId, `${path}.${key}`, 'unknown_schema_option');
  });
  if (Object.hasOwn(descriptor, 'allowEmpty') && typeof descriptor.allowEmpty !== 'boolean') {
    fail(ownerId, `${path}.allowEmpty`, 'boolean_required');
  }
  if (
    Object.hasOwn(descriptor, 'requireAllInOverrides')
    && typeof descriptor.requireAllInOverrides !== 'boolean'
  ) {
    fail(ownerId, `${path}.requireAllInOverrides`, 'boolean_required');
  }
  if (
    kind === TARGET_VALUE_KINDS.NUMBER
    && Object.hasOwn(descriptor, 'minimum')
    && !Number.isFinite(descriptor.minimum)
  ) {
    fail(ownerId, `${path}.minimum`, 'finite_number_required');
  }
}

function validateDefinition({ ownerId, schema, mergePolicies, profiles }) {
  validateString(ownerId, ownerId, 'ownerId');
  if (!OWNER_ID_PATTERN.test(ownerId)) fail(ownerId, 'ownerId', 'canonical_owner_id_required');
  validateRecordShape(schema, ownerId, 'schema');
  validateRecordShape(mergePolicies, ownerId, 'mergePolicies');
  validateRecordShape(profiles, ownerId, 'profiles');
  if (!Object.hasOwn(profiles, 'default')) fail(ownerId, 'profiles.default', 'default_profile_required');

  const schemaKeys = Object.keys(schema).sort();
  if (schemaKeys.length === 0) fail(ownerId, 'schema', 'non_empty_schema_required');
  schemaKeys.forEach((key) => {
    validateTargetFieldKey(key, ownerId, `schema.${key}`);
    validateSchemaDescriptor(schema[key], ownerId, key);
  });
  const policyKeys = Object.keys(mergePolicies).sort();
  if (schemaKeys.length !== policyKeys.length) fail(ownerId, 'mergePolicies', 'schema_coverage_invalid');
  schemaKeys.forEach((key, index) => {
    if (policyKeys[index] !== key) fail(ownerId, `mergePolicies.${key}`, 'schema_policy_missing');
    if (!Object.values(TARGET_MERGE_POLICIES).includes(mergePolicies[key])) {
      fail(ownerId, `mergePolicies.${key}`, 'unsupported_merge_policy');
    }
    const kind = schema[key].kind;
    if (
      mergePolicies[key] === TARGET_MERGE_POLICIES.EXTEND_SELECTOR
      && kind !== TARGET_VALUE_KINDS.SELECTOR
    ) {
      fail(ownerId, `mergePolicies.${key}`, 'selector_policy_kind_mismatch');
    }
    if (
      mergePolicies[key] === TARGET_MERGE_POLICIES.MERGE_MAP
      && kind !== TARGET_VALUE_KINDS.SELECTOR_MAP
      && kind !== TARGET_VALUE_KINDS.SELECTOR_LIST_MAP
    ) {
      fail(ownerId, `mergePolicies.${key}`, 'map_policy_kind_mismatch');
    }
  });

  const supportedSiteIds = new Set(SUPPORTED_SITE_IDS);
  Object.entries(profiles).forEach(([siteId, fields]) => {
    if (!supportedSiteIds.has(siteId)) fail(ownerId, `profiles.${siteId}`, 'unknown_site_id');
    validateRecordShape(fields, ownerId, `profiles.${siteId}`, 'profile_object_required');
    if (siteId !== 'default' && Object.keys(fields).length === 0) {
      fail(ownerId, `profiles.${siteId}`, 'empty_site_override_forbidden');
    }
    Object.keys(fields).forEach((key) => {
      if (!Object.hasOwn(schema, key)) fail(ownerId, `profiles.${siteId}.${key}`, 'unknown_profile_field');
    });
    if (siteId === 'default') {
      schemaKeys.forEach((key) => {
        if (!Object.hasOwn(fields, key)) {
          fail(ownerId, `profiles.default.${key}`, 'required_default_field_missing');
        }
      });
    }
    Object.entries(fields).forEach(([key, value]) => {
      validateField(value, schema[key], ownerId, `profiles.${siteId}.${key}`, siteId);
      if (
        siteId !== 'default'
        && mergePolicies[key] === TARGET_MERGE_POLICIES.MERGE_MAP
        && Object.keys(value).length === 0
      ) {
        fail(ownerId, `profiles.${siteId}.${key}`, 'empty_map_override_forbidden');
      }
      if (
        siteId !== 'default'
        && mergePolicies[key] === TARGET_MERGE_POLICIES.EXTEND_SELECTOR
        && value.length === 0
      ) {
        fail(ownerId, `profiles.${siteId}.${key}`, 'empty_selector_extension_forbidden');
      }
    });
  });
}

export function defineTargetProfileFields(definition) {
  const envelopeOwnerId = readEnvelopeOwnerId(definition);
  validateRecordShape(definition, envelopeOwnerId, 'definition');
  const allowedDefinitionKeys = new Set(['fields', 'ownerId', 'path', 'schema']);
  Object.keys(definition).forEach((key) => {
    if (!allowedDefinitionKeys.has(key)) {
      fail(envelopeOwnerId, `definition.${key}`, 'unknown_definition_option');
    }
  });
  const {
    ownerId,
    schema,
    fields,
    path = 'profile',
  } = definition;
  validateString(ownerId, ownerId, 'ownerId');
  if (!OWNER_ID_PATTERN.test(ownerId)) fail(ownerId, 'ownerId', 'canonical_owner_id_required');
  validateRecordShape(schema, ownerId, 'schema');
  validateRecordShape(fields, ownerId, path, 'profile_object_required');

  const schemaKeys = Object.keys(schema).sort();
  if (schemaKeys.length === 0) fail(ownerId, 'schema', 'non_empty_schema_required');
  schemaKeys.forEach((key) => {
    validateTargetFieldKey(key, ownerId, `schema.${key}`);
    validateSchemaDescriptor(schema[key], ownerId, key);
  });
  Object.keys(fields).forEach((key) => {
    if (!Object.hasOwn(schema, key)) fail(ownerId, `${path}.${key}`, 'unknown_profile_field');
  });
  schemaKeys.forEach((key) => {
    if (!Object.hasOwn(fields, key)) fail(ownerId, `${path}.${key}`, 'required_profile_field_missing');
    validateField(fields[key], schema[key], ownerId, `${path}.${key}`, 'default');
  });
  return cloneAndFreezeTargetValue(fields);
}

function extendSelector(baseValue, overrideValue) {
  return [baseValue, overrideValue].filter(Boolean).join(', ');
}

export function createTargetProfileResolver(definition) {
  const envelopeOwnerId = readEnvelopeOwnerId(definition);
  validateRecordShape(definition, envelopeOwnerId, 'definition');
  const allowedDefinitionKeys = new Set(['mergePolicies', 'ownerId', 'profiles', 'schema']);
  Object.keys(definition).forEach((key) => {
    if (!allowedDefinitionKeys.has(key)) {
      fail(envelopeOwnerId, `definition.${key}`, 'unknown_definition_option');
    }
  });
  const {
    ownerId,
    schema,
    mergePolicies,
    profiles,
  } = definition;
  validateDefinition({ ownerId, schema, mergePolicies, profiles });
  const compiledDefinition = cloneAndFreezeTargetValue({
    ownerId,
    schema,
    mergePolicies,
    profiles,
  });
  const {
    ownerId: compiledOwnerId,
    schema: compiledSchema,
    mergePolicies: compiledMergePolicies,
    profiles: declarations,
  } = compiledDefinition;
  const compiledProfiles = new Map();

  return function getTargetProfile(hostname = '') {
    const siteId = resolveSiteId(hostname);
    const cached = compiledProfiles.get(siteId);
    if (cached) return cached;

    const baseFields = declarations.default;
    const siteFields = siteId !== 'default' && Object.hasOwn(declarations, siteId)
      ? declarations[siteId]
      : null;
    const targets = {};
    Object.keys(compiledSchema).forEach((key) => {
      const hasOverride = !!siteFields && Object.hasOwn(siteFields, key);
      const policy = compiledMergePolicies[key];
      if (!hasOverride || policy === TARGET_MERGE_POLICIES.REPLACE) {
        targets[key] = hasOverride ? siteFields[key] : baseFields[key];
      } else if (policy === TARGET_MERGE_POLICIES.EXTEND_SELECTOR) {
        targets[key] = extendSelector(baseFields[key], siteFields[key]);
      } else if (policy === TARGET_MERGE_POLICIES.MERGE_MAP) {
        targets[key] = { ...baseFields[key], ...siteFields[key] };
      } else {
        fail(compiledOwnerId, `mergePolicies.${key}`, 'unsupported_merge_policy');
      }
    });

    const profile = Object.freeze({
      ownerId: compiledOwnerId,
      siteId,
      source: siteFields ? 'domain_exception' : 'generic',
      exceptionKeys: Object.freeze(siteFields ? Object.keys(siteFields).sort() : []),
      targets: cloneAndFreezeTargetValue(targets),
    });
    compiledProfiles.set(siteId, profile);
    return profile;
  };
}
