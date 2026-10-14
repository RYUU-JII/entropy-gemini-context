import { MESSAGE_TYPES } from '../../../platform/messaging/messageTypes.js';
import { formatRuntimeDiagnostic } from '../../../platform/diagnostics/runtimeDiagnosticConsole.js';
import {
  runtimeCanSendMessage,
  runtimeSendMessageReliable,
} from '../../../platform/messaging/runtime/runtimeMessaging.js';
import {
  FRAME_MEDIA_HEARTBEAT_MS,
  FRAME_MEDIA_MAX_ORIGINS,
  FRAME_MEDIA_VERSION,
  createFrameMediaId,
  requireFrameMediaId,
  requireFrameMediaOrigin,
  requireFrameMediaSupportSnapshot,
} from './frameMediaProtocol.js';

const REQUEST_TIMEOUT_MS = 5_000;
function readResult(response, holdId) {
  if (response?.success !== true) {
    throw new Error(typeof response?.error === 'string' ? response.error : 'FRAME_MEDIA_HOLD_ACK_INVALID');
  }
  return requireFrameMediaSupportSnapshot(response.result, { holdId });
}

// This client owns a remote command lease, not another media discovery loop.
// The background authenticates the current top document and active admission;
// frame origins are bounded permission hints and confer no command authority.
export function createFrameMediaHoldClient({
  documentRef = globalThis.document,
  windowRef = documentRef?.defaultView,
  getFrameOrigins = () => [],
  onDiagnostic = console.warn,
  canSendMessage = runtimeCanSendMessage,
  sendRuntimeMessage = runtimeSendMessageReliable,
  createHoldId = createFrameMediaId,
} = {}) {
  let current = null;
  const ownedSessions = new Set();
  let tail = Promise.resolve();
  let pendingRequests = 0;

  function isCurrentTopDocument() {
    return !!windowRef && windowRef.top === windowRef && windowRef.document === documentRef
      && documentRef.defaultView === windowRef;
  }

  function stopHeartbeat(session) {
    if (session.timer !== null) windowRef.clearTimeout(session.timer);
    session.timer = null;
  }

  function detachLifecycle(session) {
    stopHeartbeat(session);
    if (session.onPageHide) windowRef.removeEventListener('pagehide', session.onPageHide);
    session.onPageHide = null;
  }

  function fail(session, error, operation) {
    session.state = 'failed';
    session.commandAccepted = false;
    session.lastCompletedAction = operation;
    session.errorCode = typeof error?.message === 'string' ? error.message : 'FRAME_MEDIA_HOLD_REQUEST_FAILED';
    const diagnosticKey = `${operation}:${session.errorCode}`;
    if (session.reported.has(diagnosticKey)) return;
    session.reported.add(diagnosticKey);
    onDiagnostic(formatRuntimeDiagnostic({
      scope: 'FrameMediaHoldClient', severity: 'warn', event: 'remote_command_failed',
      code: session.errorCode, error, fields: { operation },
    }), {
      code: session.errorCode, operation,
    });
  }

  function frameOrigins() {
    const origins = getFrameOrigins();
    if (!Array.isArray(origins) || origins.length > FRAME_MEDIA_MAX_ORIGINS) {
      throw new Error('FRAME_MEDIA_HOLD_ORIGINS_INVALID');
    }
    return [...new Set(origins.map(requireFrameMediaOrigin))];
  }

  function scheduleHeartbeat(session) {
    if (!session.active || current !== session || session.timer !== null) return;
    session.timer = windowRef.setTimeout(() => {
      session.timer = null;
      if (!session.active || current !== session) return;
      if (!isCurrentTopDocument()) {
        endSession(session, false);
        return;
      }
      let origins;
      try { origins = frameOrigins(); }
      catch (error) {
        fail(session, error, 'renew');
        endSession(session, false);
        return;
      }
      enqueue(session, 'renew', false, origins);
    }, FRAME_MEDIA_HEARTBEAT_MS);
  }

  function enqueue(session, action, resume, origins) {
    pendingRequests += 1;
    const operation = tail.then(async () => {
      // A queued renewal has no work after release. An already queued begin must
      // still precede its exact end, even when the user dismisses immediately.
      if (action === 'renew' && !session.active) return;
      try {
        const transport = await sendRuntimeMessage({
          type: MESSAGE_TYPES.CONTENT_MEDIA_FRAME_HOLD,
          payload: { version: FRAME_MEDIA_VERSION, action, holdId: session.holdId, resume, frameOrigins: origins },
        }, { timeoutMs: REQUEST_TIMEOUT_MS });
        if (transport?.ok !== true) {
          throw new Error(typeof transport?.error === 'string' ? transport.error : 'FRAME_MEDIA_HOLD_TRANSPORT_FAILED');
        }
        const result = readResult(transport.response, session.holdId);
        session.result = result;
        session.commandAccepted = true;
        session.lastCompletedAction = action;
        session.errorCode = result.errorCode;
        session.state = action === 'end' ? 'ended' : (session.active ? 'active' : 'ending');
        if (action === 'end') {
          session.endFailed = false;
          ownedSessions.delete(session);
        }
      } catch (error) {
        fail(session, error, action);
        if (action === 'end') session.endFailed = true;
      } finally {
        if (action === 'end') session.endPending = false;
        if (action !== 'end') scheduleHeartbeat(session);
      }
    });
    tail = operation.finally(() => { pendingRequests -= 1; });
    return tail;
  }

  function endSession(session, resume) {
    if (!session.active && (!session.endFailed || session.endPending)) return tail;
    session.active = false;
    detachLifecycle(session);
    if (!session.holdId) return tail;
    session.state = 'ending';
    session.endPending = true;
    session.resumeOnEnd = session.resumeOnEnd === null ? resume : session.resumeOnEnd && resume;
    // Even an uncertain begin (transport timeout / malformed ACK) may have
    // reached the broker. Always release that exact ID, without substituting it.
    return enqueue(session, 'end', session.resumeOnEnd, []);
  }

  function snapshot() {
    return {
      state: current?.state ?? 'idle', active: current?.active === true,
      holdId: current?.holdId ?? null, commandAccepted: current?.commandAccepted ?? null,
      lastCompletedAction: current?.lastCompletedAction ?? null,
      errorCode: current?.errorCode ?? null, pendingRequests,
      cleanupFailedCount: [...ownedSessions].filter((session) => session.endFailed).length,
      result: current?.result ? {
        ...current.result,
        frames: current.result.frames.map((frame) => ({ ...frame })),
        requiredOrigins: [...current.result.requiredOrigins],
      } : null,
    };
  }

  return {
    begin() {
      if (current?.active) return snapshot();
      if ([...ownedSessions].some((session) => session.endFailed)) {
        fail(current, new Error('FRAME_MEDIA_HOLD_CLEANUP_RETRY_REQUIRED'), 'begin');
        return snapshot();
      }
      const session = {
        active: false, state: 'unavailable', holdId: null, commandAccepted: null,
        result: null, errorCode: null, timer: null, onPageHide: null, reported: new Set(),
        endFailed: false, endPending: false, resumeOnEnd: null,
        lastCompletedAction: null,
      };
      current = session;
      if (!isCurrentTopDocument()) {
        session.errorCode = 'FRAME_MEDIA_HOLD_NOT_CURRENT_TOP_DOCUMENT';
        return snapshot();
      }
      if (!canSendMessage()) {
        session.errorCode = 'FRAME_MEDIA_HOLD_RUNTIME_UNAVAILABLE';
        return snapshot();
      }
      try {
        session.holdId = requireFrameMediaId(createHoldId());
        const origins = frameOrigins();
        session.active = true;
        session.state = 'pending';
        session.onPageHide = () => { endSession(session, false); };
        windowRef.addEventListener('pagehide', session.onPageHide);
        ownedSessions.add(session);
        enqueue(session, 'begin', false, origins);
      } catch (error) {
        fail(session, error, 'begin');
        session.active = false;
        detachLifecycle(session);
      }
      return snapshot();
    },
    end({ resume = false } = {}) {
      if (current) endSession(current, resume === true);
      for (const session of ownedSessions) {
        if (session !== current && session.endFailed) endSession(session, false);
      }
      return snapshot();
    },
    async whenSettled() {
      let observed;
      do { observed = tail; await observed; } while (observed !== tail);
      return snapshot();
    },
    snapshot,
  };
}
