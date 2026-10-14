import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Settings } from 'lucide-react';
import { useToast } from '@/ui-kit';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { useThemeAmbientPresentation } from '@/themes/core/presentation/ThemeAmbientPresentationContext.jsx';
import { requireZenAmbientPresentation } from '../../api/environment.js';
import KoiTunerParamControl from '../../widgets/signals/signalScanner/tuner/KoiTunerParamControl.jsx';
import { resolveKoiEventMotionRange } from '../model/koi/koiEventMotionLimits.js';
import {
  KOI_COLOR_STRATEGIES,
  DEFAULT_KOI_COLOR_STRATEGY,
  normalizeKoiColorStrategy,
} from '../model/koi/koiFaviconColorProfile.js';
import {
  CONTROL_PANEL_TARGETS,
  CONTROL_PANEL_MODES,
  CONTROL_GROUPS,
  BADGE_META,
  FLAT_ALL_PARAMS,
} from '../tuner/koiTunerSchema.js';
import {
  DEFAULT_POND_TUNER_FLOW_STAGE_ID,
  POND_TUNER_FLOW_STAGES,
  POND_TUNER_LAYOUT_MODES,
  resolvePondTunerFlowGroups,
  resolvePondInspectorGroups,
} from '../tuner/pondTunerFlowModel.js';
import { applyKoiMotionProfileProjection } from '../tuner/koiMotionProfileProjection.js';
import { flattenTuningForClipboard } from '../tuner/koiTunerUtils.js';
import ControlGroupCard from '../../widgets/signals/signalScanner/tuner/components/ControlGroupCard.jsx';
import KoiTunerActionBar from '../../widgets/signals/signalScanner/tuner/components/KoiTunerActionBar.jsx';
import { selectZenEnvCause } from '../runtime/core/zenCauseModel.js';
import { projectZenPondTuningV1 } from '../contracts/zenPondTuningContract.js';
import {
  resolveZenEnvironmentState,
  resolveZenRealtimeClockContext,
} from '../../runtime/environment/zenWorldEnvironmentKernel.js';
import { resolveZenSolarContext } from '../../runtime/environment/zenWorldSolarContext.js';
import { resolveZenEnvFrame } from '../runtime/core/zenEnvCore.js';
import EnvChannelMonitorPanel from '../../widgets/signals/signalScanner/tuner/env/EnvChannelMonitorPanel.jsx';

/* ─── Styles ──────────────────────────────────────────────── */

const KOI_TUNER_STYLE = `
    .custom-scrollbar::-webkit-scrollbar { width: 4px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 10px; opacity: 0.3; }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: var(--color-on-surface-muted); }
    input[type=range]::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        height: 16px;
        width: 16px;
        border-radius: 50%;
        background: var(--color-surface);
        border: 2px solid var(--color-accent);
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        cursor: pointer;
        margin-top: -5px;
        transition: all 0.2s ease;
    }
    input[type=range]::-webkit-slider-thumb:hover {
        transform: scale(1.15);
        box-shadow: 0 4px 8px rgba(0,0,0,0.15);
    }
    .scrollbar-none::-webkit-scrollbar { display: none; }
    .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
`;

/* ─── Badge colors ────────────────────────────────────────── */

const BADGE_CLASSES = {
  blue: 'bg-blue-500/15 text-blue-300 ring-blue-500/25',
  green: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/25',
  amber: 'bg-amber-500/15 text-amber-300 ring-amber-500/25',
  slate: 'bg-slate-500/15 text-slate-300 ring-slate-500/25'
};
const getPathValue = (source, path) => {
  if (!source || typeof source !== 'object' || typeof path !== 'string' || !path) return undefined;
  const parts = path.split('.');
  let cursor = source;
  for (let i = 0; i < parts.length; i += 1) {
    if (!cursor || typeof cursor !== 'object') return undefined;
    cursor = cursor[parts[i]];
  }
  return cursor;
};

