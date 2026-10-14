import React from 'react';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { GLOBAL_GOAL_MAX_MINUTES } from '@/domains/settings/config/siteRules.js';
import { buildSitesGlobalCapViewModel, requireGlobalGoalMinutes, requireSitesGlobalCapVariant, SITES_GLOBAL_CAP_VARIANTS } from './sitesGlobalCapModel.js';
import { useSitesGlobalCapEditor } from './useSitesGlobalCapEditor.js';
import SitesCapControl from './SitesCapControl.jsx';
import { requireSitesRecordingPolicy } from '@/domains/stats/contracts/sitesRecordingContracts.js';
import { requireSitesCapAdmissionStatus, requireSitesCapMutationAdmission } from './sitesCapAdmission.js';

function formatMinutes(ms, t) {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes}${t('standard_panel.minute_suffix')}`;
  const hours = t('units.hour_short', { count: Math.floor(minutes / 60) });
  return minutes % 60 ? `${hours} ${minutes % 60}${t('standard_panel.minute_suffix')}` : hours;
}

export default function SitesHud({ variant = SITES_GLOBAL_CAP_VARIANTS.STANDARD, totalExposure,
  globalExposureAverage, globalGoal, onGlobalGoalChange, recording, admissionStatus, isRuntimeActive = true, compact = false, presentationState, showAdmissionFeedback = true,
  presentation = 'inline', isPresented = true, onRequestClose, navigationRef = null }) {
  const { t } = useAppTranslation('sites');
  requireSitesCapAdmissionStatus(admissionStatus);
  const admissionReady = admissionStatus === 'ready';
  if (admissionReady) requireSitesRecordingPolicy(recording);
  const goalMinutes = requireGlobalGoalMinutes(globalGoal);
  const resolvedVariant = requireSitesGlobalCapVariant(variant);
  const editor = useSitesGlobalCapEditor({ goalMinutes, onGlobalGoalChange: async (minutes) => {
    requireSitesCapMutationAdmission(admissionStatus, recording?.globalCapAvailable);
    if (typeof onGlobalGoalChange !== 'function') throw new Error('SITES_GLOBAL_GOAL_CHANGE_HANDLER_REQUIRED');
    return onGlobalGoalChange(minutes);
  }, isRuntimeActive: isRuntimeActive && isPresented, presentationState, saveErrorMessage: t('sites_hud.save_error') });
  const visualGoal = editor.isEditing && editor.isDraftValid ? editor.draftGoalMinutes : goalMinutes;
  const model = admissionReady ? buildSitesGlobalCapViewModel({ totalExposure, globalExposureAverage, goalMinutes: visualGoal }) : null;
  const formatDuration = (ms) => formatMinutes(ms, t);
  const average = model?.average;
  const difference = !admissionReady || average.averageMs === null ? null : visualGoal - Math.round(average.averageMs / 60000);
  const comparison = !visualGoal || difference === null ? '' : difference === 0 ? t('sites_hud.average_equal')
    : t(difference < 0 ? 'sites_hud.average_lower' : 'sites_hud.average_higher', { value: formatDuration(Math.abs(difference) * 60000) });
  return <SitesCapControl data-sites-hud variant={resolvedVariant} editor={editor} isRuntimeActive={isRuntimeActive} admissionStatus={admissionStatus}
    presentation={presentation} isPresented={isPresented} onRequestClose={onRequestClose} navigationRef={navigationRef}
    showAdmissionFeedback={showAdmissionFeedback}
    title={t('sites_hud.edit')} scope={t(admissionReady && recording.excludedProtectedCount > 0 ? 'recording.global_partial_scope' : compact ? 'zen_minimal.global_limit' : 'sites_cap.global_scope')} limitLabel={t('sites_hud.limit_label')}
    unavailableMessage={admissionReady && !recording.globalCapAvailable ? t('recording.cap_unavailable') : ''}
    hint={admissionReady && recording.excludedProtectedCount > 0 ? t('recording.global_exclusions', { count: recording.excludedProtectedCount }) : ''}
    committedLabel={goalMinutes ? compact ? formatDuration(goalMinutes * 60000) : t('sites_cap.per_day', { value: formatDuration(goalMinutes * 60000) }) : t('sites_hud.safety_off')}
    goalMinutes={visualGoal} maxMinutes={GLOBAL_GOAL_MAX_MINUTES}
    zeroLabel={t('sites_hud.safety_off')} formatDuration={formatDuration} t={t}
    evidence={admissionReady && recording.effectiveScope !== 'off' && <div className="sites-cap-editor__evidence">
      <div className="sites-cap-editor__average"><span>{t('sites_cap.protected_average')}</span>
        <strong>{average.averageMs === null ? t('sites_hud.average_collecting') : formatDuration(average.averageMs)}</strong></div>
      <div className="sites-cap-editor__comparison"><span>{comparison}</span>
        <span>{t('sites_hud.average_evidence', { observed: average.observedDayCount, window: average.windowDayCount })}</span></div>
      <details className="sites-cap-editor__details"><summary>{t('sites_cap.calculation_details')}</summary>
        <dl><dt>{t('sites_hud.period_label')}</dt><dd>{average.windowStartDateStr} — {average.windowEndDateStr}</dd>
          <dt>{t('sites_hud.reset_label')}</dt><dd>{String(average.resetHour).padStart(2, '0')}:00</dd>
          <dt>{t('sites_hud.current_activity_label')}</dt><dd>{formatDuration(model.usedMs)}</dd></dl>
        <p>{t('sites_hud.average_method')}</p>
      </details>
    </div>} />;
}
