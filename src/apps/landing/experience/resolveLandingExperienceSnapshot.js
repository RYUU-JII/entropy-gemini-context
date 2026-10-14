import {
  createLandingJourneyContractError,
  LANDING_READING_PHASE_IDS,
  LANDING_READING_PHASES,
  resolveLandingReadingPhase,
} from './landingJourneyContract.js';

export const LANDING_MOTION_MODES = Object.freeze({
  FULL: 'full',
  REDUCED: 'reduced',
});

export const LANDING_SOUND_MODES = Object.freeze({
  MUTED: 'muted',
  ENABLED: 'enabled',
});

export const LANDING_STILLNESS_TARGET_MS = 1_500;

const pausePhase = LANDING_READING_PHASES.find(
  ({ id }) => id === LANDING_READING_PHASE_IDS.PAUSE,
);

if (!pausePhase) {
  throw new Error('LANDING_PAUSE_READING_PHASE_REQUIRED');
}

const shishiGateDefinition = {
  journeyHoldProgress: pausePhase.start,
  scrollStart: pausePhase.start,
  fillEnd: 0.49,
  strikeEnd: 0.51,
  releaseEnd: 0.53,
};

const shishiGateOrder = [
  shishiGateDefinition.scrollStart,
  shishiGateDefinition.fillEnd,
  shishiGateDefinition.strikeEnd,
  shishiGateDefinition.releaseEnd,
];
if (
  shishiGateDefinition.journeyHoldProgress !== shishiGateDefinition.scrollStart
  || shishiGateOrder.some((value) => !Number.isFinite(value) || value < 0 || value > 1)
  || shishiGateOrder.slice(1).some((value, index) => value <= shishiGateOrder[index])
) {
  throw createLandingJourneyContractError(
    '[LandingReadingJourney] the Shishi gate must own one ordered scroll dwell.',
    shishiGateDefinition,
  );
}

export const LANDING_SHISHI_GATE_CONTRACT = Object.freeze(shishiGateDefinition);

const ENVIRONMENT_CHANNELS = Object.freeze([
  'dawn',
  'daylight',
  'warmth',
  'twilight',
  'nightDepth',
]);

export const LANDING_ENVIRONMENT_KEYFRAMES = Object.freeze([
  Object.freeze({ at: 0, dawn: 1, daylight: 0.10, warmth: 0.06, twilight: 0, nightDepth: 0 }),
  Object.freeze({ at: 0.10, dawn: 0.88, daylight: 0.26, warmth: 0.08, twilight: 0, nightDepth: 0 }),
  Object.freeze({ at: 0.27, dawn: 0.55, daylight: 0.50, warmth: 0.16, twilight: 0, nightDepth: 0 }),
  Object.freeze({ at: 0.43, dawn: 0.20, daylight: 0.72, warmth: 0.30, twilight: 0, nightDepth: 0 }),
  Object.freeze({ at: 0.59, dawn: 0.04, daylight: 0.86, warmth: 0.44, twilight: 0.04, nightDepth: 0 }),
  Object.freeze({ at: 0.82, dawn: 0, daylight: 0.28, warmth: 0.32, twilight: 0.64, nightDepth: 0.62 }),
  Object.freeze({ at: 1, dawn: 0, daylight: 0.04, warmth: 0.04, twilight: 0.12, nightDepth: 1 }),
]);

function createInputError(message, details = {}) {
  const error = new Error(message);
  error.code = 'LANDING_EXPERIENCE_INPUT_INVALID';
  error.details = Object.freeze({ ...details });
  return error;
}

function assertFiniteInRange(value, field, min, max) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw createInputError(
      `[LandingExperience] ${field} must be a finite number between ${min} and ${max}.`,
      { field, value, min, max },
    );
  }
  return value;
}

function assertEnum(value, field, catalog) {
  if (!Object.values(catalog).includes(value)) {
    throw createInputError(
      `[LandingExperience] ${field} is unsupported.`,
      { field, value, supported: Object.values(catalog) },
    );
  }
  return value;
}

