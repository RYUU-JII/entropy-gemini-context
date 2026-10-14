import {
  isPrecisionInsightsSignalEnabledForHostname,
  PRECISION_INSIGHTS_SIGNAL_IDS,
} from '../../../../domains/settings/config/dataCollectionPolicy.js';
import {
  isTrustedExtensionTabSender,
  resolveSenderDocumentId,
  resolveSenderFrameId,
  resolveSenderPageUrl,
} from '../../../../platform/security/senderTrust.js';

export function createFeedTempoHistoryAdmission({ settingsService, browserPort }) {
  const workerEpoch = crypto.randomUUID();
  for (const method of ['getSettingsCache', 'getSettingsChangeVersion']) {
    if (typeof settingsService?.[method] !== 'function') {
      throw new Error(`FEED_TEMPO_HISTORY_SETTINGS_OWNER_REQUIRED:${method}`);
    }
  }
  if (typeof browserPort?.webNavigationGetFrame !== 'function') {
    throw new Error('FEED_TEMPO_HISTORY_DOCUMENT_OWNER_REQUIRED');
  }
  return async (sender, { historyAdmission = null, requireAdmission = false } = {}) => {
    const documentId = resolveSenderDocumentId(sender);
    if (!isTrustedExtensionTabSender(sender) || resolveSenderFrameId(sender) !== 0 || !documentId) {
      throw new Error('FEED_TEMPO_HISTORY_TRUSTED_DOCUMENT_REQUIRED');
    }
    const url = new URL(resolveSenderPageUrl(sender));
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('FEED_TEMPO_HISTORY_WEB_DOCUMENT_REQUIRED');
    }
    const hostname = url.hostname;
    const settingsVersion = settingsService.getSettingsChangeVersion();
    if (!Number.isSafeInteger(settingsVersion) || settingsVersion < 0) {
      throw new Error('FEED_TEMPO_HISTORY_SETTINGS_VERSION_INVALID');
    }
    // Returned only by an admitted restore; never persisted. A worker restart,
    // setting change, or document change invalidates a delayed commit request.
    const currentAdmission = JSON.stringify([workerEpoch, settingsVersion, documentId]);
    if (requireAdmission && historyAdmission !== currentAdmission) {
      throw new Error('FEED_TEMPO_HISTORY_ADMISSION_EXPIRED');
    }
    const assertCommitAllowed = () => {
      if (settingsService.getSettingsChangeVersion() !== settingsVersion) {
        throw new Error('FEED_TEMPO_HISTORY_POLICY_CHANGED');
      }
      if (!isPrecisionInsightsSignalEnabledForHostname(
        hostname, settingsService.getSettingsCache(), PRECISION_INSIGHTS_SIGNAL_IDS.CLSE,
      )) throw new Error('FEED_TEMPO_HISTORY_NOT_ALLOWED');
    };
    const assertCurrent = async () => {
      assertCommitAllowed();
      const frame = await browserPort.webNavigationGetFrame({ tabId: sender.tab.id, frameId: 0 });
      if (!frame || frame.documentId !== documentId || new URL(frame.url).hostname !== hostname) {
        throw new Error('FEED_TEMPO_HISTORY_DOCUMENT_CHANGED');
      }
      assertCommitAllowed();
    };
    await assertCurrent();
    return Object.freeze({ historyAdmission: currentAdmission, assertCurrent, assertCommitAllowed });
  };
}
