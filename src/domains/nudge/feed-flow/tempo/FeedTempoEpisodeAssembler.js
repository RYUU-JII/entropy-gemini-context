import { normalizeFeedFlowLoopSignals } from '../contracts/feedFlowLoopSignals.js';
import {
  FEED_TEMPO_DWELL_RETENTION_STRATEGY,
  FEED_TEMPO_EPISODE_VERSION,
  FEED_TEMPO_INTERVENTION_STATES,
  FEED_TEMPO_METRIC_GRAIN,
  FEED_TEMPO_RAPID_DWELL_THRESHOLD_MS,
  FEED_TEMPO_STATES,
  areFeedTempoSurfacesEqual,
  cloneFeedTempoEpisodeFact,
  createFeedTempoDwellDistribution,
  normalizeFeedTempoSurface,
  recordFeedTempoDwellInDistribution,
  requireFeedTempoCompletionReason,
  requireFeedTempoTimestamp,
  resolveFeedTempoMetricGrain,
  summarizeFeedTempoEpisodeFact,
} from './feedTempoContracts.js';

const DEFAULT_IDLE_TIMEOUT_MS = 30_000;
const DEFAULT_MINIMUM_DWELL_MS = 250;
const DEFAULT_MAXIMUM_DWELL_MS = 5 * 60 * 1000;
const DEFAULT_MAX_DWELL_SAMPLES = 64;
const MINIMUM_BASELINE_CONFIDENCE = 0.5;

function clamp01(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(1, numeric));
}

function normalizePositiveInteger(value, fallback, errorCode) {
  const numeric = Number(value);
  if (!Number.isSafeInteger(numeric) || numeric <= 0) {
    if (value === null || value === undefined) return fallback;
    throw new Error(errorCode);
  }
  return numeric;
}

function quantile(values, ratio) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const position = (sorted.length - 1) * ratio;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  if (lowerIndex === upperIndex) return sorted[lowerIndex];
  const weight = position - lowerIndex;
  return Math.round(
    (sorted[lowerIndex] * (1 - weight)) + (sorted[upperIndex] * weight),
  );
}

function cloneDwellDistribution(distribution) {
  return {
    ...distribution,
    exclusiveUpperBoundsMs: [...distribution.exclusiveUpperBoundsMs],
    counts: [...distribution.counts],
  };
}

function createEpisode(surface, event, ts, {
  minimumDwellMs,
  maximumDwellMs,
  interventionExposed,
}) {
  const loopSignals = normalizeFeedFlowLoopSignals(event?.loopSignals);
  const transitionCount = Math.max(1, Math.round(Number(event?.itemTransitionCount) || 1));
  const confidence = clamp01(event?.confidence);
  return {
    surface,
    startedAt: ts,
    lastAdvanceAt: ts,
    transitionCount,
    screenfulsConsumed: 0,
    dwellSamplesMs: [],
    eligibleDwellCount: 0,
    totalActiveDwellMs: 0,
    rapidDwellCount: 0,
    dwellDistribution: createFeedTempoDwellDistribution(),
    censoredDwellCount: 0,
    censoring: {
      belowMinimumCount: 0,
      aboveMaximumCount: 0,
      multiTransitionCount: 0,
      trailingCount: 0,
      trailingObservedDwellMs: 0,
    },
    dwellEligibility: {
      minimumInclusiveMs: minimumDwellMs,
      maximumInclusiveMs: maximumDwellMs,
    },
    confidenceTotal: confidence,
    confidenceSampleCount: 1,
    maximumBacktrackRatio: loopSignals.directionality.backtrackRatio,
    backwardIntentCount: loopSignals.directionality.backwardIntentCount,
    revisitCount: loopSignals.directionality.revisitCount,
    mediaEngagedMs: loopSignals.media.sustainedMediaWatchMs,
    interventionState: interventionExposed
      ? FEED_TEMPO_INTERVENTION_STATES.EXPOSED
      : FEED_TEMPO_INTERVENTION_STATES.UNASSISTED,
  };
}

