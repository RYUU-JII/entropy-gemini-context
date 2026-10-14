const isPlainObject = (value) => (
    Boolean(value && typeof value === 'object' && !Array.isArray(value))
);

const resolveOptionalString = (value) => (
    typeof value === 'string' && value.trim()
        ? value.trim()
        : null
);

export const isZenWorkerErrorPayload = (value) => Boolean(
    isPlainObject(value)
    && (
        resolveOptionalString(value?.message)
        || resolveOptionalString(value?.code)
    )
);

export const cloneZenWorkerErrorDetails = (value) => (
    isPlainObject(value) ? { ...value } : null
);

export const mergeZenWorkerErrorDetails = (...values) => {
    const next = {};
    values.forEach((value) => {
        if (isPlainObject(value)) {
            Object.assign(next, value);
        }
    });
    return Object.keys(next).length ? next : null;
};

export const resolveZenWorkerErrorMessage = (
    error,
    fallback = 'ZEN_WORKER_ERROR',
) => {
    const direct = resolveOptionalString(error);
    if (direct) {
        return direct;
    }

    if (isPlainObject(error)) {
        const explicitMessage = resolveOptionalString(error?.message);
        if (explicitMessage) {
            return explicitMessage;
        }

        if (error?.error && error.error !== error) {
            const nested = resolveZenWorkerErrorMessage(error.error, '');
            if (resolveOptionalString(nested)) {
                return nested;
            }
        }

        const explicitCode = resolveOptionalString(error?.code);
        if (explicitCode) {
            return explicitCode;
        }
    }

    if (error instanceof Error) {
        const explicitMessage = resolveOptionalString(error?.message);
        if (explicitMessage) {
            return explicitMessage;
        }
    }

    return resolveOptionalString(fallback) || 'ZEN_WORKER_ERROR';
};

export const normalizeZenWorkerErrorPayload = (
    value,
    {
        fallbackCode = 'ZEN_WORKER_REQUEST_FAILED',
        fallbackMessage = 'Zen worker request failed.',
        details = null,
    } = {},
) => {
    const payload = isZenWorkerErrorPayload(value)
        ? value
        : (isZenWorkerErrorPayload(value?.error) ? value.error : null);
    const next = payload ? { ...payload } : {};
    if (!resolveOptionalString(next.message)) {
        next.message = resolveZenWorkerErrorMessage(payload || value, fallbackMessage);
    }
    if (!resolveOptionalString(next.code) && resolveOptionalString(fallbackCode)) {
        next.code = fallbackCode;
    }
    const mergedDetails = mergeZenWorkerErrorDetails(details, payload?.details);
    if (mergedDetails) {
        next.details = mergedDetails;
    }
    return next;
};

export const createZenWorkerError = (
    value,
    {
        fallbackCode = null,
        fallbackMessage = 'Zen worker request failed.',
        details = null,
    } = {},
) => {
    if (
        value instanceof Error
        && (
            resolveOptionalString(value?.code)
            || cloneZenWorkerErrorDetails(value?.details)
            || value?.cause
        )
    ) {
        return value;
    }

    const payload = normalizeZenWorkerErrorPayload(value, {
        fallbackCode,
        fallbackMessage,
        details,
    });
    const error = new Error(resolveZenWorkerErrorMessage(payload, fallbackMessage));
    const safeName = resolveOptionalString(payload?.name)
        || resolveOptionalString(value?.name);
    if (safeName && safeName !== 'Error') {
        error.name = safeName;
    }
    const safeCode = resolveOptionalString(payload?.code);
    if (safeCode) {
        error.code = safeCode;
    }
    const safeDetails = cloneZenWorkerErrorDetails(payload?.details);
    if (safeDetails) {
        error.details = safeDetails;
    }
    if (payload?.cause) {
        error.cause = createZenWorkerError(payload.cause, {
            fallbackMessage,
        });
    } else if (value instanceof Error && value !== error) {
        error.cause = value;
    }
    return error;
};

export const createZenWorkerUnavailableError = ({
    code = 'ZEN_WORKER_UNAVAILABLE',
    message = null,
    reason = null,
    surface = null,
    details = null,
} = {}) => {
    const safeCode = resolveOptionalString(code) || 'ZEN_WORKER_UNAVAILABLE';
    const safeReason = resolveOptionalString(reason) || safeCode;
    const surfaceDetails = {};
    if (isPlainObject(surface)) {
        const surfaceId = resolveOptionalString(surface?.id);
        const surfaceStatus = resolveOptionalString(surface?.status);
        const surfaceKind = resolveOptionalString(surface?.kind);
        const degradationMode = resolveOptionalString(surface?.degradationMode);
        const activationFlagName = resolveOptionalString(surface?.activationFlagName);
        if (surfaceId) {
            surfaceDetails.surfaceId = surfaceId;
        }
        if (surfaceStatus) {
            surfaceDetails.surfaceStatus = surfaceStatus;
        }
        if (surfaceKind) {
            surfaceDetails.surfaceKind = surfaceKind;
        }
        if (degradationMode) {
            surfaceDetails.degradationMode = degradationMode;
        }
        if (activationFlagName) {
            surfaceDetails.activationFlagName = activationFlagName;
        }
    }

    return createZenWorkerError({
        code: safeCode,
        message: resolveOptionalString(message) || safeReason,
        details: mergeZenWorkerErrorDetails(
            details,
            { reason: safeReason },
            surfaceDetails,
        ),
    }, {
        fallbackCode: safeCode,
        fallbackMessage: resolveOptionalString(message) || safeReason,
    });
};

export const serializeZenWorkerError = (
    error,
    {
        fallbackCode = 'ZEN_WORKER_ERROR',
        fallbackMessage = 'Zen worker failed.',
        details = null,
    } = {},
) => {
    const payload = normalizeZenWorkerErrorPayload(error, {
        fallbackCode,
        fallbackMessage,
        details,
    });
    const response = {
        code: resolveOptionalString(payload?.code) || fallbackCode || 'ZEN_WORKER_ERROR',
        message: resolveZenWorkerErrorMessage(payload, fallbackMessage),
    };
    const safeName = resolveOptionalString(payload?.name)
        || resolveOptionalString(error?.name);
    if (safeName && safeName !== 'Error') {
        response.name = safeName;
    }
    const safeDetails = cloneZenWorkerErrorDetails(payload?.details);
    if (safeDetails) {
        response.details = safeDetails;
    }
    if (payload?.cause) {
        response.cause = serializeZenWorkerError(payload.cause, {
            fallbackMessage,
        });
    } else if (error instanceof Error && error?.cause && error.cause !== error) {
        response.cause = serializeZenWorkerError(error.cause, {
            fallbackMessage,
        });
    }
    return response;
};
