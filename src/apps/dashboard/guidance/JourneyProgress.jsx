import React, { useContext, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useProtocolStore } from '@/apps/dashboard/stores/index.js';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { PROGRESSION_JOURNEY_STAGES } from '@/domains/progression/policy/progressionJourneyPolicy.js';
import { useDashboardGuidance, useGuidanceAnchor, useGuidancePresenter, GuidanceSupport } from './DashboardGuidanceProvider.jsx';
import { useInlineGuidanceReceipt } from './useInlineGuidanceReceipt.js';
import { JourneyProgressDockContext } from './JourneyProgressDockContext.js';

function JourneyNotificationStatus({ onSettings }) {
  const { t } = useAppTranslation('guidance');
  const { journeyEnabled } = useProtocolStore(useShallow((store) => ({ journeyEnabled: store.notificationsConfig.journey.enabled })));
  return <p className="mt-3 border-t border-border/25 pt-3 text-on-surface-muted">
    {t(journeyEnabled ? 'notifications.enabled' : 'notifications.disabled')}
    <button type="button" onClick={onSettings} className="ml-2 text-accent underline underline-offset-4">{t('notifications.settings')}</button>
  </p>;
}

export default function JourneyProgress({ developmentHud = false }) {
  const { t } = useAppTranslation('guidance');
  const guidance = useDashboardGuidance();
  const state = guidance?.state;
  const dockAvailable = useContext(JourneyProgressDockContext);
  const visible = Boolean(state?.firstVisionSpent && (developmentHud
    ? state.preview
    : !(state.preview && dockAvailable)));
  const summaryRef = useRef(null);
  const revealedStageRef = useRef(null);
  if (state?.stageChange) revealedStageRef.current = state.stageChange;
  const revealedStage = revealedStageRef.current?.day === state?.journeyDay ? revealedStageRef.current : null;
  useGuidanceAnchor({ guideId: 'journey.stage_change', elementRef: summaryRef, presentation: 'anchor',
    enabled: visible && Boolean(state.stageChange) });
  const presenter = useGuidancePresenter('journey.stage_change');
  useInlineGuidanceReceipt(visible ? presenter : null, summaryRef);
  if (!visible) return null;
  const day = state.journeyDay;
  const nextFamilyIds = state.nextStage?.newFamilyIds;
  return <details open={developmentHud ? true : undefined} className="journey-progress max-w-sm rounded-lg border border-border/30 bg-surface/85 text-on-surface shadow-sm backdrop-blur">
    <summary ref={summaryRef} className="cursor-pointer px-3 py-2 text-[11px] font-medium">
      {t(state.preview ? 'journey.preview_label' : 'journey.label', { day, target: state.journeyTargetDayCount })}
      {revealedStage && <span className="ml-2 text-accent">
        {t('journey.newly_opened', { family: revealedStage.newFamilyIds.map((family) => t(`families.${family}`)).join(' · ') })}
      </span>}
      {nextFamilyIds?.length > 0 && <span className="ml-2 font-normal text-on-surface-muted">
        {t('journey.next', { family: nextFamilyIds.map((family) => t(`families.${family}`)).join(' · ') })}
      </span>}
    </summary>
    <div className="journey-progress__body px-4 pb-4 text-xs">
      {state.preview && <p className="mb-2 leading-relaxed text-accent">{t('journey.preview_detail', {
        effective: state.qualifiedUseFacts.effectiveDayCount, canonical: state.qualifiedUseFacts.canonicalDayCount,
      })}</p>}
      <p className="max-w-[260px] leading-relaxed text-on-surface-muted">{t('journey.description')}</p>
      <ol className="mt-3 space-y-2">
        {PROGRESSION_JOURNEY_STAGES.filter((stage) => stage.newFamilyIds.length > 0).map((stage) => <li key={stage.qualifiedUseDayCount} className="flex gap-3">
          <span className="shrink-0 text-on-surface-muted">{t(stage.qualifiedUseDayCount === 0 ? 'journey.starter' : 'journey.day', { day: stage.qualifiedUseDayCount })}</span>
          <span className={stage.qualifiedUseDayCount <= day ? 'text-accent' : 'text-on-surface-muted'}>
            {stage.newFamilyIds.map((family) => t(`families.${family}`)).join(' · ')}
          </span>
        </li>)}
      </ol>
      {state.siteRegistrationBudget?.mode === 'unlimited' && <p className="mt-3 text-accent">{t('journey.unlimited')}</p>}
      <JourneyNotificationStatus onSettings={() => guidance.navigate('settings', { section: 'notifications' })} />
      <GuidanceSupport />
    </div>
  </details>;
}
