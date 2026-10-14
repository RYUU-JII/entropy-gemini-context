import {
  Sprite,
} from '@/themes/plugins/zen/pond/renderers/pixi/zenPondPixiRuntime.js';
import { clamp as clampValue } from '../../../model/koi/koiMotion.js';
import { removeMissingFromPool, resolveArray } from '../pixiSceneHelpers.js';
import {
    createLilyPadTexture,
    createWaterLilyBloomTexture,
    createZenIrisClusterTexture,
    createRockTexture,
} from '../pixiSceneTextureFactories.js';
import {
    resolveCachedTextureSignature,
    buildLilyPadTextureSignature,
    buildWaterLilyBloomTextureSignature,
    buildZenIrisClusterTextureSignature,
    buildRockTextureSignature,
    prunePondTextureCache,
    acquireTextureRecord,
    releaseTextureRecord,
} from './pixiSceneTextureCache.js';
import { toRgbHex } from '../../../runtime/zenColorMath.js';
import { projectZenPondShadow, projectZenPondSubmergedShadow } from '../../../runtime/zenPondShadowProjection.js';
import { resolveZenPondShadowGeometry } from '../../../contracts/zenPondShadowGeometry.js';
import { sampleZenPondBottomDepth } from '../../../world/fields/zenPondBathymetryField.js';
import { ZenDecorMaterialMesh, ZenDecorShadowMesh, hasZenDecorShadowLight } from '../ZenDecorMaterialMesh.js';
import { selectZenFlowerShadowReceiver } from '../zenDecorShadowReceivers.js';

const resolveLightChannels = ({
    frameChannels = null,
} = {}) => {
    const source = frameChannels?.sceneChromaChannels;
    const r = Number(source?.r);
    const g = Number(source?.g);
    const b = Number(source?.b);
    return {
        r: Number.isFinite(r) ? clampValue(r, 0, 255) : 214,
        g: Number.isFinite(g) ? clampValue(g, 0, 255) : 220,
        b: Number.isFinite(b) ? clampValue(b, 0, 255) : 222,
    };
};

const resolveTintFromLightChannels = ({
    lightChannels,
    redGain = 1,
    greenGain = 1,
    blueGain = 1,
    redFloor = 0,
    greenFloor = 0,
    blueFloor = 0,
} = {}) => toRgbHex(
    clampValue((Number(lightChannels?.r) || 0) * redGain, redFloor, 255),
    clampValue((Number(lightChannels?.g) || 0) * greenGain, greenFloor, 255),
    clampValue((Number(lightChannels?.b) || 0) * blueGain, blueFloor, 255),
);

const resolveNightMaterialChannels = (frameChannels) => {
    for (const key of ['nightDepth', 'moonlight']) {
        const value = frameChannels[key];
        if (!Number.isFinite(value) || value < 0 || value > 1) {
            throw new Error(`ZEN_DECOR_NIGHT_CHANNEL_INVALID:${key}`);
        }
    }
    return { nightDepth: frameChannels.nightDepth, silver: Math.sqrt(frameChannels.moonlight) };
};

const blendTint = (tint, rgb, mix) => toRgbHex(
    ((tint >> 16) & 255) * (1 - mix) + rgb[0] * mix,
    ((tint >> 8) & 255) * (1 - mix) + rgb[1] * mix,
    (tint & 255) * (1 - mix) + rgb[2] * mix,
);

