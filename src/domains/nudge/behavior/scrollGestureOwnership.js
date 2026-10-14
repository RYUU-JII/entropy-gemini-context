export const SCROLL_GESTURE_POLICY = Object.freeze({
  leaseMs: 140,
  axisLockRatio: 2.2,
  axisLockMinDeltaPx: 2,
  axisSwitchDeltaPx: 8,
});

function assertFiniteNumber(value, code) {
  if (!Number.isFinite(value)) throw new Error(code);
}

function assertPolicy(policy) {
  if (policy === SCROLL_GESTURE_POLICY) return;
  if (!policy || typeof policy !== 'object') {
    throw new Error('SCROLL_GESTURE_POLICY_REQUIRED');
  }
  for (const [field, code] of [
    ['leaseMs', 'SCROLL_GESTURE_LEASE_INVALID'],
    ['axisLockRatio', 'SCROLL_GESTURE_AXIS_LOCK_RATIO_INVALID'],
    ['axisLockMinDeltaPx', 'SCROLL_GESTURE_AXIS_LOCK_MIN_DELTA_INVALID'],
    ['axisSwitchDeltaPx', 'SCROLL_GESTURE_AXIS_SWITCH_DELTA_INVALID'],
  ]) {
    assertFiniteNumber(policy[field], code);
    if (policy[field] <= 0) throw new Error(code);
  }
}

function assertState(state) {
  if (!state || typeof state !== 'object' || !state.x || !state.y) {
    throw new Error('SCROLL_GESTURE_STATE_INVALID');
  }
}

export function createScrollGestureOwnershipState() {
  return {
    lastInputAt: null,
    lockedAxis: null,
    x: { target: null, lastInputAt: null },
    y: { target: null, lastInputAt: null },
  };
}

export function resetScrollGestureOwnershipState(state) {
  assertState(state);
  state.lastInputAt = null;
  state.lockedAxis = null;
  state.x.target = null;
  state.x.lastInputAt = null;
  state.y.target = null;
  state.y.lastInputAt = null;
  return state;
}

export function allowsScrollBoundaryHandoff(overscrollBehavior) {
  if (typeof overscrollBehavior !== 'string') {
    throw new Error('SCROLL_GESTURE_OVERSCROLL_BEHAVIOR_INVALID');
  }
  const behavior = overscrollBehavior.trim() || 'auto';
  if (behavior === 'auto') return true;
  if (behavior === 'contain' || behavior === 'none') return false;
  throw new Error('SCROLL_GESTURE_OVERSCROLL_BEHAVIOR_INVALID');
}

export function resolveScrollGestureInput(
  state,
  deltaX,
  deltaY,
  now,
  policy = SCROLL_GESTURE_POLICY,
) {
  assertState(state);
  assertPolicy(policy);
  assertFiniteNumber(deltaX, 'SCROLL_GESTURE_DELTA_X_INVALID');
  assertFiniteNumber(deltaY, 'SCROLL_GESTURE_DELTA_Y_INVALID');
  assertFiniteNumber(now, 'SCROLL_GESTURE_TIME_INVALID');

  const newGesture = !Number.isFinite(state.lastInputAt)
    || (now - state.lastInputAt) > policy.leaseMs;
  if (newGesture) resetScrollGestureOwnershipState(state);
  state.lastInputAt = now;

  const absoluteX = Math.abs(deltaX);
  const absoluteY = Math.abs(deltaY);
  const major = Math.max(absoluteX, absoluteY);
  const minor = Math.min(absoluteX, absoluteY);
  let lockedAxis = state.lockedAxis;
  if (!lockedAxis && major >= policy.axisLockMinDeltaPx && minor > 0) {
    if (major / minor >= policy.axisLockRatio) {
      lockedAxis = absoluteX > absoluteY ? 'x' : 'y';
      state.lockedAxis = lockedAxis;
    }
  }

  if (
    lockedAxis === 'x'
    && absoluteX < policy.axisLockMinDeltaPx
    && absoluteY >= policy.axisSwitchDeltaPx
  ) {
    lockedAxis = 'y';
    state.lockedAxis = lockedAxis;
  } else if (
    lockedAxis === 'y'
    && absoluteY < policy.axisLockMinDeltaPx
    && absoluteX >= policy.axisSwitchDeltaPx
  ) {
    lockedAxis = 'x';
    state.lockedAxis = lockedAxis;
  }

  return {
    deltaX: lockedAxis === 'y' ? 0 : deltaX,
    deltaY: lockedAxis === 'x' ? 0 : deltaY,
    lockedAxis,
    newGesture,
  };
}

export function isScrollGestureAxisLeaseActive(
  state,
  axis,
  now,
  targetConnected,
  policy = SCROLL_GESTURE_POLICY,
) {
  assertState(state);
  assertPolicy(policy);
  assertFiniteNumber(now, 'SCROLL_GESTURE_TIME_INVALID');
  if (axis !== 'x' && axis !== 'y') throw new Error('SCROLL_GESTURE_AXIS_INVALID');
  const lease = state[axis];
  return !!(
    lease.target
    && targetConnected === true
    && Number.isFinite(lease.lastInputAt)
    && (now - lease.lastInputAt) <= policy.leaseMs
  );
}
