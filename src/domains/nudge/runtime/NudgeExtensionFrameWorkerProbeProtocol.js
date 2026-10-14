export const NUDGE_FRAME_HOST_CAPABILITY_CONTRACT = 'nudge_frame_host_capability_v1';

export const NUDGE_EXTENSION_FRAME_WORKER_PROBE = Object.freeze({
  COMMAND_TYPE: 'ENTROPY_NUDGE_EXTENSION_FRAME_WORKER_PROBE_COMMAND',
  EVENT_TYPE: 'ENTROPY_NUDGE_EXTENSION_FRAME_WORKER_PROBE_EVENT',
  START: 'START',
  WORKER_MESSAGE: 'WORKER_MESSAGE',
  DEACTIVATE: 'DEACTIVATE',
  HOST_READY: 'HOST_READY',
  CHANNEL_READY: 'CHANNEL_READY',
  HOST_STARTED: 'HOST_STARTED',
  WORKER_READY: 'WORKER_READY',
  WORKER_STATS: 'WORKER_STATS',
  SPAWN_STATUS: 'SPAWN_STATUS',
  HIT_RESULT: 'HIT_RESULT',
  FIRST_FRAME: 'FIRST_FRAME',
  COMPLETE: 'COMPLETE',
  ERROR: 'ERROR',
});

export function createFrameWorkerProbeEvent({
  phase,
  sessionId,
  nonce = null,
  payload = null,
  error = null,
} = {}) {
  return {
    type: NUDGE_EXTENSION_FRAME_WORKER_PROBE.EVENT_TYPE,
    phase,
    sessionId,
    nonce,
    payload,
    error,
    sentAt: Date.now(),
  };
}

export function createFrameWorkerProbeCommand({
  command,
  sessionId,
  nonce,
  capability = null,
  payload = null,
} = {}) {
  return {
    type: NUDGE_EXTENSION_FRAME_WORKER_PROBE.COMMAND_TYPE,
    command,
    sessionId,
    nonce,
    capability,
    payload,
    sentAt: Date.now(),
  };
}
