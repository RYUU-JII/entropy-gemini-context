import {
    ZEN_BONSAI_PROFILE_AGGREGATE_MODEL_STATE_KEY,
    requireZenBonsaiProfileAggregateStorageValue,
    validateZenBonsaiProfileAggregateStorageValue,
} from './ZenBonsaiProfileAggregateStorageContract.js';

export const ZEN_THEME_MODEL_STATE_KEYS = Object.freeze({
    SAKURA_V2_TRAINING_LOG: 'zen_sakura_v2_training_log',
    SAKURA_V2_AB_HISTORY: 'zen_sakura_v2_ab_history',
    SAKURA_V2_PAIRWISE_GP: 'zen_sakura_v2_pairwise_gp_additive_model',
    VNEXT_PREFERENCE_MODEL: 'zen_vnext_preference_model_v1',
    VNEXT_AB_TRIALS: 'zen_vnext_ab_trials_v1',
    VNEXT_RELIABILITY: 'zen_vnext_reliability_state_v1',
    KOI_ROSTER_MEMORY: 'zen_koi_roster_memory_v1',
    KOI_APPEARANCE_CACHE: 'zen_koi_domain_appearance_cache_v1',
    KOI_ACTIVITY_PROFILE_CACHE: 'zen_koi_domain_activity_profile_cache_v1',
    BONSAI_CULTIVATION_LEDGER: 'zen_bonsai_cultivation_ledger_v1',
    BONSAI_PROFILE_AGGREGATE: ZEN_BONSAI_PROFILE_AGGREGATE_MODEL_STATE_KEY,
});

export const ZEN_THEME_MODEL_STATE_VALUE_CLASS = Object.freeze({
    MODEL: 'model',
    DURABLE: 'durable',
    DISCARDABLE_CACHE: 'discardable_cache',
});

export const ZEN_THEME_MODEL_STATE_SNAPSHOT_BEHAVIOR = Object.freeze({
    INCLUDE: 'include',
    EXCLUDE: 'exclude',
});

const isPlainObject = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const isNonNegativeInteger = (value) => Number.isSafeInteger(value) && value >= 0;
const isPositiveInteger = (value) => Number.isSafeInteger(value) && value > 0;
const isNullableString = (value) => value === null || typeof value === 'string';
const isNullableNumber = (value) => value === null || isFiniteNumber(value);
const isRatio = (value) => isFiniteNumber(value) && value >= 0 && value <= 1;
const isDateKey = (value, { allowEmpty = true } = {}) => (
    typeof value === 'string'
    && ((allowEmpty && value === '') || /^\d{4}-\d{2}-\d{2}$/u.test(value))
);
const hasExactKeys = (value, expectedKeys) => {
    if (!isPlainObject(value)) return false;
    const actualKeys = Object.keys(value).sort();
    const canonicalKeys = [...expectedKeys].sort();
    return actualKeys.length === canonicalKeys.length
        && actualKeys.every((key, index) => key === canonicalKeys[index]);
};
const isFiniteVector = (value, length = null) => (
    Array.isArray(value)
    && (length === null || value.length === length)
    && value.every(isFiniteNumber)
);
const isStringVector = (value, { allowEmpty = false } = {}) => (
    Array.isArray(value)
    && (allowEmpty || value.length > 0)
    && value.every((entry) => typeof entry === 'string' && entry.length > 0)
);
const parseCanonicalJson = (value) => {
    if (typeof value !== 'string' || !value) return null;
    try {
        const parsed = JSON.parse(value);
        return JSON.stringify(parsed) === value ? parsed : null;
    } catch (_) {
        return null;
    }
};

const validateNeuralModelState = (value) => {
    const state = parseCanonicalJson(value);
    const keys = [
        'version', 'inputSize', 'hiddenSize', 'featureKeys', 'trainingSteps',
        'avgAbsError', 'w1', 'w2', 'b1', 'b2',
    ];
    if (!hasExactKeys(state, keys)
        || state.version !== 3
        || !isPositiveInteger(state.inputSize)
        || !isPositiveInteger(state.hiddenSize)
        || !isStringVector(state.featureKeys)
        || state.featureKeys.length !== 22
        || state.inputSize !== state.featureKeys.length + (8 * 8)
        || !isNonNegativeInteger(state.trainingSteps)
        || !isFiniteNumber(state.avgAbsError)
        || !Array.isArray(state.w1)
        || state.w1.length !== state.inputSize
        || !state.w1.every((row) => isFiniteVector(row, state.hiddenSize))
        || !Array.isArray(state.w2)
        || state.w2.length !== state.hiddenSize
        || !state.w2.every((row) => isFiniteVector(row, 1))
        || !isFiniteVector(state.b1, state.hiddenSize)
        || !isFiniteVector(state.b2, 1)) return false;
    return true;
};

