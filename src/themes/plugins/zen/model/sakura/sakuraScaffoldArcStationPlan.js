import {
    createStructuralPlanIdV1,
    isStructuralPlanIdV1,
    STRUCTURAL_PLAN_HASH_ALGORITHM_V1,
} from '../bonsai/generation/structuralPlanIdentityV1';
import {
    SAKURA_MACRO_SPINE_SHAPE_ID_NAMESPACE,
    SAKURA_SCAFFOLD_STATION_LINEAGE_ID_NAMESPACE,
} from '../../contracts/SakuraMacroLineageIdentityContract.js';
import { clamp } from './sakuraMath';

export const SAKURA_SCAFFOLD_ARC_STATION_PLAN_VERSION = 1;
export const SAKURA_SCAFFOLD_ARC_STATION_POLICY_ID = 'sakura_macro_spine_arc_station_active_v1';
export const SAKURA_SCAFFOLD_ROOT_ARC_ATTACHMENT_CONTRACT = (
    'sakura_scaffold_root_arc_attachment_v1'
);

const PLACEMENT_ID_NAMESPACE = 'sakura_scaffold_station_placement_v1';
const PLAN_ID_NAMESPACE = 'sakura_scaffold_arc_station_plan_v1';
const VALID_ROLES = new Set(['normal', 'apical_penultimate', 'apical_ultimate']);
const NORMAL_STATION_ARC_MAX = 0.96;
const ROOT_ARC_ATTACHMENT_KEYS = Object.freeze([
    'contract',
    'stationId',
    'placementId',
    'role',
    'side',
    'arcNorm',
]);

const fail = (reason) => {
    throw new Error(`ZEN_SAKURA_SCAFFOLD_ARC_STATION_PLAN_INVALID:${reason}`);
};

const requireUnitNumber = (value, field) => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
        fail(field);
    }
};

const requireSide = (value, field) => {
    if (value !== -1 && value !== 1) fail(field);
};

const createStationId = ({ role, selectionKey }) => createStructuralPlanIdV1(
    SAKURA_SCAFFOLD_STATION_LINEAGE_ID_NAMESPACE,
    [SAKURA_SCAFFOLD_ARC_STATION_PLAN_VERSION, role, selectionKey],
);

const createPlacementId = ({ stationId, guideShapeId, arcNorm, side }) => (
    createStructuralPlanIdV1(
        PLACEMENT_ID_NAMESPACE,
        [stationId, guideShapeId, Number(arcNorm.toFixed(7)), side],
    )
);

const createPlanId = ({ guideShapeId, stations }) => createStructuralPlanIdV1(
    PLAN_ID_NAMESPACE,
    [
        SAKURA_SCAFFOLD_ARC_STATION_PLAN_VERSION,
        SAKURA_SCAFFOLD_ARC_STATION_POLICY_ID,
        guideShapeId,
        ...stations.flatMap((station) => [
            station.stationId,
            station.placementId,
            station.ordinal,
            station.role,
            station.selectionKey,
            station.arcNorm,
            station.side,
        ]),
    ],
);

const requireGuideShapeId = (value) => {
    if (!isStructuralPlanIdV1(value, SAKURA_MACRO_SPINE_SHAPE_ID_NAMESPACE)) {
        fail('guideShapeId');
    }
};

