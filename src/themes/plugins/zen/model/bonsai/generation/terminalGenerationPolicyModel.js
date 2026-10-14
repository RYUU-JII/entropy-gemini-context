import { HardConstraintModel } from './hardConstraintModel';
import {
    resolveSakuraBlossomFacing,
    resolveSakuraFlowerScale,
} from './sakuraBlossomPolicyModel';
import {
    DEFAULT_SAKURA_BLOSSOM_LAB_TUNING,
    applySakuraBlossomLabTuning,
} from '../../sakura/sakuraBlossomLabTuningContract.js';

const clamp = (value, min, max) => HardConstraintModel.clamp(value, min, max);
const lerp = (a, b, t) => a + (b - a) * t;
const GOLDEN_ANGLE = 2.399963229728653;
const clamp01 = (value) => clamp(value, 0, 1);
const clampInt = (value, min, max, fallback) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return fallback;
    }
    return Math.max(min, Math.min(max, Math.round(numeric)));
};
const resolveStageVisualGate = (currentStage) => ({
    flower: clamp(currentStage?.flowerChance ?? 0, 0, 1),
    leaf: clamp(currentStage?.leafChance ?? 1, 0, 1),
});

const nextRandom = (rng, decisionType) => {
    if (typeof rng?.next === 'function') {
        const value = Number(rng.next(decisionType));
        if (Number.isFinite(value)) {
            return value;
        }
    }
    // Canonical path must stay deterministic under CRN.
    return 0.5;
};

const pickColor = (rng, palette = [], fallback = '#FFFFFF', decisionType = 'pick_color') => {
    if (!Array.isArray(palette) || !palette.length) {
        return fallback;
    }
    return palette[Math.floor(nextRandom(rng, decisionType) * palette.length)] || fallback;
};

const round3 = (value, fallback = 0) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return fallback;
    }
    return Number(numeric.toFixed(3));
};
const toNumber = (value, fallback = 0) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
};
const resolveSakuraBloomEcology = ({
    gene = {},
    angle = 0,
    exposure = 0.5,
    distanceRatio = 0.5,
    apexWeight = 0.5,
} = {}) => {
    const windMemory = clamp(toNumber(gene?.windMemory, 0), -0.28, 0.28);
    const windMemoryNorm = clamp01(Math.abs(windMemory) / 0.28);
    const windDirection = Math.sign(windMemory || 1);
    const lateralSide = Math.sin(Number(angle) || 0) * windDirection;
    const windwardSide = clamp01(0.5 + (lateralSide * 0.5));
    const outerExposure = clamp01(
        (clamp01(distanceRatio) * 0.46)
        + (clamp01(exposure) * 0.34)
        + ((1 - clamp01(apexWeight)) * 0.08)
        + (Math.abs(Math.sin(Number(angle) || 0)) * 0.12),
    );
    const windExposure = clamp01(windMemoryNorm * windwardSide * outerExposure);
    const shelteredDelay = clamp01(windMemoryNorm * (1 - windwardSide) * (1 - outerExposure) * 0.7);

    return {
        windExposure,
        shelteredDelay,
        outerExposure,
        bloomAdvance: clamp01((outerExposure * 0.62) + (windExposure * 0.38)),
    };
};

const resolveBlossomStageProfile = (stage) => {
    if (stage === 'bud') {
        return {
            minOpen: 0.12,
            maxOpen: 0.38,
            layeredBias: -0.28,
            cuppedBias: 0.32,
            petalLengthBias: -0.12,
            petalWidthBias: -0.04,
            ruffleBias: -0.28,
            coreBias: -0.24,
            innerScaleBias: -0.14,
            tiltScale: 0.42,
        };
    }
    if (stage === 'full') {
        return {
            minOpen: 0.74,
            maxOpen: 0.96,
            layeredBias: -0.16,
            cuppedBias: -0.18,
            petalLengthBias: 0.08,
            petalWidthBias: -0.08,
            ruffleBias: 0.02,
            coreBias: -0.22,
            innerScaleBias: -0.22,
            tiltScale: 0.88,
        };
    }
    return {
        minOpen: 0.38,
        maxOpen: 0.74,
        layeredBias: -0.08,
        cuppedBias: 0.08,
        petalLengthBias: 0,
        petalWidthBias: -0.04,
        ruffleBias: 0,
        coreBias: -0.12,
        innerScaleBias: -0.12,
        tiltScale: 0.66,
    };
};

const resolveLeafTemplateId = ({
    rng,
    context = 'terminal',
    index = 0,
    exposure = 0.5,
    clusterTightness = 0.5,
    speciesCharacter = 0.5,
} = {}) => {
    const signal = clamp01(
        (clamp01(exposure) * 0.28)
        + ((1 - clamp01(clusterTightness)) * 0.18)
        + (clamp01(speciesCharacter) * 0.18)
        + ((nextRandom(rng, `${context}_${index}_leaf_profile`) - 0.5) * 0.44)
        + 0.24,
    );
    if (signal < 0.34) {
        return 0;
    }
    if (signal < 0.68) {
        return 1;
    }
    return 2;
};

