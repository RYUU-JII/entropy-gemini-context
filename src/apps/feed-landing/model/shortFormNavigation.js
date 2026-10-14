export const SHORT_FORM_WHEEL_QUIET_MS = 180;
export const SHORT_FORM_SETTLE_MS = 520;
const WHEEL_THRESHOLD = 48;

export function advanceShortFormSession(session, index, lastIndex) {
  if (![index, lastIndex, session.index, session.deepest].every(Number.isInteger)
    || lastIndex < 1 || index < 0 || index > lastIndex || session.index < 0
    || session.index > lastIndex || session.deepest < session.index || session.deepest > lastIndex) {
    throw new Error('SHORT_FORM_SESSION_INVALID');
  }
  if (session.index === index) return session;
  return Object.freeze({ index, deepest: Math.max(session.deepest, index) });
}

/** One decision per wheel burst; momentum cannot repeatedly spin the reel. */
export function createShortFormWheelController() {
  let lastAt = -Infinity;
  let notBefore = -Infinity;
  let sum = 0;
  let consumed = false;
  let blocked = false;
  return Object.freeze({
    observe(delta, now) {
      if (!Number.isFinite(delta) || !Number.isFinite(now)) throw new Error('SHORT_FORM_WHEEL_INVALID');
      if (now - lastAt > SHORT_FORM_WHEEL_QUIET_MS) {
        sum = 0; consumed = false; blocked = now < notBefore;
      }
      lastAt = now;
      if (blocked || consumed) return 0;
      if (Math.sign(delta) !== Math.sign(sum)) sum = 0;
      sum += delta;
      if (Math.abs(sum) < WHEEL_THRESHOLD) return 0;
      consumed = true;
      notBefore = now + SHORT_FORM_SETTLE_MS;
      return Math.sign(sum);
    },
  });
}
