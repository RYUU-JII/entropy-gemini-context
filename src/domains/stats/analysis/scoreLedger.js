import { normalizeDomain } from '../../../lib/domain.js';
import {
    SCORE_RULE_REFERENCE_POLICY,
    resolveScoreRuleReference,
} from './scoreRuleReference.js';
import { USAGE_BASELINE_METRIC_IDS } from './usageBaseline.js';

export { SCORE_RULE_REFERENCE_POLICY };

const MINUTE_MS = 60_000;

export const SCORE_LEDGER_ENTRY_TYPE = Object.freeze({
    GLOBAL_GOAL_OVER_LIMIT: 'global_goal_over_limit',
    GLOBAL_GOAL_WITHIN_LIMIT: 'global_goal_within_limit',
    SITE_LIMIT_OVER_LIMIT: 'site_limit_over_limit',
    SITE_LIMIT_WITHIN_LIMIT: 'site_limit_within_limit',
    UNMANAGED_REVIEW_USAGE: 'unmanaged_review_usage',
    BROWSING_PATTERN_OBSERVED: 'browsing_pattern_observed',
    SCORE_COVERAGE_LOW: 'score_coverage_low',
    SCORE_CRITERIA_MISSING: 'score_criteria_missing',
    QUIET_DAY: 'quiet_day',
});

export const SCORE_LEDGER_CATEGORY = Object.freeze({
    USER_RULE: 'user_rule',
    SITE_RULE: 'site_rule',
    UNMANAGED_REVIEW: 'unmanaged_review',
    RECOVERY: 'recovery',
    OBSERVATION: 'observation',
});

export const SCORE_LEDGER_CATEGORY_CAPS = Object.freeze({
    [SCORE_LEDGER_CATEGORY.USER_RULE]: 45,
    [SCORE_LEDGER_CATEGORY.SITE_RULE]: 35,
    [SCORE_LEDGER_CATEGORY.UNMANAGED_REVIEW]: 8,
});

export const SCORE_LEDGER_SCORING_MODE = Object.freeze({
    SCORED: 'scored',
    PARTIAL: 'partial',
    OBSERVATION_ONLY: 'observation_only',
    QUIET: 'quiet',
});

export const SCORE_LEDGER_COVERAGE_POLICY = Object.freeze({
    MIN_DISPLAY_RATIO: 0.6,
});

export const SCORE_DAILY_OUTCOME_POLICY = Object.freeze({
    adherenceWeight: 0.7,
    practiceWeight: 0.3,
    practiceTargetCount: 2,
    engagedExposureMinMs: 5 * MINUTE_MS,
});

const CATEGORY_ORDER = Object.freeze([
    SCORE_LEDGER_CATEGORY.USER_RULE,
    SCORE_LEDGER_CATEGORY.SITE_RULE,
    SCORE_LEDGER_CATEGORY.UNMANAGED_REVIEW,
    SCORE_LEDGER_CATEGORY.RECOVERY,
    SCORE_LEDGER_CATEGORY.OBSERVATION,
]);

const clamp = (value, min = 0, max = 1) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return min;
    return Math.min(max, Math.max(min, numeric));
};

const round = (value, digits = 2) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Number(numeric.toFixed(digits));
};

const normalizeMinutes = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return 0;
    return Math.floor(numeric);
};

const normalizeMs = (value) => Math.max(0, Number(value) || 0);

const normalizeSiteLimits = (siteLimits = {}) => Object.fromEntries(
    Object.entries(siteLimits || {})
        .map(([domain, minutes]) => [normalizeDomain(domain), normalizeMinutes(minutes)])
        .filter(([domain, minutes]) => Boolean(domain) && minutes > 0),
);

const normalizeSiteDetails = (siteDetails = {}) => Object.fromEntries(
    Object.entries(siteDetails || {})
        .map(([domain, activeMs]) => [normalizeDomain(domain), normalizeMs(activeMs)])
        .filter(([domain, activeMs]) => Boolean(domain) && activeMs > 0),
);

