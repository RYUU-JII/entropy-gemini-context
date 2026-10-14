import FeedInputCapture from './capture/FeedInputCapture.js';
import { mergeFeedFlowLoopSignals } from './contracts/feedFlowLoopSignals.js';
import FeedAdvanceCoordinator from './confirm/FeedAdvanceCoordinator.js';
import ContinuousAdvanceAdapter from './confirm/ContinuousAdvanceAdapter.js';
import PagedAdvanceAdapter from './confirm/PagedAdvanceAdapter.js';
import HybridAdvanceAdapter from './confirm/HybridAdvanceAdapter.js';
import FeedFlowTriggerBridge from './bridge/FeedFlowTriggerBridge.js';
import { emitFeedFlowSnapshotUpdated } from './bridge/feedFlowSnapshotEvents.js';
import FeedBoundaryJudge from './judge/FeedBoundaryJudge.js';
import admissionClient from '../runtime/interventionAdmissionClient.js';
import FeedSurfaceRegistry, {
  validateResolvedFeedSurface,
} from './registry/feedSurfaceRegistry.js';
import { FEED_SURFACE_MODES } from './registry/feedSurfaceProfiles.js';
import FeedBoundaryState from './session/FeedBoundaryState.js';
import FeedStructureLearner from './learning/FeedStructureLearner.js';
import FeedActuationSafetyJudge from './actuation/FeedActuationSafetyJudge.js';
import FeedShippedTopologyProbe from './actuation/FeedShippedTopologyProbe.js';
import FeedTopologyRecoveryProtocol from './topology/FeedTopologyRecoveryProtocol.js';
import FeedTopologyCertificationRuntime from './topology/FeedTopologyCertificationRuntime.js';
import {
  GENERIC_FEED_ITEM_SELECTOR,
} from './discovery/genericFeedItemFeatures.js';
import {
  FEED_TOPOLOGY_AUTHORITY_SOURCES,
} from '../../protection/contracts/feedTopologyAuthorityContract.js';
import { publishFeedSupplyDiagnosticSnapshot } from './diagnostics/feedFlowDiagnosticState.js';
import {
  DEFAULT_ENSO_FEED_HORIZON_RUNTIME_CONFIG,
  requireEnsoFeedHorizonRuntimeConfig,
} from './config/ensoFeedHorizonRuntimeConfig.js';
import {
  recordProtectionFeatureError,
  recordProtectionFeatureEvent,
} from '../../protection/content/runtime/protectionRuntimeDiagnostics.js';

function sanitizeIntent(intent) {
  if (!intent || typeof intent !== 'object') return null;
  return {
    kind: intent.kind || 'wheel',
    ts: Math.max(0, Number(intent.ts) || Date.now()),
    direction: intent.direction || 'forward',
    deltaY: Number.isFinite(Number(intent.deltaY)) ? Number(intent.deltaY) : null,
    key: intent.key || null,
    pointerType: intent.pointerType || null,
    targetPath: Array.isArray(intent.targetPath) ? [...intent.targetPath] : [],
    sourceScroller: intent.sourceScroller || null,
  };
}

function isVisibleFeedDocument() {
  return typeof document !== 'undefined' && document.visibilityState === 'visible';
}

function reportFeedFlowRuntimeFailure(phase, error, details = {}) {
  recordProtectionFeatureError('infiniteScrollGuard', error, {
    phase,
    error: String(error?.message || error || 'FEED_FLOW_RUNTIME_FAILURE'),
    ...details,
  });
}

function createRuntimeLifecycleError(message, errors) {
  const normalizedErrors = Array.isArray(errors) ? errors.filter(Boolean) : [];
  const AggregateErrorCtor = globalThis?.AggregateError;
  if (typeof AggregateErrorCtor === 'function') {
    return new AggregateErrorCtor(normalizedErrors, message);
  }
  const error = new Error(message);
  error.errors = normalizedErrors;
  if (normalizedErrors[0]) error.cause = normalizedErrors[0];
  return error;
}

function collectCleanupFailure(errors, phase, error) {
  const normalizedError = error instanceof Error
    ? error
    : new Error(String(error || 'FEED_FLOW_RUNTIME_CLEANUP_FAILED'));
  normalizedError.phase = phase;
  errors.push(normalizedError);
}

const DYNAMIC_SURFACE_REFRESH_MS = 1500;
const READY_SURFACE_VALIDATION_MS = 10000;
const LEARNING_HEARTBEAT_MS = 1000;
const SHIPPED_TOPOLOGY_HEALTH_REFRESH_MS = 750;
const TERMINUS_RELEASE_SOURCES = new Set([
  'endpoint_invalidated',
  'enso_leave',
  'enso_suppressed',
  'enso_episode_aborted',
]);

function normalizeTerminusReleaseSource(source) {
  if (typeof source !== 'string' || !TERMINUS_RELEASE_SOURCES.has(source)) {
    throw new Error(`FEED_TERMINUS_RELEASE_SOURCE_INVALID:${String(source || '')}`);
  }
  return source;
}

function uniqueStrings(values = []) {
  return Array.from(new Set(values.filter((value) => typeof value === 'string' && value)));
}

function resolveEffectiveSurfaceMode(surface, runtimeConfig) {
  const forcedMode = runtimeConfig?.sensing?.mode;
  if (typeof forcedMode === 'string' && forcedMode && forcedMode !== 'auto') return forcedMode;
  if (surface === null) return FEED_SURFACE_MODES.UNKNOWN;
  return surface.surfaceMode;
}

