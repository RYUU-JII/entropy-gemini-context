import { requestDashboardProgression } from '../progression/progressionRequestClient.js';
import { MESSAGE_ACTIONS } from '../../../platform/messaging/messageTypes.js';
import {
  requireArtifactDisclosureSnapshot,
} from '../../../domains/progression/policy/progressionUnlockPolicy.js';
import { requireSiteRegistrationJourneyMilestones } from '../../../domains/progression/policy/siteRegistrationJourneyPolicy.js';

export function assertArtifactDisclosureSnapshot(snapshot) {
  requireArtifactDisclosureSnapshot(snapshot);
  requireSiteRegistrationJourneyMilestones(snapshot.registrationJourneyMilestones);
  return snapshot;
}

export async function readArtifactDisclosureSnapshot() {
  const response = await requestDashboardProgression(MESSAGE_ACTIONS.GET_ARTIFACT_DISCLOSURE_SNAPSHOT, {
    failureCode: 'ARTIFACT_DISCLOSURE_SNAPSHOT_READ_FAILED',
  });
  return assertArtifactDisclosureSnapshot(response.snapshot);
}

export default readArtifactDisclosureSnapshot;
