import {
    resolveZenBonsaiHabitSignal,
} from './ZenBonsaiHabitSignal.js';
import {
    resolveZenBonsaiRegisteredSiteGoalCount,
    resolveZenBonsaiScoreSummary,
    ZEN_BONSAI_SCORING_MODE,
} from './ZenBonsaiVisualHealthInput.js';
import {
    resolveZenBonsaiTierVigor,
} from './ZenBonsaiVitalityModel.js';
import {
    ZEN_BONSAI_INITIAL_FORM_GROWTH,
} from './ZenBonsaiLifeState.js';

export { ZEN_BONSAI_INITIAL_FORM_GROWTH } from './ZenBonsaiLifeState.js';

export const ZEN_BONSAI_CULTIVATION_STAGES = Object.freeze({
    UNREGISTERED: 'unregistered',
    REGISTERED_UNSEEDED: 'registered_unseeded',
    CALIBRATING: 'calibrating',
    CULTIVATING: 'cultivating',
});

export const ZEN_BONSAI_CULTIVATION_POLICY = Object.freeze({
    calibrationEvidenceDays: 7,
    damageGateStartDays: 3,
    seedlingScoreMax: 24,
    establishmentGrowthScoreMax: 24,
    matureScoreMin: 70,
    fullFormScore: 88,
    healthySeedlingScore: 100,
    baselineScore: 86,
    baselineDeltaWeight: 1.35,
    adaptiveBaselineMinSensitivity: 0.82,
});

export const ZEN_BONSAI_FULL_FORM_TARGETS = Object.freeze({
    registeredSiteCount: 1,
    evidenceDays: 7,
    growthScore: 88,
    protectedVisitCount: 7,
    activeProtectionDayCount: 7,
    frictionSuccessCount: 4,
    todayProtectedMs: 45 * 60 * 1000,
    weeklyProtectedAverageMs: 35 * 60 * 1000,
});

const ZEN_BONSAI_MATURITY_SCORE_WEIGHTS = Object.freeze({
    registeredSite: 12,
    evidenceAge: 30,
    protectedPractice: 22,
    activeProtectionDays: 14,
    frictionPractice: 16,
    todayProtectedTime: 3,
    weeklyProtectedRhythm: 3,
});

const HOUR_MS = 60 * 60 * 1000;

const clamp = (value, min = 0, max = 1) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return min;
    return Math.min(max, Math.max(min, numeric));
};

const clamp01 = (value) => clamp(value, 0, 1);
const lerp = (a, b, t) => a + ((b - a) * clamp01(t));
const smoothstep01 = (value) => {
    const t = clamp01(value);
    return t * t * (3 - (2 * t));
};
const round = (value, digits = 4) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Number(numeric.toFixed(digits));
};
const isFiniteValue = (value) => (
    value !== null
    && value !== undefined
    && value !== ''
    && Number.isFinite(Number(value))
);

export const resolveZenBonsaiCount = (...values) => {
    for (const value of values) {
        const numeric = Number(value);
        if (Number.isFinite(numeric)) {
            return Math.max(0, Math.floor(numeric));
        }
    }
    return 0;
};

export const resolveZenBonsaiMs = (...values) => {
    for (const value of values) {
        const numeric = Number(value);
        if (Number.isFinite(numeric)) {
            return Math.max(0, numeric);
        }
    }
    return 0;
};

const resolvePercentRatio = (...values) => {
    for (const value of values) {
        const numeric = Number(value);
        if (Number.isFinite(numeric)) {
            return clamp01(numeric / 100);
        }
    }
    return null;
};

export const resolveZenBonsaiDataDays = (input = {}) => resolveZenBonsaiCount(
    input?.daysTracked,
    input?.trackedDateCount,
    input?.dataDays,
    input?.metrics?.trackedDateCount,
);

const resolveExplicitGrowthScore = (input = {}) => {
    const explicit = Number(
        input?.bonsaiGrowthScore
        ?? input?.progressionGrowthScore
        ?? input?.metrics?.bonsaiGrowthScore
        ?? input?.metrics?.progressionGrowthScore,
    );
    return Number.isFinite(explicit) ? clamp(explicit, 0, 100) : null;
};

