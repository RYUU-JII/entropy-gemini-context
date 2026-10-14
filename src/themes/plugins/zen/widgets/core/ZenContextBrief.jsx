import React from 'react';
import { ArrowUpRight, Clock3, Target, X } from 'lucide-react';
import { SiteProtectionIcon } from '@/ui-kit/Icons.jsx';

import Favicon from '@/ui-kit/Favicon.jsx';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';

const MINUTE_MS = 60000;
const HOUR_COUNT = 24;

const ZEN_RHYTHM_COLORS = Object.freeze({
    shell: 'var(--zen-ambient-layer-l2-top)',
    wash: 'var(--zen-ambient-layer-l2-bottom)',
    border: 'var(--color-border)',
    borderSoft: 'color-mix(in srgb, var(--color-border) 38%, transparent)',
    ink: 'var(--color-on-surface)',
    muted: 'var(--color-on-surface-muted)',
    subtle: 'var(--color-on-surface-subtle)',
    protected: '#A9483F',
    protectedInk: '#74332D',
    jade: '#4DB6AC',
    jadeInk: '#285E59',
    gold: '#C5A059',
});

function toNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeHour(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    const hour = Math.floor(numeric);
    return hour >= 0 && hour < HOUR_COUNT ? hour : null;
}

function normalizeDomain(value) {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function resolveText(t, key, options = {}, fallback = '') {
    const value = typeof t === 'function' ? t(key, options) : '';
    return typeof value === 'string' && value && value !== key ? value : fallback;
}

function formatDuration(ms, t) {
    const safeMs = Math.max(0, toNumber(ms));
    const minutes = Math.round(safeMs / MINUTE_MS);
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    if (hours <= 0) return `${remainder}${resolveText(t, 'units.minute_short', {}, 'm')}`;
    if (remainder <= 0) return `${hours}${resolveText(t, 'units.hour_abbr', {}, 'h')}`;
    return `${hours}${resolveText(t, 'units.hour_abbr', {}, 'h')} ${remainder}${resolveText(t, 'units.minute_short', {}, 'm')}`;
}

function formatHour(hour) {
    const normalized = normalizeHour(hour);
    return normalized === null ? '--:--' : `${String(normalized).padStart(2, '0')}:00`;
}

function formatPercent(ratio) {
    return `${Math.round(Math.max(0, toNumber(ratio)) * 100)}%`;
}

function clampTextStyle(lines = 1) {
    return {
        display: '-webkit-box',
        WebkitBoxOrient: 'vertical',
        WebkitLineClamp: lines,
        overflow: 'hidden',
    };
}

function MetricCell({ icon: Icon, label, value, detail = '', accent = ZEN_RHYTHM_COLORS.muted }) {
    return (
        <div className="min-w-0">
            <div className="mb-1 flex items-center gap-1.5">
                <Icon size={12} strokeWidth={2.1} style={{ color: accent }} />
                <span className="truncate text-[7px] font-bold uppercase tracking-[0.12em]" style={{ color: ZEN_RHYTHM_COLORS.subtle }}>
                    {label}
                </span>
            </div>
            <div className="truncate text-[15px] font-bold leading-none" style={{ color: ZEN_RHYTHM_COLORS.ink }}>
                {value}
            </div>
            {detail ? (
                <div className="mt-1 truncate text-[8px] font-semibold" style={{ color: ZEN_RHYTHM_COLORS.subtle }}>
                    {detail}
                </div>
            ) : null}
        </div>
    );
}

function TopSiteButton({ site, selected, onSelectSite, t }) {
    const domain = normalizeDomain(site?.domain);
    if (!domain) return null;
    const activeMs = Math.max(0, toNumber(site?.activeMs));
    const canSelect = typeof onSelectSite === 'function';

    return (
        <button
            type="button"
            disabled={!canSelect}
            onClick={() => onSelectSite?.(domain)}
            className="grid min-h-[28px] min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b py-1.5 text-left transition-colors last:border-b-0 disabled:cursor-default"
            style={{
                borderColor: ZEN_RHYTHM_COLORS.borderSoft,
                color: ZEN_RHYTHM_COLORS.ink,
            }}
            title={`${domain} · ${formatDuration(activeMs, t)}`}
            aria-pressed={selected}
        >
            <span
                className="flex h-6 w-6 items-center justify-center rounded-[8px] border"
                style={{
                    backgroundColor: selected ? `${ZEN_RHYTHM_COLORS.jade}18` : 'var(--color-surface-elevated)',
                    borderColor: selected ? `${ZEN_RHYTHM_COLORS.jade}66` : ZEN_RHYTHM_COLORS.borderSoft,
                }}
            >
                <Favicon domain={domain} size={14} className="rounded-[4px]" />
            </span>
            <span className="min-w-0 truncate text-[10px] font-bold">
                {domain}
            </span>
            <span className="font-mono text-[9px] font-bold" style={{ color: selected ? ZEN_RHYTHM_COLORS.jadeInk : ZEN_RHYTHM_COLORS.muted }}>
                {formatDuration(activeMs, t)}
            </span>
        </button>
    );
}

export default function ZenRhythmSummaryCard({
    rhythmSummary = null,
    brief = null,
    selectedLensDomain = null,
    topSites = [],
    onSelectSite = null,
    onClearLens = null,
    aiNarrationSlot = null,
    onAction = null,
    className = '',
}) {
    const { t } = useAppTranslation('main');
    const summary = rhythmSummary && typeof rhythmSummary === 'object' ? rhythmSummary : {};
    const selectedDomain = normalizeDomain(selectedLensDomain || summary?.lens?.domain || brief?.focusDomain);
    const summaryTopSites = Array.isArray(summary?.topSites) && summary.topSites.length > 0
        ? summary.topSites
        : topSites;
    const visibleTopSites = (Array.isArray(summaryTopSites) ? summaryTopSites : []).slice(0, 5);
    const startHour = normalizeHour(summary?.startHour ?? summary?.resetHour);
    const totalMs = Math.max(0, toNumber(summary?.totalMs));
    const protectedMs = Math.max(0, toNumber(summary?.protectedMs));
    const globalGoalMinutes = Math.max(0, Math.floor(toNumber(summary?.globalGoalMinutes)));
    const globalGoalMs = globalGoalMinutes * MINUTE_MS;
    const protectedGoalRatio = globalGoalMs > 0 ? protectedMs / globalGoalMs : toNumber(summary?.protectedGoalRatio);
    const lens = selectedDomain
        ? {
            domain: selectedDomain,
            activeMs: Math.max(0, toNumber(summary?.lens?.activeMs)),
            goalMinutes: Math.max(0, Math.floor(toNumber(summary?.lens?.goalMinutes))),
            statusLabel: summary?.lens?.statusLabel || brief?.statusLabel || '',
            verdict: summary?.lens?.verdict || brief?.verdict || '',
            action: summary?.lens?.action || brief?.action || null,
        }
        : null;

    const totalLabel = resolveText(t, 'target_protocol.legend_total_usage', {}, 'Total');
    const protectedLabel = resolveText(t, 'target_protocol.legend_protected_sites', {}, 'Protected');
    const goalLabel = resolveText(t, 'target_protocol.rhythm_goal', {}, 'Goal');
    const topLabel = resolveText(t, 'target_protocol.top_today_sites', {}, 'Top today');
    const rhythmTitle = resolveText(t, 'target_protocol.rhythm_today', {}, "Today's rhythm");
    const startLabel = startHour === null
        ? resolveText(t, 'target_protocol.rhythm_day', {}, 'Rhythm day')
        : resolveText(t, 'target_protocol.rhythm_start', { hour: formatHour(startHour) }, `${formatHour(startHour)} start`);
    const allFlowLabel = resolveText(t, 'target_protocol.all_flow', {}, 'All flow');
    const clearLabel = resolveText(t, 'target_protocol.clear_selection', {}, 'Clear selection');
    const reviewLabel = lens?.action?.label || resolveText(t, 'main.brief_action_review_site', {}, 'Review site');

    return (
        <section
            className={`relative flex h-full min-h-0 w-full overflow-hidden rounded-[24px] border px-4 py-3.5 sm:px-5 sm:py-4 ${className}`}
            style={{
                background: `radial-gradient(circle at top left, ${ZEN_RHYTHM_COLORS.jade}12, transparent 36%), linear-gradient(180deg, ${ZEN_RHYTHM_COLORS.shell} 0%, ${ZEN_RHYTHM_COLORS.wash} 100%)`,
                borderColor: ZEN_RHYTHM_COLORS.borderSoft,
                boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.62), 0 8px 24px -4px rgba(93, 64, 55, 0.04)',
            }}
        >
            <div className="flex h-full min-h-0 w-full flex-col">
                <div className="flex shrink-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="text-[8px] font-bold uppercase tracking-[0.16em]" style={{ color: ZEN_RHYTHM_COLORS.subtle }}>
                            {rhythmTitle}
                        </div>
                        <div className="mt-1 truncate text-[14px] font-bold leading-none" style={{ color: ZEN_RHYTHM_COLORS.ink }}>
                            {startLabel}
                        </div>
                    </div>
                    <div
                        className="shrink-0 rounded-full border px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.1em]"
                        style={{
                            backgroundColor: lens ? `${ZEN_RHYTHM_COLORS.jade}16` : 'color-mix(in srgb, var(--color-surface-elevated) 55%, transparent)',
                            borderColor: lens ? `${ZEN_RHYTHM_COLORS.jade}55` : ZEN_RHYTHM_COLORS.borderSoft,
                            color: lens ? ZEN_RHYTHM_COLORS.jadeInk : ZEN_RHYTHM_COLORS.muted,
                        }}
                    >
                        {lens ? resolveText(t, 'target_protocol.legend_selected_site', {}, 'Selected') : allFlowLabel}
                    </div>
                </div>

                <div className="mt-3 grid shrink-0 grid-cols-3 gap-3 border-y py-3" style={{ borderColor: ZEN_RHYTHM_COLORS.borderSoft }}>
                    <MetricCell
                        icon={Clock3}
                        label={totalLabel}
                        value={formatDuration(totalMs, t)}
                        detail={totalMs > 0 ? startLabel : resolveText(t, 'target_protocol.no_activity', {}, 'No activity yet')}
                    />
                    <MetricCell
                        icon={SiteProtectionIcon}
                        label={protectedLabel}
                        value={formatDuration(protectedMs, t)}
                        detail={totalMs > 0 ? formatPercent(summary?.protectedShareOfDay) : ''}
                        accent={ZEN_RHYTHM_COLORS.protected}
                    />
                    <MetricCell
                        icon={Target}
                        label={goalLabel}
                        value={globalGoalMs > 0 ? formatPercent(protectedGoalRatio) : '--'}
                        detail={globalGoalMs > 0 ? `${formatDuration(protectedMs, t)} / ${formatDuration(globalGoalMs, t)}` : resolveText(t, 'main.scan_goal_unset', {}, 'Unset')}
                        accent={ZEN_RHYTHM_COLORS.gold}
                    />
                </div>

                <div className="mt-2 min-h-0 flex-1 overflow-hidden">
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                        <div className="truncate text-[8px] font-bold uppercase tracking-[0.14em]" style={{ color: ZEN_RHYTHM_COLORS.subtle }}>
                            {topLabel}
                        </div>
                    </div>
                    <div className="min-h-0 overflow-hidden">
                        {visibleTopSites.length > 0 ? (
                            visibleTopSites.map((site) => (
                                <TopSiteButton
                                    key={site.domain}
                                    site={site}
                                    selected={normalizeDomain(site.domain) === selectedDomain}
                                    onSelectSite={onSelectSite}
                                    t={t}
                                />
                            ))
                        ) : (
                            <div className="py-3 text-[10px] font-semibold" style={{ color: ZEN_RHYTHM_COLORS.subtle }}>
                                {resolveText(t, 'target_protocol.no_activity_hint', {}, 'No records yet.')}
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-2 shrink-0 border-t pt-2.5" style={{ borderColor: ZEN_RHYTHM_COLORS.borderSoft }}>
                    {lens ? (
                        <div className="min-w-0">
                            <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
                                <Favicon domain={lens.domain} size={22} className="rounded-[6px]" />
                                <div className="min-w-0">
                                    <div className="text-[7px] font-bold uppercase tracking-[0.13em]" style={{ color: ZEN_RHYTHM_COLORS.jadeInk }}>
                                        {resolveText(t, 'target_protocol.rhythm_lens', {}, 'Lens')}
                                    </div>
                                    <div className="truncate text-[12px] font-bold leading-tight" style={{ color: ZEN_RHYTHM_COLORS.ink }}>
                                        {lens.domain}
                                    </div>
                                </div>
                                {typeof onClearLens === 'function' ? (
                                    <button
                                        type="button"
                                        onClick={onClearLens}
                                        className="flex h-7 w-7 items-center justify-center rounded-full border transition-transform hover:scale-[1.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                                        style={{
                                            backgroundColor: 'var(--color-surface-elevated)',
                                            borderColor: ZEN_RHYTHM_COLORS.borderSoft,
                                            color: ZEN_RHYTHM_COLORS.muted,
                                            outlineColor: ZEN_RHYTHM_COLORS.jade,
                                        }}
                                        title={clearLabel}
                                        aria-label={clearLabel}
                                    >
                                        <X size={13} strokeWidth={2.1} />
                                    </button>
                                ) : null}
                            </div>
                            <div className="mt-2 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                                <div className="min-w-0">
                                    <div className="truncate text-[13px] font-bold leading-tight" style={{ color: ZEN_RHYTHM_COLORS.ink }}>
                                        {lens.verdict || formatDuration(lens.activeMs, t)}
                                    </div>
                                    {lens.statusLabel ? (
                                        <div className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.1em]" style={{ color: ZEN_RHYTHM_COLORS.subtle, ...clampTextStyle(1) }}>
                                            {lens.statusLabel}
                                        </div>
                                    ) : null}
                                </div>
                                {lens.action ? (
                                    <button
                                        type="button"
                                        onClick={() => onAction?.(lens.action)}
                                        className="inline-flex h-7 max-w-[108px] items-center justify-center gap-1 rounded-full border px-2.5 text-[8px] font-bold uppercase tracking-[0.09em] transition-transform hover:scale-[1.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                                        style={{
                                            backgroundColor: 'var(--color-surface-elevated)',
                                            borderColor: `${ZEN_RHYTHM_COLORS.jade}55`,
                                            color: ZEN_RHYTHM_COLORS.jadeInk,
                                            outlineColor: ZEN_RHYTHM_COLORS.jade,
                                        }}
                                        title={reviewLabel}
                                        aria-label={reviewLabel}
                                    >
                                        <span className="min-w-0 truncate">{reviewLabel}</span>
                                        <ArrowUpRight size={11} strokeWidth={2.2} className="shrink-0" />
                                    </button>
                                ) : null}
                            </div>
                            {aiNarrationSlot ? (
                                <div className="mt-1.5 min-h-0 overflow-hidden">
                                    {aiNarrationSlot}
                                </div>
                            ) : null}
                        </div>
                    ) : (
                        <div className="flex min-h-[42px] items-center justify-between gap-3">
                            <div className="min-w-0">
                                <div className="text-[8px] font-bold uppercase tracking-[0.13em]" style={{ color: ZEN_RHYTHM_COLORS.subtle }}>
                                    {allFlowLabel}
                                </div>
                                <div className="mt-0.5 truncate text-[12px] font-bold" style={{ color: ZEN_RHYTHM_COLORS.ink }}>
                                    {formatDuration(totalMs, t)}
                                </div>
                            </div>
                            <div className="h-px flex-1" style={{ backgroundColor: ZEN_RHYTHM_COLORS.borderSoft }} />
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
