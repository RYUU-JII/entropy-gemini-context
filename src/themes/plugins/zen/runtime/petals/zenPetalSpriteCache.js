import { drawZenPetal, requireZenPetalAppearance, ZEN_PETAL_SPRITE_SIZE } from './zenPetalMaterial.js';
import { ZEN_PETAL_BLUR_RADII } from './zenPetalDepth.js';
import { ZEN_BOTANICAL_NEUTRAL_MATERIAL_LIGHTING, requireZenWorldBotanicalMaterialLighting } from '../environment/zenWorldBotanicalMaterialLighting.js';

// Padding contains the widest petal plus the full 3-sigma blur footprint.
// 3 pigments x 6 forms x 7 focus bakes x 72² RGBA = at most 2.50 MiB.
export const ZEN_PETAL_BAKE_DIMENSION = 72;

export const createZenPetalSpriteCache = (createCanvas, initialLighting = ZEN_BOTANICAL_NEUTRAL_MATERIAL_LIGHTING) => {
    const sprites = new Map();
    let materialLighting = requireZenWorldBotanicalMaterialLighting(initialLighting);
    let blurredCount = 0;
    const get = (color, shapeType, blurIndex) => {
        requireZenPetalAppearance({ color, shapeType });
        if (!Number.isInteger(blurIndex) || blurIndex < 0 || blurIndex >= ZEN_PETAL_BLUR_RADII.length) {
            throw new Error('ZEN_PETAL_BLUR_INDEX_INVALID');
        }
        const key = `${color}:${shapeType}:${blurIndex}`;
        const existing = sprites.get(key);
        if (existing?.signature === materialLighting.signature) return existing.sprite;
        const sprite = existing ? existing.sprite : createCanvas();
        // Reuse the bounded backing store through time/weather changes. Setting
        // dimensions clears its previous pixels, transforms and filter state.
        sprite.width = ZEN_PETAL_BAKE_DIMENSION;
        sprite.height = ZEN_PETAL_BAKE_DIMENSION;
        const context = sprite.getContext('2d', { alpha: true });
        if (!context) throw new Error('ZEN_APP_PETAL_SPRITE_CONTEXT_UNAVAILABLE');
        if (blurIndex === 0) {
            context.translate(sprite.width / 2, sprite.height / 2);
            drawZenPetal(context, ZEN_PETAL_SPRITE_SIZE, shapeType, color, materialLighting);
        } else {
            // Filter the cached sharp sprite once. The visible frame canvas only
            // receives drawImage calls; no live blur or extra compositing pass.
            const sharp = get(color, shapeType, 0);
            context.filter = `blur(${ZEN_PETAL_BLUR_RADII[blurIndex]}px)`;
            context.drawImage(sharp, 0, 0);
            context.filter = 'none';
            if (!existing) blurredCount += 1;
        }
        sprites.set(key, { sprite, signature: materialLighting.signature });
        return sprite;
    };
    return {
        get,
        setMaterialLighting(lighting) {
            if (lighting !== materialLighting) materialLighting = requireZenWorldBotanicalMaterialLighting(lighting);
        },
        getDiagnostics: () => ({
            textureCount: sprites.size,
            blurredTextureCount: blurredCount,
            textureBytes: sprites.size * ZEN_PETAL_BAKE_DIMENSION ** 2 * 4,
        }),
        dispose() {
            for (const { sprite } of sprites.values()) {
                sprite.width = 0;
                sprite.height = 0;
            }
            sprites.clear();
            blurredCount = 0;
        },
    };
};
