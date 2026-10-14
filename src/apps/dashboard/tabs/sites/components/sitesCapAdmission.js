const ADMISSION_STATUSES = new Set(['ready', 'loading', 'error']);

// This is UI admission only. It retains no snapshot or settings value.
export function requireSitesCapAdmissionStatus(status) {
  if (!ADMISSION_STATUSES.has(status)) throw new Error('SITES_CAP_ADMISSION_STATUS_INVALID');
  return status;
}

export function resolveSitesCapAdmissionStatus({ currentSnapshotReady, snapshotStatus }) {
  const validStatus = currentSnapshotReady === true
    ? ['ready', 'refreshing', 'refresh_error'].includes(snapshotStatus)
    : currentSnapshotReady === false && ['loading', 'error'].includes(snapshotStatus);
  if (!validStatus) {
    throw new Error('SITES_CAP_SNAPSHOT_ADMISSION_INVALID');
  }
  return currentSnapshotReady ? 'ready' : snapshotStatus === 'error' ? 'error' : 'loading';
}

export function requireSitesCapMutationAdmission(status, available) {
  requireSitesCapAdmissionStatus(status);
  if (status !== 'ready' || available !== true) throw new Error('SITES_CAP_MUTATION_NOT_ADMITTED');
}
