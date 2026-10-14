import { resolveCeremonyResolution } from './ceremonyContracts.js';
import {
  FIRST_VISION_DESCENT_CEREMONY_ID,
  FIRST_VISION_DESCENT_DURATION_MS,
  createFirstVisionDescentPlaybackClock,
  createCeremonyRenderState,
  drawCeremonyFrame,
  getCeremonyDurationMs,
} from './ceremonyRendererCore.js';
import {
  FIRST_VISION_DESCENT_RENDER_PROFILE,
} from './ceremonyContracts.js';

const requestFrame = typeof self.requestAnimationFrame === 'function'
  ? self.requestAnimationFrame.bind(self)
  : (callback) => setTimeout(() => callback(performance.now()), 16);

const cancelFrame = typeof self.cancelAnimationFrame === 'function'
  ? self.cancelAnimationFrame.bind(self)
  : clearTimeout;

let canvas = null;
let ctx = null;
let cssWidth = 1;
let cssHeight = 1;
let dpr = 1;
let ceremonyId = FIRST_VISION_DESCENT_CEREMONY_ID;
let durationMs = FIRST_VISION_DESCENT_DURATION_MS;
let renderState = null;
let startedAt = 0;
let lastRenderedAt = 0;
let frameHandle = 0;
let completed = false;
let coverOpaqueReported = false;
let disposed = false;
let playbackClock = null;

function resizeCanvas() {
  if (!canvas || !ctx) return;
  const pixelWidth = Math.max(1, Math.floor(cssWidth * dpr));
  const pixelHeight = Math.max(1, Math.floor(cssHeight * dpr));
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function postComplete() {
  if (completed) return;
  completed = true;
  self.postMessage({
    type: 'complete',
    elapsedMs: durationMs,
  });
}

function postCoverOpaque(elapsedMs) {
  if (coverOpaqueReported) return;
  coverOpaqueReported = true;
  self.postMessage({
    type: 'cover_opaque',
    elapsedMs,
  });
}

function scheduleFrame() {
  if (disposed || frameHandle) return;
  frameHandle = requestFrame(tick);
}

function tick(nowMs) {
  if (disposed || !ctx) return;
  frameHandle = 0;
  const normalizedNowMs = Math.max(0, Number(nowMs) || 0);
  const isFirstVisionDescent = ceremonyId === FIRST_VISION_DESCENT_CEREMONY_ID;
  const minimumFrameIntervalMs = isFirstVisionDescent
    ? (1000 / FIRST_VISION_DESCENT_RENDER_PROFILE.targetFps)
    : 0;
  if (
    lastRenderedAt > 0
    && minimumFrameIntervalMs > 0
    && normalizedNowMs - lastRenderedAt < minimumFrameIntervalMs
  ) {
    scheduleFrame();
    return;
  }
  lastRenderedAt = normalizedNowMs;
  const playback = playbackClock?.advance(normalizedNowMs) || Object.freeze({
    elapsedMs: Math.max(0, normalizedNowMs - startedAt),
    holding: false,
  });
  const progress = drawCeremonyFrame(ctx, {
    ceremonyId,
    width: cssWidth,
    height: cssHeight,
    elapsedMs: playback.elapsedMs,
    renderState,
  });
  if (progress?.coverOpaque === true) {
    postCoverOpaque(playback.elapsedMs);
  }
  if (playback.elapsedMs >= durationMs + 80) {
    postComplete();
    return;
  }
  if (playback.holding) return;
  scheduleFrame();
}

function start(payload = {}) {
  canvas = payload.canvas || null;
  if (!canvas || typeof canvas.getContext !== 'function') {
    throw new Error('CEREMONY_WORKER_CANVAS_REQUIRED');
  }
  cssWidth = Math.max(1, Number(payload.width) || 1);
  cssHeight = Math.max(1, Number(payload.height) || 1);
  ceremonyId = payload.ceremonyId || FIRST_VISION_DESCENT_CEREMONY_ID;
  dpr = resolveCeremonyResolution({ ceremonyId, width: cssWidth, height: cssHeight,
    devicePixelRatio: payload.dpr }).effectivePixelRatio;
  durationMs = getCeremonyDurationMs(ceremonyId) || FIRST_VISION_DESCENT_DURATION_MS;
  ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) {
    throw new Error('CEREMONY_WORKER_CONTEXT_UNAVAILABLE');
  }
  renderState = createCeremonyRenderState({
    ceremonyId,
    width: cssWidth,
    height: cssHeight,
    seed: Number(payload.seed) || 872342,
  });
  resizeCanvas();
  startedAt = performance.now();
  lastRenderedAt = 0;
  completed = false;
  coverOpaqueReported = false;
  disposed = false;
  playbackClock = ceremonyId === FIRST_VISION_DESCENT_CEREMONY_ID
    ? createFirstVisionDescentPlaybackClock({
      holdAtCover: payload.holdAtCover === true,
      releaseCover: payload.releaseCover === true,
    })
    : null;
  scheduleFrame();
}

self.onmessage = (event) => {
  const message = event?.data || {};
  const type = String(message?.type || '');
  try {
    if (type === 'init') {
      start(message.payload || {});
      return;
    }
    if (type === 'resize') {
      cssWidth = Math.max(1, Number(message?.payload?.width) || cssWidth);
      cssHeight = Math.max(1, Number(message?.payload?.height) || cssHeight);
      dpr = resolveCeremonyResolution({ ceremonyId, width: cssWidth, height: cssHeight,
        devicePixelRatio: message.payload.dpr }).effectivePixelRatio;
      resizeCanvas();
      ceremonyId = message?.payload?.ceremonyId || ceremonyId;
      durationMs = getCeremonyDurationMs(ceremonyId) || durationMs;
      renderState = createCeremonyRenderState({
        ceremonyId,
        width: cssWidth,
        height: cssHeight,
        seed: Number(message?.payload?.seed) || 872342,
      });
      return;
    }
    if (type === 'control') {
      if (!playbackClock) return;
      const previous = playbackClock.snapshot();
      const next = playbackClock.setControls({
        holdAtCover: message?.payload?.holdAtCover === true,
        releaseCover: message?.payload?.releaseCover === true,
      });
      if (previous.holding && !next.holding) {
        lastRenderedAt = 0;
        scheduleFrame();
      }
      return;
    }
    if (type === 'dispose') {
      disposed = true;
      if (frameHandle) {
        cancelFrame(frameHandle);
        frameHandle = 0;
      }
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: String(error?.message || error || 'CEREMONY_WORKER_ERROR'),
    });
  }
};
