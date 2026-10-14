import { runGrowthVMV1, runGrowthVMV2, runGrowthVMV3 } from './core/index';
import { TreeAnalyzer } from '../TreeAnalyzer';
import { adaptVNextTopologyToTreeV1 } from './bridge/TopologyAdapterV1';

export const ZEN_BONSAI_ENGINE_VNEXT_VERSION = 1;

const resolveGrowthEngineVersion = (input = {}) => {
    const raw = input?.options?.engineVersion ?? input?.engineVersion;
    if (raw === undefined) {
        return 2;
    }
    if (raw === 1 || raw === 2 || raw === 3) {
        return raw;
    }
    throw new Error(`Unsupported Zen vNext GrowthVM variant '${String(raw)}'.`);
};

const sanitizeAnalysis = (analysis = null) => {
    if (!analysis || typeof analysis !== 'object') {
        return null;
    }
    return {
        ...analysis,
        timestamp: null,
    };
};

export const runZenBonsaiEngineVNext = (input = {}) => {
    const engineVersion = resolveGrowthEngineVersion(input);
    const result = (() => {
        if (engineVersion === 1) {
            return runGrowthVMV1(input);
        }
        if (engineVersion === 3) {
            return runGrowthVMV3(input);
        }
        return runGrowthVMV2(input);
    })();
    return {
        version: ZEN_BONSAI_ENGINE_VNEXT_VERSION,
        engineVersion,
        ...result,
    };
};

export const runZenBonsaiEngineVNextWithAnalysis = (input = {}) => {
    const base = runZenBonsaiEngineVNext(input);
    const analysisWidth = Math.max(1, Number(input?.constraints?.bounds?.width || input?.analysis?.width || 420));
    const analysisHeight = Math.max(1, Number(input?.constraints?.bounds?.height || input?.analysis?.height || 420));
    const treeTopology = adaptVNextTopologyToTreeV1(base?.topology, {
        presetId: input?.presetId || null,
        factorVector: base?.factorVector || input?.factors || {},
        currentStage: input?.currentStage || input?.analysisStage || null,
    });
    const analysis = treeTopology
        ? TreeAnalyzer.analyze(treeTopology, analysisWidth, analysisHeight, {
            species: 'sakura',
            referenceFeatures: [],
        })
        : null;
    return {
        ...base,
        treeTopology,
        analysis: sanitizeAnalysis(analysis),
    };
};
