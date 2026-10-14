export const ZEN_POND_BENTHIC_MATERIAL_OWNER_ID =
    'water_effects_single_owner_v1';

export const ZEN_POND_BENTHIC_PRIMARY_ALPHA_SCALE = 0.72;
export const ZEN_POND_BENTHIC_DETAIL_ALPHA_SCALE = 0.62;
export const ZEN_POND_BENTHIC_SOURCE_SPRITE_COUNT = 2;

export const readZenPondBenthicMaterialOwnerId = (
    value,
    { required = false } = {},
) => {
    if (value === null || value === undefined) {
        if (required === true) {
            throw new Error('ZEN_POND_BENTHIC_MATERIAL_OWNER_ID_MISSING');
        }
        return null;
    }
    if (typeof value !== 'string') {
        throw new Error('ZEN_POND_BENTHIC_MATERIAL_OWNER_ID_TYPE_INVALID');
    }
    if (value !== ZEN_POND_BENTHIC_MATERIAL_OWNER_ID) {
        throw new Error(
            `ZEN_POND_BENTHIC_MATERIAL_OWNER_ID_UNSUPPORTED:${value}`,
        );
    }
    return value;
};
