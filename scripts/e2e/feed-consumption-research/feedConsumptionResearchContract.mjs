export const FEED_CONSUMPTION_RESEARCH_TRACE_VERSION = 2;
export const FEED_CONSUMPTION_RESEARCH_JOURNEY_VERSION = 1;

export const FEED_CONSUMPTION_RESEARCH_SURFACE_MODES = Object.freeze([
  'paged',
  'continuous',
]);

export const FEED_CONSUMPTION_RESEARCH_JOURNEY_IDS = Object.freeze([
  'skim_forward',
  'steady_forward',
  'deliberate_watch',
  'burst_pause_burst',
  'revisit_deliberate',
]);

function freezeJourney(journey) {
  return Object.freeze({
    ...journey,
    supportedSurfaceModes: Object.freeze([...journey.supportedSurfaceModes]),
    steps: Object.freeze(journey.steps.map((step) => Object.freeze({ ...step }))),
  });
}

function advances(count, dwellMs, options = {}) {
  return Array.from({ length: count }, (_, index) => ({
    kind: 'advance',
    direction: 'forward',
    dwellMs,
    mediaEngaged: options.mediaEngaged === true,
    ordinal: index + 1,
  }));
}

const JOURNEYS = Object.freeze({
  skim_forward: freezeJourney({
    version: FEED_CONSUMPTION_RESEARCH_JOURNEY_VERSION,
    id: 'skim_forward',
    label: 'Fast forward-only skim',
    hypothesis: 'fast_forward_progression',
    supportedSurfaceModes: FEED_CONSUMPTION_RESEARCH_SURFACE_MODES,
    steps: advances(8, 1_500),
  }),
  steady_forward: freezeJourney({
    version: FEED_CONSUMPTION_RESEARCH_JOURNEY_VERSION,
    id: 'steady_forward',
    label: 'Steady forward-only consumption',
    hypothesis: 'steady_forward_progression',
    supportedSurfaceModes: FEED_CONSUMPTION_RESEARCH_SURFACE_MODES,
    steps: advances(8, 3_500),
  }),
  deliberate_watch: freezeJourney({
    version: FEED_CONSUMPTION_RESEARCH_JOURNEY_VERSION,
    id: 'deliberate_watch',
    label: 'Deliberate long-form item watching',
    hypothesis: 'deliberate_media_consumption',
    supportedSurfaceModes: FEED_CONSUMPTION_RESEARCH_SURFACE_MODES,
    steps: advances(6, 12_000, { mediaEngaged: true }),
  }),
  burst_pause_burst: freezeJourney({
    version: FEED_CONSUMPTION_RESEARCH_JOURNEY_VERSION,
    id: 'burst_pause_burst',
    label: 'Fast burst, deliberate pause, fast burst',
    hypothesis: 'interrupted_burst_progression',
    supportedSurfaceModes: FEED_CONSUMPTION_RESEARCH_SURFACE_MODES,
    steps: [
      ...advances(4, 1_500),
      { kind: 'pause', durationMs: 20_000, ordinal: 5 },
      ...advances(4, 1_500).map((step, index) => ({
        ...step,
        ordinal: index + 6,
      })),
    ],
  }),
  revisit_deliberate: freezeJourney({
    version: FEED_CONSUMPTION_RESEARCH_JOURNEY_VERSION,
    id: 'revisit_deliberate',
    label: 'Forward flow with bounded backtrack and revisit',
    hypothesis: 'directional_reconsideration',
    supportedSurfaceModes: FEED_CONSUMPTION_RESEARCH_SURFACE_MODES,
    steps: [
      ...advances(5, 2_500),
      {
        kind: 'advance',
        direction: 'backward',
        dwellMs: 2_500,
        mediaEngaged: false,
        ordinal: 6,
      },
      {
        kind: 'advance',
        direction: 'backward',
        dwellMs: 2_500,
        mediaEngaged: false,
        ordinal: 7,
      },
      ...advances(3, 2_500).map((step, index) => ({
        ...step,
        ordinal: index + 8,
      })),
    ],
  }),
});

function requireSurfaceMode(surfaceMode) {
  if (!FEED_CONSUMPTION_RESEARCH_SURFACE_MODES.includes(surfaceMode)) {
    throw new Error(
      `FEED_CONSUMPTION_RESEARCH_SURFACE_MODE_INVALID:${String(surfaceMode || '')}`,
    );
  }
  return surfaceMode;
}

export function getFeedConsumptionResearchJourney(journeyId, {
  surfaceMode = null,
} = {}) {
  const journey = JOURNEYS[journeyId];
  if (!journey) {
    throw new Error(
      `FEED_CONSUMPTION_RESEARCH_JOURNEY_UNKNOWN:${String(journeyId || '')}`,
    );
  }
  if (surfaceMode !== null) {
    requireSurfaceMode(surfaceMode);
    if (!journey.supportedSurfaceModes.includes(surfaceMode)) {
      throw new Error(
        `FEED_CONSUMPTION_RESEARCH_JOURNEY_SURFACE_UNSUPPORTED:${journeyId}:${surfaceMode}`,
      );
    }
  }
  return journey;
}

