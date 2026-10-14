import { clamp as clampValue } from '../../model/koi/koiMotion.js';
import { resolvePixiKoiSlotVisualProfile } from './koiFishVisuals.js';

const KOI_MATERIAL_ALPHA_EPSILON = 1e-4;

// Renderer presentation only: a small night readability floor and the world's
// already cloud/phase-attenuated moonlight. This never feeds solar or shadows.
export const resolveZenKoiMoonlightPresence = ({ nightDepth, moonlight }) => {
    for (const [field, value] of [['nightDepth', nightDepth], ['moonlight', moonlight]]) {
        if (!Number.isFinite(value) || value < 0 || value > 1) {
            throw new Error(`ZEN_KOI_MOONLIGHT_CHANNEL_REQUIRED:${field}`);
        }
    }
    return nightDepth * (0.16 + Math.sqrt(moonlight) * 0.6);
};

const toFiniteNumber = (value, fallback = 0) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
};

const formatMaterialNumber = (value, digits = 4, fallback = 'na') => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric.toFixed(digits) : fallback;
};

const formatMaterialTint = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? String(numeric >>> 0) : 'na';
};

const resolveMaterialOpacity = (fishInfo = null) => {
    const opacity = Number(fishInfo?.opacity);
    return clampValue(Number.isFinite(opacity) ? opacity : 1, 0, 1);
};

const roundDiagnosticNumber = (value, digits = 4, fallback = 0) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Number(numeric.toFixed(digits));
};

export const resolvePixiKoiShadowLightingState = (frameChannels) => {
    const directStrength = frameChannels?.shadowLight?.directStrength;
    const bottomVisibility = frameChannels?.bottomVisibility;
    if (!Number.isFinite(directStrength) || directStrength < 0 || directStrength > 1) {
        throw new Error('ZEN_PIXI_KOI_SHADOW_LIGHT_REQUIRED');
    }
    if (!Number.isFinite(bottomVisibility) || bottomVisibility < 0 || bottomVisibility > 1) {
        throw new Error('ZEN_PIXI_KOI_SHADOW_BOTTOM_VISIBILITY_REQUIRED');
    }
    // The environment has already resolved sun elevation and cloud occlusion.
    // Water visibility is a receiver material response, not another weather curve.
    const waterVisibility = 0.5 + bottomVisibility * 0.5;
    return {
        directStrength,
        bottomVisibility,
        waterVisibility,
        alphaFactor: directStrength * waterVisibility,
    };
};

export const resolvePixiKoiNaturalShadowOpacity = ({
    shadowProfile = null,
    slotVisualProfile = null,
    roleVisualBlend = 1,
    sharedShadowLightState = null,
    target = null,
} = {}) => {
    const profile = shadowProfile && typeof shadowProfile === 'object'
        ? shadowProfile
        : {};
    const slotProfile = slotVisualProfile && typeof slotVisualProfile === 'object'
        ? slotVisualProfile
        : {};
    const lightingState = sharedShadowLightState;
    if (!Number.isFinite(lightingState?.alphaFactor)
        || lightingState.alphaFactor < 0 || lightingState.alphaFactor > 1) {
        throw new Error('ZEN_PIXI_KOI_SHADOW_LIGHT_REQUIRED');
    }
    const blur = Math.max(0, Number(profile.blur) || 0);
    const blurOpacityAttenuation = clampValue(1 - (blur * 0.04), 0.72, 1);
    const slotShadowOpacity = Number(slotProfile.shadowOpacity);
    const roleOpacity = 1 + ((Number.isFinite(slotShadowOpacity) ? slotShadowOpacity : 1) - 1) * roleVisualBlend;
    const profileOpacity = Number(profile.opacity);
    const baseOpacity = clampValue(Number.isFinite(profileOpacity) ? profileOpacity : 0.2, 0, 0.35);
    const alphaFactor = lightingState.alphaFactor;
    const opacity = clampValue(
        baseOpacity * blurOpacityAttenuation * roleOpacity * alphaFactor,
        0,
        0.35,
    );
    const result = target && typeof target === 'object' ? target : {};
    result.opacity = roundDiagnosticNumber(opacity, 5);
    result.alphaFactor = roundDiagnosticNumber(alphaFactor);
    result.blurOpacityAttenuation = roundDiagnosticNumber(blurOpacityAttenuation);
    result.roleOpacity = roundDiagnosticNumber(roleOpacity);
    result.lighting = lightingState;
    return result;
};

