export const DASHBOARD_BOOT_EVENT_NAME = 'entropy:dashboard-boot';
export const DASHBOARD_BOOT_SNAPSHOT_FLAG = '__ENTROPY_DASHBOARD_BOOT_SNAPSHOT__';
export const DASHBOARD_BOOT_RECOVERY_EVENT_NAME = 'entropy:dashboard-boot-recovery';
export const DASHBOARD_SETUP_SURFACE_EVENT_NAME = 'entropy:dashboard-setup-surface';

export function reportDashboardSetupSurfaceReady() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(DASHBOARD_SETUP_SURFACE_EVENT_NAME));
}

// This is presentation readiness only. It never admits a profile generation or
// claims that canonical settings/core hydration succeeded.
export function reportDashboardBootRecoverySurfaceReady(reason) {
  if (!['profile_recovery', 'boot_failed', 'boot_timeout'].includes(reason)) {
    throw new Error('DASHBOARD_BOOT_RECOVERY_REASON_INVALID');
  }
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(DASHBOARD_BOOT_RECOVERY_EVENT_NAME, {
    detail: { reason },
  }));
}

export function emitDashboardBootSnapshot(snapshot) {
  if (typeof window === 'undefined') return;

  const safeSnapshot = snapshot && typeof snapshot === 'object'
    ? { ...snapshot, errors: Array.isArray(snapshot.errors) ? [...snapshot.errors] : [] }
    : null;

  window[DASHBOARD_BOOT_SNAPSHOT_FLAG] = safeSnapshot;

  if (typeof window.dispatchEvent !== 'function' || typeof CustomEvent !== 'function') {
    return;
  }

  window.dispatchEvent(new CustomEvent(DASHBOARD_BOOT_EVENT_NAME, {
    detail: safeSnapshot,
  }));
}

export function getDashboardBootSnapshotFromWindow() {
  if (typeof window === 'undefined') return null;
  const snapshot = window[DASHBOARD_BOOT_SNAPSHOT_FLAG];
  if (!snapshot || typeof snapshot !== 'object') return null;
  return {
    ...snapshot,
    errors: Array.isArray(snapshot.errors) ? [...snapshot.errors] : [],
  };
}