const resolveProgressionBonsaiReleaseInput = (input = {}) => (
    input && Object.prototype.hasOwnProperty.call(input, 'bonsaiRelease')
        ? input.bonsaiRelease
        : null
);

const resolveProtectedEvidence = (input = {}) => {
    const protectedVisitCount = resolveZenBonsaiCount(
        input?.protectedVisitCount,
        input?.metrics?.protectedVisitCount,
    );
    const activeProtectionDayCount = resolveZenBonsaiCount(
        input?.activeProtectionDayCount,
        input?.metrics?.activeProtectionDayCount,
    );
    const frictionSuccessCount = resolveZenBonsaiCount(
        input?.frictionSuccessCount,
        input?.metrics?.frictionSuccessCount,
    );
    const todayProtectedMs = resolveZenBonsaiMs(input?.todayProtectedMs, input?.metrics?.todayProtectedMs);
    const weeklyProtectedAverageMs = resolveZenBonsaiMs(
        input?.weeklyProtectedAverageMs,
        input?.metrics?.weeklyProtectedAverageMs,
    );

    const visitEvidenceDays = protectedVisitCount > 0
        ? Math.min(7, Math.ceil(protectedVisitCount / 3))
        : 0;
    const frictionEvidenceDays = frictionSuccessCount > 0
        ? Math.min(7, Math.ceil(frictionSuccessCount / 2))
        : 0;
    const protectedMsEvidenceDays = Math.max(
        todayProtectedMs > 0 ? 1 : 0,
        weeklyProtectedAverageMs > 0 ? 2 : 0,
    );
    const evidenceDays = Math.max(
        activeProtectionDayCount,
        visitEvidenceDays,
        frictionEvidenceDays,
        protectedMsEvidenceDays,
    );

    return {
        protectedVisitCount,
        activeProtectionDayCount,
        frictionSuccessCount,
        todayProtectedMs,
        weeklyProtectedAverageMs,
        evidenceDays,
    };
};

const resolveCultivationStage = ({
    registeredSiteCount = 0,
    evidenceDays = 0,
} = {}) => {
    if (registeredSiteCount <= 0) return ZEN_BONSAI_CULTIVATION_STAGES.UNREGISTERED;
    if (evidenceDays <= 0) return ZEN_BONSAI_CULTIVATION_STAGES.REGISTERED_UNSEEDED;
    return evidenceDays < ZEN_BONSAI_CULTIVATION_POLICY.calibrationEvidenceDays
        ? ZEN_BONSAI_CULTIVATION_STAGES.CALIBRATING
        : ZEN_BONSAI_CULTIVATION_STAGES.CULTIVATING;
};

const resolveCultivationGrowthScore = ({
    registeredSiteCount,
    protectedVisitCount,
    activeProtectionDayCount,
    frictionSuccessCount,
    todayProtectedMs,
    weeklyProtectedAverageMs,
    explicitGrowthScore,
} = {}) => {
    if (explicitGrowthScore !== null && explicitGrowthScore !== undefined) {
        return explicitGrowthScore;
    }

    return clamp(
        resolveCultivationMaturityComponents({
            registeredSiteCount,
            protectedVisitCount,
            activeProtectionDayCount,
            frictionSuccessCount,
            todayProtectedMs,
            weeklyProtectedAverageMs,
        }).reduce((total, metric) => total + metric.scoreContribution, 0),
        0,
        100,
    );
};

const resolveEffectiveCultivationGrowthScore = ({
    rawGrowthScore,
    explicitGrowthScore,
    inputVitality,
} = {}) => {
    if (inputVitality || explicitGrowthScore !== null) {
        return rawGrowthScore;
    }
    return Math.min(rawGrowthScore, ZEN_BONSAI_CULTIVATION_POLICY.establishmentGrowthScoreMax);
};

