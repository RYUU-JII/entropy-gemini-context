import {
    SAKURA_CANONICAL_LATENT_DEFS,
    SAKURA_CANONICAL_LATENT_KEYS,
    SAKURA_LEARNING_LATENT_KEYS as SAKURA_SCHEMA_LEARNING_LATENT_KEYS,
} from './SakuraLatentSchema';
import {
    SAKURA_LATENT_TIER_GROUPS,
    getSakuraLatentTierKeys,
    resolveSakuraLatentTierId,
    resolveSakuraLatentTierIndexMap,
} from './SakuraLatentTierRegistry';
import {
    DEFAULT_SAKURA_ACTIVE_LEARNING_FACTOR_KEYS,
} from './SakuraLearningFactorPolicy';

export const SAKURA_LEARNING_KEYSPACE_PROFILE = Object.freeze({
    PREFERENCE_BASIN_V1: 'preference_basin_v1',
    PREFERENCE_BASIN_V2: 'preference_basin_v2',
    FULL_65: 'full65',
    CORE_32: 'core32',
});

export const DEFAULT_SAKURA_LEARNING_KEYSPACE_PROFILE = (
    SAKURA_LEARNING_KEYSPACE_PROFILE.PREFERENCE_BASIN_V2
);

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const SAKURA_CORE32_CANDIDATE_KEYS = Object.freeze([
    // trunk
    'vigor',
    'apical_dominance',
    'trunk_base_scale',
    'taper_strength',
    'trunk_curve_amp',
    'trunk_curve_freq',
    'backbone_tilt_bias',
    'backbone_sway',
    'trunk_kink_prob',
    'trunk_kink_angle_deg',
    // scaffold
    'scaffold_global_pitch_deg',
    'scaffold_gravity_strength',
    'scaffold_wind_strength',
    'scaffold_wind_bias',
    'scaffold_density',
    'scaffold_upper_coverage',
    'scaffold_distribution_mode',
    'scaffold_shape_mode',
    'scaffold_spacing_decay',
    'scaffold_anchor_lower_bias',
    'scaffold_first_attach_ratio',
    'scaffold_length_decay',
    'scaffold_width_decay',
    'scaffold_node_twig_prob',
    'scaffold_turn_sweep_prob',
    'scaffold_turn_kink_prob',
    // twig
    'twig_length_decay',
    'twig_width_decay',
    'twig_node_budget_cap',
    'twig_upward_bias_prob',
    'ramification_density',
    // leaf
    'flower_bud_density',
]);

const sanitizeLearningKeys = (keys = []) => Array.from(new Set(
    (Array.isArray(keys) ? keys : [])
        .filter((key) => typeof key === 'string' && key.trim())
        .map((key) => key.trim())
        .filter((key) => SAKURA_CANONICAL_LATENT_KEYS.includes(key)),
));

export const SAKURA_LEARNING_LATENT_KEYS_FULL = Object.freeze(
    sanitizeLearningKeys(SAKURA_SCHEMA_LEARNING_LATENT_KEYS),
);
export const SAKURA_LEARNING_LATENT_KEYS_CORE = Object.freeze(
    sanitizeLearningKeys(SAKURA_CORE32_CANDIDATE_KEYS)
        .filter((key) => SAKURA_LEARNING_LATENT_KEYS_FULL.includes(key)),
);
export const SAKURA_LEARNING_LATENT_KEYS_PREFERENCE_BASIN_V1 = Object.freeze(
    sanitizeLearningKeys([
        'vigor',
        'apical_dominance',
        'trunk_base_scale',
        'taper_strength',
        'trunk_curve_amp',
        'trunk_curve_freq',
        'backbone_tilt_bias',
        'backbone_sway',
        'trunk_kink_prob',
        'trunk_kink_angle_deg',
        'scaffold_global_pitch_deg',
        'scaffold_gravity_strength',
        'scaffold_wind_strength',
        'scaffold_density',
        'scaffold_upper_coverage',
        'scaffold_distribution_mode',
        'scaffold_shape_mode',
        'scaffold_length_decay',
        'scaffold_width_decay',
        'scaffold_first_attach_ratio',
        'scaffold_node_twig_prob',
        'twig_length_decay',
        'twig_width_decay',
        'twig_upward_bias_prob',
        'ramification_density',
    ]).filter((key) => SAKURA_LEARNING_LATENT_KEYS_FULL.includes(key)),
);
export const SAKURA_LEARNING_LATENT_KEYS_PREFERENCE_BASIN = Object.freeze(
    sanitizeLearningKeys(DEFAULT_SAKURA_ACTIVE_LEARNING_FACTOR_KEYS)
        .filter((key) => SAKURA_LEARNING_LATENT_KEYS_FULL.includes(key)),
);

