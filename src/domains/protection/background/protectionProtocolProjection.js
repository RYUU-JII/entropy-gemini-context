import { PROTOCOL_TARGET_SOURCES } from '../runtime/protocolStateSnapshot.js';

const PROTOCOL_TARGET_SOURCE_VALUES = new Set(Object.values(PROTOCOL_TARGET_SOURCES));

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function failProtocolProjection(code) {
  throw new Error(code);
}

function requireProtocolProjectionObject(value, errorCode) {
  if (!isPlainObject(value)) {
    failProtocolProjection(errorCode);
  }
  return value;
}

function normalizeProjectionHostname(hostname) {
  return typeof hostname === 'string' ? hostname.trim().toLowerCase() : '';
}

function resolveProtocolScope(protocolState, hostname) {
  const state = requireProtocolProjectionObject(
    protocolState,
    'PROTECTION_PROTOCOL_PROJECTION_STATE_INVALID',
  );
  const scopes = requireProtocolProjectionObject(
    state.scopes,
    'PROTECTION_PROTOCOL_PROJECTION_SCOPES_INVALID',
  );
  const normalizedHostname = normalizeProjectionHostname(hostname);
  if (!normalizedHostname) {
    return null;
  }
  if (!Object.prototype.hasOwnProperty.call(scopes, normalizedHostname)) {
    return null;
  }

  return requireProtocolProjectionObject(
    scopes[normalizedHostname],
    'PROTECTION_PROTOCOL_PROJECTION_SCOPE_INVALID',
  );
}

function resolveProtocolTarget(protocolScope, fieldName) {
  if (protocolScope === null) {
    return null;
  }
  if (!Object.prototype.hasOwnProperty.call(protocolScope, fieldName)) {
    failProtocolProjection(`PROTECTION_PROTOCOL_PROJECTION_TARGET_INVALID:${fieldName}`);
  }
  return requireProtocolProjectionObject(
    protocolScope[fieldName],
    `PROTECTION_PROTOCOL_PROJECTION_TARGET_INVALID:${fieldName}`,
  );
}

function resolveProtocolTargetSource(target, fieldName) {
  if (target === null) {
    return PROTOCOL_TARGET_SOURCES.NONE;
  }
  if (
    typeof target.targetSource !== 'string'
    || !PROTOCOL_TARGET_SOURCE_VALUES.has(target.targetSource)
  ) {
    failProtocolProjection(`PROTECTION_PROTOCOL_PROJECTION_TARGET_INVALID:${fieldName}.targetSource`);
  }
  return target.targetSource;
}

function resolveProtocolTargetMinutes(target, fieldName) {
  if (target === null) {
    return 0;
  }
  if (!Number.isInteger(target.targetMinutes) || target.targetMinutes < 0) {
    failProtocolProjection(`PROTECTION_PROTOCOL_PROJECTION_TARGET_INVALID:${fieldName}.targetMinutes`);
  }
  return target.targetMinutes;
}

function resolveProtocolBudgetRole(protocolScope) {
  if (protocolScope === null) {
    return 'reference';
  }
  if (typeof protocolScope.budgetRole !== 'string' || !protocolScope.budgetRole.trim()) {
    failProtocolProjection('PROTECTION_PROTOCOL_PROJECTION_BUDGET_ROLE_INVALID');
  }
  return protocolScope.budgetRole;
}

export function resolveProtectionProtocolScopeProjection(protocolScope = null) {
  const resolvedProtocolScope = protocolScope === null
    ? null
    : requireProtocolProjectionObject(
      protocolScope,
      'PROTECTION_PROTOCOL_PROJECTION_SCOPE_INVALID',
    );
  const protocolReferenceTarget = resolveProtocolTarget(resolvedProtocolScope, 'referenceTarget');
  const protocolActiveTarget = resolveProtocolTarget(resolvedProtocolScope, 'activeTarget');
  const protocolTargetMinutes = resolveProtocolTargetMinutes(protocolActiveTarget, 'activeTarget');

  return {
    protocolScope: resolvedProtocolScope,
    protocolReferenceTarget,
    protocolActiveTarget,
    protocolBudgetRole: resolveProtocolBudgetRole(resolvedProtocolScope),
    protocolReferenceTargetSource: resolveProtocolTargetSource(protocolReferenceTarget, 'referenceTarget'),
    protocolActiveTargetSource: resolveProtocolTargetSource(protocolActiveTarget, 'activeTarget'),
    protocolReferenceTargetMinutes: resolveProtocolTargetMinutes(protocolReferenceTarget, 'referenceTarget'),
    protocolActiveTargetMinutes: protocolTargetMinutes,
    protocolTargetMinutes,
  };
}

export function resolveProtectionProtocolProjection(protocolState, hostname = '') {
  const protocolScope = resolveProtocolScope(protocolState, hostname);
  return resolveProtectionProtocolScopeProjection(protocolScope);
}
