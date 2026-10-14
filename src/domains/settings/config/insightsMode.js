export const INSIGHTS_MODES = Object.freeze({
  OFF: 'off',
  BASIC: 'basic',
  PRECISION: 'precision',
});

export const INSIGHTS_CONSENT = Object.freeze({
  UNSET: 'unset',
  ALL_SITES: 'all_sites',
  PROTECTED_ONLY: 'protected_only',
  LATER: 'later',
});

export function normalizeInsightsMode(value, fallback = INSIGHTS_MODES.OFF) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (normalized === INSIGHTS_MODES.BASIC) return INSIGHTS_MODES.BASIC;
  if (normalized === INSIGHTS_MODES.PRECISION) return INSIGHTS_MODES.PRECISION;
  if (normalized === INSIGHTS_MODES.OFF) return INSIGHTS_MODES.OFF;
  return normalizeInsightsMode(fallback, INSIGHTS_MODES.OFF);
}

export function normalizeInsightsConsent(value, fallback = INSIGHTS_CONSENT.UNSET) {
  const candidate = value === null || typeof value === 'undefined' ? fallback : value;
  const normalized = typeof candidate === 'string' ? candidate.trim().toLowerCase() : '';
  if (normalized === INSIGHTS_CONSENT.ALL_SITES) return INSIGHTS_CONSENT.ALL_SITES;
  if (normalized === INSIGHTS_CONSENT.PROTECTED_ONLY) return INSIGHTS_CONSENT.PROTECTED_ONLY;
  if (normalized === INSIGHTS_CONSENT.LATER) return INSIGHTS_CONSENT.LATER;
  if (normalized === INSIGHTS_CONSENT.UNSET) return INSIGHTS_CONSENT.UNSET;
  throw new Error('INSIGHTS_CONSENT_UNSUPPORTED');
}

export function resolveTrackingScopeFromInsightsMode(value) {
  const normalized = normalizeInsightsMode(value, INSIGHTS_MODES.OFF);
  return normalized === INSIGHTS_MODES.OFF ? 'blocked' : 'all';
}

export function resolveInsightsModeFromTrackingScope(value, fallback = INSIGHTS_MODES.OFF) {
  const normalized = value === 'all' ? 'all' : value === 'blocked' ? 'blocked' : '';
  if (normalized === 'all') return INSIGHTS_MODES.BASIC;
  if (normalized === 'blocked') return INSIGHTS_MODES.OFF;
  return normalizeInsightsMode(fallback, INSIGHTS_MODES.OFF);
}