function buildMeasurementSummary(episode, capacity) {
  const retainedCount = episode.dwellSamplesMs.length;
  const droppedCount = episode.eligibleDwellCount - retainedCount;
  const retainedActiveDwellMs = episode.dwellSamplesMs.reduce(
    (total, dwellMs) => total + dwellMs,
    0,
  );
  return {
    eligibleDwellCount: episode.eligibleDwellCount,
    censoredDwellCount: episode.censoredDwellCount,
    dwellEligibility: { ...episode.dwellEligibility },
    retention: {
      strategy: FEED_TEMPO_DWELL_RETENTION_STRATEGY,
      capacity,
      retainedCount,
      droppedCount,
      coverageRatio: episode.eligibleDwellCount > 0
        ? retainedCount / episode.eligibleDwellCount
        : 0,
    },
    censoring: { ...episode.censoring },
    dwellDistribution: cloneDwellDistribution(episode.dwellDistribution),
    retainedActiveDwellMs,
    totalActiveDwellMs: episode.totalActiveDwellMs,
    medianDwellMs: quantile(episode.dwellSamplesMs, 0.5),
    lowerQuartileDwellMs: quantile(episode.dwellSamplesMs, 0.25),
    upperQuartileDwellMs: quantile(episode.dwellSamplesMs, 0.75),
    rapidDwellThresholdMs: FEED_TEMPO_RAPID_DWELL_THRESHOLD_MS,
    rapidDwellCount: episode.rapidDwellCount,
    rapidDwellShare: episode.eligibleDwellCount > 0
      ? episode.rapidDwellCount / episode.eligibleDwellCount
      : 0,
  };
}

