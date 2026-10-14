import {
    buildZenBonsaiHabitSignalSignature,
} from './ZenBonsaiHabitSignal.js';
import {
    buildZenBonsaiCultivationSignature,
    resolveZenBonsaiCultivationState,
} from './ZenBonsaiCultivationPolicy.js';
import {
    ZEN_BONSAI_DEFAULT_LIFE_STATE,
    ZEN_BONSAI_INITIAL_FORM_GROWTH,
    normalizeZenBonsaiLifeGrowthSegments,
    normalizeZenBonsaiLifeState,
    normalizeZenBonsaiLifeStructuralImprint,
} from './ZenBonsaiLifeState.js';
import {
    isZenBonsaiFirstVisionPresentation,
    resolveZenBonsaiPresentationMode,
} from './ZenBonsaiPresentationPolicy.js';
export {
    applyZenBonsaiLifeToPondBioticSignal,
} from './zenBonsaiPondBioticSignal.js';
export {
    normalizeZenBonsaiLifeState,
} from './ZenBonsaiLifeState.js';

const FULL_ANALYSIS_DAYS = 7;
const DEFAULT_LIFE_STATE = ZEN_BONSAI_DEFAULT_LIFE_STATE;
const REALITY_SEEDLING_LIFE_STATE = Object.freeze({
    ...DEFAULT_LIFE_STATE,
    growth: ZEN_BONSAI_INITIAL_FORM_GROWTH,
    vitality: 0.86,
    stress: 0.03,
    dryness: 0.015,
    windResponse: 0.72,
});
const FIRST_VISION_LIFE_STATE = Object.freeze({
    phase: 'mature',
    growth: 1,
    vitality: 0.98,
    stress: 0,
    bloom: 1,
    dryness: 0,
    branchSag: 0,
    windResponse: 0.96,
    dataDays: FULL_ANALYSIS_DAYS,
    analysisConfidence: 1,
});
const resolveDataDays = (input = {}) => {
    const candidates = [
        input?.daysTracked,
        input?.trackedDateCount,
        input?.dataDays,
        input?.metrics?.trackedDateCount,
    ];
    for (const candidate of candidates) {
        const numeric = Number(candidate);
        if (Number.isFinite(numeric)) {
            return Math.max(0, Math.floor(numeric));
        }
    }
    return 0;
};
const clamp01 = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.min(1, Math.max(0, numeric)) : 0;
};

export const buildZenBonsaiLifecycleInputSignature = (input = {}) => {
    if (!input || typeof input !== 'object') {
        return 'zen_bonsai_lifecycle_input:none';
    }
    const structuralImprint = normalizeZenBonsaiLifeStructuralImprint(input);
    const growthSegments = normalizeZenBonsaiLifeGrowthSegments(input);
    return [
        resolveZenBonsaiPresentationMode(input),
        resolveDataDays(input),
        Math.round(Number(input?.cycleScore) || 0),
        Math.round(Number(input?.dailyDisplayScore) || 0),
        Math.round(Number(input?.dailyScore) || 0),
        Math.round(Number(input?.dailyLimitPercent) || 0),
        Math.round(Number(input?.signalCount) || 0),
        Math.round((Number(input?.todayActiveMs) || 0) / 60000),
        Math.round((Number(input?.todayProtectedMs) || 0) / 60000),
        Math.round((Number(input?.weeklyProtectedAverageMs) || 0) / 60000),
        buildZenBonsaiCultivationSignature(input),
        buildZenBonsaiHabitSignalSignature(input),
        structuralImprint?.active
            ? [
                Math.round(structuralImprint.exposureQuality * 100),
                Math.round(structuralImprint.stressWood * 100),
                Math.round(structuralImprint.recoveryWood * 100),
                Math.round(structuralImprint.volatility * 100),
                Math.round(structuralImprint.canopyReserve * 100),
                structuralImprint.lastUpdatedDateKey,
            ].join(':')
            : 'structure_none',
        growthSegments.length
            ? growthSegments
                .map((segment) => [
                    segment.milestone,
                    Math.round(segment.stressWood * 100),
                    Math.round(segment.recoveryWood * 100),
                    Math.round(segment.canopyReserve * 100),
                ].join(':'))
                .join(',')
            : 'segments_none',
    ].join('|');
};

