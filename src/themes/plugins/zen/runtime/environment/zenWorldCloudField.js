// Shared CPU/GPU sky-plane contract. RGBA texels use LINEAR filtering and
// REPEAT wrapping; the CPU sampler includes the same half-texel convention.
export const ZEN_WORLD_CLOUD_FIELD_SIZE = 128;
export const ZEN_WORLD_CLOUD_PROJECTION_SCALE = 0.16;
export const ZEN_WORLD_CLOUD_HORIZON_FLOOR = 0.12;
export const ZEN_WORLD_CLOUD_EDGE_WIDTH = 0.12;

const pixelsBySeed = new Map();
const fract = (value) => value - Math.floor(value);
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (value) => value * value * (3 - 2 * value);
const requireFinite = (value, name) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`ZEN_WORLD_CLOUD_FIELD_INVALID:${name}`);
    }
    return value;
};
const requireSeed = (seed) => {
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
        throw new Error('ZEN_WORLD_CLOUD_SEED_INVALID');
    }
    return seed >>> 0;
};
const hash = (seed, x, y) => {
    let value = (seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263)) >>> 0;
    value = Math.imul(value ^ (value >>> 13), 1274126177) >>> 0;
    return ((value ^ (value >>> 16)) >>> 0) / 0xffffffff;
};
const tileNoise = (seed, u, v, cells) => {
    const x = u * cells;
    const y = v * cells;
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const tx = smooth(fract(x));
    const ty = smooth(fract(y));
    const at = (dx, dy) => hash(seed, (ix + dx) % cells, (iy + dy) % cells);
    return mix(mix(at(0, 0), at(1, 0), tx), mix(at(0, 1), at(1, 1), tx), ty);
};

export const resolveZenWorldCloudSeed = (worldId) => {
    if (typeof worldId !== 'string' || !worldId) throw new Error('ZEN_WORLD_CLOUD_WORLD_REQUIRED');
    let seed = 2166136261;
    for (let index = 0; index < worldId.length; index += 1) {
        seed = Math.imul(seed ^ worldId.charCodeAt(index), 16777619) >>> 0;
    }
    return seed;
};

export const buildZenWorldCloudFieldPixels = (seed) => {
    const key = requireSeed(seed);
    const cached = pixelsBySeed.get(key);
    if (cached) return cached;
    const size = ZEN_WORLD_CLOUD_FIELD_SIZE;
    const pixels = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
            const u = (x + 0.5) / size;
            const v = (y + 0.5) / size;
            const value = tileNoise(key, u, v, 4) * 0.58
                + tileNoise(key ^ 0x9e3779b9, u, v, 8) * 0.28
                + tileNoise(key ^ 0x85ebca6b, u, v, 16) * 0.14;
            const offset = (y * size + x) * 4;
            pixels[offset] = Math.round(value * 255);
            pixels[offset + 1] = pixels[offset];
            pixels[offset + 2] = pixels[offset];
            pixels[offset + 3] = 255;
        }
    }
    if (pixelsBySeed.size >= 8) pixelsBySeed.delete(pixelsBySeed.keys().next().value);
    pixelsBySeed.set(key, pixels);
    return pixels;
};

export const sampleZenWorldCloudDensity = ({
    seed, phaseX, phaseY, threshold, density, directionX, directionY, directionZ,
}) => {
    const values = { phaseX, phaseY, threshold, density, directionX, directionY, directionZ };
    Object.entries(values).forEach(([name, value]) => requireFinite(value, name));
    const pixels = buildZenWorldCloudFieldPixels(seed);
    const size = ZEN_WORLD_CLOUD_FIELD_SIZE;
    const z = Math.max(directionZ, ZEN_WORLD_CLOUD_HORIZON_FLOOR);
    const x = fract(directionX / z * ZEN_WORLD_CLOUD_PROJECTION_SCALE + phaseX) * size - 0.5;
    const y = fract(directionY / z * ZEN_WORLD_CLOUD_PROJECTION_SCALE + phaseY) * size - 0.5;
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const at = (dx, dy) => pixels[((((iy + dy + size) % size) * size) + ((ix + dx + size) % size)) * 4] / 255;
    const raw = mix(mix(at(0, 0), at(1, 0), fract(x)), mix(at(0, 1), at(1, 1), fract(x)), fract(y));
    const t = Math.max(0, Math.min(1, (raw - threshold + ZEN_WORLD_CLOUD_EDGE_WIDTH) / (2 * ZEN_WORLD_CLOUD_EDGE_WIDTH)));
    return smooth(t) * Math.max(0, Math.min(1, density));
};

// Advection is a world-owned sky velocity, independent of instantaneous pond
// wind. Absolute epoch integration prevents jumps when weather targets change.
export const resolveZenWorldCloudPhase = (seed, timestampMs) => {
    const key = requireSeed(seed);
    requireFinite(timestampMs, 'timestampMs');
    const hours = timestampMs / 3600000;
    return {
        cloudPhaseX: fract(hash(key, 41, 7) + hours * 1.2),
        cloudPhaseY: fract(hash(key, 9, 53) + hours * 0.63),
    };
};
