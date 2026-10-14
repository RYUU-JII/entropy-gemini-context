import { buildZenRockShapeSeedKey } from '../../world/decor/decorHeroRock.js';
import { hashStringFNV1a } from '../../../shared/zenSeededRandom.js';

export const ZEN_ROCK_MINERAL_MATERIAL_VERSION = 'zen-rock-mineral-rgba8-v1';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const smooth = (value) => value * value * (3 - 2 * value);
const hash = (x, y, seed) => {
    let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ seed;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
};
const noise = (x, y, seed) => {
    const ix = Math.floor(x), iy = Math.floor(y), tx = smooth(x - ix), ty = smooth(y - iy);
    const a = hash(ix, iy, seed), b = hash(ix + 1, iy, seed);
    const c = hash(ix, iy + 1, seed), d = hash(ix + 1, iy + 1, seed);
    return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
};

const filterHeights = (heights, width, height, sigma) => {
    const radius = Math.ceil(sigma * 3), kernel = [];
    let total = 0;
    for (let offset = -radius; offset <= radius; offset += 1) {
        const weight = Math.exp(-offset * offset / (2 * sigma * sigma));
        kernel.push(weight); total += weight;
    }
    const horizontal = new Float32Array(heights.length), result = new Float32Array(heights.length);
    for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
        let value = 0;
        for (let offset = -radius; offset <= radius; offset += 1) {
            value += heights[y * width + clamp(x + offset, 0, width - 1)] * kernel[offset + radius];
        }
        horizontal[y * width + x] = value / total;
    }
    for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
        let value = 0;
        for (let offset = -radius; offset <= radius; offset += 1) {
            value += horizontal[clamp(y + offset, 0, height - 1) * width + x] * kernel[offset + radius];
        }
        result[y * width + x] = value / total;
    }
    return result;
};

// Cold bake only. RGB pigment and geometric slopes are separate; alpha stays
// the replayed shape coverage. Neither map contains time, weather or a light.
export const bakeZenRockMineralMaterial = ({ coverage, width, height, rock }) => {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 3 || height < 3
        || !ArrayBuffer.isView(coverage) || Object.prototype.toString.call(coverage) !== '[object Uint8ClampedArray]'
        || coverage.length !== width * height * 4) {
        throw new Error('ZEN_ROCK_MINERAL_COVERAGE_INVALID');
    }
    const seed = hashStringFNV1a(buildZenRockShapeSeedKey(rock));
    for (const key of ['size', 'roughness', 'tone', 'profileAxis', 'ridgeStrength']) {
        if (!Number.isFinite(rock[key])) throw new Error(`ZEN_ROCK_MINERAL_FIELD_INVALID:${key}`);
    }
    if (rock.size <= 0 || rock.tone < 0 || rock.tone > 1) throw new Error('ZEN_ROCK_MINERAL_RANGE_INVALID');
    const { size } = rock;
    const distance = new Float32Array(width * height);
    for (let i = 0; i < distance.length; i += 1) distance[i] = coverage[i * 4 + 3] >= 128 ? width + height : 0;
    for (let y = 1; y < height - 1; y += 1) for (let x = 1; x < width - 1; x += 1) {
        const i = y * width + x;
        distance[i] = Math.min(distance[i], distance[i - 1] + 1, distance[i - width] + 1,
            distance[i - width - 1] + Math.SQRT2, distance[i - width + 1] + Math.SQRT2);
    }
    for (let y = height - 2; y > 0; y -= 1) for (let x = width - 2; x > 0; x -= 1) {
        const i = y * width + x;
        distance[i] = Math.min(distance[i], distance[i + 1] + 1, distance[i + width] + 1,
            distance[i + width - 1] + Math.SQRT2, distance[i + width + 1] + Math.SQRT2);
    }
    const maxDistance = distance.reduce((maximum, value) => Math.max(maximum, value), 0);
    if (maxDistance <= 0) throw new Error('ZEN_ROCK_MINERAL_COVERAGE_EMPTY');
    const heights = new Float32Array(distance.length);
    const pigment = new Uint8ClampedArray(coverage.length);
    const formCoverage = new Uint8ClampedArray(coverage.length);
    const ca = Math.cos(rock.profileAxis), sa = Math.sin(rock.profileAxis);
    const detailScale = clamp((size - 32) / 80, 0.15, 1);
    const relief = rock.variant === 'flat' || rock.variant === 'slab' ? 0.11 : 0.19;
    const tone = (rock.tone - 0.5) * 12;
    for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
        const i = y * width + x, alpha = coverage[i * 4 + 3];
        // Coverage is independent of form RGB, including antialiased edges.
        formCoverage[i * 4] = 128; formCoverage[i * 4 + 1] = 128; formCoverage[i * 4 + 2] = 255;
        formCoverage[i * 4 + 3] = alpha;
        if (!alpha) continue;
        const nx = (x - width / 2) / size, ny = (y - height / 2) / size;
        const u = ca * nx + sa * ny, v = -sa * nx + ca * ny;
        const broad = noise(u * 6 + 7, v * 6 + 11, seed) - 0.5;
        const medium = noise(u * 19 + 23, v * 19 + 37, seed ^ 0x723ad) - 0.5;
        const grain = noise(x / 2.8, y / 2.8, seed ^ 0x33ab9) - 0.5;
        const vein = Math.exp(-Math.abs(v + broad * 0.10 - 0.06) * 95)
            * clamp((broad + 0.5) * 1.7, 0, 1);
        const dome = Math.pow(clamp(distance[i] / maxDistance, 0, 1), 0.8);
        heights[i] = dome * size * relief * (1 + broad * 0.38 + medium * 0.04 * rock.roughness)
            - vein * dome * size * 0.006 * rock.ridgeStrength;
        const mineral = broad * 28 + medium * 10 * detailScale + grain * 5 * detailScale - vein * 3 * detailScale;
        const warmth = noise(u * 3 + 51, v * 3 + 61, seed ^ 0x768cb) - 0.5;
        pigment[i * 4] = 128 + tone + mineral + warmth * 7;
        pigment[i * 4 + 1] = 129 + tone + mineral + warmth * 2;
        pigment[i * 4 + 2] = 122 + tone + mineral - warmth * 5;
        pigment[i * 4 + 3] = alpha;
    }
    // Smooth the distance-field steps before differentiating: they are raster
    // artifacts, not actual ribs or cracks in the stone.
    const filtered = filterHeights(heights, width, height, clamp(size * 0.025, 2, 5));
    for (let y = 1; y < height - 1; y += 1) for (let x = 1; x < width - 1; x += 1) {
        const i = y * width + x;
        if (!coverage[i * 4 + 3]) continue;
        const dx = (filtered[i + 1] - filtered[i - 1]) * 0.5;
        const dy = (filtered[i + width] - filtered[i - width]) * 0.5;
        const length = Math.hypot(dx, dy, 1);
        formCoverage[i * 4] = (-dx / length * 0.5 + 0.5) * 255;
        formCoverage[i * 4 + 1] = (-dy / length * 0.5 + 0.5) * 255;
        formCoverage[i * 4 + 2] = (1 / length * 0.5 + 0.5) * 255;
    }
    return { pigment, formCoverage };
};
