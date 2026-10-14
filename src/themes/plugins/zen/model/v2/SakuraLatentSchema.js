import {
    SAKURA_TRUNK_GEMINI_LATENT_DEFS,
    SAKURA_TRUNK_GEMINI_LEARNING_EXCLUDED_KEYS,
} from '../sakura/sakuraTrunkGeminiParams';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const clamp01 = (value) => clamp(value, 0, 1);
const isPlainObject = (value) => (
    value && typeof value === 'object' && !Array.isArray(value)
);

export const SAKURA_V2_LATENT_VERSION = 1;

export const SAKURA_CANONICAL_LATENT_DEFS = {
    vigor: { min: 0, max: 1, default: 0.55 },
    apical_dominance: { min: 0, max: 1, default: 0.62 },
    trunk_base_scale: { min: 0.7, max: 2.0, default: 1.15 },
    taper_strength: { min: 0.4, max: 1.4, default: 0.86 },
    trunk_curve_amp: { min: 0, max: 1, default: 0.42 },
    trunk_curve_freq: { min: 0.3, max: 1.8, default: 0.86 },
    backbone_tilt_bias: { min: -1, max: 1, default: 0 },
    backbone_sway: { min: 0, max: 1, default: 0.52 },
    backbone_lock: { min: 0, max: 1, default: 0.62 },
    trunk_style_mode: { min: 0, max: 1, default: 0.34 },
    trunk_kink_prob: { min: 0, max: 1, default: 0.18 },
    trunk_kink_angle_deg: { min: 0, max: 85, default: 26 },
    trunk_cont_step_cap_deg: { min: 2, max: 24, default: 7.35 },
    trunk_cont_micro_cap_deg: { min: 0, max: 12, default: 1.26 },
    trunk_length_decay: { min: 0.65, max: 0.96, default: 0.84 },
    trunk_width_decay: { min: 0.72, max: 0.98, default: 0.92 },
    ...SAKURA_TRUNK_GEMINI_LATENT_DEFS,
    scaffold_global_pitch_deg: { min: -40, max: 40, default: 0 },
    scaffold_local_weight: { min: 0, max: 1, default: 0.2 },
    scaffold_gravity_strength: { min: 0, max: 1, default: 0.34 },
    scaffold_wind_strength: { min: 0, max: 1, default: 0.12 },
    scaffold_wind_bias: { min: -1, max: 1, default: 0 },
    scaffold_density: { min: 0, max: 1, default: 0.42 },
    scaffold_upper_coverage: { min: 0, max: 1, default: 0.58 },
    scaffold_distribution_mode: { min: 0, max: 1, default: 0.5 },
    scaffold_shape_mode: { min: 0, max: 1, default: 0.5 },
    scaffold_length_decay: { min: 0.5, max: 0.94, default: 0.74 },
    scaffold_width_decay: { min: 0.55, max: 0.92, default: 0.8 },
    scaffold_thick_branch_prob: { min: 0, max: 1, default: 0.16 },
    scaffold_first_attach_ratio: { min: 0.06, max: 0.9, default: 0.16 },
    scaffold_anchor_lower_bias: { min: 0, max: 1, default: 0.58 },
    scaffold_spacing_decay: { min: 0.92, max: 1.2, default: 1.03 },
    scaffold_node_twig_prob: { min: 0.08, max: 0.98, default: 0.72 },
    scaffold_turn_straight_bias: { min: 0, max: 1, default: 0.58 },
    scaffold_turn_sweep_prob: { min: 0, max: 1, default: 0.28 },
    scaffold_turn_kink_prob: { min: 0, max: 1, default: 0.12 },
    scaffold_turn_sweep_amp_deg: { min: 0, max: 32, default: 11 },
    scaffold_turn_sweep_freq: { min: 0.1, max: 3.2, default: 0.9 },
    scaffold_turn_kink_angle_deg: { min: 2, max: 48, default: 20 },
    scaffold_turn_recovery: { min: 0, max: 1, default: 0.56 },
    scaffold_turn_persistence: { min: 0, max: 1, default: 0.58 },
    scaffold_turn_noise: { min: 0, max: 1, default: 0.24 },
    scaffold_turn_depth_damping: { min: 0, max: 1, default: 0.46 },
    twig_style_mode: { min: 0, max: 1, default: 0.48 },
    twig_length_decay: { min: 0.42, max: 0.88, default: 0.64 },
    twig_width_decay: { min: 0.45, max: 0.85, default: 0.68 },
    twig_node_budget_cap: { min: 6, max: 40, default: 20, integer: true },
    twig_spawn_min_width: { min: 0.08, max: 0.6, default: 0.14 },
    primary_angle_mean_deg: { min: 20, max: 75, default: 46 },
    branch_angle_sd_deg: { min: 5, max: 35, default: 16 },
    twig_upward_bias_prob: { min: 0, max: 1, default: 0.22 },
    max_relative_bend_deg: { min: 70, max: 130, default: 96 },
    gravitropic_droop: { min: -0.2, max: 0.8, default: 0 },
    phototropic_bias: { min: -0.4, max: 0.4, default: 0 },
    ramification_density: { min: 0, max: 1, default: 0.56 },
    internode_scale: { min: 0.5, max: 1.5, default: 0.96 },
    internode_cv: { min: 0.05, max: 0.6, default: 0.24 },
    canopy_height_ratio: { min: 0.6, max: 2.2, default: 1.45 },
    lateral_mass_offset: { min: -0.5, max: 0.5, default: 0 },
    negative_space_target: { min: 0.05, max: 0.35, default: 0.18 },
    flower_bud_density: { min: 0, max: 1, default: 0.66 },
    flower_cluster_size: { min: 1, max: 7, default: 4, integer: true },
    flower_cluster_tightness: { min: 0, max: 1, default: 0.62 },
    flower_leaf_phase_offset: { min: -0.4, max: 0.4, default: 0 },
    seasonal_consistency: { min: 0, max: 1, default: 0.68 },
    petal_size_variance: { min: 0, max: 1, default: 0.38 },
};

