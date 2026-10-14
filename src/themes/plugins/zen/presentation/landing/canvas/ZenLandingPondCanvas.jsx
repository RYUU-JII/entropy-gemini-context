import { resolveRasterResolution } from '@/platform/rendering/renderBudgetContract.js';
import { observeDevicePixelRatio, readDevicePixelRatio } from '@/platform/rendering/devicePixelRatio.js';
import React, { useEffect, useRef } from 'react';

import { renderZenLandingPond } from './zenLandingPondRenderer.js';

const TARGET_FRAME_INTERVAL_MS = 1_000 / 30;

export default function ZenLandingPondCanvas({ presentation }) {
  const canvasRef = useRef(null);
  const frameInputRef = useRef({ presentation });
  const runtimeRef = useRef(null);
  frameInputRef.current = { presentation };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) throw new Error('ZEN_LANDING_POND_CANVAS_MOUNT_FAILED');
    if (typeof ResizeObserver !== 'function') {
      throw new Error('ZEN_LANDING_RESIZE_OBSERVER_REQUIRED');
    }
    if (typeof IntersectionObserver !== 'function') {
      throw new Error('ZEN_LANDING_INTERSECTION_OBSERVER_REQUIRED');
    }

    const context = canvas.getContext('2d', { alpha: true });
    if (!context) throw new Error('ZEN_LANDING_POND_CONTEXT_UNAVAILABLE');

    let animationFrame = 0;
    let pageVisible = !document.hidden;
    let stageVisible = true;
    let width = 0;
    let height = 0;
    let lastDrawAt = -Infinity;

    const draw = (timeMs = performance.now()) => {
      if (width <= 0 || height <= 0) return;
      renderZenLandingPond(context, {
        ...frameInputRef.current,
        height,
        timeSeconds: frameInputRef.current.presentation.state.motionMode === 'reduced'
          ? frameInputRef.current.presentation.visualProgress * 12
          : timeMs / 1000,
        width,
      });
    };

    const animate = (timeMs) => {
      animationFrame = 0;
      if (timeMs - lastDrawAt >= TARGET_FRAME_INTERVAL_MS) {
        draw(timeMs);
        lastDrawAt = timeMs;
      }
      if (
        pageVisible
        && stageVisible
        && frameInputRef.current.presentation.layers.pond > 0.001
        && frameInputRef.current.presentation.state.motionMode === 'full'
      ) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    const sync = () => {
      const shouldAnimate = pageVisible
        && stageVisible
        && frameInputRef.current.presentation.layers.pond > 0.001
        && frameInputRef.current.presentation.state.motionMode === 'full';
      if (shouldAnimate && animationFrame === 0) {
        animationFrame = requestAnimationFrame(animate);
      } else if (!shouldAnimate && animationFrame !== 0) {
        cancelAnimationFrame(animationFrame);
        animationFrame = 0;
        draw();
      } else if (!shouldAnimate) {
        draw();
      }
    };

    const resize = (nextWidth, nextHeight) => {
      if (nextWidth <= 0 || nextHeight <= 0) return;
      const { effectivePixelRatio: dpr, pixelWidth, pixelHeight } = resolveRasterResolution({ cssWidth: nextWidth, cssHeight: nextHeight, devicePixelRatio: readDevicePixelRatio(),
            pixelRatioCap: 2, maxRenderPixels: 8_294_400 });
      width = nextWidth;
      height = nextHeight;
      if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
      if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    };
    const resizeObserver = new ResizeObserver(([entry]) => resize(entry.contentRect.width, entry.contentRect.height));
    const stopDpr = observeDevicePixelRatio({ onChange: () => resize(width, height) });
    resizeObserver.observe(canvas);

    const intersectionObserver = new IntersectionObserver(([entry]) => {
      stageVisible = entry.isIntersecting;
      sync();
    }, { threshold: 0.01 });
    intersectionObserver.observe(canvas);

    const onVisibilityChange = () => {
      pageVisible = !document.hidden;
      sync();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    runtimeRef.current = { sync };
    sync();

    return () => {
      runtimeRef.current = null;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      intersectionObserver.disconnect();
      resizeObserver.disconnect();
      stopDpr();
      if (animationFrame !== 0) cancelAnimationFrame(animationFrame);
    };
  }, []);

  useEffect(() => {
    runtimeRef.current?.sync();
  }, [presentation]);

  return (
    <canvas
      ref={canvasRef}
      className="zenLandingPond"
      aria-hidden="true"
    />
  );
}
