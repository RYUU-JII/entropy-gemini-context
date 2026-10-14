import {
    DEFAULT_ZEN_POND_WORLD_ID,
    resolveZenPondWorldPolicy,
} from '../../runtime/core/zenPondWorldProfile.js';

const DEFAULT_PIXI_WORLD_POLICY = resolveZenPondWorldPolicy(DEFAULT_ZEN_POND_WORLD_ID);
const COSMIC_BACKGROUND_DRIVER_ID = 'cosmic_space';
const POND_BACKGROUND_DRIVER_ID = 'pond_water';
const DEFAULT_BACKGROUND_DRIVER_ID = POND_BACKGROUND_DRIVER_ID;

const isObject = (value) => (
    Boolean(value && typeof value === 'object' && !Array.isArray(value))
);

const resolvePolicyInput = (policyOrFrameState = null) => {
    if (isObject(policyOrFrameState?.worldPolicy)) return policyOrFrameState.worldPolicy;
    return isObject(policyOrFrameState) ? policyOrFrameState : null;
};

export const resolvePixiSceneWorldPolicy = (policyOrFrameState = null) => {
    const policy = resolvePolicyInput(policyOrFrameState);
    return typeof policy?.id === 'string' ? policy : DEFAULT_PIXI_WORLD_POLICY;
};

const resolveEntityFlag = (worldPolicy, key) => (
    worldPolicy?.render?.entities?.[key] !== false
);

const resolveEffectFlag = (worldPolicy, key) => (
    worldPolicy?.render?.effects?.[key] !== false
);

const resolveMaterialFlag = (worldPolicy, key) => (
    worldPolicy?.render?.materials?.[key] !== false
);

export const resolvePixiSceneBackgroundRenderPlan = (policyOrFrameState = null) => {
    const worldPolicy = resolvePixiSceneWorldPolicy(policyOrFrameState);
    const driver = typeof worldPolicy?.backgroundDriver === 'string' && worldPolicy.backgroundDriver
        ? worldPolicy.backgroundDriver
        : DEFAULT_BACKGROUND_DRIVER_ID;
    return Object.freeze({
        driver,
        pondWater: driver === POND_BACKGROUND_DRIVER_ID,
        cosmicSpace: driver === COSMIC_BACKGROUND_DRIVER_ID,
    });
};

export const resolvePixiSceneEntityRenderPlan = (policyOrFrameState = null) => {
    const worldPolicy = resolvePixiSceneWorldPolicy(policyOrFrameState);
    return Object.freeze({
        fish: resolveEntityFlag(worldPolicy, 'fish'),
        rocks: resolveEntityFlag(worldPolicy, 'rocks'),
        lilyPads: resolveEntityFlag(worldPolicy, 'lilyPads'),
        waterLilies: resolveEntityFlag(worldPolicy, 'waterLilies'),
        irises: resolveEntityFlag(worldPolicy, 'irises'),
        particles: resolveEntityFlag(worldPolicy, 'particles'),
        ripples: resolveEntityFlag(worldPolicy, 'ripples'),
        petals: resolveEntityFlag(worldPolicy, 'petals'),
        glimmers: resolveEntityFlag(worldPolicy, 'glimmers'),
    });
};

export const resolvePixiSceneEffectRenderPlan = (policyOrFrameState = null) => {
    const worldPolicy = resolvePixiSceneWorldPolicy(policyOrFrameState);
    const waterBase = resolveEffectFlag(worldPolicy, 'waterBase');
    const waterDepth = resolveEffectFlag(worldPolicy, 'waterDepth');
    const waterRefraction = resolveEffectFlag(worldPolicy, 'waterRefraction');
    const waterSurface = resolveEffectFlag(worldPolicy, 'waterSurface');
    const waterCaustics = resolveEffectFlag(worldPolicy, 'waterCaustics');
    const waterHighlights = resolveEffectFlag(worldPolicy, 'waterHighlights');
    const topShadow = resolveEffectFlag(worldPolicy, 'topShadow');
    const benthicAo = resolveEffectFlag(worldPolicy, 'benthicAo');
    const waterSurfaceFilter = (
        waterRefraction
        || waterSurface
        || waterHighlights
    );
    return Object.freeze({
        waterBase,
        waterDepth,
        waterRefraction,
        waterSurface,
        waterSurfaceFilter,
        waterCaustics,
        waterHighlights,
        topShadow,
        benthicAo,
        waterLayer: (
            benthicAo
            || waterCaustics
            || waterHighlights
            || topShadow
        ),
    });
};

export const resolvePixiSceneMaterialRenderPlan = (policyOrFrameState = null) => {
    const worldPolicy = resolvePixiSceneWorldPolicy(policyOrFrameState);
    return Object.freeze({
        fishLighting: worldPolicy?.render?.materials?.fishLighting || 'pond',
        fishShadow: resolveMaterialFlag(worldPolicy, 'fishShadow'),
    });
};