function buildTopologyCertificationSurface(surface, runtimeConfig) {
  if (!surface || typeof surface !== 'object') return null;
  return {
    ...surface,
    surfaceMode: resolveEffectiveSurfaceMode(surface, runtimeConfig),
    contentClass: surface.contentClass,
    candidateItemSelectors: GENERIC_FEED_ITEM_SELECTOR,
  };
}

function buildShippedTopologyProbeSurface(surface, runtimeConfig) {
  if (!surface || typeof surface !== 'object') return null;
  return {
    ...surface,
    surfaceMode: resolveEffectiveSurfaceMode(surface, runtimeConfig),
    contentClass: surface.contentClass,
  };
}

function buildSurfaceSignature(surface) {
  if (!surface || typeof surface !== 'object') return '';
  return [
    surface.profileId,
    surface.hostname,
    surface.semanticSurfaceId,
    surface.surfaceMode,
    surface.contentClass,
    surface.candidateItemSelectors,
    surface.dominantItemSelectors,
  ].join('::');
}

function buildLocalActuationContext(event, surface, runtimeConfig) {
  if (!event || typeof event !== 'object' || !surface) return null;
  return {
    capturedAt: Math.max(0, Number(event.ts) || Date.now()),
    profileId: surface.profileId,
    hostname: surface.hostname,
    pathname: surface.pathname,
    semanticSurfaceId: surface.semanticSurfaceId,
    surfaceMode: typeof event.surfaceMode === 'string' && event.surfaceMode
      ? event.surfaceMode
      : resolveEffectiveSurfaceMode(surface, runtimeConfig),
    candidateItemSelectors: surface.candidateItemSelectors,
    dominantItemSelectors: surface.dominantItemSelectors,
    scrollerHint: surface.scrollerHint,
    referenceNode: event.referenceNode || null,
    activeScroller: event.activeScroller || null,
  };
}

function cloneTopologyAuthority(authority) {
  if (!authority || typeof authority !== 'object') return null;
  return {
    ...authority,
    reasons: Array.isArray(authority.reasons) ? [...authority.reasons] : [],
  };
}

function attachTopologyAuthority(
  actuationContext,
  topologyAuthority,
  localTopology = null,
) {
  if (!actuationContext || !topologyAuthority) return null;
  return {
    ...actuationContext,
    topologyAuthority: cloneTopologyAuthority(topologyAuthority),
    localTopology,
  };
}

export class FeedFlowRuntime {
  constructor({
    surfaceRegistry = null,
    capture = null,
    coordinator = null,
    continuousAdapter = new ContinuousAdvanceAdapter(),
    pagedAdapter = new PagedAdvanceAdapter(),
    hybridAdapter = new HybridAdvanceAdapter(),
    burstMachine = new FeedBoundaryState(),
    judge = new FeedBoundaryJudge(),
    structureLearner = null,
    structureLearnerFactory = ({ knownProfile }) => new FeedStructureLearner({ knownProfile }),
    topologyRecoveryProtocol = new FeedTopologyRecoveryProtocol(),
    topologyCertificationRuntime = new FeedTopologyCertificationRuntime(),
    shippedTopologyProbe = new FeedShippedTopologyProbe(),
    actuationSafetyJudge = new FeedActuationSafetyJudge(),
    triggerBridge = null,
    onDecision = null,
    onInterrupt = null,
    onBeforeFeedSurfaceReset = null,
  } = {}) {
    if (
      onBeforeFeedSurfaceReset !== null
      && typeof onBeforeFeedSurfaceReset !== 'function'
    ) {
      throw new Error('FEED_FLOW_SURFACE_RESET_OBSERVER_INVALID');
    }
    this._surfaceRegistry = surfaceRegistry === null
      ? new FeedSurfaceRegistry({
        onRuntimeFailure: reportFeedFlowRuntimeFailure,
      })
      : surfaceRegistry;
    if (typeof this._surfaceRegistry?.resolve !== 'function') {
      throw new Error('FEED_SURFACE_REGISTRY_INVALID');
    }
    this._continuousAdapter = continuousAdapter;
    this._pagedAdapter = pagedAdapter;
    this._hybridAdapter = hybridAdapter;
    this._burstMachine = burstMachine;
    this._judge = judge;
    ['setConfig', 'evaluate', 'reset'].forEach((method) => {
      if (typeof this._judge?.[method] !== 'function') {
        throw new Error(`FEED_FLOW_JUDGE_METHOD_REQUIRED:${method}`);
      }
    });
    this._providedStructureLearner = structureLearner;
    this._structureLearnerFactory = structureLearnerFactory;
    this._structureLearner = structureLearner;
    if (
      !topologyRecoveryProtocol
      || typeof topologyRecoveryProtocol.evaluate !== 'function'
      || typeof topologyRecoveryProtocol.reset !== 'function'
      || typeof topologyRecoveryProtocol.getSnapshot !== 'function'
    ) {
      throw new Error('FEED_TOPOLOGY_RECOVERY_PROTOCOL_INVALID');
    }
    this._topologyRecoveryProtocol = topologyRecoveryProtocol;
    [
      'start',
      'stop',
      'setSurface',
      'observe',
      'resetLiveVerification',
      'getAuthorityEvidence',
      'getActuationTopology',
      'getSnapshot',
    ].forEach((method) => {
      if (typeof topologyCertificationRuntime?.[method] !== 'function') {
        throw new Error(`FEED_TOPOLOGY_CERTIFICATION_RUNTIME_METHOD_REQUIRED:${method}`);
      }
    });
    this._topologyCertificationRuntime = topologyCertificationRuntime;
    if (!shippedTopologyProbe || typeof shippedTopologyProbe.inspect !== 'function') {
      throw new Error('FEED_SHIPPED_TOPOLOGY_PROBE_INVALID');
    }
    this._shippedTopologyProbe = shippedTopologyProbe;
    this._actuationSafetyJudge = actuationSafetyJudge;
    this._onBeforeFeedSurfaceReset = onBeforeFeedSurfaceReset;
    this._triggerBridge = triggerBridge || new FeedFlowTriggerBridge({
      onDecision,
      onInterrupt,
      publishFeedFlowSnapshot: (snapshot) => emitFeedFlowSnapshotUpdated({
        snapshot,
        onHistoryResetRequired: (resetAt) => this._triggerBridge.resetHistoryAfterDeletion(resetAt),
      }),
      onRuntimeFailure: reportFeedFlowRuntimeFailure,
    });
    this._coordinator = coordinator || new FeedAdvanceCoordinator({
      continuousAdapter: this._continuousAdapter,
      pagedAdapter: this._pagedAdapter,
      hybridAdapter: this._hybridAdapter,
      onAdvanceEvent: (event) => {
        if (!this._running) return;
        this.recordAdvanceEvent(event);
      },
      onRuntimeFailure: reportFeedFlowRuntimeFailure,
    });
    this._capture = capture || new FeedInputCapture({
      onAdvanceIntent: (intent) => this._running && this._handleAdvanceIntent(intent),
      onActivity: (activity) => {
        if (!this._running || !isVisibleFeedDocument()) return;
        this._refreshSurfaceIfNeeded();
        this._coordinator.handleActivity(activity);
        this._evaluateBehaviorChange(activity.ts);
      },
      onMutation: (payload) => {
        if (!this._running) return;
        this._handleMutationPayload(payload);
      },
      onVisibilityChange: (payload) => {
        if (!this._running) return;
        this._coordinator.handleVisibilityChange(payload);
        if (payload?.visibilityState && payload.visibilityState !== 'visible') {
          this._suspendForVisibility(payload);
        } else if (payload?.visibilityState === 'visible') {
          void admissionClient.refreshEnsoCadence().catch((error) => reportFeedFlowRuntimeFailure('cadence_refresh', error));
          // Re-seed current DOM identities before queued mutation delivery or
          // the next gesture can treat hidden changes as fresh consumption.
          this._coordinator.setSurface(this._surface);
        }
      },
      onRuntimeFailure: reportFeedFlowRuntimeFailure,
    });
    this._surface = null;
    this._lastIntent = null;
    this._running = false;
    this._interventionEnabled = true;
    this._historyAllowed = false;
    this._interventionExposed = false;
    this._runtimeConfig = DEFAULT_ENSO_FEED_HORIZON_RUNTIME_CONFIG;
    this._latestDecision = null;
    this._decisionLifecycle = { burstId: '', state: 'none' };
    this._lastSurfaceRefreshAt = 0;
    this._lastLearningHeartbeatAt = 0;
    this._lastSupplyLearning = null;
    this._latestActuationContext = null;
    this._lastShippedTopologyHealth = null;
  }

