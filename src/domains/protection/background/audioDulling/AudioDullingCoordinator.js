import { normalizeAudioDullingValue } from '../../../settings/config/audioDulling.js';
import { MESSAGE_TYPES } from '../../../../platform/messaging/messageTypes.js';

export const AUDIO_DULLING_OFFSCREEN_PATH = 'src/pages/offscreen.html';
export const AUDIO_DULLING_OFFSCREEN_TARGET = 'audioDullingOffscreen';

export const AUDIO_DULLING_SESSION_STATUS = Object.freeze({
  IDLE: 'idle',
  ARMED: 'armed',
  PERMISSION_REQUIRED: 'permission_required',
  USER_ACTIVATION_REQUIRED: 'user_activation_required',
  CAPTURE_UNAVAILABLE: 'capture_unavailable',
  CAPTURING: 'capturing',
  FAILED: 'failed',
});

const REQUIRED_AUDIO_DULLING_BROWSER_PORT_METHODS = Object.freeze([
  'permissionsContains',
  'permissionsRequest',
  'runtimeGetContexts',
  'runtimeGetURL',
  'runtimeSendMessage',
  'offscreenCreateDocument',
  'tabCaptureGetMediaStreamIdResult',
]);

function toErrorMessage(error) {
  return String(error?.message || error || 'AUDIO_DULLING_FAILED');
}

function resolveAudioDullingBrowserPort(browserPort) {
  const missingMethod = REQUIRED_AUDIO_DULLING_BROWSER_PORT_METHODS
    .find((method) => typeof browserPort?.[method] !== 'function');
  if (missingMethod) {
    throw new Error(`AUDIO_DULLING_BROWSER_PORT_METHOD_REQUIRED:${missingMethod}`);
  }
  return browserPort;
}

