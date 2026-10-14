import { BaseTexture, Texture } from '@/themes/plugins/zen/pond/renderers/pixi/zenPondPixiRuntime.js';
import {
    buildZenPondVisualProfileSignature,
    requireZenPondVisualProfile,
    ZEN_POND_FLOOR_PROFILES,
    ZEN_POND_PLANT_PROFILES,
    ZEN_POND_ROCK_PROFILES,
    ZEN_POND_SUNLIGHT_PROFILES,
} from '../../../contracts/zenPondVisualProfile.js';
import {
    createLilyPadTexture,
    createRockTexture,
    createWaterLilyBloomTexture,
    createZenIrisClusterTexture,
} from '../pixiSceneTextureFactories.js';
import {
    generateCausticTexture,
    generatePebbleTexture,
} from '../waterEffectsTextureGenerators.js';
import {
    createZenPondPlantNaturalismLilyTextureFactory,
    createZenPondWaterLilyNaturalismTextureFactory,
    ZEN_POND_PLANT_NATURALISM_MODES,
} from './zenPondPlantNaturalism.js';
import {
    createZenPondRockContactTextureFactory,
    createZenPondRockNaturalismTextureFactory,
    ZEN_POND_ROCK_NATURALISM_MODES,
} from './zenPondRockNaturalism.js';
import {
    createBenthicMaterialTextureGenerator,
} from './zenPondBenthicMaterial.js';
import {
    requirePreparedZenPondStaticBenthicSource,
} from './zenPondStaticBenthicAssets.js';

const createLazyTextureFactory = (buildFactory) => {
    let factory = null;
    return (...args) => {
        if (!factory) factory = buildFactory();
        return factory(...args);
    };
};

const createBotanicalPlantTextures = () => Object.freeze({
    lilyPad: createLazyTextureFactory(() => (
        createZenPondPlantNaturalismLilyTextureFactory({
            createProductLilyPadTexture: createLilyPadTexture,
            fallbackTexture: Texture.WHITE,
            mode: ZEN_POND_PLANT_NATURALISM_MODES.COMPOSITE,
        })
    )),
    waterLily: createLazyTextureFactory(() => (
        createZenPondWaterLilyNaturalismTextureFactory({
            createProductWaterLilyBloomTexture: createWaterLilyBloomTexture,
            fallbackTexture: Texture.WHITE,
        })
    )),
    iris: createZenIrisClusterTexture,
});

const createRockTextureStrategy = (profileId) => {
    if (profileId === ZEN_POND_ROCK_PROFILES.PRODUCT) {
        return createRockTexture;
    }
    if (profileId === ZEN_POND_ROCK_PROFILES.NATURAL) {
        return createLazyTextureFactory(() => (
            createZenPondRockNaturalismTextureFactory({
                createProductRockTexture: createRockTexture,
                fallbackTexture: Texture.WHITE,
                mode: ZEN_POND_ROCK_NATURALISM_MODES.COMPOSITE,
            })
        ));
    }
    if (
        profileId === ZEN_POND_ROCK_PROFILES.GROUNDED
        || profileId === ZEN_POND_ROCK_PROFILES.ISHIGUMI
    ) {
        return createZenPondRockContactTextureFactory({
            BaseTextureConstructor: BaseTexture,
            TextureConstructor: Texture,
            mode: ZEN_POND_ROCK_NATURALISM_MODES.COMPOSITE,
        });
    }
    throw new Error(`ZEN_POND_ROCK_RENDER_PLAN_UNSUPPORTED:${String(profileId)}`);
};

const createFloorTextureStrategy = (profileId) => {
    if (profileId === ZEN_POND_FLOOR_PROFILES.PRODUCT) {
        return generatePebbleTexture;
    }
    if (profileId === ZEN_POND_FLOOR_PROFILES.MINERAL_AIRY) {
        return createBenthicMaterialTextureGenerator({
            profile: {
                baseMorphology: 'mineral_grain',
                depthPocketStrength: 0,
                depthSeedRole: 'none',
            },
        });
    }
    if (profileId === ZEN_POND_FLOOR_PROFILES.NEUTRAL_DEPTH) {
        return requirePreparedZenPondStaticBenthicSource;
    }
    throw new Error(`ZEN_POND_FLOOR_RENDER_PLAN_UNSUPPORTED:${String(profileId)}`);
};

export const compileZenPondVisualRenderPlan = (candidate) => {
    const profile = requireZenPondVisualProfile(candidate);
    const botanical = profile.plants === ZEN_POND_PLANT_PROFILES.BOTANICAL;
    const plantTextures = botanical
        ? createBotanicalPlantTextures()
        : Object.freeze({
            lilyPad: createLilyPadTexture,
            waterLily: createWaterLilyBloomTexture,
            iris: createZenIrisClusterTexture,
        });
    const signature = buildZenPondVisualProfileSignature(profile);
    return Object.freeze({
        signature,
        profile,
        entityTextures: Object.freeze({
            ...plantTextures,
            rock: createRockTextureStrategy(profile.rocks),
        }),
        waterTextures: Object.freeze({
            cacheNamespace: signature,
            generatePebbleTexture: createFloorTextureStrategy(profile.floor),
            generateCausticTexture,
        }),
        sunlight: Object.freeze({
            lacyKomorebi: profile.sunlight === ZEN_POND_SUNLIGHT_PROFILES.LACY_CONNECTED,
            // Every product profile projects refracted bundles onto the real
            // receiver. The optional canopy style must not select the older
            // filled-curvature patches for the default pond.
            connectedCaustics: true,
        }),
    });
};
