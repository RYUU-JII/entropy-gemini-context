import {
    blendScores,
    scoreAdaptiveObjective,
} from './candidateScoreBlending';
import { decodeNeuralPreferenceScore } from '../../NeuralPreferenceEncoding';

const clamp01 = (value) => Math.min(1, Math.max(0, value));
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round = (value, digits = 4) => Number((Number.isFinite(value) ? value : 0).toFixed(digits));

const NEUTRAL_DETAIL = { score: 0.5, rawScore: 0.5, confidence: 0.5 };

const resolveDetailedScore = (model, input) => {
    if (!model) {
        return NEUTRAL_DETAIL;
    }
    if (typeof model.predictDetailed === 'function') {
        return model.predictDetailed(input);
    }
    if (typeof model.predict === 'function') {
        return {
            score: model.predict(input),
            confidence: 0.5,
        };
    }
    return NEUTRAL_DETAIL;
};
const resolvePairwiseModelInput = (stageEntry, pairwiseInput = null) => {
    if (pairwiseInput && typeof pairwiseInput === 'object') {
        const perStage = pairwiseInput?.stages?.[stageEntry?.id];
        if (perStage && typeof perStage === 'object') {
            return perStage;
        }
        if (
            Object.prototype.hasOwnProperty.call(pairwiseInput, 'latent')
            || Object.prototype.hasOwnProperty.call(pairwiseInput, 'features')
        ) {
            return pairwiseInput;
        }
    }
    return stageEntry?.analysis?.features || {};
};

export class CandidateScoreModel {
    constructor({
        brain = null,
        pairwiseBrain = null,
        disableLearning = false,
        continuityEnabled = false,
        objectiveMode = 'blended',
    } = {}) {
        this.brain = brain;
        this.pairwiseBrain = pairwiseBrain;
        this.disableLearning = Boolean(disableLearning);
        this.continuityEnabled = Boolean(continuityEnabled);
        this.objectiveMode = objectiveMode;
    }

    getModelMeta() {
        if (this.disableLearning) {
            return {
                brainMeta: { trainingSteps: 0, avgAbsError: 0 },
                pairwiseMeta: { trainingPairs: 0, avgPairLoss: 0 },
            };
        }
        return {
            brainMeta: this.brain?.getMeta?.() || { trainingSteps: 0, avgAbsError: 0 },
            pairwiseMeta: this.pairwiseBrain?.getMeta?.() || { trainingPairs: 0, avgPairLoss: 0 },
        };
    }

    buildStageModelScores(normalizedStages = [], pairwiseInput = null) {
        const stageModelScores = normalizedStages.map((entry) => {
            const rawNeural = this.disableLearning
                ? NEUTRAL_DETAIL
                : resolveDetailedScore(this.brain, entry.analysis);
            const ruleScore = Number(entry?.analysis?.evaluation?.ruleScore);
            const decoupledNeuralScore = decodeNeuralPreferenceScore({
                neuralScore: rawNeural?.score,
                ruleScore,
            });
            const decoupledConfidence = clamp01(
                (Number(rawNeural?.confidence) || 0.5) * (
                    0.82
                    + (Math.abs(decoupledNeuralScore - clamp01(Number.isFinite(ruleScore) ? ruleScore : 0.5)) * 0.36)
                ),
            );
            return {
                weight: entry.weight,
                neural: this.disableLearning
                    ? NEUTRAL_DETAIL
                    : {
                        ...rawNeural,
                        rawModelScore: clamp01(
                            Number.isFinite(Number(rawNeural?.score))
                                ? Number(rawNeural.score)
                                : 0.5,
                        ),
                        score: decoupledNeuralScore,
                        confidence: decoupledConfidence,
                    },
                pairwise: this.disableLearning
                    ? NEUTRAL_DETAIL
                    : resolveDetailedScore(
                        this.pairwiseBrain,
                        resolvePairwiseModelInput(entry, pairwiseInput),
                    ),
            };
        });

        const neuralScore = stageModelScores.reduce(
            (acc, entry) => acc + (Number(entry.neural.score) || 0.5) * entry.weight,
            0,
        );
        const pairwiseScore = stageModelScores.reduce(
            (acc, entry) => acc + (Number(entry.pairwise.score) || 0.5) * entry.weight,
            0,
        );
        const pairwiseRawScore = stageModelScores.reduce(
            (acc, entry) => acc + (Number(entry.pairwise.rawScore ?? entry.pairwise.score) || 0.5) * entry.weight,
            0,
        );
        const neuralConfidence = stageModelScores.reduce(
            (acc, entry) => acc + (Number(entry.neural.confidence) || 0.5) * entry.weight,
            0,
        );
        const pairwiseConfidence = stageModelScores.reduce(
            (acc, entry) => acc + (Number(entry.pairwise.confidence) || 0.5) * entry.weight,
            0,
        );

        return {
            stageModelScores,
            neuralScore,
            pairwiseScore,
            pairwiseRawScore,
            neuralConfidence,
            pairwiseConfidence,
        };
    }

