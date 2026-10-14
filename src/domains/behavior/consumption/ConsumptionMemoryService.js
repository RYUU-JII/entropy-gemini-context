import { createConsumptionMemory, advanceConsumptionMemory, projectConsumptionMemory,
  createConsumptionPolicyEvidence, advanceConsumptionPolicyEvidence } from './consumptionMemoryModel.js';
import { requireInterventionExposureSnapshot } from '../../protection/background/runtime/interventionExposureWindow.js';
import { resolveConsumptionObservedIntervals } from './consumptionObservedIntervals.js';
import { CONSUMPTION_MEMORY_CHECKPOINT_KEY, requireConsumptionMemoryCheckpoint } from '../../../platform/storage/model/ConsumptionMemoryCheckpointContract.js';

// The Tracking ledger supplies serialization/quiescence. All I/O is on explicit
// observation/reset, never on a Gate decision read. No scheduler or retry timer.
export function createConsumptionMemoryService({ repository, captureAdmission, resolveProfileEpoch, beginExposureRecording, readExposureSnapshot }) {
  for (const fn of [repository?.read, repository?.commit, captureAdmission, resolveProfileEpoch, beginExposureRecording, readExposureSnapshot]) {
    if (typeof fn !== 'function') throw new Error('CONSUMPTION_MEMORY_OWNER_REQUIRED');
  }
  let committed = null, status = 'not_ready', failure = null, recordingInitialized = false;
  let committedAdmissionRevision = null;
  function admission() {
    const value = captureAdmission();
    if (!value || typeof value.enabled !== 'boolean' || typeof value.assertCommitAllowed !== 'function'
      || !Number.isSafeInteger(value.revision) || value.revision < 0
      || (value.enabled ? !Number.isSafeInteger(value.observedSince) || value.observedSince < 0
        : value.observedSince !== null)) throw new Error('CONSUMPTION_MEMORY_ADMISSION_INVALID');
    return value;
  }
  function recordFailure(error) {
    const cause = requireFailure(error);
    status = 'failed'; failure = cause.message;
    console.error('[consumption-memory] Observation unavailable:', cause);
    return { status, error: failure };
  }
  function requireFailure(cause) {
    return cause instanceof Error ? cause : new Error('CONSUMPTION_MEMORY_NON_ERROR_REJECTION', { cause });
  }
  async function initialize() {
    if (recordingInitialized) return;
    await beginExposureRecording();
    recordingInitialized = true;
  }
  async function observe(flow, now, token = admission()) {
    if (!token.enabled) { status = 'disabled'; failure = null; return { status }; }
    try {
      token.assertCommitAllowed();
      const profileEpoch = await resolveProfileEpoch();
      const [record, exposure] = await Promise.all([repository.read({ profileEpoch }), readExposureSnapshot({ now })]);
      token.assertCommitAllowed();
      if (!record || typeof record.profileEpoch !== 'string' || !Object.hasOwn(record, 'checkpoint')) throw new Error('CONSUMPTION_MEMORY_RESTORE_INVALID');
      const old = record.checkpoint;
      if (old !== null) requireConsumptionMemoryCheckpoint(old, { expectedProfileEpoch: record.profileEpoch });
      let model = old === null ? createConsumptionMemory({ epoch: record.profileEpoch, startedAt: now }) : old.model;
      // Missing current evidence capability is explicitly unbounded. It never
      // converts the already stored descriptive memory into a fresh zero.
      let policyEvidence = old !== null && Object.hasOwn(old, 'policyEvidence') ? old.policyEvidence
        : createConsumptionPolicyEvidence(model.throughAt, { knownZero: old === null });
      if (now < model.throughAt) throw new Error('CONSUMPTION_MEMORY_SOURCE_CLOCK_REGRESSED');
      requireInterventionExposureSnapshot(exposure);
      const settledAt = exposure.status === 'observed' ? exposure.settledThroughAt : now;
      const throughAt = Math.max(model.throughAt, Math.min(now, settledAt));
      const intervals = resolveConsumptionObservedIntervals({ startedAt: model.throughAt, endedAt: throughAt,
        admittedSince: token.observedSince, contexts: flow.contexts, media: flow.media, exposure });
      for (const interval of intervals) {
        policyEvidence = advanceConsumptionPolicyEvidence(policyEvidence, interval);
        model = advanceConsumptionMemory(model, { ...interval, epoch: model.epoch, sequence: model.sequence + 1 });
      }
      let next = old;
      if (old === null || model !== old.model || !Object.hasOwn(old, 'policyEvidence')) {
        next = await repository.commit({ expectedRevision: old === null ? null : old.stateRevision,
          checkpoint: { contract: CONSUMPTION_MEMORY_CHECKPOINT_KEY, profileEpoch: record.profileEpoch,
            stateRevision: old === null ? 0 : old.stateRevision + 1, model, policyEvidence },
          assertCommitAllowed: token.assertCommitAllowed });
      }
      committed = structuredClone(requireConsumptionMemoryCheckpoint(next));
      committedAdmissionRevision = token.revision;
      status = 'ready'; failure = null;
      return { status, throughAt: committed.model.throughAt };
    } catch (error) {
      const cause = requireFailure(error);
      status = 'failed'; failure = cause.message; throw cause;
    }
  }
  function getSnapshot(now) {
    const current = admission();
    if (!current.enabled) return { status: 'disabled', projection: null, error: null };
    if (status === 'disabled' || (status === 'ready' && current.revision !== committedAdmissionRevision)) {
      return { status: 'not_ready', projection: null, error: null };
    }
    if (status !== 'ready') return { status, projection: null, error: failure };
    if (now < committed.model.throughAt) return { status: 'ahead_of_query', projection: null, error: null };
    const projection = projectConsumptionMemory(committed.model, now);
    projection.policyEvidence = advanceConsumptionPolicyEvidence(committed.policyEvidence, {
      startedAt: committed.model.throughAt, endedAt: now, kind: 'unknown' });
    return { status: 'ready', projection, error: null };
  }
  async function reset(now, assertResetAllowed) {
    if (typeof assertResetAllowed !== 'function') throw new Error('CONSUMPTION_MEMORY_RESET_ADMISSION_REQUIRED');
    // Explicit analytics/runtime erasure. Keep an empty revision fence so an
    // already restored writer cannot resurrect the erased observations.
    const record = await repository.read({ profileEpoch: await resolveProfileEpoch() });
    if (record.checkpoint !== null) {
      await repository.commit({ expectedRevision: record.checkpoint.stateRevision,
        checkpoint: { contract: CONSUMPTION_MEMORY_CHECKPOINT_KEY, profileEpoch: record.profileEpoch,
          stateRevision: record.checkpoint.stateRevision + 1,
          model: createConsumptionMemory({ epoch: record.profileEpoch, startedAt: now }),
          policyEvidence: createConsumptionPolicyEvidence(now, { knownZero: true }) },
        assertCommitAllowed: assertResetAllowed });
    }
    discard();
  }
  function discard() { committed = null; committedAdmissionRevision = null; status = 'not_ready'; failure = null; }
  return { observe, getSnapshot, reset, discard, initialize, recordFailure, captureAdmission: admission };
}
