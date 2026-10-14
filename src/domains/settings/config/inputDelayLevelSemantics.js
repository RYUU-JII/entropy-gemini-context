export const INPUT_DELAY_LEVEL_VALUES_MS = Object.freeze({
  1: 320,
  2: 760,
  3: 1200,
});

export function clampInputDelayLevel(value, fallback = 1) {
  const numeric = Math.round(Number(value));
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.min(3, numeric));
}

export function resolveInputDelayLevel(value, fallback = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return clampInputDelayLevel(fallback, 1);
  return Object.entries(INPUT_DELAY_LEVEL_VALUES_MS).reduce((bestLevel, [levelKey, ms]) => {
    const currentGap = Math.abs(numeric - Number(ms));
    const bestGap = Math.abs(numeric - INPUT_DELAY_LEVEL_VALUES_MS[bestLevel]);
    return currentGap < bestGap ? clampInputDelayLevel(levelKey, 1) : bestLevel;
  }, clampInputDelayLevel(fallback, 1));
}

export function resolveInputDelayMsForLevel(level) {
  return INPUT_DELAY_LEVEL_VALUES_MS[clampInputDelayLevel(level, 1)];
}

export function normalizeInputDelayMs(value, fallback = INPUT_DELAY_LEVEL_VALUES_MS[1]) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return Math.round(numeric);
}