const buildProgressMetric = ({
    id,
    label,
    value = 0,
    target = 1,
    unit = 'count',
    required = true,
    weight = 0,
} = {}) => {
    const safeValue = Math.max(0, Number(value) || 0);
    const safeTarget = Math.max(0, Number(target) || 0);
    const ratio = safeTarget > 0 ? clamp01(safeValue / safeTarget) : 1;
    const safeWeight = Math.max(0, Number(weight) || 0);
    const scoreContribution = safeWeight * smoothstep01(ratio);
    return Object.freeze({
        id,
        label,
        value: round(safeValue, unit === 'minutes' ? 1 : 0),
        target: round(safeTarget, unit === 'minutes' ? 1 : 0),
        unit,
        weight: round(safeWeight, 1),
        scoreContribution: round(scoreContribution, 1),
        remainingContribution: round(Math.max(0, safeWeight - scoreContribution), 1),
        progressRatio: round(ratio),
        complete: ratio >= 1,
        required,
    });
};

const resolveCultivationMaturityComponents = ({
    registeredSiteCount = 0,
    evidenceDays = null,
    protectedVisitCount = 0,
    activeProtectionDayCount = 0,
    frictionSuccessCount = 0,
    todayProtectedMs = 0,
    weeklyProtectedAverageMs = 0,
} = {}) => {
    const targets = ZEN_BONSAI_FULL_FORM_TARGETS;
    const resolvedEvidenceDays = evidenceDays === null
        ? resolveProtectedEvidence({
            protectedVisitCount,
            activeProtectionDayCount,
            frictionSuccessCount,
            todayProtectedMs,
            weeklyProtectedAverageMs,
        }).evidenceDays
        : evidenceDays;

    return Object.freeze([
        buildProgressMetric({
            id: 'registered_site',
            label: 'Protected site',
            value: registeredSiteCount,
            target: targets.registeredSiteCount,
            weight: ZEN_BONSAI_MATURITY_SCORE_WEIGHTS.registeredSite,
        }),
        buildProgressMetric({
            id: 'calibration_days',
            label: 'Evidence days',
            value: resolvedEvidenceDays,
            target: targets.evidenceDays,
            weight: ZEN_BONSAI_MATURITY_SCORE_WEIGHTS.evidenceAge,
        }),
        buildProgressMetric({
            id: 'protected_visits',
            label: 'Protected visits',
            value: protectedVisitCount,
            target: targets.protectedVisitCount,
            weight: ZEN_BONSAI_MATURITY_SCORE_WEIGHTS.protectedPractice,
        }),
        buildProgressMetric({
            id: 'active_days',
            label: 'Active protection days',
            value: activeProtectionDayCount,
            target: targets.activeProtectionDayCount,
            weight: ZEN_BONSAI_MATURITY_SCORE_WEIGHTS.activeProtectionDays,
        }),
        buildProgressMetric({
            id: 'friction_successes',
            label: 'Friction completions',
            value: frictionSuccessCount,
            target: targets.frictionSuccessCount,
            weight: ZEN_BONSAI_MATURITY_SCORE_WEIGHTS.frictionPractice,
        }),
        buildProgressMetric({
            id: 'today_protected_minutes',
            label: 'Today protected',
            value: todayProtectedMs / 60000,
            target: targets.todayProtectedMs / 60000,
            unit: 'minutes',
            required: false,
            weight: ZEN_BONSAI_MATURITY_SCORE_WEIGHTS.todayProtectedTime,
        }),
        buildProgressMetric({
            id: 'weekly_protected_average',
            label: 'Weekly protected avg',
            value: weeklyProtectedAverageMs / 60000,
            target: targets.weeklyProtectedAverageMs / 60000,
            unit: 'minutes',
            required: false,
            weight: ZEN_BONSAI_MATURITY_SCORE_WEIGHTS.weeklyProtectedRhythm,
        }),
    ]);
};

const resolveLifePhase = (growthScore) => {
    if (growthScore <= ZEN_BONSAI_CULTIVATION_POLICY.seedlingScoreMax) return 'seedling';
    if (growthScore < ZEN_BONSAI_CULTIVATION_POLICY.matureScoreMin) return 'juvenile';
    return 'mature';
};

