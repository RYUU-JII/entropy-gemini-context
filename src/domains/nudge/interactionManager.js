import interventionAdmissionClient from './runtime/interventionAdmissionClient.js';
import {
  resolveClickDelayDistribution,
  sampleClickPauseMs,
} from '../settings/config/filterValueSemantics.js';
import {
  ROOT_STATE_ATTRS,
  setRootAttribute,
} from './core/index.js';
import {
  ENSO_GATE_LEAVE_OUTCOMES,
  navigateAwayFromEnsoGate,
} from './interaction/EnsoGateNavigation.js';
import {
  ENSO_GATE_GESTURE_DECISIONS,
  ENSO_GATE_OUTCOMES,
  ENSO_GATE_PHASES,
  createEnsoGateArmedFrame,
  createEnsoGateGesture,
  finishEnsoGateGesture,
  getEnsoGateGestureFrame,
  isPointInEnsoGateStartWell,
  updateEnsoGateGesture,
} from './interaction/EnsoGateGesture.js';
import { scrollInputOrchestrator } from './behavior/index.js';
import { recordProtectionFeatureEvent } from '../protection/content/runtime/protectionRuntimeDiagnostics.js';
import {
  CLICK_ENSO_ENTRY_MS,
  CLICK_ENSO_INK_SETTLE_MS,
  CLICK_ENSO_CONTINUE_RELEASE_MS,
  CLICK_ENSO_GATE_FORCE_ENTRY_DEBUG,
  CLICK_ENSO_NEUTRAL_RELEASE_MS,
  CLICK_ENSO_SUPPRESSION_MS,
} from './interaction/interactionConstants.js';
import { state } from './interaction/interactionState.js';
import {
  createInteractionLifecycleError,
  normalizeScrollFrictionDelayMs,
  reportClickIntentGateInteractionFailure,
  reportScrollFrictionManagerFailure,
} from './interaction/interactionDiagnostics.js';
import {
  consumeClickEvent,
  getDocumentRef,
  isMouseLeftClick,
  isPrimaryPress,
  shouldBypassModifiedClick,
} from './interaction/interactionDom.js';
import { resolveClickIntentGateTarget } from './interaction/clickTargetResolver.js';
import {
  getEnsoGateReadiness,
  recordEnsoBoundary,
  getWakePresentationMs,
  resolveEnsoGateConfig,
  summarizeEnsoGateReadiness,
} from './interaction/ensoGateReadiness.js';
import ensoSpawnPolicy, {
  ENSO_SPAWN_SOURCES,
} from './interaction/EnsoSpawnPolicy.js';
import {
  createEnsoGateAnchor,
  createEnsoGateView,
  drawEnsoGateGestureFrame,
  fadeEnsoGateRetryInk,
  getGestureDataZone,
  getGestureFeedbackState,
  getGestureRouteProgress,
  removeEnsoGateView,
  setEnsoGateOutcomePresentation,
  setEnsoGateRouteVars,
  setTargetEnsoFeedback,
} from './interaction/ensoGateView.js';
import {
  FEED_ENSO_EPISODE_SURFACE_OWNER_ID,
  claimEnsoGateSurface,
} from './interaction/ensoGateSurface.js';
import { isEnsoFeedEpisodeAdmissionActive } from './interaction/ensoFeedEpisodeAdmission.js';
import { pausePlayingTabMedia } from './media/tabMediaControl.js';
import {
  isRuntimeContentionSessionActive,
  recordRuntimeOwnerWork,
} from '@runtime-contention-ledger';

const CLICK_ENSO_DEBUG_CANCEL_GRACE_MS = 250;
const CLICK_DELAY_LISTENER_OWNER = 'click_delay';
const ENSO_GATE_LISTENER_OWNER = 'enso_gate';
const DEBUG_ENSO_LISTENER_OWNER = 'runtime_debugger';

function resolveInteractionListenerDiagnosticFeatureKey(ownerId) {
  if (ownerId === CLICK_DELAY_LISTENER_OWNER) return 'clickDelay';
  if (ownerId === FEED_ENSO_EPISODE_SURFACE_OWNER_ID) return 'infiniteScrollGuard';
  return 'ensoGate';
}

function runInteractionOwnerWork(phase, source, work) {
  if (!isRuntimeContentionSessionActive()) return work();
  const startedAt = performance.now();
  try {
    return work();
  } finally {
    recordRuntimeOwnerWork({
      ownerId: 'interaction',
      phase,
      source,
      units: 1,
      startedAt,
      endedAt: performance.now(),
    });
  }
}

function syncEnsoSpawnPolicyFromEnsoGateState(now = Date.now(), protectionContext) {
  const config = resolveEnsoGateConfig();
  const enabled = state.ensoGateEnabled === true
    && config.enabled === true
    && config.mode !== 'off';
  if (!enabled) {
    ensoSpawnPolicy.deactivate(ENSO_SPAWN_SOURCES.CLICK_INTENT);
    return ensoSpawnPolicy.getSnapshot({ now });
  }
  return ensoSpawnPolicy.configure({
    source: ENSO_SPAWN_SOURCES.CLICK_INTENT,
    enabled: true,
    protectionContext,
  }, { now });
}

function getEnsoGateDiagnosticFeatureKey(gate = null) {
  return typeof gate?.diagnosticFeatureKey === 'string' && gate.diagnosticFeatureKey
    ? gate.diagnosticFeatureKey
    : 'ensoGate';
}

function recordEnsoGateEvent(gate, eventName, details = {}) {
  recordProtectionFeatureEvent(getEnsoGateDiagnosticFeatureKey(gate), eventName, {
    episode: { source: gate.source, permitId: gate.spawnPermit?.id ?? null }, ...details,
  });
}

function settleEnsoGateOutcome(gate, action, details = {}) {
  if (!gate || gate.outcomeSettled) return gate?.outcomeConfirmed !== false;
  gate.outcomeSettled = true;
  let confirmed = true;
  if (typeof gate.onOutcome === 'function') {
    try {
      confirmed = gate.onOutcome({
        action,
        source: gate.source,
        reason: details.reason || null,
        cancelSource: details.cancelSource || null,
        decisionReason: details.decisionReason || null,
      }) === true;
    } catch (error) {
      confirmed = false;
      recordEnsoGateEvent(gate, 'enso_gate_outcome_callback_failed', {
        action,
        source: gate.source,
        error: String(error?.message || error || 'ENSO_GATE_OUTCOME_CALLBACK_FAILED'),
      });
    }
  }
  gate.outcomeConfirmed = confirmed;
  return confirmed;
}

// ---------------------------------------------------------------------------
// Click replay / pending-click lifecycle
// ---------------------------------------------------------------------------

function clearPendingClick() {
  const pending = state.pendingClick;
  if (!pending) return;
  clearTimeout(pending.timerId);
  restoreClickFeedback(pending.plan);
  state.pendingClick = null;
}

function createClickReplayPlan(target, event) {
  return {
    strategy: 'synthetic-click',
    target,
    originalOpacity: target.style.opacity,
    originalFilter: target.style.filter,
    gesture: {
      button: Number.isFinite(event?.button) ? event.button : 0,
      clientX: Number.isFinite(event?.clientX) ? event.clientX : null,
      clientY: Number.isFinite(event?.clientY) ? event.clientY : null,
      pointerType: typeof event?.pointerType === 'string' ? event.pointerType : null,
    },
  };
}

function restoreClickFeedback(plan) {
  const target = plan?.target;
  if (!(target instanceof Element) || !target.isConnected) return;
  target.style.setProperty('opacity', plan.originalOpacity || '');
  if (!plan.originalOpacity) target.style.removeProperty('opacity');
  target.style.setProperty('filter', plan.originalFilter || '');
  if (!plan.originalFilter) target.style.removeProperty('filter');
}

function isReplayableTarget(target) {
  if (!(target instanceof Element) || !target.isConnected) return false;
  if (target.hasAttribute('disabled') || target.getAttribute('aria-disabled') === 'true') return false;
  return true;
}

function createReplayOutcome(ok, reason = null, error = null) {
  return { ok, reason, error };
}

function replayClick(plan) {
  const target = plan?.target;
  if (!isReplayableTarget(target)) {
    return createReplayOutcome(false, 'target_not_replayable');
  }
  state.replayGuard.add(target);
  try {
    target.click();
    return createReplayOutcome(true);
  } catch (error) {
    const diagnostic = reportClickIntentGateInteractionFailure('replay', error, {
      tagName: target?.tagName || null,
    });
    return createReplayOutcome(false, 'click_throw', diagnostic.error);
  } finally {
    state.replayGuard.delete(target);
  }
}

// ---------------------------------------------------------------------------
// Enso-gate leave navigation
// ---------------------------------------------------------------------------