const validatePairwiseGroupBasis = (group, latentSize) => (
    hasExactKeys(group, ['id', 'keyIndices', 'basisCount', 'frequencies', 'phases'])
    && typeof group.id === 'string'
    && group.id.length > 0
    && isPositiveInteger(group.basisCount)
    && Array.isArray(group.keyIndices)
    && group.keyIndices.length > 0
    && group.keyIndices.every((index) => Number.isSafeInteger(index) && index >= 0 && index < latentSize)
    && Array.isArray(group.frequencies)
    && group.frequencies.length === group.basisCount
    && group.frequencies.every((row) => isFiniteVector(row, group.keyIndices.length))
    && isFiniteVector(group.phases, group.basisCount)
);

const validatePairwiseModelState = (value) => {
    const state = parseCanonicalJson(value);
    const baseKeys = [
        'version', 'mode', 'learningKeyspaceProfile', 'latentKeys', 'trainingPairs',
        'avgPairLoss', 'avgPredictiveVariance', 'temperature', 'temperatureLearningRate',
        'rawCalibrationError', 'calibratedCalibrationError', 'calibrationSamples',
        'priorPrecision', 'learningRate', 'basisSeed', 'weights', 'precision',
        'axisRelevance', 'groupBasis',
    ];
    const keys = [...baseKeys, 'generationSemantics'];
    if (!hasExactKeys(state, keys)
        || state.version !== 5
        || state.mode !== 'additive_gp_live'
        || typeof state.generationSemantics !== 'string' || !state.generationSemantics
        || typeof state.learningKeyspaceProfile !== 'string'
        || !state.learningKeyspaceProfile
        || !isStringVector(state.latentKeys)
        || !isNonNegativeInteger(state.trainingPairs)
        || !isFiniteNumber(state.avgPairLoss)
        || !isFiniteNumber(state.avgPredictiveVariance)
        || !isFiniteNumber(state.temperature)
        || !isFiniteNumber(state.temperatureLearningRate)
        || !isFiniteNumber(state.rawCalibrationError)
        || !isFiniteNumber(state.calibratedCalibrationError)
        || !isNonNegativeInteger(state.calibrationSamples)
        || !isFiniteNumber(state.priorPrecision)
        || !isFiniteNumber(state.learningRate)
        || !isNonNegativeInteger(state.basisSeed)
        || !isFiniteVector(state.weights)
        || !isFiniteVector(state.precision, state.weights.length)
        || !isFiniteVector(state.axisRelevance, state.latentKeys.length)
        || !Array.isArray(state.groupBasis)
        || !state.groupBasis.length
        || !state.groupBasis.every((group) => validatePairwiseGroupBasis(group, state.latentKeys.length))
    ) {
        return false;
    }
    const expectedInputSize = 1 + state.groupBasis.reduce(
        (total, group) => total + group.basisCount + 1,
        0,
    );
    return state.weights.length === expectedInputSize;
};

const SAKURA_AB_HISTORY_BASE_ENTRY_KEYS = Object.freeze([
    'id', 'treeType', 'picked', 'winnerSeed', 'loserSeed', 'traceId',
    'generationContext', 'pairSignature', 'renderSignature', 'scoreDelta',
    'weights', 'query', 'responseTimeMs', 'questionQuality', 'A', 'B',
    'timestamp',
]);
const SAKURA_AB_HISTORY_ENTRY_KEYS_V2 = Object.freeze([
    ...SAKURA_AB_HISTORY_BASE_ENTRY_KEYS,
    'prediction',
]);
const SAKURA_AB_HISTORY_PREDICTION_SOURCE_V2 = 'pairwise_compare_pre_feedback';
const validateSakuraAbHistoryPredictionV2 = (value) => (
    value === null
    || (
        hasExactKeys(value, ['pairwiseProbabilityA', 'source', 'modelContractId'])
        && isRatio(value.pairwiseProbabilityA)
        && value.source === SAKURA_AB_HISTORY_PREDICTION_SOURCE_V2
        && typeof value.modelContractId === 'string' && value.modelContractId.length > 0
    )
);
const validateSakuraAbHistoryState = (value) => {
    if (
        !hasExactKeys(value, ['version', 'updatedAt', 'entries'])
        || value.version !== 2
        || !isNonNegativeInteger(value.updatedAt)
        || !Array.isArray(value.entries)
        || value.entries.length > 1000
    ) {
        return false;
    }
    return value.entries.every((entry) => (
        hasExactKeys(entry, SAKURA_AB_HISTORY_ENTRY_KEYS_V2)
        && (entry.picked === 'A'
            || entry.picked === 'B'
            || entry.picked === 'BOTH_GOOD'
            || entry.picked === 'PASS'
            || entry.picked === 'WORSE_A'
            || entry.picked === 'WORSE_B')
        && validateSakuraAbHistoryPredictionV2(entry.prediction)
    ));
};

