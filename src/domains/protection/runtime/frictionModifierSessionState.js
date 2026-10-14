import {
  FRICTION_MODIFIER_SCOPE_KINDS,
  createFrictionModifierScopeContext,
  normalizeFrictionModifierIntent,
  resolveActiveFrictionModifierIntents,
} from './frictionModifierResolver.js';

export const FRICTION_MODIFIER_SESSION_SCHEMA_VERSION = 1;

export const DEFAULT_FRICTION_MODIFIER_SESSION_STATE = Object.freeze({
  schemaVersion: FRICTION_MODIFIER_SESSION_SCHEMA_VERSION,
  modifiersById: Object.freeze({}),
});

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeHostname(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function cloneModifierRecord(modifier) {
  return {
    ...modifier,
    scope: { ...modifier.scope },
    target: {
      ...modifier.target,
      ...(Array.isArray(modifier.target?.featureKeys)
        ? { featureKeys: [...modifier.target.featureKeys] }
        : {}),
    },
  };
}

export function normalizeFrictionModifierSessionState(rawState = DEFAULT_FRICTION_MODIFIER_SESSION_STATE, {
  now = Date.now(),
} = {}) {
  if (!isPlainObject(rawState)) {
    throw new Error('FRICTION_MODIFIER_SESSION_STATE_INVALID');
  }
  const source = rawState;
  if (
    source.schemaVersion !== FRICTION_MODIFIER_SESSION_SCHEMA_VERSION
    || Object.keys(source).length !== 2
    || !Object.hasOwn(source, 'modifiersById')
    || !isPlainObject(source.modifiersById)
  ) {
    throw new Error('FRICTION_MODIFIER_SESSION_CONTRACT_INVALID');
  }
  const modifiersById = source.modifiersById;
  const normalizedModifiers = Object.entries(modifiersById).map(([id, modifier]) => {
    const normalized = normalizeFrictionModifierIntent(modifier);
    if (normalized.id !== id) {
      throw new Error('FRICTION_MODIFIER_SESSION_IDENTITY_INVALID');
    }
    return normalized;
  });
  const modifiers = resolveActiveFrictionModifierIntents(normalizedModifiers, { now });

  return {
    schemaVersion: FRICTION_MODIFIER_SESSION_SCHEMA_VERSION,
    modifiersById: modifiers.reduce((acc, modifier) => {
      acc[modifier.id] = cloneModifierRecord(modifier);
      return acc;
    }, {}),
  };
}

export function buildFrictionModifierSessionState(modifiers = [], {
  now = Date.now(),
} = {}) {
  if (!Array.isArray(modifiers)) {
    throw new Error('FRICTION_MODIFIER_SESSION_MODIFIERS_INVALID');
  }
  const activeModifiers = resolveActiveFrictionModifierIntents(modifiers, { now });
  return {
    schemaVersion: FRICTION_MODIFIER_SESSION_SCHEMA_VERSION,
    modifiersById: activeModifiers.reduce((acc, modifier) => {
      acc[modifier.id] = cloneModifierRecord(modifier);
      return acc;
    }, {}),
  };
}

export function selectFrictionModifiersForScope(rawState, scopeContext, {
  now = Date.now(),
} = {}) {
  const state = normalizeFrictionModifierSessionState(rawState, { now });
  const context = createFrictionModifierScopeContext(scopeContext);
  return resolveActiveFrictionModifierIntents(Object.values(state.modifiersById), {
    now,
    scopeContext: context,
  }).map(cloneModifierRecord);
}

export function selectFrictionModifiersForHostname(rawState, hostname, {
  now = Date.now(),
} = {}) {
  const normalizedHostname = normalizeHostname(hostname);
  if (!normalizedHostname) {
    throw new Error('FRICTION_MODIFIER_HOSTNAME_REQUIRED');
  }
  return selectFrictionModifiersForScope(rawState, {
    kind: FRICTION_MODIFIER_SCOPE_KINDS.DOMAIN,
    hostname: normalizedHostname,
  }, { now });
}
