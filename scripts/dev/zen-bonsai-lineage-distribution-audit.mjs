import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SeededRandom } from '../../src/themes/plugins/zen/model/SeededRandom.js';
import { SakuraSpecies } from '../../src/themes/plugins/zen/model/SakuraSpecies.js';
import { BranchGeometryModel } from '../../src/themes/plugins/zen/model/bonsai/geometry/branchGeometryModel.js';
import { compileSakuraPhenotypeFromLatent } from '../../src/themes/plugins/zen/model/v2/SakuraCompiler.js';
import { getDefaultSakuraLatent } from '../../src/themes/plugins/zen/model/v2/SakuraLatentSchema.js';
import {
    projectZenBonsaiClassic2DevelopmentTopology,
    resolveZenBonsaiClassic2DisplayCandidateStage,
    ZEN_BONSAI_CLASSIC2_WOOD_CLOCK_POLICIES,
} from '../../src/themes/plugins/zen/model/classic2/ZenBonsaiClassic2DevelopmentModel.js';
import {
    bootstrapZenBonsaiClassic2LineageState,
    prepareZenBonsaiClassic2LineageCandidate,
    reconcileZenBonsaiClassic2LineageState,
    summarizeZenBonsaiClassic2LineageState,
    ZEN_BONSAI_CLASSIC2_LINEAGE_SOURCES,
} from '../../src/themes/plugins/zen/model/classic2/ZenBonsaiClassic2LineageModel.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_DIR = resolve(ROOT, 'reports/zen-bonsai-lineage-distribution');
const MANIFEST_PATH = resolve(OUT_DIR, 'manifest.json');
const REPORT_PATH = resolve(OUT_DIR, 'report.md');

const AUDIT_VERSION = 1;
const STRUCTURE_DEPTH = 6;
const TOPOLOGY_REFERENCE_HEIGHT = 360;
const GRID_SIZE = 5;
const POLAR_SECTOR_COUNT = 12;
const HIGH_DENSITY_STRUCTURE_DEPTH = 8;
const SEEDS = Object.freeze([17, 83, 211, 478, 997]);
const CHECKPOINTS = Object.freeze([
    Object.freeze({ growthStage: 12, growth: 0.5199 }),
    Object.freeze({ growthStage: 24, growth: 0.5726 }),
    Object.freeze({ growthStage: 42, growth: 0.6905 }),
    Object.freeze({ growthStage: 55, growth: 0.7874 }),
    Object.freeze({ growthStage: 70, growth: 0.892 }),
    Object.freeze({ growthStage: 82, growth: 0.9572 }),
    Object.freeze({ growthStage: 92, growth: 0.9909 }),
]);

const HISTORY_DEFINITIONS = Object.freeze([
    Object.freeze({
        id: 'steady_care',
        label: 'Steady care',
        description: 'Stable reserve, moderate recovery, and low stress/volatility.',
        segments: Object.freeze([
            [0.08, 0.18, 0.05, 0.72, 0.80],
            [0.07, 0.20, 0.04, 0.74, 0.82],
            [0.09, 0.19, 0.06, 0.73, 0.81],
            [0.06, 0.22, 0.04, 0.77, 0.85],
            [0.07, 0.21, 0.05, 0.78, 0.86],
            [0.05, 0.23, 0.03, 0.80, 0.88],
            [0.06, 0.24, 0.04, 0.81, 0.89],
        ]),
    }),
    Object.freeze({
        id: 'thriving',
        label: 'Thriving',
        description: 'High reserve/recovery with consistently low stress.',
        segments: Object.freeze([
            [0.03, 0.31, 0.03, 0.88, 0.91],
            [0.02, 0.34, 0.02, 0.91, 0.94],
            [0.04, 0.33, 0.03, 0.90, 0.93],
            [0.02, 0.37, 0.02, 0.94, 0.96],
            [0.03, 0.36, 0.02, 0.93, 0.95],
            [0.02, 0.39, 0.01, 0.95, 0.97],
            [0.02, 0.40, 0.02, 0.96, 0.98],
        ]),
    }),
    Object.freeze({
        id: 'persistent_strain',
        label: 'Persistent strain',
        description: 'Repeated high stress, weak recovery, and depleted canopy reserve.',
        segments: Object.freeze([
            [0.64, 0.06, 0.36, 0.38, 0.50],
            [0.69, 0.04, 0.41, 0.34, 0.46],
            [0.72, 0.03, 0.45, 0.31, 0.42],
            [0.75, 0.03, 0.48, 0.29, 0.39],
            [0.78, 0.02, 0.50, 0.27, 0.36],
            [0.74, 0.04, 0.46, 0.30, 0.40],
            [0.71, 0.05, 0.43, 0.33, 0.44],
        ]),
    }),
    Object.freeze({
        id: 'strain_recovery',
        label: 'Strain then recovery',
        description: 'Early high-stress wood followed by sustained recovery and reserve restoration.',
        segments: Object.freeze([
            [0.67, 0.04, 0.39, 0.34, 0.46],
            [0.73, 0.03, 0.44, 0.30, 0.41],
            [0.61, 0.09, 0.36, 0.39, 0.52],
            [0.38, 0.25, 0.24, 0.56, 0.66],
            [0.22, 0.36, 0.16, 0.70, 0.78],
            [0.13, 0.43, 0.10, 0.81, 0.87],
            [0.08, 0.47, 0.07, 0.88, 0.92],
        ]),
    }),
    Object.freeze({
        id: 'volatile_cycles',
        label: 'Volatile cycles',
        description: 'Alternating stress/recovery pulses with persistently high volatility.',
        segments: Object.freeze([
            [0.58, 0.08, 0.76, 0.42, 0.49],
            [0.12, 0.48, 0.71, 0.79, 0.84],
            [0.66, 0.07, 0.82, 0.35, 0.43],
            [0.10, 0.52, 0.75, 0.84, 0.88],
            [0.70, 0.06, 0.86, 0.32, 0.40],
            [0.09, 0.55, 0.78, 0.87, 0.91],
            [0.34, 0.29, 0.81, 0.61, 0.68],
        ]),
    }),
]);

const BASE_STAGE = Object.freeze({
    min: 86,
    max: 100,
    depth: STRUCTURE_DEPTH,
    leafChance: 0.2,
    flowerChance: 0.9,
    color: '#43A047',
    text: 'In Bloom',
});

const ROLE_IDS = Object.freeze(['trunk', 'scaffold', 'twig']);
const SIDE_IDS = Object.freeze(['left', 'center', 'right']);
const HORIZONTAL_BANDS = Object.freeze(['left', 'middle', 'right']);

const clamp = (value, min = 0, max = 1) => Math.min(
    max,
    Math.max(min, Number.isFinite(Number(value)) ? Number(value) : min),
);
const round = (value, digits = 6) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Number(numeric.toFixed(digits)) : 0;
};
const sum = (values) => values.reduce((total, value) => total + Number(value || 0), 0);
const mean = (values) => values.length ? sum(values) / values.length : 0;
const stdDev = (values) => {
    if (!values.length) return 0;
    const average = mean(values);
    return Math.sqrt(mean(values.map((value) => (Number(value) - average) ** 2)));
};
const stats = (values, digits = 6) => {
    const finite = values.map(Number).filter(Number.isFinite);
    if (!finite.length) {
        return Object.freeze({ count: 0, min: 0, max: 0, mean: 0, stdDev: 0 });
    }
    return Object.freeze({
        count: finite.length,
        min: round(Math.min(...finite), digits),
        max: round(Math.max(...finite), digits),
        mean: round(mean(finite), digits),
        stdDev: round(stdDev(finite), digits),
    });
};
const makeRoleCounts = (factory = () => 0) => Object.fromEntries(
    ROLE_IDS.map((role) => [role, factory(role)]),
);
const makeSideCounts = () => Object.fromEntries(SIDE_IDS.map((side) => [side, 0]));
const makeBandCounts = () => Object.fromEntries(HORIZONTAL_BANDS.map((band) => [band, 0]));
const sideId = (side) => (side < 0 ? 'left' : (side > 0 ? 'right' : 'center'));
const horizontalBand = (xNorm) => (xNorm < (1 / 3)
    ? 'left'
    : (xNorm > (2 / 3) ? 'right' : 'middle'));

