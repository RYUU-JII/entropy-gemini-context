import { ShapePriorModel, SAKURA_BRANCH_ORDER } from '../bonsai/generation/shapePriorModel';
import { GrowthDecayPolicyModel } from '../bonsai/generation/growthDecayPolicyModel';
import { TerminalGenerationPolicyModel } from '../bonsai/generation/terminalGenerationPolicyModel';
import { BranchGeometryModel } from '../bonsai/geometry/branchGeometryModel';
import { SakuraAngleGuardModel } from '../bonsai/generation/SakuraAngleGuardModel';
import {
    clamp,
    lerp,
    degToRad,
} from './sakuraMath';
import {
    buildSakuraBranchConfigs,
    resolveSakuraCurveState,
    sampleCenteredNoise,
} from './sakuraBranchDynamics';
import {
    createHarmonicCurveFlow,
    advanceHarmonicCurveFlow,
    resolveHarmonicCurveOffset,
    resolveCurveMemoryControls,
    resolveSmoothedFlowOffset,
    syncFlowToGuardedOffset,
} from './sakuraTwigCurveFlow';
import { createBranchNode } from './sakuraBranchNodeFactory';
import {
    resolveTierContext,
    resolveDynamicLengthMult,
    resolveChildAttachT,
    resolveTwigBranchCount,
} from './sakuraBranchHeuristics';
import { nextRandom } from './sakuraRandomUtils';
import { assertTwigPassResultContract } from './sakuraPassContracts';

