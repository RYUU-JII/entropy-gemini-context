import {
  requireModelStateProfileEpochId,
} from '../../../../platform/storage/model/ProfileEpochContract.js';

function requireOwnerMethod(owner, methodName, errorCode) {
  if (!owner || typeof owner[methodName] !== 'function') {
    throw new Error(errorCode);
  }
  return owner[methodName].bind(owner);
}

function createEpochMismatchError({ expectedProfileEpoch, observedProfileEpoch }) {
  const error = new Error('BACKGROUND_ZEN_PROFILE_GENERATION_READINESS_EPOCH_MISMATCH');
  error.code = 'BACKGROUND_ZEN_PROFILE_GENERATION_READINESS_EPOCH_MISMATCH';
  error.expectedProfileEpoch = expectedProfileEpoch;
  error.observedProfileEpoch = observedProfileEpoch;
  return error;
}

export function createBackgroundKernelZenProfileGenerationReadiness({
  modelStateRepository,
  profileResetLifecycleRepository,
  settingsService,
} = {}) {
  const assertProfileGenerationInitialized = requireOwnerMethod(
    modelStateRepository,
    'assertProfileGenerationInitialized',
    'BACKGROUND_ZEN_PROFILE_GENERATION_READINESS_MODEL_STATE_REPOSITORY_REQUIRED',
  );
  const assertWriteAdmission = requireOwnerMethod(
    profileResetLifecycleRepository,
    'assertWriteAdmission',
    'BACKGROUND_ZEN_PROFILE_GENERATION_READINESS_LIFECYCLE_REPOSITORY_REQUIRED',
  );
  const ensureSettingsCache = requireOwnerMethod(
    settingsService,
    'ensureSettingsCache',
    'BACKGROUND_PROFILE_GENERATION_READINESS_SETTINGS_OWNER_REQUIRED',
  );

  return Object.freeze({
    async assertReady({ expectedProfileGeneration } = {}) {
      const requiredProfileGeneration = requireModelStateProfileEpochId(
        expectedProfileGeneration,
        'BACKGROUND_ZEN_PROFILE_GENERATION_READINESS_EPOCH_REQUIRED',
      );
      await assertWriteAdmission({ expectedResetId: requiredProfileGeneration });
      const initialized = await assertProfileGenerationInitialized(
        requiredProfileGeneration,
      );
      await ensureSettingsCache();
      await assertWriteAdmission({ expectedResetId: requiredProfileGeneration });

      const observedProfileEpoch = initialized?.profileEpoch;
      const observedAggregateEpoch = initialized?.profileAggregate?.profileEpoch;
      if (
        observedProfileEpoch !== requiredProfileGeneration
        || observedAggregateEpoch !== requiredProfileGeneration
      ) {
        throw createEpochMismatchError({
          expectedProfileEpoch: requiredProfileGeneration,
          observedProfileEpoch: observedProfileEpoch === requiredProfileGeneration
            ? observedAggregateEpoch
            : observedProfileEpoch,
        });
      }

      return Object.freeze({ profileGeneration: requiredProfileGeneration });
    },
  });
}

export default createBackgroundKernelZenProfileGenerationReadiness;