const ZEN_VNEXT_PREFERENCE_FEATURE_KEYS_V1 = Object.freeze([
    'trunk_division',
    'trunk_lean',
    'trunk_movement',
    'trunk_primary_sweep',
    'trunk_counter_sweep',
    'trunk_apex_reach',
    'trunk_void_respect',
    'trunk_taper',
    'trunk_height',
    'first_branch_height',
    'apex_softness',
    'branch_density',
    'branch_spread',
    'lineage_sweep_persistence',
    'lineage_recovery_bias',
    'pad_compactness',
    'pad_terminal_density',
    'pad_sweep_bias',
    'ramification',
    'crown_openness',
    'droop_bias',
    'blossom_bias',
]);
const ZEN_VNEXT_PREFERENCE_FACTOR_SIGNATURE_V1 = ZEN_VNEXT_PREFERENCE_FEATURE_KEYS_V1.join('|');

const validateVNextPreferenceState = (value) => {
    if (!hasExactKeys(value, [
        'version', 'bias', 'weights', 'featureKeys', 'trainedAt', 'sampleCount',
        'metrics', 'training',
    ])
        || value.version !== 1
        || !isFiniteNumber(value.bias)
        || !isFiniteVector(value.weights)
        || !isStringVector(value.featureKeys)
        || value.featureKeys.length !== ZEN_VNEXT_PREFERENCE_FEATURE_KEYS_V1.length
        || value.featureKeys.some((key, index) => key !== ZEN_VNEXT_PREFERENCE_FEATURE_KEYS_V1[index])
        || value.weights.length !== value.featureKeys.length
        || !isNonNegativeInteger(value.trainedAt)
        || !isNonNegativeInteger(value.sampleCount)
        || !hasExactKeys(value.metrics, ['loss', 'accuracy', 'meanMargin', 'weightSum'])
        || !Object.values(value.metrics).every(isFiniteNumber)
        || !hasExactKeys(value.training, [
            'sourceTrialCount', 'uniquePairCount', 'repeatPairCount', 'manualTrialCount',
            'autoTrialCount', 'latestTrialAt', 'datasetWeightSum', 'meanSampleWeight',
            'factorSignature',
        ])) return false;
    const training = value.training;
    return [
        training.sourceTrialCount,
        training.uniquePairCount,
        training.repeatPairCount,
        training.manualTrialCount,
        training.autoTrialCount,
        training.latestTrialAt,
    ].every(isNonNegativeInteger)
        && isFiniteNumber(training.datasetWeightSum)
        && training.datasetWeightSum >= 0
        && isFiniteNumber(training.meanSampleWeight)
        && training.meanSampleWeight >= 0
        && training.factorSignature === ZEN_VNEXT_PREFERENCE_FACTOR_SIGNATURE_V1
        && training.sourceTrialCount === value.sampleCount
        && (training.manualTrialCount + training.autoTrialCount) === training.sourceTrialCount
        && training.uniquePairCount <= training.sourceTrialCount
        && training.repeatPairCount <= training.uniquePairCount;
};

const validateVNextCandidate = (candidate) => (
    hasExactKeys(candidate, ['seed', 'factors'])
    && (candidate.seed === null || Number.isSafeInteger(candidate.seed))
    && isPlainObject(candidate.factors)
    && Object.keys(candidate.factors).length > 0
    && Object.values(candidate.factors).every(isFiniteNumber)
);

const validateVNextTrialContext = (context) => (
    hasExactKeys(context, [
        'mode', 'presetId', 'stage', 'seed', 'loopMode', 'episodeId', 'roundId',
        'preparedAt', 'reliabilityAtPrepare', 'modelSampleCountAtPrepare',
        'modelAccuracyAtPrepare',
    ])
    && typeof context.mode === 'string'
    && isNullableString(context.presetId)
    && isNullableString(context.stage)
    && (context.seed === null || Number.isSafeInteger(context.seed))
    && (context.loopMode === 'manual' || context.loopMode === 'auto')
    && isNullableString(context.episodeId)
    && (context.roundId === null || isPositiveInteger(context.roundId))
    && (context.preparedAt === null || isNonNegativeInteger(context.preparedAt))
    && isNullableNumber(context.reliabilityAtPrepare)
    && (context.modelSampleCountAtPrepare === null || isNonNegativeInteger(context.modelSampleCountAtPrepare))
    && isNullableNumber(context.modelAccuracyAtPrepare)
);

const validateVNextTrial = (trial) => (
    hasExactKeys(trial, ['id', 'createdAt', 'chosen', 'pairKey', 'candidateA', 'candidateB', 'context'])
    && typeof trial.id === 'string'
    && trial.id.length > 0
    && isNonNegativeInteger(trial.createdAt)
    && (trial.chosen === 'A' || trial.chosen === 'B')
    && typeof trial.pairKey === 'string'
    && trial.pairKey.length > 0
    && validateVNextCandidate(trial.candidateA)
    && validateVNextCandidate(trial.candidateB)
    && validateVNextTrialContext(trial.context)
);

