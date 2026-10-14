import EventLogStore from '../internal/indexeddb/stores/EventLogStore.js';
import KeyMaterialRepository from '../security/KeyMaterialRepository.js';
import { requireSecurityVaultStatus } from '../../security/securityVaultStatusContract.js';
import ProfileResetLifecycleRepository, {
  resolveProfileResetGeneration,
} from '../runtime/ProfileResetLifecycleRepository.js';

export class EventLogRepository {
  constructor({
    eventLogStore = EventLogStore.getInstance(),
    profileLifecycleRepository = ProfileResetLifecycleRepository.getInstance(),
    keyMaterialRepository = KeyMaterialRepository.getInstance(),
  } = {}) {
    if (
      !profileLifecycleRepository
      || typeof profileLifecycleRepository.read !== 'function'
      || typeof profileLifecycleRepository.assertWriteAdmission !== 'function'
    ) {
      throw new Error('EVENT_LOG_PROFILE_LIFECYCLE_REPOSITORY_REQUIRED');
    }
    this.eventLogStore = eventLogStore;
    if (typeof keyMaterialRepository?.getVaultStatus !== 'function'
      || typeof keyMaterialRepository?.requireUnlocked !== 'function') {
      throw new Error('EVENT_LOG_KEY_MATERIAL_REPOSITORY_REQUIRED');
    }
    this.keyMaterialRepository = keyMaterialRepository;
    this.profileLifecycleRepository = profileLifecycleRepository;
    this.activeProfileGenerationPromise = profileLifecycleRepository.read()
      .then((lifecycle) => resolveProfileResetGeneration(lifecycle));
    void this.activeProfileGenerationPromise.catch(() => undefined);
    this.writeAdmissionOpen = true;
    this.operationTail = Promise.resolve();
    this.quiescePromise = null;
  }

  runAdmitted(operation) {
    if (!this.writeAdmissionOpen) {
      return Promise.reject(new Error('EVENT_LOG_REPOSITORY_WRITE_ADMISSION_CLOSED'));
    }
    const capturedGenerationPromise = this.activeProfileGenerationPromise;
    const pending = this.operationTail.then(async () => {
      if (!this.writeAdmissionOpen) {
        throw new Error('EVENT_LOG_REPOSITORY_WRITE_ADMISSION_CLOSED');
      }
      const expectedResetId = await capturedGenerationPromise;
      if (!this.writeAdmissionOpen) {
        throw new Error('EVENT_LOG_REPOSITORY_WRITE_ADMISSION_CLOSED');
      }
      await this.profileLifecycleRepository.assertWriteAdmission({ expectedResetId });
      if (!this.writeAdmissionOpen) {
        throw new Error('EVENT_LOG_REPOSITORY_WRITE_ADMISSION_CLOSED');
      }
      return operation();
    });
    this.operationTail = pending.then(
      () => undefined,
      () => undefined,
    );
    return pending;
  }

  static getInstance() {
    if (!EventLogRepository.instance) {
      EventLogRepository.instance = new EventLogRepository();
    }
    return EventLogRepository.instance;
  }

  append(logEntry) {
    return this.runAdmitted(async () => {
      const status = requireSecurityVaultStatus(await this.keyMaterialRepository.getVaultStatus());
      if (status.state === 'locked' && status.lockScope === 'logs') {
        return Object.freeze({ accepted: false, reason: 'data_locked' });
      }
      // Missing/incompatible keys are errors, never a successful policy skip.
      await this.keyMaterialRepository.requireUnlocked();
      await this.eventLogStore.append(logEntry);
      return Object.freeze({ accepted: true });
    });
  }

  flush() {
    return this.runAdmitted(() => this.eventLogStore.flush());
  }

  forceFlush() {
    return this.runAdmitted(() => this.eventLogStore.forceFlush());
  }

  pruneBefore(cutoffTs) {
    return this.runAdmitted(() => this.eventLogStore.pruneBefore(cutoffTs));
  }

  clear() {
    return this.runAdmitted(() => this.eventLogStore.clear());
  }

  quiesceForProfileMutation() {
    if (this.quiescePromise) return this.quiescePromise;
    this.writeAdmissionOpen = false;
    const storeQuiesce = this.eventLogStore.quiesceForProfileMutation();
    this.quiescePromise = Promise.all([
      this.activeProfileGenerationPromise.catch(() => undefined),
      this.operationTail,
      storeQuiesce,
    ]).then(() => Object.freeze({ quiesced: true }));
    return this.quiescePromise;
  }

  resetForProfileMutation() {
    if (this.writeAdmissionOpen) {
      return Promise.reject(new Error('EVENT_LOG_REPOSITORY_PROFILE_RESET_REQUIRES_QUIESCE'));
    }
    return this.eventLogStore.resetForProfileMutation();
  }

  getBufferedCount() {
    return this.eventLogStore.getBufferedCount();
  }
}

export default EventLogRepository;
