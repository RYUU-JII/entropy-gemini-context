import {
  CONTENT_FLOW_SIGNAL_KINDS,
  CONTENT_FLOW_SCROLL_SPIKE_MAX_BATCH_COUNT,
} from '../../../platform/messaging/contracts/contentFlowSignal.js';
import {
  CONTENT_FLOW_SIGNAL_DELIVERY_TIMEOUT_MS,
  canSendContentFlowSignals,
  sendContentFlowSignal,
} from '../core/telemetry.js';

export const SCROLL_SPIKE_AGGREGATION_WINDOW_MS = 10_000;
export const SCROLL_SPIKE_FAST_THRESHOLD_PX = 500;
export const SCROLL_SPIKE_MIN_THRESHOLD_PX = 200;
// Scheduling + ACK window for one normally scheduled partial batch only. This
// is not an unload-durability guarantee or a bound for every queued batch.
export const SCROLL_SPIKE_SINGLE_BATCH_MAX_UNACKNOWLEDGED_WINDOW_MS = (
  SCROLL_SPIKE_AGGREGATION_WINDOW_MS + CONTENT_FLOW_SIGNAL_DELIVERY_TIMEOUT_MS
);

export const SCROLL_SPIKE_MAX_PENDING_BATCHES = 8;

function requireTimestamp(value) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error('SCROLL_SPIKE_AGGREGATOR_OBSERVED_AT_INVALID');
  }
  return value;
}

function requireSpikeDelta(value) {
  if (!Number.isFinite(value) || value <= SCROLL_SPIKE_MIN_THRESHOLD_PX) {
    throw new Error('SCROLL_SPIKE_AGGREGATOR_DELTA_INVALID');
  }
  return value;
}

function resolveLocalHourBoundary(timestamp) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) {
    throw new Error('SCROLL_SPIKE_AGGREGATOR_HOUR_INVALID');
  }
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const hour = date.getHours();
  const hourStartAt = new Date(year, month, day, hour, 0, 0, 0).getTime();
  const hourEndAt = new Date(year, month, day, hour + 1, 0, 0, 0).getTime();
  if (
    !Number.isSafeInteger(hourStartAt)
    || !Number.isSafeInteger(hourEndAt)
    || timestamp < hourStartAt
    || timestamp >= hourEndAt
  ) {
    throw new Error('SCROLL_SPIKE_AGGREGATOR_HOUR_BOUNDARY_INVALID');
  }
  return {
    localDateId: (year * 10_000) + ((month + 1) * 100) + day,
    hourStartAt,
    hourEndAt,
  };
}

function resolveLocalDateId(timestamp) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) {
    throw new Error('SCROLL_SPIKE_AGGREGATOR_DATE_INVALID');
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
  console.warn?.('[ScrollSpikeSignalAggregator] aggregation failed', {
    error: error?.message || String(error || 'SCROLL_SPIKE_AGGREGATION_FAILED'),
    ...details,
  });
}

