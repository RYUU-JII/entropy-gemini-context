import {
  CEREMONY_IDS,
  getCeremonyDurationMs,
} from '../ceremonyContracts.js';
import {
  TAU,
  clamp,
  clamp01,
  lerp,
  mulberry32,
  smoothstep,
} from './ceremonyRenderMath.js';

export const BOOKMARK_NEUTRALIZED_CEREMONY_ID = CEREMONY_IDS.BOOKMARK_NEUTRALIZED;
export const BOOKMARK_NEUTRALIZED_DURATION_MS = getCeremonyDurationMs(BOOKMARK_NEUTRALIZED_CEREMONY_ID);

export function resolveBookmarkNeutralizedProgress(elapsedMs = 0) {
  const elapsed = Math.max(0, Number(elapsedMs) || 0);
  return Object.freeze({
    elapsedMs: elapsed,
    total: clamp01(elapsed / BOOKMARK_NEUTRALIZED_DURATION_MS),
    appear: smoothstep(0, 340, elapsed),
    wash: smoothstep(360, 1120, elapsed),
    fold: smoothstep(520, 1260, elapsed),
    dissolve: smoothstep(980, 1780, elapsed),
    fadeOut: smoothstep(1620, 2100, elapsed),
  });
}

export function createBookmarkNeutralizedFragments({
  width = 1200,
  height = 800,
  count = 48,
  seed = 42191,
} = {}) {
  const rng = mulberry32(seed);
  const scale = clamp(Math.sqrt((Math.max(1, width) * Math.max(1, height)) / (1200 * 800)), 0.7, 1.45);
  return Object.freeze(Array.from({ length: Math.max(18, Math.floor(Number(count) || 48)) }, (_, index) => Object.freeze({
    id: index,
    angle: rng() * TAU,
    distance: lerp(18, 154, rng()) * scale,
    size: lerp(2.2, 9, rng()) * scale,
    delay: lerp(760, 1240, rng()),
    spin: lerp(-2.4, 2.4, rng()),
    alpha: lerp(0.2, 0.78, rng()),
  })));
}

function drawBookmarkGlyph(ctx, size, progress) {
  const width = size * 0.62;
  const height = size;
  const notch = size * 0.2;
  const fold = progress.fold;

  ctx.save();
  ctx.scale(1 - (fold * 0.36), 1 - (fold * 0.18));
  ctx.rotate((fold * -0.18) + (Math.sin(progress.elapsedMs * 0.006) * 0.018));
  ctx.beginPath();
  ctx.moveTo(-width / 2, -height / 2);
  ctx.lineTo(width / 2, -height / 2);
  ctx.lineTo(width / 2, height / 2);
  ctx.lineTo(0, (height / 2) - notch);
  ctx.lineTo(-width / 2, height / 2);
  ctx.closePath();
  ctx.fillStyle = `rgba(248, 250, 242, ${0.9 * (1 - progress.dissolve)})`;
  ctx.fill();
  ctx.strokeStyle = `rgba(58, 82, 90, ${0.66 * (1 - progress.dissolve)})`;
  ctx.lineWidth = Math.max(1.2, size * 0.024);
  ctx.stroke();

  ctx.globalAlpha = (1 - progress.dissolve) * (0.34 + (progress.wash * 0.4));
  ctx.strokeStyle = 'rgba(113, 152, 153, 0.76)';
  ctx.lineWidth = Math.max(1, size * 0.018);
  ctx.beginPath();
  ctx.moveTo(-width * 0.28, -height * 0.16);
  ctx.lineTo(width * 0.28, -height * 0.16);
  ctx.moveTo(-width * 0.22, height * 0.02);
  ctx.lineTo(width * 0.2, height * 0.02);
  ctx.stroke();
  ctx.restore();
}

export function drawBookmarkNeutralizedFrame(ctx, {
  width = 1200,
  height = 800,
  elapsedMs = 0,
  fragments = [],
} = {}) {
  const safeWidth = Math.max(1, Number(width) || 1);
  const safeHeight = Math.max(1, Number(height) || 1);
  const progress = resolveBookmarkNeutralizedProgress(elapsedMs);
  const fade = 1 - progress.fadeOut;
  const cx = safeWidth * 0.5;
  const cy = safeHeight * 0.48;
  const scale = clamp(Math.min(safeWidth, safeHeight) / 760, 0.66, 1.18);
  const size = 124 * scale;

  ctx.clearRect(0, 0, safeWidth, safeHeight);
  ctx.save();
  ctx.globalAlpha = clamp01(0.08 + (progress.appear * 0.22) + (progress.wash * 0.2)) * fade;
  const veil = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(safeWidth, safeHeight) * 0.72);
  veil.addColorStop(0, 'rgba(246, 250, 240, 0.54)');
  veil.addColorStop(0.44, 'rgba(111, 145, 145, 0.22)');
  veil.addColorStop(1, 'rgba(14, 20, 28, 0.22)');
  ctx.fillStyle = veil;
  ctx.fillRect(0, 0, safeWidth, safeHeight);
  ctx.restore();

  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalAlpha = progress.appear * fade;
  ctx.shadowColor = 'rgba(214, 238, 226, 0.42)';
  ctx.shadowBlur = 34 * scale;
  drawBookmarkGlyph(ctx, size, progress);
  ctx.restore();

  ctx.save();
  ctx.translate(cx, cy + (size * 0.1));
  ctx.strokeStyle = 'rgba(231, 244, 236, 0.78)';
  ctx.lineCap = 'round';
  for (let i = 0; i < 5; i += 1) {
    const radius = (size * (0.36 + (i * 0.22))) + (progress.wash * size * 0.92);
    ctx.globalAlpha = clamp01((0.4 - (i * 0.055)) * progress.wash * (1 - progress.dissolve) * fade);
    ctx.lineWidth = Math.max(1.2, size * (0.018 - (i * 0.0015)));
    ctx.beginPath();
    ctx.ellipse(0, 0, radius, radius * 0.28, 0, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.translate(cx, cy);
  fragments.forEach((fragment) => {
    const local = clamp01((elapsedMs - fragment.delay) / 760);
    if (local <= 0) return;
    const distance = fragment.distance * smoothstep(0, 1, local);
    const x = Math.cos(fragment.angle) * distance;
    const y = Math.sin(fragment.angle) * distance * 0.58 - (local * size * 0.12);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(fragment.angle + (fragment.spin * local));
    ctx.globalAlpha = clamp01(fragment.alpha * progress.dissolve * (1 - local) * fade);
    ctx.fillStyle = 'rgba(244, 250, 240, 0.92)';
    ctx.fillRect(-fragment.size / 2, -fragment.size / 2, fragment.size, fragment.size * 0.42);
    ctx.restore();
  });
  ctx.restore();

  return progress;
}
