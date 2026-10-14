import { runtimeGetURL } from '../../../platform/chrome/ChromeService.js';
import {
  NUDGE_EXTENSION_FRAME_WORKER_PROBE,
  createFrameWorkerProbeCommand,
} from './NudgeExtensionFrameWorkerProbeProtocol.js';
import { issueNudgeFrameHostCapability } from './frame-host/nudgeFrameHostCapabilityClient.js';

const DEFAULT_PROBE_TIMEOUT_MS = 5200;
const DEFAULT_PROBE_DURATION_MS = 2200;
const DEFAULT_FRAME_WIDTH = 168;
const DEFAULT_FRAME_HEIGHT = 112;
const DEFAULT_RENDER_MODE = 'nudge_swarm';
const HOST_PAGE_PATH = 'src/pages/nudge-render-host.html';
const FRAME_ID = 'entropy-nudge-extension-frame-worker-probe';

function nowMs() {
  return typeof globalThis.performance?.now === 'function' ? globalThis.performance.now() : Date.now();
}

function elapsedSince(startedAtMs) {
  return Math.max(0, Math.round((nowMs() - startedAtMs) * 10) / 10);
}

function toFiniteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function toCount(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.round(numeric));
}

function clampMs(value, fallback, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, Math.round(numeric)));
}

function createProbeId(prefix) {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `${prefix}_${globalThis.crypto.randomUUID()}`;
  }
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const words = new Uint32Array(4);
    globalThis.crypto.getRandomValues(words);
    return `${prefix}_${Array.from(words, (word) => word.toString(16).padStart(8, '0')).join('')}`;
  }
  throw new Error('frame_host_probe_secure_runtime_id_unavailable');
}

function createFrameHostMessageChannel() {
  if (typeof globalThis.MessageChannel !== 'function') {
    throw new Error('frame_host_probe_message_channel_unavailable');
  }
  return new globalThis.MessageChannel();
}

function removeExistingProbeFrame() {
  const existing = document.getElementById(FRAME_ID);
  if (existing?.parentNode) {
    existing.parentNode.removeChild(existing);
  }
}

function normalizeRenderMode(value) {
  return value === 'probe' ? 'probe' : DEFAULT_RENDER_MODE;
}

function buildBaseProbe({ timeoutMs, durationMs, renderMode }) {
  return {
    ok: false,
    phase: 'created',
    runtime: 'extension_frame_worker_probe',
    renderMode,
    host: {
      pagePath: HOST_PAGE_PATH,
      pageUrl: null,
      origin: null,
      iframeConnected: false,
      overlay: {
        width: DEFAULT_FRAME_WIDTH,
        height: DEFAULT_FRAME_HEIGHT,
        position: 'fixed:bottom-right',
      },
    },
    support: {
      documentApi: typeof document !== 'undefined',
      iframeApi: typeof HTMLIFrameElement !== 'undefined',
      postMessageApi: typeof globalThis.postMessage === 'function',
      messageChannelApi: typeof globalThis.MessageChannel === 'function',
      runtimeGetUrlApi: typeof runtimeGetURL === 'function',
      hostDocumentApi: null,
      hostWorkerApi: null,
      hostOffscreenCanvasApi: null,
      hostCanvasTransfer: null,
      workerRaf: null,
    },
    hostReady: null,
    hostStarted: null,
    workerReady: null,
    workerStats: null,
    spawnStatus: null,
    firstFrame: null,
    complete: null,
    events: [],
    error: null,
    timeoutMs,
    durationMs,
    elapsedMs: 0,
  };
}

function normalizeSupport(probe, payload = null) {
  const support = payload?.support && typeof payload.support === 'object'
    ? payload.support
    : null;
  if (!support) return probe.support;
  return {
    ...probe.support,
    hostDocumentApi: typeof support.documentApi === 'boolean' ? support.documentApi : probe.support.hostDocumentApi,
    hostWorkerApi: typeof support.workerApi === 'boolean' ? support.workerApi : probe.support.hostWorkerApi,
    hostOffscreenCanvasApi: typeof support.offscreenCanvasApi === 'boolean'
      ? support.offscreenCanvasApi
      : probe.support.hostOffscreenCanvasApi,
    hostCanvasTransfer: typeof support.canvasTransfer === 'boolean'
      ? support.canvasTransfer
      : probe.support.hostCanvasTransfer,
  };
}

