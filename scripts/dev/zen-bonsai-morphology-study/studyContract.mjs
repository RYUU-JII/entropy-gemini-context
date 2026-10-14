export const ZEN_BONSAI_MORPHOLOGY_STUDY_BACKEND = 'classic2_structural_scout';
export const ZEN_BONSAI_MORPHOLOGY_STUDY_RENDERER = 'structural_line_preview_v1';

export const ZEN_BONSAI_MORPHOLOGY_STUDY_LANE_CONTRACT = Object.freeze({
    version: 1,
    backend: ZEN_BONSAI_MORPHOLOGY_STUDY_BACKEND,
    renderer: ZEN_BONSAI_MORPHOLOGY_STUDY_RENDERER,
    renderScope: 'trunk_and_scaffold_structure',
    fullProductCanvas: false,
    terminalGeometryObservable: false,
    twigGeometryObservable: false,
});

export const ZEN_BONSAI_MORPHOLOGY_STUDY_GENERATION_KIND = Object.freeze({
    PROCEDURAL: 'procedural',
    AUTHORED_GUIDE: 'authored_guide',
    REFERENCE_FAMILY: 'reference_family',
});

export const ZEN_BONSAI_MORPHOLOGY_STUDY_FORM_IDS = Object.freeze([
    'formal_upright',
    'umbrella_crown',
    'slanting',
    'informal_upright',
    'literati',
    'full_cascade',
    'semi_cascade',
    'weeping',
]);

export const ZEN_BONSAI_MORPHOLOGY_STUDY_FEEDBACK_LABELS = Object.freeze([
    'near_straight',
    'single_kink_long_straight',
    'domino_joint_bend',
    'wire_zigzag',
    'baton_bent',
    'mosquito_leg_apex',
    'antenna_terminal_cluster',
    'twig_sparse',
    'trunk_scaffold_resolution_mismatch',
    'crown_incoherent',
    'natural_keep',
]);

export const ZEN_BONSAI_MORPHOLOGY_STUDY_OBSERVABLE_FEEDBACK_LABELS = Object.freeze([
    'near_straight',
    'single_kink_long_straight',
    'domino_joint_bend',
    'wire_zigzag',
    'baton_bent',
    'trunk_scaffold_resolution_mismatch',
    'crown_incoherent',
    'natural_keep',
]);

export const ZEN_BONSAI_MORPHOLOGY_STUDY_DEFERRED_FEEDBACK_LABELS = Object.freeze([
    'mosquito_leg_apex',
    'antenna_terminal_cluster',
    'twig_sparse',
]);

export const ZEN_BONSAI_MORPHOLOGY_STUDY_FEEDBACK_POLICY = Object.freeze({
    evidenceClass: 'shadow_diagnostic',
    productLearningEligible: false,
    automaticPromotionEligible: false,
    deferredLabelDisposition: 'not_observable_on_structural_scout',
});

const CASE_KEYS = Object.freeze([
    'id',
    'title',
    'seed',
    'latentOverrides',
    'generation',
    'form',
]);
const GENERATION_KEYS_BY_KIND = Object.freeze({
    [ZEN_BONSAI_MORPHOLOGY_STUDY_GENERATION_KIND.PROCEDURAL]: Object.freeze([
        'kind',
    ]),
    [ZEN_BONSAI_MORPHOLOGY_STUDY_GENERATION_KIND.AUTHORED_GUIDE]: Object.freeze([
        'kind',
        'anchors',
        'adherence',
    ]),
    [ZEN_BONSAI_MORPHOLOGY_STUDY_GENERATION_KIND.REFERENCE_FAMILY]: Object.freeze([
        'kind',
        'anchors',
        'likeness',
    ]),
});
const FORM_KEYS = Object.freeze(['id', 'variantSeed']);
const POINT_KEYS = Object.freeze(['x', 'y']);
const FEEDBACK_INPUT_KEYS = Object.freeze([
    'caseId',
    'observableLabels',
    'note',
]);
const FEEDBACK_CONTRACT_KEYS = Object.freeze([
    'version',
    'contract',
    'backend',
    'renderer',
    'caseId',
    'observableLabels',
    'deferredLabels',
    'note',
    'evidencePolicy',
]);
const FORM_ID_SET = new Set(ZEN_BONSAI_MORPHOLOGY_STUDY_FORM_IDS);
const FEEDBACK_LABEL_SET = new Set(ZEN_BONSAI_MORPHOLOGY_STUDY_FEEDBACK_LABELS);
const OBSERVABLE_LABEL_SET = new Set(
    ZEN_BONSAI_MORPHOLOGY_STUDY_OBSERVABLE_FEEDBACK_LABELS,
);
const FEEDBACK_LABEL_ORDER = new Map(
    ZEN_BONSAI_MORPHOLOGY_STUDY_FEEDBACK_LABELS.map((label, index) => [label, index]),
);
const MAX_UINT32 = 0xFFFFFFFF;
const MIN_SPINE_ANCHOR_COUNT = 3;
const MAX_SPINE_ANCHOR_COUNT = 7;
const MIN_SPINE_ANCHOR_GAP = 0.012;
const MAX_SPINE_ARC = 1.35;
const ID_PATTERN = /^[a-z0-9][a-z0-9/_-]*$/;
const LATENT_KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

