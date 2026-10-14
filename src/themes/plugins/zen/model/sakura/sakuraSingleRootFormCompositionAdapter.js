import {
    DEFAULT_SAKURA_Phenotype,
    clampPhenotype,
} from '../BonsaiGenetics';
import { createStructuralPlanIdV1 } from '../bonsai/generation/structuralPlanIdentityV1';
import {
    createBonsaiSingleRootFormCompositionPrior,
    requireBonsaiSingleRootFormCompositionPrior,
} from '../bonsai/morphology/BonsaiSingleRootFormCompositionPrior';

export const SAKURA_SINGLE_ROOT_FORM_COMPOSITION_ADAPTER_VERSION = 1;
export const SAKURA_SINGLE_ROOT_FORM_COMPOSITION_ADAPTER_ID = (
    'sakura_single_root_form_composition_adapter_v1'
);
export const SAKURA_SINGLE_ROOT_FORM_COMPOSITION_PLAN_CONTRACT = (
    'zen_sakura_single_root_form_composition_plan_v1'
);
export const SAKURA_SINGLE_ROOT_FORM_COMPOSITION_PROVENANCE_CONTRACT = (
    'zen_sakura_single_root_form_composition_provenance_v1'
);
export const SAKURA_SINGLE_ROOT_FORM_TRUNK_INTENT_CONSTRAINT_CONTRACT = (
    'zen_sakura_single_root_form_trunk_intent_constraint_v1'
);

const PLAN_ID_NAMESPACE = 'sakura_single_root_form_composition_plan_v1';
const PLAN_ID_PATTERN = /^sakura_single_root_form_composition_plan_v1_[0-9a-f]{8}$/;
const RESIDUAL_POLICY_ID = 'sakura_form_target_bounded_latent_residual_v1';
const CASCADE_TOTAL_TURN_POLICY_ID = 'sakura_form_cascade_total_turn_constraint_v1';
const EPSILON = 1e-8;

const PHENOTYPE_RESIDUAL_POLICY = Object.freeze({
    trunkBackboneTiltBias: Object.freeze({ scale: 0.3, cap: 0.08 }),
    trunkBackboneAmp: Object.freeze({ scale: 0.5, cap: 0.28 }),
    trunkGeminiWaveAmp: Object.freeze({ scale: 0.44, cap: 28 }),
    trunkGeminiWaveFreq: Object.freeze({ scale: 0.46, cap: 0.72 }),
    trunkKinkChance: Object.freeze({ scale: 0.34, cap: 0.14 }),
    trunkKinkAngle: Object.freeze({ scale: 0.32, cap: 0.2 }),
    widthBase: Object.freeze({ scale: 0.32, cap: 0.22 }),
    lengthBase: Object.freeze({ scale: 0.32, cap: 0.1 }),
    scaffoldFirstAttachRatio: Object.freeze({ scale: 0.45, cap: 0.08 }),
    scaffoldDensity: Object.freeze({ scale: 0.52, cap: 0.16 }),
    scaffoldUpperCoverage: Object.freeze({ scale: 0.4, cap: 0.12 }),
    scaffoldDistributionMode: Object.freeze({ scale: 0.26, cap: 0.1 }),
    scaffoldShapeMode: Object.freeze({ scale: 0.28, cap: 0.1 }),
    scaffoldRootGlobalPitch: Object.freeze({ scale: 0.32, cap: 0.14 }),
    scaffoldBackboneGravity: Object.freeze({ scale: 0.52, cap: 0.18 }),
    droopMiddle: Object.freeze({ scale: 0.5, cap: 0.22 }),
    droopTip: Object.freeze({ scale: 0.5, cap: 0.22 }),
    canopyBloomRadius: Object.freeze({ scale: 0.3, cap: 0.12 }),
    canopyBloomDensity: Object.freeze({ scale: 0.34, cap: 0.12 }),
    canopyShapeBias: Object.freeze({ scale: 0.3, cap: 0.1 }),
    canopyLayerBalance: Object.freeze({ scale: 0.3, cap: 0.1 }),
    silhouetteTarget: Object.freeze({ scale: 0.24, cap: 0.08 }),
    branchingProb: Object.freeze({ scale: 0.38, cap: 0.12 }),
    scaffoldTierBranchingProb: Object.freeze({ scale: 0.4, cap: 0.14 }),
    twigTierBranchingProb: Object.freeze({ scale: 0.4, cap: 0.14 }),
    negativeSpaceChance: Object.freeze({ scale: 0.5, cap: 0.06 }),
});

