import React, { useMemo, useEffect, useRef } from 'react';
import { Panel, UiHeader } from '@/ui-kit';
import { runRenderLoop } from '@/platform/rendering/renderLoop.js';
import { useVisibilityGate } from '@/ui-kit/rendering/useVisibilityGate.js';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';

/**
 * SCP Site-19 Integrity Monitor
 * Visualizes "Hume Levels" (reality stability) instead of health/heartbeat.
 */
export default function SCPCoreStatus({
  integrityScore = 100,
  dailyLimitPercent = 0
}) {
  const {
    t
  } = useAppTranslation('main');
  const canvasRef = useRef(null);
  const {
    shouldAnimate: shouldAnimateCore
  } = useVisibilityGate(canvasRef, {
    threshold: 0.08,
    rootMargin: '120px'
  });
  const stability = useMemo(() => {
    if (integrityScore >= 90) {
      return {
        label: t('scp.core_status.labels.synchronized', {}),
        color: '#00ff41',
        state: t('scp.core_status.states.reassured', {})
      };
    }
    if (integrityScore >= 70) {
      return {
        label: t('scp.core_status.labels.fluctuating', {}),
        color: '#ffff00',
        state: t('scp.core_status.states.caution', {})
      };
    }
    if (integrityScore >= 50) {
      return {
        label: t('scp.core_status.labels.instability', {}),
        color: '#ff6600',
        state: t('scp.core_status.states.critical', {})
      };
    }
    return {
      label: t('scp.core_status.labels.reality_failure', {}),
      color: '#ff0000',
      state: t('scp.core_status.states.ck_class', {})
    };
  }, [integrityScore, t]);

  // Reality Flux Animation (Jagged, unstable noise instead of smooth pulse)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let frame = 0;
    return runRenderLoop({
      enabled: shouldAnimateCore,
      simHz: 60,
      targetFps: 60,
      maxCatchUpSteps: 20,
      onRender: () => {
        const {
          width,
          height
        } = canvas;
        ctx.clearRect(0, 0, width, height);

        // Brutalist Crosshairs
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(width / 2, 0);
        ctx.lineTo(width / 2, height);
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();

        // Hume Frequency Line (Jagged)
        ctx.strokeStyle = stability.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        const points = 40;
        const step = width / points;
        for (let i = 0; i <= points; i++) {
          const x = i * step;
          // Unstable jitter - Increased for Night Lab feel
          const jitter = (Math.random() - 0.5) * (100 - integrityScore) * 0.8;
          // Occasional dramatic spike
          const spike = Math.random() > 0.98 ? (Math.random() - 0.5) * 50 : 0;
          const wave = Math.sin(i * 0.5 + frame * 0.1) * 15;
          const y = height / 2 + wave + jitter + spike;
          if (i === 0) ctx.moveTo(x, y);else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Occasional full screen static flash
        if (Math.random() > 0.99) {
          ctx.fillStyle = `rgba(255, 0, 0, 0.1)`;
          ctx.fillRect(0, 0, width, height);
        }
        frame++;
      }
    });
  }, [stability, integrityScore, shouldAnimateCore]);
  return <Panel className="h-full w-full p-4 flex flex-col relative overflow-hidden bg-surface-sunken">
            {/* Background Data Stream */}
            <div className="absolute inset-0 opacity-[0.1] pointer-events-none">
                <canvas ref={canvasRef} width={400} height={400} className="w-full h-full" />
            </div>

            {/* Header Section */}
            <div className="flex justify-between items-start mb-6 relative z-10">
                <div className="flex flex-col">
                    <div className="flex items-center gap-2 mb-1">
                        <div className={`w-1.5 h-1.5 rounded-full`} style={{
            backgroundColor: stability.color,
            boxShadow: `0 0 8px ${stability.color}`
          }} />
                        <UiHeader variant="label" className="text-[10px] tracking-[0.3em] font-black text-on-surface-muted/50">
                            {t('scp.core_status.site_integrity', {})}
                        </UiHeader>
                    </div>
                    <div className="text-xs font-mono font-bold text-on-surface uppercase tracking-tighter">
                        {t('scp.core_status.hume_level', {})}: {stability.state}
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-[9px] font-mono text-on-surface-muted/40 leading-none tracking-widest uppercase">
                        {t('scp.core_status.containment_notice', {})}<br />
                        {t('scp.core_status.security_level', {})}
                    </div>
                </div>
            </div>

            {/* Main Gauge Section */}
            <div className="flex-1 flex flex-col items-center justify-center relative">
                {/* Brutalist Rectangular Gauge */}
                <div className="relative w-full px-6 flex flex-col items-center">
                    <div className="w-full h-3 bg-white/5 border border-white/10 relative overflow-hidden mb-3">
                        <div className="absolute inset-y-0 left-0 transition-all duration-1000 ease-out" style={{
            width: `${integrityScore}%`,
            backgroundColor: stability.color,
            boxShadow: `0 0 15px ${stability.color}44`
          }} />
                        {/* Scale Ticks */}
                        <div className="absolute inset-0 flex justify-between px-1">
                            {[...Array(10)].map((_, i) => <div key={i} className="w-px h-full bg-black/40" />)}
                        </div>
                    </div>

                    <div className="text-center">
                        <div className="text-6xl font-black tabular-nums tracking-tighter text-white" style={{
            textShadow: `0 0 20px ${stability.color}33`
          }}>
                            {Math.round(integrityScore)}<span className="text-xl text-white/40 ml-1">Hm</span>
                        </div>
                        <div className="text-[11px] font-mono font-black tracking-[0.4em] text-white/40 mt-1 uppercase">
                            {t('scp.core_status.reality_coefficient', {})}
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer Metrics */}
            <div className="mt-6 space-y-3 relative z-10 w-full px-1">
                <div className="flex justify-between items-end border-b border-on-surface/5 pb-1">
                    <span className="text-[9px] font-bold text-on-surface-muted uppercase tracking-widest">
                        {t('scp.core_status.flux_rate', {})}
                    </span>
                    <span className="text-sm font-mono font-black text-on-surface">{Math.round(dailyLimitPercent)}%</span>
                </div>
                <div className="flex justify-between items-end border-b border-on-surface/5 pb-1">
                    <span className="text-[9px] font-bold text-on-surface-muted uppercase tracking-widest">
                        {t('scp.core_status.stability', {})}
                    </span>
                    <span className="text-[10px] font-black text-success uppercase">
                        {t('scp.core_status.optimized', {})}
                    </span>
                </div>
            </div>
        </Panel>;
}
