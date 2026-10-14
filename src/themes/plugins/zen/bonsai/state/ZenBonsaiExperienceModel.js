import {
    resolveZenBonsaiCount,
    resolveZenBonsaiCultivationState,
    resolveZenBonsaiDataDays,
    resolveZenBonsaiGrowthReadiness,
    resolveZenBonsaiMs,
} from '../../model/ZenBonsaiCultivationPolicy.js';
import {
    resolveZenBonsaiRegisteredSiteGoalCount,
} from '../../model/ZenBonsaiVisualHealthInput.js';
import {
    resolveZenBonsaiHabitSignal,
} from '../../model/ZenBonsaiHabitSignal.js';
import {
    resolveZenBonsaiActivationDebugModel,
} from './ZenBonsaiActivationDebugModel.js';
import {
    createZenBonsaiActivationPresentation,
} from '../../model/bonsai/presentation/ZenBonsaiActivationPresentation.js';

export const ZEN_BONSAI_EXPERIENCE_STATUS = Object.freeze({
    UNREGISTERED: 'unregistered',
    CALIBRATING: 'calibrating',
    SEEDLING: 'seedling',
    GROWING: 'growing',
    SETTLING: 'settling',
    THRIVING: 'thriving',
    STRAINED: 'strained',
});

const HOUR_MS = 60 * 60 * 1000;
const FULL_DAY_ANCHOR = 10;

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

const smoothstep01 = (value) => {
    const t = clamp01(value);
    return t * t * (3 - (2 * t));
};

const resolveProjectionProgress = (projection = null) => {
    const progress = Number(projection?.progress);
    return Number.isFinite(progress) ? clamp01(progress) : null;
};

const resolveEvidence = (input = {}) => Object.freeze({
    registeredSiteCount: resolveZenBonsaiRegisteredSiteGoalCount(input) ?? 0,
    dataDays: resolveZenBonsaiDataDays(input),
    protectedVisitCount: resolveZenBonsaiCount(
        input?.protectedVisitCount,
        input?.metrics?.protectedVisitCount,
    ),
    activeProtectionDayCount: resolveZenBonsaiCount(
        input?.activeProtectionDayCount,
        input?.metrics?.activeProtectionDayCount,
    ),
    frictionSuccessCount: resolveZenBonsaiCount(
        input?.frictionSuccessCount,
        input?.metrics?.frictionSuccessCount,
    ),
    todayActiveMs: resolveZenBonsaiMs(input?.todayActiveMs, input?.metrics?.todayActiveMs),
    todayProtectedMs: resolveZenBonsaiMs(input?.todayProtectedMs, input?.metrics?.todayProtectedMs),
    weeklyProtectedAverageMs: resolveZenBonsaiMs(
        input?.weeklyProtectedAverageMs,
        input?.metrics?.weeklyProtectedAverageMs,
    ),
});

const resolveGuaranteedProgress = (evidence) => {
    const registrationProgress = evidence.registeredSiteCount > 0 ? 0.18 : 0.06;
    const dayProgress = smoothstep01(evidence.dataDays / FULL_DAY_ANCHOR) * 0.36;
    const activeProgress = clamp01(evidence.todayActiveMs / HOUR_MS) * 0.08;
    const protectedTodayProgress = clamp01(evidence.todayProtectedMs / (45 * 60 * 1000)) * 0.22;
    const protectedWeeklyProgress = clamp01(evidence.weeklyProtectedAverageMs / (35 * 60 * 1000)) * 0.12;

    return clamp01(
        registrationProgress
        + dayProgress
        + activeProgress
        + protectedTodayProgress
        + protectedWeeklyProgress,
    );
};

const resolvePracticeBonus = (evidence) => clamp01(
    (clamp01(evidence.protectedVisitCount / 14) * 0.38)
    + (clamp01(evidence.activeProtectionDayCount / 5) * 0.24)
    + (clamp01(evidence.frictionSuccessCount / 8) * 0.22)
    + (clamp01(evidence.weeklyProtectedAverageMs / HOUR_MS) * 0.16),
);

const resolveStatus = ({
    registeredSiteCount,
    phase,
    visibleProgress,
    calibrationProgress,
    vitality,
    stress,
    dryness,
    fullFormReady,
}) => {
    if (registeredSiteCount <= 0) {
        return ZEN_BONSAI_EXPERIENCE_STATUS.UNREGISTERED;
    }
    if (stress > 0.42 || dryness > 0.42) {
        return ZEN_BONSAI_EXPERIENCE_STATUS.STRAINED;
    }
    if (fullFormReady && vitality >= 0.72) {
        return ZEN_BONSAI_EXPERIENCE_STATUS.THRIVING;
    }
    if (calibrationProgress < 1) {
        return ZEN_BONSAI_EXPERIENCE_STATUS.CALIBRATING;
    }
    if (visibleProgress >= 0.78) {
        return ZEN_BONSAI_EXPERIENCE_STATUS.SETTLING;
    }
    if (phase === 'seedling') {
        return ZEN_BONSAI_EXPERIENCE_STATUS.SEEDLING;
    }
    return ZEN_BONSAI_EXPERIENCE_STATUS.GROWING;
};

