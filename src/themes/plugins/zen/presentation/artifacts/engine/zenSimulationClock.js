// A seekable presentation clock for the comparison renderer. Business events
// remain with the widget/controller. Repeated draws do not advance physics.
export function createZenSimulationClock({ createState, step, simHz = 60 }) {
  let state = createState();
  let ticks = 0;
  const stepMs = 1000 / simHz;
  return {
    at(atMs) {
      if (!Number.isFinite(atMs) || atMs < 0 || atMs > 3_600_000) throw new Error('ZEN_ARTIFACT_SIMULATION_TIME_INVALID');
      const target = Math.floor((atMs + 0.000001) / stepMs);
      if (target < ticks) { state = createState(); ticks = 0; }
      while (ticks < target) {
        ticks += 1;
        step(state, stepMs, ticks * stepMs);
      }
      return state;
    },
  };
}
