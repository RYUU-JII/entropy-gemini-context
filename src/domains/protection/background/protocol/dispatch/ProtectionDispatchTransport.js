import {
  buildExactOriginPatternForUrl,
  getHostname,
} from '../../../../../lib/index.js';
import {
  requireContentReceiverCapability,
} from '../../../../../platform/messaging/contentReceiverCapability.js';

const PROTECTION_DISPATCHER_BROWSER_PORT_METHODS = Object.freeze([
  'getUILanguage',
  'permissionsContains',
  'runtimeGetURL',
  'tabsGet',
  'tabsQuery',
  'tabsSendMessage',
  'windowsGetLastFocused',
]);

const issuedDispatchDocumentIdentityErrors = new WeakSet();

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function hasOwnProperty(value, key) {
  return !!value && Object.prototype.hasOwnProperty.call(value, key);
}

function normalizeReason(reason, fallback = 'unspecified') {
  return typeof reason === 'string' && reason.trim() ? reason.trim() : fallback;
}

function isReceiverMissingError(error) {
  const message = String(error?.message || error || '');
  return message.includes('Receiving end does not exist')
    || message.includes('Could not establish connection');
}

function toDispatchError(error, fallbackCode) {
  if (error instanceof Error) return error;
  return new Error(toErrorMessage(error || fallbackCode));
}

function requireContentScriptReadyResult(result, phase, {
  requireReceiverCapability = false,
} = {}) {
  if (!isPlainObject(result) || typeof result.ok !== 'boolean') {
    throw new Error(`PROTECTION_DISPATCH_CONTENT_READY_RESULT_INVALID:${phase}`);
  }
  if (
    result.ok === false
    && !result.error
    && (typeof result.reason !== 'string' || !result.reason.trim())
  ) {
    throw new Error(`PROTECTION_DISPATCH_CONTENT_READY_FAILURE_INVALID:${phase}`);
  }
  if (result.ok === true && requireReceiverCapability) {
    requireContentReceiverCapability(result.receiverCapability);
  }
  return result;
}

function requirePrevalidatedDispatchAdmission(value, {
  expectedDocumentId,
  expectedUrl,
} = {}) {
  if (value === null || typeof value === 'undefined') return null;
  const keys = isPlainObject(value) ? Object.keys(value).sort() : [];
  if (
    !isPlainObject(value)
    || !Object.isFrozen(value)
    || keys.length !== 2
    || keys[0] !== 'documentId'
    || keys[1] !== 'url'
    || typeof value.documentId !== 'string'
    || !value.documentId
    || value.documentId !== value.documentId.trim()
    || value.documentId !== expectedDocumentId
    || resolveExactHistoryProofUrl(value.url) !== expectedUrl
  ) {
    throw createDispatchDocumentIdentityError(
      'prevalidated_admission',
      'contract_invalid',
    );
  }
  return value;
}

function createDispatchDocumentIdentityError(phase, reason, details = {}) {
  const error = new Error(`PROTECTION_DISPATCH_DOCUMENT_IDENTITY_INVALID:${phase}:${reason}`);
  error.code = 'PROTECTION_DISPATCH_DOCUMENT_IDENTITY_INVALID';
  error.phase = phase;
  error.reason = reason;
  Object.assign(error, details);
  issuedDispatchDocumentIdentityErrors.add(error);
  return error;
}

export function isProtectionDispatchDocumentIdentityError(value) {
  return value instanceof Error && issuedDispatchDocumentIdentityErrors.has(value);
}

export function isProvenProtectionDispatchDocumentOvertaken(error, {
  tabId = null,
  expectedDocumentId = null,
} = {}) {
  const errorCode = typeof error?.code === 'string' ? error.code : '';
  const isIdentityMismatch = errorCode === 'PROTECTION_DISPATCH_DOCUMENT_IDENTITY_INVALID'
    && error?.reason === 'expected_document_mismatch';
  if (!isIdentityMismatch && ![
    'PROTECTION_DISPATCH_EXPECTED_DOCUMENT_STALE',
    'PROTECTION_DISPATCH_ADMISSION_DOCUMENT_MISMATCH',
    'PROTECTION_DISPATCH_TRANSACTION_DOCUMENT_MISMATCH',
  ].includes(errorCode)) {
    return false;
  }
  if (!Number.isSafeInteger(error?.tabId) || error.tabId < 0) return false;
  const rawExpected = typeof error?.expectedDocumentId === 'string'
    ? error.expectedDocumentId
    : '';
  const rawCurrent = typeof error?.currentDocumentId === 'string'
    ? error.currentDocumentId
    : '';
  if (
    !rawExpected
    || !rawCurrent
    || rawExpected !== rawExpected.trim()
    || rawCurrent !== rawCurrent.trim()
    || rawExpected === rawCurrent
  ) {
    return false;
  }
  const expected = rawExpected;
  const current = rawCurrent;
  if (expectedDocumentId !== null && expected !== expectedDocumentId) return false;
  if (tabId !== null && error?.tabId !== tabId) return false;
  return true;
}

