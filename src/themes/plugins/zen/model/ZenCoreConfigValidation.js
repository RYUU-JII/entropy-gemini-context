export const createZenCoreConfigError = (
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

const createStoredValueError = (
    code,
    message,
    storageKey,
    value,
    cause = null,
) => createZenCoreConfigError(
    code,
    message,
    {
        storageKey,
        value,
    },
    cause,
);

export const requireStoredIntegerInRange = (
    value,
    {
        storageKey,
        code,
        label,
        min,
        max,
    },
) => {
    const numeric = Number(value);
    if (!Number.isInteger(numeric)) {
        throw createStoredValueError(
            code,
            `${label} must be an integer.`,
            storageKey,
            value,
        );
    }
    if (numeric < min || numeric > max) {
        throw createStoredValueError(
            code,
            `${label} must be between ${min} and ${max}.`,
            storageKey,
            value,
        );
    }
    return numeric;
};

export const requireStoredNumberInRange = (
    value,
    {
        storageKey,
        code,
        label,
        min,
        max,
    },
) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        throw createStoredValueError(
            code,
            `${label} must be numeric.`,
            storageKey,
            value,
        );
    }
    if (numeric < min || numeric > max) {
        throw createStoredValueError(
            code,
            `${label} must be between ${min} and ${max}.`,
            storageKey,
            value,
        );
    }
    return numeric;
};

export const requireStoredObject = (
    value,
    {
        storageKey,
        code,
        label,
    },
) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw createStoredValueError(
            code,
            `${label} must be a plain object.`,
            storageKey,
            value,
        );
    }
    return value;
};

export const requireStoredEnumValue = (
    value,
    {
        storageKey,
        code,
        label,
        allowedValues,
    },
) => {
    if (typeof value !== 'string' || !allowedValues.has(value)) {
        throw createStoredValueError(
            code,
            `${label} must be one of: ${Array.from(allowedValues).join(', ')}.`,
            storageKey,
            value,
        );
    }
    return value;
};
