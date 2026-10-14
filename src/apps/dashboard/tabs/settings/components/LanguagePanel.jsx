import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { usePreferenceStore } from '../../../stores/usePreferenceStore.js';
import {
  SOLAR_LOCATION_MODES,
  SOLAR_LOCATION_PRESETS,
  SOLAR_LOCATION_WORLD_IDS,
  normalizeSolarLocationProfile,
  resolveSolarCoordinatesFromProfile,
} from '../../../../../domains/settings/config/solarLocation.js';
import {
  SettingsChoiceGroup,
  SettingsFeedback,
  SettingsGroup,
  SettingsInlineChoice,
  SettingsRow,
  SettingsSelect,
} from './SettingsControlPrimitives.jsx';

const FIXED_MODE = 'fixed';
const CURRENT_FIXED_SELECTION = 'current_fixed';
const REGION_PRESETS = SOLAR_LOCATION_PRESETS.filter((preset) => (
  preset.worldId === SOLAR_LOCATION_WORLD_IDS.ZEN_POND
));

const LANGUAGES = [
  { code: 'en', labelKey: 'language.en_short' },
  { code: 'ko', labelKey: 'language.ko_short' },
];

function describeLanguageActionError(error, fallbackCode) {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  const message = String(error || '').trim();
  return message || fallbackCode;
}

function requireSolarLocationHandler(handler) {
  if (typeof handler !== 'function') {
    throw new Error('LANGUAGE_REGION_SOLAR_HANDLER_REQUIRED');
  }
  return handler;
}

function resolvePresetLabel(t, presetId, fallbackLabel = '') {
  switch (presetId) {
    case 'seoul_kr': return t('solar_location.presets.seoul_kr');
    case 'tokyo_jp': return t('solar_location.presets.tokyo_jp');
    case 'los_angeles_us': return t('solar_location.presets.los_angeles_us');
    case 'new_york_us': return t('solar_location.presets.new_york_us');
    case 'london_gb': return t('solar_location.presets.london_gb');
    case 'sydney_au': return t('solar_location.presets.sydney_au');
    case 'somewhere_in_space': return t('solar_location.preset_somewhere_in_space');
    default: return fallbackLabel;
  }
}

