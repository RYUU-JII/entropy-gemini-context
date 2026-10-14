export const DEFAULT_BROWSER_QA_CDP_OPEN_TIMEOUT_MS = 10_000;
export const DEFAULT_BROWSER_QA_CDP_REQUEST_TIMEOUT_MS = 30_000;

function createCdpError(code, message, metadata = {}, cause = null) {
  const error = new Error(message, cause ? { cause } : undefined);
  error.code = code;
  Object.assign(error, metadata);
  return error;
}

function normalizeTimeout(value, code) {
  if (!Number.isFinite(value) || value <= 0) {
    throw createCdpError(code, `${code}:${String(value)}`, { timeoutMs: value });
  }
  return Math.floor(value);
}

function requireSocketApi(socket) {
  if (
    !socket
    || typeof socket.addEventListener !== 'function'
    || typeof socket.removeEventListener !== 'function'
    || typeof socket.send !== 'function'
    || typeof socket.close !== 'function'
  ) {
    throw createCdpError(
      'BROWSER_QA_CDP_WEBSOCKET_INVALID',
      'BROWSER_QA_CDP_WEBSOCKET_INVALID',
    );
  }
  return socket;
}

function projectRequestMetadata(request) {
  return {
    cdpMethod: request.method,
    cdpSessionId: request.sessionId,
    cdpRequestId: request.requestId,
  };
}

export class CdpConnection {
  constructor(webSocketUrl, {
    WebSocketImpl = globalThis.WebSocket,
    openTimeoutMs = DEFAULT_BROWSER_QA_CDP_OPEN_TIMEOUT_MS,
    requestTimeoutMs = DEFAULT_BROWSER_QA_CDP_REQUEST_TIMEOUT_MS,
    setOpenTimeout = setTimeout,
    clearOpenTimeout = clearTimeout,
    setRequestTimeout = setTimeout,
    clearRequestTimeout = clearTimeout,
  } = {}) {
    if (typeof webSocketUrl !== 'string' || !webSocketUrl.trim()) {
      throw createCdpError(
        'BROWSER_QA_CDP_WEBSOCKET_URL_REQUIRED',
        'BROWSER_QA_CDP_WEBSOCKET_URL_REQUIRED',
      );
    }
    if (typeof WebSocketImpl !== 'function') {
      throw createCdpError(
        'BROWSER_QA_CDP_WEBSOCKET_IMPLEMENTATION_UNAVAILABLE',
        'BROWSER_QA_CDP_WEBSOCKET_IMPLEMENTATION_UNAVAILABLE',
      );
    }
    for (const [name, implementation] of Object.entries({
      setOpenTimeout,
      clearOpenTimeout,
      setRequestTimeout,
      clearRequestTimeout,
    })) {
      if (typeof implementation !== 'function') {
        throw createCdpError(
          'BROWSER_QA_CDP_TIMER_IMPLEMENTATION_INVALID',
          `BROWSER_QA_CDP_TIMER_IMPLEMENTATION_INVALID:${name}`,
        );
      }
    }
    this.webSocketUrl = webSocketUrl;
    this.WebSocketImpl = WebSocketImpl;
    this.openTimeoutMs = normalizeTimeout(
      openTimeoutMs,
      'BROWSER_QA_CDP_OPEN_TIMEOUT_INVALID',
    );
    this.requestTimeoutMs = normalizeTimeout(
      requestTimeoutMs,
      'BROWSER_QA_CDP_REQUEST_TIMEOUT_INVALID',
    );
    this.setOpenTimeout = setOpenTimeout;
    this.clearOpenTimeout = clearOpenTimeout;
    this.setRequestTimeout = setRequestTimeout;
    this.clearRequestTimeout = clearRequestTimeout;
    this.nextId = 1;
    this.pending = new Map();
    this.eventListeners = new Map();
    this.socket = null;
    this.state = 'idle';
    this.openSettlement = null;
    this.boundSocketHandlers = null;
  }

