import {
    buildABCandidateSignature,
} from './ABPairSignature';
import {
    clamp01,
    round,
} from './ABControllerUtils';
import {
    resolveSakuraLearningLatentProfile,
} from './v2/SakuraLatentParamApi';
import {
    resolveSakuraLatentTierId,
} from './v2/SakuraLatentTierRegistry';
import {
    describeSakuraLatentChanges,
} from './v2/SakuraLatentAB';
import {
    SAKURA_AB_QUESTION_LANE,
} from './SakuraABQuestionLanePolicy';
import {
    requireBonsaiMorphologyEvidenceV1,
} from './bonsai/morphology/BonsaiMorphologyEvidenceContract.js';

const DEFAULT_MAX_SLATE_CANDIDATES = 18;

const isPlainObject = (value) => Boolean(
    value
    && typeof value === 'object'
    && !Array.isArray(value),
);

const safeString = (value, fallback = null) => (
    typeof value === 'string' && value.trim()
        ? value.trim()
        : fallback
);

const readSourceInfoScore = (entry = null) => (
    Number(entry?.score?.qualityAdjustedInfo ?? entry?.score?.infoScore ?? 0)
);

const resolveCandidateLatent = (candidate = null) => {
    if (isPlainObject(candidate?.modelInput?.latent)) {
        return candidate.modelInput.latent;
    }
    if (isPlainObject(candidate?.latent)) {
        return candidate.latent;
    }
    return null;
};

const resolveCandidateTargetForm = (candidate = null) => {
    if (!candidate?.morphologyEvidence) return null;
    return requireBonsaiMorphologyEvidenceV1(candidate.morphologyEvidence).targetFormId;
};

const resolvePairTargetForms = (pair = null) => {
    const formA = resolveCandidateTargetForm(pair?.A);
    const formB = resolveCandidateTargetForm(pair?.B);
    if (Boolean(formA) !== Boolean(formB)) {
        throw new Error('ZEN_SAKURA_AB_PAIR_FORM_EVIDENCE_REQUIRED');
    }
    return { formA, formB };
};

const cloneLatent = (latent = null) => {
    if (!isPlainObject(latent)) {
        return null;
    }
    const next = {};
    Object.keys(latent)
        .sort()
        .forEach((key) => {
            const numeric = Number(latent[key]);
            if (Number.isFinite(numeric)) {
                next[key] = numeric;
            }
        });
    return Object.keys(next).length ? next : null;
};

const buildPlannedCandidateSignature = ({
    seed = null,
    latent = null,
    formId = null,
    formVariantSeed = null,
} = {}) => {
    const safeSeed = Number.isFinite(Number(seed)) ? Math.floor(Number(seed)) : 'na';
    const safeLatent = cloneLatent(latent);
    if (!safeLatent) {
        return null;
    }
    return [
        `seed:${safeSeed}`,
        `form:${safeString(formId, 'none')}`,
        `variant:${Number.isSafeInteger(Number(formVariantSeed)) ? Number(formVariantSeed) : 'none'}`,
        ...Object.keys(safeLatent).map((key) => `${key}:${round(Number(safeLatent[key]), 6)}`),
    ].join('|');
};

export const buildABWorkerCandidateSpecsFromTrials = (
    trials = [],
    {
        maxCandidates = DEFAULT_MAX_SLATE_CANDIDATES * 2,
    } = {},
) => {
    const bySignature = new Map();
    let duplicateCount = 0;
    const safeTrials = Array.isArray(trials) ? trials : [];
    safeTrials.forEach((trial) => {
        [
            {
                side: 'A',
                seed: trial?.seedA,
                latent: trial?.latentA,
                formId: trial?.formIdA,
                formVariantSeed: trial?.formVariantSeedA,
            },
            {
                side: 'B',
                seed: trial?.seedB,
                latent: trial?.latentB,
                formId: trial?.formIdB,
                formVariantSeed: trial?.formVariantSeedB,
            },
        ].forEach((entry) => {
            const latent = cloneLatent(entry.latent);
            const signature = buildPlannedCandidateSignature({
                seed: entry.seed,
                latent,
                formId: entry.formId,
                formVariantSeed: entry.formVariantSeed,
            });
            if (!signature) {
                return;
            }
            if (bySignature.has(signature)) {
                duplicateCount += 1;
                return;
            }
            bySignature.set(signature, {
                candidateIndex: bySignature.size,
                seed: Number.isFinite(Number(entry.seed))
                    ? Math.floor(Number(entry.seed))
                    : 0,
                latent,
                ...(safeString(entry.formId, null) ? {
                    formId: safeString(entry.formId, null),
                    formVariantSeed: Number(entry.formVariantSeed),
                } : {}),
                side: entry.side,
                sourceTrialIndex: Number.isFinite(Number(trial?.trialIndex))
                    ? Math.max(0, Math.floor(Number(trial.trialIndex)))
                    : bySignature.size,
                questionLane: safeString(trial?.questionLane, null),
                strategy: safeString(trial?.strategy, 'discover'),
                sharedSeedApplied: Boolean(trial?.sharedSeedApplied),
                context: isPlainObject(trial?.context) ? { ...trial.context } : null,
            });
        });
    });
    const limit = Math.max(2, Math.floor(Number(maxCandidates) || DEFAULT_MAX_SLATE_CANDIDATES * 2));
    const candidates = Array.from(bySignature.values()).slice(0, limit);
    return {
        candidates,
        candidateCount: candidates.length,
        duplicateCount,
        sourceTrialCount: safeTrials.length,
        maxCandidates: limit,
    };
};

