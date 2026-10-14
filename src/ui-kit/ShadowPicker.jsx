import React, { useEffect, useState } from 'react';
import { useAppTranslation } from './hooks/useAppTranslation.js';
import RangeInput from './RangeInput.jsx';

export default function ShadowPicker({
  id,
  dataKey,
  level,
  colorKey,
  levels,
  colors,
  disabled,
  outputLabel,
  onLevelChange,
  onColorChange,
}) {
  const { t } = useAppTranslation('common');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (disabled && isOpen) setIsOpen(false);
  }, [disabled, isOpen]);

  const resolvedLevels = Array.isArray(levels) && levels.length > 0 ? levels : [{ level: 1, label: 'Lv1' }];
  const resolvedColors = Array.isArray(colors) && colors.length > 0
    ? colors
    : [{ key: 'default', label: t('controls.color'), css: '#000' }];
  const maxLevel = resolvedLevels.length;
  const resolvedLevel = Number.isFinite(Number(level)) ? Math.max(1, Math.min(maxLevel, Number(level))) : 1;
  const activeColor = resolvedColors.find((color) => color.key === colorKey) || resolvedColors[0];
  const resolvedOutput =
    outputLabel ??
    (disabled
      ? t('controls.off')
      : resolvedLevels.find((entry) => entry.level === resolvedLevel)?.label || `Lv${resolvedLevel}`);

  const handleLevelChange = (event) => {
    const next = parseInt(event.target.value, 10);
    if (Number.isFinite(next)) onLevelChange?.(next);
  };

  return (
    <div className="flex w-full min-w-0 items-center gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <RangeInput
          id={id}
          className="range-input-stepped"
          value={resolvedLevel}
          min={1}
          max={maxLevel}
          step={1}
          onChange={handleLevelChange}
          disabled={disabled}
          ariaLabel={t('controls.shadow_intensity')}
          dataKey={dataKey}
        />
        <output
          className="min-w-[52px] rounded-full border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1 text-center text-[11px] font-extrabold text-[var(--color-on-surface)] tabular-nums"
          data-shadow-output="true"
        >
          {resolvedOutput}
        </output>
      </div>
      <div className="relative shrink-0">
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-background)] transition hover:border-[var(--color-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-60"
          aria-expanded={isOpen ? 'true' : 'false'}
          aria-label={t('controls.select_shadow_color')}
          disabled={disabled}
          onClick={() => setIsOpen((prev) => !prev)}
        >
          <span
            className="h-4 w-4 rounded-full border border-[color-mix(in_srgb,var(--color-border)_70%,transparent)] bg-[var(--shadow-color)]"
            data-shadow-swatch="true"
            style={{ '--shadow-color': activeColor?.css || '#000' }}
          ></span>
        </button>
        <div
          className={`absolute right-0 top-full mt-2 grid grid-cols-3 gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-2 shadow-[var(--shadow-sm)] ${
            isOpen ? 'grid' : 'hidden'
          }`}
          role="menu"
        >
          {resolvedColors.map((color) => (
            <button
              key={color.key}
              type="button"
              className={`h-4 w-4 rounded-full border-2 border-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] ${
                color.key === colorKey ? 'border-[var(--color-accent)]' : ''
              }`}
              style={{ '--shadow-color': color.css || '#000', backgroundColor: color.css || '#000' }}
              aria-label={color.label}
              onClick={() => {
                onColorChange?.(color.key);
                setIsOpen(false);
              }}
            ></button>
          ))}
        </div>
      </div>
    </div>
  );
}
