import { GLOBAL_SENTINEL_ENTRY_STAGES as STAGES } from '../nudge/nudgeGameGlobalSentinelProtocol.js';
import { sentinelFaultNoise as noise } from '../nudge/nudgeGameGlobalSentinelEntryFaults.js';

const unit = value => Math.max(0, Math.min(1, value));
const smooth = value => { const t = unit(value); return t * t * (3 - 2 * t); };
export const ZEN_SENTINEL_DEPARTURE_FAULT_MS = STAGES.SHADOW_DEPARTURE + 180;

// A bounded score of motor intents and address faults. No pose keyframes or
// alternative fish physics: the existing motor owns every position and turn.
export function createZenSentinelDeparture(burst, bounds) {
  const { sourceX: x, sourceY: y, sourceHeading: heading, sourceSize: size } = burst;
  const { width, height } = bounds;
  if (![x, y, heading, size, width, height].every(Number.isFinite) || size <= 0 || width <= 0 || height <= 0) {
    throw new Error('ZEN_SENTINEL_DEPARTURE_SOURCE_INVALID');
  }
  const tail = size * burst.koiActor.getSnapshot().bodyRearReachRatio;
  if (!Number.isFinite(tail) || tail <= 0) throw new Error('ZEN_SENTINEL_DEPARTURE_EXTENT_INVALID');
  const margin = Math.max(size * 2, tail + size);
  const key = burst.seed;
  if (!Number.isFinite(key)) throw new Error('ZEN_SENTINEL_DEPARTURE_SEED_REQUIRED');
  const dx = Math.cos(heading), dy = Math.sin(heading);
  const distanceX = Math.abs(dx) < 1e-8 ? Infinity : ((dx > 0 ? width + margin : -margin) - x) / dx;
  const distanceY = Math.abs(dy) < 1e-8 ? Infinity : ((dy > 0 ? height + margin : -margin) - y) / dy;
  const distance = Math.min(distanceX, distanceY);
  if (!Number.isFinite(distance) || distance <= 0) throw new Error('ZEN_SENTINEL_DEPARTURE_COURSE_INVALID');
  // Keep the accepted heading through the whole native swim. An interior
  // waypoint and steering back toward an overshot exit used to reverse it.
  const target = { x: x + dx * distance, y: y + dy * distance };
  const edge = distanceX <= distanceY ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'bottom' : 'top');
  const cruisePxPerSecond = (distance + margin * 0.7) / 2.3;
  // The native arena must include the whole outward run, including its two
  // bounded bursts, so an offscreen wall cannot reflect the departing actor.
  const runway = Math.max(margin * 3, cruisePxPerSecond * STAGES.SHADOW_EXIT / 1000 * 1.8);
  const motionBounds = { x: -runway, y: -runway, width: width + runway * 2, height: height + runway * 2, padding: 0 };
  const patterns = [
    { type: 'address_fault', atMs: ZEN_SENTINEL_DEPARTURE_FAULT_MS, durationMs: 390, strength: 1 },
    { type: 'burst', atMs: 3030 + noise(key + 7) * 200, durationMs: 460, strength: 0.4 },
    { type: 'address_fault', atMs: 3800 + noise(key + 19) * 350, durationMs: 260, strength: 0.6 },
    { type: 'burst', atMs: 4500 + noise(key + 29) * 180, durationMs: 580, strength: 0.32 },
  ];
  return Object.freeze({
    variant: 'outward_bank',
    patterns: Object.freeze(patterns.map(Object.freeze)),
    edge, heading, targetX: target.x, targetY: target.y,
    bounds: Object.freeze(motionBounds),
    cruisePxPerSecond,
  });
}

export function resolveZenSentinelDepartureFault(elapsedMs, reducedMotion = false, departure = null) {
  const pattern = departure?.patterns.find(p => p.type === 'address_fault' && elapsedMs >= p.atMs && elapsedMs < p.atMs + p.durationMs);
  const t = pattern ? (elapsedMs - pattern.atMs) * 390 / pattern.durationMs : elapsedMs - ZEN_SENTINEL_DEPARTURE_FAULT_MS;
  if (reducedMotion || (departure && !pattern) || t < 0 || t >= 390) return { held: false, rewind: 0, split: 0, raster: 0 };
  const strength = pattern ? pattern.strength : 1;
  return {
    held: t < 65,
    rewind: strength * (t < 65 ? 0 : t < 110 ? smooth((t - 65) / 45) : 1 - smooth((t - 110) / 230)),
    split: strength * smooth((t - 90) / 45) * (1 - smooth((t - 205) / 185)),
    raster: strength * (t < 65 ? 0.35 : (t < 155 ? 1 : 1 - smooth((t - 155) / 115))),
  };
}

export function resolveZenSentinelDepartureDrive(elapsedMs, departure) {
  const cruise = 0.1 * smooth((elapsedMs - STAGES.DETACHMENT) / 750);
  const leave = smooth((elapsedMs - STAGES.SHADOW_DEPARTURE) / 1200);
  const burst = departure.patterns.reduce((sum, p) => p.type === 'burst' && elapsedMs >= p.atMs && elapsedMs < p.atMs + p.durationMs
    ? sum + Math.sin((elapsedMs - p.atMs) / p.durationMs * Math.PI) * p.strength : sum, 0);
  return cruise + (1 - cruise) * leave + burst;
}

export function resolveZenSentinelDepartureMotion(departure, elapsedMs, reducedMotion, pose) {
  const heading = departure.heading;
  const error = Math.atan2(Math.sin(heading - pose.angle), Math.cos(heading - pose.angle));
  // Resolve a course, never interpolate the actor's world position.
  return {
    ...departure,
    heading,
    // Keep the same native manual intent through departure. Releasing it at
    // 3000ms previously handed the exiting animal back to its roaming owner.
    control: { active: true, cTurn: false, turnIntent: Math.max(-1, Math.min(1, error * 0.8)), forward: 1 },
  };
}
