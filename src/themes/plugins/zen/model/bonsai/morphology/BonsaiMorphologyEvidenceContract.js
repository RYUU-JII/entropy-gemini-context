import {
    BONSAI_STRUCTURAL_DESCRIPTOR_VERSION,
    BONSAI_STRUCTURAL_VECTOR_KEYS,
    BonsaiStructuralDescriptorModel,
} from './BonsaiStructuralDescriptorModel.js';
import {
    BONSAI_FORM_CLASSIFICATION_THRESHOLD,
    BONSAI_FORM_CLASSIFIER_VERSION,
    BONSAI_FORM_ID,
    BonsaiFormClassifier,
} from './BonsaiFormClassifier.js';
import {
    BONSAI_SINGLE_ROOT_SUPPORTED_FORM_IDS,
} from './BonsaiFormReachabilityPolicy.js';
import {
    SAKURA_GENERATION_SEMANTICS_ID,
} from '../../v2/SakuraLearningSemantics.js';

export const BONSAI_MORPHOLOGY_EVIDENCE_VERSION = 1;
export const BONSAI_MORPHOLOGY_EVIDENCE_CONTRACT = 'bonsai_morphology_evidence_v1';

const EVIDENCE_KEYS = Object.freeze([
    'contract',
    'version',
    'generationSemantics',
    'descriptorVersion',
    'classifierVersion',
    'targetFormId',
    'vector',
    'classification',
]);
const CLASSIFICATION_KEYS = Object.freeze([
    'primaryFormId',
    'primaryScore',
    'confidence',
    'threshold',
    'secondaryFormIds',
    'memberships',
]);
const MEMBERSHIP_KEYS = Object.freeze(['id', 'score']);
const ALL_FORM_IDS = Object.freeze(Object.values(BONSAI_FORM_ID));
const ALL_FORM_ID_SET = new Set(ALL_FORM_IDS);
const SUPPORTED_FORM_ID_SET = new Set(BONSAI_SINGLE_ROOT_SUPPORTED_FORM_IDS);
const VECTOR_KEY_SET = new Set(BONSAI_STRUCTURAL_VECTOR_KEYS);
const EPSILON = 1e-8;

const isPlainObject = (value) => Boolean(
    value
    && typeof value === 'object'
    && !Array.isArray(value),
);

const hasExactKeys = (value, keys) => {
    if (!isPlainObject(value)) return false;
    const actual = Object.keys(value).sort();
    const expected = [...keys].sort();
    return actual.length === expected.length
        && actual.every((key, index) => key === expected[index]);
};

const round = (value, digits = 4) => Number(Number(value).toFixed(digits));

const requireFiniteRange = (value, field, minimum, maximum) => {
    if (
        typeof value !== 'number'
        || !Number.isFinite(value)
        || value < minimum
        || value > maximum
    ) {
        throw new Error(`ZEN_BONSAI_MORPHOLOGY_EVIDENCE_NUMBER_INVALID:${field}`);
    }
    return value;
};

const requireTargetFormId = (value) => {
    if (value === null) return null;
    if (typeof value !== 'string' || !SUPPORTED_FORM_ID_SET.has(value)) {
        throw new Error(`ZEN_BONSAI_MORPHOLOGY_EVIDENCE_TARGET_FORM_INVALID:${String(value)}`);
    }
    return value;
};

const requireVector = (value) => {
    if (!hasExactKeys(value, BONSAI_STRUCTURAL_VECTOR_KEYS)) {
        throw new Error('ZEN_BONSAI_MORPHOLOGY_EVIDENCE_VECTOR_KEYS_INVALID');
    }
    const vector = {};
    BONSAI_STRUCTURAL_VECTOR_KEYS.forEach((key) => {
        if (!VECTOR_KEY_SET.has(key)) {
            throw new Error(`ZEN_BONSAI_MORPHOLOGY_EVIDENCE_VECTOR_KEY_INVALID:${key}`);
        }
        vector[key] = requireFiniteRange(value[key], `vector.${key}`, -1, 1);
    });
    return Object.freeze(vector);
};