export function listFeedConsumptionResearchJourneys() {
  return FEED_CONSUMPTION_RESEARCH_JOURNEY_IDS.map((journeyId) => JOURNEYS[journeyId]);
}

export function normalizeFeedConsumptionResearchTimeScale(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0.25 || numeric > 4) {
    throw new Error(
      `FEED_CONSUMPTION_RESEARCH_TIME_SCALE_INVALID:${String(value)}`,
    );
  }
  return numeric;
}

export function normalizeFeedConsumptionResearchCandidateThreshold(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0.55 || numeric > 0.9) {
    throw new Error(
      `FEED_CONSUMPTION_RESEARCH_THRESHOLD_INVALID:${String(value)}`,
    );
  }
  return numeric;
}

export function normalizeFeedConsumptionResearchReferenceDwellMs(value) {
  const numeric = Number(value);
  if (!Number.isSafeInteger(numeric) || numeric < 3_750 || numeric > 6_250) {
    throw new Error(
      `FEED_CONSUMPTION_RESEARCH_REFERENCE_DWELL_INVALID:${String(value)}`,
    );
  }
  return numeric;
}

function normalizeResearchTimestamp(value, label, { optional = false } = {}) {
  if (optional && (value === null || value === undefined)) return null;
  const numeric = Math.round(Number(value));
  if (!Number.isSafeInteger(numeric) || numeric < 0) {
    throw new Error(`${label}:${String(value)}`);
  }
  return numeric;
}

export function resolveFeedConsumptionResearchCapturedAt({
  sampledAt,
  evidenceObservedAt = null,
  detectionEvaluatedAt = null,
  observationLastAdvanceAt = null,
} = {}) {
  const timestamps = [normalizeResearchTimestamp(
    sampledAt,
    'FEED_CONSUMPTION_RESEARCH_SAMPLED_AT_INVALID',
  )];
  [
    [evidenceObservedAt, 'FEED_CONSUMPTION_RESEARCH_EVIDENCE_TIME_INVALID'],
    [detectionEvaluatedAt, 'FEED_CONSUMPTION_RESEARCH_DETECTION_TIME_INVALID'],
    [observationLastAdvanceAt, 'FEED_CONSUMPTION_RESEARCH_OBSERVATION_TIME_INVALID'],
  ].forEach(([value, label]) => {
    const normalized = normalizeResearchTimestamp(value, label, { optional: true });
    if (normalized !== null) timestamps.push(normalized);
  });
  return Math.max(...timestamps);
}

function cloneOptionalObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? globalThis.structuredClone(value)
    : null;
}

export function createFeedConsumptionResearchCheckpoint({
  index,
  journeyId,
  surfaceMode,
  step,
  capturedAt,
  elapsedMs,
  driver = null,
  observation = null,
  sensorObservation = null,
  evidence = null,
  detection = null,
  consumptionProfile = null,
  feedDecision = null,
  admission = null,
  matureSessionAdmission = null,
  personalReference = null,
} = {}) {
  const normalizedIndex = Number(index);
  if (!Number.isSafeInteger(normalizedIndex) || normalizedIndex < 0) {
    throw new Error('FEED_CONSUMPTION_RESEARCH_CHECKPOINT_INDEX_INVALID');
  }
  getFeedConsumptionResearchJourney(journeyId, { surfaceMode });
  if (!step || typeof step !== 'object') {
    throw new Error('FEED_CONSUMPTION_RESEARCH_CHECKPOINT_STEP_REQUIRED');
  }
  const normalizedCapturedAt = Number(capturedAt);
  const normalizedElapsedMs = Number(elapsedMs);
  if (
    !Number.isSafeInteger(normalizedCapturedAt)
    || normalizedCapturedAt < 0
    || !Number.isSafeInteger(normalizedElapsedMs)
    || normalizedElapsedMs < 0
  ) {
    throw new Error('FEED_CONSUMPTION_RESEARCH_CHECKPOINT_TIME_INVALID');
  }
  return Object.freeze({
    version: FEED_CONSUMPTION_RESEARCH_TRACE_VERSION,
    index: normalizedIndex,
    journeyId,
    surfaceMode,
    capturedAt: normalizedCapturedAt,
    elapsedMs: normalizedElapsedMs,
    step: Object.freeze({ ...step }),
    driver: cloneOptionalObject(driver),
    observation: cloneOptionalObject(observation),
    sensorObservation: cloneOptionalObject(sensorObservation),
    model: Object.freeze({
      evidence: cloneOptionalObject(evidence),
      detection: cloneOptionalObject(detection),
      consumptionProfile: cloneOptionalObject(consumptionProfile),
      feedDecision: cloneOptionalObject(feedDecision),
      admission: cloneOptionalObject(admission),
      matureSessionAdmission: cloneOptionalObject(matureSessionAdmission),
      personalReference: cloneOptionalObject(personalReference),
    }),
  });
}
