import { useMemo, useState } from 'react';
import Favicon from '@/ui-kit/Favicon.jsx';
import { Panel, UiButton, UiHeader, UiToggle } from '@/ui-kit';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';

function formatTime(ms, t) {
    const safe = Number.isFinite(ms) ? Math.max(0, ms) : 0;
    const h = Math.floor(safe / 3600000);
    const m = Math.floor((safe % 3600000) / 60000);
    return t('matrix.activity_graph.hours_minutes', { hours: h, minutes: m });
}

function formatMinutes(minutes, t) {
    const safe = Number.isFinite(minutes) ? Math.max(0, minutes) : 0;
    return t('matrix.activity_graph.minutes', { value: Math.round(safe) });
}

function formatHour(hour) {
    if (!Number.isFinite(hour)) return '--:--';
    return `${String(hour).padStart(2, '0')}:00`;
}

function buildSummary(graphData) {
    return (graphData || []).reduce(
        (acc, item) => {
            const total = Number(item?.total) || 0;
            const blocked = Number(item?.blocked) || 0;
            const allowed = Number(item?.allowed) || 0;
            const target = Number(item?.target) || 0;
            acc.total += total;
            acc.blocked += blocked;
            acc.allowed += allowed;
            acc.target += target;
            return acc;
        },
        { total: 0, blocked: 0, allowed: 0, target: 0 },
    );
}

