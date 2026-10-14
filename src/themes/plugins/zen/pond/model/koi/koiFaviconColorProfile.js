export {
    normalizeColorMix,
    hashColorMix,
    extractFaviconColorMixFromDataUrl,
} from './appearance/faviconPaletteExtractor.js';

export {
    buildDirectKoiColorsFromColorMix as buildKoiColorsFromColorMix,
} from './appearance/directColorMapper.js';

export {
    KOI_APPEARANCE_RESOLVER_VERSION,
    KOI_COLOR_STRATEGIES,
    DEFAULT_KOI_COLOR_STRATEGY,
    normalizeKoiColorStrategy,
    resolveKoiAppearanceVisualProfile,
} from './appearance/appearanceResolver.js';
