import {
    clampSakuraLatentByLearningRange,
    listSakuraLearningLatentKeys,
    resolveSakuraLearningLatentDef,
    resolveSakuraLearningLatentProfile,
} from './SakuraLatentParamApi';
import {
    createRandomSakuraLatent,
} from './SakuraLatentSchema';
import {
    createSakuraColdStartPlanningError,
} from './SakuraSobolColdStartCache';

const clamp01 = (value) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
const clampInt = (value, min, max) => Math.min(max, Math.max(min, Math.floor(value)));
const round = (value, digits = 4) => Number((Number.isFinite(value) ? value : 0).toFixed(digits));
const UINT32_MAX = 0xffffffff;

const resolveLearningLatentKeys = (learningKeyspaceProfile = null) => {
    const profile = resolveSakuraLearningLatentProfile(learningKeyspaceProfile);
    return {
        profile,
        learningLatentKeys: listSakuraLearningLatentKeys({ profile }),
    };
};

const reverseBits32 = (value) => {
    let x = value >>> 0;
    x = ((x >>> 1) & 0x55555555) | ((x & 0x55555555) << 1);
    x = ((x >>> 2) & 0x33333333) | ((x & 0x33333333) << 2);
    x = ((x >>> 4) & 0x0f0f0f0f) | ((x & 0x0f0f0f0f) << 4);
    x = ((x >>> 8) & 0x00ff00ff) | ((x & 0x00ff00ff) << 8);
    x = (x >>> 16) | (x << 16);
    return x >>> 0;
};

const hash32 = (seed = 0, dim = 0, index = 0) => {
    let x = (Number(seed) >>> 0) ^ 0x9e3779b9;
    x = (x + ((dim + 1) * 0x85ebca6b)) >>> 0;
    x = (x + ((index + 1) * 0xc2b2ae35)) >>> 0;
    x ^= x >>> 16;
    x = Math.imul(x, 0x7feb352d) >>> 0;
    x ^= x >>> 15;
    x = Math.imul(x, 0x846ca68b) >>> 0;
    x ^= x >>> 16;
    return x >>> 0;
};

// We use a Sobol-style base-2 digital net with axis-wise Owen-like scrambling.
// This preserves deterministic low-discrepancy behavior without external deps.
const sobolLike01 = (index = 0, dim = 0, seed = 0) => {
    const n = (Math.max(0, index) + 1) >>> 0;
    const gray = (n ^ (n >>> 1)) >>> 0;
    const scramble = hash32(seed, dim, 0);
    const mixed = (gray ^ scramble ^ hash32(seed, dim, n & 1023)) >>> 0;
    return reverseBits32(mixed) / (UINT32_MAX + 1);
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
        const span = Math.max(1e-6, Number(def.max) - Number(def.min));
        const diff = (Number(latentA?.[key]) - Number(latentB?.[key])) / span;
        return acc + (diff * diff);
    }, 0) / learningLatentKeys.length;
    return Math.sqrt(mse);
};

const serializeLatent = (latent = {}, learningLatentKeys = []) => (
    learningLatentKeys
        .map((key) => `${key}:${round(Number(latent?.[key]), 6)}`)
        .join('|')
);

export const buildSakuraSobolColdStartPairSignature = ({
    latentA = null,
    latentB = null,
    learningKeyspaceProfile = null,
} = {}) => {
    const { profile, learningLatentKeys } = resolveLearningLatentKeys(learningKeyspaceProfile);
    if (!latentA || !latentB || !learningLatentKeys.length) {
        return null;
    }
    const left = serializeLatent(latentA, learningLatentKeys);
    const right = serializeLatent(latentB, learningLatentKeys);
    if (!left || !right) {
        return null;
    }
    return [
        'sobol_cold_start_pair:v1',
        `profile:${profile}`,
        ...[left, right].sort(),
    ].join('#');
};

