import {
    round,
    clamp01,
} from './ABControllerUtils';
import {
    buildABCandidateSignature,
    buildABPairRenderSignature,
    buildABPairSignature,
    buildABRenderSignature,
} from './ABPairSignature';
import {
    SAKURA_GENERATION_SEMANTICS_ID,
} from './v2/SakuraLearningSemantics';
import {
    requireSakuraMacroSpineGuideV1,
} from './sakura/sakuraMacroSpineGuide';
import {
    createSakuraMacroSpineGuideConditionV1,
} from './sakura/sakuraMacroSpineGuideCondition';
import {
    requireSakuraSpineReferenceFamilyV1,
} from './sakura/sakuraSpineReferenceFamily';
import {
    createSakuraSpineReferenceFamilyConditionV1,
} from './sakura/sakuraSpineReferenceFamilyCondition';
import {
    requireBonsaiMorphologyEvidenceV1,
} from './bonsai/morphology/BonsaiMorphologyEvidenceContract';
import {
    requireBonsaiStructuralComparisonPlanV1,
} from './bonsai/rendering/BonsaiStructuralComparisonPlan';
import {
    requireSakuraSingleRootFormCompositionProvenanceV1,
} from './sakura/sakuraSingleRootFormCompositionAdapter';
import {
    SAKURA_AB_QUESTION_LANE,
} from './SakuraABQuestionLanePolicy';
import {
    SAKURA_AB_FORM_QUESTION_POLICY_ID,
} from './SakuraABFormQuestionPolicy';

export const isFeasibleCandidate = (candidate) => candidate?.feasibility?.pass !== false;

export const cloneModelInput = (value = null) => {
    if (!value || typeof value !== 'object') {
        return null;
    }
    const next = {
        ...value,
    };
    if (value?.features && typeof value.features === 'object') {
        next.features = { ...value.features };
    }
    if (value?.latent && typeof value.latent === 'object') {
        next.latent = { ...value.latent };
    }
    return next;
};

const cloneRenderProvenance = (value = null) => {
    if (!value || typeof value !== 'object') {
        return null;
    }
    if (
        Object.prototype.hasOwnProperty.call(value, 'generationSemantics')
        && value.generationSemantics !== SAKURA_GENERATION_SEMANTICS_ID
    ) {
        throw new Error(
            `ZEN_SAKURA_AB_RENDER_GENERATION_SEMANTICS_MISMATCH:${String(value.generationSemantics)}`,
        );
    }
    const spineGuide = value?.spineGuide
        ? requireSakuraMacroSpineGuideV1(value.spineGuide)
        : null;
    const spineReferenceFamily = value?.spineReferenceFamily
        ? requireSakuraSpineReferenceFamilyV1(value.spineReferenceFamily)
        : null;
    const formComposition = value?.formComposition
        ? requireSakuraSingleRootFormCompositionProvenanceV1(value.formComposition)
        : null;
    if (spineGuide && spineReferenceFamily) {
        throw new Error('ZEN_SAKURA_AB_SPINE_CONDITION_CONFLICT');
    }
    return {
        ...value,
        generationSemantics: SAKURA_GENERATION_SEMANTICS_ID,
        stage: value?.stage && typeof value.stage === 'object'
            ? { ...value.stage }
            : null,
        ...(spineGuide ? {
            spineGuide: {
                ...spineGuide,
                anchors: spineGuide.anchors.map((anchor) => ({ ...anchor })),
            },
        } : {}),
        ...(spineReferenceFamily ? {
            spineReferenceFamily: {
                ...spineReferenceFamily,
                referenceGuide: {
                    ...spineReferenceFamily.referenceGuide,
                    anchors: spineReferenceFamily.referenceGuide.anchors.map(
                        (anchor) => ({ ...anchor }),
                    ),
                },
            },
        } : {}),
        ...(formComposition ? { formComposition: { ...formComposition } } : {}),
    };
};

