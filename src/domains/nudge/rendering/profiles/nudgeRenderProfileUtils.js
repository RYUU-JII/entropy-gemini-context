export function scaleRenderCount(value, scale, minimum = 0, mode = 'round') {
  const scaled = Number(value) * Number(scale);
  const rounded = mode === 'ceil' ? Math.ceil(scaled) : Math.round(scaled);
  return Math.max(minimum, rounded);
}

export function capRenderBlur(value, scale, cap, enabled = true) {
  if (!enabled) return 0;
  return Math.max(0, Math.min(Number(cap), Math.round(Number(value) * Number(scale))));
}

export function freezeRenderProfile(profile) {
  return Object.freeze(profile);
}
