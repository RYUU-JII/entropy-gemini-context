import { ShapePriorModel, SAKURA_BRANCH_ORDER } from '../bonsai/generation/shapePriorModel';
import { GrowthDecayPolicyModel } from '../bonsai/generation/growthDecayPolicyModel';
import {
    clamp,
} from './sakuraMath';
import {
    buildSakuraBranchConfigs,
} from './sakuraBranchDynamics';
import {
    createScaffoldTurnRateFlow,
    resolveScaffoldArchetype,
} from './sakuraScaffoldTurnRateModel';
import {
    createScaffoldBackbonePlan,
    resolveScaffoldRootBaseLength,
    resolveScaffoldRootAngle,
} from './sakuraScaffoldShapeModel';
import {
    resolveDynamicLengthMult,
} from './sakuraBranchHeuristics';
import {
    assertScaffoldPassFactoryContract,
    assertScaffoldPassCollectionsContract,
    assertScaffoldPassApiContract,
} from './sakuraPassContracts';
import { createScaffoldBranchEmitter } from './sakuraScaffoldBranchEmitter';
import {
    createSakuraScaffoldRootArcAttachment,
    createSakuraScaffoldStationRandom,
    requireSakuraScaffoldArcStationPlan,
} from './sakuraScaffoldArcStationPlan';
import { SAKURA_TRUNK_ADAPTIVE_SUBDIVISION_POLICY } from './sakuraMacroSpineGuide';
import { resolveSakuraTrunkMacroStationGeometryV1 } from './sakuraTrunkPathPlan';