function normalizeTabId(tabId) {
  const numeric = Number(tabId);
  return Number.isInteger(numeric) && numeric >= 0 ? numeric : null;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isExtensionInvocationError(error) {
  const message = String(error || '');
  return /extension has not been invoked/i.test(message)
    || /activeTab permission/i.test(message);
}

function resolveTabCaptureError(error) {
  if (isExtensionInvocationError(error)) {
    return 'AUDIO_DULLING_EXTENSION_INVOCATION_REQUIRED';
  }
  return 'AUDIO_DULLING_USER_ACTIVATION_REQUIRED';
}

async function getTabCaptureStreamId(browserPort, options = {}) {
  const result = await browserPort.tabCaptureGetMediaStreamIdResult(options);
  return {
    error: result?.error || null,
    streamId: result?.streamId || result?.value || null,
  };
}

function clone(value) {
  if (!value || typeof value !== 'object') return value;
  return JSON.parse(JSON.stringify(value));
}

function requireOffscreenResponse(response, command) {
  if (!isPlainObject(response)) {
    throw new Error(`AUDIO_DULLING_OFFSCREEN_RESPONSE_REQUIRED:${command}`);
  }
  if (response.ok !== true) {
    throw new Error(
      response.error || `AUDIO_DULLING_OFFSCREEN_COMMAND_FAILED:${command}`,
    );
  }
  return response;
}

function requireCapturingOffscreenResponse(response, command) {
  const resolved = requireOffscreenResponse(response, command);
  if (resolved.status !== 'capturing_processed') {
    throw new Error(
      `AUDIO_DULLING_OFFSCREEN_STATUS_INVALID:${command}:${resolved.status || 'missing'}`,
    );
  }
  return resolved;
}

function requireRuntimeSnapshot(runtimeSnapshot) {
  if (!isPlainObject(runtimeSnapshot)) {
    throw new Error('AUDIO_DULLING_RUNTIME_SNAPSHOT_REQUIRED');
  }
  if (!isPlainObject(runtimeSnapshot.dispatch)) {
    throw new Error('AUDIO_DULLING_RUNTIME_DISPATCH_REQUIRED');
  }
  if (typeof runtimeSnapshot.dispatch.shouldApply !== 'boolean') {
    throw new Error('AUDIO_DULLING_RUNTIME_DISPATCH_FIELD_INVALID:shouldApply');
  }
  if (!isPlainObject(runtimeSnapshot.envelopeResult)) {
    throw new Error('AUDIO_DULLING_RUNTIME_ENVELOPE_RESULT_REQUIRED');
  }
  if (!isPlainObject(runtimeSnapshot.envelopeResult.state)) {
    throw new Error('AUDIO_DULLING_RUNTIME_ENVELOPE_FIELD_INVALID:state');
  }
  if (!isPlainObject(runtimeSnapshot.envelopeResult.state.compiledFeatures)) {
    throw new Error('AUDIO_DULLING_RUNTIME_ENVELOPE_FIELD_INVALID:state.compiledFeatures');
  }
  return {
    compiledFeatures: runtimeSnapshot.envelopeResult.state.compiledFeatures,
    shouldApply: runtimeSnapshot.dispatch.shouldApply,
  };
}

function readAudioDullingFeature(compiledFeatures) {
  if (!Object.prototype.hasOwnProperty.call(compiledFeatures, 'audioDulling')) {
    return {
      isActive: false,
      value: normalizeAudioDullingValue(null),
    };
  }
  const entry = compiledFeatures.audioDulling;
  if (!isPlainObject(entry)) {
    throw new Error('AUDIO_DULLING_RUNTIME_FEATURE_INVALID:audioDulling');
  }
  if (typeof entry.isActive !== 'boolean') {
    throw new Error('AUDIO_DULLING_RUNTIME_FEATURE_FIELD_INVALID:audioDulling.isActive');
  }
  return {
    isActive: entry.isActive,
    value: normalizeAudioDullingValue(entry.value),
  };
}

export function createAudioDullingCoordinator({ browserPort } = {}) {
  const resolvedBrowserPort = resolveAudioDullingBrowserPort(browserPort);
  const sessionByTab = new Map();
  const startPromiseByTab = new Map();
  let offscreenCreating = null;

  function writeSession(tabId, patch = {}) {
    const key = normalizeTabId(tabId);
    if (key === null) return null;
    const previous = sessionByTab.get(key) || {};
    const next = {
      tabId: key,
      status: AUDIO_DULLING_SESSION_STATUS.IDLE,
      updatedAt: Date.now(),
      ...previous,
      ...patch,
    };
    sessionByTab.set(key, next);
    return next;
  }

  async function sendOffscreenCommand(command, payload = {}) {
    return resolvedBrowserPort.runtimeSendMessage({
      type: MESSAGE_TYPES.AUDIO_DULLING_OFFSCREEN_COMMAND,
      target: AUDIO_DULLING_OFFSCREEN_TARGET,
      command,
      payload,
    });
  }

  async function ensureOffscreenDocument() {
    const offscreenUrl = resolvedBrowserPort.runtimeGetURL(AUDIO_DULLING_OFFSCREEN_PATH);
    let contexts = [];
    try {
      contexts = await resolvedBrowserPort.runtimeGetContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [offscreenUrl],
      });
    } catch (error) {
      return { ok: false, error: toErrorMessage(error) };
    }
    if (Array.isArray(contexts) && contexts.length > 0) return { ok: true };

    if (!offscreenCreating) {
      offscreenCreating = Promise.resolve()
        .then(() => resolvedBrowserPort.offscreenCreateDocument({
          url: AUDIO_DULLING_OFFSCREEN_PATH,
          reasons: ['USER_MEDIA', 'AUDIO_PLAYBACK'],
          justification: 'Apply local audio friction to protected tabs without recording audio.',
        }))
        .finally(() => {
          offscreenCreating = null;
        });
    }

    const error = await offscreenCreating;
    return error ? { ok: false, error } : { ok: true };
  }

  async function stopTab(tabId, { reason = 'inactive' } = {}) {
    const key = normalizeTabId(tabId);
    if (key === null) return { ok: false, error: 'AUDIO_DULLING_TAB_ID_REQUIRED' };
    const pendingStart = startPromiseByTab.get(key);
    if (pendingStart) {
      await pendingStart.catch(() => {});
    }
    const previous = sessionByTab.get(key);
    if (previous?.status === AUDIO_DULLING_SESSION_STATUS.CAPTURING) {
      requireOffscreenResponse(
        await sendOffscreenCommand('stop', { tabId: key }),
        'stop',
      );
    }
    sessionByTab.set(key, {
      tabId: key,
      status: AUDIO_DULLING_SESSION_STATUS.IDLE,
      reason,
      updatedAt: Date.now(),
    });
    return { ok: true, status: AUDIO_DULLING_SESSION_STATUS.IDLE };
  }

  async function reconcileTab({
    tabId,
    url = '',
    hostname = '',
    runtimeSnapshot = null,
    source = 'protection_runtime',
    now = Date.now(),
  } = {}) {
    const key = normalizeTabId(tabId);
    if (key === null) return { ok: false, error: 'AUDIO_DULLING_TAB_ID_REQUIRED' };

    const runtime = requireRuntimeSnapshot(runtimeSnapshot);
    const feature = readAudioDullingFeature(runtime.compiledFeatures);
    const active = feature.isActive && runtime.shouldApply;
    if (!active) {
      return stopTab(key, { reason: 'runtime_inactive' });
    }

    const previous = sessionByTab.get(key);
    const nextSession = writeSession(key, {
      config: feature.value,
      hostname,
      reason: 'runtime_active',
      runtimeSource: source,
      status: previous?.status === AUDIO_DULLING_SESSION_STATUS.CAPTURING
        ? AUDIO_DULLING_SESSION_STATUS.CAPTURING
        : AUDIO_DULLING_SESSION_STATUS.ARMED,
      updatedAt: now,
      url,
    });

    if (nextSession.status === AUDIO_DULLING_SESSION_STATUS.CAPTURING) {
      try {
        const response = requireCapturingOffscreenResponse(await sendOffscreenCommand('update', {
          tabId: key,
          config: feature.value,
        }), 'update');
        writeSession(key, {
          config: feature.value,
          offscreenState: clone(response),
          updatedAt: Date.now(),
        });
      } catch (error) {
        const message = toErrorMessage(error);
        writeSession(key, {
          error: message,
          status: AUDIO_DULLING_SESSION_STATUS.FAILED,
          updatedAt: Date.now(),
        });
        return { ok: false, error: message };
      }
    }

    return { ok: true, status: nextSession.status };
  }

  async function runStartArmedTab(tabId, {
    captureCurrentActiveTab = false,
    requestPermission = true,
  } = {}) {
    const key = normalizeTabId(tabId);
    if (key === null) return { ok: false, error: 'AUDIO_DULLING_TAB_ID_REQUIRED' };
    const session = sessionByTab.get(key);
    if (!session || session.status === AUDIO_DULLING_SESSION_STATUS.IDLE) {
      return { ok: false, error: 'AUDIO_DULLING_TAB_NOT_ARMED' };
    }
    if (session.status === AUDIO_DULLING_SESSION_STATUS.CAPTURING) {
      return {
        ok: true,
        status: AUDIO_DULLING_SESSION_STATUS.CAPTURING,
        state: clone(session),
      };
    }

    let streamId = null;
    let streamError = null;
    if (captureCurrentActiveTab) {
      ({ streamId, error: streamError } = await getTabCaptureStreamId(resolvedBrowserPort, {}));
      if (!streamId) {
        const error = resolveTabCaptureError(streamError);
        writeSession(key, {
          error,
          errorDetail: streamError || '',
          status: AUDIO_DULLING_SESSION_STATUS.USER_ACTIVATION_REQUIRED,
          updatedAt: Date.now(),
        });
        return { ok: false, error, detail: streamError || '' };
      }
    } else {
      const hasPermission = await resolvedBrowserPort.permissionsContains({ permissions: ['tabCapture'] });
      if (!hasPermission) {
        const granted = requestPermission
          ? await resolvedBrowserPort.permissionsRequest({ permissions: ['tabCapture'] })
          : false;
        if (!granted) {
          writeSession(key, {
            status: AUDIO_DULLING_SESSION_STATUS.PERMISSION_REQUIRED,
            updatedAt: Date.now(),
          });
          return { ok: false, error: 'AUDIO_DULLING_TAB_CAPTURE_PERMISSION_REQUIRED' };
        }
      }

      ({ streamId, error: streamError } = await getTabCaptureStreamId(resolvedBrowserPort, { targetTabId: key }));
      if (!streamId) {
        const error = resolveTabCaptureError(streamError);
        writeSession(key, {
          error,
          errorDetail: streamError || '',
          status: AUDIO_DULLING_SESSION_STATUS.USER_ACTIVATION_REQUIRED,
          updatedAt: Date.now(),
        });
        return { ok: false, error, detail: streamError || '' };
      }
    }

    const offscreenReady = await ensureOffscreenDocument();
    if (!offscreenReady.ok) {
      writeSession(key, {
        error: offscreenReady.error,
        status: AUDIO_DULLING_SESSION_STATUS.CAPTURE_UNAVAILABLE,
        updatedAt: Date.now(),
      });
      return { ok: false, error: offscreenReady.error };
    }

    let response;
    try {
      response = requireCapturingOffscreenResponse(await sendOffscreenCommand('start', {
        tabId: key,
        streamId,
        config: session.config,
      }), 'start');
    } catch (error) {
      const message = toErrorMessage(error);
      writeSession(key, {
        error: message,
        status: AUDIO_DULLING_SESSION_STATUS.FAILED,
        updatedAt: Date.now(),
      });
      return { ok: false, error: message };
    }

    const capturingSession = writeSession(key, {
      error: null,
      errorDetail: '',
      offscreenState: clone(response),
      status: AUDIO_DULLING_SESSION_STATUS.CAPTURING,
      updatedAt: Date.now(),
    });
    return {
      ok: true,
      status: AUDIO_DULLING_SESSION_STATUS.CAPTURING,
      state: clone(capturingSession),
    };
  }

  function startArmedTab(tabId, options = {}) {
    const key = normalizeTabId(tabId);
    if (key === null) {
      return Promise.resolve({ ok: false, error: 'AUDIO_DULLING_TAB_ID_REQUIRED' });
    }
    const existing = startPromiseByTab.get(key);
    if (existing) return existing;
    const startPromise = runStartArmedTab(key, options)
      .finally(() => {
        if (startPromiseByTab.get(key) === startPromise) {
          startPromiseByTab.delete(key);
        }
      });
    startPromiseByTab.set(key, startPromise);
    return startPromise;
  }

  function getTabState(tabId) {
    const key = normalizeTabId(tabId);
    if (key === null) return null;
    return clone(sessionByTab.get(key) || {
      tabId: key,
      status: AUDIO_DULLING_SESSION_STATUS.IDLE,
    });
  }

  async function refreshTabState(tabId) {
    const key = normalizeTabId(tabId);
    if (key === null) return null;
    const session = sessionByTab.get(key);
    if (session?.status !== AUDIO_DULLING_SESSION_STATUS.CAPTURING) {
      return getTabState(key);
    }
    try {
      const response = requireCapturingOffscreenResponse(
        await sendOffscreenCommand('snapshot', { tabId: key }),
        'snapshot',
      );
      writeSession(key, {
        offscreenState: clone(response),
        updatedAt: Date.now(),
      });
    } catch (error) {
      writeSession(key, {
        error: toErrorMessage(error),
        status: AUDIO_DULLING_SESSION_STATUS.FAILED,
        updatedAt: Date.now(),
      });
      throw error;
    }
    return getTabState(key);
  }

  return {
    reconcileTab,
    startArmedTab,
    stopTab,
    getTabState,
    refreshTabState,
  };
}
