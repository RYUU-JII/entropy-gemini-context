import {
  isTrustedExtensionBackgroundSender,
} from '../../../platform/security/senderTrust.js';
import {
  AUDIO_DULLING_QA_ACTIONS,
  createAudioDullingQaResponse,
  isAudioDullingQaAction,
  parseAudioDullingQaRequest,
} from '../background/audioDulling/audioDullingQaContract.dev.js';
import AudioDullingActivationChip from './runtime/AudioDullingActivationChip.js';
import {
  handleRuntimeDebuggerAutomationContentMessage,
} from '../../nudge/runtime-debugger/automation/runtimeDebuggerAutomationContentRelay.dev.js';
import VideoSkipManager from '../../nudge/video-skip/index.js';
import {
  VIDEO_SKIP_CONTROL_SURFACE_QA_ACTIONS,
  createVideoSkipControlSurfaceQaResponse,
  isVideoSkipControlSurfaceQaAction,
  parseVideoSkipControlSurfaceQaRequest,
} from '../../nudge/video-skip/automation/videoSkipControlSurfaceQaContract.dev.js';

let videoSkipControlSurfaceQaSessionId = null;

function resolveFailureCode(error, fallbackCode = 'AUDIO_DULLING_QA_CONTENT_FAILED') {
  const code = typeof error?.code === 'string' && error.code.trim()
    ? error.code.trim()
    : typeof error?.message === 'string' && error.message.trim()
      ? error.message.trim()
      : fallbackCode;
  return /^[A-Z0-9_:.-]{1,160}$/u.test(code)
    ? code
    : fallbackCode;
}

function resolveVideoSkipQaFailureCode(error) {
  return resolveFailureCode(error, 'VIDEO_SKIP_CONTROL_SURFACE_QA_CONTENT_FAILED');
}

function requireBackgroundSender(sender) {
  if (!isTrustedExtensionBackgroundSender(sender)) {
    throw new Error('AUDIO_DULLING_QA_CONTENT_BACKGROUND_UNTRUSTED');
  }
}

function requireVideoSkipQaBackgroundSender(sender) {
  if (!isTrustedExtensionBackgroundSender(sender)) {
    throw new Error('VIDEO_SKIP_CONTROL_SURFACE_QA_CONTENT_BACKGROUND_UNTRUSTED');
  }
}

export async function dispatchVideoSkipControlSurfaceQaContentRequest(request) {
  const { action, payload } = request;
  if (action === VIDEO_SKIP_CONTROL_SURFACE_QA_ACTIONS.START) {
    const current = VideoSkipManager.getRuntimeSnapshot();
    if (videoSkipControlSurfaceQaSessionId === payload.sessionId) {
      if (current.active !== true || current.mode !== payload.mode) {
        throw new Error('VIDEO_SKIP_CONTROL_SURFACE_QA_SESSION_STATE_MISMATCH');
      }
      return Object.freeze({ started: false, snapshot: current });
    }
    if (videoSkipControlSurfaceQaSessionId || current.active === true) {
      throw new Error('VIDEO_SKIP_CONTROL_SURFACE_QA_RUNTIME_ALREADY_OWNED');
    }
    await VideoSkipManager.apply({
      mode: payload.mode,
    });
    const snapshot = VideoSkipManager.getRuntimeSnapshot();
    if (snapshot.active !== true || snapshot.mode !== payload.mode) {
      await VideoSkipManager.remove();
      throw new Error('VIDEO_SKIP_CONTROL_SURFACE_QA_START_STATE_INVALID');
    }
    videoSkipControlSurfaceQaSessionId = payload.sessionId;
    return Object.freeze({ started: true, snapshot });
  }
  if (action === VIDEO_SKIP_CONTROL_SURFACE_QA_ACTIONS.SNAPSHOT) {
    if (videoSkipControlSurfaceQaSessionId !== payload.sessionId) {
      throw new Error('VIDEO_SKIP_CONTROL_SURFACE_QA_SESSION_NOT_OWNED');
    }
    return Object.freeze({ snapshot: VideoSkipManager.getRuntimeSnapshot() });
  }
  if (action === VIDEO_SKIP_CONTROL_SURFACE_QA_ACTIONS.STOP) {
    if (videoSkipControlSurfaceQaSessionId === null) {
      return Object.freeze({
        stopped: false,
        snapshot: VideoSkipManager.getRuntimeSnapshot(),
      });
    }
    if (videoSkipControlSurfaceQaSessionId !== payload.sessionId) {
      throw new Error('VIDEO_SKIP_CONTROL_SURFACE_QA_SESSION_NOT_OWNED');
    }
    await VideoSkipManager.remove();
    const snapshot = VideoSkipManager.getRuntimeSnapshot();
    if (snapshot.active === true) {
      throw new Error('VIDEO_SKIP_CONTROL_SURFACE_QA_STOP_STATE_INVALID');
    }
    videoSkipControlSurfaceQaSessionId = null;
    return Object.freeze({ stopped: true, snapshot });
  }
  throw new Error('VIDEO_SKIP_CONTROL_SURFACE_QA_CONTENT_ACTION_INVALID');
}

