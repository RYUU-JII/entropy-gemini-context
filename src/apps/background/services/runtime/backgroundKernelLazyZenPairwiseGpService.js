import { createZenPairwiseGPService } from '../../../../domains/tracking/background/ZenPairwiseGPService.js';

export function createLazyBackgroundZenPairwiseGpService(options = {}) {
  let servicePromise = null;
  let serviceInstance = null;
  let profileMutationAdmissionOpen = true;

  function requireProfileMutationAdmission() {
    if (!profileMutationAdmissionOpen) {
      throw new Error('BACKGROUND_ZEN_PAIRWISE_PROFILE_MUTATION_ACTIVE');
    }
  }

  function loadService() {
    requireProfileMutationAdmission();
    if (serviceInstance) return Promise.resolve(serviceInstance);
    servicePromise ||= Promise.resolve()
      .then(() => {
        serviceInstance = createZenPairwiseGPService(options);
        return serviceInstance;
      })
      .catch((error) => {
        servicePromise = null;
        console.error('[BackgroundKernelZenPairwiseGpService] Failed to load Zen pairwise GP service.', error);
        throw error;
      });
    return servicePromise;
  }

  return {
    async ensureLoaded(...args) {
      return (await loadService()).ensureLoaded(...args);
    },
    async trainPair(...args) {
      return (await loadService()).trainPair(...args);
    },
    async predictDetailed(...args) {
      return (await loadService()).predictDetailed(...args);
    },
    async sampleUtility(...args) {
      return (await loadService()).sampleUtility(...args);
    },
    async getMeta(...args) {
      return (await loadService()).getMeta(...args);
    },
    async reset(...args) {
      return (await loadService()).reset(...args);
    },
    async quiesceForProfileMutation() {
      profileMutationAdmissionOpen = false;
      const pendingService = servicePromise;
      if (pendingService) {
        await pendingService.catch(() => undefined);
      }
      serviceInstance?.disposeForProfileMutation?.();
      serviceInstance = null;
      servicePromise = null;
      return Object.freeze({ quiesced: true });
    },
  };
}
