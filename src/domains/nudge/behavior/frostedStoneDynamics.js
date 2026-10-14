const FROSTED_STONE_MASS = 1.8;
const FROSTED_STONE_MAX_SPEED_PX_PER_S = 1450;

// Wheel direction lives in momentum, not energy: J = k * delta, p' = p + J,
// v = p / m, and K = |p|^2 / 2m. This makes opposing input ordinary signed
// cancellation while retaining kinetic energy as a direction-free safety cap.
export const FROSTED_STONE_MATERIAL = Object.freeze({
  id: 'frosted_stone',
  stage: 'light',
  name: 'Ice Stone',
  mass: FROSTED_STONE_MASS,
  impulsePerDeltaPx: 7,
  virtualGravityPxPerS2: 1000,
  staticFrictionCoefficient: 1.1,
  kineticFrictionCoefficient: 0.09,
  stribeckVelocityPxPerS: 700,
  viscousDragPerS: 1.4,
  restVelocityPxPerS: 4,
  maxKineticEnergy: 0.5
    * FROSTED_STONE_MASS
    * FROSTED_STONE_MAX_SPEED_PX_PER_S
    * FROSTED_STONE_MAX_SPEED_PX_PER_S,
  integrationStepSeconds: 1 / 240,
  maxFrameSeconds: 0.04,
  maxSettleMs: 1100,
});

export const SCROLL_DYNAMICS_MODELS = Object.freeze({
  1: FROSTED_STONE_MATERIAL,
  2: Object.freeze({
    id: 'deep_water',
    stage: 'medium',
    name: 'Deep Water',
    mass: 1.5,
    impulsePerDeltaPx: 5.0,
    virtualGravityPxPerS2: 1200,
    staticFrictionCoefficient: 0.5,
    kineticFrictionCoefficient: 0.38,
    stribeckVelocityPxPerS: 320,
    viscousDragPerS: 3.8,
    restVelocityPxPerS: 5,
    maxKineticEnergy: 0.5 * 1.5 * 1100 * 1100,
    integrationStepSeconds: 1 / 240,
    maxFrameSeconds: 0.04,
    maxSettleMs: 900,
  }),
  3: Object.freeze({
    id: 'suspended_weight',
    stage: 'heavy',
    name: 'Suspended Weight',
    mass: 3.2,
    impulsePerDeltaPx: 8.5,
    virtualGravityPxPerS2: 1100,
    staticFrictionCoefficient: 1.0,
    kineticFrictionCoefficient: 0.24,
    stribeckVelocityPxPerS: 480,
    viscousDragPerS: 2.6,
    restVelocityPxPerS: 4,
    maxKineticEnergy: 0.5 * 3.2 * 1300 * 1300,
    integrationStepSeconds: 1 / 240,
    maxFrameSeconds: 0.04,
    maxSettleMs: 1400,
  }),
});

export function resolveScrollDynamicsMaterial(levelOrMode = 1) {
  if (levelOrMode && typeof levelOrMode === 'object' && levelOrMode.id) {
    return levelOrMode;
  }
  const numericLevel = Number.parseInt(String(levelOrMode ?? '1'), 10);
  if (SCROLL_DYNAMICS_MODELS[numericLevel]) {
    return SCROLL_DYNAMICS_MODELS[numericLevel];
  }
  if (typeof levelOrMode === 'string') {
    const found = Object.values(SCROLL_DYNAMICS_MODELS).find((m) => m.id === levelOrMode);
    if (found) return found;
  }
  return SCROLL_DYNAMICS_MODELS[1];
}

function assertFiniteNumber(value, code) {
  if (!Number.isFinite(value)) throw new Error(code);
}

function assertPositiveNumber(value, code) {
  assertFiniteNumber(value, code);
  if (value <= 0) throw new Error(code);
}

function assertNonNegativeNumber(value, code) {
  assertFiniteNumber(value, code);
  if (value < 0) throw new Error(code);
}

