import { resolveSakuraTrunkTaperWidthAtArc } from '../sakura/sakuraTrunkGeminiParams.js';

export const ZEN_BONSAI_CLASSIC2_SCORE_MODEL_VERSION = 'classic2_candidate_score_v1';
export const ZEN_BONSAI_CLASSIC2_SCORE_FEATURE_CONTRACT_VERSION =
    'classic2_apical_resource_features_v1';
export const ZEN_BONSAI_CLASSIC2_SCORE_FEATURE_SOURCE =
    'candidate_graph_and_canonical_history';

const ATTACH_BIN_COUNT = 6;
const ANGLE_BIN_COUNT = 8;
const HALF_TURN = Math.PI;
const SELECTED_STATUS = 'selected';

const clamp01 = (value) => Math.min(1, Math.max(0, Number(value)));
const round = (value, digits = 6) => Number(Number(value).toFixed(digits));
const smoothstep = (edge0, edge1, value) => {
    if (edge0 === edge1) return value >= edge1 ? 1 : 0;
    const t = clamp01((Number(value) - edge0) / (edge1 - edge0));
    return t * t * (3 - (2 * t));
};
const increment = (map, key, amount = 1) => map.set(key, (map.get(key) || 0) + amount);
const isMacroScaffoldRoot = (descriptor) => (
    descriptor?.role === 'scaffold'
    && typeof descriptor?.cohortId === 'string'
    && descriptor.cohortId.startsWith('scaffold_root:')
);
const parentRoleKey = (descriptor) => (
    `${descriptor.role}\u0000${descriptor.parentId ?? ''}\u0000${
        isMacroScaffoldRoot(descriptor) ? descriptor.cohortId : ''
    }`
);
const resolveAttachBin = (attachT) => Math.min(
    ATTACH_BIN_COUNT - 1,
    Math.max(0, Math.floor(clamp01(attachT) * ATTACH_BIN_COUNT)),
);
const resolveAngleBin = (angleOffset) => {
    const normalized = clamp01((Number(angleOffset) + HALF_TURN) / (HALF_TURN * 2));
    return Math.min(ANGLE_BIN_COUNT - 1, Math.max(0, Math.floor(normalized * ANGLE_BIN_COUNT)));
};
const resolveParentLoadKey = (descriptor) => (
    isMacroScaffoldRoot(descriptor)
        ? `${descriptor.parentId}@arc${resolveAttachBin(descriptor.attachT)}`
        : descriptor.parentId
);
const localBinKey = (descriptor, attachBin, angleBin) => (
    `${parentRoleKey(descriptor)}\u0000${attachBin}\u0000${angleBin}`
);
const resolveBranchMass = (descriptor) => (
    Math.max(1e-6, Number(descriptor.length))
    * Math.max(1e-6, Number(descriptor.width) ** 2)
);
const resolveCrossSection = (descriptor) => Math.max(1e-6, Number(descriptor.width) ** 2);
const resolveParentSupportGeometry = ({ descriptor, parent }) => {
    if (!isMacroScaffoldRoot(descriptor) || parent?.role !== 'trunk') {
        return Object.freeze({
            length: Math.max(1e-6, Number(parent.length)),
            width: Math.max(1e-6, Number(parent.width)),
        });
    }
    return Object.freeze({
        // The generator authors root scaffold scale against the fixed 12-span
        // reference, never the active adaptive tessellation.
        length: Math.max(1e-6, Number(parent.length) / 12),
        width: resolveSakuraTrunkTaperWidthAtArc({
            baseWidth: Number(parent.width),
            arcNorm: descriptor.attachT,
            minWidth: 1,
        }),
    });
};

