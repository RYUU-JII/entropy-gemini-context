import { readChromeStorageLocal, writeChromeStorageLocal, removeChromeStorageLocal } from '../localArea.js';
import { STORAGE_LOCAL_STATE_KEYS } from '../storageKeyRegistry.js';

const KEY = STORAGE_LOCAL_STATE_KEYS.GATE_PRUNING_PRESENTATION;
const COMPLETED = Object.freeze({ version: 1, completed: true });

export class GatePruningPresentationStore {
  constructor({ readLocal = readChromeStorageLocal, writeLocal = writeChromeStorageLocal,
    removeLocal = removeChromeStorageLocal } = {}) {
    this.readLocal = readLocal;
    this.writeLocal = writeLocal;
    this.removeLocal = removeLocal;
  }

  async readCompleted() {
    const items = await this.readLocal({ [KEY]: null });
    if (!items || typeof items !== 'object' || Array.isArray(items) || !Object.hasOwn(items, KEY)) {
      throw new Error('GATE_PRUNING_PRESENTATION_READ_INVALID');
    }
    const value = items[KEY];
    // An absent receipt explicitly means no successful pruning is recorded.
    if (value === null) return false;
    if (typeof value !== 'object' || Array.isArray(value) || value.version !== 1
      || value.completed !== true || Object.keys(value).length !== 2) {
      throw new Error('GATE_PRUNING_PRESENTATION_RECORD_INVALID');
    }
    return true;
  }

  async markCompleted() {
    // Monotonic and idempotent: concurrent gates write the same small receipt.
    await this.writeLocal({ [KEY]: COMPLETED });
  }

  clear() { return this.removeLocal([KEY]); }
}
