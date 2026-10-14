import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ZenModelRepository from '@/themes/plugins/zen/state/ZenModelRepository.js';
import { ZEN_THEME_MODEL_STATE_KEYS } from '@/themes/plugins/zen/state/ZenThemeModelState.js';
import { createZenThemeModelRuntime } from '../createZenThemeModelRuntime.js';
import { NeuralZen } from '../../model/NeuralZen';
import { SakuraAdditivePairwiseGPModel } from '../../model/SakuraAdditivePairwiseGPModel';
import { encodeNeuralPreferenceTarget } from '../../model/NeuralPreferenceEncoding';
import { SAKURA_V2_AB_HISTORY_LIMIT } from '../../model/ZenLearningConstants';
import { resolveSakuraLearningLatentProfile } from '../../model/v2/SakuraLatentParamApi';
import {
    SAKURA_GENERATION_SEMANTICS_ID,
} from '../../model/v2/SakuraLearningSemantics';
import {
    buildABPairRenderSignature,
    buildABPairSignature,
} from '../../model/ABPairSignature';
import {
    requireSakuraABHistoryNewestFirst,
} from '../../model/SakuraABHistoryOrderContract.js';
import {
    BONSAI_CANDIDATE_EVALUATION_PROFILE,
} from '../../model/bonsai/evaluation/bonsaiCandidateEvaluationProfile';
import {
    requireSakuraABQuestionLane,
} from '../../model/SakuraABQuestionLanePolicy';
import {
    SAKURA_MACRO_SPINE_GUIDE_ROLE,
} from '../../model/sakura/sakuraMacroSpineGuideCondition.js';
import {
    SAKURA_SPINE_REFERENCE_FAMILY_ROLE,
} from '../../model/sakura/sakuraSpineReferenceFamilyCondition.js';
import {
    requireBonsaiMorphologyEvidenceV1,
} from '../../model/bonsai/morphology/BonsaiMorphologyEvidenceContract.js';
import {
    BONSAI_SINGLE_ROOT_SUPPORTED_FORM_IDS,
} from '../../model/bonsai/morphology/BonsaiFormReachabilityPolicy.js';
import {
    requireSakuraMorphologyPreferenceAdmissibilityV1,
    requireSakuraMorphologyPreferenceCalibrationV1,
} from '../../model/SakuraMorphologyPreferencePosterior.js';
import {
    createBonsaiSingleRootFormCompositionPrior,
} from '../../model/bonsai/morphology/BonsaiSingleRootFormCompositionPrior.js';
import {
    SAKURA_AB_FORM_QUESTION_POLICY_ID,
} from '../../model/SakuraABFormQuestionPolicy.js';
import {
    createSakuraSingleRootFormCompositionPlanV1,
    requireSakuraSingleRootFormCompositionProvenanceV1,
} from '../../model/sakura/sakuraSingleRootFormCompositionAdapter.js';
import { compileSakuraPhenotypeFromLatent } from '../../model/v2/SakuraCompiler.js';
export const SAKURA_V2_AB_HISTORY_VERSION = 2;
export const SAKURA_V2_AB_HISTORY_PREDICTION_SOURCE = 'pairwise_compare_pre_feedback';
const SAKURA_V2_AB_HISTORY_PERSIST_DEBOUNCE_MS = 320;
const SAKURA_V2_DECISIVE_PICKS = new Set(['A', 'B', 'WORSE_A', 'WORSE_B']);
const SAKURA_V2_NON_DECISIVE_PICKS = new Set(['BOTH_GOOD', 'PASS']);
const LEARNING_EXCLUDED_FACTOR_IDS = new Set([
    'rootSpread',
    'rootAsymmetry',
]);

const createEmptyLabState = () => ({
    likedCollection: [],
    optimizationLog: [],
    abHistory: [],
    factorTraceLog: [],
    abGeneratedSamples: [],
    referenceCutoffMs: 0,
    trainingCount: 0,
    pairwiseTrainingCount: 0,
});

const applyStateUpdater = (current, nextOrUpdater) => (
    typeof nextOrUpdater === 'function' ? nextOrUpdater(current) : nextOrUpdater
);
const createEmptyPairwiseMeta = () => ({ trainingPairs: 0, avgPairLoss: 0 });
const resolveActivePairwiseMeta = (models = null) => (
    models?.pairwiseGpBrain?.getMeta?.()
    || createEmptyPairwiseMeta()
);
const surfaceAsyncPersistError = (error) => {
    queueMicrotask(() => {
        throw error;
    });
};
const resolvePairwiseTrainingInput = (candidate = null) => {
    const explicit = candidate?.modelInput;
    if (explicit && typeof explicit === 'object') {
        return explicit;
    }
    const features = candidate?.metric?.features;
    const latent = candidate?.latent;
    if (latent && typeof latent === 'object') {
        return {
            latent: { ...latent },
            features: features && typeof features === 'object' ? { ...features } : null,
        };
    }
    if (features && typeof features === 'object') {
        return features;
    }
    return null;
};