const resolveMaturityConfidence = (growthScore) => smoothstep01(
    (
        clamp(growthScore, 0, 100)
        - ZEN_BONSAI_CULTIVATION_POLICY.seedlingScoreMax
    )
    / (
        ZEN_BONSAI_CULTIVATION_POLICY.fullFormScore
        - ZEN_BONSAI_CULTIVATION_POLICY.seedlingScoreMax
    ),
);

export const resolveZenBonsaiLifeMaturityFromGrowthScore = (value) => {
    const growthScore = clamp(Number(value), 0, 100);
    return Object.freeze({
        growthScore: round(growthScore),
        phase: resolveLifePhase(growthScore),
        growth: round(clamp(
            ZEN_BONSAI_INITIAL_FORM_GROWTH
                + (
                    smoothstep01(growthScore / 100)
                    * (1 - ZEN_BONSAI_INITIAL_FORM_GROWTH)
                ),
            ZEN_BONSAI_INITIAL_FORM_GROWTH,
            1,
        )),
        analysisConfidence: round(resolveMaturityConfidence(growthScore)),
    });
};

const resolveObservedHealthRatio = (input = {}, habitSignal = null) => {
    if (habitSignal?.available) {
        return clamp01(
            (Number(habitSignal.vitality) * 0.74)
            + ((1 - Number(habitSignal.stress)) * 0.16)
            + ((1 - Number(habitSignal.dryness)) * 0.1),
        );
    }
    return resolvePercentRatio(
        input?.dailyDisplayScore,
        input?.dailyScore,
        input?.cycleScore,
        input?.integrityScore,
        input?.metrics?.dailyDisplayScore,
        input?.metrics?.dailyScore,
        input?.metrics?.cycleScore,
        input?.metrics?.integrityScore,
    ) ?? (ZEN_BONSAI_CULTIVATION_POLICY.baselineScore / 100);
};

const resolveCultivationBaseline = (input = {}) => {
    const source = input?.bonsaiCultivationBaseline || input?.cultivationBaseline || null;
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
        return null;
    }
    const healthRatio = Number(
        source.targetHealthRatio
        ?? source.effectiveHealthRatio
        ?? source.centerHealthRatio
        ?? source.adaptiveEffectiveHealthRatio
        ?? source.healthRatio,
    );
    if (!Number.isFinite(healthRatio)) {
        return null;
    }
    return Object.freeze({
        healthRatio: clamp01(healthRatio),
        initialPriorHealthRatio: isFiniteValue(source.initialPriorHealthRatio)
            ? clamp01(Number(source.initialPriorHealthRatio))
            : null,
        sealedHealthRatio: isFiniteValue(source.sealedHealthRatio)
            ? clamp01(Number(source.sealedHealthRatio))
            : null,
        centerHealthRatio: isFiniteValue(source.centerHealthRatio)
            ? clamp01(Number(source.centerHealthRatio))
            : null,
        targetHealthRatio: isFiniteValue(source.targetHealthRatio)
            ? clamp01(Number(source.targetHealthRatio))
            : null,
        adaptiveHealthRatio: isFiniteValue(source.adaptiveHealthRatio)
            ? clamp01(Number(source.adaptiveHealthRatio))
            : null,
        adaptiveConfidence: clamp01(source.adaptiveConfidence),
        contextShift: clamp01(source.contextShift),
        growthScore: Number.isFinite(Number(source.growthScore))
            ? clamp(Number(source.growthScore), 0, 100)
            : null,
        evidenceDays: resolveZenBonsaiCount(source.evidenceDays),
        calibratedAtMs: Math.max(0, Number(source.calibratedAtMs) || 0),
    });
};

const applyCultivationBaseline = (observedHealthRatio, baseline = null) => {
    if (!baseline) {
        return clamp01(observedHealthRatio);
    }
    const neutral = ZEN_BONSAI_CULTIVATION_POLICY.baselineScore / 100;
    const confidence = clamp01(baseline.adaptiveConfidence);
    const sensitivity = ZEN_BONSAI_CULTIVATION_POLICY.baselineDeltaWeight
        * lerp(
            ZEN_BONSAI_CULTIVATION_POLICY.adaptiveBaselineMinSensitivity,
            1,
            confidence,
        );
    return clamp01(
        neutral
        + ((clamp01(observedHealthRatio) - baseline.healthRatio) * sensitivity),
    );
};

