import { normalizeTimeWindowTimestamp } from '../../../../lib/timeWindow.js';

const GATE_RUNTIME_SNAPSHOT_ERROR = 'PROTECTION_GATE_RUNTIME_SNAPSHOT_INVALID';
const GATE_RUNTIME_CONTEXT_ERROR = 'PROTECTION_GATE_RUNTIME_CONTEXT_INVALID';

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(source, fieldName) {
  return Object.prototype.hasOwnProperty.call(source, fieldName);
}

function createSnapshotError(fieldName, errorCode = GATE_RUNTIME_SNAPSHOT_ERROR) {
  return new Error(`${errorCode}:${fieldName}`);
}

function normalizeHost(hostname) {
  return typeof hostname === 'string' ? hostname.trim().toLowerCase() : '';
}

function resolveSnapshotSource(snapshot, { allowNull = true } = {}) {
  if (snapshot === null || snapshot === undefined) {
    if (allowNull) return {};
    throw createSnapshotError('snapshot');
  }
  if (!isPlainObject(snapshot)) {
    throw createSnapshotError('snapshot');
  }
  return snapshot;
}

function readOptionalString(source, fieldName, errorCode = GATE_RUNTIME_SNAPSHOT_ERROR) {
  if (!hasOwn(source, fieldName)) return '';
  const value = source[fieldName];
  if (typeof value !== 'string') {
    throw createSnapshotError(fieldName, errorCode);
  }
  return value.trim();
}

function readOptionalBoolean(source, fieldName, errorCode = GATE_RUNTIME_SNAPSHOT_ERROR) {
  if (!hasOwn(source, fieldName)) return false;
  if (typeof source[fieldName] !== 'boolean') {
    throw createSnapshotError(fieldName, errorCode);
  }
  return source[fieldName];
}

function readOptionalNonNegativeInteger(source, fieldName, errorCode = GATE_RUNTIME_SNAPSHOT_ERROR) {
  if (!hasOwn(source, fieldName)) return 0;
  const value = source[fieldName];
  if (!Number.isInteger(value) || value < 0) {
    throw createSnapshotError(fieldName, errorCode);
  }
  return value;
}

function readRequiredNonNegativeInteger(source, fieldName, errorCode) {
  if (!hasOwn(source, fieldName)) {
    throw createSnapshotError(fieldName, errorCode);
  }
  return readOptionalNonNegativeInteger(source, fieldName, errorCode);
}

function readOptionalTabId(source, fieldName, errorCode = GATE_RUNTIME_SNAPSHOT_ERROR) {
  if (!hasOwn(source, fieldName) || source[fieldName] === null) return null;
  return readOptionalNonNegativeInteger(source, fieldName, errorCode);
}

function assignOptionalTabPlacement(target, source, errorCode) {
  if (hasOwn(source, 'windowId')) {
    target.windowId = readOptionalNonNegativeInteger(source, 'windowId', errorCode);
  }
  if (hasOwn(source, 'index')) {
    target.index = readOptionalNonNegativeInteger(source, 'index', errorCode);
  }
  if (hasOwn(source, 'openerTabId')) {
    target.openerTabId = readOptionalTabId(source, 'openerTabId', errorCode);
  }
  return target;
}

function readOptionalTimestamp(source, fieldName, errorCode = GATE_RUNTIME_SNAPSHOT_ERROR) {
  return normalizeTimeWindowTimestamp(
    readOptionalNonNegativeInteger(source, fieldName, errorCode),
  );
}

function readOptionalTimestampList(source, fieldName, errorCode = GATE_RUNTIME_SNAPSHOT_ERROR) {
  if (!hasOwn(source, fieldName)) return [];
  const value = source[fieldName];
  if (!Array.isArray(value)) {
    throw createSnapshotError(fieldName, errorCode);
  }
  return value.map((entry, index) => {
    if (!Number.isInteger(entry) || entry <= 0) {
      throw createSnapshotError(`${fieldName}.${index}`, errorCode);
    }
    return entry;
  });
}

