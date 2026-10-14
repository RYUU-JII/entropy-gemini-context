import ZenWorkspaceRepository, {
    ZEN_WORKSPACE_STORAGE_KEYS,
} from '../../../../platform/storage/themes/zen/ZenWorkspaceRepository.js';
import {
    ZEN_CLASSIC_EXPERIMENTAL_POT_STYLE,
    ZEN_CLASSIC_RENDER_MODE,
    ZEN_WORKSPACE_MODE,
    resolveZenClassicExperimentalPotStyle,
    resolveZenClassicRenderMode,
    resolveZenWorkspaceMode,
} from '../../../../platform/storage/themes/zen/ZenWorkspaceStorage.js';
import {
    getDefaultFactorVectorV2,
    getFactorSchemaDefV2,
    VNEXT_FACTOR_KEYS_V2,
} from '../model/vnext/factors/index.js';

export {
    ZEN_CLASSIC_EXPERIMENTAL_POT_STYLE,
    ZEN_CLASSIC_RENDER_MODE,
    ZEN_WORKSPACE_MODE,
    ZEN_WORKSPACE_STORAGE_KEYS,
    resolveZenClassicExperimentalPotStyle,
    resolveZenClassicRenderMode,
    resolveZenWorkspaceMode,
};

export const zenWorkspaceRepository = ZenWorkspaceRepository.getInstance();

export const DEFAULT_ZEN_VNEXT_RELIABILITY_HINT = 0.24;
export const DEFAULT_ZEN_VNEXT_AUTO_COMPARE_MAX_ROUNDS = 16;
export const DEFAULT_ZEN_VNEXT_AUTO_COMPARE_STOP_RELIABILITY = 0.7;
export const DEFAULT_ZEN_VNEXT_ACTIVE_SECTION = 'preview';

export const createZenVNextWorkspaceStateError = (
    code = 'ZEN_VNEXT_WORKSPACE_STATE_INVALID',
    message = 'Zen VNext workspace state is invalid.',
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

const isPlainObject = (value) => (
    Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const readZenVNextRawValue = (key) => zenWorkspaceRepository.readItem(key, null);

const readRequiredZenVNextRawValue = (
    key,
    {
        code,
        label,
    },
) => {
    const raw = readZenVNextRawValue(key);
    if (raw === null || raw === undefined) {
        throw createZenVNextWorkspaceStateError(
            code,
            `${label} is missing from Zen VNext workspace state.`,
            {
                storageKey: key,
            },
        );
    }
    return raw;
};

const requireFiniteZenVNextNumber = (
    value,
    {
        code,
        label,
        storageKey,
        integer = false,
        min = Number.NEGATIVE_INFINITY,
        max = Number.POSITIVE_INFINITY,
    },
) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        throw createZenVNextWorkspaceStateError(
            code,
            `${label} must be a finite number.`,
            {
                storageKey,
                value,
            },
        );
    }
    if (integer && !Number.isInteger(numeric)) {
        throw createZenVNextWorkspaceStateError(
            code,
            `${label} must be an integer.`,
            {
                storageKey,
                value,
            },
        );
    }
    if (numeric < min || numeric > max) {
        throw createZenVNextWorkspaceStateError(
            code,
            `${label} must be between ${min} and ${max}.`,
            {
                storageKey,
                value,
                min,
                max,
            },
        );
    }
    return numeric;
};

const requireZenVNextSeed = (
    value,
    storageKey = ZEN_WORKSPACE_STORAGE_KEYS.VNEXT_SEED,
) => requireFiniteZenVNextNumber(value, {
    code: 'ZEN_VNEXT_WORKSPACE_SEED_INVALID',
    label: 'Zen VNext workspace seed',
    storageKey,
    integer: true,
    min: 0,
});

