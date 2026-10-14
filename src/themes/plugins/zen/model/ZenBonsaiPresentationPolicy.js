const freeze = (value) => Object.freeze(value);

export const ZEN_BONSAI_PRESENTATION_MODES = freeze({
    CURRENT_RUNTIME: 'current_runtime',
    FIRST_VISION: 'first_vision',
    LAB_PREVIEW: 'lab_preview',
    DEBUG_PROGRESSION_PREVIEW: 'debug_progression_preview',
});

export const ZEN_BONSAI_CULTIVATION_LEDGER_POLICIES = freeze({
    WRITE_CURRENT: 'write_current',
    READ_ONLY: 'read_only',
});

const PRESENTATION_MODE_VALUES = new Set(Object.values(ZEN_BONSAI_PRESENTATION_MODES));
const CULTIVATION_LEDGER_POLICY_VALUES = new Set(Object.values(ZEN_BONSAI_CULTIVATION_LEDGER_POLICIES));

export const resolveZenBonsaiPresentationMode = (input = null) => {
    const mode = input?.bonsaiPresentationMode;
    return PRESENTATION_MODE_VALUES.has(mode)
        ? mode
        : ZEN_BONSAI_PRESENTATION_MODES.CURRENT_RUNTIME;
};

export const resolveZenBonsaiCultivationLedgerPolicy = (input = null) => {
    const policy = input?.bonsaiCultivationLedgerPolicy;
    return CULTIVATION_LEDGER_POLICY_VALUES.has(policy)
        ? policy
        : ZEN_BONSAI_CULTIVATION_LEDGER_POLICIES.WRITE_CURRENT;
};

export const isZenBonsaiFirstVisionPresentation = (input = null) => (
    resolveZenBonsaiPresentationMode(input) === ZEN_BONSAI_PRESENTATION_MODES.FIRST_VISION
);

export const isZenBonsaiDebugProgressionPreview = (input = null) => (
    resolveZenBonsaiPresentationMode(input)
        === ZEN_BONSAI_PRESENTATION_MODES.DEBUG_PROGRESSION_PREVIEW
);

export const isZenBonsaiLabPreview = (input = null) => (
    resolveZenBonsaiPresentationMode(input) === ZEN_BONSAI_PRESENTATION_MODES.LAB_PREVIEW
);

export const isZenBonsaiEphemeralPresentationScene = (input = null) => (
    isZenBonsaiFirstVisionPresentation(input)
    || isZenBonsaiLabPreview(input)
    || isZenBonsaiDebugProgressionPreview(input)
);

export const shouldUseZenBonsaiCultivationLedger = (input = null) => (
    resolveZenBonsaiCultivationLedgerPolicy(input) === ZEN_BONSAI_CULTIVATION_LEDGER_POLICIES.WRITE_CURRENT
    && resolveZenBonsaiPresentationMode(input) === ZEN_BONSAI_PRESENTATION_MODES.CURRENT_RUNTIME
);