const clamp01 = (value) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
const round = (value, digits = 4) => Number((Number.isFinite(value) ? value : 0).toFixed(digits));
const toFiniteOrNull = (value, digits = null) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return null;
    }
    return Number.isFinite(digits) ? round(numeric, digits) : numeric;
};
const toIntOrNull = (value) => {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isFinite(parsed) ? parsed : null;
};
const requireAbHistoryEntryId = (value) => {
    if (!Number.isSafeInteger(value) || value < 0) {
        throw new Error('ZEN_SAKURA_AB_HISTORY_ENTRY_ID_INVALID');
    }
    return value;
};
const requireAbHistoryEntryTimestamp = (value) => {
    if (typeof value !== 'string') {
        throw new Error('ZEN_SAKURA_AB_HISTORY_ENTRY_TIMESTAMP_INVALID');
    }
    return value;
};
const toStringOrNull = (value) => (
    typeof value === 'string' && value.trim() ? value.trim() : null
);
const isPlainObject = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const hasExactKeys = (value, expectedKeys = []) => {
    if (!isPlainObject(value)) return false;
    const actualKeys = Object.keys(value).sort();
    const canonicalKeys = [...expectedKeys].sort();
    return actualKeys.length === canonicalKeys.length
        && actualKeys.every((key, index) => key === canonicalKeys[index]);
};
const isDeepCanonicalEqual = (left, right) => {
    if (Object.is(left, right)) return true;
    if (Array.isArray(left) || Array.isArray(right)) {
        return Array.isArray(left)
            && Array.isArray(right)
            && left.length === right.length
            && left.every((entry, index) => isDeepCanonicalEqual(entry, right[index]));
    }
    if (!isPlainObject(left) || !isPlainObject(right)) return false;
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    return leftKeys.length === rightKeys.length
        && leftKeys.every((key) => (
            Object.prototype.hasOwnProperty.call(right, key)
            && isDeepCanonicalEqual(left[key], right[key])
        ));
};
const normalizePickedToken = (value) => {
    const token = String(value || '').toUpperCase();
    const allowedPicks = new Set([...SAKURA_V2_DECISIVE_PICKS, ...SAKURA_V2_NON_DECISIVE_PICKS]);
    if (!allowedPicks.has(token)) {
        throw new Error(`ZEN_SAKURA_AB_HISTORY_PICK_INVALID:${token || 'missing'}`);
    }
    return token;
};
const sanitizeChangedFactors = (changedFactors = []) => {
    if (!Array.isArray(changedFactors)) {
        return [];
    }
    const sanitized = changedFactors
        .map((factor) => {
            const id = toStringOrNull(factor?.id);
            if (!id) {
                return null;
            }
            if (LEARNING_EXCLUDED_FACTOR_IDS.has(id)) {
                return null;
            }
            const next = { id };
            const label = toStringOrNull(factor?.label);
            if (label) {
                next.label = label;
            }
            const a = toFiniteOrNull(factor?.a, 6);
            const b = toFiniteOrNull(factor?.b, 6);
            if (Number.isFinite(a)) {
                next.a = a;
            }
            if (Number.isFinite(b)) {
                next.b = b;
            }
            return next;
        })
        .filter(Boolean);
    return sanitized;
};
const sanitizeColdStartRepeatAvoidance = (value = null) => {
    if (!value || typeof value !== 'object') {
        return null;
    }
    const usedCount = toFiniteOrNull(value?.usedCount, 0);
    return {
        usedCount: Number.isFinite(usedCount) ? Math.max(0, Math.round(usedCount)) : 0,
        exhausted: Boolean(value?.exhausted),
    };
};
const requirePreferenceLearningString = (value, field) => {
    if (typeof value !== 'string' || !value.trim()) {
        throw new Error(`ZEN_SAKURA_AB_HISTORY_PREFERENCE_LEARNING_STRING_INVALID:${field}`);
    }
    return value.trim();
};
const requirePreferenceLearningFinite = (value, field, { min = -Infinity, max = Infinity } = {}) => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
        throw new Error(`ZEN_SAKURA_AB_HISTORY_PREFERENCE_LEARNING_NUMBER_INVALID:${field}`);
    }
    return value;
};
const requirePreferenceLearningCount = (value, field) => {
    if (!Number.isSafeInteger(value) || value < 0) {
        throw new Error(`ZEN_SAKURA_AB_HISTORY_PREFERENCE_LEARNING_COUNT_INVALID:${field}`);
    }
    return value;
};
const requirePreferenceLearningBoolean = (value, field) => {
    if (typeof value !== 'boolean') {
        throw new Error(`ZEN_SAKURA_AB_HISTORY_PREFERENCE_LEARNING_BOOLEAN_INVALID:${field}`);
    }
    return value;
};
const sanitizePreferenceLearningContext = (value) => {
    if (!isPlainObject(value)) {
        throw new Error('ZEN_SAKURA_AB_HISTORY_PREFERENCE_LEARNING_INVALID');
    }
    if (typeof value.broadProbe !== 'boolean') {
        throw new Error('ZEN_SAKURA_AB_HISTORY_PREFERENCE_LEARNING_BOOLEAN_INVALID:broadProbe');
    }
    return {
        focusFactor: requirePreferenceLearningString(value.focusFactor, 'focusFactor'),
        selectionReason: requirePreferenceLearningString(value.selectionReason, 'selectionReason'),
        stage: requirePreferenceLearningString(value.stage, 'stage'),
        targetPairGapNorm: requirePreferenceLearningFinite(
            value.targetPairGapNorm,
            'targetPairGapNorm',
            { min: 0, max: 1 },
        ),
        ...(hasOwn(value, 'targetPairCenterNorm') ? {
            targetPairCenterNorm: requirePreferenceLearningFinite(
                value.targetPairCenterNorm,
                'targetPairCenterNorm',
                { min: 0, max: 1 },
            ),
        } : {}),
        ...(hasOwn(value, 'centerStrategy') ? {
            centerStrategy: requirePreferenceLearningString(
                value.centerStrategy,
                'centerStrategy',
            ),
        } : {}),
        ...(hasOwn(value, 'spatialProbeOrdinal') ? {
            spatialProbeOrdinal: requirePreferenceLearningCount(
                value.spatialProbeOrdinal,
                'spatialProbeOrdinal',
            ),
        } : {}),
        ...(hasOwn(value, 'wideSpatialProbe') ? {
            wideSpatialProbe: requirePreferenceLearningBoolean(
                value.wideSpatialProbe,
                'wideSpatialProbe',
            ),
        } : {}),
        ...(hasOwn(value, 'abstainStreak') ? {
            abstainStreak: requirePreferenceLearningCount(
                value.abstainStreak,
                'abstainStreak',
            ),
        } : {}),
        ...(hasOwn(value, 'deferredAfterAbstain') ? {
            deferredAfterAbstain: requirePreferenceLearningBoolean(
                value.deferredAfterAbstain,
                'deferredAfterAbstain',
            ),
        } : {}),
        broadProbe: value.broadProbe,
        ...(hasOwn(value, 'schedulerRoundIndex') ? {
            schedulerRoundIndex: requirePreferenceLearningCount(
                value.schedulerRoundIndex,
                'schedulerRoundIndex',
            ),
        } : {}),
        focusEvidenceCount: requirePreferenceLearningCount(
            value.focusEvidenceCount,
            'focusEvidenceCount',
        ),
        focusBasinStage: requirePreferenceLearningString(
            value.focusBasinStage,
            'focusBasinStage',
        ),
        basinCoverage: requirePreferenceLearningFinite(
            value.basinCoverage,
            'basinCoverage',
            { min: 0 },
        ),
        stableFactorRatio: requirePreferenceLearningFinite(
            value.stableFactorRatio,
            'stableFactorRatio',
            { min: 0, max: 1 },
        ),
        ...(hasOwn(value, 'indifferentFactorRatio') ? {
            indifferentFactorRatio: requirePreferenceLearningFinite(
                value.indifferentFactorRatio,
                'indifferentFactorRatio',
                { min: 0, max: 1 },
            ),
        } : {}),
        ...(hasOwn(value, 'resolvedFactorRatio') ? {
            resolvedFactorRatio: requirePreferenceLearningFinite(
                value.resolvedFactorRatio,
                'resolvedFactorRatio',
                { min: 0, max: 1 },
            ),
        } : {}),
        projectedLegacyEntryCount: requirePreferenceLearningCount(
            value.projectedLegacyEntryCount,
            'projectedLegacyEntryCount',
        ),
        learningKeyspaceProfile: requirePreferenceLearningString(
            value.learningKeyspaceProfile,
            'learningKeyspaceProfile',
        ),
        activeFactorCount: requirePreferenceLearningCount(
            value.activeFactorCount,
            'activeFactorCount',
        ),
    };
};
const sanitizeSpineGuideConditionTags = (value = null, boundary = 'context') => {
    const fieldNames = [
        'spineGuideConditionId',
        'spineGuideRole',
        'spineGuideId',
        'spineGuideAdherence',
    ];
    const presentCount = fieldNames.filter((field) => hasOwn(value, field)).length;
    if (presentCount === 0) return null;
    if (presentCount !== fieldNames.length) {
        throw new Error(`ZEN_SAKURA_AB_HISTORY_SPINE_GUIDE_TAGS_INCOMPLETE:${boundary}`);
    }
    const conditionId = toStringOrNull(value.spineGuideConditionId);
    const role = toStringOrNull(value.spineGuideRole);
    const guideId = toStringOrNull(value.spineGuideId);
    const adherence = Number(value.spineGuideAdherence);
    if (
        !conditionId
        || role !== SAKURA_MACRO_SPINE_GUIDE_ROLE
        || !guideId
        || !Number.isFinite(adherence)
        || adherence < 0
        || adherence > 1
    ) {
        throw new Error(`ZEN_SAKURA_AB_HISTORY_SPINE_GUIDE_TAGS_INVALID:${boundary}`);
    }
    return {
        spineGuideConditionId: conditionId,
        spineGuideRole: role,
        spineGuideId: guideId,
        spineGuideAdherence: adherence,
    };
};

const sanitizeSpineReferenceFamilyTags = (value = null, boundary = 'context') => {
    const fieldNames = [
        'spineReferenceFamilyConditionId',
        'spineReferenceFamilyRole',
        'spineReferenceFamilyId',
        'spineReferenceGuideId',
        'spineReferenceLikeness',
        'spineReferenceVariationPolicyId',
    ];
    const presentCount = fieldNames.filter((field) => hasOwn(value, field)).length;
    const hasVariantGuideId = hasOwn(value, 'spineReferenceVariantGuideId');
    if (presentCount === 0 && !hasVariantGuideId) return null;
    if (presentCount !== fieldNames.length) {
        throw new Error(
            `ZEN_SAKURA_AB_HISTORY_SPINE_REFERENCE_FAMILY_TAGS_INCOMPLETE:${boundary}`,
        );
    }
    const conditionId = toStringOrNull(value.spineReferenceFamilyConditionId);
    const role = toStringOrNull(value.spineReferenceFamilyRole);
    const familyId = toStringOrNull(value.spineReferenceFamilyId);
    const referenceGuideId = toStringOrNull(value.spineReferenceGuideId);
    const likeness = Number(value.spineReferenceLikeness);
    const variationPolicyId = toStringOrNull(value.spineReferenceVariationPolicyId);
    const variantGuideId = hasVariantGuideId
        ? toStringOrNull(value.spineReferenceVariantGuideId)
        : null;
    if (
        !conditionId
        || role !== SAKURA_SPINE_REFERENCE_FAMILY_ROLE
        || !familyId
        || !referenceGuideId
        || !Number.isFinite(likeness)
        || likeness < 0
        || likeness > 1
        || !variationPolicyId
        || !variantGuideId
    ) {
        throw new Error(
            `ZEN_SAKURA_AB_HISTORY_SPINE_REFERENCE_FAMILY_TAGS_INVALID:${boundary}`,
        );
    }
    return {
        spineReferenceFamilyConditionId: conditionId,
        spineReferenceFamilyRole: role,
        spineReferenceFamilyId: familyId,
        spineReferenceGuideId: referenceGuideId,
        spineReferenceLikeness: likeness,
        spineReferenceVariationPolicyId: variationPolicyId,
        spineReferenceVariantGuideId: variantGuideId,
    };
};

const FORM_QUESTION_CONTEXT_FIELDS = Object.freeze([
    'formQuestionPolicyId',
    'formQuestionRelation',
    'targetFormIdA',
    'targetFormIdB',
    'formVariantSeedA',
    'formVariantSeedB',
]);

