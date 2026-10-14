import {
    BaseTexture,
    Texture,
    SCALE_MODES,
} from '@/themes/plugins/zen/pond/renderers/pixi/zenPondPixiRuntime.js';
import {
    createMistTexture,
} from '../../pixiWaterEffectsTextureBake.js';
import { createZenPondCanopyField } from '../textureBake/canopy.js';
import {
    acquireSharedWaterTextureEntry,
    configureRepeatTexture,
    hasSharedWaterTextureEntry,
} from '../../pixiWaterEffectsTextureCache.js';
import { nowMs } from '../../pixiWaterEffectsMath.js';
import { buildWaterTextureBudgetKey } from './initUtils.js';

const MIST_TEXTURE_SIZE = 512;
const NEUTRAL_TEXTURE_RGBA = new Uint8Array([255, 255, 255, 255]);

const createOpaqueStaticCanvasTexture = (source, {
    preferImageBitmap = false,
} = {}) => {
    if (!source) {
        throw new Error('ZEN_POND_WATER_TEXTURE_SOURCE_REQUIRED');
    }
    if (source.kind === 'rgba8') {
        if (
            !(source.data instanceof Uint8Array)
            || !Number.isInteger(source.width)
            || source.width <= 0
            || !Number.isInteger(source.height)
            || source.height <= 0
            || source.data.byteLength !== source.width * source.height * 4
        ) {
            throw new Error('ZEN_POND_WATER_TEXTURE_RGBA8_SOURCE_INVALID');
        }
        return new Texture(BaseTexture.fromBuffer(
            source.data,
            source.width,
            source.height,
            { scaleMode: SCALE_MODES.LINEAR },
        ));
    }
    const isImageBitmap = (
        typeof ImageBitmap === 'function'
        && source instanceof ImageBitmap
    );
    const canTransferToImageBitmap = (
        preferImageBitmap === true
        && typeof OffscreenCanvas === 'function'
        && source instanceof OffscreenCanvas
        && typeof source.transferToImageBitmap === 'function'
        && typeof ImageBitmap === 'function'
        && typeof globalThis.createImageBitmap === 'function'
    );
    if (!canTransferToImageBitmap) {
        return new Texture(new BaseTexture(source, isImageBitmap
            ? {
                resourceOptions: {
                    ownsImageBitmap: false,
                },
            }
            : undefined));
    }
    const imageBitmap = source.transferToImageBitmap();
    return new Texture(new BaseTexture(imageBitmap, {
        resourceOptions: {
            ownsImageBitmap: true,
        },
    }));
};

const configureUniqueRepeatTextures = (builtTextures, initMetrics) => {
    const textureSetupStartedMs = nowMs();
    const configuredTextures = new Set();
    const configureUniqueRepeatTexture = (texture) => {
        if (!texture || configuredTextures.has(texture)) return;
        configuredTextures.add(texture);
        configureRepeatTexture(texture);
    };
    configureUniqueRepeatTexture(builtTextures.pebbleTexture);
    configureUniqueRepeatTexture(builtTextures.pebbleTextureDetail);
    configureUniqueRepeatTexture(builtTextures.causticTexture);
    configureUniqueRepeatTexture(builtTextures.mistTexture);
    initMetrics.textureSetupMs = Math.max(0, nowMs() - textureSetupStartedMs);
};

const finalizeTextureBuildMetrics = (initMetrics) => {
    const textureBuildValues = Object.values(initMetrics.textureBuildMs);
    initMetrics.textureBuildTotalMs = textureBuildValues.reduce((sum, value) => sum + (Number(value) || 0), 0);
    initMetrics.bottleneck = Object.entries(initMetrics.textureBuildMs)
        .reduce((top, [stage, ms]) => {
            if (!top || ms > top.ms) return { stage, ms };
            return top;
        }, null);
};

const resolveTexturesFromEntry = (textureEntry) => {
    const textures = textureEntry?.textures || {};
    return {
        pebbleTexture: textures.pebbleTexture || null,
        pebbleTextureDetail: textures.pebbleTextureDetail || null,
        causticTexture: textures.causticTexture || null,
        mistTexture: textures.mistTexture || null,
        canopyDirectOcclusionTexture: textures.canopyDirectOcclusionTexture || null,
        canopySkyOcclusionTexture: textures.canopySkyOcclusionTexture || null,
    };
};

