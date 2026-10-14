import { permissionsGetAllStrict, subscribePermissionsChanged } from '../../../platform/chrome/ChromeService.js';
import { recordDashboardTabEntryStage } from '@dashboard-tab-entry-telemetry';

export const DASHBOARD_PERMISSION_SNAPSHOT_MAX_AGE_MS = 15_000;

let cachedSnapshot = null;
let cachedAtEpochMs = 0;
let inFlightRead = null;
let inFlightRevision = -1;
let queuedRead = null;
let resourceRevision = 0;
const changeListeners = new Set();
let unsubscribePermissions = null;

function ensurePermissionChangeSubscription() {
  if (!unsubscribePermissions) {
    unsubscribePermissions = subscribePermissionsChanged(() => {
      invalidateDashboardPermissionSnapshot();
      changeListeners.forEach((notify) => notify());
    });
  }
}

export function subscribeDashboardPermissionSnapshotChanges(listener) {
  if (typeof listener !== 'function') throw new Error('DASHBOARD_PERMISSION_SNAPSHOT_LISTENER_INVALID');
  changeListeners.add(listener);
  // The resource retains its browser listener for this dashboard document's
  // lifetime. Parked consumers stop refreshing, but external changes must still
  // invalidate the shared cache before another tab/controller reuses it.
  return () => { changeListeners.delete(listener); };
}

function normalizeMaxAgeMs(maxAgeMs) {
  const normalizedMaxAgeMs = Number(maxAgeMs);
  if (!Number.isFinite(normalizedMaxAgeMs) || normalizedMaxAgeMs < 0) {
    throw new Error('DASHBOARD_PERMISSION_SNAPSHOT_MAX_AGE_INVALID');
  }
  return normalizedMaxAgeMs;
}

function recordPermissionRead(tabId, cacheStatus, { io = false } = {}) {
  const normalizedTabId = typeof tabId === 'string' ? tabId.trim() : '';
  if (normalizedTabId !== 'settings' && normalizedTabId !== 'tools') return;
  recordDashboardTabEntryStage(normalizedTabId, 'data:browser-permissions', {
    cacheStatus,
    ...(io ? { ioKind: 'browser-permission' } : null),
  });
}

function freezePermissionSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return snapshot;
  if (!Array.isArray(snapshot.permissions) || !Array.isArray(snapshot.origins)) return snapshot;
  return Object.freeze({
    permissions: Object.freeze([...snapshot.permissions]),
    origins: Object.freeze([...snapshot.origins]),
  });
}

function startPermissionSnapshotRead() {
  const readRevision = resourceRevision;
  const read = Promise.resolve()
    .then(() => permissionsGetAllStrict())
    .then((snapshot) => {
      const validatedSnapshot = freezePermissionSnapshot(snapshot);
      if (readRevision === resourceRevision) {
        cachedSnapshot = validatedSnapshot;
        cachedAtEpochMs = Date.now();
      }
      return validatedSnapshot;
    })
    .finally(() => {
      if (inFlightRead === read) {
        inFlightRead = null;
      }
    });
  inFlightRead = read;
  inFlightRevision = readRevision;
  return read;
}

function queuePermissionSnapshotRead() {
  if (queuedRead) return queuedRead;
  const activeRead = inFlightRead;
  queuedRead = activeRead
    .catch(() => null)
    .then(() => {
      queuedRead = null;
      return startPermissionSnapshotRead();
    });
  return queuedRead;
}

export function readDashboardPermissionSnapshot({
  force = false,
  maxAgeMs = DASHBOARD_PERMISSION_SNAPSHOT_MAX_AGE_MS,
  tabId = '',
} = {}) {
  const normalizedMaxAgeMs = normalizeMaxAgeMs(maxAgeMs);
  try {
    ensurePermissionChangeSubscription();
  } catch (error) {
    return Promise.reject(error);
  }

  if (inFlightRead) {
    if (inFlightRevision === resourceRevision) {
      recordPermissionRead(tabId, 'join');
      return inFlightRead;
    }
    const joinsQueuedRead = !!queuedRead;
    const nextRead = queuePermissionSnapshotRead();
    recordPermissionRead(tabId, joinsQueuedRead ? 'join' : 'miss', {
      io: !joinsQueuedRead,
    });
    return nextRead;
  }
  const isFresh = cachedSnapshot
    && (Date.now() - cachedAtEpochMs) < normalizedMaxAgeMs;
  if (!force && isFresh) {
    recordPermissionRead(tabId, 'hit');
    return Promise.resolve(cachedSnapshot);
  }

  recordPermissionRead(tabId, 'miss', { io: true });
  return startPermissionSnapshotRead();
}

export function getFreshDashboardPermissionSnapshot({
  maxAgeMs = DASHBOARD_PERMISSION_SNAPSHOT_MAX_AGE_MS,
} = {}) {
  const normalizedMaxAgeMs = normalizeMaxAgeMs(maxAgeMs);
  const isFresh = cachedSnapshot
    && (Date.now() - cachedAtEpochMs) < normalizedMaxAgeMs;
  return isFresh ? cachedSnapshot : null;
}

export function invalidateDashboardPermissionSnapshot() {
  resourceRevision += 1;
  cachedSnapshot = null;
  cachedAtEpochMs = 0;
}

export function resetDashboardPermissionSnapshotResource() {
  unsubscribePermissions?.();
  unsubscribePermissions = null;
  changeListeners.clear();
  cachedSnapshot = null;
  cachedAtEpochMs = 0;
  inFlightRead = null;
  inFlightRevision = -1;
  queuedRead = null;
  resourceRevision += 1;
}
