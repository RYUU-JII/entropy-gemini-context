import {
    resolveZenBonsaiInputScoringMode,
    resolveZenBonsaiLedgerEntries,
    resolveZenBonsaiRegisteredSiteGoalCount,
    resolveZenBonsaiScoreSummary,
    resolveZenBonsaiScoringMode,
    ZEN_BONSAI_SCORE_CATEGORY,
    ZEN_BONSAI_SCORE_CATEGORY_CAPS,
    ZEN_BONSAI_SCORING_MODE,
} from '../../model/ZenBonsaiVisualHealthInput.js';

export const ZEN_BONSAI_ACTIVATION_DEBUG_VERSION = 'zen_bonsai_activation_debug_v1';

const SCORE_CATEGORY_ORDER = Object.freeze([
    ZEN_BONSAI_SCORE_CATEGORY.USER_RULE,
    ZEN_BONSAI_SCORE_CATEGORY.SITE_RULE,
    ZEN_BONSAI_SCORE_CATEGORY.UNMANAGED_REVIEW,
    ZEN_BONSAI_SCORE_CATEGORY.RECOVERY,
    ZEN_BONSAI_SCORE_CATEGORY.OBSERVATION,
]);

const RESERVED_SUBJECT_KIND = Object.freeze({
    global_goal: 'global_goal',
    unmanaged_sites: 'unmanaged_sites',
    score_coverage: 'score_coverage',
    score_criteria: 'score_criteria',
    activity: 'activity',
    browsing_pattern: 'browsing_pattern',
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

const roundScore = (value) => Math.round(clamp(Number(value) || 0, 0, 100));

const isFiniteValue = (value) => (
    value !== null
    && value !== undefined
    && value !== ''
    && Number.isFinite(Number(value))
);

const normalizeSubject = (value) => (
    typeof value === 'string' && value.trim()
        ? value.trim().toLowerCase()
        : ''
);

const resolveSubjectKind = (subject = '') => {
    const normalized = normalizeSubject(subject);
    if (!normalized) return 'unknown';
    if (RESERVED_SUBJECT_KIND[normalized]) return RESERVED_SUBJECT_KIND[normalized];
    return /^[a-z0-9](?:[a-z0-9-]*\.)+[a-z]{2,}$/i.test(normalized)
        ? 'domain'
        : 'other';
};

const normalizeCategorySummary = (summary = null, category) => {
    const source = summary?.categories?.[category];
    const cap = Number(ZEN_BONSAI_SCORE_CATEGORY_CAPS?.[category]);
    const deduction = Math.max(0, Number(source?.deduction) || 0);
    const credit = Math.max(0, Number(source?.credit) || 0);
    return Object.freeze({
        category,
        points: round(Number(source?.points) || 0, 2),
        deduction: round(deduction, 2),
        credit: round(credit, 2),
        entryCount: Math.max(0, Math.floor(Number(source?.entryCount) || 0)),
        cap: Number.isFinite(cap) && cap > 0 ? round(cap, 2) : null,
        pressure: Number.isFinite(cap) && cap > 0 ? round(clamp01(deduction / cap)) : null,
    });
};

const normalizeLedgerEntry = (entry = {}, index = 0) => {
    const subject = normalizeSubject(entry?.subject);
    const points = round(Number(entry?.points) || 0, 2);
    const subjectKind = resolveSubjectKind(subject);
    return Object.freeze({
        id: entry?.id || `${entry?.type || 'score_entry'}_${index + 1}`,
        type: entry?.type || 'unknown',
        category: entry?.category || ZEN_BONSAI_SCORE_CATEGORY.OBSERVATION,
        subject,
        subjectKind,
        points,
        deduction: points < 0 ? round(Math.abs(points), 2) : 0,
        credit: points > 0 ? points : 0,
        severity: entry?.severity || entry?.tone || (points < 0 ? 'warn' : 'info'),
        metrics: Object.freeze({ ...(entry?.metrics || {}) }),
    });
};

const aggregateSubjectImpacts = (entries = [], {
    domainOnly = false,
    limit = 5,
} = {}) => {
    const bySubject = new Map();
    entries.forEach((entry) => {
        if (!entry.subject) return;
        if (domainOnly && entry.subjectKind !== 'domain') return;
        const current = bySubject.get(entry.subject) || {
            subject: entry.subject,
            subjectKind: entry.subjectKind,
            points: 0,
            deduction: 0,
            credit: 0,
            entryCount: 0,
            dominantType: entry.type,
            dominantCategory: entry.category,
            dominantSeverity: entry.severity,
            metrics: entry.metrics,
        };
        const nextDeduction = current.deduction + entry.deduction;
        const nextCredit = current.credit + entry.credit;
        const nextPoints = current.points + entry.points;
        const currentDominance = Math.max(current.deduction, current.credit);
        const entryDominance = Math.max(entry.deduction, entry.credit);
        bySubject.set(entry.subject, {
            ...current,
            points: nextPoints,
            deduction: nextDeduction,
            credit: nextCredit,
            entryCount: current.entryCount + 1,
            dominantType: entryDominance >= currentDominance ? entry.type : current.dominantType,
            dominantCategory: entryDominance >= currentDominance ? entry.category : current.dominantCategory,
            dominantSeverity: entryDominance >= currentDominance ? entry.severity : current.dominantSeverity,
            metrics: entryDominance >= currentDominance ? entry.metrics : current.metrics,
        });
    });

    return Object.freeze(Array.from(bySubject.values())
        .map((impact) => Object.freeze({
            ...impact,
            points: round(impact.points, 2),
            deduction: round(impact.deduction, 2),
            credit: round(impact.credit, 2),
            impact: round(Math.max(impact.deduction, impact.credit), 2),
        }))
        .sort((left, right) => (
            (right.deduction - left.deduction)
            || (right.credit - left.credit)
            || String(left.subject).localeCompare(String(right.subject))
        ))
        .slice(0, Math.max(1, Math.floor(Number(limit) || 5))));
};

const buildRecoveryHints = ({
    entries = [],
    readiness = null,
    summary = null,
} = {}) => {
    const deductionHints = entries
        .filter((entry) => entry.deduction > 0)
        .sort((left, right) => right.deduction - left.deduction)
        .slice(0, 3)
        .map((entry) => Object.freeze({
            id: `score_${entry.id}`,
            source: 'score_ledger',
            type: entry.type,
            category: entry.category,
            subject: entry.subject,
            subjectKind: entry.subjectKind,
            recoverablePoints: round(entry.deduction, 2),
            metrics: entry.metrics,
        }));
    const growthHints = Array.isArray(readiness?.topMissing)
        ? readiness.topMissing
            .slice(0, 3)
            .map((metric) => Object.freeze({
                id: `growth_${metric.id}`,
                source: 'growth_readiness',
                type: metric.id,
                category: 'maturity',
                subject: metric.id,
                remainingContribution: round(metric.remainingContribution, 2),
                value: metric.value,
                target: metric.target,
                unit: metric.unit,
            }))
        : [];
    const creditApplied = Math.max(0, Number(summary?.totalCreditApplied) || 0);
    const creditAvailable = Math.max(0, Number(summary?.totalCreditAvailable) || 0);
    const creditHint = creditAvailable > creditApplied
        ? [Object.freeze({
            id: 'score_credit_available',
            source: 'score_credit',
            type: 'credit_available',
            category: ZEN_BONSAI_SCORE_CATEGORY.RECOVERY,
            subject: 'recovery_credit',
            recoverablePoints: round(creditAvailable - creditApplied, 2),
        })]
        : [];

    return Object.freeze([...deductionHints, ...creditHint, ...growthHints].slice(0, 5));
};

const resolveActivationScore = ({
    summary = null,
    habitSignal = null,
    input = {},
} = {}) => {
    const diagnostics = habitSignal?.diagnostics || null;
    const displayScore = isFiniteValue(summary?.displayScore)
        ? clamp(Number(summary.displayScore), 0, 100)
        : null;
    const rawScore = isFiniteValue(summary?.score)
        ? clamp(Number(summary.score), 0, 100)
        : null;
    const diagnosticScore = isFiniteValue(diagnostics?.scoreRatio)
        ? clamp01(Number(diagnostics.scoreRatio)) * 100
        : null;
    const fallbackScore = [
        input?.dailyDisplayScore,
        input?.dailyScore,
        input?.cycleScore,
        input?.integrityScore,
        input?.metrics?.dailyDisplayScore,
        input?.metrics?.dailyScore,
        input?.metrics?.cycleScore,
        input?.metrics?.integrityScore,
    ].find(isFiniteValue);
    const score = displayScore ?? rawScore ?? diagnosticScore ?? Number(fallbackScore) ?? 0;
    const source = displayScore !== null
        ? 'display_score'
        : (rawScore !== null ? 'score' : (diagnosticScore !== null ? 'habit_signal' : 'input_score'));

    return Object.freeze({
        score: roundScore(score),
        scoreRatio: round(clamp01(score / 100)),
        source,
        displayScore: displayScore !== null ? round(displayScore, 2) : null,
        rawScore: rawScore !== null ? round(rawScore, 2) : null,
    });
};

export const resolveZenBonsaiActivationDebugModel = ({
    input = null,
    habitSignal = null,
    cultivationState = null,
    readiness = null,
} = {}) => {
    const sourceInput = input && typeof input === 'object' ? input : {};
    const summary = resolveZenBonsaiScoreSummary(sourceInput);
    const scoringMode = resolveZenBonsaiScoringMode(
        summary,
        resolveZenBonsaiInputScoringMode(sourceInput) || ZEN_BONSAI_SCORING_MODE.QUIET,
    );
    const entries = resolveZenBonsaiLedgerEntries(sourceInput).map(normalizeLedgerEntry);
    const categories = SCORE_CATEGORY_ORDER.map((category) => normalizeCategorySummary(summary, category));
    const activation = resolveActivationScore({
        summary,
        habitSignal,
        input: sourceInput,
    });
    const diagnostics = habitSignal?.diagnostics || {};
    const topDomainImpacts = aggregateSubjectImpacts(entries, { domainOnly: true, limit: 5 });
    const topScoreImpacts = aggregateSubjectImpacts(entries, { domainOnly: false, limit: 5 });
    const recoveryHints = buildRecoveryHints({
        entries,
        readiness,
        summary,
    });

    return Object.freeze({
        version: ZEN_BONSAI_ACTIVATION_DEBUG_VERSION,
        activation,
        scoring: Object.freeze({
            scoringMode,
            scored: habitSignal?.scored === true,
            available: habitSignal?.available === true,
            baseScore: round(Number(summary?.baseScore) || 100, 2),
            totalDeduction: round(Number(summary?.totalDeduction) || 0, 2),
            totalCreditApplied: round(Number(summary?.totalCreditApplied) || 0, 2),
            totalCreditAvailable: round(Number(summary?.totalCreditAvailable) || 0, 2),
            criteriaCoverage: summary?.criteriaCoverage
                ? Object.freeze({ ...summary.criteriaCoverage })
                : null,
            registeredSiteGoalCount: resolveZenBonsaiRegisteredSiteGoalCount(sourceInput) ?? 0,
        }),
        pressure: Object.freeze({
            scoreRatio: round(diagnostics.scoreRatio ?? activation.scoreRatio),
            habitPressure: round(diagnostics.habitPressure),
            userRulePressure: round(diagnostics.userRulePressure),
            siteRulePressure: round(diagnostics.siteRulePressure),
            unmanagedPressure: round(diagnostics.unmanagedPressure),
            recovery: round(diagnostics.recovery ?? habitSignal?.recovery),
            disturbance: round(habitSignal?.disturbance),
            vitality: round(habitSignal?.vitality ?? cultivationState?.vitality),
            stress: round(habitSignal?.stress ?? cultivationState?.stress),
            dryness: round(habitSignal?.dryness ?? cultivationState?.dryness),
            damageGate: round(cultivationState?.damageGate),
            effectiveHealthRatio: round(cultivationState?.effectiveHealthRatio),
        }),
        categories: Object.freeze(categories),
        entries: Object.freeze(entries),
        topDomainImpacts,
        topScoreImpacts,
        recoveryHints,
    });
};

export default resolveZenBonsaiActivationDebugModel;
