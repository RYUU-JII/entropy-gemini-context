import React, { useEffect, useState } from 'react';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { useAnalysisStore } from '@/apps/dashboard/stores/useAnalysisStore.js';
import { useRuntimeParkedStoreSlice } from '@/apps/dashboard/hooks/useRuntimeParkedStoreSlice.js';
import { SettingsActionButton, SettingsFeedback, SettingsGroup, SettingsRow, SettingsSelect } from './SettingsControlPrimitives.jsx';

const selectCycleSettings = (state) => ({
  cycleState: state.cycleState,
  cycleError: state.cycleError,
  setResetHour: state.setResetHour,
  acceptResetRecommendation: state.acceptResetRecommendation,
  dismissResetRecommendation: state.dismissResetRecommendation,
});
const formatHour = (hour) => `${String(hour).padStart(2, '0')}:00`;

export function DailyRhythmPanel({ isRuntimeActive }) {
  const { t, i18n } = useAppTranslation('settings');
  const { cycleState, cycleError, setResetHour, acceptResetRecommendation, dismissResetRecommendation } = useRuntimeParkedStoreSlice(
    useAnalysisStore, selectCycleSettings, isRuntimeActive,
  );
  const policy = cycleState?.resetPolicy;
  const savedHour = policy?.pending ? policy.pending.nextHour : policy?.effectiveResetHour;
  const [draftHour, setDraftHour] = useState(savedHour);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setDraftHour(savedHour); }, [savedHour]);

  const runAction = async (action) => {
    setBusy(true);
    setFailed(false);
    try {
      if (await action() !== true) setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  const ready = policy && Number.isInteger(policy.effectiveResetHour);
  const recommendation = ready && !policy.pending && policy.recommendation?.candidateHour !== policy.effectiveResetHour
    ? policy.recommendation : null;

  return (
    <SettingsGroup title={t('daily_rhythm.title')}>
      {ready ? <>
        <SettingsRow
          title={t('daily_rhythm.start_label')}
          description={t('daily_rhythm.current', { hour: formatHour(policy.effectiveResetHour) })}
          meta={draftHour !== savedHour ? t('daily_rhythm.change_timing') : ''}
        >
          <div className="flex items-center gap-4">
            <SettingsSelect
              aria-label={t('daily_rhythm.start_label')}
              value={draftHour}
              disabled={busy || !isRuntimeActive}
              onChange={(event) => setDraftHour(Number(event.target.value))}
            >
              {Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>
                {formatHour(hour)}{hour === 4 ? ` · ${t('daily_rhythm.default')}` : ''}
              </option>)}
            </SettingsSelect>
            <SettingsActionButton
              disabled={busy || !isRuntimeActive || draftHour === savedHour}
              onClick={() => runAction(() => setResetHour(draftHour))}
            >{t('daily_rhythm.save')}</SettingsActionButton>
          </div>
        </SettingsRow>
        {policy.pending ? <SettingsFeedback message={t('daily_rhythm.pending', {
          hour: formatHour(policy.pending.nextHour),
          date: new Intl.DateTimeFormat(i18n.language, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(policy.pending.applyAt),
        })} /> : null}
        {recommendation ? <SettingsRow
          title={t('daily_rhythm.recommendation_title', { hour: formatHour(recommendation.candidateHour) })}
          description={t('daily_rhythm.recommendation_desc', { days: recommendation.basedOnDays })}
        >
          <div className="flex items-center gap-4">
            <SettingsActionButton disabled={busy || !isRuntimeActive} onClick={() => runAction(acceptResetRecommendation)}>
              {t('daily_rhythm.accept')}
            </SettingsActionButton>
            <SettingsActionButton disabled={busy || !isRuntimeActive} onClick={() => runAction(dismissResetRecommendation)}>
              {t('daily_rhythm.dismiss')}
            </SettingsActionButton>
          </div>
        </SettingsRow> : null}
      </> : null}
      <SettingsFeedback message={failed || cycleError || !ready ? t('daily_rhythm.error') : ''} tone="danger" />
    </SettingsGroup>
  );
}
