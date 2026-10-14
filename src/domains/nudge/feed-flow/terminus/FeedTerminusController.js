/**
 * FeedTerminusController — commits a canonical safe interrupt as a feed-local
 * DOM endpoint. Detection remains owned by FeedFlowRuntime; this controller
 * resolves stable geometry, owns the atomic endpoint lease, and projects the
 * late reflective surface inside the resulting native tail.
 */

import scrollInputOrchestrator from '../../behavior/scrollInputOrchestrator.js';
import FeedEndpointBoundaryResolver from '../actuation/FeedEndpointBoundaryResolver.js';
import FeedEndpointLease from './FeedEndpointLease.js';
import FeedTerminusStageMachine from './FeedTerminusStageMachine.js';
import TerminusSurface from './TerminusSurface.js';
import PullPastAccumulator from './PullPastAccumulator.js';
import HorizonContinueGesture from './HorizonContinueGesture.js';
import { isTextEntryKeyboardEvent } from '../../../../lib/dom/textEntryTarget.js';

const BACKWARD_KEYS = new Set(['ArrowUp', 'PageUp', 'Home', 'k']);
const FRAME_WATCHDOG_MS = 250;

function isBackwardNavigationKey(event) {
  if (!event || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return false;
  if ((event.key === ' ' || event.key === 'Spacebar') && event.shiftKey) return true;
  return BACKWARD_KEYS.has(event.key);
}

function resolveForwardKeyPull(event, windowRef) {
  if (!event || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return 0;
  if ((event.key === ' ' || event.key === 'Spacebar') && event.shiftKey) return 0;
  const viewportHeight = Math.max(480, Number(windowRef?.innerHeight) || 0);
  if (event.key === 'PageDown' || event.key === 'End' || event.key === ' ' || event.key === 'Spacebar') {
    return Math.round(viewportHeight * 0.82);
  }
  if (event.key === 'ArrowDown' || event.key === 'j') return Math.round(viewportHeight * 0.24);
  return 0;
}

function consumeTerminusKey(event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  event?.stopImmediatePropagation?.();
}

function getTerminusErrorMessage(error, fallback = 'FEED_TERMINUS_FAILURE') {
  return String(error?.message || error || fallback);
}

function scheduleFrame(callback) {
  const handle = {
    frameId: null,
    watchdogId: null,
    settled: false,
  };
  const run = () => {
    if (handle.settled) return;
    handle.settled = true;
    if (handle.frameId !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(handle.frameId);
      handle.frameId = null;
    }
    if (handle.watchdogId !== null) {
      clearTimeout(handle.watchdogId);
      handle.watchdogId = null;
    }
    callback(Date.now());
  };
  if (typeof requestAnimationFrame === 'function') {
    handle.frameId = requestAnimationFrame(run);
  }
  handle.watchdogId = setTimeout(run, FRAME_WATCHDOG_MS);
  return handle;
}

function cancelFrame(handle) {
  if (!handle || typeof handle !== 'object') return;
  handle.settled = true;
  if (handle.frameId !== null && typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(handle.frameId);
  }
  if (handle.watchdogId !== null) clearTimeout(handle.watchdogId);
  handle.frameId = null;
  handle.watchdogId = null;
}

function normalizeStillGateOverride(value) {
  if (value === null || value === undefined) return null;
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized < 0 || normalized > 30_000) {
    throw new Error('FEED_TERMINUS_STILL_GATE_OVERRIDE_INVALID');
  }
  return normalized;
}

export class FeedTerminusController {
  constructor({
    windowRef = typeof window !== 'undefined' ? window : null,
    documentRef = typeof document !== 'undefined' ? document : null,
    orchestrator = scrollInputOrchestrator,
    stageMachine = new FeedTerminusStageMachine(),
    boundaryResolver = null,
    endpointLease = null,
    surface = null,
    pullAccumulator = new PullPastAccumulator(),
    onRuntimeFailure = null,
  } = {}) {
    this._window = windowRef;
    this._document = documentRef;
    this._stageMachine = stageMachine;
    this._surface = surface || new TerminusSurface({ documentRef });
    this._pull = pullAccumulator;
    this._continueGesture = new HorizonContinueGesture();
    this._onRuntimeFailure = typeof onRuntimeFailure === 'function' ? onRuntimeFailure : null;
    this._boundaryResolver = boundaryResolver || new FeedEndpointBoundaryResolver({
      windowRef,
      documentRef,
      onRuntimeFailure: (phase, error, details) => this._reportFailure(phase, error, details),
    });
    this._endpointLease = endpointLease || new FeedEndpointLease({
      windowRef,
      documentRef,
      orchestrator,
      onRuntimeFailure: (phase, error, details) => this._reportFailure(phase, error, details),
    });

    this._armed = false;
    this._rafId = null;
    this._controlsLive = false;
    this._terminusActive = false;
    this._endpointReachedAt = 0;
    this._endpointPlan = null;
    this._getDecision = null;
    this._getAdmission = null;
    this._getActuationContext = null;
    this._callbacks = {};
    this._continueIntentPending = false;
    this._horizonEngaged = false;
    this._stillGateMsOverride = null;
    this._lastStageGateMs = null;
    this._boundFrame = () => this._frame();
    this._boundKeydown = (event) => this._handleKeydown(event);
    this._keyInputAttached = false;
    this._handlingInvalidation = false;
    this._lastResolution = null;
  }

  isArmed() {
    return this._armed;
  }

  getEndpointState({ now = Date.now() } = {}) {
    const boundaryReached = this._endpointLease?.isBoundaryReached?.() === true;
    const boundaryMotion = this._endpointLease?.getBoundaryMotionState?.() || null;
    const evaluatedAt = Math.max(0, Number(now) || Date.now());
    const stillGateMs = this._lastStageGateMs;
    const holdRemainingMs = boundaryReached && this._endpointReachedAt > 0
      && stillGateMs !== null
      ? Math.max(0, stillGateMs - (evaluatedAt - this._endpointReachedAt))
      : Math.max(0, Number(stillGateMs) || 0);
    return {
      armed: this._armed,
      active: this._terminusActive,
      controlsLive: this._controlsLive,
      continueIntentPending: this._continueIntentPending,
      boundaryReached,
      boundaryReachedAt: boundaryReached ? this._endpointReachedAt : 0,
      stillGateMs,
      holdRemainingMs: this._controlsLive ? 0 : Math.round(holdRemainingMs),
      leaseState: this._endpointLease?.getState?.() || 'idle',
      resolutionStatus: this._lastResolution?.status || 'idle',
      resolutionReasons: Array.isArray(this._lastResolution?.reasons)
        ? [...this._lastResolution.reasons]
        : [],
      boundaryMotion,
    };
  }

  /**
   * @param {object} options
   * @param {() => object} options.getDecision
   * @param {() => object} options.getAdmission
   * @param {() => object|null} options.getActuationContext content-local DOM refs
   * @param {(details: {engagedAt:number, anchor:Element|null}) => boolean} options.onHorizonEngaged
   * @param {(details: {attachedAt:number}) => boolean} options.onEndpointAttached
   * @param {(details: {active:boolean, observedAt:number}) => void} [options.onEndpointExposureChanged]
   * @param {(details: {phase:string, error:Error}) => boolean} [options.onEpisodeFailure]
   * @param {() => boolean} [options.onContinueIntent]
   * @param {() => boolean} [options.onContinue]
   * @param {(source: string, details?: {finishedReason:string}) => boolean} [options.onRetreat]
   * @param {number|null} [options.stillGateMsOverride]
   */
  arm({
    getDecision,
    getAdmission,
    getActuationContext,
    onHorizonEngaged,
    onEndpointAttached,
    onEndpointExposureChanged,
    onEpisodeFailure,
    onContinueIntent,
    onContinue,
    onRetreat,
    stillGateMsOverride = null,
  } = {}) {
    if (this._armed) return true;
    try {
      if (typeof getDecision !== 'function') {
        throw new Error('FEED_TERMINUS_DECISION_PROVIDER_REQUIRED');
      }
      if (typeof getActuationContext !== 'function') {
        throw new Error('FEED_TERMINUS_ACTUATION_CONTEXT_PROVIDER_REQUIRED');
      }
      if (typeof getAdmission !== 'function') {
        throw new Error('FEED_TERMINUS_ENSO_ADMISSION_PROVIDER_REQUIRED');
      }
      if (typeof onHorizonEngaged !== 'function') {
        throw new Error('FEED_TERMINUS_HORIZON_ENGAGED_OWNER_REQUIRED');
      }
      if (typeof onEndpointAttached !== 'function') {
        throw new Error('FEED_TERMINUS_ENDPOINT_ATTACHED_OWNER_REQUIRED');
      }
      if (onEndpointExposureChanged !== undefined && typeof onEndpointExposureChanged !== 'function') {
        throw new Error('FEED_TERMINUS_EXPOSURE_OBSERVER_INVALID');
      }
      this._getDecision = getDecision;
      this._getAdmission = getAdmission;
      this._getActuationContext = getActuationContext;
      this._callbacks = {
        onHorizonEngaged,
        onEndpointAttached,
        onEndpointExposureChanged,
        onEpisodeFailure,
        onContinueIntent,
        onContinue,
        onRetreat,
      };
      this._stillGateMsOverride = normalizeStillGateOverride(stillGateMsOverride);
      this._stageMachine.reset();
      this._boundaryResolver.reset();
      this._resetContinueGesture(Date.now());
      this._controlsLive = false;
      this._terminusActive = false;
      this._endpointReachedAt = 0;
      this._endpointPlan = null;
      this._lastResolution = null;
      this._continueIntentPending = false;
      this._horizonEngaged = false;
      this._lastStageGateMs = null;
      this._armed = true;
      this._attachKeyInput();
      this._rafId = scheduleFrame(this._boundFrame);
      return true;
    } catch (error) {
      this._armed = false;
      this._rafId = null;
      this._getDecision = null;
      this._getAdmission = null;
      this._getActuationContext = null;
      this._callbacks = {};
      this._horizonEngaged = false;
      this._stillGateMsOverride = null;
      this._lastStageGateMs = null;
      this._detachKeyInput();
      this._reportFailure('terminus_arm', error);
      return false;
    }
  }

  disarm() {
    if (!this._armed) return true;
    if (!this._releaseEndpoint()) return false;
    this._armed = false;
    cancelFrame(this._rafId);
    this._rafId = null;
    this._detachKeyInput();
    this._boundaryResolver.reset();
    this._resetContinueGesture(Date.now());
    this._controlsLive = false;
    this._terminusActive = false;
    this._endpointReachedAt = 0;
    this._endpointPlan = null;
    this._getDecision = null;
    this._getAdmission = null;
    this._getActuationContext = null;
    this._callbacks = {};
    this._lastResolution = null;
    this._continueIntentPending = false;
    this._horizonEngaged = false;
    this._stillGateMsOverride = null;
    this._lastStageGateMs = null;
    return true;
  }

  _frame() {
    if (!this._armed) return;
    try {
      const now = Date.now();
      const feedFlowDecision = this._getDecision();
      const admission = this._getAdmission();
      const actuationContext = this._getActuationContext();
      const evaluatedStageDecision = this._stageMachine.evaluate({
        feedDecision: feedFlowDecision,
        admission,
      }, now);
      const stageDecision = this._stillGateMsOverride === null
        ? evaluatedStageDecision
        : {
          ...evaluatedStageDecision,
          gateMs: this._stillGateMsOverride,
        };
      this._lastStageGateMs = Math.max(0, Math.round(Number(stageDecision.gateMs) || 0));
      const endpointAuthority = this._endpointLease.isCommitted();
      const ownedStageDecision = endpointAuthority && stageDecision.stage !== 'terminus'
        ? {
          ...stageDecision,
          stage: 'terminus',
          reasons: [
            ...(Array.isArray(stageDecision.reasons) ? stageDecision.reasons : []),
            'committed_endpoint_authority',
          ],
        }
        : stageDecision;
      this._drive(ownedStageDecision, feedFlowDecision, admission, actuationContext, now);
      if (this._armed) this._rafId = scheduleFrame(this._boundFrame);
      else this._rafId = null;
    } catch (error) {
      this._reportFailure('terminus_frame', error);
      this._notifyEpisodeFailure('terminus_frame', error);
      this.disarm();
    }
  }

  _drive(stageDecision, feedFlowDecision, admission, actuationContext, now) {
    if (stageDecision.stage !== 'terminus') {
      if (!this._releaseEndpoint()) return;
      this._controlsLive = false;
      this._terminusActive = false;
      this._endpointReachedAt = 0;
      this._endpointPlan = null;
      this._lastResolution = null;
      this._continueIntentPending = false;
      this._lastStageGateMs = null;
      this._boundaryResolver.reset();
      return;
    }

    if (!this._endpointLease.isCommitted()) {
      const resolution = this._boundaryResolver.resolve({
        decision: feedFlowDecision,
        admission,
        actuationContext,
      });
      this._lastResolution = resolution;
      if (resolution?.status !== 'resolved' || !resolution.plan) return;
      if (!this._engageEndpoint(resolution.plan, now)) return;
    }

    if (!this._endpointLease.validate()) return;
    this._terminusActive = true;
    if (this._endpointLease.isBoundaryReached() && !this._endpointReachedAt) {
      this._endpointReachedAt = now;
      this._resetContinueGesture(now);
    }
    if (this._endpointLease.isBoundaryReached() && !this._horizonEngaged) {
      const engaged = this._callbacks.onHorizonEngaged?.({
        engagedAt: this._endpointReachedAt || now,
        anchor: this.getPresentationAnchor(),
      }) === true;
      if (!engaged) throw new Error('FEED_TERMINUS_HORIZON_ENGAGEMENT_NOT_CONFIRMED');
      this._horizonEngaged = true;
    }

    const gateElapsed = this._endpointReachedAt > 0
      && (now - this._endpointReachedAt) >= stageDecision.gateMs;
    if (gateElapsed && !this._controlsLive) {
      this._controlsLive = true;
      this._pull.reset(now);
    } else if (!gateElapsed) {
      this._controlsLive = false;
    }

    this._surface.render({
      stage: 'terminus',
      controlsLive: this._controlsLive,
    });
  }

  _engageEndpoint(plan, now, { restoreState = null } = {}) {
    let committed = false;
    try {
      committed = this._endpointLease.commit(plan, {
        onForwardIntent: (blockedPx, ts, input) => this._handleForwardIntent(blockedPx, ts, input),
        onBackwardIntent: (ts) => this._resetContinueGesture(ts),
        onBoundaryReached: (ts) => {
          if (!this._endpointReachedAt) {
            this._endpointReachedAt = Math.max(0, Number(ts) || Date.now());
            this._resetContinueGesture(this._endpointReachedAt);
          }
        },
        onInvalidate: (reason) => this._handleEndpointInvalidation(reason),
      });
      if (!committed) throw new Error('FEED_ENDPOINT_LEASE_COMMIT_NOT_CONFIRMED');
      this._publishEndpointExposure(true, now);
      const mounted = this._surface.mount({
        mountTarget: this._endpointLease.getMountTarget(),
        paint: plan.paint,
        tailHeightPx: plan.tailHeightPx,
        revealHeightPx: plan.boundaryMotionProfile.revealPx,
        surfaceMode: plan.surfaceMode,
        onPull: (px, ts, input) => {
          if (!this._endpointLease.isBoundaryReached()) {
            this._endpointLease.applyForwardIntent(px, ts, input);
          } else {
            this._handleForwardIntent(px, ts, input);
          }
        },
        onPullInterrupted: (ts) => this._resetContinueGesture(ts),
      });
      if (!mounted) throw new Error('FEED_TERMINUS_SURFACE_MOUNT_FAILED');

      this._endpointPlan = plan;
      this._terminusActive = true;
      this._endpointReachedAt = this._endpointLease.isBoundaryReached() ? now : 0;
      if (restoreState) {
        this._endpointReachedAt = restoreState.endpointReachedAt;
        this._controlsLive = restoreState.controlsLive;
      } else {
        this._controlsLive = false;
      }
      this._surface.render({
        stage: 'terminus',
        controlsLive: this._controlsLive,
      });
      if (this._callbacks.onEndpointAttached({ attachedAt: Date.now() }) !== true) {
        throw new Error('FEED_TERMINUS_ENDPOINT_ATTACHMENT_NOT_CONFIRMED');
      }
      return true;
    } catch (error) {
      if (committed || this._endpointLease.isCommitted()) {
        try {
          this._surface.unmount();
          this._endpointLease.release();
          this._publishEndpointExposure(false, Date.now());
        } catch (cleanupError) {
          if (error && typeof error === 'object') error.cleanupError = cleanupError;
        }
      }
      this._reportFailure('feed_endpoint_engage', error, {
        adapterId: plan?.adapterId || '',
      });
      this._deactivateAfterEngagementFailure();
      this._notifyEpisodeFailure('feed_endpoint_engage', error);
      return false;
    }
  }

  _releaseEndpoint() {
    if (!this._endpointLease.isCommitted()) {
      if (this._surface.isMounted?.()) {
        try {
          this._surface.unmount();
        } catch (error) {
          this._reportFailure('terminus_surface_unmount', error);
          return false;
        }
      }
      return true;
    }
    try {
      this._endpointLease.release();
      this._publishEndpointExposure(false, Date.now());
    } catch (error) {
      this._reportFailure('feed_endpoint_release', error);
      return false;
    }
    try {
      this._surface.unmount();
    } catch (error) {
      this._reportFailure('terminus_surface_unmount', error);
    }
    return true;
  }

  _publishEndpointExposure(active, observedAt) {
    // This reports actual lease state. A history observer failure cannot turn
    // an already committed or released endpoint into a failed effect action.
    try {
      const result = this._callbacks.onEndpointExposureChanged?.({ active, observedAt });
      if (result && typeof result.then === 'function') {
        void result.catch((error) => this._reportFailure('feed_endpoint_exposure_observer', error));
      }
    } catch (error) {
      this._reportFailure('feed_endpoint_exposure_observer', error);
    }
  }

  _deactivateAfterEngagementFailure() {
    this._controlsLive = false;
    this._terminusActive = false;
    this._endpointReachedAt = 0;
    this._endpointPlan = null;
    this._continueIntentPending = false;
    this._lastStageGateMs = null;
    this._boundaryResolver.reset();
    try {
      this._surface.unmount();
    } catch (error) {
      this._reportFailure('terminus_engagement_failure_unmount', error);
    }
  }

  _attachKeyInput() {
    if (this._keyInputAttached || typeof this._window?.addEventListener !== 'function') return;
    this._window.addEventListener('keydown', this._boundKeydown, { capture: true });
    this._keyInputAttached = true;
  }

  _detachKeyInput() {
    if (!this._keyInputAttached) return;
    try {
      this._window?.removeEventListener?.('keydown', this._boundKeydown, { capture: true });
    } catch (error) {
      this._reportFailure('terminus_key_input_detach', error);
    } finally {
      this._keyInputAttached = false;
    }
  }

  _handleKeydown(event) {
    if (!this._armed || !this._terminusActive) return;
    if (isTextEntryKeyboardEvent(event)) return;
    if (isBackwardNavigationKey(event)) {
      this._endpointLease.applyBackwardIntent();
      return;
    }
    const forwardPx = resolveForwardKeyPull(event, this._window);
    if (forwardPx <= 0) return;
    if (this._endpointLease.shouldCaptureForwardInput() !== true) return;
    consumeTerminusKey(event);
    this._endpointLease.applyForwardIntent(forwardPx, Date.now(), {
      kind: 'key', key: event.key, repeat: event.repeat === true,
    });
  }

  _resetContinueGesture(now) {
    this._continueGesture.reset(now);
    this._pull.reset(now);
  }

  _handleForwardIntent(px, now, input) {
    if (!this._armed || !this._terminusActive) return;
    const gesture = this._continueGesture.observe(input, now, {
      enabled: this._armed && this._controlsLive && this._horizonEngaged
        && !this._continueIntentPending && this._endpointLease.isBoundaryReached(),
      readyAt: this._endpointReachedAt + this._lastStageGateMs,
    });
    if (gesture.newGesture || !gesture.accepted) this._pull.reset(now);
    if (!gesture.accepted) return;
    this._pull.push(px, now);
    // Only the input which crosses the threshold can request the Gate. A frame,
    // quiet period, or stale accumulator can never display it later.
    if (this._pull.isSatisfied(now)) this._continue(now);
  }

  _continue(now) {
    if (this._continueIntentPending) return true;
    const callback = this._callbacks.onContinueIntent;
    if (typeof callback !== 'function') {
      this._reportFailure(
        'terminus_continue_intent',
        new Error('FEED_TERMINUS_CONTINUE_INTENT_CALLBACK_REQUIRED'),
      );
      this._resetContinueGesture(now);
      return false;
    }
    let accepted = false;
    try {
      accepted = callback({
        requestedAt: now,
        anchor: this.getPresentationAnchor(),
      }) === true;
    } catch (error) {
      this._reportFailure('terminus_continue_intent', error);
      this._resetContinueGesture(now);
      return false;
    }
    if (!accepted) {
      this._resetContinueGesture(now);
      return false;
    }
    this._continueIntentPending = true;
    return true;
  }

  getPresentationAnchor() {
    return this._surface?.getHostElement?.()
      || this._endpointLease?.getMountTarget?.()
      || null;
  }

  /**
   * Ends the complete feed-horizon episode through its canonical lifecycle
   * owner. Native backward navigation never enters this release path; a
   * lifecycle owner must never tear down the DOM lease first and report
   * success afterward.
   */
  abortEpisode(finishedReason = 'enso_episode_aborted') {
    if (
      typeof finishedReason !== 'string'
      || !finishedReason
      || finishedReason !== finishedReason.trim()
    ) {
      throw new Error('FEED_TERMINUS_ABORT_REASON_INVALID');
    }
    const endpointOwned = this._terminusActive || this._endpointLease?.isCommitted?.() === true;
    if (!endpointOwned) {
      this._continueIntentPending = false;
      this._resetContinueGesture(Date.now());
      return this.disarm();
    }
    return this._retreat('enso_episode_aborted', { finishedReason });
  }

  resolveContinueIntent(action, { now = Date.now() } = {}) {
    if (!this._continueIntentPending) return false;
    const normalizedAction = typeof action === 'string' ? action.trim().toLowerCase() : '';

    if (normalizedAction === 'neutral') {
      this._continueIntentPending = false;
      this._resetContinueGesture(now);
      return true;
    }

    if (normalizedAction === 'leave' || normalizedAction === 'suppressed') {
      const source = normalizedAction === 'leave' ? 'enso_leave' : 'enso_suppressed';
      const released = this._requestCanonicalRelease(
        'terminus_enso_retreat_canonical_release',
        source,
      );
      this._continueIntentPending = false;
      this._resetContinueGesture(now);
      if (!released) return false;
      return this._releaseLocalTerminus();
    }

    if (normalizedAction !== 'enter') {
      throw new Error(`FEED_TERMINUS_CONTINUE_INTENT_ACTION_INVALID:${String(action)}`);
    }

    const callback = this._callbacks.onContinue;
    const continued = this._confirmCanonicalTransition({
      phase: 'terminus_continue_canonical_release',
      callback,
      invoke: (owner) => owner(),
      missingError: 'FEED_TERMINUS_CANONICAL_CONTINUE_CALLBACK_REQUIRED',
      unconfirmedError: 'FEED_TERMINUS_CANONICAL_CONTINUE_NOT_CONFIRMED',
    });
    if (!continued) {
      this._continueIntentPending = false;
      this._resetContinueGesture(now);
      return false;
    }
    this._continueIntentPending = false;
    this._controlsLive = false;
    this._terminusActive = false;
    this._endpointReachedAt = 0;
    this._endpointPlan = null;
    this._resetContinueGesture(now);
    this._boundaryResolver.reset();
    return true;
  }

  _retreat(source = 'enso_episode_aborted', { finishedReason = null } = {}) {
    if (!this._requestCanonicalRelease(
      'terminus_retreat_canonical_release',
      source,
      { finishedReason },
    )) return false;
    if (!this._releaseLocalTerminus()) return false;
    return this.disarm();
  }

  _requestCanonicalRelease(phase, source, {
    restoreOnFailure = true,
    finishedReason = null,
  } = {}) {
    const callback = this._callbacks.onRetreat;
    return this._confirmCanonicalTransition({
      phase,
      callback,
      invoke: (owner) => (
        finishedReason === null
          ? owner(source)
          : owner(source, { finishedReason })
      ),
      missingError: 'FEED_TERMINUS_CANONICAL_RELEASE_CALLBACK_REQUIRED',
      unconfirmedError: 'FEED_TERMINUS_CANONICAL_RELEASE_NOT_CONFIRMED',
      restoreOnFailure,
    });
  }

  _confirmCanonicalTransition({
    phase,
    callback,
    invoke,
    missingError,
    unconfirmedError,
    restoreOnFailure = true,
  }) {
    if (typeof callback !== 'function') {
      this._reportFailure(phase, new Error(missingError));
      if (!restoreOnFailure) this._releaseEndpoint();
      return false;
    }
    const restoreState = {
      plan: this._endpointPlan,
      controlsLive: this._controlsLive,
      endpointReachedAt: this._endpointReachedAt,
    };
    if (!this._releaseEndpoint()) return false;

    let confirmed = false;
    try {
      confirmed = invoke(callback) === true;
    } catch (error) {
      this._reportFailure(phase, error);
      if (restoreOnFailure) this._restoreEndpointAfterCanonicalFailure(phase, restoreState);
      return false;
    }
    if (!confirmed) {
      this._reportFailure(phase, new Error(unconfirmedError));
      if (restoreOnFailure) this._restoreEndpointAfterCanonicalFailure(phase, restoreState);
      return false;
    }
    return true;
  }

  _restoreEndpointAfterCanonicalFailure(phase, restoreState) {
    if (!this._terminusActive || !restoreState?.plan) return true;
    if (this._engageEndpoint(restoreState.plan, Date.now(), { restoreState })) return true;
    this._reportFailure(
      `${phase}_endpoint_restore`,
      new Error('FEED_TERMINUS_ENDPOINT_RESTORE_FAILED'),
    );
    this._deactivateAfterEngagementFailure();
    return false;
  }

  _releaseLocalTerminus() {
    if (!this._releaseEndpoint()) return false;
    this._controlsLive = false;
    this._terminusActive = false;
    this._endpointReachedAt = 0;
    this._endpointPlan = null;
    this._continueIntentPending = false;
    this._lastStageGateMs = null;
    this._resetContinueGesture(Date.now());
    this._boundaryResolver.reset();
    return true;
  }

  _handleEndpointInvalidation(reason) {
    if (this._handlingInvalidation || !this._terminusActive) return;
    this._handlingInvalidation = true;
    try {
      const error = new Error(`FEED_ENDPOINT_INVALIDATED:${String(reason || 'unknown')}`);
      this._reportFailure(
        'feed_endpoint_invalidated',
        error,
      );
      const canonicalReleased = this._requestCanonicalRelease(
        'terminus_endpoint_invalidation_canonical_release',
        'endpoint_invalidated',
        { restoreOnFailure: false },
      );
      const localReleased = this._releaseLocalTerminus();
      if (!localReleased) {
        this._reportFailure(
          'terminus_endpoint_invalidation_cleanup',
          new Error('FEED_TERMINUS_INVALIDATED_ENDPOINT_CLEANUP_NOT_CONFIRMED'),
        );
      }
      if (!canonicalReleased || !localReleased) {
        this._notifyEpisodeFailure('feed_endpoint_invalidated', error);
      } else if (this.disarm() === false) {
        this._reportFailure(
          'terminus_endpoint_invalidation_disarm',
          new Error('FEED_TERMINUS_INVALIDATED_ENDPOINT_DISARM_NOT_CONFIRMED'),
        );
      }
    } finally {
      this._handlingInvalidation = false;
    }
  }

  _notifyEpisodeFailure(phase, error) {
    const callback = this._callbacks.onEpisodeFailure;
    if (typeof callback !== 'function') return false;
    try {
      return callback({ phase, error }) === true;
    } catch (callbackError) {
      this._reportFailure('terminus_episode_failure_callback', callbackError, { phase });
      return false;
    }
  }

  _reportFailure(phase, error, details = {}) {
    const diagnostic = {
      phase,
      error: getTerminusErrorMessage(error),
      ...details,
    };
    if (this._onRuntimeFailure) {
      this._onRuntimeFailure(phase, error, diagnostic);
      return diagnostic;
    }
    if (typeof console !== 'undefined') {
      console.warn?.('[FeedTerminusController] runtime failure', diagnostic);
    }
    return diagnostic;
  }
}

export default FeedTerminusController;
