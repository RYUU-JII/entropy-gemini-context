export const DEFAULT_BONSAI_CANDIDATE_STAGE_SEED_OFFSET = 7919;

export const resolveBonsaiCandidateTopologySeed = ({
    candidateSeed,
    stageProfileIndex,
    stageSeedOffset = DEFAULT_BONSAI_CANDIDATE_STAGE_SEED_OFFSET,
} = {}) => {
    const seed = Number(candidateSeed);
    const index = Number(stageProfileIndex);
    const offset = Number(stageSeedOffset);
    if (!Number.isFinite(seed)) {
        throw new Error('ZEN_BONSAI_CANDIDATE_SEED_REQUIRED');
    }
    if (!Number.isInteger(index) || index < 0) {
        throw new Error('ZEN_BONSAI_CANDIDATE_STAGE_INDEX_INVALID');
    }
    if (!Number.isFinite(offset) || offset <= 0) {
        throw new Error('ZEN_BONSAI_CANDIDATE_STAGE_SEED_OFFSET_INVALID');
    }
    return Math.floor(seed) + ((index + 1) * Math.floor(offset));
};
