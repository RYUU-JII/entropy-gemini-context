import { resolveRasterResolution } from '@/platform/rendering/renderBudgetContract.js';
import { observeDevicePixelRatio, readDevicePixelRatio } from '@/platform/rendering/devicePixelRatio.js';
const TAU = Math.PI * 2;
const ENSO_DRAW_MS = 1850;
const ENSO_HEAD_HOLD_MS = 360;
const ENSO_HEAD_PRELOAD_PROGRESS = 0.022;
const RESIZE_DEBOUNCE_MS = 70;
const COSMIC_TWINKLE_FRAME_MS = 1000 / 24;
const STATIC_SNAPSHOT_CACHE_LIMIT = 1;
export const ZEN_ENSO_FORM = Object.freeze({
  PRACTICE: 'practice',
  COMPLETE: 'complete',
  // The complete stroke stopped short at full load, waiting to be closed.
  HELD: 'held',
});
export const ZEN_ENSO_RENDER_TIMING = Object.freeze({
  DRAW_MS: ENSO_DRAW_MS,
  HEAD_HOLD_MS: ENSO_HEAD_HOLD_MS,
  HEAD_PRELOAD_PROGRESS: ENSO_HEAD_PRELOAD_PROGRESS,
  COSMIC_TWINKLE_FRAME_MS,
});

const staticSnapshotCache = new Map();

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (from, to, t) => from + ((to - from) * t);
const deg = (degrees) => degrees * Math.PI / 180;

function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - (2 * t));
}

function easeInOutCubic(value) {
  const t = clamp(value, 0, 1);
  return t < 0.5
    ? 4 * t * t * t
    : 1 - (((-2 * t) + 2) ** 3 / 2);
}

