const resolveLocalStorage = () => {
    if (typeof globalThis === 'undefined') {
        return null;
    }
    const storage = globalThis.localStorage
        || globalThis.window?.localStorage
        || null;
    if (
        !storage
        || typeof storage.getItem !== 'function'
        || typeof storage.setItem !== 'function'
        || typeof storage.removeItem !== 'function'
    ) {
        return null;
    }
    return storage;
};

export const createZenWorkspaceStorageError = (
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

const normalizeZenWorkspaceStorageKey = (key) => {
    if (typeof key !== 'string' || !key.trim()) {
        throw createZenWorkspaceStorageError(
            'ZEN_WORKSPACE_STORAGE_KEY_REQUIRED',
            'Zen workspace storage key must be a non-empty string.',
            { key },
        );
    }
    return key.trim();
};

const resolveLocalStorageOrThrow = (operation, key = null) => {
    const storage = resolveLocalStorage();
    if (storage) {
        return storage;
    }
    throw createZenWorkspaceStorageError(
        'ZEN_WORKSPACE_STORAGE_UNAVAILABLE',
        `Zen workspace storage is unavailable during ${operation}.`,
        {
            operation,
            key,
        },
    );
};

export const ZEN_WORKSPACE_STORAGE_KEYS = Object.freeze({
    WORKSPACE_MODE: 'zen_bonsai_workspace_mode',
    BACKBONE_DEBUG: 'zen_bonsai_backbone_debug',
    BRANCH_TIER_DEBUG: 'zen_bonsai_branch_tier_debug',
    RENDER_MODE: 'zen_bonsai_render_mode',
    EXPERIMENTAL_POT_STYLE: 'zen_bonsai_experimental_pot_style',
    VNEXT_SEED: 'zen_vnext_seed',
    VNEXT_FACTORS: 'zen_vnext_factors',
    VNEXT_RELIABILITY_HINT: 'zen_vnext_reliability_hint',
    VNEXT_AUTO_COMPARE_MAX_ROUNDS: 'zen_vnext_auto_compare_max_rounds',
    VNEXT_AUTO_COMPARE_STOP_RELIABILITY: 'zen_vnext_auto_compare_stop_reliability',
    VNEXT_ACTIVE_SECTION: 'zen_vnext_active_section',
    SAKURA_V2_RUNTIME_FLAGS: 'zen_sakura_v2_runtime_flags_v1',
    SOBOL_COLD_START_CACHE: 'zen_sakura_v2_sobol_pool_cache_v1',
    SCENE_GENERATION_KEY: 'zen_scene_generation_key_v1',
});

export const ZEN_WORKSPACE_MODE = Object.freeze({
    CLASSIC: 'classic',
    VNEXT: 'vnext',
});

export const ZEN_CLASSIC_RENDER_MODE = Object.freeze({
    FULL: 'full',
    TRUNK_SANDBOX: 'trunk_sandbox',
});

export const ZEN_CLASSIC_EXPERIMENTAL_POT_STYLE = Object.freeze({
    OVAL_CELADON: 'oval-celadon',
    OVAL_INKSTONE: 'oval-inkstone',
    RECT_SANDSTONE: 'rect-sandstone',
    SLIM_OVAL_PORCELAIN: 'slim-oval-porcelain',
    SHALLOW_WARM_STONE: 'shallow-warm-stone',
    SHALLOW_IRON_ASH: 'shallow-iron-ash',
    OVAL_TOKONAME_CLAY: 'oval-tokoname-clay',
    OVAL_MOSS_GRAY: 'oval-moss-gray',
    RECT_RIVER_STONE: 'rect-river-stone',
});
const ZEN_CLASSIC_EXPERIMENTAL_POT_STYLE_VALUES = new Set(
    Object.values(ZEN_CLASSIC_EXPERIMENTAL_POT_STYLE),
);

export const hasZenWorkspaceStorage = () => Boolean(resolveLocalStorage());

export const readZenWorkspaceStorageItem = (key, fallback = null) => {
    const normalizedKey = normalizeZenWorkspaceStorageKey(key);
    const storage = resolveLocalStorageOrThrow('read', normalizedKey);
    try {
        const value = storage.getItem(normalizedKey);
        return value === null ? fallback : value;
    } catch (error) {
        throw createZenWorkspaceStorageError(
            'ZEN_WORKSPACE_STORAGE_READ_FAILED',
            `Failed to read Zen workspace storage key '${normalizedKey}'.`,
            { key: normalizedKey },
            error,
        );
    }
};

export const writeZenWorkspaceStorageItem = (key, value) => {
    const normalizedKey = normalizeZenWorkspaceStorageKey(key);
    const storage = resolveLocalStorageOrThrow('write', normalizedKey);
    if (value === undefined || value === null) {
        return removeZenWorkspaceStorageItem(normalizedKey);
    }
    try {
        storage.setItem(normalizedKey, String(value));
        return true;
    } catch (error) {
        throw createZenWorkspaceStorageError(
            'ZEN_WORKSPACE_STORAGE_WRITE_FAILED',
            `Failed to write Zen workspace storage key '${normalizedKey}'.`,
            { key: normalizedKey },
            error,
        );
    }
};

export const removeZenWorkspaceStorageItem = (key) => {
    const normalizedKey = normalizeZenWorkspaceStorageKey(key);
    const storage = resolveLocalStorageOrThrow('remove', normalizedKey);
    try {
        storage.removeItem(normalizedKey);
        return true;
    } catch (error) {
        throw createZenWorkspaceStorageError(
            'ZEN_WORKSPACE_STORAGE_REMOVE_FAILED',
            `Failed to remove Zen workspace storage key '${normalizedKey}'.`,
            { key: normalizedKey },
            error,
        );
    }
};

export const readZenWorkspaceString = (key, fallback = '') => {
    const raw = readZenWorkspaceStorageItem(key, null);
    return typeof raw === 'string' && raw.length > 0 ? raw : fallback;
};

export const readZenWorkspaceNumber = (key, fallback = 0) => {
    const normalizedKey = normalizeZenWorkspaceStorageKey(key);
    const raw = readZenWorkspaceStorageItem(normalizedKey, null);
    if (raw === null || raw === undefined || raw === '') {
        return fallback;
    }
    const numeric = Number(raw);
    if (Number.isFinite(numeric)) {
        return numeric;
    }
    throw createZenWorkspaceStorageError(
        'ZEN_WORKSPACE_STORAGE_NUMBER_INVALID',
        `Zen workspace storage key '${normalizedKey}' contains a non-numeric value.`,
        {
            key: normalizedKey,
            value: raw,
        },
    );
};

export const readZenWorkspaceBooleanFlag = (
    key,
    {
        fallback = false,
        truthyValues = ['1', 'true'],
        falsyValues = ['0', 'false'],
    } = {},
) => {
    const normalizedKey = normalizeZenWorkspaceStorageKey(key);
    const raw = readZenWorkspaceStorageItem(normalizedKey, null);
    if (raw === null || raw === undefined) {
        return Boolean(fallback);
    }
    const normalized = String(raw).trim().toLowerCase();
    if (truthyValues.includes(normalized)) {
        return true;
    }
    if (falsyValues.includes(normalized)) {
        return false;
    }
    throw createZenWorkspaceStorageError(
        'ZEN_WORKSPACE_STORAGE_BOOLEAN_INVALID',
        `Zen workspace storage key '${normalizedKey}' contains an invalid boolean flag value.`,
        {
            key: normalizedKey,
            value: raw,
        },
    );
};

export const readZenWorkspaceJson = (key, fallback = null) => {
    const normalizedKey = normalizeZenWorkspaceStorageKey(key);
    const raw = readZenWorkspaceStorageItem(normalizedKey, null);
    if (typeof raw !== 'string' || !raw) {
        return fallback;
    }
    try {
        return JSON.parse(raw);
    } catch (error) {
        throw createZenWorkspaceStorageError(
            'ZEN_WORKSPACE_STORAGE_JSON_INVALID',
            `Zen workspace storage key '${normalizedKey}' contains invalid JSON.`,
            {
                key: normalizedKey,
                value: raw,
            },
            error,
        );
    }
};

export const writeZenWorkspaceJson = (key, value) => {
    const normalizedKey = normalizeZenWorkspaceStorageKey(key);
    if (value === undefined) {
        return removeZenWorkspaceStorageItem(normalizedKey);
    }
    try {
        return writeZenWorkspaceStorageItem(normalizedKey, JSON.stringify(value));
    } catch (error) {
        if (error?.code) {
            throw error;
        }
        throw createZenWorkspaceStorageError(
            'ZEN_WORKSPACE_STORAGE_JSON_SERIALIZE_FAILED',
            `Failed to serialize Zen workspace storage key '${normalizedKey}'.`,
            {
                key: normalizedKey,
                value,
            },
            error,
        );
    }
};

export const resolveZenWorkspaceMode = (candidate) => {
    if (candidate === ZEN_WORKSPACE_MODE.CLASSIC || candidate === ZEN_WORKSPACE_MODE.VNEXT) {
        return candidate;
    }
    throw createZenWorkspaceStorageError(
        'ZEN_WORKSPACE_MODE_INVALID',
        `Zen workspace mode must be one of: ${Object.values(ZEN_WORKSPACE_MODE).join(', ')}.`,
        { candidate },
    );
};

export const readZenWorkspaceMode = (fallback = ZEN_WORKSPACE_MODE.CLASSIC) => (
    resolveZenWorkspaceMode(
        readZenWorkspaceStorageItem(
            ZEN_WORKSPACE_STORAGE_KEYS.WORKSPACE_MODE,
            resolveZenWorkspaceMode(fallback),
        ),
    )
);

export const writeZenWorkspaceMode = (mode) => (
    writeZenWorkspaceStorageItem(
        ZEN_WORKSPACE_STORAGE_KEYS.WORKSPACE_MODE,
        resolveZenWorkspaceMode(mode),
    )
);

export const readZenClassicBackboneDebug = (fallback = false) => (
    readZenWorkspaceBooleanFlag(
        ZEN_WORKSPACE_STORAGE_KEYS.BACKBONE_DEBUG,
        { fallback },
    )
);

export const writeZenClassicBackboneDebug = (enabled) => (
    writeZenWorkspaceStorageItem(
        ZEN_WORKSPACE_STORAGE_KEYS.BACKBONE_DEBUG,
        enabled ? '1' : '0',
    )
);

export const readZenClassicBranchTierDebug = (fallback = false) => (
    readZenWorkspaceBooleanFlag(
        ZEN_WORKSPACE_STORAGE_KEYS.BRANCH_TIER_DEBUG,
        { fallback },
    )
);

export const writeZenClassicBranchTierDebug = (enabled) => (
    writeZenWorkspaceStorageItem(
        ZEN_WORKSPACE_STORAGE_KEYS.BRANCH_TIER_DEBUG,
        enabled ? '1' : '0',
    )
);

export const resolveZenClassicRenderMode = (
    candidate,
    fallback = ZEN_CLASSIC_RENDER_MODE.FULL,
) => (
    candidate === ZEN_CLASSIC_RENDER_MODE.TRUNK_SANDBOX
        ? ZEN_CLASSIC_RENDER_MODE.TRUNK_SANDBOX
        : fallback === ZEN_CLASSIC_RENDER_MODE.TRUNK_SANDBOX
            ? ZEN_CLASSIC_RENDER_MODE.TRUNK_SANDBOX
            : ZEN_CLASSIC_RENDER_MODE.FULL
);

export const readZenClassicRenderMode = (
    fallback = ZEN_CLASSIC_RENDER_MODE.FULL,
) => (
    resolveZenClassicRenderMode(
        readZenWorkspaceString(
            ZEN_WORKSPACE_STORAGE_KEYS.RENDER_MODE,
            resolveZenClassicRenderMode(fallback),
        ),
        fallback,
    )
);

export const writeZenClassicRenderMode = (mode) => (
    writeZenWorkspaceStorageItem(
        ZEN_WORKSPACE_STORAGE_KEYS.RENDER_MODE,
        resolveZenClassicRenderMode(mode),
    )
);

export const resolveZenClassicExperimentalPotStyle = (
    candidate,
    fallback = ZEN_CLASSIC_EXPERIMENTAL_POT_STYLE.SHALLOW_WARM_STONE,
) => {
    const resolvedFallback = ZEN_CLASSIC_EXPERIMENTAL_POT_STYLE_VALUES.has(fallback)
        ? fallback
        : ZEN_CLASSIC_EXPERIMENTAL_POT_STYLE.SHALLOW_WARM_STONE;
    return ZEN_CLASSIC_EXPERIMENTAL_POT_STYLE_VALUES.has(candidate)
        ? candidate
        : resolvedFallback;
};

export const readZenClassicExperimentalPotStyle = (
    fallback = ZEN_CLASSIC_EXPERIMENTAL_POT_STYLE.SHALLOW_WARM_STONE,
) => (
    resolveZenClassicExperimentalPotStyle(
        readZenWorkspaceString(
            ZEN_WORKSPACE_STORAGE_KEYS.EXPERIMENTAL_POT_STYLE,
            resolveZenClassicExperimentalPotStyle(fallback),
        ),
        fallback,
    )
);

export const writeZenClassicExperimentalPotStyle = (styleId) => (
    writeZenWorkspaceStorageItem(
        ZEN_WORKSPACE_STORAGE_KEYS.EXPERIMENTAL_POT_STYLE,
        resolveZenClassicExperimentalPotStyle(styleId),
    )
);

const readRequiredZenVNextStorageValue = (
    key,
    label,
    requiredCode = 'ZEN_WORKSPACE_STORAGE_REQUIRED',
) => {
    const raw = readZenWorkspaceStorageItem(key, null);
    if (raw === null || raw === undefined) {
        throw createZenWorkspaceStorageError(
            requiredCode,
            `${label} is missing from Zen workspace storage.`,
            {
                key,
            },
        );
    }
    return raw;
};

const requireFiniteZenVNextStorageNumber = (
    value,
    {
        key,
        label,
        integer = false,
        min = Number.NEGATIVE_INFINITY,
        max = Number.POSITIVE_INFINITY,
    },
) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        throw createZenWorkspaceStorageError(
            'ZEN_WORKSPACE_STORAGE_VALUE_INVALID',
            `${label} must be a finite number.`,
            {
                key,
                value,
            },
        );
    }
    if (integer && !Number.isInteger(numeric)) {
        throw createZenWorkspaceStorageError(
            'ZEN_WORKSPACE_STORAGE_VALUE_INVALID',
            `${label} must be an integer.`,
            {
                key,
                value,
            },
        );
    }
    if (numeric < min || numeric > max) {
        throw createZenWorkspaceStorageError(
            'ZEN_WORKSPACE_STORAGE_VALUE_INVALID',
            `${label} must be between ${min} and ${max}.`,
            {
                key,
                value,
                min,
                max,
            },
        );
    }
    return numeric;
};