const resolvePondPlantRenderState = ({
    frameChannels = null,
} = {}) => {
    if (!frameChannels || typeof frameChannels !== 'object') {
        return {
            tint: 0xffffff,
            lilyTint: 0xffffff,
            waterLilyTint: 0xffffff,
            irisTint: 0xffffff,
            lilyAlpha: 1,
            waterLilyAlpha: 1,
            irisAlpha: 1,
            lilyNightChromaMix: 0,
            lilyNightFormShade: 0,
        };
    }
    const sceneBrightnessRaw = Number(frameChannels.sceneBrightness);
    const sceneBrightness = clampValue(Number.isFinite(sceneBrightnessRaw) ? sceneBrightnessRaw : 0.5, 0, 1);
    const daylightRaw = Number(frameChannels.daylight ?? frameChannels.diurnalPhase);
    const daylight = Number.isFinite(daylightRaw) ? clampValue(daylightRaw, 0, 1) : sceneBrightness;
    const { nightDepth, silver } = resolveNightMaterialChannels(frameChannels);
    const directLightRaw = Number(frameChannels.directLight);
    const directLight = clampValue(
        Number.isFinite(directLightRaw) ? directLightRaw : (sceneBrightness * 1.6),
        0,
        1.6,
    );
    const directLightNorm = clampValue(directLight / 1.35, 0, 1);
    const lightChannels = resolveLightChannels({ frameChannels });
    const solarLift = clampValue(Math.pow(Math.max(0, sceneBrightness), 0.82), 0, 1);
    const nightBlueShift = 0.16 * nightDepth;
    const lilyLightMix = clampValue(
        0.12
        + solarLift * 0.74
        + directLightNorm * 0.16
        + daylight * 0.04,
        0.12,
        1,
    );
    const waterLilyLightMix = clampValue(
        0.16
        + solarLift * 0.66
        + directLightNorm * 0.14
        + daylight * 0.04,
        0.16,
        1,
    );
    const irisLightMix = clampValue(
        0.14
        + solarLift * 0.7
        + directLightNorm * 0.18
        + daylight * 0.06,
        0.14,
        1,
    );
    const solarLilyTint = resolveTintFromLightChannels({
        lightChannels,
        redGain: 0.24 + lilyLightMix * 0.74 - nightBlueShift * 0.03,
        greenGain: 0.28 + lilyLightMix * 0.74 - nightBlueShift * 0.02,
        blueGain: 0.24 + lilyLightMix * 0.68 + nightBlueShift * 0.05,
        redFloor: 18,
        greenFloor: 24,
        blueFloor: 28,
    });
    const waterLilyTint = resolveTintFromLightChannels({
        lightChannels,
        redGain: 0.54 + waterLilyLightMix * 0.46 - nightBlueShift * 0.02,
        greenGain: 0.56 + waterLilyLightMix * 0.44 - nightBlueShift * 0.01,
        blueGain: 0.6 + waterLilyLightMix * 0.42 + nightBlueShift * 0.04,
        redFloor: 40,
        greenFloor: 44,
        blueFloor: 52,
    });
    const irisTint = resolveTintFromLightChannels({
        lightChannels,
        redGain: 0.26 + irisLightMix * 0.62 - nightBlueShift * 0.03,
        greenGain: 0.34 + irisLightMix * 0.76 - nightBlueShift * 0.01,
        blueGain: 0.28 + irisLightMix * 0.68 + nightBlueShift * 0.05,
        redFloor: 20,
        greenFloor: 30,
        blueFloor: 30,
    });
    // Pads are above the water optics: they own this bounded silver-green tint.
    // Authored veins/notches remain visible; the mesh only shades convex edges.
    const lilyTint = blendTint(solarLilyTint, [
        255 * (0.48 + silver * 0.20),
        255 * (0.62 + silver * 0.20),
        255 * (0.72 + silver * 0.22),
    ], nightDepth);
    return {
        tint: lilyTint,
        lilyTint,
        waterLilyTint,
        irisTint,
        lilyAlpha: 1,
        waterLilyAlpha: 1,
        irisAlpha: 1,
        lilyNightChromaMix: nightDepth * 0.55,
        lilyNightFormShade: nightDepth * (0.14 + silver * 0.22),
    };
};

export const resolveCastShadowFrameState = ({ frameChannels }) => {
    if (!frameChannels?.shadowLight) throw new Error('ZEN_DECOR_WORLD_SHADOW_LIGHT_REQUIRED');
    return frameChannels.shadowLight;
};

const clearShadowPool = (pool) => {
    if (!pool || typeof pool.clear !== 'function') return;
    for (const shadowSprite of pool.values()) {
        shadowSprite?.parent?.removeChild(shadowSprite);
        shadowSprite?.destroy?.();
    }
    pool.clear();
};

const ensureCastShadowSprite = ({ shadowPool, entity, container, webGLVersion }) => {
    let shadow = shadowPool.get(entity);
    if (!shadow) {
        shadow = new ZenDecorShadowMesh(webGLVersion);
        shadowPool.set(entity, shadow);
        container.addChild(shadow);
    }
    return shadow;
};

