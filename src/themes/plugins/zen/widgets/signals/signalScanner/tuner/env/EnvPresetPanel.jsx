import React from 'react';
const renderPresetButtons = ({
  presets = [],
  selectedPresetId = '',
  onApply = null,
  t = null,
  keyPrefix = 'preset'
}) => {
  if (!Array.isArray(presets) || presets.length === 0) return null;
  return <div className="grid grid-cols-1 gap-2">
            {presets.map(preset => {
      const selected = preset.id === selectedPresetId;
      return <button key={`${keyPrefix}-${preset.id}`} type="button" onClick={() => {
        if (typeof onApply === 'function') onApply(preset.id);
      }} className={`rounded-xl border px-3 py-2 text-left transition-colors ${selected ? 'border-accent/40 bg-accent/12' : 'border-border/25 bg-surface-sunken/60 hover:bg-surface-sunken/80'}`}>
                        <div className="mb-1 flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface">
                                {t?.(`tools:koi_tuner.env_presets.${preset.id}.label`, {}) || preset.label}
                            </span>
                            {selected ? <span className="text-[9px] font-semibold text-accent">
                                    {t?.('tools:koi_tuner.env_presets.active', {}) || '선택됨'}
                                </span> : null}
                        </div>
                        <p className="text-[9px] leading-relaxed text-on-surface-muted">
                            {t?.(`tools:koi_tuner.env_presets.${preset.id}.desc`, {}) || preset.desc}
                        </p>
                    </button>;
    })}
        </div>;
};
export default function EnvPresetPanel({
  t,
  scenePresets = [],
  selectedScenePresetId = '',
  onApplyScenePreset = null
}) {
  if (!t) return null;
  return <div className="rounded-2xl border border-border/40 bg-surface/20 p-3">
            <div className="mb-3 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface">
                    {t('tools:koi_tuner.env_presets.title', {})}
                </span>
                <span className="text-[9px] text-on-surface-muted">
                    {t('tools:koi_tuner.env_presets.hint', {})}
                </span>
            </div>

            <div className="grid grid-cols-1 gap-3">
                <div className="rounded-xl border border-border/25 bg-surface-sunken/45 p-2">
                    <div className="mb-2 flex items-center justify-between px-1">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-on-surface">
                            {t('tools:koi_tuner.env_presets.scene_title', {})}
                        </span>
                        <span className="text-[9px] text-on-surface-muted">
                            {t('tools:koi_tuner.env_presets.scene_hint', {})}
                        </span>
                    </div>
                    {renderPresetButtons({
          presets: scenePresets,
          selectedPresetId: selectedScenePresetId,
          onApply: onApplyScenePreset,
          t,
          keyPrefix: 'scene'
        })}
                </div>
            </div>
        </div>;
}
