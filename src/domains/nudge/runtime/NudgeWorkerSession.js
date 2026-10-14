import { createWorkerMessage, NUDGE_WORKER_MESSAGE } from './NudgeProtocol.js';
import {
  createNudgeWorkerActivationError,
  createNudgeWorkerScriptSource,
} from './NudgeWorkerScriptSource.js';

function createNudgeWorkerReleaseError(phase, error) {
  const reason = typeof error?.message === 'string' && error.message.trim()
    ? error.message.trim()
    : String(error || 'unknown');
  const releaseError = new Error(`nudge_worker_${phase}_release_failed:${reason}`);
  releaseError.code = `nudge_worker_${phase}_release_failed`;
  if (error instanceof Error) {
    releaseError.cause = error;
  }
  return releaseError;
}

function createNudgeWorkerPostError(type, sessionId, error) {
  const messageType = typeof type === 'string' && type.trim()
    ? type.trim()
    : 'unknown';
  const reason = typeof error?.message === 'string' && error.message.trim()
    ? error.message.trim()
    : String(error || 'unknown');
  const postError = new Error(`nudge_worker_post_failed:${messageType}:${reason}`);
  postError.code = 'nudge_worker_post_failed';
  postError.details = {
    messageType,
    sessionId,
  };
  if (error instanceof Error) {
    postError.cause = error;
  }
  return postError;
}

function logNudgeWorkerReleaseFailure(error) {
  if (typeof console === 'undefined' || typeof console.error !== 'function') return;
  console.error('[sentinel flare] worker session release failure', error);
}

class NudgeWorkerSession {
  constructor({ workerUrl, onMessage = null, onError = null } = {}) {
    this.workerUrl = workerUrl;
    this.onMessage = onMessage;
    this.onError = onError;
    this.worker = null;
    this.workerSource = null;
    this.initialized = false;
    this.sessionId = 0;
  }

  supports(canvas) {
    return (
      typeof Worker !== 'undefined'
      && !!canvas
      && typeof canvas.transferControlToOffscreen === 'function'
    );
  }

  isReady() {
    return this.initialized && !!this.worker;
  }

  getSessionId() {
    return this.sessionId;
  }

  prewarm({ canvas, bounds, dpr = 1, themeId, config, protocolStartAt = Date.now(), protocolProgress = null } = {}) {
    if (!this.ensureReady({ canvas, bounds, dpr, themeId, config, protocolStartAt, protocolProgress })) {
      return false;
    }
    return this.post(NUDGE_WORKER_MESSAGE.PREWARM, {
      bounds,
      dpr,
      themeId,
      config,
      protocolStartAt,
      protocolProgress,
    }, this.sessionId);
  }

  activate({ canvas, bounds, dpr = 1, themeId, config, protocolStartAt = Date.now(), protocolProgress = null } = {}) {
    if (!this.ensureReady({ canvas, bounds, dpr, themeId, config, protocolStartAt, protocolProgress })) {
      return 0;
    }
    this.sessionId += 1;
    const sent = this.post(NUDGE_WORKER_MESSAGE.ACTIVATE, {
      bounds,
      dpr,
      themeId,
      config,
      protocolStartAt,
      protocolProgress,
    }, this.sessionId);
    return sent ? this.sessionId : 0;
  }

  deactivate() {
    if (!this.isReady()) return false;
    return this.post(NUDGE_WORKER_MESSAGE.DEACTIVATE, null, this.sessionId);
  }

  resize({ bounds, dpr = 1 } = {}) {
    if (!this.isReady()) return false;
    return this.post(NUDGE_WORKER_MESSAGE.RESIZE, { bounds, dpr }, this.sessionId);
  }

  pointerDown({ x, y } = {}) {
    if (!this.isReady()) return false;
    return this.post(NUDGE_WORKER_MESSAGE.POINTER_DOWN, { x, y }, this.sessionId);
  }

  setModalOpen(open) {
    if (!this.isReady()) return false;
    return this.post(NUDGE_WORKER_MESSAGE.SET_MODAL_OPEN, { open: !!open }, this.sessionId);
  }

