import {
    collectZenBonsaiTerminalContinuityStats,
    normalizeZenBonsaiGrowthProjection,
    ZEN_BONSAI_GROWTH_NODE_ROLES,
} from '../ZenBonsaiGrowthProjection.js';
import {
    SAKURA_BRANCH_ORDER,
} from '../bonsai/generation/shapePriorModel.js';
import {
    ZEN_BONSAI_CLASSIC2_LINEAGE_CANDIDATE_DISPOSITIONS,
    normalizeZenBonsaiClassic2LineageState,
    requireZenBonsaiClassic2LineageRenderBindingForTopology,
    resolveZenBonsaiClassic2LineageCandidateDispositionMap,
    resolveZenBonsaiClassic2TrunkArcRecordProgress,
    summarizeZenBonsaiClassic2LineageState,
    ZEN_BONSAI_CLASSIC2_TRUNK_ARC_REFERENCE_SEGMENTS,
} from './ZenBonsaiClassic2LineageModel.js';

export const ZEN_BONSAI_CLASSIC2_WOOD_PRESENTATION_POLICY_VERSION = 'classic2_wood_presentation_v1';

export const ZEN_BONSAI_CLASSIC2_WOOD_PRESENTATION_SEMANTICS = Object.freeze({
    lineageBirth: 'development_history_record',
    presentationBirth: 'shoot_emergence',
});

export const ZEN_BONSAI_CLASSIC2_WOOD_CLOCK_POLICIES = Object.freeze({
    PERSISTED_HISTORY: 'persisted_history',
    EPHEMERAL_SCRUB: 'ephemeral_scrub',
});

// This is a presentation floor only. It changes neither candidate membership
// nor renderer ownership: a newly materialized trunk starts as an established
// small bonsai instead of a germinating sprout.
const ZEN_BONSAI_CLASSIC2_INITIAL_TRUNK_WIDTH_SCALE = 0.5;
const ZEN_BONSAI_CLASSIC2_LATE_SHOOT_WIDTH_SCALE = 0.12;

const requireClassic2WoodClockPolicy = (value) => {
    if (Object.values(ZEN_BONSAI_CLASSIC2_WOOD_CLOCK_POLICIES).includes(value)) {
        return value;
    }
    throw new Error('ZEN_BONSAI_CLASSIC2_WOOD_CLOCK_POLICY_INVALID');
};

export const ZEN_BONSAI_CLASSIC2_ROLE_PRESENTATION_PACING = Object.freeze({
    trunk: Object.freeze({
        parentMaturationFraction: 0.16,
        extensionMatureStart: 0.42,
        extensionMatureKnee: 0.48,
        extensionMatureEnd: 0.99,
        extensionDepthExponent: 2.1,
        girthMatureStart: 1,
        girthMatureKnee: 1,
        girthMatureEnd: 1,
        girthDepthExponent: 3.5,
    }),
    scaffold: Object.freeze({
        parentMaturationFraction: 0.08,
        extensionSpanStart: 0.12,
        extensionSpanEnd: 0.2,
        girthSpanStart: 0.38,
        girthSpanEnd: 0.32,
    }),
    twig: Object.freeze({
        parentMaturationFraction: 0.36,
        extensionSpanStart: 0.1,
        extensionSpanEnd: 0.2,
        girthSpanStart: 0.3,
        girthSpanEnd: 0.24,
    }),
});

export const ZEN_BONSAI_CLASSIC2_TRUNK_MASS_PRESENTATION_KNOTS = Object.freeze([
    // A newly registered tree must already read as a small bonsai, not a
    // germinating sprout. Keep the continuous curve, but establish its wood
    // mass from a 50% presentation floor.
    Object.freeze({ progress: 0, scale: ZEN_BONSAI_CLASSIC2_INITIAL_TRUNK_WIDTH_SCALE }),
    Object.freeze({ progress: 0.32, scale: ZEN_BONSAI_CLASSIC2_INITIAL_TRUNK_WIDTH_SCALE }),
    Object.freeze({ progress: 0.4, scale: ZEN_BONSAI_CLASSIC2_INITIAL_TRUNK_WIDTH_SCALE }),
    Object.freeze({ progress: 0.57, scale: 0.54 }),
    Object.freeze({ progress: 0.7, scale: 0.775 }),
    Object.freeze({ progress: 0.85, scale: 0.895 }),
    Object.freeze({ progress: 0.94, scale: 0.97 }),
    Object.freeze({ progress: 1, scale: 1 }),
]);

const LINEAGE_PRESENTATION_SCHEDULE_CACHE = new WeakMap();

const clamp = (value, min = 0, max = 1) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return min;
    }
    return Math.min(max, Math.max(min, numeric));
};
const clamp01 = (value) => clamp(value, 0, 1);
const lerp = (a, b, t) => a + ((b - a) * clamp01(t));
const smoothstep01 = (value) => {
    const t = clamp01(value);
    return t * t * (3 - (2 * t));
};
const resolveTrunkMassPresentationScale = (growthProgress) => {
    const progress = clamp01(growthProgress);
    for (let index = 1; index < ZEN_BONSAI_CLASSIC2_TRUNK_MASS_PRESENTATION_KNOTS.length; index += 1) {
        const left = ZEN_BONSAI_CLASSIC2_TRUNK_MASS_PRESENTATION_KNOTS[index - 1];
        const right = ZEN_BONSAI_CLASSIC2_TRUNK_MASS_PRESENTATION_KNOTS[index];
        if (progress <= right.progress) {
            const span = Math.max(0.0001, right.progress - left.progress);
            return lerp(
                left.scale,
                right.scale,
                smoothstep01((progress - left.progress) / span),
            );
        }
    }
    return 1;
};
const resolveTrunkWidthPresentationFloor = (growthProgress) => lerp(
    ZEN_BONSAI_CLASSIC2_INITIAL_TRUNK_WIDTH_SCALE,
    ZEN_BONSAI_CLASSIC2_LATE_SHOOT_WIDTH_SCALE,
    smoothstep01((clamp01(growthProgress) - 0.5) / 0.2),
);
const round = (value, digits = 4) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return 0;
    }
    return Number(numeric.toFixed(digits));
};
const resolveClassic2StructureDepth = (value) => Math.max(
    1,
    Math.min(9, Math.round(Number(value) || 1)),
);

export const resolveZenBonsaiClassic2GenerationStage = ({
    stage = null,
    structureDepth = 6,
} = {}) => Object.freeze({
    ...(stage || {}),
    depth: resolveClassic2StructureDepth(structureDepth),
    text: 'Classic 2',
});

export const resolveZenBonsaiClassic2DisplayCandidateStage = ({
    baseStage = null,
    structureDepth = 6,
    learningProgress = 0,
    canopyDistributionProfile = null,
} = {}) => resolveZenBonsaiClassic2GenerationStage({
    stage: {
        ...(baseStage || {}),
        learningProgress,
        canopyTuning: canopyDistributionProfile,
        previewMode: false,
    },
    structureDepth,
});

const hashUnit = (value = '') => {
    const source = String(value);
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
        hash ^= source.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return ((hash >>> 0) % 1000003) / 1000003;
};

const resolvePresentationPosition = ({ descriptor, roleMaxDepth, maxTraversalDepth }) => {
    const roleNorm = clamp01(
        (descriptor.roleDepth - 1) / Math.max(1, roleMaxDepth[descriptor.role] - 1),
    );
    if (descriptor.role === ZEN_BONSAI_GROWTH_NODE_ROLES.TRUNK) {
        return clamp01(
            (descriptor.trunkArcStart + descriptor.trunkArcEnd) * 0.5,
        );
    }
    const traversalNorm = clamp01(
        (descriptor.traversalDepth - 1) / Math.max(1, maxTraversalDepth - 1),
    );
    const attachT = clamp01(descriptor.attachT);
    return descriptor.role === ZEN_BONSAI_GROWTH_NODE_ROLES.SCAFFOLD
        ? clamp01((roleNorm * 0.55) + (traversalNorm * 0.3) + (attachT * 0.15))
        : clamp01((roleNorm * 0.45) + (traversalNorm * 0.4) + (attachT * 0.15));
};

const resolvePresentationExtensionSpan = ({ role, roleMaxDepth, position }) => {
    const pacing = ZEN_BONSAI_CLASSIC2_ROLE_PRESENTATION_PACING[role];
    const roleDepthIntervals = Math.max(1, roleMaxDepth[role] - 1);
    const causalSpanCeiling = 0.72
        / roleDepthIntervals
        / pacing.parentMaturationFraction;
    return Math.min(
        lerp(pacing.extensionSpanStart, pacing.extensionSpanEnd, position),
        causalSpanCeiling,
    );
};