async function performEnsoGateLeaveNavigation(gate = null) {
  let outcome = ENSO_GATE_LEAVE_OUTCOMES.FAILED;
  let refusedBy = null;
  let navigationError = null;
  try {
    const result = await navigateAwayFromEnsoGate(undefined, { admissionLease: gate?.surfaceClaim?.admissionLease });
    outcome = result.outcome;
    refusedBy = result.refusedBy;
  } catch (error) {
    const diagnostic = reportClickIntentGateInteractionFailure(
      'enso_gate_leave_navigation',
      error,
      {},
      getEnsoGateDiagnosticFeatureKey(gate),
    );
    navigationError = diagnostic.error;
  }
  // Standing down is a settled outcome, not a failure: a higher intervention
  // owns the tab and will present its own way out. The surface claim was
  // already released by clearEnsoGate, so there is nothing left to undo.
  if (outcome === ENSO_GATE_LEAVE_OUTCOMES.FAILED && !navigationError) {
    const diagnostic = reportClickIntentGateInteractionFailure(
      'enso_gate_leave_navigation',
      new Error('leave navigation produced no exit'),
      {},
      getEnsoGateDiagnosticFeatureKey(gate),
    );
    navigationError = diagnostic.error;
  }
  recordEnsoGateEvent(gate, 'enso_gate_leave_navigation', {
    navigated: outcome === ENSO_GATE_LEAVE_OUTCOMES.CLOSED
      || outcome === ENSO_GATE_LEAVE_OUTCOMES.REDIRECTED,
    outcome,
    refusedBy,
    navigationError,
  });
}

// ---------------------------------------------------------------------------
// Enso-gate frame loop
// ---------------------------------------------------------------------------

function updateEnsoGateView(gate, now = Date.now()) {
  if (!gate?.view) return;
  let frame = gate.pendingDecision?.decision?.frame || gate.armedFrame;
  if (!gate.resolving && gate.gesture) {
    const pendingPoints = gate.pendingPoints.splice(0);
    if (pendingPoints.length > 0) {
      for (const point of pendingPoints) {
        frame = updateEnsoGateGesture(gate.gesture, {
          x: point.x,
          y: point.y,
          now: Math.min(now, Math.max(gate.gesture.startedAt, point.at)),
        });
      }
      if (
        gate.gesture.phase !== ENSO_GATE_PHASES.DRAWING
        && gate.gesture.lastPhysicsAt < now
      ) {
        const lastPoint = pendingPoints.at(-1);
        frame = updateEnsoGateGesture(gate.gesture, {
          x: lastPoint.x,
          y: lastPoint.y,
          now,
        });
      }
    } else if (gate.gesture.phase === ENSO_GATE_PHASES.DRAWING) {
      frame = getEnsoGateGestureFrame(gate.gesture, now);
    } else {
      frame = updateEnsoGateGesture(gate.gesture, { now });
    }
  }
  if (!gate.resolving && frame?.autoCancel) {
    finishEnsoGate(null, 'timeout');
    return;
  }
  const zone = getGestureDataZone(frame);
  const routeProgress = getGestureRouteProgress(frame);
  if (gate.targetFeedbackEnabled) {
    setTargetEnsoFeedback(gate.target, true, routeProgress, gate.config);
  }
  gate.zone = zone;
  setEnsoGateRouteVars(gate.view, frame);
  if (gate.view.dataset.zone !== zone) gate.view.dataset.zone = zone;
  const feedback = getGestureFeedbackState(frame);
  if (gate.view.dataset.feedback !== feedback) gate.view.dataset.feedback = feedback;
  drawEnsoGateGestureFrame(gate, frame, { now });
}

function requestEnsoGateAnimationFrame(callback) {
  const win = typeof window !== 'undefined' ? window : null;
  const requestFrame = win?.requestAnimationFrame || globalThis.requestAnimationFrame;
  if (typeof requestFrame === 'function') {
    return {
      id: requestFrame.call(win || globalThis, callback),
      type: 'raf',
    };
  }
  return {
    id: setTimeout(() => callback(Date.now()), 16),
    type: 'timeout',
  };
}

function cancelEnsoGateAnimationFrame(frameRequest) {
  if (!frameRequest) return;
  const win = typeof window !== 'undefined' ? window : null;
  if (frameRequest.type === 'raf') {
    const cancelFrame = win?.cancelAnimationFrame || globalThis.cancelAnimationFrame;
    if (typeof cancelFrame === 'function') cancelFrame.call(win || globalThis, frameRequest.id);
    return;
  }
  clearTimeout(frameRequest.id);
}

function scheduleEnsoGateFrame(gate) {
  if (!gate || state.ensoGate !== gate || gate.frameRequest) return;
  gate.frameRequest = requestEnsoGateAnimationFrame(() => {
    gate.frameRequest = null;
    if (state.ensoGate !== gate) return;
    updateEnsoGateView(gate);
    if (state.ensoGate === gate && shouldContinueEnsoGateFrame(gate)) scheduleEnsoGateFrame(gate);
  });
}

function shouldContinueEnsoGateFrame(gate, now = Date.now()) {
  if (!gate || gate.visualComplete) return false;
  if (gate.pendingPoints.length > 0) return true;
  if (gate.resolving) return now < (Number(gate.inkSettleUntil) || 0);
  const gesture = gate.gesture;
  if (!gesture) return false;
  if (gesture.phase === ENSO_GATE_PHASES.DRAWING) {
    return Math.abs(gesture.raw.x - gesture.start.x) >= gesture.layout.radius
      && now - gesture.startedAt < gesture.config.minimumGestureMs;
  }
  return false;
}

function completeEnsoGateEntry(gate) {
  if (!gate) return;
  gate.entryTimerId = null;
  if (state.ensoGate !== gate) return;
  gate.entryReady = true;
  gate.entryReadyAt = Date.now();
  if (gate.view) gate.view.dataset.entry = 'ready';
  updateEnsoGateView(gate);
  recordEnsoGateEvent(gate, gate.debugSpawn ? 'enso_gate_debug_entry_ready' : 'enso_gate_entry_ready', {
    durationMs: CLICK_ENSO_ENTRY_MS,
    debugSpawn: gate.debugSpawn === true,
    tagName: gate.target?.tagName || null,
  });
}

function scheduleEnsoGateEntry(gate, now = Date.now()) {
  if (!gate) return;
  const durationMs = Math.max(0, Math.round(Number(CLICK_ENSO_ENTRY_MS) || 0));
  gate.entryReady = durationMs <= 0;
  gate.entryReadyAt = gate.entryReady ? now : now + durationMs;
  if (gate.view) gate.view.dataset.entry = gate.entryReady ? 'ready' : 'summoning';
  if (gate.entryReady) return;
  gate.entryTimerId = setTimeout(() => completeEnsoGateEntry(gate), durationMs);
}

function clearEnsoGateEntry(gate) {
  if (!gate || gate.entryTimerId === null || gate.entryTimerId === undefined) return;
  clearTimeout(gate.entryTimerId);
  gate.entryTimerId = null;
}

function clearEnsoGatePresentation(gate) {
  if (!gate || gate.presentationTimerId === null || gate.presentationTimerId === undefined) return;
  clearTimeout(gate.presentationTimerId);
  gate.presentationTimerId = null;
}

function clearEnsoGate({
  restore = true,
  outcome = null,
  outcomeDetails = {},
} = {}) {
  const gate = state.ensoGate;
  if (!gate) return false;
  clearEnsoGateEntry(gate);
  clearEnsoGatePresentation(gate);
  cancelEnsoGateAnimationFrame(gate.frameRequest);
  removeEnsoGateView(gate.view);
  if (restore) restoreClickFeedback(gate.plan);
  state.ensoGate = null;
  let surfaceReleased = true;
  try {
    surfaceReleased = gate.surfaceClaim?.release?.({ reason: 'clear' }) !== false;
  } catch (error) {
    surfaceReleased = false;
    recordEnsoGateEvent(gate, 'enso_gate_surface_release_failed', {
      source: gate.source,
      error: String(error?.message || error || 'ENSO_GATE_SURFACE_RELEASE_FAILED'),
    });
  }
  if (!surfaceReleased) {
    recordEnsoGateEvent(gate, 'enso_gate_surface_release_unconfirmed', {
      source: gate.source,
    });
  }
  const outcomeConfirmed = outcome
    ? settleEnsoGateOutcome(gate, outcome, outcomeDetails)
    : true;
  let spawnPermitReleased = true;
  if (gate.ownsSpawnPermit && gate.spawnPermit) {
    spawnPermitReleased = ensoSpawnPolicy.release(gate.spawnPermit);
    if (!spawnPermitReleased) {
      recordEnsoGateEvent(gate, 'enso_spawn_permit_release_failed', {
        source: gate.source,
        outcome,
      });
    }
  }
  if (gate.debugSpawn && gate.surfaceClaim?.admissionLease) interventionAdmissionClient.release(gate.surfaceClaim.admissionLease);
  return surfaceReleased && outcomeConfirmed && spawnPermitReleased;
}