const validateVNextTrials = (value) => (
    Array.isArray(value)
    && value.length <= 1600
    && value.every(validateVNextTrial)
);

const validateVNextReliability = (value) => (
    hasExactKeys(value, [
        'value', 'sampleCount', 'pairCount', 'repeatPairCount', 'consistency',
        'volumeScore', 'freshness', 'updatedAt',
    ])
    && isFiniteNumber(value.value)
    && isNonNegativeInteger(value.sampleCount)
    && isNonNegativeInteger(value.pairCount)
    && isNonNegativeInteger(value.repeatPairCount)
    && isFiniteNumber(value.consistency)
    && isFiniteNumber(value.volumeScore)
    && isFiniteNumber(value.freshness)
    && isNonNegativeInteger(value.updatedAt)
);

const KOI_ROSTER_ENTRY_KEYS = Object.freeze([
    'domain', 'entityId', 'firstSeenAtMs', 'lastRosterAtMs', 'lastActiveAtMs',
    'lastSlot', 'lastCohort', 'lastPolicyStatus', 'lastPresenceState', 'lastRisk',
    'lastPriority', 'lastSignals', 'lastActivityProfile', 'lastExpressionProfile',
    'reentryCount',
]);
const validateKoiRosterEntry = (domain, entry) => (
    hasExactKeys(entry, KOI_ROSTER_ENTRY_KEYS)
    && entry.domain === domain
    && typeof entry.entityId === 'string'
    && entry.entityId.length > 0
    && [entry.firstSeenAtMs, entry.lastRosterAtMs, entry.lastActiveAtMs]
        .every((value) => value === null || isNonNegativeInteger(value))
    && ['hero', 'guardian', 'scout', 'resident'].includes(entry.lastSlot)
    && typeof entry.lastCohort === 'string'
    && typeof entry.lastPolicyStatus === 'string'
    && ['active', 'linger', 'retiring'].includes(entry.lastPresenceState)
    && isFiniteNumber(entry.lastRisk)
    && isFiniteNumber(entry.lastPriority)
    && (entry.lastSignals === null || isPlainObject(entry.lastSignals))
    && (entry.lastActivityProfile === null || isPlainObject(entry.lastActivityProfile))
    && (entry.lastExpressionProfile === null || isPlainObject(entry.lastExpressionProfile))
    && isNonNegativeInteger(entry.reentryCount)
);
const validateKoiRosterMemory = (value) => (
    isPlainObject(value)
    && Object.entries(value).every(([domain, entry]) => (
        domain === domain.trim().toLowerCase()
        && domain.length > 0
        && validateKoiRosterEntry(domain, entry)
    ))
);

const validateKoiAppearanceCache = (value) => (
    isPlainObject(value)
    && Object.entries(value).every(([domain, profile]) => (
        domain === domain.trim().toLowerCase()
        && domain.length > 0
        && hasExactKeys(profile, [
            'seed', 'paletteIndex', 'rerollCount', 'colorMix', 'appearanceMode',
            'breedMatch', 'colorMixHash', 'resolverVersion', 'faviconUpdatedAt',
            'updatedAt',
        ])
        && isNonNegativeInteger(profile.seed)
        && isNonNegativeInteger(profile.paletteIndex)
        && isNonNegativeInteger(profile.rerollCount)
        && isPlainObject(profile.colorMix)
        && typeof profile.appearanceMode === 'string'
        && (profile.breedMatch === null || isPlainObject(profile.breedMatch))
        && typeof profile.colorMixHash === 'string'
        && profile.colorMixHash.length > 0
        && profile.resolverVersion === 'koi_appearance_v1'
        && (profile.faviconUpdatedAt === null || isNonNegativeInteger(profile.faviconUpdatedAt))
        && isFiniteNumber(profile.updatedAt)
    ))
);

const validateKoiActivityProfileCache = (value) => (
    isPlainObject(value)
    && Object.entries(value).every(([domain, profile]) => (
        domain === domain.trim().toLowerCase()
        && domain.length > 0
        && hasExactKeys(profile, [
            'quantile', 'boundDayIndex', 'rebindCount', 'riskSnapshot', 'updatedAt',
            'version',
        ])
        && profile.version === 1
        && isFiniteNumber(profile.quantile)
        && (profile.boundDayIndex === null || Number.isSafeInteger(profile.boundDayIndex))
        && isNonNegativeInteger(profile.rebindCount)
        && isNullableNumber(profile.riskSnapshot)
        && isNonNegativeInteger(profile.updatedAt)
    ))
);

const validateLifeStructuralImprint = (value) => (
    value === null
    || (
        hasExactKeys(value, [
            'active', 'exposureQuality', 'stressWood', 'recoveryWood', 'volatility',
            'canopyReserve', 'lastUpdatedDateKey', 'pendingDateKey',
        ])
        && typeof value.active === 'boolean'
        && [
            value.exposureQuality,
            value.stressWood,
            value.recoveryWood,
            value.volatility,
            value.canopyReserve,
        ].every(isRatio)
        && isDateKey(value.lastUpdatedDateKey)
        && isDateKey(value.pendingDateKey)
    )
);

