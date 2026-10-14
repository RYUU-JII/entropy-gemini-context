import { MESSAGE_ACTIONS } from '../../../../platform/messaging/messageTypes.js';
import { resolveSenderDocumentId, resolveTrustedSenderTabId } from '../../../../platform/security/senderTrust.js';
import { buildSentinelRoom478Url } from '../../../nudge/nudge/nudgeGameControl.js';
import { runAsyncHandler } from './runtimeHandlerUtils.js';
import { createInterventionAdmissionHandlers } from './interventionAdmissionHandlers.js';
import { getInterventionAdmissionService } from '../../../protection/background/runtime/InterventionAdmissionService.js';
import {
  TAB_CLOSURE_OUTCOMES,
  TAB_CLOSURE_REQUESTERS,
} from '../../../protection/contracts/tabClosureContract.js';

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function resolveLifecycleIdentity(request, sender, normalizeNudgeRunId) {
  const senderTabId = resolveTrustedSenderTabId(sender);
  if (senderTabId === null) {
    return { ok: false, error: 'UNTRUSTED_SENDER' };
  }

  const runId = normalizeNudgeRunId(request?.runId);
  if (!runId) {
    return { ok: false, error: 'INVALID_NUDGE_RUN_ID' };
  }
  const mode = normalizeString(request?.mode).toLowerCase() || 'auto';
  if (mode === 'debug') {
    return { ok: false, error: 'DEBUG_NUDGE_LIFECYCLE_UNAUTHORIZED' };
  }
  if (mode !== 'auto') {
    return { ok: false, error: 'INVALID_NUDGE_LIFECYCLE_MODE' };
  }

  return {
    ok: true,
    runId,
    tabId: senderTabId,
    mode,
  };
}

function buildSideEffectWarning(code, error) {
  return {
    code,
    error: error?.message || String(error || code),
  };
}

async function recordSideEffectWarning(warnings, code, task) {
  try {
    await Promise.resolve(task());
    return true;
  } catch (error) {
    warnings.push(buildSideEffectWarning(code, error));
    return false;
  }
}

function attachWarnings(response, warnings) {
  return warnings.length > 0
    ? { ...response, warnings }
    : response;
}

function resolveCycleStateSnapshot(getCycleState) {
  const snapshot = getCycleState();
  if (snapshot === null || typeof snapshot === 'undefined') {
    return { ok: false, error: 'GET_CYCLE_STATE_UNAVAILABLE' };
  }
  return resolveRequiredCycleStateSnapshot(snapshot, 'GET_CYCLE_STATE_INVALID');
}

function resolveRequiredCycleStateSnapshot(snapshot, error) {
  if (typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return { ok: false, error };
  }
  return { ok: true, snapshot };
}

function resolveExtensionDashboardUrl(request, browserPort) {
  const canonicalUrl = browserPort.runtimeGetURL('src/pages/dashboard.html');
  if (!canonicalUrl) {
    return { ok: false, error: 'CHROME_RUNTIME_UNAVAILABLE' };
  }
  const canonical = new URL(canonicalUrl);
  const rawDashboardUrl = normalizeString(request?.dashboardUrl);
  if (!rawDashboardUrl) {
    return { ok: true, url: canonicalUrl };
  }

  let requested;
  try {
    requested = new URL(rawDashboardUrl);
  } catch (_) {
    return { ok: false, error: 'INVALID_DASHBOARD_URL' };
  }

  if (
    requested.origin !== canonical.origin
    || requested.pathname !== canonical.pathname
  ) {
    return { ok: false, error: 'INVALID_DASHBOARD_URL' };
  }

  return {
    ok: true,
    url: `${canonicalUrl}${requested.search || ''}`,
  };
}

function resolveExtensionRoom478Url(request, browserPort) {
  try {
    return {
      ok: true,
      url: buildSentinelRoom478Url({
        runId: request?.runId,
        source: request?.source,
        seed: request?.seed,
        originX: request?.originX,
        originY: request?.originY,
        runtimeGetURLFn: (path) => browserPort.runtimeGetURL(path),
      }),
    };
  } catch (error) {
    return {
      ok: false,
      error: String(error?.message || error || 'INVALID_NUDGE_ROOM_478_HANDOFF'),
    };
  }
}

