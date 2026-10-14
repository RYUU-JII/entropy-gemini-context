import {
    applySakuraPreferenceBasinFixedFactorValues,
    clampSakuraLatentByLearningRange,
    listSakuraLearningLatentKeys,
    resolveSakuraLearningLatentDef,
    resolveSakuraLearningLatentProfile,
} from './SakuraLatentParamApi';
import {
    resolveSakuraLatentTierId,
} from './SakuraLatentTierRegistry';

const clamp01 = (value) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
const clampInt = (value, min, max) => Math.min(max, Math.max(min, Math.round(value)));
const clamp = (value, min, max) => Math.min(
    max,
    Math.max(min, Number.isFinite(value) ? value : min),
);
const round = (value, digits = 4) => Number((Number.isFinite(value) ? value : 0).toFixed(digits));
const MIN_CHANGED_FACTOR_DELTA_NORM = 0.015;
const PERTURBATION_DECAY_START_ROUND = 24;
const PERTURBATION_DECAY_HORIZON = 96;
const MIN_TARGET_PAIR_GAP_NORM = 0.03;
const MAX_TARGET_PAIR_GAP_NORM = 0.32;

const failLatentPairContract = (code, detail) => {
    const error = new Error(`${code}:${detail}`);
    error.code = code;
    throw error;
};

const resolveLearningKeySpace = (learningKeyspaceProfile = null) => {
    const profile = resolveSakuraLearningLatentProfile(learningKeyspaceProfile);
    const learningLatentKeys = listSakuraLearningLatentKeys({ profile });
    return {
        profile,
        learningLatentKeys,
    };
};

export const V2_LATENT_PAIR_TYPE = {
    ISOLATION: 'isolation_pair',
    MIXED: 'mixed_pair',
    DIVERSITY: 'diversity_pair',
};

export const describeSakuraLatentChanges = ({
    latentA = {},
    latentB = {},
    learningKeyspaceProfile = null,
} = {}) => {
    const profile = resolveSakuraLearningLatentProfile(learningKeyspaceProfile);
    const learningLatentKeys = listSakuraLearningLatentKeys({ profile });
    const changedFactors = learningLatentKeys
        .map((key) => {
            const def = resolveSakuraLearningLatentDef(key, { profile });
            const a = Number(latentA?.[key]);
            const b = Number(latentB?.[key]);
            if (!def || !Number.isFinite(a) || !Number.isFinite(b)) {
                return null;
            }
            const span = Math.max(1e-6, Number(def.max) - Number(def.min));
            const deltaNorm = Math.abs((a - b) / span);
            if (deltaNorm < MIN_CHANGED_FACTOR_DELTA_NORM) {
                return null;
            }
            return {
                id: key,
                label: 'Latent',
                a: round(a),
                b: round(b),
                deltaNorm: round(deltaNorm),
            };
        })
        .filter(Boolean)
        .sort((left, right) => Number(right.deltaNorm || 0) - Number(left.deltaNorm || 0));
    const changedTierIds = Array.from(new Set(
        changedFactors.map((factor) => resolveSakuraLatentTierId(factor.id)),
    ));
    return {
        changedFactors,
        changedTierIds,
        focusCount: changedFactors.length,
    };
};

export const resolveSakuraLatentPerturbationScale = ({
    roundIndex = 0,
    pairType = V2_LATENT_PAIR_TYPE.ISOLATION,
} = {}) => {
    const safeRound = Math.max(0, Math.floor(Number(roundIndex) || 0));
    const decayRounds = Math.max(0, safeRound - PERTURBATION_DECAY_START_ROUND);
    const rawScale = 1 / Math.sqrt(1 + (decayRounds / PERTURBATION_DECAY_HORIZON));
    const floorByPairType = {
        [V2_LATENT_PAIR_TYPE.ISOLATION]: 0.28,
        [V2_LATENT_PAIR_TYPE.MIXED]: 0.4,
        [V2_LATENT_PAIR_TYPE.DIVERSITY]: 0.55,
    };
    return clamp(
        rawScale,
        floorByPairType[pairType] || floorByPairType[V2_LATENT_PAIR_TYPE.ISOLATION],
        1,
    );
};

const V2_LATENT_PAIR_WEIGHTS = {
    [V2_LATENT_PAIR_TYPE.ISOLATION]: 0.3,
    [V2_LATENT_PAIR_TYPE.MIXED]: 0.42,
    [V2_LATENT_PAIR_TYPE.DIVERSITY]: 0.28,
};