const syncDecorCast = ({ pool, container, entity, record, light, kind, x, y, rotation, scale = 1, bottomDepth, webGLVersion }) => {
    if (!pool || !container) throw new Error('ZEN_DECOR_CAST_OWNER_REQUIRED');
    const size = Number(entity.size);
    const geometry = resolveZenPondShadowGeometry({ kind, size, bottomDepth });
    const project = kind === 'rock' ? projectZenPondSubmergedShadow : projectZenPondShadow;
    const projection = project({ light, heightAboveReceiver: geometry.heightAboveReceiver, maxReach: size * 1.2 });
    const shadow = ensureCastShadowSprite({ shadowPool: pool, entity, container, webGLVersion });
    shadow.configure({
        record, x, y, rotation, scale, projection, light, grounded: geometry.grounded,
        strength: kind === 'rock' ? 0.62 : kind === 'flower' ? 0.34 : 0.2,
    });
    return { shadow, projection, geometry };
};

export const resolvePondRockTint = ({ frameChannels, surfaceMaterialLightingActive = false }) => {
    if (!frameChannels || typeof frameChannels !== 'object') {
        throw new Error('ZEN_DECOR_FRAME_CHANNELS_REQUIRED');
    }
    const sceneBrightnessRaw = Number(frameChannels.sceneBrightness);
    const sceneBrightness = Number.isFinite(sceneBrightnessRaw) ? sceneBrightnessRaw : 0.5;
    const { nightDepth } = resolveNightMaterialChannels(frameChannels);
    const moonlight = frameChannels.moonlight;
    const nightBlend = nightDepth;
    const moonlitLift = (
        Math.pow(moonlight, 0.9)
        * Math.pow(nightBlend, 1.06)
    );
    const bottomLightGain = clampValue(
        0.26
        + Math.pow(Math.max(0, sceneBrightness), 0.85) * 0.72
        + moonlitLift * 0.18,
        0.24,
        1.08,
    );
    const bottomVisibility = clampValue(Number(frameChannels.bottomVisibility), 0, 1);
    const lightChannels = resolveLightChannels({ frameChannels });
    const rockMaterialReflectance = 0.22 + moonlitLift * 0.08;
    const submergedTintGain = (
        rockMaterialReflectance
        + (0.16 + bottomVisibility * 0.38) * bottomLightGain
    );
    const coolLift = (
        0.06
        + ((1 - bottomVisibility) * 0.16)
        + (nightBlend * 0.12)
        + (moonlitLift * 0.08)
    );
    const rockTintR = clampValue(lightChannels.r * (submergedTintGain * 0.64), 20, 255);
    const rockTintG = clampValue(lightChannels.g * (submergedTintGain * 0.72), 26, 255);
    const rockTintB = clampValue(lightChannels.b * (submergedTintGain * (0.76 + coolLift)), 34, 255);
    const rockTint = toRgbHex(rockTintR, rockTintG, rockTintB);
    // Submerged pigment receives night illumination once, in the attached
    // surface pass. Keep the calibrated daytime and detached-renderer tint.
    return surfaceMaterialLightingActive === true
        ? blendTint(rockTint, [255, 255, 255], nightDepth)
        : rockTint;
};

