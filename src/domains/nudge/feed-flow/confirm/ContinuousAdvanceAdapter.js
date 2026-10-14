function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export class ContinuousAdvanceAdapter {
  constructor({
    minScreenfulDelta = 0.25,
    accumulationIdleResetMs = 6000,
  } = {}) {
    this._minScreenfulDelta = Math.max(0, Number(minScreenfulDelta) || 0);
    this._accumulationIdleResetMs = Math.max(1000, Number(accumulationIdleResetMs) || 6000);
    this.reset();
  }

  reset() {
    this._pendingScroller = null;
    this._pendingScreenfulDelta = 0;
    this._pendingRecentGesture = false;
    this._pendingAt = 0;
  }

  _resetPending() {
    this._pendingScroller = null;
    this._pendingScreenfulDelta = 0;
    this._pendingRecentGesture = false;
    this._pendingAt = 0;
  }

  recordProgress({
    ts = Date.now(),
    deltaY = 0,
    containerHeight = 1,
    freshItemsSeen = 0,
    recentGesture = false,
    referenceNode = null,
    activeScroller = null,
  } = {}) {
    const normalizedTs = Math.max(0, Number(ts) || Date.now());
    const numericDeltaY = Number(deltaY);
    const numericHeight = Math.max(1, Number(containerHeight) || 1);
    const normalizedFreshItems = Math.max(0, Math.round(Number(freshItemsSeen) || 0));
    if (!Number.isFinite(numericDeltaY)) return null;
    if (numericDeltaY <= 0) {
      if (numericDeltaY < 0) this._resetPending();
      return null;
    }

    const screenfulDelta = Math.max(0, numericDeltaY) / numericHeight;
    const scrollerChanged = this._pendingScreenfulDelta > 0
      && this._pendingScroller !== activeScroller;
    const pendingExpired = this._pendingAt > 0
      && (normalizedTs - this._pendingAt) > this._accumulationIdleResetMs;
    if (scrollerChanged || pendingExpired) this._resetPending();

    let confirmedScreenfulDelta = screenfulDelta;
    let confirmedRecentGesture = recentGesture === true;
    if (screenfulDelta < this._minScreenfulDelta && normalizedFreshItems <= 0) {
      this._pendingScroller = activeScroller;
      this._pendingScreenfulDelta += screenfulDelta;
      this._pendingRecentGesture = this._pendingRecentGesture || recentGesture === true;
      this._pendingAt = normalizedTs;
      if (this._pendingScreenfulDelta < this._minScreenfulDelta) return null;

      const confirmedSteps = Math.floor(
        this._pendingScreenfulDelta / this._minScreenfulDelta,
      );
      confirmedScreenfulDelta = confirmedSteps * this._minScreenfulDelta;
      this._pendingScreenfulDelta -= confirmedScreenfulDelta;
      confirmedRecentGesture = this._pendingRecentGesture;
      if (this._pendingScreenfulDelta < 0.000001) this._resetPending();
    } else {
      confirmedScreenfulDelta += this._pendingScreenfulDelta;
      confirmedRecentGesture = confirmedRecentGesture || this._pendingRecentGesture;
      this._resetPending();
    }

    const confidence = clamp(
      (confirmedScreenfulDelta * 0.55)
        + (normalizedFreshItems * 0.12)
        + (confirmedRecentGesture ? 0.18 : 0),
      0,
      1,
    );

    return {
      ts: normalizedTs,
      surfaceMode: 'continuous',
      direction: 'forward',
      confidence,
      source: 'screenful',
      screenfulDelta: confirmedScreenfulDelta,
      itemTransitionCount: 0,
      freshItemsSeen: normalizedFreshItems,
      dwellMs: null,
      referenceNode,
      activeScroller,
      evidence: {
        recentGesture: confirmedRecentGesture,
        dominantItemChanged: false,
        activeVideoChanged: false,
        sentinelPassed: false,
      },
    };
  }
}

export default ContinuousAdvanceAdapter;
