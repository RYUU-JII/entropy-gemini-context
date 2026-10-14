import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ensureDashboardTabEntryTrace,
  recordDashboardTabEntryStage,
} from '@dashboard-tab-entry-telemetry';

import {
  getThemeWidgetChunkState,
  preloadThemeWidgetChunk,
} from '@/themes/core/registry/index.js';
import {
  useAnalysisStore,
  usePreferenceStore,
  useProtocolStore,
} from '../stores/index.js';
import {
  getDashboardTabReadinessProfile,
} from '../tabs/loadingPolicy.js';
import { assertThemeWidgetPreloadAck } from './themeWidgetPreloadContract.js';
import { useAnalysisProjectionDemand } from '../hooks/useAnalysisProjectionDemand.js';

const EMPTY_WIDGET_TYPES = Object.freeze([]);
const KNOWN_HYDRATION_KEYS = new Set(['preference', 'protocol', 'analysis']);
const SELECT_LOADED = (state) => state.loaded === true;
const SELECT_TRUE = () => true;
const SELECT_LOAD_ERROR = (state) => state.loadError || null;
const SELECT_NULL = () => null;

function normalizeWidgetTypes(widgetTypes, fallbackWidgetTypes) {
  const candidateList = Array.isArray(widgetTypes) ? widgetTypes : fallbackWidgetTypes;
  if (!Array.isArray(candidateList) || candidateList.length === 0) {
    return EMPTY_WIDGET_TYPES;
  }

  return [...new Set(
    candidateList.filter((widgetType) => typeof widgetType === 'string' && widgetType.trim()),
  )];
}

function normalizeError(error) {
  if (error instanceof Error) return error;
  if (typeof error === 'string' && error.trim()) {
    return new Error(error.trim());
  }
  if (error && typeof error === 'object' && typeof error.message === 'string' && error.message.trim()) {
    const normalized = new Error(error.message.trim());
    if (typeof error.code === 'string' && error.code.trim()) {
      normalized.code = error.code.trim();
    }
    return normalized;
  }
  return new Error('Failed to prepare tab dependencies.');
}

function areCanonicalWidgetsReady(themeId, widgetTypes) {
  if (!widgetTypes.length) return true;
  if (!themeId) return false;
  return widgetTypes.every((widgetType) => (
    getThemeWidgetChunkState(themeId, widgetType)?.status === 'ready'
  ));
}