export const collectSakuraSobolColdStartPairSignatures = (
    abHistory = [],
    {
        learningKeyspaceProfile = null,
        windowSize = 96,
    } = {},
) => {
    const history = Array.isArray(abHistory)
        ? abHistory.slice(0, Math.max(1, Math.floor(Number(windowSize) || 96)))
        : [];
    const signatures = new Set();
    history.forEach((entry) => {
        const context = entry?.generationContext || {};
        const isColdStart = Boolean(context?.coldStart)
            || String(context?.pairType || '').trim().toLowerCase() === 'sobol_cold_start';
        if (!isColdStart) {
            return;
        }
        const explicit = typeof context?.coldStartPairSignature === 'string'
            ? context.coldStartPairSignature.trim()
            : '';
        if (explicit) {
            signatures.add(explicit);
            return;
        }
        const signature = buildSakuraSobolColdStartPairSignature({
            latentA: entry?.A?.latent,
            latentB: entry?.B?.latent,
            learningKeyspaceProfile,
        });
        if (signature) {
            signatures.add(signature);
        }
    });
    return signatures;
};

const denormalizeLearningLatent = (
    unit = [],
    learningLatentKeys = [],
    anchorLatent = null,
    learningKeyspaceProfile = null,
) => {
    const anchor = clampSakuraLatentByLearningRange(
        anchorLatent || createRandomSakuraLatent(),
        { profile: learningKeyspaceProfile },
    );
    const next = { ...anchor };
    learningLatentKeys.forEach((key, index) => {
        const def = resolveSakuraLearningLatentDef(key, {
            profile: learningKeyspaceProfile,
        });
        if (!def) {
            return;
        }
        const normalized = clamp01(Number(unit[index] || 0));
        const raw = Number(def.min) + ((Number(def.max) - Number(def.min)) * normalized);
        next[key] = def.integer ? Math.round(raw) : Number(raw);
    });
    return clampSakuraLatentByLearningRange(next, {
        profile: learningKeyspaceProfile,
    });
};

const buildChangedFactors = (
    latentA = {},
    latentB = {},
    learningLatentKeys = [],
    learningKeyspaceProfile = null,
    maxCount = 8,
) => {
    const entries = learningLatentKeys.map((key) => {
        const def = resolveSakuraLearningLatentDef(key, {
            profile: learningKeyspaceProfile,
        });
        if (!def) {
            return null;
        }
        const span = Math.max(1e-6, Number(def.max) - Number(def.min));
        const a = Number(latentA?.[key]);
        const b = Number(latentB?.[key]);
        if (!Number.isFinite(a) || !Number.isFinite(b)) {
            return null;
        }
        const deltaNorm = Math.abs((a - b) / span);
        return {
            id: key,
            label: 'Sobol',
            a: round(a),
            b: round(b),
            deltaNorm: round(deltaNorm),
        };
    }).filter(Boolean);

    return entries
        .sort((left, right) => Number(right.deltaNorm || 0) - Number(left.deltaNorm || 0))
        .slice(0, Math.max(1, maxCount));
};

export const buildSakuraSobolColdStartPool = ({
    sourceCount = 128,
    survivorCount = 64,
    seed = Date.now(),
    anchorLatent = null,
    evaluateLatent = null,
    learningKeyspaceProfile = null,
} = {}) => {
    const { learningLatentKeys } = resolveLearningLatentKeys(learningKeyspaceProfile);
    if (!learningLatentKeys.length) {
        return [];
    }
    const safeSourceCount = clampInt(sourceCount, 8, 512);
    const safeSurvivorCount = clampInt(
        survivorCount,
        2,
        Math.min(256, safeSourceCount),
    );
    const canEvaluate = typeof evaluateLatent === 'function';
    const seen = new Set();
    const survivors = [];
    const fallbackAnchor = clampSakuraLatentByLearningRange(
        anchorLatent || createRandomSakuraLatent(),
        { profile: learningKeyspaceProfile },
    );

    for (let index = 0; index < safeSourceCount; index += 1) {
        const unit = learningLatentKeys.map((_, dim) => sobolLike01(index, dim, seed));
        const latent = denormalizeLearningLatent(
            unit,
            learningLatentKeys,
            fallbackAnchor,
            learningKeyspaceProfile,
        );
        const signature = serializeLatent(latent, learningLatentKeys);
        if (seen.has(signature)) {
            continue;
        }
        seen.add(signature);
        if (!canEvaluate || evaluateLatent(latent, index)) {
            survivors.push(latent);
        }
        if (survivors.length >= safeSurvivorCount) {
            break;
        }
    }

    if (survivors.length < safeSurvivorCount) {
        throw createSakuraColdStartPlanningError(
            'ZEN_SAKURA_COLD_START_POOL_INSUFFICIENT',
            'Sobol cold-start generation produced fewer feasible survivors than required.',
            {
                sourceCount: safeSourceCount,
                survivorCount: safeSurvivorCount,
                actualCount: survivors.length,
                learningKeyspaceProfile,
                feasibilityFiltered: canEvaluate,
            },
        );
    }

    return survivors.slice(0, safeSurvivorCount);
};