function assertBoolean(value, field) {
  if (typeof value !== 'boolean') {
    throw createInputError(
      `[LandingExperience] ${field} must be boolean.`,
      { field, value },
    );
  }
  return value;
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(value) {
  const t = clamp01(value);
  return t * t * (3 - (2 * t));
}

function enter(progress, start, end) {
  return smoothstep((progress - start) / (end - start));
}

function exit(progress, start, end) {
  return 1 - enter(progress, start, end);
}

function windowPresence(progress, enterStart, enterEnd, exitStart, exitEnd) {
  return enter(progress, enterStart, enterEnd) * exit(progress, exitStart, exitEnd);
}

export function assertLandingMotionMode(motionMode) {
  return assertEnum(motionMode, 'motionMode', LANDING_MOTION_MODES);
}

export function assertLandingSoundMode(soundMode) {
  return assertEnum(soundMode, 'soundMode', LANDING_SOUND_MODES);
}

function resolveFullMotionShishiGate(scrollProgress) {
  const gate = LANDING_SHISHI_GATE_CONTRACT;
  const withinDwell = scrollProgress >= gate.scrollStart && scrollProgress < gate.releaseEnd;
  const globalProgress = scrollProgress <= gate.scrollStart
    ? scrollProgress
    : (scrollProgress <= gate.releaseEnd
      ? gate.journeyHoldProgress
      : gate.journeyHoldProgress + (
        ((scrollProgress - gate.releaseEnd) / (1 - gate.releaseEnd))
        * (1 - gate.journeyHoldProgress)
      ));

  let phase = 'dormant';
  if (scrollProgress >= gate.releaseEnd) phase = 'passed';
  else if (scrollProgress >= gate.strikeEnd) phase = 'releasing';
  else if (scrollProgress >= gate.fillEnd) phase = 'striking';
  else if (scrollProgress >= gate.scrollStart) phase = 'filling';

  const releaseProgress = enter(scrollProgress, gate.strikeEnd, gate.releaseEnd);
  const fillProgress = scrollProgress < gate.scrollStart
    ? 0
    : (scrollProgress < gate.fillEnd
      ? enter(scrollProgress, gate.scrollStart, gate.fillEnd)
      : (scrollProgress < gate.strikeEnd
        ? 1
        : 1 - releaseProgress));

  return Object.freeze({
    globalProgress,
    shishiGate: Object.freeze({
      phase,
      presence: windowPresence(
        scrollProgress,
        gate.scrollStart - 0.04,
        gate.scrollStart,
        gate.releaseEnd + 0.04,
        gate.releaseEnd + 0.09,
      ),
      dwellProgress: enter(scrollProgress, gate.scrollStart, gate.releaseEnd),
      fillProgress,
      strikeProgress: enter(scrollProgress, gate.fillEnd, gate.strikeEnd),
      releaseProgress,
      holding: withinDwell,
      passed: scrollProgress >= gate.releaseEnd,
    }),
  });
}

function resolveReducedMotionShishiGate(scrollProgress) {
  const crossedGate = scrollProgress >= LANDING_SHISHI_GATE_CONTRACT.scrollStart;
  return Object.freeze({
    globalProgress: scrollProgress,
    shishiGate: Object.freeze({
      phase: crossedGate ? 'passed' : 'dormant',
      presence: windowPresence(
        scrollProgress,
        LANDING_SHISHI_GATE_CONTRACT.scrollStart - 0.04,
        LANDING_SHISHI_GATE_CONTRACT.scrollStart,
        LANDING_SHISHI_GATE_CONTRACT.scrollStart + 0.05,
        LANDING_SHISHI_GATE_CONTRACT.scrollStart + 0.10,
      ),
      dwellProgress: crossedGate ? 1 : 0,
      fillProgress: 0,
      strikeProgress: crossedGate ? 1 : 0,
      releaseProgress: crossedGate ? 1 : 0,
      holding: false,
      passed: crossedGate,
    }),
  });
}

export function resolveLandingJourneyProjection({ scrollProgress, motionMode }) {
  const normalizedScrollProgress = assertFiniteInRange(
    scrollProgress,
    'scrollProgress',
    0,
    1,
  );
  const normalizedMotionMode = assertLandingMotionMode(motionMode);
  const projection = normalizedMotionMode === LANDING_MOTION_MODES.REDUCED
    ? resolveReducedMotionShishiGate(normalizedScrollProgress)
    : resolveFullMotionShishiGate(normalizedScrollProgress);

  return Object.freeze({
    scrollProgress: normalizedScrollProgress,
    globalProgress: projection.globalProgress,
    shishiGate: projection.shishiGate,
  });
}

export function resolveLandingScrollProgressForGlobalProgress(globalProgress, motionMode) {
  const normalizedGlobalProgress = assertFiniteInRange(
    globalProgress,
    'globalProgress',
    0,
    1,
  );
  const normalizedMotionMode = assertLandingMotionMode(motionMode);
  if (normalizedMotionMode === LANDING_MOTION_MODES.REDUCED) {
    return normalizedGlobalProgress;
  }

  const gate = LANDING_SHISHI_GATE_CONTRACT;
  if (normalizedGlobalProgress <= gate.journeyHoldProgress) {
    return normalizedGlobalProgress;
  }

  return gate.releaseEnd + (
    ((normalizedGlobalProgress - gate.journeyHoldProgress)
      / (1 - gate.journeyHoldProgress))
    * (1 - gate.releaseEnd)
  );
}

function resolveEnvironment(globalProgress) {
  const upperIndex = LANDING_ENVIRONMENT_KEYFRAMES.findIndex(({ at }) => at >= globalProgress);
  const upper = LANDING_ENVIRONMENT_KEYFRAMES[upperIndex];
  if (!upper) {
    throw createLandingJourneyContractError(
      '[LandingReadingJourney] environment keyframes do not cover global progress.',
      { globalProgress },
    );
  }
  if (upper.at === globalProgress || upperIndex === 0) {
    return Object.freeze(Object.fromEntries(
      ENVIRONMENT_CHANNELS.map((channel) => [channel, upper[channel]]),
    ));
  }

  const lower = LANDING_ENVIRONMENT_KEYFRAMES[upperIndex - 1];
  const progress = (globalProgress - lower.at) / (upper.at - lower.at);
  return Object.freeze(Object.fromEntries(
    ENVIRONMENT_CHANNELS.map((channel) => [
      channel,
      lower[channel] + ((upper[channel] - lower[channel]) * progress),
    ]),
  ));
}

function resolveArtifactEffects({
  globalProgress,
  furinTriggered,
  furinSignalProgress,
  motionMode,
}) {
  const shojiPresence = windowPresence(globalProgress, 0.22, 0.28, 0.39, 0.43);
  const furinPresence = windowPresence(globalProgress, 0.56, 0.61, 0.70, 0.76);
  const projectedFurinSignalProgress = motionMode === LANDING_MOTION_MODES.REDUCED
    && furinTriggered
    ? 1
    : (furinTriggered ? furinSignalProgress : 0);

  return Object.freeze({
    shoji: Object.freeze({
      presence: shojiPresence,
      desaturation: shojiPresence * enter(globalProgress, 0.25, 0.34),
      tracking: shojiPresence * enter(globalProgress, 0.27, 0.38),
      shuffle: motionMode === LANDING_MOTION_MODES.REDUCED
        ? 0
        : windowPresence(globalProgress, 0.28, 0.33, 0.37, 0.42),
    }),
    furin: Object.freeze({
      presence: furinPresence,
      signalRecession: enter(globalProgress, 0.59, 0.71),
      triggered: furinTriggered,
      signalProgress: projectedFurinSignalProgress,
    }),
  });
}

export function resolveLandingExperienceSnapshot({
  scrollProgress,
  wind,
  stillnessMs,
  scrollPressure,
  furinTriggered,
  furinSignalProgress,
  motionMode,
  soundMode,
}) {
  const normalizedMotionMode = assertLandingMotionMode(motionMode);
  const journey = resolveLandingJourneyProjection({
    scrollProgress,
    motionMode: normalizedMotionMode,
  });
  if (!wind || typeof wind !== 'object' || Array.isArray(wind)) {
    throw createInputError(
      '[LandingExperience] wind must be an object with x and strength.',
      { wind },
    );
  }

  const windX = assertFiniteInRange(wind.x, 'wind.x', -1, 1);
  const windStrength = assertFiniteInRange(wind.strength, 'wind.strength', 0, 1);
  if (!Number.isFinite(stillnessMs) || stillnessMs < 0) {
    throw createInputError(
      '[LandingExperience] stillnessMs must be a finite non-negative number.',
      { stillnessMs },
    );
  }

  const phaseState = resolveLandingReadingPhase(journey.globalProgress);
  const normalizedFurinTriggered = assertBoolean(furinTriggered, 'furinTriggered');
  const normalizedFurinSignalProgress = assertFiniteInRange(
    furinSignalProgress,
    'furinSignalProgress',
    0,
    1,
  );
  if (!normalizedFurinTriggered && normalizedFurinSignalProgress !== 0) {
    throw createInputError(
      '[LandingExperience] an untriggered Furin cannot expose signal progress.',
      { furinTriggered, furinSignalProgress },
    );
  }

  const snapshot = {
    scrollProgress: journey.scrollProgress,
    globalProgress: journey.globalProgress,
    ...phaseState,
    environment: resolveEnvironment(journey.globalProgress),
    artifactEffects: resolveArtifactEffects({
      globalProgress: journey.globalProgress,
      furinTriggered: normalizedFurinTriggered,
      furinSignalProgress: normalizedFurinSignalProgress,
      motionMode: normalizedMotionMode,
    }),
    shishiGate: journey.shishiGate,
    wind: Object.freeze({ x: windX, strength: windStrength }),
    stillnessMs,
    stillnessProgress: Math.min(1, stillnessMs / LANDING_STILLNESS_TARGET_MS),
    scrollPressure: assertFiniteInRange(scrollPressure, 'scrollPressure', 0, 1),
    motionMode: normalizedMotionMode,
    soundMode: assertLandingSoundMode(soundMode),
  };

  return Object.freeze(snapshot);
}