  _handleAdvanceIntent(intent) {
    if (!isVisibleFeedDocument()) return false;
    this._lastIntent = intent;
    this._refreshSurfaceIfNeeded();
    this._coordinator.handleIntent(intent);
    if (intent.direction === 'backward') this._evaluateBehaviorChange(intent.ts);
    return true;
  }

  _withCurrentBehavior(snapshot, now) {
    return {
      ...snapshot,
      loopSignals: mergeFeedFlowLoopSignals(
        snapshot.loopSignals, this._coordinator.getBehaviorSignals(now),
      ),
    };
  }

  _evaluateBehaviorChange(now) {
    // Cancel a pending opportunity immediately; ordinary activity is projected
    // by the existing supply beat. Avoid another full decision per keystroke.
    if (this._latestDecision?.opportunityReady !== true) return null;
    return this._evaluateAndPublish(
      this._withCurrentBehavior(this._burstMachine.getSnapshot(), now),
      { now, observationKind: 'lifecycle' },
    );
  }

  start({
    hostname = typeof window !== 'undefined' ? window.location?.hostname || '' : '',
    pathname = typeof window !== 'undefined' ? window.location?.pathname || '' : '',
  } = {}) {
    try {
      this._surface = validateResolvedFeedSurface(
        this._surfaceRegistry.resolve({ hostname, pathname }),
      );
      this._judge.reset();
      this._latestActuationContext = null;
      this._topologyRecoveryProtocol.reset();
      this._topologyCertificationRuntime.start({
        surface: buildTopologyCertificationSurface(
          this._surface,
          this._runtimeConfig,
        ),
      });
      this._initializeStructureLearner(this._surface);
      this._observeSurfaceLearning();
      this._observeTopologyCertification(Date.now());
      this._coordinator.setSurface(this._surface);
      this._coordinator.setConfig(this._runtimeConfig);
      this._capture.start();
      this._running = true;
      return this.getState();
    } catch (error) {
      reportFeedFlowRuntimeFailure('feed_flow_runtime_start', error, {
        hostname,
        pathname,
      });
      try {
        this.stop();
      } catch (cleanupError) {
        if (error && typeof error === 'object') error.cleanupError = cleanupError;
      }
      throw error;
    }
  }