const buildScoreCriteriaCoverage = ({
    totalActiveMs = 0,
    criteriaCoveredActiveMs = null,
    protectedActiveMs = 0,
    globalGoalMinutes = 0,
    siteDetails = {},
    siteLimits = {},
} = {}) => {
    const total = normalizeMs(totalActiveMs);
    const explicitCovered = criteriaCoveredActiveMs !== null && criteriaCoveredActiveMs !== undefined
        ? normalizeMs(criteriaCoveredActiveMs)
        : null;
    const inferredCovered = explicitCovered !== null
        ? explicitCovered
        : (
            (normalizeMinutes(globalGoalMinutes) > 0 ? normalizeMs(protectedActiveMs) : 0)
            + Object.keys(normalizeSiteLimits(siteLimits)).reduce(
                (acc, domain) => acc + normalizeMs(normalizeSiteDetails(siteDetails)?.[domain]),
                0,
            )
        );
    const coveredActiveMs = Math.min(total, Math.max(0, inferredCovered));
    const uncoveredActiveMs = Math.max(0, total - coveredActiveMs);
    const coverageRatio = total > 0 ? coveredActiveMs / total : 0;
    return {
        totalActiveMs: Math.round(total),
        coveredActiveMs: Math.round(coveredActiveMs),
        uncoveredActiveMs: Math.round(uncoveredActiveMs),
        coverageRatio: round(coverageRatio, 4),
        minDisplayRatio: SCORE_LEDGER_COVERAGE_POLICY.MIN_DISPLAY_RATIO,
        displayReady: total > 0 && coverageRatio >= SCORE_LEDGER_COVERAGE_POLICY.MIN_DISPLAY_RATIO,
    };
};

const normalizeUsageBaselines = (usageBaselines = null) => ({
    global: usageBaselines?.global ?? null,
    sites: Object.fromEntries(
        Object.entries(usageBaselines?.sites || {})
            .map(([domain, baseline]) => [normalizeDomain(domain), baseline])
            .filter(([domain, baseline]) => (
                Boolean(domain)
                && baseline !== null
                && typeof baseline !== 'undefined'
            )),
    ),
});

const resolveRuleAdherence = ({ usedMinutes, creditRefMinutes, deductRefMinutes }) => {
    const hasCreditReference = Number.isFinite(creditRefMinutes) && creditRefMinutes > 0;
    const creditRatio = hasCreditReference ? usedMinutes / creditRefMinutes : Infinity;
    if (!Number.isFinite(deductRefMinutes) || deductRefMinutes <= 0) {
        throw new Error('SCORE_RULE_DEDUCTION_REFERENCE_INVALID');
    }
    const deductRatio = usedMinutes / deductRefMinutes;
    if (hasCreditReference && creditRatio <= SCORE_RULE_REFERENCE_POLICY.creditRatioMax) return 1;
    if (deductRatio <= SCORE_RULE_REFERENCE_POLICY.graceRatioMax) return 0;
    if (deductRatio <= SCORE_RULE_REFERENCE_POLICY.catastropheRatioMin) {
        return -((deductRatio - SCORE_RULE_REFERENCE_POLICY.graceRatioMax) / 0.35) * 0.6;
    }
    if (deductRatio <= 2) {
        return -0.6 - (((deductRatio - SCORE_RULE_REFERENCE_POLICY.catastropheRatioMin) / 0.5) * 0.4);
    }
    return -1;
};

const projectRuleReferenceMetrics = (references) => ({
    referenceMode: references.mode,
    referenceReason: references.reason,
    baselineMinutes: references.baselineMinutes,
    baselineStatus: references.baselineStatus,
    creditRefMinutes: references.creditRefMinutes,
    deductRefMinutes: references.deductRefMinutes,
    deductRefCapMinutes: references.deductRefCapMinutes,
    deductRefCapApplied: references.deductRefCapApplied,
});

const buildOutcomeRule = ({
    id,
    kind,
    usedMinutes,
    goalMinutes,
    references,
}) => ({
    id,
    kind,
    usedMinutes: round(usedMinutes, 1),
    goalMinutes,
    ...projectRuleReferenceMetrics(references),
    deductRatio: references.deductRefMinutes > 0
        ? round(usedMinutes / references.deductRefMinutes, 3)
        : 0,
    adherence: round(resolveRuleAdherence({
        usedMinutes,
        creditRefMinutes: references.creditRefMinutes,
        deductRefMinutes: references.deductRefMinutes,
    }), 4),
});