async function openBrowserTab(createProperties, browserPort) {
  try {
    const tab = await browserPort.tabsCreate(createProperties);
    return tab
      ? { ok: true, error: null }
      : { ok: false, error: 'DASHBOARD_TAB_CREATE_FAILED' };
  } catch (error) {
    console.warn('[TrackingMessageHandler] failed to open dashboard tab', error);
    return { ok: false, error: 'DASHBOARD_TAB_CREATE_FAILED' };
  }
}

function requireNudgeOwner(fn, errorCode) {
  if (typeof fn !== 'function') {
    throw new Error(errorCode);
  }
  return fn;
}

function requireNudgeCycleBrowserPort(browserPort) {
  if (
    !browserPort
    || typeof browserPort.runtimeGetURL !== 'function'
    || typeof browserPort.tabsCreate !== 'function'
    || typeof browserPort.tabsUpdate !== 'function'
  ) {
    throw new Error('NUDGE_CYCLE_BROWSER_PORT_OWNER_REQUIRED');
  }
  return browserPort;
}

function resolveTerminalTransition(result) {
  if (
    result?.outcome !== 'applied'
    && result?.outcome !== 'already_applied'
  ) {
    return {
      ok: false,
      error: result?.reason || 'NUDGE_TERMINAL_TRANSITION_REJECTED',
    };
  }
  if (!result.entry || typeof result.entry !== 'object') {
    throw new Error('NUDGE_TERMINAL_OUTBOX_ENTRY_REQUIRED');
  }
  return {
    ok: true,
    replayed: result.outcome === 'already_applied',
    entry: result.entry,
  };
}