const buildCandidateRow = ({
    candidate = null,
    sourceEntry = null,
    sourcePairIndex = 0,
    side = 'A',
} = {}) => {
    if (!candidate || typeof candidate !== 'object') {
        return null;
    }
    const signature = buildABCandidateSignature(candidate);
    if (!signature) {
        return null;
    }
    return {
        candidate,
        signature,
        side,
        sourcePairIndex,
        sourcePairSignature: safeString(sourceEntry?.pair?.pairSignature, null),
        sourceStrategy: safeString(sourceEntry?.strategy, 'discover'),
        sourceInfoScore: readSourceInfoScore(sourceEntry),
        sourceContext: isPlainObject(sourceEntry?.pair?.generationContext)
            ? { ...sourceEntry.pair.generationContext }
            : null,
    };
};

export const buildABCandidateSlateFromPairPool = (
    pairPool = [],
    {
        maxCandidates = DEFAULT_MAX_SLATE_CANDIDATES,
    } = {},
) => {
    const safePool = Array.isArray(pairPool) ? pairPool : [];
    const bySignature = new Map();
    let duplicateCount = 0;

    safePool.forEach((entry, sourcePairIndex) => {
        ['A', 'B'].forEach((side) => {
            const row = buildCandidateRow({
                candidate: entry?.pair?.[side],
                sourceEntry: entry,
                sourcePairIndex,
                side,
            });
            if (!row) {
                return;
            }
            const existing = bySignature.get(row.signature);
            if (existing) {
                duplicateCount += 1;
                existing.sourceCount += 1;
                if (row.sourceInfoScore > existing.sourceInfoScore) {
                    existing.sourceInfoScore = row.sourceInfoScore;
                    existing.sourceStrategy = row.sourceStrategy;
                    existing.sourceContext = row.sourceContext;
                    existing.sourcePairSignature = row.sourcePairSignature;
                    existing.sourcePairIndex = row.sourcePairIndex;
                }
                return;
            }
            bySignature.set(row.signature, {
                ...row,
                sourceCount: 1,
            });
        });
    });

    const limit = Math.max(2, Math.floor(Number(maxCandidates) || DEFAULT_MAX_SLATE_CANDIDATES));
    const candidates = Array.from(bySignature.values())
        .sort((left, right) => {
            const scoreDelta = Number(right.sourceInfoScore || 0) - Number(left.sourceInfoScore || 0);
            if (scoreDelta !== 0) {
                return scoreDelta;
            }
            return Number(left.sourcePairIndex || 0) - Number(right.sourcePairIndex || 0);
        })
        .slice(0, limit);

    return {
        candidates,
        sourcePairCount: safePool.length,
        candidateCount: candidates.length,
        duplicateCount,
        maxCandidates: limit,
    };
};

