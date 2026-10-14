import React, { useEffect, useMemo, useState } from 'react';
import { UiInput, UiToggle } from '../../../../../ui-kit';
import { useAppTranslation } from '../../../../../ui-kit/hooks/useAppTranslation.js';
import { DEFAULT_PROTECTION_PRESET_ID } from '../../../../../domains/protection/catalog/presetContract.js';
import {
  buildResolvedProtectionPresetCatalog,
  resolveProtectionPresetSelection,
} from '../../../../../domains/protection/catalog/presetCatalog.js';
import { getCanonicalArtifactDefinition } from '../../../../../domains/protection/catalog/artifactFamilyCatalog.js';
import { useTheme } from '@/apps/dashboard/stores/index.js';

const POSTURE_OPTIONS = Object.freeze([
  { id: 'gentle', label: 'Gentle' },
  { id: 'balanced', label: 'Balanced' },
  { id: 'strict', label: 'Strict' },
]);

const LANE_KEYS = Object.freeze([
  { id: 'reward', label: 'Reward' },
  { id: 'pace', label: 'Pace' },
  { id: 'friction', label: 'Friction' },
]);

const LANE_VALUES = Object.freeze([0, 1, 2, 3]);

function countEnabledArtifacts(preset) {
  return PRESET_EDITOR_CANONICAL_ARTIFACT_IDS.reduce(
    (count, artifactId) => count + (preset?.artifacts?.[artifactId]?.enabled ? 1 : 0),
    0,
  );
}

function formatLaneSummary(preset) {
  const lane = preset?.lanes?.['3'] || {};
  return `L3 · R${lane.reward ?? 0} / P${lane.pace ?? 0} / F${lane.friction ?? 0}`;
}

const PRESET_EDITOR_CANONICAL_ARTIFACT_IDS = Object.freeze([
  'lens',
  'veil',
  'barrier',
  'flare',
  'echo',
]);

function PresetChip({ active = false, label, usesOpenStudioChrome = false }) {
  return (
    <span className={`inline-flex items-center border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.08em] ${usesOpenStudioChrome
      ? (active
        ? 'rounded-[2px] border-border/35 bg-background text-on-surface'
        : 'rounded-[2px] border-border/25 bg-surface text-on-surface-muted')
      : (active
        ? 'rounded-full border-[#2D4F1E] bg-[#2D4F1E]/10 text-[#2D4F1E]'
        : 'rounded-full border-[#D8D3CA] bg-white text-[#6B6258]')}`}>
      {label}
    </span>
  );
}