export function createNudgeCycleActionHandlers(context = {}) {
  const {
    acceptResetRecommendation,
    dismissResetRecommendation,
    getCycleState,
    markNudgeAborted,
    markNudgeEpisodeCompleted,
    markNudgePresented,
    markNudgeResolved,
    scheduleNudgeTerminalOutboxDrain,
    normalizeNudgeRunId,
    setResetHour,
    trackProtectionRecoveryPresented,
    requestTabClosure,
    browserPort,
  } = context;
  const requestTabClosureOwner = requireNudgeOwner(
    requestTabClosure,
    'NUDGE_CYCLE_TAB_CLOSURE_ARBITER_OWNER_REQUIRED',
  );
  const readCycleState = requireNudgeOwner(getCycleState, 'GET_CYCLE_STATE_OWNER_REQUIRED');
  const resolveNudgeRunId = requireNudgeOwner(normalizeNudgeRunId, 'NUDGE_RUN_ID_NORMALIZER_OWNER_REQUIRED');
  const markPresented = requireNudgeOwner(markNudgePresented, 'NUDGE_PRESENTED_OWNER_REQUIRED');
  const markEpisodeCompleted = requireNudgeOwner(
    markNudgeEpisodeCompleted,
    'NUDGE_EPISODE_COMPLETED_OWNER_REQUIRED',
  );
  const markResolved = requireNudgeOwner(markNudgeResolved, 'NUDGE_RESOLVED_OWNER_REQUIRED');
  const markAborted = requireNudgeOwner(markNudgeAborted, 'NUDGE_ABORTED_OWNER_REQUIRED');
  const scheduleTerminalOutboxDrain = requireNudgeOwner(
    scheduleNudgeTerminalOutboxDrain,
    'NUDGE_TERMINAL_OUTBOX_DRAIN_OWNER_REQUIRED',
  );
  const updateResetHour = requireNudgeOwner(setResetHour, 'SET_RESET_HOUR_OWNER_REQUIRED');
  const acceptReset = requireNudgeOwner(acceptResetRecommendation, 'ACCEPT_RESET_RECOMMENDATION_OWNER_REQUIRED');
  const dismissReset = requireNudgeOwner(dismissResetRecommendation, 'DISMISS_RESET_RECOMMENDATION_OWNER_REQUIRED');
  const trackRecoveryPresented = requireNudgeOwner(
    trackProtectionRecoveryPresented,
    'RECOVERY_PRESENTED_TRACKING_OWNER_REQUIRED',
  );
  const resolvedBrowserPort = requireNudgeCycleBrowserPort(browserPort);

  const scheduleTerminalEffects = (transition) => {
    const receipt = scheduleTerminalOutboxDrain({ runId: transition.entry.runId });
    if (receipt?.status !== 'scheduled') {
      throw new Error('NUDGE_TERMINAL_OUTBOX_DRAIN_RECEIPT_INVALID');
    }
    return transition.replayed
      ? { success: true, alreadyApplied: true }
      : { success: true };
  };

  const sendCycleStateSnapshot = (_request, _sender, sendResponse) => {
    const resolved = resolveCycleStateSnapshot(readCycleState);
    if (!resolved.ok) {
      sendResponse({ success: false, error: resolved.error });
      return false;
    }
    const { snapshot } = resolved;
    sendResponse({
      currentCycleStart: snapshot?.currentCycleStart,
      lastActivityAt: snapshot?.lastActivityAt,
      previousCycleStats: snapshot?.previousCycleStats,
      resetPolicy: snapshot?.resetPolicy || null,
    });
    return false;
  };

  const handleResolved = (request, sender, sendResponse) => {
    const key = request?.key;
    if (!key) {
      sendResponse({ success: false, error: 'INVALID_NUDGE_KEY' });
      return false;
    }

    const identity = resolveLifecycleIdentity(request, sender, resolveNudgeRunId);
    if (!identity.ok) {
      sendResponse({ success: false, error: identity.error });
      return false;
    }
    return runAsyncHandler(
      sendResponse,
      async () => {
        const now = Date.now();
        const result = await Promise.resolve(
          markResolved(
            key,
            {
              runId: identity.runId,
              tabId: identity.tabId,
              now,
              reason: request?.reason || 'resolved',
              durationMs: request?.durationMs || 0,
              hostname: request?.hostname || request?.domain || '',
            },
          ),
        );
        const transition = resolveTerminalTransition(result);
        if (!transition.ok) {
          return { success: false, error: transition.error, retryable: false };
        }
        return scheduleTerminalEffects(transition);
      },
      (error) => ({ success: false, error: error?.message || 'NUDGE_RESOLVED_FAILED' }),
    );
  };

  const handleEpisodeAbsorbed = (request, sender, sendResponse) => {
    const key = request?.key;
    if (!key) {
      sendResponse({ success: false, error: 'INVALID_NUDGE_KEY' });
      return false;
    }

    const identity = resolveLifecycleIdentity(request, sender, resolveNudgeRunId);
    if (!identity.ok) {
      sendResponse({ success: false, error: identity.error });
      return false;
    }
    return runAsyncHandler(
      sendResponse,
      async () => {
        const applied = await Promise.resolve(
          markEpisodeCompleted(
            key,
            {
              runId: identity.runId,
              tabId: identity.tabId,
              now: Date.now(),
            },
          ),
        );
        return { success: applied !== false };
      },
      (error) => ({ success: false, error: error?.message || 'NUDGE_EPISODE_ABSORBED_FAILED' }),
    );
  };

  return {
    ...createInterventionAdmissionHandlers(),
    [MESSAGE_ACTIONS.SITE_FURIN_CLOSE_CURRENT_TAB]: (request, sender, sendResponse) => {
      const tabId = resolveTrustedSenderTabId(sender);
      if (tabId === null || sender.frameId !== 0 || !sender.documentId) {
        sendResponse({ success: false, error: 'SITE_FURIN_SENDER_DOCUMENT_REQUIRED' });
        return false;
      }
      return runAsyncHandler(sendResponse, async () => {
        const result = await requestTabClosureOwner({
          tabId, documentId: sender.documentId, admissionLease: request.admissionLease,
          requester: TAB_CLOSURE_REQUESTERS.SITE_FURIN_LEAVE, reason: 'site_furin_leave',
        });
        return { success: result.outcome === TAB_CLOSURE_OUTCOMES.CLOSED, ...result };
      }, error => ({ success: false, error: error.message }));
    },
    [MESSAGE_ACTIONS.OPEN_NUDGE_RECOVERY_DASHBOARD]: (request, sender, sendResponse) => {
      const senderTabId = resolveTrustedSenderTabId(sender);
      if (senderTabId === null) {
        sendResponse({ success: false, error: 'UNTRUSTED_SENDER' });
        return false;
      }

      return runAsyncHandler(
        sendResponse,
        async () => {
          const resolved = resolveExtensionDashboardUrl(request, resolvedBrowserPort);
          if (!resolved.ok) {
            return { success: false, error: resolved.error };
          }
          const opened = await getInterventionAdmissionService().resolve({
            leaseId: request.admissionLease?.leaseId, tabId: senderTabId, documentId: sender.documentId,
          }, () => openBrowserTab({
            url: resolved.url,
            active: true,
          }, resolvedBrowserPort));
          return opened.ok
            ? { success: true }
            : { success: false, error: opened.error };
        },
        () => ({ success: false, error: 'DASHBOARD_OPEN_FAILED' }),
      );
    },

    [MESSAGE_ACTIONS.OPEN_NUDGE_ROOM_478]: (request, sender, sendResponse) => {
      const senderTabId = resolveTrustedSenderTabId(sender);
      if (senderTabId === null) {
        sendResponse({ success: false, error: 'UNTRUSTED_SENDER' });
        return false;
      }

      return runAsyncHandler(
        sendResponse,
        async () => {
          const resolved = resolveExtensionRoom478Url(request, resolvedBrowserPort);
          if (!resolved.ok) {
            return { success: false, error: resolved.error };
          }
          const updated = await getInterventionAdmissionService().resolve({
            leaseId: request.admissionLease?.leaseId, tabId: senderTabId, documentId: sender.documentId,
          }, () => resolvedBrowserPort.tabsUpdate(senderTabId, { url: resolved.url }), { documentHandoff: true });
          if (updated?.outcome === 'refused') {
            if (typeof updated.refusalReason !== 'string' || !updated.refusalReason) {
              throw new Error('ROOM_478_ADMISSION_RECEIPT_INVALID');
            }
            return {
              success: false,
              outcome: updated.outcome,
              refusalReason: updated.refusalReason,
              refusedBy: updated.refusedBy,
              error: `ROOM_478_ADMISSION_REFUSED:${updated.refusalReason}`,
            };
          }
          if (
            updated?.error
            || !updated?.tab
            || Number(updated.tab.id) !== senderTabId
          ) {
            return {
              success: false,
              error: updated?.error || 'ROOM_478_TAB_UPDATE_FAILED',
            };
          }
          return { success: true };
        },
        (error) => ({ success: false, error: error?.message || String(error || 'ROOM_478_TAB_UPDATE_FAILED') }),
      );
    },

    [MESSAGE_ACTIONS.ENSO_GATE_CLOSE_CURRENT_TAB]: (request, sender, sendResponse) => {
      const senderTabId = resolveTrustedSenderTabId(sender);
      if (senderTabId === null) {
        sendResponse({ success: false, error: 'UNTRUSTED_SENDER' });
        return false;
      }

      return runAsyncHandler(
        sendResponse,
        async () => {
          // The enso veil is an exit ritual: leaving means the page is done, so
          // closing the tab is the conclusion rather than a side effect. It is
          // the lowest-ranked closer though, so the arbiter decides whether a
          // higher intervention has already claimed this tab.
          const result = await requestTabClosureOwner({
            tabId: senderTabId,
            requester: TAB_CLOSURE_REQUESTERS.ENSO_GATE_LEAVE,
            admissionLease: request.admissionLease,
            documentId: sender.documentId,
            reason: typeof request?.reason === 'string' ? request.reason : '',
          });
          return {
            success: result.outcome === TAB_CLOSURE_OUTCOMES.CLOSED,
            outcome: result.outcome,
            refusedBy: result.refusedBy,
            refusalReason: result.refusalReason,
            error: result.outcome === TAB_CLOSURE_OUTCOMES.FAILED
              ? (result.error || 'TABS_REMOVE_FAILED')
              : null,
          };
        },
        () => ({
          success: false,
          outcome: TAB_CLOSURE_OUTCOMES.FAILED,
          error: 'TAB_CLOSE_FAILED',
        }),
      );
    },

    [MESSAGE_ACTIONS.NUDGE_PRESENTED]: (request, sender, sendResponse) => {
      const key = request?.key;
      if (!key) {
        sendResponse({ success: false, error: 'INVALID_NUDGE_KEY' });
        return false;
      }

      const identity = resolveLifecycleIdentity(request, sender, resolveNudgeRunId);
      if (!identity.ok) {
        sendResponse({ success: false, error: identity.error });
        return false;
      }
      return runAsyncHandler(
        sendResponse,
        async () => {
          const now = Date.now();
          const warnings = [];
          const applied = await Promise.resolve(
            markPresented(
              key,
              {
                runId: identity.runId,
                tabId: identity.tabId,
                now,
                  validatePresentation: goalBinding => getInterventionAdmissionService().validateGoalPresentation({
                    leaseId: request.leaseId, goalBinding, key, runId: identity.runId,
                    tabId: identity.tabId, documentId: resolveSenderDocumentId(sender),
                  }),
              },
            ),
          );
          const success = applied !== false;
          if (success) {
            await recordSideEffectWarning(
              warnings,
              'RECOVERY_PRESENTED_TRACKING_FAILED',
              () => trackRecoveryPresented({
                key,
                hostname: request?.hostname || request?.domain || '',
                runId: identity.runId,
                tabId: identity.tabId,
                now,
              }),
            );
          }
          return attachWarnings(
            success
              ? { success: true }
              : {
                success: false,
                error: 'NUDGE_PRESENTED_AUTHORITY_REJECTED',
                retryable: false,
              },
            warnings,
          );
        },
        (error) => ({ success: false, error: error?.message || 'NUDGE_PRESENTED_FAILED' }),
      );
    },

    [MESSAGE_ACTIONS.NUDGE_EPISODE_ABSORBED]: handleEpisodeAbsorbed,

    [MESSAGE_ACTIONS.NUDGE_RESOLVED]: handleResolved,

    [MESSAGE_ACTIONS.NUDGE_ACK]: handleResolved,

    [MESSAGE_ACTIONS.NUDGE_ABORTED]: (request, sender, sendResponse) => {
      const key = request?.key;
      if (!key) {
        sendResponse({ success: false, error: 'INVALID_NUDGE_KEY' });
        return false;
      }

      const identity = resolveLifecycleIdentity(request, sender, resolveNudgeRunId);
      if (!identity.ok) {
        sendResponse({ success: false, error: identity.error });
        return false;
      }
      return runAsyncHandler(
        sendResponse,
        async () => {
          const now = Date.now();
          const result = await Promise.resolve(
            markAborted(
              key,
              {
                reason: request.reason || 'aborted',
                runId: identity.runId,
                tabId: identity.tabId,
                now,
                durationMs: request?.durationMs || 0,
                hostname: request?.hostname || request?.domain || '',
              },
            ),
          );
          if (result?.outcome === 'cancellation_pending') {
            if (result.entry !== null || typeof result.reason !== 'string' || !result.reason
              || result.reason !== result.reason.trim()) throw new Error('NUDGE_CANCELLATION_PENDING_RECEIPT_INVALID');
            return { success: true, terminalCommitted: false, cancellationPending: true, reason: result.reason };
          }
          const transition = resolveTerminalTransition(result);
          if (!transition.ok) {
            return { success: false, error: transition.error, retryable: false };
          }
          return scheduleTerminalEffects(transition);
        },
        (error) => ({ success: false, error: error?.message || 'NUDGE_ABORTED_FAILED' }),
      );
    },

    [MESSAGE_ACTIONS.GET_CYCLE_STATE]: sendCycleStateSnapshot,

    [MESSAGE_ACTIONS.SET_RESET_HOUR]: (request, _sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        const nextHour = request?.hour;
        if (!Number.isInteger(nextHour) || nextHour < 0 || nextHour > 23) {
          return { success: false, error: 'INVALID_RESET_HOUR' };
        }
        const resolved = resolveRequiredCycleStateSnapshot(
          await updateResetHour(nextHour),
          'SET_RESET_HOUR_CYCLE_STATE_INVALID',
        );
        if (!resolved.ok) {
          return { success: false, error: resolved.error };
        }
        return {
          success: true,
          cycleState: resolved.snapshot,
        };
      },
      (error) => ({ success: false, error: error?.message || 'SET_RESET_HOUR_FAILED' }),
    ),

    [MESSAGE_ACTIONS.ACCEPT_RESET_RECOMMENDATION]: (_request, _sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        const snapshot = await acceptReset();
        if (!snapshot) {
          return { success: false, error: 'NO_RECOMMENDATION' };
        }
        const resolved = resolveRequiredCycleStateSnapshot(
          snapshot,
          'ACCEPT_RESET_RECOMMENDATION_CYCLE_STATE_INVALID',
        );
        if (!resolved.ok) {
          return { success: false, error: resolved.error };
        }
        return {
          success: true,
          cycleState: resolved.snapshot,
        };
      },
      (error) => ({ success: false, error: error?.message || 'ACCEPT_RESET_RECOMMENDATION_FAILED' }),
    ),

    [MESSAGE_ACTIONS.DISMISS_RESET_RECOMMENDATION]: (_request, _sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        const resolved = resolveRequiredCycleStateSnapshot(
          await dismissReset(),
          'DISMISS_RESET_RECOMMENDATION_CYCLE_STATE_INVALID',
        );
        if (!resolved.ok) {
          return { success: false, error: resolved.error };
        }
        return {
          success: true,
          cycleState: resolved.snapshot,
        };
      },
      (error) => ({ success: false, error: error?.message || 'DISMISS_RESET_RECOMMENDATION_FAILED' }),
    ),
  };
}
