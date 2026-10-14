import React, { useMemo } from 'react';
import { Panel } from '@/ui-kit';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';

function resolveState(value, t) {
    if (value >= 80) {
        return {
            code: t('cyberpunk.core_status.codes.sync'),
            label: t('cyberpunk.core_status.states.stable'),
            accent: '#00f3ff',
            glow: '0 0 16px rgba(0,243,255,0.52)',
        };
    }
    if (value >= 50) {
        return {
            code: t('cyberpunk.core_status.codes.drift'),
            label: t('cyberpunk.core_status.states.drift'),
            accent: '#f59e0b',
            glow: '0 0 16px rgba(245,158,11,0.5)',
        };
    }
    return {
        code: t('cyberpunk.core_status.codes.breach'),
        label: t('cyberpunk.core_status.states.breach'),
        accent: '#ff2d72',
        glow: '0 0 18px rgba(255,45,114,0.58)',
    };
}

function clamp01(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.min(100, parsed));
}

export default function CyberpunkCoreStatus({ integrityScore = 100, dailyLimitPercent = 0 }) {
    const { t } = useAppTranslation('main');
    const safeIntegrity = clamp01(integrityScore);
    const safeLoad = clamp01(dailyLimitPercent);
    const state = useMemo(() => resolveState(safeIntegrity, t), [safeIntegrity, t]);

    const rings = useMemo(
        () => Array.from({ length: 5 }, (_, index) => index + 1),
        [],
    );

    return (
        <Panel className="relative h-full w-full overflow-hidden border border-[#0f2742] bg-[#030712] p-5 font-mono">
            <div
                className="pointer-events-none absolute inset-0 opacity-35"
                style={{
                    backgroundImage:
                        'linear-gradient(90deg, rgba(0,243,255,0.08) 1px, transparent 1px), linear-gradient(0deg, rgba(106,92,255,0.08) 1px, transparent 1px)',
                    backgroundSize: '14px 14px',
                }}
            />
            <div
                className="pointer-events-none absolute inset-0"
                style={{
                    background:
                        'radial-gradient(circle at 70% 16%, rgba(0,243,255,0.2), transparent 40%), radial-gradient(circle at 22% 84%, rgba(106,92,255,0.2), transparent 38%)',
                }}
            />

            <div className="relative z-10 flex h-full flex-col">
                <div className="mb-4 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-[#9bdaf8]/80">
                    <span>{t('cyberpunk.core_status.kernel')}</span>
                    <span>{t('cyberpunk.core_status.node')}</span>
                </div>

                <div className="grid flex-1 min-h-0 grid-cols-[minmax(0,1fr)_148px] gap-4">
                    <div className="relative flex min-h-0 flex-col border border-[#164164] bg-[#040b19]/85 p-4">
                        <div className="text-[10px] uppercase tracking-[0.18em] text-[#8bb6d9]">{t('cyberpunk.core_status.integrity')}</div>
                        <div className="mt-2 flex items-end gap-2">
                            <div
                                className="text-6xl font-black leading-none tabular-nums"
                                style={{ color: state.accent, textShadow: state.glow }}
                            >
                                {Math.round(safeIntegrity)}
                            </div>
                            <div className="pb-2 text-sm tracking-[0.2em] text-[#7aa6c8]">%</div>
                        </div>

                        <div className="mt-3 inline-flex w-fit items-center gap-2 border border-[#1f4f75] bg-black/25 px-2 py-1 text-[10px] uppercase tracking-[0.18em]">
                            <span style={{ color: state.accent }}>{state.code}</span>
                            <span className="text-[#7aa6c8]">{state.label}</span>
                        </div>

                        <div className="relative mt-5 flex-1 min-h-0">
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div
                                    className="relative flex h-40 w-40 items-center justify-center rounded-full border border-[#1c4668] bg-[#02050f]/90"
                                    style={{ boxShadow: state.glow }}
                                >
                                    {rings.map((ring) => (
                                        <div
                                            key={`ring-${ring}`}
                                            className="absolute rounded-full border border-[#1d3e60]/70"
                                            style={{
                                                width: `${ring * 28 + 18}px`,
                                                height: `${ring * 28 + 18}px`,
                                                opacity: 0.55 - ring * 0.08,
                                            }}
                                        />
                                    ))}
                                    <div className="text-center">
                                        <div className="text-[11px] uppercase tracking-[0.22em] text-[#9bc9ea]">{t('cyberpunk.core_status.load')}</div>
                                        <div className="mt-1 text-2xl font-black tabular-nums" style={{ color: state.accent }}>
                                            {Math.round(safeLoad)}%
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <aside className="flex min-h-0 flex-col border border-[#184260] bg-[#020913]/90 p-3 text-[10px] uppercase tracking-[0.16em] text-[#9bc8e8]/80">
                        <div className="mb-2 border-b border-[#1c4568] pb-2 text-[#c7e7ff]">{t('cyberpunk.core_status.telemetry')}</div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between"><span>{t('cyberpunk.core_status.power')}</span><span>{safeIntegrity > 0 ? t('cyberpunk.core_status.online') : t('cyberpunk.core_status.offline')}</span></div>
                            <div className="flex items-center justify-between"><span>{t('cyberpunk.core_status.load')}</span><span>{Math.round(safeLoad)}%</span></div>
                            <div className="flex items-center justify-between"><span>{t('cyberpunk.core_status.trace')}</span><span>{state.code}</span></div>
                        </div>

                        <div className="mt-4 rounded border border-[#1e496d] bg-black/50 p-2 text-[9px] leading-relaxed text-[#7fd6ff]">
                            <div>&gt; {t('cyberpunk.core_status.link_observe')}</div>
                            <div>&gt; {t('cyberpunk.core_status.pulse', { value: Math.round(safeIntegrity * 2.1) })}</div>
                            <div>&gt; {t('cyberpunk.core_status.jitter', { value: Math.round((100 - safeIntegrity) * 1.7) })}</div>
                        </div>

                        <div className="mt-auto border-t border-[#1c4568] pt-2 text-[#78a7cb]/80">{t('cyberpunk.core_status.frame')}</div>
                    </aside>
                </div>
            </div>
        </Panel>
    );
}
