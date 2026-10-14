import {
    BLEND_MODES,
    Container,
    Rectangle,
    Sprite,
    Texture,
} from '@/themes/plugins/zen/pond/renderers/pixi/zenPondPixiRuntime.js';
import { SOFT_LIGHT_BLEND } from './pixiSceneTextureFactories.js';
import { applyPixiSceneGraphWorldPolicy } from './pixiSceneWorldPolicy.js';
import { ZenBenthicMaterialFilter } from './ZenBenthicMaterialFilter.js';

export const WATER_SURFACE_FILTER_GUARD_WORLD_PX = 48;
export const WATER_REFRACTION_FILTER_GUARD_WORLD_PX = WATER_SURFACE_FILTER_GUARD_WORLD_PX;

const resolveFiniteNumber = (value, fallback) => {
    if (value === null || value === undefined || value === '') return fallback;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
};

export const resolveWaterSurfaceFilterArea = ({
    target = null,
    width,
    height,
    guardWorldPx = WATER_SURFACE_FILTER_GUARD_WORLD_PX,
} = {}) => {
    const sceneWidth = Math.max(1, Math.round(resolveFiniteNumber(width, 1)));
    const sceneHeight = Math.max(1, Math.round(resolveFiniteNumber(height, 1)));
    const rectInput = (
        target
        && typeof target === 'object'
        && !Array.isArray(target)
    )
        ? target
        : null;
    const targetWidthRaw = rectInput ? rectInput.width : target;
    const targetHeightRaw = rectInput ? rectInput.height : height;
    const targetXRaw = rectInput ? rectInput.x : 0;
    const targetYRaw = rectInput ? rectInput.y : 0;
    const targetWidth = Math.min(
        sceneWidth,
        Math.max(1, Math.round(resolveFiniteNumber(targetWidthRaw, sceneWidth))),
    );
    const targetHeight = Math.min(
        sceneHeight,
        Math.max(1, Math.round(resolveFiniteNumber(targetHeightRaw, sceneHeight))),
    );
    const targetX = Math.min(
        Math.max(0, sceneWidth - targetWidth),
        Math.max(0, Math.round(resolveFiniteNumber(targetXRaw, 0))),
    );
    const targetY = Math.min(
        Math.max(0, sceneHeight - targetHeight),
        Math.max(0, Math.round(resolveFiniteNumber(targetYRaw, 0))),
    );
    const guard = Math.max(0, Math.round(resolveFiniteNumber(guardWorldPx, WATER_SURFACE_FILTER_GUARD_WORLD_PX)));
    const guardedX = Math.max(0, targetX - guard);
    const guardedY = Math.max(0, targetY - guard);
    const guardedMaxX = Math.min(sceneWidth, targetX + targetWidth + guard);
    const guardedMaxY = Math.min(sceneHeight, targetY + targetHeight + guard);
    const guardedWidth = Math.max(1, Math.min(sceneWidth, guardedMaxX - guardedX));
    const guardedHeight = Math.max(1, Math.min(sceneHeight, guardedMaxY - guardedY));
    return {
        x: guardedX,
        y: guardedY,
        width: guardedWidth,
        height: guardedHeight,
        worldWidth: sceneWidth,
        worldHeight: sceneHeight,
        guardWorldPx: guard,
    };
};

export const resolveWaterRefractionFilterArea = resolveWaterSurfaceFilterArea;

export const bindPixiViewToBackgroundHost = ({ backgroundHost, view }) => {
    if (typeof backgroundHost?.removeChild === 'function') {
        while (backgroundHost.firstChild) {
            backgroundHost.removeChild(backgroundHost.firstChild);
        }
    }
    if (view?.style) {
        view.style.width = '100%';
        view.style.height = '100%';
        view.style.display = 'block';
        view.style.pointerEvents = 'none';
    }
    if (typeof backgroundHost?.appendChild === 'function') {
        backgroundHost.appendChild(view);
    }
};

export const unbindPixiViewFromBackgroundHost = ({ backgroundHost, view }) => {
    if (typeof backgroundHost?.removeChild === 'function') {
        try {
            backgroundHost.removeChild(view);
        } catch (_) {
            // Host might already be detached or virtualized.
        }
    }
};

