import { parseHexColorSafe } from './appearance/colorMath.js';
import {
    areKoiAppearanceProfilesEqual,
    createCanonicalKoiAppearance,
    normalizeKoiAppearanceProfile,
    resolveKoiAppearanceSeed,
} from './koiAppearanceCore.js';

const koiFishAppearanceMethods = {
normalizeAppearanceProfile(profile) {
    return normalizeKoiAppearanceProfile(profile);
},

setAppearanceProfile(profile) {
    const normalized = normalizeKoiAppearanceProfile(profile);
    const prev = this.appearanceProfile;
    if (areKoiAppearanceProfilesEqual(prev, normalized)) return;
    if (!prev && !normalized) return;

    this.appearanceProfile = normalized;
    this.styleInitialized = false;
    this.updateColor();
},

setFinAndTailColor(sourceColor) {
    const fallback = parseHexColorSafe(
        this.palette ? this.palette.fin : '#FFFFFF',
        '#FFFFFF',
    ).hex;
    const nextColor = parseHexColorSafe(sourceColor, fallback).hex;
    this.colorFin = nextColor;
    this.colorTail = nextColor;
},

initStyle(force = false) {
    const sKey = this.status === 'blocked' ? 'blocked' : 'safe';
    if (!force && this.styleInitialized && this.styleStatus === sKey) return;

    const profile = this.appearanceProfile;
    const hasProfileSeed = Number.isFinite(Number(profile?.seed));
    const seed = resolveKoiAppearanceSeed({
        profile,
        domain: this.domain,
        statusKey: sKey,
        flowSeed: this.flowSeed,
        hashString: (value) => this.hashString(value),
        randomFn: Math.random,
    });

    this.styleRng = this.makeRng(seed);
    this.styleStatus = sKey;
    this.styleInitialized = true;

    const appearance = createCanonicalKoiAppearance({
        profile,
        seed,
        rng: this.styleRng,
    });

    this.variant = appearance.variant;
    this.palette = appearance.palette;
    this.dynamicFaviconColors = appearance.dynamicFaviconColors;
    this.appearanceResolverMeta = appearance.appearanceResolverMeta;
    this.scaleType = appearance.scaleType;
    this.doitsuMode = appearance.doitsuMode;
    this.isGinrin = appearance.isGinrin;
    this.ginrinDensity = appearance.ginrinDensity;
    this.colorBody = appearance.colorBody;
    this.colorPattern = appearance.colorPattern;
    this.colorSecondary = appearance.colorSecondary;
    this.colorAccent = appearance.colorAccent;
    this.colorFin = appearance.colorFin;
    this.colorTail = appearance.colorTail;
    this.eyeColor = appearance.eyeColor;
    this.finStyle = appearance.finStyle;
    this.patternStyle = appearance.patternStyle;
    this.patternMarks = appearance.patternMarks;
    this.patternSignature = appearance.patternSignature;
    this.patternCandidateCount = appearance.patternCandidateCount;
    this.patternBlueprintMeta = appearance.patternBlueprintMeta;
    this._patternMarksSortedSource = null;
    this._patternMarksSorted = null;

    if (hasProfileSeed) {
        this.appearanceProfile = appearance.resolvedProfile;
    }
},

updateColor() {
    this.initStyle();
    const activeColors = this.dynamicFaviconColors || null;
    this.setFinAndTailColor(activeColors?.fin || this.palette?.fin);
    Object.assign(this, {
        colorBody: activeColors?.body || this.palette.body,
        colorPattern: activeColors?.pattern || this.palette.pattern,
        colorSecondary: activeColors
            ? (activeColors.secondary || null)
            : (this.palette.secondary || null),
        colorAccent: activeColors?.accent || this.palette.accent,
        eyeColor: this.palette.eye || '#2E2E2E',
        patternIntensity: 0.65 + Math.min(0.25, this.risk * 0.2),
        aggression: 0,
    });
}
};

export { koiFishAppearanceMethods };
