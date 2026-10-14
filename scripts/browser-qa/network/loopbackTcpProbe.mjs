import net from 'node:net';

import {
  normalizeBrowserQaCdpEndpoint,
} from '../resources/browserResourceScope.mjs';

export const DEFAULT_BROWSER_QA_TCP_PROBE_TIMEOUT_MS = 250;

function normalizeProbeTimeout(timeoutMs) {
  const bounded = Number(timeoutMs);
  if (!Number.isSafeInteger(bounded) || bounded < 25 || bounded > 2_000) {
    throw new Error(`BROWSER_QA_TCP_PROBE_TIMEOUT_INVALID:${timeoutMs}`);
  }
  return bounded;
}

/**
 * Performs a connection-only loopback reachability check. It sends no bytes,
 * destroys the socket on every terminal path, and never treats an open port as
 * browser identity. Callers must still perform the declared CDP/process proof.
 */
export function probeBrowserQaLoopbackTcpEndpoint(cdpEndpoint, {
  timeoutMs = DEFAULT_BROWSER_QA_TCP_PROBE_TIMEOUT_MS,
  createConnection = net.createConnection,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {}) {
  if (typeof createConnection !== 'function') {
    throw new Error('BROWSER_QA_TCP_PROBE_CONNECTION_ADAPTER_REQUIRED');
  }
  if (typeof setTimer !== 'function' || typeof clearTimer !== 'function') {
    throw new Error('BROWSER_QA_TCP_PROBE_TIMER_ADAPTER_REQUIRED');
  }
  const endpoint = new URL(normalizeBrowserQaCdpEndpoint(cdpEndpoint));
  const host = '127.0.0.1';
  const port = Number(endpoint.port);
  const boundedTimeoutMs = normalizeProbeTimeout(timeoutMs);

  return new Promise((resolve) => {
    let socket = null;
    let timer = null;
    let settled = false;
    const finish = (status, error = null) => {
      if (settled) return;
      settled = true;
      if (timer !== null) clearTimer(timer);
      socket?.removeListener?.('connect', onConnect);
      socket?.removeListener?.('error', onError);
      socket?.destroy?.();
      resolve(Object.freeze({
        status,
        host,
        port,
        ...(error ? {
          errorCode: typeof error?.code === 'string' ? error.code : 'connection_failed',
        } : {}),
      }));
    };
    const onConnect = () => finish('reachable');
    const onError = (error) => finish('unavailable', error);
    try {
      socket = createConnection({ host, port });
      if (
        !socket
        || typeof socket.once !== 'function'
        || typeof socket.destroy !== 'function'
      ) {
        throw new Error('BROWSER_QA_TCP_PROBE_SOCKET_INVALID');
      }
      socket.unref?.();
      socket.once('connect', onConnect);
      socket.once('error', onError);
      timer = setTimer(
        () => finish('unavailable', { code: 'ETIMEDOUT' }),
        boundedTimeoutMs,
      );
    } catch (error) {
      finish('unavailable', error);
    }
  });
}
