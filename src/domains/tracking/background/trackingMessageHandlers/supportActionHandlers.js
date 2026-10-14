import {
  MESSAGE_ACTIONS,
  MESSAGE_TYPES,
} from '../../../../platform/messaging/messageTypes.js';
import {
  isTrustedExtensionTabSender,
  isTrustedExtensionPageSender,
  resolveTrustedSenderTabId,
} from '../../../../platform/security/senderTrust.js';
import {
  SENTINEL_PROTOCOL_TIMELINE_PHASES,
  SENTINEL_PROTOCOL_TIMELINE_SOURCES,
  SENTINEL_PROTOCOL_TIMELINE_STATUSES,
} from '../../../protection/debug/SentinelProtocolTimeline.js';
import { DEBUG_NUDGE_CONTROL_SOURCES } from '../trackingMessagePolicies/supportDebugPolicy.js';
import { runAsyncHandler } from './runtimeHandlerUtils.js';
import { ENTROPY_RUNTIME_BUILD_INFO } from '../../../../platform/build/runtimeBuildInfo.js';

const ALLOWED_DEBUG_NUDGE_MESSAGE_TYPES = new Set([
  MESSAGE_TYPES.NUDGE_DEBUG_CONFIG,
  MESSAGE_TYPES.NUDGE_DEBUG_SPAWN,
  MESSAGE_TYPES.NUDGE_DEBUG_WORKER_PROBE,
  MESSAGE_TYPES.NUDGE_DEBUG_FRAME_WORKER_PROBE,
  MESSAGE_TYPES.NUDGE_DEBUG_STOP,
]);

const MUTATING_DEBUG_NUDGE_MESSAGE_TYPES = new Set([
  MESSAGE_TYPES.NUDGE_DEBUG_CONFIG,
  MESSAGE_TYPES.NUDGE_DEBUG_SPAWN,
  MESSAGE_TYPES.NUDGE_DEBUG_STOP,
]);

function isWebUrl(url) {
  return typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'));
}

function normalizeDebugProtocolScope(value) {
  return String(value || '').trim().toLowerCase() === 'global' ? 'global' : 'site';
}

function normalizeDebugProtocolIntensity(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return undefined;
  return Math.max(0.35, Math.min(1, numeric));
}

function normalizeDebugTimelineLimit(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 40;
  return Math.max(1, Math.min(120, Math.floor(numeric)));
}

function getHostnameFromUrl(url) {
  if (!isWebUrl(url)) return null;
  try {
    return new URL(url).hostname || null;
  } catch (_) {
    return null;
  }
}

function recordSentinelTimeline(sentinelProtocolTimeline, event = {}) {
  return sentinelProtocolTimeline.record(event);
}

function createSupportResultError(code, fieldName = '') {
  const message = fieldName ? `${code}:${fieldName}` : code;
  const error = new Error(message);
  error.code = code;
  if (fieldName) error.field = fieldName;
  return error;
}

function requireEnsureContentReadyResult(result) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw createSupportResultError('SUPPORT_CONTENT_READY_RESULT_INVALID', 'result');
  }
  if (typeof result.ok !== 'boolean') {
    throw createSupportResultError('SUPPORT_CONTENT_READY_RESULT_INVALID', 'ok');
  }
  if (result.source !== null && typeof result.source !== 'string') {
    throw createSupportResultError('SUPPORT_CONTENT_READY_RESULT_INVALID', 'source');
  }
  const reason = typeof result.reason === 'string' && result.reason.trim()
    ? result.reason.trim()
    : null;
  const error = typeof result.error === 'string' && result.error.trim()
    ? result.error.trim()
    : null;
  if (result.ok === false && !reason && !error) {
    throw createSupportResultError('SUPPORT_CONTENT_READY_RESULT_INVALID', 'reason');
  }
  return {
    ok: result.ok,
    source: typeof result.source === 'string' && result.source.trim()
      ? result.source.trim()
      : null,
    reason,
    error,
  };
}

function buildEnsureDebugResult(ensureResult) {
  return {
    ok: ensureResult.ok,
    source: ensureResult.source,
    reason: ensureResult.reason,
    error: ensureResult.error,
  };
}