const LEARNING_KEYS_BY_PROFILE = Object.freeze({
    [SAKURA_LEARNING_KEYSPACE_PROFILE.PREFERENCE_BASIN_V1]: (
        SAKURA_LEARNING_LATENT_KEYS_PREFERENCE_BASIN_V1
    ),
    [SAKURA_LEARNING_KEYSPACE_PROFILE.PREFERENCE_BASIN_V2]: (
        SAKURA_LEARNING_LATENT_KEYS_PREFERENCE_BASIN
    ),
    [SAKURA_LEARNING_KEYSPACE_PROFILE.FULL_65]: SAKURA_LEARNING_LATENT_KEYS_FULL,
    [SAKURA_LEARNING_KEYSPACE_PROFILE.CORE_32]: SAKURA_LEARNING_LATENT_KEYS_CORE,
});

export const SAKURA_PREFERENCE_BASIN_V2_FIXED_FACTOR_KEYS = Object.freeze(
    SAKURA_CANONICAL_LATENT_KEYS.filter((key) => (
        !SAKURA_LEARNING_LATENT_KEYS_PREFERENCE_BASIN.includes(key)
    )),
);

const SAKURA_LEARNING_RANGE_OVERRIDES = Object.freeze({
    vigor: { min: 0.12, max: 0.92 },
    apical_dominance: { min: 0.12, max: 0.94 },
    trunk_base_scale: { min: 0.82, max: 1.72 },
    trunk_curve_amp: { min: 0.06, max: 0.86 },
    backbone_tilt_bias: { min: -1, max: 1 },
    backbone_sway: { min: 0.1, max: 0.9 },
    trunk_kink_prob: { min: 0, max: 0.66 },
    trunk_kink_angle_deg: { min: 0, max: 62 },
    scaffold_global_pitch_deg: { min: -26, max: 26 },
    scaffold_gravity_strength: { min: 0.12, max: 1 },
    scaffold_wind_strength: { min: 0, max: 0.72 },
    scaffold_wind_bias: { min: -0.8, max: 0.8 },
    scaffold_density: { min: 0.18, max: 0.78 },
    scaffold_upper_coverage: { min: 0.24, max: 0.9 },
    scaffold_anchor_lower_bias: { min: 0.16, max: 0.92 },
    scaffold_spacing_decay: { min: 0.94, max: 1.12 },
    scaffold_node_twig_prob: { min: 0.18, max: 0.9 },
    scaffold_turn_sweep_prob: { min: 0.08, max: 0.82 },
    scaffold_turn_kink_prob: { min: 0.02, max: 0.48 },
    scaffold_turn_sweep_amp_deg: { min: 2, max: 24 },
    scaffold_turn_sweep_freq: { min: 0.25, max: 2.4 },
    scaffold_turn_kink_angle_deg: { min: 4, max: 38 },
    scaffold_turn_noise: { min: 0.04, max: 0.56 },
    scaffold_length_decay: { min: 0.58, max: 0.9 },
    scaffold_width_decay: { min: 0.62, max: 0.9 },
    twig_length_decay: { min: 0.5, max: 0.84 },
    twig_width_decay: { min: 0.52, max: 0.8 },
    twig_node_budget_cap: { min: 10, max: 30 },
    twig_spawn_min_width: { min: 0.1, max: 0.32 },
    twig_upward_bias_prob: { min: 0.05, max: 0.78 },
    ramification_density: { min: 0.2, max: 0.86 },
    internode_scale: { min: 0.72, max: 1.28 },
    internode_cv: { min: 0.1, max: 0.42 },
    negative_space_target: { min: 0.08, max: 0.3 },
    flower_bud_density: { min: 0.2, max: 0.92 },
    flower_cluster_size: { min: 2, max: 6 },
    flower_cluster_tightness: { min: 0.2, max: 0.9 },
    petal_size_variance: { min: 0.1, max: 0.8 },
});

