import {
  SHISHI_ODOSHI_GROUND_VIEW,
  SHISHI_ODOSHI_MOUTH_ELLIPSE_ROTATE as MOUTH_ELLIPSE_ROTATE,
  SHISHI_ODOSHI_MOUTH_ELLIPSE_RX as MOUTH_ELLIPSE_RX,
  SHISHI_ODOSHI_MOUTH_ELLIPSE_RY as MOUTH_ELLIPSE_RY,
  SHISHI_ODOSHI_SACRED_STREAM_MAX_HEIGHT as SACRED_STREAM_MAX_HEIGHT,
  SHISHI_ODOSHI_STREAM_CAPTURE_CENTER_X as STREAM_CAPTURE_CENTER_X,
  SHISHI_ODOSHI_STREAM_SOURCE_Y as STREAM_SOURCE_Y,
  SHISHI_ODOSHI_TUBE_LEFT as TUBE_LEFT,
  SHISHI_ODOSHI_TUBE_MOUTH_X as TUBE_MOUTH_X,
  SHISHI_ODOSHI_TUBE_MOUTH_Y as TUBE_MOUTH_Y,
  SHISHI_ODOSHI_TUBE_PIVOT_X as TUBE_PIVOT_X,
  SHISHI_ODOSHI_TUBE_PIVOT_Y as TUBE_PIVOT_Y,
  SHISHI_ODOSHI_TUBE_TOP as TUBE_TOP,
} from './zenShishiOdoshiGeometry.js';

export const IDLE_ROTATE = 20;
export const STREAM_REACH_EXTENSION_MAX = 10;
export const STREAM_CUTOFF_RAISE_PX = 1.2;
export const KARESANSUI_GROUND_TILT_DEG = SHISHI_ODOSHI_GROUND_VIEW.tiltDeg;
export const GROUND_RIPPLE_CYCLE = 1.8;
export const GROUND_RIPPLE_DECAY_PER_SEC = 1.1;
export const GROUND_RIPPLE_SPEED_BASE = 0.42;
export const GROUND_RIPPLE_SPEED_GAIN = 1.35;
export const DEFAULT_RIPPLE_SCALE_X_BASE = 0.8;
export const DEFAULT_RIPPLE_SCALE_X_GAIN = 7.8;
export const DEFAULT_RIPPLE_SCALE_Y_BASE = DEFAULT_RIPPLE_SCALE_X_BASE * SHISHI_ODOSHI_GROUND_VIEW.ellipseAspect;
export const DEFAULT_RIPPLE_SCALE_Y_GAIN = DEFAULT_RIPPLE_SCALE_X_GAIN * SHISHI_ODOSHI_GROUND_VIEW.ellipseAspect;
export const DEFAULT_RIPPLE_ASPECT = SHISHI_ODOSHI_GROUND_VIEW.ellipseAspect;
const SETTLE_INFLOW_VISUAL_WEIGHT_SCALE = 1;

// The requested Gate pour is a bounded visual gesture, independent of entry timing.
export const SHISHI_ODOSHI_POUR_STRIKE_SEC = 0.9;
export const DEFAULT_INITIAL_FILL = 0.08;
// A held fill (the Gate's return lock) rises with its own clock, never past
// this margin below the spill angle: the tube only tips when the hold ends.
const HELD_FILL_SPILL_MARGIN = 0.02;
const HELD_STREAM_PRESENCE = 0.32;