const sanitizeFormQuestionTags = (value = null, boundary = 'context') => {
    const presentCount = FORM_QUESTION_CONTEXT_FIELDS.filter((field) => (
        hasOwn(value, field)
    )).length;
    if (presentCount === 0) return null;
    if (presentCount !== FORM_QUESTION_CONTEXT_FIELDS.length) {
        throw new Error(`ZEN_SAKURA_AB_HISTORY_FORM_QUESTION_TAGS_INCOMPLETE:${boundary}`);
    }
    const policyId = toStringOrNull(value.formQuestionPolicyId);
    const relation = toStringOrNull(value.formQuestionRelation);
    const formIdA = toStringOrNull(value.targetFormIdA);
    const formIdB = toStringOrNull(value.targetFormIdB);
    const variantSeedA = Number(value.formVariantSeedA);
    const variantSeedB = Number(value.formVariantSeedB);
    if (
        policyId !== SAKURA_AB_FORM_QUESTION_POLICY_ID
        || !['cross_form_coverage', 'within_form_preference'].includes(relation)
        || !Number.isSafeInteger(variantSeedA)
        || variantSeedA < 0
        || !Number.isSafeInteger(variantSeedB)
        || variantSeedB < 0
        || variantSeedA !== variantSeedB
    ) {
        throw new Error(`ZEN_SAKURA_AB_HISTORY_FORM_QUESTION_TAGS_INVALID:${boundary}`);
    }
    createBonsaiSingleRootFormCompositionPrior({ formId: formIdA, variantSeed: variantSeedA });
    createBonsaiSingleRootFormCompositionPrior({ formId: formIdB, variantSeed: variantSeedB });
    if (
        (relation === 'cross_form_coverage' && formIdA === formIdB)
        || (relation === 'within_form_preference' && formIdA !== formIdB)
    ) {
        throw new Error(`ZEN_SAKURA_AB_HISTORY_FORM_QUESTION_RELATION_INVALID:${boundary}`);
    }
    return {
        formQuestionPolicyId: policyId,
        formQuestionRelation: relation,
        targetFormIdA: formIdA,
        targetFormIdB: formIdB,
        formVariantSeedA: variantSeedA,
        formVariantSeedB: variantSeedB,
    };
};

const sanitizeLearningObjectives = (value = null) => {
    const expectedKeys = [
        'active',
        'morphologyEvidenceCount',
        'proposalEvidenceCount',
        'proposalFormCounts',
        'proposalCoverageRatio',
        'proposalNormalizedEntropy',
        'realizedPrimaryEvidenceCount',
        'realizedPrimaryUnclassifiedCount',
        'realizedPrimaryUnsupportedCount',
        'realizedPrimaryFormCounts',
        'realizedPrimaryCoverageRatio',
        'realizedPrimaryNormalizedEntropy',
        'realizedMembershipEvidenceCount',
        'realizedMembershipHitCount',
        'realizedMembershipFormCounts',
        'realizedMembershipCoverageRatio',
        'realizedMembershipNormalizedEntropy',
        'targetAcceptanceEligibleCount',
        'targetAcceptanceAcceptedCount',
        'targetAcceptanceRate',
        'perFormTargetAcceptance',
        'globalPreferenceConfidence',
        'perFormPreferenceConfidence',
        'morphologyPreferenceAdmissibility',
        'morphologyPreferenceCalibration',
        'minimumVisibleDistancePx',
    ];
    if (!hasExactKeys(value, expectedKeys)) {
        throw new Error('ZEN_SAKURA_AB_HISTORY_LEARNING_OBJECTIVES_INVALID');
    }
    const active = toStringOrNull(value.active);
    const proposalCoverageRatio = Number(value.proposalCoverageRatio);
    const proposalNormalizedEntropy = Number(value.proposalNormalizedEntropy);
    const realizedPrimaryCoverageRatio = Number(value.realizedPrimaryCoverageRatio);
    const realizedPrimaryNormalizedEntropy = Number(value.realizedPrimaryNormalizedEntropy);
    const realizedMembershipCoverageRatio = Number(value.realizedMembershipCoverageRatio);
    const realizedMembershipNormalizedEntropy = Number(value.realizedMembershipNormalizedEntropy);
    const targetAcceptanceRate = Number(value.targetAcceptanceRate);
    const globalPreferenceConfidence = Number(value.globalPreferenceConfidence);
    const morphologyPreferenceAdmissibility = (
        requireSakuraMorphologyPreferenceAdmissibilityV1(
            value.morphologyPreferenceAdmissibility,
        )
    );
    const morphologyPreferenceCalibration = (
        requireSakuraMorphologyPreferenceCalibrationV1(
            value.morphologyPreferenceCalibration,
        )
    );
    const minimumVisibleDistancePx = Number(value.minimumVisibleDistancePx);
    const integerFields = [
        'morphologyEvidenceCount',
        'proposalEvidenceCount',
        'realizedPrimaryEvidenceCount',
        'realizedPrimaryUnclassifiedCount',
        'realizedPrimaryUnsupportedCount',
        'realizedMembershipEvidenceCount',
        'realizedMembershipHitCount',
        'targetAcceptanceEligibleCount',
        'targetAcceptanceAcceptedCount',
    ];
    const integers = Object.fromEntries(integerFields.map((field) => [field, Number(value[field])]));
    if (
        !['morphology_coverage', 'latent_and_morphology_preference'].includes(active)
        || ![
            proposalCoverageRatio,
            proposalNormalizedEntropy,
            realizedPrimaryCoverageRatio,
            realizedPrimaryNormalizedEntropy,
            realizedMembershipCoverageRatio,
            realizedMembershipNormalizedEntropy,
            targetAcceptanceRate,
            globalPreferenceConfidence,
        ].every((metric) => (
            Number.isFinite(metric) && metric >= 0 && metric <= 1
        ))
        || !Object.values(integers).every((count) => (
            Number.isSafeInteger(count) && count >= 0
        ))
        || integers.targetAcceptanceAcceptedCount > integers.targetAcceptanceEligibleCount
        || !Number.isFinite(minimumVisibleDistancePx)
        || minimumVisibleDistancePx <= 0
        || !isPlainObject(value.perFormPreferenceConfidence)
        || !isPlainObject(value.proposalFormCounts)
        || !isPlainObject(value.realizedPrimaryFormCounts)
        || !isPlainObject(value.realizedMembershipFormCounts)
        || !isPlainObject(value.perFormTargetAcceptance)
    ) {
        throw new Error('ZEN_SAKURA_AB_HISTORY_LEARNING_OBJECTIVES_INVALID');
    }
    const proposalFormCounts = {};
    const realizedPrimaryFormCounts = {};
    const realizedMembershipFormCounts = {};
    const perFormTargetAcceptance = {};
    const perFormPreferenceConfidence = Object.fromEntries(
        BONSAI_SINGLE_ROOT_SUPPORTED_FORM_IDS.map((formId) => {
            const confidence = Number(value.perFormPreferenceConfidence[formId]);
            const proposalCount = Number(value.proposalFormCounts[formId]);
            const realizedPrimaryCount = Number(value.realizedPrimaryFormCounts[formId]);
            const realizedMembershipCount = Number(value.realizedMembershipFormCounts[formId]);
            const acceptance = value.perFormTargetAcceptance[formId];
            if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
                throw new Error(
                    `ZEN_SAKURA_AB_HISTORY_FORM_CONFIDENCE_INVALID:${formId}`,
                );
            }
            if (
                confidence !== morphologyPreferenceCalibration.perForm[formId].confidence
            ) {
                throw new Error(
                    `ZEN_SAKURA_AB_HISTORY_FORM_CALIBRATION_CONFIDENCE_MISMATCH:${formId}`,
                );
            }
            if (
                !Number.isSafeInteger(proposalCount)
                || proposalCount < 0
                || !Number.isSafeInteger(realizedPrimaryCount)
                || realizedPrimaryCount < 0
                || !Number.isSafeInteger(realizedMembershipCount)
                || realizedMembershipCount < 0
            ) {
                throw new Error(`ZEN_SAKURA_AB_HISTORY_FORM_COVERAGE_COUNT_INVALID:${formId}`);
            }
            if (!hasExactKeys(acceptance, ['eligibleCount', 'acceptedCount', 'rate'])) {
                throw new Error(`ZEN_SAKURA_AB_HISTORY_FORM_ACCEPTANCE_INVALID:${formId}`);
            }
            const eligibleCount = Number(acceptance.eligibleCount);
            const acceptedCount = Number(acceptance.acceptedCount);
            const rate = Number(acceptance.rate);
            const expectedRate = round(eligibleCount > 0 ? acceptedCount / eligibleCount : 0, 4);
            if (
                !Number.isSafeInteger(eligibleCount)
                || eligibleCount < 0
                || !Number.isSafeInteger(acceptedCount)
                || acceptedCount < 0
                || acceptedCount > eligibleCount
                || !Number.isFinite(rate)
                || rate < 0
                || rate > 1
                || rate !== expectedRate
            ) {
                throw new Error(`ZEN_SAKURA_AB_HISTORY_FORM_ACCEPTANCE_INVALID:${formId}`);
            }
            proposalFormCounts[formId] = proposalCount;
            realizedPrimaryFormCounts[formId] = realizedPrimaryCount;
            realizedMembershipFormCounts[formId] = realizedMembershipCount;
            perFormTargetAcceptance[formId] = { eligibleCount, acceptedCount, rate };
            return [formId, confidence];
        }),
    );
    const resolveCoverageMetrics = (counts, total) => {
        const coveredFormCount = Object.values(counts).filter((count) => count > 0).length;
        const entropy = Object.values(counts).reduce((sum, count) => {
            const probability = total > 0 ? count / total : 0;
            return probability > 0 ? sum - (probability * Math.log(probability)) : sum;
        }, 0);
        return {
            ratio: round(coveredFormCount / BONSAI_SINGLE_ROOT_SUPPORTED_FORM_IDS.length, 4),
            entropy: round(
                entropy / Math.log(BONSAI_SINGLE_ROOT_SUPPORTED_FORM_IDS.length),
                4,
            ),
        };
    };
    const proposalMetrics = resolveCoverageMetrics(
        proposalFormCounts,
        integers.proposalEvidenceCount,
    );
    const realizedPrimaryMetrics = resolveCoverageMetrics(
        realizedPrimaryFormCounts,
        integers.realizedPrimaryEvidenceCount,
    );
    const realizedMembershipMetrics = resolveCoverageMetrics(
        realizedMembershipFormCounts,
        integers.realizedMembershipHitCount,
    );
    if (
        Object.keys(value.perFormPreferenceConfidence).length
        !== BONSAI_SINGLE_ROOT_SUPPORTED_FORM_IDS.length
        || Object.keys(value.proposalFormCounts).length
        !== BONSAI_SINGLE_ROOT_SUPPORTED_FORM_IDS.length
        || Object.keys(value.realizedPrimaryFormCounts).length
        !== BONSAI_SINGLE_ROOT_SUPPORTED_FORM_IDS.length
        || Object.keys(value.realizedMembershipFormCounts).length
        !== BONSAI_SINGLE_ROOT_SUPPORTED_FORM_IDS.length
        || Object.keys(value.perFormTargetAcceptance).length
        !== BONSAI_SINGLE_ROOT_SUPPORTED_FORM_IDS.length
        || Object.values(proposalFormCounts).reduce((sum, count) => sum + count, 0)
        !== integers.proposalEvidenceCount
        || integers.proposalEvidenceCount > integers.morphologyEvidenceCount
        || integers.realizedPrimaryEvidenceCount
            + integers.realizedPrimaryUnclassifiedCount
            + integers.realizedPrimaryUnsupportedCount
        !== integers.morphologyEvidenceCount
        || Object.values(realizedPrimaryFormCounts).reduce((sum, count) => sum + count, 0)
        !== integers.realizedPrimaryEvidenceCount
        || Object.values(realizedMembershipFormCounts).reduce((sum, count) => sum + count, 0)
        !== integers.realizedMembershipHitCount
        || integers.realizedMembershipEvidenceCount > integers.morphologyEvidenceCount
        || integers.targetAcceptanceEligibleCount !== integers.proposalEvidenceCount
        || proposalCoverageRatio !== proposalMetrics.ratio
        || proposalNormalizedEntropy !== proposalMetrics.entropy
        || realizedPrimaryCoverageRatio !== realizedPrimaryMetrics.ratio
        || realizedPrimaryNormalizedEntropy !== realizedPrimaryMetrics.entropy
        || realizedMembershipCoverageRatio !== realizedMembershipMetrics.ratio
        || realizedMembershipNormalizedEntropy !== realizedMembershipMetrics.entropy
        || Object.values(perFormTargetAcceptance).reduce(
            (sum, entry) => sum + entry.eligibleCount,
            0,
        ) !== integers.targetAcceptanceEligibleCount
        || Object.values(perFormTargetAcceptance).reduce(
            (sum, entry) => sum + entry.acceptedCount,
            0,
        ) !== integers.targetAcceptanceAcceptedCount
        || targetAcceptanceRate !== round(
            integers.targetAcceptanceEligibleCount > 0
                ? integers.targetAcceptanceAcceptedCount / integers.targetAcceptanceEligibleCount
                : 0,
            4,
        )
        || globalPreferenceConfidence
            !== morphologyPreferenceCalibration.global.confidence
        || morphologyPreferenceCalibration.global.predictionCount
            !== morphologyPreferenceAdmissibility.globalCrossFormPairCount
        || BONSAI_SINGLE_ROOT_SUPPORTED_FORM_IDS.some((formId) => (
            morphologyPreferenceCalibration.perForm[formId].predictionCount
                !== morphologyPreferenceAdmissibility.perFormAdmittedCounts[formId]
        ))
    ) {
        throw new Error('ZEN_SAKURA_AB_HISTORY_LEARNING_OBJECTIVES_COUNTS_INVALID');
    }
    return {
        active,
        ...integers,
        proposalFormCounts,
        proposalCoverageRatio,
        proposalNormalizedEntropy,
        realizedPrimaryFormCounts,
        realizedPrimaryCoverageRatio,
        realizedPrimaryNormalizedEntropy,
        realizedMembershipFormCounts,
        realizedMembershipCoverageRatio,
        realizedMembershipNormalizedEntropy,
        targetAcceptanceRate,
        perFormTargetAcceptance,
        globalPreferenceConfidence,
        perFormPreferenceConfidence,
        morphologyPreferenceAdmissibility,
        morphologyPreferenceCalibration,
        minimumVisibleDistancePx,
    };
};