export const attachZenPixiSceneRootLayers = ({
    sceneRoot,
    waterVolumeContainer,
    waterSurfaceContainer,
    ripplesContainer,
    plantCastShadowContainer,
    lilyPadsContainer,
    waterLilyBloomsContainer,
    zenIrisClustersContainer,
    petalsContainer,
    glimmersContainer,
    temporalTintContainer,
    topShadowContainer,
} = {}) => {
    sceneRoot?.addChild(waterVolumeContainer);
    sceneRoot?.addChild(waterSurfaceContainer);
    sceneRoot?.addChild(ripplesContainer);
    sceneRoot?.addChild(plantCastShadowContainer);
    sceneRoot?.addChild(lilyPadsContainer);
    sceneRoot?.addChild(waterLilyBloomsContainer);
    sceneRoot?.addChild(zenIrisClustersContainer);
    sceneRoot?.addChild(petalsContainer);
    sceneRoot?.addChild(glimmersContainer);
    // Canopy shade and komorebi fall on the pond and on everything floating in
    // it, so the shared direct/diffuse transfer sits above the decor.
    sceneRoot?.addChild(topShadowContainer);
    sceneRoot?.addChild(temporalTintContainer);
};

export const createZenPixiSceneGraph = ({
    rootContainer,
    width,
    height,
    sceneReadabilityAlpha,
    worldPolicy = null,
}) => {
    const waterVolumeContainer = new Container();
    const cosmicBackgroundContainer = new Container();
    const backgroundContainer = new Container();
    const depthContainer = new Container();
    const waterSurfaceFilterContainer = new Container();
    const surfaceStaticBaseContainer = new Container();
    const floorMaterialContainer = new Container();
    const surfaceBenthicLightContainer = new Container();
    const surfaceDynamicContainer = new Container();
    const surfaceSlowOverlayContainer = new Container();
    const waterSurfaceSourceContainer = new Container();
    const waterSurfaceGuideContainer = new Container();
    const waterCloudReflectionContainer = new Container();
    const waterCloudReflectionSourceContainer = new Container();
    const rockCastShadowContainer = new Container();
    const rocksContainer = new Container();
    const waterBenthicContainer = new Container();
    const fishContainer = new Container();
    const waterSurfaceContainer = new Container();
    const plantCastShadowContainer = new Container();
    const particlesContainer = new Container();
    const lilyPadsContainer = new Container();
    lilyPadsContainer.sortableChildren = true;
    const waterLilyBloomsContainer = new Container();
    waterLilyBloomsContainer.sortableChildren = true;
    const zenIrisClustersContainer = new Container();
    zenIrisClustersContainer.sortableChildren = true;
    const ripplesContainer = new Container();
    const petalsContainer = new Container();
    const glimmersContainer = new Container();
    const temporalTintContainer = new Container();
    const topShadowContainer = new Container();

    const sceneRoot = rootContainer && typeof rootContainer.addChild === 'function'
        ? rootContainer
        : null;
    attachZenPixiSceneRootLayers({
        sceneRoot,
        waterVolumeContainer,
        waterSurfaceContainer,
        ripplesContainer,
        plantCastShadowContainer,
        lilyPadsContainer,
        waterLilyBloomsContainer,
        zenIrisClustersContainer,
        petalsContainer,
        glimmersContainer,
        temporalTintContainer,
        topShadowContainer,
    });

    waterVolumeContainer.addChild(waterSurfaceFilterContainer);
    waterSurfaceFilterContainer.addChild(surfaceStaticBaseContainer);
    waterSurfaceFilterContainer.addChild(surfaceBenthicLightContainer);
    waterSurfaceFilterContainer.addChild(surfaceDynamicContainer);
    waterSurfaceFilterContainer.addChild(surfaceSlowOverlayContainer);
    surfaceDynamicContainer.addChild(cosmicBackgroundContainer);
    surfaceStaticBaseContainer.addChild(floorMaterialContainer);
    floorMaterialContainer.addChild(backgroundContainer);
    floorMaterialContainer.addChild(depthContainer);
    floorMaterialContainer.addChild(waterBenthicContainer);
    // Ground objects keep live solar materials/casts outside the floor cache,
    // while remaining beneath the shared water-surface optical filter.
    surfaceDynamicContainer.addChild(rockCastShadowContainer);
    surfaceDynamicContainer.addChild(rocksContainer);
    surfaceDynamicContainer.addChild(fishContainer);
    surfaceDynamicContainer.addChild(particlesContainer);
    surfaceSlowOverlayContainer.addChild(waterSurfaceSourceContainer);
    waterSurfaceSourceContainer.addChild(waterSurfaceGuideContainer);
    waterSurfaceSourceContainer.addChild(waterCloudReflectionContainer);
    waterCloudReflectionContainer.addChild(waterCloudReflectionSourceContainer);

    const cloudReflectionBakeBaseSprite = new Sprite(Texture.WHITE);
    cloudReflectionBakeBaseSprite.x = 0;
    cloudReflectionBakeBaseSprite.y = 0;
    cloudReflectionBakeBaseSprite.width = width;
    cloudReflectionBakeBaseSprite.height = height;
    cloudReflectionBakeBaseSprite.tint = 0x000000;
    cloudReflectionBakeBaseSprite.visible = false;
    waterCloudReflectionSourceContainer.addChild(cloudReflectionBakeBaseSprite);

    const baseWaterSprite = new Sprite(Texture.WHITE);
    baseWaterSprite.x = 0;
    baseWaterSprite.y = 0;
    baseWaterSprite.width = width;
    baseWaterSprite.height = height;
    backgroundContainer.addChild(baseWaterSprite);

    const cosmicBackgroundSprite = new Sprite(Texture.WHITE);
    cosmicBackgroundSprite.x = 0;
    cosmicBackgroundSprite.y = 0;
    cosmicBackgroundSprite.width = width;
    cosmicBackgroundSprite.height = height;
    cosmicBackgroundSprite.visible = false;
    cosmicBackgroundContainer.addChild(cosmicBackgroundSprite);

    const depthMultiplySprite = new Sprite(Texture.WHITE);
    depthMultiplySprite.x = 0;
    depthMultiplySprite.y = 0;
    depthMultiplySprite.width = width;
    depthMultiplySprite.height = height;
    depthMultiplySprite.blendMode = BLEND_MODES.MULTIPLY;
    depthMultiplySprite.alpha = 0;
    depthContainer.addChild(depthMultiplySprite);

    const depthSoftSprite = new Sprite(Texture.WHITE);
    depthSoftSprite.x = 0;
    depthSoftSprite.y = 0;
    depthSoftSprite.width = width;
    depthSoftSprite.height = height;
    depthSoftSprite.blendMode = SOFT_LIGHT_BLEND;
    depthSoftSprite.alpha = 0;
    depthContainer.addChild(depthSoftSprite);


    const tintMultiplySprite = new Sprite(Texture.WHITE);
    tintMultiplySprite.x = 0;
    tintMultiplySprite.y = 0;
    tintMultiplySprite.width = width;
    tintMultiplySprite.height = height;
    tintMultiplySprite.blendMode = BLEND_MODES.MULTIPLY;
    temporalTintContainer.addChild(tintMultiplySprite);

    const tintSoftSprite = new Sprite(Texture.WHITE);
    tintSoftSprite.x = 0;
    tintSoftSprite.y = 0;
    tintSoftSprite.width = width;
    tintSoftSprite.height = height;
    tintSoftSprite.blendMode = SOFT_LIGHT_BLEND;
    temporalTintContainer.addChild(tintSoftSprite);

    const tintScreenSprite = new Sprite(Texture.WHITE);
    tintScreenSprite.x = 0;
    tintScreenSprite.y = 0;
    tintScreenSprite.width = width;
    tintScreenSprite.height = height;
    tintScreenSprite.blendMode = BLEND_MODES.SCREEN;
    temporalTintContainer.addChild(tintScreenSprite);

    plantCastShadowContainer.alpha = sceneReadabilityAlpha.plantCastShadows;
    rockCastShadowContainer.alpha = sceneReadabilityAlpha.rockCastShadows;
    fishContainer.alpha = sceneReadabilityAlpha.fish;
    lilyPadsContainer.alpha = sceneReadabilityAlpha.lilyPads;
    waterLilyBloomsContainer.alpha = sceneReadabilityAlpha.waterLilyBlooms;
    zenIrisClustersContainer.alpha = sceneReadabilityAlpha.zenIrisClusters;
    rocksContainer.alpha = sceneReadabilityAlpha.rocks;
    waterBenthicContainer.alpha = sceneReadabilityAlpha.waterBenthic;
    ripplesContainer.alpha = sceneReadabilityAlpha.ripples;

    const waterSurfaceFilterAreaSize = {
        x: 0,
        y: 0,
        width: Math.max(1, Math.round(width)),
        height: Math.max(1, Math.round(height)),
        worldWidth: Math.max(1, Math.round(width)),
        worldHeight: Math.max(1, Math.round(height)),
        guardWorldPx: WATER_SURFACE_FILTER_GUARD_WORLD_PX,
    };
    const syncWaterSurfaceFilterArea = (nextOrRect = width, nextHeight = height) => {
        const target = (
            nextOrRect
            && typeof nextOrRect === 'object'
            && !Array.isArray(nextOrRect)
        )
            ? nextOrRect
            : { width: nextOrRect, height: nextHeight };
        const resolvedArea = resolveWaterSurfaceFilterArea({
            target,
            width,
            height,
        });
        waterSurfaceFilterAreaSize.x = resolvedArea.x;
        waterSurfaceFilterAreaSize.y = resolvedArea.y;
        waterSurfaceFilterAreaSize.width = resolvedArea.width;
        waterSurfaceFilterAreaSize.height = resolvedArea.height;
        waterSurfaceFilterAreaSize.worldWidth = resolvedArea.worldWidth;
        waterSurfaceFilterAreaSize.worldHeight = resolvedArea.worldHeight;
        waterSurfaceFilterAreaSize.guardWorldPx = resolvedArea.guardWorldPx;
        if (!waterSurfaceFilterContainer.filterArea) {
            waterSurfaceFilterContainer.filterArea = new Rectangle(
                waterSurfaceFilterAreaSize.x,
                waterSurfaceFilterAreaSize.y,
                waterSurfaceFilterAreaSize.width,
                waterSurfaceFilterAreaSize.height,
            );
            return;
        }
        waterSurfaceFilterContainer.filterArea.x = waterSurfaceFilterAreaSize.x;
        waterSurfaceFilterContainer.filterArea.y = waterSurfaceFilterAreaSize.y;
        waterSurfaceFilterContainer.filterArea.width = waterSurfaceFilterAreaSize.width;
        waterSurfaceFilterContainer.filterArea.height = waterSurfaceFilterAreaSize.height;
    };
    syncWaterSurfaceFilterArea(width, height);

    const graph = {
        resizeWorld: (nextWidth, nextHeight) => {
            width = nextWidth;
            height = nextHeight;
            for (const sprite of [baseWaterSprite, cosmicBackgroundSprite, depthMultiplySprite, depthSoftSprite,
                tintMultiplySprite, tintSoftSprite, tintScreenSprite, cloudReflectionBakeBaseSprite]) {
                sprite.width = width;
                sprite.height = height;
            }
            syncWaterSurfaceFilterArea(width, height);
        },
        waterVolumeContainer,
        surfaceStaticBaseContainer,
        floorMaterialContainer,
        surfaceBenthicLightContainer,
        surfaceDynamicContainer,
        surfaceSlowOverlayContainer,
        cosmicBackgroundContainer,
        backgroundContainer,
        depthContainer,
        waterSurfaceFilterContainer,
        waterSurfaceSourceContainer,
        waterSurfaceGuideContainer,
        waterCloudReflectionContainer,
        waterCloudReflectionSourceContainer,
        rockCastShadowContainer,
        rocksContainer,
        waterBenthicContainer,
        fishContainer,
        waterSurfaceContainer,
        plantCastShadowContainer,
        particlesContainer,
        lilyPadsContainer,
        waterLilyBloomsContainer,
        zenIrisClustersContainer,
        ripplesContainer,
        petalsContainer,
        glimmersContainer,
        temporalTintContainer,
        topShadowContainer,
        cosmicBackgroundSprite,
        baseWaterSprite,
        depthMultiplySprite,
        depthSoftSprite,
        cloudReflectionBakeBaseSprite,
        tintMultiplySprite,
        tintSoftSprite,
        tintScreenSprite,
        waterSurfaceFilterAreaSize,
        syncWaterSurfaceFilterArea,
    };
    graph.surfaceSourceGraph = Object.freeze({
        staticBaseContainer: surfaceStaticBaseContainer,
        dynamicContainer: surfaceDynamicContainer,
        slowOverlayContainer: surfaceSlowOverlayContainer,
        staticBaseSources: Object.freeze([
            floorMaterialContainer,
        ]),
        dynamicSources: Object.freeze([
            surfaceBenthicLightContainer,
            surfaceDynamicContainer,
        ]),
        slowOverlaySources: Object.freeze([
            waterSurfaceSourceContainer,
        ]),
        cloudReflectionContainer: waterCloudReflectionContainer,
        cloudReflectionSourceContainer: waterCloudReflectionSourceContainer,
        cloudReflectionSources: Object.freeze([
            waterCloudReflectionSourceContainer,
        ]),
        guideSources: Object.freeze([
            waterSurfaceGuideContainer,
        ]),
    });
    applyPixiSceneGraphWorldPolicy({ graph, worldPolicy });
    return graph;
};

