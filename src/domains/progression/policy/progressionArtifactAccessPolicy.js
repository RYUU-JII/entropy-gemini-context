export const PROGRESSION_ARTIFACT_ACCESS_MODES = Object.freeze({
  JOURNEY_GATED: 'journey_gated',
  OPEN: 'open',
});

// Public releases use earned grants. The development-only projection owns
// explicit all-access; an ordinary canonical read never bypasses the journey.
export const PROGRESSION_ARTIFACT_ACCESS_MODE = PROGRESSION_ARTIFACT_ACCESS_MODES.JOURNEY_GATED;

const ARTIFACT_ACCESS_MODE_VALUES = new Set(Object.values(PROGRESSION_ARTIFACT_ACCESS_MODES));

function createArtifactAccessContractError(field) {
  const error = new Error(`PROGRESSION_UNLOCK_CONTRACT_INVALID:${field}`);
  error.code = 'PROGRESSION_UNLOCK_CONTRACT_INVALID';
  error.field = field;
  return error;
}

export function requireProgressionArtifactAccessMode(value) {
  if (!ARTIFACT_ACCESS_MODE_VALUES.has(value)) {
    throw createArtifactAccessContractError('artifactAccessMode');
  }
  return value;
}

export function resolveProgressionArtifactAccess(disclosed, {
  accessMode = PROGRESSION_ARTIFACT_ACCESS_MODE,
} = {}) {
  if (typeof disclosed !== 'boolean') {
    throw createArtifactAccessContractError('artifactDisclosed');
  }
  const normalizedAccessMode = requireProgressionArtifactAccessMode(accessMode);
  const accessible = normalizedAccessMode === PROGRESSION_ARTIFACT_ACCESS_MODES.OPEN
    ? true
    : disclosed;
  return Object.freeze({
    visible: accessible,
    configurable: accessible,
    runtimeEligible: accessible,
  });
}