const sanitizeGenerationContext = (context = null) => {
    if (!context || typeof context !== 'object') {
        return null;
    }
    const queryKind = toStringOrNull(context?.queryKind);
    const hasGenerationSemantics = hasOwn(context, 'generationSemantics');
    const generationSemantics = hasGenerationSemantics
        ? toStringOrNull(context.generationSemantics)
        : null;
    if (hasGenerationSemantics && !generationSemantics) {
        throw new Error('ZEN_SAKURA_AB_HISTORY_GENERATION_SEMANTICS_INVALID');
    }
    const hasQuestionLane = hasOwn(context, 'questionLane');
    const questionLane = hasQuestionLane
        ? requireSakuraABQuestionLane(context.questionLane)
        : null;
    const pairType = toStringOrNull(context?.pairType);
    const hasSharedSeedPolicy = hasOwn(context, 'sharedSeedPolicy');
    const sharedSeedPolicy = hasSharedSeedPolicy
        ? toStringOrNull(context.sharedSeedPolicy)
        : null;
    if (
        hasSharedSeedPolicy
        && sharedSeedPolicy !== 'shared'
        && sharedSeedPolicy !== 'independent'
    ) {
        throw new Error('ZEN_SAKURA_AB_HISTORY_SHARED_SEED_POLICY_INVALID');
    }
    const pairSignature = toStringOrNull(context?.pairSignature);
    const renderSignature = toStringOrNull(context?.renderSignature);
    const coldStartPairSignature = toStringOrNull(context?.coldStartPairSignature);
    const coldStartRepeatAvoidance = sanitizeColdStartRepeatAvoidance(
        context?.coldStartRepeatAvoidance,
    );
    const latentSpace = toStringOrNull(context?.latentSpace);
    const learningKeyspaceProfile = toStringOrNull(context?.learningKeyspaceProfile);
    const spineGuideCondition = sanitizeSpineGuideConditionTags(
        context,
        'generation_context',
    );
    const spineReferenceFamily = sanitizeSpineReferenceFamilyTags(
        context,
        'generation_context',
    );
    const formQuestion = sanitizeFormQuestionTags(context, 'generation_context');
    if (spineGuideCondition && spineReferenceFamily) {
        throw new Error('ZEN_SAKURA_AB_HISTORY_SPINE_CONDITION_CONFLICT:generation_context');
    }
    const hasTargetPairGapNorm = hasOwn(context, 'targetPairGapNorm');
    const targetPairGapNorm = hasTargetPairGapNorm
        ? requirePreferenceLearningFinite(
            context.targetPairGapNorm,
            'generationContext.targetPairGapNorm',
            { min: 0, max: 1 },
        )
        : null;
    const hasTargetPairCenterNorm = hasOwn(context, 'targetPairCenterNorm');
    const targetPairCenterNorm = hasTargetPairCenterNorm
        ? requirePreferenceLearningFinite(
            context.targetPairCenterNorm,
            'generationContext.targetPairCenterNorm',
            { min: 0, max: 1 },
        )
        : null;
    const hasRealizedPairCenterNorm = hasOwn(context, 'realizedPairCenterNorm');
    const realizedPairCenterNorm = hasRealizedPairCenterNorm
        ? requirePreferenceLearningFinite(
            context.realizedPairCenterNorm,
            'generationContext.realizedPairCenterNorm',
            { min: 0, max: 1 },
        )
        : null;
    const hasRealizedPairGapNorm = hasOwn(context, 'realizedPairGapNorm');
    const realizedPairGapNorm = hasRealizedPairGapNorm
        ? requirePreferenceLearningFinite(
            context.realizedPairGapNorm,
            'generationContext.realizedPairGapNorm',
            { min: 0, max: 1 },
        )
        : null;
    const hasPreferenceLearning = hasOwn(context, 'preferenceLearning');
    const preferenceLearning = hasPreferenceLearning
        ? sanitizePreferenceLearningContext(context.preferenceLearning)
        : null;
    const hasLearningObjectives = isPlainObject(context?.questionQuality)
        && hasOwn(context.questionQuality, 'learningObjectives');
    const learningObjectives = hasLearningObjectives
        ? sanitizeLearningObjectives(context.questionQuality.learningObjectives)
        : null;
    const hasLatentComparisonRole = hasOwn(context, 'latentComparisonRole');
    const latentComparisonRole = hasLatentComparisonRole
        ? toStringOrNull(context.latentComparisonRole)
        : null;
    if (hasLatentComparisonRole && !latentComparisonRole) {
        throw new Error('ZEN_SAKURA_AB_HISTORY_LATENT_COMPARISON_ROLE_INVALID');
    }
    if (
        hasTargetPairGapNorm
        && hasPreferenceLearning
        && targetPairGapNorm !== preferenceLearning.targetPairGapNorm
    ) {
        throw new Error('ZEN_SAKURA_AB_HISTORY_PREFERENCE_LEARNING_GAP_MISMATCH');
    }
    if (
        hasTargetPairCenterNorm
        && hasPreferenceLearning
        && targetPairCenterNorm !== preferenceLearning.targetPairCenterNorm
    ) {
        throw new Error('ZEN_SAKURA_AB_HISTORY_PREFERENCE_LEARNING_CENTER_MISMATCH');
    }
    if (
        learningKeyspaceProfile
        && hasPreferenceLearning
        && learningKeyspaceProfile !== preferenceLearning.learningKeyspaceProfile
    ) {
        throw new Error('ZEN_SAKURA_AB_HISTORY_PREFERENCE_LEARNING_KEYSPACE_MISMATCH');
    }
    const changedFactors = sanitizeChangedFactors(context?.changedFactors);
    const changedTierIds = Array.isArray(context?.changedTierIds)
        ? context.changedTierIds.map(toStringOrNull).filter(Boolean)
        : [];
    const boundedChangedTierIds = changedTierIds;
    if (
        !queryKind
        && !hasGenerationSemantics
        && !hasQuestionLane
        && !pairType
        && !hasSharedSeedPolicy
        && !pairSignature
        && !renderSignature
        && !coldStartPairSignature
        && !coldStartRepeatAvoidance
        && !hasTargetPairGapNorm
        && !hasTargetPairCenterNorm
        && !hasRealizedPairCenterNorm
        && !hasRealizedPairGapNorm
        && !hasPreferenceLearning
        && !spineGuideCondition
        && !spineReferenceFamily
        && !formQuestion
        && !hasLearningObjectives
        && !hasLatentComparisonRole
        && !changedFactors.length
        && !boundedChangedTierIds.length
    ) {
        return null;
    }
    return {
        queryKind: queryKind || null,
        ...(hasGenerationSemantics ? { generationSemantics } : {}),
        ...(hasQuestionLane ? { questionLane } : {}),
        pairType: pairType || null,
        ...(hasSharedSeedPolicy ? { sharedSeedPolicy } : {}),
        pairSignature: pairSignature || null,
        renderSignature: renderSignature || null,
        coldStartPairSignature: coldStartPairSignature || null,
        coldStartRepeatAvoidance,
        latentSpace: latentSpace || null,
        learningKeyspaceProfile: learningKeyspaceProfile || null,
        ...(spineGuideCondition || {}),
        ...(spineReferenceFamily || {}),
        ...(formQuestion || {}),
        ...(hasLatentComparisonRole ? { latentComparisonRole } : {}),
        ...(hasTargetPairGapNorm ? { targetPairGapNorm } : {}),
        ...(hasTargetPairCenterNorm ? { targetPairCenterNorm } : {}),
        ...(hasRealizedPairCenterNorm ? { realizedPairCenterNorm } : {}),
        ...(hasRealizedPairGapNorm ? { realizedPairGapNorm } : {}),
        ...(hasPreferenceLearning ? { preferenceLearning } : {}),
        ...(hasLearningObjectives ? {
            questionQuality: { learningObjectives },
        } : {}),
        sharedSeedApplied: Boolean(context?.sharedSeedApplied),
        coldStart: Boolean(context?.coldStart),
        comparabilityTarget: toFiniteOrNull(context?.comparabilityTarget, 4),
        changedFactors,
        changedTierIds: boundedChangedTierIds,
    };
};
const sanitizeScoreDelta = (raw = {}) => ({
    rule: round(Number(raw?.rule || 0), 4),
    neural: round(Number(raw?.neural || 0), 4),
    pairwise: round(Number(raw?.pairwise || 0), 4),
    pairwiseRaw: round(Number(raw?.pairwiseRaw ?? raw?.pairwise ?? 0), 4),
    pairwiseCalibrated: round(Number(raw?.pairwiseCalibrated ?? raw?.pairwise ?? 0), 4),
    novelty: round(Number(raw?.novelty || 0), 4),
    blended: round(Number(raw?.blended || 0), 4),
});
const sanitizeWeights = (raw = {}) => {
    const keys = [
        'pairwise',
        'neural',
        'pairwiseTie',
        'neuralTie',
        'uncertaintyBoost',
        'neutral',
        'morphology',
        'collection',
        'suppression',
        'skip',
        'calibration',
    ];
    const next = {};
    keys.forEach((key) => {
        const numeric = toFiniteOrNull(raw?.[key], 4);
        if (Number.isFinite(numeric)) {
            next[key] = numeric;
        }
    });
    return next;
};
const sanitizeBackboneMetrics = (value = null) => {
    if (!value || typeof value !== 'object') {
        return null;
    }
    const depthLogs = Array.isArray(value?.depthLogs)
        ? value.depthLogs
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
        alignment: clamp01(Number(value?.alignment || 0)),
        curveConsistency: clamp01(Number(value?.curveConsistency || 0)),
        depth1Alignment: clamp01(Number(value?.depth1Alignment || 0)),
        depth2Alignment: clamp01(Number(value?.depth2Alignment || 0)),
        depthStability: clamp01(Number(value?.depthStability || 0)),
        angleErrorMeanDeg: Number.isFinite(Number(value?.angleErrorMeanDeg))
            ? round(Number(value.angleErrorMeanDeg), 2)
            : null,
        curveErrorMean: Number.isFinite(Number(value?.curveErrorMean))
            ? round(Number(value.curveErrorMean), 4)
            : null,
        depthCount: Math.max(0, Math.round(Number(value?.depthCount || depthLogs.length))),
        depthLogs,
    };
};
const sanitizeLatentSnapshot = (value = null) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    const next = {};
    Object.entries(value).forEach(([key, raw]) => {
        const normalizedKey = toStringOrNull(key);
        const numeric = toFiniteOrNull(raw, 6);
        if (normalizedKey && Number.isFinite(numeric)) {
            next[normalizedKey] = numeric;
        }
    });
    return Object.keys(next).length ? next : null;
};
const sanitizeRenderSnapshot = (value = null) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    const stage = value?.stage && typeof value.stage === 'object' && !Array.isArray(value.stage)
        ? { ...value.stage }
        : null;
    const hasGenerationSemantics = hasOwn(value, 'generationSemantics');
    const generationSemantics = hasGenerationSemantics
        ? toStringOrNull(value.generationSemantics)
        : null;
    const hasEvaluationProfile = hasOwn(value, 'evaluationProfile');
    const evaluationProfile = hasEvaluationProfile
        ? toStringOrNull(value.evaluationProfile)
        : null;
    const hasGenerationDetail = hasOwn(value, 'generationDetail');
    const generationDetail = hasGenerationDetail
        ? toStringOrNull(value.generationDetail)
        : null;
    const spineGuideCondition = sanitizeSpineGuideConditionTags(value, 'render');
    const spineReferenceFamily = sanitizeSpineReferenceFamilyTags(value, 'render');
    const formComposition = hasOwn(value, 'formComposition')
        ? requireSakuraSingleRootFormCompositionProvenanceV1(value.formComposition)
        : null;
    const hasAcquisitionObjective = hasOwn(value, 'acquisitionObjective');
    const acquisitionObjective = hasAcquisitionObjective
        ? toStringOrNull(value.acquisitionObjective)
        : null;
    if (spineGuideCondition && spineReferenceFamily) {
        throw new Error('ZEN_SAKURA_AB_HISTORY_SPINE_CONDITION_CONFLICT:render');
    }
    if (hasEvaluationProfile && !evaluationProfile) {
        throw new Error('ZEN_SAKURA_AB_HISTORY_EVALUATION_PROFILE_INVALID');
    }
    if (hasGenerationDetail && !generationDetail) {
        throw new Error('ZEN_SAKURA_AB_HISTORY_GENERATION_DETAIL_INVALID');
    }
    if (hasGenerationSemantics && !generationSemantics) {
        throw new Error('ZEN_SAKURA_AB_HISTORY_GENERATION_SEMANTICS_INVALID');
    }
    if (
        hasAcquisitionObjective
        && !['morphology_coverage', 'latent_and_morphology_preference'].includes(
            acquisitionObjective,
        )
    ) {
        throw new Error('ZEN_SAKURA_AB_HISTORY_ACQUISITION_OBJECTIVE_INVALID');
    }
    return {
        source: toStringOrNull(value?.source),
        ...(hasGenerationSemantics ? { generationSemantics } : {}),
        ...(hasEvaluationProfile ? { evaluationProfile } : {}),
        ...(hasGenerationDetail ? { generationDetail } : {}),
        seed: toFiniteOrNull(value?.seed, 0),
        topologySeed: toFiniteOrNull(value?.topologySeed, 0),
        stageSeedOffset: toFiniteOrNull(value?.stageSeedOffset, 0),
        stageProfileIndex: toFiniteOrNull(value?.stageProfileIndex, 0),
        stageProfileId: toStringOrNull(value?.stageProfileId),
        topologyReferenceHeight: toFiniteOrNull(value?.topologyReferenceHeight, 3),
        ...(spineGuideCondition || {}),
        ...(spineReferenceFamily || {}),
        ...(formComposition ? { formComposition: { ...formComposition } } : {}),
        ...(hasAcquisitionObjective ? { acquisitionObjective } : {}),
        stage,
    };
};
const sanitizeCandidateSnapshot = (value = {}) => {
    const hasGenerationSemantics = hasOwn(value, 'generationSemantics');
    const generationSemantics = hasGenerationSemantics
        ? toStringOrNull(value.generationSemantics)
        : null;
    if (hasGenerationSemantics && !generationSemantics) {
        throw new Error('ZEN_SAKURA_AB_HISTORY_GENERATION_SEMANTICS_INVALID');
    }
    const morphologyEvidence = hasOwn(value, 'morphologyEvidence')
        && value.morphologyEvidence !== null
        ? requireBonsaiMorphologyEvidenceV1(value.morphologyEvidence)
        : null;
    return {
        seed: toIntOrNull(value?.seed),
        ...(hasGenerationSemantics ? { generationSemantics } : {}),
        score: toFiniteOrNull(value?.score ?? value?.blended ?? 0, 4) ?? 0,
        pairwiseScore: clamp01(Number(value?.pairwiseScore ?? value?.pairwise ?? 0.5)),
        pairwiseRawScore: clamp01(Number(
            value?.pairwiseRawScore
            ?? value?.pairwiseRaw
            ?? value?.pairwiseScore
            ?? value?.pairwise
            ?? 0.5,
        )),
        pairwiseCalibratedScore: clamp01(Number(
            value?.pairwiseCalibratedScore
            ?? value?.pairwiseCalibrated
            ?? value?.pairwiseScore
            ?? value?.pairwise
            ?? 0.5,
        )),
        neuralScore: clamp01(Number(value?.neuralScore ?? value?.neural ?? 0.5)),
        signature: toStringOrNull(value?.signature || value?.candidateSignature),
        renderSignature: toStringOrNull(value?.renderSignature),
        latent: sanitizeLatentSnapshot(value?.latent || value?.modelInput?.latent),
        ...(hasOwn(value, 'render') ? { render: sanitizeRenderSnapshot(value.render) } : {}),
        backboneMetrics: sanitizeBackboneMetrics(value?.backboneMetrics),
        ...(morphologyEvidence ? {
            morphologyEvidence: {
                ...morphologyEvidence,
                vector: { ...morphologyEvidence.vector },
                classification: {
                    ...morphologyEvidence.classification,
                    secondaryFormIds: [
                        ...morphologyEvidence.classification.secondaryFormIds,
                    ],
                    memberships: morphologyEvidence.classification.memberships.map(
                        (entry) => ({ ...entry }),
                    ),
                },
            },
        } : {}),
    };
};

