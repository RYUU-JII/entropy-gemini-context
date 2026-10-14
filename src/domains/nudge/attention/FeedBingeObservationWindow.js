import { normalizeFeedFlowLoopSignals } from '../feed-flow/contracts/feedFlowLoopSignals.js';

const DEFAULT_WINDOW_MS = 3 * 60 * 1000;
const DEFAULT_MAX_EVENTS = 96;
const DEFAULT_RAPID_GAP_MS = 8000;
const DEFAULT_SUPPLY_MAX_AGE_MS = 30000;

function normalizeNow(value, label) {
  const numeric = Math.round(Number(value));
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error(`${label}:${String(value)}`);
  }
  return numeric;
}

function normalizeCount(value) {
  const numeric = Math.round(Number(value));
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}

function normalizeNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, normalizeNumber(value)));
}

function median(values) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1] + sorted[middle]) / 2)
    : sorted[middle];
}

function sanitizeAdvanceEvent(event) {
  const ts = normalizeNow(event?.ts ?? Date.now(), 'FEED_BINGE_WINDOW_EVENT_TS_INVALID');
  const loopSignals = normalizeFeedFlowLoopSignals(event?.loopSignals);
  const direction = event?.direction === 'backward'
    ? 'backward'
    : (!event?.direction || event.direction === 'forward' ? 'forward' : 'ignored');
  return {
    ts,
    direction,
    surfaceMode: typeof event?.surfaceMode === 'string' && event.surfaceMode
      ? event.surfaceMode
      : loopSignals.context.surfaceMode,
    screenfulDelta: normalizeNumber(event?.screenfulDelta),
    itemTransitionCount: normalizeCount(event?.itemTransitionCount),
    freshItemsSeen: normalizeCount(event?.freshItemsSeen),
    confidence: clamp01(event?.confidence),
    context: loopSignals.context,
    intentionality: loopSignals.intentionality,
    media: {
      recentMediaPlayAt: loopSignals.media.recentMediaPlayAt,
      recentMediaPauseAt: loopSignals.media.recentMediaPauseAt,
    },
    directionality: loopSignals.directionality,
  };
}

function sanitizeSupplyReadout(readout, now) {
  const totalSteps = normalizeCount(readout?.totalSteps);
  const demandSteps = normalizeCount(readout?.demandSteps);
  return {
    observedAt: now,
    initialized: readout?.initialized === true,
    totalSteps,
    demandSteps,
    demandRatio: totalSteps > 0 ? clamp01(demandSteps / totalSteps) : 0,
    loopPressure: normalizeNumber(readout?.loopPressure),
    lastStepAt: normalizeNumber(readout?.lastStepAt),
    msSinceLastStep: readout?.msSinceLastStep !== null
      && readout?.msSinceLastStep !== undefined
      && Number.isFinite(Number(readout.msSinceLastStep))
      ? normalizeNumber(readout.msSinceLastStep)
      : null,
    lastDeltaPx: normalizeNumber(readout?.lastDeltaPx),
    lastThresholdPx: normalizeNumber(readout?.lastThresholdPx),
    lastBottomReachRatio: clamp01(readout?.lastBottomReachRatio),
    maxDepthRatio: clamp01(readout?.maxDepthRatio),
    pendingStep: readout?.pendingStep === true,
    cadenceSettling: readout?.cadenceSettling === true,
  };
}

export class FeedBingeObservationWindow {
  constructor({
    windowMs = DEFAULT_WINDOW_MS,
    maxEvents = DEFAULT_MAX_EVENTS,
    rapidGapMs = DEFAULT_RAPID_GAP_MS,
    supplyMaxAgeMs = DEFAULT_SUPPLY_MAX_AGE_MS,
  } = {}) {
    this._windowMs = Math.max(30000, Math.round(Number(windowMs) || DEFAULT_WINDOW_MS));
    this._maxEvents = Math.max(8, Math.round(Number(maxEvents) || DEFAULT_MAX_EVENTS));
    this._rapidGapMs = Math.max(1000, Math.round(Number(rapidGapMs) || DEFAULT_RAPID_GAP_MS));
    this._supplyMaxAgeMs = Math.max(
      1000,
      Math.round(Number(supplyMaxAgeMs) || DEFAULT_SUPPLY_MAX_AGE_MS),
    );
    this.reset();
  }

  reset() {
    this._events = [];
    this._backwardEvents = [];
    this._lastBackwardIntentCount = null;
    this._supply = null;
    this._startedAt = 0;
  }

  recordAdvance(event = {}) {
    const normalized = sanitizeAdvanceEvent(event);
    const previous = this._events.at(-1) || null;
    const surfaceChanged = previous && (
      previous.surfaceMode !== normalized.surfaceMode
      || previous.context.surfaceProfileId !== normalized.context.surfaceProfileId
      || previous.context.contentClass !== normalized.context.contentClass
    );
    if (surfaceChanged) {
      this._events = [];
      this._backwardEvents = [];
      this._lastBackwardIntentCount = null;
      this._startedAt = 0;
    }
    const cumulativeBackwardIntentCount = normalizeCount(
      normalized.directionality.backwardIntentCount,
    );
    const observedBackwardIntentDelta = this._lastBackwardIntentCount === null
      || cumulativeBackwardIntentCount < this._lastBackwardIntentCount
      ? 0
      : cumulativeBackwardIntentCount - this._lastBackwardIntentCount;
    if (observedBackwardIntentDelta > 0) {
      this._backwardEvents.push({
        ts: normalized.ts,
        count: observedBackwardIntentDelta,
      });
    }
    this._lastBackwardIntentCount = cumulativeBackwardIntentCount;
    if (normalized.direction !== 'forward') {
      if (normalized.direction === 'backward' && observedBackwardIntentDelta === 0) {
        this._backwardEvents.push({ ts: normalized.ts, count: 1 });
      }
      this._prune(normalized.ts);
      return this.getSnapshot({ now: normalized.ts });
    }
    if (this._startedAt <= 0) this._startedAt = normalized.ts;
    this._events.push(normalized);
    this._prune(normalized.ts);
    return this.getSnapshot({ now: normalized.ts });
  }

