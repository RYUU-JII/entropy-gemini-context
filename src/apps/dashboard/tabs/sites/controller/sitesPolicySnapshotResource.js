import {
  buildStatsDashboardPolicyFingerprint,
  buildStatsDashboardPolicyInput,
} from '../../../../../domains/stats/analysis/index.js';
import { recordDashboardTabEntryStage } from '@dashboard-tab-entry-telemetry';
import { requireSitesSiteDetailRevision } from '../../../../../domains/stats/contracts/sitesSiteDetailContracts.js';
import { useAnalysisStore } from '../../../stores/useAnalysisStore.js';

const snapshotInFlightByFingerprint = new Map();
const currentReadersByFingerprint = new Map();
let snapshotPreloadTail = Promise.resolve();

function createSnapshotResourceError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function requirePolicyFingerprint(value) {
  const policyFingerprint = typeof value === 'string' ? value.trim() : '';
  if (!policyFingerprint) {
    throw createSnapshotResourceError('SITES_POLICY_SNAPSHOT_RESOURCE_FINGERPRINT_REQUIRED');
  }
  return policyFingerprint;
}

function requireTelemetrySource(value) {
  if (value === 'boot' || value === 'render') return value;
  throw createSnapshotResourceError('SITES_POLICY_SNAPSHOT_TELEMETRY_SOURCE_INVALID');
}

function readMatchingSnapshot(policyFingerprint, { allowStale = false } = {}) {
  const state = useAnalysisStore.getState();
  const snapshot = state?.sitesSnapshot;
  if (
    (allowStale || state?.sitesSnapshotStale !== true)
    && snapshot?.policyFingerprint === policyFingerprint
  ) {
    try {
      requireSitesSiteDetailRevision(snapshot.siteDetailRevision);
      return snapshot;
    } catch {
      return null;
    }
  }
  return null;
}

export function admitSitesPolicySnapshotRefreshForDetailRevisionMismatch({
  policyFingerprint,
  requestedSiteDetailRevision,
  responseSiteDetailRevision,
} = {}) {
  const normalizedPolicyFingerprint = requirePolicyFingerprint(policyFingerprint);
  const requestedRevision = requireSitesSiteDetailRevision(requestedSiteDetailRevision);
  const responseRevision = requireSitesSiteDetailRevision(responseSiteDetailRevision);
  if (requestedRevision === responseRevision) {
    throw createSnapshotResourceError(
      'SITES_POLICY_SNAPSHOT_DETAIL_REVISION_MISMATCH_REQUIRED',
    );
  }

  const state = useAnalysisStore.getState();
  const snapshot = state?.sitesSnapshot;
  if (snapshot?.policyFingerprint !== normalizedPolicyFingerprint) return false;

  let currentRevision;
  try {
    currentRevision = requireSitesSiteDetailRevision(snapshot.siteDetailRevision);
  } catch {
    throw createSnapshotResourceError('SITES_POLICY_SNAPSHOT_STORED_REVISION_INVALID');
  }
  if (currentRevision !== requestedRevision) return false;
  if (state?.sitesSnapshotStale === true) return true;
  if (typeof useAnalysisStore.setState !== 'function') {
    throw createSnapshotResourceError('SITES_POLICY_SNAPSHOT_STALE_MARK_OWNER_REQUIRED');
  }
  useAnalysisStore.setState({ sitesSnapshotStale: true });
  return true;
}