  async open() {
    if (this.state !== 'idle') {
      throw createCdpError(
        'BROWSER_QA_CDP_OPEN_STATE_INVALID',
        `BROWSER_QA_CDP_OPEN_STATE_INVALID:${this.state}`,
      );
    }
    this.state = 'opening';
    try {
      this.socket = requireSocketApi(new this.WebSocketImpl(this.webSocketUrl));
    } catch (cause) {
      this.state = 'closed';
      if (cause?.code === 'BROWSER_QA_CDP_WEBSOCKET_INVALID') throw cause;
      throw createCdpError(
        'BROWSER_QA_CDP_WEBSOCKET_OPEN_FAILED',
        'BROWSER_QA_CDP_WEBSOCKET_OPEN_FAILED',
        {},
        cause,
      );
    }

    const socket = this.socket;
    await new Promise((resolve, reject) => {
      let settled = false;
      let timeoutHandle = null;
      const finish = (worker) => {
        if (settled) return;
        settled = true;
        if (timeoutHandle !== null) this.clearOpenTimeout(timeoutHandle);
        socket.removeEventListener('open', handleOpen);
        socket.removeEventListener('error', handleOpeningError);
        socket.removeEventListener('close', handleOpeningClose);
        this.openSettlement = null;
        worker();
      };
      const fail = (error, { closeSocket = true } = {}) => finish(() => {
        this.state = 'closed';
        if (closeSocket) {
          try {
            socket.close();
          } catch {
            // The typed open failure remains authoritative.
          }
        }
        reject(error);
      });
      const handleOpen = () => finish(() => {
        this.state = 'open';
        resolve();
      });
      const handleOpeningError = (event) => fail(createCdpError(
        'BROWSER_QA_CDP_WEBSOCKET_OPEN_FAILED',
        'BROWSER_QA_CDP_WEBSOCKET_OPEN_FAILED',
        {},
        event,
      ));
      const handleOpeningClose = (event) => fail(createCdpError(
        'BROWSER_QA_CDP_WEBSOCKET_OPEN_CLOSED',
        'BROWSER_QA_CDP_WEBSOCKET_OPEN_CLOSED',
        {
          closeCode: Number.isInteger(event?.code) ? event.code : null,
        },
      ), { closeSocket: false });
      this.openSettlement = (error) => fail(error);
      socket.addEventListener('open', handleOpen, { once: true });
      socket.addEventListener('error', handleOpeningError, { once: true });
      socket.addEventListener('close', handleOpeningClose, { once: true });
      timeoutHandle = this.setOpenTimeout(() => fail(createCdpError(
        'BROWSER_QA_CDP_WEBSOCKET_OPEN_TIMEOUT',
        `BROWSER_QA_CDP_WEBSOCKET_OPEN_TIMEOUT:timeoutMs=${this.openTimeoutMs}`,
        { timeoutMs: this.openTimeoutMs },
      )), this.openTimeoutMs);
    });

    this.boundSocketHandlers = Object.freeze({
      message: (event) => this.handleMessage(event?.data),
      close: (event) => this.handleSocketClose(event),
      error: (event) => this.handleSocketError(event),
    });
    socket.addEventListener('message', this.boundSocketHandlers.message);
    socket.addEventListener('close', this.boundSocketHandlers.close);
    socket.addEventListener('error', this.boundSocketHandlers.error);
    if (socket.readyState !== this.WebSocketImpl.OPEN) {
      this.handleSocketClose({ code: null });
      throw createCdpError(
        'BROWSER_QA_CDP_WEBSOCKET_OPEN_CLOSED',
        'BROWSER_QA_CDP_WEBSOCKET_OPEN_CLOSED',
        { closeCode: null },
      );
    }
  }

  clearPending(requestId) {
    const pending = this.pending.get(requestId);
    if (!pending) return null;
    this.pending.delete(requestId);
    this.clearRequestTimeout(pending.timeoutHandle);
    return pending;
  }