  setTheme(themeId) {
    if (!this.isReady()) return false;
    return this.post(NUDGE_WORKER_MESSAGE.SET_THEME, { themeId }, this.sessionId);
  }

  setConfig(config, protocolProgress = null) {
    if (!this.isReady()) return false;
    return this.post(NUDGE_WORKER_MESSAGE.SET_CONFIG, { config, protocolProgress }, this.sessionId);
  }

  forceSpawn(spawnHint = null, metadata = {}) {
    if (!this.isReady()) return false;
    return this.post(NUDGE_WORKER_MESSAGE.FORCE_SPAWN, {
      ...(metadata && typeof metadata === 'object' ? metadata : {}),
      spawnHint,
    }, this.sessionId);
  }

  terminate() {
    this.releaseWorker(this.worker);
  }

  releaseWorker(worker = null) {
    if (worker) {
      try {
        worker.onmessage = null;
        worker.onerror = null;
        worker.terminate();
      } catch (error) {
        this.reportReleaseFailure('terminate', error);
      }
    }
    this.worker = null;
    this.releaseWorkerSource();
    this.initialized = false;
    this.sessionId = 0;
  }

  releaseWorkerSource() {
    if (this.workerSource?.revoke) {
      try {
        this.workerSource.revoke();
      } catch (error) {
        this.reportReleaseFailure('source_revoke', error);
      }
    }
    this.workerSource = null;
  }

  reportReleaseFailure(phase, error) {
    const releaseError = createNudgeWorkerReleaseError(phase, error);
    logNudgeWorkerReleaseFailure(releaseError);
    if (typeof this.onError === 'function') {
      this.onError(releaseError);
    }
  }

  createWorker() {
    const workerSource = createNudgeWorkerScriptSource(this.workerUrl);
    try {
      const worker = new Worker(workerSource.url, { type: 'module' });
      this.workerSource = workerSource;
      return worker;
    } catch (error) {
      try {
        workerSource.revoke?.();
      } catch (revokeError) {
        this.reportReleaseFailure('source_revoke', revokeError);
      }
      throw createNudgeWorkerActivationError(error, workerSource);
    }
  }

  ensureReady({
    canvas,
    bounds,
    dpr = 1,
    themeId,
    config,
    protocolStartAt = Date.now(),
    protocolProgress = null,
  } = {}) {
    if (!this.supports(canvas)) return false;
    if (!this.worker) {
      this.worker = this.createWorker();
      this.worker.onmessage = this.onMessage;
      this.worker.onerror = (error) => {
        const failedWorker = this.worker;
        const workerSource = this.workerSource;
        this.releaseWorker(failedWorker);
        if (typeof this.onError === 'function') {
          this.onError(createNudgeWorkerActivationError(error, workerSource));
        }
      };
    }
    if (this.initialized) {
      if (bounds) {
        this.resize({ bounds, dpr });
      }
      if (themeId) {
        this.setTheme(themeId);
      }
      if (config) {
        this.setConfig(config, protocolProgress);
      }
      return true;
    }
    try {
      const offscreenCanvas = canvas.transferControlToOffscreen();
      this.worker.postMessage(
        createWorkerMessage(NUDGE_WORKER_MESSAGE.INIT, {
          canvas: offscreenCanvas,
          bounds,
          dpr,
          themeId,
          config,
          protocolStartAt,
          protocolProgress,
        }, this.sessionId),
        [offscreenCanvas],
      );
    } catch (error) {
      const failedWorker = this.worker;
      const workerSource = this.workerSource;
      this.releaseWorker(failedWorker);
      throw createNudgeWorkerActivationError(error, workerSource);
    }
    this.initialized = true;
    return true;
  }

  post(type, payload = null, sessionId = this.sessionId) {
    if (!this.worker) return false;
    try {
      this.worker.postMessage(createWorkerMessage(type, payload, sessionId));
      return true;
    } catch (error) {
      if (typeof this.onError === 'function') {
        this.onError(createNudgeWorkerPostError(type, sessionId, error));
      }
      return false;
    }
  }
}

export default NudgeWorkerSession;
