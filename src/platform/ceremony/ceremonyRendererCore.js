import {
  getCeremonyDurationMs as resolveCeremonyDurationMs,
  normalizeCeremonyId,
} from './ceremonyContracts.js';
import {
  FIRST_VISION_DESCENT_CEREMONY_ID,
  FIRST_VISION_DESCENT_DURATION_MS,
  createFirstVisionDescentPlaybackClock,
  drawFirstVisionDescentFrame,
  resolveFirstVisionDescentProgress,
} from './renderers/firstVisionDescentRenderer.js';
import {
  MEMORY_PURGE_TIDE_CEREMONY_ID,
  MEMORY_PURGE_TIDE_DURATION_MS,
  createMemoryPurgeTideParticles,
  drawMemoryPurgeTideFrame,
  resolveMemoryPurgeTideProgress,
} from './renderers/memoryPurgeTideRenderer.js';
import {
  BOOKMARK_NEUTRALIZED_CEREMONY_ID,
  BOOKMARK_NEUTRALIZED_DURATION_MS,
  createBookmarkNeutralizedFragments,
  drawBookmarkNeutralizedFrame,
  resolveBookmarkNeutralizedProgress,
} from './renderers/bookmarkNeutralizedRenderer.js';

export const getCeremonyDurationMs = resolveCeremonyDurationMs;

export {
  BOOKMARK_NEUTRALIZED_CEREMONY_ID,
  BOOKMARK_NEUTRALIZED_DURATION_MS,
  FIRST_VISION_DESCENT_CEREMONY_ID,
  FIRST_VISION_DESCENT_DURATION_MS,
  MEMORY_PURGE_TIDE_CEREMONY_ID,
  MEMORY_PURGE_TIDE_DURATION_MS,
  createBookmarkNeutralizedFragments,
  createFirstVisionDescentPlaybackClock,
  createMemoryPurgeTideParticles,
  drawBookmarkNeutralizedFrame,
  drawFirstVisionDescentFrame,
  drawMemoryPurgeTideFrame,
  resolveBookmarkNeutralizedProgress,
  resolveFirstVisionDescentProgress,
  resolveMemoryPurgeTideProgress,
};

export function createCeremonyRenderState({
  ceremonyId = FIRST_VISION_DESCENT_CEREMONY_ID,
  width = 1200,
  height = 800,
  seed = 872342,
} = {}) {
  const normalizedCeremonyId = normalizeCeremonyId(ceremonyId);
  if (normalizedCeremonyId === MEMORY_PURGE_TIDE_CEREMONY_ID) {
    return Object.freeze({
      ceremonyId: normalizedCeremonyId,
      particles: createMemoryPurgeTideParticles({ width, height, seed }),
    });
  }
  if (normalizedCeremonyId === BOOKMARK_NEUTRALIZED_CEREMONY_ID) {
    return Object.freeze({
      ceremonyId: normalizedCeremonyId,
      fragments: createBookmarkNeutralizedFragments({ width, height, seed }),
    });
  }
  return Object.freeze({
    ceremonyId: FIRST_VISION_DESCENT_CEREMONY_ID,
  });
}

export function drawCeremonyFrame(ctx, {
  ceremonyId = FIRST_VISION_DESCENT_CEREMONY_ID,
  width = 1200,
  height = 800,
  elapsedMs = 0,
  renderState = null,
} = {}) {
  const normalizedCeremonyId = normalizeCeremonyId(ceremonyId) || FIRST_VISION_DESCENT_CEREMONY_ID;
  if (normalizedCeremonyId === MEMORY_PURGE_TIDE_CEREMONY_ID) {
    return drawMemoryPurgeTideFrame(ctx, {
      width,
      height,
      elapsedMs,
      particles: renderState?.particles || [],
    });
  }
  if (normalizedCeremonyId === BOOKMARK_NEUTRALIZED_CEREMONY_ID) {
    return drawBookmarkNeutralizedFrame(ctx, {
      width,
      height,
      elapsedMs,
      fragments: renderState?.fragments || [],
    });
  }
  return drawFirstVisionDescentFrame(ctx, {
    width,
    height,
    elapsedMs,
  });
}
