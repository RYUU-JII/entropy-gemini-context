import {
    createStructuralPlanIdV1,
    isStructuralPlanIdV1,
} from '../bonsai/generation/structuralPlanIdentityV1';
import {
    SAKURA_MACRO_LINEAGE_IDENTITY_DECIMALS,
    SAKURA_MACRO_LINEAGE_IDENTITY_QUANTUM,
    SAKURA_MACRO_SPINE_SHAPE_ID_NAMESPACE,
} from '../../contracts/SakuraMacroLineageIdentityContract.js';

export const SAKURA_TRUNK_MACRO_LINEAGE_CONTRACT = 'sakura_trunk_macro_lineage_v1';
export const SAKURA_TRUNK_MACRO_RENDER_ATTESTATION_CONTRACT =
    'sakura_trunk_macro_render_attestation_v1';
export const SAKURA_TRUNK_PHYSICAL_GEOMETRY_ID_NAMESPACE =
    'sakura_trunk_physical_geometry_v1';

const MACRO_LINEAGE_KEYS = Object.freeze([
    'contract',
    'guideShapeId',
    'arcLength',
    'baseWidth',
]);
const MACRO_RENDER_ATTESTATION_KEYS = Object.freeze([
    'contract',
    'guideShapeId',
    'physicalTrunkSpanCount',
    'geometryFingerprint',
]);
const PHYSICAL_TRUNK_SPAN_KEYS = Object.freeze([
    'index',
    'entryAngle',
    'length',
    'width',
    'curve',
    'curveIn',
    'curveOut',
    'arcStartNorm',
    'arcEndNorm',
]);

const fail = (field, details = null) => {
    const error = new Error(`ZEN_SAKURA_TRUNK_MACRO_LINEAGE_INVALID:${field}`);
    error.code = 'ZEN_SAKURA_TRUNK_MACRO_LINEAGE_INVALID';
    if (details && typeof details === 'object') {
        error.details = details;
    }
    throw error;
};

const hasExactKeys = (value, expectedKeys) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const actual = Object.keys(value).sort();
    const expected = [...expectedKeys].sort();
    return actual.length === expected.length
        && actual.every((key, index) => key === expected[index]);
};

const roundIdentityNumber = (value, field) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) fail(field);
    return Number(numeric.toFixed(SAKURA_MACRO_LINEAGE_IDENTITY_DECIMALS));
};

const normalizePhysicalTrunkSpans = (physicalTrunkSpans) => {
    if (!Array.isArray(physicalTrunkSpans) || physicalTrunkSpans.length < 1) {
        fail('physicalTrunkSpans');
    }
    return physicalTrunkSpans.map((span, index) => {
        if (!hasExactKeys(span, PHYSICAL_TRUNK_SPAN_KEYS) || span.index !== index) {
            fail(`physicalTrunkSpans.${index}`);
        }
        const normalized = {
            index,
            entryAngle: roundIdentityNumber(
                span.entryAngle,
                `physicalTrunkSpans.${index}.entryAngle`,
            ),
            length: roundIdentityNumber(span.length, `physicalTrunkSpans.${index}.length`),
            width: roundIdentityNumber(span.width, `physicalTrunkSpans.${index}.width`),
            curve: roundIdentityNumber(span.curve, `physicalTrunkSpans.${index}.curve`),
            curveIn: roundIdentityNumber(span.curveIn, `physicalTrunkSpans.${index}.curveIn`),
            curveOut: roundIdentityNumber(
                span.curveOut,
                `physicalTrunkSpans.${index}.curveOut`,
            ),
            arcStartNorm: roundIdentityNumber(
                span.arcStartNorm,
                `physicalTrunkSpans.${index}.arcStartNorm`,
            ),
            arcEndNorm: roundIdentityNumber(
                span.arcEndNorm,
                `physicalTrunkSpans.${index}.arcEndNorm`,
            ),
        };
        if (
            normalized.length <= 0
            || normalized.width <= 0
            || normalized.arcStartNorm < 0
            || normalized.arcEndNorm > 1
            || normalized.arcEndNorm <= normalized.arcStartNorm
        ) {
            fail(`physicalTrunkSpans.${index}.geometry`, {
                index,
                length: normalized.length,
                width: normalized.width,
                arcStartNorm: normalized.arcStartNorm,
                arcEndNorm: normalized.arcEndNorm,
            });
        }
        if (
            index === 0
                ? Math.abs(normalized.arcStartNorm)
                    > SAKURA_MACRO_LINEAGE_IDENTITY_QUANTUM
                : Math.abs(
                    normalized.arcStartNorm
                        - roundIdentityNumber(
                            physicalTrunkSpans[index - 1].arcEndNorm,
                            `physicalTrunkSpans.${index - 1}.arcEndNorm`,
                        )
                ) > SAKURA_MACRO_LINEAGE_IDENTITY_QUANTUM
        ) {
            fail(`physicalTrunkSpans.${index}.arcContinuity`);
        }
        if (
            index === physicalTrunkSpans.length - 1
            && Math.abs(normalized.arcEndNorm - 1)
                > SAKURA_MACRO_LINEAGE_IDENTITY_QUANTUM
        ) {
            fail(`physicalTrunkSpans.${index}.arcCoverage`);
        }
        return normalized;
    });
};

