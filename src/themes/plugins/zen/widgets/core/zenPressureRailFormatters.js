const MINUTE_MS = 60_000;

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, toNumber(value)));
}

export function resolveZenPressureText(t, key, options = {}, fallback = '') {
  if (!t) return fallback;
  const value = t(key, options);
  return typeof value === 'string' && value && value !== key ? value : fallback;
}

export function formatZenPressureDuration(ms, t) {
  const totalMinutes = Math.max(0, Math.round(toNumber(ms) / MINUTE_MS));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const hourLabel = resolveZenPressureText(t, 'units.hour_abbr', {}, 'h');
  const minuteLabel = resolveZenPressureText(t, 'units.minute_short', {}, 'm');
  if (hours <= 0) return `${minutes}${minuteLabel}`;
  if (minutes <= 0) return `${hours}${hourLabel}`;
  return `${hours}${hourLabel} ${minutes}${minuteLabel}`;
}

export function formatZenPressurePercent(value) {
  const percent = clamp01(value) * 100;
  if (percent > 0 && percent < 0.1) return '<0.1%';
  return `${percent < 1 ? Number(percent.toFixed(1)) : Math.round(percent)}%`;
}