const STATION_PATTERN_MODE = Object.freeze({
    tiered_alternating: 1,
    radial_upper: 0.58,
    counterbalanced: 0.24,
    alternating_asymmetric: 0.86,
    sparse_upper: 0.68,
    cascade_following: 0.32,
    counterweighted_cascade: 0.38,
    radial_drooping: 0.54,
});

const CROWN_ENVELOPE_SHAPE_MODE = Object.freeze({
    low_triangle: 0.25,
    umbrella_dome: 0.58,
    offset_triangle: 0.28,
    irregular_triangle: 0.36,
    sparse_high: 0.48,
    descending_stream: 0.7,
    lateral_cascade: 0.62,
    weeping_curtain: 0.56,
});

const NEGATIVE_SPACE_ARC_CENTER = Object.freeze({
    tiered_windows: 0.5,
    open_under_crown: 0.36,
    counterbalance_window: 0.48,
    alternating_pockets: 0.56,
    dominant_open_field: 0.44,
    cascade_corridor: 0.62,
    edge_corridor: 0.68,
    curtain_gaps: 0.54,
});

const clamp = (value, minimum, maximum) => (
    Math.min(maximum, Math.max(minimum, Number(value) || 0))
);
const lerp = (start, end, amount) => start + ((end - start) * amount);
const round = (value) => Number(Number(value).toFixed(7));
const degreesToRadians = (value) => Number(value) * (Math.PI / 180);
const signedUnit = (value) => {
    const numeric = Number(value) || 0;
    if (Math.abs(numeric) <= EPSILON) return 0;
    return numeric < 0 ? -1 : 1;
};

const requireBaseGene = (gene) => {
    if (!gene || typeof gene !== 'object' || Array.isArray(gene)) {
        throw new Error('ZEN_SAKURA_FORM_COMPOSITION_GENE_REQUIRED');
    }
    return clampPhenotype(gene);
};

const resolveDefaultVariantSeed = (structuralSeed) => {
    if (!Number.isSafeInteger(structuralSeed)) {
        throw new Error('ZEN_SAKURA_FORM_COMPOSITION_STRUCTURAL_SEED_REQUIRED');
    }
    return Math.abs(structuralSeed);
};

const resolveDominantSide = (prior) => {
    const leanSide = signedUnit(prior.trunk.signedLeanDeg);
    const fallbackSide = prior.variantSeed % 2 === 0 ? 1 : -1;
    const postureSide = leanSide || fallbackSide;
    if (
        prior.scaffold.stationPattern === 'counterbalanced'
        || prior.scaffold.stationPattern === 'counterweighted_cascade'
    ) {
        return -postureSide;
    }
    return postureSide;
};

const resolveTrunkControls = (prior) => {
    const leanSide = signedUnit(prior.trunk.signedLeanDeg)
        || (prior.variantSeed % 2 === 0 ? 1 : -1);
    const leanMagnitude = clamp(Math.abs(prior.trunk.signedLeanDeg) / 72, 0, 1);
    const descending = clamp(prior.trunk.descendingPathRatio, 0, 1);
    const tiltMagnitude = prior.trunk.posture === 'full_cascade'
        ? clamp(0.9 + (descending * 0.13), 0, 1)
        : (prior.trunk.posture === 'semi_cascade'
            ? clamp(0.82 + (descending * 0.08), 0, 1)
            : clamp(
                leanMagnitude <= 0.7
                    ? ((leanMagnitude * 1.25) + (descending * 0.35))
                    : ((leanMagnitude * 0.85) + (descending * 0.55)),
                0,
                1,
            ));
    const curvature = clamp(prior.trunk.curvature, 0, 1);
    const slenderness = clamp(prior.trunk.slenderness, 1, 40);
    const isSemiCascade = prior.trunk.posture === 'semi_cascade';
    const isFullCascade = prior.trunk.posture === 'full_cascade';
    const isCascade = isSemiCascade || isFullCascade;
    return Object.freeze({
        posture: prior.trunk.posture,
        signedLeanDeg: prior.trunk.signedLeanDeg,
        curvature,
        descendingPathRatio: descending,
        slenderness,
        tiltBias: round(leanSide * tiltMagnitude),
        curveEventAmplitude: round(lerp(
            isCascade ? 10 : 10,
            isCascade ? 24 : 126,
            curvature,
        )),
        curveEventCadence: round(lerp(
            isCascade ? 0.6 : 0.65,
            isCascade ? 1.6 : 5.4,
            curvature,
        )),
        lateralSweepAmplitude: round(lerp(
            isCascade ? 0.72 : 0.42,
            isCascade ? 0.92 : 1.72,
            curvature,
        )),
        kinkChance: round(isCascade ? 0 : lerp(0.02, 0.58, curvature)),
        kinkAngleRad: round(isCascade ? 0 : lerp(0.16, 1.08, curvature)),
        widthBase: round(clamp(lerp(1.8, 0.55, slenderness / 40), 0.3, 18)),
    });
};

