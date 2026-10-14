import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { acquireBrowserBroker, inspectBrowserBroker, resolveBrowserBrokerEndpoint } from '../../browser-qa/resources/BrowserBroker.mjs';
import { acquireBrowserCapacity, inspectBrowserCapacity, resolveBrowserCapacityEndpoint } from '../../browser-qa/resources/BrowserCapacityLease.mjs';
import { resolveBrowserQaPhysicalResourceIdentities } from '../../browser-qa/resources/browserResourceScope.mjs';
import { inspectQaRunnerIdentity } from '../recovery/QaRecoveryJournal.mjs';
import { readQaExplorationEnvironment } from './qaExplorationEnvironment.mjs';
import { assertQaExplorationEnvironmentIdentity } from './qaExplorationSession.mjs';
import { readQaExplorationJson, readQaExplorationSession, publishQaExplorationJson } from './qaExplorationEvidence.mjs';

function sourceSessionDigest(session) {
  const { notes, sessionRoot, ...record } = session;
  return createHash('sha256').update(JSON.stringify(record)).digest('hex');
}

function requireRunnerProof(session) {
  if (session.runner?.pid !== session.pid || typeof session.runner.processStartToken !== 'string'
    || !/^(?:windows-filetime|linux-proc):\d+$/u.test(session.runner.processStartToken)) {
    throw new Error('QA_EXPLORATION_RUNNER_START_IDENTITY_REQUIRED');
  }
}

function requireExactResourceClaims({ rootDir, session, environment }) {
  assertQaExplorationEnvironmentIdentity(session, environment);
  const identities = resolveBrowserQaPhysicalResourceIdentities({ cdpEndpoint: environment.cdpEndpoint,
    userDataDir: environment.profile, profileDirectory: environment.profileDirectory });
  const validOwner = (owner, scope) => owner?.scope === scope && owner.ownerId === session.ownerId
    && owner.pid === session.pid && typeof owner.leaseId === 'string' && /^[a-f0-9-]{36}$/u.test(owner.leaseId);
  const broker = session.resourceClaims?.broker;
  const capacity = session.resourceClaims?.capacity;
  if (!validOwner(broker, resolveBrowserBrokerEndpoint({ rootDir, environment }).scope)
    || broker.leaseId !== session.leaseId || !Array.isArray(capacity) || capacity.length !== identities.length
    || capacity.some((owner, index) => owner.browserResourceIdentity !== identities[index]
      || !validOwner(owner, resolveBrowserCapacityEndpoint(rootDir, { browserResourceIdentity: identities[index] }).scope))) {
    throw new Error('QA_EXPLORATION_RESOURCE_CLAIMS_UNVERIFIED');
  }
  return identities;
}

function ownerMatches(observed, expected) {
  return observed?.ownerId === expected.ownerId && observed?.leaseId === expected.leaseId
    && observed?.pid === expected.pid && observed?.scope === expected.scope;
}

function requireRecoveryVerification(session, verification) {
  const broker = verification?.broker;
  const capacity = verification?.capacity;
  const claims = session.resourceClaims;
  const validLease = (owner) => typeof owner?.leaseId === 'string' && /^[a-f0-9-]{36}$/u.test(owner.leaseId);
  if (verification?.proof !== 'canonical_exclusive_acquisition'
    || typeof broker?.ownerId !== 'string' || !/^exploration-recovery:[a-f0-9-]{36}$/u.test(broker.ownerId)
    || !Number.isSafeInteger(broker.pid) || broker.pid < 1 || !validLease(broker)
    || broker.scope !== claims?.broker?.scope || !Array.isArray(capacity)
    || !Array.isArray(claims?.capacity) || capacity.length !== claims.capacity.length
    || !Array.isArray(verification.browserResourceIdentities)
    || verification.browserResourceIdentities.length !== capacity.length
    || capacity.some((owner, index) => !validLease(owner) || owner.scope !== claims.capacity[index].scope
      || owner.ownerId !== broker.ownerId || owner.pid !== broker.pid
      || verification.browserResourceIdentities[index] !== claims.capacity[index].browserResourceIdentity)) {
    throw new Error('QA_EXPLORATION_RECOVERY_RESOURCE_VERIFICATION_INVALID');
  }
}