const resolveSakuraPedicelProfile = ({
    rng,
    context = 'terminal',
    index = 0,
    inCluster = false,
    distance = 0,
    blossom = null,
    outerBias = 0.5,
    clusterTightness = 0.5,
} = {}) => {
    const openness = clamp01(blossom?.openness ?? 0.72);
    const bloomStage = blossom?.bloomStage ?? 'full';
    const baseRatio = inCluster
        ? lerp(0.6, 0.76, 1 - clamp01(clusterTightness))
        : lerp(0.68, 0.88, clamp01(outerBias));
    const contextBias = context === 'canopy'
        ? 0.12
        : context === 'twig'
            ? -0.01
            : context === 'cluster'
                ? 0.06
                : 0.04;
    const stagePenalty = bloomStage === 'bud'
        ? 0.08
        : (bloomStage === 'half_open' ? 0.04 : 0);
    const resolvedDistance = Math.max(0.6, Number(distance) || 0);
    const pedicelLength = clamp(
        resolvedDistance * (baseRatio + contextBias + (openness * 0.1) - stagePenalty),
        context === 'twig' ? 2.2 : 2.8,
        Math.max(context === 'twig' ? 2.8 : 3.6, resolvedDistance - 0.55),
    );
    const pedicelBend = clamp(
        ((nextRandom(rng, `${context}_${index}_pedicel_bend`) - 0.5) * lerp(0.3, 0.84, 1 - clamp01(clusterTightness)))
        + ((nextRandom(rng, `${context}_${index}_pedicel_sway`) - 0.5) * lerp(0.1, 0.22, openness)),
        -0.68,
        0.68,
    );
    return {
        pedicelLength: round3(pedicelLength, 0),
        pedicelBend: round3(pedicelBend, 0),
    };
};

