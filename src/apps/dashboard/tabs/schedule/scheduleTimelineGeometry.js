import { MINUTES_IN_DAY, getBlockDuration } from './scheduleModel.js';

// Presentation coordinates only; recurring days and clock minutes stay canonical.
export function getTimelineSegments(block, resetHour = 4) {
  if (!block) return [];
  if (block.allDay === true) return [{ start: 0, end: MINUTES_IN_DAY }];
  const start = ((block.startMin - resetHour * 60) % MINUTES_IN_DAY + MINUTES_IN_DAY) % MINUTES_IN_DAY;
  const end = start + getBlockDuration(block);
  if (end <= MINUTES_IN_DAY) return [{ start, end }];
  return [{ start, end: MINUTES_IN_DAY }, { start: 0, end: end - MINUTES_IN_DAY }];
}

export function getPrimaryTimelineSegmentIndex(segments) {
  return segments.reduce((best, segment, index) => (
    segment.end - segment.start > segments[best].end - segments[best].start ? index : best
  ), 0);
}

export function getTimelineAnchorRatio(segments) {
  if (!segments.length) return 0.5;
  const segment = segments[getPrimaryTimelineSegmentIndex(segments)];
  return (segment.start + segment.end) / (2 * MINUTES_IN_DAY);
}

// Clamping affects presentation only. A frozen paper may need a short horizontal
// leader when its live interval moves beyond the paper's edge.
export function getScheduleWorkbenchPlacement(fieldWidth, anchorRatio, sourceRatio = anchorRatio) {
  const width = Math.min(400, fieldWidth);
  const x = Math.max(0, Math.min(fieldWidth - width, anchorRatio * fieldWidth - width / 2));
  const source = sourceRatio * fieldWidth;
  const target = Math.max(x + 1, Math.min(x + width - 1, source));
  return { width, x, source, target, shift: target - source,
    capLeft: Math.max(0, Math.min(width - 20, target - x - 10)) };
}