const cloneMorphologyEvidence = (value = null) => {
    if (!value) return null;
    const evidence = requireBonsaiMorphologyEvidenceV1(value);
    return {
        ...evidence,
        vector: { ...evidence.vector },
        classification: {
            ...evidence.classification,
            secondaryFormIds: [...evidence.classification.secondaryFormIds],
            memberships: evidence.classification.memberships.map((entry) => ({ ...entry })),
        },
    };
};

const cloneStructuralComparisonPlan = (value = null) => {
    if (!value) return null;
    const plan = requireBonsaiStructuralComparisonPlanV1(value);
    return {
        ...plan,
        sceneBounds: { ...plan.sceneBounds },
        trunkPoints: plan.trunkPoints.map((point) => ({ ...point })),
        scaffoldPoints: plan.scaffoldPoints.map((point) => ({ ...point })),
        sourceCounts: { ...plan.sourceCounts },
    };
};

export const compactBackboneMetrics = (candidate = null) => {
    const raw = candidate?.metric?.factors?.backboneMetrics;
    if (!raw || typeof raw !== 'object') {
        return null;
    }
    const depthLogs = Array.isArray(raw?.depthLogs)
        ? raw.depthLogs
            .map((entry) => ({
                depth: Math.max(1, Math.round(Number(entry?.depth || 1))),
                angleErrorDeg: Number.isFinite(Number(entry?.angleErrorDeg))
                    ? round(Number(entry.angleErrorDeg), 2)
                    : null,
                curveError: Number.isFinite(Number(entry?.curveError))
                    ? round(Number(entry.curveError), 4)
                    : 0,
            }))
            .slice(0, 6)
        : [];
    return {
        alignment: round(clamp01(Number(raw?.alignment || 0)), 4),
        curveConsistency: round(clamp01(Number(raw?.curveConsistency || 0)), 4),
        depth1Alignment: round(clamp01(Number(raw?.depth1Alignment || 0)), 4),
        depth2Alignment: round(clamp01(Number(raw?.depth2Alignment || 0)), 4),
        depthStability: round(clamp01(Number(raw?.depthStability || 0)), 4),
        angleErrorMeanDeg: Number.isFinite(Number(raw?.angleErrorMeanDeg))
            ? round(Number(raw.angleErrorMeanDeg), 2)
            : null,
        curveErrorMean: Number.isFinite(Number(raw?.curveErrorMean))
            ? round(Number(raw.curveErrorMean), 4)
            : null,
        depthCount: Math.max(0, Math.round(Number(raw?.depthCount || depthLogs.length))),
        depthLogs,
    };
};

const toPackedCandidate = (candidate = null) => {
    if (
        Object.prototype.hasOwnProperty.call(candidate || {}, 'generationSemantics')
        && candidate.generationSemantics !== SAKURA_GENERATION_SEMANTICS_ID
    ) {
        throw new Error(
            `ZEN_SAKURA_AB_CANDIDATE_GENERATION_SEMANTICS_MISMATCH:${String(candidate.generationSemantics)}`,
        );
    }
    const packed = {
        seed: candidate.seed,
        generationSemantics: SAKURA_GENERATION_SEMANTICS_ID,
        phenotype: candidate.phenotype,
        topology: candidate.topology || null,
        metric: candidate.analysis?.features ? candidate.analysis : candidate.metric,
        modelInput: cloneModelInput(candidate?.modelInput),
        scores: candidate.scores,
        feasibility: candidate?.feasibility ? { ...candidate.feasibility } : null,
        latent: candidate?.latent ? { ...candidate.latent } : null,
        render: cloneRenderProvenance(candidate?.render),
        morphologyEvidence: cloneMorphologyEvidence(candidate?.morphologyEvidence),
        structuralComparisonPlan: cloneStructuralComparisonPlan(
            candidate?.structuralComparisonPlan,
        ),
        backboneMetrics: compactBackboneMetrics(candidate),
    };
    packed.renderSignature = buildABRenderSignature(packed);
    packed.signature = buildABCandidateSignature(packed);
    return packed;
};