const resolveStaticMetrics = ({ descriptor, candidateGraph, roleMaxDepth }) => {
    const parent = descriptor.parentId === null ? null : candidateGraph[descriptor.parentId];
    if (!parent) {
        return Object.freeze({
            relativeLength: 0,
            relativeCrossSection: 0,
            resourceDemand: 0,
            apicalContinuityFit: 1,
            axialSupportFit: 1,
            parentSupportFit: 1,
            branchMass: resolveBranchMass(descriptor),
            parentSupportCrossSection: 1,
            parentSupportMass: 1,
        });
    }

    const parentSupport = resolveParentSupportGeometry({ descriptor, parent });
    const parentSupportCrossSection = Math.max(1e-6, parentSupport.width ** 2);
    const parentSupportMass = Math.max(
        1e-6,
        parentSupport.length * parentSupportCrossSection,
    );
    const relativeLength = clamp01(
        Number(descriptor.length) / parentSupport.length,
    );
    const relativeCrossSection = clamp01(
        resolveCrossSection(descriptor) / parentSupportCrossSection,
    );
    const resourceDemand = clamp01(
        (relativeCrossSection * 0.62)
        + (relativeLength * 0.38),
    );
    const distalFit = smoothstep(0.58, 0.96, descriptor.attachT);
    const headingFit = 1 - smoothstep(0.16, 1.18, Math.abs(Number(descriptor.angleOffset)));
    const sameAxis = descriptor.role === parent.role ? 1 : 0;
    const apicalContinuityFit = sameAxis
        ? clamp01((distalFit * 0.52) + (headingFit * 0.4) + 0.08)
        : 0;
    const parentAxialPosition = clamp01(
        ((Math.max(1, Number(parent.roleDepth)) - 1) + clamp01(descriptor.attachT))
        / Math.max(1, Number(roleMaxDepth[parent.role]) || 1),
    );
    const axialSupportFit = descriptor.role === 'scaffold' && parent.role === 'trunk'
        ? clamp01(
            smoothstep(0.48, 0.9, parentAxialPosition)
            * (0.58 + (headingFit * 0.42)),
        )
        : 0;
    const widthOverload = smoothstep(0.58, 0.92, relativeCrossSection);
    const lengthOverload = smoothstep(0.76, 1, relativeLength);
    const parentSupportFit = clamp01(1 - ((widthOverload * 0.68) + (lengthOverload * 0.32)));

    return Object.freeze({
        relativeLength: round(relativeLength),
        relativeCrossSection: round(relativeCrossSection),
        resourceDemand: round(resourceDemand),
        apicalContinuityFit: round(apicalContinuityFit),
        axialSupportFit: round(axialSupportFit),
        parentSupportFit: round(parentSupportFit),
        branchMass: round(resolveBranchMass(descriptor)),
        parentSupportCrossSection: round(parentSupportCrossSection),
        parentSupportMass: round(parentSupportMass),
    });
};

export const createZenBonsaiClassic2LineageScoringFeatureContext = ({
    candidateGraph,
    decisions,
} = {}) => {
    const descriptors = Object.values(candidateGraph || {});
    const roleMaxDepth = { trunk: 1, scaffold: 1, twig: 1 };
    const candidateByParentRole = new Map();
    descriptors.forEach((descriptor) => {
        roleMaxDepth[descriptor.role] = Math.max(
            roleMaxDepth[descriptor.role] || 1,
            Math.max(1, Number(descriptor.roleDepth) || 1),
        );
        increment(candidateByParentRole, parentRoleKey(descriptor));
    });
    const staticMetricsByNodeId = new Map(descriptors.map((descriptor) => [
        descriptor.nodeId,
        resolveStaticMetrics({ descriptor, candidateGraph, roleMaxDepth }),
    ]));
    const context = {
        candidateGraph,
        candidateByParentRole,
        selectedByParentRole: new Map(),
        selectedByCohort: new Map(),
        selectedLocalBins: new Map(),
        selectedCrossSectionByParent: new Map(),
        selectedMassByParent: new Map(),
        selectedScaffoldMassBySide: new Map(),
        staticMetricsByNodeId,
    };
    Object.values(decisions || {}).forEach((decision) => {
        if (decision.status !== SELECTED_STATUS) return;
        const descriptor = candidateGraph?.[decision.nodeId];
        if (descriptor) registerZenBonsaiClassic2SelectedScoringFeature(context, descriptor);
    });
    return context;
};

export const registerZenBonsaiClassic2SelectedScoringFeature = (context, descriptor) => {
    increment(context.selectedByParentRole, parentRoleKey(descriptor));
    increment(context.selectedByCohort, descriptor.cohortId);
    increment(
        context.selectedLocalBins,
        localBinKey(
            descriptor,
            resolveAttachBin(descriptor.attachT),
            resolveAngleBin(descriptor.angleOffset),
        ),
    );
    if (descriptor.parentId !== null) {
        const parentLoadKey = resolveParentLoadKey(descriptor);
        increment(
            context.selectedCrossSectionByParent,
            parentLoadKey,
            resolveCrossSection(descriptor),
        );
        increment(
            context.selectedMassByParent,
            parentLoadKey,
            resolveBranchMass(descriptor),
        );
    }
    if (descriptor.role === 'scaffold' && descriptor.side !== 0) {
        increment(
            context.selectedScaffoldMassBySide,
            descriptor.side,
            resolveBranchMass(descriptor),
        );
    }
};