const requireHistoryCandidateFormCondition = (candidate = null, label = 'unknown') => {
    const evidence = candidate?.morphologyEvidence || null;
    const provenance = candidate?.render?.formComposition || null;
    const hasTargetForm = Boolean(evidence?.targetFormId);
    if (hasTargetForm !== Boolean(provenance)) {
        throw new Error(
            `ZEN_SAKURA_AB_HISTORY_FORM_EVIDENCE_PROVENANCE_REQUIRED:${label}`,
        );
    }
    if (!hasTargetForm) return null;
    if (evidence.targetFormId !== provenance.formId) {
        throw new Error(
            `ZEN_SAKURA_AB_HISTORY_FORM_EVIDENCE_PROVENANCE_MISMATCH:${label}`,
        );
    }
    if (!candidate?.latent) {
        throw new Error(`ZEN_SAKURA_AB_HISTORY_FORM_LATENT_REQUIRED:${label}`);
    }
    const prior = createBonsaiSingleRootFormCompositionPrior({
        formId: provenance.formId,
        variantSeed: provenance.variantSeed,
    });
    const canonicalPlan = createSakuraSingleRootFormCompositionPlanV1({
        prior,
        baseGene: compileSakuraPhenotypeFromLatent(candidate.latent),
    });
    if (canonicalPlan.planId !== provenance.planId) {
        throw new Error(`ZEN_SAKURA_AB_HISTORY_FORM_PLAN_MISMATCH:${label}`);
    }
    return {
        formId: provenance.formId,
        variantSeed: provenance.variantSeed,
        planId: provenance.planId,
    };
};

