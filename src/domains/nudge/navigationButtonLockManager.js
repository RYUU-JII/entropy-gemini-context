import {
  recordProtectionFeatureError,
  recordProtectionFeatureEvent,
} from '../protection/content/runtime/protectionRuntimeDiagnostics.js';

const NAVIGATION_MOUSE_BUTTONS = new Set([3, 4]);
const NAVIGATION_MOUSE_EVENTS = Object.freeze([
  'pointerdown',
  'pointerup',
  'mousedown',
  'mouseup',
  'auxclick',
]);
const ADD_OPTIONS = Object.freeze({ capture: true, passive: false });
const REMOVE_OPTIONS = Object.freeze({ capture: true });

const state = {
  active: false,
  boundHandler: null,
  consumedCount: 0,
};

function isNavigationMouseButtonEvent(event) {
  return NAVIGATION_MOUSE_BUTTONS.has(Number(event?.button));
}

function reportNavigationButtonLockFailure(phase, error, details = {}) {
  const diagnostic = {
    phase,
    error: String(error?.message || error || 'NAVIGATION_BUTTON_LOCK_FAILURE'),
    ...details,
  };
  recordProtectionFeatureError('navigationButtonLock', error, diagnostic);
  if (typeof console !== 'undefined') {
    console.warn?.('[NavigationButtonLockManager] runtime failure', diagnostic);
  }
}

function consumeNavigationButtonEvent(event) {
  if (!isNavigationMouseButtonEvent(event)) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();

  state.consumedCount += 1;
  recordProtectionFeatureEvent('navigationButtonLock', 'navigation_button_consumed', {
    button: Number(event.button),
    eventType: event.type,
    consumedCount: state.consumedCount,
  });
}

function addNavigationListeners(handler) {
  const applied = [];
  try {
    NAVIGATION_MOUSE_EVENTS.forEach((eventType) => {
      window.addEventListener(eventType, handler, ADD_OPTIONS);
      applied.push(eventType);
    });
  } catch (error) {
    applied.forEach((eventType) => {
      try {
        window.removeEventListener(eventType, handler, REMOVE_OPTIONS);
      } catch (cleanupError) {
        reportNavigationButtonLockFailure('listener_attach_cleanup', cleanupError, {
          eventType,
        });
      }
    });
    throw error;
  }
}

function removeNavigationListeners(handler) {
  const errors = [];
  NAVIGATION_MOUSE_EVENTS.forEach((eventType) => {
    try {
      window.removeEventListener(eventType, handler, REMOVE_OPTIONS);
    } catch (error) {
      errors.push(error);
      reportNavigationButtonLockFailure('listener_detach', error, {
        eventType,
      });
    }
  });
  if (errors.length > 0) {
    throw errors[0];
  }
}

const NavigationButtonLockManager = {
  apply(value = true) {
    const enabled = value !== false;
    if (!enabled) {
      this.remove();
      return;
    }
    if (typeof window === 'undefined') {
      throw new Error('NAVIGATION_BUTTON_LOCK_WINDOW_UNAVAILABLE');
    }
    if (state.active) {
      recordProtectionFeatureEvent('navigationButtonLock', 'manager_apply', {
        listenerCount: NAVIGATION_MOUSE_EVENTS.length,
        alreadyActive: true,
      });
      return;
    }

    const handler = (event) => consumeNavigationButtonEvent(event);
    try {
      addNavigationListeners(handler);
    } catch (error) {
      reportNavigationButtonLockFailure('manager_apply', error, {
        listenerCount: NAVIGATION_MOUSE_EVENTS.length,
      });
      throw error;
    }

    state.active = true;
    state.boundHandler = handler;
    state.consumedCount = 0;
    recordProtectionFeatureEvent('navigationButtonLock', 'manager_apply', {
      listenerCount: NAVIGATION_MOUSE_EVENTS.length,
      alreadyActive: false,
    });
  },

  remove() {
    if (!state.active && !state.boundHandler) return;
    const handler = state.boundHandler;
    state.active = false;
    state.boundHandler = null;
    state.consumedCount = 0;

    if (!handler || typeof window === 'undefined') {
      recordProtectionFeatureEvent('navigationButtonLock', 'manager_remove', {
        listenerCount: 0,
      });
      return;
    }

    removeNavigationListeners(handler);
    recordProtectionFeatureEvent('navigationButtonLock', 'manager_remove', {
      listenerCount: NAVIGATION_MOUSE_EVENTS.length,
    });
  },
};

export default NavigationButtonLockManager;
