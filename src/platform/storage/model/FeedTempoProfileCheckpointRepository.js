import ModelStateRepository from './ModelStateRepository.js';
import {
  FEED_TEMPO_PROFILE_CHECKPOINT_KEY,
  requireFeedTempoProfileCheckpoint,
} from './FeedTempoProfileCheckpointContract.js';

function requireRepositoryMethod(owner, method, errorCode) {
  if (!owner || typeof owner[method] !== 'function') throw new Error(errorCode);
}

function requireProfileEpoch(value) {
  if (typeof value !== 'string' || !value || value.trim() !== value) {
    throw new Error('FEED_TEMPO_CHECKPOINT_REPOSITORY_EPOCH_REQUIRED');
  }
  return value;
}

export class FeedTempoProfileCheckpointRepository {
  static getInstance() {
    if (!FeedTempoProfileCheckpointRepository.instance) {
      FeedTempoProfileCheckpointRepository.instance = (
        new FeedTempoProfileCheckpointRepository()
      );
    }
    return FeedTempoProfileCheckpointRepository.instance;
  }

  constructor({
    modelStateRepository = ModelStateRepository.getInstance(),
  } = {}) {
    requireRepositoryMethod(
      modelStateRepository,
      'getEntryWithProfileEpoch',
      'FEED_TEMPO_CHECKPOINT_MODEL_STATE_READ_REQUIRED',
    );
    requireRepositoryMethod(
      modelStateRepository,
      'compareAndSetValueWithProfileEpoch',
      'FEED_TEMPO_CHECKPOINT_MODEL_STATE_CAS_REQUIRED',
    );
    this.modelStateRepository = modelStateRepository;
  }

  async read({ profileEpoch } = {}) {
    const expectedProfileEpoch = requireProfileEpoch(profileEpoch);
    const result = await this.modelStateRepository.getEntryWithProfileEpoch(
      FEED_TEMPO_PROFILE_CHECKPOINT_KEY,
      { expectedProfileEpoch },
    );
    if (
      !result
      || typeof result.found !== 'boolean'
      || result.profileEpoch !== expectedProfileEpoch
    ) {
      throw new Error('FEED_TEMPO_CHECKPOINT_READ_RESULT_INVALID');
    }
    if (!result.found) {
      if (result.value !== null) {
        throw new Error('FEED_TEMPO_CHECKPOINT_ABSENT_VALUE_INVALID');
      }
      return Object.freeze({
        found: false,
        profileEpoch: expectedProfileEpoch,
        checkpoint: null,
        discarded: null,
      });
    }
    return Object.freeze({
      found: true,
      profileEpoch: expectedProfileEpoch,
      checkpoint: requireFeedTempoProfileCheckpoint(result.value, {
        expectedProfileEpoch,
      }),
      discarded: null,
    });
  }

  async compareAndSet({
    profileEpoch,
    expectedRevision,
    nextCheckpoint,
    assertCommitAllowed,
  } = {}) {
    if (typeof assertCommitAllowed !== 'function') {
      throw new Error('FEED_TEMPO_CHECKPOINT_HISTORY_ADMISSION_REQUIRED');
    }
    const expectedProfileEpoch = requireProfileEpoch(profileEpoch);
    if (
      expectedRevision !== null
      && (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0)
    ) {
      throw new Error('FEED_TEMPO_CHECKPOINT_EXPECTED_REVISION_INVALID');
    }
    const normalizedNext = requireFeedTempoProfileCheckpoint(nextCheckpoint, {
      expectedProfileEpoch,
    });
    if (
      expectedRevision === null
        ? normalizedNext.stateRevision !== 0
        : normalizedNext.stateRevision !== expectedRevision + 1
    ) {
      throw new Error('FEED_TEMPO_CHECKPOINT_NEXT_REVISION_INVALID');
    }
    const result = await this.modelStateRepository.compareAndSetValueWithProfileEpoch(
      FEED_TEMPO_PROFILE_CHECKPOINT_KEY,
      {
        expectedProfileEpoch,
        expectedRevision,
        nextValue: normalizedNext,
        assertCommitAllowed,
      },
    );
    if (
      !result
      || typeof result.outcome !== 'string'
      || result.expectedProfileEpoch !== expectedProfileEpoch
    ) {
      throw new Error('FEED_TEMPO_CHECKPOINT_CAS_RESULT_INVALID');
    }
    const latestCheckpoint = result.latestValue === null
      ? null
      : requireFeedTempoProfileCheckpoint(result.latestValue, {
        expectedProfileEpoch: result.latestProfileEpoch,
      });
    return Object.freeze({
      outcome: result.outcome,
      written: result.written === true,
      expectedRevision,
      latestRevision: result.latestRevision,
      latestProfileEpoch: result.latestProfileEpoch,
      checkpoint: latestCheckpoint,
    });
  }
}

export default FeedTempoProfileCheckpointRepository;
