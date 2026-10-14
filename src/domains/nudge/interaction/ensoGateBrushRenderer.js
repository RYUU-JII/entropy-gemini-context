const TAU = Math.PI * 2;
const BRISTLE_LANES = Object.freeze([-0.38, -0.19, 0.04, 0.23, 0.39]);
import { CLICK_ENSO_INK_SETTLE_MS } from './interactionConstants.js';

const rendererByCanvas = new WeakMap();

function clamp(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.min(max, Math.max(min, numeric));
}

function smoothstep(edge0, edge1, value) {
  const span = Math.max(0.0001, edge1 - edge0);
  const t = clamp((value - edge0) / span, 0, 1);
  return t * t * (3 - (2 * t));
}

function distanceBetween(a, b) {
  if (!a || !b) return 0;
  return Math.hypot((Number(a.x) || 0) - (Number(b.x) || 0), (Number(a.y) || 0) - (Number(b.y) || 0));
}

function deterministicNoise(seed) {
  const raw = Math.sin((Number(seed) + 1) * 12.9898) * 43758.5453;
  return raw - Math.floor(raw);
}

function getPointTime(point, fallback) {
  const at = Number(point?.at);
  return Number.isFinite(at) ? at : fallback;
}

export function createEnsoGateBrushSample({
  point,
  previousPoint = null,
  previousSample = null,
  radius = 112,
  index = 0,
} = {}) {
  const normalizedRadius = Math.max(48, Number(radius) || 112);
  const distance = previousPoint ? distanceBetween(previousPoint, point) : 0;
  const previousArcLength = Number(previousSample?.arcLength) || 0;
  const arcLength = previousArcLength + distance;
  const fallbackAt = (Number(previousSample?.at) || 0) + 16;
  const at = getPointTime(point, fallbackAt);
  const previousAt = getPointTime(previousPoint, at - 16);
  const elapsedMs = clamp(at - previousAt, 4, 42);
  const speedPxPerMs = distance / elapsedMs;
  const speedScale = Math.max(0.72, normalizedRadius * 0.0115);
  const speedTone = smoothstep(0.08, speedScale, speedPxPerMs);
  const targetPressure = clamp(1.16 - (speedTone * 0.6), 0.56, 1.16);
  const previousPressure = Number(previousSample?.pressure);
  const pressure = Number.isFinite(previousPressure)
    ? previousPressure + ((targetPressure - previousPressure) * 0.38)
    : targetPressure;
  const turnProgress = clamp(arcLength / Math.max(1, TAU * normalizedRadius), 0, 1.35);
  const tailDryness = smoothstep(0.3, 1.02, turnProgress);
  const noise = deterministicNoise((index * 7) + 3) - 0.5;
  const inkLoad = clamp(1.04 - (tailDryness * 0.28) - (speedTone * 0.065) + (noise * 0.04), 0.64, 1.08);
  const baseWidth = clamp(normalizedRadius * 0.215, 16, 29);
  const startLoad = 1 + ((1 - smoothstep(0, normalizedRadius * 0.42, arcLength)) * 0.24);
  const width = baseWidth * (0.49 + (pressure * 0.5)) * inkLoad * startLoad;

  return {
    x: Number(point?.x) || 0,
    y: Number(point?.y) || 0,
    at,
    arcLength,
    turnProgress,
    speedPxPerMs,
    pressure,
    inkLoad,
    dryness: clamp(tailDryness * (0.72 + (speedTone * 0.28)), 0, 1),
    width,
  };
}

function createInkLayer(canvas) {
  const layer = canvas?.ownerDocument?.createElement?.('canvas');
  if (!layer || typeof layer.getContext !== 'function') {
    throw new Error('ENSO_GATE_INK_LAYER_UNAVAILABLE');
  }
  const ctx = layer.getContext('2d', { alpha: true });
  if (!ctx) throw new Error('ENSO_GATE_INK_LAYER_CONTEXT_UNAVAILABLE');
  return { layer, ctx };
}

