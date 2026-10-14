/**
 * FeedSupplyObserver — observe-only feed-supply signal (evolved from
 * ReplenishmentTracker).
 *
 * Watches the active scroll container's *real* geometry — scrollHeight grows in
 * discrete steps as the site appends new supply, and bottomReachRatio says how
 * close the viewport was when it grew. This is the source of truth for "when did
 * the page actually attach new supply", and it is deliberately selector-free /
 * site-agnostic: it reads geometry, never per-site DOM. Generality is the point —
 * nothing here needs manual per-site registration.
 *
 * Real geometry is never compensated. Scroll-inertia shaping can make scrollTop
 * lag, which would under-read a demand step taken
 * mid-drain. Instead of secretly correcting the reading, this observer:
 *   - takes inertia context as separate `meta` (settling / pendingPx / locked),
 *   - flags a near-miss step taken while inertia is settling as `skewRisk`,
 *   - defers that step as a `pendingStep` and, if the viewport is genuinely
 *     near-bottom once the drain settles, records a `lateConfirmedSteps` event.
 *
 * Late-confirms are surfaced as a separate counter, NOT folded into loopPressure,
 * so the magnitude of inertia-induced under-read stays visible for Phase 1 tuning
 * rather than being baked into the judgment now.
 */

const DEFAULT_OPTIONS = Object.freeze({
  stepThresholdRatio: 0.45,
  minStepPx: 240,
  nearBottomRatio: 0.6,
  decayHalfLifeMs: 20000,
  pressurePerStep: 1,
  resetShrinkRatio: 0.5,
  skewBandRatio: 0.12,
  pendingTtlMs: 700,
});

function toFinite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toPositive(value, fallback = 0) {
  return Math.max(0, toFinite(value, fallback));
}

export class FeedSupplyObserver {
  constructor(options = {}) {
    const merged = { ...DEFAULT_OPTIONS, ...(options && typeof options === 'object' ? options : {}) };
    this._stepThresholdRatio = toPositive(merged.stepThresholdRatio, DEFAULT_OPTIONS.stepThresholdRatio);
    this._minStepPx = toPositive(merged.minStepPx, DEFAULT_OPTIONS.minStepPx);
    this._nearBottomRatio = Math.min(1, toPositive(merged.nearBottomRatio, DEFAULT_OPTIONS.nearBottomRatio));
    this._decayHalfLifeMs = Math.max(1, toPositive(merged.decayHalfLifeMs, DEFAULT_OPTIONS.decayHalfLifeMs));
    this._pressurePerStep = toPositive(merged.pressurePerStep, DEFAULT_OPTIONS.pressurePerStep);
    this._resetShrinkRatio = Math.min(1, toPositive(merged.resetShrinkRatio, DEFAULT_OPTIONS.resetShrinkRatio));
    this._skewBandRatio = Math.min(1, toPositive(merged.skewBandRatio, DEFAULT_OPTIONS.skewBandRatio));
    this._pendingTtlMs = Math.max(0, toPositive(merged.pendingTtlMs, DEFAULT_OPTIONS.pendingTtlMs));
    this.reset();
  }

  reset() {
    this._initialized = false;
    this._containerKey = '';
    this._lastHeight = 0;
    this._lastSampleAt = 0;
    this._totalSteps = 0;
    this._demandSteps = 0;
    this._loopPressure = 0;
    this._lastStepAt = 0;
    this._lastDecayAt = 0;
    this._lastDeltaPx = 0;
    this._lastThresholdPx = 0;
    this._lastBottomReachRatio = 0;
    this._maxDepthRatio = 0;
    // Cadence / skew bookkeeping.
    this._pendingStep = null;
    this._skewedSteps = 0;
    this._lateConfirmedSteps = 0;
    this._expiredPendingSteps = 0;
    this._lastSkewRisk = false;
    this._lastCadenceSettling = false;
    this._lastPendingPx = 0;
    this._lastActuationLocked = false;
  }

  invalidateGeometry() {
    // Keep already observed supply and its decay. Only the next height delta
    // loses support; changes across an unavailable interval cannot be supply.
    this._initialized = false;
    this._pendingStep = null;
    this._lastDeltaPx = 0;
    this._lastThresholdPx = 0;
    this._lastSkewRisk = false;
  }

  _seed(containerKey, scrollHeight, now) {
    this._initialized = true;
    this._containerKey = containerKey;
    this._lastHeight = scrollHeight;
    this._lastSampleAt = now;
    this._lastDecayAt = now;
    this._pendingStep = null;
  }

  _decay(now) {
    if (this._loopPressure <= 0) {
      this._lastDecayAt = now;
      return;
    }
    const elapsed = Math.max(0, now - this._lastDecayAt);
    if (elapsed <= 0) return;
    const factor = Math.pow(0.5, elapsed / this._decayHalfLifeMs);
    this._loopPressure *= factor;
    if (this._loopPressure < 1e-4) this._loopPressure = 0;
    this._lastDecayAt = now;
  }

  // A skewed near-miss step waits here; if the viewport is genuinely near-bottom
  // once the inertia drain settles, it is recognised as demand that was under-read
  // at the step moment. This is deferred judgment of a polluted sample, not a
  // forward projection of intended distance.
  _resolvePendingStep(currentReach, now) {
    if (!this._pendingStep) return;
    if (now > this._pendingStep.deadline) {
      this._pendingStep = null;
      this._expiredPendingSteps += 1;
      return;
    }
    if (currentReach >= this._nearBottomRatio) {
      this._pendingStep = null;
      this._lateConfirmedSteps += 1;
    }
  }