export const SAKURA_CANONICAL_LATENT_KEYS = Object.keys(SAKURA_CANONICAL_LATENT_DEFS);
export const SAKURA_LEARNING_LATENT_EXCLUDED_KEYS = [
    ...SAKURA_TRUNK_GEMINI_LEARNING_EXCLUDED_KEYS,
];
export const SAKURA_LEARNING_LATENT_KEYS = SAKURA_CANONICAL_LATENT_KEYS.filter(
    (key) => !SAKURA_LEARNING_LATENT_EXCLUDED_KEYS.includes(key),
);

export const getDefaultSakuraLatent = () => (
    SAKURA_CANONICAL_LATENT_KEYS.reduce((acc, key) => {
        acc[key] = SAKURA_CANONICAL_LATENT_DEFS[key].default;
        return acc;
    }, {})
);

export const createSakuraLatentValidationError = (
    code,
    message,
    details = null,
    cause = null,
) => {
    const error = new Error(message);
    error.code = code;
    if (details && typeof details === 'object') {
        error.details = details;
    }
    if (cause) {
        error.cause = cause;
    }
    return error;
};

export const validateSakuraLatent = (
    latent,
    {
        code = 'SAKURA_LATENT_INVALID',
        label = 'Sakura latent',
        details = null,
    } = {},
) => {
    if (!isPlainObject(latent)) {
        throw createSakuraLatentValidationError(
            code,
            `${label} must be a plain object.`,
            {
                ...(details && typeof details === 'object' ? details : {}),
                value: latent,
            },
        );
    }

    return SAKURA_CANONICAL_LATENT_KEYS.reduce((acc, key) => {
        const def = SAKURA_CANONICAL_LATENT_DEFS[key];
        const raw = latent[key];
        const numeric = Number(raw);
        if (!Number.isFinite(numeric)) {
            throw createSakuraLatentValidationError(
                code,
                `${label} contains a non-numeric value for '${key}'.`,
                {
                    ...(details && typeof details === 'object' ? details : {}),
                    key,
                    value: raw,
                },
            );
        }
        if (def.integer && !Number.isInteger(numeric)) {
            throw createSakuraLatentValidationError(
                code,
                `${label} contains a non-integer value for '${key}'.`,
                {
                    ...(details && typeof details === 'object' ? details : {}),
                    key,
                    value: raw,
                },
            );
        }
        if (numeric < def.min || numeric > def.max) {
            throw createSakuraLatentValidationError(
                code,
                `${label} contains an out-of-range value for '${key}'.`,
                {
                    ...(details && typeof details === 'object' ? details : {}),
                    key,
                    value: raw,
                    min: def.min,
                    max: def.max,
                },
            );
        }
        acc[key] = def.integer ? Math.round(numeric) : Number(numeric);
        return acc;
    }, {});
};

export const clampSakuraLatent = (latent = {}) => {
    const sourceLatent = { ...(latent || {}) };
    return SAKURA_CANONICAL_LATENT_KEYS.reduce((acc, key) => {
        const def = SAKURA_CANONICAL_LATENT_DEFS[key];
        const raw = Number.isFinite(sourceLatent?.[key]) ? Number(sourceLatent[key]) : def.default;
        const clamped = clamp(raw, def.min, def.max);
        acc[key] = def.integer ? Math.round(clamped) : Number(clamped);
        return acc;
    }, {});
};

export const createRandomSakuraLatent = (rng = Math.random) => {
    const randomFn = typeof rng === 'function' ? rng : Math.random;
    const latent = {};
    SAKURA_CANONICAL_LATENT_KEYS.forEach((key) => {
        const def = SAKURA_CANONICAL_LATENT_DEFS[key];
        const value = def.min + ((def.max - def.min) * clamp01(Number(randomFn())));
        latent[key] = def.integer ? Math.round(value) : value;
    });
    return clampSakuraLatent(latent);
};

export const mutateSakuraLatent = (baseLatent = {}, options = {}) => {
    const {
        intensity = 0.16,
        mutationRate = 0.48,
        rng = Math.random,
    } = options;
    const safeIntensity = clamp01(Number.isFinite(intensity) ? intensity : 0.16);
    const safeRate = clamp01(Number.isFinite(mutationRate) ? mutationRate : 0.48);
    const randomFn = typeof rng === 'function' ? rng : Math.random;

    const base = clampSakuraLatent(baseLatent);
    const out = { ...base };

    SAKURA_CANONICAL_LATENT_KEYS.forEach((key) => {
        if (Number(randomFn()) > safeRate) {
            return;
        }
        const def = SAKURA_CANONICAL_LATENT_DEFS[key];
        const span = Math.max(1e-6, def.max - def.min);
        const direction = Number(randomFn()) > 0.5 ? 1 : -1;
        const magnitude = span * safeIntensity * (0.25 + (Number(randomFn()) * 0.9));
        const next = clamp(base[key] + (direction * magnitude), def.min, def.max);
        out[key] = def.integer ? Math.round(next) : Number(next);
    });

    return clampSakuraLatent(out);
};
