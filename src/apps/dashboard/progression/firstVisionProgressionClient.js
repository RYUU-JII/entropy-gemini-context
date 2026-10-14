import {
  PROGRESSION_FIRST_VISION_STATES,
} from '../../../domains/progression/contracts/progressionIds.js';
import { MESSAGE_ACTIONS } from '../../../platform/messaging/messageTypes.js';
import {
  requestDashboardProgression, assertDashboardProgressionGeneration,
} from './progressionRequestClient.js';
import { refreshArtifactDisclosureSnapshotResourceAfterMutation } from '../artifacts/artifactDisclosureSnapshotResource.js';
import { notifyGuidanceStateChanged } from '../../shared/guidance/guidanceUiEvents.js';

const FIRST_VISION_STATE_SET = new Set(Object.values(PROGRESSION_FIRST_VISION_STATES));

function requireTimestamp(value, field) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`FIRST_VISION_PROGRESSION_SNAPSHOT_INVALID:${field}`);
  }
  return value;
}

export function assertFirstVisionProgressionSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw new Error('FIRST_VISION_PROGRESSION_SNAPSHOT_REQUIRED');
  }
  if (!FIRST_VISION_STATE_SET.has(snapshot.state)) {
    throw new Error('FIRST_VISION_PROGRESSION_SNAPSHOT_INVALID:state');
  }
  const hasDevelopmentProjection = Object.hasOwn(snapshot, 'developmentProjection');
  return Object.freeze({
    state: snapshot.state,
    presentedAtMs: requireTimestamp(snapshot.presentedAtMs, 'presentedAtMs'),
    spentAtMs: requireTimestamp(snapshot.spentAtMs, 'spentAtMs'),
    stateUpdatedAtMs: requireTimestamp(snapshot.stateUpdatedAtMs, 'stateUpdatedAtMs'),
    ...(hasDevelopmentProjection ? {
      developmentProjection: snapshot.developmentProjection,
    } : {}),
  });
}

async function requestFirstVisionProgression(action, failureCode) {
  const response = await requestDashboardProgression(action, { failureCode });
  return { snapshot: assertFirstVisionProgressionSnapshot(response.snapshot), profileGeneration: response.profileGeneration };
}

export function readFirstVisionProgressionSnapshot() {
  return requestFirstVisionProgression(
    MESSAGE_ACTIONS.GET_FIRST_VISION_PROGRESSION_SNAPSHOT,
    'FIRST_VISION_PROGRESSION_SNAPSHOT_READ_FAILED',
  ).then(({ snapshot }) => snapshot);
}

export async function recordFirstVisionPresented() {
  const { snapshot, profileGeneration } = await requestFirstVisionProgression(
    MESSAGE_ACTIONS.RECORD_FIRST_VISION_PRESENTED,
    'FIRST_VISION_PRESENTED_RECORD_FAILED',
  );
  // Another Dashboard may already have spent the shared milestone. Refresh
  // the same disclosure owner before the conductor hands off to current.
  if (snapshot.state === PROGRESSION_FIRST_VISION_STATES.SPENT) {
    await refreshArtifactDisclosureSnapshotResourceAfterMutation();
    assertDashboardProgressionGeneration(profileGeneration);
    notifyGuidanceStateChanged();
  }
  return snapshot;
}

export async function recordFirstVisionSpent() {
  const { snapshot, profileGeneration } = await requestFirstVisionProgression(
    MESSAGE_ACTIONS.RECORD_FIRST_VISION_SPENT,
    'FIRST_VISION_SPENT_RECORD_FAILED',
  );
  if (snapshot.state !== PROGRESSION_FIRST_VISION_STATES.SPENT) {
    throw new Error('FIRST_VISION_SPENT_ACK_STATE_INVALID');
  }
  await refreshArtifactDisclosureSnapshotResourceAfterMutation();
  assertDashboardProgressionGeneration(profileGeneration);
  notifyGuidanceStateChanged();
  return snapshot;
}
