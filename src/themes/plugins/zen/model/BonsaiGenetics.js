const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const lerp = (a, b, t) => a + (b - a) * t;

export const Phenotype_FACTOR_DEFS = {
    // Trunk line style: 0 formal upright -> 1 cascading / dramatic
    trunkStyle: { min: 0, max: 1 },
    curvatureBase: { min: 0.05, max: 0.85 }, // Increased max for heavy S-curves
    curvatureVar: { min: 0.02, max: 0.45 },
    curvatureFreq: { min: 0.1, max: 2.2 }, // Broader freq range for big swings
    curvatureStrength: { min: 0, max: 2.5 }, // NEW: Amplitude of the S-curve
    curvatureDepthDecay: { min: 0.45, max: 1.0 }, // Per-depth decay for curvature (lower = faster straightening)
    trunkBackboneTiltBias: { min: -1, max: 1 }, // Signed trunk backbone lateral tilt bias
    trunkBackboneAmp: { min: 0.4, max: 1.8 }, // Backbone sway amplitude multiplier
    trunkBackboneFreqScale: { min: 0.6, max: 1.8 }, // Backbone rhythm frequency multiplier
    trunkBackboneDepthDecay: { min: 0.55, max: 1.15 }, // Backbone sway depth envelope
    trunkBackboneLockStrength: { min: 0, max: 1 }, // How strongly trunk continuation locks to backbone

    // Taper / rhythm
    taperExponent: { min: 0.7, max: 1.9 },
    internodeVariance: { min: 0, max: 0.5 },
    branchSpacing: { min: 0, max: 1 },
    vigor: { min: 0, max: 1 }, // global growth resource signal for twig/scaffold spawn gating

    // Branching behavior
    branchingProb: { min: 0.2, max: 0.92 },
    branchAngleBase: { min: 0.2, max: 1.5 },
    branchAngleVar: { min: 0.05, max: 1.0 },
    branchChaos: { min: 0, max: 1.0 }, // Full range
    verticalBias: { min: 0, max: 1 },
    droopMiddle: { min: -0.5, max: 0.8 },
    droopTip: { min: -0.5, max: 0.8 },
    twigUpwardBiasProb: { min: 0, max: 1 }, // Soft prior probability to nudge twig directions upward early in learning
    maxRelativeBendDeg: { min: 55, max: 140 }, // Soft prior cap for parent-relative child bend
    primaryAlternation: { min: 0, max: 1 },
    crossingAvoidance: { min: 0, max: 1 },

    // Branch scaling
    lengthBase: { min: 0.3, max: 0.98 },
    widthBase: { min: 0.3, max: 18.0 }, // Full range: thin to massive (Ancient Tree support)
    widthTaper: { min: 0.3, max: 0.98 },
    decayConservativeness: { min: 0, max: 1 },

    // Foliage / bloom
    foliageMin: { min: 1, max: 5, integer: true },
    foliageVar: { min: 1, max: 6, integer: true },
    flowerChance: { min: 0, max: 1 },
    seasonalBloomBias: { min: 0, max: 1 },
    bloomClusterBias: { min: 0, max: 1 },

    // Silhouette / canopy
    silhouetteTarget: { min: 0, max: 1 },
    canopyShapeBias: { min: 0, max: 1 },
    canopyLayerBalance: { min: 0, max: 1 },
    scaffoldStrength: { min: 0, max: 1 }, // primary branch emergence bias on early trunk
    scaffoldThickChance: { min: 0, max: 1 }, // probability gate for occasional thick scaffold branches
    scaffoldFirstAttachRatio: { min: 0.06, max: 0.9 }, // normalized trunk arc where the first scaffold can emerge
    scaffoldAnchorLowerBias: { min: 0, max: 1 }, // lower-band concentration for scaffold anchor allocation
    scaffoldSpacingDecay: { min: 0.92, max: 1.2 }, // Poisson density envelope along scaffold attachment band
    canopyBloomDensity: { min: 0, max: 1 }, // extra canopy bloom layer strength
    canopyBloomRadius: { min: 0.25, max: 1.25 }, // canopy bloom spread

    // TRUNK TIER (Base structure)
    trunkTierLengthDecay: { min: 0.65, max: 0.96 },
    trunkTierWidthDecay: { min: 0.72, max: 0.98 },
    trunkTierCurvature: { min: 0.02, max: 0.8 },
    trunkTierStartWidth: { min: 0.8, max: 2.5 }, // Multiplier for base width
    trunkTierBranchingProb: { min: 0, max: 1 },
    trunkTierBranchAngle: { min: 0.1, max: 1.5 },
    trunkTierAngleVar: { min: 0, max: 1 },
    trunkTierLengthVar: { min: 0, max: 1 },
    trunkTierWidthVar: { min: 0, max: 1 },
    trunkKinkChance: { min: 0, max: 1 }, // Probability of a sharp turn in the trunk
    trunkKinkAngle: { min: 0, max: 1.5 }, // Angle of the sharp turn (radians)
    trunkContinuationStepCapDeg: { min: 0.5, max: 24 }, // Per-step continuation cap for trunk main path (degrees)
    trunkContinuationMicroCapDeg: { min: 0, max: 12 }, // Micro drift cap added to trunk continuation (degrees)
    trunkSegmentCount: { min: 2, max: 8, integer: true }, // Explicit number of trunk segments
    trunkGeminiMaxHeight: { min: 200, max: 500, integer: true }, // absolute trunk target height in topology reference space
    trunkGeminiSegments: { min: 30, max: 50, integer: true }, // retained compatibility input; adaptive spine emission owns the active count
    trunkGeminiMainCurve: { min: -200, max: 200 }, // global drift force (Gemini mainCurve)
    trunkGeminiWaveFreq: { min: 0, max: 6 }, // S-wave frequency (Gemini waveFreq)
    trunkGeminiWaveAmp: { min: 0, max: 140 }, // S-wave amplitude (Gemini waveAmp)
    trunkGeminiRoughness: { min: 0, max: 45 }, // local angular jitter (Gemini roughness)
    trunkGeminiPhase: { min: 0, max: 20 }, // phase/seed offset (Gemini phase)
    trunkSplitHeight: { min: 0, max: 0.95 }, // normalized height at which trunk splits (0 to disable)
    trunkSplitAngle: { min: 0.1, max: 1.5 }, // branch angle for trunk split (radians)
    trunkBifurcationProb: { min: 0, max: 1 }, // one-time chance for trunk mainline split
    trunkBifurcationPoolScale: { min: 1, max: 1.8 }, // split uses expanded width pool before ratio partition
    trunkBifurcationWidthDecay: { min: 0.72, max: 1.0 }, // additional width decay applied at split moment
    trunkBifurcationMaxRatio: { min: 0.5, max: 0.7 }, // max share for dominant split branch (e.g. 0.7 -> 3:7)
    trunkBifurcationSpreadDeg: { min: 8, max: 34 }, // angular spread between split continuations

    // SCAFFOLD TIER (Primary branches)
    scaffoldTierLengthDecay: { min: 0.5, max: 0.94 },
    scaffoldTierWidthDecay: { min: 0.55, max: 0.92 },
    scaffoldTierCurvature: { min: 0.01, max: 0.8 },
    scaffoldTierStartWidth: { min: 0.5, max: 1.5 },
    scaffoldTierBranchingProb: { min: 0, max: 1 },
    scaffoldTierBranchAngle: { min: 0.1, max: 1.5 },
    scaffoldTierAngleVar: { min: 0, max: 1 },
    scaffoldTierLengthVar: { min: 0, max: 1 },
    scaffoldTierWidthVar: { min: 0, max: 1 },
    scaffoldRootGlobalPitch: { min: -0.9, max: 0.9 }, // root scaffold global pitch from world horizontal (radians)
    scaffoldRootLocalWeight: { min: 0, max: 1 }, // local tangent influence when blending root direction
    scaffoldBackboneGravity: { min: 0, max: 1 }, // downward mass influence over scaffold backbone
    scaffoldBackboneWindStrength: { min: 0, max: 1 }, // global wind influence over scaffold backbone
    scaffoldBackboneWindBias: { min: -1, max: 1 }, // signed wind direction bias (-left, +right)
    scaffoldDensity: { min: 0, max: 1 }, // scaffold root emission density controller
    scaffoldUpperCoverage: { min: 0, max: 1 }, // strength of upper-band scaffold fill reservation
    scaffoldDistributionMode: { min: 0, max: 1 }, // scaffold root distribution profile along trunk height
    scaffoldShapeMode: { min: 0, max: 1 }, // scaffold continuation shape profile (triangle <-> dome <-> mushroom)
    scaffoldNodeTwigProb: { min: 0.08, max: 0.98 }, // per-scaffold-node chance to spawn twig roots
    scaffoldTurnStraightBias: { min: 0, max: 1 }, // HSMM: occupancy bias for straight state
    scaffoldTurnSweepProb: { min: 0, max: 1 }, // HSMM: transition tendency toward sweep state
    scaffoldTurnKinkProb: { min: 0, max: 1 }, // HSMM: sparse kink impulse tendency
    scaffoldTurnSweepAmpDeg: { min: 0, max: 32 }, // HSMM: sweep turn-rate amplitude (degrees)
    scaffoldTurnSweepFreq: { min: 0.1, max: 3.2 }, // HSMM: sweep oscillation rate
    scaffoldTurnKinkAngleDeg: { min: 2, max: 48 }, // HSMM: kink impulse turn magnitude (degrees)
    scaffoldTurnRecovery: { min: 0, max: 1 }, // HSMM: kink/sweep recovery damping
    scaffoldTurnPersistence: { min: 0, max: 1 }, // HSMM: state dwell persistence
    scaffoldTurnNoise: { min: 0, max: 1 }, // HSMM: in-state stochastic jitter
    scaffoldTurnDepthDamping: { min: 0, max: 1 }, // HSMM: tip-ward turn damping

    // TWIG TIER (Fine detail)
    twigTierLengthDecay: { min: 0.42, max: 0.88 },
    twigTierWidthDecay: { min: 0.45, max: 0.85 },
    twigTierCurvature: { min: 0, max: 0.6 },
    twigTierStartWidth: { min: 0.3, max: 1.2 },
    twigTierBranchingProb: { min: 0, max: 1 },
    twigTierBranchAngle: { min: 0.1, max: 1.5 },
    twigTierAngleVar: { min: 0, max: 1 },
    twigTierLengthVar: { min: 0, max: 1 },
    twigTierWidthVar: { min: 0, max: 1 },
    primaryBranchTransitionDepth: { min: 0, max: 3, integer: true }, // primary-branch continuations before terminal twig transition
    twigFirstTripleChance: { min: 0, max: 1 }, // chance for first twig split to branch into 3
    twigNodeBloomChance: { min: 0, max: 1 }, // chance to add tiny blooms on non-terminal twig nodes
    twigNodeBudgetCap: { min: 6, max: 40, integer: true }, // child expansion budget per twig subtree root
    twigSpawnMinWidth: { min: 0.08, max: 0.6 }, // minimum scaffold width required for twig spawn

    // GLOBAL VARIANCES
    irregularDecay: { min: 0, max: 1 }, // Probability of non-uniform decay
    negativeSpaceChance: { min: 0, max: 1 }, // Probability of pruning a valid branch to create space

    // Roots / pot composition
    rootSpread: { min: 0.45, max: 1.8 },
    rootAsymmetry: { min: -0.45, max: 0.45 },
    potScale: { min: 0.78, max: 1.28 },
    trunkOffsetX: { min: -0.28, max: 0.28 },

    // Story / style
    windMemory: { min: -0.28, max: 0.28 },
    speciesCharacter: { min: 0, max: 1 },

    // [NEW] Neural Bonsai 2.0: Organic Noise Field
    noiseScale: { min: 0.005, max: 0.08 },   // Scale of the noise field (lower = broader waves)
    noiseStrength: { min: 0, max: 1.2 },     // Influence of noise on direction
    noisePhase: { min: 0, max: 100 },        // Random seed/offset for the field
    noiseDepthDecay: { min: 0.45, max: 1.0 }, // Per-depth decay for noise influence
};

