// Shishi water is a physical material, independent of artifact-family energy
// colors. Both SVG and Pixi consume this palette; light is reflected, not emitted.
export const ZEN_SHISHI_WATER_MATERIAL = Object.freeze({
  shadow: '#536e71',
  body: '#a4bcbb',
  reflection: '#d6e3df',
  highlight: '#f0f4ef',
  ripple: '#b2cbc6',
});

export const ZEN_SHISHI_DROPLET_KEY_TIMES = Object.freeze([0, 0.18, 0.4, 0.68, 1]);
export const ZEN_SHISHI_GROUND_BEADS = Object.freeze([
  Object.freeze({ dx: -17, dy: -12, dur: 0.46, delay: 0, size: 2.1, alpha: 0.82 }),
  Object.freeze({ dx: 7, dy: -17, dur: 0.54, delay: 0.16, size: 1.8, alpha: 0.86 }),
  Object.freeze({ dx: 22, dy: -8, dur: 0.43, delay: 0.31, size: 1.4, alpha: 0.7 }),
]);

export function resolveZenShishiGroundSplashPose(impact, energy, phase) {
  const beat = 0.5 + 0.5 * Math.sin(phase * 13);
  return {
    opacity: Math.min(1, impact * 0.92 + energy * 0.08),
    scaleX: 0.8 + (1 - impact) * 0.65 + beat * 0.12,
    scaleY: 0.08 + impact * (0.65 + beat * 0.35),
    dropletOpacity: Math.min(1, impact * 1.15),
  };
}

export function resolveZenShishiGroundDropletPose(particle, progress) {
  const pose = resolveZenShishiDropletPose(particle, progress);
  const t = Math.max(0, Math.min(1, progress));
  const vy = 4 * particle.dy * (1 - 2 * t);
  return { ...pose, y: 4 * particle.dy * t * (1 - t),
    rotate: Math.atan2(vy, particle.dx) * 180 / Math.PI - 90 };
}

// SVG keyframes and the retained renderer sample the same ballistic arc.
export function resolveZenShishiDropletPose(particle, progress) {
  const t = Math.max(0, Math.min(1, progress));
  const envelope = Math.sin(Math.PI * t);
  const vy = 4 * particle.dy * (1 - 2 * t) + 56 * t;
  const size = particle.size / 3.4;
  return {
    x: particle.dx * t,
    y: 4 * particle.dy * t * (1 - t) + 28 * t * t,
    rotate: Math.atan2(vy, particle.dx) * 180 / Math.PI - 90,
    scaleX: size * (0.72 + envelope * 0.18),
    scaleY: size * (0.9 + Math.min(0.6, Math.hypot(particle.dx, vy) / 160)),
    opacity: particle.alpha * envelope * envelope,
  };
}