const resolveTrunkMaturityTarget = ({
    position,
    start,
    knee,
    end,
    tailExponent,
}) => {
    const kneePosition = 0.3;
    if (position <= kneePosition) {
        return lerp(start, knee, position / kneePosition);
    }
    const tailPosition = (position - kneePosition) / (1 - kneePosition);
    const maturityPosition = 1 - ((1 - tailPosition) ** tailExponent);
    return lerp(knee, end, maturityPosition);
};

const resolveTrunkDepthAgeExponent = ({
    position,
    start,
    knee,
    end,
    tailPower,
}) => {
    const kneePosition = 0.3;
    if (position <= kneePosition) {
        return lerp(start, knee, position / kneePosition);
    }
    const tailPosition = (position - kneePosition) / (1 - kneePosition);
    return lerp(knee, end, tailPosition ** tailPower);
};

// The release-v1 wood curve was authored against a 30-segment semantic trunk.
// Adaptive Bézier emission may use any valid 8..48 span discretization, but it
// samples this fixed arc reference rather than turning physical spans into new
// developmental intervals.
const TRUNK_ARC_PACING_REFERENCE = (() => {
    const pacing = ZEN_BONSAI_CLASSIC2_ROLE_PRESENTATION_PACING.trunk;
    const lastIndex = ZEN_BONSAI_CLASSIC2_TRUNK_ARC_REFERENCE_SEGMENTS - 1;
    const entries = [];
    for (let index = 0; index <= lastIndex; index += 1) {
        const position = index / Math.max(1, lastIndex);
        const extensionTarget = resolveTrunkMaturityTarget({
            position,
            start: pacing.extensionMatureStart,
            knee: pacing.extensionMatureKnee,
            end: pacing.extensionMatureEnd,
            tailExponent: pacing.extensionDepthExponent,
        });
        const previous = entries.at(-1) || null;
        const parentReady = previous
            ? previous.birth
                + ((previous.extensionMature - previous.birth) * pacing.parentMaturationFraction)
            : 0;
        const recordProgress = index === 0
            ? 0
            : resolveZenBonsaiClassic2TrunkArcRecordProgress(position);
        const birth = index === 0 ? 0 : Math.max(recordProgress, parentReady);
        entries.push(Object.freeze({
            position,
            birth,
            extensionMature: Math.max(birth + 0.012, extensionTarget),
        }));
    }
    return Object.freeze(entries);
})();

const resolveTrunkArcPacingReference = (position) => {
    const normalized = clamp01(position);
    const lastIndex = TRUNK_ARC_PACING_REFERENCE.length - 1;
    const scaled = normalized * lastIndex;
    const leftIndex = Math.floor(scaled);
    const rightIndex = Math.min(lastIndex, leftIndex + 1);
    const local = scaled - leftIndex;
    const left = TRUNK_ARC_PACING_REFERENCE[leftIndex];
    const right = TRUNK_ARC_PACING_REFERENCE[rightIndex];
    return Object.freeze({
        birth: lerp(left.birth, right.birth, local),
        extensionMature: lerp(left.extensionMature, right.extensionMature, local),
    });
};

// Physical trunk spans are render tessellation, so extension must be sampled
// from one macro-arc field rather than recomputed from each span midpoint. A
// fixed global primitive makes integral(a, c) === integral(a, b) + integral(b, c)
// for every subdivision of the same guide.
const TRUNK_EXTENSION_INTEGRATION_STEPS = (
    (ZEN_BONSAI_CLASSIC2_TRUNK_ARC_REFERENCE_SEGMENTS - 1) * 4
);
const TRUNK_EXTENSION_ARC_EPSILON = 1e-8;

const resolveTrunkExtensionFrontierArc = (growthProgress) => {
    const progress = clamp01(growthProgress);
    const last = TRUNK_ARC_PACING_REFERENCE.at(-1);
    if (progress >= last.birth) return 1;
    for (let index = 1; index < TRUNK_ARC_PACING_REFERENCE.length; index += 1) {
        const left = TRUNK_ARC_PACING_REFERENCE[index - 1];
        const right = TRUNK_ARC_PACING_REFERENCE[index];
        if (progress > right.birth) continue;
        const span = right.birth - left.birth;
        if (span <= TRUNK_EXTENSION_ARC_EPSILON) return right.position;
        return lerp(
            left.position,
            right.position,
            (progress - left.birth) / span,
        );
    }
    return 1;
};

const resolveTrunkExtensionScaleAtArc = ({ growthProgress, arcPosition }) => {
    const position = clamp01(arcPosition);
    const reference = resolveTrunkArcPacingReference(position);
    if (growthProgress + TRUNK_EXTENSION_ARC_EPSILON < reference.birth) return 0;
    const extensionAge = smoothstep01(
        (growthProgress - reference.birth)
        / Math.max(0.0001, reference.extensionMature - reference.birth),
    );
    const depthExponent = resolveTrunkDepthAgeExponent({
        position,
        start: 0.86,
        knee: 1.05,
        end: 13,
        tailPower: 3,
    });
    return lerp(
        0.08,
        1,
        smoothstep01(clamp01(extensionAge) ** depthExponent),
    );
};

const resolveTrunkExtensionProfile = (growthProgress) => {
    const progress = clamp01(growthProgress);
    const frontierArc = resolveTrunkExtensionFrontierArc(progress);
    const positions = [];
    for (let index = 0; index <= TRUNK_EXTENSION_INTEGRATION_STEPS; index += 1) {
        const position = index / TRUNK_EXTENSION_INTEGRATION_STEPS;
        if (position < frontierArc - TRUNK_EXTENSION_ARC_EPSILON) {
            positions.push(position);
            continue;
        }
        if (Math.abs(position - frontierArc) <= TRUNK_EXTENSION_ARC_EPSILON) {
            positions.push(frontierArc);
        }
        break;
    }
    if (
        positions.length === 0
        || Math.abs(positions.at(-1) - frontierArc) > TRUNK_EXTENSION_ARC_EPSILON
    ) {
        positions.push(frontierArc);
    }
    const scales = positions.map((arcPosition) => resolveTrunkExtensionScaleAtArc({
        growthProgress: progress,
        arcPosition,
    }));
    const cumulative = [0];
    for (let index = 1; index < positions.length; index += 1) {
        cumulative.push(
            cumulative[index - 1]
            + (
                (scales[index - 1] + scales[index])
                * 0.5
                * (positions[index] - positions[index - 1])
            ),
        );
    }
    const integrateTo = (arcPosition) => {
        const target = Math.min(frontierArc, clamp01(arcPosition));
        if (target <= TRUNK_EXTENSION_ARC_EPSILON || positions.length === 1) return 0;
        if (target >= frontierArc - TRUNK_EXTENSION_ARC_EPSILON) {
            return cumulative.at(-1);
        }
        let low = 0;
        let high = positions.length - 1;
        while (high - low > 1) {
            const middle = Math.floor((low + high) / 2);
            if (positions[middle] <= target) low = middle;
            else high = middle;
        }
        const span = Math.max(TRUNK_EXTENSION_ARC_EPSILON, positions[high] - positions[low]);
        const local = (target - positions[low]) / span;
        const targetScale = lerp(scales[low], scales[high], local);
        return cumulative[low]
            + ((scales[low] + targetScale) * 0.5 * (target - positions[low]));
    };
    const resolveSpan = (trunkArcStart, trunkArcEnd) => {
        const start = clamp01(trunkArcStart);
        const end = clamp01(trunkArcEnd);
        const arcSpan = Math.max(TRUNK_EXTENSION_ARC_EPSILON, end - start);
        const visibleArcEnd = clamp(Math.min(end, frontierArc), start, end);
        const integratedExtension = Math.max(0, integrateTo(end) - integrateTo(start));
        return Object.freeze({
            visible: integratedExtension > TRUNK_EXTENSION_ARC_EPSILON,
            visibleArcStart: start,
            visibleArcEnd,
            lengthScale: clamp01(integratedExtension / arcSpan),
            containsFrontier: frontierArc < 1 - TRUNK_EXTENSION_ARC_EPSILON
                && frontierArc >= start - TRUNK_EXTENSION_ARC_EPSILON
                && frontierArc <= end + TRUNK_EXTENSION_ARC_EPSILON
                && visibleArcEnd > start + TRUNK_EXTENSION_ARC_EPSILON,
        });
    };
    return Object.freeze({
        frontierArc: round(frontierArc, 7),
        integratedExtension: round(cumulative.at(-1), 7),
        resolveSpan,
    });
};