const requireZenVNextFactors = (
    value,
    storageKey = ZEN_WORKSPACE_STORAGE_KEYS.VNEXT_FACTORS,
) => {
    if (!isPlainObject(value)) {
        throw createZenVNextWorkspaceStateError(
            'ZEN_VNEXT_WORKSPACE_FACTORS_INVALID',
            'Zen VNext workspace factors must be a plain object.',
            {
                storageKey,
                value,
            },
        );
    }

    const unknownKeys = Object.keys(value).filter(
        (key) => !VNEXT_FACTOR_KEYS_V2.includes(key),
    );
    if (unknownKeys.length > 0) {
        throw createZenVNextWorkspaceStateError(
            'ZEN_VNEXT_WORKSPACE_FACTORS_INVALID',
            'Zen VNext workspace factors contain unknown keys.',
            {
                storageKey,
                unknownKeys,
            },
        );
    }

    return VNEXT_FACTOR_KEYS_V2.reduce((acc, key) => {
        if (!Object.prototype.hasOwnProperty.call(value, key)) {
            throw createZenVNextWorkspaceStateError(
                'ZEN_VNEXT_WORKSPACE_FACTORS_INVALID',
                `Zen VNext workspace factors are missing canonical factor '${key}'.`,
                {
                    storageKey,
                    key,
                },
            );
        }

        const factorDef = getFactorSchemaDefV2(key);
        const numeric = requireFiniteZenVNextNumber(value[key], {
            code: 'ZEN_VNEXT_WORKSPACE_FACTORS_INVALID',
            label: `Zen VNext workspace factor '${key}'`,
            storageKey,
            min: factorDef?.min ?? Number.NEGATIVE_INFINITY,
            max: factorDef?.max ?? Number.POSITIVE_INFINITY,
        });
        acc[key] = numeric;
        return acc;
    }, {});
};

const requireZenVNextReliabilityHint = (
    value,
    storageKey = ZEN_WORKSPACE_STORAGE_KEYS.VNEXT_RELIABILITY_HINT,
) => requireFiniteZenVNextNumber(value, {
    code: 'ZEN_VNEXT_WORKSPACE_RELIABILITY_HINT_INVALID',
    label: 'Zen VNext reliability hint',
    storageKey,
    min: 0,
    max: 1,
});

const requireZenVNextAutoCompareMaxRounds = (
    value,
    storageKey = ZEN_WORKSPACE_STORAGE_KEYS.VNEXT_AUTO_COMPARE_MAX_ROUNDS,
) => requireFiniteZenVNextNumber(value, {
    code: 'ZEN_VNEXT_WORKSPACE_AUTO_COMPARE_MAX_ROUNDS_INVALID',
    label: 'Zen VNext auto compare max rounds',
    storageKey,
    integer: true,
    min: 1,
    max: 200,
});

const requireZenVNextAutoCompareStopReliability = (
    value,
    storageKey = ZEN_WORKSPACE_STORAGE_KEYS.VNEXT_AUTO_COMPARE_STOP_RELIABILITY,
) => requireFiniteZenVNextNumber(value, {
    code: 'ZEN_VNEXT_WORKSPACE_AUTO_COMPARE_STOP_RELIABILITY_INVALID',
    label: 'Zen VNext auto compare stop reliability',
    storageKey,
    min: 0,
    max: 1,
});

const requireZenVNextActiveSection = (
    value,
    storageKey = ZEN_WORKSPACE_STORAGE_KEYS.VNEXT_ACTIVE_SECTION,
) => {
    if (typeof value !== 'string') {
        throw createZenVNextWorkspaceStateError(
            'ZEN_VNEXT_WORKSPACE_ACTIVE_SECTION_INVALID',
            'Zen VNext active section must be a string.',
            {
                storageKey,
                value,
            },
        );
    }

    const normalized = value.trim();
    if (!normalized) {
        throw createZenVNextWorkspaceStateError(
            'ZEN_VNEXT_WORKSPACE_ACTIVE_SECTION_INVALID',
            'Zen VNext active section must be a non-empty string.',
            {
                storageKey,
                value,
            },
        );
    }
    return normalized;
};