function finishProbe(probe, {
  ok = false,
  phase = probe.phase,
  error = null,
  startedAtMs,
} = {}) {
  return {
    ...probe,
    ok: ok === true,
    phase,
    error,
    elapsedMs: elapsedSince(startedAtMs),
  };
}

function appendEvent(probe, event) {
  const entry = {
    phase: event?.phase || null,
    payload: event?.payload || null,
    error: event?.error || null,
    receivedAt: Date.now(),
  };
  return {
    ...probe,
    events: [...probe.events.slice(-11), entry],
  };
}

function normalizeWorkerClock(payload = null, fallback = null) {
  const source = payload && typeof payload === 'object' ? payload : {};
  const previous = fallback && typeof fallback === 'object' ? fallback : {};
  return {
    requestedAtMs: toFiniteNumber(source.requestedAtMs, previous.requestedAtMs || 0),
    acceptedAtMs: toFiniteNumber(source.acceptedAtMs, previous.acceptedAtMs || 0),
    renderedAtMs: toFiniteNumber(source.renderedAtMs, previous.renderedAtMs || 0),
    rejectedAtMs: toFiniteNumber(source.rejectedAtMs, previous.rejectedAtMs || 0),
  };
}

function isMixedEpochWorkerClock(timestampMs, requestedAtMs) {
  return (
    toFiniteNumber(requestedAtMs, 0) > 100000000000
    && toFiniteNumber(timestampMs, 0) > 0
    && toFiniteNumber(timestampMs, 0) < 100000000000
  );
}

function normalizeSpawnStatusClock(payload = null, fallback = null, {
  receivedAtMs = Date.now(),
} = {}) {
  const source = payload && typeof payload === 'object' ? payload : {};
  const requestId = toCount(source.requestId, 0);
  const previous = fallback && typeof fallback === 'object' && toCount(fallback.requestId, 0) === requestId
    ? fallback
    : {};
  const requestedAtMs = toFiniteNumber(source.requestedAtMs, previous.requestedAtMs || 0);
  const rawAcceptedAtMs = toFiniteNumber(source.acceptedAtMs, previous.workerClock?.acceptedAtMs || 0);
  const rawRenderedAtMs = toFiniteNumber(source.renderedAtMs, previous.workerClock?.renderedAtMs || 0);
  const rawRejectedAtMs = toFiniteNumber(source.rejectedAtMs, previous.workerClock?.rejectedAtMs || 0);
  const phase = typeof source.phase === 'string' && source.phase.trim()
    ? source.phase.trim()
    : (previous.phase || 'unknown');
  const observedAtMs = toFiniteNumber(receivedAtMs, Date.now());
  const acceptedAtMs = isMixedEpochWorkerClock(rawAcceptedAtMs, requestedAtMs)
    ? toFiniteNumber(previous.acceptedAtMs, observedAtMs) || observedAtMs
    : rawAcceptedAtMs;
  const renderedAtMs = phase === 'rendered' && isMixedEpochWorkerClock(rawRenderedAtMs, requestedAtMs)
    ? toFiniteNumber(previous.renderedAtMs, observedAtMs) || observedAtMs
    : rawRenderedAtMs;
  const rejectedAtMs = phase === 'rejected' && isMixedEpochWorkerClock(rawRejectedAtMs, requestedAtMs)
    ? toFiniteNumber(previous.rejectedAtMs, observedAtMs) || observedAtMs
    : rawRejectedAtMs;

  return {
    ...previous,
    ...source,
    phase,
    requestId,
    requestedAtMs,
    acceptedAtMs,
    renderedAtMs,
    rejectedAtMs,
    workerClock: normalizeWorkerClock(source.workerClock || source, previous.workerClock),
  };
}

function normalizeProbeEventPayload(probe, phase, payload = null, {
  receivedAtMs = Date.now(),
} = {}) {
  if (!payload || typeof payload !== 'object') return payload || null;
  if (phase === NUDGE_EXTENSION_FRAME_WORKER_PROBE.SPAWN_STATUS) {
    return normalizeSpawnStatusClock(payload, probe.spawnStatus, { receivedAtMs });
  }
  if (
    (
      phase === NUDGE_EXTENSION_FRAME_WORKER_PROBE.FIRST_FRAME
      || phase === NUDGE_EXTENSION_FRAME_WORKER_PROBE.COMPLETE
    )
    && payload.spawnStatus
    && typeof payload.spawnStatus === 'object'
  ) {
    return {
      ...payload,
      spawnStatus: normalizeSpawnStatusClock(payload.spawnStatus, probe.spawnStatus, { receivedAtMs }),
    };
  }
  return payload;
}

