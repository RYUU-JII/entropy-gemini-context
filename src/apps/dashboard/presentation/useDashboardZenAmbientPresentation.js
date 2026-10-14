import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  ZEN_REALTIME_TEMPORAL_AUTHORITY,
  ZEN_TEMPORAL_AUTHORITY_MODES,
  ZEN_WORLD_ENVIRONMENT_CLOCK_MODES,
  buildZenTemporalAuthority,
  resolveZenAmbientPresentation,
  resolveZenAmbientRefreshIntervalMs,
} from '@/themes/plugins/zen/api/environment.js';
import {
  DASHBOARD_APPEARANCE_CLOCK_MODES,
  DEFAULT_DASHBOARD_APPEARANCE_HOUR,
  normalizeDashboardAppearanceHour,
  requireDashboardAppearanceClockMode,
  resolveDashboardAppearanceEpochMs,
} from './dashboardAppearanceClock.js';

function isDocumentVisible() {
  if (typeof document === 'undefined') return true;
  return document.hidden !== true && document.visibilityState !== 'hidden';
}

export function useDashboardZenAmbientPresentation({
  active = false,
  solarLocationProfile = null,
  environmentMode = null,
  initialAppearanceHour = null,
  weatherAuthority = null,
} = {}) {
  const initialCustomHour = initialAppearanceHour === null
    ? DEFAULT_DASHBOARD_APPEARANCE_HOUR
    : normalizeDashboardAppearanceHour(initialAppearanceHour);
  const [realtimeEpochMs, setRealtimeEpochMs] = useState(() => Date.now());
  const [appearanceClockMode, setAppearanceClockModeState] = useState(
    initialAppearanceHour === null
      ? DASHBOARD_APPEARANCE_CLOCK_MODES.REALTIME
      : DASHBOARD_APPEARANCE_CLOCK_MODES.CUSTOM,
  );
  const [customHour, setCustomHourState] = useState(initialCustomHour);

  const setAppearanceClockMode = useCallback((nextMode) => {
    const resolvedMode = requireDashboardAppearanceClockMode(nextMode);
    setRealtimeEpochMs(Date.now());
    setAppearanceClockModeState(resolvedMode);
  }, []);

  const setCustomHour = useCallback((nextHour) => {
    setCustomHourState(normalizeDashboardAppearanceHour(nextHour));
  }, []);

  const appearanceEpochMs = useMemo(() => resolveDashboardAppearanceEpochMs({
    mode: appearanceClockMode,
    realtimeEpochMs,
    customHour,
    solarLocationProfile,
  }), [appearanceClockMode, customHour, realtimeEpochMs, solarLocationProfile]);

  const presentation = useMemo(() => (
    active
      ? resolveZenAmbientPresentation({
        solarLocationProfile,
        nowMs: appearanceEpochMs,
        clockMode: appearanceClockMode === DASHBOARD_APPEARANCE_CLOCK_MODES.REALTIME
          ? ZEN_WORLD_ENVIRONMENT_CLOCK_MODES.REALTIME
          : ZEN_WORLD_ENVIRONMENT_CLOCK_MODES.FIXED,
        environmentMode,
        weatherAuthority,
      })
      : null
  ), [
    active,
    appearanceClockMode,
    appearanceEpochMs,
    environmentMode,
    solarLocationProfile,
    weatherAuthority,
  ]);

  const temporalAuthority = useMemo(() => {
    if (!active) return null;
    if (appearanceClockMode === DASHBOARD_APPEARANCE_CLOCK_MODES.REALTIME) {
      return ZEN_REALTIME_TEMPORAL_AUTHORITY;
    }
    return buildZenTemporalAuthority({
      mode: ZEN_TEMPORAL_AUTHORITY_MODES.FIXED,
      fixedEpochMs: appearanceEpochMs,
    });
  }, [active, appearanceClockMode, appearanceEpochMs]);

  useEffect(() => {
    if (!active || appearanceClockMode !== DASHBOARD_APPEARANCE_CLOCK_MODES.REALTIME) {
      return undefined;
    }

    const intervalMs = resolveZenAmbientRefreshIntervalMs({
      presentation,
      documentVisible: isDocumentVisible(),
    });
    const timerId = setTimeout(() => {
      setRealtimeEpochMs(Date.now());
    }, intervalMs);
    const handleVisibilityChange = () => {
      setRealtimeEpochMs(Date.now());
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange, { passive: true });
    }

    return () => {
      clearTimeout(timerId);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [active, appearanceClockMode, presentation]);

  const appearanceClock = useMemo(() => ({
    mode: appearanceClockMode,
    customHour,
    setMode: setAppearanceClockMode,
    setCustomHour,
  }), [appearanceClockMode, customHour, setAppearanceClockMode, setCustomHour]);

  return {
    presentation,
    temporalAuthority,
    appearanceClock,
  };
}

export default useDashboardZenAmbientPresentation;
