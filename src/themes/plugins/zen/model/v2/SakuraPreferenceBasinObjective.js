import {
    SAKURA_PREFERENCE_BASIN_MODEL_VERSION,
    SAKURA_PREFERENCE_BASIN_SHAPE,
    SAKURA_PREFERENCE_BASIN_STAGE,
    SAKURA_PREFERENCE_BASIN_VALUE_SPACE,
} from '../SakuraPreferenceBasinContract';
import {
    SAKURA_LEARNING_FACTOR_POLICY_VERSION,
    resolveSakuraLearningFactor,
} from './SakuraLearningFactorPolicy';
import {
    listSakuraLearningLatentKeys,
    resolveSakuraLearningLatentDef,
    resolveSakuraLearningLatentProfile,
} from './SakuraLatentParamApi';

export const SAKURA_OPTIMIZATION_BASIN_GUIDANCE_VERSION = 1;

const VALUE_SPACE = SAKURA_PREFERENCE_BASIN_VALUE_SPACE;
const VALID_STABLE_SHAPES = new Set([
    SAKURA_PREFERENCE_BASIN_SHAPE.INTERIOR,
    SAKURA_PREFERENCE_BASIN_SHAPE.MONOTONIC_HIGH,
    SAKURA_PREFERENCE_BASIN_SHAPE.MONOTONIC_LOW,
]);
const VALID_BASIN_STAGES = new Set(Object.values(SAKURA_PREFERENCE_BASIN_STAGE));

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const clamp01 = (value) => clamp(Number.isFinite(value) ? value : 0, 0, 1);
const isPlainObject = (value) => Boolean(
    value && typeof value === 'object' && !Array.isArray(value),
);
const hasExactKeys = (value, expectedKeys) => {
    if (!isPlainObject(value)) {
        return false;
    }
    const actual = Object.keys(value).sort();
    const expected = [...expectedKeys].sort();
    return actual.length === expected.length
        && actual.every((key, index) => key === expected[index]);
};

const failGuidance = (code, detail) => {
    const error = new Error(`[SakuraPreferenceBasinObjective] ${code}: ${detail}`);
    error.code = code;
    throw error;
};

const requireRatio = (value, field) => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
        failGuidance('ZEN_SAKURA_OPTIMIZATION_BASIN_RATIO_INVALID', field);
    }
    return value;
};

const requireCount = (value, field, { min = 0 } = {}) => {
    if (!Number.isSafeInteger(value) || value < min) {
        failGuidance('ZEN_SAKURA_OPTIMIZATION_BASIN_COUNT_INVALID', field);
    }
    return value;
};

const requireActiveFactorKey = (key, allowedKeys, field) => {
    if (typeof key !== 'string' || !allowedKeys.has(key)) {
        failGuidance('ZEN_SAKURA_OPTIMIZATION_BASIN_FACTOR_INVALID', field);
    }
    const policy = resolveSakuraLearningFactor(key);
    if (policy.status !== 'active' || policy.blocked) {
        failGuidance('ZEN_SAKURA_OPTIMIZATION_BASIN_FACTOR_NOT_ACTIVE', key);
    }
    return key;
};

const sanitizeStableFactor = (factor, allowedKeys, index) => {
    if (!isPlainObject(factor)) {
        failGuidance('ZEN_SAKURA_OPTIMIZATION_BASIN_STABLE_FACTOR_INVALID', `index=${index}`);
    }
    const key = requireActiveFactorKey(factor.factorKey, allowedKeys, `stableFactors[${index}]`);
    const acceptedLow = requireRatio(factor.acceptedLow, `${key}.acceptedLow`);
    const acceptedHigh = requireRatio(factor.acceptedHigh, `${key}.acceptedHigh`);
    if (acceptedHigh < acceptedLow) {
        failGuidance('ZEN_SAKURA_OPTIMIZATION_BASIN_INTERVAL_INVALID', key);
    }
    if (!VALID_STABLE_SHAPES.has(factor.preferenceShape)) {
        failGuidance('ZEN_SAKURA_OPTIMIZATION_BASIN_SHAPE_INVALID', key);
    }
    const winnerMean = requireRatio(factor.winnerMean, `${key}.winnerMean`);
    const winnerStdDev = requireRatio(factor.winnerStdDev, `${key}.winnerStdDev`);
    const consistency = requireRatio(factor.consistency, `${key}.consistency`);
    const evidenceCount = requireCount(
        factor.estimationEvidenceCount,
        `${key}.estimationEvidenceCount`,
        { min: 1 },
    );
    return {
        key,
        acceptedLow,
        acceptedHigh,
        winnerMean,
        winnerStdDev,
        consistency,
        evidenceCount,
        preferenceShape: factor.preferenceShape,
    };
};

