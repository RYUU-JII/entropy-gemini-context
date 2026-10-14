import {
    isSakuraMacroSpineShapeIdV1,
    isSakuraScaffoldStationLineageIdV1,
} from './SakuraMacroLineageIdentityContract.js';

export const ZEN_BONSAI_CLASSIC2_CANDIDATE_GRAPH_CONTRACT = (
    'classic2_macro_lineage_graph_v2'
);
export const ZEN_BONSAI_CLASSIC2_CANDIDATE_GRAPH_NODE_BUDGET = 2400;
const ZEN_BONSAI_CLASSIC2_CANDIDATE_ANGLE_DECIMAL_PLACES = 6;

const FNV_OFFSET = 2166136261;
const FNV_PRIME = 16777619;

const ROLE_BRANCH_ORDERS = Object.freeze({
    trunk: Object.freeze([0]),
    scaffold: Object.freeze([1, 2]),
    twig: Object.freeze([3]),
});

const BASE_DESCRIPTOR_KEYS = Object.freeze([
    'nodeId',
    'parentId',
    'role',
    'branchOrder',
    'roleDepth',
    'traversalDepth',
    'attachT',
    'angleOffset',
    'side',
    'cohortId',
    'length',
    'width',
    'childIds',
]);

const TRUNK_DESCRIPTOR_KEYS = Object.freeze([
    ...BASE_DESCRIPTOR_KEYS,
    'trunkGuideShapeId',
    'trunkArcStart',
    'trunkArcEnd',
]);

const NODE_ID_PATTERN = /^[A-Za-z0-9_.:-]{1,180}$/;
const RESERVED_IDS = new Set(['__proto__', 'prototype', 'constructor']);

const isPlainObject = (value) => Boolean(
    value
    && typeof value === 'object'
    && !Array.isArray(value),
);

const isCanonicalId = (value) => (
    typeof value === 'string'
    && value === value.trim()
    && NODE_ID_PATTERN.test(value)
    && !RESERVED_IDS.has(value)
);

const hasExactKeys = (value, expectedKeys) => {
    if (!isPlainObject(value)) return false;
    const actualKeys = Object.keys(value).sort();
    const canonicalKeys = [...expectedKeys].sort();
    return actualKeys.length === canonicalKeys.length
        && actualKeys.every((key, index) => key === canonicalKeys[index]);
};

const isSafePositiveDepth = (value) => (
    Number.isSafeInteger(value) && value >= 1
);

const isFinitePositive = (value) => (
    typeof value === 'number' && Number.isFinite(value) && value > 0
);

const resolveCanonicalSide = (angleOffset) => (
    angleOffset < -1e-6 ? -1 : (angleOffset > 1e-6 ? 1 : 0)
);

const inspectCandidateAngleDescriptor = (rawAngleOffset) => {
    if (typeof rawAngleOffset !== 'number' || !Number.isFinite(rawAngleOffset)) {
        return null;
    }
    const roundedAngleOffset = Number(rawAngleOffset.toFixed(
        ZEN_BONSAI_CLASSIC2_CANDIDATE_ANGLE_DECIMAL_PLACES,
    ));
    const angleOffset = Object.is(roundedAngleOffset, -0) ? 0 : roundedAngleOffset;
    return Object.freeze({
        angleOffset,
        side: resolveCanonicalSide(angleOffset),
    });
};

export const resolveZenBonsaiClassic2CandidateAngleDescriptor = (rawAngleOffset) => {
    const descriptor = inspectCandidateAngleDescriptor(rawAngleOffset);
    if (!descriptor) {
        throw new Error('ZEN_BONSAI_CLASSIC2_CANDIDATE_ANGLE_OFFSET_INVALID');
    }
    return descriptor;
};

const hashText = (value) => {
    const source = String(value);
    let hash = FNV_OFFSET;
    for (let index = 0; index < source.length; index += 1) {
        hash ^= source.charCodeAt(index);
        hash = Math.imul(hash, FNV_PRIME);
    }
    return hash >>> 0;
};

export const validateZenBonsaiClassic2CandidateDescriptor = (nodeId, value) => {
    if (!isCanonicalId(nodeId) || !isPlainObject(value) || value.nodeId !== nodeId) {
        return false;
    }
    const branchOrders = ROLE_BRANCH_ORDERS[value.role];
    if (!branchOrders) return false;
    const expectedKeys = value.role === 'trunk'
        ? TRUNK_DESCRIPTOR_KEYS
        : BASE_DESCRIPTOR_KEYS;
    if (!hasExactKeys(value, expectedKeys)) return false;
    if (
        value.parentId !== null
        && (!isCanonicalId(value.parentId) || value.parentId === nodeId)
    ) {
        return false;
    }
    const canonicalAngleDescriptor = inspectCandidateAngleDescriptor(value.angleOffset);
    if (
        !Number.isInteger(value.branchOrder)
        || !branchOrders.includes(value.branchOrder)
        || !isSafePositiveDepth(value.roleDepth)
        || !isSafePositiveDepth(value.traversalDepth)
        || typeof value.attachT !== 'number'
        || !Number.isFinite(value.attachT)
        || value.attachT < 0
        || value.attachT > 1
        || !canonicalAngleDescriptor
        || !Object.is(canonicalAngleDescriptor.angleOffset, value.angleOffset)
        || !Number.isInteger(value.side)
        || value.side !== canonicalAngleDescriptor.side
        || !isCanonicalId(value.cohortId)
        || !isFinitePositive(value.length)
        || !isFinitePositive(value.width)
        || !Array.isArray(value.childIds)
    ) {
        return false;
    }
    const childIds = new Set();
    for (const [index, childId] of value.childIds.entries()) {
        if (
            !isCanonicalId(childId)
            || childId === nodeId
            || childIds.has(childId)
            || (index > 0 && value.childIds[index - 1].localeCompare(childId) > 0)
        ) {
            return false;
        }
        childIds.add(childId);
    }
    if (value.role !== 'trunk') return true;
    return (
        value.parentId === null
        && value.roleDepth === 1
        && value.traversalDepth === 1
        && value.attachT === 0
        && value.angleOffset === 0
        && value.side === 0
        && isSakuraMacroSpineShapeIdV1(value.trunkGuideShapeId)
        && typeof value.trunkArcStart === 'number'
        && Number.isFinite(value.trunkArcStart)
        && typeof value.trunkArcEnd === 'number'
        && Number.isFinite(value.trunkArcEnd)
        && value.trunkArcStart === 0
        && value.trunkArcEnd === 1
    );
};

