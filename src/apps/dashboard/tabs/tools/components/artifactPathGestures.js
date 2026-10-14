import { useEffect, useRef } from 'react';

// One gesture moves the path exactly one step.
//
// A wheel spin or a trackpad swipe arrives as a stream of wheel events whose
// inertial tail can last well over a second. The gate accumulates the stream's
// dominant-axis delta, steps once when it crosses the threshold, and then
// swallows the rest of that stream. The stream ends only after the events have
// been quiet for `quietMs`; the next stream may step again. Reversing direction
// mid-stream does not step back — that is still the same gesture.
export const ARTIFACT_PATH_WHEEL_THRESHOLD_PX = 36;
export const ARTIFACT_PATH_GESTURE_QUIET_MS = 240;
export const ARTIFACT_PATH_SWIPE_THRESHOLD_PX = 48;

const WHEEL_LINE_PX = 16;
const WHEEL_PAGE_PX = 800;

export function createArtifactPathWheelGate({
  thresholdPx = ARTIFACT_PATH_WHEEL_THRESHOLD_PX,
  quietMs = ARTIFACT_PATH_GESTURE_QUIET_MS,
} = {}) {
  let accumulated = 0;
  let lastEventAt = Number.NEGATIVE_INFINITY;
  let hasStepped = false;
  return {
    // Returns +1 (next), -1 (previous) or 0 (no step) for one wheel event.
    push(delta, at) {
      if (at - lastEventAt > quietMs) {
        accumulated = 0;
        hasStepped = false;
      }
      lastEventAt = at;
      if (hasStepped || !Number.isFinite(delta)) return 0;
      accumulated += delta;
      if (Math.abs(accumulated) < thresholdPx) return 0;
      hasStepped = true;
      return Math.sign(accumulated);
    },
  };
}

export function resolveArtifactPathWheelDelta(event) {
  const scale = event.deltaMode === 1 ? WHEEL_LINE_PX : event.deltaMode === 2 ? WHEEL_PAGE_PX : 1;
  const { deltaX, deltaY } = event;
  return (Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY) * scale;
}

// A touch/pen swipe is one gesture by construction: it steps on release when
// it travelled far enough and mostly sideways. Mouse drags are left to the
// artifacts themselves.
export function resolveArtifactPathSwipeStep(dx, dy, thresholdPx = ARTIFACT_PATH_SWIPE_THRESHOLD_PX) {
  if (Math.abs(dx) < thresholdPx || Math.abs(dx) < Math.abs(dy) * 1.2) return 0;
  return dx < 0 ? 1 : -1;
}

export function useArtifactPathGestures(targetRef, { enabled, onStep }) {
  const onStepRef = useRef(onStep);
  onStepRef.current = onStep;

  useEffect(() => {
    const target = targetRef.current;
    if (!enabled || !target) return undefined;
    const wheelGate = createArtifactPathWheelGate();
    let swipeStart = null;

    const handleWheel = (event) => {
      if (event.ctrlKey) return; // pinch-zoom belongs to the browser
      event.preventDefault();
      const step = wheelGate.push(resolveArtifactPathWheelDelta(event), event.timeStamp);
      if (step !== 0) onStepRef.current(step);
    };
    const handlePointerDown = (event) => {
      swipeStart = event.pointerType === 'mouse' || !event.isPrimary
        ? null
        : { id: event.pointerId, x: event.clientX, y: event.clientY };
    };
    const handlePointerUp = (event) => {
      if (!swipeStart || event.pointerId !== swipeStart.id) return;
      const step = resolveArtifactPathSwipeStep(event.clientX - swipeStart.x, event.clientY - swipeStart.y);
      swipeStart = null;
      if (step !== 0) onStepRef.current(step);
    };
    const handlePointerCancel = () => { swipeStart = null; };

    target.addEventListener('wheel', handleWheel, { passive: false });
    target.addEventListener('pointerdown', handlePointerDown);
    target.addEventListener('pointerup', handlePointerUp);
    target.addEventListener('pointercancel', handlePointerCancel);
    return () => {
      target.removeEventListener('wheel', handleWheel);
      target.removeEventListener('pointerdown', handlePointerDown);
      target.removeEventListener('pointerup', handlePointerUp);
      target.removeEventListener('pointercancel', handlePointerCancel);
    };
  }, [enabled, targetRef]);
}