  stop() {
    // Fence retained callbacks before cleanup begins, including failed cleanup.
    this._running = false;
    const errors = [];
    try {
      this._capture.stop();
    } catch (error) {
      collectCleanupFailure(errors, 'feed_flow_capture_stop', error);
    }
    try {
      this._coordinator.stop();
    } catch (error) {
      collectCleanupFailure(errors, 'feed_flow_coordinator_stop', error);
    }
    try {
      this._burstMachine.reset({ preserveControl: false });
    } catch (error) {
      collectCleanupFailure(errors, 'feed_flow_burst_reset', error);
    }
    try {
      this._judge.reset();
    } catch (error) {
      collectCleanupFailure(errors, 'feed_flow_judge_reset', error);
    }
    try {
      this._topologyCertificationRuntime.stop();
    } catch (error) {
      collectCleanupFailure(errors, 'feed_topology_certification_runtime_stop', error);
    }
    try {
      this._triggerBridge.clear();
    } catch (error) {
      collectCleanupFailure(errors, 'feed_flow_trigger_bridge_clear', error);
    }
    try {
      this._structureLearner?.reset?.();
    } catch (error) {
      collectCleanupFailure(errors, 'feed_flow_structure_learner_reset', error);
    }
    try {
      this._topologyRecoveryProtocol.reset();
    } catch (error) {
      collectCleanupFailure(errors, 'feed_topology_recovery_protocol_reset', error);
    }
    this._surface = null;
    this._lastIntent = null;
    this._running = false;
    this._latestDecision = null;
    this._decisionLifecycle = { burstId: '', state: 'none' };
    this._lastSurfaceRefreshAt = 0;
    this._lastLearningHeartbeatAt = 0;
    this._lastSupplyLearning = null;
    this._latestActuationContext = null;
    this._lastShippedTopologyHealth = null;
    if (errors.length > 0) {
      throw createRuntimeLifecycleError('FEED_FLOW_RUNTIME_STOP_FAILED', errors);
    }
  }

  setConfig(runtimeConfig) {
    const previousEffectiveMode = resolveEffectiveSurfaceMode(this._surface, this._runtimeConfig);
    this._runtimeConfig = requireEnsoFeedHorizonRuntimeConfig(runtimeConfig);
    this._judge.setConfig(this._runtimeConfig);
    this._coordinator.setConfig(this._runtimeConfig);
    const nextEffectiveMode = resolveEffectiveSurfaceMode(this._surface, this._runtimeConfig);
    if (this._running && previousEffectiveMode !== nextEffectiveMode) {
      this._burstMachine.reset({ preserveControl: true, preserveEpisode: false });
      this._latestActuationContext = null;
      this._decisionLifecycle = { burstId: '', state: 'none' };
      this._initializeStructureLearner(this._surface);
      this._topologyRecoveryProtocol.reset();
      this._topologyCertificationRuntime.setSurface(
        buildTopologyCertificationSurface(this._surface, this._runtimeConfig),
      );
      this._lastLearningHeartbeatAt = 0;
      this._lastSupplyLearning = null;
      this._observeSurfaceLearning();
      this._observeTopologyCertification(Date.now());
      this._publishNeutralDecision(Date.now());
    }
  }

  markContinue({
    now = Date.now(),
  } = {}) {
    const normalizedNow = Math.max(0, Number(now) || Date.now());
    // End the local boundary before the asynchronous background receipt is
    // refreshed. Resetting observed counters alone cannot retire an opportunity.
    this._judge.reset();
    const snapshot = this._burstMachine.markContinue({
      now: normalizedNow,
    });
    const previousDecisionLifecycle = this._decisionLifecycle;
    try {
      const decision = this._evaluateAndPublish(snapshot, {
        now: normalizedNow,
        observationKind: 'lifecycle',
        requireTransition: true,
      });
      if (decision.state === 'interrupt') {
        throw new Error('FEED_FLOW_CONTINUE_DECISION_NOT_RELEASED');
      }
      return decision;
    } catch (error) {
      this._decisionLifecycle = previousDecisionLifecycle;
      throw error;
    }
  }

  consumeOpportunity({
    decisionId = '',
    reason = 'enso_admission_withheld',
  } = {}) {
    const opportunity = this._latestDecision;
    const normalizedDecisionId = typeof decisionId === 'string' ? decisionId : '';
    if (
      !normalizedDecisionId
      || opportunity?.opportunityReady !== true
      || opportunity.decisionId !== normalizedDecisionId
    ) {
      return false;
    }

    this._judge.releaseOpportunity({ preserveCadence: true });
    this._latestDecision = {
      ...opportunity, state: 'pressure', candidateState: 'pressure', opportunityReady: false,
      reasons: uniqueStrings([...(opportunity.reasons || []), 'feed_horizon_opportunity_consumed']),
    };
    recordProtectionFeatureEvent('infiniteScrollGuard', 'feed_horizon_opportunity_consumed', {
      decisionId: opportunity.decisionId,
      surfaceMode: opportunity.surfaceMode,
      reason: typeof reason === 'string' && reason ? reason : 'enso_admission_withheld',
    });
    return true;
  }

  markRetreat({ now = Date.now(), source = 'enso_episode_aborted', preserveConsumption = false } = {}) {
    const normalizedSource = normalizeTerminusReleaseSource(source);
    const normalizedNow = Math.max(0, Number(now) || Date.now());
    const previousDecisionLifecycle = this._decisionLifecycle;
    let decision = null;
    try {
      if (preserveConsumption) {
        this._judge.releaseOpportunity({ preserveCadence: true });
      } else {
        this._burstMachine.reset({ preserveControl: true, preserveEpisode: false });
        this._judge.reset();
      }
      this._decisionLifecycle = { burstId: '', state: 'none' };
      decision = this._publishNeutralDecision(normalizedNow, { requireTransition: true });
    } catch (error) {
      this._decisionLifecycle = previousDecisionLifecycle;
      throw error;
    }
    recordProtectionFeatureEvent('infiniteScrollGuard', 'feed_terminus_retreat', {
      surfaceMode: this._surface?.surfaceMode || 'unknown',
      source: normalizedSource,
      preserveConsumption,
    });
    return decision;
  }

