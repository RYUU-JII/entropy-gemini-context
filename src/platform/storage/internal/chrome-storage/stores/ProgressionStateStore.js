import {
  normalizeProgressionState,
} from '../../../../../domains/progression/model/progressionSnapshot.js';
import {
  readChromeStorageLocal,
  removeChromeStorageLocal,
  writeChromeStorageLocal,
} from '../localArea.js';
import { STORAGE_LOCAL_STATE_KEYS } from '../storageKeyRegistry.js';
import { areValuesEqual } from '../../storageValueUtils.js';

export const PROGRESSION_STATE_STORAGE_KEY = STORAGE_LOCAL_STATE_KEYS.PROGRESSION_STATE;

export class ProgressionStateStore {
  static getInstance() {
    if (!ProgressionStateStore.instance) {
      ProgressionStateStore.instance = new ProgressionStateStore();
    }
    return ProgressionStateStore.instance;
  }

  constructor({
    readLocal = readChromeStorageLocal,
    writeLocal = writeChromeStorageLocal,
    removeLocal = removeChromeStorageLocal,
  } = {}) {
    this.storageKey = PROGRESSION_STATE_STORAGE_KEY;
    this.readLocal = readLocal;
    this.writeLocal = writeLocal;
    this.removeLocal = removeLocal;
  }

  async readState({ nowMs = Date.now() } = {}) {
    const items = await this.readLocal({
      [this.storageKey]: null,
    });
    const storedState = items?.[this.storageKey];
    // Absence has one stable, uncommitted baseline. A read's wall time must not
    // become an owner revision that a later first write can appear to precede.
    return normalizeProgressionState(storedState, { nowMs: storedState == null ? 0 : nowMs });
  }

  async writeState(state = null, { nowMs = Date.now() } = {}) {
    const normalized = normalizeProgressionState(state, { nowMs });
    const current = await this.readState({ nowMs });
    if (areValuesEqual(current, normalized)) {
      return current;
    }
    await this.writeLocal({
      [this.storageKey]: normalized,
    });
    return normalized;
  }

  async resetForProfileMutation(state, { nowMs = Date.now() } = {}) {
    if (state === null || typeof state === 'undefined') {
      throw new Error('PROGRESSION_PROFILE_MUTATION_REPLACEMENT_REQUIRED');
    }
    // The quiesced full-reset owner replaces discarded bytes without decoding them.
    const normalized = normalizeProgressionState(state, { nowMs });
    await this.writeLocal({
      [this.storageKey]: normalized,
    });
    return normalized;
  }

  async mutateState(mutator, { nowMs = Date.now() } = {}) {
    if (typeof mutator !== 'function') {
      throw new Error('PROGRESSION_STATE_MUTATOR_REQUIRED');
    }
    const current = await this.readState({ nowMs });
    const next = mutator(current);
    return this.writeState(next, { nowMs });
  }

  async clear() {
    await this.removeLocal([this.storageKey]);
    return null;
  }
}

export default ProgressionStateStore;
