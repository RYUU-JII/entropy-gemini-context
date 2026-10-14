import { yieldMainThreadContinuation } from './mainThreadCooperativeScheduler.js';

const MUTATION_BATCH_KEYS = Object.freeze([
  'addedNodes',
  'removedNodes',
  'textNodes',
  'attributeTargets',
  'mutations',
]);

function createPendingBatch() {
  return Object.fromEntries(MUTATION_BATCH_KEYS.map((key) => [key, new Set()]));
}

function hasPendingBatch(pending) {
  return MUTATION_BATCH_KEYS.some((key) => pending[key].size > 0);
}

export function createCooperativeMutationBatchQueue({
  isCurrent,
  consumeBatch,
  reportFailure,
  yieldContinuation = yieldMainThreadContinuation,
  now = () => performance.now(),
} = {}) {
  if (
    typeof isCurrent !== 'function'
    || typeof consumeBatch !== 'function'
    || typeof reportFailure !== 'function'
    || typeof yieldContinuation !== 'function'
    || typeof now !== 'function'
  ) {
    throw new Error('COOPERATIVE_MUTATION_QUEUE_COLLABORATOR_REQUIRED');
  }

  let pending = createPendingBatch();
  let latestFlushId = null;
  let generation = 0;
  let running = false;
  let firstQueuedAt = null;

  function clearPending() {
    pending = createPendingBatch();
    latestFlushId = null;
    firstQueuedAt = null;
  }

  function takeBatch() {
    const current = pending;
    const flushId = latestFlushId;
    const queuedAt = firstQueuedAt;
    const currentTime = Number(now());
    if (!Number.isFinite(currentTime)) {
      throw new Error('COOPERATIVE_MUTATION_QUEUE_CLOCK_INVALID');
    }
    clearPending();
    return Object.freeze({
      ...Object.fromEntries(
        MUTATION_BATCH_KEYS.map((key) => [key, Array.from(current[key])]),
      ),
      flushId,
      queueWaitMs: queuedAt === null ? 0 : Math.max(0, currentTime - queuedAt),
    });
  }

  async function drain(expectedGeneration) {
    let failed = false;
    try {
      while (
        generation === expectedGeneration
        && isCurrent()
        && hasPendingBatch(pending)
      ) {
        await yieldContinuation();
        if (generation !== expectedGeneration || !isCurrent()) return;
        const batch = takeBatch();
        await consumeBatch(batch, {
          isCurrent: () => generation === expectedGeneration && isCurrent(),
        });
      }
    } catch (error) {
      failed = true;
      clearPending();
      reportFailure(error);
    } finally {
      if (generation !== expectedGeneration) return;
      running = false;
      if (!failed && isCurrent() && hasPendingBatch(pending)) startDrain();
    }
  }

  function startDrain() {
    if (running || !isCurrent() || !hasPendingBatch(pending)) return false;
    running = true;
    const expectedGeneration = generation;
    void drain(expectedGeneration);
    return true;
  }

  function enqueue(payload = {}, { flushId = null } = {}) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new Error('COOPERATIVE_MUTATION_QUEUE_PAYLOAD_INVALID');
    }
    for (const key of MUTATION_BATCH_KEYS) {
      const values = payload[key];
      if (values === undefined) continue;
      if (!Array.isArray(values)) {
        throw new Error(`COOPERATIVE_MUTATION_QUEUE_PAYLOAD_INVALID:${key}`);
      }
    }
    const hasIncomingMutationIdentity = MUTATION_BATCH_KEYS.some(
      (key) => payload[key]?.some(Boolean) === true,
    );
    if (hasIncomingMutationIdentity && !hasPendingBatch(pending)) {
      const queuedAt = Number(now());
      if (!Number.isFinite(queuedAt)) {
        throw new Error('COOPERATIVE_MUTATION_QUEUE_CLOCK_INVALID');
      }
      firstQueuedAt = queuedAt;
    }
    for (const key of MUTATION_BATCH_KEYS) {
      const values = payload[key];
      if (values === undefined) continue;
      values.forEach((value) => {
        if (value) pending[key].add(value);
      });
    }
    if (flushId !== null) latestFlushId = flushId;
    return startDrain();
  }

  function cancel() {
    generation += 1;
    running = false;
    clearPending();
  }

  function getSnapshot() {
    return Object.freeze({
      generation,
      running,
      ...Object.fromEntries(
        MUTATION_BATCH_KEYS.map((key) => [`${key}Count`, pending[key].size]),
      ),
    });
  }

  return Object.freeze({ cancel, enqueue, getSnapshot });
}
