import React, { useMemo } from 'react';
import { Panel } from '@/ui-kit';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
export default function EntropyCoreStatus({
  integrityScore = 100,
  dailyLimitPercent = 0
}) {
  const {
    t
  } = useAppTranslation('main');
  // Determine visual state based on integrity score
  const state = useMemo(() => {
    if (integrityScore >= 80) return {
      label: t('entropy.core_status.labels.stable', {}),
      className: 'text-success',
      color: 'var(--terminal-success, #00ff00)',
      shadow: 'var(--terminal-success)'
    };
    if (integrityScore >= 50) return {
      label: t('entropy.core_status.labels.warning', {}),
      className: 'text-warning',
      color: 'var(--terminal-warn, #ffff00)',
      shadow: 'var(--terminal-warn)'
    };
    return {
      label: t('entropy.core_status.labels.critical', {}),
      className: 'text-alert',
      color: 'var(--terminal-alert, #ff0000)',
      shadow: 'var(--terminal-alert)'
    };
  }, [integrityScore, t]);

  // Calculate dynamic pulse speed (faster as integrity drops)
  const safeIntegrityScore = Number.isFinite(integrityScore) ? integrityScore : 0;
  const safeDailyLimitPercent = Number.isFinite(dailyLimitPercent) ? dailyLimitPercent : 0;
  const pulseSpeed = Math.max(0.5, safeIntegrityScore / 100 * 3);

  // Gauge Arc Calculation
  // r=42 is hardcoded in SVG to prevent variable ambiguity
  const circumference = 2 * Math.PI * 42;
  const strokeDashoffset = circumference - Math.min(100, safeDailyLimitPercent) / 100 * circumference;
  return <Panel className="h-full w-full p-0 flex flex-col items-center justify-center relative overflow-hidden">
            {/* Ambient Glow Background */}
            <div className="absolute inset-0 opacity-10 transition-colors duration-1000 pointer-events-none" style={{
      background: `radial-gradient(circle at center, ${state.color}, transparent 70%)`
    }} />

            {/* Tech Decorations */}
            <div className="absolute inset-x-4 top-4 flex justify-between text-[9px] text-on-surface-muted/50 font-mono">
                <span>{t('entropy.core_status.system_core', {})}</span>
                <span>V.3.1</span>
            </div>

            {/* Reactor Assembly */}
            <div className="relative w-48 h-48 flex items-center justify-center">
                {/* 1. Outer Rotating Ring (Mechanical) */}
                <div className="absolute inset-0 border border-border-muted rounded-full" style={{
        animation: 'spin 12s linear infinite'
      }} />

                {/* 2. Inner Counter-Rotating Ring (Magnetic) */}
                <div className="absolute inset-3 border border-border-muted/50 rounded-full border-dashed opacity-50" style={{
        animation: 'spin 16s linear infinite reverse'
      }} />

                {/* 3. Data Gauge (SVG) */}
                <svg className="absolute inset-0 w-full h-full transform -rotate-90 drop-shadow-lg">
                    {/* Track - Hardcoded r="42" */}
                    <circle cx="50%" cy="50%" r="42" fill="none" stroke="currentColor" className="text-border-muted/20" strokeWidth="4" />
                    {/* Active Gauge - Hardcoded r="42" */}
                    <circle cx="50%" cy="50%" r="42" fill="none" stroke={state.color} strokeWidth="4" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="butt" className="transition-all duration-1000 ease-out" style={{
          filter: `drop-shadow(0 0 2px ${state.color})`
        }} />
                </svg>

                {/* 4. The Core (Pulsing Heart) */}
                <div className="relative z-10 w-24 h-24 rounded-full flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm border border-border-muted transition-all duration-500" style={{
        boxShadow: `0 0 30px ${state.shadow}`,
        animation: `pulse ${pulseSpeed}s cubic-bezier(0.4, 0, 0.6, 1) infinite`
      }}>
                    <span className={`text-4xl font-black font-mono tracking-tighter ${state.className} transition-colors duration-300`}>
                        {Math.round(safeIntegrityScore)}%
                    </span>
                    <span className={`text-[9px] font-bold tracking-[0.2em] ${state.className} opacity-70 mt-1`}>
                        {state.label}
                    </span>
                </div>
            </div>

            {/* Bottom Status Line */}
            <div className="absolute bottom-4 w-full px-8">
                <div className="h-[1px] w-full bg-linear-to-r/srgb from-transparent via-border to-transparent" />
                <div className="flex justify-center mt-1 gap-4 text-[9px] text-on-surface-muted font-mono tracking-wider">
                    <span>
                        {t('entropy.core_status.power', {})}: {safeIntegrityScore > 0 ? t('entropy.core_status.online', {}) : t('entropy.core_status.offline', {})}
                    </span>
                    <span>{t('entropy.core_status.load', {})}: {Math.round(safeDailyLimitPercent)}%</span>
                </div>
            </div>
        </Panel>;
}
