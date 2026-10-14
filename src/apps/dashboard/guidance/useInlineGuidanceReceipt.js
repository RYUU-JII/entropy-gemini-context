import { useEffect, useRef } from 'react';
import { isVisibleGuidanceAnchor, observeGuidanceAnchorVisibility } from './guidanceAnchorVisibility.js';

// Only a committed, visible anchor may consume a first presentation receipt.
export function useInlineGuidanceReceipt(presenter, elementRef, dismissAfterPaint = true) {
  const callbacksRef = useRef(presenter);
  callbacksRef.current = presenter;
  useEffect(() => {
    if (!presenter || presenter.item.replay) return undefined;
    let frameId = null;
    let paints = 0;
    let finished = false;
    let stopObserving;
    const schedule = () => {
      if (!finished && frameId === null) frameId = requestAnimationFrame(paint);
    };
    const paint = () => {
      frameId = null;
      if (document.hidden || !isVisibleGuidanceAnchor(elementRef.current)) { paints = 0; return; }
      paints += 1;
      if (paints < 2) { schedule(); return; }
      finished = true;
      stopObserving();
      callbacksRef.current?.onPresented();
      // This is a short informational receipt, never the nine-second scene's completion.
      if (dismissAfterPaint) void callbacksRef.current?.onDismiss();
    };
    const visibilityChanged = () => {
      if (!document.hidden && isVisibleGuidanceAnchor(elementRef.current)) schedule();
      else {
        paints = 0;
        if (frameId !== null) cancelAnimationFrame(frameId);
        frameId = null;
      }
    };
    stopObserving = observeGuidanceAnchorVisibility([elementRef.current], visibilityChanged);
    document.addEventListener('visibilitychange', visibilityChanged);
    schedule();
    return () => {
      if (frameId !== null) cancelAnimationFrame(frameId);
      stopObserving();
      document.removeEventListener('visibilitychange', visibilityChanged);
    };
  }, [presenter?.claimId, elementRef, dismissAfterPaint]);
}
