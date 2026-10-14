import { resolveRasterResolution } from '@/platform/rendering/renderBudgetContract.js';
import { readDevicePixelRatio } from '@/platform/rendering/devicePixelRatio.js';
const BRISTLE_LANES = Object.freeze([-0.42, -0.27, -0.1, 0.09, 0.26, 0.41]);
const FIBER_LANES = Object.freeze([-0.31, 0.02, 0.27]);
const BODY_WIDTH_SCALE = 0.86;
const TAU = Math.PI * 2;

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

function deterministicNoise(seed) {
  const raw = Math.sin((Number(seed) + 1) * 12.9898) * 43758.5453;
  return raw - Math.floor(raw);
}

function mixChannel(wet, dry, amount) {
  return Math.round(wet + ((dry - wet) * clamp(amount, 0, 1)));
}

function distanceBetween(a, b) {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  return Math.hypot((Number(b.x) || 0) - (Number(a.x) || 0), (Number(b.y) || 0) - (Number(a.y) || 0));
}

function normalizeVector(dx, dy, fallbackX = 1, fallbackY = 0) {
  const length = Math.hypot(dx, dy);
  if (length > 0.0001) return { x: dx / length, y: dy / length };
  const fallbackLength = Math.max(0.0001, Math.hypot(fallbackX, fallbackY));
  return { x: fallbackX / fallbackLength, y: fallbackY / fallbackLength };
}

function resolveStrokeLengthRange(stroke) {
  const points = Array.isArray(stroke?.points) ? stroke.points : [];
  const firstS = Number(points[0]?.s) || 0;
  const lastS = Number(points[points.length - 1]?.s) || firstS;
  return { firstS, lastS, length: Math.max(1, lastS - firstS) };
}

function resolveSampleWetAt(sample, frame) {
  if (Number.isFinite(sample?.wetAt)) return sample.wetAt;
  if (Number.isFinite(sample?.at)) return sample.at;
  return Number(frame?.now) || 0;
}

function resolveInkSampleDryness(stroke, sample, frame) {
  const { firstS, length } = resolveStrokeLengthRange(stroke);
  const lengthProgress = clamp(((Number(sample?.s) || firstS) - firstS) / length, 0, 1);
  const profile = frame?.profile || {};
  const durationScale = frame?.reducedMotion ? 0.65 : 1;
  const durationMs = Math.max(1, (Number(profile.dryDurationMs) || 1) * durationScale);
  const dryStartAt = resolveSampleWetAt(sample, frame)
    + (Number(profile.dryHoldMs) || 0)
    + ((Number(profile.tailSweepMs) || 0) * lengthProgress);
  return smoothstep(0, 1, ((Number(frame?.now) || 0) - dryStartAt) / durationMs);
}

function resolveStrokeDryProgress(stroke, frame) {
  const points = Array.isArray(stroke?.points) ? stroke.points : [];
  return points.reduce(
    (progress, point) => Math.max(progress, resolveInkSampleDryness(stroke, point, frame)),
    0,
  );
}

function normalizeStoredSamples(stroke) {
  const points = Array.isArray(stroke?.points) ? stroke.points : [];
  let previous = null;
  let previousS = 0;
  return points.map((point, index) => {
    const sampleDistance = previous ? distanceBetween(previous, point) : 0;
    const declaredS = Number(point?.s);
    const s = index === 0
      ? (Number.isFinite(declaredS) ? Math.max(0, declaredS) : 0)
      : (Number.isFinite(declaredS) && declaredS >= previousS
        ? declaredS
        : previousS + (Number.isFinite(sampleDistance) ? sampleDistance : 0));
    const normalized = {
      ...point,
      x: Number(point?.x) || 0,
      y: Number(point?.y) || 0,
      s,
      width: Math.max(1, Number(point?.width) || 1),
      direction: point?.direction === 'rtl' ? 'rtl' : 'ltr',
      glyphWidth: Math.max(1, Number(point?.glyphWidth) || 12),
    };
    previous = normalized;
    previousS = s;
    return normalized;
  });
}

