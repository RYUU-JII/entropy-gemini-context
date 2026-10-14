import {
  getRuntimeId,
  runtimeSendMessage,
} from '../../../platform/chrome/ChromeService.js';
import { MESSAGE_ACTIONS } from '../../../platform/messaging/messageTypes.js';
import { tRuntime } from '../../settings/i18n/runtime.js';
import { isAdaptiveFrictionFeatureKey } from '../../settings/config/adaptiveFrictionProfiles.js';
import { faviconQueryService } from '../../../platform/storage/assets/FaviconQueryService.js';

const FILTER_LABEL_KEYS = Object.freeze({
  blur: 'common:indicator.filters.blur',
  saturation: 'common:indicator.filters.saturation',
  brightness: 'common:indicator.filters.brightness',
  contrast: 'common:indicator.filters.contrast',
  colorSaturation: 'common:indicator.filters.color_saturation',
  textRhythm: 'common:indicator.filters.text_rhythm',
  textShadow: 'common:indicator.filters.text_shadow',
  clickDelay: 'common:indicator.filters.click_delay',
  ensoGate: 'common:indicator.filters.enso_gate',
  scrollFriction: 'common:indicator.filters.scroll_friction',
  inputDelay: 'common:indicator.filters.input_delay',
  inputVisualBrake: 'common:indicator.filters.input_visual_brake',
  navigationButtonLock: 'common:indicator.filters.navigation_button_lock',
  socialMetrics: 'common:indicator.filters.social_metrics',
});

export function formatDurationParts(ms) {
  const totalMinutes = Math.floor(Math.max(0, ms) / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return { hours, minutes };
}

export function resolveLimitMinutes(policy = {}, info = {}) {
  const pickPositiveMinutes = (...values) => {
    for (const value of values) {
      const minutes = Math.floor(Number(value));
      if (Number.isFinite(minutes) && minutes > 0) return minutes;
    }
    return 0;
  };

  const siteGoalMinutes = pickPositiveMinutes(
    policy?.siteGoalMinutes,
    info?.siteGoalMinutes,
  );
  if (siteGoalMinutes > 0) return siteGoalMinutes;

  const referenceTargetMinutes = pickPositiveMinutes(
    policy?.referenceTargetMinutes,
    info?.referenceTargetMinutes,
  );
  if (referenceTargetMinutes > 0) return referenceTargetMinutes;
  return 0;
}

export function formatMinutesLabel(minutes) {
  const value = Math.floor(Number(minutes));
  if (!Number.isFinite(value) || value <= 0) {
    return tRuntime('common:indicator.tooltip.limit_none');
  }
  if (value < 60) {
    return tRuntime('common:indicator.tooltip.minutes_only', { minutes: value });
  }
  const parts = formatDurationParts(value * 60000);
  return tRuntime(
    'common:indicator.tooltip.hours_minutes',
    { hours: parts.hours, minutes: parts.minutes }
  );
}

export function buildFilterSummary(filters, shouldApply) {
  if (!filters || !shouldApply) return [];
  const items = [];
  const filterKeys = Object.keys(FILTER_LABEL_KEYS);
  const pushStep = (key) => {
    if (!filters[key]?.isActive) return;
    const label = tRuntime(FILTER_LABEL_KEYS[key]);
    if (isAdaptiveFrictionFeatureKey(key)) {
      const band = tRuntime(`common:friction_profiles.${filters[key].band}`);
      items.push(tRuntime('common:friction_profiles.label', { label, band }));
      return;
    }
    items.push(label);
  };
  filterKeys.forEach(pushStep);
  return items;
}

export function requestFaviconData(hostname) {
  return faviconQueryService.getDataUrl(hostname);
}

export function subscribeFaviconData(hostname, listener) {
  return faviconQueryService.subscribe(hostname, listener);
}

export function requestIndicatorInfo() {
  if (!getRuntimeId()) return Promise.resolve(null);
  return runtimeSendMessage({
    action: MESSAGE_ACTIONS.GET_FILTER_INDICATOR_INFO,
    url: location.href,
  }).then((resp) => (resp && resp.success ? resp : null));
}

export async function openIndicatorSiteRecord() {
  const response = await runtimeSendMessage({
    action: MESSAGE_ACTIONS.OPEN_SITE_RECORD,
    url: location.href,
  });
  if (response?.success !== true) {
    throw new Error(typeof response?.error === 'string' ? response.error : 'INDICATOR_SITE_RECORD_OPEN_FAILED');
  }
}