const requireHistoryMorphologyGenerationSemantics = ({ generationContext, A, B } = {}) => {
    const hasMorphologyContract = Boolean(
        A?.morphologyEvidence
        || B?.morphologyEvidence
        || A?.render?.formComposition
        || B?.render?.formComposition
        || generationContext?.formQuestionPolicyId,
    );
    if (!hasMorphologyContract) return;
    const semanticsByBoundary = {
        generationContext: generationContext?.generationSemantics,
        candidateA: A?.generationSemantics,
        renderA: A?.render?.generationSemantics,
        evidenceA: A?.morphologyEvidence?.generationSemantics,
        candidateB: B?.generationSemantics,
        renderB: B?.render?.generationSemantics,
        evidenceB: B?.morphologyEvidence?.generationSemantics,
    };
    Object.entries(semanticsByBoundary).forEach(([boundary, semantics]) => {
        if (semantics !== SAKURA_GENERATION_SEMANTICS_ID) {
            throw new Error(
                `ZEN_SAKURA_AB_HISTORY_MORPHOLOGY_GENERATION_SEMANTICS_MISMATCH:${boundary}`,
            );
        }
    });
};

const requireHistoryFormPairConsistency = ({ generationContext, A, B } = {}) => {
    const formA = requireHistoryCandidateFormCondition(A, 'A');
    const formB = requireHistoryCandidateFormCondition(B, 'B');
    const hasContextForm = Boolean(generationContext?.formQuestionPolicyId);
    if (!formA && !formB && !hasContextForm) return;
    if (!formA || !formB || !hasContextForm) {
        throw new Error('ZEN_SAKURA_AB_HISTORY_FORM_PAIR_CONDITION_REQUIRED');
    }
    const relation = formA.formId === formB.formId
        ? 'within_form_preference'
        : 'cross_form_coverage';
    if (generationContext.formQuestionRelation !== relation) {
        throw new Error('ZEN_SAKURA_AB_HISTORY_FORM_PAIR_RELATION_MISMATCH');
    }
    if (
        generationContext.targetFormIdA !== formA.formId
        || generationContext.targetFormIdB !== formB.formId
    ) {
        throw new Error('ZEN_SAKURA_AB_HISTORY_FORM_PAIR_TARGET_MISMATCH');
    }
    if (
        generationContext.formVariantSeedA !== formA.variantSeed
        || generationContext.formVariantSeedB !== formB.variantSeed
    ) {
        throw new Error('ZEN_SAKURA_AB_HISTORY_FORM_PAIR_VARIANT_MISMATCH');
    }
    if (relation === 'cross_form_coverage' && formA.planId === formB.planId) {
        throw new Error('ZEN_SAKURA_AB_HISTORY_FORM_PAIR_PLAN_COLLISION');
    }
    const expectedObjective = relation === 'cross_form_coverage'
        ? 'morphology_coverage'
        : 'latent_and_morphology_preference';
    if (
        A.render?.acquisitionObjective !== expectedObjective
        || B.render?.acquisitionObjective !== expectedObjective
    ) {
        throw new Error('ZEN_SAKURA_AB_HISTORY_FORM_PAIR_OBJECTIVE_MISMATCH');
    }
};