export const resolveZenBonsaiClassic2LineagePresentationSchedule = (lineageState) => {
    const normalized = normalizeZenBonsaiClassic2LineageState(lineageState);
    const cached = LINEAGE_PRESENTATION_SCHEDULE_CACHE.get(normalized);
    if (cached) {
        return cached;
    }
    const descriptors = Object.values(normalized.candidateGraph);
    const roleMaxDepth = Object.fromEntries(
        Object.values(ZEN_BONSAI_GROWTH_NODE_ROLES).map((role) => [role, 1]),
    );
    let maxTraversalDepth = 1;
    descriptors.forEach((descriptor) => {
        roleMaxDepth[descriptor.role] = Math.max(
            roleMaxDepth[descriptor.role],
            descriptor.roleDepth,
        );
        maxTraversalDepth = Math.max(maxTraversalDepth, descriptor.traversalDepth);
    });

    const scheduleByNodeId = {};
    const resolving = new Set();
    const resolveSchedule = (nodeId) => {
        if (Object.prototype.hasOwnProperty.call(scheduleByNodeId, nodeId)) {
            return scheduleByNodeId[nodeId];
        }
        const descriptor = normalized.candidateGraph[nodeId];
        const decision = normalized.decisions[nodeId];
        if (!descriptor || decision?.status !== 'selected') {
            return null;
        }
        if (resolving.has(nodeId)) {
            throw new Error(`ZEN_BONSAI_CLASSIC2_PRESENTATION_SCHEDULE_CYCLE:${nodeId}`);
        }
        resolving.add(nodeId);
        const pacing = ZEN_BONSAI_CLASSIC2_ROLE_PRESENTATION_PACING[descriptor.role];
        const parentSchedule = descriptor.parentId === null
            ? null
            : resolveSchedule(descriptor.parentId);
        const parentDescriptor = descriptor.parentId === null
            ? null
            : normalized.candidateGraph[descriptor.parentId];
        if (descriptor.parentId !== null && !parentSchedule) {
            throw new Error(`ZEN_BONSAI_CLASSIC2_PRESENTATION_PARENT_SCHEDULE_REQUIRED:${nodeId}`);
        }
        const physicalParentReadyProgress = parentSchedule
            ? parentSchedule.birth
                + (
                    (parentSchedule.extensionMature - parentSchedule.birth)
                    * pacing.parentMaturationFraction
                )
            : 0;
        const position = resolvePresentationPosition({
            descriptor,
            roleMaxDepth,
            maxTraversalDepth,
        });
        const isTrunk = descriptor.role === ZEN_BONSAI_GROWTH_NODE_ROLES.TRUNK;
        const trunkArcReference = isTrunk
            ? resolveTrunkArcPacingReference(position)
            : null;
        const macroTrunkAttachmentReadyProgress = (
            descriptor.role === ZEN_BONSAI_GROWTH_NODE_ROLES.SCAFFOLD
            && parentDescriptor?.role === ZEN_BONSAI_GROWTH_NODE_ROLES.TRUNK
        )
            ? resolveTrunkArcPacingReference(descriptor.attachT).birth
            : 0;
        const parentReadyProgress = isTrunk && descriptor.parentId !== null
            ? trunkArcReference.birth
            : Math.max(
                physicalParentReadyProgress,
                macroTrunkAttachmentReadyProgress,
            );
        const birth = descriptor.parentId === null
            ? 0
            : clamp(
                Math.max(decision.birthProgress, parentReadyProgress),
                0,
                1,
            );
        const extensionMature = isTrunk
            ? clamp(Math.max(
                birth + 0.012,
                trunkArcReference.extensionMature,
            ), birth, 1)
            : (() => {
                const extensionSpan = resolvePresentationExtensionSpan({
                    role: descriptor.role,
                    roleMaxDepth,
                    position,
                });
                return clamp(birth + extensionSpan, birth, 1);
            })();
        const girthSpan = isTrunk
            ? 0
            : lerp(pacing.girthSpanStart, pacing.girthSpanEnd, position);
        const trunkLateGirthTarget = isTrunk
            ? resolveTrunkMaturityTarget({
                position,
                start: pacing.girthMatureStart,
                knee: pacing.girthMatureKnee,
                end: pacing.girthMatureEnd,
                tailExponent: pacing.girthDepthExponent,
            })
            : 0;
        const girthMature = clamp(
            Math.max(
                extensionMature,
                birth + girthSpan,
                trunkLateGirthTarget,
            ),
            extensionMature,
            1,
        );
        const schedule = Object.freeze({
            nodeId,
            parentId: descriptor.parentId,
            role: descriptor.role,
            ...(isTrunk
                ? {
                    trunkArcStart: descriptor.trunkArcStart,
                    trunkArcEnd: descriptor.trunkArcEnd,
                }
                : {}),
            policyVersion: ZEN_BONSAI_CLASSIC2_WOOD_PRESENTATION_POLICY_VERSION,
            persistedBirth: decision.birthProgress,
            persistedMature: decision.matureProgress,
            developmentRecordProgress: decision.birthProgress,
            parentMaturationFraction: pacing.parentMaturationFraction,
            parentReadyProgress: round(parentReadyProgress, 6),
            birth: round(birth, 6),
            shootEmergenceProgress: round(birth, 6),
            extensionMature: round(extensionMature, 6),
            girthMature: round(girthMature, 6),
        });
        scheduleByNodeId[nodeId] = schedule;
        resolving.delete(nodeId);
        return schedule;
    };
    Object.keys(normalized.decisions).sort().forEach(resolveSchedule);
    const schedule = Object.freeze({ ...scheduleByNodeId });
    LINEAGE_PRESENTATION_SCHEDULE_CACHE.set(normalized, schedule);
    return schedule;
};

const resolveNodeRole = (node = {}) => {
    const order = Number(node?.branchOrder);
    if (order === SAKURA_BRANCH_ORDER.TRUNK) {
        return ZEN_BONSAI_GROWTH_NODE_ROLES.TRUNK;
    }
    if (order === SAKURA_BRANCH_ORDER.TERMINAL_TWIG) {
        return ZEN_BONSAI_GROWTH_NODE_ROLES.TWIG;
    }
    return ZEN_BONSAI_GROWTH_NODE_ROLES.SCAFFOLD;
};

const resolveRoleDepth = (node = {}, role, traversalDepth = 1) => {
    if (role === ZEN_BONSAI_GROWTH_NODE_ROLES.TRUNK) {
        return Math.max(1, Math.floor(Number(node.trunkMainDepth ?? traversalDepth) || 1));
    }
    if (role === ZEN_BONSAI_GROWTH_NODE_ROLES.TWIG) {
        return Math.max(1, Math.floor(Number(node.twigDepth ?? 1) || 1));
    }
    return Math.max(1, Math.floor(Number(node.scaffoldDepth ?? 1) || 1));
};

const resolveRoleLimit = (node = {}, role, traversalDepth = 1) => {
    if (role === ZEN_BONSAI_GROWTH_NODE_ROLES.TRUNK) {
        return Math.max(1, Math.floor(Number(node.trunkSegmentLimit ?? node.trunkDepthLimit ?? traversalDepth) || 1));
    }
    if (role === ZEN_BONSAI_GROWTH_NODE_ROLES.TWIG) {
        return Math.max(1, Math.floor(Number(node.twigMaxDepth ?? 1) || 1));
    }
    return Math.max(1, Math.floor(Number(node.scaffoldDepthLimit ?? node.scaffoldMaxDepth ?? traversalDepth) || 1));
};

const resolveNodeKey = (node = {}, traversalDepth = 1) => [
    node.nodeId || 'node',
    node.branchOrderName || '',
    Number(node.branchOrder) || 0,
    traversalDepth,
    Math.round((Number(node.length) || 0) * 100),
    Math.round((Number(node.width) || 0) * 100),
].join('|');

const resolveGrowthProgress = ({ lifeState = null, projection = null } = {}) => {
    const plan = normalizeZenBonsaiGrowthProjection(projection);
    const projectionProgress = clamp01(plan.progress);
    const lifeGrowth = clamp01(lifeState?.growth ?? 0);
    return round(Math.max(projectionProgress, lifeGrowth));
};

const resolveBloomSignal = ({ lifeState = null, projection = null } = {}) => {
    const plan = normalizeZenBonsaiGrowthProjection(projection);
    const bloom = clamp01(lifeState?.bloom ?? lifeState?.vigor?.bloom ?? 0);
    const vitality = clamp01(lifeState?.vitality ?? lifeState?.vigor?.vitality ?? 0.78);
    const vitalityBloom = smoothstep01((vitality - 0.82) / 0.16);
    return clamp01(Math.max(bloom, plan.bloomDevelopmentFloor * vitalityBloom));
};

