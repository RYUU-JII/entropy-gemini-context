import { GLOBAL_SENTINEL_ENTRY_STAGES } from '../nudge/nudgeGameGlobalSentinelProtocol.js';
import { resolveZenSentinelDepartureFault } from '../koi/ZenSentinelDeparture.js';

export const ZEN_SENTINEL_SHIKIGAMI_RELEASE_AT_MS = 2200;
export const ZEN_SENTINEL_SHIKIGAMI_VISIBLE_MS = 3400;

const unit = value => Math.max(0, Math.min(1, value));
const smooth = value => { const t = unit(value); return t * t * (3 - 2 * t); };

// A two-frame address discontinuity is the sentinel's signature. It is sparse,
// deterministic and shared by the detached spy and its enormous return.
export function resolveZenSentinelFingerprint(elapsedMs, cueMs, reducedMotion = false) {
  if (reducedMotion) return 0;
  const offset = elapsedMs - cueMs;
  if (offset >= 0 && offset < 44) return 1;
  if (offset >= 86 && offset < 130) return -1;
  return 0;
}

export function drawZenSentinelActor(ctx, actor, sourceHeading, pose, renderBudget, timeMs, appearance = 'sentinel') {
  if (typeof actor?.getSnapshot !== 'function' || typeof actor?.draw !== 'function') {
    throw new Error('ZEN_SENTINEL_PRESENTATION_ACTOR_REQUIRED');
  }
  const source = actor.getSnapshot();
  if (![source.x, source.y, source.size, source.heading, sourceHeading, pose.x, pose.y, pose.size, pose.heading, pose.opacity].every(Number.isFinite)
      || source.size <= 0 || pose.size <= 0) throw new Error('ZEN_SENTINEL_PRESENTATION_POSE_INVALID');
  if (pose.opacity <= 0) return;
  ctx.save();
  ctx.globalAlpha = Number(ctx.globalAlpha) * unit(pose.opacity);
  ctx.translate(pose.x, pose.y);
  ctx.rotate(pose.heading - source.heading);
  ctx.scale(pose.size / source.size, pose.size / source.size);
  ctx.translate(-source.x, -source.y);
  actor.draw(ctx, { intensity: 1, renderBudget, protocolScope: 'global', scenePhase: 'ritual', timeMs, appearance });
  ctx.restore();
}

export function drawZenSentinelPairedKoi(ctx, entity, renderBudget, timeMs) {
  const source = entity.koiActor.getSnapshot();
  const heading = source.heading;
  const offset = Math.max(7, source.size * 0.28);
  ctx.save();
  ctx.shadowBlur = 0;
  // Exact shared silhouette, offset like a mundane cast shadow. Color is a
  // visual role; it never changes the global protocol or its input authority.
  drawZenSentinelActor(ctx, entity.koiActor, heading, {
    ...source, x: source.x + offset * 0.55, y: source.y + offset,
    heading, opacity: 0.68,
  }, renderBudget, timeMs);
  entity.koiActor.draw(ctx, { intensity: 1, renderBudget, protocolScope: 'global', scenePhase: 'ritual', timeMs, appearance: 'shikigami' });
  ctx.restore();
}