const SAKURA_PREFERENCE_BASIN_V1_RANGE_OVERRIDES = Object.freeze({
    backbone_tilt_bias: { min: -0.62, max: 0.62 },
    scaffold_gravity_strength: { min: 0.12, max: 0.78 },
    scaffold_first_attach_ratio: { min: 0.06, max: 0.5 },
});

const LEARNING_KEYSPACE_PROFILE_VALUES = new Set(
    Object.values(SAKURA_LEARNING_KEYSPACE_PROFILE),
);

export const resolveSakuraLearningLatentProfile = (profile = null) => (
    LEARNING_KEYSPACE_PROFILE_VALUES.has(profile)
        ? profile
        : DEFAULT_SAKURA_LEARNING_KEYSPACE_PROFILE
);

export const applySakuraPreferenceBasinFixedFactorValues = (
    latent,
    { profile = DEFAULT_SAKURA_LEARNING_KEYSPACE_PROFILE } = {},
) => {
    if (!latent || typeof latent !== 'object' || Array.isArray(latent)) {
        throw new TypeError('ZEN_SAKURA_FIXED_PREFERENCE_LATENT_OBJECT_REQUIRED');
    }
    const resolvedProfile = resolveSakuraLearningLatentProfile(profile);
    const next = { ...latent };
    if (resolvedProfile !== SAKURA_LEARNING_KEYSPACE_PROFILE.PREFERENCE_BASIN_V2) {
        return next;
    }
    SAKURA_PREFERENCE_BASIN_V2_FIXED_FACTOR_KEYS.forEach((key) => {
        const definition = SAKURA_CANONICAL_LATENT_DEFS[key];
        if (!definition || !Number.isFinite(Number(definition.default))) {
            throw new Error(`ZEN_SAKURA_FIXED_PREFERENCE_DEFAULT_REQUIRED:${key}`);
        }
        next[key] = Number(definition.default);
    });
    return next;
};

export const listSakuraLearningLatentKeys = ({
    profile = DEFAULT_SAKURA_LEARNING_KEYSPACE_PROFILE,
} = {}) => (
    [...(LEARNING_KEYS_BY_PROFILE[resolveSakuraLearningLatentProfile(profile)] || [])]
);

const buildLearningLatentDefMap = (profile = DEFAULT_SAKURA_LEARNING_KEYSPACE_PROFILE) => {
    const resolvedProfile = resolveSakuraLearningLatentProfile(profile);
    const learningSet = new Set(
        listSakuraLearningLatentKeys({ profile: resolvedProfile }),
    );
    const out = {};
    SAKURA_CANONICAL_LATENT_KEYS.forEach((key) => {
        const canonicalDef = SAKURA_CANONICAL_LATENT_DEFS[key];
        if (!canonicalDef) {
            return;
        }
        const legacyOverride = profile === SAKURA_LEARNING_KEYSPACE_PROFILE.PREFERENCE_BASIN_V1
            ? SAKURA_PREFERENCE_BASIN_V1_RANGE_OVERRIDES[key]
            : null;
        const override = learningSet.has(key)
            ? (legacyOverride || SAKURA_LEARNING_RANGE_OVERRIDES[key])
            : null;
        if (!override) {
            out[key] = { ...canonicalDef };
            return;
        }
        const min = clamp(
            Number.isFinite(override?.min) ? Number(override.min) : canonicalDef.min,
            canonicalDef.min,
            canonicalDef.max,
        );
        const max = clamp(
            Number.isFinite(override?.max) ? Number(override.max) : canonicalDef.max,
            min,
            canonicalDef.max,
        );
        const defaultValue = clamp(
            Number.isFinite(canonicalDef.default) ? Number(canonicalDef.default) : min,
            min,
            max,
        );
        out[key] = {
            ...canonicalDef,
            min,
            max,
            default: canonicalDef.integer ? Math.round(defaultValue) : defaultValue,
        };
    });
    return Object.freeze(out);
};

const LEARNING_LATENT_DEF_MAP_BY_PROFILE = Object.freeze({
    [SAKURA_LEARNING_KEYSPACE_PROFILE.PREFERENCE_BASIN_V1]: buildLearningLatentDefMap(
        SAKURA_LEARNING_KEYSPACE_PROFILE.PREFERENCE_BASIN_V1,
    ),
    [SAKURA_LEARNING_KEYSPACE_PROFILE.PREFERENCE_BASIN_V2]: buildLearningLatentDefMap(
        SAKURA_LEARNING_KEYSPACE_PROFILE.PREFERENCE_BASIN_V2,
    ),
    [SAKURA_LEARNING_KEYSPACE_PROFILE.FULL_65]: buildLearningLatentDefMap(
        SAKURA_LEARNING_KEYSPACE_PROFILE.FULL_65,
    ),
    [SAKURA_LEARNING_KEYSPACE_PROFILE.CORE_32]: buildLearningLatentDefMap(
        SAKURA_LEARNING_KEYSPACE_PROFILE.CORE_32,
    ),
});

