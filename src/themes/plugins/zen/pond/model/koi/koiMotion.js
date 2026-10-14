const TAU = Math.PI * 2;

export const KOI_COORDINATE_CONTRACT = Object.freeze({
  historyIndexDirection: 'head_to_tail',
  headIndex: 0,
  angleSemantic: 'headward',
  angleZeroAxis: '+x',
  anglePositiveDirection: 'clockwise_canvas_y_down',
});

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function wrapAngle(angle) {
  let a = angle;
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
}

export function headwardToTailwardAngle(angle) {
  return wrapAngle(toFinite(angle, 0) + Math.PI);
}

export function resolveHeadwardAngleFromHistory(history, index, fallback = 0) {
  const list = Array.isArray(history) ? history : [];
  if (list.length === 0) return toFinite(fallback, 0);

  const clampedIndex = clamp(Math.round(toFinite(index, 0)), 0, list.length - 1);
  const current = list[clampedIndex];
  if (!current || typeof current !== 'object') return toFinite(fallback, 0);

  const cx = toFinite(current.x, 0);
  const cy = toFinite(current.y, 0);

  let dx = 0;
  let dy = 0;
  if (clampedIndex === 0 && list.length > 1) {
    const next = list[1];
    dx = cx - toFinite(next?.x, cx);
    dy = cy - toFinite(next?.y, cy);
  } else if (clampedIndex > 0) {
    const prev = list[clampedIndex - 1];
    dx = toFinite(prev?.x, cx) - cx;
    dy = toFinite(prev?.y, cy) - cy;
  } else {
    return toFinite(current.angle, fallback);
  }

  if (Math.hypot(dx, dy) > 1e-6) {
    return Math.atan2(dy, dx);
  }
  return toFinite(current.angle, fallback);
}

export function normalizeHistoryAnglesInPlace(history, fallback = 0) {
  const list = Array.isArray(history) ? history : [];
  let lastAngle = toFinite(fallback, 0);
  for (let i = 0; i < list.length; i += 1) {
    const point = list[i];
    if (!point || typeof point !== 'object') continue;
    const resolved = resolveHeadwardAngleFromHistory(list, i, lastAngle);
    point.angle = resolved;
    lastAngle = resolved;
  }
  return list;
}

export function computeTailJointPose({
  history,
  tipPos = null,
  turnRate = 0,
  bank = 0,
  tailTurnSpreadGain = 0.45,
  clampFn = clamp,
} = {}) {
  const safeClamp = typeof clampFn === 'function' ? clampFn : clamp;
  const list = Array.isArray(history) ? history : [];
  const tipIndex = Math.max(0, list.length - 1);
  const tip = tipPos || list[tipIndex] || { x: 0, y: 0, angle: 0 };
  const peduncleIndex = Math.max(0, list.length - 2);
  const peduncle = list[peduncleIndex] || tip;

  const tipHeadwardAngle = resolveHeadwardAngleFromHistory(list, tipIndex, Number(tip?.angle) || 0);
  const peduncleHeadwardAngle = resolveHeadwardAngleFromHistory(
    list,
    peduncleIndex,
    Number(peduncle?.angle) || tipHeadwardAngle,
  );

  const rootBackAngle = headwardToTailwardAngle(peduncleHeadwardAngle);
  const tipBackAngle = headwardToTailwardAngle(tipHeadwardAngle);
  const safeTurnRate = toFinite(turnRate, 0);
  const safeBank = toFinite(bank, 0);
  const spreadGain = safeClamp(toFinite(tailTurnSpreadGain, 0.45), 0, 2);
  const articulation = safeClamp(0.65 + spreadGain * 0.35, 0.35, 1.45);
  const rootTurnGain = 4.2 * articulation;
  const tipTurnGain = 6.4 * articulation;
  const chainBend = wrapAngle(tipBackAngle - rootBackAngle);
  const jointRootAngle = rootBackAngle - safeTurnRate * rootTurnGain + safeBank * 0.08;
  const jointTipAngle = tipBackAngle - safeTurnRate * tipTurnGain + chainBend * 0.32 + safeBank * 0.14;

  return {
    peduncle,
    tip,
    peduncleHeadwardAngle,
    tipHeadwardAngle,
    rootBackAngle,
    tipBackAngle,
    chainBend,
    articulation,
    jointRootAngle,
    jointTipAngle,
    bodyForwardAngle: peduncleHeadwardAngle,
  };
}

