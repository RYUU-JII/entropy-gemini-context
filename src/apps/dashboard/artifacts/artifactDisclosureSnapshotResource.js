import {
  assertArtifactDisclosureSnapshot,
  readArtifactDisclosureSnapshot,
} from './artifactDisclosureClient.js';
import { recordDashboardTabEntryStage } from '@dashboard-tab-entry-telemetry';
import { runtimeOnMessageAddListener, runtimeOnMessageRemoveListener } from '../../../platform/chrome/ChromeService.js';
import { isProgressionStateChangedMessage } from '../../../domains/progression/contracts/progressionStateChanged.js';
import { requireDashboardProfileGeneration } from '../bootstrap/dashboardProfileGenerationOwner.js';
import { assertDashboardProgressionGeneration } from '../progression/progressionRequestClient.js';

const INITIAL_STATE = Object.freeze({
  snapshot: null,
  error: null,
  status: 'idle',
  readAtEpochMs: 0,
  revision: 0,
});

let currentState = INITIAL_STATE;
let inFlightRead = null;
let readGeneration = 0;
let registrationPolicyFingerprint = null;
const listeners = new Set();
let connectionCount = 0;
let runtimeListener = null;

export function isArtifactDisclosureReadSuperseded(error) {
  return error instanceof Error && error.message === 'ARTIFACT_DISCLOSURE_READ_SUPERSEDED';
}

export function invalidateArtifactDisclosureSnapshotResource() {
  readGeneration += 1;
  inFlightRead = null;
  publish({ status: 'idle', error: null, readAtEpochMs: 0 });
}

// One document listener owns read invalidation regardless of mounted consumers.
// Events contain no grants or receipts. Hidden pages defer IO to normal reentry.
export function connectArtifactDisclosureSnapshotResource() {
  connectionCount += 1;
  if (runtimeListener === null) {
    runtimeListener = (message) => {
      if (!isProgressionStateChangedMessage(message)) return;
      let generation;
      try { generation = requireDashboardProfileGeneration(); } catch { return; }
      if (generation !== message.profileGeneration) return;
      invalidateArtifactDisclosureSnapshotResource();
      if (typeof document !== 'undefined' && document.hidden === true) return;
      void readArtifactDisclosureSnapshotResource().catch(() => undefined);
    };
    runtimeOnMessageAddListener(runtimeListener);
  }
  return () => {
    connectionCount -= 1;
    if (connectionCount === 0 && runtimeListener !== null) {
      runtimeOnMessageRemoveListener(runtimeListener);
      runtimeListener = null;
    }
  };
}

function publish(nextState) {
  currentState = Object.freeze({
    ...currentState,
    ...nextState,
    revision: currentState.revision + 1,
  });
  listeners.forEach((listener) => listener());
}

function isSupersededOwnerSnapshot(snapshot) {
  if (currentState.snapshot !== null && snapshot.stateUpdatedAtMs < currentState.snapshot.stateUpdatedAtMs) {
    return true;
  }
  const incoming = snapshot.developmentProjection;
  const accepted = currentState.snapshot?.developmentProjection;
  if (incoming !== undefined && incoming !== null
    && (typeof incoming !== 'object' || Array.isArray(incoming)
      || !Number.isInteger(incoming.updatedAtMs) || incoming.updatedAtMs < 0)) {
    throw new Error('ARTIFACT_DISCLOSURE_DEVELOPMENT_PROJECTION_ORDER_INVALID');
  }
  // Typed clients fence profile generation; a replaced generation requires a
  // fresh page. Both existing owner timestamps are strictly monotonic revisions
  // within that generation, including replies from another Dashboard window.
  return incoming !== undefined && incoming !== null
    && accepted !== undefined && accepted !== null
    && incoming.updatedAtMs < accepted.updatedAtMs;
}
export function getArtifactDisclosureSnapshotResourceState() {
  return currentState;
}