const resolveScaffoldControls = (prior, baseGene) => {
    const stationPattern = prior.scaffold.stationPattern;
    const distributionMode = STATION_PATTERN_MODE[stationPattern];
    if (!Number.isFinite(distributionMode)) {
        throw new Error(`ZEN_SAKURA_FORM_COMPOSITION_STATION_PATTERN_INVALID:${stationPattern}`);
    }
    const density = clamp(prior.scaffold.density, 0, 1);
    const downwardRatio = clamp(prior.scaffold.downwardRatio, 0, 1);
    const sideAsymmetry = clamp(prior.scaffold.sideAsymmetry, 0, 1);
    const sideAsymmetryResidual = clamp(
        (Number(baseGene.trunkOffsetX) - Number(DEFAULT_SAKURA_Phenotype.trunkOffsetX))
            * 0.5,
        -0.12,
        0.12,
    );
    const firstAttachPathRatio = clamp(prior.scaffold.firstAttachPathRatio, 0.06, 0.9);
    const upperCoverage = clamp(
        lerp(0.36, 0.92, prior.crown.centroidHeightRatio)
            + (stationPattern === 'sparse_upper' || stationPattern === 'radial_upper' ? 0.08 : 0),
        0,
        1,
    );
    return Object.freeze({
        stationPattern,
        firstAttachPathRatio: round(firstAttachPathRatio),
        density: round(density),
        sideAsymmetryTarget: round(sideAsymmetry),
        sideAsymmetryResidual: round(sideAsymmetryResidual),
        sideAsymmetry: round(clamp(sideAsymmetry + sideAsymmetryResidual, 0, 1)),
        dominantSide: resolveDominantSide(prior),
        downwardRatio: round(downwardRatio),
        distributionMode,
        upperCoverage: round(upperCoverage),
        rootGlobalPitch: 0,
        backboneGravity: round(lerp(0.12, 0.96, downwardRatio)),
    });
};

const resolveCrownControls = (prior) => {
    const envelope = prior.crown.envelope;
    const scaffoldShapeMode = CROWN_ENVELOPE_SHAPE_MODE[envelope];
    if (!Number.isFinite(scaffoldShapeMode)) {
        throw new Error(`ZEN_SAKURA_FORM_COMPOSITION_CROWN_ENVELOPE_INVALID:${envelope}`);
    }
    const widthToTreeHeight = clamp(prior.crown.widthToTreeHeight, 0.1, 1.5);
    const heightToTreeHeight = clamp(prior.crown.heightToTreeHeight, 0.1, 1.2);
    const centroidHeightRatio = clamp(prior.crown.centroidHeightRatio, 0, 1);
    const triangularity = clamp(prior.crown.triangularity, 0, 1);
    const droop = clamp(prior.crown.droop, 0, 1);
    return Object.freeze({
        envelope,
        widthToTreeHeight: round(widthToTreeHeight),
        heightToTreeHeight: round(heightToTreeHeight),
        centroidHeightRatio: round(centroidHeightRatio),
        triangularity: round(triangularity),
        droop: round(droop),
        scaffoldShapeMode,
        canopyBloomRadius: round(clamp(widthToTreeHeight / 0.72, 0.25, 1.25)),
        canopyBloomDensity: round(clamp(
            (heightToTreeHeight * 0.48) + (prior.scaffold.density * 0.52),
            0,
            1,
        )),
        canopyShapeBias: round(clamp(1 - heightToTreeHeight, 0, 1)),
        canopyLayerBalance: round(centroidHeightRatio),
        silhouetteTarget: round(triangularity),
    });
};

