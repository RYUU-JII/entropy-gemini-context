import React from 'react';

export function formatZenBudgetDuration(ms, t) {
  if (ms > 0 && ms < 60_000) return t('zen_minimal.less_than_minute');
  const minutes = Math.floor(ms / 60_000);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? t('units.hour_short', { count: hours }) + (rest ? ` ${rest}${t('standard_panel.minute_suffix')}` : '')
    : `${minutes}${t('standard_panel.minute_suffix')}`;
}

export default function ZenSiteBudgetNote({ entry, goalMinutes, t }) {
  if (!entry || entry.type !== 'blocked' || !entry.recording.enabled || !entry.capAvailability.available) return null;
  const budget = entry.protectionBudget;
  if (!budget || budget.basis !== 'activity-day-charged' || !Number.isFinite(budget.goalMs)
    || !Number.isFinite(budget.chargedMs) || budget.chargedMs < 0) throw new Error('ZEN_SITE_PROTECTION_BUDGET_INVALID');
  // Do not compare the previous snapshot's budget with a newly committed setting.
  if (budget.goalMs === 0 || budget.goalMinutes !== goalMinutes) return null;
  if (!Number.isFinite(budget.remainingMs) || budget.remainingMs < 0 || !Number.isFinite(budget.overMs) || budget.overMs < 0) {
    throw new Error('ZEN_SITE_PROTECTION_REMAINING_INVALID');
  }
  const status = budget.overMs > 0 ? 'exceeded' : budget.remainingMs > 0 ? 'remaining' : 'reached';
  const value = formatZenBudgetDuration(status === 'exceeded' ? budget.overMs : budget.remainingMs, t);
  return <div className="zen-site-budget-note" data-state={status}>
    <p>{t(`zen_minimal.${status}`, { value })}</p>
    {entry.usage.observedMs !== budget.chargedMs && <small>{t('zen_minimal.charged', { value: formatZenBudgetDuration(budget.chargedMs, t) })}</small>}
  </div>;
}
