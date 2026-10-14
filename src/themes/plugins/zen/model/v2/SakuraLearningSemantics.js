export const SAKURA_GENERATION_SEMANTICS_ID = 'sakura_generation_semantics_v5';

// Retained as the public learning-owner alias. Generation semantics is the
// actual compatibility key: a learning row is reusable only when it observed
// the exact active generator meaning.
export const SAKURA_LEARNING_SEMANTICS_VERSION = SAKURA_GENERATION_SEMANTICS_ID;

export const isCurrentSakuraGenerationSemantics = (value) => (
    value === SAKURA_GENERATION_SEMANTICS_ID
);

export const isSakuraLearningEvidenceSemanticallyCompatible = ({
    sourceGenerationSemantics,
    targetGenerationSemantics = SAKURA_GENERATION_SEMANTICS_ID,
} = {}) => {
    return targetGenerationSemantics === SAKURA_GENERATION_SEMANTICS_ID
        && sourceGenerationSemantics === targetGenerationSemantics;
};
