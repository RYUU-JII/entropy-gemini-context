import {
  createEmptyFeedFlowLoopSignals,
  mergeFeedFlowLoopSignals,
} from '../contracts/feedFlowLoopSignals.js';

function createBurstId() {
  return `feed_burst_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

function createEpisodeId(sequence, ts) {
  return `feed_episode_${sequence}_${Math.max(0, Math.round(Number(ts) || Date.now()))}`;
}

function median(values = []) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
  }
  return sorted[middle];
}

function resolveDominantSource(sourceCounts = {}) {
  return Object.entries(sourceCounts).sort((left, right) => right[1] - left[1])[0]?.[0] || 'screenful';
}

function resolveFreshItemRate(freshItemsSeen, advanceCount) {
  const normalizedFreshItems = Math.max(0, Number(freshItemsSeen) || 0);
  const normalizedAdvanceCount = Math.max(1, Math.round(Number(advanceCount) || 1));
  return normalizedFreshItems / normalizedAdvanceCount;
}

function buildEmptyControlState() {
  return createEmptyFeedFlowLoopSignals().control;
}

function buildSupplySignals(readout = {}) {
  const totalSteps = Math.max(0, Math.round(Number(readout.totalSteps) || 0));
  const demandSteps = Math.max(0, Math.round(Number(readout.demandSteps) || 0));
  return {
    initialized: readout.initialized === true,
    totalSteps,
    demandSteps,
    demandRatio: totalSteps > 0 ? Math.min(1, demandSteps / totalSteps) : 0,
    loopPressure: Math.max(0, Number(readout.loopPressure) || 0),
    lastStepAt: Math.max(0, Math.round(Number(readout.lastStepAt) || 0)),
    msSinceLastStep: readout.msSinceLastStep != null && Number.isFinite(Number(readout.msSinceLastStep))
      ? Math.max(0, Math.round(Number(readout.msSinceLastStep)))
      : null,
    lastDeltaPx: Math.max(0, Number(readout.lastDeltaPx) || 0),
    lastThresholdPx: Math.max(0, Number(readout.lastThresholdPx) || 0),
    lastBottomReachRatio: Math.max(0, Math.min(1, Number(readout.lastBottomReachRatio) || 0)),
    maxDepthRatio: Math.max(0, Math.min(1, Number(readout.maxDepthRatio) || 0)),
    skewedSteps: Math.max(0, Math.round(Number(readout.skewedSteps) || 0)),
    lateConfirmedSteps: Math.max(0, Math.round(Number(readout.lateConfirmedSteps) || 0)),
    expiredPendingSteps: Math.max(0, Math.round(Number(readout.expiredPendingSteps) || 0)),
    pendingStep: readout.pendingStep === true,
    cadenceSettling: readout.cadenceSettling === true,
  };
}

// A burst closes after a few idle seconds; an episode only closes once the user
// has actually left the feed. Anything shorter would make the gate's time floor
// measure uninterrupted scrolling rather than time spent in the feed.
const EPISODE_IDLE_RESET_MS = 60_000;

// A burst only ends on an idle gap, so an unbroken scroll can run for an hour and
// the dwell array with it — while median() re-sorts the whole thing on every
// advance. Cap the window: the person scrolling longest is exactly the one this
// gate is built for, and they should not be the one paying for it.
//
// medianDwellMs therefore describes the recent rhythm rather than the whole
// burst, which is what its consumers — the binge rhythm channel and the paged
// dwell check — actually want from it.
const BURST_DWELL_SAMPLE_LIMIT = 128;

// Flicking faster does not consume more feed, it consumes the same feed less.
// Capping the rate keeps a rapid-fire scroller from reaching the dose target in
// a few seconds: past this rate, extra flicks stop counting as extra intake.
const DOSE_RATE_CAP_PER_SEC = 0.9;

// How much of a single gap between advances can count as time spent in the feed.
// Past the point where the dose curve flattens, more waiting is not more reading,
// so a long gap stops adding feed time even though the episode is still open.
const ACTIVE_GAP_CREDIT_MAX_MS = 25_000;

// Weight one item by how long the reader stayed on it. Both ends are low for the
// same reason: a sub-second flick is not consumption, and a long read is not a
// loop. Paged surfaces measure this per item; continuous surfaces have no
// per-item dwell, so they measure the time spent per screenful instead.
function itemDoseWeight(dwellSec) {
  if (dwellSec < 0.4) return 0.35;
  if (dwellSec < 1.2) return 0.35 + (0.45 * (dwellSec - 0.4) / 0.8);
  if (dwellSec < 4.0) return 0.80 + (0.20 * (dwellSec - 1.2) / 2.8);
  if (dwellSec < 10.0) return 1.00 - (0.45 * (dwellSec - 4.0) / 6.0);
  return 0.45;
}

function paceDoseWeight(paceSecPerScreenful) {
  if (paceSecPerScreenful < 1.0) return 0.35;
  if (paceSecPerScreenful < 3.0) return 0.35 + (0.45 * (paceSecPerScreenful - 1.0) / 2.0);
  if (paceSecPerScreenful < 10.0) return 0.80 + (0.20 * (paceSecPerScreenful - 3.0) / 7.0);
  if (paceSecPerScreenful < 25.0) return 1.00 - (0.45 * (paceSecPerScreenful - 10.0) / 15.0);
  return 0.45;
}

function resolveAdvanceDose(event, pauseMs, surfaceMode) {
  const elapsedSec = Math.max(1, pauseMs) / 1000;
  let raw = 0;
  if (surfaceMode === 'paged') {
    const transitions = Math.max(0, Math.round(Number(event.itemTransitionCount) || 0));
    if (transitions <= 0) return 0;
    raw = transitions * itemDoseWeight(elapsedSec);
  } else {
    const screenfuls = Math.max(0, Number(event.screenfulDelta) || 0);
    if (screenfuls <= 0) return 0;
    raw = screenfuls * paceDoseWeight(elapsedSec / screenfuls);
  }
  return Math.min(raw, DOSE_RATE_CAP_PER_SEC * elapsedSec);
}

function buildEmptyBurstState() {
  return {
    burstId: '',
    startedAt: 0,
    lastAdvanceAt: 0,
    surfaceMode: 'unknown',
    advanceCount: 0,
    rapidAdvanceStreak: 0,
    screenfulsConsumed: 0,
    itemTransitions: 0,
    freshItemsSeen: 0,
    medianDwellMs: null,
    maxPauseMs: 0,
    dominantAdvanceSource: 'screenful',
    confidence: 0,
    referenceNode: null,
    loopSignals: createEmptyFeedFlowLoopSignals(),
  };
}

export class FeedBurstMachine {
  constructor({
    idleResetMs = 5000,
    episodeIdleResetMs = EPISODE_IDLE_RESET_MS,
  } = {}) {
    this._idleResetMs = Math.max(0, Math.round(Number(idleResetMs) || 0));
    this._episodeIdleResetMs = Math.max(0, Math.round(Number(episodeIdleResetMs) || 0));
    this._controlState = buildEmptyControlState();
    this._episodeActiveMs = 0;
    this._episodeLastAdvanceAt = 0;
    this._episodeDose = 0;
    this._episodeFreshItems = 0;
    this._episodeSequence = 0;
    this._episodeId = '';
    this.reset();
  }

  reset({ preserveControl = true, preserveEpisode = preserveControl } = {}) {
    // A burst ends after `idleResetMs`, which is far shorter than a sitting.
    // Roll its active time into the episode so the accumulator survives the
    // pauses a reader takes; only a teardown clears the episode outright.
    if (preserveEpisode) {
      this._episodeActiveMs += this._completedBurstActiveMs();
    } else {
      this._episodeActiveMs = 0;
      this._episodeLastAdvanceAt = 0;
      this._episodeDose = 0;
      this._episodeFreshItems = 0;
      this._episodeId = '';
    }
    if (!preserveControl) {
      this._controlState = buildEmptyControlState();
    }
    this._state = 'idle';
    this._burst = buildEmptyBurstState();
    this._dwellSamples = [];
    this._sourceCounts = {};
  }

  clearInterventionControl() {
    this._controlState = buildEmptyControlState();
    this._state = this._burst.advanceCount > 0 ? 'tracking' : 'idle';
  }

  _completedBurstActiveMs() {
    const startedAt = this._burst?.startedAt ?? 0;
    const lastAdvanceAt = this._burst?.lastAdvanceAt ?? 0;
    return startedAt > 0 && lastAdvanceAt > startedAt ? lastAdvanceAt - startedAt : 0;
  }

  get episodeActiveMs() {
    return this._episodeActiveMs + this._completedBurstActiveMs();
  }

  get episodeDose() {
    return this._episodeDose;
  }

  get episodeFreshItems() {
    return this._episodeFreshItems;
  }

  setIdleResetMs(value) {
    this._idleResetMs = Math.max(0, Math.round(Number(value) || 0));
  }

  getState() {
    return this._state;
  }

  getSnapshot() {
    const loopSignals = mergeFeedFlowLoopSignals(this._burst.loopSignals, {
      control: this._controlState,
    });

    return {
      ...this._burst,
      medianDwellMs: this._burst.medianDwellMs,
      dominantAdvanceSource: this._burst.dominantAdvanceSource,
      referenceNode: this._burst.referenceNode,
      loopSignals,
    };
  }

  recordAdvance(event = {}) {
    const ts = Math.max(0, Number(event.ts) || Date.now());
    this._reconcileTimers(ts);
    if (event.direction !== 'forward') return this.getSnapshot();

    const shouldStartFresh = !this._burst.burstId
      || !this._burst.lastAdvanceAt
      || (this._idleResetMs > 0 && (ts - this._burst.lastAdvanceAt) > this._idleResetMs);
    if (shouldStartFresh) {
      this._startBurst(event, ts);
      return this.getSnapshot();
    }

    const pauseMs = Math.max(0, ts - this._burst.lastAdvanceAt);
    if (pauseMs > 0) {
      this._dwellSamples.push(pauseMs);
      if (this._dwellSamples.length > BURST_DWELL_SAMPLE_LIMIT) {
        this._dwellSamples.splice(0, this._dwellSamples.length - BURST_DWELL_SAMPLE_LIMIT);
      }
    }

    this._episodeDose += resolveAdvanceDose(event, pauseMs, this._burst.surfaceMode);
    this._burst.lastAdvanceAt = ts;
    this._episodeLastAdvanceAt = ts;
    this._burst.advanceCount += 1;
    this._burst.rapidAdvanceStreak += 1;
    this._burst.screenfulsConsumed += Math.max(0, Number(event.screenfulDelta) || 0);
    this._burst.itemTransitions += Math.max(0, Math.round(Number(event.itemTransitionCount) || 0));
    const freshItemDelta = Math.max(0, Math.round(Number(event.freshItemsSeen) || 0));
    this._burst.freshItemsSeen += freshItemDelta;
    this._episodeFreshItems += freshItemDelta;
    this._burst.maxPauseMs = Math.max(this._burst.maxPauseMs, pauseMs);
    this._burst.medianDwellMs = median(this._dwellSamples);
    this._burst.confidence = Math.max(this._burst.confidence, Math.max(0, Number(event.confidence) || 0));
    this._burst.referenceNode = event.referenceNode || this._burst.referenceNode || null;

    const source = typeof event.source === 'string' && event.source ? event.source : 'screenful';
    this._sourceCounts[source] = (this._sourceCounts[source] || 0) + 1;
    this._burst.dominantAdvanceSource = resolveDominantSource(this._sourceCounts);
    this._burst.loopSignals = this._buildLoopSignals(event, ts);

    if (this._state === 'idle') {
      this._state = 'tracking';
    }

    return this.getSnapshot();
  }

  updateSupplySignals(readout = {}, { now = Date.now() } = {}) {
    const normalizedNow = Math.max(0, Number(now) || Date.now());
    this._reconcileTimers(normalizedNow);
    this._burst.loopSignals = mergeFeedFlowLoopSignals(this._burst.loopSignals, {
      supply: buildSupplySignals(readout),
    });
    return this.getSnapshot();
  }

  markPressure() {
    if (this._state === 'tracking') {
      this._state = 'primed';
    }
    return this.getSnapshot();
  }

  markContinue({ continuePassUntil = 0, now = Date.now() } = {}) {
    const normalizedNow = Math.max(0, Math.round(Number(now) || Date.now()));
    this._controlState = {
      ...this._controlState,
      lastContinueAt: normalizedNow,
      continuePassUntil: Math.max(normalizedNow, Math.round(Number(continuePassUntil) || 0)),
    };
    this._burst.loopSignals = mergeFeedFlowLoopSignals(this._burst.loopSignals, {
      control: this._controlState,
    });
    return this.getSnapshot();
  }

  _startBurst(event, ts) {
    // Reset() may already have rolled the previous burst up; when the burst was
    // superseded without a reset, roll it up here. An empty burst contributes 0,
    // so the two paths never double count.
    this._episodeActiveMs += this._completedBurstActiveMs();
    const gapMs = this._episodeLastAdvanceAt > 0
      ? Math.max(0, ts - this._episodeLastAdvanceAt)
      : 0;
    if (
      this._episodeLastAdvanceAt > 0
      && this._episodeIdleResetMs > 0
      && gapMs > this._episodeIdleResetMs
    ) {
      this._episodeActiveMs = 0;
      this._episodeDose = 0;
      this._episodeFreshItems = 0;
      this._episodeSequence += 1;
      this._episodeId = createEpisodeId(this._episodeSequence, ts);
    } else if (gapMs > 0) {
      // The gap that ended the previous burst is still consumption: it is the
      // time the reader spent on the item they were looking at. Credit it the
      // same way the continuing path does. Without this, anyone advancing slower
      // than `idleResetMs` accrues nothing at all — a cliff rather than a decay,
      // and one that makes the slow half of both dose curves unreachable.
      const surfaceMode = typeof event.surfaceMode === 'string' && event.surfaceMode
        ? event.surfaceMode
        : 'unknown';
      this._episodeDose += resolveAdvanceDose(event, gapMs, surfaceMode);
      this._episodeActiveMs += Math.min(gapMs, ACTIVE_GAP_CREDIT_MAX_MS);
    }
    if (!this._episodeId) {
      this._episodeSequence += 1;
      this._episodeId = createEpisodeId(this._episodeSequence, ts);
    }
    this._episodeFreshItems += Math.max(0, Math.round(Number(event.freshItemsSeen) || 0));
    this._episodeLastAdvanceAt = ts;
    this._state = 'tracking';
    this._dwellSamples = [];
    this._sourceCounts = {};

    const source = typeof event.source === 'string' && event.source ? event.source : 'screenful';
    this._sourceCounts[source] = 1;

    this._burst = {
      burstId: createBurstId(),
      startedAt: ts,
      lastAdvanceAt: ts,
      surfaceMode: typeof event.surfaceMode === 'string' && event.surfaceMode ? event.surfaceMode : 'unknown',
      advanceCount: 1,
      rapidAdvanceStreak: 1,
      screenfulsConsumed: Math.max(0, Number(event.screenfulDelta) || 0),
      itemTransitions: Math.max(0, Math.round(Number(event.itemTransitionCount) || 0)),
      freshItemsSeen: Math.max(0, Math.round(Number(event.freshItemsSeen) || 0)),
      medianDwellMs: null,
      maxPauseMs: 0,
      dominantAdvanceSource: source,
      confidence: Math.max(0, Number(event.confidence) || 0),
      referenceNode: event.referenceNode || null,
      loopSignals: createEmptyFeedFlowLoopSignals(),
    };
    this._burst.loopSignals = this._buildLoopSignals(event, ts);
  }

  _buildLoopSignals(event, ts) {
    const merged = mergeFeedFlowLoopSignals(this._burst.loopSignals, event?.loopSignals);
    const burstDurationMs = this._burst.startedAt > 0 ? Math.max(0, ts - this._burst.startedAt) : 0;

    return mergeFeedFlowLoopSignals(merged, {
      progression: {
        episodeId: this._episodeId,
        burstDurationMs,
        episodeActiveMs: this._episodeActiveMs + burstDurationMs,
        dose: Number(this._episodeDose.toFixed(3)),
        advanceCount: this._burst.advanceCount,
        rapidAdvanceStreak: this._burst.rapidAdvanceStreak,
        screenfulsConsumed: this._burst.screenfulsConsumed,
        itemTransitions: this._burst.itemTransitions,
        dominantAdvanceSource: this._burst.dominantAdvanceSource,
      },
      novelty: {
        freshItemsSeen: this._burst.freshItemsSeen,
        episodeFreshItemsSeen: this._episodeFreshItems,
        freshItemRate: resolveFreshItemRate(this._burst.freshItemsSeen, this._burst.advanceCount),
      },
      rhythm: {
        medianDwellMs: this._burst.medianDwellMs,
        maxPauseMs: this._burst.maxPauseMs,
      },
      control: this._controlState,
    });
  }

  _reconcileTimers(now) {
    if (
      this._episodeLastAdvanceAt > 0
      && this._episodeIdleResetMs > 0
      && (now - this._episodeLastAdvanceAt) > this._episodeIdleResetMs
    ) {
      this.reset({ preserveControl: true, preserveEpisode: false });
      return;
    }
    // A short pause closes the burst lazily on the next confirmed advance.
    // Supply polling retains the last measured burst and episode, without
    // accruing time or dose. Clearing it here made seam maturity depend on the
    // polling cadence instead of consumption. Only episode expiry clears it.
  }
}

export default FeedBurstMachine;