  recordAdvanceEvent(event = {}) {
    if (!isVisibleFeedDocument()) return null;
    this._latestActuationContext = buildLocalActuationContext(
      event,
      this._surface,
      this._runtimeConfig,
    );
    this._observeAdvanceLearning(event);
    this._observeTopologyCertification(
      Math.max(0, Number(event?.ts) || Date.now()),
    );
    const snapshot = this._burstMachine.recordAdvance(event);
    const decision = this._evaluateAndPublish(snapshot, {
      now: Math.max(0, Number(event?.ts) || Number(snapshot?.lastAdvanceAt) || Date.now()),
      observationKind: 'advance',
    });
    return {
      snapshot,
      decision,
    };
  }

  recordSupplyReadout(readout = null, {
    now = Date.now(),
    interaction = null,
  } = {}) {
    if (!isVisibleFeedDocument()) return null;
    if (!readout || typeof readout !== 'object') return null;
    const normalizedNow = Math.max(0, Number(now) || Date.now());
    publishFeedSupplyDiagnosticSnapshot({
      active: true,
      checkedAt: normalizedNow,
      readout,
      interaction,
    });
    this._refreshSurfaceIfNeeded({
      allowDynamicClassification: true,
      now: normalizedNow,
    });
    this._observeSupplyLearning(readout, normalizedNow);
    this._observeTopologyCertification(normalizedNow);
    const snapshot = this._withCurrentBehavior(
      this._burstMachine.updateSupplySignals(readout, { now: normalizedNow }), normalizedNow,
    );
    const decision = this._evaluateAndPublish(snapshot, {
      interaction,
      now: normalizedNow,
      observationKind: 'supply',
    });
    return {
      snapshot,
      decision,
    };
  }

  getState() {
    const readiness = this._latestDecision?.readiness
      || this._resolveTopologyAuthority();
    return {
      running: this._running,
      surface: this._surface ? { ...this._surface } : null,
      burstState: this._burstMachine.getState(),
      latestSnapshot: this._triggerBridge.getLatestSnapshot(),
      latestDecision: this._latestDecision,
      topologyCertification: this._topologyCertificationRuntime.getSnapshot(),
      readiness,
      lastIntent: sanitizeIntent(this._lastIntent),
    };
  }

  setEditorObservationAllowed(allowed) { this._capture.setEditorObservationAllowed(allowed); }

  getEditorObservationSnapshot() { return this._capture.getEditorObservationSnapshot(); }

  setHistoryAllowed(allowed) {
    if (!allowed) this._historyAllowed = false;
    this._triggerBridge.setHistoryAllowed(allowed);
    this._historyAllowed = allowed;
  }

  isSupplyObservationRequired() {
    return this._historyAllowed || this._interventionExposed
      || this._goalBoundaryDemand === true
      || admissionClient.getEnsoCadence()?.eligible === true;
  }

  setGoalBoundaryDemand(required) {
    if (typeof required !== 'boolean') throw new Error('FEED_GOAL_BOUNDARY_DEMAND_INVALID');
    if (typeof this._judge.setGoalDemand !== 'function') throw new Error('FEED_GOAL_BOUNDARY_JUDGE_REQUIRED');
    this._goalBoundaryDemand = required;
    this._judge.setGoalDemand(required);
  }

  setInterventionExposure(active) {
    if (typeof active !== 'boolean') throw new Error('FEED_EXPOSURE_INVALID');
    this._interventionExposed = active;
  }

  setInterventionEnabled(enabled) {
    if (typeof enabled !== 'boolean') throw new Error('FEED_INTERVENTION_DEMAND_INVALID');
    if (enabled === this._interventionEnabled) return;
    this._interventionEnabled = enabled;
    this._decisionLifecycle = { burstId: '', state: 'none' };
    this._burstMachine.clearInterventionControl();
  }

  // DOM references are intentionally exposed only through this content-local
  // actuation seam. FeedFlowTriggerBridge keeps using its scalar allowlist, so
  // this context never enters background snapshots or persistent diagnostics.
  getActuationContext() {
    if (!this._latestActuationContext) return null;
    const now = Date.now();
    return this._buildAuthorizedActuationContext(
      this._latestDecision?.readiness || this._resolveTopologyAuthority(now),
      now,
    );
  }

  getModules() {
    return {
      surfaceRegistry: this._surfaceRegistry,
      capture: this._capture,
      coordinator: this._coordinator,
      continuousAdapter: this._continuousAdapter,
      pagedAdapter: this._pagedAdapter,
      hybridAdapter: this._hybridAdapter,
      burstMachine: this._burstMachine,
      judge: this._judge,
      structureLearner: this._structureLearner,
      topologyRecoveryProtocol: this._topologyRecoveryProtocol,
      topologyCertificationRuntime: this._topologyCertificationRuntime,
      shippedTopologyProbe: this._shippedTopologyProbe,
      actuationSafetyJudge: this._actuationSafetyJudge,
      triggerBridge: this._triggerBridge,
    };
  }