  rejectAllPending(createError) {
    for (const requestId of [...this.pending.keys()]) {
      const pending = this.clearPending(requestId);
      if (pending) pending.reject(createError(pending));
    }
  }

  detachSocketListeners() {
    if (!this.socket || !this.boundSocketHandlers) return;
    this.socket.removeEventListener('message', this.boundSocketHandlers.message);
    this.socket.removeEventListener('close', this.boundSocketHandlers.close);
    this.socket.removeEventListener('error', this.boundSocketHandlers.error);
    this.boundSocketHandlers = null;
  }

  handleSocketClose(event = {}) {
    if (this.state === 'closed') return;
    this.state = 'closed';
    const closeCode = Number.isInteger(event?.code) ? event.code : null;
    this.rejectAllPending((request) => createCdpError(
      'BROWSER_QA_CDP_WEBSOCKET_CLOSED',
      'BROWSER_QA_CDP_WEBSOCKET_CLOSED',
      { ...projectRequestMetadata(request), closeCode },
    ));
    this.detachSocketListeners();
    this.eventListeners.clear();
  }

  handleSocketError(event) {
    if (this.state !== 'open') return;
    this.state = 'closed';
    this.rejectAllPending((request) => createCdpError(
      'BROWSER_QA_CDP_WEBSOCKET_ERROR',
      'BROWSER_QA_CDP_WEBSOCKET_ERROR',
      projectRequestMetadata(request),
      event,
    ));
    this.detachSocketListeners();
    this.eventListeners.clear();
    try {
      this.socket?.close();
    } catch {
      // The typed transport failure remains authoritative.
    }
  }

  handleMalformedMessage(cause) {
    if (this.state !== 'open') return;
    this.state = 'closed';
    this.rejectAllPending((request) => createCdpError(
      'BROWSER_QA_CDP_MESSAGE_INVALID',
      'BROWSER_QA_CDP_MESSAGE_INVALID',
      projectRequestMetadata(request),
      cause,
    ));
    this.detachSocketListeners();
    this.eventListeners.clear();
    try {
      this.socket?.close();
    } catch {
      // The typed protocol-corruption failure remains authoritative.
    }
  }

  handleMessage(rawData) {
    let message;
    try {
      message = JSON.parse(String(rawData));
    } catch (cause) {
      this.handleMalformedMessage(cause);
      return;
    }
    if (Number.isInteger(message?.id)) {
      const pending = this.clearPending(message.id);
      if (!pending) return;
      if (message.error) {
        pending.reject(createCdpError(
          'BROWSER_QA_CDP_PROTOCOL_ERROR',
          'BROWSER_QA_CDP_PROTOCOL_ERROR',
          {
            ...projectRequestMetadata(pending),
            protocolMessage: message.error.message || 'CDP_ERROR',
            protocolData: message.error.data || null,
          },
        ));
        return;
      }
      pending.resolve(message.result || {});
      return;
    }
    if (typeof message?.method !== 'string' || !message.method) return;
    const event = Object.freeze({
      method: message.method,
      params: message.params || {},
      sessionId: message.sessionId || null,
    });
    const listeners = [
      ...(this.eventListeners.get(message.method) || []),
      ...(this.eventListeners.get('*') || []),
    ];
    for (const listener of listeners) {
      try {
        listener(event);
      } catch {
        // One diagnostic consumer cannot corrupt CDP transport ownership.
      }
    }
  }

