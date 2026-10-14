// Elevation uses logical world pixels, positive up, with the water at Z=0.
// Bathymetry and fish depth stay normalized in their canonical owners; this is
// their single presentation conversion, independent of viewport and DPR.
export const ZEN_POND_SHADOW_DEPTH_WORLD_UNITS = 48;
export const ZEN_POND_SHADOW_HEIGHT_MODEL_ID = 'support_relative_height_v1';

const requireDepth = (value, name) => {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
        throw new Error(`ZEN_POND_SHADOW_DEPTH_INVALID:${name}`);
    }
    return value;
};

export const resolveZenPondShadowGeometry = ({ kind, size, bottomDepth, sourceDepth }) => {
    if (!Number.isFinite(size) || size <= 0) throw new Error('ZEN_POND_SHADOW_SIZE_INVALID');
    let supportZ;
    let bodyBaseZ;
    let bodyTopZ;
    let receiverZ;
    let grounded = false;
    if (kind === 'rock') {
        receiverZ = -requireDepth(bottomDepth, 'bottom') * ZEN_POND_SHADOW_DEPTH_WORLD_UNITS;
        supportZ = receiverZ;
        bodyBaseZ = receiverZ;
        bodyTopZ = bodyBaseZ + size * 0.32;
        grounded = true;
    } else if (kind === 'lily') {
        supportZ = 0;
        bodyBaseZ = 0;
        bodyTopZ = Math.min(1.8, size * 0.025);
        receiverZ = 0;
    } else if (kind === 'flower') {
        supportZ = 0;
        bodyBaseZ = size * 0.04;
        bodyTopZ = size * 0.22;
        receiverZ = 0;
    } else if (kind === 'koi') {
        receiverZ = -requireDepth(bottomDepth, 'bottom') * ZEN_POND_SHADOW_DEPTH_WORLD_UNITS;
        bodyBaseZ = -requireDepth(sourceDepth, 'source') * ZEN_POND_SHADOW_DEPTH_WORLD_UNITS;
        if (bodyBaseZ < receiverZ) throw new Error('ZEN_POND_SHADOW_RECEIVER_ABOVE_KOI');
        supportZ = bodyBaseZ;
        bodyTopZ = bodyBaseZ;
    } else {
        throw new Error(`ZEN_POND_SHADOW_KIND_UNSUPPORTED:${String(kind)}`);
    }
    return Object.freeze({
        modelId: ZEN_POND_SHADOW_HEIGHT_MODEL_ID,
        kind, supportZ, bodyBaseZ, bodyTopZ, receiverZ, grounded,
        heightAboveReceiver: bodyTopZ - receiverZ,
    });
};
