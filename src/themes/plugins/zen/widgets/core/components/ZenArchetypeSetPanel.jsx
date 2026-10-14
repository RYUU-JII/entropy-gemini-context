const formatDistance = (value) => (
    Number.isFinite(value)
        ? value.toFixed(2)
        : '-'
);

const formatMethodBadge = (method = '') => {
    const normalized = String(method || '').trim().toLowerCase();
    if (!normalized) {
        return 'ARCHETYPE';
    }
    if (normalized.includes('dpp')) {
        return 'DPP';
    }
    return normalized.replace(/_/g, ' ').toUpperCase();
};

export function ZenArchetypeSetPanel({
    archetypeSet = [],
    method = 'dpp_greedy_anchor',
    formatPercent,
    activeSeed = null,
    onApplyArchetype,
}) {
    if (!Array.isArray(archetypeSet) || !archetypeSet.length) {
        return null;
    }

    return (
        <section className="shrink-0 rounded-2xl border border-[#EAE8E3] bg-white/95 p-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
                <h4 className="text-[11px] font-black uppercase tracking-[0.14em] text-stone-700">Archetype Set</h4>
                <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.14em] text-sky-700">
                    {formatMethodBadge(method)}
                </span>
                <span className="rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.14em] text-stone-700">
                    Top {archetypeSet.length}
                </span>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
                {archetypeSet.map((entry, index) => {
                    const selected = Number.isFinite(activeSeed) && Number(entry?.seed) === Number(activeSeed);
                    const blended = Number(entry?.scores?.blended ?? entry?.scores?.objective ?? 0);
                    const objective = Number(entry?.scores?.objective ?? blended);
                    const meta = entry?.archetypeMeta || {};
                    return (
                        <article
                            key={`${entry?.seed || 'seed'}_${index}`}
                            className={`rounded-xl border p-2 ${selected ? 'border-emerald-300 bg-emerald-50/70' : 'border-[#EAE8E3] bg-white'}`}
                        >
                            <div className="flex items-center gap-1.5">
                                <span className="rounded-md border border-stone-200 bg-stone-50 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.12em] text-stone-700">
                                    #{meta.rank || index + 1}
                                </span>
                                <span className="text-[9px] font-black uppercase tracking-[0.12em] text-stone-600">
                                    Seed {entry?.seed}
                                </span>
                                {selected && (
                                    <span className="ml-auto rounded-md border border-emerald-300 bg-white px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.12em] text-emerald-700">
                                        Active
                                    </span>
                                )}
                            </div>
                            <div className="mt-1.5 flex flex-wrap gap-1">
                                <span className="rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.12em] text-stone-700">
                                    Obj {formatPercent(objective)}
                                </span>
                                <span className="rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.12em] text-stone-700">
                                    Blended {formatPercent(blended)}
                                </span>
                                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.12em] text-amber-700">
                                    Diverse {formatDistance(meta.minDistance)}
                                </span>
                            </div>
                            <div className="mt-2 flex items-center gap-1.5">
                                <button
                                    onClick={() => onApplyArchetype?.(entry)}
                                    className="h-6 rounded-md border border-[#2D4F1E] bg-[#2D4F1E] px-2 text-[8px] font-black uppercase tracking-[0.12em] text-white hover:bg-[#1A3012]"
                                >
                                    Apply
                                </button>
                            </div>
                        </article>
                    );
                })}
            </div>
        </section>
    );
}
