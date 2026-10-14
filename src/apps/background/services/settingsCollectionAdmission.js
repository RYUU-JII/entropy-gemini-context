import { isDataCollectionConsentGranted } from '../../../domains/settings/config/dataCollectionPolicy.js';

// Canonical cache inputs used by domain-usage admission and protected-host
// classification. Comparison is worker-local; no copy is persisted or read as settings.
const COLLECTION_SCOPE_KEYS = [
  'dataCollectionMode', 'insightsConsent', 'trackingExcludedUrls',
  'blockedUrls', 'allowedUrls', 'siteGoals', 'protectionPresetAssignments',
  'filteringMode', 'relaxationSchedule', 'domainHmacSecret', 'blockedUrlHashes', 'allowedUrlHashes',
];
export function getSettingsCollectionScopeSignature(settings) {
  return JSON.stringify(COLLECTION_SCOPE_KEYS.map((key) => settings[key]));
}

// Positive proof of continuous domain-usage admission in this worker. A new
// hydration or an uncertain external mutation cannot certify earlier consent.
// This is not historical settings storage or a second settings writer.
export function createSettingsCollectionAdmission() {
  let enabled = false, observedSince = null, revision = 0, known = false, latestAt = 0, scopePending = false;
  function observeClock(now) {
    if (!Number.isSafeInteger(now) || now < 0) throw new Error('SETTINGS_COLLECTION_ADMISSION_TIME_INVALID');
    latestAt = Math.max(latestAt, now);
  }
  function invalidate(now) {
    observeClock(now);
    known = false; enabled = false; observedSince = null; scopePending = false; revision += 1;
  }
  function observe(settings, now) {
    observeClock(now);
    const nextEnabled = isDataCollectionConsentGranted(settings);
    if (!known || enabled !== nextEnabled) {
      revision += 1;
      observedSince = nextEnabled ? latestAt : null;
    }
    known = true; enabled = nextEnabled; scopePending = false;
  }
  function beforeChange(current, next, now) {
    if (isDataCollectionConsentGranted(current) !== isDataCollectionConsentGranted(next)) {
      invalidate(now);
      return true;
    }
    if (getSettingsCollectionScopeSignature(current) !== getSettingsCollectionScopeSignature(next)) {
      observeClock(now);
      scopePending = true;
      revision += 1;
      return true;
    }
    return false;
  }
  return { observe, invalidate, beforeChange,
    snapshot: () => Object.freeze({ enabled: enabled && !scopePending,
      observedSince: enabled && !scopePending ? observedSince : null, revision }) };
}
