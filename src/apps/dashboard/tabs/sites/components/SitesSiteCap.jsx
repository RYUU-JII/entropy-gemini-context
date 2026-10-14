import React, { useState } from 'react';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { resolveSiteGoalChange } from '@/domains/settings/config/siteGoalPolicy.js';
import { useSitesCapEditor } from './useSitesCapEditor.js';
import SitesCapControl from './SitesCapControl.jsx';
import { requireSitesCapAvailability } from '@/domains/stats/contracts/sitesRecordingContracts.js';
import { requireSitesCapAdmissionStatus, requireSitesCapMutationAdmission } from './sitesCapAdmission.js';

const normalizeMinutes = (value) => Math.max(0, Math.floor(Number(value)));
const formatDuration = (ms, t) => {
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes}${t('standard_panel.minute_suffix')}`;
  return t('units.hour_short', { count: Math.floor(minutes / 60) }) + (minutes % 60 ? ` ${minutes % 60}${t('standard_panel.minute_suffix')}` : '');
};

function SiteCapEditor({ domain, type, goalMinutes, onGoalChange, capAvailability, admissionStatus, isRuntimeActive, minimal = false, recommendation = null, onDismissRecommendation, presentationState, showAdmissionFeedback = true, presentation = 'inline', navigationRef = null }) {
  const { t } = useAppTranslation('sites');
  const [savedHint, setSavedHint] = useState('');
  const enabled = Boolean(domain) && type === 'blocked';
  requireSitesCapAdmissionStatus(admissionStatus);
  const admissionReady = admissionStatus === 'ready';
  if (enabled && admissionReady) requireSitesCapAvailability(capAvailability);
  const editor = useSitesCapEditor({
    goalMinutes, normalizeGoal: normalizeMinutes, isRuntimeActive, presentationState,
    saveErrorMessage: t('site_workspace.goal_save_error'),
    onSave: async (minutes) => {
      requireSitesCapMutationAdmission(admissionStatus, enabled && capAvailability?.available);
      if (typeof onGoalChange !== 'function') throw new Error('SITES_SITE_GOAL_CHANGE_HANDLER_REQUIRED');
      const result = await onGoalChange(domain, minutes);
      if (result?.ok !== true || !Number.isFinite(result.appliedMinutes)) throw new Error('SITES_SITE_GOAL_SAVE_FAILED');
      setSavedHint(result.capped ? t('target_panel.goal_increase_cap_notice', { cap: result.capMinutes, requested: result.requestedMinutes, applied: result.appliedMinutes }) : '');
      return result.appliedMinutes;
    },
  });
  const updateDraftGoal = (value) => {
    if (editor.isLocked || !admissionReady || !capAvailability?.available) return;
    if (value === '') { setSavedHint(''); editor.updateDraftGoal(''); return; }
    const requestedMinutes = normalizeMinutes(value);
    if (!Number.isSafeInteger(requestedMinutes)) return;
    setSavedHint('');
    editor.updateDraftGoal(requestedMinutes);
  };
  const control = { ...editor, updateDraftGoal,
    handleGoalInputChange: (event) => { if (event.target.value === '' || /^\d+$/.test(event.target.value)) updateDraftGoal(event.target.value); },
    cancelEditing: () => { setSavedHint(''); editor.cancelEditing(); },
  };
  const preview = editor.isEditing && editor.isDraftValid && editor.savePhase !== 'success'
    ? resolveSiteGoalChange({ currentMinutes: goalMinutes, requestedMinutes: editor.draftGoalMinutes })
    : null;
  const visualGoal = editor.isEditing && editor.isDraftValid
    ? (preview ? preview.appliedMinutes : editor.draftGoalMinutes) : goalMinutes;
  const hint = preview?.capped
    ? t('target_panel.goal_increase_cap_notice', { cap: preview.capMinutes, requested: preview.requestedMinutes, applied: preview.appliedMinutes })
    : savedHint;
  const statusLabels = {
    blocked: t('target_protocol.status_blocked'), allowed: t('target_protocol.status_allowed'),
    tracked: t('target_protocol.status_tracked'), unmanaged: t('target_protocol.status_unmanaged'),
  };
  if (domain && !Object.hasOwn(statusLabels, type)) throw new Error('SITES_SITE_TYPE_INVALID');
  const statusLabel = !domain ? t('target_protocol.select_prompt') : statusLabels[type];
  return <SitesCapControl data-site-cap data-domain={domain} editor={control} enabled={enabled} policyLabel={statusLabel} admissionStatus={admissionStatus}
    showAdmissionFeedback={showAdmissionFeedback} presentation={presentation} navigationRef={navigationRef}
    unavailableMessage={enabled && admissionReady && !capAvailability.available ? t('recording.cap_unavailable') : ''}
    title={t('sites_cap.site_label', { domain })} scope={t(minimal ? 'zen_minimal.daily_limit' : 'sites_cap.site_title')} hint={hint} minimal={minimal}
    committedLabel={goalMinutes ? minimal ? formatDuration(goalMinutes * 60000, t) : t('sites_cap.per_day', { value: formatDuration(goalMinutes * 60000, t) }) : t('sites_cap.unset')}
    goalMinutes={visualGoal} recommendation={recommendation} onDismissRecommendation={onDismissRecommendation} zeroLabel={t('sites_cap.unset')} t={t}
    formatDuration={(ms) => formatDuration(ms, t)} limitLabel={t('sites_cap.site_limit_label')} isRuntimeActive={isRuntimeActive} />;
}

export default function SitesSiteCap({ domain = '', type = 'unmanaged', goalMinutes = 0, isRuntimeActive = true, ...props }) {
  if (!Number.isFinite(goalMinutes) || goalMinutes < 0) throw new Error('SITES_SITE_GOAL_REQUIRED');
  return <div className="sites-site-cap-note">
    <SiteCapEditor key={`${domain}:${type}`} domain={domain} type={type} goalMinutes={goalMinutes}
      isRuntimeActive={isRuntimeActive} {...props} />
  </div>;
}