export const SHISHI_ODOSHI_LIP_SPLASH_PARTICLES = Object.freeze([
  Object.freeze({ dx: -30, dy: -16, delay: 0, dur: 0.55, size: 2.4, alpha: 0.78 }),
  Object.freeze({ dx: -44, dy: -23, delay: 0.11, dur: 0.68, size: 1.7, alpha: 0.72 }),
  Object.freeze({ dx: -19, dy: -29, delay: 0.24, dur: 0.62, size: 1.8, alpha: 0.8 }),
  Object.freeze({ dx: -60, dy: -12, delay: 0.06, dur: 0.73, size: 1.25, alpha: 0.62 }),
  Object.freeze({ dx: -34, dy: -35, delay: 0.32, dur: 0.7, size: 1.4, alpha: 0.7 }),
  Object.freeze({ dx: -15, dy: -12, delay: 0.18, dur: 0.48, size: 2.65, alpha: 0.76 }),
  Object.freeze({ dx: -48, dy: -18, delay: 0.42, dur: 0.78, size: 1, alpha: 0.58 }),
  Object.freeze({ dx: 8, dy: -18, delay: 0.29, dur: 0.51, size: 1.5, alpha: 0.64 }),
  Object.freeze({ dx: 16, dy: -9, delay: 0.08, dur: 0.49, size: 1, alpha: 0.54 }),
]);

const FULL_QUALITY_PROFILE = Object.freeze({
  targetFps: 60,
  simHz: 60,
  lipParticleCount: 9,
  shadowAlphaScale: 1,
  enableTubeShadow: true,
});

const toRadians = (degrees) => (degrees * Math.PI) / 180;

export const toFiniteNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const clamp01 = (value) => Math.max(0, Math.min(1, value));
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const smoothstep = (value) => {
  const t = clamp01(value);
  return t * t * (3 - (2 * t));
};

export const resolveRipplePhase = (travel, offset = 0) => {
  let phase = travel + offset;
  while (phase >= GROUND_RIPPLE_CYCLE) phase -= GROUND_RIPPLE_CYCLE;
  while (phase < 0) phase += GROUND_RIPPLE_CYCLE;
  return phase / GROUND_RIPPLE_CYCLE;
};

export const resolveRippleScaleX = (travel, offset = 0) => (
  DEFAULT_RIPPLE_SCALE_X_BASE + (resolveRipplePhase(travel, offset) * DEFAULT_RIPPLE_SCALE_X_GAIN)
);

export const resolveRippleScaleY = (travel, offset = 0, yAspectGain = 1) => (
  (DEFAULT_RIPPLE_SCALE_Y_BASE + (resolveRipplePhase(travel, offset) * DEFAULT_RIPPLE_SCALE_Y_GAIN)) * yAspectGain
);

export const resolveRippleOpacity = (energy, travel, offset, weight) => {
  const phase = resolveRipplePhase(travel, offset);
  return clamp01(energy * smoothstep(phase / 0.12) * Math.pow(1 - phase, 1.6) * weight);
};

export const resolveMouthCenterWorldY = (rotation) => {
  const theta = toRadians(rotation);
  const pivotY = TUBE_TOP + TUBE_PIVOT_Y;
  const dx = TUBE_MOUTH_X - TUBE_PIVOT_X;
  const dy = TUBE_MOUTH_Y - TUBE_PIVOT_Y;
  return pivotY + (dx * Math.sin(theta)) + (dy * Math.cos(theta));
};

export const resolveMouthCenterWorldX = (rotation) => {
  const theta = toRadians(rotation);
  const pivotX = TUBE_LEFT + TUBE_PIVOT_X;
  const dx = TUBE_MOUTH_X - TUBE_PIVOT_X;
  const dy = TUBE_MOUTH_Y - TUBE_PIVOT_Y;
  return pivotX + (dx * Math.cos(theta)) - (dy * Math.sin(theta));
};

export const resolveMouthOpeningHalfWidthX = (rotation) => {
  const mouthAngle = toRadians(MOUTH_ELLIPSE_ROTATE + rotation);
  return Math.hypot(
    MOUTH_ELLIPSE_RX * Math.cos(mouthAngle),
    MOUTH_ELLIPSE_RY * Math.sin(mouthAngle),
  );
};

export const resolveMouthLowerBoundaryWorldY = (rotation) => {
  const centerY = resolveMouthCenterWorldY(rotation);
  const mouthAngle = toRadians(MOUTH_ELLIPSE_ROTATE + rotation);
  const verticalRadius = Math.hypot(
    MOUTH_ELLIPSE_RX * Math.sin(mouthAngle),
    MOUTH_ELLIPSE_RY * Math.cos(mouthAngle),
  );
  return centerY + verticalRadius;
};

