import { TerminalGenerationPolicyModel } from '../bonsai/generation/terminalGenerationPolicyModel';
import {
    clamp,
} from './sakuraMath';
import { createSakuraTwigPass } from './sakuraTwigPass';
import {
    createSakuraTrunkScaffoldGenerator,
} from './sakuraTrunkScaffoldGenerator';

export const createSakuraBranchGenerator = (context = {}) => {
    const {
        gene,
        currentStage,
        topologyRandom,
        scaffoldStrength,
        twigMaxDepth,
        scaffoldMaxDepth,
        structuralMaxDepth,
        trunkInternodeDecay,
        trunkWidthDecay,
        maxRelativeBendDeg,
        learningProgress,
        priorStrength,
        twigUpwardBiasProb,
        nextRandom: nextRandomFn,
        config,
    } = context;

    const {
        generationTelemetry,
        generateTrunkScaffold,
        passContextFactory,
    } = createSakuraTrunkScaffoldGenerator(context);

    const addTerminalSet = (node, rng, length, width) => {
        node.terminals.push(
            ...TerminalGenerationPolicyModel.resolveSakuraTerminalSet({
                rng,
                gene,
                currentStage,
                length,
                width,
                flowerColors: config.flowerColors,
                leafColors: config.leafColors,
            }),
        );
    };

    const addScaffoldTipAccentSet = ({
        node,
        rng,
        length,
        width,
        resourceState = 'weak',
        forceBloomIfAvailable = false,
        forceLeafOnly = false,
        enforceVisibleTip = true,
        forceFlowerTerminal = false,
    }) => {
        const stageFlowerGate = clamp(currentStage?.flowerChance ?? 0, 0, 1);
        const stageLeafGate = clamp(currentStage?.leafChance ?? 1, 0, 1);
        const safeResourceState = (
            resourceState === 'dead' || resourceState === 'bloom'
        )
            ? resourceState
            : 'weak';
        const baseCount = safeResourceState === 'bloom' ? 2 : 1;
        const clusterCount = Math.max(1, baseCount);
        const flowerBias = forceLeafOnly
            ? 0
            : (
                forceBloomIfAvailable
                    ? (stageFlowerGate > 0 ? 1 : 0)
                    : (
                        safeResourceState === 'dead'
                            ? 0.04
                            : (safeResourceState === 'weak' ? 0.1 : 0.18)
                    )
            );
        const flowerVisualGate = forceLeafOnly
            ? 0
            : (
                forceBloomIfAvailable
                    ? (stageFlowerGate > 0 ? 1 : 0)
                    : clamp(stageFlowerGate * 0.7, 0, 1)
            );
        const leafVisualGate = forceLeafOnly
            ? 1
            : (
                forceBloomIfAvailable
                    ? 1
                    : clamp(
                        stageLeafGate * (
                            safeResourceState === 'dead'
                                ? 0.66
                                : (safeResourceState === 'weak' ? 0.9 : 0.98)
                        ),
                        0,
                        1,
                    )
            );
        const canopyWidth = clamp(
            length * 0.78 + width * 1.9,
            1.8,
            7.8,
        );
        const accent = TerminalGenerationPolicyModel.resolveSakuraCanopyCluster({
            rng,
            clusterCount,
            canopyBloomRadius: 0.34,
            canopyWidth,
            apexWeight: 0.44,
            centerBias: 0,
            flowerBias,
            flowerVisualGate,
            leafVisualGate,
            flowerColors: config.flowerColors,
            leafColors: config.leafColors,
        });
        if (accent.length) {
            node.terminals.push(...accent);
            if (!forceFlowerTerminal) {
                return;
            }
        }
        if (enforceVisibleTip) {
            // Final fallback: always leave a visible tip marker.
            node.terminals.push(...TerminalGenerationPolicyModel.resolveSakuraCanopyCluster({
                rng,
                clusterCount: 1,
                canopyBloomRadius: 0.3,
                canopyWidth,
                apexWeight: 0.4,
                centerBias: 0,
                flowerBias: forceBloomIfAvailable ? 1 : 0,
                flowerVisualGate: forceBloomIfAvailable ? 1 : 0,
                leafVisualGate: 1,
                flowerColors: config.flowerColors,
                leafColors: config.leafColors,
            }));
        }
        if (forceFlowerTerminal) {
            const hasFlowerTerminal = node.terminals.some((terminal) => terminal?.type === 'flower');
            if (!hasFlowerTerminal) {
                const forcedFlower = TerminalGenerationPolicyModel.resolveSakuraCanopyCluster({
                    rng,
                    clusterCount: 1,
                    canopyBloomRadius: 0.3,
                    canopyWidth,
                    apexWeight: 0.42,
                    centerBias: 0,
                    flowerBias: 1,
                    flowerVisualGate: 1,
                    leafVisualGate: 0,
                    flowerColors: config.flowerColors,
                    leafColors: config.leafColors,
                }).find((terminal) => terminal?.type === 'flower');
                if (forcedFlower) {
                    node.terminals.push(forcedFlower);
                } else {
                    node.terminals.push({
                        type: 'flower',
                        scale: 1.02,
                        color: config?.flowerColors?.[0] || '#FFCDD2',
                        angle: 0,
                        dist: clamp(canopyWidth * 0.11, 1.6, 4.2),
                    });
                }
            }
        }
    };

    const { emitTwigPass } = createSakuraTwigPass(
        passContextFactory.buildTwigPassInput({
            currentStage,
            config,
            scaffoldStrength,
            twigMaxDepth,
            scaffoldMaxDepth,
            structuralMaxDepth,
            trunkInternodeDecay,
            trunkWidthDecay,
            maxRelativeBendDeg,
            learningProgress,
            priorStrength,
            twigUpwardBiasProb,
            nextRandomFn,
            addTerminalSet,
            addScaffoldTipAccentSet,
            hooks: {
                onTwigSpawn: generationTelemetry.trackTwigSpawn,
                onTwigBudget: generationTelemetry.trackTwigBudget,
            },
        }),
    );

    const generateBranch = (state = {}) => {
        const { root, collections } = generateTrunkScaffold(state);
        emitTwigPass(collections);

        if (!root.branches.length && !root.terminals.length) {
            addTerminalSet(root, topologyRandom, root.length, root.width);
        }
        const telemetrySnapshot = generationTelemetry.snapshot();
        if (telemetrySnapshot) {
            root.generationTelemetry = telemetrySnapshot;
        }
        return root;
    };

    return generateBranch;
};
