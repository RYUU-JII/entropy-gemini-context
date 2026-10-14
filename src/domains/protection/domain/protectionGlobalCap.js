import { getLocalDateStr } from '../../../lib/time.js';

function normalizeNow(now) {
  const numeric = Number(now);
  return Number.isFinite(numeric) ? numeric : Date.now();
}

function normalizeMinutes(value) {
  const numeric = Math.floor(Number(value));
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}

function normalizeMs(value) {
  const numeric = Math.floor(Number(value));
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}

export function evaluateProtectionGlobalCapState({
  globalGoalMin = 0,
  blockedTodayMs = 0,
  now = Date.now(),
  dateStr = null,
} = {}) {
  const resolvedNow = normalizeNow(now);
  const resolvedGlobalGoalMin = normalizeMinutes(globalGoalMin);
  const resolvedBlockedTodayMs = normalizeMs(blockedTodayMs);
  const globalGoalMs = resolvedGlobalGoalMin * 60_000;
  const resolvedDateStr = typeof dateStr === 'string' && dateStr.trim()
    ? dateStr.trim()
    : getLocalDateStr(resolvedNow);

  return {
    globalGoalMin: resolvedGlobalGoalMin,
    globalGoalMs,
    blockedTodayMs: resolvedBlockedTodayMs,
    exceeded: globalGoalMs > 0 && resolvedBlockedTodayMs >= globalGoalMs,
    dateStr: resolvedDateStr,
  };
}