export const resolveZenBonsaiLifecycleTarget = (input = {}) => {
    const source = input && typeof input === 'object' && !Array.isArray(input)
        ? input
        : {};
    for (const predecessorField of ['firstVisionPresentation', 'firstVisionReady']) {
        if (Object.prototype.hasOwnProperty.call(source, predecessorField)) {
            throw new Error(`ZEN_BONSAI_LIFECYCLE_PREDECESSOR_FIELD_FORBIDDEN:${predecessorField}`);
        }
    }
    if (isZenBonsaiFirstVisionPresentation(source)) {
        return normalizeZenBonsaiLifeState(FIRST_VISION_LIFE_STATE);
    }

    const cultivationState = resolveZenBonsaiCultivationState(source);
    if (cultivationState) {
        if (
            cultivationState.registeredSiteCount <= 0
            && cultivationState.releaseDriven !== true
        ) {
            return normalizeZenBonsaiLifeState(REALITY_SEEDLING_LIFE_STATE);
        }
        return normalizeZenBonsaiLifeState({
            phase: cultivationState.phase,
            growth: cultivationState.growth,
            vitality: cultivationState.vitality,
            stress: cultivationState.stress,
            bloom: cultivationState.bloom,
            dryness: cultivationState.dryness,
            branchSag: cultivationState.branchSag,
            windResponse: cultivationState.windResponse,
            dataDays: cultivationState.dataDays,
            analysisConfidence: cultivationState.analysisConfidence,
            vitalityRecoveryOverlay: cultivationState.vitalityRecoveryOverlay,
            vitalityMicroFeedback: cultivationState.vitalityMicroFeedback,
            vitalityMilestone: cultivationState.vitalityMilestone,
            vitalityMilestoneEventDateKey: cultivationState.vitalityMilestoneEventDateKey,
            vitalityLastClosedDateKey: cultivationState.vitalityLastClosedDateKey,
            bonsaiStructuralImprint: source.bonsaiStructuralImprint ?? source.metrics?.bonsaiStructuralImprint ?? null,
            bonsaiGrowthSegments: source.bonsaiGrowthSegments ?? source.metrics?.bonsaiGrowthSegments ?? null,
        });
    }
    // Elapsed days alone are metadata; cultivationState is the growth authority.
    return normalizeZenBonsaiLifeState(DEFAULT_LIFE_STATE);
};

export const buildZenBonsaiLifeSignature = (lifeState = null) => {
    const state = normalizeZenBonsaiLifeState(lifeState);
    const q = (value) => String(Math.round(clamp01(value) * 50) / 50);
    return [
        state.phase,
        q(state.growth),
        q(state.vitality),
        q(state.stress),
        q(state.bloom),
        q(state.dryness),
        q(state.branchSag),
        q(state.windResponse),
        state.dataDays,
        q(state.analysisConfidence),
        state.growthEvent.kind,
        state.growthEvent.milestone,
        state.growthEvent.milestoneEventDateKey,
        state.growthEvent.lastClosedDateKey,
        state.structuralImprint?.active === true
            ? [
                q(state.structuralImprint.stressWood),
                q(state.structuralImprint.recoveryWood),
                q(state.structuralImprint.volatility),
                q(state.structuralImprint.canopyReserve),
                state.structuralImprint.lastUpdatedDateKey,
            ].join(':')
            : 'structure_none',
        state.growthSegments.length
            ? state.growthSegments
                .map((segment) => [
                    segment.milestone,
                    q(segment.stressWood),
                    q(segment.recoveryWood),
                    q(segment.canopyReserve),
                ].join(':'))
                .join(',')
            : 'segments_none',
    ].join('|');
};

export default resolveZenBonsaiLifecycleTarget;
