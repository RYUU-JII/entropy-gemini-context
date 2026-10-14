import { BLEND_MODES, Container, Sprite } from '../../../runtime/worker/zenPixiWorkerRuntime.js';
import { createZenEnsoBrushCompiler, hashZenEnsoSeed } from '../../ZenEnsoCanvas.js';
import { buildDailyTwinkleStars, buildDailyConstellation, blendHex, withAlpha } from './zenEnsoRecipe.js';
import { createZenRaster } from './zenMaterialRaster.js';
import { zenEaseInOut } from './zenArtifactTiming.js';
import { settings } from '@pixi/settings';

// Enso is staged by how many of its signals are veiled, in the reverse of the
// other artifacts: it starts as an open circle full of stars, each veiled
// signal takes stars away, and with all of them the cosmos drains to plain ink
// and the held brush finishes its stroke into the head.
const STAR_KEEP = Object.freeze([1, 0.55, 0.25]);
const STAR_GLOW = Object.freeze([1, 0.8, 0.6]);
const DRAIN_MS = 900;
const CLOSE_MS = 1300;
const STAR_SHIFT_MS = 900;
const INK_SIZE = 340;
const PLATE_SIZE = 440;

function keyframe(values, phase) {
  const cursor = Math.min(values.length - 1.000001, phase * (values.length - 1));
  const i = Math.floor(cursor);
  return values[i] + (values[i + 1] - values[i]) * zenEaseInOut(cursor - i);
}

