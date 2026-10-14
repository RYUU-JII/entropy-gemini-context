import { resolveZenPondViewportLayout } from '../../../runtime/zenPondViewportPolicy.js';
const requireDpr = value => {
  if (!Number.isFinite(value) || value <= 0) throw new Error('ZEN_POND_DEVICE_PIXEL_RATIO_INVALID');
  return value;
};

const toPositiveSize = (value, fallback = 1) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return Math.max(1, Math.floor(fallback || 1));
  return Math.max(1, Math.floor(numeric));
};

export const applyZenPondWorkerCanvasInit = ({
  state,
  payload = {},
  ensureCanvasEventSurface,
} = {}) => {
  const nextCanvas = payload?.canvas;
  if (!nextCanvas || typeof nextCanvas.getContext !== 'function') {
    return {
      ok: false,
      reason: 'OFFSCREEN_CANVAS_UNAVAILABLE',
    };
  }

  state.canvas = nextCanvas;
  ensureCanvasEventSurface(state.canvas);
  const viewportWidth = toPositiveSize(payload?.viewportWidth ?? payload?.width, 1);
  const viewportHeight = toPositiveSize(payload?.viewportHeight ?? payload?.height, 1);
  const layout = resolveZenPondViewportLayout({ width: viewportWidth, height: viewportHeight });
  state.sceneLayout = layout;
  state.viewportWidth = viewportWidth;
  state.viewportHeight = viewportHeight;
  state.refs.viewportSizeRef.current = {
    width: viewportWidth,
    height: viewportHeight,
  };
  state.width = layout.width;
  state.height = layout.height;
  state.dpr = requireDpr(payload.dpr);
  state.active = payload?.active !== false;
  state.refs.animationEnabledRef.current = state.active;

  const sceneGenerationKey = typeof payload?.sceneGenerationKey === 'string' && payload.sceneGenerationKey.trim()
    ? payload.sceneGenerationKey.trim()
    : '';
  state.sceneGenerationKey = sceneGenerationKey || `seed_${Math.floor(Number(payload?.seed) || 0)}`;
  state.refs.sessionSaltRef.current = Number(payload?.seed) || 0;

  return {
    ok: true,
    viewportWidth: state.viewportWidth,
    viewportHeight: state.viewportHeight,
    width: state.width,
    height: state.height,
    dpr: state.dpr,
  };
};

export const applyZenPondWorkerCanvasResize = ({
  state,
  payload = {},
} = {}) => {
  const nextViewportWidth = toPositiveSize(payload?.viewportWidth ?? payload?.width, state.viewportWidth || state.width || 1);
  const nextViewportHeight = toPositiveSize(payload?.viewportHeight ?? payload?.height, state.viewportHeight || state.height || 1);
  const nextDpr = requireDpr(payload.dpr);

  state.viewportWidth = nextViewportWidth;
  state.viewportHeight = nextViewportHeight;
  state.refs.viewportSizeRef.current = {
    width: nextViewportWidth,
    height: nextViewportHeight,
  };
  state.dpr = nextDpr;

  return {
    viewportWidth: state.viewportWidth,
    viewportHeight: state.viewportHeight,
    width: state.width,
    height: state.height,
    dpr: state.dpr,
  };
};