const setPathValue = (source, path, value) => {
  const parts = typeof path === 'string' ? path.split('.').filter(Boolean) : [];
  if (parts.length === 0) return source;
  const root = source && typeof source === 'object' ? { ...source } : {};
  let cursor = root;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    const next = cursor[key];
    cursor[key] = next && typeof next === 'object' && !Array.isArray(next) ? { ...next } : {};
    cursor = cursor[key];
  }
  cursor[parts[parts.length - 1]] = value;
  return root;
};

const getFlowStageLabel = (t, stageId) => {
  switch (stageId) {
    case 'environment':
      return t('tools:koi_tuner.flow_stages.environment', {});
    case 'surface':
      return t('tools:koi_tuner.flow_stages.surface', {});
    case 'koi':
      return t('tools:koi_tuner.flow_stages.koi', {});
    case 'inspect':
      return t('tools:koi_tuner.flow_stages.inspect', {});
    default:
      return '';
  }
};

/* ─── Shell class ─────────────────────────────────────────── */

const getShellClass = (embedded, className) => {
  if (embedded) {
    return `flex h-full w-full flex-col overflow-hidden rounded-lg border border-border/40 bg-surface-sunken/80 shadow-lg backdrop-blur-xl ${className}`;
  }
  return 'fixed top-4 right-4 z-[9999] flex h-[640px] w-[320px] flex-col overflow-hidden rounded-lg border border-border/40 bg-surface-sunken/80 shadow-2xl backdrop-blur-xl';
};

/* ─── Component ───────────────────────────────────────────── */

