const toNumber = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

export function ZenVNextCompareStage({
    comparePair,
    compareCanvasARef,
    compareCanvasBRef,
    abWidthA,
    abHeightA,
    abWidthB,
    abHeightB,
    isSubmittingCompare,
    handleDismissCompare,
    handleChooseCompare,
}) {
    return (
        <section className="relative flex min-h-[360px] flex-1 flex-col overflow-hidden rounded-[28px] border border-[#D7E7F0] bg-[linear-gradient(180deg,rgba(252,254,255,0.98),rgba(241,247,250,0.94))] p-3 shadow-[0_20px_60px_rgba(39,80,106,0.08)]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top,rgba(150,198,220,0.22),transparent_68%)]" />
            <div className="relative z-10 flex justify-end">
                <button
                    type="button"
                    onClick={handleDismissCompare}
                    disabled={isSubmittingCompare}
                    className="h-6 rounded-md border border-[#D5E1E9] bg-white px-2 text-[8px] font-black uppercase tracking-[0.1em] text-[#27506A]"
                >
                    Close
                </button>
            </div>
            <div className="relative z-10 mt-2 grid flex-1 grid-cols-1 gap-3 xl:grid-cols-2">
                <div className="relative flex min-h-[340px] flex-col overflow-hidden rounded-[24px] border border-[#E6DDCE] bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(247,242,234,0.94))] p-3 shadow-[0_16px_40px_rgba(99,76,44,0.08)]">
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[radial-gradient(circle_at_top,rgba(193,167,122,0.16),transparent_72%)]" />
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#6B5840]">Left / A</p>
                        <span className="rounded-full border border-[#DDE8EF] bg-[#F8FBFD] px-1.5 py-0.5 text-[7px] font-black uppercase tracking-[0.08em] text-[#355870]">
                            Seed {Math.floor(toNumber(comparePair?.candidateA?.seed, 0))}
                        </span>
                    </div>
                    <div className="mt-3 flex min-h-0 flex-1 items-stretch rounded-[20px] border border-[#E9DFD0] bg-[linear-gradient(180deg,#FCFAF5,#F0E6D5)] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.52)]">
                        <canvas
                            ref={compareCanvasARef}
                            width={abWidthA}
                            height={abHeightA}
                            className="block h-full min-h-[252px] w-full flex-1 rounded-[18px] border border-[#E3EBF0] bg-[#F7F4EE]"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={() => handleChooseCompare('A')}
                        disabled={isSubmittingCompare}
                        className={`mt-auto h-10 w-full rounded-xl border text-[9px] font-black uppercase tracking-[0.12em] shadow-[0_12px_30px_rgba(99,76,44,0.14)] ${isSubmittingCompare
                            ? 'cursor-not-allowed border-[#C7B9A3] bg-[#DDCFBA] text-white'
                            : 'border-[#7B5B29] bg-[#7B5B29] text-white hover:bg-[#62481F]'
                            }`}
                    >
                        {isSubmittingCompare ? 'Saving...' : 'Select Left'}
                    </button>
                </div>
                <div className="relative flex min-h-[340px] flex-col overflow-hidden rounded-[24px] border border-[#D7E7F0] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(242,248,251,0.94))] p-3 shadow-[0_16px_40px_rgba(39,80,106,0.08)]">
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[radial-gradient(circle_at_top,rgba(150,198,220,0.18),transparent_72%)]" />
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#27506A]">Right / B</p>
                        <span className="rounded-full border border-[#DDE8EF] bg-[#F8FBFD] px-1.5 py-0.5 text-[7px] font-black uppercase tracking-[0.08em] text-[#355870]">
                            Seed {Math.floor(toNumber(comparePair?.candidateB?.seed, 0))}
                        </span>
                    </div>
                    <div className="mt-3 flex min-h-0 flex-1 items-stretch rounded-[20px] border border-[#DCE9F0] bg-[linear-gradient(180deg,#FCFEFF,#EAF3F8)] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.52)]">
                        <canvas
                            ref={compareCanvasBRef}
                            width={abWidthB}
                            height={abHeightB}
                            className="block h-full min-h-[252px] w-full flex-1 rounded-[18px] border border-[#E3EBF0] bg-[#F7F4EE]"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={() => handleChooseCompare('B')}
                        disabled={isSubmittingCompare}
                        className={`mt-auto h-10 w-full rounded-xl border text-[9px] font-black uppercase tracking-[0.12em] shadow-[0_12px_30px_rgba(39,80,106,0.14)] ${isSubmittingCompare
                            ? 'cursor-not-allowed border-[#9CB3C2] bg-[#C8D6DF] text-white'
                            : 'border-[#27506A] bg-[#27506A] text-white hover:bg-[#1D3F53]'
                            }`}
                    >
                        {isSubmittingCompare ? 'Saving...' : 'Select Right'}
                    </button>
                </div>
            </div>
        </section>
    );
}