const sanitizeQueryMeta = (query = {}, context = null) => {
    const explicitQuestionLane = hasOwn(query, 'questionLane')
        ? requireSakuraABQuestionLane(query.questionLane)
        : null;
    const contextQuestionLane = context && hasOwn(context, 'questionLane')
        ? requireSakuraABQuestionLane(context.questionLane)
        : null;
    if (
        explicitQuestionLane
        && contextQuestionLane
        && explicitQuestionLane !== contextQuestionLane
    ) {
        throw new Error('ZEN_SAKURA_AB_HISTORY_QUESTION_LANE_MISMATCH');
    }
    const questionLane = explicitQuestionLane || contextQuestionLane;
    return {
        kind: toStringOrNull(query?.kind) || toStringOrNull(context?.queryKind) || 'pairwise',
        ...(questionLane ? { questionLane } : {}),
        decisionMode: toStringOrNull(query?.decisionMode),
        prompt: toStringOrNull(query?.prompt),
        infoScore: clamp01(Number(query?.infoScore ?? 0.5)),
    };
};
const sanitizeQuestionQuality = (value = {}) => ({
    stage: toStringOrNull(value?.stage) || 'stable',
    pressure: clamp01(Number(value?.pressure ?? 0)),
    pressurePercent: Math.max(0, Math.min(100, Number(value?.pressurePercent || 0))),
});
const requireSakuraV2Prediction = (value) => {
    if (value === null) {
        return null;
    }
    const versionedContract = hasExactKeys(
        value,
        ['pairwiseProbabilityA', 'source', 'modelContractId'],
    );
    if (
        !versionedContract
        || typeof value.pairwiseProbabilityA !== 'number'
        || !Number.isFinite(value.pairwiseProbabilityA)
        || value.pairwiseProbabilityA < 0
        || value.pairwiseProbabilityA > 1
        || value.source !== SAKURA_V2_AB_HISTORY_PREDICTION_SOURCE
        || typeof value.modelContractId !== 'string' || !value.modelContractId.trim()
    ) {
        throw new Error('ZEN_SAKURA_AB_HISTORY_PREDICTION_INVALID');
    }
    return {
        pairwiseProbabilityA: value.pairwiseProbabilityA,
        source: value.source,
        modelContractId: value.modelContractId.trim(),
    };
};
const sanitizeAbHistoryEntryBase = (entry = {}) => {
    const generationContext = sanitizeGenerationContext(entry?.generationContext);
    const query = sanitizeQueryMeta(entry?.query || {}, generationContext);
    const sanitized = {
        id: requireAbHistoryEntryId(entry?.id),
        treeType: toStringOrNull(entry?.treeType) || 'sakura',
        picked: normalizePickedToken(entry?.picked),
        winnerSeed: toIntOrNull(entry?.winnerSeed),
        loserSeed: toIntOrNull(entry?.loserSeed),
        traceId: toStringOrNull(entry?.traceId),
        generationContext,
        pairSignature: toStringOrNull(entry?.pairSignature || generationContext?.pairSignature),
        renderSignature: toStringOrNull(entry?.renderSignature || generationContext?.renderSignature),
        scoreDelta: sanitizeScoreDelta(entry?.scoreDelta || {}),
        weights: sanitizeWeights(entry?.weights || {}),
        query,
        responseTimeMs: Math.max(0, Math.round(Number(entry?.responseTimeMs || 0))),
        questionQuality: sanitizeQuestionQuality(entry?.questionQuality || {}),
        A: sanitizeCandidateSnapshot(entry?.A || {}),
        B: sanitizeCandidateSnapshot(entry?.B || {}),
        timestamp: requireAbHistoryEntryTimestamp(entry?.timestamp),
    };
    requireHistoryMorphologyGenerationSemantics(sanitized);
    requireHistoryFormPairConsistency(sanitized);
    if (!sanitized.pairSignature) {
        sanitized.pairSignature = buildABPairSignature({
            A: sanitized.A,
            B: sanitized.B,
            generationContext,
        });
    }
    if (!sanitized.renderSignature) {
        sanitized.renderSignature = buildABPairRenderSignature({
            A: sanitized.A,
            B: sanitized.B,
        });
    }
    return sanitized;
};
const sanitizeSakuraV2AbHistoryEntry = (entry = {}) => {
    if (!Object.prototype.hasOwnProperty.call(entry, 'prediction')) {
        throw new Error('ZEN_SAKURA_AB_HISTORY_PREDICTION_REQUIRED');
    }
    const sanitized = {
        ...sanitizeAbHistoryEntryBase(entry),
        prediction: requireSakuraV2Prediction(entry.prediction),
    };
    return sanitized;
};
const requireAbHistoryEntriesArray = (entries) => {
    if (!Array.isArray(entries)) {
        throw new TypeError('ZEN_SAKURA_AB_HISTORY_ENTRIES_ARRAY_REQUIRED');
    }
    if (entries.length > SAKURA_V2_AB_HISTORY_LIMIT) {
        throw new Error('ZEN_SAKURA_AB_HISTORY_LIMIT_EXCEEDED');
    }
    return entries;
};
const normalizeSakuraV2AbHistoryEntries = (entries = []) => {
    const normalized = requireAbHistoryEntriesArray(entries)
        .map((entry) => sanitizeSakuraV2AbHistoryEntry(entry))
        .filter(Boolean);
    return requireSakuraABHistoryNewestFirst(normalized);
};

const requireSakuraAbHistoryEnvelope = (payload, expectedVersion) => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error('ZEN_SAKURA_AB_HISTORY_STATE_INVALID');
    }
    if (payload.version !== expectedVersion) {
        throw new Error(`ZEN_SAKURA_AB_HISTORY_VERSION_INVALID:${payload.version ?? 'missing'}`);
    }
    if (!Array.isArray(payload.entries)) {
        throw new Error('ZEN_SAKURA_AB_HISTORY_ENTRIES_INVALID');
    }
    const envelopeKeys = Object.keys(payload).sort();
    if (envelopeKeys.length !== 3 || envelopeKeys.join('|') !== 'entries|updatedAt|version') {
        throw new Error('ZEN_SAKURA_AB_HISTORY_STATE_INVALID');
    }
    if (!Number.isSafeInteger(payload.updatedAt) || payload.updatedAt < 0) {
        throw new Error('ZEN_SAKURA_AB_HISTORY_UPDATED_AT_INVALID');
    }
};

export const requireSakuraV2AbHistoryPayload = (payload) => {
    requireSakuraAbHistoryEnvelope(payload, SAKURA_V2_AB_HISTORY_VERSION);
    const entries = normalizeSakuraV2AbHistoryEntries(payload.entries);
    if (!isDeepCanonicalEqual(payload.entries, entries)) {
        throw new Error('ZEN_SAKURA_AB_HISTORY_ENTRY_CONTRACT_INVALID');
    }
    return entries;
};

export const resolveSakuraAbHistoryBootstrap = (payload) => {
    if (payload?.version === SAKURA_V2_AB_HISTORY_VERSION) {
        return {
            entries: requireSakuraV2AbHistoryPayload(payload),
        };
    }
    throw new Error(`ZEN_SAKURA_AB_HISTORY_VERSION_INVALID:${payload?.version ?? 'missing'}`);
};

const readSakuraV2AbHistory = async (zenThemeModelState) => {
    const payload = await zenThemeModelState.getValueForBootstrap(
        ZEN_THEME_MODEL_STATE_KEYS.SAKURA_V2_AB_HISTORY,
    );
    if (payload === null || payload === undefined) {
        await zenThemeModelState.setSakuraV2AbHistory({
            version: SAKURA_V2_AB_HISTORY_VERSION,
            updatedAt: 0,
            entries: [],
        });
        return {
            entries: [],
        };
    }
    return resolveSakuraAbHistoryBootstrap(payload);
};

const persistSakuraV2AbHistory = async (zenThemeModelState, entries = []) => {
    await zenThemeModelState.setSakuraV2AbHistory({
        version: SAKURA_V2_AB_HISTORY_VERSION,
        updatedAt: Date.now(),
        entries: normalizeSakuraV2AbHistoryEntries(entries),
    });
};

