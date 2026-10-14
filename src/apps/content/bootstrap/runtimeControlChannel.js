import { runtimeOnMessageAddListener } from '../../../platform/chrome/ChromeService.js';
import { ENTROPY_RUNTIME_BUILD_INFO } from '../../../platform/build/runtimeBuildInfo.js';
import { MESSAGE_TYPES } from '../../../platform/messaging/messageTypes.js';
import {
  CONTENT_RECEIVER_CAPABILITY_VERSION,
} from '../../../platform/messaging/contentReceiverCapability.js';
import { readBootstrapState } from './bootstrapState.js';

export const CONTENT_RUNTIME_CONTROL_FLAG = '__entropyContentRuntimeControlInstalled__';

let contentRuntimeControlListener = null;

function resolveTeardownReason(message) {
  return typeof message?.payload?.reason === 'string' && message.payload.reason.trim()
    ? message.payload.reason.trim()
    : 'runtime_teardown';
}

function createRuntimeProbeResponse() {
  const state = readBootstrapState();
  const url = typeof window !== 'undefined' && typeof window.location?.href === 'string'
    ? window.location.href
    : '';
  return {
    ok: true,
    type: MESSAGE_TYPES.CONTENT_RUNTIME_PROBE,
    buildId: ENTROPY_RUNTIME_BUILD_INFO.buildId,
    state: state && typeof state === 'object'
      ? {
          status: state.status || null,
          attemptId: state.attemptId || null,
          receiverCapabilityVersion:
            state.receiverCapabilityVersion === CONTENT_RECEIVER_CAPABILITY_VERSION
              ? CONTENT_RECEIVER_CAPABILITY_VERSION
              : null,
          dispatchReady: state.dispatchReady === true,
          active: state.active === true,
          startedAt: state.startedAt || null,
          receiverReadyAt: state.receiverReadyAt || null,
          activeAt: state.activeAt || null,
          failedAt: state.failedAt || null,
          error: state.error || null,
          reason: state.reason || null,
          url,
        }
      : null,
  };
}

export function installRuntimeControlChannel(onTeardown = null) {
  if (contentRuntimeControlListener || typeof onTeardown !== 'function') return;
  globalThis[CONTENT_RUNTIME_CONTROL_FLAG] = true;
  if (typeof window !== 'undefined') {
    window[CONTENT_RUNTIME_CONTROL_FLAG] = true;
  }

  contentRuntimeControlListener = (message, _sender, sendResponse) => {
    if (message?.type === MESSAGE_TYPES.CONTENT_RUNTIME_PROBE) {
      sendResponse?.(createRuntimeProbeResponse());
      return false;
    }
    if (message?.type !== MESSAGE_TYPES.CONTENT_RUNTIME_TEARDOWN) return false;
    const { teardownId, attemptId } = message.payload || {};
    const acknowledgement = {
      type: MESSAGE_TYPES.CONTENT_RUNTIME_TEARDOWN,
      teardownId,
      attemptId,
    };
    if (
      typeof teardownId !== 'string' || !teardownId.trim()
      || !Number.isSafeInteger(attemptId) || attemptId < 1
      || readBootstrapState()?.attemptId !== attemptId
    ) {
      sendResponse?.({ ...acknowledgement, ok: false, error: 'CONTENT_RUNTIME_TEARDOWN_IDENTITY_INVALID' });
      return false;
    }
    // Invalidate synchronously inside onTeardown; keep the message port open
    // until every cleanup owner and the stale-state publication have settled.
    (async () => onTeardown({ reason: resolveTeardownReason(message) }))().then(
      () => sendResponse?.({ ...acknowledgement, ok: true }),
      (error) => {
        console.error('[ContentRuntimeControl] teardown failed', acknowledgement, error);
        sendResponse?.({
          ...acknowledgement,
          ok: false,
          error: String(error?.message || error),
        });
      },
    );
    return true;
  };

  runtimeOnMessageAddListener(contentRuntimeControlListener);
}
