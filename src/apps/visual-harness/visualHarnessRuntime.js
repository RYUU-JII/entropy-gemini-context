export const VISUAL_HARNESS_RUNTIME_VERSION = 1;
export const VISUAL_HARNESS_GLOBAL = '__ENTROPY_VISUAL_HARNESS__';
export const VISUAL_HARNESS_STATUS_EVENT = 'entropy:visual-harness-status';

function serializeError(error) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      code: typeof error.code === 'string' ? error.code : '',
      stack: typeof error.stack === 'string' ? error.stack : '',
      details: error.details && typeof error.details === 'object' ? error.details : null,
    };
  }

  return {
    name: 'Error',
    message: typeof error === 'string' ? error : String(error),
    code: '',
    stack: '',
    details: null,
  };
}

function dispatchStatus(state) {
  window.dispatchEvent(new CustomEvent(VISUAL_HARNESS_STATUS_EVENT, {
    detail: {
      status: state.status,
      sceneId: state.scene?.id || state.requestedSceneId,
    },
  }));
}

export function installVisualHarnessRuntime(requestedSceneId) {
  if (typeof window !== 'object' || !window) {
    throw new Error('[VisualHarness] browser runtime requires window.');
  }
  if (Object.prototype.hasOwnProperty.call(window, VISUAL_HARNESS_GLOBAL)) {
    throw new Error('[VisualHarness] runtime is already installed on this page.');
  }

  const state = {
    version: VISUAL_HARNESS_RUNTIME_VERSION,
    requestedSceneId,
    status: 'booting',
    scene: null,
    error: null,
    readyAt: 0,
  };
  Object.seal(state);
  Object.defineProperty(window, VISUAL_HARNESS_GLOBAL, {
    configurable: false,
    enumerable: false,
    writable: false,
    value: state,
  });

  function publishScene(sceneManifest) {
    state.scene = sceneManifest;
    state.status = 'preparing';
    dispatchStatus(state);
  }

  function markRendering() {
    if (!state.scene) {
      throw new Error('[VisualHarness] cannot render before publishing a scene manifest.');
    }
    state.status = 'rendering';
    dispatchStatus(state);
  }

  function markReady() {
    if (state.status === 'ready') return;
    if (state.status !== 'rendering') {
      throw new Error(`[VisualHarness] scene signaled ready while status was '${state.status}'.`);
    }
    state.readyAt = Date.now();
    state.status = 'ready';
    document.documentElement.dataset.visualHarnessStatus = 'ready';
    dispatchStatus(state);
  }

  function markError(error) {
    if (state.status === 'error') return;
    state.error = serializeError(error);
    state.status = 'error';
    document.documentElement.dataset.visualHarnessStatus = 'error';
    dispatchStatus(state);
  }

  return Object.freeze({
    markError,
    markReady,
    markRendering,
    publishScene,
    state,
  });
}

export function getVisualHarnessRuntimeState() {
  return typeof window === 'object' && window
    ? window[VISUAL_HARNESS_GLOBAL] || null
    : null;
}
