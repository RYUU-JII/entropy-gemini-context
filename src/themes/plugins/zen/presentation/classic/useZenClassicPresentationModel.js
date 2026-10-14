import { useMemo } from 'react';

import { resolveBlendWeights } from '../../model/ZenCoreScoring';
import {
    SAKURA_CANONICAL_LATENT_DEFS,
} from '../../model/v2/SakuraLatentSchema';
import {
    resolveQuestionQualityBadge,
    resolveQuestionQualityBadgeClass,
    resolveABPhaseSummary,
    resolveOptimizeUiState,
} from '../../model/ZenCoreStatusPresentation';

const clamp01 = (value) => Math.min(1, Math.max(0, Number.isFinite(value) ? Number(value) : 0));

export function resolveZenClassicScoreView(analyzedCandidate = null) {
    return analyzedCandidate?.scores || {
        rule: 0,
        neural: 0,
        pairwise: 0,
        novelty: 0,
        blended: 0,
        weights: resolveBlendWeights({
            trainingSteps: 0,
            pairwisePairs: 0,
            neuralConfidence: 0.5,
            pairwiseConfidence: 0.5,
            neuralAvgError: 0,
            pairwiseAvgLoss: 0,
            referenceCount: 0,
        }),
    };
}

export function resolveZenLearningAnchorDirtyPercent({
    treeType = 'base',
    learningLatentKeys = [],
    latentState = null,
    anchorLatent = null,
    latentDefs = SAKURA_CANONICAL_LATENT_DEFS,
} = {}) {
    if (treeType !== 'sakura') {
        return 0;
    }

    const keys = Array.isArray(learningLatentKeys) && learningLatentKeys.length
        ? learningLatentKeys
        : Object.keys(latentDefs || {});
    if (!keys.length) {
        return 0;
    }

    const totalDelta = keys.reduce((acc, key) => {
        const def = latentDefs?.[key];
        if (!def) {
            return acc;
        }
        const min = Number.isFinite(Number(def.min)) ? Number(def.min) : 0;
        const max = Number.isFinite(Number(def.max)) ? Number(def.max) : 1;
        const span = Math.max(1e-6, max - min);
        const currentValue = Number(latentState?.[key]);
        const anchorValue = Number(anchorLatent?.[key]);
        if (!Number.isFinite(currentValue) || !Number.isFinite(anchorValue)) {
            return acc;
        }
        return acc + clamp01(Math.abs(currentValue - anchorValue) / span);
    }, 0);

    return Math.round((totalDelta / keys.length) * 1000) / 10;
}

export function resolveZenClassicCanvasSizes({
    renderWidth = 1,
    renderHeight = 1,
    abWidthA = 0,
    abHeightA = 0,
    abWidthB = 0,
    abHeightB = 0,
} = {}) {
    return {
        mainCanvasWidth: Math.max(1, Math.floor(renderWidth)),
        mainCanvasHeight: Math.max(1, Math.floor(renderHeight)),
        abCanvasWidthA: Math.max(1, Math.floor(abWidthA || 0)),
        abCanvasHeightA: Math.max(1, Math.floor(abHeightA || 0)),
        abCanvasWidthB: Math.max(1, Math.floor(abWidthB || 0)),
        abCanvasHeightB: Math.max(1, Math.floor(abHeightB || 0)),
    };
}

export function resolveZenClassicABOverlayState({
    isCollectionMode = false,
    abEntryGuardActive = false,
    coldStartReady = false,
    coldStartPreparing = false,
    coldStartPoolSize = 0,
    abPair = null,
    isGenerating = false,
    abErrorState = null,
} = {}) {
    const roundedPoolSize = Math.max(0, Math.floor(coldStartPoolSize || 0));
    const hasABError = Boolean(abErrorState?.code && abErrorState?.message);
    const abStatusMessage = hasABError
        ? abErrorState.message
        : !coldStartReady
        ? (coldStartPreparing
            ? `Cold-start set 준비 중... (${roundedPoolSize})`
            : 'Cold-start 준비 대기 중...')
        : (isGenerating ? 'A/B 후보 생성 중...' : 'A/B 후보 대기 중...');
    const abOverlayActive = Boolean(
        isCollectionMode
        && (hasABError || abEntryGuardActive || !coldStartReady || (!abPair && isGenerating)),
    );

    return {
        abStatusMessage,
        abOverlayActive,
        abOverlayTitle: hasABError
            ? 'A/B ERROR'
            : (!coldStartReady ? 'COLD START READYING' : 'A/B READYING'),
        abOverlayCaption: hasABError
            ? abErrorState.message
            : !coldStartReady
            ? (coldStartPreparing
                ? `초기 후보 셋 생성 중... (${roundedPoolSize})`
                : '초기 후보 셋 대기 중...')
            : (!abPair && isGenerating ? '첫 A/B 후보 생성 중...' : '캔버스 준비 중...'),
    };
}

