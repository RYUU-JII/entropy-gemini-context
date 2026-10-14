/**
 * The one surface the whole Zen bonsai scene is painted on.
 *
 * Sky, tree and bed are drawn by three different owners with three different
 * techniques — a smooth canvas gradient, a flat vector command stream, and
 * direct ceramic gradients. Matching their colours is not enough to make them
 * one image: a viewer reads *material* before colour, and three materials read
 * as three pasted layers no matter how well the palettes agree.
 *
 * This pass is what unifies them. It runs last, over the finished composite,
 * and does two things a painted surface does:
 *
 * 1. **Grain.** A single deterministic paper tooth, tiled over everything, so
 *    every element sits in the same fibre.
 * 2. **Tonal compression.** Blacks lift, whites drop, everything converges
 *    slightly on one mid tone. Pigment on paper has nowhere near the range of
 *    an emissive display, and that missing range is most of what reads as
 *    "painted" rather than "rendered".
 *
 * Both are clipped to what was actually drawn: the Home layout deliberately
 * leaves a transparent bridge toward the pond, and papering over it would
 * turn that negative space into a visible rectangle.
 */

const PAPER_TILE_SIZE = 192;
const FIBER_COUNT = 520;
const MOTTLE_COUNT = 26;

const clamp = (value, min, max) => Math.min(
    max,
    Math.max(min, Number.isFinite(Number(value)) ? Number(value) : min),
);
const clamp01 = (value) => clamp(value, 0, 1);

const hashUnit = (value) => {
    const source = String(value);
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
        hash ^= source.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return ((hash >>> 0) % 1000003) / 1000003;
};

const createTileCanvas = (size) => {
    if (typeof OffscreenCanvas === 'function') {
        return new OffscreenCanvas(size, size);
    }
    if (typeof document !== 'undefined' && document.createElement) {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        return canvas;
    }
    return null;
};

let cachedTile = null;

// A mark placed near one edge of the tile has to reappear near the opposite
// edge, or `repeat` butts two unrelated halves of it together and the join
// shows up as a hard line at every multiple of the tile size. Nine stamps —
// the tile itself plus its eight neighbours — cover every wraparound a mark
// within one tile's radius of an edge can need.
const WRAP_OFFSETS = Object.freeze([-1, 0, 1]);

/**
 * Builds the paper tooth once per runtime.
 *
 * The tile is neutral grey on purpose: it is composited with `overlay`, which
 * modulates contrast without shifting hue, so the same tile stays correct in
 * every light the scene passes through and never needs rebuilding.
 */
const resolvePaperTile = (seed = 'zen-paper') => {
    if (cachedTile) return cachedTile;
    const canvas = createTileCanvas(PAPER_TILE_SIZE);
    const ctx = canvas?.getContext?.('2d');
    if (!ctx) return null;

    ctx.fillStyle = 'rgb(128,128,128)';
    ctx.fillRect(0, 0, PAPER_TILE_SIZE, PAPER_TILE_SIZE);

    const stampWrapped = (x, y, draw) => {
        WRAP_OFFSETS.forEach((wx) => WRAP_OFFSETS.forEach((wy) => {
            draw(x + (wx * PAPER_TILE_SIZE), y + (wy * PAPER_TILE_SIZE));
        }));
    };

    // Soft mottling: the uneven density of a hand-laid sheet.
    for (let index = 0; index < MOTTLE_COUNT; index += 1) {
        const x = hashUnit(`${seed}|mx|${index}`) * PAPER_TILE_SIZE;
        const y = hashUnit(`${seed}|my|${index}`) * PAPER_TILE_SIZE;
        const radius = (0.06 + (hashUnit(`${seed}|mr|${index}`) * 0.16)) * PAPER_TILE_SIZE;
        const lighter = hashUnit(`${seed}|mt|${index}`) > 0.5;
        const tone = lighter ? 152 : 104;
        stampWrapped(x, y, (px, py) => {
            const gradient = ctx.createRadialGradient(px, py, 0, px, py, radius);
            gradient.addColorStop(0, `rgba(${tone},${tone},${tone},0.5)`);
            gradient.addColorStop(1, `rgba(${tone},${tone},${tone},0)`);
            ctx.fillStyle = gradient;
            ctx.fillRect(px - radius, py - radius, radius * 2, radius * 2);
        });
    }

    // Fibres, mostly horizontal like a laid sheet, a few crossing.
    ctx.lineCap = 'round';
    for (let index = 0; index < FIBER_COUNT; index += 1) {
        const x = hashUnit(`${seed}|fx|${index}`) * PAPER_TILE_SIZE;
        const y = hashUnit(`${seed}|fy|${index}`) * PAPER_TILE_SIZE;
        const crossing = hashUnit(`${seed}|fc|${index}`) > 0.78;
        const length = (2 + (hashUnit(`${seed}|fl|${index}`) * 11))
            * (crossing ? 0.6 : 1);
        const angle = crossing
            ? (Math.PI * 0.5) + ((hashUnit(`${seed}|fa|${index}`) - 0.5) * 0.7)
            : (hashUnit(`${seed}|fa|${index}`) - 0.5) * 0.5;
        const lighter = hashUnit(`${seed}|ft|${index}`) > 0.46;
        const tone = lighter ? 168 : 92;
        ctx.strokeStyle = `rgba(${tone},${tone},${tone},${0.1 + (hashUnit(`${seed}|fo|${index}`) * 0.16)})`;
        ctx.lineWidth = 0.5 + (hashUnit(`${seed}|fw|${index}`) * 0.7);
        const dx = Math.cos(angle) * length;
        const dy = Math.sin(angle) * length;
        stampWrapped(x, y, (px, py) => {
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(px + dx, py + dy);
            ctx.stroke();
        });
    }

    cachedTile = canvas;
    return cachedTile;
};