const pickSubset = (items = [], count = 0, rng = Math.random) => {
    const out = [...items];
    for (let index = out.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(rng() * (index + 1));
        [out[index], out[swapIndex]] = [out[swapIndex], out[index]];
    }
    return out.slice(0, Math.max(0, Math.min(count, out.length)));
};

const normalizeUniqueList = (values = []) => Array.from(new Set(
    (Array.isArray(values) ? values : [])
        .filter((value) => typeof value === 'string' && value.trim())
        .map((value) => value.trim()),
));

const clampLatentByDef = (key, value, learningKeyspaceProfile = null) => {
    const def = resolveSakuraLearningLatentDef(key, {
        profile: learningKeyspaceProfile,
    });
    if (!def) {
        return value;
    }
    const clamped = Math.min(def.max, Math.max(def.min, Number(value)));
    return def.integer ? Math.round(clamped) : clamped;
};

const latentDistance = (
    latentA = {},
    latentB = {},
    learningLatentKeys = [],
    learningKeyspaceProfile = null,
) => {
    if (!learningLatentKeys.length) {
        return 0;
    }
    const mse = learningLatentKeys.reduce((acc, key) => {
        const def = resolveSakuraLearningLatentDef(key, {
            profile: learningKeyspaceProfile,
        });
        if (!def) {
            return acc;
        }
        const span = Math.max(1e-6, def.max - def.min);
        const diff = (Number(latentA?.[key]) - Number(latentB?.[key])) / span;
        return acc + (diff * diff);
    }, 0) / learningLatentKeys.length;
    return Math.sqrt(mse);
};

const resolvePairComparabilityTarget = (pairType = V2_LATENT_PAIR_TYPE.ISOLATION, tierCount = 1) => {
    if (pairType === V2_LATENT_PAIR_TYPE.ISOLATION) {
        return 0.94;
    }
    if (pairType === V2_LATENT_PAIR_TYPE.MIXED) {
        return tierCount <= 1 ? 0.82 : 0.72;
    }
    return tierCount <= 2 ? 0.58 : 0.46;
};

const buildTierKeyMap = ({
    learningLatentKeys = [],
    availableFocusKeys = null,
} = {}) => {
    const allowedKeys = Array.isArray(availableFocusKeys)
        ? availableFocusKeys.filter((key) => learningLatentKeys.includes(key))
        : learningLatentKeys;
    return normalizeUniqueList(allowedKeys).reduce((acc, key) => {
        const tierId = resolveSakuraLatentTierId(key);
        if (!acc[tierId]) {
            acc[tierId] = [];
        }
        acc[tierId].push(key);
        return acc;
    }, {});
};

const resolveTierPriority = ({
    tierKeyMap = {},
    diversityGuidance = null,
    roundIndex = 0,
} = {}) => {
    const activeTierIds = Object.keys(tierKeyMap).filter((tierId) => tierKeyMap[tierId]?.length);
    if (!activeTierIds.length) {
        return [];
    }
    const preferredTierIds = normalizeUniqueList(
        diversityGuidance?.underexploredTierIds,
    ).filter((tierId) => activeTierIds.includes(tierId));
    const orderedTierIds = [
        ...preferredTierIds,
        ...activeTierIds.filter((tierId) => !preferredTierIds.includes(tierId)),
    ];
    if (orderedTierIds.length <= 1) {
        return orderedTierIds;
    }
    const offset = ((Math.floor(Number(roundIndex) || 0) % orderedTierIds.length) + orderedTierIds.length)
        % orderedTierIds.length;
    return [
        ...orderedTierIds.slice(offset),
        ...orderedTierIds.slice(0, offset),
    ];
};

const pickTierFocusedKeys = ({
    learningLatentKeys = [],
    availableFocusKeys = null,
    diversityGuidance = null,
    roundIndex = 0,
    primaryCount = 1,
    secondaryCount = 0,
    rng = Math.random,
} = {}) => {
    const randomFn = typeof rng === 'function' ? rng : Math.random;
    const tierKeyMap = buildTierKeyMap({
        learningLatentKeys,
        availableFocusKeys,
    });
    const tierPriority = resolveTierPriority({
        tierKeyMap,
        diversityGuidance,
        roundIndex,
    });
    const selectedKeys = [];
    if (tierPriority.length) {
        selectedKeys.push(...pickSubset(
            tierKeyMap[tierPriority[0]] || [],
            primaryCount,
            randomFn,
        ));
    }
    if (secondaryCount > 0 && tierPriority.length > 1) {
        selectedKeys.push(...pickSubset(
            tierKeyMap[tierPriority[1]] || [],
            secondaryCount,
            randomFn,
        ));
    }
    if (selectedKeys.length < (primaryCount + secondaryCount)) {
        const fallbackPool = normalizeUniqueList(
            learningLatentKeys.filter((key) => !selectedKeys.includes(key)),
        );
        selectedKeys.push(...pickSubset(
            fallbackPool,
            (primaryCount + secondaryCount) - selectedKeys.length,
            randomFn,
        ));
    }
    return normalizeUniqueList(selectedKeys);
};

