import RuntimeSessionRepository, { STORAGE_SESSION_KEYS } from './RuntimeSessionRepository.js';

// No RAM/local mirror. Absent means a new browser session; malformed presence
// is validated by the domain kernel and never reset by this repository.
export class InterventionAdmissionRepository {
  constructor({ sessionRepository = RuntimeSessionRepository.getInstance() } = {}) {
    this.sessionRepository = sessionRepository;
  }

  async read() {
    const result = await this.sessionRepository.readOptional(STORAGE_SESSION_KEYS.INTERVENTION_ADMISSION);
    return result;
  }

  write(state) {
    return this.sessionRepository.set({ [STORAGE_SESSION_KEYS.INTERVENTION_ADMISSION]: state });
  }
}
