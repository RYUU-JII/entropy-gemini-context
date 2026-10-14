const NOOP_WATER_EFFECTS_LAYER = Object.freeze({
    displayObjects: Object.freeze([]),
    benthicObjects: Object.freeze([]),
    refractedSurfaceObjects: Object.freeze([]),
    cloudReflectionObjects: Object.freeze([]),
    topShadowObjects: Object.freeze([]),
    surfaceObjects: Object.freeze([]),
    initMetrics: null,
    tick: () => { },
    destroy: () => { },
});

const buildNoopWaterEffectsProbe = (reason = 'noop') => ({
    visible: false,
    topShadowVisible: false,
    reason,
    godRaysGate: 0,
    stagedRayGate: 0,
    surfaceOpticsGate: 0,
    benthicGate: 0,
    causticGate: 0,
    highlightsGate: 0,
    cloudReflectionToggleGate: 0,
    cloudReflectionComputeEnabled: false,
    atmosphereGate: 0,
    sunlightIntensity: 0,
    baseOpTarget: 0,
    primaryAlpha: 0,
    mirrorStrength: 0,
    bottomVisibility: 0,
    pebbleAlpha: 0,
    pebbleDetailAlpha: 0,
    benthicOwnerId: null,
    benthicSourceSpriteCount: 0,
    benthicVisibleSpriteCount: 0,
    benthicPrimaryAlphaScale: 0,
    benthicDetailAlphaScale: 0,
    refractedGuideAlpha: 0,
    causticPrimaryAlpha: 0,
    causticSecondaryAlpha: 0,
    highlightPrimaryAlpha: 0,
    highlightMicroAlpha: 0,
    atmosphereAlpha: 0,
});

export const createNoopWaterEffectsLayer = (reason = 'noop') => {
    const probe = buildNoopWaterEffectsProbe(reason);
    return {
        ...NOOP_WATER_EFFECTS_LAYER,
        tick: () => probe,
        getTopShadowProbe: () => probe,
    };
};
