import {
  RITUAL_SURFACE_INPUT_POLICY_MODES,
  RITUAL_SURFACE_STRICT_INPUT_EVENTS,
} from './ritualSurfaceArbiter.js';

export const SITE_FURIN_SURFACE_INPUT_EVENTS = Object.freeze([
  ...RITUAL_SURFACE_STRICT_INPUT_EVENTS,
]);

export const SITE_FURIN_SCROLL_INPUT_EVENTS = Object.freeze([
  'touchmove',
  'wheel',
]);

export const SITE_FURIN_SCROLL_KEYS = Object.freeze([
  ' ',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'End',
  'Home',
  'PageDown',
  'PageUp',
  'Space',
  'Spacebar',
]);

const SITE_FURIN_MIDDLE_BUTTON_EVENTS = Object.freeze([
  'auxclick',
  'mousedown',
  'mouseup',
  'pointerdown',
  'pointerup',
]);

export function shouldLockSiteFurinScrollEvent(eventType = '') {
  return SITE_FURIN_SCROLL_INPUT_EVENTS.includes(eventType || '');
}

function isNativeButtonSpaceActivation(event = null, path = []) {
  if (![' ', 'Space', 'Spacebar'].includes(event?.key)) return false;
  return path.some((entry) => entry?.tagName === 'BUTTON' && entry?.disabled !== true);
}

export function shouldLockSiteFurinScrollInput({ event = null, path = [] } = {}) {
  const eventType = event?.type || '';
  if (shouldLockSiteFurinScrollEvent(eventType)) return true;
  if (
    eventType === 'keydown'
    && SITE_FURIN_SCROLL_KEYS.includes(event?.key || '')
  ) {
    return !isNativeButtonSpaceActivation(event, path);
  }
  return SITE_FURIN_MIDDLE_BUTTON_EVENTS.includes(eventType)
    && Number(event?.button) === 1;
}

export function createSiteFurinSurfaceInputPolicy({
  rootRef = null,
  onBlockedInput = null,
} = {}) {
  return {
    mode: RITUAL_SURFACE_INPUT_POLICY_MODES.LOCK_TO_SURFACE,
    eventTypes: SITE_FURIN_SURFACE_INPUT_EVENTS,
    resolveAllowedRoots: ({ event, path }) => {
      if (shouldLockSiteFurinScrollInput({ event, path })) return [];
      return typeof rootRef === 'function' ? rootRef() : rootRef;
    },
    onBlockedInput,
  };
}
