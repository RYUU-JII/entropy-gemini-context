import React, { useEffect, useState } from 'react';

function PreciseValue({ value, param, label, disabled, onCommit }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { setDraft(String(value)); }, [value]);
  const commit = () => {
    const number = Number(draft);
    if (!draft.trim() || !Number.isFinite(number)) { setDraft(String(value)); return; }
    const next = Math.min(param.max, Math.max(param.min, number));
    setDraft(String(next));
    if (next !== value) onCommit(param.id, next, param);
  };
  return <input type="number" aria-label={label} disabled={disabled} min={param.min} max={param.max} step={param.step}
    value={draft} onChange={event => setDraft(event.target.value)} onBlur={commit}
    onKeyDown={event => {
      if (event.key === 'Enter') event.currentTarget.blur();
      if (event.key === 'Escape') setDraft(String(value));
    }} className="w-20 rounded-md border border-border/40 bg-surface px-2 py-1 text-right font-mono text-xs text-on-surface focus:outline-hidden focus:ring-2 focus:ring-accent/40" />;
}
export default function KoiTunerParamControl({
  param,
  value,
  onParamChange,
  onHoverStart,
  onHoverEnd,
  getSelectOptionLabel,
  disabled = false,
  inactiveReason = '',
  t
}) {
  if (param.type === 'section') {
    const sectionId = typeof param.id === 'string' && param.id.startsWith('section_')
      ? param.id.slice('section_'.length)
      : param.id;
    const sectionKey = `tools:koi_tuner.sections.${sectionId}`;
    const sectionLabel = t(sectionKey, {});
    return <div className="border-t border-border/30 pt-3 first:border-t-0 first:pt-0">
                <h3 className="text-[10px] font-bold text-on-surface">
                    {sectionLabel === sectionKey ? (param.label || sectionLabel) : sectionLabel}
                </h3>
            </div>;
  }
  const selectedOption = param.type === 'select' ? param?.options?.find(option => option.value === value) : null;
  const selectedOptionLabel = param.type === 'select' ? getSelectOptionLabel(param, selectedOption) : null;
  const min = param.min || 0;
  const max = param.max || 1;
  const numericValue = typeof value === 'number' ? value : min;
  const progress = (numericValue - min) / (max - min || 1) * 100;
  const label = t(`tools:koi_tuner.params.${param.id}`, {});
  return <div className={`group relative ${disabled ? 'opacity-55' : ''}`} onMouseEnter={onHoverStart} onMouseLeave={onHoverEnd}>
            <div className="mb-1.5 flex items-start justify-between gap-2">
                <label className="min-w-0 text-[10px] font-bold text-on-surface-muted transition-colors group-hover:text-on-surface">
                    {t(`tools:koi_tuner.params.${param.id}`, {})}
                </label>
                {param.type !== 'toggle' && param.type !== 'select' ? <PreciseValue value={value} param={param} label={label} disabled={disabled} onCommit={onParamChange} /> : <span className="max-w-[8rem] shrink-0 truncate text-right font-mono text-xs font-bold text-accent">
                    {param.type === 'toggle' ? value ? 'ON' : 'OFF' : param.type === 'select' ? selectedOptionLabel || String(value) : typeof value === 'number' ? value.toFixed(3) : String(value)}
                </span>}
            </div>

            {/* Inline description — always visible */}
            {param.desc && <p className="mb-2 break-words text-[9px] leading-relaxed text-on-surface-muted/70">
                    {param.desc}
                </p>}
            {disabled && inactiveReason ? <p className="mb-2 break-words rounded-md border border-border/25 bg-surface-sunken/40 px-2 py-1 text-[9px] leading-relaxed text-on-surface-muted">
                    {inactiveReason}
                </p> : null}

            {param.type === 'toggle' ? <button type="button" role="switch" aria-label={label} aria-checked={!!value} disabled={disabled} onClick={() => onParamChange(param.id, !value, param)} className={`relative flex h-6 w-11 items-center rounded-full transition-colors ring-1 ring-inset ${disabled ? 'cursor-not-allowed' : ''} ${value ? 'bg-accent ring-accent/20' : 'bg-surface-sunken ring-border/30'}`}>
                    <div className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${value ? 'translate-x-6' : 'translate-x-1'}`} />
                </button> : param.type === 'select' ? <select aria-label={label} disabled={disabled} value={value} onChange={event => onParamChange(param.id, event.target.value, param)} className={`w-full min-w-0 rounded-md border border-border/40 bg-surface/70 px-2.5 py-1.5 text-xs text-on-surface focus:outline-hidden focus:ring-2 focus:ring-accent/40 ${disabled ? 'cursor-not-allowed' : ''}`}>
                    {(param.options || []).map(option => <option key={option.value} value={option.value}>
                            {getSelectOptionLabel(param, option)}
                        </option>)}
                </select> : <div className="relative flex items-center h-4">
                    <div className="absolute h-1.5 w-full rounded-full bg-surface-sunken ring-1 ring-inset ring-border/20 overflow-hidden">
                        <div className="h-full bg-accent/60 rounded-full" style={{
          width: `${progress}%`
        }} />
                    </div>
                    <input aria-label={label} disabled={disabled} type="range" min={param.min} max={param.max} step={param.step} value={value} onChange={event => onParamChange(param.id, parseFloat(event.target.value), param)} className={`absolute w-full h-full bg-transparent appearance-none ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`} />
                </div>}
        </div>;
}