const validateLifeGrowthSegment = (value) => (
    hasExactKeys(value, [
        'id', 'milestone', 'growthScore', 'dateKey', 'exposureQuality', 'stressWood',
        'recoveryWood', 'volatility', 'canopyReserve', 'healthH', 'vitalityTier',
    ])
    && typeof value.id === 'string'
    && value.id.length > 0
    && isPositiveInteger(value.milestone)
    && isFiniteNumber(value.growthScore)
    && value.growthScore >= 0
    && value.growthScore <= 100
    && isDateKey(value.dateKey)
    && [
        value.exposureQuality,
        value.stressWood,
        value.recoveryWood,
        value.volatility,
        value.canopyReserve,
        value.healthH,
    ].every(isRatio)
    && typeof value.vitalityTier === 'string'
);

const validateCanonicalLifeState = (value) => (
    hasExactKeys(value, [
        'phase', 'growth', 'vitality', 'stress', 'bloom', 'dryness', 'branchSag',
        'windResponse', 'dataDays', 'analysisConfidence', 'maturity', 'vigor',
        'growthEvent', 'structuralImprint', 'growthSegments',
    ])
    && ['seedling', 'juvenile', 'mature'].includes(value.phase)
    && [
        value.growth,
        value.vitality,
        value.stress,
        value.bloom,
        value.dryness,
        value.branchSag,
        value.windResponse,
        value.analysisConfidence,
    ].every(isRatio)
    && isNonNegativeInteger(value.dataDays)
    && hasExactKeys(value.maturity, ['phase', 'growth', 'dataDays', 'analysisConfidence'])
    && value.maturity.phase === value.phase
    && value.maturity.growth === value.growth
    && value.maturity.dataDays === value.dataDays
    && value.maturity.analysisConfidence === value.analysisConfidence
    && hasExactKeys(value.vigor, [
        'vitality', 'stress', 'bloom', 'dryness', 'branchSag', 'windResponse',
    ])
    && value.vigor.vitality === value.vitality
    && value.vigor.stress === value.stress
    && value.vigor.bloom === value.bloom
    && value.vigor.dryness === value.dryness
    && value.vigor.branchSag === value.branchSag
    && value.vigor.windResponse === value.windResponse
    && hasExactKeys(value.growthEvent, [
        'kind', 'strength', 'milestone', 'milestoneEventDateKey', 'lastClosedDateKey',
        'recoveryOverlay', 'microFeedback',
    ])
    && ['none', 'milestone_shoot', 'recovery_shoot'].includes(value.growthEvent.kind)
    && isRatio(value.growthEvent.strength)
    && isNonNegativeInteger(value.growthEvent.milestone)
    && isDateKey(value.growthEvent.milestoneEventDateKey)
    && isDateKey(value.growthEvent.lastClosedDateKey)
    && typeof value.growthEvent.recoveryOverlay === 'boolean'
    && isNullableString(value.growthEvent.microFeedback)
    && validateLifeStructuralImprint(value.structuralImprint)
    && Array.isArray(value.growthSegments)
    && value.growthSegments.every(validateLifeGrowthSegment)
);

const validateOutcome = (value, { includeDateKey = false } = {}) => (
    value === null
    || (
        hasExactKeys(value, includeDateKey
            ? ['available', 'engaged', 'outcome', 'adherence', 'practice', 'dateKey']
            : ['available', 'engaged', 'outcome', 'adherence', 'practice'])
        && typeof value.available === 'boolean'
        && typeof value.engaged === 'boolean'
        && (value.outcome === null || (isFiniteNumber(value.outcome) && value.outcome >= -1 && value.outcome <= 1))
        && (value.adherence === null || (isFiniteNumber(value.adherence) && value.adherence >= -1 && value.adherence <= 1))
        && isRatio(value.practice)
        && (!includeDateKey || isDateKey(value.dateKey))
    )
);

const validateCultivationSample = (dateKey, sample) => (
    hasExactKeys(sample, [
        'dateKey', 'healthRatio', 'growthScore', 'evidenceDays', 'reliability',
        'siteSignature', 'registeredSiteCount', 'scoringMode', 'scoreCoverageRatio',
        'scoreDisplayReady', 'updatedAtMs',
    ])
    && sample.dateKey === dateKey
    && isDateKey(dateKey, { allowEmpty: false })
    && isRatio(sample.healthRatio)
    && isFiniteNumber(sample.growthScore)
    && sample.growthScore >= 0
    && sample.growthScore <= 100
    && isNonNegativeInteger(sample.evidenceDays)
    && isRatio(sample.reliability)
    && typeof sample.siteSignature === 'string'
    && isNonNegativeInteger(sample.registeredSiteCount)
    && typeof sample.scoringMode === 'string'
    && (sample.scoreCoverageRatio === null || isRatio(sample.scoreCoverageRatio))
    && typeof sample.scoreDisplayReady === 'boolean'
    && isNonNegativeInteger(sample.updatedAtMs)
);

