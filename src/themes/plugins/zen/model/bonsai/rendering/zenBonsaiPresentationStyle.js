/**
 * Zen bonsai presentation styles.
 *
 * Two ways of painting one tree. `ink` is the sumi reading — near-monochrome,
 * dry brush, paper. `natural` keeps the tree in the world the pond already
 * lives in: wood has its own colour, the brush is loaded, and the surface
 * treatment recedes to a whisper.
 *
 * This is a *paint-time* seam, deliberately. The render plan, its command
 * stream and its signature are identical under both styles, because the plan
 * describes a tree — a centreline, a width, how dry the wood is — and never
 * how that description is marked down. One plan, one bake, two readings, and a
 * switch that costs nothing at runtime and survives the move to Pixi.
 *
 * Colour is what makes this possible: the command stream carries neutral ink
 * *values*, and every hue comes from the tint at paint time. A style is
 * therefore a small profile — how far the light carries, what albedo the wood
 * contributes, which brush lays it down — rather than a second palette.
 *
 * Per the Zen theme protocol this is a style within `zen`, not a theme of its
 * own: the canonical theme IDs are closed, and a presentation variant belongs
 * in its own named seam rather than widening that set.
 */

export const ZEN_BONSAI_PRESENTATION_STYLES = Object.freeze({
    INK: 'ink',
    NATURAL: 'natural',
});

export const DEFAULT_ZEN_BONSAI_PRESENTATION_STYLE = ZEN_BONSAI_PRESENTATION_STYLES.NATURAL;

const PROFILES = Object.freeze({
    [ZEN_BONSAI_PRESENTATION_STYLES.INK]: Object.freeze({
        id: ZEN_BONSAI_PRESENTATION_STYLES.INK,
        label: '수묵',
        // How far a colour travels from its neutral value toward the scene's
        // light. Ink has no local colour of its own, so the light carries far.
        tintStrength: 0.58,
        accentTintStrength: 0.26,
        // Ink is pigment on paper: no albedo, and the blossoms stay 담채.
        woodAlbedo: null,
        accentSaturation: 1,
        // Bristle bands, dry-brush breakup, wet bleed.
        brush: 'ink',
        paperStrength: 1,
        canopyWashScale: 1,
    }),
    [ZEN_BONSAI_PRESENTATION_STYLES.NATURAL]: Object.freeze({
        id: ZEN_BONSAI_PRESENTATION_STYLES.NATURAL,
        label: '실경',
        // Wood keeps most of itself and the light only modulates it, which is
        // also what lets the tree sit beside a pond rendered the same way.
        tintStrength: 0.3,
        accentTintStrength: 0.13,
        // Cherry bark. Applied as an albedo — multiplied against the light and
        // normalized to its own luminance — so it shifts hue without darkening.
        woodAlbedo: '#8A6A52',
        accentSaturation: 1.5,
        // A loaded brush: no breakup, no bleed, roundness across the width.
        brush: 'natural',
        // Enough grain to keep sky, tree and bed reading as one surface, far
        // short of paper.
        paperStrength: 0.2,
        canopyWashScale: 0.45,
    }),
});

const STYLE_VALUES = new Set(Object.values(ZEN_BONSAI_PRESENTATION_STYLES));

export const requireZenBonsaiPresentationStyle = (styleId) => {
    if (!STYLE_VALUES.has(styleId)) {
        throw new Error(`ZEN_BONSAI_PRESENTATION_STYLE_INVALID:${String(styleId)}`);
    }
    return styleId;
};

/**
 * Resolves a style profile. An absent style is the default; an unknown one is
 * an error, because silently painting the wrong reading is worse than failing.
 */
export const resolveZenBonsaiPresentationStyle = (styleId) => {
    if (styleId === null || styleId === undefined || styleId === '') {
        return PROFILES[DEFAULT_ZEN_BONSAI_PRESENTATION_STYLE];
    }
    return PROFILES[requireZenBonsaiPresentationStyle(styleId)];
};

export const listZenBonsaiPresentationStyles = () => Object.freeze(
    Object.values(PROFILES),
);

export default resolveZenBonsaiPresentationStyle;
