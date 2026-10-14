import { useMemo, useState } from 'react';
import Favicon from '@/ui-kit/Favicon.jsx';
import { Panel, UiButton, UiHeader, UiToggle } from '@/ui-kit';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';

function formatTime(ms, t) {
    const safe = Number.isFinite(ms) ? Math.max(0, ms) : 0;
    const hours = Math.floor(safe / 3600000);
    const minutes = Math.floor((safe % 3600000) / 60000);
    return t('cyberpunk.activity_graph.hours_minutes', { hours, minutes });
}

function formatMinutes(minutes, t) {
    const safe = Number.isFinite(minutes) ? Math.max(0, minutes) : 0;
    return t('cyberpunk.activity_graph.minutes', { value: Math.round(safe) });
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

export default function CyberpunkActivityGraph({
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

    const summary = useMemo(() => buildSummary(graphData), [graphData]);

    const ratio = selectedData
        ? (selectedData.total > 0 ? Math.round((selectedData.blocked / selectedData.total) * 100) : 0)
        : blockedSharePercent;

    const leftStats = selectedData
        ? {
            title: t('cyberpunk.activity_graph.node_hour', { hour: formatHour(selectedData.hour) }),
            total: formatMinutes(selectedData.total, t),
            blocked: formatMinutes(selectedData.blocked, t),
            allowed: formatMinutes(selectedData.allowed, t),
            target: formatMinutes(selectedData.target, t),
            ratio: `${ratio}%`,
        }
        : {
            title: t('cyberpunk.activity_graph.day_matrix'),
            total: formatTime(totalTrackedDuration, t),
            blocked: formatTime(totalBlockedDuration, t),
            allowed: formatTime(Math.max(0, totalTrackedDuration - totalBlockedDuration), t),
            target: formatTime(totalTargetDuration, t),
            ratio: `${blockedSharePercent}%`,
        };

    const maxValue = useMemo(
        () => graphData.reduce((acc, item) => Math.max(acc, Number(item?.total) || 0), 1),
        [graphData],
    );

    return (
        <Panel className="relative h-full w-full overflow-visible border border-[#123759] bg-[#020713] p-4 font-mono">
            <div
                className="pointer-events-none absolute inset-0 opacity-20"
                style={{
                    backgroundImage:
                        'linear-gradient(90deg, rgba(0,243,255,0.1) 1px, transparent 1px), linear-gradient(0deg, rgba(106,92,255,0.1) 1px, transparent 1px)',
                    backgroundSize: '16px 16px',
                }}
            />
            <div
                className="pointer-events-none absolute inset-0 opacity-30"
                style={{
                    background:
                        'radial-gradient(circle at 20% 85%, rgba(106,92,255,0.2), transparent 35%), radial-gradient(circle at 85% 18%, rgba(0,243,255,0.2), transparent 38%)',
                }}
            />

            <div className="relative z-10 grid h-full min-h-0 grid-cols-[260px_minmax(0,1fr)] gap-4">
                <aside className="flex min-h-0 flex-col border border-[#19466b] bg-[#030d1d]/85 p-3">
                    <div className="mb-2 flex items-center justify-between border-b border-[#1f4d76] pb-2 text-[10px] uppercase tracking-[0.2em] text-[#9ac8ea]/85">
                        <span>{t('cyberpunk.activity_graph.trace_deck')}</span>
                        <span>{t('cyberpunk.activity_graph.version')}</span>
                    </div>

                    <div className="space-y-2">
                        <div className="text-[10px] uppercase tracking-[0.18em] text-[#86b4d6]">{leftStats.title}</div>
                        <div className="text-3xl font-black text-[#00f3ff]" style={{ textShadow: '0 0 12px rgba(0,243,255,0.55)' }}>
                            {leftStats.total}
                        </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 text-[10px]">
                        <div className="border border-[#1f4b72] bg-[#040f1f]/70 p-2">
                            <div className="uppercase tracking-[0.16em] text-[#86b4d6]">{t('cyberpunk.activity_graph.blocked')}</div>
                            <div className="mt-1 text-sm text-[#ff2d72]">{leftStats.blocked}</div>
                        </div>
                        <div className="border border-[#1f4b72] bg-[#040f1f]/70 p-2">
                            <div className="uppercase tracking-[0.16em] text-[#86b4d6]">{t('cyberpunk.activity_graph.allowed')}</div>
                            <div className="mt-1 text-sm text-[#00f3ff]">{leftStats.allowed}</div>
                        </div>
                        <div className="border border-[#1f4b72] bg-[#040f1f]/70 p-2">
                            <div className="uppercase tracking-[0.16em] text-[#86b4d6]">{t('cyberpunk.activity_graph.target')}</div>
                            <div className="mt-1 text-sm text-[#a78bfa]">{leftStats.target}</div>
                        </div>
                        <div className="border border-[#1f4b72] bg-[#040f1f]/70 p-2">
                            <div className="uppercase tracking-[0.16em] text-[#86b4d6]">{t('cyberpunk.activity_graph.ratio')}</div>
                            <div className="mt-1 text-sm text-[#f59e0b]">{leftStats.ratio}</div>
                        </div>
                    </div>

                    {lockedTarget ? (
                        <div className="mt-4 border border-[#1f4b72] bg-[#040f1f]/85 p-3">
                            <div className="mb-2 flex items-center gap-2">
                                <Favicon domain={lockedTarget} size={20} className="border border-[#1f4b72] bg-black p-0.5" />
                                <div className="min-w-0 truncate text-[11px] text-[#c9e8ff]">{lockedTarget}</div>
                            </div>
                            <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.16em]">
                                <span className="text-[#8cbad9]">{t('cyberpunk.activity_graph.protocol')}</span>
                                <span className={isBlocked ? 'text-[#ff2d72]' : 'text-[#00f3ff]'}>{isBlocked ? t('cyberpunk.activity_graph.block') : t('cyberpunk.activity_graph.watch')}</span>
                            </div>
                            <div className="mb-3">
                                <UiToggle checked={isBlocked} onChange={() => onToggleBlock(lockedTarget)} size="sm" />
                            </div>
                            <UiButton
                                className="h-8 w-full border border-[#1f4b72] bg-[#021124] text-[10px] uppercase tracking-[0.14em] text-[#9fd8ff]"
                                onClick={() => onManageSites(lockedTarget)}
                            >
                                {t('cyberpunk.activity_graph.open_ice_console')}
                            </UiButton>
                        </div>
                    ) : (
                        <div className="mt-4 border border-[#1f4b72] bg-[#040f1f]/70 p-3 text-[10px] uppercase tracking-[0.16em] text-[#8cbad9]/80">
                            {t('cyberpunk.activity_graph.select_target')}
                        </div>
                    )}

                    <div className="mt-auto border-t border-[#1f4d76] pt-2 text-[10px] uppercase tracking-[0.15em] text-[#86b4d6]">
                        {t('cyberpunk.activity_graph.peak_active', { peak: formatHour(peakHour), active: formatTime(targetStats?.active || 0, t) })}
                    </div>
                </aside>

                <section className="flex min-h-0 flex-col border border-[#1b486c] bg-[#020c1a]/80 p-3">
                    <div className="mb-3 flex items-start justify-between">
                        <div>
                            <UiHeader className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#9fd8ff]">
                                {t('cyberpunk.activity_graph.temporal_neon_histogram')}
                            </UiHeader>
                            <div className="mt-1 text-[10px] uppercase tracking-[0.15em] text-[#8cbad9]">
                                {t('cyberpunk.activity_graph.window_start', { hour: formatHour(virtualStartHour) })}
                            </div>
                        </div>
                        <div className="text-right text-[10px] uppercase tracking-[0.15em] text-[#8cbad9]">
                            <div>{t('cyberpunk.activity_graph.total_packets', { value: Math.round(summary.total) })}</div>
                            <div>{t('cyberpunk.activity_graph.blocked_packets', { value: Math.round(summary.blocked) })}</div>
                        </div>
                    </div>

                    <div className="relative flex-1 min-h-0 border border-[#1f4b72] bg-[#020814]/70 p-3" onClick={() => setSelectedHour(null)}>
                        {[15, 30, 45, 60].map((mark) => (
                            <div
                                key={`line-${mark}`}
                                className="pointer-events-none absolute left-3 right-3 border-t border-[#1f4b72]/55"
                                style={{ bottom: `calc(${(mark / 60) * 100}% - 12px)` }}
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
                                        <div className="absolute inset-0 border border-transparent transition-colors group-hover:border-[#00f3ff]/45" />
                                        {isSelected ? <div className="absolute inset-0 border border-[#00f3ff] shadow-[0_0_10px_rgba(0,243,255,0.45)]" /> : null}

                                        <div
                                            className="w-full bg-[#0ea5e9]/45 transition-opacity group-hover:opacity-95"
                                            style={{ height: `${allowedHeight}%` }}
                                        />
                                        <div
                                            className="w-full bg-[#ff2d72]/70"
                                            style={{ height: `${blockedHeight}%` }}
                                        />
                                        {lockedTarget && targetHeight > 0 ? (
                                            <div
                                                className="pointer-events-none absolute inset-x-0 bottom-0 border border-[#a78bfa]/60 bg-[#a78bfa]/20"
                                                style={{
                                                    height: `${targetHeight}%`,
                                                    backgroundImage:
                                                        'repeating-linear-gradient(135deg, rgba(167,139,250,0.52) 0 2px, rgba(167,139,250,0.05) 2px 4px)',
                                                }}
                                            />
                                        ) : null}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="mt-2 flex justify-between text-[9px] uppercase tracking-[0.1em] text-[#88b5d7]">
                        {(axisLabels.length ? axisLabels : graphData.map((entry) => ({ label: String(entry.hour).padStart(2, '0') }))).map((item, index) => (
                            <span key={`axis-${index}`}>{item.label}</span>
                        ))}
                    </div>
                </section>
            </div>
        </Panel>
    );
}
