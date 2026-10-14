import {
    SAKURA_CANONICAL_LATENT_KEYS,
} from './SakuraLatentSchema';
import { resolveSakuraLatentTierId } from './SakuraLatentTierRegistry';
import { SAKURA_TRUNK_GEMINI_LATENT_KEYS } from '../sakura/sakuraTrunkGeminiParams';

export const SAKURA_LEARNING_FACTOR_POLICY_VERSION = 'sakura_structural_preference_v2';

export const SAKURA_LEARNING_FACTOR_STATUS = Object.freeze({
    ACTIVE: 'active',
    EXCLUDED: 'excluded',
    CANDIDATE: 'candidate',
});

export const SAKURA_FIXED_DRESSING_FACTOR_KEYS = Object.freeze([
    'scaffold_node_twig_prob',
    'twig_length_decay',
    'twig_width_decay',
    'twig_upward_bias_prob',
]);

export const SAKURA_FIXED_STRUCTURAL_PRIOR_FACTOR_KEYS = Object.freeze([
    'vigor',
    'taper_strength',
    'scaffold_width_decay',
    'ramification_density',
]);

export const SAKURA_EXPLICIT_FIXED_PREFERENCE_FACTOR_KEYS = Object.freeze([
    ...SAKURA_FIXED_DRESSING_FACTOR_KEYS,
    ...SAKURA_FIXED_STRUCTURAL_PRIOR_FACTOR_KEYS,
]);

const ACTIVE_FACTOR_SPECS = Object.freeze({
    apical_dominance: [0.88, 0.95, 0.08, 4, 'Directly changes crown hierarchy and the trunk-to-branch balance.'],
    trunk_base_scale: [0.96, 1, 0.08, 4, 'Produces a stable, camera-resistant change in trunk mass and root presentation.'],
    trunk_curve_amp: [0.9, 0.95, 0.08, 4, 'Produces a strong silhouette change without requiring a rare topology event.'],
    trunk_curve_freq: [0.76, 0.7, 0.09, 6, 'Changes the number and rhythm of visible trunk bends.'],
    backbone_tilt_bias: [0.94, 1, 0.08, 4, 'Produces a strong whole-tree lean that survives candidate auto-fit.'],
    backbone_sway: [0.82, 0.8, 0.09, 5, 'Produces a repeatable lateral silhouette change.'],
    trunk_kink_prob: [0.72, 0.55, 0.1, 8, 'Kink incidence is visible but seed-dependent, so it requires wider pair separation.'],
    trunk_kink_angle_deg: [0.78, 0.6, 0.1, 7, 'Kink angle is strong when present but remains conditional on kink incidence.'],
    scaffold_global_pitch_deg: [0.9, 0.9, 0.08, 4, 'Directly changes the global branch fan angle.'],
    scaffold_gravity_strength: [0.86, 0.85, 0.09, 5, 'Produces a stable upward-versus-drooping scaffold read.'],
    scaffold_wind_strength: [0.7, 0.5, 0.1, 8, 'Wind magnitude is rendered, but its signal is weaker than primary scaffold geometry.'],
    scaffold_density: [0.97, 1, 0.08, 4, 'Strongly changes scaffold count and negative-space occupancy.'],
    scaffold_upper_coverage: [0.88, 0.8, 0.09, 5, 'Strongly changes crown fill and upper-canopy occupancy.'],
    scaffold_distribution_mode: [0.84, 0.7, 0.09, 6, 'Changes the vertical scaffold distribution profile.'],
    scaffold_shape_mode: [0.9, 0.85, 0.08, 5, 'Changes the dominant crown silhouette profile.'],
    scaffold_first_attach_ratio: [0.86, 0.75, 0.09, 5, 'Changes the visible trunk clearance and first major branch height.'],
    scaffold_length_decay: [0.82, 0.7, 0.09, 6, 'Changes distal scaffold reach with a repeatable silhouette effect.'],
});