export const resolveSakuraTrunkPhysicalGeometryFingerprint = ({
    guideShapeId,
    physicalTrunkSpans,
} = {}) => {
    if (!isStructuralPlanIdV1(guideShapeId, SAKURA_MACRO_SPINE_SHAPE_ID_NAMESPACE)) {
        fail('guideShapeId');
    }
    const normalizedSpans = normalizePhysicalTrunkSpans(physicalTrunkSpans);
    return createStructuralPlanIdV1(
        SAKURA_TRUNK_PHYSICAL_GEOMETRY_ID_NAMESPACE,
        [guideShapeId, ...normalizedSpans.flatMap((span) => PHYSICAL_TRUNK_SPAN_KEYS.map(
            (field) => span[field],
        ))],
    );
};

export const requireSakuraTrunkMacroRenderAttestation = (value) => {
    if (!hasExactKeys(value, MACRO_RENDER_ATTESTATION_KEYS)) fail('renderAttestation.shape');
    if (value.contract !== SAKURA_TRUNK_MACRO_RENDER_ATTESTATION_CONTRACT) {
        fail('renderAttestation.contract');
    }
    if (!isStructuralPlanIdV1(
        value.guideShapeId,
        SAKURA_MACRO_SPINE_SHAPE_ID_NAMESPACE,
    )) {
        fail('renderAttestation.guideShapeId');
    }
    if (!Number.isSafeInteger(value.physicalTrunkSpanCount) || value.physicalTrunkSpanCount < 1) {
        fail('renderAttestation.physicalTrunkSpanCount');
    }
    if (!isStructuralPlanIdV1(
        value.geometryFingerprint,
        SAKURA_TRUNK_PHYSICAL_GEOMETRY_ID_NAMESPACE,
    )) {
        fail('renderAttestation.geometryFingerprint');
    }
    return value;
};

export const createSakuraTrunkMacroRenderAttestation = ({
    guideShapeId,
    physicalTrunkSpans,
} = {}) => requireSakuraTrunkMacroRenderAttestation(Object.freeze({
    contract: SAKURA_TRUNK_MACRO_RENDER_ATTESTATION_CONTRACT,
    guideShapeId,
    physicalTrunkSpanCount: Array.isArray(physicalTrunkSpans)
        ? physicalTrunkSpans.length
        : 0,
    geometryFingerprint: resolveSakuraTrunkPhysicalGeometryFingerprint({
        guideShapeId,
        physicalTrunkSpans,
    }),
}));

export const requireSakuraTrunkMacroLineage = (value) => {
    if (!hasExactKeys(value, MACRO_LINEAGE_KEYS)) fail('shape');
    if (value.contract !== SAKURA_TRUNK_MACRO_LINEAGE_CONTRACT) fail('contract');
    if (!isStructuralPlanIdV1(
        value.guideShapeId,
        SAKURA_MACRO_SPINE_SHAPE_ID_NAMESPACE,
    )) {
        fail('guideShapeId');
    }
    if (
        typeof value.arcLength !== 'number'
        || !Number.isFinite(value.arcLength)
        || value.arcLength <= 0
    ) {
        fail('arcLength');
    }
    if (
        typeof value.baseWidth !== 'number'
        || !Number.isFinite(value.baseWidth)
        || value.baseWidth <= 0
    ) {
        fail('baseWidth');
    }
    return value;
};

export const createSakuraTrunkMacroLineage = ({
    guideShapeId,
    arcLength,
    baseWidth,
} = {}) => requireSakuraTrunkMacroLineage(Object.freeze({
    contract: SAKURA_TRUNK_MACRO_LINEAGE_CONTRACT,
    guideShapeId,
    arcLength,
    baseWidth,
}));
