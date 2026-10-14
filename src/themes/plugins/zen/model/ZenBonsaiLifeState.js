export const ZEN_BONSAI_INITIAL_FORM_GROWTH = 0.5;

export const ZEN_BONSAI_DEFAULT_LIFE_STATE = Object.freeze({
    phase: 'seedling',
    growth: ZEN_BONSAI_INITIAL_FORM_GROWTH,
    vitality: 0.84,
    stress: 0.04,
    bloom: 0,
    dryness: 0.02,
    branchSag: 0.01,
    windResponse: 0.68,
    dataDays: 0,
    analysisConfidence: 0,
});

const DEFAULT_GROWTH_EVENT = Object.freeze({
    kind: 'none',
    strength: 0,
    milestone: 0,
    milestoneEventDateKey: '',
    lastClosedDateKey: '',
    recoveryOverlay: false,
    microFeedback: null,
});
const LIFE_PHASE_VALUES = new Set(['seedling', 'juvenile', 'mature']);

const clamp = (value, min = 0, max = 1) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return min;
    }
    return Math.min(max, Math.max(min, numeric));
};
const clamp01 = (value) => clamp(value, 0, 1);
const round = (value, digits = 4) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return 0;
    }
    return Number(numeric.toFixed(digits));
};

const toDateKey = (value) => {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : '';
};

const normalizeGrowthEventKind = (value) => {
    if (value === 'milestone_shoot' || value === 'recovery_shoot') {
        return value;
    }
    return 'none';
};

const normalizeZenBonsaiGrowthEvent = (source = {}) => {
    const eventSource = source?.growthEvent && typeof source.growthEvent === 'object'
        ? source.growthEvent
        : {};
    const milestone = Math.max(0, Math.floor(Number(
        eventSource.milestone
        ?? source?.vitalityMilestone
        ?? 0,
    ) || 0));
    const milestoneEventDateKey = toDateKey(
        eventSource.milestoneEventDateKey
        ?? source?.vitalityMilestoneEventDateKey,
    );
    const lastClosedDateKey = toDateKey(
        eventSource.lastClosedDateKey
        ?? source?.vitalityLastClosedDateKey,
    );
    const explicitKind = normalizeGrowthEventKind(eventSource.kind);
    const milestoneActive = explicitKind === 'milestone_shoot'
        || (
            milestone > 0
            && milestoneEventDateKey
            && lastClosedDateKey
            && milestoneEventDateKey === lastClosedDateKey
        );
    const recoveryOverlay = eventSource.recoveryOverlay === true
        || source?.vitalityRecoveryOverlay === true;
    const kind = milestoneActive
        ? 'milestone_shoot'
        : (recoveryOverlay ? 'recovery_shoot' : 'none');
    const microFeedback = typeof (eventSource.microFeedback ?? source?.vitalityMicroFeedback) === 'string'
        ? String(eventSource.microFeedback ?? source?.vitalityMicroFeedback)
        : null;
    const strength = kind === 'milestone_shoot'
        ? 1
        : (kind === 'recovery_shoot' ? 0.62 : 0);
    return Object.freeze({
        ...DEFAULT_GROWTH_EVENT,
        kind,
        strength,
        milestone,
        milestoneEventDateKey,
        lastClosedDateKey,
        recoveryOverlay,
        microFeedback,
    });
};

export const normalizeZenBonsaiLifeStructuralImprint = (source = {}) => {
    const imprint = source?.structuralImprint
        ?? source?.bonsaiStructuralImprint
        ?? source?.metrics?.bonsaiStructuralImprint
        ?? null;
    if (!imprint || typeof imprint !== 'object' || Array.isArray(imprint)) {
        return null;
    }
    const exposureQuality = round(clamp01(imprint.exposureQuality));
    const stressWood = round(clamp01(imprint.stressWood));
    const recoveryWood = round(clamp01(imprint.recoveryWood));
    const volatility = round(clamp01(imprint.volatility));
    const canopyReserve = round(clamp01(imprint.canopyReserve ?? 0.62));
    const lastUpdatedDateKey = toDateKey(imprint.lastUpdatedDateKey || imprint.lastClosedDateKey);
    const pendingDateKey = toDateKey(imprint.pendingDateKey);
    const active = imprint.active === true
        || Boolean(lastUpdatedDateKey)
        || Boolean(pendingDateKey)
        || exposureQuality > 0
        || stressWood > 0
        || recoveryWood > 0
        || volatility > 0
        || Math.abs(canopyReserve - 0.62) > 0.001;
    return Object.freeze({
        active,
        exposureQuality,
        stressWood,
        recoveryWood,
        volatility,
        canopyReserve,
        lastUpdatedDateKey,
        pendingDateKey,
    });
};