async function readRecoveryReceipt(session) {
  const evidencePath = path.join(session.sessionRoot, 'recovery.json');
  let receipt;
  try {
    receipt = await readQaExplorationJson(evidencePath);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
  if (receipt?.contractVersion !== 1 || receipt.kind !== 'exploration_recovery'
    || receipt.sessionId !== session.sessionId || receipt.status !== 'RECOVERED'
    || session.status !== 'READY' || receipt.recordedStatus !== session.status
    || receipt.sourceSessionDigest !== sourceSessionDigest(session)
    || receipt.namedQaVerdict !== null || receipt.browserAction !== 'preserved'
    || receipt.targetAction !== 'preserved' || receipt.originalEvidenceAction !== 'preserved'
    || receipt.liveBuildProved !== false || !Number.isFinite(Date.parse(receipt.recoveredAt))
    || receipt.runner?.status !== 'absent'
    || !['pid_absent', 'pid_reused_with_different_start_token'].includes(receipt.runner.proof)
    || !Array.isArray(receipt.cleanup) || receipt.cleanup.length !== 2
    || receipt.cleanup[0]?.id !== 'browser_capacity' || receipt.cleanup[1]?.id !== 'browser_broker'
    || receipt.cleanup.some((item) => item.status !== 'released')) {
    throw new Error('QA_EXPLORATION_RECOVERY_RECEIPT_INVALID');
  }
  requireRunnerProof(session);
  requireRecoveryVerification(session, receipt.resourceVerification);
  return Object.freeze({ ...receipt, evidencePath });
}

export async function inspectQaExplorationSession({ rootDir, sessionId,
  environmentReader = readQaExplorationEnvironment, runnerInspector = inspectQaRunnerIdentity,
  brokerInspector = inspectBrowserBroker, capacityInspector = inspectBrowserCapacity } = {}) {
  const session = await readQaExplorationSession({ rootDir, sessionId });
  const recovery = await readRecoveryReceipt(session);
  const base = { ...session, recordedStatus: session.status, recovery };
  if (recovery) return Object.freeze({ ...base, currentStatus: 'RECOVERED', recoveryAction: 'already_recorded' });
  if (session.status !== 'READY') return Object.freeze({ ...base, currentStatus: session.status, recoveryAction: 'none' });
  try {
    requireRunnerProof(session);
    const environment = await environmentReader({ rootDir });
    const identities = requireExactResourceClaims({ rootDir, session, environment });
    const runner = await runnerInspector(session.runner);
    const [broker, capacity] = await Promise.all([
      brokerInspector({ rootDir, environment }),
      Promise.all(identities.map((identity) => capacityInspector(rootDir, { browserResourceIdentity: identity }))),
    ]);
    const resources = { broker, capacity, absentResourcesProved: false };
    const foreignOwner = (broker !== null && !ownerMatches(broker, session.resourceClaims.broker))
      || capacity.some((owner, index) => owner !== null && !ownerMatches(owner, session.resourceClaims.capacity[index]));
    if (runner.status === 'absent' && ['pid_absent', 'pid_reused_with_different_start_token'].includes(runner.proof)) {
      return Object.freeze({ ...base, currentStatus: 'ABANDONED', runner, resources,
        recoveryAction: foreignOwner ? 'blocked_by_current_owner' : 'explicit_verification_required' });
    }
    const active = runner.status === 'active' && runner.proof === 'pid_and_start_token_match'
      && ownerMatches(broker, session.resourceClaims.broker)
      && ['exploration_ready', 'exploration_closing'].includes(broker.runtime?.status)
      && broker.runtime?.installationId === session.identity.installationId
      && broker.runtime?.profileSlotId === session.identity.profileSlotId
      && capacity.every((owner, index) => ownerMatches(owner, session.resourceClaims.capacity[index]));
    return Object.freeze({ ...base, currentStatus: active ? 'ACTIVE' : 'UNVERIFIED', runner, resources,
      recoveryAction: active ? 'runner_still_active' : 'ownership_unverified' });
  } catch (error) {
    return Object.freeze({ ...base, currentStatus: 'UNVERIFIED', recoveryAction: 'ownership_unverified',
      diagnostic: { code: error.code || null, message: error.message } });
  }
}

async function requireAbsentRunner(session, runnerInspector) {
  const runner = await runnerInspector(session.runner);
  if (runner.status !== 'absent' || !['pid_absent', 'pid_reused_with_different_start_token'].includes(runner.proof)) {
    throw new Error('QA_EXPLORATION_RECOVERY_RUNNER_NOT_PROVED_ABSENT');
  }
  return runner;
}

// Broker/capacity are process-held reservations. Successful canonical exclusive
// acquisition proves that neither an old owner nor a foreign successor holds
// these exact resources. Null observation snapshots alone never grant recovery.
export async function recoverQaExplorationSession({ rootDir, sessionId,
  environmentReader = readQaExplorationEnvironment, runnerInspector = inspectQaRunnerIdentity,
  brokerFactory = acquireBrowserBroker, capacityFactory = acquireBrowserCapacity,
  now = () => new Date() } = {}) {
  const session = await readQaExplorationSession({ rootDir, sessionId });
  const existing = await readRecoveryReceipt(session);
  if (existing) return Object.freeze({ ...existing, recoveryAction: 'already_recorded' });
  if (session.status !== 'READY') throw new Error('QA_EXPLORATION_RECOVERY_READY_SESSION_REQUIRED');
  requireRunnerProof(session);
  const environment = await environmentReader({ rootDir });
  const identities = requireExactResourceClaims({ rootDir, session, environment });
  await requireAbsentRunner(session, runnerInspector);
  const ownerId = `exploration-recovery:${randomUUID()}`;
  const leases = [];
  const cleanup = [];
  const keepAlive = setInterval(() => {}, 30_000);
  let failure = null;
  let runner;
  let verification;
  try {
    try {
      const broker = await brokerFactory({ rootDir, environment, ownerId });
      leases.push({ id: 'browser_broker', lease: broker });
      const capacity = await capacityFactory({ rootDir, ownerId, browserResourceIdentities: identities });
      leases.push({ id: 'browser_capacity', lease: capacity });
      runner = await requireAbsentRunner(session, runnerInspector);
      verification = { proof: 'canonical_exclusive_acquisition', broker: broker.owner,
        capacity: capacity.owners, browserResourceIdentities: identities };
      requireRecoveryVerification(session, verification);
    } catch (error) {
      failure = error;
    }
    for (const { id, lease } of leases.reverse()) {
      try {
        cleanup.push({ id, status: 'released', receipt: await lease.release() });
      } catch (error) {
        cleanup.push({ id, status: 'failed', message: error.message });
        failure = failure ? new AggregateError([failure, error], 'QA_EXPLORATION_RECOVERY_CLEANUP_INCOMPLETE') : error;
      }
    }
    if (failure) throw failure;
    const receipt = { contractVersion: 1, kind: 'exploration_recovery', sessionId, status: 'RECOVERED',
      recordedStatus: session.status, sourceSessionDigest: sourceSessionDigest(session),
      recoveredAt: now().toISOString(), namedQaVerdict: null, liveBuildProved: false,
      runner, resourceVerification: verification, cleanup, browserAction: 'preserved',
      targetAction: 'preserved', originalEvidenceAction: 'preserved' };
    const evidencePath = path.join(session.sessionRoot, 'recovery.json');
    try {
      await publishQaExplorationJson(evidencePath, receipt);
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const concurrent = await readRecoveryReceipt(session);
      if (!concurrent) throw new Error('QA_EXPLORATION_RECOVERY_RECEIPT_NOT_PUBLISHED');
      return Object.freeze({ ...concurrent, recoveryAction: 'already_recorded' });
    }
    return Object.freeze({ ...receipt, evidencePath, recoveryAction: 'recorded' });
  } finally {
    clearInterval(keepAlive);
  }
}