const readRequiredZenVNextFactors = () => {
    const raw = readRequiredZenVNextRawValue(
        ZEN_WORKSPACE_STORAGE_KEYS.VNEXT_FACTORS,
        {
            code: 'ZEN_VNEXT_WORKSPACE_FACTORS_REQUIRED',
            label: 'Zen VNext workspace factors',
        },
    );
    if (typeof raw !== 'string' || !raw.trim()) {
        throw createZenVNextWorkspaceStateError(
            'ZEN_VNEXT_WORKSPACE_FACTORS_INVALID',
            'Zen VNext workspace factors must be stored as non-empty JSON.',
            {
                storageKey: ZEN_WORKSPACE_STORAGE_KEYS.VNEXT_FACTORS,
                value: raw,
            },
        );
    }
    try {
        return requireZenVNextFactors(JSON.parse(raw));
    } catch (error) {
        if (error?.code) {
            throw error;
        }
        throw createZenVNextWorkspaceStateError(
            'ZEN_VNEXT_WORKSPACE_FACTORS_INVALID',
            'Zen VNext workspace factors contain invalid JSON.',
            {
                storageKey: ZEN_WORKSPACE_STORAGE_KEYS.VNEXT_FACTORS,
                value: raw,
            },
            error,
        );
    }
};

const ZEN_VNEXT_WORKSPACE_REQUIRED_KEYS = Object.freeze([
    ZEN_WORKSPACE_STORAGE_KEYS.VNEXT_SEED,
    ZEN_WORKSPACE_STORAGE_KEYS.VNEXT_FACTORS,
    ZEN_WORKSPACE_STORAGE_KEYS.VNEXT_RELIABILITY_HINT,
    ZEN_WORKSPACE_STORAGE_KEYS.VNEXT_AUTO_COMPARE_MAX_ROUNDS,
    ZEN_WORKSPACE_STORAGE_KEYS.VNEXT_AUTO_COMPARE_STOP_RELIABILITY,
    ZEN_WORKSPACE_STORAGE_KEYS.VNEXT_ACTIVE_SECTION,
]);

const resolveZenVNextWorkspaceKeyPresence = () => (
    ZEN_VNEXT_WORKSPACE_REQUIRED_KEYS.reduce((acc, key) => {
        acc[key] = readZenVNextRawValue(key) !== null;
        return acc;
    }, {})
);

export const hasZenWorkspaceStorage = () => (
    zenWorkspaceRepository.hasStorage()
);

export const readZenWorkspaceStorageItem = (key, fallback = null) => (
    zenWorkspaceRepository.readItem(key, fallback)
);

export const writeZenWorkspaceStorageItem = (key, value) => (
    zenWorkspaceRepository.writeItem(key, value)
);

export const removeZenWorkspaceStorageItem = (key) => (
    zenWorkspaceRepository.removeItem(key)
);

export const readZenWorkspaceString = (key, fallback = '') => (
    zenWorkspaceRepository.readString(key, fallback)
);

export const readZenWorkspaceNumber = (key, fallback = 0) => (
    zenWorkspaceRepository.readNumber(key, fallback)
);

export const readZenWorkspaceBooleanFlag = (key, options = {}) => (
    zenWorkspaceRepository.readBooleanFlag(key, options)
);

export const readZenWorkspaceJson = (key, fallback = null) => (
    zenWorkspaceRepository.readJson(key, fallback)
);

export const writeZenWorkspaceJson = (key, value) => (
    zenWorkspaceRepository.writeJson(key, value)
);

export const readZenWorkspaceMode = (fallback = ZEN_WORKSPACE_MODE.CLASSIC) => (
    zenWorkspaceRepository.readWorkspaceMode(fallback)
);

export const writeZenWorkspaceMode = (mode) => (
    zenWorkspaceRepository.writeWorkspaceMode(mode)
);

export const readZenClassicBackboneDebug = (fallback = false) => (
    zenWorkspaceRepository.readClassicBackboneDebug(fallback)
);

export const writeZenClassicBackboneDebug = (enabled) => (
    zenWorkspaceRepository.writeClassicBackboneDebug(enabled)
);

export const readZenClassicBranchTierDebug = (fallback = false) => (
    zenWorkspaceRepository.readClassicBranchTierDebug(fallback)
);

export const writeZenClassicBranchTierDebug = (enabled) => (
    zenWorkspaceRepository.writeClassicBranchTierDebug(enabled)
);

