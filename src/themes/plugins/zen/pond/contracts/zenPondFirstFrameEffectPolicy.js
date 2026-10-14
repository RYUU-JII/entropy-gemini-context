import {
    normalizeZenRendererDebugToggles,
} from './zenRendererDebugToggles.js';

export const ZEN_POND_FIRST_FRAME_EFFECT_POLICIES = Object.freeze({
    FULL: 'full',
    DEFER_YOONSEUL: 'defer-yoonseul',
});

export const DEFAULT_ZEN_POND_FIRST_FRAME_EFFECT_POLICY =
    ZEN_POND_FIRST_FRAME_EFFECT_POLICIES.FULL;

export const normalizeZenPondFirstFrameEffectPolicy = (
    policy = DEFAULT_ZEN_POND_FIRST_FRAME_EFFECT_POLICY,
) => {
    const normalized = typeof policy === 'string' ? policy.trim().toLowerCase() : '';
    if (!normalized) {
        return DEFAULT_ZEN_POND_FIRST_FRAME_EFFECT_POLICY;
    }
    if (Object.values(ZEN_POND_FIRST_FRAME_EFFECT_POLICIES).includes(normalized)) {
        return normalized;
    }
    throw new Error(`ZEN_POND_FIRST_FRAME_EFFECT_POLICY_UNKNOWN:${String(policy || '')}`);
};

export const shouldDeferZenPondYoonseulForFirstFrame = ({
    firstFrameEffectPolicy = DEFAULT_ZEN_POND_FIRST_FRAME_EFFECT_POLICY,
    firstFrameCommitted = false,
} = {}) => (
    normalizeZenPondFirstFrameEffectPolicy(firstFrameEffectPolicy)
        === ZEN_POND_FIRST_FRAME_EFFECT_POLICIES.DEFER_YOONSEUL
    && firstFrameCommitted !== true
);

export const resolveZenPondFirstFrameRendererDebugToggles = ({
    toggles = null,
    firstFrameEffectPolicy = DEFAULT_ZEN_POND_FIRST_FRAME_EFFECT_POLICY,
    firstFrameCommitted = false,
} = {}) => {
    const normalizedToggles = normalizeZenRendererDebugToggles(toggles);
    if (!shouldDeferZenPondYoonseulForFirstFrame({
        firstFrameEffectPolicy,
        firstFrameCommitted,
    })) {
        return normalizedToggles;
    }

    return normalizeZenRendererDebugToggles({
        ...normalizedToggles,
        yoonseulEnabled: false,
    });
};
