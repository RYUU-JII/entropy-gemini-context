import { useEffect, useState } from 'react';
import { resolveFrictionState, resolveJourneyProgress } from '../model/frictionJourney.js';

export function useFrictionJourney(feedRef, enabled, reducedMotion) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (!enabled) return undefined;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const feed = feedRef.current;
      if (!feed) return;
      const bounds = feed.getBoundingClientRect();
      // A hidden or not-yet-laid-out stream cannot contribute measured progress.
      // ResizeObserver schedules the first positive geometry without inventing it.
      if (bounds.height === 0) return;
      setProgress((previousProgress) => resolveJourneyProgress({
        scrollTop: Math.max(0, window.scrollY),
        feedTop: bounds.top + window.scrollY,
        feedHeight: bounds.height,
        viewportHeight: window.innerHeight,
        previousProgress,
      }));
    };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(measure); };
    const observer = new ResizeObserver(schedule);
    if (feedRef.current) observer.observe(feedRef.current);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    schedule();
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      window.cancelAnimationFrame(frame);
    };
  }, [feedRef, enabled]);
  return resolveFrictionState(progress, reducedMotion);
}
