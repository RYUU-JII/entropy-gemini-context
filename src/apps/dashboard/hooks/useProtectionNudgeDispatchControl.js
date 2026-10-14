import { useCallback, useEffect, useRef, useState } from 'react';

import {
  hasChromeTabs,
  runtimeSendMessage,
  tabsGet,
  tabsQuery,
} from '../../../platform/chrome/ChromeService.js';
import { MESSAGE_ACTIONS, MESSAGE_TYPES } from '../../../platform/messaging/messageTypes.js';
import {
  DEFAULT_NUDGE_DEBUG_CONFIG,
  buildNudgeDebugConfig,
  isWebUrl,
} from '../utils/protectionArtifactsControlPlane.js';

const SPAWN_TARGET_AUTO = 'auto';

function createIdleDispatchTrace() {
  return {
    status: 'idle',
    stage: 'idle',
    messageType: null,
    targetTabId: null,
    target: null,
    startedAt: null,
    completedAt: null,
    response: null,
    error: null,
  };
}

function getMessageType(message) {
  return typeof message?.type === 'string' && message.type.trim()
    ? message.type.trim()
    : null;
}

function buildTargetSummary(tab = null) {
  if (!tab || typeof tab !== 'object') return null;
  let host = '';
  try {
    host = new URL(tab.url).hostname.replace(/^www\./, '');
  } catch (_) {}
  return {
    id: typeof tab.id === 'number' ? tab.id : null,
    title: typeof tab.title === 'string' ? tab.title.trim() : '',
    url: typeof tab.url === 'string' ? tab.url : '',
    host,
    active: tab.active === true,
  };
}