// Vitality presentation threaded from the cultivation ledger (spec §2/§4):
// once active it owns the growth score and the vigor channels.
export const resolveZenBonsaiInputVitality = (input = {}) => {
    const source = input?.bonsaiVitality || input?.metrics?.bonsaiVitality || null;
    if (!source || typeof source !== 'object' || source.active !== true) return null;
    const healthH = Number(source.healthH);
    const growthScore = Number(source.growthScore);
    if (!Number.isFinite(healthH) || !Number.isFinite(growthScore)) return null;
    return source;
};

const resolveScoreCriteriaCoverage = (input = {}) => {
    const summary = resolveZenBonsaiScoreSummary(input);
    const coverage = summary?.criteriaCoverage
        || input?.scoreCriteriaCoverage
        || input?.metrics?.scoreCriteriaCoverage
        || null;
    return coverage && typeof coverage === 'object' ? coverage : null;
};

const resolveSampleReliability = ({
    input = {},
    evidence,
    habitSignal,
} = {}) => {
    const coverage = resolveScoreCriteriaCoverage(input);
    const coverageRatio = Number(coverage?.coverageRatio);
    const coverageWeight = isFiniteValue(coverage?.coverageRatio)
        ? clamp01(coverageRatio)
        : (
            habitSignal?.scoringMode === ZEN_BONSAI_SCORING_MODE.SCORED
                ? 0.86
                : (habitSignal?.scoringMode === ZEN_BONSAI_SCORING_MODE.PARTIAL ? 0.48 : 0.28)
        );
    const scoringWeight = (() => {
        if (habitSignal?.scoringMode === ZEN_BONSAI_SCORING_MODE.SCORED) return 1;
        if (habitSignal?.scoringMode === ZEN_BONSAI_SCORING_MODE.PARTIAL) return 0.52;
        if (habitSignal?.scoringMode === ZEN_BONSAI_SCORING_MODE.OBSERVATION_ONLY) return 0.34;
        return 0.22;
    })();
    const evidenceWeight = clamp01((Number(evidence?.evidenceDays) || 0) / ZEN_BONSAI_CULTIVATION_POLICY.calibrationEvidenceDays);
    const activeMinutes = Math.max(0, Number(input?.todayActiveMs ?? input?.metrics?.todayActiveMs) || 0) / 60000;
    const activityWeight = activeMinutes > 0
        ? clamp(activeMinutes / 30, 0.35, 1)
        : (evidenceWeight > 0 ? 0.48 : 0.16);
    return clamp01(
        (evidenceWeight * 0.48)
        + (coverageWeight * 0.22)
        + (scoringWeight * 0.18)
        + (activityWeight * 0.12),
    );
};

