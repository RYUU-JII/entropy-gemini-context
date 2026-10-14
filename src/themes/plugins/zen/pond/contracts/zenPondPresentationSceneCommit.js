const requireNonEmptyText = (value, code) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(code);
  }
  return value.trim();
};

const requireNonNegativeInteger = (value, code) => {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 0) {
    throw new Error(code);
  }
  return numeric;
};

export const normalizeZenPondPresentationSceneCommitKey = (value) => {
  if (value === null || value === undefined) return null;
  return requireNonEmptyText(
    value,
    'ZEN_POND_PRESENTATION_SCENE_COMMIT_KEY_INVALID',
  );
};

export const buildZenPondWorkerRosterSignature = (fishRoster) => {
  if (!Array.isArray(fishRoster)) {
    throw new Error('ZEN_POND_PRESENTATION_FISH_ROSTER_INVALID');
  }
  const signature = JSON.stringify(fishRoster);
  if (typeof signature !== 'string') {
    throw new Error('ZEN_POND_PRESENTATION_WORKER_ROSTER_SIGNATURE_UNAVAILABLE');
  }
  return signature;
};

export function countZenPondDeferredInvitations(fishRoster) {
  if (!Array.isArray(fishRoster)) throw new Error('ZEN_POND_PRESENTATION_FISH_ROSTER_INVALID');
  return fishRoster.filter(item => item.entityKind === 'invitation' && item.invitationArrivalMode === 'bank').length;
}

export const normalizeZenPondPresentationRequiredVisibleFishCount = (
  value,
  { expectedFishCount } = {},
) => {
  const expected = requireNonNegativeInteger(
    expectedFishCount,
    'ZEN_POND_PRESENTATION_EXPECTED_FISH_COUNT_INVALID',
  );
  const required = requireNonNegativeInteger(
    value,
    'ZEN_POND_PRESENTATION_REQUIRED_VISIBLE_FISH_COUNT_INVALID',
  );
  if (required > expected) {
    throw new Error(
      `ZEN_POND_PRESENTATION_REQUIRED_VISIBLE_FISH_COUNT_EXCEEDS_ROSTER:required=${required}:expected=${expected}`,
    );
  }
  return required;
};

export const buildZenPondPresentationSceneCommitDescriptor = ({
  presentationSceneCommitKey = null,
  presentationRosterSignature = '',
  workerRosterSignature = '',
  expectedFishCount,
  deferredInvitationCount,
  requiredVisibleFishCount,
} = {}) => {
  const key = normalizeZenPondPresentationSceneCommitKey(presentationSceneCommitKey);
  if (key === null) return null;
  const expected = requireNonNegativeInteger(
    expectedFishCount,
    'ZEN_POND_PRESENTATION_EXPECTED_FISH_COUNT_INVALID',
  );
  const deferred = requireNonNegativeInteger(deferredInvitationCount, 'ZEN_POND_PRESENTATION_DEFERRED_INVITATION_COUNT_INVALID');
  if (deferred > expected) throw new Error('ZEN_POND_PRESENTATION_DEFERRED_INVITATION_COUNT_EXCEEDS_ROSTER');
  const requiredVisible = normalizeZenPondPresentationRequiredVisibleFishCount(
    requiredVisibleFishCount,
    { expectedFishCount: expected },
  );
  return Object.freeze({
    presentationSceneCommitKey: key,
    presentationRosterSignature: requireNonEmptyText(
      presentationRosterSignature,
      'ZEN_POND_PRESENTATION_ROSTER_SIGNATURE_REQUIRED',
    ),
    workerRosterSignature: requireNonEmptyText(
      workerRosterSignature,
      'ZEN_POND_PRESENTATION_WORKER_ROSTER_SIGNATURE_REQUIRED',
    ),
    expectedFishCount: expected,
    deferredInvitationCount: deferred,
    requiredVisibleFishCount: requiredVisible,
  });
};
