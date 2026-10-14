export const DEFAULT_WORKER_CANVAS_DISPOSE_GRACE_MS = 500;
export const DEFAULT_WORKER_CANVAS_HOST_STYLE = Object.freeze({
  position: 'absolute',
  inset: '0',
  width: '100%',
  height: '100%',
  display: 'block',
  pointerEvents: 'none',
});

export const THEME_WORKER_RENDER_MESSAGE_TYPE = Object.freeze({
  INIT: 'init',
  RESIZE: 'resize',
  ACTIVE: 'active',
  DISPOSE: 'dispose',
});

const toFiniteNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const resolveCssExtent = (value) => Math.max(1, Math.floor(toFiniteNumber(value, 1)));

export function resolveWorkerCanvasPixelRatio(value) {
  const ratio = Number(value);
  if (!Number.isFinite(ratio) || ratio <= 0) {
    throw new Error('THEME_WORKER_CANVAS_PIXEL_RATIO_INVALID');
  }
  // The host has already resolved its surface budget. Transport must preserve
  // that effective ratio, including sub-1 backing stores on large viewports.
  return ratio;
}

export function resolveWorkerCanvasPixelExtent(value, pixelRatio) {
  return Math.max(
    1,
    Math.floor(resolveCssExtent(value) * resolveWorkerCanvasPixelRatio(pixelRatio)),
  );
}

export function resolveWorkerCanvasMetrics({
  width,
  height,
  pixelRatio,
} = {}) {
  const cssWidth = resolveCssExtent(width);
  const cssHeight = resolveCssExtent(height);
  const dpr = resolveWorkerCanvasPixelRatio(pixelRatio);
  return {
    cssWidth,
    cssHeight,
    pixelWidth: resolveWorkerCanvasPixelExtent(cssWidth, dpr),
    pixelHeight: resolveWorkerCanvasPixelExtent(cssHeight, dpr),
    pixelRatio: dpr,
  };
}

export function buildWorkerCanvasMetricsSignature(metrics = {}) {
  return [
    Math.max(1, Math.round(Number(metrics?.pixelWidth) || 1)),
    Math.max(1, Math.round(Number(metrics?.pixelHeight) || 1)),
    resolveWorkerCanvasPixelRatio(metrics?.pixelRatio),
  ].join('x');
}

export function syncWorkerCanvasPlaceholder(
  canvas,
  metrics,
  { canSetBackingStore = false } = {},
) {
  if (!canvas || !metrics) {
    throw new Error('THEME_WORKER_CANVAS_PLACEHOLDER_MISSING');
  }

  const nextWidthStyle = `${Math.max(1, Math.round(Number(metrics.cssWidth) || 1))}px`;
  const nextHeightStyle = `${Math.max(1, Math.round(Number(metrics.cssHeight) || 1))}px`;
  if (canvas.style && canvas.style.width !== nextWidthStyle) {
    canvas.style.width = nextWidthStyle;
  }
  if (canvas.style && canvas.style.height !== nextHeightStyle) {
    canvas.style.height = nextHeightStyle;
  }

  if (canSetBackingStore) {
    const pixelWidth = Math.max(1, Math.round(Number(metrics.pixelWidth) || 1));
    const pixelHeight = Math.max(1, Math.round(Number(metrics.pixelHeight) || 1));
    if (canvas.width !== pixelWidth) {
      canvas.width = pixelWidth;
    }
    if (canvas.height !== pixelHeight) {
      canvas.height = pixelHeight;
    }
  }
}

export function createWorkerCanvasElement({
  className = '',
  style = DEFAULT_WORKER_CANVAS_HOST_STYLE,
} = {}) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    throw new Error('THEME_WORKER_CANVAS_DOCUMENT_UNAVAILABLE');
  }
  const canvas = document.createElement('canvas');
  if (typeof className === 'string' && className.trim()) {
    canvas.className = className.trim();
  }
  if (style && typeof style === 'object') {
    Object.assign(canvas.style, style);
  }
  return canvas;
}

export function attachWorkerCanvasToHost({
  canvas,
  host,
  onAttached = null,
} = {}) {
  if (!canvas || !host) {
    throw new Error('THEME_WORKER_CANVAS_HOST_ATTACH_MISSING');
  }
  if (canvas.parentNode && canvas.parentNode !== host) {
    canvas.parentNode.removeChild(canvas);
  }
  if (canvas.parentNode !== host) {
    host.appendChild(canvas);
  }
  if (typeof onAttached === 'function') {
    onAttached({
      canvas,
      host,
      canvasConnected: canvas?.isConnected === true,
      hostClientWidth: Number(host?.clientWidth) || 0,
      hostClientHeight: Number(host?.clientHeight) || 0,
    });
  }
  return host;
}

