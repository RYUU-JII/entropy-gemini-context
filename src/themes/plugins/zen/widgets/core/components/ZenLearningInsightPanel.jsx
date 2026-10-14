export function ZenLearningInsightPanel({
    learningReport,
    formatPercent,
    onCopyLearningReport,
    onCopyDeepLearningReport,
}) {
    const redundancy = learningReport?.redundancy || null;
    const qualityWarnings = Array.isArray(learningReport?.qualityWarnings)
        ? learningReport.qualityWarnings
        : [];
    const redundancyPairCount = Number(redundancy?.pairCount || 0);
    const redundancyTopPair = redundancy?.topPair || null;
    const redundancySimilarity = Number(redundancyTopPair?.similarity || 0);

    return (
        <section className="shrink-0 rounded-2xl border border-[#EAE8E3] bg-white/95 p-3">
            <div className="flex flex-wrap items-center gap-1.5">
                <h4 className="text-[11px] font-black uppercase tracking-[0.14em] text-stone-600">Learning Report</h4>
                <span className="rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.14em] text-stone-700">
                    Last 80
                </span>
                <span className="rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.14em] text-stone-700">
                    Info {learningReport.avgInfoScore.toFixed(3)}
                </span>
                <span className="rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.14em] text-stone-700">
                    PASS {formatPercent(learningReport.passRate, 1)}
                </span>
                <span className="rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.14em] text-stone-700">
                    Drift {formatPercent(learningReport.drift, 1)}
                </span>
                <span className={`rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.14em] ${redundancyPairCount > 0 ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                    Dup {redundancyPairCount}
                </span>
                {redundancyPairCount > 0 && redundancyTopPair && (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.12em] text-amber-700">
                        ATE {Math.round(redundancySimilarity * 100)}%
                    </span>
                )}
                {learningReport.latestGain !== null && (
                    <span className={`rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.14em] ${learningReport.latestGain > 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
                        Gain {formatPercent(learningReport.latestGain, 1)}
                    </span>
                )}
                <div className="ml-auto flex items-center gap-1.5">
                    <button
                        onClick={onCopyLearningReport}
                        className="rounded-lg border border-[#EAE8E3] bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-stone-700 hover:bg-stone-50"
                    >
                        Copy
                    </button>
                    <button
                        onClick={onCopyDeepLearningReport}
                        className="rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-sky-700 hover:bg-sky-100"
                    >
                        Copy Deep
                    </button>
                </div>
            </div>
            <p className="mt-2 text-[10px] font-medium text-stone-600">
                {learningReport.diagnosis}
            </p>
            {redundancyPairCount > 0 && redundancyTopPair && (
                <p className="mt-1 text-[9px] font-semibold text-amber-700">
                    Redundancy: {redundancyTopPair.aLabel} {'<->'} {redundancyTopPair.bLabel}
                </p>
            )}
            {qualityWarnings.length > 0 && (
                <p className="mt-1 text-[9px] font-semibold text-amber-700">
                    {qualityWarnings[0]}
                </p>
            )}
            <ol className="mt-2 space-y-1 text-[10px] text-stone-600 list-decimal list-inside">
                {learningReport.actions.map((action, index) => (
                    <li key={`${index}_${action}`}>{action}</li>
                ))}
            </ol>
        </section>
    );
}
