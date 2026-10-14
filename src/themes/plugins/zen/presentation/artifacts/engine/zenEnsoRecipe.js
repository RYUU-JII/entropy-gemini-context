import { createZenSeededRandom, pickZenIndex, sampleZenRange } from '../../../shared/zenSeededRandom.js';

const ENSO_STAR_LAYOUT_SEED = 'zen:enso:hero-star-layout:v1';
const ENSO_STAR_LAYOUT_JITTER_PERCENT = 4.2;
const ENSO_CONSTELLATION_SEED = 'zen:enso:constellation:v1';
const ENSO_CONSTELLATION_STAR_COUNT = 7;
const ENSO_STAR_LAYOUT_BOUNDS = Object.freeze({
    minLeft: 18,
    maxLeft: 82,
    minTop: 20,
    maxTop: 82,
});
const ENSO_STAR_VISIBLE_RING = Object.freeze({
    centerLeft: 50,
    centerTop: 52,
    minRadius: 26,
    maxRadius: 40,
});
const ENSO_TWINKLE_STARS = Object.freeze([
    { left: 31, top: 30, size: 3.2, opacity: 0.78, delay: 0.05, duration: 2.2 },
    { left: 34, top: 23, size: 1.5, opacity: 0.48, delay: 2.32, duration: 3.6 },
    { left: 37, top: 26, size: 1.9, opacity: 0.56, delay: 1.62, duration: 3.0 },
    { left: 45, top: 24, size: 2.4, opacity: 0.64, delay: 0.72, duration: 2.8 },
    { left: 52, top: 23, size: 1.7, opacity: 0.52, delay: 1.88, duration: 3.2 },
    { left: 55, top: 28, size: 1.4, opacity: 0.46, delay: 2.72, duration: 3.8 },
    { left: 58, top: 25, size: 2.9, opacity: 0.7, delay: 1.18, duration: 2.4 },
    { left: 65, top: 29, size: 1.8, opacity: 0.58, delay: 0.24, duration: 2.9 },
    { left: 72, top: 36, size: 3.4, opacity: 0.82, delay: 0.38, duration: 2.0 },
    { left: 76, top: 43, size: 2.1, opacity: 0.6, delay: 1.28, duration: 2.7 },
    { left: 81, top: 45, size: 1.5, opacity: 0.5, delay: 2.48, duration: 3.4 },
    { left: 78, top: 52, size: 2.2, opacity: 0.58, delay: 1.46, duration: 3.1 },
    { left: 70, top: 55, size: 1.5, opacity: 0.48, delay: 2.64, duration: 3.7 },
    { left: 76, top: 60, size: 1.9, opacity: 0.54, delay: 0.68, duration: 3.0 },
    { left: 73, top: 68, size: 2.8, opacity: 0.68, delay: 0.96, duration: 2.6 },
    { left: 78, top: 72, size: 1.4, opacity: 0.46, delay: 2.88, duration: 3.9 },
    { left: 67, top: 74, size: 1.7, opacity: 0.5, delay: 1.76, duration: 3.4 },
    { left: 59, top: 78, size: 3.1, opacity: 0.76, delay: 0.18, duration: 2.3 },
    { left: 52, top: 81, size: 1.9, opacity: 0.56, delay: 1.52, duration: 3.1 },
    { left: 46, top: 76, size: 1.5, opacity: 0.48, delay: 2.42, duration: 3.5 },
    { left: 43, top: 80, size: 2.3, opacity: 0.6, delay: 1.34, duration: 3.0 },
    { left: 34, top: 83, size: 1.4, opacity: 0.46, delay: 2.94, duration: 3.8 },
    { left: 36, top: 77, size: 1.8, opacity: 0.54, delay: 0.82, duration: 2.8 },
    { left: 29, top: 70, size: 3.5, opacity: 0.84, delay: 0.54, duration: 2.1 },
    { left: 19, top: 68, size: 1.5, opacity: 0.5, delay: 2.2, duration: 3.6 },
    { left: 24, top: 62, size: 2.1, opacity: 0.58, delay: 1.16, duration: 2.7 },
    { left: 22, top: 54, size: 2.6, opacity: 0.66, delay: 1.02, duration: 2.7 },
    { left: 28, top: 58, size: 1.4, opacity: 0.46, delay: 2.6, duration: 3.5 },
    { left: 23, top: 47, size: 1.8, opacity: 0.52, delay: 0.3, duration: 3.2 },
    { left: 18, top: 40, size: 1.5, opacity: 0.48, delay: 2.14, duration: 3.7 },
    { left: 25, top: 42, size: 2.0, opacity: 0.52, delay: 1.72, duration: 3.3 },
    { left: 30, top: 37, size: 1.7, opacity: 0.5, delay: 2.04, duration: 3.5 },
    { left: 33, top: 44, size: 1.4, opacity: 0.46, delay: 2.78, duration: 3.9 },
    { left: 39, top: 34, size: 1.6, opacity: 0.5, delay: 0.46, duration: 3.3 },
    { left: 50, top: 31, size: 2.0, opacity: 0.62, delay: 1.4, duration: 2.8 },
    { left: 62, top: 35, size: 1.7, opacity: 0.54, delay: 2.18, duration: 3.1 },
    { left: 59, top: 42, size: 1.4, opacity: 0.46, delay: 2.36, duration: 3.7 },
    { left: 69, top: 47, size: 2.0, opacity: 0.6, delay: 0.12, duration: 2.5 },
    { left: 72, top: 58, size: 1.5, opacity: 0.5, delay: 2.52, duration: 3.6 },
    { left: 64, top: 66, size: 1.8, opacity: 0.56, delay: 1.9, duration: 3.0 },
    { left: 55, top: 68, size: 1.4, opacity: 0.46, delay: 2.84, duration: 3.8 },
    { left: 49, top: 73, size: 2.0, opacity: 0.62, delay: 0.6, duration: 2.6 },
]);