const summarizeOutcomeRules = (rules = []) => {
    const active = rules.filter((rule) => rule.usedMinutes > 0);
    if (!active.length) return null;
    const weightTotal = active.reduce((acc, rule) => acc + rule.usedMinutes, 0);
    const weightedAdherence = active.reduce(
        (acc, rule) => acc + (rule.adherence * rule.usedMinutes),
        0,
    ) / Math.max(1e-6, weightTotal);
    const catastrophe = active
        .filter((rule) => rule.deductRatio > SCORE_RULE_REFERENCE_POLICY.catastropheRatioMin)
        .reduce((acc, rule) => Math.min(acc, rule.adherence), Infinity);
    return round(Number.isFinite(catastrophe)
        ? Math.min(weightedAdherence, catastrophe)
        : weightedAdherence, 4);
};

const sumSwitches = (switches = {}) => (
    normalizeMs(switches?.toBlocked)
    + normalizeMs(switches?.toAllowed)
    + normalizeMs(switches?.toUnmanaged)
    + normalizeMs(switches?.internal)
);

const createEntry = ({
    type,
    category,
    points = 0,
    subject = null,
    basis = 'user_defined',
    severity = 'info',
    metrics = {},
} = {}) => ({
    type,
    category,
    subject,
    basis,
    severity,
    rawPoints: round(points),
    points: round(points),
    metrics: { ...metrics },
});

const capNegativeEntriesByCategory = (entries = [], caps = SCORE_LEDGER_CATEGORY_CAPS) => {
    const negativeTotals = entries.reduce((acc, entry) => {
        if (entry.points >= 0) return acc;
        acc[entry.category] = (acc[entry.category] || 0) + Math.abs(entry.points);
        return acc;
    }, {});

    return entries.map((entry) => {
        if (entry.points >= 0) return entry;
        const cap = Number(caps?.[entry.category]);
        const total = Number(negativeTotals?.[entry.category]) || 0;
        if (!Number.isFinite(cap) || cap <= 0 || total <= cap) return entry;
        const scale = cap / total;
        return {
            ...entry,
            points: round(entry.points * scale),
            capped: true,
        };
    });
};

const summarizeScoreLedgerEntries = (entries = [], {
    hasUserCriteria = false,
    totalActiveMs = 0,
    criteriaCoverage = null,
} = {}) => {
    const categorySummary = Object.fromEntries(
        CATEGORY_ORDER.map((category) => [
            category,
            {
                points: 0,
                deduction: 0,
                credit: 0,
                entryCount: 0,
            },
        ]),
    );

    entries.forEach((entry) => {
        const category = categorySummary[entry.category]
            ? entry.category
            : SCORE_LEDGER_CATEGORY.OBSERVATION;
        const points = round(entry.points);
        categorySummary[category].points = round(categorySummary[category].points + points);
        categorySummary[category].entryCount += 1;
        if (points < 0) {
            categorySummary[category].deduction = round(categorySummary[category].deduction + Math.abs(points));
        } else if (points > 0) {
            categorySummary[category].credit = round(categorySummary[category].credit + points);
        }
    });

    const totalDeduction = round(
        entries.reduce((sum, entry) => sum + (entry.points < 0 ? Math.abs(entry.points) : 0), 0),
    );
    const totalCreditAvailable = round(
        entries.reduce((sum, entry) => sum + (entry.points > 0 ? entry.points : 0), 0),
    );
    const totalCreditApplied = round(Math.min(totalCreditAvailable, totalDeduction));
    const score = Math.round(clamp(100 - totalDeduction + totalCreditApplied, 0, 100));
    const hasActiveUse = normalizeMs(totalActiveMs) > 0;
    const scoringMode = (() => {
        if (!hasActiveUse) return SCORE_LEDGER_SCORING_MODE.QUIET;
        if (!hasUserCriteria) return SCORE_LEDGER_SCORING_MODE.OBSERVATION_ONLY;
        if (criteriaCoverage && criteriaCoverage.displayReady === false) {
            return SCORE_LEDGER_SCORING_MODE.PARTIAL;
        }
        return SCORE_LEDGER_SCORING_MODE.SCORED;
    })();
    const displayScore = scoringMode === SCORE_LEDGER_SCORING_MODE.SCORED
        ? score
        : null;
    const topDeductions = entries
        .filter((entry) => entry.points < 0)
        .sort((left, right) => left.points - right.points)
        .slice(0, 5);

    return {
        baseScore: 100,
        score,
        displayScore,
        scoringMode,
        hasUserCriteria: Boolean(hasUserCriteria),
        criteriaCoverage: criteriaCoverage ? { ...criteriaCoverage } : null,
        totalDeduction,
        totalCreditAvailable,
        totalCreditApplied,
        categories: categorySummary,
        topDeductions,
    };
};