export function subscribeArtifactDisclosureSnapshotResource(listener) {
  if (typeof listener !== 'function') {
    throw new Error('ARTIFACT_DISCLOSURE_RESOURCE_LISTENER_REQUIRED');
  }
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function readArtifactDisclosureSnapshotResource({
  force = false,
  maxAgeMs = null,
} = {}) {
  if (inFlightRead) {
    recordDashboardTabEntryStage('tools', 'data:artifact-disclosure', {
      cacheStatus: 'join',
    });
    return inFlightRead;
  }
  const normalizedMaxAgeMs = Number(maxAgeMs);
  const hasFreshnessLimit = maxAgeMs !== null
    && maxAgeMs !== undefined
    && Number.isFinite(normalizedMaxAgeMs)
    && normalizedMaxAgeMs >= 0;
  const snapshotAgeMs = Date.now() - currentState.readAtEpochMs;
  const canReuseSnapshot = currentState.status === 'ready' && currentState.snapshot && (
    !hasFreshnessLimit || snapshotAgeMs < normalizedMaxAgeMs
  );
  if (!force && canReuseSnapshot) {
    recordDashboardTabEntryStage('tools', 'data:artifact-disclosure', {
      cacheStatus: 'hit',
    });
    return Promise.resolve(currentState.snapshot);
  }

  recordDashboardTabEntryStage('tools', 'data:artifact-disclosure', {
    cacheStatus: 'miss',
    ioKind: 'runtime-message',
  });

  publish({
    snapshot: currentState.snapshot,
    error: null,
    status: 'loading',
  });

  const admittedReadGeneration = readGeneration;
  const pendingRead = Promise.resolve()
    .then(() => {
      // Mount effects may replace this read before its deferred RPC starts.
      if (admittedReadGeneration !== readGeneration) {
        throw new Error('ARTIFACT_DISCLOSURE_READ_SUPERSEDED');
      }
      return readArtifactDisclosureSnapshot();
    })
    .then((snapshot) => {
      if (admittedReadGeneration !== readGeneration) {
        throw new Error('ARTIFACT_DISCLOSURE_READ_SUPERSEDED');
      }
      const accepted = isSupersededOwnerSnapshot(snapshot) ? currentState.snapshot : snapshot;
      publish({
        snapshot: accepted,
        error: null,
        status: 'ready',
        readAtEpochMs: Date.now(),
      });
      return accepted;
    })
    .catch((error) => {
      if (admittedReadGeneration !== readGeneration) throw error;
      publish({
        snapshot: currentState.snapshot,
        error: error instanceof Error ? error : new Error(String(error)),
        status: 'error',
      });
      throw error;
    })
    .finally(() => {
      if (inFlightRead === pendingRead) inFlightRead = null;
    });

  inFlightRead = pendingRead;

  return inFlightRead;
}

export function commitArtifactDisclosureSnapshotResource(snapshot) {
  const validated = assertArtifactDisclosureSnapshot(snapshot);
  // A command retains its own validated ACK, while presentation never regresses
  // to a session projection superseded by a newer accepted owner response.
  if (isSupersededOwnerSnapshot(validated)) return validated;
  readGeneration += 1;
  inFlightRead = null;
  publish({
    snapshot: validated,
    error: null,
    status: 'ready',
    readAtEpochMs: Date.now(),
  });
  return validated;
}

// A successful owner mutation supersedes reads admitted before its ACK. Force
// alone would join the old pending request and leave the gallery locked. Keep
// the accepted presentation mounted while the replacement canonical read runs;
// only an explicit resource reset withdraws it at a profile boundary.
export async function refreshArtifactDisclosureSnapshotResourceAfterMutation() {
  const profileGeneration = requireDashboardProfileGeneration();
  readGeneration += 1;
  inFlightRead = null;
  let pending = readArtifactDisclosureSnapshotResource({ force: true });
  for (;;) {
    try {
      const snapshot = await pending;
      assertDashboardProgressionGeneration(profileGeneration);
      return snapshot;
    } catch (error) {
      if (!isArtifactDisclosureReadSuperseded(error)) throw error;
      // A matching commit event or newer validated ACK may replace this read.
      // Continue its authoritative read handoff in the same admitted profile;
      // generic callers still observe supersession as an explicit rejection.
      assertDashboardProgressionGeneration(profileGeneration);
      if (currentState.status === 'error') throw currentState.error;
      pending = readArtifactDisclosureSnapshotResource();
    }
  }
}

// All dashboard registration consumers share this invalidation identity. The
// fingerprint is only a query key; durable milestones remain progression owned.
export function revalidateArtifactDisclosureForRegistrationPolicy(protectedDomains) {
  if (!Array.isArray(protectedDomains)
      || protectedDomains.some((domain) => typeof domain !== 'string' || !domain.trim())) {
    throw new Error('ARTIFACT_DISCLOSURE_REGISTRATION_POLICY_REQUIRED');
  }
  const fingerprint = JSON.stringify([...new Set(protectedDomains)].sort());
  if (registrationPolicyFingerprint === fingerprint) return readArtifactDisclosureSnapshotResource();
  registrationPolicyFingerprint = fingerprint;
  return refreshArtifactDisclosureSnapshotResourceAfterMutation();
}

export function resetArtifactDisclosureSnapshotResource() {
  readGeneration += 1;
  inFlightRead = null;
  registrationPolicyFingerprint = null;
  currentState = INITIAL_STATE;
  listeners.forEach((listener) => listener());
}