const resolveBirthWindow = ({
    node = {},
    role,
    roleNorm = 0,
    projection = null,
    traversalDepth = 1,
}) => {
    const plan = normalizeZenBonsaiGrowthProjection(projection);
    const key = resolveNodeKey(node, traversalDepth);
    const jitter = hashUnit(`${key}|classic2_birth`);
    if (role === ZEN_BONSAI_GROWTH_NODE_ROLES.TRUNK) {
        const birth = clamp(0.03 + (roleNorm * 0.58) + (jitter * 0.025), 0, 0.74);
        return {
            birth,
            mature: clamp(birth + lerp(0.18, 0.32, roleNorm), birth + 0.08, 0.92),
        };
    }
    if (role === ZEN_BONSAI_GROWTH_NODE_ROLES.SCAFFOLD) {
        const birth = clamp(
            0.16
            + (roleNorm * 0.3)
            - (plan.scaffoldDevelopment * 0.045)
            - (plan.ramificationFloor * 0.045)
            + (jitter * 0.06),
            0.08,
            0.72,
        );
        return {
            birth,
            mature: clamp(birth + lerp(0.22, 0.34, roleNorm), birth + 0.1, 0.94),
        };
    }
    const birth = clamp(
        0.32
        + (roleNorm * 0.44)
        - (plan.ramificationFloor * 0.07)
        - (plan.terminalDevelopment * 0.03)
        + (jitter * 0.08),
        0.18,
        0.84,
    );
    return {
        birth,
        mature: clamp(birth + lerp(0.2, 0.36, roleNorm), birth + 0.1, 0.98),
    };
};

const resolveNodeAge = ({ growthProgress, birth, mature }) => {
    const span = Math.max(0.0001, mature - birth);
    return smoothstep01((growthProgress - birth) / span);
};

const resolveClassic2BloomStage = (terminal = {}, age = 1) => {
    const sourceStage = ['bud', 'half_open', 'full'].includes(terminal?.blossom?.bloomStage)
        ? terminal.blossom.bloomStage
        : 'full';
    const sourceAdvance = sourceStage === 'full'
        ? 0.08
        : (sourceStage === 'half_open' ? 0.03 : 0);
    const bloomAge = clamp01(age + sourceAdvance);
    if (bloomAge < 0.5) {
        return 'bud';
    }
    if (bloomAge < 0.96) {
        return 'half_open';
    }
    return 'full';
};

const resolveClassic2Blossom = (terminal = {}, age = 1) => {
    if (terminal?.type !== 'flower') {
        return terminal?.blossom;
    }
    const bloomStage = resolveClassic2BloomStage(terminal, age);
    const sourceBlossom = terminal?.blossom && typeof terminal.blossom === 'object'
        ? terminal.blossom
        : {};
    return {
        ...sourceBlossom,
        bloomStage,
        form: bloomStage === 'bud' ? 'cupped' : (sourceBlossom.form || 'open'),
        openness: round(clamp(
            Number(sourceBlossom.openness ?? 0.72) * (bloomStage === 'bud' ? 0.46 : (bloomStage === 'half_open' ? 0.78 : 1)),
            0,
            1,
        )),
    };
};

const resolveNodeScale = ({
    role,
    age,
    girthAge = age,
    roleNorm = 0,
    growthProgress = 1,
    lineageEnabled = false,
}) => {
    if (lineageEnabled) {
        const extensionScaleAge = smoothstep01(clamp01(age) ** 1.15);
        const girthScaleAge = smoothstep01(clamp01(girthAge) ** 1.1);
        if (role === ZEN_BONSAI_GROWTH_NODE_ROLES.TRUNK) {
            const trunkExtensionAge = smoothstep01(
                clamp01(age) ** resolveTrunkDepthAgeExponent({
                    position: roleNorm,
                    start: 0.86,
                    knee: 1.05,
                    end: 13,
                    tailPower: 3,
                }),
            );
            const trunkGirthAge = smoothstep01(
                clamp01(girthAge) ** resolveTrunkDepthAgeExponent({
                    position: roleNorm,
                    start: 1.5,
                    knee: 1.55,
                    end: 12,
                    tailPower: 1.8,
                }),
            );
            const sharedTrunkMassScale = resolveTrunkMassPresentationScale(growthProgress);
            // The entry tree starts with established wood. Once that initial
            // presentation arc has passed, newly emerged later branches retain
            // the narrow shoot floor instead of popping in as mature limbs.
            const trunkWidthPresentationFloor = resolveTrunkWidthPresentationFloor(growthProgress);
            const shootEstablishment = smoothstep01(clamp01(age / 0.72));
            const continuityScale = lerp(
                trunkWidthPresentationFloor,
                sharedTrunkMassScale,
                shootEstablishment,
            );
            const localGirthScale = lerp(
                trunkWidthPresentationFloor,
                1,
                trunkGirthAge,
            );
            const widthScale = Math.min(
                sharedTrunkMassScale,
                Math.max(localGirthScale, continuityScale),
            );
            return {
                length: lerp(0.08, 1, trunkExtensionAge),
                width: widthScale,
                girthPresentationAge: clamp01(
                    (widthScale - trunkWidthPresentationFloor)
                    / (1 - trunkWidthPresentationFloor),
                ),
                trunkMassScale: sharedTrunkMassScale,
            };
        }
        if (role === ZEN_BONSAI_GROWTH_NODE_ROLES.SCAFFOLD) {
            return {
                length: lerp(0.14, 1, extensionScaleAge),
                width: lerp(0.065, 1, girthScaleAge),
            };
        }
        return {
            length: lerp(0.018, 1, extensionScaleAge),
            width: lerp(0.03, 1, girthScaleAge),
        };
    }
    if (role === ZEN_BONSAI_GROWTH_NODE_ROLES.TRUNK) {
        const trunkExtension = smoothstep01((growthProgress - 0.16) / 0.66);
        const trunkMass = smoothstep01((growthProgress - 0.22) / 0.68);
        const lengthAge = Math.min(age, 0.34 + (trunkExtension * 0.66));
        const widthAge = Math.min(
            smoothstep01(age + (roleNorm * 0.08)),
            clamp01(trunkMass + (roleNorm * 0.08)),
        );
        return {
            length: lerp(0.34, 1, lengthAge),
            width: lerp(0.24, 1, widthAge),
        };
    }
    if (role === ZEN_BONSAI_GROWTH_NODE_ROLES.SCAFFOLD) {
        return {
            length: lerp(0.42, 1, age),
            width: lerp(0.24, 1, smoothstep01(age)),
        };
    }
    return {
        length: lerp(0.3, 1, age),
        width: lerp(0.12, 1, smoothstep01(age)),
    };
};

const resolveChildWidthCeilingRatio = (parentRole, childRole) => {
    if (childRole === ZEN_BONSAI_GROWTH_NODE_ROLES.TRUNK) {
        return parentRole === ZEN_BONSAI_GROWTH_NODE_ROLES.TRUNK ? 0.98 : 0.86;
    }
    if (childRole === ZEN_BONSAI_GROWTH_NODE_ROLES.SCAFFOLD) {
        return parentRole === ZEN_BONSAI_GROWTH_NODE_ROLES.TRUNK ? 0.74 : 0.7;
    }
    return parentRole === ZEN_BONSAI_GROWTH_NODE_ROLES.TWIG ? 0.82 : 0.58;
};

const applyChildWidthCeiling = ({
    childNode = null,
    parentRole,
    parentWidth = 0,
    metrics,
} = {}) => {
    if (!childNode || childNode.type !== 'branch') {
        return childNode;
    }
    const childWidth = Number(childNode.width);
    const safeParentWidth = Number(parentWidth);
    if (!Number.isFinite(childWidth) || !Number.isFinite(safeParentWidth) || safeParentWidth <= 0) {
        return childNode;
    }
    const childRole = resolveNodeRole(childNode);
    const widthCeiling = safeParentWidth * resolveChildWidthCeilingRatio(parentRole, childRole);
    if (childWidth <= widthCeiling) {
        return childNode;
    }
    if (metrics) {
        metrics.widthClampedNodes += 1;
    }
    return {
        ...childNode,
        width: round(widthCeiling, 4),
        classic2Development: Object.freeze({
            ...(childNode.classic2Development || {}),
            unclampedWidth: round(childWidth, 4),
            parentWidth: round(safeParentWidth, 4),
            widthCeiling: round(widthCeiling, 4),
        }),
    };
};