export function clamp01(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function clampStarToVisibleRing(left, top) {
    const dx = left - ENSO_STAR_VISIBLE_RING.centerLeft;
    const dy = top - ENSO_STAR_VISIBLE_RING.centerTop;
    const distance = Math.hypot(dx, dy);
    if (!Number.isFinite(distance) || distance <= 0) {
        return {
            left: ENSO_STAR_VISIBLE_RING.centerLeft,
            top: ENSO_STAR_VISIBLE_RING.centerTop - ENSO_STAR_VISIBLE_RING.minRadius,
        };
    }

    const clampedDistance = clamp(
        distance,
        ENSO_STAR_VISIBLE_RING.minRadius,
        ENSO_STAR_VISIBLE_RING.maxRadius
    );
    const scale = clampedDistance / distance;
    return {
        left: ENSO_STAR_VISIBLE_RING.centerLeft + (dx * scale),
        top: ENSO_STAR_VISIBLE_RING.centerTop + (dy * scale),
    };
}

export function formatLocalDayKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function buildDailyTwinkleStars(dayKey = formatLocalDayKey()) {
    const rng = createZenSeededRandom(ENSO_STAR_LAYOUT_SEED, dayKey);
    return ENSO_TWINKLE_STARS.map((star) => {
        const rawLeft = clamp(
            star.left + sampleZenRange(rng, -ENSO_STAR_LAYOUT_JITTER_PERCENT, ENSO_STAR_LAYOUT_JITTER_PERCENT),
            ENSO_STAR_LAYOUT_BOUNDS.minLeft,
            ENSO_STAR_LAYOUT_BOUNDS.maxLeft
        );
        const rawTop = clamp(
            star.top + sampleZenRange(rng, -ENSO_STAR_LAYOUT_JITTER_PERCENT, ENSO_STAR_LAYOUT_JITTER_PERCENT),
            ENSO_STAR_LAYOUT_BOUNDS.minTop,
            ENSO_STAR_LAYOUT_BOUNDS.maxTop
        );
        const { left, top } = clampStarToVisibleRing(rawLeft, rawTop);
        return {
            ...star,
            left: Number(left.toFixed(2)),
            top: Number(top.toFixed(2)),
        };
    });
}

export function buildDailyConstellation(stars, dayKey = formatLocalDayKey()) {
    const sourceStars = Array.isArray(stars) ? stars : [];
    if (sourceStars.length < ENSO_CONSTELLATION_STAR_COUNT) {
        return { indexSet: new Set(), path: '', points: [] };
    }

    const rng = createZenSeededRandom(ENSO_CONSTELLATION_SEED, dayKey);
    const angularStars = sourceStars
        .map((star, index) => ({
            index,
            x: star.left,
            y: star.top,
            angle: Math.atan2(star.top - 52, star.left - 50),
        }))
        .sort((left, right) => left.angle - right.angle);
    const offset = pickZenIndex(rng, angularStars.length);
    const stride = Math.max(1, Math.floor(angularStars.length / ENSO_CONSTELLATION_STAR_COUNT));
    const selected = [];
    const selectedIndices = new Set();

    for (let slot = 0; slot < ENSO_CONSTELLATION_STAR_COUNT; slot += 1) {
        const jitter = pickZenIndex(rng, 3) - 1;
        let cursor = (offset + (slot * stride) + jitter + angularStars.length) % angularStars.length;
        let candidate = angularStars[cursor];
        while (selectedIndices.has(candidate.index)) {
            cursor = (cursor + 1) % angularStars.length;
            candidate = angularStars[cursor];
        }
        selected.push(candidate);
        selectedIndices.add(candidate.index);
    }

    selected.sort((left, right) => left.angle - right.angle);
    const path = selected
        .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
        .join(' ');

    return {
        indexSet: selectedIndices,
        path,
        points: selected,
    };
}

function hexToRgb(value) {
    if (typeof value !== 'string') return null;
    const raw = value.trim().replace('#', '');
    if (!/^[\da-fA-F]{3}([\da-fA-F]{3})?$/.test(raw)) return null;
    const fullHex = raw.length === 3
        ? raw.split('').map((char) => char + char).join('')
        : raw;
    return {
        r: parseInt(fullHex.slice(0, 2), 16),
        g: parseInt(fullHex.slice(2, 4), 16),
        b: parseInt(fullHex.slice(4, 6), 16),
    };
}

export function withAlpha(value, alpha, fallback) {
    const rgb = hexToRgb(value);
    if (!rgb) return fallback || `rgba(255,255,255,${alpha})`;
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

export function blendHex(start, end, amount) {
    const from = hexToRgb(start);
    const to = hexToRgb(end);
    if (!from || !to) return start;
    const t = clamp01(amount);
    const channel = (value) => Math.round(value).toString(16).padStart(2, '0');
    return `#${channel(from.r + ((to.r - from.r) * t))}${channel(from.g + ((to.g - from.g) * t))}${channel(from.b + ((to.b - from.b) * t))}`;
}

