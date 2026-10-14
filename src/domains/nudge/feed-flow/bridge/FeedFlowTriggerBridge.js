import {
  cloneFeedFlowSnapshot,
  normalizeFeedFlowSnapshot,
} from '../../../protection/contracts/feedFlowSnapshotBridge.js';
import {
  clearFeedFlowDiagnosticSnapshot,
  publishFeedFlowDiagnosticSnapshot,
} from '../diagnostics/feedFlowDiagnosticState.js';
import FeedContentFlowHistoryAccumulator from './FeedContentFlowHistoryAccumulator.js';

function roundMetric(value, digits = 2) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  const scale = 10 ** digits;
  return Math.round(numeric * scale) / scale;
}

function buildDecisionFingerprint(decision = {}, snapshot = null) {
  const metrics = snapshot?.metrics && typeof snapshot.metrics === 'object'
    ? snapshot.metrics
    : (decision.metrics && typeof decision.metrics === 'object' ? decision.metrics : {});
  const reasons = Array.isArray(decision.reasons) ? decision.reasons : [];
  const directTriggers = Array.isArray(snapshot?.directTriggers)
    ? snapshot.directTriggers
    : (Array.isArray(decision.directTriggers) ? decision.directTriggers : []);
  const pressureSignals = Array.isArray(snapshot?.pressureSignals)
    ? snapshot.pressureSignals
    : (Array.isArray(decision.pressureSignals) ? decision.pressureSignals : []);
  const readiness = snapshot?.readiness || {};
  const actuationSafety = snapshot?.actuationSafety || {};

  return [
    typeof decision.burstId === 'string' ? decision.burstId : '',
    decision.observationKind || 'lifecycle',
    snapshot?.state || decision.state || 'none',
    snapshot?.candidateState || decision.candidateState || 'none',
    snapshot?.surfaceMode || decision.surfaceMode || 'unknown',
    roundMetric(snapshot?.confidence ?? decision.confidence),
    roundMetric(snapshot?.detectorConfidence ?? decision.detectorConfidence),
    roundMetric(snapshot?.loopScore ?? decision.loopScore),
    Math.max(0, Math.round(Number(metrics.advanceCount) || 0)),
    roundMetric(metrics.screenfulsConsumed),
    Math.max(0, Math.round(Number(metrics.itemTransitions) || 0)),
    Math.max(0, Math.round(Number(metrics.freshItemsSeen) || 0)),
    Number.isFinite(Number(metrics.medianDwellMs)) ? Math.max(0, Math.round(Number(metrics.medianDwellMs))) : 'null',
    Math.max(0, Math.round(Number(metrics.maxPauseMs) || 0)),
    Math.max(0, Math.round(Number(metrics.backwardIntentCount) || 0)),
    roundMetric(metrics.backtrackRatio),
    Math.max(0, Math.round(Number(metrics.recentInteractiveActionCount) || 0)),
    Math.max(0, Math.round(Number(metrics.sustainedMediaWatchMs) || 0)),
    Math.max(0, Math.round(Number(metrics.supplyTotalSteps) || 0)),
    Math.max(0, Math.round(Number(metrics.supplyDemandSteps) || 0)),
    Math.max(0, Math.round(Number(metrics.supplyLateConfirmedSteps) || 0)),
    reasons.join('|'),
    directTriggers.join('|'),
    pressureSignals.join('|'),
    readiness.status || 'pending',
    readiness.capability || 'observe_only',
    readiness.profileId || '',
    readiness.contractVersion || '',
    readiness.topologyState || 'unavailable',
    readiness.topologySource || 'none',
    readiness.shippedTopologyStatus || 'unavailable',
    Math.max(0, Math.round(Number(readiness.topologyEpoch) || 0)),
    readiness.adapterId || '',
    readiness.topologyId || '',
    readiness.topologyFingerprint || '',
    Math.max(0, Math.round(Number(readiness.topologyCertificateRevision) || 0)),
    actuationSafety.status || 'pending',
    actuationSafety.capability || 'observe_only',
  ].join('::');
}

export class FeedFlowTriggerBridge {
  constructor({
    snapshotTtlMs = 10000,
    onDecision = null,
    onInterrupt = null,
    onSnapshot = null,
    publishFeedFlowSnapshot = null,
    onRuntimeFailure = null,
    historyAccumulator = new FeedContentFlowHistoryAccumulator(),
  } = {}) {
    this._snapshotTtlMs = Math.max(1000, Math.round(Number(snapshotTtlMs) || 10000));
    this._onDecision = onDecision;
    this._onInterrupt = onInterrupt;
    this._onSnapshot = onSnapshot;
    this._publishFeedFlowSnapshot = publishFeedFlowSnapshot;
    this._onRuntimeFailure = typeof onRuntimeFailure === 'function' ? onRuntimeFailure : null;
    this._lastDecisionFingerprint = '';
    this._lastInterruptBurstId = '';
    this._lastBackgroundSnapshotPublishedAt = 0;
    this._latestSnapshot = null;
    this._snapshotRevision = 0;
    this._historyAccumulator = historyAccumulator;
    this._lastHistoryFingerprint = '';
  }

