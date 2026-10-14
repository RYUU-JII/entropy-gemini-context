import {
    BONSAI_CANDIDATE_EVALUATION_PROFILE,
} from '../model/bonsai/evaluation/bonsaiCandidateEvaluationProfile.js';
import { SAKURA_GENERATION_DETAIL } from '../model/sakura/sakuraGenerationDetail.js';
import {
    requireSakuraABQuestionLane,
} from '../model/SakuraABQuestionLanePolicy.js';
import {
    SAKURA_GENERATION_SEMANTICS_ID,
} from '../model/v2/SakuraLearningSemantics.js';
import {
    requireSakuraMacroSpineGuideV1,
} from '../model/sakura/sakuraMacroSpineGuide.js';
import {
    createSakuraMacroSpineGuideConditionV1,
} from '../model/sakura/sakuraMacroSpineGuideCondition.js';
import {
    requireSakuraSpineReferenceFamilyV1,
} from '../model/sakura/sakuraSpineReferenceFamily.js';
import {
    createSakuraSpineReferenceFamilyConditionV1,
} from '../model/sakura/sakuraSpineReferenceFamilyCondition.js';
import {
    createBonsaiSingleRootFormCompositionPrior,
} from '../model/bonsai/morphology/BonsaiSingleRootFormCompositionPrior.js';

const isPlainObject = (value) => Boolean(
    value
    && typeof value === 'object'
    && !Array.isArray(value),
);

const clampInt = (value, fallback = 0) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return fallback;
    }
    return Math.max(0, Math.floor(numeric));
};

const safeString = (value, fallback = null) => (
    typeof value === 'string' && value.trim()
        ? value.trim()
        : fallback
);

const cloneObject = (value) => (isPlainObject(value) ? { ...value } : null);

// This is the release envelope generation, not an implementation revision.
// Pre-release structural/profile changes complete the V1 shape in place; a
// numeric bump is reserved for a post-release compatibility decision.
export const ZEN_TRIAL_CONTRACT_VERSION = 1;
export const ZEN_AB_CANDIDATE_EVALUATION_PROFILE = (
    BONSAI_CANDIDATE_EVALUATION_PROFILE.STRUCTURAL_SCOUT
);
export const ZEN_AB_CANDIDATE_GENERATION_DETAIL = SAKURA_GENERATION_DETAIL.STRUCTURAL_SCOUT;
export const ZEN_AB_CANDIDATE_OBJECTIVE_MODE = 'lane_split';

export const ZEN_TRIAL_ERROR_CODE = Object.freeze({
    INVALID_BATCH_PAYLOAD: 'INVALID_BATCH_PAYLOAD',
    INVALID_TRIAL_SPEC: 'INVALID_TRIAL_SPEC',
    INVALID_TRIAL_LATENT: 'INVALID_TRIAL_LATENT',
    INVALID_CANDIDATE_SPEC: 'INVALID_CANDIDATE_SPEC',
    INVALID_EVALUATION_PROFILE: 'INVALID_EVALUATION_PROFILE',
    INVALID_QUESTION_LANE: 'INVALID_QUESTION_LANE',
    INVALID_GENERATION_SEMANTICS: 'INVALID_GENERATION_SEMANTICS',
    INVALID_SPINE_GUIDE: 'INVALID_SPINE_GUIDE',
    INVALID_SPINE_REFERENCE_FAMILY: 'INVALID_SPINE_REFERENCE_FAMILY',
    CONFLICTING_SPINE_CONDITION: 'CONFLICTING_SPINE_CONDITION',
    INVALID_FORM_COMPOSITION: 'INVALID_FORM_COMPOSITION',
});

export const createTrialContractError = (
    code = ZEN_TRIAL_ERROR_CODE.INVALID_TRIAL_SPEC,
    message = 'Invalid trial contract payload.',
    details = null,
) => {
    const error = new Error(message);
    error.name = 'ZenTrialContractError';
    error.code = code;
    if (details && typeof details === 'object') {
        error.details = details;
    }
    return error;
};

