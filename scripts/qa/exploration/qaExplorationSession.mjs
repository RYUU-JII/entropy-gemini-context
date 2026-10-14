import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { acquireBrowserBroker, inspectBrowserBroker } from '../../browser-qa/resources/BrowserBroker.mjs';
import { acquireBrowserCapacity } from '../../browser-qa/resources/BrowserCapacityLease.mjs';
import { resolveBrowserQaPhysicalResourceIdentities } from '../../browser-qa/resources/browserResourceScope.mjs';
import { normalizeBrowserQaCdpEndpoint } from '../../browser-qa/resources/browserResourceScope.mjs';
import { normalizeBrowserQaComparablePath } from '../../browser-qa/browser/attachedBrowserIdentity.mjs';
import { projectBrowserQaDedicatedProfileOwnership } from '../../browser-qa/lifecycle/persistentBrowserLifecycle.mjs';
import { verifyQaPersistentBrowserIdentity } from '../browser/qaPersistentBrowserLifecycle.mjs';
import { verifyEntropyQaDedicatedProfileOwnership } from '../profile/entropyQaProfileMarker.mjs';
import { readQaProcessStartToken } from '../recovery/QaRecoveryJournal.mjs';
import { readQaExplorationEnvironment } from './qaExplorationEnvironment.mjs';
import { readQaExplorationReadiness } from './qaExplorationReadiness.mjs';
import { readQaExplorationSession, requireQaExplorationDirectory, requireQaExplorationSessionId,
  writeQaExplorationJson } from './qaExplorationEvidence.mjs';

function throwIfAborted(signal) {
  if (signal.aborted) throw signal.reason || new Error('QA_EXPLORATION_ABORTED');
}

export function waitForQaExplorationEnd(signal) {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const end = () => {
      signal.removeEventListener('abort', end);
      resolve();
    };
    signal.addEventListener('abort', end, { once: true });
    if (signal.aborted) end();
  });
}

function projectIdentity(identity, profileSlot) {
  if (identity?.status !== 'declared_identity_verified'
    || identity.installationId !== profileSlot.installationId
    || identity.profileSlotId !== profileSlot.id
    || normalizeBrowserQaComparablePath(identity.executable) !== normalizeBrowserQaComparablePath(profileSlot.installation.executable)
    || normalizeBrowserQaComparablePath(identity.userDataDir) !== normalizeBrowserQaComparablePath(profileSlot.userDataDir)
    || identity.profileDirectory !== profileSlot.profileDirectory
    || normalizeBrowserQaCdpEndpoint(identity.cdpEndpoint) !== normalizeBrowserQaCdpEndpoint(profileSlot.cdpEndpoint)) {
    throw new Error('QA_EXPLORATION_BROWSER_IDENTITY_UNVERIFIED');
  }
  return Object.freeze({ status: identity.status, installationId: identity.installationId,
    profileSlotId: identity.profileSlotId, executable: identity.executable,
    userDataDir: identity.userDataDir, profileDirectory: identity.profileDirectory,
    cdpEndpoint: identity.cdpEndpoint, proof: identity.proof });
}

