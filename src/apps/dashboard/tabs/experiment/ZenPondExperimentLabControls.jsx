import React from 'react';

export function LabPanel({ icon: Icon, title, badge, children, className = '' }) {
    return (
        <section className={`min-w-0 rounded-[8px] border border-on-surface/10 bg-surface/85 p-3 shadow-sm ${className}`}>
            <div className="flex min-w-0 items-center gap-2">
                {Icon ? (
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-surface-sunken text-on-surface-muted">
                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                ) : null}
                <h4 className="min-w-0 truncate text-xs font-black uppercase text-on-surface">
                    {title}
                </h4>
                {badge ? (
                    <span className="ml-auto shrink-0 rounded-full bg-surface-sunken px-2 py-0.5 text-[10px] font-semibold text-on-surface-muted">
                        {badge}
                    </span>
                ) : null}
            </div>
            <div className="mt-3 min-w-0">
                {children}
            </div>
        </section>
    );
}

export function IconButton({ icon: Icon, label, active, disabled = false, onClick, actionId }) {
    return (
        <button
            type="button"
            aria-pressed={active}
            data-pond-action={actionId}
            title={label}
            disabled={disabled}
            onClick={onClick}
            className={`inline-flex h-8 items-center gap-1.5 rounded-[8px] border px-2.5 text-[10px] font-black uppercase transition-colors focus:outline-hidden focus:ring-2 focus:ring-accent/35 ${active
                ? 'border-accent/35 bg-accent text-on-accent'
                : 'border-on-surface/10 bg-surface-sunken text-on-surface-muted hover:border-accent/30 hover:text-on-surface'
                } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
        >
            {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden="true" /> : null}
            <span>{label}</span>
        </button>
    );
}

export function EffectToggle({ label, active, disabled = false, onToggle }) {
    return (
        <button
            type="button"
            aria-pressed={active}
            disabled={disabled}
            onClick={() => onToggle(!active)}
            className={`h-8 min-w-0 rounded-[8px] border px-2 text-[10px] font-semibold transition-colors focus:outline-hidden focus:ring-2 focus:ring-accent/30 ${active
                ? 'border-accent/35 bg-accent/15 text-on-surface'
                : 'border-on-surface/10 bg-surface-sunken/65 text-on-surface-muted hover:text-on-surface'
                } ${disabled ? 'cursor-not-allowed opacity-45' : ''}`}
        >
            <span className="block truncate">{label}</span>
        </button>
    );
}

export function LabSelect({ label, value, options, onChange, getLabel, disabled = false }) {
    return (
        <label className="block min-w-0">
            <span className="mb-1 block truncate text-[10px] font-semibold uppercase text-on-surface-muted">
                {label}
            </span>
            <select
                disabled={disabled}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="h-8 w-full rounded-[8px] border border-on-surface/10 bg-surface-sunken px-2 text-xs font-semibold text-on-surface focus:outline-hidden focus:ring-2 focus:ring-accent/30"
            >
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {getLabel ? getLabel(option) : option.label || option.value}
                    </option>
                ))}
            </select>
        </label>
    );
}

export function LabSlider({
    label,
    value,
    min,
    max,
    step,
    valueLabel,
    disabled = false,
    onChange,
}) {
    return (
        <label className={`block min-w-0 rounded-[8px] border border-on-surface/10 bg-surface-sunken/45 px-2.5 py-2 ${disabled ? 'opacity-50' : ''}`}>
            <span className="flex min-w-0 items-center justify-between gap-2">
                <span className="min-w-0 truncate text-[10px] font-semibold uppercase text-on-surface-muted">
                    {label}
                </span>
                <span className="shrink-0 text-[10px] font-bold tabular-nums text-on-surface">
                    {valueLabel}
                </span>
            </span>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                disabled={disabled}
                aria-label={label}
                onChange={(event) => onChange(Number(event.target.value))}
                className="mt-2 h-2 w-full accent-accent"
            />
        </label>
    );
}

export function LabSwitch({ label, active, onChange }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={active}
            onClick={() => onChange(!active)}
            className={`flex h-8 min-w-0 items-center justify-between gap-2 rounded-[8px] border px-2.5 text-[10px] font-semibold transition-colors ${active
                ? 'border-accent/35 bg-accent/15 text-on-surface'
                : 'border-on-surface/10 bg-surface-sunken/65 text-on-surface-muted hover:text-on-surface'
                }`}
        >
            <span className="min-w-0 truncate">{label}</span>
            <span
                aria-hidden="true"
                className={`relative h-4 w-7 shrink-0 rounded-full border transition-colors ${active
                    ? 'border-accent/45 bg-accent/30'
                    : 'border-on-surface/15 bg-surface'
                    }`}
            >
                <span
                    className={`absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-on-surface shadow-sm transition-transform ${active
                        ? 'translate-x-[13px]'
                        : 'translate-x-[2px]'
                        }`}
                />
            </span>
        </button>
    );
}