// ---------------------------------------------------------------------------
// Enso-gate pointer tracking / original-click suppression
// ---------------------------------------------------------------------------

function isSameEnsoGatePointer(gate, event) {
  if (!gate || !event?.type?.startsWith?.('pointer')) return true;
  if (gate.pointerId === null || gate.pointerId === undefined) return true;
  return Number(event.pointerId) === gate.pointerId;
}

function updateEnsoGatePointer(event) {
  const gate = state.ensoGate;
  if (!gate || !isSameEnsoGatePointer(gate, event)) return false;
  if (gate.resolving) {
    consumeClickEvent(event);
    return true;
  }
  if (!Number.isFinite(Number(event?.clientX)) || !Number.isFinite(Number(event?.clientY))) return false;
  if (!gate.gesture) {
    consumeClickEvent(event);
    return true;
  }
  gate.pendingPoints.push({
    x: Number(event.clientX),
    y: Number(event.clientY),
    at: Date.now(),
  });
  if (gate.pendingPoints.length > 192) {
    gate.pendingPoints.splice(0, gate.pendingPoints.length - 192);
  }
  scheduleEnsoGateFrame(gate);
  consumeClickEvent(event);
  return true;
}

function suppressOriginalEnsoClick(target) {
  clearSuppressedEnsoClick();
  const token = Symbol('enso-click-suppression');
  const timerId = setTimeout(() => {
    if (state.suppressedClick?.token === token) state.suppressedClick = null;
  }, CLICK_ENSO_SUPPRESSION_MS);
  state.suppressedClick = {
    target,
    token,
    timerId,
    until: Date.now() + CLICK_ENSO_SUPPRESSION_MS,
  };
}

function clearSuppressedEnsoClick() {
  const suppressed = state.suppressedClick;
  if (!suppressed) return;
  clearTimeout(suppressed.timerId);
  state.suppressedClick = null;
}

function consumeSuppressedEnsoClick(event) {
  const suppressed = state.suppressedClick;
  if (!suppressed) return false;
  if (suppressed.until <= Date.now()) {
    clearSuppressedEnsoClick();
    return false;
  }
  const rawTarget = event?.target instanceof Element ? event.target : null;
  const sameTarget = suppressed.target === rawTarget
    || (suppressed.target instanceof Element && rawTarget instanceof Element && suppressed.target.contains(rawTarget));
  if (!sameTarget) return false;
  consumeClickEvent(event);
  clearSuppressedEnsoClick();
  recordProtectionFeatureEvent('ensoGate', 'enso_gate_original_click_suppressed');
  return true;
}

function createClickRoutingDecisionDetails(resolution, action, extra = {}) {
  const routing = resolution?.clickRouting || {};
  const details = {
    action,
    reason: extra.reason || resolution?.bypassReason || null,
    phase: extra.phase || routing.eventType || null,
    eventType: routing.eventType || null,
    button: routing.button ?? null,
    isTrusted: routing.isTrusted === true,
    pointerType: routing.pointerType || null,
    rawTarget: routing.rawTarget || null,
    target: routing.target || null,
    domPath: Array.isArray(routing.domPath) ? routing.domPath.slice(0, 8) : [],
    selectorMatches: routing.selectorMatches || {},
    youtube: routing.youtube || {},
    clickBoundary: routing.clickBoundary || null,
  };
  if (extra.delayMs !== undefined) details.delayMs = extra.delayMs;
  if (extra.ensoGate) details.ensoGate = extra.ensoGate;
  return details;
}

function recordClickRoutingDecision(resolution, action, extra = {}, featureKey = 'clickDelay') {
  if (!resolution?.clickRouting) return;
  recordProtectionFeatureEvent(
    featureKey,
    'click_routing_decision',
    createClickRoutingDecisionDetails(resolution, action, extra),
  );
}

// ---------------------------------------------------------------------------
// Enso-gate start / finish
// ---------------------------------------------------------------------------

function pausePageMediaForEnsoGate(gate = null) {
  const result = pausePlayingTabMedia();
  if (result.matchedCount > 0 || result.failedCount > 0) {
    recordEnsoGateEvent(
      gate,
      gate?.debugSpawn ? 'enso_gate_debug_tab_media_paused' : 'enso_gate_tab_media_paused',
      {
        matchedCount: result.matchedCount,
        pausedCount: result.pausedCount,
        failedCount: result.failedCount,
        failureReasons: Array.from(new Set(result.failures.map((failure) => failure.reason))),
      },
    );
  }
  return result;
}

function startEnsoGate(target, event, resolution, ensoGateReadiness = null, options = {}) {
  if (!(target instanceof Element) || state.ensoGate) return false;
  const debugSpawn = options?.debugSpawn === true;
  const source = typeof options?.source === 'string' && options.source
    ? options.source
    : (debugSpawn ? 'runtime_debugger' : 'click_intent');
  const diagnosticFeatureKey = typeof options?.diagnosticFeatureKey === 'string'
    && options.diagnosticFeatureKey
    ? options.diagnosticFeatureKey
    : 'ensoGate';
  const now = Date.now();
  let spawnPermit = options?.spawnPermit || null;
  let ownsSpawnPermit = false;

  if (!debugSpawn) {
    if (spawnPermit) {
      const permitState = ensoSpawnPolicy.inspectPermit(spawnPermit);
      if (
        permitState.valid !== true
        || permitState.committed !== true
        || permitState.source !== source
      ) {
        recordProtectionFeatureEvent(diagnosticFeatureKey, 'enso_spawn_policy_blocked', {
          source,
          reason: permitState.valid ? 'episode_not_presented' : 'permit_invalid',
        });
        return false;
      }
    } else {
      const reservation = ensoSpawnPolicy.reserve({
        source,
        now,
      });
      if (!reservation.ok || !reservation.permit) {
        recordProtectionFeatureEvent(diagnosticFeatureKey, 'enso_spawn_policy_blocked', {
          source,
          reason: reservation.decision?.reason || 'reservation_rejected',
          activeEpisodeSource: reservation.decision?.activeEpisode?.source || null,
        });
        return false;
      }
      spawnPermit = reservation.permit;
      ownsSpawnPermit = true;
    }
  }
  let config = null;
  let gate = null;
  let readinessSummary = null;
  try {
    config = options?.config && typeof options.config === 'object'
      ? options.config
      : resolveEnsoGateConfig();
    const plan = createClickReplayPlan(target, event);
    const anchorEvent = createEnsoGateAnchor(target, event);
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const armedFrame = createEnsoGateArmedFrame({
      config: config.gesture,
      viewportWidth,
      viewportHeight,
    });
    gate = {
      target,
      resolution,
      plan,
      config,
      gesture: null,
      armedFrame,
      pointerId: null,
      anchorEvent,
      pendingPoints: [],
      startedAt: now,
      zone: 'neutral',
      visualComplete: false,
      inkSettleUntil: 0,
      debugSpawn,
      source,
      diagnosticFeatureKey,
      onOutcome: typeof options?.onOutcome === 'function' ? options.onOutcome : null,
      outcomeSettled: false,
      outcomeConfirmed: null,
      replayEnabled: options?.replayEnabled !== false,
      navigationEnabled: options?.navigationEnabled !== false,
      targetFeedbackEnabled: options?.targetFeedbackEnabled !== false,
      suppressOriginalClickEnabled: options?.suppressOriginalClickEnabled !== false,
      entryReady: false,
      entryReadyAt: now + CLICK_ENSO_ENTRY_MS,
      entryTimerId: null,
      entryPressBlocked: false,
      resolving: false,
      pendingDecision: null,
      presentationTimerId: null,
      view: createEnsoGateView(target, anchorEvent),
      frameRequest: null,
      surfaceClaim: null,
      spawnPermit,
      ownsSpawnPermit,
    };
    if (!gate.view) throw new Error('ENSO_GATE_VIEW_UNAVAILABLE');
    readinessSummary = summarizeEnsoGateReadiness(
      ensoGateReadiness || getEnsoGateReadiness(resolution, now),
    );
  } catch (error) {
    if (gate?.view) removeEnsoGateView(gate.view);
    if (ownsSpawnPermit) ensoSpawnPolicy.release(spawnPermit);
    reportClickIntentGateInteractionFailure('enso_gate_prepare', error, { source }, diagnosticFeatureKey);
    return false;
  }
  const surfaceResult = claimEnsoGateSurface({
    event,
    debugSpawn,
    preparedDebugLease: options.preparedDebugLease,
    source,
    ownerId: options?.surfaceOwnerId,
    diagnosticFeatureKey,
    getActiveGate: () => state.ensoGate,
    onSuppress: (details) => state.ensoGate === gate && clearEnsoGate({
      restore: true,
      outcome: 'suppressed',
      outcomeDetails: {
        reason: details?.reason || 'surface_preempted',
      },
    }),
  });
  if (!surfaceResult.accepted || !surfaceResult.claim) {
    removeEnsoGateView(gate.view);
    if (ownsSpawnPermit) ensoSpawnPolicy.release(spawnPermit);
    recordProtectionFeatureEvent(diagnosticFeatureKey, 'enso_gate_surface_blocked', {
      reason: surfaceResult.reason || 'claim_missing',
      activeSurfaceType: surfaceResult.active?.type || null,
      activeSurfaceOwnerId: surfaceResult.active?.ownerId || null,
    });
    return false;
  }
  gate.surfaceClaim = surfaceResult.claim;
  if (ownsSpawnPermit) {
    try {
      ensoSpawnPolicy.commit(spawnPermit, { now });
    } catch (error) {
      removeEnsoGateView(gate.view);
      surfaceResult.claim?.release?.({ reason: 'spawn_policy_commit_failed' });
      ensoSpawnPolicy.release(spawnPermit);
      reportClickIntentGateInteractionFailure('enso_spawn_policy_commit', error, { source }, diagnosticFeatureKey);
      return false;
    }
  }
  state.ensoGate = gate;
  if (debugSpawn && gate.surfaceClaim.admissionLease) interventionAdmissionClient.present(gate.surfaceClaim.admissionLease);
  if (gate.targetFeedbackEnabled) setTargetEnsoFeedback(target, true);
  pausePageMediaForEnsoGate(gate);
  scheduleEnsoGateEntry(gate, now);
  updateEnsoGateView(gate);
  recordClickRoutingDecision(resolution, 'enso_gate_start', {
    phase: event?.type || 'press_start',
    ensoGate: readinessSummary,
  }, diagnosticFeatureKey);
  recordEnsoGateEvent(gate, 'enso_gate_started', {
    cadence: readinessSummary?.cadence ?? null,
    reason: readinessSummary?.reason || 'unknown',
    debugSpawn,
    source,
    spawnPolicyCommitted: ownsSpawnPermit,
    readinessMutated: ownsSpawnPermit,
    tagName: target?.tagName || null,
  });
  return true;
}