const CANDIDATE_FACTOR_SPECS = Object.freeze({
    trunk_max_height: [0.7, 0.2, 96, 'Blocked until pair framing compensates for per-candidate camera auto-fit.'],
    trunk_phase: [0.48, 0.26, 160, 'Blocked because periodic phase aliases make scalar credit assignment unreliable.'],
});

const EXCLUDED_REASON_BY_KEY = Object.freeze({
    vigor: 'fixed_structural_prior: global energy has negligible structural-form signal after candidate framing.',
    taper_strength: 'fixed_structural_prior: taper is a universal quality prior rather than a named-form preference axis.',
    scaffold_anchor_lower_bias: 'render_no_op: the computed lower-anchor metadata has no render consumer.',
    scaffold_wind_bias: 'magnitude_not_observable: the renderer uses only the sign and discards magnitude.',
    scaffold_thick_branch_prob: 'flat_effective_range: runtime clamps the probability at 0.28 while the canonical range continues to 1.',
    max_relative_bend_deg: 'flat_effective_range: runtime clamps bend at 102 degrees while the canonical range continues to 130.',
    primary_angle_mean_deg: 'partially_flat_and_confounded: tier bias saturates near 72 degrees and overlaps other angle controls.',
    scaffold_spacing_decay: 'weak_stepwise_signal: minimum-gap rounding makes nearby proposals visually indistinguishable.',
    scaffold_turn_straight_bias: 'conditional_competing_weight: it is not an independent probability and only affects sampled turn states.',
    scaffold_turn_sweep_prob: 'conditional_competing_weight: it is not an independent probability and only affects sampled turn states.',
    scaffold_turn_kink_prob: 'conditional_competing_weight: it is not an independent probability and only affects sampled turn states.',
    scaffold_turn_sweep_amp_deg: 'conditional_flat_range: it applies only in sweep state and its low range is clamped.',
    scaffold_turn_sweep_freq: 'conditional_periodic_signal: it applies only in sweep state and aliases across the range.',
    scaffold_turn_kink_angle_deg: 'conditional_signal: it applies only when the sampled turn state is kink.',
    scaffold_turn_recovery: 'conditional_signal: it applies only when the sampled turn state enters recovery.',
    scaffold_turn_persistence: 'conditional_stepwise_signal: sampled dwell duration is rounded and state-dependent.',
    scaffold_turn_noise: 'seed_confounded_signal: stochastic turn noise is not stable enough for scalar preference credit.',
    scaffold_turn_depth_damping: 'conditional_weak_signal: it attenuates only distal sampled turn states.',
    scaffold_node_twig_prob: 'fixed_dressing_policy: terminal occupancy is held outside structural preference learning.',
    scaffold_width_decay: 'fixed_structural_prior: scaffold taper is a universal quality prior rather than a named-form preference axis.',
    twig_length_decay: 'fixed_dressing_policy: terminal reach is held outside structural preference learning.',
    twig_width_decay: 'fixed_dressing_policy: terminal taper is held outside structural preference learning.',
    twig_upward_bias_prob: 'fixed_dressing_policy: terminal direction is held outside structural preference learning.',
    ramification_density: 'fixed_structural_prior: ramification is held at a lush balanced prior instead of spending preference questions on a weak structural signal.',
    trunk_segments: 'retired_resolution_control: adaptive macro-spine subdivision owns emitted segment count.',
    trunk_main_curve: 'proposal_only_duplicate_owner: canonical backbone_tilt_bias owns active trunk posture.',
    trunk_wave_freq: 'proposal_only_duplicate_input: canonical trunk_curve_freq owns active bend rhythm.',
    trunk_wave_amp: 'proposal_only_duplicate_input: canonical trunk_curve_amp owns active bend angle.',
    trunk_roughness: 'proposal_only_no_active_consumer: retained only for legacy 32-step ablation.',
    twig_node_budget_cap: 'conditional_cap: it changes rendering only when recursion reaches the budget.',
    negative_space_target: 'partially_unconsumed: its direct negative-space channel is unused and remaining effects are confounded.',
    phototropic_bias: 'partially_sign_aliased: one render path discards sign while another retains it.',
    branch_angle_sd_deg: 'broadly_confounded: it simultaneously changes angle variance, chaos, and straightness.',
    flower_bud_density: 'stage_conditional: it is not reliably visible outside the flowering presentation stage.',
});

