import {
    sampleStructuralRandom,
} from '../../bonsai/random/StructuralHashRandom';
import { TreeGraph } from './TreeGraph';
import { resolveVNextMorphologyFeatures } from './VNextMorphologyFeatures';
import {
    OccupancyFieldModel,
    LightFieldModel,
    StyleFieldModel,
} from '../fields/index';
import {
    ProvenanceRecorderV1,
} from '../trace/index';
import { resolveVNextRuntimeV2 } from './v2/resolveVNextRuntimeV2';
import { growVNextBackbone } from './v2/VNextBackboneGrowthEngine';
import { resolveVNextBudField } from './v2/VNextBudFieldResolver';
import { selectVNextScaffoldRoots } from './v2/VNextScaffoldSelectionEngine';
import { buildVNextPadIntentPlan } from './v2/VNextPadIntentModel';
import { growVNextLineages } from './v2/VNextLineageGrowthEngine';
import {
    buildTopContributions,
    clamp01,
    lerp,
    round,
    toNumber,
} from './v2/VNextGrowthMath';

const DEFAULT_CONSTRAINTS = Object.freeze({
    maxNodes: 220,
    maxSteps: 26,
    maxDepth: 8,
    bounds: {
        width: 420,
        height: 420,
        depth: 420,
    },
});

const DEFAULT_OPTIONS = Object.freeze({
    traceLevel: 'compact',
    maxProvenanceEvents: 4096,
    enableDeadwood: true,
});

const resolveOptions = (options = {}) => ({
    ...DEFAULT_OPTIONS,
    ...(options || {}),
});

const resolveConstraints = (constraints = {}) => {
    const merged = {
        ...DEFAULT_CONSTRAINTS,
        ...(constraints || {}),
        bounds: {
            ...DEFAULT_CONSTRAINTS.bounds,
            ...(constraints?.bounds || {}),
        },
    };
    return {
        maxNodes: Math.max(24, Math.floor(toNumber(merged.maxNodes, DEFAULT_CONSTRAINTS.maxNodes))),
        maxSteps: Math.max(4, Math.floor(toNumber(merged.maxSteps, DEFAULT_CONSTRAINTS.maxSteps))),
        maxDepth: Math.max(3, Math.floor(toNumber(merged.maxDepth, DEFAULT_CONSTRAINTS.maxDepth))),
        bounds: {
            width: Math.max(120, toNumber(merged.bounds.width, DEFAULT_CONSTRAINTS.bounds.width)),
            height: Math.max(120, toNumber(merged.bounds.height, DEFAULT_CONSTRAINTS.bounds.height)),
            depth: Math.max(40, toNumber(merged.bounds.depth, DEFAULT_CONSTRAINTS.bounds.depth)),
        },
    };
};