export async function runQaExplorationSession({ rootDir, signal, onReady = async () => {},
  environmentReader = readQaExplorationEnvironment, readinessReader = readQaExplorationReadiness,
  brokerFactory = acquireBrowserBroker, capacityFactory = acquireBrowserCapacity,
  dedicatedProfileVerifier = verifyEntropyQaDedicatedProfileOwnership,
  identityVerifier = verifyQaPersistentBrowserIdentity, waitForEnd = waitForQaExplorationEnd,
  processStartTokenReader = readQaProcessStartToken,
  now = () => new Date(), createSessionId = () => `explore-${randomUUID()}` } = {}) {
  if (!signal || typeof signal.addEventListener !== 'function') throw new Error('QA_EXPLORATION_CANCEL_SIGNAL_REQUIRED');
  throwIfAborted(signal);
  const environment = await environmentReader({ rootDir });
  const sessionId = requireQaExplorationSessionId(createSessionId());
  const ownerId = `exploration:${sessionId}`;
  const processStartToken = await processStartTokenReader(process.pid);
  if (typeof processStartToken !== 'string' || !/^(?:windows-filetime|linux-proc):\d+$/u.test(processStartToken)) {
    throw new Error('QA_EXPLORATION_RUNNER_START_IDENTITY_REQUIRED');
  }
  const explorationRoot = await requireQaExplorationDirectory(rootDir, ['.artifacts', 'qa', 'explorations'], { create: true });
  const sessionRoot = path.join(explorationRoot, sessionId);
  await fs.mkdir(sessionRoot);
  await fs.mkdir(path.join(sessionRoot, 'notes'));
  let session = { contractVersion: 1, kind: 'exploration_session', sessionId,
    namedQaVerdict: null, environmentId: environment.id, ownerId, pid: process.pid,
    runner: { pid: process.pid, processStartToken },
    startedAt: now().toISOString(), connectedUiIdentity: 'operator_verification_required',
    browserMutation: 'none', artifactMutation: 'none', liveBuildProved: false };
  const resources = [];
  let failure = null;
  // Keep idle ownership and the awaited reverse cleanup alive. Canonical lease
  // responders are unref'ed; there is no browser polling or test deadline.
  const keepAlive = setInterval(() => {}, 30_000);
  try {
    try {
      throwIfAborted(signal);
      const broker = await brokerFactory({ rootDir, environment, ownerId });
      resources.push({ id: 'browser_broker', lease: broker });
      throwIfAborted(signal);
      const profileSlot = environment.profileSlot;
      const browserResourceIdentities = resolveBrowserQaPhysicalResourceIdentities({
          cdpEndpoint: profileSlot.cdpEndpoint, userDataDir: profileSlot.userDataDir,
          profileDirectory: profileSlot.profileDirectory });
      const capacity = await capacityFactory({ rootDir, ownerId, browserResourceIdentities });
      resources.push({ id: 'browser_capacity', lease: capacity });
      if (!Array.isArray(capacity.owners) || capacity.owners.length !== browserResourceIdentities.length) {
        throw new Error('QA_EXPLORATION_CAPACITY_RECEIPT_REQUIRED');
      }
      const ownership = await dedicatedProfileVerifier({ profileSlot, action: 'inspect' });
      projectBrowserQaDedicatedProfileOwnership(profileSlot, ownership);
      throwIfAborted(signal);
      const identity = projectIdentity(await identityVerifier({ rootDir, profileSlot,
        ownerId: `${ownerId}:identity`, capacityLease: capacity }), profileSlot);
      const readiness = await readinessReader({ rootDir });
      throwIfAborted(signal);
      await broker.updateRuntime({ status: 'exploration_ready', profileSlotId: profileSlot.id,
        installationId: environment.installationId, identityStatus: identity.status,
        nextAction: 'connected_ui_exploration_then_ctrl_c' });
      const projectOwner = (owner) => ({ scope: owner.scope, leaseId: owner.leaseId,
        ownerId: owner.ownerId, pid: owner.pid });
      session = { ...session, status: 'READY', identity, readiness, leaseId: broker.owner.leaseId,
        resourceClaims: { broker: projectOwner(broker.owner), capacity: capacity.owners.map((owner, index) => ({
          ...projectOwner(owner), browserResourceIdentity: browserResourceIdentities[index] })) } };
      await writeQaExplorationJson(path.join(sessionRoot, 'session.json'), session, { exclusive: true });
      await onReady(Object.freeze({ ...session, sessionRoot }));
      await waitForEnd(signal);
      if (!signal.aborted) throw new Error('QA_EXPLORATION_CANCEL_SIGNAL_NOT_RECEIVED');
    } catch (error) {
      failure = error;
    }
    // Close admission before any asynchronous lease release. Notes verify the
    // live broker both before and after publication, so an in-flight writer must
    // discard its note when cancellation has moved this owner into cleanup.
    const brokerResource = resources.find((resource) => resource.id === 'browser_broker');
    if (brokerResource) {
      try {
        await brokerResource.lease.updateRuntime({ status: 'exploration_closing',
          installationId: environment.installationId, profileSlotId: environment.profileSlotId,
          nextAction: 'wait_for_exact_exploration_cleanup' });
      } catch (error) {
        failure = failure ? new AggregateError([failure, error], 'QA_EXPLORATION_ADMISSION_CLOSE_FAILED') : error;
      }
    }
    const cleanup = [];
    for (const resource of resources.reverse()) {
      try {
        const receipt = await resource.lease.release();
        cleanup.push({ id: resource.id, status: 'released', receipt });
      } catch (error) {
        cleanup.push({ id: resource.id, status: 'failed', error: error.message });
        failure = failure ? new AggregateError([failure, error], 'QA_EXPLORATION_CLEANUP_INCOMPLETE') : error;
      }
    }
    session = { ...session, status: failure ? 'FAILED' : 'CLOSED', finishedAt: now().toISOString(),
      cleanup, error: failure ? { message: failure.message, code: failure.code || null } : null };
    await writeQaExplorationJson(path.join(sessionRoot, 'session.json'), session);
    if (failure) {
      failure.explorationEvidence = path.join(sessionRoot, 'session.json');
      throw failure;
    }
    return Object.freeze({ ...session, sessionRoot });
  } finally {
    clearInterval(keepAlive);
  }
}

