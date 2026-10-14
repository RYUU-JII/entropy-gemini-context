import React from 'react';
import { useResolvedThemeState } from '@/themes/core/react/useResolvedThemeState.js';

export default function RangeInput({
  id,
  value,
  min,
  max,
  step,
  onChange,
  onInput,
  disabled,
  className,
  dataKey,
  ariaLabel,
  inputProps,
  variant, // 'default' | 'fader'
}) {
  const { themeProfile } = useResolvedThemeState();
  const shouldUseFader = variant === 'fader' || themeProfile?.rangeInputStyle === 'fader';
  const inputClass = [
    'range-input w-full min-w-0 cursor-pointer bg-transparent accent-[var(--color-accent)]',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]',
    'disabled:cursor-not-allowed disabled:opacity-60',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  const resolvedAriaLabel = inputProps?.['aria-label'] ?? ariaLabel;
  const resolvedValue = value === '' || value === null || value === undefined ? min ?? 0 : value;
  const numericValue = Number.parseFloat(resolvedValue);
  const minValue = Number.parseFloat(min ?? 0);
  const maxValue = Number.parseFloat(max ?? 100);
  const safeValue = Number.isFinite(numericValue) ? numericValue : minValue;
  const range = Number.isFinite(maxValue - minValue) && maxValue !== minValue ? maxValue - minValue : 1;
  const progress = Math.min(100, Math.max(0, ((safeValue - minValue) / range) * 100));

  if (shouldUseFader) {
    return (
      <div
        className={['ui-fader', disabled ? 'is-disabled' : ''].filter(Boolean).join(' ')}
        style={{ '--fader-progress': `${progress}%` }}
      >
        <div className="ui-fader-track">
          <div className="ui-fader-fill" />
          <div className="ui-fader-knob" />
        </div>
        <input
          type="range"
          id={id}
          className={['ui-fader-input', className].filter(Boolean).join(' ')}
          value={resolvedValue}
          min={min}
          max={max}
          step={step}
          onChange={onChange}
          onInput={onInput}
          disabled={disabled}
          data-key={dataKey}
          aria-label={resolvedAriaLabel}
          {...inputProps}
        />
      </div>
    );
  }

  return (
    <input
      type="range"
      id={id}
      className={inputClass}
      value={resolvedValue}
      min={min}
      max={max}
      step={step}
      onChange={onChange}
      onInput={onInput}
      disabled={disabled}
      data-key={dataKey}
      aria-label={resolvedAriaLabel}
      {...inputProps}
    />
  );
}