export function useDashboardTabReadiness({
  tabId,
  themeId,
  isActive = true,
  surfaceId = '',
  widgetTypes = null,
  waitForPresentation = false,
} = {}) {
  const readinessProfile = useMemo(
    () => getDashboardTabReadinessProfile(tabId, { surfaceId, themeId }),
    [surfaceId, tabId, themeId],
  );
  const hydrationKeys = readinessProfile?.hydrationKeys || EMPTY_WIDGET_TYPES;
  const fallbackWidgetTypes = readinessProfile?.widgetTypes || EMPTY_WIDGET_TYPES;
  const resolvedWidgetTypes = useMemo(
    () => normalizeWidgetTypes(widgetTypes, fallbackWidgetTypes),
    [fallbackWidgetTypes, widgetTypes],
  );
  const needsPreference = hydrationKeys.includes('preference');
  const needsProtocol = hydrationKeys.includes('protocol');
  const needsAnalysis = hydrationKeys.includes('analysis');
  const analysisProjections = readinessProfile?.analysisProjections || EMPTY_WIDGET_TYPES;
  useAnalysisProjectionDemand(analysisProjections, isActive && needsAnalysis);
  const preferenceLoaded = usePreferenceStore(needsPreference ? SELECT_LOADED : SELECT_TRUE);
  const preferenceLoadError = usePreferenceStore(needsPreference ? SELECT_LOAD_ERROR : SELECT_NULL);
  const protocolLoaded = useProtocolStore(needsProtocol ? SELECT_LOADED : SELECT_TRUE);
  const protocolLoadError = useProtocolStore(needsProtocol ? SELECT_LOAD_ERROR : SELECT_NULL);
  const selectAnalysisLoaded = useCallback((state) => analysisProjections.every(
    (projection) => state[`${projection}Loaded`] === true,
  ), [analysisProjections]);
  const selectAnalysisError = useCallback((state) => {
    for (const projection of analysisProjections) {
      if (state[`${projection}Error`]) return state[`${projection}Error`];
    }
    return null;
  }, [analysisProjections]);
  const analysisLoaded = useAnalysisStore(needsAnalysis ? selectAnalysisLoaded : SELECT_TRUE);
  const analysisLoadError = useAnalysisStore(needsAnalysis ? selectAnalysisError : SELECT_NULL);
  const widgetTypesKey = resolvedWidgetTypes.join('|');
  const resolvedSurfaceId = readinessProfile?.surfaceId || surfaceId || tabId || '';
  const surfaceKey = resolvedSurfaceId && resolvedSurfaceId !== tabId
    ? `:${resolvedSurfaceId}`
    : '';
  const requestKey = `${String(tabId || '')}${surfaceKey}:${String(themeId || '')}:${widgetTypesKey}`;
  const canonicalWidgetsReady = areCanonicalWidgetsReady(themeId, resolvedWidgetTypes);
  const [widgetState, setWidgetState] = useState(() => ({
    requestKey: canonicalWidgetsReady ? requestKey : '',
    status: canonicalWidgetsReady ? 'ready' : 'idle',
    error: null,
  }));
  const [widgetRetryAttempt, setWidgetRetryAttempt] = useState(0);
  const hydrationRetryInFlightRef = useRef(null);

  const configurationError = useMemo(() => {
    if (!readinessProfile) {
      return new Error(`DASHBOARD_TAB_LOADING_POLICY_MISSING:${String(tabId || '')}`);
    }
    const unknownHydrationKey = hydrationKeys.find((key) => !KNOWN_HYDRATION_KEYS.has(key));
    if (unknownHydrationKey) {
      return new Error(`DASHBOARD_TAB_HYDRATION_KEY_UNKNOWN:${unknownHydrationKey}`);
    }
    if (needsAnalysis && analysisProjections.length === 0) {
      return new Error(`DASHBOARD_TAB_ANALYSIS_PROJECTIONS_REQUIRED:${String(tabId || '')}`);
    }
    if (resolvedWidgetTypes.length > 0 && !themeId) {
      return new Error(`DASHBOARD_TAB_THEME_ID_REQUIRED:${String(tabId || '')}`);
    }
    return null;
  }, [analysisProjections, hydrationKeys, needsAnalysis, readinessProfile, resolvedWidgetTypes.length, tabId, themeId]);

  const hydrationReady = hydrationKeys.every((key) => {
    if (key === 'preference') return preferenceLoaded;
    if (key === 'protocol') return protocolLoaded;
    if (key === 'analysis') return analysisLoaded;
    return true;
  });
  const hydrationError = useMemo(() => {
    if (hydrationKeys.includes('preference') && preferenceLoadError) {
      return normalizeError(preferenceLoadError);
    }
    if (hydrationKeys.includes('protocol') && protocolLoadError) {
      return normalizeError(protocolLoadError);
    }
    if (hydrationKeys.includes('analysis') && analysisLoadError) {
      return normalizeError(analysisLoadError);
    }
    return null;
  }, [analysisLoadError, hydrationKeys, preferenceLoadError, protocolLoadError]);

  useEffect(() => {
    if (
      !isActive
      || configurationError
      || hydrationError
      || !hydrationReady
      || resolvedWidgetTypes.length === 0
    ) {
      return undefined;
    }

    if (areCanonicalWidgetsReady(themeId, resolvedWidgetTypes)) {
      setWidgetState((prev) => (
        prev.requestKey === requestKey && prev.status === 'ready'
          ? prev
          : {
            requestKey,
            status: 'ready',
            error: null,
          }
      ));
      return undefined;
    }

    let cancelled = false;
    setWidgetState((prev) => (
      prev.requestKey === requestKey && prev.status === 'ready'
        ? prev
        : {
          requestKey,
          status: 'loading',
          error: null,
        }
    ));

    Promise.allSettled(resolvedWidgetTypes.map(async (widgetType) => {
      const ack = await preloadThemeWidgetChunk(themeId, widgetType);
      return assertThemeWidgetPreloadAck({
        ack,
        chunkState: getThemeWidgetChunkState(themeId, widgetType),
        themeId,
        widgetType,
      });
    })).then((results) => {
      if (cancelled) return;
      const rejectedResult = results.find((result) => result?.status === 'rejected');
      if (rejectedResult?.status === 'rejected') {
        setWidgetState({
          requestKey,
          status: 'error',
          error: normalizeError(rejectedResult.reason),
        });
        return;
      }

      setWidgetState({
        requestKey,
        status: 'ready',
        error: null,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [
    configurationError,
    hydrationError,
    hydrationReady,
    isActive,
    requestKey,
    resolvedWidgetTypes,
    themeId,
    widgetRetryAttempt,
  ]);

  const widgetsReady = resolvedWidgetTypes.length === 0 || canonicalWidgetsReady;
  const hasWidgetError = !canonicalWidgetsReady
    && widgetState.requestKey === requestKey
    && widgetState.status === 'error';
  const ready = !configurationError
    && hydrationReady
    && widgetsReady
    && !hasWidgetError
    && !hydrationError;
  const error = configurationError || hydrationError || (hasWidgetError ? widgetState.error : null);
  const retryWidgetReadiness = useCallback(() => {
    if (!hasWidgetError) return false;
    recordDashboardTabEntryStage(tabId, 'readiness:retry', {
      surfaceId: resolvedSurfaceId,
      widgetTypes: resolvedWidgetTypes,
    });
    setWidgetState({
      requestKey: '',
      status: 'idle',
      error: null,
    });
    setWidgetRetryAttempt((attempt) => attempt + 1);
    return true;
  }, [hasWidgetError, requestKey, resolvedSurfaceId, resolvedWidgetTypes, tabId]);
  const retryHydrationReadiness = useCallback(() => {
    if (!hydrationError) return false;
    if (hydrationRetryInFlightRef.current) {
      return hydrationRetryInFlightRef.current;
    }

    const failedHydrationKeys = [
      needsPreference && preferenceLoadError ? 'preference' : null,
      needsProtocol && protocolLoadError ? 'protocol' : null,
      needsAnalysis && analysisLoadError ? 'analysis' : null,
    ].filter(Boolean);
    if (failedHydrationKeys.length === 0) return false;

    recordDashboardTabEntryStage(tabId, 'readiness:retry', {
      hydrationKeys: failedHydrationKeys,
      surfaceId: resolvedSurfaceId,
    });

    const retryHydrationKey = async (hydrationKey) => {
      if (hydrationKey === 'preference') {
        const initialize = usePreferenceStore.getState()?.initialize;
        if (typeof initialize !== 'function') return false;
        await initialize();
        const state = usePreferenceStore.getState();
        return state.loaded === true && !state.loadError;
      }
      if (hydrationKey === 'protocol') {
        const initialize = useProtocolStore.getState()?.initialize;
        if (typeof initialize !== 'function') return false;
        await initialize();
        const state = useProtocolStore.getState();
        return state.loaded === true && !state.loadError;
      }
      if (hydrationKey === 'analysis') {
        const state = useAnalysisStore.getState();
        if (state.loaded !== true && typeof state.initialize === 'function') {
          await state.initialize();
          const initializedState = useAnalysisStore.getState();
          return selectAnalysisLoaded(initializedState) && !selectAnalysisError(initializedState);
        }
        const failedProjections = analysisProjections.filter((projection) => (
          state[`${projection}Error`] || state[`${projection}Loaded`] !== true
        ));
        await Promise.all(failedProjections.map((projection) => {
          if (projection === 'cycle') return state.refreshCycleProjection();
          if (projection === 'status') return state.refreshStatusSnapshot({ force: true });
          return state.refreshSitesSnapshot();
        }));
        const refreshed = useAnalysisStore.getState();
        return selectAnalysisLoaded(refreshed) && !selectAnalysisError(refreshed);
      }
      return false;
    };

    const operation = Promise.allSettled(
      failedHydrationKeys.map((hydrationKey) => retryHydrationKey(hydrationKey)),
    ).then((results) => results.every((result) => (
      result.status === 'fulfilled' && result.value === true
    ))).finally(() => {
      if (hydrationRetryInFlightRef.current === operation) {
        hydrationRetryInFlightRef.current = null;
      }
    });
    hydrationRetryInFlightRef.current = operation;
    return operation;
  }, [
    analysisLoadError,
    analysisProjections,
    hydrationError,
    needsAnalysis,
    needsPreference,
    needsProtocol,
    preferenceLoadError,
    protocolLoadError,
    resolvedSurfaceId,
    selectAnalysisError,
    selectAnalysisLoaded,
    tabId,
  ]);
  const phase = error
    ? 'error'
    : !hydrationReady
      ? 'loading'
      : ready
        ? 'ready'
        : 'loading';
  const lastRecordedReadinessStageRef = useRef('');
  const readinessLifecycleRef = useRef({
    active: false,
    generation: 0,
    surfaceId: '',
    tabId: '',
    themeId: '',
  });

  useEffect(() => {
    if (!isActive || !tabId) {
      lastRecordedReadinessStageRef.current = '';
      return;
    }
    const errorCode = error?.code || (error ? 'DASHBOARD_TAB_READINESS_FAILED' : '');
    const stageKey = `${requestKey}:${phase}:${errorCode}`;
    if (lastRecordedReadinessStageRef.current === stageKey) return;
    ensureDashboardTabEntryTrace({
      tabId,
      themeId,
      source: 'render',
    });
    lastRecordedReadinessStageRef.current = stageKey;
    recordDashboardTabEntryStage(tabId, `readiness:${phase}`, {
      errorCode: errorCode || null,
      readinessScope: readinessProfile?.scope || '',
      surfaceId: resolvedSurfaceId,
      waitForPresentation,
    });
  }, [
    error,
    isActive,
    phase,
    readinessProfile?.scope,
    requestKey,
    resolvedSurfaceId,
    tabId,
    themeId,
    waitForPresentation,
  ]);

  useLayoutEffect(() => {
    const lifecycle = readinessLifecycleRef.current;
    const generation = lifecycle.generation + 1;
    lifecycle.generation = generation;

    const closeActiveTrace = () => {
      if (!lifecycle.active) return;
      lifecycle.active = false;
      lastRecordedReadinessStageRef.current = '';
      recordDashboardTabEntryStage(lifecycle.tabId, 'readiness:inactive', {
        surfaceId: lifecycle.surfaceId,
        themeId: lifecycle.themeId,
      });
    };

    if (!isActive || !tabId) {
      closeActiveTrace();
      return undefined;
    }

    if (
      lifecycle.active
      && (
        lifecycle.tabId !== tabId
        || lifecycle.surfaceId !== resolvedSurfaceId
        || lifecycle.themeId !== themeId
      )
    ) {
      closeActiveTrace();
    }
    lifecycle.active = true;
    lifecycle.surfaceId = resolvedSurfaceId;
    lifecycle.tabId = tabId;
    lifecycle.themeId = themeId;

    return () => {
      Promise.resolve().then(() => {
        if (lifecycle.generation !== generation || !lifecycle.active) return;
        closeActiveTrace();
      });
    };
  }, [isActive, resolvedSurfaceId, tabId, themeId]);

  return {
    ready,
    phase,
    error,
    hydrationReady,
    widgetsReady,
    readyKey: ready ? requestKey : '',
    readinessScope: readinessProfile?.scope || '',
    surfaceId: resolvedSurfaceId,
    widgetTypes: resolvedWidgetTypes,
    retry: hydrationError
      ? retryHydrationReadiness
      : hasWidgetError
        ? retryWidgetReadiness
        : null,
  };
}

export default useDashboardTabReadiness;
