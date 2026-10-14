import React from 'react';
import {
  SCHEDULE_RECIPE_VARIANTS,
  resolveScheduleRecipeVariant,
} from '../../../../../themes/core/scheduleVisualPolicy.js';

export default function ScheduleRhythmIdentity({
  rhythmId,
  days,
  dayLabels,
  blockCount = 0,
  selected = false,
  todayDay = null,
  onSelect,
  onKeyDown,
  visualTokens,
  typography,
  variant,
  t = (key) => key,
}) {
  const usesBookmarks = resolveScheduleRecipeVariant('rhythmIdentity', variant, {
    [SCHEDULE_RECIPE_VARIANTS.rhythmIdentity.BOOKMARKS]: () => true,
    [SCHEDULE_RECIPE_VARIANTS.rhythmIdentity.COUNTED_TABS]: () => false,
  });
  const muted = visualTokens.inkMuted;
  const ink = visualTokens.inkPrimary;
  const edge = visualTokens.stageEdge;
  const focusMarker = visualTokens.focusMarker;
  const accentInk = visualTokens.relaxationInk;
  const stageHighlight = visualTokens.stageHighlight;
  const orderedDays = Array.isArray(days) ? days : [];
  const identityLabel = orderedDays.map((day) => dayLabels?.[day] || String(day)).join(' · ');
  const statusId = `schedule-rhythm-status-${rhythmId}`;
  const statusText = blockCount > 0
    ? t('rhythm.window_count', { count: blockCount })
    : t('rhythm.base_only');

  return (
    <button
      type="button"
      role="tab"
      id={`schedule-rhythm-tab-${rhythmId}`}
      aria-controls={`schedule-rhythm-panel-${rhythmId}`}
      aria-selected={selected}
      aria-describedby={statusId}
      tabIndex={selected ? 0 : -1}
      data-schedule-rhythm-identity={rhythmId}
      data-schedule-days
      aria-label={identityLabel}
      onClick={() => onSelect?.(rhythmId)}
      onKeyDown={(event) => onKeyDown?.(event, rhythmId)}
      className={`group relative flex min-w-0 items-center text-left focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 ${usesBookmarks ? 'border-0 px-0' : 'border-b px-1 pb-2 pt-1'}`}
      style={{
        color: selected ? ink : muted,
        borderColor: usesBookmarks
          ? 'transparent'
          : (selected
            ? focusMarker
            : `color-mix(in srgb, ${edge} 44%, transparent)`),
        backgroundColor: 'transparent',
        fontFamily: typography.label,
        outlineColor: focusMarker,
        transition: 'color 140ms ease, border-color 140ms ease',
      }}
    >
      <span
        data-schedule-rhythm-bookmark={usesBookmarks ? (selected ? 'selected' : 'idle') : undefined}
        className={`flex min-w-0 items-center gap-1 ${usesBookmarks ? 'relative px-3 pb-2.5 pt-1.5' : ''}`}
        style={usesBookmarks ? {
          backgroundColor: 'transparent',
          boxShadow: selected
            ? `inset 0 -2px 0 ${focusMarker}`
            : `inset 0 -1px 0 color-mix(in srgb, ${edge} 26%, transparent)`,
        } : undefined}
      >
        {usesBookmarks ? (
          <span
            className="flex items-center justify-center rounded-full text-[9px] font-bold h-4 w-4 mr-0.5 font-heading border select-none shrink-0"
            style={{
              backgroundColor: selected
                ? `color-mix(in srgb, ${focusMarker} 10%, ${stageHighlight})`
                : 'transparent',
              borderColor: selected ? focusMarker : `color-mix(in srgb, ${edge} 58%, transparent)`,
              color: selected ? focusMarker : muted,
            }}
          >
            {rhythmId === 'rhythm-1' ? '動' : '靜'}
          </span>
        ) : null}
        {orderedDays.map((day) => (
          <span
            key={day}
            className={`relative flex h-7 min-w-7 items-center justify-center px-1 text-[11px] font-semibold ${usesBookmarks ? '' : 'rounded-md'}`}
            style={{
              color: selected ? ink : muted,
            }}
          >
            {day === todayDay ? (
              <span
                aria-hidden="true"
                className="absolute left-1/2 top-0 h-1 w-1 -translate-x-1/2 rounded-full"
                style={{ backgroundColor: focusMarker }}
              />
            ) : null}
            {dayLabels?.[day] || day}
          </span>
        ))}
        {usesBookmarks ? (
          <span
            aria-hidden="true"
            data-schedule-rhythm-seal
            className="ml-1 flex h-4 min-w-4 items-center justify-center px-0.5 text-[8px] font-bold tabular-nums"
            style={{
              color: selected ? accentInk : muted,
              opacity: blockCount > 0 ? 0.9 : 0.34,
            }}
          >
            {blockCount > 0 ? blockCount : '·'}
          </span>
        ) : null}
      </span>
      {usesBookmarks && selected ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-5 left-1/2 h-5 w-px -translate-x-1/2"
          style={{
            background: `linear-gradient(180deg, color-mix(in srgb, ${focusMarker} 62%, transparent), transparent)`,
          }}
        />
      ) : null}
      <span
        id={statusId}
        className={usesBookmarks
          ? 'sr-only'
          : 'ml-3 shrink-0 text-[9px] font-semibold tracking-[0.08em]'}
        style={usesBookmarks ? undefined : { color: blockCount > 0 ? accentInk : muted }}
      >
        {statusText}
      </span>
    </button>
  );
}
