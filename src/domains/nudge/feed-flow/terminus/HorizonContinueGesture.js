// A Horizon encounter creates a pause; it does not authorize the input that
// reached it to open Enso. This owner groups physical input, without a timer or
// any authority over consumption cadence, endpoint placement or admission.
export const HORIZON_WHEEL_QUIET_MS = 350;

export default class HorizonContinueGesture {
  constructor() { this.reset(); }

  reset(now = 0) {
    this._notBefore = now;
    this._lastWheelAt = now;
    this._pointerGestureId = null;
    this._key = null;
    this._kind = null;
    this._accepted = false;
  }

  observe(input, now, { enabled, readyAt }) {
    if (!input || !['wheel', 'key', 'pointer'].includes(input.kind)
      || !Number.isFinite(now) || !Number.isFinite(readyAt)) {
      throw new Error('HORIZON_CONTINUE_INPUT_INVALID');
    }
    if (this._kind !== input.kind) this._accepted = false;
    this._kind = input.kind;
    let newGesture = false;
    let startedAt = now;
    if (input.kind === 'wheel') {
      // WheelEvent has no portable gesture-end/momentum phase. Silence is a
      // conservative event-burst boundary, not proof of conscious intention.
      newGesture = now - this._lastWheelAt >= HORIZON_WHEEL_QUIET_MS;
      this._lastWheelAt = now;
    } else if (input.kind === 'key') {
      if (typeof input.key !== 'string' || typeof input.repeat !== 'boolean') {
        throw new Error('HORIZON_CONTINUE_KEY_INVALID');
      }
      if (this._key !== input.key) this._accepted = false;
      this._key = input.key;
      newGesture = !input.repeat;
    } else {
      if (!Number.isSafeInteger(input.gestureId) || input.gestureId <= 0
        || !Number.isFinite(input.startedAt) || input.startedAt > now) {
        throw new Error('HORIZON_CONTINUE_POINTER_INVALID');
      }
      newGesture = this._pointerGestureId !== input.gestureId;
      this._pointerGestureId = input.gestureId;
      startedAt = input.startedAt;
    }
    if (newGesture) {
      this._accepted = enabled === true && startedAt > Math.max(readyAt, this._notBefore);
    }
    if (!enabled) this._accepted = false;
    return { accepted: this._accepted, newGesture };
  }
}
