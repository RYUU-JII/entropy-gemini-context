export function ZenVNextPreviewStage({
    containerRef,
    canvasRef,
    width,
    height,
    seed,
}) {
    return (
        <section
            ref={containerRef}
            className="relative flex min-h-[320px] flex-1 flex-col overflow-hidden rounded-[28px] border border-[#E8DEC9] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.82),rgba(247,244,238,0.96)_45%,rgba(239,232,219,0.98))] p-3 shadow-[0_20px_60px_rgba(99,76,44,0.08)]"
        >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top,rgba(214,190,144,0.16),transparent_72%)]" />
            <div className="relative z-10 flex items-center justify-end gap-2">
                <span className="rounded-full border border-[#E3D6C0] bg-white/80 px-2 py-0.5 font-mono text-[8px] font-black uppercase tracking-[0.12em] text-stone-600">
                    Seed {seed}
                </span>
            </div>
            <div className="relative z-10 mt-2 flex min-h-0 flex-1 flex-col rounded-[24px] border border-[#E7DDCB] bg-[linear-gradient(180deg,rgba(252,249,244,0.98),rgba(241,232,219,0.94))] p-2 sm:p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]">
                <div className="pointer-events-none absolute inset-x-8 top-3 h-14 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.72),transparent_70%)]" />
                <canvas
                    ref={canvasRef}
                    className="relative z-10 block min-h-[280px] flex-1 rounded-[22px] border border-[#E7DDCB] bg-[#F7F4EE]"
                    width={Math.max(1, Math.floor(width || 1))}
                    height={Math.max(1, Math.floor(height || 1))}
                />
            </div>
        </section>
    );
}
