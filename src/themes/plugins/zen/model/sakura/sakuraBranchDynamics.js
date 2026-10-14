import { SAKURA_BRANCH_ORDER } from '../bonsai/generation/shapePriorModel';
import { SakuraTrunkSplineModel } from '../bonsai/generation/SakuraTrunkSplineModel';
import {
    clamp,
    lerp,
} from './sakuraMath';

const nextStochastic = (rng = null, decisionType = 'random') => {
    if (typeof rng?.next === 'function') {
        const value = Number(rng.next(decisionType));
        if (Number.isFinite(value)) {
            return value;
        }
    }
    // Canonical path must stay deterministic under CRN.
    return 0.5;
};

export const sampleCenteredNoise = (rng = null, amplitude = 1, decisionType = 'centered') => (
    (nextStochastic(rng, decisionType) - 0.5) * amplitude
);

const sampleNoiseField2D = (x, y, scale, phase) => {
    const sx = x * scale;
    const sy = y * scale;
    return (
        Math.sin(sx + phase)
        + Math.sin(sy + phase * 1.3) * 0.5
        + Math.sin((sx + sy) * 2.5 + phase * 0.7) * 0.25
    ) / 1.75;
};

export const buildSakuraBranchConfigs = ({
    gene,
    morphologyProfile,
    scaffoldStrength,
    nextRandom,
    localRandom,
    branchCount,
    progress,
    isTrunk,
    isTwig,
    isBranch,
    isSecondaryBranch,
    orderRunDepth,
    lastDir,
    scaffoldBand,
    noiseTwist,
    twigStartScale,
    branchWidthScale,
    trunkScaffoldSideSign = null,
    trunkBifurcationSpec = null,
}) => {
    const configs = [];
    const formPads = isBranch && gene.branchChaos < 0.45;
    const spacingBias = (gene.branchSpacing - 0.5) * 0.5;
    const silhouetteBias = lerp(-0.12, 0.18, gene.silhouetteTarget);
    const canopyLift = (gene.canopyLayerBalance - 0.5) * 0.3;
    const trunkTierAngleBase = clamp(gene.trunkTierBranchAngle ?? 0.5, 0.1, 1.5);
    const trunkTierAngleVarianceNorm = clamp(gene.trunkTierAngleVar ?? 0.15, 0, 1);
    const trunkTierAngleVarianceRad = lerp(0.02, 0.92, trunkTierAngleVarianceNorm);
    const primaryBase = sampleCenteredNoise(
        localRandom,
        gene.branchChaos * (isTrunk ? 1 : lerp(1.04, 0.62, morphologyProfile.branchStraightness)),
        'primary_base',
    );
    const structuralTwist = noiseTwist * (isSecondaryBranch ? 0.28 : 0.5);
    const padSide = orderRunDepth % 2 === 0 ? 1 : -1;
    const randomAlternation = nextRandom(localRandom, 'primary_alternation') < gene.primaryAlternation
        ? -lastDir
        : lastDir;
    const alternation = isTrunk
        ? (Number.isFinite(lastDir) && lastDir !== 0 ? Math.sign(lastDir) : 1)
        : (
            (isBranch && (formPads || (gene.branchChaos < 0.72 && progress < 0.78)))
                ? padSide
                : randomAlternation
        );
    const primaryOffset = primaryBase + alternation * spacingBias * 0.35 + canopyLift * (1 - progress) + structuralTwist;
    const twigContinuationJitter = isTwig
        ? sampleCenteredNoise(
            localRandom,
            lerp(0.12, 0.26, 1 - clamp(morphologyProfile.branchStraightness, 0, 1)),
            'twig_continuation_jitter',
        )
        : 0;
    const continuationOffset = isTrunk
        ? 0
        : ((primaryOffset + twigContinuationJitter) * (isTwig ? 1.12 : 1));
    const continuationLenScale = isTrunk
        ? 1
        : (isTwig ? 1.04 : 0.95);
    configs.push({
        angleOffset: continuationOffset,
        lenMult: gene.lengthBase * twigStartScale * continuationLenScale,
        widthMult: gene.widthBase * branchWidthScale,
        dir: alternation,
        isContinuation: true,
    });

    if (isTrunk && trunkBifurcationSpec && branchCount > 1) {
        const splitSign = Math.sign(Number(trunkBifurcationSpec.splitSign) || 1) || 1;
        const majorShare = clamp(Number(trunkBifurcationSpec.majorShare ?? 0.65), 0.3, 0.7);
        const minorShare = clamp(Number(trunkBifurcationSpec.minorShare ?? (1 - majorShare)), 0.3, 0.7);
        const spreadRad = clamp(Number(trunkBifurcationSpec.spreadRad ?? 0.3), 0.12, 0.78);
        const widthPoolScale = clamp(Number(trunkBifurcationSpec.poolScale ?? 1.5), 1, 1.8);
        const splitWidthDecay = clamp(Number(trunkBifurcationSpec.widthDecay ?? 0.9), 0.72, 1);
        const widthPoolGain = widthPoolScale * splitWidthDecay;
        const majorJitter = sampleCenteredNoise(localRandom, spreadRad * 0.06, 'trunk_split_major_jitter');
        const minorJitter = sampleCenteredNoise(localRandom, spreadRad * 0.1, 'trunk_split_minor_jitter');
        const majorOffset = clamp(
            (splitSign * spreadRad * 0.18) + majorJitter,
            -spreadRad * 0.45,
            spreadRad * 0.45,
        );
        const minorOffset = clamp(
            (-splitSign * spreadRad * lerp(0.82, 1.06, nextRandom(localRandom, 'trunk_split_minor_spread')))
            + minorJitter,
            -spreadRad * 1.2,
            spreadRad * 1.2,
        );

        return [
            {
                angleOffset: majorOffset,
                lenMult: gene.lengthBase * twigStartScale * 1.04,
                widthMult: gene.widthBase * branchWidthScale,
                dir: splitSign,
                isContinuation: true,
                isTrunkSplitContinuation: true,
                splitWidthScale: widthPoolGain * majorShare * 0.92,
                splitLengthScale: lerp(0.98, 1.08, majorShare),
            },
            {
                angleOffset: minorOffset,
                lenMult: gene.lengthBase * twigStartScale * 0.9,
                widthMult: gene.widthBase * branchWidthScale,
                dir: -splitSign,
                // Keep split-minor as a side scaffold so only one true trunk continuation remains.
                isContinuation: false,
                isTrunkSplitContinuation: true,
                forcedOrder: SAKURA_BRANCH_ORDER.PRIMARY_BRANCH,
                forceAttachT: 0.84,
                splitWidthScale: widthPoolGain * minorShare * 0.58,
                splitLengthScale: lerp(0.72, 0.88, majorShare),
            },
        ];
    }

    if (branchCount > 1) {
        const sideBranchCount = Math.max(1, Math.round(branchCount) - 1);
        const sideDirBase = (
            isTrunk
            && Number.isFinite(Number(trunkScaffoldSideSign))
            && Math.sign(Number(trunkScaffoldSideSign)) !== 0
        )
            ? Math.sign(Number(trunkScaffoldSideSign))
            : (alternation * -1);
        const branchArcVarianceScale = isTrunk
            ? 1
            : (isTwig
                ? lerp(1.02, 0.56, morphologyProfile.branchStraightness)
                : lerp(1.04, 0.68, morphologyProfile.branchStraightness));
        const branchArcBase = isTrunk
            ? trunkTierAngleBase
            : gene.branchAngleBase;
        const branchArcVariance = isTrunk
            ? trunkTierAngleVarianceRad
            : gene.branchAngleVar;
        const droop = scaffoldBand
            ? lerp(-0.24, 0.04, clamp(gene.droopMiddle, 0, 1))
            : (progress > 0.35 ? gene.droopMiddle : gene.droopTip);
        const scaffoldSpread = scaffoldBand
            ? lerp(0.62, 1.04, scaffoldStrength)
            : 1;
        const secondarySpreadScale = isTrunk
            ? 1
            : lerp(0.84, 1.04, morphologyProfile.branchStraightness);
        const sideBaseWidthMult = isTrunk
            ? (
                (0.64 + (1 - progress) * 0.24)
                * lerp(0.96, 1.08, clamp((gene.scaffoldTierStartWidth - 0.5) / 1, 0, 1))
            )
            : (0.6 + (1 - progress) * 0.2);
        const defaultThickScaffoldChance = clamp(
            0.06
            + scaffoldStrength * 0.14
            + clamp((gene.scaffoldTierStartWidth - 1) / 0.5, -1, 1) * 0.06,
            0.04,
            0.24,
        );
        const thickScaffoldChance = isTrunk
            ? clamp(
                Number(gene.scaffoldThickChance ?? defaultThickScaffoldChance),
                0,
                0.28,
            )
            : 0;
        const thickScaffoldGate = isTrunk
            && nextRandom(localRandom, 'secondary_scaffold_thick_gate') < thickScaffoldChance;
        const transitionWidthBoost = thickScaffoldGate
            ? lerp(1.02, 1.12, nextRandom(localRandom, 'secondary_scaffold_thick_boost'))
            : 1;
        const sideWidthFloorBoost = thickScaffoldGate
            ? lerp(1.02, 1.16, nextRandom(localRandom, 'secondary_scaffold_floor_boost'))
            : 1;

        for (let sideIndex = 0; sideIndex < sideBranchCount; sideIndex += 1) {
            const sideMix = sideBranchCount > 1
                ? sideIndex / Math.max(1, sideBranchCount - 1)
                : 0;
            const sideDir = sideBranchCount > 1
                ? (sideIndex % 2 === 0 ? sideDirBase : -sideDirBase)
                : sideDirBase;
            const sideSpreadGain = sideBranchCount > 1
                ? lerp(0.86, 1.14, sideMix)
                : 1;
            const branchArc = (
                branchArcBase
                + nextRandom(localRandom, `secondary_branch_arc_${sideIndex}`) * branchArcVariance * branchArcVarianceScale
            ) * sideSpreadGain;
            const crossingShield = gene.crossingAvoidance * 0.28 * sideDir;
            const verticalPull = (1 - gene.verticalBias) * 0.18 * sideDir;
            const twigSpread = isTwig
                ? clamp(
                    0.62
                    + nextRandom(localRandom, `secondary_twig_spread_${sideIndex}`) * 0.92
                    + gene.branchChaos * 0.32,
                    0.56,
                    1.8,
                )
                : 1.0;
            const droopDrift = sideDir * droop * (isTwig ? 0.55 : 0.72);
            const sideSilhouetteBias = silhouetteBias * sideDir;
            const rawSecondaryOffset = sideDir * branchArc * scaffoldSpread
                + droopDrift
                + verticalPull
                + sideSilhouetteBias
                + crossingShield;
            const guardedSecondaryOffset = rawSecondaryOffset
                * twigSpread
                * secondarySpreadScale
                * (isTwig ? 1.24 : 1);
            const sideLenScale = sideBranchCount > 1 ? lerp(1, 0.84, sideMix * 0.9) : 1;
            const sideWidthScale = sideBranchCount > 1 ? lerp(1, 0.86, sideMix * 0.86) : 1;
            const attachCenter = sideBranchCount > 1
                ? clamp(
                    0.62 + ((sideIndex + 1) / (sideBranchCount + 1)) * 0.3,
                    0.56,
                    0.94,
                )
                : null;
            const attachJitter = sideBranchCount > 1
                ? (nextRandom(localRandom, `secondary_attach_jitter_${sideIndex}`) - 0.5) * 0.1
                : 0;
            const forceAttachT = Number.isFinite(attachCenter)
                ? clamp(attachCenter + attachJitter, 0.56, 0.96)
                : undefined;
            const sideConfig = {
                angleOffset: guardedSecondaryOffset,
                lenMult: (
                    (0.6 + (1 - progress) * 0.26)
                    * (isTwig ? 1.14 : 1)
                    * twigStartScale
                    * sideLenScale
                ),
                widthMult: sideBaseWidthMult * branchWidthScale * sideWidthScale,
                transitionWidthBoost,
                sideWidthFloorBoost,
                dir: sideDir,
                isContinuation: false,
            };
            if (Number.isFinite(forceAttachT)) {
                sideConfig.forceAttachT = forceAttachT;
            }
            configs.push(sideConfig);
        }
    }

    return configs;
};