export function useZenClassicPresentationModel({
    analyzedCandidate,
    treeType,
    learningLatentKeys,
    sakuraV2Latent,
    learningAnchorLatent,
    questionQuality,
    isCollectionMode,
    abPair,
    abRoundCount,
    isGenerating,
    coldStartReady,
    coldStartPreparing,
    coldStartPoolSize,
    abErrorState,
    abEntryGuardActive,
    sakuraV2Gate,
    isOptimizing,
    optimizeProgress,
    renderWidth,
    renderHeight,
    abWidthA,
    abHeightA,
    abWidthB,
    abHeightB,
    t,
}) {
    const scoreView = useMemo(
        () => resolveZenClassicScoreView(analyzedCandidate),
        [analyzedCandidate],
    );
    const learningAnchorDirtyPercent = useMemo(() => resolveZenLearningAnchorDirtyPercent({
        treeType,
        learningLatentKeys,
        latentState: sakuraV2Latent,
        anchorLatent: learningAnchorLatent,
    }), [
        treeType,
        learningLatentKeys,
        sakuraV2Latent,
        learningAnchorLatent,
    ]);
    const optimizeUiState = useMemo(() => resolveOptimizeUiState({
        sakuraV2Gate,
        isOptimizing,
        optimizeProgress,
        t,
    }), [sakuraV2Gate, isOptimizing, optimizeProgress, t]);
    const viewportState = useMemo(() => ({
        ...resolveZenClassicCanvasSizes({
            renderWidth,
            renderHeight,
            abWidthA,
            abHeightA,
            abWidthB,
            abHeightB,
        }),
        ...resolveZenClassicABOverlayState({
            isCollectionMode,
            abEntryGuardActive,
            coldStartReady,
            coldStartPreparing,
            coldStartPoolSize,
            abPair,
            isGenerating,
            abErrorState,
        }),
    }), [
        renderWidth,
        renderHeight,
        abWidthA,
        abHeightA,
        abWidthB,
        abHeightB,
        isCollectionMode,
        abEntryGuardActive,
        coldStartReady,
        coldStartPreparing,
        coldStartPoolSize,
        abPair,
        isGenerating,
        abErrorState,
    ]);
    const controlBarState = useMemo(() => ({
        scoreView,
        learningAnchorDirtyPercent,
        questionQualityBadge: resolveQuestionQualityBadge(questionQuality),
        questionQualityBadgeClass: resolveQuestionQualityBadgeClass(questionQuality),
        abPhaseSummary: resolveABPhaseSummary({
            isCollectionMode,
            abPair,
            abRoundCount,
            isGenerating,
            abBootstrapping: Boolean(isCollectionMode && !coldStartReady),
            abBootstrapLabel: coldStartPreparing
                ? `Cold-start ${Math.max(0, Math.floor(coldStartPoolSize || 0))}`
                : 'Cold-start',
        }),
        gateProgressPercent: optimizeUiState.gateProgressPercent,
        gateReady: optimizeUiState.gateReady,
        gateStatusBadge: optimizeUiState.gateStatusBadge,
        gateBottleneckSummary: optimizeUiState.gateBottleneckSummary,
        gateBreakdownTitle: optimizeUiState.gateBreakdownTitle,
        optimizeReliabilityPercent: optimizeUiState.reliabilityPercent,
        optimizeLocked: optimizeUiState.optimizeLocked,
        optimizeButtonTitle: optimizeUiState.optimizeButtonTitle,
    }), [
        scoreView,
        learningAnchorDirtyPercent,
        questionQuality,
        isCollectionMode,
        abPair,
        abRoundCount,
        isGenerating,
        coldStartReady,
        coldStartPreparing,
        coldStartPoolSize,
        optimizeUiState,
    ]);

    return {
        scoreView,
        controlBarState,
        viewportState,
    };
}

export default useZenClassicPresentationModel;