const syncRocks = ({
    webGLVersion,
    rocksRef,
    bathymetryFieldRef,
    rockPool,
    rocksContainer,
    rockCastShadowPool = null,
    rockCastShadowContainer = null,
    ownedTextures,
    frameChannels = null,
    surfaceMaterialLightingActive = false,
    shouldPruneCache = true,
    aliveSet = null,
    rockTextureCache = null,
    rockTextureCacheStats = null,
    rockTextureCachePolicy = null,
    textureFactory = createRockTexture,
}) => {
    const rockTint = resolvePondRockTint({ frameChannels, surfaceMaterialLightingActive });
    const { nightDepth, silver } = resolveNightMaterialChannels(frameChannels);
    const nightFormShade = surfaceMaterialLightingActive === true
        ? nightDepth * (0.18 + silver * 0.22) : 0;
    if (shouldPruneCache) {
        prunePondTextureCache(rockTextureCache, rockTextureCachePolicy, rockTextureCacheStats, ownedTextures);
    }
    const rockAlpha = 1;
    const castShadowState = resolveCastShadowFrameState({ frameChannels });
    const canRenderCastShadow = (
        rockCastShadowPool
        && rockCastShadowContainer
        && hasZenDecorShadowLight(castShadowState, true)
    );

    const rocks = resolveArray(rocksRef);
    const aliveRocks = aliveSet || new Set();
    aliveRocks.clear();
    for (let i = 0; i < rocks.length; i += 1) {
        const rock = rocks[i];
        if (!rock) continue;
        aliveRocks.add(rock);
        const rockTextureSignature = resolveCachedTextureSignature(
            rock,
            'rock_texture',
            buildRockTextureSignature,
        );

        let sprite = rockPool.get(rock);
        if (!sprite) {
            const rockTextureRecord = acquireTextureRecord(
                rockTextureCache,
                rockTextureSignature,
                () => textureFactory(ownedTextures, rock),
                ownedTextures,
                rockTextureCachePolicy,
                rockTextureCacheStats,
            );
            sprite = new ZenDecorMaterialMesh(rockTextureRecord, webGLVersion);
            rockPool.set(rock, sprite);
            sprite.textureRecord = rockTextureRecord;
            rocksContainer.addChild(sprite);
        } else if (sprite.textureRecord && sprite.textureRecord.key !== rockTextureSignature) {
            releaseTextureRecord(
                rockTextureCache,
                sprite.textureRecord,
                ownedTextures,
                rockTextureCachePolicy,
                rockTextureCacheStats,
            );
            const rockTextureRecord = acquireTextureRecord(
                rockTextureCache,
                rockTextureSignature,
                () => textureFactory(ownedTextures, rock),
                ownedTextures,
                rockTextureCachePolicy,
                rockTextureCacheStats,
            );
            sprite.setMaterialRecord(rockTextureRecord);
            sprite.textureRecord = rockTextureRecord;
        }
        sprite.position.set(Number(rock.x) || 0, Number(rock.y) || 0);
        sprite.rotation = Number(rock.rotation) || 0;
        sprite.tint = rockTint;
        sprite.alpha = rockAlpha;

        sprite.setWorldLight(castShadowState);
        sprite.setNightMaterial(0, nightFormShade);
        if (canRenderCastShadow) {
            syncDecorCast({
                webGLVersion,
                pool: rockCastShadowPool, container: rockCastShadowContainer, entity: rock,
                record: sprite.textureRecord, light: castShadowState, kind: 'rock',
                x: rock.x, y: rock.y, rotation: sprite.rotation,
                bottomDepth: sampleZenPondBottomDepth(bathymetryFieldRef.current, rock.x, rock.y),
            });
        }

    }

    removeMissingFromPool(rockPool, aliveRocks, (sprite) => {
        releaseTextureRecord(
            rockTextureCache,
            sprite.textureRecord,
            ownedTextures,
            rockTextureCachePolicy,
            rockTextureCacheStats,
        );
        sprite.parent?.removeChild(sprite);
        sprite.destroy();
    });
    if (rockCastShadowPool && canRenderCastShadow) {
        removeMissingFromPool(rockCastShadowPool, aliveRocks, (shadowSprite) => {
            shadowSprite?.parent?.removeChild(shadowSprite);
            shadowSprite?.destroy?.();
        });
    } else {
        clearShadowPool(rockCastShadowPool);
    }
};