    scoreCandidate({
        normalizedStages = [],
        aggregatedAnalysis = null,
        pairwiseInput = null,
        referenceCount = 0,
        continuityScore = 1,
        warningScore = 0, // [NEW] Accept constraint penalty
    } = {}) {
        const { brainMeta, pairwiseMeta } = this.getModelMeta();
        const {
            stageModelScores,
            neuralScore,
            pairwiseScore,
            pairwiseRawScore,
            neuralConfidence,
            pairwiseConfidence,
        } = this.buildStageModelScores(normalizedStages, pairwiseInput);

        const blended = blendScores({
            rule: aggregatedAnalysis?.evaluation?.ruleScore ?? 0,
            neural: neuralScore,
            pairwise: pairwiseScore,
            novelty: aggregatedAnalysis?.evaluation?.noveltyScore ?? 0.5,
            trainingSteps: brainMeta.trainingSteps || 0,
            pairwisePairs: pairwiseMeta.trainingPairs || 0,
            neuralConfidence,
            pairwiseConfidence,
            neuralAvgError: brainMeta.avgAbsError || 0,
            pairwiseAvgLoss: pairwiseMeta.avgPairLoss || 0,
            referenceCount,
        });
        const adaptiveObjective = scoreAdaptiveObjective({
            rule: aggregatedAnalysis?.evaluation?.ruleScore ?? 0,
            neural: neuralScore,
            pairwise: pairwiseScore,
            novelty: aggregatedAnalysis?.evaluation?.noveltyScore ?? 0.5,
            trainingSteps: brainMeta.trainingSteps || 0,
            pairwisePairs: pairwiseMeta.trainingPairs || 0,
            neuralConfidence,
            pairwiseConfidence,
            neuralAvgError: brainMeta.avgAbsError || 0,
            pairwiseAvgLoss: pairwiseMeta.avgPairLoss || 0,
            referenceCount,
        });

        // [NEW] Apply warning penalty to objective scores
        const safeWarningPenalty = clamp01(Number.isFinite(warningScore) ? warningScore : 0);
        const penaltyMultiplier = clamp01(1 - Math.pow(safeWarningPenalty, 0.7)); // Sublinear penalty for smoother gradients

        const objectiveSource = (() => {
            if (this.objectiveMode === 'neutral') {
                return 0.5 * penaltyMultiplier;
            }
            if (this.objectiveMode === 'pairwise') {
                return pairwiseScore * penaltyMultiplier;
            }
            if (this.objectiveMode === 'neural') {
                return neuralScore * penaltyMultiplier;
            }
            if (this.objectiveMode === 'adaptive') {
                return adaptiveObjective.score * penaltyMultiplier;
            }
            return blended.blended * penaltyMultiplier;
        })();
        const objectiveScore = round(clamp01(objectiveSource));

        if (!this.continuityEnabled) {
            return {
                scores: {
                    ...blended,
                    pairwiseRaw: round(pairwiseRawScore),
                    pairwiseCalibrated: round(pairwiseScore),
                    objective: objectiveScore,
                    objectiveWeights: this.objectiveMode === 'adaptive'
                        ? adaptiveObjective.weights
                        : null,
                },
                brainMeta,
                pairwiseMeta,
                stageModelScores,
            };
        }

        const baselineObjectiveScore = objectiveScore;
        const safeContinuity = clamp01(Number.isFinite(continuityScore) ? continuityScore : 1);
        const confidenceSignal = clamp01((neuralConfidence + pairwiseConfidence) * 0.5);
        const continuityWeight = clamp(0.14 - confidenceSignal * 0.07, 0.07, 0.16);
        const mixedBlended = clamp01(
            baselineObjectiveScore * (1 - continuityWeight)
            + safeContinuity * continuityWeight,
        );

        return {
            scores: {
                rule: round(blended.rule),
                neural: round(blended.neural),
                pairwise: round(blended.pairwise),
                pairwiseRaw: round(pairwiseRawScore),
                pairwiseCalibrated: round(pairwiseScore),
                novelty: round(blended.novelty),
                objective: round(objectiveScore),
                objectiveWeights: this.objectiveMode === 'adaptive'
                    ? {
                        rule: round(adaptiveObjective.weights?.rule, 3),
                        neural: round(adaptiveObjective.weights?.neural, 3),
                        pairwise: round(adaptiveObjective.weights?.pairwise, 3),
                        novelty: round(adaptiveObjective.weights?.novelty, 3),
                        reliability: adaptiveObjective.weights?.reliability || null,
                    }
                    : null,
                continuity: round(safeContinuity),
                blended: round(mixedBlended),
                modelConfidence: {
                    neural: round(neuralConfidence, 3),
                    pairwise: round(pairwiseConfidence, 3),
                },
                weights: {
                    rule: round(blended.weights?.rule, 3),
                    neural: round(blended.weights?.neural, 3),
                    pairwise: round(blended.weights?.pairwise, 3),
                    novelty: round(blended.weights?.novelty, 3),
                    continuity: round(continuityWeight, 3),
                    reliability: blended.weights?.reliability || null,
                },
            },
            brainMeta,
            pairwiseMeta,
            stageModelScores,
        };
    }
}
