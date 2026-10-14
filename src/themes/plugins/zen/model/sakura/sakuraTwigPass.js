import { ShapePriorModel, SAKURA_BRANCH_ORDER } from '../bonsai/generation/shapePriorModel';
import { GrowthDecayPolicyModel } from '../bonsai/generation/growthDecayPolicyModel';
import { BranchGeometryModel } from '../bonsai/geometry/branchGeometryModel';
import { SakuraAngleGuardModel } from '../bonsai/generation/SakuraAngleGuardModel';
import {
    clamp,
    lerp,
    degToRad,
} from './sakuraMath';
import { sampleCenteredNoise } from './sakuraBranchDynamics';
import {
    createTwigAttachSiteRegistry,
    resolveScaffoldTwigSpawnContext,
    resolveTwigChildBudgetCap,
} from './sakuraTwigSpawnModel';
import {
    normalizeAngle,
    shortestAngleDelta,
    blendAngles,
} from './sakuraAngleUtils';
import { nextRandom } from './sakuraRandomUtils';
import {
    assertTwigPassFactoryContract,
    assertTwigPassCollectionsContract,
    assertTwigPassApiContract,
} from './sakuraPassContracts';
import { createTwigBranchEmitter } from './sakuraTwigBranchEmitter';
import { resolveSakuraTwigRootOpenOffset } from './sakuraTwigSilhouettePolicy';