const resolveSakuraBlossomDescriptor = ({
    rng,
    gene = {},
    context = 'terminal',
    index = 0,
    angle = 0,
    clusterTightness = 0.5,
    flowerDominance = 0.5,
    exposure = 0.5,
    distanceRatio = 0.5,
    apexWeight = 0.5,
    blossomTuning = null,
    lineageBloomOffset = 0,
    lineagePetalFallOffset = 0,
} = {}) => {
    const bloomPeak = clamp01(gene?.bloomPeak ?? gene?.flowerChance ?? 0.5);
    const speciesCharacter = clamp01(gene?.speciesCharacter ?? 0.5);
    const warmth = clamp01(gene?.petalWarmth ?? 0.5);
    const countBias = clamp01(gene?.flowerClusterCountBias ?? gene?.bloomClusterBias ?? 0.5);
    const petalFallDensity = clamp01(gene?.petalFallDensity ?? 0.2);
    const bloomPhaseGradient = clamp01(
        gene?.bloomPhaseGradient
        ?? (
            (bloomPeak * 0.38)
            + (flowerDominance * 0.2)
            + (countBias * 0.12)
            + 0.16
        ),
    );
    const bloomOuterAdvance = clamp01(
        gene?.bloomOuterAdvance
        ?? (
            (bloomPeak * 0.28)
            + (flowerDominance * 0.18)
            + (clamp01(gene?.flowerOuterBias ?? 0.5) * 0.22)
            + 0.18
        ),
    );
    const bloomInnerDelay = clamp01(
        gene?.bloomInnerDelay
        ?? (
            ((1 - bloomPeak) * 0.18)
            + (clusterTightness * 0.18)
            + (countBias * 0.1)
            + 0.16
        ),
    );
    const spatialExposure = clamp01(
        (clamp01(exposure) * 0.72)
        + (clamp01(distanceRatio) * 0.28),
    );
    const bloomEcology = resolveSakuraBloomEcology({
        gene,
        angle,
        exposure,
        distanceRatio,
        apexWeight,
    });
    const contextStageBias = context === 'twig'
        ? -0.12
        : context === 'cluster'
            ? -0.04
            : context === 'canopy'
                ? 0.06
                : 0.02;
    const spatialStageBias = (
        lerp(0.08, 0.34, bloomOuterAdvance) * bloomPhaseGradient * spatialExposure
        - lerp(0.06, 0.24, bloomInnerDelay) * bloomPhaseGradient * (1 - spatialExposure)
    );
    const stageSignal = clamp01(
        lerp(0.16, 0.94, bloomPeak)
        + ((flowerDominance - 0.5) * 0.14)
        + contextStageBias
        + spatialStageBias
        + (bloomEcology.bloomAdvance * 0.055)
        - (bloomEcology.shelteredDelay * 0.045)
        + clamp(toNumber(lineageBloomOffset, 0), -0.32, 0.32)
        - (clusterTightness * 0.06)
        + ((nextRandom(rng, `${context}_${index}_blossom_stage`) - 0.5) * lerp(0.28, 0.14, bloomPhaseGradient)),
    );
    const bloomStage = stageSignal < 0.34
        ? 'bud'
        : (stageSignal > 0.72 ? 'full' : 'half_open');
    const stageProfile = resolveBlossomStageProfile(bloomStage);
    const stageDenominator = bloomStage === 'bud'
        ? 0.34
        : (bloomStage === 'full' ? 0.28 : 0.38);
    const stageStart = bloomStage === 'bud'
        ? 0
        : (bloomStage === 'full' ? 0.72 : 0.34);
    const stageRatio = clamp01((stageSignal - stageStart) / stageDenominator);
    const contextOpenBias = context === 'twig'
        ? 0.14
        : context === 'canopy'
            ? 0.22
            : context === 'cluster'
                ? 0.18
                : 0.14;
    const opennessBase = clamp01(
        lerp(0.42, 0.9, bloomPeak)
        + contextOpenBias
        + (spatialExposure * 0.08)
        + (bloomEcology.windExposure * 0.045)
        - (clusterTightness * 0.1)
        + ((nextRandom(rng, `${context}_${index}_blossom_open`) - 0.5) * 0.12),
    );
    const opennessSpatialLift = context === 'canopy'
        ? lerp(-0.04, 0.12, distanceRatio)
        : context === 'cluster'
            ? lerp(-0.02, 0.06, distanceRatio)
            : context === 'twig'
                ? lerp(0.02, 0.08, distanceRatio)
                : lerp(0, 0.04, distanceRatio);
    const openness = clamp(
        lerp(
            lerp(stageProfile.minOpen, stageProfile.maxOpen, stageRatio),
            opennessBase,
            bloomStage === 'full' ? 0.42 : (bloomStage === 'half_open' ? 0.36 : 0.24),
        ) + opennessSpatialLift,
        stageProfile.minOpen,
        stageProfile.maxOpen,
    );
    const tilt = round3(
        ((nextRandom(rng, `${context}_${index}_blossom_tilt`) - 0.5) * lerp(0.16, 0.34, openness))
        * stageProfile.tiltScale,
        0,
    );
    const fallContextBias = context === 'canopy'
        ? 0.06
        : context === 'cluster'
            ? 0.04
            : context === 'twig'
                ? -0.04
                : 0;
    const petalFallSignal = clamp01(
        lerp(0.02, 0.7, petalFallDensity)
        + (bloomStage === 'full' ? 0.18 : (bloomStage === 'half_open' ? 0.04 : -0.22))
        + ((stageSignal - 0.56) * 0.46)
        + (spatialExposure * 0.12)
        + (bloomEcology.windExposure * 0.22)
        + (bloomEcology.outerExposure * 0.045)
        + clamp(toNumber(lineagePetalFallOffset, 0), -0.32, 0.32)
        + fallContextBias
        + ((nextRandom(rng, `${context}_${index}_petal_fall`) - 0.5) * 0.12),
    );
    const petalFall = round3(
        bloomStage === 'bud'
            ? petalFallSignal * 0.08
            : (bloomStage === 'half_open' ? petalFallSignal * 0.58 : petalFallSignal),
        0,
    );
    const lightExposure = round3(clamp01(
        (spatialExposure * (context === 'canopy' ? 0.88 : 0.74))
        + (openness * 0.16)
        + (bloomEcology.windExposure * 0.04)
        + (context === 'canopy' ? 0.08 : (context === 'cluster' ? 0.04 : 0)),
    ), 0.56);
    const notchDepth = round3(clamp01(
        0.36
        + (openness * 0.24)
        + 0.08 // fixed form parameter
        + (bloomStage === 'bud' ? -0.08 : 0.04)
        + 0.18 // fixed silhouette parameter
        - (clusterTightness * 0.03),
    ), 0.6);
    const translucency = round3(clamp01(
        0.18
        + (openness * 0.14)
        + (lightExposure * 0.08)
        + (bloomEcology.windExposure * 0.045)
        + (warmth * 0.04)
        - (petalFall * 0.08),
    ), 0.34);
    const coreSize = round3(clamp01(
        lerp(0.08, 0.18, bloomPeak)
        + (stageProfile.coreBias * 0.32)
        + ((nextRandom(rng, `${context}_${index}_blossom_core`) - 0.5) * 0.024),
    ), 0.15);
    const stamenBurst = round3(clamp01(
        (bloomStage === 'bud' ? 0.06 : 0.38)
        + (openness * 0.22)
        + (coreSize * 0.22)
        + (lightExposure * 0.16),
    ), bloomStage === 'bud' ? 0.12 : 0.56);
    const centerDepth = round3(clamp01(
        0.32
        + (warmth * 0.18)
        + (coreSize * 0.22)
        + (bloomStage === 'full' ? 0.14 : 0.04)
        - (lightExposure * 0.12),
    ), 0.5);
    const facing = resolveSakuraBlossomFacing({
        rng,
        nextRandom,
        context,
        index,
        angle,
        openness,
        exposure,
        distanceRatio,
        clusterTightness,
        apexWeight,
    });
    const textureRichness = clamp01(
        (flowerDominance * 0.36)
        + (bloomPeak * 0.28)
        + (speciesCharacter * 0.18)
        + (bloomEcology.outerExposure * 0.18),
    );
    const layers = bloomStage === 'full' && textureRichness > 0.68
        ? 2
        : 1;
    const petalCount = bloomStage === 'bud'
        ? 5
        : (textureRichness > 0.78 ? 7 : 5);
    const form = bloomStage === 'bud'
        ? 'cupped'
        : (layers > 1 ? 'layered' : (clusterTightness > 0.72 && bloomStage !== 'full' ? 'cupped' : 'open'));
    const petalLength = round3(clamp01(
        0.62
        + (openness * 0.16)
        + (bloomEcology.outerExposure * 0.08)
        - (petalFall * 0.06),
    ), 0.68);
    const petalWidth = round3(clamp01(
        0.48
        + (warmth * 0.08)
        + ((1 - clusterTightness) * 0.06)
        - (bloomEcology.windExposure * 0.04),
    ), 0.54);
    const ruffle = round3(clamp01(
        0.06
        + (petalFall * 0.18)
        + (bloomEcology.windExposure * 0.14)
        + ((nextRandom(rng, `${context}_${index}_petal_ruffle`) - 0.5) * 0.04),
    ), 0.12);
    const innerScale = round3(clamp01(
        0.28
        + (openness * 0.18)
        + ((layers - 1) * 0.08)
        - (petalFall * 0.04),
    ), 0.48);

    return applySakuraBlossomLabTuning({
        bloomStage,
        form,
        layers,
        petalCount,
        openness: round3(openness, 0.72),
        petalLength,
        petalWidth,
        ruffle,
        coreSize,
        innerScale,
        warmth: round3(warmth, 0.5),
        tilt: round3(tilt + (bloomEcology.windExposure * Math.sign(Math.sin(angle) || 1) * 0.045), 0),
        petalFall,
        lightExposure,
        notchDepth,
        translucency,
        stamenBurst,
        centerDepth,
        ...facing,
    }, blossomTuning ?? DEFAULT_SAKURA_BLOSSOM_LAB_TUNING);
};

