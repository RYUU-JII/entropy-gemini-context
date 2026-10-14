import {
  createOriginPermissionMatcher,
  getUniqueOrigins,
  requireConcreteOriginPermissions,
} from '../../../lib/permissions.js';
import { normalizeDomain } from '../../../lib/domain.js';

export const ARTIFACT_CAPABILITY_KINDS = Object.freeze({
  PROTECTION: 'protection',
  MEMORY: 'memory',
});

export const ARTIFACT_CAPABILITY_STATUSES = Object.freeze({
  READY: 'ready',
  PERMISSION_SNAPSHOT_UNAVAILABLE: 'permission_snapshot_unavailable',
  PARTIAL_PROTECTION_ACCESS: 'partial_protection_access',
  INACTIVE_UNTIL_PROTECTION_ACCESS: 'inactive_until_protection_access',
  INACTIVE_UNTIL_PROTECTED_SITES: 'inactive_until_protected_sites',
  INACTIVE_UNTIL_MEMORY_ACCESS: 'inactive_until_memory_access',
});

export const EMPTY_PERMISSION_SNAPSHOT = Object.freeze({
  permissions: Object.freeze([]),
  origins: Object.freeze([]),
});

const PERMISSION_SNAPSHOT_READ_FAILED = 'PERMISSION_SNAPSHOT_READ_FAILED';
const PERMISSION_SNAPSHOT_INVALID = 'PERMISSION_SNAPSHOT_INVALID';

const PROTECTION_ARTIFACT_IDS = Object.freeze([
  'lens',
  'veil',
  'brake',
  'barrier',
  'flare',
  'gate',
]);

export function normalizePermissionSnapshot(snapshot = null) {
  const readError = normalizePermissionSnapshotReadError(snapshot?.readError);
  if (readError) {
    return {
      permissions: Object.freeze([]),
      origins: Object.freeze([]),
      readError,
    };
  }
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return {
      permissions: Object.freeze([]),
      origins: Object.freeze([]),
      readError: PERMISSION_SNAPSHOT_INVALID,
    };
  }
  if (!Array.isArray(snapshot.permissions) || !Array.isArray(snapshot.origins)) {
    return {
      permissions: Object.freeze([]),
      origins: Object.freeze([]),
      readError: PERMISSION_SNAPSHOT_INVALID,
    };
  }
  return {
    permissions: Object.freeze(snapshot.permissions.filter(Boolean)),
    origins: Object.freeze(requireConcreteOriginPermissions(
      getUniqueOrigins(snapshot.origins),
      'PROTECTION_ARTIFACT_PERMISSION_ORIGIN_CONTRACT_INVALID',
    )),
  };
}

function normalizePermissionSnapshotReadError(error = null) {
  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }
  if (typeof error?.code === 'string' && error.code.trim()) {
    return error.code.trim();
  }
  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message.trim();
  }
  return '';
}

export function createPermissionSnapshotReadError(error = null) {
  return Object.freeze({
    permissions: Object.freeze([]),
    origins: Object.freeze([]),
    readError: normalizePermissionSnapshotReadError(error) || PERMISSION_SNAPSHOT_READ_FAILED,
  });
}

function normalizeManagedDomains(blockedUrls = [], allowedUrls = []) {
  const domains = [
    ...(Array.isArray(blockedUrls) ? blockedUrls : []),
    ...(Array.isArray(allowedUrls) ? allowedUrls : []),
  ].map((domain) => normalizeDomain(domain)).filter(Boolean);
  return Array.from(new Set(domains));
}

function isConfiguredChildEnabled(childState = null) {
  if (!childState || typeof childState !== 'object') return false;
  if (Object.prototype.hasOwnProperty.call(childState, 'configuredEnabled')) {
    return childState.configuredEnabled === true;
  }
  return childState.enabled === true;
}

