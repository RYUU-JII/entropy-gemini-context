import FeedFlowRuntime from './index.js';
import FeedSupplyProbe from './supply/FeedSupplyProbe.js';
import { DEFAULT_ENSO_FEED_HORIZON_RUNTIME_CONFIG } from './config/ensoFeedHorizonRuntimeConfig.js';

export const FEED_SUPPLY_SAMPLE_INTERVAL_MS = 250;

// One content-document producer. History and intervention own independent demand;
// neither a dashboard view nor an effect owns the producer's lifetime.
export class FeedObservationRuntime {
  constructor({
    createFlow = (observers) => new FeedFlowRuntime(observers),
    supplyProbe = new FeedSupplyProbe(),
    windowRef = globalThis.window,
    documentRef = globalThis.document,
    onFailure = (error) => console.error('[FeedObservationRuntime]', error),
  } = {}) {
    this._consumer = null;
    this._historyAllowed = false;
    this._running = false;
    this._suspended = false;
    this._timer = null;
    this._supplyTimerGeneration = 0;
    this._lifecycleListeners = new Map();
    this._cleanupPending = false;
    this._window = windowRef;
    this._document = documentRef;
    this._probe = supplyProbe;
    for (const method of ['start', 'stop', 'sample', 'setGeometryAvailable']) {
      if (typeof this._probe?.[method] !== 'function') {
        throw new Error(`FEED_OBSERVATION_SUPPLY_PROBE_METHOD_REQUIRED:${method}`);
      }
    }
    this._onFailure = onFailure;
    this._latestDeliveredDecision = null;
    this.flow = createFlow({
      onDecision: (decision) => this._deliverDecision(decision),
      onBeforeFeedSurfaceReset: (transition) => (
        this._consumer ? this._consumer.onBeforeFeedSurfaceReset(transition) : true
      ),
    });
    if (typeof this.flow?.setInterventionExposure !== 'function') {
      throw new Error('FEED_OBSERVATION_EXPOSURE_OWNER_INVALID');
    }
    this._onPageHide = () => {
      this._suspended = true;
      this._runSafely(() => this._stop());
    };
    this._onPageShow = () => {
      this._suspended = false;
      this._runSafely(() => this._reconcile());
    };
    this._onVisibilityChange = () => this._runSafely(() => this._reconcileSupplyTimer());
    this.flow.setHistoryAllowed(false);
    this.flow.setInterventionEnabled(false);
  }

  setHistoryAllowed(allowed) {
    if (typeof allowed !== 'boolean') throw new Error('FEED_OBSERVATION_HISTORY_POLICY_INVALID');
    // Revoke before stopping: finalizing an episode must not enqueue a late write.
    if (!allowed) this._historyAllowed = false;
    this.flow.setHistoryAllowed(allowed);
    this._historyAllowed = allowed;
    this._reconcile();
  }

  // Explicit capability only. Neither history nor Enso demand grants it, and
  // granting it alone does not start the producer or enable persistence.
  setEditorObservationAllowed(allowed) {
    if (typeof allowed !== 'boolean') throw new Error('EDITOR_OBSERVATION_PERMISSION_INVALID');
    this.flow.setEditorObservationAllowed(allowed);
  }

  attachConsumer(consumer, runtimeConfig) {
    if (this._consumer && this._consumer !== consumer) {
      throw new Error('FEED_OBSERVATION_ACTUATION_CONSUMER_ALREADY_ATTACHED');
    }
    if (consumer?.isSupplyObservationRequired !== undefined
      && typeof consumer.isSupplyObservationRequired !== 'function') {
      throw new Error('FEED_OBSERVATION_INSPECTION_DEMAND_INVALID');
    }
    for (const method of ['onDecision', 'onBeforeFeedSurfaceReset']) {
      if (typeof consumer?.[method] !== 'function') {
        throw new Error(`FEED_OBSERVATION_CONSUMER_METHOD_REQUIRED:${method}`);
      }
    }
    this.flow.setConfig(runtimeConfig);
    this._consumer = consumer;
    this.flow.setInterventionEnabled(true);
    this._reconcile();
    this.sample();
  }

  detachConsumer(consumer) {
    if (this._consumer !== null && this._consumer !== consumer) {
      throw new Error('FEED_OBSERVATION_CONSUMER_RELEASE_MISMATCH');
    }
    this._consumer = null;
    this.flow.setInterventionEnabled(false);
    this.flow.setConfig(DEFAULT_ENSO_FEED_HORIZON_RUNTIME_CONFIG);
    this._reconcile();
  }