const normalizeLatent = (value, field = 'latent') => {
    if (!isPlainObject(value)) {
        throw createTrialContractError(
            ZEN_TRIAL_ERROR_CODE.INVALID_TRIAL_LATENT,
            `Missing or invalid ${field}.`,
            { field },
        );
    }
    const next = {};
    let finiteCount = 0;
    Object.entries(value).forEach(([key, raw]) => {
        const normalizedKey = safeString(key);
        if (!normalizedKey) {
            return;
        }
        const numeric = Number(raw);
        if (!Number.isFinite(numeric)) {
            return;
        }
        next[normalizedKey] = numeric;
        finiteCount += 1;
    });
    if (!finiteCount) {
        throw createTrialContractError(
            ZEN_TRIAL_ERROR_CODE.INVALID_TRIAL_LATENT,
            `No numeric entries found in ${field}.`,
            { field },
        );
    }
    return next;
};

const cloneSpineGuide = (value = null) => {
    if (value === null || value === undefined) {
        return null;
    }
    try {
        const guide = requireSakuraMacroSpineGuideV1(value);
        return {
            version: guide.version,
            contract: guide.contract,
            coordinateSpace: guide.coordinateSpace,
            guideId: guide.guideId,
            source: guide.source,
            adherence: guide.adherence,
            anchors: guide.anchors.map((anchor) => ({
                id: anchor.id,
                x: anchor.x,
                y: anchor.y,
            })),
        };
    } catch (error) {
        throw createTrialContractError(
            ZEN_TRIAL_ERROR_CODE.INVALID_SPINE_GUIDE,
            'Trial batch spine guide does not satisfy the canonical macro guide contract.',
            {
                reason: String(error?.message || error || 'unknown'),
            },
        );
    }
};

const cloneSpineReferenceFamily = (value = null) => {
    if (value === null || value === undefined) {
        return null;
    }
    try {
        const family = requireSakuraSpineReferenceFamilyV1(value);
        const referenceGuide = requireSakuraMacroSpineGuideV1(family.referenceGuide);
        return {
            ...family,
            referenceGuide: {
                ...referenceGuide,
                anchors: referenceGuide.anchors.map((anchor) => ({ ...anchor })),
            },
        };
    } catch (error) {
        throw createTrialContractError(
            ZEN_TRIAL_ERROR_CODE.INVALID_SPINE_REFERENCE_FAMILY,
            'Trial batch spine reference family does not satisfy the canonical contract.',
            {
                reason: String(error?.message || error || 'unknown'),
            },
        );
    }
};

const normalizeSpineGuideContext = (
    context = {},
    spineGuide = undefined,
    details = {},
) => {
    const hasConditionId = Object.prototype.hasOwnProperty.call(
        context,
        'spineGuideConditionId',
    );
    const hasRole = Object.prototype.hasOwnProperty.call(context, 'spineGuideRole');
    const hasGuideId = Object.prototype.hasOwnProperty.call(context, 'spineGuideId');
    const hasAdherence = Object.prototype.hasOwnProperty.call(context, 'spineGuideAdherence');
    const declaredConditionId = hasConditionId
        ? safeString(context.spineGuideConditionId, null)
        : null;
    const declaredRole = hasRole ? safeString(context.spineGuideRole, null) : null;
    const declaredGuideId = hasGuideId ? safeString(context.spineGuideId, null) : null;
    const declaredAdherence = hasAdherence ? Number(context.spineGuideAdherence) : null;
    if (hasConditionId && !declaredConditionId) {
        throw createTrialContractError(
            ZEN_TRIAL_ERROR_CODE.INVALID_SPINE_GUIDE,
            'Trial context spine guide condition identity is invalid.',
            details,
        );
    }
    if (hasRole && !declaredRole) {
        throw createTrialContractError(
            ZEN_TRIAL_ERROR_CODE.INVALID_SPINE_GUIDE,
            'Trial context spine guide role is invalid.',
            details,
        );
    }
    if (hasGuideId && !declaredGuideId) {
        throw createTrialContractError(
            ZEN_TRIAL_ERROR_CODE.INVALID_SPINE_GUIDE,
            'Trial context spine guide identity is invalid.',
            details,
        );
    }
    if (
        hasAdherence
        && (!Number.isFinite(declaredAdherence) || declaredAdherence < 0 || declaredAdherence > 1)
    ) {
        throw createTrialContractError(
            ZEN_TRIAL_ERROR_CODE.INVALID_SPINE_GUIDE,
            'Trial context spine guide adherence is invalid.',
            details,
        );
    }
    if (spineGuide === undefined) {
        return {
            ...(hasConditionId ? { spineGuideConditionId: declaredConditionId } : {}),
            ...(hasRole ? { spineGuideRole: declaredRole } : {}),
            ...(hasGuideId ? { spineGuideId: declaredGuideId } : {}),
            ...(hasAdherence ? { spineGuideAdherence: declaredAdherence } : {}),
        };
    }
    if (spineGuide === null) {
        if (hasConditionId || hasRole || hasGuideId || hasAdherence) {
            throw createTrialContractError(
                ZEN_TRIAL_ERROR_CODE.INVALID_SPINE_GUIDE,
                'Trial context declares a spine guide but the batch has no guide condition.',
                details,
            );
        }
        return {};
    }
    const condition = createSakuraMacroSpineGuideConditionV1(spineGuide);
    if (
        (hasConditionId && declaredConditionId !== condition.conditionId)
        || (hasRole && declaredRole !== condition.role)
        || (hasGuideId && declaredGuideId !== condition.guideId)
        || (hasAdherence && declaredAdherence !== condition.adherence)
    ) {
        throw createTrialContractError(
            ZEN_TRIAL_ERROR_CODE.INVALID_SPINE_GUIDE,
            'Trial context spine guide does not match the batch guide condition.',
            {
                ...details,
                expectedConditionId: condition.conditionId,
                receivedConditionId: declaredConditionId,
                expectedRole: condition.role,
                receivedRole: declaredRole,
                expectedGuideId: condition.guideId,
                receivedGuideId: declaredGuideId,
                expectedAdherence: condition.adherence,
                receivedAdherence: declaredAdherence,
            },
        );
    }
    return {
        spineGuideConditionId: condition.conditionId,
        spineGuideRole: condition.role,
        spineGuideId: condition.guideId,
        spineGuideAdherence: condition.adherence,
    };
};

