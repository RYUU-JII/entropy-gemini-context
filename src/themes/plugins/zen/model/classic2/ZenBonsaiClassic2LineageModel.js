import { SAKURA_BRANCH_ORDER } from '../bonsai/generation/shapePriorModel.js';
import {
    ZEN_BONSAI_CLASSIC2_SCORE_FEATURE_CONTRACT_VERSION,
    ZEN_BONSAI_CLASSIC2_SCORE_FEATURE_SOURCE,
    ZEN_BONSAI_CLASSIC2_SCORE_MODEL_VERSION,
    createZenBonsaiClassic2LineageScoringFeatureContext,
    registerZenBonsaiClassic2SelectedScoringFeature,
    resolveZenBonsaiClassic2LineageScoringFeatures,
} from './ZenBonsaiClassic2LineageScoringPolicy.js';
import {
    resolveZenBonsaiClassic2TreeIdentityEnvelope,
    resolveZenBonsaiClassic2TreeIdentityFingerprint,
    resolveZenBonsaiClassic2TreeIdentityRevision,
} from '../../contracts/ZenBonsaiClassic2IdentityContract.js';
import {
    ZEN_BONSAI_CLASSIC2_CANDIDATE_GRAPH_CONTRACT,
    ZEN_BONSAI_CLASSIC2_CANDIDATE_GRAPH_NODE_BUDGET,
    resolveZenBonsaiClassic2CandidateAngleDescriptor,
    resolveZenBonsaiClassic2CandidateGraphFingerprint,
    resolveZenBonsaiClassic2CandidateGraphRootNodeId,
    validateZenBonsaiClassic2CandidateGraph,
    validateZenBonsaiClassic2CandidateDescriptor,
} from '../../contracts/ZenBonsaiClassic2CandidateGraphContract.js';
import {
    requireSakuraTrunkMacroLineage,
    requireSakuraTrunkMacroRenderAttestation,
    resolveSakuraTrunkPhysicalGeometryFingerprint,
} from '../sakura/sakuraTrunkMacroLineageContract.js';
import { requireSakuraScaffoldRootArcAttachment } from '../sakura/sakuraScaffoldArcStationPlan.js';

export {
    resolveZenBonsaiClassic2TreeIdentityFingerprint,
    resolveZenBonsaiClassic2TreeIdentityRevision,
};

export const ZEN_BONSAI_CLASSIC2_LINEAGE_CONTRACT = 'classic2_development_lineage_release_v1';
export const ZEN_BONSAI_CLASSIC2_LINEAGE_POLICY_VERSION = 'classic2_development_lineage_release_v1';
export const ZEN_BONSAI_CLASSIC2_LINEAGE_CANDIDATE_BUDGET = (
    ZEN_BONSAI_CLASSIC2_CANDIDATE_GRAPH_NODE_BUDGET
);
export const ZEN_BONSAI_CLASSIC2_PHYSICAL_TRAVERSAL_BUDGET = 2448;
const ZEN_BONSAI_CLASSIC2_PHYSICAL_TRAVERSAL_DEPTH_BUDGET = 512;
export const ZEN_BONSAI_CLASSIC2_TRUNK_ARC_REFERENCE_SEGMENTS = 30;

export const ZEN_BONSAI_CLASSIC2_LINEAGE_SOURCES = Object.freeze({
    EXPLICIT_FIRST_RUN_BOOTSTRAP: 'explicit_first_run_bootstrap',
    EXPLICIT_IDENTITY_ROTATION: 'explicit_identity_rotation',
    EPHEMERAL_PREVIEW_BOOTSTRAP: 'ephemeral_preview_bootstrap',
    EPHEMERAL_PREVIEW_IDENTITY_ROTATION: 'ephemeral_preview_identity_rotation',
    DURABLE_MAIN_RECONCILE: 'durable_main_reconcile',
    EPHEMERAL_PREVIEW_RECONCILE: 'ephemeral_preview_reconcile',
});

export const ZEN_BONSAI_CLASSIC2_LINEAGE_DECISION_STATUS = Object.freeze({
    SELECTED: 'selected',
});

export const ZEN_BONSAI_CLASSIC2_LINEAGE_ROLES = Object.freeze({
    TRUNK: 'trunk',
    SCAFFOLD: 'scaffold',
    TWIG: 'twig',
});
export const ZEN_BONSAI_CLASSIC2_LINEAGE_DEVELOPMENT_POLICY = Object.freeze({
    version: 'classic2_development_lineage_release_v1',
    candidateAdmission: 'all_parent_causal',
    habitTopologyEffect: 'none',
    habitDevelopmentEffect: 'bounded_projection',
});

export const ZEN_BONSAI_CLASSIC2_LINEAGE_CANDIDATE_DISPOSITIONS = Object.freeze({
    SELECTED: 'selected',
    PENDING: 'pending',
});

// Release-V1 lineage records keep their original latent timing domain so the
// exact-once contract stays stable. The canonical user-visible lifecycle floor
// is owned by ZenBonsaiCultivationPolicy and may sit later on this schedule.
export const ZEN_BONSAI_CLASSIC2_LIFECYCLE_GROWTH_DOMAIN = Object.freeze({
    floor: 0.28,
    ceiling: 1,
});

// These thresholds are stored in the release-V1 lineage record domain. They
// are the former normalized development spans scaled across [0.28, 1].
export const ZEN_BONSAI_CLASSIC2_ROLE_READINESS = Object.freeze({
    trunk: 0.00432,
    scaffold: 0.0648,
    twig: 0.072,
});

export const ZEN_BONSAI_CLASSIC2_ROLE_MATURATION_SPAN = Object.freeze({
    trunk: 0.1296,
    scaffold: 0.1584,
    twig: 0.1296,
});

const BIRTH_JITTER_SPAN = Object.freeze({ trunk: 0.00108, scaffold: 0.00864, twig: 0.0072 });
const TRUNK_ARC_RECORD_SPAN = (
    (ZEN_BONSAI_CLASSIC2_TRUNK_ARC_REFERENCE_SEGMENTS - 1)
    * (ZEN_BONSAI_CLASSIC2_ROLE_READINESS.trunk + (BIRTH_JITTER_SPAN.trunk * 0.5))
);
const DEVELOPMENT_RECORD_CEILING = 0.94;
const BOOTSTRAP_HIGH_GROWTH_THRESHOLD = 0.65;
const STATE_KIND = 'zen_bonsai_classic2_lineage_state';
const NORMALIZED_STATE_BRAND = new WeakSet();
const PREPARED_CANDIDATE_BRAND = new WeakSet();
const RENDER_BINDING_BRAND = new WeakSet();
const DERIVED_CANDIDATE_ANALYSIS_CACHE = new WeakMap();
const FNV_OFFSET = 2166136261;
const FNV_PRIME = 16777619;
const SOURCE_VALUES = new Set(Object.values(ZEN_BONSAI_CLASSIC2_LINEAGE_SOURCES));
const BOOTSTRAP_SOURCE_VALUES = new Set([
    ZEN_BONSAI_CLASSIC2_LINEAGE_SOURCES.EXPLICIT_FIRST_RUN_BOOTSTRAP,
    ZEN_BONSAI_CLASSIC2_LINEAGE_SOURCES.EXPLICIT_IDENTITY_ROTATION,
    ZEN_BONSAI_CLASSIC2_LINEAGE_SOURCES.EPHEMERAL_PREVIEW_BOOTSTRAP,
    ZEN_BONSAI_CLASSIC2_LINEAGE_SOURCES.EPHEMERAL_PREVIEW_IDENTITY_ROTATION,
]);
const RECONCILE_SOURCE_VALUES = new Set([
    ZEN_BONSAI_CLASSIC2_LINEAGE_SOURCES.DURABLE_MAIN_RECONCILE,
    ZEN_BONSAI_CLASSIC2_LINEAGE_SOURCES.EPHEMERAL_PREVIEW_RECONCILE,
]);
const STATUS_VALUES = new Set(Object.values(ZEN_BONSAI_CLASSIC2_LINEAGE_DECISION_STATUS));
const LINEAGE_STATE_KEYS = Object.freeze([
    'kind',
    'contract',
    'candidateGraphContract',
    'candidateCarrierMetadata',
    'candidateCarrierFingerprint',
    'treeFingerprint',
    'treeIdentityFingerprint',
    'identityRevision',
    'stateRevision',
    'maxObservedGrowth',
    'bootstrap',
    'candidateGraph',
    'decisions',
]);
const LINEAGE_BOOTSTRAP_KEYS = Object.freeze([
    'source',
    'initialObservedGrowth',
    'initialIdentityRevision',
    'initialStateRevision',
    'rotatedFromTreeFingerprint',
    'rotatedFromTreeIdentityFingerprint',
    'rotatedFromIdentityRevision',
    'rotatedFromStateRevision',
    'highGrowthBootstrap',
]);
const LINEAGE_CARRIER_METADATA_KEYS = Object.freeze([
    'terminalCount',
    'flowerTerminalCount',
]);
const LINEAGE_DECISION_KEYS = Object.freeze([
    'nodeId',
    'parentId',
    'role',
    'status',
    'birthProgress',
    'matureProgress',
    'provenance',
]);
const LINEAGE_PROVENANCE_KEYS = Object.freeze([
    'policyVersion',
    'source',
    'treeFingerprint',
    'identityRevision',
    'stateRevision',
    'cohortId',
    'historySegmentRef',
    'selectionMethod',
    'score',
    'scoreBreakdown',
    'scoreModelVersion',
    'featureContractVersion',
    'featureSource',
    'scoreInputFingerprint',
    'scoreSignals',
    'reason',
]);
const RENDER_BINDING_CONTRACT = 'classic2_macro_lineage_render_binding_v1';

