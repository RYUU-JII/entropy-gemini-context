import React, { useMemo, useState } from 'react';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';

import { DEFAULT_SHISHI_ODOSHI_TUNING, resolveShishiOdoshiTuning } from './recipes/zenShishiOdoshiTuning.js';

const PARAM_GROUPS = Object.freeze([
  {
    id: 'balance',
    label: 'Balance',
    icon: 'BL',
    params: [
      { id: 'minAngle', label: 'Min Angle', min: -60.0, max: -8.0, step: 0.5, desc: '덤프 방향 최저 각도 제한입니다. 더 작을수록 깊게 내려갑니다.' },
      { id: 'maxAngle', label: 'Max Angle', min: 8.0, max: 40.0, step: 0.5, desc: '복귀 방향 최고 각도 제한입니다.' },
      { id: 'spring', label: 'Return Spring', min: 4.0, max: 16.0, step: 0.1, desc: '물이 비었을 때 원위치로 돌아오는 힘입니다.' },
      { id: 'angularDrag', label: 'Angular Drag', min: 0.5, max: 5.0, step: 0.05, desc: '대나무의 공기 저항(마찰)입니다.' },
      { id: 'balancePivotFill', label: 'Balance Fill', min: 0.1, max: 0.95, step: 0.01, desc: '이 수위를 기준으로 대나무의 무게 균형이 바뀝니다.' },
      { id: 'balanceGain', label: 'Sensitivity', min: 10.0, max: 120.0, step: 1.0, desc: '수위 변화가 기울기에 미치는 강도입니다.' },
      { id: 'stickTorqueThreshold', label: 'Torque Threshold', min: 0.0, max: 40.0, step: 0.5, desc: '작은 토크에서는 정지 상태를 유지합니다.' },
      { id: 'stickOmegaThreshold', label: 'Velocity Threshold', min: 0.0, max: 6.0, step: 0.05, desc: '작은 각속도에서는 정지 상태를 유지합니다.' },
    ],
  },
  {
    id: 'flow',
    label: 'Flow',
    icon: 'FL',
    params: [
      { id: 'inflowRate', label: 'Inflow Rate', min: 0.02, max: 0.4, step: 0.005, desc: '정상 상태에서 물이 차오르는 속도입니다.' },
      { id: 'outflowRate', label: 'Outflow Rate', min: 0.5, max: 6.0, step: 0.05, desc: '덤프 상태에서 물이 빠지는 속도입니다.' },
      { id: 'spillStartAngle', label: 'Spill Angle', min: -10.0, max: 20.0, step: 0.1, desc: '이 각도 부근부터 물이 본격적으로 쏟아집니다.' },
      { id: 'spillBandDeg', label: 'Spill Width', min: 2.0, max: 30.0, step: 0.1, desc: '배출이 0에서 100%로 올라가는 각도 폭입니다.' },
      { id: 'spillPull', label: 'Spill Assist', min: 0.0, max: 1200.0, step: 5.0, desc: '배출 중 하강을 보조하는 토크입니다.' },
      { id: 'fillRateTorque', label: 'Rapid Inflow Assist', min: 0.0, max: 300.0, step: 1.0, desc: '물이 빨리 찰수록 하강 토크를 더해 차이를 만듭니다.' },
      { id: 'fillRateResponse', label: 'Response Speed', min: 0.5, max: 20.0, step: 0.1, desc: '빠른 유입 감지(저역통과) 반응 속도입니다.' },
    ],
  },
  {
    id: 'impact',
    label: 'Impact',
    icon: 'IM',
    params: [
      { id: 'impactAngle', label: 'Impact Angle', min: 8.0, max: 23.0, step: 0.1, desc: '꼬리 타격 판정 각도입니다.' },
      { id: 'impactMinSpeed', label: 'Min Speed', min: 8.0, max: 80.0, step: 0.5, desc: '충돌 펄스가 발동되는 최소 속도입니다.' },
      { id: 'impactRestitution', label: 'Restitution', min: 0.0, max: 1.0, step: 0.01, desc: '충돌 후 반대로 튀어 나오는 비율입니다.' },
      { id: 'pulseDecayPerSec', label: 'Ground Decay', min: 1.0, max: 12.0, step: 0.1, desc: '지면 스플래시가 사라지는 속도입니다.' },
      { id: 'lipDecayPerSec', label: 'Lip Decay', min: 1.0, max: 12.0, step: 0.1, desc: '입구 스플래시가 사라지는 속도입니다.' },
    ],
  },
]);

