import React from 'react';
import { Clock3 } from 'lucide-react';

import { BUILD_INCLUDE_DEBUG_TOOLS } from '@/platform/build/releaseCapabilities.js';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import {
  DASHBOARD_APPEARANCE_CLOCK_MODES,
  DASHBOARD_APPEARANCE_TIME_MAX_MINUTES,
  DASHBOARD_APPEARANCE_TIME_STEP_MINUTES,
  normalizeDashboardAppearanceHour,
} from '@/apps/dashboard/presentation/dashboardAppearanceClock.js';

const MINUTES_PER_HOUR = 60;

function toSliderMinutes(hour) {
  return Math.round(normalizeDashboardAppearanceHour(hour) * MINUTES_PER_HOUR);
}

function formatTimeLabel(hour) {
  const totalMinutes = toSliderMinutes(hour);
  return [Math.floor(totalMinutes / MINUTES_PER_HOUR), totalMinutes % MINUTES_PER_HOUR]
    .map(value => String(value).padStart(2, '0')).join(':');
}

export default function ZenAppearanceTimeControl({ mode, customHour, onModeChange, onCustomHourChange }) {
  const { t } = useAppTranslation('tools');
  if (!BUILD_INCLUDE_DEBUG_TOOLS) return null;
  const customTimeActive = mode === DASHBOARD_APPEARANCE_CLOCK_MODES.CUSTOM;
  const handleToggle = () => onModeChange(customTimeActive
    ? DASHBOARD_APPEARANCE_CLOCK_MODES.REALTIME
    : DASHBOARD_APPEARANCE_CLOCK_MODES.CUSTOM);
  const handleHourChange = (event) => {
    if (!customTimeActive) onModeChange(DASHBOARD_APPEARANCE_CLOCK_MODES.CUSTOM);
    onCustomHourChange(Number.parseInt(event.target.value, 10) / MINUTES_PER_HOUR);
  };

  return (
    <section className="zen-appearance-time-control space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-xs font-semibold">
          <Clock3 className="h-4 w-4 text-on-surface-muted" />
          {t('development_tools.time_title')}
        </h3>
        <button
          type="button"
          aria-pressed={customTimeActive}
          aria-label={t(customTimeActive ? 'development_tools.time_follow' : 'development_tools.time_custom')}
          onClick={handleToggle}
          className="rounded-full border border-border bg-surface-sunken px-2.5 py-1 text-[10px] font-medium text-on-surface-muted hover:border-accent hover:text-on-surface"
        >
          {t(customTimeActive ? 'development_tools.time_fixed' : 'development_tools.time_live')}
        </button>
      </div>
      <div className="flex items-center gap-3">
        <input
          aria-label={t('development_tools.time_slider')}
          type="range"
          min="0"
          max={DASHBOARD_APPEARANCE_TIME_MAX_MINUTES}
          step={DASHBOARD_APPEARANCE_TIME_STEP_MINUTES}
          value={toSliderMinutes(customHour)}
          onChange={handleHourChange}
          className="min-w-0 flex-1 cursor-pointer accent-accent"
        />
        <output className="w-11 shrink-0 text-right font-mono text-xs tabular-nums text-on-surface">
          {formatTimeLabel(customHour)}
        </output>
      </div>
      <p className="text-[11px] leading-relaxed text-on-surface-muted">{t('development_tools.time_scope')}</p>
    </section>
  );
}