function resolveExactHistoryProofUrl(value) {
  if (typeof value !== 'string' || !value || value !== value.trim()) return null;
  try {
    const parsed = new URL(value);
    if (
      (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
      || parsed.href !== value
    ) {
      return null;
    }
    return parsed.href;
  } catch (_error) {
    return null;
  }
}

export function isProvenProtectionDispatchHistoryContextOvertaken(error, {
  tabId = null,
  requestedUrl = null,
  observedAt = null,
  ingressSequence = null,
  status = null,
} = {}) {
  if (
    error?.code !== 'PROTECTION_DISPATCH_ADMISSION_CONTEXT_MISMATCH'
    || error?.reason !== 'same_document_history_overtaken'
    || !Number.isSafeInteger(error?.tabId)
    || error.tabId < 0
    || !Number.isSafeInteger(error?.historyGeneration)
    || error.historyGeneration <= 0
    || !Number.isSafeInteger(error?.historyInvalidationTag)
    || error.historyInvalidationTag !== error.historyGeneration
    || !Number.isSafeInteger(error?.historyObservedAt)
    || error.historyObservedAt < 0
    || !Number.isSafeInteger(error?.historyIngressSequence)
    || error.historyIngressSequence <= 0
    || !Number.isSafeInteger(observedAt)
    || observedAt < 0
    || !Number.isSafeInteger(ingressSequence)
    || ingressSequence <= error.historyIngressSequence
    || status !== 'complete'
  ) {
    return false;
  }
  if (tabId !== null && error.tabId !== tabId) return false;

  const eventRequestedUrl = resolveExactHistoryProofUrl(requestedUrl);
  const errorRequestedUrl = resolveExactHistoryProofUrl(error.requestedUrl);
  const sessionUrl = resolveExactHistoryProofUrl(error.sessionUrl);
  const historyPreviousUrl = resolveExactHistoryProofUrl(error.historyPreviousUrl);
  const historyCurrentUrl = resolveExactHistoryProofUrl(error.historyCurrentUrl);
  if (
    !eventRequestedUrl
    || eventRequestedUrl !== errorRequestedUrl
    || errorRequestedUrl !== historyPreviousUrl
    || !sessionUrl
    || sessionUrl !== historyCurrentUrl
    || historyPreviousUrl === historyCurrentUrl
  ) {
    return false;
  }

  const historyDocumentId = typeof error.historyDocumentId === 'string'
    ? error.historyDocumentId
    : '';
  const currentDocumentId = typeof error.currentDocumentId === 'string'
    ? error.currentDocumentId
    : '';
  return !!historyDocumentId
    && historyDocumentId === historyDocumentId.trim()
    && currentDocumentId === historyDocumentId;
}

export function isProvenProtectionDispatchHistoryOvertookPendingTabUpdate(error, {
  tabId = null,
  requestedUrl = null,
  ingressSequence = null,
  status = null,
} = {}) {
  if (
    error?.code !== 'PROTECTION_DISPATCH_ADMISSION_CONTEXT_MISMATCH'
    || error?.reason !== 'same_document_history_overtaken'
    || !Number.isSafeInteger(error?.tabId)
    || error.tabId < 0
    || !Number.isSafeInteger(error?.historyGeneration)
    || error.historyGeneration <= 0
    || !Number.isSafeInteger(error?.historyInvalidationTag)
    || error.historyInvalidationTag !== error.historyGeneration
    || !Number.isSafeInteger(error?.historyObservedAt)
    || error.historyObservedAt < 0
    || !Number.isSafeInteger(error?.historyIngressSequence)
    || error.historyIngressSequence <= 0
    || !Number.isSafeInteger(ingressSequence)
    || ingressSequence >= error.historyIngressSequence
    || status !== 'complete'
  ) {
    return false;
  }
  if (tabId !== null && error.tabId !== tabId) return false;

  const eventRequestedUrl = resolveExactHistoryProofUrl(requestedUrl);
  const errorRequestedUrl = resolveExactHistoryProofUrl(error.requestedUrl);
  const sessionUrl = resolveExactHistoryProofUrl(error.sessionUrl);
  const historyPreviousUrl = resolveExactHistoryProofUrl(error.historyPreviousUrl);
  const historyCurrentUrl = resolveExactHistoryProofUrl(error.historyCurrentUrl);
  if (
    !eventRequestedUrl
    || eventRequestedUrl !== errorRequestedUrl
    || errorRequestedUrl !== historyPreviousUrl
    || !sessionUrl
    || sessionUrl !== historyCurrentUrl
    || historyPreviousUrl === historyCurrentUrl
  ) {
    return false;
  }
  const historyDocumentId = typeof error.historyDocumentId === 'string'
    ? error.historyDocumentId
    : '';
  const currentDocumentId = typeof error.currentDocumentId === 'string'
    ? error.currentDocumentId
    : '';
  return !!historyDocumentId
    && historyDocumentId === historyDocumentId.trim()
    && currentDocumentId === historyDocumentId;
}

export function isProvenProtectionDispatchPreAckHistoryCancellation(error, {
  tabId = null,
  requestedUrl = null,
  ingressSequence = null,
  status = null,
} = {}) {
  if (
    error?.code !== 'PROTECTION_DISPATCH_HISTORY_PRE_ACK_CANCELED'
    || error?.reason !== 'same_document_history_overtaken_pre_ack'
    || error?.causeCode !== 'PROTECTION_DISPATCH_SERIAL_QUEUE_INVALIDATED'
    || error?.queueReason !== 'web_navigation_history_state_updated'
    || error?.phase !== 'gate_mutation:gate_bridge_after_theme_resolution'
    || error?.ensureSource !== 'session_dispatch_ready'
    || error?.gatePresentationDisposition !== 'not_started'
    || error?.contentDeliveryDisposition !== 'not_started'
    || error?.ackDisposition !== 'not_observed'
    || !Number.isSafeInteger(error?.tabId)
    || error.tabId < 0
    || !Number.isSafeInteger(error?.historyGeneration)
    || error.historyGeneration <= 0
    || !Number.isSafeInteger(error?.historyInvalidationTag)
    || error.historyInvalidationTag !== error.historyGeneration
    || !Number.isSafeInteger(error?.historyIngressSequence)
    || error.historyIngressSequence <= 0
    || !Number.isSafeInteger(error?.historyObservedAt)
    || error.historyObservedAt < 0
    || !Number.isSafeInteger(ingressSequence)
    || ingressSequence >= error.historyIngressSequence
    || status !== 'complete'
  ) {
    return false;
  }
  if (
    error?.cause?.code !== 'PROTECTION_DISPATCH_SERIAL_QUEUE_INVALIDATED'
    || error.cause.reason !== 'web_navigation_history_state_updated'
    || error.cause.tabId !== error.tabId
    || error.cause.phase !== error.phase
    || error.cause.invalidationTag !== error.historyInvalidationTag
  ) {
    return false;
  }
  if (tabId !== null && error.tabId !== tabId) return false;

  const eventRequestedUrl = resolveExactHistoryProofUrl(requestedUrl);
  const errorRequestedUrl = resolveExactHistoryProofUrl(error.requestedUrl);
  const sessionUrl = resolveExactHistoryProofUrl(error.sessionUrl);
  const historyPreviousUrl = resolveExactHistoryProofUrl(error.historyPreviousUrl);
  const historyCurrentUrl = resolveExactHistoryProofUrl(error.historyCurrentUrl);
  if (
    !eventRequestedUrl
    || eventRequestedUrl !== errorRequestedUrl
    || errorRequestedUrl !== historyPreviousUrl
    || !sessionUrl
    || sessionUrl !== historyCurrentUrl
    || historyPreviousUrl === historyCurrentUrl
  ) {
    return false;
  }
  const historyDocumentId = typeof error.historyDocumentId === 'string'
    ? error.historyDocumentId
    : '';
  const transactionDocumentId = typeof error.transactionDocumentId === 'string'
    ? error.transactionDocumentId
    : '';
  const currentDocumentId = typeof error.currentDocumentId === 'string'
    ? error.currentDocumentId
    : '';
  return !!historyDocumentId
    && historyDocumentId === historyDocumentId.trim()
    && transactionDocumentId === historyDocumentId
    && currentDocumentId === historyDocumentId;
}

export function requireExpectedContentDocumentId(value) {
  if (value === null || typeof value === 'undefined') return null;
  if (typeof value !== 'string' || !value.trim() || value !== value.trim()) {
    throw createDispatchDocumentIdentityError('expected', 'document_id_invalid');
  }
  return value;
}

export function requireProtectionDispatchAbortSignal(value) {
  if (value === null || typeof value === 'undefined') return null;
  if (
    typeof value !== 'object'
    || typeof value.aborted !== 'boolean'
    || typeof value.addEventListener !== 'function'
    || typeof value.removeEventListener !== 'function'
  ) {
    throw new Error('PROTECTION_DISPATCH_ABORT_SIGNAL_INVALID');
  }
  return value;
}

export function throwIfProtectionDispatchAborted(signal, phase) {
  if (!signal?.aborted) return;
  const error = new Error(`PROTECTION_DISPATCH_ABORTED:${phase}`);
  error.code = 'PROTECTION_DISPATCH_ABORTED';
  error.phase = phase;
  throw error;
}

function requireReadyContentDocumentId(
  orchestrator,
  tabId,
  phase,
  expectedDocumentId = null,
) {
  const session = orchestrator.getTabSession(tabId) || null;
  if (!isDispatchReadyContentSession(session)) {
    throw createDispatchDocumentIdentityError(phase, 'session_not_ready');
  }
  if (typeof session.documentId !== 'string' || !session.documentId.trim()) {
    throw createDispatchDocumentIdentityError(phase, 'document_id_missing');
  }
  if (session.documentId !== session.documentId.trim()) {
    throw createDispatchDocumentIdentityError(phase, 'document_id_invalid');
  }
  const documentId = session.documentId;
  if (expectedDocumentId !== null && documentId !== expectedDocumentId) {
    throw createDispatchDocumentIdentityError(phase, 'expected_document_mismatch', {
      tabId,
      expectedDocumentId,
      currentDocumentId: documentId,
    });
  }
  return documentId;
}

function sendTabMessage(browserPort, tabId, message, dispatchDocumentId) {
  if (dispatchDocumentId === null) {
    return browserPort.tabsSendMessage(tabId, message);
  }
  return browserPort.tabsSendMessage(tabId, message, {
    frameId: 0,
    documentId: dispatchDocumentId,
  });
}

function shouldRejectExpectedDocumentFailure(error, expectedDocumentId) {
  if (expectedDocumentId === null) return false;
  return error?.code === 'PROTECTION_DISPATCH_DOCUMENT_IDENTITY_INVALID'
    || error?.code === 'PROTECTION_DISPATCH_ABORTED';
}

function enforcePostSendAbort(signal, phase) {
  throwIfProtectionDispatchAborted(signal, phase);
}

export function isWebUrl(url) {
  return typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'));
}

export function resolveProtectionDispatcherBrowserPort(browserPort) {
  const missingMethod = PROTECTION_DISPATCHER_BROWSER_PORT_METHODS.find((methodName) => (
    typeof browserPort?.[methodName] !== 'function'
  ));
  if (missingMethod || !Number.isFinite(Number(browserPort?.windowIdNone))) {
    throw new Error('PROTECTION_DISPATCHER_BROWSER_PORT_REQUIRED');
  }
  return browserPort;
}

export function toErrorMessage(error) {
  return String(error?.message || error || 'UNKNOWN_ERROR');
}

export function normalizeTabsSendMessageResult(result) {
  if (
    !isPlainObject(result)
    || Object.keys(result).length !== 2
    || !hasOwnProperty(result, 'response')
    || !hasOwnProperty(result, 'error')
  ) {
    throw new Error('PROTECTION_DISPATCH_TRANSPORT_RESULT_INVALID');
  }

  const response = result.response;
  const transportError = result.error;
  if (transportError) {
    return {
      ok: false,
      reason: 'content_delivery_error',
      error: transportError,
      response: response ?? null,
    };
  }

  if (response !== null && typeof response !== 'undefined') {
    if (!isPlainObject(response) || typeof response.ok !== 'boolean') {
      throw new Error('PROTECTION_DISPATCH_CONTENT_RESPONSE_INVALID');
    }
    if (response.ok === false) {
      return {
        ok: false,
        reason: 'content_response_not_ok',
        error: response.error || 'CONTENT_RESPONSE_NOT_OK',
        response,
      };
    }
  }

  return { ok: true, response: response ?? null, error: null };
}

export function isDispatchReadyContentSession(session) {
  return session?.status === 'receiver_ready' || session?.status === 'active';
}

export async function ensureProtectionDispatchTransactionReady(
  tabId,
  contentScriptOrchestrator,
  {
    url = '',
    reason = 'protection_dispatch_transaction',
    expectedDocumentId = null,
    abortSignal = null,
    propagationContext = null,
  } = {},
) {
  const expectedDispatchDocumentId = requireExpectedContentDocumentId(expectedDocumentId);
  const dispatchAbortSignal = requireProtectionDispatchAbortSignal(abortSignal);
  throwIfProtectionDispatchAborted(dispatchAbortSignal, 'transaction_before_ready');
  const ensureResult = requireContentScriptReadyResult(
    await contentScriptOrchestrator.ensureContentScriptReady(tabId, { url, reason,
      ...(propagationContext ? { propagationContext } : {}) }),
    'transaction',
  );
  throwIfProtectionDispatchAborted(dispatchAbortSignal, 'transaction_after_ready');
  if (!ensureResult.ok) {
    const error = ensureResult.error instanceof Error
      ? ensureResult.error
      : new Error(String(
        ensureResult.error
        || ensureResult.reason
        || 'PROTECTION_DISPATCH_TRANSACTION_CONTENT_NOT_READY',
      ));
    error.code ||= 'PROTECTION_DISPATCH_TRANSACTION_CONTENT_NOT_READY';
    error.reason ||= ensureResult.reason || null;
    throw error;
  }
  const documentId = requireReadyContentDocumentId(
    contentScriptOrchestrator,
    tabId,
    'transaction',
    expectedDispatchDocumentId,
  );
  return Object.freeze({
    documentId,
    ensureSource: ensureResult.source || null,
  });
}

export function formatDispatchDiagnostic(diagnostic) {
  if (!diagnostic || typeof diagnostic !== 'object') return '';
  const bootstrapState = diagnostic.contentBootstrapState
    ? JSON.stringify(diagnostic.contentBootstrapState)
    : null;
  const fields = [
    `reason=${diagnostic.reason || 'receiver_missing'}`,
    `injected=${diagnostic.injected === true ? 'yes' : 'no'}`,
    `tabFound=${diagnostic.tabFound === true ? 'yes' : 'no'}`,
    `tabStatus=${diagnostic.tabStatus || 'unknown'}`,
    `url=${diagnostic.url || 'n/a'}`,
    `isWebUrl=${diagnostic.isWebUrl === true ? 'yes' : 'no'}`,
    `host=${diagnostic.hostname || 'n/a'}`,
    `scriptingPerm=${diagnostic.hasScriptingPermission === null ? 'unknown' : (diagnostic.hasScriptingPermission ? 'yes' : 'no')}`,
    `hostPerm=${diagnostic.hasHostPermission === null ? 'unknown' : (diagnostic.hasHostPermission ? 'yes' : 'no')}`,
  ];
  if (diagnostic.injectError) fields.push(`injectError=${diagnostic.injectError}`);
  if (diagnostic.scriptingPermissionLookupError) {
    fields.push(`scriptingPermError=${diagnostic.scriptingPermissionLookupError}`);
  }
  if (diagnostic.hostPermissionLookupError) {
    fields.push(`hostPermError=${diagnostic.hostPermissionLookupError}`);
  }
  if (Array.isArray(diagnostic.injectFiles) && diagnostic.injectFiles.length > 0) {
    fields.push(`injectFiles=${diagnostic.injectFiles.join(',')}`);
  }
  if (bootstrapState) fields.push(`bootstrap=${bootstrapState}`);
  return fields.join(' | ');
}

export async function permissionsContainsSafe(request, browserPort, { onError } = {}) {
  try {
    return await browserPort.permissionsContains(request);
  } catch (error) {
    if (typeof onError === 'function') {
      onError(error);
    }
    return null;
  }
}

async function buildReceiverMissingDiagnostic(
  tabId,
  error,
  {
    browserPort,
    bootstrapState = null,
    ensureResult = null,
  } = {},
) {
  const diagnostic = {
    reason: 'receiver_missing',
    tabId,
    error: toErrorMessage(error),
    tabFound: false,
    tabStatus: null,
    url: null,
    isWebUrl: false,
    hostname: null,
    hasScriptingPermission: null,
    hasHostPermission: null,
    contentBootstrapState: bootstrapState && typeof bootstrapState === 'object'
      ? bootstrapState
      : null,
  };

  try {
    const tab = await browserPort.tabsGet(tabId);
    if (!tab) return diagnostic;

    diagnostic.tabFound = true;
    diagnostic.tabStatus = tab.status || null;
    diagnostic.url = tab.url || null;
    diagnostic.isWebUrl = isWebUrl(tab.url);

    if (diagnostic.isWebUrl) {
      diagnostic.hostname = getHostname(tab.url) || null;
    }
  } catch (tabError) {
    diagnostic.tabLookupError = toErrorMessage(tabError);
    return diagnostic;
  }

  diagnostic.hasScriptingPermission = await permissionsContainsSafe(
    { permissions: ['scripting'] },
    browserPort,
    {
      onError: (permissionError) => {
        diagnostic.scriptingPermissionLookupError = toErrorMessage(permissionError);
      },
    },
  );

  if (diagnostic.hostname) {
    const originPattern = buildExactOriginPatternForUrl(diagnostic.url);
    if (originPattern) {
      diagnostic.hasHostPermission = await permissionsContainsSafe(
        { origins: [originPattern] },
        browserPort,
        {
          onError: (permissionError) => {
            diagnostic.hostPermissionLookupError = toErrorMessage(permissionError);
          },
        },
      );
    }
  }

  if (!diagnostic.tabFound) {
    diagnostic.reason = 'tab_not_found_or_closed';
  } else if (!diagnostic.isWebUrl) {
    diagnostic.reason = 'unsupported_url_scheme';
  } else if (diagnostic.hasScriptingPermission === false) {
    diagnostic.reason = 'missing_scripting_permission';
  } else if (diagnostic.hasHostPermission === false) {
    diagnostic.reason = 'missing_host_permission';
  } else if (ensureResult?.reason === 'inject_failed') {
    diagnostic.reason = 'inject_failed';
  } else if (ensureResult?.reason === 'dispatch_ready_timeout') {
    diagnostic.reason = 'content_dispatch_ready_timeout';
  } else if (diagnostic.contentBootstrapState?.status === 'bootstrapping') {
    diagnostic.reason = 'receiver_missing_during_bootstrap';
  } else if (diagnostic.contentBootstrapState?.status === 'failed') {
    diagnostic.reason = 'content_bootstrap_failed';
  } else if (diagnostic.contentBootstrapState?.status === 'receiver_ready') {
    diagnostic.reason = 'receiver_missing_after_dispatch_ready';
  } else if (diagnostic.contentBootstrapState?.status === 'active') {
    diagnostic.reason = 'receiver_missing_after_active';
  }

  return diagnostic;
}

export async function sendMessageWithRecovery(
  tabId,
  message,
  contentScriptOrchestrator,
  {
    url = '',
    reason = 'dispatch',
    recordDiagnostic = null,
    browserPort,
    bindToReadyDocument = false,
    expectedDocumentId = null,
    prevalidatedAdmission = null,
    abortSignal = null,
    propagationContext = null,
    contentMutationFence = null,
  } = {},
) {
  const orchestrator = contentScriptOrchestrator;
  if (contentMutationFence !== null && typeof contentMutationFence?.assertCurrent !== 'function') {
    throw new Error('PROTECTION_DISPATCH_CONTENT_MUTATION_FENCE_INVALID');
  }
  contentMutationFence?.assertCurrent('transport_before_ready');
  const expectedDispatchDocumentId = requireExpectedContentDocumentId(expectedDocumentId);
  const dispatchAbortSignal = requireProtectionDispatchAbortSignal(abortSignal);
  const admittedReadyDocument = requirePrevalidatedDispatchAdmission(
    prevalidatedAdmission,
    {
      expectedDocumentId: expectedDispatchDocumentId,
      expectedUrl: url,
    },
  );
  if (expectedDispatchDocumentId !== null && bindToReadyDocument !== true) {
    throw createDispatchDocumentIdentityError('expected', 'document_binding_required');
  }
  throwIfProtectionDispatchAborted(dispatchAbortSignal, 'before_ready');
  const messageType = typeof message?.type === 'string' ? message.type : null;
  const route = normalizeReason(reason, 'dispatch');
  const noteDiagnostic = (event, payload = {}) => {
    if (typeof recordDiagnostic !== 'function') return null;
    return recordDiagnostic(event, {
      tabId,
      url,
      route,
      messageType,
      ...payload,
    });
  };

  let ensureResult = null;
  if (admittedReadyDocument) {
    const currentSession = orchestrator.getTabSession(tabId) || null;
    if (
      !isDispatchReadyContentSession(currentSession)
      || currentSession.documentId !== admittedReadyDocument.documentId
      || resolveExactHistoryProofUrl(currentSession.url) !== admittedReadyDocument.url
    ) {
      throw createDispatchDocumentIdentityError(
        'prevalidated_admission',
        'current_session_mismatch',
        {
          tabId,
          expectedDocumentId: admittedReadyDocument.documentId,
          currentDocumentId: typeof currentSession?.documentId === 'string'
            ? currentSession.documentId
            : null,
        },
      );
    }
    ensureResult = Object.freeze({
      ok: true,
      source: 'transaction_dispatch_ready',
    });
  } else {
    ensureResult = await orchestrator.ensureContentScriptReady(tabId, {
      url,
      reason,
      ...(propagationContext ? { propagationContext } : {}),
    });
  }
  throwIfProtectionDispatchAborted(dispatchAbortSignal, 'after_ready');
  contentMutationFence?.assertCurrent('transport_after_ready');
  const readyResult = requireContentScriptReadyResult(ensureResult, 'initial');
  noteDiagnostic('dispatch_attempt', {
    ensureSource: readyResult.source || null,
    recovery: false,
  });

  if (!readyResult.ok) {
    const bootstrapState = orchestrator.getTabSession(tabId) || null;
    const diagnostic = await buildReceiverMissingDiagnostic(
      tabId,
      readyResult.error || readyResult.reason,
      {
        browserPort,
        bootstrapState,
        ensureResult: readyResult,
      },
    );
    noteDiagnostic('dispatch_failed', {
      diagnosticReason: diagnostic?.reason || readyResult.reason,
      ensureSource: readyResult.source || null,
      error: toErrorMessage(readyResult.error || readyResult.reason),
      recovery: false,
    });
    return {
      ok: false,
      error: readyResult.error || new Error(String(readyResult.reason)),
      diagnostic,
    };
  }

  let dispatchDocumentId = null;
  try {
    dispatchDocumentId = bindToReadyDocument
      ? requireReadyContentDocumentId(
        orchestrator,
        tabId,
        'initial',
        expectedDispatchDocumentId,
      )
      : null;
    const response = await sendTabMessage(
      browserPort,
      tabId,
      message,
      dispatchDocumentId,
    );
    const delivery = normalizeTabsSendMessageResult(response);
    enforcePostSendAbort(
      dispatchAbortSignal,
      'after_initial_send',
      messageType,
      delivery,
    );
    if (!delivery.ok) {
      const deliveryError = toDispatchError(delivery.error, 'CONTENT_RESPONSE_NOT_OK');
      if (isReceiverMissingError(deliveryError)) throw deliveryError;
      noteDiagnostic('dispatch_failed', {
        diagnosticReason: delivery.reason || 'content_response_not_ok',
        ensureSource: readyResult.source || null,
        error: toErrorMessage(deliveryError),
        recovery: false,
      });
      return {
        ok: false,
        error: deliveryError,
        response: delivery.response,
        dispatchDocumentId,
      };
    }
    noteDiagnostic('dispatch_succeeded', {
      ensureSource: readyResult.source || null,
      delivery: 'direct',
      recovery: false,
    });
    return {
      ok: true,
      ensureSource: readyResult.source || null,
      delivery: 'direct',
      response: delivery.response,
      dispatchDocumentId,
    };
  } catch (error) {
    if (!isReceiverMissingError(error)) {
      if (shouldRejectExpectedDocumentFailure(error, expectedDispatchDocumentId)) {
        throw error;
      }
      const diagnosticReason = error?.code === 'PROTECTION_DISPATCH_DOCUMENT_IDENTITY_INVALID'
        ? 'content_document_identity_invalid'
        : error?.code === 'PROTECTION_DISPATCH_ABORTED'
          ? 'dispatch_aborted'
          : 'send_message_error';
      noteDiagnostic('dispatch_failed', {
        diagnosticReason,
        ensureSource: readyResult.source || null,
        error: toErrorMessage(error),
        recovery: false,
      });
      return {
        ok: false,
        error,
        dispatchDocumentId,
        diagnostic: {
          reason: diagnosticReason,
        },
      };
    }

    // A late missing-receiver response cannot authorize a new injection after
    // the caller's permission/document execution authority was revoked.
    contentMutationFence?.assertCurrent('transport_before_recovery');
    throwIfProtectionDispatchAborted(dispatchAbortSignal, 'before_recovery');
    noteDiagnostic('dispatch_receiver_missing', {
      ensureSource: readyResult.source || null,
      error: toErrorMessage(error),
    });
    orchestrator.markTabNavigated(tabId, {
      url,
      reason: `${reason}:receiver_missing`,
    });

    const retryEnsure = await orchestrator.ensureContentScriptReady(tabId, {
      url,
      reason: `${reason}:receiver_missing`,
      forceInject: true,
      ...(propagationContext ? { propagationContext } : {}),
    });
    throwIfProtectionDispatchAborted(dispatchAbortSignal, 'after_recovery_ready');
    contentMutationFence?.assertCurrent('transport_after_recovery_ready');
    const retryReadyResult = requireContentScriptReadyResult(retryEnsure, 'retry', {
      requireReceiverCapability: true,
    });
    if (!retryReadyResult.ok) {
      const bootstrapState = orchestrator.getTabSession(tabId) || null;
      const diagnostic = await buildReceiverMissingDiagnostic(
        tabId,
        retryReadyResult.error || retryReadyResult.reason,
        {
          browserPort,
          bootstrapState,
          ensureResult: retryReadyResult,
        },
      );
      noteDiagnostic('dispatch_failed', {
        diagnosticReason: diagnostic?.reason || retryReadyResult.reason,
        ensureSource: retryReadyResult.source || null,
        error: toErrorMessage(retryReadyResult.error || retryReadyResult.reason),
        recovery: true,
      });
      return { ok: false, error: retryReadyResult.error || new Error(String(retryReadyResult.reason)), diagnostic };
    }

    try {
      dispatchDocumentId = bindToReadyDocument
        ? requireReadyContentDocumentId(
          orchestrator,
          tabId,
          'recovery',
          expectedDispatchDocumentId,
        )
        : null;
      requireContentReceiverCapability(retryReadyResult.receiverCapability, {
        expectedDocumentId: dispatchDocumentId,
      });
    } catch (documentError) {
      if (expectedDispatchDocumentId !== null) throw documentError;
      noteDiagnostic('dispatch_failed', {
        diagnosticReason: 'content_document_identity_invalid',
        ensureSource: retryReadyResult.source || null,
        error: toErrorMessage(documentError),
        recovery: true,
      });
      return {
        ok: false,
        error: documentError,
        dispatchDocumentId: null,
        diagnostic: {
          reason: 'content_document_identity_invalid',
        },
      };
    }

    noteDiagnostic('dispatch_attempt', {
      ensureSource: retryReadyResult.source || null,
      recovery: true,
      receiverCapabilityVersion: retryReadyResult.receiverCapability.schemaVersion,
      receiverCapabilityGeneration:
        retryReadyResult.receiverCapability.sessionGeneration,
    });
    let recoveryError = null;
    try {
      const response = await sendTabMessage(
        browserPort,
        tabId,
        message,
        dispatchDocumentId,
      );
      const delivery = normalizeTabsSendMessageResult(response);
      enforcePostSendAbort(
        dispatchAbortSignal,
        'after_recovery_send',
        messageType,
        delivery,
      );
      if (!delivery.ok) {
        const deliveryError = toDispatchError(delivery.error, 'CONTENT_RESPONSE_NOT_OK');
        if (isReceiverMissingError(deliveryError)) throw deliveryError;
        noteDiagnostic('dispatch_failed', {
          diagnosticReason: delivery.reason || 'content_response_not_ok',
          ensureSource: retryReadyResult.source || null,
          error: toErrorMessage(deliveryError),
          recovery: true,
        });
        return {
          ok: false,
          error: deliveryError,
          response: delivery.response,
          dispatchDocumentId,
        };
      }
      noteDiagnostic('dispatch_succeeded', {
        ensureSource: retryReadyResult.source || null,
        delivery: 'recovered_capability_ack',
        recovery: true,
      });
      return {
        ok: true,
        ensureSource: retryReadyResult.source || null,
        delivery: 'recovered_capability_ack',
        response: delivery.response,
        dispatchDocumentId,
      };
    } catch (retryError) {
      if (!isReceiverMissingError(retryError)) {
        if (shouldRejectExpectedDocumentFailure(retryError, expectedDispatchDocumentId)) {
          throw retryError;
        }
        noteDiagnostic('dispatch_failed', {
          diagnosticReason: retryError?.code === 'PROTECTION_DISPATCH_ABORTED'
            ? 'dispatch_aborted'
            : 'send_message_error',
          ensureSource: retryReadyResult.source || null,
          error: toErrorMessage(retryError),
          recovery: true,
        });
        return { ok: false, error: retryError, dispatchDocumentId };
      }
      recoveryError = retryError;
    }

    const bootstrapState = orchestrator.getTabSession(tabId) || null;
    const diagnostic = await buildReceiverMissingDiagnostic(
      tabId,
      recoveryError,
      {
        browserPort,
        bootstrapState,
        ensureResult: retryReadyResult,
      },
    );
    noteDiagnostic('dispatch_failed', {
      diagnosticReason: diagnostic?.reason || 'receiver_missing',
      ensureSource: retryReadyResult.source || null,
      error: toErrorMessage(recoveryError),
      recovery: true,
    });
    return {
      ok: false,
      error: recoveryError,
      diagnostic,
      dispatchDocumentId,
    };
  }
}

export async function isForegroundTab(tabId, browserPort, { onError } = {}) {
  try {
    const tab = await browserPort.tabsGet(tabId);
    if (!tab?.active) return false;
    if (!Number.isFinite(tab?.windowId)) return false;

    if (tab.windowId === browserPort.windowIdNone) {
      return false;
    }

    const win = await browserPort.windowsGetLastFocused();
    if (!win || win.id === browserPort.windowIdNone) return false;
    return win.id === tab.windowId;
  } catch (error) {
    if (typeof onError === 'function') {
      onError(error);
    }
    return false;
  }
}