  _evaluateAndPublish(snapshot, {
    interaction = null,
    now = null,
    observationKind = 'lifecycle',
    requireTransition = false,
  } = {}) {
    const candidateDecision = {
      ...this._judge.evaluate(snapshot, { now, observationKind }),
      surfaceMode: resolveEffectiveSurfaceMode(this._surface, this._runtimeConfig),
    };
    let decision = candidateDecision;
    const readiness = this._resolveTopologyAuthority(
      Math.max(0, Number(now) || Date.now()),
    );
    const actuationContext = this._buildAuthorizedActuationContext(
      readiness,
      Math.max(0, Number(now) || Date.now()),
    );
    const actuationSafety = this._actuationSafetyJudge.evaluate({
      decision: candidateDecision,
      surface: this._surface,
      readiness,
      interaction,
      actuationContext,
    });
    decision = this._finalizeDecisionAuthority(
      decision,
      candidateDecision?.state || 'none',
      readiness,
      actuationSafety,
    );

    // Unreserved opportunities always use current evidence and inhibitors.
    // Once committed, endpoint continuity belongs to the episode manager.
    decision = { ...this._applyDecisionLifecycle(decision), observationKind };
    // Admission may synchronously consume this exact opportunity in publish().
    // Install its identity first and never overwrite that consumption afterward.
    const previousDecision = this._latestDecision;
    this._latestDecision = decision;
    try {
      const published = this._triggerBridge.publish(decision);
      if (requireTransition && published !== true) {
        throw new Error('FEED_FLOW_DECISION_TRANSITION_PUBLISH_FAILED');
      }
    } catch (error) {
      this._latestDecision = previousDecision;
      throw error;
    }
    return decision;
  }

  _finalizeDecisionAuthority(decision, candidateState, readiness, actuationSafety) {
    const source = decision && typeof decision === 'object' ? decision : {};
    const normalizedCandidateState = candidateState || source.state || 'none';
    if (normalizedCandidateState !== 'interrupt' || actuationSafety?.status === 'safe') {
      return {
        ...source,
        candidateState: normalizedCandidateState,
        readiness,
        actuationSafety,
      };
    }

    return {
      ...source,
      candidateState: normalizedCandidateState,
      state: 'pressure',
      directTriggers: [],
      pressureSignals: uniqueStrings([
        ...(Array.isArray(source.pressureSignals) ? source.pressureSignals : []),
        'FEED_FLOW_PRESSURE',
      ]),
      reasons: uniqueStrings([
        ...(Array.isArray(source.reasons) ? source.reasons : []),
        ...(Array.isArray(actuationSafety?.reasons) ? actuationSafety.reasons : []),
        'actuation_deferred',
      ]),
      readiness,
      actuationSafety,
    };
  }

  _applyDecisionLifecycle(decision) {
    // Candidate publication is diagnostic only. Admission/presentation owners
    // control cooldown and exposure; detection never spends consumption evidence.
    if (!this._interventionEnabled) return decision;
    const burstId = typeof decision?.burstId === 'string' ? decision.burstId : '';
    const state = decision?.state || 'none';
    const isSameLifecycleState = this._decisionLifecycle.burstId === burstId
      && this._decisionLifecycle.state === state;

    if (state === 'pressure' && !isSameLifecycleState) {
      recordProtectionFeatureEvent('infiniteScrollGuard', 'feed_flow_pressure', {
        burstId,
        surfaceMode: decision.surfaceMode,
        confidence: decision.confidence,
        loopScore: decision.loopScore,
        readiness: decision.readiness,
        actuationSafety: decision.actuationSafety,
        reasons: decision.reasons,
        metrics: decision.metrics,
      });
    }

    this._decisionLifecycle = { burstId, state };
    return decision;
  }

  _initializeStructureLearner(surface) {
    if (this._providedStructureLearner) {
      this._structureLearner = this._providedStructureLearner;
      this._structureLearner.reset();
      return;
    }
    if (typeof this._structureLearnerFactory !== 'function') {
      throw new Error('FEED_STRUCTURE_LEARNER_FACTORY_REQUIRED');
    }
    this._structureLearner = this._structureLearnerFactory({
      knownProfile: !!surface?.profileId && surface.profileId !== 'default',
    });
    if (!this._structureLearner || typeof this._structureLearner.observe !== 'function') {
      throw new Error('FEED_STRUCTURE_LEARNER_INVALID');
    }
  }

  _resolveTopologyAuthority(now = Date.now()) {
    const evaluatedAt = Math.max(0, Math.round(Number(now) || Date.now()));
    const probeSurface = buildShippedTopologyProbeSurface(
      this._surface,
      this._runtimeConfig,
    );
    const probeSurfaceSignature = buildSurfaceSignature(probeSurface);
    const referenceNode = this._latestActuationContext?.referenceNode || null;
    const activeScroller = this._latestActuationContext?.activeScroller || null;
    const previousProbe = this._lastShippedTopologyHealth;
    const probeAgeMs = previousProbe
      ? evaluatedAt - previousProbe.checkedAt
      : Number.POSITIVE_INFINITY;
    const canReusePreviousProbe = previousProbe !== null
      && previousProbe.surfaceSignature === probeSurfaceSignature
      && previousProbe.referenceNode === referenceNode
      && previousProbe.activeScroller === activeScroller
      && probeAgeMs >= 0
      && probeAgeMs < SHIPPED_TOPOLOGY_HEALTH_REFRESH_MS;
    const shippedTopologyHealth = canReusePreviousProbe
      ? previousProbe.health
      : this._shippedTopologyProbe.inspect({
        surface: probeSurface,
        actuationContext: this._latestActuationContext,
      });
    if (!canReusePreviousProbe) {
      this._lastShippedTopologyHealth = {
        checkedAt: evaluatedAt,
        surfaceSignature: probeSurfaceSignature,
        referenceNode,
        activeScroller,
        health: shippedTopologyHealth,
      };
    }
    return this._topologyRecoveryProtocol.evaluate({
      surface: this._surface,
      learnerSnapshot: this._structureLearner?.getSnapshot?.() || null,
      effectiveSurfaceMode: resolveEffectiveSurfaceMode(
        this._surface,
        this._runtimeConfig,
      ),
      localCertificationEvidence: this._topologyCertificationRuntime
        .getAuthorityEvidence({ now: evaluatedAt }),
      shippedTopologyHealth,
      now: evaluatedAt,
    });
  }

