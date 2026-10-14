import {
  CANONICAL_CLICK_DELAY_PROFILE,
} from './canonicalBinaryFilterProfiles.js';

export const CLICK_DELAY_SPREAD_MS = CANONICAL_CLICK_DELAY_PROFILE.spreadMs;

function parseNumericValue(raw) {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const str = String(raw).trim().toLowerCase();
  if (!str) return null;
  const match = str.match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  let num = parseFloat(match[0]);
  if (!Number.isFinite(num)) return null;

  if (str.endsWith('%')) num /= 100;
  if (str.endsWith('em')) num *= 16;
  if (str.endsWith('s') && !str.endsWith('ms')) num *= 1000;

  return num;
}

function parseClickDelayMeanMs(value) {
  const numeric = parseNumericValue(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(0, Math.round(numeric));
}

export function resolveClickDelayDistribution(value = CANONICAL_CLICK_DELAY_PROFILE.delayMs) {
  const meanMs = parseClickDelayMeanMs(value);
  if (meanMs === null) {
    throw new Error('CLICK_DELAY_VALUE_INVALID');
  }
  const spreadMs = Math.min(meanMs, CLICK_DELAY_SPREAD_MS);

  return Object.freeze({
    meanMs,
    spreadMs,
    varianceMsSquared: Math.round((spreadMs * spreadMs) / 3),
    minMs: Math.max(0, meanMs - spreadMs),
    maxMs: meanMs + spreadMs,
  });
}

export function sampleClickDelayMs(distribution, random = Math.random) {
  const source = distribution && typeof distribution === 'object' && !Array.isArray(distribution)
    ? distribution
    : resolveClickDelayDistribution(distribution);
  const meanMs = parseClickDelayMeanMs(source.meanMs);
  const spreadMs = parseClickDelayMeanMs(source.spreadMs);
  if (meanMs === null || meanMs <= 0) return 0;
  if (spreadMs === null || spreadMs <= 0) return meanMs;

  const raw = typeof random === 'function' ? Number(random()) : Number(random);
  const unit = Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : 0.5;
  return Math.max(0, Math.round(meanMs + ((unit * 2) - 1) * spreadMs));
}

export function sampleClickPauseMs(distribution, random = Math.random) {
  const rawDelayMs = sampleClickDelayMs(distribution, random);
  if (rawDelayMs <= 0) return 0;
  // Preserve explicitly shorter inputs; project larger samples monotonically
  // into the perceptible pause window (600–900 ms for the canonical profile).
  if (rawDelayMs <= CANONICAL_CLICK_DELAY_PROFILE.minimumPauseMs) return rawDelayMs;
  return Math.round(Math.max(
    CANONICAL_CLICK_DELAY_PROFILE.minimumPauseMs,
    Math.min(
      CANONICAL_CLICK_DELAY_PROFILE.maximumPauseMs,
      rawDelayMs * CANONICAL_CLICK_DELAY_PROFILE.pauseScale,
    ),
  ));
}

function clampRatio(value, fallback = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(1, numeric));
}

export function formatCssRatio(value) {
  const rounded = Math.round(clampRatio(value) * 1000) / 1000;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/0+$/, '').replace(/\.$/, '');
}

export function getGrayscaleAmountFromSaturationValue(value) {
  return clampRatio(1 - clampRatio(value));
}