  recordSupplyReadout(readout = {}, { now = Date.now() } = {}) {
    const normalizedNow = normalizeNow(now, 'FEED_BINGE_WINDOW_SUPPLY_TS_INVALID');
    this._supply = sanitizeSupplyReadout(readout, normalizedNow);
    this._prune(normalizedNow);
    return this.getSnapshot({ now: normalizedNow });
  }

  getSnapshot({ now = Date.now() } = {}) {
    const normalizedNow = normalizeNow(now, 'FEED_BINGE_WINDOW_SNAPSHOT_TS_INVALID');
    this._prune(normalizedNow);
    const events = this._events;
    const first = events[0] || null;
    const last = events.at(-1) || null;
    const startedAt = events.length > 0
      ? Math.max(0, this._startedAt || first?.ts || 0)
      : 0;
    const gaps = [];
    for (let index = 1; index < events.length; index += 1) {
      gaps.push(Math.max(0, events[index].ts - events[index - 1].ts));
    }
    let rapidAdvanceStreak = events.length > 0 ? 1 : 0;
    for (let index = gaps.length - 1; index >= 0; index -= 1) {
      if (gaps[index] > this._rapidGapMs) break;
      rapidAdvanceStreak += 1;
    }
    const resumedSegmentStartIndex = events.length - rapidAdvanceStreak;
    const pauseStartedAt = resumedSegmentStartIndex > 0
      ? events[resumedSegmentStartIndex - 1].ts
      : 0;
    const pauseEndedAt = resumedSegmentStartIndex > 0
      ? events[resumedSegmentStartIndex].ts
      : 0;
    const interstitialBackwardAdvanceCount = pauseStartedAt > 0 && pauseEndedAt > pauseStartedAt
      ? this._backwardEvents.reduce(
        (sum, event) => (
          event.ts > pauseStartedAt && event.ts <= pauseEndedAt
            ? sum + normalizeCount(event.count)
            : sum
        ),
        0,
      )
      : 0;

    const screenfulsConsumed = events.reduce(
      (sum, event) => sum + event.screenfulDelta,
      0,
    );
    const itemTransitions = events.reduce(
      (sum, event) => sum + event.itemTransitionCount,
      0,
    );
    const freshItemsSeen = events.reduce(
      (sum, event) => sum + event.freshItemsSeen,
      0,
    );
    const confidence = events.length > 0
      ? events.reduce((sum, event) => sum + event.confidence, 0) / events.length
      : 0;
    const supply = this._supply
      && (normalizedNow - this._supply.observedAt) <= this._supplyMaxAgeMs
      ? this._supply
      : null;
    const loopSignals = normalizeFeedFlowLoopSignals({
      context: last?.context,
      progression: {
        burstDurationMs: last ? Math.max(0, last.ts - startedAt) : 0,
        advanceCount: events.length,
        rapidAdvanceStreak,
        screenfulsConsumed,
        itemTransitions,
        dominantAdvanceSource: last?.surfaceMode === 'paged' ? 'dominant_item' : 'screenful',
      },
      novelty: {
        freshItemsSeen,
        freshItemRate: events.length > 0 ? freshItemsSeen / events.length : 0,
      },
      rhythm: {
        medianDwellMs: median(gaps),
        maxPauseMs: gaps.length > 0 ? Math.max(...gaps) : 0,
      },
      intentionality: last?.intentionality,
      media: last?.media,
      supply,
    });

    return Object.freeze({
      source: 'enso_feed_observation_window',
      burstId: startedAt > 0 ? `enso_feed_window_${startedAt}` : '',
      startedAt,
      lastAdvanceAt: last?.ts || 0,
      surfaceMode: last?.surfaceMode || 'unknown',
      advanceCount: events.length,
      rapidAdvanceStreak,
      interstitialBackwardAdvanceCount,
      screenfulsConsumed: Number(screenfulsConsumed.toFixed(4)),
      itemTransitions,
      freshItemsSeen,
      medianDwellMs: median(gaps),
      maxPauseMs: gaps.length > 0 ? Math.max(...gaps) : 0,
      confidence: Number(confidence.toFixed(4)),
      loopSignals,
    });
  }

  _prune(now) {
    const cutoff = now - this._windowMs;
    const retained = this._events.filter((event) => event.ts >= cutoff && event.ts <= now);
    this._events = retained.slice(-this._maxEvents);
    const retainedBackwardEvents = this._backwardEvents.filter(
      (event) => event.ts >= cutoff && event.ts <= now,
    );
    this._backwardEvents = retainedBackwardEvents.slice(-this._maxEvents);
    if (this._events.length === 0) {
      this._startedAt = 0;
    } else if (this._startedAt <= 0) {
      this._startedAt = this._events[0].ts;
    } else if (this._startedAt < cutoff) {
      this._startedAt = cutoff;
    }
    if (this._supply && (now - this._supply.observedAt) > this._supplyMaxAgeMs) {
      this._supply = null;
    }
  }
}

export default FeedBingeObservationWindow;