const fail = (detail) => {
    const error = new Error(`ZEN_BONSAI_MORPHOLOGY_STUDY_CONTRACT_INVALID:${detail}`);
    error.code = 'ZEN_BONSAI_MORPHOLOGY_STUDY_CONTRACT_INVALID';
    throw error;
};

const isPlainObject = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
};

const requirePlainObject = (value, field) => {
    if (!isPlainObject(value)) fail(`${field}.object_required`);
    return value;
};

const requireExactKeys = (value, allowedKeys, field) => {
    const allowed = new Set(allowedKeys);
    const actualKeys = Object.keys(value);
    const unknownKeys = actualKeys.filter((key) => !allowed.has(key));
    const missingKeys = allowedKeys.filter((key) => !actualKeys.includes(key));
    if (unknownKeys.length > 0) {
        fail(`${field}.unknown_keys:${unknownKeys.sort().join(',')}`);
    }
    if (missingKeys.length > 0) {
        fail(`${field}.missing_keys:${missingKeys.join(',')}`);
    }
};

const requireTrimmedString = (value, field, maxLength = 160) => {
    if (
        typeof value !== 'string'
        || value.length === 0
        || value !== value.trim()
        || value.length > maxLength
    ) {
        fail(`${field}.string_invalid`);
    }
    return value;
};

const requireId = (value, field) => {
    const id = requireTrimmedString(value, field);
    if (!ID_PATTERN.test(id)) fail(`${field}.format`);
    return id;
};

const requireUint32 = (value, field) => {
    if (!Number.isInteger(value) || value < 0 || value > MAX_UINT32) {
        fail(`${field}.uint32_required`);
    }
    return value;
};

const requireUnitInterval = (value, field) => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
        fail(`${field}.unit_interval_required`);
    }
    return value;
};

const normalizeFiniteNumber = (value, field) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        fail(`${field}.finite_number_required`);
    }
    return Object.is(value, -0) ? 0 : value;
};

const normalizeLatentOverrides = (value) => {
    const overrides = requirePlainObject(value, 'case.latentOverrides');
    const keys = Object.keys(overrides).sort();
    return Object.freeze(Object.fromEntries(keys.map((key) => {
        if (!LATENT_KEY_PATTERN.test(key)) {
            fail(`case.latentOverrides.key_invalid:${key}`);
        }
        return [
            key,
            normalizeFiniteNumber(
                overrides[key],
                `case.latentOverrides.${key}`,
            ),
        ];
    })));
};

const normalizeAnchor = (value, index) => {
    const anchor = requirePlainObject(value, `case.generation.anchors.${index}`);
    requireExactKeys(anchor, POINT_KEYS, `case.generation.anchors.${index}`);
    return Object.freeze({
        x: normalizeFiniteNumber(anchor.x, `case.generation.anchors.${index}.x`),
        y: normalizeFiniteNumber(anchor.y, `case.generation.anchors.${index}.y`),
    });
};