export const Phenotype_FACTOR_KEYS = Object.keys(Phenotype_FACTOR_DEFS);
export const ROOT_COMPOSITION_Phenotype_FACTOR_KEYS = [
    'rootSpread',
    'rootAsymmetry',
];
// Excluded from learning by policy.
// Some are UI-only controls, and some are runtime controls kept fixed.
export const INACTIVE_GENERATOR_Phenotype_FACTOR_KEYS = [
    'trunkTierCurvature',
    'trunkTierLengthVar',
    'trunkTierWidthVar',
    // Retained pre-cutover controls; the active macro-spine planner owns geometry.
    'trunkContinuationStepCapDeg',
    'trunkContinuationMicroCapDeg',
    'trunkSegmentCount',
    'trunkSplitHeight',
    'trunkSplitAngle',
    'trunkBifurcationProb',
    'trunkBifurcationPoolScale',
    'trunkBifurcationWidthDecay',
    'trunkBifurcationMaxRatio',
    'trunkBifurcationSpreadDeg',
    // Keep compatible trunk-prior fields outside automatic learning loops.
    'trunkGeminiMaxHeight',
    'trunkGeminiSegments',
    'trunkGeminiMainCurve',
    'trunkGeminiWaveFreq',
    'trunkGeminiWaveAmp',
    'trunkGeminiRoughness',
    'trunkGeminiPhase',
    'scaffoldTierCurvature',
    'scaffoldTierLengthVar',
    'scaffoldTierWidthVar',
    'scaffoldNodeTwigProb',
    'twigTierCurvature',
    'twigTierLengthVar',
    'twigTierWidthVar',
    'twigNodeBudgetCap',
    'irregularDecay',
    'negativeSpaceChance',
];
export const ACTIVE_GENERATOR_Phenotype_FACTOR_KEYS = Phenotype_FACTOR_KEYS.filter(
    (key) => !INACTIVE_GENERATOR_Phenotype_FACTOR_KEYS.includes(key),
);
export const LEARNING_Phenotype_FACTOR_KEYS = Phenotype_FACTOR_KEYS.filter(
    (key) => (
        !ROOT_COMPOSITION_Phenotype_FACTOR_KEYS.includes(key)
        && !INACTIVE_GENERATOR_Phenotype_FACTOR_KEYS.includes(key)
    ),
);

