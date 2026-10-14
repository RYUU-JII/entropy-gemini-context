import {
    SAKURA_CANONICAL_LATENT_DEFS,
    getSakuraLatentTierKeys,
} from './v2/SakuraLatentParamApi';
import {
    SAKURA_TRUNK_ACTIVE_CONTROLS,
    SAKURA_TRUNK_ACTIVE_PRESETS,
} from './sakura/sakuraTrunkGeminiParams';

const TRUNK_ACTIVE_CONTROL_LABELS = Object.freeze(
    SAKURA_TRUNK_ACTIVE_CONTROLS.reduce((acc, control) => {
        acc[control.key] = control.label;
        return acc;
    }, {}),
);

const LATENT_CONTROL_LABELS = Object.freeze({
    trunk_base_scale: 'Base Width',
    ...TRUNK_ACTIVE_CONTROL_LABELS,
    scaffold_first_attach_ratio: 'First Start',
    scaffold_anchor_lower_bias: 'Lower Bias',
    scaffold_local_weight: 'Local Weight',
    scaffold_global_pitch_deg: 'Global Pitch',
    scaffold_gravity_strength: 'Gravity',
    scaffold_wind_strength: 'Wind Str',
    scaffold_wind_bias: 'Wind Bias',
    scaffold_density: 'Density',
    scaffold_upper_coverage: 'Upper Fill',
    scaffold_distribution_mode: 'Distribution',
    scaffold_shape_mode: 'Branch Shape',
    scaffold_spacing_decay: 'Density Decay',
    scaffold_node_twig_prob: 'Node Twig Prob',
    scaffold_turn_straight_bias: 'Turn Straight',
    scaffold_turn_sweep_prob: 'Turn Sweep',
    scaffold_turn_kink_prob: 'Turn Kink',
    scaffold_turn_sweep_amp_deg: 'Sweep Amp',
    scaffold_turn_sweep_freq: 'Sweep Freq',
    scaffold_turn_kink_angle_deg: 'Kink Angle',
    scaffold_turn_recovery: 'Turn Recovery',
    scaffold_turn_persistence: 'Turn Persist',
    scaffold_turn_noise: 'Turn Noise',
    scaffold_turn_depth_damping: 'Depth Damping',
    scaffold_length_decay: 'Length Decay',
    scaffold_width_decay: 'Width Decay',
    twig_style_mode: 'Style Mode',
    twig_length_decay: 'Length Decay',
    twig_width_decay: 'Width Decay',
    twig_node_budget_cap: 'Node Budget',
    twig_spawn_min_width: 'Spawn Min W',
    twig_upward_bias_prob: 'Upward Bias',
    internode_scale: 'Internode Scale',
    internode_cv: 'Internode CV',
    negative_space_target: 'Negative Space',
});

const buildTierControls = (tierId, preferredOrder = []) => {
    const tierKeys = getSakuraLatentTierKeys(tierId);
    const preferred = preferredOrder.filter((key) => tierKeys.includes(key));
    const remaining = tierKeys.filter((key) => !preferred.includes(key));
    const ordered = [...preferred, ...remaining];
    return ordered.map((key) => ({
        key,
        label: LATENT_CONTROL_LABELS[key] || key,
    }));
};

const SCAFFOLD_CONTROL_ORDER = [
    'scaffold_first_attach_ratio',
    'scaffold_anchor_lower_bias',
    'scaffold_local_weight',
    'scaffold_global_pitch_deg',
    'scaffold_gravity_strength',
    'scaffold_wind_strength',
    'scaffold_wind_bias',
    'scaffold_density',
    'scaffold_upper_coverage',
    'scaffold_distribution_mode',
    'scaffold_shape_mode',
    'scaffold_spacing_decay',
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
];

const TWIG_CONTROL_ORDER = [
    'twig_style_mode',
    'twig_length_decay',
    'twig_width_decay',
    'twig_node_budget_cap',
    'twig_spawn_min_width',
    'twig_upward_bias_prob',
    'internode_scale',
    'internode_cv',
    'negative_space_target',
];

const TRUNK_CONTROL_ORDER = [
    'trunk_base_scale',
    ...SAKURA_TRUNK_ACTIVE_CONTROLS.map((control) => control.key),
];

const buildTrunkControls = () => {
    const trunkTierKeys = new Set(getSakuraLatentTierKeys('trunk'));
    return TRUNK_CONTROL_ORDER
        .filter((key) => trunkTierKeys.has(key))
        .map((key) => ({
            key,
            label: LATENT_CONTROL_LABELS[key] || key,
        }));
};