const summarizeFocusTierIds = (focusKeys = []) => normalizeUniqueList(
    focusKeys.map((key) => resolveSakuraLatentTierId(key)),
);

const buildLatentPairByKeys = ({
    baseLatent = {},
    focusKeys = [],
    intensity = 0.2,
    pairType = V2_LATENT_PAIR_TYPE.ISOLATION,
    presetId = 'v2_latent_pair',
    presetLabel = 'V2 Latent',
    sharedSeedPolicy = 'shared',
    perturbationScale = 1,
    targetPairGapNorm = null,
    targetPairCenterNorm = null,
    preferenceLearning = null,
    rng = Math.random,
    learningLatentKeys = [],
    learningKeyspaceProfile = null,
}) => {
    const randomFn = typeof rng === 'function' ? rng : Math.random;
    const base = applySakuraPreferenceBasinFixedFactorValues(
        clampSakuraLatentByLearningRange(baseLatent, {
            profile: learningKeyspaceProfile,
        }),
        { profile: learningKeyspaceProfile },
    );
    const safeIntensity = clamp01(Number.isFinite(intensity) ? intensity : 0.2);
    const safePerturbationScale = clamp(Number(perturbationScale), 0.2, 1);
    const hasTargetPairGap = targetPairGapNorm !== null
        && targetPairGapNorm !== undefined
        && Number.isFinite(Number(targetPairGapNorm));
    const safeTargetPairGapNorm = hasTargetPairGap
        ? clamp(
            Number(targetPairGapNorm),
            MIN_TARGET_PAIR_GAP_NORM,
            MAX_TARGET_PAIR_GAP_NORM,
        )
        : null;
    const hasTargetPairCenter = targetPairCenterNorm !== null
        && targetPairCenterNorm !== undefined
        && Number.isFinite(Number(targetPairCenterNorm));
    const safeTargetPairCenterNorm = hasTargetPairCenter
        ? clamp01(Number(targetPairCenterNorm))
        : null;

    const latentA = { ...base };
    const latentB = { ...base };
    const changedFactors = [];
    let realizedPairCenterNorm = null;
    let realizedPairGapNorm = null;

    const learningFocusKeys = Array.isArray(focusKeys)
        ? focusKeys.filter((key) => learningLatentKeys.includes(key))
        : [];
    const changedTierIds = summarizeFocusTierIds(learningFocusKeys);

    learningFocusKeys.forEach((key) => {
        const def = resolveSakuraLearningLatentDef(key, {
            profile: learningKeyspaceProfile,
        });
        if (!def) {
            return;
        }
        const span = Math.max(1e-6, def.max - def.min);
        const center = safeTargetPairCenterNorm === null
            ? (Number.isFinite(base[key]) ? Number(base[key]) : def.default)
            : def.min + (span * safeTargetPairCenterNorm);
        const direction = randomFn() > 0.5 ? 1 : -1;
        const deltaScale = safeTargetPairGapNorm === null
            ? 0.95 + (randomFn() * 0.45)
            : 0.94 + (randomFn() * 0.12);
        const pairGap = safeTargetPairGapNorm === null
            ? span
                * (0.18 + safeIntensity * 0.42)
                * deltaScale
                * safePerturbationScale
                * 2
            : span * safeTargetPairGapNorm * deltaScale;
        const halfPairGap = Math.min(span * 0.5, pairGap * 0.5);
        const adjustedCenter = clamp(
            center,
            def.min + halfPairGap,
            def.max - halfPairGap,
        );
        const nextA = clampLatentByDef(
            key,
            adjustedCenter + (halfPairGap * direction),
            learningKeyspaceProfile,
        );
        const nextB = clampLatentByDef(
            key,
            adjustedCenter - (halfPairGap * direction),
            learningKeyspaceProfile,
        );
        latentA[key] = nextA;
        latentB[key] = nextB;
        const normalizedA = (Number(nextA) - def.min) / span;
        const normalizedB = (Number(nextB) - def.min) / span;
        if (realizedPairCenterNorm === null) {
            realizedPairCenterNorm = (normalizedA + normalizedB) / 2;
            realizedPairGapNorm = Math.abs(normalizedA - normalizedB);
        }
        changedFactors.push({
            id: key,
            label: 'Latent',
            a: round(nextA),
            b: round(nextB),
            deltaNorm: round((Number(nextA) - Number(nextB)) / span),
        });
    });

    return {
        latentA: clampSakuraLatentByLearningRange(latentA, {
            profile: learningKeyspaceProfile,
        }),
        latentB: clampSakuraLatentByLearningRange(latentB, {
            profile: learningKeyspaceProfile,
        }),
        context: {
            mode: 'learn_mode',
            presetId,
            presetLabel,
            pairType,
            sharedSeedPolicy,
            latentSpace: 'canonical_v2',
            learningKeyspaceProfile,
            focusCount: learningFocusKeys.length,
            changedTierIds,
            intensity: round(safeIntensity, 3),
            perturbationScale: round(safePerturbationScale, 4),
            ...(safeTargetPairGapNorm === null ? {} : {
                targetPairGapNorm: round(safeTargetPairGapNorm, 4),
            }),
            ...(safeTargetPairCenterNorm === null ? {} : {
                targetPairCenterNorm: round(safeTargetPairCenterNorm, 4),
            }),
            ...(realizedPairCenterNorm === null ? {} : {
                realizedPairCenterNorm: round(realizedPairCenterNorm, 4),
            }),
            ...(realizedPairGapNorm === null ? {} : {
                realizedPairGapNorm: round(realizedPairGapNorm, 4),
            }),
            ...(preferenceLearning && typeof preferenceLearning === 'object' ? {
                preferenceLearning: { ...preferenceLearning },
            } : {}),
            comparabilityTarget: round(resolvePairComparabilityTarget(pairType, changedTierIds.length), 3),
            changedFactors,
            lockedFactors: learningLatentKeys.filter((key) => !learningFocusKeys.includes(key)),
        },
    };
};