const requireZenVNextStorageString = (value, key, label) => {
    if (typeof value !== 'string') {
        throw createZenWorkspaceStorageError(
            'ZEN_WORKSPACE_STORAGE_VALUE_INVALID',
            `${label} must be a string.`,
            {
                key,
                value,
            },
        );
    }
    const normalized = value.trim();
    if (!normalized) {
        throw createZenWorkspaceStorageError(
            'ZEN_WORKSPACE_STORAGE_VALUE_INVALID',
            `${label} must be a non-empty string.`,
            {
                key,
                value,
            },
        );
    }
    return normalized;
};

export const readZenVNextSeed = () => (
    requireFiniteZenVNextStorageNumber(
        readRequiredZenVNextStorageValue(
            ZEN_WORKSPACE_STORAGE_KEYS.VNEXT_SEED,
            'Zen VNext workspace seed',
        ),
        {
            key: ZEN_WORKSPACE_STORAGE_KEYS.VNEXT_SEED,
            label: 'Zen VNext workspace seed',
            integer: true,
            min: 0,
        },
    )
);

export const writeZenVNextSeed = (seed) => {
    const numeric = requireFiniteZenVNextStorageNumber(seed, {
        key: ZEN_WORKSPACE_STORAGE_KEYS.VNEXT_SEED,
        label: 'Zen VNext workspace seed',
        integer: true,
        min: 0,
    });
    return writeZenWorkspaceStorageItem(
        ZEN_WORKSPACE_STORAGE_KEYS.VNEXT_SEED,
        String(numeric),
    );
};

