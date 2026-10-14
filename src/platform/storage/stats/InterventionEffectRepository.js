import InterventionEffectStore from '../internal/indexeddb/stores/InterventionEffectStore.js';

export class InterventionEffectRepository {
  constructor({ interventionEffectStore = InterventionEffectStore.getInstance() } = {}) {
    this.interventionEffectStore = interventionEffectStore;
  }

  static getInstance() {
    if (!InterventionEffectRepository.instance) {
      InterventionEffectRepository.instance = new InterventionEffectRepository();
    }
    return InterventionEffectRepository.instance;
  }

  recordExposure(row = {}) {
    return this.interventionEffectStore.recordExposure(row);
  }

  recordOutcome(row = {}) {
    return this.interventionEffectStore.recordOutcome(row);
  }

  getExposure(exposureId) {
    return this.interventionEffectStore.getExposure(exposureId);
  }

  getEffectsRange(options = {}) {
    return this.interventionEffectStore.getEffectsRange(options);
  }

  pruneExposuresBefore(cutoffTs) {
    return this.interventionEffectStore.pruneExposuresBefore(cutoffTs);
  }

  pruneEffectsBefore(cutoffDateStr) {
    return this.interventionEffectStore.pruneEffectsBefore(cutoffDateStr);
  }

  clearAll() {
    return this.interventionEffectStore.clearAll();
  }
}

export default InterventionEffectRepository;
