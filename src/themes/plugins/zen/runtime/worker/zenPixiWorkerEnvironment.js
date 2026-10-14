import { settings as pixiSettings } from '@pixi/settings';

const isObject = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));

const clamp = (value, min, max) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.min(max, Math.max(min, numeric));
};

const assignMutableProperty = (target, key, value) => {
  if (!target || (typeof target !== 'object' && typeof target !== 'function')) return;
  try {
    target[key] = value;
    return;
  } catch (_) {
    // noop
  }
  try {
    Object.defineProperty(target, key, {
      value,
      configurable: true,
      writable: true,
    });
  } catch (_) {
    // noop
  }
};

const ensureFunctionSurface = (target, key) => {
  if (typeof target?.[key] === 'function') return;
  assignMutableProperty(target, key, () => {});
};

export const ensurePixiWorkerCanvasEventSurface = (canvas = null) => {
  if (!canvas || typeof canvas.getContext !== 'function') return canvas;
  const styleObject = isObject(canvas.style) ? canvas.style : {};
  assignMutableProperty(canvas, 'style', styleObject);
  ensureFunctionSurface(canvas, 'addEventListener');
  ensureFunctionSurface(canvas, 'removeEventListener');
  if (typeof canvas.getBoundingClientRect !== 'function') {
    assignMutableProperty(canvas, 'getBoundingClientRect', () => {
      const width = Math.max(1, Number(canvas.width) || 1);
      const height = Math.max(1, Number(canvas.height) || 1);
      return {
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: width,
        bottom: height,
        width,
        height,
      };
    });
  }
  return canvas;
};

const createDocumentElementSurface = (tagName = 'div') => {
  const normalizedTag = String(tagName || 'div').toLowerCase();
  if (normalizedTag === 'canvas') {
    if (typeof OffscreenCanvas === 'function') {
      return ensurePixiWorkerCanvasEventSurface(new OffscreenCanvas(1, 1));
    }
    return {
      width: 1,
      height: 1,
      style: {},
      getContext() {
        return null;
      },
      addEventListener() {},
      removeEventListener() {},
    };
  }
  return {
    style: {},
    addEventListener() {},
    removeEventListener() {},
  };
};

const createDocumentSurface = () => ({
  body: {
    appendChild() {},
    removeChild() {},
  },
  addEventListener() {},
  removeEventListener() {},
  createElement(tagName) {
    return createDocumentElementSurface(tagName);
  },
  createElementNS(_ns, tagName) {
    return createDocumentElementSurface(tagName);
  },
});

const ensureDocumentCanvasFactory = (doc) => {
  if (!doc || (typeof doc !== 'object' && typeof doc !== 'function')) return;
  if (doc.__zenCanvasFactoryWrapped === true) return;

  const originalCreateElement = typeof doc.createElement === 'function'
    ? doc.createElement.bind(doc)
    : null;
  const originalCreateElementNS = typeof doc.createElementNS === 'function'
    ? doc.createElementNS.bind(doc)
    : null;

  assignMutableProperty(doc, 'createElement', (tagName, ...args) => {
    const normalizedTag = String(tagName || '').toLowerCase();
    if (normalizedTag === 'canvas') {
      return createDocumentElementSurface('canvas');
    }
    const node = originalCreateElement
      ? originalCreateElement(tagName, ...args)
      : createDocumentElementSurface(tagName);
    if (node && typeof node === 'object') return node;
    return createDocumentElementSurface(tagName);
  });

  assignMutableProperty(doc, 'createElementNS', (namespace, tagName, ...args) => {
    const normalizedTag = String(tagName || '').toLowerCase();
    if (normalizedTag === 'canvas') {
      return createDocumentElementSurface('canvas');
    }
    const node = originalCreateElementNS
      ? originalCreateElementNS(namespace, tagName, ...args)
      : createDocumentElementSurface(tagName);
    if (node && typeof node === 'object') return node;
    return createDocumentElementSurface(tagName);
  });

  assignMutableProperty(doc, '__zenCanvasFactoryWrapped', true);
};

const idleTimerMap = new Map();
let idleTimerSeq = 1;

const createRequestIdleCallbackAdapter = () => (callback, options = null) => {
  const timeout = clamp(Number(options?.timeout) || 16, 1, 2000);
  const timerId = idleTimerSeq++;
  const handle = setTimeout(() => {
    idleTimerMap.delete(timerId);
    if (typeof callback === 'function') {
      callback({
        didTimeout: true,
        timeRemaining: () => 0,
      });
    }
  }, timeout);
  idleTimerMap.set(timerId, handle);
  return timerId;
};

const createCancelIdleCallbackAdapter = () => (id) => {
  const handle = idleTimerMap.get(id);
  if (handle) {
    clearTimeout(handle);
    idleTimerMap.delete(id);
  }
};

