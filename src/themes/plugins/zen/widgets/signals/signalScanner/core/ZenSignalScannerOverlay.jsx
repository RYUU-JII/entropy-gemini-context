import React from 'react';

export default function ZenSignalScannerOverlay({
    showSwimModelBadge,
    showRerollControls = true,
    swimModelBadge,
    activeDomainForReroll,
    domainBadgeText,
    selectPromptText,
    rerollWithinLabel,
    rerollBreedLabel,
    rerollAllColorLabel,
    rerollAllBreedLabel,
    rerollSceneLabel,
    onRerollWithinBreed,
    onRerollBreed,
    onRerollAllColor,
    onRerollAllBreed,
    onRerollScene,
    canRerollAll,
}) {
    return (
        <>
            {showSwimModelBadge ? (
                <div className="absolute top-3 left-3 z-20 flex flex-col gap-2">
                    <div className="rounded-lg border border-white/25 bg-black/35 px-2 py-1 text-[10px] font-semibold tracking-wide text-white/90 backdrop-blur-md">
                        {swimModelBadge}
                    </div>
                </div>
            ) : null}
            {showRerollControls ? (
                <div className="absolute top-3 right-3 z-20 flex max-w-[360px] items-center gap-2 rounded-xl border border-white/25 bg-black/35 px-2.5 py-1.5 text-[10px] text-white/90 backdrop-blur-md">
                    <span className="truncate">
                        {activeDomainForReroll ? domainBadgeText : selectPromptText}
                    </span>
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={onRerollWithinBreed}
                            disabled={!activeDomainForReroll}
                            className={`rounded-md px-2 py-1 font-semibold tracking-wide transition-colors ${activeDomainForReroll
                                ? 'bg-white/85 text-black hover:bg-white'
                                : 'bg-white/20 text-white/55 cursor-not-allowed'
                                }`}
                        >
                            {rerollWithinLabel}
                        </button>
                        <button
                            type="button"
                            onClick={onRerollBreed}
                            disabled={!activeDomainForReroll}
                            className={`rounded-md px-2 py-1 font-semibold tracking-wide transition-colors ${activeDomainForReroll
                                ? 'bg-amber-100/90 text-amber-950 hover:bg-amber-100'
                                : 'bg-white/20 text-white/55 cursor-not-allowed'
                                }`}
                        >
                            {rerollBreedLabel}
                        </button>
                        <button
                            type="button"
                            onClick={onRerollAllColor}
                            disabled={!canRerollAll}
                            className={`rounded-md px-2 py-1 font-semibold tracking-wide transition-colors ${canRerollAll
                                ? 'bg-sky-100/90 text-sky-950 hover:bg-sky-100'
                                : 'bg-white/20 text-white/55 cursor-not-allowed'
                                }`}
                        >
                            {rerollAllColorLabel}
                        </button>
                        <button
                            type="button"
                            onClick={onRerollAllBreed}
                            disabled={!canRerollAll}
                            className={`rounded-md px-2 py-1 font-semibold tracking-wide transition-colors ${canRerollAll
                                ? 'bg-violet-100/90 text-violet-950 hover:bg-violet-100'
                                : 'bg-white/20 text-white/55 cursor-not-allowed'
                                }`}
                        >
                            {rerollAllBreedLabel}
                        </button>
                        <button
                            type="button"
                            onClick={onRerollScene}
                            className="rounded-md bg-rose-100/90 px-2 py-1 font-semibold tracking-wide text-rose-950 transition-colors hover:bg-rose-100"
                        >
                            {rerollSceneLabel}
                        </button>
                    </div>
                </div>
            ) : null}
        </>
    );
}
