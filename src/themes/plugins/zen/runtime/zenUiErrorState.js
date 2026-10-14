const isPlainObject = (value) => (
    Boolean(value && typeof value === 'object' && !Array.isArray(value))
);

const resolveOptionalString = (value) => (
    typeof value === 'string' && value.trim()
        ? value.trim()
        : null
);

const cloneDetails = (value) => (
    isPlainObject(value) ? { ...value } : null
);

const mergeDetails = (...values) => {
    const next = {};
    values.forEach((value) => {
        if (isPlainObject(value)) {
            Object.assign(next, value);
        }
    });
    return Object.keys(next).length ? next : null;
};

export const isZenUiErrorState = (value) => Boolean(
    isPlainObject(value)
    && !(value instanceof Error)
    && resolveOptionalString(value?.code)
    && resolveOptionalString(value?.message)
);

export const createZenUiErrorState = (
    error,
    {
        fallbackCode = 'ZEN_UI_ERROR',
        fallbackMessage = 'Zen workspace action failed.',
        details = null,
    } = {},
) => {
    if (isZenUiErrorState(error)) {
        return error;
    }

    const code = resolveOptionalString(error?.code)
        || resolveOptionalString(error?.details?.workerErrorCode)
        || resolveOptionalString(fallbackCode)
        || 'ZEN_UI_ERROR';
    const message = resolveOptionalString(error?.message)
        || resolveOptionalString(error)
        || resolveOptionalString(fallbackMessage)
        || code;
    const causeCode = resolveOptionalString(error?.cause?.code)
        || resolveOptionalString(error?.details?.workerErrorCode);
    const causeMessage = resolveOptionalString(error?.cause?.message)
        || resolveOptionalString(error?.details?.workerErrorMessage);
    const mergedDetails = mergeDetails(error?.details, details);

    const state = {
        code,
        message,
    };
    if (causeCode && causeCode !== code) {
        state.causeCode = causeCode;
    }
    if (causeMessage && causeMessage !== message) {
        state.causeMessage = causeMessage;
    }
    if (mergedDetails) {
        state.details = mergedDetails;
    }
    return state;
};