export const LATENT_STYLE_PRESETS_BY_AXIS = Object.freeze({
    trunk: SAKURA_TRUNK_ACTIVE_PRESETS,
    scaffold: [
        {
            id: 'straight',
            label: 'Straight',
            values: {
                scaffold_first_attach_ratio: 0.2,
                scaffold_local_weight: 0.2,
                scaffold_global_pitch_deg: 0,
                scaffold_gravity_strength: 0.34,
                scaffold_wind_strength: 0.1,
                scaffold_wind_bias: 0,
                scaffold_density: 0.34,
                scaffold_upper_coverage: 0.24,
                scaffold_distribution_mode: 0.14,
                scaffold_shape_mode: 0.14,
                scaffold_spacing_decay: 1.08,
                scaffold_length_decay: 0.82,
                scaffold_width_decay: 0.86,
            },
        },
        {
            id: 'wind_swept',
            label: 'Wind Swept',
            values: {
                scaffold_first_attach_ratio: 0.16,
                scaffold_local_weight: 0.28,
                scaffold_global_pitch_deg: 16,
                scaffold_gravity_strength: 0.38,
                scaffold_wind_strength: 0.78,
                scaffold_wind_bias: 0.8,
                scaffold_density: 0.4,
                scaffold_upper_coverage: 0.52,
                scaffold_distribution_mode: 0.5,
                scaffold_shape_mode: 0.5,
                scaffold_spacing_decay: 1.04,
                scaffold_length_decay: 0.74,
                scaffold_width_decay: 0.8,
            },
        },
        {
            id: 'tangent',
            label: 'Tangent',
            values: {
                scaffold_first_attach_ratio: 0.12,
                scaffold_local_weight: 0.96,
                scaffold_global_pitch_deg: 0,
                scaffold_gravity_strength: 0.22,
                scaffold_wind_strength: 0.16,
                scaffold_wind_bias: 0,
                scaffold_density: 0.56,
                scaffold_upper_coverage: 0.68,
                scaffold_distribution_mode: 0.88,
                scaffold_shape_mode: 0.88,
                scaffold_spacing_decay: 0.98,
                scaffold_length_decay: 0.68,
                scaffold_width_decay: 0.76,
            },
        },
    ],
    twig: [
        {
            id: 'straight',
            label: 'Straight',
            values: {
                twig_style_mode: 0.1,
                twig_length_decay: 0.72,
                twig_width_decay: 0.76,
            },
        },
        {
            id: 'curved',
            label: 'Curved',
            values: {
                twig_style_mode: 0.5,
                twig_length_decay: 0.64,
                twig_width_decay: 0.68,
            },
        },
        {
            id: 'kink',
            label: 'Kink',
            values: {
                twig_style_mode: 0.92,
                twig_length_decay: 0.58,
                twig_width_decay: 0.62,
            },
        },
    ],
});

export const LATENT_CONTROL_SECTIONS = [
    {
        id: 'trunk',
        label: 'Trunk Tier',
        toneClass: 'border-rose-200 bg-rose-50/70 text-rose-700 accent-rose-600',
        sliderClass: 'accent-rose-600',
        controls: buildTrunkControls(),
    },
    {
        id: 'scaffold',
        label: 'Scaffold Tier',
        toneClass: 'border-cyan-200 bg-cyan-50/70 text-cyan-700 accent-cyan-600',
        sliderClass: 'accent-cyan-600',
        controls: buildTierControls('scaffold', SCAFFOLD_CONTROL_ORDER),
    },
    {
        id: 'twig',
        label: 'Twig Tier',
        toneClass: 'border-lime-200 bg-lime-50/70 text-lime-700 accent-lime-600',
        sliderClass: 'accent-lime-600',
        controls: buildTierControls('twig', TWIG_CONTROL_ORDER),
    },
];

export const resolveLatentSliderStep = (latentKey) => {
    const def = SAKURA_CANONICAL_LATENT_DEFS?.[latentKey];
    if (!def) {
        return 0.01;
    }
    if (def.integer) {
        return 1;
    }
    const span = Math.abs(Number(def.max) - Number(def.min));
    if (span >= 30) return 1;
    if (span >= 10) return 0.5;
    if (span >= 4) return 0.1;
    if (span >= 1.5) return 0.05;
    return 0.01;
};

export const resolveLatentPresetTolerance = (latentKey) => {
    const def = SAKURA_CANONICAL_LATENT_DEFS?.[latentKey];
    if (!def) {
        return 1e-3;
    }
    if (def.integer) {
        return 0;
    }
    const span = Math.abs(Number(def.max) - Number(def.min));
    return Math.max(0.005, span * 0.01);
};