export function createThemeWorkerCanvasHostController({
  canvas = null,
  createCanvas = createWorkerCanvasElement,
  canvasOptions = {},
  host = null,
  resolveHost = null,
  onAttached = null,
} = {}) {
  const workerCanvas = canvas || createCanvas(canvasOptions);
  let currentHost = host;
  let lifecycleState = currentHost ? 'attached' : 'detached';

  const resolveNextHost = (nextHost = currentHost) => {
    const resolvedHost = typeof resolveHost === 'function'
      ? resolveHost(nextHost)
      : nextHost;
    if (!resolvedHost) {
      throw new Error('THEME_WORKER_CANVAS_HOST_MISSING');
    }
    return resolvedHost;
  };

  const attachToHost = (
    nextHost = currentHost,
    { label = 'worker_canvas_attached' } = {},
  ) => {
    const resolvedHost = resolveNextHost(nextHost);
    attachWorkerCanvasToHost({
      canvas: workerCanvas,
      host: resolvedHost,
      onAttached(details) {
        if (typeof onAttached === 'function') {
          onAttached({
            ...details,
            label,
            lifecycleState: 'attached',
          });
        }
      },
    });
    currentHost = resolvedHost;
    lifecycleState = 'attached';
    return currentHost;
  };

  const detach = () => {
    if (workerCanvas?.parentNode) {
      workerCanvas.parentNode.removeChild(workerCanvas);
    }
    lifecycleState = 'detached';
    return true;
  };

  const dispose = () => {
    detach();
    currentHost = null;
    lifecycleState = 'disposed';
    return true;
  };

  return {
    canvas: workerCanvas,
    attachToHost,
    detach,
    dispose,
    getHost() {
      return currentHost;
    },
    getState() {
      return lifecycleState;
    },
    isAttached() {
      return workerCanvas?.parentNode === currentHost;
    },
  };
}

export function resolveWorkerCanvasRuntimeAvailability({
  canvas = null,
  host = null,
  requireCanvasTransfer = false,
  requireDocument = false,
  requireHost = false,
} = {}) {
  const hasWorker = typeof Worker !== 'undefined';
  const hasOffscreenCanvas = typeof OffscreenCanvas !== 'undefined';
  const hasDocument = typeof document !== 'undefined';
  const hasCanvas = !!canvas;
  const hasCanvasTransfer = !!canvas && typeof canvas.transferControlToOffscreen === 'function';
  const hasHost = !!host;
  const missing = [];

  if (!hasWorker) missing.push('Worker');
  if (!hasOffscreenCanvas) missing.push('OffscreenCanvas');
  if (requireDocument && !hasDocument) missing.push('document');
  if (requireHost && !hasHost) missing.push('host');
  if (requireCanvasTransfer) {
    if (!hasCanvas) missing.push('canvas');
    if (hasCanvas && !hasCanvasTransfer) missing.push('canvas.transferControlToOffscreen');
  }

  return Object.freeze({
    supported: missing.length === 0,
    hasWorker,
    hasOffscreenCanvas,
    hasDocument,
    hasCanvas,
    hasCanvasTransfer,
    hasHost,
    missing,
  });
}

export function assertWorkerCanvasRuntimeAvailability(options = {}, errorCode = 'THEME_WORKER_CANVAS_RUNTIME_UNAVAILABLE') {
  const availability = resolveWorkerCanvasRuntimeAvailability(options);
  if (availability.supported) {
    return availability;
  }
  throw new Error(`${errorCode}:${availability.missing.join(',') || 'unknown'}`);
}

export function createRetainedCanvasControllerRegistry() {
  const controllerByCanvas = new WeakMap();
  return {
    get(canvas) {
      return canvas ? controllerByCanvas.get(canvas) || null : null;
    },
    set(canvas, controller) {
      if (canvas && controller) {
        controllerByCanvas.set(canvas, controller);
      }
    },
    delete(canvas) {
      if (canvas) {
        controllerByCanvas.delete(canvas);
      }
    },
    retainOrCreate({
      canvas,
      createController,
      retainController,
    } = {}) {
      const existing = canvas ? controllerByCanvas.get(canvas) : null;
      if (existing && typeof existing.isDisposed === 'function' && !existing.isDisposed()) {
        return typeof retainController === 'function'
          ? retainController(existing)
          : existing;
      }
      if (typeof createController !== 'function') {
        throw new Error('THEME_WORKER_CANVAS_CONTROLLER_FACTORY_MISSING');
      }
      const controller = createController();
      if (canvas && controller) {
        controllerByCanvas.set(canvas, controller);
      }
      return controller;
    },
  };
}