function readOptionalProtectedTabList(source, fieldName, errorCode = GATE_RUNTIME_SNAPSHOT_ERROR) {
  if (!hasOwn(source, fieldName)) return [];
  const value = source[fieldName];
  if (!Array.isArray(value)) {
    throw createSnapshotError(fieldName, errorCode);
  }
  return value.map((entry, index) => {
    if (!isPlainObject(entry)) {
      throw createSnapshotError(`${fieldName}.${index}`, errorCode);
    }
    const tabId = readRequiredNonNegativeInteger(entry, 'tabId', errorCode);
    const hostname = normalizeHost(readOptionalString(entry, 'hostname', errorCode));
    const url = readOptionalString(entry, 'url', errorCode);
    if (!hostname || !url) {
      throw createSnapshotError(`${fieldName}.${index}`, errorCode);
    }
    return assignOptionalTabPlacement({
      tabId,
      hostname,
      url,
      title: readOptionalString(entry, 'title', errorCode),
      favIconUrl: readOptionalString(entry, 'favIconUrl', errorCode),
      active: readOptionalBoolean(entry, 'active', errorCode),
    }, entry, errorCode);
  });
}

export function normalizeGateRuntimeSnapshot(snapshot = null, options = {}) {
  const source = resolveSnapshotSource(snapshot, options);
  return {
    hostname: normalizeHost(readOptionalString(source, 'hostname')),
    isForeground: readOptionalBoolean(source, 'isForeground'),
    foregroundTabId: readOptionalTabId(source, 'foregroundTabId'),
    foregroundActiveAt: readOptionalNonNegativeInteger(source, 'foregroundActiveAt'),
    lastEnteredAt: readOptionalNonNegativeInteger(source, 'lastEnteredAt'),
    lastExitAt: readOptionalNonNegativeInteger(source, 'lastExitAt'),
    lastReturnAt: readOptionalNonNegativeInteger(source, 'lastReturnAt'),
    lastTabId: readOptionalTabId(source, 'lastTabId'),
    recentSwitchInAts: readOptionalTimestampList(source, 'recentSwitchInAts'),
    protectedTabCount: readOptionalNonNegativeInteger(source, 'protectedTabCount'),
    detourSpreadNoticedCount: readOptionalNonNegativeInteger(source, 'detourSpreadNoticedCount'),
    detourSpreadReviewedCount: readOptionalNonNegativeInteger(source, 'detourSpreadReviewedCount'),
    protectedTabHostCount: readOptionalNonNegativeInteger(source, 'protectedTabHostCount'),
    protectedTabs: readOptionalProtectedTabList(source, 'protectedTabs'),
    detourEntryObserved: readOptionalBoolean(source, 'detourEntryObserved'),
    consumedProtectedContextCount: readOptionalNonNegativeInteger(source, 'consumedProtectedContextCount'),
    consumeDwellMs: readOptionalNonNegativeInteger(source, 'consumeDwellMs'),
    contextWindowMs: readOptionalNonNegativeInteger(source, 'contextWindowMs'),
    keptTabPassUntil: readOptionalTimestamp(source, 'keptTabPassUntil'),
    entryApproved: readOptionalBoolean(source, 'entryApproved'),
    lastContinueAt: readOptionalNonNegativeInteger(source, 'lastContinueAt'),
    lastContinueKind: readOptionalString(source, 'lastContinueKind'),
    lastContinuityRelation: readOptionalString(source, 'lastContinuityRelation'),
    lastContinuityAt: readOptionalNonNegativeInteger(source, 'lastContinuityAt'),
    mediaMaintenanceUntil: readOptionalTimestamp(source, 'mediaMaintenanceUntil'),
    lastMediaMaintenanceReturnAt: readOptionalNonNegativeInteger(source, 'lastMediaMaintenanceReturnAt'),
    returnLockActive: readOptionalBoolean(source, 'returnLockActive'),
    returnLockLeftAt: readOptionalNonNegativeInteger(source, 'returnLockLeftAt'),
    returnLockUntil: readOptionalNonNegativeInteger(source, 'returnLockUntil'),
  };
}

export function normalizeGateProtectedContextSnapshot(snapshot) {
  if (!isPlainObject(snapshot)) {
    throw createSnapshotError('snapshot', GATE_RUNTIME_CONTEXT_ERROR);
  }
  return {
    consumedProtectedContextCount: readRequiredNonNegativeInteger(
      snapshot,
      'consumedProtectedContextCount',
      GATE_RUNTIME_CONTEXT_ERROR,
    ),
    consumeDwellMs: readRequiredNonNegativeInteger(snapshot, 'consumeDwellMs', GATE_RUNTIME_CONTEXT_ERROR),
    contextWindowMs: readRequiredNonNegativeInteger(snapshot, 'contextWindowMs', GATE_RUNTIME_CONTEXT_ERROR),
  };
}
