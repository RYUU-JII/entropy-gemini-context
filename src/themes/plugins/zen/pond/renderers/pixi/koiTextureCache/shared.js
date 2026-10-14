import {
  MIPMAP_MODES,
  SCALE_MODES,
} from '@/themes/plugins/zen/pond/renderers/pixi/zenPondPixiRuntime.js';

export const MAX_CACHE_ENTRIES = 220;
export const MAX_SHADOW_CACHE_ENTRIES = 220;
export const MAX_CANVAS_EDGE = 8192;
export const FALLBACK_FISH_SIZE = 28;
export const KOI_BAKE_RESOLUTION = 1;
export const KOI_BODY_BAKE_RESOLUTION = 1.5;
export const KOI_VOLUME_TEXTURE_RESOLUTION = 1;
export const KOI_VOLUME_INTERNAL_SUPERSAMPLE = 2;
export const KOI_SHADOW_BAKE_RESOLUTION = 1;
export const KOI_SHADOW_INTERNAL_SUPERSAMPLE = 2;

export const KOI_TEXTURE_SAMPLE_OPTIONS = Object.freeze({
    scaleMode: SCALE_MODES.LINEAR,
    mipmap: MIPMAP_MODES.OFF,
    anisotropicLevel: 0,
    resolution: KOI_BAKE_RESOLUTION,
});

export const SHADOW_FIN_ALPHA_BASE = 0.34;
export const SHADOW_FIN_ALPHA_GAIN = 0.44;
export const SHADOW_FIN_ALPHA_FALLBACK = 0.42;
export const SHADOW_ALPHA_MIN = 0.12;
export const SHADOW_ALPHA_MAX = 0.9;
export const SHADOW_TAIL_ALPHA_BAKE_FALLBACK = SHADOW_FIN_ALPHA_FALLBACK;
export const SHADOW_TAIL_SEAM_CLEAR_RADIUS_SIZE_FACTOR = 0.2;
export const SHADOW_TAIL_SEAM_CLEAR_RADIUS_SPACING_FACTOR = 1.05;

export const SHADOW_PIPELINE_SIGNATURE = [
    'packed_coverage_065_3_7_v1',
    'articulated_fin_atlas_v1',
    `fin_base:${SHADOW_FIN_ALPHA_BASE}`,
    `fin_gain:${SHADOW_FIN_ALPHA_GAIN}`,
    `fin_fb:${SHADOW_FIN_ALPHA_FALLBACK}`,
    `alpha_min:${SHADOW_ALPHA_MIN}`,
    `alpha_max:${SHADOW_ALPHA_MAX}`,
    `tail_bake_fb:${SHADOW_TAIL_ALPHA_BAKE_FALLBACK}`,
    `tail_seam_size:${SHADOW_TAIL_SEAM_CLEAR_RADIUS_SIZE_FACTOR}`,
    `tail_seam_spacing:${SHADOW_TAIL_SEAM_CLEAR_RADIUS_SPACING_FACTOR}`,
].join('|');

export const BODY_PIPELINE_SIGNATURE = [
    'body_tail_split',
    'solar_form_material_v1',
    'anatomy_breaks_v1',
    `bake:${KOI_BAKE_RESOLUTION}`,
    `body:${KOI_BODY_BAKE_RESOLUTION}`,
    `volume:${KOI_VOLUME_TEXTURE_RESOLUTION}`,
    `volume_ss:${KOI_VOLUME_INTERNAL_SUPERSAMPLE}`,
].join('|');

export const VISUAL_TUNING_FIELDS = Object.freeze([
    'historyLength',
    'headLen',
    'headWidth',
    'headMin',
    'shoulderMax',
    'shoulderPos',
    'midWidth',
    'midPos',
    'tailWidth',
    'tailCurve',
    'pectoralSize',
    'pectoralWidthScale',
    'pectoralTipRoundness',
    'pectoralLeadingCurvature',
    'pectoralTrailingCurvature',
    'ventralSize',
    'tailFinSize',
    'tailFinSpread',
    'tailFinNotchDepth',
    'tailFinBaseWidth',
    'tailFinRoundness',
    'tailFinEdgeSharpness',
    'tailFinRootOffset',
    'tailFinVeinAlpha',
]);

export const toStableValue = (value) => {
    if (typeof value === 'boolean') return value ? '1' : '0';
    if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
    if (typeof value === 'string') return value;
    if (value === null || value === undefined) return '';
    return String(value);
};

export const toFiniteNumber = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
};

export const toClampedNumber = (value, fallback, min, max) => {
    const resolved = toFiniteNumber(value, fallback);
    return Math.max(min, Math.min(max, resolved));
};

export const toPositiveInt = (value, fallback = 1, min = 1, max = MAX_CANVAS_EDGE) => {
    const resolved = Math.floor(toFiniteNumber(value, fallback));
    const bounded = Number.isFinite(resolved) ? resolved : fallback;
    return Math.max(min, Math.min(max, bounded));
};

export const isFinitePoint = (point) => (
    Boolean(point)
    && Number.isFinite(Number(point.x))
    && Number.isFinite(Number(point.y))
);

export const createLinearGradientSafe = (ctx, x0, y0, x1, y1) => {
    const nx0 = Number(x0);
    const ny0 = Number(y0);
    const nx1 = Number(x1);
    const ny1 = Number(y1);
    if (!Number.isFinite(nx0) || !Number.isFinite(ny0) || !Number.isFinite(nx1) || !Number.isFinite(ny1)) {
        return null;
    }
    return ctx.createLinearGradient(nx0, ny0, nx1, ny1);
};