export function createScrollSpikeSignalAggregator({
  sendSignal = (measurement) => sendContentFlowSignal(
    CONTENT_FLOW_SIGNAL_KINDS.SCROLL_SPIKE,
    measurement,
  ),
  isEnabled = canSendContentFlowSignals,
  now = () => Date.now(),
  setTimer = (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimer = (timerId) => clearTimeout(timerId),
  documentRef,
  windowRef,
  aggregationWindowMs = SCROLL_SPIKE_AGGREGATION_WINDOW_MS,
  initialAdmissionEnabled = false,
} = {}) {
  if (typeof sendSignal !== 'function') {
    throw new Error('SCROLL_SPIKE_AGGREGATOR_SEND_OWNER_REQUIRED');
  }
  if (typeof isEnabled !== 'function') {
    throw new Error('SCROLL_SPIKE_AGGREGATOR_CAPABILITY_OWNER_REQUIRED');
  }
  if (!Number.isSafeInteger(aggregationWindowMs) || aggregationWindowMs <= 0) {
    throw new Error('SCROLL_SPIKE_AGGREGATOR_WINDOW_INVALID');
  }

  const resolvedDocument = resolveDocumentRef(documentRef);
  const resolvedWindow = resolveWindowRef(windowRef);
  const pendingBuckets = [];
  let lifecycleActive = false;
  let listenersAttached = false;
  let admissionEnabled = initialAdmissionEnabled === true;
  let timerId = null;
  let flushPromise = null;
  let drainRequested = false;
  let deliveredBatchCount = 0;
  let rejectedBatchCount = 0;
  let discardedScrollSpikeBursts = 0;
  let capacityDroppedScrollSpikeBursts = 0;
  let capacityWarningReported = false;
  let localHourBoundaryResolutionCount = 0;

  function clearScheduledFlush() {
    if (timerId === null) return;
    clearTimer(timerId);
    timerId = null;
  }

  function scheduleFlush() {
    if (
      !lifecycleActive
      || !admissionEnabled
      || timerId !== null
      || flushPromise
      || pendingBuckets.length === 0
    ) return;
    timerId = setTimer(() => {
      timerId = null;
      void requestFlush();
    }, aggregationWindowMs);
  }

  async function deliverBucket(bucket) {
    let delivered = false;
    try {
      const flushedAt = requireTimestamp(now());
      // The stats runtime rejects historical writes after its local-day
      // rollover. Preserve the observed hour within a day, but rebase a batch
      // that actually waited past midnight; its aggregate counts stay exact.
      const deliveryObservedAt = resolveLocalDateId(flushedAt) === bucket.localDateId
        ? bucket.observedAt
        : flushedAt;
      delivered = await sendSignal({
        observedAt: deliveryObservedAt,
        scrollSpikeBursts: bucket.scrollSpikeBursts,
        fastScrollBursts: bucket.fastScrollBursts,
      }) === true;
    } catch (error) {
      reportAggregationFailure(error, {
        phase: 'delivery',
        scrollSpikeBursts: bucket.scrollSpikeBursts,
      });
    }
    if (delivered) deliveredBatchCount += 1;
    else rejectedBatchCount += 1;
    return delivered;
  }

  function requestFlush({ drain = false } = {}) {
    if (drain) drainRequested = true;
    clearScheduledFlush();
    if (flushPromise) return flushPromise;

    flushPromise = (async () => {
      let allDelivered = true;
      do {
        const bucket = pendingBuckets.shift();
        if (!bucket) break;
        if (pendingBuckets.length < SCROLL_SPIKE_MAX_PENDING_BATCHES) {
          capacityWarningReported = false;
        }
        allDelivered = await deliverBucket(bucket) && allDelivered;
      } while (drainRequested && pendingBuckets.length > 0);
      drainRequested = false;
      return allDelivered;
    })().finally(() => {
      flushPromise = null;
      if (drainRequested && pendingBuckets.length > 0) {
        void requestFlush({ drain: true });
        return;
      }
      scheduleFlush();
    });

    return flushPromise;
  }

  function handleVisibilityChange() {
    if (resolvedDocument?.visibilityState === 'hidden') {
      void requestFlush({ drain: true });
    }
  }

  function handlePageExit() {
    // Browser teardown does not guarantee that an asynchronous runtime ACK can
    // settle. This is a bounded best-effort drain, never a durability claim.
    void requestFlush({ drain: true });
  }

  function attachLifecycleListeners() {
    if (
      listenersAttached
      || !lifecycleActive
      || !admissionEnabled
      || !isEnabled()
    ) return false;
    resolvedDocument?.addEventListener?.('visibilitychange', handleVisibilityChange, true);
    resolvedWindow?.addEventListener?.('pagehide', handlePageExit, true);
    resolvedWindow?.addEventListener?.('beforeunload', handlePageExit, true);
    listenersAttached = true;
    return true;
  }

  function detachLifecycleListeners() {
    if (!listenersAttached) return false;
    resolvedDocument?.removeEventListener?.('visibilitychange', handleVisibilityChange, true);
    resolvedWindow?.removeEventListener?.('pagehide', handlePageExit, true);
    resolvedWindow?.removeEventListener?.('beforeunload', handlePageExit, true);
    listenersAttached = false;
    return true;
  }

  function start() {
    if (lifecycleActive) return false;
    if (!isEnabled()) return false;
    lifecycleActive = true;
    attachLifecycleListeners();
    scheduleFlush();
    return true;
  }

  function record(deltaPx, { observedAt = now() } = {}) {
    if (!isEnabled() || !admissionEnabled) return false;
    const normalizedDelta = requireSpikeDelta(deltaPx);
    const timestamp = requireTimestamp(observedAt);
    if (!lifecycleActive) start();

    let bucket = pendingBuckets.at(-1);
    if (
      !bucket
      || timestamp < bucket.hourStartAt
      || timestamp >= bucket.hourEndAt
      || bucket.scrollSpikeBursts >= CONTENT_FLOW_SCROLL_SPIKE_MAX_BATCH_COUNT
    ) {
      if (pendingBuckets.length >= SCROLL_SPIKE_MAX_PENDING_BATCHES) {
        capacityDroppedScrollSpikeBursts += 1;
        if (!capacityWarningReported) {
          capacityWarningReported = true;
          reportAggregationFailure(
            new Error('SCROLL_SPIKE_AGGREGATOR_PENDING_CAPACITY_EXCEEDED'),
            { pendingBatches: pendingBuckets.length },
          );
        }
        return false;
      }
      // Boundary construction is cold-path work. Accepted spikes in the open
      // bucket use only the numeric range checks above.
      bucket = resolveLocalHourBoundary(timestamp);
      localHourBoundaryResolutionCount += 1;
      bucket.observedAt = timestamp;
      bucket.scrollSpikeBursts = 0;
      bucket.fastScrollBursts = 0;
      pendingBuckets.push(bucket);
    }

    if (!Number.isSafeInteger(bucket.scrollSpikeBursts + 1)) {
      throw new Error('SCROLL_SPIKE_AGGREGATOR_COUNT_OVERFLOW');
    }
    bucket.observedAt = timestamp;
    bucket.scrollSpikeBursts += 1;
    if (normalizedDelta >= SCROLL_SPIKE_FAST_THRESHOLD_PX) {
      bucket.fastScrollBursts += 1;
    }
    scheduleFlush();
    return true;
  }

  function setAdmissionEnabled(enabled) {
    const nextEnabled = enabled === true;
    if (admissionEnabled === nextEnabled) return false;
    admissionEnabled = nextEnabled;
    capacityWarningReported = false;
    if (admissionEnabled) {
      attachLifecycleListeners();
      scheduleFlush();
      return true;
    }

    clearScheduledFlush();
    discardedScrollSpikeBursts += pendingBuckets.reduce(
      (total, bucket) => total + bucket.scrollSpikeBursts,
      0,
    );
    pendingBuckets.length = 0;
    drainRequested = false;
    detachLifecycleListeners();
    return true;
  }

  function stop({ flush = true } = {}) {
    lifecycleActive = false;
    detachLifecycleListeners();
    clearScheduledFlush();
    return flush ? requestFlush({ drain: true }) : Promise.resolve(true);
  }

  function getDiagnostics() {
    return Object.freeze({
      started: lifecycleActive,
      listenersAttached,
      admissionEnabled,
      aggregationWindowMs,
      singleBatchMaxUnacknowledgedWindowMs:
        SCROLL_SPIKE_SINGLE_BATCH_MAX_UNACKNOWLEDGED_WINDOW_MS,
      maxBatchCount: CONTENT_FLOW_SCROLL_SPIKE_MAX_BATCH_COUNT,
      maxPendingBatches: SCROLL_SPIKE_MAX_PENDING_BATCHES,
      deliveryInFlight: flushPromise !== null,
      pendingBatches: pendingBuckets.length,
      pendingScrollSpikeBursts: pendingBuckets.reduce(
        (total, bucket) => total + bucket.scrollSpikeBursts,
        0,
      ),
      deliveredBatchCount,
      rejectedBatchCount,
      discardedScrollSpikeBursts,
      capacityDroppedScrollSpikeBursts,
      localHourBoundaryResolutionCount,
    });
  }

  return Object.freeze({
    start,
    stop,
    record,
    setAdmissionEnabled,
    flush: requestFlush,
    getDiagnostics,
  });
}

export const scrollSpikeSignalAggregator = createScrollSpikeSignalAggregator();

export default scrollSpikeSignalAggregator;
