import {
  ZEN_ENSO_FORM,
  ZEN_ENSO_RENDER_TIMING,
  createZenEnsoRenderer,
  hashZenEnsoSeed,
} from './ZenEnsoCanvas.js';
import { resolveRasterResolution } from '@/platform/rendering/renderBudgetContract.js';

const workerScope = typeof self !== 'undefined' ? self : null;

const requestFrame = workerScope && typeof workerScope.requestAnimationFrame === 'function'
  ? workerScope.requestAnimationFrame.bind(workerScope)
  : (callback) => setTimeout(() => callback(nowMs()), 16);

const cancelFrame = workerScope && typeof workerScope.cancelAnimationFrame === 'function'
  ? workerScope.cancelAnimationFrame.bind(workerScope)
  : clearTimeout;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (from, to, t) => from + ((to - from) * t);

function easeInOutCubic(value) {
  const t = clamp(value, 0, 1);
  return t < 0.5
    ? 4 * t * t * t
    : 1 - (((-2 * t) + 2) ** 3 / 2);
}

function nowMs() {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

function normalizeMetrics(payload = {}, fallback = {}) {
  const width = Math.max(1, Number(payload.width) || fallback.width || 1);
  const height = Math.max(1, Number(payload.height) || fallback.height || 1);
  const { effectivePixelRatio: dpr } = resolveRasterResolution({ cssWidth: width, cssHeight: height,
    devicePixelRatio: payload.dpr ?? fallback.dpr ?? 1, pixelRatioCap: 2, maxRenderPixels: 8_294_400 });
  return { width, height, dpr };
}

let canvas = null;
let ctx = null;
let renderer = null;
let metrics = normalizeMetrics();
let seed = 'zen-enso-loader';
let form = ZEN_ENSO_FORM.PRACTICE;
let includePaper = false;
let inkFillMode = 'ink';
let renderMode = 'animated';
let durationMs = 2200;
let cosmicBreath = false;
let reducedMotion = false;
let frameHandle = 0;
let startTime = null;
let lastProgress = 0;
let ambientStartTime = 0;
let lastAmbientFrameTime = 0;
let finished = false;
let disposed = false;
let firstFramePosted = false;
let completionPosted = false;

function completeStroke() {
  finished = true;
  lastProgress = 1;
  if (completionPosted) return;
  completionPosted = true;
  postMessageSafe('stroke_complete', { form, renderMode, reducedMotion });
}

function postMessageSafe(type, payload = {}) {
  try {
    workerScope?.postMessage?.({ type, payload });
  } catch (_) {
    // Telemetry delivery should not take down the presentation renderer.
  }
}

function cancelCurrentFrame() {
  if (!frameHandle) return;
  cancelFrame(frameHandle);
  frameHandle = 0;
}

function postFirstFrameOnce() {
  if (firstFramePosted) return;
  firstFramePosted = true;
  postMessageSafe('first_frame', {
    width: metrics.width,
    height: metrics.height,
    dpr: metrics.dpr,
    renderMode,
    reducedMotion,
  });
}

function shouldRunCosmicBreath() {
  return inkFillMode === 'cosmic' && cosmicBreath === true && !reducedMotion;
}

function ensureRenderer(payload = {}) {
  canvas = payload.canvas || canvas;
  if (!canvas || typeof canvas.getContext !== 'function') {
    throw new Error('DASHBOARD_BOOT_WORKER_CANVAS_REQUIRED');
  }

  metrics = normalizeMetrics(payload, metrics);
  seed = String(payload.seed || seed || 'zen-enso-loader');
  form = payload.form === ZEN_ENSO_FORM.COMPLETE ? ZEN_ENSO_FORM.COMPLETE : ZEN_ENSO_FORM.PRACTICE;
  includePaper = payload.includePaper === true;
  inkFillMode = payload.inkFillMode === 'cosmic' ? 'cosmic' : 'ink';
  renderMode = payload.renderMode === 'static' ? 'static' : 'animated';
  durationMs = payload.durationMs;
  if (!Number.isFinite(durationMs) || durationMs <= ZEN_ENSO_RENDER_TIMING.HEAD_HOLD_MS) {
    throw new Error('DASHBOARD_BOOT_PRESENTATION_DURATION_INVALID');
  }
  cosmicBreath = payload.cosmicBreath === true;
  reducedMotion = payload.reducedMotion === true;

  ctx = canvas.getContext('2d', { alpha: !includePaper });
  if (!ctx) {
    throw new Error('DASHBOARD_BOOT_WORKER_CONTEXT_UNAVAILABLE');
  }

  renderer = createZenEnsoRenderer(canvas, ctx, hashZenEnsoSeed(seed), {
    form,
    includePaper,
    inkFillMode,
    resolveMetrics: () => metrics,
  });
}

function renderAmbient(timestamp) {
  if (disposed || !renderer) return;

  if (!ambientStartTime) {
    ambientStartTime = timestamp;
  }

  if (
    lastAmbientFrameTime
    && timestamp - lastAmbientFrameTime < ZEN_ENSO_RENDER_TIMING.COSMIC_TWINKLE_FRAME_MS
  ) {
    frameHandle = requestFrame(renderAmbient);
    return;
  }

  lastAmbientFrameTime = timestamp;
  renderer.drawAmbient((timestamp - ambientStartTime) / 1000);
  frameHandle = requestFrame(renderAmbient);
}

function startCosmicBreath(timestamp = 0) {
  cancelCurrentFrame();
  if (!shouldRunCosmicBreath()) return;
  ambientStartTime = timestamp || 0;
  lastAmbientFrameTime = 0;
  frameHandle = requestFrame(renderAmbient);
}

function renderFrame(timestamp) {
  if (disposed || !renderer) return;

  if (startTime === null) {
    startTime = timestamp;
  }

  if (reducedMotion) {
    renderer.drawStatic();
    completeStroke();
    frameHandle = 0;
    postFirstFrameOnce();
    return;
  }

  const elapsedMs = timestamp - startTime - ZEN_ENSO_RENDER_TIMING.HEAD_HOLD_MS;
  const easedProgress = easeInOutCubic(elapsedMs / (durationMs - ZEN_ENSO_RENDER_TIMING.HEAD_HOLD_MS));
  const progress = lerp(ZEN_ENSO_RENDER_TIMING.HEAD_PRELOAD_PROGRESS, 1, easedProgress);
  renderer.drawFrame(progress);
  lastProgress = progress;
  postFirstFrameOnce();

  if (progress < 1) {
    frameHandle = requestFrame(renderFrame);
    return;
  }

  completeStroke();
  startCosmicBreath(timestamp);
}

function restart() {
  if (!renderer) return;
  cancelCurrentFrame();
  startTime = null;
  finished = false;
  renderer.reset();

  if (renderMode === 'static' || reducedMotion) {
    renderer.drawStatic();
    postFirstFrameOnce();
    completeStroke();
    startCosmicBreath();
    return;
  }

  lastProgress = ZEN_ENSO_RENDER_TIMING.HEAD_PRELOAD_PROGRESS;
  renderer.drawFrame(lastProgress);
  postFirstFrameOnce();
  frameHandle = requestFrame(renderFrame);
}

function handleInit(payload = {}) {
  cancelCurrentFrame();
  disposed = false;
  firstFramePosted = false;
  completionPosted = false;
  ensureRenderer(payload);
  restart();
  postMessageSafe('ready', {
    width: metrics.width,
    height: metrics.height,
    dpr: metrics.dpr,
  });
}

function handleResize(payload = {}) {
  if (!renderer) return;
  const nextMetrics = normalizeMetrics(payload, metrics);
  if (nextMetrics.width === metrics.width && nextMetrics.height === metrics.height && nextMetrics.dpr === metrics.dpr) return;
  metrics = nextMetrics;
  renderer.reset();

  if (renderMode === 'static' || finished || reducedMotion) {
    renderer.drawStatic();
    completeStroke();
    startCosmicBreath();
    return;
  }

  // Rebuild at the new resolution without resetting the stroke clock or its
  // position. The already scheduled frame continues the same gesture.
  renderer.drawFrame(lastProgress);
}

function handleMotion(payload = {}) {
  const nextReducedMotion = payload.reducedMotion === true;
  if (nextReducedMotion === reducedMotion) return;
  reducedMotion = nextReducedMotion;
  if (reducedMotion) {
    cancelCurrentFrame();
    renderer.drawStatic();
    completeStroke();
  } else if (finished) {
    startCosmicBreath();
  }
}

function handleDispose() {
  disposed = true;
  cancelCurrentFrame();
  renderer = null;
  ctx = null;
  canvas = null;
}

if (workerScope) {
  workerScope.onmessage = (event) => {
  const message = event?.data || {};
  const type = String(message.type || '');

  try {
    if (type === 'init') {
      handleInit(message.payload || {});
      return;
    }
    if (type === 'resize') {
      handleResize(message.payload || {});
      return;
    }
    if (type === 'motion') {
      handleMotion(message.payload || {});
      return;
    }
    if (type === 'dispose') {
      handleDispose();
    }
  } catch (error) {
    postMessageSafe('error', {
      error: String(error?.message || error || 'DASHBOARD_BOOT_WORKER_ERROR'),
    });
  }
  };
}
