import {
    createZenBonsaiActivationPresentation,
} from '../../model/bonsai/presentation/ZenBonsaiActivationPresentation.js';
import {
    normalizeZenBonsaiLifeState,
} from '../../model/ZenBonsaiLifeState.js';
import {
    ZEN_BONSAI_CULTIVATION_LEDGER_POLICIES,
    ZEN_BONSAI_PRESENTATION_MODES,
} from '../../model/ZenBonsaiPresentationPolicy.js';
import {
    BUILD_INCLUDE_DEBUG_TOOLS,
} from '../../../../../platform/build/releaseCapabilities.js';

const hasLifePreview = (input) => (
    input !== null
    && typeof input === 'object'
    && Object.prototype.hasOwnProperty.call(input, 'bonsaiDebugLifePreview')
);

const requireLifePreviewPercent = (value, min, code) => {
    if (value === null) return null;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > 100) {
        throw new Error(code);
    }
    return Number(value.toFixed(2));
};

const requireLifePreviewBaseState = (candidate) => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
        throw new Error('ZEN_BONSAI_DEBUG_LIFE_PREVIEW_BASE_REQUIRED');
    }
    if (!['seedling', 'juvenile', 'mature'].includes(candidate.phase)) {
        throw new Error('ZEN_BONSAI_DEBUG_LIFE_PREVIEW_BASE_INVALID:phase');
    }
    for (const field of [
        'growth',
        'vitality',
        'stress',
        'bloom',
        'dryness',
        'branchSag',
        'windResponse',
        'analysisConfidence',
    ]) {
        const value = candidate[field];
        const min = field === 'growth' ? 0.5 : 0;
        if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > 1) {
            throw new Error(`ZEN_BONSAI_DEBUG_LIFE_PREVIEW_BASE_INVALID:${field}`);
        }
    }
    if (!Number.isInteger(candidate.dataDays) || candidate.dataDays < 0) {
        throw new Error('ZEN_BONSAI_DEBUG_LIFE_PREVIEW_BASE_INVALID:dataDays');
    }
    return Object.freeze(normalizeZenBonsaiLifeState(candidate));
};

const requireLifePreviewValues = (preview) => {
    if (!preview || typeof preview !== 'object' || Array.isArray(preview)) {
        throw new Error('ZEN_BONSAI_DEBUG_LIFE_PREVIEW_INVALID');
    }
    const growthPercent = requireLifePreviewPercent(
        preview.growthPercent,
        50,
        'ZEN_BONSAI_DEBUG_GROWTH_FORCE_INVALID',
    );
    const bloomPercent = requireLifePreviewPercent(
        preview.bloomPercent,
        0,
        'ZEN_BONSAI_DEBUG_BLOOM_FORCE_INVALID',
    );
    if (growthPercent === null && bloomPercent === null) {
        throw new Error('ZEN_BONSAI_DEBUG_LIFE_PREVIEW_EMPTY');
    }
    const baseLifeState = requireLifePreviewBaseState(preview.baseLifeState);
    return Object.freeze({ growthPercent, bloomPercent, baseLifeState });
};

export const projectZenBonsaiDebugLifecycleInput = (
    liveInput,
    { growthPercent = null, bloomPercent = null, baseLifeState = null } = {},
) => {
    if (!liveInput || typeof liveInput !== 'object' || Array.isArray(liveInput)) {
        throw new Error('ZEN_BONSAI_DEBUG_LIFECYCLE_INPUT_REQUIRED');
    }
    if (growthPercent === null && bloomPercent === null) {
        return liveInput;
    }
    if (!BUILD_INCLUDE_DEBUG_TOOLS) {
        throw new Error('ZEN_BONSAI_DEBUG_LIFE_PREVIEW_DISABLED');
    }
    if (liveInput.bonsaiPresentationMode === ZEN_BONSAI_PRESENTATION_MODES.FIRST_VISION) {
        throw new Error('ZEN_BONSAI_DEBUG_LIFE_PREVIEW_FIRST_VISION_FORBIDDEN');
    }
    const preview = requireLifePreviewValues({ growthPercent, bloomPercent, baseLifeState });
    return {
        ...liveInput,
        bonsaiPresentationMode: ZEN_BONSAI_PRESENTATION_MODES.DEBUG_PROGRESSION_PREVIEW,
        bonsaiCultivationLedgerPolicy: ZEN_BONSAI_CULTIVATION_LEDGER_POLICIES.READ_ONLY,
        bonsaiDebugLifePreview: preview,
    };
};

export const resolveZenBonsaiDebugLifePreview = (liveLifeState, input) => {
    if (!hasLifePreview(input)) {
        return liveLifeState;
    }
    if (!BUILD_INCLUDE_DEBUG_TOOLS) {
        throw new Error('ZEN_BONSAI_DEBUG_LIFE_PREVIEW_DISABLED');
    }
    if (
        input.bonsaiPresentationMode !== ZEN_BONSAI_PRESENTATION_MODES.DEBUG_PROGRESSION_PREVIEW
        || input.bonsaiCultivationLedgerPolicy !== ZEN_BONSAI_CULTIVATION_LEDGER_POLICIES.READ_ONLY
    ) {
        throw new Error('ZEN_BONSAI_DEBUG_LIFE_PREVIEW_CONTRACT_INVALID');
    }
    const preview = requireLifePreviewValues(input.bonsaiDebugLifePreview);
    return normalizeZenBonsaiLifeState({
        ...preview.baseLifeState,
        ...(preview.growthPercent === null ? {} : { growth: preview.growthPercent / 100 }),
        ...(preview.bloomPercent === null ? {} : { bloom: preview.bloomPercent / 100 }),
    });
};

const requirePercent = (value, code) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0 || numeric > 100) {
        throw new Error(code);
    }
    return Number(numeric.toFixed(2));
};

export const resolveZenBonsaiDebugForcedActivationPresentation = (
    livePresentation = null,
    forcedActivationPercent = null,
) => {
    if (forcedActivationPercent === null) {
        return livePresentation;
    }
    const activationPercent = requirePercent(
        forcedActivationPercent,
        'ZEN_BONSAI_DEBUG_ACTIVATION_FORCE_INVALID',
    );
    return createZenBonsaiActivationPresentation({
        ratio: activationPercent / 100,
        reliability: 1,
    });
};
