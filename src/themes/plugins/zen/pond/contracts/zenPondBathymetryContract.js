export const ZEN_POND_BATHYMETRY_FIELD_CONTRACT_ID =
    'zen_pond_bathymetry_field_v1';
export const ZEN_POND_BATHYMETRY_FIELD_VERSION = 1;
export const ZEN_POND_BATHYMETRY_MODEL_ID =
    'natural_navigable_basin_v1';
export const ZEN_POND_BATHYMETRY_DEPTH_SEMANTIC =
    'zero_surface_positive_bottom';
export const ZEN_POND_BATHYMETRY_FIELD_STORAGE = 'uint16_normalized';
export const ZEN_POND_BATHYMETRY_NAVIGABLE_DEPTH_FLOOR = 0.78;
export const ZEN_POND_BATHYMETRY_GRID_DEFAULTS = Object.freeze({
    columns: 48,
    rows: 32,
});

export const ZEN_POND_BATHYMETRY_FIELD_CONTRACT = Object.freeze({
    id: ZEN_POND_BATHYMETRY_FIELD_CONTRACT_ID,
    version: ZEN_POND_BATHYMETRY_FIELD_VERSION,
    modelId: ZEN_POND_BATHYMETRY_MODEL_ID,
    depthSemantic: ZEN_POND_BATHYMETRY_DEPTH_SEMANTIC,
    storage: ZEN_POND_BATHYMETRY_FIELD_STORAGE,
    navigableDepthFloor:
        ZEN_POND_BATHYMETRY_NAVIGABLE_DEPTH_FLOOR,
    gridDefaults: ZEN_POND_BATHYMETRY_GRID_DEFAULTS,
});

const requireRecord = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('ZEN_POND_BATHYMETRY_FIELD_TYPE_INVALID');
    }
    return value;
};

const requireExactValue = (value, expected, errorCode) => {
    if (value !== expected) {
        throw new Error(`${errorCode}:${String(value)}`);
    }
};

const requirePositiveFiniteNumber = (value, errorCode) => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
        throw new Error(errorCode);
    }
};

const requireGridDimension = (value, errorCode) => {
    if (!Number.isSafeInteger(value) || value < 2 || value > 1024) {
        throw new Error(errorCode);
    }
};

const requireNonEmptyString = (value, errorCode) => {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new Error(errorCode);
    }
};

export const readZenPondBathymetryFieldContract = (
    value,
    { required = false } = {},
) => {
    if (value === null || value === undefined) {
        if (required === true) {
            throw new Error('ZEN_POND_BATHYMETRY_FIELD_MISSING');
        }
        return null;
    }

    const field = requireRecord(value);
    requireExactValue(
        field.contractId,
        ZEN_POND_BATHYMETRY_FIELD_CONTRACT_ID,
        'ZEN_POND_BATHYMETRY_FIELD_CONTRACT_UNSUPPORTED',
    );
    requireExactValue(
        field.version,
        ZEN_POND_BATHYMETRY_FIELD_VERSION,
        'ZEN_POND_BATHYMETRY_FIELD_VERSION_UNSUPPORTED',
    );
    requireExactValue(
        field.modelId,
        ZEN_POND_BATHYMETRY_MODEL_ID,
        'ZEN_POND_BATHYMETRY_FIELD_MODEL_UNSUPPORTED',
    );
    requireExactValue(
        field.depthSemantic,
        ZEN_POND_BATHYMETRY_DEPTH_SEMANTIC,
        'ZEN_POND_BATHYMETRY_FIELD_DEPTH_SEMANTIC_UNSUPPORTED',
    );
    requireExactValue(
        field.storage,
        ZEN_POND_BATHYMETRY_FIELD_STORAGE,
        'ZEN_POND_BATHYMETRY_FIELD_STORAGE_UNSUPPORTED',
    );

    requirePositiveFiniteNumber(
        field.worldWidth,
        'ZEN_POND_BATHYMETRY_FIELD_WORLD_WIDTH_INVALID',
    );
    requirePositiveFiniteNumber(
        field.worldHeight,
        'ZEN_POND_BATHYMETRY_FIELD_WORLD_HEIGHT_INVALID',
    );
    requireGridDimension(
        field.columns,
        'ZEN_POND_BATHYMETRY_FIELD_COLUMNS_INVALID',
    );
    requireGridDimension(
        field.rows,
        'ZEN_POND_BATHYMETRY_FIELD_ROWS_INVALID',
    );

    if (field.sampleCount !== field.columns * field.rows) {
        throw new Error('ZEN_POND_BATHYMETRY_FIELD_SAMPLE_COUNT_INVALID');
    }
    requireNonEmptyString(
        field.key,
        'ZEN_POND_BATHYMETRY_FIELD_KEY_INVALID',
    );
    if (
        typeof field.fingerprint !== 'string'
        || !/^fnv1a32:[0-9a-f]{8}$/.test(field.fingerprint)
    ) {
        throw new Error('ZEN_POND_BATHYMETRY_FIELD_FINGERPRINT_INVALID');
    }
    if (
        typeof field.minDepth !== 'number'
        || !Number.isFinite(field.minDepth)
        || field.minDepth
            < ZEN_POND_BATHYMETRY_NAVIGABLE_DEPTH_FLOOR
        || field.minDepth > 1
    ) {
        throw new Error('ZEN_POND_BATHYMETRY_FIELD_MIN_DEPTH_INVALID');
    }
    if (
        typeof field.maxDepth !== 'number'
        || !Number.isFinite(field.maxDepth)
        || field.maxDepth < field.minDepth
        || field.maxDepth > 1
    ) {
        throw new Error('ZEN_POND_BATHYMETRY_FIELD_MAX_DEPTH_INVALID');
    }

    return field;
};

export const validateZenPondBathymetryFieldContract = (value) =>
    readZenPondBathymetryFieldContract(value, { required: true });