function requireDebugContentResponse(response) {
  if (!response || typeof response !== 'object' || Array.isArray(response)) {
    throw createSupportResultError('SUPPORT_DEBUG_CONTENT_RESPONSE_INVALID', 'response');
  }
  if (typeof response.ok !== 'boolean') {
    throw createSupportResultError('SUPPORT_DEBUG_CONTENT_RESPONSE_INVALID', 'ok');
  }
  const error = typeof response.error === 'string' && response.error.trim()
    ? response.error.trim()
    : null;
  if (response.ok === false && !error) {
    throw createSupportResultError('SUPPORT_DEBUG_CONTENT_RESPONSE_INVALID', 'error');
  }
  return {
    ...response,
    error,
  };
}

function requireDebugContentMessageResult(result) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw createSupportResultError('SUPPORT_DEBUG_CONTENT_MESSAGE_RESULT_INVALID', 'result');
  }
  if (result.error === null) {
    return {
      response: requireDebugContentResponse(result.response),
      error: null,
    };
  }
  if (typeof result.error === 'string' && result.error.trim()) {
    return {
      response: null,
      error: result.error.trim(),
    };
  }
  throw createSupportResultError('SUPPORT_DEBUG_CONTENT_MESSAGE_RESULT_INVALID', 'error');
}

function requireDebugNudgeAuthorization(result) {
  if (!result || typeof result !== 'object' || typeof result.authorized !== 'boolean') {
    throw createSupportResultError('SUPPORT_DEBUG_NUDGE_AUTHORIZATION_RESULT_INVALID', 'result');
  }
  if (result.authorized === false && (typeof result.error !== 'string' || !result.error.trim())) {
    throw createSupportResultError('SUPPORT_DEBUG_NUDGE_AUTHORIZATION_RESULT_INVALID', 'error');
  }
  return result;
}

function requireActiveNudgeOwnerState(result) {
  if (
    !result
    || typeof result !== 'object'
    || typeof result.active !== 'boolean'
    || !Array.isArray(result.owners)
  ) {
    throw createSupportResultError('SUPPORT_ACTIVE_NUDGE_OWNER_RESULT_INVALID', 'result');
  }
  return result;
}

function resolveDebugNudgeTimelinePhase(messageType, response) {
  if (messageType === MESSAGE_TYPES.NUDGE_DEBUG_STOP) {
    return SENTINEL_PROTOCOL_TIMELINE_PHASES.STOPPED;
  }
  if (messageType === MESSAGE_TYPES.NUDGE_DEBUG_CONFIG) {
    return SENTINEL_PROTOCOL_TIMELINE_PHASES.CONFIG_DELIVERED;
  }
  if (messageType === MESSAGE_TYPES.NUDGE_DEBUG_WORKER_PROBE) {
    return response.ok === false
      ? SENTINEL_PROTOCOL_TIMELINE_PHASES.FAILED
      : SENTINEL_PROTOCOL_TIMELINE_PHASES.WORKER_PROBED;
  }
  if (messageType === MESSAGE_TYPES.NUDGE_DEBUG_FRAME_WORKER_PROBE) {
    return response.ok === false
      ? SENTINEL_PROTOCOL_TIMELINE_PHASES.FAILED
      : SENTINEL_PROTOCOL_TIMELINE_PHASES.WORKER_PROBED;
  }
  if (response.ok === false) {
    return SENTINEL_PROTOCOL_TIMELINE_PHASES.FAILED;
  }
  return SENTINEL_PROTOCOL_TIMELINE_PHASES.CONTENT_RENDERED;
}

function requireSupportFunction(fn, errorCode) {
  if (typeof fn !== 'function') {
    throw new Error(errorCode);
  }
  return fn;
}

function requireSupportBrowserPort(browserPort) {
  if (
    !browserPort
    || typeof browserPort.tabsQuery !== 'function'
    || typeof browserPort.tabsGet !== 'function'
    || typeof browserPort.tabsSendMessage !== 'function'
  ) {
    throw new Error('SUPPORT_BROWSER_PORT_OWNER_REQUIRED');
  }
  return browserPort;
}