function resolveEndpointDirection(samples, atEnd = true) {
  const primary = atEnd ? samples[samples.length - 1] : samples[0];
  const secondary = atEnd ? samples[samples.length - 2] : samples[1];
  const directionSign = primary?.direction === 'rtl' ? -1 : 1;
  if (!primary || !secondary) return { x: directionSign, y: 0 };
  const dx = atEnd ? primary.x - secondary.x : secondary.x - primary.x;
  const dy = atEnd ? primary.y - secondary.y : secondary.y - primary.y;
  return normalizeVector(dx, dy, directionSign, 0);
}

function appendActiveHead(samples, stroke, frame) {
  if (frame?.activeStrokeId !== stroke?.id) return false;
  const target = stroke?.target || stroke?.tip;
  const last = samples[samples.length - 1];
  if (!target || !last) return false;

  const targetDistance = distanceBetween(last, target);
  let headBase = last;
  let direction = resolveEndpointDirection(samples, true);
  if (Number.isFinite(targetDistance) && targetDistance > 0.15) {
    direction = normalizeVector(target.x - last.x, target.y - last.y, direction.x, direction.y);
    headBase = {
      ...last,
      ...target,
      x: Number(target.x) || 0,
      y: Number(target.y) || 0,
      s: last.s + targetDistance,
      wetAt: Number(frame.now) || resolveSampleWetAt(last, frame),
      width: last.width + (((Number(target.width) || last.width) - last.width) * 0.58),
      synthetic: 'active-target',
    };
    samples.push(headBase);
  }

  const targetWidth = Math.max(1, Number(target.width) || headBase.width);
  const glyphWidth = Math.max(1, Number(target.glyphWidth) || headBase.glyphWidth || 12);
  const leadPx = clamp((glyphWidth * 0.58) + ((Number(frame.pressure) || 0) * 3.2), 4.5, 13);
  const normal = { x: -direction.y, y: direction.x };
  const tipBiasSign = deterministicNoise((Number(stroke?.points?.[0]?.sequence) || 1) * 73) > 0.5
    ? 1
    : -1;
  const shoulder = {
    ...headBase,
    x: headBase.x + (direction.x * leadPx * 0.58),
    y: headBase.y + (direction.y * leadPx * 0.58),
    s: headBase.s + (leadPx * 0.58),
    wetAt: Number(frame.now) || resolveSampleWetAt(headBase, frame),
    width: targetWidth * 0.62,
    synthetic: 'active-head-shoulder',
  };
  samples.push(shoulder);
  samples.push({
    ...shoulder,
    x: headBase.x + (direction.x * leadPx) + (normal.x * targetWidth * 0.075 * tipBiasSign),
    y: headBase.y + (direction.y * leadPx) + (normal.y * targetWidth * 0.075 * tipBiasSign),
    s: headBase.s + leadPx,
    wetAt: Number(frame.now) || resolveSampleWetAt(headBase, frame),
    width: targetWidth * 0.27,
    synthetic: 'active-head',
  });
  return true;
}

function appendLiftedTip(samples) {
  const last = samples[samples.length - 1];
  if (!last) return;
  const direction = resolveEndpointDirection(samples, true);
  const normal = { x: -direction.y, y: direction.x };
  const tipLength = clamp((Number(last.glyphWidth) || 12) * 0.52, 4, 10);
  const tipBias = (deterministicNoise((Number(last.sequence) || 1) * 41) - 0.5) * last.width * 0.12;
  const shoulder = {
    ...last,
    x: last.x + (direction.x * tipLength * 0.58),
    y: last.y + (direction.y * tipLength * 0.58),
    s: last.s + (tipLength * 0.58),
    width: last.width * 0.62,
    synthetic: 'lifted-tip-shoulder',
  };
  samples.push(shoulder);
  samples.push({
    ...shoulder,
    x: last.x + (direction.x * tipLength) + (normal.x * tipBias),
    y: last.y + (direction.y * tipLength) + (normal.y * tipBias),
    s: last.s + tipLength,
    width: last.width * 0.28,
    synthetic: 'lifted-tip',
  });
}