export const createWaterEffectSpriteBinder = ({
    webGLVersion,
    floorMaterialContainer,
    waterBenthicContainer,
    waterSurfaceSourceContainer = null,
    waterSurfaceGuideContainer = null,
    waterCloudReflectionSourceContainer = null,
    waterSurfaceContainer,
    topShadowContainer,
}) => {
    const resolvedSurfaceSourceContainer = waterSurfaceSourceContainer;
    const resolvedSurfaceGuideContainer = waterSurfaceGuideContainer || resolvedSurfaceSourceContainer;
    const resolvedCloudReflectionSourceContainer = waterCloudReflectionSourceContainer
        || resolvedSurfaceSourceContainer;
    let attachedWaterBenthicObjects = [];
    let attachedWaterRefractedSurfaceObjects = [];
    let attachedWaterCloudReflectionObjects = [];
    let attachedWaterSurfaceObjects = [];
    let attachedWaterTopShadowObjects = [];
    let benthicMaterialFilter = null;

    const detachWaterEffectSprites = () => {
        if (benthicMaterialFilter) {
            floorMaterialContainer.filters = null;
            benthicMaterialFilter.destroy();
            benthicMaterialFilter = null;
        }
        for (let i = 0; i < attachedWaterBenthicObjects.length; i += 1) {
            attachedWaterBenthicObjects[i]?.parent?.removeChild(attachedWaterBenthicObjects[i]);
        }
        for (let i = 0; i < attachedWaterRefractedSurfaceObjects.length; i += 1) {
            attachedWaterRefractedSurfaceObjects[i]?.parent?.removeChild(attachedWaterRefractedSurfaceObjects[i]);
        }
        for (let i = 0; i < attachedWaterCloudReflectionObjects.length; i += 1) {
            attachedWaterCloudReflectionObjects[i]?.parent?.removeChild(attachedWaterCloudReflectionObjects[i]);
        }
        for (let i = 0; i < attachedWaterSurfaceObjects.length; i += 1) {
            attachedWaterSurfaceObjects[i]?.parent?.removeChild(attachedWaterSurfaceObjects[i]);
        }
        for (let i = 0; i < attachedWaterTopShadowObjects.length; i += 1) {
            attachedWaterTopShadowObjects[i]?.parent?.removeChild(attachedWaterTopShadowObjects[i]);
        }
        attachedWaterBenthicObjects = [];
        attachedWaterRefractedSurfaceObjects = [];
        attachedWaterCloudReflectionObjects = [];
        attachedWaterSurfaceObjects = [];
        attachedWaterTopShadowObjects = [];
    };

    const attachWaterEffectSprites = (layer) => {
        detachWaterEffectSprites();
        attachedWaterBenthicObjects = Array.isArray(layer?.benthicObjects)
            ? layer.benthicObjects
            : [];
        attachedWaterRefractedSurfaceObjects = Array.isArray(layer?.refractedSurfaceObjects)
            ? layer.refractedSurfaceObjects
            : [];
        attachedWaterCloudReflectionObjects = Array.isArray(layer?.cloudReflectionObjects)
            ? layer.cloudReflectionObjects
            : [];
        attachedWaterSurfaceObjects = Array.isArray(layer?.surfaceObjects)
            ? layer.surfaceObjects
            : (Array.isArray(layer?.displayObjects) ? layer.displayObjects : []);
        attachedWaterTopShadowObjects = Array.isArray(layer?.topShadowObjects)
            ? layer.topShadowObjects
            : [];
        for (let i = 0; i < attachedWaterBenthicObjects.length; i += 1) {
            waterBenthicContainer.addChild(attachedWaterBenthicObjects[i]);
        }
        if (attachedWaterBenthicObjects.length > 0) {
            if (attachedWaterBenthicObjects.length !== 2 || !floorMaterialContainer) {
                throw new Error('ZEN_BENTHIC_MATERIAL_GRAPH_INVALID');
            }
            benthicMaterialFilter = new ZenBenthicMaterialFilter({
                webGLVersion,
                floor: floorMaterialContainer,
                primary: attachedWaterBenthicObjects[0],
                detail: attachedWaterBenthicObjects[1],
            });
            floorMaterialContainer.filters = [benthicMaterialFilter];
        }
        for (let i = 0; i < attachedWaterRefractedSurfaceObjects.length; i += 1) {
            resolvedSurfaceGuideContainer.addChild(attachedWaterRefractedSurfaceObjects[i]);
        }
        for (let i = 0; i < attachedWaterCloudReflectionObjects.length; i += 1) {
            resolvedCloudReflectionSourceContainer.addChild(attachedWaterCloudReflectionObjects[i]);
        }
        for (let i = 0; i < attachedWaterSurfaceObjects.length; i += 1) {
            waterSurfaceContainer.addChild(attachedWaterSurfaceObjects[i]);
        }
        for (let i = 0; i < attachedWaterTopShadowObjects.length; i += 1) {
            topShadowContainer.addChild(attachedWaterTopShadowObjects[i]);
        }
    };

    return {
        attachWaterEffectSprites,
        detachWaterEffectSprites,
    };
};