export class FeedTempoEpisodeAssembler {
  constructor({
    idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS,
    minimumDwellMs = DEFAULT_MINIMUM_DWELL_MS,
    maximumDwellMs = DEFAULT_MAXIMUM_DWELL_MS,
    maxDwellSamples = DEFAULT_MAX_DWELL_SAMPLES,
    now = () => Date.now(),
    setTimeoutFn = (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
    clearTimeoutFn = (timerId) => globalThis.clearTimeout(timerId),
    onEpisodeFinalized = null,
  } = {}) {
    if (typeof now !== 'function') {
      throw new Error('FEED_TEMPO_ASSEMBLER_CLOCK_REQUIRED');
    }
    if (typeof setTimeoutFn !== 'function' || typeof clearTimeoutFn !== 'function') {
      throw new Error('FEED_TEMPO_ASSEMBLER_TIMER_OWNER_REQUIRED');
    }
    if (onEpisodeFinalized !== null && typeof onEpisodeFinalized !== 'function') {
      throw new Error('FEED_TEMPO_EPISODE_OBSERVER_INVALID');
    }
    this._idleTimeoutMs = normalizePositiveInteger(
      idleTimeoutMs,
      DEFAULT_IDLE_TIMEOUT_MS,
      'FEED_TEMPO_IDLE_TIMEOUT_INVALID',
    );
    this._minimumDwellMs = normalizePositiveInteger(
      minimumDwellMs,
      DEFAULT_MINIMUM_DWELL_MS,
      'FEED_TEMPO_MINIMUM_DWELL_INVALID',
    );
    this._maximumDwellMs = normalizePositiveInteger(
      maximumDwellMs,
      DEFAULT_MAXIMUM_DWELL_MS,
      'FEED_TEMPO_MAXIMUM_DWELL_INVALID',
    );
    if (this._maximumDwellMs <= this._minimumDwellMs) {
      throw new Error('FEED_TEMPO_DWELL_RANGE_INVALID');
    }
    this._maxDwellSamples = normalizePositiveInteger(
      maxDwellSamples,
      DEFAULT_MAX_DWELL_SAMPLES,
      'FEED_TEMPO_DWELL_CAPACITY_INVALID',
    );
    this._now = now;
    this._setTimeout = setTimeoutFn;
    this._clearTimeout = clearTimeoutFn;
    this._onEpisodeFinalized = onEpisodeFinalized;
    this._active = false;
    this._interventionExposed = false;
    this._surface = null;
    this._visible = true;
    this._visibleSince = null;
    this._currentItemVisibleMs = 0;
    this._lastActivityAt = 0;
    this._mediaPlaying = false;
    this._idleTimer = null;
    this._idleDeadlineAt = 0;
    this._episode = null;
    this._lastEpisode = null;
    this._counters = this._createCounters();
  }

  start({
    surface,
    visibilityState = 'visible',
    now = this._now(),
  } = {}) {
    if (this._active) throw new Error('FEED_TEMPO_ASSEMBLER_ALREADY_ACTIVE');
    const ts = requireFeedTempoTimestamp(now);
    this._surface = normalizeFeedTempoSurface(surface);
    this._active = true;
    this._visible = visibilityState === 'visible';
    this._visibleSince = this._visible ? ts : null;
    this._currentItemVisibleMs = 0;
    this._lastActivityAt = ts;
    this._mediaPlaying = false;
    this._episode = null;
    this._lastEpisode = null;
    this._counters = this._createCounters();
    this._cancelIdleTimer();
    return this.getSnapshot();
  }

  setEpisodeObserver(observer = null) {
    if (observer !== null && typeof observer !== 'function') {
      throw new Error('FEED_TEMPO_EPISODE_OBSERVER_INVALID');
    }
    this._onEpisodeFinalized = observer;
  }

  stop({
    now = this._now(),
    reason = 'runtime_stop',
  } = {}) {
    if (!this._active) return null;
    const finalized = this.flush({ now, reason });
    this._cancelIdleTimer();
    this._active = false;
    this._interventionExposed = false;
    this._surface = null;
    this._visible = false;
    this._visibleSince = null;
    this._currentItemVisibleMs = 0;
    this._lastActivityAt = 0;
    this._mediaPlaying = false;
    return finalized;
  }

  setSurface(surface, {
    now = this._now(),
    reason = 'surface_change',
  } = {}) {
    const nextSurface = normalizeFeedTempoSurface(surface);
    const ts = requireFeedTempoTimestamp(now);
    if (!this._active) {
      this._surface = nextSurface;
      return null;
    }
    if (areFeedTempoSurfacesEqual(this._surface, nextSurface)) {
      this._surface = nextSurface;
      return null;
    }
    const finalized = this.flush({ now: ts, reason });
    this._surface = nextSurface;
    this._visibleSince = this._visible ? ts : null;
    this._currentItemVisibleMs = 0;
    this._lastActivityAt = ts;
    this._mediaPlaying = false;
    return finalized;
  }

  recordIntent(intent = {}) {
    if (!this._active) return this.getSnapshot();
    const ts = requireFeedTempoTimestamp(
      intent.ts ?? this._now(),
      'FEED_TEMPO_INTENT_TIMESTAMP_INVALID',
    );
    this._touchActivity(ts);
    return this.getSnapshot();
  }

  recordActivity(activity = {}) {
    if (!this._active) return this.getSnapshot();
    const ts = requireFeedTempoTimestamp(
      activity.ts ?? this._now(),
      'FEED_TEMPO_ACTIVITY_TIMESTAMP_INVALID',
    );
    const kind = typeof activity.kind === 'string' ? activity.kind : '';
    if (kind === 'media_play') {
      this._mediaPlaying = true;
      this._cancelIdleTimer();
    } else if (kind === 'media_pause') {
      this._mediaPlaying = false;
    }
    this._touchActivity(ts);
    return this.getSnapshot();
  }

  recordAdvance(event = {}) {
    if (!this._active) return this.getSnapshot();
    const rawTs = requireFeedTempoTimestamp(
      event.ts ?? this._now(),
      'FEED_TEMPO_ADVANCE_TIMESTAMP_INVALID',
    );
    const ts = this._lastActivityAt > 0
      ? Math.max(rawTs, this._lastActivityAt)
      : rawTs;
    if (event.direction && event.direction !== 'forward') return this.getSnapshot();
    const isPaged = this._surface?.surfaceMode === 'paged';
    const isContinuous = this._surface?.surfaceMode === 'continuous';
    if (!isPaged && !isContinuous) {
      this._touchActivity(ts);
      return this.getSnapshot();
    }

    if (isContinuous) {
      const screenfulDelta = Math.max(0, Number(event.screenfulDelta) || 0);
      const advanceTs = this._episode
        ? Math.max(ts, this._episode.lastAdvanceAt)
        : ts;
      this._counters.confirmedAdvanceCount += 1;
      if (!this._episode) {
        this._episode = createEpisode(this._surface, event, advanceTs, {
          minimumDwellMs: this._minimumDwellMs,
          maximumDwellMs: this._maximumDwellMs,
          interventionExposed: this._interventionExposed,
        });
        this._episode.screenfulsConsumed = screenfulDelta;
        this._visibleSince = this._visible ? advanceTs : null;
        this._currentItemVisibleMs = 0;
        this._touchActivity(advanceTs);
        return this.getSnapshot();
      }

      this._episode.screenfulsConsumed += screenfulDelta;
      const loopSignals = normalizeFeedFlowLoopSignals(event.loopSignals);
      this._episode.lastAdvanceAt = advanceTs;
      this._episode.confidenceTotal += clamp01(event.confidence);
      this._episode.confidenceSampleCount += 1;
      this._episode.maximumBacktrackRatio = Math.max(
        this._episode.maximumBacktrackRatio,
        loopSignals.directionality.backtrackRatio,
      );
      this._episode.backwardIntentCount = Math.max(
        this._episode.backwardIntentCount,
        loopSignals.directionality.backwardIntentCount,
      );
      this._episode.revisitCount = Math.max(
        this._episode.revisitCount,
        loopSignals.directionality.revisitCount,
      );
      this._episode.mediaEngagedMs = Math.max(
        this._episode.mediaEngagedMs,
        loopSignals.media.sustainedMediaWatchMs,
      );
      this._touchActivity(advanceTs);
      return this.getSnapshot();
    }

    const transitionCount = Math.max(0, Math.round(Number(event.itemTransitionCount) || 0));
    if (transitionCount <= 0) {
      this._touchActivity(ts);
      return this.getSnapshot();
    }
    const advanceTs = this._episode
      ? Math.max(ts, this._episode.lastAdvanceAt)
      : ts;

    this._counters.confirmedAdvanceCount += 1;
    if (!this._episode) {
      this._episode = createEpisode(this._surface, event, advanceTs, {
        minimumDwellMs: this._minimumDwellMs,
        maximumDwellMs: this._maximumDwellMs,
        interventionExposed: this._interventionExposed,
      });
      this._visibleSince = this._visible ? advanceTs : null;
      this._currentItemVisibleMs = 0;
      this._touchActivity(advanceTs);
      return this.getSnapshot();
    }

    const dwellMs = this._readCurrentVisibleDwell(advanceTs);
    if (
      transitionCount === 1
      && dwellMs >= this._minimumDwellMs
      && dwellMs <= this._maximumDwellMs
    ) {
      this._episode.eligibleDwellCount += 1;
      this._episode.totalActiveDwellMs += dwellMs;
      if (dwellMs < FEED_TEMPO_RAPID_DWELL_THRESHOLD_MS) {
        this._episode.rapidDwellCount += 1;
      }
      recordFeedTempoDwellInDistribution(this._episode.dwellDistribution, dwellMs);
      this._episode.dwellSamplesMs.push(dwellMs);
      if (this._episode.dwellSamplesMs.length > this._maxDwellSamples) {
        const droppedCount = this._episode.dwellSamplesMs.length
          - this._maxDwellSamples;
        this._episode.dwellSamplesMs.splice(
          0,
          droppedCount,
        );
        this._counters.droppedDwellCount += droppedCount;
      }
      this._counters.eligibleDwellCount += 1;
    } else {
      this._episode.censoredDwellCount += 1;
      this._counters.censoredDwellCount += 1;
      if (transitionCount !== 1) {
        this._episode.censoring.multiTransitionCount += 1;
      } else if (dwellMs < this._minimumDwellMs) {
        this._episode.censoring.belowMinimumCount += 1;
      } else {
        this._episode.censoring.aboveMaximumCount += 1;
      }
    }

    const loopSignals = normalizeFeedFlowLoopSignals(event.loopSignals);
    this._episode.lastAdvanceAt = advanceTs;
    this._episode.transitionCount += transitionCount;
    this._episode.confidenceTotal += clamp01(event.confidence);
    this._episode.confidenceSampleCount += 1;
    this._episode.maximumBacktrackRatio = Math.max(
      this._episode.maximumBacktrackRatio,
      loopSignals.directionality.backtrackRatio,
    );
    this._episode.backwardIntentCount = Math.max(
      this._episode.backwardIntentCount,
      loopSignals.directionality.backwardIntentCount,
    );
    this._episode.revisitCount = Math.max(
      this._episode.revisitCount,
      loopSignals.directionality.revisitCount,
    );
    this._episode.mediaEngagedMs = Math.max(
      this._episode.mediaEngagedMs,
      loopSignals.media.sustainedMediaWatchMs,
    );
    this._currentItemVisibleMs = 0;
    this._visibleSince = this._visible ? advanceTs : null;
    this._touchActivity(advanceTs);
    return this.getSnapshot();
  }

  setInterventionExposure(active, {
    now = this._now(),
  } = {}) {
    if (typeof active !== 'boolean') {
      throw new Error('FEED_TEMPO_INTERVENTION_EXPOSURE_INVALID');
    }
    requireFeedTempoTimestamp(now);
    this._interventionExposed = active;
    // Only a committed endpoint can taint observation. Release does not erase
    // the exposure, and later episodes remain exposed while the lease is held.
    if (active && this._episode) {
      this._episode.interventionState = FEED_TEMPO_INTERVENTION_STATES.EXPOSED;
    }
    return this.getSnapshot();
  }

  handleVisibilityChange({
    visibilityState,
    ts = this._now(),
  } = {}) {
    if (!this._active) return null;
    const now = requireFeedTempoTimestamp(ts, 'FEED_TEMPO_VISIBILITY_TIMESTAMP_INVALID');
    if (visibilityState === 'visible') {
      this._visible = true;
      this._visibleSince = now;
      this._lastActivityAt = now;
      this._scheduleIdleTimer(now);
      return null;
    }
    this._accumulateVisibleDwell(now);
    this._visible = false;
    this._visibleSince = null;
    this._mediaPlaying = false;
    return this.flush({ now, reason: 'visibility_hidden' });
  }

  flush({
    now = this._now(),
    reason = 'explicit_flush',
  } = {}) {
    const rawTs = requireFeedTempoTimestamp(now);
    const completionReason = requireFeedTempoCompletionReason(reason);
    this._cancelIdleTimer();
    if (!this._episode) return null;
    const ts = Math.max(rawTs, this._episode.lastAdvanceAt, this._lastActivityAt);
    this._accumulateVisibleDwell(ts);
    this._episode.censoring.trailingCount += 1;
    this._episode.censoring.trailingObservedDwellMs = this._readCurrentVisibleDwell(ts);
    this._episode.censoredDwellCount += 1;
    this._counters.censoredDwellCount += 1;

    const dwellSamplesMs = [...this._episode.dwellSamplesMs];
    const measurement = buildMeasurementSummary(this._episode, this._maxDwellSamples);
    const measurementConfidence = this._episode.confidenceSampleCount > 0
      ? clamp01(this._episode.confidenceTotal / this._episode.confidenceSampleCount)
      : 0;
    const isContinuous = this._episode.surface.surfaceMode === 'continuous';
    const eligibleForObservedBaseline = isContinuous
      ? (
          this._episode.screenfulsConsumed >= 1.0
          && measurementConfidence >= MINIMUM_BASELINE_CONFIDENCE
          && this._episode.interventionState === FEED_TEMPO_INTERVENTION_STATES.UNASSISTED
        )
      : (
          this._episode.surface.surfaceMode === 'paged'
          && measurement.retention.retainedCount > 0
          && measurementConfidence >= MINIMUM_BASELINE_CONFIDENCE
          && this._episode.interventionState === FEED_TEMPO_INTERVENTION_STATES.UNASSISTED
        );
    const fact = Object.freeze({
      version: FEED_TEMPO_EPISODE_VERSION,
      metricGrain: resolveFeedTempoMetricGrain(this._episode.surface),
      surface: { ...this._episode.surface },
      startedAt: this._episode.startedAt,
      endedAt: ts,
      completionReason,
      interventionState: this._episode.interventionState,
      transitionCount: this._episode.transitionCount,
      screenfulsConsumed: isContinuous ? Number(this._episode.screenfulsConsumed.toFixed(3)) : 0,
      ...measurement,
      dwellSamplesMs: Object.freeze(dwellSamplesMs),
      transitionsPerMinute: measurement.totalActiveDwellMs > 0
        ? (measurement.eligibleDwellCount * 60_000) / measurement.totalActiveDwellMs
        : 0,
      backwardIntentCount: this._episode.backwardIntentCount,
      maximumBacktrackRatio: this._episode.maximumBacktrackRatio,
      revisitCount: this._episode.revisitCount,
      mediaEngagedMs: this._episode.mediaEngagedMs,
      measurementConfidence,
      eligibleForObservedBaseline,
    });

    this._lastEpisode = fact;
    this._episode = null;
    this._currentItemVisibleMs = 0;
    this._visibleSince = this._visible ? ts : null;
    this._lastActivityAt = ts;
    this._mediaPlaying = false;
    this._counters.finalizedEpisodeCount += 1;
    if (eligibleForObservedBaseline) {
      this._counters.baselineEligibleEpisodeCount += 1;
    } else {
      this._counters.baselineExcludedEpisodeCount += 1;
    }
    this._onEpisodeFinalized?.(cloneFeedTempoEpisodeFact(fact));
    return cloneFeedTempoEpisodeFact(fact);
  }

  getSnapshot() {
    const supported = ['paged', 'continuous'].includes(this._surface?.surfaceMode);
    const isContinuous = this._surface?.surfaceMode === 'continuous';
    const hasMeasurements = isContinuous
      ? (this._counters.confirmedAdvanceCount > 0 || (this._episode?.screenfulsConsumed ?? 0) > 0)
      : this._counters.eligibleDwellCount > 0;
    const state = !this._active || !supported
      ? FEED_TEMPO_STATES.INACTIVE
      : hasMeasurements
        ? FEED_TEMPO_STATES.MEASURED
        : this._episode
          ? FEED_TEMPO_STATES.INSUFFICIENT
          : FEED_TEMPO_STATES.ARMED_IDLE;
    return {
      state,
      active: this._active,
      supported,
      surface: this._surface ? { ...this._surface } : null,
      currentEpisode: this._buildCurrentEpisodeSummary(),
      lastEpisode: summarizeFeedTempoEpisodeFact(this._lastEpisode),
      counters: { ...this._counters },
      idleTimeoutMs: this._idleTimeoutMs,
      idleDeadlineAt: this._idleDeadlineAt,
    };
  }

  _touchActivity(ts) {
    const normalizedTs = this._lastActivityAt > 0
      ? Math.max(ts, this._lastActivityAt)
      : ts;
    this._lastActivityAt = normalizedTs;
    this._scheduleIdleTimer(normalizedTs);
  }

  _scheduleIdleTimer(ts) {
    this._cancelIdleTimer();
    if (!this._episode || !this._visible || this._mediaPlaying) return;
    const deadlineAt = ts + this._idleTimeoutMs;
    this._idleDeadlineAt = deadlineAt;
    this._idleTimer = this._setTimeout(() => {
      this._idleTimer = null;
      this._idleDeadlineAt = 0;
      if (!this._episode || !this._visible || this._mediaPlaying) return;
      if (this._lastActivityAt > ts) {
        this._scheduleIdleTimer(this._lastActivityAt);
        return;
      }
      this.flush({
        now: deadlineAt,
        reason: 'idle_timeout',
      });
    }, this._idleTimeoutMs);
  }

  _cancelIdleTimer() {
    if (this._idleTimer !== null) {
      this._clearTimeout(this._idleTimer);
      this._idleTimer = null;
    }
    this._idleDeadlineAt = 0;
  }

  _readCurrentVisibleDwell(ts) {
    let dwellMs = this._currentItemVisibleMs;
    if (this._visible && this._visibleSince !== null) {
      dwellMs += Math.max(0, ts - this._visibleSince);
    }
    return Math.max(0, Math.round(dwellMs));
  }

  _accumulateVisibleDwell(ts) {
    if (!this._visible || this._visibleSince === null) return;
    this._currentItemVisibleMs += Math.max(0, ts - this._visibleSince);
    this._visibleSince = ts;
  }

  _buildCurrentEpisodeSummary() {
    if (!this._episode) return null;
    const measurement = buildMeasurementSummary(this._episode, this._maxDwellSamples);
    return {
      surface: { ...this._episode.surface },
      startedAt: this._episode.startedAt,
      lastAdvanceAt: this._episode.lastAdvanceAt,
      transitionCount: this._episode.transitionCount,
      ...measurement,
      interventionState: this._episode.interventionState,
    };
  }

  _createCounters() {
    return {
      confirmedAdvanceCount: 0,
      eligibleDwellCount: 0,
      droppedDwellCount: 0,
      censoredDwellCount: 0,
      finalizedEpisodeCount: 0,
      baselineEligibleEpisodeCount: 0,
      baselineExcludedEpisodeCount: 0,
    };
  }
}

export default FeedTempoEpisodeAssembler;