const normalizeAnchors = (value) => {
    if (!Array.isArray(value)) fail('case.generation.anchors.array_required');
    if (
        value.length < MIN_SPINE_ANCHOR_COUNT
        || value.length > MAX_SPINE_ANCHOR_COUNT
    ) {
        fail(`case.generation.anchors.count:${value.length}`);
    }
    const anchors = value.map(normalizeAnchor);
    if (anchors[0].x !== 0 || anchors[0].y !== 0) {
        fail('case.generation.anchors.root');
    }
    let totalArc = 0;
    for (let index = 1; index < anchors.length; index += 1) {
        const previous = anchors[index - 1];
        const current = anchors[index];
        const gap = Math.hypot(current.x - previous.x, current.y - previous.y);
        if (gap < MIN_SPINE_ANCHOR_GAP) {
            fail(`case.generation.anchors.gap:${index}`);
        }
        totalArc += gap;
    }
    if (totalArc > MAX_SPINE_ARC) {
        fail(`case.generation.anchors.arc:${totalArc}`);
    }
    return Object.freeze(anchors);
};

const normalizeGeneration = (value) => {
    const generation = requirePlainObject(value, 'case.generation');
    const allowedKeys = GENERATION_KEYS_BY_KIND[generation.kind];
    if (!allowedKeys) {
        fail(`case.generation.kind:${String(generation.kind)}`);
    }
    requireExactKeys(generation, allowedKeys, 'case.generation');
    if (generation.kind === ZEN_BONSAI_MORPHOLOGY_STUDY_GENERATION_KIND.PROCEDURAL) {
        return Object.freeze({ kind: generation.kind });
    }
    const anchors = normalizeAnchors(generation.anchors);
    if (
        generation.kind
        === ZEN_BONSAI_MORPHOLOGY_STUDY_GENERATION_KIND.AUTHORED_GUIDE
    ) {
        return Object.freeze({
            kind: generation.kind,
            anchors,
            adherence: requireUnitInterval(
                generation.adherence,
                'case.generation.adherence',
            ),
        });
    }
    return Object.freeze({
        kind: generation.kind,
        anchors,
        likeness: requireUnitInterval(
            generation.likeness,
            'case.generation.likeness',
        ),
    });
};

const normalizeForm = (value) => {
    if (value === null) return null;
    const form = requirePlainObject(value, 'case.form');
    requireExactKeys(form, FORM_KEYS, 'case.form');
    if (!FORM_ID_SET.has(form.id)) {
        fail(`case.form.id.unsupported:${String(form.id)}`);
    }
    return Object.freeze({
        id: form.id,
        variantSeed: requireUint32(form.variantSeed, 'case.form.variantSeed'),
    });
};

export const normalizeZenBonsaiMorphologyStudyCase = (value) => {
    const studyCase = requirePlainObject(value, 'case');
    requireExactKeys(studyCase, CASE_KEYS, 'case');
    return Object.freeze({
        id: requireId(studyCase.id, 'case.id'),
        title: requireTrimmedString(studyCase.title, 'case.title'),
        seed: requireUint32(studyCase.seed, 'case.seed'),
        latentOverrides: normalizeLatentOverrides(studyCase.latentOverrides),
        generation: normalizeGeneration(studyCase.generation),
        form: normalizeForm(studyCase.form),
    });
};

export const requireZenBonsaiMorphologyStudyCase = (value) => {
    normalizeZenBonsaiMorphologyStudyCase(value);
    return value;
};

export const ZEN_BONSAI_MORPHOLOGY_STUDY_FEEDBACK_VERSION = 1;
export const ZEN_BONSAI_MORPHOLOGY_STUDY_FEEDBACK_CONTRACT =
    'zen_bonsai_structural_scout_shadow_feedback_v1';

const normalizeObservableFeedbackLabels = (value) => {
    if (!Array.isArray(value) || value.length === 0) {
        fail('feedback.observableLabels.non_empty_array_required');
    }
    const seen = new Set();
    value.forEach((label) => {
        if (!FEEDBACK_LABEL_SET.has(label)) {
            fail(`feedback.observableLabels.unsupported:${String(label)}`);
        }
        if (!OBSERVABLE_LABEL_SET.has(label)) {
            fail(`feedback.observableLabels.not_observable_on_structural_scout:${label}`);
        }
        if (seen.has(label)) {
            fail(`feedback.observableLabels.duplicate:${label}`);
        }
        seen.add(label);
    });
    if (seen.has('natural_keep') && seen.size !== 1) {
        fail('feedback.observableLabels.natural_keep_exclusive');
    }
    return Object.freeze(
        [...seen].sort((left, right) => (
            FEEDBACK_LABEL_ORDER.get(left) - FEEDBACK_LABEL_ORDER.get(right)
        )),
    );
};

