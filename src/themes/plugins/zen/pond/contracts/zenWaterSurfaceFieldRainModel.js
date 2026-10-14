export const ZEN_WATER_SURFACE_FIELD_RAIN_MODEL_ID = 'energy_efficient_v1';

export const readZenWaterSurfaceFieldRainModelId = (
    value,
    { required = false } = {},
) => {
    if (value === null || value === undefined) {
        if (required === true) {
            throw new Error('ZEN_WATER_SURFACE_FIELD_RAIN_MODEL_ID_MISSING');
        }
        return null;
    }
    if (typeof value !== 'string') {
        throw new Error('ZEN_WATER_SURFACE_FIELD_RAIN_MODEL_ID_TYPE_INVALID');
    }
    if (value !== ZEN_WATER_SURFACE_FIELD_RAIN_MODEL_ID) {
        throw new Error(`ZEN_WATER_SURFACE_FIELD_RAIN_MODEL_ID_UNSUPPORTED:${value}`);
    }
    return value;
};