export function useProtectionNudgeDispatchControl({
  nudgeConfigOverrides = null,
  nudgeRuntimeContext,
  setStatus,
  t,
}) {
  const [debugConfig, setDebugConfig] = useState(DEFAULT_NUDGE_DEBUG_CONFIG);
  const debugConfigRef = useRef(debugConfig);
  const debugDispatchTimerRef = useRef(null);
  const [spawnTargetTabId, setSpawnTargetTabId] = useState(SPAWN_TARGET_AUTO);
  const [spawnTargetTabs, setSpawnTargetTabs] = useState([]);
  const [dispatchTrace, setDispatchTrace] = useState(() => createIdleDispatchTrace());
  const [workerProbeTrace, setWorkerProbeTrace] = useState(() => createIdleDispatchTrace());
  const [frameWorkerProbeTrace, setFrameWorkerProbeTrace] = useState(() => createIdleDispatchTrace());
  const [contentDiagnostics, setContentDiagnostics] = useState(null);
  const [contentDiagnosticsError, setContentDiagnosticsError] = useState('');
  const lastTargetTabIdRef = useRef(null);

  useEffect(() => {
    debugConfigRef.current = debugConfig;
  }, [debugConfig]);

  useEffect(() => () => {
    if (debugDispatchTimerRef.current) {
      clearTimeout(debugDispatchTimerRef.current);
      debugDispatchTimerRef.current = null;
    }
  }, []);

  const refreshSpawnTargetTabs = useCallback(async () => {
    if (!hasChromeTabs()) {
      setSpawnTargetTabs([]);
      setSpawnTargetTabId(SPAWN_TARGET_AUTO);
      return;
    }

    const tabs = await tabsQuery({ lastFocusedWindow: true });
    const candidates = tabs
      .filter((tab) => typeof tab?.id === 'number' && isWebUrl(tab?.url))
      .map((tab) => {
        const rawTitle = typeof tab.title === 'string' ? tab.title.trim() : '';
        let host = '';
        try {
          host = new URL(tab.url).hostname.replace(/^www\./, '');
        } catch (_) {}
        return {
          id: tab.id,
          title: rawTitle,
          host,
          active: !!tab.active,
        };
      })
      .sort((a, b) => {
        if (a.active !== b.active) return a.active ? -1 : 1;
        return a.id - b.id;
      });

    setSpawnTargetTabs(candidates);
    setSpawnTargetTabId((prev) => {
      if (prev === SPAWN_TARGET_AUTO) return prev;
      const exists = candidates.some((entry) => String(entry.id) === String(prev));
      return exists ? prev : SPAWN_TARGET_AUTO;
    });
  }, []);

  const getLastActiveTabId = useCallback(async () => {
    const resp = await runtimeSendMessage({ action: MESSAGE_ACTIONS.DEBUG_GET_TRACKING_RUNTIME_STATE });
    return resp?.runtime?.lastActiveTabId ?? null;
  }, []);

  const resolveTargetTabId = useCallback(async () => {
    const lastId = await getLastActiveTabId();
    if (typeof lastId === 'number') {
      const tab = await tabsGet(lastId);
      if (tab && isWebUrl(tab.url)) return lastId;
    }
    const tabs = await tabsQuery({ lastFocusedWindow: true });
    const candidate = tabs.find((tab) => isWebUrl(tab.url));
    return candidate?.id ?? null;
  }, [getLastActiveTabId]);

  const refreshContentDiagnostics = useCallback(async (targetTabId = null) => {
    const hasTargetTabId = targetTabId !== null
      && targetTabId !== undefined
      && String(targetTabId).trim() !== '';
    const rawTargetTabId = hasTargetTabId && Number.isInteger(Number(targetTabId))
      ? Number(targetTabId)
      : lastTargetTabIdRef.current;
    if (!Number.isInteger(rawTargetTabId) || rawTargetTabId < 0) {
      setContentDiagnostics(null);
      setContentDiagnosticsError('');
      return null;
    }

    const response = await runtimeSendMessage({
      action: MESSAGE_ACTIONS.DEBUG_GET_CONTENT_RUNTIME_DIAGNOSTICS,
      targetTabId: rawTargetTabId,
      limit: 30,
    });
    if (response?.success) {
      setContentDiagnostics(response.snapshot || null);
      setContentDiagnosticsError('');
      return response.snapshot || null;
    }
    const errorText = String(response?.error || 'UNKNOWN_ERROR');
    setContentDiagnosticsError(errorText);
    return null;
  }, []);

  const sendNudgeDebugMessage = useCallback(async (message, options = null) => {
    const shouldTrack = options?.track !== false;
    const setTrace = options?.traceTarget === 'workerProbe'
      ? setWorkerProbeTrace
      : options?.traceTarget === 'frameWorkerProbe'
        ? setFrameWorkerProbeTrace
        : setDispatchTrace;
    const messageType = getMessageType(message);
    const startedAt = Date.now();
    if (shouldTrack) {
      setTrace({
        ...createIdleDispatchTrace(),
        status: 'resolving',
        stage: 'target',
        messageType,
        startedAt,
      });
    }

    if (!hasChromeTabs()) {
      if (shouldTrack) {
        setTrace({
          ...createIdleDispatchTrace(),
          status: 'error',
          stage: 'target',
          messageType,
          startedAt,
          completedAt: Date.now(),
          error: 'API_UNAVAILABLE',
        });
      }
      setStatus(t('status.api_unavailable'), 'error');
      return { response: null, targetTabId: null, error: 'API_UNAVAILABLE' };
    }

    const hasPreferredTarget = options?.targetTabId !== null
      && options?.targetTabId !== undefined
      && String(options.targetTabId).trim() !== '';
    const preferredTabId = hasPreferredTarget ? Number(options.targetTabId) : null;
    let tabId = null;
    let targetTab = null;
    if (Number.isFinite(preferredTabId)) {
      const preferredTab = await tabsGet(preferredTabId);
      if (!preferredTab || !isWebUrl(preferredTab.url)) {
        if (shouldTrack) {
          setTrace({
            ...createIdleDispatchTrace(),
            status: 'error',
            stage: 'target',
            messageType,
            targetTabId: preferredTabId,
            target: buildTargetSummary(preferredTab),
            startedAt,
            completedAt: Date.now(),
            error: 'INVALID_TARGET_TAB',
          });
        }
        setStatus(t('status.target_tab_missing'), 'error');
        return { response: null, targetTabId: preferredTabId, error: 'INVALID_TARGET_TAB' };
      }
      tabId = preferredTabId;
      targetTab = preferredTab;
    } else {
      tabId = await resolveTargetTabId();
      if (typeof tabId === 'number') {
        targetTab = await tabsGet(tabId);
      }
    }

    if (!Number.isInteger(Number(tabId)) || Number(tabId) < 0) {
      if (shouldTrack) {
        setTrace({
          ...createIdleDispatchTrace(),
          status: 'error',
          stage: 'target',
          messageType,
          startedAt,
          completedAt: Date.now(),
          error: 'NO_TARGET_TAB',
        });
      }
      setStatus(t('status.no_target'), 'error');
      return { response: null, targetTabId: null, error: 'NO_TARGET_TAB' };
    }

    tabId = Number(tabId);
    lastTargetTabIdRef.current = tabId;
    if (shouldTrack) {
      setTrace({
        ...createIdleDispatchTrace(),
        status: 'dispatching',
        stage: 'background',
        messageType,
        targetTabId: tabId,
        target: buildTargetSummary(targetTab),
        startedAt,
      });
    }

    const response = await runtimeSendMessage({
      action: MESSAGE_ACTIONS.DEBUG_DISPATCH_NUDGE_MESSAGE,
      targetTabId: tabId,
      message,
    });
    if (shouldTrack) {
      setTrace({
        status: response?.success ? 'success' : 'error',
        stage: response?.success ? 'render' : 'failed',
        messageType,
        targetTabId: tabId,
        target: buildTargetSummary(targetTab),
        startedAt,
        completedAt: Date.now(),
        response: response || null,
        error: response?.success ? null : String(response?.error || 'UNKNOWN_ERROR'),
      });
      refreshContentDiagnostics(tabId).catch(() => {});
    }

    if (response?.success) {
      if (response?.delivery === 'injected') {
        setStatus(t('status.signal_established'), 'success');
        return { response, targetTabId: tabId, targetTab, error: null };
      }
      setStatus(t('status.signal_sent'), 'success');
      return { response, targetTabId: tabId, targetTab, error: null };
    }

    const errorText = String(response?.error || 'UNKNOWN_ERROR');
    if (
      errorText.includes('INVALID_TARGET_TAB')
      || errorText.includes('CONTENT_ORCHESTRATOR_UNAVAILABLE')
      || errorText.includes('inject_failed')
      || errorText.includes('missing_scripting_permission')
    ) {
      setStatus(t('status.link_failed'), 'error');
      return;
    }

    setStatus(
      t('status.transmission_error_with_detail', { error: errorText }),
      'error',
    );
    return { response: response || null, targetTabId: tabId, targetTab, error: errorText };
  }, [refreshContentDiagnostics, resolveTargetTabId, setStatus, t]);

  const handleSpawnTargetTabChange = useCallback((event) => {
    const raw = typeof event?.target?.value === 'string' ? event.target.value.trim() : '';
    if (!raw || raw === SPAWN_TARGET_AUTO) {
      setSpawnTargetTabId(SPAWN_TARGET_AUTO);
      return;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      setSpawnTargetTabId(SPAWN_TARGET_AUTO);
      return;
    }
    setSpawnTargetTabId(String(Math.trunc(parsed)));
  }, []);

  const buildCurrentNudgeDebugConfig = useCallback((baseConfig = debugConfigRef.current) => (
    buildNudgeDebugConfig({
      ...(baseConfig && typeof baseConfig === 'object' ? baseConfig : {}),
      ...(nudgeConfigOverrides && typeof nudgeConfigOverrides === 'object' ? nudgeConfigOverrides : {}),
    }, nudgeRuntimeContext)
  ), [nudgeConfigOverrides, nudgeRuntimeContext]);

  const scheduleDebugConfigDispatch = useCallback((nextConfig) => {
    if (debugDispatchTimerRef.current) clearTimeout(debugDispatchTimerRef.current);
    debugDispatchTimerRef.current = setTimeout(() => {
      sendNudgeDebugMessage({
        type: MESSAGE_TYPES.NUDGE_DEBUG_CONFIG,
        payload: {
          config: buildCurrentNudgeDebugConfig(nextConfig),
          runtimeContext: nudgeRuntimeContext,
        },
      }, { track: false }).catch(() => {});
    }, 120);
  }, [buildCurrentNudgeDebugConfig, nudgeRuntimeContext, sendNudgeDebugMessage]);

  const updateDebugValue = useCallback((key, parser) => (event) => {
    const nextValue = parser(event.target.value);
    const nextConfig = { ...debugConfigRef.current, [key]: nextValue };
    if (key === 'maxSprites') {
      const minTotal = Math.max(1, Math.round(Number(nextValue) || 1));
      const currentTotal = Math.round(Number(nextConfig.maxTotalSpawned) || 0);
      if (!Number.isFinite(currentTotal) || currentTotal < minTotal) {
        nextConfig.maxTotalSpawned = minTotal;
      }
    }
    if (key === 'maxTotalSpawned') {
      const minTotal = Math.max(1, Math.round(Number(nextConfig.maxSprites) || 1));
      nextConfig.maxTotalSpawned = Math.max(minTotal, Math.round(Number(nextValue) || minTotal));
    }
    if (key === 'maxSplits') {
      nextConfig.maxSplits = Math.max(0, Math.round(Number(nextValue) || 0));
    }
    debugConfigRef.current = nextConfig;
    setDebugConfig(nextConfig);
    scheduleDebugConfigDispatch(nextConfig);
  }, [scheduleDebugConfigDispatch]);

  const handleSpawn = useCallback(async () => {
    const config = buildCurrentNudgeDebugConfig();
    const targetTabId = spawnTargetTabId === SPAWN_TARGET_AUTO
      ? null
      : Number(spawnTargetTabId);
    return sendNudgeDebugMessage({
      type: MESSAGE_TYPES.NUDGE_DEBUG_SPAWN,
      payload: {
        config,
        runtimeContext: nudgeRuntimeContext,
        runtimeHost: 'extension_frame_worker',
      },
    }, { targetTabId });
  }, [buildCurrentNudgeDebugConfig, nudgeRuntimeContext, sendNudgeDebugMessage, spawnTargetTabId]);

  const handleWorkerProbe = useCallback(async () => {
    const config = buildCurrentNudgeDebugConfig();
    const targetTabId = spawnTargetTabId === SPAWN_TARGET_AUTO
      ? null
      : Number(spawnTargetTabId);
    return sendNudgeDebugMessage({
      type: MESSAGE_TYPES.NUDGE_DEBUG_WORKER_PROBE,
      payload: {
        config,
        runtimeContext: nudgeRuntimeContext,
        timeoutMs: 2200,
      },
    }, {
      targetTabId,
      traceTarget: 'workerProbe',
    });
  }, [buildCurrentNudgeDebugConfig, nudgeRuntimeContext, sendNudgeDebugMessage, spawnTargetTabId]);

  const handleFrameWorkerProbe = useCallback(async () => {
    const config = buildCurrentNudgeDebugConfig();
    const targetTabId = spawnTargetTabId === SPAWN_TARGET_AUTO
      ? null
      : Number(spawnTargetTabId);
    return sendNudgeDebugMessage({
      type: MESSAGE_TYPES.NUDGE_DEBUG_FRAME_WORKER_PROBE,
      payload: {
        config,
        runtimeContext: nudgeRuntimeContext,
        renderMode: 'nudge_swarm',
        durationMs: 2200,
        timeoutMs: 5200,
      },
    }, {
      targetTabId,
      traceTarget: 'frameWorkerProbe',
    });
  }, [buildCurrentNudgeDebugConfig, nudgeRuntimeContext, sendNudgeDebugMessage, spawnTargetTabId]);

  const handleStop = useCallback(async () => {
    return sendNudgeDebugMessage({ type: MESSAGE_TYPES.NUDGE_DEBUG_STOP });
  }, [sendNudgeDebugMessage]);

  return {
    debugConfig,
    contentDiagnostics,
    contentDiagnosticsError,
    dispatchTrace,
    frameWorkerProbeTrace,
    handleFrameWorkerProbe,
    handleSpawn,
    handleSpawnTargetTabChange,
    handleStop,
    handleWorkerProbe,
    refreshContentDiagnostics,
    refreshSpawnTargetTabs,
    spawnTargetTabId,
    spawnTargetTabs,
    updateDebugValue,
    workerProbeTrace,
  };
}

export default useProtectionNudgeDispatchControl;
