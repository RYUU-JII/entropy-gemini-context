import { clamp as clampValue } from '../../model/koi/koiMotion.js';
import { toRgbHex } from '../../runtime/zenColorMath.js';

const PIXI_KOI_SLOT_VISUAL_PROFILES = Object.freeze({
    hero: Object.freeze({
        scale: 1.08,
        baseTintColor: toRgbHex(226, 219, 202),
        baseTintMix: 0.04,
        highlightTintColor: toRgbHex(244, 236, 214),
        highlightTintMix: 0.08,
        shadeTintColor: toRgbHex(48, 45, 40),
        shadeTintMix: 0.03,
        shadeAlpha: 0.96,
        highlightAlpha: 1.08,
        shadowOpacity: 1.02,
        shadowScale: 1.01,
    }),
    guardian: Object.freeze({
        scale: 1.03,
        baseTintColor: toRgbHex(194, 184, 158),
        baseTintMix: 0.06,
        highlightTintColor: toRgbHex(214, 203, 178),
        highlightTintMix: 0.05,
        shadeTintColor: toRgbHex(82, 68, 49),
        shadeTintMix: 0.08,
        shadeAlpha: 1.12,
        highlightAlpha: 0.94,
        shadowOpacity: 1.16,
        shadowScale: 1.03,
    }),
    resident: Object.freeze({
        scale: 1,
        baseTintColor: null,
        baseTintMix: 0,
        highlightTintColor: null,
        highlightTintMix: 0,
        shadeTintColor: null,
        shadeTintMix: 0,
        shadeAlpha: 1,
        highlightAlpha: 1,
        shadowOpacity: 1,
        shadowScale: 1,
    }),
    scout: Object.freeze({
        scale: 0.93,
        baseTintColor: toRgbHex(174, 194, 206),
        baseTintMix: 0.06,
        highlightTintColor: toRgbHex(210, 228, 240),
        highlightTintMix: 0.06,
        shadeTintColor: toRgbHex(36, 49, 64),
        shadeTintMix: 0.06,
        shadeAlpha: 0.9,
        highlightAlpha: 1.04,
        shadowOpacity: 0.9,
        shadowScale: 0.97,
    }),
});

const clampSlotVisualMix = (value) => clampValue(Number(value) || 0, 0, 0.18);

export const blendKoiTint = (sourceTint, targetTint, mixAmount = 0) => {
    const mix = clampSlotVisualMix(mixAmount);
    if (!Number.isFinite(Number(sourceTint)) || !Number.isFinite(Number(targetTint)) || mix <= 0) {
        return sourceTint;
    }
    const source = Number(sourceTint) >>> 0;
    const target = Number(targetTint) >>> 0;
    const sourceR = (source >> 16) & 0xff;
    const sourceG = (source >> 8) & 0xff;
    const sourceB = source & 0xff;
    const targetR = (target >> 16) & 0xff;
    const targetG = (target >> 8) & 0xff;
    const targetB = target & 0xff;
    return toRgbHex(
        sourceR + (targetR - sourceR) * mix,
        sourceG + (targetG - sourceG) * mix,
        sourceB + (targetB - sourceB) * mix,
    );
};

export function resolvePixiKoiSlotVisualProfile(slot) {
    if (typeof slot !== 'string') return PIXI_KOI_SLOT_VISUAL_PROFILES.resident;
    const normalized = slot.trim().toLowerCase();
    return PIXI_KOI_SLOT_VISUAL_PROFILES[normalized] || PIXI_KOI_SLOT_VISUAL_PROFILES.resident;
}

export const resolveKoiLightingVisuals = ({
    sharedLightState = null,
    fishInfo = null,
    slotVisualProfile,
    roleVisualBlend = 1,
} = {}) => {
    const profile = slotVisualProfile || PIXI_KOI_SLOT_VISUAL_PROFILES.resident;
    const daylight = clampValue(Number(sharedLightState?.daylight) || 0.5, 0, 1);
    const fishBaseTint = Number.isFinite(Number(sharedLightState?.fishBaseTint))
        ? Number(sharedLightState.fishBaseTint)
        : toRgbHex(
            102 + daylight * 142,
            106 + daylight * 138,
            116 + daylight * 132,
        );
    const fishHighlightTint = Number.isFinite(Number(sharedLightState?.fishHighlightTint))
        ? Number(sharedLightState.fishHighlightTint)
        : toRgbHex(
            136 + daylight * 118,
            142 + daylight * 112,
            150 + daylight * 106,
        );
    const fishOpacity = clampValue(
        Number.isFinite(Number(fishInfo?.opacity)) ? Number(fishInfo.opacity) : 1,
        0,
        1,
    );
    const roleBaseTint = blendKoiTint(
        fishBaseTint,
        profile.baseTintColor,
        profile.baseTintMix * roleVisualBlend,
    );
    const roleHighlightTint = blendKoiTint(
        fishHighlightTint,
        profile.highlightTintColor,
        profile.highlightTintMix * roleVisualBlend,
    );
    return { fishOpacity, roleBaseTint, roleHighlightTint };
};