const resolvePackedSpineGuideCondition = (candidate = null) => {
    const guide = candidate?.render?.spineGuide || null;
    if (!guide) {
        if (
            Object.prototype.hasOwnProperty.call(candidate?.render || {}, 'spineGuideConditionId')
            || Object.prototype.hasOwnProperty.call(candidate?.render || {}, 'spineGuideRole')
            || Object.prototype.hasOwnProperty.call(candidate?.render || {}, 'spineGuideId')
            || Object.prototype.hasOwnProperty.call(candidate?.render || {}, 'spineGuideAdherence')
        ) {
            throw new Error('ZEN_SAKURA_AB_SPINE_GUIDE_RENDER_PROVENANCE_INVALID');
        }
        return null;
    }
    requireSakuraMacroSpineGuideV1(guide);
    const condition = createSakuraMacroSpineGuideConditionV1(guide);
    if (
        candidate.render.spineGuideConditionId !== condition.conditionId
        || candidate.render.spineGuideRole !== condition.role
        || candidate.render.spineGuideId !== condition.guideId
        || Number(candidate.render.spineGuideAdherence) !== condition.adherence
    ) {
        throw new Error('ZEN_SAKURA_AB_SPINE_GUIDE_RENDER_CONDITION_MISMATCH');
    }
    return condition;
};

const SPINE_REFERENCE_FAMILY_RENDER_FIELDS = Object.freeze([
    'spineReferenceFamilyConditionId',
    'spineReferenceFamilyRole',
    'spineReferenceFamilyId',
    'spineReferenceGuideId',
    'spineReferenceLikeness',
    'spineReferenceVariationPolicyId',
]);

const resolvePackedSpineReferenceFamilyCondition = (candidate = null) => {
    const render = candidate?.render || {};
    const family = render.spineReferenceFamily || null;
    const presentFields = SPINE_REFERENCE_FAMILY_RENDER_FIELDS.filter((field) => (
        Object.prototype.hasOwnProperty.call(render, field)
    ));
    const hasVariantGuideId = Object.prototype.hasOwnProperty.call(
        render,
        'spineReferenceVariantGuideId',
    );
    if (!family) {
        if (presentFields.length > 0 || hasVariantGuideId) {
            throw new Error('ZEN_SAKURA_AB_SPINE_REFERENCE_FAMILY_RENDER_PROVENANCE_INVALID');
        }
        return null;
    }
    if (presentFields.length !== SPINE_REFERENCE_FAMILY_RENDER_FIELDS.length) {
        throw new Error('ZEN_SAKURA_AB_SPINE_REFERENCE_FAMILY_RENDER_PROVENANCE_INCOMPLETE');
    }
    requireSakuraSpineReferenceFamilyV1(family);
    const condition = createSakuraSpineReferenceFamilyConditionV1(family);
    if (
        render.spineReferenceFamilyConditionId !== condition.conditionId
        || render.spineReferenceFamilyRole !== condition.role
        || render.spineReferenceFamilyId !== condition.familyId
        || render.spineReferenceGuideId !== condition.referenceGuideId
        || Number(render.spineReferenceLikeness) !== condition.likeness
        || render.spineReferenceVariationPolicyId !== condition.variationPolicyId
    ) {
        throw new Error('ZEN_SAKURA_AB_SPINE_REFERENCE_FAMILY_RENDER_CONDITION_MISMATCH');
    }
    const variantGuideId = hasVariantGuideId
        && typeof render.spineReferenceVariantGuideId === 'string'
        && render.spineReferenceVariantGuideId.trim()
        ? render.spineReferenceVariantGuideId.trim()
        : null;
    if (!variantGuideId) {
        throw new Error('ZEN_SAKURA_AB_SPINE_REFERENCE_VARIANT_GUIDE_ID_REQUIRED');
    }
    const topologySeed = Number(render.topologySeed);
    if (!Number.isFinite(topologySeed)) {
        throw new Error('ZEN_SAKURA_AB_SPINE_REFERENCE_TOPOLOGY_SEED_REQUIRED');
    }
    return {
        ...condition,
        topologySeed,
        variantGuideId,
    };
};