export const createSakuraOptimizationBasinGuidance = ({
    preferenceBasin,
    learningKeyspaceProfile,
} = {}) => {
    if (!isPlainObject(preferenceBasin) || !Array.isArray(preferenceBasin.factors)) {
        failGuidance(
            'ZEN_SAKURA_OPTIMIZATION_BASIN_REQUIRED',
            'preferenceBasin.factors must be available from the reliability gate.',
        );
    }
    const profile = resolveSakuraLearningLatentProfile(learningKeyspaceProfile);
    if (
        preferenceBasin.modelVersion !== SAKURA_PREFERENCE_BASIN_MODEL_VERSION
        || preferenceBasin.learningKeyspaceProfile !== profile
        || preferenceBasin.valueSpace !== VALUE_SPACE
    ) {
        failGuidance('ZEN_SAKURA_OPTIMIZATION_BASIN_MODEL_MISMATCH', profile);
    }
    const allowedKeys = new Set(listSakuraLearningLatentKeys({ profile }));
    const activeFactorCount = requireCount(
        preferenceBasin.factorCount,
        'preferenceBasin.factorCount',
        { min: 1 },
    );
    const basinFactorKeys = preferenceBasin.factors.map((factor, index) => {
        if (!isPlainObject(factor) || !VALID_BASIN_STAGES.has(factor.stage)) {
            failGuidance(
                'ZEN_SAKURA_OPTIMIZATION_BASIN_STAGE_INVALID',
                `preferenceBasin.factors[${index}]`,
            );
        }
        return requireActiveFactorKey(
            factor.factorKey,
            allowedKeys,
            `preferenceBasin.factors[${index}]`,
        );
    });
    if (
        activeFactorCount !== allowedKeys.size
        || basinFactorKeys.length !== allowedKeys.size
        || new Set(basinFactorKeys).size !== allowedKeys.size
        || basinFactorKeys.some((key) => !allowedKeys.has(key))
    ) {
        failGuidance('ZEN_SAKURA_OPTIMIZATION_BASIN_KEYSPACE_INVALID', profile);
    }
    const stableFactors = preferenceBasin.factors
        .filter((factor) => factor?.stage === SAKURA_PREFERENCE_BASIN_STAGE.STABLE)
        .map((factor, index) => sanitizeStableFactor(factor, allowedKeys, index));
    const indifferentFactorKeys = preferenceBasin.factors
        .filter((factor) => factor?.stage === SAKURA_PREFERENCE_BASIN_STAGE.INDIFFERENT)
        .map((factor, index) => requireActiveFactorKey(
            factor?.factorKey,
            allowedKeys,
            `indifferentFactorKeys[${index}]`,
        ));
    const unresolvedFactorKeys = preferenceBasin.factors
        .filter((factor) => (
            factor?.stage !== SAKURA_PREFERENCE_BASIN_STAGE.STABLE
            && factor?.stage !== SAKURA_PREFERENCE_BASIN_STAGE.INDIFFERENT
        ))
        .map((factor, index) => requireActiveFactorKey(
            factor?.factorKey,
            allowedKeys,
            `unresolvedFactorKeys[${index}]`,
        ));
    const stableKeySet = new Set(stableFactors.map((factor) => factor.key));
    const indifferentKeySet = new Set(indifferentFactorKeys);
    const unresolvedKeySet = new Set(unresolvedFactorKeys);
    if (
        stableKeySet.size !== stableFactors.length
        || indifferentKeySet.size !== indifferentFactorKeys.length
        || unresolvedKeySet.size !== unresolvedFactorKeys.length
        || indifferentFactorKeys.some((key) => stableKeySet.has(key))
        || unresolvedFactorKeys.some((key) => (
            stableKeySet.has(key) || indifferentKeySet.has(key)
        ))
        || stableKeySet.size + indifferentKeySet.size + unresolvedKeySet.size !== allowedKeys.size
    ) {
        failGuidance('ZEN_SAKURA_OPTIMIZATION_BASIN_FACTOR_DUPLICATE', profile);
    }
    if (!stableFactors.length) {
        failGuidance(
            'ZEN_SAKURA_OPTIMIZATION_BASIN_STABLE_FACTOR_REQUIRED',
            'Adaptive optimization requires at least one stable preference factor.',
        );
    }
    return {
        version: SAKURA_OPTIMIZATION_BASIN_GUIDANCE_VERSION,
        basinModelVersion: SAKURA_PREFERENCE_BASIN_MODEL_VERSION,
        factorPolicyVersion: SAKURA_LEARNING_FACTOR_POLICY_VERSION,
        learningKeyspaceProfile: profile,
        valueSpace: VALUE_SPACE,
        activeFactorCount,
        stableFactors,
        indifferentFactorKeys,
        unresolvedFactorKeys,
    };
};