export const createSakuraTwigPass = (input = {}) => {
    assertTwigPassFactoryContract(input);
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
        scaffoldNodeTwigProb,
        twigNodeBudgetCapBase,
        twigSpawnMinWidthBase,
        vigorSignal,
        branchChaos,
        verticalBias,
        trunkStyle,
        trunkBackboneLockStrength,
        twigNodeBloomChance,
        scaffoldUpperCoverage,
        formScaffoldComposition = null,
    } = runtime;
    const {
        nextRandomFn,
        createFallbackRandom,
    } = random;
    const {
        addTerminalSet,
        addScaffoldTipAccentSet,
        onTwigSpawn = null,
        onTwigBudget = null,
    } = hooks;

    const twigRootLengthBase = clamp(Number(twigTierGene.lengthBase) || 1, 0.08, 3.2);
    const twigRootWidthBase = clamp(Number(twigTierGene.widthBase) || 1, 0.08, 3.2);
    const usesWeepingTwigFlow = formScaffoldComposition?.stationPattern === 'radial_drooping';
    const formTwigDownwardRatio = usesWeepingTwigFlow
        ? clamp(Number(formScaffoldComposition.downwardRatio), 0, 1)
        : 0;
    const effectiveTwigUpwardBiasProb = usesWeepingTwigFlow
        ? twigUpwardBiasProb * (1 - formTwigDownwardRatio)
        : twigUpwardBiasProb;

    const generateTwigBranch = createTwigBranchEmitter({
        context: {
            currentStage,
            config,
            morphologyProfile,
            scaffoldStrength,
        },
        tiers: {
            tierModels,
            tierModelByTier,
            tierStrategies,
            twigTierGene,
        },
        limits: {
            trunkSegmentLimit,
            twigMaxDepth,
            scaffoldMaxDepth,
            structuralMaxDepth,
        },
        decay: {
            trunkInternodeDecay,
            trunkWidthDecay,
            lengthRatioByTier,
            widthReductionByTier,
        },
        runtime: {
            maxRelativeBendDeg,
            learningProgress,
            priorStrength,
            twigUpwardBiasProb: effectiveTwigUpwardBiasProb,
            twigDownwardRatio: formTwigDownwardRatio,
            branchChaos,
            verticalBias,
            trunkStyle,
            trunkBackboneLockStrength,
            twigNodeBloomChance,
        },
        random: {
            nextRandomFn,
            createFallbackRandom,
        },
        hooks: {
            addTerminalSet,
            onTwigBudget,
        },
    });

    const emitTwigPass = (collections) => {
        assertTwigPassCollectionsContract(collections);
        const attachSiteRegistry = createTwigAttachSiteRegistry();
        const { resolveRootAttachSites } = attachSiteRegistry;
        const ensureForcedApicalTipFlower = ({
            record,
            resourceState,
        }) => {
            const shouldForceFlower = Boolean(record?.apicalTipForceBloom)
                && Number(record?.scaffoldDepth) >= Number(record?.scaffoldDepthLimit);
            if (!shouldForceFlower) {
                return;
            }
            const hasFlowerTerminal = Array.isArray(record?.node?.terminals)
                && record.node.terminals.some((terminal) => terminal?.type === 'flower');
            if (hasFlowerTerminal) {
                return;
            }
            addScaffoldTipAccentSet({
                node: record.node,
                rng: record.nodeRandom,
                length: record.node.length,
                width: record.node.width,
                resourceState,
                forceBloomIfAvailable: true,
                forceLeafOnly: false,
                enforceVisibleTip: true,
                forceFlowerTerminal: true,
            });
        };
        collections.scaffoldRecords.forEach((record, recordIndex) => {
            if (record.currentDepth >= structuralMaxDepth) {
                if (!record.node.branches.length && !record.node.terminals.length) {
                    const shouldForceFlower = Boolean(record?.apicalTipForceBloom)
                        && Number(record?.scaffoldDepth) >= Number(record?.scaffoldDepthLimit);
                    addScaffoldTipAccentSet({
                        node: record.node,
                        rng: record.nodeRandom,
                        length: record.node.length,
                        width: record.node.width,
                        resourceState: record.node.vigorState || 'weak',
                        forceBloomIfAvailable: shouldForceFlower,
                        forceLeafOnly: false,
                        enforceVisibleTip: true,
                        forceFlowerTerminal: shouldForceFlower,
                    });
                }
                ensureForcedApicalTipFlower({
                    record,
                    resourceState: record.node.vigorState || 'weak',
                });
                return;
            }

            const rootId = String(record.scaffoldRootId ?? `fallback_${recordIndex}`);
            const rootAttachSites = resolveRootAttachSites(rootId);
            const scaffoldTangent = BranchGeometryModel.pointAndAngleAt(record.branchSegment, 0.72);
            const spawnContext = resolveScaffoldTwigSpawnContext({
                record,
                recordIndex,
                scaffoldMaxDepth,
                tierModels,
                scaffoldNodeTwigProb,
                twigSpawnMinWidthBase,
                vigorSignal,
                scaffoldUpperCoverage,
                rootAttachSites,
                scaffoldTangentAngle: scaffoldTangent.angle,
            });
            const {
                scaffoldDepthNorm,
                widthNorm,
                resourceAvailability,
                resourceState,
                canSpawnTwig,
                twigSpawnChance,
            } = spawnContext;
            record.node.vigorState = resourceState;
            onTwigSpawn?.({
                success: canSpawnTwig,
                depth: record.scaffoldDepth,
                width: record.node.width,
                spawnChance: twigSpawnChance,
            });

            if (!canSpawnTwig) {
                if (!record.node.branches.length) {
                    const shouldForceFlower = Boolean(record?.apicalTipForceBloom)
                        && Number(record?.scaffoldDepth) >= Number(record?.scaffoldDepthLimit);
                    addScaffoldTipAccentSet({
                        node: record.node,
                        rng: record.nodeRandom,
                        length: record.node.length,
                        width: record.node.width,
                        resourceState,
                        forceBloomIfAvailable: shouldForceFlower,
                        forceLeafOnly: false,
                        enforceVisibleTip: true,
                        forceFlowerTerminal: shouldForceFlower,
                    });
                }
                ensureForcedApicalTipFlower({
                    record,
                    resourceState,
                });
                return;
            }
            rootAttachSites.push(scaffoldDepthNorm);

            const twigChildBudgetCap = resolveTwigChildBudgetCap({
                twigNodeBudgetCapBase,
                resourceState,
                resourceAvailability,
                scaffoldDepthNorm, // Pass depth norm here
            });
            const attachCenter = clamp(0.72 + (1 - scaffoldDepthNorm) * 0.08, 0.56, 0.92);
            const attachT = clamp(
                attachCenter + (nextRandom(record.nodeRandom, `scaffold_${recordIndex}_twig_attach`) - 0.5) * 0.12,
                0.54,
                0.97,
            );
            const childAttach = BranchGeometryModel.pointAndAngleAt(record.branchSegment, attachT);

            const anchorSide = Math.sign(record.lastDir || 1) || 1;
            const sideDir = nextRandom(record.nodeRandom, `scaffold_${recordIndex}_twig_side`) < 0.5
                ? anchorSide
                : -anchorSide;
            const twigArcBase = clamp(tierModels.twig.arc.angleBase, 0.12, 1.3);
            const twigArcVar = clamp(tierModels.twig.arc.angleVar, 0.04, 1);
            const twigArc = twigArcBase * lerp(0.36, 0.68, 1 - scaffoldDepthNorm)
                + nextRandom(record.nodeRandom, `scaffold_${recordIndex}_twig_arc`) * twigArcVar * 0.46;
            const baseAbsoluteAngle = normalizeAngle(childAttach.angle + (sideDir * twigArc));
            const defaultTargetAngle = normalizeAngle(
                (-Math.PI / 2) + lerp(degToRad(-12), degToRad(10), verticalBias),
            );
            const defaultTargetBlend = clamp(
                0.08 + (twigUpwardBiasProb * 0.34) + (scaffoldDepthNorm * 0.2),
                0,
                0.66,
            );
            const twigDirectionTargetAngle = usesWeepingTwigFlow
                ? Math.PI / 2
                : defaultTargetAngle;
            const twigDirectionTargetBlend = usesWeepingTwigFlow
                ? clamp(
                    0.18 + (formTwigDownwardRatio * 0.62) + (scaffoldDepthNorm * 0.08),
                    0,
                    0.82,
                )
                : defaultTargetBlend;
            const twigTargetAbsoluteAngle = blendAngles(
                baseAbsoluteAngle,
                twigDirectionTargetAngle,
                twigDirectionTargetBlend,
            );
            let desiredRelativeOffset = shortestAngleDelta(twigTargetAbsoluteAngle, childAttach.angle)
                + sampleCenteredNoise(
                    record.nodeRandom,
                    0.12,
                    `scaffold_${recordIndex}_twig_offset_noise`,
                );
            if (Math.abs(desiredRelativeOffset) < degToRad(2.4)) {
                desiredRelativeOffset = (sideDir || 1) * degToRad(2.4);
            }
            desiredRelativeOffset = resolveSakuraTwigRootOpenOffset({
                relativeOffset: desiredRelativeOffset,
                scaffoldDepthNorm,
            });

            // Smooth out the width transition to prevent a blocky look between scaffold and twig
            const twigRootWidthMult = twigRootWidthBase * lerp(0.38, 0.72, widthNorm);

            const twigRootConfig = {
                angleOffset: desiredRelativeOffset,
                lenMult: twigRootLengthBase * lerp(0.3, 0.54, 1 - scaffoldDepthNorm),
                widthMult: twigRootWidthMult,
                dir: sideDir,
                isContinuation: false,
            };
            const resolvedDecay = GrowthDecayPolicyModel.resolveSakuraDimensions({
                gene: twigTierGene,
                progress: clamp(record.scaffoldDepth / Math.max(1, scaffoldMaxDepth), 0, 1),
                isTrunk: false,
                isTwig: false,
                config: twigRootConfig,
                branchOrder: record.branchOrder,
                length: record.node.length,
                width: record.node.width,
                lengthMult: twigRootConfig.lenMult,
                trunkInternodeDecay,
                trunkWidthDecay,
                lengthRatioByTier,
                widthReductionByTier,
                morphologyProfile,
                twigLevel: 0,
            });

            const guardedAngle = SakuraAngleGuardModel.resolveGuardedChildAngle({
                attachAngle: childAttach.angle,
                desiredRelativeOffset,
                nextOrder: SAKURA_BRANCH_ORDER.TERMINAL_TWIG,
                isContinuationChild: false,
                nextTwigLevel: 0,
                childDepth: 1,
                maxDepth: twigMaxDepth,
                nextWidth: resolvedDecay.nextWidth,
                isTrunkMainTransition: false,
                isSecondTrunkTransition: false,
                isTrunkParent: false,
                isTwigParent: false,
                parentDepth: record.scaffoldDepth,
                verticalBias,
                trunkStyle,
                trunkTierAngleVar: tierModelByTier.twig.angleVarNorm,
                trunkTierBranchAngle: tierModelByTier.twig.angleBase,
                trunkBackboneLockStrength,
                maxRelativeBendDeg,
                learningProgress,
                priorStrength,
                twigUpwardBiasProb: effectiveTwigUpwardBiasProb,
                twigDownwardRatio: formTwigDownwardRatio,
                branchChaos,
                branchAngleVar: tierModelByTier.twig.branchAngleVar,
                rng: record.nodeRandom,
                decisionPrefix: `scaffold_${recordIndex}_twig`,
            });

            const childNodeRandom = record.nodeRandom.fork({
                depth: record.currentDepth + 1,
                nodeRole: ShapePriorModel.resolveSakuraOrderName(SAKURA_BRANCH_ORDER.TERMINAL_TWIG),
                nodeSlot: 0,
                decisionType: 'twig_root',
            });
            record.node.branches.push({
                obj: generateTwigBranch({
                    currentDepth: record.currentDepth + 1,
                    currentX: childAttach.x,
                    currentY: childAttach.y,
                    length: resolvedDecay.nextLength,
                    width: resolvedDecay.nextWidth,
                    parentAngle: guardedAngle.finalChildAngle,
                    lastDir: Math.sign(guardedAngle.finalRelativeOffset) || sideDir || 1,
                    orderRunDepth: 0,
                    twigLevel: 0,
                    nodeRandom: childNodeRandom,
                    twigDepth: 1,
                    twigChildBudget: twigChildBudgetCap,
                }),
                angleOffset: guardedAngle.finalRelativeOffset,
                t: attachT,
            });
            ensureForcedApicalTipFlower({
                record,
                resourceState,
            });
        });
    };

    const api = {
        emitTwigPass,
    };
    assertTwigPassApiContract(api);
    return api;
};
