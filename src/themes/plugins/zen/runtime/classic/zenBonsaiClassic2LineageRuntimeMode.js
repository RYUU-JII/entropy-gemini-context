import {
    ZEN_BONSAI_CLASSIC2_WOOD_CLOCK_POLICIES,
} from '../../model/classic2/ZenBonsaiClassic2DevelopmentModel.js';

export const ZEN_BONSAI_CLASSIC2_LINEAGE_RUNTIME_MODES = Object.freeze({
    DURABLE_MAIN: 'durable_main',
    EPHEMERAL_PREVIEW: 'ephemeral_preview',
});

export const requireZenBonsaiClassic2LineageRuntimeMode = (value) => {
    if (Object.values(ZEN_BONSAI_CLASSIC2_LINEAGE_RUNTIME_MODES).includes(value)) {
        return value;
    }
    throw new Error('ZEN_BONSAI_CLASSIC2_LINEAGE_RUNTIME_MODE_INVALID');
};

export const resolveZenBonsaiClassic2WoodClockPolicyForLineageMode = (value) => {
    const mode = requireZenBonsaiClassic2LineageRuntimeMode(value);
    return mode === ZEN_BONSAI_CLASSIC2_LINEAGE_RUNTIME_MODES.EPHEMERAL_PREVIEW
        ? ZEN_BONSAI_CLASSIC2_WOOD_CLOCK_POLICIES.EPHEMERAL_SCRUB
        : ZEN_BONSAI_CLASSIC2_WOOD_CLOCK_POLICIES.PERSISTED_HISTORY;
};