const SPINE_REFERENCE_FAMILY_CONTEXT_FIELDS = Object.freeze([
    'spineReferenceFamilyConditionId',
    'spineReferenceFamilyRole',
    'spineReferenceFamilyId',
    'spineReferenceGuideId',
    'spineReferenceLikeness',
    'spineReferenceVariationPolicyId',
]);

const normalizeSpineReferenceFamilyContext = (
    context = {},
    spineReferenceFamily = undefined,
    details = {},
) => {
    const presentFields = SPINE_REFERENCE_FAMILY_CONTEXT_FIELDS.filter((field) => (
        Object.prototype.hasOwnProperty.call(context, field)
    ));
    if (
        presentFields.length > 0
        && presentFields.length !== SPINE_REFERENCE_FAMILY_CONTEXT_FIELDS.length
    ) {
        throw createTrialContractError(
            ZEN_TRIAL_ERROR_CODE.INVALID_SPINE_REFERENCE_FAMILY,
            'Trial context spine reference family tags are incomplete.',
            { ...details, presentFields },
        );
    }
    const hasCondition = presentFields.length === SPINE_REFERENCE_FAMILY_CONTEXT_FIELDS.length;
    const declared = hasCondition ? {
        conditionId: safeString(context.spineReferenceFamilyConditionId, null),
        role: safeString(context.spineReferenceFamilyRole, null),
        familyId: safeString(context.spineReferenceFamilyId, null),
        referenceGuideId: safeString(context.spineReferenceGuideId, null),
        likeness: Number(context.spineReferenceLikeness),
        variationPolicyId: safeString(context.spineReferenceVariationPolicyId, null),
    } : null;
    if (
        declared
        && (
            !declared.conditionId
            || !declared.role
            || !declared.familyId
            || !declared.referenceGuideId
            || !Number.isFinite(declared.likeness)
            || declared.likeness < 0
            || declared.likeness > 1
            || !declared.variationPolicyId
        )
    ) {
        throw createTrialContractError(
            ZEN_TRIAL_ERROR_CODE.INVALID_SPINE_REFERENCE_FAMILY,
            'Trial context spine reference family identity is invalid.',
            details,
        );
    }
    if (spineReferenceFamily === undefined) {
        return hasCondition ? {
            spineReferenceFamilyConditionId: declared.conditionId,
            spineReferenceFamilyRole: declared.role,
            spineReferenceFamilyId: declared.familyId,
            spineReferenceGuideId: declared.referenceGuideId,
            spineReferenceLikeness: declared.likeness,
            spineReferenceVariationPolicyId: declared.variationPolicyId,
        } : {};
    }
    if (spineReferenceFamily === null) {
        if (hasCondition) {
            throw createTrialContractError(
                ZEN_TRIAL_ERROR_CODE.INVALID_SPINE_REFERENCE_FAMILY,
                'Trial context declares a spine reference family but the batch has none.',
                details,
            );
        }
        return {};
    }
    const condition = createSakuraSpineReferenceFamilyConditionV1(spineReferenceFamily);
    if (
        declared
        && (
            declared.conditionId !== condition.conditionId
            || declared.role !== condition.role
            || declared.familyId !== condition.familyId
            || declared.referenceGuideId !== condition.referenceGuideId
            || declared.likeness !== condition.likeness
            || declared.variationPolicyId !== condition.variationPolicyId
        )
    ) {
        throw createTrialContractError(
            ZEN_TRIAL_ERROR_CODE.INVALID_SPINE_REFERENCE_FAMILY,
            'Trial context spine reference family does not match the batch condition.',
            {
                ...details,
                expectedConditionId: condition.conditionId,
                receivedConditionId: declared.conditionId,
            },
        );
    }
    return {
        spineReferenceFamilyConditionId: condition.conditionId,
        spineReferenceFamilyRole: condition.role,
        spineReferenceFamilyId: condition.familyId,
        spineReferenceGuideId: condition.referenceGuideId,
        spineReferenceLikeness: condition.likeness,
        spineReferenceVariationPolicyId: condition.variationPolicyId,
    };
};