const resolveNegativeSpaceControls = (prior, baseGene) => {
    const pattern = prior.negativeSpace.pattern;
    const baseArcCenter = NEGATIVE_SPACE_ARC_CENTER[pattern];
    if (!Number.isFinite(baseArcCenter)) {
        throw new Error(`ZEN_SAKURA_FORM_COMPOSITION_NEGATIVE_SPACE_PATTERN_INVALID:${pattern}`);
    }
    const opennessTarget = clamp(prior.negativeSpace.openness, 0, 1);
    const opennessResidual = clamp(
        (Number(baseGene.negativeSpaceChance)
            - Number(DEFAULT_SAKURA_Phenotype.negativeSpaceChance)) * 0.75,
        -0.12,
        0.12,
    );
    const openness = clamp(opennessTarget + opennessResidual, 0, 1);
    const asymmetry = clamp(prior.negativeSpace.asymmetry, 0, 1);
    const largestVoidRatio = clamp(prior.negativeSpace.largestVoidRatio, 0, 1);
    const padSeparation = clamp(prior.negativeSpace.padSeparation, 0, 1);
    const arcCenterShift = (resolveDominantSide(prior) * asymmetry * 0.035);
    return Object.freeze({
        pattern,
        opennessTarget: round(opennessTarget),
        opennessResidual: round(opennessResidual),
        openness: round(openness),
        asymmetry: round(asymmetry),
        largestVoidRatio: round(largestVoidRatio),
        padSeparation: round(padSeparation),
        reservedArcCenter: round(clamp(baseArcCenter + arcCenterShift, 0.18, 0.82)),
        reservedArcWidth: round(clamp(
            0.02
                + (largestVoidRatio * 0.14)
                + (openness * 0.07)
                + (padSeparation * 0.05),
            0.04,
            0.24,
        )),
        densityScaleTarget: round(clamp(
            1 - (opennessTarget * 0.27) - (padSeparation * 0.09),
            0.62,
            1,
        )),
    });
};

const resolvePhenotypeTargets = ({ trunk, scaffold, crown, negativeSpace }) => Object.freeze({
    trunkBackboneTiltBias: trunk.tiltBias,
    trunkBackboneAmp: trunk.lateralSweepAmplitude,
    trunkGeminiWaveAmp: trunk.curveEventAmplitude,
    trunkGeminiWaveFreq: trunk.curveEventCadence,
    trunkKinkChance: trunk.kinkChance,
    trunkKinkAngle: trunk.kinkAngleRad,
    widthBase: trunk.widthBase,
    lengthBase: round(clamp(0.42 + (crown.widthToTreeHeight * 0.55), 0.3, 0.98)),
    scaffoldFirstAttachRatio: scaffold.firstAttachPathRatio,
    scaffoldDensity: round(scaffold.density * negativeSpace.densityScaleTarget),
    scaffoldUpperCoverage: scaffold.upperCoverage,
    scaffoldDistributionMode: scaffold.distributionMode,
    scaffoldShapeMode: crown.scaffoldShapeMode,
    scaffoldRootGlobalPitch: scaffold.rootGlobalPitch,
    scaffoldBackboneGravity: scaffold.backboneGravity,
    droopMiddle: crown.droop,
    droopTip: crown.droop,
    canopyBloomRadius: crown.canopyBloomRadius,
    canopyBloomDensity: crown.canopyBloomDensity,
    canopyShapeBias: crown.canopyShapeBias,
    canopyLayerBalance: crown.canopyLayerBalance,
    silhouetteTarget: crown.silhouetteTarget,
    branchingProb: round(lerp(0.82, 0.38, negativeSpace.openness)),
    scaffoldTierBranchingProb: round(lerp(0.8, 0.34, negativeSpace.openness)),
    twigTierBranchingProb: round(lerp(0.75, 0.22, negativeSpace.openness)),
    negativeSpaceChance: round(lerp(0.03, 0.29, negativeSpace.opennessTarget)),
});

