import {
    ZEN_POND_CANOPY_DIRECT_OCCLUSION,
    ZEN_POND_CANOPY_SKY_OCCLUSION,
} from '../../../../contracts/zenPondCanopyMaterial.js';

export const resolveZenCanopyLightTransfer = (shadowLight) => {
    if (!shadowLight || !Array.isArray(shadowLight.directShare) || !Array.isArray(shadowLight.skyShare)) {
        throw new Error('ZEN_CANOPY_SHADOW_LIGHT_REQUIRED');
    }
    return {
        shadowLight,
        directShare: shadowLight.directShare.map((value) => value * ZEN_POND_CANOPY_DIRECT_OCCLUSION),
        skyShare: shadowLight.skyShare.map((value) => value * ZEN_POND_CANOPY_SKY_OCCLUSION),
    };
};

// CPU contract oracle for the compact shader's light-budget calculation.
export const sampleZenCanopyLightTransfer = ({
    directShare,
    skyShare,
    directOcclusion,
    skyOcclusion,
}) => directShare.map((beam, index) => (
    1 - beam * directOcclusion - skyShare[index] * skyOcclusion
));
