import { resolveRasterResolution } from '@/platform/rendering/renderBudgetContract.js';
import { observeDevicePixelRatio, readDevicePixelRatio } from '@/platform/rendering/devicePixelRatio.js';
import React, { useMemo, useEffect, useRef } from 'react';
import { Panel, UiHeader } from '@/ui-kit';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { runRenderLoop } from '@/platform/rendering/renderLoop.js';
import { useVisibilityGate } from '@/ui-kit/rendering/useVisibilityGate.js';

export default function ClinicalCoreStatus({ integrityScore = 100, dailyLimitPercent = 0 }) {
    const { t } = useAppTranslation('main');
    const canvasRef = useRef(null);
    const { shouldAnimate: shouldAnimateCore } = useVisibilityGate(canvasRef, {
        threshold: 0.08,
        rootMargin: '120px',
    });

    const state = useMemo(() => {
        if (integrityScore >= 80) return { label: t('core_status.states.optimal'), color: 'var(--color-success)', shadow: 'rgba(34, 197, 94, 0.4)' };
        if (integrityScore >= 50) return { label: t('core_status.states.stable'), color: 'var(--color-warning)', shadow: 'rgba(234, 179, 8, 0.4)' };
        return { label: t('core_status.states.degraded'), color: 'var(--color-danger)', shadow: 'rgba(239, 68, 68, 0.4)' };
    }, [integrityScore, t]);

    // Biosensor / Heartbeat Animation
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const parent = canvas.parentElement;
        const ctx = canvas.getContext('2d');
        let frame = 0;

        const resize = () => {
            const { effectivePixelRatio: dpr, pixelWidth, pixelHeight } = resolveRasterResolution({ cssWidth: Math.max(1, parent.clientWidth), cssHeight: Math.max(1, parent.clientHeight), devicePixelRatio: readDevicePixelRatio(),
            pixelRatioCap: 2, maxRenderPixels: 8_294_400 });
            if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
            if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };

        resize();
        const stopDpr = observeDevicePixelRatio({ onChange: resize });
        window.addEventListener('resize', resize);

        const stopLoop = runRenderLoop({
            enabled: shouldAnimateCore,
            simHz: 60,
            targetFps: 60,
            maxCatchUpSteps: 20,
            onRender: () => {
            const width = parent.clientWidth;
            const height = parent.clientHeight;

            ctx.clearRect(0, 0, width, height);

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
            ctx.lineWidth = 1;
            for (let x = 0; x < width; x += 20) {
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
            }
            for (let y = 0; y < height; y += 20) {
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
            }

            ctx.strokeStyle = state.color;
            ctx.lineWidth = 2;
            ctx.lineJoin = 'round';
            ctx.beginPath();

            const speed = 2;
            const waveLength = 120;

            for (let x = 0; x < width; x += 1) {
                const worldX = x - frame * speed;
                const localX = Math.abs(worldX % waveLength);

                let y = height / 2;
                if (localX < 100) {
                    const p = localX;
                    const amp = 30 * (integrityScore / 100);

                    if (p > 10 && p < 20) y -= amp * 0.1;
                    else if (p > 30 && p < 35) y -= amp * 0.2;
                    else if (p > 35 && p < 45) y -= amp * 1.0;
                    else if (p > 45 && p < 50) y += amp * 0.3;
                    else if (p > 60 && p < 80) y -= amp * 0.15;
                }

                if (x === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();

            const scanX = (frame * speed) % width;
            ctx.fillStyle = `rgba(255, 255, 255, 0.1)`;
            ctx.fillRect(scanX, 0, 2, height);

            frame++;
            },
        });
        return () => {
            stopLoop();
            window.removeEventListener('resize', resize);
            stopDpr();
        };
    }, [state, integrityScore, shouldAnimateCore]);

    const circumference = 2 * Math.PI * 45;
    const strokeDashoffset = circumference - (Math.min(100, dailyLimitPercent) / 100) * circumference;

    return (
        <Panel className="h-full w-full p-4 flex flex-col relative overflow-hidden bg-surface-sunken">
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
                <canvas ref={canvasRef} className="w-full h-full" />
            </div>

            <div className="flex justify-between items-start mb-6 relative z-10">
                <div>
                    <UiHeader variant="label" className="text-on-surface-muted/50 tracking-[0.2em] mb-1">
                        {t('core_status.unit')}
                    </UiHeader>
                    <div className="text-sm font-black text-on-surface tracking-tighter">
                        {t('core_status.bio_link')}
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-[10px] font-mono text-on-surface-muted/40 leading-tight">
                        {t('core_status.scan_freq')}<br />
                        {t('core_status.buff_state')}
                    </div>
                </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center relative">
                <div className="relative w-44 h-44 flex items-center justify-center">
                    <svg className="absolute inset-0 w-full h-full -rotate-90">
                        <circle cx="50%" cy="50%" r="45" fill="none" stroke="currentColor" className="text-on-surface/5" strokeWidth="8" />
                        <circle
                            cx="50%"
                            cy="50%"
                            r="45"
                            fill="none"
                            stroke={state.color}
                            strokeWidth="8"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            className="transition-all duration-1000 ease-out"
                            style={{ filter: `drop-shadow(0 0 4px ${state.color})` }}
                        />
                    </svg>

                    <div className="text-center group cursor-default">
                        <div className={`text-5xl font-black tabular-nums transition-all duration-500`} style={{ color: state.color }}>
                            {Math.round(integrityScore)}
                        </div>
                        <div className="text-[10px] font-black tracking-[0.3em] text-on-surface-muted mt-1 uppercase">
                            {state.label}
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-6 space-y-3 relative z-10">
                <div className="flex justify-between items-end border-b border-on-surface/5 pb-1">
                    <span className="text-[9px] font-bold text-on-surface-muted uppercase tracking-widest">
                        {t('core_status.load')}
                    </span>
                    <span className="text-sm font-mono font-black text-on-surface">{Math.round(dailyLimitPercent)}%</span>
                </div>
                <div className="flex justify-between items-end border-b border-on-surface/5 pb-1">
                    <span className="text-[9px] font-bold text-on-surface-muted uppercase tracking-widest">
                        {t('core_status.sync')}
                    </span>
                    <span className="text-[10px] font-black text-success uppercase">
                        {t('core_status.calibrated')}
                    </span>
                </div>
            </div>
        </Panel>
    );
}