const normalizeQuestionLaneFields = (value = {}, details = {}, options = {}) => {
    const context = cloneObject(value?.context);
    const explicitLane = safeString(value?.questionLane, null);
    const contextLane = safeString(context?.questionLane, null);
    if (explicitLane && contextLane && explicitLane !== contextLane) {
        throw createTrialContractError(
            ZEN_TRIAL_ERROR_CODE.INVALID_QUESTION_LANE,
            'Question lane does not match its generation context.',
            {
                ...details,
                questionLane: explicitLane,
                contextQuestionLane: contextLane,
            },
        );
    }
    const candidateLane = explicitLane || contextLane;
    let questionLane = null;
    try {
        questionLane = requireSakuraABQuestionLane(candidateLane);
    } catch {
        throw createTrialContractError(
            ZEN_TRIAL_ERROR_CODE.INVALID_QUESTION_LANE,
            'Trial contract requires an explicit canonical question lane.',
            {
                ...details,
                questionLane: candidateLane,
            },
        );
    }
    const hasGenerationSemantics = Object.prototype.hasOwnProperty.call(
        context || {},
        'generationSemantics',
    );
    const declaredGenerationSemantics = hasGenerationSemantics
        ? safeString(context.generationSemantics, null)
        : null;
    if (
        hasGenerationSemantics
        && declaredGenerationSemantics !== SAKURA_GENERATION_SEMANTICS_ID
    ) {
        throw createTrialContractError(
            ZEN_TRIAL_ERROR_CODE.INVALID_GENERATION_SEMANTICS,
            'Trial contract generation semantics do not match the active generator.',
            {
                ...details,
                expected: SAKURA_GENERATION_SEMANTICS_ID,
                received: declaredGenerationSemantics,
            },
        );
    }
    const spineGuideContext = normalizeSpineGuideContext(
        context || {},
        Object.prototype.hasOwnProperty.call(options, 'spineGuide')
            ? options.spineGuide
            : undefined,
        details,
    );
    const spineReferenceFamilyContext = normalizeSpineReferenceFamilyContext(
        context || {},
        Object.prototype.hasOwnProperty.call(options, 'spineReferenceFamily')
            ? options.spineReferenceFamily
            : undefined,
        details,
    );
    if (
        Object.keys(spineGuideContext).length > 0
        && Object.keys(spineReferenceFamilyContext).length > 0
    ) {
        throw createTrialContractError(
            ZEN_TRIAL_ERROR_CODE.CONFLICTING_SPINE_CONDITION,
            'Trial generation cannot combine a direct spine guide with a spine reference family.',
            details,
        );
    }
    return {
        questionLane,
        context: {
            ...(context || {}),
            questionLane,
            generationSemantics: SAKURA_GENERATION_SEMANTICS_ID,
            ...spineGuideContext,
            ...spineReferenceFamilyContext,
        },
    };
};

