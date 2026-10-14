import React, { useMemo, useRef, useEffect, useCallback } from 'react';
import { Panel, UiHeader } from '@/ui-kit';
import { runRenderLoop } from '@/platform/rendering/renderLoop.js';
import { useVisibilityGate } from '@/ui-kit/rendering/useVisibilityGate.js';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
export default function EntropySignalScanner({
  status = 'idle',
  signalScannerTargets = [],
  onNeutralize,
  lockedTarget = null,
  onLockTarget,
  className = '',
  style = {}
}) {
  const {
    t
  } = useAppTranslation('main');
  const wrapperRef = useRef(null);
  const canvasRef = useRef(null);
  const {
    shouldAnimate: shouldAnimateScanner
  } = useVisibilityGate(canvasRef, {
    threshold: 0.08,
    rootMargin: '140px'
  });

  // Config - Hardcoded defaults for Entropy theme consistency
  const config = useMemo(() => ({
    accentColor: '#39ff14',
    // Entropy Green (Neon)
    gridColor: '#005500',
    // Dark Green
    gridOpacity: 0.4,
    lineWidth: 1,
    ringCount: 4,
    sweepOpacity: 0.3,
    bezelPadding: 10,
    blipSize: 4,
    blipLockedScale: 1.5
  }), []);
  const scannerTargets = useMemo(
    () => (Array.isArray(signalScannerTargets) ? signalScannerTargets : []),
    [signalScannerTargets],
  );

  // Click Handler
  const handleCanvasClick = useCallback(e => {
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
      if (Math.hypot(x - blipX, y - blipY) < 20) {
        onLockTarget?.(blip.domain);
        return;
      }
    }
    onLockTarget?.(null);
  }, [onLockTarget, scannerTargets]);

  // Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    return runRenderLoop({
      enabled: shouldAnimateScanner,
      simHz: 60,
      targetFps: 60,
      maxCatchUpSteps: 20,
      onRender: ({
        simTimeMs
      }) => {
        const now = simTimeMs;
        const {
          width,
          height
        } = canvas;
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(centerX, centerY) - config.bezelPadding;
        ctx.clearRect(0, 0, width, height);

        // 1. Grid Rings
        ctx.strokeStyle = config.gridColor;
        ctx.lineWidth = config.lineWidth;
        ctx.globalAlpha = config.gridOpacity;
        for (let i = 1; i <= config.ringCount; i++) {
          ctx.beginPath();
          const r = radius / config.ringCount * i;
          ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Crosshair
        ctx.beginPath();
        ctx.moveTo(centerX, centerY - radius);
        ctx.lineTo(centerX, centerY + radius);
        ctx.moveTo(centerX - radius, centerY);
        ctx.lineTo(centerX + radius, centerY);
        ctx.stroke();
        ctx.globalAlpha = 1.0;

        // 2. Sweep Line
        const period = 4000;
        const angle = now % period / period * Math.PI * 2;
        const gradient = ctx.createConicGradient(angle + Math.PI / 2, centerX, centerY);
        gradient.addColorStop(0, 'transparent');
        gradient.addColorStop(0.15, config.accentColor);
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.globalAlpha = config.sweepOpacity;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;

        // 3. Blips
        scannerTargets.forEach(blip => {
          const isLocked = lockedTarget === blip.domain;
          const blipX = centerX + Math.cos(blip.rad) * (blip.dist * radius);
          const blipY = centerY + Math.sin(blip.rad) * (blip.dist * radius);
          const size = isLocked ? config.blipSize * 2 : config.blipSize;
          ctx.fillStyle = isLocked ? '#ff0000' : config.accentColor; // Red if locked, Green otherwise

          ctx.beginPath();
          ctx.arc(blipX, blipY, size, 0, Math.PI * 2);
          ctx.fill();

          // Locked Visuals
          if (isLocked) {
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(blipX, blipY, size * 3, 0, Math.PI * 2);
            ctx.stroke();

            // Leader line
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(blipX, blipY);
            ctx.setLineDash([2, 4]);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        });
      }
    });
  }, [scannerTargets, lockedTarget, config, shouldAnimateScanner]);
  return <Panel ref={wrapperRef} className={`w-full h-full relative overflow-hidden flex flex-col items-center justify-center bg-black ${className}`} style={style}>
      <div className="absolute inset-0 z-0">
        <canvas ref={canvasRef} width={600} height={600} className="w-full h-full object-contain cursor-crosshair active:cursor-grabbing" onClick={handleCanvasClick} />
      </div>

      {/* Overlay UI */}
      <div className="absolute top-5 left-5 z-10 pointer-events-none select-none">
        <div className="flex items-center gap-3">
          <div className="relative w-3.5 h-3.5">
            <div className="absolute inset-0 rounded-full border border-[var(--color-accent)] animate-pulse" />
            <div className="absolute inset-[3px] rounded-full bg-[var(--color-accent)]" style={{
            boxShadow: '0 0 12px var(--color-accent)'
          }} />
          </div>
          <UiHeader className="text-xs text-[var(--color-accent)] font-mono uppercase tracking-[0.15em] font-bold">
            {t('entropy.signal_scanner.title', {})}
          </UiHeader>
        </div>
      </div>

      <div className="absolute bottom-4 right-4 z-10 pointer-events-none text-right select-none">
        <UiHeader variant="label" className="text-on-surface-muted/50">
          {t('entropy.signal_scanner.active_signals', {})}
        </UiHeader>
        <div className="text-2xl font-black text-on-surface">{scannerTargets.length}</div>
      </div>

    </Panel>;
}