const DEFAULT_EXCLUDED_REASON = 'not_validated: outside the conservative structural-preference admission set.';
const CANONICAL_KEY_SET = new Set(SAKURA_CANONICAL_LATENT_KEYS);
const GEMINI_KEY_SET = new Set(SAKURA_TRUNK_GEMINI_LATENT_KEYS);

const failPolicyContract = (code, detail) => {
    const error = new Error(`[SakuraLearningFactorPolicy] ${code}: ${detail}`);
    error.code = code;
    throw error;
};

const validateSpecNumber = ({ key, field, value, min = 0, max = 1 }) => {
    if (!Number.isFinite(value) || value < min || value > max) {
        failPolicyContract('SAKURA_LEARNING_FACTOR_SPEC_INVALID', `${key}.${field}`);
    }
};

const createFactor = ({ key, status, spec }) => {
    const tier = resolveSakuraLatentTierId(key);
    const active = status === SAKURA_LEARNING_FACTOR_STATUS.ACTIVE;
    const candidate = status === SAKURA_LEARNING_FACTOR_STATUS.CANDIDATE;
    const [observability, proposalWeightOrGap, gapOrEvidence, evidenceOrReason, activeReason] = spec;
    const proposalWeight = active ? proposalWeightOrGap : 0;
    const latePairGapNorm = active ? gapOrEvidence : proposalWeightOrGap;
    const minEvidence = active ? evidenceOrReason : gapOrEvidence;
    const reason = active ? activeReason : evidenceOrReason;

    validateSpecNumber({ key, field: 'observability', value: observability });
    validateSpecNumber({ key, field: 'proposalWeight', value: proposalWeight });
    validateSpecNumber({ key, field: 'latePairGapNorm', value: latePairGapNorm });
    if (!Number.isInteger(minEvidence) || minEvidence < 0) {
        failPolicyContract('SAKURA_LEARNING_FACTOR_SPEC_INVALID', `${key}.minEvidence`);
    }
    if (typeof reason !== 'string' || !reason.trim()) {
        failPolicyContract('SAKURA_LEARNING_FACTOR_SPEC_INVALID', `${key}.reason`);
    }

    return Object.freeze({
        key,
        tier,
        status,
        blocked: !active,
        observability,
        proposalWeight,
        latePairGapNorm,
        minEvidence,
        reason,
        ...(candidate ? { admissionBlock: 'candidate_requires_render_evidence' } : {}),
    });
};

Object.keys(ACTIVE_FACTOR_SPECS).forEach((key) => {
    if (!CANONICAL_KEY_SET.has(key)) {
        failPolicyContract('SAKURA_ACTIVE_FACTOR_NOT_CANONICAL', key);
    }
});
Object.keys(CANDIDATE_FACTOR_SPECS).forEach((key) => {
    if (!GEMINI_KEY_SET.has(key)) {
        failPolicyContract('SAKURA_CANDIDATE_FACTOR_OUTSIDE_GEMINI', key);
    }
});
SAKURA_FIXED_DRESSING_FACTOR_KEYS.forEach((key) => {
    if (!CANONICAL_KEY_SET.has(key) || ACTIVE_FACTOR_SPECS[key]) {
        failPolicyContract('SAKURA_FIXED_DRESSING_FACTOR_POLICY_INVALID', key);
    }
});
SAKURA_FIXED_STRUCTURAL_PRIOR_FACTOR_KEYS.forEach((key) => {
    if (!CANONICAL_KEY_SET.has(key) || ACTIVE_FACTOR_SPECS[key]) {
        failPolicyContract('SAKURA_FIXED_STRUCTURAL_PRIOR_POLICY_INVALID', key);
    }
});
if (
    new Set(SAKURA_EXPLICIT_FIXED_PREFERENCE_FACTOR_KEYS).size
    !== SAKURA_EXPLICIT_FIXED_PREFERENCE_FACTOR_KEYS.length
) {
    failPolicyContract('SAKURA_FIXED_PREFERENCE_FACTOR_DUPLICATE', 'fixed factor keyspace');
}

