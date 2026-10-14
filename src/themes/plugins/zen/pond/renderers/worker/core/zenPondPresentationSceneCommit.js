import {
  buildZenPondPresentationSceneCommitDescriptor,
  buildZenPondWorkerRosterSignature,
  normalizeZenPondPresentationSceneCommitKey,
  countZenPondDeferredInvitations,
} from '../../../contracts/zenPondPresentationSceneCommit.js';

const isObject = (value) => (
  Boolean(value && typeof value === 'object' && !Array.isArray(value))
);

export const applyZenPondPresentationSceneCommitRequest = ({
  state,
  payload = null,
  fishRoster,
} = {}) => {
  if (!isObject(state)) {
    throw new Error('ZEN_POND_PRESENTATION_RUNTIME_STATE_REQUIRED');
  }
  const key = normalizeZenPondPresentationSceneCommitKey(
    payload?.presentationSceneCommitKey,
  );
  if (key === null) {
    state.presentationSceneCommitRequest = null;
    return null;
  }

  const actualWorkerRosterSignature = buildZenPondWorkerRosterSignature(fishRoster);
  const descriptor = buildZenPondPresentationSceneCommitDescriptor({
    presentationSceneCommitKey: key,
    presentationRosterSignature: payload?.presentationRosterSignature,
    workerRosterSignature: payload?.workerRosterSignature,
    expectedFishCount: payload?.expectedFishCount,
    deferredInvitationCount: payload?.deferredInvitationCount,
    requiredVisibleFishCount: payload?.requiredVisibleFishCount,
  });
  if (descriptor.workerRosterSignature !== actualWorkerRosterSignature) {
    throw new Error('ZEN_POND_PRESENTATION_WORKER_ROSTER_SIGNATURE_MISMATCH');
  }
  if (descriptor.expectedFishCount !== fishRoster.length) {
    throw new Error(
      `ZEN_POND_PRESENTATION_FISH_COUNT_MISMATCH:expected=${descriptor.expectedFishCount}:actual=${fishRoster.length}`,
    );
  }
  if (descriptor.deferredInvitationCount !== countZenPondDeferredInvitations(fishRoster)) {
    throw new Error('ZEN_POND_PRESENTATION_DEFERRED_INVITATION_COUNT_MISMATCH');
  }

  const request = Object.freeze({
    ...descriptor,
    appliedAfterFrameAtMs: Math.max(0, Number(state.lastFrameAtMs) || 0),
    appliedAfterFrameCount: Math.max(
      0,
      Math.floor(Number(state.metrics?.sampleFrames) || 0),
    ),
  });
  state.presentationSceneCommitRequest = request;
  return request;
};