const GLOBAL_GOAL_WITHIN_LIMIT_CREDIT = 3;
const SITE_LIMIT_WITHIN_LIMIT_CREDIT = 1;

const buildGlobalGoalResult = ({
    protectedActiveMs,
    globalGoalMinutes,
    usageBaseline = null,
} = {}) => {
    const goalMinutes = normalizeMinutes(globalGoalMinutes);
    if (goalMinutes <= 0) return { entries: [], rule: null };
    const references = resolveScoreRuleReference({
        goalMinutes,
        usageBaseline,
        baselineMetricId: USAGE_BASELINE_METRIC_IDS.MANAGED_DAILY_MINUTES,
        baselineScope: 'managed',
    });
    const usedMinutes = protectedActiveMs / MINUTE_MS;
    const rule = buildOutcomeRule({
        id: 'global_goal',
        kind: 'global',
        usedMinutes,
        goalMinutes,
        references,
    });
    const referenceMetrics = {
        usedMinutes: round(usedMinutes, 1),
        goalMinutes,
        ...projectRuleReferenceMetrics(references),
    };
    const deductRefMs = references.deductRefMinutes * MINUTE_MS;
    const ratio = deductRefMs > 0 ? protectedActiveMs / deductRefMs : 0;
    if (ratio > 1) {
        const overMinutes = Math.max(0, usedMinutes - references.deductRefMinutes);
        const overRatio = ratio - 1;
        const penalty = Math.min(45, (overRatio * 38) + (Math.min(overMinutes / 60, 1) * 4));
        return {
            rule,
            entries: [createEntry({
                type: SCORE_LEDGER_ENTRY_TYPE.GLOBAL_GOAL_OVER_LIMIT,
                category: SCORE_LEDGER_CATEGORY.USER_RULE,
                points: -penalty,
                subject: 'global_goal',
                basis: 'user_defined_global_goal',
                severity: penalty >= 20 ? 'critical' : 'warn',
                metrics: {
                    ...referenceMetrics,
                    overMinutes: round(overMinutes, 1),
                    ratio: round(ratio, 3),
                },
            })],
        };
    }
    // Flat credit, and only under the credit reference: extra headroom below a
    // loose goal earns nothing, so there is no incentive to inflate the goal.
    if (protectedActiveMs <= 0 || rule.adherence < 1) {
        return { rule, entries: [] };
    }
    return {
        rule,
        entries: [createEntry({
            type: SCORE_LEDGER_ENTRY_TYPE.GLOBAL_GOAL_WITHIN_LIMIT,
            category: SCORE_LEDGER_CATEGORY.RECOVERY,
            points: GLOBAL_GOAL_WITHIN_LIMIT_CREDIT,
            subject: 'global_goal',
            basis: 'user_defined_global_goal',
            severity: 'good',
            metrics: {
                ...referenceMetrics,
                remainingMinutes: round(Math.max(0, references.creditRefMinutes - usedMinutes), 1),
                ratio: round(ratio, 3),
            },
        })],
    };
};

