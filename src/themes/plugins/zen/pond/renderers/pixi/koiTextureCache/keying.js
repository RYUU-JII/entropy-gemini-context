import {
    BODY_PIPELINE_SIGNATURE,
    SHADOW_PIPELINE_SIGNATURE,
    VISUAL_TUNING_FIELDS,
    toStableValue,
} from './shared.js';

export const buildVisualTuningSignature = (tuning) => {
    const source = tuning && typeof tuning === 'object' ? tuning : {};
    const tokens = [];
    for (let i = 0; i < VISUAL_TUNING_FIELDS.length; i += 1) {
        const key = VISUAL_TUNING_FIELDS[i];
        tokens.push(`${key}:${toStableValue(source[key])}`);
    }
    return tokens.join(',');
};

export const resolveShadowProfileForTexture = (shadowProfile = null) => {
    const profile = shadowProfile || {};
    return {
        enabled: profile.enabled !== false,
        blur: Math.max(0, Math.floor(Number(profile.blur) || 0)),
        opacity: (() => {
            const value = Number(profile.opacity);
            if (!Number.isFinite(value)) return 0.2;
            return Math.max(0, Math.min(1, value));
        })(),
        scale: (() => {
            const value = Number(profile.scale);
            if (!Number.isFinite(value)) return 0.9;
            return Math.max(0.7, Math.min(1.1, value));
        })(),
        includeFins: true,
    };
};

export const generateKey = (fishInfo = {}) => {
    const {
        baseSize,
        colorBody,
        colorPattern,
        colorSecondary,
        colorAccent,
        colorFin,
        colorTail,
        palette,
        variant,
        finStyle,
        patternStyle,
        patternSignature,
        dynamicFaviconColors,
        scaleType,
        doitsuMode,
        isGinrin,
        historyLength,
        tuning,
    } = fishInfo;
    const tuningSignature = buildVisualTuningSignature(tuning);
    return [
        baseSize,
        historyLength,
        colorBody,
        colorPattern,
        colorSecondary,
        colorAccent,
        colorFin,
        colorTail,
        palette?.name,
        variant,
        finStyle,
        patternStyle,
        patternSignature || '',
        scaleType,
        doitsuMode,
        isGinrin,
        dynamicFaviconColors ? 'dyn' : 'static',
        tuningSignature,
        BODY_PIPELINE_SIGNATURE,
    ].join('|');
};

export const generateShadowKey = (fishInfo = {}) => [
    fishInfo.baseSize, fishInfo.historyLength, fishInfo.variant, fishInfo.finStyle,
    buildVisualTuningSignature(fishInfo.tuning),
    SHADOW_PIPELINE_SIGNATURE,
].join('|');
