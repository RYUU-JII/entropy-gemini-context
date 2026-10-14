import { SAKURA_CANONICAL_LATENT_DEFS } from './SakuraLatentParamApi';
import { applySakuraTrunkGeminiLatentToPhenotype } from '../sakura/sakuraTrunkGeminiParams';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const clamp01 = (value) => clamp(value, 0, 1);
const toRadians = (degrees) => (degrees * Math.PI) / 180;
const safeDiv = (a, b, fallback = 0) => (Math.abs(b) > 1e-6 ? a / b : fallback);
const normalizeRange = (value, min, max) => clamp01(safeDiv(value - min, max - min, 0));
const mapRange = (value, inMin, inMax, outMin, outMax) => (
    outMin + ((outMax - outMin) * normalizeRange(value, inMin, inMax))
);

const latentNorm = (latent, key) => {
    const def = SAKURA_CANONICAL_LATENT_DEFS[key];
    if (!def) {
        return 0;
    }
    return normalizeRange(latent[key], def.min, def.max);
};

const resolveStyleModeBlend = (modeNorm = 0.5) => {
    const m = clamp01(modeNorm);
    const straight = clamp01(1 - (m * 2));
    const kink = clamp01((m - 0.5) * 2);
    const curved = clamp01(1 - Math.abs((m - 0.5) * 2));
    return { straight, curved, kink };
};

const blendStyleMode = (mode, straightValue, curvedValue, kinkValue) => (
    (mode.straight * straightValue)
    + (mode.curved * curvedValue)
    + (mode.kink * kinkValue)
);

// Branch dressing keeps the former canonical-default composition without
// treating the learned trunk curve amplitude as a second scaffold/twig owner.
const FIXED_BRANCH_DRESSING_CURVE_PRIOR = (
    SAKURA_CANONICAL_LATENT_DEFS.trunk_curve_amp.default * 0.2
);

