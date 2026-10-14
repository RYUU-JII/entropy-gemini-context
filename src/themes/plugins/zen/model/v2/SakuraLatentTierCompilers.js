export const compileTrunkTierPhenotypeOverrides = (context = {}) => {
    const {
        latent,
        nVigor,
        nApical,
        nTrunkBase,
        nTaper,
        nBackboneSway,
        nBackboneLock,
        nAngleStd,
        nRamification,
        nInternodeScale,
        nInternodeCv,
        nPetalVariance,
        branchAngleMeanRad,
        backboneTiltBias,
        trunkStyleMode,
        primaryAngleBiasRad,
        trunkGeminiOverrides,
        clampByPhenotypeKey,
        mapRange,
        blendStyleMode,
        clamp01,
        toRadians,
    } = context;

    return {
        widthBase: clampByPhenotypeKey(
            'widthBase',
            1.0 + (nTrunkBase * 5.6) + ((nVigor - 0.5) * 0.44),
        ),
        trunkTierStartWidth: clampByPhenotypeKey('trunkTierStartWidth', 0.9 + (nTrunkBase * 1.1)),
        widthTaper: clampByPhenotypeKey('widthTaper', 0.92 - (nTaper * 0.46)),
        taperExponent: clampByPhenotypeKey('taperExponent', 0.82 + (nTaper * 0.98)),
        trunkTierLengthDecay: clampByPhenotypeKey(
            'trunkTierLengthDecay',
            Number(latent.trunk_length_decay),
        ),
        trunkTierWidthDecay: clampByPhenotypeKey(
            'trunkTierWidthDecay',
            Number(latent.trunk_width_decay),
        ),

        curvatureBase: clampByPhenotypeKey('curvatureBase', 0.29),
        curvatureStrength: clampByPhenotypeKey('curvatureStrength', 1.019),
        trunkTierCurvature: clampByPhenotypeKey('trunkTierCurvature', 0.281),
        curvatureFreq: clampByPhenotypeKey('curvatureFreq', 0.86),
        trunkBackboneTiltBias: clampByPhenotypeKey(
            'trunkBackboneTiltBias',
            mapRange(backboneTiltBias, -1, 1, -0.92, 0.92),
        ),
        trunkBackboneAmp: clampByPhenotypeKey(
            'trunkBackboneAmp',
            0.72 + (nBackboneSway * 0.88),
        ),
        trunkBackboneFreqScale: clampByPhenotypeKey('trunkBackboneFreqScale', 1),
        trunkBackboneDepthDecay: clampByPhenotypeKey('trunkBackboneDepthDecay', 0.9),
        trunkBackboneLockStrength: clampByPhenotypeKey(
            'trunkBackboneLockStrength',
            0.3 + (nBackboneLock * 0.66) - (nAngleStd * 0.08),
        ),
        trunkStyle: clampByPhenotypeKey(
            'trunkStyle',
            blendStyleMode(trunkStyleMode, 0.12, 0.44, 0.9),
        ),
        trunkKinkChance: clampByPhenotypeKey(
            'trunkKinkChance',
            clamp01((Number(latent.trunk_kink_prob) * 0.94) + (trunkStyleMode.kink * 0.1)),
        ),
        trunkKinkAngle: clampByPhenotypeKey(
            'trunkKinkAngle',
            toRadians(Number(latent.trunk_kink_angle_deg) || 0),
        ),
        trunkContinuationStepCapDeg: clampByPhenotypeKey(
            'trunkContinuationStepCapDeg',
            Number(latent.trunk_cont_step_cap_deg),
        ),
        trunkContinuationMicroCapDeg: clampByPhenotypeKey(
            'trunkContinuationMicroCapDeg',
            Number(latent.trunk_cont_micro_cap_deg),
        ),
        ...trunkGeminiOverrides,

        branchChaos: clampByPhenotypeKey(
            'branchChaos',
            0.2
            + (nRamification * 0.08)
            + (nPetalVariance * 0.2)
            + (nInternodeCv * 0.24)
            + (nAngleStd * 0.12),
        ),
        lengthBase: clampByPhenotypeKey(
            'lengthBase',
            0.4 + (nVigor * 0.28) + (nInternodeScale * 0.2) + (nRamification * 0.04),
        ),
        internodeVariance: clampByPhenotypeKey(
            'internodeVariance',
            mapRange(latent.internode_cv, 0.05, 0.6, 0.02, 0.46),
        ),
        branchSpacing: clampByPhenotypeKey(
            'branchSpacing',
            0.32 + (nApical * 0.56) - (nRamification * 0.08),
        ),
        vigor: clampByPhenotypeKey('vigor', Number(latent.vigor)),
        branchingProb: clampByPhenotypeKey(
            'branchingProb',
            0.26 + (nVigor * 0.42) + (nRamification * 0.02),
        ),
        trunkTierBranchingProb: clampByPhenotypeKey(
            'trunkTierBranchingProb',
            0.24 + (nVigor * 0.24) - (nApical * 0.18) + (nRamification * 0.06),
        ),
        branchAngleBase: clampByPhenotypeKey('branchAngleBase', branchAngleMeanRad),
        branchAngleVar: clampByPhenotypeKey(
            'branchAngleVar',
            mapRange(latent.branch_angle_sd_deg, 5, 35, 0.06, 0.82),
        ),
        trunkTierBranchAngle: clampByPhenotypeKey(
            'trunkTierBranchAngle',
            blendStyleMode(trunkStyleMode, 0.36, 0.52, 0.72) + (primaryAngleBiasRad * 0.35),
        ),
        trunkTierAngleVar: clampByPhenotypeKey(
            'trunkTierAngleVar',
            blendStyleMode(trunkStyleMode, 0.06, 0.15, 0.3) + (nAngleStd * 0.06),
        ),
    };
};

