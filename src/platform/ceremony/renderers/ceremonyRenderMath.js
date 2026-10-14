export const TAU = Math.PI * 2;

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const clamp01 = (value) => clamp(Number(value) || 0, 0, 1);
export const lerp = (from, to, t) => from + ((to - from) * clamp01(t));

export const smoothstep = (edge0, edge1, value) => {
  const width = Number(edge1) - Number(edge0);
  if (!Number.isFinite(width) || width <= 0) return value >= edge1 ? 1 : 0;
  const t = clamp01((Number(value) - Number(edge0)) / width);
  return t * t * (3 - (2 * t));
};

export const mulberry32 = (seed) => {
  let a = Math.floor(Number(seed) || 1) >>> 0;
  return () => {
    a += 0x6D2B79F5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
