export const resolveQuestionQualityBadge = (questionQuality = null) => {
    const stage = questionQuality?.stage || 'stable';
    const pressurePercent = Number(questionQuality?.pressurePercent || 0);
    if (stage === 'critical') {
        return `재구성 ${pressurePercent}%`;
    }
    if (stage === 'high') {
        return `강화 ${pressurePercent}%`;
    }
    if (stage === 'watch') {
        return `점검 ${pressurePercent}%`;
    }
    return `안정 ${pressurePercent}%`;
};

export const resolveQuestionQualityBadgeClass = (questionQuality = null) => {
    const stage = questionQuality?.stage || 'stable';
    if (stage === 'critical') {
        return 'border-rose-300 bg-rose-50 text-rose-700';
    }
    if (stage === 'high') {
        return 'border-amber-300 bg-amber-50 text-amber-700';
    }
    if (stage === 'watch') {
        return 'border-yellow-300 bg-yellow-50 text-yellow-700';
    }
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
};

export const resolveABPhaseSummary = ({
    isCollectionMode = false,
    abPair = null,
    abRoundCount = 0,
    isGenerating = false,
    abBootstrapping = false,
    abBootstrapLabel = 'Preparing',
} = {}) => {
    if (!isCollectionMode) {
        return 'Single mode';
    }
    if (abBootstrapping) {
        return `Round ${abRoundCount} · ${abBootstrapLabel}`;
    }
    if (abPair) {
        return `Round ${abRoundCount + 1} · Comparing`;
    }
    if (isGenerating) {
        return `Round ${abRoundCount} · Generating`;
    }
    return `Round ${abRoundCount} · Ready`;
};

const formatGateRequirementValue = (requirement = null) => {
    if (!requirement) return '';
    const current = requirement.current === null || requirement.current === undefined
        ? Number.NaN
        : Number(requirement.current);
    const target = requirement.target === null || requirement.target === undefined
        ? Number.NaN
        : Number(requirement.target);
    if (requirement.comparison === 'min_count') {
        return `${Math.max(0, Math.floor(current || 0))}/${Math.max(0, Math.floor(target || 0))}`;
    }
    if (requirement.comparison === 'min_ratio') {
        return `${Math.round((current || 0) * 100)}% / ${Math.round((target || 0) * 100)}%`;
    }
    if (requirement.comparison === 'max_error') {
        return Number.isFinite(current)
            ? `${current.toFixed(3)} / <= ${Number.isFinite(target) ? target.toFixed(3) : '-'}`
            : `no sample / <= ${Number.isFinite(target) ? target.toFixed(3) : '-'}`;
    }
    return `${Math.round(Number(requirement.progressPercent || 0))}%`;
};

export const resolveGateRequirementSummary = (requirement = null) => {
    if (!requirement?.label) return '';
    const value = formatGateRequirementValue(requirement);
    return value ? `${requirement.label} ${value}` : requirement.label;
};

export const resolveOptimizeUiState = ({
    sakuraV2Gate = null,
    isOptimizing = false,
    optimizeProgress = 0,
    t,
} = {}) => {
    const learningReadiness = Number.isFinite(sakuraV2Gate?.progress)
        ? Math.min(1, Math.max(0, Number(sakuraV2Gate.progress)))
        : 0;
    const learningReadinessPercent = Math.round(learningReadiness * 100);
    const gateProgressPercent = Number.isFinite(sakuraV2Gate?.progressPercent)
        ? sakuraV2Gate.progressPercent
        : learningReadinessPercent;
    const gateReady = Boolean(sakuraV2Gate?.canOptimize);
    const gateRequirements = Array.isArray(sakuraV2Gate?.requirements)
        ? sakuraV2Gate.requirements
        : [];
    const gateBottleneck = sakuraV2Gate?.bottleneck || null;
    const gateBottleneckSummary = resolveGateRequirementSummary(gateBottleneck);
    const gateBreakdownTitle = gateRequirements
        .map((requirement) => (
            `${resolveGateRequirementSummary(requirement)} (${Math.round(Number(requirement?.progressPercent || 0))}%)`
        ))
        .join(' · ');
    const gateStatusBadge = gateReady
        ? (t?.('core_status.learning_ready_short') || '학습 준비 완료')
        : (t?.('core_status.learning_in_progress_short') || '학습 준비 중');
    const optimizeLocked = isOptimizing || !gateReady;
    const optimizeButtonTitle = isOptimizing
        ? (t?.('core_status.optimize_running') || `진화 진행 중 (${Math.round(optimizeProgress * 100)}%)`)
        : gateReady
            ? `학습 준비도 ${Math.round(gateProgressPercent)}% · 신뢰도 게이트 통과. 추천 진화를 시작할 수 있습니다.`
            : `학습 준비도 ${Math.round(gateProgressPercent)}% · 신뢰도 게이트가 아직 충족되지 않았습니다.`;

    return {
        optimizeReliability: learningReadiness,
        reliabilityPercent: learningReadinessPercent,
        learningReadiness,
        learningReadinessPercent,
        gateProgressPercent,
        gateReady,
        gateStatusBadge,
        gateBottleneck,
        gateBottleneckSummary,
        gateBreakdownTitle,
        optimizeLocked,
        optimizeButtonTitle,
    };
};
