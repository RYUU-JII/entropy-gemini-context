import { INK_BRUSH_PROFILE } from './inkBrushProfile.js';

export const INK_BRUSH_PHASES = Object.freeze({
  IDLE: 'idle',
  DRAWING: 'drawing',
  HOVERING: 'hovering',
  DRYING: 'drying',
});

function clamp(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.min(max, Math.max(min, numeric));
}

function smoothstep(edge0, edge1, value) {
  const span = Math.max(0.0001, edge1 - edge0);
  const t = clamp((value - edge0) / span, 0, 1);
  return t * t * (3 - (2 * t));
}

function distanceBetween(a, b) {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  return Math.hypot((Number(b.x) || 0) - (Number(a.x) || 0), (Number(b.y) || 0) - (Number(a.y) || 0));
}

function isImmediateInputType(inputType) {
  const normalized = String(inputType || '').toLowerCase();
  return normalized.includes('delete') || normalized.includes('history');
}

function isLineBreakInputType(inputType) {
  const normalized = String(inputType || '').toLowerCase();
  return normalized.includes('linebreak') || normalized.includes('paragraph');
}

function resolvePointWidth(profile, pressure) {
  return profile.minWidthPx
    + ((profile.maxWidthPx - profile.minWidthPx) * clamp(pressure, 0, 1));
}

function createSample(point, {
  at,
  wetAt = at,
  width,
  sequence,
  s = 0,
}) {
  return {
    x: Number(point?.x) || 0,
    y: Number(point?.y) || 0,
    at,
    wetAt,
    s: Math.max(0, Number(s) || 0),
    width,
    pressure: clamp(point?.pressure, 0, 1),
    sequence,
    direction: point?.direction === 'rtl' ? 'rtl' : 'ltr',
    glyphWidth: Math.max(1, Number(point?.glyphWidth) || 12),
    lineHeight: Math.max(1, Number(point?.lineHeight) || 20),
    caretSource: String(point?.caretSource || 'abstract'),
  };
}

function compactStrokePointBudget(stroke, maxPoints) {
  const budget = Math.max(8, Math.floor(Number(maxPoints) || 8));
  while (stroke.points.length > budget) {
    const points = stroke.points;
    const recentCount = Math.max(8, Math.floor(budget * 0.45));
    const compactEnd = Math.max(2, points.length - recentCount);
    const compacted = [points[0]];
    for (let index = 2; index < compactEnd; index += 2) {
      compacted.push(points[index]);
    }
    const boundaryPoint = points[compactEnd - 1];
    if (compacted[compacted.length - 1] !== boundaryPoint) compacted.push(boundaryPoint);
    compacted.push(...points.slice(compactEnd));
    if (compacted.length >= points.length) {
      compacted.splice(1, compacted.length - budget);
    }
    stroke.points = compacted;
  }
}

function appendInterpolatedSamples(session, stroke, fromPoint, toPoint, at) {
  const distance = distanceBetween(fromPoint, toPoint);
  if (!Number.isFinite(distance) || distance < 0.2) return;
  const spacing = Math.max(1.5, session.profile.sampleSpacingPx);
  const steps = Math.max(1, Math.ceil(distance / spacing));
  for (let index = 1; index <= steps; index += 1) {
    const progress = index / steps;
    const point = {
      x: fromPoint.x + ((toPoint.x - fromPoint.x) * progress),
      y: fromPoint.y + ((toPoint.y - fromPoint.y) * progress),
      pressure: fromPoint.pressure + ((toPoint.pressure - fromPoint.pressure) * progress),
      direction: toPoint.direction || fromPoint.direction,
      glyphWidth: toPoint.glyphWidth || fromPoint.glyphWidth,
      lineHeight: toPoint.lineHeight || fromPoint.lineHeight,
      caretSource: toPoint.caretSource || fromPoint.caretSource,
    };
    const previousSample = stroke.points[stroke.points.length - 1];
    const sampleDistance = distanceBetween(previousSample, point);
    if (!Number.isFinite(sampleDistance) || sampleDistance < 0.01) continue;
    const targetWidth = fromPoint.width + ((toPoint.width - fromPoint.width) * progress);
    const widthFollow = 1 - Math.exp(
      -sampleDistance / Math.max(1, session.profile.widthFollowPx),
    );
    const width = previousSample.width + ((targetWidth - previousSample.width) * widthFollow);
    session.nextPointSequence += 1;
    stroke.points.push(createSample(point, {
      at,
      wetAt: at,
      width,
      s: previousSample.s + sampleDistance,
      sequence: session.nextPointSequence,
    }));
  }
  compactStrokePointBudget(stroke, session.profile.maxPoints);
}

