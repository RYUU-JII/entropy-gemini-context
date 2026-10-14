import React, { useEffect, useMemo, useState } from 'react';
import {
    summarizeZenPondWaterEffectsDebugMetrics,
    ZEN_POND_WATER_EFFECTS_DEBUG_GLOBAL_KEY,
} from '../control/runtimeClient/waterEffectsDebugControls.js';

const POLL_INTERVAL_MS = 900;

const MASTER_TOGGLES = Object.freeze([
    { key: 'waterEffectsEnabled', label: 'Water FX' },
    { key: 'waterSurfaceEffectsEnabled', label: 'Surface' },
    { key: 'waterLayerEffectsEnabled', label: 'Layer' },
]);

const WATER_EFFECT_TOGGLES = Object.freeze([
    { key: 'benthicEnabled', label: 'Benthic' },
    { key: 'atmosphereEnabled', label: 'Atmos.' },
    { key: 'godRaysEnabled', label: 'Rays' },
    { key: 'causticsEnabled', label: 'Caustics' },
    { key: 'komorebiEnabled', label: 'Komorebi' },
    { key: 'surfaceOpticsEnabled', label: 'Optics' },
    { key: 'surfaceNormalEnabled', label: 'Normal' },
    { key: 'screenRefractionEnabled', label: 'Refract' },
    { key: 'surfaceReflectionEnabled', label: 'Reflect' },
    { key: 'yoonseulEnabled', label: 'Yoonseul' },
    { key: 'cloudReflectionEnabled', label: 'Clouds' },
    { key: 'rgbSplitEnabled', label: 'RGB' },
    { key: 'fishShadowEnabled', label: 'Fish shadow' },
    { key: 'koiWakeDisturbanceEnabled', label: 'Koi wake' },
    { key: 'tapDisturbanceEnabled', label: 'Tap ripple' },
    { key: 'petalDisturbanceEnabled', label: 'Petal ripple' },
]);

const readWaterEffectsDebugControls = () => {
    const debugGlobal = typeof globalThis !== 'undefined' ? globalThis : null;
    const controls = debugGlobal?.[ZEN_POND_WATER_EFFECTS_DEBUG_GLOBAL_KEY];
    return controls && typeof controls === 'object' ? controls : null;
};

const formatMetric = (value, digits = 1) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return '--';
    return numeric.toFixed(digits);
};

function ZenToggleRow({ label, checked, onChange }) {
    return (
        <label className="flex h-7 min-w-0 items-center justify-between gap-2 rounded-md px-2 text-[11px] text-white/90 transition-colors hover:bg-white/10">
            <span className="min-w-0 truncate">{label}</span>
            <input
                type="checkbox"
                checked={checked}
                onChange={(event) => onChange(event.target.checked)}
                className="sr-only"
                aria-label={label}
            />
            <span
                aria-hidden="true"
                className={`relative h-4 w-7 shrink-0 rounded-full border transition-colors ${checked
                    ? 'border-emerald-200/70 bg-emerald-300/80'
                    : 'border-white/25 bg-white/15'
                    }`}
            >
                <span
                    className={`absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-white shadow-sm transition-transform ${checked
                        ? 'translate-x-[13px]'
                        : 'translate-x-[2px]'
                        }`}
                />
            </span>
        </label>
    );
}

