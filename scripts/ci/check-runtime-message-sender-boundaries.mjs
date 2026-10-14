#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const rootDir = process.cwd();

const fail = (message) => {
  console.error(`[runtime-message-sender-boundaries] FAIL: ${message}`);
  process.exit(1);
};

const readUtf8 = async (relativePath) => (
  fs.readFile(path.resolve(rootDir, relativePath), 'utf8')
);

const assertIncludes = (source, token, filePath) => {
  if (!source.includes(token)) {
    fail(`${filePath} must include "${token}"`);
  }
};

const assertNotIncludes = (source, token, filePath) => {
  if (source.includes(token)) {
    fail(`${filePath} must not include legacy runtime action alias "${token}"`);
  }
};

const importProjectModule = (relativePath) => import(pathToFileURL(path.resolve(rootDir, relativePath)).href);

const collectMessageActionNames = async (relativeDir) => {
  const absoluteDir = path.resolve(rootDir, relativeDir);
  const entries = await fs.readdir(absoluteDir, { withFileTypes: true });
  const actionNames = new Set();

  await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(absoluteDir, entry.name);
    if (entry.isDirectory()) {
      const nested = await collectMessageActionNames(path.relative(rootDir, entryPath));
      nested.forEach((actionName) => actionNames.add(actionName));
      return;
    }
    if (!entry.isFile() || !entry.name.endsWith('.js')) return;

    const source = await fs.readFile(entryPath, 'utf8');
    for (const match of source.matchAll(/\bMESSAGE_ACTIONS\.([A-Z0-9_]+)\b/g)) {
      actionNames.add(match[1]);
    }
  }));

  return actionNames;
};

