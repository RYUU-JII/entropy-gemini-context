import {
  CONTENT_FLOW_SIGNAL_KINDS,
} from '../../../platform/messaging/contracts/contentFlowSignal.js';
import {
  canSendContentFlowSignals,
  sendContentFlowSignal,
} from '../core/telemetry.js';

export const SHORT_MEDIA_ATTENTION_AGGREGATION_WINDOW_MS = 1000;
export const SHORT_MEDIA_ATTENTION_MAX_PENDING_REPORTS = 10_000;
export const SHORT_MEDIA_ATTENTION_MAX_PENDING_BATCHES = 8;

function requireWatchMs(value) {
  const watchMs = Number(value);
  if (!Number.isFinite(watchMs) || watchMs <= 0) {
    throw new Error('SHORT_MEDIA_ATTENTION_AGGREGATOR_WATCH_MS_INVALID');
  }
  return watchMs;
}

function requireTimestamp(value) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error('SHORT_MEDIA_ATTENTION_AGGREGATOR_OBSERVED_AT_INVALID');
  }
  return value;
}

function resolveLocalDateId(timestamp) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) {
    throw new Error('SHORT_MEDIA_ATTENTION_AGGREGATOR_DATE_INVALID');
  }
  return (date.getFullYear() * 10_000) + ((date.getMonth() + 1) * 100) + date.getDate();
}

function resolveDocumentRef(documentRef) {
  if (typeof documentRef !== 'undefined') return documentRef;
  return typeof document !== 'undefined' ? document : null;
}

function resolveWindowRef(windowRef) {
  if (typeof windowRef !== 'undefined') return windowRef;
  return typeof window !== 'undefined' ? window : null;
}

function reportAggregationFailure(error, details = {}) {
  console.warn?.('[ShortMediaAttentionSignalAggregator] aggregation failed', {
    error: error?.message || String(error || 'SHORT_MEDIA_ATTENTION_AGGREGATION_FAILED'),
    ...details,
  });
}