const syncLilyPads = ({
    webGLVersion,
    lilyPadsRef,
    lilyPadPool,
    lilyPadsContainer,
    lilyPadCastShadowPool = null,
    castShadowContainer = null,
    ownedTextures,
    frameChannels = null,
    plantRenderState = null,
    shouldPruneCache = true,
    aliveSet = null,
    lilyPadTextureCache = null,
    lilyPadTextureCacheStats = null,
    lilyPadTextureCachePolicy = null,
    textureFactory = createLilyPadTexture,
}) => {
    if (shouldPruneCache) {
        prunePondTextureCache(lilyPadTextureCache, lilyPadTextureCachePolicy, lilyPadTextureCacheStats, ownedTextures);
    }

    const lilyPads = resolveArray(lilyPadsRef);
    const resolvedPlantRenderState = plantRenderState || resolvePondPlantRenderState({
        frameChannels,
    });
    const castShadowState = resolveCastShadowFrameState({ frameChannels });
    const canRenderCastShadow = (
        lilyPadCastShadowPool
        && castShadowContainer
        && castShadowState.directStrength > 0.001
    );
    const aliveLilyPads = aliveSet || new Set();
    aliveLilyPads.clear();
    for (let i = 0; i < lilyPads.length; i += 1) {
        const lilyPad = lilyPads[i];
        if (!lilyPad) continue;
        aliveLilyPads.add(lilyPad);

        let entry = lilyPadPool.get(lilyPad);
        const padTextureSignature = resolveCachedTextureSignature(
            lilyPad,
            'lily_pad_texture',
            buildLilyPadTextureSignature,
        );
        if (!entry) {
            const lilyTextureRecord = acquireTextureRecord(
                lilyPadTextureCache,
                padTextureSignature,
                () => textureFactory(ownedTextures, lilyPad),
                ownedTextures,
                lilyPadTextureCachePolicy,
                lilyPadTextureCacheStats,
            );
            const sprite = new ZenDecorMaterialMesh(lilyTextureRecord, webGLVersion);
            entry = {
                sprite,
                texture: lilyTextureRecord.texture,
                textureRecord: lilyTextureRecord,
            };
            lilyPadPool.set(lilyPad, entry);
            lilyPadsContainer.addChild(sprite);
        } else if (entry.textureRecord && entry.textureRecord.key !== padTextureSignature) {
            releaseTextureRecord(
                lilyPadTextureCache,
                entry.textureRecord,
                ownedTextures,
                lilyPadTextureCachePolicy,
                lilyPadTextureCacheStats,
            );
            const lilyTextureRecord = acquireTextureRecord(
                lilyPadTextureCache,
                padTextureSignature,
                () => textureFactory(ownedTextures, lilyPad),
                ownedTextures,
                lilyPadTextureCachePolicy,
                lilyPadTextureCacheStats,
            );
            entry.sprite.setMaterialRecord(lilyTextureRecord);
            entry.texture = lilyTextureRecord.texture;
            entry.textureRecord = lilyTextureRecord;
        }

        const sprite = entry.sprite;
        const x = Number(lilyPad.x) || 0;
        const y = Number(lilyPad.y) || 0;
        sprite.position.set(x, y);
        sprite.rotation = Number.isFinite(Number(lilyPad.currentRotation))
            ? Number(lilyPad.currentRotation)
            : (Number(lilyPad.rotation) || 0);
        const flowerBreath = lilyPad.hasFlower
            ? (Number(lilyPad.flowerScale) || 1) * (Number(lilyPad.flowerStateScale) || 1)
            : 1;
        const drift = 1 + (Math.sin(((Number(lilyPad.timeSec) || 0) * 0.7) + (Number(lilyPad.phase) || 0)) * 0.003);
        const spriteScale = clampValue(drift * (1 + ((flowerBreath - 1) * 0.45)), 0.97, 1.06);
        sprite.scale.set(spriteScale);
        sprite.tint = Number.isFinite(Number(resolvedPlantRenderState.lilyTint))
            ? Number(resolvedPlantRenderState.lilyTint)
            : (Number.isFinite(Number(resolvedPlantRenderState.tint))
                ? Number(resolvedPlantRenderState.tint)
                : 0xffffff);
        sprite.alpha = resolvedPlantRenderState.lilyAlpha;
        const layerBoost = lilyPad.hasFlower ? 100000 : 0;
        const nextZIndex = layerBoost + y;
        if (sprite.zIndex !== nextZIndex) {
            sprite.zIndex = nextZIndex;
        }

        sprite.setWorldLight(castShadowState);
        sprite.setNightMaterial(resolvedPlantRenderState.lilyNightChromaMix, resolvedPlantRenderState.lilyNightFormShade);
        sprite.clearReceiverShadow();
        if (canRenderCastShadow) {
            syncDecorCast({
                webGLVersion,
                pool: lilyPadCastShadowPool, container: castShadowContainer, entity: lilyPad,
                record: entry.textureRecord, light: castShadowState, kind: 'lily',
                x, y, rotation: sprite.rotation, scale: spriteScale,
            });
        }

    }

    removeMissingFromPool(lilyPadPool, aliveLilyPads, (entry) => {
        const sprite = entry?.sprite;
        if (sprite) {
            sprite.parent?.removeChild(sprite);
            sprite.destroy();
        }
        releaseTextureRecord(
            lilyPadTextureCache,
            entry?.textureRecord,
            ownedTextures,
            lilyPadTextureCachePolicy,
            lilyPadTextureCacheStats,
        );
    });
    if (lilyPadCastShadowPool && canRenderCastShadow) {
        removeMissingFromPool(lilyPadCastShadowPool, aliveLilyPads, (shadowSprite) => {
            shadowSprite?.parent?.removeChild(shadowSprite);
            shadowSprite?.destroy?.();
        });
    } else {
        clearShadowPool(lilyPadCastShadowPool);
    }
};