const MUTATION_SENSITIVITY = {
    widthBase: 0.32,
    widthTaper: 0.64,
    lengthBase: 0.7,
    decayConservativeness: 0.6,
    foliageMin: 0.66,
    foliageVar: 0.62,
    flowerChance: 0.72,
    branchingProb: 0.68,
    branchChaos: 0.7,
    curvatureFreq: 0.6,
    curvatureStrength: 0.66,
    trunkBackboneTiltBias: 0.58,
    trunkBackboneAmp: 0.56,
    trunkBackboneFreqScale: 0.58,
    trunkBackboneDepthDecay: 0.54,
    trunkBackboneLockStrength: 0.52,
    scaffoldStrength: 0.62,
    scaffoldThickChance: 0.62,
    scaffoldFirstAttachRatio: 0.64,
    canopyBloomDensity: 0.72,
    canopyBloomRadius: 0.6,
    trunkTierLengthDecay: 0.58,
    trunkTierWidthDecay: 0.56,
    trunkTierCurvature: 0.6,
    scaffoldTierLengthDecay: 0.64,
    scaffoldTierWidthDecay: 0.62,
    scaffoldTierCurvature: 0.62,
    twigTierLengthDecay: 0.66,
    twigTierWidthDecay: 0.64,
    twigTierCurvature: 0.64,
    trunkContinuationStepCapDeg: 0.58,
    trunkContinuationMicroCapDeg: 0.64,
    trunkGeminiMaxHeight: 0.22,
    trunkGeminiSegments: 0.22,
    trunkGeminiMainCurve: 0.22,
    trunkGeminiWaveFreq: 0.22,
    trunkGeminiWaveAmp: 0.22,
    trunkGeminiRoughness: 0.2,
    trunkGeminiPhase: 0.18,
    trunkBifurcationProb: 0.58,
    trunkBifurcationPoolScale: 0.56,
    trunkBifurcationWidthDecay: 0.54,
    trunkBifurcationMaxRatio: 0.46,
    trunkBifurcationSpreadDeg: 0.42,
    scaffoldRootGlobalPitch: 0,
    scaffoldRootLocalWeight: 0.2,
    scaffoldBackboneGravity: 0.58,
    scaffoldBackboneWindStrength: 0.58,
    scaffoldBackboneWindBias: 0.58,
    scaffoldDensity: 0.62,
    scaffoldUpperCoverage: 0.58,
    scaffoldDistributionMode: 0.56,
    scaffoldShapeMode: 0.56,
    primaryBranchTransitionDepth: 0.62,
    twigFirstTripleChance: 0.66,
    twigNodeBloomChance: 0.72,
    noiseScale: 0.55,
    noiseStrength: 0.6,
    noisePhase: 0.2,
    droopMiddle: 0.62,
    droopTip: 0.62,
    twigUpwardBiasProb: 0.58,
    maxRelativeBendDeg: 0.42,
};

