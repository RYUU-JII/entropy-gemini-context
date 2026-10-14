import { resolveRasterResolution } from '@/platform/rendering/renderBudgetContract.js';
import { observeDevicePixelRatio, readDevicePixelRatio } from '@/platform/rendering/devicePixelRatio.js';
import React, { useMemo, useRef, useEffect, useCallback } from 'react';
import { Panel, UiHeader } from '@/ui-kit';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { runRenderLoop } from '@/platform/rendering/renderLoop.js';
import { useVisibilityGate } from '@/ui-kit/rendering/useVisibilityGate.js';
function resolveStatusColor(status) {
  if (status === 'breach' || status === 'critical') return '#ff2d72';
  if (status === 'warning') return '#f59e0b';
  return '#00f3ff';
}
function toFinite(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
export default function CyberpunkSignalScanner({
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
  const normalizedBlips = useMemo(() => (
    (Array.isArray(signalScannerTargets) ? signalScannerTargets : [])
  ).map(blip => ({
    domain: blip?.domain,
    rad: toFinite(blip?.rad, NaN),
    dist: Math.max(0, Math.min(1, toFinite(blip?.dist, NaN)))
  })).filter(blip => Number.isFinite(blip.rad) && Number.isFinite(blip.dist)), [signalScannerTargets]);
  const config = useMemo(() => ({
    accent: resolveStatusColor(status),
    gridPrimary: 'rgba(0,243,255,0.2)',
    gridSecondary: 'rgba(106,92,255,0.18)',
    sweepOpacity: 0.24,
    bezelPadding: 14
  }), [status]);
  const handleCanvasClick = useCallback(event => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const x = (event.clientX - rect.left) * (canvas.width / rect.width);
    const y = (event.clientY - rect.top) * (canvas.height / rect.height);
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - config.bezelPadding;
    if (radius <= 0) return;
    for (const blip of normalizedBlips) {
      const blipX = centerX + Math.cos(blip.rad) * (blip.dist * radius);
      const blipY = centerY + Math.sin(blip.rad) * (blip.dist * radius);
      if (Math.hypot(x - blipX, y - blipY) < 24) {
        onLockTarget?.(blip.domain);
        return;
      }
    }
    onLockTarget?.(null);
  }, [normalizedBlips, config.bezelPadding, onLockTarget]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const { pixelWidth: nextWidth, pixelHeight: nextHeight } = resolveRasterResolution({ cssWidth: Math.max(1, rect.width), cssHeight: Math.max(1, rect.height), devicePixelRatio: readDevicePixelRatio(),
            pixelRatioCap: 2, maxRenderPixels: 8_294_400 });
      if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
        canvas.width = nextWidth;
        canvas.height = nextHeight;
      }
    };
    resizeCanvas();
    const observer = new ResizeObserver(() => resizeCanvas());
    observer.observe(canvas);
    const stopDpr = observeDevicePixelRatio({ onChange: resizeCanvas });
    return () => { stopDpr(); observer.disconnect(); };
  }, []);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const drawGrid = (centerX, centerY, radius) => {
      ctx.lineWidth = 1;
      ctx.strokeStyle = config.gridPrimary;
      for (let i = 1; i <= 5; i += 1) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * i / 5, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.strokeStyle = config.gridSecondary;
      for (let i = -4; i <= 4; i += 1) {
        const x = centerX + i * radius / 4;
        ctx.beginPath();
        ctx.moveTo(x, centerY - radius);
        ctx.lineTo(x, centerY + radius);
        ctx.stroke();
      }
      for (let i = -4; i <= 4; i += 1) {
        const y = centerY + i * radius / 4;
        ctx.beginPath();
        ctx.moveTo(centerX - radius, y);
        ctx.lineTo(centerX + radius, y);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(0,243,255,0.46)';
      ctx.beginPath();
      ctx.moveTo(centerX - radius, centerY);
      ctx.lineTo(centerX + radius, centerY);
      ctx.moveTo(centerX, centerY - radius);
      ctx.lineTo(centerX, centerY + radius);
      ctx.stroke();
    };
    const drawSweep = (now, centerX, centerY, radius) => {
      const period = 3400;
      const angle = now % period / period * Math.PI * 2;
      const gradient = ctx.createConicGradient(angle, centerX, centerY);
      gradient.addColorStop(0, 'transparent');
      gradient.addColorStop(0.07, `${config.accent}cc`);
      gradient.addColorStop(0.18, 'transparent');
      gradient.addColorStop(1, 'transparent');
      ctx.globalAlpha = config.sweepOpacity;
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      const scanX = centerX + Math.cos(angle) * radius;
      const scanY = centerY + Math.sin(angle) * radius;
      ctx.strokeStyle = `${config.accent}cc`;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(scanX, scanY);
      ctx.stroke();
      ctx.setLineDash([]);
    };
    const drawBlips = (now, centerX, centerY, radius) => {
      normalizedBlips.forEach((blip, index) => {
        const jitterX = Math.sin(now * 0.012 + index) * 0.8;
        const jitterY = Math.cos(now * 0.01 + index * 0.7) * 0.8;
        const pulse = 0.68 + Math.sin(now * 0.004 + index) * 0.32;
        const isLocked = blip.domain === lockedTarget;
        const px = centerX + Math.cos(blip.rad) * (blip.dist * radius) + jitterX;
        const py = centerY + Math.sin(blip.rad) * (blip.dist * radius) + jitterY;
        const size = (isLocked ? 10 : 6) * pulse;
        const half = size / 2;
        ctx.strokeStyle = isLocked ? '#ff2d72' : '#00f3ff';
        ctx.lineWidth = isLocked ? 1.8 : 1.2;
        ctx.strokeRect(px - half, py - half, size, size);
        ctx.beginPath();
        ctx.moveTo(px - half - 4, py);
        ctx.lineTo(px + half + 4, py);
        ctx.moveTo(px, py - half - 4);
        ctx.lineTo(px, py + half + 4);
        ctx.stroke();
        if (isLocked) {
          ctx.strokeStyle = 'rgba(255,45,114,0.8)';
          ctx.setLineDash([2, 3]);
          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          ctx.lineTo(px, py);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.font = 'bold 10px monospace';
          ctx.fillStyle = '#ff2d72';
          ctx.fillText(`${t('cyberpunk.signal_scanner.lock_prefix')}:${blip.domain}`, px + 12, py - 8);
        }
      });
    };
    const drawNoise = (width, height) => {
      for (let i = 0; i < 120; i += 1) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const color = i % 3 === 0 ? 'rgba(0,243,255,0.05)' : 'rgba(106,92,255,0.05)';
        ctx.fillStyle = color;
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
        ctx.fillStyle = '#020712';
        ctx.fillRect(0, 0, width, height);
        // A collapsed or not-yet-measured canvas has no area inside the bezel.
        // Keep its surface clear until the existing resize owner restores it.
        if (radius <= 0) return;
        drawGrid(centerX, centerY, radius);
        drawSweep(now, centerX, centerY, radius);
        drawBlips(now, centerX, centerY, radius);
        drawNoise(width, height);
      }
    });
  }, [normalizedBlips, lockedTarget, config, t, shouldAnimateScanner]);
  const statusColor = resolveStatusColor(status);
  const statusText = t(`cyberpunk.signal_scanner.status.${status}`, {});
  return <Panel className={`relative flex h-full w-full flex-col overflow-hidden border border-[#113054] bg-[#020812] ${className}`} style={style}>
            <div className="pointer-events-none absolute inset-0 opacity-24" style={{
      background: 'repeating-linear-gradient(180deg, rgba(0,243,255,0.12) 0px, rgba(0,243,255,0.12) 1px, transparent 1px, transparent 4px)'
    }} />

            <div className="absolute left-4 top-3 z-10 flex items-center gap-3 text-[10px] uppercase tracking-[0.2em]">
                <div className="h-2 w-2 rounded-sm" style={{
        background: statusColor,
        boxShadow: `0 0 10px ${statusColor}`
      }} />
                <UiHeader className="font-mono text-[#9fd8ff]">{t('cyberpunk.signal_scanner.title')}</UiHeader>
            </div>

            <div className="absolute right-4 top-3 z-10 text-right font-mono text-[10px] uppercase tracking-[0.16em] text-[#8ab5d7]/85">
                <div>{t('cyberpunk.signal_scanner.status_label', {
          status: statusText
        })}</div>
                <div>{t('cyberpunk.signal_scanner.stream_live')}</div>
            </div>

            <div className="relative z-0 flex-1 min-h-0">
                <canvas ref={canvasRef} className="h-full w-full cursor-crosshair object-contain" onClick={handleCanvasClick} />
            </div>

            <div className="absolute bottom-3 right-4 z-10 text-right font-mono">
                <div className="text-[9px] uppercase tracking-[0.2em] text-[#8ab5d7]/80">{t('cyberpunk.signal_scanner.packets')}</div>
                <div className="text-2xl font-black text-[#00f3ff]" style={{
        textShadow: '0 0 10px rgba(0,243,255,0.5)'
      }}>
                    {normalizedBlips.length}
                </div>
            </div>
        </Panel>;
}
