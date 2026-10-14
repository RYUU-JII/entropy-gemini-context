function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export class PagedAdvanceAdapter {
  constructor() {
    this._lastItemKey = null;
    this._lastTransitionTs = 0;
  }

  reset() {
    this._lastItemKey = null;
    this._lastTransitionTs = 0;
  }

  synchronizeBaseline({
    itemKey = '',
    ts = Date.now(),
  } = {}) {
    const normalizedItemKey = typeof itemKey === 'string' ? itemKey.trim() : '';
    if (!normalizedItemKey) return false;
    if (normalizedItemKey === this._lastItemKey) return true;
    this._lastItemKey = normalizedItemKey;
    this._lastTransitionTs = ts;
    return true;
  }

  recordTransition({
    itemKey = '',
    ts = Date.now(),
    recentGesture = false,
    activeVideoChanged = false,
    referenceNode = null,
  } = {}) {
    const normalizedItemKey = typeof itemKey === 'string' ? itemKey.trim() : '';
    if (!normalizedItemKey) return null;

    if (!this._lastItemKey) {
      this._lastItemKey = normalizedItemKey;
      this._lastTransitionTs = ts;
      return null;
    }

    if (normalizedItemKey === this._lastItemKey) return null;

    const dwellMs = this._lastTransitionTs > 0 ? Math.max(0, ts - this._lastTransitionTs) : null;
    this._lastItemKey = normalizedItemKey;
    this._lastTransitionTs = ts;

    const confidence = clamp(
      (recentGesture ? 0.45 : 0.18) + (activeVideoChanged ? 0.35 : 0.18),
      0,
      1,
    );

    return {
      ts,
      surfaceMode: 'paged',
      direction: 'forward',
      confidence,
      source: 'dominant_item',
      screenfulDelta: 0,
      itemTransitionCount: 1,
      freshItemsSeen: 0,
      dwellMs,
      referenceNode,
      activeScroller: null,
      evidence: {
        recentGesture,
        dominantItemChanged: true,
        activeVideoChanged,
        sentinelPassed: false,
      },
    };
  }
}

export default PagedAdvanceAdapter;
