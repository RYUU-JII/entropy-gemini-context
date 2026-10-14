import ClseSettingsQueryService from '../../platform/storage/clse/ClseSettingsQueryService.js';
import { CLSE_CONSTANTS } from './clseSchema.js';

export const CLSE_ALERT_COOLDOWN_KEY = 'clse_alert_cooldown_ms';
export const CLSE_ALERT_COOLDOWN_DEFAULT_MS = CLSE_CONSTANTS.ALERT_COOLDOWN_DEFAULT_MS;
export const CLSE_ALERT_COOLDOWN_MIN_MS = CLSE_CONSTANTS.ALERT_COOLDOWN_MIN_MS;
export const CLSE_ALERT_COOLDOWN_MAX_MS = CLSE_CONSTANTS.ALERT_COOLDOWN_MAX_MS;
export const CLSE_SENSITIVITY_SCALE_MIN = CLSE_CONSTANTS.SENSITIVITY_SCALE_MIN;
export const CLSE_SENSITIVITY_SCALE_MAX = CLSE_CONSTANTS.SENSITIVITY_SCALE_MAX;

export const CLSE_SETTINGS_DEFAULTS = Object.freeze({
  [CLSE_CONSTANTS.FEATURE_FLAG_KEY]: false,
  [CLSE_CONSTANTS.SENSITIVITY_SCALE_KEY]: CLSE_CONSTANTS.SENSITIVITY_SCALE_DEFAULT || 1,
  [CLSE_ALERT_COOLDOWN_KEY]: CLSE_ALERT_COOLDOWN_DEFAULT_MS,
});

const clseSettingsQueryService = ClseSettingsQueryService.getInstance();

export function normalizeCLSEAlertCooldown(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return CLSE_ALERT_COOLDOWN_DEFAULT_MS;
  return Math.min(CLSE_ALERT_COOLDOWN_MAX_MS, Math.max(CLSE_ALERT_COOLDOWN_MIN_MS, Math.round(numeric)));
}

export function normalizeCLSESensitivityScale(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return CLSE_CONSTANTS.SENSITIVITY_SCALE_DEFAULT || 1;
  return Math.min(CLSE_SENSITIVITY_SCALE_MAX, Math.max(CLSE_SENSITIVITY_SCALE_MIN, numeric));
}

export async function readCLSESettingsSnapshot({
  readSettings = (defaults) => clseSettingsQueryService.getSnapshot(defaults),
} = {}) {
  const reader = typeof readSettings === 'function'
    ? readSettings
    : (defaults) => clseSettingsQueryService.getSnapshot(defaults);
  return reader(CLSE_SETTINGS_DEFAULTS);
}
