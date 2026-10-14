import ModelStateRepository from './ModelStateRepository.js';
import {
  FEED_TOPOLOGY_CERTIFICATE_CHECKPOINT_KEY,
  requireFeedTopologyCertificateCheckpoint,
} from './FeedTopologyCertificateCheckpointContract.js';

function requireRepositoryMethod(owner, method, errorCode) {
  if (!owner || typeof owner[method] !== 'function') throw new Error(errorCode);
}

function requireProfileEpoch(value) {
  if (typeof value !== 'string' || !value || value.trim() !== value) {
    throw new Error('FEED_TOPOLOGY_CERTIFICATE_REPOSITORY_EPOCH_REQUIRED');
  }
  return value;
}

export class FeedTopologyCertificateCheckpointRepository {
  static getInstance() {
    if (!FeedTopologyCertificateCheckpointRepository.instance) {
      FeedTopologyCertificateCheckpointRepository.instance = (
        new FeedTopologyCertificateCheckpointRepository()
      );
    }
    return FeedTopologyCertificateCheckpointRepository.instance;
  }

  constructor({
    modelStateRepository = ModelStateRepository.getInstance(),
  } = {}) {
    requireRepositoryMethod(
      modelStateRepository,
      'getEntryWithProfileEpoch',
      'FEED_TOPOLOGY_CERTIFICATE_MODEL_STATE_READ_REQUIRED',
    );
    requireRepositoryMethod(
      modelStateRepository,
      'compareAndSetValueWithProfileEpoch',
      'FEED_TOPOLOGY_CERTIFICATE_MODEL_STATE_CAS_REQUIRED',
    );
    this.modelStateRepository = modelStateRepository;
  }

  async read({ profileEpoch } = {}) {
    const expectedProfileEpoch = requireProfileEpoch(profileEpoch);
    const result = await this.modelStateRepository.getEntryWithProfileEpoch(
      FEED_TOPOLOGY_CERTIFICATE_CHECKPOINT_KEY,
      { expectedProfileEpoch },
    );
    if (
      !result
      || typeof result.found !== 'boolean'
      || result.profileEpoch !== expectedProfileEpoch
    ) {
      throw new Error('FEED_TOPOLOGY_CERTIFICATE_READ_RESULT_INVALID');
    }
    if (!result.found) {
      if (result.value !== null) {
        throw new Error('FEED_TOPOLOGY_CERTIFICATE_ABSENT_VALUE_INVALID');
      }
      return Object.freeze({
        found: false,
        profileEpoch: expectedProfileEpoch,
        checkpoint: null,
      });
    }
    return Object.freeze({
      found: true,
      profileEpoch: expectedProfileEpoch,
      checkpoint: requireFeedTopologyCertificateCheckpoint(result.value, {
        expectedProfileEpoch,
      }),
    });
  }

  async compareAndSet({
    profileEpoch,
    expectedRevision,
    nextCheckpoint,
  } = {}) {
    const expectedProfileEpoch = requireProfileEpoch(profileEpoch);
    if (
      expectedRevision !== null
      && (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0)
    ) {
      throw new Error('FEED_TOPOLOGY_CERTIFICATE_EXPECTED_REVISION_INVALID');
    }
    const normalizedNext = requireFeedTopologyCertificateCheckpoint(
      nextCheckpoint,
      { expectedProfileEpoch },
    );
    if (
      expectedRevision === null
        ? normalizedNext.stateRevision !== 0
        : normalizedNext.stateRevision !== expectedRevision + 1
    ) {
      throw new Error('FEED_TOPOLOGY_CERTIFICATE_NEXT_REVISION_INVALID');
    }
    const result = await this.modelStateRepository.compareAndSetValueWithProfileEpoch(
      FEED_TOPOLOGY_CERTIFICATE_CHECKPOINT_KEY,
      {
        expectedProfileEpoch,
        expectedRevision,
        nextValue: normalizedNext,
      },
    );
    if (
      !result
      || typeof result.outcome !== 'string'
      || result.expectedProfileEpoch !== expectedProfileEpoch
    ) {
      throw new Error('FEED_TOPOLOGY_CERTIFICATE_CAS_RESULT_INVALID');
    }
    const latestCheckpoint = result.latestValue === null
      ? null
      : requireFeedTopologyCertificateCheckpoint(result.latestValue, {
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

export default FeedTopologyCertificateCheckpointRepository;