const validateCultivationBaseline = (value) => (
    hasExactKeys(value, [
        'status', 'siteSignature', 'startedAtMs', 'sealedAtMs', 'healthRatio',
        'initialPriorHealthRatio', 'growthScore', 'evidenceDays', 'samples', 'adaptive',
    ])
    && ['collecting', 'ready'].includes(value.status)
    && typeof value.siteSignature === 'string'
    && isNonNegativeInteger(value.startedAtMs)
    && isNonNegativeInteger(value.sealedAtMs)
    && (value.healthRatio === null || isRatio(value.healthRatio))
    && (value.initialPriorHealthRatio === null || isRatio(value.initialPriorHealthRatio))
    && (value.growthScore === null || (isFiniteNumber(value.growthScore) && value.growthScore >= 0 && value.growthScore <= 100))
    && isNonNegativeInteger(value.evidenceDays)
    && isPlainObject(value.samples)
    && Object.entries(value.samples).every(([dateKey, sample]) => validateCultivationSample(dateKey, sample))
    && hasExactKeys(value.adaptive, [
        'effectiveHealthRatio', 'centerHealthRatio', 'targetHealthRatio',
        'rollingHealthRatio', 'rollingGrowthScore', 'confidence', 'sampleWeight',
        'sampleCount', 'initialPriorWeight', 'improvementLift', 'contextShift',
        'updatedAtMs',
    ])
    && [
        value.adaptive.effectiveHealthRatio,
        value.adaptive.centerHealthRatio,
        value.adaptive.targetHealthRatio,
        value.adaptive.rollingHealthRatio,
    ].every((entry) => entry === null || isRatio(entry))
    && (value.adaptive.rollingGrowthScore === null
        || (isFiniteNumber(value.adaptive.rollingGrowthScore)
            && value.adaptive.rollingGrowthScore >= 0
            && value.adaptive.rollingGrowthScore <= 100))
    && isRatio(value.adaptive.confidence)
    && isFiniteNumber(value.adaptive.sampleWeight)
    && value.adaptive.sampleWeight >= 0
    && isNonNegativeInteger(value.adaptive.sampleCount)
    && isFiniteNumber(value.adaptive.initialPriorWeight)
    && value.adaptive.initialPriorWeight >= 0
    && isFiniteNumber(value.adaptive.improvementLift)
    && value.adaptive.improvementLift >= 0
    && isRatio(value.adaptive.contextShift)
    && isNonNegativeInteger(value.adaptive.updatedAtMs)
);

const validateCultivationVitality = (value) => (
    hasExactKeys(value, [
        'healthH', 'growthG', 'tier', 'lastMilestone', 'milestoneEventDateKey',
        'lastClosedDateKey', 'lastClosedOutcome', 'pendingDateKey', 'pendingOutcome',
        'consecutiveLowHealthDays', 'diebackEpisodeLoss', 'recoveryDeltas',
        'updatedAtMs',
    ])
    && isRatio(value.healthH)
    && (value.growthG === null || (isFiniteNumber(value.growthG) && value.growthG >= 0 && value.growthG <= 100))
    && ['thriving', 'steady', 'strained', 'withered'].includes(value.tier)
    && isNonNegativeInteger(value.lastMilestone)
    && isDateKey(value.milestoneEventDateKey)
    && isDateKey(value.lastClosedDateKey)
    && validateOutcome(value.lastClosedOutcome)
    && isDateKey(value.pendingDateKey)
    && validateOutcome(value.pendingOutcome)
    && isNonNegativeInteger(value.consecutiveLowHealthDays)
    && isFiniteNumber(value.diebackEpisodeLoss)
    && value.diebackEpisodeLoss >= 0
    && Array.isArray(value.recoveryDeltas)
    && value.recoveryDeltas.length <= 2
    && value.recoveryDeltas.every((entry) => isFiniteNumber(entry) && entry >= -1 && entry <= 1)
    && isNonNegativeInteger(value.updatedAtMs)
);

const validateCultivationStructuralImprint = (value) => (
    hasExactKeys(value, [
        'schemaVersion', 'exposureQuality', 'stressWood', 'recoveryWood', 'volatility',
        'canopyReserve', 'lastUpdatedDateKey', 'lastEngagedOutcome', 'pendingDateKey',
        'pendingOutcome', 'updatedAtMs',
    ])
    && value.schemaVersion === 1
    && [
        value.exposureQuality,
        value.stressWood,
        value.recoveryWood,
        value.volatility,
        value.canopyReserve,
    ].every(isRatio)
    && isDateKey(value.lastUpdatedDateKey)
    && validateOutcome(value.lastEngagedOutcome, { includeDateKey: true })
    && isDateKey(value.pendingDateKey)
    && validateOutcome(value.pendingOutcome, { includeDateKey: true })
    && isNonNegativeInteger(value.updatedAtMs)
);