const normalizeFormCondition = ({
    formId,
    formVariantSeed,
    fieldPrefix,
    details,
} = {}) => {
    const hasFormId = formId !== null && formId !== undefined;
    const hasVariantSeed = formVariantSeed !== null && formVariantSeed !== undefined;
    if (!hasFormId && !hasVariantSeed) return null;
    if (!hasFormId || !hasVariantSeed) {
        throw createTrialContractError(
            ZEN_TRIAL_ERROR_CODE.INVALID_FORM_COMPOSITION,
            `${fieldPrefix} requires both formId and formVariantSeed.`,
            details,
        );
    }
    const variantSeed = Number(formVariantSeed);
    if (!Number.isSafeInteger(variantSeed) || variantSeed < 0) {
        throw createTrialContractError(
            ZEN_TRIAL_ERROR_CODE.INVALID_FORM_COMPOSITION,
            `${fieldPrefix} formVariantSeed must be a non-negative safe integer.`,
            { ...details, formVariantSeed },
        );
    }
    try {
        const prior = createBonsaiSingleRootFormCompositionPrior({
            formId,
            variantSeed,
        });
        return {
            formId: prior.formId,
            formVariantSeed: prior.variantSeed,
        };
    } catch (error) {
        throw createTrialContractError(
            ZEN_TRIAL_ERROR_CODE.INVALID_FORM_COMPOSITION,
            `${fieldPrefix} does not satisfy the supported single-root form contract.`,
            {
                ...details,
                reason: String(error?.message || error || 'unknown'),
            },
        );
    }
};

const normalizeTrialFormConditions = (trial, details) => {
    const left = normalizeFormCondition({
        formId: trial?.formIdA,
        formVariantSeed: trial?.formVariantSeedA,
        fieldPrefix: 'Trial candidate A',
        details,
    });
    const right = normalizeFormCondition({
        formId: trial?.formIdB,
        formVariantSeed: trial?.formVariantSeedB,
        fieldPrefix: 'Trial candidate B',
        details,
    });
    if (Boolean(left) !== Boolean(right)) {
        throw createTrialContractError(
            ZEN_TRIAL_ERROR_CODE.INVALID_FORM_COMPOSITION,
            'Trial form composition must be declared for both candidates or neither.',
            details,
        );
    }
    return left && right ? {
        formIdA: left.formId,
        formVariantSeedA: left.formVariantSeed,
        formIdB: right.formId,
        formVariantSeedB: right.formVariantSeed,
    } : {};
};

export const normalizeTrialSpec = (
    trial = {},
    options = {},
) => {
    if (!isPlainObject(trial)) {
        throw createTrialContractError(
            ZEN_TRIAL_ERROR_CODE.INVALID_TRIAL_SPEC,
            'Trial spec must be a plain object.',
        );
    }
    const indexFallback = clampInt(options?.index, 0);
    const trialIndex = clampInt(trial?.trialIndex, indexFallback);
    const seedA = clampInt(trial?.seedA, NaN);
    const seedB = clampInt(trial?.seedB, NaN);
    if (!Number.isFinite(seedA) || !Number.isFinite(seedB)) {
        throw createTrialContractError(
            ZEN_TRIAL_ERROR_CODE.INVALID_TRIAL_SPEC,
            'Trial spec requires finite seedA and seedB.',
            { trialIndex },
        );
    }
    const questionLaneFields = normalizeQuestionLaneFields(
        trial,
        { trialIndex },
        options,
    );
    const formConditions = normalizeTrialFormConditions(trial, { trialIndex });

    return {
        contractVersion: ZEN_TRIAL_CONTRACT_VERSION,
        trialIndex,
        questionLane: questionLaneFields.questionLane,
        strategy: safeString(trial?.strategy, 'discover'),
        sharedSeedApplied: Boolean(trial?.sharedSeedApplied),
        seedA,
        seedB,
        latentA: normalizeLatent(trial?.latentA, 'latentA'),
        latentB: normalizeLatent(trial?.latentB, 'latentB'),
        ...formConditions,
        context: questionLaneFields.context,
    };
};