export const KOI_TAIL_TEXTURE_ZERO_OFFSET = -Math.PI;

export function resolveTailSpriteRotationFromJointTip(
  jointTipAngle,
  textureZeroOffset = KOI_TAIL_TEXTURE_ZERO_OFFSET,
) {
  return wrapAngle(toFinite(jointTipAngle, 0) + toFinite(textureZeroOffset, KOI_TAIL_TEXTURE_ZERO_OFFSET));
}

export function resolveTailShadowCanvasFit({
  forwardRoom = Number.POSITIVE_INFINITY,
  tailLength = 0,
  size = 0,
  minScale = 0.22,
  maxScale = 1,
  marginFactor = 0.03,
  extraExtentFactor = 0.24,
  maxRootShiftFactor = 0.38,
  clampFn = clamp,
} = {}) {
  const safeClamp = typeof clampFn === 'function' ? clampFn : clamp;
  const resolvedForwardRoom = toFinite(forwardRoom, Number.POSITIVE_INFINITY);
  if (!Number.isFinite(resolvedForwardRoom)) {
    return {
      rootShift: 0,
      lengthScale: 1,
      requiredExtent: 0,
      usableRoom: Number.POSITIVE_INFINITY,
    };
  }

  const nominalTailLength = Math.max(1e-6, toFinite(tailLength, 0));
  const safeSize = Math.max(0, toFinite(size, 0));
  const margin = Math.max(0, safeSize * safeClamp(toFinite(marginFactor, 0.03), 0, 0.2));
  const extraExtent = Math.max(0, safeSize * safeClamp(toFinite(extraExtentFactor, 0.24), 0, 1));
  const requiredExtent = nominalTailLength + extraExtent;
  const usableRoom = Math.max(0, resolvedForwardRoom - margin);

  const overflow = Math.max(0, requiredExtent - usableRoom);
  const maxRootShift = Math.max(0, safeSize * safeClamp(toFinite(maxRootShiftFactor, 0.38), 0, 1.2));
  const rootShift = safeClamp(overflow, 0, maxRootShift);

  const coveredRoom = usableRoom + rootShift;
  const minLengthScale = safeClamp(toFinite(minScale, 0.22), 0.05, 1);
  const maxLengthScale = safeClamp(toFinite(maxScale, 1), minLengthScale, 1);
  const lengthScale = safeClamp(
    coveredRoom / Math.max(1e-6, requiredExtent),
    minLengthScale,
    maxLengthScale,
  );

  return {
    rootShift,
    lengthScale,
    requiredExtent,
    usableRoom,
  };
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function toFinite(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / Math.max(1e-6, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function easeInCubic(t) {
  const u = clamp(t, 0, 1);
  return u * u * u;
}

function easeOutCubic(t) {
  const u = clamp(t, 0, 1);
  const inv = 1 - u;
  return 1 - inv * inv * inv;
}

function easeInOutCubic(t) {
  const u = clamp(t, 0, 1);
  if (u < 0.5) return 4 * u * u * u;
  const inv = 2 * u - 2;
  return 0.5 * inv * inv * inv + 1;
}

function remapUnit(value, start, end) {
  return clamp((value - start) / Math.max(1e-6, end - start), 0, 1);
}

function hypot2(x, y) {
  return Math.hypot(x, y);
}

function normalize(vx, vy) {
  const m = hypot2(vx, vy);
  if (m < 1e-9) return { x: 0, y: 0, mag: 0 };
  return { x: vx / m, y: vy / m, mag: m };
}

function potentialPsi(nx, ny, t, seed) {
  const s1 = seed * 1.73 + 0.17;
  const s2 = seed * 2.11 + 0.91;
  const p1 = Math.sin((nx * 5.9 + ny * 3.3) + t * 0.9 + s1);
  const p2 = Math.cos((nx * -4.2 + ny * 6.1) - t * 1.1 + s2);
  const p3 = Math.sin((nx * 7.4 - ny * 2.7) + t * 0.53 + s1 * 0.7);
  return p1 * 0.9 + p2 * 0.65 + p3 * 0.4;
}

function sampleRawCurl(nx, ny, t, seed, e, strength) {
  const psiX1 = potentialPsi(nx + e, ny, t, seed);
  const psiX2 = potentialPsi(nx - e, ny, t, seed);
  const psiY1 = potentialPsi(nx, ny + e, t, seed);
  const psiY2 = potentialPsi(nx, ny - e, t, seed);

  const dPsiDx = (psiX1 - psiX2) / (2 * e);
  const dPsiDy = (psiY1 - psiY2) / (2 * e);
  return { x: dPsiDy * strength, y: -dPsiDx * strength };
}

export function sampleCurlField({
  x,
  y,
  width,
  height,
  time,
  seed = 0,
  epsilon = 0.0025,
  strength = 0.015,
  out = null,
}) {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const nx = (x / w) - 0.5;
  const ny = (y / h) - 0.5;
  const e = clamp(epsilon, 1e-4, 0.03);
  const t = time * 0.011;

  const a = sampleRawCurl(nx, ny, t, seed, e, strength);
  const b = sampleRawCurl(-nx, -ny, t, seed, e, strength);
  // Anti-symmetry blend keeps the field lively while eliminating long-term directional drift.
  const vx = (a.x - b.x) * 0.5;
  const vy = (a.y - b.y) * 0.5;
  const target = out || { x: 0, y: 0, angle: 0 };
  target.x = vx;
  target.y = vy;
  target.angle = Math.atan2(vy, vx);
  return target;
}

export function computeTailWave({
  segmentT,
  speed,
  phase,
  wiggleStart = 0.77,
  wiggleAmount = 0.24,
  waveNumber = 4,
  secondaryPhase = 0,
  prevWave = 0,
  maxDelta = 0.16,
}) {
  const t = clamp(segmentT, 0, 1);
  const envT = smoothstep(wiggleStart, 1, t);
  const speedEnv = clamp(0.35 + speed * 8.0, 0.35, 1.9);
  const envelope = wiggleAmount * envT * speedEnv;
  const phasePos = phase - t * waveNumber;
  const harmonic = Math.sin(phasePos) + 0.35 * Math.sin(2 * phasePos + secondaryPhase);
  const raw = envelope * harmonic;
  const limited = prevWave + clamp(raw - prevWave, -Math.abs(maxDelta), Math.abs(maxDelta));
  return { wave: limited, raw, envelope };
}

export function computeHydroDrag({
  velocity,
  moveAngle,
  forwardDamping = 0.97,
  lateralDamping = 0.84,
}) {
  const fx = Math.cos(moveAngle);
  const fy = Math.sin(moveAngle);
  const vForward = velocity.x * fx + velocity.y * fy;
  const latX = velocity.x - fx * vForward;
  const latY = velocity.y - fy * vForward;
  return {
    x: fx * (vForward * forwardDamping) + latX * lateralDamping,
    y: fy * (vForward * forwardDamping) + latY * lateralDamping,
    forward: vForward,
    lateral: hypot2(latX, latY),
  };
}

function computeBoundaryForce(position, bounds) {
  const width = Math.max(1, bounds?.width ?? 1);
  const height = Math.max(1, bounds?.height ?? 1);
  const pad = clamp(bounds?.padding ?? 56, 12, Math.min(width, height) * 0.45);

  // 더 공격적인 벽 회피를 위해 감지 범위를 확장
  const sensorDist = pad * 1.8; // 감지 범위 확장 (1.45 -> 1.8)
  const power = 1.6; // 반발 곡선을 더 완만하게 하여 일찍 밀어냄
  const left = position.x - pad;
  const right = (width - pad) - position.x;
  const top = position.y - pad;
  const bottom = (height - pad) - position.y;

  const edgePush = (d) => {
    if (d >= sensorDist) return 0;
    const ratio = clamp(d / Math.max(1e-6, sensorDist), 0, 1);
    return Math.pow(1 - ratio, power);
  };

  // 좌/상 벽 근처면 +축으로, 우/하 벽 근처면 -축으로 밀어냄
  const pushX = edgePush(left) - edgePush(right);
  const pushY = edgePush(top) - edgePush(bottom);
  return { x: pushX, y: pushY };
}

function computeSocialForce(position, neighbors, radius) {
  if (!neighbors?.length) return { separation: { x: 0, y: 0 }, alignment: { x: 0, y: 0 } };

  const sepRadius = Math.max(10, radius);
  let sepX = 0;
  let sepY = 0;
  let alignX = 0;
  let alignY = 0;
  let alignN = 0;

  for (let i = 0; i < neighbors.length; i++) {
    const n = neighbors[i];
    const dx = position.x - n.x;
    const dy = position.y - n.y;
    const d = Math.max(1e-6, Math.hypot(dx, dy));
    if (d < sepRadius) {
      const gainRatio = 1 - d / sepRadius;
      const gain = gainRatio * gainRatio;
      sepX += (dx / d) * gain;
      sepY += (dy / d) * gain;
    }

    if (Number.isFinite(n.angle)) {
      alignX += Math.cos(n.angle);
      alignY += Math.sin(n.angle);
      alignN += 1;
    }
  }

  if (alignN > 0) {
    alignX /= alignN;
    alignY /= alignN;
  }

  return { separation: { x: sepX, y: sepY }, alignment: { x: alignX, y: alignY } };
}

export function computeSteering({
  position,
  heading,
  targetAngle,
  flow,
  anchor,
  neighbors = [],
  center,
  bounds,
  randomTurn = 0,
  state = {},
  separationRadius = 148,
}) {
  const flowWeight = state.flowWeight ?? 0.9;
  const anchorWeight = state.anchorWeight ?? 0.55;
  const separationWeight = state.separationWeight ?? 1.2;
  const alignmentWeight = state.alignmentWeight ?? 0.18;
  const centerWeight = state.centerWeight ?? 0.16;
  const boundaryWeight = state.boundaryWeight ?? 1.25;
  const randomWeight = state.randomWeight ?? 0.25;
  const turnResponse = state.turnResponse ?? 0.07;

  const toAnchor = normalize((anchor?.x ?? position.x) - position.x, (anchor?.y ?? position.y) - position.y);
  const toCenter = normalize((center?.x ?? position.x) - position.x, (center?.y ?? position.y) - position.y);
  const boundary = computeBoundaryForce(position, bounds);
  const social = computeSocialForce(position, neighbors, separationRadius);

  let steerX = 0;
  let steerY = 0;
  steerX += (flow?.x ?? 0) * flowWeight;
  steerY += (flow?.y ?? 0) * flowWeight;
  steerX += toAnchor.x * anchorWeight;
  steerY += toAnchor.y * anchorWeight;
  steerX += social.separation.x * separationWeight;
  steerY += social.separation.y * separationWeight;
  steerX += social.alignment.x * alignmentWeight;
  steerY += social.alignment.y * alignmentWeight;
  steerX += toCenter.x * centerWeight;
  steerY += toCenter.y * centerWeight;
  steerX += boundary.x * boundaryWeight;
  steerY += boundary.y * boundaryWeight;

  const randomAngle = heading + randomTurn;
  steerX += Math.cos(randomAngle) * randomWeight;
  steerY += Math.sin(randomAngle) * randomWeight;

  if (!Number.isFinite(steerX) || !Number.isFinite(steerY)) {
    return { targetAngle, steer: { x: 0, y: 0 } };
  }

  let desiredAngle = Math.atan2(steerY, steerX);
  if (!Number.isFinite(desiredAngle)) desiredAngle = heading;

  const d = wrapAngle(desiredAngle - targetAngle);
  const nextTarget = targetAngle + d * clamp(turnResponse, 0.001, 1);
  return { targetAngle: wrapAngle(nextTarget), steer: { x: steerX, y: steerY } };
}

export function vectorProjectionMagnitude(vector, angle) {
  return vector.x * Math.cos(angle) + vector.y * Math.sin(angle);
}

export function vectorLateralMagnitude(vector, angle) {
  const f = vectorProjectionMagnitude(vector, angle);
  const lx = vector.x - Math.cos(angle) * f;
  const ly = vector.y - Math.sin(angle) * f;
  return Math.hypot(lx, ly);
}

export function computeCycleRate(state, speedNorm = 0, turnNeed = 0) {
  const s = state || 'glide';
  const v = clamp(speedNorm, 0, 1);
  const t = clamp(turnNeed, 0, 1);

  if (s === 'glide') {
    const inertiaGate = clamp((v - 0.22) / 0.62, 0, 1);
    const turnGate = clamp((t - 0.18) / 0.72, 0, 1);
    // [수정] 글라이드 시 최소 흔들림 상향 (0.00055 -> 0.0015)
    return 0.0015 + inertiaGate * 0.0028 + turnGate * 0.0025;
  }
  if (s === 'drift') {
    return 0.0035 + v * 0.004 + t * 0.003;
  }
  if (s === 'inspect') {
    return 0.0045 + v * 0.005 + t * 0.004;
  }
  if (s === 'cruise') {
    // [수정] 크루즈 모드 꼬리 속도 상향 (0.0085 -> 0.013)
    return 0.013 + v * 0.011 + t * 0.0075;
  }
  if (s === 'burst') {
    // [수정] 버스트 시 꼬리 속도 상향
    return 0.016 + v * 0.014 + t * 0.01;
  }
  if (s === 'c_turn') {
    return 0.0145 + v * 0.009 + t * 0.012;
  }
  return 0.002 + v * 0.003;
}

export function normalizeCyclePhase(phase) {
  const unit = (toFinite(phase, 0) / TAU) % 1;
  return unit < 0 ? unit + 1 : unit;
}

export function computePectoralStrokeWave(phase, options = {}) {
  const phase01 = normalizeCyclePhase(phase);

  const preloadPhase = clamp(toFinite(options.preloadPhase, 0.08), 0.02, 0.22);
  const powerEndPhase = clamp(
    toFinite(options.powerEndPhase, 0.42),
    preloadPhase + 0.1,
    0.72,
  );
  const recoveryEndPhase = clamp(
    toFinite(options.recoveryEndPhase, 0.82),
    powerEndPhase + 0.08,
    0.95,
  );
  const overshootPhase = clamp(
    toFinite(options.overshootPhase, 0.92),
    recoveryEndPhase + 0.015,
    0.99,
  );
  const preloadDepth = clamp(toFinite(options.preloadDepth, 0.18), 0, 0.7);
  const overshootAmplitude = clamp(toFinite(options.overshootAmplitude, 0.14), 0, 0.45);

  if (phase01 < preloadPhase) {
    const t = easeInCubic(remapUnit(phase01, 0, preloadPhase));
    return lerp(0, -preloadDepth, t);
  }
  if (phase01 < powerEndPhase) {
    const t = easeInOutCubic(remapUnit(phase01, preloadPhase, powerEndPhase));
    return lerp(-preloadDepth, 1, t);
  }
  if (phase01 < recoveryEndPhase) {
    const t = easeOutCubic(remapUnit(phase01, powerEndPhase, recoveryEndPhase));
    return lerp(1, 0, t);
  }
  if (phase01 < overshootPhase) {
    const t = easeInOutCubic(remapUnit(phase01, recoveryEndPhase, overshootPhase));
    return lerp(0, overshootAmplitude, t);
  }
  const t = easeOutCubic(remapUnit(phase01, overshootPhase, 1));
  return lerp(overshootAmplitude, 0, t);
}

export function computeTurnBiasedPectoralRates({
  baseRate = 0,
  turnRate = 0,
  turnThreshold = 0.002,
  turnRateReference = 0.08,
  driveRateBoost = 1.4,
  opposingRateMin = 0.45,
} = {}) {
  const base = Math.max(0, toFinite(baseRate, 0));
  const threshold = Math.max(0, toFinite(turnThreshold, 0.002));
  const turn = toFinite(turnRate, 0);
  const turnAbs = Math.abs(turn);
  if (turnAbs <= threshold) {
    return {
      rateL: base,
      rateR: base,
      turnBlend: 0,
      driveSide: 0,
    };
  }

  const turnRef = Math.max(threshold + 1e-6, toFinite(turnRateReference, 0.08));
  const blend = clamp((turnAbs - threshold) / Math.max(1e-6, turnRef - threshold), 0, 1);
  const driveBoost = clamp(toFinite(driveRateBoost, 1.4), 0, 4);
  const opposingMin = clamp(toFinite(opposingRateMin, 0.45), 0.05, 1);

  const driveRate = base * (1 + blend * driveBoost);
  const opposeRate = base * (1 - blend * (1 - opposingMin));
  if (turn > 0) {
    return {
      rateL: opposeRate,
      rateR: driveRate,
      turnBlend: blend,
      driveSide: 1,
    };
  }
  return {
    rateL: driveRate,
    rateR: opposeRate,
    turnBlend: blend,
    driveSide: -1,
  };
}

export function applyShoulderPivotInto(
  headX,
  headY,
  headingBefore,
  headingAfter,
  pivotOffset,
  out = null,
) {
  const px = headX - Math.cos(headingBefore) * pivotOffset;
  const py = headY - Math.sin(headingBefore) * pivotOffset;
  const x = px + Math.cos(headingAfter) * pivotOffset;
  const y = py + Math.sin(headingAfter) * pivotOffset;
  if (out) {
    out.x = x;
    out.y = y;
    if (out.pivot) {
      out.pivot.x = px;
      out.pivot.y = py;
    }
    return out;
  }
  return { x, y, pivot: { x: px, y: py } };
}

export function applyShoulderPivot({
  headPosition,
  headingBefore,
  headingAfter,
  pivotOffset,
}, out = null) {
  return applyShoulderPivotInto(
    headPosition.x,
    headPosition.y,
    headingBefore,
    headingAfter,
    pivotOffset,
    out,
  );
}

export function computeCTurnEnvelope(progress) {
  const p = clamp(progress, 0, 1);
  // [수정] C-턴 각도 및 임팩트 상향 (Phase 6.1)
  // snap(가장 강력한 회전) 구간을 전체의 20%~70%까지 확장
  if (p < 0.2) {
    const u = p / 0.2;
    return {
      phase: 'prepare',
      turnGain: 0.35 - u * 0.15,
      counterBend: 0.6 + u * 0.6,
      thrustGain: 0.12 + u * 0.13,
      waveGain: 0.25 + u * 0.33,
      dragGain: 0.98 + u * 0.05,
      snapPower: 0,
    };
  }
  if (p < 0.7) {
    const u = (p - 0.2) / 0.5;
    return {
      phase: 'snap',
      turnGain: 1.6 - u * 0.4, // 회전 가중치 대폭 상향
      counterBend: 1.5 - u * 0.5,
      thrustGain: 2.8 - u * 0.8, // 추진력 상향
      waveGain: 1.6 - u * 0.5,
      dragGain: 0.75 - u * 0.06,
      snapPower: Math.sin(u * Math.PI),
    };
  }
  const u = (p - 0.7) / 0.3;
  return {
    phase: 'recover',
    turnGain: 0.45 - u * 0.35,
    counterBend: 0.5 - u * 0.5,
    thrustGain: 1.05 - u * 0.65,
    waveGain: 0.55 - u * 0.55,
    dragGain: 0.88 + u * 0.1,
    snapPower: 0,
  };
}

export function suppressBackwardSlip({
  velocity,
  heading,
  minForward = -0.002,
  recoverRate = 0.8,
  maxRecover = 0.03,
  minDrive = 0,
}) {
  const fx = Math.cos(heading);
  const fy = Math.sin(heading);
  let vx = velocity.x;
  let vy = velocity.y;

  let forward = vx * fx + vy * fy;
  let applied = 0;
  if (forward < minForward) {
    const recover = Math.min(maxRecover, (minForward - forward) * recoverRate);
    vx += fx * recover;
    vy += fy * recover;
    applied += recover;
    forward = vx * fx + vy * fy;
  }

  if (minDrive > 0 && forward < minDrive) {
    const boost = minDrive - forward;
    vx += fx * boost;
    vy += fy * boost;
    applied += boost;
    forward = vx * fx + vy * fy;
  }

  return { x: vx, y: vy, forward, applied };
}