export const readZenVNextFactors = () => {
    const raw = readRequiredZenVNextStorageValue(
        ZEN_WORKSPACE_STORAGE_KEYS.VNEXT_FACTORS,
        'Zen VNext workspace factors',
    );
    if (typeof raw !== 'string' || !raw.trim()) {
        throw createZenWorkspaceStorageError(
            'ZEN_WORKSPACE_STORAGE_VALUE_INVALID',
            'Zen VNext workspace factors must be stored as non-empty JSON.',
            {
                key: ZEN_WORKSPACE_STORAGE_KEYS.VNEXT_FACTORS,
                value: raw,
            },
        );
    }
    const parsed = readZenWorkspaceJson(
        ZEN_WORKSPACE_STORAGE_KEYS.VNEXT_FACTORS,
        null,
    );
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw createZenWorkspaceStorageError(
            'ZEN_WORKSPACE_STORAGE_VALUE_INVALID',
            'Zen VNext workspace factors must deserialize to a plain object.',
            {
                key: ZEN_WORKSPACE_STORAGE_KEYS.VNEXT_FACTORS,
                value: parsed,
            },
        );
    }
    return parsed;
};

export const writeZenVNextFactors = (factors) => (
    writeZenWorkspaceJson(ZEN_WORKSPACE_STORAGE_KEYS.VNEXT_FACTORS, factors)
);

