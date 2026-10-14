import {
  getRuntimeId,
  runtimeSendMessageReliable,
} from '../../../../platform/chrome/ChromeService.js';
import {
  buildFeedFlowSnapshotMessage,
  FEED_FLOW_SNAPSHOT_DELIVERY_TIMEOUT_MS,
} from '../../../protection/contracts/feedFlowSnapshotBridge.js';
import { isFrictionDebugEnabled } from '@friction-debug-flags';
import {
  reportRuntimeDiagnostic,
} from '../../../../platform/diagnostics/runtimeDiagnosticConsole.js';

const TRANSIENT_DELIVERY_ERRORS = new Set([
  'RUNTIME_UNAVAILABLE',
  'TIMEOUT',
  'FEED_FLOW_SNAPSHOT_COMMIT_TIMEOUT',
  'FEED_FLOW_SNAPSHOT_COMMIT_QUEUE_POISONED',
]);

function resolveHost() {
  if (typeof window === 'undefined') return '';
  return window.location?.hostname || '';
}

function reportDeliveryFailure(errorCode, snapshotRevision) {
  if (!isFrictionDebugEnabled()) return;
  const normalizedError = String(errorCode || 'FEED_FLOW_SNAPSHOT_DELIVERY_FAILED');
  const normalizedRevision = Number(snapshotRevision) || null;
  if (TRANSIENT_DELIVERY_ERRORS.has(normalizedError)) {
    reportRuntimeDiagnostic({
      scope: 'FeedFlowSnapshot',
      severity: 'debug',
      event: 'delivery_dropped',
      code: normalizedError,
      fields: { snapshotRevision: normalizedRevision },
    });
    return;
  }
  reportRuntimeDiagnostic({
    scope: 'FeedFlowSnapshot',
    severity: 'warn',
    event: 'delivery_failed',
    code: normalizedError,
    fields: { snapshotRevision: normalizedRevision },
  });
}

export async function emitFeedFlowSnapshotUpdated({
  snapshot = null,
  onHistoryResetRequired = null,
} = {}) {
  if (!snapshot || typeof snapshot !== 'object') return false;
  if (!getRuntimeId()) return false;
  try {
    const delivery = await runtimeSendMessageReliable(
      buildFeedFlowSnapshotMessage({
        host: resolveHost(),
        snapshot,
      }),
      { timeoutMs: FEED_FLOW_SNAPSHOT_DELIVERY_TIMEOUT_MS },
    );
    if (!delivery?.ok) {
      throw new Error(delivery?.error || 'FEED_FLOW_SNAPSHOT_DELIVERY_FAILED');
    }
    if (delivery?.response?.success !== true) {
      throw new Error(delivery?.response?.error || 'FEED_FLOW_SNAPSHOT_COMMIT_NOT_ACKNOWLEDGED');
    }
    if (Object.hasOwn(delivery.response, 'feedHistoryResetAt')) {
      const resetAt = delivery.response.feedHistoryResetAt;
      if (!Number.isSafeInteger(resetAt) || resetAt < 0) {
        throw new Error('FEED_FLOW_HISTORY_RESET_ACK_INVALID');
      }
      if (onHistoryResetRequired !== null) {
        if (typeof onHistoryResetRequired !== 'function') {
          throw new Error('FEED_FLOW_HISTORY_RESET_CALLBACK_INVALID');
        }
        onHistoryResetRequired(resetAt);
      }
    }
    return true;
  } catch (error) {
    reportDeliveryFailure(
      error?.message || String(error || 'FEED_FLOW_SNAPSHOT_DELIVERY_FAILED'),
      snapshot?.snapshotRevision,
    );
    return false;
  }
}