const requireClassification = (value) => {
    if (!hasExactKeys(value, CLASSIFICATION_KEYS)) {
        throw new Error('ZEN_BONSAI_MORPHOLOGY_EVIDENCE_CLASSIFICATION_KEYS_INVALID');
    }
    const primaryFormId = value.primaryFormId;
    if (primaryFormId !== null && !ALL_FORM_ID_SET.has(primaryFormId)) {
        throw new Error(
            `ZEN_BONSAI_MORPHOLOGY_EVIDENCE_PRIMARY_FORM_INVALID:${String(primaryFormId)}`,
        );
    }
    if (!Array.isArray(value.secondaryFormIds)) {
        throw new Error('ZEN_BONSAI_MORPHOLOGY_EVIDENCE_SECONDARY_FORMS_INVALID');
    }
    const secondaryFormIds = value.secondaryFormIds.map((formId) => {
        if (!ALL_FORM_ID_SET.has(formId)) {
            throw new Error(
                `ZEN_BONSAI_MORPHOLOGY_EVIDENCE_SECONDARY_FORM_INVALID:${String(formId)}`,
            );
        }
        return formId;
    });
    if (new Set(secondaryFormIds).size !== secondaryFormIds.length) {
        throw new Error('ZEN_BONSAI_MORPHOLOGY_EVIDENCE_SECONDARY_FORMS_DUPLICATE');
    }
    if (!Array.isArray(value.memberships) || value.memberships.length !== ALL_FORM_IDS.length) {
        throw new Error('ZEN_BONSAI_MORPHOLOGY_EVIDENCE_MEMBERSHIPS_INVALID');
    }
    const memberships = value.memberships.map((entry, index) => {
        if (!hasExactKeys(entry, MEMBERSHIP_KEYS) || !ALL_FORM_ID_SET.has(entry.id)) {
            throw new Error(`ZEN_BONSAI_MORPHOLOGY_EVIDENCE_MEMBERSHIP_INVALID:${index}`);
        }
        return Object.freeze({
            id: entry.id,
            score: requireFiniteRange(entry.score, `memberships.${index}.score`, 0, 1),
        });
    });
    if (new Set(memberships.map((entry) => entry.id)).size !== ALL_FORM_IDS.length) {
        throw new Error('ZEN_BONSAI_MORPHOLOGY_EVIDENCE_MEMBERSHIP_COVERAGE_INVALID');
    }
    for (let index = 1; index < memberships.length; index += 1) {
        const previous = memberships[index - 1];
        const current = memberships[index];
        if (
            current.score > previous.score + EPSILON
            || (
                Math.abs(current.score - previous.score) <= EPSILON
                && current.id.localeCompare(previous.id) < 0
            )
        ) {
            throw new Error('ZEN_BONSAI_MORPHOLOGY_EVIDENCE_MEMBERSHIP_ORDER_INVALID');
        }
    }
    const primaryScore = requireFiniteRange(value.primaryScore, 'primaryScore', 0, 1);
    const threshold = requireFiniteRange(value.threshold, 'threshold', 0, 1);
    const first = memberships[0];
    if (Math.abs(threshold - BONSAI_FORM_CLASSIFICATION_THRESHOLD) > EPSILON) {
        throw new Error('ZEN_BONSAI_MORPHOLOGY_EVIDENCE_THRESHOLD_INVALID');
    }
    if (Math.abs(primaryScore - first.score) > EPSILON) {
        throw new Error('ZEN_BONSAI_MORPHOLOGY_EVIDENCE_PRIMARY_SCORE_MISMATCH');
    }
    if (
        (primaryFormId === null && first.score >= threshold)
        || (
            primaryFormId !== null
            && (primaryFormId !== first.id || first.score < threshold)
        )
    ) {
        throw new Error('ZEN_BONSAI_MORPHOLOGY_EVIDENCE_PRIMARY_MEMBERSHIP_MISMATCH');
    }
    const expectedSecondaryFormIds = memberships
        .slice(1)
        .filter((entry) => entry.score >= threshold - 0.08)
        .filter((entry) => first.score - entry.score <= 0.16)
        .map((entry) => entry.id);
    if (
        secondaryFormIds.length !== expectedSecondaryFormIds.length
        || secondaryFormIds.some((formId, index) => (
            formId !== expectedSecondaryFormIds[index]
        ))
    ) {
        throw new Error('ZEN_BONSAI_MORPHOLOGY_EVIDENCE_SECONDARY_FORMS_MISMATCH');
    }
    return Object.freeze({
        primaryFormId,
        primaryScore,
        confidence: requireFiniteRange(value.confidence, 'confidence', 0, 1),
        threshold,
        secondaryFormIds: Object.freeze(secondaryFormIds),
        memberships: Object.freeze(memberships),
    });
};

const createClassificationSnapshot = (classification) => Object.freeze({
    primaryFormId: classification.primaryFormId,
    primaryScore: round(classification.primaryScore),
    confidence: round(classification.confidence),
    threshold: round(classification.threshold),
    secondaryFormIds: Object.freeze([...classification.secondaryFormIds]),
    memberships: Object.freeze(classification.memberships.map((entry) => Object.freeze({
        id: entry.id,
        score: round(entry.score),
    }))),
});