export function assertQaExplorationEnvironmentIdentity(session, environment) {
  if (session.identity?.profileSlotId !== environment.profileSlotId
    || session.identity?.installationId !== environment.installationId
    || normalizeBrowserQaComparablePath(session.identity?.executable) !== normalizeBrowserQaComparablePath(environment.chrome)
    || session.identity?.profileDirectory !== environment.profileDirectory
    || normalizeBrowserQaComparablePath(session.identity?.userDataDir) !== normalizeBrowserQaComparablePath(environment.profile)
    || normalizeBrowserQaCdpEndpoint(session.identity?.cdpEndpoint) !== normalizeBrowserQaCdpEndpoint(environment.cdpEndpoint)) {
    throw new Error('QA_EXPLORATION_SESSION_NOT_ACTIVE');
  }
}

async function requireActiveSessionOwner({ rootDir, session, environment, inspectBroker }) {
  if (session.status !== 'READY') throw new Error('QA_EXPLORATION_SESSION_NOT_ACTIVE');
  assertQaExplorationEnvironmentIdentity(session, environment);
  const owner = await inspectBroker({ rootDir, environment });
  if (!owner || owner.ownerId !== session.ownerId || owner.leaseId !== session.leaseId
    || owner.pid !== session.pid || owner.runtime?.status !== 'exploration_ready'
    || owner.runtime?.identityStatus !== session.identity.status
    || owner.runtime?.installationId !== session.identity.installationId
    || owner.runtime?.profileSlotId !== session.identity.profileSlotId) {
    throw new Error('QA_EXPLORATION_SESSION_OWNER_UNVERIFIED');
  }
}

export async function recordQaExplorationObservation({ rootDir, sessionId, actions, observation, uncertainty,
  environmentReader = readQaExplorationEnvironment, inspectBroker = inspectBrowserBroker,
  now = () => new Date() } = {}) {
  for (const [key, value] of Object.entries({ actions, observation, uncertainty })) {
    if (typeof value !== 'string' || !value.trim() || value.length > 4_000) {
      throw new Error(`QA_EXPLORATION_OBSERVATION_FIELD_INVALID:${key}`);
    }
  }
  const session = await readQaExplorationSession({ rootDir, sessionId });
  if (session.notes.length >= 256) throw new Error('QA_EXPLORATION_NOTE_LIMIT_EXCEEDED');
  const environment = await environmentReader({ rootDir });
  await requireActiveSessionOwner({ rootDir, session, environment, inspectBroker });
  const noteId = randomUUID();
  const evidencePath = path.join(session.sessionRoot, 'notes', `${noteId}.json`);
  const note = { contractVersion: 1, kind: 'exploration_observation', sessionId, noteId,
    at: now().toISOString(), namedQaVerdict: null, buildContext: session.readiness,
    leaseId: session.leaseId,
    liveBuildProved: false, actions, observation, uncertainty };
  await writeQaExplorationJson(evidencePath, note, { exclusive: true });
  try {
    await requireActiveSessionOwner({ rootDir, session, environment, inspectBroker });
  } catch (error) {
    await fs.unlink(evidencePath);
    throw error;
  }
  return Object.freeze({ ...note, evidencePath });
}
