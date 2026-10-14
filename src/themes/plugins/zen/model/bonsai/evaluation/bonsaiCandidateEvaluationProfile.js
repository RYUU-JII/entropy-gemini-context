export const BONSAI_CANDIDATE_EVALUATION_PROFILE = Object.freeze({
    FULL: 'full_tree_v1',
    STRUCTURAL_SCOUT: 'structural_scout_v1',
    MATERIALIZED_TOPOLOGY_PROJECTION: 'materialized_topology_projection_v1',
});

const VALID_PROFILES = new Set(Object.values(BONSAI_CANDIDATE_EVALUATION_PROFILE));

export const assertBonsaiCandidateEvaluationProfile = (value) => {
    if (!VALID_PROFILES.has(value)) {
        throw new Error(`ZEN_BONSAI_CANDIDATE_EVALUATION_PROFILE_INVALID:${String(value)}`);
    }
    return value;
};

export const isStructuralBonsaiCandidateProfile = (value) => (
    value === BONSAI_CANDIDATE_EVALUATION_PROFILE.STRUCTURAL_SCOUT
);