function refreshStrokeJoinWetness(stroke, now, profile) {
  const points = Array.isArray(stroke?.points) ? stroke.points : [];
  const lastPoint = points[points.length - 1];
  const lastS = Number(lastPoint?.s);
  const refreshPx = Math.max(1, Number(profile?.joinRefreshPx) || 1);
  if (!Number.isFinite(lastS)) return;

  for (let index = points.length - 1; index >= 0; index -= 1) {
    const point = points[index];
    const distanceFromJoin = Math.max(0, lastS - (Number(point.s) || 0));
    if (distanceFromJoin > refreshPx) break;
    const weight = smoothstep(0, 1, 1 - (distanceFromJoin / refreshPx));
    const previousWetAt = Number.isFinite(point.wetAt) ? point.wetAt : point.at;
    point.wetAt = Math.max(
      previousWetAt,
      previousWetAt + ((now - previousWetAt) * weight),
    );
  }
  stroke.lastRewetAt = now;
}

function getActiveStroke(session) {
  if (!session?.activeStrokeId) return null;
  return session.strokes.find((stroke) => stroke.id === session.activeStrokeId) || null;
}

function canContinueStroke(session, stroke, point, now, forceNewStroke, maxGapMs) {
  if (!stroke || forceNewStroke) return false;
  const previous = stroke.target || stroke.tip || stroke.points[stroke.points.length - 1];
  if (!previous) return false;
  const gapMs = now - stroke.lastInputAt;
  const resolvedMaxGapMs = Math.max(0, Number(maxGapMs) || session.profile.joinWindowMs);
  if (!Number.isFinite(gapMs) || gapMs < 0 || gapMs > resolvedMaxGapMs) return false;
  const lineHeight = Math.max(12, Number(point?.lineHeight) || Number(previous.lineHeight) || 20);
  if (Math.abs((Number(point?.y) || 0) - (Number(previous.y) || 0)) > lineHeight * 0.72) return false;
  const distance = distanceBetween(previous, point);
  if (!Number.isFinite(distance) || distance > session.profile.maxJoinPx) return false;
  const directionSign = point?.direction === 'rtl' ? -1 : 1;
  const glyphWidth = Math.max(8, Number(point?.glyphWidth) || 12);
  const forwardDistance = ((Number(point?.x) || 0) - (Number(previous.x) || 0)) * directionSign;
  return forwardDistance >= -glyphWidth * 0.75;
}

function findReviveCandidate(session, point, now, forceNewStroke) {
  if (forceNewStroke || !Array.isArray(session?.strokes) || session.strokes.length === 0) {
    return null;
  }
  const candidate = session.strokes[session.strokes.length - 1];
  if (!Number.isFinite(candidate?.liftedAt)) return null;
  return canContinueStroke(
    session,
    candidate,
    point,
    now,
    false,
    session.profile.reviveWindowMs,
  ) ? candidate : null;
}

function reactivateStroke(session, stroke) {
  stroke.liftedAt = null;
  stroke.phase = INK_BRUSH_PHASES.DRAWING;
  session.activeStrokeId = stroke.id;
  session.phase = INK_BRUSH_PHASES.DRAWING;
}

function pruneStrokeBudget(session) {
  while (session.strokes.length > session.profile.maxStrokes) {
    const removableIndex = session.strokes.findIndex((stroke) => stroke.id !== session.activeStrokeId);
    if (removableIndex < 0) break;
    session.strokes.splice(removableIndex, 1);
  }
}

