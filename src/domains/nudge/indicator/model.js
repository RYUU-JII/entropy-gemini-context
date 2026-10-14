import {
  DEFAULT_INDICATOR_CONFIG,
  normalizeIndicatorConfig,
} from '../../settings/config/indicator.js';
import { tRuntime } from '../../settings/i18n/runtime.js';

const POLICY_REASON_LABEL_KEYS = Object.freeze({
  hard_block_window: 'common:indicator.reason.hard_block_window',
  global_cap_exceeded: 'common:indicator.reason.global_cap_exceeded',
  allowed_window: 'common:indicator.reason.allowed_window',
  managed_policy: 'common:indicator.reason.default',
  standard_clean_phase: 'common:indicator.reason.standard_clean_phase',
  standard_mud_phase: 'common:indicator.reason.standard_mud_phase',
  standard_wall_phase: 'common:indicator.reason.standard_wall_phase',
  filtered: 'common:indicator.reason.filtered',
  video_alert: 'common:indicator.reason.video_alert',
});

export const DEFAULT_VIDEO_STATE = Object.freeze({
  enabled: false,
  visible: false,
  hasVideo: false,
  isPlaying: false,
  mode: 'hard_block',
  cooldownRemainingMs: 0,
  hardBlock: false,
  rate: 1,
  alert: false,
  alertReason: null,
});

function getStatusText() {
  return {
    on: tRuntime('common:indicator.status.on'),
    off: tRuntime('common:indicator.status.off'),
  };
}

function resolveReasonLabel(reason) {
  const key = POLICY_REASON_LABEL_KEYS[reason];
  return key
    ? tRuntime(key)
    : tRuntime('common:indicator.reason.default');
}

export function createIndicatorState() {
  return {
    isBlocked: false,
    isBlockedDomain: false,
    filters: null,
    policy: null,
    corner: 'bottom-right',
    indicatorConfig: { ...DEFAULT_INDICATOR_CONFIG },
    video: { ...DEFAULT_VIDEO_STATE },
  };
}

function normalizeVideoState(nextVideo) {
  if (!nextVideo || typeof nextVideo !== 'object') return null;
  if (Object.prototype.hasOwnProperty.call(nextVideo, 'enabled') && nextVideo.enabled === false) {
    return { ...DEFAULT_VIDEO_STATE, ...nextVideo };
  }
  return nextVideo;
}

export function mergeIndicatorState(state, next = {}) {
  if (!state || typeof state !== 'object' || !next || typeof next !== 'object') return state;

  if (typeof next.isBlockedDomain === 'boolean') {
    state.isBlockedDomain = next.isBlockedDomain;
  }
  if (typeof next.isBlocked === 'boolean') {
    state.isBlocked = next.isBlocked;
  }
  if (next.filters && typeof next.filters === 'object') {
    state.filters = next.filters;
  }

  if (Object.prototype.hasOwnProperty.call(next, 'indicatorConfig')) {
    const merged = {
      ...(state.indicatorConfig || DEFAULT_INDICATOR_CONFIG),
      ...(next.indicatorConfig && typeof next.indicatorConfig === 'object' ? next.indicatorConfig : {}),
    };
    state.indicatorConfig = normalizeIndicatorConfig(merged);
  }

  if (typeof next.indicatorEnabled === 'boolean') {
    state.indicatorConfig = normalizeIndicatorConfig({
      ...(state.indicatorConfig || DEFAULT_INDICATOR_CONFIG),
      enabled: next.indicatorEnabled,
    });
  }

  if (Object.prototype.hasOwnProperty.call(next, 'policy')) {
    if (next.policy && typeof next.policy === 'object') {
      state.policy = { ...(state.policy || {}), ...next.policy };
    } else if (next.policy === null) {
      state.policy = null;
    }
  }

  if (Object.prototype.hasOwnProperty.call(next, 'nextEligibleAtMs')) {
    const value = Number(next.nextEligibleAtMs);
    const nextEligibleAtMs = Number.isFinite(value) && value > 0 ? Math.round(value) : null;
    state.policy = { ...(state.policy || {}), nextEligibleAtMs };
  }

  if (Object.prototype.hasOwnProperty.call(next, 'video')) {
    const normalizedVideo = normalizeVideoState(next.video);
    if (normalizedVideo) {
      state.video = { ...(state.video || DEFAULT_VIDEO_STATE), ...normalizedVideo };
    }
  }

  return state;
}

function resolvePriorityReason(state) {
  const reason = state?.policy?.reason;
  if (reason === 'global_cap_exceeded') return 'global_cap_exceeded';
  if (state?.video?.alert) return 'video_alert';
  if (state?.isBlockedDomain && state?.isBlocked) return 'filtered';
  return null;
}

export function resolveVisualTheme(state) {
  const reason = resolvePriorityReason(state);
  if (reason === 'global_cap_exceeded' || reason === 'video_alert') {
    return 'alert';
  }
  if (state?.isBlockedDomain && state?.isBlocked) return 'guard';
  if (state?.video?.hasVideo) return 'video';
  return 'idle';
}

export function resolvePillText(state) {
  const statusText = getStatusText();
  const reason = resolvePriorityReason(state);
  if (reason) return resolveReasonLabel(reason) || statusText.on;

  if (state?.isBlockedDomain && state?.policy?.reason === 'allowed_window') {
    return resolveReasonLabel('allowed_window');
  }
  if (state?.video?.hasVideo) {
    return state.video.isPlaying
      ? tRuntime('common:indicator.video.skip_guard_active')
      : tRuntime('common:indicator.video.skip_guard_waiting');
  }
  if (state?.isBlockedDomain) return state?.isBlocked ? statusText.on : statusText.off;
  return statusText.off;
}

export function resolvePolicyReasonLabel(reason) {
  if (typeof reason !== 'string' || !reason) return resolveReasonLabel('');
  return resolveReasonLabel(reason);
}

export function resolveShouldShow(state) {
  const indicatorEnabled = !!state?.indicatorConfig?.enabled;
  return indicatorEnabled && (!!state?.isBlockedDomain || !!state?.video?.visible);
}
