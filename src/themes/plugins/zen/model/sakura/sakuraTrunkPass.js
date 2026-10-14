import { ShapePriorModel, SAKURA_BRANCH_ORDER } from '../bonsai/generation/shapePriorModel';
import { requireTrunkPathPlanV1 } from '../bonsai/generation/trunkPathPlanV1';
import { createBranchNode } from './sakuraBranchNodeFactory';
import {
    assertTrunkPassFactoryContract,
    assertTrunkPassCallContract,
    assertTrunkPassResultContract,
} from './sakuraPassContracts';

const assertPlanMatchesPassLimits = ({
    trunkPathPlan,
    trunkSegmentLimit,
    structuralMaxDepth,
}) => {
    if (Number(trunkPathPlan.trunkSegmentLimit) !== Number(trunkSegmentLimit)) {
        throw new Error('ZEN_TRUNK_PATH_PLAN_V1_LIMIT_MISMATCH:trunkSegmentLimit');
    }
    if (Number(trunkPathPlan.structuralMaxDepth) !== Number(structuralMaxDepth)) {
        throw new Error('ZEN_TRUNK_PATH_PLAN_V1_LIMIT_MISMATCH:structuralMaxDepth');
    }
    trunkPathPlan.spans.forEach((span, index) => {
        if (
            !Number.isFinite(span.arcStartNorm)
            || !Number.isFinite(span.arcEndNorm)
            || span.arcEndNorm <= span.arcStartNorm
            || !Number.isFinite(span.arcEndWidth)
        ) {
            throw new Error(`ZEN_TRUNK_PATH_PLAN_V1_ACTIVE_ARC_INVALID:${index}`);
        }
    });
};

const assertStateMatchesSpan = (state, span) => {
    [
        'currentDepth',
        'currentX',
        'currentY',
        'length',
        'width',
        'parentAngle',
        'lastDir',
        'trunkMainDepth',
    ].forEach((field) => {
        if (Number(state[field]) !== Number(span[field])) {
            throw new Error(`ZEN_TRUNK_PATH_PLAN_V1_STATE_MISMATCH:${field}`);
        }
    });
};

export const createSakuraTrunkPass = (input = {}) => {
    assertTrunkPassFactoryContract(input);
    const {
        limits = {},
        trunkPolicy = {},
        random = {},
        hooks = {},
    } = input;
    const {
        trunkSegmentLimit,
        structuralMaxDepth,
    } = limits;
    const trunkPathPlan = requireTrunkPathPlanV1(trunkPolicy.trunkPathPlan);
    assertPlanMatchesPassLimits({
        trunkPathPlan,
        trunkSegmentLimit,
        structuralMaxDepth,
    });
    const {
        createFallbackRandom,
        nextRandomFn,
    } = random;
    const {
        onTrunkNode = null,
    } = hooks;

    const generateTrunkBranch = (state = {}, collections) => {
        assertTrunkPassCallContract({ state, collections });
        const trunkMainDepth = Math.round(Number(state.trunkMainDepth) || 1);
        const spanIndex = trunkMainDepth - 1;
        const span = trunkPathPlan.spans[spanIndex];
        if (!span) {
            throw new Error(`ZEN_TRUNK_PATH_PLAN_V1_SPAN_MISSING:${spanIndex}`);
        }
        assertStateMatchesSpan(state, span);

        const {
            currentDepth,
            length,
            width,
            lastDir,
            trunkSegmentLength,
            curve,
            curveIn,
            curveOut,
            exactCubicControl,
            branchSegment,
            isTerminal,
            childState,
        } = span;
        const localRandom = state.nodeRandom || createFallbackRandom({
            depth: currentDepth,
            order: SAKURA_BRANCH_ORDER.TRUNK,
            nodeSlot: trunkMainDepth,
            decisionType: 'trunk_fallback',
        });
        const node = createBranchNode({
            nodeRandom: localRandom,
            branchOrder: SAKURA_BRANCH_ORDER.TRUNK,
            length,
            width,
            curve,
            curveIn,
            curveOut,
            exactCubicControl,
            includeLenticels: true,
            nextRandomFn,
        });
        node.growthRole = 'trunk';
        node.trunkMainDepth = trunkMainDepth;
        node.trunkSegmentLimit = trunkSegmentLimit;
        // Adaptive spans are render geometry, not development topology. Keep
        // their exact continuous-spine position so Classic2 can pace wood in
        // stable arc space instead of using subdivision count as biological
        // depth.
        node.trunkArcStartNorm = Number(span.arcStartNorm);
        node.trunkArcEndNorm = Number(span.arcEndNorm);
        onTrunkNode?.({
            depth: trunkMainDepth,
            width,
            length,
        });

        collections.trunkSpanRegistry.push({
            spanIndex,
            node,
            branchSegment,
            currentDepth,
            trunkMainDepth,
            trunkSegmentLength,
            lastDir,
            arcStartNorm: Number(span.arcStartNorm),
            arcEndNorm: Number(span.arcEndNorm),
            arcStartWidth: width,
            arcEndWidth: span.arcEndWidth,
        });

        if (isTerminal) {
            assertTrunkPassResultContract(node);
            return node;
        }
        if (!childState) {
            throw new Error(`ZEN_TRUNK_PATH_PLAN_V1_CHILD_STATE_MISSING:${spanIndex}`);
        }

        const childNodeRandom = localRandom.fork({
            depth: currentDepth + 1,
            nodeRole: ShapePriorModel.resolveSakuraOrderName(SAKURA_BRANCH_ORDER.TRUNK),
            nodeSlot: 0,
            decisionType: 'trunk_main',
        });
        node.branches.push({
            obj: generateTrunkBranch({
                ...childState,
                nodeRandom: childNodeRandom,
            }, collections),
            angleOffset: childState.angleOffset,
            t: 1,
        });

        assertTrunkPassResultContract(node);
        return node;
    };

    return generateTrunkBranch;
};
