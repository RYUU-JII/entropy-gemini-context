import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { Panel, UiHeader } from '@/ui-kit';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { runRenderLoop } from '@/platform/rendering/renderLoop.js';
import { useVisibilityGate } from '@/ui-kit/rendering/useVisibilityGate.js';

export default function ClinicalSignalScanner({
    signalScannerTargets = [],
    lockedTarget = null,
    onLockTarget,
    className = ""
}) {
    const { t } = useAppTranslation('main');
    const canvasRef = useRef(null);
    const { shouldAnimate: shouldAnimateScanner } = useVisibilityGate(canvasRef, {
        threshold: 0.08,
        rootMargin: '140px',
    });
    const scannerTargets = useMemo(
        () => (Array.isArray(signalScannerTargets) ? signalScannerTargets : []),
        [signalScannerTargets],
    );

    // Click Handler
    const handleCanvasClick = useCallback((e) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (canvas.width / rect.width);
        const y = (e.clientY - rect.top) * (canvas.height / rect.height);
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(centerX, centerY) * 0.9;

        for (const blip of scannerTargets) {
            const blipX = centerX + Math.cos(blip.rad) * (blip.dist * radius);
            const blipY = centerY + Math.sin(blip.rad) * (blip.dist * radius);
            if (Math.hypot(x - blipX, y - blipY) < 30) { // Larger hit zone for clinical feel
                onLockTarget?.(blip.domain);
                return;
            }
        }
        onLockTarget?.(null);
    }, [onLockTarget, scannerTargets]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        return runRenderLoop({
            enabled: shouldAnimateScanner,
            simHz: 60,
            targetFps: 60,
            maxCatchUpSteps: 20,
            onRender: ({ simTimeMs }) => {
            const now = simTimeMs;
            const { width, height } = canvas;
            const centerX = width / 2;
            const centerY = height / 2;
            const radius = Math.min(centerX, centerY) * 0.85;

            ctx.clearRect(0, 0, width, height);

            // 1. Sterile Background (Grid)
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
            ctx.lineWidth = 1;

            // Crosshairs
            ctx.beginPath();
            ctx.moveTo(centerX - radius, centerY); ctx.lineTo(centerX + radius, centerY);
            ctx.moveTo(centerX, centerY - radius); ctx.lineTo(centerX, centerY + radius);
            ctx.stroke();

            // Circles
            for (let i = 1; i <= 3; i++) {
                ctx.beginPath();
                ctx.arc(centerX, centerY, (radius / 3) * i, 0, Math.PI * 2);
                ctx.stroke();
            }

            // 2. Scan Beam (Clinical Sweep)
            const period = 5000;
            const angle = ((now % period) / period) * Math.PI * 2;

            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate(angle);
            const beamGradient = ctx.createLinearGradient(0, 0, radius, 0);
            beamGradient.addColorStop(0, 'rgba(16, 185, 129, 0.3)'); // Emerald Green
            beamGradient.addColorStop(1, 'rgba(16, 185, 129, 0)');
            ctx.strokeStyle = beamGradient;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(radius, 0);
            ctx.stroke();
            ctx.restore();

            // 3. Blips (Specimens)
            scannerTargets.forEach(blip => {
                const isLocked = lockedTarget === blip.domain;
                const blipX = centerX + Math.cos(blip.rad) * (blip.dist * radius);
                const blipY = centerY + Math.sin(blip.rad) * (blip.dist * radius);

                // Specimen appearance - Dark grey for visibility on light bg
                ctx.fillStyle = isLocked ? '#ef4444' : '#334155';

                // Draw blip (Microscope specimen look - diamond shape)
                ctx.save();
                ctx.translate(blipX, blipY);
                ctx.rotate(Math.PI / 4);
                const size = isLocked ? 6 : 4;
                ctx.fillRect(-size / 2, -size / 2, size, size);

                if (isLocked) {
                    ctx.shadowColor = '#ef4444';
                    ctx.shadowBlur = 10;
                    ctx.strokeStyle = '#ef4444';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(-size, -size, size * 2, size * 2);
                }
                ctx.restore();

                // Target Tagging UI
                if (isLocked) {
                    ctx.font = 'bold 9px monospace';
                    ctx.fillStyle = '#ef4444';
                    ctx.fillText(
                        t('clinical.signal_scanner.target_locked', { domain: blip.domain }),
                        blipX + 12,
                        blipY - 12,
                    );

                    // Connecting point to center
                    ctx.beginPath();
                    ctx.setLineDash([2, 5]);
                    ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
                    ctx.moveTo(centerX, centerY);
                    ctx.lineTo(blipX, blipY);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }
            });

            // 4. Edge Markings
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
            ctx.lineWidth = 1;
            for (let i = 0; i < 360; i += 30) {
                const r1 = radius + 5;
                const r2 = radius + 10;
                const a = (i * Math.PI) / 180;
                ctx.beginPath();
                ctx.moveTo(centerX + Math.cos(a) * r1, centerY + Math.sin(a) * r1);
                ctx.lineTo(centerX + Math.cos(a) * r2, centerY + Math.sin(a) * r2);
                ctx.stroke();
            }
            },
        });
    }, [scannerTargets, lockedTarget, t, shouldAnimateScanner]);

    return (
        <Panel className={`w-full h-full relative overflow-hidden flex flex-col ${className}`}>
            <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                <UiHeader className="text-[10px] tracking-[0.2em] font-black">{t('clinical.signal_scanner.specimen_scan')}</UiHeader>
            </div>

            <div className="flex-1 min-h-0 relative">
                <canvas
                    ref={canvasRef}
                    width={600}
                    height={600}
                    className="w-full h-full object-contain cursor-crosshair"
                    onClick={handleCanvasClick}
                />
            </div>

            <div className="absolute bottom-4 right-4 z-10 text-right">
                <div className="text-[8px] text-white/30 font-mono mb-1 uppercase tracking-widest">{t('clinical.signal_scanner.active_signals')}</div>
                <div className="text-xl font-black text-white tabular-nums">{scannerTargets.length}</div>
            </div>
        </Panel>
    );
}
