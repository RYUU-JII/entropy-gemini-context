import { MESSAGE_ACTIONS } from '../../../platform/messaging/messageTypes.js';
import { requestDashboardProgression, assertDashboardProgressionGeneration } from './progressionRequestClient.js';
import { refreshArtifactDisclosureSnapshotResourceAfterMutation } from '../artifacts/artifactDisclosureSnapshotResource.js';

export function requireBonsaiFirstBloomReceipt(receipt) {
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)
    || Object.keys(receipt).length !== 2
    || receipt.opened !== true || typeof receipt.newlyOpened !== 'boolean') {
    throw new Error('BONSAI_FIRST_BLOOM_RECEIPT_INVALID');
  }
  return Object.freeze({ opened: true, newlyOpened: receipt.newlyOpened });
}

export async function claimBonsaiFirstBloom() {
  const response = await requestDashboardProgression(MESSAGE_ACTIONS.CLAIM_BONSAI_FIRST_BLOOM, {
    failureCode: 'BONSAI_FIRST_BLOOM_CLAIM_FAILED',
  });
  const receipt = requireBonsaiFirstBloomReceipt(response.receipt);
  await refreshArtifactDisclosureSnapshotResourceAfterMutation();
  assertDashboardProgressionGeneration(response.profileGeneration);
  return receipt;
}