export const compileScaffoldTierPhenotypeOverrides = (context = {}) => {
    const {
        latent,
        nVigor,
        nApical,
        nTaper,
        nStraightness,
        nRamification,
        nAngleStd,
        primaryAngleBiasRad,
        scaffoldAnchorLowerBias,
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
        clampByPhenotypeKey,
    } = context;

    return {
        scaffoldTierLengthDecay: clampByPhenotypeKey(
            'scaffoldTierLengthDecay',
            Number(latent.scaffold_length_decay),
        ),
        scaffoldTierWidthDecay: clampByPhenotypeKey(
            'scaffoldTierWidthDecay',
            Number(latent.scaffold_width_decay),
        ),
        scaffoldTierBranchingProb: clampByPhenotypeKey(
            'scaffoldTierBranchingProb',
            0.18 + (nRamification * 0.54) + (nVigor * 0.12) - (nApical * 0.06),
        ),
        scaffoldTierStartWidth: clampByPhenotypeKey(
            'scaffoldTierStartWidth',
            0.86 - (nTaper * 0.18) + ((1 - nStraightness) * 0.06),
        ),
        scaffoldThickChance: clampByPhenotypeKey(
            'scaffoldThickChance',
            Number(latent.scaffold_thick_branch_prob),
        ),
        scaffoldFirstAttachRatio: clampByPhenotypeKey(
            'scaffoldFirstAttachRatio',
            Number(latent.scaffold_first_attach_ratio),
        ),
        scaffoldAnchorLowerBias: clampByPhenotypeKey(
            'scaffoldAnchorLowerBias',
            scaffoldAnchorLowerBias,
        ),
        scaffoldRootGlobalPitch: clampByPhenotypeKey(
            'scaffoldRootGlobalPitch',
            scaffoldGlobalPitchRad,
        ),
        scaffoldRootLocalWeight: clampByPhenotypeKey(
            'scaffoldRootLocalWeight',
            scaffoldLocalWeight,
        ),
        scaffoldBackboneGravity: clampByPhenotypeKey(
            'scaffoldBackboneGravity',
            scaffoldGravity,
        ),
        scaffoldBackboneWindStrength: clampByPhenotypeKey(
            'scaffoldBackboneWindStrength',
            scaffoldWindStrength,
        ),
        scaffoldBackboneWindBias: clampByPhenotypeKey(
            'scaffoldBackboneWindBias',
            scaffoldWindBias,
        ),
        scaffoldDensity: clampByPhenotypeKey(
            'scaffoldDensity',
            scaffoldDensity,
        ),
        scaffoldUpperCoverage: clampByPhenotypeKey(
            'scaffoldUpperCoverage',
            scaffoldUpperCoverage,
        ),
        scaffoldDistributionMode: clampByPhenotypeKey(
            'scaffoldDistributionMode',
            scaffoldDistributionMode,
        ),
        scaffoldShapeMode: clampByPhenotypeKey(
            'scaffoldShapeMode',
            scaffoldShapeMode,
        ),
        scaffoldSpacingDecay: clampByPhenotypeKey(
            'scaffoldSpacingDecay',
            scaffoldSpacingDecay,
        ),
        scaffoldNodeTwigProb: clampByPhenotypeKey(
            'scaffoldNodeTwigProb',
            scaffoldNodeTwigProb,
        ),
        scaffoldTurnStraightBias: clampByPhenotypeKey(
            'scaffoldTurnStraightBias',
            scaffoldTurnStraightBias,
        ),
        scaffoldTurnSweepProb: clampByPhenotypeKey(
            'scaffoldTurnSweepProb',
            scaffoldTurnSweepProb,
        ),
        scaffoldTurnKinkProb: clampByPhenotypeKey(
            'scaffoldTurnKinkProb',
            scaffoldTurnKinkProb,
        ),
        scaffoldTurnSweepAmpDeg: clampByPhenotypeKey(
            'scaffoldTurnSweepAmpDeg',
            scaffoldTurnSweepAmpDeg,
        ),
        scaffoldTurnSweepFreq: clampByPhenotypeKey(
            'scaffoldTurnSweepFreq',
            scaffoldTurnSweepFreq,
        ),
        scaffoldTurnKinkAngleDeg: clampByPhenotypeKey(
            'scaffoldTurnKinkAngleDeg',
            scaffoldTurnKinkAngleDeg,
        ),
        scaffoldTurnRecovery: clampByPhenotypeKey(
            'scaffoldTurnRecovery',
            scaffoldTurnRecovery,
        ),
        scaffoldTurnPersistence: clampByPhenotypeKey(
            'scaffoldTurnPersistence',
            scaffoldTurnPersistence,
        ),
        scaffoldTurnNoise: clampByPhenotypeKey(
            'scaffoldTurnNoise',
            scaffoldTurnNoise,
        ),
        scaffoldTurnDepthDamping: clampByPhenotypeKey(
            'scaffoldTurnDepthDamping',
            scaffoldTurnDepthDamping,
        ),
        scaffoldTierBranchAngle: clampByPhenotypeKey(
            'scaffoldTierBranchAngle',
            0.56 + (primaryAngleBiasRad * 0.5),
        ),
        scaffoldTierAngleVar: clampByPhenotypeKey(
            'scaffoldTierAngleVar',
            0.18 + (nAngleStd * 0.08),
        ),
        scaffoldStrength: clampByPhenotypeKey(
            'scaffoldStrength',
            0.24 + (nApical * 0.58) + (nVigor * 0.06) - (nRamification * 0.04),
        ),
    };
};

