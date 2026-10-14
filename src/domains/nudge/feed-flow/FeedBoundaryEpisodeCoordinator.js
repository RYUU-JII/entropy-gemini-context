import feedObservationRuntime, {
  FEED_SUPPLY_SAMPLE_INTERVAL_MS,
} from './FeedObservationRuntime.js';
import FeedTerminusController from './terminus/FeedTerminusController.js';
import { restoreOrphanedFeedEndpoints } from './terminus/FeedEndpointLease.js';
import InteractionManager from '../interactionManager.js';
import ensoSpawnPolicy, {
  ENSO_SPAWN_SOURCES,
} from '../interaction/EnsoSpawnPolicy.js';
import EnsoFeedSurfaceEntryGrace, {
  ENSO_FEED_SURFACE_ENTRY_GRACE_MS,
  resolveEnsoFeedSemanticSurfaceId,
} from '../interaction/EnsoFeedSurfaceEntryGrace.js';
import runtimeDebugger from '@runtime-debugger';
import feedHorizonInspection from '@feed-horizon-inspection';
import {
  DEFAULT_ENSO_FEED_HORIZON_RUNTIME_CONFIG,
  requireEnsoFeedHorizonRuntimeConfig,
} from './config/ensoFeedHorizonRuntimeConfig.js';
import signalGate from '../../protection/content/runtime/ProtectionSignalGate.js';
import { SIGNAL_GATE_KEYS } from '../../protection/content/runtime/protectionSignalGateKeys.js';
import {
  resolveEnsoFeedEpisodeAdmission,
  withholdEnsoFeedEpisodeAdmission,
  isEnsoFeedEpisodeAdmissionActive,
} from '../interaction/ensoFeedEpisodeAdmission.js';
import {
  FEED_ENSO_EPISODE_SURFACE_OWNER_ID,
  claimEnsoFeedPreludeSurface,
} from '../interaction/ensoGateSurface.js';
import {
  recordProtectionFeatureError,
  recordProtectionFeatureEvent,
} from '../../protection/content/runtime/protectionRuntimeDiagnostics.js';
import interventionAdmissionClient from '../runtime/interventionAdmissionClient.js';
import { claimRitualSurface } from '../runtime/ritualSurfaceArbiter.js';
import { requireGoalEpisodeBinding } from '../runtime/goalEpisodeBinding.js';

const GOAL_FEED_SOURCE = 'goal_feed_horizon';
const FURIN_SURFACE_OWNER_ID = 'sentinel_protocol_host';

const INFINITE_SCROLL_SIGNAL_KEY = SIGNAL_GATE_KEYS.INFINITE_SCROLL_GUARD;

function getEnsoEpisodeErrorMessage(error, fallback = 'ENSO_RUNTIME_EPISODE_FAILURE') {
  return String(error?.message || error || fallback);
}

function reportEnsoEpisodeFailure(phase, error, details = {}) {
  const diagnostic = {
    phase,
    error: getEnsoEpisodeErrorMessage(error),
    ...details,
  };
  recordProtectionFeatureError('infiniteScrollGuard', error, diagnostic);
  if (typeof console !== 'undefined') {
    console.warn?.('[EnsoRuntimeEpisodeManager] runtime failure', diagnostic);
  }
  return diagnostic;
}