export const requireSakuraOptimizationBasinGuidance = (
    guidance,
    { learningKeyspaceProfile } = {},
) => {
    if (!hasExactKeys(guidance, [
        'version',
        'basinModelVersion',
        'factorPolicyVersion',
        'learningKeyspaceProfile',
        'valueSpace',
        'activeFactorCount',
        'stableFactors',
        'indifferentFactorKeys',
        'unresolvedFactorKeys',
    ])) {
        failGuidance('ZEN_SAKURA_OPTIMIZATION_BASIN_GUIDANCE_INVALID', 'root');
    }
    const profile = resolveSakuraLearningLatentProfile(learningKeyspaceProfile);
    if (
        guidance.version !== SAKURA_OPTIMIZATION_BASIN_GUIDANCE_VERSION
        || guidance.basinModelVersion !== SAKURA_PREFERENCE_BASIN_MODEL_VERSION
        || guidance.factorPolicyVersion !== SAKURA_LEARNING_FACTOR_POLICY_VERSION
        || guidance.learningKeyspaceProfile !== profile
        || guidance.valueSpace !== VALUE_SPACE
    ) {
        failGuidance('ZEN_SAKURA_OPTIMIZATION_BASIN_GUIDANCE_MISMATCH', profile);
    }
    if (
        !Array.isArray(guidance.stableFactors)
        || !Array.isArray(guidance.indifferentFactorKeys)
        || !Array.isArray(guidance.unresolvedFactorKeys)
    ) {
        failGuidance('ZEN_SAKURA_OPTIMIZATION_BASIN_GUIDANCE_INVALID', 'factor lists');
    }
    const allowedKeys = new Set(listSakuraLearningLatentKeys({ profile }));
    const stableFactors = guidance.stableFactors.map((factor, index) => {
        if (!hasExactKeys(factor, [
            'key',
            'acceptedLow',
            'acceptedHigh',
            'winnerMean',
            'winnerStdDev',
            'consistency',
            'evidenceCount',
            'preferenceShape',
        ])) {
            failGuidance(
                'ZEN_SAKURA_OPTIMIZATION_BASIN_STABLE_FACTOR_INVALID',
                `index=${index}`,
            );
        }
        return sanitizeStableFactor({
            factorKey: factor.key,
            acceptedLow: factor.acceptedLow,
            acceptedHigh: factor.acceptedHigh,
            winnerMean: factor.winnerMean,
            winnerStdDev: factor.winnerStdDev,
            consistency: factor.consistency,
            estimationEvidenceCount: factor.evidenceCount,
            preferenceShape: factor.preferenceShape,
        }, allowedKeys, index);
    });
    const indifferentFactorKeys = guidance.indifferentFactorKeys.map((key, index) => (
        requireActiveFactorKey(key, allowedKeys, `indifferentFactorKeys[${index}]`)
    ));
    const unresolvedFactorKeys = guidance.unresolvedFactorKeys.map((key, index) => (
        requireActiveFactorKey(key, allowedKeys, `unresolvedFactorKeys[${index}]`)
    ));
    const stableKeySet = new Set(stableFactors.map((factor) => factor.key));
    const indifferentKeySet = new Set(indifferentFactorKeys);
    const unresolvedKeySet = new Set(unresolvedFactorKeys);
    if (
        stableKeySet.size !== stableFactors.length
        || indifferentKeySet.size !== indifferentFactorKeys.length
        || unresolvedKeySet.size !== unresolvedFactorKeys.length
        || indifferentFactorKeys.some((key) => stableKeySet.has(key))
        || unresolvedFactorKeys.some((key) => (
            stableKeySet.has(key) || indifferentKeySet.has(key)
        ))
        || stableKeySet.size + indifferentKeySet.size + unresolvedKeySet.size !== allowedKeys.size
    ) {
        failGuidance('ZEN_SAKURA_OPTIMIZATION_BASIN_FACTOR_DUPLICATE', profile);
    }
    if (!stableFactors.length) {
        failGuidance('ZEN_SAKURA_OPTIMIZATION_BASIN_STABLE_FACTOR_REQUIRED', profile);
    }
    const activeFactorCount = requireCount(guidance.activeFactorCount, 'activeFactorCount', {
        min: 1,
    });
    if (activeFactorCount !== allowedKeys.size) {
        failGuidance('ZEN_SAKURA_OPTIMIZATION_BASIN_KEYSPACE_INVALID', profile);
    }
    return {
        ...guidance,
        activeFactorCount,
        stableFactors,
        indifferentFactorKeys,
        unresolvedFactorKeys,
    };
};

