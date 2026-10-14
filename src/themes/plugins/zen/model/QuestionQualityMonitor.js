const clamp = (value, min, max) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
const clamp01 = (value) => clamp(value, 0, 1);
const round = (value, digits = 4) => Number((Number.isFinite(value) ? value : 0).toFixed(digits));

const QUALITY_WINDOW_SIZE = 24;
const QUALITY_EVENT_LIMIT = 120;
const MIN_ACTIONABLE_SAMPLES = 8;
const LOW_SCALAR_GAP_THRESHOLD = 0.045;
const LOW_INFO_SCORE_THRESHOLD = 0.52;
const SLOW_RESPONSE_THRESHOLD_MS = 9000;

const BASE_SUMMARY = {
    sampleSize: 0,
    passRate: 0,
    bothGoodRate: 0,
    lowDeltaRate: 0,
    lowInfoRate: 0,
    slowRate: 0,
    avgReactionMs: 0,
    anchorDrift: 0,
    pressure: 0,
    pressurePercent: 0,
    stage: 'stable',
    label: 'clear',
    forceIsolation: false,
    disableSpecial: false,
    preferTopCandidate: false,
    minScalarGap: LOW_SCALAR_GAP_THRESHOLD,
    deltaScale: 1,
    trialBoost: 1,
};

const normalizeEvent = (event = {}) => {
    const decision = String(event?.decision || '').toLowerCase();
    const queryKind = String(event?.queryKind || 'pairwise').toLowerCase();
    const normalizedDecision = decision === 'pass'
        ? 'pass'
        : (
            decision === 'both_good' || decision === 'bothgood'
                ? 'both_good'
                : 'pick'
        );
    return {
        decision: normalizedDecision,
        queryKind,
        scalarGapRaw: clamp01(Number(event?.scalarGapRaw ?? 0)),
        infoScore: clamp01(Number(event?.infoScore ?? 0.5)),
        reactionMs: Math.max(0, Number(event?.reactionMs ?? 0)),
        timestamp: Number.isFinite(event?.timestamp) ? Number(event.timestamp) : Date.now(),
    };
};

