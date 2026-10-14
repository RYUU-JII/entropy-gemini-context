import { clamp } from './sakuraMath';

export const clampInt = (value, min, max) => (
    Math.round(clamp(Number(value) || 0, min, max))
);

export const resolveNumber = (value, fallback, min, max) => {
    const raw = Number(value);
    const resolved = Number.isFinite(raw) ? raw : fallback;
    return clamp(resolved, min, max);
};
