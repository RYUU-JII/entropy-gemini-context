const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const VNEXT_FACTOR_VERSION = 1;

export const VNEXT_FACTOR_OWNER = Object.freeze({
    TRUNK_POLICY: 'trunkPolicy',
    BRANCH_POLICY: 'branchPolicy',
    FIELD_POLICY: 'fieldPolicy',
    PRUNE_POLICY: 'prunePolicy',
    AGING_POLICY: 'agingPolicy',
});

export const VNEXT_FACTOR_TRANSFORM = Object.freeze({
    LINEAR: 'linear',
    CENTERED_LINEAR: 'centered_linear',
    SIGMOID: 'sigmoid',
    PIECEWISE: 'piecewise',
    STEP: 'step',
});

export const VNEXT_FACTOR_SCHEMA_V1 = Object.freeze({
    trunk_count: {
        min: 1,
        max: 4,
        default: 1,
        integer: true,
        group: 'trunk',
        owner: VNEXT_FACTOR_OWNER.TRUNK_POLICY,
        transform: VNEXT_FACTOR_TRANSFORM.STEP,
    },
    trunk_lean: {
        min: 0,
        max: 1,
        default: 0.5,
        group: 'trunk',
        owner: VNEXT_FACTOR_OWNER.TRUNK_POLICY,
        transform: VNEXT_FACTOR_TRANSFORM.CENTERED_LINEAR,
    },
    trunk_curve_energy: {
        min: 0,
        max: 1,
        default: 0.42,
        group: 'trunk',
        owner: VNEXT_FACTOR_OWNER.TRUNK_POLICY,
        transform: VNEXT_FACTOR_TRANSFORM.SIGMOID,
    },
    trunk_taper_strength: {
        min: 0,
        max: 1,
        default: 0.62,
        group: 'trunk',
        owner: VNEXT_FACTOR_OWNER.TRUNK_POLICY,
        transform: VNEXT_FACTOR_TRANSFORM.LINEAR,
    },
    trunk_apex_substitution_rate: {
        min: 0,
        max: 1,
        default: 0.2,
        group: 'trunk',
        owner: VNEXT_FACTOR_OWNER.TRUNK_POLICY,
        transform: VNEXT_FACTOR_TRANSFORM.LINEAR,
    },
    trunk_split_bias: {
        min: 0,
        max: 1,
        default: 0.22,
        group: 'trunk',
        owner: VNEXT_FACTOR_OWNER.TRUNK_POLICY,
        transform: VNEXT_FACTOR_TRANSFORM.LINEAR,
    },
    trunk_height_bias: {
        min: 0,
        max: 1,
        default: 0.58,
        group: 'trunk',
        owner: VNEXT_FACTOR_OWNER.TRUNK_POLICY,
        transform: VNEXT_FACTOR_TRANSFORM.LINEAR,
    },
    first_split_height_ratio: {
        min: 0,
        max: 1,
        default: 0.42,
        group: 'trunk',
        owner: VNEXT_FACTOR_OWNER.TRUNK_POLICY,
        transform: VNEXT_FACTOR_TRANSFORM.LINEAR,
    },
    trunk_base_spread: {
        min: 0,
        max: 1,
        default: 0.28,
        group: 'trunk',
        owner: VNEXT_FACTOR_OWNER.TRUNK_POLICY,
        transform: VNEXT_FACTOR_TRANSFORM.LINEAR,
    },
    branch_density: {
        min: 0,
        max: 1,
        default: 0.54,
        group: 'branch',
        owner: VNEXT_FACTOR_OWNER.BRANCH_POLICY,
        transform: VNEXT_FACTOR_TRANSFORM.SIGMOID,
    },
    branch_angle_mean: {
        min: 0,
        max: 1,
        default: 0.52,
        group: 'branch',
        owner: VNEXT_FACTOR_OWNER.BRANCH_POLICY,
        transform: VNEXT_FACTOR_TRANSFORM.LINEAR,
    },
    branch_angle_var: {
        min: 0,
        max: 1,
        default: 0.4,
        group: 'branch',
        owner: VNEXT_FACTOR_OWNER.BRANCH_POLICY,
        transform: VNEXT_FACTOR_TRANSFORM.LINEAR,
    },
    branch_depth_budget: {
        min: 0,
        max: 1,
        default: 0.56,
        group: 'branch',
        owner: VNEXT_FACTOR_OWNER.BRANCH_POLICY,
        transform: VNEXT_FACTOR_TRANSFORM.LINEAR,
    },
    branch_length_decay: {
        min: 0,
        max: 1,
        default: 0.62,
        group: 'branch',
        owner: VNEXT_FACTOR_OWNER.BRANCH_POLICY,
        transform: VNEXT_FACTOR_TRANSFORM.LINEAR,
    },
    branch_radius_decay: {
        min: 0,
        max: 1,
        default: 0.68,
        group: 'branch',
        owner: VNEXT_FACTOR_OWNER.BRANCH_POLICY,
        transform: VNEXT_FACTOR_TRANSFORM.LINEAR,
    },
    apical_dominance: {
        min: 0,
        max: 1,
        default: 0.64,
        group: 'branch',
        owner: VNEXT_FACTOR_OWNER.BRANCH_POLICY,
        transform: VNEXT_FACTOR_TRANSFORM.SIGMOID,
    },
    alternation_bias: {
        min: 0,
        max: 1,
        default: 0.5,
        group: 'branch',
        owner: VNEXT_FACTOR_OWNER.BRANCH_POLICY,
        transform: VNEXT_FACTOR_TRANSFORM.CENTERED_LINEAR,
    },
    phototropism_gain: {
        min: 0,
        max: 1,
        default: 0.52,
        group: 'field',
        owner: VNEXT_FACTOR_OWNER.FIELD_POLICY,
        transform: VNEXT_FACTOR_TRANSFORM.LINEAR,
    },
    space_avoid_gain: {
        min: 0,
        max: 1,
        default: 0.6,
        group: 'field',
        owner: VNEXT_FACTOR_OWNER.FIELD_POLICY,
        transform: VNEXT_FACTOR_TRANSFORM.LINEAR,
    },
    collision_prune_gain: {
        min: 0,
        max: 1,
        default: 0.48,
        group: 'field',
        owner: VNEXT_FACTOR_OWNER.PRUNE_POLICY,
        transform: VNEXT_FACTOR_TRANSFORM.LINEAR,
    },
    pad_separation_target: {
        min: 0,
        max: 1,
        default: 0.58,
        group: 'field',
        owner: VNEXT_FACTOR_OWNER.FIELD_POLICY,
        transform: VNEXT_FACTOR_TRANSFORM.LINEAR,
    },
    negative_space_target: {
        min: 0,
        max: 1,
        default: 0.44,
        group: 'field',
        owner: VNEXT_FACTOR_OWNER.FIELD_POLICY,
        transform: VNEXT_FACTOR_TRANSFORM.LINEAR,
    },
    canopy_envelope_bias: {
        min: 0,
        max: 1,
        default: 0.5,
        group: 'field',
        owner: VNEXT_FACTOR_OWNER.FIELD_POLICY,
        transform: VNEXT_FACTOR_TRANSFORM.CENTERED_LINEAR,
    },
    mass_balance_gain: {
        min: 0,
        max: 1,
        default: 0.52,
        group: 'field',
        owner: VNEXT_FACTOR_OWNER.FIELD_POLICY,
        transform: VNEXT_FACTOR_TRANSFORM.LINEAR,
    },
    cascade_bias: {
        min: 0,
        max: 1,
        default: 0.26,
        group: 'style',
        owner: VNEXT_FACTOR_OWNER.FIELD_POLICY,
        transform: VNEXT_FACTOR_TRANSFORM.LINEAR,
    },
    windswept_bias: {
        min: 0,
        max: 1,
        default: 0.24,
        group: 'style',
        owner: VNEXT_FACTOR_OWNER.FIELD_POLICY,
        transform: VNEXT_FACTOR_TRANSFORM.CENTERED_LINEAR,
    },
    jin_rate: {
        min: 0,
        max: 1,
        default: 0.08,
        group: 'aging',
        owner: VNEXT_FACTOR_OWNER.AGING_POLICY,
        transform: VNEXT_FACTOR_TRANSFORM.LINEAR,
    },
    shari_rate: {
        min: 0,
        max: 1,
        default: 0.06,
        group: 'aging',
        owner: VNEXT_FACTOR_OWNER.AGING_POLICY,
        transform: VNEXT_FACTOR_TRANSFORM.LINEAR,
    },
    deadwood_persistence: {
        min: 0,
        max: 1,
        default: 0.48,
        group: 'aging',
        owner: VNEXT_FACTOR_OWNER.AGING_POLICY,
        transform: VNEXT_FACTOR_TRANSFORM.SIGMOID,
    },
});

export const VNEXT_FACTOR_KEYS_V1 = Object.freeze(
    Object.keys(VNEXT_FACTOR_SCHEMA_V1),
);

export const getDefaultFactorVectorV1 = () => (
    VNEXT_FACTOR_KEYS_V1.reduce((acc, key) => {
        acc[key] = VNEXT_FACTOR_SCHEMA_V1[key].default;
        return acc;
    }, {})
);

export const normalizeFactorValueV1 = (key, value) => {
    const def = VNEXT_FACTOR_SCHEMA_V1[key];
    if (!def) {
        return 0;
    }
    const numeric = Number.isFinite(Number(value)) ? Number(value) : def.default;
    const clamped = clamp(numeric, def.min, def.max);
    return def.integer ? Math.round(clamped) : clamped;
};

export const normalizeFactorVectorV1 = (vector = {}) => (
    VNEXT_FACTOR_KEYS_V1.reduce((acc, key) => {
        acc[key] = normalizeFactorValueV1(key, vector?.[key]);
        return acc;
    }, {})
);

export const getFactorSchemaDefV1 = (key = '') => (
    VNEXT_FACTOR_SCHEMA_V1[key] || null
);
