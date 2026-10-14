import { useLayoutEffect, useState } from 'react';

import { resolveZenHomeCompositionLayoutFrame } from './zenHomeCompositionLayoutFrame.js';

const readElementRect = (element) => {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 ? rect : null;
};

const readCommittedViewportExtent = (layoutHost, axis) => {
  const value = layoutHost.style.getPropertyValue(`--ui-viewport-${axis}`).trim();
  if (!/^\d+(?:\.\d+)?px$/u.test(value) || Number.parseFloat(value) <= 0) {
    throw new Error(`ZEN_HOME_COMPOSITION_VIEWPORT_EPOCH_${axis.toUpperCase()}_INVALID`);
  }
  return Number.parseFloat(value);
};

export function useZenHomeCompositionLayoutFrame({
  enabled = false,
  retainFrameWhenDisabled = false,
  stageRef,
  pondRef,
  bonsaiRef,
  pressureRailRef,
} = {}) {
  const [snapshot, setSnapshot] = useState(() => ({ frame: null, signature: '', error: null }));

  useLayoutEffect(() => {
    if (!enabled) {
      if (!retainFrameWhenDisabled) {
        setSnapshot((current) => (
          current.frame === null && current.error === null
            ? current
            : { frame: null, signature: '', error: null }
        ));
      }
      return undefined;
    }

    const stage = stageRef.current;
    const pond = pondRef.current;
    const bonsai = bonsaiRef.current;
    const rail = pressureRailRef.current;
    if (!stage || !pond || !bonsai || !rail) return undefined;

    const layoutHost = stage.closest('[data-ui-layout]');
    if (!layoutHost) {
      setSnapshot({
        frame: null,
        signature: '',
        error: new Error('ZEN_HOME_COMPOSITION_LAYOUT_HOST_REQUIRED'),
      });
      return undefined;
    }

    let detached = false;
    const publish = () => {
      if (detached) return;
      try {
        // Native resize precedes the viewport owner's RAF/React commit. CSS
        // may already use the new window size with the previous layout mode;
        // compiling those intermediate slots can produce an impossible seam.
        // Only measure the epoch already committed by that owner to this host.
        const viewportWidth = readCommittedViewportExtent(layoutHost, 'width');
        const viewportHeight = readCommittedViewportExtent(layoutHost, 'height');
        if (viewportWidth !== window.innerWidth || viewportHeight !== window.innerHeight) return;
        const stageRect = readElementRect(stage);
        const pondRect = readElementRect(pond);
        const bonsaiRect = readElementRect(bonsai);
        const pressureRailRect = readElementRect(rail);
        // Hidden/settling slots retain the last committed geometry and renderer
        // identity. First measurement stays pending, never guesses a safe area.
        if (!stageRect || !pondRect || !bonsaiRect || !pressureRailRect) return;
        const frame = resolveZenHomeCompositionLayoutFrame({
          layoutMode: layoutHost.getAttribute('data-ui-layout'),
          stageRect, pondRect, bonsaiRect, pressureRailRect,
        });
        const signature = JSON.stringify(frame);
        setSnapshot((current) => {
          if (current.signature === signature && current.error === null) return current;
          // A pressure-only layout change must not invalidate garden-bed ACKs.
          const gardenBedUnchanged = current.frame !== null
            && JSON.stringify(current.frame.gardenBed) === JSON.stringify(frame.gardenBed);
          return {
            frame: gardenBedUnchanged
              ? Object.freeze({ ...frame, gardenBed: current.frame.gardenBed })
              : frame,
            signature,
            error: null,
          };
        });
      } catch (error) {
        setSnapshot({
          frame: null,
          signature: '',
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    };

    publish();
    const resizeObserver = new ResizeObserver(publish);
    [stage, pond, bonsai, rail].forEach((element) => resizeObserver.observe(element));
    const layoutObserver = new MutationObserver(publish);
    layoutObserver.observe(layoutHost, { attributes: true, attributeFilter: ['data-ui-layout', 'style'] });
    window.addEventListener('resize', publish);

    return () => {
      detached = true;
      resizeObserver.disconnect();
      layoutObserver.disconnect();
      window.removeEventListener('resize', publish);
    };
  }, [bonsaiRef, enabled, pondRef, pressureRailRef, retainFrameWhenDisabled, stageRef]);

  if (snapshot.error) throw snapshot.error;
  return snapshot.frame;
}