export class TerminalGenerationPolicyModel {
    static resolveSakuraFlowerSpurSet({
        rng,
        gene,
        currentStage,
        length,
        width,
        flowerColors,
        attachBias = 0.5,
        sideBias = 0,
        spurDensity = 1,
        maxSpurCount = 3,
        lineageBloomOffset = 0,
        lineagePetalFallOffset = 0,
    }) {
        const terminals = [];
        const stageGate = resolveStageVisualGate(currentStage);
        if (stageGate.flower <= 0) {
            return terminals;
        }
        const safeLength = Math.max(0, Number(length) || 0);
        const safeWidth = Math.max(0, Number(width) || 0);
        if (safeLength < 4.2 || safeWidth < 0.16) {
            return terminals;
        }

        const flowerDominance = clamp(gene?.flowerDominance ?? gene?.flowerChance ?? 0.5, 0, 1);
        const flowerClusterTightness = clamp(gene?.flowerClusterTightness ?? gene?.bloomClusterBias ?? 0.5, 0, 1);
        const clusterCountBias = clamp(gene?.flowerClusterCountBias ?? gene?.bloomClusterBias ?? 0.5, 0, 1);
        const flowerOuterBias = clamp(gene?.flowerOuterBias ?? gene?.bloomClusterBias ?? 0.5, 0, 1);
        const activationChance = clamp(
            (
                0.08
                + (stageGate.flower * 0.22)
                + ((gene?.flowerChance ?? 0.5) * 0.24)
                + (flowerDominance * 0.12)
                + (clusterCountBias * 0.12)
            ) * clamp(spurDensity, 0, 1.4),
            0,
            0.7,
        );
        if (nextRandom(rng, 'flower_spur_activation_gate') >= activationChance) {
            return terminals;
        }

        const safeMaxCount = clampInt(maxSpurCount, 1, 5, 3);
        const wantsSecond = nextRandom(rng, 'flower_spur_second_gate')
            < clamp(0.16 + (clusterCountBias * 0.22) + (flowerDominance * 0.14), 0.12, 0.52);
        const wantsThird = wantsSecond
            && safeMaxCount >= 3
            && nextRandom(rng, 'flower_spur_third_gate') < clamp(0.08 + (clusterCountBias * 0.18), 0.08, 0.32);
        const spurCount = Math.min(safeMaxCount, 1 + (wantsSecond ? 1 : 0) + (wantsThird ? 1 : 0));
        const baseAttachT = clamp(
            lerp(0.32, 0.74, clamp(attachBias, 0, 1))
            + ((nextRandom(rng, 'flower_spur_attach_jitter') - 0.5) * 0.18),
            0.24,
            0.86,
        );
        const preferredSide = Number(sideBias) > 0
            ? 1
            : (Number(sideBias) < 0 ? -1 : (nextRandom(rng, 'flower_spur_side_pick') < 0.5 ? -1 : 1));

        for (let i = 0; i < spurCount; i += 1) {
            const normalizedIndex = spurCount <= 1 ? 0 : ((i / (spurCount - 1)) - 0.5);
            const sideSign = nextRandom(rng, `flower_spur_${i}_side_gate`) < 0.82
                ? preferredSide
                : -preferredSide;
            const attachT = clamp(
                baseAttachT
                + (normalizedIndex * lerp(0.09, 0.05, flowerClusterTightness))
                + ((nextRandom(rng, `flower_spur_${i}_attach`) - 0.5) * 0.07),
                0.2,
                0.9,
            );
            const lateralAngle = sideSign * lerp(1.04, 1.58, nextRandom(rng, `flower_spur_${i}_angle_open`));
            const angle = lateralAngle
                + (normalizedIndex * lerp(0.16, 0.08, flowerClusterTightness))
                + ((nextRandom(rng, `flower_spur_${i}_angle_jitter`) - 0.5) * 0.24);
            const dist = clamp(
                1.4
                + (safeWidth * lerp(0.54, 0.92, flowerOuterBias))
                + (nextRandom(rng, `flower_spur_${i}_dist`) * lerp(1.2, 2.4, 1 - flowerClusterTightness)),
                1.8,
                Math.max(2.4, safeLength * 0.34),
            );
            const distanceRatio = clamp01((attachT * 0.68) + (dist / Math.max(safeLength, 1)) * 0.32);
            const exposure = clamp01(
                0.3
                + (attachT * 0.4)
                + (Math.abs(Math.sin(angle)) * 0.14)
                + (flowerOuterBias * 0.08)
                - (flowerClusterTightness * 0.05),
            );
            const blossom = resolveSakuraBlossomDescriptor({
                rng,
                gene,
                context: 'twig',
                index: i,
                angle,
                clusterTightness: flowerClusterTightness,
                flowerDominance,
                exposure,
                distanceRatio,
                blossomTuning: null,
                lineageBloomOffset,
                lineagePetalFallOffset,
            });
            const pedicel = resolveSakuraPedicelProfile({
                rng,
                context: 'twig',
                index: i,
                distance: dist,
                blossom,
                outerBias: flowerOuterBias,
                clusterTightness: flowerClusterTightness,
            });
            terminals.push({
                type: 'flower',
                growthOrigin: 'flower_spur',
                attachT: round3(attachT, 1),
                scale: round3(
                    resolveSakuraFlowerScale({
                        rng,
                        nextRandom,
                        gene,
                        context: 'twig',
                        index: i,
                        flowerDominance,
                        distanceRatio,
                        clusterTightness: flowerClusterTightness,
                        outerBias: flowerOuterBias,
                    }) * lerp(0.82, 0.96, flowerDominance),
                    1,
                ),
                color: pickColor(rng, flowerColors, '#FFCDD2', `flower_spur_${i}_flower_color`),
                angle,
                dist,
                blossom: {
                    ...blossom,
                    form: blossom.bloomStage === 'bud' ? 'cupped' : 'open',
                    layers: Math.min(2, Math.max(1, Number(blossom.layers) || 1)),
                    petalCount: Math.min(7, Math.max(5, Number(blossom.petalCount) || 5)),
                    openness: round3(clamp((Number(blossom.openness) || 0.72) + 0.035, 0, 1), blossom.openness),
                    stamenBurst: round3(clamp((Number(blossom.stamenBurst) || 0.56) + 0.045, 0, 1), blossom.stamenBurst),
                },
                ...pedicel,
            });
        }

        return terminals;
    }