export function hashZenEnsoSeed(input) {
  const text = String(input || 'zen-enso-loader');
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return function random() {
    state += 0x6D2B79F5;
    let result = Math.imul(state ^ (state >>> 15), 1 | state);
    result ^= result + Math.imul(result ^ (result >>> 7), 61 | result);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function makeNoise(random, count = 16) {
  const values = Array.from({ length: count }, () => (random() * 2) - 1);

  return function sampleNoise(t) {
    const x = ((((t % 1) + 1) % 1) * count);
    const index0 = Math.floor(x) % count;
    const index1 = (index0 + 1) % count;
    const fraction = x - Math.floor(x);
    const eased = fraction * fraction * (3 - (2 * fraction));
    return lerp(values[index0], values[index1], eased);
  };
}

function getCanvasDisplayMetrics(canvas) {
  const rect = canvas.getBoundingClientRect?.() || {};
  const width = Math.max(1, rect.width || canvas.clientWidth || canvas.width || 640);
  const height = Math.max(1, rect.height || canvas.clientHeight || canvas.height || 640);
  const dpr = readDevicePixelRatio();
  return { width, height, dpr };
}

function normalizeCanvasMetrics(metrics) {
  if (!metrics || ['width', 'height', 'dpr'].some(key => !Number.isFinite(metrics[key]) || metrics[key] <= 0)) {
    throw new Error('ZEN_ENSO_CANVAS_METRICS_INVALID');
  }
  const { effectivePixelRatio: dpr } = resolveRasterResolution({ cssWidth: metrics.width, cssHeight: metrics.height, devicePixelRatio: metrics.dpr,
            pixelRatioCap: 2, maxRenderPixels: 8_294_400 });
  return { width: metrics.width, height: metrics.height, dpr };
}

function createScratchCanvas(width, height) {
  const safeWidth = Math.max(1, Math.floor(Number(width) || 1));
  const safeHeight = Math.max(1, Math.floor(Number(height) || 1));

  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    const canvas = document.createElement('canvas');
    canvas.width = safeWidth;
    canvas.height = safeHeight;
    return canvas;
  }

  if (typeof OffscreenCanvas === 'function') {
    return new OffscreenCanvas(safeWidth, safeHeight);
  }

  throw new Error('[ZenEnsoCanvas] Scratch canvas is unavailable.');
}

function createLayer(width, height, dpr) {
  const canvas = createScratchCanvas(width * dpr, height * dpr);

  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) {
    throw new Error('[ZenEnsoCanvas] Failed to create an offscreen canvas context.');
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { canvas, ctx };
}

function buildStaticSnapshotCacheKey({
  staticCacheKey = '',
  seed = 0,
  form = ZEN_ENSO_FORM.PRACTICE,
  includePaper = true,
  inkFillMode = 'ink',
  pixelWidth = 0,
  pixelHeight = 0,
  dpr = 1,
} = {}) {
  const cleanCacheKey = typeof staticCacheKey === 'string' ? staticCacheKey.trim() : '';
  if (!cleanCacheKey || pixelWidth <= 0 || pixelHeight <= 0) return '';
  return [
    cleanCacheKey,
    seed >>> 0,
    normalizeEnsoForm(form),
    includePaper ? 'paper' : 'transparent',
    inkFillMode || 'ink',
    `${pixelWidth}x${pixelHeight}`,
    `dpr:${Math.round((Number(dpr) || 1) * 100) / 100}`,
  ].join(':');
}

function readStaticSnapshotCache(cacheKey) {
  if (!cacheKey || !staticSnapshotCache.has(cacheKey)) return null;
  const snapshot = staticSnapshotCache.get(cacheKey);
  staticSnapshotCache.delete(cacheKey);
  staticSnapshotCache.set(cacheKey, snapshot);
  return snapshot;
}

function trimStaticSnapshotCache() {
  while (staticSnapshotCache.size > STATIC_SNAPSHOT_CACHE_LIMIT) {
    const oldestKey = staticSnapshotCache.keys().next().value;
    if (!oldestKey) return;
    staticSnapshotCache.delete(oldestKey);
  }
}

function writeStaticSnapshotCache(cacheKey, state) {
  if (!cacheKey || typeof document === 'undefined') return;
  const sourceCanvas = state.canvas;
  if (!sourceCanvas?.width || !sourceCanvas?.height) return;

  const snapshotCanvas = document.createElement('canvas');
  snapshotCanvas.width = sourceCanvas.width;
  snapshotCanvas.height = sourceCanvas.height;

  const snapshotCtx = snapshotCanvas.getContext('2d', { alpha: true });
  if (!snapshotCtx) return;

  snapshotCtx.drawImage(sourceCanvas, 0, 0);
  staticSnapshotCache.set(cacheKey, {
    canvas: snapshotCanvas,
    pixelWidth: snapshotCanvas.width,
    pixelHeight: snapshotCanvas.height,
  });
  trimStaticSnapshotCache();
}

function drawStaticSnapshot(state, snapshot) {
  if (
    !snapshot?.canvas
    || snapshot.pixelWidth !== state.canvas.width
    || snapshot.pixelHeight !== state.canvas.height
  ) {
    return false;
  }

  state.ctx.save();
  state.ctx.setTransform(1, 0, 0, 1, 0, 0);
  state.ctx.clearRect(0, 0, state.canvas.width, state.canvas.height);
  state.ctx.drawImage(snapshot.canvas, 0, 0);
  state.ctx.restore();
  return true;
}

function stampEllipse(ctx, x, y, radiusX, radiusY, angle, alpha) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = '#000';
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.ellipse(0, 0, radiusX, radiusY, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function buildPaper(state) {
  const { width, height, paperLayer, seed } = state;
  const random = mulberry32(seed ^ 0x9c43d51f);
  const pctx = paperLayer.ctx;

  pctx.clearRect(0, 0, width, height);
  pctx.fillStyle = '#f2ede3';
  pctx.fillRect(0, 0, width, height);

  const radialGradient = pctx.createRadialGradient(
    width * 0.5,
    height * 0.45,
    Math.min(width, height) * 0.08,
    width * 0.5,
    height * 0.5,
    Math.max(width, height) * 0.80,
  );
  radialGradient.addColorStop(0, 'rgba(255,255,255,0.15)');
  radialGradient.addColorStop(0.55, 'rgba(255,249,241,0.05)');
  radialGradient.addColorStop(1, 'rgba(110,85,58,0.08)');

  pctx.fillStyle = radialGradient;
  pctx.fillRect(0, 0, width, height);

  const textureWidth = Math.max(220, Math.floor(width * 0.30));
  const textureHeight = Math.max(220, Math.floor(height * 0.30));
  const texture = createScratchCanvas(textureWidth, textureHeight);

  const tctx = texture.getContext('2d');
  if (!tctx) {
    throw new Error('[ZenEnsoCanvas] Failed to create paper texture context.');
  }

  const image = tctx.createImageData(textureWidth, textureHeight);
  const noise1 = makeNoise(random, 12);
  const noise2 = makeNoise(random, 7);

  for (let y = 0; y < textureHeight; y += 1) {
    for (let x = 0; x < textureWidth; x += 1) {
      const index = (y * textureWidth + x) * 4;
      const nx = x / textureWidth;
      const ny = y / textureHeight;
      const low = (noise1((nx * 1.15) + (ny * 0.62)) * 5)
        + (noise2((nx * 0.40) - (ny * 1.08)) * 2.8);
      const fine = (random() - 0.5) * 6.6;
      const base = 239 + low + fine;

      image.data[index] = clamp(base + 4, 224, 252);
      image.data[index + 1] = clamp(base + 2, 222, 250);
      image.data[index + 2] = clamp(base - 4, 214, 246);
      image.data[index + 3] = 255;
    }
  }

  tctx.putImageData(image, 0, 0);

  pctx.save();
  pctx.globalAlpha = 0.33;
  pctx.drawImage(texture, 0, 0, width, height);
  pctx.restore();

  pctx.save();
  for (let index = 0; index < 1600; index += 1) {
    const x = random() * width;
    const y = random() * height;
    const length = 6 + (random() * 17);
    const angle = (random() - 0.5) * 0.9;

    pctx.strokeStyle = `rgba(72,56,34,${0.010 + (random() * 0.010)})`;
    pctx.lineWidth = 0.25 + (random() * 0.28);

    pctx.beginPath();
    pctx.moveTo(x, y);
    pctx.lineTo(x + (Math.cos(angle) * length), y + (Math.sin(angle) * length));
    pctx.stroke();
  }
  pctx.restore();

  pctx.save();
  for (let index = 0; index < 1600; index += 1) {
    pctx.fillStyle = `rgba(42,30,16,${0.007 + (random() * 0.014)})`;
    pctx.beginPath();
    pctx.arc(random() * width, random() * height, 0.16 + (random() * 0.60), 0, TAU);
    pctx.fill();
  }
  pctx.restore();
}

// Where a held stroke stops: the practice circle's opening on the complete sweep.
const ENSO_HOLD_T = 329 / 359.2;

function pressureCurve(t, { form = ZEN_ENSO_FORM.PRACTICE } = {}) {
  const normalizedForm = normalizeEnsoForm(form);
  const isComplete = normalizedForm === ZEN_ENSO_FORM.COMPLETE;
  const isHeld = normalizedForm === ZEN_ENSO_FORM.HELD;
  const headPlateau = 0.42 * (1 - smoothstep(0, 0.19, t));
  const headShoulder = 0.10 * (1 - smoothstep(0.10, 0.31, t));
  const headDab = 0.08 * Math.exp(-((t / 0.052) ** 2));
  const body = 1 + (0.07 * Math.sin(((t * 0.84) + 0.14) * Math.PI));
  const mid = 0.04 * Math.exp(-(((t - 0.30) / 0.18) ** 2));
  // A held stroke keeps its load up to the hold and only lifts after it.
  const liftFrom = isHeld ? ENSO_HOLD_T : 0.78;
  const tail = 1 - ((isHeld ? 0.12 : (isComplete ? 0.27 : 0.36)) * smoothstep(liftFrom, 1, t));
  const closingPressure = isComplete || isHeld ? 0.08 * smoothstep(isHeld ? ENSO_HOLD_T : 0.88, 1, t) : 0.02 * smoothstep(0.90, 1, t);

  return clamp((body + headPlateau + headShoulder + headDab + mid + closingPressure) * tail, 0.64, isComplete || isHeld ? 1.62 : 1.58);
}

function normalizeEnsoForm(value) {
  if (value === ZEN_ENSO_FORM.COMPLETE || value === ZEN_ENSO_FORM.HELD) return value;
  return ZEN_ENSO_FORM.PRACTICE;
}

function buildEnso(seed, width, height, { form = ZEN_ENSO_FORM.PRACTICE } = {}) {
  const random = mulberry32(seed ^ 0x13572468);
  const normalizedForm = normalizeEnsoForm(form);
  const isComplete = normalizedForm === ZEN_ENSO_FORM.COMPLETE;
  const isHeld = normalizedForm === ZEN_ENSO_FORM.HELD;
  const centerX = width * 0.5;
  const centerY = height * 0.52;
  const radius = Math.min(width, height) * 0.285;

  const startAngle = deg(132 + ((random() - 0.5) * 3));
  const isFull = isComplete || isHeld;
  const sweep = deg((isFull ? 359.2 : 329) + ((random() - 0.5) * (isFull ? 0.9 : 2.5)));
  const steps = Math.max(980, Math.floor(radius * 4.8));

  const radiusNoise1 = makeNoise(random, 12);
  const radiusNoise2 = makeNoise(random, 8);
  const widthNoise = makeNoise(random, 10);
  const baseWidth = radius * 0.268;
  const points = [];

  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    const angle = startAngle + (sweep * t);
    const radialJitter = 1
      + (radiusNoise1((t * 1) + 0.21) * 0.008)
      + (radiusNoise2((t * 2) + 0.57) * 0.003);
    const jitteredRadius = radius * radialJitter;

    const pointWidth = baseWidth
      * pressureCurve(t, { form: normalizedForm })
      * (1 + (widthNoise((t * 2.4) + 0.17) * 0.022));
    const dry = clamp(
      0.01
        + (isHeld
          ? (smoothstep(0.55, ENSO_HOLD_T, t) * 0.12) + ((smoothstep(ENSO_HOLD_T, 1, t) ** 1.18) * 0.34)
          : (smoothstep(0.55, 1, t) ** 1.18) * 0.82)
        + (widthNoise((t * 2.2) + 0.71) * 0.02),
      0,
      1,
    );

    points.push({
      x: centerX + (Math.cos(angle) * jitteredRadius),
      y: centerY + (Math.sin(angle) * jitteredRadius),
      t,
      a: angle,
      form: normalizedForm,
      width: pointWidth,
      dry,
    });
  }

  assignStrokeTangents(points);
  const bundles = createBrushBundles(random);

  // The ink an uncompleted drawing lays down; a held stroke's remainder is its closure.
  const openIndex = isHeld ? Math.round(ENSO_HOLD_T * steps) : steps;
  return { centerX, centerY, radius, points, bundles, form: normalizedForm, openIndex };
}

function assignStrokeTangents(points) {
  for (let index = 0; index < points.length; index += 1) {
    const previous = points[Math.max(0, index - 1)];
    const next = points[Math.min(points.length - 1, index + 1)];
    let dx = next.x - previous.x;
    let dy = next.y - previous.y;
    const length = Math.hypot(dx, dy) || 1;

    dx /= length;
    dy /= length;

    points[index].tx = dx;
    points[index].ty = dy;
    points[index].nx = -dy;
    points[index].ny = dx;
    points[index].angle = Math.atan2(dy, dx);
  }
}

function createBrushBundles(random) {
  const bundleCount = 15;
  const bundles = [];

  for (let index = 0; index < bundleCount; index += 1) {
    const s = bundleCount === 1 ? 0.5 : index / (bundleCount - 1);
    const center = lerp(-0.95, 0.95, s);
    const edge = Math.abs(center);

    bundles.push({
      center,
      edge,
      span: lerp(0.05, 0.13, 1 - (edge * 0.55)),
      laneCount: Math.round(lerp(2, 6, 1 - edge)),
      ink: 1,
      starveRun: 0,
      wobbleAmp: lerp(0.001, 0.006, random()),
      wobbleFreq: 0.75 + (random() * 1),
      wobblePhase: random() * 10,
      densityBias: (random() - 0.5) * 0.04,
      grain: makeNoise(random, 12),
      wobble: makeNoise(random, 9),
    });
  }

  return bundles;
}

function drawStartPool(ctx, point, random) {
  stampEllipse(
    ctx,
    point.x - (point.tx * point.width * 0.015),
    point.y - (point.ty * point.width * 0.010),
    point.width * 0.24,
    point.width * 0.50,
    point.angle,
    0.22,
  );

  stampEllipse(
    ctx,
    point.x + (point.tx * point.width * 0.035),
    point.y + (point.ty * point.width * 0.020),
    point.width * 0.18,
    point.width * 0.40,
    point.angle,
    0.17,
  );

  for (let index = 0; index < 12; index += 1) {
    const offsetX = (random() - 0.54) * point.width * 0.12;
    const offsetY = (random() - 0.50) * point.width * 0.18;

    stampEllipse(
      ctx,
      point.x + offsetX,
      point.y + offsetY,
      point.width * (0.045 + (random() * 0.070)),
      point.width * (0.040 + (random() * 0.060)),
      point.angle + ((random() - 0.5) * 0.22),
      0.08 + (random() * 0.05),
    );
  }
}

function depositWetStartShoulder(ctx, point, random) {
  const amount = 1 - smoothstep(0.015, 0.215, point.t);
  if (amount <= 0) return;

  const radiusX = point.width * lerp(0.18, 0.25, amount);
  const radiusY = point.width * lerp(0.40, 0.58, amount);

  stampEllipse(
    ctx,
    point.x - (point.tx * point.width * 0.010 * amount),
    point.y - (point.ty * point.width * 0.006 * amount),
    radiusX,
    radiusY,
    point.angle + ((random() - 0.5) * 0.015),
    0.045 + (0.055 * amount),
  );

  if (random() < 0.35) {
    stampEllipse(
      ctx,
      point.x + (point.tx * (random() - 0.5) * point.width * 0.025),
      point.y + (point.ty * (random() - 0.5) * point.width * 0.025),
      radiusX * 0.72,
      radiusY * 0.78,
      point.angle,
      0.030 + (0.035 * amount),
    );
  }
}

function depositCore(ctx, point, random) {
  const tailDry = smoothstep(0.86, 1, point.t);
  const headPool = 1 - smoothstep(0.012, 0.115, point.t);
  const alpha = clamp(0.23 - (point.dry * 0.04), 0.14, 0.26)
    * lerp(0.50, 1, 1 - headPool)
    * lerp(1, 0.70, tailDry);

  stampEllipse(
    ctx,
    point.x,
    point.y,
    point.width * lerp(0.25, 0.29, 1 - headPool) * (1 - (point.dry * 0.08)) * lerp(1, 0.82, tailDry),
    point.width * lerp(0.22, 0.14, 1 - headPool) * lerp(1, 0.76, tailDry),
    point.angle,
    alpha,
  );

  if (random() < 0.42) {
    stampEllipse(
      ctx,
      point.x + (point.tx * (random() - 0.5) * point.width * 0.03),
      point.y + (point.ty * (random() - 0.5) * point.width * 0.03),
      point.width * 0.21 * lerp(1, 0.78, tailDry),
      point.width * lerp(0.15, 0.09, 1 - headPool) * lerp(1, 0.74, tailDry),
      point.angle,
      alpha * 0.62,
    );
  }
}

function depositBundle(ctx, point, bundle, random, headReveal = 1) {
  const edge = bundle.edge;
  const consume = 0.0018
    + (point.dry * (0.010 + (edge * 0.010)))
    + (Math.max(0, point.t - 0.75) * 0.012);

  bundle.ink = clamp(bundle.ink - consume, 0, 1);

  if (point.t < 0.10) {
    bundle.ink = clamp(bundle.ink + 0.006, 0, 1);
  }

  if (bundle.starveRun <= 0 && point.t > 0.15) {
    const startProbability = clamp(
      ((0.52 - bundle.ink) * 0.34) + (point.dry * (0.08 + (edge * 0.14))),
      0,
      0.42,
    );

    if (random() < startProbability) {
      bundle.starveRun = 3 + Math.floor(random() * (5 + (point.dry * 10)));
    }
  }

  const starving = bundle.starveRun > 0;
  if (starving) bundle.starveRun -= 1;
  if (starving && random() < 0.86) return;

  const baseCoverage = clamp(
    0.96 - (point.dry * (0.16 + (edge * 0.30))) + bundle.densityBias,
    0.08,
    0.99,
  );

  const wobble = bundle.wobble((point.t * bundle.wobbleFreq) + bundle.wobblePhase)
    * bundle.wobbleAmp
    * lerp(0.10, 1, headReveal);

  for (let laneIndex = 0; laneIndex < bundle.laneCount; laneIndex += 1) {
    const laneT = bundle.laneCount === 1 ? 0.5 : laneIndex / (bundle.laneCount - 1);
    const local = ((laneT * 2) - 1) * bundle.span;
    const laneLocal = local * lerp(1.08, 1, headReveal);
    const position = (bundle.center * lerp(1.03, 1, headReveal)) + laneLocal + wobble;
    const positionEdge = clamp(Math.abs(position), 0, 1);
    const grain = 0.5 + (0.5 * bundle.grain(
      (point.t * 2)
        + (local * 1.7)
        + (bundle.wobblePhase * 0.23),
    ));
    const laneCoverage = clamp(
      baseCoverage - ((1 - bundle.ink) * 0.22) - (positionEdge * 0.10),
      0.04,
      0.99,
    );

    if (grain > laneCoverage) continue;

    const offset = position * point.width * 0.56;
    const x = point.x
      + (point.nx * offset)
      + (point.tx * (random() - 0.5) * point.width * 0.01);
    const y = point.y
      + (point.ny * offset)
      + (point.ty * (random() - 0.5) * point.width * 0.01);
    const radiusX = point.width
      * (0.14 + (0.10 * (1 - positionEdge)))
      * (1 - (point.dry * 0.05));
    const radiusY = Math.max(
      0.25,
      point.width
        * (0.006 + (0.010 * (1 - positionEdge)))
        * (0.85 + (random() * 0.25)),
    );
    const alpha = clamp(
      0.12
        + (0.06 * (1 - positionEdge))
        + (bundle.ink * 0.03)
        - (point.dry * 0.02),
      0.08,
      0.22,
    ) * (starving ? 0.55 : 1) * lerp(0.78, 1, headReveal);

    stampEllipse(ctx, x, y, radiusX, radiusY, point.angle, alpha);
  }
}

function depositTailAtPoint(ctx, point, random) {
  const isComplete = point.form !== ZEN_ENSO_FORM.PRACTICE;
  const amount = smoothstep(point.form === ZEN_ENSO_FORM.HELD ? ENSO_HOLD_T : 0.86, 1, point.t);
  if (amount <= 0) return;

  const hairCount = Math.floor(lerp(1, isComplete ? 3 : 5, amount));

  for (let index = 0; index < hairCount; index += 1) {
    if (random() < 0.34 + (amount * 0.26)) continue;

    const side = random() < 0.68
      ? lerp(0.12, 0.94, random())
      : lerp(-0.64, 0.18, random());
    const offset = side * point.width * lerp(0.32, 0.54, amount);
    const length = point.width
      * lerp(0.08, isComplete ? 0.34 : 0.43, amount)
      * (0.55 + (random() * (isComplete ? 0.62 : 0.78)));
    const jitter = (random() - 0.5) * 0.04;
    const x = point.x + (point.nx * offset) + (point.tx * length * 0.50);
    const y = point.y + (point.ny * offset) + (point.ty * length * 0.50);
    const radiusX = length * (0.24 + (random() * 0.13));
    const radiusY = Math.max(
      0.10,
      point.width * (
        (isComplete ? 0.0048 : 0.0024)
        + ((1 - amount) * (isComplete ? 0.0028 : 0.0025))
        + (random() * (isComplete ? 0.0022 : 0.0018))
      ),
    );

    stampEllipse(
      ctx,
      x,
      y,
      radiusX,
      radiusY,
      point.angle + jitter,
      0.045 + ((1 - amount) * 0.018) + (random() * 0.025),
    );
  }

  if (random() < (isComplete ? 0.56 : 0.34)) {
    stampEllipse(
      ctx,
      point.x + (point.tx * point.width * lerp(0.07, isComplete ? 0.18 : 0.22, amount)),
      point.y + (point.ty * point.width * lerp(0.07, isComplete ? 0.18 : 0.22, amount)),
      point.width * lerp(0.10, isComplete ? 0.18 : 0.15, amount),
      Math.max(0.10, point.width * (isComplete ? 0.010 : 0.0056)),
      point.angle,
      isComplete ? 0.055 : 0.048,
    );
  }
}

function splatterCluster(ctx, x, y, direction, spread, seed, count = 8) {
  const random = mulberry32(seed);

  for (let index = 0; index < count; index += 1) {
    const angle = direction + ((random() - 0.5) * 1.05);
    const distance = spread * (0.25 + ((random() ** 1.75) * 2));
    const px = x + (Math.cos(angle) * distance);
    const py = y + (Math.sin(angle) * distance);
    const radius = spread * (0.018 + ((random() ** 2) * 0.07));
    const alpha = 0.10 + (random() * 0.12);

    stampEllipse(
      ctx,
      px,
      py,
      radius * (random() < 0.22 ? 1.8 : 1),
      radius * (random() < 0.22 ? 0.65 : 1),
      angle,
      alpha,
    );
  }
}

function drawRange(state, fromIndex, toIndex) {
  const inkCtx = state.inkLayer.ctx;
  const { points, bundles } = state.enso;

  if (fromIndex <= 0 && toIndex >= 0) {
    drawStartPool(inkCtx, points[0], mulberry32(state.seed ^ 0x55aa11));
  }

  for (let index = Math.max(0, fromIndex); index <= toIndex; index += 1) {
    const point = points[index];
    const random = mulberry32((state.seed ^ 0x8ab4c2) + (index * 977));

    depositWetStartShoulder(inkCtx, point, random);
    depositCore(inkCtx, point, random);

    if (point.t < 0.055 && index % 4 === 0) {
      const headDab = 1 - smoothstep(0.006, 0.055, point.t);
      stampEllipse(
        inkCtx,
        point.x + (point.nx * (random() - 0.5) * point.width * 0.050),
        point.y + (point.ny * (random() - 0.5) * point.width * 0.050),
        point.width * 0.13,
        point.width * lerp(0.075, 0.060, 1 - headDab),
        point.angle,
        0.038 + (headDab * 0.028),
      );
    }

    const headReveal = smoothstep(0.018, 0.085, point.t);
    for (let bundleIndex = 0; bundleIndex < bundles.length; bundleIndex += 1) {
      depositBundle(inkCtx, point, bundles[bundleIndex], random, headReveal);
    }

    if (point.t > 0.86 && index % 4 === 0) {
      depositTailAtPoint(inkCtx, point, random);
    }
  }
}

function addSplatters(state) {
  if (state.splattersDone) return;

  const inkCtx = state.inkLayer.ctx;
  const { points } = state.enso;
  const point1 = points[Math.floor(points.length * 0.67)];
  const point2 = points[Math.floor(points.length * 0.06)];
  const point3 = points[Math.floor(points.length * 0.52)];

  splatterCluster(
    inkCtx,
    point1.x - (point1.nx * point1.width * 0.46),
    point1.y - (point1.ny * point1.width * 0.46),
    -1.55,
    point1.width * 0.56,
    state.seed ^ 0x11223344,
    6,
  );

  splatterCluster(
    inkCtx,
    point2.x - (point2.tx * point2.width * 0.16),
    point2.y - (point2.ty * point2.width * 0.10),
    -0.08,
    point2.width * 0.46,
    state.seed ^ 0x33445566,
    6,
  );

  splatterCluster(
    inkCtx,
    point3.x - (point3.nx * point3.width * 0.42),
    point3.y - (point3.ny * point3.width * 0.42),
    1.38,
    point3.width * 0.52,
    state.seed ^ 0x55667788,
    7,
  );

  state.splattersDone = true;
}

function drawCosmicInkField(ctx, state) {
  const { width, height } = state;
  const longestSide = Math.max(width, height);

  const voidGradient = ctx.createRadialGradient(
    width * 0.52,
    height * 0.45,
    longestSide * 0.04,
    width * 0.5,
    height * 0.52,
    longestSide * 0.72,
  );
  voidGradient.addColorStop(0, '#1d2f74');
  voidGradient.addColorStop(0.26, '#0b1a42');
  voidGradient.addColorStop(0.68, '#030712');
  voidGradient.addColorStop(1, '#01030a');
  ctx.fillStyle = voidGradient;
  ctx.fillRect(0, 0, width, height);

  const nebulae = [
    { x: 0.38, y: 0.33, radius: 0.38, rgb: '56, 189, 248', alpha: 0.34, softAlpha: 0.08 },
    { x: 0.67, y: 0.58, radius: 0.34, rgb: '168, 85, 247', alpha: 0.3, softAlpha: 0.08 },
    { x: 0.45, y: 0.70, radius: 0.28, rgb: '250, 204, 21', alpha: 0.18, softAlpha: 0.055 },
    { x: 0.58, y: 0.27, radius: 0.24, rgb: '96, 165, 250', alpha: 0.18, softAlpha: 0.045 },
  ];

  for (const nebula of nebulae) {
    const gradient = ctx.createRadialGradient(
      width * nebula.x,
      height * nebula.y,
      0,
      width * nebula.x,
      height * nebula.y,
      longestSide * nebula.radius,
    );
    gradient.addColorStop(0, `rgba(${nebula.rgb}, ${nebula.alpha})`);
    gradient.addColorStop(0.58, `rgba(${nebula.rgb}, ${nebula.softAlpha})`);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }
}

function composeCosmicInk(state) {
  const { ctx, width, height, inkLayer } = state;

  ctx.save();
  drawCosmicInkField(ctx, state);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(inkLayer.canvas, 0, 0, width, height);
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.globalAlpha = 0.16;
  ctx.filter = 'blur(0.35px)';
  ctx.drawImage(inkLayer.canvas, 0, 0, width, height);
  ctx.restore();
}

function composeInk(state) {
  const {
    ctx,
    width,
    height,
    inkFillMode,
    inkLayer,
  } = state;

  if (inkFillMode === 'cosmic') {
    composeCosmicInk(state);
    return;
  }

  ctx.save();
  ctx.globalAlpha = 0.03;
  ctx.filter = 'blur(0.55px)';
  ctx.drawImage(inkLayer.canvas, 0, 0, width, height);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 1;
  ctx.drawImage(inkLayer.canvas, 0, 0, width, height);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.010;
  ctx.filter = 'blur(1.35px)';
  ctx.drawImage(inkLayer.canvas, 0, 0, width, height);
  ctx.restore();
}

function compose(state) {
  const { ctx, width, height } = state;
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  if (state.inkFillMode !== 'cosmic' && state.includePaper) {
    ctx.drawImage(state.paperLayer.canvas, 0, 0, width, height);
  }
  composeInk(state);
}

// Brush geometry, scratch ink and stroke accumulation are shared by document
// animation and the gallery compiler. Paper/cache/lifecycle are document owners.
function createZenEnsoStrokeState(canvas, ctx, seed, { form, inkFillMode, resolveMetrics }) {
  if (typeof resolveMetrics !== 'function') throw new Error('ZEN_ENSO_METRICS_OWNER_REQUIRED');
  const state = {
    canvas,
    ctx,
    seed,
    inkFillMode,
    dpr: 1,
    width: 0,
    height: 0,
    inkLayer: null,
    enso: null,
    splattersDone: false,
    lastIndex: -1,
    needsRebuild: true,
    form: normalizeEnsoForm(form),
  };

  const syncSize = () => {
    const { width, height, dpr } = normalizeCanvasMetrics(resolveMetrics());
    const pixelWidth = Math.floor(width * dpr);
    const pixelHeight = Math.floor(height * dpr);
    const resized = canvas.width !== pixelWidth || canvas.height !== pixelHeight
      || state.width !== width
      || state.height !== height
      || state.dpr !== dpr;

    if (!resized) return false;

    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    state.dpr = dpr;
    state.width = width;
    state.height = height;
    state.needsRebuild = true;
    return true;
  };

  const rebuild = () => {
    state.inkLayer = createLayer(state.width, state.height, state.dpr);
    state.enso = buildEnso(seed, state.width, state.height, { form: state.form });
    state.splattersDone = false;
    state.lastIndex = -1;
    state.needsRebuild = false;
  };

  const ensureScene = () => {
    syncSize();
    if (state.needsRebuild || !state.inkLayer || !state.enso) {
      rebuild();
      return true;
    }
    return false;
  };

  const ensureOpenStroke = () => {
    ensureScene();
    if (state.lastIndex < state.enso.openIndex) {
      drawRange(state, state.lastIndex + 1, state.enso.openIndex);
      state.lastIndex = state.enso.openIndex;
    }
    addSplatters(state);
  };

  // A held stroke closes by drawing the rest of itself. Ink only accumulates,
  // so taking the closure back redraws the held stroke alone.
  const closeStroke = (progress) => {
    if (!Number.isFinite(progress)) throw new Error('ZEN_ENSO_CLOSURE_PROGRESS_INVALID');
    if (state.form !== ZEN_ENSO_FORM.HELD) throw new Error('ZEN_ENSO_CLOSURE_REQUIRES_HELD_FORM');
    ensureOpenStroke();
    const { openIndex, points } = state.enso;
    const targetIndex = openIndex + Math.floor(clamp(progress, 0, 1) * (points.length - 1 - openIndex));
    if (targetIndex < state.lastIndex) {
      rebuild();
      ensureOpenStroke();
    }
    if (targetIndex > state.lastIndex) {
      drawRange(state, state.lastIndex + 1, targetIndex);
      state.lastIndex = targetIndex;
    }
  };

  const setInkFillMode = (mode) => {
    if (mode !== 'ink' && mode !== 'cosmic') throw new Error('ZEN_ENSO_INK_FILL_MODE_INVALID');
    state.inkFillMode = mode;
  };

  return {
    state, syncSize, rebuild, ensureScene, ensureOpenStroke, closeStroke,
    setInkFillMode,
  };
}

// No paper, snapshot cache, playback or document measurement enters this API.
// The retained artifact scene owns its output texture and finite frame clock.
export function createZenEnsoBrushCompiler(canvas, ctx, seed, { inkFillMode = 'ink', resolveMetrics = null } = {}) {
  const stroke = createZenEnsoStrokeState(canvas, ctx, seed, {
    form: ZEN_ENSO_FORM.HELD, inkFillMode, resolveMetrics,
  });
  const paint = () => {
    const { state } = stroke;
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    ctx.clearRect(0, 0, state.width, state.height);
    composeInk(state);
  };
  return {
    drawStatic() { stroke.ensureOpenStroke(); paint(); },
    drawClosure(progress) { stroke.closeStroke(progress); paint(); },
    setInkFillMode: stroke.setInkFillMode,
  };
}

export function createZenEnsoRenderer(canvas, ctx, seed, {
  form = ZEN_ENSO_FORM.PRACTICE, includePaper = true, inkFillMode = 'ink',
  staticCacheKey = '', resolveMetrics = null,
} = {}) {
  const stroke = createZenEnsoStrokeState(canvas, ctx, seed, { form, inkFillMode, resolveMetrics });
  const { state, syncSize } = stroke;
  Object.assign(state, { includePaper, staticCacheKey, paperLayer: null });
  const preparePaper = () => {
    state.paperLayer = includePaper ? createLayer(state.width, state.height, state.dpr) : null;
    if (includePaper) buildPaper(state);
  };
  const rebuild = () => { stroke.rebuild(); preparePaper(); };
  const ensureScene = () => {
    if (stroke.ensureScene() || (includePaper && !state.paperLayer)) preparePaper();
  };
  const drawFrame = progress => {
    ensureScene();
    const targetIndex = Math.floor(clamp(progress, 0, 1) * state.enso.openIndex);
    if (targetIndex < state.lastIndex) rebuild();
    const inkChanged = targetIndex > state.lastIndex || (progress >= 1 && !state.splattersDone);
    // Head hold and eased tail retain the same pixels until new ink arrives.
    if (!inkChanged && state.inkFillMode !== 'cosmic') return;
    if (targetIndex > state.lastIndex) {
      drawRange(state, state.lastIndex + 1, targetIndex);
      state.lastIndex = targetIndex;
    }
    if (progress >= 1) addSplatters(state);
    compose(state);
  };
  const drawStatic = () => {
    // Cache lookup precedes scratch layers and brush compilation.
    syncSize();
    const cacheKey = buildStaticSnapshotCacheKey({
      staticCacheKey, seed, form: state.form, includePaper, inkFillMode: state.inkFillMode,
      pixelWidth: canvas.width, pixelHeight: canvas.height, dpr: state.dpr,
    });
    const snapshot = readStaticSnapshotCache(cacheKey);
    if (snapshot && drawStaticSnapshot(state, snapshot)) return;
    ensureScene(); stroke.ensureOpenStroke(); compose(state);
    writeStaticSnapshotCache(cacheKey, state);
  };
  return {
    drawAmbient() { ensureScene(); stroke.ensureOpenStroke(); compose(state); },
    drawClosure(progress) { ensureScene(); stroke.closeStroke(progress); compose(state); },
    drawFrame, drawStatic,
    reset() { state.needsRebuild = true; },
    resize: syncSize,
    setInkFillMode: stroke.setInkFillMode,
  };
}

function scheduleAnimationFrame(callback) {
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    return window.requestAnimationFrame(callback);
  }
  return window.setTimeout(() => callback(nowMs()), 16);
}

