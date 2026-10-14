// The ensoGate wire key is stable; its Barrier interaction is a single lateral choice.
export const ENSO_GATE_PHASES = Object.freeze({ ARMED: 'armed', DRAWING: 'drawing', SEALED: 'sealed', ENTER_READY: 'enter-ready', VOID: 'void' });
export const ENSO_GATE_OUTCOMES = Object.freeze({ NEUTRAL: 'neutral', ENTER: 'enter', LEAVE: 'leave' });
export const ENSO_GATE_GESTURE_DECISIONS = Object.freeze({ RETRY: 'retry' });
const CONFIG = Object.freeze({ travelPx: 112, minimumGestureMs: 420, startWellPx: 44, maxGestureMs: 12000 });
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));

export function resolveEnsoGateGestureConfig(source = {}) {
  const config = { ...CONFIG };
  for (const key of Object.keys(CONFIG)) {
    if (Object.hasOwn(source, key)) {
      if (!Number.isFinite(source[key]) || source[key] <= 0) throw new Error('BARRIER_GESTURE_CONFIG_INVALID:' + key);
      config[key] = source[key];
    }
  }
  return Object.freeze(config);
}

export function createEnsoGateArmedFrame({ config = CONFIG, viewportWidth = globalThis.innerWidth, viewportHeight = globalThis.innerHeight } = {}) {
  if (![viewportWidth, viewportHeight].every(value => Number.isFinite(value) && value > 0)) {
    throw new Error('BARRIER_GESTURE_VIEWPORT_INVALID');
  }
  const width = viewportWidth;
  const height = viewportHeight;
  const center = { x: width / 2, y: height / 2 };
  const resolved = resolveEnsoGateGestureConfig(config);
  return { phase: ENSO_GATE_PHASES.ARMED, center, start: center, point: center, rawPoint: center, radius: Math.min(resolved.travelPx, width * 0.3), originSnapPx: resolved.startWellPx, progress: 0, sealProgress: 0, direction: 0, signedProgress: 0, ready: false, autoCancel: false };
}

export function isPointInEnsoGateStartWell(frame, point, multiplier = 1) {
  return Boolean(frame && point && Math.hypot(point.x - frame.start.x, point.y - frame.start.y) <= frame.originSnapPx * multiplier);
}

export function createEnsoGateGesture({ x, y, now = Date.now(), config = CONFIG, viewportWidth, viewportHeight, pointerId = null } = {}) {
  if (![x, y, now].every(Number.isFinite)) throw new Error('BARRIER_GESTURE_POINT_INVALID');
  const layout = createEnsoGateArmedFrame({ config, viewportWidth, viewportHeight });
  return { config: resolveEnsoGateGestureConfig(config), layout, pointerId, start: { x, y }, raw: { x, y }, startedAt: now, lastPhysicsAt: now, phase: ENSO_GATE_PHASES.DRAWING, entryCandidateAt: null, entryReadyAt: null, sealedAt: null };
}

export function updateEnsoGateGesture(gesture, input = {}) {
  if (!gesture) return null;
  const now = input.now === undefined ? Date.now() : input.now;
  if (!Number.isFinite(now)) throw new Error('BARRIER_GESTURE_TIME_INVALID');
  if (input.x !== undefined || input.y !== undefined) {
    if (![input.x, input.y].every(Number.isFinite)) throw new Error('BARRIER_GESTURE_POINT_INVALID');
    gesture.raw = { x: input.x, y: input.y };
  }
  gesture.lastPhysicsAt = Math.max(gesture.lastPhysicsAt, now);
  return getEnsoGateGestureFrame(gesture, now);
}

export function getEnsoGateGestureFrame(gesture, now = Date.now()) {
  if (!gesture) return null;
  const dx = gesture.raw.x - gesture.start.x;
  const dy = gesture.raw.y - gesture.start.y;
  const travel = gesture.layout.radius;
  const signedProgress = clamp(dx / travel, -1, 1);
  const elapsed = Math.max(0, now - gesture.startedAt);
  const lateral = Math.abs(dx) >= travel && Math.abs(dy) <= travel;
  const ready = lateral && elapsed >= gesture.config.minimumGestureMs;
  const autoCancel = elapsed >= gesture.config.maxGestureMs;
  gesture.entryCandidateAt = lateral ? gesture.startedAt : null;
  gesture.entryReadyAt = ready ? now : null;
  gesture.phase = autoCancel ? ENSO_GATE_PHASES.VOID : ready ? (dx > 0 ? ENSO_GATE_PHASES.ENTER_READY : ENSO_GATE_PHASES.SEALED) : ENSO_GATE_PHASES.DRAWING;
  return { ...gesture.layout, phase: gesture.phase, point: { x: gesture.layout.center.x + signedProgress * travel, y: gesture.layout.center.y }, rawPoint: gesture.raw, progress: Math.abs(signedProgress), signedProgress, direction: Math.sign(dx), sealProgress: Math.abs(signedProgress), entryProgress: clamp(elapsed / gesture.config.minimumGestureMs, 0, 1), sealed: ready && dx < 0, ready, autoCancel };
}

export function finishEnsoGateGesture(gesture, { canceled = false, now = Date.now() } = {}) {
  const frame = getEnsoGateGestureFrame(gesture, now);
  if (!gesture || canceled || frame.autoCancel) return { action: ENSO_GATE_OUTCOMES.NEUTRAL, reason: canceled ? 'cancel' : 'timeout', frame };
  if (!frame.ready) return { action: ENSO_GATE_GESTURE_DECISIONS.RETRY, reason: 'boundary-not-crossed', frame };
  return { action: frame.direction > 0 ? ENSO_GATE_OUTCOMES.ENTER : ENSO_GATE_OUTCOMES.LEAVE, reason: frame.direction > 0 ? 'boundary-opened' : 'consumption-ended', frame };
}