    static resolveSakuraTerminalSet({
        rng,
        gene,
        currentStage,
        length,
        width,
        flowerColors,
        leafColors,
        lineageBloomOffset = 0,
        lineagePetalFallOffset = 0,
    }) {
        const terminals = [];
        const densityBoost = clamp(
            (gene.branchingProb * 1.6) + (gene.branchChaos * 0.8) + (gene.speciesCharacter * 0.45),
            0,
            2.4,
        );
        const stageDepth = Number.isFinite(currentStage?.depth) ? currentStage.depth : 6;
        const lowDepthComp = clamp((6 - stageDepth) * 0.16, 0, 0.48);
        const tipCount = clampInt(
            2.3
            + (gene.foliageMin * 0.18)
            + (nextRandom(rng, 'terminal_tip_count_jitter') * Math.max(0.8, gene.foliageVar * 0.24))
            + (densityBoost * 0.1)
            + (lowDepthComp * 0.52),
            2,
            3,
            3,
        );
        const stageGate = resolveStageVisualGate(currentStage);
        if (stageGate.flower <= 0 && stageGate.leaf <= 0) {
            return terminals;
        }
        const flowerDominance = clamp(gene.flowerDominance ?? gene.flowerChance ?? 0.5, 0, 1);
        const flowerOuterBias = clamp(gene.flowerOuterBias ?? gene.bloomClusterBias ?? 0.5, 0, 1);
        const flowerClusterTightness = clamp(gene.flowerClusterTightness ?? gene.bloomClusterBias ?? 0.5, 0, 1);
        const seasonBoost = lerp(0.75, 1.25, gene.seasonalBloomBias);
        const flowerPreference = clamp(
            seasonBoost * (0.12 + gene.flowerChance * 0.72)
            + densityBoost * 0.02
            + lowDepthComp * 0.04,
            0, 1,
        );
        const terminalReach = clamp(
            (length * (0.2 + gene.lengthBase * 0.32) + Math.max(0, width - 0.22) * 0.44)
            * lerp(1.18, 1.38, flowerOuterBias),
            4.6,
            19.4,
        );
        const clusterCenter = (nextRandom(rng, 'terminal_cluster_center') - 0.5)
            * Math.PI
            * lerp(0.68, 0.24, flowerOuterBias);
        const clusterTight = lerp(1.42, 0.86, flowerClusterTightness);
        const clusterRadius = terminalReach * lerp(1.04, 0.84, flowerClusterTightness);
        const clusterProbability = clamp(
            0.03 + (gene.bloomClusterBias * 0.08) + (flowerClusterTightness * 0.03),
            0.03,
            0.18,
        );

        for (let i = 0; i < tipCount; i += 1) {
            const phyllotaxis = ((i * GOLDEN_ANGLE) % (Math.PI * 2)) - Math.PI;
            const inCluster = nextRandom(rng, `terminal_${i}_cluster_gate`) < clusterProbability;
            const angle = inCluster
                ? clusterCenter
                + (nextRandom(rng, `terminal_${i}_cluster_angle`) - 0.5) * Math.PI * clusterTight
                + phyllotaxis * lerp(0.28, 0.16, flowerClusterTightness)
                : (nextRandom(rng, `terminal_${i}_spread_angle`) - 0.5)
                * Math.PI
                * lerp(1.66, 1.08, flowerOuterBias)
                + phyllotaxis * lerp(0.26, 0.14, flowerOuterBias);
            const wantsFlower = nextRandom(rng, `terminal_${i}_flower_gate`) < flowerPreference;
            let terminalType = null;
            if (wantsFlower && nextRandom(rng, `terminal_${i}_flower_visual_gate`) < stageGate.flower) {
                terminalType = 'flower';
            } else if (nextRandom(rng, `terminal_${i}_leaf_visual_gate`) < (stageGate.leaf * (wantsFlower ? lerp(0.88, 0.56, flowerDominance) : 1))) {
                terminalType = 'leaf';
            } else if (
                !wantsFlower
                && stageGate.flower > 0
                && nextRandom(rng, `terminal_${i}_flower_fallback_gate`) < (flowerPreference * stageGate.flower * 0.32)
            ) {
                terminalType = 'flower';
            }
            if (!terminalType) {
                continue;
            }
            const isFlower = terminalType === 'flower';
            const scaleMult = isFlower ? lerp(1.06, 1.24, flowerDominance) : 1.0;
            const dist = inCluster
                ? Math.max(
                    4.8,
                    clusterRadius * (0.96 + nextRandom(rng, `terminal_${i}_cluster_dist`) * lerp(0.62, 0.4, flowerClusterTightness)),
                )
                : Math.max(
                    5.6,
                    terminalReach * (0.92 + nextRandom(rng, `terminal_${i}_spread_dist`) * lerp(1.08, 0.88, flowerOuterBias)),
                );
            const distanceRatio = clamp01(
                dist / Math.max(
                    inCluster
                        ? (clusterRadius * lerp(1.06, 0.86, flowerClusterTightness))
                        : terminalReach,
                    0.001,
                ),
            );
            const exposure = clamp01(
                (inCluster
                    ? lerp(0.18, 0.62, distanceRatio)
                    : lerp(0.52, 0.96, distanceRatio))
                + (flowerOuterBias * 0.1)
                - (inCluster ? flowerClusterTightness * 0.08 : 0),
            );
            const blossom = isFlower
                ? resolveSakuraBlossomDescriptor({
                    rng,
                    gene,
                    context: inCluster ? 'cluster' : 'terminal',
                    index: i,
                    angle,
                    clusterTightness: flowerClusterTightness,
                    flowerDominance,
                    exposure,
                    distanceRatio,
                    blossomTuning: null,
                    lineageBloomOffset,
                    lineagePetalFallOffset,
                })
                : null;
            const pedicel = isFlower
                ? resolveSakuraPedicelProfile({
                    rng,
                    context: inCluster ? 'cluster' : 'terminal',
                    index: i,
                    inCluster,
                    distance: dist,
                    blossom,
                    outerBias: flowerOuterBias,
                    clusterTightness: flowerClusterTightness,
                })
                : null;

            terminals.push({
                type: terminalType,
                scale: isFlower
                    ? resolveSakuraFlowerScale({
                        rng,
                        nextRandom,
                        gene,
                        context: inCluster ? 'cluster' : 'terminal',
                        index: i,
                        flowerDominance,
                        distanceRatio,
                        clusterTightness: flowerClusterTightness,
                        outerBias: flowerOuterBias,
                    })
                    : (0.54 + nextRandom(rng, `terminal_${i}_leaf_scale`) * 0.16) * scaleMult,
                color: isFlower
                    ? pickColor(rng, flowerColors, '#FFCDD2', `terminal_${i}_flower_color`)
                    : pickColor(rng, leafColors, '#6B7D52', `terminal_${i}_leaf_color`),
                ...(!isFlower ? {
                    leafTemplateId: resolveLeafTemplateId({
                        rng,
                        context: inCluster ? 'cluster' : 'terminal',
                        index: i,
                        exposure,
                        clusterTightness: flowerClusterTightness,
                        speciesCharacter: gene?.speciesCharacter ?? 0.5,
                    }),
                } : {}),
                angle,
                dist,
                ...(blossom ? { blossom } : {}),
                ...(pedicel ? pedicel : {}),
            });
        }

        return terminals;
    }

