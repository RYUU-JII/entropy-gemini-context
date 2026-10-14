import { isHostnameInList } from '../../../lib/index.js';
import { normalizeDomain } from '../../../lib/domain.js';
import {
  INSIGHTS_CONSENT,
  normalizeInsightsConsent,
} from './insightsMode.js';

export const DATA_COLLECTION_MODES = Object.freeze({
  OFF: 'off',
  PROTECTED_SITES: 'protected_sites',
  ALL_SITES_MINIMAL: 'all_sites_minimal',
});

export const PRECISION_INSIGHTS_MODES = Object.freeze({
  OFF: 'off',
  PROTECTED_SITES: 'protected_sites',
});

export const PRECISION_INSIGHTS_SIGNAL_IDS = Object.freeze({
  CLSE: 'clse',
  NAVIGATION: 'navigation',
});

export const DEFAULT_DATA_COLLECTION_MODE = DATA_COLLECTION_MODES.PROTECTED_SITES;
export const DEFAULT_PRECISION_INSIGHTS_MODE = PRECISION_INSIGHTS_MODES.OFF;
export const DEFAULT_PRECISION_INSIGHTS_SIGNALS = Object.freeze(
  Object.values(PRECISION_INSIGHTS_SIGNAL_IDS).reduce((signals, signalId) => {
    signals[signalId] = true;
    return signals;
  }, {}),
);

const DATA_COLLECTION_MODE_SET = new Set(Object.values(DATA_COLLECTION_MODES));
const PRECISION_INSIGHTS_MODE_SET = new Set(Object.values(PRECISION_INSIGHTS_MODES));
const PRECISION_INSIGHTS_SIGNAL_ID_SET = new Set(Object.values(PRECISION_INSIGHTS_SIGNAL_IDS));
function normalizeMode(value, modeSet, fallback, errorCode) {
  if (value === null || typeof value === 'undefined') return fallback;
  if (typeof value === 'string' && modeSet.has(value)) return value;
  throw new Error(errorCode);
}

function resolveCollectionConsent(value) {
  return normalizeInsightsConsent(value, INSIGHTS_CONSENT.UNSET);
}

export function normalizeDataCollectionMode(
  value,
  fallback = DEFAULT_DATA_COLLECTION_MODE,
) {
  return normalizeMode(
    value,
    DATA_COLLECTION_MODE_SET,
    DATA_COLLECTION_MODE_SET.has(fallback) ? fallback : DEFAULT_DATA_COLLECTION_MODE,
    'DATA_COLLECTION_MODE_UNSUPPORTED',
  );
}

export function normalizePrecisionInsightsMode(
  value,
  fallback = DEFAULT_PRECISION_INSIGHTS_MODE,
) {
  return normalizeMode(
    value,
    PRECISION_INSIGHTS_MODE_SET,
    PRECISION_INSIGHTS_MODE_SET.has(fallback) ? fallback : DEFAULT_PRECISION_INSIGHTS_MODE,
    'PRECISION_INSIGHTS_MODE_UNSUPPORTED',
  );
}

export function normalizePrecisionInsightsSignals(
  value,
  fallback = DEFAULT_PRECISION_INSIGHTS_SIGNALS,
) {
  const fallbackSource = fallback && typeof fallback === 'object' && !Array.isArray(fallback)
    ? fallback
    : DEFAULT_PRECISION_INSIGHTS_SIGNALS;
  if (value === null || typeof value === 'undefined') {
    return { ...fallbackSource };
  }
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : null;
  if (
    !source
    || Object.keys(source).length !== PRECISION_INSIGHTS_SIGNAL_ID_SET.size
    || Object.values(PRECISION_INSIGHTS_SIGNAL_IDS).some((signalId) => (
      !Object.prototype.hasOwnProperty.call(source, signalId)
      || typeof source[signalId] !== 'boolean'
    ))
  ) throw new Error('PRECISION_INSIGHTS_SIGNALS_INVALID');

  return Object.values(PRECISION_INSIGHTS_SIGNAL_IDS).reduce((signals, signalId) => {
    signals[signalId] = source[signalId];
    return signals;
  }, {});
}

export function isPrecisionInsightsSignalEnabled(settings = {}, signalId = '') {
  const normalizedSignalId = typeof signalId === 'string' ? signalId.trim().toLowerCase() : '';
  if (!PRECISION_INSIGHTS_SIGNAL_ID_SET.has(normalizedSignalId)) return true;
  const signals = normalizePrecisionInsightsSignals(settings?.precisionInsightsSignals);
  return signals[normalizedSignalId] !== false;
}

export function isProtectedCollectionHostname(hostname, settings = {}) {
  const domain = normalizeDomain(hostname);
  if (!domain) return false;
  if (isHostnameInList(domain, settings?.blockedUrls)) return true;
  if (settings?.siteGoals && Object.prototype.hasOwnProperty.call(settings.siteGoals, domain)) return true;
  if (
    settings?.protectionPresetAssignments?.sitePresetIds
    && Object.prototype.hasOwnProperty.call(settings.protectionPresetAssignments.sitePresetIds, domain)
  ) {
    return true;
  }
  return false;
}

export function isDataCollectionConsentGranted(settings = {}) {
  const mode = settings?.dataCollectionMode;
  if (!DATA_COLLECTION_MODE_SET.has(mode)) throw new Error('DATA_COLLECTION_MODE_UNSUPPORTED');
  const consent = resolveCollectionConsent(settings?.insightsConsent);
  if (mode === DATA_COLLECTION_MODES.OFF) return false;
  if (consent === INSIGHTS_CONSENT.ALL_SITES) return true;
  return mode === DATA_COLLECTION_MODES.PROTECTED_SITES
    && consent === INSIGHTS_CONSENT.PROTECTED_ONLY;
}

