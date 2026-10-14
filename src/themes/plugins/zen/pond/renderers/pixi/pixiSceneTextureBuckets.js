const TAU = Math.PI * 2;
const DEFAULT_FLOWER_PHASE_VARIANTS = 12;

const normalizePhase = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return 0;
    }
    return ((numeric % TAU) + TAU) % TAU;
};

export const resolveFlowerPhaseBucket = (
    value,
    variantCount = DEFAULT_FLOWER_PHASE_VARIANTS,
) => {
    const count = Math.max(1, Math.floor(Number(variantCount) || DEFAULT_FLOWER_PHASE_VARIANTS));
    return Math.round((normalizePhase(value) / TAU) * count) % count;
};

export const resolveFlowerPhaseVariant = (
    value,
    variantCount = DEFAULT_FLOWER_PHASE_VARIANTS,
) => {
    const count = Math.max(1, Math.floor(Number(variantCount) || DEFAULT_FLOWER_PHASE_VARIANTS));
    return (resolveFlowerPhaseBucket(value, count) / count) * TAU;
};