    static resolveSakuraTwigNodeBloomSet({
        rng,
        gene,
        currentStage,
        length,
        flowerColors,
        leafColors,
        lineageBloomOffset = 0,
        lineagePetalFallOffset = 0,
    }) {
        const terminals = [];
        const twigNodeBloomChance = clamp(gene.twigNodeBloomChance ?? 0.3, 0, 1);
        const stageGate = resolveStageVisualGate(currentStage);
        if (stageGate.flower <= 0 && stageGate.leaf <= 0) {
            return terminals;
        }
        const flowerDominance = clamp(gene.flowerDominance ?? gene.flowerChance ?? 0.5, 0, 1);
        const flowerClusterTightness = clamp(gene.flowerClusterTightness ?? gene.bloomClusterBias ?? 0.5, 0, 1);
        const clusterCountBias = clamp(gene.flowerClusterCountBias ?? gene.bloomClusterBias ?? 0.5, 0, 1);
        const flowerPreference = clamp(0.22 + gene.flowerChance * 0.68, 0, 1);
        const activationChance = clamp(
            twigNodeBloomChance
            * ((stageGate.leaf * 0.42) + (flowerPreference * stageGate.flower * 0.9) + 0.08),
            0,
            1,
        ) * lerp(0.72, 0.98, flowerDominance);
        if (nextRandom(rng, 'twig_node_bloom_gate') >= activationChance) {
            return terminals;
        }

        const secondaryBloomChance = clamp(
            0.16
            + (clusterCountBias * 0.2)
            + (flowerDominance * 0.12)
            + (stageGate.flower * 0.08),
            0.16,
            0.56,
        );
        const forceSecondaryBloom = stageGate.flower >= 0.95
            && flowerDominance >= 0.82
            && clusterCountBias >= 0.82;
        const nodeBloomCount = 1
            + (
                forceSecondaryBloom
                    || nextRandom(rng, 'twig_node_bloom_count_primary') < secondaryBloomChance
                    ? 1
                    : 0
            );
        const bloomFanCenter = (nextRandom(rng, 'twig_node_fan_center') - 0.5) * lerp(1.02, 0.42, flowerClusterTightness);
        for (let i = 0; i < nodeBloomCount; i += 1) {
            const normalizedIndex = nodeBloomCount <= 1
                ? 0
                : ((i / (nodeBloomCount - 1)) - 0.5);
            const angle = bloomFanCenter
                + (normalizedIndex * lerp(1.08, 0.62, flowerClusterTightness))
                + (nextRandom(rng, `twig_node_${i}_base_angle`) - 0.5) * lerp(0.24, 0.12, flowerClusterTightness)
                + (nextRandom(rng, `twig_node_${i}_angle_jitter`) - 0.5) * 0.22;
            const wantsFlower = nextRandom(rng, `twig_node_${i}_flower_gate`) < flowerPreference;
            let terminalType = null;
            if (wantsFlower && nextRandom(rng, `twig_node_${i}_flower_visual_gate`) < stageGate.flower) {
                terminalType = 'flower';
            } else if (nextRandom(rng, `twig_node_${i}_leaf_visual_gate`) < (stageGate.leaf * (wantsFlower ? lerp(0.86, 0.6, flowerDominance) : 1))) {
                terminalType = 'leaf';
            }
            if (!terminalType) {
                continue;
            }
            const isFlower = terminalType === 'flower';
            const dist = clamp(
                length * (0.42 + nextRandom(rng, `twig_node_${i}_dist`) * lerp(0.64, 0.46, flowerClusterTightness)),
                4.1,
                10.4,
            );
            const distanceRatio = clamp01((dist - 4.1) / (10.4 - 4.1));
            const exposure = clamp01(
                lerp(0.24, 0.68, distanceRatio)
                + ((1 - flowerClusterTightness) * 0.1),
            );
            const blossom = isFlower
                ? resolveSakuraBlossomDescriptor({
                    rng,
                    gene,
                    context: 'twig',
                    index: i,
                    angle,
                    clusterTightness: flowerClusterTightness,
                    flowerDominance,
                    exposure,
                    distanceRatio,
                    blossomTuning: null,
                    lineageBloomOffset,
                    lineagePetalFallOffset,
                })
                : null;
            const pedicel = isFlower
                ? resolveSakuraPedicelProfile({
                    rng,
                    context: 'twig',
                    index: i,
                    distance: dist,
                    blossom,
                    outerBias: 0.5,
                    clusterTightness: flowerClusterTightness,
                })
                : null;

            terminals.push({
                type: terminalType,
                scale: isFlower
                    ? resolveSakuraFlowerScale({
                        rng,
                        nextRandom,
                        gene,
                        context: 'twig',
                        index: i,
                        flowerDominance,
                        distanceRatio,
                        clusterTightness: flowerClusterTightness,
                    })
                    : (0.48 + nextRandom(rng, `twig_node_${i}_leaf_scale`) * 0.16),
                color: isFlower
                    ? pickColor(rng, flowerColors, '#FFCDD2', `twig_node_${i}_flower_color`)
                    : pickColor(rng, leafColors, '#6B7D52', `twig_node_${i}_leaf_color`),
                ...(!isFlower ? {
                    leafTemplateId: resolveLeafTemplateId({
                        rng,
                        context: 'twig',
                        index: i,
                        exposure,
                        clusterTightness: flowerClusterTightness,
                        speciesCharacter: gene?.speciesCharacter ?? 0.5,
                    }),
                } : {}),
                angle,
                dist,
                ...(blossom ? { blossom } : {}),
                ...(pedicel ? pedicel : {}),
            });
        }

        return terminals;
    }

