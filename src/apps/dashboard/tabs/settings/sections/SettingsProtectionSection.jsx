import React, { useEffect, useRef, useState } from 'react';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { useProtocolStore } from '@/apps/dashboard/stores/useProtocolStore.js';
import { useRuntimeParkedStoreSlice } from '@/apps/dashboard/hooks/useRuntimeParkedStoreSlice.js';
import { requireProtocolSyncSuccess } from '@/apps/dashboard/stores/protocolStoreHelpers.js';
import { requireCoolingCurve } from '@/domains/settings/config/coolingCurvePolicy.js';
import { requireNudgeGoalEnds } from '@/domains/settings/config/nudgeConfig.js';
import { requireArtifactControlState } from '@/domains/settings/config/artifactControlState.js';
import {
  SettingsActionButton, SettingsInlineChoice, SettingsDisclosure, SettingsFeedback,
  SettingsGroup, SettingsLedger, SettingsRow, SettingsSwitch,
} from '../components/SettingsControlPrimitives.jsx';

const selectProtectionSettings = state => ({
  coolingCurve: state.coolingCurve,
  nudgeConfig: state.nudgeConfig,
  artifactControlState: state.artifactControlState,
  setCoolingCurvePreset: state.setCoolingCurvePreset,
  setGoalEndEnabled: state.setGoalEndEnabled,
});

// Authored illustrations of the three presets, not a runtime progress readout.
const PRESET_ILLUSTRATIONS = Object.freeze({
  gentle: 'M12 88 H110 C156 88 186 48 226 18 H248',
  standard: 'M12 88 H64 C110 88 157 28 226 18 H248',
  steep: 'M12 88 H40 C77 88 102 25 165 18 H248',
});

function PresetIllustration({ preset, t }) {
  return <figure className="my-3 min-w-0 rounded-xl bg-on-surface/[0.025] px-5 py-4">
    <svg viewBox="0 0 260 108" preserveAspectRatio="none" className="h-28 w-full text-accent" role="img" aria-label={t('protection.curve.preview_label')}>
      <path d="M12 18 H248 M12 53 H248 M12 88 H248" fill="none" stroke="currentColor" opacity="0.1" />
      <path d="M248 12 V94" fill="none" stroke="currentColor" opacity="0.25" strokeDasharray="3 5" />
      <path d={PRESET_ILLUSTRATIONS[preset]} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
    <div className="flex justify-between text-[11px] text-on-surface-muted"><span>{t('protection.curve.start')}</span><span>{t('protection.curve.target')}</span></div>
    <figcaption className="mt-3 text-xs leading-relaxed text-on-surface-muted">{t('protection.curve.preview_note')}</figcaption>
  </figure>;
}

