import { buildGuidanceState, requireGuidanceState } from '../../../../../domains/guidance/contracts/guidanceState.js';
import { readChromeStorageLocal, writeChromeStorageLocal, removeChromeStorageLocal } from '../localArea.js';
import { STORAGE_LOCAL_STATE_KEYS } from '../storageKeyRegistry.js';

export class GuidanceStateStore {
  constructor({ readLocal = readChromeStorageLocal, writeLocal = writeChromeStorageLocal, removeLocal = removeChromeStorageLocal } = {}) {
    this.readLocal = readLocal; this.writeLocal = writeLocal; this.removeLocal = removeLocal;
    this.key = STORAGE_LOCAL_STATE_KEYS.GUIDANCE_STATE;
  }
  async read() {
    const items = await this.readLocal([this.key]);
    if (!items || typeof items !== 'object') throw new Error('GUIDANCE_STORAGE_READ_INVALID');
    if (!Object.hasOwn(items, this.key)) {
      const initial = buildGuidanceState();
      await this.write(initial);
      return initial;
    }
    return requireGuidanceState(items[this.key]);
  }
  async write(state) {
    requireGuidanceState(state);
    await this.writeLocal({ [this.key]: state });
    return state;
  }
  clear() { return this.removeLocal([this.key]); }
}
