import {
    isABControlledAttributionPair,
    isABStructuralDiscoveryPair,
} from './ABCandidateSlate.js';
import {
    BONSAI_CANDIDATE_EVALUATION_PROFILE,
} from './bonsai/evaluation/bonsaiCandidateEvaluationProfile.js';
import { SAKURA_GENERATION_DETAIL } from './sakura/sakuraGenerationDetail.js';
import {
    SAKURA_GENERATION_SEMANTICS_ID,
} from './v2/SakuraLearningSemantics.js';
import {
    requireSakuraABQuestionLane,
    SAKURA_AB_QUESTION_LANE,
} from './SakuraABQuestionLanePolicy.js';
import {
    requireBonsaiMorphologyEvidenceV1,
} from './bonsai/morphology/BonsaiMorphologyEvidenceContract.js';

export const SAKURA_PAIRWISE_EVIDENCE_POLICY_VERSION = 1;

export const SAKURA_PAIRWISE_EVIDENCE_CLASS = Object.freeze({
    LEGACY_CONTROLLED: 'legacy_controlled',
    PREFERENCE_BASIN: SAKURA_AB_QUESTION_LANE.PREFERENCE_BASIN,
    SOBOL_COLD_START: SAKURA_AB_QUESTION_LANE.SOBOL_COLD_START,
    STRUCTURAL_DISCOVERY: SAKURA_AB_QUESTION_LANE.STRUCTURAL_DISCOVERY,
    INELIGIBLE: 'ineligible',
});

const resolveCandidateEvaluationProfile = (candidate = null) => (
    candidate?.metric?.evaluationProfile
    || candidate?.analysis?.evaluationProfile
    || candidate?.render?.evaluationProfile
    || null
);

const resolveCandidateGenerationDetail = (candidate = null) => (
    candidate?.render?.generationDetail
    || null
);

const hasExactStructuralProvenance = (pair = null) => (
    [pair?.A, pair?.B].every((candidate) => (
        resolveCandidateEvaluationProfile(candidate)
            === BONSAI_CANDIDATE_EVALUATION_PROFILE.STRUCTURAL_SCOUT
        && resolveCandidateGenerationDetail(candidate)
            === SAKURA_GENERATION_DETAIL.STRUCTURAL_SCOUT
    ))
);

const hasMorphologyDescriptorSnapshot = (pair = null) => {
    const candidates = [pair?.A, pair?.B];
    const presentCount = candidates.filter((candidate) => (
        Boolean(candidate?.morphologyEvidence)
    )).length;
    if (presentCount === 0) return false;
    if (presentCount !== candidates.length) {
        throw new Error('ZEN_SAKURA_PAIRWISE_MORPHOLOGY_EVIDENCE_PAIR_REQUIRED');
    }
    candidates.forEach((candidate) => {
        requireBonsaiMorphologyEvidenceV1(candidate.morphologyEvidence);
    });
    return true;
};

const hasExactGenerationSemantics = (pair = null) => (
    pair?.generationContext?.generationSemantics === SAKURA_GENERATION_SEMANTICS_ID
    && [pair?.A, pair?.B].every((candidate) => (
        candidate?.generationSemantics === SAKURA_GENERATION_SEMANTICS_ID
        && (
            !candidate?.render
            || candidate.render.generationSemantics === SAKURA_GENERATION_SEMANTICS_ID
        )
    ))
);

const resolveQuestionLane = (pair = null) => {
    const value = pair?.generationContext?.questionLane;
    if (value === null || value === undefined) {
        return null;
    }
    return requireSakuraABQuestionLane(value);
};