export default function SettingsProtectionSection({ isRuntimeActive, onNavigate, onOpenRecording }) {
  const { t } = useAppTranslation('settings');
  const state = useRuntimeParkedStoreSlice(useProtocolStore, selectProtectionSettings, isRuntimeActive);
  const curve = requireCoolingCurve(state.coolingCurve);
  const goalEnds = requireNudgeGoalEnds(state.nudgeConfig.goalEnds);
  const control = requireArtifactControlState(state.artifactControlState);
  const goalGuidancePaused = control.globalPaused || control.familySuspensions.flare;
  const activityRef = useRef(isRuntimeActive);
  const operationsRef = useRef({});
  const [operations, setOperations] = useState({});
  activityRef.current = isRuntimeActive;
  useEffect(() => {
    activityRef.current = isRuntimeActive;
    if (isRuntimeActive) setOperations({ ...operationsRef.current });
    return () => { activityRef.current = false; };
  }, [isRuntimeActive]);

  const commit = async (key, action) => {
    if (!activityRef.current || operationsRef.current[key]?.pending) return;
    const publish = outcome => {
      operationsRef.current = { ...operationsRef.current, [key]: outcome };
      if (activityRef.current) setOperations(operationsRef.current);
    };
    publish({ pending: true, failed: false });
    try {
      requireProtocolSyncSuccess(await action());
      publish({ pending: false, failed: false });
    } catch {
      publish({ pending: false, failed: true });
    }
  };
  const navigate = (tabId, params) => {
    if (!isRuntimeActive) return;
    if (typeof onNavigate !== 'function') throw new Error('SETTINGS_PROTECTION_NAVIGATION_OWNER_REQUIRED');
    onNavigate(tabId, params);
  };
  const openRecording = () => {
    if (!isRuntimeActive) return;
    if (typeof onOpenRecording !== 'function') throw new Error('SETTINGS_PROTECTION_RECORDING_NAVIGATION_REQUIRED');
    onOpenRecording();
  };
  const presetOptions = [
    { id: 'gentle', label: t('protection.curve.gentle'), description: t('protection.curve.gentle_desc') },
    { id: 'standard', label: t('protection.curve.standard'), description: t('protection.curve.standard_desc') },
    { id: 'steep', label: t('protection.curve.steep'), description: t('protection.curve.steep_desc') },
  ];
  const pending = key => operations[key]?.pending === true;
  const feedback = key => operations[key]?.failed ? t('protection.save_failed') : pending(key) ? t('protection.saving') : '';

  return <SettingsLedger>
    <SettingsGroup title={t('protection.curve.title')} description={t('protection.curve.description')}>
      {curve.advanced === null ? <PresetIllustration preset={curve.preset} t={t} />
        : <p className="py-3 text-xs leading-relaxed text-on-surface-muted" role="status">{t('protection.curve.custom')}</p>}
      <SettingsInlineChoice label={t('protection.curve.title')} value={curve.advanced === null ? curve.preset : null}
        options={presetOptions} disabled={!isRuntimeActive || pending('preset')}
        onValueChange={preset => commit('preset', () => state.setCoolingCurvePreset(preset))} />
      {curve.advanced === null ? <p className="mt-2 text-xs leading-relaxed text-on-surface-muted">{presetOptions.find(option => option.id === curve.preset).description}</p> : null}
      <SettingsFeedback message={feedback('preset')} tone={operations.preset?.failed ? 'danger' : 'neutral'} />
      <p className="mt-4 text-xs leading-relaxed text-on-surface-muted">{t('protection.curve.basis')}</p>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        <SettingsActionButton disabled={!isRuntimeActive} onClick={() => navigate('sites')}>{t('protection.links.sites')}</SettingsActionButton>
        <SettingsActionButton disabled={!isRuntimeActive} onClick={() => navigate('tools')}>{t('protection.links.tools')}</SettingsActionButton>
        <SettingsActionButton disabled={!isRuntimeActive} onClick={openRecording}>{t('protection.links.recording')}</SettingsActionButton>
      </div>
    </SettingsGroup>

    <SettingsGroup title={t('protection.goal_ends.title')} description={t('protection.goal_ends.description')}>
      <SettingsRow title={t('protection.goal_ends.site')} description={t('protection.goal_ends.site_desc')}>
        <SettingsSwitch checked={goalEnds.site} label={t('protection.goal_ends.site')} disabled={!isRuntimeActive || pending('site')}
          onCheckedChange={enabled => commit('site', () => state.setGoalEndEnabled('site', enabled))} />
      </SettingsRow>
      <SettingsFeedback message={feedback('site')} tone={operations.site?.failed ? 'danger' : 'neutral'} />
      <SettingsRow title={t('protection.goal_ends.global')} description={t('protection.goal_ends.global_desc')}>
        <SettingsSwitch checked={goalEnds.global} label={t('protection.goal_ends.global')} disabled={!isRuntimeActive || pending('global')}
          onCheckedChange={enabled => commit('global', () => state.setGoalEndEnabled('global', enabled))} />
      </SettingsRow>
      <SettingsFeedback message={feedback('global')} tone={operations.global?.failed ? 'danger' : 'neutral'} />
      {goalGuidancePaused && (goalEnds.site || goalEnds.global) ? <SettingsFeedback message={t('protection.goal_ends.paused')} tone="warning" /> : null}
      <p className="mt-4 text-xs leading-relaxed text-on-surface-muted">{t('protection.goal_ends.presentation')}</p>
      <SettingsDisclosure title={t('protection.principles.title')}>
        <ul className="space-y-3 pl-4 text-xs leading-relaxed text-on-surface-muted list-disc">
          <li>{t('protection.principles.boundary')}</li>
          <li>{t('protection.principles.priority')}</li>
          <li>{t('protection.principles.edits')}</li>
        </ul>
        <p className="mt-4 text-xs leading-relaxed text-on-surface-muted">{t('protection.principles.periodic')}</p>
        <SettingsActionButton disabled={!isRuntimeActive} className="mt-3" onClick={() => navigate('tools', { artifactId: 'barrier' })}>{t('protection.links.barrier')}</SettingsActionButton>
      </SettingsDisclosure>
    </SettingsGroup>
  </SettingsLedger>;
}
