import React from 'react';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import {
  DATA_COLLECTION_MODES,
  PRECISION_INSIGHTS_MODES,
  PRECISION_INSIGHTS_SIGNAL_IDS,
} from '../../../../../domains/settings/config/dataCollectionPolicy.js';
import { SettingsRow, SettingsSelect, SettingsSwitch } from './SettingsControlPrimitives.jsx';
import { GuidanceAnchor } from '@/apps/dashboard/guidance/DashboardGuidanceProvider.jsx';

export function UsageScopeControl({ value, onChange, disabled = false }) {
  const { t } = useAppTranslation('settings');
  return (
    <GuidanceAnchor guideId="settings.recording_scope" copyKey="guides.settings_recording_scope" enabled={!disabled}>
    <SettingsRow title={t('recording.scope_title')} description={t('recording.scope_desc')}>
      <SettingsSelect aria-label={t('recording.scope_title')} value={value}
        disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        <option value={DATA_COLLECTION_MODES.OFF}>{t('recording.scope_off')}</option>
        <option value={DATA_COLLECTION_MODES.PROTECTED_SITES}>{t('recording.scope_protected')}</option>
        <option value={DATA_COLLECTION_MODES.ALL_SITES_MINIMAL}>{t('recording.scope_all')}</option>
      </SettingsSelect>
    </SettingsRow>
    </GuidanceAnchor>
  );
}

// These controls govern recorded history. Functional observation belongs to the
// selected artifacts; neither label nor switch claims to disable their sensors.
export function FlowHistoryControls({ policy, onChange, disabled = false }) {
  const { t } = useAppTranslation('settings');
  const recordsOff = policy.dataCollectionMode === DATA_COLLECTION_MODES.OFF;
  const flowSelected = policy.precisionInsightsMode !== PRECISION_INSIGHTS_MODES.OFF;
  const signals = [
    { id: PRECISION_INSIGHTS_SIGNAL_IDS.CLSE, title: t('recording.signals.clse.title'), description: t('recording.signals.clse.desc') },
    { id: PRECISION_INSIGHTS_SIGNAL_IDS.NAVIGATION, title: t('recording.signals.navigation.title'), description: t('recording.signals.navigation.desc') },
  ];
  return (
    <div className="divide-y divide-border/20">
      <SettingsRow layout="inline" title={t('recording.flow_title')}
        description={t(recordsOff ? 'recording.flow_paused' : 'recording.flow_desc')}>
        <SettingsSwitch label={t('recording.flow_title')} checked={flowSelected}
          disabled={disabled || recordsOff}
          onCheckedChange={(enabled) => onChange({
            ...policy,
            precisionInsightsMode: enabled ? PRECISION_INSIGHTS_MODES.PROTECTED_SITES : PRECISION_INSIGHTS_MODES.OFF,
          })} />
      </SettingsRow>
      {signals.map(({ id: signalId, title, description }) => (
        <SettingsRow key={signalId} layout="inline" title={title} description={description}>
          <SettingsSwitch label={title}
            checked={policy.precisionInsightsSignals[signalId]}
            disabled={disabled || recordsOff || !flowSelected}
            onCheckedChange={(enabled) => onChange({
              ...policy,
              precisionInsightsSignals: { ...policy.precisionInsightsSignals, [signalId]: enabled },
            })} />
        </SettingsRow>
      ))}
    </div>
  );
}
