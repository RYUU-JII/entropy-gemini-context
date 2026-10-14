import {
  SENTINEL_PROTOCOL_TIMELINE_PHASES,
  SENTINEL_PROTOCOL_TIMELINE_SOURCES,
  SENTINEL_PROTOCOL_TIMELINE_STATUSES,
} from '../../../debug/SentinelProtocolTimeline.js';

export function createProtectionNudgeDispatchTimeline({
  recordTimeline,
  force = false,
  tabId = null,
  url = '',
} = {}) {
  if (typeof recordTimeline !== 'function') {
    throw new Error('PROTECTION_NUDGE_TIMELINE_RECORDER_REQUIRED');
  }

  const enabled = force === true;
  const source = SENTINEL_PROTOCOL_TIMELINE_SOURCES.RUNTIME;
  let hostname = null;

  function setHostname(nextHostname = null) {
    hostname = typeof nextHostname === 'string' && nextHostname ? nextHostname : null;
  }

  function note(phase, status, payload = {}) {
    if (!enabled) return null;
    return recordTimeline({
      phase,
      status,
      source,
      route: 'nudge_dispatch',
      tabId,
      url,
      hostname,
      reason: force ? 'debug' : null,
      ...payload,
    });
  }

  function failedValidation(error) {
    return note(
      SENTINEL_PROTOCOL_TIMELINE_PHASES.FAILED,
      SENTINEL_PROTOCOL_TIMELINE_STATUSES.ERROR,
      { error },
    );
  }

  function accepted() {
    return note(
      SENTINEL_PROTOCOL_TIMELINE_PHASES.BACKGROUND_ACCEPTED,
      SENTINEL_PROTOCOL_TIMELINE_STATUSES.SUCCESS,
    );
  }

  function protectionSkipped(reason) {
    return note(
      SENTINEL_PROTOCOL_TIMELINE_PHASES.PROTECTED_SITE_VALIDATED,
      SENTINEL_PROTOCOL_TIMELINE_STATUSES.SKIPPED,
      { reason },
    );
  }

  function protectionAccepted(traceId = null) {
    return note(
      SENTINEL_PROTOCOL_TIMELINE_PHASES.PROTECTED_SITE_VALIDATED,
      SENTINEL_PROTOCOL_TIMELINE_STATUSES.SUCCESS,
      { traceId },
    );
  }

  function skipped(reason, payload = {}) {
    return note(
      SENTINEL_PROTOCOL_TIMELINE_PHASES.SKIPPED,
      SENTINEL_PROTOCOL_TIMELINE_STATUSES.SKIPPED,
      {
        reason,
        ...payload,
      },
    );
  }

  function nudgeDispatched({
    runId,
    reason,
    protocolProfile,
  } = {}) {
    return note(
      SENTINEL_PROTOCOL_TIMELINE_PHASES.NUDGE_DISPATCHED,
      SENTINEL_PROTOCOL_TIMELINE_STATUSES.PENDING,
      {
        runId,
        reason,
        protocolScope: protocolProfile?.protocolScope,
        protocolVariant: protocolProfile?.protocolVariant,
        protocolIntensity: protocolProfile?.protocolIntensity,
      },
    );
  }

  function contentReady({
    runId,
    ensureSource = null,
    delivery = null,
  } = {}) {
    return note(
      SENTINEL_PROTOCOL_TIMELINE_PHASES.CONTENT_READY,
      SENTINEL_PROTOCOL_TIMELINE_STATUSES.SUCCESS,
      {
        runId,
        ensureSource,
        delivery,
      },
    );
  }

  function contentRendered({
    runId,
    reason,
    protocolProfile,
    ensureSource = null,
    delivery = null,
  } = {}) {
    return note(
      SENTINEL_PROTOCOL_TIMELINE_PHASES.CONTENT_RENDERED,
      SENTINEL_PROTOCOL_TIMELINE_STATUSES.SUCCESS,
      {
        runId,
        reason,
        protocolScope: protocolProfile?.protocolScope,
        protocolVariant: protocolProfile?.protocolVariant,
        protocolIntensity: protocolProfile?.protocolIntensity,
        ensureSource,
        delivery,
      },
    );
  }

  function failedDispatch({
    runId,
    reason = 'send_failed',
    error,
    startFailureDiagnostics = null,
  } = {}) {
    return note(
      SENTINEL_PROTOCOL_TIMELINE_PHASES.FAILED,
      SENTINEL_PROTOCOL_TIMELINE_STATUSES.ERROR,
      {
        runId,
        reason,
        error,
        startFailureDiagnostics,
      },
    );
  }

  return {
    accepted,
    contentReady,
    contentRendered,
    failedDispatch,
    failedValidation,
    note,
    nudgeDispatched,
    protectionAccepted,
    protectionSkipped,
    setHostname,
    skipped,
  };
}
