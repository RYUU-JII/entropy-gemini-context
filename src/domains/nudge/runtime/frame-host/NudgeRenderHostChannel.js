import {
  NUDGE_EXTENSION_FRAME_WORKER_PROBE,
  createFrameWorkerProbeEvent,
} from '../NudgeExtensionFrameWorkerProbeProtocol.js';
import { consumeNudgeFrameHostCapability } from './nudgeFrameHostCapabilityClient.js';

function closePort(port) {
  try {
    port?.close?.();
  } catch (_error) {}
}

function postCandidateError(port, { sessionId, nonce, error }) {
  try {
    port?.postMessage?.(createFrameWorkerProbeEvent({
      phase: NUDGE_EXTENSION_FRAME_WORKER_PROBE.ERROR,
      sessionId,
      nonce,
      error,
    }));
  } catch (_error) {}
  closePort(port);
}

function requireBootstrapValue(value, code) {
  if (typeof value !== 'string' || !value.trim() || value.trim() !== value) {
    throw new Error(code);
  }
  return value;
}

export function installAuthenticatedNudgeRenderHostChannel({
  sessionId,
  consumeCapability = consumeNudgeFrameHostCapability,
  onAuthenticatedStart,
  onCommand,
  windowRef = globalThis,
  parentRef = globalThis.parent,
} = {}) {
  const resolvedSessionId = requireBootstrapValue(
    sessionId,
    'NUDGE_RENDER_HOST_CHANNEL_SESSION_REQUIRED',
  );
  if (typeof consumeCapability !== 'function') {
    throw new Error('NUDGE_RENDER_HOST_CHANNEL_CAPABILITY_CONSUMER_REQUIRED');
  }
  if (typeof onAuthenticatedStart !== 'function') {
    throw new Error('NUDGE_RENDER_HOST_CHANNEL_START_HANDLER_REQUIRED');
  }
  if (typeof onCommand !== 'function') {
    throw new Error('NUDGE_RENDER_HOST_CHANNEL_COMMAND_HANDLER_REQUIRED');
  }
  if (typeof windowRef?.addEventListener !== 'function') {
    throw new Error('NUDGE_RENDER_HOST_CHANNEL_WINDOW_REQUIRED');
  }

  let channelPort = null;
  let channelNonce = null;
  let closed = false;

  function postEvent(phase, { payload = null, error = null } = {}) {
    if (!channelPort || !channelNonce || closed) {
      throw new Error('NUDGE_RENDER_HOST_CHANNEL_NOT_AUTHENTICATED');
    }
    channelPort.postMessage(createFrameWorkerProbeEvent({
      phase,
      sessionId: resolvedSessionId,
      nonce: channelNonce,
      payload,
      error,
    }));
  }

  function handleChannelMessage(event) {
    const message = event?.data || {};
    if (message.type !== NUDGE_EXTENSION_FRAME_WORKER_PROBE.COMMAND_TYPE) return;
    if (message.sessionId !== resolvedSessionId || message.nonce !== channelNonce) return;
    if (message.command === NUDGE_EXTENSION_FRAME_WORKER_PROBE.START) return;
    onCommand(message.command, message.payload ?? null);
  }

  function bindCandidatePort(port, nonce) {
    windowRef.removeEventListener?.('message', handleWindowMessage);
    channelPort = port;
    channelNonce = nonce;
    channelPort.addEventListener?.('message', handleChannelMessage);
    if (!channelPort.addEventListener) channelPort.onmessage = handleChannelMessage;
    channelPort.start?.();
    postEvent(NUDGE_EXTENSION_FRAME_WORKER_PROBE.CHANNEL_READY, {
      payload: { protocol: 'message_port_v1' },
    });
  }

  async function authenticateBootstrap(message, candidatePort) {
    const nonce = requireBootstrapValue(
      message.nonce,
      'NUDGE_RENDER_HOST_CHANNEL_NONCE_REQUIRED',
    );
    const capability = requireBootstrapValue(
      message.capability,
      'NUDGE_RENDER_HOST_CHANNEL_CAPABILITY_REQUIRED',
    );
    try {
      const authorization = await consumeCapability({
        sessionId: resolvedSessionId,
        nonce,
        capability,
      });
      if (authorization?.authorized !== true) {
        throw new Error('NUDGE_RENDER_HOST_CHANNEL_AUTHORIZATION_INVALID');
      }
    } catch (error) {
      postCandidateError(candidatePort, {
        sessionId: resolvedSessionId,
        nonce,
        error: String(error?.code || error?.message || error || 'NUDGE_RENDER_HOST_CHANNEL_AUTH_FAILED'),
      });
      return;
    }
    if (closed || channelPort) {
      postCandidateError(candidatePort, {
        sessionId: resolvedSessionId,
        nonce,
        error: 'NUDGE_RENDER_HOST_CHANNEL_ALREADY_BOUND',
      });
      return;
    }

    bindCandidatePort(candidatePort, nonce);
    try {
      onAuthenticatedStart(message.payload ?? null);
    } catch (error) {
      postEvent(NUDGE_EXTENSION_FRAME_WORKER_PROBE.ERROR, {
        error: String(error?.message || error || 'NUDGE_RENDER_HOST_CHANNEL_START_FAILED'),
      });
    }
  }

  function handleWindowMessage(event) {
    if (closed || channelPort) return;
    if (event?.source !== parentRef) return;
    const message = event?.data || {};
    if (message.type !== NUDGE_EXTENSION_FRAME_WORKER_PROBE.COMMAND_TYPE) return;
    if (message.command !== NUDGE_EXTENSION_FRAME_WORKER_PROBE.START) return;
    if (message.sessionId !== resolvedSessionId) return;
    const candidatePort = event?.ports?.[0];
    if (!candidatePort || typeof candidatePort.postMessage !== 'function') return;
    void authenticateBootstrap(message, candidatePort).catch((error) => {
      postCandidateError(candidatePort, {
        sessionId: resolvedSessionId,
        nonce: typeof message.nonce === 'string' ? message.nonce : null,
        error: String(error?.message || error || 'NUDGE_RENDER_HOST_CHANNEL_AUTH_FAILED'),
      });
    });
  }

  windowRef.addEventListener('message', handleWindowMessage);

  return Object.freeze({
    postEvent,
    close() {
      if (closed) return;
      closed = true;
      windowRef.removeEventListener?.('message', handleWindowMessage);
      if (channelPort) {
        channelPort.removeEventListener?.('message', handleChannelMessage);
        if (channelPort.onmessage === handleChannelMessage) channelPort.onmessage = null;
      }
      closePort(channelPort);
      channelPort = null;
      channelNonce = null;
    },
    isAuthenticated: () => !!channelPort && !closed,
  });
}

export default installAuthenticatedNudgeRenderHostChannel;
