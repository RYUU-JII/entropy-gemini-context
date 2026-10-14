import {
    resolveZenRendererDebugTogglePreset,
    resolveZenWaterSurfaceFeaturePlan,
} from '../../../../contracts/zenRendererDebugToggles.js';

export const resolveWaterEffectsFeatureFlags = ({
    initialEffectDebugToggles,
    textureBakeSupported = false,
    cloudReflectionsEnabled = true,
    textureCausticsEnabled = true,
} = {}) => {
    const resolvedInputToggles = initialEffectDebugToggles && typeof initialEffectDebugToggles === 'object'
        ? initialEffectDebugToggles
        : resolveZenRendererDebugTogglePreset('on');
    const surfaceFeaturePlan = resolveZenWaterSurfaceFeaturePlan(resolvedInputToggles);
    const resolvedToggles = surfaceFeaturePlan.debugToggles;
    const waterEffectsToggleEnabled = surfaceFeaturePlan.waterEffectsEnabled;
    const waterLayerEffectsToggleEnabled = resolvedToggles.waterLayerEffectsEnabled === true;
    const layerEffectsToggleEnabled = waterEffectsToggleEnabled && waterLayerEffectsToggleEnabled;
    const surfaceOpticsToggleEnabled = surfaceFeaturePlan.surfaceOpticsEnabled;
    const rgbSplitToggleEnabled = surfaceFeaturePlan.rgbSplitEnabled;
    const yoonseulToggleEnabled = surfaceFeaturePlan.yoonseulEnabled;
    const benthicToggleEnabled = layerEffectsToggleEnabled && resolvedToggles.benthicEnabled !== false;
    const causticsToggleEnabled = (
        layerEffectsToggleEnabled
        && textureCausticsEnabled === true
        && textureBakeSupported
        && resolvedToggles.causticsEnabled !== false
    );
    const godRaysToggleEnabled = (
        layerEffectsToggleEnabled
        && textureBakeSupported
        && resolvedToggles.godRaysEnabled !== false
    );
    const cloudReflectionToggleEnabled = (
        layerEffectsToggleEnabled
        && textureBakeSupported
        && cloudReflectionsEnabled === true
        && resolvedToggles.cloudReflectionEnabled !== false
    );
    const atmosphereToggleEnabled = (
        layerEffectsToggleEnabled
        && textureBakeSupported
        && resolvedToggles.atmosphereEnabled !== false
    );
    // Komorebi shares the canopy field with the shade read, so it is resolved
    // here alongside the other layer features rather than inside its own tick.
    const komorebiToggleEnabled = (
        layerEffectsToggleEnabled
        && textureBakeSupported
        && resolvedToggles.komorebiEnabled !== false
    );
    const anyLayerFeatureEnabled = (
        benthicToggleEnabled
        || causticsToggleEnabled
        || godRaysToggleEnabled
        || cloudReflectionToggleEnabled
        || atmosphereToggleEnabled
        || komorebiToggleEnabled
    );

    return {
        waterEffectsToggleEnabled,
        waterLayerEffectsToggleEnabled,
        layerEffectsToggleEnabled,
        surfaceOpticsToggleEnabled,
        rgbSplitToggleEnabled,
        yoonseulToggleEnabled,
        benthicToggleEnabled,
        causticsToggleEnabled,
        godRaysToggleEnabled,
        cloudReflectionToggleEnabled,
        atmosphereToggleEnabled,
        komorebiToggleEnabled,
        anyLayerFeatureEnabled,
        debugToggles: {
            waterEffectsEnabled: waterEffectsToggleEnabled,
            waterSurfaceEffectsEnabled: surfaceFeaturePlan.waterSurfaceEffectsEnabled,
            waterLayerEffectsEnabled: layerEffectsToggleEnabled,
            surfaceOpticsEnabled: surfaceOpticsToggleEnabled,
            surfaceNormalEnabled: surfaceFeaturePlan.surfaceNormalEnabled,
            screenRefractionEnabled: surfaceFeaturePlan.screenRefractionEnabled,
            surfaceReflectionEnabled: surfaceFeaturePlan.surfaceReflectionEnabled,
            rgbSplitEnabled: rgbSplitToggleEnabled,
            yoonseulEnabled: yoonseulToggleEnabled,
            cloudReflectionEnabled: cloudReflectionToggleEnabled,
            benthicEnabled: benthicToggleEnabled,
            causticsEnabled: causticsToggleEnabled,
            godRaysEnabled: godRaysToggleEnabled,
            atmosphereEnabled: atmosphereToggleEnabled,
            komorebiEnabled: komorebiToggleEnabled,
        },
    };
};