export const resolveSakuraCurveState = ({
    gene,
    morphologyProfile,
    localRandom,
    currentX,
    currentY,
    roleDepth,
    length,
    progress,
    isTrunk,
    isTwig,
    isSecondaryBranch,
    trunkSpline,
    trunkMainDepth,
    trunkSegmentLimit,
}) => {
    const depthLevel = Math.max(0, roleDepth - 1);
    const depthCurveDecay = Math.pow(gene.curvatureDepthDecay || 0.84, depthLevel);
    const depthNoiseDecay = Math.pow(gene.noiseDepthDecay || 0.88, depthLevel);

    let noiseTwist = 0;
    let sakuraCurve = 0;

    if (isTrunk) {
        const trunkBackboneLock = clamp(gene.trunkBackboneLockStrength ?? 0.62, 0, 1);
        const backboneCurve = SakuraTrunkSplineModel.resolveCurveForLength(
            trunkSpline,
            trunkMainDepth,
            length,
            0,
            trunkSegmentLimit,
        );
        const trunkCurveGain = SakuraTrunkSplineModel.resolveCurveGain(
            trunkSpline,
            trunkMainDepth,
            trunkSegmentLimit,
        );
        const curveJitterCap = (
            Math.abs(backboneCurve) * lerp(0.01, 0.12, 1 - trunkBackboneLock)
            + length * lerp(0.002, 0.018, clamp(gene.branchChaos ?? 0.5, 0, 1) * (1 - trunkBackboneLock))
        );
        const curveJitter = sampleCenteredNoise(
            localRandom,
            curveJitterCap * 2,
            'trunk_backbone_curve_jitter',
        );
        sakuraCurve = (backboneCurve * trunkCurveGain) + curveJitter;
    } else {
        const branchVarianceScale = lerp(1.06, 0.58, morphologyProfile.branchStraightness);
        let noiseAmplitude = gene.curvatureVar * depthNoiseDecay * branchVarianceScale;
        if (isTwig) {
            noiseAmplitude *= 0.34;
        }
        if (isSecondaryBranch) {
            noiseAmplitude *= 0.68;
        }

        const curvePhaseSeed = nextStochastic(localRandom, 'curve_phase_seed');
        const curvePhase = Math.sin((roleDepth + curvePhaseSeed) * Math.PI * 0.55);
        const freqMod = Math.sin((roleDepth + 1) * gene.curvatureFreq * Math.PI);
        const chaos = sampleCenteredNoise(localRandom, noiseAmplitude, 'curve_chaos');
        const twigWobble = isTwig
            ? sampleCenteredNoise(
                localRandom,
                0.045 + clamp(gene.branchChaos ?? 0.5, 0, 1) * 0.06,
                'twig_wobble',
            )
            : 0;
        const styleLean = (gene.verticalBias - 0.5) * (1 - progress);
        const windMemoryDrift = gene.windMemory * (0.4 + progress * 0.8) * curvePhase * 0.6;
        const organicNoise = sampleNoiseField2D(
            currentX,
            currentY,
            gene.noiseScale || 0.02,
            gene.noisePhase || 0,
        );
        noiseTwist = organicNoise
            * (gene.noiseStrength || 0.5)
            * depthNoiseDecay
            * (isSecondaryBranch ? 0.58 : 1);
        const roleCurveScale = isSecondaryBranch ? 0.52 : 0.74;
        const baseCurve = (isTwig
            ? gene.curvatureBase * lerp(0.14, 0.22, 1 - clamp(morphologyProfile.branchStraightness, 0, 1))
            : gene.curvatureBase)
            * depthCurveDecay
            * roleCurveScale;
        const baseCurveTerm = (curvePhase * baseCurve) * freqMod;
        sakuraCurve = (
            baseCurveTerm
            + chaos
            + twigWobble
            + styleLean
            + windMemoryDrift
            + noiseTwist
        ) * length;
    }

    if (isTwig) sakuraCurve *= 0.42;
    if (isSecondaryBranch && !isTwig) {
        sakuraCurve *= 0.68;
    }

    const safeLength = Math.max(1e-3, length);
    const curveRatio = sakuraCurve / safeLength;
    const curveRatioLimit = isTrunk
        ? lerp(0.06, 0.18, clamp(gene.trunkStyle ?? 0.5, 0, 1))
        : (isTwig ? 0.2 : 0.28);
    const saturatedCurveRatio = Math.tanh(curveRatio / Math.max(1e-4, curveRatioLimit)) * curveRatioLimit;

    return {
        sakuraCurve: saturatedCurveRatio * safeLength,
        noiseTwist,
    };
};
