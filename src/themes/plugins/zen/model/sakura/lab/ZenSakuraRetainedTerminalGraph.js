import {
    SAKURA_TERMINAL_BRANCHING_DEFAULTS,
    SAKURA_TERMINAL_CLUSTER_COVERAGE_DEFAULT,
    SAKURA_TERMINAL_KEYED_RANDOM_CONTRACT,
    createSakuraTerminalSocketStudyPlan,
} from './ZenSakuraTwigPedicelStudy.js';

export const SAKURA_RETAINED_TERMINAL_GRAPH_CONTRACT = 'zen_sakura_retained_terminal_graph_v2';
export const SAKURA_RETAINED_TERMINAL_GRAPH_VERSION = 2;

function clamp01(value) {
    return Math.min(1, Math.max(0, Number(value)));
}

function createGrowthWindow(birth, mature) {
    const normalizedBirth = clamp01(birth);
    const normalizedMature = clamp01(Math.max(normalizedBirth + 0.01, mature));
    return Object.freeze({
        birth: normalizedBirth,
        mature: normalizedMature,
    });
}

function createAxisGrowthWindows(axes) {
    const growthByAxisId = new Map();
    const siblingCountByParentId = new Map();
    axes.forEach((axis) => {
        const siblingIndex = siblingCountByParentId.get(axis.parentAxisId) || 0;
        siblingCountByParentId.set(axis.parentAxisId, siblingIndex + 1);
        const parentGrowth = growthByAxisId.get(axis.parentAxisId);
        const depth = Math.max(0, Number(axis.growthDepth) || 0);
        const birth = parentGrowth
            ? parentGrowth.birth
                + ((parentGrowth.mature - parentGrowth.birth) * 0.68)
                + (siblingIndex * 0.025)
            : 0.04;
        const duration = Math.max(0.12, 0.2 - (depth * 0.018));
        growthByAxisId.set(axis.id, createGrowthWindow(birth, birth + duration));
    });
    return growthByAxisId;
}

function annotateAxes(axes, growthByAxisId) {
    return Object.freeze(axes.map((axis) => Object.freeze({
        ...axis,
        growth: growthByAxisId.get(axis.id),
    })));
}

function annotateSpurs(spurs, growthByAxisId) {
    const growthBySpurId = new Map();
    const annotated = spurs.map((spur, index) => {
        const sourceGrowth = growthByAxisId.get(spur.sourceAxisId);
        if (!sourceGrowth) {
            throw new Error(`ZEN_SAKURA_RETAINED_SPUR_SOURCE_GROWTH_MISSING:${spur.id}`);
        }
        const birth = Math.max(
            0.26,
            sourceGrowth.birth
                + ((sourceGrowth.mature - sourceGrowth.birth) * 0.74)
                + ((index % 3) * 0.012),
        );
        const growth = createGrowthWindow(birth, birth + 0.12);
        growthBySpurId.set(spur.id, growth);
        return Object.freeze({ ...spur, growth });
    });
    return {
        spurs: Object.freeze(annotated),
        growthBySpurId,
    };
}

function annotateClusters(clusters, growthBySpurId) {
    return Object.freeze(clusters.map((cluster) => {
        const spurGrowth = growthBySpurId.get(cluster.sourceSpurId);
        if (!spurGrowth) {
            throw new Error(`ZEN_SAKURA_RETAINED_CLUSTER_SOURCE_GROWTH_MISSING:${cluster.id}`);
        }
        const clusterBirth = Math.max(0.4, spurGrowth.mature - 0.02);
        const organs = Object.freeze(cluster.organs.map((organ, organIndex) => {
            const isBud = organ.kind === 'bud';
            const birth = Math.max(
                isBud ? 0.42 : 0.54,
                clusterBirth + (organIndex * 0.018),
            );
            return Object.freeze({
                ...organ,
                id: `${cluster.id}-organ-${organIndex}`,
                growth: createGrowthWindow(
                    birth,
                    birth + (isBud ? 0.13 : 0.18),
                ),
            });
        }));
        const earliestBirth = Math.min(...organs.map((organ) => organ.growth.birth));
        const latestMature = Math.max(...organs.map((organ) => organ.growth.mature));
        return Object.freeze({
            ...cluster,
            growth: createGrowthWindow(earliestBirth, latestMature),
            organs,
        });
    }));
}

function annotateLeaves(leaves, growthBySpurId) {
    return Object.freeze(leaves.map((leaf, index) => {
        const sourceGrowth = growthBySpurId.get(leaf.sourceSpurId);
        if (!sourceGrowth) {
            throw new Error(`ZEN_SAKURA_RETAINED_LEAF_SOURCE_GROWTH_MISSING:${leaf.id}`);
        }
        const birth = Math.max(0.45, sourceGrowth.mature - 0.01 + ((index % 2) * 0.018));
        return Object.freeze({
            ...leaf,
            growth: createGrowthWindow(birth, birth + 0.14),
        });
    }));
}

