import {
  getTextRhythmRuntimeProfile,
} from '../../../domains/settings/config/textRhythmProfile.js';
import { FRICTION_INTENSITY_BANDS } from '../../../domains/settings/config/frictionIntensityBands.js';
import {
  createSeededRandom,
  scaleShuffleDistanceDistribution,
  shuffleWords,
} from '../../../lib/textShuffle.js';

const LANDING_LENS_PROFILE_BAND = FRICTION_INTENSITY_BANDS.REINFORCED;
const LANDING_LENS_PROJECTION_STEPS = 4;
const LANDING_LENS_SEED_NAMESPACE = 'entropy:landing:lens:v1';

function requireSourceText(value) {
  const sourceText = typeof value === 'string' ? value.trim() : '';
  if (!sourceText) {
    throw new Error('LANDING_LENS_SOURCE_TEXT_REQUIRED');
  }
  return sourceText;
}

function requireUnitInterval(value) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error('LANDING_LENS_PROGRESS_INVALID');
  }
  return value;
}

function resolveProjectionStep(progress) {
  if (progress === 0) return 0;
  return Math.min(
    LANDING_LENS_PROJECTION_STEPS - 1,
    Math.ceil(progress * (LANDING_LENS_PROJECTION_STEPS - 1)),
  );
}

export function resolveLandingLensTextProjection({ sourceText, progress }) {
  const source = requireSourceText(sourceText);
  const resolvedProgress = requireUnitInterval(progress);
  const profile = getTextRhythmRuntimeProfile(LANDING_LENS_PROFILE_BAND);
  const projectionStep = resolveProjectionStep(resolvedProgress);
  const steppedProgress = projectionStep / (LANDING_LENS_PROJECTION_STEPS - 1);
  const shuffle = profile.shuffle;
  if (!shuffle.enabled) {
    throw new Error(`LANDING_LENS_SHUFFLE_PROFILE_REQUIRED:${profile.band}`);
  }
  const projectedText = projectionStep === 0
    ? source
    : shuffleWords(source, {
      distanceDistribution: scaleShuffleDistanceDistribution(
        shuffle.distanceDistribution,
        steppedProgress,
      ),
      protectInformationalTokens: shuffle.protectInformationalTokens,
      random: createSeededRandom(`${LANDING_LENS_SEED_NAMESPACE}:${source}`),
    });

  return Object.freeze({
    profile,
    projectedText,
    projectionStep,
    steppedProgress,
  });
}