const enforceClassic2WidthContinuity = (node = null, metrics) => {
    if (!node || node.type !== 'branch') {
        return node;
    }
    const branches = Array.isArray(node.branches) ? node.branches : [];
    if (!branches.length) {
        return node;
    }
    const parentRole = resolveNodeRole(node);
    const parentWidth = Number(node.width);
    let changed = false;
    const projectedBranches = branches.map((child) => {
        const childNode = child?.obj;
        if (!childNode || childNode.type !== 'branch') {
            return child;
        }
        const widthLimitedChild = applyChildWidthCeiling({
            childNode,
            parentRole,
            parentWidth,
            metrics,
        });
        const normalizedChild = enforceClassic2WidthContinuity(widthLimitedChild, metrics);
        if (normalizedChild !== childNode) {
            changed = true;
            return {
                ...child,
                obj: normalizedChild,
            };
        }
        return child;
    });
    return changed
        ? {
            ...node,
            branches: projectedBranches,
        }
        : node;
};

const makeMetrics = () => ({
    candidateNodes: 0,
    bornNodes: 0,
    frontierNodes: 0,
    widthClampedNodes: 0,
    candidateTerminals: 0,
    bornTerminals: 0,
    candidateFlowerTerminals: 0,
    bornFlowerTerminals: 0,
    lineagePendingNodes: 0,
    lineagePresentationPendingNodes: 0,
    lineageFrontierNodes: 0,
    ageTotal: 0,
    girthAgeTotal: 0,
    flowerAgeTotal: 0,
    byRole: {
        trunk: { candidate: 0, born: 0 },
        scaffold: { candidate: 0, born: 0 },
        twig: { candidate: 0, born: 0 },
    },
});

const resolveTerminalDevelopment = ({
    terminal = {},
    nodeKey = '',
    nodeBirth = 0,
    nodeMature = 1,
    growthProgress = 1,
    bloomSignal = 0,
    lineageEnabled = false,
}) => {
    const isFlower = terminal?.type === 'flower';
    const jitter = hashUnit(`${nodeKey}|terminal|${terminal?.type || 'terminal'}|${Number(terminal?.angle) || 0}|${Number(terminal?.dist) || 0}`);
    const branchDevelopmentSpan = Math.max(0.06, nodeMature - nodeBirth);
    const birth = lineageEnabled
        ? clamp(
            nodeBirth
            + (branchDevelopmentSpan * (isFlower ? 0.08 : 0.04))
            + (jitter * (isFlower ? 0.006 : 0.004)),
            nodeBirth,
            0.98,
        )
        : clamp(
            nodeBirth
            + (isFlower ? 0.13 : 0.06)
            - (isFlower ? bloomSignal * 0.22 : 0)
            + (jitter * (isFlower ? 0.1 : 0.08)),
            nodeBirth,
            0.98,
        );
    const terminalMaturationSpan = isFlower ? 0.14 : 0.11;
    const mature = lineageEnabled
        ? clamp(
            Math.min(nodeMature, birth + terminalMaturationSpan),
            birth + 0.06,
            1,
        )
        : clamp(
            Math.max(nodeMature, birth + (isFlower ? 0.18 : 0.14)),
            birth + 0.06,
            1,
        );
    const age = resolveNodeAge({ growthProgress, birth, mature });
    return {
        birth,
        mature,
        age,
        isBorn: growthProgress >= birth && age > 0.015,
    };
};

const hasTerminalSet = (node = {}) => Array.isArray(node?.terminals) && node.terminals.length > 0;

const hasDescendantTwigOrTerminal = (node = {}, remainingDepth = 4) => {
    if (!node || node.type !== 'branch' || remainingDepth <= 0) {
        return false;
    }
    if (resolveNodeRole(node) === ZEN_BONSAI_GROWTH_NODE_ROLES.TWIG || hasTerminalSet(node)) {
        return true;
    }
    return (Array.isArray(node.branches) ? node.branches : []).some((child) => (
        hasDescendantTwigOrTerminal(child?.obj, remainingDepth - 1)
    ));
};

const wouldBranchBeBorn = ({
    node = null,
    projection = null,
    growthProgress = 1,
    traversalDepth = 1,
} = {}) => {
    if (!node || node.type !== 'branch') {
        return false;
    }
    const role = resolveNodeRole(node);
    const roleDepth = resolveRoleDepth(node, role, traversalDepth);
    const roleLimit = resolveRoleLimit(node, role, traversalDepth);
    const roleNorm = role === ZEN_BONSAI_GROWTH_NODE_ROLES.TRUNK
        && Number.isFinite(Number(node.trunkArcStartNorm))
        && Number.isFinite(Number(node.trunkArcEndNorm))
        ? clamp01((node.trunkArcStartNorm + node.trunkArcEndNorm) * 0.5)
        : clamp01((roleDepth - 1) / Math.max(1, roleLimit - 1));
    const birthWindow = resolveBirthWindow({
        node,
        role,
        roleNorm,
        projection,
        traversalDepth,
    });
    if (role === ZEN_BONSAI_GROWTH_NODE_ROLES.TRUNK && traversalDepth > 1) {
        return growthProgress >= birthWindow.birth;
    }
    if (role !== ZEN_BONSAI_GROWTH_NODE_ROLES.TRUNK) {
        return growthProgress >= birthWindow.birth;
    }
    return true;
};

const resolveFrontierAgeFloor = (role) => {
    if (role === ZEN_BONSAI_GROWTH_NODE_ROLES.TRUNK) {
        return 0.22;
    }
    if (role === ZEN_BONSAI_GROWTH_NODE_ROLES.TWIG) {
        return 0.18;
    }
    return 0.2;
};

const selectFrontierChildIndex = (branches = [], parentRole) => {
    let bestIndex = -1;
    let bestScore = -Infinity;
    branches.forEach((child, index) => {
        const childNode = child?.obj;
        if (!childNode || childNode.type !== 'branch') {
            return;
        }
        const childRole = resolveNodeRole(childNode);
        let score = hasDescendantTwigOrTerminal(childNode) ? 2 : 0;
        if (parentRole === ZEN_BONSAI_GROWTH_NODE_ROLES.TRUNK) {
            score += childRole === ZEN_BONSAI_GROWTH_NODE_ROLES.TRUNK ? 1 : 3;
        } else if (parentRole === ZEN_BONSAI_GROWTH_NODE_ROLES.SCAFFOLD) {
            score += childRole === ZEN_BONSAI_GROWTH_NODE_ROLES.TWIG ? 3 : 1;
        } else {
            score += 1;
        }
        if (score > bestScore) {
            bestScore = score;
            bestIndex = index;
        }
    });
    return bestIndex;
};

const projectTerminal = ({
    terminal = {},
    nodeKey = '',
    nodeBirth = 0,
    nodeMature = 1,
    nodeAge = 1,
    growthProgress = 1,
    bloomSignal = 0,
    lineageEnabled = false,
    metrics,
}) => {
    metrics.candidateTerminals += 1;
    if (terminal?.type === 'flower') {
        metrics.candidateFlowerTerminals += 1;
    }
    const development = resolveTerminalDevelopment({
        terminal,
        nodeKey,
        nodeBirth,
        nodeMature,
        growthProgress,
        bloomSignal,
        lineageEnabled,
    });
    if (!development.isBorn) {
        return null;
    }
    metrics.bornTerminals += 1;
    metrics.flowerAgeTotal += terminal?.type === 'flower' ? development.age : 0;
    if (terminal?.type === 'flower') {
        metrics.bornFlowerTerminals += 1;
    }
    const terminalScale = lineageEnabled
        ? lerp(terminal?.type === 'flower' ? 0.06 : 0.08, 1, smoothstep01(development.age))
        : (terminal?.type === 'flower'
            ? lerp(0.34, 1, development.age)
            : lerp(0.42, 1, development.age));
    const terminalDist = lineageEnabled
        ? lerp(0.18, 1, Math.max(development.age, nodeAge * 0.58))
        : (terminal?.type === 'flower'
            ? lerp(0.72, 1, Math.max(development.age, nodeAge * 0.72))
            : lerp(0.58, 1, Math.max(development.age, nodeAge * 0.72)));
    const sourceDist = Number(terminal.dist) || 0;
    const projectedDist = sourceDist * terminalDist;
    const distFloor = lineageEnabled
        ? (terminal?.type === 'flower' ? 0.7 : 0.5)
        : (terminal?.type === 'flower' ? 3.4 : 2.2);
    return {
        ...terminal,
        dist: round(sourceDist > 0 ? Math.max(projectedDist, distFloor) : projectedDist, 4),
        scale: round((Number(terminal.scale) || 1) * terminalScale, 4),
        ...(terminal?.type === 'flower' ? {
            blossom: Object.freeze(resolveClassic2Blossom(terminal, development.age)),
        } : {}),
        classic2Development: Object.freeze({
            birth: round(development.birth),
            mature: round(development.mature),
            age: round(development.age),
            lineage: lineageEnabled,
            renderGrowth: round(lineageEnabled
                ? lerp(0.08, terminal?.type === 'flower' ? 0.98 : 0.9, development.age)
                : (terminal?.type === 'flower'
                    ? lerp(0.76, 0.98, development.age)
                    : lerp(0.56, 0.9, development.age))),
        }),
    };
};