export const buildABCandidateSlateFromEvaluatedCandidates = (
    evaluatedCandidates = [],
    {
        sourcePairCount = 0,
        duplicateCandidateCount = 0,
        maxCandidates = DEFAULT_MAX_SLATE_CANDIDATES,
    } = {},
) => {
    const bySignature = new Map();
    let duplicateCount = Math.max(0, Math.floor(Number(duplicateCandidateCount) || 0));
    const safeCandidates = Array.isArray(evaluatedCandidates) ? evaluatedCandidates : [];
    safeCandidates.forEach((entry, index) => {
        const candidate = entry?.candidate && typeof entry.candidate === 'object'
            ? entry.candidate
            : entry;
        const signature = buildABCandidateSignature(candidate);
        if (!candidate || !signature) {
            return;
        }
        if (bySignature.has(signature)) {
            duplicateCount += 1;
            return;
        }
        bySignature.set(signature, {
            candidate,
            signature,
            side: safeString(entry?.side, null),
            sourcePairIndex: Number.isFinite(Number(entry?.sourceTrialIndex))
                ? Math.max(0, Math.floor(Number(entry.sourceTrialIndex)))
                : index,
            sourcePairSignature: null,
            sourceStrategy: safeString(entry?.strategy, 'discover'),
            sourceInfoScore: 0,
            sourceContext: isPlainObject(entry?.context) ? { ...entry.context } : null,
            sourceCount: 1,
        });
    });
    const limit = Math.max(2, Math.floor(Number(maxCandidates) || DEFAULT_MAX_SLATE_CANDIDATES));
    const candidates = Array.from(bySignature.values()).slice(0, limit);
    return {
        candidates,
        sourcePairCount: Math.max(0, Math.floor(Number(sourcePairCount) || 0)),
        candidateCount: candidates.length,
        duplicateCount,
        maxCandidates: limit,
    };
};

export const buildABSourcePairPoolFromEvaluatedCandidates = (
    evaluatedCandidates = [],
    {
        trialSpecs = [],
    } = {},
) => {
    const safeCandidates = Array.isArray(evaluatedCandidates) ? evaluatedCandidates : [];
    const safeTrials = Array.isArray(trialSpecs) ? trialSpecs : [];
    const trialByIndex = new Map(
        safeTrials.map((trial, index) => [
            Number.isFinite(Number(trial?.trialIndex))
                ? Math.max(0, Math.floor(Number(trial.trialIndex)))
                : index,
            trial,
        ]),
    );
    const candidatePairByTrial = new Map();
    let rejectedCandidateCount = 0;

    safeCandidates.forEach((entry) => {
        const sourceTrialIndex = Number(entry?.sourceTrialIndex);
        const side = safeString(entry?.side, null);
        const candidate = entry?.candidate && typeof entry.candidate === 'object'
            ? entry.candidate
            : null;
        if (!Number.isFinite(sourceTrialIndex) || (side !== 'A' && side !== 'B') || !candidate) {
            rejectedCandidateCount += 1;
            return;
        }
        const trialIndex = Math.max(0, Math.floor(sourceTrialIndex));
        const group = candidatePairByTrial.get(trialIndex) || {
            sourceTrialIndex: trialIndex,
            A: null,
            B: null,
            entryA: null,
            entryB: null,
        };
        if (group[side]) {
            rejectedCandidateCount += 1;
            return;
        }
        group[side] = candidate;
        group[side === 'A' ? 'entryA' : 'entryB'] = entry;
        candidatePairByTrial.set(trialIndex, group);
    });

    const entries = [];
    let incompletePairCount = 0;
    Array.from(candidatePairByTrial.values())
        .sort((left, right) => left.sourceTrialIndex - right.sourceTrialIndex)
        .forEach((group) => {
            if (!group.A || !group.B) {
                incompletePairCount += 1;
                return;
            }
            const trial = trialByIndex.get(group.sourceTrialIndex) || null;
            const context = isPlainObject(trial?.context)
                ? { ...trial.context }
                : (isPlainObject(group.entryA?.context)
                    ? { ...group.entryA.context }
                    : (isPlainObject(group.entryB?.context) ? { ...group.entryB.context } : null));
            entries.push({
                trialIndex: group.sourceTrialIndex,
                sourceTrialIndex: group.sourceTrialIndex,
                questionLane: safeString(
                    trial?.questionLane,
                    safeString(group.entryA?.questionLane, safeString(group.entryB?.questionLane, null)),
                ),
                strategy: safeString(
                    trial?.strategy,
                    safeString(group.entryA?.strategy, safeString(group.entryB?.strategy, 'discover')),
                ),
                sharedSeedApplied: Boolean(
                    trial?.sharedSeedApplied
                    ?? group.entryA?.sharedSeedApplied
                    ?? group.entryB?.sharedSeedApplied,
                ),
                context,
                candidateA: group.A,
                candidateB: group.B,
            });
        });

    return {
        entries,
        diagnostics: {
            evaluatedCandidateCount: safeCandidates.length,
            sourceTrialCount: candidatePairByTrial.size,
            completePairCount: entries.length,
            incompletePairCount,
            rejectedCandidateCount,
        },
    };
};

