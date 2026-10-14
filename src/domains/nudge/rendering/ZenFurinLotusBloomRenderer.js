import {
  WATER_LILY_STAGE_BLOOM,
  WATER_LILY_STAGE_BUD,
  drawWaterLilyRefined,
} from '@/themes/plugins/zen/api/waterLily.js';

const LOTUS_SPRITE_CACHE_LIMIT = 36;
const LOTUS_SPRITE_SCALE = 4;
const LOTUS_SPRITE_CACHE = new Map();

function clampUnit(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(1, numeric));
}

function smoothstep(edge0, edge1, value) {
  const span = edge1 - edge0;
  const progress = span === 0
    ? (value < edge0 ? 0 : 1)
    : clampUnit((value - edge0) / span);
  return progress * progress * (3 - 2 * progress);
}

function createSpriteCanvas(size) {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(size, size);
  }
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    return canvas;
  }
  return null;
}

function resolveFlowerCarrier(stage, color, phase, openAmount = null) {
  return {
    flowerStage: stage,
    flowerColor: color,
    flowerPhase: phase,
    ...(Number.isFinite(openAmount) ? { flowerOpenAmount: openAmount } : {}),
  };
}

function trimSpriteCache() {
  while (LOTUS_SPRITE_CACHE.size > LOTUS_SPRITE_CACHE_LIMIT) {
    const oldestKey = LOTUS_SPRITE_CACHE.keys().next().value;
    LOTUS_SPRITE_CACHE.delete(oldestKey);
  }
}

function resolveLotusSprite(stage, color, size, phase, openAmount) {
  const sizeBucket = Math.round(Math.max(8, size) / 2) * 2;
  const phaseBucket = Math.round(phase * 40) / 40;
  const openBucket = Number.isFinite(openAmount)
    ? Math.round(clampUnit(openAmount) * 20) / 20
    : null;
  const key = `${stage}|${color}|${sizeBucket}|${phaseBucket}|${openBucket ?? 'bud'}`;
  if (LOTUS_SPRITE_CACHE.has(key)) return LOTUS_SPRITE_CACHE.get(key);

  const canvasSize = Math.ceil(sizeBucket * LOTUS_SPRITE_SCALE);
  const canvas = createSpriteCanvas(canvasSize);
  const spriteContext = canvas?.getContext?.('2d', { alpha: true });
  if (!canvas || !spriteContext) return null;
  spriteContext.translate(canvasSize * 0.5, canvasSize * 0.5);
  drawWaterLilyRefined(
    resolveFlowerCarrier(stage, color, phaseBucket, openBucket),
    spriteContext,
    sizeBucket,
    1,
  );
  const sprite = Object.freeze({ canvas, canvasSize, sizeBucket });
  LOTUS_SPRITE_CACHE.set(key, sprite);
  trimSpriteCache();
  return sprite;
}

function drawLotusStage(ctx, {
  alpha,
  color,
  openAmount = null,
  phase,
  scale,
  size,
  stage,
}) {
  if (alpha <= 0.002) return;
  const previousAlpha = Number.isFinite(Number(ctx.globalAlpha)) ? Number(ctx.globalAlpha) : 1;
  ctx.save();
  ctx.globalAlpha = previousAlpha * alpha;
  ctx.scale(scale, scale);
  const sprite = typeof ctx.drawImage === 'function'
    ? resolveLotusSprite(stage, color, size, phase, openAmount)
    : null;
  if (sprite) {
    ctx.drawImage(
      sprite.canvas,
      -sprite.canvasSize * 0.5,
      -sprite.canvasSize * 0.5,
    );
  } else {
    drawWaterLilyRefined(
      resolveFlowerCarrier(stage, color, phase, openAmount),
      ctx,
      size,
      1,
    );
  }
  ctx.restore();
}

export function resolveZenFurinLotusBloomTimeline(progress) {
  const bloom = clampUnit(progress);
  const budExit = smoothstep(0.14, 0.38, bloom);
  const flowerEnter = smoothstep(0.10, 0.32, bloom);
  const bloomShare = smoothstep(0.58, 0.90, bloom);
  return Object.freeze({
    progress: bloom,
    presence: smoothstep(0.02, 0.14, bloom),
    budAlpha: 1 - budExit,
    flowerAlpha: flowerEnter,
    openingAlpha: flowerEnter * (1 - bloomShare),
    bloomAlpha: flowerEnter * bloomShare,
    openAmount: 0.20 + (smoothstep(0.08, 0.94, bloom) * 0.80),
    scale: 0.70 + smoothstep(0, 0.90, bloom) * 0.30,
  });
}

export function drawZenFurinLotusBloom(ctx, {
  alpha = 1,
  arrivalSeed = 0,
  color = 'sakura',
  progress = 0,
  size,
  x,
  y,
} = {}) {
  const numericSize = Number(size);
  const numericX = Number(x);
  const numericY = Number(y);
  if (![numericSize, numericX, numericY].every(Number.isFinite) || numericSize <= 0) {
    throw new Error('ZEN_FURIN_LOTUS_RENDER_INPUT_INVALID');
  }
  const timeline = resolveZenFurinLotusBloomTimeline(progress);
  const stablePhase = (Math.max(0, Math.round(Number(arrivalSeed) || 0)) * 0.37) + 0.42;
  const presenceAlpha = clampUnit(alpha) * timeline.presence;

  ctx.save();
  ctx.translate(numericX, numericY);
  drawLotusStage(ctx, {
    alpha: presenceAlpha * timeline.budAlpha,
    color,
    phase: stablePhase,
    scale: timeline.scale * 0.9,
    size: numericSize,
    stage: WATER_LILY_STAGE_BUD,
  });
  // Bud and flower overlap briefly, but the opening-to-bloom passage is one
  // cached organ set changing cup depth. This avoids the doubled petal mass a
  // three-sprite cross-fade produced around the middle of the cue.
  drawLotusStage(ctx, {
    alpha: presenceAlpha * timeline.flowerAlpha,
    color,
    openAmount: timeline.openAmount,
    phase: stablePhase,
    scale: timeline.scale,
    size: numericSize,
    stage: WATER_LILY_STAGE_BLOOM,
  });
  ctx.restore();
  return timeline;
}