export function useZenLearningLab(_profile = 'base', options = {}) {
    const enabled = options?.enabled !== false;
    const activeProfile = 'base';
    const learningKeyspaceProfile = resolveSakuraLearningLatentProfile(
        options?.learningKeyspaceProfile,
    );
    const optionModelStateStore = options?.modelStateStore || null;
    const optionZenThemeModelState = options?.zenThemeModelState || null;
    const optionModelSaveCoordinator = options?.modelSaveCoordinator || null;
    const zenThemeModelRuntime = useMemo(() => {
        if (!enabled) {
            return null;
        }
        return createZenThemeModelRuntime({
            modelStateStore: optionModelStateStore || ZenModelRepository.getInstance(),
            zenThemeModelState: optionZenThemeModelState,
            modelSaveCoordinator: optionModelSaveCoordinator,
        });
    }, [
        enabled,
        optionModelStateStore,
        optionZenThemeModelState,
        optionModelSaveCoordinator,
    ]);
    const zenThemeModelState = zenThemeModelRuntime?.zenThemeModelState || null;
    const modelSaveCoordinator = zenThemeModelRuntime?.modelSaveCoordinator || null;

    const [lab, setLab] = useState(createEmptyLabState);
    const [loaded, setLoaded] = useState(false);
    const [loadError, setLoadError] = useState(null);
    const historyPersistQueueRef = useRef(Promise.resolve());
    const latestHistoryRef = useRef([]);
    const historyDirtyRef = useRef(false);

    if (enabled && loadError) {
        throw loadError;
    }

    const models = useMemo(() => {
        if (!enabled) {
            return {
                brain: null,
                pairwiseGpBrain: null,
            };
        }
        return {
            brain: new NeuralZen({
                zenThemeModelState,
                modelSaveCoordinator,
            }),
            pairwiseGpBrain: new SakuraAdditivePairwiseGPModel({
                learningKeyspaceProfile,
                zenThemeModelState,
                modelSaveCoordinator,
            }),
        };
    }, [
        enabled,
        zenThemeModelState,
        modelSaveCoordinator,
        learningKeyspaceProfile,
    ]);

    useEffect(() => {
        setLab(createEmptyLabState());
        setLoaded(false);
        setLoadError(null);
    }, [enabled, learningKeyspaceProfile]);

    useEffect(() => {
        if (!enabled) {
            return;
        }
        if (loaded) {
            return;
        }

        let cancelled = false;
        const initBrains = async () => {
            const loadTasks = [
                models.brain.load(),
                models.pairwiseGpBrain.load(),
            ];
            await Promise.all(loadTasks);
            if (cancelled) {
                return;
            }
            const historyBootstrap = await readSakuraV2AbHistory(zenThemeModelState);
            if (cancelled) {
                return;
            }
            if (cancelled) {
                return;
            }
            const brainMeta = models.brain.getMeta();
            const pairwiseMeta = resolveActivePairwiseMeta(models);
            latestHistoryRef.current = historyBootstrap.entries;
            historyDirtyRef.current = false;
            setLab((prev) => ({
                ...prev,
                abHistory: historyBootstrap.entries,
                trainingCount: brainMeta.trainingSteps,
                pairwiseTrainingCount: pairwiseMeta.trainingPairs,
            }));
            setLoaded(true);
        };

        initBrains().catch((error) => {
            if (cancelled) {
                return;
            }
            setLoadError(error);
        });

        return () => {
            cancelled = true;
        };
    }, [enabled, loaded, models, zenThemeModelState]);

    const queueHistoryPersist = useCallback((entries) => {
        const canonicalEntries = normalizeSakuraV2AbHistoryEntries(entries);
        const persist = () => persistSakuraV2AbHistory(zenThemeModelState, canonicalEntries);
        const operation = historyPersistQueueRef.current.then(persist, persist);
        historyPersistQueueRef.current = operation;
        return operation;
    }, [zenThemeModelState]);

    useEffect(() => {
        if (!enabled || !loaded) {
            return;
        }
        const historySnapshot = lab.abHistory || [];
        latestHistoryRef.current = historySnapshot;
        historyDirtyRef.current = true;
        const timer = setTimeout(() => {
            void queueHistoryPersist(historySnapshot)
                .then(() => {
                    if (latestHistoryRef.current === historySnapshot) {
                        historyDirtyRef.current = false;
                    }
                })
                .catch((error) => {
                    setLoadError(error);
                });
        }, SAKURA_V2_AB_HISTORY_PERSIST_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [enabled, loaded, lab.abHistory, queueHistoryPersist]);

    useEffect(() => () => {
        if (!enabled || !historyDirtyRef.current) {
            return;
        }
        const historySnapshot = latestHistoryRef.current;
        historyDirtyRef.current = false;
        void queueHistoryPersist(historySnapshot).catch(surfaceAsyncPersistError);
    }, [enabled, learningKeyspaceProfile, queueHistoryPersist]);

    const setLabStateValue = useCallback((key, nextOrUpdater) => {
        setLab((prev) => ({
            ...prev,
            [key]: applyStateUpdater(prev[key], nextOrUpdater),
        }));
    }, []);

    const setLikedCollection = useCallback((nextOrUpdater) => {
        setLabStateValue('likedCollection', nextOrUpdater);
    }, [setLabStateValue]);
    const setOptimizationLog = useCallback((nextOrUpdater) => {
        setLabStateValue('optimizationLog', nextOrUpdater);
    }, [setLabStateValue]);
    const setAbHistory = useCallback((nextOrUpdater) => {
        setLab((prev) => {
            const abHistory = normalizeSakuraV2AbHistoryEntries(
                applyStateUpdater(prev.abHistory, nextOrUpdater),
            );
            latestHistoryRef.current = abHistory;
            historyDirtyRef.current = true;
            return {
                ...prev,
                abHistory,
            };
        });
    }, []);
    const setFactorTraceLog = useCallback((nextOrUpdater) => {
        setLabStateValue('factorTraceLog', nextOrUpdater);
    }, [setLabStateValue]);
    const setAbGeneratedSamples = useCallback((nextOrUpdater) => {
        setLabStateValue('abGeneratedSamples', nextOrUpdater);
    }, [setLabStateValue]);
    const setReferenceCutoffMs = useCallback((nextOrUpdater) => {
        setLabStateValue('referenceCutoffMs', nextOrUpdater);
    }, [setLabStateValue]);
    const setTrainingCount = useCallback((nextOrUpdater) => {
        setLabStateValue('trainingCount', nextOrUpdater);
    }, [setLabStateValue]);
    const setPairwiseTrainingCount = useCallback((nextOrUpdater) => {
        setLabStateValue('pairwiseTrainingCount', nextOrUpdater);
    }, [setLabStateValue]);

    const collectCandidate = useCallback((candidate, treeType, source = 'manual') => {
        if (!enabled || !candidate?.metric) {
            return;
        }
        if (
            candidate.metric.evaluationProfile
            === BONSAI_CANDIDATE_EVALUATION_PROFILE.STRUCTURAL_SCOUT
        ) {
            return;
        }

        const entry = {
            id: Date.now(),
            source,
            type: treeType,
            seed: candidate.seed,
            phenotype: { ...candidate.phenotype },
            scores: {
                rule: candidate.scores.rule,
                neural: candidate.scores.neural,
                pairwise: candidate.scores.pairwise,
                novelty: candidate.scores.novelty,
                blended: candidate.scores.blended,
            },
            featureOrder: candidate.metric.featureOrder,
            ...candidate.metric,
            timestamp: new Date().toISOString(),
        };

        setLikedCollection((prev) => [...prev, entry]);
    }, [enabled, setLikedCollection]);

    const trainCandidate = useCallback((candidate, targetScore, sampleWeight = 1) => {
        if (!enabled || !models.brain || !candidate?.metric?.features) {
            return;
        }
        if (
            candidate.metric.evaluationProfile
            === BONSAI_CANDIDATE_EVALUATION_PROFILE.STRUCTURAL_SCOUT
        ) {
            return;
        }
        const ruleScore = Number(candidate?.metric?.evaluation?.ruleScore);
        const encodedTarget = encodeNeuralPreferenceTarget({
            targetScore,
            ruleScore,
        });
        models.brain.train(candidate.metric, encodedTarget, { sampleWeight });
        const meta = models.brain.getMeta();
        setTrainingCount(meta.trainingSteps);
    }, [enabled, models, setTrainingCount]);

    const trainPairwisePreference = useCallback((winnerCandidate, loserCandidate, options = {}) => {
        if (!enabled) {
            return;
        }
        const winnerInput = resolvePairwiseTrainingInput(winnerCandidate);
        const loserInput = resolvePairwiseTrainingInput(loserCandidate);
        if (!winnerInput || !loserInput) {
            return;
        }
        const sampleWeight = Number.isFinite(options?.sampleWeight)
            ? Math.max(0.05, options.sampleWeight)
            : 1;
        const targetProbability = Number.isFinite(options?.targetProbability)
            ? Math.max(0, Math.min(1, Number(options.targetProbability)))
            : 1;
        const uncertaintyBoost = Number.isFinite(options?.uncertaintyBoost)
            ? Math.max(0, Math.min(1, Number(options.uncertaintyBoost)))
            : 0;
        if (models.pairwiseGpBrain?.trainPair) {
            models.pairwiseGpBrain.trainPair(winnerInput, loserInput, {
                sampleWeight,
                targetProbability,
                uncertaintyBoost,
                source: options?.source || 'ab_pairwise_gp_live',
                calibrationTag: options?.calibrationTag || null,
            });
        }
        const pairwiseMeta = resolveActivePairwiseMeta(models);
        setPairwiseTrainingCount(pairwiseMeta.trainingPairs);
    }, [enabled, models, setPairwiseTrainingCount]);

    const resetLearningCore = useCallback(() => {
        const resetAt = Date.now();
        latestHistoryRef.current = [];
        historyDirtyRef.current = true;
        if (!enabled || !models.brain) {
            setLab({
                ...createEmptyLabState(),
                referenceCutoffMs: resetAt,
            });
            return;
        }
        void models.brain.reset().catch(surfaceAsyncPersistError);
        if (typeof models.pairwiseGpBrain?.reset === 'function') {
            void models.pairwiseGpBrain.reset().catch(surfaceAsyncPersistError);
        }
        setLab({
            ...createEmptyLabState(),
            referenceCutoffMs: resetAt,
        });
    }, [enabled, models]);

    return {
        activeProfile,
        loaded,
        likedCollection: lab.likedCollection,
        setLikedCollection,
        optimizationLog: lab.optimizationLog,
        setOptimizationLog,
        abHistory: lab.abHistory,
        setAbHistory,
        factorTraceLog: lab.factorTraceLog,
        setFactorTraceLog,
        abGeneratedSamples: lab.abGeneratedSamples,
        setAbGeneratedSamples,
        referenceCutoffMs: lab.referenceCutoffMs,
        setReferenceCutoffMs,
        brain: models.brain,
        activePairwiseBrain: models.pairwiseGpBrain,
        pairwiseBrain: models.pairwiseGpBrain,
        pairwiseGpBrain: models.pairwiseGpBrain,
        learningKeyspaceProfile,
        learningEnabled: Boolean(enabled && zenThemeModelRuntime),
        trainingCount: lab.trainingCount,
        setTrainingCount,
        pairwiseTrainingCount: lab.pairwiseTrainingCount,
        setPairwiseTrainingCount,
        collectCandidate,
        trainCandidate,
        trainPairwisePreference,
        resetLearningCore,
    };
}
