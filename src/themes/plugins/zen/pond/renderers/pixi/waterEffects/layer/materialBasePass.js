import { clamp as clampValue } from '../../../../model/koi/koiMotion.js';

export const applyWaterMaterialBaseStatePass = ({
    causticGate,
    cloudReflectionComputeEnabled,
    atmosphereGate,
    causOp,
    causticResponse,
    causticLayerGain,
    sunlightIntensity,
    daylightCurve,
    causticDensityGain,
    stagedCausticGate,
    causticLayerPrimary,
    causticLayerSecondary,
    unifiedWaveEnergy,
    unifiedRoughness,
    temporalFlowTransport,
    unifiedTransmittance,
    unifiedTurbidity,
    benthicGate,
    unifiedBottomVisibility,
    pebbleOpacityScale,
    stagedBenthicGate,
    pebbleSprite,
    pebbleDetailSprite,
    unifiedBottomContrast,
}) => {
    const needsCausticSignal = (
        causticGate > 0
        || cloudReflectionComputeEnabled
        || atmosphereGate > 0
    );
    const layerAlphaScale = needsCausticSignal ? causOp * causticResponse * causticLayerGain : 0;
    const causticPerceptual = needsCausticSignal
        ? layerAlphaScale / (1 + layerAlphaScale * 0.85)
        : 0;
    const sunForCaustics = clampValue(sunlightIntensity, 0, 1.35);
    if (causticGate > 0) {
        const causticVisibility = Math.pow(daylightCurve, 0.92);
        const causticFocus = clampValue(
            (0.72
                + unifiedWaveEnergy * 0.36
                + (1 - unifiedRoughness) * 0.2
                + temporalFlowTransport * 0.14)
            * (0.74 + unifiedTransmittance * 0.34)
            * (1 - unifiedTurbidity * 0.16),
            0.52,
            1.42,
        );
        causticLayerPrimary.alpha = clampValue(
            0.42 * sunForCaustics * causticPerceptual * causticDensityGain * causticVisibility * causticFocus,
            0,
            0.95,
        ) * stagedCausticGate * causticGate;
        causticLayerSecondary.alpha = clampValue(
            0.15
            * sunForCaustics
            * causticPerceptual
            * causticDensityGain
            * causticVisibility
            * (0.88 + causticFocus * 0.12),
            0,
            0.42,
        ) * stagedCausticGate * causticGate;
    } else {
        causticLayerPrimary.alpha = 0;
        causticLayerSecondary.alpha = 0;
    }

    if (benthicGate > 0) {
        // Opacity describes a submerged material receiver. Illumination belongs
        // to the shared live material pass and cannot hide the geometry first.
        const benthicMediumVisibility = clampValue(unifiedBottomVisibility, 0, 1);
        const pebbleBaseAlpha = clampValue(
            0.7 * benthicMediumVisibility,
            0,
            1.0,
        );
        pebbleSprite.alpha = clampValue(
            pebbleBaseAlpha
            * pebbleOpacityScale,
            0,
            1.0,
        ) * stagedBenthicGate * benthicGate;
        pebbleDetailSprite.alpha = clampValue(
            pebbleSprite.alpha
            * 0.6
            * (0.56 + unifiedBottomContrast * 0.44),
            0,
            0.55,
        );
    } else {
        pebbleSprite.alpha = 0;
        pebbleDetailSprite.alpha = 0;
    }

    return {
        causticPerceptual,
        causticPrimaryAlpha: causticLayerPrimary.alpha,
        causticSecondaryAlpha: causticLayerSecondary.alpha,
        pebbleAlpha: pebbleSprite.alpha,
        pebbleDetailAlpha: pebbleDetailSprite.alpha,
        sunForCaustics,
    };
};
