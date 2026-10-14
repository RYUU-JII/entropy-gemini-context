import { NUDGE_WORKER_MESSAGE } from './NudgeProtocol.js';
import {
  GLOBAL_SENTINEL_ENTRY_FEEDBACK_MS,
  GLOBAL_SENTINEL_ENTRY_RUPTURE_REVEAL_MS,
  createGlobalSentinelRuptureReveal,
  normalizeGlobalSentinelEntryPoint,
  resolveGlobalSentinelEntryRevealProgress,
  resolveGlobalSentinelRuptureRevealPresentation,
} from './GlobalSentinelEntryController.js';
import {
  applyGlobalRuptureRevealDom,
  applyGlobalStarterFeedbackDom,
  clearGlobalStarterFeedbackDom,
} from './SentinelProtocolPresentationAdapter.js';
import { SENTINEL_PROTOCOL_TIMER_KEYS } from './SentinelProtocolTimerController.js';

export const GLOBAL_SENTINEL_HOVER_FEEDBACK_INTERVAL_MS = 240;
export const GLOBAL_SENTINEL_HOVER_FEEDBACK_MIN_DISTANCE_PX = 12;

export function createSentinelProtocolGlobalEntryRuntime({
  timers,
  getBounds = () => ({ width: 0, height: 0 }),
  getRoot = () => null,
  getScene = () => null,
  isAwaitingStart = () => false,
  isWorkerRuntimeActive = () => false,
  postWorkerMessage = () => false,
  pulseMainRuntimeFeedback = () => false,
  updateRitualPresentation = () => {},
  getReducedMotion = () => false,
  windowRef = globalThis.window,
} = {}) {
  let ruptureReveal = null;
  let entryPoint = null;
  let lastHoverFeedbackAtMs = 0;
  let lastHoverFeedbackPoint = null;

  function normalizePoint(point = null) {
    return normalizeGlobalSentinelEntryPoint(point, getBounds(), { windowRef });
  }

  function clearFeedbackTimer() {
    timers.clearTimeout(SENTINEL_PROTOCOL_TIMER_KEYS.GLOBAL_STARTER_FEEDBACK);
  }

  function clearRuptureRevealTimer() {
    timers.clearTimeout(SENTINEL_PROTOCOL_TIMER_KEYS.GLOBAL_RUPTURE_REVEAL);
  }

  function applyFeedbackPresentation(point = null) {
    const normalizedPoint = normalizePoint(point) || { xRatio: 0.5, yRatio: 0.48 };
    applyGlobalStarterFeedbackDom({
      root: getRoot(),
      scene: getScene(),
      point: normalizedPoint,
    });
    clearFeedbackTimer();
    timers.scheduleTimeout(SENTINEL_PROTOCOL_TIMER_KEYS.GLOBAL_STARTER_FEEDBACK, () => {
      clearGlobalStarterFeedbackDom(getScene());
    }, GLOBAL_SENTINEL_ENTRY_FEEDBACK_MS);
  }

  function pulseFeedback({
    point = null,
    eventType = 'blocked_input',
  } = {}) {
    if (!isAwaitingStart()) return false;
    const normalizedPoint = normalizePoint(point);
    applyFeedbackPresentation(normalizedPoint);
    const payload = {
      x: normalizedPoint?.x,
      y: normalizedPoint?.y,
      eventType,
    };
    if (isWorkerRuntimeActive()) {
      postWorkerMessage(NUDGE_WORKER_MESSAGE.GLOBAL_STARTER_FEEDBACK, payload);
    } else {
      pulseMainRuntimeFeedback(payload);
    }
    return true;
  }

  function pulseHoverFeedback(point = null, now = Date.now()) {
    if (!isAwaitingStart()) return false;
    const normalizedPoint = normalizePoint(point);
    if (!normalizedPoint) return false;
    const elapsedMs = Math.max(0, Number(now) - lastHoverFeedbackAtMs);
    const distancePx = lastHoverFeedbackPoint
      ? Math.hypot(
        normalizedPoint.x - lastHoverFeedbackPoint.x,
        normalizedPoint.y - lastHoverFeedbackPoint.y,
      )
      : Number.POSITIVE_INFINITY;
    if (
      lastHoverFeedbackAtMs > 0
      && (
        elapsedMs < GLOBAL_SENTINEL_HOVER_FEEDBACK_INTERVAL_MS
        || distancePx < GLOBAL_SENTINEL_HOVER_FEEDBACK_MIN_DISTANCE_PX
      )
    ) {
      return false;
    }
    lastHoverFeedbackAtMs = Number(now) || Date.now();
    lastHoverFeedbackPoint = {
      x: normalizedPoint.x,
      y: normalizedPoint.y,
    };
    return pulseFeedback({
      point: normalizedPoint,
      eventType: 'starter_hover',
    });
  }

  function startRuptureReveal(point = null, now = Date.now()) {
    const normalizedPoint = normalizePoint(point) || { xRatio: 0.5, yRatio: 0.48 };
    entryPoint = Object.freeze({
      xRatio: normalizedPoint.xRatio,
      yRatio: normalizedPoint.yRatio,
    });
    clearFeedbackTimer();
    clearGlobalStarterFeedbackDom(getScene());
    ruptureReveal = createGlobalSentinelRuptureReveal({
      point: normalizedPoint,
      bounds: getBounds(),
      now,
      windowRef,
    });
    clearRuptureRevealTimer();
    timers.scheduleTimeout(SENTINEL_PROTOCOL_TIMER_KEYS.GLOBAL_RUPTURE_REVEAL, () => {
      ruptureReveal = null;
      updateRitualPresentation();
    }, GLOBAL_SENTINEL_ENTRY_RUPTURE_REVEAL_MS);
  }

  function applyRuptureRevealPresentation(now = Date.now()) {
    const presentation = resolveGlobalSentinelRuptureRevealPresentation(ruptureReveal, { now });
    applyGlobalRuptureRevealDom({
      root: getRoot(),
      scene: getScene(),
      reveal: ruptureReveal,
      presentation,
      reducedMotion: getReducedMotion(),
    });
    return presentation.active;
  }

  function reset() {
    clearFeedbackTimer();
    clearRuptureRevealTimer();
    clearGlobalStarterFeedbackDom(getScene());
    ruptureReveal = null;
    entryPoint = null;
    lastHoverFeedbackAtMs = 0;
    lastHoverFeedbackPoint = null;
    applyGlobalRuptureRevealDom({ scene: getScene(), presentation: { active: false } });
  }

  return {
    normalizePoint,
    pulseFeedback,
    pulseHoverFeedback,
    startRuptureReveal,
    applyRuptureRevealPresentation,
    getEntryPoint: () => entryPoint,
    getRevealProgress: () => resolveGlobalSentinelEntryRevealProgress(ruptureReveal),
    getRevealPresentation: () => resolveGlobalSentinelRuptureRevealPresentation(ruptureReveal),
    reset,
  };
}
