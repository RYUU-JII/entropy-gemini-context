import {
  RITUAL_SURFACE_INPUT_POLICY_MODES,
  blockRitualSurfaceInputEvent,
  installRitualSurfaceInputGuard,
  resolveRitualSurfaceInputPoint,
  shouldBlockRitualSurfaceInput,
} from './ritualSurfaceArbiter.js';

export const GLOBAL_SENTINEL_AWAITING_START_INPUT_EVENTS = Object.freeze([
  'auxclick',
  'beforeinput',
  'click',
  'contextmenu',
  'dblclick',
  'dragstart',
  'drop',
  'input',
  'keydown',
  'mousedown',
  'mouseup',
  'paste',
  'pointerdown',
  'pointerup',
]);

export const GLOBAL_SENTINEL_SCROLL_INPUT_EVENTS = Object.freeze([
  'touchmove',
  'wheel',
]);

export const GLOBAL_SENTINEL_SCROLL_KEYS = Object.freeze([
  ' ',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'End',
  'Home',
  'PageDown',
  'PageUp',
  'Spacebar',
]);

export const GLOBAL_SENTINEL_SURFACE_INPUT_EVENTS = Object.freeze([
  ...GLOBAL_SENTINEL_AWAITING_START_INPUT_EVENTS,
  ...GLOBAL_SENTINEL_SCROLL_INPUT_EVENTS,
]);

function isNativeKeyboardActivationTarget(event = null) {
  const path = typeof event?.composedPath === 'function' ? event.composedPath() : [];
  const candidates = path.length ? path : [event?.target];
  return candidates.some((candidate) => {
    const tagName = typeof candidate?.tagName === 'string'
      ? candidate.tagName.toLowerCase()
      : '';
    return tagName === 'button'
      || tagName === 'summary'
      || (tagName === 'input' && !['hidden', 'text'].includes(String(candidate?.type || '').toLowerCase()));
  });
}

export function isGlobalSentinelScrollInputEvent(eventOrType = '') {
  const event = eventOrType && typeof eventOrType === 'object' ? eventOrType : null;
  const eventType = event?.type || eventOrType || '';
  if (GLOBAL_SENTINEL_SCROLL_INPUT_EVENTS.includes(eventType)) return true;
  if (
    ['mousedown', 'pointerdown'].includes(eventType)
    && Number(event?.button) === 1
  ) {
    return true;
  }
  if (eventType !== 'keydown' || !GLOBAL_SENTINEL_SCROLL_KEYS.includes(event?.key || '')) {
    return false;
  }
  // Space is the native activation key for the in-surface semantic button.
  // Let that button action through while still treating page-level Space as
  // scroll input.
  return !([' ', 'Spacebar'].includes(event.key) && isNativeKeyboardActivationTarget(event));
}

function resolveRootRef(rootRef = null) {
  return typeof rootRef === 'function' ? rootRef() : rootRef;
}

function isAwaitingStartPageLivenessScroll(event = null) {
  if (!isGlobalSentinelScrollInputEvent(event)) return false;
  if (event?.type === 'wheel' && (event.ctrlKey === true || event.metaKey === true)) {
    return false;
  }
  if (event?.type === 'touchmove' && Number(event?.touches?.length) > 1) {
    return false;
  }
  return true;
}

export function createGlobalSentinelSurfaceInputPolicy({
  rootRef = null,
  isAwaitingStart = null,
  onBlockedInput = null,
} = {}) {
  const resolveAwaitingStart = () => (typeof isAwaitingStart === 'function'
    ? isAwaitingStart()
    : isAwaitingStart === true);
  const shouldBlockAcrossSurface = (event = null) => (
    event?.type === 'contextmenu'
    || event?.type === 'auxclick'
    || (event?.type === 'keydown' && event?.key === 'Tab')
    || (event?.type === 'keydown' && event.repeat === true
      && ['Enter', ' ', 'Spacebar'].includes(event.key))
    || isGlobalSentinelScrollInputEvent(event)
  );
  return {
    mode: RITUAL_SURFACE_INPUT_POLICY_MODES.LOCK_TO_SURFACE,
    eventTypes: GLOBAL_SENTINEL_SURFACE_INPUT_EVENTS,
    // Awaiting-start intentionally leaves native page scroll alive. Once the
    // starter is accepted, scroll events are enabled in the guard and receive
    // no allowed root, so wheel/touch scrolling is blocked both on the page and
    // over the ritual canvas until the surface claim is released.
    isEnabled: ({ event } = {}) => (
      !isAwaitingStartPageLivenessScroll(event)
      || !resolveAwaitingStart()
    ),
    resolveAllowedRoots: ({ event } = {}) => (
      shouldBlockAcrossSurface(event)
        ? []
        : [resolveRootRef(rootRef)]
    ),
    onBlockedInput,
  };
}

export function resolveGlobalSentinelBlockedInputPoint(event = null) {
  return resolveRitualSurfaceInputPoint(event);
}

export function shouldBlockGlobalSentinelAwaitingStartInput(event = null, {
  awaitingStart = false,
  root = null,
} = {}) {
  return shouldBlockRitualSurfaceInput(event, {
    mode: RITUAL_SURFACE_INPUT_POLICY_MODES.LOCK_TO_SURFACE,
    eventTypes: GLOBAL_SENTINEL_AWAITING_START_INPUT_EVENTS,
    rootRef: root,
    isEnabled: () => awaitingStart === true,
  });
}

export function blockGlobalSentinelAwaitingStartEvent(event = null) {
  blockRitualSurfaceInputEvent(event);
}

export function installGlobalSentinelAwaitingStartInputGate({
  windowRef = typeof window !== 'undefined' ? window : null,
  rootRef = null,
  isAwaitingStart = null,
  onBlockedInput = null,
} = {}) {
  return installRitualSurfaceInputGuard({
    mode: RITUAL_SURFACE_INPUT_POLICY_MODES.LOCK_TO_SURFACE,
    eventTypes: GLOBAL_SENTINEL_AWAITING_START_INPUT_EVENTS,
    rootRef,
    windowRef,
    isEnabled: () => (typeof isAwaitingStart === 'function'
      ? isAwaitingStart()
      : isAwaitingStart === true),
    onBlockedInput,
  });
}
