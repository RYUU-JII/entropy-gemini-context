import {
  getRuntimeId,
  runtimeSendMessageReliable,
} from '../../../platform/chrome/ChromeService.js';
import { MESSAGE_TYPES } from '../../../platform/messaging/messageTypes.js';
import {
  CONTENT_FLOW_SIGNAL_DELIVERY_TIMEOUT_MS,
  createContentFlowSignal,
} from '../../../platform/messaging/contracts/contentFlowSignal.js';
import { areContentFlowSignalsEnabled } from './contentBehaviorCapabilities.js';
import { formatRuntimeDiagnostic } from '../../../platform/diagnostics/runtimeDiagnosticConsole.js';

export { CONTENT_FLOW_SIGNAL_DELIVERY_TIMEOUT_MS };

export function canSendContentFlowSignals() {
  return areContentFlowSignalsEnabled() && !!getRuntimeId();
}

function reportContentFlowSignalFailure(error, details = {}) {
  console.warn?.(formatRuntimeDiagnostic({
    scope: 'ContentFlowSignal',
    severity: 'warn',
    event: 'delivery_failed',
    code: 'CONTENT_FLOW_SIGNAL_DELIVERY_FAILED',
    error,
    fields: { messageType: MESSAGE_TYPES.CONTENT_FLOW_SIGNAL, ...details },
  }));
}

export async function sendContentFlowSignal(kind, measurement = {}) {
  if (!canSendContentFlowSignals()) return false;
  let signal;
  let phase = 'validation';
  try {
    signal = createContentFlowSignal({
      kind,
      observedAt: Date.now(),
      ...(measurement && typeof measurement === 'object' ? measurement : {}),
    });
    phase = 'transport';
    const delivery = await runtimeSendMessageReliable(
      {
        type: MESSAGE_TYPES.CONTENT_FLOW_SIGNAL,
        signal,
      },
      {
        timeoutMs: CONTENT_FLOW_SIGNAL_DELIVERY_TIMEOUT_MS,
      },
    );
    if (!delivery?.ok) {
      throw new Error(delivery?.error || 'CONTENT_FLOW_SIGNAL_DELIVERY_FAILED');
    }
    phase = 'commit_acknowledgement';
    if (delivery?.response?.success !== true) {
      throw new Error(delivery?.response?.error || 'CONTENT_FLOW_SIGNAL_COMMIT_NOT_ACKNOWLEDGED');
    }
    return delivery.response.recorded === true;
  } catch (error) {
    reportContentFlowSignalFailure(error, {
      kind: signal?.kind || kind || 'unknown',
      phase,
    });
    return false;
  }
}