const getMutationSensitivity = (key, def) => {
    if (Object.prototype.hasOwnProperty.call(MUTATION_SENSITIVITY, key)) {
        return MUTATION_SENSITIVITY[key];
    }
    const span = Math.max(1e-6, (def.max ?? 1) - (def.min ?? 0));
    const integerPenalty = def.integer ? 0.78 : 1;
    if (span > 20) return 0.22 * integerPenalty;
    if (span > 8) return 0.36 * integerPenalty;
    if (span > 3) return 0.58 * integerPenalty;
    if (span > 1.5) return 0.74 * integerPenalty;
    return 0.9 * integerPenalty;
};

const BASE_Phenotype = {
    trunkStyle: 0.5, // Neutral: Neither straight nor S-curve
    curvatureBase: 0.3, // Moderate base curve
    curvatureVar: 0.4, // High variance for chaos
    curvatureFreq: 0.5, // Neutral frequency
    curvatureStrength: 0.5, // Neutral S-curve strength
    curvatureDepthDecay: 0.84,
    trunkBackboneTiltBias: 0,
    trunkBackboneAmp: 1.0,
    trunkBackboneFreqScale: 1.0,
    trunkBackboneDepthDecay: 0.9,
    trunkBackboneLockStrength: 0.62,

    taperExponent: 1.12,
    internodeVariance: 0.2,
    branchSpacing: 0.58,
    vigor: 0.55,

    branchingProb: 0.62,
    branchAngleBase: 0.78,
    branchAngleVar: 0.35,
    branchChaos: 0.5, // Total chaos potential
    verticalBias: 0.5, // Neutral verticality
    droopMiddle: 0,
    droopTip: 0,
    twigUpwardBiasProb: 0.22,
    maxRelativeBendDeg: 96,
    primaryAlternation: 0.5, // Random alternation
    crossingAvoidance: 0.5,

    lengthBase: 0.8,
    widthBase: 2.5, // Thick start
    widthTaper: 0.75, // Slower taper to keep twigs visible
    decayConservativeness: 0.42,

    foliageMin: 4, // More flowers guaranteed
    foliageVar: 5, // High variance for clusters
    flowerChance: 0.54,
    seasonalBloomBias: 0.62,
    bloomClusterBias: 0.58,

    silhouetteTarget: 0.3,
    canopyShapeBias: 0.45,
    canopyLayerBalance: 0.62,
    scaffoldStrength: 0.56,
    scaffoldThickChance: 0.14,
    scaffoldFirstAttachRatio: 0.14,
    scaffoldAnchorLowerBias: 0.58,
    scaffoldSpacingDecay: 1.03,
    canopyBloomDensity: 0.62,
    canopyBloomRadius: 0.56,

    trunkTierLengthDecay: 0.82,
    trunkTierWidthDecay: 0.9,
    trunkTierCurvature: 0.26,
    trunkTierStartWidth: 1.0,
    trunkTierBranchingProb: 0.5,
    trunkTierBranchAngle: 0.6,
    trunkTierAngleVar: 0.2,
    trunkTierLengthVar: 0.2,
    trunkTierWidthVar: 0.2,
    trunkKinkChance: 0.0,
    trunkKinkAngle: 0.5,
    trunkContinuationStepCapDeg: 9.6,
    trunkContinuationMicroCapDeg: 2.0,
    trunkSegmentCount: 2,
    trunkGeminiMaxHeight: 332,
    trunkGeminiSegments: 30,
    trunkGeminiMainCurve: 0,
    trunkGeminiWaveFreq: 3.5,
    trunkGeminiWaveAmp: 40,
    trunkGeminiRoughness: 20,
    trunkGeminiPhase: 0,
    trunkSplitHeight: 0,
    trunkSplitAngle: 0.5,
    trunkBifurcationProb: 0.34,
    trunkBifurcationPoolScale: 1.48,
    trunkBifurcationWidthDecay: 0.9,
    trunkBifurcationMaxRatio: 0.67,
    trunkBifurcationSpreadDeg: 18,

    scaffoldTierLengthDecay: 0.72,
    scaffoldTierWidthDecay: 0.78,
    scaffoldTierCurvature: 0.18,
    scaffoldTierStartWidth: 1.0,
    scaffoldTierBranchingProb: 0.6,
    scaffoldTierBranchAngle: 0.7,
    scaffoldTierAngleVar: 0.3,
    scaffoldTierLengthVar: 0.3,
    scaffoldTierWidthVar: 0.3,
    scaffoldRootGlobalPitch: 0,
    scaffoldRootLocalWeight: 0.2,
    scaffoldBackboneGravity: 0.34,
    scaffoldBackboneWindStrength: 0.12,
    scaffoldBackboneWindBias: 0,
    scaffoldDensity: 0.42,
    scaffoldUpperCoverage: 0.56,
    scaffoldDistributionMode: 0.5,
    scaffoldShapeMode: 0.5,
    scaffoldNodeTwigProb: 0.72,
    scaffoldTurnStraightBias: 0.58,
    scaffoldTurnSweepProb: 0.28,
    scaffoldTurnKinkProb: 0.12,
    scaffoldTurnSweepAmpDeg: 11,
    scaffoldTurnSweepFreq: 0.9,
    scaffoldTurnKinkAngleDeg: 20,
    scaffoldTurnRecovery: 0.56,
    scaffoldTurnPersistence: 0.58,
    scaffoldTurnNoise: 0.24,
    scaffoldTurnDepthDamping: 0.46,

    twigTierLengthDecay: 0.62,
    twigTierWidthDecay: 0.66,
    twigTierCurvature: 0.08,
    twigTierStartWidth: 1.0,
    twigTierBranchingProb: 0.4,
    twigTierBranchAngle: 0.8,
    twigTierAngleVar: 0.4,
    twigTierLengthVar: 0.4,
    twigTierWidthVar: 0.4,
    primaryBranchTransitionDepth: 1,
    twigFirstTripleChance: 0.28,
    twigNodeBloomChance: 0.22,
    twigNodeBudgetCap: 20,
    twigSpawnMinWidth: 0.14,

    irregularDecay: 0.1,
    negativeSpaceChance: 0.05,

    rootSpread: 1.08,
    rootAsymmetry: 0,
    potScale: 1.0,
    trunkOffsetX: 0,

    windMemory: 0,
    speciesCharacter: 0.78,

    noiseScale: 0.02,
    noiseStrength: 0.45,
    noisePhase: 0,
    noiseDepthDecay: 0.88,
};