function clearInkState(state, { width, height, dpr, bounds = null }) {
  const layerBounds = bounds || { x: 0, y: 0, width, height };
  state.layer.width = Math.max(1, Math.round(width * dpr));
  state.layer.height = Math.max(1, Math.round(height * dpr));
  state.ctx.setTransform(dpr, 0, 0, dpr, -layerBounds.x * dpr, -layerBounds.y * dpr);
  state.ctx.clearRect(layerBounds.x, layerBounds.y, width, height);
  state.width = width;
  state.height = height;
  state.dpr = dpr;
  state.bounds = { ...layerBounds };
  state.lastSequence = null;
  state.drawnSegmentCount = 0;
  state.lastPoint = null;
  state.lastSample = null;
  state.sealed = false;
  state.settleStartedAt = null;
}

function ensureRendererState(canvas, metrics) {
  let state = rendererByCanvas.get(canvas);
  if (!state) {
    const inkLayer = createInkLayer(canvas);
    state = {
      ...inkLayer,
      width: 0,
      height: 0,
      dpr: 1,
      bounds: null,
      lastSequence: null,
      drawnSegmentCount: 0,
      lastPoint: null,
      lastSample: null,
      sealed: false,
      settleStartedAt: null,
    };
    rendererByCanvas.set(canvas, state);
  }
  if (
    state.width !== metrics.width
    || state.height !== metrics.height
    || state.dpr !== metrics.dpr
    || state.bounds?.x !== metrics.bounds?.x
    || state.bounds?.y !== metrics.bounds?.y
  ) {
    clearInkState(state, metrics);
  }
  return state;
}