export const buildIsolationLatentPair = ({
    baseLatent = {},
    intensity = 0.2,
    focusKey = null,
    availableFocusKeys = null,
    diversityGuidance = null,
    roundIndex = 0,
    targetPairGapNorm = null,
    targetPairCenterNorm = null,
    preferenceLearning = null,
    rng = Math.random,
    learningKeyspaceProfile = null,
} = {}) => {
    const randomFn = typeof rng === 'function' ? rng : Math.random;
    const keySpace = resolveLearningKeySpace(learningKeyspaceProfile);
    const { learningLatentKeys } = keySpace;
    const requestedFocusKey = focusKey === null || focusKey === undefined
        ? null
        : (typeof focusKey === 'string' ? focusKey.trim() : '');
    if (focusKey !== null && focusKey !== undefined && (
        !requestedFocusKey
        || !learningLatentKeys.includes(requestedFocusKey)
    )) {
        failLatentPairContract(
            'ZEN_SAKURA_ISOLATION_FOCUS_FACTOR_NOT_ACTIVE',
            String(focusKey),
        );
    }
    const safeFocusPool = Array.isArray(availableFocusKeys)
        ? availableFocusKeys.filter((key) => learningLatentKeys.includes(key))
        : learningLatentKeys;
    const focusPool = safeFocusPool.length ? safeFocusPool : learningLatentKeys;
    if (requestedFocusKey && !focusPool.includes(requestedFocusKey)) {
        failLatentPairContract(
            'ZEN_SAKURA_ISOLATION_FOCUS_FACTOR_NOT_AVAILABLE',
            requestedFocusKey,
        );
    }
    const targetKey = (
        requestedFocusKey
        && focusPool.includes(requestedFocusKey)
    )
        ? requestedFocusKey
        : (
            pickTierFocusedKeys({
                learningLatentKeys: focusPool,
                diversityGuidance,
                roundIndex,
                primaryCount: 1,
                secondaryCount: 0,
                rng: randomFn,
            })[0]
            || focusPool[Math.floor(randomFn() * focusPool.length)]
        );

    return buildLatentPairByKeys({
        baseLatent,
        focusKeys: targetKey ? [targetKey] : [],
        intensity,
        pairType: V2_LATENT_PAIR_TYPE.ISOLATION,
        presetId: 'v2_isolation_single_factor',
        presetLabel: 'V2 Isolation',
        sharedSeedPolicy: 'shared',
        perturbationScale: resolveSakuraLatentPerturbationScale({
            roundIndex,
            pairType: V2_LATENT_PAIR_TYPE.ISOLATION,
        }),
        targetPairGapNorm,
        targetPairCenterNorm,
        preferenceLearning,
        rng: randomFn,
        learningLatentKeys,
        learningKeyspaceProfile: keySpace.profile,
    });
};

