import { RefreshCw } from 'lucide-react';

import { ZenInlineErrorBanner } from './ZenInlineErrorBanner';
import { ZenABCollectionView } from './ZenABCollectionView';
import { ZenBonsaiDebugPanel } from '../../../bonsai/ui/ZenBonsaiDebugPanel.jsx';
import { ZenSpineGuideEditor } from './ZenSpineGuideEditor.jsx';

const isFiniteNumber = (value) => Number.isFinite(Number(value));

const formatDiagnosticHour = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '--:--';
    const totalMinutes = Math.round((((numeric % 24) + 24) % 24) * 60) % (24 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const formatDiagnosticNumber = (value, digits = 2) => (
    isFiniteNumber(value) ? Number(value).toFixed(digits) : '--'
);

const formatDiagnosticCoordinates = (coordinates = null) => {
    if (!coordinates || typeof coordinates !== 'object') return 'coords --';
    const latitude = isFiniteNumber(coordinates.latitude)
        ? Number(coordinates.latitude).toFixed(2)
        : '--';
    const longitude = isFiniteNumber(coordinates.longitude)
        ? Number(coordinates.longitude).toFixed(2)
        : '--';
    return `${latitude}, ${longitude}`;
};

function ZenBonsaiTimeDiagnosticsBadge({
    diagnostics = null,
    isHomeEmbedded = false,
    raised = false,
}) {
    if (!diagnostics || typeof diagnostics !== 'object') {
        return null;
    }

    const anchorClassName = isHomeEmbedded
        ? `left-3 ${raised ? 'bottom-[76px]' : 'bottom-3'}`
        : 'left-5 bottom-5';
    const coordinates = diagnostics.solarCoordinates || null;
    const coordinateLabel = typeof coordinates?.label === 'string' && coordinates.label
        ? coordinates.label
        : formatDiagnosticCoordinates(coordinates);
    const timeZone = typeof diagnostics.timeZone === 'string' && diagnostics.timeZone
        ? diagnostics.timeZone
        : 'local';
    const solarPhase = typeof diagnostics.solarPhase === 'string' && diagnostics.solarPhase
        ? diagnostics.solarPhase
        : 'unknown';

    return (
        <div
            className={`pointer-events-none absolute ${anchorClassName} z-30 max-w-[min(260px,calc(100%-24px))] rounded-lg border border-stone-900/12 bg-white/68 px-3 py-2 text-stone-800 shadow-sm backdrop-blur-md`}
            data-testid="zen-bonsai-time-diagnostics"
        >
            <div className="flex items-baseline justify-between gap-3">
                <span className="text-[10px] font-bold uppercase text-stone-500">
                    분재 시간 판정
                </span>
                <span className="text-[18px] font-black tabular-nums leading-none text-[#263D32]">
                    {formatDiagnosticHour(diagnostics.hour)}
                </span>
            </div>
            <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] font-semibold leading-4 text-stone-600">
                <span className="truncate">phase {solarPhase}</span>
                <span className="truncate text-right">TZ {timeZone}</span>
                <span className="truncate tabular-nums">
                    D {formatDiagnosticNumber(diagnostics.daylight)}
                    {' / '}
                    N {formatDiagnosticNumber(diagnostics.night)}
                </span>
                <span className="truncate text-right tabular-nums">
                    alt {formatDiagnosticNumber(diagnostics.solarAltitudeDeg, 1)}°
                </span>
                <span className="col-span-2 truncate tabular-nums">
                    {coordinateLabel}
                    {' '}
                    ({formatDiagnosticCoordinates(coordinates)})
                </span>
            </div>
        </div>
    );
}

export function resolveZenClassicViewportClassName({
    experimental = false,
    isHomeEmbedded = false,
    embedded = false,
    frameVariant = 'card',
} = {}) {
    if (isHomeEmbedded && frameVariant === 'slab-aperture') {
        return 'relative min-h-0 min-w-0 flex-1 overflow-visible rounded-none border-0 bg-transparent p-0';
    }
    return `relative min-h-0 min-w-0 flex-1 overflow-hidden ${experimental
        ? 'rounded-[16px] border-0 bg-[#F1F0EA] p-0'
        : isHomeEmbedded
            ? 'rounded-[32px] border bg-transparent p-0'
            : embedded
                ? 'rounded-none bg-transparent p-0'
                : 'rounded-[24px] bg-stone-100/35 p-0'
        }`;
}

