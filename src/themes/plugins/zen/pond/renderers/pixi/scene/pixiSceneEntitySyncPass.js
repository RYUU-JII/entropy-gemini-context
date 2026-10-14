import {
    resolvePondPlantRenderState,
    syncFish,
    syncGlimmers,
    syncLilyPads,
    syncParticles,
    syncPetals,
    syncRingRippleProjection,
    syncRocks,
    syncZenIrisClusters,
    syncWaterLilyBlooms,
} from '../pixiSceneEntitySync.js';
import {
    resolvePixiSceneAmbientPassPlan,
    resolvePixiSceneStaticPassPlan,
} from '../pixiSceneCadencePolicy.js';
import { resolvePixiSceneEntityRenderPlan } from '../pixiSceneWorldPolicy.js';

const EMPTY_ENTITY_REF = Object.freeze({
    current: Object.freeze([]),
});

export const syncSceneEntitiesPass = ({
    frameChannels = null,
    webGLVersion,
    koiCausticReceiver = null,
    surfaceMaterialLightingActive = false,
    frameCount,
    renderTimeMs = null,
    previousRenderTimeMs,
    visibleWorldBounds = null,
    worldPolicy = null,
    sceneCadenceProfile = null,
    shouldPrunePondTextureCache,
    ownedTextures,
    fishRef,
    bathymetryFieldRef,
    particlesRef,
    lilyPadsRef,
    waterLilyRef,
    zenIrisClustersRef,
    surfaceDisturbancesRef,
    petalsRef,
    glimmersRef,
    rocksRef,
    hoveredDomainRef,
    lockedTargetRef,
    selectedFishUidRef,
    rendererDebugToggles,
    rendererDebugTogglesRef,
    fishShadowProfile,
    koiTextureCache,
    pixiFishPool,
    fishContainer,
    particlePool,
    particlesContainer,
    getParticleTextureRecord,
    lilyPadPool,
    lilyPadsContainer,
    lilyPadCastShadowPool,
    plantCastShadowContainer,
    lilyPadTextureCache,
    lilyPadTextureCachePolicy,
    waterLilyBloomPool,
    waterLilyBloomsContainer,
    waterLilyCastShadowPool,
    waterLilyBloomTextureCache,
    waterLilyBloomTextureCachePolicy,
    zenIrisClusterPool,
    zenIrisClustersContainer,
    zenIrisCastShadowPool,
    zenIrisClusterTextureCache,
    zenIrisClusterTextureCachePolicy,
    ripplePool,
    ripplesContainer,
    getRingTextureRecord,
    petalPool,
    petalsContainer,
    getPetalTextureRecord,
    glimmerPool,
    glimmersContainer,
    getGlimmerTextureRecord,
    rockPool,
    rocksContainer,
    rockCastShadowPool,
    rockCastShadowContainer,
    rockTextureCache,
    rockTextureCachePolicy,
    aliveScratch,
    visualRenderPlan,
}) => {
    const entityTextures = visualRenderPlan?.entityTextures;
    if (!entityTextures) {
        throw new Error('ZEN_POND_ENTITY_TEXTURE_RENDER_PLAN_REQUIRED');
    }
    const entityRenderPlan = resolvePixiSceneEntityRenderPlan(worldPolicy);
    const ambientPassPlan = resolvePixiSceneAmbientPassPlan({
        frameCount,
        renderTimeMs,
        previousRenderTimeMs,
        sceneCadenceProfile,
    });
    const staticPassPlan = resolvePixiSceneStaticPassPlan({
        frameCount,
        renderTimeMs,
        previousRenderTimeMs,
        sceneCadenceProfile,
    });
    const runRockSync = shouldPrunePondTextureCache || staticPassPlan.runRocksSync !== false;
    const runPlantSync = ambientPassPlan.runPlantsSync !== false;
    const shouldSyncLilyPads = entityRenderPlan.lilyPads ? runPlantSync : true;
    const shouldSyncWaterLilies = entityRenderPlan.waterLilies ? runPlantSync : true;
    const shouldSyncIrises = entityRenderPlan.irises ? runPlantSync : true;
    const plantRenderState = (
        shouldSyncLilyPads
        || shouldSyncWaterLilies
        || shouldSyncIrises
    )
        ? resolvePondPlantRenderState({ frameChannels })
        : null;
    if (entityRenderPlan.rocks ? runRockSync : true) {
        syncRocks({
            webGLVersion,
            rocksRef: entityRenderPlan.rocks ? rocksRef : EMPTY_ENTITY_REF,
            bathymetryFieldRef,
            rockPool,
            rocksContainer,
            rockCastShadowPool,
            rockCastShadowContainer,
            ownedTextures,
            frameChannels,
            surfaceMaterialLightingActive,
            rockTextureCache,
            rockTextureCachePolicy,
            shouldPruneCache: shouldPrunePondTextureCache,
            aliveSet: aliveScratch.rocks,
            textureFactory: entityTextures.rock,
        });
    }
    const koiRender = syncFish({
        webGLVersion,
        koiCausticReceiver,
        surfaceMaterialLightingActive,
        renderTimeMs,
        fishRef: entityRenderPlan.fish ? fishRef : EMPTY_ENTITY_REF,
        bathymetryFieldRef,
        pixiFishPool,
        fishContainer,
        hoveredDomainRef,
        lockedTargetRef,
        selectedFishUidRef,
        rendererDebugToggles,
        rendererDebugTogglesRef,
        frameCount,
        frameChannels,
        fishShadowProfile,
        koiTextureCache,
        aliveSet: aliveScratch.fish,
    });
    if (entityRenderPlan.particles ? ambientPassPlan.runParticlesSync : true) {
        syncParticles({
            particlesRef: entityRenderPlan.particles ? particlesRef : EMPTY_ENTITY_REF,
            particlePool,
            particlesContainer,
            getParticleTextureRecord,
            visibleWorldBounds,
            aliveSet: aliveScratch.particles,
        });
    }
    if (shouldSyncLilyPads) {
        syncLilyPads({
            webGLVersion,
            lilyPadsRef: entityRenderPlan.lilyPads ? lilyPadsRef : EMPTY_ENTITY_REF,
            lilyPadPool,
            lilyPadsContainer,
            lilyPadCastShadowPool,
            castShadowContainer: plantCastShadowContainer,
            ownedTextures,
            frameChannels,
            plantRenderState,
            lilyPadTextureCache,
            lilyPadTextureCachePolicy,
            shouldPruneCache: shouldPrunePondTextureCache,
            aliveSet: aliveScratch.lilyPads,
            textureFactory: entityTextures.lilyPad,
        });
    }
    if (shouldSyncWaterLilies) {
        syncWaterLilyBlooms({
            webGLVersion,
            waterLilyRef: entityRenderPlan.waterLilies ? waterLilyRef : EMPTY_ENTITY_REF,
            lilyPadPool,
            waterLilyPool: waterLilyBloomPool,
            waterLilyContainer: waterLilyBloomsContainer,
            waterLilyCastShadowPool,
            castShadowContainer: plantCastShadowContainer,
            ownedTextures,
            frameChannels,
            plantRenderState,
            waterLilyTextureCache: waterLilyBloomTextureCache,
            waterLilyTextureCachePolicy: waterLilyBloomTextureCachePolicy,
            shouldPruneCache: shouldPrunePondTextureCache,
            aliveSet: aliveScratch.waterLilyBlooms,
            textureFactory: entityTextures.waterLily,
        });
    }
    if (shouldSyncIrises) {
        syncZenIrisClusters({
            zenIrisClustersRef: entityRenderPlan.irises ? zenIrisClustersRef : EMPTY_ENTITY_REF,
            zenIrisClusterPool,
            zenIrisClustersContainer,
            zenIrisCastShadowPool,
            castShadowContainer: plantCastShadowContainer,
            ownedTextures,
            frameChannels,
            plantRenderState,
            zenIrisClusterTextureCache,
            zenIrisClusterTextureCachePolicy,
            shouldPruneCache: shouldPrunePondTextureCache,
            aliveSet: aliveScratch.zenIrisClusters,
            textureFactory: entityTextures.iris,
        });
    }
    syncRingRippleProjection({
        nightDepth: frameChannels?.nightDepth,
        surfaceDisturbancesRef: entityRenderPlan.ripples ? surfaceDisturbancesRef : EMPTY_ENTITY_REF,
        ripplePool,
        ripplesContainer,
        getRingTextureRecord,
        visibleWorldBounds,
        aliveSet: aliveScratch.ripples,
    });
    if (entityRenderPlan.petals ? ambientPassPlan.runPetalsSync : true) {
        syncPetals({
            materialLighting: frameChannels?.botanicalMaterialLighting,
            petalsRef: entityRenderPlan.petals ? petalsRef : EMPTY_ENTITY_REF,
            petalPool,
            petalsContainer,
            getPetalTextureRecord,
            visibleWorldBounds,
            aliveSet: aliveScratch.petals,
        });
    }
    if (entityRenderPlan.glimmers ? ambientPassPlan.runGlimmersSync : true) {
        syncGlimmers({
            glimmersRef: entityRenderPlan.glimmers ? glimmersRef : EMPTY_ENTITY_REF,
            glimmerPool,
            glimmersContainer,
            getGlimmerTextureRecord,
            visibleWorldBounds,
            aliveSet: aliveScratch.glimmers,
        });
    }
    return {
        koiRender,
    };
};
