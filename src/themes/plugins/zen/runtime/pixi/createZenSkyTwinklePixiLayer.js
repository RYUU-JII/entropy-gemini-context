import { resolveZenSkyStarTwinkle } from '../../model/bonsai/rendering/zenBonsaiNightSky.js';

// One shared soft-star texture: a solid core of CORE texels inside a halo
// fading over HALO_RADII cores, matching the baked bright-star paint.
const CORE = 5;
const HALO_RADII = 3.4;
const EDGE = Math.ceil(CORE * HALO_RADII) * 2 + 2;

function paintStarTexture(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('ZEN_SKY_TWINKLE_TEXTURE_CONTEXT');
    const center = EDGE / 2;
    const halo = ctx.createRadialGradient(center, center, 0, center, center, CORE * HALO_RADII);
    halo.addColorStop(0, 'rgba(255,255,255,0.32)');
    halo.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, EDGE, EDGE);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(center, center, CORE, 0, Math.PI * 2);
    ctx.fill();
}

const tintOf = rgb => (rgb[0] << 16) | (rgb[1] << 8) | rgb[2];

/**
 * The bright tail of the sky's star field, drawn per frame over a back layer
 * baked without it. Sprites are synced only when the baked sky changes; a
 * frame changes alpha only (one batched draw, no rebake or upload).
 */
export function createZenSkyTwinklePixiLayer({ pixi, parent, insertIndex, createSurface } = {}) {
    const { Container, Sprite, Texture, BaseTexture, SCALE_MODES, MIPMAP_MODES } = pixi || {};
    if (![Container, Sprite, Texture, BaseTexture].every(value => typeof value === 'function')
        || !parent || typeof createSurface !== 'function') {
        throw new Error('ZEN_SKY_TWINKLE_LAYER_INPUT');
    }
    const container = new Container();
    parent.addChildAt(container, insertIndex);
    let texture = null, items = [], disposed = false;

    function requireTexture() {
        if (texture) return texture;
        const surface = createSurface(EDGE, EDGE);
        paintStarTexture(surface);
        texture = new Texture(new BaseTexture(surface, { resolution: 1, scaleMode: SCALE_MODES.LINEAR, mipmap: MIPMAP_MODES.OFF }));
        return texture;
    }

    function sync(stars) {
        if (disposed) throw new Error('ZEN_SKY_TWINKLE_LAYER_DISPOSED');
        if (!Array.isArray(stars)) throw new Error('ZEN_SKY_TWINKLE_STARS_INVALID');
        while (items.length > stars.length) items.pop().sprite.destroy({ texture: false, baseTexture: false });
        for (let index = 0; index < stars.length; index++) {
            const entry = stars[index];
            let item = items[index];
            if (!item) {
                const sprite = new Sprite(requireTexture());
                sprite.anchor.set(0.5, 0.5);
                container.addChild(sprite);
                item = { sprite, entry };
                items.push(item);
            }
            item.entry = entry;
            item.sprite.position.set(entry.x, entry.y);
            item.sprite.scale.set(entry.star.radius / CORE);
            item.sprite.tint = tintOf(entry.star.tint);
            item.sprite.alpha = entry.alpha;
        }
    }

    function update(timeSec) {
        for (const item of items) item.sprite.alpha = item.entry.alpha * resolveZenSkyStarTwinkle(item.entry.star, timeSec);
    }

    function dispose() {
        if (disposed) return;
        disposed = true;
        for (const item of items) item.sprite.destroy({ texture: false, baseTexture: false });
        items = [];
        if (container.parent) container.parent.removeChild(container);
        container.destroy({ children: true });
        if (texture) texture.destroy(true);
        texture = null;
    }

    return { container, sync, update, receipt: () => ({ starCount: items.length }), dispose };
}
