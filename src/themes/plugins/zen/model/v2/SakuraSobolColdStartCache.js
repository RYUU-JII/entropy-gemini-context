import { validateSakuraLatent } from './SakuraLatentSchema';

export const SOBOL_COLD_START_MIN_POOL_SIZE = 2;
export const SOBOL_COLD_START_CACHE_VERSION = 1;
export const SOBOL_COLD_START_CACHE_TTL_MS = 45 * 60 * 1000;
const SOBOL_COLD_START_POOL_MAX_COUNT = 24;
const SOBOL_COLD_START_CACHE_KEYS = Object.freeze([
    'version',
    'learningKeyspaceProfile',
    'seed',
    'generatedAt',
    'pool',
]);

const isObject = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const safeString = (value, fallback = null) => (
    typeof value === 'string' && value.trim()
        ? value.trim()
        : fallback
);
const hasExactKeys = (value, expectedKeys) => {
    if (!isObject(value)) return false;
    const actualKeys = Object.keys(value).sort();
    const canonicalKeys = [...expectedKeys].sort();
    return actualKeys.length === canonicalKeys.length
        && actualKeys.every((key, index) => key === canonicalKeys[index]);
};

export const createSakuraColdStartPlanningError = (
    code,
    message,
    details = null,
    cause = null,
) => {
    const error = new Error(message);
    error.code = code;
    if (details && typeof details === 'object') {
        error.details = details;
    }
    if (cause) {
        error.cause = cause;
    }
    return error;
};

const normalizeColdStartSeed = (value, details = null) => {
    if (value === undefined || value === null) {
        return null;
    }
    if (!Number.isSafeInteger(value) || value < 0) {
        throw createSakuraColdStartPlanningError(
            'ZEN_SAKURA_COLD_START_CACHE_INVALID',
            'Sobol cold-start cache seed must be a non-negative integer when provided.',
            {
                ...(details && typeof details === 'object' ? details : {}),
                value,
            },
        );
    }
    return value;
};

const normalizeColdStartGeneratedAt = (value, details = null) => {
    if (!Number.isSafeInteger(value) || value <= 0) {
        throw createSakuraColdStartPlanningError(
            'ZEN_SAKURA_COLD_START_CACHE_INVALID',
            'Sobol cold-start cache generatedAt must be a positive timestamp.',
            {
                ...(details && typeof details === 'object' ? details : {}),
                value,
            },
        );
    }
    return value;
};

const normalizeColdStartProfile = (value, details = null) => {
    if (value === undefined || value === null) {
        return null;
    }
    if (typeof value !== 'string' || !value.trim()) {
        throw createSakuraColdStartPlanningError(
            'ZEN_SAKURA_COLD_START_CACHE_INVALID',
            'Sobol cold-start cache learningKeyspaceProfile must be a non-empty string when provided.',
            {
                ...(details && typeof details === 'object' ? details : {}),
                value,
            },
        );
    }
    if (value.trim() !== value) {
        throw createSakuraColdStartPlanningError(
            'ZEN_SAKURA_COLD_START_CACHE_INVALID',
            'Sobol cold-start cache learningKeyspaceProfile must already be canonical.',
            {
                ...(details && typeof details === 'object' ? details : {}),
                value,
            },
        );
    }
    return value;
};

export const normalizeSakuraSobolColdStartPool = (
    pool,
    {
        learningKeyspaceProfile = null,
        label = 'Sobol cold-start pool',
        minCount = SOBOL_COLD_START_MIN_POOL_SIZE,
        maxCount = SOBOL_COLD_START_POOL_MAX_COUNT,
    } = {},
) => {
    if (!Array.isArray(pool)) {
        throw createSakuraColdStartPlanningError(
            'ZEN_SAKURA_COLD_START_POOL_INVALID',
            `${label} must be an array.`,
            {
                pool,
            },
        );
    }

    const normalizedPool = pool.map((entry, index) => (
        validateSakuraLatent(entry, {
            code: 'ZEN_SAKURA_COLD_START_POOL_INVALID',
            label: `${label}[${index}]`,
            details: {
                learningKeyspaceProfile,
                index,
            },
        })
    ));
    if (normalizedPool.length < Math.max(1, Math.floor(minCount))) {
        throw createSakuraColdStartPlanningError(
            'ZEN_SAKURA_COLD_START_POOL_INVALID',
            `${label} must contain at least ${Math.max(1, Math.floor(minCount))} latent entries.`,
            {
                poolSize: normalizedPool.length,
                minCount,
                learningKeyspaceProfile,
            },
        );
    }
    return normalizedPool.slice(0, Math.max(1, Math.floor(maxCount)));
};

export const normalizeSakuraSobolColdStartCachePayload = (
    parsed,
    {
        learningKeyspaceProfile = null,
        nowTs = Date.now(),
    } = {},
) => {
    if (!parsed) {
        return null;
    }
    if (!isObject(parsed)) {
        throw createSakuraColdStartPlanningError(
            'ZEN_SAKURA_COLD_START_CACHE_INVALID',
            'Sobol cold-start cache payload must be a plain object.',
            {
                payload: parsed,
            },
        );
    }
    if (parsed.version !== SOBOL_COLD_START_CACHE_VERSION) {
        return null;
    }
    if (!hasExactKeys(parsed, SOBOL_COLD_START_CACHE_KEYS)) {
        throw createSakuraColdStartPlanningError(
            'ZEN_SAKURA_COLD_START_CACHE_INVALID',
            'Sobol cold-start cache payload must contain exactly the release V1 fields.',
            {
                actualKeys: Object.keys(parsed),
                expectedKeys: SOBOL_COLD_START_CACHE_KEYS,
            },
        );
    }

    const requestedProfile = safeString(learningKeyspaceProfile, null);
    const cachedProfile = normalizeColdStartProfile(
        parsed.learningKeyspaceProfile,
        {
            field: 'learningKeyspaceProfile',
        },
    );
    if (cachedProfile !== requestedProfile) {
        return null;
    }

    const generatedAt = normalizeColdStartGeneratedAt(
        parsed.generatedAt,
        {
            field: 'generatedAt',
        },
    );
    if (!Number.isFinite(nowTs)) {
        throw createSakuraColdStartPlanningError(
            'ZEN_SAKURA_COLD_START_CACHE_INVALID',
            'Sobol cold-start cache comparison timestamp must be finite.',
            { nowTs },
        );
    }
    if ((nowTs - generatedAt) > SOBOL_COLD_START_CACHE_TTL_MS) {
        return null;
    }

    return {
        version: SOBOL_COLD_START_CACHE_VERSION,
        learningKeyspaceProfile: cachedProfile,
        seed: normalizeColdStartSeed(parsed.seed, { field: 'seed' }),
        generatedAt,
        pool: normalizeSakuraSobolColdStartPool(parsed.pool, {
            learningKeyspaceProfile,
            label: 'Sobol cold-start cache payload.pool',
        }),
    };
};