export default function ZenWaterEffectsDebugPanel({
    toggles,
    onPatch,
    onAllOff,
    onAllOn,
}) {
    const [summary, setSummary] = useState(null);
    const [metricsReady, setMetricsReady] = useState(false);
    const [renderCapture, setRenderCapture] = useState(null);
    const [renderCaptureState, setRenderCaptureState] = useState('idle');

    useEffect(() => {
        let disposed = false;
        let timerId = null;
        let previousMetrics = null;

        const poll = async () => {
            const controls = readWaterEffectsDebugControls();
            if (!controls || typeof controls.metrics !== 'function') {
                if (!disposed) {
                    setMetricsReady(false);
                    timerId = setTimeout(poll, POLL_INTERVAL_MS);
                }
                return;
            }
            try {
                const metrics = await controls.metrics();
                const nextSummary = summarizeZenPondWaterEffectsDebugMetrics(
                    metrics,
                    previousMetrics,
                );
                previousMetrics = metrics;
                if (!disposed) {
                    setSummary(nextSummary);
                    setMetricsReady(Boolean(nextSummary));
                    timerId = setTimeout(poll, POLL_INTERVAL_MS);
                }
            } catch (_) {
                if (!disposed) {
                    setMetricsReady(false);
                    timerId = setTimeout(poll, POLL_INTERVAL_MS);
                }
            }
        };

        void poll();
        return () => {
            disposed = true;
            if (timerId) {
                clearTimeout(timerId);
            }
        };
    }, []);

    const stats = useMemo(() => {
        const fps = Number(summary?.sample?.fps) || Number(summary?.fps) || 0;
        const frameMs = Number(summary?.sample?.avgDtMs) || Number(summary?.lastFrame?.frameMs) || 0;
        const koiRender = summary?.koiRender || null;
        return {
            fps,
            frameMs,
            waterMs: Number(summary?.lastFrame?.waterEffectsTickMs) || 0,
            surfaceMs: Number(summary?.lastFrame?.waterSurfaceFilterTickMs) || 0,
            fishCount: Number(koiRender?.fishCount) || 0,
            materialWrites: Number(koiRender?.materialWrites) || 0,
            shadowAlphaWrites: Number(koiRender?.shadowAlphaWrites) || 0,
            shadowAlphaAvg: Number(koiRender?.shadowAlphaAvg) || 0,
        };
    }, [summary]);

    const handleMeasureRender = async () => {
        const controls = readWaterEffectsDebugControls();
        if (!controls || typeof controls.captureRenderDiagnostics !== 'function') {
            setRenderCaptureState('waiting');
            return;
        }
        setRenderCaptureState('measuring');
        try {
            const result = await controls.captureRenderDiagnostics(1800);
            setRenderCapture(result);
            setRenderCaptureState('ready');
        } catch (_) {
            setRenderCaptureState('failed');
        }
    };

    const handleCopyRenderCapture = async () => {
        if (!renderCapture) return;
        const payload = JSON.stringify(renderCapture, null, 2);
        if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
            setRenderCaptureState('copy unavailable');
            return;
        }
        try {
            await navigator.clipboard.writeText(payload);
            setRenderCaptureState('copied');
        } catch (_) {
            setRenderCaptureState('copy failed');
        }
    };

    const renderToggles = (items) => (
        items.map((item) => (
            <ZenToggleRow
                key={item.key}
                label={item.label}
                checked={toggles?.[item.key] === true}
                onChange={(checked) => onPatch({ [item.key]: checked })}
            />
        ))
    );

    return (
        <div className="absolute bottom-3 left-3 z-[25] w-[min(92vw,360px)] max-w-[360px] pointer-events-auto rounded-xl border border-white/20 bg-zinc-950/75 p-2.5 text-white shadow-[0_16px_38px_rgba(0,0,0,0.32)] backdrop-blur-md">
            <div className="flex min-w-0 items-center justify-between gap-3">
                <div className="min-w-0">
                    <div className="text-[11px] font-semibold leading-tight text-white/90">Pond FX</div>
                    <div className="mt-0.5 text-[10px] leading-tight text-white/60">
                        {metricsReady ? 'live' : 'waiting'}
                    </div>
                </div>
                <div className="grid shrink-0 grid-cols-3 gap-1 text-right">
                    <div>
                        <div className="text-[10px] leading-none text-white/50">FPS</div>
                        <div className="mt-1 text-[15px] font-semibold leading-none text-emerald-100">{formatMetric(stats.fps, 1)}</div>
                    </div>
                    <div>
                        <div className="text-[10px] leading-none text-white/50">Frame</div>
                        <div className="mt-1 text-[15px] font-semibold leading-none text-white/90">{formatMetric(stats.frameMs, 1)}</div>
                    </div>
                    <div>
                        <div className="text-[10px] leading-none text-white/50">Water</div>
                        <div className="mt-1 text-[15px] font-semibold leading-none text-white/90">{formatMetric(stats.waterMs + stats.surfaceMs, 2)}</div>
                    </div>
                </div>
            </div>

            <div className="mt-2 grid grid-cols-3 gap-1">
                {renderToggles(MASTER_TOGGLES)}
            </div>
            <div className="mt-1 grid grid-cols-3 gap-1">
                {renderToggles(WATER_EFFECT_TOGGLES)}
            </div>
            <div className="mt-2 grid grid-cols-4 gap-1 rounded-md border border-white/10 bg-black/18 p-1.5 text-center">
                <div>
                    <div className="text-[10px] leading-none text-white/45">Koi</div>
                    <div className="mt-1 text-[12px] font-semibold leading-none text-white/85">{stats.fishCount || '--'}</div>
                </div>
                <div>
                    <div className="text-[10px] leading-none text-white/45">Mat</div>
                    <div className="mt-1 text-[12px] font-semibold leading-none text-white/85">{stats.materialWrites}</div>
                </div>
                <div>
                    <div className="text-[10px] leading-none text-white/45">ShW</div>
                    <div className="mt-1 text-[12px] font-semibold leading-none text-white/85">{stats.shadowAlphaWrites}</div>
                </div>
                <div>
                    <div className="text-[10px] leading-none text-white/45">ShA</div>
                    <div className="mt-1 text-[12px] font-semibold leading-none text-white/85">{formatMetric(stats.shadowAlphaAvg, 3)}</div>
                </div>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
                <button
                    type="button"
                    onClick={onAllOff}
                    className="h-7 rounded-md border border-white/15 bg-white/10 px-2 text-[11px] font-semibold text-white/80 transition-colors hover:bg-white/20"
                >
                    All off
                </button>
                <button
                    type="button"
                    onClick={onAllOn}
                    className="h-7 rounded-md border border-emerald-200/40 bg-emerald-300/20 px-2 text-[11px] font-semibold text-emerald-50 transition-colors hover:bg-emerald-300/30"
                >
                    All on
                </button>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
                <button
                    type="button"
                    onClick={handleMeasureRender}
                    disabled={renderCaptureState === 'measuring'}
                    className="h-7 rounded-md border border-sky-200/35 bg-sky-300/15 px-2 text-[11px] font-semibold text-sky-50 transition-colors hover:bg-sky-300/25 disabled:cursor-wait disabled:opacity-60"
                >
                    {renderCaptureState === 'measuring' ? 'Measuring' : 'Measure'}
                </button>
                <div className="min-w-0 flex-1 truncate text-center text-[10px] text-white/55">
                    {renderCaptureState === 'idle' ? 'Render' : renderCaptureState}
                </div>
                <button
                    type="button"
                    onClick={handleCopyRenderCapture}
                    disabled={!renderCapture}
                    className="h-7 rounded-md border border-white/15 bg-white/10 px-2 text-[11px] font-semibold text-white/80 transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-45"
                >
                    Copy
                </button>
            </div>
        </div>
    );
}
