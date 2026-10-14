import {
  readPageLocalBooleanFlag,
  readPageLocalStorageItem,
} from '../pageLocalStorage.js';

export const FRICTION_DEBUG_FLAG_STORAGE_KEY = 'frictionDebug';
export const OBSERVER_HUB_DEBUG_FLAG_STORAGE_KEY = 'frictionObserverPerfDebug';
export const BEHAVIOR_HUB_DEBUG_FLAG_STORAGE_KEY = 'protectionBehaviorHubDebug';
export const SHORT_FORM_DEBUG_FLAG_STORAGE_KEY = 'friction_shortform_debug';
export const VIDEO_SKIP_DEBUG_FLAG_STORAGE_KEY = 'friction_video_skip_debug';

const BOOLEAN_TRUE_VALUES = new Set(['1', 'true']);
const BOOLEAN_FALSE_VALUES = new Set(['0', 'false']);

const frictionDebugLeases = new Set();

export function acquireFrictionDebugLease(source = 'anonymous') {
  const normalizedSource = String(source || '').trim();
  if (!normalizedSource) throw new Error('FRICTION_DEBUG_LEASE_SOURCE_REQUIRED');
  const token = Symbol(normalizedSource);
  frictionDebugLeases.add(token);
  let released = false;
  return () => {
    if (released) return false;
    released = true;
    return frictionDebugLeases.delete(token);
  };
}

function parseBooleanFlag(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim().toLowerCase();
  if (BOOLEAN_TRUE_VALUES.has(normalized)) return true;
  if (BOOLEAN_FALSE_VALUES.has(normalized)) return false;
  return null;
}

export function isFrictionDebugEnabled() {
  if (frictionDebugLeases.size > 0) return true;
  const pageLocal = parseBooleanFlag(readPageLocalStorageItem(FRICTION_DEBUG_FLAG_STORAGE_KEY, null));
  return pageLocal === true;
}

export function isObserverHubPerfDebugEnabled() {
  return readPageLocalBooleanFlag(OBSERVER_HUB_DEBUG_FLAG_STORAGE_KEY, {
    fallback: isFrictionDebugEnabled(),
  });
}

export function isBehaviorHubDebugEnabled() {
  return readPageLocalBooleanFlag(BEHAVIOR_HUB_DEBUG_FLAG_STORAGE_KEY, {
    fallback: false,
  });
}

export function isShortFormDebugEnabled() {
  return readPageLocalBooleanFlag(SHORT_FORM_DEBUG_FLAG_STORAGE_KEY, {
    fallback: false,
  });
}

export function isVideoSkipDebugEnabled() {
  return readPageLocalBooleanFlag(VIDEO_SKIP_DEBUG_FLAG_STORAGE_KEY, {
    fallback: false,
  });
}
