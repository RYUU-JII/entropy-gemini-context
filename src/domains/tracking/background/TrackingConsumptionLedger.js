import {
  createEmptyConsumptionFlowState,
  projectConsumptionFlow,
  reduceConsumptionSegment,
  requireConsumptionFlowState,
  requireConsumptionSegment,
} from './trackingConsumptionFlowState.js';
import { requireConsumptionEnvironment } from './trackingConsumptionEnvironment.js';
import { createConsumptionMediaWindow } from './trackingConsumptionMediaWindow.js';

export function createTrackingConsumptionLedger({ repository, profileMutationAdmissionOwner } = {}) {
  if (!repository || typeof repository.read !== 'function' || typeof repository.write !== 'function') {
    throw new Error('TRACKING_CONSUMPTION_REPOSITORY_REQUIRED');
  }
  if (!profileMutationAdmissionOwner || typeof profileMutationAdmissionOwner.assertOpen !== 'function') {
    throw new Error('TRACKING_CONSUMPTION_PROFILE_ADMISSION_REQUIRED');
  }
  let state = null;
  // A tab/audio point is useful only in this worker lifetime. Rehydrating an
  // old point as current browser state would invent observation after restart.
  let environment = null;
  const media = createConsumptionMediaWindow();
  let tail = Promise.resolve();
  // One derived writer, owned/drained here, without holding the source fact lane.
  let postFactTail = Promise.resolve();
  let running = false, pending = null, resetting = false;
  function enqueue(task) {
    const operation = tail.then(task, task);
    tail = operation.catch(() => undefined);
    return operation;
  }

  async function loadOwned() {
    if (state !== null) return;
    const result = await repository.read();
    if (!result || typeof result.found !== 'boolean') throw new Error('TRACKING_CONSUMPTION_READ_INVALID');
    state = result.found
      ? structuredClone(requireConsumptionFlowState(result.value))
      : createEmptyConsumptionFlowState();
  }

  function recordForegroundSegment(segment) {
    profileMutationAdmissionOwner.assertOpen();
    const input = structuredClone(requireConsumptionSegment(segment));
    return enqueue(async () => {
      await loadOwned();
      const result = reduceConsumptionSegment(state, input);
      if (result.changed) {
        await repository.write(result.state);
        state = result.state;
      }
      return { applied: result.changed, reason: result.reason };
    });
  }

  function getSnapshot({ now = Date.now() } = {}) {
    profileMutationAdmissionOwner.assertOpen();
    return enqueue(async () => {
      await loadOwned();
      return { ...projectConsumptionFlow(state, now), environment: environment === null ? null : { ...environment }, media: media.snapshot() };
    });
  }

  function recordEnvironmentSnapshot(snapshot, continuity = null) {
    profileMutationAdmissionOwner.assertOpen();
    const input = { ...requireConsumptionEnvironment(snapshot) };
    return enqueue(() => {
      if (environment && input.observedAt < environment.observedAt) return { applied: false, reason: 'stale' };
      if (environment && input.observedAt === environment.observedAt) {
        if (Object.keys(input).some((key) => input[key] !== environment[key])) {
          throw new Error('TRACKING_CONSUMPTION_ENVIRONMENT_CONFLICT');
        }
        return { applied: false, reason: 'replay' };
      }
      if (continuity === null) media.invalidate();
      else media.observe(input, continuity.receipt, continuity.settingsVersion);
      environment = input;
      return { applied: true, reason: 'observed' };
    });
  }

  function runAfterFacts(now, task) {
    profileMutationAdmissionOwner.assertOpen();
    if (typeof task !== 'function') throw new Error('TRACKING_CONSUMPTION_COMMIT_OWNER_REQUIRED');
    if (resetting) return Promise.reject(new Error('TRACKING_CONSUMPTION_RESET_IN_PROGRESS'));
    const operation = new Promise((resolve, reject) => {
      if (pending !== null) pending.resolve({ status: 'coalesced', supersededAt: now });
      pending = { now, task, resolve, reject };
    });
    if (!running) {
      running = true;
      postFactTail = pump();
    }
    return operation;
  }

  async function pump() {
    while (pending !== null) {
      const job = pending;
      pending = null;
      try {
        // Capture only when executing: even source I/O stalls cannot accumulate
        // an unbounded chain of cloned snapshots. Later facts are query-clipped.
        const flow = await enqueue(async () => {
          await loadOwned();
          return { ...projectConsumptionFlow(state, job.now), contexts: structuredClone(state.contexts), media: media.snapshot() };
        });
        job.resolve(await job.task(flow));
      } catch (error) { job.reject(error); }
    }
    running = false;
  }

  function resetAfterFacts(task) {
    profileMutationAdmissionOwner.assertOpen();
    if (typeof task !== 'function') throw new Error('TRACKING_CONSUMPTION_COMMIT_OWNER_REQUIRED');
    if (resetting) return Promise.reject(new Error('TRACKING_CONSUMPTION_RESET_IN_PROGRESS'));
    resetting = true;
    // Erasure is a barrier, never a replaceable observation. Its caller owns
    // source erasure after this revision-fenced model reset completes.
    const operation = Promise.all([tail, postFactTail]).then(task);
    postFactTail = operation.then(() => { resetting = false; }, () => { resetting = false; });
    return operation;
  }

  function closeForegroundContext({ tabId, hostname, at }) {
    profileMutationAdmissionOwner.assertOpen();
    if (!Number.isSafeInteger(at) || at < 0 || !Number.isSafeInteger(tabId) || tabId < 0
      || typeof hostname !== 'string' || !hostname) throw new Error('TRACKING_CONSUMPTION_CLOSE_INVALID');
    return enqueue(async () => {
      await loadOwned();
      const last = state.lastSegment;
      if (!last || last.tabId !== tabId || last.hostname !== hostname || last.endedAt !== at || last.closed) {
        return { applied: false, reason: 'no_matching_open_receipt' };
      }
      const result = reduceConsumptionSegment(state, { ...last, closed: true });
      await repository.write(result.state);
      state = result.state;
      return { applied: true, reason: 'closed' };
    });
  }

  async function drainForProfileMutation() {
    profileMutationAdmissionOwner.assertDrainingOrQuiesced();
    await Promise.all([tail, postFactTail]);
  }

  function resetState() {
    profileMutationAdmissionOwner.assertOpen();
    return enqueue(async () => {
      const empty = createEmptyConsumptionFlowState();
      await repository.write(empty);
      state = empty;
      environment = null;
      media.reset();
    });
  }

  async function resetForTerminalProfileMutation() {
    profileMutationAdmissionOwner.assertQuiesced();
    await drainForProfileMutation();
    // The profile transaction owns deletion of session storage. Do not recreate
    // a key after its reset/import barrier has drained this writer.
    state = null;
    environment = null;
    media.reset();
  }

  return { recordForegroundSegment, recordEnvironmentSnapshot, closeForegroundContext, getSnapshot, resetState, drainForProfileMutation, resetForTerminalProfileMutation,
    runAfterFacts, resetAfterFacts, captureMediaObservation: media.capture, invalidateMediaObservation: media.invalidate };
}