export const SAKURA_LEARNING_FACTOR_CATALOG = Object.freeze(
    SAKURA_CANONICAL_LATENT_KEYS.map((key) => {
        if (ACTIVE_FACTOR_SPECS[key]) {
            return createFactor({
                key,
                status: SAKURA_LEARNING_FACTOR_STATUS.ACTIVE,
                spec: ACTIVE_FACTOR_SPECS[key],
            });
        }
        if (CANDIDATE_FACTOR_SPECS[key]) {
            return createFactor({
                key,
                status: SAKURA_LEARNING_FACTOR_STATUS.CANDIDATE,
                spec: CANDIDATE_FACTOR_SPECS[key],
            });
        }
        return createFactor({
            key,
            status: SAKURA_LEARNING_FACTOR_STATUS.EXCLUDED,
            spec: [0, 0, 0, EXCLUDED_REASON_BY_KEY[key] || DEFAULT_EXCLUDED_REASON],
        });
    }),
);

const FACTOR_BY_KEY = Object.freeze(Object.fromEntries(
    SAKURA_LEARNING_FACTOR_CATALOG.map((factor) => [factor.key, factor]),
));
const VALID_STATUSES = new Set(Object.values(SAKURA_LEARNING_FACTOR_STATUS));

export const DEFAULT_SAKURA_ACTIVE_LEARNING_FACTOR_KEYS = Object.freeze(
    SAKURA_LEARNING_FACTOR_CATALOG
        .filter((factor) => factor.status === SAKURA_LEARNING_FACTOR_STATUS.ACTIVE)
        .map((factor) => factor.key),
);

export const resolveSakuraLearningFactor = (key) => {
    const factor = FACTOR_BY_KEY[key];
    if (!factor) {
        failPolicyContract('SAKURA_LEARNING_FACTOR_UNKNOWN', String(key));
    }
    return factor;
};

export const listSakuraLearningFactors = ({ status = null } = {}) => {
    if (status !== null && !VALID_STATUSES.has(status)) {
        failPolicyContract('SAKURA_LEARNING_FACTOR_STATUS_INVALID', String(status));
    }
    return SAKURA_LEARNING_FACTOR_CATALOG.filter(
        (factor) => status === null || factor.status === status,
    );
};

export const listSakuraActiveLearningFactors = () => listSakuraLearningFactors({
    status: SAKURA_LEARNING_FACTOR_STATUS.ACTIVE,
});

export const listSakuraExcludedLearningFactors = () => listSakuraLearningFactors({
    status: SAKURA_LEARNING_FACTOR_STATUS.EXCLUDED,
});

export const listSakuraCandidateLearningFactors = () => listSakuraLearningFactors({
    status: SAKURA_LEARNING_FACTOR_STATUS.CANDIDATE,
});

export const listSakuraActiveLearningFactorKeys = () => (
    [...DEFAULT_SAKURA_ACTIVE_LEARNING_FACTOR_KEYS]
);

export const listSakuraExcludedLearningFactorKeys = () => (
    listSakuraExcludedLearningFactors().map((factor) => factor.key)
);

export const listSakuraCandidateLearningFactorKeys = () => (
    listSakuraCandidateLearningFactors().map((factor) => factor.key)
);
