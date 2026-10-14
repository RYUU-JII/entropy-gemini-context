export const ZEN_AB_GENERATION_READINESS_REASON = Object.freeze({
    READY: 'ready',
    PROFILE_PENDING: 'profile_pending',
    LEARNING_STATE_PENDING: 'learning_state_pending',
    COLD_START_PENDING: 'cold_start_pending',
});

const createUnsupportedSpeciesError = (treeType) => {
    const error = new Error(
        `Zen A/B generation requires the canonical Sakura profile; received ${String(treeType)}.`,
    );
    error.name = 'ZenABGenerationReadinessError';
    error.code = 'ZEN_AB_GENERATION_SPECIES_UNSUPPORTED';
    error.details = {
        treeType: treeType ?? null,
        owner: 'zen_ab_generation_readiness',
    };
    return error;
};

const createReadiness = (ready, reason) => Object.freeze({
    ready,
    reason,
});

export const resolveZenABGenerationReadiness = ({
    profileReady = false,
    treeType = null,
    learningLoaded = false,
    coldStartReady = false,
} = {}) => {
    if (profileReady !== true) {
        return createReadiness(
            false,
            ZEN_AB_GENERATION_READINESS_REASON.PROFILE_PENDING,
        );
    }
    if (treeType !== 'sakura') {
        throw createUnsupportedSpeciesError(treeType);
    }
    if (learningLoaded !== true) {
        return createReadiness(
            false,
            ZEN_AB_GENERATION_READINESS_REASON.LEARNING_STATE_PENDING,
        );
    }
    if (coldStartReady !== true) {
        return createReadiness(
            false,
            ZEN_AB_GENERATION_READINESS_REASON.COLD_START_PENDING,
        );
    }
    return createReadiness(
        true,
        ZEN_AB_GENERATION_READINESS_REASON.READY,
    );
};

export default resolveZenABGenerationReadiness;
