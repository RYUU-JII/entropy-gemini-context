import { MESSAGE_TYPES } from '../../../../platform/messaging/messageTypes.js';
import {
  buildStatsCommittedEvent,
  buildStatsResetEvent,
  buildStatsRolloverEvent,
} from '../../contracts/statsEvents.js';

function resolveStatsEventBrowserPort(browserPort) {
  if (typeof browserPort?.runtimeSendMessage !== 'function') {
    throw new Error('STATS_EVENT_BROWSER_PORT_REQUIRED');
  }
  return browserPort;
}

export function createStatsEventBridge({ browserPort } = {}) {
  const resolvedBrowserPort = resolveStatsEventBrowserPort(browserPort);

  async function emitStatsRuntimeMessage(event) {
    if (!event) return false;
    const result = await resolvedBrowserPort.runtimeSendMessage(
      {
        type: MESSAGE_TYPES.STATS_EVENT,
        payload: event,
      },
    );
    return result?.sent === true;
  }

  function emitStatsCommitted({
    changedDates = [],
    reason = 'commit',
    revision = 0,
    meta = {},
  } = {}) {
    return emitStatsRuntimeMessage(
      buildStatsCommittedEvent({
        changedDates,
        reason,
        revision,
        meta,
      }),
    );
  }

  function emitStatsRollover({
    changedDates = [],
    reason = 'rollover',
    revision = 0,
    meta = {},
  } = {}) {
    return emitStatsRuntimeMessage(
      buildStatsRolloverEvent({
        changedDates,
        reason,
        revision,
        meta,
      }),
    );
  }

  function emitStatsReset({
    changedDates = [],
    reason = 'reset',
    revision = 0,
    meta = {},
  } = {}) {
    return emitStatsRuntimeMessage(
      buildStatsResetEvent({
        changedDates,
        reason,
        revision,
        meta,
      }),
    );
  }

  return {
    emitStatsCommitted,
    emitStatsReset,
    emitStatsRollover,
  };
}