function startStroke(session, point, now) {
  session.nextStrokeId += 1;
  session.nextPointSequence += 1;
  const width = resolvePointWidth(session.profile, session.pressure);
  const target = {
    ...point,
    x: Number(point?.x) || 0,
    y: Number(point?.y) || 0,
    pressure: session.pressure,
    width,
  };
  const stroke = {
    id: `ink-${session.nextStrokeId}`,
    phase: INK_BRUSH_PHASES.DRAWING,
    startedAt: now,
    lastInputAt: now,
    liftedAt: null,
    tip: { ...target },
    target,
    points: [createSample(target, {
      at: now,
      wetAt: now,
      width,
      s: 0,
      sequence: session.nextPointSequence,
    })],
  };
  session.strokes.push(stroke);
  session.activeStrokeId = stroke.id;
  session.phase = INK_BRUSH_PHASES.DRAWING;
  pruneStrokeBudget(session);
  return stroke;
}

export function createInkBrushSession({ reducedMotion = false, now = 0 } = {}) {
  return {
    profile: INK_BRUSH_PROFILE,
    reducedMotion: reducedMotion === true,
    phase: INK_BRUSH_PHASES.IDLE,
    strokes: [],
    activeStrokeId: null,
    lastInputAt: null,
    lastFrameAt: now,
    cadenceMs: null,
    pressure: 0,
    nextStrokeId: 0,
    nextPointSequence: 0,
    compositionActive: false,
    density: 0.30,
    streak: 0,
    freezeDryingUntil: 0,
    evaporateStartDensity: 0.30,
  };
}

export function liftInkBrushSession(session, now = Date.now()) {
  const stroke = getActiveStroke(session);
  if (!stroke) return false;
  if (stroke.target && stroke.tip && distanceBetween(stroke.tip, stroke.target) > 0.2) {
    appendInterpolatedSamples(session, stroke, stroke.tip, stroke.target, now);
    stroke.tip = { ...stroke.target };
  }
  stroke.phase = INK_BRUSH_PHASES.DRYING;
  stroke.liftedAt = now;
  stroke.target = null;
  session.activeStrokeId = null;
  session.phase = session.strokes.length > 0 ? INK_BRUSH_PHASES.DRYING : INK_BRUSH_PHASES.IDLE;
  return true;
}

export function setInkBrushCompositionActive(session, active, now = Date.now()) {
  if (!session) return false;
  const nextActive = active === true;
  session.compositionActive = nextActive;
  const stroke = getActiveStroke(session);
  if (!stroke) return nextActive;
  if (!nextActive) stroke.lastInputAt = now;
  return nextActive;
}

export function observeInkBrushInput(session, { now = Date.now(), inputType = null } = {}) {
  if (!session) return { admitPoint: false, forceNewStroke: false };
  if (isImmediateInputType(inputType)) {
    liftInkBrushSession(session, now);
    session.pressure = 0;
    session.lastInputAt = now;
    session.streak = 0;
    return { admitPoint: false, forceNewStroke: false, immediate: true };
  }

  const previousInputAt = session.lastInputAt;
  const gapMs = Number.isFinite(previousInputAt)
    ? Math.max(0, now - previousInputAt)
    : Number.POSITIVE_INFINITY;
  if (Number.isFinite(gapMs)) {
    session.cadenceMs = Number.isFinite(session.cadenceMs)
      ? (session.cadenceMs * 0.68) + (gapMs * 0.32)
      : gapMs;

    // Consecutive streak momentum
    if (gapMs < 420) {
      session.streak = (session.streak || 0) + 1;
    } else {
      session.streak = 1;
    }
  } else {
    session.streak = 1;
  }

  // Base + Velocity + Streak Accumulation Physics (No instant drop)
  let velocityImpulse = 0.012;
  if (Number.isFinite(gapMs) && gapMs <= 200) {
    const speedFactor = clamp((200 - gapMs) / 160, 0, 1);
    velocityImpulse = 0.03 + (0.16 * speedFactor * speedFactor);
  }
  const streakBonus = session.streak > 8
    ? Math.min(0.012 * (session.streak - 8), 0.20)
    : 0;

  const targetDensity = clamp(session.density + velocityImpulse + streakBonus, 0.30, 0.98);
  session.density = Math.max(session.density, targetDensity);

  // Freeze drying while actively typing; will start evaporative sedimentation after pause
  session.freezeDryingUntil = now + 450;
  session.evaporateStartDensity = session.density;

  const decay = Number.isFinite(gapMs)
    ? Math.exp(-gapMs / Math.max(1, session.profile.pressureDecayMs))
    : 0;
  const cadenceImpulse = Number.isFinite(gapMs)
    ? clamp((session.profile.pressureTargetGapMs - gapMs) / session.profile.pressureTargetGapMs, 0.12, 0.5)
    : 0.18;
  session.pressure = clamp((session.pressure * decay) + cadenceImpulse, 0, 1);
  session.lastInputAt = now;
  const forceNewStroke = isLineBreakInputType(inputType);
  if (forceNewStroke) liftInkBrushSession(session, now);
  return {
    admitPoint: true,
    forceNewStroke,
    immediate: false,
    pressure: session.pressure,
    cadenceMs: session.cadenceMs,
    density: session.density,
    streak: session.streak,
  };
}

