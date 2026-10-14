import { ZEN_FURIN_GEOMETRY as g, ZEN_FURIN_CONTACT_ANGLE } from './zenFurinGeometry.js';

const RAD = Math.PI / 180;
const STEP_MS = 1000 / 240;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
// Three generalized angles: a heavy bell, short clapper, and suspended paper.
// Rigid lengths are exact by construction; no iterative length corrections.
const arms = [
  [g.bellCenterY, 0, 0],
  [g.strikerPivotY, g.strikerCenterY, 0],
  [g.strikerPivotY, g.strikerLength, g.paperCordLength + g.paperHeight / 2],
];

export function createFurinPhysicsState() {
  return {
    bell: { pos: 0, vel: 0 }, striker: { pos: 0, vel: 0 },
    paper: { pos: 0, vel: 0, yaw: 0, yawVel: 0, skew: 0, skewVel: 0 },
    shimmer: 0, simTimeMs: 0, remainderMs: 0,
    lastImpactAt: null, lastImpactSide: 0, lastImpactStrength: 0,
    impactCount: 0, contactState: 0,
  };
}

// Symmetric positive definite 3x3 solve. The bell and paper retain their body
// inertia in addition to COM translation, so the chain is never singular.
function solve(m, b) {
  const l00 = Math.sqrt(m[0][0]);
  const l10 = m[1][0] / l00, l20 = m[2][0] / l00;
  const l11 = Math.sqrt(m[1][1] - l10 * l10);
  const l21 = (m[2][1] - l20 * l10) / l11;
  const l22 = Math.sqrt(m[2][2] - l20 * l20 - l21 * l21);
  const y0 = b[0] / l00, y1 = (b[1] - l10 * y0) / l11;
  const y2 = (b[2] - l20 * y0 - l21 * y1) / l22;
  const x2 = y2 / l22, x1 = (y1 - l21 * x2) / l11;
  return [(y0 - l10 * x1 - l20 * x2) / l00, x1, x2];
}