const fail = (code, detail = '') => {
    throw new Error(`ZEN_BONSAI_CLASSIC2_LINEAGE_${code}${detail ? `:${detail}` : ''}`);
};
const isPlainObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const hasExactKeys = (value, expectedKeys) => {
    if (!isPlainObject(value)) return false;
    const actualKeys = Object.keys(value).sort();
    const canonicalKeys = [...expectedKeys].sort();
    return actualKeys.length === canonicalKeys.length
        && actualKeys.every((key, index) => key === canonicalKeys[index]);
};
const clamp01 = (value) => Math.min(1, Math.max(0, Number(value)));
const round = (value, digits = 6) => Number(Number(value).toFixed(digits));
const requireRatio = (value, code) => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) fail(code);
    return round(value);
};
const requireRevision = (value, code) => {
    if (!Number.isSafeInteger(value) || value < 1) fail(code);
    return value;
};
const requireId = (value, code = 'NODE_ID_INVALID') => {
    if (typeof value !== 'string' || !/^[A-Za-z0-9_.:-]{1,180}$/.test(value.trim())) fail(code);
    const id = value.trim();
    if (id === '__proto__' || id === 'prototype' || id === 'constructor') fail(code);
    return id;
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
const hashUnit = (value) => hashText(value) / 0x100000000;
const digest = (prefix, value) => `${prefix}:${hashText(value).toString(16).padStart(8, '0')}`;

export const resolveZenBonsaiClassic2TrunkArcRecordProgress = (arcPosition) => round(
    ZEN_BONSAI_CLASSIC2_LIFECYCLE_GROWTH_DOMAIN.floor
    + (clamp01(arcPosition) * TRUNK_ARC_RECORD_SPAN),
);

const resolveTreeIdentityEnvelope = resolveZenBonsaiClassic2TreeIdentityEnvelope;

const resolveRole = (branchOrder) => {
    if (branchOrder === SAKURA_BRANCH_ORDER.TRUNK) return ZEN_BONSAI_CLASSIC2_LINEAGE_ROLES.TRUNK;
    if (branchOrder === SAKURA_BRANCH_ORDER.PRIMARY_BRANCH || branchOrder === SAKURA_BRANCH_ORDER.SECONDARY_BRANCH) {
        return ZEN_BONSAI_CLASSIC2_LINEAGE_ROLES.SCAFFOLD;
    }
    if (branchOrder === SAKURA_BRANCH_ORDER.TERMINAL_TWIG) return ZEN_BONSAI_CLASSIC2_LINEAGE_ROLES.TWIG;
    fail('BRANCH_ORDER_INVALID', String(branchOrder));
};

const requirePhysicalTrunkCurveValue = (node, field, nodeId) => {
    const value = Number(node?.[field]);
    if (!Number.isFinite(value)) {
        fail('CANDIDATE_TRUNK_PHYSICAL_GEOMETRY_INVALID', `${nodeId}.${field}`);
    }
    return value;
};

const resolvePhysicalTrunkGeometryAttestation = ({
    topology,
    trunkRecords,
    macro,
}) => {
    const attestation = requireSakuraTrunkMacroRenderAttestation(
        topology.trunkMacroRenderAttestation,
    );
    if (attestation.guideShapeId !== macro.guideShapeId) {
        fail('CANDIDATE_TRUNK_PHYSICAL_GUIDE_MISMATCH', trunkRecords[0]?.nodeId);
    }
    if (attestation.physicalTrunkSpanCount !== trunkRecords.length) {
        fail(
            'CANDIDATE_TRUNK_PHYSICAL_SPAN_COUNT_MISMATCH',
            `${attestation.physicalTrunkSpanCount}!=${trunkRecords.length}`,
        );
    }
    const physicalTrunkSpans = trunkRecords.map((record, index) => ({
        index,
        entryAngle: index === 0
            ? requirePhysicalTrunkCurveValue(topology, 'initialAngle', record.nodeId)
            : requirePhysicalTrunkCurveValue(record.edge, 'angleOffset', record.nodeId),
        length: record.length,
        width: record.width,
        curve: requirePhysicalTrunkCurveValue(record.node, 'curve', record.nodeId),
        curveIn: requirePhysicalTrunkCurveValue(record.node, 'curveIn', record.nodeId),
        curveOut: requirePhysicalTrunkCurveValue(record.node, 'curveOut', record.nodeId),
        arcStartNorm: requirePhysicalTrunkCurveValue(
            record.node,
            'trunkArcStartNorm',
            record.nodeId,
        ),
        arcEndNorm: requirePhysicalTrunkCurveValue(
            record.node,
            'trunkArcEndNorm',
            record.nodeId,
        ),
    }));
    const geometryFingerprint = resolveSakuraTrunkPhysicalGeometryFingerprint({
        guideShapeId: macro.guideShapeId,
        physicalTrunkSpans,
    });
    if (geometryFingerprint !== attestation.geometryFingerprint) {
        fail('CANDIDATE_TRUNK_PHYSICAL_GEOMETRY_MISMATCH', trunkRecords[0]?.nodeId);
    }
    return Object.freeze({
        attestation,
        geometryFingerprint,
    });
};

const extractCandidate = (topology) => {
    if (!isPlainObject(topology)) fail('TOPOLOGY_REQUIRED');
    const physicalRecords = new Map();
    const physicalNodeIds = new Set();
    const seenObjects = new WeakSet();
    const visiting = new WeakSet();

    const indexPhysical = (node, parent = null, edge = null, physicalDepth = 1) => {
        if (physicalDepth > ZEN_BONSAI_CLASSIC2_PHYSICAL_TRAVERSAL_DEPTH_BUDGET) {
            fail(
                'CANDIDATE_PHYSICAL_DEPTH_EXCEEDED',
                `${physicalDepth}>${ZEN_BONSAI_CLASSIC2_PHYSICAL_TRAVERSAL_DEPTH_BUDGET}`,
            );
        }
        if (!isPlainObject(node) || node.type !== 'branch') fail('CANDIDATE_NODE_MALFORMED');
        if (visiting.has(node)) fail('CANDIDATE_CYCLE');
        if (seenObjects.has(node)) fail('CANDIDATE_SHARED_NODE');
        visiting.add(node);
        seenObjects.add(node);
        const nodeId = requireId(node.nodeId);
        if (physicalNodeIds.has(nodeId)) fail('CANDIDATE_DUPLICATE_NODE_ID', nodeId);
        physicalNodeIds.add(nodeId);
        if (physicalNodeIds.size > ZEN_BONSAI_CLASSIC2_PHYSICAL_TRAVERSAL_BUDGET) {
            fail(
                'CANDIDATE_PHYSICAL_BUDGET_EXCEEDED',
                `${physicalNodeIds.size}>${ZEN_BONSAI_CLASSIC2_PHYSICAL_TRAVERSAL_BUDGET}`,
            );
        }
        const physicalParentId = parent?.nodeId || null;
        if (
            Object.prototype.hasOwnProperty.call(node, 'parentId')
            && node.parentId !== null
            && node.parentId !== undefined
            && requireId(node.parentId, 'CANDIDATE_PARENT_ID_INVALID') !== physicalParentId
        ) {
            fail('CANDIDATE_ORPHAN_NODE', nodeId);
        }
        const branchOrder = Number(node.branchOrder);
        if (!Number.isInteger(branchOrder)) fail('BRANCH_ORDER_INVALID', nodeId);
        const role = resolveRole(branchOrder);
        if (!Array.isArray(node.branches)) fail('CANDIDATE_BRANCHES_REQUIRED', nodeId);
        const terminals = Array.isArray(node.terminals) ? node.terminals : [];
        if (terminals.some((terminal) => !isPlainObject(terminal))) {
            fail('CANDIDATE_TERMINAL_MALFORMED', nodeId);
        }
        const length = Number(node.length);
        const width = Number(node.width);
        if (!Number.isFinite(length) || length <= 0 || !Number.isFinite(width) || width <= 0) {
            fail('CANDIDATE_GEOMETRY_INVALID', nodeId);
        }
        const roleDepthSource = role === ZEN_BONSAI_CLASSIC2_LINEAGE_ROLES.TRUNK
            ? node.trunkMainDepth
            : (role === ZEN_BONSAI_CLASSIC2_LINEAGE_ROLES.TWIG
                ? node.twigDepth
                : node.scaffoldDepth);
        const roleDepth = roleDepthSource === null || roleDepthSource === undefined
            ? physicalDepth
            : Math.floor(Number(roleDepthSource));
        const children = node.branches.map((child) => {
            if (!isPlainObject(child) || !isPlainObject(child.obj)) {
                fail('CANDIDATE_CHILD_MALFORMED', nodeId);
            }
            return child;
        }).sort((left, right) => String(left.obj.nodeId).localeCompare(String(right.obj.nodeId)));
        const record = {
            node,
            nodeId,
            parent,
            edge,
            physicalDepth,
            branchOrder,
            role,
            roleDepth,
            length,
            width,
            terminals,
            children: [],
        };
        physicalRecords.set(node, record);
        record.children = children.map((child) => (
            indexPhysical(child.obj, record, child, physicalDepth + 1)
        ));
        visiting.delete(node);
        return record;
    };

    const rootRecord = indexPhysical(topology);
    if (rootRecord.role !== ZEN_BONSAI_CLASSIC2_LINEAGE_ROLES.TRUNK) {
        fail('ROOT_MUST_BE_TRUNK');
    }
    const trunkRecords = [];
    let trunkCursor = rootRecord;
    while (trunkCursor) {
        trunkRecords.push(trunkCursor);
        const trunkChildren = trunkCursor.children.filter(
            (child) => child.role === ZEN_BONSAI_CLASSIC2_LINEAGE_ROLES.TRUNK,
        );
        if (trunkChildren.length > 1) {
            fail('CANDIDATE_TRUNK_CONTINUATION_AMBIGUOUS', trunkCursor.nodeId);
        }
        trunkCursor = trunkChildren[0] || null;
    }
    if (trunkRecords.length !== [...physicalRecords.values()].filter(
        (entry) => entry.role === ZEN_BONSAI_CLASSIC2_LINEAGE_ROLES.TRUNK,
    ).length) {
        fail('CANDIDATE_TRUNK_SPINE_DISCONNECTED');
    }
    trunkRecords.forEach((record, index) => {
        const start = Number(record.node.trunkArcStartNorm);
        const end = Number(record.node.trunkArcEndNorm);
        if (!Number.isFinite(start) || !Number.isFinite(end)) {
            fail('CANDIDATE_TRUNK_ARC_INCOMPLETE', record.nodeId);
        }
        if (start < 0 || end > 1 || end <= start) {
            fail('CANDIDATE_TRUNK_ARC_INVALID', record.nodeId);
        }
        if (index > 0) {
            const previousEnd = Number(trunkRecords[index - 1].node.trunkArcEndNorm);
            if (Math.abs(start - previousEnd) > 1e-5) {
                fail('CANDIDATE_TRUNK_ARC_DISCONNECTED', record.nodeId);
            }
        }
    });
    if (
        Math.abs(Number(trunkRecords[0].node.trunkArcStartNorm)) > 1e-8
        || Math.abs(Number(trunkRecords.at(-1).node.trunkArcEndNorm) - 1) > 1e-8
    ) {
        fail('CANDIDATE_TRUNK_ARC_INCOMPLETE', rootRecord.nodeId);
    }
    const intermediateTrunkCarrier = trunkRecords.slice(0, -1).find(
        (record) => record.terminals.length > 0,
    );
    if (intermediateTrunkCarrier) {
        fail('CANDIDATE_TRUNK_INTERMEDIATE_TERMINAL_INVALID', intermediateTrunkCarrier.nodeId);
    }

    const macro = requireSakuraTrunkMacroLineage(topology.trunkMacroLineage);
    if (Math.abs(rootRecord.width - macro.baseWidth) > 1e-6) {
        fail('CANDIDATE_TRUNK_MACRO_BASE_WIDTH_MISMATCH', rootRecord.nodeId);
    }
    if (
        isPlainObject(topology.trunkDepthModel)
        && topology.trunkDepthModel.trunkGuideShapeId !== macro.guideShapeId
    ) {
        fail('CANDIDATE_TRUNK_MACRO_GUIDE_MISMATCH', rootRecord.nodeId);
    }
    const physicalTrunkGeometry = resolvePhysicalTrunkGeometryAttestation({
        topology,
        trunkRecords,
        macro,
    });
    const rootNodeId = rootRecord.nodeId;
    const descriptors = new Map();
    const carrierMetadata = new Map();
    const renderNodeBindings = new Map();
    const macroRootDescriptor = {
        nodeId: rootNodeId,
        parentId: null,
        role: ZEN_BONSAI_CLASSIC2_LINEAGE_ROLES.TRUNK,
        branchOrder: SAKURA_BRANCH_ORDER.TRUNK,
        roleDepth: 1,
        traversalDepth: 1,
        attachT: 0,
        angleOffset: 0,
        side: 0,
        cohortId: 'trunk:root',
        length: round(macro.arcLength),
        width: round(macro.baseWidth),
        childIds: [],
        trunkGuideShapeId: requireId(macro.guideShapeId),
        trunkArcStart: 0,
        trunkArcEnd: 1,
    };
    descriptors.set(rootNodeId, macroRootDescriptor);
    const trunkTerminalCount = trunkRecords.reduce(
        (sum, record) => sum + record.terminals.length,
        0,
    );
    const trunkFlowerTerminalCount = trunkRecords.reduce(
        (sum, record) => sum + record.terminals.filter(
            (terminal) => terminal.type === 'flower',
        ).length,
        0,
    );
    carrierMetadata.set(rootNodeId, Object.freeze({
        terminalCount: trunkTerminalCount,
        flowerTerminalCount: trunkFlowerTerminalCount,
    }));
    trunkRecords.forEach((record) => {
        renderNodeBindings.set(record.nodeId, Object.freeze({
            logicalNodeId: rootNodeId,
            role: ZEN_BONSAI_CLASSIC2_LINEAGE_ROLES.TRUNK,
            trunkArcStart: round(record.node.trunkArcStartNorm, 7),
            trunkArcEnd: round(record.node.trunkArcEndNorm, 7),
        }));
    });

    const walkLogical = ({ record, parentDescriptor, logicalDepth, trunkAttachment }) => {
        if (record.role === ZEN_BONSAI_CLASSIC2_LINEAGE_ROLES.TRUNK) {
            fail('CANDIDATE_TRUNK_SPINE_DISCONNECTED', record.nodeId);
        }
        let nodeId = record.nodeId;
        let attachT = Number(record.edge?.t ?? 1);
        let trunkArcAttachment = null;
        if (trunkAttachment) {
            if (record.role !== ZEN_BONSAI_CLASSIC2_LINEAGE_ROLES.SCAFFOLD) {
                fail('CANDIDATE_TRUNK_CHILD_ROLE_INVALID', record.nodeId);
            }
            const attachment = requireSakuraScaffoldRootArcAttachment(
                record.node.scaffoldArcAttachment,
                null,
                macro.guideShapeId,
            );
            const scaffoldRootId = requireId(
                record.node.scaffoldRootId,
                'CANDIDATE_SCAFFOLD_ROOT_ID_INVALID',
            );
            if (attachment.stationId !== scaffoldRootId) {
                fail('CANDIDATE_SCAFFOLD_ROOT_ATTACHMENT_MISMATCH', record.nodeId);
            }
            nodeId = scaffoldRootId;
            attachT = attachment.arcNorm;
            trunkArcAttachment = attachment;
            const renderAttachT = Number(record.edge?.t);
            const renderArcStart = Number(record.parent.node.trunkArcStartNorm);
            const renderArcEnd = Number(record.parent.node.trunkArcEndNorm);
            const reconstructedArc = renderArcStart
                + ((renderArcEnd - renderArcStart) * renderAttachT);
            if (
                !Number.isFinite(reconstructedArc)
                || Math.abs(reconstructedArc - attachment.arcNorm) > 1e-6
            ) {
                fail('CANDIDATE_SCAFFOLD_RENDER_ATTACHMENT_MISMATCH', record.nodeId);
            }
        } else if (Object.prototype.hasOwnProperty.call(record.node, 'scaffoldArcAttachment')) {
            fail('CANDIDATE_SCAFFOLD_ROOT_ATTACHMENT_SCOPE_INVALID', record.nodeId);
        }
        if (descriptors.has(nodeId)) fail('CANDIDATE_DUPLICATE_NODE_ID', nodeId);
        const canonicalAngleDescriptor = resolveZenBonsaiClassic2CandidateAngleDescriptor(
            record.edge?.angleOffset ?? 0,
        );
        if (
            !Number.isFinite(attachT)
            || attachT < 0
            || attachT > 1
        ) {
            fail('CANDIDATE_ATTACHMENT_INVALID', record.nodeId);
        }
        if (
            trunkArcAttachment
            && trunkArcAttachment.side !== canonicalAngleDescriptor.side
        ) {
            fail('CANDIDATE_SCAFFOLD_ROOT_SIDE_MISMATCH', record.nodeId);
        }
        const parentBand = trunkAttachment
            ? Math.min(5, Math.floor(attachT * 6))
            : Math.floor(Math.max(0, parentDescriptor.roleDepth - 1) / 4);
        const cohortId = record.role === ZEN_BONSAI_CLASSIC2_LINEAGE_ROLES.SCAFFOLD
            ? `${trunkAttachment ? 'scaffold_root' : 'scaffold_continuation'}:${record.roleDepth}:b${parentBand}`
            : `twig:${parentDescriptor.nodeId}:${record.roleDepth}`;
        const descriptor = {
            nodeId,
            parentId: parentDescriptor.nodeId,
            role: record.role,
            branchOrder: record.branchOrder,
            roleDepth: record.roleDepth,
            traversalDepth: logicalDepth,
            attachT: round(attachT),
            angleOffset: canonicalAngleDescriptor.angleOffset,
            side: canonicalAngleDescriptor.side,
            cohortId,
            length: round(record.length),
            width: round(record.width),
            childIds: [],
        };
        descriptors.set(nodeId, descriptor);
        renderNodeBindings.set(record.nodeId, Object.freeze({
            logicalNodeId: nodeId,
            role: record.role,
        }));
        carrierMetadata.set(nodeId, Object.freeze({
            terminalCount: record.terminals.length,
            flowerTerminalCount: record.terminals.filter(
                (terminal) => terminal.type === 'flower',
            ).length,
        }));
        descriptor.childIds = record.children.map((childRecord) => walkLogical({
            record: childRecord,
            parentDescriptor: descriptor,
            logicalDepth: logicalDepth + 1,
            trunkAttachment: false,
        }));
        return nodeId;
    };

    trunkRecords.forEach((record) => {
        record.children
            .filter((childRecord) => (
                childRecord.role !== ZEN_BONSAI_CLASSIC2_LINEAGE_ROLES.TRUNK
            ))
            .forEach((childRecord) => {
                macroRootDescriptor.childIds.push(walkLogical({
                    record: childRecord,
                    parentDescriptor: macroRootDescriptor,
                    logicalDepth: 2,
                    trunkAttachment: true,
                }));
            });
    });
    const ordered = [...descriptors.values()].sort(
        (left, right) => left.nodeId.localeCompare(right.nodeId),
    );
    ordered.forEach((entry) => {
        entry.childIds.sort((left, right) => left.localeCompare(right));
        if (!validateZenBonsaiClassic2CandidateDescriptor(entry.nodeId, entry)) {
            fail('CANDIDATE_DESCRIPTOR_INVALID', entry.nodeId);
        }
    });
    if (ordered.length > ZEN_BONSAI_CLASSIC2_LINEAGE_CANDIDATE_BUDGET) {
        fail(
            'CANDIDATE_BUDGET_EXCEEDED',
            `${ordered.length}>${ZEN_BONSAI_CLASSIC2_LINEAGE_CANDIDATE_BUDGET}`,
        );
    }
    const candidateGraph = Object.freeze(Object.fromEntries(ordered.map((entry) => [
        entry.nodeId,
        Object.freeze({ ...entry, childIds: Object.freeze([...entry.childIds]) }),
    ])));
    if (!validateZenBonsaiClassic2CandidateGraph(candidateGraph)) {
        fail('CANDIDATE_GRAPH_INVALID');
    }
    const candidateCarrierMetadata = Object.freeze(Object.fromEntries(
        [...carrierMetadata.entries()].sort(([left], [right]) => left.localeCompare(right)),
    ));
    const renderBinding = Object.freeze({
        contract: RENDER_BINDING_CONTRACT,
        rootPhysicalNodeId: rootRecord.nodeId,
        macroRootNodeId: rootNodeId,
        trunkGuideShapeId: macroRootDescriptor.trunkGuideShapeId,
        physicalNodeCount: physicalRecords.size,
        physicalTrunkSpanCount: trunkRecords.length,
        physicalTrunkGeometryFingerprint: physicalTrunkGeometry.geometryFingerprint,
        nodeBindings: Object.freeze(Object.fromEntries(
            [...renderNodeBindings.entries()].sort(([left], [right]) => left.localeCompare(right)),
        )),
    });
    return Object.freeze({
        rootNodeId,
        candidateGraph,
        candidateCarrierMetadata,
        renderBinding,
    });
};

const fingerprintCandidateCarrierMetadata = (candidateCarrierMetadata) => digest(
    'classic2_carriers_v1',
    JSON.stringify(Object.keys(candidateCarrierMetadata).sort().map((nodeId) => ({
        nodeId,
        ...candidateCarrierMetadata[nodeId],
    }))),
);

export const prepareZenBonsaiClassic2LineageCandidate = ({ topology, treeIdentity } = {}) => {
    const identityEnvelope = resolveTreeIdentityEnvelope(treeIdentity);
    const candidate = extractCandidate(topology);
    const treeFingerprint = resolveZenBonsaiClassic2CandidateGraphFingerprint(
        candidate.rootNodeId,
        candidate.candidateGraph,
    );
    const renderBinding = Object.freeze({
        ...candidate.renderBinding,
        treeFingerprint,
    });
    RENDER_BINDING_BRAND.add(renderBinding);
    const prepared = Object.freeze({
        rootNodeId: candidate.rootNodeId,
        candidateGraph: candidate.candidateGraph,
        candidateCarrierMetadata: candidate.candidateCarrierMetadata,
        candidateCount: Object.keys(candidate.candidateGraph).length,
        physicalNodeCount: candidate.renderBinding.physicalNodeCount,
        physicalTrunkSpanCount: candidate.renderBinding.physicalTrunkSpanCount,
        renderBinding,
        treeFingerprint,
        candidateCarrierFingerprint: fingerprintCandidateCarrierMetadata(
            candidate.candidateCarrierMetadata,
        ),
        treeIdentityFingerprint: identityEnvelope.fingerprint,
        identityRevision: identityEnvelope.identityRevision,
    });
    PREPARED_CANDIDATE_BRAND.add(prepared);
    return prepared;
};

export const requireZenBonsaiClassic2LineageRenderBinding = (value) => {
    if (!RENDER_BINDING_BRAND.has(value)) fail('RENDER_BINDING_INVALID');
    return value;
};

export const requireZenBonsaiClassic2LineageRenderBindingForTopology = (
    value,
    topology,
) => {
    const binding = requireZenBonsaiClassic2LineageRenderBinding(value);
    if (!isPlainObject(topology) || topology.type !== 'branch') {
        fail('RENDER_BINDING_TOPOLOGY_REQUIRED');
    }
    const recordsById = new Map();
    const seenObjects = new WeakSet();
    const visiting = new WeakSet();
    const indexNode = (node, parent = null, edge = null, physicalDepth = 1) => {
        if (physicalDepth > ZEN_BONSAI_CLASSIC2_PHYSICAL_TRAVERSAL_DEPTH_BUDGET) {
            fail('RENDER_BINDING_TOPOLOGY_DEPTH_EXCEEDED');
        }
        if (!isPlainObject(node) || node.type !== 'branch') {
            fail('RENDER_BINDING_TOPOLOGY_NODE_INVALID');
        }
        if (visiting.has(node)) fail('RENDER_BINDING_TOPOLOGY_CYCLE');
        if (seenObjects.has(node)) fail('RENDER_BINDING_TOPOLOGY_SHARED_NODE');
        visiting.add(node);
        seenObjects.add(node);
        const nodeId = requireId(node.nodeId, 'RENDER_BINDING_TOPOLOGY_NODE_ID_INVALID');
        if (recordsById.has(nodeId)) {
            fail('RENDER_BINDING_TOPOLOGY_DUPLICATE_NODE_ID', nodeId);
        }
        const branchOrder = Number(node.branchOrder);
        if (!Number.isInteger(branchOrder)) fail('BRANCH_ORDER_INVALID', nodeId);
        if (!Array.isArray(node.branches)) {
            fail('RENDER_BINDING_TOPOLOGY_BRANCHES_REQUIRED', nodeId);
        }
        const record = {
            node,
            nodeId,
            parent,
            edge,
            role: resolveRole(branchOrder),
            length: Number(node.length),
            width: Number(node.width),
            children: [],
        };
        if (
            !Number.isFinite(record.length)
            || record.length <= 0
            || !Number.isFinite(record.width)
            || record.width <= 0
        ) {
            fail('RENDER_BINDING_TOPOLOGY_GEOMETRY_INVALID', nodeId);
        }
        recordsById.set(nodeId, record);
        if (recordsById.size > ZEN_BONSAI_CLASSIC2_PHYSICAL_TRAVERSAL_BUDGET) {
            fail('RENDER_BINDING_TOPOLOGY_BUDGET_EXCEEDED');
        }
        record.children = node.branches.map((child) => {
            if (!isPlainObject(child) || !isPlainObject(child.obj)) {
                fail('RENDER_BINDING_TOPOLOGY_CHILD_INVALID', nodeId);
            }
            return indexNode(child.obj, record, child, physicalDepth + 1);
        });
        visiting.delete(node);
        return record;
    };
    const rootRecord = indexNode(topology);
    if (rootRecord.role !== ZEN_BONSAI_CLASSIC2_LINEAGE_ROLES.TRUNK) {
        fail('RENDER_BINDING_TOPOLOGY_ROOT_ROLE_INVALID');
    }
    if (binding.rootPhysicalNodeId !== rootRecord.nodeId) {
        fail('RENDER_BINDING_PHYSICAL_ROOT_MISMATCH');
    }

    const trunkRecords = [];
    let trunkCursor = rootRecord;
    while (trunkCursor) {
        trunkRecords.push(trunkCursor);
        const trunkChildren = trunkCursor.children.filter(
            (child) => child.role === ZEN_BONSAI_CLASSIC2_LINEAGE_ROLES.TRUNK,
        );
        if (trunkChildren.length > 1) {
            fail('RENDER_BINDING_TRUNK_CONTINUATION_AMBIGUOUS', trunkCursor.nodeId);
        }
        trunkCursor = trunkChildren[0] || null;
    }
    if (trunkRecords.length !== [...recordsById.values()].filter(
        (record) => record.role === ZEN_BONSAI_CLASSIC2_LINEAGE_ROLES.TRUNK,
    ).length) {
        fail('RENDER_BINDING_TRUNK_SPINE_DISCONNECTED');
    }
    if (binding.physicalNodeCount !== recordsById.size) {
        fail('RENDER_BINDING_PHYSICAL_NODE_COUNT_MISMATCH');
    }
    if (binding.physicalTrunkSpanCount !== trunkRecords.length) {
        fail('RENDER_BINDING_PHYSICAL_TRUNK_COUNT_MISMATCH');
    }
    const bindingNodeIds = Object.keys(binding.nodeBindings || {}).sort();
    const topologyNodeIds = [...recordsById.keys()].sort();
    if (
        bindingNodeIds.length !== topologyNodeIds.length
        || bindingNodeIds.some((nodeId, index) => nodeId !== topologyNodeIds[index])
    ) {
        fail('RENDER_BINDING_PHYSICAL_NODE_COVERAGE_MISMATCH');
    }

    const macro = requireSakuraTrunkMacroLineage(topology.trunkMacroLineage);
    if (binding.trunkGuideShapeId !== macro.guideShapeId) {
        fail('RENDER_BINDING_TRUNK_GUIDE_MISMATCH');
    }
    const physicalTrunkGeometry = resolvePhysicalTrunkGeometryAttestation({
        topology,
        trunkRecords,
        macro,
    });
    if (
        binding.physicalTrunkGeometryFingerprint
        !== physicalTrunkGeometry.geometryFingerprint
    ) {
        fail('RENDER_BINDING_TRUNK_GEOMETRY_MISMATCH');
    }

    trunkRecords.forEach((record, index) => {
        const start = Number(record.node.trunkArcStartNorm);
        const end = Number(record.node.trunkArcEndNorm);
        if (
            !Number.isFinite(start)
            || !Number.isFinite(end)
            || start < 0
            || end > 1
            || end <= start
        ) {
            fail('RENDER_BINDING_TRUNK_ARC_INVALID', record.nodeId);
        }
        if (
            index === 0
                ? Math.abs(start) > 1e-8
                : Math.abs(start - Number(trunkRecords[index - 1].node.trunkArcEndNorm)) > 1e-7
        ) {
            fail('RENDER_BINDING_TRUNK_ARC_DISCONNECTED', record.nodeId);
        }
        if (index === trunkRecords.length - 1 && Math.abs(end - 1) > 1e-8) {
            fail('RENDER_BINDING_TRUNK_ARC_INCOMPLETE', record.nodeId);
        }
    });

    recordsById.forEach((record) => {
        const nodeBinding = binding.nodeBindings[record.nodeId];
        const expectedLogicalNodeId = record.role === ZEN_BONSAI_CLASSIC2_LINEAGE_ROLES.TRUNK
            ? binding.macroRootNodeId
            : (record.parent?.role === ZEN_BONSAI_CLASSIC2_LINEAGE_ROLES.TRUNK
                ? requireId(
                    record.node.scaffoldRootId,
                    'RENDER_BINDING_SCAFFOLD_ROOT_ID_INVALID',
                )
                : record.nodeId);
        const expectedKeys = record.role === ZEN_BONSAI_CLASSIC2_LINEAGE_ROLES.TRUNK
            ? ['logicalNodeId', 'role', 'trunkArcStart', 'trunkArcEnd']
            : ['logicalNodeId', 'role'];
        if (
            !hasExactKeys(nodeBinding, expectedKeys)
            || nodeBinding.logicalNodeId !== expectedLogicalNodeId
            || nodeBinding.role !== record.role
        ) {
            fail('RENDER_BINDING_NODE_MAPPING_MISMATCH', record.nodeId);
        }
        if (record.role === ZEN_BONSAI_CLASSIC2_LINEAGE_ROLES.TRUNK && (
            nodeBinding.trunkArcStart !== round(record.node.trunkArcStartNorm, 7)
            || nodeBinding.trunkArcEnd !== round(record.node.trunkArcEndNorm, 7)
        )) {
            fail('RENDER_BINDING_TRUNK_ARC_MAPPING_MISMATCH', record.nodeId);
        }
    });
    return binding;
};

export const reviseZenBonsaiClassic2PreparedCandidateIdentityRevision = (
    preparedCandidate,
    identityRevision,
) => {
    if (!PREPARED_CANDIDATE_BRAND.has(preparedCandidate)) {
        fail('PREPARED_CANDIDATE_INVALID');
    }
    const revision = requireRevision(identityRevision, 'TREE_IDENTITY_REVISION_INVALID');
    if (revision < preparedCandidate.identityRevision) fail('IDENTITY_REVISION_STALE');
    if (revision === preparedCandidate.identityRevision) return preparedCandidate;
    const revised = Object.freeze({
        ...preparedCandidate,
        identityRevision: revision,
    });
    PREPARED_CANDIDATE_BRAND.add(revised);
    return revised;
};

const resolvePreparedCandidate = ({ preparedCandidate, topology, treeIdentity } = {}) => {
    if (preparedCandidate !== null && preparedCandidate !== undefined) {
        if (!PREPARED_CANDIDATE_BRAND.has(preparedCandidate)) {
            fail('PREPARED_CANDIDATE_INVALID');
        }
        return preparedCandidate;
    }
    return prepareZenBonsaiClassic2LineageCandidate({ topology, treeIdentity });
};

export const resolveZenBonsaiClassic2TreeFingerprint = ({
    topology,
    treeIdentity,
    preparedCandidate = null,
} = {}) => {
    return resolvePreparedCandidate({
        preparedCandidate,
        topology,
        treeIdentity,
    }).treeFingerprint;
};

const normalizeLifeHistory = (lifeState) => {
    if (!isPlainObject(lifeState)) fail('LIFE_STATE_REQUIRED');
    const growth = requireRatio(lifeState.growth ?? lifeState?.maturity?.growth, 'LIFE_GROWTH_INVALID');
    if (!Object.prototype.hasOwnProperty.call(lifeState, 'growthSegments') || !Array.isArray(lifeState.growthSegments)) {
        fail('GROWTH_SEGMENTS_REQUIRED');
    }
    if (!Object.prototype.hasOwnProperty.call(lifeState, 'structuralImprint')) fail('STRUCTURAL_IMPRINT_REQUIRED');
    const seenSegments = new Set();
    const growthSegments = lifeState.growthSegments.map((segment) => {
        if (!isPlainObject(segment)) fail('GROWTH_SEGMENT_INVALID');
        const id = requireId(segment.id || `m${segment.milestone}`, 'GROWTH_SEGMENT_ID_INVALID');
        if (seenSegments.has(id)) fail('GROWTH_SEGMENT_DUPLICATE', id);
        seenSegments.add(id);
        const milestone = Number(segment.milestone);
        if (!Number.isInteger(milestone) || milestone <= 0) fail('GROWTH_SEGMENT_MILESTONE_INVALID', id);
        return Object.freeze({
            id,
            milestone,
            stressWood: requireRatio(segment.stressWood, 'GROWTH_SEGMENT_STRESS_INVALID'),
            recoveryWood: requireRatio(segment.recoveryWood, 'GROWTH_SEGMENT_RECOVERY_INVALID'),
            volatility: requireRatio(segment.volatility, 'GROWTH_SEGMENT_VOLATILITY_INVALID'),
            canopyReserve: requireRatio(segment.canopyReserve, 'GROWTH_SEGMENT_CANOPY_INVALID'),
            healthH: requireRatio(segment.healthH, 'GROWTH_SEGMENT_HEALTH_INVALID'),
        });
    }).sort((left, right) => left.milestone - right.milestone || left.id.localeCompare(right.id));
    const imprintSource = lifeState.structuralImprint;
    const structuralImprint = imprintSource === null
        ? Object.freeze({ stressWood: 0, recoveryWood: 0, volatility: 0, canopyReserve: 0.62 })
        : (() => {
            if (!isPlainObject(imprintSource)) fail('STRUCTURAL_IMPRINT_INVALID');
            return Object.freeze({
                stressWood: requireRatio(imprintSource.stressWood, 'STRUCTURAL_IMPRINT_STRESS_INVALID'),
                recoveryWood: requireRatio(imprintSource.recoveryWood, 'STRUCTURAL_IMPRINT_RECOVERY_INVALID'),
                volatility: requireRatio(imprintSource.volatility, 'STRUCTURAL_IMPRINT_VOLATILITY_INVALID'),
                canopyReserve: requireRatio(imprintSource.canopyReserve, 'STRUCTURAL_IMPRINT_CANOPY_INVALID'),
            });
        })();
    return Object.freeze({ growth, growthSegments: Object.freeze(growthSegments), structuralImprint });
};

const resolveHistorySegment = (descriptor, growthSegments, roleMaxDepth) => {
    if (!growthSegments.length) return null;
    const maxDepth = roleMaxDepth[descriptor.role];
    const depthNorm = descriptor.role === ZEN_BONSAI_CLASSIC2_LINEAGE_ROLES.TRUNK
        ? descriptor.trunkArcStart
        : (descriptor.roleDepth - 1) / Math.max(1, maxDepth - 1);
    const min = growthSegments[0].milestone;
    const max = growthSegments[growthSegments.length - 1].milestone;
    const roleBand = descriptor.role === 'trunk'
        ? [0, 0.48]
        : (descriptor.role === 'scaffold' ? [0.28, 0.84] : [0.56, 1]);
    const target = min + ((max - min) * (roleBand[0] + ((roleBand[1] - roleBand[0]) * depthNorm)));
    return growthSegments.reduce((best, segment) => (
        !best || Math.abs(segment.milestone - target) < Math.abs(best.milestone - target)
            ? segment
            : best
    ), null);
};

const incrementCount = (counts, key) => counts.set(key, (counts.get(key) || 0) + 1);
const resolveParentRoleOccupancyKey = (descriptor) => (
    `${descriptor.role}\u0000${descriptor.parentId ?? ''}\u0000${
        descriptor.cohortId.startsWith('scaffold_root:') ? descriptor.cohortId : ''
    }`
);

const registerSelectedDescriptor = (context, descriptor) => {
    incrementCount(context.selectedByParentRole, resolveParentRoleOccupancyKey(descriptor));
    incrementCount(context.selectedByCohort, descriptor.cohortId);
    if (descriptor.role === ZEN_BONSAI_CLASSIC2_LINEAGE_ROLES.SCAFFOLD) {
        incrementCount(context.selectedScaffoldBySide, descriptor.side);
    }
    registerZenBonsaiClassic2SelectedScoringFeature(
        context.scoringFeatureContext,
        descriptor,
    );
};

const createLineageScoringContext = ({
    candidateGraph,
    candidateCarrierMetadata,
    decisions,
    history,
}) => {
    const descriptors = Object.values(candidateGraph);
    const roleMaxDepth = Object.fromEntries(
        Object.values(ZEN_BONSAI_CLASSIC2_LINEAGE_ROLES).map((role) => [role, 1]),
    );
    const cohortMembers = new Map();
    descriptors.forEach((descriptor) => {
        roleMaxDepth[descriptor.role] = Math.max(
            roleMaxDepth[descriptor.role],
            descriptor.roleDepth,
        );
        if (!cohortMembers.has(descriptor.cohortId)) cohortMembers.set(descriptor.cohortId, []);
        cohortMembers.get(descriptor.cohortId).push(descriptor);
    });
    const historySegmentByNodeId = new Map(descriptors.map((descriptor) => [
        descriptor.nodeId,
        resolveHistorySegment(descriptor, history.growthSegments, roleMaxDepth),
    ]));
    const historySegmentDivisor = Math.max(1, history.growthSegments.length);
    const averageStress = (
        history.structuralImprint.stressWood
        + history.growthSegments.reduce((sum, segment) => sum + segment.stressWood, 0)
            / historySegmentDivisor
    ) * 0.5;
    const averageRecovery = (
        history.structuralImprint.recoveryWood
        + history.growthSegments.reduce((sum, segment) => sum + segment.recoveryWood, 0)
            / historySegmentDivisor
    ) * 0.5;
    const context = {
        descriptors,
        cohortMembers,
        candidateCarrierMetadata,
        history,
        historySegmentByNodeId,
        averageStress,
        averageRecovery,
        selectedByParentRole: new Map(),
        selectedByCohort: new Map(),
        selectedScaffoldBySide: new Map(),
        scoringFeatureContext: createZenBonsaiClassic2LineageScoringFeatureContext({
            candidateGraph,
            decisions: {},
        }),
    };
    Object.values(decisions).forEach((decision) => {
        if (decision.status !== ZEN_BONSAI_CLASSIC2_LINEAGE_DECISION_STATUS.SELECTED) return;
        const descriptor = candidateGraph[decision.nodeId];
        if (descriptor) registerSelectedDescriptor(context, descriptor);
    });
    return context;
};

const scoreCandidate = ({ descriptor, scoringContext }) => {
    const { history } = scoringContext;
    const segment = scoringContext.historySegmentByNodeId.get(descriptor.nodeId) || null;
    const imprint = history.structuralImprint;
    const source = segment || imprint;
    const seed = `${descriptor.nodeId}|${descriptor.parentId}|${ZEN_BONSAI_CLASSIC2_LINEAGE_POLICY_VERSION}`;
    const sameParent = scoringContext.selectedByParentRole.get(
        resolveParentRoleOccupancyKey(descriptor),
    ) || 0;
    const sameCohort = scoringContext.selectedByCohort.get(descriptor.cohortId) || 0;
    const sameSide = descriptor.side === 0
        ? 0
        : (scoringContext.selectedScaffoldBySide.get(descriptor.side) || 0);
    const oppositeSide = descriptor.side === 0
        ? 0
        : (scoringContext.selectedScaffoldBySide.get(-descriptor.side) || 0);
    const occupancy = clamp01((sameParent * 0.34) + (sameCohort * 0.17) + (sameSide * 0.08));
    const base = descriptor.role === 'scaffold' ? 0.49 : 0.45;
    const candidatePrior = (hashUnit(`${seed}|prior`) - 0.5) * 0.14;
    const stress = source.stressWood * ((hashUnit(`${seed}|stress`) - 0.5) * 0.4 - 0.06);
    const recovery = source.recoveryWood * ((hashUnit(`${seed}|recovery`) - 0.5) * 0.42 + 0.04);
    const canopy = (source.canopyReserve - 0.5) * ((hashUnit(`${seed}|canopy`) - 0.5) * 0.38 + 0.08);
    const volatility = source.volatility * ((hashUnit(`${seed}|volatility`) - 0.5) * 0.2);
    const health = segment ? (segment.healthH - 0.5) * 0.1 : 0;
    const imprintHistory = (
        (imprint.recoveryWood * 0.06)
        - (imprint.stressWood * 0.08)
        + ((imprint.canopyReserve - 0.5) * 0.08)
    );
    const occupancyPenalty = -occupancy * (descriptor.role === 'scaffold' ? 0.22 : 0.18);
    const carrier = scoringContext.candidateCarrierMetadata[descriptor.nodeId];
    const terminalCarrierBonus = descriptor.role === ZEN_BONSAI_CLASSIC2_LINEAGE_ROLES.TWIG
        && carrier.terminalCount > 0
        ? Math.min(
            0.14,
            0.05 + (carrier.terminalCount * 0.015) + (carrier.flowerTerminalCount * 0.01),
        )
        : 0;
    const scaffoldBalance = descriptor.role === 'scaffold' && descriptor.side !== 0
        ? ((oppositeSide - sameSide) / Math.max(1, oppositeSide + sameSide + 1)) * 0.04
        : 0;
    const scoringFeatures = resolveZenBonsaiClassic2LineageScoringFeatures({
        descriptor,
        context: scoringContext.scoringFeatureContext,
        historySource: source,
    });
    const weightedBreakdown = {
        base,
        candidatePrior,
        historyStress: stress,
        historyRecovery: recovery,
        historyCanopy: canopy,
        historyVolatility: volatility,
        historyHealth: health,
        structuralImprint: imprintHistory,
        occupancyPenalty,
        terminalCarrierBonus,
        scaffoldBalance,
        ...scoringFeatures.weighted,
    };
    const total = clamp01(Object.values(weightedBreakdown).reduce((sum, value) => sum + value, 0));
    const breakdown = {
        ...weightedBreakdown,
        selectedOccupancyCount: sameParent + sameCohort + sameSide,
    };
    return Object.freeze({
        score: round(total),
        historySegmentRef: segment?.id || null,
        scoreModelVersion: ZEN_BONSAI_CLASSIC2_SCORE_MODEL_VERSION,
        featureContractVersion: ZEN_BONSAI_CLASSIC2_SCORE_FEATURE_CONTRACT_VERSION,
        featureSource: ZEN_BONSAI_CLASSIC2_SCORE_FEATURE_SOURCE,
        scoreSignals: scoringFeatures.signals,
        scoreInputFingerprint: digest('classic2_score_input_release_v1', JSON.stringify({
            policyVersion: ZEN_BONSAI_CLASSIC2_LINEAGE_POLICY_VERSION,
            descriptor: {
                nodeId: descriptor.nodeId,
                parentId: descriptor.parentId,
                role: descriptor.role,
                branchOrder: descriptor.branchOrder,
                roleDepth: descriptor.roleDepth,
                traversalDepth: descriptor.traversalDepth,
                attachT: descriptor.attachT,
                angleOffset: descriptor.angleOffset,
                side: descriptor.side,
                cohortId: descriptor.cohortId,
                ...(descriptor.role === ZEN_BONSAI_CLASSIC2_LINEAGE_ROLES.TRUNK
                    ? {
                        trunkGuideShapeId: descriptor.trunkGuideShapeId,
                        trunkArcStart: descriptor.trunkArcStart,
                        trunkArcEnd: descriptor.trunkArcEnd,
                    }
                    : {}),
                length: descriptor.length,
                width: descriptor.width,
            },
            carrier,
            historySegmentRef: segment?.id || null,
            historySource: source,
            structuralImprint: imprint,
            signals: scoringFeatures.signals,
            occupancy: {
                sameParent,
                sameCohort,
                sameSide,
                oppositeSide,
            },
        })),
        scoreBreakdown: Object.freeze(Object.fromEntries(
            Object.entries({ ...breakdown, total }).map(([key, value]) => [key, round(value)]),
        )),
    });
};

const resolveParentReadyProgress = (parentDecision) => (
    parentDecision.parentId === null
        ? Math.max(
            parentDecision.birthProgress,
            ZEN_BONSAI_CLASSIC2_LIFECYCLE_GROWTH_DOMAIN.floor,
        )
        : parentDecision.birthProgress
);

const resolveBirthProgress = (
    descriptor,
    parentDecision,
    treeFingerprint,
    parentDescriptor = null,
) => {
    if (!parentDecision) return 0;
    if (descriptor.role === ZEN_BONSAI_CLASSIC2_LINEAGE_ROLES.TRUNK) {
        return resolveZenBonsaiClassic2TrunkArcRecordProgress(
            descriptor.trunkArcStart,
        );
    }
    const readiness = ZEN_BONSAI_CLASSIC2_ROLE_READINESS[descriptor.role];
    const jitter = hashUnit(`${treeFingerprint}|${descriptor.nodeId}|birth`)
        * BIRTH_JITTER_SPAN[descriptor.role];
    const attachmentReadyProgress = (
        descriptor.role === ZEN_BONSAI_CLASSIC2_LINEAGE_ROLES.SCAFFOLD
        && parentDescriptor?.role === ZEN_BONSAI_CLASSIC2_LINEAGE_ROLES.TRUNK
    )
        ? resolveZenBonsaiClassic2TrunkArcRecordProgress(descriptor.attachT)
        : 0;
    const rawBirthProgress = Math.max(
        resolveParentReadyProgress(parentDecision),
        attachmentReadyProgress,
    ) + readiness + jitter;
    return round(Math.min(DEVELOPMENT_RECORD_CEILING, rawBirthProgress));
};

const resolveMatureProgress = (descriptor, birthProgress) => {
    const maturityStart = descriptor.parentId === null
        ? Math.max(
            birthProgress,
            ZEN_BONSAI_CLASSIC2_LIFECYCLE_GROWTH_DOMAIN.floor,
        )
        : birthProgress;
    return round(clamp01(
        maturityStart + ZEN_BONSAI_CLASSIC2_ROLE_MATURATION_SPAN[descriptor.role],
    ));
};

const makeDecision = ({
    descriptor,
    status,
    birthProgress,
    score,
    source,
    treeFingerprint,
    identityRevision,
    stateRevision,
    reason,
}) => Object.freeze({
    nodeId: descriptor.nodeId,
    parentId: descriptor.parentId,
    role: descriptor.role,
    status,
    birthProgress,
    matureProgress: resolveMatureProgress(descriptor, birthProgress),
    provenance: Object.freeze({
        policyVersion: ZEN_BONSAI_CLASSIC2_LINEAGE_POLICY_VERSION,
        source,
        treeFingerprint,
        identityRevision,
        stateRevision,
        cohortId: descriptor.cohortId,
        historySegmentRef: score?.historySegmentRef || null,
        selectionMethod: score ? 'development_observation' : 'structural_spine',
        score: score ? round(score.score) : null,
        scoreBreakdown: score?.scoreBreakdown || Object.freeze({ structuralSpine: 1, total: 1 }),
        scoreModelVersion: score?.scoreModelVersion || null,
        featureContractVersion: score?.featureContractVersion || null,
        featureSource: score?.featureSource || 'structural_spine',
        scoreInputFingerprint: score?.scoreInputFingerprint || null,
        scoreSignals: score?.scoreSignals || Object.freeze({}),
        reason,
    }),
});

const normalizeCandidateDescriptor = (value, key) => {
    if (!validateZenBonsaiClassic2CandidateDescriptor(key, value)) {
        fail('STATE_CANDIDATE_GRAPH_INVALID', key);
    }
    const parentId = value.parentId === null ? null : value.parentId;
    const role = value.role;
    return Object.freeze({
        ...value,
        nodeId: key,
        parentId,
        role,
        roleDepth: value.roleDepth,
        traversalDepth: value.traversalDepth,
        ...(role === ZEN_BONSAI_CLASSIC2_LINEAGE_ROLES.TRUNK
            ? {
                trunkGuideShapeId: value.trunkGuideShapeId,
                trunkArcStart: round(value.trunkArcStart, 7),
                trunkArcEnd: round(value.trunkArcEnd, 7),
            }
            : {}),
        childIds: Object.freeze(value.childIds.map((id) => requireId(id)).sort()),
    });
};

const requireCount = (value, code, detail = '') => {
    if (!Number.isSafeInteger(value) || value < 0) fail(code, detail);
    return value;
};

const normalizeCandidateCarrierMetadata = ({ value, candidateGraph }) => {
    if (!isPlainObject(value.candidateCarrierMetadata)) {
        fail('STATE_CANDIDATE_CARRIER_METADATA_REQUIRED');
    }
    const candidateNodeIds = Object.keys(candidateGraph).sort();
    const metadataNodeIds = Object.keys(value.candidateCarrierMetadata).sort();
    if (JSON.stringify(candidateNodeIds) !== JSON.stringify(metadataNodeIds)) {
        fail('STATE_CANDIDATE_CARRIER_METADATA_COVERAGE_INVALID');
    }
    const candidateCarrierMetadata = Object.freeze(Object.fromEntries(
        candidateNodeIds.map((nodeId) => {
            const source = value.candidateCarrierMetadata[nodeId];
            if (!hasExactKeys(source, LINEAGE_CARRIER_METADATA_KEYS)) {
                fail('STATE_CANDIDATE_CARRIER_METADATA_INVALID', nodeId);
            }
            const terminalCount = requireCount(
                source.terminalCount,
                'STATE_CANDIDATE_TERMINAL_COUNT_INVALID',
                nodeId,
            );
            const flowerTerminalCount = requireCount(
                source.flowerTerminalCount,
                'STATE_CANDIDATE_FLOWER_COUNT_INVALID',
                nodeId,
            );
            if (flowerTerminalCount > terminalCount) {
                fail('STATE_CANDIDATE_FLOWER_COUNT_INVALID', nodeId);
            }
            return [nodeId, Object.freeze({ terminalCount, flowerTerminalCount })];
        }),
    ));
    const candidateCarrierFingerprint = String(value.candidateCarrierFingerprint || '');
    if (candidateCarrierFingerprint
        !== fingerprintCandidateCarrierMetadata(candidateCarrierMetadata)) {
        fail('STATE_CANDIDATE_CARRIER_FINGERPRINT_MISMATCH');
    }
    return Object.freeze({ candidateCarrierMetadata, candidateCarrierFingerprint });
};

const normalizeLineageState = (value) => {
    if (isPlainObject(value) && NORMALIZED_STATE_BRAND.has(value)) return value;
    if (!isPlainObject(value)) fail('STATE_REQUIRED');
    if (value.kind !== STATE_KIND) fail('STATE_KIND_INVALID');
    if (value.contract !== ZEN_BONSAI_CLASSIC2_LINEAGE_CONTRACT) {
        fail('STATE_CONTRACT_INVALID');
    }
    if (value.candidateGraphContract !== ZEN_BONSAI_CLASSIC2_CANDIDATE_GRAPH_CONTRACT) {
        fail('STATE_CANDIDATE_GRAPH_CONTRACT_INVALID');
    }
    if (!hasExactKeys(value, LINEAGE_STATE_KEYS)) fail('STATE_SHAPE_INVALID');
    if (typeof value.treeFingerprint !== 'string' || !value.treeFingerprint.startsWith('classic2_tree_v1:')) fail('STATE_TREE_FINGERPRINT_INVALID');
    if (typeof value.treeIdentityFingerprint !== 'string' || !value.treeIdentityFingerprint.startsWith('classic2_identity_v1:')) fail('STATE_IDENTITY_FINGERPRINT_INVALID');
    const identityRevision = requireRevision(value.identityRevision, 'STATE_IDENTITY_REVISION_INVALID');
    const stateRevision = requireRevision(value.stateRevision, 'STATE_REVISION_INVALID');
    if (!isPlainObject(value.candidateGraph) || !Object.keys(value.candidateGraph).length) fail('STATE_CANDIDATE_GRAPH_REQUIRED');
    const candidateNodeIds = Object.keys(value.candidateGraph);
    if (candidateNodeIds.length > ZEN_BONSAI_CLASSIC2_LINEAGE_CANDIDATE_BUDGET) {
        fail(
            'CANDIDATE_BUDGET_EXCEEDED',
            `${candidateNodeIds.length}>${ZEN_BONSAI_CLASSIC2_LINEAGE_CANDIDATE_BUDGET}`,
        );
    }
    const candidateGraph = Object.freeze(Object.fromEntries(candidateNodeIds.sort().map((nodeId) => [
        requireId(nodeId),
        normalizeCandidateDescriptor(value.candidateGraph[nodeId], nodeId),
    ])));
    const carrierState = normalizeCandidateCarrierMetadata({ value, candidateGraph });
    if (!validateZenBonsaiClassic2CandidateGraph(candidateGraph)) {
        fail('STATE_CANDIDATE_GRAPH_INVALID');
    }
    const rootNodeId = resolveZenBonsaiClassic2CandidateGraphRootNodeId(candidateGraph);
    if (resolveZenBonsaiClassic2CandidateGraphFingerprint(
        rootNodeId,
        candidateGraph,
    ) !== value.treeFingerprint) {
        fail('STATE_TREE_FINGERPRINT_MISMATCH');
    }
    if (!hasExactKeys(value.bootstrap, LINEAGE_BOOTSTRAP_KEYS)) fail('STATE_BOOTSTRAP_SHAPE_INVALID');
    if (!BOOTSTRAP_SOURCE_VALUES.has(value.bootstrap.source)) fail('STATE_BOOTSTRAP_SOURCE_INVALID');
    const maxObservedGrowth = requireRatio(value.maxObservedGrowth, 'STATE_MAX_OBSERVED_GROWTH_INVALID');
    if (!isPlainObject(value.decisions)) fail('STATE_DECISIONS_REQUIRED');
    const decisions = {};
    Object.keys(value.decisions).sort().forEach((nodeId) => {
        const source = value.decisions[nodeId];
        if (!hasExactKeys(source, LINEAGE_DECISION_KEYS)
            || requireId(source.nodeId) !== nodeId
            || !candidateGraph[nodeId]) fail('STATE_DECISION_ORPHAN', nodeId);
        if (!STATUS_VALUES.has(source.status) || source.role !== candidateGraph[nodeId].role || source.parentId !== candidateGraph[nodeId].parentId) {
            fail('STATE_DECISION_SHAPE_INVALID', nodeId);
        }
        const birthProgress = requireRatio(source.birthProgress, 'STATE_BIRTH_PROGRESS_INVALID');
        const matureProgress = requireRatio(source.matureProgress, 'STATE_MATURE_PROGRESS_INVALID');
        if (matureProgress < birthProgress || birthProgress > maxObservedGrowth + 1e-6) fail('STATE_DECISION_PROGRESS_INVALID', nodeId);
        if (!hasExactKeys(source.provenance, LINEAGE_PROVENANCE_KEYS)
            || source.provenance.policyVersion !== ZEN_BONSAI_CLASSIC2_LINEAGE_POLICY_VERSION
            || source.provenance.treeFingerprint !== value.treeFingerprint
            || !SOURCE_VALUES.has(source.provenance.source)
            || requireRevision(
                source.provenance.identityRevision,
                'STATE_PROVENANCE_IDENTITY_REVISION_INVALID',
            ) > identityRevision
            || requireRevision(
                source.provenance.stateRevision,
                'STATE_PROVENANCE_REVISION_INVALID',
            ) > stateRevision
            || !isPlainObject(source.provenance.scoreBreakdown)) {
            fail('STATE_PROVENANCE_INVALID', nodeId);
        }
        const structuralScoreValid = source.provenance.selectionMethod === 'structural_spine'
            && source.role === 'trunk'
            && source.provenance.score === null
            && source.provenance.scoreModelVersion === null
            && source.provenance.featureContractVersion === null
            && source.provenance.featureSource === 'structural_spine'
            && source.provenance.scoreInputFingerprint === null;
        const developmentObservationValid = source.provenance.selectionMethod === 'development_observation'
            && source.role !== 'trunk'
            && source.provenance.scoreModelVersion === ZEN_BONSAI_CLASSIC2_SCORE_MODEL_VERSION
            && source.provenance.featureContractVersion
                === ZEN_BONSAI_CLASSIC2_SCORE_FEATURE_CONTRACT_VERSION
            && source.provenance.featureSource === ZEN_BONSAI_CLASSIC2_SCORE_FEATURE_SOURCE
            && typeof source.provenance.scoreInputFingerprint === 'string'
            && source.provenance.scoreInputFingerprint.startsWith(
                'classic2_score_input_release_v1:',
            );
        if ((!structuralScoreValid && !developmentObservationValid)
            || !isPlainObject(source.provenance.scoreSignals)) {
            fail('STATE_SCORE_PROVENANCE_INVALID', nodeId);
        }
        decisions[nodeId] = Object.freeze({
            ...source,
            birthProgress,
            matureProgress,
            provenance: Object.freeze({
                ...source.provenance,
                scoreBreakdown: Object.freeze({ ...source.provenance.scoreBreakdown }),
                ...(isPlainObject(source.provenance.scoreSignals)
                    ? { scoreSignals: Object.freeze({ ...source.provenance.scoreSignals }) }
                    : {}),
            }),
        });
    });
    const rootDecision = decisions[rootNodeId];
    if (!rootDecision || rootDecision.status !== 'selected' || rootDecision.birthProgress !== 0) fail('STATE_ROOT_DECISION_INVALID');
    Object.values(decisions).forEach((decision) => {
        const descriptor = candidateGraph[decision.nodeId];
        if (Math.abs(
            decision.matureProgress - resolveMatureProgress(descriptor, decision.birthProgress)
        ) > 1e-6) {
            fail('STATE_MATURE_PROGRESS_POLICY_MISMATCH', decision.nodeId);
        }
        if (decision.parentId === null) return;
        const parent = decisions[decision.parentId];
        if (!parent || parent.status !== 'selected') fail('STATE_DECISION_PARENT_NOT_SELECTED', decision.nodeId);
        if (decision.birthProgress + 1e-6 < parent.birthProgress) {
            fail('STATE_PARENT_CAUSALITY_INVALID', decision.nodeId);
        }
        const expectedBirthProgress = resolveBirthProgress(
            descriptor,
            parent,
            value.treeFingerprint,
            candidateGraph[descriptor.parentId],
        );
        if (expectedBirthProgress === null
            || Math.abs(decision.birthProgress - expectedBirthProgress) > 1e-6) {
            fail('STATE_BIRTH_PROGRESS_POLICY_MISMATCH', decision.nodeId);
        }
    });
    const initialObservedGrowth = requireRatio(
        value.bootstrap.initialObservedGrowth,
        'STATE_BOOTSTRAP_GROWTH_INVALID',
    );
    if (initialObservedGrowth > maxObservedGrowth + 1e-6) fail('STATE_BOOTSTRAP_GROWTH_AHEAD');
    const rotatedFromTreeFingerprint = value.bootstrap.rotatedFromTreeFingerprint === null
        || value.bootstrap.rotatedFromTreeFingerprint === undefined
        ? null
        : String(value.bootstrap.rotatedFromTreeFingerprint);
    if (rotatedFromTreeFingerprint !== null && !rotatedFromTreeFingerprint.startsWith('classic2_tree_v1:')) {
        fail('STATE_ROTATION_FINGERPRINT_INVALID');
    }
    const rotatedFromTreeIdentityFingerprint = value.bootstrap.rotatedFromTreeIdentityFingerprint === null
        || value.bootstrap.rotatedFromTreeIdentityFingerprint === undefined
        ? null
        : String(value.bootstrap.rotatedFromTreeIdentityFingerprint);
    if (rotatedFromTreeIdentityFingerprint !== null
        && !rotatedFromTreeIdentityFingerprint.startsWith('classic2_identity_v1:')) {
        fail('STATE_ROTATION_IDENTITY_FINGERPRINT_INVALID');
    }
    const initialIdentityRevision = requireRevision(
        value.bootstrap.initialIdentityRevision,
        'STATE_BOOTSTRAP_IDENTITY_REVISION_INVALID',
    );
    const initialStateRevision = requireRevision(
        value.bootstrap.initialStateRevision,
        'STATE_BOOTSTRAP_REVISION_INVALID',
    );
    if (initialIdentityRevision > identityRevision || initialStateRevision > stateRevision) {
        fail('STATE_BOOTSTRAP_REVISION_AHEAD');
    }
    const rotatedFromIdentityRevision = value.bootstrap.rotatedFromIdentityRevision === null
        || value.bootstrap.rotatedFromIdentityRevision === undefined
        ? null
        : requireRevision(
            value.bootstrap.rotatedFromIdentityRevision,
            'STATE_ROTATION_IDENTITY_REVISION_INVALID',
        );
    const rotatedFromStateRevision = value.bootstrap.rotatedFromStateRevision === null
        || value.bootstrap.rotatedFromStateRevision === undefined
        ? null
        : requireRevision(
            value.bootstrap.rotatedFromStateRevision,
            'STATE_ROTATION_REVISION_INVALID',
        );
    const rotationSource = value.bootstrap.source === ZEN_BONSAI_CLASSIC2_LINEAGE_SOURCES.EXPLICIT_IDENTITY_ROTATION
        || value.bootstrap.source === ZEN_BONSAI_CLASSIC2_LINEAGE_SOURCES.EPHEMERAL_PREVIEW_IDENTITY_ROTATION;
    const completeRotationProvenance = rotatedFromTreeFingerprint !== null
        && rotatedFromTreeIdentityFingerprint !== null
        && rotatedFromIdentityRevision !== null
        && rotatedFromStateRevision !== null;
    if (rotationSource !== completeRotationProvenance) fail('STATE_ROTATION_PROVENANCE_INVALID');
    if (rotationSource && (
        initialIdentityRevision <= rotatedFromIdentityRevision
        || initialStateRevision !== rotatedFromStateRevision + 1
    )) {
        fail('STATE_ROTATION_REVISION_ORDER_INVALID');
    }
    if (!rotationSource && initialStateRevision !== 1) fail('STATE_BOOTSTRAP_REVISION_ORIGIN_INVALID');
    if (typeof value.bootstrap.highGrowthBootstrap !== 'boolean') {
        fail('STATE_BOOTSTRAP_HIGH_GROWTH_INVALID');
    }
    const normalized = Object.freeze({
        kind: STATE_KIND,
        contract: ZEN_BONSAI_CLASSIC2_LINEAGE_CONTRACT,
        candidateGraphContract: ZEN_BONSAI_CLASSIC2_CANDIDATE_GRAPH_CONTRACT,
        candidateCarrierMetadata: carrierState.candidateCarrierMetadata,
        candidateCarrierFingerprint: carrierState.candidateCarrierFingerprint,
        treeFingerprint: value.treeFingerprint,
        treeIdentityFingerprint: value.treeIdentityFingerprint,
        identityRevision,
        stateRevision,
        maxObservedGrowth,
        bootstrap: Object.freeze({
            source: value.bootstrap.source,
            initialObservedGrowth,
            initialIdentityRevision,
            initialStateRevision,
            rotatedFromTreeFingerprint,
            rotatedFromTreeIdentityFingerprint,
            rotatedFromIdentityRevision,
            rotatedFromStateRevision,
            highGrowthBootstrap: value.bootstrap.highGrowthBootstrap === true,
        }),
        candidateGraph,
        decisions: Object.freeze(decisions),
    });
    NORMALIZED_STATE_BRAND.add(normalized);
    return normalized;
};

export const normalizeZenBonsaiClassic2LineageState = normalizeLineageState;

const resolveDerivedCandidateAnalysis = (state) => {
    const cached = DERIVED_CANDIDATE_ANALYSIS_CACHE.get(state);
    if (cached) return cached;
    const dispositionByNodeId = Object.fromEntries(
        Object.values(state.candidateGraph).map((descriptor) => {
            const decision = state.decisions[descriptor.nodeId];
            if (decision) return [descriptor.nodeId, decision.status];
            return [
                descriptor.nodeId,
                ZEN_BONSAI_CLASSIC2_LINEAGE_CANDIDATE_DISPOSITIONS.PENDING,
            ];
        }),
    );
    const analysis = Object.freeze({
        dispositionByNodeId: Object.freeze(dispositionByNodeId),
    });
    DERIVED_CANDIDATE_ANALYSIS_CACHE.set(state, analysis);
    return analysis;
};

export const resolveZenBonsaiClassic2LineageCandidateDispositionMap = (state) => {
    const normalized = normalizeZenBonsaiClassic2LineageState(state);
    return resolveDerivedCandidateAnalysis(normalized).dispositionByNodeId;
};

export const resolveZenBonsaiClassic2LineageCandidateDisposition = (state, nodeId) => {
    const normalized = normalizeZenBonsaiClassic2LineageState(state);
    const id = requireId(nodeId);
    if (!normalized.candidateGraph[id]) return null;
    return resolveDerivedCandidateAnalysis(normalized).dispositionByNodeId[id];
};

const reconcileInternal = ({ state, history, source }) => {
    const decisions = { ...state.decisions };
    const scoringContext = createLineageScoringContext({
        candidateGraph: state.candidateGraph,
        candidateCarrierMetadata: state.candidateCarrierMetadata,
        decisions,
        history,
    });
    let changed = true;
    while (changed) {
        changed = false;
        const eligible = scoringContext.descriptors.filter((descriptor) => {
            if (decisions[descriptor.nodeId] || descriptor.parentId === null) return false;
            const parent = decisions[descriptor.parentId];
            if (!parent || parent.status !== 'selected') return false;
            const birthProgress = resolveBirthProgress(
                descriptor,
                parent,
                state.treeFingerprint,
                state.candidateGraph[descriptor.parentId],
            );
            return birthProgress !== null && birthProgress <= state.maxObservedGrowth + 1e-6;
        });
        eligible.sort((left, right) => (
            left.traversalDepth - right.traversalDepth
            || left.nodeId.localeCompare(right.nodeId)
        )).forEach((descriptor) => {
            const birthProgress = resolveBirthProgress(
                descriptor,
                decisions[descriptor.parentId],
                state.treeFingerprint,
                state.candidateGraph[descriptor.parentId],
            );
            const observation = descriptor.role === ZEN_BONSAI_CLASSIC2_LINEAGE_ROLES.TRUNK
                ? null
                : scoreCandidate({ descriptor, scoringContext });
            decisions[descriptor.nodeId] = makeDecision({
                descriptor,
                status: 'selected',
                birthProgress,
                score: observation,
                source,
                treeFingerprint: state.treeFingerprint,
                identityRevision: state.identityRevision,
                stateRevision: state.stateRevision,
                reason: descriptor.role === ZEN_BONSAI_CLASSIC2_LINEAGE_ROLES.TRUNK
                    ? 'structural_spine'
                    : 'development_history_recorded',
            });
            registerSelectedDescriptor(scoringContext, descriptor);
            changed = true;
        });
    }
    return normalizeZenBonsaiClassic2LineageState({ ...state, decisions });
};

export const bootstrapZenBonsaiClassic2LineageState = ({
    topology,
    treeIdentity,
    preparedCandidate = null,
    lifeState,
    source,
    rotatedFromTreeFingerprint = null,
    rotatedFromTreeIdentityFingerprint = null,
    rotatedFromIdentityRevision = null,
    rotatedFromStateRevision = null,
} = {}) => {
    if (!BOOTSTRAP_SOURCE_VALUES.has(source)) fail('BOOTSTRAP_SOURCE_REQUIRED');
    const history = normalizeLifeHistory(lifeState);
    const candidate = resolvePreparedCandidate({ preparedCandidate, topology, treeIdentity });
    const {
        treeFingerprint,
        treeIdentityFingerprint,
        identityRevision,
    } = candidate;
    const rotationSource = source === ZEN_BONSAI_CLASSIC2_LINEAGE_SOURCES.EXPLICIT_IDENTITY_ROTATION
        || source === ZEN_BONSAI_CLASSIC2_LINEAGE_SOURCES.EPHEMERAL_PREVIEW_IDENTITY_ROTATION;
    let stateRevision = 1;
    if (rotationSource) {
        if (typeof rotatedFromTreeFingerprint !== 'string'
            || !rotatedFromTreeFingerprint.startsWith('classic2_tree_v1:')) {
            fail('ROTATION_FINGERPRINT_INVALID');
        }
        if (typeof rotatedFromTreeIdentityFingerprint !== 'string'
            || !rotatedFromTreeIdentityFingerprint.startsWith('classic2_identity_v1:')) {
            fail('ROTATION_IDENTITY_FINGERPRINT_INVALID');
        }
        const previousIdentityRevision = requireRevision(
            rotatedFromIdentityRevision,
            'ROTATION_IDENTITY_REVISION_INVALID',
        );
        const previousStateRevision = requireRevision(
            rotatedFromStateRevision,
            'ROTATION_STATE_REVISION_INVALID',
        );
        if (treeIdentityFingerprint === rotatedFromTreeIdentityFingerprint) {
            fail('ROTATION_IDENTITY_UNCHANGED');
        }
        if (identityRevision < previousIdentityRevision) fail('IDENTITY_REVISION_STALE');
        if (identityRevision === previousIdentityRevision) fail('IDENTITY_REVISION_COLLISION');
        stateRevision = previousStateRevision + 1;
        if (!Number.isSafeInteger(stateRevision)) fail('STATE_REVISION_OVERFLOW');
    } else if (rotatedFromTreeFingerprint !== null
        || rotatedFromTreeIdentityFingerprint !== null
        || rotatedFromIdentityRevision !== null
        || rotatedFromStateRevision !== null) {
        fail('ROTATION_PROVENANCE_SOURCE_INVALID');
    }
    const root = candidate.candidateGraph[candidate.rootNodeId];
    const rootDecision = makeDecision({
        descriptor: root,
        status: 'selected',
        birthProgress: 0,
        score: null,
        source,
        treeFingerprint,
        identityRevision,
        stateRevision,
        reason: 'explicit_root_bootstrap',
    });
    const initial = normalizeZenBonsaiClassic2LineageState({
        kind: STATE_KIND,
        contract: ZEN_BONSAI_CLASSIC2_LINEAGE_CONTRACT,
        candidateGraphContract: ZEN_BONSAI_CLASSIC2_CANDIDATE_GRAPH_CONTRACT,
        treeFingerprint,
        treeIdentityFingerprint,
        identityRevision,
        stateRevision,
        maxObservedGrowth: history.growth,
        bootstrap: {
            source,
            initialObservedGrowth: history.growth,
            initialIdentityRevision: identityRevision,
            initialStateRevision: stateRevision,
            rotatedFromTreeFingerprint,
            rotatedFromTreeIdentityFingerprint,
            rotatedFromIdentityRevision,
            rotatedFromStateRevision,
            highGrowthBootstrap: history.growth >= BOOTSTRAP_HIGH_GROWTH_THRESHOLD,
        },
        candidateGraph: candidate.candidateGraph,
        candidateCarrierMetadata: candidate.candidateCarrierMetadata,
        candidateCarrierFingerprint: candidate.candidateCarrierFingerprint,
        decisions: { [root.nodeId]: rootDecision },
    });
    return reconcileInternal({ state: initial, history, source });
};

export const reconcileZenBonsaiClassic2LineageState = ({
    previousState,
    topology,
    treeIdentity,
    preparedCandidate = null,
    lifeState,
    source,
} = {}) => {
    if (!RECONCILE_SOURCE_VALUES.has(source)) fail('RECONCILE_SOURCE_REQUIRED');
    const previous = normalizeZenBonsaiClassic2LineageState(previousState);
    const history = normalizeLifeHistory(lifeState);
    const candidate = resolvePreparedCandidate({ preparedCandidate, topology, treeIdentity });
    const {
        treeIdentityFingerprint,
        identityRevision,
        treeFingerprint,
        candidateCarrierFingerprint,
    } = candidate;
    if (treeIdentityFingerprint !== previous.treeIdentityFingerprint) {
        if (identityRevision < previous.identityRevision) fail('IDENTITY_REVISION_STALE');
        if (identityRevision === previous.identityRevision) fail('IDENTITY_REVISION_COLLISION');
        fail('IDENTITY_ROTATION_REQUIRED');
    }
    if (treeFingerprint !== previous.treeFingerprint) fail('GENERATOR_DRIFT_DETECTED');
    if (candidateCarrierFingerprint !== previous.candidateCarrierFingerprint) {
        fail('GENERATOR_CARRIER_DRIFT_DETECTED');
    }
    const nextMaxObservedGrowth = Math.max(previous.maxObservedGrowth, history.growth);
    const nextIdentityRevision = Math.max(previous.identityRevision, identityRevision);
    const identityRevisionAdvanced = nextIdentityRevision > previous.identityRevision;
    const growthAdvanced = nextMaxObservedGrowth > previous.maxObservedGrowth;
    if (!identityRevisionAdvanced && !growthAdvanced) return previous;
    const nextStateRevision = previous.stateRevision + 1;
    if (!Number.isSafeInteger(nextStateRevision)) fail('STATE_REVISION_OVERFLOW');
    const forward = normalizeZenBonsaiClassic2LineageState({
        ...previous,
        identityRevision: nextIdentityRevision,
        stateRevision: nextStateRevision,
        maxObservedGrowth: round(nextMaxObservedGrowth),
    });
    return reconcileInternal({ state: forward, history, source });
};

export const resolveZenBonsaiClassic2LineageDecision = (state, nodeId) => {
    const normalized = normalizeZenBonsaiClassic2LineageState(state);
    const id = requireId(nodeId);
    return normalized.decisions[id] || null;
};

export const summarizeZenBonsaiClassic2LineageState = (state) => {
    const normalized = normalizeZenBonsaiClassic2LineageState(state);
    const descriptors = Object.values(normalized.candidateGraph);
    const decisions = Object.values(normalized.decisions);
    const selected = decisions.filter((entry) => entry.status === 'selected');
    const derivedAnalysis = resolveDerivedCandidateAnalysis(normalized);
    const roleCounts = Object.fromEntries(
        Object.values(ZEN_BONSAI_CLASSIC2_LINEAGE_ROLES).map((role) => [role, {
            selected: 0,
            pending: 0,
        }]),
    );
    descriptors.forEach((descriptor) => {
        const disposition = derivedAnalysis.dispositionByNodeId[descriptor.nodeId];
        roleCounts[descriptor.role][disposition] += 1;
    });
    const byRole = Object.fromEntries(Object.entries(roleCounts).map(([role, counts]) => [
        role,
        Object.freeze(counts),
    ]));
    const pendingCount = Object.values(roleCounts)
        .reduce((sum, counts) => sum + counts.pending, 0);
    return Object.freeze({
        contract: normalized.contract,
        treeFingerprint: normalized.treeFingerprint,
        treeIdentityFingerprint: normalized.treeIdentityFingerprint,
        candidateCarrierFingerprint: normalized.candidateCarrierFingerprint,
        identityRevision: normalized.identityRevision,
        stateRevision: normalized.stateRevision,
        maxObservedGrowth: normalized.maxObservedGrowth,
        selectedCount: selected.length,
        pendingCount,
        bornNodeIds: Object.freeze(selected.map((entry) => entry.nodeId).sort()),
        byRole: Object.freeze(byRole),
    });
};

export const resolveZenBonsaiClassic2LineageRenderProjection = (state) => {
    const normalized = normalizeZenBonsaiClassic2LineageState(state);
    const summary = summarizeZenBonsaiClassic2LineageState(normalized);
    return Object.freeze({
        treeFingerprint: normalized.treeFingerprint,
        identityRevision: normalized.identityRevision,
        stateRevision: normalized.stateRevision,
        maxObservedGrowth: normalized.maxObservedGrowth,
        bornNodeIds: summary.bornNodeIds,
        decisionByNodeId: normalized.decisions,
    });
};

export default reconcileZenBonsaiClassic2LineageState;
