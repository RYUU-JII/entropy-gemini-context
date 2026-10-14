import RuntimeSessionRepository, { STORAGE_SESSION_KEYS } from './RuntimeSessionRepository.js';

export function requireTabEvaporationCheckpoint(value) {
  if (!value || value.version !== 1 || typeof value.policyKey !== 'string'
    || !value.policyKey || !Array.isArray(value.tabs)) {
    throw new Error('TAB_EVAPORATION_CHECKPOINT_INVALID');
  }
  const ids = new Set();
  for (const tab of value.tabs) {
    if (!tab || !Number.isSafeInteger(tab.tabId) || tab.tabId < 0 || ids.has(tab.tabId)
      || typeof tab.url !== 'string' || !/^https?:\/\//.test(tab.url)
      || !Number.isFinite(tab.lastAccessed) || tab.lastAccessed <= 0
      || !Number.isSafeInteger(tab.inactiveSince) || tab.inactiveSince < tab.lastAccessed) {
      throw new Error('TAB_EVAPORATION_CHECKPOINT_TAB_INVALID');
    }
    ids.add(tab.tabId);
  }
  return value;
}

/** Observed inactivity only. This checkpoint never authorizes a tab removal. */
export class TabEvaporationCheckpointRepository {
  constructor({ sessionRepository = RuntimeSessionRepository.getInstance() } = {}) {
    this.sessionRepository = sessionRepository;
  }
  async read() {
    const result = await this.sessionRepository.readOptional(STORAGE_SESSION_KEYS.TAB_EVAPORATION);
    if (result?.found === false) return null;
    if (result?.found !== true) throw new Error('TAB_EVAPORATION_CHECKPOINT_READ_INVALID');
    return requireTabEvaporationCheckpoint(result.value);
  }
  write(value) {
    return this.sessionRepository.set({
      [STORAGE_SESSION_KEYS.TAB_EVAPORATION]: requireTabEvaporationCheckpoint(value),
    });
  }
  clear() { return this.sessionRepository.remove(STORAGE_SESSION_KEYS.TAB_EVAPORATION); }
}