const validateCultivationGrowthSegment = (value) => (
    hasExactKeys(value, [
        'schemaVersion', 'id', 'milestone', 'growthScore', 'dateKey',
        'exposureQuality', 'stressWood', 'recoveryWood', 'volatility', 'canopyReserve',
        'healthH', 'vitalityTier', 'createdAtMs',
    ])
    && value.schemaVersion === 1
    && validateLifeGrowthSegment(Object.fromEntries(
        Object.entries(value).filter(([key]) => key !== 'schemaVersion' && key !== 'createdAtMs'),
    ))
    && isNonNegativeInteger(value.createdAtMs)
);

const validateCultivationLedger = (value) => (
    hasExactKeys(value, [
        'schemaVersion', 'createdAtMs', 'updatedAtMs', 'baseline', 'dailyCap',
        'vitality', 'structuralImprint', 'growthSegments',
    ])
    && value.schemaVersion === 1
    && isNonNegativeInteger(value.createdAtMs)
    && isNonNegativeInteger(value.updatedAtMs)
    && value.updatedAtMs >= value.createdAtMs
    && validateCultivationBaseline(value.baseline)
    && hasExactKeys(value.dailyCap, ['dateKey', 'anchorLifeState', 'lastCappedLifeState'])
    && isDateKey(value.dailyCap.dateKey)
    && (value.dailyCap.anchorLifeState === null || validateCanonicalLifeState(value.dailyCap.anchorLifeState))
    && (value.dailyCap.lastCappedLifeState === null || validateCanonicalLifeState(value.dailyCap.lastCappedLifeState))
    && validateCultivationVitality(value.vitality)
    && validateCultivationStructuralImprint(value.structuralImprint)
    && Array.isArray(value.growthSegments)
    && value.growthSegments.every(validateCultivationGrowthSegment)
);

const createContract = ({ owner, valueClass, snapshotBehavior, validate }) => Object.freeze({
    owner,
    valueClass,
    snapshotBehavior,
    validate,
});