export function commitInkBrushPoint(session, point, {
  now = Date.now(),
  forceNewStroke = false,
} = {}) {
  if (!session || !point) return null;
  let stroke = getActiveStroke(session);
  let shouldContinue = canContinueStroke(
    session,
    stroke,
    point,
    now,
    forceNewStroke,
    session.profile.joinWindowMs,
  );
  if (!shouldContinue && !stroke) {
    stroke = findReviveCandidate(session, point, now, forceNewStroke);
    if (stroke) {
      reactivateStroke(session, stroke);
      shouldContinue = true;
    }
  }
  if (!shouldContinue) {
    liftInkBrushSession(session, now);
    stroke = startStroke(session, point, now);
  } else {
    refreshStrokeJoinWetness(stroke, now, session.profile);
    const width = resolvePointWidth(session.profile, session.pressure);
    stroke.target = {
      ...point,
      x: Number(point.x) || 0,
      y: Number(point.y) || 0,
      pressure: session.pressure,
      width,
    };
    stroke.lastInputAt = now;
    stroke.phase = INK_BRUSH_PHASES.DRAWING;
    session.phase = INK_BRUSH_PHASES.DRAWING;
  }
  return stroke;
}

function advanceActiveTip(session, stroke, now) {
  if (!stroke?.target || !stroke.tip) return;
  const distance = distanceBetween(stroke.tip, stroke.target);
  if (!Number.isFinite(distance) || distance < 0.2) {
    stroke.tip = { ...stroke.target };
    return;
  }
  const elapsedMs = clamp(now - session.lastFrameAt, 1, 48);
  let progress = session.reducedMotion
    ? 1
    : 1 - Math.exp(-elapsedMs / Math.max(1, session.profile.tipFollowMs));
  const remainingAfterFollow = distance * (1 - progress);
  if (remainingAfterFollow > session.profile.maxTipLagPx) {
    progress = Math.max(progress, 1 - (session.profile.maxTipLagPx / distance));
  }
  const nextTip = {
    ...stroke.target,
    x: stroke.tip.x + ((stroke.target.x - stroke.tip.x) * progress),
    y: stroke.tip.y + ((stroke.target.y - stroke.tip.y) * progress),
    width: stroke.tip.width + ((stroke.target.width - stroke.tip.width) * progress),
    pressure: stroke.tip.pressure + ((stroke.target.pressure - stroke.tip.pressure) * progress),
  };
  appendInterpolatedSamples(session, stroke, stroke.tip, nextTip, now);
  stroke.tip = nextTip;
}

function resolveDryDuration(session) {
  return session.profile.dryDurationMs * (session.reducedMotion ? 0.65 : 1);
}

