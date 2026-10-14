import {
  CONTENT_FLOW_SIGNAL_KINDS,
  readContentFlowSignal,
} from '../../../../platform/messaging/contracts/contentFlowSignal.js';
import { requireFeedHistoryReceipt } from '../../contracts/feedContentFlowReceipt.js';
export {
  buildContentFlowStatsFromFeedSnapshot,
  buildContentFlowStatsFromFeedSnapshotDelta,
} from '../../contracts/feedContentFlowHistory.js';

function toCount(value) {
  const numeric = Math.floor(Number(value));
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}

function toPositiveNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}

function normalizeHost(hostname) {
  return typeof hostname === 'string' ? hostname.trim().toLowerCase() : '';
}

function requireFeedContentFlowSource(source = null, hostname = '') {
  const tabId = Number(source?.tabId);
  const documentId = typeof source?.documentId === 'string'
    ? source.documentId.trim()
    : '';
  const sourceHostname = normalizeHost(source?.hostname);
  const normalizedHostname = normalizeHost(hostname);
  if (!Number.isSafeInteger(tabId) || tabId < 0) {
    throw new Error('BEHAVIOR_TELEMETRY_FEED_SOURCE_TAB_ID_INVALID');
  }
  if (!documentId) {
    throw new Error('BEHAVIOR_TELEMETRY_FEED_SOURCE_DOCUMENT_ID_INVALID');
  }
  if (!sourceHostname || sourceHostname !== normalizedHostname) {
    throw new Error('BEHAVIOR_TELEMETRY_FEED_SOURCE_HOST_INVALID');
  }
  return {
    tabId,
    documentId,
    hostname: sourceHostname,
  };
}

function projectContentFlowStatsFromNormalizedSignal(signal) {
  if (signal.kind === CONTENT_FLOW_SIGNAL_KINDS.SCROLL_SPIKE) {
    return {
      scrollSpikeBursts: signal.scrollSpikeBursts,
      fastScrollBursts: signal.fastScrollBursts,
    };
  }
  if (signal.kind === CONTENT_FLOW_SIGNAL_KINDS.SHORT_MEDIA_ATTENTION) {
    const watchMs = toPositiveNumber(signal.watchMs);
    return {
      shortMediaAttentionSignals: 1,
      shortMediaWatchMs: watchMs,
    };
  }
  return null;
}

export function buildContentFlowStatsFromContentFlowSignal(value = null) {
  return projectContentFlowStatsFromNormalizedSignal(readContentFlowSignal(value));
}

export function hasContentFlowStats(stats = null) {
  if (!stats || typeof stats !== 'object') return false;
  return Object.values(stats).some((value) => toPositiveNumber(value) > 0);
}

function requireBehaviorTelemetryFunction(fn, errorCode) {
  if (typeof fn !== 'function') {
    throw new Error(errorCode);
  }
  return fn;
}

export function createBehaviorTelemetryRecorder({
  recordContentFlowStats,
} = {}) {
  const resolvedRecordContentFlowStats = requireBehaviorTelemetryFunction(
    recordContentFlowStats,
    'BEHAVIOR_TELEMETRY_RECORD_CONTENT_FLOW_REQUIRED',
  );

  async function recordContentFlowStatsPayload({ hostname, stats, now }) {
    if (!hostname || !hasContentFlowStats(stats)) return false;
    await resolvedRecordContentFlowStats({
      hostname,
      ...stats,
      now,
    });
    return true;
  }

  async function recordContentFlowSignal({ hostname, signal } = {}) {
    return recordContentFlowStatsPayload({
      hostname,
      // The runtime message handler is the canonical parse boundary and passes
      // the normalized DTO here. Avoid validating and cloning it twice more on
      // every hot-path signal.
      stats: projectContentFlowStatsFromNormalizedSignal(signal),
      now: signal.observedAt,
    });
  }

  async function recordContentFlowFromFeedSnapshot({
    hostname,
    source,
    history,
    now = Date.now(),
  } = {}) {
    const normalizedSource = requireFeedContentFlowSource(source, hostname);
    const feedHistory = requireFeedHistoryReceipt({
      ...history,
      documentId: normalizedSource.documentId,
      hostname: normalizedSource.hostname,
    });
    return resolvedRecordContentFlowStats({
      hostname: normalizedSource.hostname,
      feedHistory,
      now,
    });
  }

  return {
    recordContentFlowSignal,
    recordContentFlowFromFeedSnapshot,
  };
}
