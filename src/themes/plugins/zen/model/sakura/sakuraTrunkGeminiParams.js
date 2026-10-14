const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const SAKURA_TRUNK_GEMINI_LATENT_DEFS = Object.freeze({
    trunk_max_height: { min: 200, max: 500, default: 332, integer: true },
    // Proposal-only compatibility inputs are normalized to these fixed priors
    // before active phenotype compilation. Explicit legacy ablation may still
    // pass their phenotype channels directly to the proposal planner.
    trunk_segments: { min: 30, max: 50, default: 30, integer: true },
    trunk_main_curve: { min: -200, max: 200, default: 0 },
    trunk_wave_freq: { min: 0, max: 6, default: 3.5 },
    trunk_wave_amp: { min: 0, max: 140, default: 40 },
    trunk_roughness: { min: 0, max: 45, default: 20 },
    trunk_phase: { min: 0, max: 20, default: 0 },
});

export const SAKURA_TRUNK_GEMINI_LATENT_KEYS = Object.freeze(
    Object.keys(SAKURA_TRUNK_GEMINI_LATENT_DEFS),
);

export const SAKURA_TRUNK_GEMINI_LEARNING_EXCLUDED_KEYS = Object.freeze(
    [...SAKURA_TRUNK_GEMINI_LATENT_KEYS],
);

export const SAKURA_TRUNK_PROPOSAL_ONLY_LATENT_KEYS = Object.freeze([
    'trunk_segments',
    'trunk_main_curve',
    'trunk_wave_freq',
    'trunk_wave_amp',
    'trunk_roughness',
]);

export const SAKURA_LEARNED_TRUNK_BRIDGE_VERSION = 'learned_trunk_bridge_v2';

const LEARNED_TRUNK_DEFAULTS = Object.freeze({
    trunkCurveAmp: 0.42,
    trunkCurveFreq: 0.86,
});
const PROPOSAL_ONLY_LATENT_KEY_SET = new Set(SAKURA_TRUNK_PROPOSAL_ONLY_LATENT_KEYS);

export const SAKURA_TRUNK_ACTIVE_CONTROLS = Object.freeze([
    { key: 'trunk_max_height', label: 'Max Height' },
    { key: 'trunk_curve_amp', label: 'Curve Amp' },
    { key: 'trunk_curve_freq', label: 'Bend Rhythm' },
    { key: 'backbone_tilt_bias', label: 'Posture' },
    { key: 'backbone_sway', label: 'Lateral Sweep' },
    { key: 'trunk_kink_prob', label: 'Kink Chance' },
    { key: 'trunk_kink_angle_deg', label: 'Kink Angle' },
    { key: 'trunk_phase', label: 'Phase' },
]);

export const SAKURA_TRUNK_ACTIVE_PRESETS = Object.freeze([
    {
        id: 'straight',
        label: 'Straight',
        values: {
            trunk_max_height: 332,
            trunk_curve_amp: 0.12,
            trunk_curve_freq: 0.3,
            backbone_tilt_bias: 0,
            backbone_sway: 0.18,
            trunk_kink_prob: 0.02,
            trunk_kink_angle_deg: 18,
            trunk_phase: 0,
        },
    },
    {
        id: 'curved',
        label: 'Curved',
        values: {
            trunk_max_height: 332,
            trunk_curve_amp: 0.5,
            trunk_curve_freq: 0.86,
            backbone_tilt_bias: 0.18,
            backbone_sway: 0.52,
            trunk_kink_prob: 0.14,
            trunk_kink_angle_deg: 28,
            trunk_phase: 0,
        },
    },
    {
        id: 'kink',
        label: 'Kink',
        values: {
            trunk_max_height: 332,
            trunk_curve_amp: 0.78,
            trunk_curve_freq: 1.45,
            backbone_tilt_bias: 0.28,
            backbone_sway: 0.68,
            trunk_kink_prob: 0.8,
            trunk_kink_angle_deg: 52,
            trunk_phase: 8,
        },
    },
]);

const TRUNK_GEMINI_PHENOTYPE_MAP = Object.freeze({
    trunk_max_height: 'trunkGeminiMaxHeight',
    trunk_segments: 'trunkGeminiSegments',
    trunk_main_curve: 'trunkGeminiMainCurve',
    trunk_wave_freq: 'trunkGeminiWaveFreq',
    trunk_wave_amp: 'trunkGeminiWaveAmp',
    trunk_roughness: 'trunkGeminiRoughness',
    trunk_phase: 'trunkGeminiPhase',
});

const resolveNumericWithDef = (value, def) => {
    const raw = Number.isFinite(Number(value)) ? Number(value) : def.default;
    const clamped = clamp(raw, def.min, def.max);
    return def.integer ? Math.round(clamped) : clamped;
};

