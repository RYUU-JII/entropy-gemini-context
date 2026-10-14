const GRAIN_TILE_SIZE = 72;
const GRAIN_SPECKLE_COUNT = 150;

const hashUnit = (value = '') => {
    const source = String(value);
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
        hash ^= source.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return ((hash >>> 0) % 1000003) / 1000003;
};

const createGrainTileCanvas = () => {
    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
        const canvas = document.createElement('canvas');
        canvas.width = GRAIN_TILE_SIZE;
        canvas.height = GRAIN_TILE_SIZE;
        return canvas;
    }
    if (typeof OffscreenCanvas === 'function') {
        return new OffscreenCanvas(GRAIN_TILE_SIZE, GRAIN_TILE_SIZE);
    }
    return null;
};

let grainTile = null;
let grainTileFailed = false;

const resolveGrainTile = () => {
    if (grainTile || grainTileFailed) {
        return grainTile;
    }
    const canvas = createGrainTileCanvas();
    const ctx = canvas?.getContext?.('2d');
    if (!ctx) {
        grainTileFailed = true;
        return null;
    }
    for (let index = 0; index < GRAIN_SPECKLE_COUNT; index += 1) {
        const unit = (salt) => hashUnit(`bark_grain|${index}|${salt}`);
        const isDark = unit('tone') > 0.42;
        const alpha = isDark
            ? 0.05 + (unit('alpha') * 0.075)
            : 0.03 + (unit('alpha') * 0.05);
        ctx.fillStyle = isDark
            ? `rgba(22,13,15,${alpha})`
            : `rgba(255,236,228,${alpha})`;
        const radiusX = 0.5 + (unit('rx') * 1.25);
        const radiusY = radiusX * (1.35 + (unit('ry') * 2.4));
        ctx.beginPath();
        ctx.ellipse(
            unit('x') * GRAIN_TILE_SIZE,
            unit('y') * GRAIN_TILE_SIZE,
            radiusX,
            radiusY,
            (unit('rot') - 0.5) * 0.9,
            0,
            Math.PI * 2,
        );
        ctx.fill();
    }
    grainTile = canvas;
    return grainTile;
};

// Low-alpha speckle tile that breaks up flat gradients on wood. The pattern is
// anchored to canvas space, so it stays continuous across segment boundaries.
export const createSakuraBarkGrainPattern = (ctx) => {
    const tile = resolveGrainTile();
    if (!tile || typeof ctx?.createPattern !== 'function') {
        return null;
    }
    try {
        return ctx.createPattern(tile, 'repeat');
    } catch {
        return null;
    }
};

export default createSakuraBarkGrainPattern;
