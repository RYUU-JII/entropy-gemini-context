import { DEFAULT_FURIN_TUNING } from './recipes/zenFurinRuntimeRecipe.js';
export { DEFAULT_FURIN_TUNING } from './recipes/zenFurinRuntimeRecipe.js';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useToast } from '@/ui-kit';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
const TABS = [{
  id: 'physics',
  label: 'Physics',
  icon: '⚖️'
}, {
  id: 'environment',
  label: 'Environment',
  icon: '💨'
}];
const SUB_TABS = {
  physics: [{
    id: 'mass',
    label: 'Mass'
  }, {
    id: 'damping',
    label: 'Damping'
  }],
  environment: [{
    id: 'wind',
    label: 'Wind Settings'
  }]
};
const WIND_DEBUG_MODES = [{
  id: 'off',
  label: 'Natural',
  desc: '기본 난류/돌풍 모델만 사용합니다.'
}, {
  id: 'fixed_left',
  label: 'Fixed Left',
  desc: '설정한 세기의 고정 좌풍을 사용합니다.'
}, {
  id: 'fixed_right',
  label: 'Fixed Right',
  desc: '설정한 세기의 고정 우풍을 사용합니다.'
}, {
  id: 'cycle_lr',
  label: 'Cycle L/R',
  desc: 'N초마다 좌풍/우풍을 교대로 전환합니다.'
}, {
  id: 'cycle_rl',
  label: 'Cycle R/L',
  desc: 'N초마다 우풍/좌풍을 교대로 전환합니다.'
}];
const PARAMS = {
  physics: {
    mass: [{
      id: 'M_BELL',
      label: 'Bell Mass',
      min: 1.0,
      max: 15.0,
      step: 0.5,
      desc: '타종자가 부딪힐 때 종이 밀리는 저항성입니다. 높을수록 무겁게 움직입니다.'
    }, {
      id: 'M_STRIKER',
      label: 'Striker Mass',
      min: 0.1,
      max: 5.0,
      step: 0.1,
      desc: '타종자의 질량입니다. 충격 에너지를 결정합니다.'
    }, {
      id: 'M_PAPER',
      label: 'Paper Mass',
      min: 0.05,
      max: 1.0,
      step: 0.05,
      desc: '단책(종이)의 무게입니다. 가벼울수록 바람에 쉽게 나부낍니다.'
    }],
    damping: [{
      id: 'DAMP_BELL',
      label: 'Bell Damping',
      min: 0.1,
      max: 3.0,
      step: 0.05,
      desc: '종의 공기/마찰 저항입니다. 초당 감쇠 계수로, 높을수록 빨리 멈춥니다.'
    }, {
      id: 'DAMP_STRIKER',
      label: 'Striker Damping',
      min: 0.1,
      max: 3.0,
      step: 0.05,
      desc: '막대의 공기 저항입니다.'
    }, {
      id: 'DAMP_PAPER',
      label: 'Paper Damping',
      min: 0.1,
      max: 3.0,
      step: 0.05,
      desc: '종이의 펄럭임 저항입니다.'
    }],

  },
  environment: {
    wind: [{
      id: 'WIND_MULT',
      label: 'Wind Multiplier',
      min: 0.0,
      max: 10.0,
      step: 0.1,
      desc: '전체적인 바람의 세기입니다. 높을수록 세게 붑니다.'
    }, {
      id: 'G',
      label: 'Gravity Pull',
      min: 200,
      max: 1000,
      step: 20,
      desc: 'SVG 단위/초²의 중력 강도입니다. 높을수록 모든 물체가 수직으로 강하게 당겨집니다.'
    }, {
      id: 'WIND_DEBUG_STRENGTH',
      label: 'Debug Wind Strength',
      min: 0.0,
      max: 2.0,
      step: 0.05,
      desc: '고정/주기 디버그 풍향의 목표 세기입니다.'
    }, {
      id: 'WIND_DEBUG_PERIOD_SEC',
      label: 'Debug Switch Period (sec)',
      min: 0.5,
      max: 20.0,
      step: 0.5,
      desc: 'Cycle 모드에서 풍향을 전환하는 주기(초)입니다.'
    }, {
      id: 'WIND_DEBUG_MIX',
      label: 'Debug Mix (0..1)',
      min: 0.0,
      max: 1.0,
      step: 0.05,
      desc: '0은 자연풍만, 1은 디버그 풍향만 사용합니다.'
    }]
  }
};

