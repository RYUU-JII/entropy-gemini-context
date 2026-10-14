import {
    DEFAULT_KOI_COLOR_STRATEGY,
} from '../model/koi/koiFaviconColorProfile.js';
import {
    pickElegantPaletteIndexByRatio,
} from '../model/koi/constants.js';

const normalizeDomain = (value) => {
    if (typeof value !== 'string') return '';
    return value.trim().toLowerCase();
};

const hashStringFNV1a = (value) => {
    let hash = 2166136261;
    const input = String(value || '');
    for (let index = 0; index < input.length; index += 1) {
        hash ^= input.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
};

const resolvePaletteIndexFromSeed = (seed) => {
    const seed32 = Number(seed) >>> 0;
    const lcg = (Math.imul(seed32, 1664525) + 1013904223) >>> 0;
    return pickElegantPaletteIndexByRatio(lcg / 4294967296);
};

export const buildZenKoiDomainAppearanceIdentity = (domain) => {
    const domainKey = normalizeDomain(domain);
    if (!domainKey) return null;
    const seed = hashStringFNV1a(domainKey);
    return {
        seed,
        paletteIndex: resolvePaletteIndexFromSeed(seed),
        appearanceMode: DEFAULT_KOI_COLOR_STRATEGY,
    };
};

export {
    hashStringFNV1a as hashZenKoiDomainAppearanceIdentity,
};