export const createSakuraLatentCompileContext = ({
    latent,
    clampByPhenotypeKey,
} = {}) => {
    const nVigor = latentNorm(latent, 'vigor');
    const nApical = latentNorm(latent, 'apical_dominance');
    const nTrunkBase = latentNorm(latent, 'trunk_base_scale');
    const nTaper = latentNorm(latent, 'taper_strength');
    const nBackboneSway = latentNorm(latent, 'backbone_sway');
    const nBackboneLock = latentNorm(latent, 'backbone_lock');
    const nTrunkStyleMode = latentNorm(latent, 'trunk_style_mode');
    const nTwigStyleMode = latentNorm(latent, 'twig_style_mode');
    const nAngleStd = latentNorm(latent, 'branch_angle_sd_deg');
    const nTwigUpwardBias = latentNorm(latent, 'twig_upward_bias_prob');
    const nRamification = latentNorm(latent, 'ramification_density');
    const nInternodeScale = latentNorm(latent, 'internode_scale');
    const nInternodeCv = latentNorm(latent, 'internode_cv');
    const nCanopyRatio = latentNorm(latent, 'canopy_height_ratio');
    const nNegativeSpace = latentNorm(latent, 'negative_space_target');
    const nFlowerBud = latentNorm(latent, 'flower_bud_density');
    const nClusterSize = latentNorm(latent, 'flower_cluster_size');
    const nClusterTight = latentNorm(latent, 'flower_cluster_tightness');
    const nSeasonal = latentNorm(latent, 'seasonal_consistency');
    const nPetalVariance = latentNorm(latent, 'petal_size_variance');
    const trunkStyleMode = resolveStyleModeBlend(nTrunkStyleMode);
    const twigStyleMode = resolveStyleModeBlend(nTwigStyleMode);
    const nStraightness = clamp01(
        1 - (nAngleStd * 0.7) - FIXED_BRANCH_DRESSING_CURVE_PRIOR,
    );
    const nTwigCompact = clamp01(
        (nTaper * 0.34)
        + ((1 - nInternodeScale) * 0.26)
        + (nRamification * 0.2)
        + (nApical * 0.2),
    );

    const phototropic = Number(latent.phototropic_bias) || 0;
    const lateralOffset = Number(latent.lateral_mass_offset) || 0;
    const droopRaw = Number(latent.gravitropic_droop) || 0;
    const phaseOffset = Number(latent.flower_leaf_phase_offset) || 0;
    const backboneTiltBias = Number(latent.backbone_tilt_bias) || 0;

    const branchAngleMeanRad = toRadians(Number(latent.primary_angle_mean_deg) || 46);
    const scaffoldGlobalPitchRad = toRadians(Number(latent.scaffold_global_pitch_deg) || 0);
    const scaffoldLocalWeightRaw = Number(latent.scaffold_local_weight);
    const scaffoldLocalWeight = clamp01(
        Number.isFinite(scaffoldLocalWeightRaw) ? scaffoldLocalWeightRaw : 0.2,
    );
    const scaffoldGravityRaw = Number(latent.scaffold_gravity_strength);
    const scaffoldGravity = clamp01(
        Number.isFinite(scaffoldGravityRaw) ? scaffoldGravityRaw : 0.34,
    );
    const scaffoldWindStrengthRaw = Number(latent.scaffold_wind_strength);
    const scaffoldWindStrength = clamp01(
        Number.isFinite(scaffoldWindStrengthRaw) ? scaffoldWindStrengthRaw : 0.12,
    );
    const scaffoldWindBias = clamp(
        Number.isFinite(Number(latent.scaffold_wind_bias))
            ? Number(latent.scaffold_wind_bias)
            : 0,
        -1,
        1,
    );
    const scaffoldDensity = clamp01(
        Number.isFinite(Number(latent.scaffold_density))
            ? Number(latent.scaffold_density)
            : 0.42,
    );
    const scaffoldUpperCoverage = clamp01(
        Number.isFinite(Number(latent.scaffold_upper_coverage))
            ? Number(latent.scaffold_upper_coverage)
            : 0.58,
    );
    const scaffoldDistributionMode = clamp01(
        Number.isFinite(Number(latent.scaffold_distribution_mode))
            ? Number(latent.scaffold_distribution_mode)
            : 0.5,
    );
    const scaffoldShapeMode = clamp01(
        Number.isFinite(Number(latent.scaffold_shape_mode))
            ? Number(latent.scaffold_shape_mode)
            : 0.5,
    );
    const scaffoldSpacingDecayRaw = Number(latent.scaffold_spacing_decay);
    const scaffoldSpacingDecay = clamp(
        Number.isFinite(scaffoldSpacingDecayRaw) ? scaffoldSpacingDecayRaw : 1.03,
        0.92,
        1.2,
    );
    const scaffoldAnchorLowerBias = clamp01(
        Number.isFinite(Number(latent.scaffold_anchor_lower_bias))
            ? Number(latent.scaffold_anchor_lower_bias)
            : 0.58,
    );
    const scaffoldNodeTwigProb = clamp(
        Number.isFinite(Number(latent.scaffold_node_twig_prob))
            ? Number(latent.scaffold_node_twig_prob)
            : 0.72,
        0.08,
        0.98,
    );
    const scaffoldTurnStraightBias = clamp01(
        Number.isFinite(Number(latent.scaffold_turn_straight_bias))
            ? Number(latent.scaffold_turn_straight_bias)
            : 0.58,
    );
    const scaffoldTurnSweepProb = clamp01(
        Number.isFinite(Number(latent.scaffold_turn_sweep_prob))
            ? Number(latent.scaffold_turn_sweep_prob)
            : 0.28,
    );
    const scaffoldTurnKinkProb = clamp01(
        Number.isFinite(Number(latent.scaffold_turn_kink_prob))
            ? Number(latent.scaffold_turn_kink_prob)
            : 0.12,
    );
    const scaffoldTurnSweepAmpDeg = clamp(
        Number.isFinite(Number(latent.scaffold_turn_sweep_amp_deg))
            ? Number(latent.scaffold_turn_sweep_amp_deg)
            : 11,
        0,
        32,
    );
    const scaffoldTurnSweepFreq = clamp(
        Number.isFinite(Number(latent.scaffold_turn_sweep_freq))
            ? Number(latent.scaffold_turn_sweep_freq)
            : 0.9,
        0.1,
        3.2,
    );
    const scaffoldTurnKinkAngleDeg = clamp(
        Number.isFinite(Number(latent.scaffold_turn_kink_angle_deg))
            ? Number(latent.scaffold_turn_kink_angle_deg)
            : 20,
        2,
        48,
    );
    const scaffoldTurnRecovery = clamp01(
        Number.isFinite(Number(latent.scaffold_turn_recovery))
            ? Number(latent.scaffold_turn_recovery)
            : 0.56,
    );
    const scaffoldTurnPersistence = clamp01(
        Number.isFinite(Number(latent.scaffold_turn_persistence))
            ? Number(latent.scaffold_turn_persistence)
            : 0.58,
    );
    const scaffoldTurnNoise = clamp01(
        Number.isFinite(Number(latent.scaffold_turn_noise))
            ? Number(latent.scaffold_turn_noise)
            : 0.24,
    );
    const scaffoldTurnDepthDamping = clamp01(
        Number.isFinite(Number(latent.scaffold_turn_depth_damping))
            ? Number(latent.scaffold_turn_depth_damping)
            : 0.46,
    );
    const twigNodeBudgetCap = clamp(
        Math.round(
            Number.isFinite(Number(latent.twig_node_budget_cap))
                ? Number(latent.twig_node_budget_cap)
                : 20,
        ),
        6,
        40,
    );
    const twigSpawnMinWidth = clamp(
        Number.isFinite(Number(latent.twig_spawn_min_width))
            ? Number(latent.twig_spawn_min_width)
            : 0.14,
        0.08,
        0.6,
    );
    const primaryAngleBiasRad = clamp(
        branchAngleMeanRad - toRadians(46),
        -toRadians(26),
        toRadians(26),
    );
    const trunkGeminiOverrides = applySakuraTrunkGeminiLatentToPhenotype({
        latent,
        clampByPhenotypeKey,
    });

    return {
        latent,
        nVigor,
        nApical,
        nTrunkBase,
        nTaper,
        nBackboneSway,
        nBackboneLock,
        nTrunkStyleMode,
        nTwigStyleMode,
        nAngleStd,
        nTwigUpwardBias,
        nRamification,
        nInternodeScale,
        nInternodeCv,
        nCanopyRatio,
        nNegativeSpace,
        nFlowerBud,
        nClusterSize,
        nClusterTight,
        nSeasonal,
        nPetalVariance,
        nStraightness,
        nTwigCompact,
        phototropic,
        lateralOffset,
        droopRaw,
        phaseOffset,
        backboneTiltBias,
        branchAngleMeanRad,
        scaffoldGlobalPitchRad,
        scaffoldLocalWeight,
        scaffoldGravity,
        scaffoldWindStrength,
        scaffoldWindBias,
        scaffoldDensity,
        scaffoldUpperCoverage,
        scaffoldDistributionMode,
        scaffoldShapeMode,
        scaffoldSpacingDecay,
        scaffoldAnchorLowerBias,
        scaffoldNodeTwigProb,
        scaffoldTurnStraightBias,
        scaffoldTurnSweepProb,
        scaffoldTurnKinkProb,
        scaffoldTurnSweepAmpDeg,
        scaffoldTurnSweepFreq,
        scaffoldTurnKinkAngleDeg,
        scaffoldTurnRecovery,
        scaffoldTurnPersistence,
        scaffoldTurnNoise,
        scaffoldTurnDepthDamping,
        twigNodeBudgetCap,
        twigSpawnMinWidth,
        primaryAngleBiasRad,
        trunkStyleMode,
        twigStyleMode,
        trunkGeminiOverrides,
        clampByPhenotypeKey,
        mapRange,
        blendStyleMode,
        clamp01,
        toRadians,
    };
};