export function LanguagePanel({
  solarLocationProfile,
  onSaveSolarLocation,
  solarStatusMessage = '',
}) {
  const { t, i18n } = useAppTranslation('settings');
  const setLanguage = usePreferenceStore((state) => state.setLanguage);
  const [languageStatus, setLanguageStatus] = useState('');
  const [solarActionStatus, setSolarActionStatus] = useState('');
  const [draftMode, setDraftMode] = useState(SOLAR_LOCATION_MODES.AUTO);
  const [draftPresetId, setDraftPresetId] = useState('');
  const solarPendingRef = useRef(false);
  const [solarSaveBusy, setSolarSaveBusy] = useState(false);
  const currentLang = i18n.language.split('-')[0];
  const saveSolarLocation = requireSolarLocationHandler(onSaveSolarLocation);

  const normalizedSolarProfile = useMemo(
    () => normalizeSolarLocationProfile(solarLocationProfile),
    [solarLocationProfile],
  );
  const resolvedSolarReference = useMemo(
    () => resolveSolarCoordinatesFromProfile(normalizedSolarProfile),
    [normalizedSolarProfile],
  );
  const hasRetainedFixedReference = normalizedSolarProfile.mode === SOLAR_LOCATION_MODES.MANUAL
    || (
      normalizedSolarProfile.mode === SOLAR_LOCATION_MODES.PRESET
      && !REGION_PRESETS.some((preset) => preset.id === normalizedSolarProfile.presetId)
    );
  const currentReferenceLabel = normalizedSolarProfile.mode === SOLAR_LOCATION_MODES.AUTO
    ? resolvePresetLabel(
      t,
      resolvedSolarReference.presetId,
      resolvedSolarReference.label || t('solar_location.device_reference'),
    )
    : normalizedSolarProfile.mode === SOLAR_LOCATION_MODES.MANUAL
      ? normalizedSolarProfile.label
      : resolvePresetLabel(
        t,
        normalizedSolarProfile.presetId,
        normalizedSolarProfile.label || t('solar_location.device_reference'),
      );
  const currentReferenceSummary = normalizedSolarProfile.mode === SOLAR_LOCATION_MODES.AUTO
    ? t('solar_location.current_auto', { location: currentReferenceLabel })
    : t('solar_location.current_fixed', { location: currentReferenceLabel });
  const visibleSolarStatusMessage = solarActionStatus || solarStatusMessage;

  const handleLanguageChange = useCallback(async (code) => {
    try {
      const committedLanguage = await setLanguage(code);
      await i18n.changeLanguage(committedLanguage);
      setLanguageStatus('');
    } catch (error) {
      setLanguageStatus(describeLanguageActionError(error, 'SETTINGS_LANGUAGE_CHANGE_FAILED'));
    }
  }, [i18n, setLanguage]);

  const resetSolarDraft = useCallback(() => {
    setDraftMode(normalizedSolarProfile.mode === SOLAR_LOCATION_MODES.AUTO
      ? SOLAR_LOCATION_MODES.AUTO : FIXED_MODE);
    setDraftPresetId(hasRetainedFixedReference
      ? CURRENT_FIXED_SELECTION : normalizedSolarProfile.mode === SOLAR_LOCATION_MODES.AUTO ? '' : normalizedSolarProfile.presetId);
  }, [hasRetainedFixedReference, normalizedSolarProfile]);

  useEffect(resetSolarDraft, [resetSolarDraft]);

  const commitSolarLocation = useCallback(async (nextProfile) => {
    if (solarPendingRef.current) return;
    solarPendingRef.current = true;
    setSolarSaveBusy(true);
    setSolarActionStatus('');
    try {
      if (await saveSolarLocation(nextProfile) === false) resetSolarDraft();
    } catch (error) {
      resetSolarDraft();
      setSolarActionStatus(describeLanguageActionError(error, 'SETTINGS_SOLAR_LOCATION_SAVE_FAILED'));
    } finally {
      solarPendingRef.current = false;
      setSolarSaveBusy(false);
    }
  }, [resetSolarDraft, saveSolarLocation]);

  const changeSolarMode = (mode) => {
    if (solarPendingRef.current) return;
    setDraftMode(mode);
    setSolarActionStatus('');
    if (mode === SOLAR_LOCATION_MODES.AUTO) void commitSolarLocation({ mode });
    else if (normalizedSolarProfile.mode === SOLAR_LOCATION_MODES.AUTO) setDraftPresetId('');
  };

  const changeRegion = (presetId) => {
    if (solarPendingRef.current || presetId === '') return;
    setDraftPresetId(presetId);
    if (presetId !== CURRENT_FIXED_SELECTION) {
      void commitSolarLocation({ mode: SOLAR_LOCATION_MODES.PRESET, presetId });
    }
  };

  const fixedRegionOptions = hasRetainedFixedReference
    ? [{
      id: CURRENT_FIXED_SELECTION,
      label: t('solar_location.current_fixed_option', { location: currentReferenceLabel }),
    }, ...REGION_PRESETS.map((preset) => ({
      id: preset.id,
      label: resolvePresetLabel(t, preset.id, preset.label),
    }))]
    : REGION_PRESETS.map((preset) => ({
      id: preset.id,
      label: resolvePresetLabel(t, preset.id, preset.label),
    }));

  return (
    <SettingsGroup
      title={t('language.title')}
      className="h-full min-h-0"
      bodyClassName="flex min-h-0 flex-1 flex-col divide-y divide-border/25"
    >
      <SettingsRow
        title={t('language.interface_title')}
        className="flex-1"
      >
        <SettingsInlineChoice
          label={t('language.select')}
          value={currentLang}
          onValueChange={handleLanguageChange}
          options={LANGUAGES.map((language) => ({
            id: language.code,
            label: t(language.labelKey),
          }))}
        />
      </SettingsRow>

      <SettingsRow title={t('solar_location.row_title')} description={t('solar_location.row_desc')}
        meta={currentReferenceSummary} layout="stacked">
        <SettingsChoiceGroup label={t('solar_location.mode_label')} value={draftMode}
          onValueChange={changeSolarMode} disabled={solarSaveBusy}
          options={[
            { id: SOLAR_LOCATION_MODES.AUTO, label: t('solar_location.device_mode_title'),
              description: t('solar_location.device_mode_desc') },
            { id: FIXED_MODE, label: t('solar_location.fixed_mode_title'),
              description: t('solar_location.fixed_mode_desc') },
          ]} />
        {draftMode === FIXED_MODE ? (
          <label className="mt-3 block max-w-[560px] text-sm font-medium">
            {t('solar_location.region_label')}
            <SettingsSelect className="mt-2" value={draftPresetId}
              onChange={(event) => changeRegion(event.target.value)} disabled={solarSaveBusy}>
              <option value="" disabled>{t('solar_location.choose_region')}</option>
              {fixedRegionOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </SettingsSelect>
          </label>
        ) : null}
      </SettingsRow>
      <SettingsFeedback message={languageStatus || visibleSolarStatusMessage} tone="danger" />
    </SettingsGroup>
  );
}

export default LanguagePanel;
