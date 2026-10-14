import { useCallback, useMemo } from 'react';
import {
    SAKURA_CANONICAL_LATENT_DEFS,
    validateSakuraLatent,
} from '../../model/v2/SakuraLatentSchema';
import {
    LATENT_STYLE_PRESETS_BY_AXIS,
    resolveLatentPresetTolerance,
} from '../../model/ZenLatentControlsConfig';

const createZenLatentControlError = (
    code = 'ZEN_LATENT_CONTROL_STATE_INVALID',
    message = 'Zen latent control state is invalid.',
    details = null,
    cause = null,
) => {
    const error = new Error(message);
    error.code = code;
    if (details && typeof details === 'object') {
        error.details = details;
    }
    if (cause) {
        error.cause = cause;
    }
    return error;
};

const requireZenLatentControlLatent = (
    latent,
    {
        code = 'ZEN_LATENT_CONTROL_LATENT_INVALID',
        label = 'Zen latent control latent',
        details = null,
    } = {},
) => {
    try {
        return validateSakuraLatent(latent, {
            code,
            label,
            details,
        });
    } catch (error) {
        throw createZenLatentControlError(
            error?.code || code,
            error?.message || `${label} is invalid.`,
            details,
            error,
        );
    }
};

export function useZenLatentControlController({
    sakuraV2Latent = null,
    commitSakuraV2Latent = null,
} = {}) {
    const canonicalLatent = useMemo(() => requireZenLatentControlLatent(sakuraV2Latent, {
        label: 'Zen latent control current latent',
        details: {
            field: 'sakuraV2Latent',
        },
    }), [sakuraV2Latent]);

    const handleBranchDetailControlChange = useCallback((key, rawValue) => {
        if (typeof commitSakuraV2Latent !== 'function') {
            return;
        }
        const def = SAKURA_CANONICAL_LATENT_DEFS?.[key];
        if (!def) {
            return;
        }
        const numericValue = Number(rawValue);
        if (!Number.isFinite(numericValue)) {
            return;
        }
        const clamped = Math.min(def.max, Math.max(def.min, numericValue));
        const value = def.integer
            ? Math.round(clamped)
            : Number(clamped.toFixed(4));
        commitSakuraV2Latent({
            ...canonicalLatent,
            [key]: value,
        });
    }, [canonicalLatent, commitSakuraV2Latent]);

    const handleApplyLatentAxisPreset = useCallback((axisId, presetId) => {
        if (typeof commitSakuraV2Latent !== 'function') {
            return;
        }
        const axisPresets = LATENT_STYLE_PRESETS_BY_AXIS?.[axisId] || [];
        const targetPreset = axisPresets.find((preset) => preset.id === presetId);
        if (!targetPreset) {
            return;
        }
        commitSakuraV2Latent({
            ...canonicalLatent,
            ...(targetPreset.values || {}),
        });
    }, [canonicalLatent, commitSakuraV2Latent]);

    const activeLatentPresetIds = useMemo(() => {
        const byAxis = {};
        Object.entries(LATENT_STYLE_PRESETS_BY_AXIS).forEach(([axisId, presets]) => {
            const matched = (presets || []).find((preset) => Object.keys(preset?.values || {}).every((key) => (
                Math.abs(
                    Number(canonicalLatent?.[key] ?? 0) - Number(preset?.values?.[key] ?? 0),
                ) <= resolveLatentPresetTolerance(key)
            )));
            byAxis[axisId] = matched?.id || null;
        });
        return byAxis;
    }, [canonicalLatent]);

    return {
        handleBranchDetailControlChange,
        handleApplyLatentAxisPreset,
        activeLatentPresetIds,
    };
}
