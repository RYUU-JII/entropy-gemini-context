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
            'Zen UI-local storage key must be a non-empty string.',
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
        `Zen UI-local storage is unavailable during ${operation}.`,
        {
            operation,
            key,
        },
    );
};

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
            `Failed to read Zen UI-local storage key '${normalizedKey}'.`,
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
            `Failed to write Zen UI-local storage key '${normalizedKey}'.`,
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
            `Failed to remove Zen UI-local storage key '${normalizedKey}'.`,
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
        `Zen UI-local storage key '${normalizedKey}' contains a non-numeric value.`,
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
        `Zen UI-local storage key '${normalizedKey}' contains an invalid boolean flag value.`,
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
            `Zen UI-local storage key '${normalizedKey}' contains invalid JSON.`,
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
            `Failed to serialize Zen UI-local storage key '${normalizedKey}'.`,
            {
                key: normalizedKey,
                value,
            },
            error,
        );
    }
};