export const resolveZenBonsaiCultivationState = (input = {}) => {
    const bonsaiRelease = resolveProgressionBonsaiReleaseInput(input);
    const registeredSiteCountInput = resolveZenBonsaiRegisteredSiteGoalCount(input);
    if (registeredSiteCountInput === null && !bonsaiRelease) {
        return null;
    }
    const registeredSiteCount = registeredSiteCountInput ?? 0;

    const evidence = resolveProtectedEvidence(input);
    const stage = resolveCultivationStage({
        registeredSiteCount,
        evidenceDays: evidence.evidenceDays,
    });
    const explicitGrowthScore = resolveExplicitGrowthScore(input);
    const inputVitality = stage === ZEN_BONSAI_CULTIVATION_STAGES.CULTIVATING
        ? resolveZenBonsaiInputVitality(input)
        : null;
    const rawGrowthScore = bonsaiRelease
        ? bonsaiRelease.growthScore
        : (inputVitality
            ? clamp(inputVitality.growthScore, 0, 100)
            : resolveCultivationGrowthScore({
                registeredSiteCount,
                explicitGrowthScore,
                ...evidence,
            }));
    const growthScore = bonsaiRelease
        ? rawGrowthScore
        : resolveEffectiveCultivationGrowthScore({
            rawGrowthScore,
            explicitGrowthScore,
            inputVitality,
        });
    const calibrationProgress = clamp01(
        evidence.evidenceDays / ZEN_BONSAI_CULTIVATION_POLICY.calibrationEvidenceDays,
    );
    const damageGate = stage === ZEN_BONSAI_CULTIVATION_STAGES.CULTIVATING
        ? 1
        : smoothstep01(
            (evidence.evidenceDays - ZEN_BONSAI_CULTIVATION_POLICY.damageGateStartDays)
            / (
                ZEN_BONSAI_CULTIVATION_POLICY.calibrationEvidenceDays
                - ZEN_BONSAI_CULTIVATION_POLICY.damageGateStartDays
            ),
        );
    const habitSignal = resolveZenBonsaiHabitSignal(input);
    const rawObservedHealthRatio = resolveObservedHealthRatio(input, habitSignal);
    const scoreCriteriaCoverage = resolveScoreCriteriaCoverage(input);
    const cultivationBaseline = resolveCultivationBaseline(input);
    const observedHealthRatio = stage === ZEN_BONSAI_CULTIVATION_STAGES.CULTIVATING
        ? applyCultivationBaseline(rawObservedHealthRatio, cultivationBaseline)
        : rawObservedHealthRatio;
    const effectiveHealthRatio = lerp(1, observedHealthRatio, damageGate);
    const practiceMomentum = clamp01(
        (evidence.frictionSuccessCount / 12) * 0.5
        + (evidence.protectedVisitCount / 18) * 0.32
        + (evidence.weeklyProtectedAverageMs / HOUR_MS) * 0.18,
    );
    const lifeMaturity = resolveZenBonsaiLifeMaturityFromGrowthScore(growthScore);
    const growth = bonsaiRelease
        ? round(lerp(
            ZEN_BONSAI_INITIAL_FORM_GROWTH,
            1,
            smoothstep01(bonsaiRelease.releaseRatio),
        ))
        : lifeMaturity.growth;
    const phase = lifeMaturity.phase;
    const maturityConfidence = lifeMaturity.analysisConfidence;
    const matureBlend = phase === 'mature'
        ? 1
        : (phase === 'juvenile' ? clamp01((growthScore - 24) / 46) : 0);
    const tierVigor = inputVitality
        ? resolveZenBonsaiTierVigor(inputVitality.tier, inputVitality.healthH, {
            recoveryOverlay: inputVitality.recoveryOverlay === true,
        })
        : null;
    const rawStress = habitSignal.available
        ? Number(habitSignal.stress)
        : (1 - effectiveHealthRatio) * 0.68;
    const rawDryness = habitSignal.available
        ? Number(habitSignal.dryness)
        : (1 - effectiveHealthRatio) * 0.54;
    const stress = tierVigor
        ? tierVigor.stress
        : clamp01(rawStress * damageGate * (1 - practiceMomentum * 0.18));
    const dryness = tierVigor
        ? tierVigor.dryness
        : clamp01(rawDryness * damageGate * (1 - practiceMomentum * 0.22));
    const vitality = tierVigor
        ? tierVigor.vitality
        : clamp01(
            0.28
            + (effectiveHealthRatio * 0.68)
            + (practiceMomentum * 0.08)
            - (stress * 0.08),
        );
    const bloom = phase === 'seedling'
        ? 0
        : (tierVigor
            ? clamp01(tierVigor.bloom * matureBlend)
            : clamp01(
                matureBlend
                * (0.08 + (effectiveHealthRatio * 0.72) + (practiceMomentum * 0.16))
                * (1 - dryness * 0.32),
            ));
    const branchSag = tierVigor
        ? tierVigor.branchSag
        : clamp01(dryness * (0.62 + damageGate * 0.22));
    const windResponse = tierVigor
        ? tierVigor.windResponse
        : clamp01(
            (0.58 + vitality * 0.34 + practiceMomentum * 0.08)
            * (0.68 + growth * 0.32),
        );
    const sampleReliability = resolveSampleReliability({
        input,
        evidence,
        habitSignal,
    });
    const maturity = Object.freeze({
        phase,
        growth: round(growth),
        dataDays: bonsaiRelease?.qualifiedUseDayCount ?? evidence.evidenceDays,
        analysisConfidence: round(maturityConfidence),
    });
    const vigor = Object.freeze({
        vitality: round(vitality),
        stress: round(stress),
        bloom: round(bloom),
        dryness: round(dryness),
        branchSag: round(branchSag),
        windResponse: round(windResponse),
    });

    return Object.freeze({
        stage,
        releaseDriven: bonsaiRelease !== null,
        registeredSiteCount,
        evidenceDays: evidence.evidenceDays,
        dataDays: maturity.dataDays,
        calibrationProgress: round(calibrationProgress),
        damageGate: round(damageGate),
        practiceMomentum: round(practiceMomentum),
        growthScore: round(growthScore),
        maturityScore: round(growthScore),
        maturityProgressRatio: round(
            bonsaiRelease?.releaseRatio
            ?? clamp01(growthScore / ZEN_BONSAI_CULTIVATION_POLICY.fullFormScore),
        ),
        sampleReliability: round(sampleReliability),
        scoringMode: habitSignal.scoringMode,
        habitSignalAvailable: habitSignal.available === true,
        habitSignalScored: habitSignal.scored === true,
        scoreCoverageRatio: isFiniteValue(scoreCriteriaCoverage?.coverageRatio)
            ? round(clamp01(Number(scoreCriteriaCoverage.coverageRatio)))
            : null,
        scoreDisplayReady: scoreCriteriaCoverage?.displayReady === true,
        vitalityActive: Boolean(inputVitality),
        vitalityTier: inputVitality?.tier || null,
        vitalityHealth: inputVitality ? round(clamp01(inputVitality.healthH)) : null,
        vitalityRecoveryOverlay: inputVitality?.recoveryOverlay === true,
        vitalityMicroFeedback: inputVitality?.microFeedback || null,
        vitalityMilestone: inputVitality ? Math.max(0, Math.floor(Number(inputVitality.lastMilestone) || 0)) : null,
        vitalityMilestoneEventDateKey: inputVitality?.milestoneEventDateKey || null,
        vitalityLastClosedDateKey: inputVitality?.lastClosedDateKey || null,
        todayActiveMs: resolveZenBonsaiMs(input?.todayActiveMs, input?.metrics?.todayActiveMs),
        rawObservedHealthRatio: round(rawObservedHealthRatio),
        observedHealthRatio: round(observedHealthRatio),
        effectiveHealthRatio: round(effectiveHealthRatio),
        phase: maturity.phase,
        growth: maturity.growth,
        vitality: vigor.vitality,
        stress: vigor.stress,
        bloom: vigor.bloom,
        dryness: vigor.dryness,
        branchSag: vigor.branchSag,
        windResponse: vigor.windResponse,
        analysisConfidence: maturity.analysisConfidence,
        maturity,
        vigor,
    });
};