const ensurePixiWorkerAdapter = () => {
  if (!isObject(pixiSettings)) return;
  const existingAdapter = isObject(pixiSettings.ADAPTER) ? pixiSettings.ADAPTER : {};
  assignMutableProperty(pixiSettings, 'ADAPTER', {
    ...existingAdapter,
    createCanvas(width = 0, height = 0) {
      if (typeof OffscreenCanvas === 'function') {
        const safeWidth = Math.max(1, Math.floor(Number(width) || 1));
        const safeHeight = Math.max(1, Math.floor(Number(height) || 1));
        return ensurePixiWorkerCanvasEventSurface(new OffscreenCanvas(safeWidth, safeHeight));
      }
      if (typeof existingAdapter.createCanvas === 'function') {
        return ensurePixiWorkerCanvasEventSurface(existingAdapter.createCanvas(width, height));
      }
      return null;
    },
    getWebGLRenderingContext() {
      if (typeof globalThis.WebGL2RenderingContext === 'function') return globalThis.WebGL2RenderingContext;
      if (typeof globalThis.WebGLRenderingContext === 'function') return globalThis.WebGLRenderingContext;
      if (typeof existingAdapter.getWebGLRenderingContext === 'function') {
        return existingAdapter.getWebGLRenderingContext();
      }
      return null;
    },
    getCanvasRenderingContext2D() {
      if (typeof globalThis.CanvasRenderingContext2D === 'function') {
        return globalThis.CanvasRenderingContext2D;
      }
      if (typeof existingAdapter.getCanvasRenderingContext2D === 'function') {
        return existingAdapter.getCanvasRenderingContext2D();
      }
      return null;
    },
  });
};

export const requirePixiWorkerRuntimeEnvironment = () => {
  if (typeof globalThis.window === 'undefined') {
    throw new Error('ZEN_PIXI_WORKER_WINDOW_SURFACE_REQUIRED');
  }
  if (!isObject(globalThis.document) || typeof globalThis.document.createElement !== 'function') {
    throw new Error('ZEN_PIXI_WORKER_DOCUMENT_SURFACE_REQUIRED');
  }
  if (!isObject(pixiSettings?.ADAPTER) || typeof pixiSettings.ADAPTER.createCanvas !== 'function') {
    throw new Error('ZEN_PIXI_WORKER_ADAPTER_REQUIRED');
  }
};

export const ensurePixiWorkerRuntimeEnvironment = () => {
  if (typeof globalThis.window === 'undefined') {
    globalThis.window = globalThis;
  }
  if (typeof globalThis.document === 'undefined') {
    globalThis.document = createDocumentSurface();
  }
  ensureDocumentCanvasFactory(globalThis.document);
  ensureFunctionSurface(globalThis.document, 'addEventListener');
  ensureFunctionSurface(globalThis.document, 'removeEventListener');
  ensurePixiWorkerAdapter();

  if (typeof globalThis.window.requestIdleCallback !== 'function') {
    const requestIdle = createRequestIdleCallbackAdapter();
    globalThis.window.requestIdleCallback = requestIdle;
    if (typeof globalThis.requestIdleCallback !== 'function') {
      globalThis.requestIdleCallback = requestIdle;
    }
  }
  if (typeof globalThis.window.cancelIdleCallback !== 'function') {
    const cancelIdle = createCancelIdleCallbackAdapter();
    globalThis.window.cancelIdleCallback = cancelIdle;
    if (typeof globalThis.cancelIdleCallback !== 'function') {
      globalThis.cancelIdleCallback = cancelIdle;
    }
  }
  requirePixiWorkerRuntimeEnvironment();
};

export const resolvePixiWorkerRendererDiagnostics = ({
  runtimeState = null,
  strictWorkerOnly = true,
} = {}) => ({
  strictWorkerOnly: strictWorkerOnly === true,
  hasPixiAdapter: isObject(pixiSettings?.ADAPTER),
  hasWebGLRenderingContextCtor: typeof globalThis.WebGLRenderingContext === 'function',
  hasWebGL2RenderingContextCtor: typeof globalThis.WebGL2RenderingContext === 'function',
  sceneReason: typeof runtimeState?.scene?.reason === 'string' ? runtimeState.scene.reason : null,
});

export const resolveCanvasWebGLTextureCaps = (canvas = null) => {
  if (!canvas || typeof canvas.getContext !== 'function') {
    return {
      canvasWebGLContext: false,
      canvasWebGL2Context: false,
      canvasMaxTextureImageUnits: null,
    };
  }

  let context = null;
  let hasWebGL2 = false;
  try {
    context = canvas.getContext('webgl2', { stencil: true });
    hasWebGL2 = Boolean(context);
  } catch (_) {
    context = null;
  }
  if (!context) {
    try {
      context = canvas.getContext('webgl', { stencil: true });
    } catch (_) {
      context = null;
    }
  }

  const maxTextureImageUnits = Number(
    context?.getParameter?.(context?.MAX_TEXTURE_IMAGE_UNITS),
  );
  const normalizedMaxTextureImageUnits = Number.isFinite(maxTextureImageUnits)
    && maxTextureImageUnits > 0
    ? Math.floor(maxTextureImageUnits)
    : null;
  return {
    canvasWebGLContext: Boolean(context),
    canvasWebGL2Context: hasWebGL2,
    canvasMaxTextureImageUnits: normalizedMaxTextureImageUnits,
  };
};