const hashText = (value) => {
    let hash = 2166136261;
    const source = String(value);
    for (let index = 0; index < source.length; index += 1) {
        hash ^= source.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
};
const digestJson = (value) => 'fnv1a32:' + hashText(JSON.stringify(value));

const getPath = (value, path) => path.reduce((current, key) => current?.[key], value);
const selectedIdsForRole = (state, role = null) => new Set(
    Object.values(state.decisions)
        .filter((decision) => decision.status === 'selected')
        .filter((decision) => !role || state.candidateGraph[decision.nodeId]?.role === role)
        .map((decision) => decision.nodeId),
);
const isSubset = (left, right) => [...left].every((entry) => right.has(entry));
const intersectionSize = (left, right) => [...left].filter((entry) => right.has(entry)).length;
const jaccardDistance = (left, right) => {
    const union = new Set([...left, ...right]);
    return union.size ? round(1 - (intersectionSize(left, right) / union.size)) : 0;
};
const symmetricDifferenceSize = (left, right) => (
    [...left].filter((entry) => !right.has(entry)).length
    + [...right].filter((entry) => !left.has(entry)).length
);

const averageSegmentField = (segments, field) => round(mean(segments.map((segment) => segment[field])));
const makeLifeState = (history, checkpointIndex) => {
    const prefix = history.segments.slice(0, checkpointIndex + 1).map((values, index) => Object.freeze({
        id: history.id + ':g' + CHECKPOINTS[index].growthStage,
        milestone: CHECKPOINTS[index].growthStage,
        stressWood: values[0],
        recoveryWood: values[1],
        volatility: values[2],
        canopyReserve: values[3],
        healthH: values[4],
    }));
    const latest = prefix.at(-1);
    return Object.freeze({
        growth: CHECKPOINTS[checkpointIndex].growth,
        growthSegments: Object.freeze(prefix),
        structuralImprint: Object.freeze({
            stressWood: averageSegmentField(prefix, 'stressWood'),
            recoveryWood: averageSegmentField(prefix, 'recoveryWood'),
            volatility: averageSegmentField(prefix, 'volatility'),
            canopyReserve: averageSegmentField(prefix, 'canopyReserve'),
        }),
        vitality: latest.healthH,
        bloom: round(latest.canopyReserve * latest.healthH),
    });
};

const makeTreeIdentity = (seed) => Object.freeze({
    contract: 'zen_bonsai_classic2_candidate_identity_v1',
    identityRevision: 1,
    treeType: 'sakura',
    treeSeed: seed,
    structureDepth: STRUCTURE_DEPTH,
    structureMode: 'balanced',
    topologyReferenceHeight: TOPOLOGY_REFERENCE_HEIGHT,
    canonicalLatent: Object.freeze({ version: 1, values: Object.freeze({}) }),
    generationInputs: Object.freeze({
        learningProgress: 0,
        canopyDistributionProfile: Object.freeze({}),
    }),
});

const generateCandidate = (seed) => {
    const stage = resolveZenBonsaiClassic2DisplayCandidateStage({
        baseStage: BASE_STAGE,
        structureDepth: STRUCTURE_DEPTH,
        learningProgress: 0,
        canopyDistributionProfile: {},
    });
    const topology = SakuraSpecies.generateTopology(
        new SeededRandom(seed),
        stage,
        TOPOLOGY_REFERENCE_HEIGHT,
    );
    const treeIdentity = makeTreeIdentity(seed);
    const preparedCandidate = prepareZenBonsaiClassic2LineageCandidate({ topology, treeIdentity });
    return { seed, topology, treeIdentity, preparedCandidate };
};

const indexTopology = (topology) => {
    const nodeById = new Map();
    const geometryById = new Map();
    const sampledPoints = [{ x: 0, y: 0 }];
    const initialAngle = Number.isFinite(Number(topology?.initialAngle))
        ? Number(topology.initialAngle)
        : (-Math.PI / 2);

    const walk = (node, startX, startY, angle) => {
        if (!node || node.type !== 'branch') return;
        const segment = BranchGeometryModel.createSegment({
            startX,
            startY,
            angle,
            length: Number(node.length) || 0,
            curve: Number(node.curve) || 0,
            curveIn: Number.isFinite(Number(node.curveIn)) ? Number(node.curveIn) : null,
            curveOut: Number.isFinite(Number(node.curveOut)) ? Number(node.curveOut) : null,
        });
        nodeById.set(node.nodeId, node);
        geometryById.set(node.nodeId, Object.freeze({
            startX: round(startX),
            startY: round(startY),
            endX: round(segment.endX),
            endY: round(segment.endY),
            angle: round(angle),
        }));
        sampledPoints.push(
            { x: segment.endX, y: segment.endY },
            BranchGeometryModel.pointAt(segment, 0.5),
        );
        (Array.isArray(node.branches) ? node.branches : []).forEach((child) => {
            if (!child?.obj || child.obj.type !== 'branch') return;
            const t = Number.isFinite(Number(child.t)) ? clamp(Number(child.t)) : 1;
            const attachment = BranchGeometryModel.pointAndAngleAt(segment, t);
            walk(
                child.obj,
                attachment.x,
                attachment.y,
                attachment.angle + (Number(child.angleOffset) || 0),
            );
        });
    };
    walk(topology, 0, 0, initialAngle);

    const xs = sampledPoints.map((point) => point.x);
    const ys = sampledPoints.map((point) => point.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return Object.freeze({
        nodeById,
        geometryById,
        bounds: Object.freeze({
            minX: round(minX),
            maxX: round(maxX),
            minY: round(minY),
            maxY: round(maxY),
            width: round(Math.max(1e-6, maxX - minX)),
            height: round(Math.max(1e-6, maxY - minY)),
        }),
    });
};

const failAudit = (code, detail = null) => {
    throw new Error(
        'ZEN_BONSAI_LINEAGE_DISTRIBUTION_AUDIT_' + code
        + (detail === null ? '' : ':' + String(detail)),
    );
};

const indexLineageRenderBinding = (renderBinding) => {
    const nodeBindings = renderBinding?.nodeBindings;
    if (!nodeBindings || typeof nodeBindings !== 'object' || Array.isArray(nodeBindings)) {
        failAudit('RENDER_BINDING_INVALID');
    }
    const logicalNodeIdByPhysicalNodeId = new Map();
    const physicalNodeIdsByLogicalNodeId = new Map();
    Object.entries(nodeBindings).forEach(([physicalNodeId, binding]) => {
        const logicalNodeId = typeof binding?.logicalNodeId === 'string'
            ? binding.logicalNodeId.trim()
            : '';
        if (!physicalNodeId || !logicalNodeId) {
            failAudit('RENDER_NODE_BINDING_INVALID', physicalNodeId || 'missing_physical_node_id');
        }
        logicalNodeIdByPhysicalNodeId.set(physicalNodeId, logicalNodeId);
        if (!physicalNodeIdsByLogicalNodeId.has(logicalNodeId)) {
            physicalNodeIdsByLogicalNodeId.set(logicalNodeId, []);
        }
        physicalNodeIdsByLogicalNodeId.get(logicalNodeId).push(physicalNodeId);
    });
    if (logicalNodeIdByPhysicalNodeId.size !== Number(renderBinding.physicalNodeCount)) {
        failAudit('RENDER_BINDING_PHYSICAL_COUNT_MISMATCH');
    }
    physicalNodeIdsByLogicalNodeId.forEach((physicalNodeIds, logicalNodeId) => {
        physicalNodeIdsByLogicalNodeId.set(logicalNodeId, Object.freeze(physicalNodeIds.sort()));
    });
    return Object.freeze({
        logicalNodeIdByPhysicalNodeId,
        physicalNodeIdsByLogicalNodeId,
    });
};

const requireLogicalNodeIdForPhysicalNode = (renderBindingIndex, physicalNodeId) => {
    const logicalNodeId = renderBindingIndex.logicalNodeIdByPhysicalNodeId.get(physicalNodeId);
    if (!logicalNodeId) failAudit('PHYSICAL_NODE_BINDING_MISSING', physicalNodeId);
    return logicalNodeId;
};

const physicalNodeIdsForLogicalNodes = (renderBindingIndex, logicalNodeIds) => {
    const physicalNodeIds = new Set();
    logicalNodeIds.forEach((logicalNodeId) => {
        const boundPhysicalNodeIds = renderBindingIndex.physicalNodeIdsByLogicalNodeId.get(
            logicalNodeId,
        );
        if (!boundPhysicalNodeIds?.length) {
            failAudit('LOGICAL_NODE_BINDING_MISSING', logicalNodeId);
        }
        boundPhysicalNodeIds.forEach((physicalNodeId) => physicalNodeIds.add(physicalNodeId));
    });
    return physicalNodeIds;
};

const requireTopologyRenderBindingCoverage = (topologyIndex, renderBindingIndex) => {
    const physicalNodeIds = new Set(topologyIndex.nodeById.keys());
    if (physicalNodeIds.size !== renderBindingIndex.logicalNodeIdByPhysicalNodeId.size) {
        failAudit('TOPOLOGY_RENDER_BINDING_COUNT_MISMATCH');
    }
    physicalNodeIds.forEach((physicalNodeId) => {
        requireLogicalNodeIdForPhysicalNode(renderBindingIndex, physicalNodeId);
    });
};

const normalizePoint = (point, bounds) => Object.freeze({
    x: clamp((point.x - bounds.minX) / bounds.width),
    y: clamp((point.y - bounds.minY) / bounds.height),
});

const largestGap = (sortedValues, domain = 1, circular = false) => {
    if (!sortedValues.length) return domain;
    if (sortedValues.length === 1) return domain;
    let maximum = circular
        ? ((sortedValues[0] + domain) - sortedValues.at(-1))
        : Math.max(sortedValues[0], domain - sortedValues.at(-1));
    for (let index = 1; index < sortedValues.length; index += 1) {
        maximum = Math.max(maximum, sortedValues[index] - sortedValues[index - 1]);
    }
    return maximum;
};

const collectSpatialStats = (descriptors, geometryById, bounds, renderBindingIndex) => {
    const geometries = descriptors.flatMap((descriptor) => {
        const physicalNodeIds = renderBindingIndex.physicalNodeIdsByLogicalNodeId.get(
            descriptor.nodeId,
        );
        if (!physicalNodeIds?.length) {
            failAudit('LOGICAL_NODE_BINDING_MISSING', descriptor.nodeId);
        }
        return physicalNodeIds.map((physicalNodeId) => {
            const geometry = geometryById.get(physicalNodeId);
            if (!geometry) failAudit('PHYSICAL_NODE_GEOMETRY_MISSING', physicalNodeId);
            return geometry;
        });
    });
    const points = geometries
        .map((geometry) => normalizePoint({ x: geometry.endX, y: geometry.endY }, bounds));
    const gridCounts = Array.from({ length: GRID_SIZE * GRID_SIZE }, () => 0);
    const bandCounts = makeBandCounts();
    const spatialSideCounts = makeSideCounts();
    const xCenter = clamp((0 - bounds.minX) / bounds.width);
    const centerEpsilon = 0.02;
    points.forEach((point) => {
        const xIndex = Math.min(GRID_SIZE - 1, Math.floor(point.x * GRID_SIZE));
        const yIndex = Math.min(GRID_SIZE - 1, Math.floor(point.y * GRID_SIZE));
        gridCounts[(yIndex * GRID_SIZE) + xIndex] += 1;
        bandCounts[horizontalBand(point.x)] += 1;
        spatialSideCounts[
            point.x < (xCenter - centerEpsilon)
                ? 'left'
                : (point.x > (xCenter + centerEpsilon) ? 'right' : 'center')
        ] += 1;
    });
    const occupiedCells = gridCounts.filter((count) => count > 0).length;
    const entropy = points.length > 1
        ? -sum(gridCounts.filter(Boolean).map((count) => {
            const probability = count / points.length;
            return probability * Math.log(probability);
        })) / Math.log(Math.min(points.length, gridCounts.length))
        : 0;
    const polarAngles = geometries
        .map((geometry) => {
            const angle = Math.atan2(geometry.endY, geometry.endX);
            return angle < 0 ? angle + (Math.PI * 2) : angle;
        })
        .sort((left, right) => left - right);
    const occupiedSectors = new Set(polarAngles.map((angle) => Math.min(
        POLAR_SECTOR_COUNT - 1,
        Math.floor((angle / (Math.PI * 2)) * POLAR_SECTOR_COUNT),
    ))).size;
    const xValues = points.map((point) => point.x).sort((left, right) => left - right);
    const sideDenominator = spatialSideCounts.left + spatialSideCounts.right;
    return Object.freeze({
        pointCount: points.length,
        gridSize: GRID_SIZE,
        occupiedGridCells: occupiedCells,
        gridOccupancyRatio: round(occupiedCells / gridCounts.length),
        emptyGridRatio: round(1 - (occupiedCells / gridCounts.length)),
        normalizedGridEntropy: round(entropy),
        horizontalBands: Object.freeze(bandCounts),
        spatialSides: Object.freeze(spatialSideCounts),
        spatialSideImbalance: round(
            Math.abs(spatialSideCounts.left - spatialSideCounts.right)
            / Math.max(1, sideDenominator),
        ),
        polarSectorCount: POLAR_SECTOR_COUNT,
        occupiedPolarSectors: occupiedSectors,
        emptyPolarSectorRatio: round(1 - (occupiedSectors / POLAR_SECTOR_COUNT)),
        largestPolarGapRatio: round(largestGap(polarAngles, Math.PI * 2, true) / (Math.PI * 2)),
        largestHorizontalGapRatio: round(largestGap(xValues)),
    });
};

const collectLocalAngleStats = (descriptors) => {
    const angles = descriptors.map((descriptor) => Number(descriptor.angleOffset) || 0);
    const binEdges = [-Infinity, -0.8, -0.4, -0.12, 0.12, 0.4, 0.8, Infinity];
    const binCounts = Array.from({ length: binEdges.length - 1 }, () => 0);
    angles.forEach((angle) => {
        const index = binEdges.findIndex((edge, candidateIndex) => (
            candidateIndex < binEdges.length - 1
            && angle >= edge
            && angle < binEdges[candidateIndex + 1]
        ));
        binCounts[Math.max(0, index)] += 1;
    });
    return Object.freeze({
        count: angles.length,
        mean: round(mean(angles)),
        meanAbsolute: round(mean(angles.map(Math.abs))),
        standardDeviation: round(stdDev(angles)),
        min: angles.length ? round(Math.min(...angles)) : 0,
        max: angles.length ? round(Math.max(...angles)) : 0,
        binEdges: Object.freeze(['-inf', -0.8, -0.4, -0.12, 0.12, 0.4, 0.8, 'inf']),
        binCounts: Object.freeze(binCounts),
        occupiedBinRatio: round(binCounts.filter(Boolean).length / binCounts.length),
    });
};

const collectOccupancyStats = (state, selectedIds) => {
    const descriptors = Object.values(state.candidateGraph);
    const candidateByParentRole = new Map();
    const selectedByParentRole = new Map();
    const candidateByCohort = new Map();
    const selectedByCohort = new Map();
    const increment = (map, key) => map.set(key, (map.get(key) || 0) + 1);
    descriptors.filter((descriptor) => descriptor.role !== 'trunk').forEach((descriptor) => {
        const parentRoleKey = descriptor.parentId + '|' + descriptor.role;
        increment(candidateByParentRole, parentRoleKey);
        increment(candidateByCohort, descriptor.cohortId);
        if (selectedIds.has(descriptor.nodeId)) {
            increment(selectedByParentRole, parentRoleKey);
            increment(selectedByCohort, descriptor.cohortId);
        }
    });
    const parentFillRatios = [...candidateByParentRole].map(([key, count]) => (
        (selectedByParentRole.get(key) || 0) / count
    ));
    const cohortFillRatios = [...candidateByCohort].map(([key, count]) => (
        (selectedByCohort.get(key) || 0) / count
    ));
    const roleCoverage = Object.fromEntries(ROLE_IDS.map((role) => {
        const candidates = descriptors.filter((descriptor) => descriptor.role === role).length;
        const selected = descriptors.filter((descriptor) => (
            descriptor.role === role && selectedIds.has(descriptor.nodeId)
        )).length;
        return [role, Object.freeze({ candidates, selected, ratio: round(selected / Math.max(1, candidates)) })];
    }));
    return Object.freeze({
        parentRoleGroupCount: candidateByParentRole.size,
        occupiedParentRoleGroupCount: selectedByParentRole.size,
        meanParentRoleFillRatio: round(mean(parentFillRatios)),
        maxSelectedSiblings: Math.max(0, ...selectedByParentRole.values()),
        cohortCount: candidateByCohort.size,
        occupiedCohortCount: selectedByCohort.size,
        meanCohortFillRatio: round(mean(cohortFillRatios)),
        maxSelectedInCohort: Math.max(0, ...selectedByCohort.values()),
        roleCoverage: Object.freeze(roleCoverage),
    });
};

const collectAttachmentStats = (state, selectedIds) => {
    const descriptors = Object.values(state.candidateGraph);
    const maxTrunkDepth = Math.max(
        1,
        ...descriptors.filter((descriptor) => descriptor.role === 'trunk')
            .map((descriptor) => descriptor.roleDepth),
    );
    const positions = descriptors.filter((descriptor) => {
        const parent = state.candidateGraph[descriptor.parentId];
        return descriptor.role === 'scaffold'
            && parent?.role === 'trunk'
            && selectedIds.has(descriptor.nodeId);
    }).map((descriptor) => {
        const parent = state.candidateGraph[descriptor.parentId];
        return clamp(((parent.roleDepth - 1) + descriptor.attachT) / maxTrunkDepth);
    }).sort((left, right) => left - right);
    return Object.freeze({
        selectedRootScaffoldCount: positions.length,
        normalizedTrunkPositions: Object.freeze(positions.map((value) => round(value))),
        largestTrunkAttachmentGapRatio: round(largestGap(positions)),
    });
};

const makeTerminalRoleEntry = () => ({
    carrierCount: 0,
    flowerCarrierCount: 0,
    terminalCount: 0,
    flowerTerminalCount: 0,
    leafTerminalCount: 0,
});

const collectTerminalDistribution = ({
    nodeById,
    includedPhysicalNodeIds,
    state,
    geometryIndex,
    renderBindingIndex,
}) => {
    const result = {
        carrierCount: 0,
        flowerCarrierCount: 0,
        terminalCount: 0,
        flowerTerminalCount: 0,
        leafTerminalCount: 0,
        byRole: makeRoleCounts(makeTerminalRoleEntry),
        bySide: Object.fromEntries(SIDE_IDS.map((side) => [side, makeTerminalRoleEntry()])),
        byHorizontalBand: Object.fromEntries(
            HORIZONTAL_BANDS.map((band) => [band, makeTerminalRoleEntry()]),
        ),
        flowerStages: { bud: 0, half_open: 0, full: 0, other: 0 },
    };
    const incrementEntry = (entry, terminals, flowerCount, leafCount) => {
        entry.carrierCount += terminals.length > 0 ? 1 : 0;
        entry.flowerCarrierCount += flowerCount > 0 ? 1 : 0;
        entry.terminalCount += terminals.length;
        entry.flowerTerminalCount += flowerCount;
        entry.leafTerminalCount += leafCount;
    };
    includedPhysicalNodeIds.forEach((physicalNodeId) => {
        const logicalNodeId = requireLogicalNodeIdForPhysicalNode(
            renderBindingIndex,
            physicalNodeId,
        );
        const node = nodeById.get(physicalNodeId);
        if (!node) failAudit('PHYSICAL_NODE_MISSING', physicalNodeId);
        const descriptor = state.candidateGraph[logicalNodeId];
        if (!descriptor) failAudit('LOGICAL_NODE_DESCRIPTOR_MISSING', logicalNodeId);
        const terminals = Array.isArray(node.terminals) ? node.terminals : [];
        const flowers = terminals.filter((terminal) => terminal?.type === 'flower');
        const leaves = terminals.filter((terminal) => terminal?.type === 'leaf');
        if (terminals.length > 0) result.carrierCount += 1;
        if (flowers.length > 0) result.flowerCarrierCount += 1;
        result.terminalCount += terminals.length;
        result.flowerTerminalCount += flowers.length;
        result.leafTerminalCount += leaves.length;
        const side = sideId(descriptor.side);
        const geometry = geometryIndex.geometryById.get(physicalNodeId);
        if (!geometry) failAudit('PHYSICAL_NODE_GEOMETRY_MISSING', physicalNodeId);
        const point = normalizePoint(
            { x: geometry.endX, y: geometry.endY },
            geometryIndex.bounds,
        );
        const band = horizontalBand(point.x);
        incrementEntry(result.byRole[descriptor.role], terminals, flowers.length, leaves.length);
        incrementEntry(result.bySide[side], terminals, flowers.length, leaves.length);
        incrementEntry(result.byHorizontalBand[band], terminals, flowers.length, leaves.length);
        flowers.forEach((terminal) => {
            const bloomStage = terminal?.blossom?.bloomStage;
            const key = ['bud', 'half_open', 'full'].includes(bloomStage) ? bloomStage : 'other';
            result.flowerStages[key] += 1;
        });
    });
    return Object.freeze({
        ...result,
        byRole: Object.freeze(result.byRole),
        bySide: Object.freeze(result.bySide),
        byHorizontalBand: Object.freeze(result.byHorizontalBand),
        flowerStages: Object.freeze(result.flowerStages),
    });
};

const collectSelectionMetrics = ({
    state,
    sourceIndex,
    projectedTopology,
    renderBindingIndex,
}) => {
    const selectedIds = selectedIdsForRole(state);
    const selectedPhysicalNodeIds = physicalNodeIdsForLogicalNodes(
        renderBindingIndex,
        selectedIds,
    );
    const selectedDescriptors = [...selectedIds].map((nodeId) => state.candidateGraph[nodeId]);
    const scaffoldDescriptors = selectedDescriptors.filter((descriptor) => descriptor.role === 'scaffold');
    const twigDescriptors = selectedDescriptors.filter((descriptor) => descriptor.role === 'twig');
    const canopyDescriptors = [...scaffoldDescriptors, ...twigDescriptors];
    const selectedByRole = Object.fromEntries(ROLE_IDS.map((role) => [
        role,
        selectedDescriptors.filter((descriptor) => descriptor.role === role).length,
    ]));
    const sideByRole = Object.fromEntries(['scaffold', 'twig'].map((role) => {
        const counts = makeSideCounts();
        selectedDescriptors.filter((descriptor) => descriptor.role === role)
            .forEach((descriptor) => { counts[sideId(descriptor.side)] += 1; });
        const denominator = counts.left + counts.right;
        return [role, Object.freeze({
            ...counts,
            imbalance: round(Math.abs(counts.left - counts.right) / Math.max(1, denominator)),
            signedBalance: round((counts.right - counts.left) / Math.max(1, denominator)),
        })];
    }));
    const projectedIndex = indexTopology(projectedTopology);
    const presentedPhysicalNodeIds = new Set(projectedIndex.nodeById.keys());
    const presentedLogicalNodeIds = new Set([...presentedPhysicalNodeIds].map((physicalNodeId) => (
        requireLogicalNodeIdForPhysicalNode(renderBindingIndex, physicalNodeId)
    )));
    return Object.freeze({
        selectedByRole: Object.freeze(selectedByRole),
        sideByRole: Object.freeze(sideByRole),
        localAngles: Object.freeze({
            scaffold: collectLocalAngleStats(scaffoldDescriptors),
            twig: collectLocalAngleStats(twigDescriptors),
        }),
        occupancy: collectOccupancyStats(state, selectedIds),
        attachments: collectAttachmentStats(state, selectedIds),
        spatialCanopy: collectSpatialStats(
            canopyDescriptors,
            sourceIndex.geometryById,
            sourceIndex.bounds,
            renderBindingIndex,
        ),
        terminals: Object.freeze({
            selectedPotential: collectTerminalDistribution({
                nodeById: sourceIndex.nodeById,
                includedPhysicalNodeIds: selectedPhysicalNodeIds,
                state,
                geometryIndex: sourceIndex,
                renderBindingIndex,
            }),
            presented: collectTerminalDistribution({
                nodeById: projectedIndex.nodeById,
                includedPhysicalNodeIds: presentedPhysicalNodeIds,
                state,
                geometryIndex: sourceIndex,
                renderBindingIndex,
            }),
        }),
        presentedLogicalNodeCount: presentedLogicalNodeIds.size,
        presentedPhysicalNodeCount: presentedPhysicalNodeIds.size,
        presentedLogicalNodeIds: Object.freeze([...presentedLogicalNodeIds].sort()),
        presentedPhysicalNodeIds: Object.freeze([...presentedPhysicalNodeIds].sort()),
    });
};

const compactProjectionDiagnostics = (diagnostics) => Object.freeze({
    growthProgress: diagnostics.growthProgress,
    projectionGrowthProgress: diagnostics.projectionGrowthProgress,
    candidateNodes: diagnostics.candidateNodes,
    bornNodes: diagnostics.bornNodes,
    candidateTerminals: diagnostics.candidateTerminals,
    bornTerminals: diagnostics.bornTerminals,
    candidateFlowerTerminals: diagnostics.candidateFlowerTerminals,
    bornFlowerTerminals: diagnostics.bornFlowerTerminals,
    lineagePendingNodes: diagnostics.lineagePendingNodes,
    lineagePresentationPendingNodes: diagnostics.lineagePresentationPendingNodes,
    widthClampedNodes: diagnostics.widthClampedNodes,
    meanNodeAge: diagnostics.meanNodeAge,
    meanNodeGirthAge: diagnostics.meanNodeGirthAge,
    meanFlowerAge: diagnostics.meanFlowerAge,
});

const validateCheckpoint = ({ state, previousState, checkpoint, projectedLogicalNodeIds }) => {
    const violations = [];
    const candidateIds = new Set(Object.keys(state.candidateGraph));
    const decisionIds = new Set(Object.keys(state.decisions));
    const selectedIds = selectedIdsForRole(state);
    if (!isSubset(decisionIds, candidateIds)) violations.push('decision_not_candidate_subset');
    if (!isSubset(projectedLogicalNodeIds, selectedIds)) {
        violations.push('presented_not_selected_subset');
    }
    selectedIds.forEach((nodeId) => {
        const parentId = state.candidateGraph[nodeId]?.parentId;
        if (parentId && !selectedIds.has(parentId)) {
            violations.push('selected_parent_missing:' + nodeId);
        }
    });
    if (round(state.maxObservedGrowth) !== round(checkpoint.growth)) {
        violations.push('growth_clock_mismatch');
    }
    if (previousState) {
        const previousSelected = selectedIdsForRole(previousState);
        if (!isSubset(previousSelected, selectedIds)) violations.push('selected_set_not_monotonic');
        if (state.stateRevision !== previousState.stateRevision + 1) {
            violations.push('state_revision_not_sequential');
        }
        Object.entries(previousState.decisions).forEach(([nodeId, decision]) => {
            if (JSON.stringify(state.decisions[nodeId]) !== JSON.stringify(decision)) {
                violations.push('decision_rewritten:' + nodeId);
            }
        });
    } else if (state.stateRevision !== 1) {
        violations.push('bootstrap_revision_not_one');
    }
    return violations;
};

const executeSequence = ({ candidate, history, collectMetrics }) => {
    const sourceIndex = indexTopology(candidate.topology);
    const renderBindingIndex = indexLineageRenderBinding(
        candidate.preparedCandidate.renderBinding,
    );
    requireTopologyRenderBindingCoverage(sourceIndex, renderBindingIndex);
    const states = [];
    const checkpoints = [];
    const violations = [];
    let state = null;
    CHECKPOINTS.forEach((checkpoint, checkpointIndex) => {
        const lifeState = makeLifeState(history, checkpointIndex);
        const previousState = state;
        state = previousState
            ? reconcileZenBonsaiClassic2LineageState({
                previousState,
                topology: candidate.topology,
                treeIdentity: candidate.treeIdentity,
                preparedCandidate: candidate.preparedCandidate,
                lifeState,
                source: ZEN_BONSAI_CLASSIC2_LINEAGE_SOURCES.EPHEMERAL_PREVIEW_RECONCILE,
            })
            : bootstrapZenBonsaiClassic2LineageState({
                topology: candidate.topology,
                treeIdentity: candidate.treeIdentity,
                preparedCandidate: candidate.preparedCandidate,
                lifeState,
                source: ZEN_BONSAI_CLASSIC2_LINEAGE_SOURCES.EPHEMERAL_PREVIEW_BOOTSTRAP,
            });
        states.push(state);
        if (!collectMetrics) return;
        const projected = projectZenBonsaiClassic2DevelopmentTopology({
            topology: candidate.topology,
            lifeState,
            projection: null,
            lineageState: state,
            lineageRenderBinding: candidate.preparedCandidate.renderBinding,
            requireLineage: true,
            woodClockPolicy: ZEN_BONSAI_CLASSIC2_WOOD_CLOCK_POLICIES.PERSISTED_HISTORY,
        });
        const selection = collectSelectionMetrics({
            state,
            sourceIndex,
            projectedTopology: projected.topology,
            renderBindingIndex,
        });
        const checkpointViolations = validateCheckpoint({
            state,
            previousState,
            checkpoint,
            projectedLogicalNodeIds: new Set(selection.presentedLogicalNodeIds),
        });
        violations.push(...checkpointViolations.map((violation) => (
            'g' + checkpoint.growthStage + ':' + violation
        )));
        const lineageSummary = summarizeZenBonsaiClassic2LineageState(state);
        checkpoints.push(Object.freeze({
            ...checkpoint,
            stateRevision: state.stateRevision,
            decisionDigest: digestJson(state.decisions),
            lifeHistoryInput: Object.freeze({
                growthSegmentIds: Object.freeze(lifeState.growthSegments.map((segment) => segment.id)),
                structuralImprint: lifeState.structuralImprint,
                latestSegment: lifeState.growthSegments.at(-1),
                vitality: lifeState.vitality,
                bloom: lifeState.bloom,
            }),
            lineage: Object.freeze({
                selectedCount: lineageSummary.selectedCount,
                pendingCount: lineageSummary.pendingCount,
                byRole: lineageSummary.byRole,
            }),
            selection,
            projection: compactProjectionDiagnostics(projected.diagnostics),
            invariantViolations: Object.freeze(checkpointViolations),
        }));
    });
    return { state, states, checkpoints, violations };
};

const runHistory = ({ candidate, history }) => {
    const primary = executeSequence({ candidate, history, collectMetrics: true });
    const replay = executeSequence({ candidate, history, collectMetrics: false });
    const replayCheckpointEqual = primary.states.map((state, index) => (
        JSON.stringify(state) === JSON.stringify(replay.states[index])
    ));
    const replayViolations = replayCheckpointEqual.flatMap((equal, index) => (
        equal ? [] : ['g' + CHECKPOINTS[index].growthStage + ':deterministic_replay_mismatch']
    ));
    const violations = [...primary.violations, ...replayViolations];
    return {
        seed: candidate.seed,
        historyId: history.id,
        historyLabel: history.label,
        treeFingerprint: primary.state.treeFingerprint,
        treeIdentityFingerprint: primary.state.treeIdentityFingerprint,
        logicalCandidateCount: Object.keys(primary.state.candidateGraph).length,
        physicalNodeCount: candidate.preparedCandidate.physicalNodeCount,
        physicalTrunkSpanCount: candidate.preparedCandidate.physicalTrunkSpanCount,
        lineageContract: primary.state.contract,
        finalStateRevision: primary.state.stateRevision,
        finalSerializedStateBytes: Buffer.byteLength(JSON.stringify(primary.state), 'utf8'),
        finalDecisionDigest: digestJson(primary.state.decisions),
        checkpoints: primary.checkpoints,
        replay: Object.freeze({
            allCheckpointsEqual: replayCheckpointEqual.every(Boolean),
            checkpointEqual: Object.freeze(replayCheckpointEqual),
            finalStateDigest: digestJson(primary.state),
        }),
        invariantViolations: Object.freeze(violations),
        _finalState: primary.state,
    };
};

const summarizeCandidate = (candidate) => {
    const graph = candidate.preparedCandidate.candidateGraph;
    const descriptors = Object.values(graph);
    const sourceIndex = indexTopology(candidate.topology);
    const sourcePhysicalNodeIds = new Set(sourceIndex.nodeById.keys());
    const renderBindingIndex = indexLineageRenderBinding(
        candidate.preparedCandidate.renderBinding,
    );
    requireTopologyRenderBindingCoverage(sourceIndex, renderBindingIndex);
    const pseudoState = { candidateGraph: graph };
    return Object.freeze({
        seed: candidate.seed,
        treeFingerprint: candidate.preparedCandidate.treeFingerprint,
        treeIdentityFingerprint: candidate.preparedCandidate.treeIdentityFingerprint,
        logicalCandidateCount: descriptors.length,
        physicalNodeCount: candidate.preparedCandidate.physicalNodeCount,
        physicalTrunkSpanCount: candidate.preparedCandidate.physicalTrunkSpanCount,
        byRole: Object.freeze(Object.fromEntries(ROLE_IDS.map((role) => [
            role,
            descriptors.filter((descriptor) => descriptor.role === role).length,
        ]))),
        fullTopologyTerminals: collectTerminalDistribution({
            nodeById: sourceIndex.nodeById,
            includedPhysicalNodeIds: sourcePhysicalNodeIds,
            state: pseudoState,
            geometryIndex: sourceIndex,
            renderBindingIndex,
        }),
        bounds: sourceIndex.bounds,
    });
};

const generateHighDensityPersistenceEnvelope = (seed) => {
    const phenotype = compileSakuraPhenotypeFromLatent({
        ...getDefaultSakuraLatent(),
        vigor: 1,
        scaffold_density: 1,
        scaffold_upper_coverage: 1,
        scaffold_node_twig_prob: 0.98,
        twig_node_budget_cap: 40,
        twig_spawn_min_width: 0.08,
        ramification_density: 1,
        internode_scale: 0.5,
        negative_space_target: 0.05,
    });
    const topology = SakuraSpecies.generateTopology(
        new SeededRandom(seed),
        resolveZenBonsaiClassic2DisplayCandidateStage({
            baseStage: BASE_STAGE,
            structureDepth: HIGH_DENSITY_STRUCTURE_DEPTH,
        }),
        TOPOLOGY_REFERENCE_HEIGHT,
        phenotype,
    );
    const treeIdentity = {
        contract: 'zen_bonsai_classic2_candidate_identity_v1',
        identityRevision: 1,
        treeType: 'sakura',
        treeSeed: seed,
        structureDepth: HIGH_DENSITY_STRUCTURE_DEPTH,
        structureMode: 'high_density_audit',
        topologyReferenceHeight: TOPOLOGY_REFERENCE_HEIGHT,
        canonicalLatent: { version: 1, signature: 'high-density-audit' },
        generationInputs: { learningProgress: 0, canopyDistributionProfile: {} },
    };
    const preparedCandidate = prepareZenBonsaiClassic2LineageCandidate({
        topology,
        treeIdentity,
    });
    const state = bootstrapZenBonsaiClassic2LineageState({
        preparedCandidate,
        lifeState: makeLifeState(HISTORY_DEFINITIONS[1], CHECKPOINTS.length - 1),
        source: ZEN_BONSAI_CLASSIC2_LINEAGE_SOURCES.EPHEMERAL_PREVIEW_BOOTSTRAP,
    });
    return Object.freeze({
        seed,
        logicalCandidateCount: preparedCandidate.candidateCount,
        physicalNodeCount: preparedCandidate.physicalNodeCount,
        physicalTrunkSpanCount: preparedCandidate.physicalTrunkSpanCount,
        decisionCount: Object.keys(state.decisions).length,
        serializedStateBytes: Buffer.byteLength(JSON.stringify(state), 'utf8'),
    });
};

const compareHistoryPair = (leftRun, rightRun) => {
    const leftState = leftRun._finalState;
    const rightState = rightRun._finalState;
    const selected = selectedIdsForRole(leftState);
    const rightSelected = selectedIdsForRole(rightState);
    const scaffold = selectedIdsForRole(leftState, 'scaffold');
    const rightScaffold = selectedIdsForRole(rightState, 'scaffold');
    const twig = selectedIdsForRole(leftState, 'twig');
    const rightTwig = selectedIdsForRole(rightState, 'twig');
    return Object.freeze({
        seed: leftRun.seed,
        leftHistoryId: leftRun.historyId,
        rightHistoryId: rightRun.historyId,
        sameCandidateFingerprint: leftRun.treeFingerprint === rightRun.treeFingerprint,
        selectedJaccardDistance: jaccardDistance(selected, rightSelected),
        scaffoldJaccardDistance: jaccardDistance(scaffold, rightScaffold),
        twigJaccardDistance: jaccardDistance(twig, rightTwig),
        selectedSymmetricDifference: symmetricDifferenceSize(selected, rightSelected),
        scaffoldSymmetricDifference: symmetricDifferenceSize(scaffold, rightScaffold),
        twigSymmetricDifference: symmetricDifferenceSize(twig, rightTwig),
        selectedCountDelta: rightSelected.size - selected.size,
        scaffoldCountDelta: rightScaffold.size - scaffold.size,
        twigCountDelta: rightTwig.size - twig.size,
    });
};

const aggregateRunMetric = (runs, path) => stats(runs.map((run) => getPath(run, path)));
const aggregateHistories = (runs) => HISTORY_DEFINITIONS.map((history) => {
    const historyRuns = runs.filter((run) => run.historyId === history.id);
    const finals = historyRuns.map((run) => run.checkpoints.at(-1));
    return Object.freeze({
        historyId: history.id,
        historyLabel: history.label,
        selectedScaffolds: aggregateRunMetric(finals, ['selection', 'selectedByRole', 'scaffold']),
        selectedTwigs: aggregateRunMetric(finals, ['selection', 'selectedByRole', 'twig']),
        scaffoldLocalSideImbalance: aggregateRunMetric(finals, ['selection', 'sideByRole', 'scaffold', 'imbalance']),
        canopySpatialSideImbalance: aggregateRunMetric(finals, ['selection', 'spatialCanopy', 'spatialSideImbalance']),
        canopyGridOccupancyRatio: aggregateRunMetric(finals, ['selection', 'spatialCanopy', 'gridOccupancyRatio']),
        canopyGridEntropy: aggregateRunMetric(finals, ['selection', 'spatialCanopy', 'normalizedGridEntropy']),
        emptyPolarSectorRatio: aggregateRunMetric(finals, ['selection', 'spatialCanopy', 'emptyPolarSectorRatio']),
        largestHorizontalGapRatio: aggregateRunMetric(finals, ['selection', 'spatialCanopy', 'largestHorizontalGapRatio']),
        rootScaffoldAttachmentGap: aggregateRunMetric(finals, ['selection', 'attachments', 'largestTrunkAttachmentGapRatio']),
        presentedTerminalCarriers: aggregateRunMetric(finals, ['selection', 'terminals', 'presented', 'carrierCount']),
        presentedFlowerCarriers: aggregateRunMetric(finals, ['selection', 'terminals', 'presented', 'flowerCarrierCount']),
        presentedTerminals: aggregateRunMetric(finals, ['selection', 'terminals', 'presented', 'terminalCount']),
        presentedFlowers: aggregateRunMetric(finals, ['selection', 'terminals', 'presented', 'flowerTerminalCount']),
    });
});

const aggregateCheckpoints = (runs) => HISTORY_DEFINITIONS.flatMap((history) => (
    CHECKPOINTS.map((checkpoint, checkpointIndex) => {
        const entries = runs.filter((run) => run.historyId === history.id)
            .map((run) => run.checkpoints[checkpointIndex]);
        return Object.freeze({
            historyId: history.id,
            growthStage: checkpoint.growthStage,
            growth: checkpoint.growth,
            selectedScaffolds: aggregateRunMetric(entries, ['selection', 'selectedByRole', 'scaffold']),
            selectedTwigs: aggregateRunMetric(entries, ['selection', 'selectedByRole', 'twig']),
            presentedLogicalNodes: aggregateRunMetric(
                entries,
                ['selection', 'presentedLogicalNodeCount'],
            ),
            presentedPhysicalNodes: aggregateRunMetric(
                entries,
                ['selection', 'presentedPhysicalNodeCount'],
            ),
            presentedFlowerCarriers: aggregateRunMetric(entries, ['selection', 'terminals', 'presented', 'flowerCarrierCount']),
            presentedFlowers: aggregateRunMetric(entries, ['selection', 'terminals', 'presented', 'flowerTerminalCount']),
            scaffoldLocalSideImbalance: aggregateRunMetric(entries, ['selection', 'sideByRole', 'scaffold', 'imbalance']),
            canopyGridOccupancyRatio: aggregateRunMetric(entries, ['selection', 'spatialCanopy', 'gridOccupancyRatio']),
        });
    })
));

const aggregateDivergence = (comparisons) => {
    const groups = new Map();
    comparisons.forEach((comparison) => {
        const key = comparison.leftHistoryId + '|' + comparison.rightHistoryId;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(comparison);
    });
    return [...groups.values()].map((entries) => Object.freeze({
        leftHistoryId: entries[0].leftHistoryId,
        rightHistoryId: entries[0].rightHistoryId,
        seedCount: entries.length,
        selectedJaccardDistance: stats(entries.map((entry) => entry.selectedJaccardDistance)),
        scaffoldJaccardDistance: stats(entries.map((entry) => entry.scaffoldJaccardDistance)),
        twigJaccardDistance: stats(entries.map((entry) => entry.twigJaccardDistance)),
        selectedSymmetricDifference: stats(entries.map((entry) => entry.selectedSymmetricDifference)),
        nonZeroDivergenceSeedCount: entries.filter((entry) => entry.selectedSymmetricDifference > 0).length,
    }));
};

const runAudit = () => {
    const candidates = SEEDS.map(generateCandidate);
    const highDensityPersistenceEnvelope = SEEDS.map(generateHighDensityPersistenceEnvelope);
    const internalRuns = candidates.flatMap((candidate) => HISTORY_DEFINITIONS.map((history) => (
        runHistory({ candidate, history })
    )));
    const historyComparisons = candidates.flatMap((candidate) => {
        const seedRuns = internalRuns.filter((run) => run.seed === candidate.seed);
        const comparisons = [];
        for (let leftIndex = 0; leftIndex < seedRuns.length; leftIndex += 1) {
            for (let rightIndex = leftIndex + 1; rightIndex < seedRuns.length; rightIndex += 1) {
                comparisons.push(compareHistoryPair(seedRuns[leftIndex], seedRuns[rightIndex]));
            }
        }
        return comparisons;
    });
    const publicRuns = internalRuns.map(({ _finalState, ...run }) => run);
    const invariantViolations = publicRuns.flatMap((run) => run.invariantViolations.map((violation) => ({
        seed: run.seed,
        historyId: run.historyId,
        violation,
    })));
    const candidateFingerprintViolations = SEEDS.flatMap((seed) => {
        const fingerprints = new Set(
            internalRuns.filter((run) => run.seed === seed).map((run) => run.treeFingerprint),
        );
        return fingerprints.size === 1 ? [] : [{ seed, violation: 'candidate_fingerprint_varies_by_history' }];
    });
    const historyTopologyViolations = historyComparisons
        .filter((comparison) => comparison.selectedSymmetricDifference !== 0)
        .map((comparison) => ({
            seed: comparison.seed,
            historyId: comparison.leftHistoryId + '|' + comparison.rightHistoryId,
            violation: 'development_history_changed_branch_membership',
        }));
    const allViolations = [
        ...invariantViolations,
        ...candidateFingerprintViolations,
        ...historyTopologyViolations,
    ];
    return Object.freeze({
        auditVersion: AUDIT_VERSION,
        generatedAt: new Date().toISOString(),
        model: 'classic2',
        modelDisplayName: 'Main · Classic2',
        scope: 'pure development-lineage recording and Classic2 development projection; no Canvas/Pixi rendering',
        configuration: Object.freeze({
            seeds: SEEDS,
            histories: HISTORY_DEFINITIONS.map(({ segments, ...history }) => ({
                ...history,
                segmentCount: segments.length,
                segments: segments.map((values, index) => ({
                    id: history.id + ':g' + CHECKPOINTS[index].growthStage,
                    milestone: CHECKPOINTS[index].growthStage,
                    stressWood: values[0],
                    recoveryWood: values[1],
                    volatility: values[2],
                    canopyReserve: values[3],
                    healthH: values[4],
                })),
            })),
            checkpoints: CHECKPOINTS,
            structureDepth: STRUCTURE_DEPTH,
            topologyReferenceHeight: TOPOLOGY_REFERENCE_HEIGHT,
            gridSize: GRID_SIZE,
            polarSectorCount: POLAR_SECTOR_COUNT,
        }),
        measurementContracts: Object.freeze({
            candidateGeneration: 'SakuraSpecies.generateTopology with Classic2 display candidate stage',
            historyReplay: 'one stable cumulative segment ledger per history, reconciled in ascending growth order',
            developmentRecording: 'all parent-causal candidates receive one persisted selected-status development record grouped by canonical descriptor role',
            lineageRenderBinding: 'prepared candidate binding maps every physical render node to its logical lineage decision node; projection subset checks compare logical IDs only',
            sideBalance: 'descriptor angleOffset sign; spatial side also measured from reconstructed endpoint x',
            geometry: 'BranchGeometryModel traversal over the immutable final candidate blueprint',
            occupancy: GRID_SIZE + 'x' + GRID_SIZE + ' endpoint grid normalized to each seed candidate bounds',
            negativeSpace: 'empty endpoint grid/polar sectors plus largest normalized horizontal and trunk-attachment gaps',
            terminals: 'physical source/render carriers resolved through the prepared logical lineage render binding',
            historyTopologyInvariance: 'same-seed final recorded-set Jaccard distance and symmetric difference must remain zero',
            persistenceCost: 'UTF-8 byte length of each final normalized lineage state',
        }),
        candidates: Object.freeze(candidates.map(summarizeCandidate)),
        highDensityPersistenceEnvelope: Object.freeze(highDensityPersistenceEnvelope),
        runs: Object.freeze(publicRuns),
        finalHistoryAggregates: Object.freeze(aggregateHistories(publicRuns)),
        checkpointAggregates: Object.freeze(aggregateCheckpoints(publicRuns)),
        historyDivergence: Object.freeze({
            comparisons: Object.freeze(historyComparisons),
            pairAggregates: Object.freeze(aggregateDivergence(historyComparisons)),
            overallSelectedJaccardDistance: stats(
                historyComparisons.map((comparison) => comparison.selectedJaccardDistance),
            ),
            nonZeroComparisonCount: historyComparisons.filter(
                (comparison) => comparison.selectedSymmetricDifference > 0,
            ).length,
        }),
        invariants: Object.freeze({
            allPassed: allViolations.length === 0,
            runCount: publicRuns.length,
            checkpointCount: publicRuns.length * CHECKPOINTS.length,
            replayRunCount: publicRuns.filter((run) => run.replay.allCheckpointsEqual).length,
            monotonicSelectionRunCount: publicRuns.filter((run) => (
                !run.invariantViolations.some((violation) => violation.includes('not_monotonic'))
            )).length,
            exactOnceDecisionRunCount: publicRuns.filter((run) => (
                !run.invariantViolations.some((violation) => violation.includes('decision_rewritten'))
            )).length,
            subsetClosureRunCount: publicRuns.filter((run) => (
                !run.invariantViolations.some((violation) => (
                    violation.includes('subset') || violation.includes('parent_missing')
                ))
            )).length,
            candidateFingerprintStableSeedCount: SEEDS.length - candidateFingerprintViolations.length,
            historyTopologyStableComparisonCount:
                historyComparisons.length - historyTopologyViolations.length,
            violations: Object.freeze(allViolations),
        }),
        limitations: Object.freeze([
            'Five deterministic seeds expose distribution tendencies but are not a population-level statistical proof.',
            'Histories are controlled synthetic ledgers, not sampled production cultivation records.',
            'Endpoint occupancy and gap metrics are structural proxies; they do not simulate light, occlusion, leaf area, or renderer pixels.',
            'Spatial metrics use the immutable full candidate geometry so histories are comparable; checkpoint branch length maturation is reported separately by the development diagnostics.',
            'Local angle bins use edge angleOffset, while spatial proxies use reconstructed global endpoints; neither is a direct aesthetic-quality score.',
            'Terminal potential counts recorded source carriers; presented counts apply Classic2 birth/age projection with a mature neutral projection plan and the lineage growth clock.',
            'The audit tests deterministic replay in one implementation/build, not cross-version or migrated persistence replay.',
        ]),
    });
};

const formatRange = (metric, digits = 3) => (
    round(metric.mean, digits) + ' [' + round(metric.min, digits) + ', ' + round(metric.max, digits) + ']'
);

const buildReport = (manifest) => {
    const invariant = manifest.invariants;
    const candidateRows = manifest.candidates.map((candidate) => [
        candidate.seed,
        candidate.logicalCandidateCount,
        candidate.physicalNodeCount,
        candidate.physicalTrunkSpanCount,
        candidate.byRole.trunk,
        candidate.byRole.scaffold,
        candidate.byRole.twig,
        candidate.fullTopologyTerminals.carrierCount,
        candidate.fullTopologyTerminals.flowerCarrierCount,
        candidate.fullTopologyTerminals.flowerTerminalCount,
    ]);
    const finalRows = manifest.finalHistoryAggregates.map((entry) => [
        entry.historyId,
        formatRange(entry.selectedScaffolds, 2),
        formatRange(entry.selectedTwigs, 2),
        formatRange(entry.scaffoldLocalSideImbalance),
        formatRange(entry.canopySpatialSideImbalance),
        formatRange(entry.canopyGridOccupancyRatio),
        formatRange(entry.emptyPolarSectorRatio),
        formatRange(entry.largestHorizontalGapRatio),
        formatRange(entry.presentedTerminalCarriers, 2),
        formatRange(entry.presentedFlowerCarriers, 2),
        formatRange(entry.presentedFlowers, 2),
    ]);
    const checkpointRows = manifest.checkpointAggregates.map((entry) => [
        entry.historyId,
        entry.growthStage,
        entry.growth,
        formatRange(entry.selectedScaffolds, 2),
        formatRange(entry.selectedTwigs, 2),
        formatRange(entry.presentedLogicalNodes, 2),
        formatRange(entry.presentedPhysicalNodes, 2),
        formatRange(entry.presentedFlowerCarriers, 2),
        formatRange(entry.presentedFlowers, 2),
    ]);
    const divergenceRows = manifest.historyDivergence.pairAggregates.map((entry) => [
        entry.leftHistoryId,
        entry.rightHistoryId,
        entry.nonZeroDivergenceSeedCount + '/' + entry.seedCount,
        formatRange(entry.selectedJaccardDistance),
        formatRange(entry.scaffoldJaccardDistance),
        formatRange(entry.twigJaccardDistance),
        formatRange(entry.selectedSymmetricDifference, 2),
    ]);
    const perRunRows = manifest.runs.map((run) => {
        const final = run.checkpoints.at(-1);
        return [
            run.seed,
            run.historyId,
            final.selection.selectedByRole.scaffold,
            final.selection.selectedByRole.twig,
            final.selection.sideByRole.scaffold.imbalance,
            final.selection.spatialCanopy.spatialSideImbalance,
            final.selection.spatialCanopy.gridOccupancyRatio,
            final.selection.spatialCanopy.largestHorizontalGapRatio,
            final.selection.terminals.presented.carrierCount,
            final.selection.terminals.presented.flowerCarrierCount,
            final.selection.terminals.presented.flowerTerminalCount,
            run.finalDecisionDigest,
        ];
    });
    const lineageContracts = [...new Set(
        manifest.runs.map((run) => run.lineageContract),
    )];
    const serializedStateBytes = stats(
        manifest.runs.map((run) => run.finalSerializedStateBytes),
    );
    const highDensityLogicalCandidateCount = stats(
        manifest.highDensityPersistenceEnvelope.map((entry) => entry.logicalCandidateCount),
    );
    const highDensityPhysicalNodeCount = stats(
        manifest.highDensityPersistenceEnvelope.map((entry) => entry.physicalNodeCount),
    );
    const highDensityPhysicalTrunkSpanCount = stats(
        manifest.highDensityPersistenceEnvelope.map((entry) => entry.physicalTrunkSpanCount),
    );
    const highDensityStateBytes = stats(
        manifest.highDensityPersistenceEnvelope.map((entry) => entry.serializedStateBytes),
    );
    const table = (headers, rows) => [
        '| ' + headers.join(' | ') + ' |',
        '| ' + headers.map(() => '---').join(' | ') + ' |',
        ...rows.map((row) => '| ' + row.join(' | ') + ' |'),
    ];
    return [
        '# Classic2 Development-Lineage Distribution Audit',
        '',
        'Generated: `' + manifest.generatedAt + '`',
        '',
        'This is an isolated pure-model audit over ' + manifest.configuration.seeds.length
            + ' seeds, ' + manifest.configuration.histories.length + ' deterministic histories, and '
            + manifest.configuration.checkpoints.length + ' sequential growth checkpoints. It does not use the existing growth snapshot matrix or Canvas/Pixi rendering.',
        '',
        '## Invariants',
        '',
        '- Overall: **' + (invariant.allPassed ? 'PASS' : 'FAIL') + '**',
        '- Deterministic replay: ' + invariant.replayRunCount + '/' + invariant.runCount + ' runs',
        '- Monotonic recorded set: ' + invariant.monotonicSelectionRunCount + '/' + invariant.runCount + ' runs',
        '- Exact-once development records: ' + invariant.exactOnceDecisionRunCount + '/' + invariant.runCount + ' runs',
        '- Candidate/presentation subset and parent closure: ' + invariant.subsetClosureRunCount + '/' + invariant.runCount + ' runs',
        '- Candidate fingerprint stable across histories: ' + invariant.candidateFingerprintStableSeedCount
            + '/' + manifest.configuration.seeds.length + ' seeds',
        '- Branch membership stable across histories: '
            + invariant.historyTopologyStableComparisonCount + '/'
            + manifest.historyDivergence.comparisons.length + ' comparisons',
        '- Evaluated checkpoints: ' + invariant.checkpointCount,
        '- Violations: ' + invariant.violations.length,
        '',
        '## Active Policy and Persistence Cost',
        '',
        '- Release lineage contract: `' + lineageContracts.join(', ') + '`',
        '- Final normalized state bytes: ' + formatRange(serializedStateBytes, 0),
        '- Depth-8 high-density logical candidate count: '
            + formatRange(highDensityLogicalCandidateCount, 0),
        '- Depth-8 high-density physical node count: '
            + formatRange(highDensityPhysicalNodeCount, 0),
        '- Depth-8 high-density physical trunk span count: '
            + formatRange(highDensityPhysicalTrunkSpanCount, 0),
        '- Depth-8 high-density state bytes: ' + formatRange(highDensityStateBytes, 0),
        '- Audit sessions accept only the exact release lineage contract; there is no schema migration or historical-policy interpretation path.',
        '',
        '## Candidate Blueprint Distribution',
        '',
        ...table(
            [
                'seed', 'logical nodes', 'physical nodes', 'physical trunk spans',
                'trunk', 'scaffold', 'twig', 'terminal carriers', 'flower carriers', 'flowers',
            ],
            candidateRows,
        ),
        '',
        '## Final Distribution by History',
        '',
        'Values are `mean [min, max]` across seeds.',
        '',
        ...table([
            'history', 'scaffolds', 'twigs', 'local side imbalance', 'spatial side imbalance',
            'grid occupancy', 'empty polar sectors', 'largest x gap', 'terminal carriers',
            'flower carriers', 'flowers',
        ], finalRows),
        '',
        '## Sequential Checkpoints',
        '',
        'Values are `mean [min, max]` across seeds.',
        '',
        ...table([
            'history', 'growth stage', 'growth', 'selected scaffolds', 'selected twigs',
            'presented logical nodes', 'presented physical nodes', 'flower carriers',
            'presented flowers',
        ], checkpointRows),
        '',
        '## Same-seed History Divergence',
        '',
        'Jaccard distance is `0` for identical recorded branch sets and `1` for disjoint sets. The development-lineage contract requires every value here to remain `0`; history may change observation provenance and projected morphology, not membership. Values are `mean [min, max]` across seeds.',
        '',
        ...table([
            'left history', 'right history', 'nonzero seeds', 'all selected Jaccard',
            'scaffold Jaccard', 'twig Jaccard', 'symmetric difference',
        ], divergenceRows),
        '',
        '- Overall recorded-set Jaccard distance: '
            + formatRange(manifest.historyDivergence.overallSelectedJaccardDistance),
        '- Nonzero same-seed history comparisons: ' + manifest.historyDivergence.nonZeroComparisonCount
            + '/' + manifest.historyDivergence.comparisons.length,
        '',
        '## Per-seed Final Trace',
        '',
        ...table([
            'seed', 'history', 'scaffolds', 'twigs', 'local side imbalance', 'spatial side imbalance',
            'grid occupancy', 'largest x gap', 'terminal carriers', 'flower carriers', 'flowers', 'decision digest',
        ], perRunRows),
        '',
        '## Measurement Notes',
        '',
        '- Side balance is reported twice: canonical descriptor `angleOffset` sign and reconstructed endpoint x relative to the trunk root.',
        '- Occupancy uses a ' + GRID_SIZE + 'x' + GRID_SIZE + ' endpoint grid normalized to each seed\'s immutable candidate bounds.',
        '- Negative-space proxies are empty grid/polar sectors, largest horizontal endpoint gap, and largest trunk scaffold attachment gap.',
        '- `selectedPotential` is a retained diagnostic field name; it counts carriers on recorded source nodes. `presented` counts terminals actually born under Classic2 presentation at that checkpoint.',
        '- Logical lineage decisions and physical render nodes are joined only through the prepared `renderBinding`; physical trunk tessellation spans are not counted as separate lineage candidates.',
        '- Exact synthetic segment inputs, cumulative imprint snapshots, per-role/side/horizontal-band/blossom-stage/cohort metrics, and checkpoint records are in `manifest.json`.',
        '',
        '## Limitations',
        '',
        ...manifest.limitations.map((limitation) => '- ' + limitation),
        '',
        '## Files',
        '',
        '- `manifest.json`: machine-readable inputs, checkpoints, metrics, divergence, digests, and invariants',
        '- `report.md`: human-readable aggregate and trace tables',
        '',
    ].join('\n');
};

await rm(OUT_DIR, { recursive: true, force: true });
await mkdir(OUT_DIR, { recursive: true });
const manifest = runAudit();
await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
await writeFile(REPORT_PATH, buildReport(manifest), 'utf8');

console.log(JSON.stringify({
    outDir: OUT_DIR,
    allInvariantsPassed: manifest.invariants.allPassed,
    runs: manifest.invariants.runCount,
    checkpoints: manifest.invariants.checkpointCount,
    historyComparisons: manifest.historyDivergence.comparisons.length,
    nonZeroHistoryComparisons: manifest.historyDivergence.nonZeroComparisonCount,
    meanHistoryJaccardDistance: manifest.historyDivergence.overallSelectedJaccardDistance.mean,
}, null, 2));