    static resolveSakuraCanopyCluster({
        rng,
        gene = {},
        clusterCount,
        canopyBloomRadius,
        canopyWidth,
        apexWeight,
        centerBias,
        flowerBias,
        flowerVisualGate = 1,
        leafVisualGate = 1,
        clusterTightness = 0.5,
        outerBias = 0.5,
        flowerDominance = 0.5,
        flowerColors,
        leafColors,
        lineageBloomOffset = 0,
        lineagePetalFallOffset = 0,
    }) {
        const terminals = [];
        const safeFlowerVisualGate = clamp(flowerVisualGate, 0, 1);
        const safeLeafVisualGate = clamp(leafVisualGate, 0, 1);
        const safeClusterTightness = clamp(clusterTightness, 0, 1);
        const safeOuterBias = clamp(outerBias, 0, 1);
        const safeFlowerDominance = clamp(flowerDominance, 0, 1);
        if (safeFlowerVisualGate <= 0 && safeLeafVisualGate <= 0) {
            return terminals;
        }
        const safeCount = Math.max(0, Math.round(clusterCount));
        for (let i = 0; i < safeCount; i += 1) {
            const phyllotaxis = ((i * GOLDEN_ANGLE) % (Math.PI * 2)) - Math.PI;
            const sequenceBias = safeCount <= 1 ? 0 : ((i / Math.max(1, safeCount - 1)) - 0.5);
            const spread = lerp(0.5, 1.28, clamp(canopyBloomRadius - 0.18, 0, 1))
                * lerp(1.42, 1.04, safeClusterTightness);
            const apexJitter = (nextRandom(rng, `canopy_${i}_apex_jitter`) - 0.5) * lerp(0.28, 0.42, 1 - apexWeight * 0.6);
            let angle = centerBias
                + phyllotaxis * spread
                + apexJitter
                + (sequenceBias * lerp(0.22, 0.08, safeClusterTightness));
            const apexDeadZone = lerp(0.12, 0.46, apexWeight);
            if (Math.abs(angle) < apexDeadZone) {
                const dir = angle === 0
                    ? (nextRandom(rng, `canopy_${i}_apex_direction`) > 0.5 ? 1 : -1)
                    : Math.sign(angle);
                angle = dir * (apexDeadZone + nextRandom(rng, `canopy_${i}_apex_deadzone`) * 0.16);
            }
            const wantsFlower = nextRandom(rng, `canopy_${i}_flower_gate`) < clamp(flowerBias * lerp(0.88, 1.18, safeFlowerDominance), 0, 1);
            let terminalType = null;
            if (wantsFlower && nextRandom(rng, `canopy_${i}_flower_visual_gate`) < safeFlowerVisualGate) {
                terminalType = 'flower';
            } else if (nextRandom(rng, `canopy_${i}_leaf_visual_gate`) < (safeLeafVisualGate * (wantsFlower ? lerp(0.84, 0.52, safeFlowerDominance) : 1))) {
                terminalType = 'leaf';
            }
            if (!terminalType) {
                continue;
            }
            const isFlower = terminalType === 'flower';
            const radialBase = canopyWidth
                * (
                    lerp(0.34, 0.46, safeOuterBias)
                    + (0.16 + canopyBloomRadius * lerp(0.52, 0.72, safeOuterBias))
                    * nextRandom(rng, `canopy_${i}_radial_base`)
                );
            const radialCap = canopyWidth * lerp(0.64, 1.02, clamp((1 - apexWeight * 0.68) + (safeOuterBias * 0.18), 0, 1));
            const dist = Math.max(2.8, Math.min(radialBase, radialCap));
            const distanceRatio = clamp01(dist / Math.max(radialCap, 0.001));
            const exposure = clamp01(
                lerp(0.18, 0.94, distanceRatio)
                + (safeOuterBias * 0.08)
                - (apexWeight * 0.04),
            );
            let blossom = isFlower
                ? resolveSakuraBlossomDescriptor({
                    rng,
                    gene: {
                        ...gene,
                        bloomPeak: gene?.bloomPeak ?? safeFlowerDominance,
                    },
                    context: 'canopy',
                    index: i,
                    angle,
                    clusterTightness: safeClusterTightness,
                    flowerDominance: safeFlowerDominance,
                    exposure,
                    distanceRatio,
                    apexWeight,
                    blossomTuning: null,
                    lineageBloomOffset,
                    lineagePetalFallOffset,
                })
                : null;
            if (blossom) {
                const canopyOpennessTarget = clamp(
                    0.42
                    + (distanceRatio * 0.54)
                    + (safeOuterBias * 0.04)
                    - (apexWeight * 0.02),
                    0.42,
                    0.98,
                );
                const adjustedOpenness = clamp(
                    lerp(blossom.openness, canopyOpennessTarget, 0.92),
                    0,
                    1,
                );
                const opennessDelta = adjustedOpenness - blossom.openness;
                const exposureDelta = clamp(
                    lerp(-0.12, 0.18, distanceRatio)
                    + (safeOuterBias * 0.03)
                    - (apexWeight * 0.03),
                    -0.12,
                    0.18,
                );
                blossom = {
                    ...blossom,
                    openness: round3(adjustedOpenness, blossom.openness),
                    notchDepth: round3(clamp(blossom.notchDepth + (opennessDelta * 0.22), 0, 1), blossom.notchDepth),
                    lightExposure: round3(clamp((blossom.lightExposure ?? 0.56) + exposureDelta, 0, 1), blossom.lightExposure ?? 0.56),
                    translucency: round3(clamp((blossom.translucency ?? 0.34) + (exposureDelta * 0.18), 0, 1), blossom.translucency ?? 0.34),
                    centerDepth: round3(clamp((blossom.centerDepth ?? 0.5) - (exposureDelta * 0.32), 0, 1), blossom.centerDepth ?? 0.5),
                    stamenBurst: round3(clamp((blossom.stamenBurst ?? 0.56) + (exposureDelta * 0.2), 0, 1), blossom.stamenBurst ?? 0.56),
                };
            }
            const pedicel = isFlower
                ? resolveSakuraPedicelProfile({
                    rng,
                    context: 'canopy',
                    index: i,
                    distance: dist,
                    blossom,
                    outerBias: safeOuterBias,
                    clusterTightness: safeClusterTightness,
                })
                : null;

            terminals.push({
                type: terminalType,
                scale: isFlower
                    ? resolveSakuraFlowerScale({
                        rng,
                        nextRandom,
                        gene,
                        context: 'canopy',
                        index: i,
                        flowerDominance: safeFlowerDominance,
                        distanceRatio,
                        clusterTightness: safeClusterTightness,
                        outerBias: safeOuterBias,
                        apexWeight,
                    })
                    : (0.52 + nextRandom(rng, `canopy_${i}_leaf_scale`) * 0.16),
                color: isFlower
                    ? pickColor(rng, flowerColors, '#FFCDD2', `canopy_${i}_flower_color`)
                    : pickColor(rng, leafColors, '#6B7D52', `canopy_${i}_leaf_color`),
                ...(!isFlower ? {
                    leafTemplateId: resolveLeafTemplateId({
                        rng,
                        context: 'canopy',
                        index: i,
                        exposure,
                        clusterTightness: safeClusterTightness,
                        speciesCharacter: gene?.speciesCharacter ?? 0.5,
                    }),
                } : {}),
                angle,
                dist,
                ...(blossom ? { blossom } : {}),
                ...(pedicel ? pedicel : {}),
            });
        }

        return terminals;
    }
}

