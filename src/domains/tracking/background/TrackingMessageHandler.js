import { resolveTrackingMessageHandlerDependencies } from './trackingMessageDependencyResolver.js';
import { createTrackingMessagePolicy } from './trackingMessagePolicy.js';
import { createNudgeCycleActionHandlers } from './trackingMessageHandlers/nudgeCycleHandlers.js';
import { createPopupActionHandlers } from './trackingMessageHandlers/popupHandlers.js';
import { createProtectionRuntimeActionHandlers } from './trackingMessageHandlers/protectionRuntimeHandlers.js';
import { createSettingsActionHandlers } from './trackingMessageHandlers/settingsHandlers.js';
import { createStatsQueryActionHandlers } from './trackingMessageHandlers/statsQueryHandlers.js';
import { createStorageSupportActionHandlers } from './trackingMessageHandlers/storageSupportHandlers.js';
import { createSupportActionHandlers } from './trackingMessageHandlers/supportActionHandlers.js';
import { createSpecialSessionActionHandlers } from './trackingMessageHandlers/specialSessionHandlers.js';
import { createIndicatorNavigationActionHandlers } from './trackingMessageHandlers/indicatorNavigationHandlers.js';

export function createTrackingMessageHandler(dependencies = {}) {
  const {
    policy: policyDependencies,
    statsQueries,
    protectionRuntime,
    popupDomain,
    storageSupport,
    supportDebug,
    settings,
    nudgeCycle,
    specialSession,
    indicatorNavigation,
  } = resolveTrackingMessageHandlerDependencies({
    ...dependencies,
  });

  const policy = createTrackingMessagePolicy(policyDependencies);
  const actionHandlers = {
    ...createIndicatorNavigationActionHandlers(indicatorNavigation),
    ...createStatsQueryActionHandlers(statsQueries),
    ...createProtectionRuntimeActionHandlers({
      ...protectionRuntime,
      isRestrictedAt: policy.isRestrictedAt,
    }),
    ...createSpecialSessionActionHandlers(specialSession),
    ...createPopupActionHandlers(popupDomain),
    ...createStorageSupportActionHandlers({
      ...storageSupport,
      authorizeDestructiveRuntimeAction: policy.authorizeDestructiveRuntimeAction,
      readSettingsSnapshot: policy.readSettingsSnapshot,
    }),
    ...createSupportActionHandlers({
      ...supportDebug,
      authorizeNudgeDebugControl: policy.authorizeNudgeDebugControl,
      isPageUrlBoundToSenderTab: policy.isPageUrlBoundToSenderTab,
      resolveTrustedSenderTabUrl: policy.resolveTrustedSenderTabUrl,
    }),
    ...createSettingsActionHandlers({
      ...settings,
      authorizeSettingsWriteSender: policy.authorizeSettingsWriteSender,
      buildSettingsReadPayload: policy.buildSettingsReadPayload,
      redactSensitiveSettingsMap: policy.redactSensitiveSettingsMap,
      redactSensitiveSettingsPayload: policy.redactSensitiveSettingsPayload,
      readSettingsSnapshot: policy.readSettingsSnapshot,
    }),
    ...createNudgeCycleActionHandlers({
      ...nudgeCycle,
      isNudgeStayReason: policy.isNudgeStayReason,
      normalizeNudgeRunId: policy.normalizeNudgeRunId,
      persistGlobalSentinelOutcomeDecision: policy.persistGlobalSentinelOutcomeDecision,
      persistNudgeStayDecision: policy.persistNudgeStayDecision,
    }),
  };

  return function handleActionMessage(request, sender, sendResponse) {
    if (!request) return false;

    const action = request.action;
    if (!action) {
      return false;
    }
    const senderAuthorization = policy.authorizeActionSender(action, sender);
    if (!senderAuthorization.authorized) {
      sendResponse({ success: false, error: senderAuthorization.error });
      return false;
    }

    const actionHandler = actionHandlers[action];
    if (typeof actionHandler !== 'function') {
      return false;
    }
    return actionHandler(request, sender, sendResponse);
  };
}