export const resolveZenBonsaiGrowthReadiness = (input = {}) => {
    const registeredSiteCount = resolveZenBonsaiRegisteredSiteGoalCount(input) ?? 0;
    const evidence = resolveProtectedEvidence(input);
    const explicitGrowthScore = resolveExplicitGrowthScore(input);
    const cultivationState = resolveZenBonsaiCultivationState(input);
    const inputVitality = resolveZenBonsaiInputVitality(input);
    const releaseDriven = cultivationState?.releaseDriven === true;
    const rawGrowthScore = cultivationState?.growthScore
        ?? resolveCultivationGrowthScore({
            registeredSiteCount,
            explicitGrowthScore,
            ...evidence,
        });
    const growthScore = resolveEffectiveCultivationGrowthScore({
        rawGrowthScore,
        explicitGrowthScore,
        inputVitality,
    });
    const stage = cultivationState?.stage || resolveCultivationStage({
        registeredSiteCount,
        evidenceDays: evidence.evidenceDays,
    });
    const targets = ZEN_BONSAI_FULL_FORM_TARGETS;
    const hasRegisteredSite = registeredSiteCount >= targets.registeredSiteCount;
    const calibrationReady = evidence.evidenceDays >= targets.evidenceDays;
    const growthReady = releaseDriven
        ? cultivationState.maturityProgressRatio >= 1
        : growthScore >= targets.growthScore;
    const completionRatio = releaseDriven
        ? cultivationState.maturityProgressRatio
        : (hasRegisteredSite ? clamp01(growthScore / targets.growthScore) : 0);
    const fullFormReady = releaseDriven
        ? completionRatio >= 1
        : hasRegisteredSite && growthReady;
    const metrics = resolveCultivationMaturityComponents({
        registeredSiteCount,
        ...evidence,
    });
    const growthGap = fullFormReady || growthReady
        ? []
        : [Object.freeze({
            id: 'growth_score',
            label: 'Growth score',
            value: round(growthScore),
            target: round(targets.growthScore),
            unit: 'score',
            weight: round(targets.growthScore),
            scoreContribution: round(growthScore),
            remainingContribution: round(Math.max(0, targets.growthScore - growthScore)),
            progressRatio: round(clamp01(growthScore / targets.growthScore)),
            complete: false,
            required: true,
        })];
    const growthOpportunities = fullFormReady
        ? []
        : [
            ...metrics.filter((metric) => metric.remainingContribution > 0 && metric.required),
            ...growthGap,
        ].sort((left, right) => right.remainingContribution - left.remainingContribution);

    return Object.freeze({
        stage,
        releaseDriven,
        phase: cultivationState?.phase || 'seedling',
        registeredSiteCount,
        evidenceDays: evidence.evidenceDays,
        growthScore: round(growthScore),
        maturityScore: round(growthScore),
        completionRatio: round(completionRatio),
        completionPercent: Math.round(completionRatio * 100),
        fullFormReady,
        calibrationReady,
        growthReady,
        metrics,
        missing: Object.freeze(growthOpportunities),
        topMissing: Object.freeze(growthOpportunities.slice(0, 3)),
        growthOpportunities: Object.freeze(growthOpportunities),
        targets,
    });
};

