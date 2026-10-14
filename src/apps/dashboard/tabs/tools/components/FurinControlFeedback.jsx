import React, { useState } from 'react';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { useDashboardGuidance } from '@/apps/dashboard/guidance/DashboardGuidanceProvider.jsx';
import FurinInstallationReceipt from '@/apps/dashboard/guidance/FurinInstallationReceipt.jsx';
import { requireFurinTimeAvailability } from '@/apps/dashboard/utils/furinTimeAvailability.js';
import ArtifactApplicationFeedback from './ArtifactApplicationFeedback.jsx';
import { requireNudgeGoalEnds } from '@/domains/settings/config/nudgeConfig.js';

export function FurinTemporaryPauseControl({ enabled, suspended, globallyPaused, setSuspended }) {
  const { t } = useAppTranslation('tools');
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!enabled && !suspended) return null;
  if (typeof setSuspended !== 'function') throw new Error('FURIN_TEMPORARY_PAUSE_OWNER_REQUIRED');
  const commit = async () => {
    setPending(true);
    setFailed(false);
    try {
      const result = await setSuspended(!suspended);
      if (result?.error) throw result.error;
    } catch { setFailed(true); }
    finally { setPending(false); }
  };
  return <div className="mt-3">
    <button type="button" onClick={commit} disabled={pending || globallyPaused} aria-busy={pending}
      title={globallyPaused ? t('artifacts.sentinel_flare.control_status.global_pause_hint') : undefined}
      className="rounded-lg border border-border/40 px-3 py-2 text-[11px] text-on-surface disabled:opacity-50">
      {suspended ? t('artifacts.sentinel_flare.control_status.temporary_resume') : t('artifacts.sentinel_flare.control_status.temporary_pause')}
    </button>
    {failed ? <p className="mt-2 text-[11px] text-danger" role="alert">{t('artifacts.sentinel_flare.control_status.temporary_pause_error')}</p> : null}
  </div>;
}

export default function FurinControlFeedback({ enabled, goalEnds, paused, timeAvailability, applicationStatus, handlers }) {
  const { t } = useAppTranslation('tools');
  const guidance = useDashboardGuidance();
  const available = requireFurinTimeAvailability(timeAvailability);
  requireNudgeGoalEnds(goalEnds);
  if (enabled !== (goalEnds.site || goalEnds.global)) throw new Error('FURIN_GOAL_END_POLICY_PROJECTION_MISMATCH');
  const reason = !enabled ? 'off' : paused ? 'paused' : available.reason;
  const sitesAction = ['no_sites', 'unconfigured'].includes(reason);
  const recordingAction = ['mode_off', 'consent_required'].includes(reason);
  const exclusionsAction = reason === 'excluded';
  const action = sitesAction ? 'open_sites' : recordingAction ? 'open_recording'
    : exclusionsAction ? 'open_exclusions' : null;
  const applicationBlocked = enabled && !paused && applicationStatus?.action;

  return <FurinInstallationReceipt enabled={guidance?.activeTabId === 'tools'}>
    <p className="mt-2" data-furin-goal-policy>
      {t('artifacts.sentinel_flare.control_status.site_policy', { state: goalEnds.site ? t('artifact_altar.on') : t('artifact_altar.off') })}
      {' · '}{t('artifacts.sentinel_flare.control_status.global_policy', { state: goalEnds.global ? t('artifact_altar.on') : t('artifact_altar.off') })}
    </p>
    <div className="flex min-h-[2.75em] flex-wrap items-baseline gap-x-3 gap-y-1" data-furin-time-state={reason}>
      {applicationBlocked ? <span><span>{applicationStatus.text}</span>{' '}
        <ArtifactApplicationFeedback status={applicationStatus} handlers={handlers} /></span> : <><span>{t(`artifacts.sentinel_flare.control_status.${reason}`, {
        minutes: available.globalTargetMinutes, count: available.siteTargetCount,
      })}</span>
      {action && guidance?.navigate && <button type="button" className="shrink-0 text-accent underline underline-offset-4"
        onClick={() => guidance.navigate(sitesAction ? 'sites' : 'settings', sitesAction ? undefined
          : { section: 'permissions', ...(exclusionsAction ? { focus: 'recording-exclusions' } : {}) })}>
        {t(`artifacts.sentinel_flare.control_status.${action}`)}
      </button>}</>}
    </div>
    {guidance?.navigate && <button type="button" className="mt-2 text-accent underline underline-offset-4"
      onClick={() => guidance.navigate('settings', { section: 'protection' })}>
      {t('artifacts.sentinel_flare.control_status.open_policy')}
    </button>}
  </FurinInstallationReceipt>;
}
