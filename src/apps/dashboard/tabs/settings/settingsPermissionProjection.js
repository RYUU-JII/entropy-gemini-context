import { createOriginPermissionMatcher } from '../../../../lib/permissions.js';

export const EMPTY_SETTINGS_PERMISSION_STATE = Object.freeze({
  scripting: false,
  history: false,
  notifications: false,
  behavior: false,
  origins: Object.freeze([]),
  blockedCovered: 0,
  blockedTotal: 0,
});

function requireSettingsPermissionSnapshot(snapshot) {
  if (
    !snapshot
    || typeof snapshot !== 'object'
    || Array.isArray(snapshot)
    || !Array.isArray(snapshot.permissions)
    || !Array.isArray(snapshot.origins)
  ) {
    throw new Error('SETTINGS_PERMISSION_SNAPSHOT_INVALID');
  }
  return snapshot;
}

function requireBlockedUrls(blockedUrls) {
  if (!Array.isArray(blockedUrls)) {
    throw new Error('SETTINGS_PERMISSION_BLOCKED_URLS_INVALID');
  }
  return blockedUrls;
}

export function projectSettingsPermissionState(snapshot, blockedUrls) {
  const { permissions, origins } = requireSettingsPermissionSnapshot(snapshot);
  const blocked = requireBlockedUrls(blockedUrls);
  const matcher = createOriginPermissionMatcher(origins);
  const blockedCovered = blocked.reduce(
    (covered, domain) => covered + (matcher.hasDomain(domain) ? 1 : 0),
    0,
  );

  return Object.freeze({
    scripting: permissions.includes('scripting'),
    history: permissions.includes('history'),
    notifications: permissions.includes('notifications'),
    behavior: permissions.includes('idle') && permissions.includes('webNavigation'),
    origins,
    blockedCovered,
    blockedTotal: blocked.length,
  });
}

export function areSettingsPermissionStatesEqual(left, right) {
  if (left === right) return true;
  if (!left || !right) return false;
  if (
    left.scripting !== right.scripting
    || left.history !== right.history
    || left.notifications !== right.notifications
    || left.behavior !== right.behavior
    || left.blockedCovered !== right.blockedCovered
    || left.blockedTotal !== right.blockedTotal
  ) {
    return false;
  }
  const leftOrigins = left.origins;
  const rightOrigins = right.origins;
  return Array.isArray(leftOrigins)
    && Array.isArray(rightOrigins)
    && leftOrigins.length === rightOrigins.length
    && leftOrigins.every((origin, index) => origin === rightOrigins[index]);
}