  setInterventionExposure(active, { now = Date.now() } = {}) {
    if (typeof active !== 'boolean') throw new Error('FEED_OBSERVATION_EXPOSURE_INVALID');
    // Actual endpoint layout makes supply-height deltas unavailable. Native
    // movement capture continues; the endpoint owner controls this exposure.
    this._probe.setGeometryAvailable(!active);
    return this.flow.setInterventionExposure(active, { now });
  }

  sample() {
    if (!this._running || this._document?.visibilityState === 'hidden') return null;
    // A dev inspection session explicitly needs topology while warming up. It
    // shares the existing visible-document beat and never changes cadence.
    const inspectionDemand = this._consumer?.isSupplyObservationRequired?.() === true;
    if (!inspectionDemand && !this.flow.isSupplyObservationRequired()) return null;
    const now = Date.now();
    const snapshot = this._probe.sample(now);
    if (snapshot?.active === true && snapshot.readout) {
      const result = this.flow.recordSupplyReadout(snapshot.readout, { now, interaction: snapshot.interaction });
      if (result?.decision && result.decision !== this._latestDeliveredDecision) {
        this._deliverDecision(result.decision);
      }
    }
    return snapshot;
  }

  getSnapshot() {
    return Object.freeze({
      running: this._running,
      historyAllowed: this._historyAllowed,
      interventionDemand: this._consumer !== null,
      suspended: this._suspended,
      cleanupPending: this._cleanupPending,
    });
  }

  _deliverDecision(decision) {
    this._latestDeliveredDecision = decision;
    this._consumer?.onDecision(decision);
  }

  _reconcile() {
    const demanded = this._historyAllowed || this._consumer !== null;
    if (!demanded) {
      this._stop();
      const errors = [];
      for (const [type, { target, listener }] of this._lifecycleListeners) {
        try {
          target.removeEventListener(type, listener, true);
          this._lifecycleListeners.delete(type);
        } catch (error) { errors.push(error); }
      }
      if (errors.length) throw new AggregateError(errors, 'FEED_OBSERVATION_LISTENER_RELEASE_FAILED');
      this._suspended = false;
      return;
    }
    if (this._cleanupPending) throw new Error('FEED_OBSERVATION_CLEANUP_PENDING');
    for (const [target, type, listener] of [
      [this._window, 'pagehide', this._onPageHide],
      [this._window, 'pageshow', this._onPageShow],
      [this._document, 'visibilitychange', this._onVisibilityChange],
    ]) {
      if (!this._lifecycleListeners.has(type)) {
        // Retain attempted acquisition until its exact owner confirms release.
        this._lifecycleListeners.set(type, { target, listener });
        target.addEventListener(type, listener, true);
      }
    }
    if (this._running || this._suspended) return;
    // Mark ownership before acquisition so a failed start remains cleanable.
    this._running = true;
    try {
      this.flow.start();
      this._probe.start();
      this._reconcileSupplyTimer();
    } catch (error) {
      try { this._stop(); } catch (cleanupError) { error.cleanupError = cleanupError; }
      throw error;
    }
  }

  _parkSupplyTimer() {
    // A cleared callback may already be queued. It cannot sample a later lease.
    this._supplyTimerGeneration += 1;
    if (this._timer !== null) this._window.clearInterval(this._timer);
    this._timer = null;
  }

  _reconcileSupplyTimer() {
    if (!this._running || this._suspended || this._document.visibilityState === 'hidden') {
      this._parkSupplyTimer();
      return;
    }
    if (this._timer !== null || this._cleanupPending) return;
    const generation = ++this._supplyTimerGeneration;
    // Own the beat before sampling: a consumer may synchronously revoke demand.
    this._timer = this._window.setInterval(() => {
      if (generation !== this._supplyTimerGeneration) return;
      this._runSafely(() => this.sample());
    }, FEED_SUPPLY_SAMPLE_INTERVAL_MS);
    // Resume with current geometry once; hidden time never becomes sample debt.
    this.sample();
  }

  _stop() {
    if (!this._running) return;
    const errors = [];
    for (const release of [
      () => this._parkSupplyTimer(),
      () => this._probe.stop(),
      () => this.flow.stop(),
    ]) {
      try { release(); } catch (error) { errors.push(error); }
    }
    this._cleanupPending = errors.length > 0;
    if (errors.length) throw new AggregateError(errors, 'FEED_OBSERVATION_STOP_FAILED');
    this._running = false;
    this._latestDeliveredDecision = null;
  }

  _runSafely(operation) {
    try { operation(); } catch (error) { this._onFailure(error); }
  }
}

export default new FeedObservationRuntime();