function prependStrokeTail(samples) {
  const first = samples[0];
  if (!first) return;
  const direction = resolveEndpointDirection(samples, false);
  const normal = { x: -direction.y, y: direction.x };
  const glyphWidth = Math.max(1, Number(first.glyphWidth) || 12);
  const tailLength = clamp(
    Math.max(glyphWidth * 1.12, first.width * 0.56),
    8,
    24,
  );
  const tailBias = (deterministicNoise((Number(first.sequence) || 1) * 29) - 0.5)
    * first.width
    * 0.16;
  const loadedShoulder = {
    ...first,
    x: first.x - (direction.x * tailLength * 0.5) + (normal.x * tailBias * 0.42),
    y: first.y - (direction.y * tailLength * 0.5) + (normal.y * tailBias * 0.42),
    s: first.s - (tailLength * 0.5),
    width: first.width * 1.08,
    synthetic: 'loaded-tail-shoulder',
  };
  const tailTip = {
    ...first,
    x: first.x - (direction.x * tailLength) + (normal.x * tailBias),
    y: first.y - (direction.y * tailLength) + (normal.y * tailBias),
    s: first.s - tailLength,
    width: first.width * 0.64,
    synthetic: 'loaded-tail-tip',
  };
  samples.unshift(tailTip, loadedShoulder);
}

function smoothRibbonCenters(samples) {
  if (samples.length < 3) return samples;
  return samples.map((sample, index) => {
    if (index === 0 || index === samples.length - 1) return sample;
    const previous = samples[index - 1];
    const next = samples[index + 1];
    return {
      ...sample,
      x: (previous.x + (sample.x * 2) + next.x) * 0.25,
      y: (previous.y + (sample.y * 2) + next.y) * 0.25,
    };
  });
}

function resolveEdgeScale(sample, strokeSeed, sideOffset) {
  const phase = (Number(sample?.s) || 0) * 0.085;
  return 1
    + (Math.sin(phase * 0.23 + strokeSeed * 0.31 + sideOffset * 0.47) * 0.072)
    + (Math.sin(phase + strokeSeed * 0.71 + sideOffset) * 0.046)
    + (Math.sin(phase * 2.37 + strokeSeed * 0.19 + sideOffset * 1.7) * 0.021);
}

function buildInkRibbonGeometry(stroke, frame) {
  let samples = normalizeStoredSamples(stroke);
  if (samples.length === 0) return null;
  if (!appendActiveHead(samples, stroke, frame)) appendLiftedTip(samples);
  prependStrokeTail(samples);
  samples = smoothRibbonCenters(samples);

  const strokeSeed = Number(stroke?.points?.[0]?.sequence) || 1;
  let previousTangent = resolveEndpointDirection(samples, false);
  const edges = samples.map((sample, index) => {
    const previous = samples[Math.max(0, index - 1)];
    const next = samples[Math.min(samples.length - 1, index + 1)];
    const tangent = normalizeVector(
      next.x - previous.x,
      next.y - previous.y,
      previousTangent.x,
      previousTangent.y,
    );
    previousTangent = tangent;
    const normal = { x: -tangent.y, y: tangent.x };
    const widthScale = 1.0 + (clamp(((frame?.density ?? 0.30) - 0.30) / 0.68, 0, 1) * 0.28);
    const halfWidth = Math.max(0.6, sample.width * BODY_WIDTH_SCALE * 0.5 * widthScale);
    const leftWidth = halfWidth * resolveEdgeScale(sample, strokeSeed, 0.8);
    const rightWidth = halfWidth * resolveEdgeScale(sample, strokeSeed, 3.4);
    return {
      center: sample,
      tangent,
      normal,
      halfWidth,
      dryness: resolveInkSampleDryness(stroke, sample, frame),
      left: {
        x: sample.x + (normal.x * leftWidth),
        y: sample.y + (normal.y * leftWidth),
      },
      right: {
        x: sample.x - (normal.x * rightWidth),
        y: sample.y - (normal.y * rightWidth),
      },
    };
  });
  return {
    edges,
    strokeSeed,
    density: frame?.density ?? 0.30,
  };
}

function traceRibbonOutline(ctx, geometry) {
  if (!geometry?.edges?.length) return;
  const { edges } = geometry;
  ctx.beginPath();
  ctx.moveTo(edges[0].left.x, edges[0].left.y);
  for (let index = 1; index < edges.length; index += 1) {
    ctx.lineTo(edges[index].left.x, edges[index].left.y);
  }
  for (let index = edges.length - 1; index >= 0; index -= 1) {
    ctx.lineTo(edges[index].right.x, edges[index].right.y);
  }
  ctx.closePath();
}

