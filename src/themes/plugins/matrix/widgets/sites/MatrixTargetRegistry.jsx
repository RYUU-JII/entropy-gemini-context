import React, { useEffect, useMemo } from 'react';
import { Panel, UiHeader, UiButton } from '../../../../../ui-kit';
import { useAppTranslation } from '../../../../../ui-kit/hooks/useAppTranslation.js';
import {
    buildSiteRuleDiagnostics,
    getSiteRuleBadgeItems,
} from '@/lib/siteRuleDiagnostics.js';
import {
    buildSitePullRegistryStatus,
} from '@/themes/core/widgets/shared/sites/index.js';

function resolveMatrixStatusToneClass(tone = 'neutral') {
    if (tone === 'danger') return 'text-[#ef4444]';
    if (tone === 'warning') return 'text-[#fbbf24]';
    if (tone === 'positive') return 'text-[#39ff14]';
    return 'text-[#86efac]/70';
}

function resolveMatrixChipClass(tone = 'neutral') {
    if (tone === 'danger') return 'border-[#ef4444]/45 bg-[#2a0507]/70 text-[#fecaca]';
    if (tone === 'warning') return 'border-[#fbbf24]/45 bg-[#1f1602]/70 text-[#fde68a]';
    if (tone === 'positive') return 'border-[#39ff14]/45 bg-[#07120b] text-[#bbf7d0]';
    return 'border-[#14532d] bg-[#07120b] text-[#86efac]/80';
}

function resolveMatrixDotClass({ isOverLimit, registryStatus }) {
    if (isOverLimit || registryStatus?.stateTone === 'danger') return 'bg-[#ef4444]';
    if (registryStatus?.stateTone === 'warning') return 'bg-[#fbbf24]';
    return 'bg-[#39ff14]';
}

function TargetEntry({
    domain,
    exposure = 0,
    observed = 0,
    goal = 0,
    isSelected = false,
    onSelect,
    badges = [],
    registryStatus = null,
    pendingLabel = '',
    dataAvailable = true,
}) {
    const { t } = useAppTranslation('sites');
    const isOverLimit = goal > 0 && exposure >= goal;
    const minuteUnit = t('matrix.target_registry.minute_unit');
    const goalLabel = goal > 0 ? `${goal}${minuteUnit}` : '--';
    const registryChips = (registryStatus?.chips || [])
        .filter((chip) => !chip.id.startsWith('score_setup') && chip.id !== 'goal_unset')
        .slice(0, 3);
    const stateLabel = registryStatus?.stateLabel || (goal <= 0
        ? t('score_setup.inline_unset')
        : '');

    return (
        <button
            type="button"
            id={`target-item-${domain}`}
            aria-current={isSelected ? 'true' : undefined}
            aria-controls="sites-site-detail"
            className={`group grid cursor-pointer grid-cols-[10px_minmax(0,1fr)_56px_56px_24px] items-center gap-3 border-b border-[#14532d]/60 px-3 py-2 transition-colors ${isSelected
                ? 'bg-[#0b1b10] shadow-[inset_0_0_0_1px_rgba(57,255,20,0.6)]'
                : 'hover:bg-[#07120b]'}`}
            onClick={() => onSelect?.(domain)}
        >
            <div className={`h-1.5 w-1.5 rounded-sm ${resolveMatrixDotClass({ isOverLimit, registryStatus })}`} />
            <div className="min-w-0">
                <div className="truncate text-[12px] uppercase tracking-[0.08em] text-[#bbf7d0]">{domain}</div>
                {isOverLimit ? <div className="text-[9px] uppercase tracking-[0.12em] text-[#ef4444]">{t('matrix.target_registry.over_limit')}</div> : null}
                {!dataAvailable ? (
                    <div className="mt-0.5 text-[9px] uppercase tracking-[0.12em] text-[#86efac]/50">
                        {t('registry.data_unavailable')}
                    </div>
                ) : stateLabel ? (
                    <div className={`mt-0.5 text-[9px] uppercase tracking-[0.12em] ${resolveMatrixStatusToneClass(registryStatus?.stateTone)}`}>
                        {stateLabel}
                    </div>
                ) : null}
                {pendingLabel ? (
                    <div className="mt-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-[#fbbf24]">
                        {pendingLabel}
                    </div>
                ) : null}
                {dataAvailable && observed !== exposure ? (
                    <div className="mt-0.5 text-[9px] uppercase tracking-[0.1em] text-[#6ee7b7]/60">
                        {t('registry.observed_usage_short', { value: `${observed}${minuteUnit}` })}
                    </div>
                ) : null}
                {dataAvailable && registryChips.length > 0 ? (
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {registryChips.map((chip) => (
                            <span
                                key={`${domain}:pull:${chip.id}`}
                                className={`inline-flex items-center rounded-full border px-2 py-[1px] text-[8px] font-black uppercase tracking-[0.1em] ${resolveMatrixChipClass(chip.tone)}`}
                            >
                                {chip.label}
                            </span>
                        ))}
                    </div>
                ) : null}
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

            <div className="text-right text-[10px] tabular-nums text-[#86efac]/70">{dataAvailable ? `${exposure}${minuteUnit}` : '--'}</div>
            <div className={`text-right text-[10px] tabular-nums ${goal > 0 ? 'text-[#bbf7d0]' : 'text-[#86efac]/35'}`}>{dataAvailable ? goalLabel : '--'}</div>
            <div aria-hidden="true" />
        </button>
    );
}