export const buildZenBonsaiCultivationSignature = (input = {}) => {
    const registeredSiteCount = resolveZenBonsaiRegisteredSiteGoalCount(input);
    const evidence = resolveProtectedEvidence(input);
    const siteSignature = typeof input?.registeredSiteSignature === 'string'
        ? input.registeredSiteSignature.trim()
        : '';
    const baseline = resolveCultivationBaseline(input);
    const scoreCriteriaCoverage = resolveScoreCriteriaCoverage(input);
    const inputVitality = resolveZenBonsaiInputVitality(input);
    const releaseDayCount = input?.bonsaiRelease?.qualifiedUseDayCount;
    return [
        registeredSiteCount ?? 'site_unknown',
        siteSignature,
        evidence.protectedVisitCount,
        evidence.activeProtectionDayCount,
        evidence.frictionSuccessCount,
        Math.round(evidence.todayProtectedMs / 60000),
        Math.round(evidence.weeklyProtectedAverageMs / 60000),
        Math.round(resolveExplicitGrowthScore(input) ?? -1),
        Number.isInteger(releaseDayCount) ? `release_day_${releaseDayCount}` : 'release_none',
        Math.round((baseline?.healthRatio ?? -1) * 100),
        Math.round((baseline?.adaptiveConfidence ?? 0) * 100),
        Math.round((scoreCriteriaCoverage?.coverageRatio ?? -1) * 100),
        inputVitality
            ? [
                inputVitality.tier,
                Math.round(clamp01(inputVitality.healthH) * 1000),
                Math.round(clamp(inputVitality.growthScore, 0, 100) * 10),
                inputVitality.lastClosedDateKey || '',
                inputVitality.recoveryOverlay === true ? 'r1' : 'r0',
            ].join(':')
            : 'vitality_none',
    ].join('|');
};

export default resolveZenBonsaiCultivationState;
