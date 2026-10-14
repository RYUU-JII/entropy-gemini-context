import { MESSAGE_TYPES } from '../../../platform/messaging/messageTypes.js';
import {
  resolveSenderDocumentId,
  resolveSenderFrameId,
  resolveTrustedSenderTabId,
} from '../../../platform/security/senderTrust.js';
import { getHostname } from '../../../lib/index.js';
import { normalizeDomain } from '../../../lib/domain.js';
import {
  buildFeedFlowSnapshot,
  FEED_FLOW_SNAPSHOT_COMMIT_DEADLINE_MS,
  isFeedFlowSnapshotMessage,
} from '../../protection/contracts/feedFlowSnapshotBridge.js';
import {
  CONTENT_FLOW_SIGNAL_COMMIT_DEADLINE_MS,
  readContentFlowSignal,
} from '../../../platform/messaging/contracts/contentFlowSignal.js';
import { createBoundedKeyedCommitQueue } from './boundedKeyedCommitQueue.js';

export const CONTENT_FLOW_SIGNAL_COMMIT_MAX_DEPTH = 8;
export const CONTENT_FLOW_SIGNAL_COMMIT_MAX_ACTIVE_TABS = 128;
export const FEED_FLOW_SNAPSHOT_COMMIT_MAX_DEPTH = 8;
export const FEED_FLOW_SNAPSHOT_COMMIT_MAX_ACTIVE_TABS = 128;
export const FEED_FLOW_PROTECTION_REFRESH_TIMEOUT_MS = 1_500;
export const FEED_FLOW_PROTECTION_REFRESH_MAX_ACTIVE_TABS = 128;

function reportFeedFlowProtectionRefreshFailure(code, error, { tabId = null } = {}) {
  try {
    console.warn?.('[TrackingSpecialRuntimeHandlers] post-commit feed protection refresh failed', {
      code,
      tabId,
      error: error?.message || String(error || code),
    });
  } catch {
    // Diagnostics must never turn an already committed feed snapshot into a
    // false negative acknowledgement.
  }
}

async function resolveTrustedTabUrl(sender, tabId, browserPort, unavailableCode) {
  const senderTabUrl = String(sender?.tab?.url || '').trim();
  if (senderTabUrl) {
    return senderTabUrl;
  }

  let tab;
  try {
    tab = await browserPort.tabsGet(tabId);
  } catch (error) {
    throw new Error(
      `TRACKING_SPECIAL_RUNTIME_TAB_LOOKUP_FAILED: ${error?.message || String(error || 'EXTENSION_API_FAILED')}`,
    );
  }

  const tabUrl = String(tab?.url || '').trim();
  if (!tabUrl) {
    throw new Error(unavailableCode);
  }

  return tabUrl;
}

function resolveSenderHostname(sender) {
  const senderTabUrl = String(sender?.tab?.url || '').trim();
  return senderTabUrl ? getHostname(senderTabUrl) : '';
}

function requireTrackingSpecialRuntimeOwner(ownerFn, errorCode) {
  if (typeof ownerFn !== 'function') {
    throw new Error(errorCode);
  }
  return ownerFn;
}

function resolveTrackingSpecialRuntimeBrowserPort(browserPort) {
  if (!browserPort || typeof browserPort.tabsGet !== 'function') {
    throw new Error('TRACKING_SPECIAL_RUNTIME_BROWSER_PORT_OWNER_REQUIRED');
  }
  return browserPort;
}

