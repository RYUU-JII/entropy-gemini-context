import React, { useMemo, useRef, useEffect, useCallback } from 'react';
import { Panel, UiHeader } from '@/ui-kit';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { runRenderLoop } from '@/platform/rendering/renderLoop.js';
import { useVisibilityGate } from '@/ui-kit/rendering/useVisibilityGate.js';
function getStatusColor(status) {
  if (status === 'breach' || status === 'critical') return '#ef4444';
  if (status === 'warning') return '#facc15';
  return '#39ff14';
}
export default function MatrixSignalScanner({
  status = 'idle',
  signalScannerTargets = [],
  lockedTarget = null,
  onLockTarget,
  className = '',
  style = {}
}) {
  const {
    t
  } = useAppTranslation('main');
  const canvasRef = useRef(null);
  const {
    shouldAnimate: shouldAnimateScanner
  } = useVisibilityGate(canvasRef, {
    threshold: 0.08,
    rootMargin: '140px'
  });
  const config = useMemo(() => ({
    color: getStatusColor(status),
    gridColor: 'rgba(57,255,20,0.22)',
    ringColor: 'rgba(57,255,20,0.38)',
    sweepOpacity: 0.22,
    bezelPadding: 14
  }), [status]);
  const scannerTargets = useMemo(
    () => (Array.isArray(signalScannerTargets) ? signalScannerTargets : []),
    [signalScannerTargets],
  );
  const handleCanvasClick = useCallback(event => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (canvas.width / rect.width);
    const y = (event.clientY - rect.top) * (canvas.height / rect.height);
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - config.bezelPadding;
    for (const blip of scannerTargets) {
      const blipX = centerX + Math.cos(blip.rad) * (blip.dist * radius);
      const blipY = centerY + Math.sin(blip.rad) * (blip.dist * radius);
      if (Math.hypot(x - blipX, y - blipY) < 24) {
        onLockTarget?.(blip.domain);
        return;
      }
    }
    onLockTarget?.(null);
  }, [scannerTargets, config.bezelPadding, onLockTarget]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const lockPrefix = t('matrix.signal_scanner.lock_prefix');
    const drawGrid = (width, height, centerX, centerY, radius) => {
      ctx.strokeStyle = config.gridColor;
      ctx.lineWidth = 1;
      for (let i = -5; i <= 5; i += 1) {
        const x = centerX + i * radius / 5;
        ctx.beginPath();
        ctx.moveTo(x, centerY - radius);
        ctx.lineTo(x, centerY + radius);
        ctx.stroke();
      }
      for (let i = -5; i <= 5; i += 1) {
        const y = centerY + i * radius / 5;
        ctx.beginPath();
        ctx.moveTo(centerX - radius, y);
        ctx.lineTo(centerX + radius, y);
        ctx.stroke();
      }
      ctx.strokeStyle = config.ringColor;
      for (let i = 1; i <= 4; i += 1) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * i / 4, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(57,255,20,0.5)';
      ctx.beginPath();
      ctx.moveTo(centerX - radius, centerY);
      ctx.lineTo(centerX + radius, centerY);
      ctx.moveTo(centerX, centerY - radius);
      ctx.lineTo(centerX, centerY + radius);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(57,255,20,0.6)';
      ctx.strokeRect(centerX - radius, centerY - radius, radius * 2, radius * 2);
    };
    const drawSweep = (now, centerX, centerY, radius) => {
      const period = 3600;
      const angle = now % period / period * Math.PI * 2;
      const gradient = ctx.createConicGradient(angle, centerX, centerY);
      gradient.addColorStop(0, 'transparent');
      gradient.addColorStop(0.08, config.color);
      gradient.addColorStop(0.2, 'transparent');
      gradient.addColorStop(1, 'transparent');
      ctx.globalAlpha = config.sweepOpacity;
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      const scanX = centerX + Math.cos(angle) * radius;
      const scanY = centerY + Math.sin(angle) * radius;
      ctx.strokeStyle = `${config.color}aa`;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(scanX, scanY);
      ctx.stroke();
      ctx.setLineDash([]);
    };
    const drawBlips = (centerX, centerY, radius, now) => {
      scannerTargets.forEach((blip, index) => {
        const pulse = 0.72 + Math.sin(now * 0.004 + index * 1.7) * 0.28;
        const isLocked = blip.domain === lockedTarget;
        const baseX = centerX + Math.cos(blip.rad) * (blip.dist * radius);
        const baseY = centerY + Math.sin(blip.rad) * (blip.dist * radius);
        const size = isLocked ? 10 : 6;
        const half = size * pulse / 2;
        ctx.strokeStyle = isLocked ? '#ef4444' : '#39ff14';
        ctx.lineWidth = isLocked ? 1.6 : 1;
        ctx.strokeRect(baseX - half, baseY - half, half * 2, half * 2);
        ctx.beginPath();
        ctx.moveTo(baseX - half - 5, baseY);
        ctx.lineTo(baseX + half + 5, baseY);
        ctx.moveTo(baseX, baseY - half - 5);
        ctx.lineTo(baseX, baseY + half + 5);
        ctx.stroke();
        if (isLocked) {
          ctx.setLineDash([2, 4]);
          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          ctx.lineTo(baseX, baseY);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.font = 'bold 10px monospace';
          ctx.fillStyle = '#ef4444';
          ctx.fillText(`${lockPrefix}:${blip.domain}`, baseX + 12, baseY - 8);
        }
      });
    };
    const drawNoise = (width, height) => {
      for (let i = 0; i < 130; i += 1) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        ctx.fillStyle = 'rgba(57,255,20,0.03)';
        ctx.fillRect(x, y, 1, 1);
      }
    };
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
        ctx.fillStyle = 'rgba(0, 10, 0, 0.85)';
        ctx.fillRect(0, 0, width, height);
        drawGrid(width, height, centerX, centerY, radius);
        drawSweep(now, centerX, centerY, radius);
        drawBlips(centerX, centerY, radius, now);
        drawNoise(width, height);
      }
    });
  }, [scannerTargets, lockedTarget, config, t, shouldAnimateScanner]);
  const statusColor = getStatusColor(status);
  const statusText = t(`matrix.signal_scanner.status.${status}`, {});
  return <Panel className={`relative flex h-full w-full flex-col overflow-hidden border border-[#14532d] bg-[#010602] ${className}`} style={style}>
            <div className="pointer-events-none absolute inset-0 opacity-20" style={{
      background: 'repeating-linear-gradient(180deg, rgba(57,255,20,0.12) 0px, rgba(57,255,20,0.12) 1px, transparent 1px, transparent 4px)'
    }} />

            <div className="absolute left-4 top-3 z-10 flex items-center gap-3 text-[10px] uppercase tracking-[0.2em]">
                <div className="h-2 w-2 rounded-sm" style={{
        background: statusColor,
        boxShadow: `0 0 10px ${statusColor}`
      }} />
                <UiHeader className="font-mono text-[#86efac]">{t('matrix.signal_scanner.title')}</UiHeader>
            </div>

            <div className="absolute right-4 top-3 z-10 text-right font-mono text-[10px] uppercase tracking-[0.16em] text-[#86efac]/75">
                <div>{t('matrix.signal_scanner.status_label', {
          status: statusText
        })}</div>
                <div>{t('matrix.signal_scanner.feed_live')}</div>
            </div>

            <div className="relative z-0 flex-1 min-h-0">
                <canvas ref={canvasRef} width={600} height={600} className="h-full w-full cursor-crosshair object-contain" onClick={handleCanvasClick} />
            </div>

            <div className="absolute bottom-3 right-4 z-10 text-right font-mono">
                <div className="text-[9px] uppercase tracking-[0.2em] text-[#86efac]/65">{t('matrix.signal_scanner.packets')}</div>
                <div className="text-2xl font-black text-[#39ff14]" style={{
        textShadow: '0 0 10px rgba(57,255,20,0.5)'
      }}>
                    {scannerTargets.length}
                </div>
            </div>
        </Panel>;
}
