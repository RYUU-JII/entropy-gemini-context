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
} from './ceremonyRenderMath.js';

export const MEMORY_PURGE_TIDE_CEREMONY_ID = CEREMONY_IDS.MEMORY_PURGE_TIDE;
export const MEMORY_PURGE_TIDE_DURATION_MS = getCeremonyDurationMs(MEMORY_PURGE_TIDE_CEREMONY_ID);

// Seigaiha geometry — kept in lockstep with the in-card ZenGreatWave so the
// ceremony reads as the same artifact, just scaled up to fill the screen.
const BASE_RX = 36;
const BASE_RY = 22;
const WAVE_RINGS = 4;
const X_PACK = 0.92;
const ROW_PACK = 0.46;

// Tone (darken only, top of the field reads deeper — matches the card).
const TOP_DARKEN = 0.33;
const BOTTOM_DARKEN = 0.05;

const PAPER = '#fdfcf8';
const INK = '#0284c7';
const FOAM = 'rgb(245, 251, 255)';

// Timeline (3200ms). OPEN: rows fan out one after another, bottom-to-top, like
// a folding fan flicking open (촤라락). HOLD: fully covered. CLOSE: every row
// slides down together and off-screen, draining the tide top-to-bottom and
// uncovering the clean ground beneath.
const OPEN_START = 140;
const OPEN_CASCADE_MS = 900; // delay span between the first and last row opening
const ROW_OPEN_MS = 380; // how long a single row takes to slide into place
const OPEN_END = OPEN_START + OPEN_CASCADE_MS + ROW_OPEN_MS;
const RECEDE_START = 2040;
const RECEDE_END = 3160;

// C2-continuous easing — no velocity discontinuity anywhere on the curve.
function smootherstep(edge0, edge1, value) {
  const width = edge1 - edge0;
  if (!Number.isFinite(width) || width <= 0) return value >= edge1 ? 1 : 0;
  const t = clamp01((value - edge0) / width);
  return t * t * t * (t * ((t * 6) - 15) + 10);
}

const hexToRgb = (value) => {
  if (typeof value !== 'string') return null;
  const hex = value.trim().replace('#', '');
  if (!/^[\da-fA-F]{3}([\da-fA-F]{3})?$/.test(hex)) return null;
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
};

const FOAM_RGB = Object.freeze({ r: 245, g: 251, b: 255 });

function darkenRgb(rgb, amount) {
  const t = 1 - clamp01(amount);
  return {
    r: Math.round(rgb.r * t),
    g: Math.round(rgb.g * t),
    b: Math.round(rgb.b * t),
  };
}

function mixRgb(from, to, t) {
  const k = clamp01(t);
  return {
    r: Math.round(lerp(from.r, to.r, k)),
    g: Math.round(lerp(from.g, to.g, k)),
    b: Math.round(lerp(from.b, to.b, k)),
  };
}