export const pickSakuraSobolColdStartPair = ({
    pool = [],
    cursor = 0,
    learningKeyspaceProfile = null,
    usedPairSignatures = null,
} = {}) => {
    const { profile, learningLatentKeys } = resolveLearningLatentKeys(learningKeyspaceProfile);
    const safePool = Array.isArray(pool)
        ? pool.filter((entry) => entry && typeof entry === 'object')
        : [];
    if (safePool.length < 2) {
        return null;
    }
    const usedSignatures = usedPairSignatures instanceof Set
        ? usedPairSignatures
        : new Set(Array.isArray(usedPairSignatures) ? usedPairSignatures.filter(Boolean) : []);
    const size = safePool.length;
    const baseIndexA = ((Math.floor(cursor) % size) + size) % size;
    const partnerRankOffset = Math.max(0, Math.floor(cursor / Math.max(1, size)));
    let fallbackSelection = null;
    let selected = null;

    for (let offset = 0; offset < size && !selected; offset += 1) {
        const indexA = (baseIndexA + offset) % size;
        const latentA = safePool[indexA];
        const rankedPartners = [];
        for (let index = 0; index < size; index += 1) {
            if (index === indexA) {
                continue;
            }
            const partnerLatent = safePool[index];
            const pairSignature = buildSakuraSobolColdStartPairSignature({
                latentA,
                latentB: partnerLatent,
                learningKeyspaceProfile: profile,
            });
            rankedPartners.push({
                index,
                pairSignature,
                distance: latentDistance(
                    latentA,
                    partnerLatent,
                    learningLatentKeys,
                    profile,
                ),
            });
        }
        rankedPartners.sort((left, right) => right.distance - left.distance);
        if (!rankedPartners.length) {
            continue;
        }
        const preferredPartnerIndex = partnerRankOffset % rankedPartners.length;
        const preferredPartner = rankedPartners[preferredPartnerIndex] || rankedPartners[0];
        if (!fallbackSelection) {
            fallbackSelection = {
                indexA,
                latentA,
                selectedPartner: preferredPartner,
                coldStartPartnerRank: preferredPartnerIndex + 1,
                repeatAvoidanceExhausted: true,
            };
        }
        for (let rankOffset = 0; rankOffset < rankedPartners.length; rankOffset += 1) {
            const partnerIndex = (preferredPartnerIndex + rankOffset) % rankedPartners.length;
            const partner = rankedPartners[partnerIndex];
            if (partner?.pairSignature && usedSignatures.has(partner.pairSignature)) {
                continue;
            }
            selected = {
                indexA,
                latentA,
                selectedPartner: partner,
                coldStartPartnerRank: partnerIndex + 1,
                repeatAvoidanceExhausted: false,
            };
            break;
        }
    }

    const resolvedSelection = selected || fallbackSelection;
    if (!resolvedSelection?.selectedPartner) {
        return null;
    }
    const {
        indexA,
        latentA,
        selectedPartner,
        coldStartPartnerRank,
        repeatAvoidanceExhausted,
    } = resolvedSelection;
    const indexB = selectedPartner?.index ?? ((indexA + 1) % size);
    const latentB = safePool[indexB];
    const changedFactors = buildChangedFactors(
        latentA,
        latentB,
        learningLatentKeys,
        profile,
        8,
    );
    return {
        latentA,
        latentB,
        context: {
            mode: 'learn_mode',
            presetId: 'v2_sobol_cold_start',
            presetLabel: 'V2 Sobol Cold Start',
            pairType: 'sobol_cold_start',
            latentSpace: 'canonical_v2',
            learningKeyspaceProfile: profile,
            sharedSeedPolicy: 'independent',
            coldStart: true,
            focusCount: changedFactors.length,
            intensity: 1,
            distance: round(Math.max(0, selectedPartner?.distance ?? 0), 4),
            coldStartPartnerRank,
            coldStartPairSignature: selectedPartner?.pairSignature || null,
            coldStartRepeatAvoidance: {
                usedCount: usedSignatures.size,
                exhausted: Boolean(repeatAvoidanceExhausted && usedSignatures.size > 0),
            },
            changedFactors,
            lockedFactors: [],
        },
    };
};
