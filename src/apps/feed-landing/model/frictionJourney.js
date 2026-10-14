const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

const requireFinite = (value, name) => {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be a finite number.`);
};

const smoothRamp = (value, start, end) => {
  const amount = clamp((value - start) / (end - start), 0, 1);
  return amount * amount * (3 - 2 * amount);
};

/** A visual projection, not a measurement of attention or mental state. */
export function resolveFrictionState(progress, reducedMotion = false) {
  requireFinite(progress, 'progress');
  if (typeof reducedMotion !== 'boolean') throw new TypeError('reducedMotion must be a boolean.');
  const depth = clamp(progress, 0, 1);

  let phase = 'clear';
  if (depth >= 0.94) phase = 'horizon';
  else if (depth >= 0.55) phase = 'friction';
  else if (depth > 0.22) phase = 'softening';

  return Object.freeze({
    progress: depth,
    desaturation: smoothRamp(depth, 0.22, 0.40) * 0.96,
    blurPx: smoothRamp(depth, 0.58, 0.72) * 1.8,
    // Reduced motion keeps text stable while retaining static visual comparison.
    shuffle: reducedMotion ? 0 : smoothRamp(depth, 0.76, 0.88) * 0.7,
    signalReduction: smoothRamp(depth, 0.42, 0.56) * 0.9,
    phase,
  });
}

/**
 * Measures travel from the feed's top to the point its bottom meets the viewport.
 * The session's deepest reached point is retained when scrolling back up.
 */
export function resolveJourneyProgress({ scrollTop, feedTop, feedHeight, viewportHeight, previousProgress }) {
  for (const [name, value] of Object.entries({ scrollTop, feedTop, feedHeight, viewportHeight, previousProgress })) {
    requireFinite(value, name);
  }
  if (scrollTop < 0) throw new RangeError('scrollTop cannot be negative.');
  if (feedHeight <= 0 || viewportHeight <= 0) throw new RangeError('Feed and viewport heights must be positive.');
  if (previousProgress < 0 || previousProgress > 1) throw new RangeError('previousProgress must be between 0 and 1.');

  const travel = feedHeight - viewportHeight;
  const current = travel <= 0
    ? (scrollTop >= feedTop ? 1 : 0)
    : clamp((scrollTop - feedTop) / travel, 0, 1);
  return Math.max(previousProgress, current);
}