export const readZenClassicRenderMode = (
    fallback = ZEN_CLASSIC_RENDER_MODE.FULL,
) => (
    zenWorkspaceRepository.readClassicRenderMode(fallback)
);

export const writeZenClassicRenderMode = (mode) => (
    zenWorkspaceRepository.writeClassicRenderMode(mode)
);

export const readZenClassicExperimentalPotStyle = (
    fallback = ZEN_CLASSIC_EXPERIMENTAL_POT_STYLE.SHALLOW_WARM_STONE,
) => (
    zenWorkspaceRepository.readClassicExperimentalPotStyle(fallback)
);

export const writeZenClassicExperimentalPotStyle = (styleId) => (
    zenWorkspaceRepository.writeClassicExperimentalPotStyle(styleId)
);

export const readZenVNextSeed = () => (
    requireZenVNextSeed(
        readRequiredZenVNextRawValue(
            ZEN_WORKSPACE_STORAGE_KEYS.VNEXT_SEED,
            {
                code: 'ZEN_VNEXT_WORKSPACE_SEED_REQUIRED',
                label: 'Zen VNext workspace seed',
            },
        ),
    )
);

export const writeZenVNextSeed = (seed) => (
    zenWorkspaceRepository.writeVNextSeed(requireZenVNextSeed(seed))
);

export const readZenVNextFactors = () => readRequiredZenVNextFactors();

export const writeZenVNextFactors = (factors) => (
    zenWorkspaceRepository.writeVNextFactors(requireZenVNextFactors(factors))
);

export const readZenVNextReliabilityHint = () => (
    requireZenVNextReliabilityHint(
        readRequiredZenVNextRawValue(
            ZEN_WORKSPACE_STORAGE_KEYS.VNEXT_RELIABILITY_HINT,
            {
                code: 'ZEN_VNEXT_WORKSPACE_RELIABILITY_HINT_REQUIRED',
                label: 'Zen VNext reliability hint',
            },
        ),
    )
);

export const writeZenVNextReliabilityHint = (value) => (
    zenWorkspaceRepository.writeVNextReliabilityHint(
        requireZenVNextReliabilityHint(value),
    )
);

export const readZenVNextAutoCompareMaxRounds = () => (
    requireZenVNextAutoCompareMaxRounds(
        readRequiredZenVNextRawValue(
            ZEN_WORKSPACE_STORAGE_KEYS.VNEXT_AUTO_COMPARE_MAX_ROUNDS,
            {
                code: 'ZEN_VNEXT_WORKSPACE_AUTO_COMPARE_MAX_ROUNDS_REQUIRED',
                label: 'Zen VNext auto compare max rounds',
            },
        ),
    )
);

export const writeZenVNextAutoCompareMaxRounds = (value) => (
    zenWorkspaceRepository.writeVNextAutoCompareMaxRounds(
        requireZenVNextAutoCompareMaxRounds(value),
    )
);

export const readZenVNextAutoCompareStopReliability = () => (
    requireZenVNextAutoCompareStopReliability(
        readRequiredZenVNextRawValue(
            ZEN_WORKSPACE_STORAGE_KEYS.VNEXT_AUTO_COMPARE_STOP_RELIABILITY,
            {
                code: 'ZEN_VNEXT_WORKSPACE_AUTO_COMPARE_STOP_RELIABILITY_REQUIRED',
                label: 'Zen VNext auto compare stop reliability',
            },
        ),
    )
);

export const writeZenVNextAutoCompareStopReliability = (value) => (
    zenWorkspaceRepository.writeVNextAutoCompareStopReliability(
        requireZenVNextAutoCompareStopReliability(value),
    )
);

export const readZenVNextActiveSection = () => (
    requireZenVNextActiveSection(
        readRequiredZenVNextRawValue(
            ZEN_WORKSPACE_STORAGE_KEYS.VNEXT_ACTIVE_SECTION,
            {
                code: 'ZEN_VNEXT_WORKSPACE_ACTIVE_SECTION_REQUIRED',
                label: 'Zen VNext active section',
            },
        ),
    )
);

export const writeZenVNextActiveSection = (value) => (
    zenWorkspaceRepository.writeVNextActiveSection(
        requireZenVNextActiveSection(value),
    )
);

