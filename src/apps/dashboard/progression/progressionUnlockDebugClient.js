import { assertDashboardProgressionGeneration, requestDashboardProgression } from './progressionRequestClient.js';
import { requireDashboardProfileGeneration } from '../bootstrap/dashboardProfileGenerationOwner.js';
import { PROGRESSION_DEBUG_ACTIONS } from '@progression-debug-actions';
import {
  normalizeProgressionUnlockDebugDay,
} from '../../../domains/progression/policy/progressionUnlockPolicy.js';
import {
  PROGRESSION_UNLOCK_DEBUG_MODES,
  normalizeProgressionUnlockDebugMode,
  requireProgressionUnlockDebugProjection,
} from '@progression-debug-contract';
import {
  commitArtifactDisclosureSnapshotResource,
} from '../artifacts/artifactDisclosureSnapshotResource.js';
import { notifyGuidanceStateChanged } from '../../shared/guidance/guidanceUiEvents.js';

let commandQueue = Promise.resolve();

function enqueueDebugCommand(operation) {
  const profileGeneration = requireDashboardProfileGeneration();
  const pending = commandQueue.then(() => {
    assertDashboardProgressionGeneration(profileGeneration);
    return operation();
  });
  commandQueue = pending.then(() => undefined, () => undefined);
  return pending;
}

async function commitDebugCommand(action, payload = {}) {
  const response = await requestDashboardProgression(action, {
    payload, failureCode: 'PROGRESSION_UNLOCK_DEBUG_COMMAND_FAILED',
  });
  const snapshot = commitArtifactDisclosureSnapshotResource(response.snapshot);
  notifyGuidanceStateChanged();
  return snapshot;
}

function sendProgressionUnlockDebugCommand(action, payload = {}) {
  return enqueueDebugCommand(() => commitDebugCommand(action, payload));
}

export function setProgressionUnlockDebugDay(dayCount) {
  return sendProgressionUnlockDebugCommand(
    PROGRESSION_DEBUG_ACTIONS.SET_UNLOCK_DAY,
    { dayCount: normalizeProgressionUnlockDebugDay(dayCount) },
  );
}

export function setProgressionUnlockDebugMode(mode, { dayCount = null } = {}) {
  const normalizedMode = normalizeProgressionUnlockDebugMode(mode);
  if (normalizedMode === PROGRESSION_UNLOCK_DEBUG_MODES.CANONICAL) {
    return clearProgressionUnlockDebugOverride();
  }
  return sendProgressionUnlockDebugCommand(
    PROGRESSION_DEBUG_ACTIONS.SET_UNLOCK_MODE,
    {
      mode: normalizedMode,
      dayCount: normalizeProgressionUnlockDebugDay(dayCount),
    },
  );
}

export function previewFirstVisionAtProgressionUnlockDay(dayCount) {
  return setProgressionUnlockDebugMode(
    PROGRESSION_UNLOCK_DEBUG_MODES.FIRST_VISION_PREVIEW,
    { dayCount },
  );
}

export function clearProgressionUnlockDebugOverride() {
  return sendProgressionUnlockDebugCommand(
    PROGRESSION_DEBUG_ACTIONS.CLEAR_UNLOCK_OVERRIDE,
  );
}

export function completeProgressionUnlockDebugReplay(expectedProjection) {
  const expected = requireProgressionUnlockDebugProjection(expectedProjection);
  if (expected.mode !== PROGRESSION_UNLOCK_DEBUG_MODES.FIRST_VISION_PREVIEW) {
    throw new Error('PROGRESSION_FIRST_VISION_PREVIEW_COMPLETION_REQUIRED');
  }
  return enqueueDebugCommand(async () => {
    const response = await requestDashboardProgression(
      PROGRESSION_DEBUG_ACTIONS.COMPLETE_FIRST_VISION_PREVIEW,
      { payload: { expectedProjection: expected }, failureCode: 'PROGRESSION_FIRST_VISION_PREVIEW_COMPLETE_FAILED' },
    );
    if (!response.completion || typeof response.completion.applied !== 'boolean') {
      throw new Error('PROGRESSION_FIRST_VISION_PREVIEW_COMPLETION_ACK_INVALID');
    }
    const snapshot = commitArtifactDisclosureSnapshotResource(response.completion.snapshot);
    notifyGuidanceStateChanged();
    return Object.freeze({ applied: response.completion.applied, snapshot });
  });
}
