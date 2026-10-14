export const SITE_PULL_MINUTE_MS = 60_000;
export const SITE_PULL_NIGHT_HOURS = Object.freeze([22, 23, 0, 1, 2, 3, 4, 5]);
export const SITE_PULL_CORE_LATE_HOURS = Object.freeze([23, 0, 1, 2]);

export function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}

export function toCount(value) {
  return Math.max(0, Math.floor(toNumber(value)));
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function clamp01(value) {
  return clamp(Number(value) || 0, 0, 1);
}

export function smooth01(value, low, high) {
  const numeric = Number(value);
  const start = Number(low);
  const end = Number(high);
  if (!Number.isFinite(numeric) || !Number.isFinite(start) || !Number.isFinite(end)) return 0;
  if (end <= start) return numeric >= end ? 1 : 0;
  const t = clamp01((numeric - start) / (end - start));
  return t * t * (3 - (2 * t));
}

export function durationNorm(valueMs, lowMinutes, highMinutes) {
  return smooth01(toNumber(valueMs), lowMinutes * SITE_PULL_MINUTE_MS, highMinutes * SITE_PULL_MINUTE_MS);
}

export function ratioNorm(value, low, high) {
  return smooth01(Number(value) || 0, low, high);
}

export function average(values = []) {
  if (!Array.isArray(values) || values.length <= 0) return 0;
  return values.reduce((sum, value) => sum + toNumber(value), 0) / values.length;
}

export function standardDeviation(values = []) {
  if (!Array.isArray(values) || values.length <= 1) return 0;
  const mean = average(values);
  const variance = values.reduce((sum, value) => {
    const delta = toNumber(value) - mean;
    return sum + (delta * delta);
  }, 0) / values.length;
  return Math.sqrt(Math.max(0, variance));
}

export function sumHours(values = [], hours = []) {
  return hours.reduce((sum, hour) => sum + toNumber(values?.[hour]), 0);
}

export function maxRollingSum(values = [], windowSize = 3) {
  const safeValues = Array.isArray(values) ? values.map(toNumber) : [];
  if (safeValues.length <= 0) return 0;
  const safeWindowSize = Math.max(1, Math.min(safeValues.length, Math.floor(windowSize) || 1));
  let best = 0;
  for (let index = 0; index <= safeValues.length - safeWindowSize; index += 1) {
    const total = safeValues
      .slice(index, index + safeWindowSize)
      .reduce((sum, value) => sum + value, 0);
    best = Math.max(best, total);
  }
  return best;
}

export function hasHourlyData(featureVector) {
  return Array.isArray(featureVector?.todayHourly)
    && featureVector.todayHourly.length === 24
    && Array.isArray(featureVector?.habitHourly)
    && featureVector.habitHourly.length === 24;
}

export function countActiveHours(values = []) {
  return Array.isArray(values)
    ? values.filter((value) => toNumber(value) >= SITE_PULL_MINUTE_MS).length
    : 0;
}

export function countVisitHours(values = []) {
  return Array.isArray(values)
    ? values.filter((value) => Math.floor(toNumber(value)) > 0).length
    : 0;
}

export function sumVisits(values = []) {
  return Array.isArray(values)
    ? values.reduce((sum, value) => sum + toCount(value), 0)
    : 0;
}

export function maxValue(values = []) {
  return Array.isArray(values)
    ? values.reduce((best, value) => Math.max(best, toNumber(value)), 0)
    : 0;
}