function requireZenPairwiseGpService(zenPairwiseGpService) {
  if (
    !zenPairwiseGpService
    || typeof zenPairwiseGpService.ensureLoaded !== 'function'
    || typeof zenPairwiseGpService.getMeta !== 'function'
    || typeof zenPairwiseGpService.reset !== 'function'
    || typeof zenPairwiseGpService.trainPair !== 'function'
    || typeof zenPairwiseGpService.predictDetailed !== 'function'
    || typeof zenPairwiseGpService.sampleUtility !== 'function'
  ) {
    throw new Error('ZEN_GP_SERVICE_OWNER_REQUIRED');
  }
  return zenPairwiseGpService;
}

function requireContentScriptOrchestrator(contentScriptOrchestrator) {
  if (
    !contentScriptOrchestrator
    || typeof contentScriptOrchestrator.getDiagnosticsSnapshot !== 'function'
    || typeof contentScriptOrchestrator.ensureContentScriptReady !== 'function'
  ) {
    throw new Error('SUPPORT_CONTENT_ORCHESTRATOR_OWNER_REQUIRED');
  }
  return contentScriptOrchestrator;
}

function requireSentinelProtocolTimeline(sentinelProtocolTimeline) {
  if (
    !sentinelProtocolTimeline
    || typeof sentinelProtocolTimeline.record !== 'function'
    || typeof sentinelProtocolTimeline.getSnapshot !== 'function'
    || typeof sentinelProtocolTimeline.clear !== 'function'
  ) {
    throw new Error('SUPPORT_SENTINEL_TIMELINE_OWNER_REQUIRED');
  }
  return sentinelProtocolTimeline;
}