function resolveDryTone(dryness) {
  return smoothstep(0.12, 0.84, dryness);
}

function resolveVisibleInk(dryness) {
  return 1 - smoothstep(0.66, 1, dryness);
}

function createArcLengthGradient(ctx, geometry, resolveColor) {
  const first = geometry.edges[0];
  const last = geometry.edges[geometry.edges.length - 1];
  const dx = last.center.x - first.center.x;
  const dy = last.center.y - first.center.y;
  const endX = Math.hypot(dx, dy) > 0.01 ? last.center.x : first.center.x + 1;
  const endY = Math.hypot(dx, dy) > 0.01 ? last.center.y : first.center.y;
  const gradient = ctx.createLinearGradient(first.center.x, first.center.y, endX, endY);
  const firstS = Number(first.center.s) || 0;
  const lastS = Number(last.center.s) || firstS;
  const length = Math.max(0.0001, lastS - firstS);
  let previousOffset = -1;
  geometry.edges.forEach((edge, index) => {
    const numericS = Number(edge.center.s);
    const resolvedS = Number.isFinite(numericS) ? numericS : firstS;
    let offset = clamp((resolvedS - firstS) / length, 0, 1);
    if (index === 0) offset = 0;
    if (index === geometry.edges.length - 1) offset = 1;
    if (offset === previousOffset && index !== geometry.edges.length - 1) return;
    gradient.addColorStop(offset, resolveColor(edge));
    previousOffset = offset;
  });
  return gradient;
}

function drawRibbonBody(ctx, geometry) {
  const density = clamp(geometry.density ?? 0.30, 0.0, 0.98);
  if (density <= 0.005) return;

  const heavyProgress = clamp((density - 0.30) / 0.55, 0, 1);
  const red = mixChannel(34, 10, heavyProgress);
  const green = mixChannel(32, 14, heavyProgress);
  const blue = mixChannel(30, 12, heavyProgress);

  ctx.save();
  ctx.fillStyle = `rgba(${red}, ${green}, ${blue}, ${density})`;
  traceRibbonOutline(ctx, geometry);
  ctx.fill();
  ctx.fillStyle = createArcLengthGradient(ctx, geometry, (edge) => {
    const tone = resolveDryTone(edge.dryness);
    const dryRed = mixChannel(red, 102, tone);
    const dryGreen = mixChannel(green, 108, tone);
    const dryBlue = mixChannel(blue, 96, tone);
    return `rgba(${dryRed}, ${dryGreen}, ${dryBlue}, ${tone * 0.72 * density})`;
  });
  traceRibbonOutline(ctx, geometry);
  ctx.fill();
  ctx.restore();
}

function resolveLanePoint(edge, lane, strokeSeed, laneIndex) {
  const s = Number(edge.center.s) || 0;
  const stableWander = Math.sin((s * 0.095) + (strokeSeed * 0.37) + (laneIndex * 1.73));
  const fineWander = Math.sin((s * 0.23) + (strokeSeed * 0.11) + (laneIndex * 0.83));
  const offset = (lane * edge.halfWidth * 1.72)
    + ((stableWander * 0.035 + fineWander * 0.014) * edge.halfWidth);
  return {
    x: edge.center.x + (edge.normal.x * offset),
    y: edge.center.y + (edge.normal.y * offset),
  };
}

function drawContinuousBristles(ctx, geometry) {
  const averageHalfWidth = geometry.edges.reduce((sum, edge) => sum + edge.halfWidth, 0)
    / Math.max(1, geometry.edges.length);
  BRISTLE_LANES.forEach((lane, laneIndex) => {
    const laneNoise = deterministicNoise(geometry.strokeSeed + (laneIndex * 47));
    ctx.save();
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'round';
    ctx.lineWidth = clamp(averageHalfWidth * (0.06 + laneNoise * 0.052), 0.68, 1.9);
    ctx.strokeStyle = `rgba(3, 8, 5, ${0.11 + laneNoise * 0.15})`;
    ctx.beginPath();
    geometry.edges.forEach((edge, index) => {
      const lanePoint = resolveLanePoint(edge, lane, geometry.strokeSeed, laneIndex);
      if (index === 0) ctx.moveTo(lanePoint.x, lanePoint.y);
      else ctx.lineTo(lanePoint.x, lanePoint.y);
    });
    ctx.stroke();
    ctx.restore();
  });
}