export const DEFAULT_SAKURA_Phenotype = {
    ...BASE_Phenotype,
    trunkStyle: 0.3,
    flowerChance: 0.58,
    seasonalBloomBias: 0.78,
    bloomClusterBias: 0.42,
    silhouetteTarget: 0.34,
    canopyShapeBias: 0.58,
    scaffoldStrength: 0.74,
    scaffoldThickChance: 0.16,
    scaffoldFirstAttachRatio: 0.16,
    scaffoldAnchorLowerBias: 0.58,
    scaffoldSpacingDecay: 1.03,
    canopyBloomDensity: 0.56,
    canopyBloomRadius: 0.58,
    decayConservativeness: 0.46,

    trunkTierLengthDecay: 0.84,
    trunkTierWidthDecay: 0.92,
    trunkTierCurvature: 0.32,
    trunkTierStartWidth: 1.1,
    trunkTierBranchingProb: 0.45,
    trunkTierBranchAngle: 0.5,
    trunkTierAngleVar: 0.15,
    trunkTierLengthVar: 0.15,
    trunkTierWidthVar: 0.1,
    trunkKinkChance: 0.0,
    trunkKinkAngle: 0.8,
    trunkContinuationStepCapDeg: 10.5,
    trunkContinuationMicroCapDeg: 2.2,
    trunkSegmentCount: 3,
    trunkBifurcationProb: 0.38,
    trunkBifurcationPoolScale: 1.5,
    trunkBifurcationWidthDecay: 0.9,
    trunkBifurcationMaxRatio: 0.68,
    trunkBifurcationSpreadDeg: 20,

    scaffoldTierLengthDecay: 0.74,
    scaffoldTierWidthDecay: 0.8,
    scaffoldTierCurvature: 0.2,
    scaffoldTierStartWidth: 1.0,
    scaffoldTierBranchingProb: 0.65,
    scaffoldTierBranchAngle: 0.68,
    scaffoldTierAngleVar: 0.25,
    scaffoldTierLengthVar: 0.25,
    scaffoldTierWidthVar: 0.25,
    scaffoldBackboneGravity: 0.34,
    scaffoldBackboneWindStrength: 0.12,
    scaffoldBackboneWindBias: 0,
    scaffoldDensity: 0.42,
    scaffoldUpperCoverage: 0.58,
    scaffoldDistributionMode: 0.5,
    scaffoldShapeMode: 0.5,
    scaffoldTurnStraightBias: 0.58,
    scaffoldTurnSweepProb: 0.28,
    scaffoldTurnKinkProb: 0.12,
    scaffoldTurnSweepAmpDeg: 11,
    scaffoldTurnSweepFreq: 0.9,
    scaffoldTurnKinkAngleDeg: 20,
    scaffoldTurnRecovery: 0.56,
    scaffoldTurnPersistence: 0.58,
    scaffoldTurnNoise: 0.24,
    scaffoldTurnDepthDamping: 0.46,

    twigTierLengthDecay: 0.64,
    twigTierWidthDecay: 0.68,
    twigTierCurvature: 0.08,
    twigTierStartWidth: 0.9,
    twigTierBranchingProb: 0.35,
    twigTierBranchAngle: 0.82,
    twigTierAngleVar: 0.45,
    twigTierLengthVar: 0.35,
    twigTierWidthVar: 0.4,
    primaryBranchTransitionDepth: 1,
    twigFirstTripleChance: 0.34,
    twigNodeBloomChance: 0.14,

    irregularDecay: 0.15,
    negativeSpaceChance: 0.08,
    speciesCharacter: 0.83,
    rootSpread: 1.14,
    potScale: 1.06,
};

