import { useId } from 'react';

import { ZenInlineErrorBanner } from './ZenInlineErrorBanner';

const clampPercent = (value) => Math.max(
    0,
    Math.min(100, Math.round(Number(value || 0))),
);

const buttonBaseClass = 'h-7 rounded-lg border px-2.5 text-[9px] font-black uppercase tracking-[0.12em] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#536B46] disabled:cursor-not-allowed disabled:opacity-50';

function AdvancedToggleButton({
    pressed = false,
    onClick,
    activeClassName,
    children,
    ariaLabel = null,
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={typeof onClick !== 'function'}
            aria-label={ariaLabel || undefined}
            aria-pressed={pressed}
            className={`${buttonBaseClass} ${pressed
                ? activeClassName
                : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-50'
            }`}
        >
            {children}
        </button>
    );
}

export function ZenMainControlBar({
    experimental = false,
    isCollectionMode = false,
    classicLearningEnabled = true,
    classicLearningUnavailableLabel = '',
    bonsaiGrowthLabControls = null,
    onExperimentModeChange = null,
    scoreView = null,
    formatPercent = (value) => `${Math.round(Number(value || 0) * 100)}%`,
    trunkSandboxMode = false,
    applyToMainLabel = 'Apply to Main',
    applyToMainTitle = '',
    onApplyToMain = null,
    onReRoll = null,
    onOptimize = null,
    optimizeLocked = false,
    isOptimizing = false,
    optimizeProgress = 0,
    optimizeButtonTitle = '',
    optimizeReliabilityPercent = 0,
    learningAnchorDirtyPercent = 0,
    onSyncLearningAnchor = null,
    showAdvancedControls = false,
    onToggleAdvancedControls = null,
    latestOptimization = null,
    onReApplyBest = null,
    onHardReset = null,
    onHardResetRandom = null,
    showInsight = false,
    onToggleInsight = null,
    showBackboneDebug = false,
    onToggleBackboneDebug = null,
    showBranchTierDebug = false,
    onToggleBranchTierDebug = null,
    showGravityDebugOverlay = false,
    onToggleGravityDebugOverlay = null,
    onCalibrateGravity = null,
    isCalibratingGravity = false,
    gravityCalibrationProgress = 0,
    onToggleRenderMode = null,
    abPhaseSummary = '',
    questionQualityBadgeClass = '',
    questionQualityBadge = '',
    gateReady = false,
    gateStatusBadge = '',
    gateProgressPercent = null,
    gateBottleneckSummary = '',
    gateBreakdownTitle = '',
    coldStartAvailable = false,
    coldStartRequested = false,
    coldStartPreparing = false,
    coldStartReady = true,
    coldStartPoolSize = 0,
    onPrepareColdStart = null,
    onClearColdStart = null,
    questionQualityWarning = null,
    errorState = null,
    spineGuideEnabled = false,
    spineGuideAnchorCount = 0,
    spineGuideMode = 'sculpted',
    spineGuideAdherence = 0,
    spineReferenceLikeness = 0.72,
    onToggleSpineGuideEditor = null,
}) {
    const advancedControlsId = useId();

    if (!experimental) {
        return null;
    }

    const readinessSource = Number.isFinite(gateProgressPercent)
        ? gateProgressPercent
        : optimizeReliabilityPercent;
    const readinessPercent = clampPercent(readinessSource);
    const readinessStatus = gateStatusBadge || (gateReady ? 'Ready' : 'Learning');
    const readinessTitle = [
        `Optimize readiness ${readinessPercent}%`,
        !gateReady && gateBottleneckSummary ? `Bottleneck: ${gateBottleneckSummary}` : '',
        gateBreakdownTitle,
    ].filter(Boolean).join(' · ');
    const hasReviewControls = Boolean(
        typeof onToggleInsight === 'function'
        || (!isCollectionMode && latestOptimization && typeof onReApplyBest === 'function'),
    );
    const hasDiagnosticControls = Boolean(
        typeof onToggleBackboneDebug === 'function'
        || typeof onToggleBranchTierDebug === 'function'
        || typeof onToggleGravityDebugOverlay === 'function'
        || typeof onCalibrateGravity === 'function'
        || typeof onToggleRenderMode === 'function',
    );
    const hasResetControls = Boolean(
        typeof onHardReset === 'function'
        || typeof onHardResetRandom === 'function',
    );
    const hasAdvancedPanel = !isCollectionMode
        && (hasReviewControls || hasDiagnosticControls || hasResetControls);
    const growthModelOptions = Array.isArray(bonsaiGrowthLabControls?.growthModelOptions)
        ? bonsaiGrowthLabControls.growthModelOptions
        : [];
    const lifecyclePhase = bonsaiGrowthLabControls?.phaseId === 'mature'
        ? 'Mature'
        : (bonsaiGrowthLabControls?.phaseId === 'juvenile' ? 'Juvenile' : 'Seedling');
    const lifecycleEnabled = bonsaiGrowthLabControls?.enabled === true;
    const spineConditionLabel = spineGuideMode === 'inspired'
        ? `Inspired ${clampPercent(spineReferenceLikeness * 100)}%`
        : `Sculpted ${clampPercent(spineGuideAdherence * 100)}%`;

    return (
        <div className="relative z-40 shrink-0">
            <div className="rounded-[12px] border border-stone-900/10 bg-[#F7F6F1]/96 px-1.5 py-1.5 shadow-[0_5px_18px_rgba(45,55,43,0.04)]">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <div
                        className="inline-flex shrink-0 rounded-lg border border-stone-200 bg-white p-0.5"
                        role="group"
                        aria-label="Experiment mode"
                    >
                        <button
                            type="button"
                            onClick={() => onExperimentModeChange?.(false)}
                            disabled={typeof onExperimentModeChange !== 'function'}
                            aria-pressed={!isCollectionMode}
                            className={`h-7 rounded-md px-2.5 text-[9px] font-black uppercase tracking-[0.1em] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#536B46] ${!isCollectionMode
                                ? 'bg-[#344D3D] text-white'
                                : 'text-stone-500 hover:bg-stone-50 hover:text-stone-700'
                            }`}
                        >
                            Single
                        </button>
                        <button
                            type="button"
                            onClick={() => onExperimentModeChange?.(true)}
                            disabled={!classicLearningEnabled || typeof onExperimentModeChange !== 'function'}
                            title={classicLearningEnabled ? undefined : classicLearningUnavailableLabel}
                            aria-pressed={isCollectionMode}
                            className={`h-7 rounded-md px-2.5 text-[9px] font-black uppercase tracking-[0.1em] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#536B46] ${isCollectionMode
                                ? 'bg-[#344D3D] text-white'
                                : 'text-stone-500 hover:bg-stone-50 hover:text-stone-700'
                            }`}
                        >
                            A/B Learn
                        </button>
                    </div>

                    {isCollectionMode ? (
                        <>
                            <span className="shrink-0 text-[9px] font-black text-[#314438]">
                                {abPhaseSummary || 'Round ready'}
                            </span>
                            <span
                                aria-label={`Question quality: ${questionQualityBadge || 'Unavailable'}`}
                                className={`shrink-0 rounded-full border px-2 py-1 text-[8px] font-black ${questionQualityBadgeClass || 'border-stone-200 bg-white text-stone-600'}`}
                            >
                                <span className="mr-1 font-bold uppercase tracking-[0.08em] opacity-65">
                                    Question
                                </span>
                                {questionQualityBadge || '—'}
                            </span>
                            {spineGuideEnabled && (
                                <span className="shrink-0 rounded-full border border-[#829177]/25 bg-white px-2 py-1 text-[8px] font-black text-[#52634A]">
                                    {spineConditionLabel} · {spineGuideAnchorCount} nodes
                                </span>
                            )}
                            <div
                                className="flex min-w-[150px] flex-1 items-center gap-1.5 rounded-full border border-[#829177]/20 bg-[#EDF1E9] px-2 py-1"
                                aria-label={`Optimize readiness: ${readinessPercent}%. ${readinessStatus}${!gateReady && gateBottleneckSummary ? `. Bottleneck: ${gateBottleneckSummary}` : ''}`}
                                title={readinessTitle}
                            >
                                <span className={`shrink-0 text-[8px] font-black ${gateReady ? 'text-[#52634A]' : 'text-amber-700'}`}>
                                    {readinessStatus}
                                </span>
                                <div
                                    role="progressbar"
                                    aria-label="Optimize readiness"
                                    aria-valuemin="0"
                                    aria-valuemax="100"
                                    aria-valuenow={readinessPercent}
                                    className="h-1.5 min-w-[56px] flex-1 overflow-hidden rounded-full bg-white"
                                >
                                    <div
                                        className={`h-full rounded-full transition-[width] duration-300 ${gateReady ? 'bg-[#66805A]' : 'bg-amber-400'}`}
                                        style={{ width: `${readinessPercent}%` }}
                                    />
                                </div>
                                <span className={`shrink-0 text-[8px] font-black tabular-nums ${gateReady ? 'text-[#52634A]' : 'text-amber-700'}`}>
                                    {readinessPercent}%
                                </span>
                                {!gateReady && gateBottleneckSummary && (
                                    <span className="max-w-[180px] shrink truncate text-[8px] font-bold text-amber-800">
                                        {gateBottleneckSummary}
                                    </span>
                                )}
                            </div>
                        </>
                    ) : (
                        <>
                            {growthModelOptions.length > 0 && (
                                <label className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2 text-[8px] font-black uppercase tracking-[0.08em] text-stone-500">
                                    <span>Model</span>
                                    <select
                                        value={bonsaiGrowthLabControls?.growthModel || ''}
                                        onChange={(event) => bonsaiGrowthLabControls?.onGrowthModelSelect?.(event.target.value)}
                                        aria-label="Growth model"
                                        className="max-w-[150px] bg-transparent text-[9px] font-black normal-case tracking-normal text-[#314438] outline-hidden"
                                    >
                                        {growthModelOptions.map((option) => (
                                            <option key={option.id} value={option.id}>{option.label}</option>
                                        ))}
                                    </select>
                                </label>
                            )}
                            {bonsaiGrowthLabControls && (
                                <>
                                    <button
                                        type="button"
                                        onClick={bonsaiGrowthLabControls.onTogglePreview}
                                        aria-pressed={lifecycleEnabled}
                                        className={`${buttonBaseClass} ${lifecycleEnabled
                                            ? 'border-[#829177]/35 bg-[#EDF1E9] text-[#52634A]'
                                            : 'border-stone-200 bg-white text-stone-500'
                                        }`}
                                    >
                                        {lifecycleEnabled ? 'Virtual input' : 'Live input'}
                                    </button>
                                    <span className="shrink-0 text-[8px] font-bold tabular-nums text-stone-500">
                                        {lifecyclePhase} · G {clampPercent(bonsaiGrowthLabControls.growthStage)} · H {clampPercent(bonsaiGrowthLabControls.activation)}
                                    </span>
                                </>
                            )}
                            {classicLearningEnabled ? <span
                                title={readinessTitle}
                                aria-label={`Current candidate score ${formatPercent(scoreView?.blended || 0)}. Optimize readiness ${readinessPercent}%.`}
                                className="rounded-full border border-[#829177]/25 bg-[#EDF1E9] px-2 py-1 text-[8px] font-black uppercase tracking-[0.08em] text-[#52634A]"
                            >
                                Current candidate {formatPercent(scoreView?.blended || 0)} · Optimize readiness {readinessPercent}%
                            </span> : <span role="status" className="text-[9px] text-stone-500">
                                {classicLearningUnavailableLabel}
                            </span>}
                            <button
                                type="button"
                                onClick={onToggleSpineGuideEditor}
                                disabled={typeof onToggleSpineGuideEditor !== 'function'}
                                aria-label="Edit spine guide"
                                aria-pressed={spineGuideEnabled}
                                className={`${buttonBaseClass} ${spineGuideEnabled
                                    ? 'border-[#829177]/35 bg-[#EDF1E9] text-[#52634A]'
                                    : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                                }`}
                            >
                                {spineGuideEnabled
                                    ? spineConditionLabel
                                    : `Guide${spineGuideAnchorCount > 0 ? ` ${spineGuideAnchorCount}` : ''}`}
                            </button>
                        </>
                    )}

                    <div className="ml-auto flex shrink-0 flex-wrap items-center gap-1">
                        {coldStartAvailable && isCollectionMode && (
                            <>
                                <button
                                    type="button"
                                    onClick={onPrepareColdStart}
                                    disabled={Boolean(
                                        typeof onPrepareColdStart !== 'function'
                                        || coldStartPreparing
                                        || (coldStartRequested && coldStartReady),
                                    )}
                                    aria-busy={coldStartPreparing ? 'true' : 'false'}
                                    className={`${buttonBaseClass} ${coldStartPreparing
                                        ? 'cursor-wait border-amber-200 bg-amber-100 text-amber-600'
                                        : coldStartRequested && coldStartReady
                                            ? 'border-[#829177]/25 bg-[#EDF1E9] text-[#52634A]'
                                            : 'border-[#829177]/25 bg-white text-[#52634A] hover:bg-[#EDF1E9]'
                                    }`}
                                >
                                    {coldStartPreparing
                                        ? `Preparing ${Math.max(0, Math.floor(coldStartPoolSize || 0))}`
                                        : coldStartRequested && coldStartReady
                                            ? `Prepared ${Math.max(0, Math.floor(coldStartPoolSize || 0))}`
                                            : 'Prepare set'}
                                </button>
                                {coldStartRequested && !coldStartPreparing && typeof onClearColdStart === 'function' && (
                                    <button
                                        type="button"
                                        onClick={onClearColdStart}
                                        className={`${buttonBaseClass} border-stone-200 bg-white text-stone-500 hover:bg-stone-50`}
                                    >
                                        Clear set
                                    </button>
                                )}
                            </>
                        )}
                        {typeof onApplyToMain === 'function' && (
                            <button
                                type="button"
                                onClick={onApplyToMain}
                                title={applyToMainTitle}
                                className={`${buttonBaseClass} border-[#D9C89A] bg-[#FFF6DB] text-amber-800 hover:bg-[#FFEEBF]`}
                            >
                                {applyToMainLabel}
                            </button>
                        )}
                        {!isCollectionMode && typeof onReRoll === 'function' && (
                            <button
                                type="button"
                                onClick={onReRoll}
                                className={`${buttonBaseClass} border-stone-200 bg-white text-stone-600 hover:bg-stone-50`}
                            >
                                Re-roll
                            </button>
                        )}
                        {!isCollectionMode && typeof onOptimize === 'function' && (
                            <button
                                type="button"
                                onClick={onOptimize}
                                disabled={optimizeLocked}
                                aria-busy={isOptimizing ? 'true' : 'false'}
                                title={optimizeButtonTitle}
                                className={`${buttonBaseClass} ${optimizeLocked
                                    ? 'border-stone-300 bg-stone-200 text-stone-500'
                                    : 'border-[#344D3D] bg-[#344D3D] text-white hover:bg-[#263B30]'
                                }`}
                            >
                                {isOptimizing
                                    ? `Evolving ${clampPercent(Number(optimizeProgress || 0) * 100)}%`
                                    : 'Evolve'}
                            </button>
                        )}
                        {!isCollectionMode
                            && learningAnchorDirtyPercent > 0.5
                            && typeof onSyncLearningAnchor === 'function' && (
                            <button
                                type="button"
                                onClick={onSyncLearningAnchor}
                                title="현재 프리뷰 형태를 학습/진화 기준점으로 반영합니다."
                                className={`${buttonBaseClass} border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100`}
                            >
                                Anchor {clampPercent(learningAnchorDirtyPercent)}%
                            </button>
                        )}
                        {typeof onToggleAdvancedControls === 'function' && hasAdvancedPanel && (
                            <button
                                type="button"
                                onClick={onToggleAdvancedControls}
                                aria-controls={advancedControlsId}
                                aria-expanded={showAdvancedControls}
                                aria-pressed={showAdvancedControls}
                                className={`${buttonBaseClass} ${showAdvancedControls
                                    ? 'border-stone-300 bg-stone-200 text-stone-700 hover:bg-stone-300/70'
                                    : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                                }`}
                            >
                                {showAdvancedControls ? 'Close advanced' : 'Advanced'}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {showAdvancedControls && hasAdvancedPanel && (
                <div
                    id={advancedControlsId}
                    className="absolute right-0 top-full mt-1 flex max-h-[min(360px,65vh)] w-[min(760px,calc(100vw-48px))] flex-wrap items-stretch gap-2 overflow-y-auto rounded-[14px] border border-stone-900/10 bg-stone-50/96 p-2 shadow-[0_18px_48px_rgba(45,55,43,0.16)] backdrop-blur-md"
                    aria-label="Advanced experiment controls"
                >
                    {hasReviewControls && (
                        <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-white/70 px-2 py-1.5">
                            <span className="mr-0.5 text-[8px] font-black uppercase tracking-[0.14em] text-stone-400">
                                Review
                            </span>
                            {!isCollectionMode && latestOptimization && typeof onReApplyBest === 'function' && (
                                <button
                                    type="button"
                                    onClick={onReApplyBest}
                                    className={`${buttonBaseClass} border-amber-200 bg-[#FFF9E8] text-amber-700 hover:bg-[#FFFAE9]`}
                                >
                                    Re-Apply
                                </button>
                            )}
                            {typeof onToggleInsight === 'function' && (
                                <AdvancedToggleButton
                                    pressed={showInsight}
                                    onClick={onToggleInsight}
                                    activeClassName="border-[#829177]/35 bg-[#EDF1E9] text-[#52634A] hover:bg-[#E5EBE0]"
                                >
                                    {showInsight ? 'Hide report' : 'Report'}
                                </AdvancedToggleButton>
                            )}
                        </div>
                    )}

                    {hasDiagnosticControls && (
                        <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-white/70 px-2 py-1.5">
                            <span className="mr-0.5 text-[8px] font-black uppercase tracking-[0.14em] text-stone-400">
                                Diagnostics
                            </span>
                            {typeof onToggleBackboneDebug === 'function' && (
                                <AdvancedToggleButton
                                    pressed={showBackboneDebug}
                                    onClick={onToggleBackboneDebug}
                                    activeClassName="border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100"
                                >
                                    Spine
                                </AdvancedToggleButton>
                            )}
                            {typeof onToggleBranchTierDebug === 'function' && (
                                <AdvancedToggleButton
                                    pressed={showBranchTierDebug}
                                    onClick={onToggleBranchTierDebug}
                                    activeClassName="border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100"
                                >
                                    Tiers
                                </AdvancedToggleButton>
                            )}
                            {typeof onToggleGravityDebugOverlay === 'function' && (
                                <AdvancedToggleButton
                                    pressed={showGravityDebugOverlay}
                                    onClick={onToggleGravityDebugOverlay}
                                    activeClassName="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                >
                                    Gravity
                                </AdvancedToggleButton>
                            )}
                            {typeof onCalibrateGravity === 'function' && (
                                <button
                                    type="button"
                                    onClick={onCalibrateGravity}
                                    disabled={isCalibratingGravity}
                                    aria-busy={isCalibratingGravity ? 'true' : 'false'}
                                    className={`${buttonBaseClass} border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}
                                >
                                    {isCalibratingGravity
                                        ? `Calibrating ${clampPercent(Number(gravityCalibrationProgress || 0) * 100)}%`
                                        : 'Calibrate gravity'}
                                </button>
                            )}
                            {typeof onToggleRenderMode === 'function' && (
                                <AdvancedToggleButton
                                    pressed={trunkSandboxMode}
                                    onClick={onToggleRenderMode}
                                    activeClassName="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                                    ariaLabel={`Trunk sandbox ${trunkSandboxMode ? 'on' : 'off'}`}
                                >
                                    Trunk sandbox {trunkSandboxMode ? 'on' : 'off'}
                                </AdvancedToggleButton>
                            )}
                        </div>
                    )}

                    {hasResetControls && (
                        <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-white/70 px-2 py-1.5 lg:ml-auto">
                            <span className="mr-0.5 text-[8px] font-black uppercase tracking-[0.14em] text-stone-400">
                                Reset learning
                            </span>
                            {typeof onHardReset === 'function' && (
                                <button
                                    type="button"
                                    onClick={onHardReset}
                                    title="표준 기준 분재로 초기화하고 학습/로그를 리셋합니다."
                                    className={`${buttonBaseClass} border-rose-200 bg-white text-rose-700 hover:bg-rose-50`}
                                >
                                    Standard
                                </button>
                            )}
                            {typeof onHardResetRandom === 'function' && (
                                <button
                                    type="button"
                                    onClick={onHardResetRandom}
                                    title="랜덤 기준 분재로 초기화하고 학습/로그를 리셋합니다."
                                    className={`${buttonBaseClass} border-amber-200 bg-white text-amber-700 hover:bg-amber-50`}
                                >
                                    Random
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {isCollectionMode && questionQualityWarning && (
                <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/70 px-2.5 py-2" role="status">
                    <p className="text-[9px] font-semibold text-amber-800">
                        {questionQualityWarning}
                    </p>
                </div>
            )}
            <ZenInlineErrorBanner errorState={errorState} />
        </div>
    );
}