const resolvePhenotypeComposition = ({ targets, baseGene, residualCapOverrides = {} }) => {
    const residuals = {};
    const caps = {};
    const effective = {};
    const sourceChannels = {};
    Object.entries(targets).forEach(([key, target]) => {
        const policy = PHENOTYPE_RESIDUAL_POLICY[key];
        if (!policy) {
            throw new Error(`ZEN_SAKURA_FORM_COMPOSITION_RESIDUAL_POLICY_REQUIRED:${key}`);
        }
        const residualCap = Number(residualCapOverrides[key] ?? policy.cap);
        if (!Number.isFinite(residualCap) || residualCap <= 0 || residualCap > policy.cap) {
            throw new Error(`ZEN_SAKURA_FORM_COMPOSITION_RESIDUAL_CAP_INVALID:${key}`);
        }
        const base = Number(baseGene[key]);
        const defaultValue = Number(DEFAULT_SAKURA_Phenotype[key]);
        if (!Number.isFinite(base) || !Number.isFinite(defaultValue)) {
            throw new Error(`ZEN_SAKURA_FORM_COMPOSITION_RESIDUAL_SOURCE_INVALID:${key}`);
        }
        const droopGravityDelta = key === 'scaffoldBackboneGravity'
            ? (
                Number(baseGene.droopMiddle)
                - Number(DEFAULT_SAKURA_Phenotype.droopMiddle)
            ) * 0.7
            : 0;
        const negativeSpaceDensityDelta = key === 'scaffoldDensity'
            ? -(
                Number(baseGene.negativeSpaceChance)
                - Number(DEFAULT_SAKURA_Phenotype.negativeSpaceChance)
            ) * 0.8
            : 0;
        sourceChannels[key] = key === 'scaffoldBackboneGravity'
            ? 'baseGene.scaffoldBackboneGravity+0.7*baseGene.droopMiddle'
            : (key === 'scaffoldDensity'
                ? 'baseGene.scaffoldDensity-0.8*baseGene.negativeSpaceChance'
                : `baseGene.${key}`);
        const residual = clamp(
            (
                (base - defaultValue)
                + droopGravityDelta
                + negativeSpaceDensityDelta
            ) * policy.scale,
            -residualCap,
            residualCap,
        );
        residuals[key] = round(residual);
        caps[key] = residualCap;
        effective[key] = round(Number(target) + residual);
    });
    const effectiveGene = Object.freeze(clampPhenotype({
        ...baseGene,
        ...effective,
    }));
    return Object.freeze({
        phenotypeComposition: Object.freeze({
            policyId: RESIDUAL_POLICY_ID,
            targets,
            sourceChannels: Object.freeze(sourceChannels),
            residuals: Object.freeze(residuals),
            caps: Object.freeze(caps),
            effective: Object.freeze(Object.fromEntries(
                Object.keys(targets).map((key) => [key, effectiveGene[key]]),
            )),
        }),
        effectiveGene,
    });
};

const createPlanId = ({
    prior,
    trunk,
    scaffold,
    crown,
    negativeSpace,
    phenotypeComposition,
    effectiveGene,
}) => (
    createStructuralPlanIdV1(PLAN_ID_NAMESPACE, [
        SAKURA_SINGLE_ROOT_FORM_COMPOSITION_ADAPTER_VERSION,
        prior.contract,
        prior.version,
        prior.formId,
        prior.variantSeed,
        ...Object.values(trunk),
        ...Object.values(scaffold),
        ...Object.values(crown),
        ...Object.values(negativeSpace),
        phenotypeComposition.policyId,
        ...Object.entries(phenotypeComposition.targets).flat(),
        ...Object.entries(phenotypeComposition.sourceChannels).flat(),
        ...Object.entries(phenotypeComposition.residuals).flat(),
        ...Object.entries(phenotypeComposition.caps).flat(),
        ...Object.entries(phenotypeComposition.effective).flat(),
        ...Object.entries(effectiveGene).flat(),
    ])
);

const buildPlan = ({ prior, baseGene }) => {
    const trunk = resolveTrunkControls(prior);
    const scaffold = resolveScaffoldControls(prior, baseGene);
    const crown = resolveCrownControls(prior);
    const negativeSpace = resolveNegativeSpaceControls(prior, baseGene);
    const phenotypeTargets = resolvePhenotypeTargets({
        trunk,
        scaffold,
        crown,
        negativeSpace,
    });
    const {
        phenotypeComposition,
        effectiveGene,
    } = resolvePhenotypeComposition({
        targets: phenotypeTargets,
        baseGene,
        residualCapOverrides: (
            trunk.posture === 'semi_cascade'
            || trunk.posture === 'full_cascade'
        )
            ? {
                trunkBackboneAmp: 0.06,
                trunkGeminiWaveAmp: 4,
                trunkGeminiWaveFreq: 0.18,
                trunkKinkChance: 0.005,
                trunkKinkAngle: 0.005,
            }
            : {},
    });
    const sourcePrior = Object.freeze({
        contract: prior.contract,
        version: prior.version,
        formId: prior.formId,
        variantSeed: prior.variantSeed,
    });
    const planId = createPlanId({
        prior,
        trunk,
        scaffold,
        crown,
        negativeSpace,
        phenotypeComposition,
        effectiveGene,
    });
    return Object.freeze({
        contract: SAKURA_SINGLE_ROOT_FORM_COMPOSITION_PLAN_CONTRACT,
        version: SAKURA_SINGLE_ROOT_FORM_COMPOSITION_ADAPTER_VERSION,
        adapterId: SAKURA_SINGLE_ROOT_FORM_COMPOSITION_ADAPTER_ID,
        planId,
        sourcePrior,
        trunk,
        scaffold,
        crown,
        negativeSpace,
        phenotypeComposition,
        effectiveGene,
    });
};