export const resolveStreamReachExtension = (rotation) => (
  STREAM_REACH_EXTENSION_MAX * smoothstep((-rotation) / 35)
);

export function resolveShishiOdoshiRestStreamHeight(rotation = IDLE_ROTATE) {
  return clamp(
    ((resolveMouthLowerBoundaryWorldY(rotation) + resolveStreamReachExtension(rotation)) - STREAM_SOURCE_Y) - STREAM_CUTOFF_RAISE_PX,
    0,
    SACRED_STREAM_MAX_HEIGHT,
  );
}

export function resolveConnectedShishiOdoshiGround(groundProjection = null) {
  const groundTiltDeg = clamp(
    toFiniteNumber(groundProjection?.tiltDeg, KARESANSUI_GROUND_TILT_DEG),
    -30,
    30,
  );
  const rippleAspect = clamp(
    toFiniteNumber(groundProjection?.ellipseAspect, DEFAULT_RIPPLE_ASPECT),
    0.08,
    1.6,
  );
  return Object.freeze({
    groundTiltDeg,
    rippleAspect,
    rippleYAspectGain: rippleAspect / DEFAULT_RIPPLE_ASPECT,
  });
}

export function resolveShishiOdoshiQualityProfile(runtimeBudget = null) {
  const runtimeEnabled = runtimeBudget?.enabled !== false;
  const particleScale = Math.max(0, Number(runtimeBudget?.particleScale) || 0);
  const vectorEffectScale = Math.max(0, Number(runtimeBudget?.vectorEffectScale) || 0);

  if (!runtimeEnabled) {
    return Object.freeze({
      targetFps: 0,
      simHz: 0,
      lipParticleCount: 0,
      shadowAlphaScale: 0,
      enableTubeShadow: false,
    });
  }
  const tubeShadowEnabled = vectorEffectScale > 0;

  return Object.freeze({
    targetFps: Math.max(1, Number(runtimeBudget?.targetFps) || FULL_QUALITY_PROFILE.targetFps),
    simHz: Math.max(1, Number(runtimeBudget?.simHz) || FULL_QUALITY_PROFILE.simHz),
    lipParticleCount: Math.max(0, Math.round(FULL_QUALITY_PROFILE.lipParticleCount * particleScale)),
    shadowAlphaScale: tubeShadowEnabled ? Math.max(0.55, vectorEffectScale) : 0,
    enableTubeShadow: tubeShadowEnabled,
  });
}

export function createShishiOdoshiPhysicsState(initialFill = DEFAULT_INITIAL_FILL) {
  return {
    angle: IDLE_ROTATE,
    omega: 0,
    fill: clamp01(toFiniteNumber(initialFill, DEFAULT_INITIAL_FILL)),
    pourElapsedSec: 0,
    pourFillFrom: 0,
    pourAngleFrom: IDLE_ROTATE,
    strikeCount: 0,
    fillRateLpf: 0,
    mouthPulse: 0,
    groundPulse: 0,
    groundFlowPulse: 0,
    groundArrival: 0,
    lipPulse: 0,
    groundRippleTravel: 0,
    groundRippleEnergy: 0,
    edgePulse: 0,
    streamSpread: 0.95,
    missFlowBlend: 0,
    prevEdgeWindow: 0,
    phase: 0,
    lastFrame: 0,
    prevAngle: IDLE_ROTATE,
    accumulatorMs: 0,
  };
}

export function createShishiOdoshiFrameState() {
  const streamHeight = resolveShishiOdoshiRestStreamHeight(IDLE_ROTATE);
  return {
    angle: IDLE_ROTATE,
    captureStemHeight: streamHeight,
    captureTailLength: 0,
    captureTailOpacity: 0,
    captureTailRotate: 0,
    fill: 0,
    freeFallBaseOpacity: 0,
    freeFallCoreOpacity: 0,
    groundImpactPulse: 0,
    groundRippleEnergy: 0,
    groundRippleTravel: 0,
    lipPulse: 0,
    phase: 0,
    streamBaseOpacity: 0,
    streamCoreOpacity: 0,
    streamHeight,
    streamSpread: 0.95,
  };
}

