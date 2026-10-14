const CHROME_EXTENSION_PROTOCOL = 'chrome-extension:';

const WORKER_SOURCE_ERROR_CODES = Object.freeze({
  BLOB_BOOTSTRAP_UNAVAILABLE: 'worker_blob_bootstrap_unavailable',
  MODULE_LOAD_FAILED: 'worker_module_load_failed',
  SCRIPT_CSP_BLOCKED: 'worker_script_csp_blocked',
  SCRIPT_ORIGIN_BLOCKED: 'worker_script_origin_blocked',
  SCRIPT_URL_INVALID: 'worker_script_url_invalid',
});

function createWorkerScriptSourceError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
}

function resolveWorkerUrl(workerUrl) {
  const raw = typeof workerUrl === 'string'
    ? workerUrl.trim()
    : (typeof workerUrl?.href === 'string' ? workerUrl.href.trim() : '');
  if (!raw) {
    throw createWorkerScriptSourceError(
      WORKER_SOURCE_ERROR_CODES.SCRIPT_URL_INVALID,
      'Nudge worker script URL is required.',
    );
  }

  try {
    return new URL(raw);
  } catch (error) {
    throw createWorkerScriptSourceError(
      WORKER_SOURCE_ERROR_CODES.SCRIPT_URL_INVALID,
      `Nudge worker script URL is invalid: ${raw}`,
      { workerUrl: raw, reason: String(error?.message || error) },
    );
  }
}

function shouldUseBlobModuleBootstrap(workerUrl, locationRef = globalThis.location) {
  if (workerUrl.protocol !== CHROME_EXTENSION_PROTOCOL) return false;
  const currentOrigin = typeof locationRef?.origin === 'string'
    ? locationRef.origin
    : '';
  if (!currentOrigin) return false;
  const workerOrigin = `${workerUrl.protocol}//${workerUrl.host}`;
  return currentOrigin !== workerOrigin;
}

function getUrlApi(globalRef = globalThis) {
  return globalRef?.URL || URL;
}

function getBlobCtor(globalRef = globalThis) {
  return globalRef?.Blob || Blob;
}

function createNoopRevoke() {}

export function createNudgeWorkerScriptSource(workerUrl, {
  globalRef = globalThis,
} = {}) {
  const resolvedUrl = resolveWorkerUrl(workerUrl);
  if (!shouldUseBlobModuleBootstrap(resolvedUrl, globalRef?.location)) {
    return {
      mode: 'direct',
      sourceUrl: resolvedUrl.href,
      url: resolvedUrl.href,
      revoke: createNoopRevoke,
    };
  }

  const UrlApi = getUrlApi(globalRef);
  const BlobCtor = getBlobCtor(globalRef);
  if (
    typeof BlobCtor !== 'function'
    || typeof UrlApi?.createObjectURL !== 'function'
    || typeof UrlApi?.revokeObjectURL !== 'function'
  ) {
    throw createWorkerScriptSourceError(
      WORKER_SOURCE_ERROR_CODES.BLOB_BOOTSTRAP_UNAVAILABLE,
      'Nudge worker requires a same-origin module bootstrap URL, but Blob URL support is unavailable.',
      { sourceUrl: resolvedUrl.href },
    );
  }

  const moduleSource = `import ${JSON.stringify(resolvedUrl.href)};\n`;
  const blob = new BlobCtor([moduleSource], { type: 'text/javascript' });
  const objectUrl = UrlApi.createObjectURL(blob);
  return {
    mode: 'module_blob_import',
    sourceUrl: resolvedUrl.href,
    url: objectUrl,
    revoke: () => UrlApi.revokeObjectURL(objectUrl),
  };
}

function getErrorMessage(error) {
  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message.trim();
  }
  if (typeof error?.type === 'string' && error.type.trim()) {
    return error.type.trim();
  }
  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }
  return String(error || 'worker_activation_failed');
}

function classifyWorkerScriptError(error, source = null) {
  if (typeof error?.code === 'string' && error.code.trim()) {
    return error.code.trim();
  }

  const message = getErrorMessage(error).toLowerCase();
  if (
    source?.mode === 'module_blob_import'
    && error
    && typeof error === 'object'
    && typeof error?.message !== 'string'
  ) {
    return WORKER_SOURCE_ERROR_CODES.SCRIPT_CSP_BLOCKED;
  }
  if (message.includes('cannot be accessed from origin')) {
    return WORKER_SOURCE_ERROR_CODES.SCRIPT_ORIGIN_BLOCKED;
  }
  if (message.includes('content security policy') || message.includes('violates')) {
    return WORKER_SOURCE_ERROR_CODES.SCRIPT_CSP_BLOCKED;
  }
  if (
    message.includes('failed to fetch dynamically imported module')
    || message.includes('failed to load module script')
    || message.includes('err_file_not_found')
  ) {
    return WORKER_SOURCE_ERROR_CODES.MODULE_LOAD_FAILED;
  }
  return 'worker_activation_failed';
}

export function createNudgeWorkerActivationError(error, source = null) {
  const code = classifyWorkerScriptError(error, source);
  const message = getErrorMessage(error);
  const nextError = new Error(`${code}:${message}`);
  nextError.code = code;
  nextError.cause = error instanceof Error ? error : null;
  nextError.details = source && typeof source === 'object'
    ? {
      bootstrapMode: typeof source.mode === 'string' ? source.mode : null,
      sourceUrl: typeof source.sourceUrl === 'string' ? source.sourceUrl : null,
      workerUrl: typeof source.url === 'string' ? source.url : null,
    }
    : null;
  return nextError;
}

export { WORKER_SOURCE_ERROR_CODES };