function createEnsoEpisodeLifecycleError(message, errors) {
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

function projectFeedDecision(decision) {
  if (!decision || typeof decision !== 'object') return null;
  return {
    decisionId: typeof decision.decisionId === 'string' ? decision.decisionId : '',
    observationKind: decision.observationKind,
    state: typeof decision.state === 'string' ? decision.state : 'none',
    candidateState: typeof decision.candidateState === 'string'
      ? decision.candidateState
      : 'none',
    confidence: Number(decision.confidence) || 0,
    cadence: decision.cadence ? { ...decision.cadence } : null,
    armed: decision.armed === true,
    opportunityReady: decision.opportunityReady === true,
    inhibitors: Array.isArray(decision.inhibitors) ? [...decision.inhibitors] : [],
    seam: decision.seam && typeof decision.seam === 'object'
      ? { ...decision.seam }
      : null,
    reasons: Array.isArray(decision.reasons) ? [...decision.reasons] : [],
    metrics: decision.metrics && typeof decision.metrics === 'object'
      ? globalThis.structuredClone(decision.metrics)
      : null,
    readiness: {
      status: typeof decision.readiness?.status === 'string'
        ? decision.readiness.status
        : 'missing',
      capability: typeof decision.readiness?.capability === 'string'
        ? decision.readiness.capability
        : 'observe_only',
    },
    actuationSafety: {
      status: typeof decision.actuationSafety?.status === 'string'
        ? decision.actuationSafety.status
        : 'missing',
      capability: typeof decision.actuationSafety?.capability === 'string'
        ? decision.actuationSafety.capability
        : 'observe_only',
      reasons: Array.isArray(decision.actuationSafety?.reasons)
        ? [...decision.actuationSafety.reasons]
        : [],
    },
  };
}

function projectEpisodeAdmission(admission) {
  if (!admission || typeof admission !== 'object') return null;
  return {
    status: admission.status,
    admitted: admission.admitted === true,
    decisionId: admission.decisionId,
    blockedAt: admission.blockedAt,
    evaluatedAt: admission.evaluatedAt,
    cadence: admission.cadence,
    capability: admission.capability,
    readinessStatus: admission.readinessStatus,
    safetyStatus: admission.safetyStatus,
    surfaceEntryGrace: admission.surfaceEntryGrace
      ? { ...admission.surfaceEntryGrace }
      : null,
    spawnPolicy: admission.spawnPolicy
      ? { ...admission.spawnPolicy }
      : null,
    reasons: Array.isArray(admission.reasons) ? [...admission.reasons] : [],
  };
}

function resolveEpisodeDiagnosticPhase({
  active,
  managerState,
  admission,
  endpoint,
  permit,
}) {
  if (!active) return 'inactive';
  if (managerState === 'ENSO_PENDING') return 'enso_pending';
  if (endpoint?.boundaryReached === true || permit?.committed === true) return 'feed_dry';
  if (endpoint?.active === true || endpoint?.leaseState === 'committed') return 'feed_drying';
  if (admission?.admitted === true) return 'endpoint_pending';
  if (admission?.status === 'withheld') return 'withheld';
  if (admission?.status === 'pending' && admission?.blockedAt === 'reservation') return 'admission_pending';
  return 'observing';
}

class FeedBoundaryEpisodeCoordinator {
  constructor({
    windowRef = typeof window !== 'undefined' ? window : null,
    documentRef = typeof document !== 'undefined' ? document : null,
    observationRuntime = feedObservationRuntime,
    terminusController = null,
    debuggerRuntime = runtimeDebugger,
    interactionManager = InteractionManager,
    spawnPolicy = ensoSpawnPolicy,
    claimPreludeSurface = claimEnsoFeedPreludeSurface,
    surfaceEntryGrace = null,
    surfaceEntryGraceMs = ENSO_FEED_SURFACE_ENTRY_GRACE_MS,
    feedHorizonInspectionSession = feedHorizonInspection,
  } = {}) {
    if (
      !interactionManager
      || typeof interactionManager.requestEnsoGate !== 'function'
      || typeof interactionManager.acquireInteractionListenerLease !== 'function'
      || typeof interactionManager.releaseInteractionListenerLease !== 'function'
    ) {
      throw new Error('ENSO_EPISODE_INTERACTION_MANAGER_INVALID');
    }
    if (typeof claimPreludeSurface !== 'function') {
      throw new Error('ENSO_EPISODE_PRELUDE_SURFACE_OWNER_INVALID');
    }
    if (
      !spawnPolicy
      || typeof spawnPolicy.evaluate !== 'function'
      || typeof spawnPolicy.reserve !== 'function'
      || typeof spawnPolicy.commit !== 'function'
      || typeof spawnPolicy.release !== 'function'
      || typeof spawnPolicy.inspectPermit !== 'function'
      || typeof spawnPolicy.configure !== 'function'
      || typeof spawnPolicy.deactivate !== 'function'
    ) {
      throw new Error('ENSO_EPISODE_SPAWN_POLICY_INVALID');
    }
    this._window = windowRef;
    this._document = documentRef;
    this._interactionManager = interactionManager;
    this._spawnPolicy = spawnPolicy;
    this._claimPreludeSurface = claimPreludeSurface;
    this._state = 'IDLE';
    this._active = false;
    this._periodicEnabled = false;
    this._goalEntry = null;
    this._goalLease = null;
    this._goalClaim = null;
    this._goalClaimTransferred = false;
    this._goalLeaseTransferred = false;
    this._goalBoundaryAcknowledged = false;
    this._goalHandoffPending = false;
    this._runtimeConfig = DEFAULT_ENSO_FEED_HORIZON_RUNTIME_CONFIG;
    this._observationRuntime = observationRuntime;
    this._feedFlowRuntime = observationRuntime.flow;
    this._feedConsumerAttached = false;
    this._feedConsumer = Object.freeze({
      isSupplyObservationRequired: () => this._runtimeDebugger.isFeedObservationActive(),
      onDecision: (decision) => this._handleFeedFlowDecision(decision),
      onBeforeFeedSurfaceReset: (transition) => (
        this._handleFeedSurfaceWillReset(transition)
      ),
    });
    if (
      typeof this._feedFlowRuntime.getState !== 'function'
      || typeof this._feedFlowRuntime.getActuationContext !== 'function'
      || typeof this._feedFlowRuntime.consumeOpportunity !== 'function'
      || typeof this._observationRuntime.setInterventionExposure !== 'function'
    ) {
      throw new Error('ENSO_EPISODE_FEED_FLOW_SURFACE_CONTRACT_INVALID');
    }
    this._surfaceEntryGrace = surfaceEntryGrace || new EnsoFeedSurfaceEntryGrace({
      graceMs: surfaceEntryGraceMs,
    });
    if (
      typeof this._surfaceEntryGrace.observe !== 'function'
      || typeof this._surfaceEntryGrace.evaluate !== 'function'
      || typeof this._surfaceEntryGrace.getSnapshot !== 'function'
      || typeof this._surfaceEntryGrace.reset !== 'function'
    ) {
      throw new Error('ENSO_EPISODE_SURFACE_ENTRY_GRACE_OWNER_INVALID');
    }
    this._terminusController = terminusController || new FeedTerminusController({
      windowRef,
      documentRef,
      onRuntimeFailure: (phase, error, details) => this._reportFailure(phase, error, details),
    });
    if (
      typeof this._terminusController.arm !== 'function'
      || typeof this._terminusController.disarm !== 'function'
      || typeof this._terminusController.abortEpisode !== 'function'
      || typeof this._terminusController.resolveContinueIntent !== 'function'
    ) {
      throw new Error('ENSO_EPISODE_TERMINUS_CONTROLLER_INVALID');
    }
    this._runtimeDebugger = debuggerRuntime;
    if (
      !feedHorizonInspectionSession
      || typeof feedHorizonInspectionSession.connectOwner !== 'function'
      || typeof feedHorizonInspectionSession.resolvePendingEndpointDecision !== 'function'
      || typeof feedHorizonInspectionSession.resolveSurfaceEntryGrace !== 'function'
      || typeof feedHorizonInspectionSession.getStillGateMs !== 'function'
      || typeof feedHorizonInspectionSession.handleContinueIntent !== 'function'
      || typeof feedHorizonInspectionSession.finish !== 'function'
      || typeof feedHorizonInspectionSession.getSnapshot !== 'function'
    ) {
      throw new Error('ENSO_EPISODE_FEED_HORIZON_INSPECTION_SEAM_INVALID');
    }
    this._feedHorizonInspection = feedHorizonInspectionSession;
    this._runtimeDebugger?.setFeedActuationContextProvider?.(
      () => this._feedFlowRuntime.getActuationContext(),
    );
    this._listenerLeaseHeld = false;
    this._spawnSourceActive = false;
    this._latestFeedFlowDecision = null;
    this._episodeAdmission = null;
    this._latestAdmissionDecision = null;
    this._lastAdmissionDiagnosticSignature = '';
    this._spawnPermit = null;
    this._episodeSurfaceClaim = null;
    this._lastSurfaceGraceBlockedId = '';
    this._pendingFeedSurfaceReset = null;
    this._lastObservedInterruptId = '';
    this._lifecycleAttached = false;
    this._boundVisibilityChange = () => this._handleVisibilityChange();
    this._boundPageExit = () => this._handlePageExit();
    this._runtimeDebugger?.setFeedEpisodeSnapshotProvider?.(
      ({ now = Date.now() } = {}) => this.getDebugSnapshot({ now }),
    );
    this._feedHorizonInspection.connectOwner({
      abortInspectionEpisode: (reason) => this._abortEpisode(reason),
      beginInspectionEpisode: ({ now } = {}) => this._beginFeedHorizonInspectionEpisode(now),
      getEndpointDecision: () => this._latestFeedFlowDecision,
      getEpisodeSnapshot: ({ now = Date.now() } = {}) => this.getDebugSnapshot({ now }),
      hasEpisodeOwnership: () => (
        isEnsoFeedEpisodeAdmissionActive(this._episodeAdmission)
        || this._spawnPermit !== null
        || this._episodeSurfaceClaim !== null
      ),
      isRuntimeActive: () => this._active,
      restoreProductionSpawnTiming: () => this._restoreProductionSpawnTiming(),
    });
    this._signalGateCleanupUnsub = signalGate.registerCleanup(
      INFINITE_SCROLL_SIGNAL_KEY,
      () => {
        if (this._goalEntry) return;
        if (this._cleanupInFlight() === false) {
          throw new Error('ENSO_RUNTIME_EPISODE_CLEANUP_NOT_CONFIRMED');
        }
      },
    );
  }

  setFeedHorizonRuntimeConfig(runtimeConfig) {
    this._runtimeConfig = requireEnsoFeedHorizonRuntimeConfig(runtimeConfig);
    return this.getRuntimeConfig();
  }

  getRuntimeConfig() {
    return requireEnsoFeedHorizonRuntimeConfig(this._runtimeConfig);
  }

  requestGoalEntry({ kind, purpose, runId, goalBinding, onContinue, onCancelled }) {
    requireGoalEpisodeBinding(goalBinding);
    if (!['site_furin', 'global_sentinel'].includes(kind)
      || purpose !== (kind === 'site_furin' ? 'site_goal' : 'global_goal')
      || typeof runId !== 'string' || !runId
      || goalBinding.runId !== runId || goalBinding.purpose !== purpose
      || typeof onContinue !== 'function' || typeof onCancelled !== 'function') {
      throw new Error('FEED_GOAL_ENTRY_INVALID');
    }
    if (this._goalEntry) {
      return this._goalEntry.runId === runId
        ? { ok: true, phase: 'entry_waiting', runId }
        : { ok: false, rejectReason: 'goal_boundary_owned' };
    }
    this._goalEntry = { kind, purpose, runId, goalBinding, onContinue, onCancelled };
    try {
      this._feedFlowRuntime.setGoalBoundaryDemand(true);
      if (!this._active) {
        this._feedFlowRuntime.setConfig(this._runtimeConfig);
        this._interactionManager.acquireInteractionListenerLease(FEED_ENSO_EPISODE_SURFACE_OWNER_ID);
        this._listenerLeaseHeld = true;
        this._active = true;
        this._state = 'OBSERVING';
        this._attachLifecycleListeners();
        this._cleanupOrphans();
        this._feedConsumerAttached = true;
        this._observationRuntime.attachConsumer(this._feedConsumer, this._runtimeConfig);
        this._observeCurrentSemanticSurface(Date.now());
      }
      this._observationRuntime.sample();
      return { ok: true, phase: 'entry_waiting', runId };
    } catch (error) {
      this.cancelGoalEntry('goal_boundary_activation_failed');
      throw error;
    }
  }

  getGoalEntrySnapshot() {
    return this._goalEntry ? Object.freeze({ kind: this._goalEntry.kind,
      purpose: this._goalEntry.purpose, runId: this._goalEntry.runId,
      leaseId: this._goalLease?.leaseId ?? null,
      boundaryAcknowledged: this._goalBoundaryAcknowledged,
      handingOff: this._goalHandoffPending }) : null;
  }

  _evaluateGoalEntry(decision) {
    const entry = this._goalEntry;
    if (!entry || this._goalHandoffPending) return;
    if (this._goalLease) { this._syncGoalTerminus(); return; }
    if (decision?.opportunityReady !== true || decision.state !== 'interrupt'
      || decision.readiness?.status !== 'ready' || decision.actuationSafety?.status !== 'safe'
      || decision.actuationSafety.capability === 'observe_only') return;
    const scope = { kind: entry.kind, source: GOAL_FEED_SOURCE, purpose: entry.purpose, goalBinding: entry.goalBinding, manual: false };
    if (decision.observationKind !== 'advance' && !interventionAdmissionClient.canCompletePrepared(scope)) return;
    const reservation = interventionAdmissionClient.tryReserve(scope);
    if (!reservation.accepted) return;
    this._goalLease = reservation.lease;
    this._goalAdmission = Object.freeze({ status: 'admitted', admitted: true,
      purpose: entry.purpose, episodeKind: GOAL_FEED_SOURCE,
      decisionId: decision.decisionId, capability: decision.actuationSafety.capability });
    this._goalCleanupRemove = interventionAdmissionClient.bind(this._goalLease, ({ reason } = {}) => {
      this.cancelGoalEntry(reason || 'goal_lease_revoked', { releaseLease: false });
    });
    const claim = claimRitualSurface({ type: entry.kind, ownerId: FURIN_SURFACE_OWNER_ID,
      admissionLease: this._goalLease, metadata: { phase: 'goal_feed_horizon', purpose: entry.purpose },
      onSuppress: () => this.cancelGoalEntry('goal_boundary_suppressed') });
    if (!claim.accepted || !claim.claim) {
      this.cancelGoalEntry('goal_boundary_surface_denied');
      return;
    }
    this._goalClaim = claim.claim;
    this._syncGoalTerminus();
  }

  _syncGoalTerminus() {
    if (!this._goalLease || !this._goalEntry || this._goalHandoffPending) return;
    if (this._terminusController.isArmed()) return;
    const armed = this._terminusController.arm({
      getDecision: () => this._latestFeedFlowDecision,
      getAdmission: () => this._goalAdmission,
      getActuationContext: () => this._feedFlowRuntime.getActuationContext(),
      onEndpointAttached: () => interventionAdmissionClient.attachEndpoint(this._goalLease),
      onHorizonEngaged: () => {
        const lease = this._goalLease;
        if (!lease) return false;
        void interventionAdmissionClient.boundaryPresented(lease).then(() => {
          if (this._goalLease === lease) this._goalBoundaryAcknowledged = true;
        }).catch((error) => this._reportFailure('goal_boundary_receipt', error));
        return true;
      },
      onEndpointExposureChanged: ({ active, observedAt }) => this._observationRuntime.setInterventionExposure(active, { now: observedAt }),
      onEpisodeFailure: ({ phase }) => this.cancelGoalEntry(`goal_terminus_${phase}_failed`),
      onContinueIntent: () => this._continueGoalEntry(),
      onContinue: () => this._handleContinue(),
      onRetreat: (_source, { finishedReason } = {}) => this.cancelGoalEntry(finishedReason || 'goal_boundary_retreat'),
    });
    if (armed !== true) { this.cancelGoalEntry('goal_boundary_arm_failed'); return; }
    this._state = 'GOAL_HORIZON';
  }

  _continueGoalEntry() {
    if (!this._goalEntry || !this._goalLease || !this._goalBoundaryAcknowledged || this._goalHandoffPending) return false;
    const entry = this._goalEntry;
    const lease = this._goalLease;
    const claim = this._goalClaim;
    this._goalHandoffPending = true;
    void Promise.resolve().then(() => entry.onContinue({ leaseId: lease.leaseId, source: GOAL_FEED_SOURCE,
      kind: entry.kind, replaceClaim: claim,
      onClaimTransferred: ({ leaseId, previousClaim }) => {
        if (this._goalEntry !== entry || this._goalLease !== lease || leaseId !== lease.leaseId
          || previousClaim !== claim || this._goalClaim !== claim) throw new Error('FEED_GOAL_CLAIM_TRANSFER_INVALID');
        this._goalClaim = null;
        this._goalClaimTransferred = true;
        // Finish physical ownership before the host can await paint or end the
        // adopted lease. Cleanup failure leaves the composite lease here.
        if (this._terminusController.resolveContinueIntent('enter') !== true
          || this._terminusController.disarm() === false) throw new Error('FEED_GOAL_HANDOFF_CLEANUP_FAILED');
        this._goalLeaseTransferred = true;
        return true;
      },
    })).then((result) => {
      if (this._goalEntry !== entry || this._goalLease !== lease) return;
      if (result?.ok !== true) throw new Error(`FEED_GOAL_FURIN_HANDOFF_FAILED:${result?.rejectReason}`);
      if (!this._goalClaimTransferred) throw new Error('FEED_GOAL_CLAIM_TRANSFER_UNCONFIRMED');
      if (!this._goalLeaseTransferred) throw new Error('FEED_GOAL_LEASE_TRANSFER_UNCONFIRMED');
      this._clearGoalEntry({ notify: false, releaseLease: false });
    }).catch((error) => {
      this._reportFailure('goal_furin_handoff', error);
      if (this._goalEntry === entry) this.cancelGoalEntry('goal_furin_handoff_failed');
    });
    return true;
  }

  _clearGoalEntry({ notify, releaseLease, reason = 'goal_entry_ended' }) {
    const entry = this._goalEntry;
    const lease = this._goalLease;
    this._goalCleanupRemove?.();
    this._goalCleanupRemove = null;
    this._goalEntry = null;
    this._goalLease = null;
    this._goalAdmission = null;
    this._goalBoundaryAcknowledged = false;
    this._goalHandoffPending = false;
    this._goalClaimTransferred = false;
    this._goalLeaseTransferred = false;
    this._feedFlowRuntime.setGoalBoundaryDemand(false);
    if (entry && !lease) interventionAdmissionClient.cancelPending({ kind: entry.kind, source: GOAL_FEED_SOURCE });
    if (releaseLease && lease) interventionAdmissionClient.release(lease, reason);
    if (notify && entry) entry.onCancelled(reason);
    if (!this._periodicEnabled && !this._clearingSharedGoal) {
      if (this._cleanupInFlight() === false) throw new Error('FEED_GOAL_OBSERVATION_CLEANUP_FAILED');
    }
  }

  cancelGoalEntry(reason = 'goal_entry_cancelled', { releaseLease = true, runId = null } = {}) {
    if (!this._goalEntry || (runId !== null && this._goalEntry.runId !== runId)) return true;
    if (this._goalLease && this._terminusController.disarm() === false) throw new Error('FEED_GOAL_TERMINUS_CLEANUP_FAILED');
    if (this._goalClaim && this._goalClaim.release({ reason }) === false) throw new Error('FEED_GOAL_CLAIM_CLEANUP_FAILED');
    this._goalClaim = null;
    this._clearGoalEntry({ notify: true, releaseLease: releaseLease && !this._goalLeaseTransferred, reason });
    return true;
  }

  _beginFeedHorizonInspectionEpisode(now = Date.now()) {
    this._spawnPolicy.configure({
      source: ENSO_SPAWN_SOURCES.FEED_HORIZON,
      enabled: true,
    }, { now });
    const admission = this._evaluateEpisodeAdmission({ allowReservation: true });
    if (!isEnsoFeedEpisodeAdmissionActive(admission)) {
      throw new Error('ENSO_FEED_HORIZON_INSPECTION_ADMISSION_NOT_CONFIRMED');
    }
    this._syncTerminusController();
    return this.getDebugSnapshot({ now });
  }

  _restoreProductionSpawnTiming() {
    if (!this._spawnSourceActive) return true;
    this._spawnPolicy.configure({
      source: ENSO_SPAWN_SOURCES.FEED_HORIZON,
      enabled: true,
    });
    return true;
  }

  _createRuntimeConfigSnapshot() {
    return {
      runtimeConfig: requireEnsoFeedHorizonRuntimeConfig(this._runtimeConfig),
    };
  }

  _restoreRuntimeConfig(snapshot) {
    if (!snapshot) return;
    this._runtimeConfig = requireEnsoFeedHorizonRuntimeConfig(snapshot.runtimeConfig);
    this._feedFlowRuntime.setConfig(this._runtimeConfig);
  }

  _disableSignalGateAfterFailedApply() {
    try {
      signalGate.setFeatureEnabled(INFINITE_SCROLL_SIGNAL_KEY, false, {
        reason: 'manager_apply_failed',
      });
    } catch (error) {
      this._reportFailure('manager_apply_signal_cleanup', error);
      throw error;
    }
  }

  _rollbackFailedApply(previousRuntimeConfig) {
    const errors = [];
    try {
      this._disableSignalGateAfterFailedApply();
    } catch (error) {
      errors.push(error);
    }
    if (this._hasLifecycleOwnership() && this._cleanupInFlight() === false) {
      errors.push(new Error('ENSO_RUNTIME_EPISODE_APPLY_CLEANUP_NOT_CONFIRMED'));
    }
    try {
      this._restoreRuntimeConfig(previousRuntimeConfig);
    } catch (error) {
      errors.push(error);
      this._reportFailure('manager_apply_restore_runtime_config', error);
    }
    if (errors.length > 0) {
      throw createEnsoEpisodeLifecycleError('ENSO_RUNTIME_EPISODE_APPLY_ROLLBACK_FAILED', errors);
    }
  }

  apply(runtimeConfig, protectionContext) {
    this._periodicEnabled = true;
    if (this._goalEntry && this._active) {
      this.setFeedHorizonRuntimeConfig(runtimeConfig);
      this._activateSpawnSource(Date.now(), protectionContext);
      signalGate.setFeatureEnabled(INFINITE_SCROLL_SIGNAL_KEY, true, { reason: 'manager_apply' });
      return;
    }
    const previousRuntimeConfig = this._createRuntimeConfigSnapshot();
    const wasActive = this._active;
    this.setFeedHorizonRuntimeConfig(runtimeConfig);
    try {
      if (!this._active && this._hasLifecycleOwnership()) {
        throw new Error('ENSO_RUNTIME_EPISODE_CLEANUP_PENDING');
      }
      this._activateSpawnSource(Date.now(), protectionContext);

      if (this._active) {
        signalGate.setFeatureEnabled(INFINITE_SCROLL_SIGNAL_KEY, true, { reason: 'manager_apply' });
        this._attachLifecycleListeners();
        if (this._abortEpisode('runtime_config_changed') === false) {
          throw new Error('ENSO_FEED_EPISODE_CONFIG_CHANGE_ABORT_NOT_CONFIRMED');
        }
        if (this._terminusController.disarm() === false) {
          throw new Error('FEED_TERMINUS_DISARM_NOT_CONFIRMED');
        }
        this._feedFlowRuntime.setConfig(this._runtimeConfig);
        this._observationRuntime.sample();
      } else {
        this._feedFlowRuntime.setConfig(this._runtimeConfig);
        this._interactionManager.acquireInteractionListenerLease(
          FEED_ENSO_EPISODE_SURFACE_OWNER_ID,
        );
        this._listenerLeaseHeld = true;
        this._active = true;
        this._state = 'OBSERVING';
        this._attachLifecycleListeners();
        this._cleanupOrphans();
        signalGate.setFeatureEnabled(INFINITE_SCROLL_SIGNAL_KEY, true, { reason: 'manager_apply' });
        this._feedConsumerAttached = true;
        this._observationRuntime.attachConsumer(this._feedConsumer, this._runtimeConfig);
        this._observeCurrentSemanticSurface(Date.now());
        this._runtimeDebugger?.arm?.();
      }

      recordProtectionFeatureEvent('infiniteScrollGuard', 'manager_apply', {
        active: wasActive,
        runtimeConfig: this.getRuntimeConfig(),
        actuator: 'enso_feed_episode',
      });
    } catch (error) {
      this._reportFailure('manager_apply', error, {
        active: wasActive,
        actuator: 'enso_feed_episode',
      });
      try {
        if (wasActive) {
          this._restoreRuntimeConfig(previousRuntimeConfig);
        } else {
          this._rollbackFailedApply(previousRuntimeConfig);
        }
      } catch (cleanupError) {
        if (error && typeof error === 'object') error.cleanupError = cleanupError;
      }
      throw error;
    }
  }

  remove() {
    this._periodicEnabled = false;
    signalGate.setFeatureEnabled(INFINITE_SCROLL_SIGNAL_KEY, false, { reason: 'manager_remove' });
    if (this._goalEntry) {
      if (this._spawnPermit && this._abortEpisode('periodic_disabled') === false) throw new Error('ENSO_RUNTIME_EPISODE_REMOVE_NOT_CONFIRMED');
      if (this._spawnSourceActive) {
        this._spawnPolicy.deactivate(ENSO_SPAWN_SOURCES.FEED_HORIZON);
        this._spawnSourceActive = false;
      }
      return;
    }
    if (this._hasLifecycleOwnership() && this._cleanupInFlight() === false) {
      throw new Error('ENSO_RUNTIME_EPISODE_REMOVE_NOT_CONFIRMED');
    }
    recordProtectionFeatureEvent('infiniteScrollGuard', 'manager_remove', {
      actuator: 'enso_feed_episode',
    });
  }

  _cleanupInFlight() {
    if (this._goalEntry) {
      this._clearingSharedGoal = true;
      try { this.cancelGoalEntry('shared_boundary_cleanup'); }
      finally { this._clearingSharedGoal = false; }
    }
    const previousActive = this._active;
    if (this._abortEpisode('episode_cleanup') === false) {
      this._active = previousActive;
      this._state = 'CLEANUP_FAILED';
      this._reportFailure(
        'enso_feed_episode_cleanup_incomplete',
        new Error('ENSO_FEED_EPISODE_CLEANUP_NOT_CONFIRMED'),
      );
      return false;
    }
    let terminusReleased = this._disarmTerminus('feed_terminus_disarm');
    if (!terminusReleased) {
      terminusReleased = this._disarmTerminus('feed_terminus_disarm_retry');
    }
    if (!terminusReleased) {
      this._active = previousActive;
      this._state = 'CLEANUP_FAILED';
      this._reportFailure(
        'feed_terminus_cleanup_incomplete',
        new Error('FEED_TERMINUS_CLEANUP_NOT_CONFIRMED'),
      );
      return false;
    }
    try {
      if (this._feedConsumerAttached) {
        this._observationRuntime.detachConsumer(this._feedConsumer);
        this._feedConsumerAttached = false;
      }
    } catch (error) {
      this._state = 'CLEANUP_FAILED';
      this._reportFailure('feed_observation_consumer_release', error);
      return false;
    }
    if (!this._detachLifecycleListeners()) {
      this._active = previousActive;
      this._state = 'CLEANUP_FAILED';
      return false;
    }
    this._active = false;
    this._state = 'IDLE';
    this._latestFeedFlowDecision = null;
    this._episodeAdmission = null;
    this._latestAdmissionDecision = null;
    this._lastAdmissionDiagnosticSignature = '';
    this._lastObservedInterruptId = '';
    if (this._listenerLeaseHeld) {
      try {
        this._interactionManager.releaseInteractionListenerLease(
          FEED_ENSO_EPISODE_SURFACE_OWNER_ID,
        );
        this._listenerLeaseHeld = false;
      } catch (error) {
        this._state = 'CLEANUP_FAILED';
        this._reportFailure('enso_listener_lease_release', error);
        return false;
      }
    }
    if (this._spawnSourceActive) {
      try {
        this._spawnPolicy.deactivate(ENSO_SPAWN_SOURCES.FEED_HORIZON);
        this._spawnSourceActive = false;
      } catch (error) {
        this._state = 'CLEANUP_FAILED';
        this._reportFailure('enso_spawn_source_release', error);
        return false;
      }
    }
    this._surfaceEntryGrace.reset();
    this._lastSurfaceGraceBlockedId = '';
    this._pendingFeedSurfaceReset = null;
    this._cleanupOrphans();
    return true;
  }

  _attachLifecycleListeners() {
    if (this._lifecycleAttached) return true;
    try {
      this._document?.addEventListener?.(
        'visibilitychange',
        this._boundVisibilityChange,
        true,
      );
      this._window?.addEventListener?.('pagehide', this._boundPageExit, true);
      this._window?.addEventListener?.('beforeunload', this._boundPageExit, true);
      this._lifecycleAttached = true;
      return true;
    } catch (error) {
      this._detachLifecycleListeners();
      throw error;
    }
  }

  _detachLifecycleListeners() {
    if (!this._lifecycleAttached) return true;
    const errors = [];
    try {
      this._document?.removeEventListener?.(
        'visibilitychange',
        this._boundVisibilityChange,
        true,
      );
    } catch (error) {
      errors.push(error);
    }
    try {
      this._window?.removeEventListener?.('pagehide', this._boundPageExit, true);
      this._window?.removeEventListener?.('beforeunload', this._boundPageExit, true);
    } catch (error) {
      errors.push(error);
    }
    this._lifecycleAttached = false;
    if (errors.length > 0) {
      this._reportFailure(
        'enso_feed_lifecycle_listener_detach',
        createEnsoEpisodeLifecycleError(
          'ENSO_FEED_LIFECYCLE_LISTENER_DETACH_FAILED',
          errors,
        ),
      );
      return false;
    }
    return true;
  }

  _handleVisibilityChange() {
    if (!this._active || this._document?.visibilityState !== 'hidden') return;
    this.cancelGoalEntry('visibility_hidden');
    if (this._abortEpisode('visibility_hidden') === false) {
      this._reportFailure(
        'enso_feed_visibility_cleanup',
        new Error('ENSO_FEED_VISIBILITY_CLEANUP_NOT_CONFIRMED'),
      );
    }
  }

  _handlePageExit() {
    if (!this._hasLifecycleOwnership()) return;
    if (this._cleanupInFlight() === false) {
      this._reportFailure(
        'enso_feed_page_exit_cleanup',
        new Error('ENSO_FEED_PAGE_EXIT_CLEANUP_NOT_CONFIRMED'),
      );
    }
  }

  _cleanupOrphans() {
    if (!this._document) return;
    try {
      restoreOrphanedFeedEndpoints(this._document);
    } catch (error) {
      this._reportFailure('feed_endpoint_orphan_restore', error);
      return;
    }
    let orphans = [];
    try {
      orphans = Array.from(this._document.querySelectorAll?.(
        '#entropy-feed-terminus, #entropy-feed-endpoint-marker, #entropy-feed-endpoint-tail, #entropy-feed-endpoint-quarantine, .friction-gatekeeper-barrier, .friction-gatekeeper-noise',
      ) || []);
    } catch (error) {
      this._reportFailure('orphan_query', error);
      return;
    }
    orphans.forEach((el) => {
      try {
        el.remove();
      } catch (error) {
        this._reportFailure('orphan_remove', error, {
          tagName: String(el?.tagName || '').toLowerCase() || null,
          id: el?.id || null,
        });
      }
    });
  }

  _disarmTerminus(phase) {
    try {
      if (this._terminusController.disarm() === false) {
        throw new Error('FEED_TERMINUS_DISARM_NOT_CONFIRMED');
      }
      return true;
    } catch (error) {
      this._reportFailure(phase, error);
      return false;
    }
  }

  _syncTerminusController() {
    if (this._goalLease) return this._syncGoalTerminus();
    const decision = this._getEffectiveFeedFlowDecision();
    const committedEpisode = this._hasCommittedSpawnPermit();
    const committedEndpoint = this._hasCommittedEndpointLease();
    const canActuate = isEnsoFeedEpisodeAdmissionActive(this._episodeAdmission)
      && (
        committedEpisode
        || committedEndpoint
        || (
          decision?.actuationSafety?.status === 'safe'
          && decision?.readiness?.status === 'ready'
        )
      );
    if (
      !this._active
      || !signalGate.isFeatureEnabled(INFINITE_SCROLL_SIGNAL_KEY)
      || !canActuate
    ) {
      if (isEnsoFeedEpisodeAdmissionActive(this._episodeAdmission)) {
        if (this._abortEpisode('feed_endpoint_capability_lost') === false) return;
      }
      try {
        if (this._terminusController.disarm() === false) {
          throw new Error('FEED_TERMINUS_DISARM_NOT_CONFIRMED');
        }
      } catch (error) {
        this._reportFailure('feed_terminus_disarm', error);
      }
      return;
    }
    try {
      if (this._terminusController.isArmed()) return;
    } catch (error) {
      this._reportFailure('feed_terminus_state_read', error);
      return;
    }
    let armed = false;
    try {
      armed = this._terminusController.arm({
        getDecision: () => this._getEffectiveFeedFlowDecision(),
        getAdmission: () => this._episodeAdmission,
        getActuationContext: () => this._feedFlowRuntime.getActuationContext(),
        onEndpointAttached: ({ attachedAt }) => this._spawnPolicy.attachEndpoint(
          this._spawnPermit, { now: attachedAt },
        ),
        onHorizonEngaged: ({ engagedAt } = {}) => this._commitSpawnPermit(engagedAt),
        onEndpointExposureChanged: ({ active, observedAt }) => (
          this._observationRuntime.setInterventionExposure(active, { now: observedAt })
        ),
        onEpisodeFailure: ({ phase } = {}) => this._abortEpisode(
          `terminus_${phase || 'runtime'}_failed`,
        ),
        onContinueIntent: (intent) => this._handleContinueIntent(intent),
        onContinue: () => this._handleContinue(),
        onRetreat: (source, details) => this._handleRetreat(source, details),
        stillGateMsOverride: this._feedHorizonInspection.getStillGateMs(),
      });
    } catch (error) {
      this._reportFailure('feed_terminus_arm', error);
      this._abortEpisode('feed_terminus_arm_threw');
      return;
    }
    if (armed === false) {
      this._abortEpisode('feed_terminus_arm_failed');
      return;
    }
    this._state = 'HORIZON';
    recordProtectionFeatureEvent('infiniteScrollGuard', 'feed_terminus_armed', {
      sampleIntervalMs: FEED_SUPPLY_SAMPLE_INTERVAL_MS,
      decisionId: decision?.decisionId || '',
      capability: decision?.actuationSafety?.capability || 'observe_only',
      admission: this._episodeAdmission,
    });
  }

  _handleFeedFlowDecision(decision) {
    if (!this._active) return;
    if (!this._goalEntry && !signalGate.isFeatureEnabled(INFINITE_SCROLL_SIGNAL_KEY)) return;
    try {
      this._observeCurrentSemanticSurface(Date.now());
    } catch (error) {
      this._reportFailure('enso_feed_semantic_surface_observe', error);
      throw error;
    }
    this._latestFeedFlowDecision = decision;
    if (this._goalEntry && !this._spawnPermit && !isEnsoFeedEpisodeAdmissionActive(this._episodeAdmission)) {
      this._evaluateGoalEntry(decision);
      return;
    }
    if (decision?.state === 'interrupt' && decision?.decisionId !== this._lastObservedInterruptId) {
      this._lastObservedInterruptId = decision?.decisionId || '';
      recordProtectionFeatureEvent('infiniteScrollGuard', 'feed_flow_interrupt_observed', {
        decisionId: decision?.decisionId || '',
        surfaceMode: decision?.surfaceMode || 'unknown',
        confidence: Number(decision?.confidence) || 0,
        loopScore: Number(decision?.loopScore) || 0,
        readiness: decision?.readiness || null,
        actuationSafety: decision?.actuationSafety || null,
        reasons: Array.isArray(decision?.reasons) ? decision.reasons : [],
        metrics: decision?.metrics || null,
        actuator: 'enso_feed_episode',
      });
    }
    // Complete permission for an already observed boundary while it is still
    // current. The existing beat rechecks every inhibitor/safety/admission gate;
    // it cannot create an opportunity or resurrect one invalidated by activity.
    const completesPreparedBoundary = decision?.observationKind === 'supply'
      && decision?.opportunityReady === true
      && this._latestAdmissionDecision?.status === 'pending'
      && this._spawnPolicy.canCompletePreparedFeedReservation();
    const admission = this._evaluateEpisodeAdmission({
      allowReservation: decision?.observationKind === 'advance' || completesPreparedBoundary,
    });
    this._consumeWithheldOpportunity(admission);
    this._syncTerminusController();
  }

  _consumeWithheldOpportunity(admission) {
    const decision = this._latestFeedFlowDecision;
    if (
      admission?.status !== 'withheld'
      || decision?.opportunityReady !== true
      || decision?.state !== 'interrupt'
    ) {
      return false;
    }
    const reasons = Array.isArray(admission.reasons) ? admission.reasons : [];
    return this._feedFlowRuntime.consumeOpportunity({
      decisionId: decision.decisionId || '',
      reason: reasons[0] || 'enso_admission_withheld',
    });
  }

  _getSpawnPolicyDecision(now = Date.now()) {
    return this._spawnPolicy.evaluate({
      source: ENSO_SPAWN_SOURCES.FEED_HORIZON,
      permit: this._spawnPermit,
      now,
    });
  }

  _observeCurrentSemanticSurface(now = Date.now()) {
    const runtimeState = this._feedFlowRuntime.getState();
    const surface = runtimeState?.surface;
    if (!surface || typeof surface !== 'object') {
      throw new Error('ENSO_FEED_SEMANTIC_SURFACE_STATE_MISSING');
    }
    const actuationContext = this._feedFlowRuntime.getActuationContext();
    const semanticSurfaceId = resolveEnsoFeedSemanticSurfaceId(
      surface,
      actuationContext,
    );
    const pendingReset = this._pendingFeedSurfaceReset;
    if (pendingReset) {
      if (pendingReset.nextSemanticSurfaceId !== semanticSurfaceId) {
        throw new Error(
          `ENSO_FEED_SURFACE_RESET_MISMATCH:${pendingReset.nextSemanticSurfaceId}:${semanticSurfaceId}`,
        );
      }
    } else {
      const currentGrace = this._surfaceEntryGrace.getSnapshot({ now });
      if (
        currentGrace.semanticSurfaceId
        && currentGrace.semanticSurfaceId !== semanticSurfaceId
      ) {
        throw new Error(
          `ENSO_FEED_SEMANTIC_SURFACE_CHANGE_UNANNOUNCED:${currentGrace.semanticSurfaceId}:${semanticSurfaceId}`,
        );
      }
    }
    const observation = this._surfaceEntryGrace.observe({ semanticSurfaceId }, { now });
    if (pendingReset) {
      this._pendingFeedSurfaceReset = null;
    }
    if (!observation.changed) return observation;

    this._lastSurfaceGraceBlockedId = '';
    recordProtectionFeatureEvent('infiniteScrollGuard', 'enso_feed_surface_entered', {
      semanticSurfaceId: observation.semanticSurfaceId,
      previousSemanticSurfaceId: observation.previousSemanticSurfaceId,
      enteredAt: observation.enteredAt,
      graceMs: observation.graceMs,
      remainingMs: observation.remainingMs,
    });
    return observation;
  }

  _handleFeedSurfaceWillReset({
    previousSemanticSurfaceId,
    nextSemanticSurfaceId,
    changedAt = Date.now(),
  } = {}) {
    if (this._goalEntry) {
      this.cancelGoalEntry('feed_surface_reset');
      if (!this._active) return true;
    }
    const previousId = resolveEnsoFeedSemanticSurfaceId({
      semanticSurfaceId: previousSemanticSurfaceId,
    });
    const nextId = resolveEnsoFeedSemanticSurfaceId({
      semanticSurfaceId: nextSemanticSurfaceId,
    });
    const currentGrace = this._surfaceEntryGrace.getSnapshot({ now: changedAt });
    if (currentGrace.semanticSurfaceId !== previousId) {
      throw new Error(
        `ENSO_FEED_SEMANTIC_SURFACE_PRECHANGE_MISMATCH:${String(currentGrace.semanticSurfaceId)}:${previousId}`,
      );
    }
    const pendingReset = this._pendingFeedSurfaceReset;
    if (pendingReset) {
      const sameReset = pendingReset.previousSemanticSurfaceId === previousId
        && pendingReset.nextSemanticSurfaceId === nextId;
      if (!sameReset) {
        throw new Error('ENSO_FEED_SURFACE_RESET_OVERLAP');
      }
      return true;
    }
    if (this._abortEpisode('feed_surface_reset') === false) return false;
    this._episodeAdmission = null;
    this._latestAdmissionDecision = null;
    this._lastAdmissionDiagnosticSignature = '';
    this._pendingFeedSurfaceReset = Object.freeze({
      previousSemanticSurfaceId: previousId,
      nextSemanticSurfaceId: nextId,
      changedAt: Math.max(0, Math.round(Number(changedAt) || Date.now())),
    });
    recordProtectionFeatureEvent('infiniteScrollGuard', 'enso_feed_surface_reset_acknowledged', {
      previousSemanticSurfaceId: previousId,
      nextSemanticSurfaceId: nextId,
      semanticIdentityChanged: previousId !== nextId,
      changedAt: this._pendingFeedSurfaceReset.changedAt,
    });
    return true;
  }

  _getSurfaceEntryGraceDecision(now = Date.now()) {
    const snapshot = this._surfaceEntryGrace.getSnapshot({ now });
    if (!snapshot.semanticSurfaceId) {
      throw new Error('ENSO_FEED_SURFACE_GRACE_NOT_OBSERVED');
    }
    return this._surfaceEntryGrace.evaluate({
      semanticSurfaceId: snapshot.semanticSurfaceId,
    }, { now });
  }

  _getEffectiveFeedFlowDecision() {
    return this._feedHorizonInspection.resolvePendingEndpointDecision(
      this._latestFeedFlowDecision,
      { endpointCommitted: this._hasCommittedEndpointLease() },
    );
  }

  _getEffectiveSurfaceEntryGraceDecision(now = Date.now()) {
    const snapshot = this._surfaceEntryGrace.getSnapshot({ now });
    return this._feedHorizonInspection.resolveSurfaceEntryGrace({
      canonicalDecision: () => this._getSurfaceEntryGraceDecision(now),
      surfaceSnapshot: snapshot,
      now,
    });
  }

  _finishFeedHorizonInspection(reason = 'resolved') {
    return this._feedHorizonInspection.finish(reason);
  }

  getSurfaceEntryGraceSnapshot({ now = Date.now() } = {}) {
    return this._surfaceEntryGrace.getSnapshot({ now });
  }

  getDebugSnapshot({ now = Date.now() } = {}) {
    const evaluatedAt = Math.max(0, Math.round(Number(now) || Date.now()));
    const decision = projectFeedDecision(this._latestFeedFlowDecision);
    const latestAdmission = projectEpisodeAdmission(this._latestAdmissionDecision);
    const grace = this._surfaceEntryGrace.getSnapshot({ now: evaluatedAt });
    const endpoint = typeof this._terminusController.getEndpointState === 'function'
      ? this._terminusController.getEndpointState({ now: evaluatedAt })
      : {
        armed: false,
        active: false,
        controlsLive: false,
        continueIntentPending: false,
        boundaryReached: false,
        boundaryReachedAt: 0,
        stillGateMs: null,
        holdRemainingMs: 0,
        leaseState: 'unavailable',
        resolutionStatus: 'unavailable',
        resolutionReasons: ['feed_endpoint_diagnostic_unavailable'],
      };
    const permit = this._spawnPermit
      ? this._spawnPolicy.inspectPermit(this._spawnPermit)
      : {
        valid: false,
        source: null,
        phase: null,
        committed: false,
      };
    let blockers = [];
    if (!this._active) {
      blockers = ['feature_inactive'];
    } else if (!decision) {
      if (!decision) blockers.push('feed_flow_decision_missing');
    } else if (latestAdmission?.admitted !== true) {
      blockers = [...(latestAdmission?.reasons || ['enso_feed_admission_not_evaluated'])];
    } else if (endpoint.active !== true && endpoint.boundaryReached !== true) {
      blockers = Array.isArray(endpoint.resolutionReasons) && endpoint.resolutionReasons.length > 0
        ? [...endpoint.resolutionReasons]
        : ['feed_endpoint_not_engaged'];
    }
    const admission = latestAdmission || {
      status: this._active ? 'pending' : 'inactive',
      admitted: false,
      evaluatedAt: null,
      reasons: [...blockers],
    };
    return {
      version: 1,
      capturedAt: evaluatedAt,
      active: this._active,
      managerState: this._state,
      phase: resolveEpisodeDiagnosticPhase({
        active: this._active,
        managerState: this._state,
        admission,
        endpoint,
        permit,
      }),
      goalEntry: this.getGoalEntrySnapshot(),
      manual: this._feedHorizonInspection.isActive(),
      feedDecision: decision,
      admission,
      blockers,
      surfaceEntryGrace: { ...grace },
      endpoint: {
        armed: endpoint.armed === true,
        active: endpoint.active === true,
        controlsLive: endpoint.controlsLive === true,
        continueIntentPending: endpoint.continueIntentPending === true,
        boundaryReached: endpoint.boundaryReached === true,
        boundaryReachedAt: Math.max(0, Number(endpoint.boundaryReachedAt) || 0),
        stillGateMs: endpoint.stillGateMs === null
          ? null
          : Math.max(0, Number(endpoint.stillGateMs) || 0),
        holdRemainingMs: Math.max(0, Number(endpoint.holdRemainingMs) || 0),
        leaseState: endpoint.leaseState || 'unknown',
        resolutionStatus: endpoint.resolutionStatus || 'unknown',
        resolutionReasons: Array.isArray(endpoint.resolutionReasons)
          ? [...endpoint.resolutionReasons]
          : [],
        boundaryMotion: endpoint.boundaryMotion && typeof endpoint.boundaryMotion === 'object'
          ? {
            mode: endpoint.boundaryMotion.mode || 'inactive',
            displacementPx: Math.max(
              0,
              Number(endpoint.boundaryMotion.displacementPx) || 0,
            ),
            maximumDisplacementPx: Math.max(
              0,
              Number(endpoint.boundaryMotion.maximumDisplacementPx) || 0,
            ),
            restTolerancePx: Math.max(
              0,
              Number(endpoint.boundaryMotion.restTolerancePx) || 0,
            ),
            settling: endpoint.boundaryMotion.settling === true,
            diagnostics: endpoint.boundaryMotion.diagnostics
              && typeof endpoint.boundaryMotion.diagnostics === 'object'
              ? {
                observedDisplacementPx: Math.max(
                  0,
                  Number(endpoint.boundaryMotion.diagnostics.observedDisplacementPx) || 0,
                ),
                velocityPxPerSecond: Number(
                  endpoint.boundaryMotion.diagnostics.velocityPxPerSecond,
                ) || 0,
                lastInputAgeMs: Math.max(
                  0,
                  Number(endpoint.boundaryMotion.diagnostics.lastInputAgeMs) || 0,
                ),
                lastFrameAgeMs: Math.max(
                  0,
                  Number(endpoint.boundaryMotion.diagnostics.lastFrameAgeMs) || 0,
                ),
              }
              : null,
          }
          : null,
      },
      spawnPermit: { ...permit },
      admissionTransport: this._spawnPolicy.getSnapshot({ now: evaluatedAt,
        source: ENSO_SPAWN_SOURCES.FEED_HORIZON }).admissionTransport,
      inspection: this._feedHorizonInspection.getSnapshot(),
    };
  }

  _recordAdmissionDecision(admission) {
    this._latestAdmissionDecision = admission;
    const reasons = Array.isArray(admission?.reasons) ? admission.reasons : [];
    const signature = [
      admission?.status || 'missing',
      admission?.blockedAt || 'none',
      admission?.readinessStatus || 'missing',
      admission?.safetyStatus || 'missing',
      admission?.capability || 'missing',
      admission?.surfaceEntryGrace?.allowed === true ? 'grace_clear' : 'grace_active',
      admission?.spawnPolicy?.reason || 'spawn_missing',
      ...reasons,
    ].join(':');
    if (signature === this._lastAdmissionDiagnosticSignature) return admission;
    this._lastAdmissionDiagnosticSignature = signature;
    if (admission?.admitted !== true) {
      recordProtectionFeatureEvent('infiniteScrollGuard', 'enso_feed_episode_withheld', {
        status: admission.status,
        decisionId: admission.decisionId,
        blockedAt: admission.blockedAt,
        reasons,
        cadence: admission.cadence,
        confidence: admission.confidence,
        readinessStatus: admission.readinessStatus,
        safetyStatus: admission.safetyStatus,
        capability: admission.capability,
        surfaceEntryGrace: admission.surfaceEntryGrace,
        spawnPolicy: admission.spawnPolicy,
      });
    }
    return admission;
  }

  _hasLifecycleOwnership() {
    return this._active
      || this._goalEntry !== null
      || this._goalLease !== null
      || this._goalClaim !== null
      || this._feedConsumerAttached
      || this._listenerLeaseHeld
      || this._spawnSourceActive
      || this._spawnPermit !== null
      || this._episodeSurfaceClaim !== null
      || isEnsoFeedEpisodeAdmissionActive(this._episodeAdmission);
  }

  _activateSpawnSource(now = Date.now(), protectionContext) {
    const snapshot = this._spawnPolicy.configure({
      source: ENSO_SPAWN_SOURCES.FEED_HORIZON,
      enabled: true,
      protectionContext,
    }, { now });
    this._spawnSourceActive = true;
    return snapshot;
  }

  _reserveSpawnPermit(now = Date.now()) {
    if (this._spawnPermit) return { ok: true, permit: this._spawnPermit };
    const reservation = this._spawnPolicy.reserve({
      source: ENSO_SPAWN_SOURCES.FEED_HORIZON,
      manual: this._feedHorizonInspection.isActive(),
      now,
    });
    if (!reservation?.ok || !reservation.permit) {
      recordProtectionFeatureEvent('infiniteScrollGuard', 'enso_feed_spawn_policy_blocked', {
        reason: reservation?.decision?.reason || 'reservation_rejected',
        activeEpisodeSource: reservation?.decision?.activeEpisode?.source || null,
      });
      return reservation;
    }
    this._spawnPermit = reservation.permit;
    return reservation;
  }

  _hasCommittedSpawnPermit() {
    if (!this._spawnPermit) return false;
    return this._spawnPolicy.inspectPermit(this._spawnPermit)?.committed === true;
  }

  _hasCommittedEndpointLease() {
    if (typeof this._terminusController.getEndpointState !== 'function') return false;
    const endpoint = this._terminusController.getEndpointState();
    return endpoint?.active === true && endpoint?.leaseState === 'committed';
  }

  _commitSpawnPermit(now = Date.now()) {
    if (!this._spawnPermit) return false;
    try {
      const result = this._spawnPolicy.commit(this._spawnPermit, { now });
      if (result?.committedNow) {
        recordProtectionFeatureEvent('infiniteScrollGuard', 'enso_feed_horizon_presented', {
          decisionId: this._episodeAdmission.decisionId,
          permitId: this._spawnPermit.id,
          cadence: this._episodeAdmission.cadence,
        });
      }
      return result?.ok === true;
    } catch (error) {
      this._reportFailure('enso_feed_spawn_policy_commit', error);
      return false;
    }
  }

  _releaseSpawnPermit(reason = 'episode_resolved') {
    const permit = this._spawnPermit;
    if (!permit) return true;
    const released = this._spawnPolicy.release(permit) === true;
    if (!released) {
      this._reportFailure(
        'enso_feed_spawn_policy_release',
        new Error('ENSO_FEED_SPAWN_PERMIT_RELEASE_NOT_CONFIRMED'),
        { reason },
      );
      return false;
    }
    recordProtectionFeatureEvent('infiniteScrollGuard', 'enso_feed_permit_released', {
      decisionId: this._episodeAdmission?.decisionId ?? this._latestAdmissionDecision?.decisionId ?? null,
      permitId: permit.id, reason,
    });
    this._spawnPermit = null;
    return true;
  }

  _evaluateEpisodeAdmission({ allowReservation = false } = {}) {
    if (!this._active) return this._episodeAdmission;
    const now = Date.now();
    const feedDecision = this._getEffectiveFeedFlowDecision();
    if (isEnsoFeedEpisodeAdmissionActive(this._episodeAdmission)) {
      if (this._hasCommittedSpawnPermit() || this._hasCommittedEndpointLease()) {
        if (this._state !== 'ENSO_PENDING' && !this._episodeSurfaceClaim) {
          this._claimEpisodePrelude();
        }
        return this._episodeAdmission;
      }
      if (
        this._state !== 'ENSO_PENDING'
        && feedDecision
      ) {
        const refreshedAdmission = this._recordAdmissionDecision(resolveEnsoFeedEpisodeAdmission({
          manual: this._feedHorizonInspection.isActive(),
          feedDecision,
          spawnPolicyDecision: this._getSpawnPolicyDecision(now),
          surfaceEntryGraceDecision: this._getEffectiveSurfaceEntryGraceDecision(now),
          now,
        }));
        if (!isEnsoFeedEpisodeAdmissionActive(refreshedAdmission)) {
          this._abortEpisode('enso_boundary_withdrawn');
          return refreshedAdmission;
        }
        this._episodeAdmission = refreshedAdmission;
      }
      if (this._state !== 'ENSO_PENDING' && !this._episodeSurfaceClaim) {
        this._claimEpisodePrelude();
      }
      return this._episodeAdmission;
    }
    if (!feedDecision) return null;
    const surfaceEntryGraceDecision = this._getEffectiveSurfaceEntryGraceDecision(now);
    const admission = resolveEnsoFeedEpisodeAdmission({
      manual: this._feedHorizonInspection.isActive(),
      feedDecision,
      spawnPolicyDecision: this._getSpawnPolicyDecision(now),
      surfaceEntryGraceDecision,
      now,
    });
    if (!isEnsoFeedEpisodeAdmissionActive(admission)) {
      this._recordAdmissionDecision(admission);
      if (
        surfaceEntryGraceDecision.allowed === false
        && this._lastSurfaceGraceBlockedId !== surfaceEntryGraceDecision.semanticSurfaceId
      ) {
        this._lastSurfaceGraceBlockedId = surfaceEntryGraceDecision.semanticSurfaceId;
        recordProtectionFeatureEvent('infiniteScrollGuard', 'enso_feed_surface_grace_blocked', {
          semanticSurfaceId: surfaceEntryGraceDecision.semanticSurfaceId,
          enteredAt: surfaceEntryGraceDecision.enteredAt,
          graceMs: surfaceEntryGraceDecision.graceMs,
          remainingMs: surfaceEntryGraceDecision.remainingMs,
        });
      }
      return admission;
    }
    if (!allowReservation) {
      return this._recordAdmissionDecision(withholdEnsoFeedEpisodeAdmission(admission, {
        stage: 'reservation', reason: 'fresh_boundary_required', pending: true,
      }));
    }
    const reservation = this._reserveSpawnPermit(now);
    if (!reservation?.ok) {
      return this._recordAdmissionDecision(withholdEnsoFeedEpisodeAdmission(admission, {
        stage: 'reservation', reason: reservation.decision.reason,
        pending: reservation.decision.reason === 'shared_admission_fresh_boundary_required',
      }));
    }
    const reservedAdmission = this._recordAdmissionDecision(resolveEnsoFeedEpisodeAdmission({
      manual: this._feedHorizonInspection.isActive(),
      feedDecision,
      spawnPolicyDecision: this._getSpawnPolicyDecision(now),
      surfaceEntryGraceDecision: this._getEffectiveSurfaceEntryGraceDecision(now),
      now,
    }));
    if (!isEnsoFeedEpisodeAdmissionActive(reservedAdmission)) {
      this._releaseSpawnPermit('reserved_admission_rejected');
      return reservedAdmission;
    }
    if (!this._claimEpisodePrelude()) {
      this._releaseSpawnPermit('prelude_claim_rejected');
      return this._recordAdmissionDecision(withholdEnsoFeedEpisodeAdmission(reservedAdmission, {
        stage: 'surface', reason: 'prelude_claim_rejected',
      }));
    }
    this._episodeAdmission = reservedAdmission;
    this._state = 'HORIZON';
    recordProtectionFeatureEvent('infiniteScrollGuard', 'enso_feed_episode_admitted', {
      decisionId: reservedAdmission.decisionId,
      permitId: this._spawnPermit.id,
      cadence: reservedAdmission.cadence,
      confidence: reservedAdmission.confidence,
      capability: reservedAdmission.capability,
      spawnPolicyReason: reservedAdmission.spawnPolicy.reason,
      surfaceEntryGrace: reservedAdmission.surfaceEntryGrace,
    });
    return reservedAdmission;
  }

  _claimEpisodePrelude() {
    if (this._episodeSurfaceClaim) return true;
    const result = this._claimPreludeSurface({
      onSuppress: (details) => {
        this._episodeSurfaceClaim = null;
        this._abortEpisode(details?.reason || 'preempted_by_higher_surface');
      },
    });
    if (!result?.accepted || !result.claim) {
      recordProtectionFeatureEvent('infiniteScrollGuard', 'enso_feed_prelude_surface_blocked', {
        reason: result?.reason || 'claim_rejected',
        activeSurfaceType: result?.active?.type || null,
      });
      return false;
    }
    this._episodeSurfaceClaim = result.claim;
    return true;
  }

  _releaseEpisodeSurfaceClaim(reason = 'episode_resolved') {
    const claim = this._episodeSurfaceClaim;
    if (!claim) return true;
    try {
      const released = claim.release?.({ reason }) !== false;
      if (!released) {
        this._reportFailure(
          'enso_feed_prelude_surface_release',
          new Error('ENSO_FEED_PRELUDE_SURFACE_RELEASE_NOT_CONFIRMED'),
          { reason },
        );
        return false;
      }
      this._episodeSurfaceClaim = null;
      return true;
    } catch (error) {
      this._reportFailure('enso_feed_prelude_surface_release', error, { reason });
      return false;
    }
  }

  _handleContinueIntent({ anchor = null } = {}) {
    if (!this._active || !isEnsoFeedEpisodeAdmissionActive(this._episodeAdmission)) return false;
    const inspectionResult = this._feedHorizonInspection.handleContinueIntent({
      requestedAt: Date.now(),
    });
    if (inspectionResult.handled) return inspectionResult.accepted;
    const result = this._interactionManager.requestEnsoGate({
      source: 'feed_horizon',
      admission: this._episodeAdmission,
      spawnPermit: this._spawnPermit,
      target: anchor,
      onOutcome: (outcome) => this._handleEnsoOutcome(outcome),
    });
    if (result?.ok !== true) {
      recordProtectionFeatureEvent('infiniteScrollGuard', 'enso_feed_gate_request_rejected', {
        decisionId: this._episodeAdmission.decisionId,
        permitId: this._spawnPermit.id,
        reason: result?.reason || 'request_rejected',
      });
      return false;
    }
    // claimEnsoGateSurface atomically replaced the passive prelude claim under
    // the same owner id. The stale handle must not release the active gate.
    this._episodeSurfaceClaim = null;
    this._state = 'ENSO_PENDING';
    return true;
  }

  _handleEnsoOutcome({ action = 'neutral', reason = null } = {}) {
    if (!this._active) return false;
    let resolved = false;
    try {
      resolved = this._terminusController.resolveContinueIntent(action, {
        now: Date.now(),
      }) === true;
    } catch (error) {
      this._reportFailure('enso_feed_outcome', error, { action, reason });
      return false;
    }

    if (action === 'neutral') {
      if (!resolved) return false;
      this._state = 'HORIZON';
      if (this._claimEpisodePrelude()) return true;
      this._abortEpisode('prelude_reclaim_failed');
      return false;
    }

    if (!resolved) {
      // InteractionManager has already closed the gesture surface. Preserve
      // the admitted episode and restored endpoint so renewed demand can be
      // retried instead of allowing a failed canonical transition to look
      // resolved on the next frame.
      this._state = 'HORIZON';
      this._claimEpisodePrelude();
      recordProtectionFeatureEvent('infiniteScrollGuard', 'enso_feed_outcome_unconfirmed', {
        action,
        reason,
      });
      return false;
    }

    if (this._terminusController.disarm() === false) {
      this._reportFailure('enso_feed_outcome_disarm', new Error('FEED_TERMINUS_DISARM_NOT_CONFIRMED'), {
        action,
      });
      this._state = 'HORIZON';
      this._claimEpisodePrelude();
      return false;
    }
    if (!this._releaseEpisodeSurfaceClaim(`enso_${action}`)) return false;
    if (!this._releaseSpawnPermit(`enso_${action}`)) return false;
    this._episodeAdmission = null;
    this._latestAdmissionDecision = null;
    this._state = 'OBSERVING';
    this._finishFeedHorizonInspection(`enso_${action}`);
    recordProtectionFeatureEvent('infiniteScrollGuard', 'enso_feed_episode_resolved', {
      action,
      reason,
      resolved,
    });
    return true;
  }

  _abortEpisode(reason = 'episode_aborted') {
    if (this._goalEntry && !this._spawnPermit) return this.cancelGoalEntry(reason);
    const hasAdmission = isEnsoFeedEpisodeAdmissionActive(this._episodeAdmission);
    if (!hasAdmission && !this._spawnPermit && !this._episodeSurfaceClaim) {
      this._finishFeedHorizonInspection(reason);
      return true;
    }
    if (hasAdmission) {
      this._interactionManager.cancelEnsoGateForSource?.('feed_horizon', reason);
    }
    // Cancellation settles synchronously. Its outcome callback may already
    // have completed the canonical retreat and cleared the episode.
    if (
      !isEnsoFeedEpisodeAdmissionActive(this._episodeAdmission)
      && !this._spawnPermit
      && !this._episodeSurfaceClaim
    ) return true;
    const released = this._terminusController.abortEpisode(reason) === true;
    if (!released) return false;
    if (!this._releaseEpisodeSurfaceClaim(reason)) return false;
    if (!this._releaseSpawnPermit(reason)) return false;
    this._episodeAdmission = null;
    this._latestAdmissionDecision = null;
    this._state = 'OBSERVING';
    this._finishFeedHorizonInspection(reason);
    return released;
  }

  _handleContinue() {
    if (!this._active) return false;
    try {
      this._feedFlowRuntime.markContinue({
        now: Date.now(),
      });
    } catch (error) {
      this._reportFailure('feed_terminus_continue', error);
      return false;
    }
    recordProtectionFeatureEvent('infiniteScrollGuard', 'feed_terminus_continue', {
    });
    return true;
  }

  _handleRetreat(source = 'enso_episode_aborted', {
    finishedReason = source,
  } = {}) {
    if (!this._active) return false;
    const admittedEpisodeActive = isEnsoFeedEpisodeAdmissionActive(this._episodeAdmission);
    const inspectionAdmissionActive = this._feedHorizonInspection.isActive();
    let decision = null;
    try {
      decision = this._feedFlowRuntime.markRetreat({
        now: Date.now(),
        source,
        preserveConsumption: inspectionAdmissionActive || !this._hasCommittedSpawnPermit(),
      });
    } catch (error) {
      this._reportFailure('feed_terminus_retreat', error);
      return false;
    }
    const released = decision?.state === 'none'
      || (
        decision === null
        && (admittedEpisodeActive || inspectionAdmissionActive)
      );
    if (released) {
      if (!this._releaseEpisodeSurfaceClaim(source)) return false;
      if (!this._releaseSpawnPermit(source)) return false;
      this._episodeAdmission = null;
      this._latestAdmissionDecision = null;
      this._state = 'OBSERVING';
      this._finishFeedHorizonInspection(finishedReason);
      recordProtectionFeatureEvent('infiniteScrollGuard', 'enso_feed_episode_retreated', {
        source,
        finishedReason,
        decisionState: decision === null ? 'already_neutral' : 'released',
      });
    }
    return released;
  }

  _reportFailure(phase, error, details = {}) {
    return reportEnsoEpisodeFailure(phase, error, details);
  }
}

const feedBoundaryEpisodeCoordinator = new FeedBoundaryEpisodeCoordinator();
export { FeedBoundaryEpisodeCoordinator };
export default feedBoundaryEpisodeCoordinator;
