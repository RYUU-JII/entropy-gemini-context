import NudgeSessionStore from '../internal/chrome-storage/session/NudgeSessionStore.js';

export class NudgeSessionRepository {
  constructor({ nudgeSessionStore = NudgeSessionStore.getInstance() } = {}) {
    this.nudgeSessionStore = nudgeSessionStore;
  }

  static getInstance() {
    if (!NudgeSessionRepository.instance) {
      NudgeSessionRepository.instance = new NudgeSessionRepository();
    }
    return NudgeSessionRepository.instance;
  }

  get(defaults = {}) {
    return this.nudgeSessionStore.get(defaults);
  }

  set(items = {}) {
    return this.nudgeSessionStore.set(items);
  }

  remove(keys) {
    return this.nudgeSessionStore.remove(keys);
  }
}

export default NudgeSessionRepository;
