import {
  CEREMONY_IDS,
  FIRST_VISION_DESCENT_TIMELINE,
  getCeremonyDurationMs,
} from '../ceremonyContracts.js';
import {
  clamp01,
  lerp,
  smoothstep,
} from './ceremonyRenderMath.js';

export const FIRST_VISION_DESCENT_CEREMONY_ID = CEREMONY_IDS.FIRST_VISION_DESCENT;
export const FIRST_VISION_DESCENT_DURATION_MS = getCeremonyDurationMs(FIRST_VISION_DESCENT_CEREMONY_ID);

export function createFirstVisionDescentPlaybackClock({
  holdAtCover = false,
  releaseCover = false,
} = {}) {
  let elapsedMs = 0;
  let lastNowMs = null;
  let holdEnabled = holdAtCover === true;
  let released = releaseCover === true;

  const isHolding = () => (
    holdEnabled
    && !released
    && elapsedMs >= FIRST_VISION_DESCENT_TIMELINE.coverHoldAtMs
  );

  return Object.freeze({
    advance(nowMs) {
      const normalizedNowMs = Math.max(0, Number(nowMs) || 0);
      if (lastNowMs === null) {
        lastNowMs = normalizedNowMs;
      } else if (!isHolding()) {
        elapsedMs += Math.max(0, normalizedNowMs - lastNowMs);
        lastNowMs = normalizedNowMs;
      } else {
        lastNowMs = normalizedNowMs;
      }

      if (
        holdEnabled
        && !released
        && elapsedMs >= FIRST_VISION_DESCENT_TIMELINE.coverHoldAtMs
      ) {
        elapsedMs = FIRST_VISION_DESCENT_TIMELINE.coverHoldAtMs;
      }

      return Object.freeze({
        elapsedMs,
        holding: isHolding(),
        released,
      });
    },
    setControls({
      holdAtCover: nextHoldAtCover = holdEnabled,
      releaseCover: nextReleaseCover = released,
    } = {}) {
      const wasHolding = isHolding();
      holdEnabled = nextHoldAtCover === true;
      released = released || nextReleaseCover === true;
      if (
        holdEnabled
        && !released
        && elapsedMs >= FIRST_VISION_DESCENT_TIMELINE.coverHoldAtMs
      ) {
        elapsedMs = FIRST_VISION_DESCENT_TIMELINE.coverHoldAtMs;
      }
      const holding = isHolding();
      if (wasHolding && !holding) {
        // The wall clock may have advanced for an arbitrary amount of time while
        // the app committed the current scene. Resume from the held frame.
        lastNowMs = null;
      }
      return Object.freeze({
        elapsedMs,
        holding,
        released,
      });
    },
    snapshot() {
      return Object.freeze({
        elapsedMs,
        holding: isHolding(),
        released,
      });
    },
  });
}

export function resolveFirstVisionDescentProgress(elapsedMs = 0) {
  const elapsed = Math.max(0, Number(elapsedMs) || 0);
  const coverRise = smoothstep(
    FIRST_VISION_DESCENT_TIMELINE.coverRiseStartMs,
    FIRST_VISION_DESCENT_TIMELINE.coverOpaqueAtMs,
    elapsed,
  );
  const coverRelease = smoothstep(
    FIRST_VISION_DESCENT_TIMELINE.releaseFadeStartMs,
    FIRST_VISION_DESCENT_DURATION_MS,
    elapsed,
  );
  const coverOpacity = clamp01(coverRise * (1 - coverRelease));
  const radianceLift = smoothstep(2400, 4700, elapsed);
  const radianceRelease = smoothstep(
    FIRST_VISION_DESCENT_TIMELINE.releaseFadeStartMs,
    FIRST_VISION_DESCENT_DURATION_MS,
    elapsed,
  );
  return Object.freeze({
    elapsedMs: elapsed,
    total: clamp01(elapsed / FIRST_VISION_DESCENT_DURATION_MS),
    lastGlimpse: 1 - smoothstep(980, 1900, elapsed),
    radiantCover: clamp01(radianceLift * (1 - radianceRelease)),
    coverOpacity,
    coverOpaque: coverOpacity === 1,
    coverHoldReached: elapsed >= FIRST_VISION_DESCENT_TIMELINE.coverHoldAtMs,
    quietDescent: smoothstep(
      FIRST_VISION_DESCENT_TIMELINE.releaseFadeStartMs,
      FIRST_VISION_DESCENT_DURATION_MS,
      elapsed,
    ),
    fadeOut: smoothstep(
      FIRST_VISION_DESCENT_TIMELINE.fadeOutStartMs,
      FIRST_VISION_DESCENT_DURATION_MS,
      elapsed,
    ),
  });
}

function drawRadiance(ctx, width, height, progress) {
  const fade = 1 - (progress.fadeOut * 0.98);
  if (fade <= 0.01) return;

  const cx = width * lerp(0.52, 0.5, progress.quietDescent);
  const cy = height * lerp(0.6, 0.46, progress.radiantCover);
  const maxR = Math.max(width, height);

  const glowAlpha = clamp01(
    progress.radiantCover * (1 - (progress.coverOpacity * 0.88)),
  ) * fade;
  if (glowAlpha > 0.01) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = glowAlpha;
    const glowR = maxR * lerp(0.42, 1.18, progress.radiantCover);
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
    glow.addColorStop(0, 'rgba(255, 252, 232, 0.95)');
    glow.addColorStop(0.32, 'rgba(255, 240, 200, 0.5)');
    glow.addColorStop(0.7, 'rgba(255, 222, 196, 0.12)');
    glow.addColorStop(1, 'rgba(255, 220, 190, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  const coverAlpha = progress.coverOpacity;
  if (coverAlpha > 0.01) {
    ctx.save();
    ctx.globalAlpha = coverAlpha;
    const coverR = maxR * 1.35;
    const cover = ctx.createRadialGradient(cx, cy, 0, cx, cy, coverR);
    cover.addColorStop(0, 'rgb(255, 254, 247)');
    cover.addColorStop(0.56, 'rgb(255, 252, 243)');
    cover.addColorStop(0.84, 'rgb(255, 250, 239)');
    cover.addColorStop(1, 'rgb(255, 248, 236)');
    ctx.fillStyle = cover;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
}

export function drawFirstVisionDescentFrame(ctx, {
  width = 1200,
  height = 800,
  elapsedMs = 0,
} = {}) {
  const safeWidth = Math.max(1, Number(width) || 1);
  const safeHeight = Math.max(1, Number(height) || 1);
  const progress = resolveFirstVisionDescentProgress(elapsedMs);

  ctx.clearRect(0, 0, safeWidth, safeHeight);

  // Airborne petals belong to the shared Zen app field; this renderer owns only cover.
  drawRadiance(ctx, safeWidth, safeHeight, progress);

  return progress;
}