export const normalizeZenBonsaiLifeGrowthSegments = (source = {}) => {
    const segments = source?.growthSegments
        ?? source?.bonsaiGrowthSegments
        ?? source?.metrics?.bonsaiGrowthSegments
        ?? null;
    if (!Array.isArray(segments)) {
        return Object.freeze([]);
    }
    return Object.freeze(segments
        .map((segment) => {
            if (!segment || typeof segment !== 'object' || Array.isArray(segment)) {
                return null;
            }
            const milestone = Math.max(0, Math.floor(Number(segment.milestone) || 0));
            if (milestone <= 0) {
                return null;
            }
            const growthScore = Number.isFinite(Number(segment.growthScore))
                ? round(clamp(Number(segment.growthScore), 0, 100), 2)
                : 0;
            return Object.freeze({
                id: typeof segment.id === 'string' && segment.id.trim()
                    ? segment.id.trim()
                    : `m${milestone}`,
                milestone,
                growthScore,
                dateKey: toDateKey(segment.dateKey || segment.stampedDateKey),
                exposureQuality: round(clamp01(segment.exposureQuality)),
                stressWood: round(clamp01(segment.stressWood)),
                recoveryWood: round(clamp01(segment.recoveryWood)),
                volatility: round(clamp01(segment.volatility)),
                canopyReserve: round(clamp01(segment.canopyReserve ?? 0.62)),
                healthH: round(clamp01(segment.healthH ?? 0.68)),
                vitalityTier: typeof segment.vitalityTier === 'string' ? segment.vitalityTier.trim() : '',
            });
        })
        .filter(Boolean)
        .sort((left, right) => left.milestone - right.milestone));
};

export const normalizeZenBonsaiLifeState = (candidate = null) => {
    const source = candidate && typeof candidate === 'object'
        ? candidate
        : ZEN_BONSAI_DEFAULT_LIFE_STATE;
    const maturitySource = source?.maturity && typeof source.maturity === 'object'
        ? source.maturity
        : source;
    const vigorSource = source?.vigor && typeof source.vigor === 'object'
        ? source.vigor
        : source;
    const phaseCandidate = source.phase ?? maturitySource.phase;
    const phase = LIFE_PHASE_VALUES.has(phaseCandidate)
        ? phaseCandidate
        : ZEN_BONSAI_DEFAULT_LIFE_STATE.phase;
    const maturity = Object.freeze({
        phase,
        growth: round(clamp(
            source.growth ?? maturitySource.growth ?? ZEN_BONSAI_DEFAULT_LIFE_STATE.growth,
            ZEN_BONSAI_INITIAL_FORM_GROWTH,
            1,
        )),
        dataDays: Math.max(0, Math.floor(Number(source.dataDays ?? maturitySource.dataDays) || 0)),
        analysisConfidence: round(clamp01(
            source.analysisConfidence
            ?? maturitySource.analysisConfidence
            ?? ZEN_BONSAI_DEFAULT_LIFE_STATE.analysisConfidence,
        )),
    });
    const vigor = Object.freeze({
        vitality: round(clamp01(
            source.vitality ?? vigorSource.vitality ?? ZEN_BONSAI_DEFAULT_LIFE_STATE.vitality,
        )),
        stress: round(clamp01(
            source.stress ?? vigorSource.stress ?? ZEN_BONSAI_DEFAULT_LIFE_STATE.stress,
        )),
        bloom: round(clamp01(
            source.bloom ?? vigorSource.bloom ?? ZEN_BONSAI_DEFAULT_LIFE_STATE.bloom,
        )),
        dryness: round(clamp01(
            source.dryness ?? vigorSource.dryness ?? ZEN_BONSAI_DEFAULT_LIFE_STATE.dryness,
        )),
        branchSag: round(clamp01(
            source.branchSag ?? vigorSource.branchSag ?? ZEN_BONSAI_DEFAULT_LIFE_STATE.branchSag,
        )),
        windResponse: round(clamp01(
            source.windResponse ?? vigorSource.windResponse ?? ZEN_BONSAI_DEFAULT_LIFE_STATE.windResponse,
        )),
    });
    const growthEvent = normalizeZenBonsaiGrowthEvent(source);
    const structuralImprint = normalizeZenBonsaiLifeStructuralImprint(source);
    const growthSegments = normalizeZenBonsaiLifeGrowthSegments(source);
    return {
        phase: maturity.phase,
        growth: maturity.growth,
        vitality: vigor.vitality,
        stress: vigor.stress,
        bloom: vigor.bloom,
        dryness: vigor.dryness,
        branchSag: vigor.branchSag,
        windResponse: vigor.windResponse,
        dataDays: maturity.dataDays,
        analysisConfidence: maturity.analysisConfidence,
        maturity,
        vigor,
        growthEvent,
        structuralImprint,
        growthSegments,
    };
};
