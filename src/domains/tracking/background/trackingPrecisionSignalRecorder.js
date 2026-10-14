import {
  isPrecisionInsightsSignalEnabledForHostname,
  PRECISION_INSIGHTS_SIGNAL_IDS,
} from '../../settings/config/dataCollectionPolicy.js';

function normalizeHostname(hostname) {
  return typeof hostname === 'string' ? hostname.trim().toLowerCase() : '';
}

function createPrecisionSignalRecorder({
  settingsService,
  statsCollector,
  shouldTrackHostname,
  signalId,
  record,
}) {
  return async ({ hostname, now = Date.now(), ...payload } = {}) => {
    const normalizedHostname = normalizeHostname(hostname);
    if (!normalizedHostname) return false;
    const settingsCache = settingsService.getSettingsCache();
    if (!shouldTrackHostname(normalizedHostname, settingsCache)) return false;
    if (!isPrecisionInsightsSignalEnabledForHostname(
      normalizedHostname,
      settingsCache,
      signalId,
    )) {
      return false;
    }
    return record(statsCollector, {
      hostname: normalizedHostname,
      ...payload,
      now,
    });
  };
}

export function createTrackingPrecisionSignalRecorder({
  settingsService,
  statsCollector,
  shouldTrackHostname,
} = {}) {
  return {
    recordNavigationIntent: createPrecisionSignalRecorder({
      settingsService,
      statsCollector,
      shouldTrackHostname,
      signalId: PRECISION_INSIGHTS_SIGNAL_IDS.NAVIGATION,
      record: (collector, payload) => collector.recordDomainNavigationIntent(payload),
    }),
    recordTabContext: createPrecisionSignalRecorder({
      settingsService,
      statsCollector,
      shouldTrackHostname,
      signalId: PRECISION_INSIGHTS_SIGNAL_IDS.NAVIGATION,
      record: (collector, payload) => collector.recordDomainTabContext(payload),
    }),
    recordContentFlow: createPrecisionSignalRecorder({
      settingsService,
      statsCollector,
      shouldTrackHostname,
      signalId: PRECISION_INSIGHTS_SIGNAL_IDS.CLSE,
      record: (collector, payload) => collector.recordDomainContentFlow(payload),
    }),
  };
}
