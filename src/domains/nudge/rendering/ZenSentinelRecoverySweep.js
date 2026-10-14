import { drawZenSentinelActor, resolveZenSentinelFingerprint } from './ZenSentinelInvocation.js';
import { GLOBAL_SENTINEL_ENTRY_STAGES } from '../nudge/nudgeGameGlobalSentinelProtocol.js';

const unit = value => Math.max(0, Math.min(1, value));
const smooth = value => { const t = unit(value); return t * t * (3 - 2 * t); };

// Repair advances in physical display columns behind the enormous body.
// Nothing scales or translates the original fracture coordinates.
export function resolveZenSentinelRecoverySweep(width, height, timeline, reducedMotion = false, sourceSnapshot) {
  const progress = timeline.recoverySweep;
  if (reducedMotion || !timeline.fieldVisible || progress <= 0 || progress >= 1) return { active: false };
  const rearRatio = sourceSnapshot?.bodyRearReachRatio;
  const noseRatio = sourceSnapshot?.noseForwardReachRatio;
  const centerRatio = sourceSnapshot?.bodyCenterRearRatio;
  const lateralRatio = sourceSnapshot?.bodyCenterLateralRatio;
  const halfWidthRatio = sourceSnapshot?.bodyHalfWidthRatio;
  if (![rearRatio, noseRatio, centerRatio, lateralRatio, halfWidthRatio].every(Number.isFinite)
      || rearRatio <= 0 || halfWidthRatio <= 0) throw new Error('ZEN_SENTINEL_BODY_EXTENT_REQUIRED');
  // The departed animal returns already enormous, completely outside the
  // left bank. Body extent owns its head-first entry and complete tail exit;
  // it never grows from a small animal parked in the middle of the display.
  const travel = smooth(progress);
  const size = Math.max(width * 2.6 / (rearRatio + noseRatio), height * 0.29 / halfWidthRatio);
  const rearExtent = size * rearRatio;
  const entryHead = -size * noseRatio - width * 0.06;
  const exitHead = width * 1.12 + rearExtent;
  const x = entryHead + (exitHead - entryHead) * travel;
  const repairFront = x - rearExtent;
  const tailCleared = smooth((repairFront - width) / (width * 0.1));
  return {
    active: true,
    x,
    y: height * (0.5 - travel * 0.035) - size * lateralRatio,
    size,
    rearExtent,
    repairFront: Math.max(-width, repairFront),
    heading: 0,
    opacity: 1 - tailCleared,
  };
}

// One existing entry pose owns both visible changes: its head carries the
// backlight into the damaged LCD; its measured tail seals the original glass.
export function resolveZenSentinelRecoverySurface(width, height, timeline, reducedMotion, sourceSnapshot) {
  if (![width, height, timeline?.elapsedMs, timeline?.recoverySweep].every(Number.isFinite)
      || width <= 0 || height <= 0 || typeof timeline.fieldVisible !== 'boolean') {
    throw new Error('ZEN_SENTINEL_RECOVERY_SURFACE_REQUIRED');
  }
  const inactive = { active: false };
  if (!timeline.fieldVisible) return { phase: 'page', backlightFront: 0, repairFront: 0, sweep: inactive };
  if (timeline.recoverySweep >= 1) return { phase: 'repair_field', backlightFront: width, repairFront: width, sweep: inactive };
  if (reducedMotion) {
    const returned = timeline.elapsedMs >= GLOBAL_SENTINEL_ENTRY_STAGES.GIANT_RETURN;
    return { phase: returned ? 'backlight_return' : 'damaged_lcd',
      backlightFront: returned ? width : 0, repairFront: 0, sweep: inactive };
  }
  if (timeline.recoverySweep <= 0) return { phase: 'damaged_lcd', backlightFront: 0, repairFront: 0, sweep: inactive };
  const sweep = resolveZenSentinelRecoverySweep(width, height, timeline, false, sourceSnapshot);
  const fingerprint = resolveZenSentinelFingerprint(timeline.elapsedMs, GLOBAL_SENTINEL_ENTRY_STAGES.GIANT_RETURN + 650, false);
  sweep.x += fingerprint * Math.min(width * 0.008, 12);
  sweep.repairFront = sweep.x - sweep.rearExtent;
  sweep.opacity = 1 - smooth((sweep.repairFront - width) / (width * 0.1));
  return { phase: 'backlight_return',
    backlightFront: unit((sweep.x + sweep.size * sourceSnapshot.noseForwardReachRatio) / width) * width,
    repairFront: unit(sweep.repairFront / width) * width,
    sweep };
}

export function drawZenSentinelRecoverySweep(ctx, surface, renderBudget, starterBurst, timeMs) {
  if (!surface.sweep.active) return;
  drawZenSentinelActor(ctx, starterBurst?.koiActor, starterBurst?.sourceHeading, surface.sweep, renderBudget, timeMs);
}