  _reportFailure(phase, error, details = {}) {
    const diagnostic = {
      phase,
      error: String(error?.message || error || 'FEED_FLOW_BRIDGE_FAILURE'),
      ...details,
    };
    if (this._onRuntimeFailure) {
      try {
        this._onRuntimeFailure(phase, error, diagnostic);
      } catch (reportError) {
        if (typeof console !== 'undefined') {
          console.warn?.('[FeedFlowTriggerBridge] failure reporter failed', reportError);
        }
      }
      return diagnostic;
    }
    if (typeof console !== 'undefined') {
      console.warn?.('[FeedFlowTriggerBridge] runtime failure', diagnostic);
    }
    return diagnostic;
  }

  _runCallback(phase, callback, ...args) {
    if (typeof callback !== 'function') return undefined;
    try {
      const result = callback(...args);
      if (result && typeof result.then === 'function') {
        void result.catch((error) => {
          this._reportFailure(phase, error);
        });
      }
      return result;
    } catch (error) {
      this._reportFailure(phase, error);
      return undefined;
    }
  }

  publish(decision = null) {
    if (!decision || typeof decision !== 'object') return false;
    let nextSnapshot = null;
    const snapshotRevision = this._snapshotRevision + 1;
    try {
      nextSnapshot = normalizeFeedFlowSnapshot({
        checkedAt: decision.ts,
        snapshotRevision,
        state: decision.state,
        candidateState: decision.candidateState,
        surfaceMode: decision.surfaceMode,
        confidence: decision.confidence,
        detectorConfidence: decision.detectorConfidence,
        loopScore: decision.loopScore,
        directTriggers: decision.directTriggers,
        pressureSignals: decision.pressureSignals,
        readiness: decision.readiness,
        actuationSafety: decision.actuationSafety,
        metrics: decision.metrics,
        expiresAt: Math.max(0, Number(decision.ts) || Date.now()) + this._snapshotTtlMs,
      });
      const history = this._historyAccumulator.observe(nextSnapshot, { burstId: decision.burstId });
      if (history !== null) {
        nextSnapshot = normalizeFeedFlowSnapshot({ ...nextSnapshot, history });
      }
    } catch (error) {
      this._reportFailure('feed_flow_bridge_snapshot_normalize', error);
      return false;
    }
    this._snapshotRevision = snapshotRevision;
    const fingerprint = buildDecisionFingerprint(decision, nextSnapshot);
    const historyFingerprint = nextSnapshot.history
      ? `${nextSnapshot.history.producerId}:${nextSnapshot.history.sequence}`
      : '';
    const historyChanged = historyFingerprint !== this._lastHistoryFingerprint;
    this._lastHistoryFingerprint = historyFingerprint;
    this._latestSnapshot = nextSnapshot;
    try {
      publishFeedFlowDiagnosticSnapshot(nextSnapshot);
    } catch (error) {
      this._reportFailure('feed_flow_bridge_diagnostic_publish', error);
    }
    if (fingerprint && fingerprint === this._lastDecisionFingerprint) {
      const heartbeatIntervalMs = Math.max(1000, Math.floor(this._snapshotTtlMs / 2));
      const checkedAt = Math.max(0, Number(nextSnapshot.checkedAt) || 0);
      const heartbeatDue = (nextSnapshot.state !== 'none' || nextSnapshot.history !== null)
        && checkedAt >= (this._lastBackgroundSnapshotPublishedAt + heartbeatIntervalMs);
      if (heartbeatDue || historyChanged) {
        this._lastBackgroundSnapshotPublishedAt = checkedAt;
        this._runCallback(
          'feed_flow_bridge_snapshot_publish',
          this._publishFeedFlowSnapshot,
          this.getLatestSnapshot(checkedAt),
        );
      }
      return false;
    }

    this._lastDecisionFingerprint = fingerprint;
    this._lastBackgroundSnapshotPublishedAt = Math.max(0, Number(nextSnapshot.checkedAt) || 0);

    this._runCallback('feed_flow_bridge_decision_callback', this._onDecision, decision);
    this._runCallback(
      'feed_flow_bridge_snapshot_callback',
      this._onSnapshot,
      cloneFeedFlowSnapshot(this._latestSnapshot),
    );
    this._runCallback('feed_flow_bridge_snapshot_publish', this._publishFeedFlowSnapshot, this.getLatestSnapshot(
      Math.max(0, Number(decision.ts) || Date.now()),
    ));

    const interruptBurstId = typeof decision.burstId === 'string' ? decision.burstId : '';
    if (nextSnapshot.state === 'interrupt' && interruptBurstId !== this._lastInterruptBurstId) {
      this._lastInterruptBurstId = interruptBurstId;
      this._runCallback('feed_flow_bridge_interrupt_callback', this._onInterrupt, decision);
    }

    return true;
  }

  getLatestSnapshot(now = Date.now()) {
    if (!this._latestSnapshot) return null;
    if (Number(this._latestSnapshot.expiresAt) <= now) return null;
    return cloneFeedFlowSnapshot(this._latestSnapshot);
  }

  setHistoryAllowed(allowed) {
    return this._historyAccumulator.setHistoryAllowed(allowed);
  }

  resetHistoryAfterDeletion(resetAt) {
    return this._historyAccumulator.resetHistoryAfterDeletion(resetAt);
  }

  clear() {
    this._lastDecisionFingerprint = '';
    this._lastInterruptBurstId = '';
    this._lastBackgroundSnapshotPublishedAt = 0;
    this._latestSnapshot = null;
    this._historyAccumulator.clearObservationBaseline();
    this._lastHistoryFingerprint = '';
    clearFeedFlowDiagnosticSnapshot();
  }
}

export default FeedFlowTriggerBridge;
