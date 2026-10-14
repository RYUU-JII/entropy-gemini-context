import { tRuntime } from '../../settings/i18n/runtime.js';

function pad2(value) {
  return String(Math.max(0, Math.floor(Number(value) || 0))).padStart(2, '0');
}

export function formatNextEligibleHint(nextEligibleAtMs, now = Date.now()) {
  const ts = Number(nextEligibleAtMs);
  if (!Number.isFinite(ts) || ts <= 0) return '';

  const diffMs = ts - now;
  if (diffMs <= 0) return tRuntime('common:indicator.time.now_available');

  const diffMinutes = Math.ceil(diffMs / 60000);
  if (diffMinutes < 60) {
    return tRuntime('common:indicator.time.in_minutes', { count: diffMinutes });
  }

  const target = new Date(ts);
  const nowDate = new Date(now);
  const isSameDay = target.getFullYear() === nowDate.getFullYear()
    && target.getMonth() === nowDate.getMonth()
    && target.getDate() === nowDate.getDate();

  if (isSameDay) {
    return tRuntime(
      'common:indicator.time.today_at',
      { time: `${pad2(target.getHours())}:${pad2(target.getMinutes())}` }
    );
  }

  return tRuntime(
    'common:indicator.time.date_at',
    {
      date: `${pad2(target.getMonth() + 1)}/${pad2(target.getDate())}`,
      time: `${pad2(target.getHours())}:${pad2(target.getMinutes())}`,
    }
  );
}
