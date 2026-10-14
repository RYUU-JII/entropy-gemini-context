/**
 * PullPastAccumulator — reads "continue" out of the scroll-resistance stream.
 *
 * Continuing past the terminus is a deliberate pull-past: the user keeps pushing
 * forward against the viscous resistance. We accumulate the *resisted* magnitude
 * but decay it on a short half-life, so only a sustained, intentional push clears
 * the threshold — a few idle flicks spread over time bleed away and never add up
 * to a continue. Mechanism (resistance) and gesture (pull-past) are one stream.
 *
 * Pure and time-injected so the gesture math is unit-testable without a DOM.
 */

const DEFAULT_OPTIONS = Object.freeze({
  thresholdPx: 480,
  decayHalfLifeMs: 500,
});

function toPositive(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export class PullPastAccumulator {
  constructor(options = {}) {
    this._thresholdPx = toPositive(options.thresholdPx, DEFAULT_OPTIONS.thresholdPx);
    this._halfLifeMs = toPositive(options.decayHalfLifeMs, DEFAULT_OPTIONS.decayHalfLifeMs);
    this.reset();
  }

  reset(now = 0) {
    this._accum = 0;
    this._lastAt = now;
  }

  _decayTo(now) {
    if (this._accum <= 0) {
      this._lastAt = now;
      return;
    }
    const elapsed = Math.max(0, now - this._lastAt);
    if (elapsed > 0) {
      this._accum *= Math.pow(0.5, elapsed / this._halfLifeMs);
      if (this._accum < 1e-3) this._accum = 0;
    }
    this._lastAt = now;
  }

  push(px, now) {
    this._decayTo(now);
    const add = Number(px);
    if (Number.isFinite(add) && add > 0) this._accum += add;
    return this._accum;
  }

  value(now) {
    this._decayTo(now);
    return this._accum;
  }

  progress(now) {
    return Math.min(1, this.value(now) / this._thresholdPx);
  }

  isSatisfied(now) {
    return this.value(now) >= this._thresholdPx;
  }
}

export default PullPastAccumulator;