export const getBuiltInDefaultPhenotype = (_treeType) => ({ ...DEFAULT_SAKURA_Phenotype });

export const getUserDefaultPhenotype = (_treeType) => null;

export const saveUserDefaultPhenotype = (_treeType, phenotype) => (
    clampPhenotype(phenotype)
);

export const clearUserDefaultPhenotype = (_treeType) => { };

export const getDefaultPhenotype = (treeType) => (
    getBuiltInDefaultPhenotype(treeType)
);

export const clampPhenotype = (phenotype) => {
    const canonicalPhenotype = { ...(phenotype || {}) };
    const out = {};
    Phenotype_FACTOR_KEYS.forEach((key) => {
        const def = Phenotype_FACTOR_DEFS[key];
        const fallback = DEFAULT_SAKURA_Phenotype[key];
        let value = Number.isFinite(canonicalPhenotype?.[key]) ? canonicalPhenotype[key] : fallback;
        value = clamp(value, def.min, def.max);
        out[key] = def.integer ? Math.round(value) : Number(value);
    });
    return out;
};

export const mutatePhenotype = (basePhenotype, options = {}) => {
    const {
        intensity = 0.16,
        mutationRate = 0.8,
        rng = Math.random,
    } = options;

    const base = clampPhenotype(basePhenotype);
    const out = { ...base };

    Phenotype_FACTOR_KEYS.forEach((key) => {
        if (rng() > mutationRate) {
            return;
        }
        const def = Phenotype_FACTOR_DEFS[key];
        const span = Math.max(1e-6, def.max - def.min);
        const sensitivity = getMutationSensitivity(key, def);
        const normalizedBase = (base[key] - def.min) / span;
        const scale = intensity * sensitivity * (0.55 + rng() * 0.9);
        const direction = rng() > 0.5 ? 1 : -1;
        const drift = direction * scale * (0.4 + rng() * 0.6);
        const nextNormalized = clamp(normalizedBase + drift, 0, 1);
        const next = def.min + nextNormalized * span;
        out[key] = def.integer ? Math.round(next) : Number(next);
    });

    return out;
};

