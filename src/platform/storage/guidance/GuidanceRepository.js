import { GuidanceStateStore } from '../internal/chrome-storage/stores/GuidanceStateStore.js';
import { GuidanceSessionStore } from '../internal/chrome-storage/session/GuidanceSessionStore.js';

export class GuidanceRepository {
  constructor({ stateStore = new GuidanceStateStore(), sessionStore = new GuidanceSessionStore() } = {}) {
    this.stateStore = stateStore; this.sessionStore = sessionStore;
  }
  readState() { return this.stateStore.read(); }
  writeState(state) { return this.stateStore.write(state); }
  readSession() { return this.sessionStore.read(); }
  writeSession(state) { return this.sessionStore.write(state); }
  async clear() { await this.stateStore.clear(); await this.sessionStore.clear(); }
}
