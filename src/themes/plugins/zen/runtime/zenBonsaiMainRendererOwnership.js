export const ZEN_BONSAI_MAIN_RENDER_OWNERS = Object.freeze({
    HOME_WORKER: 'home_worker',
    LAB_PREVIEW: 'lab_preview',
});

const ZEN_BONSAI_MAIN_RENDER_OWNER_VALUES = new Set(
    Object.values(ZEN_BONSAI_MAIN_RENDER_OWNERS),
);

export const requireZenBonsaiMainRenderOwner = (value) => {
    if (!ZEN_BONSAI_MAIN_RENDER_OWNER_VALUES.has(value)) {
        throw new Error(`ZEN_BONSAI_MAIN_RENDER_OWNER_INVALID:${String(value || 'missing')}`);
    }
    return value;
};