export const applySakuraTrunkGeminiLatentToPhenotype = ({
    latent,
    clampByPhenotypeKey,
}) => {
    const direct = SAKURA_TRUNK_GEMINI_LATENT_KEYS.reduce((acc, latentKey) => {
        const phenotypeKey = TRUNK_GEMINI_PHENOTYPE_MAP[latentKey];
        if (!phenotypeKey) {
            return acc;
        }
        const def = SAKURA_TRUNK_GEMINI_LATENT_DEFS[latentKey];
        const sourceValue = PROPOSAL_ONLY_LATENT_KEY_SET.has(latentKey)
            ? def.default
            : latent?.[latentKey];
        const resolved = resolveNumericWithDef(sourceValue, def);
        acc[phenotypeKey] = clampByPhenotypeKey(phenotypeKey, resolved);
        return acc;
    }, {});
    const curveAmp = Number(latent?.trunk_curve_amp);
    const curveFreq = Number(latent?.trunk_curve_freq);
    if (
        !Number.isFinite(curveAmp)
        || !Number.isFinite(curveFreq)
    ) {
        throw new Error('ZEN_SAKURA_LEARNED_TRUNK_LATENT_REQUIRED');
    }

    // "Gemini" is a retained internal family name, not an external model/runtime.
    // Only curve amplitude and rhythm cross this compatibility bridge. Tilt and
    // sway have direct MacroSpineIntent owners and must not be projected into a
    // second legacy force field.
    direct.trunkGeminiWaveFreq = clampByPhenotypeKey(
        'trunkGeminiWaveFreq',
        direct.trunkGeminiWaveFreq
            + ((curveFreq - LEARNED_TRUNK_DEFAULTS.trunkCurveFreq) * 2.8),
    );
    direct.trunkGeminiWaveAmp = clampByPhenotypeKey(
        'trunkGeminiWaveAmp',
        direct.trunkGeminiWaveAmp
            + ((curveAmp - LEARNED_TRUNK_DEFAULTS.trunkCurveAmp) * 96),
    );
    return direct;
};

export const resolveSakuraTrunkGeminiParamsFromGene = (gene = {}) => {
    const maxHeightDef = SAKURA_TRUNK_GEMINI_LATENT_DEFS.trunk_max_height;
    const segmentDef = SAKURA_TRUNK_GEMINI_LATENT_DEFS.trunk_segments;
    const mainCurveDef = SAKURA_TRUNK_GEMINI_LATENT_DEFS.trunk_main_curve;
    const waveFreqDef = SAKURA_TRUNK_GEMINI_LATENT_DEFS.trunk_wave_freq;
    const waveAmpDef = SAKURA_TRUNK_GEMINI_LATENT_DEFS.trunk_wave_amp;
    const roughnessDef = SAKURA_TRUNK_GEMINI_LATENT_DEFS.trunk_roughness;
    const phaseDef = SAKURA_TRUNK_GEMINI_LATENT_DEFS.trunk_phase;
    return {
        maxHeight: resolveNumericWithDef(gene?.trunkGeminiMaxHeight, maxHeightDef),
        segments: resolveNumericWithDef(gene?.trunkGeminiSegments, segmentDef),
        mainCurve: resolveNumericWithDef(gene?.trunkGeminiMainCurve, mainCurveDef),
        waveFreq: resolveNumericWithDef(gene?.trunkGeminiWaveFreq, waveFreqDef),
        waveAmp: resolveNumericWithDef(gene?.trunkGeminiWaveAmp, waveAmpDef),
        roughness: resolveNumericWithDef(gene?.trunkGeminiRoughness, roughnessDef),
        phase: resolveNumericWithDef(gene?.trunkGeminiPhase, phaseDef),
    };
};

export const SAKURA_TRUNK_ROOT_HEADING_RAD = -Math.PI / 2;

export const resolveSakuraTrunkGeminiRootAngle = () => SAKURA_TRUNK_ROOT_HEADING_RAD;

export const resolveSakuraTrunkGeminiSegmentLength = ({
    targetHeight = 320,
    segments = 30,
}) => {
    const safeSegments = Math.max(1, Math.round(Number(segments) || 1));
    const safeHeight = Math.max(1, Number(targetHeight) || 1);
    return safeHeight / safeSegments;
};

export const resolveSakuraTrunkGeminiTaperWidth = ({
    baseWidth = 10,
    segmentIndex = 0,
    segments = 30,
    minWidth = 1,
}) => {
    const safeBaseWidth = Math.max(0, Number(baseWidth) || 0);
    const safeMinWidth = Math.max(0, Number(minWidth) || 0);
    const safeSegments = Math.max(1, Math.round(Number(segments) || 1));
    const safeSegmentIndex = Math.max(0, Math.round(Number(segmentIndex) || 0));

    // Aggressive Taper for the final segments to prevent a blunt ending stump.
    const progress = safeSegmentIndex / safeSegments;
    let taper = Math.max(0, 1 - (safeSegmentIndex / (safeSegments + 5)));

    // If we are in the last 15% of the trunk, taper down more steeply.
    if (progress > 0.85) {
        const endProgress = (progress - 0.85) / 0.15;
        taper *= (1 - (endProgress * 0.8)); // Reduce thickness by up to an additional 80% at the tip
    }

    return Math.max(safeMinWidth, safeBaseWidth * taper);
};

export const resolveSakuraTrunkTaperWidthAtArc = ({
    baseWidth = 10,
    arcNorm = 0,
    minWidth = 1,
}) => {
    const safeBaseWidth = Math.max(0, Number(baseWidth) || 0);
    const safeMinWidth = Math.max(0, Number(minWidth) || 0);
    const progress = clamp(Number(arcNorm) || 0, 0, 1);

    // Taper belongs to the continuous trunk, not to the current tessellation.
    // The 0.86 coefficient preserves the former 30-segment envelope while
    // making the result invariant when adaptive subdivision adds/removes spans.
    let taper = Math.max(0, 1 - (progress * 0.86));
    if (progress > 0.85) {
        const endProgress = (progress - 0.85) / 0.15;
        taper *= (1 - (endProgress * 0.8));
    }

    return Math.max(safeMinWidth, safeBaseWidth * taper);
};
