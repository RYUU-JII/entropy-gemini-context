import {
    mixHex,
    normalizeHexColor,
} from './appearance/colorMath.js';

export const CANONICAL_KOI_BODY_MATERIAL_MIX = Object.freeze({
    headHighlight: 0.2,
    tailShade: 0.1,
});

export function resolveCanonicalKoiBodyMaterialTones(bodyColor) {
    const body = normalizeHexColor(bodyColor);
    if (!body) {
        throw new Error(`ZEN_KOI_BODY_MATERIAL_COLOR_INVALID:${String(bodyColor)}`);
    }

    return Object.freeze({
        body,
        headHighlight: mixHex(
            body,
            '#FFFFFF',
            CANONICAL_KOI_BODY_MATERIAL_MIX.headHighlight,
        ),
        tailShade: mixHex(
            body,
            '#000000',
            CANONICAL_KOI_BODY_MATERIAL_MIX.tailShade,
        ),
    });
}
