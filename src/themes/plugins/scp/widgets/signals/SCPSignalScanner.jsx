import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { Panel, UiHeader } from '@/ui-kit';
import { runRenderLoop } from '@/platform/rendering/renderLoop.js';
import { useVisibilityGate } from '@/ui-kit/rendering/useVisibilityGate.js';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';

/**
 * SCP Foundation Anomaly Tracker (Thermal)
 * Replaces radar blips with blurred heat signatures (blotches).
 */
export default function SCPSignalScanner({
  signalScannerTargets = [],
  lockedTarget = null,
  onLockTarget,
  className = ''
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
  const scannerTargets = useMemo(
    () => (Array.isArray(signalScannerTargets) ? signalScannerTargets : []),
    [signalScannerTargets],
  );
  const labels = useMemo(() => ({
    anomalyId: t('scp.signal_scanner.anomaly_id', {}),
    threatLevel: t('scp.signal_scanner.threat_level', {}),
    defaultThreatClass: t('scp.signal_scanner.default_threat_class', {}),
    siteSurveillance: t('scp.signal_scanner.site_surveillance', {}),
    recording: t('scp.signal_scanner.recording', {}),
    title: t('scp.signal_scanner.title', {}),
    breachWarning: t('scp.signal_scanner.breach_warning', {}),
    trackedSignatures: t('scp.signal_scanner.tracked_signatures', {})
  }), [t]);

  // Heat Blotch Logic: Each blotch has a pulsing intensity
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

      // Anomalies have a larger "presence" than dots
      if (Math.hypot(x - blipX, y - blipY) < 40) {
        onLockTarget?.(blip.domain);
        return;
      }
    }
    onLockTarget?.(null);
  }, [scannerTargets, onLockTarget]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', {
      willReadFrequently: true
    });
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
        const radius = Math.min(centerX, centerY) * 0.9;
        ctx.clearRect(0, 0, width, height);

        // 1. Containment Grid (Brutalist Administration)
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 1;

        // Major Grid
        const gridSize = 40;
        ctx.beginPath();
        for (let x = 0; x <= width; x += gridSize) {
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
        }
        for (let y = 0; y <= height; y += gridSize) {
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
        }
        ctx.stroke();

        // 2. Zone Borders
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.15)';
        ctx.lineWidth = 2;
        ctx.strokeRect(centerX - radius, centerY - radius, radius * 2, radius * 2);

        // 3. Thermal Anomaly Blotches
        scannerTargets.forEach(blip => {
          const isLocked = lockedTarget === blip.domain;
          const blipX = centerX + Math.cos(blip.rad) * (blip.dist * radius);
          const blipY = centerY + Math.sin(blip.rad) * (blip.dist * radius);

          // Pulse intensity based on time
          const pulse = 0.7 + Math.sin(now / 500 + blip.rad * 10) * 0.3;
          const size = (isLocked ? 35 : 25) * pulse;

          // Draw Heat Blotch
          const gradient = ctx.createRadialGradient(blipX, blipY, 0, blipX, blipY, size);
          if (isLocked) {
            gradient.addColorStop(0, 'rgba(255, 0, 0, 0.8)');
            gradient.addColorStop(0.4, 'rgba(255, 60, 0, 0.4)');
            gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
          } else {
            gradient.addColorStop(0, 'rgba(255, 100, 0, 0.5)');
            gradient.addColorStop(0.5, 'rgba(255, 150, 0, 0.2)');
            gradient.addColorStop(1, 'rgba(255, 100, 0, 0)');
          }
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(blipX, blipY, size, 0, Math.PI * 2);
          ctx.fill();
          if (isLocked) {
            // Classification HUD
            ctx.save();
            ctx.translate(blipX, blipY);

            // Crosshair/Targeting
            ctx.strokeStyle = '#ff0000';
            ctx.setLineDash([2, 2]);
            ctx.beginPath();
            ctx.arc(0, 0, size * 1.2, 0, Math.PI * 2);
            ctx.stroke();

            // Data Label
            ctx.font = '9px "Courier Prime", monospace';
            ctx.fillStyle = '#ff0000';
            ctx.fillText(`${labels.anomalyId}: ${blip.domain}`, size + 10, -5);
            ctx.fillText(`${labels.threatLevel}: ${labels.defaultThreatClass}`, size + 10, 8);
            ctx.restore();
          }
        });

        // 4. Site Overlays (Brutalist Static)
        ctx.fillStyle = 'rgba(255, 0, 0, 0.05)';
        ctx.font = '10px monospace';
        ctx.fillText(labels.siteSurveillance, 10, height - 10);

        // 5. Visual Static / Film Grain (Night Lab Atmosphere)
        const noiseStrength = 15;
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          const noise = (Math.random() - 0.5) * noiseStrength;
          data[i] += noise; // R
          data[i + 1] += noise; // G
          data[i + 2] += noise; // B
        }
        ctx.putImageData(imageData, 0, 0);

        // 6. Rec Indicator
        if (Math.floor(now / 1000) % 2 === 0) {
          ctx.fillStyle = '#ff0000';
          ctx.font = 'bold 10px monospace';
          ctx.fillText(`● ${labels.recording}`, width - 40, 20);
        }
      }
    });
  }, [scannerTargets, labels, lockedTarget, shouldAnimateScanner]);
  return <Panel className={`w-full h-full relative overflow-hidden flex flex-col ${className}`}>
            <div className="absolute top-4 left-4 z-10 flex items-center gap-3">
                <div className="flex flex-col">
                    <UiHeader className="text-[11px] tracking-[0.25em] font-black text-on-surface/90">{labels.title}</UiHeader>
                    <div className="text-[8px] font-mono text-danger/60 tracking-widest mt-0.5">{labels.breachWarning}</div>
                </div>
            </div>

            <div className="flex-1 min-h-0 relative">
                <canvas ref={canvasRef} width={600} height={600} className="w-full h-full object-contain cursor-crosshair opacity-80" onClick={handleCanvasClick} />
            </div>

            <div className="absolute bottom-4 right-4 z-10 text-right">
                <div className="text-[8px] text-on-surface-muted/40 font-mono mb-0.5 uppercase tracking-[0.3em]">{labels.trackedSignatures}</div>
                <div className="text-lg font-black text-on-surface tabular-nums tracking-tighter">{scannerTargets.length}</div>
            </div>
        </Panel>;
}