export default function ZenShishiOdoshiTuner({
  tuning = DEFAULT_SHISHI_ODOSHI_TUNING,
  onTuningChange,
  onReset,
  embedded = false,
  className = '',
}) {
  const { t } = useAppTranslation('tools');
  const [activeGroupId, setActiveGroupId] = useState(PARAM_GROUPS[0].id);
  const [hoveredParam, setHoveredParam] = useState(null);
  const [copied, setCopied] = useState(false);

  const normalized = useMemo(() => resolveShishiOdoshiTuning(tuning), [tuning]);
  const activeGroup = useMemo(
    () => PARAM_GROUPS.find((group) => group.id === activeGroupId) || PARAM_GROUPS[0],
    [activeGroupId],
  );

  const handleParamChange = (id, value) => {
    const source = tuning && typeof tuning === 'object' ? tuning : {};
    onTuningChange?.({
      ...source,
      [id]: value,
    });
  };

  const activeDescription = useMemo(() => {
    if (!hoveredParam) return t('tools:shishi_tuner.default_hint');
    for (const group of PARAM_GROUPS) {
      const found = group.params.find((param) => param.id === hoveredParam);
      if (found) return found.desc;
    }
    return t('tools:shishi_tuner.default_hint');
  }, [hoveredParam, t]);

  const shellClass = embedded
    ? `flex h-full w-full flex-col overflow-hidden rounded-2xl border border-border/40 bg-surface-sunken/80 shadow-lg backdrop-blur-xl ${className}`
    : 'fixed top-4 right-4 z-[9999] flex h-[640px] w-[320px] flex-col overflow-hidden rounded-2xl border border-border/40 bg-surface-sunken/80 shadow-2xl backdrop-blur-xl';

  return (
    <div className={shellClass}>
      <div className="flex items-center justify-between border-b border-border/40 px-5 py-4 bg-surface/40">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface text-[10px] font-black shadow-sm ring-1 ring-border/20">SH</div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-on-surface">{t('tools:shishi_tuner.header')}</h2>
        </div>
      </div>

      <div className="flex border-b border-border/40 bg-surface/20">
        {PARAM_GROUPS.map((group) => (
          <button
            key={group.id}
            type="button"
            onClick={() => setActiveGroupId(group.id)}
            className={`group relative flex flex-1 flex-col items-center gap-1.5 py-3 transition-all ${
              activeGroup.id === group.id ? 'bg-surface/60 text-accent' : 'text-on-surface-muted hover:text-on-surface'
            }`}
          >
            <span className={`text-sm transition-transform ${activeGroup.id === group.id ? 'scale-110' : 'opacity-70'}`}>{group.icon}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider">{t(`tools:shishi_tuner.tabs.${group.id}`)}</span>
            {activeGroup.id === group.id ? (
              <div className="absolute bottom-0 left-0 h-[2px] w-full bg-accent" />
            ) : null}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6 custom-scrollbar">
        <div className="flex flex-col gap-6">
          {activeGroup.params.map((param) => {
            const raw = normalized[param.id] ?? DEFAULT_SHISHI_ODOSHI_TUNING[param.id];
            const ratio = ((raw - param.min) / (param.max - param.min)) * 100;
            return (
              <div
                key={param.id}
                className="group relative"
                onMouseEnter={() => setHoveredParam(param.id)}
                onMouseLeave={() => setHoveredParam(null)}
              >
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-muted group-hover:text-on-surface transition-colors">
                    {t(`tools:shishi_tuner.params.${param.id}`)}
                  </label>
                  <span className="font-mono text-xs font-bold text-accent">
                    {raw.toFixed(3)}
                  </span>
                </div>

                <div className="relative flex items-center h-4">
                  <div className="absolute h-1.5 w-full rounded-full bg-surface-sunken ring-1 ring-inset ring-border/20 overflow-hidden">
                    <div className="h-full bg-accent/60 rounded-full" style={{ width: `${ratio}%` }} />
                  </div>
                  <input
                    type="range"
                    min={param.min}
                    max={param.max}
                    step={param.step}
                    value={raw}
                    onChange={(event) => handleParamChange(param.id, parseFloat(event.target.value))}
                    className="absolute w-full h-full bg-transparent appearance-none cursor-pointer"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t border-border/40 p-4 bg-surface/40">
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={() => {
              onReset?.();
              setCopied(false);
            }}
            className="flex-1 rounded-xl bg-surface-sunken py-2.5 text-[10px] font-bold uppercase tracking-widest text-on-surface-muted transition-all hover:bg-surface hover:text-on-surface active:scale-[0.98] ring-1 ring-border/20"
          >
            {t('tools:shishi_tuner.actions.reset')}
          </button>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(JSON.stringify(normalized, null, 2));
                setCopied(true);
              } catch (error) {
                setCopied(false);
              }
            }}
            className="flex-1 rounded-xl bg-accent/10 py-2.5 text-[10px] font-bold uppercase tracking-widest text-accent transition-all hover:bg-accent/20 hover:text-accent active:scale-[0.98] ring-1 ring-accent/20"
          >
            {copied ? t('tools:shishi_tuner.actions.copied') : t('tools:shishi_tuner.actions.copy')}
          </button>
        </div>
        <div className="h-8 flex items-center justify-center px-2 text-center">
          <p className="text-[10px] font-medium leading-relaxed text-on-surface-muted transition-colors">
            {activeDescription}
          </p>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
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
          `,
        }}
      />
    </div>
  );
}