export const runGrowthVMV2 = (input = {}) => {
    const seed = Number.isFinite(Number(input?.seed)) ? Math.floor(Number(input.seed)) : 0;
    const stage = typeof input?.stage === 'string' ? input.stage : 'mature';
    const options = resolveOptions(input?.options);
    const constraints = resolveConstraints(input?.constraints);
    const resolved = resolveVNextRuntimeV2({
        factors: input?.factors || {},
        stage,
        constraints,
    });
    const factorVector = resolved.factorVector;
    const runtime = resolved.runtime;
    const tree = new TreeGraph({ seed });
    const provenanceRecorder = new ProvenanceRecorderV1({
        seed,
        traceLevel: options.traceLevel,
        capacity: Math.max(16, Math.floor(toNumber(options.maxProvenanceEvents, 4096))),
    });
    const occupancyField = new OccupancyFieldModel({
        cellSize: lerp(18, 34, clamp01(runtime?.budField?.spaceAvoidGain)),
        queryRadius: lerp(24, 74, clamp01(runtime?.budField?.spaceAvoidGain)),
        saturationCount: Math.round(lerp(8, 18, clamp01(runtime?.lineage?.branchDensity))),
    });
    const lightField = new LightFieldModel({
        topLightDir: [0, 1],
        sideLightDir: [toNumber(runtime?.lineage?.windsweptBias, 0) * 0.46, 0.88],
        topLightWeight: clamp01(lerp(0.6, 0.9, clamp01(runtime?.budField?.phototropism))),
        sideLightWeight: clamp01(lerp(0.16, 0.4, Math.abs(toNumber(runtime?.lineage?.windsweptBias, 0)))),
    });
    const styleField = new StyleFieldModel({
        cascadeBias: clamp01(runtime?.lineage?.cascadeBias),
        windsweptBias: toNumber(runtime?.lineage?.windsweptBias, 0),
        canopyEnvelopeBias: (clamp01(runtime?.budField?.negativeSpaceTarget) * 2) - 1,
        padSeparationTarget: clamp01(runtime?.budField?.spaceAvoidGain),
        negativeSpaceTarget: clamp01(runtime?.budField?.negativeSpaceTarget),
        massBalanceGain: clamp01(runtime?.budField?.massBalanceGain),
    });
    const sampleRandom = (nodeId = 'root', index = 0) => sampleStructuralRandom({
        seed,
        nodeId: 'vnext_v2',
        decisionType: String(nodeId || 'root'),
        index: Math.max(0, Math.floor(toNumber(index, 0))),
    });
    const pushEvent = (step, eventType, payload = {}, meta = {}) => {
        provenanceRecorder.record({
            step,
            eventType,
            nodeId: meta?.nodeId || null,
            budId: meta?.budId || null,
            seedKey: typeof meta?.seedKey === 'string' ? meta.seedKey : '',
            randomValue: Number.isFinite(Number(meta?.randomValue)) ? Number(meta.randomValue) : null,
            payload,
            contributions: meta?.contributions || null,
        });
    };

    pushEvent(0, 'STEP_START', {
        activeBudCount: 0,
        nodeCount: 0,
    });

    const backboneResult = growVNextBackbone({
        tree,
        occupancyField,
        lightField,
        styleField,
        runtime,
        constraints,
        sampleRandom,
        pushEvent,
    });
    const budFieldResult = resolveVNextBudField({
        backboneRecords: backboneResult.records,
        backboneGuides: backboneResult.guides,
        occupancyField,
        lightField,
        styleField,
        runtime,
        constraints,
        sampleRandom,
        pushEvent,
    });
    const scaffoldResult = selectVNextScaffoldRoots({
        budSites: budFieldResult.sites,
        runtime,
        bounds: constraints.bounds,
        pushEvent,
    });
    const scaffoldDebug = {
        candidateStrategy: budFieldResult.debug.strategy,
        rawCandidateCount: Math.max(0, Math.floor(toNumber(budFieldResult?.debug?.rawCandidateCount, 0))),
        maximaCount: Math.max(0, Math.floor(toNumber(budFieldResult?.debug?.maximaCount, 0))),
        retainedCandidateCount: Math.max(0, Math.floor(toNumber(budFieldResult?.debug?.retainedCount, budFieldResult?.sites?.length || 0))),
        rejectedByThinning: Math.max(0, Math.floor(toNumber(budFieldResult?.debug?.rejectedByThinning, 0))),
        topCandidates: Array.isArray(budFieldResult?.debug?.topCandidates) ? budFieldResult.debug.topCandidates : [],
        ...(scaffoldResult?.debug || {
            beamWidth: 1,
            candidateCount: 0,
            rolePlan: [],
            selected: [],
        }),
    };
    const scaffoldFallbackDebug = {
        beamWidth: 1,
        candidateCount: 0,
        rolePlan: [],
        selected: [],
    };
    const padIntentResult = buildVNextPadIntentPlan({
        selectedScaffolds: scaffoldResult.selected,
        runtime,
        bounds: constraints.bounds,
    });
    const selectedScaffoldRoots = Array.isArray(padIntentResult?.selectedScaffolds)
        ? padIntentResult.selectedScaffolds
        : scaffoldResult.selected;
    (Array.isArray(selectedScaffoldRoots) ? selectedScaffoldRoots : []).forEach((site, index) => {
        const padIntent = site?.padIntent || null;
        if (!padIntent) {
            return;
        }
        const contributions = {
            pad_compactness: round(toNumber(padIntent?.compactness, 0), 6),
            pad_sweep_bias: round(toNumber(padIntent?.sweepBias, 0), 6),
            pad_recovery_bias: round(toNumber(padIntent?.recoveryBias, 0), 6),
            pad_branching_bias: round(toNumber(padIntent?.branchingBias, 0), 6),
            pad_terminal_density: round(toNumber(padIntent?.terminalDensity, 0), 6),
            pad_droop_bias: round(toNumber(padIntent?.droopBias, 0), 6),
            pad_void_respect: round(toNumber(padIntent?.voidRespect, 0), 6),
        };
        pushEvent?.(
            Math.max(0, Math.floor(toNumber(site?.segmentIndex, index))),
            'ACTION_SELECTED',
            {
                action: `resolve_pad_${padIntent?.profile || 'support_pad'}`,
                phase: 'scaffold',
                candidateCount: 1,
                scoreTotal: round(
                    Object.values(contributions).reduce((acc, value) => acc + Number(value || 0), 0),
                    6,
                ),
                topPositive: buildTopContributions(contributions, { positive: true }),
                topNegative: buildTopContributions(contributions, { positive: false }),
            },
            {
                nodeId: site?.parentNodeId || null,
                budId: site?.id || null,
                contributions,
            },
        );
    });
    const lineageResult = growVNextLineages({
        tree,
        occupancyField,
        lightField,
        styleField,
        runtime,
        constraints,
        selectedScaffolds: selectedScaffoldRoots,
        sampleRandom,
        pushEvent,
        options,
    });
    const lineageDebug = {
        candidateAverage: round(toNumber(lineageResult?.debug?.candidateAverage, 0), 6),
        decisionCount: Math.max(0, Math.floor(toNumber(lineageResult?.debug?.decisionCount, 0))),
        actionCounts: lineageResult?.debug?.actionCounts || {},
        transitionCounts: lineageResult?.debug?.transitionCounts || {},
        topActions: Array.isArray(lineageResult?.debug?.topActions) ? lineageResult.debug.topActions : [],
        selectedSamples: Array.isArray(lineageResult?.debug?.selectedSamples) ? lineageResult.debug.selectedSamples : [],
    };
    const backboneSpines = Array.isArray(backboneResult?.spines) ? backboneResult.spines : [];
    const primarySpine = backboneSpines[0] || null;
    const backboneDebug = {
        beamWidth: backboneSpines.reduce(
            (acc, entry) => Math.max(acc, Math.max(1, Math.floor(toNumber(entry?.beamWidth, 1)))),
            1,
        ),
        spineCount: backboneSpines.length,
        attractorCount: Math.max(0, Math.floor(toNumber(primarySpine?.attractorCount, 0))),
        attractors: Array.isArray(primarySpine?.attractors) ? primarySpine.attractors : [],
        spines: backboneSpines,
    };

    const topology = tree.toSerializable();
    const morphology = resolveVNextMorphologyFeatures(topology);
    const diagnostics = {
        nodeCount: tree.nodeCount(),
        stepCount: Math.max(
            1,
            Math.round(
                backboneResult.records.length * 0.42
                + scaffoldResult.selected.length * 0.86
                + Math.max(1, topology.nodeCount * 0.08),
            ),
        ),
        pruneCount: Math.max(0, Math.floor(toNumber(lineageResult.pruneCount, 0))),
        deadwoodCount: Math.max(0, Math.floor(toNumber(lineageResult.deadwoodCount, 0))),
        stallGuardCount: 0,
        warnings: [],
        selectedScaffoldCount: selectedScaffoldRoots.length,
        budSiteCount: budFieldResult.sites.length,
        backboneSegmentCount: backboneResult.records.length,
        backboneBeamWidth: backboneDebug.beamWidth,
        backboneAttractorCount: backboneDebug.attractorCount,
        scaffoldBeamWidth: Math.max(1, Math.floor(toNumber(scaffoldDebug?.beamWidth, 1))),
        scaffoldRoleCount: Array.isArray(scaffoldDebug?.selected) ? scaffoldDebug.selected.length : 0,
        padIntentCount: Array.isArray(padIntentResult?.debug?.padPlan) ? padIntentResult.debug.padPlan.length : 0,
        lineageActionDiversity: Object.values(lineageDebug.actionCounts).filter((value) => Number(value) > 0).length,
        engineVersion: 2,
    };

    pushEvent(diagnostics.stepCount, 'STEP_END', {
        activeBudCount: 0,
        nodeCount: tree.nodeCount(),
    });
    pushEvent(diagnostics.stepCount, 'RUN_END', {
        diagnostics: {
            ...diagnostics,
        },
    });

    return {
        factorVector: {
            ...factorVector,
        },
        runtime: {
            version: 2,
            ...runtime,
            backbone: {
                ...(runtime?.backbone || {}),
                debug: backboneDebug,
            },
            scaffold: {
                ...(runtime?.scaffold || {}),
                debug: {
                    ...scaffoldFallbackDebug,
                    ...scaffoldDebug,
                    ...(padIntentResult?.debug || {
                        padPlan: [],
                        padAverages: {},
                    }),
                },
            },
            lineage: {
                ...(runtime?.lineage || {}),
                debug: lineageDebug,
            },
        },
        topology,
        provenance: provenanceRecorder.toSerializable(),
        features: {
            nodeCount: tree.nodeCount(),
            activeBudCount: 0,
            deadwoodRatio: round(
                topology.nodes.filter((node) => node.role === 'deadwood').length / Math.max(1, tree.nodeCount()),
                6,
            ),
            ...morphology,
        },
        diagnostics,
    };
};
