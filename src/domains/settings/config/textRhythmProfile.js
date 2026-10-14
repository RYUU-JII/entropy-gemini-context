import { FRICTION_INTENSITY_BANDS, requireFrictionIntensityBand } from './frictionIntensityBands.js';

function createShuffleProfile({
  enabled,
  distanceDistribution,
  innerWord = null,
  wordOrder = null,
}) {
  const resolvedWordOrder = wordOrder || {
    enabled,
    distanceDistribution,
  };
  const resolvedInnerWord = innerWord || {
    enabled,
    intensity: enabled ? 0.5 : 0,
  };

  return Object.freeze({
    enabled,
    distanceDistribution: Object.freeze([...distanceDistribution]),
    protectInformationalTokens: true,
    wordOrder: Object.freeze({
      enabled: Boolean(resolvedWordOrder.enabled),
      distanceDistribution: Object.freeze([...resolvedWordOrder.distanceDistribution]),
    }),
    innerWord: Object.freeze({
      enabled: Boolean(resolvedInnerWord.enabled),
      intensity: Number(resolvedInnerWord.intensity ?? 0),
    }),
  });
}

const RELAXED_DISTANCE_DISTRIBUTION = Object.freeze([100, 0, 0, 0, 0, 0]);
const NORMAL_DISTANCE_DISTRIBUTION = Object.freeze([42, 22, 16, 10, 7, 3]);
const REINFORCED_DISTANCE_DISTRIBUTION = Object.freeze([8, 12, 17, 22, 23, 18]);

function createTextRhythmProfile({
  band,
  textOpacity,
  textBlur,
  shuffle,
}) {
  return Object.freeze({
    band,
    textOpacity,
    textBlur,
    shuffle,
  });
}

export const TEXT_RHYTHM_RUNTIME_PROFILES = Object.freeze({
  [FRICTION_INTENSITY_BANDS.RELAXED]: createTextRhythmProfile({
    band: FRICTION_INTENSITY_BANDS.RELAXED,
    textOpacity: 0.97,
    textBlur: '0.08px',
    shuffle: createShuffleProfile({
      enabled: false,
      distanceDistribution: RELAXED_DISTANCE_DISTRIBUTION,
      wordOrder: {
        enabled: false,
        distanceDistribution: RELAXED_DISTANCE_DISTRIBUTION,
      },
      innerWord: {
        enabled: false,
        intensity: 0.25,
      },
    }),
  }),
  [FRICTION_INTENSITY_BANDS.NORMAL]: createTextRhythmProfile({
    band: FRICTION_INTENSITY_BANDS.NORMAL,
    textOpacity: 0.93,
    textBlur: '0.16px',
    shuffle: createShuffleProfile({
      enabled: true,
      distanceDistribution: NORMAL_DISTANCE_DISTRIBUTION,
      wordOrder: {
        enabled: true,
        distanceDistribution: NORMAL_DISTANCE_DISTRIBUTION,
      },
      innerWord: {
        enabled: true,
        intensity: 0.5,
      },
    }),
  }),
  [FRICTION_INTENSITY_BANDS.REINFORCED]: createTextRhythmProfile({
    band: FRICTION_INTENSITY_BANDS.REINFORCED,
    textOpacity: 0.9,
    textBlur: '0.28px',
    shuffle: createShuffleProfile({
      enabled: true,
      distanceDistribution: REINFORCED_DISTANCE_DISTRIBUTION,
      wordOrder: {
        enabled: true,
        distanceDistribution: REINFORCED_DISTANCE_DISTRIBUTION,
      },
      innerWord: {
        enabled: true,
        intensity: 0.8,
      },
    }),
  }),
});

const PROFILE_FIELDS = Object.freeze([
  'band',
  'textOpacity',
  'textBlur',
  'shuffle',
]);
const SHUFFLE_FIELDS = Object.freeze([
  'enabled',
  'distanceDistribution',
  'protectInformationalTokens',
  'wordOrder',
  'innerWord',
]);
const WORD_ORDER_FIELDS = Object.freeze([
  'enabled',
  'distanceDistribution',
]);
const INNER_WORD_FIELDS = Object.freeze([
  'enabled',
  'intensity',
]);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasExactFields(value, expectedFields) {
  if (!isPlainObject(value)) return false;
  const actualFields = Object.keys(value).sort();
  const normalizedExpectedFields = [...expectedFields].sort();
  return actualFields.length === normalizedExpectedFields.length
    && actualFields.every((field, index) => field === normalizedExpectedFields[index]);
}

function isExactShuffleProfile(value, expected) {
  return hasExactFields(value, SHUFFLE_FIELDS)
    && value.enabled === expected.enabled
    && value.protectInformationalTokens === expected.protectInformationalTokens
    && Array.isArray(value.distanceDistribution)
    && value.distanceDistribution.length === expected.distanceDistribution.length
    && value.distanceDistribution.every((weight, index) => (
      Object.is(weight, expected.distanceDistribution[index])
    ))
    && hasExactFields(value.wordOrder, WORD_ORDER_FIELDS)
    && value.wordOrder.enabled === expected.wordOrder.enabled
    && Array.isArray(value.wordOrder.distanceDistribution)
    && value.wordOrder.distanceDistribution.length === expected.wordOrder.distanceDistribution.length
    && value.wordOrder.distanceDistribution.every((weight, index) => (
      Object.is(weight, expected.wordOrder.distanceDistribution[index])
    ))
    && hasExactFields(value.innerWord, INNER_WORD_FIELDS)
    && value.innerWord.enabled === expected.innerWord.enabled
    && Object.is(value.innerWord.intensity, expected.innerWord.intensity);
}

function isExactTextRhythmProfile(value, expected) {
  return hasExactFields(value, PROFILE_FIELDS)
    && PROFILE_FIELDS.every((field) => (
      field === 'shuffle'
        ? isExactShuffleProfile(value.shuffle, expected.shuffle)
        : Object.is(value[field], expected[field])
    ));
}

export function getTextRhythmRuntimeProfile(band = FRICTION_INTENSITY_BANDS.NORMAL) {
  return TEXT_RHYTHM_RUNTIME_PROFILES[requireFrictionIntensityBand(band)];
}

export function requireTextRhythmRuntimeProfile(value) {
  if (!isPlainObject(value)) {
    throw new Error('TEXT_RHYTHM_RUNTIME_PROFILE_INVALID');
  }
  const band = requireFrictionIntensityBand(value.band);
  const expected = TEXT_RHYTHM_RUNTIME_PROFILES[band];
  if (!isExactTextRhythmProfile(value, expected)) {
    throw new Error(`TEXT_RHYTHM_RUNTIME_PROFILE_CONTRACT_INVALID:${band}`);
  }
  return expected;
}

export function requireTextRhythmShuffleProfile(value) {
  const match = Object.values(TEXT_RHYTHM_RUNTIME_PROFILES)
    .map((profile) => profile.shuffle)
    .find((shuffleProfile) => isExactShuffleProfile(value, shuffleProfile));
  if (!match) {
    throw new Error('TEXT_RHYTHM_SHUFFLE_PROFILE_CONTRACT_INVALID');
  }
  return match;
}