export const ZEN_THEME_MODEL_STATE_CONTRACTS = Object.freeze({
    [ZEN_THEME_MODEL_STATE_KEYS.SAKURA_V2_TRAINING_LOG]: createContract({
        owner: 'NeuralZen',
        valueClass: ZEN_THEME_MODEL_STATE_VALUE_CLASS.MODEL,
        snapshotBehavior: ZEN_THEME_MODEL_STATE_SNAPSHOT_BEHAVIOR.INCLUDE,
        validate: validateNeuralModelState,
    }),
    [ZEN_THEME_MODEL_STATE_KEYS.SAKURA_V2_AB_HISTORY]: createContract({
        owner: 'useZenLearningLab',
        valueClass: ZEN_THEME_MODEL_STATE_VALUE_CLASS.MODEL,
        snapshotBehavior: ZEN_THEME_MODEL_STATE_SNAPSHOT_BEHAVIOR.INCLUDE,
        validate: validateSakuraAbHistoryState,
    }),
    [ZEN_THEME_MODEL_STATE_KEYS.SAKURA_V2_PAIRWISE_GP]: createContract({
        owner: 'SakuraAdditivePairwiseGPModel',
        valueClass: ZEN_THEME_MODEL_STATE_VALUE_CLASS.MODEL,
        snapshotBehavior: ZEN_THEME_MODEL_STATE_SNAPSHOT_BEHAVIOR.INCLUDE,
        validate: validatePairwiseModelState,
    }),
    [ZEN_THEME_MODEL_STATE_KEYS.VNEXT_PREFERENCE_MODEL]: createContract({
        owner: 'VNextPreferenceModelStore',
        valueClass: ZEN_THEME_MODEL_STATE_VALUE_CLASS.MODEL,
        snapshotBehavior: ZEN_THEME_MODEL_STATE_SNAPSHOT_BEHAVIOR.INCLUDE,
        validate: validateVNextPreferenceState,
    }),
    [ZEN_THEME_MODEL_STATE_KEYS.VNEXT_AB_TRIALS]: createContract({
        owner: 'VNextFeedbackStore',
        valueClass: ZEN_THEME_MODEL_STATE_VALUE_CLASS.MODEL,
        snapshotBehavior: ZEN_THEME_MODEL_STATE_SNAPSHOT_BEHAVIOR.INCLUDE,
        validate: validateVNextTrials,
    }),
    [ZEN_THEME_MODEL_STATE_KEYS.VNEXT_RELIABILITY]: createContract({
        owner: 'VNextFeedbackStore',
        valueClass: ZEN_THEME_MODEL_STATE_VALUE_CLASS.MODEL,
        snapshotBehavior: ZEN_THEME_MODEL_STATE_SNAPSHOT_BEHAVIOR.INCLUDE,
        validate: validateVNextReliability,
    }),
    [ZEN_THEME_MODEL_STATE_KEYS.KOI_ROSTER_MEMORY]: createContract({
        owner: 'zenRosterRepository',
        valueClass: ZEN_THEME_MODEL_STATE_VALUE_CLASS.DURABLE,
        snapshotBehavior: ZEN_THEME_MODEL_STATE_SNAPSHOT_BEHAVIOR.INCLUDE,
        validate: validateKoiRosterMemory,
    }),
    [ZEN_THEME_MODEL_STATE_KEYS.KOI_APPEARANCE_CACHE]: createContract({
        owner: 'zenAppearanceRepository',
        valueClass: ZEN_THEME_MODEL_STATE_VALUE_CLASS.DISCARDABLE_CACHE,
        snapshotBehavior: ZEN_THEME_MODEL_STATE_SNAPSHOT_BEHAVIOR.EXCLUDE,
        validate: validateKoiAppearanceCache,
    }),
    [ZEN_THEME_MODEL_STATE_KEYS.KOI_ACTIVITY_PROFILE_CACHE]: createContract({
        owner: 'zenActivityProfileRepository',
        valueClass: ZEN_THEME_MODEL_STATE_VALUE_CLASS.DISCARDABLE_CACHE,
        snapshotBehavior: ZEN_THEME_MODEL_STATE_SNAPSHOT_BEHAVIOR.EXCLUDE,
        validate: validateKoiActivityProfileCache,
    }),
    [ZEN_THEME_MODEL_STATE_KEYS.BONSAI_CULTIVATION_LEDGER]: createContract({
        owner: 'ZenBonsaiCultivationLedger',
        valueClass: ZEN_THEME_MODEL_STATE_VALUE_CLASS.DURABLE,
        snapshotBehavior: ZEN_THEME_MODEL_STATE_SNAPSHOT_BEHAVIOR.INCLUDE,
        validate: validateCultivationLedger,
    }),
    [ZEN_THEME_MODEL_STATE_KEYS.BONSAI_PROFILE_AGGREGATE]: createContract({
        owner: 'ZenBonsaiProfileAggregateRepository',
        valueClass: ZEN_THEME_MODEL_STATE_VALUE_CLASS.DURABLE,
        snapshotBehavior: ZEN_THEME_MODEL_STATE_SNAPSHOT_BEHAVIOR.INCLUDE,
        validate: validateZenBonsaiProfileAggregateStorageValue,
    }),
});

export const requireZenThemeModelStateKey = (key) => {
    if (typeof key !== 'string' || !key || key.trim() !== key) {
        throw new Error('ZEN_THEME_MODEL_STATE_KEY_REQUIRED');
    }
    if (!Object.prototype.hasOwnProperty.call(ZEN_THEME_MODEL_STATE_CONTRACTS, key)) {
        throw new Error(`ZEN_THEME_MODEL_STATE_KEY_UNKNOWN:${key}`);
    }
    return key;
};

export const getZenThemeModelStateContract = (key) => (
    ZEN_THEME_MODEL_STATE_CONTRACTS[requireZenThemeModelStateKey(key)]
);

export const requireZenThemeModelStateValue = (key, value) => {
    const normalizedKey = requireZenThemeModelStateKey(key);
    if (normalizedKey === ZEN_THEME_MODEL_STATE_KEYS.BONSAI_PROFILE_AGGREGATE) {
        return requireZenBonsaiProfileAggregateStorageValue(value);
    }
    const contract = ZEN_THEME_MODEL_STATE_CONTRACTS[normalizedKey];
    if (!contract.validate(value)) {
        throw new Error(`ZEN_THEME_MODEL_STATE_VALUE_INVALID:${normalizedKey}`);
    }
    return value;
};

export const isZenThemeModelStateDiscardableCacheKey = (key) => (
    getZenThemeModelStateContract(key).valueClass
    === ZEN_THEME_MODEL_STATE_VALUE_CLASS.DISCARDABLE_CACHE
);

export const isZenThemeModelStateSnapshotIncluded = (key) => (
    getZenThemeModelStateContract(key).snapshotBehavior
    === ZEN_THEME_MODEL_STATE_SNAPSHOT_BEHAVIOR.INCLUDE
);

export const requireZenThemeModelStateSnapshotValue = (key, value) => {
    const normalizedKey = requireZenThemeModelStateKey(key);
    if (!isZenThemeModelStateSnapshotIncluded(normalizedKey)) {
        throw new Error(`ZEN_THEME_MODEL_STATE_SNAPSHOT_KEY_EXCLUDED:${normalizedKey}`);
    }
    return requireZenThemeModelStateValue(normalizedKey, value);
};