const normalizeNote = (value) => {
    if (value === null) return null;
    return requireTrimmedString(value, 'feedback.note', 1_000);
};

export const createZenBonsaiMorphologyStudyFeedback = (value) => {
    const feedback = requirePlainObject(value, 'feedback');
    requireExactKeys(feedback, FEEDBACK_INPUT_KEYS, 'feedback');
    return Object.freeze({
        version: ZEN_BONSAI_MORPHOLOGY_STUDY_FEEDBACK_VERSION,
        contract: ZEN_BONSAI_MORPHOLOGY_STUDY_FEEDBACK_CONTRACT,
        backend: ZEN_BONSAI_MORPHOLOGY_STUDY_BACKEND,
        renderer: ZEN_BONSAI_MORPHOLOGY_STUDY_RENDERER,
        caseId: requireId(feedback.caseId, 'feedback.caseId'),
        observableLabels: normalizeObservableFeedbackLabels(
            feedback.observableLabels,
        ),
        deferredLabels: ZEN_BONSAI_MORPHOLOGY_STUDY_DEFERRED_FEEDBACK_LABELS,
        note: normalizeNote(feedback.note),
        evidencePolicy: ZEN_BONSAI_MORPHOLOGY_STUDY_FEEDBACK_POLICY,
    });
};

export const requireZenBonsaiMorphologyStudyFeedback = (value) => {
    const feedback = requirePlainObject(value, 'feedbackContract');
    requireExactKeys(feedback, FEEDBACK_CONTRACT_KEYS, 'feedbackContract');
    if (
        feedback.version !== ZEN_BONSAI_MORPHOLOGY_STUDY_FEEDBACK_VERSION
        || feedback.contract !== ZEN_BONSAI_MORPHOLOGY_STUDY_FEEDBACK_CONTRACT
        || feedback.backend !== ZEN_BONSAI_MORPHOLOGY_STUDY_BACKEND
        || feedback.renderer !== ZEN_BONSAI_MORPHOLOGY_STUDY_RENDERER
    ) {
        fail('feedbackContract.identity');
    }
    const normalized = createZenBonsaiMorphologyStudyFeedback({
        caseId: feedback.caseId,
        observableLabels: feedback.observableLabels,
        note: feedback.note,
    });
    if (
        feedback.observableLabels.length !== normalized.observableLabels.length
        || feedback.observableLabels.some(
            (label, index) => label !== normalized.observableLabels[index],
        )
    ) {
        fail('feedbackContract.observableLabels.not_canonical');
    }
    if (
        feedback.deferredLabels.length !== normalized.deferredLabels.length
        || feedback.deferredLabels.some(
            (label, index) => label !== normalized.deferredLabels[index],
        )
    ) {
        fail('feedbackContract.deferredLabels');
    }
    const policy = requirePlainObject(feedback.evidencePolicy, 'feedbackContract.evidencePolicy');
    requireExactKeys(
        policy,
        Object.keys(ZEN_BONSAI_MORPHOLOGY_STUDY_FEEDBACK_POLICY),
        'feedbackContract.evidencePolicy',
    );
    Object.entries(ZEN_BONSAI_MORPHOLOGY_STUDY_FEEDBACK_POLICY).forEach(([key, expected]) => {
        if (policy[key] !== expected) {
            fail(`feedbackContract.evidencePolicy.${key}`);
        }
    });
    return feedback;
};

const C_SWEEP_ANCHORS = Object.freeze([
    Object.freeze({ x: 0, y: 0 }),
    Object.freeze({ x: 0.02, y: -0.22 }),
    Object.freeze({ x: 0.16, y: -0.46 }),
    Object.freeze({ x: 0.26, y: -0.72 }),
    Object.freeze({ x: 0.18, y: -0.98 }),
]);