// Stable per-star order in which the stars go out.
function starRank(index) {
  const x = Math.sin((index + 1) * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function requireStage(presentation) {
  const { stage, stageCount } = presentation;
  if (!Number.isInteger(stageCount) || stageCount < 1 || !Number.isInteger(stage) || stage < 0 || stage > stageCount
    || typeof presentation.instant !== 'boolean') {
    throw new Error('ZEN_ARTIFACT_ENSO_STAGE_INVALID');
  }
  return { stage, stageCount, instant: presentation.instant };
}

function resolveTargets(stage, stageCount) {
  if (stage === stageCount) return { keep: 0, glow: 0, ink: 1, closure: 1 };
  const index = Math.min(STAR_KEEP.length - 1, Math.round((stage / stageCount) * STAR_KEEP.length));
  return { keep: STAR_KEEP[index], glow: STAR_GLOW[index], ink: 0, closure: 0 };
}

const approach = (value, target, step) => (value < target ? Math.min(target, value + step) : Math.max(target, value - step));

export function createZenEnsoScene({ color, nightDepth, dayKey, constellationVisible, assets, resolution }) {
  const root = new Container();
  const ink = settings.ADAPTER.createCanvas();
  const ctx = ink.getContext('2d');
  if (!ctx) throw new Error('ZEN_ENSO_COMPILER_CANVAS_UNAVAILABLE');
  const compiler = createZenEnsoBrushCompiler(ink, ctx, hashZenEnsoSeed('zen:artifact-veil-complete'), {
    inkFillMode: 'cosmic',
    resolveMetrics: () => ({ width: INK_SIZE, height: INK_SIZE, dpr: resolution }),
  });
  compiler.drawStatic();
  const plate = (context, shadowAlpha) => {
    context.filter = `contrast(1.08) saturate(1.08) drop-shadow(0 ${14 * resolution}px ${20 * resolution}px rgba(2,6,23,${shadowAlpha}))`;
    context.drawImage(ink, 50, 50, INK_SIZE, INK_SIZE);
  };
  const cosmic = new Sprite(assets.texture(createZenRaster(PLATE_SIZE, PLATE_SIZE, resolution, (context) => plate(context, 0.14))));

  // The plain-ink plate is redrawn while the held stroke is finished.
  compiler.setInkFillMode('ink');
  compiler.drawClosure(0);
  const inkPlateCanvas = createZenRaster(PLATE_SIZE, PLATE_SIZE, resolution, (context) => plate(context, 0.1));
  const inkPlateContext = inkPlateCanvas.getContext('2d');
  const inkTexture = assets.texture(inkPlateCanvas);
  const inkPlate = new Sprite(inkTexture);
  let paintedClosure = 0;
  const paintClosure = (progress) => {
    if (progress === paintedClosure) return;
    compiler.drawClosure(progress);
    inkPlateContext.save();
    inkPlateContext.setTransform(1, 0, 0, 1, 0, 0);
    inkPlateContext.clearRect(0, 0, inkPlateCanvas.width, inkPlateCanvas.height);
    inkPlateContext.restore();
    plate(inkPlateContext, 0.1);
    inkTexture.baseTexture.update();
    paintedClosure = progress;
  };

  for (const sprite of [cosmic, inkPlate]) {
    sprite.position.set(-220, -232);
    root.addChild(sprite);
  }

  let revealed = constellationVisible;
  let revealAt = null;
  const stars = buildDailyTwinkleStars(dayKey);
  const constellation = buildDailyConstellation(stars, dayKey);
  const glow = blendHex(color, '#bfdbfe', nightDepth);
  // Shared normalized star texture. Scale and alpha are the only frame inputs.
  const starTexture = assets.texture(createZenRaster(40, 40, resolution, (context) => {
    const gradient = context.createRadialGradient(20, 20, 0, 20, 20, 20);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.025, withAlpha(glow, 0.82));
    gradient.addColorStop(0.06, withAlpha(glow, 0.62));
    gradient.addColorStop(0.22, withAlpha(glow, 0.18));
    gradient.addColorStop(0.5, 'rgba(255,255,255,0.02)');
    gradient.addColorStop(1, 'transparent');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 40, 40);
  }));
  const sprites = stars.map((star) => {
    const sprite = new Sprite(starTexture);
    sprite.anchor.set(0.5);
    sprite.position.set(star.left * 3.4 - 170, star.top * 3.4 - 182);
    sprite.blendMode = BLEND_MODES.SCREEN;
    root.addChild(sprite);
    return sprite;
  });
  const ranks = stars.map((_, index) => starRank(index));
  const lines = new Sprite(assets.texture(createZenRaster(INK_SIZE, INK_SIZE, resolution, (context) => {
    context.beginPath();
    constellation.points.forEach((p, i) => context[i ? 'lineTo' : 'moveTo'](p.x * 3.4, p.y * 3.4));
    context.lineJoin = 'round'; context.lineCap = 'round';
    context.strokeStyle = withAlpha(glow, 0.28); context.lineWidth = 1.8; context.stroke();
    context.strokeStyle = 'rgba(255,255,255,0.76)'; context.lineWidth = 0.42; context.stroke();
    for (const p of constellation.points) {
      context.fillStyle = 'rgba(255,255,255,0.74)';
      context.beginPath(); context.arc(p.x * 3.4, p.y * 3.4, 3.6, 0, Math.PI * 2); context.fill();
    }
  })));
  lines.position.set(-170, -182); lines.blendMode = BLEND_MODES.SCREEN;
  root.addChild(lines);

  // Current animated values and where they are heading.
  const current = { keep: 1, glow: 1, ink: 0, closure: 0 };
  let target = null;
  let lastAtMs = null;

  const settle = () => {
    Object.assign(current, target);
    paintClosure(current.closure);
  };

  // Closing drains the cosmos first, then lays the stroke. Opening washes the
  // ink plate (closing stroke and all) back into the cosmos; the stroke is
  // taken back only once that plate is out of sight.
  const advance = (dt) => {
    current.keep = approach(current.keep, target.keep, dt / STAR_SHIFT_MS);
    current.glow = approach(current.glow, target.glow, dt / STAR_SHIFT_MS);
    if (target.ink === 1) {
      current.ink = approach(current.ink, 1, dt / DRAIN_MS);
      if (current.ink === 1) current.closure = approach(current.closure, 1, dt / CLOSE_MS);
    } else {
      current.ink = approach(current.ink, 0, dt / DRAIN_MS);
      if (current.ink === 0) current.closure = 0;
    }
    paintClosure(zenEaseInOut(current.closure));
  };

  return {
    root, geometry: { sprites: 46, brushCompiles: 1, liveFilters: 0 },
    configure(presentation, continuity, descriptor) {
      const visible = presentation ? presentation.constellationVisible : descriptor.constellationVisible;
      if (revealed !== visible) {
        revealed = visible; revealAt = null;
      }
      if (!presentation) throw new Error('ZEN_ARTIFACT_ENSO_STAGE_REQUIRED');
      const { stage, stageCount, instant } = requireStage(presentation);
      const first = target === null;
      target = resolveTargets(stage, stageCount);
      if (first || instant) settle();
    },
    update(atMs) {
      if (target === null) throw new Error('ZEN_ARTIFACT_ENSO_STAGE_REQUIRED');
      advance(lastAtMs === null ? 0 : Math.max(0, atMs - lastAtMs));
      lastAtMs = atMs;
      // Overlapped so the ring keeps its density through the change.
      cosmic.alpha = 0.92 * Math.min(1, (1 - current.ink) * 1.6);
      inkPlate.alpha = 0.92 * Math.min(1, current.ink * 1.6);
      if (revealed && revealAt === null) revealAt = atMs;
      lines.alpha = revealed ? Math.min(1, (atMs - revealAt) / 340) * Math.min(1, current.keep * 4) : 0;
      stars.forEach((star, i) => {
        const phase = (Math.max(0, atMs - star.delay * 1000) % (star.duration * 1000)) / (star.duration * 1000);
        const scale = keyframe([0.56, 1.46, 0.74, 1.14, 0.62], phase);
        const twinkle = keyframe([0.2, 1, 0.34, 0.82, 0.18], phase);
        const radius = Math.hypot(star.left - 50, star.top - 52) / Math.hypot(50, 52);
        const mask = radius < 0.24 ? Math.max(0, (radius - 0.2) / 0.04) : Math.min(1, Math.max(0, (0.49 - radius) / 0.07));
        const highlighted = revealed && constellation.indexSet.has(i);
        // A star goes out softly as the kept share passes its rank.
        const kept = Math.min(1, Math.max(0, ((current.keep * 1.08) - ranks[i]) / 0.08));
        sprites[i].scale.set(star.size * (highlighted ? scale * 1.4 : scale) / 2);
        sprites[i].alpha = (highlighted ? .96 : star.opacity * twinkle) * 0.68 * current.glow * kept * mask;
      });
    },
  };
}