export function createTrackingSpecialRuntimeHandlers({
  prepareFeedFlowSnapshot,
  commitFeedFlowSnapshot,
  recordContentFlowSignal,
  recordContentFlowFromFeedSnapshot,
  sendProtectionUpdate,
  browserPort,
  contentFlowSignalCommitTimeoutMs = CONTENT_FLOW_SIGNAL_COMMIT_DEADLINE_MS,
  contentFlowSignalCommitMaxActiveTabs = CONTENT_FLOW_SIGNAL_COMMIT_MAX_ACTIVE_TABS,
  feedFlowSnapshotCommitTimeoutMs = FEED_FLOW_SNAPSHOT_COMMIT_DEADLINE_MS,
  feedFlowSnapshotCommitMaxActiveTabs = FEED_FLOW_SNAPSHOT_COMMIT_MAX_ACTIVE_TABS,
  feedFlowProtectionRefreshTimeoutMs = FEED_FLOW_PROTECTION_REFRESH_TIMEOUT_MS,
  feedFlowProtectionRefreshMaxActiveTabs = FEED_FLOW_PROTECTION_REFRESH_MAX_ACTIVE_TABS,
} = {}) {
  const prepareFeedFlowSnapshotOwner = requireTrackingSpecialRuntimeOwner(
    prepareFeedFlowSnapshot,
    'TRACKING_SPECIAL_RUNTIME_FEED_FLOW_PREPARE_OWNER_REQUIRED',
  );
  const commitFeedFlowSnapshotOwner = requireTrackingSpecialRuntimeOwner(
    commitFeedFlowSnapshot,
    'TRACKING_SPECIAL_RUNTIME_FEED_FLOW_COMMIT_OWNER_REQUIRED',
  );
  const recordContentFlowSignalOwner = requireTrackingSpecialRuntimeOwner(
    recordContentFlowSignal,
    'TRACKING_SPECIAL_RUNTIME_CONTENT_FLOW_SIGNAL_OWNER_REQUIRED',
  );
  const recordContentFlowFromFeedSnapshotOwner = requireTrackingSpecialRuntimeOwner(
    recordContentFlowFromFeedSnapshot,
    'TRACKING_SPECIAL_RUNTIME_FEED_CONTENT_FLOW_OWNER_REQUIRED',
  );
  const sendProtectionUpdateOwner = requireTrackingSpecialRuntimeOwner(
    sendProtectionUpdate,
    'TRACKING_SPECIAL_RUNTIME_PROTECTION_UPDATE_OWNER_REQUIRED',
  );
  const resolvedBrowserPort = resolveTrackingSpecialRuntimeBrowserPort(browserPort);
  if (
    !Number.isSafeInteger(feedFlowProtectionRefreshTimeoutMs)
    || feedFlowProtectionRefreshTimeoutMs <= 0
  ) {
    throw new Error('TRACKING_SPECIAL_RUNTIME_FEED_FLOW_REFRESH_TIMEOUT_INVALID');
  }
  if (
    !Number.isSafeInteger(feedFlowProtectionRefreshMaxActiveTabs)
    || feedFlowProtectionRefreshMaxActiveTabs <= 0
  ) {
    throw new Error('TRACKING_SPECIAL_RUNTIME_FEED_FLOW_REFRESH_TAB_CAPACITY_INVALID');
  }

  const contentFlowSignalCommitQueue = createBoundedKeyedCommitQueue({
    deadlineMs: contentFlowSignalCommitTimeoutMs,
    maxDepth: CONTENT_FLOW_SIGNAL_COMMIT_MAX_DEPTH,
    maxActiveKeys: contentFlowSignalCommitMaxActiveTabs,
    deadlineInvalidCode: 'TRACKING_SPECIAL_RUNTIME_CONTENT_FLOW_TIMEOUT_INVALID',
    activeKeyCapacityInvalidCode: 'TRACKING_SPECIAL_RUNTIME_CONTENT_FLOW_TAB_CAPACITY_INVALID',
    errorCodes: {
      timeout: 'CONTENT_FLOW_SIGNAL_COMMIT_TIMEOUT',
      poisoned: 'CONTENT_FLOW_SIGNAL_COMMIT_QUEUE_POISONED',
      capacity: 'CONTENT_FLOW_SIGNAL_COMMIT_CAPACITY_EXCEEDED',
      activeKeyCapacity: 'CONTENT_FLOW_SIGNAL_COMMIT_TAB_CAPACITY_EXCEEDED',
    },
  });
  const feedFlowSnapshotCommitQueue = createBoundedKeyedCommitQueue({
    deadlineMs: feedFlowSnapshotCommitTimeoutMs,
    maxDepth: FEED_FLOW_SNAPSHOT_COMMIT_MAX_DEPTH,
    maxActiveKeys: feedFlowSnapshotCommitMaxActiveTabs,
    deadlineInvalidCode: 'TRACKING_SPECIAL_RUNTIME_FEED_FLOW_TIMEOUT_INVALID',
    activeKeyCapacityInvalidCode: 'TRACKING_SPECIAL_RUNTIME_FEED_FLOW_TAB_CAPACITY_INVALID',
    errorCodes: {
      timeout: 'FEED_FLOW_SNAPSHOT_COMMIT_TIMEOUT',
      poisoned: 'FEED_FLOW_SNAPSHOT_COMMIT_QUEUE_POISONED',
      capacity: 'FEED_FLOW_SNAPSHOT_COMMIT_CAPACITY_EXCEEDED',
      activeKeyCapacity: 'FEED_FLOW_SNAPSHOT_COMMIT_TAB_CAPACITY_EXCEEDED',
    },
  });
  const feedFlowProtectionRefreshByTabId = new Map();
  let feedFlowProtectionRefreshCapacityWarningReported = false;

  function runContentFlowSignalCommit(tabId, task) {
    return contentFlowSignalCommitQueue.run(tabId, task);
  }

  function enqueueFeedFlowCommit(tabId, task) {
    return feedFlowSnapshotCommitQueue.run(tabId, task);
  }

  function settleFeedFlowProtectionRefresh(tabId, state, operation, error = null) {
    if (state.runningOperation !== operation) return;
    if (operation.timeoutId !== null) {
      try {
        clearTimeout(operation.timeoutId);
      } catch (clearError) {
        reportFeedFlowProtectionRefreshFailure(
          'FEED_FLOW_PROTECTION_REFRESH_TIMER_CLEAR_FAILED',
          clearError,
          { tabId },
        );
      }
      operation.timeoutId = null;
    }
    if (error && !operation.timedOut) {
      reportFeedFlowProtectionRefreshFailure(
        error?.code || 'FEED_FLOW_PROTECTION_REFRESH_FAILED',
        error,
        { tabId },
      );
    }

    state.runningOperation = null;
    const pendingRequest = state.pendingRequest;
    state.pendingRequest = null;
    if (pendingRequest) {
      runFeedFlowProtectionRefresh(tabId, state, pendingRequest);
      return;
    }
    if (feedFlowProtectionRefreshByTabId.get(tabId) === state) {
      feedFlowProtectionRefreshByTabId.delete(tabId);
      if (feedFlowProtectionRefreshByTabId.size < feedFlowProtectionRefreshMaxActiveTabs) {
        feedFlowProtectionRefreshCapacityWarningReported = false;
      }
    }
  }

  function runFeedFlowProtectionRefresh(tabId, state, request) {
    const operation = {
      request,
      timedOut: false,
      timeoutId: null,
    };
    state.runningOperation = operation;
    try {
      operation.timeoutId = setTimeout(() => {
        if (state.runningOperation !== operation) return;
        operation.timeoutId = null;
        operation.timedOut = true;
        reportFeedFlowProtectionRefreshFailure(
          'FEED_FLOW_PROTECTION_REFRESH_TIMEOUT',
          new Error('FEED_FLOW_PROTECTION_REFRESH_TIMEOUT'),
          { tabId },
        );
      }, feedFlowProtectionRefreshTimeoutMs);
    } catch (error) {
      reportFeedFlowProtectionRefreshFailure(
        'FEED_FLOW_PROTECTION_REFRESH_TIMER_START_FAILED',
        error,
        { tabId },
      );
    }

    Promise.resolve()
      .then(async () => {
        let currentTab;
        try {
          currentTab = await resolvedBrowserPort.tabsGet(tabId);
        } catch (error) {
          const lookupError = new Error(
            `FEED_FLOW_PROTECTION_REFRESH_TAB_LOOKUP_FAILED:${error?.message || String(error || 'EXTENSION_API_FAILED')}`,
          );
          lookupError.code = 'FEED_FLOW_PROTECTION_REFRESH_TAB_LOOKUP_FAILED';
          throw lookupError;
        }
        const currentTabUrl = String(currentTab?.url || '').trim();
        const currentHostname = getHostname(currentTabUrl);
        if (!currentHostname) {
          const urlError = new Error('FEED_FLOW_PROTECTION_REFRESH_TAB_URL_UNAVAILABLE');
          urlError.code = 'FEED_FLOW_PROTECTION_REFRESH_TAB_URL_UNAVAILABLE';
          throw urlError;
        }
        if (currentHostname !== request.hostname) {
          const hostError = new Error('FEED_FLOW_PROTECTION_REFRESH_HOST_MISMATCH');
          hostError.code = 'FEED_FLOW_PROTECTION_REFRESH_HOST_MISMATCH';
          throw hostError;
        }
        return sendProtectionUpdateOwner(tabId, currentTabUrl, {
          forceSnapshot: true,
        });
      })
      .then(
        () => settleFeedFlowProtectionRefresh(tabId, state, operation),
        (error) => settleFeedFlowProtectionRefresh(tabId, state, operation, error),
      );
  }

  function scheduleFeedFlowProtectionRefresh(tabId, hostname) {
    const request = { hostname };
    let state = feedFlowProtectionRefreshByTabId.get(tabId);
    if (!state) {
      if (feedFlowProtectionRefreshByTabId.size >= feedFlowProtectionRefreshMaxActiveTabs) {
        if (!feedFlowProtectionRefreshCapacityWarningReported) {
          feedFlowProtectionRefreshCapacityWarningReported = true;
          reportFeedFlowProtectionRefreshFailure(
            'FEED_FLOW_PROTECTION_REFRESH_TAB_CAPACITY_EXCEEDED',
            new Error('FEED_FLOW_PROTECTION_REFRESH_TAB_CAPACITY_EXCEEDED'),
            { tabId },
          );
        }
        return false;
      }
      state = { runningOperation: null, pendingRequest: null };
      feedFlowProtectionRefreshByTabId.set(tabId, state);
    }
    if (state.runningOperation) {
      // Keep only the latest refresh demand. Feed revisions themselves are not
      // coalesced; only this derived post-commit projection is replaceable.
      state.pendingRequest = request;
      return true;
    }
    runFeedFlowProtectionRefresh(tabId, state, request);
    return true;
  }

  return {
    [MESSAGE_TYPES.CONTENT_FLOW_SIGNAL]: (request, sender, sendResponse) => {
      Promise.resolve()
        .then(async () => {
          const signal = readContentFlowSignal(request?.signal);
          const tabId = resolveTrustedSenderTabId(sender);
          if (!Number.isSafeInteger(tabId) || tabId < 0) {
            throw new Error('CONTENT_FLOW_SIGNAL_SENDER_TAB_REQUIRED');
          }
          const hostname = resolveSenderHostname(sender);
          if (!hostname) {
            throw new Error('CONTENT_FLOW_SIGNAL_SENDER_HOST_REQUIRED');
          }
          let recorded;
          try {
            recorded = await runContentFlowSignalCommit(
              tabId,
              () => recordContentFlowSignalOwner({ hostname, signal }),
            );
          } catch (error) {
            throw new Error(
              `CONTENT_FLOW_SIGNAL_COMMIT_FAILED:${error?.message || String(error || 'UNKNOWN')}`,
            );
          }
          return { success: true, recorded: recorded === true };
        })
        .then((payload) => sendResponse(payload))
        .catch((error) => {
          sendResponse({ success: false, error: error?.message || 'CONTENT_FLOW_SIGNAL_FAILED' });
        });
      return true;
    },

    [MESSAGE_TYPES.PROTECTION_RESYNC_REQUEST]: (request, sender, sendResponse) => {
      Promise.resolve()
        .then(async () => {
          const tabId = resolveTrustedSenderTabId(sender);
          if (!Number.isFinite(tabId)) {
            return { success: false, error: 'INVALID_SENDER_TAB' };
          }

          const tabUrl = await resolveTrustedTabUrl(
            sender,
            tabId,
            resolvedBrowserPort,
            'RESYNC_TAB_URL_UNAVAILABLE',
          );

          console.debug('[TrackingMessageHandler][PROTECTION_RESYNC_REQUEST]', {
            tabId,
            traceId: request?.payload?.traceId || null,
            reason: request?.payload?.reason || null,
          });

          await sendProtectionUpdateOwner(tabId, tabUrl, {
            forceSnapshot: true,
          });
          return { success: true };
        })
        .then((payload) => sendResponse(payload))
        .catch((error) => {
          sendResponse({ success: false, error: error?.message || 'RESYNC_FAILED' });
        });

      return true;
    },

    [MESSAGE_TYPES.FEED_FLOW_SNAPSHOT_UPDATED]: (request, sender, sendResponse) => {
      Promise.resolve()
        .then(async () => {
          if (!isFeedFlowSnapshotMessage(request)) {
            return { success: false, error: 'INVALID_FEED_FLOW_SNAPSHOT' };
          }

          const tabId = resolveTrustedSenderTabId(sender);
          if (!Number.isFinite(tabId)) {
            return { success: false, error: 'INVALID_SENDER_TAB' };
          }
          const documentId = resolveSenderDocumentId(sender);
          if (!documentId) {
            return { success: false, error: 'INVALID_SENDER_DOCUMENT' };
          }
          if (resolveSenderFrameId(sender) !== 0) {
            return { success: false, error: 'INVALID_SENDER_FRAME' };
          }
          const snapshotHostname = normalizeDomain(request.payload.snapshot.host);
          const senderHostname = resolveSenderHostname(sender);
          if (snapshotHostname && senderHostname && snapshotHostname !== senderHostname) {
            return { success: false, error: 'FEED_FLOW_CAPTURED_HOST_MISMATCH' };
          }
          const capturedHostname = snapshotHostname || senderHostname;
          if (!capturedHostname) {
            return { success: false, error: 'FEED_FLOW_CAPTURED_HOST_REQUIRED' };
          }

          return enqueueFeedFlowCommit(tabId, async () => {
            const tabUrl = await resolveTrustedTabUrl(
              sender,
              tabId,
              resolvedBrowserPort,
              'FEED_FLOW_TAB_URL_UNAVAILABLE',
            );
            const hostname = getHostname(tabUrl);
            if (!hostname) {
              throw new Error('FEED_FLOW_TRUSTED_HOST_UNAVAILABLE');
            }
            if (hostname !== capturedHostname) {
              throw new Error('FEED_FLOW_CAPTURED_HOST_MISMATCH');
            }
            const normalizedSnapshot = buildFeedFlowSnapshot({
              host: hostname,
              snapshot: request.payload.snapshot,
            });
            const source = {
              tabId,
              documentId,
              hostname,
            };
            const prepared = prepareFeedFlowSnapshotOwner({
              hostname,
              tabId,
              documentId,
              snapshot: normalizedSnapshot,
            });
            let historyResult = null;
            // Historical delivery is independently idempotent. Live snapshot
            // cache/delta state is not an acknowledgement of durable history.
            if (!prepared?.staleDocument && !prepared?.outOfOrder && normalizedSnapshot.history) {
              try {
                historyResult = await recordContentFlowFromFeedSnapshotOwner({
                  hostname,
                  source,
                  history: normalizedSnapshot.history,
                  now: normalizedSnapshot.checkedAt,
                });
              } catch (error) {
                throw new Error(
                  `FEED_FLOW_CONTENT_STATS_COMMIT_FAILED:${error?.message || String(error || 'UNKNOWN')}`,
                );
              }
            }
            const result = prepared?.accepted
              ? commitFeedFlowSnapshotOwner(prepared)
              : prepared;
            const flowChanged = typeof result?.flowChanged === 'boolean'
              ? result.flowChanged
              : !!result?.changed;

            if (result?.changed) {
              scheduleFeedFlowProtectionRefresh(tabId, hostname);
            }

            return {
              success: true,
              snapshot: result?.snapshot || normalizedSnapshot,
              changed: !!result?.changed,
              flowChanged,
              readinessChanged: !!result?.readinessChanged,
              metricChanged: !!result?.metricChanged,
              contentFlowChanged: !!result?.contentFlowChanged,
              ...(historyResult?.feedHistoryResetAt !== undefined
                ? { feedHistoryResetAt: historyResult.feedHistoryResetAt } : {}),
            };
          });
        })
        .then((payload) => sendResponse(payload))
        .catch((error) => {
          sendResponse({ success: false, error: error?.message || 'FEED_FLOW_SNAPSHOT_FAILED' });
        });

      return true;
    },
  };
}
