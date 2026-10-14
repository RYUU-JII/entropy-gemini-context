import { createSakuraGenerationTelemetry } from './sakuraGenerationTelemetry';
import { createSakuraPassContextFactory } from './sakuraPassContextFactory';
import { createSakuraScaffoldPass } from './sakuraScaffoldPass';
import { createSakuraTrunkPass } from './sakuraTrunkPass';

export const createSakuraTrunkScaffoldGenerator = (context = {}) => {
    const {
        gene,
        topologyRandom,
        morphologyProfile,
        scaffoldStrength,
        trunkSegmentLimit,
        twigMaxDepth,
        scaffoldMaxDepth,
        structuralMaxDepth,
        trunkPathPlan,
        scaffoldStationPlan,
        formCompositionPlan = null,
        trunkInternodeDecay,
        trunkWidthDecay,
        nextRandom: nextRandomFn,
        trunkTargetHeight = null,
    } = context;

    const passContextFactory = createSakuraPassContextFactory({
        gene,
        topologyRandom,
        morphologyProfile,
        trunkSegmentLimit,
        trunkPathPlan,
        scaffoldStationPlan,
        formCompositionPlan,
    });
    const generationTelemetry = createSakuraGenerationTelemetry();
    const { emitScaffoldPass } = createSakuraScaffoldPass(
        passContextFactory.buildScaffoldPassInput({
            scaffoldStrength,
            twigMaxDepth,
            scaffoldMaxDepth,
            structuralMaxDepth,
            trunkInternodeDecay,
            trunkWidthDecay,
            trunkTargetHeight,
            nextRandomFn,
            hooks: {
                onScaffoldNode: generationTelemetry.trackScaffoldNode,
                onScaffoldRoot: generationTelemetry.trackScaffoldRoot,
            },
        }),
    );
    const generateTrunkBranch = createSakuraTrunkPass(
        passContextFactory.buildTrunkPassInput({
            structuralMaxDepth,
            nextRandomFn,
            hooks: {
                onTrunkNode: generationTelemetry.trackTrunkNode,
            },
        }),
    );

    const generateTrunkScaffold = (state = {}) => {
        const collections = {
            trunkSpanRegistry: [],
            scaffoldRecords: [],
        };
        const root = generateTrunkBranch(state, collections);
        emitScaffoldPass(collections);
        return { root, collections };
    };

    return {
        generationTelemetry,
        generateTrunkScaffold,
        passContextFactory,
    };
};