const buildSiteLimitResult = ({
    siteDetails,
    siteLimits,
    siteBaselines = {},
} = {}) => {
    const limits = normalizeSiteLimits(siteLimits);
    const details = normalizeSiteDetails(siteDetails);
    const entries = [];
    const rules = [];
    Object.entries(limits).forEach(([domain, limitMinutes]) => {
        const activeMs = normalizeMs(details[domain]);
        if (activeMs <= 0) return;
        const references = resolveScoreRuleReference({
            goalMinutes: limitMinutes,
            usageBaseline: siteBaselines?.[domain] ?? null,
            baselineMetricId: USAGE_BASELINE_METRIC_IDS.SITE_DAILY_MINUTES,
            baselineScope: domain,
        });
        const usedMinutes = activeMs / MINUTE_MS;
        const rule = buildOutcomeRule({
            id: domain,
            kind: 'site',
            usedMinutes,
            goalMinutes: limitMinutes,
            references,
        });
        rules.push(rule);
        const referenceMetrics = {
            usedMinutes: round(usedMinutes, 1),
            limitMinutes,
            ...projectRuleReferenceMetrics(references),
        };
        const deductRefMs = references.deductRefMinutes * MINUTE_MS;
        const ratio = deductRefMs > 0 ? activeMs / deductRefMs : 0;
        if (ratio > 1) {
            const overMinutes = Math.max(0, usedMinutes - references.deductRefMinutes);
            const penalty = Math.min(24, ((ratio - 1) * 26) + (Math.min(overMinutes / 30, 1) * 3));
            entries.push(createEntry({
                type: SCORE_LEDGER_ENTRY_TYPE.SITE_LIMIT_OVER_LIMIT,
                category: SCORE_LEDGER_CATEGORY.SITE_RULE,
                points: -penalty,
                subject: domain,
                basis: 'user_defined_site_limit',
                severity: penalty >= 12 ? 'critical' : 'warn',
                metrics: {
                    ...referenceMetrics,
                    overMinutes: round(overMinutes, 1),
                    ratio: round(ratio, 3),
                },
            }));
            return;
        }
        if (rule.adherence < 1) return;
        entries.push(createEntry({
            type: SCORE_LEDGER_ENTRY_TYPE.SITE_LIMIT_WITHIN_LIMIT,
            category: SCORE_LEDGER_CATEGORY.RECOVERY,
            points: SITE_LIMIT_WITHIN_LIMIT_CREDIT,
            subject: domain,
            basis: 'user_defined_site_limit',
            severity: 'good',
            metrics: {
                ...referenceMetrics,
                remainingMinutes: round(Math.max(0, references.creditRefMinutes - usedMinutes), 1),
                ratio: round(ratio, 3),
            },
        }));
    });
    return { entries, rules };
};

const buildUnmanagedReviewEntry = ({
    totalActiveMs,
    unmanagedActiveMs,
} = {}) => {
    const total = normalizeMs(totalActiveMs);
    const unmanaged = normalizeMs(unmanagedActiveMs);
    const unmanagedMinutes = unmanaged / MINUTE_MS;
    if (total <= 0 || unmanagedMinutes < 20) return null;
    const ratio = unmanaged / total;
    const penalty = Math.min(8, (ratio * 5) + (Math.max(0, unmanagedMinutes - 20) / 90 * 3));
    if (penalty <= 0.2) return null;
    return createEntry({
        type: SCORE_LEDGER_ENTRY_TYPE.UNMANAGED_REVIEW_USAGE,
        category: SCORE_LEDGER_CATEGORY.UNMANAGED_REVIEW,
        points: -penalty,
        subject: 'unmanaged_sites',
        basis: 'review_suggestion',
        severity: penalty >= 5 ? 'watch' : 'info',
        metrics: {
            activeMinutes: round(unmanagedMinutes, 1),
            ratio: round(ratio, 3),
        },
    });
};

