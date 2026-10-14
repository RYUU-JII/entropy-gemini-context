/**
 * Decides when an already-armed FeedFlow opportunity reaches a usable seam.
 *
 * The sensing profile answers "has this person consumed enough"; it does not
 * answer "is this a good moment". Firing the instant the dose target is crossed
 * lands mid-flick, which is the most expensive place to interrupt someone and the
 * reason the exact eligibility number felt so load-bearing: there was no second
 * stage to absorb its error.
 *
 * Interruption research is consistent that the same interruption costs far less
 * at a task boundary than inside one (Adamczyk & Bailey, CHI 2004; Iqbal &
 * Bailey on breakpoints), and the difference between "mid-flick" and "at the
 * seam" is larger than the difference between three minutes and ten.
 *
 * A seam is measured against the reader's own rhythm, never an absolute gap. An
 * absolute bar degenerates in opposite directions at the two ends: at 2.5s every
 * advance of a 7.5s-per-item reader qualifies, so the gate fires on the next tick
 * and has waited for nothing, while no advance of a 1.05s-per-item flicker ever
 * qualifies, so it always times out. Both outcomes are the failure modes the
 * stage exists to escape.
 *
 * The bar then decays. Someone who never offers a clear break is the person most
 * in need of the horizon, so refusing to land on anything less than a clear break
 * would serve them worst. Starting strict and relaxing toward "any interval at or
 * above your own median" means the longer the flow refuses to break, the smaller
 * a break the gate is willing to accept. The hard limit only relaxes the next
 * confirmed-advance opportunity; it is not a wall-clock promise that a visible
 * Horizon or Gesture Gate will appear.
 */
import { DEFAULT_ENSO_FEED_HORIZON_RUNTIME_CONFIG } from '../../../../../scripts/dev/enso-model-research/legacy-feed/ensoFeedHorizonRuntimeConfig.js';

export const SEAM_DECISIONS = Object.freeze({
  NOT_ARMED: 'not_armed',
  AWAITING_SEAM: 'awaiting_seam',
  SEAM_REACHED: 'seam_reached',
  WAIT_EXHAUSTED: 'seam_wait_exhausted',
});

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

/**
 * The gap this advance would have to show to count as a seam, given how long the
 * gate has already been waiting.
 */
export function resolveRequiredSeamGapMs(
  waitedMs,
  cadenceMs,
  seamConfig = DEFAULT_ENSO_FEED_HORIZON_RUNTIME_CONFIG.seam,
) {
  // Cadence is unknown only before any interval has been measured. The declared
  // behaviour there is the absolute floor alone -- a stated bar, not a silent
  // relaxation of the relative one.
  const progress = clamp01(Math.max(0, Number(waitedMs) || 0) / seamConfig.relaxMs);
  const absoluteFloorMs = seamConfig.absoluteFloorMs * (1 - progress);
  if (!Number.isFinite(cadenceMs) || cadenceMs <= 0) return Math.round(absoluteFloorMs);
  const ratio = seamConfig.ratioAtArm
    - ((seamConfig.ratioAtArm - seamConfig.ratioFloor) * progress);
  return Math.round(Math.max(absoluteFloorMs, ratio * cadenceMs));
}

export class FeedHorizonSeamGate {
  constructor(seamConfig = DEFAULT_ENSO_FEED_HORIZON_RUNTIME_CONFIG.seam) {
    this.setConfig(seamConfig);
    this.reset();
  }

  setConfig(seamConfig) {
    if (!seamConfig || typeof seamConfig !== 'object') {
      throw new Error('FEED_HORIZON_SEAM_CONFIG_REQUIRED');
    }
    this._config = seamConfig;
  }

  reset() {
    this._lastAdvanceTs = null;
    this._armedAt = null;
    this._armedCadenceMs = null;
    this._intervals = [];
    this._firedDecision = null;
  }

  release({ preserveCadence = true } = {}) {
    this._armedAt = null;
    this._armedCadenceMs = null;
    this._firedDecision = null;
    if (!preserveCadence) {
      this._lastAdvanceTs = null;
      this._intervals = [];
    }
  }

