import {
    DEFAULT_SAKURA_LEARNING_KEYSPACE_PROFILE,
    SAKURA_LEARNING_KEYSPACE_PROFILE,
} from './v2/SakuraLatentParamApi';
import { BUILD_INCLUDE_ZEN_EXPERIMENTAL_WORKERS } from '../../../../platform/build/releaseCapabilities.js';
import { computeSakuraReliabilityMetrics } from './SakuraReliabilityMetrics';
import { evaluateSakuraReliabilityPolicy } from './SakuraReliabilityPolicy';
import { WORKER_RUNTIME_FLAG_KEY } from '../../../../platform/workers/runtime/config.js';
import {
    zenDevelopmentWorkspaceState,
} from '@zen-development-workspace-state-entry';

export const SAKURA_V2_RUNTIME_FLAGS_VERSION = 1;
// Cold-start stays lab-only: callers must pass the explicit lab runtime gate
// before this flag can start any worker or planning job.
const SAKURA_V2_CLASSIC_COLD_START_ENABLED = true;

export const SAKURA_V2_MODE = {
    LEARN: 'learn_mode',
    OPTIMIZE: 'optimize_mode',
};

export const WORKER_FALLBACK_POLICY = {
    STRICT: 'strict',
};
const SAKURA_V2_MODE_VALUES = new Set(Object.values(SAKURA_V2_MODE));
const WORKER_FALLBACK_POLICY_VALUES = new Set(Object.values(WORKER_FALLBACK_POLICY));
const LEARNING_KEYSPACE_PROFILE_VALUES = new Set([
    SAKURA_LEARNING_KEYSPACE_PROFILE.PREFERENCE_BASIN_V2,
]);
const SAKURA_V2_RUNTIME_FLAG_KEYS = Object.freeze([
    'version',
    'enabled',
    'mode',
    'learningKeyspaceProfile',
    'workerFallbackPolicy',
    'coldStartDone',
    'lastColdStartAt',
]);

export const DEFAULT_WORKER_FALLBACK_POLICY = WORKER_FALLBACK_POLICY.STRICT;

export const createSakuraV2RuntimeError = (
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

const createRuntimeFlagsError = (code, message, value, cause = null) => (
    createSakuraV2RuntimeError(
        code,
        message,
        {
            storageKey: zenDevelopmentWorkspaceState?.runtimeFlagsStorageKey || null,
            value,
        },
        cause,
    )
);

const requireRuntimeFlagsObject = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw createRuntimeFlagsError(
            'SAKURA_V2_RUNTIME_FLAGS_INVALID',
            'Stored Sakura V2 runtime flags must be a plain object.',
            value,
        );
    }
    const actualKeys = Object.keys(value).sort();
    const expectedKeys = [...SAKURA_V2_RUNTIME_FLAG_KEYS].sort();
    if (
        actualKeys.length !== expectedKeys.length
        || actualKeys.some((key, index) => key !== expectedKeys[index])
    ) {
        throw createRuntimeFlagsError(
            'SAKURA_V2_RUNTIME_FLAGS_INVALID',
            'Stored Sakura V2 runtime flags must contain exactly the release V1 fields.',
            value,
        );
    }
    return value;
};

const requireRuntimeFlagBoolean = (value, field) => {
    if (value === true || value === false) {
        return value;
    }
    throw createRuntimeFlagsError(
        'SAKURA_V2_RUNTIME_FLAGS_INVALID',
        `Stored Sakura V2 runtime flags.${field} must be a boolean.`,
        value,
    );
};

const requireRuntimeFlagEnum = (value, field, allowedValues) => {
    if (typeof value === 'string' && allowedValues.has(value)) {
        return value;
    }
    throw createRuntimeFlagsError(
        'SAKURA_V2_RUNTIME_FLAGS_INVALID',
        `Stored Sakura V2 runtime flags.${field} must be one of: ${Array.from(allowedValues).join(', ')}.`,
        value,
    );
};

const requireRuntimeFlagVersion = (value) => {
    if (!Number.isSafeInteger(value) || value < 1) {
        throw createRuntimeFlagsError(
            'SAKURA_V2_RUNTIME_FLAGS_VERSION_INVALID',
            'Stored Sakura V2 runtime flags.version must be a positive integer.',
            value,
        );
    }
    return value;
};

const requireRuntimeFlagTimestamp = (value, field) => {
    if (!Number.isSafeInteger(value) || value < 0) {
        throw createRuntimeFlagsError(
            'SAKURA_V2_RUNTIME_FLAGS_INVALID',
            `Stored Sakura V2 runtime flags.${field} must be a non-negative number.`,
            value,
        );
    }
    return value;
};

const readWorkerRuntimeFlag = (key, productionValue = true) => {
    if (!zenDevelopmentWorkspaceState) {
        return Boolean(productionValue);
    }
    return zenDevelopmentWorkspaceState.readBooleanFlag(String(key || ''), {
        fallback: productionValue,
    });
};

