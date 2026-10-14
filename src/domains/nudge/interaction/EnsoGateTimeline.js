export const ENSO_GATE_ZONES = Object.freeze({
  GUARD: 'guard',
  IMPULSE: 'impulse',
  WAKE: 'wake',
  RELEASE: 'release',
});

export const ENSO_GATE_RELEASE_ACTIONS = Object.freeze({
  NEUTRAL: 'neutral',
  ENTER: 'enter',
  LEAVE: 'leave',
});

const ENSO_GATE_TIMING = Object.freeze({
  guardMs: 660,
  impulseMs: 1220,
  wakeMs: 2320,
  releaseMs: 460,
  wakePresentationMs: 1320,
});

const MIN_WAKE_PRESENTATION_MS = 900;
const ENSO_GATE_MOTION_EASE_WEIGHT = 0.14;

const ENSO_GATE_VISUAL_STOPS = Object.freeze({
  guard: 0.14,
  impulse: 0.48,
  wake: 0.88,
  release: 1,
});

export function clampNumber(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.min(max, Math.max(min, numeric));
}

function readDurationMs(source, key, fallback, min = 0) {
  const raw = source && typeof source === 'object' ? source[key] : undefined;
  if (!Number.isFinite(Number(raw))) return fallback;
  return Math.max(min, Math.round(Number(raw)));
}

function lerp(start, end, t) {
  return start + ((end - start) * clampNumber(t, 0, 1));
}

function smoothstep(edge0, edge1, value) {
  const span = Math.max(0.001, edge1 - edge0);
  const x = clampNumber((value - edge0) / span, 0, 1);
  return x * x * (3 - (2 * x));
}

function ensoGateMotionCurve(t) {
  const x = clampNumber(t, 0, 1);
  const gentleEase = x * x * (3 - (2 * x));
  return lerp(x, gentleEase, ENSO_GATE_MOTION_EASE_WEIGHT);
}

function normalizeVisualRoute(route = ENSO_GATE_VISUAL_STOPS) {
  const guard = clampNumber(route.guard ?? ENSO_GATE_VISUAL_STOPS.guard, 0.04, 0.32);
  const impulse = clampNumber(route.impulse ?? ENSO_GATE_VISUAL_STOPS.impulse, guard + 0.08, 0.68);
  const wake = clampNumber(route.wake ?? ENSO_GATE_VISUAL_STOPS.wake, impulse + 0.08, 0.96);
  return {
    guard,
    impulse,
    wake,
    release: 1,
  };
}

export function resolveEnsoGateConfig(source = {}) {
  const guardMs = readDurationMs(
    source,
    'guardMs',
    ENSO_GATE_TIMING.guardMs,
    180,
  );
  const impulseMs = readDurationMs(
    source,
    'impulseMs',
    ENSO_GATE_TIMING.impulseMs,
    160,
  );
  const wakeMs = readDurationMs(
    source,
    'wakeMs',
    ENSO_GATE_TIMING.wakeMs,
    180,
  );
  const releaseMs = readDurationMs(
    source,
    'releaseMs',
    ENSO_GATE_TIMING.releaseMs,
    120,
  );
  const wakePresentationMs = readDurationMs(
    source,
    'wakePresentationMs',
    ENSO_GATE_TIMING.wakePresentationMs,
    MIN_WAKE_PRESENTATION_MS,
  );
  const guardEndMs = guardMs;
  const impulseEndMs = guardEndMs + impulseMs;
  const wakeEndMs = impulseEndMs + wakeMs;
  const totalMs = wakeEndMs + releaseMs;
  return {
    enabled: source?.enabled !== false,
    mode: 'interval',
    guardMs,
    impulseMs,
    wakeMs,
    releaseMs,
    guardEndMs,
    impulseEndMs,
    wakeEndMs,
    totalMs,
    wakePresentationMs,
    visualStops: ENSO_GATE_VISUAL_STOPS,
  };
}

export function getEnsoGateZone(elapsedMs, config) {
  const elapsed = Math.max(0, Number(elapsedMs) || 0);
  if (elapsed < config.guardEndMs) return ENSO_GATE_ZONES.GUARD;
  if (elapsed < config.impulseEndMs) return ENSO_GATE_ZONES.IMPULSE;
  if (elapsed < config.wakeEndMs) return ENSO_GATE_ZONES.WAKE;
  return ENSO_GATE_ZONES.RELEASE;
}

export function getEnsoGateVisualProgress(elapsedMs, config) {
  const elapsed = Math.max(0, Number(elapsedMs) || 0);
  const totalMs = Math.max(1, Number(config?.totalMs) || 1);
  return ensoGateMotionCurve(elapsed / totalMs);
}

export function getEnsoGateVisualTones(progressOrFrame, config = {}) {
  const rawProgress = typeof progressOrFrame === 'object' && progressOrFrame !== null
    ? progressOrFrame.progress
    : progressOrFrame;
  const progress = clampNumber(rawProgress, 0, 1);
  const route = normalizeVisualRoute(config.visualStops || ENSO_GATE_VISUAL_STOPS);

  const impulseRise = smoothstep(route.guard * 0.72, route.impulse, progress);
  const wakeRise = smoothstep(route.impulse * 0.86, route.wake, progress);
  const release = smoothstep(route.wake, route.release, progress);

  return {
    guard: clampNumber(1 - smoothstep(0, route.guard, progress), 0, 1),
    impulse: clampNumber(impulseRise * (1 - (wakeRise * 0.82)), 0, 1),
    wake: clampNumber(wakeRise, 0, 1),
    release: clampNumber(release, 0, 1),
  };
}

export function getEnsoGateFrame(elapsedMs, config) {
  const elapsed = Math.max(0, Number(elapsedMs) || 0);
  const progress = clampNumber(getEnsoGateVisualProgress(elapsed, config), 0, 1);
  return {
    elapsedMs: elapsed,
    zone: getEnsoGateZone(elapsed, config),
    progress,
    tones: getEnsoGateVisualTones(progress, config),
    autoRelease: elapsed >= config.totalMs,
    route: normalizeVisualRoute(config.visualStops || ENSO_GATE_VISUAL_STOPS),
  };
}

export function getEnsoGateReleaseDecision(zone, { explicitRelease = true } = {}) {
  if (zone === ENSO_GATE_ZONES.RELEASE) {
    if (explicitRelease) {
      return { action: ENSO_GATE_RELEASE_ACTIONS.LEAVE, reason: 'release-band' };
    }
    return { action: ENSO_GATE_RELEASE_ACTIONS.NEUTRAL, reason: 'release-awaiting-gesture' };
  }
  if (zone === ENSO_GATE_ZONES.IMPULSE || zone === ENSO_GATE_ZONES.WAKE) {
    return { action: ENSO_GATE_RELEASE_ACTIONS.ENTER, reason: `${zone}-release` };
  }
  return { action: ENSO_GATE_RELEASE_ACTIONS.NEUTRAL, reason: 'guard-release' };
}
