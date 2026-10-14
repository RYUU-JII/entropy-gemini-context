import {
  runtimeOnMessageAddListener,
} from '../../platform/chrome/ChromeService.js';
import { MESSAGE_TYPES } from '../../platform/messaging/messageTypes.js';
import {
  createAudioDullingGraph,
  disposeAudioDullingGraph,
  updateAudioDullingGraph,
} from './audioDullingGraph.js';

const OFFSCREEN_TARGET = 'audioDullingOffscreen';
const sessions = new Map();

function requireTabId(tabId) {
  const normalizedTabId = Number(tabId);
  if (!Number.isInteger(normalizedTabId) || normalizedTabId < 0) {
    throw new Error('AUDIO_DULLING_TAB_ID_REQUIRED');
  }
  return normalizedTabId;
}

function requireStreamId(streamId) {
  if (typeof streamId !== 'string' || !streamId.trim()) {
    throw new Error('AUDIO_DULLING_STREAM_ID_REQUIRED');
  }
  return streamId.trim();
}

function serializeSession(session) {
  return Object.freeze({
    status: 'capturing_processed',
    audioContextState: session.audioContext.state,
    audioTrackCount: session.stream.getAudioTracks().length,
    plan: session.graph.plan,
  });
}

async function closeSession(tabId) {
  const key = requireTabId(tabId);
  const session = sessions.get(key);
  if (!session) return false;
  sessions.delete(key);
  disposeAudioDullingGraph(session.graph);
  try {
    session.source.disconnect();
  } catch (_error) {
    // The graph can already be disconnected after a terminal track event.
  }
  session.stream.getTracks().forEach((track) => track.stop());
  await session.audioContext.close();
  return true;
}

async function startProcessedSession({ tabId, streamId, config = null } = {}) {
  const normalizedTabId = requireTabId(tabId);
  const normalizedStreamId = requireStreamId(streamId);
  if (sessions.has(normalizedTabId)) {
    await closeSession(normalizedTabId);
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: normalizedStreamId,
      },
    },
    video: false,
  });
  if (stream.getAudioTracks().length < 1) {
    stream.getTracks().forEach((track) => track.stop());
    throw new Error('AUDIO_DULLING_CAPTURE_AUDIO_TRACK_REQUIRED');
  }

  let audioContext = null;
  let source = null;
  let graph = null;
  try {
    audioContext = new AudioContext({ latencyHint: 'playback' });
    source = audioContext.createMediaStreamSource(stream);
    graph = createAudioDullingGraph({
      audioContext,
      source,
      config,
    });
  } catch (error) {
    disposeAudioDullingGraph(graph);
    try {
      source?.disconnect();
    } catch (_disconnectError) {
      // The source can be partially constructed when graph creation fails.
    }
    stream.getTracks().forEach((track) => track.stop());
    await audioContext?.close?.().catch(() => {});
    throw error;
  }

  const session = { audioContext, graph, source, stream };
  sessions.set(normalizedTabId, session);

  stream.getAudioTracks().forEach((track) => {
    track.addEventListener('ended', () => {
      if (sessions.get(normalizedTabId) !== session) return;
      void closeSession(normalizedTabId);
    }, { once: true });
  });

  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }
  if (audioContext.state !== 'running') {
    await closeSession(normalizedTabId);
    throw new Error(`AUDIO_DULLING_AUDIO_CONTEXT_NOT_RUNNING:${audioContext.state}`);
  }
  return serializeSession(session);
}

function updateSession({ tabId, config = null } = {}) {
  const normalizedTabId = requireTabId(tabId);
  const session = sessions.get(normalizedTabId);
  if (!session) {
    throw new Error('AUDIO_DULLING_SESSION_REQUIRED');
  }
  updateAudioDullingGraph(session.graph, config);
  return serializeSession(session);
}

function snapshotSession({ tabId } = {}) {
  const normalizedTabId = requireTabId(tabId);
  const session = sessions.get(normalizedTabId);
  return session
    ? serializeSession(session)
    : Object.freeze({ status: 'idle' });
}

runtimeOnMessageAddListener((message, _sender, sendResponse) => {
  if (message?.type !== MESSAGE_TYPES.AUDIO_DULLING_OFFSCREEN_COMMAND) return false;
  if (message?.target !== OFFSCREEN_TARGET) return false;

  Promise.resolve()
    .then(async () => {
      const command = message.command;
      if (command === 'start') {
        return startProcessedSession(message.payload || {});
      }
      if (command === 'update') {
        return updateSession(message.payload || {});
      }
      if (command === 'snapshot') {
        return snapshotSession(message.payload || {});
      }
      if (command === 'stop') {
        return {
          status: await closeSession(message.payload?.tabId) ? 'stopped' : 'idle',
        };
      }
      throw new Error(`AUDIO_DULLING_UNKNOWN_OFFSCREEN_COMMAND:${command || 'missing'}`);
    })
    .then((result) => sendResponse?.({ ok: true, ...result }))
    .catch((error) => {
      sendResponse?.({
        ok: false,
        error: String(error?.message || error || 'AUDIO_DULLING_OFFSCREEN_FAILED'),
      });
    });

  return true;
});
