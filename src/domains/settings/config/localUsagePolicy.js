import {
  DATA_COLLECTION_MODES,
  PRECISION_INSIGHTS_MODES,
  normalizeDataCollectionMode,
  normalizePrecisionInsightsMode,
  normalizePrecisionInsightsSignals,
  resolveInsightsConsentForDataCollectionMode,
  isDataCollectionConsentGranted,
} from './dataCollectionPolicy.js';
import { INSIGHTS_MODES } from './insightsMode.js';

const POLICY_KEYS = ['dataCollectionMode', 'precisionInsightsMode', 'precisionInsightsSignals'];

// Front-door intent only. Existing typed settings remain the persisted owners.
// Pausing records retains the selected signal/history preferences; admission
// still closes through dataCollectionMode + consent at every history boundary.
export function buildLocalUsagePolicyPatch(selection) {
  if (!selection || typeof selection !== 'object' || Array.isArray(selection)
    || Object.keys(selection).length !== POLICY_KEYS.length
    || POLICY_KEYS.some((key) => selection[key] == null)) {
    throw new Error('LOCAL_USAGE_POLICY_SELECTION_INVALID');
  }
  const dataCollectionMode = normalizeDataCollectionMode(selection.dataCollectionMode);
  const precisionInsightsMode = normalizePrecisionInsightsMode(selection.precisionInsightsMode);
  const precisionInsightsSignals = normalizePrecisionInsightsSignals(selection.precisionInsightsSignals);
  const recording = dataCollectionMode !== DATA_COLLECTION_MODES.OFF;
  const flowHistory = recording
    && precisionInsightsMode !== PRECISION_INSIGHTS_MODES.OFF
    && Object.values(precisionInsightsSignals).some(Boolean);
  return {
    dataCollectionMode,
    precisionInsightsMode,
    precisionInsightsSignals,
    insightsMode: !recording ? INSIGHTS_MODES.OFF
      : flowHistory ? INSIGHTS_MODES.PRECISION : INSIGHTS_MODES.BASIC,
    insightsConsent: resolveInsightsConsentForDataCollectionMode(dataCollectionMode),
  };
}

export function localUsagePolicyRequiresPrecisionPermission(policy) {
  return isDataCollectionConsentGranted(policy)
    && normalizePrecisionInsightsMode(policy.precisionInsightsMode) !== PRECISION_INSIGHTS_MODES.OFF
    && Object.values(normalizePrecisionInsightsSignals(policy.precisionInsightsSignals)).some(Boolean);
}