export function stepShishiOdoshiPhysics({
  activityWeight,
  frame = createShishiOdoshiFrameState(),
  isSimulationLive,
  onStrike,
  physics,
  pourMode = false,
  pourRequested = false,
  pourElapsedSec,
  // Gate-only: 0..1 progress of a hold that fills the tube while no pour is
  // requested. null keeps the plain Gate rest pose.
  heldFill = null,
  residualVisualWeight,
  simulationMode,
  state,
  dt,
}) {
  let spillProgress = smoothstep((physics.spillStartAngle - state.angle) / Math.max(0.001, physics.spillBandDeg));

  const holding = pourMode && !pourRequested && heldFill !== null;
  if (holding) {
    if (!Number.isFinite(heldFill)) throw new Error('ZEN_SHISHI_HELD_FILL_INVALID');
    // The tube settles by the same balance it uses on the dashboard, but the
    // fill follows the hold instead of inflow and stops short of spilling.
    const brim = Math.min(1, physics.balancePivotFill
      + Math.max(0, physics.restAngle - physics.spillStartAngle) / Math.max(0.001, physics.balanceGain))
      - HELD_FILL_SPILL_MARGIN;
    if (simulationMode !== 'halt') {
      state.fill += ((clamp01(heldFill) * brim) - state.fill) * (1 - Math.exp(-dt * 2));
    }
    const balanceAngle = Math.min(physics.impactAngle, physics.restAngle
      - (Math.max(0, state.fill - physics.balancePivotFill) * physics.balanceGain));
    const angle = state.angle + (balanceAngle - state.angle) * (1 - Math.exp(-dt * 3));
    state.omega = (angle - state.angle) / Math.max(dt, 0.0001);
    state.angle = angle;
    state.pourElapsedSec = 0;
    // Nearing the brim, water glistens at the mouth before the tube tips.
    state.lipPulse = Math.max(state.lipPulse, 0.5 * smoothstep((clamp01(heldFill) - 0.72) / 0.28));
    spillProgress = smoothstep((physics.spillStartAngle - state.angle) / Math.max(0.001, physics.spillBandDeg));
  } else if (pourMode) {
    if (pourRequested && (!Number.isFinite(pourElapsedSec) || pourElapsedSec < 0)) {
      throw new Error('ZEN_SHISHI_POUR_ELAPSED_INVALID');
    }
    const previousElapsed = state.pourElapsedSec;
    if (pourRequested && previousElapsed === 0) {
      // A pour starts from wherever a hold left the tube, not from empty.
      state.pourFillFrom = state.fill;
      state.pourAngleFrom = state.angle;
    }
    if (simulationMode !== 'halt') state.pourElapsedSec = pourRequested ? pourElapsedSec : 0;
    const elapsed = state.pourElapsedSec;
    const fill = state.pourFillFrom + ((1 - state.pourFillFrom) * smoothstep(elapsed / 0.28));
    const empty = smoothstep((elapsed - 0.42) / 0.24);
    state.fill = pourRequested ? fill * (1 - empty) : 0;
    if (!pourRequested) {
      state.pourFillFrom = 0;
      state.pourAngleFrom = IDLE_ROTATE;
    }
    const tip = smoothstep((elapsed - 0.28) / 0.22);
    const returning = smoothstep((elapsed - 0.66) / (SHISHI_ODOSHI_POUR_STRIKE_SEC - 0.66));
    const angle = elapsed >= SHISHI_ODOSHI_POUR_STRIKE_SEC
      ? physics.impactAngle
      : state.pourAngleFrom + (-40 - state.pourAngleFrom) * tip + (physics.impactAngle + 40) * returning;
    state.omega = (angle - state.angle) / Math.max(dt, elapsed - previousElapsed);
    state.angle = angle;
    spillProgress = smoothstep((physics.spillStartAngle - state.angle) / Math.max(0.001, physics.spillBandDeg));
  } else {
    const ambientActivityWeight = simulationMode === 'settle'
      ? Math.max(activityWeight, residualVisualWeight * SETTLE_INFLOW_VISUAL_WEIGHT_SCALE)
      : 0;
    const inflowWeight = isSimulationLive ? activityWeight : ambientActivityWeight;
    const inflowRate = simulationMode === 'halt'
      ? 0
      : physics.inflowRate * inflowWeight * (1 - (0.35 * spillProgress));
    const outflowRate = simulationMode === 'halt'
      ? 0
      : physics.outflowRate * spillProgress * (0.22 + (0.78 * state.fill));
    const prevFill = state.fill;
    state.fill = clamp01(state.fill + ((inflowRate - outflowRate) * dt));

    const fillRate = (state.fill - prevFill) / dt;
    const fillRateLerp = 1 - Math.exp(-dt * physics.fillRateResponse);
    state.fillRateLpf += (fillRate - state.fillRateLpf) * fillRateLerp;

    const targetAngle = physics.restAngle - ((state.fill - physics.balancePivotFill) * physics.balanceGain);
    const springTorque = (targetAngle - state.angle) * physics.spring;
    const dampingTorque = state.omega * physics.angularDrag;
    const spillTorque = -physics.spillPull * spillProgress * (0.2 + (0.8 * state.fill));
    const fillRateTorque = -Math.max(0, state.fillRateLpf) * physics.fillRateTorque;
    const settleAssist = simulationMode === 'halt' ? ((physics.restAngle - state.angle) * 6.5) : 0;
    const netTorque = springTorque + spillTorque + fillRateTorque + settleAssist;
    const alpha = netTorque - dampingTorque;
    const atImpactStop = state.angle >= (physics.impactAngle - 0.0001);
    const pushingIntoImpactStop = state.omega >= 0 && netTorque >= 0;

    if (atImpactStop && pushingIntoImpactStop) {
      state.angle = physics.impactAngle;
      state.omega = 0;
    } else {
      if (
        spillProgress < 0.15
        && Math.abs(state.omega) < physics.stickOmegaThreshold
        && Math.abs(alpha) < physics.stickTorqueThreshold
      ) {
        state.omega = 0;
      } else {
        state.omega += alpha * dt;
      }

      state.angle += state.omega * dt;
    }

    if (state.angle < physics.minAngle) {
      state.angle = physics.minAngle;
      state.omega = Math.abs(state.omega) * physics.lowerStopRestitution;
      state.groundPulse = Math.max(state.groundPulse, 0.35);
    }

    if (state.angle > physics.maxAngle) {
      state.angle = physics.maxAngle;
      state.omega = -Math.abs(state.omega) * physics.upperStopRestitution;
    }
  }

  if (state.prevAngle < physics.impactAngle && state.angle >= physics.impactAngle) {
    const impactSpeed = Math.max(0, state.omega);
    state.angle = physics.impactAngle;
    if (impactSpeed >= physics.impactMinSpeed) {
      state.omega = -impactSpeed * physics.impactRestitution;
    } else {
      state.omega = 0;
    }
    const impactBurst = clamp01((impactSpeed - 10) / 28);
    state.lipPulse = Math.max(state.lipPulse, 0.62 + (impactBurst * 0.34));
    state.edgePulse = Math.max(state.edgePulse, 0.56 + (impactBurst * 0.3));
    state.strikeCount += 1;
    if (isSimulationLive) {
      onStrike?.({
        impactSpeed,
        fill: state.fill,
        phase: state.phase,
        strikeCount: state.strikeCount,
      });
    }
  }

  if (state.prevAngle > physics.impactAngle && state.angle < physics.impactAngle && state.omega < -6) {
    const returnBurst = clamp01((Math.abs(state.omega) - 6) / 18);
    state.lipPulse = Math.max(state.lipPulse, 0.52 + (returnBurst * 0.26));
    state.edgePulse = Math.max(state.edgePulse, 0.46 + (returnBurst * 0.22));
  }

  const flowPresence = simulationMode === 'halt'
    ? 0
    : holding
      ? HELD_STREAM_PRESENCE
    : pourMode
      ? (pourRequested ? smoothstep(state.pourElapsedSec / 0.06)
        * (1 - smoothstep((state.pourElapsedSec - 0.42) / 0.12)) : 0)
      : (isSimulationLive ? activityWeight : residualVisualWeight * 0.72);
  const baseFlow = flowPresence > 0
    ? (0.38 + (state.fill * 0.34) + (spillProgress * 0.48)) * flowPresence
    : 0;
  const flowStrength = clamp01(baseFlow);
  const dumpDrive = spillProgress * (0.25 + (0.75 * state.fill));
  const streamHeightNow = resolveShishiOdoshiRestStreamHeight(state.angle);
  const missTarget = smoothstep((-state.angle - 18) / 10) * spillProgress;
  const missLerp = 1 - Math.exp(-dt * 8);
  state.missFlowBlend += (missTarget - state.missFlowBlend) * missLerp;

  const missGate = smoothstep((state.missFlowBlend - 0.5) / 0.24) * smoothstep((-state.angle - 22) / 6);
  const angleCutoff = smoothstep((-state.angle - 25) / 5);
  const mouthCenterX = resolveMouthCenterWorldX(state.angle);
  const mouthHalfWidthX = resolveMouthOpeningHalfWidthX(state.angle);
  const xOffsetFromMouth = Math.abs(mouthCenterX - STREAM_CAPTURE_CENTER_X);
  const mouthCaptureTolerance = Math.max(1.6, mouthHalfWidthX - 1.1);
  const xMiss = smoothstep((xOffsetFromMouth - mouthCaptureTolerance) / 2.6);
  const hardRelease = smoothstep((xOffsetFromMouth - (mouthHalfWidthX - 0.4)) / 1.8) * smoothstep((-state.angle - 12) / 10);
  const freeFallBlend = Math.max(missGate, angleCutoff, xMiss, hardRelease);
  const captureFlow = flowStrength * (1 - freeFallBlend);
  const freeFallFlow = flowStrength * freeFallBlend;

  const streamSpreadTarget = 0.92 + (dumpDrive * 0.16) + (pourMode && flowPresence > 0 ? 0.65 : 0);
  const streamSpreadLerp = 1 - Math.exp(-dt * 10);
  state.streamSpread += (streamSpreadTarget - state.streamSpread) * streamSpreadLerp;

  const splashTarget = simulationMode !== 'halt'
    ? clamp01(captureFlow * (0.24 + (0.76 * spillProgress)) * (1 - (state.missFlowBlend * 0.55)))
    : 0;
  const splashLerp = 1 - Math.exp(-dt * 11);
  state.mouthPulse += (splashTarget - state.mouthPulse) * splashLerp;

  const edgeWindow = clamp01(1 - (Math.abs(state.missFlowBlend - 0.38) / 0.38));
  const edgeTarget = simulationMode !== 'halt'
    ? clamp01(dumpDrive * edgeWindow * (0.35 + (0.65 * flowStrength)))
    : 0;
  const edgeLerp = 1 - Math.exp(-dt * 13);
  state.edgePulse += (edgeTarget - state.edgePulse) * edgeLerp;

  const enteredEdgeZone = state.prevEdgeWindow < 0.6 && edgeWindow >= 0.6;
  const exitedEdgeZone = state.prevEdgeWindow > 0.34 && edgeWindow <= 0.34;
  if (simulationMode !== 'halt' && (enteredEdgeZone || exitedEdgeZone) && Math.abs(state.omega) > 4) {
    const edgeBurst = clamp01((Math.abs(state.omega) - 4) / 16);
    state.edgePulse = Math.max(state.edgePulse, 0.74 + (edgeBurst * 0.24));
    state.lipPulse = Math.max(state.lipPulse, 0.66 + (edgeBurst * 0.3));
  }

  if (state.prevAngle > (physics.minAngle + 1.5) && state.angle <= (physics.minAngle + 1.5) && state.omega < -8) {
    state.edgePulse = Math.max(state.edgePulse, 0.95);
    state.lipPulse = Math.max(state.lipPulse, 0.85);
  }

  const groundTarget = simulationMode !== 'halt'
    ? clamp01((freeFallFlow * 0.9) + (dumpDrive * 0.85))
    : 0;
  state.groundFlowPulse = pourMode ? groundTarget
    : state.groundFlowPulse + (groundTarget - state.groundFlowPulse) * (1 - Math.exp(-dt * 8));
  const groundPulseNow = clamp01(Math.max(state.groundPulse, state.groundFlowPulse * 0.9));
  const groundArrivalTarget = smoothstep((groundPulseNow - 0.06) / 0.38);
  const groundArrivalLerp = 1 - Math.exp(-dt * 5.2);
  // The bounded Gate gesture must not wait for accumulated ambient filter steps.
  state.groundArrival = pourMode ? smoothstep((state.pourElapsedSec - 0.36) / 0.14)
    : state.groundArrival + (groundArrivalTarget - state.groundArrival) * groundArrivalLerp;
  const groundImpactGate = smoothstep((state.groundArrival - 0.34) / 0.5);
  const groundImpactNow = groundPulseNow * groundImpactGate;
  if (simulationMode !== 'halt' && groundImpactNow > 0.05) {
    state.groundRippleEnergy = Math.max(state.groundRippleEnergy, groundImpactNow);
  }
  if (state.groundRippleEnergy > 0.01) {
    state.groundRippleTravel += dt * (GROUND_RIPPLE_SPEED_BASE + (state.groundRippleEnergy * GROUND_RIPPLE_SPEED_GAIN));
    while (state.groundRippleTravel >= GROUND_RIPPLE_CYCLE) {
      state.groundRippleTravel -= GROUND_RIPPLE_CYCLE;
    }
  }
  state.groundRippleEnergy *= Math.exp(-GROUND_RIPPLE_DECAY_PER_SEC * dt);

  state.groundPulse *= Math.exp(-physics.pulseDecayPerSec * dt);
  state.lipPulse *= Math.exp(-physics.lipDecayPerSec * dt);
  state.phase += dt * (physics.phaseSpeedBase + (flowStrength * physics.phaseSpeedFlowBoost));

  const captureRatio = captureFlow / Math.max(0.0001, flowStrength);
  const tailBlend = clamp01(captureRatio * smoothstep((-state.angle - 8) / 14));
  const captureTailLength = 2 + (tailBlend * 14);
  const captureTailRotate = state.angle * tailBlend;
  const stemTrim = captureTailLength * 0.8 * tailBlend;
  const captureStemHeight = Math.max(0, streamHeightNow - stemTrim);

  state.prevAngle = state.angle;
  state.prevEdgeWindow = edgeWindow;

  frame.angle = state.angle;
  frame.captureStemHeight = captureStemHeight;
  frame.captureTailLength = captureTailLength;
  frame.captureTailOpacity = tailBlend * 0.95 * residualVisualWeight;
  frame.captureTailRotate = captureTailRotate;
  frame.fill = state.fill;
  frame.freeFallBaseOpacity = freeFallFlow * 0.92 * residualVisualWeight;
  frame.freeFallCoreOpacity = freeFallFlow * 0.78 * residualVisualWeight;
  frame.groundImpactPulse = groundImpactNow;
  frame.groundRippleEnergy = state.groundRippleEnergy;
  frame.groundRippleTravel = state.groundRippleTravel;
  frame.lipPulse = clamp01(Math.max(state.lipPulse, state.edgePulse));
  frame.phase = state.phase;
  frame.streamBaseOpacity = captureFlow * residualVisualWeight;
  frame.streamCoreOpacity = captureFlow * 0.84 * residualVisualWeight;
  frame.streamHeight = streamHeightNow;
  frame.streamSpread = state.streamSpread;

  return frame;
}
