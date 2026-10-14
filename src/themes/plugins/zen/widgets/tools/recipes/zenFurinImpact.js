import { ZEN_FURIN_GEOMETRY as g } from './zenFurinGeometry.js';

export function projectZenFurinImpact(state) {
  if (state.lastImpactAt === null) return { x: 0, y: g.bellRimY, scale: 0.35, opacity: 0 };
  const age = state.simTimeMs - state.lastImpactAt;
  const progress = Math.min(1, Math.max(0, age / 420));
  return {
    // Positive pendulum rotation moves the rod toward the left rim.
    x: -state.lastImpactSide * g.bellInnerHalfWidth,
    y: g.bellRimY,
    scale: 0.35 + 1.8 * progress,
    opacity: progress < 1 ? state.lastImpactStrength * 0.28 * (1 - progress) ** 2 : 0,
  };
}