const syncWaterLilyBlooms = ({
    webGLVersion,
    waterLilyRef,
    lilyPadPool,
    waterLilyPool,
    waterLilyContainer,
    waterLilyCastShadowPool = null,
    castShadowContainer = null,
    ownedTextures,
    frameChannels = null,
    plantRenderState = null,
    shouldPruneCache = true,
    aliveSet = null,
    waterLilyTextureCache = null,
    waterLilyTextureCacheStats = null,
    waterLilyTextureCachePolicy = null,
    textureFactory = createWaterLilyBloomTexture,
}) => {
    if (shouldPruneCache) {
        prunePondTextureCache(waterLilyTextureCache, waterLilyTextureCachePolicy, waterLilyTextureCacheStats, ownedTextures);
    }

    const waterLilyBlooms = resolveArray(waterLilyRef);
    const resolvedPlantRenderState = plantRenderState || resolvePondPlantRenderState({
        frameChannels,
    });
    const castShadowState = resolveCastShadowFrameState({ frameChannels });
    const canRenderCastShadow = (
        waterLilyCastShadowPool
        && castShadowContainer
        && castShadowState.directStrength > 0.001
    );
    const aliveWaterLily = aliveSet || new Set();
    aliveWaterLily.clear();
    for (let i = 0; i < waterLilyBlooms.length; i += 1) {
        const waterLilyBloom = waterLilyBlooms[i];
        if (!waterLilyBloom) continue;
        aliveWaterLily.add(waterLilyBloom);

        let entry = waterLilyPool.get(waterLilyBloom);
        const waterLilyTextureSignature = resolveCachedTextureSignature(
            waterLilyBloom,
            'waterLily_texture',
            buildWaterLilyBloomTextureSignature,
        );
        if (!entry) {
            const waterLilyTextureRecord = acquireTextureRecord(
                waterLilyTextureCache,
                waterLilyTextureSignature,
                () => textureFactory(ownedTextures, waterLilyBloom),
                ownedTextures,
                waterLilyTextureCachePolicy,
                waterLilyTextureCacheStats,
            );
            const sprite = new ZenDecorMaterialMesh(waterLilyTextureRecord, webGLVersion);
            entry = {
                sprite,
                texture: waterLilyTextureRecord.texture,
                baseSize: waterLilyTextureRecord.baseSize,
                textureRecord: waterLilyTextureRecord,
            };
            waterLilyPool.set(waterLilyBloom, entry);
            waterLilyContainer.addChild(sprite);
        } else if (entry.textureRecord && entry.textureRecord.key !== waterLilyTextureSignature) {
            releaseTextureRecord(
                waterLilyTextureCache,
                entry.textureRecord,
                ownedTextures,
                waterLilyTextureCachePolicy,
                waterLilyTextureCacheStats,
            );
            const waterLilyTextureRecord = acquireTextureRecord(
                waterLilyTextureCache,
                waterLilyTextureSignature,
                () => textureFactory(ownedTextures, waterLilyBloom),
                ownedTextures,
                waterLilyTextureCachePolicy,
                waterLilyTextureCacheStats,
            );
            entry.sprite.setMaterialRecord(waterLilyTextureRecord);
            entry.texture = waterLilyTextureRecord.texture;
            entry.baseSize = waterLilyTextureRecord.baseSize;
            entry.textureRecord = waterLilyTextureRecord;
        }

        const sprite = entry.sprite;
        const root = typeof waterLilyBloom.resolveRootWorld === 'function'
            ? waterLilyBloom.resolveRootWorld()
            : {
                x: Number(waterLilyBloom.x) || 0,
                y: Number(waterLilyBloom.y) || 0,
            };
        const flower = typeof waterLilyBloom.resolveFlowerWorld === 'function'
            ? waterLilyBloom.resolveFlowerWorld()
            : root;
        const flowerBreath = (Number(waterLilyBloom.flowerScale) || 1) * (Number(waterLilyBloom.flowerStateScale) || 1);
        const drift = 1 + (Math.sin(((Number(waterLilyBloom.timeSec) || 0) * 0.62) + (Number(waterLilyBloom.flowerPhase) || 0)) * 0.004);
        const spriteScale = clampValue(drift * (1 + ((flowerBreath - 1) * 0.45)), 0.96, 1.12);

        sprite.position.set(Number(root.x) || 0, Number(root.y) || 0);
        sprite.rotation = Number(waterLilyBloom.currentRotation) || 0;
        sprite.scale.set(spriteScale);
        sprite.tint = Number.isFinite(Number(resolvedPlantRenderState.waterLilyTint))
            ? Number(resolvedPlantRenderState.waterLilyTint)
            : (Number.isFinite(Number(resolvedPlantRenderState.tint))
                ? Number(resolvedPlantRenderState.tint)
                : 0xffffff);
        sprite.alpha = resolvedPlantRenderState.waterLilyAlpha;
        const nextZIndex = 210000 + (Number(flower.y) || Number(root.y) || 0);
        if (sprite.zIndex !== nextZIndex) {
            sprite.zIndex = nextZIndex;
        }

        sprite.setWorldLight(castShadowState);
        if (canRenderCastShadow) {
            const { silhouetteOffsetX: centerX, silhouetteOffsetY: centerY } = entry.textureRecord.materialGeometry;
            const c = Math.cos(sprite.rotation);
            const sn = Math.sin(sprite.rotation);
            const flowerX = sprite.x + (centerX * c - centerY * sn) * spriteScale;
            const flowerY = sprite.y + (centerX * sn + centerY * c) * spriteScale;
            const cast = syncDecorCast({
                webGLVersion,
                pool: waterLilyCastShadowPool, container: castShadowContainer, entity: waterLilyBloom,
                record: entry.textureRecord, light: castShadowState, kind: 'flower',
                x: flowerX, y: flowerY, rotation: sprite.rotation, scale: spriteScale,
            });
            const receiver = selectZenFlowerShadowReceiver({
                lilyPadPool, flowerGeometry: cast.geometry, light: castShadowState,
                x: flowerX, y: flowerY, size: waterLilyBloom.size,
            });
            if (receiver && receiver.distance < receiver.sprite.receiverShadowDistance) {
                if (receiver.sprite.receiverShadowSource) receiver.sprite.receiverShadowSource.visible = true;
                receiver.sprite.receiverShadowDistance = receiver.distance;
                receiver.sprite.receiverShadowSource = cast.shadow;
                receiver.sprite.setReceiverShadow({ record: entry.textureRecord, x: receiver.x, y: receiver.y, rotation: sprite.rotation, scale: spriteScale, light: castShadowState });
                cast.shadow.visible = false;
            }
        }

    }

    removeMissingFromPool(waterLilyPool, aliveWaterLily, (entry) => {
        const sprite = entry?.sprite;
        if (sprite) {
            sprite.parent?.removeChild(sprite);
            sprite.destroy();
        }
        releaseTextureRecord(
            waterLilyTextureCache,
            entry?.textureRecord,
            ownedTextures,
            waterLilyTextureCachePolicy,
            waterLilyTextureCacheStats,
        );
    });
    if (waterLilyCastShadowPool && canRenderCastShadow) {
        removeMissingFromPool(waterLilyCastShadowPool, aliveWaterLily, (shadowSprite) => {
            shadowSprite?.parent?.removeChild(shadowSprite);
            shadowSprite?.destroy?.();
        });
    } else {
        clearShadowPool(waterLilyCastShadowPool);
    }
};

