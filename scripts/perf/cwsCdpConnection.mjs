import {
  CdpConnection as BrowserQaCdpConnection,
  DEFAULT_BROWSER_QA_CDP_OPEN_TIMEOUT_MS,
} from '../browser-qa/cdp/CdpConnection.mjs';

export const DEFAULT_CWS_CDP_OPEN_TIMEOUT_MS = DEFAULT_BROWSER_QA_CDP_OPEN_TIMEOUT_MS;
export const DEFAULT_CWS_CDP_REQUEST_TIMEOUT_MS = 30_000;

function normalizeTimeoutMs(value, code) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${code}:${value}`);
  }
  return Math.floor(value);
}

function formatRequestDiagnostic({ method, sessionId, requestId }) {
  return [
    `method=${method}`,
    `session=${sessionId || 'browser'}`,
    `requestId=${requestId}`,
  ].join(':');
}

function createRequestError(code, request, detail = null, cause = null) {
  const suffix = detail ? `:${detail}` : '';
  const error = new Error(
    `${code}:${formatRequestDiagnostic(request)}${suffix}`,
    cause ? { cause } : undefined,
  );
  error.code = code;
  error.cdpMethod = request.method;
  error.cdpSessionId = request.sessionId;
  error.cdpRequestId = request.requestId;
  return error;
}

function projectRequest(error) {
  return {
    method: error?.cdpMethod,
    sessionId: error?.cdpSessionId || null,
    requestId: error?.cdpRequestId,
  };
}

function mapCwsRequestError(error) {
  const request = projectRequest(error);
  switch (error?.code) {
    case 'BROWSER_QA_CDP_REQUEST_TIMEOUT':
      return createRequestError(
        'CWS_CDP_REQUEST_TIMEOUT',
        request,
        `timeoutMs=${error.timeoutMs}`,
      );
    case 'BROWSER_QA_CDP_PROTOCOL_ERROR': {
      const detail = [
        `message=${error.protocolMessage || 'CDP_ERROR'}`,
        error.protocolData ? `data=${error.protocolData}` : null,
      ].filter(Boolean).join(':');
      return createRequestError('CWS_CDP_PROTOCOL_ERROR', request, detail);
    }
    case 'BROWSER_QA_CDP_WEBSOCKET_CLOSED':
      return createRequestError(
        'CWS_CDP_WEBSOCKET_CLOSED',
        request,
        `closeCode=${Number.isInteger(error.closeCode)
          ? error.closeCode
          : (error.localClose ? 'local' : 'unknown')}`,
      );
    case 'BROWSER_QA_CDP_WEBSOCKET_ERROR':
      return createRequestError(
        'CWS_CDP_WEBSOCKET_CLOSED',
        request,
        'closeCode=transport_error',
        error.cause,
      );
    case 'BROWSER_QA_CDP_SEND_FAILED':
      return createRequestError('CWS_CDP_SEND_FAILED', request, null, error.cause);
    case 'BROWSER_QA_CDP_MESSAGE_INVALID':
      return createRequestError('CWS_CDP_MESSAGE_INVALID', request, null, error.cause);
    case 'BROWSER_QA_CDP_WEBSOCKET_NOT_OPEN': {
      const mapped = new Error(
        `CWS_CDP_WEBSOCKET_NOT_OPEN:method=${request.method}:session=${request.sessionId || 'browser'}`,
      );
      mapped.code = 'CWS_CDP_WEBSOCKET_NOT_OPEN';
      return mapped;
    }
    case 'BROWSER_QA_CDP_REQUEST_TIMEOUT_INVALID':
      return new Error(`CWS_CDP_REQUEST_TIMEOUT_INVALID:${error.timeoutMs}`);
    default:
      return error;
  }
}

function mapCwsOpenError(error) {
  if (error?.code === 'BROWSER_QA_CDP_WEBSOCKET_OPEN_TIMEOUT') {
    const mapped = new Error(
      `CWS_CDP_WEBSOCKET_OPEN_TIMEOUT:timeoutMs=${error.timeoutMs}`,
      { cause: error },
    );
    mapped.code = 'CWS_CDP_WEBSOCKET_OPEN_TIMEOUT';
    return mapped;
  }
  if (error?.code === 'BROWSER_QA_CDP_WEBSOCKET_OPEN_CLOSED') {
    const mapped = new Error(
      `CWS_CDP_WEBSOCKET_OPEN_FAILED:closeCode=${Number.isInteger(error.closeCode) ? error.closeCode : 'unknown'}`,
      { cause: error },
    );
    mapped.code = 'CWS_CDP_WEBSOCKET_OPEN_FAILED';
    return mapped;
  }
  if (
    error?.code === 'BROWSER_QA_CDP_WEBSOCKET_OPEN_FAILED'
    || error?.code === 'BROWSER_QA_CDP_WEBSOCKET_OPEN_ABORTED'
  ) {
    const mapped = new Error('CWS_CDP_WEBSOCKET_OPEN_FAILED', { cause: error });
    mapped.code = 'CWS_CDP_WEBSOCKET_OPEN_FAILED';
    return mapped;
  }
  return error;
}

// Compatibility adapter for the CWS diagnostic surface. Transport ownership,
// timeouts, pending requests, events, and close cleanup live in browser-qa.
export class CdpConnection extends BrowserQaCdpConnection {
  constructor(webSocketUrl, {
    WebSocketImpl = globalThis.WebSocket,
    openTimeoutMs = DEFAULT_CWS_CDP_OPEN_TIMEOUT_MS,
    requestTimeoutMs = DEFAULT_CWS_CDP_REQUEST_TIMEOUT_MS,
    setOpenTimeout = setTimeout,
    clearOpenTimeout = clearTimeout,
    setRequestTimeout = setTimeout,
    clearRequestTimeout = clearTimeout,
  } = {}) {
    if (typeof WebSocketImpl !== 'function') {
      throw new Error('CWS_CDP_WEBSOCKET_IMPLEMENTATION_UNAVAILABLE');
    }
    const normalizedOpenTimeoutMs = normalizeTimeoutMs(
      openTimeoutMs,
      'CWS_CDP_OPEN_TIMEOUT_INVALID',
    );
    const normalizedRequestTimeoutMs = normalizeTimeoutMs(
      requestTimeoutMs,
      'CWS_CDP_REQUEST_TIMEOUT_INVALID',
    );
    super(webSocketUrl, {
      WebSocketImpl,
      openTimeoutMs: normalizedOpenTimeoutMs,
      requestTimeoutMs: normalizedRequestTimeoutMs,
      setOpenTimeout,
      clearOpenTimeout,
      setRequestTimeout,
      clearRequestTimeout,
    });
  }

  open() {
    return super.open().catch((error) => Promise.reject(mapCwsOpenError(error)));
  }

  send(method, params = {}, sessionId = null, options = {}) {
    return super.send(method, params, sessionId, options)
      .catch((error) => Promise.reject(mapCwsRequestError(error)));
  }
}