const sameValue = (left, right) => JSON.stringify(left) === JSON.stringify(right);

export const requireSakuraSingleRootFormCompositionPlanV1 = (value, {
    prior,
    baseGene,
} = {}) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('ZEN_SAKURA_FORM_COMPOSITION_PLAN_REQUIRED');
    }
    const resolvedPrior = requireBonsaiSingleRootFormCompositionPrior(prior);
    const resolvedBaseGene = requireBaseGene(baseGene);
    const canonical = buildPlan({ prior: resolvedPrior, baseGene: resolvedBaseGene });
    if (!sameValue(value, canonical)) {
        throw new Error('ZEN_SAKURA_FORM_COMPOSITION_PLAN_NONCANONICAL');
    }
    return value;
};

export const createSakuraSingleRootFormCompositionPlanV1 = ({
    prior,
    baseGene,
} = {}) => {
    const resolvedPrior = requireBonsaiSingleRootFormCompositionPrior(prior);
    const resolvedBaseGene = requireBaseGene(baseGene);
    const plan = buildPlan({ prior: resolvedPrior, baseGene: resolvedBaseGene });
    return requireSakuraSingleRootFormCompositionPlanV1(plan, {
        prior: resolvedPrior,
        baseGene: resolvedBaseGene,
    });
};

export const resolveSakuraSingleRootFormCompositionInputV1 = ({
    formCompositionPrior = null,
    formId = null,
    formVariantSeed = null,
    structuralSeed,
    baseGene,
} = {}) => {
    const hasPrior = formCompositionPrior !== null && formCompositionPrior !== undefined;
    const hasFormId = formId !== null && formId !== undefined;
    const hasVariantSeed = formVariantSeed !== null && formVariantSeed !== undefined;
    if (hasPrior && (hasFormId || hasVariantSeed)) {
        throw new Error('ZEN_SAKURA_FORM_COMPOSITION_INPUT_AMBIGUOUS');
    }
    if (!hasPrior && !hasFormId) {
        if (hasVariantSeed) {
            throw new Error('ZEN_SAKURA_FORM_COMPOSITION_FORM_ID_REQUIRED');
        }
        return null;
    }
    const prior = hasPrior
        ? requireBonsaiSingleRootFormCompositionPrior(formCompositionPrior)
        : createBonsaiSingleRootFormCompositionPrior({
            formId,
            variantSeed: hasVariantSeed
                ? formVariantSeed
                : resolveDefaultVariantSeed(structuralSeed),
        });
    return createSakuraSingleRootFormCompositionPlanV1({
        prior,
        baseGene,
    });
};

export const createSakuraSingleRootFormCompositionProvenanceV1 = (plan) => {
    if (
        !plan
        || typeof plan !== 'object'
        || plan.contract !== SAKURA_SINGLE_ROOT_FORM_COMPOSITION_PLAN_CONTRACT
        || plan.version !== SAKURA_SINGLE_ROOT_FORM_COMPOSITION_ADAPTER_VERSION
        || plan.adapterId !== SAKURA_SINGLE_ROOT_FORM_COMPOSITION_ADAPTER_ID
        || typeof plan.planId !== 'string'
        || !PLAN_ID_PATTERN.test(plan.planId)
    ) {
        throw new Error('ZEN_SAKURA_FORM_COMPOSITION_PROVENANCE_PLAN_INVALID');
    }
    return Object.freeze({
        contract: SAKURA_SINGLE_ROOT_FORM_COMPOSITION_PROVENANCE_CONTRACT,
        version: SAKURA_SINGLE_ROOT_FORM_COMPOSITION_ADAPTER_VERSION,
        adapterId: SAKURA_SINGLE_ROOT_FORM_COMPOSITION_ADAPTER_ID,
        planId: plan.planId,
        priorContract: plan.sourcePrior.contract,
        priorVersion: plan.sourcePrior.version,
        formId: plan.sourcePrior.formId,
        variantSeed: plan.sourcePrior.variantSeed,
    });
};

