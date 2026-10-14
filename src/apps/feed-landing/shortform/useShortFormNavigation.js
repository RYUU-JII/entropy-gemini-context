import { useCallback, useEffect, useRef } from 'react';
import { advanceShortFormSession, createShortFormWheelController } from '../model/shortFormNavigation.js';

export function useShortFormNavigation({ viewportRef, lastIndex, session, onSessionChange, reducedMotion, requestedIndex }) {
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const goTo = useCallback((index, instant = false) => {
    const viewport = viewportRef.current;
    if (!viewport || viewport.clientHeight === 0) return;
    const target = Math.max(0, Math.min(lastIndex, index));
    viewport.scrollTo({ top: target * viewport.clientHeight, behavior: instant || reducedMotion ? 'auto' : 'smooth' });
  }, [viewportRef, lastIndex, reducedMotion]);

  useEffect(() => {
    const viewport = viewportRef.current;
    const wheel = createShortFormWheelController();
    let frame = 0;
    const measure = () => {
      frame = 0;
      if (viewport.clientHeight === 0) return;
      const index = Math.max(0, Math.min(lastIndex, Math.round(viewport.scrollTop / viewport.clientHeight)));
      onSessionChange((current) => advanceShortFormSession(current, index, lastIndex));
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(measure); };
    const onWheel = (event) => {
      if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      const terminus = event.target.closest('.short-terminus');
      if (terminus && !(terminus.scrollTop <= 0 && event.deltaY < 0)) return;
      // Only this explicit reel viewport owns wheel paging. Document scrolling
      // and controls outside the viewport are never intercepted.
      event.preventDefault();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1);
      const direction = wheel.observe(delta, performance.now());
      if (direction) goTo(sessionRef.current.index + direction);
    };
    const onResize = () => goTo(sessionRef.current.index, true);
    const observer = new ResizeObserver(onResize);
    observer.observe(viewport);
    viewport.addEventListener('scroll', onScroll, { passive: true });
    viewport.addEventListener('wheel', onWheel, { passive: false });
    goTo(sessionRef.current.index, true);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      viewport.removeEventListener('scroll', onScroll);
      viewport.removeEventListener('wheel', onWheel);
    };
  }, [viewportRef, goTo, lastIndex, onSessionChange]);

  useEffect(() => {
    if (requestedIndex !== null) goTo(requestedIndex, true);
  }, [requestedIndex, goTo]);

  const onKeyDown = (event) => {
    if (event.target.closest('button, a, input, textarea, dialog') || event.altKey || event.ctrlKey || event.metaKey) return;
    let target;
    if (['ArrowDown', 'PageDown', ' '].includes(event.key)) target = session.index + 1;
    else if (['ArrowUp', 'PageUp'].includes(event.key)) target = session.index - 1;
    else if (event.key === 'Home') target = 0;
    else if (event.key === 'End') target = lastIndex;
    else return;
    event.preventDefault();
    if (!event.repeat) goTo(target);
  };
  return { goTo, onKeyDown };
}