export function createSupportActionHandlers({
  authorizeNudgeDebugControl,
  captureFaviconFromUrl,
  captureTabFavicon,
  contentScriptOrchestrator,
  getBootPrewarmSnapshot,
  getTrackingRuntimeState,
  inspectFavicon,
  isPageUrlBoundToSenderTab,
  maybeTriggerProtectionNudge,
  readActiveNudgeOwnerForTab,
  resolveTrustedSenderTabUrl,
  saveStatsCache,
  sentinelProtocolTimeline,
  zenPairwiseGpService,
  browserPort,
} = {}) {
  const authorizeDebugNudgeControl = requireSupportFunction(
    authorizeNudgeDebugControl,
    'SUPPORT_DEBUG_NUDGE_AUTHORIZATION_OWNER_REQUIRED',
  );
  const captureFaviconForPage = requireSupportFunction(
    captureFaviconFromUrl,
    'SUPPORT_FAVICON_PAGE_CAPTURE_OWNER_REQUIRED',
  );
  const captureFaviconForTab = requireSupportFunction(
    captureTabFavicon,
    'SUPPORT_FAVICON_TAB_CAPTURE_OWNER_REQUIRED',
  );
  const readBootPrewarmSnapshot = requireSupportFunction(
    getBootPrewarmSnapshot,
    'SUPPORT_BOOT_PREWARM_OWNER_REQUIRED',
  );
  const readTrackingRuntimeState = requireSupportFunction(
    getTrackingRuntimeState,
    'SUPPORT_TRACKING_RUNTIME_STATE_OWNER_REQUIRED',
  );
  const inspectFaviconCache = requireSupportFunction(
    inspectFavicon,
    'SUPPORT_FAVICON_INSPECT_OWNER_REQUIRED',
  );
  const isPageUrlBoundToSender = requireSupportFunction(
    isPageUrlBoundToSenderTab,
    'SUPPORT_PAGE_URL_BINDING_OWNER_REQUIRED',
  );
  const triggerProtectionNudge = requireSupportFunction(
    maybeTriggerProtectionNudge,
    'SUPPORT_NUDGE_DISPATCH_OWNER_REQUIRED',
  );
  const readActiveProductionNudgeOwner = requireSupportFunction(
    readActiveNudgeOwnerForTab,
    'SUPPORT_ACTIVE_NUDGE_OWNER_READER_REQUIRED',
  );
  const resolveSenderTabUrl = requireSupportFunction(
    resolveTrustedSenderTabUrl,
    'SUPPORT_SENDER_TAB_URL_OWNER_REQUIRED',
  );
  const saveStatsCacheNow = requireSupportFunction(
    saveStatsCache,
    'SUPPORT_SAVE_STATS_OWNER_REQUIRED',
  );
  const resolvedBrowserPort = requireSupportBrowserPort(browserPort);
  const resolvedContentScriptOrchestrator = requireContentScriptOrchestrator(contentScriptOrchestrator);
  const resolvedSentinelProtocolTimeline = requireSentinelProtocolTimeline(sentinelProtocolTimeline);
  const resolvedZenPairwiseGpService = requireZenPairwiseGpService(zenPairwiseGpService);

  const handlers = {
    [MESSAGE_ACTIONS.DEBUG_GET_TRACKING_RUNTIME_STATE]: (_request, sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        if (!isTrustedExtensionPageSender(sender)) {
          return { success: false, error: 'UNTRUSTED_SENDER' };
        }
        return {
          success: true,
          runtime: readTrackingRuntimeState(),
          buildInfo: ENTROPY_RUNTIME_BUILD_INFO,
        };
      },
      (error) => ({ success: false, error: error?.message || 'DEBUG_GET_TRACKING_RUNTIME_STATE_FAILED' }),
    ),

    [MESSAGE_ACTIONS.ZEN_GP_PAIRWISE_LOAD]: (_request, _sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        await resolvedZenPairwiseGpService.ensureLoaded();
        const meta = await resolvedZenPairwiseGpService.getMeta();
        return { success: true, meta };
      },
      (error) => ({ success: false, error: error?.message || 'ZEN_GP_LOAD_FAILED' }),
    ),

    [MESSAGE_ACTIONS.ZEN_GP_PAIRWISE_META]: (_request, _sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        const meta = await resolvedZenPairwiseGpService.getMeta();
        return { success: true, meta };
      },
      (error) => ({ success: false, error: error?.message || 'ZEN_GP_META_FAILED' }),
    ),

    [MESSAGE_ACTIONS.ZEN_GP_PAIRWISE_RESET]: (_request, _sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        const meta = await resolvedZenPairwiseGpService.reset();
        return { success: true, meta };
      },
      (error) => ({ success: false, error: error?.message || 'ZEN_GP_RESET_FAILED' }),
    ),

    [MESSAGE_ACTIONS.ZEN_GP_PAIRWISE_TRAIN]: (request, _sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        const winnerInput = request?.winnerInput || null;
        const loserInput = request?.loserInput || null;
        const options = request?.options && typeof request.options === 'object'
          ? request.options
          : {};
        const payload = await resolvedZenPairwiseGpService.trainPair(winnerInput, loserInput, options);
        return { success: true, payload };
      },
      (error) => ({ success: false, error: error?.message || 'ZEN_GP_TRAIN_FAILED' }),
    ),

    [MESSAGE_ACTIONS.ZEN_GP_PAIRWISE_PREDICT]: (request, _sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        const detail = await resolvedZenPairwiseGpService.predictDetailed(request?.input || null);
        return { success: true, detail };
      },
      (error) => ({ success: false, error: error?.message || 'ZEN_GP_PREDICT_FAILED' }),
    ),

    [MESSAGE_ACTIONS.ZEN_GP_PAIRWISE_SAMPLE_UTILITY]: (request, _sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        const sample = await resolvedZenPairwiseGpService.sampleUtility(request?.input || null);
        return { success: true, sample };
      },
      (error) => ({ success: false, error: error?.message || 'ZEN_GP_SAMPLE_FAILED' }),
    ),

    [MESSAGE_ACTIONS.DEBUG_REFRESH_FAVICONS]: (_request, _sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        const tabs = await resolvedBrowserPort.tabsQuery({});
        const targets = tabs.filter((tab) => (
          tab?.url
          && !tab.url.startsWith('chrome://')
          && !tab.url.startsWith('chrome-extension://')
        ));
        const results = await Promise.allSettled(
          targets.map((tab) => Promise.resolve(captureFaviconForTab(tab))),
        );
        const failures = results
          .map((result, index) => ({ result, tab: targets[index] }))
          .filter(({ result }) => result.status === 'rejected')
          .map(({ result, tab }) => ({
            tabId: Number.isFinite(Number(tab?.id)) ? Math.floor(Number(tab.id)) : null,
            error: result.reason?.message || String(result.reason || 'FAVICON_CAPTURE_FAILED'),
          }));
        if (failures.length > 0) {
          return {
            success: false,
            error: 'DEBUG_REFRESH_FAVICONS_PARTIAL_FAILURE',
            processed: targets.length,
            failed: failures.length,
            failures: failures.slice(0, 8),
          };
        }
        return { success: true, processed: targets.length, failed: 0 };
      },
      (error) => ({ success: false, error: error?.message || 'DEBUG_REFRESH_FAVICONS_FAILED', processed: 0 }),
    ),

    [MESSAGE_ACTIONS.CAPTURE_FAVICON]: (request, sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        const senderTabId = resolveTrustedSenderTabId(sender);
        if (senderTabId === null) {
          return { success: false, error: 'UNTRUSTED_SENDER' };
        }

        const trustedSenderTabUrl = await resolveSenderTabUrl(sender);
        if (!trustedSenderTabUrl?.ok) {
          return { success: false, error: trustedSenderTabUrl?.error || 'SENDER_TAB_URL_UNAVAILABLE' };
        }
        const pageUrl = request?.pageUrl || trustedSenderTabUrl.url || '';
        const iconUrl = request?.iconUrl || '';
        const dataUrl = request?.dataUrl || '';
        const hasBatch = request?.iconUrls !== undefined;
        const iconUrls = request?.iconUrls;
        if (!pageUrl || (hasBatch
          ? !Array.isArray(iconUrls) || iconUrls.length < 1 || iconUrls.length > 4
            || iconUrls.some((value) => typeof value !== 'string' || !value.trim())
          : !iconUrl)) {
          return { success: false, error: 'INVALID_FAVICON_REQUEST' };
        }
        if (!isPageUrlBoundToSender(pageUrl, trustedSenderTabUrl.url)) {
          return { success: false, error: 'PAGE_URL_SENDER_MISMATCH' };
        }
        const captured = await captureFaviconForPage(hasBatch
          ? { pageUrl, iconUrls }
          : { pageUrl, iconUrl, dataUrl });
        return { success: true, captured: captured === true };
      },
      (error) => ({ success: false, error: error?.message || 'CAPTURE_FAVICON_FAILED' }),
    ),

    [MESSAGE_ACTIONS.DEBUG_INSPECT_FAVICON]: (request, _sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        const domain = request?.domain || '';
        const result = await inspectFaviconCache(domain);
        return { success: true, ...result };
      },
      (error) => ({ success: false, error: error?.message || 'DEBUG_INSPECT_FAVICON_FAILED' }),
    ),

    [MESSAGE_ACTIONS.GET_BOOT_PREWARM_SNAPSHOT]: (request, sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        if (!isTrustedExtensionPageSender(sender)) {
          return { success: false, error: 'UNTRUSTED_SENDER' };
        }
        const snapshot = await readBootPrewarmSnapshot({
          force: !!request?.force,
          reason: request?.reason || 'dashboard_boot',
        });
        return {
          success: !!snapshot,
          snapshot: snapshot || null,
        };
      },
      (error) => ({ success: false, error: error?.message || 'BOOT_PREWARM_FAILED' }),
    ),

    [MESSAGE_ACTIONS.DEBUG_GET_CONTENT_RUNTIME_DIAGNOSTICS]: (request, sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        if (!isTrustedExtensionPageSender(sender)) {
          return { success: false, error: 'UNTRUSTED_SENDER' };
        }
        const rawTargetTabId = request?.targetTabId;
        const targetTabId = (
          Number.isInteger(rawTargetTabId)
          || (typeof rawTargetTabId === 'string' && rawTargetTabId.trim())
        )
          ? Number(rawTargetTabId)
          : null;
        const limit = Number(request?.limit);
        const snapshot = resolvedContentScriptOrchestrator.getDiagnosticsSnapshot({
          tabId: Number.isInteger(targetTabId) && targetTabId >= 0 ? targetTabId : null,
          limit: Number.isFinite(limit) && limit > 0 ? limit : 40,
        });

        return {
          success: true,
          snapshot,
        };
      },
      (error) => ({ success: false, error: error?.message || 'DEBUG_GET_CONTENT_RUNTIME_DIAGNOSTICS_FAILED' }),
    ),

    [MESSAGE_ACTIONS.DEBUG_GET_SENTINEL_PROTOCOL_TIMELINE]: (request, sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        if (!isTrustedExtensionPageSender(sender)) {
          return { success: false, error: 'UNTRUSTED_SENDER' };
        }
        return {
          success: true,
          snapshot: resolvedSentinelProtocolTimeline.getSnapshot({
            limit: normalizeDebugTimelineLimit(request?.limit),
          }),
        };
      },
      (error) => ({ success: false, error: error?.message || 'DEBUG_GET_SENTINEL_PROTOCOL_TIMELINE_FAILED' }),
    ),

    [MESSAGE_ACTIONS.DEBUG_GET_SENTINEL_PROTOCOL_SELF_TAB_TIMELINE]: (request, sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        if (!isTrustedExtensionTabSender(sender)) {
          return { success: false, error: 'UNTRUSTED_SENDER' };
        }
        const senderTabId = resolveTrustedSenderTabId(sender);
        if (senderTabId === null) {
          return { success: false, error: 'INVALID_TARGET_TAB' };
        }
        return {
          success: true,
          snapshot: resolvedSentinelProtocolTimeline.getSnapshot({
            limit: normalizeDebugTimelineLimit(request?.limit),
            tabId: senderTabId,
          }),
        };
      },
      (error) => ({
        success: false,
        error: error?.message || 'DEBUG_GET_SENTINEL_PROTOCOL_SELF_TAB_TIMELINE_FAILED',
      }),
    ),

    [MESSAGE_ACTIONS.DEBUG_CLEAR_SENTINEL_PROTOCOL_TIMELINE]: (_request, sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        if (!isTrustedExtensionPageSender(sender)) {
          return { success: false, error: 'UNTRUSTED_SENDER' };
        }
        resolvedSentinelProtocolTimeline.clear();
        return {
          success: true,
          snapshot: resolvedSentinelProtocolTimeline.getSnapshot({
            limit: 40,
          }),
        };
      },
      (error) => ({ success: false, error: error?.message || 'DEBUG_CLEAR_SENTINEL_PROTOCOL_TIMELINE_FAILED' }),
    ),

    [MESSAGE_ACTIONS.DEBUG_DISPATCH_NUDGE_MESSAGE]: (request, sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        if (!isTrustedExtensionPageSender(sender)) {
          return { success: false, error: 'UNTRUSTED_SENDER' };
        }
        const targetTabId = Number(request?.targetTabId);
        if (!Number.isInteger(targetTabId) || targetTabId < 0) {
          return { success: false, error: 'INVALID_TARGET_TAB' };
        }

        const message = request?.message && typeof request.message === 'object'
          ? request.message
          : null;
        const messageType = typeof message?.type === 'string' ? message.type : '';
        if (!ALLOWED_DEBUG_NUDGE_MESSAGE_TYPES.has(messageType)) {
          return { success: false, error: 'UNSUPPORTED_DEBUG_CONTENT_MESSAGE' };
        }

        const authorization = requireDebugNudgeAuthorization(
          authorizeDebugNudgeControl({
            source: DEBUG_NUDGE_CONTROL_SOURCES.DASHBOARD,
          }),
        );
        if (!authorization.authorized) {
          return {
            success: false,
            error: authorization.error,
          };
        }

        if (MUTATING_DEBUG_NUDGE_MESSAGE_TYPES.has(messageType)) {
          const ownerState = requireActiveNudgeOwnerState(
            await readActiveProductionNudgeOwner(targetTabId),
          );
          if (ownerState.active) {
            return {
              success: false,
              error: 'DEBUG_NUDGE_CONTROL_BLOCKED_BY_PRODUCTION_OWNER',
            };
          }
        }

        const tab = await resolvedBrowserPort.tabsGet(targetTabId);
        if (!tab || !isWebUrl(tab.url)) {
          return { success: false, error: 'INVALID_TARGET_TAB' };
        }

        const route = `dashboard_debug:${messageType.toLowerCase()}`;
        const hostname = getHostnameFromUrl(tab.url);
        recordSentinelTimeline(resolvedSentinelProtocolTimeline, {
          phase: SENTINEL_PROTOCOL_TIMELINE_PHASES.REQUESTED,
          status: SENTINEL_PROTOCOL_TIMELINE_STATUSES.PENDING,
          source: SENTINEL_PROTOCOL_TIMELINE_SOURCES.EXPERIMENT_LAB,
          route,
          tabId: targetTabId,
          url: tab.url,
          hostname,
          messageType,
        });

        const ensureResult = requireEnsureContentReadyResult(
          await resolvedContentScriptOrchestrator.ensureContentScriptReady(targetTabId, {
            url: tab.url,
            reason: route,
          }),
        );
        const ensureDebugResult = buildEnsureDebugResult(ensureResult);
        if (!ensureResult.ok) {
          recordSentinelTimeline(resolvedSentinelProtocolTimeline, {
            phase: SENTINEL_PROTOCOL_TIMELINE_PHASES.FAILED,
            status: SENTINEL_PROTOCOL_TIMELINE_STATUSES.ERROR,
            source: SENTINEL_PROTOCOL_TIMELINE_SOURCES.EXPERIMENT_LAB,
            route,
            tabId: targetTabId,
            url: tab.url,
            hostname,
            messageType,
            reason: ensureResult.reason,
            error: ensureResult.error || ensureResult.reason,
            ensureSource: ensureResult.source,
          });
          return {
            success: false,
            error: ensureResult.error || ensureResult.reason,
            contentReadySource: ensureDebugResult.source,
            contentReadyReason: ensureDebugResult.reason,
            ensureResult: ensureDebugResult,
          };
        }
        recordSentinelTimeline(resolvedSentinelProtocolTimeline, {
          phase: SENTINEL_PROTOCOL_TIMELINE_PHASES.CONTENT_READY,
          status: SENTINEL_PROTOCOL_TIMELINE_STATUSES.SUCCESS,
          source: SENTINEL_PROTOCOL_TIMELINE_SOURCES.EXPERIMENT_LAB,
          route,
          tabId: targetTabId,
          url: tab.url,
          hostname,
          messageType,
          ensureSource: ensureResult.source,
        });

        const { response, error } = requireDebugContentMessageResult(
          await resolvedBrowserPort.tabsSendMessage(targetTabId, message),
        );
        if (error) {
          recordSentinelTimeline(resolvedSentinelProtocolTimeline, {
            phase: SENTINEL_PROTOCOL_TIMELINE_PHASES.FAILED,
            status: SENTINEL_PROTOCOL_TIMELINE_STATUSES.ERROR,
            source: SENTINEL_PROTOCOL_TIMELINE_SOURCES.EXPERIMENT_LAB,
            route,
            tabId: targetTabId,
            url: tab.url,
            hostname,
            messageType,
            error,
            ensureSource: ensureResult.source,
          });
          return {
            success: false,
            error: String(error),
            contentReadySource: ensureDebugResult.source,
            contentReadyReason: ensureDebugResult.reason,
            ensureResult: ensureDebugResult,
            delivery: 'send_error',
          };
        }

        const delivery = (
          ensureResult.source === 'orchestrator_inject'
          || ensureResult.source === 'orchestrator_reinject'
        ) ? 'injected' : 'direct';
        const success = response.ok === true;
        recordSentinelTimeline(resolvedSentinelProtocolTimeline, {
          phase: resolveDebugNudgeTimelinePhase(messageType, response),
          status: success
            ? SENTINEL_PROTOCOL_TIMELINE_STATUSES.SUCCESS
            : SENTINEL_PROTOCOL_TIMELINE_STATUSES.ERROR,
          source: SENTINEL_PROTOCOL_TIMELINE_SOURCES.EXPERIMENT_LAB,
          route,
          tabId: targetTabId,
          url: tab.url,
          hostname,
          messageType,
          error: success ? null : response.error,
          reason: messageType === MESSAGE_TYPES.NUDGE_DEBUG_SPAWN
            ? response.spawnResult?.rejectReason || response.phase || null
            : (
              messageType === MESSAGE_TYPES.NUDGE_DEBUG_WORKER_PROBE
                ? response.workerProbe?.phase || response.phase || null
                : messageType === MESSAGE_TYPES.NUDGE_DEBUG_FRAME_WORKER_PROBE
                  ? response.frameWorkerProbe?.phase || response.phase || null
                : null
            ),
          ensureSource: ensureResult.source,
          delivery,
        });

        const debugResponse = messageType === MESSAGE_TYPES.NUDGE_DEBUG_SPAWN
          ? {
            phase: response.phase || response.spawnResult?.phase || null,
            spawnResult: response.spawnResult || null,
            error: success ? null : response.error,
          }
          : messageType === MESSAGE_TYPES.NUDGE_DEBUG_WORKER_PROBE
            ? {
                phase: response.phase || response.workerProbe?.phase || null,
                workerProbe: response.workerProbe || null,
                error: success ? null : response.error,
              }
            : messageType === MESSAGE_TYPES.NUDGE_DEBUG_FRAME_WORKER_PROBE
              ? {
                  phase: response.phase || response.frameWorkerProbe?.phase || null,
                  frameWorkerProbe: response.frameWorkerProbe || null,
                  error: success ? null : response.error,
                }
          : {};

        return {
          success,
          contentReadySource: ensureResult.source,
          contentReadyReason: ensureDebugResult.reason,
          ensureResult: ensureDebugResult,
          delivery,
          ...debugResponse,
        };
      },
      (error) => ({ success: false, error: error?.message || 'DEBUG_DISPATCH_NUDGE_MESSAGE_FAILED' }),
    ),

    [MESSAGE_ACTIONS.DEBUG_TRIGGER_SENTINEL_FLARE]: (request, sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        if (!isTrustedExtensionTabSender(sender)) {
          return { success: false, error: 'UNTRUSTED_SENDER' };
        }
        const senderTabId = resolveTrustedSenderTabId(sender);
        const resolvedPageUrl = await resolveSenderTabUrl(sender);
        if (senderTabId === null) {
          return { success: false, error: 'INVALID_TARGET_TAB' };
        }
        const authorization = requireDebugNudgeAuthorization(
          authorizeDebugNudgeControl({
            source: DEBUG_NUDGE_CONTROL_SOURCES.RUNTIME_DEBUGGER,
          }),
        );
        if (!authorization.authorized) {
          return {
            success: false,
            error: authorization.error,
          };
        }
        const ownerState = requireActiveNudgeOwnerState(
          await readActiveProductionNudgeOwner(senderTabId),
        );
        if (ownerState.active) {
          return {
            success: false,
            error: 'DEBUG_NUDGE_CONTROL_BLOCKED_BY_PRODUCTION_OWNER',
          };
        }
        if (!resolvedPageUrl?.ok) {
          return { success: false, error: resolvedPageUrl?.error || 'SENDER_TAB_URL_UNAVAILABLE' };
        }
        const pageUrl = resolvedPageUrl.url;
        if (!isWebUrl(pageUrl)) {
          return { success: false, error: 'SENDER_TAB_URL_INVALID' };
        }

        const debugOverrides = {
          protocolScope: normalizeDebugProtocolScope(request?.protocolScope),
          hudVisible: request?.hudVisible === true,
        };
        const protocolIntensity = normalizeDebugProtocolIntensity(request?.protocolIntensity);
        if (protocolIntensity !== undefined) {
          debugOverrides.protocolIntensity = protocolIntensity;
        }
        recordSentinelTimeline(resolvedSentinelProtocolTimeline, {
          phase: SENTINEL_PROTOCOL_TIMELINE_PHASES.REQUESTED,
          status: SENTINEL_PROTOCOL_TIMELINE_STATUSES.PENDING,
          source: SENTINEL_PROTOCOL_TIMELINE_SOURCES.RUNTIME,
          route: 'runtime_debugger',
          tabId: senderTabId,
          url: pageUrl,
          hostname: getHostnameFromUrl(pageUrl),
          protocolScope: debugOverrides.protocolScope,
          protocolIntensity,
          reason: 'debug',
        });

        const result = await triggerProtectionNudge(senderTabId, pageUrl, {
          force: true,
          debugOverrides,
        });

        if (result?.dispatched) {
          return { success: true, result };
        }
        return {
          success: false,
          error: String(result?.error || result?.skipped || 'NUDGE_NOT_DISPATCHED'),
          result: result || null,
        };
      },
      (error) => ({ success: false, error: error?.message || 'DEBUG_TRIGGER_SENTINEL_FLARE_FAILED' }),
    ),
  };

  handlers[MESSAGE_ACTIONS.DEBUG_FORCE_SAVE] = (_request, _sender, sendResponse) => runAsyncHandler(
    sendResponse,
    async () => {
      await saveStatsCacheNow({ force: true });
      return { success: true };
    },
    (error) => ({ success: false, error: error?.message || 'DEBUG_FORCE_SAVE_FAILED' }),
  );

  return handlers;
}
