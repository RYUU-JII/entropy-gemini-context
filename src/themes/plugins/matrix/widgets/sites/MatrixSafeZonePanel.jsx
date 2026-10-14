import React, { useEffect, useMemo } from 'react';
import { Panel, UiHeader, UiButton } from '../../../../../ui-kit';
import { useAppTranslation } from '../../../../../ui-kit/hooks/useAppTranslation.js';
import {
    buildSiteRuleDiagnostics,
    getSiteRuleBadgeItems,
} from '@/lib/siteRuleDiagnostics.js';

function SafeEntry({ domain, observedMinutes = null, pendingLabel = '', isSelected = false, onSelect, badges = [] }) {
    return (
        <button
            type="button"
            id={`safe-item-${domain}`}
            aria-current={isSelected ? 'true' : undefined}
            aria-controls="sites-site-detail"
            className={`group grid w-full cursor-pointer grid-cols-[10px_minmax(0,1fr)_auto] items-center gap-3 border-b border-[#14532d]/60 px-3 py-2 text-left transition-colors ${isSelected
                ? 'bg-[#0b1b10] shadow-[inset_0_0_0_1px_rgba(57,255,20,0.6)]'
                : 'hover:bg-[#07120b]'}`}
            onClick={() => onSelect?.(domain)}
        >
            <div className="h-1.5 w-1.5 rounded-sm bg-[#39ff14]" />
            <div className="min-w-0">
                <div className="truncate text-[12px] uppercase tracking-[0.08em] text-[#bbf7d0]">{domain}</div>
                {badges.length > 0 ? (
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {badges.map((badge) => (
                            <span
                                key={`${domain}:${badge.id}`}
                                className="inline-flex items-center rounded-full border border-[#14532d] bg-[#07120b] px-2 py-[1px] text-[8px] font-black uppercase tracking-[0.1em] text-[#86efac]/80"
                            >
                                {badge.label}
                            </span>
                        ))}
                    </div>
                ) : null}
            </div>
            <div className={`text-[9px] font-black uppercase tracking-[0.1em] ${pendingLabel ? 'text-[#fbbf24]' : 'text-[#6ee7b7]/65'}`}>
                {pendingLabel || (observedMinutes === null ? '--' : `${observedMinutes}m`)}
            </div>
        </button>
    );
}

export default function MatrixSafeZonePanel({
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
    const countLabel = Number.isFinite(totalCount) ? totalCount : safeAllowed.length;
    const diagnosticsByDomain = useMemo(
        () => buildSiteRuleDiagnostics(ruleDomains || safeAllowed),
        [ruleDomains, safeAllowed]
    );

    useEffect(() => {
        if (!selectedDomain) return;
        const element = document.getElementById(`safe-item-${selectedDomain}`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [selectedDomain, safeAllowed]);

    return (
        <div className={`${embedded ? '' : 'p-3 '}flex h-full min-h-0 flex-col overflow-hidden border border-[#14532d] bg-black/40 font-mono`}>
            {showHeader ? (
                <div className="flex items-center justify-between border-b border-[#14532d] px-3 py-2">
                    <UiHeader className="text-[10px] uppercase tracking-[0.16em] text-[#86efac]">{safeLabels.title}</UiHeader>
                    <UiHeader variant="label" className="text-[10px] uppercase tracking-[0.14em] text-[#6ee7b7]/70">
                        {safeLabels.countPrefix}: {countLabel}
                    </UiHeader>
                </div>
            ) : null}

            {showListHeader ? (
                <div className="grid grid-cols-[10px_minmax(0,1fr)_32px] items-center gap-3 border-b border-[#14532d]/70 px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-[#86efac]/70">
                    <div />
                    <span>{safeLabels.domainHeader}</span>
                    <div />
                </div>
            ) : null}

            <Panel variant="sunken" className="relative flex-1 overflow-y-auto border-0 bg-transparent p-0">
                {safeAllowed.length === 0 ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-[#86efac]/35">
                        <div className="mb-1 text-2xl">::</div>
                        <span className="text-[10px] uppercase tracking-[0.14em]">{safeLabels.emptyLabel}</span>
                    </div>
                ) : (
                    safeAllowed.map((domain) => (
                        <SafeEntry
                            key={domain}
                            domain={domain}
                            badges={getSiteRuleBadgeItems(domain, diagnosticsByDomain)}
                            observedMinutes={siteRegistry?.byDomain?.[domain]
                                ? Math.round(Math.max(0, Number(siteRegistry.byDomain[domain].usage?.observedMs) || 0) / 60000)
                                : null}
                            pendingLabel={pendingRelease?.domain === domain
                                ? t('release.row_pending', { seconds: pendingRelease.remainingSeconds })
                                : ''}
                            isSelected={selectedDomain === domain}
                            onSelect={onSelect}
                        />
                    ))
                )}
            </Panel>

            {pager?.show ? (
                <div className="flex items-center justify-between border-t border-[#14532d] px-2 py-2">
                    <UiButton size="sm" onClick={pager.onPrev} disabled={pager.page <= 0}>{t('common:prev')}</UiButton>
                    <UiHeader variant="label" className="text-[10px] text-[#86efac]/70">{pager.page + 1} / {pager.pageCount}</UiHeader>
                    <UiButton size="sm" onClick={pager.onNext} disabled={pager.page + 1 >= pager.pageCount}>{t('common:next')}</UiButton>
                </div>
            ) : null}
        </div>
    );
}