  _buildAuthorizedActuationContext(readiness, now) {
    if (!this._latestActuationContext || !readiness) return null;
    const localTopology = (
      readiness.topologySource === FEED_TOPOLOGY_AUTHORITY_SOURCES.LOCAL_CERTIFIED
    )
      ? this._topologyCertificationRuntime.getActuationTopology(
        this._latestActuationContext,
        { now },
      )
      : null;
    return attachTopologyAuthority(
      this._latestActuationContext,
      readiness,
      localTopology,
    );
  }

  _observeTopologyCertification(now = Date.now()) {
    if (!this._running && !this._surface) return null;
    return this._topologyCertificationRuntime.observe({
      learnerSnapshot: this._structureLearner?.getSnapshot?.() || null,
      actuationContext: this._latestActuationContext,
      now: Math.max(0, Math.round(Number(now) || Date.now())),
    });
  }

  _observeSurfaceLearning(patch = {}) {
    if (!this._structureLearner || !this._surface) return;
    this._structureLearner.observe({
      surfaceMode: resolveEffectiveSurfaceMode(this._surface, this._runtimeConfig),
      surfaceConfidence: Math.max(0, Math.min(1, Number(this._surface.surfaceConfidence) || 0)),
      ...patch,
    });
  }

  _observeAdvanceLearning(event = {}) {
    if (!this._structureLearner) return;
    const transitionConfirmed = Math.max(0, Number(event.itemTransitionCount) || 0) > 0
      || event?.evidence?.dominantItemChanged === true;
    this._observeSurfaceLearning({
      dominantTransitionConfirmed: transitionConfirmed,
    });
  }

  _observeSupplyLearning(readout, now) {
    if (!this._structureLearner) return;
    const previous = this._lastSupplyLearning;
    const containerKey = typeof readout.containerKey === 'string' ? readout.containerKey : '';
    const totalSteps = Math.max(0, Math.round(Number(readout.totalSteps) || 0));
    const demandSteps = Math.max(0, Math.round(Number(readout.demandSteps) || 0));
    const lastStepAt = Math.max(0, Math.round(Number(readout.lastStepAt) || 0));
    const containerReset = !!previous && (
      (previous.containerKey && containerKey && previous.containerKey !== containerKey)
      || totalSteps < previous.totalSteps
    );
    const heartbeatDue = !this._lastLearningHeartbeatAt
      || (now - this._lastLearningHeartbeatAt) >= LEARNING_HEARTBEAT_MS;

    if (!previous) {
      this._observeSurfaceLearning({ containerReset: false });
      this._lastLearningHeartbeatAt = now;
      this._lastSupplyLearning = {
        containerKey,
        totalSteps,
        demandSteps,
        lastStepAt,
      };
      return;
    }

    const supplyStep = totalSteps > previous.totalSteps;
    if (heartbeatDue || containerReset || supplyStep) {
      const observation = {};
      if (heartbeatDue || containerReset) {
        observation.containerReset = containerReset;
        this._lastLearningHeartbeatAt = now;
      }
      if (supplyStep) {
        const normalizedStepSize = Number(readout.lastThresholdPx) > 0
          ? Number(readout.lastDeltaPx) / Number(readout.lastThresholdPx)
          : null;
        const appendIntervalMs = previous.lastStepAt > 0 && lastStepAt > previous.lastStepAt
          ? lastStepAt - previous.lastStepAt
          : null;
        observation.supplyStep = true;
        observation.demand = demandSteps > previous.demandSteps;
        if (Number.isFinite(normalizedStepSize) && normalizedStepSize > 0) {
          observation.normalizedStepSize = Math.min(64, normalizedStepSize);
        }
        if (Number.isFinite(appendIntervalMs) && appendIntervalMs > 0) {
          observation.appendIntervalMs = Math.min(600000, appendIntervalMs);
        }
      }
      this._observeSurfaceLearning(observation);
    }

    this._lastSupplyLearning = {
      containerKey,
      totalSteps,
      demandSteps,
      lastStepAt,
    };
  }

  _suspendForVisibility(payload = {}) {
    const now = Math.max(0, Number(payload.ts) || Date.now());
    publishFeedSupplyDiagnosticSnapshot({
      active: false,
      checkedAt: now,
      readout: null,
      interaction: null,
    });
    this._burstMachine.reset({ preserveControl: true, preserveEpisode: false });
    this._judge.reset();
    this._decisionLifecycle = { burstId: '', state: 'none' };
    this._lastSupplyLearning = null;
    this._latestActuationContext = null;
    this._topologyCertificationRuntime.resetLiveVerification({
      reason: 'document_hidden',
    });
    const decision = this._publishNeutralDecision(now);
    recordProtectionFeatureEvent('infiniteScrollGuard', 'feed_flow_visibility_suspended', {
      visibilityState: payload.visibilityState,
      readiness: decision.readiness,
    });
  }

