import { useCallback, useEffect, useRef } from 'react';

// The graph and its in-place favicon actions are one interaction region. Publish only
// enter/exit transitions; moving across segments does not reset an idle timer.
export function useZenPressureRailEngagement(onInteractionActiveChange) {
  const railRef = useRef(null);
  const containsTarget = useCallback((target) => (
    target instanceof Node
    && railRef.current?.contains(target)
  ), []);
  const engagementRef = useRef({ pointer: false, keyboard: false });
  const setEngagement = useCallback((source, active) => {
    const engagement = engagementRef.current;
    const wasActive = engagement.pointer || engagement.keyboard;
    engagement[source] = active;
    const isActive = engagement.pointer || engagement.keyboard;
    if (wasActive !== isActive) onInteractionActiveChange?.(isActive);
  }, [onInteractionActiveChange]);

  useEffect(() => {
    const engagement = engagementRef.current;
    if (engagement.pointer || engagement.keyboard) onInteractionActiveChange?.(true);
    return () => {
      if (engagement.pointer || engagement.keyboard) onInteractionActiveChange?.(false);
    };
  }, [onInteractionActiveChange]);

  const engagementHandlers = {
    onPointerEnter: (event) => {
      if (event.pointerType !== 'touch') setEngagement('pointer', true);
    },
    onPointerLeave: (event) => {
      if (!containsTarget(event.relatedTarget)) setEngagement('pointer', false);
    },
    onPointerCancel: () => setEngagement('pointer', false),
    // Mouse clicks must not pin the lock indefinitely through retained focus.
    onPointerDownCapture: () => setEngagement('keyboard', false),
    onFocusCapture: (event) => {
      setEngagement('keyboard', event.target.matches(':focus-visible'));
    },
    onKeyDownCapture: (event) => {
      if (event.key !== 'Escape') setEngagement('keyboard', true);
    },
    onBlurCapture: (event) => {
      if (!containsTarget(event.relatedTarget)) setEngagement('keyboard', false);
    },
  };
  return { railRef, engagementHandlers };
}