function drawContinuousFibers(ctx, geometry) {
  FIBER_LANES.forEach((lane, laneIndex) => {
    const laneNoise = deterministicNoise(geometry.strokeSeed + 211 + (laneIndex * 59));
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 0.5 + (laneNoise * 0.5);
    ctx.strokeStyle = `rgba(0, 0, 0, ${0.055 + laneNoise * 0.075})`;
    ctx.beginPath();
    geometry.edges.forEach((edge, index) => {
      const lanePoint = resolveLanePoint(
        edge,
        lane,
        geometry.strokeSeed + 307,
        laneIndex + BRISTLE_LANES.length,
      );
      if (index === 0) ctx.moveTo(lanePoint.x, lanePoint.y);
      else ctx.lineTo(lanePoint.x, lanePoint.y);
    });
    ctx.stroke();
    ctx.restore();
  });
}

function applyRibbonDryingMask(ctx, geometry) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = createArcLengthGradient(ctx, geometry, (edge) => (
    `rgba(0, 0, 0, ${1 - resolveVisibleInk(edge.dryness)})`
  ));
  traceRibbonOutline(ctx, geometry);
  ctx.fill();
  ctx.restore();
}

function drawStroke(renderer, stroke, frame) {
  const geometry = buildInkRibbonGeometry(stroke, frame);
  if (!geometry || geometry.edges.length < 2) return;
  const { layerCtx, layerCanvas, ctx } = renderer;
  layerCtx.setTransform(renderer.dpr, 0, 0, renderer.dpr, 0, 0);
  layerCtx.clearRect(0, 0, renderer.width, renderer.height);
  drawRibbonBody(layerCtx, geometry);
  drawContinuousBristles(layerCtx, geometry);
  drawContinuousFibers(layerCtx, geometry);
  applyRibbonDryingMask(layerCtx, geometry);

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(layerCanvas, 0, 0);
  ctx.restore();
}

function drawLocalBloom(ctx, target, profile, pressure) {
  const intensity = smoothstep(profile.bloomThreshold, 1, pressure);
  if (intensity <= 0.001) return false;
  const radius = Math.max(18, target.width * (1.55 + intensity * 0.65));
  const gradient = ctx.createRadialGradient(target.x, target.y, 0, target.x, target.y, radius);
  gradient.addColorStop(0, `rgba(18, 30, 23, ${profile.bloomMaxOpacity * intensity})`);
  gradient.addColorStop(0.42, `rgba(39, 58, 46, ${profile.bloomMaxOpacity * intensity * 0.48})`);
  gradient.addColorStop(1, 'rgba(69, 89, 72, 0)');
  ctx.save();
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(target.x, target.y, radius, 0, TAU);
  ctx.fill();
  ctx.restore();
  return true;
}

export function createInkBrushCanvasRenderer(canvas) {
  if (typeof HTMLCanvasElement === 'undefined' || !(canvas instanceof HTMLCanvasElement)) {
    throw new Error('INPUT_VISUAL_BRAKE_CANVAS_REQUIRED');
  }
  const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
  if (!ctx) throw new Error('INPUT_VISUAL_BRAKE_CANVAS_CONTEXT_UNAVAILABLE');
  const layerCanvas = canvas.ownerDocument?.createElement('canvas');
  if (!layerCanvas) throw new Error('INPUT_VISUAL_BRAKE_LAYER_CANVAS_REQUIRED');
  const layerCtx = layerCanvas.getContext('2d', { alpha: true, desynchronized: true });
  if (!layerCtx) throw new Error('INPUT_VISUAL_BRAKE_LAYER_CONTEXT_UNAVAILABLE');
  const renderer = {
    canvas,
    ctx,
    layerCanvas,
    layerCtx,
    width: 0,
    height: 0,
    dpr: 1,
    disposed: false,
  };
  canvas.setAttribute('data-friction-input-ink-renderer', 'arc-length-ribbon');
  return renderer;
}