const CASCADE_TOTAL_TURN_POLICY_BY_POSTURE = Object.freeze({
    semi_cascade: Object.freeze({
        baseDeg: 112,
        descendingScaleDeg: 24,
        residualCapDeg: 2,
        postureEventKind: 'knuckle',
        postureEventCenterArcNorm: 0.28,
        postureEventExtentArcNorm: 0.4,
        postureEventSkew: -0.24,
        postureEventCore: 0.68,
        postureEventSecondary: 0.5,
        postureEventBridge: 0.16,
    }),
    full_cascade: Object.freeze({
        baseDeg: 138,
        descendingScaleDeg: 30,
        residualCapDeg: 3,
        postureEventKind: 'compound',
        postureEventCenterArcNorm: 0.34,
        postureEventExtentArcNorm: 0.52,
        postureEventSkew: -0.18,
        postureEventCore: 0.72,
        postureEventSecondary: 0.62,
        postureEventBridge: 0.18,
    }),
});

const TRUNK_INTENT_CONSTRAINT_KEYS = Object.freeze([
    'contract',
    'version',
    'policyId',
    'formCompositionPlanId',
    'formId',
    'posture',
    'descendingPathRatio',
    'direction',
    'sourceField',
    'postureEventKind',
    'postureEventCenterArcNorm',
    'postureEventExtentArcNorm',
    'postureEventSkew',
    'postureEventCore',
    'postureEventSecondary',
    'postureEventBridge',
    'targetTotalTurnRad',
    'residualTotalTurnRad',
    'effectiveTotalTurnRad',
]);

const hasExactKeys = (value, keys) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const actual = Object.keys(value).sort();
    const expected = [...keys].sort();
    return actual.length === expected.length
        && actual.every((key, index) => key === expected[index]);
};

const resolveCascadeTotalTurnTargetRad = ({ posture, descendingPathRatio, direction }) => {
    const policy = CASCADE_TOTAL_TURN_POLICY_BY_POSTURE[posture];
    if (!policy) return null;
    return direction * degreesToRadians(
        policy.baseDeg + (descendingPathRatio * policy.descendingScaleDeg),
    );
};

export const requireSakuraSingleRootFormTrunkIntentConstraintV1 = (value) => {
    if (!hasExactKeys(value, TRUNK_INTENT_CONSTRAINT_KEYS)) {
        throw new Error('ZEN_SAKURA_FORM_TRUNK_INTENT_CONSTRAINT_INVALID:shape');
    }
    const policy = CASCADE_TOTAL_TURN_POLICY_BY_POSTURE[value.posture];
    if (
        value.contract !== SAKURA_SINGLE_ROOT_FORM_TRUNK_INTENT_CONSTRAINT_CONTRACT
        || value.version !== SAKURA_SINGLE_ROOT_FORM_COMPOSITION_ADAPTER_VERSION
        || value.policyId !== CASCADE_TOTAL_TURN_POLICY_ID
        || !PLAN_ID_PATTERN.test(value.formCompositionPlanId)
        || value.formId !== value.posture
        || !policy
        || !Number.isFinite(value.descendingPathRatio)
        || value.descendingPathRatio < 0
        || value.descendingPathRatio > 1
        || (value.direction !== -1 && value.direction !== 1)
        || value.sourceField !== 'phenotypeComposition.residuals.trunkBackboneTiltBias'
        || value.postureEventKind !== policy.postureEventKind
        || value.postureEventCenterArcNorm !== policy.postureEventCenterArcNorm
        || value.postureEventExtentArcNorm !== policy.postureEventExtentArcNorm
        || value.postureEventSkew !== policy.postureEventSkew
        || value.postureEventCore !== policy.postureEventCore
        || value.postureEventSecondary !== policy.postureEventSecondary
        || value.postureEventBridge !== policy.postureEventBridge
        || !Number.isFinite(value.targetTotalTurnRad)
        || !Number.isFinite(value.residualTotalTurnRad)
        || !Number.isFinite(value.effectiveTotalTurnRad)
    ) {
        throw new Error('ZEN_SAKURA_FORM_TRUNK_INTENT_CONSTRAINT_INVALID:fields');
    }
    const canonicalTarget = round(resolveCascadeTotalTurnTargetRad(value));
    const canonicalEffective = round(
        value.targetTotalTurnRad + value.residualTotalTurnRad,
    );
    const residualCapRad = round(degreesToRadians(policy.residualCapDeg));
    if (
        Math.abs(value.targetTotalTurnRad - canonicalTarget) > EPSILON
        || Math.abs(value.residualTotalTurnRad) > residualCapRad + EPSILON
        || Math.abs(value.effectiveTotalTurnRad - canonicalEffective) > EPSILON
    ) {
        throw new Error('ZEN_SAKURA_FORM_TRUNK_INTENT_CONSTRAINT_INVALID:canonical');
    }
    return value;
};

