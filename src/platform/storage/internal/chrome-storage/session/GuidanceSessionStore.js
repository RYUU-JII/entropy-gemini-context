import RuntimeSessionStore from '../stores/RuntimeSessionStore.js';
import { STORAGE_SESSION_KEYS } from '../storageKeyRegistry.js';
import { buildGuidanceSession, requireGuidanceSession } from '../../../../../domains/guidance/contracts/guidanceState.js';

export class GuidanceSessionStore {
  constructor({ sessionStore = RuntimeSessionStore.getInstance() } = {}) {
    this.sessionStore = sessionStore; this.key = STORAGE_SESSION_KEYS.GUIDANCE_PRESENTATION;
  }
  async read() {
    const record = await this.sessionStore.readOptional(this.key);
    if (record.found === false) return buildGuidanceSession();
    if (record.found !== true) throw new Error('GUIDANCE_SESSION_READ_INVALID');
    return requireGuidanceSession(record.value);
  }
  async write(state) {
    requireGuidanceSession(state); await this.sessionStore.set({ [this.key]: state }); return state;
  }
  clear() { return this.sessionStore.remove([this.key]); }
}
