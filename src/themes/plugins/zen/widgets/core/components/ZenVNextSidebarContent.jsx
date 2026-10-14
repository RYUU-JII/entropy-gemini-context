const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const clamp01 = (value) => clamp(Number.isFinite(value) ? value : 0, 0, 1);
const toNumber = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const formatSignedNumber = (value, digits = 1) => {
    const numeric = toNumber(value, 0);
    return `${numeric >= 0 ? '+' : ''}${numeric.toFixed(digits)}`;
};
const formatTimestampCompact = (value) => {
    const timestamp = Number(value);
    if (!Number.isFinite(timestamp) || timestamp <= 0) {
        return '-';
    }
    const deltaMs = Math.max(0, Date.now() - timestamp);
    const minutes = Math.floor(deltaMs / (60 * 1000));
    if (minutes < 1) {
        return 'just now';
    }
    if (minutes < 60) {
        return `${minutes}m ago`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
        return `${hours}h ago`;
    }
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
};

function ZenVNextPreviewSection({
    surfaceCardClass,
    coolSurfaceCardClass,
    result,
    reliabilityHint,
    phaseStats,
    phaseTotalSelections,
    styleProfile,
    comparePair,
    compareDeltaHighlights,
    handleDismissCompare,
    isSubmittingCompare,
    latestOptimization,
} = {}) {
    return (
        <>
            <div className={`${surfaceCardClass} px-2.5 py-2.5`}>
                <p className="text-[9px] font-black uppercase tracking-[0.12em] text-stone-700">
                    Preview State
                </p>
                <p className="mt-1 text-[11px] font-serif text-[#3E2723]">
                    Current studio snapshot
                </p>
                <p className="mt-1 text-[8px] font-semibold text-stone-500">
                    현재 생성 결과와 비교 상태를 한곳에서 봅니다.
                </p>
            </div>

            <div className={`${surfaceCardClass} px-2.5 py-2.5`}>
                <p className="text-[8px] font-black uppercase tracking-[0.12em] text-stone-700">Current Tree</p>
                <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                    <p className="rounded-[14px] border border-[#EEE6D7] bg-white/78 px-2 py-1.5 font-mono text-[8px] text-stone-700">
                        Nodes {Math.max(0, Math.floor(Number(result?.features?.nodeCount || 0)))}
                    </p>
                    <p className="rounded-[14px] border border-[#EEE6D7] bg-white/78 px-2 py-1.5 font-mono text-[8px] text-stone-700">
                        Steps {Math.max(0, Math.floor(Number(result?.diagnostics?.stepCount || 0)))}
                    </p>
                    <p className="rounded-[14px] border border-[#EEE6D7] bg-white/78 px-2 py-1.5 font-mono text-[8px] text-stone-700">
                        Deadwood {Math.round(clamp01(Number(result?.features?.deadwoodRatio || 0)) * 100)}%
                    </p>
                    <p className="rounded-[14px] border border-[#EEE6D7] bg-white/78 px-2 py-1.5 font-mono text-[8px] text-stone-700">
                        Reliability {Math.round(clamp01(reliabilityHint) * 100)}%
                    </p>
                </div>
            </div>

            <div className={`${surfaceCardClass} px-2.5 py-2.5`}>
                <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-[8px] font-black uppercase tracking-[0.12em] text-stone-700">Phase Mix</p>
                    {phaseStats.map((entry) => {
                        const percent = phaseTotalSelections > 0
                            ? Math.round((entry.count / phaseTotalSelections) * 100)
                            : 0;
                        return (
                            <span key={entry.key} className="rounded-full border border-[#EAE8E3] bg-white px-1.5 py-0.5 text-[7px] font-black uppercase tracking-[0.08em] text-stone-700">
                                {entry.label} {percent}%
                            </span>
                        );
                    })}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full border border-[#D5E1E9] bg-[#F8FBFD] px-1.5 py-0.5 text-[7px] font-black uppercase tracking-[0.08em] text-[#27506A]">
                        Lateral {String(styleProfile?.lateralMode || 'mixed')}
                    </span>
                    <span className="rounded-full border border-[#EAE8E3] bg-white px-1.5 py-0.5 text-[7px] font-black uppercase tracking-[0.08em] text-stone-700">
                        AntiDir {Math.round(clamp01(Number(styleProfile?.antiDirectionRate || 0)) * 100)}%
                    </span>
                    <span className="rounded-full border border-[#EAE8E3] bg-white px-1.5 py-0.5 text-[7px] font-black uppercase tracking-[0.08em] text-stone-700">
                        Split Shift {Number.isFinite(Number(styleProfile?.splitStepOffset)) ? Number(styleProfile.splitStepOffset) : 0}
                    </span>
                </div>
            </div>

            {comparePair ? (
                <div className={`${coolSurfaceCardClass} px-2.5 py-2.5`}>
                    <p className="text-[8px] font-black uppercase tracking-[0.12em] text-[#27506A]">Compare Session</p>
                    <p className="mt-1 text-[11px] font-serif text-[#28475C]">
                        Study the silhouette shift before choosing.
                    </p>
                    <p className="mt-1 text-[8px] font-semibold text-[#355870]">
                        {comparePair?.meta?.entry === 'auto' ? 'Auto' : 'Manual'} compare is active.
                    </p>
                    <p className="mt-0.5 text-[8px] font-semibold text-[#355870]">
                        A {(toNumber(comparePair?.candidateA?.scores?.objective, 0) * 100).toFixed(1)}%
                        {' / '}
                        B {(toNumber(comparePair?.candidateB?.scores?.objective, 0) * 100).toFixed(1)}%
                    </p>
                    {compareDeltaHighlights.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                            {compareDeltaHighlights.map((entry) => (
                                <span
                                    key={entry.key}
                                    className="rounded-full border border-[#D5E1E9] bg-white px-1.5 py-0.5 text-[7px] font-black tracking-[0.06em] text-[#355870]"
                                >
                                    {entry.delta >= 0 ? 'B+' : 'A+'} {entry.label}
                                </span>
                            ))}
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={handleDismissCompare}
                        disabled={isSubmittingCompare}
                        className="mt-1.5 h-7 w-full rounded-xl border border-[#D5E1E9] bg-white text-[8px] font-black uppercase tracking-[0.1em] text-[#27506A]"
                    >
                        Dismiss Compare
                    </button>
                </div>
            ) : (
                <div className={`${surfaceCardClass} px-2.5 py-2.5`}>
                    <p className="text-[8px] font-black uppercase tracking-[0.12em] text-stone-700">Preview Actions</p>
                    <p className="mt-1 text-[8px] font-semibold text-stone-500">
                        `Re-roll`로 새 샘플을 보고, `Evolve`로 preference 방향 후보를 찾고, `Compare A/B`로 학습을 진행합니다.
                    </p>
                </div>
            )}

            {latestOptimization?.bestCandidate && (
                <div className="rounded-[20px] border border-[#D7EBD0] bg-[linear-gradient(180deg,rgba(243,250,239,0.98),rgba(233,245,225,0.94))] px-2.5 py-2.5 shadow-[0_14px_36px_rgba(45,79,30,0.08)]">
                    <p className="text-[8px] font-black uppercase tracking-[0.12em] text-[#2D4F1E]">
                        Latest Optimize
                    </p>
                    <p className="mt-1 text-[8px] font-semibold text-[#2D4F1E]">
                        Objective {(Number(latestOptimization?.bestCandidate?.scores?.objective || 0) * 100).toFixed(1)}%
                    </p>
                    {latestOptimization?.recommendationExplanation?.summary && (
                        <p className="mt-1 text-[8px] font-semibold text-[#2D4F1E]">
                            {latestOptimization.recommendationExplanation.summary}
                        </p>
                    )}
                </div>
            )}
        </>
    );
}

function ZenVNextShapeSection({
    surfaceCardClass,
    basicFactorSliders,
    renderFactorSlider,
} = {}) {
    return (
        <>
            <div className={`${surfaceCardClass} px-2.5 py-2.5`}>
                <p className="text-[9px] font-black uppercase tracking-[0.12em] text-stone-700">
                    Core Shape
                </p>
                <p className="mt-1 text-[11px] font-serif text-[#3E2723]">
                    Primary silhouette controls
                </p>
                <p className="mt-1 text-[8px] font-semibold text-stone-500">
                    자주 쓰는 핵심 형태 축만 노출합니다.
                </p>
            </div>
            {basicFactorSliders.map((item) => renderFactorSlider(item))}
            <div className={`${surfaceCardClass} px-2.5 py-2.5`}>
                <p className="text-[8px] font-black uppercase tracking-[0.12em] text-stone-700">Editing Guide</p>
                <p className="mt-1 text-[8px] font-semibold text-stone-500">
                    줄기 흐름과 1차 가지 높이부터 맞춘 뒤, 밀도와 여백을 마지막에 조정하는 편이 안정적입니다.
                </p>
            </div>
        </>
    );
}

function ZenVNextLearningSection({
    coolSurfaceCardClass,
    reliabilityHint,
    inspectorReliability,
    preferenceModel,
    isTrainingPreference,
    handlePrepareCompare,
    isOptimizing,
    isPreparingCompare,
    isSubmittingCompare,
    isAutoCompareRunning,
    comparePair,
    handleResetPreferenceModel,
    handleClearFeedbackTrials,
    isMaintainingLoop,
    handleStartAutoCompare,
    handleStopAutoCompare,
    autoCompareMaxRounds,
    setAutoCompareMaxRounds,
    autoCompareStopReliability,
    setAutoCompareStopReliability,
    autoCompareRound,
    autoCompareCompleted,
} = {}) {
    return (
        <>
            <div className={`${coolSurfaceCardClass} px-2.5 py-2.5`}>
                <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#27506A]">
                    Learning Status
                </p>
                <p className="mt-1 text-[11px] font-serif text-[#28475C]">
                    Preference signal and model readiness
                </p>
                <label className="mt-1 flex items-center gap-2 text-[8px] font-black uppercase tracking-[0.12em] text-[#355870]">
                    Learned Reliability
                    <span className="rounded-full border border-[#D5E1E9] bg-white px-1.5 py-0.5 text-[7px] text-[#355870]">
                        {Math.round(reliabilityHint * 100)}%
                    </span>
                </label>
                <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={reliabilityHint}
                    readOnly
                    className="mt-1 h-1.5 w-full"
                />
                <div className="mt-1.5 grid grid-cols-2 gap-1">
                    <p className="text-[8px] font-semibold text-[#355870]">
                        Trials {Math.max(0, Math.floor(Number(inspectorReliability?.sampleCount || 0)))}
                    </p>
                    <p className="text-[8px] font-semibold text-[#355870]">
                        Pairs {Math.max(0, Math.floor(Number(inspectorReliability?.pairCount || 0)))}
                    </p>
                    <p className="text-[8px] font-semibold text-[#355870]">
                        Model {preferenceModel ? `${Math.round(clamp01(Number(preferenceModel?.metrics?.accuracy || 0)) * 100)}%` : 'Not trained'}
                    </p>
                    <p className="text-[8px] font-semibold text-[#355870]">
                        Samples {Math.max(0, Math.floor(Number(preferenceModel?.sampleCount || 0)))}
                    </p>
                </div>
                {isTrainingPreference && (
                    <p className="mt-1 text-[8px] font-semibold text-[#27506A]">
                        Preference model training...
                    </p>
                )}
            </div>

            <div className={`${coolSurfaceCardClass} px-2.5 py-2.5`}>
                <div className="flex items-center gap-2">
                    <p className="text-[8px] font-black uppercase tracking-[0.12em] text-[#27506A]">
                        A/B Compare
                    </p>
                    <button
                        type="button"
                        onClick={handlePrepareCompare}
                        disabled={isOptimizing || isPreparingCompare || isSubmittingCompare || isAutoCompareRunning}
                        className={`ml-auto h-6 rounded-md border px-2 text-[7px] font-black uppercase tracking-[0.1em] ${isOptimizing || isPreparingCompare || isSubmittingCompare || isAutoCompareRunning
                            ? 'cursor-not-allowed border-stone-300 bg-stone-200 text-stone-500'
                            : 'border-[#27506A] bg-[#27506A] text-white hover:bg-[#1D3F53]'
                            }`}
                    >
                        {isPreparingCompare ? 'Preparing...' : 'Prepare Pair'}
                    </button>
                </div>
                {comparePair ? (
                    <>
                        <p className="mt-1 text-[8px] font-semibold text-[#355870]">
                            Compare is ready on the main canvas.
                        </p>
                        <p className="mt-0.5 text-[8px] font-semibold text-[#355870]">
                            Round {Number.isFinite(Number(comparePair?.meta?.roundId)) ? Math.max(1, Math.floor(Number(comparePair.meta.roundId))) : 1}
                            {' · '}
                            {comparePair?.meta?.entry === 'auto' ? 'Auto' : 'Manual'}
                        </p>
                    </>
                ) : (
                    <p className="mt-1 text-[8px] font-semibold text-[#355870]">
                        아직 열린 compare pair가 없습니다.
                    </p>
                )}
                <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                    <button
                        type="button"
                        onClick={handleResetPreferenceModel}
                        disabled={isMaintainingLoop || isAutoCompareRunning}
                        className={`h-7 rounded-md border text-[8px] font-black uppercase tracking-[0.1em] ${isMaintainingLoop || isAutoCompareRunning
                            ? 'cursor-not-allowed border-stone-300 bg-stone-200 text-stone-500'
                            : 'border-[#E0D9CC] bg-[#F8F3E9] text-[#6A4E20] hover:bg-[#F2E9D8]'
                            }`}
                    >
                        Reset Model
                    </button>
                    <button
                        type="button"
                        onClick={handleClearFeedbackTrials}
                        disabled={isMaintainingLoop || isAutoCompareRunning}
                        className={`h-7 rounded-md border text-[8px] font-black uppercase tracking-[0.1em] ${isMaintainingLoop || isAutoCompareRunning
                            ? 'cursor-not-allowed border-stone-300 bg-stone-200 text-stone-500'
                            : 'border-[#E4D3D3] bg-[#FAEFEF] text-[#7A2F2F] hover:bg-[#F7E6E6]'
                            }`}
                    >
                        Clear A/B
                    </button>
                </div>
            </div>

            <div className={`${coolSurfaceCardClass} px-2.5 py-2.5`}>
                <div className="flex items-center gap-1.5">
                    <span className={`rounded-full border px-1.5 py-0.5 text-[7px] font-black uppercase tracking-[0.08em] ${isAutoCompareRunning
                        ? 'border-[#D5E1E9] bg-white text-[#27506A]'
                        : 'border-stone-300 bg-stone-100 text-stone-600'
                        }`}>
                        {isAutoCompareRunning ? 'Auto Running' : 'Auto Idle'}
                    </span>
                    <button
                        type="button"
                        onClick={isAutoCompareRunning ? handleStopAutoCompare : handleStartAutoCompare}
                        disabled={isOptimizing || isPreparingCompare || isSubmittingCompare}
                        className={`ml-auto h-6 rounded-md border px-2 text-[8px] font-black uppercase tracking-[0.1em] ${isOptimizing || isPreparingCompare || isSubmittingCompare
                            ? 'cursor-not-allowed border-stone-300 bg-stone-200 text-stone-500'
                            : isAutoCompareRunning
                                ? 'border-[#E4D3D3] bg-[#FAEFEF] text-[#7A2F2F] hover:bg-[#F7E6E6]'
                                : 'border-[#27506A] bg-[#27506A] text-white hover:bg-[#1D3F53]'
                            }`}
                    >
                        {isAutoCompareRunning ? 'Stop Auto A/B' : 'Start Auto A/B'}
                    </button>
                </div>
                <label className="mt-1 flex items-center justify-between gap-2 text-[8px] font-black uppercase tracking-[0.1em] text-[#355870]">
                    <span>Max Rounds</span>
                    <input
                        type="number"
                        min={1}
                        max={200}
                        value={autoCompareMaxRounds}
                        onChange={(event) => {
                            const next = clamp(Math.floor(toNumber(event.target.value, autoCompareMaxRounds)), 1, 200);
                            setAutoCompareMaxRounds(next);
                        }}
                        disabled={isAutoCompareRunning || isOptimizing || isPreparingCompare || isSubmittingCompare}
                        className="h-6 w-16 rounded-md border border-[#D5E1E9] bg-white px-1.5 text-right text-[8px] font-black text-[#355870]"
                    />
                </label>
                <label className="mt-1 flex items-center justify-between gap-2 text-[8px] font-black uppercase tracking-[0.1em] text-[#355870]">
                    <span>Stop @ Reliability</span>
                    <input
                        type="number"
                        min={0}
                        max={1}
                        step={0.01}
                        value={autoCompareStopReliability.toFixed(2)}
                        onChange={(event) => {
                            const next = clamp01(toNumber(event.target.value, autoCompareStopReliability));
                            setAutoCompareStopReliability(next);
                        }}
                        disabled={isAutoCompareRunning || isOptimizing || isPreparingCompare || isSubmittingCompare}
                        className="h-6 w-16 rounded-md border border-[#D5E1E9] bg-white px-1.5 text-right text-[8px] font-black text-[#355870]"
                    />
                </label>
                <div className="mt-1 grid grid-cols-3 gap-1">
                    <p className="text-[8px] font-semibold text-[#355870]">
                        Round {Math.max(0, Math.floor(Number(autoCompareRound || 0)))}
                    </p>
                    <p className="text-[8px] font-semibold text-[#355870]">
                        Done {Math.max(0, Math.floor(Number(autoCompareCompleted || 0)))}
                    </p>
                    <p className="text-[8px] font-semibold text-[#355870]">
                        Left {Math.max(0, Math.floor(Number(autoCompareMaxRounds || 0)) - Math.floor(Number(autoCompareCompleted || 0)))}
                    </p>
                </div>
            </div>
        </>
    );
}

function ZenVNextDebugSection({
    surfaceCardClass,
    coolSurfaceCardClass,
    advancedFactorSliders,
    renderFactorSlider,
    result,
    handleRefreshLoopState,
    isMaintainingLoop,
    isAutoCompareRunning,
    inspectorReliability,
    latestGeneration,
    handleExportLoopState,
    handleImportLoopState,
    loopPayloadText,
    setLoopPayloadText,
    loopActionMessage,
} = {}) {
    const backbone = result?.runtime?.backbone || {};
    const backboneDebug = backbone?.debug || null;
    const backboneSpines = Array.isArray(backboneDebug?.spines) ? backboneDebug.spines : [];
    const backboneAttractors = Array.isArray(backboneDebug?.attractors) ? backboneDebug.attractors : [];
    const scaffold = result?.runtime?.scaffold || {};
    const scaffoldDebug = scaffold?.debug || null;
    const scaffoldSelected = Array.isArray(scaffoldDebug?.selected) ? scaffoldDebug.selected : [];
    const scaffoldTopCandidates = Array.isArray(scaffoldDebug?.topCandidates) ? scaffoldDebug.topCandidates : [];
    const lineage = result?.runtime?.lineage || {};
    const lineageDebug = lineage?.debug || null;
    const lineageTopActions = Array.isArray(lineageDebug?.topActions) ? lineageDebug.topActions : [];
    const lineageSamples = Array.isArray(lineageDebug?.selectedSamples) ? lineageDebug.selectedSamples : [];
    return (
        <>
            <div className={`${surfaceCardClass} px-2.5 py-2.5`}>
                <p className="text-[9px] font-black uppercase tracking-[0.12em] text-stone-700">
                    Debug / Loop
                </p>
                <p className="mt-1 text-[11px] font-serif text-[#3E2723]">
                    Advanced controls and state maintenance
                </p>
                <p className="mt-1 text-[8px] font-semibold text-stone-500">
                    세부 팩터와 상태 관리 도구는 여기서만 다룹니다.
                </p>
            </div>

            {advancedFactorSliders.map((item) => renderFactorSlider(item))}

            {backboneDebug && (
                <div className={`${coolSurfaceCardClass} px-2.5 py-2.5`}>
                    <div className="flex items-center gap-2">
                        <p className="text-[8px] font-black uppercase tracking-[0.12em] text-[#27506A]">
                            Backbone Plan
                        </p>
                        <span className="ml-auto rounded-full border border-[#D5E1E9] bg-white px-1.5 py-0.5 text-[7px] font-black uppercase tracking-[0.08em] text-[#355870]">
                            Beam {Math.max(1, Math.floor(toNumber(backboneDebug?.beamWidth, 1)))}
                        </span>
                    </div>
                    <div className="mt-1.5 grid grid-cols-2 gap-1">
                        <p className="text-[8px] font-semibold text-[#355870]">
                            Trunks {backboneSpines.length}
                        </p>
                        <p className="text-[8px] font-semibold text-[#355870]">
                            Attractors {backboneAttractors.length}
                        </p>
                        <p className="text-[8px] font-semibold text-[#355870]">
                            Sweep {(clamp01(toNumber(backbone?.primarySweep, 0)) * 100).toFixed(0)}%
                        </p>
                        <p className="text-[8px] font-semibold text-[#355870]">
                            Counter {(clamp01(toNumber(backbone?.counterSweep, 0)) * 100).toFixed(0)}%
                        </p>
                        <p className="text-[8px] font-semibold text-[#355870]">
                            Apex {(clamp01(toNumber(backbone?.apexReach, 0)) * 100).toFixed(0)}%
                        </p>
                        <p className="text-[8px] font-semibold text-[#355870]">
                            Void {(clamp01(toNumber(backbone?.voidRespect, 0)) * 100).toFixed(0)}%
                        </p>
                    </div>
                    {backboneSpines.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                            {backboneSpines.map((entry) => (
                                <span
                                    key={`spine_${entry?.trunkIndex ?? 0}`}
                                    className="rounded-full border border-[#D5E1E9] bg-white px-1.5 py-0.5 text-[7px] font-black tracking-[0.08em] text-[#355870]"
                                >
                                    T{Math.max(0, Math.floor(toNumber(entry?.trunkIndex, 0)))} · CP {Math.max(0, Math.floor(toNumber(entry?.controlPointCount, 0)))}
                                </span>
                            ))}
                        </div>
                    )}
                    {backboneAttractors.length > 0 && (
                        <div className="mt-1.5 space-y-1">
                            {backboneAttractors.map((entry) => (
                                <div
                                    key={entry?.id || 'attractor'}
                                    className="rounded-[14px] border border-[#D5E1E9] bg-white/88 px-2 py-1.5"
                                >
                                    <div className="flex items-center gap-2">
                                        <p className="text-[7px] font-black uppercase tracking-[0.08em] text-[#27506A]">
                                            {String(entry?.id || 'attractor').replaceAll('_', ' ')}
                                        </p>
                                        <span className="ml-auto rounded-full border border-[#E3ECF2] bg-[#F8FBFD] px-1.5 py-0.5 text-[7px] font-black uppercase tracking-[0.08em] text-[#355870]">
                                            {String(entry?.kind || 'seek')}
                                        </span>
                                    </div>
                                    <p className="mt-0.5 text-[7px] font-mono text-[#355870]">
                                        p {(clamp01(toNumber(entry?.progress, 0)) * 100).toFixed(0)}%
                                        {' · '}
                                        x {formatSignedNumber(entry?.position?.[0], 1)}
                                        {' · '}
                                        y {toNumber(entry?.position?.[1], 0).toFixed(0)}
                                        {' · '}
                                        w {(clamp01(toNumber(entry?.weight, 0)) * 100).toFixed(0)}%
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {scaffoldDebug && (
                <div className={`${surfaceCardClass} px-2.5 py-2.5`}>
                    <div className="flex items-center gap-2">
                        <p className="text-[8px] font-black uppercase tracking-[0.12em] text-stone-700">
                            Scaffold Plan
                        </p>
                        <span className="ml-auto rounded-full border border-[#EAE8E3] bg-white px-1.5 py-0.5 text-[7px] font-black uppercase tracking-[0.08em] text-stone-700">
                            Beam {Math.max(1, Math.floor(toNumber(scaffoldDebug?.beamWidth, 1)))}
                        </span>
                    </div>
                    <div className="mt-1.5 grid grid-cols-2 gap-1">
                        <p className="text-[8px] font-semibold text-stone-700">
                            Strategy {String(scaffoldDebug?.candidateStrategy || 'unavailable')}
                        </p>
                        <p className="text-[8px] font-semibold text-stone-700">
                            Selected {scaffoldSelected.length}
                        </p>
                        <p className="text-[8px] font-semibold text-stone-700">
                            Raw {Math.max(0, Math.floor(toNumber(scaffoldDebug?.rawCandidateCount, 0)))}
                        </p>
                        <p className="text-[8px] font-semibold text-stone-700">
                            Maxima {Math.max(0, Math.floor(toNumber(scaffoldDebug?.maximaCount, 0)))}
                        </p>
                        <p className="text-[8px] font-semibold text-stone-700">
                            Retained {Math.max(0, Math.floor(toNumber(scaffoldDebug?.retainedCandidateCount, 0)))}
                        </p>
                        <p className="text-[8px] font-semibold text-stone-700">
                            Thin {Math.max(0, Math.floor(toNumber(scaffoldDebug?.rejectedByThinning, 0)))}
                        </p>
                    </div>
                    {scaffoldSelected.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                            {scaffoldSelected.map((entry) => (
                                <span
                                    key={entry?.id || entry?.role || 'selected'}
                                    className="rounded-full border border-[#EAE8E3] bg-white px-1.5 py-0.5 text-[7px] font-black tracking-[0.08em] text-stone-700"
                                >
                                    {String(entry?.roleBase || entry?.role || 'role').replaceAll('_', ' ')}
                                </span>
                            ))}
                        </div>
                    )}
                    {scaffoldTopCandidates.length > 0 && (
                        <div className="mt-1.5 space-y-1">
                            {scaffoldTopCandidates.slice(0, 4).map((entry) => (
                                <p
                                    key={entry?.id || 'candidate'}
                                    className="rounded-[12px] border border-[#EEE6D7] bg-white/82 px-2 py-1 text-[7px] font-mono text-stone-700"
                                >
                                    {String(entry?.parentNodeId || 'root')}
                                    {' · '}
                                    p {(clamp01(toNumber(entry?.guideProgress, 0)) * 100).toFixed(0)}%
                                    {' · '}
                                    q {(clamp01(toNumber(entry?.quality, 0)) * 100).toFixed(0)}%
                                    {' · '}
                                    x {formatSignedNumber(entry?.position?.[0], 1)}
                                </p>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {lineageDebug && (
                <div className={`${coolSurfaceCardClass} px-2.5 py-2.5`}>
                    <div className="flex items-center gap-2">
                        <p className="text-[8px] font-black uppercase tracking-[0.12em] text-[#27506A]">
                            Lineage Plan
                        </p>
                        <span className="ml-auto rounded-full border border-[#D5E1E9] bg-white px-1.5 py-0.5 text-[7px] font-black uppercase tracking-[0.08em] text-[#355870]">
                            Avg {(toNumber(lineageDebug?.candidateAverage, 0)).toFixed(1)}
                        </span>
                    </div>
                    <div className="mt-1.5 grid grid-cols-2 gap-1">
                        <p className="text-[8px] font-semibold text-[#355870]">
                            Decisions {Math.max(0, Math.floor(toNumber(lineageDebug?.decisionCount, 0)))}
                        </p>
                        <p className="text-[8px] font-semibold text-[#355870]">
                            Actions {lineageTopActions.length}
                        </p>
                    </div>
                    {lineageTopActions.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                            {lineageTopActions.map((entry) => (
                                <span
                                    key={entry?.action || 'action'}
                                    className="rounded-full border border-[#D5E1E9] bg-white px-1.5 py-0.5 text-[7px] font-black tracking-[0.08em] text-[#355870]"
                                >
                                    {String(entry?.action || 'action').replaceAll('_', ' ')}
                                    {' '}
                                    {Math.max(0, Math.floor(toNumber(entry?.count, 0)))}
                                </span>
                            ))}
                        </div>
                    )}
                    {lineageSamples.length > 0 && (
                        <div className="mt-1.5 space-y-1">
                            {lineageSamples.slice(0, 4).map((entry, index) => (
                                <p
                                    key={`${entry?.action || 'sample'}_${index}`}
                                    className="rounded-[12px] border border-[#D5E1E9] bg-white/88 px-2 py-1 text-[7px] font-mono text-[#355870]"
                                >
                                    {String(entry?.roleBase || 'branch').replaceAll('_', ' ')}
                                    {' · '}
                                    {String(entry?.phase || 'scaffold')}
                                    {' · '}
                                    {String(entry?.action || 'extend').replaceAll('_', ' ')}
                                    {' · '}
                                    score {(toNumber(entry?.score, 0) * 100).toFixed(0)}%
                                </p>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <div className={`${coolSurfaceCardClass} px-2.5 py-2.5`}>
                <div className="flex items-center gap-2">
                    <p className="text-[8px] font-black uppercase tracking-[0.12em] text-[#27506A]">
                        Loop Inspector
                    </p>
                    <button
                        type="button"
                        onClick={handleRefreshLoopState}
                        disabled={isMaintainingLoop || isAutoCompareRunning}
                        className={`ml-auto h-6 rounded-md border px-2 text-[7px] font-black uppercase tracking-[0.1em] ${isMaintainingLoop || isAutoCompareRunning
                            ? 'cursor-not-allowed border-stone-300 bg-stone-200 text-stone-500'
                            : 'border-[#D5E1E9] bg-white text-[#27506A] hover:bg-[#EDF5FA]'
                            }`}
                    >
                        Refresh
                    </button>
                </div>
                <div className="mt-1.5 grid grid-cols-2 gap-1">
                    <p className="text-[8px] font-semibold text-[#355870]">
                        Trials {Math.max(0, Math.floor(Number(inspectorReliability?.sampleCount || 0)))}
                    </p>
                    <p className="text-[8px] font-semibold text-[#355870]">
                        Pairs {Math.max(0, Math.floor(Number(inspectorReliability?.pairCount || 0)))}
                    </p>
                    <p className="text-[8px] font-semibold text-[#355870]">
                        Repeat {Math.max(0, Math.floor(Number(inspectorReliability?.repeatPairCount || 0)))}
                    </p>
                    <p className="text-[8px] font-semibold text-[#355870]">
                        Consistency {(clamp01(Number(inspectorReliability?.consistency || 0)) * 100).toFixed(0)}%
                    </p>
                    <p className="text-[8px] font-semibold text-[#355870]">
                        Freshness {(clamp01(Number(inspectorReliability?.freshness || 0)) * 100).toFixed(0)}%
                    </p>
                    <p className="text-[8px] font-semibold text-[#355870]">
                        Updated {formatTimestampCompact(inspectorReliability?.updatedAt)}
                    </p>
                </div>
                {latestGeneration && (
                    <div className="mt-1.5 border-t border-[#DDEAF2] pt-1.5">
                        <p className="text-[8px] font-semibold text-[#355870]">
                            Last Gen {Math.max(0, Math.floor(Number(latestGeneration?.generation || 0)))}
                            {' · '}
                            Top {(clamp01(Number(latestGeneration?.topObjective || 0)) * 100).toFixed(1)}%
                            {' · '}
                            Div {(clamp01(Number(latestGeneration?.diversity || 0)) * 100).toFixed(1)}%
                        </p>
                    </div>
                )}
            </div>

            <div className={`${surfaceCardClass} px-2.5 py-2.5`}>
                <p className="text-[8px] font-black uppercase tracking-[0.12em] text-stone-700">
                    Loop Payload
                </p>
                <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                    <button
                        type="button"
                        onClick={handleExportLoopState}
                        disabled={isMaintainingLoop || isAutoCompareRunning}
                        className={`h-7 rounded-md border text-[8px] font-black uppercase tracking-[0.1em] ${isMaintainingLoop || isAutoCompareRunning
                            ? 'cursor-not-allowed border-stone-300 bg-stone-200 text-stone-500'
                            : 'border-[#D5E1E9] bg-[#F4F9FC] text-[#27506A] hover:bg-[#EAF3F9]'
                            }`}
                    >
                        Export
                    </button>
                    <button
                        type="button"
                        onClick={handleImportLoopState}
                        disabled={isMaintainingLoop || isAutoCompareRunning || !String(loopPayloadText || '').trim()}
                        className={`h-7 rounded-md border text-[8px] font-black uppercase tracking-[0.1em] ${isMaintainingLoop || isAutoCompareRunning || !String(loopPayloadText || '').trim()
                            ? 'cursor-not-allowed border-stone-300 bg-stone-200 text-stone-500'
                            : 'border-[#27506A] bg-[#27506A] text-white hover:bg-[#1D3F53]'
                            }`}
                    >
                        Import
                    </button>
                </div>
                <textarea
                    value={loopPayloadText}
                    onChange={(event) => setLoopPayloadText(event.target.value)}
                    placeholder="Paste exported vNext loop JSON here..."
                    className="mt-1.5 h-20 w-full resize-none rounded-md border border-[#EAE8E3] bg-stone-50 px-2 py-1.5 text-[8px] font-mono text-stone-700"
                />
                {loopActionMessage && (
                    <p className="mt-1 text-[8px] font-semibold text-[#27506A]">{loopActionMessage}</p>
                )}
            </div>
        </>
    );
}

export function ZenVNextSidebarContent({
    activeSection,
    surfaceCardClass,
    coolSurfaceCardClass,
    basicFactorSliders,
    advancedFactorSliders,
    renderFactorSlider,
    result,
    reliabilityHint,
    phaseStats,
    phaseTotalSelections,
    styleProfile,
    comparePair,
    compareDeltaHighlights,
    handleDismissCompare,
    isSubmittingCompare,
    latestOptimization,
    inspectorReliability,
    preferenceModel,
    isTrainingPreference,
    handlePrepareCompare,
    isOptimizing,
    isPreparingCompare,
    isAutoCompareRunning,
    handleResetPreferenceModel,
    handleClearFeedbackTrials,
    isMaintainingLoop,
    handleStartAutoCompare,
    handleStopAutoCompare,
    autoCompareMaxRounds,
    setAutoCompareMaxRounds,
    autoCompareStopReliability,
    setAutoCompareStopReliability,
    autoCompareRound,
    autoCompareCompleted,
    latestGeneration,
    handleRefreshLoopState,
    handleExportLoopState,
    handleImportLoopState,
    loopPayloadText,
    setLoopPayloadText,
    loopActionMessage,
} = {}) {
    switch (activeSection) {
        case 'shape':
            return (
                <ZenVNextShapeSection
                    surfaceCardClass={surfaceCardClass}
                    basicFactorSliders={basicFactorSliders}
                    renderFactorSlider={renderFactorSlider}
                />
            );
        case 'learning':
            return (
                <ZenVNextLearningSection
                    coolSurfaceCardClass={coolSurfaceCardClass}
                    reliabilityHint={reliabilityHint}
                    inspectorReliability={inspectorReliability}
                    preferenceModel={preferenceModel}
                    isTrainingPreference={isTrainingPreference}
                    handlePrepareCompare={handlePrepareCompare}
                    isOptimizing={isOptimizing}
                    isPreparingCompare={isPreparingCompare}
                    isSubmittingCompare={isSubmittingCompare}
                    isAutoCompareRunning={isAutoCompareRunning}
                    comparePair={comparePair}
                    handleResetPreferenceModel={handleResetPreferenceModel}
                    handleClearFeedbackTrials={handleClearFeedbackTrials}
                    isMaintainingLoop={isMaintainingLoop}
                    handleStartAutoCompare={handleStartAutoCompare}
                    handleStopAutoCompare={handleStopAutoCompare}
                    autoCompareMaxRounds={autoCompareMaxRounds}
                    setAutoCompareMaxRounds={setAutoCompareMaxRounds}
                    autoCompareStopReliability={autoCompareStopReliability}
                    setAutoCompareStopReliability={setAutoCompareStopReliability}
                    autoCompareRound={autoCompareRound}
                    autoCompareCompleted={autoCompareCompleted}
                />
            );
        case 'debug':
            return (
                <ZenVNextDebugSection
                    surfaceCardClass={surfaceCardClass}
                    coolSurfaceCardClass={coolSurfaceCardClass}
                    advancedFactorSliders={advancedFactorSliders}
                    renderFactorSlider={renderFactorSlider}
                    result={result}
                    handleRefreshLoopState={handleRefreshLoopState}
                    isMaintainingLoop={isMaintainingLoop}
                    isAutoCompareRunning={isAutoCompareRunning}
                    inspectorReliability={inspectorReliability}
                    latestGeneration={latestGeneration}
                    handleExportLoopState={handleExportLoopState}
                    handleImportLoopState={handleImportLoopState}
                    loopPayloadText={loopPayloadText}
                    setLoopPayloadText={setLoopPayloadText}
                    loopActionMessage={loopActionMessage}
                />
            );
        case 'preview':
        default:
            return (
                <ZenVNextPreviewSection
                    surfaceCardClass={surfaceCardClass}
                    coolSurfaceCardClass={coolSurfaceCardClass}
                    result={result}
                    reliabilityHint={reliabilityHint}
                    phaseStats={phaseStats}
                    phaseTotalSelections={phaseTotalSelections}
                    styleProfile={styleProfile}
                    comparePair={comparePair}
                    compareDeltaHighlights={compareDeltaHighlights}
                    handleDismissCompare={handleDismissCompare}
                    isSubmittingCompare={isSubmittingCompare}
                    latestOptimization={latestOptimization}
                />
            );
    }
}
