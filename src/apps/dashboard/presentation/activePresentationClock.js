// A transient clock for time actually admitted by a presentation surface.
// Callers use a monotonic timestamp; hidden/parked intervals never accumulate.
export function createActivePresentationClock(durationMs) {
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    throw new Error('ACTIVE_PRESENTATION_DURATION_INVALID');
  }
  let elapsedMs = 0;
  let activeAtMs = null;
  const requireTime = (atMs) => {
    if (!Number.isFinite(atMs) || atMs < 0) throw new Error('ACTIVE_PRESENTATION_CLOCK_INVALID');
    return atMs;
  };
  return Object.freeze({
    resume(atMs) {
      requireTime(atMs);
      if (activeAtMs === null) activeAtMs = atMs;
    },
    pause(atMs) {
      requireTime(atMs);
      if (activeAtMs !== null) {
        elapsedMs = Math.min(durationMs, elapsedMs + Math.max(0, atMs - activeAtMs));
        activeAtMs = null;
      }
    },
    remaining(atMs) {
      requireTime(atMs);
      return Math.max(0, durationMs - elapsedMs
        - (activeAtMs === null ? 0 : Math.max(0, atMs - activeAtMs)));
    },
  });
}