const resolvePackedFormCondition = (candidate = null) => {
    const evidence = candidate?.morphologyEvidence
        ? requireBonsaiMorphologyEvidenceV1(candidate.morphologyEvidence)
        : null;
    const provenance = candidate?.render?.formComposition
        ? requireSakuraSingleRootFormCompositionProvenanceV1(
            candidate.render.formComposition,
        )
        : null;
    if (Boolean(evidence?.targetFormId) !== Boolean(provenance)) {
        throw new Error('ZEN_SAKURA_AB_FORM_EVIDENCE_PROVENANCE_REQUIRED');
    }
    if (!provenance) return null;
    if (evidence.targetFormId !== provenance.formId) {
        throw new Error('ZEN_SAKURA_AB_FORM_EVIDENCE_PROVENANCE_MISMATCH');
    }
    return {
        formId: provenance.formId,
        variantSeed: provenance.variantSeed,
        planId: provenance.planId,
    };
};

const FORM_CONTEXT_PROVENANCE_FIELDS = Object.freeze([
    'formQuestionPolicyId',
    'formQuestionRelation',
    'targetFormIdA',
    'targetFormIdB',
    'formVariantSeedA',
    'formVariantSeedB',
]);

const requirePackedFormContextConsistency = ({ context, formA, formB, formRelation }) => {
    const presentFields = FORM_CONTEXT_PROVENANCE_FIELDS.filter((field) => (
        Object.prototype.hasOwnProperty.call(context, field)
    ));
    if (!formA) {
        if (presentFields.length > 0) {
            throw new Error('ZEN_SAKURA_AB_FORM_CONTEXT_PROVENANCE_REQUIRED');
        }
        return;
    }
    if (
        presentFields.length > 0
        && presentFields.length !== FORM_CONTEXT_PROVENANCE_FIELDS.length
    ) {
        throw new Error('ZEN_SAKURA_AB_FORM_CONTEXT_PROVENANCE_INCOMPLETE');
    }
    const derived = {
        formQuestionPolicyId: SAKURA_AB_FORM_QUESTION_POLICY_ID,
        formQuestionRelation: formRelation,
        targetFormIdA: formA.formId,
        targetFormIdB: formB.formId,
        formVariantSeedA: formA.variantSeed,
        formVariantSeedB: formB.variantSeed,
    };
    presentFields.forEach((field) => {
        if (context[field] !== derived[field]) {
            throw new Error(`ZEN_SAKURA_AB_FORM_CONTEXT_PROVENANCE_MISMATCH:${field}`);
        }
    });
};