const resolvePhysicalTrunkLineagePresentation = ({
    node,
    bindingEntry,
    decision,
}) => {
    const trunkArcStart = Number(node.trunkArcStartNorm);
    const trunkArcEnd = Number(node.trunkArcEndNorm);
    if (
        !Number.isFinite(trunkArcStart)
        || !Number.isFinite(trunkArcEnd)
        || trunkArcStart < 0
        || trunkArcEnd > 1
        || trunkArcEnd <= trunkArcStart
        || Math.abs(trunkArcStart - bindingEntry.trunkArcStart) > 1e-6
        || Math.abs(trunkArcEnd - bindingEntry.trunkArcEnd) > 1e-6
    ) {
        throw new Error(`ZEN_BONSAI_CLASSIC2_PRESENTATION_RENDER_TRUNK_ARC_MISMATCH:${node.nodeId}`);
    }
    const startReference = resolveTrunkArcPacingReference(trunkArcStart);
    const endReference = resolveTrunkArcPacingReference(trunkArcEnd);
    const developmentRecordProgress = trunkArcStart <= 1e-8
        ? 0
        : resolveZenBonsaiClassic2TrunkArcRecordProgress(trunkArcStart);
    const birth = trunkArcStart <= 1e-8
        ? 0
        : clamp(startReference.birth, 0, 1);
    const extensionMature = clamp(Math.max(
        birth + 0.012,
        endReference.extensionMature,
    ), birth, 1);
    return Object.freeze({
        nodeId: bindingEntry.logicalNodeId,
        renderNodeId: node.nodeId,
        parentId: null,
        role: ZEN_BONSAI_GROWTH_NODE_ROLES.TRUNK,
        trunkArcStart,
        trunkArcEnd,
        policyVersion: ZEN_BONSAI_CLASSIC2_WOOD_PRESENTATION_POLICY_VERSION,
        persistedBirth: decision.birthProgress,
        persistedMature: decision.matureProgress,
        developmentRecordProgress: round(developmentRecordProgress, 6),
        parentMaturationFraction:
            ZEN_BONSAI_CLASSIC2_ROLE_PRESENTATION_PACING.trunk.parentMaturationFraction,
        parentReadyProgress: round(startReference.birth, 6),
        birth: round(birth, 6),
        shootEmergenceProgress: round(birth, 6),
        extensionMature: round(extensionMature, 6),
        girthMature: 1,
    });
};

const resolveBoundLineageProjection = ({
    node,
    lineageState,
    lineageRenderBinding,
    lineageDispositionByNodeId,
    lineagePresentationByNodeId,
}) => {
    const renderNodeId = typeof node?.nodeId === 'string' ? node.nodeId : '';
    const bindingEntry = lineageRenderBinding.nodeBindings[renderNodeId];
    if (!bindingEntry) {
        throw new Error(`ZEN_BONSAI_CLASSIC2_PRESENTATION_RENDER_BINDING_REQUIRED:${renderNodeId || 'unknown'}`);
    }
    const role = resolveNodeRole(node);
    if (bindingEntry.role !== role) {
        throw new Error(`ZEN_BONSAI_CLASSIC2_PRESENTATION_RENDER_ROLE_MISMATCH:${renderNodeId}`);
    }
    const logicalNodeId = bindingEntry.logicalNodeId;
    const descriptor = lineageState.candidateGraph[logicalNodeId];
    if (!descriptor || descriptor.role !== role) {
        throw new Error(`ZEN_BONSAI_CLASSIC2_PRESENTATION_LOGICAL_NODE_REQUIRED:${logicalNodeId}`);
    }
    if (role === ZEN_BONSAI_GROWTH_NODE_ROLES.TRUNK && (
        logicalNodeId !== lineageRenderBinding.macroRootNodeId
        || descriptor.parentId !== null
        || descriptor.trunkArcStart !== 0
        || descriptor.trunkArcEnd !== 1
        || descriptor.trunkGuideShapeId !== lineageRenderBinding.trunkGuideShapeId
    )) {
        throw new Error(`ZEN_BONSAI_CLASSIC2_PRESENTATION_MACRO_TRUNK_MISMATCH:${renderNodeId}`);
    }
    const decision = lineageState.decisions[logicalNodeId] || null;
    const disposition = lineageDispositionByNodeId[logicalNodeId] || null;
    const presentation = decision?.status === 'selected'
        ? (role === ZEN_BONSAI_GROWTH_NODE_ROLES.TRUNK
            ? resolvePhysicalTrunkLineagePresentation({
                node,
                bindingEntry,
                decision,
            })
            : lineagePresentationByNodeId[logicalNodeId])
        : null;
    if (decision?.status === 'selected' && !presentation) {
        throw new Error(`ZEN_BONSAI_CLASSIC2_PRESENTATION_SCHEDULE_REQUIRED:${logicalNodeId}`);
    }
    return Object.freeze({
        logicalNodeId,
        descriptor,
        decision,
        disposition,
        presentation,
    });
};

