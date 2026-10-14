export const INSTALLATION_PRESENTATION_ID = 'furin_installation';
export const INSTALLATION_PRESENTATION_DURATION_MS = 9000;

export const INSTALLATION_PRESENTATION_SHOTS = Object.freeze([
  Object.freeze({ id: 'prepare', startMs: 0, endMs: 1200 }),
  Object.freeze({ id: 'hang', startMs: 1200, endMs: 3500 }),
  Object.freeze({ id: 'quiet', startMs: 3500, endMs: 5000 }),
  Object.freeze({ id: 'chime', startMs: 5000, endMs: 7200 }),
  Object.freeze({ id: 'return', startMs: 7200, endMs: 9000 }),
]);

const ease = value => value * value * (3 - 2 * value);
const interval = (time, start, end) => ease(Math.max(0, Math.min(1, (time - start) / (end - start))));

export function buildInstallationPresentationFrame(elapsedMs, reducedMotion = false) {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0 || typeof reducedMotion !== 'boolean') {
    throw new Error('installation_presentation_frame_invalid');
  }
  const time = reducedMotion ? INSTALLATION_PRESENTATION_DURATION_MS
    : Math.min(elapsedMs, INSTALLATION_PRESENTATION_DURATION_MS);
  const shot = INSTALLATION_PRESENTATION_SHOTS.find(candidate => time < candidate.endMs)
    ?? INSTALLATION_PRESENTATION_SHOTS.at(-1);
  return Object.freeze({
    elapsedMs: time,
    phase: shot.id,
    reducedMotion,
    focus: interval(time, 0, 1200),
    installed: interval(time, 1200, 3500),
    response: interval(time, 5000, 7200),
    returning: interval(time, 7200, 9000),
  });
}

export function assertInstallationPresentationInput(installation) {
  if (!installation || !Number.isFinite(installation.globalGoalMinutes)
    || installation.globalGoalMinutes <= 0) {
    throw new Error('installation_presentation_global_goal_required');
  }
  return installation;
}
