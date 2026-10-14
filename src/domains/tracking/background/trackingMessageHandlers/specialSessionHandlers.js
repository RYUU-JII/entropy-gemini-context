import { MESSAGE_ACTIONS } from '../../../../platform/messaging/messageTypes.js';
import { normalizeDomain } from '../../../../lib/domain.js';
import {
  SPECIAL_SESSION_DEFAULT_DURATION_MINUTES,
  clampSpecialSessionDurationMinutes,
  normalizeSpecialSessionHosts,
} from '../../../settings/config/specialSession.js';
import { runAsyncHandler } from './runtimeHandlerUtils.js';

function requireSpecialSessionRuntime(runtime) {
  if (
    !runtime
    || typeof runtime.readSession !== 'function'
    || typeof runtime.startSession !== 'function'
    || typeof runtime.endSession !== 'function'
    || typeof runtime.addTemporaryAllowedHost !== 'function'
  ) {
    throw new Error('SPECIAL_SESSION_RUNTIME_OWNER_REQUIRED');
  }
  return runtime;
}

function requireReleaseIsolationSessions(releaseIsolationSessions) {
  if (typeof releaseIsolationSessions !== 'function') {
    throw new Error('SPECIAL_SESSION_ISOLATION_RELEASE_OWNER_REQUIRED');
  }
  return releaseIsolationSessions;
}

function requireCurrentManualSession(state, sessionId) {
  if (state.source !== 'manual' || state.sessionId !== sessionId) throw new Error('SPECIAL_SESSION_OCCURRENCE_CHANGED');
}

function resolveSessionPayload(request = {}) {
  return {
    durationMinutes: clampSpecialSessionDurationMinutes(
      request?.durationMinutes,
      SPECIAL_SESSION_DEFAULT_DURATION_MINUTES,
    ),
    temporaryAllowedHosts: normalizeSpecialSessionHosts(request?.temporaryAllowedHosts),
  };
}

export function createSpecialSessionActionHandlers(context = {}) {
  if (!context?.specialSessionRuntime) {
    return {};
  }
  const specialSessionRuntime = requireSpecialSessionRuntime(context.specialSessionRuntime);
  const releaseIsolationSessions = requireReleaseIsolationSessions(context.releaseIsolationSessions);
  const { checkScheduleStatus, endScheduleOccurrence, runManualSessionMutation } = context;
  if (typeof checkScheduleStatus !== 'function' || typeof endScheduleOccurrence !== 'function' || typeof runManualSessionMutation !== 'function') {
    throw new Error('SPECIAL_SESSION_SCHEDULE_RUNTIME_OWNER_REQUIRED');
  }

  return {
    [MESSAGE_ACTIONS.GET_SCHEDULE_RUNTIME_STATE]: (_request, _sender, sendResponse) => runAsyncHandler(
      sendResponse, async () => ({ success: true, state: await checkScheduleStatus() }),
      (error) => ({ success: false, error: error.message }),
    ),
    [MESSAGE_ACTIONS.END_SCHEDULE_OCCURRENCE]: (request, _sender, sendResponse) => runAsyncHandler(
      sendResponse, async () => ({ success: true, state: await endScheduleOccurrence({ sessionId: request.sessionId }) }),
      (error) => ({ success: false, error: error.message }),
    ),
    [MESSAGE_ACTIONS.GET_SPECIAL_SESSION]: (_request, _sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        const session = await specialSessionRuntime.readSession();
        return { success: true, session };
      },
      (error) => ({ success: false, error: error?.message || 'GET_SPECIAL_SESSION_FAILED' }),
    ),

    [MESSAGE_ACTIONS.START_SPECIAL_SESSION]: (request, _sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        const session = await runManualSessionMutation((state) => {
          if (state.source === 'manual') throw new Error('SPECIAL_SESSION_ALREADY_ACTIVE');
          return specialSessionRuntime.startSession(resolveSessionPayload(request));
        });
        return { success: true, session };
      },
      (error) => ({ success: false, error: error?.message || 'START_SPECIAL_SESSION_FAILED' }),
    ),

    [MESSAGE_ACTIONS.END_SPECIAL_SESSION]: (request, _sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        const session = await runManualSessionMutation(async (state) => {
          requireCurrentManualSession(state, request.sessionId);
          const ended = await specialSessionRuntime.endSession();
          await releaseIsolationSessions({ now: Date.now() });
          return ended;
        });
        return { success: true, session };
      },
      (error) => ({ success: false, error: error?.message || 'END_SPECIAL_SESSION_FAILED' }),
    ),

    [MESSAGE_ACTIONS.ADD_SPECIAL_SESSION_TEMPORARY_ALLOWED_SITE]: (request, _sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        const hostname = normalizeDomain(request?.hostname || request?.domain || '');
        if (!hostname) {
          return { success: false, error: 'INVALID_DOMAIN' };
        }
        const session = await runManualSessionMutation(async (state) => {
          requireCurrentManualSession(state, request.sessionId);
          const updated = await specialSessionRuntime.addTemporaryAllowedHost(hostname);
          await releaseIsolationSessions({ hostname, now: Date.now() });
          return updated;
        });
        return { success: true, session };
      },
      (error) => ({ success: false, error: error?.message || 'ADD_SPECIAL_SESSION_TEMPORARY_ALLOWED_SITE_FAILED' }),
    ),
  };
}