export const readZenVNextReliabilityHint = () => (
    requireFiniteZenVNextStorageNumber(
        readRequiredZenVNextStorageValue(
            ZEN_WORKSPACE_STORAGE_KEYS.VNEXT_RELIABILITY_HINT,
            'Zen VNext reliability hint',
        ),
        {
            key: ZEN_WORKSPACE_STORAGE_KEYS.VNEXT_RELIABILITY_HINT,
            label: 'Zen VNext reliability hint',
            min: 0,
            max: 1,
        },
    )
);

export const writeZenVNextReliabilityHint = (value) => {
    const numeric = requireFiniteZenVNextStorageNumber(value, {
        key: ZEN_WORKSPACE_STORAGE_KEYS.VNEXT_RELIABILITY_HINT,
        label: 'Zen VNext reliability hint',
        min: 0,
        max: 1,
    });
    return writeZenWorkspaceStorageItem(
        ZEN_WORKSPACE_STORAGE_KEYS.VNEXT_RELIABILITY_HINT,
        String(numeric),
    );
};

export const readZenVNextAutoCompareMaxRounds = () => (
    requireFiniteZenVNextStorageNumber(
        readRequiredZenVNextStorageValue(
            ZEN_WORKSPACE_STORAGE_KEYS.VNEXT_AUTO_COMPARE_MAX_ROUNDS,
            'Zen VNext auto compare max rounds',
        ),
        {
            key: ZEN_WORKSPACE_STORAGE_KEYS.VNEXT_AUTO_COMPARE_MAX_ROUNDS,
            label: 'Zen VNext auto compare max rounds',
            integer: true,
            min: 1,
            max: 200,
        },
    )
);