export function createShortMediaAttentionSignalAggregator({
  sendSignal = (measurement) => sendContentFlowSignal(
    CONTENT_FLOW_SIGNAL_KINDS.SHORT_MEDIA_ATTENTION,
    measurement,
  ),
  isEnabled = canSendContentFlowSignals,
  now = () => Date.now(),
  setTimer = (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimer = (timerId) => clearTimeout(timerId),
  documentRef,
  windowRef,
  aggregationWindowMs = SHORT_MEDIA_ATTENTION_AGGREGATION_WINDOW_MS,
  maxPendingBatches = SHORT_MEDIA_ATTENTION_MAX_PENDING_BATCHES,
  initialAdmissionEnabled = false,
} = {}) {
  if (typeof sendSignal !== 'function') {
    throw new Error('SHORT_MEDIA_ATTENTION_AGGREGATOR_SEND_OWNER_REQUIRED');
  }
  if (typeof isEnabled !== 'function') {
    throw new Error('SHORT_MEDIA_ATTENTION_AGGREGATOR_CAPABILITY_OWNER_REQUIRED');
  }
  if (!Number.isSafeInteger(aggregationWindowMs) || aggregationWindowMs <= 0) {
    throw new Error('SHORT_MEDIA_ATTENTION_AGGREGATOR_WINDOW_INVALID');
  }
  if (!Number.isSafeInteger(maxPendingBatches) || maxPendingBatches <= 0) {
    throw new Error('SHORT_MEDIA_ATTENTION_AGGREGATOR_PENDING_BATCH_CAPACITY_INVALID');
  }

  const resolvedDocument = resolveDocumentRef(documentRef);
  const resolvedWindow = resolveWindowRef(windowRef);
  const completedBatches = [];
  let lifecycleActive = false;
  let listenersAttached = false;
  let admissionEnabled = initialAdmissionEnabled === true;
  let pendingAttentionSignals = 0;
  let pendingWatchMs = 0;
  let pendingObservedAt = null;
  let timerId = null;
  let flushPromise = null;
  let inFlightBatch = null;
  let deliveredBatchCount = 0;
  let rejectedBatchCount = 0;
  let discardedAttentionSignals = 0;
  let discardedWatchMs = 0;
  let capacityDroppedBatchCount = 0;
  let capacityDroppedReportCount = 0;
  let capacityDroppedAttentionSignals = 0;
  let capacityDroppedWatchMs = 0;
  let capacityWarningReported = false;

  function clearScheduledWindow() {
    if (timerId === null) return;
    clearTimer(timerId);
    timerId = null;
  }

  function reportCapacityDrop(batch, reason, { completedWindow = false } = {}) {
    if (completedWindow) capacityDroppedBatchCount += 1;
    else capacityDroppedReportCount += 1;
    capacityDroppedAttentionSignals += batch.attentionSignals;
    capacityDroppedWatchMs += batch.watchMs;
    if (capacityWarningReported) return;
    capacityWarningReported = true;
    reportAggregationFailure(
      new Error('SHORT_MEDIA_ATTENTION_AGGREGATOR_PENDING_CAPACITY_EXCEEDED'),
      {
        reason,
        pendingBatches: completedBatches.length,
        droppedAttentionSignals: batch.attentionSignals,
        droppedWatchMs: batch.watchMs,
      },
    );
  }

  function sealActiveWindow() {
    if (pendingAttentionSignals === 0) return false;
    const batch = {
      attentionSignals: pendingAttentionSignals,
      watchMs: pendingWatchMs,
      observedAt: pendingObservedAt,
      localDateId: resolveLocalDateId(pendingObservedAt),
    };
    pendingAttentionSignals = 0;
    pendingWatchMs = 0;
    pendingObservedAt = null;

    if (completedBatches.length >= maxPendingBatches) {
      reportCapacityDrop(batch, 'completed_batch_capacity', { completedWindow: true });
      return false;
    }
    completedBatches.push(batch);
    return true;
  }

  function scheduleWindowCompletion() {
    if (
      !lifecycleActive
      || !admissionEnabled
      || timerId !== null
      || pendingAttentionSignals === 0
    ) return;
    timerId = setTimer(() => {
      timerId = null;
      sealActiveWindow();
      void requestFlush({ sealActive: false });
    }, aggregationWindowMs);
  }

  async function deliverPendingBatch() {
    const batch = completedBatches.shift();
    if (!batch) return true;
    if (completedBatches.length < maxPendingBatches) {
      capacityWarningReported = false;
    }
    inFlightBatch = batch;

    let delivered = false;
    try {
      const flushedAt = requireTimestamp(now());
      const deliveryObservedAt = resolveLocalDateId(flushedAt) === batch.localDateId
        ? batch.observedAt
        : flushedAt;
      delivered = await sendSignal({
        observedAt: deliveryObservedAt,
        watchMs: batch.watchMs,
      }) === true;
    } catch (error) {
      reportAggregationFailure(error, {
        phase: 'delivery',
        attentionSignals: batch.attentionSignals,
        watchMs: batch.watchMs,
      });
    } finally {
      inFlightBatch = null;
    }
    if (delivered) deliveredBatchCount += 1;
    else rejectedBatchCount += 1;
    return delivered;
  }

  function requestFlush({ sealActive = true } = {}) {
    if (sealActive) {
      clearScheduledWindow();
      sealActiveWindow();
    }
    if (flushPromise) return flushPromise;
    if (completedBatches.length === 0) return Promise.resolve(true);

    // Keep the delivery owner serialized, while allowing the independent
    // window timer to keep sealing one-second batches behind a slow ACK.
    flushPromise = deliverPendingBatch();
    flushPromise = flushPromise.then(async (firstDelivered) => {
      let allDelivered = firstDelivered;
      while (completedBatches.length > 0) {
        allDelivered = await deliverPendingBatch() && allDelivered;
      }
      return allDelivered;
    }).finally(() => {
      flushPromise = null;
      if (completedBatches.length > 0) {
        void requestFlush({ sealActive: false });
      }
    });
    return flushPromise;
  }

  function handleVisibilityChange() {
    if (resolvedDocument?.visibilityState === 'hidden') {
      void requestFlush();
    }
  }

  function handlePageExit() {
    // Browser teardown cannot guarantee an asynchronous runtime ACK. Seal the
    // partial window and begin a bounded best-effort drain without retrying.
    void requestFlush();
  }

  function attachLifecycleListeners() {
    if (
      listenersAttached
      || !lifecycleActive
      || !admissionEnabled
      || !isEnabled()
    ) return false;
    const bindings = [
      [resolvedDocument, 'visibilitychange', handleVisibilityChange],
      [resolvedWindow, 'pagehide', handlePageExit],
      [resolvedWindow, 'beforeunload', handlePageExit],
    ];
    const applied = [];
    try {
      for (const [target, eventName, listener] of bindings) {
        if (typeof target?.addEventListener !== 'function') continue;
        target.addEventListener(eventName, listener, true);
        applied.push([target, eventName, listener]);
      }
      listenersAttached = applied.length > 0;
      return listenersAttached;
    } catch (error) {
      for (const [target, eventName, listener] of applied.reverse()) {
        try {
          target.removeEventListener?.(eventName, listener, true);
        } catch (rollbackError) {
          reportAggregationFailure(rollbackError, {
            phase: 'lifecycle_listener_attach_rollback',
            eventName,
          });
        }
      }
      reportAggregationFailure(error, { phase: 'lifecycle_listener_attach' });
      return false;
    }
  }

  function detachLifecycleListeners() {
    if (!listenersAttached) return false;
    const bindings = [
      [resolvedDocument, 'visibilitychange', handleVisibilityChange],
      [resolvedWindow, 'pagehide', handlePageExit],
      [resolvedWindow, 'beforeunload', handlePageExit],
    ];
    for (const [target, eventName, listener] of bindings) {
      try {
        target?.removeEventListener?.(eventName, listener, true);
      } catch (error) {
        reportAggregationFailure(error, {
          phase: 'lifecycle_listener_detach',
          eventName,
        });
      }
    }
    listenersAttached = false;
    return true;
  }

  function start() {
    if (lifecycleActive) return false;
    if (!isEnabled()) return false;
    lifecycleActive = true;
    attachLifecycleListeners();
    scheduleWindowCompletion();
    return true;
  }

  function record(watchMs, options = {}) {
    if (!isEnabled() || !admissionEnabled) return false;
    const normalizedWatchMs = requireWatchMs(watchMs);
    const observedAt = Object.prototype.hasOwnProperty.call(options, 'observedAt')
      ? options.observedAt
      : now();
    const timestamp = requireTimestamp(observedAt);
    if (!lifecycleActive) start();
    if (pendingAttentionSignals >= SHORT_MEDIA_ATTENTION_MAX_PENDING_REPORTS) {
      reportCapacityDrop({ attentionSignals: 1, watchMs: normalizedWatchMs }, 'active_window_capacity');
      return false;
    }
    const nextWatchMs = pendingWatchMs + normalizedWatchMs;
    if (!Number.isFinite(nextWatchMs)) {
      throw new Error('SHORT_MEDIA_ATTENTION_AGGREGATOR_WATCH_MS_OVERFLOW');
    }
    pendingAttentionSignals += 1;
    pendingWatchMs = nextWatchMs;
    pendingObservedAt = timestamp;
    scheduleWindowCompletion();
    return true;
  }

  function discardPendingState() {
    for (const batch of completedBatches) {
      pendingAttentionSignals += batch.attentionSignals;
      pendingWatchMs += batch.watchMs;
    }
    discardedAttentionSignals += pendingAttentionSignals;
    discardedWatchMs += pendingWatchMs;
    pendingAttentionSignals = 0;
    pendingWatchMs = 0;
    pendingObservedAt = null;
    completedBatches.length = 0;
  }

  function setAdmissionEnabled(enabled) {
    const nextEnabled = enabled === true;
    if (admissionEnabled === nextEnabled) return false;
    admissionEnabled = nextEnabled;
    capacityWarningReported = false;
    if (admissionEnabled) {
      attachLifecycleListeners();
      scheduleWindowCompletion();
      return true;
    }
    clearScheduledWindow();
    discardPendingState();
    detachLifecycleListeners();
    return true;
  }

  function stop({ flush = true } = {}) {
    lifecycleActive = false;
    detachLifecycleListeners();
    clearScheduledWindow();
    if (flush) return requestFlush();
    discardPendingState();
    return Promise.resolve(true);
  }

  function getDiagnostics() {
    const completedAttentionSignals = completedBatches.reduce(
      (total, batch) => total + batch.attentionSignals,
      0,
    );
    const completedWatchMs = completedBatches.reduce(
      (total, batch) => total + batch.watchMs,
      0,
    );
    return Object.freeze({
      started: lifecycleActive,
      listenersAttached,
      admissionEnabled,
      aggregationWindowMs,
      maxPendingReports: SHORT_MEDIA_ATTENTION_MAX_PENDING_REPORTS,
      maxPendingBatches,
      deliveryInFlight: inFlightBatch !== null,
      inFlightAttentionSignals: inFlightBatch?.attentionSignals || 0,
      inFlightWatchMs: inFlightBatch?.watchMs || 0,
      inFlightObservedAt: inFlightBatch?.observedAt || null,
      pendingBatches: completedBatches.length,
      activeAttentionSignals: pendingAttentionSignals,
      activeWatchMs: pendingWatchMs,
      activeObservedAt: pendingObservedAt,
      pendingAttentionSignals: pendingAttentionSignals + completedAttentionSignals,
      pendingWatchMs: pendingWatchMs + completedWatchMs,
      deliveredBatchCount,
      rejectedBatchCount,
      discardedAttentionSignals,
      discardedWatchMs,
      capacityDroppedBatchCount,
      capacityDroppedReportCount,
      capacityDroppedAttentionSignals,
      capacityDroppedWatchMs,
    });
  }

  return Object.freeze({
    start,
    record,
    setAdmissionEnabled,
    stop,
    flush: requestFlush,
    getDiagnostics,
  });
}

export const shortMediaAttentionSignalAggregator = createShortMediaAttentionSignalAggregator();

export default shortMediaAttentionSignalAggregator;