export const crossoverPhenotype = (phenotypeA, phenotypeB, options = {}) => {
    const {
        blend = 0.35,
        rng = Math.random,
    } = options;

    const a = clampPhenotype(phenotypeA);
    const b = clampPhenotype(phenotypeB);
    const out = {};

    Phenotype_FACTOR_KEYS.forEach((key) => {
        const def = Phenotype_FACTOR_DEFS[key];
        const pickA = rng() > 0.5;
        const base = pickA ? a[key] : b[key];
        const mix = lerp(a[key], b[key], blend * (0.5 + rng() * 0.5));
        const value = rng() > 0.65 ? mix : base;
        out[key] = def.integer ? Math.round(value) : Number(value);
    });

    return clampPhenotype(out);
};

export const randomPhenotype = (treeType, rng = Math.random) => {
    const origin = getDefaultPhenotype(treeType);
    const out = {};
    Phenotype_FACTOR_KEYS.forEach((key) => {
        const def = Phenotype_FACTOR_DEFS[key];
        const range = def.max - def.min;
        const center = origin[key];
        const value = clamp(
            center + (rng() - 0.5) * range,
            def.min,
            def.max,
        );
        out[key] = def.integer ? Math.round(value) : Number(value);
    });
    return clampPhenotype(out);
};

