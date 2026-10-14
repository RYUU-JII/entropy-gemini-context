import { normalizeFeedFlowLoopSignals } from '../contracts/feedFlowLoopSignals.js';
import { DEFAULT_ENSO_FEED_HORIZON_RUNTIME_CONFIG, requireEnsoFeedHorizonRuntimeConfig } from '../config/ensoFeedHorizonRuntimeConfig.js';
import admissionClient from '../../runtime/interventionAdmissionClient.js';

function recent(at, now, windowMs) { return Number.isFinite(at) && at > 0 && now >= at && now - at <= windowMs; }

// Time eligibility is a read projection of the background owner. Only a new
// confirmed movement can create a boundary; polls may retain or invalidate it.
export default class FeedBoundaryJudge {
  constructor({ runtimeConfig = DEFAULT_ENSO_FEED_HORIZON_RUNTIME_CONFIG,
    getCadence = () => admissionClient.getEnsoCadence() } = {}) {
    this._getCadence = getCadence; this._goalDemand = false; this.setConfig(runtimeConfig); this.reset();
  }
  setGoalDemand(required) {
    if (typeof required !== 'boolean') throw new Error('FEED_GOAL_BOUNDARY_DEMAND_INVALID');
    if (required !== this._goalDemand) this.reset();
    this._goalDemand = required;
  }
  setConfig(config) { this._config = requireEnsoFeedHorizonRuntimeConfig(config); }
  reset() { this._opportunityReady = false; this._boundaryAt = 0; }
  releaseOpportunity() { this.reset(); }
  evaluate(snapshot, { now = Date.now(), observationKind = 'advance' } = {}) {
    const loopSignals = normalizeFeedFlowLoopSignals(snapshot.loopSignals);
    const { intentionality, directionality, context } = loopSignals;
    const cadence = this._getCadence();
    const inhibitors = [];
    const actionWindow = this._config.inhibitors.intentionalityWindowMs;
    if (intentionality.recentInteractiveActionCount > 0 ||
      ['recentClickThroughAt', 'recentInputFocusAt', 'recentTypingAt', 'recentSelectionAt']
        .some((key) => recent(intentionality[key], now, actionWindow))) inhibitors.push('interactive_action_recent');
    if (['recentBackwardIntentAt', 'recentRevisitAt'].some((key) =>
      recent(directionality[key], now, this._config.inhibitors.backtrackWindowMs))) inhibitors.push('backtrack_signal_present');
    if (snapshot.surfaceMode === 'document' || context.contentClass === 'document') inhibitors.push('document_surface_excluded');
    if (!this._goalDemand && !cadence?.eligible) inhibitors.push(cadence?.reason || 'enso_cadence_unavailable');
    if (inhibitors.length || (this._boundaryAt > 0 && now - this._boundaryAt > 5000)) this.reset();
    if (observationKind === 'advance' && snapshot.advanceCount > 0 && !inhibitors.length) {
      this._opportunityReady = true; this._boundaryAt = now;
    }
    const state = this._opportunityReady ? 'interrupt' : 'none';
    return { decisionId: `feed_boundary_${now}`, ts: now, state,
      candidateState: state, armed: this._goalDemand || cadence?.eligible === true,
      opportunityReady: this._opportunityReady, inhibitors,
      seam: { decision: this._opportunityReady ? 'content_boundary_reached' : 'content_boundary_pending' },
      surfaceMode: snapshot.surfaceMode, confidence: context.surfaceConfidence,
      detectorConfidence: snapshot.confidence, loopScore: 0, directTriggers: [], pressureSignals: [],
      reasons: this._opportunityReady ? [this._goalDemand ? 'goal_boundary_requested' : 'enso_consumption_interval_due', 'feed_horizon_opportunity_ready'] : inhibitors,
      metrics: { advanceCount: snapshot.advanceCount, screenfulsConsumed: snapshot.screenfulsConsumed,
        itemTransitions: snapshot.itemTransitions, freshItemsSeen: snapshot.freshItemsSeen,
        medianDwellMs: null, maxPauseMs: 0, backwardIntentCount: directionality.backwardIntentCount,
        backtrackRatio: directionality.backtrackRatio, recentInteractiveActionCount: intentionality.recentInteractiveActionCount,
        supplyTotalSteps: loopSignals.supply.totalSteps, supplyDemandSteps: loopSignals.supply.demandSteps },
      cadence, burstId: snapshot.burstId, referenceNode: snapshot.referenceNode, loopSignals };
  }
}