const KNUCKLE_ANCHORS = Object.freeze([
    Object.freeze({ x: 0, y: 0 }),
    Object.freeze({ x: 0.01, y: -0.22 }),
    Object.freeze({ x: 0.06, y: -0.34 }),
    Object.freeze({ x: 0.2, y: -0.39 }),
    Object.freeze({ x: 0.3, y: -0.47 }),
    Object.freeze({ x: 0.31, y: -0.7 }),
    Object.freeze({ x: 0.28, y: -0.94 }),
]);

const COMPOUND_ANCHORS = Object.freeze([
    Object.freeze({ x: 0, y: 0 }),
    Object.freeze({ x: -0.04, y: -0.2 }),
    Object.freeze({ x: -0.2, y: -0.38 }),
    Object.freeze({ x: -0.17, y: -0.56 }),
    Object.freeze({ x: 0.04, y: -0.7 }),
    Object.freeze({ x: 0.16, y: -0.94 }),
]);

const DEFAULT_CASE_DEFINITIONS = Object.freeze([
    {
        id: 'procedural/reroll/seed-548',
        title: 'Procedural reroll seed 548',
        seed: 548,
        latentOverrides: {},
        generation: { kind: 'procedural' },
        form: null,
    },
    {
        id: 'procedural/reroll/seed-714',
        title: 'Procedural reroll seed 714',
        seed: 714,
        latentOverrides: {},
        generation: { kind: 'procedural' },
        form: null,
    },
    {
        id: 'procedural/reroll/seed-20260721',
        title: 'Procedural reroll seed 20260721',
        seed: 20260721,
        latentOverrides: {},
        generation: { kind: 'procedural' },
        form: null,
    },
    {
        id: 'procedural/reroll/seed-20260722',
        title: 'Procedural reroll seed 20260722',
        seed: 20260722,
        latentOverrides: {},
        generation: { kind: 'procedural' },
        form: null,
    },
    {
        id: 'procedural/form/formal-upright',
        title: 'Formal upright structural scout',
        seed: 548,
        latentOverrides: {},
        generation: { kind: 'procedural' },
        form: { id: 'formal_upright', variantSeed: 548 },
    },
    {
        id: 'procedural/form/literati',
        title: 'Literati structural scout',
        seed: 714,
        latentOverrides: {},
        generation: { kind: 'procedural' },
        form: { id: 'literati', variantSeed: 714 },
    },
    {
        id: 'procedural/form/full-cascade',
        title: 'Full cascade structural scout',
        seed: 20260721,
        latentOverrides: {},
        generation: { kind: 'procedural' },
        form: { id: 'full_cascade', variantSeed: 20260721 },
    },
    {
        id: 'procedural/form/weeping',
        title: 'Weeping structural scout',
        seed: 20260722,
        latentOverrides: {},
        generation: { kind: 'procedural' },
        form: { id: 'weeping', variantSeed: 20260722 },
    },
    {
        id: 'drawn/authored-guide/c-sweep',
        title: 'Authored C sweep',
        seed: 548,
        latentOverrides: {},
        generation: {
            kind: 'authored_guide',
            anchors: C_SWEEP_ANCHORS,
            adherence: 0.86,
        },
        form: null,
    },
    {
        id: 'drawn/authored-guide/knuckle',
        title: 'Authored shoulder core shoulder knuckle',
        seed: 714,
        latentOverrides: {},
        generation: {
            kind: 'authored_guide',
            anchors: KNUCKLE_ANCHORS,
            adherence: 0.9,
        },
        form: { id: 'slanting', variantSeed: 714 },
    },
    {
        id: 'drawn/reference-family/c-sweep',
        title: 'C sweep reference family',
        seed: 20260721,
        latentOverrides: {},
        generation: {
            kind: 'reference_family',
            anchors: C_SWEEP_ANCHORS,
            likeness: 0.72,
        },
        form: { id: 'literati', variantSeed: 20260721 },
    },
    {
        id: 'drawn/reference-family/compound',
        title: 'Compound bend reference family',
        seed: 20260722,
        latentOverrides: {},
        generation: {
            kind: 'reference_family',
            anchors: COMPOUND_ANCHORS,
            likeness: 0.68,
        },
        form: null,
    },
]);

const DEFAULT_CASES = Object.freeze(
    DEFAULT_CASE_DEFINITIONS.map(normalizeZenBonsaiMorphologyStudyCase),
);

export const createDefaultZenBonsaiMorphologyStudyCases = () => DEFAULT_CASES;