export const resolveSakuraPairwiseEvidencePolicy = (pair = null) => {
    const questionLane = resolveQuestionLane(pair);
    const controlledAttribution = isABControlledAttributionPair(pair);
    const structuralDiscovery = isABStructuralDiscoveryPair(pair);
    const structuralProvenance = hasExactStructuralProvenance(pair);
    const morphologyDescriptorSnapshot = hasMorphologyDescriptorSnapshot(pair);
    const generationSemanticsExact = hasExactGenerationSemantics(pair);

    if (!generationSemanticsExact) {
        return {
            version: SAKURA_PAIRWISE_EVIDENCE_POLICY_VERSION,
            evidenceClass: SAKURA_PAIRWISE_EVIDENCE_CLASS.INELIGIBLE,
            questionLane,
            latentGpEligible: false,
            preferenceBasinEligible: false,
            predictiveGateEligible: false,
            morphologyCaptureEligible: false,
            morphologyCaptureReason: 'generation_semantics_mismatch',
            controlledAttribution,
            structuralDiscovery,
            structuralProvenance,
            morphologyDescriptorSnapshot,
            generationSemanticsExact,
            reason: 'generation_semantics_mismatch',
        };
    }

    if (structuralDiscovery) {
        const morphologyCaptureEligible = structuralProvenance
            && morphologyDescriptorSnapshot;
        return {
            version: SAKURA_PAIRWISE_EVIDENCE_POLICY_VERSION,
            evidenceClass: morphologyCaptureEligible
                ? SAKURA_PAIRWISE_EVIDENCE_CLASS.STRUCTURAL_DISCOVERY
                : SAKURA_PAIRWISE_EVIDENCE_CLASS.INELIGIBLE,
            questionLane,
            latentGpEligible: false,
            preferenceBasinEligible: false,
            predictiveGateEligible: false,
            morphologyCaptureEligible,
            morphologyCaptureReason: morphologyCaptureEligible
                ? null
                : morphologyDescriptorSnapshot
                    ? 'structural_provenance_required'
                    : 'versioned_morphology_evidence_required',
            controlledAttribution: false,
            structuralDiscovery: true,
            structuralProvenance,
            morphologyDescriptorSnapshot,
            generationSemanticsExact,
            reason: morphologyCaptureEligible
                ? 'structural_discovery_is_morphology_only'
                : 'morphology_capture_required',
        };
    }

    if (controlledAttribution) {
        const laneCompatible = (
            questionLane === null
            || questionLane === SAKURA_AB_QUESTION_LANE.PREFERENCE_BASIN
            || questionLane === SAKURA_AB_QUESTION_LANE.SOBOL_COLD_START
        );
        const evidenceClass = questionLane === null
            ? SAKURA_PAIRWISE_EVIDENCE_CLASS.LEGACY_CONTROLLED
            : questionLane;
        return {
            version: SAKURA_PAIRWISE_EVIDENCE_POLICY_VERSION,
            evidenceClass: laneCompatible
                ? evidenceClass
                : SAKURA_PAIRWISE_EVIDENCE_CLASS.INELIGIBLE,
            questionLane,
            latentGpEligible: laneCompatible,
            preferenceBasinEligible: laneCompatible,
            predictiveGateEligible: laneCompatible,
            morphologyCaptureEligible: structuralProvenance
                && morphologyDescriptorSnapshot,
            morphologyCaptureReason: structuralProvenance && morphologyDescriptorSnapshot
                ? null
                : 'versioned_morphology_evidence_required',
            controlledAttribution: true,
            structuralDiscovery: false,
            structuralProvenance,
            morphologyDescriptorSnapshot,
            generationSemanticsExact,
            reason: laneCompatible ? null : 'controlled_lane_mismatch',
        };
    }

    return {
        version: SAKURA_PAIRWISE_EVIDENCE_POLICY_VERSION,
        evidenceClass: SAKURA_PAIRWISE_EVIDENCE_CLASS.INELIGIBLE,
        questionLane,
        latentGpEligible: false,
        preferenceBasinEligible: false,
        predictiveGateEligible: false,
        morphologyCaptureEligible: false,
        morphologyCaptureReason: 'pair_contract_ineligible',
        controlledAttribution: false,
        structuralDiscovery: false,
        structuralProvenance,
        morphologyDescriptorSnapshot,
        generationSemanticsExact,
        reason: 'pair_contract_ineligible',
    };
};

export const requireSakuraLatentGpEvidence = (pair = null) => {
    const policy = resolveSakuraPairwiseEvidencePolicy(pair);
    if (!policy.latentGpEligible) {
        const error = new Error(`ZEN_SAKURA_PAIRWISE_EVIDENCE_INELIGIBLE:${policy.reason}`);
        error.code = 'ZEN_SAKURA_PAIRWISE_EVIDENCE_INELIGIBLE';
        error.details = policy;
        throw error;
    }
    return policy;
};