const rgbStr = (rgb) => `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;

const INK_RGB = hexToRgb(INK) || { r: 2, g: 132, b: 199 };

export function resolveMemoryPurgeTideProgress(elapsedMs = 0) {
  const elapsed = Math.max(0, Number(elapsedMs) || 0);
  const cover = smootherstep(OPEN_START, OPEN_END, elapsed);     // fan open
  const recede = smootherstep(RECEDE_START, RECEDE_END, elapsed); // fold down
  // Foam glows while a leading edge is mid-screen — true during either sweep,
  // zero while fully covered (hold) or fully drained.
  const foam = clamp01(3.4 * Math.max(cover * (1 - cover), recede * (1 - recede)));
  return Object.freeze({
    elapsedMs: elapsed,
    total: clamp01(elapsed / MEMORY_PURGE_TIDE_DURATION_MS),
    // `tideIn` / `engulf` retained for ceremony contract + downstream readers.
    tideIn: cover,
    engulf: cover * (1 - recede),
    cover,
    recede,
    foam,
    fadeOut: recede,
  });
}

export function createMemoryPurgeTideParticles({
  width = 1200,
  height = 800,
  count = 96,
  seed = 99173,
} = {}) {
  const rng = mulberry32(seed);
  const safeWidth = Math.max(1, Number(width) || 1);
  const safeHeight = Math.max(1, Number(height) || 1);
  const scale = clamp(Math.sqrt((safeWidth * safeHeight) / (1200 * 800)), 0.72, 1.5);
  return Object.freeze(Array.from({ length: Math.max(28, Math.floor(Number(count) || 96)) }, (_, index) => Object.freeze({
    id: index,
    // x spans slightly beyond the edges so foam never shows a seam at the sides.
    x: lerp(-safeWidth * 0.08, safeWidth * 1.08, rng()),
    r: lerp(1.4, 5.2, rng()) * scale,
    drift: lerp(-40, 44, rng()),
    lift: lerp(18, 96, rng()),
    alpha: lerp(0.22, 0.7, rng()),
    phase: rng() * TAU,
    twinkle: lerp(0.004, 0.009, rng()),
  })));
}

function resolveFieldMetrics(width, height) {
  const rx = clamp(width / 9, 104, 232);
  const ry = rx * (BASE_RY / BASE_RX);
  const xGap = (rx * 2) * X_PACK;
  const rowGap = Math.max(8, ry * ROW_PACK);
  const cols = Math.ceil(width / xGap) + 4;
  const restTopY = -ry * 0.6; // top row's resting baseline, just above the top edge
  const rows = Math.ceil((height + (ry * 2.4) - restTopY) / rowGap) + 1;
  return { rx, ry, xGap, rowGap, cols, restTopY, rows };
}

// One full seigaiha scallop (upper-half concentric arcs on a paper fill).
function drawSeigaihaUnit(ctx, {
  x,
  y,
  rx,
  ry,
  strokeWidth,
  inkRgb,
  foamMix,
  alpha,
}) {
  ctx.save();
  ctx.translate(x, y);
  if (alpha < 0.999) ctx.globalAlpha = alpha;

  ctx.fillStyle = PAPER;
  ctx.beginPath();
  ctx.moveTo(-(rx * 1.04), 0);
  ctx.ellipse(0, 0, rx * 1.04, ry * 1.04, 0, Math.PI, TAU);
  ctx.closePath();
  ctx.fill();

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let ring = 0; ring < WAVE_RINGS; ring += 1) {
    const ringScale = 1 - (ring / WAVE_RINGS);
    const ringFoam = foamMix * clamp01(1 - (ring / 1.5));
    ctx.strokeStyle = ringFoam > 0.01 ? rgbStr(mixRgb(inkRgb, FOAM_RGB, ringFoam)) : rgbStr(inkRgb);
    ctx.lineWidth = strokeWidth;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx * ringScale, ry * ringScale, 0, Math.PI, TAU);
    ctx.stroke();
  }

  ctx.restore();
}

function drawSeigaihaField(ctx, { width, height, elapsedMs, progress, phase }) {
  if (progress.cover <= 0.0001 && progress.recede <= 0) return;

  const { rx, ry, xGap, rowGap, cols, restTopY, rows } = resolveFieldMetrics(width, height);
  const coverFoam = clamp01(3.4 * progress.cover * (1 - progress.cover));
  const closeOffset = (height + (ry * 2.6)) * progress.recede; // every row drops together
  const riseDist = rowGap * 1.8;
  const drift = (phase * xGap * 0.04) % xGap;

  // Top row drawn first, bottom last, so lower scallops overlap the row above
  // (the seigaiha fish-scale read). Opening order is bottom-first, though, so
  // the field fans upward.
  for (let row = 0; row <= rows; row += 1) {
    const order = rows - row; // 0 = bottom (opens first) … rows = top (opens last)
    const startDelay = OPEN_START + ((rows <= 0 ? 0 : order / rows) * OPEN_CASCADE_MS);
    const openP = smootherstep(startDelay, startDelay + ROW_OPEN_MS, elapsedMs);
    if (openP <= 0.001 && progress.recede <= 0) continue;

    const restY = restTopY + (row * rowGap);
    const y = restY + ((1 - openP) * riseDist) + closeOffset;
    if (y < restTopY - (ry * 1.5) || y > height + (ry * 2.6)) continue;

    const fadeIn = smootherstep(0, 0.32, openP); // fade as it begins to slide — no pop-in
    const alpha = progress.recede > 0 ? 1 : fadeIn;
    const depthFactor = clamp01(1 - (y / height)); // higher on screen reads deeper
    const inkRgb = darkenRgb(INK_RGB, lerp(BOTTOM_DARKEN, TOP_DARKEN, depthFactor));
    const strokeWidth = clamp((rx / BASE_RX) * 1.5 * (0.9 + (depthFactor * 0.35)), 1.4, 4.6);
    // The row glows with foam as it sweeps into place, settling to ink.
    const foamMix = coverFoam * Math.sin(clamp01(openP) * Math.PI);
    const xOffset = ((row % 2) * (xGap / 2)) - drift;

    for (let col = -1; col < cols; col += 1) {
      drawSeigaihaUnit(ctx, {
        x: (col * xGap) + xOffset,
        y,
        rx,
        ry,
        strokeWidth,
        inkRgb,
        foamMix,
        alpha,
      });
    }
  }
}

function drawFoamFlecks(ctx, { width, height, progress, particles, elapsedMs, phase }) {
  if (!Array.isArray(particles) || particles.length === 0 || progress.foam <= 0.01) return;
  const { ry, xGap, restTopY } = resolveFieldMetrics(width, height);
  // Leading edge: the cascade front while opening, the descending top while closing.
  const closeOffset = (height + (ry * 2.6)) * progress.recede;
  const edgeY = progress.recede > 0.001
    ? restTopY + closeOffset
    : lerp(height + ry, restTopY, progress.cover);
  const crestAmp = ry * 0.5;

  ctx.fillStyle = FOAM;
  for (let i = 0; i < particles.length; i += 1) {
    const p = particles[i];
    const twinkle = 0.55 + (0.45 * Math.sin((elapsedMs * (p.twinkle || 0.006)) + p.phase));
    const alpha = clamp01(progress.foam * p.alpha * twinkle);
    if (alpha <= 0.02) continue;
    const x = p.x + (Math.sin((elapsedMs * 0.003) + p.phase) * p.drift * 0.12);
    const y = edgeY + (crestAmp * Math.sin((x / (xGap * 0.8)) + phase)) - (p.r * 1.2);
    if (y < -p.r || y > height + p.r) continue;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(x, y, p.r * 0.7, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function drawMemoryPurgeTideFrame(ctx, {
  width = 1200,
  height = 800,
  elapsedMs = 0,
  particles = [],
} = {}) {
  const safeWidth = Math.max(1, Number(width) || 1);
  const safeHeight = Math.max(1, Number(height) || 1);
  const progress = resolveMemoryPurgeTideProgress(elapsedMs);
  const phase = elapsedMs * 0.0024;

  ctx.clearRect(0, 0, safeWidth, safeHeight);

  drawSeigaihaField(ctx, { width: safeWidth, height: safeHeight, elapsedMs, progress, phase });
  drawFoamFlecks(ctx, { width: safeWidth, height: safeHeight, progress, particles, elapsedMs, phase });

  return progress;
}