function beginEnsoGateStroke(gate, event) {
  if (!gate || gate.resolving) return false;
  if (gate.gesture) return false;
  if (!isPrimaryPress(event)) return false;
  if (!Number.isFinite(Number(event?.clientX)) || !Number.isFinite(Number(event?.clientY))) return false;
  const point = { x: Number(event.clientX), y: Number(event.clientY) };
  if (!gate.entryReady) {
    if (!gate.entryPressBlocked) {
      gate.entryPressBlocked = true;
      recordEnsoGateEvent(gate, gate.debugSpawn ? 'enso_gate_debug_entry_press_held' : 'enso_gate_entry_press_held', {
        remainingMs: Math.max(0, Math.round((Number(gate.entryReadyAt) || 0) - Date.now())),
        durationMs: CLICK_ENSO_ENTRY_MS,
        debugSpawn: gate.debugSpawn === true,
        tagName: gate.target?.tagName || null,
      });
    }
    return false;
  }
  if (!isPointInEnsoGateStartWell(gate.armedFrame, point, 1.1)) {
    recordEnsoGateEvent(gate, 'enso_gate_start_point_missed', {
      tagName: gate.target?.tagName || null,
    });
    return false;
  }
  const now = Date.now();
  const pointerId = Number.isFinite(Number(event?.pointerId)) ? Number(event.pointerId) : null;
  const viewportWidth = window.innerWidth || document.documentElement?.clientWidth || 320;
  const viewportHeight = window.innerHeight || document.documentElement?.clientHeight || 240;
  gate.pointerId = pointerId;
  gate.gesture = createEnsoGateGesture({
    x: point.x,
    y: point.y,
    now,
    config: gate.config.gesture,
    viewportWidth,
    viewportHeight,
    pointerId,
    layoutMode: 'centered',
  });
  gate.pendingPoints.push({ ...point, at: now });
  gate.armedFrame = null;
  updateEnsoGateView(gate, now);
  scheduleEnsoGateFrame(gate);
  recordEnsoGateEvent(gate, gate.debugSpawn ? 'enso_gate_debug_stroke_started' : 'enso_gate_stroke_started', {
    tagName: gate.target?.tagName || null,
    debugSpawn: gate.debugSpawn === true,
  });
  return true;
}

function isDebugCancelGraceSource(cancelSource) {
  return cancelSource === 'window_blur' || cancelSource === 'visibility_hidden';
}

function shouldIgnoreDebugCancel(gate, reason, cancelSource, now = Date.now()) {
  if (!gate?.debugSpawn || reason !== 'cancel') return false;
  if (!isDebugCancelGraceSource(cancelSource)) return false;
  const startedAt = Number(gate.startedAt) || 0;
  return startedAt > 0 && now - startedAt <= CLICK_ENSO_DEBUG_CANCEL_GRACE_MS;
}

function getEnsoGateOutcomePresentationMs(gate, action, decision = null) {
  if (action === ENSO_GATE_OUTCOMES.LEAVE) return 320;
  if (action === ENSO_GATE_OUTCOMES.ENTER) return CLICK_ENSO_CONTINUE_RELEASE_MS;
  if (
    action === ENSO_GATE_OUTCOMES.NEUTRAL
    && (decision?.reason === 'stroke-unsealed' || decision?.reason === 'reopen-unconfirmed')
  ) {
    return CLICK_ENSO_NEUTRAL_RELEASE_MS;
  }
  return 0;
}

function completeEnsoGateDecision(gate) {
  if (!gate || state.ensoGate !== gate || !gate.pendingDecision) return false;
  gate.presentationTimerId = null;
  const {
    decision,
    reason,
    cancelSource,
    releaseProgress,
    presentationMs,
  } = gate.pendingDecision;
  const resolution = gate.resolution;
  const plan = gate.plan;
  const target = gate.target;
  const outcomeConfirmed = clearEnsoGate({
    restore: true,
    outcome: decision.action,
    outcomeDetails: {
      reason,
      cancelSource,
      decisionReason: decision.reason,
    },
  });

  if (decision.action === ENSO_GATE_OUTCOMES.ENTER) {
    const replayOutcome = gate.replayEnabled
      ? replayClick(plan)
      : createReplayOutcome(
          outcomeConfirmed,
          outcomeConfirmed ? 'runtime_episode_no_replay' : 'runtime_episode_enter_rejected',
        );
    const eventName = gate.debugSpawn
      ? 'enso_gate_debug_entered'
      : (replayOutcome.ok ? 'enso_gate_entered' : 'enso_gate_enter_failed');
    if (replayOutcome.ok && gate.replayEnabled && !gate.debugSpawn) {
      recordEnsoBoundary(resolution, 'enso_gate_enter');
    }
    recordEnsoGateEvent(gate, eventName, {
      reason,
      cancelSource,
      decisionReason: decision.reason,
      presentationMs,
      debugSpawn: gate.debugSpawn === true,
      tagName: target?.tagName || null,
      replayOk: replayOutcome.ok,
      replayRejectReason: replayOutcome.reason,
      replayError: replayOutcome.error,
      outcomeConfirmed,
      source: gate.source,
    });
  } else if (decision.action === ENSO_GATE_OUTCOMES.LEAVE) {
    if (gate.navigationEnabled && outcomeConfirmed) {
      void performEnsoGateLeaveNavigation(gate);
    }
    recordEnsoGateEvent(gate, gate.debugSpawn ? 'enso_gate_debug_escaped' : 'enso_gate_escaped', {
      reason,
      cancelSource,
      zone: decision.frame?.phase || 'sealed',
      decisionReason: decision.reason,
      presentationMs,
      debugSpawn: gate.debugSpawn === true,
      navigationScheduled: gate.navigationEnabled === true && outcomeConfirmed,
      outcomeConfirmed,
      source: gate.source,
      tagName: target?.tagName || null,
    });
  } else {
    recordEnsoGateEvent(gate, gate.debugSpawn ? 'enso_gate_debug_neutral_release' : 'enso_gate_neutral_release', {
      reason,
      cancelSource,
      releaseProgress,
      decisionReason: decision.reason,
      presentationMs,
      debugSpawn: gate.debugSpawn === true,
      outcomeConfirmed,
      source: gate.source,
      tagName: target?.tagName || null,
    });
  }
  return true;
}