  /**
   * Feed one geometry measurement plus optional scroll-inertia context.
   *
   * @param {object} sample  real geometry: scrollHeight, scrollTop, clientHeight,
   *                         viewportHeight?, containerKey? — never compensated.
   * @param {object} [meta]  inertia context from the scroll orchestrator:
   *                         { settling, pendingPx, actuationLocked }.
   * @param {number} [now]
   */
  observe(sample = {}, meta = {}, now = Date.now()) {
    const scrollHeight = toPositive(sample.scrollHeight);
    const scrollTop = toPositive(sample.scrollTop);
    const clientHeight = toPositive(sample.clientHeight);
    const viewportHeight = toPositive(sample.viewportHeight, clientHeight) || clientHeight;
    const containerKey = typeof sample.containerKey === 'string' ? sample.containerKey : '';

    const actuationLocked = meta?.actuationLocked === true;
    const cadenceSettling = meta?.settling === true || actuationLocked;
    this._lastCadenceSettling = cadenceSettling;
    this._lastPendingPx = Math.max(0, Math.round(toFinite(meta?.pendingPx)));
    this._lastActuationLocked = actuationLocked;

    this._decay(now);

    const containerChanged = this._initialized && containerKey !== this._containerKey;
    const collapsed = this._initialized
      && scrollHeight > 0
      && this._lastHeight > 0
      && scrollHeight < this._lastHeight * this._resetShrinkRatio;

    if (!this._initialized || containerChanged || collapsed) {
      // New surface (navigation / scroller swap / virtualization collapse):
      // re-baseline without counting a phantom step.
      this._seed(containerKey, scrollHeight, now);
      this._lastDeltaPx = 0;
      this._lastThresholdPx = 0;
      this._lastSkewRisk = false;
      return { step: false, demand: false, deltaPx: 0, pendingStep: false, skewRisk: false };
    }

    const denom = Math.max(1, this._lastHeight || scrollHeight);
    const bottomReachRatio = Math.min(1, (scrollTop + clientHeight) / denom);
    if (bottomReachRatio > this._maxDepthRatio) this._maxDepthRatio = bottomReachRatio;

    // Resolve any deferred step first — the drain may have settled by now.
    this._resolvePendingStep(bottomReachRatio, now);

    const deltaPx = scrollHeight - this._lastHeight;
    const thresholdPx = Math.max(this._minStepPx, this._stepThresholdRatio * (viewportHeight || clientHeight || 1));
    this._lastThresholdPx = thresholdPx;
    this._lastSampleAt = now;

    let step = false;
    let demand = false;
    let pendingStep = false;
    let skewRisk = false;

    if (deltaPx >= thresholdPx) {
      step = true;
      this._totalSteps += 1;
      this._lastDeltaPx = deltaPx;
      this._lastStepAt = now;
      this._lastBottomReachRatio = bottomReachRatio;

      if (bottomReachRatio >= this._nearBottomRatio) {
        // Demand confirmed at the step moment.
        demand = true;
        this._demandSteps += 1;
        this._loopPressure += this._pressurePerStep;
      } else if (cadenceSettling && bottomReachRatio >= (this._nearBottomRatio - this._skewBandRatio)) {
        // Near-miss while inertia is draining: scrollTop may simply be lagging.
        // Defer judgment instead of writing it off as background prefetch.
        skewRisk = true;
        pendingStep = true;
        this._skewedSteps += 1;
        this._pendingStep = { deadline: now + this._pendingTtlMs, baseReach: bottomReachRatio };
      }
      // Otherwise: a clear low-reach step with no cadence excuse → background
      // prefetch. Counted in totalSteps only; builds no pressure.
    }

    this._lastSkewRisk = skewRisk;
    this._lastHeight = scrollHeight;
    return { step, demand, deltaPx, pendingStep, skewRisk };
  }

  getReadout(now = Date.now()) {
    this._decay(now);
    return {
      initialized: this._initialized,
      containerKey: this._containerKey,
      lastHeight: Math.round(this._lastHeight),
      totalSteps: this._totalSteps,
      demandSteps: this._demandSteps,
      loopPressure: Math.round(this._loopPressure * 1000) / 1000,
      lastStepAt: this._lastStepAt,
      msSinceLastStep: this._lastStepAt > 0 ? Math.max(0, now - this._lastStepAt) : null,
      lastDeltaPx: Math.round(this._lastDeltaPx),
      lastThresholdPx: Math.round(this._lastThresholdPx),
      lastBottomReachRatio: Math.round(this._lastBottomReachRatio * 1000) / 1000,
      maxDepthRatio: Math.round(this._maxDepthRatio * 1000) / 1000,
      decayHalfLifeMs: this._decayHalfLifeMs,
      // Cadence / skew observability (judgment not folded into pressure).
      cadenceSettling: this._lastCadenceSettling,
      pendingPx: this._lastPendingPx,
      actuationLocked: this._lastActuationLocked,
      skewRisk: this._lastSkewRisk,
      pendingStep: !!this._pendingStep,
      skewedSteps: this._skewedSteps,
      lateConfirmedSteps: this._lateConfirmedSteps,
      expiredPendingSteps: this._expiredPendingSteps,
    };
  }
}

export default FeedSupplyObserver;