function createGraphSignature({
    fixtureId,
    density,
    branching,
    interiorFill,
    clusterCoverage,
    randomContract,
}) {
    return [
        SAKURA_RETAINED_TERMINAL_GRAPH_CONTRACT,
        randomContract,
        fixtureId,
        Number(density).toFixed(3),
        Number(branching.forkFrequency).toFixed(3),
        Number(branching.forkSpread).toFixed(3),
        Number(branching.lateralVigor).toFixed(3),
        Number(interiorFill).toFixed(3),
        Number(clusterCoverage).toFixed(3),
    ].join(':');
}

export function resolveSakuraRetainedGrowthPhase(growthWindow, growthProgress) {
    if (!growthWindow) return 1;
    const progress = clamp01(growthProgress);
    if (progress <= growthWindow.birth) return 0;
    if (progress >= growthWindow.mature) return 1;
    const linear = (progress - growthWindow.birth)
        / (growthWindow.mature - growthWindow.birth);
    return linear * linear * (3 - (2 * linear));
}

export function createSakuraRetainedTerminalGraph({
    fixtureId,
    density = 1,
    branching = SAKURA_TERMINAL_BRANCHING_DEFAULTS,
    interiorFill = 0.65,
    clusterCoverage = SAKURA_TERMINAL_CLUSTER_COVERAGE_DEFAULT,
    ...unknownOptions
}) {
    const unknownOptionKeys = Object.keys(unknownOptions);
    if (unknownOptionKeys.length > 0) {
        throw new Error(
            `ZEN_SAKURA_RETAINED_TERMINAL_OPTIONS_UNKNOWN:${unknownOptionKeys.sort().join(',')}`,
        );
    }
    const plan = createSakuraTerminalSocketStudyPlan({
        fixtureId,
        density,
        branching,
        interiorFill,
        clusterCoverage,
    });
    const growthByAxisId = createAxisGrowthWindows(plan.axes);
    const axes = annotateAxes(plan.axes, growthByAxisId);
    const {
        spurs,
        growthBySpurId,
    } = annotateSpurs(plan.spurs, growthByAxisId);
    const clusters = annotateClusters(plan.clusters, growthBySpurId);
    const leaves = annotateLeaves(plan.leaves, growthBySpurId);
    const signature = createGraphSignature({
        fixtureId,
        density: plan.budgetUse,
        branching: plan.branching,
        interiorFill: plan.interiorFill,
        clusterCoverage: plan.clusterCoverage,
        randomContract: plan.randomContract,
    });

    return Object.freeze({
        contract: SAKURA_RETAINED_TERMINAL_GRAPH_CONTRACT,
        version: SAKURA_RETAINED_TERMINAL_GRAPH_VERSION,
        signature,
        socket: plan.socket,
        incomingCarrier: plan.incomingCarrier,
        axes,
        spurs,
        clusters,
        leaves,
        clusterZoneUsage: plan.clusterZoneUsage,
        clusterTemplateUsage: plan.clusterTemplateUsage,
        attachmentUsage: plan.attachmentUsage,
        usage: plan.usage,
        budgetUse: plan.budgetUse,
        branching: plan.branching,
        interiorFill: plan.interiorFill,
        clusterCoverage: plan.clusterCoverage,
        randomContract: plan.randomContract,
        diagnostics: Object.freeze({
            stableAxisIds: axes.length,
            stableSpurIds: spurs.length,
            stableOrganIds: clusters.reduce(
                (total, cluster) => total + cluster.organs.length,
                0,
            ),
            stableLeafIds: leaves.length,
        }),
    });
}

export function requireSakuraRetainedTerminalGraph(value) {
    if (
        !value
        || value.contract !== SAKURA_RETAINED_TERMINAL_GRAPH_CONTRACT
        || value.version !== SAKURA_RETAINED_TERMINAL_GRAPH_VERSION
        || typeof value.signature !== 'string'
        || !value.signature
        || value.randomContract !== SAKURA_TERMINAL_KEYED_RANDOM_CONTRACT
        || !value.branching
        || !Number.isFinite(value.branching.forkFrequency)
        || !Number.isFinite(value.branching.forkSpread)
        || !Number.isFinite(value.branching.lateralVigor)
        || !Number.isFinite(value.clusterCoverage)
        || !Array.isArray(value.axes)
        || !Array.isArray(value.spurs)
        || !Array.isArray(value.clusters)
        || !Array.isArray(value.leaves)
    ) {
        throw new Error('ZEN_SAKURA_RETAINED_TERMINAL_GRAPH_INVALID');
    }
    return value;
}