const projectBranchNode = ({
    node = null,
    projection = null,
    growthProgress = 1,
    bloomSignal = 0,
    traversalDepth = 1,
    forceFrontier = false,
    frontierDepthBudget = 0,
    lineageState = null,
    lineageDispositionByNodeId = null,
    lineagePresentationByNodeId = null,
    lineageRenderBinding = null,
    trunkExtensionProfile = null,
    lineageEnabled = false,
    metrics,
}) => {
    if (!node || node.type !== 'branch') {
        return null;
    }
    const role = resolveNodeRole(node);
    const roleDepth = resolveRoleDepth(node, role, traversalDepth);
    const roleLimit = resolveRoleLimit(node, role, traversalDepth);
    const trunkArcStart = Number(node.trunkArcStartNorm);
    const trunkArcEnd = Number(node.trunkArcEndNorm);
    const hasExactTrunkArc = Number.isFinite(trunkArcStart)
        && Number.isFinite(trunkArcEnd)
        && trunkArcStart >= 0
        && trunkArcEnd <= 1
        && trunkArcEnd > trunkArcStart;
    const boundLineage = lineageEnabled
        ? resolveBoundLineageProjection({
            node,
            lineageState,
            lineageRenderBinding,
            lineageDispositionByNodeId,
            lineagePresentationByNodeId,
        })
        : null;
    const lineageLogicalNodeId = boundLineage?.logicalNodeId || null;
    const lineageDecision = boundLineage?.decision || null;
    const lineageDisposition = boundLineage?.disposition || null;
    const lineagePresentation = boundLineage?.presentation || null;
    const roleNorm = role === ZEN_BONSAI_GROWTH_NODE_ROLES.TRUNK && hasExactTrunkArc
        ? clamp01((trunkArcStart + trunkArcEnd) * 0.5)
        : clamp01((roleDepth - 1) / Math.max(1, roleLimit - 1));
    if (lineageEnabled && role === ZEN_BONSAI_GROWTH_NODE_ROLES.TRUNK && !trunkExtensionProfile) {
        throw new Error('ZEN_BONSAI_CLASSIC2_PRESENTATION_TRUNK_EXTENSION_PROFILE_REQUIRED');
    }
    const trunkExtensionProjection = (
        lineageEnabled
        && role === ZEN_BONSAI_GROWTH_NODE_ROLES.TRUNK
    )
        ? trunkExtensionProfile.resolveSpan(trunkArcStart, trunkArcEnd)
        : null;
    const birthWindow = lineageDecision?.status === 'selected'
        ? {
            birth: lineagePresentation.birth,
            mature: lineagePresentation.extensionMature,
            girthMature: lineagePresentation.girthMature,
        }
        : (() => {
            const resolved = resolveBirthWindow({
                node,
                role,
                roleNorm,
                projection,
                traversalDepth,
            });
            return {
                ...resolved,
                girthMature: resolved.mature,
            };
        })();
    const age = resolveNodeAge({
        growthProgress,
        birth: birthWindow.birth,
        mature: birthWindow.mature,
    });
    const girthAge = resolveNodeAge({
        growthProgress,
        birth: birthWindow.birth,
        mature: birthWindow.girthMature,
    });
    metrics.candidateNodes += 1;
    metrics.byRole[role].candidate += 1;
    if (lineageEnabled && lineageDecision?.status !== 'selected') {
        if (lineageDisposition === ZEN_BONSAI_CLASSIC2_LINEAGE_CANDIDATE_DISPOSITIONS.PENDING) {
            metrics.lineagePendingNodes += 1;
        }
        return null;
    }
    const activeForceFrontier = !lineageEnabled && forceFrontier;
    if (
        role === ZEN_BONSAI_GROWTH_NODE_ROLES.TRUNK
        && traversalDepth > 1
        && (lineageEnabled
            ? !trunkExtensionProjection.visible
            : growthProgress < birthWindow.birth)
        && !activeForceFrontier
    ) {
        return null;
    }
    if (role !== ZEN_BONSAI_GROWTH_NODE_ROLES.TRUNK && growthProgress < birthWindow.birth && !activeForceFrontier) {
        if (Array.isArray(node.terminals)) {
            node.terminals.forEach((terminal) => {
                metrics.candidateTerminals += 1;
                if (terminal?.type === 'flower') {
                    metrics.candidateFlowerTerminals += 1;
                }
            });
        }
        return null;
    }

    metrics.bornNodes += 1;
    metrics.byRole[role].born += 1;
    if (activeForceFrontier) {
        metrics.frontierNodes += 1;
    }
    const developmentalAge = activeForceFrontier
        ? Math.max(age, resolveFrontierAgeFloor(role))
        : age;
    const developmentalGirthAge = activeForceFrontier
        ? Math.max(girthAge, resolveFrontierAgeFloor(role) * 0.45)
        : girthAge;
    metrics.ageTotal += developmentalAge;
    const scale = resolveNodeScale({
        role,
        age: developmentalAge,
        girthAge: developmentalGirthAge,
        roleNorm,
        growthProgress,
        lineageEnabled,
    });
    const presentedGirthAge = Number.isFinite(Number(scale.girthPresentationAge))
        ? clamp01(scale.girthPresentationAge)
        : developmentalGirthAge;
    metrics.girthAgeTotal += presentedGirthAge;
    const projectedLengthScale = trunkExtensionProjection?.lengthScale ?? scale.length;
    const projectedLength = round((Number(node.length) || 0) * projectedLengthScale, 4);
    const projectedWidth = round((Number(node.width) || 0) * scale.width, 4);
    const projectedCurveScale = trunkExtensionProjection?.lengthScale
        ?? lerp(lineageEnabled ? 0.12 : 0.62, 1, age);
    const nodeKey = lineageEnabled
        ? `${lineageLogicalNodeId}${role === ZEN_BONSAI_GROWTH_NODE_ROLES.TRUNK
            ? `:arc_end_${round(trunkArcEnd, 7)}`
            : ''}`
        : resolveNodeKey(node, traversalDepth);
    const projectedTerminals = (Array.isArray(node.terminals) ? node.terminals : [])
        .map((terminal) => projectTerminal({
            terminal,
            nodeKey,
            nodeBirth: birthWindow.birth,
            nodeMature: birthWindow.mature,
            nodeAge: developmentalAge,
            growthProgress,
            bloomSignal,
            lineageEnabled,
            metrics,
        }))
        .filter(Boolean);
    const sourceBranches = Array.isArray(node.branches) ? node.branches : [];
    const childLineageByEdge = lineageEnabled
        ? new Map(sourceBranches.map((child) => [
            child,
            resolveBoundLineageProjection({
                node: child?.obj,
                lineageState,
                lineageRenderBinding,
                lineageDispositionByNodeId,
                lineagePresentationByNodeId,
            }),
        ]))
        : null;
    const hasNaturallyBornChild = lineageEnabled
        ? sourceBranches.some((child) => {
            const boundChild = childLineageByEdge.get(child);
            return boundChild.decision?.status === 'selected'
                && boundChild.presentation?.birth <= growthProgress;
        })
        : sourceBranches.some((child) => wouldBranchBeBorn({
            node: child?.obj,
            projection,
            growthProgress,
            traversalDepth: traversalDepth + 1,
        }));
    const frontierChildIndex = (
        !lineageEnabled
        && role !== ZEN_BONSAI_GROWTH_NODE_ROLES.TWIG
        && frontierDepthBudget > 0
        && !hasNaturallyBornChild
    )
        ? selectFrontierChildIndex(sourceBranches, role)
        : -1;
    const projectedBranches = sourceBranches
        .map((child) => {
            const childForceFrontier = frontierChildIndex >= 0
                && sourceBranches[frontierChildIndex] === child;
            const childNode = projectBranchNode({
                node: child?.obj,
                projection,
                growthProgress,
                bloomSignal,
                traversalDepth: traversalDepth + 1,
                forceFrontier: childForceFrontier,
                frontierDepthBudget: childForceFrontier
                    ? Math.max(0, frontierDepthBudget - 1)
                    : frontierDepthBudget,
                lineageState,
                lineageDispositionByNodeId,
                lineagePresentationByNodeId,
                lineageRenderBinding,
                trunkExtensionProfile,
                lineageEnabled,
                metrics,
            });
            if (!childNode) {
                return null;
            }
            return {
                ...child,
                obj: childNode,
            };
        })
        .filter(Boolean);
    const hasPendingLineageChild = lineageEnabled && sourceBranches.some((child) => (
        childLineageByEdge.get(child).disposition
            === ZEN_BONSAI_CLASSIC2_LINEAGE_CANDIDATE_DISPOSITIONS.PENDING
    ));
    const hasPresentationPendingLineageChild = lineageEnabled && sourceBranches.some((child) => {
        const boundChild = childLineageByEdge.get(child);
        return boundChild.decision?.status === 'selected'
            && boundChild.presentation?.birth > growthProgress;
    });
    const hasUnbornLineageTerminal = lineageEnabled
        && (Array.isArray(node.terminals) ? node.terminals.length : 0) > projectedTerminals.length;
    const lineageFrontier = lineageEnabled
        && (
            Boolean(trunkExtensionProjection?.containsFrontier)
            || (
                projectedBranches.length === 0
                && (
                    hasPendingLineageChild
                    || hasPresentationPendingLineageChild
                    || hasUnbornLineageTerminal
                )
            )
        );
    if (lineageFrontier) {
        metrics.lineageFrontierNodes += 1;
    }

    const projectedCurve = round((Number(node.curve) || 0) * projectedCurveScale, 5);
    const projectedCurveIn = round((Number(node.curveIn) || 0) * projectedCurveScale, 5);
    const projectedCurveOut = round((Number(node.curveOut) || 0) * projectedCurveScale, 5);
    const sourceLength = Number(node.length) || 0;
    const exactCubicLengthScale = sourceLength > 0 ? projectedLength / sourceLength : 1;
    const exactCubicControl = node?.exactCubicControl
        ? {
            ...node.exactCubicControl,
            cp1Along: Number(node.exactCubicControl.cp1Along) * exactCubicLengthScale,
            cp1Normal: projectedCurveIn,
            cp2Along: Number(node.exactCubicControl.cp2Along) * exactCubicLengthScale,
            cp2Normal: projectedCurveOut,
        }
        : null;

    return {
        ...node,
        length: projectedLength,
        width: projectedWidth,
        curve: projectedCurve,
        curveIn: projectedCurveIn,
        curveOut: projectedCurveOut,
        ...(exactCubicControl ? { exactCubicControl } : {}),
        branches: projectedBranches,
        terminals: projectedTerminals,
        classic2Development: Object.freeze({
            role,
            roleDepth,
            roleLimit,
            birth: round(birthWindow.birth),
            mature: round(birthWindow.mature),
            girthMature: round(birthWindow.girthMature),
            age: round(developmentalAge),
            girthAge: round(presentedGirthAge),
            naturalGirthAge: round(developmentalGirthAge),
            ...(Number.isFinite(Number(scale.trunkMassScale)) ? {
                trunkMassScale: round(scale.trunkMassScale),
            } : {}),
            naturalAge: round(age),
            frontier: Boolean(activeForceFrontier),
            ...(lineageEnabled ? {
                lineageNodeId: lineageLogicalNodeId,
                lineageStatus: lineageDecision.status,
                lineageFrontier,
                lineagePolicyVersion: lineageDecision.provenance?.policyVersion || null,
                lineageCohortId: lineageDecision.provenance?.cohortId || null,
                lineageHistorySegmentRef: lineageDecision.provenance?.historySegmentRef || null,
                lineageScore: lineageDecision.provenance?.score ?? null,
                woodPresentationPolicyVersion: lineagePresentation.policyVersion,
                persistedBirth: round(lineagePresentation.persistedBirth),
                persistedMature: round(lineagePresentation.persistedMature),
                developmentRecordProgress: round(
                    lineagePresentation.developmentRecordProgress,
                ),
                ...(trunkExtensionProjection ? {
                    trunkExtensionFrontierArc: trunkExtensionProfile.frontierArc,
                    trunkVisibleArcStart: round(
                        trunkExtensionProjection.visibleArcStart,
                        7,
                    ),
                    trunkVisibleArcEnd: round(
                        trunkExtensionProjection.visibleArcEnd,
                        7,
                    ),
                    trunkExtensionScale: round(trunkExtensionProjection.lengthScale, 7),
                } : {}),
                shootEmergenceProgress: round(lineagePresentation.birth),
                parentReadyProgress: round(lineagePresentation.parentReadyProgress),
                parentMaturationFraction: round(lineagePresentation.parentMaturationFraction),
            } : {}),
        }),
    };
};