export const isWorkerRuntimeEnabled = () => (
    readWorkerRuntimeFlag(WORKER_RUNTIME_FLAG_KEY.ENABLED, true)
);

export const isZenExperimentalWorkerRuntimeEnabled = () => (
    BUILD_INCLUDE_ZEN_EXPERIMENTAL_WORKERS
    && isWorkerRuntimeEnabled()
    && readWorkerRuntimeFlag(WORKER_RUNTIME_FLAG_KEY.ZEN_EXPERIMENTAL_ENABLED, true)
);

export const resolveWorkerFallbackPolicy = (value = null) => {
    if (value === null || value === undefined || value === WORKER_FALLBACK_POLICY.STRICT) {
        return WORKER_FALLBACK_POLICY.STRICT;
    }
    throw createSakuraV2RuntimeError(
        'SAKURA_V2_WORKER_FALLBACK_POLICY_INVALID',
        'Sakura V2 worker fallback policy must be strict.',
        {
            value,
        },
    );
};

export const DEFAULT_SAKURA_V2_FLAGS = {
    version: SAKURA_V2_RUNTIME_FLAGS_VERSION,
    enabled: true,
    mode: SAKURA_V2_MODE.LEARN,
    learningKeyspaceProfile: DEFAULT_SAKURA_LEARNING_KEYSPACE_PROFILE,
    workerFallbackPolicy: DEFAULT_WORKER_FALLBACK_POLICY,
    coldStartDone: false,
    lastColdStartAt: 0,
};

export const resolveSakuraV2ClassicColdStartEnabled = (flags = null) => (
    BUILD_INCLUDE_ZEN_EXPERIMENTAL_WORKERS
    && SAKURA_V2_CLASSIC_COLD_START_ENABLED
    && flags?.enabled !== false
);

const requireCurrentRuntimeFlags = (parsed) => {
    const stored = requireRuntimeFlagsObject(parsed);
    const storedVersion = requireRuntimeFlagVersion(stored.version);
    if (storedVersion !== SAKURA_V2_RUNTIME_FLAGS_VERSION) {
        throw createRuntimeFlagsError(
            'SAKURA_V2_RUNTIME_FLAGS_VERSION_INVALID',
            `Stored Sakura V2 runtime flags.version must equal ${SAKURA_V2_RUNTIME_FLAGS_VERSION}.`,
            stored.version,
        );
    }
    return Object.freeze({
        version: SAKURA_V2_RUNTIME_FLAGS_VERSION,
        enabled: requireRuntimeFlagBoolean(stored.enabled, 'enabled'),
        mode: requireRuntimeFlagEnum(stored.mode, 'mode', SAKURA_V2_MODE_VALUES),
        learningKeyspaceProfile: requireRuntimeFlagEnum(
            stored.learningKeyspaceProfile,
            'learningKeyspaceProfile',
            LEARNING_KEYSPACE_PROFILE_VALUES,
        ),
        workerFallbackPolicy: requireRuntimeFlagEnum(
            stored.workerFallbackPolicy,
            'workerFallbackPolicy',
            WORKER_FALLBACK_POLICY_VALUES,
        ),
        coldStartDone: requireRuntimeFlagBoolean(stored.coldStartDone, 'coldStartDone'),
        lastColdStartAt: requireRuntimeFlagTimestamp(stored.lastColdStartAt, 'lastColdStartAt'),
    });
};

export const readSakuraV2Flags = () => {
    if (!zenDevelopmentWorkspaceState) {
        return { ...DEFAULT_SAKURA_V2_FLAGS };
    }
    const raw = zenDevelopmentWorkspaceState.readItem(
        zenDevelopmentWorkspaceState.runtimeFlagsStorageKey,
        null,
    );
    if (raw === null) {
        return { ...DEFAULT_SAKURA_V2_FLAGS };
    }
    const parsed = zenDevelopmentWorkspaceState.readSakuraRuntimeFlags(null);
    return requireCurrentRuntimeFlags(parsed);
};

export const persistSakuraV2Flags = (flags) => {
    if (!zenDevelopmentWorkspaceState) {
        throw createSakuraV2RuntimeError(
            'SAKURA_V2_DEVELOPMENT_WORKSPACE_NOT_AVAILABLE',
            'Sakura V2 runtime flags are available only in a development build.',
        );
    }
    const normalized = requireCurrentRuntimeFlags(flags);
    zenDevelopmentWorkspaceState.writeSakuraRuntimeFlags(normalized);
};

export const resolveSakuraV2ReliabilityGate = ({
    trainingCount = 0,
    pairwiseTrainingCount = 0,
    neuralMeta = null,
    pairwiseMeta = null,
    abHistory = [],
    factorKeys = [],
    learningKeyspaceProfile = null,
} = {}) => {
    const metrics = computeSakuraReliabilityMetrics({
        trainingCount,
        pairwiseTrainingCount,
        neuralMeta,
        pairwiseMeta,
        abHistory,
        factorKeys,
        learningKeyspaceProfile,
    });
    return evaluateSakuraReliabilityPolicy({
        metrics,
    });
};
