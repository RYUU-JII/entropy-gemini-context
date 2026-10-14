const unit = (value, name) => {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
        throw new Error(`ZEN_KOI_WATER_MATERIAL_INVALID:${name}`);
    }
    return value;
};

export const ZEN_KOI_SILHOUETTE_WATER_MATERIAL = Object.freeze({
    haze: 0, pigmentGain: 1, shadowTransmission: 1, shadowSoftness: 0,
});

// View travel to the fish and light travel from fish to bottom are distinct.
// These are presentation coefficients; canonical depth/bathymetry stay intact.
export const resolveZenKoiWaterMaterial = ({ depth, bottomDepth, turbidity, submergedSunZ }) => {
    unit(depth, 'depth'); unit(bottomDepth, 'bottomDepth'); unit(turbidity, 'turbidity');
    unit(submergedSunZ, 'submergedSunZ');
    if (bottomDepth < depth) throw new Error('ZEN_KOI_WATER_RECEIVER_ABOVE_SOURCE');
    const gap = bottomDepth - depth;
    const viewTransmission = Math.exp(-depth * (0.18 + turbidity * 1.4));
    return {
        haze: 1 - viewTransmission,
        pigmentGain: 0.8 + 0.2 * viewTransmission,
        shadowTransmission: Math.exp(-gap * (0.16 + turbidity * 1.3) / Math.max(0.3, submergedSunZ)),
        shadowSoftness: gap * turbidity * 2.4,
    };
};

export const tintZenKoiWaterMaterial = (tint, gain) => {
    unit(gain, 'pigmentGain');
    if (!Number.isInteger(tint) || tint < 0 || tint > 0xffffff) throw new Error('ZEN_KOI_WATER_TINT_INVALID');
    return (Math.round(((tint >> 16) & 255) * gain) << 16)
    | (Math.round(((tint >> 8) & 255) * gain) << 8)
    | Math.round((tint & 255) * gain);
};