export const writeZenVNextAutoCompareMaxRounds = (value) => {
    const numeric = requireFiniteZenVNextStorageNumber(value, {
        key: ZEN_WORKSPACE_STORAGE_KEYS.VNEXT_AUTO_COMPARE_MAX_ROUNDS,
        label: 'Zen VNext auto compare max rounds',
        integer: true,
        min: 1,
        max: 200,
    });
    return writeZenWorkspaceStorageItem(
        ZEN_WORKSPACE_STORAGE_KEYS.VNEXT_AUTO_COMPARE_MAX_ROUNDS,
        String(numeric),
    );
};

export const readZenVNextAutoCompareStopReliability = () => (
    requireFiniteZenVNextStorageNumber(
        readRequiredZenVNextStorageValue(
            ZEN_WORKSPACE_STORAGE_KEYS.VNEXT_AUTO_COMPARE_STOP_RELIABILITY,
            'Zen VNext auto compare stop reliability',
        ),
        {
            key: ZEN_WORKSPACE_STORAGE_KEYS.VNEXT_AUTO_COMPARE_STOP_RELIABILITY,
            label: 'Zen VNext auto compare stop reliability',
            min: 0,
            max: 1,
        },
    )
);

export const writeZenVNextAutoCompareStopReliability = (value) => {
    const numeric = requireFiniteZenVNextStorageNumber(value, {
        key: ZEN_WORKSPACE_STORAGE_KEYS.VNEXT_AUTO_COMPARE_STOP_RELIABILITY,
        label: 'Zen VNext auto compare stop reliability',
        min: 0,
        max: 1,
    });
    return writeZenWorkspaceStorageItem(
        ZEN_WORKSPACE_STORAGE_KEYS.VNEXT_AUTO_COMPARE_STOP_RELIABILITY,
        String(numeric),
    );
};