export const summarizeQuestionQuality = ({
    events = [],
    anchorDrift = 0,
} = {}) => {
    const rows = (Array.isArray(events) ? events : [])
        .filter(Boolean)
        .slice(-QUALITY_WINDOW_SIZE);
    if (!rows.length) {
        return {
            ...BASE_SUMMARY,
            anchorDrift: round(clamp01(anchorDrift), 3),
        };
    }

    const activeRows = rows.filter((entry) => entry.queryKind !== 'anchor');
    const sampleRows = activeRows.length ? activeRows : rows;
    const sampleSize = sampleRows.length;
    const passCount = sampleRows.filter((entry) => entry.decision === 'pass').length;
    const bothGoodCount = sampleRows.filter((entry) => entry.decision === 'both_good').length;
    const pickRows = sampleRows.filter((entry) => entry.decision === 'pick');

    const passRate = sampleSize > 0 ? passCount / sampleSize : 0;
    const bothGoodRate = sampleSize > 0 ? bothGoodCount / sampleSize : 0;
    const lowDeltaRate = pickRows.length > 0
        ? pickRows.filter((entry) => entry.scalarGapRaw < LOW_SCALAR_GAP_THRESHOLD).length / pickRows.length
        : 0;
    const lowInfoRate = sampleSize > 0
        ? sampleRows.filter((entry) => entry.infoScore < LOW_INFO_SCORE_THRESHOLD).length / sampleSize
        : 0;
    const slowRate = sampleSize > 0
        ? sampleRows.filter((entry) => entry.reactionMs > SLOW_RESPONSE_THRESHOLD_MS).length / sampleSize
        : 0;
    const avgReactionMs = sampleSize > 0
        ? sampleRows.reduce((acc, entry) => acc + entry.reactionMs, 0) / sampleSize
        : 0;
    const drift = clamp01(anchorDrift);

    const passSignal = clamp01((passRate - 0.16) / 0.42);
    const bothGoodSignal = clamp01((bothGoodRate - 0.12) / 0.52);
    const lowDeltaSignal = clamp01(lowDeltaRate / 0.75);
    const lowInfoSignal = clamp01(lowInfoRate / 0.75);
    const slowSignal = clamp01(slowRate / 0.6);
    const driftSignal = clamp01(drift / 0.55);
    const rawPressure = clamp01(
        (passSignal * 0.25)
        + (bothGoodSignal * 0.24)
        + (lowDeltaSignal * 0.21)
        + (lowInfoSignal * 0.16)
        + (slowSignal * 0.12)
        + (driftSignal * 0.02),
    );
    const passDominantBoost = (
        sampleSize >= MIN_ACTIONABLE_SAMPLES
        && passRate >= 0.45
    )
        ? clamp(0.14 + ((passRate - 0.45) * 0.4), 0, 0.32)
        : 0;
    const bothGoodDominantBoost = (
        sampleSize >= MIN_ACTIONABLE_SAMPLES
        && bothGoodRate >= 0.35
    )
        ? clamp(0.1 + ((bothGoodRate - 0.35) * 0.42), 0, 0.3)
        : 0;
    const sampleConfidence = clamp01((sampleSize - 4) / 16);
    const pressure = clamp01(
        (rawPressure * (0.35 + sampleConfidence * 0.65))
        + (passDominantBoost + bothGoodDominantBoost)
        * (sampleSize < 4 ? 0.5 : 1),
    );
    const stage = pressure >= 0.75
        ? 'critical'
        : pressure >= 0.55
            ? 'high'
            : pressure >= 0.35
                ? 'watch'
                : 'stable';
    const label = stage === 'critical'
        ? 'rebuild'
        : stage === 'high'
            ? 'boost'
            : stage === 'watch'
                ? 'watch'
                : 'clear';

    const actionable = sampleSize >= MIN_ACTIONABLE_SAMPLES;
    const isolationNeedSignal = Math.max(
        lowDeltaRate,
        lowInfoRate * 0.92,
        bothGoodRate * 0.85,
    );
    const forceIsolation = actionable
        && pressure >= 0.62
        && isolationNeedSignal >= 0.34;
    const disableSpecial = actionable && pressure >= 0.78;
    const preferTopCandidate = pressure >= 0.42;
    const minScalarGap = clamp(
        LOW_SCALAR_GAP_THRESHOLD + pressure * 0.09 + bothGoodRate * 0.03,
        LOW_SCALAR_GAP_THRESHOLD,
        0.16,
    );
    const deltaScale = clamp(1 + pressure * 1.8 + bothGoodRate * 0.9, 1, 2.9);
    const trialBoost = clamp(1 + pressure * 0.8 + bothGoodRate * 0.22, 1, 1.95);

    return {
        sampleSize,
        passRate: round(passRate, 3),
        bothGoodRate: round(bothGoodRate, 3),
        lowDeltaRate: round(lowDeltaRate, 3),
        lowInfoRate: round(lowInfoRate, 3),
        slowRate: round(slowRate, 3),
        avgReactionMs: Math.round(avgReactionMs),
        anchorDrift: round(drift, 3),
        pressure: round(pressure, 3),
        pressurePercent: Math.round(pressure * 100),
        stage,
        label,
        forceIsolation,
        disableSpecial,
        preferTopCandidate,
        minScalarGap: round(minScalarGap, 4),
        deltaScale: round(deltaScale, 3),
        trialBoost: round(trialBoost, 3),
    };
};

export const createQuestionQualityState = () => ({
    events: [],
    summary: { ...BASE_SUMMARY },
});

export const appendQuestionQualityEvent = (
    currentState = createQuestionQualityState(),
    event = {},
    options = {},
) => {
    const normalizedEvent = normalizeEvent(event);
    const events = [...(Array.isArray(currentState?.events) ? currentState.events : []), normalizedEvent]
        .slice(-QUALITY_EVENT_LIMIT);
    const summary = summarizeQuestionQuality({
        events,
        anchorDrift: Number(options?.anchorDrift ?? 0),
    });
    return { events, summary };
};

export const resolveQuestionGenerationProfile = ({
    baseIntensity = 0.2,
    questionQuality = BASE_SUMMARY,
} = {}) => {
    const base = clamp(Number(baseIntensity), 0.1, 0.78);
    const pressure = clamp01(questionQuality?.pressure ?? 0);
    const deltaScale = clamp(Number(questionQuality?.deltaScale ?? 1), 1, 2.9);
    const intensity = clamp(base * deltaScale, base, 0.82);
    const forcePairType = questionQuality?.forceIsolation ? 'isolation_pair' : null;
    return {
        pressure: round(pressure, 3),
        bothGoodRate: clamp01(Number(questionQuality?.bothGoodRate ?? 0)),
        stage: questionQuality?.stage || 'stable',
        intensity: round(intensity, 3),
        minScalarGap: clamp(Number(questionQuality?.minScalarGap ?? LOW_SCALAR_GAP_THRESHOLD), LOW_SCALAR_GAP_THRESHOLD, 0.16),
        trialBoost: clamp(Number(questionQuality?.trialBoost ?? 1), 1, 1.95),
        forcePairType,
        disableSpecial: Boolean(questionQuality?.disableSpecial),
        preferTopCandidate: Boolean(questionQuality?.preferTopCandidate),
    };
};
