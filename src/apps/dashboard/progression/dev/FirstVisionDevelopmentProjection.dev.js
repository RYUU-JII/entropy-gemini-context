import {
  PROGRESSION_FIRST_VISION_STATES,
} from '../../../../domains/progression/contracts/progressionIds.js';
import {
  PROGRESSION_UNLOCK_DEBUG_CONTRACT,
  PROGRESSION_UNLOCK_DEBUG_MODES,
  requireProgressionUnlockDebugProjection,
} from '@progression-debug-contract';
import {
  completeProgressionUnlockDebugReplay,
} from '../progressionUnlockDebugClient.js';

export const FIRST_VISION_DEVELOPMENT_PROJECTION_SIGNATURE = (
  'ENTROPY_FIRST_VISION_DEVELOPMENT_PROJECTION_DEV'
);

function requireCanonicalSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw new Error('FIRST_VISION_PRESENTATION_SNAPSHOT_REQUIRED');
  }
  return snapshot;
}

function requireDevelopmentProjection(snapshot) {
  const projection = snapshot.developmentProjection;
  if (!projection || typeof projection !== 'object' || Array.isArray(projection)) {
    throw new Error('FIRST_VISION_DEVELOPMENT_PROJECTION_REQUIRED');
  }
  const normalized = requireProgressionUnlockDebugProjection(projection);
  if (normalized.contract !== PROGRESSION_UNLOCK_DEBUG_CONTRACT) {
    throw new Error('FIRST_VISION_DEVELOPMENT_PROJECTION_INVALID');
  }
  return normalized;
}

function buildProjectedAcknowledgement(projection, state) {
  return Object.freeze({
    ...projection.canonicalSnapshot,
    state,
  });
}

function requireProjection(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('FIRST_VISION_PRESENTATION_PROJECTION_REQUIRED');
  }
  return value;
}

function requireCanonicalOperation(operation) {
  if (typeof operation !== 'function') {
    throw new Error('FIRST_VISION_PRESENTATION_CANONICAL_OPERATION_REQUIRED');
  }
  return operation;
}

export function resolveFirstVisionPresentationProjection(snapshot) {
  const canonicalSnapshot = requireCanonicalSnapshot(snapshot);
  const developmentProjection = requireDevelopmentProjection(canonicalSnapshot);

  if (developmentProjection.mode === PROGRESSION_UNLOCK_DEBUG_MODES.CANONICAL) {
    return Object.freeze({
      canonicalSnapshot,
      developmentProjection,
      effectiveState: canonicalSnapshot.state,
      canonicalWrites: true,
      previewActive: false,
    });
  }

  const previewActive = developmentProjection.mode
    === PROGRESSION_UNLOCK_DEBUG_MODES.FIRST_VISION_PREVIEW;
  return Object.freeze({
    canonicalSnapshot,
    developmentProjection,
    effectiveState: previewActive
      ? PROGRESSION_FIRST_VISION_STATES.PENDING
      : PROGRESSION_FIRST_VISION_STATES.SPENT,
    canonicalWrites: false,
    previewActive,
  });
}

export function persistFirstVisionPresentedForProjection({
  projection: candidate,
  recordCanonical,
} = {}) {
  const projection = requireProjection(candidate);
  if (projection.canonicalWrites) {
    return requireCanonicalOperation(recordCanonical)();
  }
  if (!projection.previewActive) {
    throw new Error('FIRST_VISION_PRESENTATION_WRITE_NOT_ADMITTED');
  }
  return Promise.resolve(buildProjectedAcknowledgement(
    projection,
    PROGRESSION_FIRST_VISION_STATES.PRESENTED,
  ));
}

export async function persistFirstVisionSpentForProjection({
  projection: candidate,
  recordCanonical,
} = {}) {
  const projection = requireProjection(candidate);
  if (projection.canonicalWrites) {
    return requireCanonicalOperation(recordCanonical)();
  }
  if (!projection.previewActive) {
    throw new Error('FIRST_VISION_PRESENTATION_WRITE_NOT_ADMITTED');
  }
  await completeProgressionUnlockDebugReplay(projection.developmentProjection);
  return buildProjectedAcknowledgement(
    projection,
    PROGRESSION_FIRST_VISION_STATES.SPENT,
  );
}
