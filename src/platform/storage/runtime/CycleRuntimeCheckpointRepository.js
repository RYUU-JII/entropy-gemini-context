import RuntimeSessionRepository, {
  STORAGE_SESSION_KEYS,
} from './RuntimeSessionRepository.js';
import {
  createCycleCheckpointRecord,
  toCycleCheckpointValue,
} from './cycleStateStorageContracts.js';

export const CYCLE_CHECKPOINT_SESSION_KEY = STORAGE_SESSION_KEYS.CYCLE_CHECKPOINT;

export class CycleRuntimeCheckpointRepository {
  constructor({
    runtimeSessionRepository = RuntimeSessionRepository.getInstance(),
  } = {}) {
    this.runtimeSessionRepository = runtimeSessionRepository;
  }

  static getInstance() {
    if (!CycleRuntimeCheckpointRepository.instance) {
      CycleRuntimeCheckpointRepository.instance = new CycleRuntimeCheckpointRepository();
    }
    return CycleRuntimeCheckpointRepository.instance;
  }

  async readOptional() {
    const optional = await this.runtimeSessionRepository.readOptional(
      CYCLE_CHECKPOINT_SESSION_KEY,
    );
    if (optional?.found !== true) {
      if (optional?.found === false) return { found: false, value: undefined };
      throw new Error('CYCLE_CHECKPOINT_OPTIONAL_READ_INVALID');
    }
    return {
      found: true,
      value: toCycleCheckpointValue(optional.value),
    };
  }

  async get(fallback = null) {
    const optional = await this.readOptional();
    return optional.found ? optional.value : fallback;
  }

  async set(value) {
    if (value === null || value === undefined) {
      await this.runtimeSessionRepository.remove([CYCLE_CHECKPOINT_SESSION_KEY]);
      return null;
    }
    const nextRecord = createCycleCheckpointRecord(value);
    await this.runtimeSessionRepository.set({
      [CYCLE_CHECKPOINT_SESSION_KEY]: nextRecord,
    });
    return toCycleCheckpointValue(nextRecord);
  }

  async clear() {
    await this.runtimeSessionRepository.remove([CYCLE_CHECKPOINT_SESSION_KEY]);
  }
}

export default CycleRuntimeCheckpointRepository;