function beginEnsoGateOutcomePresentation(gate, pendingDecision) {
  if (!gate || state.ensoGate !== gate) return false;
  const presentationMs = getEnsoGateOutcomePresentationMs(
    gate,
    pendingDecision.decision.action,
    pendingDecision.decision,
  );
  gate.resolving = true;
  gate.pendingDecision = {
    ...pendingDecision,
    presentationMs,
  };
  gate.inkSettleUntil = Date.now() + Math.min(CLICK_ENSO_INK_SETTLE_MS, Math.max(0, presentationMs));
  if (presentationMs <= 0) return completeEnsoGateDecision(gate);
  setEnsoGateOutcomePresentation(
    gate.view,
    pendingDecision.decision.action,
    presentationMs,
    pendingDecision.decision.frame,
  );
  updateEnsoGateView(gate);
  scheduleEnsoGateFrame(gate);
  gate.presentationTimerId = setTimeout(() => completeEnsoGateDecision(gate), presentationMs);
  return true;
}

function rearmEnsoGateGesture(gate, decision, reason, releaseProgress) {
  if (!gate || state.ensoGate !== gate) return false;
  gate.keyboardKey = null;
  const viewportWidth = window.innerWidth || document.documentElement?.clientWidth || 320;
  const viewportHeight = window.innerHeight || document.documentElement?.clientHeight || 240;
  fadeEnsoGateRetryInk(gate.view);
  gate.gesture = null;
  gate.pointerId = null;
  gate.pendingPoints.length = 0;
  gate.armedFrame = createEnsoGateArmedFrame({
    config: gate.config.gesture,
    viewportWidth,
    viewportHeight,
  });
  gate.resolving = false;
  gate.pendingDecision = null;
  gate.inkSettleUntil = 0;
  if (gate.view) {
    gate.view.dataset.zone = 'armed';
    gate.view.dataset.entry = gate.entryReady ? 'ready' : 'summoning';
    delete gate.view.dataset.resolving;
    delete gate.view.dataset.outcome;
    gate.view.style.removeProperty('--friction-click-enso-outcome-ms');
  }
  updateEnsoGateView(gate);
  recordEnsoGateEvent(gate, gate.debugSpawn ? 'enso_gate_debug_stroke_retry' : 'enso_gate_stroke_retry', {
    reason,
    decisionReason: decision.reason,
    releaseProgress,
    debugSpawn: gate.debugSpawn === true,
    source: gate.source,
    tagName: gate.target?.tagName || null,
  });
  return true;
}

function shouldRearmEnsoGateGesture(decision, reason) {
  if (decision?.action === ENSO_GATE_GESTURE_DECISIONS.RETRY) return true;
  return reason === 'pointercancel' || reason === 'timeout';
}

function finishEnsoGate(event, reason = 'release', metadata = {}) {
  const gate = state.ensoGate;
  if (!gate) return false;
  if (event && !isSameEnsoGatePointer(gate, event)) return false;
  if (gate.resolving) {
    if (event) consumeClickEvent(event);
    return true;
  }
  const now = Date.now();
  const cancelSource = typeof metadata?.cancelSource === 'string' ? metadata.cancelSource : null;
  if (shouldIgnoreDebugCancel(gate, reason, cancelSource, now)) {
    recordEnsoGateEvent(gate, 'enso_gate_debug_cancel_ignored', {
      reason,
      cancelSource,
      debugSpawn: true,
      ageMs: Math.max(0, now - (Number(gate.startedAt) || now)),
      tagName: gate.target?.tagName || null,
    });
    return false;
  }
  if (event) {
    event.preventDefault?.();
    event.stopPropagation?.();
    if (Number.isFinite(Number(event.clientX)) && Number.isFinite(Number(event.clientY))) {
      gate.pendingPoints.push({
        x: Number(event.clientX),
        y: Number(event.clientY),
        at: now,
      });
      updateEnsoGateView(gate, now);
    }
  }
  const decision = finishEnsoGateGesture(gate.gesture, {
    canceled: reason === 'pointercancel' || reason === 'cancel' || reason === 'timeout',
    now,
  });
  // Escape/blur may finish an armed boundary before any gesture has started.
  const releaseFrame = gate.gesture === null ? gate.armedFrame : decision.frame;
  const releaseProgress = getGestureRouteProgress(releaseFrame);
  const target = gate.target;
  if (!gate.debugSpawn && gate.suppressOriginalClickEnabled) suppressOriginalEnsoClick(target);
  if (shouldRearmEnsoGateGesture(decision, reason)) {
    return rearmEnsoGateGesture(gate, decision, reason, releaseProgress);
  }
  return beginEnsoGateOutcomePresentation(gate, {
    decision,
    reason,
    cancelSource,
    releaseProgress,
  });
}

// ---------------------------------------------------------------------------
// Delayed click scheduling
// ---------------------------------------------------------------------------

function scheduleDelayedClick(target, event, resolution = null) {
  const existing = state.pendingClick;
  if (existing?.plan?.target === target) {
    return;
  }

  clearPendingClick();

  const plan = createClickReplayPlan(target, event);
  target.style.setProperty('opacity', '0.72');
  target.style.setProperty('filter', 'saturate(0.9) brightness(0.96)');

  const token = Symbol('click-delay-token');
  const delayMs = sampleClickPauseMs(state.clickDelayDistribution);
  const timerId = setTimeout(() => {
    const current = state.pendingClick;
    if (!current || current.token !== token) return;
    state.pendingClick = null;

    restoreClickFeedback(plan);
    const replayOutcome = replayClick(plan);
    if (replayOutcome.ok && state.ensoGateEnabled) {
      recordEnsoBoundary(resolution, 'commit_pause');
    }
    recordProtectionFeatureEvent('clickDelay', replayOutcome.ok ? 'click_replayed' : 'click_replay_failed', {
      delayMs,
      tagName: target?.tagName || null,
      replayRejectReason: replayOutcome.reason,
      replayError: replayOutcome.error,
    });
  }, delayMs);

  state.pendingClick = {
    token,
    timerId,
    delayMs,
    plan,
  };
  recordClickRoutingDecision(resolution, 'delayed_click', {
    phase: event?.type || 'click',
    delayMs,
  });
  recordProtectionFeatureEvent('clickDelay', 'click_delayed', {
    delayMs,
    tagName: target?.tagName || null,
  });
}

function ignoreClickWhilePending(event, target, resolution) {
  consumeClickEvent(event);
  const rawTarget = event?.target instanceof Element ? event.target : null;
  recordProtectionFeatureEvent('clickDelay', 'click_ignored_pending', {
    reason: target ? 'pending_click_active' : (resolution?.bypassReason || 'pending_click_active'),
    pendingTagName: state.pendingClick?.plan?.target?.tagName || null,
    tagName: target?.tagName || rawTarget?.tagName || null,
  });
}