function drawStartPool(ctx, sample, index) {
  const angle = (deterministicNoise(index + 91) - 0.5) * 0.36;
  ctx.save();
  ctx.translate(sample.x, sample.y);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(19, 25, 21, 0.94)';
  ctx.beginPath();
  ctx.ellipse(0, 0, sample.width * 0.61, sample.width * 0.49, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawBodySegment(ctx, previous, sample, index) {
  const dx = sample.x - previous.x;
  const dy = sample.y - previous.y;
  const length = Math.hypot(dx, dy);
  if (length < 0.001) return;
  const nx = -dy / length;
  const ny = dx / length;
  const previousHalfWidth = previous.width * 0.5;
  const halfWidth = sample.width * 0.5;
  const bodyAlpha = clamp(0.91 + (sample.inkLoad * 0.065) - (sample.dryness * 0.035), 0.88, 0.98);

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = `rgba(23, 30, 25, ${clamp(0.055 + (sample.inkLoad * 0.035), 0.05, 0.1)})`;
  ctx.lineWidth = Math.max(previous.width, sample.width) * 1.14;
  ctx.beginPath();
  ctx.moveTo(previous.x, previous.y);
  ctx.lineTo(sample.x, sample.y);
  ctx.stroke();

  ctx.fillStyle = `rgba(22, 28, 24, ${bodyAlpha})`;
  ctx.beginPath();
  ctx.moveTo(previous.x + (nx * previousHalfWidth), previous.y + (ny * previousHalfWidth));
  ctx.lineTo(sample.x + (nx * halfWidth), sample.y + (ny * halfWidth));
  ctx.lineTo(sample.x - (nx * halfWidth), sample.y - (ny * halfWidth));
  ctx.lineTo(previous.x - (nx * previousHalfWidth), previous.y - (ny * previousHalfWidth));
  ctx.closePath();
  ctx.fill();

  ctx.translate(sample.x, sample.y);
  ctx.rotate(Math.atan2(dy, dx));
  ctx.fillStyle = `rgba(19, 25, 21, ${bodyAlpha * 0.96})`;
  ctx.beginPath();
  ctx.ellipse(0, 0, Math.max(length * 0.54, halfWidth * 0.44), halfWidth, 0, 0, TAU);
  ctx.fill();
  ctx.restore();

  BRISTLE_LANES.forEach((lane, laneIndex) => {
    const laneNoise = deterministicNoise((index * 17) + (laneIndex * 29));
    const laneOffset = lane * ((previous.width + sample.width) * 0.5);
    const dropout = sample.dryness > 0.26 && laneNoise < sample.dryness * 0.24;
    if (dropout) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineWidth = clamp(sample.width * (0.022 + (laneNoise * 0.018)), 0.55, 1.25);
    ctx.strokeStyle = `rgba(8, 14, 10, ${clamp(0.18 + (laneNoise * 0.26), 0.18, 0.44)})`;
    ctx.beginPath();
    ctx.moveTo(previous.x + (nx * laneOffset), previous.y + (ny * laneOffset));
    ctx.lineTo(sample.x + (nx * laneOffset), sample.y + (ny * laneOffset));
    ctx.stroke();
    ctx.restore();
  });

  // Bristle gaps expose the paper increasingly toward the dry end of the stroke.
  // Stable lanes keep fibers longitudinal; per-segment noise only varies their load.
  BRISTLE_LANES.forEach((lane, laneIndex) => {
    const dryness = sample.dryness;
    if (dryness < 0.08) return;
    const noise = deterministicNoise((index * 11) + (laneIndex * 43));
    const previousOffset = (lane + Math.sin(previous.arcLength * 0.035 + laneIndex) * 0.018) * previous.width;
    const offset = (lane + Math.sin(sample.arcLength * 0.035 + laneIndex) * 0.018) * sample.width;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineCap = 'round';
    ctx.lineWidth = clamp(sample.width * (0.025 + dryness * 0.025), 0.55, 1.35);
    ctx.strokeStyle = `rgba(0, 0, 0, ${dryness * (0.08 + noise * 0.34)})`;
    ctx.beginPath();
    ctx.moveTo(previous.x + nx * previousOffset, previous.y + ny * previousOffset);
    ctx.lineTo(sample.x + nx * offset, sample.y + ny * offset);
    ctx.stroke();
    ctx.restore();
  });
}

function getPointSequence(point, fallback) {
  const sequence = Number(point?.sequence);
  return Number.isFinite(sequence) ? sequence : fallback;
}

function appendInkPath(state, path, radius) {
  if (!Array.isArray(path) || path.length === 0) return;
  let startIndex = 0;
  if (!state.lastSample) {
    const firstSequence = getPointSequence(path[0], 0);
    const firstSample = createEnsoGateBrushSample({
      point: path[0],
      radius,
      index: firstSequence,
    });
    drawStartPool(state.ctx, firstSample, firstSequence);
    state.lastSequence = firstSequence;
    state.drawnSegmentCount = 0;
    state.lastPoint = { ...path[0] };
    state.lastSample = firstSample;
    startIndex = 1;
  } else {
    startIndex = path.findIndex((point, index) => (
      getPointSequence(point, index) > state.lastSequence
    ));
    if (startIndex < 0) return;
  }

  for (let index = startIndex; index < path.length; index += 1) {
    const point = path[index];
    const sequence = getPointSequence(point, state.lastSequence + 1);
    if (sequence <= state.lastSequence) continue;
    const sample = createEnsoGateBrushSample({
      point,
      previousPoint: state.lastPoint,
      previousSample: state.lastSample,
      radius,
      index: sequence,
    });
    drawBodySegment(state.ctx, state.lastSample, sample, sequence);
    state.lastSample = sample;
    state.lastPoint = { ...point };
    state.lastSequence = sequence;
    state.drawnSegmentCount += 1;
  }
}

function getSettledInkOpacity(state, frame, now) {
  if (frame.inkSettling === true && !state.sealed) {
    state.sealed = true;
    state.settleStartedAt = now;
  }
  if (!state.sealed) return 1;
  // Absorption changes the existing ink uniformly; it cannot add an idealized
  // second circumference outside the hand's actual, variable-width stroke.
  return 1 - (smoothstep(0, CLICK_ENSO_INK_SETTLE_MS, now - state.settleStartedAt) * 0.065);
}

export function drawEnsoGateInkLayer(ctx, canvas, frame, metrics, { now = Date.now() } = {}) {
  if (!ctx || !canvas || !frame || !metrics) return;
  const path = Array.isArray(frame.inkPath) && frame.inkPath.length > 0
    ? frame.inkPath
    : frame.path;
  if (!Array.isArray(path) || path.length === 0) return;
  const state = ensureRendererState(canvas, metrics);
  appendInkPath(state, path, frame.radius);

  ctx.save();
  ctx.globalAlpha = getSettledInkOpacity(state, frame, now);
  ctx.drawImage(
    state.layer,
    metrics.bounds?.x ?? 0,
    metrics.bounds?.y ?? 0,
    metrics.width,
    metrics.height,
  );
  ctx.restore();
}

export function disposeEnsoGateBrushRenderer(canvas) {
  if (canvas) rendererByCanvas.delete(canvas);
}