  send(method, params = {}, sessionId = null, {
    timeoutMs = this.requestTimeoutMs,
  } = {}) {
    if (!this.socket || this.state !== 'open'
      || this.socket.readyState !== this.WebSocketImpl.OPEN) {
      return Promise.reject(createCdpError(
        'BROWSER_QA_CDP_WEBSOCKET_NOT_OPEN',
        'BROWSER_QA_CDP_WEBSOCKET_NOT_OPEN',
        { cdpMethod: method, cdpSessionId: sessionId, cdpRequestId: null },
      ));
    }
    let boundedTimeoutMs;
    try {
      boundedTimeoutMs = normalizeTimeout(
        timeoutMs,
        'BROWSER_QA_CDP_REQUEST_TIMEOUT_INVALID',
      );
    } catch (error) {
      return Promise.reject(error);
    }
    const requestId = this.nextId;
    this.nextId += 1;
    const payload = {
      id: requestId,
      method,
      params,
      ...(sessionId ? { sessionId } : {}),
    };
    return new Promise((resolve, reject) => {
      const pending = {
        requestId,
        method,
        sessionId,
        resolve,
        reject,
        timeoutHandle: null,
      };
      this.pending.set(requestId, pending);
      pending.timeoutHandle = this.setRequestTimeout(() => {
        const timedOut = this.clearPending(requestId);
        if (!timedOut) return;
        timedOut.reject(createCdpError(
          'BROWSER_QA_CDP_REQUEST_TIMEOUT',
          'BROWSER_QA_CDP_REQUEST_TIMEOUT',
          {
            ...projectRequestMetadata(timedOut),
            timeoutMs: boundedTimeoutMs,
          },
        ));
      }, boundedTimeoutMs);
      try {
        this.socket.send(JSON.stringify(payload));
      } catch (cause) {
        const failed = this.clearPending(requestId);
        failed?.reject(createCdpError(
          'BROWSER_QA_CDP_SEND_FAILED',
          'BROWSER_QA_CDP_SEND_FAILED',
          projectRequestMetadata(pending),
          cause,
        ));
      }
    });
  }

  subscribe(method, listener) {
    if ((typeof method !== 'string' || !method) && method !== '*') {
      throw createCdpError(
        'BROWSER_QA_CDP_EVENT_METHOD_REQUIRED',
        'BROWSER_QA_CDP_EVENT_METHOD_REQUIRED',
      );
    }
    if (typeof listener !== 'function') {
      throw createCdpError(
        'BROWSER_QA_CDP_EVENT_LISTENER_REQUIRED',
        `BROWSER_QA_CDP_EVENT_LISTENER_REQUIRED:${method}`,
      );
    }
    const listeners = this.eventListeners.get(method) || new Set();
    listeners.add(listener);
    this.eventListeners.set(method, listeners);
    return () => {
      const current = this.eventListeners.get(method);
      current?.delete(listener);
      if (current?.size === 0) this.eventListeners.delete(method);
    };
  }

  on(method, handler) {
    if (typeof handler !== 'function') {
      throw createCdpError(
        'BROWSER_QA_CDP_EVENT_LISTENER_REQUIRED',
        `BROWSER_QA_CDP_EVENT_LISTENER_REQUIRED:${method}`,
      );
    }
    return this.subscribe(method, (event) => {
      handler(event.params, event.sessionId);
    });
  }

  close() {
    const socket = this.socket;
    if (this.openSettlement) {
      this.openSettlement(createCdpError(
        'BROWSER_QA_CDP_WEBSOCKET_OPEN_ABORTED',
        'BROWSER_QA_CDP_WEBSOCKET_OPEN_ABORTED',
      ));
    }
    if (this.state !== 'closed') {
      this.state = 'closed';
      this.rejectAllPending((request) => createCdpError(
        'BROWSER_QA_CDP_WEBSOCKET_CLOSED',
        'BROWSER_QA_CDP_WEBSOCKET_CLOSED',
        {
          ...projectRequestMetadata(request),
          closeCode: null,
          localClose: true,
        },
      ));
    }
    this.detachSocketListeners();
    this.eventListeners.clear();
    if (
      socket
      && socket.readyState !== this.WebSocketImpl.CLOSED
      && socket.readyState !== this.WebSocketImpl.CLOSING
    ) {
      try {
        socket.close();
      } catch {
        // Pending work was already deterministically rejected above.
      }
    }
  }
}
