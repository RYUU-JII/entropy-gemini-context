import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation';
import { useDocumentVisibility } from '@/ui-kit/hooks/useDocumentVisibility.js';
import { useElementVisibility } from '@/ui-kit/hooks/useElementVisibility.js';
import { useZenStamp } from './hooks/useZenStamp';
import Favicon from '@/ui-kit/Favicon.jsx';

// --- Constants & Helpers ---
const formatTime = (ms, t) => {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    if (!t) return h === 0 ? `${m}M` : `${h}H ${m}M`;

    if (h === 0) return `${m}${t('units.minute_abbr')}`;
    return `${h}${t('units.hour_abbr')} ${m}${t('units.minute_abbr')}`;
};

const formatMinutes = (minutes, t) => {
    const val = Math.round(minutes);
    if (!t) return `${val}m`;
    return `${val}${t('units.minute_short')}`;
};
const formatHour = (hour) => `${String(hour).padStart(2, '0')}:00`;
const resolveText = (t, key, options = {}, fallback = '') => {
    if (!t) return fallback;
    const value = t(key, options);
    if (typeof value === 'string' && value && value !== key) return value;
    return fallback;
};

const STYLES = `
    @keyframes float {
        0%, 100% { transform: translateY(0px) scale(1); opacity: 0.8; }
        50% { transform: translateY(-3px) scale(1.1); opacity: 1; }
    }
    @keyframes pulse-lichen {
        0%, 100% { opacity: 0.85; filter: contrast(1) brightness(1); }
        50% { opacity: 1; filter: contrast(1.2) brightness(0.9); }
    }
    .stone-texture {
        background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='1' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.15'/%3E%3C/svg%3E");
    }
    .lichen-growth {
        background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.2' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.5'/%3E%3C/svg%3E");
        background-size: 64px 64px;
        mask-image: linear-gradient(to bottom, transparent 0%, black 20%);
        -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 20%);
    }
    .inner-shadow {
        box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.06);
    }
`;

// --- Sub-components ---

