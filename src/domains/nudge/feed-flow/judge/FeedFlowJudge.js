import {
  DEFAULT_ENSO_FEED_HORIZON_RUNTIME_CONFIG,
  PRESSURE_DOSE_RATIO,
  requireEnsoFeedHorizonRuntimeConfig,
  resolveSurfaceSensingThresholds,
} from '../../../../../scripts/dev/enso-model-research/legacy-feed/ensoFeedHorizonRuntimeConfig.js';
import { normalizeFeedFlowLoopSignals } from '../contracts/feedFlowLoopSignals.js';
import FeedHorizonSeamGate from './FeedHorizonSeamGate.js';

function createDecisionId(ts) {
  return `feed_flow_${ts}_${Math.floor(Math.random() * 100000)}`;
}

function isRecent(ts, now, windowMs) {
  const normalizedTs = Math.max(0, Number(ts) || 0);
  if (normalizedTs <= 0) return false;
  return (Math.max(0, Number(now) || Date.now()) - normalizedTs) <= windowMs;
}

function clamp01(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(1, numeric));
}

function resolveDecisionConfidence(detectorConfidence, loopSignals) {
  const surfaceConfidence = clamp01(loopSignals.context.surfaceConfidence);
  const structuralConfidence = surfaceConfidence > 0 ? surfaceConfidence : detectorConfidence;
  const totalSteps = Math.max(0, Number(loopSignals.supply.totalSteps) || 0);
  if (totalSteps <= 0) {
    return clamp01((detectorConfidence * 0.8) + (structuralConfidence * 0.2));
  }
  const sampleCoverage = Math.min(1, totalSteps / 4);
  const demandRatio = clamp01(loopSignals.supply.demandRatio);
  const supplyConfidence = sampleCoverage * (0.55 + (demandRatio * 0.45));
  return clamp01(
    (detectorConfidence * 0.65)
      + (structuralConfidence * 0.2)
      + (supplyConfidence * 0.15),
  );
}

function resolveLoopScore(surfaceMode, metrics, config, decisionConfidence, doseTarget) {
  let progressionScore = 0;
  if (surfaceMode === 'hybrid') {
    progressionScore = decisionConfidence / Math.max(
      0.01,
      config.sensing.hybrid.interruptScore,
    );
  } else if (surfaceMode === 'paged') {
    progressionScore = metrics.dose / Math.max(0.01, doseTarget);
  } else {
    const doseScore = metrics.dose / Math.max(0.01, doseTarget);
    const noveltyScore = metrics.episodeFreshItemsSeen
      / Math.max(1, config.sensing.continuous.minFreshItems);
    progressionScore = Math.min(doseScore, noveltyScore);
  }
  const supplyScore = metrics.supplyTotalSteps > 0
    ? Math.min(1, (metrics.supplyDemandSteps + metrics.supplyLateConfirmedSteps) / 3)
    : 0;
  return clamp01((Math.min(1, progressionScore) * 0.72) + (decisionConfidence * 0.18) + (supplyScore * 0.1));
}

export class FeedFlowJudge {
  constructor({
    runtimeConfig = DEFAULT_ENSO_FEED_HORIZON_RUNTIME_CONFIG,
  } = {}) {
    // Placing the horizon is two questions, and they are answered by different
    // terms: the sensing profile decides whether this person has consumed enough,
    // and the seam gate decides whether this is a good moment to say so.
    this._seamGate = null;
    this.setConfig(runtimeConfig);
  }

  setConfig(runtimeConfig) {
    this._config = requireEnsoFeedHorizonRuntimeConfig(runtimeConfig);
    if (this._seamGate) {
      this._seamGate.setConfig(this._config.seam);
    } else {
      this._seamGate = new FeedHorizonSeamGate(this._config.seam);
    }
    // Thresholds depend only on the config and the surface, both of which change
    // far less often than advances arrive. Resolving them per advance meant
    // re-validating a frozen config on every scroll step.
    this._thresholdCache = new Map();
    this.reset();
  }

