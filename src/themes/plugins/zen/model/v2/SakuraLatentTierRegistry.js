import { SAKURA_CANONICAL_LATENT_KEYS } from './SakuraLatentSchema';
import { SAKURA_TRUNK_GEMINI_LATENT_KEYS } from '../sakura/sakuraTrunkGeminiParams';

const createFrozenGroups = (groups = {}) => Object.freeze(
    Object.entries(groups).reduce((acc, [groupId, keys]) => {
        acc[groupId] = Object.freeze(Array.isArray(keys) ? [...keys] : []);
        return acc;
    }, {}),
);

const BASE_LATENT_TIER_GROUPS = Object.freeze({
    trunk: Object.freeze([
        'vigor',
        'apical_dominance',
        'trunk_base_scale',
        'taper_strength',
        'trunk_curve_amp',
        'trunk_curve_freq',
        'backbone_tilt_bias',
        'backbone_sway',
        'backbone_lock',
        'trunk_style_mode',
        'trunk_kink_prob',
        'trunk_kink_angle_deg',
        'trunk_cont_step_cap_deg',
        'trunk_cont_micro_cap_deg',
        'trunk_length_decay',
        'trunk_width_decay',
        ...SAKURA_TRUNK_GEMINI_LATENT_KEYS,
        'canopy_height_ratio',
        'lateral_mass_offset',
    ]),
    scaffold: Object.freeze([
        'scaffold_global_pitch_deg',
        'scaffold_local_weight',
        'scaffold_gravity_strength',
        'scaffold_wind_strength',
        'scaffold_wind_bias',
        'scaffold_density',
        'scaffold_upper_coverage',
        'scaffold_distribution_mode',
        'scaffold_shape_mode',
        'scaffold_spacing_decay',
        'scaffold_anchor_lower_bias',
        'scaffold_node_twig_prob',
        'scaffold_turn_straight_bias',
        'scaffold_turn_sweep_prob',
        'scaffold_turn_kink_prob',
        'scaffold_turn_sweep_amp_deg',
        'scaffold_turn_sweep_freq',
        'scaffold_turn_kink_angle_deg',
        'scaffold_turn_recovery',
        'scaffold_turn_persistence',
        'scaffold_turn_noise',
        'scaffold_turn_depth_damping',
        'scaffold_length_decay',
        'scaffold_width_decay',
        'scaffold_thick_branch_prob',
        'scaffold_first_attach_ratio',
        'gravitropic_droop',
        'primary_angle_mean_deg',
        'branch_angle_sd_deg',
        'max_relative_bend_deg',
        'phototropic_bias',
        'ramification_density',
    ]),
    twig: Object.freeze([
        'twig_style_mode',
        'twig_length_decay',
        'twig_width_decay',
        'twig_node_budget_cap',
        'twig_spawn_min_width',
        'twig_upward_bias_prob',
        'internode_scale',
        'internode_cv',
        'negative_space_target',
    ]),
    leaf: Object.freeze([
        'flower_bud_density',
        'flower_cluster_size',
        'flower_cluster_tightness',
        'flower_leaf_phase_offset',
        'seasonal_consistency',
        'petal_size_variance',
    ]),
});

const resolveLatentTierGroups = () => {
    const grouped = {
        ...BASE_LATENT_TIER_GROUPS,
    };
    const assigned = new Set(
        Object.values(grouped).flatMap((keys) => keys),
    );
    const unassigned = SAKURA_CANONICAL_LATENT_KEYS.filter((key) => !assigned.has(key));
    if (unassigned.length) {
        grouped.misc = unassigned;
    }
    return createFrozenGroups(grouped);
};

export const SAKURA_LATENT_TIER_GROUPS = resolveLatentTierGroups();

const LATENT_TIER_ID_BY_KEY = Object.freeze(
    Object.entries(SAKURA_LATENT_TIER_GROUPS).reduce((acc, [tierId, keys]) => {
        keys.forEach((key) => {
            acc[key] = tierId;
        });
        return acc;
    }, {}),
);

export const resolveSakuraLatentTierId = (key = '') => (
    LATENT_TIER_ID_BY_KEY[key] || 'misc'
);

export const getSakuraLatentTierKeys = (tierId = 'misc') => (
    Array.isArray(SAKURA_LATENT_TIER_GROUPS?.[tierId])
        ? [...SAKURA_LATENT_TIER_GROUPS[tierId]]
        : []
);

export const resolveSakuraLatentTierIndexMap = (latentKeys = []) => {
    const indicesByTier = {};
    Object.keys(SAKURA_LATENT_TIER_GROUPS).forEach((tierId) => {
        indicesByTier[tierId] = [];
    });
    latentKeys.forEach((key, index) => {
        const tierId = resolveSakuraLatentTierId(key);
        if (!indicesByTier[tierId]) {
            indicesByTier[tierId] = [];
        }
        indicesByTier[tierId].push(index);
    });
    return Object.fromEntries(
        Object.entries(indicesByTier).filter(([, indices]) => indices.length > 0),
    );
};
