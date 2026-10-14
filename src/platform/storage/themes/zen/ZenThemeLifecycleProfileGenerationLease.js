import ProfileResetLifecycleRepository, {
  isProfileResetWriteAdmissionClosed,
  resolveProfileResetGeneration,
} from '../../runtime/ProfileResetLifecycleRepository.js';
import {
  requireZenThemeProfileGeneration,
} from './ZenThemeProfileGenerationLease.js';

export const createZenThemeLifecycleProfileGenerationLease = ({
  profileLifecycleRepository = ProfileResetLifecycleRepository.getInstance(),
  profileGeneration = null,
} = {}) => {
  if (
    !profileLifecycleRepository
    || typeof profileLifecycleRepository.read !== 'function'
    || typeof profileLifecycleRepository.assertWriteAdmission !== 'function'
    || typeof profileLifecycleRepository.subscribe !== 'function'
  ) {
    throw new Error('ZEN_THEME_PROFILE_LIFECYCLE_REPOSITORY_REQUIRED');
  }

  let closed = false;
  let closeError = null;
  let generation = profileGeneration === null
    ? null
    : requireZenThemeProfileGeneration(profileGeneration);
  const generationProvidedExplicitly = profileGeneration !== null;
  let generationCapturePending = profileGeneration === null;
  let unsubscribe = null;

  const close = (error = null) => {
    const reused = closed;
    closed = true;
    closeError ||= error instanceof Error ? error : null;
    if (typeof unsubscribe === 'function') {
      const release = unsubscribe;
      unsubscribe = null;
      release();
    }
    return Object.freeze({ closed: true, reused });
  };
  const requireOpen = (fallbackCode = 'ZEN_THEME_PROFILE_GENERATION_LEASE_CLOSED') => {
    if (!closed) return;
    throw closeError || new Error(fallbackCode);
  };

  const releaseSubscription = profileLifecycleRepository.subscribe(
    (nextLifecycle, previousLifecycle) => {
      if (generationCapturePending) {
        const error = new Error('ZEN_THEME_PROFILE_GENERATION_LEASE_CAPTURE_STALE');
        error.code = 'ZEN_THEME_PROFILE_GENERATION_LEASE_CAPTURE_STALE';
        error.lifecycle = nextLifecycle;
        close(error);
        return;
      }
      const nextGeneration = resolveProfileResetGeneration(nextLifecycle);
      const previousGeneration = resolveProfileResetGeneration(previousLifecycle);
      if (
        isProfileResetWriteAdmissionClosed(nextLifecycle)
        || nextGeneration !== generation
        || (
          !generationProvidedExplicitly
          && (
            isProfileResetWriteAdmissionClosed(previousLifecycle)
            || previousGeneration !== generation
          )
        )
      ) {
        const error = new Error('ZEN_THEME_PROFILE_GENERATION_LEASE_STALE');
        error.code = 'ZEN_THEME_PROFILE_GENERATION_LEASE_STALE';
        error.lifecycle = nextLifecycle;
        close(error);
      }
    },
  );
  unsubscribe = releaseSubscription;
  if (closed) close(closeError);

  const ready = generationCapturePending
    ? profileLifecycleRepository.read().then((lifecycle) => {
      requireOpen('ZEN_THEME_PROFILE_GENERATION_LEASE_CAPTURE_STALE');
      if (isProfileResetWriteAdmissionClosed(lifecycle)) {
        const error = new Error(
          `ZEN_THEME_PROFILE_GENERATION_LEASE_ADMISSION_CLOSED:${lifecycle.status}`,
        );
        error.code = 'ZEN_THEME_PROFILE_GENERATION_LEASE_ADMISSION_CLOSED';
        error.lifecycle = lifecycle;
        close(error);
        throw error;
      }
      generation = requireZenThemeProfileGeneration(
        resolveProfileResetGeneration(lifecycle),
      );
      generationCapturePending = false;
      return generation;
    }).catch((error) => {
      generationCapturePending = false;
      if (!closed) close(error);
      throw error;
    })
    : Promise.resolve(generation);
  void ready.catch(() => undefined);

  return Object.freeze({
    ready,
    async requireCurrent() {
      requireOpen();
      const expectedProfileEpoch = await ready;
      requireOpen();
      await profileLifecycleRepository.assertWriteAdmission({
        expectedResetId: expectedProfileEpoch,
      });
      requireOpen();
      return expectedProfileEpoch;
    },
    close,
  });
};
