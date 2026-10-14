import React, { useEffect, useMemo } from 'react';
import { Panel, UiHeader, UiButton } from '../../../../../ui-kit';
import { useAppTranslation } from '../../../../../ui-kit/hooks/useAppTranslation.js';
import {
    buildSiteRuleDiagnostics,
    getSiteRuleBadgeItems,
} from '@/lib/siteRuleDiagnostics.js';

function SafeEntry({ domain, observedMinutes = null, minuteSuffix = '', pendingLabel = '', isSelected = false, onSelect, badges = [] }) {
    // Selection style logic could be moved to a prop in Panel if needed commonly
    let selectionStyles = isSelected
        ? 'bg-success/10 border-success/60 shadow-[0_0_12px_rgba(0,255,120,0.12)] neon-glow'
        : 'border-border/20 hover:bg-white/5';

    return (
        <button
            type="button"
            id={`safe-item-${domain}`}
            aria-current={isSelected ? 'true' : undefined}
            aria-controls="sites-site-detail"
            className={`group grid w-full grid-cols-[12px_minmax(0,1fr)_auto] items-center gap-3 border-b px-4 py-3 text-left transition-colors last:border-0 ${selectionStyles}`}
            onClick={() => onSelect?.(domain)}
        >
            <div className="w-1.5 h-1.5 rounded-full bg-success" />
            <div className="min-w-0">
                <div className="truncate text-sm font-mono text-on-surface">{domain}</div>
                {badges.length > 0 ? (
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {badges.map((badge) => (
                            <span
                                key={`${domain}:${badge.id}`}
                                className="inline-flex items-center rounded-full border border-border/15 bg-surface-elevated/70 px-2 py-[1px] text-[9px] font-bold uppercase tracking-[0.08em] text-on-surface-muted"
                            >
                                {badge.label}
                            </span>
                        ))}
                    </div>
                ) : null}
            </div>
            <div className={pendingLabel ? 'text-xs font-bold text-warning' : 'text-xs font-mono tabular-nums text-on-surface-muted'}>
                {pendingLabel || (observedMinutes === null ? '--' : `${observedMinutes}${minuteSuffix}`)}
            </div>
        </button>
    );
}

export default function SafeZonePanel({
    allowedItems,
    ruleDomains = null,
    siteRegistry = null,
    pendingRelease = null,
    selectedDomain,
    onSelect,
    totalCount,
    pager,
    labels,
    embedded = false,
    showHeader = true,
    showListHeader = true,
}) {
    const { t } = useAppTranslation('sites');
    const safeAllowed = Array.isArray(allowedItems) ? allowedItems : [];
    const safeLabels = labels || {};
    const minuteSuffix = t('standard_panel.minute_suffix', {});
    const countLabel = Number.isFinite(totalCount) ? totalCount : safeAllowed.length;
    const diagnosticsByDomain = useMemo(
        () => buildSiteRuleDiagnostics(ruleDomains || safeAllowed),
        [ruleDomains, safeAllowed]
    );
    const containerClassName = embedded
        ? 'h-full flex flex-col relative overflow-hidden'
        : 'ui-module h-full flex flex-col relative overflow-hidden p-3 bg-surface-sunken';

    useEffect(() => {
        if (selectedDomain) {
            const el = document.getElementById(`safe-item-${selectedDomain}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [selectedDomain, safeAllowed]);

    return (
        <div className={containerClassName}>
            {/* Header */}
            {showHeader && (
                <div className="flex items-center justify-between gap-2 mb-2 px-1">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 border border-success/60 flex items-center justify-center">
                            <div className="w-1.5 h-1.5 bg-success/60" />
                        </div>
                        <UiHeader className="text-xs text-on-surface">
                            {safeLabels.title}
                        </UiHeader>
                    </div>
                    <UiHeader variant="label" className="text-on-surface-muted">
                        {safeLabels.countPrefix}: {countLabel}
                    </UiHeader>
                </div>
            )}

            {/* List Header */}
            {showListHeader && (
                <div className="grid grid-cols-[12px_minmax(0,1fr)_36px] items-center gap-3 px-4 py-2 bg-surface-sunken border-b border-border/10">
                    <div />
                    <UiHeader variant="label" className="font-bold text-on-surface-muted">
                        {safeLabels.domainHeader}
                    </UiHeader>
                    <div />
                </div>
            )}

            {/* List */}
            <Panel variant="sunken" className="flex-1 overflow-y-auto min-h-0 bg-surface-sunken/40">
                {safeAllowed.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-on-surface-muted/30">
                        <span className="text-xs font-mono uppercase">
                            {safeLabels.emptyLabel}
                        </span>
                    </div>
                ) : (
                    safeAllowed.map(domain => (
                        <SafeEntry
                            key={domain}
                            domain={domain}
                            badges={getSiteRuleBadgeItems(domain, diagnosticsByDomain)}
                            observedMinutes={siteRegistry?.byDomain?.[domain]
                                ? Math.round(Math.max(0, Number(siteRegistry.byDomain[domain].usage?.observedMs) || 0) / 60000)
                                : null}
                            minuteSuffix={minuteSuffix}
                            pendingLabel={pendingRelease?.domain === domain
                                ? t('release.row_pending', { seconds: pendingRelease.remainingSeconds })
                                : ''}
                            isSelected={selectedDomain === domain}
                            onSelect={onSelect}
                        />
                    ))
                )}
            </Panel>

            {pager?.show && (
                <div className="flex items-center justify-between mt-2 px-1">
                    <UiButton size="sm" onClick={pager.onPrev} disabled={pager.page <= 0}>
                        {t('common:prev')}
                    </UiButton>
                    <UiHeader variant="label" className="text-on-surface-muted">
                        {pager.page + 1} / {pager.pageCount}
                    </UiHeader>
                    <UiButton size="sm" onClick={pager.onNext} disabled={pager.page + 1 >= pager.pageCount}>
                        {t('common:next')}
                    </UiButton>
                </div>
            )}
        </div>
    );
}
