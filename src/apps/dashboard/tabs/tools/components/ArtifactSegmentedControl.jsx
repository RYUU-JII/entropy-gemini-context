import React from 'react';

import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { useArtifactControlCommit } from '@/themes/core/tools/useArtifactControlCommit.js';
import { useArtifactControlGroupFeedback } from './ArtifactControlGroupDisclosure.jsx';

const DEFAULT_SEGMENT_OPTIONS = Object.freeze([1, 2, 3]);

function normalizeSegmentOptions(options = DEFAULT_SEGMENT_OPTIONS) {
  return options.map((entry) => {
    if (typeof entry === 'number' || typeof entry === 'string') {
      return {
        value: entry,
        label: String(entry),
        feedback: '',
      };
    }

    const value = entry?.value ?? 1;
    return {
      value,
      label: entry?.label || String(value),
      feedback: typeof entry?.feedback === 'string' ? entry.feedback : '',
    };
  });
}

export default function ArtifactSegmentedControl({
  label = '',
  value = 1,
  levels = DEFAULT_SEGMENT_OPTIONS,
  options = null,
  includeOff = false,
  offValue = 0,
  offLabel = '',
  onSelect,
  accentColor = '#0ea5e9',
  feedback = '',
  feedbackContent = null,
  className = '',
  showHeader = false,
  legendLabel = '',
  compact = false,
  disabled = false,
}) {
  const { t } = useAppTranslation('tools');
  const normalizedOptions = normalizeSegmentOptions(options || levels);
  const resolvedOffLabel = offLabel || t('artifact_altar.off');
  const resolvedLegendLabel = legendLabel || t('artifact_altar.level');
  const segmentOptions = includeOff
    ? [{ value: offValue, label: resolvedOffLabel, feedback: '' }, ...normalizedOptions]
    : normalizedOptions;
  const { activeValue, pending, error, commit } = useArtifactControlCommit({ value, onCommit: onSelect, disabled });
  useArtifactControlGroupFeedback(pending, error);
  const activeOption = segmentOptions.find((option) => option.value === activeValue) || null;
  const resolvedFeedback = feedback || activeOption?.feedback || '';
  const buttonClassName = compact
    ? 'min-h-[34px] rounded-[var(--artifact-control-radius,12px)] px-2 py-1.5 text-[10px]'
    : 'min-h-[38px] rounded-[var(--artifact-control-radius,12px)] px-3 py-2 text-[11px]';
  const canSelect = typeof onSelect === 'function';
  const isDisabled = disabled || !canSelect;

  return (
    <div className={`space-y-2 ${className}`} aria-busy={pending}>
      {showHeader ? (
        <div className="flex items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-[0.1em]">
          <span className="text-on-surface-muted">{resolvedLegendLabel}</span>
          <span className="tabular-nums" style={{ color: accentColor }}>
            {activeOption?.label || value}
          </span>
        </div>
      ) : null}

      <div
        className="grid min-w-0 gap-2"
        style={{ gridTemplateColumns: `repeat(${Math.max(1, segmentOptions.length)}, minmax(0, 1fr))` }}
      >
        {segmentOptions.map((option) => {
          const isActive = option.value === activeValue;
          return (
            <button
              key={`${label || 'artifact-segment'}-${option.value}`}
              type="button"
              aria-pressed={isActive}
              data-artifact-control-value={String(option.value)}
              aria-label={`${label || 'artifact'} ${option.label}`}
              disabled={isDisabled}
              onClick={() => {
                commit(option.value);
              }}
              className={[
                'min-w-0 border font-semibold leading-none tracking-[0.04em] transition-[background-color,border-color,color,box-shadow] duration-150 ease-out',
                buttonClassName,
                isActive
                  ? 'text-on-surface shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]'
                  : 'border-border/18 bg-surface/70 px-2.5 text-on-surface-muted hover:border-border/35 hover:bg-surface-elevated/80 hover:text-on-surface',
                isDisabled ? 'cursor-not-allowed opacity-60' : '',
              ].join(' ')}
              style={isActive
                ? {
                  borderColor: `var(--artifact-segment-selected-border, ${accentColor}55)`,
                  background: `var(--artifact-segment-selected-background, ${accentColor}12)`,
                  color: `var(--artifact-segment-selected-foreground, ${accentColor})`,
                  boxShadow: `var(--artifact-segment-selected-shadow, inset 0 0 0 1px ${accentColor}20)`,
                }
                : undefined}
            >
              <span className="block truncate">{option.label}</span>
            </button>
          );
        })}
      </div>

      {feedbackContent ? <div className="text-[10px] leading-relaxed text-on-surface-muted" aria-live="polite">
        {feedbackContent}
      </div> : <p className="min-h-[2.75em] text-[10px] leading-relaxed text-on-surface-muted" aria-live="polite">
        {resolvedFeedback}
      </p>}
      {error ? <p role="alert" className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