export function resolveInsightsConsentForDataCollectionMode(value) {
  if (!DATA_COLLECTION_MODE_SET.has(value)) throw new Error('DATA_COLLECTION_MODE_UNSUPPORTED');
  const mode = value;
  if (mode === DATA_COLLECTION_MODES.OFF) return INSIGHTS_CONSENT.LATER;
  if (mode === DATA_COLLECTION_MODES.ALL_SITES_MINIMAL) return INSIGHTS_CONSENT.ALL_SITES;
  return INSIGHTS_CONSENT.PROTECTED_ONLY;
}

export function shouldCollectDomainUsage(hostname, settings = {}) {
  return resolveDomainUsageRecording(hostname, settings).enabled;
}

// One admission decision is shared by collection, read models and time-based
// protection. Keeping a saved goal never grants permission to record usage.
export function resolveUsageRecordingScope(settings = {}) {
  const configuredMode = settings.dataCollectionMode;
  if (!DATA_COLLECTION_MODE_SET.has(configuredMode)) throw new Error('DATA_COLLECTION_MODE_UNSUPPORTED');
  const consentGranted = isDataCollectionConsentGranted({ ...settings, dataCollectionMode: configuredMode });
  return {
    configuredMode,
    effectiveScope: !consentGranted ? 'off'
      : configuredMode === DATA_COLLECTION_MODES.ALL_SITES_MINIMAL ? 'all_sites' : 'protected_sites',
    reason: configuredMode === DATA_COLLECTION_MODES.OFF ? 'mode_off'
      : !consentGranted ? 'consent_required' : 'recording',
  };
}

export function getProtectedCollectionDomains(settings = {}) {
  return Array.from(new Set([
    ...(settings.blockedUrls || []),
    ...Object.keys(settings.siteGoals || {}),
    ...Object.keys(settings.protectionPresetAssignments?.sitePresetIds || {}),
  ].map(normalizeDomain).filter(Boolean))).sort();
}

export function resolveDomainUsageRecording(hostname, settings = {}) {
  const domain = normalizeDomain(hostname);
  if (!domain) return { enabled: false, reason: 'outside_scope' };
  if (isHostnameInList(domain, settings.trackingExcludedUrls)) {
    return { enabled: false, reason: 'excluded' };
  }
  const scope = resolveUsageRecordingScope(settings);
  if (scope.effectiveScope === 'off') return { enabled: false, reason: scope.reason };
  if (scope.effectiveScope === 'all_sites' || isProtectedCollectionHostname(domain, settings)) {
    return { enabled: true, reason: 'recording' };
  }
  return { enabled: false, reason: 'outside_scope' };
}

export function resolveTimeCapAvailability(hostname, settings = {}) {
  if (!isProtectedCollectionHostname(hostname, settings)) return { available: false, reason: 'not_protected' };
  const recording = resolveDomainUsageRecording(hostname, settings);
  return { available: recording.enabled, reason: recording.enabled ? 'available' : recording.reason };
}

export function resolveSitesRecordingPolicy(settings = {}) {
  const scope = resolveUsageRecordingScope(settings);
  const protectedDomains = getProtectedCollectionDomains(settings);
  const excludedProtectedCount = protectedDomains.filter((domain) =>
    isHostnameInList(domain, settings.trackingExcludedUrls)
    || (settings.trackingExcludedUrls || []).some((excluded) => isHostnameInList(excluded, [domain]))).length;
  return {
    ...scope,
    globalCapAvailable: scope.effectiveScope !== 'off'
      && (protectedDomains.length === 0 || protectedDomains.some((domain) => resolveDomainUsageRecording(domain, settings).enabled)),
    excludedProtectedCount,
  };
}

export function isPrecisionInsightsEnabledForHostname(hostname, settings = {}) {
  const domain = normalizeDomain(hostname);
  if (!domain) return false;
  if (isHostnameInList(domain, settings?.trackingExcludedUrls)) return false;

  const mode = normalizePrecisionInsightsMode(settings?.precisionInsightsMode);
  if (mode === PRECISION_INSIGHTS_MODES.OFF) return false;
  if (!shouldCollectDomainUsage(domain, settings)) return false;

  const protectedDomain = isProtectedCollectionHostname(domain, settings);
  return mode === PRECISION_INSIGHTS_MODES.PROTECTED_SITES && protectedDomain;
}

export function isPrecisionInsightsSignalEnabledForHostname(
  hostname,
  settings = {},
  signalId = '',
) {
  if (!isPrecisionInsightsEnabledForHostname(hostname, settings)) return false;
  return isPrecisionInsightsSignalEnabled(settings, signalId);
}

export function resolveCollectionPolicySnapshot(settings = {}) {
  const dataCollectionMode = normalizeDataCollectionMode(settings?.dataCollectionMode);
  const precisionInsightsMode = normalizePrecisionInsightsMode(settings?.precisionInsightsMode);
  const precisionInsightsSignals = normalizePrecisionInsightsSignals(settings?.precisionInsightsSignals);
  const insightsConsent = resolveCollectionConsent(settings?.insightsConsent);

  return Object.freeze({
    dataCollectionMode,
    precisionInsightsMode,
    precisionInsightsSignals,
    insightsConsent,
  });
}