function handleVideoSkipControlSurfaceQaContentMessage(message, sender, sendResponse) {
  if (!isVideoSkipControlSurfaceQaAction(message?.action)) return false;
  let request;
  try {
    requireVideoSkipQaBackgroundSender(sender);
    request = parseVideoSkipControlSurfaceQaRequest(message);
  } catch (error) {
    sendResponse?.({
      success: false,
      error: resolveVideoSkipQaFailureCode(error),
    });
    return false;
  }

  void dispatchVideoSkipControlSurfaceQaContentRequest(request).then(
    (result) => sendResponse?.(createVideoSkipControlSurfaceQaResponse(request, {
      success: true,
      result,
    })),
    (error) => sendResponse?.(createVideoSkipControlSurfaceQaResponse(request, {
      success: false,
      error: resolveVideoSkipQaFailureCode(error),
    })),
  );
  return true;
}

async function dispatchAudioDullingQaContentRequest(request) {
  if (request.action === AUDIO_DULLING_QA_ACTIONS.CONTENT_MOUNT) {
    AudioDullingActivationChip.update({
      audioDulling: {
        isActive: true,
        value: request.payload.config,
      },
    }, {
      domainClassId: 'qa_suikinkutsu',
      revealDelayMs: request.payload.revealDelayMs,
      invitationWindowMs: request.payload.invitationWindowMs,
      invitationTransport: (eventName) => new Promise((resolve, reject) => {
        const action = eventName === 'presented'
          ? AUDIO_DULLING_QA_ACTIONS.INVITATION_PRESENTED
          : eventName === 'arrived'
            ? AUDIO_DULLING_QA_ACTIONS.INVITATION_ARRIVED
          : eventName === 'expired'
            ? AUDIO_DULLING_QA_ACTIONS.INVITATION_EXPIRED
            : null;
        if (!action) {
          reject(new Error('AUDIO_DULLING_QA_INVITATION_EVENT_INVALID'));
          return;
        }
        chrome.runtime.sendMessage({
          channel: request.channel,
          action,
          requestId: `audio-invitation:${eventName}:${request.targetTabId}:${Date.now()}`,
          targetTabId: request.targetTabId,
          payload: {},
        }, (response) => {
          const error = chrome.runtime.lastError?.message || null;
          if (error) {
            reject(new Error(error));
            return;
          }
          resolve(response);
        });
      }),
    });
    return Object.freeze({ mounted: true });
  }
  if (request.action === AUDIO_DULLING_QA_ACTIONS.CONTENT_STATUS) {
    AudioDullingActivationChip.setRuntimeStatus(
      request.payload.status,
      request.payload.detail,
    );
    return Object.freeze({ status: request.payload.status });
  }
  if (request.action === AUDIO_DULLING_QA_ACTIONS.CONTENT_SNAPSHOT) {
    return AudioDullingActivationChip.getInterventionAdmissionDebugSnapshot();
  }
  if (request.action === AUDIO_DULLING_QA_ACTIONS.CONTENT_REMOVE) {
    AudioDullingActivationChip.remove();
    return Object.freeze({ removed: true });
  }
  throw new Error('AUDIO_DULLING_QA_CONTENT_ACTION_INVALID');
}

function handleAudioDullingQaContentMessage(message, sender, sendResponse) {
  if (!isAudioDullingQaAction(message?.action)) return false;
  if (![
    AUDIO_DULLING_QA_ACTIONS.CONTENT_MOUNT,
    AUDIO_DULLING_QA_ACTIONS.CONTENT_STATUS,
    AUDIO_DULLING_QA_ACTIONS.CONTENT_SNAPSHOT,
    AUDIO_DULLING_QA_ACTIONS.CONTENT_REMOVE,
  ].includes(message.action)) {
    return false;
  }

  let request;
  try {
    requireBackgroundSender(sender);
    request = parseAudioDullingQaRequest(message);
  } catch (error) {
    sendResponse?.({
      success: false,
      error: resolveFailureCode(error),
    });
    return false;
  }

  void dispatchAudioDullingQaContentRequest(request).then(
    (result) => sendResponse?.(createAudioDullingQaResponse(request, {
      success: true,
      result,
    })),
    (error) => sendResponse?.(createAudioDullingQaResponse(request, {
      success: false,
      error: resolveFailureCode(error),
    })),
  );
  return true;
}

export function handleBuildCapabilityContentMessage(message, sender, sendResponse) {
  if (handleVideoSkipControlSurfaceQaContentMessage(message, sender, sendResponse)) {
    return true;
  }
  if (handleAudioDullingQaContentMessage(message, sender, sendResponse)) {
    return true;
  }
  return handleRuntimeDebuggerAutomationContentMessage(message, sender, sendResponse);
}

export default handleBuildCapabilityContentMessage;
