import { MESSAGE_ACTIONS } from '@/platform/messaging/messageTypes.js';
import { PROGRESSION_REPRESENTED_SITE_LIMIT } from '@/domains/progression/policy/progressionRegistrationPolicy.js';
import { requestDashboardProgression } from './progressionRequestClient.js';
import { refreshArtifactDisclosureSnapshotResourceAfterMutation } from '../artifacts/artifactDisclosureSnapshotResource.js';

export async function recordSiteRegistrationInvitationsAdmitted(capacity) {
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > PROGRESSION_REPRESENTED_SITE_LIMIT) {
    throw new Error('SITE_REGISTRATION_INVITATION_CAPACITY_INVALID');
  }
  const response = await requestDashboardProgression(MESSAGE_ACTIONS.RECORD_SITE_REGISTRATION_INVITATIONS_ADMITTED, {
    payload: { capacity }, failureCode: 'SITE_REGISTRATION_INVITATIONS_ADMISSION_RECORD_FAILED',
  });
  const admitted = response.receipt?.admittedInvitationCapacity;
  if (!Number.isInteger(admitted) || admitted < capacity || admitted > PROGRESSION_REPRESENTED_SITE_LIMIT) {
    throw new Error('SITE_REGISTRATION_INVITATION_ADMISSION_RECEIPT_INVALID');
  }
  // The validated receipt acknowledges the mutation. Query failures remain in
  // the shared resource's explicit error state; another membership/guidance
  // invalidation may supersede this read without undoing the admitted scene.
  void refreshArtifactDisclosureSnapshotResourceAfterMutation().catch(() => undefined);
  return response.receipt;
}
