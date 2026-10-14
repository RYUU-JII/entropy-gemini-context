export const DASHBOARD_APPEARANCE_CLOCK_MODES = Object.freeze({
  REALTIME: 'realtime',
  CUSTOM: 'custom',
});

export const DASHBOARD_APPEARANCE_TIME_STEP_MINUTES = 10;
export const DASHBOARD_APPEARANCE_TIME_MAX_MINUTES = (
  (24 * 60) - DASHBOARD_APPEARANCE_TIME_STEP_MINUTES
);
export const DEFAULT_DASHBOARD_APPEARANCE_HOUR = 12;

export function requireDashboardAppearanceClockMode(mode) {
  if (mode === DASHBOARD_APPEARANCE_CLOCK_MODES.REALTIME
    || mode === DASHBOARD_APPEARANCE_CLOCK_MODES.CUSTOM) {
    return mode;
  }
  throw new Error(`DASHBOARD_APPEARANCE_CLOCK_MODE_INVALID:${String(mode)}`);
}

export function normalizeDashboardAppearanceHour(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('DASHBOARD_APPEARANCE_HOUR_INVALID');
  }
  const snappedMinutes = Math.round(
    value * 60 / DASHBOARD_APPEARANCE_TIME_STEP_MINUTES,
  ) * DASHBOARD_APPEARANCE_TIME_STEP_MINUTES;
  const boundedMinutes = Math.max(
    0,
    Math.min(DASHBOARD_APPEARANCE_TIME_MAX_MINUTES, snappedMinutes),
  );
  return boundedMinutes / 60;
}

export function resolveDashboardAppearanceEpochMs({
  mode,
  realtimeEpochMs,
  customHour,
  solarLocationProfile = null,
}) {
  const resolvedMode = requireDashboardAppearanceClockMode(mode);
  if (typeof realtimeEpochMs !== 'number' || !Number.isFinite(realtimeEpochMs)) {
    throw new Error('DASHBOARD_APPEARANCE_REALTIME_EPOCH_INVALID');
  }
  if (resolvedMode === DASHBOARD_APPEARANCE_CLOCK_MODES.REALTIME) {
    return realtimeEpochMs;
  }

  const resolvedHour = normalizeDashboardAppearanceHour(customHour);
  const coordinates = resolveSolarCoordinatesFromProfile(solarLocationProfile);
  return resolveZenLocalHourEpochMs({
    timestampMs: realtimeEpochMs,
    hour: resolvedHour,
    timeZone: coordinates.timezone,
  });
}
import { resolveSolarCoordinatesFromProfile } from '@/domains/settings/config/solarLocation.js';
import { resolveZenLocalHourEpochMs } from '@/themes/plugins/zen/api/environment.js';