export const requireBonsaiMorphologyEvidenceV1 = (value) => {
    if (!hasExactKeys(value, EVIDENCE_KEYS)) {
        throw new Error('ZEN_BONSAI_MORPHOLOGY_EVIDENCE_KEYS_INVALID');
    }
    if (
        value.contract !== BONSAI_MORPHOLOGY_EVIDENCE_CONTRACT
        || value.version !== BONSAI_MORPHOLOGY_EVIDENCE_VERSION
        || value.generationSemantics !== SAKURA_GENERATION_SEMANTICS_ID
        || value.descriptorVersion !== BONSAI_STRUCTURAL_DESCRIPTOR_VERSION
        || value.classifierVersion !== BONSAI_FORM_CLASSIFIER_VERSION
    ) {
        throw new Error('ZEN_BONSAI_MORPHOLOGY_EVIDENCE_CONTRACT_INVALID');
    }
    const targetFormId = requireTargetFormId(value.targetFormId);
    const vector = requireVector(value.vector);
    const classification = requireClassification(value.classification);
    return Object.freeze({
        contract: BONSAI_MORPHOLOGY_EVIDENCE_CONTRACT,
        version: BONSAI_MORPHOLOGY_EVIDENCE_VERSION,
        generationSemantics: SAKURA_GENERATION_SEMANTICS_ID,
        descriptorVersion: BONSAI_STRUCTURAL_DESCRIPTOR_VERSION,
        classifierVersion: BONSAI_FORM_CLASSIFIER_VERSION,
        targetFormId,
        vector,
        classification,
    });
};

export const createBonsaiMorphologyEvidenceV1 = ({
    descriptor,
    targetFormId = null,
} = {}) => {
    if (!descriptor || descriptor.version !== BONSAI_STRUCTURAL_DESCRIPTOR_VERSION) {
        throw new Error('ZEN_BONSAI_MORPHOLOGY_EVIDENCE_DESCRIPTOR_REQUIRED');
    }
    const vector = BonsaiStructuralDescriptorModel.vectorize(descriptor);
    const classification = BonsaiFormClassifier.classify(descriptor);
    return requireBonsaiMorphologyEvidenceV1({
        contract: BONSAI_MORPHOLOGY_EVIDENCE_CONTRACT,
        version: BONSAI_MORPHOLOGY_EVIDENCE_VERSION,
        generationSemantics: SAKURA_GENERATION_SEMANTICS_ID,
        descriptorVersion: BONSAI_STRUCTURAL_DESCRIPTOR_VERSION,
        classifierVersion: BONSAI_FORM_CLASSIFIER_VERSION,
        targetFormId: requireTargetFormId(targetFormId),
        vector: Object.fromEntries(BONSAI_STRUCTURAL_VECTOR_KEYS.map((key) => [
            key,
            round(vector[key]),
        ])),
        classification: createClassificationSnapshot(classification),
    });
};

export const resolveBonsaiMorphologyEvidenceDistance = (left, right) => {
    const resolvedLeft = requireBonsaiMorphologyEvidenceV1(left);
    const resolvedRight = requireBonsaiMorphologyEvidenceV1(right);
    const squared = BONSAI_STRUCTURAL_VECTOR_KEYS.reduce((sum, key) => (
        sum + ((resolvedLeft.vector[key] - resolvedRight.vector[key]) ** 2)
    ), 0);
    return round(Math.sqrt(squared / BONSAI_STRUCTURAL_VECTOR_KEYS.length));
};

export const resolveBonsaiMorphologyEvidenceFormRelation = (left, right) => {
    const resolvedLeft = requireBonsaiMorphologyEvidenceV1(left);
    const resolvedRight = requireBonsaiMorphologyEvidenceV1(right);
    const primaryFormA = resolvedLeft.classification.primaryFormId;
    const primaryFormB = resolvedRight.classification.primaryFormId;
    const targetFormA = resolvedLeft.targetFormId;
    const targetFormB = resolvedRight.targetFormId;
    return Object.freeze({
        primaryFormA,
        primaryFormB,
        targetFormA,
        targetFormB,
        samePrimaryForm: Boolean(primaryFormA && primaryFormA === primaryFormB),
        crossPrimaryForm: Boolean(primaryFormA && primaryFormB && primaryFormA !== primaryFormB),
        sameTargetForm: Boolean(targetFormA && targetFormA === targetFormB),
        crossTargetForm: Boolean(targetFormA && targetFormB && targetFormA !== targetFormB),
    });
};