export function resolveZenSentinelInvocation(burst, timeline, width, height, reducedMotion = false) {
  const detach = smooth(timeline.shadowDetach);
  const source = burst.koiActor.getSnapshot();
  const fault = resolveZenSentinelDepartureFault(timeline.elapsedMs, reducedMotion, burst.departure);
  const released = burst.shikigamiActor === null || timeline.elapsedMs >= ZEN_SENTINEL_SHIKIGAMI_VISIBLE_MS;
  if (!released && typeof burst.shikigamiActor?.getSnapshot !== 'function') {
    throw new Error('ZEN_SENTINEL_SHIKIGAMI_ACTOR_REQUIRED');
  }
  const shikigami = released ? null : burst.shikigamiActor.getSnapshot();
  const release = released ? 1 : smooth((timeline.elapsedMs - ZEN_SENTINEL_SHIKIGAMI_RELEASE_AT_MS)
    / (ZEN_SENTINEL_SHIKIGAMI_VISIBLE_MS - ZEN_SENTINEL_SHIKIGAMI_RELEASE_AT_MS));
  const forwardX = Math.cos(source.heading);
  const forwardY = Math.sin(source.heading);
  return {
    active: timeline.elapsedMs < GLOBAL_SENTINEL_ENTRY_STAGES.SHADOW_EXIT,
    release,
    fault,
    shadow: {
      // Preserve the cast offset while the native swimmer departs. Collapsing
      // it to zero during detachment used to move the shadow back onto color.
      x: source.x + burst.sourceSize * 0.16 - forwardX * fault.rewind * burst.sourceSize * 1.15,
      y: source.y + burst.sourceSize * 0.28 - forwardY * fault.rewind * burst.sourceSize * 1.15,
      size: burst.sourceSize,
      heading: source.heading,
      opacity: 0.72 + detach * 0.28,
    },
    shikigami: shikigami ? {
      x: shikigami.x,
      y: shikigami.y,
      size: burst.sourceSize,
      heading: shikigami.heading,
      opacity: 1 - release,
    } : { opacity: 0 },
  };
}

export function drawZenSentinelInvocation(ctx, width, height, timeline, burst, renderBudget, reducedMotion, timeMs) {
  if (!burst || timeline.elapsedMs >= GLOBAL_SENTINEL_ENTRY_STAGES.SHADOW_EXIT) return;
  const state = resolveZenSentinelInvocation(burst, timeline, width, height, reducedMotion);
  ctx.save();
  ctx.shadowBlur = 0;
  if (state.fault.split > 0) {
    const distance = burst.sourceSize * state.fault.split;
    const heading = state.shadow.heading;
    drawZenSentinelActor(ctx, burst.koiActor, burst.sourceHeading, {
      ...state.shadow,
      x: state.shadow.x + Math.cos(heading) * distance * 0.65 - Math.sin(heading) * distance * 0.92,
      y: state.shadow.y + Math.sin(heading) * distance * 0.65 + Math.cos(heading) * distance * 0.92,
      opacity: state.fault.split * 0.48,
    }, renderBudget, timeMs);
  }
  if (state.fault.raster > 0) {
    const radius = burst.sourceSize * 5;
    const bandHeight = radius * 2 / 6;
    for (let band = 0; band < 6; band += 1) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(state.shadow.x - radius, state.shadow.y - radius + band * bandHeight, radius * 2, bandHeight);
      ctx.clip();
      const polarity = (band + Math.floor(timeMs / 27)) % 2 ? 1 : -1;
      drawZenSentinelActor(ctx, burst.koiActor, burst.sourceHeading, {
        ...state.shadow,
        x: state.shadow.x + polarity * state.fault.raster * Math.min(9, burst.sourceSize * 0.1),
      }, renderBudget, timeMs);
      ctx.restore();
    }
  } else {
    drawZenSentinelActor(ctx, burst.koiActor, burst.sourceHeading, state.shadow, renderBudget, timeMs);
  }
  if (state.release < 1) {
    ctx.save();
    // The familiar body releases into small missing raster strips. The shape
    // beneath remains complete, so separation reads before its first stutter.
    if (!reducedMotion && state.release > 0) {
      const radius = burst.sourceSize * 5;
      ctx.beginPath();
      for (let i = 0; i < 26; i += 1) {
        if ((i * 11 % 26) / 26 < state.release) continue;
        ctx.rect(state.shikigami.x - radius, state.shikigami.y - radius + i * radius * 2 / 26, radius * 2, radius * 2 / 26);
      }
      ctx.clip();
    }
    drawZenSentinelActor(ctx, burst.shikigamiActor, burst.sourceHeading, state.shikigami, renderBudget, timeMs, 'shikigami');
    ctx.restore();
  }
  ctx.restore();
}
