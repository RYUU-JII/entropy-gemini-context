// Continuous gallery time is separate from seekable QA replay. No replay from
// zero after a material update, no one-hour limit, and bounded catch-up work.
export function createZenLiveSimulationClock(createState) {
  let state = createState();
  let last = null;
  let accumulated = 0;
  let ticks = 0;
  const stepMs = 1000 / 60;
  return {
    reset() { state = createState(); accumulated = 0; last = null; ticks = 0; },
    at(atMs, step, enabled) {
      if (!Number.isFinite(atMs) || atMs < 0) throw new Error('ZEN_ARTIFACT_LIVE_TIME_INVALID');
      const elapsed = last === null ? 0 : Math.max(0, Math.min(250, atMs - last));
      last = atMs;
      if (!enabled) { accumulated = 0; return state; }
      accumulated += elapsed;
      while (accumulated + 0.000001 >= stepMs) {
        accumulated -= stepMs;
        ticks += 1;
        step(state, stepMs, ticks * stepMs);
      }
      return state;
    },
  };
}
