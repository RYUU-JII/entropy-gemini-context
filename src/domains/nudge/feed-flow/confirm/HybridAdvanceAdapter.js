function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export class HybridAdvanceAdapter {
  reset() {
    // Stateless by design for Phase 1.
  }

  merge({
    continuousEvent = null,
    pagedEvent = null,
  } = {}) {
    if (!continuousEvent && !pagedEvent) return null;
    if (!continuousEvent) return pagedEvent;
    if (!pagedEvent) return continuousEvent;

    const confidence = clamp(
      (continuousEvent.confidence * 0.45) + (pagedEvent.confidence * 0.55),
      0,
      1,
    );

    return {
      ts: Math.max(continuousEvent.ts || 0, pagedEvent.ts || 0),
      surfaceMode: 'hybrid',
      direction: 'forward',
      confidence,
      source: 'hybrid_score',
      screenfulDelta: Number(continuousEvent.screenfulDelta) || 0,
      itemTransitionCount: Number(pagedEvent.itemTransitionCount) || 0,
      freshItemsSeen: Number(continuousEvent.freshItemsSeen) || 0,
      dwellMs: pagedEvent.dwellMs ?? continuousEvent.dwellMs ?? null,
      referenceNode: pagedEvent.referenceNode || continuousEvent.referenceNode || null,
      activeScroller: continuousEvent.activeScroller || pagedEvent.activeScroller || null,
      evidence: {
        recentGesture: !!(continuousEvent.evidence?.recentGesture || pagedEvent.evidence?.recentGesture),
        dominantItemChanged: !!pagedEvent.evidence?.dominantItemChanged,
        activeVideoChanged: !!pagedEvent.evidence?.activeVideoChanged,
        sentinelPassed: !!continuousEvent.evidence?.sentinelPassed,
      },
    };
  }
}

export default HybridAdvanceAdapter;
