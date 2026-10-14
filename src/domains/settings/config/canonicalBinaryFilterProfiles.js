export const CANONICAL_CLICK_DELAY_PROFILE = Object.freeze({
  delayMs: 1_200,
  spreadMs: 450,
  pauseScale: 0.625,
  minimumPauseMs: 600,
  maximumPauseMs: 900,
});

export const CANONICAL_SCROLL_FRICTION_PROFILE = Object.freeze({
  delayMs: 1_000,
  stage: 'light',
});

export const CANONICAL_BINARY_FILTER_VALUE_BY_KEY = Object.freeze({
  clickDelay: CANONICAL_CLICK_DELAY_PROFILE.delayMs,
  scrollFriction: CANONICAL_SCROLL_FRICTION_PROFILE.delayMs,
  fullscreenVisualRelaxation: true,
  textRhythm: true,
  inputVisualBrake: true,
});

const CANONICAL_BINARY_FILTER_KEY_SET = new Set(
  Object.keys(CANONICAL_BINARY_FILTER_VALUE_BY_KEY),
);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isCanonicalBinaryFilterKey(key) {
  return CANONICAL_BINARY_FILTER_KEY_SET.has(key);
}

export function getCanonicalBinaryFilterValue(key) {
  if (!isCanonicalBinaryFilterKey(key)) {
    throw new Error(`CANONICAL_BINARY_FILTER_KEY_UNKNOWN:${key || 'missing'}`);
  }
  return CANONICAL_BINARY_FILTER_VALUE_BY_KEY[key];
}

export function normalizeCanonicalBinaryFilterEntry(key, rawEntry, fallbackEntry = null) {
  const canonicalValue = getCanonicalBinaryFilterValue(key);
  const fallback = isPlainObject(fallbackEntry) ? fallbackEntry : {};
  const source = rawEntry === undefined ? fallback : rawEntry;

  if (!isPlainObject(source)) {
    throw new Error(`CANONICAL_BINARY_FILTER_ENTRY_INVALID:${key}`);
  }

  const invalidField = Object.keys(source).find((field) => !['isActive', 'value'].includes(field));
  if (invalidField) {
    throw new Error(`CANONICAL_BINARY_FILTER_ENTRY_FIELD_INVALID:${key}:${invalidField}`);
  }
  if (
    Object.prototype.hasOwnProperty.call(source, 'isActive')
    && typeof source.isActive !== 'boolean'
  ) {
    throw new Error(`CANONICAL_BINARY_FILTER_ACTIVE_INVALID:${key}`);
  }
  if (
    Object.prototype.hasOwnProperty.call(source, 'value')
    && !Object.is(source.value, canonicalValue)
  ) {
    throw new Error(`CANONICAL_BINARY_FILTER_VALUE_INVALID:${key}`);
  }

  return {
    isActive: typeof source.isActive === 'boolean'
      ? source.isActive
      : fallback.isActive === true,
    value: canonicalValue,
  };
}