const SiteInspector = React.memo(({ lockedTarget, isBlocked, onToggleBlock, targetStats, colors, labels, t }) => {
    const { progress, isHolding, showWiggle, bind } = useZenStamp(() => onToggleBlock(lockedTarget), 700);

    return (
        <div className="h-full w-full flex flex-col p-2 relative group">
            <div className="relative flex items-center gap-3 pb-4 border-b border-dashed" style={{ borderColor: `${colors.stone}60` }}>
                <div className="flex items-center justify-center rounded-xl shadow-sm shrink-0 overflow-hidden" style={{ backgroundColor: '#FFF', border: `1px solid ${colors.stone}`, width: 40, height: 40 }}>
                    <Favicon domain={lockedTarget} size={28} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-[9px] font-bold uppercase tracking-[0.18em] opacity-45 font-sans" style={{ color: colors.stoneDark }}>
                        {resolveText(t, 'target_protocol.site_overview', {}, resolveText(t, 'target_protocol.daily_overview', {}, '일일 개요'))}
                    </div>
                    <h1 className="text-[14px] font-bold leading-tight break-all line-clamp-1 font-sans" style={{ color: colors.stoneDark, letterSpacing: '-0.02em' }}>{lockedTarget}</h1>
                    <div className="flex items-center gap-1.5 mt-1">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isBlocked ? colors.cinnabar : colors.forest }} />
                        <span className="text-[10px] font-bold uppercase tracking-wider font-sans" style={{ color: isBlocked ? colors.cinnabar : colors.forest }}>
                            {isBlocked ? t('target_protocol.status_blocked_zen') : t('target_protocol.vital_stream')}
                        </span>
                    </div>
                </div>
                <div
                    {...bind}
                    className={`
                        w-12 h-12 border-2 rounded-lg shrink-0 flex flex-col items-center justify-center text-[16px] select-none cursor-pointer relative overflow-hidden transition-all duration-500 ease-spring
                        ${isHolding ? 'scale-110 -translate-y-1 rotate-6' : 'group-hover:scale-105 group-hover:-translate-y-0.5 group-hover:rotate-3'}
                        ${showWiggle ? 'animate-shake' : ''}
                    `}
                    style={{
                        borderColor: isBlocked ? colors.cinnabar : colors.forest,
                        color: isBlocked ? colors.cinnabar : colors.forest,
                        fontFamily: 'var(--font-theme-heading)',
                    }}
                >
                    {/* Ink Fill Background */}
                    <div
                        className="absolute inset-0 opacity-20 pointer-events-none"
                        style={{
                            backgroundColor: isBlocked ? colors.cinnabar : colors.forest,
                            transform: `translateY(${100 - (progress * 100)}%)`,
                            transition: isHolding ? 'none' : 'transform 0.3s ease-out'
                        }}
                    />

                    <span className="relative z-10 leading-none mb-0.5">{isBlocked ? '封' : '解'}</span>

                    {/* Hover Hint */}
                    <span className={`text-[8px] font-bold uppercase tracking-tighter transition-opacity duration-300 font-sans ${isHolding ? 'opacity-0' : 'group-hover:opacity-60 opacity-0'}`}>
                        {t('target_protocol.press_hint')}
                    </span>
                </div>
            </div>
            <div className="flex-1 flex flex-col justify-center py-6 relative">
                <div className="text-center space-y-1">
                    <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40 font-sans" style={{ color: colors.stoneDark }}>{t('target_protocol.current_flow')}</h2>
                    <div className="text-2xl font-heading font-light tracking-tighter" style={{ color: colors.stoneDark }}>{formatTime(targetStats?.active || 0, t)}</div>
                </div>
                <div className="mx-auto w-1/2 mt-4 h-1.5 bg-black/5 rounded-full overflow-hidden">
                    <div className="h-full transition-all duration-1000" style={{ width: `${Math.min(100, ((targetStats?.active || 0) / 3600000) * 100)}%`, backgroundColor: colors.gold }} />
                </div>
            </div>
            <div className="mt-auto pt-2">
                <button className="w-full flex items-center justify-between p-4 rounded-xl transition-all duration-300 group overflow-hidden relative cursor-pointer hover:bg-black/5 font-sans" style={{ backgroundColor: 'rgba(0,0,0,0.02)', border: `1px solid ${colors.stone}60` }} onClick={() => onToggleBlock(lockedTarget)}>
                    <div className="flex flex-col items-start relative z-10">
                        <span className="text-[12px] font-bold" style={{ color: colors.stoneDark }}>
                            {isBlocked ? t('target_protocol.restore_flow') : t('target_protocol.sever_signal')}
                        </span>
                    </div>
                    <div className="relative w-12 h-6 rounded-full bg-black/5 p-1 transition-shadow inner-shadow">
                        <div className="absolute top-1 bottom-1 w-4 rounded-full shadow-md transition-all duration-500 ease-in-out" style={{ left: isBlocked ? 'calc(100% - 20px)' : '4px', backgroundColor: isBlocked ? colors.cinnabar : colors.stone, boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.4)' }} />
                    </div>
                </button>
            </div>
        </div>
    );
});

