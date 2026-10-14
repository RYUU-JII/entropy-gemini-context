import { createArtRandom } from './artworkMath.js';

const random = createArtRandom(7013);
const tilt = -0.34;
const points = [];

// At the aligned viewpoint these points describe a sphere and its rings.
// Independent depth offsets hide that silhouette when the viewpoint turns.
for (let row = -6; row <= 6; row += 1) {
    const latitude = row / 6 * Math.PI / 2;
    for (let column = 0; column < 32; column += 1) {
        const longitude = column / 32 * Math.PI * 2;
        points.push(Object.freeze({
            x: Math.cos(latitude) * Math.cos(longitude) * 137,
            y: Math.sin(latitude) * 137,
            depth: (random() - 0.5) * 650,
            radius: 1.1 + random() * 1.25,
            opacity: 0.35 + Math.max(0, Math.sin(longitude)) * 0.5,
            color: row < 0 ? '#f5dcb5' : '#c6aa87',
            layer: 'sphere',
        }));
    }
}
for (let band = 0; band < 5; band += 1) {
    for (let step = 0; step < 92; step += 1) {
        const theta = step / 92 * Math.PI * 2;
        const x = Math.cos(theta) * (253 + band * 4);
        const y = Math.sin(theta) * (66 + band * 1.5);
        points.push(Object.freeze({
            x: x * Math.cos(tilt) - y * Math.sin(tilt),
            y: x * Math.sin(tilt) + y * Math.cos(tilt),
            depth: (random() - 0.5) * 760,
            radius: 0.9 + random() * 0.85,
            opacity: 0.48 + random() * 0.45,
            color: band % 2 === 0 ? '#a8dfd5' : '#d6e9d8',
            layer: Math.sin(theta) < 0 ? 'back' : 'front',
        }));
    }
}

export const ALIGNMENT_POINTS = Object.freeze(points);
export const ALIGNMENT_STARS = Object.freeze(Array.from({ length: 62 }, () => Object.freeze({
    x: random() * 960, y: random() * 600,
    radius: 0.4 + random() * 0.8, opacity: 0.08 + random() * 0.25,
})));

export function projectAlignment(value) {
    if (!Number.isFinite(value) || value < 0 || value > 100) {
        throw new RangeError('Alignment viewpoint must be between 0 and 100.');
    }
    const angle = (1 - value / 100) * 0.85;
    const sine = Math.sin(angle);
    const cosine = Math.cos(angle);
    return ALIGNMENT_POINTS.map((point) => ({
        ...point,
        x: 480 + point.x * cosine + point.depth * sine,
        y: 265 + point.y + point.depth * sine * 0.24,
    }));
}