export function resizeInkBrushCanvas(renderer, {
  width,
  height,
  dpr = readDevicePixelRatio(),
} = {}) {
  if (!renderer || renderer.disposed) return false;
  const resolvedWidth = Math.max(1, Number(width) || 1);
  const resolvedHeight = Math.max(1, Number(height) || 1);
  const { effectivePixelRatio: resolvedDpr, pixelWidth, pixelHeight } = resolveRasterResolution({ cssWidth: resolvedWidth, cssHeight: resolvedHeight, devicePixelRatio: dpr,
            pixelRatioCap: 2, maxRenderPixels: 8_294_400 });
  const sizeChanged = renderer.canvas.width !== pixelWidth
    || renderer.canvas.height !== pixelHeight
    || renderer.width !== resolvedWidth
    || renderer.height !== resolvedHeight
    || renderer.dpr !== resolvedDpr;
  if (!sizeChanged) return false;
  if (renderer.canvas.width !== pixelWidth) renderer.canvas.width = pixelWidth;
  if (renderer.canvas.height !== pixelHeight) renderer.canvas.height = pixelHeight;
  if (renderer.layerCanvas.width !== pixelWidth) renderer.layerCanvas.width = pixelWidth;
  if (renderer.layerCanvas.height !== pixelHeight) renderer.layerCanvas.height = pixelHeight;
  renderer.canvas.style.width = `${resolvedWidth}px`;
  renderer.canvas.style.height = `${resolvedHeight}px`;
  renderer.ctx.setTransform(resolvedDpr, 0, 0, resolvedDpr, 0, 0);
  renderer.layerCtx.setTransform(resolvedDpr, 0, 0, resolvedDpr, 0, 0);
  renderer.width = resolvedWidth;
  renderer.height = resolvedHeight;
  renderer.dpr = resolvedDpr;
  return true;
}

export function renderInkBrushFrame(renderer, frame) {
  if (!renderer || renderer.disposed || !frame) return false;
  const { ctx, canvas } = renderer;
  ctx.setTransform(renderer.dpr, 0, 0, renderer.dpr, 0, 0);
  ctx.clearRect(0, 0, renderer.width, renderer.height);
  const strokes = Array.isArray(frame.strokes) ? frame.strokes : [];
  const activeStroke = frame.activeStrokeId
    ? strokes.find((stroke) => stroke.id === frame.activeStrokeId)
    : null;
  const activeTarget = activeStroke?.target || activeStroke?.tip || null;
  const bloomVisible = !!activeTarget
    && frame.reducedMotion !== true
    && drawLocalBloom(ctx, activeTarget, frame.profile, frame.pressure);
  strokes.forEach((stroke) => drawStroke(renderer, stroke, frame));

  canvas.setAttribute('data-friction-input-ink-phase', String(frame.phase || 'idle'));
  canvas.setAttribute('data-friction-input-ink-strokes', String(strokes.length));
  canvas.setAttribute('data-friction-input-ink-bloom', bloomVisible ? '1' : '0');
  canvas.setAttribute('data-friction-input-caret-source', String(activeTarget?.caretSource || 'none'));
  return true;
}

export function clearInkBrushCanvas(renderer) {
  if (!renderer || renderer.disposed) return;
  renderer.ctx.setTransform(renderer.dpr, 0, 0, renderer.dpr, 0, 0);
  renderer.ctx.clearRect(0, 0, renderer.width, renderer.height);
  renderer.layerCtx.setTransform(renderer.dpr, 0, 0, renderer.dpr, 0, 0);
  renderer.layerCtx.clearRect(0, 0, renderer.width, renderer.height);
  renderer.canvas.setAttribute('data-friction-input-ink-phase', 'idle');
  renderer.canvas.setAttribute('data-friction-input-ink-strokes', '0');
  renderer.canvas.setAttribute('data-friction-input-ink-bloom', '0');
  renderer.canvas.setAttribute('data-friction-input-caret-source', 'none');
}

export function disposeInkBrushCanvasRenderer(renderer) {
  if (!renderer || renderer.disposed) return;
  clearInkBrushCanvas(renderer);
  renderer.disposed = true;
}

export {
  buildInkRibbonGeometry,
  resolveInkSampleDryness,
  resolveStrokeDryProgress,
};