export const isABControlledAttributionPair = (pair = null) => {
    const context = isPlainObject(pair?.generationContext) ? pair.generationContext : {};
    const pairType = safeString(context?.pairType, null);
    const changedFactors = Array.isArray(context?.changedFactors)
        ? context.changedFactors.filter((factor) => safeString(factor?.id, null))
        : [];
    const seedA = Number(pair?.A?.seed);
    const seedB = Number(pair?.B?.seed);
    const sameSeed = Number.isFinite(seedA) && seedA === seedB;
    if (!sameSeed || context?.sharedSeedApplied !== true) {
        return false;
    }
    const { formA, formB } = resolvePairTargetForms(pair);
    if (formA && formA !== formB) {
        return false;
    }
    const actualChanges = describeSakuraLatentChanges({
        latentA: resolveCandidateLatent(pair?.A) || {},
        latentB: resolveCandidateLatent(pair?.B) || {},
        learningKeyspaceProfile: context?.learningKeyspaceProfile || null,
    }).changedFactors;
    if (pairType === 'sobol_cold_start') {
        return context?.coldStart === true && actualChanges.length >= 1;
    }
    return pairType === 'isolation_pair'
        && changedFactors.length === 1
        && actualChanges.length === 1
        && actualChanges[0].id === changedFactors[0].id;
};

export const isABStructuralDiscoveryPair = (pair = null) => {
    const context = isPlainObject(pair?.generationContext) ? pair.generationContext : {};
    if (
        context?.questionLane !== SAKURA_AB_QUESTION_LANE.STRUCTURAL_DISCOVERY
        || context?.coldStart === true
        || context?.sharedSeedApplied !== true
        || context?.sharedSeedPolicy !== 'shared'
    ) {
        return false;
    }
    const seedA = Number(pair?.A?.seed);
    const seedB = Number(pair?.B?.seed);
    if (!Number.isFinite(seedA) || seedA !== seedB) {
        return false;
    }
    if (safeString(context?.pairType, null) !== 'form_discovery_pair') {
        return false;
    }
    const { formA, formB } = resolvePairTargetForms(pair);
    if (!formA || !formB || formA === formB) {
        return false;
    }
    const actualChanges = describeSakuraLatentChanges({
        latentA: resolveCandidateLatent(pair?.A) || {},
        latentB: resolveCandidateLatent(pair?.B) || {},
        learningKeyspaceProfile: context?.learningKeyspaceProfile || null,
    }).changedFactors;
    const declaredFactorCount = (Array.isArray(context?.changedFactors)
        ? context.changedFactors
        : []).length;
    return actualChanges.length === 0 && declaredFactorCount === 0;
};

const buildChangedFactors = ({
    candidateA = null,
    candidateB = null,
    learningKeyspaceProfile = null,
    maxFactors = null,
} = {}) => {
    const profile = resolveSakuraLearningLatentProfile(learningKeyspaceProfile);
    const latentA = resolveCandidateLatent(candidateA);
    const latentB = resolveCandidateLatent(candidateB);
    if (!latentA || !latentB) {
        return [];
    }
    const changedFactors = describeSakuraLatentChanges({
        latentA,
        latentB,
        learningKeyspaceProfile: profile,
    }).changedFactors;
    if (maxFactors === null || maxFactors === undefined || !Number.isFinite(Number(maxFactors))) {
        return changedFactors;
    }
    return changedFactors.slice(0, Math.max(1, Math.floor(Number(maxFactors))));
};

const resolvePairType = (changedFactors = []) => {
    const factorCount = Array.isArray(changedFactors) ? changedFactors.length : 0;
    if (factorCount <= 1) {
        return 'isolation_pair';
    }
    if (factorCount <= 3) {
        return 'mixed_pair';
    }
    return 'diversity_pair';
};

const sourceContextsContainColdStart = (contexts = []) => (
    contexts.some((context) => (
        Boolean(context?.coldStart)
        || String(context?.pairType || '').trim().toLowerCase() === 'sobol_cold_start'
    ))
);

const resolveComparabilityTarget = (pairType = 'mixed_pair', tierCount = 1) => {
    if (pairType === 'isolation_pair') {
        return 0.94;
    }
    if (pairType === 'mixed_pair') {
        return tierCount <= 1 ? 0.82 : 0.72;
    }
    return tierCount <= 2 ? 0.58 : 0.46;
};