function cancelAnimationFrameLike(frameId) {
  if (!frameId) return;
  if (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
    window.cancelAnimationFrame(frameId);
    return;
  }
  window.clearTimeout(frameId);
}

function nowMs() {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

export function mountZenEnsoCanvas(canvas, {
  seed = 'zen-enso-loader',
  renderMode = 'animated',
  form = ZEN_ENSO_FORM.PRACTICE,
  includePaper = true,
  inkFillMode = 'ink',
  cosmicBreath = false,
  staticCacheKey = '',
} = {}) {
  if (!canvas || typeof window === 'undefined') {
    return () => {};
  }

  const shouldIncludePaper = includePaper !== false;
  const ctx = canvas.getContext('2d', { alpha: !shouldIncludePaper });
  if (!ctx) {
    return () => {};
  }

  const renderer = createZenEnsoRenderer(canvas, ctx, hashZenEnsoSeed(seed), {
    form,
    includePaper: shouldIncludePaper,
    inkFillMode,
    staticCacheKey,
    resolveMetrics: () => getCanvasDisplayMetrics(canvas),
  });
  const isStaticRender = renderMode === 'static';
  const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let reducedMotion = media?.matches === true;
  let frameId = 0;
  let resizeTimerId = 0;
  let startTime = 0;
  let ambientStartTime = 0;
  let lastAmbientFrameTime = 0;
  let finished = false;
  let disposed = false;
  const shouldRunCosmicBreath = () => inkFillMode === 'cosmic' && cosmicBreath === true && !reducedMotion;

  const renderCosmicBreath = (timestamp) => {
    if (disposed || !canvas.isConnected) {
      dispose();
      return;
    }

    if (!ambientStartTime) {
      ambientStartTime = timestamp;
    }

    if (lastAmbientFrameTime && timestamp - lastAmbientFrameTime < COSMIC_TWINKLE_FRAME_MS) {
      frameId = scheduleAnimationFrame(renderCosmicBreath);
      return;
    }

    lastAmbientFrameTime = timestamp;
    renderer.drawAmbient((timestamp - ambientStartTime) / 1000);
    frameId = scheduleAnimationFrame(renderCosmicBreath);
  };

  const startCosmicBreath = (timestamp = 0) => {
    cancelAnimationFrameLike(frameId);
    frameId = 0;
    if (!shouldRunCosmicBreath()) return;
    ambientStartTime = timestamp || 0;
    lastAmbientFrameTime = 0;
    frameId = scheduleAnimationFrame(renderCosmicBreath);
  };

  const render = (timestamp) => {
    if (disposed || !canvas.isConnected) {
      dispose();
      return;
    }

    if (!startTime) {
      startTime = timestamp;
    }

    if (reducedMotion) {
      renderer.drawStatic();
      finished = true;
      frameId = 0;
      return;
    }

    const elapsedMs = timestamp - startTime - ENSO_HEAD_HOLD_MS;
    const easedProgress = easeInOutCubic(elapsedMs / ENSO_DRAW_MS);
    const progress = lerp(ENSO_HEAD_PRELOAD_PROGRESS, 1, easedProgress);
    renderer.drawFrame(progress);

    if (progress < 1) {
      frameId = scheduleAnimationFrame(render);
      return;
    }

    finished = true;
    startCosmicBreath(timestamp);
  };

  function restart() {
    cancelAnimationFrameLike(frameId);
    frameId = 0;
    startTime = 0;
    finished = false;
    renderer.reset();

    if (reducedMotion) {
      renderer.drawStatic();
      finished = true;
      return;
    }

    renderer.drawFrame(ENSO_HEAD_PRELOAD_PROGRESS);
    frameId = scheduleAnimationFrame(render);
  }

  const onResize = () => {
    window.clearTimeout(resizeTimerId);
    resizeTimerId = window.setTimeout(() => {
      if (!renderer.resize()) return;
      renderer.reset();
      if (isStaticRender || finished || reducedMotion) {
        renderer.drawStatic();
        startCosmicBreath();
        return;
      }
      restart();
    }, RESIZE_DEBOUNCE_MS);
  };

  const onMotionPreferenceChange = (event) => {
    reducedMotion = event.matches === true;
    if (isStaticRender) {
      renderer.drawStatic();
      finished = true;
      startCosmicBreath();
      return;
    }
    restart();
  };

  const removeMotionPreferenceListener = () => {
    if (media?.removeEventListener) {
      media.removeEventListener('change', onMotionPreferenceChange);
    } else if (media?.removeListener) {
      media.removeListener(onMotionPreferenceChange);
    }
  };

  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrameLike(frameId);
    window.clearTimeout(resizeTimerId);
    frameId = 0;
    resizeTimerId = 0;
    removeMotionPreferenceListener();
    window.removeEventListener('resize', onResize);
    stopDpr();
  }

  if (!isStaticRender || inkFillMode === 'cosmic') {
    if (media?.addEventListener) {
      media.addEventListener('change', onMotionPreferenceChange);
    } else if (media?.addListener) {
      media.addListener(onMotionPreferenceChange);
    }
  }

  const stopDpr = observeDevicePixelRatio({ onChange: onResize });
  window.addEventListener('resize', onResize);

  if (isStaticRender || reducedMotion) {
    renderer.drawStatic();
    finished = true;
    startCosmicBreath();
  } else {
    renderer.drawFrame(ENSO_HEAD_PRELOAD_PROGRESS);
    frameId = scheduleAnimationFrame(render);
  }

  return dispose;
}

export function prewarmZenEnsoStaticSnapshot({
  seed = 'zen-enso-loader',
  form = ZEN_ENSO_FORM.PRACTICE,
  includePaper = true,
  inkFillMode = 'ink',
  staticCacheKey = '',
  width = 340,
  height = 340,
} = {}) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  if (typeof staticCacheKey !== 'string' || !staticCacheKey.trim()) return false;

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(Number(width) || 340));
  canvas.height = Math.max(1, Math.round(Number(height) || 340));

  try {
    const dispose = mountZenEnsoCanvas(canvas, {
      seed,
      renderMode: 'static',
      form,
      includePaper,
      inkFillMode,
      cosmicBreath: false,
      staticCacheKey,
    });
    dispose?.();
    return true;
  } catch {
    return false;
  }
}