const normalizeActiveGenerationContext = (
    value = null,
    candidateA = null,
    candidateB = null,
) => {
    const context = value && typeof value === 'object' ? { ...value } : {};
    if (
        Object.prototype.hasOwnProperty.call(context, 'generationSemantics')
        && context.generationSemantics !== SAKURA_GENERATION_SEMANTICS_ID
    ) {
        throw new Error(
            `ZEN_SAKURA_AB_GENERATION_SEMANTICS_MISMATCH:${String(context.generationSemantics)}`,
        );
    }
    const guideA = resolvePackedSpineGuideCondition(candidateA);
    const guideB = resolvePackedSpineGuideCondition(candidateB);
    const familyA = resolvePackedSpineReferenceFamilyCondition(candidateA);
    const familyB = resolvePackedSpineReferenceFamilyCondition(candidateB);
    const formA = resolvePackedFormCondition(candidateA);
    const formB = resolvePackedFormCondition(candidateB);
    if ((guideA && familyA) || (guideB && familyB)) {
        throw new Error('ZEN_SAKURA_AB_SPINE_CONDITION_CONFLICT');
    }
    if (Boolean(guideA) !== Boolean(guideB)) {
        throw new Error('ZEN_SAKURA_AB_SPINE_GUIDE_PAIR_CONDITION_REQUIRED');
    }
    if (
        guideA
        && (
            guideA.guideId !== guideB.guideId
            || guideA.adherence !== guideB.adherence
            || guideA.conditionId !== guideB.conditionId
        )
    ) {
        throw new Error('ZEN_SAKURA_AB_SPINE_GUIDE_PAIR_CONDITION_MISMATCH');
    }
    if (Boolean(familyA) !== Boolean(familyB)) {
        throw new Error('ZEN_SAKURA_AB_SPINE_REFERENCE_FAMILY_PAIR_CONDITION_REQUIRED');
    }
    if (
        familyA
        && (
            familyA.conditionId !== familyB.conditionId
            || familyA.familyId !== familyB.familyId
            || familyA.referenceGuideId !== familyB.referenceGuideId
            || familyA.likeness !== familyB.likeness
            || familyA.variationPolicyId !== familyB.variationPolicyId
        )
    ) {
        throw new Error('ZEN_SAKURA_AB_SPINE_REFERENCE_FAMILY_PAIR_CONDITION_MISMATCH');
    }
    if (familyA && familyA.topologySeed !== familyB.topologySeed) {
        throw new Error('ZEN_SAKURA_AB_SPINE_REFERENCE_FAMILY_PAIR_SEED_MISMATCH');
    }
    if (
        familyA
        && (
            familyA.variantGuideId !== familyB.variantGuideId
        )
    ) {
        throw new Error('ZEN_SAKURA_AB_SPINE_REFERENCE_FAMILY_PAIR_VARIANT_MISMATCH');
    }
    if (Boolean(formA) !== Boolean(formB)) {
        throw new Error('ZEN_SAKURA_AB_FORM_PAIR_CONDITION_REQUIRED');
    }
    const questionLane = context?.questionLane || null;
    const formRelation = formA && formA.formId !== formB.formId
        ? 'cross_form_coverage'
        : formA
            ? 'within_form_preference'
            : null;
    requirePackedFormContextConsistency({
        context,
        formA,
        formB,
        formRelation,
    });
    if (
        formA
        && questionLane === SAKURA_AB_QUESTION_LANE.STRUCTURAL_DISCOVERY
        && formRelation !== 'cross_form_coverage'
    ) {
        throw new Error('ZEN_SAKURA_AB_FORM_DISCOVERY_PAIR_DISTINCT_REQUIRED');
    }
    if (
        formA
        && questionLane !== SAKURA_AB_QUESTION_LANE.STRUCTURAL_DISCOVERY
        && formRelation !== 'within_form_preference'
    ) {
        throw new Error('ZEN_SAKURA_AB_FORM_PREFERENCE_PAIR_SHARED_REQUIRED');
    }
    if (
        formA
        && formA.variantSeed !== formB.variantSeed
    ) {
        throw new Error('ZEN_SAKURA_AB_FORM_PAIR_VARIANT_MISMATCH');
    }
    const hasConditionId = Object.prototype.hasOwnProperty.call(
        context,
        'spineGuideConditionId',
    );
    const hasRole = Object.prototype.hasOwnProperty.call(context, 'spineGuideRole');
    const hasGuideId = Object.prototype.hasOwnProperty.call(context, 'spineGuideId');
    const hasAdherence = Object.prototype.hasOwnProperty.call(context, 'spineGuideAdherence');
    if (!guideA && (hasConditionId || hasRole || hasGuideId || hasAdherence)) {
        throw new Error('ZEN_SAKURA_AB_SPINE_GUIDE_PROVENANCE_REQUIRED');
    }
    if (
        guideA
        && (
            (hasConditionId && context.spineGuideConditionId !== guideA.conditionId)
            || (hasRole && context.spineGuideRole !== guideA.role)
            || (hasGuideId && context.spineGuideId !== guideA.guideId)
            || (
                hasAdherence
                && Number(context.spineGuideAdherence) !== guideA.adherence
            )
        )
    ) {
        throw new Error('ZEN_SAKURA_AB_SPINE_GUIDE_CONTEXT_MISMATCH');
    }
    const familyContextFields = [
        'spineReferenceFamilyConditionId',
        'spineReferenceFamilyRole',
        'spineReferenceFamilyId',
        'spineReferenceGuideId',
        'spineReferenceLikeness',
        'spineReferenceVariationPolicyId',
    ];
    const familyContextPresent = familyContextFields.filter((field) => (
        Object.prototype.hasOwnProperty.call(context, field)
    ));
    const hasVariantGuideId = Object.prototype.hasOwnProperty.call(
        context,
        'spineReferenceVariantGuideId',
    );
    if (!familyA && (familyContextPresent.length > 0 || hasVariantGuideId)) {
        throw new Error('ZEN_SAKURA_AB_SPINE_REFERENCE_FAMILY_PROVENANCE_REQUIRED');
    }
    if (
        familyA
        && (
            (
                familyContextPresent.length > 0
                && (
                    familyContextPresent.length !== familyContextFields.length
                    || context.spineReferenceFamilyConditionId !== familyA.conditionId
                    || context.spineReferenceFamilyRole !== familyA.role
                    || context.spineReferenceFamilyId !== familyA.familyId
                    || context.spineReferenceGuideId !== familyA.referenceGuideId
                    || Number(context.spineReferenceLikeness) !== familyA.likeness
                    || context.spineReferenceVariationPolicyId !== familyA.variationPolicyId
                )
            )
            || (
                hasVariantGuideId
                && context.spineReferenceVariantGuideId !== familyA.variantGuideId
            )
        )
    ) {
        throw new Error('ZEN_SAKURA_AB_SPINE_REFERENCE_FAMILY_CONTEXT_MISMATCH');
    }
    return {
        ...context,
        generationSemantics: SAKURA_GENERATION_SEMANTICS_ID,
        ...(guideA ? {
            spineGuideConditionId: guideA.conditionId,
            spineGuideRole: guideA.role,
            spineGuideId: guideA.guideId,
            spineGuideAdherence: guideA.adherence,
        } : {}),
        ...(familyA ? {
            spineReferenceFamilyConditionId: familyA.conditionId,
            spineReferenceFamilyRole: familyA.role,
            spineReferenceFamilyId: familyA.familyId,
            spineReferenceGuideId: familyA.referenceGuideId,
            spineReferenceLikeness: familyA.likeness,
            spineReferenceVariationPolicyId: familyA.variationPolicyId,
            spineReferenceVariantGuideId: familyA.variantGuideId,
        } : {}),
        ...(formA ? {
            formQuestionPolicyId: SAKURA_AB_FORM_QUESTION_POLICY_ID,
            formQuestionRelation: formRelation,
            targetFormIdA: formA.formId,
            targetFormIdB: formB.formId,
            formVariantSeedA: formA.variantSeed,
            formVariantSeedB: formB.variantSeed,
        } : {}),
    };
};

export const createPackedABPair = (
    candidateA,
    candidateB,
    generationContext = { mode: 'learn_mode' },
) => {
    const packedA = toPackedCandidate(candidateA);
    const packedB = toPackedCandidate(candidateB);
    const activeGenerationContext = normalizeActiveGenerationContext(
        generationContext,
        packedA,
        packedB,
    );
    const pair = {
        A: packedA,
        B: packedB,
        createdAt: Date.now(),
        generationContext: activeGenerationContext,
    };
    const pairSignature = buildABPairSignature(pair);
    const renderSignature = buildABPairRenderSignature(pair);
    return {
        ...pair,
        pairSignature,
        renderSignature,
        generationContext: {
            ...pair.generationContext,
            pairSignature,
            renderSignature,
        },
    };
};