const main = async () => {
  const trackingHandlerPath = 'src/domains/tracking/background/TrackingMessageHandler.js';
  const trackingPolicyPath = 'src/domains/tracking/background/trackingMessagePolicy.js';
  const actionSenderPolicyPath = 'src/domains/tracking/background/trackingMessagePolicies/actionSenderPolicy.js';
  const settingsAccessPolicyPath = 'src/domains/tracking/background/trackingMessagePolicies/settingsAccessPolicy.js';
  const supportDebugPolicyPath = 'src/domains/tracking/background/trackingMessagePolicies/supportDebugPolicy.js';
  const supportActionHandlersPath = 'src/domains/tracking/background/trackingMessageHandlers/supportActionHandlers.js';
  const nudgeCycleHandlersPath = 'src/domains/tracking/background/trackingMessageHandlers/nudgeCycleHandlers.js';
  const nudgeDispatchMessageBuilderPath = 'src/domains/protection/background/protocol/dispatch/ProtectionNudgeDispatchMessageBuilder.js';
  const backgroundRouterPath = 'src/apps/background/services/runtime/BackgroundMessageRouter.js';
  const popupRoutePath = 'src/apps/background/services/runtime/messageRoutes/popupBlockMessageRoutes.js';
  const trackingRuntimeRoutePath = 'src/apps/background/services/runtime/messageRoutes/trackingRuntimeMessageRoutes.js';
  const trackingSpecialRuntimePath = 'src/domains/tracking/background/trackingSpecialRuntimeHandlers.js';
  const boundedKeyedCommitQueuePath = 'src/domains/tracking/background/boundedKeyedCommitQueue.js';
  const trackingContentRuntimePath = 'src/domains/tracking/background/trackingContentRuntimeHandlers.js';
  const trackingContentProtectionSyncPath =
    'src/domains/tracking/background/trackingContentProtectionSync.js';
  const contentFlowContractPath = 'src/platform/messaging/contracts/contentFlowSignal.js';
  const contentFlowSenderPath = 'src/domains/nudge/core/telemetry.js';
  const feedFlowContractPath = 'src/domains/protection/contracts/feedFlowSnapshotBridge.js';
  const feedFlowSenderPath = 'src/domains/nudge/feed-flow/bridge/feedFlowSnapshotEvents.js';
  const feedFlowRuntimeStateOwnerPath = 'src/domains/protection/background/runtime/FeedFlowRuntimeStateOwner.js';
  const scrollSpikeAggregatorPath = 'src/domains/nudge/behavior/ScrollSpikeSignalAggregator.js';
  const shortMediaAggregatorPath = 'src/domains/nudge/video/ShortMediaAttentionSignalAggregator.js';
  const behaviorHubPath = 'src/domains/nudge/behavior/BehaviorHub.js';
  const scrollInputOrchestratorPath = 'src/domains/nudge/behavior/scrollInputOrchestrator.js';
  const interactionManagerPath = 'src/domains/nudge/interactionManager.js';
  const contentBehaviorCapabilitiesPath = 'src/domains/nudge/core/contentBehaviorCapabilities.js';
  const viteConfigPath = 'vite.config.js';

  const trackingHandlerSource = await readUtf8(trackingHandlerPath);
  const trackingPolicySource = await readUtf8(trackingPolicyPath);
  const actionSenderPolicySource = await readUtf8(actionSenderPolicyPath);
  const settingsAccessPolicySource = await readUtf8(settingsAccessPolicyPath);
  const supportDebugPolicySource = await readUtf8(supportDebugPolicyPath);
  const supportActionHandlersSource = await readUtf8(supportActionHandlersPath);
  const nudgeCycleHandlersSource = await readUtf8(nudgeCycleHandlersPath);
  const nudgeDispatchMessageBuilderSource = await readUtf8(nudgeDispatchMessageBuilderPath);
  const backgroundRouterSource = await readUtf8(backgroundRouterPath);
  const popupRouteSource = await readUtf8(popupRoutePath);
  const trackingRuntimeRouteSource = await readUtf8(trackingRuntimeRoutePath);
  const trackingSpecialRuntimeSource = await readUtf8(trackingSpecialRuntimePath);
  const boundedKeyedCommitQueueSource = await readUtf8(boundedKeyedCommitQueuePath);
  const trackingContentRuntimeSource = await readUtf8(trackingContentRuntimePath);
  const trackingContentProtectionSyncSource = await readUtf8(
    trackingContentProtectionSyncPath,
  );
  const contentFlowContractSource = await readUtf8(contentFlowContractPath);
  const contentFlowSenderSource = await readUtf8(contentFlowSenderPath);
  const feedFlowContractSource = await readUtf8(feedFlowContractPath);
  const feedFlowSenderSource = await readUtf8(feedFlowSenderPath);
  const feedFlowRuntimeStateOwnerSource = await readUtf8(feedFlowRuntimeStateOwnerPath);
  const scrollSpikeAggregatorSource = await readUtf8(scrollSpikeAggregatorPath);
  const shortMediaAggregatorSource = await readUtf8(shortMediaAggregatorPath);
  const behaviorHubSource = await readUtf8(behaviorHubPath);
  const scrollInputOrchestratorSource = await readUtf8(scrollInputOrchestratorPath);
  const interactionManagerSource = await readUtf8(interactionManagerPath);
  const contentBehaviorCapabilitiesSource = await readUtf8(contentBehaviorCapabilitiesPath);
  const viteConfigSource = await readUtf8(viteConfigPath);

  const { MESSAGE_ACTIONS } = await importProjectModule('src/platform/messaging/messageTypes.js');
  const {
    ACTION_SENDER_POLICY,
    ACTION_SENDER_SCOPE,
    createActionSenderPolicy,
  } = await importProjectModule(actionSenderPolicyPath);
  const {
    CONTENT_FLOW_SIGNAL_COMMIT_DEADLINE_MS,
    CONTENT_FLOW_SIGNAL_DELIVERY_TIMEOUT_MS,
  } = await importProjectModule(contentFlowContractPath);
  const {
    FEED_FLOW_SNAPSHOT_COMMIT_DEADLINE_MS,
    FEED_FLOW_SNAPSHOT_DELIVERY_TIMEOUT_MS,
  } = await importProjectModule(feedFlowContractPath);
  if (
    CONTENT_FLOW_SIGNAL_COMMIT_DEADLINE_MS !== 1_500
    || CONTENT_FLOW_SIGNAL_DELIVERY_TIMEOUT_MS !== 2_000
    || CONTENT_FLOW_SIGNAL_COMMIT_DEADLINE_MS >= CONTENT_FLOW_SIGNAL_DELIVERY_TIMEOUT_MS
  ) {
    fail(
      `${contentFlowContractPath} must keep the 1,500ms background commit deadline inside the 2,000ms sender delivery lease.`,
    );
  }
  if (
    FEED_FLOW_SNAPSHOT_COMMIT_DEADLINE_MS !== 1_500
    || FEED_FLOW_SNAPSHOT_DELIVERY_TIMEOUT_MS !== 2_000
    || FEED_FLOW_SNAPSHOT_COMMIT_DEADLINE_MS >= FEED_FLOW_SNAPSHOT_DELIVERY_TIMEOUT_MS
  ) {
    fail(
      `${feedFlowContractPath} must keep the 1,500ms background commit deadline inside the 2,000ms sender delivery lease.`,
    );
  }
  if (Object.prototype.hasOwnProperty.call(MESSAGE_ACTIONS, 'NUDGE_CONFIG_UPDATED')) {
    fail('MESSAGE_ACTIONS.NUDGE_CONFIG_UPDATED is retired; nudge settings propagation belongs to the durable protection broadcast.');
  }

  const assertActionScope = (actionName, expectedScope) => {
    const action = MESSAGE_ACTIONS[actionName];
    if (!action) {
      fail(`MESSAGE_ACTIONS.${actionName} is missing from src/platform/messaging/messageTypes.js`);
    }
    const policy = ACTION_SENDER_POLICY[action];
    if (!policy) {
      fail(`${actionSenderPolicyPath} must register MESSAGE_ACTIONS.${actionName}`);
    }
    if (policy.sender !== expectedScope) {
      fail(
        `${actionSenderPolicyPath} must scope MESSAGE_ACTIONS.${actionName} to ${expectedScope}, got ${policy.sender}`,
      );
    }
  };

  const handledActionNames = await collectMessageActionNames('src/domains/tracking/background/trackingMessageHandlers');
  handledActionNames.forEach((actionName) => {
    const action = MESSAGE_ACTIONS[actionName];
    if (!action) {
      fail(`handler references unknown MESSAGE_ACTIONS.${actionName}`);
    }
    if (!ACTION_SENDER_POLICY[action]) {
      fail(`${actionSenderPolicyPath} must register handled action MESSAGE_ACTIONS.${actionName}`);
    }
  });

  const requiredExtensionPageActions = [
    'GET_ANALYSIS_BOOTSTRAP_SNAPSHOT',
    'GET_CYCLE_PROJECTION',
    'GET_STATUS_SNAPSHOT',
    'GET_SITES_SNAPSHOT',
    'GET_TREND_SUMMARY',
    'GET_DOMAIN_SERIES',
    'GET_CYCLE_STATE',
    'SET_RESET_HOUR',
    'ACCEPT_RESET_RECOMMENDATION',
    'DISMISS_RESET_RECOMMENDATION',
    'GET_BOOT_PREWARM_SNAPSHOT',
    'GET_PROTECTION_RUNTIME_SNAPSHOT',
    'REFRESH_PROTECTION_RUNTIME_SNAPSHOT',
    'GET_GATE_INTERSTITIAL_SESSION',
    'SUBMIT_GATE_INTERSTITIAL_DECISION',
    'GET_POPUP_SITE_SNAPSHOT',
    'POPUP_PROTECT_SITE',
    'DEBUG_GET_TRACKING_RUNTIME_STATE',
    'DEBUG_GET_CONTENT_RUNTIME_DIAGNOSTICS',
    'DEBUG_GET_SENTINEL_PROTOCOL_TIMELINE',
    'DEBUG_CLEAR_SENTINEL_PROTOCOL_TIMELINE',
    'DEBUG_DISPATCH_NUDGE_MESSAGE',
    'DEBUG_FORCE_SAVE',
    'DEBUG_RESET_STATS',
    'RESET_ANALYTICS_DATA',
    'RESET_APP_DATA',
    'CLEANUP_BLOCKED_HISTORY',
    'EXPORT_STORAGE_SNAPSHOT',
    'IMPORT_STORAGE_SNAPSHOT',
    'GET_STORAGE_INSPECTOR_SNAPSHOT',
    'RUN_STORAGE_SUPPORT_ACTION',
    'ZEN_GP_PAIRWISE_LOAD',
    'PREVIEW_BLOCKED_HISTORY',
    'PREVIEW_BLOCKED_BOOKMARKS',
  ];
  requiredExtensionPageActions.forEach((token) => {
    assertActionScope(token, ACTION_SENDER_SCOPE.EXTENSION_PAGE);
  });

  const requiredPrivilegedActions = [
    'SETTINGS_CHANGED',
  ];
  requiredPrivilegedActions.forEach((token) => {
    assertActionScope(token, ACTION_SENDER_SCOPE.PRIVILEGED_SETTINGS_FLOW);
  });

  const requiredTrustedSenderActions = [
    'GET_SETTINGS',
    'SET_SETTINGS',
    'GET_FAVICON_DATA',
  ];
  requiredTrustedSenderActions.forEach((token) => {
    assertActionScope(token, ACTION_SENDER_SCOPE.TRUSTED_EXTENSION_SENDER);
  });

  const requiredTrustedTabActions = [
    'OPEN_SITE_RECORD',
    'CAPTURE_FAVICON',
    'DEBUG_TRIGGER_SENTINEL_FLARE',
    'GET_FILTER_INDICATOR_INFO',
    'NUDGE_PRESENTED',
    'NUDGE_RESOLVED',
    'NUDGE_ABORTED',
    'NUDGE_ACK',
    'OPEN_NUDGE_RECOVERY_DASHBOARD',
    'OPEN_NUDGE_ROOM_478',
    'SITE_FURIN_CLOSE_CURRENT_TAB',
  ];
  requiredTrustedTabActions.forEach((token) => {
    assertActionScope(token, ACTION_SENDER_SCOPE.TRUSTED_EXTENSION_TAB);
  });

  assertIncludes(trackingHandlerSource, 'createTrackingMessagePolicy', trackingHandlerPath);
  if (trackingHandlerSource.includes('createTrackingSpecialRuntimeHandlers')) {
    fail(`${trackingHandlerPath} must not own special runtime type handlers anymore.`);
  }
  if (trackingHandlerSource.includes('request.action || type')) {
    fail(`${trackingHandlerPath} must not fall back from type dispatch into the action hub.`);
  }
  assertIncludes(trackingPolicySource, 'createActionSenderPolicy', trackingPolicyPath);
  assertIncludes(trackingPolicySource, 'createSettingsAccessPolicy', trackingPolicyPath);
  assertIncludes(trackingPolicySource, 'createSupportDebugPolicy', trackingPolicyPath);
  assertIncludes(actionSenderPolicySource, 'ACTION_SENDER_POLICY = Object.freeze({', actionSenderPolicyPath);
  assertIncludes(actionSenderPolicySource, "'UNREGISTERED_RUNTIME_ACTION'", actionSenderPolicyPath);
  assertNotIncludes(actionSenderPolicySource, 'LEGACY_EXTENSION_PAGE_ONLY_ACTIONS', actionSenderPolicyPath);
  assertNotIncludes(actionSenderPolicySource, "'get_cycle_state'", actionSenderPolicyPath);
  assertNotIncludes(actionSenderPolicySource, 'LEGACY_EXTENSION_PAGE_ONLY_ACTIONS.has(action)', actionSenderPolicyPath);
  assertNotIncludes(actionSenderPolicySource, 'MESSAGE_ACTIONS.NUDGE_CONFIG_UPDATED', actionSenderPolicyPath);
  assertIncludes(settingsAccessPolicySource, 'SENSITIVE_SETTINGS_KEYS', settingsAccessPolicyPath);
  assertIncludes(supportDebugPolicySource, 'resolveTrustedSenderTabId', supportDebugPolicyPath);
  assertIncludes(supportDebugPolicySource, 'BUILD_INCLUDE_DEBUG_TOOLS', supportDebugPolicyPath);
  assertIncludes(supportDebugPolicySource, 'normalizeDebugConfig', supportDebugPolicyPath);
  assertIncludes(trackingHandlerSource, 'authorizeNudgeDebugControl: policy.authorizeNudgeDebugControl', trackingHandlerPath);
  assertIncludes(supportActionHandlersSource, 'DEBUG_NUDGE_CONTROL_BLOCKED_BY_PRODUCTION_OWNER', supportActionHandlersPath);
  assertIncludes(supportActionHandlersSource, 'MESSAGE_TYPES.NUDGE_DEBUG_STOP', supportActionHandlersPath);
  assertIncludes(nudgeCycleHandlersSource, 'DEBUG_NUDGE_LIFECYCLE_UNAUTHORIZED', nudgeCycleHandlersPath);
  assertIncludes(
    nudgeDispatchMessageBuilderSource,
    'force ? MESSAGE_TYPES.NUDGE_DEBUG_START : MESSAGE_TYPES.NUDGE_START',
    nudgeDispatchMessageBuilderPath,
  );

  globalThis.chrome = {
    runtime: {
      id: 'entropy-ci-extension-id',
      getURL: (suffix = '') => `chrome-extension://entropy-ci-extension-id/${suffix}`,
    },
  };
  const actionSenderPolicy = createActionSenderPolicy();
  const unknownActionResult = actionSenderPolicy.authorizeActionSender('__UNREGISTERED_ACTION__', {
    id: 'entropy-ci-extension-id',
    url: 'chrome-extension://entropy-ci-extension-id/src/pages/dashboard.html',
  });
  if (
    unknownActionResult?.authorized !== false
    || unknownActionResult?.error !== 'UNREGISTERED_RUNTIME_ACTION'
  ) {
    fail(`${actionSenderPolicyPath} must default-deny unregistered runtime actions.`);
  }

  if (backgroundRouterSource.includes('allowInternalNoUrl: true')) {
    fail(`${backgroundRouterPath} must not trust popup sender without extension URL.`);
  }

  const popupActions = [
    'MESSAGE_ACTIONS.POPUP_QUEUE_BLOCK_DOMAIN',
    'MESSAGE_ACTIONS.POPUP_COMMIT_BLOCK_DOMAIN',
    'MESSAGE_ACTIONS.POPUP_CANCEL_BLOCK_DOMAIN',
  ];
  popupActions.forEach((token) => {
    assertIncludes(popupRouteSource, token, popupRoutePath);
  });
  assertIncludes(backgroundRouterSource, 'createPopupBlockMessageRoutes', backgroundRouterPath);
  assertIncludes(backgroundRouterSource, 'createTrackingRuntimeMessageRoutes', backgroundRouterPath);
  assertIncludes(popupRouteSource, 'isTrustedExtensionPageSender', popupRoutePath);
  assertIncludes(popupRouteSource, "error: 'UNTRUSTED_SENDER'", popupRoutePath);
  assertIncludes(trackingRuntimeRouteSource, 'createTrackingSpecialRuntimeHandlers', trackingRuntimeRoutePath);
  assertIncludes(trackingRuntimeRouteSource, 'createTrackingContentRuntimeHandlers', trackingRuntimeRoutePath);
  assertIncludes(trackingSpecialRuntimeSource, 'MESSAGE_TYPES.PROTECTION_RESYNC_REQUEST', trackingSpecialRuntimePath);
  assertIncludes(trackingSpecialRuntimeSource, 'MESSAGE_TYPES.CONTENT_FLOW_SIGNAL', trackingSpecialRuntimePath);
  assertIncludes(trackingSpecialRuntimeSource, 'readContentFlowSignal', trackingSpecialRuntimePath);
  assertIncludes(trackingSpecialRuntimeSource, 'CONTENT_FLOW_SIGNAL_COMMIT_FAILED', trackingSpecialRuntimePath);
  assertIncludes(trackingSpecialRuntimeSource, 'TRACKING_SPECIAL_RUNTIME_FEED_FLOW_PREPARE_OWNER_REQUIRED', trackingSpecialRuntimePath);
  assertIncludes(trackingSpecialRuntimeSource, 'TRACKING_SPECIAL_RUNTIME_FEED_FLOW_COMMIT_OWNER_REQUIRED', trackingSpecialRuntimePath);
  assertIncludes(trackingSpecialRuntimeSource, 'TRACKING_SPECIAL_RUNTIME_CONTENT_FLOW_SIGNAL_OWNER_REQUIRED', trackingSpecialRuntimePath);
  assertIncludes(trackingSpecialRuntimeSource, 'TRACKING_SPECIAL_RUNTIME_FEED_CONTENT_FLOW_OWNER_REQUIRED', trackingSpecialRuntimePath);
  assertIncludes(trackingSpecialRuntimeSource, 'TRACKING_SPECIAL_RUNTIME_PROTECTION_UPDATE_OWNER_REQUIRED', trackingSpecialRuntimePath);
  assertIncludes(trackingSpecialRuntimeSource, 'TRACKING_SPECIAL_RUNTIME_BROWSER_PORT_OWNER_REQUIRED', trackingSpecialRuntimePath);
  assertIncludes(trackingSpecialRuntimeSource, 'TRACKING_SPECIAL_RUNTIME_TAB_LOOKUP_FAILED', trackingSpecialRuntimePath);
  assertIncludes(trackingSpecialRuntimeSource, 'FEED_FLOW_TAB_URL_UNAVAILABLE', trackingSpecialRuntimePath);
  assertIncludes(trackingSpecialRuntimeSource, 'recordContentFlowSignal', trackingSpecialRuntimePath);
  assertIncludes(trackingSpecialRuntimeSource, 'createBoundedKeyedCommitQueue', trackingSpecialRuntimePath);
  assertIncludes(trackingSpecialRuntimeSource, 'runContentFlowSignalCommit', trackingSpecialRuntimePath);
  assertIncludes(trackingSpecialRuntimeSource, 'CONTENT_FLOW_SIGNAL_COMMIT_MAX_DEPTH = 8', trackingSpecialRuntimePath);
  assertIncludes(trackingSpecialRuntimeSource, 'CONTENT_FLOW_SIGNAL_COMMIT_DEADLINE_MS', trackingSpecialRuntimePath);
  assertIncludes(trackingSpecialRuntimeSource, 'contentFlowSignalCommitTimeoutMs = CONTENT_FLOW_SIGNAL_COMMIT_DEADLINE_MS', trackingSpecialRuntimePath);
  assertIncludes(trackingSpecialRuntimeSource, 'CONTENT_FLOW_SIGNAL_COMMIT_MAX_ACTIVE_TABS = 128', trackingSpecialRuntimePath);
  assertIncludes(trackingSpecialRuntimeSource, 'CONTENT_FLOW_SIGNAL_COMMIT_CAPACITY_EXCEEDED', trackingSpecialRuntimePath);
  assertIncludes(trackingSpecialRuntimeSource, 'CONTENT_FLOW_SIGNAL_COMMIT_QUEUE_POISONED', trackingSpecialRuntimePath);
  assertIncludes(trackingSpecialRuntimeSource, 'recordContentFlowFromFeedSnapshot', trackingSpecialRuntimePath);
  assertIncludes(trackingSpecialRuntimeSource, 'enqueueFeedFlowCommit', trackingSpecialRuntimePath);
  assertIncludes(trackingSpecialRuntimeSource, 'FEED_FLOW_SNAPSHOT_COMMIT_MAX_DEPTH = 8', trackingSpecialRuntimePath);
  assertIncludes(trackingSpecialRuntimeSource, 'FEED_FLOW_SNAPSHOT_COMMIT_MAX_ACTIVE_TABS = 128', trackingSpecialRuntimePath);
  assertIncludes(trackingSpecialRuntimeSource, 'feedFlowSnapshotCommitTimeoutMs = FEED_FLOW_SNAPSHOT_COMMIT_DEADLINE_MS', trackingSpecialRuntimePath);
  assertIncludes(trackingSpecialRuntimeSource, 'FEED_FLOW_SNAPSHOT_COMMIT_CAPACITY_EXCEEDED', trackingSpecialRuntimePath);
  assertIncludes(trackingSpecialRuntimeSource, 'FEED_FLOW_SNAPSHOT_COMMIT_QUEUE_POISONED', trackingSpecialRuntimePath);
  assertIncludes(trackingSpecialRuntimeSource, 'FEED_FLOW_CONTENT_STATS_COMMIT_FAILED', trackingSpecialRuntimePath);
  assertIncludes(trackingSpecialRuntimeSource, 'FEED_FLOW_CAPTURED_HOST_REQUIRED', trackingSpecialRuntimePath);
  assertIncludes(trackingSpecialRuntimeSource, 'FEED_FLOW_CAPTURED_HOST_MISMATCH', trackingSpecialRuntimePath);
  assertIncludes(trackingSpecialRuntimeSource, 'FEED_FLOW_PROTECTION_REFRESH_TIMEOUT_MS = 1_500', trackingSpecialRuntimePath);
  assertIncludes(trackingSpecialRuntimeSource, 'FEED_FLOW_PROTECTION_REFRESH_MAX_ACTIVE_TABS = 128', trackingSpecialRuntimePath);
  assertIncludes(trackingSpecialRuntimeSource, 'feedFlowProtectionRefreshByTabId.size >= feedFlowProtectionRefreshMaxActiveTabs', trackingSpecialRuntimePath);
  assertIncludes(trackingSpecialRuntimeSource, 'feedFlowProtectionRefreshCapacityWarningReported', trackingSpecialRuntimePath);
  assertIncludes(trackingSpecialRuntimeSource, 'state.pendingRequest = request', trackingSpecialRuntimePath);
  assertIncludes(trackingSpecialRuntimeSource, 'operation.timedOut = true', trackingSpecialRuntimePath);
  assertIncludes(trackingSpecialRuntimeSource, 'currentTab = await resolvedBrowserPort.tabsGet(tabId)', trackingSpecialRuntimePath);
  assertIncludes(trackingSpecialRuntimeSource, 'currentHostname !== request.hostname', trackingSpecialRuntimePath);
  assertIncludes(trackingSpecialRuntimeSource, 'sendProtectionUpdateOwner(tabId, currentTabUrl', trackingSpecialRuntimePath);
  assertIncludes(trackingSpecialRuntimeSource, 'FEED_FLOW_PROTECTION_REFRESH_TAB_LOOKUP_FAILED', trackingSpecialRuntimePath);
  assertIncludes(trackingSpecialRuntimeSource, 'FEED_FLOW_PROTECTION_REFRESH_HOST_MISMATCH', trackingSpecialRuntimePath);
  assertIncludes(boundedKeyedCommitQueueSource, 'deadlineAt: enqueuedAt + resolvedDeadlineMs', boundedKeyedCommitQueuePath);
  assertIncludes(boundedKeyedCommitQueueSource, 'state.poisoned = true', boundedKeyedCommitQueuePath);
  assertIncludes(boundedKeyedCommitQueueSource, 'rejectPending(state, resolvedErrorCodes.poisoned)', boundedKeyedCommitQueuePath);
  assertIncludes(boundedKeyedCommitQueueSource, 'queueByKey.size >= resolvedMaxActiveKeys', boundedKeyedCommitQueuePath);
  assertIncludes(boundedKeyedCommitQueueSource, 'depth >= resolvedMaxDepth', boundedKeyedCommitQueuePath);
  assertIncludes(contentFlowContractSource, "SCROLL_SPIKE: 'scroll_spike'", contentFlowContractPath);
  assertIncludes(contentFlowContractSource, "SHORT_MEDIA_ATTENTION: 'short_media_attention'", contentFlowContractPath);
  assertIncludes(contentFlowContractSource, 'CONTENT_FLOW_SIGNAL_SCHEMA_VERSION = 1', contentFlowContractPath);
  assertIncludes(contentFlowContractSource, 'CONTENT_FLOW_SCROLL_SPIKE_MAX_BATCH_COUNT = 10_000', contentFlowContractPath);
  assertIncludes(contentFlowContractSource, 'CONTENT_FLOW_SIGNAL_COMMIT_DEADLINE_MS = 1_500', contentFlowContractPath);
  assertIncludes(contentFlowContractSource, 'CONTENT_FLOW_SIGNAL_DELIVERY_TIMEOUT_MS = 2_000', contentFlowContractPath);
  assertIncludes(contentFlowContractSource, "'scrollSpikeBursts'", contentFlowContractPath);
  assertIncludes(contentFlowContractSource, "'fastScrollBursts'", contentFlowContractPath);
  assertIncludes(contentFlowContractSource, 'hasExactKeys', contentFlowContractPath);
  assertIncludes(contentFlowSenderSource, 'runtimeSendMessageReliable', contentFlowSenderPath);
  assertIncludes(contentFlowSenderSource, 'export { CONTENT_FLOW_SIGNAL_DELIVERY_TIMEOUT_MS };', contentFlowSenderPath);
  assertIncludes(contentFlowSenderSource, 'timeoutMs: CONTENT_FLOW_SIGNAL_DELIVERY_TIMEOUT_MS', contentFlowSenderPath);
  assertIncludes(contentFlowSenderSource, 'CONTENT_FLOW_SIGNAL_COMMIT_NOT_ACKNOWLEDGED', contentFlowSenderPath);
  assertIncludes(feedFlowContractSource, 'FEED_FLOW_SNAPSHOT_COMMIT_DEADLINE_MS = 1_500', feedFlowContractPath);
  assertIncludes(feedFlowContractSource, 'FEED_FLOW_SNAPSHOT_DELIVERY_TIMEOUT_MS = 2_000', feedFlowContractPath);
  assertIncludes(feedFlowContractSource, 'freezeCanonicalFeedFlowSnapshot(normalizedSnapshot)', feedFlowContractPath);
  assertIncludes(feedFlowContractSource, 'normalizedFeedFlowSnapshots.add(normalizedSnapshot)', feedFlowContractPath);
  assertIncludes(feedFlowRuntimeStateOwnerSource, 'isNormalizedFeedFlowSnapshot(snapshot)', feedFlowRuntimeStateOwnerPath);
  assertIncludes(feedFlowSenderSource, 'timeoutMs: FEED_FLOW_SNAPSHOT_DELIVERY_TIMEOUT_MS', feedFlowSenderPath);
  assertIncludes(scrollSpikeAggregatorSource, 'SCROLL_SPIKE_AGGREGATION_WINDOW_MS = 10_000', scrollSpikeAggregatorPath);
  assertIncludes(scrollSpikeAggregatorSource, 'SCROLL_SPIKE_MAX_PENDING_BATCHES = 8', scrollSpikeAggregatorPath);
  assertIncludes(scrollSpikeAggregatorSource, 'initialAdmissionEnabled = false', scrollSpikeAggregatorPath);
  assertIncludes(scrollSpikeAggregatorSource, 'pendingBuckets.length = 0', scrollSpikeAggregatorPath);
  assertIncludes(scrollSpikeAggregatorSource, 'capacityDroppedScrollSpikeBursts += 1', scrollSpikeAggregatorPath);
  assertIncludes(scrollSpikeAggregatorSource, 'resolveLocalHourBoundary', scrollSpikeAggregatorPath);
  assertIncludes(scrollSpikeAggregatorSource, 'timestamp < bucket.hourStartAt', scrollSpikeAggregatorPath);
  assertIncludes(scrollSpikeAggregatorSource, 'timestamp >= bucket.hourEndAt', scrollSpikeAggregatorPath);
  assertIncludes(scrollSpikeAggregatorSource, 'resolveLocalDateId(flushedAt) === bucket.localDateId', scrollSpikeAggregatorPath);
  assertIncludes(scrollSpikeAggregatorSource, 'localHourBoundaryResolutionCount += 1', scrollSpikeAggregatorPath);
  assertIncludes(shortMediaAggregatorSource, 'SHORT_MEDIA_ATTENTION_AGGREGATION_WINDOW_MS = 1000', shortMediaAggregatorPath);
  assertIncludes(shortMediaAggregatorSource, 'SHORT_MEDIA_ATTENTION_MAX_PENDING_REPORTS = 10_000', shortMediaAggregatorPath);
  assertIncludes(shortMediaAggregatorSource, 'SHORT_MEDIA_ATTENTION_MAX_PENDING_BATCHES = 8', shortMediaAggregatorPath);
  assertIncludes(shortMediaAggregatorSource, 'pendingAttentionSignals += 1', shortMediaAggregatorPath);
  assertIncludes(shortMediaAggregatorSource, 'flushPromise = deliverPendingBatch()', shortMediaAggregatorPath);
  assertIncludes(shortMediaAggregatorSource, 'completedBatches.length >= maxPendingBatches', shortMediaAggregatorPath);
  assertIncludes(shortMediaAggregatorSource, 'capacityDroppedWatchMs += batch.watchMs', shortMediaAggregatorPath);
  assertIncludes(shortMediaAggregatorSource, 'discardedAttentionSignals += pendingAttentionSignals', shortMediaAggregatorPath);
  assertIncludes(shortMediaAggregatorSource, 'observedAt: pendingObservedAt', shortMediaAggregatorPath);
  assertIncludes(shortMediaAggregatorSource, 'resolveLocalDateId(flushedAt) === batch.localDateId', shortMediaAggregatorPath);
  assertIncludes(shortMediaAggregatorSource, 'observedAt: deliveryObservedAt', shortMediaAggregatorPath);
  assertIncludes(behaviorHubSource, 'this._installWheelObserver();', behaviorHubPath);
  assertIncludes(behaviorHubSource, 'this._scrollSpikeSignalAggregator.record(wheelIntensity)', behaviorHubPath);
  assertIncludes(behaviorHubSource, 'if (!this._clseReporter) return;', behaviorHubPath);
  assertIncludes(behaviorHubSource, "if (this._clseReporter) {\n      bindings.push(", behaviorHubPath);
  if (interactionManagerSource.includes('ScrollSpikeSignalAggregator')) {
    fail(`${interactionManagerPath} must not couple precision scroll collection to scroll friction.`);
  }
  assertIncludes(contentBehaviorCapabilitiesSource, 'enableContentFlowSignals', contentBehaviorCapabilitiesPath);
  assertIncludes(viteConfigSource, 'enableContentFlowSignals: true', viteConfigPath);
  assertIncludes(viteConfigSource, '__ENTROPY_BUILD_ENABLE_CONTENT_FLOW_SIGNALS__', viteConfigPath);
  if (contentFlowContractSource.includes('deltaPx')) {
    fail(`${contentFlowContractPath} must transport aggregate scroll counts, not raw wheel deltas.`);
  }
  if (scrollSpikeAggregatorSource.includes('getLocalHourKey')) {
    fail(`${scrollSpikeAggregatorPath} must not rebuild a formatted local-hour key on every wheel spike.`);
  }
  if (scrollInputOrchestratorSource.includes('buildTargetPath(event)')) {
    fail(`${scrollInputOrchestratorPath} must not rebuild an unused DOM target path on every wheel observation.`);
  }
  const feedHandlerAt = trackingSpecialRuntimeSource.indexOf('[MESSAGE_TYPES.FEED_FLOW_SNAPSHOT_UPDATED]');
  const feedCapturedHostAt = trackingSpecialRuntimeSource.indexOf(
    'const capturedHostname = snapshotHostname || senderHostname;',
    feedHandlerAt,
  );
  const feedEnqueueAt = trackingSpecialRuntimeSource.indexOf(
    'return enqueueFeedFlowCommit(tabId, async () => {',
    feedHandlerAt,
  );
  const feedTrustedUrlAt = trackingSpecialRuntimeSource.indexOf(
    'const tabUrl = await resolveTrustedTabUrl(',
    feedEnqueueAt,
  );
  const feedTrustedHostMatchAt = trackingSpecialRuntimeSource.indexOf(
    'if (hostname !== capturedHostname)',
    feedTrustedUrlAt,
  );
  const feedNormalizeAt = trackingSpecialRuntimeSource.indexOf(
    'const normalizedSnapshot = buildFeedFlowSnapshot({',
    feedTrustedUrlAt,
  );
  const feedPrepareAt = trackingSpecialRuntimeSource.indexOf(
    'const prepared = prepareFeedFlowSnapshotOwner({',
    feedNormalizeAt,
  );
  const feedDurableAt = trackingSpecialRuntimeSource.indexOf('await recordContentFlowFromFeedSnapshotOwner({');
  const feedCommitAt = trackingSpecialRuntimeSource.indexOf('commitFeedFlowSnapshotOwner(prepared)');
  const feedProtectionRefreshScheduleAt = trackingSpecialRuntimeSource.indexOf(
    'scheduleFeedFlowProtectionRefresh(tabId, hostname);',
    feedCommitAt,
  );
  if (!(
    feedHandlerAt >= 0
    && feedCapturedHostAt > feedHandlerAt
    && feedEnqueueAt > feedCapturedHostAt
    && feedTrustedUrlAt > feedEnqueueAt
    && feedTrustedHostMatchAt > feedTrustedUrlAt
    && feedNormalizeAt > feedTrustedHostMatchAt
    && feedPrepareAt > feedNormalizeAt
    && feedDurableAt > feedPrepareAt
    && feedCommitAt > feedDurableAt
    && feedProtectionRefreshScheduleAt > feedCommitAt
  )) {
    fail(`${trackingSpecialRuntimePath} must capture host before enqueue, validate the trusted runtime host, preserve prepare -> durable stats -> baseline commit ordering, then schedule the derived refresh.`);
  }
  if (trackingSpecialRuntimeSource.indexOf('await sendProtectionUpdateOwner(', feedCommitAt) >= 0) {
    fail(`${trackingSpecialRuntimePath} must not await protection refresh after the durable feed baseline commit.`);
  }
  if (trackingSpecialRuntimeSource.includes('await scheduleFeedFlowProtectionRefresh(')) {
    fail(`${trackingSpecialRuntimePath} must keep the derived protection refresh outside the feed commit ACK lease.`);
  }
  if (trackingSpecialRuntimeSource.includes('const request = { tabUrl };')) {
    fail(`${trackingSpecialRuntimePath} must not retain a pre-commit tab URL for later protection refresh dispatch.`);
  }
  [
    'recordBehaviorTelemetry',
    'recordBehaviorEvent',
    'BEHAVIOR_EVENT_RECORD_FAILED',
    'TRACK_BEHAVIOR_EVENT',
    'recordContentFlowFromBehaviorEvent',
    'feedFlowPressure',
    'feedFlowInterrupt',
  ].forEach((token) => {
    if (trackingSpecialRuntimeSource.includes(token)) {
      fail(`${trackingSpecialRuntimePath} must not revive the retired secondary behavior-metric collection path: ${token}.`);
    }
  });
  [
    'TRACK_BEHAVIOR_EVENT',
    '__ENTROPY_BUILD_ENABLE_CONTENT_BEHAVIOR_TELEMETRY__',
    'enableContentBehaviorTelemetry',
  ].forEach((token) => {
    if (
      contentFlowContractSource.includes(token)
      || contentFlowSenderSource.includes(token)
      || contentBehaviorCapabilitiesSource.includes(token)
      || viteConfigSource.includes(token)
    ) {
      fail(`current content-flow message/capability files must not retain broad behavior telemetry token ${token}.`);
    }
  });
  if (
    trackingSpecialRuntimeSource.includes('buildContentFlowStatsFromBehaviorEvent')
    || trackingSpecialRuntimeSource.includes('buildContentFlowStatsFromFeedSnapshot')
  ) {
    fail(`${trackingSpecialRuntimePath} must delegate behavior/content-flow stats shaping to the stats collection owner.`);
  }
  [
    "if (typeof recordContentFlowSignal !== 'function') return;",
    "if (typeof sendProtectionUpdate !== 'function')",
    "if (typeof recordContentFlowFromFeedSnapshot === 'function')",
    "typeof prepareFeedFlowSnapshot === 'function'",
    "typeof browserPort?.tabsGet === 'function'",
    "error: 'RESYNC_HANDLER_UNAVAILABLE'",
    "return '';",
  ].forEach((token) => {
    if (trackingSpecialRuntimeSource.includes(token)) {
      fail(`${trackingSpecialRuntimePath} must require special runtime owners during route construction instead of fallback token ${token}.`);
    }
  });
  assertIncludes(trackingContentRuntimeSource, 'MESSAGE_TYPES.CONTENT_BOOTSTRAP_STATE', trackingContentRuntimePath);
  assertIncludes(trackingContentRuntimeSource, 'noteContentBootstrapState', trackingContentRuntimePath);
  assertIncludes(trackingContentRuntimeSource, 'CONTENT_BOOTSTRAP_STATE_OWNER_REQUIRED', trackingContentRuntimePath);
  assertIncludes(trackingContentRuntimeSource, 'validateCanonicalBootstrapMessage', trackingContentRuntimePath);
  assertIncludes(trackingContentRuntimeSource, 'CONTENT_BOOTSTRAP_TRUSTED_TAB_SENDER_REQUIRED', trackingContentRuntimePath);
  assertIncludes(trackingContentRuntimeSource, 'CONTENT_BOOTSTRAP_TOP_FRAME_REQUIRED', trackingContentRuntimePath);
  assertIncludes(trackingContentRuntimeSource, 'CONTENT_BOOTSTRAP_DOCUMENT_ID_MISMATCH', trackingContentRuntimePath);
  assertIncludes(trackingContentRuntimeSource, 'CONTENT_BOOTSTRAP_URL_MISMATCH', trackingContentRuntimePath);
  assertIncludes(trackingContentRuntimeSource, 'CONTENT_BOOTSTRAP_ATTEMPT_ID_REQUIRED', trackingContentRuntimePath);
  assertIncludes(trackingContentRuntimeSource, "['createPlan', 'reserve', 'start']", trackingContentRuntimePath);
  assertIncludes(
    trackingContentRuntimeSource,
    'sendResponse(response);',
    trackingContentRuntimePath,
  );
  assertIncludes(
    trackingContentRuntimeSource,
    'protectionSync.start(reservation);',
    trackingContentRuntimePath,
  );
  const bootstrapValidationIndex = trackingContentRuntimeSource.indexOf(
    'const context = validateCanonicalBootstrapMessage(request, sender);',
  );
  const bootstrapSessionMutationIndex = trackingContentRuntimeSource.indexOf(
    'const session = noteContentBootstrapState(context.request, sender);',
  );
  if (
    bootstrapValidationIndex < 0
    || bootstrapSessionMutationIndex <= bootstrapValidationIndex
  ) {
    fail(`${trackingContentRuntimePath} must validate the canonical sender/document before session mutation.`);
  }
  [
    'CONTENT_BOOTSTRAP_CURRENT_SESSION_OWNER_REQUIRED',
    'CONTENT_BOOTSTRAP_PROTECTION_UPDATE_OWNER_REQUIRED',
    'CONTENT_BOOTSTRAP_PROTECTION_ADMISSION_CAPTURE_OWNER_REQUIRED',
    'CONTENT_BOOTSTRAP_PROTECTION_ADMISSION_RUNNER_OWNER_REQUIRED',
    'active_after_receiver_ready',
    'loader_reinjected',
    'attemptKey:',
    'pendingRecords: new Set()',
    'captureAdmission({',
    'runCapturedTask({',
    'forceSnapshot: true',
    'expectedDocumentId: reservation.plan.documentId',
    'abortSignal: reservation.record.abortController.signal',
    'bootstrap_protection_sync_timeout_pending',
    'awaiting_owner_settlement',
    'state.pendingRecords.forEach((pendingRecord) => abortReservation',
    'function invalidateTab(',
    'function evictTab(',
  ].forEach((token) => assertIncludes(
    trackingContentProtectionSyncSource,
    token,
    trackingContentProtectionSyncPath,
  ));
  if (trackingContentProtectionSyncSource.includes('Promise.race')) {
    fail(`${trackingContentProtectionSyncPath} must not release its FIFO/lease before the admitted owner task settles.`);
  }
  if (trackingContentRuntimeSource.includes('CONTENT_BOOTSTRAP_HANDLER_UNAVAILABLE')) {
    fail(`${trackingContentRuntimePath} must require the content bootstrap owner during route construction.`);
  }

  console.log('[runtime-message-sender-boundaries] PASS: runtime sender boundary contracts are satisfied.');
};

main().catch((error) => {
  console.error('[runtime-message-sender-boundaries] Unexpected error:', error);
  process.exit(1);
});