const normalizeLatentValue = (latent, factorKey, profile) => {
    const definition = resolveSakuraLearningLatentDef(factorKey, { profile });
    const min = Number(definition?.min);
    const max = Number(definition?.max);
    const value = Number(latent?.[factorKey]);
    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min || !Number.isFinite(value)) {
        failGuidance('ZEN_SAKURA_OPTIMIZATION_BASIN_LATENT_INVALID', factorKey);
    }
    return clamp01((value - min) / (max - min));
};

export const scoreSakuraPreferenceBasinAffinity = ({
    latent,
    guidance,
} = {}) => {
    const canonical = requireSakuraOptimizationBasinGuidance(guidance, {
        learningKeyspaceProfile: guidance?.learningKeyspaceProfile,
    });
    let weightedAffinity = 0;
    let totalWeight = 0;
    let insideWeight = 0;
    canonical.stableFactors.forEach((factor) => {
        const normalized = normalizeLatentValue(
            latent,
            factor.key,
            canonical.learningKeyspaceProfile,
        );
        const distance = factor.preferenceShape === SAKURA_PREFERENCE_BASIN_SHAPE.MONOTONIC_HIGH
            ? Math.max(0, factor.acceptedLow - normalized)
            : factor.preferenceShape === SAKURA_PREFERENCE_BASIN_SHAPE.MONOTONIC_LOW
                ? Math.max(0, normalized - factor.acceptedHigh)
                : normalized < factor.acceptedLow
                    ? factor.acceptedLow - normalized
                    : normalized > factor.acceptedHigh
                        ? normalized - factor.acceptedHigh
                        : 0;
        const intervalWidth = factor.acceptedHigh - factor.acceptedLow;
        const shoulder = clamp(
            factor.winnerStdDev + (intervalWidth / 2),
            0.08,
            0.22,
        );
        const affinity = Math.exp(-0.5 * ((distance / shoulder) ** 2));
        const quality = clamp01(
            (0.45 * factor.consistency)
            + (0.2 * Math.min(factor.evidenceCount / 16, 1))
            + (0.2 * (1 - Math.min(factor.winnerStdDev / 0.16, 1)))
            + (0.15 * (1 - Math.min(intervalWidth / 0.4, 1))),
        );
        const policy = resolveSakuraLearningFactor(factor.key);
        const weight = Math.max(
            0.01,
            policy.observability * policy.proposalWeight * (0.5 + (0.5 * quality)),
        );
        weightedAffinity += affinity * weight;
        totalWeight += weight;
        if (distance === 0) {
            insideWeight += weight;
        }
    });
    const affinity = totalWeight > 0 ? weightedAffinity / totalWeight : 0;
    const support = 1 - Math.exp(-(totalWeight / 2.5));
    return {
        affinity: clamp01(affinity),
        support: clamp01(support),
        insideRatio: totalWeight > 0 ? clamp01(insideWeight / totalWeight) : 0,
        stableFactorCount: canonical.stableFactors.length,
    };
};

export const applySakuraPreferenceBasinPenalty = ({
    baseObjective,
    affinity,
    support,
    reliabilityHint,
} = {}) => {
    const penaltyWeight = 0.3 * clamp01(support) * clamp01(reliabilityHint);
    const penalty = penaltyWeight * (1 - clamp01(affinity));
    return {
        objective: clamp01(clamp01(baseObjective) - penalty),
        penalty: clamp01(penalty),
        penaltyWeight: clamp01(penaltyWeight),
    };
};

export const buildSakuraOptimizationPairwiseLatent = ({
    latent,
    baseLatent,
    guidance,
} = {}) => {
    const canonical = requireSakuraOptimizationBasinGuidance(guidance, {
        learningKeyspaceProfile: guidance?.learningKeyspaceProfile,
    });
    const projected = { ...(latent || {}) };
    canonical.indifferentFactorKeys.forEach((key) => {
        const anchorValue = Number(baseLatent?.[key]);
        if (!Number.isFinite(anchorValue)) {
            failGuidance('ZEN_SAKURA_OPTIMIZATION_BASIN_BASE_LATENT_INVALID', key);
        }
        projected[key] = anchorValue;
    });
    return projected;
};

export const buildSakuraStableBasinGuideLatent = ({
    baseLatent,
    guidance,
} = {}) => {
    const canonical = requireSakuraOptimizationBasinGuidance(guidance, {
        learningKeyspaceProfile: guidance?.learningKeyspaceProfile,
    });
    const guided = { ...(baseLatent || {}) };
    canonical.stableFactors.forEach((factor) => {
        const definition = resolveSakuraLearningLatentDef(factor.key, {
            profile: canonical.learningKeyspaceProfile,
        });
        const normalizedMidpoint = (factor.acceptedLow + factor.acceptedHigh) / 2;
        const rawValue = definition.min + ((definition.max - definition.min) * normalizedMidpoint);
        guided[factor.key] = definition.integer ? Math.round(rawValue) : rawValue;
    });
    return guided;
};