const HourInspector = React.memo(({ selectedData, lockedTarget, colors, onLockTarget, onClearSelection, t }) => {
    if (!selectedData) return null;

    let domains = selectedData.domains?.length > 0 ? selectedData.domains : [];

    // Top 3 Domains
    domains = domains.slice(0, 3);

    return (
        <div className="h-full w-full flex flex-col justify-between py-2 animate-in fade-in duration-300 font-sans">
            <div className="flex flex-col mb-4 shrink-0">
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-50 font-sans" style={{ color: colors.stoneDark }}>
                            {t('target_protocol.hour_record')}
                        </div>
                        <div className="text-3xl font-heading font-light mt-1" style={{ color: colors.stoneDark }}>
                            {formatHour(selectedData.hour)}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClearSelection}
                        className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors hover:bg-black/10"
                        style={{ color: colors.earth, border: `1px solid ${colors.stone}90` }}
                    >
                        {resolveText(t, 'target_protocol.clear_selection', {}, resolveText(t, 'common:action.close', {}, '선택 해제'))}
                    </button>
                </div>
                <div className="flex gap-4 mt-4">
                    <div className="flex flex-col">
                        <span className="text-[9px] uppercase tracking-wider font-bold opacity-60" style={{ color: colors.stoneDark }}>{t('target_protocol.total_density')}</span>
                        <span className="text-base font-heading font-black mt-0.5" style={{ color: colors.earth }}>{formatMinutes(selectedData.total, t)}</span>
                    </div>
                    {selectedData.blocked > 0 && (
                        <div className="flex flex-col">
                            <span className="text-[9px] uppercase tracking-wider font-bold opacity-60" style={{ color: colors.lichen }}>{t('target_protocol.status_blocked_zen')}</span>
                            <span className="text-base font-heading font-black mt-0.5" style={{ color: colors.lichen }}>{formatMinutes(selectedData.blocked, t)}</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 min-h-0 flex flex-col pt-4 border-t border-dashed" style={{ borderColor: `${colors.stone}80` }}>
                <div className="text-[9px] uppercase tracking-wider font-bold opacity-60 mb-3" style={{ color: colors.stoneDark }}>
                    {t('target_protocol.top_domains')}
                </div>
                <div className="flex-1 overflow-y-auto pr-1 -mr-1 flex flex-col gap-2">
                    {domains.length > 0 ? (
                        domains.map((item, idx) => {
                            const isLocked = lockedTarget === item.domain;
                            return (
                                <button
                                    key={item.domain}
                                    onClick={() => onLockTarget && onLockTarget(item.domain)}
                                    className={`flex items-center justify-between p-2.5 rounded-xl transition-all text-left group border border-transparent hover:border-black/5 hover:bg-black/5 ${isLocked ? 'bg-black/5 border-black/10' : ''}`}
                                    style={{
                                        backgroundColor: item.isBlocked ? `${colors.cinnabar}10` : (isLocked ? 'rgba(0,0,0,0.05)' : 'transparent'),
                                        borderColor: item.isBlocked ? `${colors.cinnabar}20` : (isLocked ? 'rgba(0,0,0,0.1)' : 'transparent')
                                    }}
                                >
                                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                        <div className={`w-2 h-2 rounded-full shrink-0 ${item.isBlocked ? 'animate-pulse' : ''}`} style={{ backgroundColor: item.isBlocked ? colors.cinnabar : colors.forest, boxShadow: item.isBlocked ? `0 0 6px ${colors.cinnabar}60` : 'none' }} />
                                        <span className="text-[12px] font-bold truncate group-hover:text-black transition-colors" style={{ color: item.isBlocked ? colors.lichenDark : colors.stoneDark }}>{item.domain}</span>
                                    </div>
                                    <span className="text-[11px] font-mono shrink-0 font-medium opacity-80" style={{ color: item.isBlocked ? colors.lichen : colors.earth }}>{formatMinutes(item.duration, t)}</span>
                                </button>
                            )
                        })
                    ) : (
                        <div className="flex flex-col items-center justify-center flex-1 rounded-xl border border-dashed min-h-[80px]" style={{ borderColor: `${colors.stone}80`, backgroundColor: `${colors.stone}20` }}>
                            <div className="text-[10px] font-bold uppercase tracking-wider opacity-50 text-center" style={{ color: colors.stoneDark }}>
                                {t('target_protocol.no_activity')}
                            </div>
                            <p className="mt-1 text-[10px] opacity-65 text-center px-3 leading-relaxed" style={{ color: colors.stoneDark }}>
                                {resolveText(t, 'target_protocol.no_activity_hint', {}, resolveText(t, 'target_protocol.no_records_hint', {}, '기록이 없습니다.'))}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-4 pt-4 border-t border-dashed shrink-0" style={{ borderColor: `${colors.stone}80` }}>
                <p className="text-[9px] mt-1 opacity-60 leading-relaxed font-sans" style={{ color: colors.stoneDark }}>
                    {t('target_protocol.domain_hint')}
                </p>
            </div>
        </div>
    );
});

const EmptyInspector = React.memo(({ inferredTarget, onLockTarget, colors, t }) => {
    return (
        <div className="h-full w-full flex flex-col justify-between py-2 animate-in fade-in duration-300 font-sans">
            <div className="space-y-3">
                <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-50 font-sans" style={{ color: colors.stoneDark }}>
                        {resolveText(t, 'target_protocol.site_overview', {}, resolveText(t, 'target_protocol.daily_overview', {}, '일일 개요'))}
                    </div>
                    <div className="text-xl font-heading font-light mt-1" style={{ color: colors.stoneDark }}>
                        {t('target_protocol.no_records')}
                    </div>
                </div>
                <div className="rounded-xl border border-dashed p-3" style={{ borderColor: `${colors.stone}A0`, backgroundColor: `${colors.stone}20` }}>
                    <p className="text-[11px] leading-relaxed opacity-75" style={{ color: colors.stoneDark }}>
                        {t('target_protocol.no_records_hint')}
                    </p>
                </div>
            </div>

            <div className="pt-4 border-t border-dashed space-y-2" style={{ borderColor: `${colors.stone}80` }}>
                <p className="text-[10px] leading-relaxed opacity-70 font-sans" style={{ color: colors.stoneDark }}>
                    {t('target_protocol.fish_hint')}
                </p>
                {inferredTarget && (
                    <button
                        type="button"
                        className="w-full rounded-lg px-3 py-2 text-[11px] font-bold uppercase tracking-wider transition-colors hover:bg-black/10"
                        style={{ color: colors.earth, border: `1px solid ${colors.stone}90` }}
                        onClick={() => onLockTarget(inferredTarget)}
                    >
                        {resolveText(t, 'target_protocol.pin_target', {}, resolveText(t, 'target_protocol.target_focus', {}, '사이트 고정'))}: {inferredTarget}
                    </button>
                )}
            </div>
        </div>
    );
});

const StonePillar = React.memo(({ data, isSelected, isCurrent, lockedTarget, colors, onClick, onMouseEnter, onMouseLeave, t, shouldAnimate = true }) => {
    const heightPercent = Math.min(100, Math.max(8, (data.total / 60) * 100));
    const isBlocked = data.blocked > 0;
    const blockedRatio = data.total > 0 ? (data.blocked / data.total) : 0;
    const targetRatio = data.total > 0 ? (data.target / data.total) : 0;

    return (
        <div className="flex-1 h-full flex flex-col justify-end relative items-center group cursor-pointer" onClick={(e) => { e.stopPropagation(); onClick(data.hour); }} onMouseEnter={() => onMouseEnter(data.hour)} onMouseLeave={onMouseLeave}>
            {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-30 pointer-events-none" style={{ animation: shouldAnimate ? 'float 3s ease-in-out infinite' : 'none' }}>
                    <div className="w-2 h-2 rotate-45 border border-white shadow-[0_0_8px_rgba(197,160,89,0.9)]" style={{ backgroundColor: colors.gold }} />
                </div>
            )}
            <div
                className="w-5 transition-all duration-300 ease-out relative shadow-sm stone-texture overflow-hidden"
                style={{
                    height: `${heightPercent}%`,
                    opacity: isSelected ? 1 : (isCurrent ? 1 : 0.9),
                    backgroundColor: colors.stone,
                    borderRadius: '3px 3px 0 0',
                    transform: isSelected ? 'scaleY(1.05) translateY(-2px)' : 'none',
                    boxShadow: isSelected ? '0 10px 20px -5px rgba(0,0,0,0.3)' : (isCurrent ? `0 0 15px ${colors.gold}50` : 'none'),
                    border: isCurrent ? `1px solid ${colors.gold}60` : undefined
                }}
            >
                <div className="absolute top-0 bottom-0 right-0 w-1 bg-black/10 mix-blend-multiply" />
                <div className="absolute top-0 left-0 right-0 h-[1px] bg-white/40" />

                {/* Blocked Lichen Growth */}
                {isBlocked && (
                    <div className="absolute bottom-0 left-0 right-0 z-10 transition-all duration-500 lichen-growth" style={{ height: `${blockedRatio * 100}%`, backgroundColor: colors.lichen, animation: shouldAnimate && blockedRatio > 0.5 ? 'pulse-lichen 4s infinite ease-in-out' : 'none' }}>
                        <div className="absolute inset-0 bg-linear-to-t/srgb from-black/60 via-transparent to-transparent" />
                    </div>
                )}

                {/* Target Solid Core */}
                {lockedTarget && data.target > 0 && (
                    <div
                        className="absolute bottom-0 left-0 right-0 z-20 transition-all duration-700 ease-out"
                        style={{
                            height: `${targetRatio * 100}%`,
                            backgroundColor: colors.jade,
                            boxShadow: `0 0 8px ${colors.jade}, inset 0 0 4px rgba(255,255,255,0.4)`
                        }}
                    >
                        <div className="absolute inset-0 bg-linear-to-t/srgb from-black/0 via-white/10 to-white/30" />
                    </div>
                )}

                {/* Healthy Moss */}
                {!isBlocked && heightPercent > 20 && (
                    <div className="absolute bottom-0 left-0 w-full h-3 bg-green-800/20 blur-[1px] mix-blend-overlay" style={{ backgroundColor: colors.moss }} />
                )}
            </div>

            <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none z-40 shadow-xl translate-y-1 group-hover:translate-y-0 font-sans font-black tracking-wider" style={{ backgroundColor: '#2C2A28', color: '#F0EBE0' }}>
                {formatHour(data.hour)}
            </div>

            {(data.hour % 4 === 0 || isSelected || isCurrent) && (
                <div className={`absolute -bottom-6 text-[10px] font-mono ${isCurrent ? 'font-black opacity-100 scale-110' : 'font-bold opacity-40'}`} style={{ color: isCurrent ? colors.gold : colors.earth }}>{data.hour}</div>
            )}
        </div>
    );
});

/**
 * ZenActivityGraph
 */
export default function ZenActivityGraph({
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
    onManageSites = () => { }, // Not used directly in this simplified layout but kept for props shape
    onLockTarget = () => { },
    targetStats = { active: 0 },
    labels = {}
}) {
    const { t } = useAppTranslation('main');
    const rootRef = useRef(null);
    const documentVisible = useDocumentVisibility();
    const inViewport = useElementVisibility(rootRef, { threshold: 0.08, rootMargin: '140px' });
    const shouldAnimate = documentVisible && inViewport;
    const [selectedHour, setSelectedHour] = useState(null);
    const [hoveredHour, setHoveredHour] = useState(null);

    // Zen theme colors
    const colors = {
        stone: '#EAE8E3',      // Base stone color
        stoneDark: '#5D5D5A',  // Deep crevices/shadows
        shadow: '#8C8C88',     // Mid-tone shadow
        lichen: '#A63737',     // Blocked/Corrupted (Crimson)
        lichenDark: '#5E1B1B', // Deep red for lichen core
        moss: '#4A5D23',       // Healthy moss accents
        jade: '#4DB6AC',       // Spirit Line / Locked Target (Teal/Jade)
        jadeLight: '#B2DFDB',
        earth: '#3E3C38',      // Ground/Text color
        light: '#FFF9C4',      // Spirit light/Firefly
        paper: 'var(--color-surface)', // Background
        cinnabar: '#B22222',   // Traditional cinnabar red (blocked)
        forest: '#2D4F1E',     // Dark evergreen green (active)
        gold: '#C5A059',       // Subtle gold accents
    };

    // Current hour marker
    const currentHour = new Date().getHours();

    const selectedData = useMemo(() => {
        if (selectedHour === null) return null;
        return graphData.find((d) => d.hour === selectedHour) || null;
    }, [graphData, selectedHour]);

    const hasData = useMemo(() => {
        if (Number(totalTrackedDuration) > 0) return true;
        return graphData.some((d) => Number(d.total || 0) > 0 || Number(d.blocked || 0) > 0 || Number(d.target || 0) > 0);
    }, [totalTrackedDuration, graphData]);

    const handleSelectHour = useCallback((hour) => {
        setSelectedHour((prev) => (prev === hour ? null : hour));
    }, []);

    const handleCloseDrawer = useCallback(() => {
        setSelectedHour(null);
    }, []);

    const inferredTarget = useMemo(() => {
        const aggregate = new Map();
        for (const hourData of graphData) {
            for (const domainData of hourData?.domains || []) {
                const domain = domainData?.domain;
                if (!domain) continue;
                const duration = Number(domainData?.duration) || 0;
                aggregate.set(domain, (aggregate.get(domain) || 0) + duration);
            }
        }
        let bestDomain = null;
        let bestDuration = -1;
        for (const [domain, duration] of aggregate.entries()) {
            if (duration > bestDuration) {
                bestDomain = domain;
                bestDuration = duration;
            }
        }
        return bestDomain;
    }, [graphData]);

    useEffect(() => {
        if (!onLockTarget || lockedTarget || !hasData || !inferredTarget) return;
        onLockTarget(inferredTarget);
    }, [onLockTarget, lockedTarget, hasData, inferredTarget]);

    return (
        <div
            ref={rootRef}
            className="w-full h-full flex flex-row gap-0 rounded-[32px] p-0 relative overflow-visible"
            style={{
                backgroundColor: colors.paper,
                border: `1px solid ${colors.stone}80`,
                boxShadow: '0 20px 50px rgba(60, 58, 55, 0.15)'
            }}
        >
            <style>{STYLES}</style>

            {/* Background Texture paper */}
            <div className="absolute inset-0 opacity-[0.08] pointer-events-none mix-blend-multiply" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.6' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />

            {/* LEFT: Context Anchor (Site / Hour / Empty Inspector) */}
            <div className="w-[240px] flex flex-col items-center justify-center shrink-0 border-r relative z-10 py-6 px-5" style={{ borderColor: `${colors.stone}40` }}>
                {selectedData ? (
                    <HourInspector
                        selectedData={selectedData}
                        lockedTarget={lockedTarget}
                        colors={colors}
                        onLockTarget={onLockTarget}
                        onClearSelection={handleCloseDrawer}
                        t={t}
                    />
                ) : lockedTarget ? (
                    <SiteInspector
                        lockedTarget={lockedTarget}
                        isBlocked={isBlocked}
                        onToggleBlock={onToggleBlock}
                        targetStats={targetStats}
                        colors={colors}
                        labels={labels}
                        t={t}
                    />
                ) : (
                    <EmptyInspector
                        inferredTarget={inferredTarget}
                        onLockTarget={onLockTarget}
                        colors={colors}
                        t={t}
                    />
                )}
            </div>

            {/* CENTER: Zen Graph */}
            <div className="flex-1 min-w-0 min-h-0 flex flex-col relative z-10 px-6 py-5">

                {/* Header / Legend */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex flex-col gap-1.5">
                        <h3 className="text-[11px] font-heading font-black uppercase tracking-[0.3em] opacity-40" style={{ color: colors.earth }}>
                            {t('target_protocol.daily_monuments')}
                        </h3>
                        <div className="flex gap-4 text-[9px] uppercase tracking-widest font-bold opacity-60 font-sans" style={{ color: colors.shadow }}>
                            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.stoneDark }} /> {t('target_protocol.legend_solid')}</span>
                            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.lichen }} /> {resolveText(t, 'target_protocol.legend_blocked', {}, '정제')}</span>
                            {lockedTarget && (
                                <span className={`flex items-center gap-1.5 ${shouldAnimate ? 'animate-pulse' : ''}`.trim()}><span className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.jade }} /> {t('target_protocol.legend_target')}</span>
                            )}
                        </div>
                    </div>

                    {/* Daily Summary (Fixed) */}
                    <div
                        className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border backdrop-blur-sm shadow-sm font-sans min-w-[270px]"
                        style={{ backgroundColor: `${colors.stone}30`, borderColor: `${colors.stone}60` }}
                    >
                        <span
                            className="text-[12px] font-bold leading-none"
                            style={{ color: blockedSharePercent > 0 ? colors.lichen : colors.earth }}
                        >
                            {resolveText(
                                t,
                                'target_protocol.summary_blocked_over_total',
                                {
                                    blocked: formatTime(totalBlockedDuration, t),
                                    total: formatTime(totalTrackedDuration, t),
                                    percent: Math.round(blockedSharePercent),
                                },
                                `제한 ${formatTime(totalBlockedDuration, t)} / 전체 ${formatTime(totalTrackedDuration, t)} (${Math.round(blockedSharePercent)}%)`
                            )}
                        </span>
                        <span className="opacity-45 text-[11px]" style={{ color: colors.shadow }}>|</span>
                        <span className="text-[12px] font-bold leading-none" style={{ color: colors.earth }}>
                            {resolveText(
                                t,
                                'target_protocol.summary_peak_hour',
                                {
                                    hour: peakHour === null ? '--:--' : formatHour(peakHour),
                                },
                                `최고 시간 ${peakHour === null ? '--:--' : formatHour(peakHour)}`
                            )}
                        </span>
                    </div>
                </div>

                {/* Graph Area */}
                <div className="flex-1 flex items-end gap-1.5 pb-2 border-b border-stone-200/50 relative" onClick={handleCloseDrawer}>
                    {/* Horizontal Guide Lines */}
                    {[25, 50, 75].map(pct => (
                        <div key={pct} className="absolute inset-x-0 border-t border-dotted opacity-20 pointer-events-none" style={{ bottom: `${pct}%`, borderColor: colors.earth }} />
                    ))}

                    {/* Map Data to StonePillars */}
                    {graphData.map((d) => (
                        <StonePillar
                            key={d.hour}
                            data={d}
                            isSelected={selectedHour === d.hour}
                            isCurrent={d.hour === currentHour}
                            lockedTarget={lockedTarget}
                            colors={colors}
                            onClick={handleSelectHour}
                            onMouseEnter={setHoveredHour}
                            onMouseLeave={() => setHoveredHour(null)}
                            t={t}
                            shouldAnimate={shouldAnimate}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