const resolvePresentation = (status) => Object.freeze({
    status,
    sealTone: status,
    labelKey: `core_status.status_seal.label_${status}`,
    detailKey: `core_status.status_seal.detail_${status}`,
    progressLabelKey: 'core_status.status_seal.progress_label',
});

const resolveActivationPresentation = ({
    habitSignal = null,
    cultivationState = null,
} = {}) => {
    if (habitSignal?.scored !== true || !cultivationState) {
        return null;
    }
    const scoreRatio = habitSignal?.diagnostics?.scoreRatio;
    if (typeof scoreRatio !== 'number' || !Number.isFinite(scoreRatio)) {
        throw new Error('ZEN_BONSAI_ACTIVATION_PRESENTATION_SCORE_RATIO_REQUIRED');
    }
    return createZenBonsaiActivationPresentation({
        ratio: scoreRatio,
        reliability: cultivationState.sampleReliability,
    });
};

export const resolveZenBonsaiExperienceModel = ({
    input = null,
    lifeState = null,
    targetLifeState = null,
    currentProjection = null,
    targetProjection = null,
    habitSignal = null,
} = {}) => {
    const sourceInput = input && typeof input === 'object' ? input : {};
    const readiness = resolveZenBonsaiGrowthReadiness(sourceInput);
    const cultivationState = resolveZenBonsaiCultivationState(sourceInput);
    const resolvedHabitSignal = habitSignal && typeof habitSignal === 'object'
        ? habitSignal
        : resolveZenBonsaiHabitSignal(sourceInput);
    const evidence = resolveEvidence(sourceInput);
    const guaranteedProgress = resolveGuaranteedProgress(evidence);
    const practiceBonus = resolvePracticeBonus(evidence);
    const currentProjectionProgress = resolveProjectionProgress(currentProjection);
    const targetProjectionProgress = resolveProjectionProgress(targetProjection);
    const readinessProgress = clamp01(Number(readiness?.completionRatio) || 0);
    const visibleProgress = Math.max(
        currentProjectionProgress ?? 0,
        guaranteedProgress * 0.82,
        (guaranteedProgress * 0.64) + (practiceBonus * 0.26) + (readinessProgress * 0.1),
    );
    const targetProgress = Math.max(
        targetProjectionProgress ?? 0,
        visibleProgress,
        guaranteedProgress,
    );
    const phase = typeof lifeState?.phase === 'string'
        ? lifeState.phase
        : (cultivationState?.phase || readiness?.phase || 'seedling');
    const vitality = clamp01(lifeState?.vitality ?? cultivationState?.vitality ?? 0.68);
    const bloom = clamp01(lifeState?.bloom ?? cultivationState?.bloom ?? 0);
    const dryness = clamp01(lifeState?.dryness ?? cultivationState?.dryness ?? 0);
    const stress = clamp01(lifeState?.stress ?? cultivationState?.stress ?? 0);
    const windResponse = clamp01(lifeState?.windResponse ?? cultivationState?.windResponse ?? 0.68);
    const calibrationProgress = clamp01(cultivationState?.calibrationProgress ?? readiness?.calibrationProgress ?? 0);
    const sampleReliability = clamp01(cultivationState?.sampleReliability ?? 0);
    const status = resolveStatus({
        registeredSiteCount: evidence.registeredSiteCount,
        phase,
        visibleProgress,
        calibrationProgress,
        vitality,
        stress,
        dryness,
        fullFormReady: readiness?.fullFormReady === true,
    });
    const activationDebug = resolveZenBonsaiActivationDebugModel({
        input: sourceInput,
        habitSignal: resolvedHabitSignal,
        cultivationState,
        readiness,
    });
    const activationPresentation = resolveActivationPresentation({
        habitSignal: resolvedHabitSignal,
        cultivationState,
    });

    return Object.freeze({
        maturity: Object.freeze({
            phase,
            visibleProgress: round(visibleProgress),
            targetProgress: round(targetProgress),
            guaranteedProgress: round(guaranteedProgress),
            practiceBonus: round(practiceBonus),
            fullFormReady: readiness?.fullFormReady === true,
        }),
        vigor: Object.freeze({
            vitality: round(vitality),
            bloom: round(bloom),
            dryness: round(dryness),
            stress: round(stress),
            windResponse: round(windResponse),
        }),
        confidence: Object.freeze({
            sampleReliability: round(sampleReliability),
            calibrationProgress: round(calibrationProgress),
            baselineReady: sampleReliability >= 0.68,
        }),
        presentation: Object.freeze({
            ...resolvePresentation(status),
            activationPresentation,
        }),
        diagnostics: Object.freeze({
            readiness,
            cultivationState,
            evidence,
            currentProjection,
            targetProjection,
            targetLifeState,
            activationDebug,
        }),
    });
};

export default resolveZenBonsaiExperienceModel;