const createPreviewRng = (seed = 1) => {
    let state = Math.max(1, Math.floor(Number(seed) || 1));
    return {
        next() {
            state = (state * 1664525 + 1013904223) % 4294967296;
            return state / 4294967296;
        },
    };
};

export const createSakuraBlossomPreviewSample = ({
    gene = {},
    tuning = null,
    seed = 1,
    context = 'canopy',
} = {}) => {
    const rng = createPreviewRng(seed);
    const flowerDominance = clamp(gene?.flowerDominance ?? gene?.flowerChance ?? 0.72, 0, 1);
    const clusterTightness = clamp(gene?.flowerClusterTightness ?? gene?.bloomClusterBias ?? 0.58, 0, 1);
    const distanceRatio = context === 'canopy' ? 0.76 : 0.62;
    const exposure = context === 'canopy' ? 0.82 : 0.66;
    const angle = context === 'canopy' ? 0.42 : 0.18;
    const blossom = resolveSakuraBlossomDescriptor({
        rng,
        gene,
        context,
        index: 0,
        angle,
        clusterTightness,
        flowerDominance,
        exposure,
        distanceRatio,
        outerBias: 0.58,
        apexWeight: context === 'canopy' ? 0.24 : 0.42,
        blossomTuning: tuning,
    });
    const previewBlossom = {
        ...blossom,
        form: blossom.bloomStage === 'bud' ? 'cupped' : 'open',
        silhouetteProfile: 'sakura',
        layers: 1,
        petalCount: 5,
        petalFall: 0,
        fallenPetals: 0,
        fallDrift: 0,
        petalWear: 0,
    };
    return {
        type: 'flower',
        scale: resolveSakuraFlowerScale({
            rng,
            nextRandom,
            gene,
            context,
            index: 0,
            flowerDominance,
            distanceRatio,
            clusterTightness,
            outerBias: 0.58,
            apexWeight: context === 'canopy' ? 0.24 : 0.42,
        }),
        color: '#FFCDD2',
        angle,
        dist: 0,
        blossom: previewBlossom,
    };
};
