import { STORAGE_SESSION_KEYS } from './RuntimeSessionRepository.js';

export class TrackingConsumptionRepository {
  constructor({ sessionRepository } = {}) {
    if (!sessionRepository || typeof sessionRepository.readOptional !== 'function'
      || typeof sessionRepository.set !== 'function') {
      throw new Error('TRACKING_CONSUMPTION_REPOSITORY_REQUIRED');
    }
    this.sessionRepository = sessionRepository;
  }

  read() {
    return this.sessionRepository.readOptional(STORAGE_SESSION_KEYS.CONSUMPTION_FLOW);
  }

  write(state) {
    return this.sessionRepository.set({ [STORAGE_SESSION_KEYS.CONSUMPTION_FLOW]: state });
  }
}
