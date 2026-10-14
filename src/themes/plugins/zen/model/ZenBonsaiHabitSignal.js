import {
    isZenBonsaiNonScoredScoringMode,
    resolveZenBonsaiInputScoringMode,
    resolveZenBonsaiInsightEntries,
    resolveZenBonsaiLedgerEntries,
    resolveZenBonsaiRegisteredSiteGoalCount,
    resolveZenBonsaiScoreSummary,
    resolveZenBonsaiScoringMode,
    ZEN_BONSAI_SCORE_CATEGORY,
    ZEN_BONSAI_SCORE_CATEGORY_CAPS,
    ZEN_BONSAI_SCORING_MODE,
} from './ZenBonsaiVisualHealthInput.js';

const DEFAULT_HABIT_SIGNAL = Object.freeze({
    available: false,
    scored: false,
    source: 'none',
    scoringMode: ZEN_BONSAI_SCORING_MODE.QUIET,
    tone: 'calibrating',
    vitality: 0.78,
    stress: 0.08,
    bloom: 0.52,
    dryness: 0.03,
    branchSag: 0.02,
    windResponse: 0.72,
    disturbance: 0,
    recovery: 0,
    feedbackItems: Object.freeze([]),
});

const clamp = (value, min = 0, max = 1) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return min;
    return Math.min(max, Math.max(min, numeric));
};

const clamp01 = (value) => clamp(value, 0, 1);

const round = (value, digits = 4) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Number(numeric.toFixed(digits));
};

const resolveCategorySummary = (summary, category) => {
    const raw = summary?.categories?.[category];
    if (!raw || typeof raw !== 'object') {
        return {
            deduction: 0,
            credit: 0,
            points: 0,
            entryCount: 0,
        };
    }
    return {
        deduction: Math.max(0, Number(raw.deduction) || 0),
        credit: Math.max(0, Number(raw.credit) || 0),
        points: Number(raw.points) || 0,
        entryCount: Math.max(0, Number(raw.entryCount) || 0),
    };
};

const categoryPressure = (summary, category) => {
    const cap = Number(ZEN_BONSAI_SCORE_CATEGORY_CAPS?.[category]) || 1;
    const deduction = resolveCategorySummary(summary, category).deduction;
    return clamp01(deduction / cap);
};

const resolveSummaryScoreRatio = (summary, input = {}) => {
    const registeredSiteGoalCount = resolveZenBonsaiRegisteredSiteGoalCount(input);
    const setupScoreFloor = registeredSiteGoalCount === 0
        ? DEFAULT_HABIT_SIGNAL.vitality
        : null;
    const displayScore = summary?.displayScore;
    if (displayScore !== null && displayScore !== undefined && Number.isFinite(Number(displayScore))) {
        const ratio = clamp01(displayScore / 100);
        return setupScoreFloor === null ? ratio : Math.max(ratio, setupScoreFloor);
    }
    const inputScoringMode = resolveZenBonsaiInputScoringMode(input);
    if (!summary && isZenBonsaiNonScoredScoringMode(inputScoringMode)) {
        return DEFAULT_HABIT_SIGNAL.vitality;
    }
    if (!summary && registeredSiteGoalCount === 0) {
        return DEFAULT_HABIT_SIGNAL.vitality;
    }
    const scoringMode = resolveZenBonsaiScoringMode(summary, inputScoringMode || ZEN_BONSAI_SCORING_MODE.QUIET);
    if (scoringMode === ZEN_BONSAI_SCORING_MODE.SCORED) {
        const summaryScore = Number(summary?.score);
        if (Number.isFinite(summaryScore)) {
            const ratio = clamp01(summaryScore / 100);
            return setupScoreFloor === null ? ratio : Math.max(ratio, setupScoreFloor);
        }
    }
    if (summary) {
        return DEFAULT_HABIT_SIGNAL.vitality;
    }
    return DEFAULT_HABIT_SIGNAL.vitality;
};

// Vitality tiers share the tone vocabulary; when the ledger vitality is
// active it owns the presented tone (recovery overlay wins inside low tiers).
// Kept as a local resolver: CultivationPolicy imports this module, so the
// shared resolver there cannot be imported without a cycle.
const VITALITY_TONE_VALUES = new Set(['thriving', 'steady', 'strained', 'withered']);
const resolveVitalityTone = (input = {}) => {
    const source = input?.bonsaiVitality || input?.metrics?.bonsaiVitality || null;
    if (!source || typeof source !== 'object' || source.active !== true) return null;
    if (source.recoveryOverlay === true) return 'recovering';
    return VITALITY_TONE_VALUES.has(source.tier) ? source.tier : null;
};

