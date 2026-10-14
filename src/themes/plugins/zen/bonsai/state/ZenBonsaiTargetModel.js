import {
    normalizeZenBonsaiLifeState,
    resolveZenBonsaiLifecycleTarget,
} from '../../model/ZenBonsaiLifecycle.js';
import {
    reconcileZenBonsaiCultivationLedger,
    resolveZenBonsaiCultivationBaseline,
    resolveZenBonsaiGrowthSegments,
    resolveZenBonsaiStructuralImprint,
    resolveZenBonsaiCultivationVitality,
} from '../../model/ZenBonsaiCultivationLedger.js';
import {
    resolveZenBonsaiCultivationState,
} from '../../model/ZenBonsaiCultivationPolicy.js';
import {
    shouldUseZenBonsaiCultivationLedger,
} from '../../model/ZenBonsaiPresentationPolicy.js';
import {
    buildZenBonsaiCultivationSiteSignature,
} from './ZenBonsaiEvidenceModel.js';
import {
    resolveZenBonsaiDebugLifePreview,
} from '../debug/zenBonsaiDebugOverrides.js';

export const resolveZenBonsaiTargetModel = ({
    input = null,
    previousLedger = null,
    nowMs = 0,
    dateKey = undefined,
} = {}) => {
    const liveTargetLifeState = resolveZenBonsaiLifecycleTarget(input);
    const rawTargetLifeState = resolveZenBonsaiDebugLifePreview(liveTargetLifeState, input);
    const rawCultivationState = resolveZenBonsaiCultivationState(input);
    if (
        !rawCultivationState
        || !shouldUseZenBonsaiCultivationLedger(input)
    ) {
        return Object.freeze({
            targetLifeState: normalizeZenBonsaiLifeState(rawTargetLifeState),
            cultivationLedger: null,
            cultivationBaseline: null,
            siteSignature: buildZenBonsaiCultivationSiteSignature(input || {}),
            ledgerChanged: false,
        });
    }

    const previousBaseline = previousLedger
        ? resolveZenBonsaiCultivationBaseline(previousLedger)
        : null;
    const previousVitality = previousLedger
        ? resolveZenBonsaiCultivationVitality(previousLedger)
        : null;
    const previousStructuralImprint = previousLedger
        ? resolveZenBonsaiStructuralImprint(previousLedger)
        : null;
    const previousGrowthSegments = previousLedger
        ? resolveZenBonsaiGrowthSegments(previousLedger)
        : null;
    const siteSignature = buildZenBonsaiCultivationSiteSignature(input || {});
    const dailyOutcome = input?.dailyOutcome ?? input?.metrics?.dailyOutcome ?? null;
    let resolvedInput = {
        ...input,
        ...(previousBaseline ? { bonsaiCultivationBaseline: previousBaseline } : {}),
        ...(previousVitality?.active ? { bonsaiVitality: previousVitality } : {}),
        ...(previousStructuralImprint ? { bonsaiStructuralImprint: previousStructuralImprint } : {}),
        ...(previousGrowthSegments?.length ? { bonsaiGrowthSegments: previousGrowthSegments } : {}),
    };
    let cultivationState = resolveZenBonsaiCultivationState(resolvedInput);
    let targetLifeState = resolveZenBonsaiLifecycleTarget(resolvedInput);
    let reconciliation = reconcileZenBonsaiCultivationLedger({
        previousLedger,
        cultivationState,
        targetLifeState,
        siteSignature,
        dailyOutcome,
        nowMs,
        dateKey,
    });

    const vitalityAdvanced = reconciliation.vitality?.active === true
        && (
            previousVitality?.active !== true
            || reconciliation.vitality.lastClosedDateKey !== previousVitality.lastClosedDateKey
        );
    const structuralAdvanced = reconciliation.structuralImprint
        && (
            !previousStructuralImprint
            || reconciliation.structuralImprint.lastUpdatedDateKey !== previousStructuralImprint.lastUpdatedDateKey
            || reconciliation.structuralImprint.stressWood !== previousStructuralImprint.stressWood
            || reconciliation.structuralImprint.recoveryWood !== previousStructuralImprint.recoveryWood
            || reconciliation.structuralImprint.volatility !== previousStructuralImprint.volatility
            || reconciliation.structuralImprint.canopyReserve !== previousStructuralImprint.canopyReserve
        );
    const growthSegmentsAdvanced = Array.isArray(reconciliation.growthSegments)
        && reconciliation.growthSegments.length !== (previousGrowthSegments?.length || 0);
    if ((!previousBaseline && reconciliation.baseline) || vitalityAdvanced || structuralAdvanced || growthSegmentsAdvanced) {
        resolvedInput = {
            ...input,
            ...(reconciliation.baseline ? { bonsaiCultivationBaseline: reconciliation.baseline } : {}),
            ...(reconciliation.vitality?.active ? { bonsaiVitality: reconciliation.vitality } : {}),
            ...(reconciliation.structuralImprint ? { bonsaiStructuralImprint: reconciliation.structuralImprint } : {}),
            ...(reconciliation.growthSegments?.length ? { bonsaiGrowthSegments: reconciliation.growthSegments } : {}),
        };
        cultivationState = resolveZenBonsaiCultivationState(resolvedInput);
        targetLifeState = resolveZenBonsaiLifecycleTarget(resolvedInput);
        reconciliation = reconcileZenBonsaiCultivationLedger({
            previousLedger: reconciliation.ledger,
            cultivationState,
            targetLifeState,
            siteSignature,
            dailyOutcome,
            nowMs,
            dateKey,
        });
    }

    return Object.freeze({
        targetLifeState: normalizeZenBonsaiLifeState(reconciliation.cappedLifeState),
        cultivationLedger: reconciliation.ledger,
        cultivationBaseline: reconciliation.baseline,
        cultivationVitality: reconciliation.vitality,
        cultivationStructuralImprint: reconciliation.structuralImprint,
        cultivationGrowthSegments: reconciliation.growthSegments,
        siteSignature,
        ledgerChanged: true,
    });
};

export const usesZenBonsaiCultivationLedger = (input = null) => (
    !!resolveZenBonsaiCultivationState(input)
    && shouldUseZenBonsaiCultivationLedger(input)
);

export default resolveZenBonsaiTargetModel;