function resolveStrokeExpiresAt(stroke, session) {
  const points = Array.isArray(stroke?.points) ? stroke.points : [];
  const firstS = Number(points[0]?.s) || 0;
  const lastS = Number(points[points.length - 1]?.s) || firstS;
  const length = Math.max(1, lastS - firstS);
  const dryDurationMs = resolveDryDuration(session);
  let latestWetAt = Number(stroke?.liftedAt) || 0;
  const storedSampleExpiry = points.reduce((latest, point) => {
    const wetAt = Number.isFinite(point?.wetAt)
      ? point.wetAt
      : (Number(point?.at) || stroke.liftedAt || 0);
    latestWetAt = Math.max(latestWetAt, wetAt);
    const lengthProgress = clamp(((Number(point?.s) || firstS) - firstS) / length, 0, 1);
    const expiresAt = wetAt
      + session.profile.dryHoldMs
      + (session.profile.tailSweepMs * lengthProgress)
      + dryDurationMs;
    return Math.max(latest, expiresAt);
  }, Number(stroke?.liftedAt) || 0);
  const renderedHeadExpiry = latestWetAt
    + session.profile.dryHoldMs
    + session.profile.tailSweepMs
    + dryDurationMs;
  return Math.max(storedSampleExpiry, renderedHeadExpiry);
}

export function advanceInkBrushSession(session, now = Date.now()) {
  if (!session) return { live: false, phase: INK_BRUSH_PHASES.IDLE, strokes: [] };
  const activeStroke = getActiveStroke(session);
  if (activeStroke) {
    advanceActiveTip(session, activeStroke, now);
    const idleMs = now - session.lastInputAt;
    if (!session.compositionActive && idleMs >= session.profile.liftAfterMs) {
      liftInkBrushSession(session, now);
    } else if (distanceBetween(activeStroke.tip, activeStroke.target) < 0.5) {
      session.phase = INK_BRUSH_PHASES.HOVERING;
    } else {
      session.phase = INK_BRUSH_PHASES.DRAWING;
    }
  }

  session.strokes = session.strokes.filter((stroke) => {
    if (!Number.isFinite(stroke.liftedAt)) return true;
    return now < resolveStrokeExpiresAt(stroke, session);
  });
  if (session.strokes.length === 0) {
    session.phase = INK_BRUSH_PHASES.IDLE;
  } else if (!session.activeStrokeId) {
    session.phase = INK_BRUSH_PHASES.DRYING;
  }
  session.lastFrameAt = now;

  // Evaporative Sedimentation Physics after pause
  let effectiveDensity = session.density || 0.30;
  if (session.freezeDryingUntil && now >= session.freezeDryingUntil) {
    const dryElapsed = now - session.freezeDryingUntil;
    const totalDryMs = resolveDryDuration(session) + session.profile.dryHoldMs;
    const dryProgress = smoothstep(0, totalDryMs, dryElapsed);
    effectiveDensity = Math.max(0, (session.evaporateStartDensity || session.density) * (1 - dryProgress));
    if (dryProgress >= 1) {
      session.density = 0.30;
      session.streak = 0;
    }
  }

  const pressureAgeMs = Number.isFinite(session.lastInputAt)
    ? Math.max(0, now - session.lastInputAt)
    : 0;
  const visiblePressure = clamp(
    session.pressure * Math.exp(-pressureAgeMs / Math.max(1, session.profile.pressureDecayMs * 1.35)),
    0,
    1,
  );
  return {
    live: session.strokes.length > 0,
    phase: session.phase,
    strokes: session.strokes,
    activeStrokeId: session.activeStrokeId,
    pressure: visiblePressure,
    density: effectiveDensity,
    streak: session.streak || 0,
    profile: session.profile,
    reducedMotion: session.reducedMotion,
    now,
  };
}

export function clearInkBrushSession(session) {
  if (!session) return;
  session.strokes.length = 0;
  session.activeStrokeId = null;
  session.phase = INK_BRUSH_PHASES.IDLE;
  session.pressure = 0;
  session.compositionActive = false;
  session.density = 0.30;
  session.streak = 0;
  session.freezeDryingUntil = 0;
  session.evaporateStartDensity = 0.30;
}
