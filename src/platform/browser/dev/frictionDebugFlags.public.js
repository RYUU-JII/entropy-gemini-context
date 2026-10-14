export const FRICTION_DEBUG_FLAG_STORAGE_KEY = 'frictionDebug';
export const OBSERVER_HUB_DEBUG_FLAG_STORAGE_KEY = 'frictionObserverPerfDebug';
export const BEHAVIOR_HUB_DEBUG_FLAG_STORAGE_KEY = 'protectionBehaviorHubDebug';
export const SHORT_FORM_DEBUG_FLAG_STORAGE_KEY = 'friction_shortform_debug';
export const VIDEO_SKIP_DEBUG_FLAG_STORAGE_KEY = 'friction_video_skip_debug';

export function acquireFrictionDebugLease() {
  return () => false;
}

export function isFrictionDebugEnabled() {
  return false;
}

export function isObserverHubPerfDebugEnabled() {
  return false;
}

export function isBehaviorHubDebugEnabled() {
  return false;
}

export function isShortFormDebugEnabled() {
  return false;
}

export function isVideoSkipDebugEnabled() {
  return false;
}
