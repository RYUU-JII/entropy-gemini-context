export const ZEN_BONSAI_SCORE_CATEGORY = Object.freeze({
    USER_RULE: 'user_rule',
    SITE_RULE: 'site_rule',
    UNMANAGED_REVIEW: 'unmanaged_review',
    RECOVERY: 'recovery',
    OBSERVATION: 'observation',
});

export const ZEN_BONSAI_SCORE_CATEGORY_CAPS = Object.freeze({
    [ZEN_BONSAI_SCORE_CATEGORY.USER_RULE]: 45,
    [ZEN_BONSAI_SCORE_CATEGORY.SITE_RULE]: 35,
    [ZEN_BONSAI_SCORE_CATEGORY.UNMANAGED_REVIEW]: 8,
});

export const ZEN_BONSAI_SCORING_MODE = Object.freeze({
    SCORED: 'scored',
    PARTIAL: 'partial',
    OBSERVATION_ONLY: 'observation_only',
    QUIET: 'quiet',
});

const SCORING_MODE_VALUES = new Set(Object.values(ZEN_BONSAI_SCORING_MODE));

export const resolveZenBonsaiScoreSummary = (input = {}) => {
    const summary = input?.scoreSummary || input?.metrics?.scoreSummary || null;
    return summary && typeof summary === 'object' ? summary : null;
};

export const resolveZenBonsaiLedgerEntries = (input = {}) => {
    const entries = input?.scoreLedger || input?.ledger || input?.metrics?.scoreLedger;
    return Array.isArray(entries) ? entries : [];
};

export const resolveZenBonsaiInsightEntries = (input = {}) => {
    const insights = input?.scoreInsights || input?.metrics?.scoreInsights;
    return Array.isArray(insights) ? insights : [];
};

export const normalizeZenBonsaiScoringMode = (value) => {
    const mode = typeof value === 'string' ? value : null;
    return SCORING_MODE_VALUES.has(mode) ? mode : null;
};

export const resolveZenBonsaiInputScoringMode = (input = {}) => normalizeZenBonsaiScoringMode(
    input?.dailyScoringMode
    ?? input?.scoringMode
    ?? input?.metrics?.dailyScoringMode
    ?? input?.metrics?.scoringMode,
);

export const resolveZenBonsaiScoringMode = (
    summary = null,
    fallback = ZEN_BONSAI_SCORING_MODE.QUIET,
) => {
    const mode = normalizeZenBonsaiScoringMode(summary?.scoringMode);
    if (mode) {
        return mode;
    }
    return summary ? ZEN_BONSAI_SCORING_MODE.SCORED : fallback;
};

export const isZenBonsaiNonScoredScoringMode = (mode) => {
    const normalized = normalizeZenBonsaiScoringMode(mode);
    return normalized !== null && normalized !== ZEN_BONSAI_SCORING_MODE.SCORED;
};

export const resolveZenBonsaiRegisteredSiteGoalCount = (input = {}) => {
    const candidates = [
        input?.registeredSiteRuleCount,
        input?.registeredSiteGoalCount,
        input?.siteRuleCount,
        input?.siteGoalCount,
        input?.siteLimitCount,
        input?.metrics?.registeredSiteRuleCount,
        input?.metrics?.registeredSiteGoalCount,
        input?.metrics?.siteRuleCount,
        input?.metrics?.siteGoalCount,
        input?.metrics?.siteLimitCount,
    ];
    for (const candidate of candidates) {
        const numeric = Number(candidate);
        if (Number.isFinite(numeric)) {
            return Math.max(0, Math.floor(numeric));
        }
    }

    const siteLimits = input?.siteLimits
        || input?.siteGoals
        || input?.goals?.siteLimits
        || input?.metrics?.siteLimits
        || input?.metrics?.siteGoals
        || null;
    if (!siteLimits || typeof siteLimits !== 'object') {
        return null;
    }
    return Object.values(siteLimits)
        .filter((value) => Number(value) > 0)
        .length;
};

const hasExplicitScoreInput = (input = {}) => [
    input?.cycleScore,
    input?.integrityScore,
    input?.dailyScore,
    input?.dailyDisplayScore,
    input?.metrics?.cycleScore,
    input?.metrics?.integrityScore,
    input?.metrics?.dailyScore,
    input?.metrics?.dailyDisplayScore,
].some((value) => value !== null && value !== undefined && Number.isFinite(Number(value)));

export const resolveZenBonsaiSetupPresentation = (input = {}) => {
    const summary = resolveZenBonsaiScoreSummary(input);
    const registeredSiteGoalCount = resolveZenBonsaiRegisteredSiteGoalCount(input);
    if (registeredSiteGoalCount === 0) {
        return true;
    }
    if (summary) {
        return false;
    }
    const dataDays = Math.max(0, Math.floor(Number(
        input?.daysTracked
        ?? input?.trackedDateCount
        ?? input?.dataDays
        ?? input?.metrics?.trackedDateCount
        ?? 0,
    ) || 0));
    return dataDays === 0 && !hasExplicitScoreInput(input);
};
