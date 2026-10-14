import { ShapePriorModel, SAKURA_BRANCH_ORDER } from '../bonsai/generation/shapePriorModel';
import { GrowthDecayPolicyModel } from '../bonsai/generation/growthDecayPolicyModel';
import { BranchGeometryModel } from '../bonsai/geometry/branchGeometryModel';
import {
    clamp,
    lerp,
    degToRad,
} from './sakuraMath';
import {
    buildSakuraBranchConfigs,
} from './sakuraBranchDynamics';
import {
    stepScaffoldTurnRateFlow,
    resolveScaffoldCurveFromTurnRate,
    resolveScaffoldCurvatureMemory,
} from './sakuraScaffoldTurnRateModel';
import {
    resolveScaffoldBackboneTargetAngle,
    resolveScaffoldBendingSignal,
    resolveScaffoldProfileDepthScale,
} from './sakuraScaffoldShapeModel';
import {
    normalizeAngle,
    shortestAngleDelta,
} from './sakuraAngleUtils';
import { createBranchNode } from './sakuraBranchNodeFactory';
import {
    resolveTierContext,
    resolveDynamicLengthMult,
} from './sakuraBranchHeuristics';
import {
    assertScaffoldPassCollectionsContract,
    assertScaffoldPassResultContract,
} from './sakuraPassContracts';