  reset() {
    this._seamGate.reset();
    this._opportunityReady = false;
    this._episodeId = '';
  }

  releaseOpportunity({ preserveCadence = true } = {}) {
    this._opportunityReady = false;
    this._seamGate.release({ preserveCadence });
  }

  _resolveThresholds(semanticSurfaceId, surfaceMode) {
    const cacheKey = `${semanticSurfaceId}|${surfaceMode}`;
    const cached = this._thresholdCache.get(cacheKey);
    if (cached) return cached;
    const resolved = resolveSurfaceSensingThresholds({
      runtimeConfig: this._config,
      semanticSurfaceId,
      surfaceMode,
      level: this._config.level,
    });
    this._thresholdCache.set(cacheKey, resolved);
    return resolved;
  }

  evaluate(snapshot = null, { now = null, observationKind = 'advance' } = {}) {
    const source = snapshot && typeof snapshot === 'object' ? snapshot : {};
    const ts = now != null && Number.isFinite(Number(now))
      ? Math.max(0, Number(now))
      : Math.max(0, Number(source.lastAdvanceAt) || Date.now());
    const surfaceMode = typeof source.surfaceMode === 'string' ? source.surfaceMode : 'unknown';
    const burstId = typeof source.burstId === 'string' ? source.burstId : '';
    const detectorConfidence = clamp01(source.confidence);
    const loopSignals = normalizeFeedFlowLoopSignals(source.loopSignals);
    const episodeId = typeof loopSignals.progression.episodeId === 'string'
      ? loopSignals.progression.episodeId
      : '';
    if (this._episodeId && episodeId !== this._episodeId) this.reset();
    if (episodeId) this._episodeId = episodeId;
    const isAdvanceObservation = observationKind === 'advance';
    const metrics = {
      advanceCount: Math.max(0, Math.round(Number(source.advanceCount) || 0)),
      screenfulsConsumed: Math.max(0, Number(source.screenfulsConsumed) || 0),
      itemTransitions: Math.max(0, Math.round(Number(source.itemTransitions) || 0)),
      freshItemsSeen: Math.max(0, Math.round(Number(source.freshItemsSeen) || 0)),
      episodeFreshItemsSeen: Math.max(
        0,
        Math.round(Number(loopSignals.novelty.episodeFreshItemsSeen) || 0),
      ),
      medianDwellMs: source.medianDwellMs != null && Number.isFinite(Number(source.medianDwellMs))
        ? Math.max(0, Number(source.medianDwellMs)) : null,
      maxPauseMs: Math.max(0, Math.round(Number(source.maxPauseMs) || 0)),
      burstDurationMs: Math.max(0, Math.round(Number(loopSignals.progression.burstDurationMs) || 0)),
      episodeActiveMs: Math.max(0, Math.round(Number(loopSignals.progression.episodeActiveMs) || 0)),
      dose: Math.max(0, Number(loopSignals.progression.dose) || 0),
      backwardIntentCount: Math.max(0, Math.round(Number(loopSignals.directionality.backwardIntentCount) || 0)),
      backtrackRatio: Math.max(0, Number(loopSignals.directionality.backtrackRatio) || 0),
      revisitCount: Math.max(0, Math.round(Number(loopSignals.directionality.revisitCount) || 0)),
      recentBackwardIntentAt: Math.max(
        0,
        Math.round(Number(loopSignals.directionality.recentBackwardIntentAt) || 0),
      ),
      recentRevisitAt: Math.max(
        0,
        Math.round(Number(loopSignals.directionality.recentRevisitAt) || 0),
      ),
      recentInteractiveActionCount: Math.max(
        0,
        Math.round(Number(loopSignals.intentionality.recentInteractiveActionCount) || 0),
      ),
      sustainedMediaWatchMs: Math.max(0, Math.round(Number(loopSignals.media.sustainedMediaWatchMs) || 0)),
      supplyTotalSteps: Math.max(0, Math.round(Number(loopSignals.supply.totalSteps) || 0)),
      supplyDemandSteps: Math.max(0, Math.round(Number(loopSignals.supply.demandSteps) || 0)),
      supplyDemandRatio: clamp01(loopSignals.supply.demandRatio),
      supplyLoopPressure: Math.max(0, Number(loopSignals.supply.loopPressure) || 0),
      supplyLateConfirmedSteps: Math.max(
        0,
        Math.round(Number(loopSignals.supply.lateConfirmedSteps) || 0),
      ),
      supplyMaxDepthRatio: clamp01(loopSignals.supply.maxDepthRatio),
    };
    const confidence = resolveDecisionConfidence(detectorConfidence, loopSignals);
    const thresholds = this._resolveThresholds(
      loopSignals.context.semanticSurfaceId,
      surfaceMode === 'paged' ? 'paged' : 'continuous',
    );
    const loopScore = resolveLoopScore(
      surfaceMode,
      metrics,
      this._config,
      confidence,
      thresholds.doseTarget,
    );

    let state = 'none';
    let armed = false;
    let seam = null;
    const reasons = [];
    const pressureSignals = [];
    const inhibitors = [];
    // DTO compatibility only. Feed candidates are local Enso evidence and
    // must never be published as generic protection direct triggers.
    const directTriggers = [];
    const minConfidence = this._config.sensing.minConfidence;
    const continuePassActive = Math.max(0, Number(loopSignals.control.continuePassUntil) || 0) > ts;
    const recentContinue = isRecent(
      loopSignals.control.lastContinueAt,
      ts,
      this._config.episode.relapseWindowMs,
    );
    const hasRecentIntentionality = metrics.recentInteractiveActionCount > 0
      || isRecent(
        loopSignals.intentionality.recentClickThroughAt,
        ts,
        this._config.inhibitors.intentionalityWindowMs,
      )
      || isRecent(
        loopSignals.intentionality.recentInputFocusAt,
        ts,
        this._config.inhibitors.intentionalityWindowMs,
      )
      || isRecent(
        loopSignals.intentionality.recentTypingAt,
        ts,
        this._config.inhibitors.intentionalityWindowMs,
      )
      || isRecent(
        loopSignals.intentionality.recentSelectionAt,
        ts,
        this._config.inhibitors.intentionalityWindowMs,
      );
    const hasBacktrackSignal = isRecent(
      metrics.recentBackwardIntentAt,
      ts,
      this._config.inhibitors.backtrackWindowMs,
    ) || isRecent(
      metrics.recentRevisitAt,
      ts,
      this._config.inhibitors.backtrackWindowMs,
    );

    if (continuePassActive) inhibitors.push('continue_pass_active');
    if (hasRecentIntentionality) inhibitors.push('interactive_action_recent');
    if (hasBacktrackSignal) inhibitors.push('backtrack_signal_present');
    if (inhibitors.length > 0) {
      // An opportunity is a moment, not a durable entitlement. If deliberate
      // activity appears before admission, discard the old seam and require a
      // fresh confirmed-advance boundary after the inhibitor clears.
      this.releaseOpportunity({ preserveCadence: true });
    }

    // Both bounds are episode questions. dose places the ordinary horizon; the
    // floor and ceiling only prevent absurdly early or unreachable outcomes.
    const floorClockMs = metrics.episodeActiveMs;
    const ceilingClockMs = metrics.episodeActiveMs;
    const { floorMs, ceilingMs, doseTarget } = thresholds;
    const meetsTimeFloor = floorClockMs >= floorMs;
    const meetsTimeCeiling = ceilingMs > 0 && ceilingClockMs >= ceilingMs;
    const meetsDoseTarget = metrics.dose >= doseTarget;
    const meetsPressureDose = metrics.dose >= doseTarget * PRESSURE_DOSE_RATIO;
    const sensingAvailable = metrics.advanceCount > 0 && detectorConfidence >= minConfidence;

    const documentExcluded = surfaceMode === 'document'
      || loopSignals.context.contentClass === 'document';
    if (!sensingAvailable) {
      reasons.push(metrics.advanceCount <= 0 ? 'advance_evidence_missing' : 'detector_confidence_low');
    } else if (documentExcluded) {
      reasons.push('document_surface_excluded');
    } else if (surfaceMode === 'paged') {
      armed = ((meetsDoseTarget && meetsTimeFloor) || meetsTimeCeiling)
        && (
          metrics.medianDwellMs === null
          || metrics.medianDwellMs <= this._config.sensing.paged.maxMedianDwellMs
        );
      if (armed) reasons.push('paged_interrupt_threshold');
      else if (meetsPressureDose) reasons.push('paged_pressure_threshold');
    } else if (surfaceMode === 'hybrid') {
      armed = confidence >= this._config.sensing.hybrid.interruptScore && meetsPressureDose;
      if (armed) reasons.push('hybrid_interrupt_score');
      else if (confidence >= this._config.sensing.hybrid.pressureScore) {
        reasons.push('hybrid_pressure_score');
      }
    } else {
      armed = ((meetsDoseTarget && meetsTimeFloor) || meetsTimeCeiling)
        && metrics.episodeFreshItemsSeen >= this._config.sensing.continuous.minFreshItems;
      if (armed) reasons.push('continuous_interrupt_threshold');
      else if (meetsPressureDose) reasons.push('continuous_pressure_threshold');
    }

    const pressureEligible = sensingAvailable && !documentExcluded && (armed
      || meetsPressureDose
      || (surfaceMode === 'hybrid' && confidence >= this._config.sensing.hybrid.pressureScore));
    const seamArmed = armed || this._opportunityReady;
    seam = isAdvanceObservation
      ? this._seamGate.evaluate({ ts, armed: seamArmed })
      : this._seamGate.reconcile({ ts, armed: seamArmed });

    // A seam may only become an admission opportunity on a confirmed advance.
    // Supply polling can retain an already-fired result but cannot create one.
    if (
      isAdvanceObservation
      && armed
      && seam.fire
      && inhibitors.length === 0
    ) {
      this._opportunityReady = true;
    } else if (isAdvanceObservation && seam.fire && inhibitors.length > 0) {
      // A pause explained by deliberate activity is not a reusable seam. Keep the
      // sensing verdict, discard this opportunity, and wait for a fresh boundary.
      this._seamGate.release({ preserveCadence: true });
    }

    if (this._opportunityReady) {
      state = 'interrupt';
      reasons.push('feed_horizon_opportunity_ready');
    } else if (pressureEligible) {
      state = 'pressure';
      pressureSignals.push('FEED_FLOW_PRESSURE');
    }
    reasons.push(seam.decision);
    reasons.push(...inhibitors);
    if (recentContinue) reasons.push('post_continue_relapse');
    if ((metrics.supplyDemandSteps + metrics.supplyLateConfirmedSteps) >= 2) {
      reasons.push('supply_replenishment_correlated');
    }

    return {
      decisionId: createDecisionId(ts),
      ts,
      state,
      // `armed` is stage-one sensing. `opportunityReady` is the stage-two seam
      // authority consumed by Enso episode admission. Inhibitors never rewrite
      // the sensing verdict; they only postpone the opportunity.
      armed,
      opportunityReady: this._opportunityReady,
      inhibitors,
      seam,
      surfaceMode,
      confidence,
      detectorConfidence,
      loopScore,
      directTriggers,
      pressureSignals,
      reasons,
      metrics,
      burstId,
      referenceNode: source.referenceNode || null,
      loopSignals,
    };
  }
}

export default FeedFlowJudge;
