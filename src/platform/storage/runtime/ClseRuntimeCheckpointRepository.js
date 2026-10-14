import RuntimeSessionRepository, {
  STORAGE_SESSION_KEYS,
} from './RuntimeSessionRepository.js';
import {
  createClseRuntimeCheckpointRecord,
  toClseRuntimeCheckpointValue,
} from './clseRuntimeCheckpointContract.js';

export const CLSE_CHECKPOINT_SESSION_KEY = STORAGE_SESSION_KEYS.CLSE_CHECKPOINT;

export class ClseRuntimeCheckpointRepository {
  constructor({
    runtimeSessionRepository = RuntimeSessionRepository.getInstance(),
  } = {}) {
    this.runtimeSessionRepository = runtimeSessionRepository;
  }

  static getInstance() {
    if (!ClseRuntimeCheckpointRepository.instance) {
      ClseRuntimeCheckpointRepository.instance = new ClseRuntimeCheckpointRepository();
    }
    return ClseRuntimeCheckpointRepository.instance;
  }

  async readOptional() {
    const optional = await this.runtimeSessionRepository.readOptional(
      CLSE_CHECKPOINT_SESSION_KEY,
    );
    if (optional?.found !== true) {
      if (optional?.found === false) return { found: false, value: undefined };
      throw new Error('CLSE_CHECKPOINT_OPTIONAL_READ_INVALID');
    }
    return {
      found: true,
      value: toClseRuntimeCheckpointValue(optional.value),
    };
  }

  async set(value) {
    if (value === null || value === undefined) {
      throw new Error('CLSE_CHECKPOINT_VALUE_REQUIRED');
    }
    const nextRecord = createClseRuntimeCheckpointRecord(value);
    await this.runtimeSessionRepository.set({
      [CLSE_CHECKPOINT_SESSION_KEY]: nextRecord,
    });
    return toClseRuntimeCheckpointValue(nextRecord);
  }

  async clear() {
    await this.runtimeSessionRepository.remove([CLSE_CHECKPOINT_SESSION_KEY]);
  }
}

export default ClseRuntimeCheckpointRepository;
