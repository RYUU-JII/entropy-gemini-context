import ModelStateRepository from './ModelStateRepository.js';
import { CONSUMPTION_MEMORY_CHECKPOINT_KEY, requireConsumptionMemoryCheckpoint } from './ConsumptionMemoryCheckpointContract.js';

export class ConsumptionMemoryCheckpointRepository {
  constructor({ modelStateRepository = ModelStateRepository.getInstance() } = {}) {
    this.repository = modelStateRepository;
    for (const method of ['getEntryWithProfileEpoch', 'compareAndSetValueWithProfileEpoch']) {
      if (typeof this.repository?.[method] !== 'function') throw new Error('CONSUMPTION_CHECKPOINT_REPOSITORY_REQUIRED');
    }
  }
  async read({ profileEpoch } = {}) {
    if (typeof profileEpoch !== 'string' || !profileEpoch || profileEpoch.trim() !== profileEpoch) throw new Error('CONSUMPTION_CHECKPOINT_EPOCH_REQUIRED');
    const value = await this.repository.getEntryWithProfileEpoch(CONSUMPTION_MEMORY_CHECKPOINT_KEY, { expectedProfileEpoch: profileEpoch });
    if (!value || typeof value.found !== 'boolean' || typeof value.profileEpoch !== 'string' || !value.profileEpoch
      || value.profileEpoch !== profileEpoch || (!value.found && value.value !== null)) throw new Error('CONSUMPTION_CHECKPOINT_READ_INVALID');
    return { profileEpoch: value.profileEpoch, checkpoint: value.found
      ? requireConsumptionMemoryCheckpoint(value.value, { expectedProfileEpoch: value.profileEpoch }) : null };
  }
  async commit({ checkpoint, expectedRevision, assertCommitAllowed }) {
    requireConsumptionMemoryCheckpoint(checkpoint);
    if (typeof assertCommitAllowed !== 'function' || (expectedRevision !== null
      && (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0))
      || checkpoint.stateRevision !== (expectedRevision === null ? 0 : expectedRevision + 1)) throw new Error('CONSUMPTION_CHECKPOINT_COMMIT_INVALID');
    const result = await this.repository.compareAndSetValueWithProfileEpoch(CONSUMPTION_MEMORY_CHECKPOINT_KEY, {
      expectedProfileEpoch: checkpoint.profileEpoch, expectedRevision, nextValue: checkpoint, assertCommitAllowed,
    });
    if (result?.outcome !== 'committed' || result.written !== true
      || result.latestProfileEpoch !== checkpoint.profileEpoch) throw new Error('CONSUMPTION_CHECKPOINT_COMMIT_CONFLICT');
    return requireConsumptionMemoryCheckpoint(result.latestValue, { expectedProfileEpoch: checkpoint.profileEpoch });
  }
}
