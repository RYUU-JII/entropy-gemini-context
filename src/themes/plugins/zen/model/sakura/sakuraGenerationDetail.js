export const SAKURA_GENERATION_DETAIL = Object.freeze({
    FULL: 'full',
    STRUCTURAL_SCOUT: 'structural_scout',
});

const VALID_GENERATION_DETAILS = new Set(Object.values(SAKURA_GENERATION_DETAIL));

export const assertSakuraGenerationDetail = (value) => {
    if (!VALID_GENERATION_DETAILS.has(value)) {
        throw new Error(`ZEN_SAKURA_GENERATION_DETAIL_INVALID:${String(value)}`);
    }
    return value;
};
