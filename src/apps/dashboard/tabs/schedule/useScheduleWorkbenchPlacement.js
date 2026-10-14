import { useLayoutEffect, useState } from 'react';
import { getScheduleWorkbenchPlacement, getTimelineAnchorRatio } from './scheduleTimelineGeometry.js';

export function useScheduleWorkbenchPlacement(fieldRef, selectedId, segments, locked) {
  const [fieldWidth, setFieldWidth] = useState(0);
  const sourceRatio = getTimelineAnchorRatio(segments);
  const [anchor, setAnchor] = useState({ id: selectedId, ratio: sourceRatio });
  useLayoutEffect(() => {
    const field = fieldRef.current;
    // Placement is written in layout CSS pixels, before the dashboard's Scaler.
    const measure = () => setFieldWidth(field.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(field);
    return () => observer.disconnect();
  }, [fieldRef]);
  useLayoutEffect(() => {
    if (anchor.id !== selectedId || (!locked && anchor.ratio !== sourceRatio)) {
      setAnchor({ id: selectedId, ratio: sourceRatio });
    }
  }, [selectedId, sourceRatio, locked, anchor]);
  return getScheduleWorkbenchPlacement(fieldWidth,
    locked && anchor.id === selectedId ? anchor.ratio : sourceRatio, sourceRatio);
}
