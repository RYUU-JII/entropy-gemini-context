import React, { useEffect, useRef } from 'react';
import './zenGardenWorkspace.css';

// Only the paper edge admits dragging; scrolling and text selection stay native.
export default function ZenGardenModeControl({ mode, pendingMode, pathwaysAvailable, disabled,
  pondLabel, pathwaysLabel, retryLabel, errorLabel, error, onRequest, onRetry,
  travelPx, onProgress, readGestureProgress, onPreparePond, onCancelPond }) {
  const gestureRef = useRef(null);
  const suppressClickRef = useRef(false);
  const unavailable = disabled || (mode === 'pond' && !pathwaysAvailable);
  useEffect(() => {
    gestureRef.current = null;
    onProgress?.(null);
    onCancelPond?.();
  }, [mode, unavailable, onProgress, onCancelPond]);
  const cancelGesture = (event, preservePondPreparation = false) => {
    const start = gestureRef.current;
    if (!start) return;
    suppressClickRef.current = start.dragging;
    gestureRef.current = null;
    onProgress?.(null);
    if (!preservePondPreparation) onCancelPond?.();
    if (event?.currentTarget.hasPointerCapture?.(start.id)) event.currentTarget.releasePointerCapture(start.id);
  };
  const updateGesture = (event) => {
    const start = gestureRef.current;
    if (!start || start.id !== event.pointerId) return null;
    const dy = event.clientY - start.y;
    const dx = event.clientX - start.x;
    if (!start.dragging) {
      if (Math.abs(dy) < 6 || Math.abs(dy) < Math.abs(dx) * 1.2) return start;
      start.dragging = true;
    }
    start.dy = dy;
    if (start.originY === undefined) {
      const paintedProgress = readGestureProgress();
      if (paintedProgress === null) { start.waitingForPaint = true; return start; }
      // During settling, or after waiting for Pond admission, take over from
      // the visible paper at this pointer position instead of its route endpoint.
      start.originY = start.waitingForPaint || Math.abs(paintedProgress - start.origin) > .001
        ? event.clientY : start.y;
      start.origin = paintedProgress;
    }
    start.progress = Math.max(0, Math.min(1, start.origin - (event.clientY - start.originY) / start.travel));
    onProgress?.({ progress: start.progress, dragging: true });
    return start;
  };
  return (
    <div className="zen-garden-mode-control" data-pending={pendingMode || undefined}>
      <button type="button" className="zen-garden-paper-edge"
        data-tab={mode === 'pond' ? 'sites' : 'main'}
        data-mode={mode === 'pond' ? 'pathways' : 'pond'}
        aria-label={mode === 'pond' ? pathwaysLabel : pondLabel}
        aria-expanded={mode === 'pathways'} aria-controls="zen-garden-ledger"
        aria-busy={Boolean(pendingMode)} disabled={unavailable}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            if (gestureRef.current) { cancelGesture(event); event.preventDefault(); }
            return;
          }
          const target = event.key === 'ArrowUp' ? 'pathways' : event.key === 'ArrowDown' ? 'pond' : null;
          if (!target || unavailable || (target === 'pathways' && !pathwaysAvailable)) return;
          event.preventDefault();
          cancelGesture(event, target === 'pond');
          onProgress?.(null);
          onRequest(target);
        }}
        onPointerDown={(event) => {
          if (unavailable || event.button !== 0) return;
          suppressClickRef.current = false;
          gestureRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY,
            origin: mode === 'pathways' ? 1 : 0, progress: mode === 'pathways' ? 1 : 0,
            travel: travelPx, dy: 0, dragging: false };
          event.currentTarget.setPointerCapture?.(event.pointerId);
          if (mode === 'pathways') onPreparePond?.();
        }}
        onPointerMove={updateGesture}
        onPointerUp={(event) => {
          const start = updateGesture(event);
          if (!start || start.id !== event.pointerId) return;
          gestureRef.current = null;
          if (!start.dragging) return;
          suppressClickRef.current = true;
          event.currentTarget.releasePointerCapture?.(event.pointerId);
          const intended = mode === 'pond' ? start.dy < -36 : start.dy > 36;
          if (!intended || unavailable) { onProgress?.(null); onCancelPond?.(); return; }
          onProgress?.({ progress: start.progress, dragging: false });
          onRequest(mode === 'pond' ? 'pathways' : 'pond');
        }}
        onPointerCancel={cancelGesture}
        onLostPointerCapture={cancelGesture}
        onClick={(event) => {
          if (suppressClickRef.current) {
            suppressClickRef.current = false;
            // A cancelled pointer never has to produce a click. Its remaining
            // suppression must not consume a later keyboard or assistive action.
            if (event.detail > 0) { event.preventDefault(); return; }
          }
          onProgress?.(null);
          onRequest(mode === 'pond' ? 'pathways' : 'pond');
        }}>
        <span aria-hidden="true" className="zen-garden-paper-lip" />
      </button>
      {error && <div className="zen-garden-mode-error" role="alert">
        <span>{errorLabel}</span>
        <button type="button" onClick={onRetry}>{retryLabel}</button>
      </div>}
    </div>
  );
}