export const requireSakuraScaffoldRootArcAttachment = (
    value,
    station = null,
    guideShapeId = null,
) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        fail('rootAttachment');
    }
    const actualKeys = Object.keys(value).sort();
    const expectedKeys = [...ROOT_ARC_ATTACHMENT_KEYS].sort();
    if (
        actualKeys.length !== expectedKeys.length
        || actualKeys.some((key, index) => key !== expectedKeys[index])
    ) {
        fail('rootAttachment.shape');
    }
    if (value.contract !== SAKURA_SCAFFOLD_ROOT_ARC_ATTACHMENT_CONTRACT) {
        fail('rootAttachment.contract');
    }
    if (!isStructuralPlanIdV1(
        value.stationId,
        SAKURA_SCAFFOLD_STATION_LINEAGE_ID_NAMESPACE,
    )) {
        fail('rootAttachment.stationId');
    }
    if (!isStructuralPlanIdV1(value.placementId, PLACEMENT_ID_NAMESPACE)) {
        fail('rootAttachment.placementId');
    }
    if (!VALID_ROLES.has(value.role)) fail('rootAttachment.role');
    requireSide(value.side, 'rootAttachment.side');
    requireUnitNumber(value.arcNorm, 'rootAttachment.arcNorm');
    if (station && (
        value.stationId !== station.stationId
        || value.placementId !== station.placementId
        || value.role !== station.role
        || value.side !== station.side
        || value.arcNorm !== station.arcNorm
    )) {
        fail('rootAttachment.stationMismatch');
    }
    if (guideShapeId !== null) {
        requireGuideShapeId(guideShapeId);
        const expectedPlacementId = createPlacementId({
            stationId: value.stationId,
            guideShapeId,
            arcNorm: value.arcNorm,
            side: value.side,
        });
        if (value.placementId !== expectedPlacementId) {
            fail('rootAttachment.guidePlacementMismatch');
        }
    }
    return value;
};

export const createSakuraScaffoldRootArcAttachment = (station) => (
    requireSakuraScaffoldRootArcAttachment(Object.freeze({
        contract: SAKURA_SCAFFOLD_ROOT_ARC_ATTACHMENT_CONTRACT,
        stationId: station?.stationId,
        placementId: station?.placementId,
        role: station?.role,
        side: station?.side,
        arcNorm: station?.arcNorm,
    }), station)
);

export const requireSakuraScaffoldArcStationPlan = (plan) => {
    if (!plan || typeof plan !== 'object' || Array.isArray(plan)) fail('plan');
    if (plan.version !== SAKURA_SCAFFOLD_ARC_STATION_PLAN_VERSION) fail('version');
    if (plan.policyId !== SAKURA_SCAFFOLD_ARC_STATION_POLICY_ID) fail('policyId');
    if (plan.hashAlgorithm !== STRUCTURAL_PLAN_HASH_ALGORITHM_V1) fail('hashAlgorithm');
    requireGuideShapeId(plan.guideShapeId);
    if (!Array.isArray(plan.stations) || !plan.stations.length) fail('stations');
    const selectionKeys = new Set();
    plan.stations.forEach((station, index) => {
        if (!station || typeof station !== 'object' || Array.isArray(station)) {
            fail(`stations.${index}`);
        }
        if (station.ordinal !== index) fail(`stations.${index}.ordinal`);
        if (!VALID_ROLES.has(station.role)) fail(`stations.${index}.role`);
        if (typeof station.selectionKey !== 'string' || !station.selectionKey) {
            fail(`stations.${index}.selectionKey`);
        }
        if (selectionKeys.has(station.selectionKey)) fail(`stations.${index}.selectionKeyDuplicate`);
        selectionKeys.add(station.selectionKey);
        requireUnitNumber(station.arcNorm, `stations.${index}.arcNorm`);
        requireSide(station.side, `stations.${index}.side`);
        if (index > 0 && station.arcNorm <= plan.stations[index - 1].arcNorm) {
            fail(`stations.${index}.arcNormOrder`);
        }
        const expectedStationId = createStationId(station);
        if (
            station.stationId !== expectedStationId
            || !isStructuralPlanIdV1(
                station.stationId,
                SAKURA_SCAFFOLD_STATION_LINEAGE_ID_NAMESPACE,
            )
        ) {
            fail(`stations.${index}.stationId`);
        }
        const expectedPlacementId = createPlacementId({
            ...station,
            guideShapeId: plan.guideShapeId,
        });
        if (
            station.placementId !== expectedPlacementId
            || !isStructuralPlanIdV1(station.placementId, PLACEMENT_ID_NAMESPACE)
        ) {
            fail(`stations.${index}.placementId`);
        }
    });
    const expectedPlanId = createPlanId({
        guideShapeId: plan.guideShapeId,
        stations: plan.stations,
    });
    if (
        plan.stationPlanId !== expectedPlanId
        || !isStructuralPlanIdV1(plan.stationPlanId, PLAN_ID_NAMESPACE)
    ) {
        fail('stationPlanId');
    }
    return plan;
};