export const compileTwigTierPhenotypeOverrides = (context = {}) => {
    const {
        latent,
        nVigor,
        nApical,
        nRamification,
        nInternodeCv,
        nStraightness,
        nTwigCompact,
        nTwigUpwardBias,
        nAngleStd,
        nFlowerBud,
        nClusterTight,
        twigStyleMode,
        primaryAngleBiasRad,
        twigNodeBudgetCap,
        twigSpawnMinWidth,
        droopRaw,
        clampByPhenotypeKey,
        mapRange,
        blendStyleMode,
    } = context;

    return {
        twigTierLengthDecay: clampByPhenotypeKey(
            'twigTierLengthDecay',
            Number(latent.twig_length_decay),
        ),
        twigTierWidthDecay: clampByPhenotypeKey(
            'twigTierWidthDecay',
            Number(latent.twig_width_decay),
        ),
        twigTierBranchingProb: clampByPhenotypeKey(
            'twigTierBranchingProb',
            0.08 + (nRamification * 0.62) + (nVigor * 0.07) - (nApical * 0.03),
        ),
        twigTierStartWidth: clampByPhenotypeKey(
            'twigTierStartWidth',
            0.82 - (nTwigCompact * 0.36) + (nStraightness * 0.08),
        ),
        twigTierLengthVar: clampByPhenotypeKey(
            'twigTierLengthVar',
            0.16 + ((1 - nStraightness) * 0.42) + (nInternodeCv * 0.22),
        ),
        twigTierWidthVar: clampByPhenotypeKey(
            'twigTierWidthVar',
            0.14 + ((1 - nStraightness) * 0.3) + (nInternodeCv * 0.24),
        ),
        primaryBranchTransitionDepth: clampByPhenotypeKey(
            'primaryBranchTransitionDepth',
            1 + (nApical * 1.8),
        ),
        twigFirstTripleChance: clampByPhenotypeKey('twigFirstTripleChance', 0.08 + (nRamification * 0.46)),
        twigNodeBudgetCap: clampByPhenotypeKey('twigNodeBudgetCap', twigNodeBudgetCap),
        twigSpawnMinWidth: clampByPhenotypeKey('twigSpawnMinWidth', twigSpawnMinWidth),
        twigTierBranchAngle: clampByPhenotypeKey(
            'twigTierBranchAngle',
            blendStyleMode(twigStyleMode, 0.58, 0.82, 1.06) + (primaryAngleBiasRad * 0.52),
        ),
        twigTierAngleVar: clampByPhenotypeKey(
            'twigTierAngleVar',
            blendStyleMode(twigStyleMode, 0.18, 0.42, 0.7) + (nAngleStd * 0.08),
        ),
        droopMiddle: clampByPhenotypeKey(
            'droopMiddle',
            mapRange(droopRaw, -0.2, 0.8, -0.32, 0.62),
        ),
        droopTip: clampByPhenotypeKey(
            'droopTip',
            mapRange(droopRaw, -0.2, 0.8, -0.28, 0.72),
        ),
        twigUpwardBiasProb: clampByPhenotypeKey(
            'twigUpwardBiasProb',
            0.08 + (nTwigUpwardBias * 0.74),
        ),
        maxRelativeBendDeg: clampByPhenotypeKey(
            'maxRelativeBendDeg',
            mapRange(latent.max_relative_bend_deg, 70, 130, 70, 130),
        ),
        twigNodeBloomChance: clampByPhenotypeKey(
            'twigNodeBloomChance',
            0.05 + (nFlowerBud * 0.32) + (nClusterTight * 0.24),
        ),
    };
};

