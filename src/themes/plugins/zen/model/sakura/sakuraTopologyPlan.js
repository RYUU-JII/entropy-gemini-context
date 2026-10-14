import {
    clamp,
    lerp,
} from './sakuraMath';
import { resolveSakuraTrunkGeminiParamsFromGene } from './sakuraTrunkGeminiParams';
import { resolveSakuraScaffoldRuntimeParams } from './sakuraRuntimeParams.scaffold';

const smoothstep = (edge0 = 0, edge1 = 1, value = 0) => {
    const span = Math.max(1e-6, Number(edge1) - Number(edge0));
    const t = clamp(((Number(value) || 0) - Number(edge0)) / span, 0, 1);
    return t * t * (3 - (2 * t));
};

const resolveScaffoldProfileModeBlend = (modeNorm = 0.5, values = []) => {
    if (!Array.isArray(values) || values.length === 0) {
        return 1;
    }
    const maxIndex = values.length - 1;
    const scaled = clamp(modeNorm, 0, 1) * maxIndex;
    const leftIndex = clamp(Math.floor(scaled), 0, maxIndex);
    const rightIndex = clamp(leftIndex + 1, 0, maxIndex);
    const mix = clamp(scaled - leftIndex, 0, 1);
    return lerp(values[leftIndex], values[rightIndex], mix);
};

const resolveScaffoldProfileDensityWeight = ({
    modeNorm = 0.5,
    heightNorm = 0,
}) => {
    const t = clamp(heightNorm, 0, 1);

    const column = 1;
    // Triangle: denser near lower scaffold band.
    const triangular = lerp(1.62, 0.7, t);
    // Dome: denser near mid band.
    const dome = 0.36 + (Math.pow(Math.sin(Math.PI * t), 1.1) * 1.5);
    // Mushroom: denser upper-mid, then drop near tip.
    const mushroom = (
        0.22
        + (smoothstep(0.2, 0.68, t) * 1.72)
        - (smoothstep(0.84, 1, t) * 1.16)
    );
    const gaussian = (center, sigma, amp) => (
        amp * Math.exp(-Math.pow(t - center, 2) / (2 * sigma * sigma))
    );
    // Tiered pads: multiple shelf-like peaks.
    const tiered = (
        0.08
        + gaussian(0.2, 0.055, 1.36)
        + gaussian(0.5, 0.07, 1.7)
        + gaussian(0.8, 0.055, 1.28)
    );

    return clamp(resolveScaffoldProfileModeBlend(modeNorm, [
        column,
        triangular,
        dome,
        mushroom,
        tiered,
    ]), 0.06, 3.4);
};