export const readZenVNextWorkspaceState = () => ({
    seed: readZenVNextSeed(),
    factors: readZenVNextFactors(),
    reliabilityHint: readZenVNextReliabilityHint(),
    autoCompareMaxRounds: readZenVNextAutoCompareMaxRounds(),
    autoCompareStopReliability: readZenVNextAutoCompareStopReliability(),
    activeSection: readZenVNextActiveSection(),
});

export const bootstrapZenVNextWorkspaceState = ({
    seed,
    factors = getDefaultFactorVectorV2(),
    reliabilityHint = DEFAULT_ZEN_VNEXT_RELIABILITY_HINT,
    autoCompareMaxRounds = DEFAULT_ZEN_VNEXT_AUTO_COMPARE_MAX_ROUNDS,
    autoCompareStopReliability = DEFAULT_ZEN_VNEXT_AUTO_COMPARE_STOP_RELIABILITY,
    activeSection = DEFAULT_ZEN_VNEXT_ACTIVE_SECTION,
} = {}) => {
    const presence = resolveZenVNextWorkspaceKeyPresence();
    const presentKeys = ZEN_VNEXT_WORKSPACE_REQUIRED_KEYS.filter(
        (key) => presence[key] === true,
    );

    if (presentKeys.length === ZEN_VNEXT_WORKSPACE_REQUIRED_KEYS.length) {
        return readZenVNextWorkspaceState();
    }

    if (presentKeys.length > 0) {
        const missingKeys = ZEN_VNEXT_WORKSPACE_REQUIRED_KEYS.filter(
            (key) => presence[key] !== true,
        );
        throw createZenVNextWorkspaceStateError(
            'ZEN_VNEXT_WORKSPACE_STATE_PARTIAL',
            'Zen VNext workspace state is partially persisted. Bootstrap must not backfill missing keys.',
            {
                presentKeys,
                missingKeys,
            },
        );
    }

    const initialState = {
        seed: requireZenVNextSeed(seed),
        factors: requireZenVNextFactors(factors),
        reliabilityHint: requireZenVNextReliabilityHint(reliabilityHint),
        autoCompareMaxRounds: requireZenVNextAutoCompareMaxRounds(autoCompareMaxRounds),
        autoCompareStopReliability: requireZenVNextAutoCompareStopReliability(
            autoCompareStopReliability,
        ),
        activeSection: requireZenVNextActiveSection(activeSection),
    };

    writeZenVNextSeed(initialState.seed);
    writeZenVNextFactors(initialState.factors);
    writeZenVNextReliabilityHint(initialState.reliabilityHint);
    writeZenVNextAutoCompareMaxRounds(initialState.autoCompareMaxRounds);
    writeZenVNextAutoCompareStopReliability(
        initialState.autoCompareStopReliability,
    );
    writeZenVNextActiveSection(initialState.activeSection);

    return initialState;
};

export const readZenSakuraV2RuntimeFlagsWorkspace = (fallback = null) => (
    zenWorkspaceRepository.readSakuraV2RuntimeFlagsWorkspace(fallback)
);

export const writeZenSakuraV2RuntimeFlagsWorkspace = (payload) => (
    zenWorkspaceRepository.writeSakuraV2RuntimeFlagsWorkspace(payload)
);

export const readZenSobolColdStartWorkspaceCache = (fallback = null) => (
    zenWorkspaceRepository.readSobolColdStartWorkspaceCache(fallback)
);

export const writeZenSobolColdStartWorkspaceCache = (payload) => (
    zenWorkspaceRepository.writeSobolColdStartWorkspaceCache(payload)
);

export const clearZenSobolColdStartWorkspaceCache = () => (
    zenWorkspaceRepository.clearSobolColdStartWorkspaceCache()
);

export const readZenSceneGenerationWorkspaceKey = (fallback = '') => (
    zenWorkspaceRepository.readSceneGenerationWorkspaceKey(fallback)
);

export const writeZenSceneGenerationWorkspaceKey = (value) => (
    zenWorkspaceRepository.writeSceneGenerationWorkspaceKey(value)
);