const InteractionManager = {
  acquireInteractionListenerLease(ownerId) {
    const normalizedOwnerId = typeof ownerId === 'string' ? ownerId.trim() : '';
    if (!normalizedOwnerId) throw new Error('ENSO_RUNTIME_LISTENER_OWNER_REQUIRED');
    if (state.interactionListenerOwners.has(normalizedOwnerId)) return true;
    const documentRef = getDocumentRef();
    if (!state.interactionListenersAttached) {
      const diagnosticFeatureKey = resolveInteractionListenerDiagnosticFeatureKey(normalizedOwnerId);
      try {
        this.attachInteractionListeners(documentRef, diagnosticFeatureKey);
      } catch (error) {
        try {
          this.detachInteractionListeners(documentRef, diagnosticFeatureKey);
        } catch (cleanupError) {
          if (error && typeof error === 'object') error.cleanupError = cleanupError;
        }
        throw error;
      }
      state.interactionListenersAttached = true;
    }
    state.interactionListenerOwners.add(normalizedOwnerId);
    return true;
  },

  releaseInteractionListenerLease(ownerId) {
    const normalizedOwnerId = typeof ownerId === 'string' ? ownerId.trim() : '';
    if (!normalizedOwnerId) throw new Error('ENSO_RUNTIME_LISTENER_OWNER_REQUIRED');
    if (!state.interactionListenerOwners.has(normalizedOwnerId)) return true;
    state.interactionListenerOwners.delete(normalizedOwnerId);
    if (state.interactionListenerOwners.size > 0 || !state.interactionListenersAttached) return true;
    const diagnosticFeatureKey = resolveInteractionListenerDiagnosticFeatureKey(normalizedOwnerId);
    try {
      this.detachInteractionListeners(getDocumentRef(), diagnosticFeatureKey);
      state.interactionListenersAttached = false;
      return true;
    } catch (error) {
      state.interactionListenerOwners.add(normalizedOwnerId);
      throw error;
    }
  },

  requestEnsoGate({
    source = 'feed_horizon',
    admission = null,
    spawnPermit = null,
    target = null,
    onOutcome = null,
  } = {}) {
    if (source !== 'feed_horizon') {
      throw new Error(`ENSO_RUNTIME_EPISODE_SOURCE_INVALID:${String(source)}`);
    }
    if (
      !isEnsoFeedEpisodeAdmissionActive(admission)
      || admission?.source !== 'enso_consumption_cadence'
      || admission?.episodeKind !== 'feed_horizon'
    ) {
      return { ok: false, reason: 'episode_not_admitted' };
    }
    if (!(target instanceof Element) || !target.isConnected) {
      return { ok: false, reason: 'feed_horizon_anchor_unavailable' };
    }
    if (typeof onOutcome !== 'function') {
      throw new Error('ENSO_RUNTIME_EPISODE_OUTCOME_OWNER_REQUIRED');
    }
    if (!state.interactionListenerOwners.has(FEED_ENSO_EPISODE_SURFACE_OWNER_ID)) {
      throw new Error('ENSO_RUNTIME_EPISODE_LISTENER_LEASE_REQUIRED');
    }
    const permitState = ensoSpawnPolicy.inspectPermit(spawnPermit);
    const permitDecision = ensoSpawnPolicy.evaluate({
      source: ENSO_SPAWN_SOURCES.FEED_HORIZON,
      permit: spawnPermit,
      now: Date.now(),
    });
    if (
      permitDecision.allowed !== true
      || permitState.valid !== true
      || permitState.committed !== true
      || permitState.source !== ENSO_SPAWN_SOURCES.FEED_HORIZON
    ) {
      return {
        ok: false,
        reason: permitDecision.allowed !== true
          ? (permitDecision.reason === 'policy_inactive'
              ? 'spawn_policy_inactive'
              : `spawn_policy_${permitDecision.reason}`)
          : (permitState.valid ? 'feed_horizon_not_presented' : 'spawn_permit_invalid'),
      };
    }
    if (state.ensoGate) return { ok: false, reason: 'enso_gate_already_active' };

    const documentRef = getDocumentRef();
    const win = typeof window !== 'undefined' ? window : null;
    const viewportWidth = win?.innerWidth || documentRef?.documentElement?.clientWidth || 320;
    const viewportHeight = win?.innerHeight || documentRef?.documentElement?.clientHeight || 240;
    const anchorEvent = {
      type: 'enso_feed_horizon_reentry',
      button: 0,
      clientX: Math.round(viewportWidth * 0.52),
      clientY: Math.round(viewportHeight * 0.42),
      pointerId: null,
    };
    const resolution = {
      target,
      rawTarget: target,
      bypassReason: null,
      isRewardTransition: false,
      clickBoundary: {
        kind: 'feed_horizon_reentry',
        brake: 'enso_gate_eligible',
        confidence: Number(admission.confidence) || 0,
        evidence: ['enso_consumption_cadence', 'feed_endpoint_ready'],
      },
      clickRouting: {
        eventType: anchorEvent.type,
        button: 0,
        isTrusted: false,
        pointerType: 'runtime_episode',
        rawTarget: target.tagName?.toLowerCase?.() || 'feed_horizon',
        target: target.tagName?.toLowerCase?.() || 'feed_horizon',
        domPath: ['feed_horizon'],
        selectorMatches: {},
        youtube: {},
        clickBoundary: {
          kind: 'feed_horizon_reentry',
          brake: 'enso_gate_eligible',
          confidence: Number(admission.confidence) || 0,
          evidence: 'enso_consumption_cadence',
        },
      },
    };
    const readiness = {
      ready: true,
      reason: 'enso_feed_episode_admitted',
      mode: 'runtime_episode',
      enabled: true,
      cadence: admission.cadence,
      boundaryKind: 'feed_horizon_reentry',
      boundaryBrake: 'enso_gate_eligible',
      boundaryConfidence: Number(admission.confidence) || 0,
    };
    const ok = startEnsoGate(target, anchorEvent, resolution, readiness, {
      source,
      surfaceOwnerId: FEED_ENSO_EPISODE_SURFACE_OWNER_ID,
      diagnosticFeatureKey: 'infiniteScrollGuard',
      replayEnabled: false,
      navigationEnabled: true,
      targetFeedbackEnabled: false,
      suppressOriginalClickEnabled: false,
      spawnPermit,
      onOutcome,
    });
    if (!ok) return { ok: false, reason: 'start_rejected' };
    recordProtectionFeatureEvent('infiniteScrollGuard', 'enso_feed_gate_requested', {
      decisionId: admission.decisionId,
      permitId: spawnPermit.id,
      cadence: admission.cadence,
      confidence: Number(admission.confidence) || 0,
      feedLoad: Number(admission.feedLoad) || 0,
    });
    return { ok: true, reason: 'spawned' };
  },

  cancelEnsoGateForSource(source, reason = 'owner_cancel') {
    if (!state.ensoGate || state.ensoGate.source !== source) return false;
    return clearEnsoGate({
      restore: true,
      outcome: 'suppressed',
      outcomeDetails: { reason },
    });
  },

  async forceEnsoGateForDebug({ x = null, y = null, admissionMode = 'manual' } = {}) {
    if (!['manual', 'ordinary'].includes(admissionMode)) throw new Error('ENSO_DEBUG_ADMISSION_MODE_INVALID');
    const documentRef = getDocumentRef();
    const win = typeof window !== 'undefined' ? window : null;
    const target = documentRef?.body || documentRef?.documentElement || null;
    if (!(target instanceof Element)) {
      return { ok: false, reason: 'missing_debug_target' };
    }
    if (state.ensoGate) {
      return { ok: false, reason: 'enso_gate_already_active' };
    }
    const admission = await interventionAdmissionClient.prepare({ kind: 'enso_gate', source: 'runtime_debugger', manual: admissionMode === 'manual' });
    if (!admission.accepted) return { ok: false, reason: admission.reason };
    const hadDebugListenerLease = state.interactionListenerOwners.has(DEBUG_ENSO_LISTENER_OWNER);
    if (!hadDebugListenerLease) {
      this.acquireInteractionListenerLease(DEBUG_ENSO_LISTENER_OWNER);
    }
    const viewportWidth = win?.innerWidth || documentRef?.documentElement?.clientWidth || 320;
    const viewportHeight = win?.innerHeight || documentRef?.documentElement?.clientHeight || 240;
    const anchorEvent = {
      type: 'runtime_debugger_force_spawn',
      button: 0,
      clientX: Number.isFinite(Number(x)) ? Number(x) : Math.round(viewportWidth * 0.52),
      clientY: Number.isFinite(Number(y)) ? Number(y) : Math.round(viewportHeight * 0.42),
      pointerId: null,
    };
    const resolution = {
      target,
      rawTarget: target,
      bypassReason: null,
      isRewardTransition: true,
      clickBoundary: {
        kind: 'reward_entry',
        brake: 'enso_gate_eligible',
        confidence: 1,
        evidence: ['runtime_debugger_force_spawn'],
      },
      clickRouting: {
        eventType: anchorEvent.type,
        button: 0,
        isTrusted: false,
        pointerType: 'debug',
        rawTarget: 'body',
        target: 'body',
        domPath: ['body'],
        selectorMatches: {
          interactive: false,
          actionable: false,
          explicitBypass: false,
          nativeGestureBypass: false,
          trustedBypassFamily: null,
        },
        youtube: {},
        clickBoundary: {
          kind: 'reward_entry',
          brake: 'enso_gate_eligible',
          confidence: 1,
          evidence: 'runtime_debugger_force_spawn',
        },
      },
    };
    const readiness = {
      ready: true,
      reason: 'runtime_debugger_force_spawn',
      mode: 'debug',
      enabled: true,
      cadence: null,
      pending: false,
      boundaryKind: 'reward_entry',
      boundaryBrake: 'enso_gate_eligible',
      boundaryConfidence: 1,
    };
    const ok = startEnsoGate(target, anchorEvent, resolution, readiness, {
      debugSpawn: true,
      preparedDebugLease: admission.lease,
      source: 'runtime_debugger',
      replayEnabled: false,
      navigationEnabled: false,
      onOutcome: () => {
        if (!hadDebugListenerLease) {
          this.releaseInteractionListenerLease(DEBUG_ENSO_LISTENER_OWNER);
        }
        return true;
      },
    });
    if (!ok) {
      if (!hadDebugListenerLease) {
        this.releaseInteractionListenerLease(DEBUG_ENSO_LISTENER_OWNER);
      }
      recordProtectionFeatureEvent('ensoGate', 'enso_gate_force_spawn_failed', {
        reason: 'start_rejected',
        debugSpawn: true,
      });
      return { ok: false, reason: 'start_rejected' };
    }
    recordProtectionFeatureEvent('ensoGate', 'enso_gate_force_spawned', {
      source: 'runtime_debugger',
      debugSpawn: true,
    });
    return { ok: true, reason: 'spawned' };
  },

  handlePressStart(e) {
    if (state.ensoGate) {
      if (!state.ensoGate.gesture) {
        beginEnsoGateStroke(state.ensoGate, e);
      }
      consumeClickEvent(e);
      return;
    }
    if (!state.ensoGateEnabled) return;
    if (state.pendingClick) {
      consumeClickEvent(e);
      return;
    }
    clearSuppressedEnsoClick();
    if (!isPrimaryPress(e)) return;
    if (shouldBypassModifiedClick(e)) return;

    const resolution = resolveClickIntentGateTarget(e, { diagnosticFeatureKey: 'ensoGate' });
    const target = resolution?.target || null;
    if (!target || state.replayGuard.has(target)) return;
    const ensoGateReadiness = getEnsoGateReadiness(resolution, Date.now(), {
      forceEntryForDebug: CLICK_ENSO_GATE_FORCE_ENTRY_DEBUG,
    });
    if (!ensoGateReadiness.ready) return;

    if (startEnsoGate(target, e, resolution, ensoGateReadiness)) {
      consumeClickEvent(e);
    }
  },

  handlePressEnd(e) {
    if (state.ensoGate && !state.ensoGate.gesture) {
      consumeClickEvent(e);
      return;
    }
    finishEnsoGate(e, e?.type || 'release', { cancelSource: 'press_end' });
  },

  handlePressMove(e) {
    updateEnsoGatePointer(e);
  },

  handlePressCancel(e) {
    finishEnsoGate(e, e?.type || 'cancel', { cancelSource: 'pointercancel' });
  },

  handleKeyDown(e) {
    if (e?.key === 'Escape') { finishEnsoGate(e, 'cancel', { cancelSource: 'escape_key' }); return; }
    const gate = state.ensoGate;
    if (!gate || !gate.entryReady || gate.resolving || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    consumeClickEvent(e);
    if (e.repeat || gate.gesture) return;
    const frame = gate.armedFrame;
    gate.keyboardKey = e.key;
    gate.gesture = createEnsoGateGesture({ x: frame.start.x, y: frame.start.y, now: Date.now(), config: gate.config.gesture, viewportWidth: window.innerWidth, viewportHeight: window.innerHeight });
    gate.pendingPoints.push({ x: frame.start.x + (e.key === 'ArrowRight' ? 1 : -1) * frame.radius, y: frame.start.y, at: Date.now() });
    scheduleEnsoGateFrame(gate);
  },

  handleKeyUp(e) {
    const gate = state.ensoGate;
    if (!gate || gate.keyboardKey !== e.key) return;
    consumeClickEvent(e);
    gate.keyboardKey = null;
    finishEnsoGate(null, 'release');
  },

  handleVisibilityChange() {
    if (document.visibilityState === 'hidden') finishEnsoGate(null, 'cancel', { cancelSource: 'visibility_hidden' });
  },

  handleWindowBlur() {
    finishEnsoGate(null, 'cancel', { cancelSource: 'window_blur' });
  },

  handleClick(e) {
    return runInteractionOwnerWork('click_event', e?.type || 'click', () => {
      if (!isMouseLeftClick(e)) return;

      const rawTarget = e?.target instanceof Element ? e.target : null;
      if (rawTarget && state.replayGuard.has(rawTarget)) return;
      if (consumeSuppressedEnsoClick(e)) return;
      if (state.ensoGate) {
        consumeClickEvent(e);
        return;
      }
      const clickDelayEnabled = state.clickDelayMs > 0;
      const ensoGateEnabled = state.ensoGateEnabled === true;
      if (!clickDelayEnabled && !ensoGateEnabled) return;

      if (state.pendingClick) {
        ignoreClickWhilePending(e);
        return;
      }

      if (shouldBypassModifiedClick(e)) return;

      const diagnosticFeatureKey = ensoGateEnabled ? 'ensoGate' : 'clickDelay';
      const resolution = resolveClickIntentGateTarget(e, { diagnosticFeatureKey });
      const target = resolution?.target || null;
      if (target && state.replayGuard.has(target)) return;

      if (!target && resolution?.bypassReason) {
        recordClickRoutingDecision(resolution, 'bypass', {
          phase: e?.type || 'click',
          reason: resolution.bypassReason,
        }, diagnosticFeatureKey);
        recordProtectionFeatureEvent(diagnosticFeatureKey, 'click_bypassed', {
          reason: resolution.bypassReason,
        });
      }
      if (!target) return;

      if (ensoGateEnabled) {
        const ensoGateReadiness = getEnsoGateReadiness(resolution);
        if (ensoGateReadiness.ready && startEnsoGate(target, e, resolution, ensoGateReadiness)) {
          consumeClickEvent(e);
          recordProtectionFeatureEvent('ensoGate', 'enso_gate_click_blocked', {
            tagName: target?.tagName || null,
            ensoGate: summarizeEnsoGateReadiness(ensoGateReadiness),
          });
          return;
        }
      }

      if (clickDelayEnabled) {
        consumeClickEvent(e);
        scheduleDelayedClick(target, e, resolution);
        return;
      }

      recordEnsoBoundary(resolution, 'native_click');
      recordProtectionFeatureEvent('ensoGate', 'reward_click_observed', {
          tagName: target?.tagName || null,
      });
    });
  },

  getInteractionListenerEntries(documentRef = getDocumentRef()) {
    return [
      { target: documentRef, type: 'pointerdown', handler: this.handlePressStart, options: true },
      { target: documentRef, type: 'pointermove', handler: this.handlePressMove, options: true },
      { target: documentRef, type: 'pointerup', handler: this.handlePressEnd, options: true },
      { target: documentRef, type: 'pointercancel', handler: this.handlePressCancel, options: true },
      { target: documentRef, type: 'mousedown', handler: this.handlePressStart, options: true },
      { target: documentRef, type: 'mousemove', handler: this.handlePressMove, options: true },
      { target: documentRef, type: 'mouseup', handler: this.handlePressEnd, options: true },
      { target: documentRef, type: 'click', handler: this.handleClick, options: true },
      { target: documentRef, type: 'keydown', handler: this.handleKeyDown, options: true },
      { target: documentRef, type: 'keyup', handler: this.handleKeyUp, options: true },
      { target: documentRef, type: 'visibilitychange', handler: this.handleVisibilityChange, options: true },
      { target: typeof window !== 'undefined' ? window : null, type: 'blur', handler: this.handleWindowBlur, options: true },
    ];
  },

  attachInteractionListeners(documentRef = getDocumentRef(), diagnosticFeatureKey = 'ensoGate') {
    const errors = [];
    for (const entry of this.getInteractionListenerEntries(documentRef)) {
      if (!entry.target || !entry.handler) continue;
      try {
        entry.target.addEventListener?.(entry.type, entry.handler, entry.options);
      } catch (error) {
        errors.push(error);
        reportClickIntentGateInteractionFailure(
          'listener_attach',
          error,
          { eventType: entry.type },
          diagnosticFeatureKey,
        );
        break;
      }
    }
    if (errors.length > 0) {
      throw createInteractionLifecycleError('INTERACTION_LISTENER_ATTACH_FAILED', errors);
    }
  },

  detachInteractionListeners(documentRef = getDocumentRef(), diagnosticFeatureKey = 'ensoGate') {
    const errors = [];
    for (const entry of this.getInteractionListenerEntries(documentRef)) {
      if (!entry.target || !entry.handler) continue;
      try {
        entry.target.removeEventListener?.(entry.type, entry.handler, entry.options);
      } catch (error) {
        errors.push(error);
        reportClickIntentGateInteractionFailure(
          'listener_detach',
          error,
          { eventType: entry.type },
          diagnosticFeatureKey,
        );
      }
    }
    if (errors.length > 0) {
      throw createInteractionLifecycleError('INTERACTION_LISTENER_DETACH_FAILED', errors);
    }
  },

  applyClickDelay(value, config = {}) {
    const distribution = resolveClickDelayDistribution(value, config);
    const previousState = {
      clickDelayMs: state.clickDelayMs,
      clickDelayDistribution: state.clickDelayDistribution,
    };
    const hadListenerLease = state.interactionListenerOwners.has(CLICK_DELAY_LISTENER_OWNER);

    try {
      if (!hadListenerLease) {
        this.acquireInteractionListenerLease(CLICK_DELAY_LISTENER_OWNER);
      }
      state.clickDelayMs = distribution.meanMs;
      state.clickDelayDistribution = distribution;
      setRootAttribute(ROOT_STATE_ATTRS.CLICK_DELAY, 'active');
      recordProtectionFeatureEvent('clickDelay', 'delay_distribution_applied', distribution);
    } catch (error) {
      reportClickIntentGateInteractionFailure('manager_apply', error, {
        meanMs: distribution.meanMs,
        level: distribution.level,
      }, 'clickDelay');
      state.clickDelayMs = previousState.clickDelayMs;
      state.clickDelayDistribution = previousState.clickDelayDistribution;
      const cleanupErrors = [];
      try {
        setRootAttribute(
          ROOT_STATE_ATTRS.CLICK_DELAY,
          previousState.clickDelayMs > 0 ? 'active' : 'none',
        );
      } catch (cleanupError) {
        cleanupErrors.push(cleanupError);
      }
      if (!hadListenerLease) {
        try {
          this.releaseInteractionListenerLease(CLICK_DELAY_LISTENER_OWNER);
        } catch (cleanupError) {
          cleanupErrors.push(cleanupError);
        }
      }
      if (cleanupErrors.length > 0 && error && typeof error === 'object') {
        error.cleanupErrors = cleanupErrors;
      }
      throw error;
    }
  },

  removeClickDelay() {
    const hadListenerLease = state.interactionListenerOwners.has(CLICK_DELAY_LISTENER_OWNER);
    try {
      setRootAttribute(ROOT_STATE_ATTRS.CLICK_DELAY, 'none');
      this.releaseInteractionListenerLease(CLICK_DELAY_LISTENER_OWNER);
      clearPendingClick();
      state.clickDelayMs = 0;
      state.clickDelayDistribution = resolveClickDelayDistribution(0);
    } catch (error) {
      const rollbackErrors = [];
      if (hadListenerLease && !state.interactionListenerOwners.has(CLICK_DELAY_LISTENER_OWNER)) {
        try {
          this.acquireInteractionListenerLease(CLICK_DELAY_LISTENER_OWNER);
        } catch (rollbackError) {
          rollbackErrors.push(...(rollbackError?.errors || [rollbackError]));
        }
      }
      if (state.clickDelayMs > 0) {
        try {
          setRootAttribute(ROOT_STATE_ATTRS.CLICK_DELAY, 'active');
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError);
        }
      }
      const removeError = createInteractionLifecycleError(
        'CLICK_DELAY_MANAGER_REMOVE_FAILED',
        [...(error?.errors || [error]), ...rollbackErrors],
      );
      reportClickIntentGateInteractionFailure('manager_remove', removeError, {}, 'clickDelay');
      throw removeError;
    }
  },

  applyEnsoGate(value, config = {}, protectionContext) {
    const enabled = value === true;
    if (!enabled) {
      this.removeEnsoGate();
      return;
    }
    const previousState = {
      enabled: state.ensoGateEnabled,
      config: state.ensoGateConfig,
    };
    const hadListenerLease = state.interactionListenerOwners.has(ENSO_GATE_LISTENER_OWNER);
    try {
      if (!hadListenerLease) {
        this.acquireInteractionListenerLease(ENSO_GATE_LISTENER_OWNER);
      }
      state.ensoGateEnabled = true;
      state.ensoGateConfig = config && typeof config === 'object' ? { ...config } : null;
      syncEnsoSpawnPolicyFromEnsoGateState(Date.now(), protectionContext);
      setRootAttribute(ROOT_STATE_ATTRS.ENSO_GATE, 'active');
      recordProtectionFeatureEvent('ensoGate', 'enso_gate_applied');
    } catch (error) {
      state.ensoGateEnabled = previousState.enabled;
      state.ensoGateConfig = previousState.config;
      const cleanupErrors = [];
      try {
        syncEnsoSpawnPolicyFromEnsoGateState();
      } catch (cleanupError) {
        cleanupErrors.push(cleanupError);
      }
      try {
        setRootAttribute(
          ROOT_STATE_ATTRS.ENSO_GATE,
          previousState.enabled ? 'active' : 'none',
        );
      } catch (cleanupError) {
        cleanupErrors.push(cleanupError);
      }
      if (!hadListenerLease) {
        try {
          this.releaseInteractionListenerLease(ENSO_GATE_LISTENER_OWNER);
        } catch (cleanupError) {
          cleanupErrors.push(cleanupError);
        }
      }
      if (cleanupErrors.length > 0 && error && typeof error === 'object') {
        error.cleanupErrors = cleanupErrors;
      }
      reportClickIntentGateInteractionFailure('manager_apply', error, {}, 'ensoGate');
      throw error;
    }
  },

  removeEnsoGate() {
    const hadListenerLease = state.interactionListenerOwners.has(ENSO_GATE_LISTENER_OWNER);
    try {
      setRootAttribute(ROOT_STATE_ATTRS.ENSO_GATE, 'none');
      this.releaseInteractionListenerLease(ENSO_GATE_LISTENER_OWNER);
      if (state.ensoGate?.source === 'click_intent') {
        clearEnsoGate({
          restore: true,
          outcome: ENSO_GATE_OUTCOMES.NEUTRAL,
          outcomeDetails: { reason: 'enso_gate_disabled' },
        });
      }
      clearSuppressedEnsoClick();
      ensoSpawnPolicy.deactivate(ENSO_SPAWN_SOURCES.CLICK_INTENT);
      state.ensoGateEnabled = false;
      state.ensoGateConfig = null;
    } catch (error) {
      const rollbackErrors = [];
      if (hadListenerLease && !state.interactionListenerOwners.has(ENSO_GATE_LISTENER_OWNER)) {
        try {
          this.acquireInteractionListenerLease(ENSO_GATE_LISTENER_OWNER);
        } catch (rollbackError) {
          rollbackErrors.push(...(rollbackError?.errors || [rollbackError]));
        }
      }
      if (state.ensoGateEnabled) {
        try {
          syncEnsoSpawnPolicyFromEnsoGateState();
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError);
        }
        try {
          setRootAttribute(ROOT_STATE_ATTRS.ENSO_GATE, 'active');
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError);
        }
      }
      const removeError = createInteractionLifecycleError(
        'ENSO_GATE_MANAGER_REMOVE_FAILED',
        [...(error?.errors || [error]), ...rollbackErrors],
      );
      reportClickIntentGateInteractionFailure('manager_remove', removeError, {}, 'ensoGate');
      throw removeError;
    }
  },

  applyScroll(value) {
    let delay = 0;
    let shouldDelay = false;
    const previousDelay = state.scrollDelayTime;
    const previousActive = state.scrollActive;
    const previousRootState = getDocumentRef()?.documentElement
      ?.getAttribute(ROOT_STATE_ATTRS.SCROLL) || 'none';
    let delayConfigApplied = false;

    try {
      delay = normalizeScrollFrictionDelayMs(value);
      shouldDelay = delay > 0;
      scrollInputOrchestrator.setDelayConfig({ enabled: shouldDelay, delayMs: delay });
      delayConfigApplied = true;
      setRootAttribute(ROOT_STATE_ATTRS.SCROLL, shouldDelay ? 'active' : 'none');
      state.scrollActive = true;
    } catch (error) {
      if (delayConfigApplied) {
        try {
          scrollInputOrchestrator.setDelayConfig({
            enabled: previousActive && previousDelay > 0,
            delayMs: previousDelay,
          });
          setRootAttribute(ROOT_STATE_ATTRS.SCROLL, previousRootState);
        } catch (rollbackError) {
          if (error && typeof error === 'object') error.rollbackError = rollbackError;
        }
      }
      reportScrollFrictionManagerFailure('manager_apply', error, {
        delayMs: delay,
        shouldDelay,
        rawValueType: typeof value,
      });
      state.scrollDelayTime = previousDelay;
      state.scrollActive = previousActive;
      throw error;
    }

    state.scrollDelayTime = delay;
    recordProtectionFeatureEvent('scrollFriction', 'manager_apply', {
      delayMs: delay,
      shouldDelay,
    });
  },

  removeScroll() {
    if (!state.scrollActive) return;
    const errors = [];
    const previousDelay = state.scrollDelayTime;
    try {
      scrollInputOrchestrator.setDelayConfig({ enabled: false, delayMs: 0 });
      setRootAttribute(ROOT_STATE_ATTRS.SCROLL, 'none');
    } catch (error) {
      errors.push(error);
      reportScrollFrictionManagerFailure('manager_remove_delay_config', error);
      try {
        scrollInputOrchestrator.setDelayConfig({
          enabled: previousDelay > 0,
          delayMs: previousDelay,
        });
        setRootAttribute(ROOT_STATE_ATTRS.SCROLL, 'active');
      } catch (rollbackError) {
        errors.push(rollbackError);
        reportScrollFrictionManagerFailure('manager_remove_rollback', rollbackError);
      }
    }
    if (errors.length > 0) {
      throw createInteractionLifecycleError('SCROLL_FRICTION_MANAGER_REMOVE_FAILED', errors);
    }
    state.scrollDelayTime = 0;
    recordProtectionFeatureEvent('scrollFriction', 'manager_remove');
    state.scrollActive = false;
  },
};

export default InteractionManager;