export default function PresetStudioPanel({
  presetCatalog,
  presetAssignments,
  selectedDomain = null,
  onGlobalPresetChange,
  onCreatePreset,
  onDuplicatePreset,
  onUpdatePreset,
  onDeletePreset,
}) {
  const { t } = useAppTranslation('sites');
  const { t: tTools } = useAppTranslation('tools');
  const { themeProfile } = useTheme();
  const usesOpenStudioChrome = themeProfile?.sites?.workspaceVariant === 'open';
  const resolvedCatalog = useMemo(
    () => buildResolvedProtectionPresetCatalog(presetCatalog),
    [presetCatalog],
  );
  const presetList = useMemo(
    () => Object.values(resolvedCatalog),
    [resolvedCatalog],
  );
  const globalPresetId = presetAssignments?.globalPresetId || DEFAULT_PROTECTION_PRESET_ID;
  const siteSelection = useMemo(
    () => resolveProtectionPresetSelection({
      catalog: resolvedCatalog,
      assignments: presetAssignments,
      host: selectedDomain || '',
    }),
    [presetAssignments, resolvedCatalog, selectedDomain],
  );
  const [selectedPresetId, setSelectedPresetId] = useState(siteSelection?.presetId || globalPresetId);
  const [draftLabel, setDraftLabel] = useState('');
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetSourceId, setNewPresetSourceId] = useState(globalPresetId);

  useEffect(() => {
    const fallbackId = siteSelection?.presetId || globalPresetId || DEFAULT_PROTECTION_PRESET_ID;
    if (!resolvedCatalog[selectedPresetId]) {
      setSelectedPresetId(fallbackId);
    }
  }, [globalPresetId, resolvedCatalog, selectedPresetId, siteSelection?.presetId]);

  useEffect(() => {
    const selected = resolvedCatalog[selectedPresetId] || null;
    setDraftLabel(selected?.label || '');
  }, [resolvedCatalog, selectedPresetId]);

  useEffect(() => {
    if (!resolvedCatalog[newPresetSourceId]) {
      setNewPresetSourceId(globalPresetId || DEFAULT_PROTECTION_PRESET_ID);
    }
  }, [globalPresetId, newPresetSourceId, resolvedCatalog]);

  const selectedPreset = resolvedCatalog[selectedPresetId] || resolvedCatalog[DEFAULT_PROTECTION_PRESET_ID] || null;
  const selectedIsCustom = selectedPreset?.kind === 'custom';
  const siteUsesOverride = !!selectedDomain && siteSelection?.source === 'site';

  useEffect(() => {
    const effectivePresetId = siteSelection?.presetId || globalPresetId || DEFAULT_PROTECTION_PRESET_ID;
    setSelectedPresetId(effectivePresetId);
  }, [globalPresetId, selectedDomain, siteSelection?.presetId]);

  const commitPresetPatch = (patch) => {
    if (!selectedIsCustom || !selectedPreset?.id) return;
    onUpdatePreset?.(selectedPreset.id, patch);
  };

  const updateArtifactPreference = (artifactId, patch = {}) => {
    if (!selectedIsCustom || !selectedPreset?.id) return;
    const currentPreference = selectedPreset.artifacts?.[artifactId] || {};
    commitPresetPatch({
      artifacts: {
        ...selectedPreset.artifacts,
        [artifactId]: {
          ...currentPreference,
          ...patch,
        },
      },
    });
  };

  const handleCreate = async () => {
    const created = await onCreatePreset?.({
      label: newPresetName.trim(),
      sourcePresetId: newPresetSourceId || globalPresetId,
    });
    if (created?.id) {
      setSelectedPresetId(created.id);
      setNewPresetName('');
    }
  };

  const handleDuplicate = async () => {
    if (!selectedPreset?.id) return;
    const duplicated = await onDuplicatePreset?.(selectedPreset.id);
    if (duplicated?.id) {
      setSelectedPresetId(duplicated.id);
    }
  };

  const handleDelete = async () => {
    if (!selectedIsCustom || !selectedPreset?.id) return;
    const removed = await onDeletePreset?.(selectedPreset.id);
    if (removed) {
      setSelectedPresetId(globalPresetId || DEFAULT_PROTECTION_PRESET_ID);
    }
  };

  return (
    <div className={`h-full min-h-0 overflow-hidden ${usesOpenStudioChrome ? 'p-4 lg:p-5' : 'p-5 lg:p-6'}`}>
      <div className="grid h-full min-h-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(280px,0.95fr)_minmax(0,1.45fr)]">
        <section className={`flex min-h-0 flex-col gap-4 overflow-hidden border p-4 ${usesOpenStudioChrome ? 'rounded-[2px] border-border/25 bg-surface' : 'rounded-theme border-border/20 bg-surface/85 shadow-sm'}`}>
          <div className="space-y-1">
            <h2 className="text-[12px] font-black uppercase tracking-[0.1em] text-on-surface">
              {t('preset_studio.title', { })}
            </h2>
            {!usesOpenStudioChrome ? (
              <p className="text-[11px] leading-relaxed text-on-surface-muted">
                {t('preset_studio.hint', {
                  })}
              </p>
            ) : null}
          </div>

          <div className={`border p-3.5 ${usesOpenStudioChrome ? 'rounded-[2px] border-border/20 bg-background' : 'rounded-theme border-border/20 bg-surface-sunken/20'}`}>
            <div className="text-[10px] font-black uppercase tracking-[0.1em] text-on-surface-muted">
              {t('preset_studio.global_title', { })}
            </div>
            <select
              value={globalPresetId}
              onChange={(event) => onGlobalPresetChange?.(event.target.value)}
              className={`mt-2 h-11 w-full border border-border/30 bg-white px-3 text-[12px] font-semibold text-on-surface outline-hidden transition-colors focus-visible:border-accent ${usesOpenStudioChrome ? 'rounded-[2px]' : 'rounded-theme'}`}
            >
              {presetList.map((preset) => (
                <option key={preset.id} value={preset.id}>{preset.label}</option>
              ))}
            </select>
            <div className="mt-2 text-[11px] text-on-surface-muted">
              {selectedDomain
                ? t('preset_studio.site_context', {
                  domain: selectedDomain,
                })
                : t('preset_studio.site_context_empty', {
                  })}
            </div>
            {selectedDomain && (
              <div className="mt-2 flex flex-wrap gap-2">
                <PresetChip
                  active={siteUsesOverride}
                  usesOpenStudioChrome={usesOpenStudioChrome}
                  label={siteUsesOverride
                    ? t('preset_studio.site_override_active', { })
                    : t('preset_studio.site_override_inherit', { })}
                />
                <PresetChip
                  active={false}
                  usesOpenStudioChrome={usesOpenStudioChrome}
                  label={`${t('preset_studio.effective_preset', { })}: ${siteSelection?.preset?.label || '--'}`}
                />
              </div>
            )}
          </div>

          <div className={`border p-3.5 ${usesOpenStudioChrome ? 'rounded-[2px] border-border/20 bg-background' : 'rounded-theme border-dashed border-border/25 bg-surface'}`}>
            <div className="text-[10px] font-black uppercase tracking-[0.1em] text-on-surface-muted">
              {t('preset_studio.create_title', { })}
            </div>
            <div className="mt-3 grid gap-2">
              <UiInput
                value={newPresetName}
                onChange={(event) => setNewPresetName(event.target.value)}
                placeholder={t('preset_studio.create_placeholder', { })}
                className={`h-10 text-sm ${usesOpenStudioChrome ? 'rounded-[2px]' : ''}`}
              />
              <select
                value={newPresetSourceId}
                onChange={(event) => setNewPresetSourceId(event.target.value)}
                className={`h-10 border border-border/30 bg-white px-3 text-[12px] font-semibold text-on-surface outline-hidden transition-colors focus-visible:border-accent ${usesOpenStudioChrome ? 'rounded-[2px]' : 'rounded-theme'}`}
              >
                {presetList.map((preset) => (
                  <option key={preset.id} value={preset.id}>{preset.label}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleCreate}
                className={`inline-flex h-10 items-center justify-center border px-4 text-[11px] font-black uppercase tracking-[0.1em] ${usesOpenStudioChrome ? 'rounded-[2px] border-border/30 bg-background text-on-surface' : 'rounded-theme border-[#2D4F1E] bg-[#2D4F1E] text-white'}`}
              >
                {t('preset_studio.create_action', { })}
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto pr-1">
            <div className="grid gap-2">
              {presetList.map((preset) => {
                const active = preset.id === selectedPresetId;
                const isGlobal = preset.id === globalPresetId;
                const isSitePreset = selectedDomain && siteSelection?.presetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setSelectedPresetId(preset.id)}
                    className={`border px-3 py-3 text-left transition-colors ${usesOpenStudioChrome ? 'rounded-[2px]' : 'rounded-theme'} ${active
                      ? (usesOpenStudioChrome ? 'border-border/35 bg-background text-on-surface' : 'border-accent/40 bg-accent/10 text-on-surface shadow-sm')
                      : (usesOpenStudioChrome ? 'border-border/20 bg-surface text-on-surface hover:border-border/35' : 'border-border/20 bg-surface text-on-surface hover:border-accent/25')}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-[12px] font-black tracking-[0.02em]">{preset.label}</div>
                        <div className="mt-1 text-[11px] text-on-surface-muted">{preset.description || formatLaneSummary(preset)}</div>
                      </div>
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <PresetChip usesOpenStudioChrome={usesOpenStudioChrome} active={isGlobal} label={isGlobal ? t('preset_studio.badge_global', { }) : (preset.kind === 'builtin' ? t('preset_studio.badge_builtin', { }) : t('preset_studio.badge_custom', { }))} />
                        {isSitePreset && <PresetChip usesOpenStudioChrome={usesOpenStudioChrome} active label={t('preset_studio.badge_site', { })} />}
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-on-surface-muted">
                      <span>{preset.posture}</span>
                      <span>{formatLaneSummary(preset)}</span>
                      <span>{t('preset_studio.artifact_count', { count: countEnabledArtifacts(preset)})}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className={`flex min-h-0 flex-col overflow-auto border p-4 ${usesOpenStudioChrome ? 'rounded-[2px] border-border/25 bg-surface' : 'rounded-theme border-border/20 bg-surface/85 shadow-sm'}`}>
          {selectedPreset ? (
            <>
              <div className="flex flex-col gap-3 border-b border-border/20 pb-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <PresetChip usesOpenStudioChrome={usesOpenStudioChrome} active={selectedPreset.kind === 'custom'} label={selectedPreset.kind === 'custom'
                      ? t('preset_studio.badge_custom', { })
                      : t('preset_studio.badge_builtin', { })} />
                    {selectedPreset.id === globalPresetId && <PresetChip usesOpenStudioChrome={usesOpenStudioChrome} active label={t('preset_studio.badge_global', { })} />}
                  </div>
                  <UiInput
                    value={draftLabel}
                    onChange={(event) => setDraftLabel(event.target.value)}
                    onBlur={() => {
                      const nextLabel = draftLabel.trim();
                      if (!nextLabel || nextLabel === selectedPreset.label) {
                        setDraftLabel(selectedPreset.label || '');
                        return;
                      }
                      commitPresetPatch({ label: nextLabel });
                    }}
                    disabled={!selectedIsCustom}
                    className={`mt-3 h-11 text-base font-black ${usesOpenStudioChrome ? 'rounded-[2px]' : ''}`}
                  />
                  {!usesOpenStudioChrome ? (
                    <p className="mt-2 text-[11px] leading-relaxed text-on-surface-muted">
                      {t('preset_studio.editor_hint', {
                        })}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onGlobalPresetChange?.(selectedPreset.id)}
                    className={`inline-flex h-10 items-center justify-center border border-border/30 bg-white px-3 text-[10px] font-black uppercase tracking-[0.08em] text-on-surface ${usesOpenStudioChrome ? 'rounded-[2px]' : 'rounded-theme'}`}
                  >
                    {t('preset_studio.make_global', { })}
                  </button>
                  <button
                    type="button"
                    onClick={handleDuplicate}
                    className={`inline-flex h-10 items-center justify-center border border-border/30 bg-white px-3 text-[10px] font-black uppercase tracking-[0.08em] text-on-surface ${usesOpenStudioChrome ? 'rounded-[2px]' : 'rounded-theme'}`}
                  >
                    {t('preset_studio.duplicate', { })}
                  </button>
                  {selectedIsCustom && (
                    <button
                      type="button"
                      onClick={handleDelete}
                      className={`inline-flex h-10 items-center justify-center border px-3 text-[10px] font-black uppercase tracking-[0.08em] ${usesOpenStudioChrome ? 'rounded-[2px] border-danger/25 bg-background text-danger' : 'rounded-theme border-[#B22222]/30 bg-[#B22222]/8 text-[#8A1D1D]'}`}
                    >
                      {t('preset_studio.delete', { })}
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                <div className={`border p-4 ${usesOpenStudioChrome ? 'rounded-[2px] border-border/20 bg-background' : 'rounded-theme border-border/20 bg-surface-sunken/20'}`}>
                  <div className="grid gap-4">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-[0.1em] text-on-surface-muted">
                        {t('preset_studio.posture_title', { })}
                      </label>
                      <select
                        value={selectedPreset.posture}
                        disabled={!selectedIsCustom}
                        onChange={(event) => commitPresetPatch({ posture: event.target.value })}
                        className={`mt-2 h-10 w-full border border-border/30 bg-white px-3 text-[12px] font-semibold text-on-surface outline-hidden transition-colors focus-visible:border-accent disabled:opacity-60 ${usesOpenStudioChrome ? 'rounded-[2px]' : 'rounded-theme'}`}
                      >
                        {POSTURE_OPTIONS.map((option) => (
                          <option key={option.id} value={option.id}>
                            {t(`preset_studio.posture_${option.id}`, { })}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.1em] text-on-surface-muted">
                        {t('preset_studio.artifacts_title', { })}
                      </div>
                      <div className="mt-2 grid grid-cols-1 gap-3">
                        {PRESET_EDITOR_CANONICAL_ARTIFACT_IDS.map((canonicalArtifactId) => {
                          const canonicalArtifactDefinition = getCanonicalArtifactDefinition(canonicalArtifactId);
                          const artifactPreference = selectedPreset?.artifacts?.[canonicalArtifactId] || {};
                          const active = !!artifactPreference.enabled;

                          return (
                            <div
                              key={canonicalArtifactId}
                              className={`border px-3 py-3 text-on-surface transition-colors ${usesOpenStudioChrome ? 'rounded-[2px]' : 'rounded-theme'} ${active
                                ? (usesOpenStudioChrome ? 'border-border/35 bg-background' : 'border-accent/35 bg-accent/10')
                                : 'border-border/20 bg-white'}`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-[11px] font-black tracking-[0.02em]">
                                    {canonicalArtifactDefinition ? tTools(canonicalArtifactDefinition.titleKey) : canonicalArtifactId}
                                  </div>
                                  <div className="mt-1 text-[10px] uppercase tracking-[0.08em] text-on-surface-muted">
                                    {active
                                      ? t('preset_studio.artifact_on', { })
                                      : t('preset_studio.artifact_off', { })}
                                  </div>
                                  <div className="mt-2 text-[10px] leading-relaxed text-on-surface-muted">
                                    {canonicalArtifactDefinition ? tTools(canonicalArtifactDefinition.descriptionKey) : ''}
                                  </div>
                                </div>
                                <UiToggle
                                  checked={active}
                                  disabled={!selectedIsCustom}
                                  onChange={(event) => {
                                    const nextEnabled = !!event?.target?.checked;
                                    updateArtifactPreference(canonicalArtifactId, {
                                      enabled: nextEnabled,
                                      autoTrigger: nextEnabled ? (active ? !!artifactPreference.autoTrigger : true) : !!artifactPreference.autoTrigger,
                                    });
                                  }}
                                />
                              </div>

                              <div className="mt-3">
                                <div className={`border px-3 py-2 ${usesOpenStudioChrome ? 'rounded-[2px] border-border/20 bg-surface' : 'rounded-theme border-border/20 bg-surface/80'}`}>
                                  <div className="text-[10px] font-black uppercase tracking-[0.08em] text-on-surface-muted">
                                    {t('preset_studio.artifact_auto_trigger', { })}
                                  </div>
                                  <div className="mt-2 flex items-center justify-between gap-3">
                                    <span className="text-[11px] text-on-surface-muted">
                                      {artifactPreference.autoTrigger
                                        ? t('preset_studio.artifact_on', { })
                                        : t('preset_studio.artifact_manual_only', { })}
                                    </span>
                                    <UiToggle
                                      checked={!!artifactPreference.autoTrigger}
                                      disabled={!selectedIsCustom || !active}
                                      onChange={(event) => updateArtifactPreference(canonicalArtifactId, {
                                        autoTrigger: !!event?.target?.checked,
                                      })}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className={`border p-4 ${usesOpenStudioChrome ? 'rounded-[2px] border-border/20 bg-background' : 'rounded-theme border-border/20 bg-surface-sunken/20'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-[11px] font-black uppercase tracking-[0.1em] text-on-surface">
                        {t('preset_studio.lane_title', { })}
                      </h3>
                      {!usesOpenStudioChrome ? (
                        <p className="mt-1 text-[11px] text-on-surface-muted">
                          {t('preset_studio.lane_hint', {
                            })}
                        </p>
                      ) : null}
                    </div>
                    <PresetChip usesOpenStudioChrome={usesOpenStudioChrome} active={false} label={formatLaneSummary(selectedPreset)} />
                  </div>

                  <div className="mt-4 overflow-auto">
                    <table className={`min-w-full border-separate border-spacing-0 overflow-hidden border border-border/20 bg-white text-left ${usesOpenStudioChrome ? 'rounded-[2px]' : 'rounded-theme'}`}>
                      <thead>
                        <tr className="bg-surface-sunken/20 text-[10px] font-black uppercase tracking-[0.1em] text-on-surface-muted">
                          <th className="border-b border-border/20 px-3 py-2">
                            {t('preset_studio.level', { })}
                          </th>
                          {LANE_KEYS.map((lane) => (
                            <th key={lane.id} className="border-b border-border/20 px-3 py-2">{lane.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[1, 2, 3, 4, 5].map((level) => (
                          <tr key={level} className="text-[12px] text-on-surface">
                            <td className="border-b border-border/10 px-3 py-2 font-black uppercase tracking-[0.08em]">L{level}</td>
                            {LANE_KEYS.map((lane) => (
                              <td key={lane.id} className="border-b border-border/10 px-3 py-2">
                                <select
                                  value={selectedPreset?.lanes?.[String(level)]?.[lane.id] ?? 0}
                                  disabled={!selectedIsCustom}
                                  onChange={(event) => commitPresetPatch({
                                    lanes: {
                                      ...selectedPreset.lanes,
                                      [String(level)]: {
                                        ...selectedPreset.lanes[String(level)],
                                        [lane.id]: Number(event.target.value),
                                      },
                                    },
                                  })}
                                  className={`h-9 w-full border border-border/20 bg-white px-2 text-[12px] font-semibold outline-hidden transition-colors focus-visible:border-accent disabled:opacity-60 ${usesOpenStudioChrome ? 'rounded-[2px]' : 'rounded-theme'}`}
                                >
                                  {LANE_VALUES.map((value) => (
                                    <option key={value} value={value}>{value}</option>
                                  ))}
                                </select>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-on-surface-muted">
              {t('preset_studio.empty', { })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