const summarizeMetrics = (metrics) => Object.freeze({
    candidateNodes: metrics.candidateNodes,
    bornNodes: metrics.bornNodes,
    frontierNodes: metrics.frontierNodes,
    widthClampedNodes: metrics.widthClampedNodes,
    candidateTerminals: metrics.candidateTerminals,
    bornTerminals: metrics.bornTerminals,
    candidateFlowerTerminals: metrics.candidateFlowerTerminals,
    bornFlowerTerminals: metrics.bornFlowerTerminals,
    lineagePendingNodes: metrics.lineagePendingNodes,
    lineagePresentationPendingNodes: metrics.lineagePresentationPendingNodes,
    lineageFrontierNodes: metrics.lineageFrontierNodes,
    meanNodeAge: round(metrics.ageTotal / Math.max(1, metrics.bornNodes)),
    meanNodeGirthAge: round(metrics.girthAgeTotal / Math.max(1, metrics.bornNodes)),
    meanFlowerAge: round(metrics.flowerAgeTotal / Math.max(1, metrics.bornFlowerTerminals)),
    byRole: Object.freeze({
        trunk: Object.freeze({ ...metrics.byRole.trunk }),
        scaffold: Object.freeze({ ...metrics.byRole.scaffold }),
        twig: Object.freeze({ ...metrics.byRole.twig }),
    }),
});

export const projectZenBonsaiClassic2DevelopmentTopology = ({
    topology = null,
    lifeState = null,
    projection = null,
    lineageState = null,
    lineageRenderBinding = null,
    requireLineage = false,
    woodClockPolicy = null,
} = {}) => {
    if (requireLineage && !lineageState) {
        throw new Error('ZEN_BONSAI_CLASSIC2_LINEAGE_STATE_REQUIRED');
    }
    const plan = normalizeZenBonsaiGrowthProjection(projection);
    const resolvedWoodClockPolicy = requireClassic2WoodClockPolicy(woodClockPolicy);
    const metrics = makeMetrics();
    const projectionGrowthProgress = resolveGrowthProgress({ lifeState, projection: plan });
    const currentLifeGrowth = clamp01(lifeState?.growth ?? lifeState?.maturity?.growth ?? 0);
    const lineageEnabled = Boolean(lineageState);
    const normalizedLineageState = lineageEnabled
        ? normalizeZenBonsaiClassic2LineageState(lineageState)
        : null;
    const normalizedLineageRenderBinding = lineageEnabled
        ? requireZenBonsaiClassic2LineageRenderBindingForTopology(
            lineageRenderBinding,
            topology,
        )
        : null;
    if (lineageEnabled && (
        normalizedLineageRenderBinding.macroRootNodeId
            !== Object.values(normalizedLineageState.candidateGraph).find(
                (descriptor) => descriptor.parentId === null,
            )?.nodeId
        || normalizedLineageRenderBinding.treeFingerprint
            !== normalizedLineageState.treeFingerprint
    )) {
        throw new Error('ZEN_BONSAI_CLASSIC2_PRESENTATION_RENDER_BINDING_ROOT_MISMATCH');
    }
    const lineageDispositionByNodeId = lineageEnabled
        ? resolveZenBonsaiClassic2LineageCandidateDispositionMap(normalizedLineageState)
        : null;
    const lineagePresentationByNodeId = lineageEnabled
        ? resolveZenBonsaiClassic2LineagePresentationSchedule(normalizedLineageState)
        : null;
    const growthProgress = lineageEnabled
        ? (resolvedWoodClockPolicy === ZEN_BONSAI_CLASSIC2_WOOD_CLOCK_POLICIES.EPHEMERAL_SCRUB
            ? Math.min(currentLifeGrowth, normalizedLineageState.maxObservedGrowth)
            : normalizedLineageState.maxObservedGrowth)
        : projectionGrowthProgress;
    const trunkExtensionProfile = lineageEnabled
        ? resolveTrunkExtensionProfile(growthProgress)
        : null;
    if (lineageEnabled) {
        metrics.lineagePresentationPendingNodes = Object.values(
            lineagePresentationByNodeId,
        ).filter((entry) => entry.birth > growthProgress).length;
    }
    const bloomSignal = resolveBloomSignal({ lifeState, projection: plan });
    const projected = enforceClassic2WidthContinuity(projectBranchNode({
        node: topology,
        projection: plan,
        growthProgress,
        bloomSignal,
        metrics,
        frontierDepthBudget: lineageEnabled ? 0 : 2,
        lineageState: normalizedLineageState,
        lineageDispositionByNodeId,
        lineagePresentationByNodeId,
        lineageRenderBinding: normalizedLineageRenderBinding,
        trunkExtensionProfile,
        lineageEnabled,
    }), metrics);
    return Object.freeze({
        topology: projected,
        diagnostics: Object.freeze({
            model: 'classic2',
            growthProgress,
            currentLifeGrowth,
            woodClockPolicy: resolvedWoodClockPolicy,
            projectionGrowthProgress,
            projectionLeadOverWoodClock: round(Math.max(
                0,
                projectionGrowthProgress - growthProgress,
            )),
            woodPresentationPolicyVersion: lineageEnabled
                ? ZEN_BONSAI_CLASSIC2_WOOD_PRESENTATION_POLICY_VERSION
                : null,
            woodPresentationSemantics: lineageEnabled
                ? ZEN_BONSAI_CLASSIC2_WOOD_PRESENTATION_SEMANTICS
                : null,
            bloomSignal: round(bloomSignal),
            lineage: lineageEnabled
                ? summarizeZenBonsaiClassic2LineageState(normalizedLineageState)
                : null,
            logicalCandidateNodes: lineageEnabled
                ? Object.keys(normalizedLineageState.candidateGraph).length
                : null,
            physicalCandidateNodes: lineageEnabled
                ? normalizedLineageRenderBinding.physicalNodeCount
                : null,
            physicalTrunkSpanCount: lineageEnabled
                ? normalizedLineageRenderBinding.physicalTrunkSpanCount
                : null,
            trunkExtensionFrontierArc: lineageEnabled
                ? trunkExtensionProfile.frontierArc
                : null,
            trunkIntegratedExtension: lineageEnabled
                ? trunkExtensionProfile.integratedExtension
                : null,
            terminalContinuity: collectZenBonsaiTerminalContinuityStats(projected, {
                growthPlan: resolveZenBonsaiClassic2RenderProjection(plan),
            }),
            ...summarizeMetrics(metrics),
        }),
    });
};

export const resolveZenBonsaiClassic2RenderProjection = (projection = null) => {
    const plan = normalizeZenBonsaiGrowthProjection(projection);
    const visualMaturity = smoothstep01((plan.progress - 0.48) / 0.34);
    const bloomVisualMaturity = smoothstep01((plan.progress - 0.5) / 0.32);
    return normalizeZenBonsaiGrowthProjection({
        ...plan,
        visibleDepth: 9,
        lengthScale: 1,
        widthScale: 1,
        trunkReveal: 1,
        scaffoldReveal: 1,
        twigReveal: 1,
        terminalReveal: 1,
        leafDensityFloor: Math.max(
            plan.leafDensityFloor,
            round(lerp(0.54, 0.36, visualMaturity)),
        ),
        flowerGateScale: Math.max(
            plan.flowerGateScale,
            round(lerp(0.28, 0.82, bloomVisualMaturity)),
        ),
        bloomDevelopmentFloor: Math.max(
            plan.bloomDevelopmentFloor,
            round(lerp(0.18, 0.72, bloomVisualMaturity)),
        ),
        miniatureBloomScale: Math.max(
            plan.miniatureBloomScale,
            round(lerp(0.5, 0.9, visualMaturity)),
        ),
        frontierReveal: 1,
    });
};

export const resolveZenBonsaiClassic2RenderStage = ({
    stage = null,
    structureDepth = 6,
    growthProjection = null,
} = {}) => Object.freeze({
    ...resolveZenBonsaiClassic2GenerationStage({ stage, structureDepth }),
    growthProjection: resolveZenBonsaiClassic2RenderProjection(growthProjection),
});