export const readZenVNextActiveSection = () => (
    requireZenVNextStorageString(
        readRequiredZenVNextStorageValue(
            ZEN_WORKSPACE_STORAGE_KEYS.VNEXT_ACTIVE_SECTION,
            'Zen VNext active section',
        ),
        ZEN_WORKSPACE_STORAGE_KEYS.VNEXT_ACTIVE_SECTION,
        'Zen VNext active section',
    )
);

export const writeZenVNextActiveSection = (value) => (
    writeZenWorkspaceStorageItem(
        ZEN_WORKSPACE_STORAGE_KEYS.VNEXT_ACTIVE_SECTION,
        requireZenVNextStorageString(
            value,
            ZEN_WORKSPACE_STORAGE_KEYS.VNEXT_ACTIVE_SECTION,
            'Zen VNext active section',
        ),
    )
);

export const readZenSakuraV2RuntimeFlagsWorkspace = (fallback = null) => (
    readZenWorkspaceJson(
        ZEN_WORKSPACE_STORAGE_KEYS.SAKURA_V2_RUNTIME_FLAGS,
        fallback,
    )
);

export const writeZenSakuraV2RuntimeFlagsWorkspace = (payload) => (
    writeZenWorkspaceJson(
        ZEN_WORKSPACE_STORAGE_KEYS.SAKURA_V2_RUNTIME_FLAGS,
        payload,
    )
);

export const readZenSobolColdStartWorkspaceCache = (fallback = null) => (
    readZenWorkspaceJson(
        ZEN_WORKSPACE_STORAGE_KEYS.SOBOL_COLD_START_CACHE,
        fallback,
    )
);

export const writeZenSobolColdStartWorkspaceCache = (payload) => (
    writeZenWorkspaceJson(
        ZEN_WORKSPACE_STORAGE_KEYS.SOBOL_COLD_START_CACHE,
        payload,
    )
);

export const clearZenSobolColdStartWorkspaceCache = () => (
    removeZenWorkspaceStorageItem(
        ZEN_WORKSPACE_STORAGE_KEYS.SOBOL_COLD_START_CACHE,
    )
);

export const readZenSceneGenerationWorkspaceKey = (fallback = '') => (
    readZenWorkspaceString(
        ZEN_WORKSPACE_STORAGE_KEYS.SCENE_GENERATION_KEY,
        fallback,
    )
);

export const writeZenSceneGenerationWorkspaceKey = (value) => (
    writeZenWorkspaceStorageItem(
        ZEN_WORKSPACE_STORAGE_KEYS.SCENE_GENERATION_KEY,
        value,
    )
);
