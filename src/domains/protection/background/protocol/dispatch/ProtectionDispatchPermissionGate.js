import {
  buildExactOriginPatternForUrl,
  getHostname,
} from '../../../../../lib/index.js';
import {
  permissionsContainsSafe,
  toErrorMessage,
} from './ProtectionDispatchTransport.js';

const DEFAULT_PERMISSION_CACHE_TTL_MS = 10_000;
const DEFAULT_SKIP_LOG_THROTTLE_MS = 60_000;

function readCachedPermission(entry, now) {
  if (!entry || typeof entry !== 'object') return null;
  if (!Number.isFinite(entry.expiresAt) || entry.expiresAt <= now) return null;
  return entry.value;
}

function createPermissionState({ scripting = null, host = null } = {}) {
  return Object.freeze({
    scripting,
    host,
  });
}

function createPermissionGateState({ allowed, reason = null, scripting = null, host = null }) {
  return Object.freeze({
    allowed,
    reason,
    permissionState: createPermissionState({ scripting, host }),
  });
}

function requirePermissionHostname(hostname) {
  const normalizedHostname = typeof hostname === 'string' ? hostname.trim().toLowerCase() : '';
  if (!normalizedHostname) {
    throw new Error('PROTECTION_DISPATCH_PERMISSION_GATE_HOSTNAME_REQUIRED');
  }
  return normalizedHostname;
}

function requirePermissionScope(url) {
  const originPattern = buildExactOriginPatternForUrl(url);
  const hostname = getHostname(url);
  if (!originPattern || !hostname) {
    throw new Error('PROTECTION_DISPATCH_PERMISSION_GATE_URL_REQUIRED');
  }
  return { hostname, originPattern };
}

export function createProtectionDispatchPermissionGate({
  browserPort,
  recordDiagnostic,
  permissionCacheTtlMs = DEFAULT_PERMISSION_CACHE_TTL_MS,
  skipLogThrottleMs = DEFAULT_SKIP_LOG_THROTTLE_MS,
} = {}) {
  if (!browserPort || typeof browserPort.permissionsContains !== 'function') {
    throw new Error('PROTECTION_DISPATCH_PERMISSION_GATE_BROWSER_PORT_REQUIRED');
  }
  if (typeof recordDiagnostic !== 'function') {
    throw new Error('PROTECTION_DISPATCH_PERMISSION_GATE_DIAGNOSTICS_REQUIRED');
  }

  let cachedScriptingPermission = {
    value: null,
    expiresAt: 0,
  };
  const cachedHostPermissionByOrigin = new Map();
  const skipLogAtBySignature = new Map();
  let revision = 0;
  const admittedStates = new WeakMap();

  function assertRevisionCurrent(expectedRevision, phase) {
    if (expectedRevision === revision) return;
    const error = new Error('PROTECTION_DISPATCH_PERMISSION_CHANGED');
    Object.assign(error, { code: error.message, phase, expectedRevision, currentRevision: revision });
    throw error;
  }

  function assertCurrent(state, phase) {
    if (!admittedStates.has(state)) throw new Error('PROTECTION_DISPATCH_PERMISSION_RECEIPT_REQUIRED');
    assertRevisionCurrent(admittedStates.get(state), phase);
  }

  function refreshLookups() {
    cachedScriptingPermission = { value: null, expiresAt: 0 };
    cachedHostPermissionByOrigin.clear();
  }

  function clear() {
    revision += 1;
    refreshLookups();
  }

  async function getScriptingPermissionState(now, expectedRevision) {
    const cached = readCachedPermission(cachedScriptingPermission, now);
    if (cached !== null) return cached;
    const next = await permissionsContainsSafe(
      { permissions: ['scripting'] },
      browserPort,
      {
        onError: (error) => {
          recordDiagnostic('dispatch_scripting_permission_lookup_failed', {
            error: toErrorMessage(error),
          });
        },
      },
    );
    assertRevisionCurrent(expectedRevision, 'scripting_permission_resolved');
    cachedScriptingPermission = {
      value: next,
      expiresAt: now + permissionCacheTtlMs,
    };
    return next;
  }

  async function getHostPermissionState(scope, now, expectedRevision) {
    const key = scope.originPattern;

    const cached = readCachedPermission(cachedHostPermissionByOrigin.get(key), now);
    if (cached !== null) return cached;

    const next = await permissionsContainsSafe(
      { origins: [scope.originPattern] },
      browserPort,
      {
        onError: (error) => {
          recordDiagnostic('dispatch_host_permission_lookup_failed', {
            hostname: scope.hostname,
            origins: [scope.originPattern],
            error: toErrorMessage(error),
          });
        },
      },
    );
    assertRevisionCurrent(expectedRevision, 'host_permission_resolved');
    cachedHostPermissionByOrigin.set(key, {
      value: next,
      expiresAt: now + permissionCacheTtlMs,
    });
    return next;
  }

  async function getState(url, now = Date.now()) {
    const scope = requirePermissionScope(url);
    const expectedRevision = revision;
    const admit = (values) => {
      assertRevisionCurrent(expectedRevision, 'permission_admission');
      const state = createPermissionGateState(values);
      admittedStates.set(state, expectedRevision);
      return state;
    };
    const hasScriptingPermission = await getScriptingPermissionState(now, expectedRevision);
    assertRevisionCurrent(expectedRevision, 'after_scripting_permission');
    if (hasScriptingPermission === false) {
      return admit({
        allowed: false,
        reason: 'missing_scripting_permission',
        scripting: false,
        host: null,
      });
    }

    const hasHostPermission = await getHostPermissionState(scope, now, expectedRevision);
    if (hasHostPermission === false) {
      return admit({
        allowed: false,
        reason: 'missing_host_permission',
        scripting: hasScriptingPermission,
        host: false,
      });
    }

    return admit({
      allowed: true,
      reason: null,
      scripting: hasScriptingPermission,
      host: hasHostPermission,
    });
  }

  function shouldLogSkip({ tabId, hostname, reason, now = Date.now() }) {
    const key = `${tabId}|${requirePermissionHostname(hostname)}|${reason || 'unknown'}`;
    const prev = skipLogAtBySignature.get(key) || 0;
    if (now - prev < skipLogThrottleMs) return false;
    skipLogAtBySignature.set(key, now);
    return true;
  }

  return {
    clear,
    refreshLookups,
    assertCurrent,
    getState,
    shouldLogSkip,
  };
}
