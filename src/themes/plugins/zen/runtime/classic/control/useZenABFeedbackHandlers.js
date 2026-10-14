import { useCallback } from 'react';
import { createABFactorTrace } from '../../../model/FactorTrace';
import {
    round,
    clamp01,
    safeLabel,
    invertLabel,
    SPECIAL_QUERY,
    DECISION_MODE,
    clonePair,
} from '../../../model/ABControllerUtils';
import { SAKURA_V2_AB_HISTORY_LIMIT } from '../../../model/ZenLearningConstants';
import {
    buildABCandidateSignature,
    buildABPairRenderSignature,
    buildABPairSignature,
    buildABRenderSignature,
} from '../../../model/ABPairSignature';
import {
    BONSAI_CANDIDATE_EVALUATION_PROFILE,
} from '../../../model/bonsai/evaluation/bonsaiCandidateEvaluationProfile';
import {
    requireSakuraABQuestionLane,
} from '../../../model/SakuraABQuestionLanePolicy';
import {
    resolveSakuraPairwiseEvidencePolicy,
} from '../../../model/SakuraPairwiseEvidencePolicy.js';
import {
    SAKURA_PAIRWISE_INPUT_BASIS,
    SAKURA_PAIRWISE_MODEL_VERSION,
    SAKURA_PAIRWISE_PREDICTION_CONTRACT_ID,
} from '../../../model/SakuraPairwisePredictionContract.js';
import {
    requireBonsaiMorphologyEvidenceV1,
} from '../../../model/bonsai/morphology/BonsaiMorphologyEvidenceContract.js';
import {
    requireSakuraABHistoryNewestFirst,
} from '../../../model/SakuraABHistoryOrderContract.js';

const TIE_SUPPRESSION_WEIGHT = 0.72;
const TIE_COLLECTION_INFO_FLOOR = 0.6;
const BOTH_GOOD_NEURAL_TARGET = 0.68;
const BOTH_GOOD_PAIRWISE_TIE_SCALE = 0.86;
const BOTH_GOOD_NEURAL_TIE_SCALE = 0.64;
const PAIRWISE_PREDICTION_SOURCE = 'pairwise_compare_pre_feedback';

const prependSakuraABHistoryEntry = (history, entry) => {
    if (
        Object.prototype.hasOwnProperty.call(entry, 'id')
        || Object.prototype.hasOwnProperty.call(entry, 'timestamp')
    ) {
        throw new Error('ZEN_SAKURA_AB_HISTORY_SEQUENCE_OWNER_VIOLATION');
    }
    const canonicalHistory = requireSakuraABHistoryNewestFirst(history);
    const newestTimestampMs = canonicalHistory.length > 0
        ? Date.parse(canonicalHistory[0].timestamp)
        : -1;
    const usedIds = new Set(canonicalHistory.map((item) => item.id));
    let timestampMs = Math.max(Date.now(), newestTimestampMs + 1);
    while (usedIds.has(timestampMs)) timestampMs += 1;
    if (!Number.isSafeInteger(timestampMs)) {
        throw new Error('ZEN_SAKURA_AB_HISTORY_SEQUENCE_EXHAUSTED');
    }
    const timestamp = new Date(timestampMs);
    if (!Number.isFinite(timestamp.getTime())) {
        throw new Error('ZEN_SAKURA_AB_HISTORY_SEQUENCE_EXHAUSTED');
    }
    const nextHistory = [{
        ...entry,
        id: timestampMs,
        timestamp: timestamp.toISOString(),
    }, ...canonicalHistory].slice(0, SAKURA_V2_AB_HISTORY_LIMIT);
    return requireSakuraABHistoryNewestFirst(nextHistory);
};

const isStructuralPreferencePair = (pair = null) => {
    const profileA = pair?.A?.metric?.evaluationProfile;
    const profileB = pair?.B?.metric?.evaluationProfile;
    const structuralA = profileA === BONSAI_CANDIDATE_EVALUATION_PROFILE.STRUCTURAL_SCOUT;
    const structuralB = profileB === BONSAI_CANDIDATE_EVALUATION_PROFILE.STRUCTURAL_SCOUT;
    if (structuralA !== structuralB) {
        throw new Error('ZEN_AB_FEEDBACK_EVALUATION_PROFILE_MISMATCH');
    }
    return structuralA && structuralB;
};