export const createTwigBranchEmitter = (input = {}) => {
    const {
        context = {},
        tiers = {},
        limits = {},
        decay = {},
        runtime = {},
        random = {},
        hooks = {},
    } = input;
    const {
        currentStage,
        config,
        morphologyProfile,
        scaffoldStrength,
    } = context;
    const {
        tierModels,
        tierModelByTier,
        tierStrategies,
        twigTierGene,
    } = tiers;
    const {
        trunkSegmentLimit,
        twigMaxDepth,
        scaffoldMaxDepth,
        structuralMaxDepth,
    } = limits;
    const {
        trunkInternodeDecay,
        trunkWidthDecay,
        lengthRatioByTier,
        widthReductionByTier,
    } = decay;
    const {
        maxRelativeBendDeg,
        learningProgress,
        priorStrength,
        twigUpwardBiasProb,
        twigDownwardRatio = 0,
        branchChaos,
        verticalBias,
        trunkStyle,
        trunkBackboneLockStrength,
        twigNodeBloomChance,
    } = runtime;
    const {
        nextRandomFn,
        createFallbackRandom,
    } = random;
    const {
        addTerminalSet,
        onTwigBudget = null,
    } = hooks;

    const generateTwigBranch = (state = {}) => {
        const {
            currentDepth,
            currentX,
            currentY,
            length,
            width,
            parentAngle,
            lastDir = 1,
            orderRunDepth = 0,
            twigLevel = 0,
            nodeRandom = null,
            twigDepth = 1,
            curveFlow = null,
            twigChildBudget = 20,
        } = state;
        const finiteTwigChildBudget = Number.isFinite(Number(twigChildBudget))
            ? Math.max(0, Math.floor(Number(twigChildBudget)))
            : Number.POSITIVE_INFINITY;
        onTwigBudget?.({
            exhausted: finiteTwigChildBudget <= 0,
            depth: twigDepth,
            budget: finiteTwigChildBudget,
        });

        const localRandom = nodeRandom || createFallbackRandom({
            depth: currentDepth,
            order: SAKURA_BRANCH_ORDER.TERMINAL_TWIG,
            nodeSlot: orderRunDepth,
            decisionType: 'twig_fallback',
        });
        const resolvedCurveFlow = curveFlow || createHarmonicCurveFlow({
            rng: localRandom.fork({
                depth: currentDepth,
                nodeRole: 'twig_curve_flow',
                nodeSlot: Math.max(0, orderRunDepth),
                decisionType: 'flow',
            }),
            gene: twigTierGene,
            morphologyProfile,
            tier: 'twig',
            depthLimit: twigMaxDepth,
            lastDir,
        });

        const branchState = {
            trunkMainDepth: 1,
            scaffoldDepth: 1,
            twigDepth,
            trunkSegmentLimit,
            scaffoldMaxDepth,
            twigMaxDepth,
        };
        const {
            roleDepth,
            progress,
            branchWidthScale,
            twigStartScale,
        } = resolveTierContext({
            tierStrategies,
            isTrunk: false,
            isTwig: true,
            branchState,
        });

        const curveState = resolveSakuraCurveState({
            gene: twigTierGene,
            morphologyProfile,
            localRandom,
            currentX,
            currentY,
            roleDepth,
            length,
            progress,
            isTrunk: false,
            isTwig: true,
            isSecondaryBranch: false,
            trunkMainDepth: 1,
            trunkSegmentLimit,
        });
        const {
            sakuraCurve,
            noiseTwist,
        } = curveState;
        const curveMemory = resolveCurveMemoryControls({
            flow: resolvedCurveFlow,
            baseCurve: sakuraCurve,
            length,
            straightness: morphologyProfile?.branchStraightness ?? 0.5,
            memoryGain: lerp(0.52, 1.08, branchChaos),
        });
        const curveIn = curveMemory.curveIn;
        const curveOut = curveMemory.curveOut;
        const resolvedSakuraCurve = curveMemory.curve;

        const node = createBranchNode({
            nodeRandom: localRandom,
            branchOrder: SAKURA_BRANCH_ORDER.TERMINAL_TWIG,
            length,
            width,
            curve: resolvedSakuraCurve,
            curveIn,
            curveOut,
            includeLenticels: false,
            nextRandomFn,
        });
        node.growthRole = 'twig';
        node.twigDepth = twigDepth;
        node.twigMaxDepth = twigMaxDepth;

        const shouldStop = twigDepth >= twigMaxDepth
            || currentDepth >= structuralMaxDepth
            || finiteTwigChildBudget <= 0;

        if (shouldStop) {
            addTerminalSet(node, localRandom, length, width);
            assertTwigPassResultContract(node);
            return node;
        }

        const twigBranchingProb = tierModels.twig.branching.branchingProb;
        const branchPlan = resolveTwigBranchCount({
            localRandom,
            twigDepth,
            twigBranchingProb,
            width,
            childBudget: finiteTwigChildBudget,
        });
        if (branchPlan.branchCount <= 0) {
            addTerminalSet(node, localRandom, length, width);
            assertTwigPassResultContract(node);
            return node;
        }
        const branchCount = branchPlan.branchCount;

        const branchConfigs = buildSakuraBranchConfigs({
            gene: twigTierGene,
            morphologyProfile,
            scaffoldStrength,
            nextRandom: nextRandomFn,
            localRandom,
            branchCount,
            progress,
            isTrunk: false,
            isTwig: true,
            isBranch: false,
            isSecondaryBranch: false,
            orderRunDepth,
            lastDir,
            scaffoldBand: false,
            noiseTwist,
            twigStartScale,
            branchWidthScale,
            trunkScaffoldSideSign: null,
            trunkBifurcationSpec: null,
        });

        const branchSegment = BranchGeometryModel.createCubicSegment({
            startX: currentX,
            startY: currentY,
            angle: parentAngle,
            length,
            curveIn,
            curveOut,
        });
        const baseFlowAdjustment = resolvedSakuraCurve * 0.02;
        let remainingChildBudget = finiteTwigChildBudget;
        let spawnedChildren = 0;
        const requiredChildren = branchPlan.minRequired;

        branchConfigs.forEach((branchConfig, configIndex) => {
            if (remainingChildBudget <= 0) {
                return;
            }

            const lengthMult = resolveDynamicLengthMult({
                branchConfig,
                localRandom,
                configIndex,
                gene: twigTierGene,
                progress,
            });
            const resolvedDecay = GrowthDecayPolicyModel.resolveSakuraDimensions({
                gene: twigTierGene,
                progress,
                isTrunk: false,
                isTwig: true,
                config: branchConfig,
                branchOrder: SAKURA_BRANCH_ORDER.TERMINAL_TWIG,
                length,
                width,
                lengthMult,
                trunkInternodeDecay,
                trunkWidthDecay,
                lengthRatioByTier,
                widthReductionByTier,
                morphologyProfile,
                twigLevel,
            });

            const nextTwigDepth = twigDepth + 1;
            if (nextTwigDepth > twigMaxDepth || currentDepth + 1 > structuralMaxDepth) {
                return;
            }
            const nextTwigLevel = branchConfig.isContinuation ? (twigLevel + 1) : 0;
            const nextTwigDepthNorm = clamp(
                (nextTwigDepth - 1) / Math.max(1, twigMaxDepth - 1),
                0,
                1,
            );

            const twigLenWarp = clamp(
                0.94
                + nextRandom(localRandom, `twig_config_${configIndex}_length_warp`) * 0.28
                + branchChaos * 0.05
                - nextTwigDepthNorm * 0.03,
                0.8,
                1.16,
            );
            const twigWidthWarp = clamp(
                0.78 + nextRandom(localRandom, `twig_config_${configIndex}_width_warp`) * 0.24,
                0.72,
                1,
            );
            const depthLengthDamping = lerp(0.99, 0.9, Math.pow(nextTwigDepthNorm, 1.05));
            const nextLength = resolvedDecay.nextLength * twigLenWarp * depthLengthDamping;
            const nextWidth = resolvedDecay.nextWidth * twigWidthWarp;

            const childAttachT = resolveChildAttachT({
                branchConfig,
                localRandom,
                configIndex,
                isTrunk: false,
                continuationDefault: 1,
            });
            const childAttach = BranchGeometryModel.pointAndAngleAt(branchSegment, childAttachT);

            let desiredRelativeOffset = branchConfig.angleOffset + (baseFlowAdjustment * 0.28);
            let continuationFlow = null;
            if (branchConfig.isContinuation) {
                const advancedFlow = advanceHarmonicCurveFlow(resolvedCurveFlow, { lastDir });
                const harmonicOffset = resolveHarmonicCurveOffset(advancedFlow);
                const targetOffset = lerp(desiredRelativeOffset, harmonicOffset, 0.92);
                const smoothedFlow = resolveSmoothedFlowOffset({
                    flow: advancedFlow,
                    targetOffset,
                });
                continuationFlow = smoothedFlow.flow;
                desiredRelativeOffset = smoothedFlow.offset;
            } else if (Math.abs(desiredRelativeOffset) < degToRad(2.2)) {
                desiredRelativeOffset += sampleCenteredNoise(
                    localRandom,
                    degToRad(3.5),
                    `twig_config_${configIndex}_bend_nudge`,
                );
            }
            if (!branchConfig.isContinuation && Math.abs(desiredRelativeOffset) < degToRad(1.2)) {
                desiredRelativeOffset = (Math.sign(branchConfig.dir || lastDir || 1) || 1) * degToRad(1.2);
            }

            const targetDir = Math.sign(Number(branchConfig.dir) || 0);
            const offsetDir = Math.sign(desiredRelativeOffset);
            const directionalMismatch = targetDir !== 0
                && offsetDir !== 0
                && targetDir !== offsetDir;
            if (
                !branchConfig.isContinuation
                && directionalMismatch
                && Math.abs(desiredRelativeOffset) > degToRad(18)
            ) {
                desiredRelativeOffset = lerp(
                    desiredRelativeOffset,
                    targetDir * Math.abs(desiredRelativeOffset),
                    0.58,
                );
            }

            const guardedAngle = SakuraAngleGuardModel.resolveGuardedChildAngle({
                attachAngle: childAttach.angle,
                desiredRelativeOffset,
                nextOrder: SAKURA_BRANCH_ORDER.TERMINAL_TWIG,
                isContinuationChild: branchConfig.isContinuation,
                nextTwigLevel,
                childDepth: nextTwigDepth,
                maxDepth: twigMaxDepth,
                nextWidth,
                isTrunkMainTransition: false,
                isSecondTrunkTransition: false,
                isTrunkParent: false,
                isTwigParent: true,
                parentDepth: twigDepth,
                verticalBias,
                trunkStyle,
                trunkTierAngleVar: tierModelByTier.twig.angleVarNorm,
                trunkTierBranchAngle: tierModelByTier.twig.angleBase,
                trunkBackboneLockStrength,
                maxRelativeBendDeg,
                learningProgress,
                priorStrength,
                twigUpwardBiasProb,
                twigDownwardRatio,
                branchChaos,
                branchAngleVar: tierModelByTier.twig.branchAngleVar,
                rng: localRandom,
                decisionPrefix: `twig_config_${configIndex}`,
            });

            const childNodeRandom = localRandom.fork({
                depth: currentDepth + 1,
                nodeRole: ShapePriorModel.resolveSakuraOrderName(SAKURA_BRANCH_ORDER.TERMINAL_TWIG),
                nodeSlot: configIndex,
                decisionType: branchConfig.isContinuation ? 'twig_main' : 'twig_side',
            });
            const nextOrderRunDepth = branchConfig.isContinuation ? (orderRunDepth + 1) : 0;
            const propagatedDir = Math.sign(guardedAngle.finalRelativeOffset)
                || branchConfig.dir
                || lastDir
                || 1;
            const childCurveFlow = branchConfig.isContinuation
                ? syncFlowToGuardedOffset({
                    flow: continuationFlow,
                    parentFlow: resolvedCurveFlow,
                    guardedOffset: guardedAngle.finalRelativeOffset,
                })
                : null;
            const remainingConfigCount = Math.max(1, branchConfigs.length - configIndex);
            const reserveForRequired = Math.max(0, requiredChildren - spawnedChildren - 1);
            const allocatableBudget = Math.max(1, remainingChildBudget - reserveForRequired);
            const subtreeBudget = Math.max(1, Math.floor(allocatableBudget / remainingConfigCount));

            node.branches.push({
                obj: generateTwigBranch({
                    currentDepth: currentDepth + 1,
                    currentX: childAttach.x,
                    currentY: childAttach.y,
                    length: nextLength,
                    width: nextWidth,
                    parentAngle: guardedAngle.finalChildAngle,
                    lastDir: propagatedDir,
                    orderRunDepth: nextOrderRunDepth,
                    twigLevel: nextTwigLevel,
                    nodeRandom: childNodeRandom,
                    twigDepth: nextTwigDepth,
                    curveFlow: childCurveFlow,
                    twigChildBudget: subtreeBudget - 1,
                }),
                angleOffset: guardedAngle.finalRelativeOffset,
                t: childAttachT,
            });
            remainingChildBudget = Math.max(0, remainingChildBudget - subtreeBudget);
            spawnedChildren += 1;
        });

        if (!node.branches.length) {
            addTerminalSet(node, localRandom, length, width);
        }
        node.terminals.push(
            ...TerminalGenerationPolicyModel.resolveSakuraFlowerSpurSet({
                rng: localRandom.fork({
                    depth: currentDepth,
                    nodeRole: 'flower_spur',
                    nodeSlot: Math.max(0, orderRunDepth),
                    decisionType: 'twig_spur',
                }),
                gene: twigTierGene,
                currentStage,
                length,
                width,
                flowerColors: config.flowerColors,
                attachBias: clamp((twigDepth - 1) / Math.max(1, twigMaxDepth - 1), 0, 1),
                sideBias: lastDir,
                spurDensity: node.branches.length ? 0.94 : 0.72,
                maxSpurCount: node.branches.length ? 2 : 3,
            }),
        );
        if (node.branches.length && twigNodeBloomChance > 0) {
            node.terminals.push(
                ...TerminalGenerationPolicyModel.resolveSakuraTwigNodeBloomSet({
                    rng: localRandom,
                    gene: twigTierGene,
                    currentStage,
                    length,
                    flowerColors: config.flowerColors,
                    leafColors: config.leafColors,
                }),
            );
        }

        assertTwigPassResultContract(node);
        return node;
    };

    return generateTwigBranch;
};