export function ZenClassicViewport({
    mainViewportRef,
    experimental = false,
    isHomeEmbedded = false,
    embedded = false,
    frameVariant = 'card',
    viewportStyle = undefined,
    isCollectionMode = false,
    canvasRef,
    mainCanvasPresentationReady = true,
    mainCanvasPaintVisible = undefined,
    mainCanvasWidth = 1,
    mainCanvasHeight = 1,
    mainCanvasStyle = null,
    abPair = null,
    isGenerating = false,
    abContainerRefA,
    abContainerRefB,
    chooseABCandidate = null,
    abCanvasRefA,
    abCanvasRefB,
    abCanvasWidthA = 1,
    abCanvasHeightA = 1,
    abCanvasWidthB = 1,
    abCanvasHeightB = 1,
    handleABBothGood = null,
    handleABPass = null,
    abStatusMessage = 'Generating candidates',
    abOverlayActive = false,
    abOverlayTitle = '',
    abOverlayCaption = '',
    abErrorState = null,
    bonsaiExperience = null,
    bonsaiActionPolicy = null,
    bonsaiActivationDebug = null,
    bonsaiDebugControls = null,
    showBonsaiDebugPanel = false,
    bonsaiTimeDiagnostics = null,
    raiseBonsaiTimeDiagnostics = false,
    onRerollBonsai = null,
    rerollBonsaiLabel = 'Re-roll Seed',
    spineGuideEditor = null,
}) {
    const rerollButtonAnchorClassName = isHomeEmbedded
        ? 'left-3 top-3'
        : 'left-5 top-5';
    const resolvedMainCanvasPaintVisible = mainCanvasPaintVisible === undefined
        ? mainCanvasPresentationReady === true
        : mainCanvasPaintVisible === true;

    return (
        <section
            ref={mainViewportRef}
            data-frame-variant={frameVariant}
            className={resolveZenClassicViewportClassName({
                experimental,
                isHomeEmbedded,
                embedded,
                frameVariant,
            })}
            style={viewportStyle}
        >
            {!isCollectionMode && (
                <canvas
                    ref={canvasRef}
                    data-main-canvas-presentation-ready={
                        mainCanvasPresentationReady === true ? 'true' : 'false'
                    }
                    data-main-canvas-paint-visible={
                        resolvedMainCanvasPaintVisible ? 'true' : 'false'
                    }
                    style={{
                        ...(mainCanvasStyle || {
                            width: '100%',
                            height: '100%',
                        }),
                        opacity: resolvedMainCanvasPaintVisible ? 1 : 0,
                    }}
                    width={mainCanvasWidth}
                    height={mainCanvasHeight}
                    className="block h-full w-full"
                />
            )}
            {!isCollectionMode && !bonsaiExperience && typeof onRerollBonsai === 'function' && (
                <div className={`absolute ${rerollButtonAnchorClassName} z-30`}>
                    <button
                        type="button"
                        aria-label={rerollBonsaiLabel}
                        title={rerollBonsaiLabel}
                        onClick={onRerollBonsai}
                        className="grid h-8 w-8 place-items-center rounded-full border border-stone-900/15 bg-white/50 text-stone-700 shadow-sm backdrop-blur-md transition hover:bg-white/75 hover:text-[#2D4F1E] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2D4F1E]"
                    >
                        <RefreshCw className="h-4 w-4" strokeWidth={2} />
                    </button>
                </div>
            )}
            {!isCollectionMode && showBonsaiDebugPanel && (
                <ZenBonsaiDebugPanel
                    debugSnapshot={bonsaiActivationDebug}
                    experience={bonsaiExperience}
                    actionPolicy={bonsaiActionPolicy}
                    debugControls={bonsaiDebugControls}
                    isHomeEmbedded={isHomeEmbedded}
                    onRerollBonsai={onRerollBonsai}
                    rerollBonsaiLabel={rerollBonsaiLabel}
                />
            )}
            {experimental && !isCollectionMode && spineGuideEditor?.open === true && (
                <ZenSpineGuideEditor
                    width={spineGuideEditor.width || mainCanvasWidth}
                    height={spineGuideEditor.height || mainCanvasHeight}
                    guide={spineGuideEditor.guide}
                    enabled={spineGuideEditor.enabled}
                    mode={spineGuideEditor.mode}
                    adherence={spineGuideEditor.adherence}
                    likeness={spineGuideEditor.likeness}
                    onCommitStroke={spineGuideEditor.onCommitStroke}
                    onMoveAnchor={spineGuideEditor.onMoveAnchor}
                    onModeChange={spineGuideEditor.onModeChange}
                    onAdherenceChange={spineGuideEditor.onAdherenceChange}
                    onLikenessChange={spineGuideEditor.onLikenessChange}
                    onDisable={spineGuideEditor.onDisable}
                    onReset={spineGuideEditor.onReset}
                    onClose={spineGuideEditor.onClose}
                />
            )}
            {!isCollectionMode && (
                <ZenBonsaiTimeDiagnosticsBadge
                    diagnostics={bonsaiTimeDiagnostics}
                    isHomeEmbedded={isHomeEmbedded}
                    raised={raiseBonsaiTimeDiagnostics}
                />
            )}

            {isCollectionMode && (
                <ZenABCollectionView
                    abPair={abPair}
                    isGenerating={isGenerating}
                    abContainerRefA={abContainerRefA}
                    abContainerRefB={abContainerRefB}
                    chooseABCandidate={chooseABCandidate}
                    abCanvasRefA={abCanvasRefA}
                    abCanvasRefB={abCanvasRefB}
                    abCanvasWidthA={abCanvasWidthA}
                    abCanvasHeightA={abCanvasHeightA}
                    abCanvasWidthB={abCanvasWidthB}
                    abCanvasHeightB={abCanvasHeightB}
                    handleABBothGood={handleABBothGood}
                    handleABPass={handleABPass}
                    statusMessage={abStatusMessage}
                />
            )}
            {abOverlayActive && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/86 backdrop-blur-[1px]">
                    <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
                        {abErrorState ? (
                            <ZenInlineErrorBanner
                                errorState={abErrorState}
                                className="mt-0 max-w-[360px] shadow-none"
                            />
                        ) : (
                            <>
                                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-stone-700">
                                    {abOverlayTitle}
                                </p>
                                <p className="mt-1 text-[9px] font-semibold text-stone-500">
                                    {abOverlayCaption}
                                </p>
                            </>
                        )}
                    </div>
                </div>
            )}
        </section>
    );
}

export default ZenClassicViewport;