const resolveTieSuppression = (context = {}) => {
    const bothGoodRate = clamp01(Number(context?.questionQuality?.bothGoodRate ?? 0));
    const passRate = clamp01(Number(context?.questionQuality?.passRate ?? 0));
    const tiePressure = Math.max(bothGoodRate, passRate);
    const suppression = Math.max(0.2, 1 - (tiePressure * TIE_SUPPRESSION_WEIGHT));
    return {
        tiePressure,
        suppression,
    };
};

const clonePlainObject = (value = null) => (
    value && typeof value === 'object' && !Array.isArray(value)
        ? { ...value }
        : null
);

const buildHistoryPairMeta = (pair = null) => ({
    pairSignature: pair?.pairSignature || buildABPairSignature(pair),
    renderSignature: pair?.renderSignature || buildABPairRenderSignature(pair),
});

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

const buildCandidateHistorySnapshot = (candidate = null) => ({
    seed: candidate?.seed,
    generationSemantics: candidate?.generationSemantics,
    score: candidate?.scores?.blended ?? 0,
    pairwiseScore: candidate?.scores?.pairwise ?? 0.5,
    pairwiseRawScore: candidate?.scores?.pairwiseRaw ?? candidate?.scores?.pairwise ?? 0.5,
    pairwiseCalibratedScore: candidate?.scores?.pairwiseCalibrated ?? candidate?.scores?.pairwise ?? 0.5,
    neuralScore: candidate?.scores?.neural ?? 0.5,
    signature: candidate?.signature || buildABCandidateSignature(candidate),
    renderSignature: candidate?.renderSignature || buildABRenderSignature(candidate),
    latent: clonePlainObject(candidate?.latent || candidate?.modelInput?.latent),
    render: clonePlainObject(candidate?.render),
    backboneMetrics: candidate?.backboneMetrics || null,
    morphologyEvidence: cloneMorphologyEvidence(candidate?.morphologyEvidence),
});

const resolvePairwisePredictionInput = (candidate = null) => {
    if (candidate?.modelInput && typeof candidate.modelInput === 'object') {
        return candidate.modelInput;
    }
    const latent = candidate?.latent;
    const features = candidate?.metric?.features;
    if (latent && typeof latent === 'object') {
        return {
            latent,
            features: features && typeof features === 'object' ? features : null,
        };
    }
    return features && typeof features === 'object' ? features : null;
};

export const buildSakuraPreFeedbackPrediction = (pairwiseBrain = null, pair = null) => {
    if (typeof pairwiseBrain?.compare !== 'function') {
        return null;
    }
    const inputA = resolvePairwisePredictionInput(pair?.A);
    const inputB = resolvePairwisePredictionInput(pair?.B);
    if (!inputA || !inputB) {
        throw new Error('ZEN_SAKURA_PAIRWISE_PREDICTION_INPUT_REQUIRED');
    }
    const pairwiseProbabilityA = Number(pairwiseBrain.compare(inputA, inputB));
    if (
        !Number.isFinite(pairwiseProbabilityA)
        || pairwiseProbabilityA < 0
        || pairwiseProbabilityA > 1
    ) {
        throw new RangeError('ZEN_SAKURA_PAIRWISE_PREDICTION_INVALID');
    }
    const modelMeta = pairwiseBrain.getMeta?.();
    if (
        !modelMeta
        || modelMeta.version !== SAKURA_PAIRWISE_MODEL_VERSION
        || modelMeta.inputBasis !== SAKURA_PAIRWISE_INPUT_BASIS
        || modelMeta.predictionContractId !== SAKURA_PAIRWISE_PREDICTION_CONTRACT_ID
    ) {
        throw new Error('ZEN_SAKURA_PAIRWISE_PREDICTION_MODEL_CONTRACT_INVALID');
    }
    return {
        pairwiseProbabilityA,
        source: PAIRWISE_PREDICTION_SOURCE,
        modelContractId: modelMeta.predictionContractId,
    };
};

