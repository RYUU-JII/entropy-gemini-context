import { MESSAGE_TYPES } from '../../../platform/messaging/messageTypes.js';
import {
  isTrustedExtensionTabSender,
  resolveSenderDocumentId,
  resolveSenderFrameId,
  resolveSenderPageUrl,
  resolveTrustedSenderTabId,
} from '../../../platform/security/senderTrust.js';

const CANONICAL_BOOTSTRAP_STATES = new Set([
  'active',
  'bootstrapping',
  'failed',
  'receiver_ready',
  'stale',
]);

function requireOwnerMethod(owner, methodName, errorCode) {
  if (!owner || typeof owner[methodName] !== 'function') {
    throw new Error(errorCode);
  }
  return owner[methodName].bind(owner);
}

function normalizeWebUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
      ? parsed.href
      : null;
  } catch (_error) {
    return null;
  }
}

function normalizePositiveSafeInteger(value) {
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function resolveHostname(url) {
  try {
    return new URL(url).hostname.toLowerCase() || null;
  } catch (_error) {
    return null;
  }
}

function normalizeDiagnosticErrorCode(value, fallback = 'CONTENT_BOOTSTRAP_STATE_FAILED') {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return /^[A-Z][A-Z0-9_]*(?::[A-Z0-9_]+)*$/.test(normalized)
    ? normalized
    : fallback;
}

function validateCanonicalBootstrapMessage(request, sender) {
  if (!isTrustedExtensionTabSender(sender)) {
    throw new Error('CONTENT_BOOTSTRAP_TRUSTED_TAB_SENDER_REQUIRED');
  }
  const tabId = resolveTrustedSenderTabId(sender);
  if (tabId === null) throw new Error('CONTENT_BOOTSTRAP_TAB_ID_REQUIRED');
  const frameId = resolveSenderFrameId(sender);
  if (frameId === null) throw new Error('CONTENT_BOOTSTRAP_FRAME_ID_REQUIRED');
  if (frameId !== 0) throw new Error('CONTENT_BOOTSTRAP_TOP_FRAME_REQUIRED');
  const documentId = resolveSenderDocumentId(sender);
  if (!documentId) throw new Error('CONTENT_BOOTSTRAP_DOCUMENT_ID_REQUIRED');
  const senderUrl = normalizeWebUrl(resolveSenderPageUrl(sender));
  if (!senderUrl) throw new Error('CONTENT_BOOTSTRAP_SENDER_URL_REQUIRED');

  const payload = request?.payload;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('CONTENT_BOOTSTRAP_PAYLOAD_REQUIRED');
  }
  const status = typeof payload.status === 'string' ? payload.status.trim().toLowerCase() : '';
  if (!CANONICAL_BOOTSTRAP_STATES.has(status) || payload.status !== status) {
    throw new Error('CONTENT_BOOTSTRAP_STATUS_INVALID');
  }
  const payloadUrl = normalizeWebUrl(payload.url);
  if (!payloadUrl) throw new Error('CONTENT_BOOTSTRAP_PAYLOAD_URL_REQUIRED');
  if (payloadUrl !== senderUrl) throw new Error('CONTENT_BOOTSTRAP_URL_MISMATCH');
  const payloadDocumentId = typeof payload.documentId === 'string'
    ? payload.documentId.trim()
    : null;
  if (payloadDocumentId && payloadDocumentId !== documentId) {
    throw new Error('CONTENT_BOOTSTRAP_DOCUMENT_ID_MISMATCH');
  }
  const attemptId = normalizePositiveSafeInteger(payload.attemptId);
  const startedAt = normalizePositiveSafeInteger(payload.startedAt);
  if (status === 'receiver_ready' || status === 'active') {
    if (attemptId === null) throw new Error('CONTENT_BOOTSTRAP_ATTEMPT_ID_REQUIRED');
    if (startedAt === null) throw new Error('CONTENT_BOOTSTRAP_STARTED_AT_REQUIRED');
  }

  return Object.freeze({
    tabId,
    frameId,
    documentId,
    url: senderUrl,
    status,
    attemptId,
    startedAt,
    reason: typeof payload.reason === 'string' && payload.reason.trim()
      ? payload.reason.trim()
      : null,
    request: {
      ...request,
      payload: {
        ...payload,
        status,
        documentId,
        attemptId,
        startedAt,
        url: senderUrl,
      },
    },
  });
}

export function createTrackingContentRuntimeHandlers({
  contentScriptOrchestrator,
  contentRuntimeDiagnostics,
  contentProtectionSync,
} = {}) {
  const noteContentBootstrapState = requireOwnerMethod(
    contentScriptOrchestrator,
    'noteContentBootstrapState',
    'CONTENT_BOOTSTRAP_STATE_OWNER_REQUIRED',
  );
  const noteContentMediaFrameState = requireOwnerMethod(
    contentScriptOrchestrator,
    'noteContentMediaFrameState',
    'CONTENT_MEDIA_FRAME_STATE_OWNER_REQUIRED',
  );
  const recordDiagnostic = requireOwnerMethod(
    contentRuntimeDiagnostics,
    'record',
    'CONTENT_BOOTSTRAP_PROTECTION_DIAGNOSTICS_OWNER_REQUIRED',
  );
  const protectionSync = contentProtectionSync;
  ['createPlan', 'reserve', 'start'].forEach((methodName) => {
    if (typeof protectionSync?.[methodName] !== 'function') {
      throw new Error(`CONTENT_BOOTSTRAP_PROTECTION_SYNC_OWNER_REQUIRED:${methodName}`);
    }
  });

  function recordRejectedBootstrap(error, sender) {
    const senderUrl = normalizeWebUrl(resolveSenderPageUrl(sender));
    try {
      recordDiagnostic('bootstrap_message_rejected', {
        tabId: resolveTrustedSenderTabId(sender),
        documentId: resolveSenderDocumentId(sender),
        frameId: resolveSenderFrameId(sender),
        hostname: resolveHostname(senderUrl),
        errorCode: normalizeDiagnosticErrorCode(error?.code || error?.message),
      });
    } catch (diagnosticError) {
      console.error('[TrackingContentRuntime] Bootstrap rejection diagnostic failed.', {
        code: 'CONTENT_BOOTSTRAP_REJECTION_DIAGNOSTIC_FAILED',
      });
    }
  }

  return {
    [MESSAGE_TYPES.CONTENT_BOOTSTRAP_STATE]: (request, sender, sendResponse) => {
      Promise.resolve()
        .then(() => {
          const context = validateCanonicalBootstrapMessage(request, sender);
          const session = noteContentBootstrapState(context.request, sender);
          const reservation = protectionSync.reserve(protectionSync.createPlan(context, session));
          return {
            response: {
              success: !!session,
              session,
            },
            reservation,
          };
        })
        .then(({ response, reservation }) => {
          try {
            sendResponse(response);
          } finally {
            protectionSync.start(reservation);
          }
        })
        .catch((error) => {
          recordRejectedBootstrap(error, sender);
          sendResponse({ success: false, error: error?.message || 'CONTENT_BOOTSTRAP_STATE_FAILED' });
        });

      return true;
    },
    [MESSAGE_TYPES.CONTENT_MEDIA_FRAME_STATE]: (request, sender, sendResponse) => {
      Promise.resolve()
        .then(() => {
          const session = noteContentMediaFrameState(request, sender);
          return {
            success: !!session,
            session,
          };
        })
        .then((payload) => sendResponse(payload))
        .catch((error) => {
          sendResponse({ success: false, error: error?.message || 'CONTENT_MEDIA_FRAME_STATE_FAILED' });
        });

      return true;
    },
  };
}