const resolveStrategy = (pairType = 'mixed_pair') => (
    pairType === 'isolation_pair' ? 'isolate' : 'discover'
);

export const buildABPairLattice = ({
    slate = null,
    createPair = null,
    learningKeyspaceProfile = null,
} = {}) => {
    if (typeof createPair !== 'function') {
        return {
            entries: [],
            diagnostics: {
                candidateCount: 0,
                pairCount: 0,
            },
        };
    }
    const candidates = Array.isArray(slate?.candidates) ? slate.candidates : [];
    const entries = [];
    for (let leftIndex = 0; leftIndex < candidates.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < candidates.length; rightIndex += 1) {
            const left = candidates[leftIndex];
            const right = candidates[rightIndex];
            const changedFactors = buildChangedFactors({
                candidateA: left.candidate,
                candidateB: right.candidate,
                learningKeyspaceProfile,
            });
            const changedTierIds = Array.from(new Set(
                changedFactors.map((factor) => resolveSakuraLatentTierId(factor.id)),
            ));
            const sourceContexts = [left.sourceContext, right.sourceContext]
                .filter(isPlainObject);
            const isColdStartPair = sourceContextsContainColdStart(sourceContexts);
            const pairType = isColdStartPair
                ? 'sobol_cold_start'
                : resolvePairType(changedFactors);
            const sharedSeedApplied = Number.isFinite(Number(left.candidate?.seed))
                && Number(left.candidate.seed) === Number(right.candidate?.seed);
            const sourcePairSignatures = Array.from(new Set(
                [left.sourcePairSignature, right.sourcePairSignature].filter(Boolean),
            ));
            const context = {
                mode: 'learn_mode',
                pairType,
                latentSpace: 'canonical_v2',
                learningKeyspaceProfile: resolveSakuraLearningLatentProfile(learningKeyspaceProfile),
                sharedSeedPolicy: sharedSeedApplied ? 'shared' : 'independent',
                sharedSeedApplied,
                coldStart: isColdStartPair,
                focusCount: changedFactors.length,
                changedFactors,
                changedTierIds,
                comparabilityTarget: round(
                    resolveComparabilityTarget(pairType, changedTierIds.length),
                    3,
                ),
                lattice: {
                    source: 'candidate_slate',
                    candidateA: left.signature,
                    candidateB: right.signature,
                    sourcePairSignatures,
                    sourceStrategies: Array.from(new Set(
                        [left.sourceStrategy, right.sourceStrategy].filter(Boolean),
                    )),
                },
            };
            const strategy = resolveStrategy(pairType);
            const pair = createPair(left.candidate, right.candidate, context);
            if (!pair?.A || !pair?.B) {
                continue;
            }
            entries.push({
                pair,
                strategy,
                lattice: {
                    leftIndex,
                    rightIndex,
                    candidateCount: candidates.length,
                    sourcePairSignatures,
                },
                score: null,
            });
        }
    }
    return {
        entries,
        diagnostics: {
            candidateCount: candidates.length,
            pairCount: entries.length,
            sourcePairCount: Number(slate?.sourcePairCount || 0),
            duplicateCandidateCount: Number(slate?.duplicateCount || 0),
            maxCandidates: Number(slate?.maxCandidates || candidates.length),
        },
    };
};

export const scoreABPairAcquisition = ({
    baseInfoScore = 0,
    comparabilityScore = 0,
    expressionDiversityCredit = 0,
    clarityScore = 0,
    generationPressure = 0,
    gapPenalty = 0,
    morphologyPenalty = 0,
    complexityPenalty = 0,
    redundancyPenalty = 0,
    redundancyPenaltyScale = 0.22,
    repeatPenalty = 0,
} = {}) => clamp01(
    Number(baseInfoScore || 0)
    + (Number(comparabilityScore || 0) * 0.18)
    + (Number(expressionDiversityCredit || 0) * 0.1)
    + Number(generationPressure || 0) * ((Number(clarityScore || 0) * 0.34) - (Number(gapPenalty || 0) * 1.25))
    - (Number(morphologyPenalty || 0) * 0.9)
    - (Number(complexityPenalty || 0) * 0.65)
    - (Number(redundancyPenalty || 0) * Number(redundancyPenaltyScale || 0.22))
    - Number(repeatPenalty || 0)
);
