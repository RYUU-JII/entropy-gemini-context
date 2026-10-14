import { useEffect, useState } from 'react';

const LANDSCAPE_MARGIN_SIDE_MIN = 56;
const LANDSCAPE_MARGIN_SIDE_MAX = 120;
const LANDSCAPE_MARGIN_SIDE_RATIO = 0.05;
const LANDSCAPE_MARGIN_TOP_MIN = 28;
const LANDSCAPE_MARGIN_TOP_MAX = 44;
const LANDSCAPE_MARGIN_TOP_RATIO = 0.032;
const LANDSCAPE_MARGIN_BOTTOM_MIN = 14;
const LANDSCAPE_MARGIN_BOTTOM_MAX = 24;
const LANDSCAPE_MARGIN_BOTTOM_RATIO = 0.02;
const PORTRAIT_MARGIN_X = 14;
const PORTRAIT_MARGIN_Y = 14;

const PORTRAIT_ASPECT_MAX = 0.95;
const LANDSCAPE_ASPECT_MIN = 1.05;
const PORTRAIT_DESKTOP_MIN_WIDTH = 800;
const PORTRAIT_DESKTOP_MIN_HEIGHT = 1200;
const SCALE_BASE = 390;
const SCALE_MIN = 0.85;
const SCALE_MAX = 1.25;
const DENSITY_MIN = 0.9;
const DENSITY_MAX = 1.2;
const FONT_MIN = 0.92;
const FONT_MAX = 1.12;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const VIEWPORT_LAYOUT_MODES = Object.freeze({
  LANDSCAPE: 'landscape',
  PORTRAIT_COMPACT: 'portrait-compact',
  PORTRAIT_DESKTOP: 'portrait-desktop',
});

function resolveOrientation(width, height, previousMode = 'landscape') {
  const aspect = width / Math.max(1, height);
  if (aspect <= PORTRAIT_ASPECT_MAX) return 'portrait';
  if (aspect >= LANDSCAPE_ASPECT_MIN) return 'landscape';
  return previousMode;
}

export function resolveViewportLayoutMode({
  width,
  height,
  isPortrait,
} = {}) {
  if (isPortrait !== true) {
    return VIEWPORT_LAYOUT_MODES.LANDSCAPE;
  }
  if (
    Number(width) >= PORTRAIT_DESKTOP_MIN_WIDTH
    && Number(height) >= PORTRAIT_DESKTOP_MIN_HEIGHT
  ) {
    return VIEWPORT_LAYOUT_MODES.PORTRAIT_DESKTOP;
  }
  return VIEWPORT_LAYOUT_MODES.PORTRAIT_COMPACT;
}

function resolveLandscapeMargins(width, height) {
  const marginSide = Math.round(clamp(
    width * LANDSCAPE_MARGIN_SIDE_RATIO,
    LANDSCAPE_MARGIN_SIDE_MIN,
    LANDSCAPE_MARGIN_SIDE_MAX
  ));
  const marginTop = Math.round(clamp(
    height * LANDSCAPE_MARGIN_TOP_RATIO,
    LANDSCAPE_MARGIN_TOP_MIN,
    LANDSCAPE_MARGIN_TOP_MAX
  ));
  const marginBottom = Math.round(clamp(
    height * LANDSCAPE_MARGIN_BOTTOM_RATIO,
    LANDSCAPE_MARGIN_BOTTOM_MIN,
    LANDSCAPE_MARGIN_BOTTOM_MAX
  ));

  return {
    marginTop,
    marginRight: marginSide,
    marginBottom,
    marginLeft: marginSide,
  };
}

function readViewportState(previousMode = 'landscape') {
  if (typeof window === 'undefined') {
    return {
      width: 0,
      height: 0,
      isPortrait: false,
      layoutMode: VIEWPORT_LAYOUT_MODES.LANDSCAPE,
      uiMode: 'landscape',
      uiScale: 1,
      densityScale: 1,
      fontScale: 1,
      scalerEnabled: true,
      marginX: LANDSCAPE_MARGIN_SIDE_MIN,
      marginY: LANDSCAPE_MARGIN_TOP_MIN,
      marginTop: LANDSCAPE_MARGIN_TOP_MIN,
      marginRight: LANDSCAPE_MARGIN_SIDE_MIN,
      marginBottom: LANDSCAPE_MARGIN_BOTTOM_MIN,
      marginLeft: LANDSCAPE_MARGIN_SIDE_MIN,
    };
  }

  const width = Math.max(1, window.innerWidth || document.documentElement?.clientWidth || 1);
  const height = Math.max(1, window.innerHeight || document.documentElement?.clientHeight || 1);
  const orientation = resolveOrientation(width, height, previousMode);
  const isPortrait = orientation === 'portrait';
  const layoutMode = resolveViewportLayoutMode({ width, height, isPortrait });
  const uiMode = isPortrait ? 'portrait' : 'landscape';
  const shortEdge = Math.min(width, height);

  const rawScale = shortEdge / SCALE_BASE;
  const uiScale = clamp(rawScale, SCALE_MIN, SCALE_MAX);
  const densityScale = clamp(uiScale * (isPortrait ? 0.98 : 1), DENSITY_MIN, DENSITY_MAX);
  const fontScale = clamp(uiScale * (isPortrait ? 0.99 : 1), FONT_MIN, FONT_MAX);
  const landscapeMargins = resolveLandscapeMargins(width, height);
  const marginTop = isPortrait ? PORTRAIT_MARGIN_Y : landscapeMargins.marginTop;
  const marginRight = isPortrait ? PORTRAIT_MARGIN_X : landscapeMargins.marginRight;
  const marginBottom = isPortrait ? PORTRAIT_MARGIN_Y : landscapeMargins.marginBottom;
  const marginLeft = isPortrait ? PORTRAIT_MARGIN_X : landscapeMargins.marginLeft;

  return {
    width,
    height,
    isPortrait,
    layoutMode,
    uiMode,
    uiScale,
    densityScale,
    fontScale,
    scalerEnabled: !isPortrait,
    marginX: marginLeft,
    marginY: marginTop,
    marginTop,
    marginRight,
    marginBottom,
    marginLeft,
  };
}

export function useViewportRuntime() {
  const [viewportState, setViewportState] = useState(() => readViewportState('landscape'));

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    let rafId = 0;
    const update = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        setViewportState((prev) => readViewportState(prev?.uiMode || 'landscape'));
        rafId = 0;
      });
    };

    update();
    window.addEventListener('resize', update, { passive: true });
    window.addEventListener('orientationchange', update, { passive: true });

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return viewportState;
}