export function createThemeWorkerRenderController({
  canvas,
  createWorker,
  disposeWorker = null,
  width,
  height,
  pixelRatio,
  messageType = THEME_WORKER_RENDER_MESSAGE_TYPE,
  initPayload = {},
  onMessage = null,
  onError = null,
  availabilityErrorCode = 'THEME_WORKER_RENDER_CONTROLLER_UNAVAILABLE',
  syncPlaceholder = true,
} = {}) {
  assertWorkerCanvasRuntimeAvailability({
    canvas,
    requireCanvasTransfer: true,
  }, availabilityErrorCode);
  if (typeof createWorker !== 'function') {
    throw new Error('THEME_WORKER_RENDER_CONTROLLER_WORKER_FACTORY_MISSING');
  }

  let disposed = false;
  let terminateTimer = null;
  let lastSizeSignature = '';
  let lastActive = null;
  let worker = null;

  const terminate = (reason = 'renderer_dispose') => {
    if (disposed) {
      return false;
    }
    disposed = true;
    if (terminateTimer) {
      clearTimeout(terminateTimer);
      terminateTimer = null;
    }
    if (worker) {
      try {
        worker.postMessage({
          type: messageType.DISPOSE,
          payload: { reason },
        });
      } catch (_) {
        // Worker may already be gone during teardown.
      }
      if (typeof disposeWorker === 'function') {
        disposeWorker(worker, { reason });
      } else {
        worker.terminate();
      }
    }
    return true;
  };

  const post = (type, payload = {}, transfer = undefined) => {
    if (disposed) {
      return false;
    }
    if (Array.isArray(transfer)) {
      worker.postMessage({ type, payload }, transfer);
    } else {
      worker.postMessage({ type, payload });
    }
    return true;
  };

  try {
    worker = createWorker();
    const metrics = resolveWorkerCanvasMetrics({ width, height, pixelRatio });
    if (syncPlaceholder) {
      syncWorkerCanvasPlaceholder(canvas, metrics, { canSetBackingStore: true });
    }
    const offscreenCanvas = canvas.transferControlToOffscreen();

    worker.onmessage = (event) => {
      try {
        if (typeof onMessage === 'function') {
          onMessage(event);
        }
      } finally {
        if (event?.data?.type === messageType.ERROR) {
          terminate('worker_message_error');
        }
      }
    };

    worker.onerror = (error) => {
      try {
        if (typeof onError === 'function') {
          onError(error);
        }
      } finally {
        terminate('worker_uncaught_error');
      }
    };

    post(
      messageType.INIT,
      {
        canvas: offscreenCanvas,
        ...metrics,
        ...(initPayload && typeof initPayload === 'object' ? initPayload : {}),
      },
      [offscreenCanvas],
    );
    lastSizeSignature = buildWorkerCanvasMetricsSignature(metrics);
  } catch (error) {
    terminate('renderer_mount_failed');
    throw error;
  }

  return {
    canvas,
    worker,
    post,
    isDisposed() {
      return disposed;
    },
    retain() {
      if (terminateTimer) {
        clearTimeout(terminateTimer);
        terminateTimer = null;
      }
      return true;
    },
    resize({ width: nextWidth, height: nextHeight, pixelRatio: nextPixelRatio } = {}) {
      const nextMetrics = resolveWorkerCanvasMetrics({
        width: nextWidth,
        height: nextHeight,
        pixelRatio: nextPixelRatio,
      });
      if (syncPlaceholder) {
        syncWorkerCanvasPlaceholder(canvas, nextMetrics, { canSetBackingStore: false });
      }
      const nextSignature = buildWorkerCanvasMetricsSignature(nextMetrics);
      if (nextSignature === lastSizeSignature) {
        return nextMetrics;
      }
      lastSizeSignature = nextSignature;
      post(messageType.RESIZE, nextMetrics);
      return nextMetrics;
    },
    setActive(active, payload = {}) {
      const nextActive = active === true;
      if (nextActive === lastActive) {
        return false;
      }
      lastActive = nextActive;
      return post(messageType.ACTIVE, {
        ...payload,
        active: nextActive,
      });
    },
    dispose({ reason = 'renderer_unmount', deferMs = DEFAULT_WORKER_CANVAS_DISPOSE_GRACE_MS } = {}) {
      lastActive = false;
      post(messageType.ACTIVE, { active: false, reason });
      const safeDeferMs = Math.max(0, Math.round(Number(deferMs) || 0));
      if (safeDeferMs <= 0) {
        terminate(reason);
        return;
      }
      if (terminateTimer) {
        clearTimeout(terminateTimer);
      }
      terminateTimer = setTimeout(() => terminate(reason), safeDeferMs);
    },
  };
}
