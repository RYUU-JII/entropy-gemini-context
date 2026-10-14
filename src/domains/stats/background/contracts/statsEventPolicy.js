export const STATS_COMMIT_EVENT_MIN_INTERVAL_MS = 12_000;

export function shouldEmitStatsCommittedEvent({
  dateStr,
  force = false,
  now = Date.now(),
  lastDateStr = null,
  lastEmittedAt = 0,
  minIntervalMs = STATS_COMMIT_EVENT_MIN_INTERVAL_MS,
} = {}) {
  if (force) return true;
  if (typeof dateStr !== 'string' || !dateStr.trim()) return false;

  if (dateStr !== lastDateStr) return true;

  const currentTs = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  const lastTs = Number.isFinite(Number(lastEmittedAt)) ? Number(lastEmittedAt) : 0;
  const minInterval = Number.isFinite(Number(minIntervalMs))
    ? Math.max(0, Math.floor(Number(minIntervalMs)))
    : STATS_COMMIT_EVENT_MIN_INTERVAL_MS;

  return currentTs - lastTs >= minInterval;
}