function assertMaterial(material) {
  if (material === FROSTED_STONE_MATERIAL) return;
  if (!material || typeof material !== 'object') {
    throw new Error('FROSTED_STONE_MATERIAL_REQUIRED');
  }
  const validIds = new Set(['frosted_stone', 'ice_stone', 'deep_water', 'suspended_weight']);
  if (!validIds.has(material.id)) {
    throw new Error('FROSTED_STONE_MATERIAL_ID_INVALID');
  }
  if (typeof material.stage !== 'string' || !material.stage) {
    throw new Error('FROSTED_STONE_MATERIAL_STAGE_INVALID');
  }
  assertPositiveNumber(material.mass, 'FROSTED_STONE_MASS_INVALID');
  assertPositiveNumber(material.impulsePerDeltaPx, 'FROSTED_STONE_IMPULSE_INVALID');
  assertPositiveNumber(material.virtualGravityPxPerS2, 'FROSTED_STONE_GRAVITY_INVALID');
  assertPositiveNumber(
    material.staticFrictionCoefficient,
    'FROSTED_STONE_STATIC_FRICTION_INVALID',
  );
  assertPositiveNumber(
    material.kineticFrictionCoefficient,
    'FROSTED_STONE_KINETIC_FRICTION_INVALID',
  );
  if (material.staticFrictionCoefficient < material.kineticFrictionCoefficient) {
    throw new Error('FROSTED_STONE_FRICTION_ORDER_INVALID');
  }
  assertPositiveNumber(
    material.stribeckVelocityPxPerS,
    'FROSTED_STONE_STRIBECK_VELOCITY_INVALID',
  );
  assertNonNegativeNumber(material.viscousDragPerS, 'FROSTED_STONE_VISCOUS_DRAG_INVALID');
  assertNonNegativeNumber(material.restVelocityPxPerS, 'FROSTED_STONE_REST_VELOCITY_INVALID');
  assertPositiveNumber(material.maxKineticEnergy, 'FROSTED_STONE_MAX_ENERGY_INVALID');
  assertPositiveNumber(
    material.integrationStepSeconds,
    'FROSTED_STONE_INTEGRATION_STEP_INVALID',
  );
  assertPositiveNumber(material.maxFrameSeconds, 'FROSTED_STONE_MAX_FRAME_INVALID');
  if (material.integrationStepSeconds > material.maxFrameSeconds) {
    throw new Error('FROSTED_STONE_INTEGRATION_STEP_EXCEEDS_FRAME');
  }
  assertPositiveNumber(material.maxSettleMs, 'FROSTED_STONE_MAX_SETTLE_INVALID');
}

function assertMotionState(state) {
  if (!state || typeof state !== 'object') {
    throw new Error('FROSTED_STONE_MOTION_STATE_REQUIRED');
  }
  assertFiniteNumber(state.momentumX, 'FROSTED_STONE_MOMENTUM_X_INVALID');
  assertFiniteNumber(state.momentumY, 'FROSTED_STONE_MOMENTUM_Y_INVALID');
}

function writeStepOutput(
  output,
  deltaX,
  deltaY,
  integratedSeconds,
  speedPxPerS,
  kineticEnergy,
  regime,
) {
  if (!output || typeof output !== 'object') {
    throw new Error('FROSTED_STONE_STEP_OUTPUT_REQUIRED');
  }
  output.deltaX = deltaX;
  output.deltaY = deltaY;
  output.integratedSeconds = integratedSeconds;
  output.speedPxPerS = speedPxPerS;
  output.kineticEnergy = kineticEnergy;
  output.regime = regime;
  return output;
}

function getSpeed(state, material) {
  return Math.hypot(state.momentumX, state.momentumY) / material.mass;
}

function getKineticEnergy(state, material) {
  const squaredMomentum = (state.momentumX ** 2) + (state.momentumY ** 2);
  return squaredMomentum / (2 * material.mass);
}

function getRegime(state, material) {
  const speed = getSpeed(state, material);
  if (speed <= material.restVelocityPxPerS) return 'rest';
  if (speed < material.stribeckVelocityPxPerS) return 'grip';
  return 'glide';
}