export const buildPixiKoiMaterialSignature = ({
    sharedLightState = null,
    fishInfo = null,
    slotVisualProfile = null,
    roleVisualBlend = 1,
    waterMaterial,
} = {}) => {
    const profile = slotVisualProfile || resolvePixiKoiSlotVisualProfile(fishInfo?.slot);
    return [
        fishInfo?.appearanceProfile?.presentationRole ?? 'site',
        formatMaterialNumber(resolveMaterialOpacity(fishInfo), 4, '1.0000'),
        formatMaterialNumber(roleVisualBlend, 4, '1.0000'),
        formatMaterialNumber(waterMaterial?.pigmentGain, 4, 'not_water_material'),
        formatMaterialNumber(sharedLightState?.daylight, 4, 'default'),
        formatMaterialNumber(sharedLightState?.nightDepth, 4, 'default'),
        formatMaterialTint(sharedLightState?.fishBaseTint),
        formatMaterialTint(sharedLightState?.fishHighlightTint),
        formatMaterialTint(profile?.baseTintColor),
        formatMaterialNumber(profile?.baseTintMix, 4, '0.0000'),
        formatMaterialTint(profile?.highlightTintColor),
        formatMaterialNumber(profile?.highlightTintMix, 4, '0.0000'),
    ].join('|');
};

const writeDisplayObjectTint = (target, tint, force = false) => {
    if (!target) return 0;
    const nextTint = Number(tint);
    if (!Number.isFinite(nextTint)) return 0;
    const normalizedTint = nextTint >>> 0;
    if (!force && (Number(target.tint) >>> 0) === normalizedTint) return 0;
    target.tint = normalizedTint;
    return 1;
};

const writeDisplayObjectAlpha = (target, alpha, force = false) => {
    if (!target) return 0;
    const nextAlpha = Number(alpha);
    if (!Number.isFinite(nextAlpha)) return 0;
    if (!force && Math.abs(toFiniteNumber(target.alpha, 1) - nextAlpha) <= KOI_MATERIAL_ALPHA_EPSILON) {
        return 0;
    }
    target.alpha = nextAlpha;
    return 1;
};

export const applyPixiKoiMaterialVisuals = ({
    container = null,
    bodyRope = null,
    finMainL = null,
    finMainR = null,
    finSubL = null,
    finSubR = null,
    tail = null,
} = {}, {
    fishOpacity = 1,
    roleBaseTint = 0xffffff,
    roleHighlightTint = 0xffffff,
} = {}, {
    force = false,
} = {}) => {
    let writeCount = 0;
    writeCount += writeDisplayObjectAlpha(container, fishOpacity, force);
    writeCount += writeDisplayObjectTint(bodyRope, roleBaseTint, force);
    writeCount += writeDisplayObjectTint(finMainL, roleBaseTint, force);
    writeCount += writeDisplayObjectTint(finMainR, roleBaseTint, force);
    writeCount += writeDisplayObjectTint(finSubL, roleBaseTint, force);
    writeCount += writeDisplayObjectTint(finSubR, roleBaseTint, force);
    writeCount += writeDisplayObjectTint(tail, roleBaseTint, force);
    if (bodyRope) writeCount += bodyRope.setHighlightTint(roleHighlightTint);
    return {
        writeCount,
    };
};

export const applyPixiKoiShadowAlpha = (shadowRope, shadowTail, shadowOpacity) => {
    let writeCount = 0;
    writeCount += writeDisplayObjectAlpha(
        shadowRope, shadowOpacity, shadowOpacity === 0 && shadowRope?.alpha !== 0,
    );
    writeCount += writeDisplayObjectAlpha(
        shadowTail, shadowOpacity, shadowOpacity === 0 && shadowTail?.alpha !== 0,
    );
    return {
        writeCount,
    };
};