export const createWaterEffectsTextureBundle = ({
    generationKey = '',
    textureSizes,
    initMetrics,
    cloudReflectionToggleEnabled = false,
    benthicToggleEnabled = false,
    causticsToggleEnabled = false,
    godRaysToggleEnabled = false,
    atmosphereToggleEnabled = false,
    komorebiToggleEnabled = false,
    canopyModel = 'layered',
    textureGenerators = null,
} = {}) => {
    // The canopy field backs both the shade read and the komorebi read, so it
    // is required as soon as either of them is on.
    const canopyToggleEnabled = godRaysToggleEnabled || komorebiToggleEnabled;
    const pebbleTextureGenerator = textureGenerators?.generatePebbleTexture;
    const causticTextureGenerator = textureGenerators?.generateCausticTexture;
    const cacheNamespace = textureGenerators?.cacheNamespace;
    if (
        typeof pebbleTextureGenerator !== 'function'
        || typeof causticTextureGenerator !== 'function'
        || typeof cacheNamespace !== 'string'
        || !cacheNamespace
    ) {
        throw new Error('ZEN_POND_WATER_TEXTURE_STRATEGY_INVALID');
    }
    const {
        pebbleTextureSize,
        pebbleDetailTextureSize,
        causticTextureSize,
        skyReflectionTextureSize,
    } = textureSizes || {};
    const measureInitTextureStep = (label, buildFn) => {
        const stepStartedMs = nowMs();
        const value = buildFn();
        initMetrics.textureBuildMs[label] = Math.max(0, nowMs() - stepStartedMs);
        return value;
    };

    const textureBudgetKey = buildWaterTextureBudgetKey({
        cloudReflectionToggleEnabled,
        benthicToggleEnabled,
        causticsToggleEnabled,
        godRaysToggleEnabled,
        atmosphereToggleEnabled,
        canopyToggleEnabled,
        canopyModel,
    });
    const sharedCacheKey = `${generationKey}|${textureBudgetKey}|${cacheNamespace}`;
    initMetrics.cache.key = sharedCacheKey;
    initMetrics.cache.hit = hasSharedWaterTextureEntry(sharedCacheKey);

    const textureEntry = acquireSharedWaterTextureEntry(sharedCacheKey, () => {
        const builtTextures = {};
        const neutralTexture = (
            benthicToggleEnabled
            && causticsToggleEnabled
            && atmosphereToggleEnabled
            && canopyToggleEnabled
            && cloudReflectionToggleEnabled
        )
            ? null
            : createOpaqueStaticCanvasTexture({
                kind: 'rgba8',
                width: 1,
                height: 1,
                data: NEUTRAL_TEXTURE_RGBA,
            });
        if (benthicToggleEnabled) {
            builtTextures.pebbleTexture = measureInitTextureStep(
                'pebbleTexture',
                () => {
                    const source = pebbleTextureGenerator(pebbleTextureSize, { style: 'primary' });
                    return createOpaqueStaticCanvasTexture(source, {
                        preferImageBitmap: true,
                    });
                },
            );
            builtTextures.pebbleTextureDetail = measureInitTextureStep(
                'pebbleTextureDetail',
                () => {
                    const source = pebbleTextureGenerator(pebbleDetailTextureSize, { style: 'detail' });
                    return createOpaqueStaticCanvasTexture(source, {
                        preferImageBitmap: true,
                    });
                },
            );
        } else {
            builtTextures.pebbleTexture = neutralTexture;
            builtTextures.pebbleTextureDetail = neutralTexture;
            initMetrics.textureBuildMs.pebbleTexture = 0;
            initMetrics.textureBuildMs.pebbleTextureDetail = 0;
        }
        initMetrics.sharedTextures.pebbleDetailFromPrimary = builtTextures.pebbleTextureDetail === builtTextures.pebbleTexture;

        if (causticsToggleEnabled) {
            builtTextures.causticTexture = measureInitTextureStep(
                'causticTexture',
                () => {
                    const source = causticTextureGenerator(causticTextureSize);
                    return createOpaqueStaticCanvasTexture(source);
                },
            );
        } else {
            builtTextures.causticTexture = neutralTexture;
            initMetrics.textureBuildMs.causticTexture = 0;
        }

        if (atmosphereToggleEnabled) {
            builtTextures.mistTexture = measureInitTextureStep(
                'mistTexture',
                () => createMistTexture(MIST_TEXTURE_SIZE, {
                    detail: 0.92,
                    edgeSoftness: 0.92,
                    threshold: 0.54,
                    contrast: 1.04,
                    alphaCutoff: 0.04,
                    blurPx: 2.4,
                }),
            );
            configureRepeatTexture(builtTextures.mistTexture);
        } else {
            builtTextures.mistTexture = neutralTexture;
            initMetrics.textureBuildMs.mistTexture = 0;
        }

        if (canopyToggleEnabled) {
            // Two visibility measures of one leaf geometry. The mesh restores
            // direct sunlight through gaps without adding an emissive layer.
            const canopyField = measureInitTextureStep(
                'canopyField',
                () => createZenPondCanopyField({
                    sceneGenerationKey: generationKey,
                    model: canopyModel,
                }),
            );
            builtTextures.canopyDirectOcclusionTexture = canopyField.directOcclusionTexture;
            builtTextures.canopySkyOcclusionTexture = canopyField.skyOcclusionTexture;
            builtTextures.canopyFieldMetrics = {
                modelId: canopyField.modelId,
                gapCount: canopyField.gapCount,
                foliageLobeCount: canopyField.foliageLobeCount,
                shadeCoverageRatio: canopyField.shadeCoverageRatio,
                sunlightCoverageRatio: canopyField.sunlightCoverageRatio,
            };
        } else {
            builtTextures.canopyDirectOcclusionTexture = neutralTexture;
            builtTextures.canopySkyOcclusionTexture = neutralTexture;
            initMetrics.textureBuildMs.canopyField = 0;
        }

        configureUniqueRepeatTextures(builtTextures, initMetrics);
        return builtTextures;
    });

    if (canopyToggleEnabled) {
        initMetrics.canopyField = textureEntry.textures.canopyFieldMetrics;
        if (!initMetrics.canopyField) {
            throw new Error('ZEN_POND_CANOPY_CACHE_METRICS_REQUIRED');
        }
    }
    finalizeTextureBuildMetrics(initMetrics);
    return {
        sharedCacheKey,
        textureEntry,
        textures: resolveTexturesFromEntry(textureEntry),
    };
};