function integrate(state, recipe, wind, onImpact) {
  const dt = STEP_MS / 1000;
  const joints = [state.bell, state.striker, state.paper];
  const q = joints.map(j => j.pos * RAD), v = joints.map(j => j.vel * RAD);
  const masses = [recipe.mBell, recipe.mStriker, recipe.mPaper];
  const damping = [recipe.dampBell, recipe.dampStriker, recipe.dampPaper];
  const mass = Array.from({ length: 3 }, () => [0, 0, 0]);
  const force = [0, 0, 0];
  // The paper receives most wind drag. Tension transmits that load through the
  // shared mass matrix; no synthetic clapper kick or angular-speed multiplier.
  const windArea = [0.06, 0.005, 1];
  for (let body = 0; body < 3; body += 1) {
    const lengths = arms[body], m = masses[body];
    const dx = lengths.map((l, i) => -l * Math.cos(q[i]));
    const dy = lengths.map((l, i) => -l * Math.sin(q[i]));
    const biasX = lengths.reduce((sum, l, i) => sum + l * Math.sin(q[i]) * v[i] ** 2, 0);
    const biasY = lengths.reduce((sum, l, i) => sum - l * Math.cos(q[i]) * v[i] ** 2, 0);
    const velocityX = dx.reduce((sum, length, i) => sum + length * v[i], 0);
    const relativeAir = wind * 100 - velocityX;
    const projectedArea = body === 2
      ? 0.18 + 0.82 * Math.abs(Math.cos(q[2]) * Math.cos(state.paper.yaw * RAD))
      : 1;
    const drag = relativeAir * Math.abs(relativeAir) * 0.012 * windArea[body] * projectedArea;
    const fx = drag - m * biasX;
    const fy = m * (recipe.gravity - biasY);
    for (let i = 0; i < 3; i += 1) {
      force[i] += dx[i] * fx + dy[i] * fy;
      for (let j = 0; j < 3; j += 1) mass[i][j] += m * (dx[i] * dx[j] + dy[i] * dy[j]);
    }
  }
  // Effective shell bounds and the distributed rod share the drawn geometry.
  mass[0][0] += masses[0] * (g.bellBodyWidth ** 2 + g.bellBodyHeight ** 2) / 12;
  mass[1][1] += masses[1] * g.strikerRodLength ** 2 / 12;
  mass[2][2] += masses[2] * g.paperHeight ** 2 / 12;
  // Damping is a per-second coefficient, independent of frame/input cadence.
  for (let i = 0; i < 3; i += 1) force[i] -= damping[i] * mass[i][i] * v[i];
  const acceleration = solve(mass, force);
  for (let i = 0; i < 3; i += 1) { v[i] += acceleration[i] * dt; q[i] += v[i] * dt; }

  state.contactState = 0;
  const relative = q[1] - q[0];
  if (Math.abs(relative) > ZEN_FURIN_CONTACT_ANGLE) {
    const side = Math.sign(relative);
    const normal = [-side, side, 0];
    const inverseNormal = solve(mass, normal);
    const effectiveInverseMass = inverseNormal[1] * side - inverseNormal[0] * side;
    const penetration = Math.abs(relative) - ZEN_FURIN_CONTACT_ANGLE;
    const speed = (v[1] - v[0]) * side;
    for (let i = 0; i < 3; i += 1) {
      q[i] -= inverseNormal[i] * penetration / effectiveInverseMass;
      if (speed > 0) v[i] -= inverseNormal[i] * speed * (1 + recipe.restitution) / effectiveInverseMass;
    }
    state.contactState = side;
    // Resting contact is silent. A real inward impact exchanges momentum and
    // may sound; the cue debounce never changes the contact solution.
    // Horizontal speed of the rod surface at rim height, in stage units/s.
    const normalSpeed = speed * (g.bellRimY - g.strikerPivotY);
    if (normalSpeed > recipe.impactMinSpeed && (state.lastImpactAt === null
      || state.simTimeMs - state.lastImpactAt >= recipe.impactCooldownMs)) {
      state.lastImpactAt = state.simTimeMs;
      state.lastImpactSide = side;
      state.lastImpactStrength = Math.min(1, 0.12 + (normalSpeed - recipe.impactMinSpeed) / 65);
      state.impactCount += 1;
      state.shimmer = state.lastImpactStrength * 0.55;
      onImpact?.({ speed, normalSpeed, strength: state.lastImpactStrength, side, atMs: state.simTimeMs });
    }
  }
  for (let i = 0; i < 3; i += 1) { joints[i].pos = q[i] / RAD; joints[i].vel = v[i] / RAD; }

  // Two damped material responses, driven by wind/load, never by an unrelated
  // clock sine. Yaw foreshortens the leaf; flex curves it from a fixed top tie.
  const paper = state.paper;
  const yawTarget = clamp(wind * 32, -65, 65);
  paper.yawVel += ((yawTarget - paper.yaw) * 16 - paper.yawVel * 6) * dt;
  paper.yaw += paper.yawVel * dt;
  const flexTarget = clamp(wind * 3.2 - paper.vel * 0.025, -7, 7);
  paper.skewVel += ((flexTarget - paper.skew) * 18 - paper.skewVel * 6.5) * dt;
  paper.skew += paper.skewVel * dt;
  state.shimmer *= Math.exp(-7 * dt);
}

export function advanceFurinPhysics({ state, simStepMs, recipe, windAt, windInput = 0, onImpact }) {
  if (!Number.isFinite(simStepMs) || simStepMs < 0 || simStepMs > 250 || !Number.isFinite(windInput)) {
    throw new Error('ZEN_FURIN_PHYSICS_INPUT_INVALID');
  }
  state.remainderMs += simStepMs;
  while (state.remainderMs + 1e-8 >= STEP_MS) {
    state.remainderMs -= STEP_MS;
    state.simTimeMs += STEP_MS;
    integrate(state, recipe, clamp(windAt(state.simTimeMs) + windInput, -2, 2), onImpact);
  }
}