export function buildScoreLedger(input = {}) {
    const totalActiveMs = normalizeMs(input?.totalActiveMs ?? input?.totalActive);
    const protectedActiveMs = normalizeMs(input?.protectedActiveMs ?? input?.blockedActiveMs ?? input?.blockedActive);
    const unmanagedActiveMs = normalizeMs(input?.unmanagedActiveMs ?? input?.unmanagedActive);
    const criteriaCoveredActiveMs = input?.criteriaCoveredActiveMs ?? input?.scoredActiveMs ?? null;
    const globalGoalMinutes = normalizeMinutes(input?.globalGoalMinutes ?? input?.globalGoal);
    const siteLimits = normalizeSiteLimits(input?.siteLimitsMinutes ?? input?.siteLimits ?? input?.siteGoals);
    const siteDetails = normalizeSiteDetails(input?.siteDetailsMs ?? input?.siteDetails);
    const switchCount = Math.max(0, Math.floor(Number(input?.switchCount ?? sumSwitches(input?.switches)) || 0));
    const usageBaselines = normalizeUsageBaselines(input?.usageBaselines);
    const hasUserCriteria = globalGoalMinutes > 0 || Object.keys(siteLimits).length > 0;
    const criteriaCoverage = buildScoreCriteriaCoverage({
        totalActiveMs,
        criteriaCoveredActiveMs,
        protectedActiveMs,
        globalGoalMinutes,
        siteDetails,
        siteLimits,
    });

    const globalResult = buildGlobalGoalResult({
        protectedActiveMs,
        globalGoalMinutes,
        usageBaseline: usageBaselines.global,
    });
    const siteResult = buildSiteLimitResult({
        siteDetails,
        siteLimits,
        siteBaselines: usageBaselines.sites,
    });
    const entries = [
        ...globalResult.entries,
        ...siteResult.entries,
    ];
    const outcomeRules = [
        ...(globalResult.rule ? [globalResult.rule] : []),
        ...siteResult.rules,
    ];

    if (hasUserCriteria && totalActiveMs > 0 && !criteriaCoverage.displayReady) {
        entries.push(createEntry({
            type: SCORE_LEDGER_ENTRY_TYPE.SCORE_COVERAGE_LOW,
            category: SCORE_LEDGER_CATEGORY.OBSERVATION,
            points: 0,
            subject: 'score_coverage',
            basis: 'setup_needed',
            severity: 'info',
            metrics: {
                coveredMinutes: round(criteriaCoverage.coveredActiveMs / MINUTE_MS, 1),
                uncoveredMinutes: round(criteriaCoverage.uncoveredActiveMs / MINUTE_MS, 1),
                coverageRatio: criteriaCoverage.coverageRatio,
                minDisplayRatio: criteriaCoverage.minDisplayRatio,
            },
        }));
    }

    const unmanagedEntry = buildUnmanagedReviewEntry({
        totalActiveMs,
        unmanagedActiveMs,
    });
    if (unmanagedEntry) {
        entries.push(unmanagedEntry);
    }

    if (switchCount > 0) {
        entries.push(createEntry({
            type: SCORE_LEDGER_ENTRY_TYPE.BROWSING_PATTERN_OBSERVED,
            category: SCORE_LEDGER_CATEGORY.OBSERVATION,
            points: 0,
            subject: 'browsing_pattern',
            basis: 'neutral_observation',
            severity: 'info',
            metrics: {
                switchCount,
            },
        }));
    }

    if (!hasUserCriteria && totalActiveMs > 0) {
        entries.push(createEntry({
            type: SCORE_LEDGER_ENTRY_TYPE.SCORE_CRITERIA_MISSING,
            category: SCORE_LEDGER_CATEGORY.OBSERVATION,
            points: 0,
            subject: 'score_criteria',
            basis: 'setup_needed',
            severity: 'info',
            metrics: {
                totalActiveMinutes: round(totalActiveMs / MINUTE_MS, 1),
            },
        }));
    }

    if (entries.length === 0) {
        entries.push(createEntry({
            type: SCORE_LEDGER_ENTRY_TYPE.QUIET_DAY,
            category: SCORE_LEDGER_CATEGORY.OBSERVATION,
            points: 0,
            subject: 'activity',
            basis: 'no_scored_activity',
            severity: 'good',
            metrics: {},
        }));
    }

    const cappedEntries = capNegativeEntriesByCategory(entries);
    const summary = summarizeScoreLedgerEntries(cappedEntries, {
        hasUserCriteria,
        totalActiveMs,
        criteriaCoverage,
    });
    const outcomeBasis = Object.freeze({
        scoringMode: summary.scoringMode,
        engaged: hasUserCriteria
            && criteriaCoverage.coveredActiveMs >= SCORE_DAILY_OUTCOME_POLICY.engagedExposureMinMs,
        exposureMs: criteriaCoverage.coveredActiveMs,
        adherence: summarizeOutcomeRules(outcomeRules),
        rules: Object.freeze(outcomeRules),
    });
    return {
        score: summary.score,
        displayScore: summary.displayScore,
        scoringMode: summary.scoringMode,
        criteriaCoverage: summary.criteriaCoverage,
        entries: cappedEntries,
        summary: {
            ...summary,
            outcomeBasis,
        },
        outcomeBasis,
    };
}

