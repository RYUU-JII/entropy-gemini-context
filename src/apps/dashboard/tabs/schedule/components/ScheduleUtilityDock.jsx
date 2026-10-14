import React from 'react';
import { Bell, BellOff } from 'lucide-react';
import { KekkaiIcon } from '@/ui-kit/Icons.jsx';
import { getDashboardStateTransitionStyle } from '@/themes/core/motion/index.js';
import {
  SCHEDULE_RECIPE_VARIANTS,
  resolveScheduleRecipeVariant,
} from '@/themes/core/scheduleVisualPolicy.js';
import { SCHEDULE_SPECIAL_SESSION_PANEL_ID } from './scheduleSpecialSessionContract.js';

const SCHEDULE_UTILITY_BUTTON_STYLE = getDashboardStateTransitionStyle('dashboard.control.button');

function requireVisibleScheduleUtilityHandler(handler, code) {
  if (typeof handler !== 'function') {
    throw new Error(code);
  }
  return handler;
}

export default function ScheduleUtilityDock({
  notificationEnabled = false,
  notificationPromptActive = false,
  onToggleNotifications,
  onOpenSpecialSession,
  specialSessionOpen = false,
  visualTokens,
  typography,
  variant,
  showNotifications = true,
  showSpecialSession = true,
  t = (key) => key,
}) {
  const usesWorkbenchPlacement = resolveScheduleRecipeVariant('utilities', variant, {
    [SCHEDULE_RECIPE_VARIANTS.utilities.FLOATING]: () => false,
    [SCHEDULE_RECIPE_VARIANTS.utilities.WORKBENCH]: () => true,
  });
  const mutedColor = visualTokens.inkMuted;
  const surface = visualTokens.panelBackground;
  const workbenchSurface = visualTokens.workbenchSurface;
  const isolationColor = visualTokens.isolationInk;
  const focusMarker = visualTokens.focusMarker;
  const notificationColor = visualTokens.currentMarker;
  const shadowInk = visualTokens.shadowInk;
  const Icon = notificationEnabled ? Bell : BellOff;
  const label = notificationEnabled
    ? t('notifications.end_alert_toggle_off')
    : t('notifications.end_alert_toggle_on');
  const specialSessionLabel = t('special_session.open');
  const resolvedOpenSpecialSession = showSpecialSession ? requireVisibleScheduleUtilityHandler(
    onOpenSpecialSession,
    'SCHEDULE_UTILITY_SPECIAL_SESSION_HANDLER_REQUIRED',
  ) : null;
  const resolvedToggleNotifications = showNotifications
    ? requireVisibleScheduleUtilityHandler(
      onToggleNotifications,
      'SCHEDULE_UTILITY_NOTIFICATION_HANDLER_REQUIRED',
    )
    : null;
  const shouldEmphasizeNotification = notificationPromptActive && !notificationEnabled;

  if (usesWorkbenchPlacement) {
    const textButtonStyle = {
      ...SCHEDULE_UTILITY_BUTTON_STYLE,
      borderColor: 'transparent',
      backgroundColor: 'transparent',
      color: mutedColor,
      fontFamily: typography.label,
    };

    return (
      <div
        data-schedule-utility
        data-schedule-utility-placement="workbench"
        className="flex shrink-0 items-center justify-end gap-1"
        style={{ backgroundColor: 'transparent' }}
      >
        {showSpecialSession ? <button
          type="button"
          onClick={(event) => resolvedOpenSpecialSession(event.currentTarget)}
          aria-label={specialSessionLabel}
          aria-expanded={specialSessionOpen}
          aria-controls={SCHEDULE_SPECIAL_SESSION_PANEL_ID}
          aria-haspopup="dialog"
          title={specialSessionLabel}
          className="flex h-8 items-center gap-1.5 rounded-[3px] border px-2 text-[10px] font-semibold tracking-[0.08em] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2"
          style={{ ...textButtonStyle, color: isolationColor, outlineColor: focusMarker }}
        >
          <KekkaiIcon className="h-3.5 w-3.5" strokeWidth={1.6} aria-hidden="true" />
          <span>{specialSessionLabel}</span>
        </button> : null}
        {showNotifications ? (
          <button
            type="button"
            onClick={() => resolvedToggleNotifications(!notificationEnabled)}
            aria-label={label}
            aria-pressed={notificationEnabled}
            title={label}
            className="relative flex h-8 items-center gap-1.5 rounded-[3px] border px-2 text-[10px] font-semibold tracking-[0.08em] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2"
            style={{
              ...textButtonStyle,
              borderColor: notificationEnabled || shouldEmphasizeNotification
                ? `color-mix(in srgb, ${notificationColor} 40%, transparent)`
                : 'transparent',
              color: notificationEnabled || shouldEmphasizeNotification ? notificationColor : mutedColor,
              backgroundColor: notificationEnabled || shouldEmphasizeNotification
                ? `color-mix(in srgb, ${notificationColor} 5%, transparent)`
                : 'transparent',
              outlineColor: focusMarker,
            }}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={1.6} aria-hidden="true" />
            <span>{label}</span>
            {shouldEmphasizeNotification ? (
              <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: notificationColor }} />
            ) : null}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div
      data-schedule-utility
      data-schedule-utility-placement="floating"
      className="absolute bottom-14 right-0 z-40 flex flex-col items-center gap-2"
    >
      {showSpecialSession ? <button
        type="button"
        onClick={(event) => resolvedOpenSpecialSession(event.currentTarget)}
        aria-label={specialSessionLabel}
        aria-expanded={specialSessionOpen}
        aria-controls={SCHEDULE_SPECIAL_SESSION_PANEL_ID}
        aria-haspopup="dialog"
        title={specialSessionLabel}
        className="flex h-9 w-9 items-center justify-center rounded-full border outline-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{
          ...SCHEDULE_UTILITY_BUTTON_STYLE,
          borderColor: `color-mix(in srgb, ${isolationColor} 40%, transparent)`,
          backgroundColor: `color-mix(in srgb, ${isolationColor} 9%, transparent)`,
          color: isolationColor,
          boxShadow: `0 0 0 1px color-mix(in srgb, ${isolationColor} 12%, transparent), 0 0 18px color-mix(in srgb, ${isolationColor} 13%, transparent)`,
          outlineColor: focusMarker,
        }}
      >
        <KekkaiIcon className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
      </button> : null}
      {showNotifications ? (
        <button
          type="button"
          onClick={() => resolvedToggleNotifications(!notificationEnabled)}
          aria-label={label}
          aria-pressed={notificationEnabled}
          title={label}
          className="flex h-9 w-9 items-center justify-center rounded-full border outline-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{
            ...SCHEDULE_UTILITY_BUTTON_STYLE,
            borderColor: notificationEnabled || shouldEmphasizeNotification
              ? `color-mix(in srgb, ${notificationColor} 40%, transparent)`
              : `color-mix(in srgb, ${mutedColor} 18%, transparent)`,
            backgroundColor: notificationEnabled || shouldEmphasizeNotification
              ? `color-mix(in srgb, ${notificationColor} 9%, transparent)`
              : `color-mix(in srgb, ${surface} 72%, ${workbenchSurface} 28%)`,
            color: notificationEnabled || shouldEmphasizeNotification ? notificationColor : mutedColor,
            boxShadow: notificationEnabled || shouldEmphasizeNotification
              ? `0 0 0 1px color-mix(in srgb, ${notificationColor} 12%, transparent), 0 0 18px color-mix(in srgb, ${notificationColor} 14%, transparent)`
              : `0 1px 3px color-mix(in srgb, ${shadowInk} 6%, transparent)`,
            outlineColor: focusMarker,
          }}
        >
          <Icon className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