export const normalizeCandidateSpec = (
    candidate = {},
    options = {},
) => {
    if (!isPlainObject(candidate)) {
        throw createTrialContractError(
            ZEN_TRIAL_ERROR_CODE.INVALID_CANDIDATE_SPEC,
            'Candidate spec must be a plain object.',
        );
    }
    const indexFallback = clampInt(options?.index, 0);
    const candidateIndex = clampInt(candidate?.candidateIndex, indexFallback);
    const seed = clampInt(candidate?.seed, NaN);
    if (!Number.isFinite(seed)) {
        throw createTrialContractError(
            ZEN_TRIAL_ERROR_CODE.INVALID_CANDIDATE_SPEC,
            'Candidate spec requires a finite seed.',
            { candidateIndex },
        );
    }
    const questionLaneFields = normalizeQuestionLaneFields(
        candidate,
        { candidateIndex },
        options,
    );
    const formCondition = normalizeFormCondition({
        formId: candidate?.formId,
        formVariantSeed: candidate?.formVariantSeed,
        fieldPrefix: 'Candidate',
        details: { candidateIndex },
    });
    return {
        contractVersion: ZEN_TRIAL_CONTRACT_VERSION,
        candidateIndex,
        questionLane: questionLaneFields.questionLane,
        seed,
        latent: normalizeLatent(candidate?.latent, 'latent'),
        strategy: safeString(candidate?.strategy, 'discover'),
        sharedSeedApplied: Boolean(candidate?.sharedSeedApplied),
        sourceTrialIndex: clampInt(candidate?.sourceTrialIndex, candidateIndex),
        side: safeString(candidate?.side, null),
        ...(formCondition || {}),
        context: questionLaneFields.context,
    };
};

export const normalizeTrialBatchPayload = (payload = {}) => {
    if (!isPlainObject(payload)) {
        throw createTrialContractError(
            ZEN_TRIAL_ERROR_CODE.INVALID_BATCH_PAYLOAD,
            'Trial batch payload must be a plain object.',
        );
    }
    const spineGuide = cloneSpineGuide(payload?.spineGuide);
    const spineReferenceFamily = cloneSpineReferenceFamily(payload?.spineReferenceFamily);
    if (spineGuide && spineReferenceFamily) {
        throw createTrialContractError(
            ZEN_TRIAL_ERROR_CODE.CONFLICTING_SPINE_CONDITION,
            'Trial batch cannot combine a direct spine guide with a spine reference family.',
        );
    }
    const trials = Array.isArray(payload?.trials)
        ? payload.trials
        : [];
    const candidates = Array.isArray(payload?.candidates)
        ? payload.candidates
        : [];
    const normalizedTrials = trials.map((trial, index) => normalizeTrialSpec(trial, {
        index,
        spineGuide,
        spineReferenceFamily,
    }));
    const normalizedCandidates = candidates.map((candidate, index) => normalizeCandidateSpec(candidate, {
        index,
        spineGuide,
        spineReferenceFamily,
    }));
    if (payload?.evaluationProfile !== ZEN_AB_CANDIDATE_EVALUATION_PROFILE) {
        throw createTrialContractError(
            ZEN_TRIAL_ERROR_CODE.INVALID_EVALUATION_PROFILE,
            'A/B candidate evaluation requires the structural scout profile.',
            {
                expected: ZEN_AB_CANDIDATE_EVALUATION_PROFILE,
                received: payload?.evaluationProfile ?? null,
            },
        );
    }
    if (payload?.generationDetail !== ZEN_AB_CANDIDATE_GENERATION_DETAIL) {
        throw createTrialContractError(
            ZEN_TRIAL_ERROR_CODE.INVALID_EVALUATION_PROFILE,
            'A/B candidate generation requires structural detail.',
            {
                expected: ZEN_AB_CANDIDATE_GENERATION_DETAIL,
                received: payload?.generationDetail ?? null,
            },
        );
    }
    if (payload?.objectiveMode !== ZEN_AB_CANDIDATE_OBJECTIVE_MODE) {
        throw createTrialContractError(
            ZEN_TRIAL_ERROR_CODE.INVALID_EVALUATION_PROFILE,
            'A/B structural candidates require the explicit coverage/preference lane objective.',
            {
                expected: ZEN_AB_CANDIDATE_OBJECTIVE_MODE,
                received: payload?.objectiveMode ?? null,
            },
        );
    }
    return {
        ...payload,
        contractVersion: ZEN_TRIAL_CONTRACT_VERSION,
        evaluationProfile: ZEN_AB_CANDIDATE_EVALUATION_PROFILE,
        generationDetail: ZEN_AB_CANDIDATE_GENERATION_DETAIL,
        objectiveMode: ZEN_AB_CANDIDATE_OBJECTIVE_MODE,
        ...(spineGuide ? { spineGuide } : {}),
        ...(spineReferenceFamily ? { spineReferenceFamily } : {}),
        trials: normalizedTrials,
        candidates: normalizedCandidates,
    };
};
