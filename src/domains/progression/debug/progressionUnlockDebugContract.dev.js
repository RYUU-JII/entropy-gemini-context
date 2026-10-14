import {
  normalizeProgressionUnlockDebugDay,
  projectArtifactDisclosureSnapshotForProgressionUnlockDebug,
} from '../policy/progressionUnlockPolicy.js';
import { PROGRESSION_ARTIFACT_ACCESS_MODES } from '../policy/progressionArtifactAccessPolicy.js';
import { PROGRESSION_DEBUG_PREVIEW_TARGET_DAY_COUNT } from '../policy/progressionPreviewPolicy.js';

export const PROGRESSION_UNLOCK_DEBUG_CONTRACT = 'progression_unlock_debug_v3';

export const PROGRESSION_UNLOCK_DEBUG_MODES = Object.freeze({
  DEVELOP: 'develop',
  FULL_ACCESS: 'full_access',
  CANONICAL: 'canonical',
  FIRST_VISION_PREVIEW: 'first_vision_preview',
});

export const PROGRESSION_UNLOCK_DEBUG_DEFAULT_DAY_COUNT = PROGRESSION_DEBUG_PREVIEW_TARGET_DAY_COUNT;

const DEBUG_MODE_VALUES = new Set(Object.values(PROGRESSION_UNLOCK_DEBUG_MODES));

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function createDebugContractError(field) {
  const error = new Error(`PROGRESSION_UNLOCK_CONTRACT_INVALID:${field}`);
  error.code = 'PROGRESSION_UNLOCK_CONTRACT_INVALID';
  error.field = field;
  return error;
}

export function normalizeProgressionUnlockDebugMode(value) {
  if (typeof value !== 'string' || !DEBUG_MODE_VALUES.has(value)) {
    throw createDebugContractError('debugMode');
  }
  return value;
}

export function requireProgressionUnlockDebugProjection(value) {
  if (!isPlainObject(value)) {
    throw createDebugContractError('debugProjection');
  }
  const keys = Object.keys(value);
  if (
    keys.length !== 4
    || !Object.hasOwn(value, 'contract')
    || !Object.hasOwn(value, 'mode')
    || !Object.hasOwn(value, 'dayCount')
    || !Object.hasOwn(value, 'updatedAtMs')
    || value.contract !== PROGRESSION_UNLOCK_DEBUG_CONTRACT
  ) {
    throw createDebugContractError('debugProjection');
  }
  const mode = normalizeProgressionUnlockDebugMode(value.mode);
  const dayCount = mode === PROGRESSION_UNLOCK_DEBUG_MODES.CANONICAL
    ? value.dayCount
    : normalizeProgressionUnlockDebugDay(value.dayCount);
  if (
    (mode === PROGRESSION_UNLOCK_DEBUG_MODES.CANONICAL && dayCount !== null)
    || (mode === PROGRESSION_UNLOCK_DEBUG_MODES.FULL_ACCESS && dayCount !== PROGRESSION_DEBUG_PREVIEW_TARGET_DAY_COUNT)
    || !Number.isSafeInteger(value.updatedAtMs)
    || value.updatedAtMs < 0
  ) {
    throw createDebugContractError('debugProjection');
  }
  return Object.freeze({
    contract: PROGRESSION_UNLOCK_DEBUG_CONTRACT,
    mode,
    dayCount,
    updatedAtMs: value.updatedAtMs,
  });
}

export function buildDefaultProgressionUnlockDebugProjection() {
  return requireProgressionUnlockDebugProjection({
    contract: PROGRESSION_UNLOCK_DEBUG_CONTRACT,
    mode: PROGRESSION_UNLOCK_DEBUG_MODES.FULL_ACCESS,
    dayCount: PROGRESSION_UNLOCK_DEBUG_DEFAULT_DAY_COUNT,
    updatedAtMs: 0,
  });
}

export function projectArtifactDisclosureSnapshotForProgressionUnlockDevelopment(
  artifactDisclosureSnapshot,
  developmentProjection,
) {
  const projection = requireProgressionUnlockDebugProjection(developmentProjection);
  if (projection.mode === PROGRESSION_UNLOCK_DEBUG_MODES.CANONICAL) {
    return artifactDisclosureSnapshot;
  }
  return projectArtifactDisclosureSnapshotForProgressionUnlockDebug(
    artifactDisclosureSnapshot,
    {
      dayCount: projection.dayCount,
      updatedAtMs: projection.updatedAtMs,
      accessMode: projection.mode === PROGRESSION_UNLOCK_DEBUG_MODES.FULL_ACCESS
        ? PROGRESSION_ARTIFACT_ACCESS_MODES.OPEN
        : PROGRESSION_ARTIFACT_ACCESS_MODES.JOURNEY_GATED,
    },
  );
}