/**
 * The paper tooth itself, for renderers that composite it rather than paint it.
 *
 * The Canvas2D pass below fills a pattern under `overlay`; a Pixi stage does
 * the same thing with a tiling sprite in an overlay blend, and both need this
 * one tile so the two backends land on the same surface rather than two
 * different papers.
 */
export const resolveZenBonsaiPaperTile = (seed = 'zen-paper') => resolvePaperTile(seed);

export const ZEN_BONSAI_PAPER_TILE_SIZE = PAPER_TILE_SIZE;
// Alpha the tile is composited at, and the strength of the tonal-compression
// veil that follows it. Shared so a second backend cannot drift from these.
export const ZEN_BONSAI_PAPER_TILE_ALPHA = 0.34;
export const ZEN_BONSAI_PAPER_VEIL_ALPHA = 0.07;

const applyClip = (ctx, clipRegions) => {
    if (!Array.isArray(clipRegions) || clipRegions.length === 0) return false;
    ctx.beginPath();
    let traced = false;
    clipRegions.forEach((region) => {
        if (Array.isArray(region) && region.length >= 3) {
            ctx.moveTo(region[0].x, region[0].y);
            for (let index = 1; index < region.length; index += 1) {
                ctx.lineTo(region[index].x, region[index].y);
            }
            ctx.closePath();
            traced = true;
            return;
        }
        if (region && Number.isFinite(Number(region.width))) {
            ctx.rect(
                Number(region.x) || 0,
                Number(region.y) || 0,
                Number(region.width),
                Number(region.height),
            );
            traced = true;
        }
    });
    if (!traced) return false;
    ctx.clip();
    return true;
};

/**
 * Draws the shared paper surface over the finished composite.
 *
 * @param {object} options.surface       full device-pixel extent of the canvas
 * @param {Array}  options.clipRegions   polygons/rects that were actually painted
 * @param {string} options.midTone       scene-light mid value for the compression
 * @param {number} options.strength      0 disables the pass entirely
 */
export function drawZenBonsaiPaperSurface(ctx, {
    surface = null,
    clipRegions = null,
    midTone = 'rgb(128,128,128)',
    strength = 1,
    seed = 'zen-paper',
} = {}) {
    if (!ctx) {
        throw new Error('ZEN_BONSAI_PAPER_SURFACE_CONTEXT_REQUIRED');
    }
    const amount = clamp01(strength);
    if (amount <= 0.001) return;
    const width = Math.max(1, Number(surface?.width) || Number(ctx.canvas?.width) || 1);
    const height = Math.max(1, Number(surface?.height) || Number(ctx.canvas?.height) || 1);

    ctx.save();
    applyClip(ctx, clipRegions);

    const tile = resolvePaperTile(seed);
    if (tile) {
        const pattern = ctx.createPattern(tile, 'repeat');
        if (pattern) {
            ctx.globalCompositeOperation = 'overlay';
            ctx.globalAlpha = ZEN_BONSAI_PAPER_TILE_ALPHA * amount;
            ctx.fillStyle = pattern;
            ctx.fillRect(0, 0, width, height);
        }
    }

    // Tonal compression. A flat veil of the scene's own mid value pulls both
    // ends of the range toward it at once, which is exactly what pigment does.
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = ZEN_BONSAI_PAPER_VEIL_ALPHA * amount;
    ctx.fillStyle = midTone;
    ctx.fillRect(0, 0, width, height);

    ctx.restore();
}

export default drawZenBonsaiPaperSurface;