export const buildMixedLatentPair = ({
    baseLatent = {},
    intensity = 0.24,
    availableFocusKeys = null,
    diversityGuidance = null,
    roundIndex = 0,
    rng = Math.random,
    learningKeyspaceProfile = null,
} = {}) => {
    const randomFn = typeof rng === 'function' ? rng : Math.random;
    const keySpace = resolveLearningKeySpace(learningKeyspaceProfile);
    const focusCount = clampInt(2 + (randomFn() * 2), 2, 3);
    const focusKeys = pickTierFocusedKeys({
        learningLatentKeys: keySpace.learningLatentKeys,
        availableFocusKeys,
        diversityGuidance,
        roundIndex,
        primaryCount: Math.max(1, focusCount - 1),
        secondaryCount: 1,
        rng: randomFn,
    });
    return buildLatentPairByKeys({
        baseLatent,
        focusKeys,
        intensity,
        pairType: V2_LATENT_PAIR_TYPE.MIXED,
        presetId: 'v2_mixed_pair',
        presetLabel: 'V2 Mixed',
        sharedSeedPolicy: 'shared',
        perturbationScale: resolveSakuraLatentPerturbationScale({
            roundIndex,
            pairType: V2_LATENT_PAIR_TYPE.MIXED,
        }),
        rng: randomFn,
        learningLatentKeys: keySpace.learningLatentKeys,
        learningKeyspaceProfile: keySpace.profile,
    });
};

export const buildDiversityLatentPair = ({
    baseLatent = {},
    intensity = 0.58,
    availableFocusKeys = null,
    diversityGuidance = null,
    roundIndex = 0,
    rng = Math.random,
    learningKeyspaceProfile = null,
} = {}) => {
    const randomFn = typeof rng === 'function' ? rng : Math.random;
    const base = applySakuraPreferenceBasinFixedFactorValues(
        clampSakuraLatentByLearningRange(baseLatent, {
            profile: learningKeyspaceProfile,
        }),
        { profile: learningKeyspaceProfile },
    );
    const keySpace = resolveLearningKeySpace(learningKeyspaceProfile);

    let bestPair = null;
    let bestDistance = Number.NEGATIVE_INFINITY;
    const attemptCount = 5;
    for (let attempt = 0; attempt < attemptCount; attempt += 1) {
        const focusCount = clampInt(4 + (randomFn() * 2), 4, 6);
        const focusKeys = pickTierFocusedKeys({
            learningLatentKeys: keySpace.learningLatentKeys,
            availableFocusKeys,
            diversityGuidance,
            roundIndex: roundIndex + attempt,
            primaryCount: Math.max(3, focusCount - 2),
            secondaryCount: Math.min(2, focusCount - Math.max(3, focusCount - 2)),
            rng: randomFn,
        });
        const pair = buildLatentPairByKeys({
            baseLatent: base,
            focusKeys,
            intensity: clamp01(intensity * (0.95 + (randomFn() * 0.18))),
            pairType: V2_LATENT_PAIR_TYPE.DIVERSITY,
            presetId: 'v2_diversity_pair',
            presetLabel: 'V2 Diversity',
            sharedSeedPolicy: 'shared',
            perturbationScale: resolveSakuraLatentPerturbationScale({
                roundIndex,
                pairType: V2_LATENT_PAIR_TYPE.DIVERSITY,
            }),
            rng: randomFn,
            learningLatentKeys: keySpace.learningLatentKeys,
            learningKeyspaceProfile: keySpace.profile,
        });
        const distance = latentDistance(
            pair.latentA,
            pair.latentB,
            keySpace.learningLatentKeys,
            keySpace.profile,
        );
        if (distance > bestDistance) {
            bestDistance = distance;
            bestPair = pair;
        }
    }

    return {
        latentA: bestPair?.latentA || base,
        latentB: bestPair?.latentB || base,
        context: {
            ...(bestPair?.context || {}),
            distance: round(bestDistance, 4),
        },
    };
};