export const createSakuraSingleRootFormTrunkIntentConstraintV1 = (plan) => {
    if (
        !plan
        || typeof plan !== 'object'
        || plan.contract !== SAKURA_SINGLE_ROOT_FORM_COMPOSITION_PLAN_CONTRACT
        || plan.version !== SAKURA_SINGLE_ROOT_FORM_COMPOSITION_ADAPTER_VERSION
        || plan.adapterId !== SAKURA_SINGLE_ROOT_FORM_COMPOSITION_ADAPTER_ID
        || !PLAN_ID_PATTERN.test(plan.planId)
    ) {
        throw new Error('ZEN_SAKURA_FORM_TRUNK_INTENT_CONSTRAINT_PLAN_INVALID');
    }
    const policy = CASCADE_TOTAL_TURN_POLICY_BY_POSTURE[plan.trunk?.posture];
    if (!policy) return null;
    const direction = signedUnit(plan.trunk.tiltBias);
    if (direction === 0) {
        throw new Error('ZEN_SAKURA_FORM_TRUNK_INTENT_CONSTRAINT_DIRECTION_INVALID');
    }
    const descendingPathRatio = round(clamp(plan.trunk.descendingPathRatio, 0, 1));
    const targetTotalTurnRad = round(resolveCascadeTotalTurnTargetRad({
        posture: plan.trunk.posture,
        descendingPathRatio,
        direction,
    }));
    const residual = Number(
        plan.phenotypeComposition?.residuals?.trunkBackboneTiltBias,
    );
    const cap = Number(plan.phenotypeComposition?.caps?.trunkBackboneTiltBias);
    if (!Number.isFinite(residual) || !Number.isFinite(cap) || cap <= 0) {
        throw new Error('ZEN_SAKURA_FORM_TRUNK_INTENT_CONSTRAINT_RESIDUAL_INVALID');
    }
    const residualTotalTurnRad = round(degreesToRadians(
        clamp(residual / cap, -1, 1) * policy.residualCapDeg,
    ));
    return requireSakuraSingleRootFormTrunkIntentConstraintV1(Object.freeze({
        contract: SAKURA_SINGLE_ROOT_FORM_TRUNK_INTENT_CONSTRAINT_CONTRACT,
        version: SAKURA_SINGLE_ROOT_FORM_COMPOSITION_ADAPTER_VERSION,
        policyId: CASCADE_TOTAL_TURN_POLICY_ID,
        formCompositionPlanId: plan.planId,
        formId: plan.sourcePrior.formId,
        posture: plan.trunk.posture,
        descendingPathRatio,
        direction,
        sourceField: 'phenotypeComposition.residuals.trunkBackboneTiltBias',
        postureEventKind: policy.postureEventKind,
        postureEventCenterArcNorm: policy.postureEventCenterArcNorm,
        postureEventExtentArcNorm: policy.postureEventExtentArcNorm,
        postureEventSkew: policy.postureEventSkew,
        postureEventCore: policy.postureEventCore,
        postureEventSecondary: policy.postureEventSecondary,
        postureEventBridge: policy.postureEventBridge,
        targetTotalTurnRad,
        residualTotalTurnRad,
        effectiveTotalTurnRad: round(targetTotalTurnRad + residualTotalTurnRad),
    }));
};

export const requireSakuraSingleRootFormCompositionProvenanceV1 = (value) => {
    if (
        !value
        || typeof value !== 'object'
        || Array.isArray(value)
        || value.contract !== SAKURA_SINGLE_ROOT_FORM_COMPOSITION_PROVENANCE_CONTRACT
        || value.version !== SAKURA_SINGLE_ROOT_FORM_COMPOSITION_ADAPTER_VERSION
        || value.adapterId !== SAKURA_SINGLE_ROOT_FORM_COMPOSITION_ADAPTER_ID
        || typeof value.planId !== 'string'
        || !PLAN_ID_PATTERN.test(value.planId)
        || typeof value.priorContract !== 'string'
        || !Number.isSafeInteger(value.priorVersion)
        || typeof value.formId !== 'string'
        || !Number.isSafeInteger(value.variantSeed)
        || value.variantSeed < 0
        || Object.keys(value).length !== 8
    ) {
        throw new Error('ZEN_SAKURA_FORM_COMPOSITION_PROVENANCE_INVALID');
    }
    const prior = createBonsaiSingleRootFormCompositionPrior({
        formId: value.formId,
        variantSeed: value.variantSeed,
    });
    if (
        prior.contract !== value.priorContract
        || prior.version !== value.priorVersion
    ) {
        throw new Error('ZEN_SAKURA_FORM_COMPOSITION_PROVENANCE_PRIOR_MISMATCH');
    }
    return value;
};
