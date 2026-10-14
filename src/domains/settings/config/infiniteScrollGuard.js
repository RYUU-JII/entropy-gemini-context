const DEFAULT_DISTANCE_THRESHOLD_PX = 3000;
const DEFAULT_WHEEL_VIEWPORT_RATIO = 0.8;
const DEFAULT_GUARD_COOLDOWN_MS = 10_000;
const DEFAULT_GUARD_CONTINUE_PASS_MS = 120_000;
const DEFAULT_GUARD_RELAPSE_WINDOW_MS = 180_000;
const DEFAULT_RUBBER_BAND_SPRING = 0.09;
const DEFAULT_RUBBER_BAND_DAMPING = 0.84;
const DEFAULT_RUBBER_BAND_IMPULSE = 0.055;

export const INFINITE_SCROLL_GUARD_LIMITS = Object.freeze({
  distanceThresholdPx: Object.freeze({
    min: 600,
    max: 12_000,
    step: 100,
  }),
  wheelViewportRatio: Object.freeze({
    min: 0,
    max: 1.5,
    step: 0.05,
  }),
  rubberBandSpring: Object.freeze({
    min: 0.03,
    max: 0.2,
    step: 0.005,
  }),
  rubberBandDamping: Object.freeze({
    min: 0.7,
    max: 0.95,
    step: 0.01,
  }),
  rubberBandImpulse: Object.freeze({
    min: 0.02,
    max: 0.12,
    step: 0.005,
  }),
});

export const DEFAULT_INFINITE_SCROLL_GUARD_VALUE = Object.freeze({
  distanceThresholdPx: DEFAULT_DISTANCE_THRESHOLD_PX,
  wheelViewportRatio: DEFAULT_WHEEL_VIEWPORT_RATIO,
  cooldownMs: DEFAULT_GUARD_COOLDOWN_MS,
  continuePassMs: DEFAULT_GUARD_CONTINUE_PASS_MS,
  relapseWindowMs: DEFAULT_GUARD_RELAPSE_WINDOW_MS,
  rubberBandSpring: DEFAULT_RUBBER_BAND_SPRING,
  rubberBandDamping: DEFAULT_RUBBER_BAND_DAMPING,
  rubberBandImpulse: DEFAULT_RUBBER_BAND_IMPULSE,
});

function toFiniteNumber(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function normalizeSteppedValue(value, fallback, limits) {
  const raw = toFiniteNumber(value, fallback);
  const rounded = Math.round(raw / limits.step) * limits.step;
  return clamp(rounded, limits.min, limits.max);
}

function normalizeCooldownMs(value) {
  return Math.max(
    1_000,
    Math.round(toFiniteNumber(value, DEFAULT_GUARD_COOLDOWN_MS)),
  );
}

function normalizePositiveMs(value, fallback) {
  return Math.max(0, Math.round(toFiniteNumber(value, fallback)));
}

/**
 * Normalizes only the persisted protection setting keyed by
 * `infiniteScrollGuard`.
 *
 * Enso Feed Horizon runtime tuning is intentionally owned by
 * `feed-flow/config/ensoFeedHorizonRuntimeConfig.js`; this storage seam does
 * not derive or normalize that runtime contract.
 */
export function normalizeInfiniteScrollGuardValue(rawValue) {
  const source = rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)
    ? rawValue
    : {};
  return {
    distanceThresholdPx: normalizeSteppedValue(
      source.distanceThresholdPx,
      DEFAULT_DISTANCE_THRESHOLD_PX,
      INFINITE_SCROLL_GUARD_LIMITS.distanceThresholdPx,
    ),
    wheelViewportRatio: normalizeSteppedValue(
      source.wheelViewportRatio,
      DEFAULT_WHEEL_VIEWPORT_RATIO,
      INFINITE_SCROLL_GUARD_LIMITS.wheelViewportRatio,
    ),
    cooldownMs: normalizeCooldownMs(source.cooldownMs),
    continuePassMs: normalizePositiveMs(
      source.continuePassMs,
      DEFAULT_GUARD_CONTINUE_PASS_MS,
    ),
    relapseWindowMs: normalizePositiveMs(
      source.relapseWindowMs,
      DEFAULT_GUARD_RELAPSE_WINDOW_MS,
    ),
    rubberBandSpring: normalizeSteppedValue(
      source.rubberBandSpring,
      DEFAULT_RUBBER_BAND_SPRING,
      INFINITE_SCROLL_GUARD_LIMITS.rubberBandSpring,
    ),
    rubberBandDamping: normalizeSteppedValue(
      source.rubberBandDamping,
      DEFAULT_RUBBER_BAND_DAMPING,
      INFINITE_SCROLL_GUARD_LIMITS.rubberBandDamping,
    ),
    rubberBandImpulse: normalizeSteppedValue(
      source.rubberBandImpulse,
      DEFAULT_RUBBER_BAND_IMPULSE,
      INFINITE_SCROLL_GUARD_LIMITS.rubberBandImpulse,
    ),
  };
}