export const createScaffoldBranchEmitter = (input = {}) => {
    const {
        context = {},
        tiers = {},
        limits = {},
        decay = {},
        runtime = {},
        random = {},
        hooks = {},
        createScaffoldLocalTurnFlow,
    } = input;
    const {
        morphologyProfile,
        scaffoldStrength,
    } = context;
    const {
        tierStrategies,
        scaffoldTierGene,
    } = tiers;
    const {
        trunkSegmentLimit,
        scaffoldMaxDepth,
        twigMaxDepth,
        structuralMaxDepth,
    } = limits;
    const {
        trunkInternodeDecay,
        trunkWidthDecay,
        lengthRatioByTier,
        widthReductionByTier,
    } = decay;
    const {
        scaffoldShapeMode,
    } = runtime;
    const {
        nextRandomFn,
        createFallbackRandom,
    } = random;
    const {
        onScaffoldNode = null,
    } = hooks;

    const scaffoldContinuationLengthScale = 0.82;
    const scaffoldContinuationLengthDecay = clamp(
        (
            (Number(lengthRatioByTier?.branchMain?.min) || 0.74)
            + (Number(lengthRatioByTier?.branchMain?.max) || 0.74)
        ) * 0.5,
        0.34,
        0.995,
    );
    const scaffoldContinuationWidthDecay = clamp(
        Number(widthReductionByTier?.branchMain ?? scaffoldTierGene?.scaffoldTierWidthDecay ?? 0.8),
        0.45,
        0.995,
    );

    const generateScaffoldBranch = (state = {}, collections) => {
        assertScaffoldPassCollectionsContract(collections);
        const {
            currentDepth,
            currentX,
            currentY,
            length,
            width,
            parentAngle,
            branchOrder = SAKURA_BRANCH_ORDER.PRIMARY_BRANCH,
            scaffoldDepth = 1,
            scaffoldDepthLimit = scaffoldMaxDepth,
            orderRunDepth = 0,
            lastDir = 1,
            nodeRandom = null,
            scaffoldBackbonePlan = null,
            scaffoldRootId = null,
            apicalTipForceBloom = false,
            apicalTipPosition = null,
            scaffoldTurnFlow = null,
        } = state;

        const localRandom = nodeRandom || createFallbackRandom({
            depth: currentDepth,
            order: branchOrder,
            nodeSlot: orderRunDepth,
            decisionType: 'scaffold_fallback',
        });
        const isSecondaryBranch = branchOrder === SAKURA_BRANCH_ORDER.SECONDARY_BRANCH;
        const branchState = {
            trunkMainDepth: 1,
            scaffoldDepth,
            twigDepth: 1,
            trunkSegmentLimit,
            scaffoldMaxDepth: scaffoldDepthLimit,
            twigMaxDepth,
        };
        const {
            progress,
            branchWidthScale,
            twigStartScale,
        } = resolveTierContext({
            tierStrategies,
            isTrunk: false,
            isTwig: false,
            branchState,
        });
        const scaffoldDepthNorm = clamp(
            (scaffoldDepth - 1) / Math.max(1, scaffoldDepthLimit - 1),
            0,
            1,
        );
        const remainingDepth = Math.max(1, scaffoldDepthLimit - scaffoldDepth + 1);
        const nodeBendingSignal = resolveScaffoldBendingSignal({
            depthNorm: scaffoldDepthNorm,
            segmentLength: length,
            segmentWidth: width,
            remainingDepth,
            widthDecay: scaffoldContinuationWidthDecay,
            lengthDecay: scaffoldContinuationLengthDecay,
        });
        const baseTurnFlow = scaffoldTurnFlow || createScaffoldLocalTurnFlow({
            rng: localRandom,
            sideSign: Math.sign(lastDir || 1) || 1,
        });
        const previousTurnRate = Number(baseTurnFlow?.prevTurnRate) || 0;
        const turnEntryStep = stepScaffoldTurnRateFlow({
            flow: baseTurnFlow,
            rng: localRandom,
            depthNorm: scaffoldDepthNorm,
            sideSign: Math.sign(lastDir || 1) || 1,
        });
        const turnExitStep = stepScaffoldTurnRateFlow({
            flow: turnEntryStep.flow,
            rng: localRandom,
            depthNorm: scaffoldDepthNorm,
            sideSign: Math.sign(lastDir || 1) || 1,
        });

        const turnRateIn = Number(turnEntryStep.turnRate) || 0;
        const rawTurnRateOut = Number(turnExitStep.turnRate);
        const turnRateOut = Number.isFinite(rawTurnRateOut) ? rawTurnRateOut : turnRateIn;
        const turnRateMid = lerp(turnRateIn, turnRateOut, 0.5);
        const turnRateDelta = turnRateOut - turnRateIn;
        const turnDeltaNorm = clamp(Math.abs(turnRateDelta) / degToRad(7.5), 0, 1);
        const curveRatio = lerp(0.28, 0.38, turnDeltaNorm);

        let curveIn = resolveScaffoldCurveFromTurnRate({
            turnRate: turnRateIn,
            length,
            maxCurveRatio: curveRatio,
        });
        let curveOut = resolveScaffoldCurveFromTurnRate({
            turnRate: turnRateOut,
            length,
            maxCurveRatio: curveRatio,
        });
        if (Math.sign(curveIn) === Math.sign(curveOut) && Math.abs(turnRateDelta) > degToRad(2.8)) {
            const bridgeCurve = resolveScaffoldCurveFromTurnRate({
                turnRate: turnRateDelta,
                length,
                maxCurveRatio: 0.16,
            });
            curveIn -= bridgeCurve * 0.32;
            curveOut += bridgeCurve * 0.32;
        }
        if (turnDeltaNorm > 0.42) {
            const emphasis = clamp((turnDeltaNorm - 0.42) / 0.58, 0, 1);
            const minCurveMag = length * lerp(0.012, 0.038, emphasis);
            const inSign = Math.sign(curveIn) || Math.sign(turnRateIn) || Math.sign(lastDir || 1) || 1;
            const outSign = Math.sign(curveOut) || Math.sign(turnRateOut) || Math.sign(lastDir || 1) || 1;
            curveIn = inSign * Math.max(Math.abs(curveIn), minCurveMag * 0.62);
            curveOut = outSign * Math.max(Math.abs(curveOut), minCurveMag);
        }
        const rememberedCurve = resolveScaffoldCurvatureMemory({
            previousTurnRate,
            turnRateIn,
            turnRateOut,
            curveIn,
            curveOut,
            length,
            maxCurveRatio: curveRatio,
        });
        curveIn = rememberedCurve.curveIn;
        curveOut = rememberedCurve.curveOut;
        const sakuraCurve = rememberedCurve.curve;

        const node = createBranchNode({
            nodeRandom: localRandom,
            branchOrder,
            length,
            width,
            curve: sakuraCurve,
            curveIn,
            curveOut,
            includeLenticels: false,
            nextRandomFn,
        });
        node.growthRole = 'scaffold';
        node.scaffoldDepth = scaffoldDepth;
        node.scaffoldDepthLimit = scaffoldDepthLimit;
        node.scaffoldRootId = scaffoldRootId;
        node.scaffoldTurnState = turnExitStep.state;
        node.scaffoldTurnRate = turnRateMid;
        node.scaffoldTurnRateIn = turnRateIn;
        node.scaffoldTurnRateOut = turnRateOut;
        node.scaffoldTurnDwell = turnExitStep.dwellRemaining;
        node.scaffoldBendPressure = nodeBendingSignal.bendPressure;
        node.scaffoldProjectedLoad = nodeBendingSignal.projectedSelfLoad;
        node.scaffoldDepthGravityGain = nodeBendingSignal.depthGravityGain;
        node.apicalTipForceBloom = Boolean(apicalTipForceBloom);
        node.apicalTipPosition = apicalTipPosition;
        onScaffoldNode?.({
            depth: scaffoldDepth,
            turnState: turnExitStep.state,
            turnRate: turnRateMid,
            width,
            length,
            bendPressure: nodeBendingSignal.bendPressure,
            projectedLoad: nodeBendingSignal.projectedSelfLoad,
            depthGravityGain: nodeBendingSignal.depthGravityGain,
        });

        const branchSegment = BranchGeometryModel.createCubicSegment({
            startX: currentX,
            startY: currentY,
            angle: parentAngle,
            length,
            curveIn,
            curveOut,
        });

        collections.scaffoldRecords.push({
            node,
            nodeRandom: localRandom,
            branchSegment,
            currentDepth,
            scaffoldDepth,
            scaffoldDepthLimit,
            lastDir,
            branchOrder,
            scaffoldRootId,
            apicalTipForceBloom: Boolean(apicalTipForceBloom),
            apicalTipPosition,
        });

        const shouldStop = scaffoldDepth >= scaffoldDepthLimit
            || currentDepth >= structuralMaxDepth;

        if (shouldStop) {
            assertScaffoldPassResultContract(node);
            return node;
        }

        const branchConfigs = buildSakuraBranchConfigs({
            gene: scaffoldTierGene,
            morphologyProfile,
            scaffoldStrength,
            nextRandom: nextRandomFn,
            localRandom,
            branchCount: 1,
            progress,
            isTrunk: false,
            isTwig: false,
            isBranch: true,
            isSecondaryBranch,
            orderRunDepth,
            lastDir,
            scaffoldBand: false,
            noiseTwist: 0,
            twigStartScale,
            branchWidthScale,
            trunkScaffoldSideSign: null,
            trunkBifurcationSpec: null,
        });

        branchConfigs.forEach((branchConfig, configIndex) => {
            if (!branchConfig.isContinuation) {
                return;
            }
            const childOrder = branchOrder;
            const childScaffoldDepth = scaffoldDepth + 1;
            if (childScaffoldDepth > scaffoldDepthLimit || currentDepth + 1 > structuralMaxDepth) {
                return;
            }

            const lengthMult = resolveDynamicLengthMult({
                branchConfig,
                localRandom,
                configIndex,
                gene: scaffoldTierGene,
                progress,
            }) * scaffoldContinuationLengthScale;
            const resolvedDecay = GrowthDecayPolicyModel.resolveSakuraDimensions({
                gene: scaffoldTierGene,
                progress,
                isTrunk: false,
                isTwig: false,
                config: branchConfig,
                branchOrder,
                length,
                width,
                lengthMult,
                trunkInternodeDecay,
                trunkWidthDecay,
                lengthRatioByTier,
                widthReductionByTier,
                morphologyProfile,
                twigLevel: 0,
            });

            const childAttachResolvedT = 1;
            const childAttach = BranchGeometryModel.pointAndAngleAt(branchSegment, childAttachResolvedT);
            const childDepthNorm = clamp(
                (childScaffoldDepth - 1) / Math.max(1, scaffoldDepthLimit - 1),
                0,
                1,
            );
            const profileScale = resolveScaffoldProfileDepthScale({
                modeNorm: scaffoldShapeMode,
                depthNorm: childDepthNorm,
            });
            const depthTipTaper = lerp(1, 0.74, Math.pow(childDepthNorm, 1.2));
            const profileLength = resolvedDecay.nextLength
                * profileScale.lengthScale
                * lerp(1.02, 0.92, Math.pow(childDepthNorm, 0.9));
            let profileWidth = Math.min(
                width * 0.996,
                resolvedDecay.nextWidth * profileScale.widthScale * depthTipTaper,
            );

            // Add a more aggressive taper specifically as we approach the scaffold depth limit.
            if (childDepthNorm > 0.82) {
                const endProgress = (childDepthNorm - 0.82) / 0.18;
                profileWidth *= (1 - (endProgress * 0.75));
            }

            const childRemainingDepth = Math.max(1, scaffoldDepthLimit - childScaffoldDepth + 1);
            const childPhysicsSignal = resolveScaffoldBendingSignal({
                depthNorm: childDepthNorm,
                segmentLength: profileLength,
                segmentWidth: Math.max(0.08, profileWidth),
                remainingDepth: childRemainingDepth,
                widthDecay: scaffoldContinuationWidthDecay,
                lengthDecay: scaffoldContinuationLengthDecay,
            });
            const targetBackboneAngle = resolveScaffoldBackboneTargetAngle(
                scaffoldBackbonePlan,
                childDepthNorm,
                {
                    segmentLength: profileLength,
                    segmentWidth: Math.max(0.08, profileWidth),
                    remainingDepth: childRemainingDepth,
                    widthDecay: scaffoldContinuationWidthDecay,
                    lengthDecay: scaffoldContinuationLengthDecay,
                },
            );
            const tipTightening = Math.pow(childDepthNorm, 1.16);
            const turnBlendGain = lerp(1, 0.38, tipTightening);
            const localContinuationOffset = clamp(
                turnRateMid * turnBlendGain,
                -degToRad(24),
                degToRad(24),
            );
            const rawDesiredAbsoluteAngle = normalizeAngle(targetBackboneAngle + localContinuationOffset);
            const maxStepFromParent = lerp(
                degToRad(34),
                degToRad(11.5),
                Math.pow(childDepthNorm, 1.08),
            ) * clamp(1 - (childPhysicsSignal.bendPressure * 0.22), 0.58, 1);
            let parentAlignedDelta = shortestAngleDelta(rawDesiredAbsoluteAngle, parentAngle);
            const preferredTurnSign = Math.sign(lastDir || 1) || 1;
            if (
                childDepthNorm > 0.72
                && Math.sign(parentAlignedDelta) !== preferredTurnSign
                && Math.abs(parentAlignedDelta) > degToRad(6.5)
            ) {
                parentAlignedDelta = preferredTurnSign * Math.min(
                    Math.abs(parentAlignedDelta) * 0.42,
                    maxStepFromParent * 0.6,
                );
            }
            const guardedDesiredAbsoluteAngle = normalizeAngle(
                parentAngle + clamp(parentAlignedDelta, -maxStepFromParent, maxStepFromParent),
            );
            const desiredRelativeOffset = shortestAngleDelta(guardedDesiredAbsoluteAngle, childAttach.angle);

            const guardedAngle = {
                finalRelativeOffset: desiredRelativeOffset,
                finalChildAngle: normalizeAngle(childAttach.angle + desiredRelativeOffset),
            };

            const childNodeRandom = localRandom.fork({
                depth: currentDepth + 1,
                nodeRole: ShapePriorModel.resolveSakuraOrderName(childOrder),
                nodeSlot: configIndex,
                decisionType: 'scaffold_main',
            });
            const propagatedDir = Math.sign(guardedAngle.finalRelativeOffset)
                || branchConfig.dir
                || lastDir
                || 1;
            const childOrderRunDepth = orderRunDepth + 1;

            node.branches.push({
                obj: generateScaffoldBranch({
                    currentDepth: currentDepth + 1,
                    currentX: childAttach.x,
                    currentY: childAttach.y,
                    length: profileLength,
                    width: Math.max(0.08, profileWidth),
                    parentAngle: guardedAngle.finalChildAngle,
                    branchOrder: childOrder,
                    scaffoldDepth: childScaffoldDepth,
                    scaffoldDepthLimit,
                    orderRunDepth: childOrderRunDepth,
                    lastDir: propagatedDir,
                    nodeRandom: childNodeRandom,
                    scaffoldBackbonePlan,
                    scaffoldRootId,
                    apicalTipForceBloom,
                    apicalTipPosition,
                    scaffoldTurnFlow: turnExitStep.flow,
                }, collections),
                angleOffset: guardedAngle.finalRelativeOffset,
                t: childAttachResolvedT,
            });
        });

        assertScaffoldPassResultContract(node);
        return node;
    };

    return generateScaffoldBranch;
};