export const compileCanopyTierPhenotypeOverrides = (context = {}) => {
    const {
        latent,
        nTrunkBase,
        nCanopyRatio,
        nNegativeSpace,
        nFlowerBud,
        nClusterSize,
        nClusterTight,
        nSeasonal,
        nPetalVariance,
        phototropic,
        lateralOffset,
        phaseOffset,
        nRamification,
        clampByPhenotypeKey,
        mapRange,
    } = context;

    return {
        verticalBias: clampByPhenotypeKey(
            'verticalBias',
            0.58 + ((nCanopyRatio - 0.5) * 0.7) - (Math.abs(phototropic) / 0.4) * 0.12,
        ),
        windMemory: clampByPhenotypeKey(
            'windMemory',
            (phototropic * 0.5) + (lateralOffset * 0.18),
        ),
        trunkOffsetX: clampByPhenotypeKey(
            'trunkOffsetX',
            mapRange(lateralOffset, -0.5, 0.5, -0.22, 0.22),
        ),
        silhouetteTarget: clampByPhenotypeKey(
            'silhouetteTarget',
            0.28 + ((nCanopyRatio - 0.5) * 0.24) + (nNegativeSpace * 0.18),
        ),
        canopyShapeBias: clampByPhenotypeKey(
            'canopyShapeBias',
            0.5 + ((nCanopyRatio - 0.5) * 0.4),
        ),
        canopyLayerBalance: clampByPhenotypeKey(
            'canopyLayerBalance',
            0.45 + (nSeasonal * 0.4) - (nPetalVariance * 0.15),
        ),
        crossingAvoidance: clampByPhenotypeKey('crossingAvoidance', 0.45 + (nNegativeSpace * 0.45)),
        negativeSpaceChance: clampByPhenotypeKey(
            'negativeSpaceChance',
            mapRange(latent.negative_space_target, 0.05, 0.35, 0.02, 0.28),
        ),
        potScale: clampByPhenotypeKey(
            'potScale',
            1.02 + ((nTrunkBase - 0.5) * 0.08) - ((nCanopyRatio - 0.5) * 0.05),
        ),
        flowerChance: clampByPhenotypeKey(
            'flowerChance',
            0.2 + (nFlowerBud * 0.62) + (nSeasonal * 0.12),
        ),
        seasonalBloomBias: clampByPhenotypeKey(
            'seasonalBloomBias',
            0.28 + (nSeasonal * 0.56) + (phaseOffset / 0.4) * 0.08,
        ),
        bloomClusterBias: clampByPhenotypeKey(
            'bloomClusterBias',
            0.22 + (nClusterTight * 0.64) + (nClusterSize * 0.1),
        ),
        canopyBloomDensity: clampByPhenotypeKey(
            'canopyBloomDensity',
            0.26 + (nFlowerBud * 0.54) + (nClusterSize * 0.18),
        ),
        canopyBloomRadius: clampByPhenotypeKey(
            'canopyBloomRadius',
            0.46 + (nClusterSize * 0.46) - (nClusterTight * 0.28),
        ),
        foliageMin: clampByPhenotypeKey(
            'foliageMin',
            mapRange(latent.flower_cluster_size, 1, 7, 2, 5),
        ),
        foliageVar: clampByPhenotypeKey(
            'foliageVar',
            2 + (nClusterSize * 2.8) + (nPetalVariance * 1.8),
        ),
        noiseStrength: clampByPhenotypeKey(
            'noiseStrength',
            0.24 + (nRamification * 0.46) + (Math.abs(phototropic) * 0.28) + (nPetalVariance * 0.18),
        ),
        noiseScale: clampByPhenotypeKey(
            'noiseScale',
            0.012 + ((1 - nRamification) * 0.018) + (nPetalVariance * 0.012),
        ),
        noiseDepthDecay: clampByPhenotypeKey(
            'noiseDepthDecay',
            0.78 + (nSeasonal * 0.18),
        ),
        speciesCharacter: clampByPhenotypeKey(
            'speciesCharacter',
            0.74 + (nSeasonal * 0.18) + (nFlowerBud * 0.08),
        ),
    };
};