  _publishNeutralDecision(now, { requireTransition = false } = {}) {
    const snapshot = this._burstMachine.getSnapshot();
    const surfaceMode = resolveEffectiveSurfaceMode(this._surface, this._runtimeConfig);
    const candidateDecision = {
      ...this._judge.evaluate(snapshot, { now, observationKind: 'lifecycle' }),
      surfaceMode,
    };
    const readiness = this._resolveTopologyAuthority();
    const actuationContext = attachTopologyAuthority(
      this._latestActuationContext,
      readiness,
    );
    const actuationSafety = this._actuationSafetyJudge.evaluate({
      decision: candidateDecision,
      surface: this._surface,
      readiness,
      actuationContext,
    });
    const decision = this._finalizeDecisionAuthority(
      candidateDecision,
      candidateDecision?.state || 'none',
      readiness,
      actuationSafety,
    );
    const published = this._triggerBridge.publish(decision);
    if (requireTransition && published !== true) {
      throw new Error('FEED_FLOW_NEUTRAL_DECISION_PUBLISH_FAILED');
    }
    this._latestDecision = decision;
    return decision;
  }

  _handleMutationPayload(payload) {
    if (!isVisibleFeedDocument()) return false;
    this._refreshSurfaceIfNeeded({ allowDynamicClassification: true, now: payload?.ts });
    if (this._surface?.surfaceMode === FEED_SURFACE_MODES.DOCUMENT) return false;
    this._coordinator.handleMutation(payload);
    return true;
  }

  _refreshSurfaceIfNeeded({
    allowDynamicClassification = false,
    now = Date.now(),
  } = {}) {
    if (!this._running || typeof window === 'undefined') return;
    const hostname = window.location?.hostname || '';
    const pathname = window.location?.pathname || '';
    const rawRouteChanged = this._surface?.hostname !== hostname || this._surface?.pathname !== pathname;
    const learningReady = this._structureLearner?.getSnapshot?.()?.state === 'ready';
    const normalizedNow = Math.max(0, Number(now) || Date.now());
    const refreshIntervalMs = learningReady
      ? READY_SURFACE_VALIDATION_MS
      : DYNAMIC_SURFACE_REFRESH_MS;
    const dynamicCandidate = allowDynamicClassification
      && this._surface?.profileId === 'default'
      && (
        this._surface?.surfaceMode === 'unknown'
        || !learningReady
        || (normalizedNow - this._lastSurfaceRefreshAt) >= refreshIntervalMs
      );
    if (!rawRouteChanged && !dynamicCandidate) return;
    if (
      !rawRouteChanged
      && (normalizedNow - this._lastSurfaceRefreshAt) < refreshIntervalMs
    ) {
      return;
    }

    const previousSignature = buildSurfaceSignature(this._surface);
    const nextSurface = validateResolvedFeedSurface(
      this._surfaceRegistry.resolve({ hostname, pathname }),
    );
    const nextSignature = buildSurfaceSignature(nextSurface);
    this._lastSurfaceRefreshAt = normalizedNow;

    if (previousSignature !== nextSignature) {
      if (this._onBeforeFeedSurfaceReset) {
        const acknowledged = this._onBeforeFeedSurfaceReset({
          previousSemanticSurfaceId: this._surface?.semanticSurfaceId || '',
          nextSemanticSurfaceId: nextSurface.semanticSurfaceId || '',
          semanticIdentityChanged: this._surface?.semanticSurfaceId !== nextSurface.semanticSurfaceId,
          changedAt: normalizedNow,
          previousSurface: this._surface ? { ...this._surface } : null,
          nextSurface: { ...nextSurface },
        });
        if (acknowledged !== true) {
          throw new Error('FEED_FLOW_SURFACE_RESET_NOT_ACKNOWLEDGED');
        }
      }
      this._surface = nextSurface;
      this._burstMachine.reset({ preserveControl: true, preserveEpisode: false });
      this._judge.reset();
      this._latestActuationContext = null;
      this._decisionLifecycle = { burstId: '', state: 'none' };
      this._latestDecision = null;
      this._initializeStructureLearner(nextSurface);
      this._topologyRecoveryProtocol.reset();
      this._topologyCertificationRuntime.setSurface(
        buildTopologyCertificationSurface(nextSurface, this._runtimeConfig),
      );
      this._lastLearningHeartbeatAt = 0;
      this._lastSupplyLearning = null;
      this._observeSurfaceLearning();
      this._observeTopologyCertification(normalizedNow);
      this._coordinator.setSurface(nextSurface);
      this._publishNeutralDecision(normalizedNow);
      return;
    }

    const previousSurface = this._surface;
    const confidenceChanged = Math.abs(
      Number(nextSurface.surfaceConfidence || 0) - Number(previousSurface?.surfaceConfidence || 0),
    ) >= 0.03;
    if (rawRouteChanged || confidenceChanged) {
      this._surface = nextSurface;
    }
    if (confidenceChanged) {
      this._observeSurfaceLearning();
      this._observeTopologyCertification(normalizedNow);
    }
  }
}

export {
  FeedInputCapture,
  FeedAdvanceCoordinator,
  ContinuousAdvanceAdapter,
  PagedAdvanceAdapter,
  HybridAdvanceAdapter,
  FeedFlowTriggerBridge,
  FeedBoundaryJudge,
  FeedSurfaceRegistry,
  FeedBoundaryState,
  FeedStructureLearner,
  FeedTopologyRecoveryProtocol,
  FeedTopologyCertificationRuntime,
  FeedShippedTopologyProbe,
  FeedActuationSafetyJudge,
};

export default FeedFlowRuntime;