const pickV2PairType = ({
    rng = Math.random,
    qualityProfile = null,
    diversityGuidance = null,
} = {}) => {
    const roll = clamp01(Number(typeof rng === 'function' ? rng() : rng));
    const pressure = clamp01(Number(qualityProfile?.pressure ?? 0));
    const weights = {
        [V2_LATENT_PAIR_TYPE.ISOLATION]:
            V2_LATENT_PAIR_WEIGHTS[V2_LATENT_PAIR_TYPE.ISOLATION] + pressure * 0.24,
        [V2_LATENT_PAIR_TYPE.MIXED]:
            V2_LATENT_PAIR_WEIGHTS[V2_LATENT_PAIR_TYPE.MIXED] + (0.08 - pressure * 0.04),
        [V2_LATENT_PAIR_TYPE.DIVERSITY]:
            V2_LATENT_PAIR_WEIGHTS[V2_LATENT_PAIR_TYPE.DIVERSITY] + ((1 - pressure) * 0.12),
    };
    [
        V2_LATENT_PAIR_TYPE.ISOLATION,
        V2_LATENT_PAIR_TYPE.MIXED,
        V2_LATENT_PAIR_TYPE.DIVERSITY,
    ].forEach((pairType) => {
        weights[pairType] += clamp01(Number(diversityGuidance?.pairTypeNeedById?.[pairType] || 0)) * 0.14;
        weights[pairType] = Math.max(0.05, weights[pairType]);
    });
    const total = Object.values(weights).reduce((acc, value) => acc + value, 0);
    const isolationCutoff = weights[V2_LATENT_PAIR_TYPE.ISOLATION] / total;
    const mixedCutoff = isolationCutoff + (weights[V2_LATENT_PAIR_TYPE.MIXED] / total);
    if (roll < isolationCutoff) {
        return V2_LATENT_PAIR_TYPE.ISOLATION;
    }
    if (roll < mixedCutoff) {
        return V2_LATENT_PAIR_TYPE.MIXED;
    }
    return V2_LATENT_PAIR_TYPE.DIVERSITY;
};

const resolveForcedPairType = (value) => (
    value === V2_LATENT_PAIR_TYPE.ISOLATION
    || value === V2_LATENT_PAIR_TYPE.MIXED
    || value === V2_LATENT_PAIR_TYPE.DIVERSITY
)
    ? value
    : null;

export const buildV2LearningLatentPair = ({
    baseLatent = {},
    intensity = 0.2,
    roundIndex = 0,
    rng = Math.random,
    forcePairType = null,
    focusKey = null,
    targetPairGapNorm = null,
    targetPairCenterNorm = null,
    preferenceLearning = null,
    availableFocusKeys = null,
    qualityProfile = null,
    diversityGuidance = null,
    learningKeyspaceProfile = null,
} = {}) => {
    const randomFn = typeof rng === 'function' ? rng : Math.random;
    const resolvedProfile = resolveSakuraLearningLatentProfile(learningKeyspaceProfile);
    const pairType = resolveForcedPairType(forcePairType) || pickV2PairType({
        rng: randomFn,
        qualityProfile,
        diversityGuidance,
    });

    if (pairType === V2_LATENT_PAIR_TYPE.MIXED) {
        return {
            strategy: 'discover',
            sharedSeed: true,
            roundIndex,
            pairType,
            latentPair: buildMixedLatentPair({
                baseLatent,
                intensity: clamp01(intensity * (1.05 + (randomFn() * 0.2))),
                availableFocusKeys,
                diversityGuidance,
                roundIndex,
                rng: randomFn,
                learningKeyspaceProfile: resolvedProfile,
            }),
        };
    }
    if (pairType === V2_LATENT_PAIR_TYPE.DIVERSITY) {
        return {
            strategy: 'discover',
            sharedSeed: true,
            roundIndex,
            pairType,
            latentPair: buildDiversityLatentPair({
                baseLatent,
                intensity: clamp01(Math.max(0.5, intensity * 1.55)),
                availableFocusKeys,
                diversityGuidance,
                roundIndex,
                rng: randomFn,
                learningKeyspaceProfile: resolvedProfile,
            }),
        };
    }

    return {
        strategy: 'isolate',
        sharedSeed: true,
        roundIndex,
        pairType,
        latentPair: buildIsolationLatentPair({
            baseLatent,
            intensity,
            focusKey,
            targetPairGapNorm,
            targetPairCenterNorm,
            preferenceLearning,
            availableFocusKeys,
            diversityGuidance,
            roundIndex,
            rng: randomFn,
            learningKeyspaceProfile: resolvedProfile,
        }),
    };
};