const resolveFeedbackTone = ({
    available,
    scored,
    scoringMode,
    scoreRatio,
    habitPressure,
    recovery,
    feedbackItems,
} = {}) => {
    if (!available) return 'calibrating';
    if (!scored) {
        return scoringMode === ZEN_BONSAI_SCORING_MODE.QUIET ? 'steady' : 'calibrating';
    }
    if (habitPressure >= 0.72 || scoreRatio <= 0.42) return 'withered';
    if (habitPressure >= 0.42 || scoreRatio <= 0.68) return 'strained';
    if (recovery >= 0.28 && habitPressure < 0.28) return 'recovering';
    if (scoreRatio >= 0.92 && feedbackItems.some((item) => item.tone === 'good')) return 'thriving';
    return 'steady';
};

const toneRank = Object.freeze({
    critical: 0,
    warn: 1,
    watch: 2,
    good: 3,
    muted: 4,
    info: 5,
});

const normalizeFeedbackEntry = (entry = {}, index = 0) => {
    const tone = entry?.tone || entry?.severity || (Number(entry?.points) < 0 ? 'warn' : 'muted');
    return {
        id: entry?.id || `bonsai_habit_feedback_${index + 1}`,
        type: entry?.type || 'habit_signal',
        category: entry?.category || ZEN_BONSAI_SCORE_CATEGORY.OBSERVATION,
        subject: entry?.subject || null,
        tone,
        metrics: { ...(entry?.metrics || {}) },
    };
};

export const buildZenBonsaiHabitFeedbackItems = (input = {}, { limit = 3 } = {}) => {
    const insights = resolveZenBonsaiInsightEntries(input);
    const ledgerEntries = resolveZenBonsaiLedgerEntries(input);
    const source = insights.length > 0
        ? insights
        : ledgerEntries;
    const maxCount = Math.max(1, Math.floor(Number(limit) || 3));
    return source
        .map(normalizeFeedbackEntry)
        .sort((left, right) => {
            const rankDiff = (toneRank[left.tone] ?? 6) - (toneRank[right.tone] ?? 6);
            if (rankDiff !== 0) return rankDiff;
            return String(left.type).localeCompare(String(right.type));
        })
        .slice(0, maxCount);
};

export const buildZenBonsaiHabitSignalSignature = (input = {}) => {
    const summary = resolveZenBonsaiScoreSummary(input);
    const registeredSiteGoalCount = resolveZenBonsaiRegisteredSiteGoalCount(input);
    const vitalityTone = resolveVitalityTone(input) || 'vitality_none';
    if (!summary) {
        return [
            vitalityTone,
            'unscored',
            registeredSiteGoalCount ?? 'site_unknown',
            resolveZenBonsaiInputScoringMode(input) || 'mode_unknown',
        ].join('|');
    }
    const categories = summary?.categories || {};
    return [
        vitalityTone,
        resolveZenBonsaiScoringMode(summary),
        registeredSiteGoalCount ?? 'site_unknown',
        summary?.displayScore !== null && summary?.displayScore !== undefined && Number.isFinite(Number(summary.displayScore))
            ? Math.round(Number(summary.displayScore))
            : 'none',
        Math.round(Number(summary?.score) || 0),
        Math.round(Number(summary?.totalDeduction) || 0),
        Math.round(Number(summary?.totalCreditApplied) || 0),
        Math.round(Number(categories?.[ZEN_BONSAI_SCORE_CATEGORY.USER_RULE]?.deduction) || 0),
        Math.round(Number(categories?.[ZEN_BONSAI_SCORE_CATEGORY.SITE_RULE]?.deduction) || 0),
        Math.round(Number(categories?.[ZEN_BONSAI_SCORE_CATEGORY.UNMANAGED_REVIEW]?.deduction) || 0),
        buildZenBonsaiHabitFeedbackItems(input).map((item) => `${item.type}:${item.subject || ''}:${item.tone}`).join(','),
    ].join('|');
};

