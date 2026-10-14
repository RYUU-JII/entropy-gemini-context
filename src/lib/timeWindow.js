export function normalizeTimeWindowTimestamp(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    const fallbackNumeric = Number(fallback);
    return Number.isFinite(fallbackNumeric) && fallbackNumeric >= 0
      ? Math.floor(fallbackNumeric)
      : 0;
  }
  return Math.floor(numeric);
}

export function resolveTimeWindowUntil(now = Date.now(), durationMs = 0) {
  const normalizedNow = normalizeTimeWindowTimestamp(now, Date.now());
  const normalizedDurationMs = normalizeTimeWindowTimestamp(durationMs, 0);
  return normalizedNow + normalizedDurationMs;
}

export function isTimeWindowActive(until, now = Date.now()) {
  return normalizeTimeWindowTimestamp(until) > normalizeTimeWindowTimestamp(now, Date.now());
}

export function getTimeWindowRemainingMs(until, now = Date.now()) {
  return Math.max(
    0,
    normalizeTimeWindowTimestamp(until) - normalizeTimeWindowTimestamp(now, Date.now()),
  );
}

export function extendTimeWindowUntil(currentUntil, now = Date.now(), durationMs = 0) {
  return Math.max(
    normalizeTimeWindowTimestamp(currentUntil),
    resolveTimeWindowUntil(now, durationMs),
  );
}