function getFrictionCoefficient(speedPxPerS, material) {
  const speedRatio = speedPxPerS / material.stribeckVelocityPxPerS;
  return material.kineticFrictionCoefficient + (
    (material.staticFrictionCoefficient - material.kineticFrictionCoefficient)
    * Math.exp(-(speedRatio * speedRatio))
  );
}

function capKineticEnergy(state, material) {
  const kineticEnergy = getKineticEnergy(state, material);
  if (kineticEnergy <= material.maxKineticEnergy) return;
  const energyScale = Math.sqrt(material.maxKineticEnergy / kineticEnergy);
  state.momentumX *= energyScale;
  state.momentumY *= energyScale;
}

function integrateMotion(state, dtSeconds, material, output) {
  const boundedDt = Math.min(dtSeconds, material.maxFrameSeconds);
  let remainingSeconds = boundedDt;
  let integratedSeconds = 0;
  let deltaX = 0;
  let deltaY = 0;

  while (remainingSeconds > 0) {
    const speed = getSpeed(state, material);
    if (speed <= material.restVelocityPxPerS) {
      state.momentumX = 0;
      state.momentumY = 0;
      break;
    }

    const stepSeconds = Math.min(remainingSeconds, material.integrationStepSeconds);
    const momentumMagnitude = Math.hypot(state.momentumX, state.momentumY);
    const directionX = state.momentumX / momentumMagnitude;
    const directionY = state.momentumY / momentumMagnitude;
    const frictionCoefficient = getFrictionCoefficient(speed, material);
    const deceleration = (
      frictionCoefficient * material.virtualGravityPxPerS2
    ) + (material.viscousDragPerS * speed);
    const stoppingSeconds = speed / deceleration;

    if (stoppingSeconds <= stepSeconds) {
      const stoppingDistance = 0.5 * speed * stoppingSeconds;
      deltaX += directionX * stoppingDistance;
      deltaY += directionY * stoppingDistance;
      state.momentumX = 0;
      state.momentumY = 0;
      integratedSeconds += stoppingSeconds;
      break;
    }

    const nextSpeed = speed - (deceleration * stepSeconds);
    const stepDistance = 0.5 * (speed + nextSpeed) * stepSeconds;
    deltaX += directionX * stepDistance;
    deltaY += directionY * stepDistance;
    state.momentumX = directionX * nextSpeed * material.mass;
    state.momentumY = directionY * nextSpeed * material.mass;
    remainingSeconds -= stepSeconds;
    integratedSeconds += stepSeconds;
  }

  return writeStepOutput(
    output,
    deltaX,
    deltaY,
    integratedSeconds,
    getSpeed(state, material),
    getKineticEnergy(state, material),
    getRegime(state, material),
  );
}

export function createFrostedStoneMotionState() {
  return {
    momentumX: 0,
    momentumY: 0,
  };
}

export function createFrostedStoneStepOutput() {
  return {
    deltaX: 0,
    deltaY: 0,
    integratedSeconds: 0,
    speedPxPerS: 0,
    kineticEnergy: 0,
    regime: 'rest',
  };
}

export function resetFrostedStoneMotionState(state) {
  assertMotionState(state);
  state.momentumX = 0;
  state.momentumY = 0;
  return state;
}

export function zeroFrostedStoneMomentumAxis(state, axis) {
  assertMotionState(state);
  if (axis === 'x') state.momentumX = 0;
  else if (axis === 'y') state.momentumY = 0;
  else throw new Error('FROSTED_STONE_AXIS_INVALID');
  return state;
}

export function resolveFrostedStoneFrictionCoefficient(
  speedPxPerS,
  material = FROSTED_STONE_MATERIAL,
) {
  assertMaterial(material);
  assertNonNegativeNumber(speedPxPerS, 'FROSTED_STONE_SPEED_INVALID');
  return getFrictionCoefficient(speedPxPerS, material);
}

export function getFrostedStoneKineticEnergy(
  state,
  material = FROSTED_STONE_MATERIAL,
) {
  assertMaterial(material);
  assertMotionState(state);
  return getKineticEnergy(state, material);
}

