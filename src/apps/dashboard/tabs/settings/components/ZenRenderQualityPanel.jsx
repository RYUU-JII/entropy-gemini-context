import React, { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { usePreferenceStore } from '@/apps/dashboard/stores/usePreferenceStore.js';
import { ZEN_RENDER_PRESET_IDS } from '@/domains/settings/config/zenRenderPreset.js';
import { SettingsChoiceGroup, SettingsFeedback, SettingsGroup } from './SettingsControlPrimitives.jsx';

export function ZenRenderQualityPanel() {
  const { t } = useAppTranslation('settings');
  const { themeId, preset, save } = usePreferenceStore(useShallow((state) => ({
    themeId: state.themeId,
    preset: state.zenRenderPreset,
    save: state.setZenRenderPreset,
  })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  if (themeId !== 'zen') return null;

  const selectPreset = async (value) => {
    setSaving(true);
    setError('');
    try {
      await save(value);
    } catch {
      setError(t('zen_render.error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsGroup title={t('zen_render.title')} description={t('zen_render.desc')}>
      <SettingsChoiceGroup
        label={t('zen_render.title')}
        value={preset}
        onValueChange={selectPreset}
        disabled={saving}
        options={[
          {
            id: ZEN_RENDER_PRESET_IDS.FULL,
            label: t('zen_render.full_label'),
            description: t('zen_render.full_desc'),
            eyebrow: t('zen_render.smooth'),
          },
          {
            id: ZEN_RENDER_PRESET_IDS.BALANCED,
            label: t('zen_render.balanced_label'),
            description: t('zen_render.balanced_desc'),
            eyebrow: t('zen_render.smooth'),
          },
          {
            id: ZEN_RENDER_PRESET_IDS.LOW,
            label: t('zen_render.low_label'),
            description: t('zen_render.low_desc'),
            eyebrow: t('zen_render.power_saver'),
          },
        ]}
      />
      <SettingsFeedback message={error} tone="danger" />
    </SettingsGroup>
  );
}
