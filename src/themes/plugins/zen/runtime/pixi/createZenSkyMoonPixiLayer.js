import { paintZenSkyMoon, resolveZenSkyMoonExtent } from '../../model/bonsai/rendering/zenBonsaiSkyMoon.js';

// Appearance only: position never repaints. Rounded so the slow drift of the
// limb tilt and twilight light repaints a small texture, not every sample.
const appearanceKey = moon => [
    moon.radius, moon.fraction.toFixed(3), moon.limbRotation.toFixed(3), moon.northRotation.toFixed(2),
    moon.discAlpha.toFixed(3), moon.haloAlpha.toFixed(3), moon.haloRadius.toFixed(1),
    moon.earthshine.toFixed(3), moon.tint.join(','),
].join('|');

/**
 * The moon over a back layer baked without it. One sprite, clipped to the sky
 * polygon; a new environment sample moves it, and only a changed appearance
 * repaints its small texture with the same paint as the Canvas path.
 */
export function createZenSkyMoonPixiLayer({ pixi, parent, insertIndex, createSurface } = {}) {
    const { Container, Sprite, Texture, BaseTexture, Graphics, SCALE_MODES, MIPMAP_MODES } = pixi || {};
    if (![Container, Sprite, Texture, BaseTexture, Graphics].every(value => typeof value === 'function')
        || !parent || typeof createSurface !== 'function') {
        throw new Error('ZEN_SKY_MOON_LAYER_INPUT');
    }
    const container = new Container();
    const clip = new Graphics();
    container.addChild(clip);
    container.mask = clip;
    parent.addChildAt(container, insertIndex);
    let sprite = null, texture = null, key = null, repaints = 0, disposed = false;

    const requireLive = () => { if (disposed) throw new Error('ZEN_SKY_MOON_LAYER_DISPOSED'); };

    function setClip(points) {
        requireLive();
        if (!Array.isArray(points) || points.length < 3
            || !points.every(point => Number.isFinite(point?.x) && Number.isFinite(point?.y))) {
            throw new Error('ZEN_SKY_MOON_CLIP_INVALID');
        }
        clip.clear();
        clip.beginFill(0xffffff);
        clip.drawPolygon(points.flatMap(point => [point.x, point.y]));
        clip.endFill();
    }

    function repaint(moon) {
        const extent = resolveZenSkyMoonExtent(moon), edge = extent * 2;
        const surface = createSurface(edge, edge), ctx = surface.getContext('2d');
        if (!ctx) throw new Error('ZEN_SKY_MOON_TEXTURE_CONTEXT');
        paintZenSkyMoon(ctx, moon, extent, extent);
        const next = new Texture(new BaseTexture(surface, { resolution: 1, scaleMode: SCALE_MODES.LINEAR, mipmap: MIPMAP_MODES.OFF }));
        if (!sprite) {
            sprite = new Sprite(next);
            sprite.anchor.set(0.5, 0.5);
            container.addChild(sprite);
        } else {
            sprite.texture = next;
        }
        if (texture) texture.destroy(true);
        texture = next;
        repaints++;
    }

    function sync(placement) {
        requireLive();
        if (placement === null) {
            if (sprite) sprite.visible = false;
            return;
        }
        if (!placement?.moon || !Number.isFinite(placement.x) || !Number.isFinite(placement.y)) {
            throw new Error('ZEN_SKY_MOON_PLACEMENT_INVALID');
        }
        const nextKey = appearanceKey(placement.moon);
        if (nextKey !== key) { repaint(placement.moon); key = nextKey; }
        sprite.visible = true;
        sprite.position.set(placement.x, placement.y);
    }

    function dispose() {
        if (disposed) return;
        disposed = true;
        if (container.parent) container.parent.removeChild(container);
        container.mask = null;
        container.destroy({ children: true });
        if (texture) texture.destroy(true);
        texture = null; sprite = null;
    }

    return {
        container, setClip, sync, dispose,
        receipt: () => ({ visible: Boolean(sprite?.visible), repaints }),
    };
}
