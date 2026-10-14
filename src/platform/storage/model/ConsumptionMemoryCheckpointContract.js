import { requireConsumptionMemory, requireConsumptionPolicyEvidenceFor } from '../../../domains/behavior/consumption/consumptionMemoryModel.js';

export const CONSUMPTION_MEMORY_CHECKPOINT_KEY = 'protected_consumption_memory_v1';
export function requireConsumptionMemoryCheckpoint(value, { expectedProfileEpoch } = {}) {
  const keys = ['contract', 'profileEpoch', 'stateRevision', 'model'];
  if (value && Object.hasOwn(value, 'policyEvidence')) keys.push('policyEvidence');
  if (!value || Object.keys(value).length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))
    || value.contract !== CONSUMPTION_MEMORY_CHECKPOINT_KEY || typeof value.profileEpoch !== 'string'
    || !value.profileEpoch || value.profileEpoch.trim() !== value.profileEpoch
    || !Number.isSafeInteger(value.stateRevision) || value.stateRevision < 0) throw new Error('CONSUMPTION_CHECKPOINT_INVALID');
  requireConsumptionMemory(value.model);
  if (Object.hasOwn(value, 'policyEvidence')) requireConsumptionPolicyEvidenceFor(value.policyEvidence, value.model.throughAt, value.model.memory);
  if (value.model.epoch !== value.profileEpoch || (expectedProfileEpoch !== undefined && expectedProfileEpoch !== value.profileEpoch)) {
    throw new Error('CONSUMPTION_CHECKPOINT_EPOCH_MISMATCH');
  }
  return value;
}
export function rebaseConsumptionMemoryCheckpoint(value, profileEpoch) {
  requireConsumptionMemoryCheckpoint(value);
  return requireConsumptionMemoryCheckpoint({ ...value, profileEpoch, model: { ...value.model, epoch: profileEpoch,
    lastInput: value.model.lastInput === null ? null : { ...value.model.lastInput, epoch: profileEpoch } } });
}
