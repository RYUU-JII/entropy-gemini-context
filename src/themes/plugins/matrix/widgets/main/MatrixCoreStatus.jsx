import React, { useMemo } from 'react';
import { Panel } from '@/ui-kit';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';

function getState(integrityScore, t) {
    if (integrityScore >= 80) {
        return {
            code: t('matrix.core_status.codes.sync'),
            label: t('matrix.core_status.states.stable'),
            toneClass: 'text-[#39ff14]',
            glow: '0 0 16px rgba(57,255,20,0.55)',
            barClass: 'bg-[#39ff14]',
        };
    }
    if (integrityScore >= 50) {
        return {
            code: t('matrix.core_status.codes.warn'),
            label: t('matrix.core_status.states.drift'),
            toneClass: 'text-[#facc15]',
            glow: '0 0 16px rgba(250,204,21,0.5)',
            barClass: 'bg-[#facc15]',
        };
    }
    return {
        code: t('matrix.core_status.codes.fail'),
        label: t('matrix.core_status.states.breach'),
        toneClass: 'text-[#ef4444]',
        glow: '0 0 16px rgba(239,68,68,0.55)',
        barClass: 'bg-[#ef4444]',
    };
}

export default function MatrixCoreStatus({ integrityScore = 100, dailyLimitPercent = 0 }) {
    const { t } = useAppTranslation('main');
    const safeIntegrityScore = Number.isFinite(integrityScore)
        ? Math.max(0, Math.min(100, integrityScore))
        : 0;
    const safeDailyLimitPercent = Number.isFinite(dailyLimitPercent)
        ? Math.max(0, Math.min(100, dailyLimitPercent))
        : 0;

    const state = useMemo(() => getState(safeIntegrityScore, t), [safeIntegrityScore, t]);
    const meterActiveCells = Math.max(0, Math.min(20, Math.round((safeIntegrityScore / 100) * 20)));
    const loadActiveCells = Math.max(0, Math.min(20, Math.round((safeDailyLimitPercent / 100) * 20)));

    return (
        <Panel className="relative h-full w-full overflow-hidden border border-[#0c3f17] bg-[#020804] p-5 font-mono">
            <div
                className="pointer-events-none absolute inset-0 opacity-35"
                style={{
                    backgroundImage:
                        'linear-gradient(rgba(57,255,20,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(57,255,20,0.05) 1px, transparent 1px)',
                    backgroundSize: '18px 18px',
                }}
            />
            <div
                className="pointer-events-none absolute inset-0 opacity-15"
                style={{
                    background:
                        'repeating-linear-gradient(180deg, rgba(57,255,20,0.12) 0px, rgba(57,255,20,0.12) 1px, transparent 1px, transparent 4px)',
                }}
            />

            <div className="relative z-10 flex h-full flex-col">
                <div className="mb-4 flex items-center justify-between text-[10px] uppercase tracking-[0.22em] text-[#6ee7b7]/70">
                    <span>{t('matrix.core_status.kernel')}</span>
                    <span>{t('matrix.core_status.node')}</span>
                </div>

                <div className="grid flex-1 grid-cols-[minmax(0,1fr)_150px] gap-5 min-h-0">
                    <div className="flex min-h-0 flex-col border border-[#1b5a2b] bg-[#04120a]/80 p-4">
                        <div className="text-[10px] uppercase tracking-[0.2em] text-[#86efac]/70">{t('matrix.core_status.integrity_index')}</div>
                        <div className="mt-2 flex items-end gap-2">
                            <div
                                className={`text-6xl font-black tabular-nums leading-none ${state.toneClass}`}
                                style={{ textShadow: state.glow }}
                            >
                                {Math.round(safeIntegrityScore)}
                            </div>
                            <div className="pb-2 text-sm tracking-[0.2em] text-[#86efac]/70">%</div>
                        </div>

                        <div className="mt-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em]">
                            <span className={`inline-flex border px-2 py-0.5 ${state.toneClass}`}>{state.code}</span>
                            <span className="text-[#9ca3af]">{state.label}</span>
                        </div>

                        <div className="mt-5 space-y-2">
                            <div className="text-[10px] uppercase tracking-[0.18em] text-[#86efac]/70">{t('matrix.core_status.core_cells')}</div>
                            <div className="grid grid-cols-10 gap-1">
                                {Array.from({ length: 20 }).map((_, index) => (
                                    <div
                                        key={`meter-${index}`}
                                        className={`h-2 border ${index < meterActiveCells ? `${state.barClass} border-black/30` : 'border-[#1f2937] bg-[#05090a]'}`}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="mt-auto pt-4">
                            <div className="mb-1 text-[10px] uppercase tracking-[0.18em] text-[#86efac]/70">{t('matrix.core_status.load_saturation')}</div>
                            <div className="grid grid-cols-10 gap-1">
                                {Array.from({ length: 20 }).map((_, index) => (
                                    <div
                                        key={`load-${index}`}
                                        className={`h-1.5 border ${index < loadActiveCells ? 'border-black/30 bg-[#22c55e]' : 'border-[#1f2937] bg-[#05090a]'}`}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col border border-[#1b5a2b] bg-[#020402]/90 p-3 text-[10px] uppercase tracking-[0.15em] text-[#86efac]/80">
                        <div className="mb-2 border-b border-[#1b5a2b] pb-2 text-[#bbf7d0]">{t('matrix.core_status.telemetry')}</div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between"><span>{t('matrix.core_status.power')}</span><span>{safeIntegrityScore > 0 ? t('matrix.core_status.online') : t('matrix.core_status.offline')}</span></div>
                            <div className="flex items-center justify-between"><span>{t('matrix.core_status.load')}</span><span>{Math.round(safeDailyLimitPercent)}%</span></div>
                            <div className="flex items-center justify-between"><span>{t('matrix.core_status.trace')}</span><span>{state.code}</span></div>
                        </div>

                        <div className="mt-4 border border-[#14532d] bg-black/50 p-2 text-[9px] leading-relaxed text-[#4ade80]">
                            <div>&gt; {t('matrix.core_status.stream_watch')}</div>
                            <div>&gt; status::{state.label.toLowerCase()}</div>
                            <div>&gt; packet_sync::{Math.round(safeIntegrityScore * 1.7)}</div>
                        </div>

                        <div className="mt-auto border-t border-[#1b5a2b] pt-2 text-[#6ee7b7]/60">{t('matrix.core_status.frame_version')}</div>
                    </div>
                </div>
            </div>
        </Panel>
    );
}