const resolveLocalDensity = (context, descriptor) => {
    const attachBin = resolveAttachBin(descriptor.attachT);
    const angleBin = resolveAngleBin(descriptor.angleOffset);
    let weightedCount = 0;
    for (let attachDelta = -1; attachDelta <= 1; attachDelta += 1) {
        const candidateAttachBin = attachBin + attachDelta;
        if (candidateAttachBin < 0 || candidateAttachBin >= ATTACH_BIN_COUNT) continue;
        for (let angleDelta = -1; angleDelta <= 1; angleDelta += 1) {
            const candidateAngleBin = angleBin + angleDelta;
            if (candidateAngleBin < 0 || candidateAngleBin >= ANGLE_BIN_COUNT) continue;
            const distance = Math.abs(attachDelta) + Math.abs(angleDelta);
            const weight = distance === 0 ? 1 : (distance === 1 ? 0.62 : 0.36);
            weightedCount += (
                context.selectedLocalBins.get(
                    localBinKey(descriptor, candidateAttachBin, candidateAngleBin),
                ) || 0
            ) * weight;
        }
    }
    return clamp01(weightedCount / 2.4);
};

const resolveResourceAvailability = (source) => clamp01(
    0.34
    + (clamp01(source?.canopyReserve) * 0.34)
    + (clamp01(source?.recoveryWood) * 0.22)
    + (clamp01(source?.healthH ?? 0.5) * 0.14)
    - (clamp01(source?.stressWood) * 0.28)
    - (clamp01(source?.volatility) * 0.08),
);

export const resolveZenBonsaiClassic2LineageScoringFeatures = ({
    descriptor,
    context,
    historySource,
} = {}) => {
    const metrics = context.staticMetricsByNodeId.get(descriptor.nodeId);
    const parent = descriptor.parentId === null
        ? null
        : context.candidateGraph[descriptor.parentId];
    const sameParentSelected = context.selectedByParentRole.get(parentRoleKey(descriptor)) || 0;
    const sameParentCandidateCount = context.candidateByParentRole.get(parentRoleKey(descriptor)) || 1;
    const parentFillRatio = clamp01(sameParentSelected / sameParentCandidateCount);
    const localDensity = resolveLocalDensity(context, descriptor);
    const localClearance = 1 - localDensity;
    const parentCrossSectionLoad = parent
        ? clamp01(
            (context.selectedCrossSectionByParent.get(resolveParentLoadKey(descriptor)) || 0)
            / metrics.parentSupportCrossSection,
        )
        : 0;
    const parentMassLoad = parent
        ? clamp01(
            (context.selectedMassByParent.get(resolveParentLoadKey(descriptor)) || 0)
            / metrics.parentSupportMass,
        )
        : 0;
    const siblingResourceLoad = clamp01(
        (parentCrossSectionLoad * 0.68)
        + (parentMassLoad * 0.32),
    );
    const resourceAvailability = resolveResourceAvailability(historySource);
    const resourceHistoryMismatch = clamp01(
        metrics.resourceDemand
        * (1 - resourceAvailability),
    );
    const sameSideMass = descriptor.side === 0
        ? 0
        : (context.selectedScaffoldMassBySide.get(descriptor.side) || 0);
    const oppositeSideMass = descriptor.side === 0
        ? 0
        : (context.selectedScaffoldMassBySide.get(-descriptor.side) || 0);
    const massTotal = sameSideMass + oppositeSideMass;
    const sideMassBalance = descriptor.role === 'scaffold' && descriptor.side !== 0
        ? clamp01((oppositeSideMass - sameSideMass) / Math.max(1e-6, massTotal) * 0.5 + 0.5)
        : 0.5;

    const weighted = Object.freeze({
        apicalContinuity: metrics.apicalContinuityFit * 0.05,
        axialSupport: metrics.axialSupportFit * 0.016,
        parentSupport: (metrics.parentSupportFit - 0.5) * 0.04,
        localClearance: (localClearance - 0.5) * 0.09,
        parentFillPenalty: -parentFillRatio * 0.045,
        resourceDemandPenalty: -metrics.resourceDemand * 0.035,
        siblingDemandPenalty: -siblingResourceLoad * 0.085,
        resourceHistoryMismatchPenalty: -resourceHistoryMismatch * 0.12,
        scaffoldMassBalance: descriptor.role === 'scaffold'
            ? (sideMassBalance - 0.5) * 0.08
            : 0,
    });
    const signals = Object.freeze({
        apicalContinuityFit: metrics.apicalContinuityFit,
        axialSupportFit: metrics.axialSupportFit,
        parentSupportFit: metrics.parentSupportFit,
        relativeLength: metrics.relativeLength,
        relativeCrossSection: metrics.relativeCrossSection,
        resourceDemand: metrics.resourceDemand,
        parentFillRatio: round(parentFillRatio),
        localClearance: round(localClearance),
        siblingResourceLoad: round(siblingResourceLoad),
        resourceAvailability: round(resourceAvailability),
        resourceHistoryMismatch: round(resourceHistoryMismatch),
        scaffoldSideMassBalance: round(sideMassBalance),
    });
    return Object.freeze({
        signals,
        weighted: Object.freeze(Object.fromEntries(
            Object.entries(weighted).map(([key, value]) => [key, round(value)]),
        )),
    });
};

export default resolveZenBonsaiClassic2LineageScoringFeatures;
