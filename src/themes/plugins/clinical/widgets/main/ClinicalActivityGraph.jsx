import { useCallback, useMemo, useState } from 'react';
import Favicon from '@/ui-kit/Favicon.jsx';
import { Panel, UiHeader, UiButton, UiToggle } from '@/ui-kit';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';

/**
 * ClinicalActivityGraph
 * ...
 */
export default function ClinicalActivityGraph({
    // Processed data from parent
    graphData = [],
    axisLabels = [],
    virtualStartHour = 4,

    // Summary metrics
    totalTrackedDuration = 0,
    totalBlockedDuration = 0,
    blockedSharePercent = 0,
    totalTargetDuration = 0,
    peakHour = null,

    // Context
    lockedTarget = null,
    blockedList = [],

    // Inspector Actions
    isBlocked = false,
    onToggleBlock = () => { },
    onManageSites = () => { },
    targetStats = { active: 0 }
}) {
    const { t } = useAppTranslation('main');
    const [selectedHour, setSelectedHour] = useState(null);

    const formatTime = (ms) => {
        const h = Math.floor(ms / 3600000);
        const m = Math.floor((ms % 3600000) / 60000);
        return t('clinical.activity_graph.hours_minutes', { hours: h, minutes: m });
    };

    const formatMinutes = (minutes) => t('clinical.activity_graph.minutes', { value: Math.round(minutes) });
    const formatHour = (hour) => `${String(hour).padStart(2, '0')}:00`;
    const formatHourLabel = (h) => `${String(h).padStart(2, '0')}:00`;

    const selectedData = useMemo(() => {
        if (selectedHour === null || selectedHour === undefined) return null;
        return graphData.find((d) => d.hour === selectedHour) || null;
    }, [graphData, selectedHour]);

    const selectedBlockedSharePercent = selectedData && selectedData.total > 0
        ? Math.round((selectedData.blocked / selectedData.total) * 100)
        : 0;

    const handleSelectHour = useCallback((hour) => {
        setSelectedHour((prev) => (prev === hour ? null : hour));
    }, []);

    const SiteInspector = () => (
        <div className="h-full flex flex-col pt-2 relative group/inspector">
            {/* Decorative Stamp */}
            <div className="absolute top-0 right-0 border border-danger/30 px-2 py-0.5 rounded text-danger/30 font-black text-[8px] -rotate-12 select-none pointer-events-none group-hover/inspector:border-danger/60 group-hover/inspector:text-danger/60 transition-colors uppercase">
                {t('clinical.activity_graph.clinical_eye')}
            </div>

            <div className="flex items-center gap-3 mb-4">
                <div className="p-1 bg-white rounded shadow-sm border border-border/10 shrink-0">
                    <Favicon domain={lockedTarget} size={32} />
                </div>
                <div className="min-w-0">
                    <UiHeader variant="label" className="text-on-surface-muted/40 mb-0.5 text-[9px]">{t('clinical.activity_graph.subject_id')}</UiHeader>
                    <div className="text-sm font-black text-on-surface truncate leading-tight uppercase tracking-tight">
                        {lockedTarget}
                    </div>
                </div>
            </div>

            <div className="flex-1 space-y-4">
                <div className="border-t border-on-surface/5 pt-3">
                    <div className="text-[9px] font-black text-on-surface-muted/60 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <span className="w-1 h-1 rounded-full bg-accent" />
                        {t('clinical.activity_graph.clinical_summary')}
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="p-2 bg-surface-elevated/50 rounded border border-border/20">
                            <div className="text-[8px] font-bold text-on-surface-muted/50 uppercase mb-0.5">{t('clinical.activity_graph.active_load')}</div>
                            <div className="text-xs font-black text-on-surface">{formatTime(targetStats?.active || 0)}</div>
                        </div>
                        <div className="p-2 bg-surface-elevated/50 rounded border border-border/20">
                            <div className="text-[8px] font-bold text-on-surface-muted/50 uppercase mb-0.5">{t('clinical.activity_graph.protocol')}</div>
                            <div className={`text-[9px] font-black ${isBlocked ? 'text-danger' : 'text-success'} uppercase`}>
                                {isBlocked ? t('clinical.activity_graph.isolation') : t('clinical.activity_graph.observe')}
                            </div>
                        </div>
                    </div>

                    <p className="text-[10px] leading-relaxed text-on-surface/60 font-medium">
                        {t('clinical.activity_graph.target_eval_hint')}
                    </p>
                </div>
            </div>

            <div className="mt-auto space-y-2 pt-3 border-t border-on-surface/5">
                <div className="flex items-center justify-between p-2 rounded hover:bg-on-surface/5 transition-colors cursor-pointer border border-transparent hover:border-on-surface/10" onClick={() => onToggleBlock(lockedTarget)}>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black text-on-surface uppercase tracking-tight">{t('clinical.activity_graph.confinement')}</span>
                        <span className="text-[8px] text-on-surface-muted">{t('clinical.activity_graph.biometric_block')}</span>
                    </div>
                    <UiToggle
                        checked={isBlocked}
                        onChange={() => onToggleBlock(lockedTarget)}
                        size="sm"
                    />
                </div>

                <UiButton
                    className="w-full h-8 text-[10px]"
                    onClick={() => onManageSites(lockedTarget)}
                >
                    {t('clinical.activity_graph.full_diagnostics')}
                </UiButton>
            </div>
        </div>
    );

    return (
        <Panel className="w-full h-full flex flex-row gap-6 relative border border-border/60 bg-surface-elevated/30 p-4 overflow-visible">
            {/* LEFT: Summary / Selection */}
            <div className="w-[220px] flex flex-col justify-between shrink-0 border-r border-border pr-6 py-2 transition-all duration-300">
                {selectedData ? (
                    // 1. Hourly Detail View
                    <div className="h-full flex flex-col">
                        <div className="mb-6">
                            <UiHeader variant="label" className="text-on-surface-muted mb-2">{t('clinical.activity_graph.hour_summary')}</UiHeader>
                            <div className="text-3xl font-black text-on-surface">
                                {formatHour(selectedData.hour)}
                            </div>
                        </div>

                        <div className="space-y-4 mt-auto mb-auto">
                            <div>
                                <UiHeader variant="label" className="text-on-surface-muted mb-1">{t('clinical.activity_graph.total')}</UiHeader>
                                <div className="text-xl font-bold text-on-surface">{formatMinutes(selectedData.total)} <span className="text-xs opacity-50">{t('clinical.activity_graph.per_60_minutes')}</span></div>
                            </div>
                            <div>
                                <UiHeader variant="label" className="text-warning/80 mb-1">{t('clinical.activity_graph.blocked')}</UiHeader>
                                <div className="text-xl font-bold text-warning">{formatMinutes(selectedData.blocked)} <span className="text-xs opacity-50">{selectedBlockedSharePercent}%</span></div>
                            </div>
                            <div>
                                <UiHeader variant="label" className="text-on-surface-muted mb-1">{t('clinical.activity_graph.allowed')}</UiHeader>
                                <div className="text-xl font-bold text-on-surface">{formatMinutes(selectedData.allowed)}</div>
                            </div>
                            {lockedTarget && (
                                <div>
                                    <UiHeader variant="label" className="text-primary/80 mb-1">{t('clinical.activity_graph.target')}</UiHeader>
                                    <div className="text-xl font-bold text-primary">
                                        {formatMinutes(selectedData.target)}{' '}
                                        <span className={`text-xs ${blockedList.includes(lockedTarget) ? 'text-danger' : 'text-on-surface-muted'} opacity-80`}>
                                            {blockedList.includes(lockedTarget) ? t('clinical.activity_graph.blocked') : t('clinical.activity_graph.allowed')}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <button
                            type="button"
                            className="mt-auto text-[10px] font-mono tracking-widest text-on-surface-muted hover:text-on-surface transition-colors"
                            onClick={() => setSelectedHour(null)}
                        >
                            {t('clinical.activity_graph.clear_selection')}
                        </button>
                    </div>
                ) : (
                    // 2. Global View or Inspector
                    lockedTarget ? <SiteInspector /> : (
                        <div className="h-full flex flex-col justify-between animate-in fade-in duration-200">
                            <div>
                                <UiHeader variant="label" className="text-on-surface-muted mb-1">{t('clinical.activity_graph.daily_summary')}</UiHeader>
                                <div className="text-3xl font-black text-on-surface">{formatTime(totalTrackedDuration)}</div>
                                <UiHeader variant="label" className="text-on-surface-muted mt-1">{t('clinical.activity_graph.total_active')}</UiHeader>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <UiHeader variant="label" className="text-warning/80 mb-1">{t('clinical.activity_graph.blocked')}</UiHeader>
                                    <div className="text-xl font-bold text-on-surface">{formatTime(totalBlockedDuration)}</div>
                                </div>
                                <div>
                                    <UiHeader variant="label" className="text-on-surface-muted mb-1">{t('clinical.activity_graph.blocked_ratio')}</UiHeader>
                                    <div className="text-xl font-bold text-on-surface">{blockedSharePercent}%</div>
                                </div>
                                {lockedTarget ? (
                                    <div>
                                        <UiHeader variant="label" className="text-primary/80 mb-1">{t('clinical.activity_graph.target')}</UiHeader>
                                        <div className="text-xl font-bold text-primary">
                                            {formatTime(totalTargetDuration)}{' '}
                                            <span className={`text-xs ${blockedList.includes(lockedTarget) ? 'text-danger' : 'text-on-surface-muted'} opacity-80`}>
                                                {blockedList.includes(lockedTarget) ? t('clinical.activity_graph.blocked') : t('clinical.activity_graph.allowed')}
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <UiHeader variant="label" className="text-on-surface-muted mb-1">{t('clinical.activity_graph.peak_blocked_hour')}</UiHeader>
                                        <div className="text-xl font-bold text-on-surface">{peakHour !== null ? formatHour(peakHour) : '--:--'}</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                )}
            </div>

            {/* RIGHT: 24H Stacked Bar Chart */}
            <div className="flex-1 min-w-0 min-h-0 flex flex-col relative">
                <div className="flex items-start justify-between">
                    <div>
                        <UiHeader variant="label" className="text-on-surface-muted/60">
                            {t('clinical.activity_graph.hourly_minutes')}
                        </UiHeader>
                        <div className="mt-2 flex items-center gap-3 text-[10px] font-mono text-on-surface-muted/50">
                            <div className="flex items-center gap-1">
                                <span className="w-2 h-2 bg-on-surface/20" />
                                <span>{t('clinical.activity_graph.total')}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="w-2 h-2 bg-warning/60" />
                                <span>{t('clinical.activity_graph.blocked')}</span>
                            </div>
                            {lockedTarget && (
                                <div className="flex items-center gap-1">
                                    <span
                                        className="w-2 h-2 bg-primary opacity-25 border border-primary opacity-80"
                                        style={{ backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.25) 0 2px, rgba(255,255,255,0) 2px 4px)' }}
                                    />
                                    <span>{t('clinical.activity_graph.target')}</span>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="text-[10px] font-mono text-on-surface-muted/30">
                        {t('clinical.activity_graph.start', { hour: formatHourLabel(virtualStartHour) })}
                    </div>
                </div>

                {/* Graph Container */}
                <div
                    className="flex-1 mt-4 relative flex min-h-0"
                    onClick={() => setSelectedHour(null)}
                >
                    {/* Y-axis gutter */}
                    <div className="w-10 shrink-0 relative h-full">
                        {[60, 45, 30, 15].map((minutesMark) => (
                            <div
                                key={minutesMark}
                                className="absolute left-0 right-0 text-[9px] font-mono text-on-surface-muted/30"
                                style={{ bottom: `${(minutesMark / 60) * 100}%` }}
                            >
                                <span className="absolute -top-2 right-1">{minutesMark}m</span>
                            </div>
                        ))}
                    </div>

                    {/* Bars + grid */}
                    <div className="flex-1 grid grid-cols-24 gap-[1px] md:gap-[2px] relative min-h-0">
                        {/* Grid Lines (Minutes) */}
                        {[15, 30, 45, 60].map((minutesMark) => (
                            <div
                                key={minutesMark}
                                className="absolute left-0 right-0 border-t border-border pointer-events-none"
                                style={{ bottom: `${(minutesMark / 60) * 100}%` }}
                            />
                        ))}

                        {graphData.map((d) => (
                            <div
                                key={d.hour}
                                className="h-full flex flex-col justify-end group relative cursor-pointer hover:bg-on-surface/5 transition-colors"
                                onClick={(e) => { e.stopPropagation(); handleSelectHour(d.hour); }}
                            >
                                {/* Selected outline */}
                                <div
                                    className={[
                                        'absolute inset-0 pointer-events-none opacity-0 transition-opacity',
                                        selectedHour === d.hour ? 'opacity-100' : '',
                                    ].join(' ')}
                                    style={{ boxShadow: `inset 0 0 0 1px var(--terminal-primary), 0 0 12px var(--terminal-glow)` }}
                                />

                                {/* Base bar: Total = Allowed + Blocked */}
                                <div className="absolute inset-x-0 bottom-0 h-full flex flex-col justify-end">
                                    <div
                                        className="w-full bg-on-surface opacity-15 transition-opacity group-hover:opacity-25"
                                        style={{ height: `${(d.allowed / 60) * 100}%` }}
                                    />
                                    <div
                                        className="w-full bg-warning opacity-60"
                                        style={{ height: `${(d.blocked / 60) * 100}%` }}
                                    />
                                </div>

                                {/* Target overlay: subset of Total (patterned) */}
                                {lockedTarget && d.target > 0 && (
                                    <div
                                        className={`absolute inset-x-0 bottom-0 z-10 pointer-events-none bg-primary opacity-25 border border-primary/30 ${blockedList.includes(lockedTarget) ? 'shadow-[0_0_10px_var(--color-danger)] border-danger' : 'shadow-[0_0_8px_var(--color-primary)]'}`}
                                        style={{
                                            height: `${(d.target / 60) * 100}%`,
                                            backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.22) 0 2px, rgba(255,255,255,0) 2px 4px)'
                                        }}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* X-Axis Main Labels */}
                <div className="flex justify-between mt-1 text-[10px] text-on-surface-muted/30 font-mono">
                    {axisLabels.map((l, i) => (
                        <span key={i}>{l.label}</span>
                    ))}
                </div>
            </div>
        </Panel>
    );
}