export const summarizePhenotype = (phenotype) => {
    const safe = clampPhenotype(phenotype);
    return {
        trunkStyle: Number(safe.trunkStyle.toFixed(2)),
        taperExponent: Number(safe.taperExponent.toFixed(2)),
        branchingProb: Number(safe.branchingProb.toFixed(2)),
        silhouetteTarget: Number(safe.silhouetteTarget.toFixed(2)),
        flowerChance: Number(safe.flowerChance.toFixed(2)),
        rootSpread: Number(safe.rootSpread.toFixed(2)),
        potScale: Number(safe.potScale.toFixed(2)),
        windMemory: Number(safe.windMemory.toFixed(2)),
        twigUpwardBiasProb: Number(safe.twigUpwardBiasProb.toFixed(2)),
        maxRelativeBendDeg: Number(safe.maxRelativeBendDeg.toFixed(1)),
        trunkBackboneAmp: Number(safe.trunkBackboneAmp.toFixed(2)),
        trunkBackboneLockStrength: Number(safe.trunkBackboneLockStrength.toFixed(2)),
        trunkBifurcationProb: Number(safe.trunkBifurcationProb.toFixed(2)),
        trunkBifurcationPoolScale: Number(safe.trunkBifurcationPoolScale.toFixed(2)),
        trunkBifurcationWidthDecay: Number(safe.trunkBifurcationWidthDecay.toFixed(2)),
        trunkBifurcationMaxRatio: Number(safe.trunkBifurcationMaxRatio.toFixed(2)),
        trunkBifurcationSpreadDeg: Number(safe.trunkBifurcationSpreadDeg.toFixed(1)),
        scaffoldThickChance: Number(safe.scaffoldThickChance.toFixed(3)),
        scaffoldFirstAttachRatio: Number(safe.scaffoldFirstAttachRatio.toFixed(3)),
        scaffoldBackboneGravity: Number(safe.scaffoldBackboneGravity.toFixed(3)),
        scaffoldBackboneWindStrength: Number(safe.scaffoldBackboneWindStrength.toFixed(3)),
        scaffoldBackboneWindBias: Number(safe.scaffoldBackboneWindBias.toFixed(3)),
        scaffoldDensity: Number(safe.scaffoldDensity.toFixed(3)),
        scaffoldUpperCoverage: Number(safe.scaffoldUpperCoverage.toFixed(3)),
        scaffoldDistributionMode: Number(safe.scaffoldDistributionMode.toFixed(3)),
        scaffoldShapeMode: Number(safe.scaffoldShapeMode.toFixed(3)),
        scaffoldSpacingDecay: Number(safe.scaffoldSpacingDecay.toFixed(3)),
        noiseStrength: Number(safe.noiseStrength.toFixed(2)),
    };
};