export const createSakuraScaffoldPass = (input = {}) => {
    assertScaffoldPassFactoryContract(input);
    const {
        context = {},
        tiers = {},
        limits = {},
        decay = {},
        schedule = {},
        runtime = {},
        random = {},
        hooks = {},
    } = input;
    const {
        morphologyProfile,
        scaffoldStrength,
    } = context;
    const {
        tierStrategies,
        tierModels: _tierModels,
        scaffoldTierGene,
        scaffoldRootGene,
        scaffoldArcModel,
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
        trunkPathPlan,
        scaffoldStationPlan,
        trunkTargetHeight,
    } = schedule;
    const resolvedStationPlan = requireSakuraScaffoldArcStationPlan(scaffoldStationPlan);
    if (resolvedStationPlan.guideShapeId !== trunkPathPlan?.guideShapeId) {
        throw new Error('ZEN_SAKURA_SCAFFOLD_STATION_GUIDE_SHAPE_MISMATCH');
    }
    const {
        scaffoldRuntime,
        scaffoldRootLengthBase,
        scaffoldRootWidthBase,
        formScaffoldComposition,
    } = runtime;
    const {
        nextRandomFn,
        createFallbackRandom,
    } = random;
    const {
        onScaffoldNode = null,
        onScaffoldRoot = null,
    } = hooks;
    const {
        topologyRandom = null,
    } = random;

    const scaffoldRootGlobalPitch = scaffoldRuntime.root.globalPitch;
    const scaffoldRootLocalWeight = scaffoldRuntime.root.localWeight;
    const scaffoldBackboneGravity = scaffoldRuntime.backbone.gravity;
    const scaffoldBackboneWindStrength = scaffoldRuntime.backbone.windStrength;
    const scaffoldBackboneWindBias = scaffoldRuntime.backbone.windBias;
    const formScaffoldDownwardRatio = formScaffoldComposition === null
        ? 0
        : clamp(Number(formScaffoldComposition.downwardRatio), 0, 1);
    const usesWeepingFlow = formScaffoldComposition?.stationPattern === 'radial_drooping';
    const scaffoldShapeMode = scaffoldRuntime.distribution.shapeMode;
    const scaffoldTurnStraightBias = scaffoldRuntime.turn.straightBias;
    const scaffoldTurnSweepProb = scaffoldRuntime.turn.sweepProb;
    const scaffoldTurnKinkProb = scaffoldRuntime.turn.kinkProb;
    const scaffoldTurnSweepAmpDeg = scaffoldRuntime.turn.sweepAmpDeg;
    const scaffoldTurnSweepFreq = scaffoldRuntime.turn.sweepFreq;
    const scaffoldTurnKinkAngleDeg = scaffoldRuntime.turn.kinkAngleDeg;
    const scaffoldTurnRecovery = scaffoldRuntime.turn.recovery;
    const scaffoldTurnPersistence = scaffoldRuntime.turn.persistence;
    const scaffoldTurnNoise = scaffoldRuntime.turn.noise;
    const scaffoldTurnDepthDamping = scaffoldRuntime.turn.depthDamping;

    const createScaffoldLocalTurnFlow = ({
        rng = null,
        sideSign = 1,
        archetype = null,
    } = {}) => createScaffoldTurnRateFlow({
        rng,
        sideSign,
        depthLimit: scaffoldMaxDepth,
        straightBias: usesWeepingFlow
            ? Math.min(scaffoldTurnStraightBias, 0.32)
            : scaffoldTurnStraightBias,
        sweepProb: usesWeepingFlow
            ? Math.max(scaffoldTurnSweepProb, 0.55)
            : scaffoldTurnSweepProb,
        kinkProb: usesWeepingFlow
            ? Math.min(scaffoldTurnKinkProb, 0.02)
            : scaffoldTurnKinkProb,
        sweepAmpDeg: usesWeepingFlow
            ? clamp(scaffoldTurnSweepAmpDeg, 12, 16)
            : scaffoldTurnSweepAmpDeg,
        sweepFreq: usesWeepingFlow
            ? clamp(scaffoldTurnSweepFreq, 0.28, 0.38)
            : scaffoldTurnSweepFreq,
        kinkAngleDeg: scaffoldTurnKinkAngleDeg,
        recovery: usesWeepingFlow
            ? Math.max(scaffoldTurnRecovery, 0.64)
            : scaffoldTurnRecovery,
        persistence: usesWeepingFlow
            ? Math.max(scaffoldTurnPersistence, 0.7)
            : scaffoldTurnPersistence,
        noise: usesWeepingFlow
            ? Math.min(scaffoldTurnNoise, 0.08)
            : scaffoldTurnNoise,
        depthDamping: usesWeepingFlow
            ? Math.max(scaffoldTurnDepthDamping, 0.58)
            : scaffoldTurnDepthDamping,
        archetype: usesWeepingFlow
            ? {
                straightness: 0.22,
                sweepiness: 0.72,
                gnarliness: 0.06,
                coreName: 'weeping_flow',
            }
            : archetype,
        initialState: usesWeepingFlow ? 'sweep' : 'straight',
    });

    const generateScaffoldBranch = createScaffoldBranchEmitter({
        context: {
            morphologyProfile,
            scaffoldStrength,
        },
        tiers: {
            tierStrategies,
            scaffoldTierGene,
        },
        limits: {
            trunkSegmentLimit,
            scaffoldMaxDepth,
            twigMaxDepth,
            structuralMaxDepth,
        },
        decay: {
            trunkInternodeDecay,
            trunkWidthDecay,
            lengthRatioByTier,
            widthReductionByTier,
        },
        runtime: {
            scaffoldShapeMode,
        },
        random: {
            nextRandomFn,
            createFallbackRandom,
        },
        hooks: {
            onScaffoldNode,
        },
        createScaffoldLocalTurnFlow,
    });

    const emitScaffoldPass = (collections) => {
        assertScaffoldPassCollectionsContract(collections);
        const trunkSpans = collections.trunkSpanRegistry
            .slice()
            .sort((left, right) => left.arcStartNorm - right.arcStartNorm);
        if (!trunkSpans.length) {
            throw new Error('ZEN_SAKURA_SCAFFOLD_TRUNK_SPAN_REGISTRY_REQUIRED');
        }
        if (
            Math.abs(trunkSpans[0].arcStartNorm) > 1e-8
            || Math.abs(trunkSpans.at(-1).arcEndNorm - 1) > 1e-8
        ) {
            throw new Error('ZEN_SAKURA_SCAFFOLD_TRUNK_SPAN_ARC_INCOMPLETE');
        }
        trunkSpans.forEach((span, index) => {
            if (
                !Number.isFinite(span.arcStartNorm)
                || !Number.isFinite(span.arcEndNorm)
                || span.arcEndNorm <= span.arcStartNorm
            ) {
                throw new Error(`ZEN_SAKURA_SCAFFOLD_TRUNK_SPAN_ARC_INVALID:${index}`);
            }
            if (index > 0 && Math.abs(span.arcStartNorm - trunkSpans[index - 1].arcEndNorm) > 1e-6) {
                throw new Error(`ZEN_SAKURA_SCAFFOLD_TRUNK_SPAN_ARC_DISCONNECTED:${index}`);
            }
        });
        const allPlacements = resolvedStationPlan.stations.map((station) => {
            const anchorSpan = trunkSpans.find((span, index) => (
                station.arcNorm >= span.arcStartNorm - 1e-8
                && (
                    station.arcNorm < span.arcEndNorm - 1e-8
                    || index === trunkSpans.length - 1
                )
            ));
            if (!anchorSpan) {
                throw new Error(`ZEN_SAKURA_SCAFFOLD_STATION_SPAN_MISSING:${station.stationId}`);
            }
            const attachT = clamp(
                (station.arcNorm - anchorSpan.arcStartNorm)
                    / Math.max(1e-8, anchorSpan.arcEndNorm - anchorSpan.arcStartNorm),
                0,
                1,
            );
            const macroStationGeometry = resolveSakuraTrunkMacroStationGeometryV1({
                trunkPathPlan,
                trunkTargetHeight,
                arcNorm: station.arcNorm,
            });
            return {
                placement: station,
                planIndex: station.selectionKey,
                anchor: {
                    ...anchorSpan,
                    nodeRandom: createSakuraScaffoldStationRandom(topologyRandom, station),
                    currentDepth: 1,
                    attachT,
                    stationWidth: macroStationGeometry.width,
                    lastDir: macroStationGeometry.turnSign,
                    macroStationGeometry,
                    isApicalFork: station.role !== 'normal',
                    apicalPosition: station.role === 'apical_ultimate'
                        ? 'ultimate'
                        : (station.role === 'apical_penultimate' ? 'penultimate' : null),
                    station,
                },
            };
        });

        allPlacements.forEach(({ placement, planIndex, anchor }) => {
            const isApical = !!anchor.isApicalFork;
            const isPenultimate = isApical && anchor.apicalPosition === 'penultimate';
            const isUltimate = isApical && anchor.apicalPosition === 'ultimate';

            const trunkDepthNorm = placement.arcNorm;
            const trunkProgress = trunkDepthNorm;
            const attachT = anchor.attachT;

            const scaffoldSideSign = placement.side;
            const scaffoldRootConfigs = buildSakuraBranchConfigs({
                gene: scaffoldRootGene,
                morphologyProfile,
                scaffoldStrength,
                nextRandom: nextRandomFn,
                localRandom: anchor.nodeRandom,
                branchCount: 2,
                progress: trunkProgress,
                isTrunk: true,
                isTwig: false,
                isBranch: false,
                isSecondaryBranch: false,
                orderRunDepth: 0,
                lastDir: anchor.lastDir,
                scaffoldBand: true,
                noiseTwist: 0,
                twigStartScale: 1,
                branchWidthScale: 1,
                trunkScaffoldSideSign: scaffoldSideSign,
                trunkBifurcationSpec: null,
            });
            const defaultAngleOffset = scaffoldSideSign * clamp(scaffoldArcModel.angleBase, 0.18, 1);

            let apicalAngleOffset = defaultAngleOffset;
            let apicalLenMult = scaffoldRootLengthBase * 0.74;
            let apicalWidthMult = scaffoldRootWidthBase * 0.64;

            if (isUltimate) {
                const angleJitter = (
                    nextRandomFn(anchor.nodeRandom, `apical_ultimate_angle_jitter_${planIndex}`)
                    - 0.5
                ) * 0.14;
                apicalAngleOffset = scaffoldSideSign * clamp(
                    (scaffoldArcModel.angleBase * 0.22) + angleJitter,
                    0.08,
                    0.34,
                );
                apicalLenMult = scaffoldRootLengthBase * 0.74;
                apicalWidthMult = scaffoldRootWidthBase * 0.52;
            } else if (isPenultimate) {
                const angleJitter = (
                    nextRandomFn(anchor.nodeRandom, `apical_penultimate_angle_jitter_${planIndex}`)
                    - 0.5
                ) * 0.18;
                apicalAngleOffset = scaffoldSideSign * clamp(
                    (scaffoldArcModel.angleBase * 0.46) + angleJitter,
                    0.14,
                    0.52,
                );
                apicalLenMult = scaffoldRootLengthBase * 0.9;
                apicalWidthMult = scaffoldRootWidthBase * 0.68;
            }

            const scaffoldConfig = scaffoldRootConfigs.find((cfg) => !cfg.isContinuation) || {
                angleOffset: isApical ? apicalAngleOffset : defaultAngleOffset,
                lenMult: isApical ? apicalLenMult : (scaffoldRootLengthBase * 0.74),
                widthMult: isApical ? apicalWidthMult : (scaffoldRootWidthBase * 0.64),
                dir: scaffoldSideSign,
                isContinuation: false,
            };

            if (isApical && scaffoldRootConfigs.length) {
                scaffoldConfig.angleOffset = apicalAngleOffset;
                scaffoldConfig.lenMult *= isUltimate ? 0.92 : 1.05;
            }

            let lengthMult = resolveDynamicLengthMult({
                branchConfig: scaffoldConfig,
                localRandom: anchor.nodeRandom,
                configIndex: planIndex,
                gene: scaffoldRootGene,
                progress: trunkProgress,
            });
            if (isApical) {
                const apicalDepthDamping = isUltimate ? 0.76 : 0.86;
                const apicalTaper = 1 - (Math.pow(trunkDepthNorm, 1.45) * (isUltimate ? 0.24 : 0.16));
                lengthMult *= clamp(apicalDepthDamping * apicalTaper, 0.42, 1);
            }
            const baseNodeWidth = isUltimate
                ? anchor.stationWidth * 0.55
                : (isPenultimate ? anchor.stationWidth * 0.75 : anchor.stationWidth);

            const resolvedDecay = GrowthDecayPolicyModel.resolveSakuraDimensions({
                gene: scaffoldRootGene,
                progress: trunkProgress,
                isTrunk: true,
                isTwig: false,
                config: scaffoldConfig,
                branchOrder: SAKURA_BRANCH_ORDER.TRUNK,
                length: resolveScaffoldRootBaseLength({
                    anchorDepthNorm: trunkDepthNorm,
                    anchorRandom: anchor.nodeRandom,
                    planIndex,
                    trunkTargetHeight,
                    scaffoldStrength,
                    scaffoldShapeMode, // Pass the shape mode down
                }),
                width: baseNodeWidth,
                lengthMult,
                trunkInternodeDecay,
                trunkWidthDecay,
                lengthRatioByTier,
                widthReductionByTier,
                morphologyProfile,
                twigLevel: 0,
            });
            let resolvedRootLength = resolvedDecay.nextLength;
            let resolvedRootWidth = resolvedDecay.nextWidth;
            if (isApical) {
                const referenceSpanLength = trunkTargetHeight
                    / SAKURA_TRUNK_ADAPTIVE_SUBDIVISION_POLICY.base;
                const capFromReferenceSpan = referenceSpanLength * (isUltimate ? 0.94 : 1.16);
                const capFromHeight = trunkTargetHeight * (isUltimate ? 0.045 : 0.062);
                const apicalLengthCap = Math.max(
                    2.1,
                    Math.min(capFromReferenceSpan, capFromHeight),
                );
                resolvedRootLength = Math.min(resolvedRootLength, apicalLengthCap);
                resolvedRootLength = Math.max(1.8, resolvedRootLength);
                resolvedRootWidth *= isUltimate ? 0.92 : 0.96;
            }

            const childAttachT = attachT;
            const childAttach = anchor.macroStationGeometry;
            const apicalRootLocalWeight = isApical
                ? clamp(scaffoldRootLocalWeight + (isUltimate ? 0.42 : 0.34), 0, 1)
                : scaffoldRootLocalWeight;
            const guardedAngle = resolveScaffoldRootAngle({
                childAttach,
                scaffoldSideSign,
                scaffoldRootGlobalPitch,
                scaffoldRootLocalWeight: apicalRootLocalWeight,
                worldDownwardRatio: formScaffoldDownwardRatio,
                localScaffoldOffset: scaffoldConfig.angleOffset,
                rng: anchor.nodeRandom,
                planIndex,
            });
            const scaffoldBackbonePlan = createScaffoldBackbonePlan({
                rng: anchor.nodeRandom,
                rootAngle: guardedAngle.finalChildAngle,
                sideSign: scaffoldSideSign,
                depthLimit: scaffoldMaxDepth,
                gravityStrength: scaffoldBackboneGravity,
                windStrength: scaffoldBackboneWindStrength,
                windBias: scaffoldBackboneWindBias,
            });

            const childNodeRandom = anchor.nodeRandom.fork({
                depth: anchor.currentDepth + 1,
                nodeRole: ShapePriorModel.resolveSakuraOrderName(SAKURA_BRANCH_ORDER.PRIMARY_BRANCH),
                nodeSlot: 0,
                decisionType: 'scaffold_root',
            });
            // Resolve per-branch archetype: tree-level core + small per-branch variance
            const branchArchetype = resolveScaffoldArchetype({
                treeRng: topologyRandom,
                branchRng: childNodeRandom,
                variance: 0.1,
            });
            const scaffoldTurnFlow = createScaffoldLocalTurnFlow({
                rng: childNodeRandom,
                sideSign: scaffoldSideSign,
                archetype: branchArchetype,
            });
            const scaffoldRoot = generateScaffoldBranch({
                currentDepth: anchor.currentDepth + 1,
                currentX: childAttach.x,
                currentY: childAttach.y,
                length: resolvedRootLength,
                width: resolvedRootWidth,
                parentAngle: guardedAngle.finalChildAngle,
                branchOrder: SAKURA_BRANCH_ORDER.PRIMARY_BRANCH,
                scaffoldDepth: 1,
                orderRunDepth: 0,
                lastDir: Math.sign(guardedAngle.finalRelativeOffset) || scaffoldConfig.dir || 1,
                nodeRandom: childNodeRandom,
                scaffoldBackbonePlan,
                scaffoldRootId: anchor.station.stationId,
                apicalTipForceBloom: isApical,
                apicalTipPosition: isApical ? anchor.apicalPosition : null,
                scaffoldTurnFlow,
            }, collections);

            // Biological attachment identity lives in guide arc space. The
            // physical parent span and its local `t` are render tessellation
            // details and may change when the same guide is subdivided again.
            scaffoldRoot.scaffoldArcAttachment = createSakuraScaffoldRootArcAttachment(
                anchor.station,
            );

            anchor.node.branches.push({
                obj: scaffoldRoot,
                angleOffset: guardedAngle.finalRelativeOffset,
                t: childAttachT,
            });
            onScaffoldRoot?.({
                trunkDepth: trunkProgress,
                sideSign: scaffoldSideSign,
                length: resolvedRootLength,
                width: resolvedRootWidth,
            });
        });
    };

    const api = {
        emitScaffoldPass,
    };
    assertScaffoldPassApiContract(api);
    return api;
};
