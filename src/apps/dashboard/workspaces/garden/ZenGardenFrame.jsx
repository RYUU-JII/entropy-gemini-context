import React, { Suspense, useCallback, useLayoutEffect, useRef, useState } from 'react';
import { ZenHomeReadingSpace } from '@/themes/plugins/zen/api/homeReadingSpace.js';

// Composition only: callers own widgets, geometry, activity and exact frame
// acknowledgements. Changing the work-area content cannot replace the Bonsai.
export default function ZenGardenFrame({
  stageRef,
  pondRef,
  bonsaiRef,
  pondClipPath,
  pondSlot,
  bonsaiSlot,
  rhythmSlot,
  gardenPlanes,
  pressureDock,
  pendingContent,
  mode = 'pond',
  pathwaysSlot = null,
  workAreaRect = null,
  textSafeRightCssPx = 0,
  readingSpace = null,
  animateWorkArea = false,
  gardenControlSlot = null,
  transitionError = null,
  pondPresentationReady = false,
}) {
  const [gesture, setGesture] = useState(null);
  const sheetRef = useRef(null);
  const sheetViewportRef = useRef(null);
  const edgeRef = useRef(null);
  const previousModeRef = useRef(mode);
  const sheetFocusRef = useRef(false);
  const onProgress = useCallback((next) => setGesture(next), []);
  const readGestureProgress = useCallback(() => {
    // A settling sheet can still be between its committed endpoints. Read its
    // painted position only when a pointer actually takes over that movement.
    // Closing still waits for the current Pond receipt before exposing it.
    if (mode === 'pathways' && !pondPresentationReady) return null;
    const viewport = sheetViewportRef.current?.getBoundingClientRect();
    const sheet = sheetRef.current?.getBoundingClientRect();
    if (!viewport || !sheet || !Number.isFinite(viewport.height) || viewport.height <= 0
      || !Number.isFinite(viewport.top) || !Number.isFinite(sheet.top)) {
      throw new Error('ZEN_GARDEN_GESTURE_PAINT_BOUNDS_INVALID');
    }
    return Math.max(0, Math.min(1, 1 - (sheet.top - viewport.top) / viewport.height));
  }, [mode, pondPresentationReady]);
  useLayoutEffect(() => {
    const wasPathways = previousModeRef.current === 'pathways';
    previousModeRef.current = mode;
    setGesture(null);
    // Restore only focus that still belongs to the sheet being closed.
    if (wasPathways && mode === 'pond' && sheetFocusRef.current
      && (document.activeElement === document.body || sheetRef.current?.contains(document.activeElement))) {
      edgeRef.current?.querySelector('button')?.focus({ preventScroll: true });
    }
    if (mode === 'pond') sheetFocusRef.current = false;
  }, [mode, transitionError]);
  // Parking can move the Pond canvas offscreen. Never uncover that host until
  // its existing renderer has delivered a current-scene presentation receipt.
  const progress = gesture === null ? (mode === 'pathways' ? 1 : 0)
    : mode === 'pathways' && !pondPresentationReady ? 1 : gesture.progress;
  const sheetTransform = `translateY(${(1 - progress) * 100}%)`;
  if (textSafeRightCssPx !== null && (!Number.isFinite(textSafeRightCssPx)
    || textSafeRightCssPx < 0 || (workAreaRect && textSafeRightCssPx >= workAreaRect.width))) {
    throw new Error('ZEN_GARDEN_READING_INSET_INVALID');
  }
  return (
    <div ref={stageRef} className="zen-home-stage grid min-h-0 min-w-0 flex-1 gap-0 p-0"
      data-main-presentation-layer="vision-surfaces" data-garden-mode={mode}
      data-work-area-motion={animateWorkArea} data-sheet-dragging={gesture?.dragging === true}
      data-pond-presentation-ready={pondPresentationReady}>
      <section ref={pondRef}
        className="zen-home-pond-slot zen-home-pond-inframe relative min-h-0 min-w-0 overflow-hidden zen-main-vision-surface"
        data-main-presentation-surface="pond" inert={mode !== 'pond'}
        aria-hidden={mode !== 'pond'}
        style={{ clipPath: pondClipPath, pointerEvents: mode === 'pond' ? undefined : 'none' }}>
        <div className="zen-garden-pond-content" id={mode === 'pond' ? 'zen-garden-work-area' : undefined}>{pondSlot}</div>
      </section>
      <div className="zen-home-side-column flex h-full min-h-0 min-w-0 flex-col gap-[12px]">
        <Suspense fallback={pendingContent}>
          <div className="zen-home-rhythm-slot relative h-[68px] min-h-[68px] w-full shrink-0"
            data-main-presentation-layer="rhythm" data-main-presentation-surface="rhythm-marker">
            {rhythmSlot}
          </div>
        </Suspense>
        <div ref={bonsaiRef}
          className="zen-home-bonsai-slot zen-home-bonsai-breach relative min-h-0 min-w-0 flex-1 zen-main-vision-surface"
          data-main-presentation-surface="bonsai">
          {bonsaiSlot}
        </div>
      </div>
      {gardenPlanes}
      {pressureDock}
      {workAreaRect && (
        <div ref={sheetViewportRef} className="zen-garden-sheet-viewport"
          style={{ left: workAreaRect.x, top: workAreaRect.y, width: workAreaRect.width, height: workAreaRect.height }}>
          <div ref={sheetRef} className="zen-garden-pathways" id="zen-garden-ledger"
            data-reading-ready={textSafeRightCssPx !== null}
            data-text-safe-right={textSafeRightCssPx === null ? undefined : textSafeRightCssPx}
            onFocusCapture={() => { sheetFocusRef.current = true; }}
            onBlurCapture={(event) => {
              // Inert/removal can blur to body during commit. Preserve that
              // ownership, but never take focus back from another control.
              if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) sheetFocusRef.current = false;
            }}
            inert={mode !== 'pathways'} aria-hidden={mode !== 'pathways'}
            style={{ transform: sheetTransform,
              '--zen-garden-text-safe-right': textSafeRightCssPx === null ? undefined : `${textSafeRightCssPx}px` }}>
            <div className="zen-garden-pathways-content" inert={textSafeRightCssPx === null}
              id={mode === 'pathways' ? 'zen-garden-work-area' : undefined}><ZenHomeReadingSpace space={readingSpace} rootRef={sheetRef}>{pathwaysSlot}</ZenHomeReadingSpace></div>
          </div>
        </div>
      )}
      {gardenControlSlot && workAreaRect && (
        <div className="zen-garden-threshold-viewport"
          style={{ left: workAreaRect.x, top: workAreaRect.y, width: workAreaRect.width, height: workAreaRect.height }}>
          <div ref={edgeRef} className="zen-garden-threshold" style={{ transform: sheetTransform }}>
            {gardenControlSlot({ travelPx: workAreaRect.height, onProgress, readGestureProgress })}
          </div>
        </div>
      )}
    </div>
  );
}
