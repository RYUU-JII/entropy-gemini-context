import { createContext, createElement, useContext, useEffect, useMemo, useRef } from 'react';

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
const DashboardNavigationContext = createContext(null);

function isNavigationMouseButtonEvent(event) {
  return NAVIGATION_MOUSE_BUTTONS.has(Number(event?.button));
}

export function DashboardNavigationProvider({ value, children }) {
  return createElement(DashboardNavigationContext.Provider, { value }, children);
}

// Back handlers stay local to the mounted dashboard. Higher-priority surfaces
// consume a level before their containing Garden has a chance to close.
export function useDashboardBackHandler({ enabled, priority, onBack }) {
  const navigation = useContext(DashboardNavigationContext);
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  useEffect(() => {
    if (!enabled) return undefined;
    if (!navigation) throw new Error('DASHBOARD_NAVIGATION_OWNER_REQUIRED');
    return navigation.registerBackHandler({
      priority,
      onBack: (event) => onBackRef.current(event),
    });
  }, [enabled, navigation, priority]);
}

export function useDashboardNavigationButtonLock() {
  const handlersRef = useRef(new Set());
  const navigation = useMemo(() => ({
    registerBackHandler(handler) {
      handlersRef.current.add(handler);
      return () => handlersRef.current.delete(handler);
    },
  }), []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const dispatchBack = (event) => {
      const handlers = Array.from(handlersRef.current).sort((left, right) => right.priority - left.priority);
      return handlers.some((handler) => handler.onBack(event) === true);
    };
    let gesture = null;
    const consumeNavigationMouseButton = (event) => {
      if (!isNavigationMouseButtonEvent(event)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      if (Number(event.button) !== 3) return;

      // Chromium delivers pointer, mouse, and auxclick for one physical button
      // press. Dispatch on its first event, then consume the remaining sequence.
      const startsGesture = event.type === 'pointerdown'
        || (event.type === 'mousedown' && gesture?.phase !== 'pointerdown');
      if (startsGesture || !gesture) {
        gesture = { phase: event.type };
        dispatchBack(event);
      } else {
        gesture.phase = event.type;
      }
      if (event.type === 'auxclick') gesture = null;
    };
    const handleEscape = (event) => {
      // Bubble after React controls: an editor/popover owns its first Escape.
      if (event.key !== 'Escape' || event.defaultPrevented || event.repeat || event.isComposing) return;
      const target = event.target;
      const editable = target?.closest?.('[contenteditable]');
      const emptySearch = target?.matches?.('input[type="search"]') && target.value === '';
      if ((!emptySearch && target?.closest?.('input, textarea, select'))
        || (editable && editable.getAttribute('contenteditable') !== 'false')) return;
      if (dispatchBack(event)) event.preventDefault();
    };
    NAVIGATION_MOUSE_EVENTS.forEach((eventType) => {
      window.addEventListener(eventType, consumeNavigationMouseButton, ADD_OPTIONS);
    });
    window.addEventListener('keydown', handleEscape);

    return () => {
      NAVIGATION_MOUSE_EVENTS.forEach((eventType) => {
        window.removeEventListener(eventType, consumeNavigationMouseButton, REMOVE_OPTIONS);
      });
      window.removeEventListener('keydown', handleEscape);
    };
  }, []);
  return navigation;
}

export default useDashboardNavigationButtonLock;
