import { resolveNumber } from './sakuraRuntimeParams.shared';

const resolveScaffoldDistributionRuntimeParams = (gene = {}) => ({
    density: resolveNumber(gene.scaffoldDensity, 0.42, 0, 1),
    upperCoverage: resolveNumber(gene.scaffoldUpperCoverage, 0.58, 0, 1),
    distributionMode: resolveNumber(gene.scaffoldDistributionMode, 0.5, 0, 1),
    shapeMode: resolveNumber(gene.scaffoldShapeMode, 0.5, 0, 1),
    spacingDecay: resolveNumber(gene.scaffoldSpacingDecay, 1.03, 0.92, 1.2),
    firstAttachRatio: resolveNumber(gene.scaffoldFirstAttachRatio, 0.16, 0.06, 0.9),
    anchorLowerBias: resolveNumber(gene.scaffoldAnchorLowerBias, 0.58, 0, 1),
});

const resolveScaffoldTurnRuntimeParams = (gene = {}) => ({
    straightBias: resolveNumber(gene.scaffoldTurnStraightBias, 0.52, 0, 1),
    sweepProb: resolveNumber(gene.scaffoldTurnSweepProb, 0.34, 0, 1),
    kinkProb: resolveNumber(gene.scaffoldTurnKinkProb, 0.09, 0, 1),
    sweepAmpDeg: resolveNumber(gene.scaffoldTurnSweepAmpDeg, 18, 0, 40),
    sweepFreq: resolveNumber(gene.scaffoldTurnSweepFreq, 0.45, 0.1, 3.2),
    kinkAngleDeg: resolveNumber(gene.scaffoldTurnKinkAngleDeg, 16, 2, 48),
    recovery: resolveNumber(gene.scaffoldTurnRecovery, 0.42, 0, 1),
    persistence: resolveNumber(gene.scaffoldTurnPersistence, 0.58, 0, 1),
    noise: resolveNumber(gene.scaffoldTurnNoise, 0.22, 0, 1),
    depthDamping: resolveNumber(gene.scaffoldTurnDepthDamping, 0.54, 0, 1),
});

export const resolveSakuraScaffoldRuntimeParams = (gene = {}) => ({
    root: {
        globalPitch: resolveNumber(gene.scaffoldRootGlobalPitch, 0, -0.9, 0.9),
        localWeight: resolveNumber(gene.scaffoldRootLocalWeight, 0.2, 0, 1),
    },
    backbone: {
        gravity: resolveNumber(gene.scaffoldBackboneGravity, 0.34, 0, 1),
        windStrength: resolveNumber(gene.scaffoldBackboneWindStrength, 0.12, 0, 1),
        windBias: resolveNumber(gene.scaffoldBackboneWindBias, 0, -1, 1),
    },
    distribution: resolveScaffoldDistributionRuntimeParams(gene),
    twigSpawn: {
        nodeProb: resolveNumber(gene.scaffoldNodeTwigProb, 0.72, 0.08, 0.98),
    },
    turn: resolveScaffoldTurnRuntimeParams(gene),
});
