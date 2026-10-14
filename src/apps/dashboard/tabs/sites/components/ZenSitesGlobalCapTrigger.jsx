import React from 'react';
import { requireGlobalGoalMinutes } from './sitesGlobalCapModel.js';

export default function ZenSitesGlobalCapTrigger({ goalMinutes, inactive, onClick, t }) {
  const minutes = requireGlobalGoalMinutes(goalMinutes);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  const value = minutes === 0 ? t('sites_hud.safety_off') : hours === 0
    ? `${minutes}${t('standard_panel.minute_suffix')}`
    : `${t('units.hour_short', { count: hours })}${remainder ? ` ${remainder}${t('standard_panel.minute_suffix')}` : ''}`;
  return <button type="button" className="zen-sites-cap-trigger" data-sites-global-cap-trigger
    aria-label={`${t('sites_hud.edit')} · ${value}`} aria-expanded={false} aria-controls="zen-sites-global-cap"
    onClick={onClick}>
    <span>{t('zen_minimal.protected_combined')}</span><span>{value}</span>
    {inactive && <small>{t('recording.cap_inactive')}</small>}
  </button>;
}