export const resolveZenBonsaiHabitSignal = (input = {}) => {
    const summary = resolveZenBonsaiScoreSummary(input);
    const available = Boolean(summary);
    const inputScoringMode = resolveZenBonsaiInputScoringMode(input);
    const scoringMode = resolveZenBonsaiScoringMode(summary, inputScoringMode || ZEN_BONSAI_SCORING_MODE.QUIET);
    const scored = available && scoringMode === ZEN_BONSAI_SCORING_MODE.SCORED;
    const scoreRatio = resolveSummaryScoreRatio(summary, input);
    const registeredSiteGoalCount = resolveZenBonsaiRegisteredSiteGoalCount(input);
    const unscoredSetup = !available && (
        isZenBonsaiNonScoredScoringMode(inputScoringMode)
        || registeredSiteGoalCount === 0
    );
    const noSiteGoalDamageScale = scored && registeredSiteGoalCount === 0 ? 0.34 : 1;
    const userRulePressure = (scored
        ? categoryPressure(summary, ZEN_BONSAI_SCORE_CATEGORY.USER_RULE)
        : 0) * noSiteGoalDamageScale;
    const siteRulePressure = scored
        ? categoryPressure(summary, ZEN_BONSAI_SCORE_CATEGORY.SITE_RULE) * noSiteGoalDamageScale
        : 0;
    const unmanagedPressure = scored
        ? categoryPressure(summary, ZEN_BONSAI_SCORE_CATEGORY.UNMANAGED_REVIEW) * noSiteGoalDamageScale
        : 0;
    const habitPressure = clamp01(
        (userRulePressure * 0.5)
        + (siteRulePressure * 0.38)
        + (unmanagedPressure * 0.12),
    );
    const totalDeduction = Math.max(0, Number(summary?.totalDeduction) || 0);
    const totalCreditApplied = Math.max(0, Number(summary?.totalCreditApplied) || 0);
    const totalCreditAvailable = Math.max(0, Number(summary?.totalCreditAvailable) || 0);
    const recovery = scored
        ? clamp01((totalCreditApplied + (totalCreditAvailable * 0.45)) / Math.max(10, totalDeduction + 4))
        : 0;
    const feedbackItems = buildZenBonsaiHabitFeedbackItems(input);
    const disturbance = clamp01(
        (scored ? habitPressure : 0)
        + (Number(input?.signalCount) || 0) / 14
        + (scored ? unmanagedPressure * 0.1 : 0),
    );
    const vitality = clamp01(
        0.22
        + (scoreRatio * 0.72)
        + (recovery * 0.1)
        - (habitPressure * 0.04),
    );
    const stress = clamp01(
        (habitPressure * 0.82)
        + ((1 - scoreRatio) * 0.08)
        - (recovery * 0.18),
    );
    const bloom = clamp01(
        Math.max(unscoredSetup ? DEFAULT_HABIT_SIGNAL.bloom : 0, scoreRatio * 0.5)
        + (recovery * 0.38)
        - (habitPressure * 0.16),
    );
    const dryness = clamp01(
        (habitPressure * 0.82)
        + ((1 - scoreRatio) * 0.08)
        + (unmanagedPressure * 0.04)
        - (recovery * 0.22),
    );
    const branchSag = clamp01(
        (dryness * 0.72)
        + (siteRulePressure * 0.12)
        + (userRulePressure * 0.08),
    );
    const windResponse = clamp01(
        0.26
        + (vitality * 0.66)
        - (dryness * 0.16)
        + (recovery * 0.12),
    );
    const tone = resolveVitalityTone(input) ?? resolveFeedbackTone({
        available,
        scored,
        scoringMode,
        scoreRatio,
        habitPressure,
        recovery,
        feedbackItems,
    });

    return {
        ...DEFAULT_HABIT_SIGNAL,
        available,
        scored,
        source: available ? 'score_ledger' : 'unscored',
        scoringMode,
        tone,
        vitality: round(vitality),
        stress: round(stress),
        bloom: round(bloom),
        dryness: round(dryness),
        branchSag: round(branchSag),
        windResponse: round(windResponse),
        disturbance: round(disturbance),
        recovery: round(recovery),
        diagnostics: Object.freeze({
            scoreRatio: round(scoreRatio),
            userRulePressure: round(userRulePressure),
            siteRulePressure: round(siteRulePressure),
            unmanagedPressure: round(unmanagedPressure),
            habitPressure: round(habitPressure),
            recovery: round(recovery),
            totalDeduction: round(totalDeduction, 2),
            totalCreditApplied: round(totalCreditApplied, 2),
            totalCreditAvailable: round(totalCreditAvailable, 2),
            noSiteGoalDamageScale: round(noSiteGoalDamageScale),
            registeredSiteGoalCount: registeredSiteGoalCount ?? 0,
        }),
        feedbackItems,
    };
};

export default resolveZenBonsaiHabitSignal;