function createProbeFrame(hostUrl, { width, height }) {
  removeExistingProbeFrame();
  const iframe = document.createElement('iframe');
  iframe.id = FRAME_ID;
  iframe.title = 'Entropy nudge extension frame worker probe';
  iframe.src = hostUrl;
  iframe.allow = '';
  iframe.style.position = 'fixed';
  iframe.style.right = '16px';
  iframe.style.bottom = '16px';
  iframe.style.width = `${width}px`;
  iframe.style.height = `${height}px`;
  iframe.style.border = '1px solid rgba(244, 214, 142, 0.45)';
  iframe.style.borderRadius = '8px';
  iframe.style.boxShadow = '0 14px 40px rgba(0, 0, 0, 0.32)';
  iframe.style.background = 'transparent';
  iframe.style.pointerEvents = 'none';
  iframe.style.zIndex = '2147483647';
  // match the render-host document's scheme — a mismatch forces an opaque
  // frame canvas (see NudgeExtensionFrameWorkerRuntime.createFrameElement)
  iframe.style.colorScheme = 'light';
  document.documentElement.appendChild(iframe);
  return iframe;
}

export function runNudgeExtensionFrameWorkerProbe({
  timeoutMs = DEFAULT_PROBE_TIMEOUT_MS,
  durationMs = DEFAULT_PROBE_DURATION_MS,
  width = DEFAULT_FRAME_WIDTH,
  height = DEFAULT_FRAME_HEIGHT,
  renderMode = DEFAULT_RENDER_MODE,
  config = null,
  runtimeContext = null,
  cleanupDelayMs = 160,
  issueFrameHostCapability = issueNudgeFrameHostCapability,
  messageChannelFactory = createFrameHostMessageChannel,
} = {}) {
  const startedAtMs = nowMs();
  const resolvedTimeoutMs = clampMs(timeoutMs, DEFAULT_PROBE_TIMEOUT_MS, 500, 12000);
  const resolvedDurationMs = clampMs(durationMs, DEFAULT_PROBE_DURATION_MS, 300, 8000);
  const resolvedRenderMode = normalizeRenderMode(renderMode);
  let probe = buildBaseProbe({
    timeoutMs: resolvedTimeoutMs,
    durationMs: resolvedDurationMs,
    renderMode: resolvedRenderMode,
  });
  let timeoutId = null;
  let settled = false;
  let iframe = null;
  let hostPort = null;
  let hostReady = false;
  let capabilityTicket = null;

  const cleanup = () => {
    if (timeoutId !== null) {
      globalThis.clearTimeout(timeoutId);
      timeoutId = null;
    }
    globalThis.removeEventListener?.('message', handleHostMessage);
    if (hostPort) {
      hostPort.removeEventListener?.('message', handleHostPortMessage);
      if (hostPort.onmessage === handleHostPortMessage) hostPort.onmessage = null;
      try {
        hostPort.close?.();
      } catch (_error) {}
      hostPort = null;
    }
    if (iframe?.parentNode) {
      const frameToRemove = iframe;
      globalThis.setTimeout(() => {
        if (frameToRemove.parentNode) {
          frameToRemove.parentNode.removeChild(frameToRemove);
        }
      }, Math.max(0, Math.round(Number(cleanupDelayMs) || 0)));
    }
    iframe = null;
  };

  const settle = (nextProbe) => {
    if (settled) return;
    settled = true;
    cleanup();
    resolvePromise(nextProbe);
  };

  let resolvePromise = () => {};
  const sessionId = createProbeId('frame_worker');
  const nonce = createProbeId('nonce');

  function openAuthenticatedHostChannel() {
    if (!hostReady || !capabilityTicket || hostPort || !iframe?.contentWindow) return;
    try {
      const channel = messageChannelFactory();
      if (!channel?.port1 || !channel?.port2) {
        throw new Error('frame_host_probe_message_channel_invalid');
      }
      hostPort = channel.port1;
      hostPort.addEventListener?.('message', handleHostPortMessage);
      if (!hostPort.addEventListener) hostPort.onmessage = handleHostPortMessage;
      hostPort.start?.();
      iframe.contentWindow.postMessage(createFrameWorkerProbeCommand({
        command: NUDGE_EXTENSION_FRAME_WORKER_PROBE.START,
        sessionId,
        nonce,
        capability: capabilityTicket.capability,
        payload: {
          renderMode: resolvedRenderMode,
          width,
          height,
          durationMs: resolvedDurationMs,
          config,
          runtimeContext,
        },
      }), probe.host.origin, [channel.port2]);
    } catch (error) {
      settle(finishProbe(probe, {
        phase: 'channel_bootstrap_failed',
        error: String(error?.message || error || 'frame_worker_probe_channel_bootstrap_failed'),
        startedAtMs,
      }));
    }
  }

  function beginCapabilityIssue() {
    if (typeof issueFrameHostCapability !== 'function') {
      settle(finishProbe(probe, {
        phase: 'capability_issue_failed',
        error: 'frame_host_probe_capability_issuer_required',
        startedAtMs,
      }));
      return;
    }
    void Promise.resolve(issueFrameHostCapability({ sessionId, nonce })).then((ticket) => {
      if (settled) return;
      if (
        ticket?.sessionId !== sessionId
        || typeof ticket?.capability !== 'string'
        || !ticket.capability
      ) {
        throw new Error('frame_host_probe_capability_ticket_invalid');
      }
      capabilityTicket = ticket;
      openAuthenticatedHostChannel();
    }).catch((error) => {
      settle(finishProbe(probe, {
        phase: 'capability_issue_failed',
        error: String(error?.message || error || 'frame_worker_probe_capability_issue_failed'),
        startedAtMs,
      }));
    });
  }

  function handleHostMessage(event) {
    if (!iframe?.contentWindow || event.source !== iframe.contentWindow) return;
    if (probe.host.origin && event.origin !== probe.host.origin) return;
    const message = event?.data || {};
    if (message.type !== NUDGE_EXTENSION_FRAME_WORKER_PROBE.EVENT_TYPE) return;
    if (message.sessionId !== sessionId) return;
    if (message.phase !== NUDGE_EXTENSION_FRAME_WORKER_PROBE.HOST_READY) return;
    const normalizedMessage = {
      ...message,
      payload: normalizeProbeEventPayload(
        probe,
        message.phase,
        message.payload,
        { receivedAtMs: Date.now() },
      ),
    };
    probe = appendEvent(probe, normalizedMessage);
    probe = {
      ...probe,
      phase: 'host_ready',
      hostReady: normalizedMessage.payload || null,
      renderMode: normalizedMessage.payload?.renderMode || probe.renderMode,
      support: normalizeSupport(probe, normalizedMessage.payload),
    };
    hostReady = true;
    openAuthenticatedHostChannel();
  }

  function handleHostPortMessage(event) {
    const message = event?.data || {};
    if (message.type !== NUDGE_EXTENSION_FRAME_WORKER_PROBE.EVENT_TYPE) return;
    if (message.sessionId !== sessionId || message.nonce !== nonce) return;
    processAuthenticatedHostMessage(message);
  }

  function processAuthenticatedHostMessage(message) {
    const receivedAtMs = Date.now();
    const normalizedMessage = {
      ...message,
      payload: normalizeProbeEventPayload(probe, message.phase, message.payload, { receivedAtMs }),
    };
    probe = appendEvent(probe, normalizedMessage);

    if (normalizedMessage.phase === NUDGE_EXTENSION_FRAME_WORKER_PROBE.CHANNEL_READY) {
      probe = {
        ...probe,
        phase: 'channel_ready',
      };
      return;
    }

    if (normalizedMessage.phase === NUDGE_EXTENSION_FRAME_WORKER_PROBE.HOST_STARTED) {
      probe = {
        ...probe,
        phase: 'host_started',
        hostStarted: normalizedMessage.payload || null,
        renderMode: normalizedMessage.payload?.renderMode || probe.renderMode,
        support: normalizeSupport(probe, normalizedMessage.payload),
      };
      return;
    }

    if (normalizedMessage.phase === NUDGE_EXTENSION_FRAME_WORKER_PROBE.WORKER_READY) {
      probe = {
        ...probe,
        phase: 'worker_ready',
        workerReady: normalizedMessage.payload || null,
        renderMode: normalizedMessage.payload?.renderMode || probe.renderMode,
        support: {
          ...probe.support,
          workerRaf: typeof normalizedMessage.payload?.supportsWorkerRaf === 'boolean'
            ? normalizedMessage.payload.supportsWorkerRaf
            : probe.support.workerRaf,
        },
      };
      return;
    }

    if (normalizedMessage.phase === NUDGE_EXTENSION_FRAME_WORKER_PROBE.WORKER_STATS) {
      probe = {
        ...probe,
        phase: 'worker_stats',
        workerStats: normalizedMessage.payload || null,
        renderMode: normalizedMessage.payload?.renderMode || probe.renderMode,
      };
      return;
    }

    if (normalizedMessage.phase === NUDGE_EXTENSION_FRAME_WORKER_PROBE.SPAWN_STATUS) {
      probe = {
        ...probe,
        phase: normalizedMessage.payload?.phase === 'rendered' ? 'spawn_rendered' : 'spawn_status',
        spawnStatus: normalizedMessage.payload || null,
        renderMode: normalizedMessage.payload?.renderMode || probe.renderMode,
      };
      return;
    }

    if (normalizedMessage.phase === NUDGE_EXTENSION_FRAME_WORKER_PROBE.FIRST_FRAME) {
      probe = {
        ...probe,
        phase: 'first_frame',
        firstFrame: normalizedMessage.payload || null,
        renderMode: normalizedMessage.payload?.renderMode || probe.renderMode,
        support: {
          ...probe.support,
          workerRaf: typeof normalizedMessage.payload?.supportsWorkerRaf === 'boolean'
            ? normalizedMessage.payload.supportsWorkerRaf
            : probe.support.workerRaf,
        },
      };
      return;
    }

    if (normalizedMessage.phase === NUDGE_EXTENSION_FRAME_WORKER_PROBE.COMPLETE) {
      probe = {
        ...probe,
        complete: normalizedMessage.payload || null,
        renderMode: normalizedMessage.payload?.renderMode || probe.renderMode,
        support: {
          ...probe.support,
          workerRaf: typeof normalizedMessage.payload?.supportsWorkerRaf === 'boolean'
            ? normalizedMessage.payload.supportsWorkerRaf
            : probe.support.workerRaf,
        },
      };
      settle(finishProbe(probe, {
        ok: true,
        phase: 'completed',
        startedAtMs,
      }));
      return;
    }

    if (message.phase === NUDGE_EXTENSION_FRAME_WORKER_PROBE.ERROR) {
      settle(finishProbe(probe, {
        phase: 'host_error',
        error: String(message.error || 'frame_worker_probe_host_error'),
        startedAtMs,
      }));
    }
  }

  return new Promise((resolve) => {
    resolvePromise = resolve;
    try {
      if (!probe.support.documentApi || typeof document.createElement !== 'function') {
        settle(finishProbe(probe, {
          phase: 'document_unavailable',
          error: 'document API unavailable',
          startedAtMs,
        }));
        return;
      }
      const pageUrl = runtimeGetURL(HOST_PAGE_PATH);
      const hostUrl = new URL(pageUrl);
      hostUrl.searchParams.set('session', sessionId);
      probe = {
        ...probe,
        phase: 'iframe_created',
        host: {
          ...probe.host,
          pageUrl: hostUrl.href,
          origin: hostUrl.origin,
        },
      };
      globalThis.addEventListener('message', handleHostMessage);
      iframe = createProbeFrame(hostUrl.href, { width, height });
      probe = {
        ...probe,
        phase: 'iframe_attached',
        host: {
          ...probe.host,
          iframeConnected: true,
        },
      };

      beginCapabilityIssue();
      timeoutId = globalThis.setTimeout(() => {
        settle(finishProbe(probe, {
          phase: 'timeout',
          error: `frame_worker_probe_timeout:${probe.phase}`,
          startedAtMs,
        }));
      }, resolvedTimeoutMs);
    } catch (error) {
      settle(finishProbe(probe, {
        phase: 'probe_exception',
        error: String(error?.message || error || 'frame_worker_probe_exception'),
        startedAtMs,
      }));
    }
  });
}

export default runNudgeExtensionFrameWorkerProbe;