export const resolveSakuraLearningLatentDef = (
    key = '',
    { profile = DEFAULT_SAKURA_LEARNING_KEYSPACE_PROFILE } = {},
) => {
    const resolvedProfile = resolveSakuraLearningLatentProfile(profile);
    const defMap = LEARNING_LATENT_DEF_MAP_BY_PROFILE[resolvedProfile] || {};
    const def = defMap[key];
    if (def) {
        return def;
    }
    return SAKURA_CANONICAL_LATENT_DEFS[key] || null;
};

export const clampSakuraLatentByLearningRange = (
    latent = {},
    { profile = DEFAULT_SAKURA_LEARNING_KEYSPACE_PROFILE } = {},
) => {
    const resolvedProfile = resolveSakuraLearningLatentProfile(profile);
    return SAKURA_CANONICAL_LATENT_KEYS.reduce((acc, key) => {
        const def = resolveSakuraLearningLatentDef(key, { profile: resolvedProfile })
            || SAKURA_CANONICAL_LATENT_DEFS[key];
        if (!def) {
            return acc;
        }
        const raw = Number.isFinite(Number(latent?.[key])) ? Number(latent[key]) : def.default;
        const clamped = clamp(raw, def.min, def.max);
        acc[key] = def.integer ? Math.round(clamped) : clamped;
        return acc;
    }, {});
};

export const listSakuraLearningLatentExcludedKeys = ({
    profile = DEFAULT_SAKURA_LEARNING_KEYSPACE_PROFILE,
} = {}) => {
    const learningSet = new Set(
        listSakuraLearningLatentKeys({ profile }),
    );
    return SAKURA_CANONICAL_LATENT_KEYS.filter((key) => !learningSet.has(key));
};

export const SAKURA_LEARNING_LATENT_KEYS = Object.freeze(
    listSakuraLearningLatentKeys(),
);
export const SAKURA_LEARNING_LATENT_EXCLUDED_KEYS = Object.freeze(
    listSakuraLearningLatentExcludedKeys(),
);

export {
    SAKURA_CANONICAL_LATENT_DEFS,
    SAKURA_CANONICAL_LATENT_KEYS,
    SAKURA_LATENT_TIER_GROUPS,
    getSakuraLatentTierKeys,
    resolveSakuraLatentTierId,
    resolveSakuraLatentTierIndexMap,
};

export const listSakuraLatentKeys = ({
    learningOnly = false,
    learningProfile = DEFAULT_SAKURA_LEARNING_KEYSPACE_PROFILE,
} = {}) => (
    learningOnly
        ? listSakuraLearningLatentKeys({ profile: learningProfile })
        : [...SAKURA_CANONICAL_LATENT_KEYS]
);

export const listSakuraLatentKeysByTier = ({
    tierId = 'misc',
    learningOnly = false,
    learningProfile = DEFAULT_SAKURA_LEARNING_KEYSPACE_PROFILE,
} = {}) => {
    const tierKeys = getSakuraLatentTierKeys(tierId);
    if (!learningOnly) {
        return tierKeys;
    }
    const learningSet = new Set(
        listSakuraLearningLatentKeys({ profile: learningProfile }),
    );
    return tierKeys.filter((key) => learningSet.has(key));
};

export const reduceSakuraLatentParams = ({
    latent = {},
    learningOnly = false,
    learningProfile = DEFAULT_SAKURA_LEARNING_KEYSPACE_PROFILE,
    reducer,
    initialValue,
} = {}) => {
    const keys = listSakuraLatentKeys({
        learningOnly,
        learningProfile,
    });
    if (typeof reducer !== 'function') {
        return initialValue;
    }
    return keys.reduce(
        (acc, key, index) => reducer(acc, {
            key,
            value: latent?.[key],
            def: SAKURA_CANONICAL_LATENT_DEFS[key],
            index,
            tierId: resolveSakuraLatentTierId(key),
        }),
        initialValue,
    );
};
