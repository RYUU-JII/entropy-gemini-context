import {
  requireModelStateProfileEpochId,
} from '../../../../platform/storage/model/ProfileEpochContract.js';
import {
  resolveProfileResetGeneration,
} from '../../../../platform/storage/runtime/ProfileResetLifecycleRepository.js';
import {
  ZEN_BONSAI_PROFILE_AGGREGATE_MODEL_STATE_KEY,
  requireZenBonsaiProfileAggregateStorageValue,
} from '../../../../platform/storage/themes/zen/ZenBonsaiProfileAggregateStorageContract.js';
import {
  createInitialZenBonsaiProfileGenerationAggregate,
} from '../../../../themes/plugins/zen/model/ZenBonsaiProfileGenerationGenesis.js';

const PROFILE_AGGREGATE_KEY = ZEN_BONSAI_PROFILE_AGGREGATE_MODEL_STATE_KEY;

function requireOwnerMethod(owner, methodName, errorCode) {
  if (!owner || typeof owner[methodName] !== 'function') {
    throw new Error(errorCode);
  }
  return owner[methodName].bind(owner);
}

function createResultEpochMismatchError({ expectedProfileEpoch, observedProfileEpoch }) {
  const error = new Error('BACKGROUND_ZEN_PROFILE_GENERATION_RESULT_EPOCH_MISMATCH');
  error.code = 'BACKGROUND_ZEN_PROFILE_GENERATION_RESULT_EPOCH_MISMATCH';
  error.expectedProfileEpoch = expectedProfileEpoch;
  error.observedProfileEpoch = observedProfileEpoch;
  return error;
}

export function createBackgroundKernelZenProfileGenerationState({
  profileEpoch,
} = {}) {
  const resolvedProfileEpoch = requireModelStateProfileEpochId(
    profileEpoch,
    'BACKGROUND_ZEN_PROFILE_GENERATION_EPOCH_REQUIRED',
  );
  const profileAggregate = createInitialZenBonsaiProfileGenerationAggregate({
    profileEpoch: resolvedProfileEpoch,
  });
  requireZenBonsaiProfileAggregateStorageValue(profileAggregate);

  return Object.freeze({
    profileAggregate,
    modelStateInitialEntries: Object.freeze([
      Object.freeze({
        key: PROFILE_AGGREGATE_KEY,
        value: profileAggregate,
      }),
    ]),
  });
}

export function createBackgroundKernelZenProfileGenerationInitializer({
  modelStateRepository,
  profileResetLifecycleRepository,
  profileMutationRuntimeGate,
} = {}) {
  const initializeProfileGeneration = requireOwnerMethod(
    modelStateRepository,
    'initializeProfileGeneration',
    'BACKGROUND_ZEN_PROFILE_GENERATION_MODEL_STATE_REPOSITORY_REQUIRED',
  );
  const assertWriteAdmission = requireOwnerMethod(
    profileResetLifecycleRepository,
    'assertWriteAdmission',
    'BACKGROUND_ZEN_PROFILE_GENERATION_LIFECYCLE_REPOSITORY_REQUIRED',
  );
  const runAdmitted = requireOwnerMethod(
    profileMutationRuntimeGate,
    'runAdmitted',
    'BACKGROUND_ZEN_PROFILE_GENERATION_RUNTIME_GATE_REQUIRED',
  );

  return async function initializeZenProfileGeneration({ lifecycle } = {}) {
    const resolvedProfileEpoch = resolveProfileResetGeneration(lifecycle);
    return runAdmitted({
      label: 'background_bootstrap:zen_profile_generation_initialize',
      task: async () => {
        await assertWriteAdmission({ expectedResetId: resolvedProfileEpoch });
        const { profileAggregate } = createBackgroundKernelZenProfileGenerationState({
          profileEpoch: resolvedProfileEpoch,
        });
        const result = requireZenBonsaiProfileAggregateStorageValue(
          await initializeProfileGeneration(resolvedProfileEpoch, { profileAggregate }),
        );
        if (result.profileEpoch !== resolvedProfileEpoch) {
          throw createResultEpochMismatchError({
            expectedProfileEpoch: resolvedProfileEpoch,
            observedProfileEpoch: result.profileEpoch,
          });
        }
        return result;
      },
    });
  };
}