export const buildPixiSceneWorldPolicySignature = (policyOrFrameState = null) => {
    const worldPolicy = resolvePixiSceneWorldPolicy(policyOrFrameState);
    const backgroundPlan = resolvePixiSceneBackgroundRenderPlan(worldPolicy);
    const entityPlan = resolvePixiSceneEntityRenderPlan(worldPolicy);
    const effectPlan = resolvePixiSceneEffectRenderPlan(worldPolicy);
    const materialPlan = resolvePixiSceneMaterialRenderPlan(worldPolicy);
    return [
        worldPolicy.id,
        backgroundPlan.driver,
        entityPlan.fish ? 1 : 0,
        entityPlan.rocks ? 1 : 0,
        entityPlan.lilyPads ? 1 : 0,
        entityPlan.waterLilies ? 1 : 0,
        entityPlan.irises ? 1 : 0,
        entityPlan.particles ? 1 : 0,
        entityPlan.ripples ? 1 : 0,
        entityPlan.petals ? 1 : 0,
        entityPlan.glimmers ? 1 : 0,
        effectPlan.waterBase ? 1 : 0,
        effectPlan.waterDepth ? 1 : 0,
        effectPlan.waterRefraction ? 1 : 0,
        effectPlan.waterSurface ? 1 : 0,
        effectPlan.waterSurfaceFilter ? 1 : 0,
        effectPlan.waterCaustics ? 1 : 0,
        effectPlan.waterHighlights ? 1 : 0,
        effectPlan.topShadow ? 1 : 0,
        effectPlan.benthicAo ? 1 : 0,
        materialPlan.fishLighting,
        materialPlan.fishShadow ? 1 : 0,
    ].join('|');
};

const setNodeVisible = (node, visible) => {
    if (!node || typeof node !== 'object') return;
    node.visible = visible === true;
};

export const applyPixiSceneGraphWorldPolicy = ({
    graph = null,
    worldPolicy = null,
} = {}) => {
    const entityPlan = resolvePixiSceneEntityRenderPlan(worldPolicy);
    const effectPlan = resolvePixiSceneEffectRenderPlan(worldPolicy);
    const backgroundPlan = resolvePixiSceneBackgroundRenderPlan(worldPolicy);
    const plantVisible = (
        entityPlan.lilyPads
        || entityPlan.waterLilies
        || entityPlan.irises
    );
    const staticBaseVisible = (
        (effectPlan.waterBase && backgroundPlan.pondWater)
        || effectPlan.waterDepth
        || effectPlan.benthicAo
        || effectPlan.waterCaustics
        || entityPlan.rocks
    );
    const dynamicVisible = (
        backgroundPlan.cosmicSpace
        || entityPlan.fish
        || entityPlan.particles
    );
    const slowOverlayVisible = (
        effectPlan.waterSurfaceFilter
        || effectPlan.waterCaustics
    );

    setNodeVisible(graph?.fishContainer, entityPlan.fish);
    setNodeVisible(graph?.rocksContainer, entityPlan.rocks);
    setNodeVisible(graph?.rockCastShadowContainer, entityPlan.rocks);
    setNodeVisible(graph?.lilyPadsContainer, entityPlan.lilyPads);
    setNodeVisible(graph?.waterLilyBloomsContainer, entityPlan.waterLilies);
    setNodeVisible(graph?.zenIrisClustersContainer, entityPlan.irises);
    setNodeVisible(graph?.plantCastShadowContainer, plantVisible);
    setNodeVisible(graph?.particlesContainer, entityPlan.particles);
    setNodeVisible(graph?.ripplesContainer, entityPlan.ripples);
    setNodeVisible(graph?.petalsContainer, entityPlan.petals);
    setNodeVisible(graph?.glimmersContainer, entityPlan.glimmers);
    setNodeVisible(
        graph?.surfaceStaticBaseContainer,
        staticBaseVisible,
    );
    setNodeVisible(
        graph?.floorMaterialContainer,
        (effectPlan.waterBase && backgroundPlan.pondWater)
            || effectPlan.waterDepth
            || effectPlan.benthicAo
            || effectPlan.waterCaustics,
    );
    setNodeVisible(
        graph?.surfaceBenthicLightContainer,
        effectPlan.waterCaustics,
    );
    setNodeVisible(
        graph?.surfaceDynamicContainer,
        dynamicVisible,
    );
    setNodeVisible(
        graph?.surfaceSlowOverlayContainer,
        slowOverlayVisible,
    );
    setNodeVisible(
        graph?.waterSurfaceGuideContainer,
        slowOverlayVisible,
    );
    setNodeVisible(graph?.waterCloudReflectionContainer, slowOverlayVisible);
    setNodeVisible(graph?.backgroundContainer, effectPlan.waterBase && backgroundPlan.pondWater);
    setNodeVisible(graph?.cosmicBackgroundContainer, backgroundPlan.cosmicSpace);
    setNodeVisible(graph?.depthContainer, effectPlan.waterDepth);
    setNodeVisible(
        graph?.waterBenthicContainer,
        effectPlan.benthicAo || effectPlan.waterCaustics,
    );
    setNodeVisible(
        graph?.waterSurfaceSourceContainer,
        effectPlan.waterSurfaceFilter
            || effectPlan.waterCaustics
    );
    setNodeVisible(
        graph?.waterSurfaceContainer,
        effectPlan.waterSurface || effectPlan.waterHighlights,
    );
    setNodeVisible(graph?.topShadowContainer, effectPlan.topShadow);

    return entityPlan;
};