function resolveProtectionCapability({
  permissions = [],
  origins = [],
  readError = '',
  permissionMode = 'selective',
  managedDomains = [],
} = {}) {
  if (permissionMode !== 'selective') {
    throw new Error('PROTECTION_ARTIFACT_PERMISSION_MODE_CONTRACT_INVALID');
  }
  if (readError) {
    return Object.freeze({
      kind: ARTIFACT_CAPABILITY_KINDS.PROTECTION,
      status: ARTIFACT_CAPABILITY_STATUSES.PERMISSION_SNAPSHOT_UNAVAILABLE,
      ready: false,
      fullyReady: false,
      canPreview: true,
      permissionMode: 'selective',
      hasScripting: false,
      managedDomainCount: managedDomains.length,
      coveredDomainCount: 0,
      missingDomainCount: managedDomains.length,
      readError,
    });
  }

  const hasScripting = permissions.includes('scripting');
  const originPermissionMatcher = createOriginPermissionMatcher(origins);
  const coveredDomains = [];
  const missingDomains = [];
  managedDomains.forEach((domain) => {
    (originPermissionMatcher.hasDomain(domain) ? coveredDomains : missingDomains).push(domain);
  });
  const hasAnyDomainAccess = coveredDomains.length > 0;
  const hasFullDomainAccess = (
    managedDomains.length > 0 && missingDomains.length === 0
  );

  let status = ARTIFACT_CAPABILITY_STATUSES.READY;
  if (managedDomains.length === 0) {
    status = ARTIFACT_CAPABILITY_STATUSES.INACTIVE_UNTIL_PROTECTED_SITES;
  } else if (!hasScripting) {
    status = ARTIFACT_CAPABILITY_STATUSES.INACTIVE_UNTIL_PROTECTION_ACCESS;
  } else if (!hasAnyDomainAccess) {
    status = ARTIFACT_CAPABILITY_STATUSES.INACTIVE_UNTIL_PROTECTION_ACCESS;
  } else if (!hasFullDomainAccess) {
    status = ARTIFACT_CAPABILITY_STATUSES.PARTIAL_PROTECTION_ACCESS;
  }

  return Object.freeze({
    kind: ARTIFACT_CAPABILITY_KINDS.PROTECTION,
    status,
    ready: status === ARTIFACT_CAPABILITY_STATUSES.READY
      || status === ARTIFACT_CAPABILITY_STATUSES.PARTIAL_PROTECTION_ACCESS,
    fullyReady: status === ARTIFACT_CAPABILITY_STATUSES.READY,
    canPreview: status === ARTIFACT_CAPABILITY_STATUSES.READY
      || status === ARTIFACT_CAPABILITY_STATUSES.PARTIAL_PROTECTION_ACCESS,
    permissionMode: 'selective',
    hasScripting,
    managedDomainCount: managedDomains.length,
    coveredDomainCount: coveredDomains.length,
    missingDomainCount: missingDomains.length,
  });
}

function resolveMemoryCapability({
  permissions = [],
  readError = '',
  artifactFamilies = {},
} = {}) {
  const echoChildren = artifactFamilies?.echo?.children || {};
  const needsHistory = isConfiguredChildEnabled(echoChildren.historyCleanup);
  const needsBookmarks = isConfiguredChildEnabled(echoChildren.bookmarkConceal);
  if (readError) {
    return Object.freeze({
      kind: ARTIFACT_CAPABILITY_KINDS.MEMORY,
      status: ARTIFACT_CAPABILITY_STATUSES.PERMISSION_SNAPSHOT_UNAVAILABLE,
      ready: false,
      fullyReady: false,
      canPreview: true,
      needsHistory,
      needsBookmarks,
      hasHistory: false,
      hasBookmarks: false,
      missingPermissions: Object.freeze([]),
      readError,
    });
  }

  const hasHistory = permissions.includes('history');
  const hasBookmarks = permissions.includes('bookmarks');
  const missing = [
    needsHistory && !hasHistory ? 'history' : '',
    needsBookmarks && !hasBookmarks ? 'bookmarks' : '',
  ].filter(Boolean);
  const status = missing.length > 0
    ? ARTIFACT_CAPABILITY_STATUSES.INACTIVE_UNTIL_MEMORY_ACCESS
    : ARTIFACT_CAPABILITY_STATUSES.READY;

  return Object.freeze({
    kind: ARTIFACT_CAPABILITY_KINDS.MEMORY,
    status,
    ready: status === ARTIFACT_CAPABILITY_STATUSES.READY,
    fullyReady: status === ARTIFACT_CAPABILITY_STATUSES.READY,
    canPreview: status === ARTIFACT_CAPABILITY_STATUSES.READY,
    needsHistory,
    needsBookmarks,
    hasHistory,
    hasBookmarks,
    missingPermissions: Object.freeze(missing),
  });
}

export function buildProtectionArtifactCapabilityState({
  permissionSnapshot = EMPTY_PERMISSION_SNAPSHOT,
  permissionMode = 'selective',
  blockedUrls = [],
  allowedUrls = [],
  artifactFamilies = {},
} = {}) {
  const normalizedSnapshot = normalizePermissionSnapshot(permissionSnapshot);
  const managedDomains = normalizeManagedDomains(blockedUrls, allowedUrls);
  const protectionCapability = resolveProtectionCapability({
    permissions: normalizedSnapshot.permissions,
    origins: normalizedSnapshot.origins,
    readError: normalizedSnapshot.readError,
    permissionMode,
    managedDomains,
  });
  const memoryCapability = resolveMemoryCapability({
    permissions: normalizedSnapshot.permissions,
    readError: normalizedSnapshot.readError,
    artifactFamilies,
  });
  const artifacts = PROTECTION_ARTIFACT_IDS.reduce((acc, artifactId) => {
    acc[artifactId] = protectionCapability;
    return acc;
  }, {
    echo: memoryCapability,
  });
  artifacts.barrier = Object.freeze({ ...protectionCapability,
    hasTabGroups: normalizedSnapshot.readError ? null : normalizedSnapshot.permissions.includes('tabGroups'),
  });

  return Object.freeze({
    capturedAt: Date.now(),
    permissions: Object.freeze([...normalizedSnapshot.permissions]),
    origins: Object.freeze([...normalizedSnapshot.origins]),
    readError: normalizedSnapshot.readError || '',
    managedDomains: Object.freeze(managedDomains),
    protection: protectionCapability,
    memory: memoryCapability,
    artifacts: Object.freeze(artifacts),
  });
}
