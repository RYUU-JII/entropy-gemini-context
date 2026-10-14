const WHEEL_SCROLL_DEDUP_MS = 250;

function readScrollY() {
  if (typeof window === 'undefined') return 0;
  return window.scrollY || window.pageYOffset || 0;
}

export class ScrollSignalTracker {
  constructor({
    recordScrollSample,
    getWheelScrollDedupMs,
  }) {
    this._recordScrollSample = recordScrollSample;
    this._getWheelScrollDedupMs = getWheelScrollDedupMs;
    this._scroll = {
      lastTs: 0,
      lastY: 0,
      velocity: 0,
      lastWheelTs: 0,
      lastWheelSampleTs: 0,
    };
  }

  getVelocity() {
    return this._scroll.velocity;
  }

  reset() {
    this._scroll.lastTs = 0;
    this._scroll.lastY = readScrollY();
    this._scroll.velocity = 0;
    this._scroll.lastWheelTs = 0;
    this._scroll.lastWheelSampleTs = 0;
  }

  destroy() {
    this.reset();
  }

  _getWheelDrivenWindowMs() {
    const extra = Number(this._getWheelScrollDedupMs?.());
    if (!Number.isFinite(extra) || extra <= 0) return WHEEL_SCROLL_DEDUP_MS;
    return WHEEL_SCROLL_DEDUP_MS + extra;
  }

  recordWheelInput(event) {
    const deltaY = Number(event?.deltaY);
    if (!Number.isFinite(deltaY) || deltaY === 0) return;

    const now = Date.now();
    const dtMs = this._scroll.lastWheelSampleTs ? (now - this._scroll.lastWheelSampleTs) : 16;
    this._scroll.lastWheelSampleTs = now;
    this._recordScrollSample?.({ deltaY, dtMs });
    this._scroll.lastWheelTs = now;
  }

  recordScrollSample() {
    const now = Date.now();
    const y = readScrollY();

    if (!this._scroll.lastTs) {
      this._scroll.lastTs = now;
      this._scroll.lastY = y;
      return;
    }

    const dt = now - this._scroll.lastTs;
    if (dt <= 0) return;

    const dy = y - this._scroll.lastY;
    const wheelDrivenWindowMs = this._getWheelDrivenWindowMs();
    const isWheelDriven = this._scroll.lastWheelTs > 0 && (now - this._scroll.lastWheelTs) <= wheelDrivenWindowMs;
    if (!isWheelDriven && dy !== 0) {
      this._recordScrollSample?.({ deltaY: dy, dtMs: dt });
    }
    this._scroll.velocity = (dy / dt) * 1000;

    this._scroll.lastTs = now;
    this._scroll.lastY = y;
  }
}

export function createScrollSignalTracker(options) {
  return new ScrollSignalTracker(options);
}
