import { createEmptyFeedFlowLoopSignals, mergeFeedFlowLoopSignals } from '../contracts/feedFlowLoopSignals.js';

// Observed movement only. Consumption time belongs to background Enso cadence;
// this document keeps no dose, pace window, maturity clock or idle timer.
export default class FeedBoundaryState {
  constructor() { this._sequence = 0; this.reset({ preserveControl: false }); }
  reset({ preserveControl = true } = {}) {
    const control = preserveControl && this._snapshot ? this._snapshot.loopSignals.control : {};
    this._snapshot = { burstId: '', surfaceMode: 'unknown', advanceCount: 0,
      screenfulsConsumed: 0, itemTransitions: 0, freshItemsSeen: 0, confidence: 0,
      lastAdvanceAt: 0, medianDwellMs: null, maxPauseMs: 0, referenceNode: null,
      loopSignals: mergeFeedFlowLoopSignals(createEmptyFeedFlowLoopSignals(), { control }) };
  }
  getState() { return this._snapshot.advanceCount > 0 ? 'tracking' : 'idle'; }
  getSnapshot() { return { ...this._snapshot }; }
  recordAdvance(event) {
    if (event.direction !== 'forward') return this.getSnapshot();
    const previous = this._snapshot;
    const ts = event.ts;
    if (!Number.isFinite(ts) || ts <= 0) throw new Error('FEED_BOUNDARY_TIMESTAMP_INVALID');
    for (const key of ['screenfulDelta', 'itemTransitionCount', 'freshItemsSeen']) {
      if (!Number.isFinite(event[key]) || event[key] < 0) throw new Error(`FEED_BOUNDARY_MEASUREMENT_INVALID:${key}`);
    }
    this._snapshot = { ...previous,
      burstId: previous.burstId || `feed_boundary_${ts}_${++this._sequence}`,
      surfaceMode: event.surfaceMode,
      advanceCount: previous.advanceCount + 1,
      screenfulsConsumed: previous.screenfulsConsumed + Math.max(0, event.screenfulDelta),
      itemTransitions: previous.itemTransitions + Math.max(0, event.itemTransitionCount),
      freshItemsSeen: previous.freshItemsSeen + Math.max(0, event.freshItemsSeen),
      confidence: event.confidence, lastAdvanceAt: ts,
      referenceNode: event.referenceNode,
      loopSignals: mergeFeedFlowLoopSignals(previous.loopSignals, event.loopSignals),
    };
    return this.getSnapshot();
  }
  updateSupplySignals(readout) {
    this._snapshot = { ...this._snapshot,
      loopSignals: mergeFeedFlowLoopSignals(this._snapshot.loopSignals, { supply: readout }) };
    return this.getSnapshot();
  }
  clearInterventionControl() {
    this._snapshot.loopSignals = mergeFeedFlowLoopSignals(this._snapshot.loopSignals,
      { control: createEmptyFeedFlowLoopSignals().control });
  }
  markContinue() { this.reset({ preserveControl: false }); return this.getSnapshot(); }
}
