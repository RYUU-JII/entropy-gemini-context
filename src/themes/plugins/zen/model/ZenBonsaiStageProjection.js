const STRUCTURE_DEPTH_MIN = 1;
const STRUCTURE_DEPTH_MAX = 9;
const DEFAULT_BONSAI_STRUCTURE_DEPTH = 6;

export const clampStructureDepth = (
    value,
    min = STRUCTURE_DEPTH_MIN,
    max = STRUCTURE_DEPTH_MAX,
) => {
    const numeric = Number.isFinite(value) ? value : DEFAULT_BONSAI_STRUCTURE_DEPTH;
    return Math.min(max, Math.max(min, Math.round(numeric)));
};

export const withStructureDepth = (stage, structureDepth) => ({
    ...stage,
    depth: clampStructureDepth(structureDepth),
});