export function preloadSitesPolicySnapshot({
  policyInput,
  telemetrySource = 'render',
  isRequestCurrent,
} = {}) {
  if (!policyInput || typeof policyInput !== 'object' || Array.isArray(policyInput)) {
    throw createSnapshotResourceError('SITES_POLICY_SNAPSHOT_RESOURCE_POLICY_REQUIRED');
  }
  const resolvedTelemetrySource = requireTelemetrySource(telemetrySource);
  if (isRequestCurrent !== undefined && typeof isRequestCurrent !== 'function') {
    throw createSnapshotResourceError('SITES_POLICY_SNAPSHOT_CURRENT_READER_INVALID');
  }
  const normalizedPolicyInput = buildStatsDashboardPolicyInput(policyInput);
  const policyFingerprint = buildStatsDashboardPolicyFingerprint(normalizedPolicyInput);
  const cached = readMatchingSnapshot(policyFingerprint);
  if (cached) {
    recordDashboardTabEntryStage('sites', 'data:sites-snapshot', {
      cacheStatus: 'hit',
      source: resolvedTelemetrySource,
    });
    return Promise.resolve(cached);
  }

  const pending = snapshotInFlightByFingerprint.get(policyFingerprint);
  if (pending) {
    if (isRequestCurrent) currentReadersByFingerprint.get(policyFingerprint).add(isRequestCurrent);
    recordDashboardTabEntryStage('sites', 'data:sites-snapshot', {
      cacheStatus: 'join',
      source: resolvedTelemetrySource,
    });
    return pending;
  }

  const currentReaders = new Set(isRequestCurrent ? [isRequestCurrent] : []);
  currentReadersByFingerprint.set(policyFingerprint, currentReaders);

  const operation = snapshotPreloadTail.then(async () => {
    const admittedSnapshot = readMatchingSnapshot(policyFingerprint);
    if (admittedSnapshot) {
      recordDashboardTabEntryStage('sites', 'data:sites-snapshot', {
        cacheStatus: 'hit',
        source: resolvedTelemetrySource,
      });
      return admittedSnapshot;
    }

    const refreshSitesSnapshot = useAnalysisStore.getState()?.refreshSitesSnapshot;
    if (typeof refreshSitesSnapshot !== 'function') {
      throw createSnapshotResourceError('SITES_POLICY_SNAPSHOT_REFRESH_OWNER_REQUIRED');
    }
    recordDashboardTabEntryStage('sites', 'data:sites-snapshot', {
      cacheStatus: 'miss',
      ioKind: 'runtime-message',
      source: resolvedTelemetrySource,
    });
    let committed = await refreshSitesSnapshot({ policyInput: normalizedPolicyInput });
    // The analysis owner may finish a queued policy read before resolving the
    // earlier request that we joined. Its exact, fresh commit is the receipt;
    // the superseded request's boolean is not the current policy's result.
    const currentSnapshot = readMatchingSnapshot(policyFingerprint);
    if (currentSnapshot) return currentSnapshot;
    if (committed?.status === 'superseded') {
      if (committed.projection !== 'sites' || !Number.isSafeInteger(committed.requestSequence)
        || committed.requestSequence <= 0 || !Number.isSafeInteger(committed.supersedingSequence)
        || committed.supersedingSequence <= committed.requestSequence) {
        throw createSnapshotResourceError('SITES_POLICY_SNAPSHOT_SUPERSESSION_RECEIPT_INVALID');
      }
      // Only an actual sequence-fenced read and a still-active consumer can
      // admit one replacement query. Failures/refusals never use this path.
      if ([...currentReaders].some((reader) => reader() === true)) {
        committed = await refreshSitesSnapshot({ policyInput: normalizedPolicyInput });
        const replacementSnapshot = readMatchingSnapshot(policyFingerprint);
        if (replacementSnapshot) return replacementSnapshot;
      }
    }
    if (committed !== true) {
      const failure = useAnalysisStore.getState().sitesError;
      const error = createSnapshotResourceError(
        failure?.code || 'SITES_POLICY_SNAPSHOT_REFRESH_INCOMPLETE',
      );
      if (failure?.message) error.message = failure.message;
      throw error;
    }

    // A stats commit during this read marks the new result stale, but does not
    // invalidate the successfully admitted snapshot. Return it with the store's
    // stale bit intact; the active hook owns the next coalesced refresh.
    const refreshedSnapshot = readMatchingSnapshot(policyFingerprint, { allowStale: true });
    if (!refreshedSnapshot) {
      throw createSnapshotResourceError('SITES_POLICY_SNAPSHOT_REFRESH_INCOMPLETE');
    }
    return refreshedSnapshot;
  });
  snapshotPreloadTail = operation.catch(() => undefined);
  snapshotInFlightByFingerprint.set(policyFingerprint, operation);
  const clearInFlight = () => {
    if (snapshotInFlightByFingerprint.get(policyFingerprint) === operation) {
      snapshotInFlightByFingerprint.delete(policyFingerprint);
      currentReadersByFingerprint.delete(policyFingerprint);
    }
  };
  operation.then(clearInFlight, clearInFlight);
  return operation;
}

export function resetSitesPolicySnapshotResourceCache() {
  snapshotInFlightByFingerprint.clear();
  currentReadersByFingerprint.clear();
  snapshotPreloadTail = Promise.resolve();
}