const inspectCandidateGraph = (candidateGraph) => {
    if (!isPlainObject(candidateGraph)) return null;
    const nodeIds = Object.keys(candidateGraph).sort();
    if (
        nodeIds.length === 0
        || nodeIds.length > ZEN_BONSAI_CLASSIC2_CANDIDATE_GRAPH_NODE_BUDGET
    ) {
        return null;
    }
    if (!nodeIds.every((nodeId) => (
        validateZenBonsaiClassic2CandidateDescriptor(
            nodeId,
            candidateGraph[nodeId],
        )
    ))) {
        return null;
    }
    const rootIds = nodeIds.filter((nodeId) => (
        candidateGraph[nodeId].parentId === null
    ));
    if (rootIds.length !== 1) return null;
    const rootNodeId = rootIds[0];
    const root = candidateGraph[rootNodeId];
    if (root.role !== 'trunk') return null;

    const expectedChildIdsByNode = new Map(
        nodeIds.map((nodeId) => [nodeId, []]),
    );
    for (const nodeId of nodeIds) {
        const parentId = candidateGraph[nodeId].parentId;
        if (parentId === null) continue;
        const expectedChildIds = expectedChildIdsByNode.get(parentId);
        if (!expectedChildIds) return null;
        expectedChildIds.push(nodeId);
    }

    for (const nodeId of nodeIds) {
        const descriptor = candidateGraph[nodeId];
        const expectedChildIds = expectedChildIdsByNode.get(nodeId);
        if (
            descriptor.childIds.length !== expectedChildIds.length
            || descriptor.childIds.some((childId, index) => (
                childId !== expectedChildIds[index]
            ))
        ) {
            return null;
        }
        if (descriptor.parentId === null) continue;
        const parent = candidateGraph[descriptor.parentId];
        if (
            !parent
            || descriptor.traversalDepth !== parent.traversalDepth + 1
        ) {
            return null;
        }
        if (parent.role === 'trunk') {
            if (
                descriptor.role !== 'scaffold'
                || descriptor.roleDepth !== 1
                || !isSakuraScaffoldStationLineageIdV1(descriptor.nodeId)
                || !descriptor.cohortId.startsWith('scaffold_root:')
            ) {
                return null;
            }
            continue;
        }
        if (parent.role === 'scaffold') {
            if (!['scaffold', 'twig'].includes(descriptor.role)) return null;
            if (
                descriptor.role === 'scaffold'
                && descriptor.roleDepth !== parent.roleDepth + 1
            ) {
                return null;
            }
            if (descriptor.role === 'twig' && descriptor.roleDepth !== 1) {
                return null;
            }
            continue;
        }
        if (
            parent.role !== 'twig'
            || descriptor.role !== 'twig'
            || descriptor.roleDepth !== parent.roleDepth + 1
        ) {
            return null;
        }
    }

    const visited = new Set();
    const pending = [rootNodeId];
    while (pending.length > 0) {
        const nodeId = pending.pop();
        if (visited.has(nodeId)) return null;
        visited.add(nodeId);
        const childIds = candidateGraph[nodeId].childIds;
        for (let index = childIds.length - 1; index >= 0; index -= 1) {
            pending.push(childIds[index]);
        }
    }
    if (visited.size !== nodeIds.length) return null;
    return Object.freeze({ rootNodeId, nodeIds: Object.freeze(nodeIds) });
};

export const validateZenBonsaiClassic2CandidateGraph = (candidateGraph) => (
    inspectCandidateGraph(candidateGraph) !== null
);

export const resolveZenBonsaiClassic2CandidateGraphRootNodeId = (
    candidateGraph,
) => {
    const inspection = inspectCandidateGraph(candidateGraph);
    if (!inspection) {
        throw new Error('ZEN_BONSAI_CLASSIC2_CANDIDATE_GRAPH_INVALID');
    }
    return inspection.rootNodeId;
};

export const resolveZenBonsaiClassic2CandidateGraphFingerprint = (
    rootNodeId,
    candidateGraph,
) => {
    const inspection = inspectCandidateGraph(candidateGraph);
    if (!inspection || inspection.rootNodeId !== rootNodeId) {
        throw new Error('ZEN_BONSAI_CLASSIC2_CANDIDATE_GRAPH_INVALID');
    }
    const source = JSON.stringify({
        rootNodeId,
        nodes: inspection.nodeIds.map((nodeId) => candidateGraph[nodeId]),
    });
    return `classic2_tree_v1:${hashText(source).toString(16).padStart(8, '0')}`;
};