export default function MatrixTargetRegistry({
    targets,
    ruleDomains = null,
    siteRegistry = null,
    siteIntels = {},
    scoreSetupDraftsByDomain = {},
    scoreSetupMinDays = 3,
    pendingRelease = null,
    selectedDomain,
    onSelect,
    totalCount,
    pager,
    labels,
    showHeader = true,
    showListHeader = true,
}) {
    const { t } = useAppTranslation('sites');
    const safeTargets = Array.isArray(targets) ? targets : [];
    const safeLabels = labels || {};
    const countLabel = Number.isFinite(totalCount) ? totalCount : safeTargets.length;
    const diagnosticsByDomain = useMemo(
        () => buildSiteRuleDiagnostics(ruleDomains || safeTargets),
        [ruleDomains, safeTargets]
    );

    useEffect(() => {
        if (!selectedDomain) return;
        const element = document.getElementById(`target-item-${selectedDomain}`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [selectedDomain, safeTargets]);

    return (
        <div className="flex h-full min-h-0 flex-col overflow-hidden border border-[#14532d] bg-black/40 font-mono">
            {showHeader ? (
                <div className="flex items-center justify-between border-b border-[#14532d] px-3 py-2">
                    <UiHeader className="text-[10px] uppercase tracking-[0.16em] text-[#86efac]">{safeLabels.title}</UiHeader>
                    <UiHeader variant="label" className="text-[10px] uppercase tracking-[0.14em] text-[#6ee7b7]/70">
                        {safeLabels.countPrefix}: {countLabel}
                    </UiHeader>
                </div>
            ) : null}

            {showListHeader ? (
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-[#14532d]/70 px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-[#86efac]/70">
                    <span>{safeLabels.domainHeader}</span>
                    <div className="flex items-center gap-5">
                        <span>{safeLabels.expHeader}</span>
                        <span>{safeLabels.limitHeader}</span>
                    </div>
                </div>
            ) : null}

            <Panel variant="sunken" className="relative flex-1 overflow-y-auto border-0 bg-transparent p-0">
                {safeTargets.length === 0 ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-[#86efac]/35">
                        <div className="mb-1 text-2xl">[]</div>
                        <div className="text-[10px] uppercase tracking-[0.14em]">{safeLabels.emptyLabel}</div>
                    </div>
                ) : (
                    safeTargets.map((domain) => {
                        const registryEntry = siteRegistry?.byDomain?.[domain] || null;
                        const protectionBudget = registryEntry?.protectionBudget || null;
                        const dataAvailable = Boolean(registryEntry && protectionBudget);
                        const goalMinutes = dataAvailable
                            ? Math.max(0, Math.round(Number(protectionBudget.goalMinutes) || 0))
                            : 0;
                        const exposureMinutes = dataAvailable
                            ? Math.round(Math.max(0, Number(protectionBudget.chargedMs) || 0) / 60000)
                            : 0;
                        const observedMinutes = registryEntry
                            ? Math.round(Math.max(0, Number(registryEntry.usage?.observedMs) || 0) / 60000)
                            : 0;
                        const scoreSetupDraft = goalMinutes > 0 ? null : scoreSetupDraftsByDomain?.[domain] || null;
                        const registryStatus = buildSitePullRegistryStatus({
                            intel: siteIntels?.[domain] || null,
                            goalMinutes,
                            exposureMinutes,
                            scoreSetupDraft,
                            scoreSetupMinDays,
                            t,
                        });

                        return (
                            <TargetEntry
                                key={domain}
                                domain={domain}
                                badges={getSiteRuleBadgeItems(domain, diagnosticsByDomain)}
                                exposure={exposureMinutes}
                                observed={observedMinutes}
                                goal={goalMinutes}
                                registryStatus={registryStatus}
                                dataAvailable={dataAvailable}
                                pendingLabel={pendingRelease?.domain === domain
                                    ? t('release.row_pending', { seconds: pendingRelease.remainingSeconds })
                                    : ''}
                                onSelect={onSelect}
                                isSelected={selectedDomain === domain}
                            />
                        );
                    })
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
