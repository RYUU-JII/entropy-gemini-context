import { assertPixiFrameContract } from '../../pixiFrameChannels.js';

export const resolveWaterFrameContract = ({
    frameState = null,
    frameChannels = null,
    resolveMaterialProjection,
} = {}) => {
    const resolvedFrameState = assertPixiFrameContract(frameState);
    const sharedChannels = frameChannels && typeof frameChannels === 'object'
        ? frameChannels
        : null;
    const waterTemporalProjection = sharedChannels?.waterTemporalProjection || null;
    if (!sharedChannels) {
        throw new Error('ZEN_PIXI_WATER_EFFECTS_FRAME_CONTRACT_MISSING');
    }
    if (sharedChannels.channels !== resolvedFrameState.channels) {
        throw new Error('ZEN_PIXI_WATER_EFFECTS_FRAME_CHANNELS_MISMATCH');
    }

    if (typeof resolveMaterialProjection !== 'function') {
        throw new Error('ZEN_PIXI_WATER_EFFECTS_MATERIAL_PROJECTION_RESOLVER_MISSING');
    }
    const materialProjection = resolveMaterialProjection(resolvedFrameState, sharedChannels);
    if (!materialProjection) {
        throw new Error('ZEN_PIXI_WATER_EFFECTS_FRAME_STATIC_MISSING');
    }

    return {
        sharedChannels,
        waterTemporalProjection,
        materialProjection,
    };
};

export const resolveWaterStartupGates = ({
    surfaceOpticsToggleEnabled = true,
    rgbSplitToggleEnabled = false,
    yoonseulToggleEnabled = true,
    benthicToggleEnabled = true,
    causticsToggleEnabled = true,
    cloudReflectionToggleEnabled = false,
    godRaysToggleEnabled = true,
    atmosphereToggleEnabled = true,
    effectDebugToggles = null,
} = {}) => {
    const stagedBenthicGate = 1;
    const stagedCausticGate = 1;
    const stagedCloudGate = 1;
    const stagedRayGate = 1;

    const surfaceOpticsGate = surfaceOpticsToggleEnabled && effectDebugToggles?.surfaceOpticsEnabled !== false ? 1 : 0;
    const rgbSplitGate = rgbSplitToggleEnabled && effectDebugToggles?.rgbSplitEnabled === true ? 1 : 0;
    const yoonseulGate = yoonseulToggleEnabled && effectDebugToggles?.yoonseulEnabled !== false ? 1 : 0;
    const benthicGate = benthicToggleEnabled && effectDebugToggles?.benthicEnabled !== false ? 1 : 0;
    const causticGate = causticsToggleEnabled && effectDebugToggles?.causticsEnabled !== false ? 1 : 0;
    const cloudReflectionToggleGate = cloudReflectionToggleEnabled && effectDebugToggles?.cloudReflectionEnabled !== false ? 1 : 0;
    const cloudReflectionComputeEnabled = cloudReflectionToggleGate > 0;
    const godRaysGate = godRaysToggleEnabled && effectDebugToggles?.godRaysEnabled !== false ? 1 : 0;
    const atmosphereGate = atmosphereToggleEnabled && effectDebugToggles?.atmosphereEnabled !== false ? 1 : 0;

    return {
        stagedBenthicGate,
        stagedCausticGate,
        stagedCloudGate,
        stagedRayGate,
        surfaceOpticsGate,
        rgbSplitGate,
        yoonseulGate,
        benthicGate,
        causticGate,
        highlightsGate: 0,
        cloudReflectionToggleGate,
        cloudReflectionComputeEnabled,
        godRaysGate,
        atmosphereGate,
    };
};