export default function MatrixActivityGraph({
    graphData = [],
    axisLabels = [],
    virtualStartHour = 4,
    totalTrackedDuration = 0,
    totalBlockedDuration = 0,
    blockedSharePercent = 0,
    totalTargetDuration = 0,
    peakHour = null,
    lockedTarget = null,
    blockedList = [],
    isBlocked = false,
    onToggleBlock = () => {},
    onManageSites = () => {},
    targetStats = { active: 0 },
}) {
    const { t } = useAppTranslation('main');
    const [selectedHour, setSelectedHour] = useState(null);

    const selectedData = useMemo(() => {
        if (!Number.isFinite(selectedHour)) return null;
        return graphData.find((entry) => entry.hour === selectedHour) || null;
    }, [graphData, selectedHour]);

    const dailySummary = useMemo(() => buildSummary(graphData), [graphData]);

    const blockedRatioFromData = selectedData && selectedData.total > 0
        ? Math.round((selectedData.blocked / selectedData.total) * 100)
        : blockedSharePercent;

    const leftStats = selectedData
        ? {
            title: t('matrix.activity_graph.hour_title', { hour: formatHour(selectedData.hour) }),
            total: formatMinutes(selectedData.total, t),
            blocked: formatMinutes(selectedData.blocked, t),
            allowed: formatMinutes(selectedData.allowed, t),
            target: formatMinutes(selectedData.target, t),
            ratio: `${blockedRatioFromData}%`,
        }
        : {
            title: t('matrix.activity_graph.day_total'),
            total: formatTime(totalTrackedDuration, t),
            blocked: formatTime(totalBlockedDuration, t),
            allowed: formatTime(Math.max(0, totalTrackedDuration - totalBlockedDuration), t),
            target: formatTime(totalTargetDuration, t),
            ratio: `${blockedSharePercent}%`,
        };

    const maxValue = useMemo(() => {
        return graphData.reduce((acc, item) => Math.max(acc, Number(item?.total) || 0), 1);
    }, [graphData]);

    return (
        <Panel className="relative h-full w-full overflow-visible border border-[#14532d] bg-[#010602] p-4 font-mono">
            <div
                className="pointer-events-none absolute inset-0 opacity-20"
                style={{
                    background:
                        'repeating-linear-gradient(180deg, rgba(57,255,20,0.11) 0px, rgba(57,255,20,0.11) 1px, transparent 1px, transparent 4px)',
                }}
            />

            <div className="relative z-10 grid h-full min-h-0 grid-cols-[260px_minmax(0,1fr)] gap-4">
                <aside className="flex min-h-0 flex-col border border-[#1b5a2b] bg-[#031208]/80 p-3">
                    <div className="mb-2 flex items-center justify-between border-b border-[#14532d] pb-2 text-[10px] uppercase tracking-[0.2em] text-[#86efac]/75">
                        <span>{t('matrix.activity_graph.trace_deck')}</span>
                        <span>{t('matrix.activity_graph.version')}</span>
                    </div>

                    <div className="space-y-2">
                        <div className="text-[10px] uppercase tracking-[0.18em] text-[#6ee7b7]/70">{leftStats.title}</div>
                        <div className="text-3xl font-black text-[#39ff14]" style={{ textShadow: '0 0 12px rgba(57,255,20,0.55)' }}>
                            {leftStats.total}
                        </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 text-[10px]">
                        <div className="border border-[#14532d] bg-black/45 p-2">
                            <div className="uppercase tracking-[0.16em] text-[#86efac]/70">{t('matrix.activity_graph.blocked')}</div>
                            <div className="mt-1 text-sm text-[#ef4444]">{leftStats.blocked}</div>
                        </div>
                        <div className="border border-[#14532d] bg-black/45 p-2">
                            <div className="uppercase tracking-[0.16em] text-[#86efac]/70">{t('matrix.activity_graph.allowed')}</div>
                            <div className="mt-1 text-sm text-[#39ff14]">{leftStats.allowed}</div>
                        </div>
                        <div className="border border-[#14532d] bg-black/45 p-2">
                            <div className="uppercase tracking-[0.16em] text-[#86efac]/70">{t('matrix.activity_graph.target')}</div>
                            <div className="mt-1 text-sm text-[#22d3ee]">{leftStats.target}</div>
                        </div>
                        <div className="border border-[#14532d] bg-black/45 p-2">
                            <div className="uppercase tracking-[0.16em] text-[#86efac]/70">{t('matrix.activity_graph.ratio')}</div>
                            <div className="mt-1 text-sm text-[#facc15]">{leftStats.ratio}</div>
                        </div>
                    </div>

                    {lockedTarget ? (
                        <div className="mt-4 border border-[#14532d] bg-[#03120a]/80 p-3">
                            <div className="mb-2 flex items-center gap-2">
                                <Favicon domain={lockedTarget} size={20} className="border border-[#14532d] bg-black p-0.5" />
                                <div className="min-w-0 truncate text-[11px] text-[#bbf7d0]">{lockedTarget}</div>
                            </div>
                            <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.16em]">
                                <span className="text-[#86efac]/75">{t('matrix.activity_graph.protocol')}</span>
                                <span className={isBlocked ? 'text-[#ef4444]' : 'text-[#39ff14]'}>{isBlocked ? t('matrix.activity_graph.block') : t('matrix.activity_graph.observe')}</span>
                            </div>
                            <div className="mb-3">
                                <UiToggle checked={isBlocked} onChange={() => onToggleBlock(lockedTarget)} size="sm" />
                            </div>
                            <UiButton className="h-8 w-full border border-[#14532d] bg-black text-[10px] uppercase tracking-[0.14em] text-[#86efac]" onClick={() => onManageSites(lockedTarget)}>
                                {t('matrix.activity_graph.open_rule_console')}
                            </UiButton>
                        </div>
                    ) : (
                        <div className="mt-4 border border-[#14532d] bg-black/45 p-3 text-[10px] uppercase tracking-[0.16em] text-[#86efac]/65">
                            {t('matrix.activity_graph.select_target')}
                        </div>
                    )}

                    <div className="mt-auto border-t border-[#14532d] pt-2 text-[10px] uppercase tracking-[0.15em] text-[#86efac]/60">
                        {t('matrix.activity_graph.peak_active', { peak: formatHour(peakHour), active: formatTime(targetStats?.active || 0, t) })}
                    </div>
                </aside>

                <section className="flex min-h-0 flex-col border border-[#1b5a2b] bg-[#020a04]/70 p-3">
                    <div className="mb-3 flex items-start justify-between">
                        <div>
                            <UiHeader className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#86efac]">{t('matrix.activity_graph.temporal_histogram')}</UiHeader>
                            <div className="mt-1 text-[10px] uppercase tracking-[0.15em] text-[#6ee7b7]/70">{t('matrix.activity_graph.window_start', { hour: formatHour(virtualStartHour) })}</div>
                        </div>
                        <div className="text-right text-[10px] uppercase tracking-[0.15em] text-[#86efac]/70">
                            <div>{t('matrix.activity_graph.total_packets', { value: Math.round(dailySummary.total) })}</div>
                            <div>{t('matrix.activity_graph.blocked_packets', { value: Math.round(dailySummary.blocked) })}</div>
                        </div>
                    </div>

                    <div className="relative flex-1 min-h-0 border border-[#14532d] bg-black/40 p-3" onClick={() => setSelectedHour(null)}>
                        {[15, 30, 45, 60].map((minutesMark) => (
                            <div
                                key={`line-${minutesMark}`}
                                className="pointer-events-none absolute left-3 right-3 border-t border-[#14532d]/50"
                                style={{ bottom: `calc(${(minutesMark / 60) * 100}% - 12px)` }}
                            />
                        ))}

                        <div className="grid h-full grid-cols-24 gap-[2px]">
                            {graphData.map((entry) => {
                                const totalHeight = Math.max(3, ((Number(entry?.total) || 0) / maxValue) * 100);
                                const blockedHeight = (Number(entry?.blocked) || 0) / Math.max(1, Number(entry?.total) || 1) * totalHeight;
                                const allowedHeight = Math.max(0, totalHeight - blockedHeight);
                                const targetHeight = lockedTarget
                                    ? ((Number(entry?.target) || 0) / Math.max(1, Number(entry?.total) || 1)) * totalHeight
                                    : 0;
                                const isSelected = selectedHour === entry.hour;

                                return (
                                    <button
                                        key={entry.hour}
                                        type="button"
                                        className="group relative flex h-full flex-col justify-end outline-hidden"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            setSelectedHour((prev) => (prev === entry.hour ? null : entry.hour));
                                        }}
                                    >
                                        <div className="absolute inset-0 border border-transparent transition-colors group-hover:border-[#39ff14]/40" />
                                        {isSelected ? <div className="absolute inset-0 border border-[#39ff14] shadow-[0_0_10px_rgba(57,255,20,0.45)]" /> : null}

                                        <div
                                            className="w-full bg-[#14532d]/55 transition-opacity group-hover:opacity-95"
                                            style={{ height: `${allowedHeight}%` }}
                                        />
                                        <div
                                            className="w-full bg-[#ef4444]/70"
                                            style={{ height: `${blockedHeight}%` }}
                                        />
                                        {lockedTarget && targetHeight > 0 ? (
                                            <div
                                                className="pointer-events-none absolute inset-x-0 bottom-0 border border-[#22d3ee]/50 bg-[#22d3ee]/20"
                                                style={{
                                                    height: `${targetHeight}%`,
                                                    backgroundImage:
                                                        'repeating-linear-gradient(135deg, rgba(34,211,238,0.55) 0 2px, rgba(34,211,238,0.05) 2px 4px)',
                                                }}
                                            />
                                        ) : null}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="mt-2 flex justify-between text-[9px] uppercase tracking-[0.1em] text-[#86efac]/60">
                        {(axisLabels.length ? axisLabels : graphData.map((entry) => ({ label: String(entry.hour).padStart(2, '0') }))).map((item, index) => (
                            <span key={`axis-${index}`}>{item.label}</span>
                        ))}
                    </div>
                </section>
            </div>
        </Panel>
    );
}