export function getFrostedStoneSpeed(state, material = FROSTED_STONE_MATERIAL) {
  assertMaterial(material);
  assertMotionState(state);
  return getSpeed(state, material);
}

export function getFrostedStoneRegime(state, material = FROSTED_STONE_MATERIAL) {
  assertMaterial(material);
  assertMotionState(state);
  return getRegime(state, material);
}

export function hasFrostedStoneMotion(state, material = FROSTED_STONE_MATERIAL) {
  return getFrostedStoneSpeed(state, material) > 0;
}

export function applyFrostedStoneImpulse(
  state,
  deltaX,
  deltaY,
  material = FROSTED_STONE_MATERIAL,
) {
  assertMaterial(material);
  assertMotionState(state);
  assertFiniteNumber(deltaX, 'FROSTED_STONE_DELTA_X_INVALID');
  assertFiniteNumber(deltaY, 'FROSTED_STONE_DELTA_Y_INVALID');

  state.momentumX += deltaX * material.impulsePerDeltaPx;
  state.momentumY += deltaY * material.impulsePerDeltaPx;
  capKineticEnergy(state, material);

  return state;
}

export function transferFrostedStoneMomentumAxis(
  sourceState,
  destinationState,
  axis,
  material = FROSTED_STONE_MATERIAL,
) {
  assertMaterial(material);
  assertMotionState(sourceState);
  assertMotionState(destinationState);
  if (sourceState === destinationState) {
    throw new Error('FROSTED_STONE_MOMENTUM_TRANSFER_REQUIRES_DISTINCT_STATES');
  }
  if (axis !== 'x' && axis !== 'y') throw new Error('FROSTED_STONE_AXIS_INVALID');

  const field = axis === 'x' ? 'momentumX' : 'momentumY';
  const transferredMomentum = sourceState[field];
  sourceState[field] = 0;
  destinationState[field] += transferredMomentum;
  capKineticEnergy(destinationState, material);
  return transferredMomentum;
}

export function advanceFrostedStoneMotion(
  state,
  dtSeconds,
  output,
  material = FROSTED_STONE_MATERIAL,
) {
  assertMaterial(material);
  assertMotionState(state);
  assertNonNegativeNumber(dtSeconds, 'FROSTED_STONE_DT_INVALID');
  return integrateMotion(state, dtSeconds, material, output);
}

export function dissipateFrostedStoneMotion(
  state,
  elapsedSeconds,
  material = FROSTED_STONE_MATERIAL,
) {
  assertMaterial(material);
  assertMotionState(state);
  assertNonNegativeNumber(elapsedSeconds, 'FROSTED_STONE_DISSIPATION_DT_INVALID');

  const output = createFrostedStoneStepOutput();
  let remainingSeconds = Math.min(elapsedSeconds, material.maxSettleMs / 1000);
  while (remainingSeconds > 0 && getSpeed(state, material) > 0) {
    const stepSeconds = Math.min(remainingSeconds, material.maxFrameSeconds);
    integrateMotion(state, stepSeconds, material, output);
    remainingSeconds -= stepSeconds;
  }
  return state;
}

export function estimateFrostedStoneStoppingMotion(
  state,
  material = FROSTED_STONE_MATERIAL,
) {
  assertMaterial(material);
  assertMotionState(state);
  const simulatedState = {
    momentumX: state.momentumX,
    momentumY: state.momentumY,
  };
  const output = createFrostedStoneStepOutput();
  let deltaX = 0;
  let deltaY = 0;
  let elapsedSeconds = 0;
  const maxSeconds = material.maxSettleMs / 1000;

  while (getSpeed(simulatedState, material) > 0 && elapsedSeconds < maxSeconds) {
    const stepSeconds = Math.min(material.maxFrameSeconds, maxSeconds - elapsedSeconds);
    integrateMotion(simulatedState, stepSeconds, material, output);
    deltaX += output.deltaX;
    deltaY += output.deltaY;
    elapsedSeconds += output.integratedSeconds;
  }

  return {
    deltaX,
    deltaY,
    distancePx: Math.hypot(deltaX, deltaY),
    settleMs: Math.round(elapsedSeconds * 1000),
  };
}