export default function ZenFurinTuner({
  tuning = DEFAULT_FURIN_TUNING,
  onTuningChange,
  onReset,
  embedded = false,
  className = ''
}) {
  const { t } = useAppTranslation('tools');
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('physics');
  const [activeSubTab, setActiveSubTab] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hoveredParam, setHoveredParam] = useState(null);

  // Reset sub-tab when main tab changes
  useEffect(() => {
    if (SUB_TABS[activeTab]) {
      setActiveSubTab(SUB_TABS[activeTab][0].id);
    } else {
      setActiveSubTab(null);
    }
  }, [activeTab]);
  const activeParams = useMemo(() => {
    if (Array.isArray(PARAMS[activeTab])) {
      return PARAMS[activeTab];
    }
    if (activeSubTab && PARAMS[activeTab][activeSubTab]) {
      return PARAMS[activeTab][activeSubTab];
    }
    return [];
  }, [activeTab, activeSubTab]);
  const handleParamChange = (id, value) => {
    onTuningChange({
      ...tuning,
      [id]: value
    });
  };
  const activeWindDebugMode = typeof tuning?.WIND_DEBUG_MODE === 'string' ? tuning.WIND_DEBUG_MODE : DEFAULT_FURIN_TUNING.WIND_DEBUG_MODE;
  const handleWindDebugModeChange = modeId => {
    onTuningChange({
      ...tuning,
      WIND_DEBUG_MODE: modeId
    });
  };
  const getParamValue = id => {
    return tuning[id] ?? DEFAULT_FURIN_TUNING[id];
  };
  const handleCopy = useCallback(async () => {
    const payload = JSON.stringify(tuning, null, 2);
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
      toast.success(t('tools:shishi_tuner.actions.copied'), {
        dedupeKey: 'furin-tuner-copied'
      });
      return;
    }
    toast.error(t('tools:shishi_tuner.actions.copy_failed', {}), {
      dedupeKey: 'furin-tuner-copy-failed'
    });
  }, [toast, t, tuning]);
  if (isCollapsed) {
    if (embedded) {
      return <div className={`flex h-full w-full items-start justify-end ${className}`}>
                    <button onClick={() => setIsCollapsed(false)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/20 bg-surface/80 shadow-md backdrop-blur-md transition-all hover:scale-105 active:scale-95 text-on-surface hover:text-accent">
                        <span className="text-lg">⚙️</span>
                    </button>
                </div>;
    }
    return <button onClick={() => setIsCollapsed(false)} className="fixed top-4 right-4 z-[9999] flex h-10 w-10 items-center justify-center rounded-xl border border-border/20 bg-surface/80 shadow-md backdrop-blur-md transition-all hover:scale-105 active:scale-95 text-on-surface hover:text-accent">
                <span className="text-lg">⚙️</span>
            </button>;
  }
  const shellClass = embedded ? `flex h-full w-full flex-col overflow-hidden rounded-2xl border border-border/40 bg-surface-sunken/80 shadow-lg backdrop-blur-xl ${className}` : 'fixed top-4 right-4 z-[9999] flex h-[640px] w-[320px] flex-col overflow-hidden rounded-2xl border border-border/40 bg-surface-sunken/80 shadow-2xl backdrop-blur-xl';
  return <div className={shellClass}>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/40 px-5 py-4 bg-surface/40">
                <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface text-sm shadow-sm ring-1 ring-border/20">🎐</div>
                    <h2 className="text-xs font-bold uppercase tracking-widest text-on-surface">{t('tools:furin_tuner.header')}</h2>
                </div>
                <button onClick={() => setIsCollapsed(true)} className="flex h-6 w-6 items-center justify-center rounded-md text-on-surface-muted hover:bg-surface-sunken hover:text-on-surface transition-colors">
                    ✕
                </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border/40 bg-surface/20">
                {TABS.map(tab => <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`group relative flex flex-1 flex-col items-center gap-1.5 py-3.5 transition-all ${activeTab === tab.id ? 'bg-surface/60 text-accent' : 'text-on-surface-muted hover:text-on-surface'}`}>
                        <span className={`text-sm transition-transform ${activeTab === tab.id ? 'scale-110' : 'opacity-60 grayscale group-hover:grayscale-0'}`}>{tab.icon}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider">{t(`tools:furin_tuner.tabs.${tab.id}`)}</span>
                        {activeTab === tab.id && <div className="absolute bottom-0 left-0 h-[2px] w-full bg-accent" />}
                    </button>)}
            </div>

            {/* Sub Tabs */}
            {SUB_TABS[activeTab] && <div className="flex items-center gap-1 overflow-x-auto border-b border-border/40 px-4 py-2 scrollbar-none bg-surface/10">
                    {SUB_TABS[activeTab].map(sub => <button key={sub.id} onClick={() => setActiveSubTab(sub.id)} className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all ${activeSubTab === sub.id ? 'bg-accent/10 text-accent ring-1 ring-accent/30' : 'text-on-surface-muted hover:bg-surface-sunken hover:text-on-surface'}`}>
                            {t(`tools:furin_tuner.sub_tabs.${sub.id}`)}
                        </button>)}
                </div>}

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto px-5 py-6 custom-scrollbar">
                <div className="flex flex-col gap-6">
                    {activeTab === 'environment' && activeSubTab === 'wind' && <div className="rounded-xl border border-border/40 bg-surface/20 p-3.5">
                            <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-on-surface-muted">
                                {t('tools:furin_tuner.wind_debug.header')}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                {WIND_DEBUG_MODES.map(mode => <button key={mode.id} type="button" onClick={() => handleWindDebugModeChange(mode.id)} onMouseEnter={() => setHoveredParam(mode.id)} onMouseLeave={() => setHoveredParam(null)} className={`rounded-lg px-2.5 py-2 text-[10px] font-bold uppercase tracking-wide transition-colors ${activeWindDebugMode === mode.id ? 'bg-accent/15 text-accent ring-1 ring-accent/40' : 'bg-surface-sunken/60 text-on-surface-muted hover:text-on-surface'}`}>
                                        {t(`tools:furin_tuner.wind_debug.modes.${mode.id}`)}
                                    </button>)}
                            </div>
                        </div>}
                    {activeParams.map(param => <div key={param.id} className="group relative" onMouseEnter={() => setHoveredParam(param.id)} onMouseLeave={() => setHoveredParam(null)}>
                            <div className="mb-2 flex items-center justify-between">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-muted group-hover:text-on-surface transition-colors">
                                    {t(`tools:furin_tuner.params.${param.id}`)}
                                </label>
                                <span className="font-mono text-xs font-bold text-accent">
                                    {typeof getParamValue(param.id) === 'number' ? getParamValue(param.id).toFixed(3) : getParamValue(param.id)}
                                </span>
                            </div>

                            <div className="relative flex items-center h-4">
                                <div className="absolute h-1.5 w-full rounded-full bg-surface-sunken ring-1 ring-inset ring-border/20 overflow-hidden">
                                    <div className="h-full bg-accent/60 rounded-full" style={{
                width: `${(getParamValue(param.id) - (param.min || 0)) / ((param.max || 1) - (param.min || 0)) * 100}%`
              }} />
                                </div>
                                <input type="range" min={param.min} max={param.max} step={param.step} value={getParamValue(param.id)} onChange={e => handleParamChange(param.id, parseFloat(e.target.value))} className="absolute w-full h-full bg-transparent appearance-none cursor-pointer" />
                            </div>
                        </div>)}
                </div>
            </div>

            {/* Footer */}
            <div className="border-t border-border/40 p-4 bg-surface/40">
                <div className="flex gap-2 mb-3">
                    <button onClick={onReset} className="flex-1 rounded-xl bg-surface-sunken py-2.5 text-[10px] font-bold uppercase tracking-widest text-on-surface-muted transition-all hover:bg-surface hover:text-on-surface active:scale-[0.98] ring-1 ring-border/20">
                        {t('tools:shishi_tuner.actions.reset')}
                    </button>
                    <button onClick={handleCopy} className="flex-1 rounded-xl bg-accent/10 py-2.5 text-[10px] font-bold uppercase tracking-widest text-accent transition-all hover:bg-accent/20 hover:text-accent active:scale-[0.98] ring-1 ring-accent/20">
                        {t('tools:shishi_tuner.actions.copy')}
                    </button>
                </div>
                <div className="h-8 flex items-center justify-center px-2 text-center">
                    <p className="text-[10px] font-medium leading-relaxed text-on-surface-muted transition-colors animate-in fade-in slide-in-from-bottom-1">
                        {hoveredParam ? [...Object.values(PARAMS.physics).flat(), ...Object.values(PARAMS.environment).flat(), ...WIND_DEBUG_MODES].find(p => p.id === hoveredParam)?.desc : t('tools:furin_tuner.default_hint')}
                    </p>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
      __html: `
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
            `
    }} />
        </div>;
}