const buildNeutralPairwiseTieOptions = ({
    decision = 'neutral',
    baseWeight = 0.05,
    infoScore = 0.5,
    tiePressure = 0,
    calibrationTag = 0,
    source = null,
} = {}) => {
    const safeInfoScore = Number.isFinite(Number(infoScore))
        ? clamp01(Number(infoScore))
        : 0.5;
    const safeTiePressure = Number.isFinite(Number(tiePressure))
        ? clamp01(Number(tiePressure))
        : 0;
    return {
        sampleWeight: Math.max(
            0.05,
            Number(baseWeight || 0) * BOTH_GOOD_PAIRWISE_TIE_SCALE,
        ),
        targetProbability: 0.5,
        uncertaintyBoost: clamp01(
            0.18
            + ((1 - safeInfoScore) * 0.16)
            + (safeTiePressure * 0.14),
        ),
        source: source || `ab_${decision}_tie`,
        calibrationTag,
    };
};

export function useZenABFeedbackHandlers({
    abPair = null,
    abRoundCount = 0,
    isGenerating = false,
    collectCandidate,
    treeType = 'sakura',
    trainCandidate,
    trainPairwisePreference,
    pairwiseBrain = null,
    setFactorTraceLog,
    setAbHistory,
    generateABPair,
    flushLearningModels = null,
    calibrationWeight = 1,
    sessionCalibration = null,
    appendGeneratedSamples,
    updateAnchorCalibration,
    updateQuestionQuality,
    onABResolved = null,
    bestWorstInterval = 8,
    anchorInterval = 10,
    specialStrength = 1,
    setAbPair,
    setAbRoundCount,
    advanceAfterRound,
}) {
    const flushBeforeNextPair = useCallback(async ({ reason, queryKind } = {}) => {
        if (typeof flushLearningModels !== 'function') {
            return true;
        }
        const flushed = await flushLearningModels({ reason, queryKind });
        if (!flushed) {
            setAbPair(null);
            return false;
        }
        return true;
    }, [flushLearningModels, setAbPair]);

    const chooseABCandidate = useCallback(async (label) => {
        if (!abPair?.A || !abPair?.B || isGenerating) {
            return;
        }

        const pickedLabel = safeLabel(label);
        const structuralPreferencePair = isStructuralPreferencePair(abPair);
        const evidencePolicy = resolveSakuraPairwiseEvidencePolicy(abPair);
        if (!evidencePolicy.latentGpEligible && !evidencePolicy.morphologyCaptureEligible) {
            throw new Error(`ZEN_SAKURA_AB_FEEDBACK_EVIDENCE_INELIGIBLE:${evidencePolicy.reason}`);
        }
        const prediction = evidencePolicy.latentGpEligible
            ? buildSakuraPreFeedbackPrediction(pairwiseBrain, abPair)
            : null;
        const context = abPair.generationContext || {};
        const questionLane = requireSakuraABQuestionLane(context?.questionLane);
        const queryKind = context.queryKind || SPECIAL_QUERY.PAIRWISE;
        const decisionMode = context.decisionMode === DECISION_MODE.WORSE
            ? DECISION_MODE.WORSE
            : DECISION_MODE.BETTER;
        const selectedCandidate = pickedLabel === 'A' ? abPair.A : abPair.B;
        const otherCandidate = pickedLabel === 'A' ? abPair.B : abPair.A;
        const winner = decisionMode === DECISION_MODE.WORSE ? otherCandidate : selectedCandidate;
        const loser = decisionMode === DECISION_MODE.WORSE ? selectedCandidate : otherCandidate;
        const preferredLabel = decisionMode === DECISION_MODE.WORSE ? invertLabel(pickedLabel) : pickedLabel;

        if (queryKind === SPECIAL_QUERY.ANCHOR) {
            updateAnchorCalibration(preferredLabel);
        }

        const infoScore = clamp01(Number(context?.selection?.infoScore ?? 0.5));
        const scalarGapRaw = clamp01(Number(context?.selection?.scalarGapRaw ?? 0));
        const responseTimeMs = Math.max(0, Date.now() - Number(abPair?.createdAt || Date.now()));
        const queryWeight = Number.isFinite(context?.queryWeight)
            ? Math.max(0.05, context.queryWeight)
            : 1;
        const anchorPenalty = queryKind === SPECIAL_QUERY.ANCHOR ? 0.55 : 1;
        const infoWeight = 0.72 + (infoScore * 0.56);
        const pairwiseWeight = Math.max(
            0.1,
            queryWeight * calibrationWeight * infoWeight * anchorPenalty,
        );
        const neuralWeight = structuralPreferencePair
            ? 0
            : Math.max(
                0.08,
                pairwiseWeight * (queryKind === SPECIAL_QUERY.ANCHOR ? 0.66 : 0.82),
            );
        const qualitySummary = updateQuestionQuality({
            decision: 'pick',
            queryKind,
            infoScore,
            scalarGapRaw,
            reactionMs: responseTimeMs,
            timestamp: Date.now(),
        });
        const winnerTarget = queryKind === SPECIAL_QUERY.ANCHOR ? 0.66 : 0.82;
        const loserTarget = queryKind === SPECIAL_QUERY.ANCHOR ? 0.34 : 0.18;
        const pickedToken = decisionMode === DECISION_MODE.WORSE
            ? `WORSE_${pickedLabel}`
            : pickedLabel;
        const trace = createABFactorTrace({
            roundIndex: abRoundCount + 1,
            picked: pickedToken,
            winner,
            loser,
            pair: abPair,
        });

        if (queryKind !== SPECIAL_QUERY.ANCHOR && !structuralPreferencePair) {
            collectCandidate(winner, treeType, `ab_pick_${pickedToken.toLowerCase()}`);
        }
        if (!structuralPreferencePair) {
            trainCandidate(winner, winnerTarget, neuralWeight);
            trainCandidate(loser, loserTarget, Math.max(0.06, neuralWeight * 0.84));
        }
        if (evidencePolicy.latentGpEligible) {
            trainPairwisePreference(winner, loser, {
                sampleWeight: pairwiseWeight,
                source: `ab_${evidencePolicy.evidenceClass}_${queryKind}`,
                calibrationTag: round(sessionCalibration?.anchorConsistency, 4),
            });
        }
        if (trace) {
            setFactorTraceLog((prev) => [trace, ...prev].slice(0, 400));
        }
        if (typeof onABResolved === 'function') {
            onABResolved({
                roundIndex: abRoundCount + 1,
                questionLane,
                queryKind,
                decisionMode,
                pickedLabel,
                preferredLabel,
                winner,
                loser,
                pair: abPair,
            });
        }
        const pairMeta = buildHistoryPairMeta(abPair);
        setAbHistory((prev) => prependSakuraABHistoryEntry(prev, {
                treeType,
                picked: pickedToken,
                winnerSeed: winner.seed,
                loserSeed: loser.seed,
                traceId: trace?.id || null,
                ...pairMeta,
                generationContext: abPair.generationContext || null,
                scoreDelta: {
                    rule: round((winner.scores?.rule ?? 0) - (loser.scores?.rule ?? 0), 4),
                    neural: round((winner.scores?.neural ?? 0) - (loser.scores?.neural ?? 0), 4),
                    pairwise: round((winner.scores?.pairwise ?? 0) - (loser.scores?.pairwise ?? 0), 4),
                    pairwiseRaw: round(
                        (winner.scores?.pairwiseRaw ?? winner.scores?.pairwise ?? 0.5)
                        - (loser.scores?.pairwiseRaw ?? loser.scores?.pairwise ?? 0.5),
                        4,
                    ),
                    pairwiseCalibrated: round(
                        (winner.scores?.pairwiseCalibrated ?? winner.scores?.pairwise ?? 0.5)
                        - (loser.scores?.pairwiseCalibrated ?? loser.scores?.pairwise ?? 0.5),
                        4,
                    ),
                    novelty: round((winner.scores?.novelty ?? 0) - (loser.scores?.novelty ?? 0), 4),
                    blended: round((winner.scores?.blended ?? 0) - (loser.scores?.blended ?? 0), 4),
                },
                weights: {
                    ...(evidencePolicy.latentGpEligible ? {
                        pairwise: round(pairwiseWeight, 4),
                    } : {}),
                    ...(evidencePolicy.morphologyCaptureEligible ? {
                        morphology: round(pairwiseWeight, 4),
                    } : {}),
                    neural: round(neuralWeight, 4),
                    calibration: round(calibrationWeight, 4),
                },
                query: {
                    kind: queryKind,
                    questionLane,
                    decisionMode,
                    prompt: context.prompt || null,
                    infoScore: round(infoScore, 4),
                },
                responseTimeMs: Math.round(responseTimeMs),
                questionQuality: {
                    stage: qualitySummary?.stage || 'stable',
                    pressure: round(Number(qualitySummary?.pressure || 0), 4),
                    pressurePercent: Number(qualitySummary?.pressurePercent || 0),
                },
                prediction,
                A: buildCandidateHistorySnapshot(abPair.A),
                B: buildCandidateHistorySnapshot(abPair.B),
                winnerLatent: winner?.latent || null,
                loserLatent: loser?.latent || null,
        }));

        const nextRoundCount = abRoundCount + 1;
        setAbRoundCount(nextRoundCount);

        if (queryKind === SPECIAL_QUERY.BEST_WORST && context?.bwStage === 'best' && context?.nextStage?.pair) {
            const secondPairBase = clonePair(context.nextStage.pair);
            const secondPair = {
                ...secondPairBase,
                generationContext: {
                    ...(secondPairBase.generationContext || {}),
                    mode: 'learn_mode',
                    queryKind: SPECIAL_QUERY.BEST_WORST,
                    bwStage: 'worst',
                    bwCycleId: context?.bwCycleId || null,
                    decisionMode: DECISION_MODE.WORSE,
                    queryWeight: round(1.08 * specialStrength, 3),
                    prompt: 'pick_worse',
                    scheduler: context?.scheduler || {
                        bestWorstInterval,
                        anchorInterval,
                        specialStrength,
                    },
                    selection: context?.nextStage?.selection || null,
                    nextStage: null,
                },
            };
            appendGeneratedSamples(secondPair);
            setAbPair(secondPair);
            return;
        }

        if (!await flushBeforeNextPair({
            reason: 'ab_pick_next_pair',
            queryKind,
        })) {
            return;
        }
        const created = await generateABPair({
            roundBase: nextRoundCount,
            baseLatent: winner?.latent || null,
        });
        if (!created) {
            setAbPair(null);
        }
    }, [
        abPair,
        abRoundCount,
        isGenerating,
        collectCandidate,
        treeType,
        trainCandidate,
        trainPairwisePreference,
        pairwiseBrain,
        setFactorTraceLog,
        setAbHistory,
        generateABPair,
        flushBeforeNextPair,
        calibrationWeight,
        sessionCalibration?.anchorConsistency,
        appendGeneratedSamples,
        updateAnchorCalibration,
        updateQuestionQuality,
        onABResolved,
        bestWorstInterval,
        anchorInterval,
        specialStrength,
        setAbPair,
        setAbRoundCount,
    ]);

    const handleABBothGood = useCallback(async () => {
        if (!abPair?.A || !abPair?.B || isGenerating) {
            return;
        }

        const context = abPair.generationContext || {};
        const questionLane = requireSakuraABQuestionLane(context?.questionLane);
        const structuralPreferencePair = isStructuralPreferencePair(abPair);
        const evidencePolicy = resolveSakuraPairwiseEvidencePolicy(abPair);
        if (!evidencePolicy.latentGpEligible && !evidencePolicy.morphologyCaptureEligible) {
            throw new Error(`ZEN_SAKURA_AB_FEEDBACK_EVIDENCE_INELIGIBLE:${evidencePolicy.reason}`);
        }
        const prediction = evidencePolicy.latentGpEligible
            ? buildSakuraPreFeedbackPrediction(pairwiseBrain, abPair)
            : null;
        const queryKind = context.queryKind || SPECIAL_QUERY.PAIRWISE;
        const infoScore = clamp01(Number(context?.selection?.infoScore ?? 0.5));
        const scalarGapRaw = clamp01(Number(context?.selection?.scalarGapRaw ?? 0));
        const responseTimeMs = Math.max(0, Date.now() - Number(abPair?.createdAt || Date.now()));
        const queryWeight = Number.isFinite(context?.queryWeight)
            ? Math.max(0.05, context.queryWeight)
            : 1;
        const tieControl = resolveTieSuppression(context);
        const collectionWeight = Math.max(
            0.025,
            queryWeight
            * calibrationWeight
            * 0.28
            * tieControl.suppression,
        );
        const qualitySummary = updateQuestionQuality({
            decision: 'both_good',
            queryKind,
            infoScore,
            scalarGapRaw,
            reactionMs: responseTimeMs,
            timestamp: Date.now(),
        });
        const shouldTrainNeutralTie = queryKind !== SPECIAL_QUERY.ANCHOR;
        const neutralTieOptions = shouldTrainNeutralTie
            ? buildNeutralPairwiseTieOptions({
                decision: 'both_good',
                baseWeight: collectionWeight,
                infoScore,
                tiePressure: tieControl.tiePressure,
                calibrationTag: round(sessionCalibration?.anchorConsistency, 4),
                source: `ab_${evidencePolicy.evidenceClass}_both_good_tie`,
            })
            : null;
        const neuralTieWeight = shouldTrainNeutralTie && !structuralPreferencePair
            ? Math.max(0.04, collectionWeight * BOTH_GOOD_NEURAL_TIE_SCALE)
            : 0;

        if (
            queryKind !== SPECIAL_QUERY.ANCHOR
            && !structuralPreferencePair
            && infoScore >= TIE_COLLECTION_INFO_FLOOR
            && tieControl.tiePressure < 0.62
        ) {
            collectCandidate(abPair.A, treeType, 'ab_both_good_a');
            collectCandidate(abPair.B, treeType, 'ab_both_good_b');
        }
        if (shouldTrainNeutralTie) {
            if (!structuralPreferencePair) {
                trainCandidate(abPair.A, BOTH_GOOD_NEURAL_TARGET, neuralTieWeight);
                trainCandidate(abPair.B, BOTH_GOOD_NEURAL_TARGET, neuralTieWeight);
            }
            if (evidencePolicy.latentGpEligible) {
                trainPairwisePreference(abPair.A, abPair.B, neutralTieOptions);
            }
        }

        if (typeof onABResolved === 'function') {
            onABResolved({
                roundIndex: abRoundCount + 1,
                questionLane,
                queryKind,
                decisionMode: 'both_good',
                pickedLabel: 'BOTH',
                preferredLabel: null,
                winner: null,
                loser: null,
                pair: abPair,
                bothGood: true,
            });
        }

        const pairMeta = buildHistoryPairMeta(abPair);
        setAbHistory((prev) => prependSakuraABHistoryEntry(prev, {
                treeType,
                picked: 'BOTH_GOOD',
                winnerSeed: null,
                loserSeed: null,
                traceId: null,
                ...pairMeta,
                generationContext: abPair.generationContext || null,
                scoreDelta: {
                    rule: 0,
                    neural: 0,
                    pairwise: 0,
                    pairwiseRaw: 0,
                    pairwiseCalibrated: 0,
                    novelty: 0,
                    blended: 0,
                },
                weights: {
                    collection: round(collectionWeight, 4),
                    ...(neutralTieOptions ? {
                        ...(evidencePolicy.latentGpEligible ? {
                            pairwiseTie: round(neutralTieOptions.sampleWeight, 4),
                        } : {}),
                        ...(evidencePolicy.morphologyCaptureEligible ? {
                            morphology: round(collectionWeight, 4),
                        } : {}),
                        neuralTie: round(neuralTieWeight, 4),
                        neutral: round(neutralTieOptions.sampleWeight, 4),
                        uncertaintyBoost: round(neutralTieOptions.uncertaintyBoost, 4),
                    } : {}),
                    suppression: round(tieControl.suppression, 4),
                    calibration: round(calibrationWeight, 4),
                },
                query: {
                    kind: queryKind,
                    questionLane,
                    decisionMode: 'both_good',
                    prompt: context.prompt || null,
                    infoScore: round(infoScore, 4),
                },
                responseTimeMs: Math.round(responseTimeMs),
                questionQuality: {
                    stage: qualitySummary?.stage || 'stable',
                    pressure: round(Number(qualitySummary?.pressure || 0), 4),
                    pressurePercent: Number(qualitySummary?.pressurePercent || 0),
                },
                prediction,
                A: buildCandidateHistorySnapshot(abPair.A),
                B: buildCandidateHistorySnapshot(abPair.B),
        }));

        const nextRoundCount = abRoundCount + 1;
        if (
            queryKind === SPECIAL_QUERY.BEST_WORST
            && context?.bwStage === 'best'
            && context?.nextStage?.pair
        ) {
            if (!await flushBeforeNextPair({
                reason: 'ab_both_good_next_pair',
                queryKind,
            })) {
                return;
            }
            setAbRoundCount(nextRoundCount);
            const secondPairBase = clonePair(context.nextStage.pair);
            const secondPair = {
                ...secondPairBase,
                generationContext: {
                    ...(secondPairBase.generationContext || {}),
                    mode: 'learn_mode',
                    queryKind: SPECIAL_QUERY.BEST_WORST,
                    bwStage: 'worst',
                    bwCycleId: context?.bwCycleId || null,
                    decisionMode: DECISION_MODE.WORSE,
                    queryWeight: round(0.92 * specialStrength, 3),
                    prompt: 'pick_worse',
                    scheduler: context?.scheduler || {
                        bestWorstInterval,
                        anchorInterval,
                        specialStrength,
                    },
                    selection: context?.nextStage?.selection || null,
                    nextStage: null,
                },
            };
            appendGeneratedSamples(secondPair);
            setAbPair(secondPair);
            return;
        }

        if (!await flushBeforeNextPair({
            reason: 'ab_both_good_next_pair',
            queryKind,
        })) {
            return;
        }
        await advanceAfterRound(nextRoundCount);
    }, [
        abPair,
        abRoundCount,
        isGenerating,
        collectCandidate,
        trainCandidate,
        trainPairwisePreference,
        pairwiseBrain,
        treeType,
        setAbHistory,
        calibrationWeight,
        sessionCalibration?.anchorConsistency,
        onABResolved,
        appendGeneratedSamples,
        advanceAfterRound,
        flushBeforeNextPair,
        updateQuestionQuality,
        bestWorstInterval,
        anchorInterval,
        specialStrength,
        setAbPair,
        setAbRoundCount,
    ]);

    const handleABPass = useCallback(async () => {
        if (!abPair?.A || !abPair?.B || isGenerating) {
            return;
        }

        const context = abPair.generationContext || {};
        const questionLane = requireSakuraABQuestionLane(context?.questionLane);
        const evidencePolicy = resolveSakuraPairwiseEvidencePolicy(abPair);
        const prediction = evidencePolicy.latentGpEligible
            ? buildSakuraPreFeedbackPrediction(pairwiseBrain, abPair)
            : null;
        const queryKind = context.queryKind || SPECIAL_QUERY.PAIRWISE;
        const infoScore = clamp01(Number(context?.selection?.infoScore ?? 0.5));
        const scalarGapRaw = clamp01(Number(context?.selection?.scalarGapRaw ?? 0));
        const responseTimeMs = Math.max(0, Date.now() - Number(abPair?.createdAt || Date.now()));
        const queryWeight = Number.isFinite(context?.queryWeight)
            ? Math.max(0.05, context.queryWeight)
            : 1;
        const tieControl = resolveTieSuppression(context);
        const skipWeight = Math.max(
            0.02,
            queryWeight
            * calibrationWeight
            * 0.22
            * tieControl.suppression,
        );
        const qualitySummary = updateQuestionQuality({
            decision: 'pass',
            queryKind,
            infoScore,
            scalarGapRaw,
            reactionMs: responseTimeMs,
            timestamp: Date.now(),
        });
        const pairMeta = buildHistoryPairMeta(abPair);
        setAbHistory((prev) => prependSakuraABHistoryEntry(prev, {
                treeType,
                picked: 'PASS',
                winnerSeed: null,
                loserSeed: null,
                traceId: null,
                ...pairMeta,
                generationContext: abPair.generationContext || null,
                scoreDelta: {
                    rule: 0,
                    neural: 0,
                    pairwise: 0,
                    pairwiseRaw: 0,
                    pairwiseCalibrated: 0,
                    novelty: 0,
                    blended: 0,
                },
                weights: {
                    skip: round(skipWeight, 4),
                    suppression: round(tieControl.suppression, 4),
                    calibration: round(calibrationWeight, 4),
                },
                query: {
                    kind: queryKind,
                    questionLane,
                    decisionMode: context.decisionMode || DECISION_MODE.BETTER,
                    prompt: context.prompt || null,
                    infoScore: round(infoScore, 4),
                },
                responseTimeMs: Math.round(responseTimeMs),
                questionQuality: {
                    stage: qualitySummary?.stage || 'stable',
                    pressure: round(Number(qualitySummary?.pressure || 0), 4),
                    pressurePercent: Number(qualitySummary?.pressurePercent || 0),
                },
                prediction,
                A: buildCandidateHistorySnapshot(abPair.A),
                B: buildCandidateHistorySnapshot(abPair.B),
        }));

        const nextRoundCount = abRoundCount + 1;
        if (
            queryKind === SPECIAL_QUERY.BEST_WORST
            && context?.bwStage === 'best'
            && context?.nextStage?.pair
        ) {
            if (!await flushBeforeNextPair({
                reason: 'ab_pass_next_pair',
                queryKind,
            })) {
                return;
            }
            setAbRoundCount(nextRoundCount);
            const secondPairBase = clonePair(context.nextStage.pair);
            const secondPair = {
                ...secondPairBase,
                generationContext: {
                    ...(secondPairBase.generationContext || {}),
                    mode: 'learn_mode',
                    queryKind: SPECIAL_QUERY.BEST_WORST,
                    bwStage: 'worst',
                    bwCycleId: context?.bwCycleId || null,
                    decisionMode: DECISION_MODE.WORSE,
                    queryWeight: round(0.92 * specialStrength, 3),
                    prompt: 'pick_worse',
                    scheduler: context?.scheduler || {
                        bestWorstInterval,
                        anchorInterval,
                        specialStrength,
                    },
                    selection: context?.nextStage?.selection || null,
                    nextStage: null,
                },
            };
            appendGeneratedSamples(secondPair);
            setAbPair(secondPair);
            return;
        }

        if (!await flushBeforeNextPair({
            reason: 'ab_pass_next_pair',
            queryKind,
        })) {
            return;
        }
        await advanceAfterRound(nextRoundCount);
    }, [
        abPair,
        abRoundCount,
        isGenerating,
        trainPairwisePreference,
        pairwiseBrain,
        setAbHistory,
        calibrationWeight,
        sessionCalibration?.anchorConsistency,
        advanceAfterRound,
        flushBeforeNextPair,
        appendGeneratedSamples,
        updateQuestionQuality,
        bestWorstInterval,
        anchorInterval,
        specialStrength,
        setAbPair,
        setAbRoundCount,
    ]);

    return {
        chooseABCandidate,
        handleABBothGood,
        handleABPass,
    };
}
