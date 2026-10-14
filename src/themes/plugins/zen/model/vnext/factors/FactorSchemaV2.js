import {
    VNEXT_FACTOR_OWNER,
    VNEXT_FACTOR_TRANSFORM,
} from './FactorSchemaV1';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const isFiniteNumber = (value) => Number.isFinite(Number(value));

const averageDefined = (...values) => {
    const defined = values.filter((value) => isFiniteNumber(value));
    if (!defined.length) {
        return null;
    }
    return defined.reduce((acc, value) => acc + Number(value), 0) / defined.length;
};

const readNumeric = (vector = {}, key = '') => (
    isFiniteNumber(vector?.[key]) ? Number(vector[key]) : null
);

export const VNEXT_FACTOR_VERSION_V2 = 2;

export const VNEXT_FACTOR_SCHEMA_V2 = Object.freeze({
    trunk_division: {
        min: 0,
        max: 1,
        default: 0.12,
        group: 'trunk',
        owner: VNEXT_FACTOR_OWNER.TRUNK_POLICY,
        transform: VNEXT_FACTOR_TRANSFORM.SIGMOID,
    },
    trunk_lean: {
        min: 0,
        max: 1,
        default: 0.5,
        group: 'trunk',
        owner: VNEXT_FACTOR_OWNER.TRUNK_POLICY,
        transform: VNEXT_FACTOR_TRANSFORM.CENTERED_LINEAR,
    },
    trunk_movement: {
        min: 0,
        max: 1,
        default: 0.56,
        group: 'trunk',
        owner: VNEXT_FACTOR_OWNER.TRUNK_POLICY,
        transform: VNEXT_FACTOR_TRANSFORM.SIGMOID,
    },
    trunk_primary_sweep: {
        min: 0,
        max: 1,
        default: 0.58,
        group: 'trunk',
        owner: VNEXT_FACTOR_OWNER.TRUNK_POLICY,
        transform: VNEXT_FACTOR_TRANSFORM.LINEAR,
    },
    trunk_counter_sweep: {
        min: 0,
        max: 1,
        default: 0.42,
        group: 'trunk',
        owner: VNEXT_FACTOR_OWNER.TRUNK_POLICY,
        transform: VNEXT_FACTOR_TRANSFORM.LINEAR,
    },
    trunk_apex_reach: {
        min: 0,
        max: 1,
        default: 0.46,
        group: 'trunk',
        owner: VNEXT_FACTOR_OWNER.TRUNK_POLICY,
        transform: VNEXT_FACTOR_TRANSFORM.LINEAR,
    },
    trunk_void_respect: {
        min: 0,
        max: 1,
        default: 0.56,
        group: 'trunk',
        owner: VNEXT_FACTOR_OWNER.TRUNK_POLICY,
        transform: VNEXT_FACTOR_TRANSFORM.LINEAR,
    },
    trunk_taper: {
        min: 0,
        max: 1,
        default: 0.66,
        group: 'trunk',
        owner: VNEXT_FACTOR_OWNER.TRUNK_POLICY,
        transform: VNEXT_FACTOR_TRANSFORM.LINEAR,
    },
    trunk_height: {
        min: 0,
        max: 1,
        default: 0.6,
        group: 'trunk',
        owner: VNEXT_FACTOR_OWNER.TRUNK_POLICY,
        transform: VNEXT_FACTOR_TRANSFORM.LINEAR,
    },
    first_branch_height: {
        min: 0,
        max: 1,
        default: 0.44,
        group: 'trunk',
        owner: VNEXT_FACTOR_OWNER.TRUNK_POLICY,
        transform: VNEXT_FACTOR_TRANSFORM.LINEAR,
    },
    apex_softness: {
        min: 0,
        max: 1,
        default: 0.42,
        group: 'trunk',
        owner: VNEXT_FACTOR_OWNER.TRUNK_POLICY,
        transform: VNEXT_FACTOR_TRANSFORM.LINEAR,
    },
    branch_density: {
        min: 0,
        max: 1,
        default: 0.52,
        group: 'branch',
        owner: VNEXT_FACTOR_OWNER.BRANCH_POLICY,
        transform: VNEXT_FACTOR_TRANSFORM.SIGMOID,
    },
    branch_spread: {
        min: 0,
        max: 1,
        default: 0.54,
        group: 'branch',
        owner: VNEXT_FACTOR_OWNER.BRANCH_POLICY,
        transform: VNEXT_FACTOR_TRANSFORM.LINEAR,
    },
    lineage_sweep_persistence: {
        min: 0,
        max: 1,
        default: 0.62,
        group: 'branch',
        owner: VNEXT_FACTOR_OWNER.BRANCH_POLICY,
        transform: VNEXT_FACTOR_TRANSFORM.LINEAR,
    },
    lineage_recovery_bias: {
        min: 0,
        max: 1,
        default: 0.64,
        group: 'branch',
        owner: VNEXT_FACTOR_OWNER.BRANCH_POLICY,
        transform: VNEXT_FACTOR_TRANSFORM.LINEAR,
    },
    pad_compactness: {
        min: 0,
        max: 1,
        default: 0.58,
        group: 'branch',
        owner: VNEXT_FACTOR_OWNER.BRANCH_POLICY,
        transform: VNEXT_FACTOR_TRANSFORM.LINEAR,
    },
    pad_terminal_density: {
        min: 0,
        max: 1,
        default: 0.66,
        group: 'branch',
        owner: VNEXT_FACTOR_OWNER.BRANCH_POLICY,
        transform: VNEXT_FACTOR_TRANSFORM.LINEAR,
    },
    pad_sweep_bias: {
        min: 0,
        max: 1,
        default: 0.58,
        group: 'branch',
        owner: VNEXT_FACTOR_OWNER.BRANCH_POLICY,
        transform: VNEXT_FACTOR_TRANSFORM.LINEAR,
    },
    ramification: {
        min: 0,
        max: 1,
        default: 0.56,
        group: 'branch',
        owner: VNEXT_FACTOR_OWNER.BRANCH_POLICY,
        transform: VNEXT_FACTOR_TRANSFORM.LINEAR,
    },
    crown_openness: {
        min: 0,
        max: 1,
        default: 0.58,
        group: 'field',
        owner: VNEXT_FACTOR_OWNER.FIELD_POLICY,
        transform: VNEXT_FACTOR_TRANSFORM.LINEAR,
    },
    droop_bias: {
        min: 0,
        max: 1,
        default: 0.26,
        group: 'style',
        owner: VNEXT_FACTOR_OWNER.FIELD_POLICY,
        transform: VNEXT_FACTOR_TRANSFORM.LINEAR,
    },
    blossom_bias: {
        min: 0,
        max: 1,
        default: 0.64,
        group: 'season',
        owner: VNEXT_FACTOR_OWNER.FIELD_POLICY,
        transform: VNEXT_FACTOR_TRANSFORM.SIGMOID,
    },
});

export const VNEXT_FACTOR_KEYS_V2 = Object.freeze(
    Object.keys(VNEXT_FACTOR_SCHEMA_V2),
);

export const getDefaultFactorVectorV2 = () => (
    VNEXT_FACTOR_KEYS_V2.reduce((acc, key) => {
        acc[key] = VNEXT_FACTOR_SCHEMA_V2[key].default;
        return acc;
    }, {})
);

export const normalizeFactorValueV2 = (key, value) => {
    const def = VNEXT_FACTOR_SCHEMA_V2[key];
    if (!def) {
        return 0;
    }
    const numeric = isFiniteNumber(value) ? Number(value) : def.default;
    return clamp(numeric, def.min, def.max);
};

export const normalizeFactorVectorV2 = (vector = {}) => (
    VNEXT_FACTOR_KEYS_V2.reduce((acc, key) => {
        acc[key] = normalizeFactorValueV2(key, vector?.[key]);
        return acc;
    }, {})
);

export const getFactorSchemaDefV2 = (key = '') => (
    VNEXT_FACTOR_SCHEMA_V2[key] || null
);