export default function ZenKoiTunerPanel({
  tuning,
  onTuningChange,
  onReset,
  onHardReset,
  showHardReset = true,
  hardResetPending = false,
  embedded = false,
  className = '',
  layoutMode = POND_TUNER_LAYOUT_MODES.TARGETS,
  inspectorSection = 'scene',
  siteKoiColorStrategy = DEFAULT_KOI_COLOR_STRATEGY,
  onSiteKoiColorStrategyChange = null
}) {
  const themeAmbientPresentation = useThemeAmbientPresentation();
  const sharedAmbientTimeContext = useMemo(() => {
    if (themeAmbientPresentation?.themeId !== 'zen') return null;
    return requireZenAmbientPresentation(themeAmbientPresentation).timeContext;
  }, [themeAmbientPresentation]);
  const { t } = useAppTranslation('tools');
  const toast = useToast();
  const isPondFlowLayout = layoutMode === POND_TUNER_LAYOUT_MODES.POND_FLOW;
  const isInspectorLayout = layoutMode === POND_TUNER_LAYOUT_MODES.POND_INSPECTOR;

  const [selectedTarget, setSelectedTarget] = useState('world');
  const [selectedMode, setSelectedMode] = useState('authoring');
  const [selectedFlowStage, setSelectedFlowStage] = useState(DEFAULT_POND_TUNER_FLOW_STAGE_ID);
  const [openGroups, setOpenGroups] = useState(() => new Set());
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hoveredParam, setHoveredParam] = useState(null);
  const scrollHostRef = useRef(null);
  const activeTarget = useMemo(
    () => CONTROL_PANEL_TARGETS.find(target => target.id === selectedTarget) || CONTROL_PANEL_TARGETS[0],
    [selectedTarget],
  );
  const activeSwimModel = tuning?.physics?.swimModel || 'event_fsm_life_v1';
  const availableModes = useMemo(() => (
    CONTROL_PANEL_MODES.filter(mode => activeTarget?.modes?.includes(mode.id))
  ), [activeTarget]);
  const visibleGroups = useMemo(() => CONTROL_GROUPS.filter(group => {
    if (isPondFlowLayout) return false;
    if (group.target !== selectedTarget) return false;
    if (!group.modes?.includes(selectedMode)) return false;
    if (Array.isArray(group.appliesTo) && !group.appliesTo.includes(activeSwimModel)) return false;
    return true;
  }), [activeSwimModel, isPondFlowLayout, selectedMode, selectedTarget]);
  const flowVisibleGroups = useMemo(() => {
    if (!isPondFlowLayout) return [];
    return resolvePondTunerFlowGroups({
      groups: CONTROL_GROUPS,
      stageId: selectedFlowStage,
      activeSwimModel,
    });
  }, [activeSwimModel, isPondFlowLayout, selectedFlowStage]);
  const activeVisibleGroups = isPondFlowLayout ? flowVisibleGroups : visibleGroups;
  const inspectorGroups = useMemo(() => isInspectorLayout
    ? resolvePondInspectorGroups({ groups: CONTROL_GROUPS, section: inspectorSection, activeSwimModel })
    : null, [isInspectorLayout, inspectorSection, activeSwimModel]);
  const hoveredHint = useMemo(() => {
    return FLAT_ALL_PARAMS.find(param => param.id === hoveredParam)?.desc || '';
  }, [hoveredParam]);
  const toggleGroup = useCallback(groupId => {
    setOpenGroups(prev => {
      if (prev.has(groupId)) return new Set();
      return new Set([groupId]);
    });
  }, []);
  useEffect(() => {
    if (isPondFlowLayout) return;
    if (activeTarget?.modes?.includes(selectedMode)) return;
    setSelectedMode(activeTarget?.defaultMode || activeTarget?.modes?.[0] || 'authoring');
  }, [activeTarget, isPondFlowLayout, selectedMode]);
  useEffect(() => {
    if (activeVisibleGroups.length === 0) {
      setOpenGroups(new Set());
      return;
    }
    setOpenGroups(prev => {
      for (const group of activeVisibleGroups) {
        if (prev.has(group.id)) return prev;
      }
      return new Set([activeVisibleGroups[0].id]);
    });
  }, [activeVisibleGroups]);
  useEffect(() => {
    if (openGroups.size === 0) return;
    const host = scrollHostRef.current;
    if (!host || typeof host.scrollTo !== 'function') return;
    host.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }, [openGroups]);
  const channelMonitorSnapshot = useMemo(() => {
    try {
      const safeTuning = projectZenPondTuningV1(tuning || {});
      const envCause = selectZenEnvCause(safeTuning);
      const {
        solarCoordinates,
        solarTimeZone
      } = resolveZenSolarContext(null);
      const realtimeClock = resolveZenRealtimeClockContext(solarTimeZone);
      const timeContext = sharedAmbientTimeContext || realtimeClock;
      const envBundle = resolveZenEnvironmentState({
        timeContext,
        causeChannelTuning: safeTuning,
        envCause,
        solarCoordinates,
        solarTimeZone,
        solarSyncEnabled: sharedAmbientTimeContext === null
      });
      const frame = resolveZenEnvFrame({
        tuning: safeTuning,
        envState: envBundle?.envState || {}
      });
      const channels = frame?.channels || {};
      const lighting = channels?.lighting || {};
      const atmosphere = channels?.atmosphere || {};
      const waterMedium = channels?.waterMedium || {};
      const surface = channels?.surface || {};
      return {
        directLight: Number(lighting?.directLight || 0),
        ambientLight: Number(lighting?.ambientLight || 0),
        specularResponse: Number(surface?.specularResponse || 0),
        waveEnergy: Number(surface?.waveEnergy || 0),
        roughness: Number(surface?.roughness || 0),
        cloudReflectionFactor: Number(atmosphere?.reflectionFactor || 0),
        mirrorFactor: Number(atmosphere?.mirrorFactor || 0),
        turbidity: Number(waterMedium?.turbidity || 0),
        transmittance: Number(waterMedium?.transmittance || 0),
        bottomVisibility: Number(waterMedium?.bottomVisibility || 0)
      };
    } catch (error) {
      return { error: String(error?.message || error) };
    }
  }, [sharedAmbientTimeContext, tuning]);

  /* ── Koi color strategy ───────────────────────────────── */

  const resolvedSiteKoiColorStrategy = useMemo(() => normalizeKoiColorStrategy(siteKoiColorStrategy || DEFAULT_KOI_COLOR_STRATEGY), [siteKoiColorStrategy]);
  const siteKoiColorModeLabel = t('tools:experiment.pond_controls.strategy_label', {});
  const siteKoiColorModeOptions = useMemo(() => [{
    id: KOI_COLOR_STRATEGIES.OFF,
    label: t('tools:experiment.pond_controls.strategy_options.off', {})
  }, {
    id: KOI_COLOR_STRATEGIES.DIRECT,
    label: t('tools:experiment.pond_controls.strategy_options.direct', {})
  }, {
    id: KOI_COLOR_STRATEGIES.HYBRID,
    label: t('tools:experiment.pond_controls.strategy_options.hybrid', {})
  }, {
    id: KOI_COLOR_STRATEGIES.BREED,
    label: t('tools:experiment.pond_controls.strategy_options.breed', {})
  }], [t]);

  /* ── Select option label resolver ─────────────────────── */

  const getSelectOptionLabel = (param, option) => {
    if (!param || !option) return '';
    if (param.id === 'pondPaletteId') {
      return t(`tools:koi_tuner.palette_options.${option.value}`, {});
    }
    if (param.id === 'swimModel' || param.id === 'compareModelA' || param.id === 'compareModelB') {
      return t(`tools:koi_tuner.model_options.${option.value}`, {});
    }
    if (
      param.id === 'waterReflectionAlgorithm'
      || param.id === 'compareWaterReflectionAlgorithmA'
      || param.id === 'compareWaterReflectionAlgorithmB'
    ) {
      return t(`tools:koi_tuner.reflection_algorithm_options.${option.value}`, {});
    }
    return option.label;
  };

  /* ── Param value read/write ───────────────────────────── */

  const handleParamChange = (id, value, param = null) => {
    const path = param?.path || id;
    let nextTuning = setPathValue(tuning || {}, path, value);
    if (param?.projection === 'koiMotionProfile') {
      nextTuning = applyKoiMotionProfileProjection(nextTuning);
    }
    onTuningChange(nextTuning);
  };
  const getParamValue = (id, param = null) => {
    const path = param?.path || id;
    const value = getPathValue(tuning, path);
    if (value !== undefined) return value;
    if (param?.default !== undefined) return param.default;
    if (param?.type === 'toggle') return false;
    if (param?.type === 'select') return param?.options?.[0]?.value || '';
    return 0;
  };
  const resolveParamApplicability = useCallback((param, group) => {
    if (!param || param.type === 'section' || group?.ignoreApplicability) {
      return { hidden: false, disabled: false, reason: '' };
    }
    if (Array.isArray(param.appliesTo) && !param.appliesTo.includes(activeSwimModel)) {
      return {
        hidden: false,
        disabled: true,
        reason: t('tools:koi_tuner.inactive_for_model', {
          model: t(`tools:koi_tuner.model_options.${activeSwimModel}`, {}),
        }),
      };
    }
    return { hidden: false, disabled: false, reason: '' };
  }, [activeSwimModel, t]);

  /* ── Actions ──────────────────────────────────────────── */

  const handleCopy = useCallback(async () => {
    const flat = flattenTuningForClipboard(tuning);
    const payload = JSON.stringify(flat, null, 2);
    let copied = false;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(payload);
        copied = true;
      } catch {
        copied = false;
      }
    }
    if (!copied && typeof document !== 'undefined' && typeof document.execCommand === 'function') {
      const textarea = document.createElement('textarea');
      textarea.value = payload;
      textarea.setAttribute('readonly', 'readonly');
      textarea.style.position = 'fixed';
      textarea.style.top = '-9999px';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      copied = document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    if (copied) {
      toast.success(t('tools:koi_tuner.actions.copied_alert', {}), {
        dedupeKey: 'koi-tuner-copied'
      });
      return;
    }
    toast.error(t('tools:koi_tuner.actions.copy_failed', {}), {
      dedupeKey: 'koi-tuner-copy-failed'
    });
  }, [toast, t, tuning]);
  const handleHardReset = useCallback(() => {
    if (typeof onHardReset === 'function') {
      onHardReset();
    }
  }, [onHardReset]);
  const renderCustomPanel = useCallback(group => {
    if (group?.id === 'channels') {
      return <div>
        <p className="mb-2 text-xs text-on-surface-muted">{t('tools:koi_tuner.env_channels.preview_note')}</p>
        {channelMonitorSnapshot.error
          ? <p role="alert" className="break-words text-xs text-red-500">{channelMonitorSnapshot.error}</p>
          : <EnvChannelMonitorPanel t={t} channelValues={channelMonitorSnapshot} />}
      </div>;
    }
    return null;
  }, [channelMonitorSnapshot, t]);

  /* ── Collapsed state ──────────────────────────────────── */

  if (isCollapsed) {
    if (embedded) {
      return <div className={`flex h-full w-full items-start justify-end ${className}`}>
                    <button onClick={() => setIsCollapsed(false)} className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/20 bg-surface/80 text-on-surface shadow-md backdrop-blur-md transition-all hover:scale-105 hover:text-accent active:scale-95" aria-label={t('tools:koi_tuner.panel.scope', {})}>
                        <Settings className="h-4 w-4" aria-hidden="true" />
                    </button>
                </div>;
    }
    return <button onClick={() => setIsCollapsed(false)} className="fixed top-4 right-4 z-[9999] flex h-10 w-10 items-center justify-center rounded-lg border border-border/20 bg-surface/80 text-on-surface shadow-md backdrop-blur-md transition-all hover:scale-105 hover:text-accent active:scale-95" aria-label={t('tools:koi_tuner.panel.scope', {})}>
                <Settings className="h-4 w-4" aria-hidden="true" />
            </button>;
  }

  /* ── Render helpers ────────────────────────────────────── */

  const renderGroupParams = group => {
    const params = group.params || [];
    return params.filter(param => {
      if (group.conditionalHide && group.conditionalHide(param.id, tuning)) return false;
      const applicability = resolveParamApplicability(param, group);
      if (applicability.hidden) return false;
      return true;
    }).map(sourceParam => {
      const modelRange = resolveKoiEventMotionRange(activeSwimModel, sourceParam.id);
      const param = modelRange ? { ...sourceParam, ...modelRange } : sourceParam;
      if (param.type === 'section') {
        return <KoiTunerParamControl key={param.id} param={param} t={t} />;
      }
      const applicability = resolveParamApplicability(param, group);
      const storedValue = getParamValue(param.id, param);
      const effectiveValue = modelRange ? Math.max(modelRange.min, Math.min(modelRange.max, storedValue)) : storedValue;
      return <KoiTunerParamControl key={param.id} param={param} value={effectiveValue} onParamChange={handleParamChange} onHoverStart={() => setHoveredParam(param.id)} onHoverEnd={() => setHoveredParam(null)} getSelectOptionLabel={getSelectOptionLabel} disabled={applicability.disabled} inactiveReason={applicability.reason} t={t} />;
    });
  };
  const renderBadge = badge => {
    const meta = BADGE_META[badge];
    if (!meta) return null;
    const cls = BADGE_CLASSES[meta.color] || BADGE_CLASSES.slate;
    return <span className={`rounded-md px-2 py-0.5 text-[8px] font-bold ring-1 ring-inset ${cls}`}>
                {t(`tools:koi_tuner.badges.${badge}`, {})}
            </span>;
  };
  const renderKoiColorStrategy = () => {
    if (typeof onSiteKoiColorStrategyChange !== 'function') return null;
    return <div className="mb-4 rounded-lg border border-border/40 bg-surface/20 p-3">
                <div className="mb-2 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-on-surface">
                        {t('tools:koi_tuner.sections.koi_color', {})}
                    </span>
                    <span className="text-[9px] text-on-surface-muted">
                        {siteKoiColorModeLabel}
                    </span>
                </div>
                <div className="inline-flex max-w-full overflow-x-auto rounded-md bg-surface-sunken/60 p-0.5 scrollbar-none">
                    {siteKoiColorModeOptions.map(option => <button key={`koi-color-strategy-${option.id}`} type="button" onClick={() => onSiteKoiColorStrategyChange(option.id)} className={`shrink-0 whitespace-nowrap rounded-[6px] px-2 py-1 text-[10px] font-semibold transition-colors ${resolvedSiteKoiColorStrategy === option.id ? 'bg-accent text-on-accent' : 'text-on-surface-muted hover:bg-surface-sunken/80 hover:text-on-surface'}`}>
                            {option.label}
                        </button>)}
                </div>
            </div>;
  };
  const renderFlowStageControls = () => (
    <div className="border-b border-border/30 bg-surface/35 px-4 py-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[9px] font-bold text-on-surface-muted">
            {t('tools:koi_tuner.panel.pipeline', {})}
          </div>
          <div className="mt-1 inline-flex max-w-full overflow-x-auto rounded-md bg-surface-sunken/60 p-0.5 scrollbar-none">
            {POND_TUNER_FLOW_STAGES.map(stage => (
              <button key={stage.id} type="button" onClick={() => setSelectedFlowStage(stage.id)} className={`shrink-0 whitespace-nowrap rounded-[6px] px-2.5 py-1 text-[10px] font-bold transition-colors ${selectedFlowStage === stage.id ? 'bg-accent text-on-accent' : 'text-on-surface-muted hover:bg-surface/70 hover:text-on-surface'}`}>
                {getFlowStageLabel(t, stage.id)}
              </button>
            ))}
          </div>
        </div>
        <div className="min-w-0 text-right">
          <div className="text-[9px] font-bold text-on-surface-muted">
            {t('tools:koi_tuner.panel.active_model', {})}
          </div>
          <div className="mt-1 truncate text-[10px] font-bold text-on-surface">
            {t(`tools:koi_tuner.model_options.${activeSwimModel}`, {})}
          </div>
        </div>
      </div>
      <div className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-none">
        {activeVisibleGroups.map(group => (
          <button key={group.id} type="button" onClick={() => setOpenGroups(new Set([group.id]))} className={`max-w-[9.5rem] shrink-0 truncate whitespace-nowrap rounded-md border px-2 py-1 text-[9px] font-bold transition-colors ${openGroups.has(group.id) ? 'border-accent/40 bg-accent/12 text-accent' : 'border-border/30 bg-surface/25 text-on-surface-muted hover:text-on-surface'}`}>
            {t(`tools:koi_tuner.groups.${group.id}`, {})}
          </button>
        ))}
      </div>
    </div>
  );
  const renderTargetModeControls = () => (
    <div className="border-b border-border/30 bg-surface/35 px-4 py-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[9px] font-bold text-on-surface-muted">
            {t('tools:koi_tuner.panel.scope', {})}
          </div>
          <div className="mt-1 inline-flex max-w-full overflow-x-auto rounded-md bg-surface-sunken/60 p-0.5 scrollbar-none">
            {CONTROL_PANEL_TARGETS.map(target => (
              <button key={target.id} type="button" onClick={() => {
                setSelectedTarget(target.id);
                setSelectedMode(target.defaultMode || target.modes?.[0] || 'authoring');
              }} className={`shrink-0 whitespace-nowrap rounded-[6px] px-2.5 py-1 text-[10px] font-bold transition-colors ${selectedTarget === target.id ? 'bg-accent text-on-accent' : 'text-on-surface-muted hover:bg-surface/70 hover:text-on-surface'}`}>
                {t(`tools:koi_tuner.targets.${target.id}`, {})}
              </button>
            ))}
          </div>
        </div>
        <div className="min-w-0 text-right">
          <div className="text-[9px] font-bold text-on-surface-muted">
            {t('tools:koi_tuner.panel.active_model', {})}
          </div>
          <div className="mt-1 truncate text-[10px] font-bold text-on-surface">
            {t(`tools:koi_tuner.model_options.${activeSwimModel}`, {})}
          </div>
        </div>
      </div>
      <div className="mb-3 inline-flex max-w-full overflow-x-auto rounded-md bg-surface-sunken/60 p-0.5 scrollbar-none">
        {availableModes.map(mode => (
          <button key={mode.id} type="button" onClick={() => setSelectedMode(mode.id)} className={`shrink-0 whitespace-nowrap rounded-[6px] px-2.5 py-1 text-[10px] font-bold transition-colors ${selectedMode === mode.id ? 'bg-accent text-on-accent' : 'text-on-surface-muted hover:bg-surface/70 hover:text-on-surface'}`}>
            {t(`tools:koi_tuner.modes.${mode.id}`, {})}
          </button>
        ))}
      </div>
      <div className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-none">
        {visibleGroups.map(group => (
          <button key={group.id} type="button" onClick={() => setOpenGroups(new Set([group.id]))} className={`max-w-[9.5rem] shrink-0 truncate whitespace-nowrap rounded-md border px-2 py-1 text-[9px] font-bold transition-colors ${openGroups.has(group.id) ? 'border-accent/40 bg-accent/12 text-accent' : 'border-border/30 bg-surface/25 text-on-surface-muted hover:text-on-surface'}`}>
            {t(`tools:koi_tuner.groups.${group.id}`, {})}
          </button>
        ))}
      </div>
    </div>
  );

  /* ── Main render ──────────────────────────────────────── */

  if (isInspectorLayout) {
    const renderInspectorGroup = (group, index) => (
      <details key={group.id} open={index === 0} className="rounded-xl border border-border/40 bg-surface/40">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-on-surface focus-visible:outline-accent">
          {t(`tools:koi_tuner.groups.${group.id}`, {})}
        </summary>
        <div className="space-y-5 border-t border-border/25 px-4 py-4">
          {group.id === 'koiFeel' && <p className="text-xs leading-relaxed text-on-surface-muted">{t('tools:experiment.pond_lab.workbench.recipe_note')}</p>}
          {(group.id === 'koiLook' || group.id === 'koiBody') && renderKoiColorStrategy()}
          {renderCustomPanel(group) || renderGroupParams(group)}
        </div>
      </details>
    );
    return <div key={inspectorSection} className={`space-y-3 ${className}`}>
      {inspectorGroups.primary.map(renderInspectorGroup)}
      {inspectorGroups.detail.length > 0 && <details className="group">
        <summary className="cursor-pointer rounded-lg px-1 py-3 text-sm font-semibold text-on-surface-muted focus-visible:outline-accent">
          {t('tools:experiment.pond_lab.workbench.precision_controls')}
        </summary>
        <div className="space-y-3 pt-1">{inspectorGroups.detail.map(renderInspectorGroup)}</div>
      </details>}
    </div>;
  }

  return <div className={getShellClass(embedded, className)}>
            {isPondFlowLayout ? renderFlowStageControls() : renderTargetModeControls()}
            {/* Scrollable control surface — no tabs */}
            <div ref={scrollHostRef} className="flex-1 overflow-y-auto px-4 py-5 custom-scrollbar">
                <div className="flex flex-col gap-2">
                    {activeVisibleGroups.map(group => <ControlGroupCard key={group.id} group={group} isOpen={openGroups.has(group.id)} onToggle={toggleGroup} t={t} renderBadge={renderBadge} renderKoiColorStrategy={renderKoiColorStrategy} renderGroupParams={renderGroupParams} renderCustomPanel={renderCustomPanel} />)}
                </div>
            </div>

            {/* Bottom action bar */}
            <KoiTunerActionBar t={t} onHardReset={showHardReset && !hardResetPending && onHardReset ? handleHardReset : null} onReset={onReset} onCopy={handleCopy} hoveredParam={hoveredParam} hoveredHint={hoveredHint} flatParams={FLAT_ALL_PARAMS} />

            <style dangerouslySetInnerHTML={{
      __html: KOI_TUNER_STYLE
    }} />
        </div>;
}
