import { clamp } from './sakuraMath';

const TWO_PI = Math.PI * 2;

export const normalizeAngle = (angle = 0) => {
    let normalized = Number.isFinite(Number(angle)) ? Number(angle) : 0;
    while (normalized > Math.PI) normalized -= TWO_PI;
    while (normalized < -Math.PI) normalized += TWO_PI;
    return normalized;
};

export const shortestAngleDelta = (target = 0, source = 0) => (
    normalizeAngle((Number(target) || 0) - (Number(source) || 0))
);

export const blendAngles = (from = 0, to = 0, t = 0.5) => (
    normalizeAngle((Number(from) || 0) + shortestAngleDelta(to, from) * clamp(t, 0, 1))
);

export const smoothstep = (edge0 = 0, edge1 = 1, value = 0) => {
    const span = Math.max(1e-6, Number(edge1) - Number(edge0));
    const t = clamp(((Number(value) || 0) - Number(edge0)) / span, 0, 1);
    return t * t * (3 - (2 * t));
};