const normalizeNormalSpecs = (placements) => {
    if (!Array.isArray(placements)) fail('placements');
    const byArc = new Map();
    placements.forEach((placement, index) => {
        const arcNorm = clamp(Number(placement?.arcNorm), 0, 1);
        if (!Number.isFinite(Number(placement?.arcNorm))) fail(`placements.${index}.arcNorm`);
        if (arcNorm > NORMAL_STATION_ARC_MAX) fail(`placements.${index}.arcNormReserved`);
        const arcToken = arcNorm.toFixed(7);
        if (byArc.has(arcToken)) fail(`placements.${index}.arcNormDuplicate`);
        const side = Number(placement?.side);
        requireSide(side, `placements.${index}.side`);
        byArc.set(arcToken, {
            role: 'normal',
            selectionKey: `normal_arc_${arcToken}`,
            arcNorm,
            side,
        });
    });
    return [...byArc.values()].sort((left, right) => left.arcNorm - right.arcNorm);
};

const createApicalSpecs = (normalSpecs) => {
    const fallbackSide = normalSpecs.at(-1)?.side || 1;
    const hasUpperCoverage = normalSpecs.some((station) => station.arcNorm >= 0.86);
    return [
        ...(!hasUpperCoverage ? [{
            role: 'apical_penultimate',
            selectionKey: 'apical_penultimate',
            arcNorm: 0.93,
            side: fallbackSide,
        }] : []),
        {
            role: 'apical_ultimate',
            selectionKey: 'apical_ultimate',
            arcNorm: 0.985,
            side: -fallbackSide,
        },
    ];
};

export const createSakuraScaffoldArcStationPlan = ({
    guideShapeId,
    placements,
} = {}) => {
    requireGuideShapeId(guideShapeId);
    const specs = normalizeNormalSpecs(placements);
    const combined = [...specs, ...createApicalSpecs(specs)]
        .sort((left, right) => left.arcNorm - right.arcNorm || left.role.localeCompare(right.role));
    const stations = combined.map((spec, ordinal) => {
        const stationId = createStationId(spec);
        return Object.freeze({
            stationId,
            placementId: createPlacementId({ ...spec, stationId, guideShapeId }),
            ordinal,
            role: spec.role,
            selectionKey: spec.selectionKey,
            arcNorm: spec.arcNorm,
            side: spec.side,
        });
    });
    const plan = Object.freeze({
        version: SAKURA_SCAFFOLD_ARC_STATION_PLAN_VERSION,
        policyId: SAKURA_SCAFFOLD_ARC_STATION_POLICY_ID,
        hashAlgorithm: STRUCTURAL_PLAN_HASH_ALGORITHM_V1,
        guideShapeId,
        stationPlanId: createPlanId({ guideShapeId, stations }),
        stations: Object.freeze(stations),
    });
    return requireSakuraScaffoldArcStationPlan(plan);
};

export const createSakuraScaffoldStationRandom = (topologyRandom, station) => {
    if (typeof topologyRandom?.fork !== 'function') {
        fail('topologyRandom');
    }
    if (!station || typeof station.stationId !== 'string') fail('station');
    return topologyRandom.fork({
        depth: 0,
        nodeRole: 'scaffold_station',
        nodeSlot: 0,
        decisionType: station.stationId,
    });
};
