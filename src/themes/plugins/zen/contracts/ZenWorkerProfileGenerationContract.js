const isPlainObject = (value) => Boolean(
    value
    && typeof value === 'object'
    && !Array.isArray(value)
);

const createProfileGenerationError = (code, details = null) => {
    const error = new Error(code);
    error.code = code;
    if (isPlainObject(details)) {
        error.details = { ...details };
    }
    return error;
};

export const requireZenWorkerProfileGeneration = (value) => {
    if (
        typeof value !== 'string'
        || !value.trim()
        || value.trim() !== value
    ) {
        throw createProfileGenerationError('ZEN_WORKER_PROFILE_GENERATION_REQUIRED');
    }
    return value;
};

const requireProfileGenerationOwner = (owner) => {
    if (!owner || typeof owner.requireProfileGenerationLease !== 'function') {
        throw createProfileGenerationError('ZEN_WORKER_PROFILE_GENERATION_OWNER_REQUIRED');
    }
    return owner;
};

export const createZenWorkerClientProfileGenerationLease = ({
    profileGenerationOwner,
} = {}) => {
    const owner = requireProfileGenerationOwner(profileGenerationOwner);
    let capturedProfileGeneration = null;

    return Object.freeze({
        async requireCurrent() {
            const currentProfileGeneration = requireZenWorkerProfileGeneration(
                await owner.requireProfileGenerationLease(),
            );
            if (capturedProfileGeneration === null) {
                capturedProfileGeneration = currentProfileGeneration;
            } else if (currentProfileGeneration !== capturedProfileGeneration) {
                throw createProfileGenerationError(
                    'ZEN_WORKER_CLIENT_PROFILE_GENERATION_STALE',
                    {
                        expectedProfileGeneration: capturedProfileGeneration,
                        observedProfileGeneration: currentProfileGeneration,
                    },
                );
            }
            return capturedProfileGeneration;
        },
    });
};

export const createZenWorkerRequestProfileGenerationLease = () => {
    let boundProfileGeneration = null;

    return Object.freeze({
        admit(profileGeneration) {
            const requestedProfileGeneration = requireZenWorkerProfileGeneration(profileGeneration);
            if (boundProfileGeneration === null) {
                boundProfileGeneration = requestedProfileGeneration;
            } else if (requestedProfileGeneration !== boundProfileGeneration) {
                throw createProfileGenerationError(
                    'ZEN_WORKER_PROFILE_GENERATION_STALE',
                    {
                        boundProfileGeneration,
                        requestedProfileGeneration,
                    },
                );
            }
            return boundProfileGeneration;
        },
    });
};

export const createZenWorkerProfileGenerationLease = ({
    modelRepository,
} = {}) => {
    if (
        !modelRepository
        || typeof modelRepository.bindToProfileGeneration !== 'function'
        || typeof modelRepository.requireProfileGenerationLease !== 'function'
    ) {
        throw createProfileGenerationError('ZEN_WORKER_MODEL_REPOSITORY_REQUIRED');
    }
    let boundProfileGeneration = null;

    return Object.freeze({
        async admit(profileGeneration) {
            const requestedProfileGeneration = requireZenWorkerProfileGeneration(profileGeneration);
            if (boundProfileGeneration === null) {
                modelRepository.bindToProfileGeneration(requestedProfileGeneration);
                boundProfileGeneration = requestedProfileGeneration;
            } else if (requestedProfileGeneration !== boundProfileGeneration) {
                throw createProfileGenerationError(
                    'ZEN_WORKER_PROFILE_GENERATION_STALE',
                    {
                        boundProfileGeneration,
                        requestedProfileGeneration,
                    },
                );
            }

            const admittedProfileGeneration = requireZenWorkerProfileGeneration(
                await modelRepository.requireProfileGenerationLease(),
            );
            if (admittedProfileGeneration !== boundProfileGeneration) {
                throw createProfileGenerationError(
                    'ZEN_WORKER_PROFILE_GENERATION_LEASE_MISMATCH',
                    {
                        boundProfileGeneration,
                        admittedProfileGeneration,
                    },
                );
            }
            return boundProfileGeneration;
        },
    });
};

export const requireZenWorkerResponseProfileGeneration = (
    message,
    expectedProfileGeneration,
) => {
    const expected = requireZenWorkerProfileGeneration(expectedProfileGeneration);
    let observed = null;
    try {
        observed = requireZenWorkerProfileGeneration(message?.profileGeneration);
    } catch {
        throw createProfileGenerationError(
            'ZEN_WORKER_RESPONSE_PROFILE_GENERATION_REQUIRED',
            { expectedProfileGeneration: expected },
        );
    }
    if (observed !== expected) {
        throw createProfileGenerationError(
            'ZEN_WORKER_RESPONSE_PROFILE_GENERATION_MISMATCH',
            {
                expectedProfileGeneration: expected,
                observedProfileGeneration: observed,
            },
        );
    }
    return observed;
};