const syncZenIrisClusters = ({
    zenIrisClustersRef,
    zenIrisClusterPool,
    zenIrisClustersContainer,
    zenIrisCastShadowPool = null,
    ownedTextures,
    frameChannels = null,
    plantRenderState = null,
    shouldPruneCache = true,
    aliveSet = null,
    zenIrisClusterTextureCache = null,
    zenIrisClusterTextureCacheStats = null,
    zenIrisClusterTextureCachePolicy = null,
    textureFactory = createZenIrisClusterTexture,
}) => {
    const irisClusters = resolveArray(zenIrisClustersRef);
    if (
        irisClusters.length === 0
        && (!zenIrisClusterPool || zenIrisClusterPool.size === 0)
        && (!zenIrisCastShadowPool || zenIrisCastShadowPool.size === 0)
    ) {
        aliveSet?.clear?.();
        return;
    }

    if (shouldPruneCache) {
        prunePondTextureCache(
            zenIrisClusterTextureCache,
            zenIrisClusterTextureCachePolicy,
            zenIrisClusterTextureCacheStats,
            ownedTextures,
        );
    }

    const resolvedPlantRenderState = plantRenderState || resolvePondPlantRenderState({
        frameChannels,
    });
    const aliveIrisClusters = aliveSet || new Set();
    aliveIrisClusters.clear();
    for (let i = 0; i < irisClusters.length; i += 1) {
        const irisCluster = irisClusters[i];
        if (!irisCluster) continue;
        aliveIrisClusters.add(irisCluster);

        let entry = zenIrisClusterPool.get(irisCluster);
        const irisTextureSignature = resolveCachedTextureSignature(
            irisCluster,
            'zen_iris_cluster_texture',
            buildZenIrisClusterTextureSignature,
        );
        if (!entry) {
            const irisTextureRecord = acquireTextureRecord(
                zenIrisClusterTextureCache,
                irisTextureSignature,
                () => textureFactory(ownedTextures, irisCluster),
                ownedTextures,
                zenIrisClusterTextureCachePolicy,
                zenIrisClusterTextureCacheStats,
            );
            const sprite = new Sprite(irisTextureRecord.texture);
            sprite.anchor.set(0.5, Number(irisTextureRecord.anchorY) || 0.78);
            entry = {
                sprite,
                texture: irisTextureRecord.texture,
                baseSize: irisTextureRecord.baseSize,
                anchorY: irisTextureRecord.anchorY,
                textureRecord: irisTextureRecord,
            };
            zenIrisClusterPool.set(irisCluster, entry);
            zenIrisClustersContainer.addChild(sprite);
        } else if (entry.textureRecord && entry.textureRecord.key !== irisTextureSignature) {
            releaseTextureRecord(
                zenIrisClusterTextureCache,
                entry.textureRecord,
                ownedTextures,
                zenIrisClusterTextureCachePolicy,
                zenIrisClusterTextureCacheStats,
            );
            const irisTextureRecord = acquireTextureRecord(
                zenIrisClusterTextureCache,
                irisTextureSignature,
                () => textureFactory(ownedTextures, irisCluster),
                ownedTextures,
                zenIrisClusterTextureCachePolicy,
                zenIrisClusterTextureCacheStats,
            );
            entry.sprite.texture = irisTextureRecord.texture;
            entry.sprite.anchor.set(0.5, Number(irisTextureRecord.anchorY) || 0.78);
            entry.texture = irisTextureRecord.texture;
            entry.baseSize = irisTextureRecord.baseSize;
            entry.anchorY = irisTextureRecord.anchorY;
            entry.textureRecord = irisTextureRecord;
        }

        const sprite = entry.sprite;
        const x = Number(irisCluster.x) || 0;
        const y = Number(irisCluster.y) || 0;
        const scaleX = clampValue(Number(irisCluster.currentScaleX) || 1, 0.94, 1.06);
        const scaleY = clampValue(Number(irisCluster.currentScaleY) || 1, 0.96, 1.05);
        sprite.position.set(x, y);
        sprite.rotation = 0;
        sprite.scale.set(scaleX, scaleY);
        sprite.tint = Number.isFinite(Number(resolvedPlantRenderState.irisTint))
            ? Number(resolvedPlantRenderState.irisTint)
            : (Number.isFinite(Number(resolvedPlantRenderState.lilyTint))
                ? Number(resolvedPlantRenderState.lilyTint)
                : 0xffffff);
        sprite.alpha = resolvedPlantRenderState.irisAlpha;
        const nextZIndex = 220000 + y;
        if (sprite.zIndex !== nextZIndex) {
            sprite.zIndex = nextZIndex;
        }


    }

    removeMissingFromPool(zenIrisClusterPool, aliveIrisClusters, (entry) => {
        const sprite = entry?.sprite;
        if (sprite) {
            sprite.parent?.removeChild(sprite);
            sprite.destroy();
        }
        releaseTextureRecord(
            zenIrisClusterTextureCache,
            entry?.textureRecord,
            ownedTextures,
            zenIrisClusterTextureCachePolicy,
            zenIrisClusterTextureCacheStats,
        );
    });
    clearShadowPool(zenIrisCastShadowPool);
};

export {
    resolvePondPlantRenderState,
    syncRocks,
    syncLilyPads,
    syncWaterLilyBlooms,
    syncZenIrisClusters,
};
