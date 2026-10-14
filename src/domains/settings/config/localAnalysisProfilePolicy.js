import {
  DATA_COLLECTION_MODES,
  PRECISION_INSIGHTS_MODES,
  normalizeDataCollectionMode,
  normalizePrecisionInsightsMode,
} from './dataCollectionPolicy.js';
import {
  INSIGHTS_CONSENT,
  INSIGHTS_MODES,
} from './insightsMode.js';

export const LOCAL_ANALYSIS_PROFILE_IDS = Object.freeze({
  RHYTHM_MAP: 'rhythm_map',
  PROTECTED_START: 'protected_start',
  CUSTOM: 'custom',
});

export const DEFAULT_LOCAL_ANALYSIS_PROFILE_ID = LOCAL_ANALYSIS_PROFILE_IDS.RHYTHM_MAP;

export const RECOMMENDED_LOCAL_ANALYSIS_PROFILE_PATCH = Object.freeze({
  dataCollectionMode: DATA_COLLECTION_MODES.ALL_SITES_MINIMAL,
  precisionInsightsMode: PRECISION_INSIGHTS_MODES.PROTECTED_SITES,
  insightsMode: INSIGHTS_MODES.PRECISION,
  insightsConsent: INSIGHTS_CONSENT.ALL_SITES,
});

const LOCAL_ANALYSIS_PROFILE_ID_SET = new Set(Object.values(LOCAL_ANALYSIS_PROFILE_IDS));

export function normalizeLocalAnalysisProfileId(
  value,
  fallback = DEFAULT_LOCAL_ANALYSIS_PROFILE_ID,
) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (LOCAL_ANALYSIS_PROFILE_ID_SET.has(normalized)) return normalized;
  return LOCAL_ANALYSIS_PROFILE_ID_SET.has(fallback)
    ? fallback
    : DEFAULT_LOCAL_ANALYSIS_PROFILE_ID;
}

export function buildLocalAnalysisProfilePatch(profileId) {
  const resolvedProfileId = normalizeLocalAnalysisProfileId(
    profileId,
    LOCAL_ANALYSIS_PROFILE_IDS.CUSTOM,
  );
  if (resolvedProfileId === LOCAL_ANALYSIS_PROFILE_IDS.RHYTHM_MAP) {
    return { ...RECOMMENDED_LOCAL_ANALYSIS_PROFILE_PATCH };
  }
  if (resolvedProfileId === LOCAL_ANALYSIS_PROFILE_IDS.PROTECTED_START) {
    return {
      dataCollectionMode: DATA_COLLECTION_MODES.PROTECTED_SITES,
      precisionInsightsMode: PRECISION_INSIGHTS_MODES.OFF,
      insightsMode: INSIGHTS_MODES.OFF,
      insightsConsent: INSIGHTS_CONSENT.PROTECTED_ONLY,
    };
  }
  throw new Error(`LOCAL_ANALYSIS_PROFILE_PATCH_UNSUPPORTED:${resolvedProfileId}`);
}

export function localAnalysisProfileRequiresPrecisionPermission(profileId) {
  const patch = buildLocalAnalysisProfilePatch(profileId);
  return patch.precisionInsightsMode !== PRECISION_INSIGHTS_MODES.OFF;
}

export function resolveLocalAnalysisProfileId(settings = {}) {
  const dataCollectionMode = normalizeDataCollectionMode(settings?.dataCollectionMode);
  const precisionInsightsMode = normalizePrecisionInsightsMode(settings?.precisionInsightsMode);

  if (
    dataCollectionMode === DATA_COLLECTION_MODES.ALL_SITES_MINIMAL
    && precisionInsightsMode === PRECISION_INSIGHTS_MODES.PROTECTED_SITES
  ) {
    return LOCAL_ANALYSIS_PROFILE_IDS.RHYTHM_MAP;
  }

  if (
    dataCollectionMode === DATA_COLLECTION_MODES.PROTECTED_SITES
    && precisionInsightsMode === PRECISION_INSIGHTS_MODES.OFF
  ) {
    return LOCAL_ANALYSIS_PROFILE_IDS.PROTECTED_START;
  }

  return LOCAL_ANALYSIS_PROFILE_IDS.CUSTOM;
}
