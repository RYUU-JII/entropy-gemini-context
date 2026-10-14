export const LANDING_JOURNEY_CONTRACT_VERSION = 4;

export const LANDING_READING_PHASE_IDS = Object.freeze({
  THRESHOLD: 'threshold',
  MANIFESTO: 'manifesto',
  FRICTION: 'friction',
  PAUSE: 'pause',
  REFLECTION: 'reflection',
  INVITATION: 'invitation',
});

const PHASE_ID_PATTERN = /^[a-z][a-z0-9_]*$/;

export function createLandingJourneyContractError(message, details = {}) {
  const error = new Error(message);
  error.code = 'LANDING_READING_JOURNEY_CONTRACT_INVALID';
  error.details = Object.freeze({ ...details });
  return error;
}

function assertUnitInterval(value, field, details) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw createLandingJourneyContractError(
      `[LandingReadingJourney] ${field} must be a finite number in the 0..1 interval.`,
      { ...details, field, value },
    );
  }
}

export function defineLandingReadingPhases(definitions) {
  if (!Array.isArray(definitions) || definitions.length === 0) {
    throw createLandingJourneyContractError(
      '[LandingReadingJourney] phase definitions must be a non-empty array.',
      { definitions },
    );
  }

  const ids = new Set();
  let previousEnd = 0;
  const phases = definitions.map((definition, index) => {
    if (!definition || typeof definition !== 'object' || Array.isArray(definition)) {
      throw createLandingJourneyContractError(
        '[LandingReadingJourney] each phase definition must be an object.',
        { definition, index },
      );
    }

    const { id, start, end } = definition;
    if (typeof id !== 'string' || !PHASE_ID_PATTERN.test(id)) {
      throw createLandingJourneyContractError(
        '[LandingReadingJourney] each phase id must use lowercase snake_case.',
        { id, index },
      );
    }
    if (ids.has(id)) {
      throw createLandingJourneyContractError(
        `[LandingReadingJourney] duplicate phase id '${id}'.`,
        { id, index },
      );
    }

    assertUnitInterval(start, 'phase.start', { id, index });
    assertUnitInterval(end, 'phase.end', { id, index });
    if (end <= start) {
      throw createLandingJourneyContractError(
        `[LandingReadingJourney] phase '${id}' must have a positive range.`,
        { id, index, start, end },
      );
    }
    if (start !== previousEnd) {
      throw createLandingJourneyContractError(
        `[LandingReadingJourney] phase '${id}' must begin at the previous phase boundary.`,
        { id, index, previousEnd, start },
      );
    }

    ids.add(id);
    previousEnd = end;
    return Object.freeze({ id, start, end, duration: end - start });
  });

  if (previousEnd !== 1) {
    throw createLandingJourneyContractError(
      '[LandingReadingJourney] the final phase must end at journey progress 1.',
      { finalEnd: previousEnd },
    );
  }

  return Object.freeze(phases);
}

export const LANDING_READING_PHASES = defineLandingReadingPhases([
  { id: LANDING_READING_PHASE_IDS.THRESHOLD, start: 0, end: 0.10 },
  { id: LANDING_READING_PHASE_IDS.MANIFESTO, start: 0.10, end: 0.27 },
  { id: LANDING_READING_PHASE_IDS.FRICTION, start: 0.27, end: 0.43 },
  { id: LANDING_READING_PHASE_IDS.PAUSE, start: 0.43, end: 0.59 },
  { id: LANDING_READING_PHASE_IDS.REFLECTION, start: 0.59, end: 0.82 },
  { id: LANDING_READING_PHASE_IDS.INVITATION, start: 0.82, end: 1 },
]);

export function resolveLandingReadingPhase(globalProgress) {
  assertUnitInterval(globalProgress, 'globalProgress', {});

  const phase = globalProgress === 1
    ? LANDING_READING_PHASES[LANDING_READING_PHASES.length - 1]
    : LANDING_READING_PHASES.find((candidate) => (
      globalProgress >= candidate.start && globalProgress < candidate.end
    ));
  if (!phase) {
    throw createLandingJourneyContractError(
      '[LandingReadingJourney] progress is not owned by a reading phase range.',
      { globalProgress },
    );
  }

  return Object.freeze({
    phase: phase.id,
    phaseProgress: globalProgress === 1
      ? 1
      : (globalProgress - phase.start) / phase.duration,
  });
}
