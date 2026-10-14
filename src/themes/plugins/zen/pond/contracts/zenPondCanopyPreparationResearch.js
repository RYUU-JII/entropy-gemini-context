// Optional, capture-only research input. Absence and native keep normal startup.
export const normalizeZenPondCanopyPreparationResearch = (value) => {
    if (value === undefined || value === 'native') return undefined;
    if (value !== 'before-first-draw') {
        throw new Error('ZEN_POND_CANOPY_PREPARATION_RESEARCH_INVALID');
    }
    return value;
};