  // Cadence is measured here rather than read from the burst machine's
  // `medianDwellMs`, which is burst-scoped: a burst closes after idleResetMs, so
  // anyone whose rhythm is slower than that opens a new burst on every advance
  // and reports no median at all. A reader at 7.5s an item -- exactly the person
  // this stage must not fire on immediately -- reads null there. The seam
  // question is episode-scoped, so its evidence has to be too.
  _cadenceMs() {
    if (this._intervals.length < 3) return null;
    const sorted = [...this._intervals].sort((left, right) => left - right);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  /**
   * Called once per advance, armed or not -- it measures the gap between
   * consecutive advances, so skipping the unarmed ones would make the first armed
   * advance look like it followed an enormous pause. `armed` is the sensing
   * verdict; the cadence it is judged against is measured here.
   */
  evaluate({ ts, armed }) {
    const now = Math.max(0, Number(ts) || 0);
    const previousAdvanceTs = this._lastAdvanceTs;
    this._lastAdvanceTs = now;
    const observedGapMs = previousAdvanceTs === null
      ? 0
      : Math.max(0, now - previousAdvanceTs);

    if (previousAdvanceTs !== null) {
      this._intervals.push(observedGapMs);
      if (this._intervals.length > this._config.cadenceWindow) this._intervals.shift();
    }

    if (!armed) {
      this.release({ preserveCadence: true });
      return Object.freeze({
        fire: false,
        decision: SEAM_DECISIONS.NOT_ARMED,
        waitedMs: 0,
        observedGapMs,
        requiredGapMs: 0,
        hardLimitMs: this._config.hardLimitMs,
      });
    }

    if (this._firedDecision) return this._firedDecision;

    if (this._armedAt === null) {
      this._armedAt = now;
      // Hold the rhythm the reader had while consuming. Measuring against a live
      // cadence would mean measuring against a rhythm the pause itself is already
      // disturbing, and the burst that carried it may have closed on that pause.
      this._armedCadenceMs = this._cadenceMs();
    }

    const waitedMs = Math.max(0, now - this._armedAt);
    const requiredGapMs = resolveRequiredSeamGapMs(
      waitedMs,
      this._armedCadenceMs,
      this._config,
    );

    if (observedGapMs >= requiredGapMs) {
      this._firedDecision = Object.freeze({
        fire: true,
        decision: SEAM_DECISIONS.SEAM_REACHED,
        waitedMs,
        observedGapMs,
        requiredGapMs,
        hardLimitMs: this._config.hardLimitMs,
      });
      return this._firedDecision;
    }

    if (waitedMs >= this._config.hardLimitMs) {
      this._firedDecision = Object.freeze({
        fire: true,
        decision: SEAM_DECISIONS.WAIT_EXHAUSTED,
        waitedMs,
        observedGapMs,
        requiredGapMs,
        hardLimitMs: this._config.hardLimitMs,
      });
      return this._firedDecision;
    }

    return Object.freeze({
      fire: false,
      decision: SEAM_DECISIONS.AWAITING_SEAM,
      waitedMs,
      observedGapMs,
      requiredGapMs,
      hardLimitMs: this._config.hardLimitMs,
    });
  }

  /**
   * Reprojects current state without consuming a cadence sample. Supply polling
   * and lifecycle publications call this path, so neither can manufacture a seam
   * or exhaust the hard limit between real feed advances.
   */
  reconcile({ ts, armed }) {
    const now = Math.max(0, Number(ts) || 0);
    if (!armed) {
      this.release({ preserveCadence: true });
      return Object.freeze({
        fire: false,
        decision: SEAM_DECISIONS.NOT_ARMED,
        waitedMs: 0,
        observedGapMs: 0,
        requiredGapMs: 0,
        hardLimitMs: this._config.hardLimitMs,
      });
    }
    if (this._firedDecision) return this._firedDecision;
    const waitedMs = this._armedAt === null ? 0 : Math.max(0, now - this._armedAt);
    return Object.freeze({
      fire: false,
      decision: SEAM_DECISIONS.AWAITING_SEAM,
      waitedMs,
      observedGapMs: 0,
      requiredGapMs: resolveRequiredSeamGapMs(
        waitedMs,
        this._armedCadenceMs,
        this._config,
      ),
      hardLimitMs: this._config.hardLimitMs,
    });
  }
}

export default FeedHorizonSeamGate;
