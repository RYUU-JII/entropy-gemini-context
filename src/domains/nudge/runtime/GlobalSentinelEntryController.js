import {
  GLOBAL_SENTINEL_AWAITING_START_INPUT_EVENTS,
} from './nudgeGlobalSentinelInputGate.js';
import {
  GLOBAL_SENTINEL_ENTRY_RUPTURE_REVEAL_MS,
  resolveGlobalSentinelEntryRuptureTimeline,
} from '../nudge/nudgeGameGlobalSentinelProtocol.js';

export { GLOBAL_SENTINEL_ENTRY_RUPTURE_REVEAL_MS };

export const GLOBAL_SENTINEL_ENTRY_FEEDBACK_MS = 760;
export const GLOBAL_SENTINEL_ENTRY_DEFAULT_POINT = Object.freeze({
  xRatio: 0.5,
  yRatio: 0.48,
});
export const GLOBAL_SENTINEL_ENTRY_FEEDBACK_INPUT_EVENTS = Object.freeze([
  ...GLOBAL_SENTINEL_AWAITING_START_INPUT_EVENTS,
]);

function clampUnit(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(1, numeric));
}

export function shouldHandleGlobalSentinelEntryFeedbackEvent(eventType = '') {
  return GLOBAL_SENTINEL_ENTRY_FEEDBACK_INPUT_EVENTS.includes(eventType || '');
}

export function normalizeGlobalSentinelEntryPoint(point = null, bounds = null, {
  windowRef = globalThis?.window,
} = {}) {
  const x = Number(point?.x);
  const y = Number(point?.y);
  const width = Math.max(1, Number(bounds?.width) || Number(windowRef?.innerWidth) || 1);
  const height = Math.max(1, Number(bounds?.height) || Number(windowRef?.innerHeight) || 1);
  const hasExplicitXRatio = point?.xRatio !== null && point?.xRatio !== undefined;
  const hasExplicitYRatio = point?.yRatio !== null && point?.yRatio !== undefined;
  if (hasExplicitXRatio || hasExplicitYRatio) {
    const xRatio = Number(point?.xRatio);
    const yRatio = Number(point?.yRatio);
    if (!Number.isFinite(xRatio) || !Number.isFinite(yRatio)) return null;
    const normalizedXRatio = clampUnit(xRatio);
    const normalizedYRatio = clampUnit(yRatio);
    return {
      x: normalizedXRatio * width,
      y: normalizedYRatio * height,
      xRatio: normalizedXRatio,
      yRatio: normalizedYRatio,
    };
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return {
    x,
    y,
    xRatio: clampUnit(x / width),
    yRatio: clampUnit(y / height),
  };
}

export function createGlobalSentinelRuptureReveal({
  point = null,
  bounds = null,
  now = Date.now(),
  windowRef = globalThis?.window,
} = {}) {
  const normalizedPoint = normalizeGlobalSentinelEntryPoint(point, bounds, { windowRef })
    || GLOBAL_SENTINEL_ENTRY_DEFAULT_POINT;
  return {
    startedAtMs: now,
    xRatio: normalizedPoint.xRatio,
    yRatio: normalizedPoint.yRatio,
  };
}

export function resolveGlobalSentinelEntryRevealProgress(reveal = null, {
  now = Date.now(),
  durationMs = GLOBAL_SENTINEL_ENTRY_RUPTURE_REVEAL_MS,
} = {}) {
  if (!reveal) return 0;
  const duration = Math.max(1, Number(durationMs) || GLOBAL_SENTINEL_ENTRY_RUPTURE_REVEAL_MS);
  return clampUnit((now - Number(reveal.startedAtMs || 0)) / duration);
}

export function resolveGlobalSentinelRuptureRevealPresentation(reveal = null, {
  now = Date.now(),
  durationMs = GLOBAL_SENTINEL_ENTRY_RUPTURE_REVEAL_MS,
} = {}) {
  if (!reveal) {
    return {
      active: false,
      progress: 1,
      timeline: resolveGlobalSentinelEntryRuptureTimeline(1),
      xPercent: null,
      yPercent: null,
    };
  }
  const duration = Math.max(1, Number(durationMs) || GLOBAL_SENTINEL_ENTRY_RUPTURE_REVEAL_MS);
  const ageMs = Math.max(0, now - Number(reveal.startedAtMs || 0));
  const progress = clampUnit(ageMs / duration);
  const timeline = resolveGlobalSentinelEntryRuptureTimeline(progress);
  return {
    active: ageMs < duration,
    progress,
    timeline,
    xPercent: clampUnit(reveal.xRatio) * 100,
    yPercent: clampUnit(reveal.yRatio) * 100,
  };
}