export const resolveSakuraTopologyPlan = ({
    gene,
    currentStage,
    height,
    topologyRandom,
    morphologyProfile,
    nextRandom,
    formCompositionPlan = null,
}) => {
    const scaffoldRuntime = resolveSakuraScaffoldRuntimeParams(gene);
    const scaffoldDistribution = scaffoldRuntime.distribution;
    const trunkRootWidth = clamp(
        (10 + Math.pow(gene.widthBase, 0.82) * 4.0) * lerp(0.88, 1.2, morphologyProfile.trunkMass),
        9,
        58,
    );
    const scaffoldStrength = clamp(gene.scaffoldStrength ?? 0.56, 0, 1);
    const scaffoldDensityControl = scaffoldDistribution.density;
    const scaffoldUpperCoverage = scaffoldDistribution.upperCoverage;
    const scaffoldDistributionMode = scaffoldDistribution.distributionMode;
    const canopyBloomDensity = clamp(gene.canopyBloomDensity ?? 0.62, 0, 1);
    const canopyBloomRadius = clamp(gene.canopyBloomRadius ?? 0.56, 0.25, 1.25);
    const learningProgress = clamp(currentStage?.learningProgress ?? 0, 0, 1);
    const priorStrength = 1 - learningProgress;
    const twigUpwardBiasProb = clamp(gene.twigUpwardBiasProb ?? 0.22, 0, 1);
    const maxRelativeBendDeg = clamp(gene.maxRelativeBendDeg ?? 96, 55, 102);
    const viewportHeight = Math.max(120, Number(height) || 360);
    const viewportHeightNorm = clamp((viewportHeight - 300) / 220, 0, 1);
    const lowHeightRelief = 1 - viewportHeightNorm;

    const canopyMaxDepth = currentStage.depth + 1;
    const trunkGeminiParams = resolveSakuraTrunkGeminiParamsFromGene(gene);
    const scaffoldDepthBlend = clamp(
        0.38 + clamp(gene.scaffoldStrength ?? 0.7, 0, 1) * 0.6,
        0,
        1,
    );
    const scaffoldDepthMin = 5;
    const scaffoldDepthHardCeil = 9;
    const scaffoldDepthCeil = Math.min(
        scaffoldDepthHardCeil,
        Math.max(4, canopyMaxDepth - 1),
    );
    const scaffoldMaxDepth = clamp(
        Math.round(
            lerp(
                scaffoldDepthMin,
                scaffoldDepthCeil,
                scaffoldDepthBlend,
            ),
        ),
        scaffoldDepthMin,
        scaffoldDepthCeil,
    );
    const twigDensitySignal = clamp(
        (clamp(gene.twigTierBranchingProb ?? 0.35, 0, 1) * 0.84)
        + (clamp(gene.branchingProb ?? 0.62, 0, 1) * 0.16),
        0,
        1,
    );
    const twigDepthCeil = Math.max(2, canopyMaxDepth + 2);
    const twigSoftDepthCap = 5;
    const twigDepthBase = (
        2
        + (Math.max(2, canopyMaxDepth - 1) * lerp(0.22, 0.56, twigDensitySignal))
        + lerp(-0.45, 0.1, viewportHeightNorm)
    );
    const twigMaxDepth = clamp(
        Math.round(twigDepthBase),
        2,
        Math.min(twigDepthCeil, twigSoftDepthCap),
    );

    // Trunk emission depth is materialized later by curvature-adaptive
    // subdivision. Topology owns continuous arc stations only.
    const structuralMaxDepth = canopyMaxDepth + 2;
    const defaultScaffoldSpacingDecay = 1.02 + (lowHeightRelief * 0.04);
    const scaffoldSpacingDecay = clamp(
        Number(gene.scaffoldSpacingDecay ?? defaultScaffoldSpacingDecay),
        0.92,
        1.2,
    );
    const defaultScaffoldStartRatio = (
        0.1 + nextRandom(topologyRandom, 'trunk_scaffold_arc_start') * 0.06
    );
    const scaffoldStartRatio = clamp(
        Number(gene.scaffoldFirstAttachRatio ?? defaultScaffoldStartRatio),
        0.06,
        0.9,
    );
    const scaffoldStartJitter = 0;
    const scaffoldArcMin = clamp(
        scaffoldStartRatio + scaffoldStartJitter,
        0.05,
        0.9,
    );
    const smallTreeDensityRelief = lerp(0.68, 1, viewportHeightNorm);
    const effectiveScaffoldDensity = clamp(scaffoldDensityControl * smallTreeDensityRelief, 0, 1);
    const spacingDecayNorm = clamp((scaffoldSpacingDecay - 0.92) / 0.28, 0, 1);
    const densityEff = Math.pow(effectiveScaffoldDensity, 0.92);
    const trunkLengthRef = Math.max(
        72,
        Number.isFinite(Number(trunkGeminiParams.maxHeight))
            ? Number(trunkGeminiParams.maxHeight)
            : (viewportHeight * 0.92),
    );
    // Keep a small apex reserve for the explicit apical station roles.
    const scaffoldNormalArcMax = 0.95;
    const usableArcSpan = Math.max(0.02, scaffoldNormalArcMax - scaffoldArcMin);
    const usableLengthRef = Math.max(24, trunkLengthRef * usableArcSpan);
    const countScale = lerp(0.92, 1.1, viewportHeightNorm);
    const coverageCountBoost = lerp(0.94, 1.42, scaffoldUpperCoverage);
    const meanGapPx = lerp(84, 18, densityEff) * lerp(1.08, 0.86, scaffoldUpperCoverage);
    const densityRootSoftCap = lerp(0.94, 0.99, densityEff);
    const rawRequestedCount = (
        (usableLengthRef / Math.max(8, meanGapPx))
        * countScale
        * coverageCountBoost
        * densityRootSoftCap
        + lerp(0.35, 1.75, densityEff)
    );
    const densityCountFloor = densityEff > lerp(0.24, 0.14, scaffoldUpperCoverage)
        ? 2
        : (densityEff > 0.04 ? 1 : 0);
    const maxRequestedCount = clamp(
        Math.round(
            (usableLengthRef / Math.max(8, meanGapPx * 0.56))
            * lerp(0.72, 1.16, densityEff),
        ),
        2,
        48,
    );
    const requestedCount = clamp(
        Math.round(rawRequestedCount),
        densityCountFloor,
        maxRequestedCount,
    );
    const minGapArcBase = clamp(
        (meanGapPx * 0.58) / Math.max(1, trunkLengthRef),
        0.006,
        0.12,
    );
    const candidateSlotCount = clamp(
        Math.round(usableArcSpan * 300),
        96,
        420,
    );
    const arcCandidates = [];
    const negativeSpace = formCompositionPlan?.negativeSpace || null;
    const reservedArcHalfWidth = negativeSpace
        ? negativeSpace.reservedArcWidth / 2
        : 0;
    for (let slot = 0; slot < candidateSlotCount; slot += 1) {
        const localNorm = (slot + 0.5) / candidateSlotCount;
        const arcNorm = scaffoldArcMin + (localNorm * usableArcSpan);
        if (
            negativeSpace
            && Math.abs(arcNorm - negativeSpace.reservedArcCenter) < reservedArcHalfWidth
        ) {
            continue;
        }
        const profileWeight = resolveScaffoldProfileDensityWeight({
            modeNorm: scaffoldDistributionMode,
            heightNorm: localNorm,
        });
        const upperCoverageBoost = smoothstep(0.58, 1, localNorm)
            * lerp(0.12, 1.02, scaffoldUpperCoverage)
            * lerp(0.24, 0.58, densityEff);
        const weight = clamp(
            profileWeight * (1 + upperCoverageBoost),
            1e-4,
            6,
        );
        arcCandidates.push({
            arcNorm,
            localNorm,
            weight,
        });
    }
    const selectedArcNorms = [];
    const pickCount = Math.min(requestedCount, arcCandidates.length);
    if (pickCount > 0) {
        for (let pickIndex = 0; pickIndex < pickCount; pickIndex += 1) {
            const available = [];
            let totalAvailableWeight = 0;
            arcCandidates.forEach((candidate) => {
                if (selectedArcNorms.some((pickedArc) => Math.abs(pickedArc - candidate.arcNorm) < 1e-6)) {
                    return;
                }
                const upwardGapScale = lerp(
                    1,
                    lerp(1.2, 0.54, spacingDecayNorm),
                    candidate.localNorm,
                );
                const minGapArc = clamp(minGapArcBase * upwardGapScale, 0.002, 0.2);
                const nearestArcDistance = selectedArcNorms.length
                    ? selectedArcNorms.reduce(
                        (nearest, arc) => Math.min(nearest, Math.abs(arc - candidate.arcNorm)),
                        Number.POSITIVE_INFINITY,
                    )
                    : Number.POSITIVE_INFINITY;
                if (nearestArcDistance <= minGapArc) {
                    return;
                }
                const crowdingScale = Number.isFinite(nearestArcDistance)
                    ? clamp(
                        nearestArcDistance / Math.max(minGapArc * 1.2, 1e-4),
                        0.22,
                        1,
                    )
                    : 1;
                const weighted = candidate.weight * crowdingScale;
                if (weighted <= 1e-6) {
                    return;
                }
                totalAvailableWeight += weighted;
                available.push({
                    arcNorm: candidate.arcNorm,
                    weighted,
                });
            });
            if (totalAvailableWeight <= 1e-6 || !available.length) {
                break;
            }
            let threshold = nextRandom(topologyRandom, `trunk_scaffold_arc_pick_${pickIndex}`)
                * totalAvailableWeight;
            let pickedArc = available[available.length - 1].arcNorm;
            for (let entryIndex = 0; entryIndex < available.length; entryIndex += 1) {
                threshold -= available[entryIndex].weighted;
                if (threshold <= 0) {
                    pickedArc = available[entryIndex].arcNorm;
                    break;
                }
            }
            selectedArcNorms.push(pickedArc);
        }
        if (pickCount >= 2 && scaffoldUpperCoverage > 0.06 && selectedArcNorms.length) {
            const upperBandStartArc = scaffoldArcMin + (usableArcSpan * lerp(0.78, 0.52, scaffoldUpperCoverage));
            const hasUpperCoverage = selectedArcNorms.some((arcNorm) => arcNorm >= upperBandStartArc);
            if (!hasUpperCoverage) {
                let bestUpperArc = null;
                let bestUpperWeight = -1;
                arcCandidates.forEach((candidate) => {
                    if (candidate.arcNorm < upperBandStartArc) {
                        return;
                    }
                    if (selectedArcNorms.some((pickedArc) => Math.abs(pickedArc - candidate.arcNorm) < 1e-6)) {
                        return;
                    }
                    if (candidate.weight > bestUpperWeight) {
                        bestUpperWeight = candidate.weight;
                        bestUpperArc = candidate.arcNorm;
                    }
                });
                if (bestUpperArc != null) {
                    let weakestIndex = -1;
                    let weakestWeight = Number.POSITIVE_INFINITY;
                    selectedArcNorms.forEach((arcNorm, index) => {
                        if (arcNorm >= upperBandStartArc) {
                            return;
                        }
                        const candidate = arcCandidates.find((entry) => Math.abs(entry.arcNorm - arcNorm) < 1e-6);
                        const weight = Number(candidate?.weight ?? 0);
                        if (weight < weakestWeight) {
                            weakestWeight = weight;
                            weakestIndex = index;
                        }
                    });
                    if (weakestIndex >= 0) {
                        selectedArcNorms.splice(weakestIndex, 1, bestUpperArc);
                    } else {
                        selectedArcNorms.push(bestUpperArc);
                    }
                }
            }
        }
    }
    selectedArcNorms.sort((a, b) => a - b);
    const trunkScaffoldStationSpecs = selectedArcNorms.map((arcNorm, index) => {
        const arcToken = clamp(arcNorm, 0, 1).toFixed(7);
        const formScaffold = formCompositionPlan?.scaffold || null;
        const sideSample = nextRandom(topologyRandom, `trunk_scaffold_side_arc_${arcToken}`);
        const alternateSide = index % 2 === 0 ? 1 : -1;
        const alternationOwned = formScaffold?.stationPattern === 'tiered_alternating';
        const asymmetricAlternationOwned = (
            formScaffold?.stationPattern === 'alternating_asymmetric'
        );
        const dominantProbability = formScaffold
            ? clamp(0.5 + (formScaffold.sideAsymmetry * 0.46), 0.5, 0.96)
            : 0.5;
        const side = alternationOwned
            ? alternateSide * formScaffold.dominantSide
            : (asymmetricAlternationOwned
                ? (sideSample < formScaffold.sideAsymmetry
                    ? formScaffold.dominantSide
                    : (alternateSide * formScaffold.dominantSide))
                : (sideSample < dominantProbability
                    ? (formScaffold?.dominantSide || 1)
                    : -(formScaffold?.dominantSide || 1)));
        return Object.freeze({
            arcNorm: clamp(arcNorm, 0, 1),
            side,
        });
    });

    return {
        canopyBloomDensity,
        canopyBloomRadius,
        canopyMaxDepth,
        learningProgress,
        maxRelativeBendDeg,
        priorStrength,
        scaffoldMaxDepth,
        scaffoldStrength,
        structuralMaxDepth,
        trunkRootWidth,
        trunkScaffoldStationSpecs,
        twigMaxDepth,
        twigUpwardBiasProb,
    };
};