// Finalizes the day's habit outcome `d` from the score ledger basis plus
// practice evidence the ledger cannot see (friction/ritual completions).
// Consumed by the zen bonsai vitality model; spec §1.5.
export function finalizeScoreDailyOutcome(outcomeBasis = null, {
    practiceCount = 0,
    protectedVisitCount = 0,
} = {}) {
    const scoringMode = outcomeBasis?.scoringMode || null;
    const practice = round(
        Math.min(1, Math.max(0, Number(practiceCount) || 0) / SCORE_DAILY_OUTCOME_POLICY.practiceTargetCount),
        4,
    );
    if (!outcomeBasis || scoringMode !== SCORE_LEDGER_SCORING_MODE.SCORED) {
        return {
            available: false,
            engaged: false,
            scoringMode,
            adherence: null,
            practice,
            outcome: null,
        };
    }
    const engaged = outcomeBasis.engaged === true
        || Math.max(0, Math.floor(Number(protectedVisitCount) || 0)) >= 1;
    if (!engaged) {
        return {
            available: true,
            engaged: false,
            scoringMode,
            adherence: null,
            practice,
            outcome: null,
        };
    }
    const adherence = Number.isFinite(Number(outcomeBasis.adherence))
        ? Number(outcomeBasis.adherence)
        : 0;
    const outcome = Math.min(1, Math.max(
        -1,
        (adherence * SCORE_DAILY_OUTCOME_POLICY.adherenceWeight)
        + (practice * SCORE_DAILY_OUTCOME_POLICY.practiceWeight),
    ));
    return {
        available: true,
        engaged: true,
        scoringMode,
        adherence: round(adherence, 4),
        practice,
        outcome: round(outcome, 4),
    };
}

export function buildScoreInsightCandidates(scoreLedger = null, { limit = 3 } = {}) {
    const entries = Array.isArray(scoreLedger?.entries)
        ? scoreLedger.entries
        : (Array.isArray(scoreLedger) ? scoreLedger : []);
    const scoringMode = scoreLedger?.summary?.scoringMode || scoreLedger?.scoringMode || SCORE_LEDGER_SCORING_MODE.SCORED;
    const maxCount = Math.max(1, Math.floor(Number(limit) || 3));
    if (scoringMode === SCORE_LEDGER_SCORING_MODE.PARTIAL) {
        const coverageEntries = entries.filter((entry) => entry.type === SCORE_LEDGER_ENTRY_TYPE.SCORE_COVERAGE_LOW);
        const deductions = entries
            .filter((entry) => entry.points < 0)
            .sort((left, right) => left.points - right.points);
        return [...coverageEntries, ...deductions]
            .slice(0, maxCount)
            .map((entry, index) => ({
                id: entry.type === SCORE_LEDGER_ENTRY_TYPE.SCORE_COVERAGE_LOW
                    ? 'score_context_coverage'
                    : `score_deduction_${index + 1}`,
                tone: entry.points < 0
                    ? (entry.severity === 'critical' ? 'critical' : 'warn')
                    : 'muted',
                type: entry.type,
                category: entry.category,
                subject: entry.subject,
                points: entry.points,
                metrics: { ...entry.metrics },
            }));
    }
    if (scoringMode !== SCORE_LEDGER_SCORING_MODE.SCORED) {
        return entries
            .filter((entry) => (
                entry.category === SCORE_LEDGER_CATEGORY.OBSERVATION
                || entry.points > 0
            ))
            .slice(0, maxCount)
            .map((entry, index) => ({
                id: `score_context_${index + 1}`,
                tone: entry.points > 0 ? 'good' : 'muted',
                type: entry.type,
                category: entry.category,
                subject: entry.subject,
                points: entry.points,
                metrics: { ...entry.metrics },
            }));
    }
    const deductions = entries
        .filter((entry) => entry.points < 0)
        .sort((left, right) => left.points - right.points)
        .slice(0, maxCount);
    if (deductions.length > 0) {
        return deductions.map((entry, index) => ({
            id: `score_deduction_${index + 1}`,
            tone: entry.severity === 'critical' ? 'critical' : 'warn',
            type: entry.type,
            category: entry.category,
            subject: entry.subject,
            points: entry.points,
            metrics: { ...entry.metrics },
        }));
    }
    return entries
        .filter((entry) => entry.points > 0 || entry.category === SCORE_LEDGER_CATEGORY.OBSERVATION)
        .slice(0, maxCount)
        .map((entry, index) => ({
            id: `score_context_${index + 1}`,
            tone: entry.points > 0 ? 'good' : 'muted',
            type: entry.type,
            category: entry.category,
            subject: entry.subject,
            points: entry.points,
            metrics: { ...entry.metrics },
        }));
}

export function calculateUserRuleScore(input = {}) {
    return buildScoreLedger(input);
}

export default buildScoreLedger;
