import RuntimeSessionRepository, {
  STORAGE_SESSION_KEYS,
} from './RuntimeSessionRepository.js';

export const HISTORY_CLEANUP_ACTIVATION_SESSION_KEY = (
  STORAGE_SESSION_KEYS.HISTORY_CLEANUP_ACTIVATION
);
export const HISTORY_CLEANUP_ACTIVATION_CHECKPOINT_VERSION = 1;

function createCompletedCheckpoint() {
  return Object.freeze({
    schemaVersion: HISTORY_CLEANUP_ACTIVATION_CHECKPOINT_VERSION,
    state: 'completed',
  });
}

function parseCompletedCheckpoint(value) {
  if (
    !value
    || typeof value !== 'object'
    || Array.isArray(value)
    || value.schemaVersion !== HISTORY_CLEANUP_ACTIVATION_CHECKPOINT_VERSION
    || value.state !== 'completed'
  ) {
    throw new Error('HISTORY_CLEANUP_ACTIVATION_CHECKPOINT_INVALID');
  }
  return createCompletedCheckpoint();
}

export class HistoryCleanupActivationCheckpointRepository {
  constructor({
    runtimeSessionRepository = RuntimeSessionRepository.getInstance(),
  } = {}) {
    this.runtimeSessionRepository = runtimeSessionRepository;
  }

  async readOptional() {
    const optional = await this.runtimeSessionRepository.readOptional(
      HISTORY_CLEANUP_ACTIVATION_SESSION_KEY,
    );
    if (optional?.found === false) {
      return { found: false, value: undefined };
    }
    if (optional?.found !== true) {
      throw new Error('HISTORY_CLEANUP_ACTIVATION_CHECKPOINT_READ_INVALID');
    }
    return {
      found: true,
      value: parseCompletedCheckpoint(optional.value),
    };
  }

  async markCompleted() {
    const checkpoint = createCompletedCheckpoint();
    await this.runtimeSessionRepository.set({
      [HISTORY_CLEANUP_ACTIVATION_SESSION_KEY]: checkpoint,
    });
    return checkpoint;
  }

  async clear() {
    await this.runtimeSessionRepository.remove([
      HISTORY_CLEANUP_ACTIVATION_SESSION_KEY,
    ]);
  }
}

export default HistoryCleanupActivationCheckpointRepository;
