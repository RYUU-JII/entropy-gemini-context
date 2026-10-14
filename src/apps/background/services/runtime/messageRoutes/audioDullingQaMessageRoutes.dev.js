import {
  AUDIO_DULLING_SESSION_STATUS,
  createAudioDullingCoordinator,
} from '../../../../../domains/protection/background/audioDulling/AudioDullingCoordinator.js';
import {
  AUDIO_DULLING_QA_ACTIONS,
  AUDIO_DULLING_QA_CHANNEL,
  createAudioDullingQaResponse,
  parseAudioDullingQaRequest,
} from '../../../../../domains/protection/background/audioDulling/audioDullingQaContract.dev.js';
import {
  assertTrustedQaAutomationHarnessSender,
  requireQaAutomationTargetWebTab,
} from '../../../../../platform/security/qaAutomationHarnessTrust.dev.js';
import {
  isTrustedExtensionTabSender,
  resolveTrustedSenderTabId,
} from '../../../../../platform/security/senderTrust.js';
import {
  createAudioDullingQaBrowserPort,
} from '../audioDullingQaBrowserPort.dev.js';

const SUIKINKUTSU_ACTION_BADGE_TEXT = '水';
const SUIKINKUTSU_ACTION_BADGE_DIM_COLOR = Object.freeze([15, 61, 75, 255]);
const SUIKINKUTSU_ACTION_BADGE_PULSE_COLOR = Object.freeze([34, 211, 238, 255]);
const SUIKINKUTSU_ACTION_BADGE_SETTLED_COLOR = Object.freeze([28, 105, 128, 255]);
const SUIKINKUTSU_ACTION_TITLE = '水琴窟 켜기 · Entropy';
const SUIKINKUTSU_ACTION_PULSE_MS = 460;
const DEFAULT_ACTION_ICON_PATHS = Object.freeze({
  16: 'icons/icon16.png',
  48: 'icons/icon48.png',
  128: 'icons/icon128.png',
});
const SUIKINKUTSU_ACTION_ICON_PATHS = Object.freeze({
  16: 'icons/suikinkutsu16.png',
  24: 'icons/suikinkutsu24.png',
  32: 'icons/suikinkutsu32.png',
  48: 'icons/suikinkutsu48.png',
});

const REQUIRED_ACTION_PORT_METHODS = Object.freeze([
  'actionGetUserSettingsResult',
  'actionGetPopupResult',
  'actionGetTitleResult',
  'actionGetBadgeTextResult',
  'actionGetBadgeBackgroundColorResult',
  'actionSetPopupResult',
  'actionSetTitleResult',
  'actionSetIconResult',
  'actionSetBadgeTextResult',
  'actionSetBadgeBackgroundColorResult',
]);

function resolveFailureCode(error) {
  const code = typeof error?.code === 'string' && error.code.trim()
    ? error.code.trim()
    : typeof error?.message === 'string' && error.message.trim()
      ? error.message.trim()
      : 'AUDIO_DULLING_QA_FAILED';
  return /^[A-Z0-9_:.-]{1,160}$/u.test(code)
    ? code
    : 'AUDIO_DULLING_QA_FAILED';
}

function requireDependencies(browserPort, contentScriptOrchestrator, audioBrowserPort) {
  if (
    typeof browserPort?.getRuntimeId !== 'function'
    || typeof browserPort?.tabsGet !== 'function'
    || typeof browserPort?.tabsSendMessage !== 'function'
  ) {
    throw new Error('AUDIO_DULLING_QA_BROWSER_PORT_REQUIRED');
  }
  if (typeof contentScriptOrchestrator?.ensureContentScriptReady !== 'function') {
    throw new Error('AUDIO_DULLING_QA_CONTENT_ORCHESTRATOR_REQUIRED');
  }
  const missingActionMethod = REQUIRED_ACTION_PORT_METHODS.find(
    (method) => typeof audioBrowserPort?.[method] !== 'function',
  );
  if (missingActionMethod) {
    throw new Error(`AUDIO_DULLING_QA_ACTION_PORT_METHOD_REQUIRED:${missingActionMethod}`);
  }
}

function createRuntimeSnapshot(config) {
  return Object.freeze({
    dispatch: Object.freeze({ shouldApply: true }),
    envelopeResult: Object.freeze({
      state: Object.freeze({
        compiledFeatures: Object.freeze({
          audioDulling: Object.freeze({
            isActive: true,
            value: config,
          }),
        }),
      }),
    }),
  });
}

function requireWebOrigin(url, errorCode) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(errorCode);
    }
    return parsed.origin;
  } catch (error) {
    if (error?.message === errorCode) throw error;
    throw new Error(errorCode);
  }
}

function assertTrustedInvitationSender(sender, browserPort, targetTabId) {
  const runtimeId = String(browserPort.getRuntimeId() || '').trim();
  if (
    !runtimeId
    || !isTrustedExtensionTabSender(sender, { runtimeId })
    || resolveTrustedSenderTabId(sender) !== targetTabId
    || Number(sender?.frameId) !== 0
  ) {
    throw new Error('AUDIO_DULLING_QA_INVITATION_SENDER_UNTRUSTED');
  }
}

function requireActionRead(result, errorCode, validator) {
  if (result?.error) throw new Error(errorCode);
  if (!validator(result?.value)) throw new Error(errorCode);
  return result.value;
}

async function requireActionWrite(task, errorCode) {
  const result = await task();
  if (result?.error) throw new Error(errorCode);
}

async function requireContentDelivery(browserPort, targetTabId, message) {
  const delivery = await browserPort.tabsSendMessage(targetTabId, message, { frameId: 0 });
  if (delivery?.error) {
    throw new Error(`AUDIO_DULLING_QA_CONTENT_DELIVERY_FAILED:${delivery.error}`);
  }
  if (delivery?.response?.success !== true) {
    throw new Error(
      delivery?.response?.error || 'AUDIO_DULLING_QA_CONTENT_RESPONSE_INVALID',
    );
  }
  return delivery.response.result;
}

function buildContentRequest(request, action, payload = {}) {
  return {
    channel: request.channel,
    action,
    requestId: `${request.requestId}:${action.toLowerCase()}`.slice(0, 160),
    targetTabId: request.targetTabId,
    payload,
  };
}

export function createAudioDullingQaMessageRoutes({
  browserPort,
  contentScriptOrchestrator,
  audioBrowserPort = createAudioDullingQaBrowserPort(),
} = {}) {
  requireDependencies(browserPort, contentScriptOrchestrator, audioBrowserPort);
  const coordinator = createAudioDullingCoordinator({ browserPort: audioBrowserPort });
  let prepared = null;
  let invitationExpiryTimer = null;
  let actionPulseTimer = null;

  function clearInvitationExpiryTimer() {
    if (invitationExpiryTimer === null) return;
    globalThis.clearTimeout?.(invitationExpiryTimer);
    invitationExpiryTimer = null;
  }

  function clearActionPulseTimer() {
    if (actionPulseTimer === null) return;
    globalThis.clearTimeout?.(actionPulseTimer);
    actionPulseTimer = null;
  }

  function createPreparedRequest(action) {
    if (!prepared) {
      throw new Error('AUDIO_DULLING_QA_SESSION_NOT_PREPARED');
    }
    return {
      channel: AUDIO_DULLING_QA_CHANNEL,
      action,
      requestId: `audio-action:${prepared.targetTabId}:${Date.now()}`,
      targetTabId: prepared.targetTabId,
      payload: {},
    };
  }

  async function restoreActionSurface(surface = prepared?.actionSurface) {
    clearActionPulseTimer();
    if (!surface) return false;
    const { targetTabId } = surface;
    let firstFailure = null;
    const restoreWrites = [
      [
        () => audioBrowserPort.actionSetPopupResult(targetTabId, surface.popup),
        'AUDIO_DULLING_QA_ACTION_POPUP_RESTORE_FAILED',
      ],
      [
        () => audioBrowserPort.actionSetTitleResult(targetTabId, surface.title),
        'AUDIO_DULLING_QA_ACTION_TITLE_RESTORE_FAILED',
      ],
      [
        () => audioBrowserPort.actionSetIconResult(targetTabId, surface.iconPaths),
        'AUDIO_DULLING_QA_ACTION_ICON_RESTORE_FAILED',
      ],
      [
        () => audioBrowserPort.actionSetBadgeTextResult(targetTabId, surface.badgeText),
        'AUDIO_DULLING_QA_ACTION_BADGE_RESTORE_FAILED',
      ],
      [
        () => audioBrowserPort.actionSetBadgeBackgroundColorResult(
          targetTabId,
          surface.badgeBackgroundColor,
        ),
        'AUDIO_DULLING_QA_ACTION_BADGE_COLOR_RESTORE_FAILED',
      ],
    ];
    for (const [write, errorCode] of restoreWrites) {
      try {
        await requireActionWrite(write, errorCode);
      } catch (error) {
        if (!firstFailure) firstFailure = error;
      }
    }
    if (prepared?.actionSurface === surface) {
      prepared = {
        ...prepared,
        actionSurface: null,
      };
    }
    if (firstFailure) throw firstFailure;
    return true;
  }

  async function claimActionSurface() {
    if (!prepared) {
      throw new Error('AUDIO_DULLING_QA_SESSION_NOT_PREPARED');
    }
    if (prepared.actionSurface) return prepared.actionSurface;

    const settings = requireActionRead(
      await audioBrowserPort.actionGetUserSettingsResult(),
      'AUDIO_DULLING_QA_ACTION_SETTINGS_READ_FAILED',
      (value) => value && typeof value.isOnToolbar === 'boolean',
    );
    if (!settings.isOnToolbar) {
      throw new Error('AUDIO_DULLING_QA_TOOLBAR_PIN_REQUIRED');
    }

    const targetTabId = prepared.targetTabId;
    const [
      popupResult,
      titleResult,
      badgeTextResult,
      badgeBackgroundColorResult,
    ] = await Promise.all([
      audioBrowserPort.actionGetPopupResult(targetTabId),
      audioBrowserPort.actionGetTitleResult(targetTabId),
      audioBrowserPort.actionGetBadgeTextResult(targetTabId),
      audioBrowserPort.actionGetBadgeBackgroundColorResult(targetTabId),
    ]);
    const surface = {
      targetTabId,
      iconPaths: DEFAULT_ACTION_ICON_PATHS,
      popup: requireActionRead(
        popupResult,
        'AUDIO_DULLING_QA_ACTION_POPUP_READ_FAILED',
        (value) => typeof value === 'string',
      ),
      title: requireActionRead(
        titleResult,
        'AUDIO_DULLING_QA_ACTION_TITLE_READ_FAILED',
        (value) => typeof value === 'string',
      ),
      badgeText: requireActionRead(
        badgeTextResult,
        'AUDIO_DULLING_QA_ACTION_BADGE_READ_FAILED',
        (value) => typeof value === 'string',
      ),
      badgeBackgroundColor: requireActionRead(
        badgeBackgroundColorResult,
        'AUDIO_DULLING_QA_ACTION_BADGE_COLOR_READ_FAILED',
        (value) => Array.isArray(value) || typeof value === 'string',
      ),
    };

    try {
      await requireActionWrite(
        () => audioBrowserPort.actionSetIconResult(
          targetTabId,
          SUIKINKUTSU_ACTION_ICON_PATHS,
        ),
        'AUDIO_DULLING_QA_ACTION_ICON_CLAIM_FAILED',
      );
      await requireActionWrite(
        () => audioBrowserPort.actionSetTitleResult(
          targetTabId,
          SUIKINKUTSU_ACTION_TITLE,
        ),
        'AUDIO_DULLING_QA_ACTION_TITLE_CLAIM_FAILED',
      );
      await requireActionWrite(
        () => audioBrowserPort.actionSetBadgeBackgroundColorResult(
          targetTabId,
          SUIKINKUTSU_ACTION_BADGE_DIM_COLOR,
        ),
        'AUDIO_DULLING_QA_ACTION_BADGE_COLOR_CLAIM_FAILED',
      );
      await requireActionWrite(
        () => audioBrowserPort.actionSetBadgeTextResult(
          targetTabId,
          SUIKINKUTSU_ACTION_BADGE_TEXT,
        ),
        'AUDIO_DULLING_QA_ACTION_BADGE_CLAIM_FAILED',
      );
      await requireActionWrite(
        () => audioBrowserPort.actionSetPopupResult(targetTabId, ''),
        'AUDIO_DULLING_QA_ACTION_POPUP_CLAIM_FAILED',
      );
    } catch (error) {
      await restoreActionSurface(surface).catch(() => undefined);
      throw error;
    }

    prepared = {
      ...prepared,
      actionSurface: surface,
      actionClaimedAt: Date.now(),
      badgePhase: 'dim',
      phase: 'waiting_for_toolbar_action',
      error: null,
    };
    return surface;
  }

  async function stopPreparedSession(request, reason = 'qa_stop') {
    if (!prepared) {
      return Object.freeze({ stopped: false, state: null });
    }
    clearInvitationExpiryTimer();
    const targetTabId = prepared.targetTabId;
    let restoreFailure = null;
    try {
      await restoreActionSurface();
    } catch (error) {
      restoreFailure = error;
    }
    const stopResult = await coordinator.stopTab(targetTabId, { reason });
    await requireContentDelivery(
      browserPort,
      targetTabId,
      buildContentRequest({
        ...request,
        targetTabId,
      }, AUDIO_DULLING_QA_ACTIONS.CONTENT_REMOVE),
    );
    prepared = null;
    if (restoreFailure) throw restoreFailure;
    return Object.freeze({
      stopped: stopResult.ok === true,
      state: coordinator.getTabState(targetTabId),
    });
  }

  async function prepareSession(request) {
    const targetTab = requireQaAutomationTargetWebTab(
      await browserPort.tabsGet(request.targetTabId),
      request.targetTabId,
      { errorCode: 'AUDIO_DULLING_QA_TARGET_TAB_UNAVAILABLE' },
    );
    if (prepared) {
      await stopPreparedSession(request, 'qa_replaced');
    }
    const ready = await contentScriptOrchestrator.ensureContentScriptReady(
      request.targetTabId,
      {
        url: targetTab.url,
        reason: 'audio_dulling_qa_prepare',
      },
    );
    if (ready?.ok !== true) {
      throw new Error(
        ready?.error || ready?.reason || 'AUDIO_DULLING_QA_CONTENT_NOT_READY',
      );
    }
    const reconcile = await coordinator.reconcileTab({
      tabId: request.targetTabId,
      url: targetTab.url,
      hostname: new URL(targetTab.url).hostname,
      runtimeSnapshot: createRuntimeSnapshot(request.payload.activationConfig),
      source: 'audio_dulling_qa',
    });
    if (reconcile?.ok !== true || reconcile.status !== AUDIO_DULLING_SESSION_STATUS.ARMED) {
      throw new Error(reconcile?.error || 'AUDIO_DULLING_QA_ARM_FAILED');
    }
    prepared = {
      targetTabId: request.targetTabId,
      targetUrl: targetTab.url,
      targetOrigin: requireWebOrigin(
        targetTab.url,
        'AUDIO_DULLING_QA_TARGET_ORIGIN_INVALID',
      ),
      config: request.payload.activationConfig,
      recoveryConfig: request.payload.config,
      invitationWindowMs: request.payload.invitationWindowMs,
      actionSurface: null,
      phase: 'waiting_for_media',
      preparedAt: Date.now(),
      error: null,
    };
    try {
      await requireContentDelivery(
        browserPort,
        request.targetTabId,
        buildContentRequest(request, AUDIO_DULLING_QA_ACTIONS.CONTENT_MOUNT, {
          config: request.payload.activationConfig,
          revealDelayMs: request.payload.revealDelayMs,
          invitationWindowMs: request.payload.invitationWindowMs,
        }),
      );
    } catch (error) {
      prepared = null;
      await coordinator.stopTab(request.targetTabId, {
        reason: 'qa_content_mount_failed',
      });
      throw error;
    }
    return snapshotPreparedSession();
  }

  async function expireInvitation(request, sender = null) {
    if (!prepared || prepared.targetTabId !== request.targetTabId) {
      throw new Error('AUDIO_DULLING_QA_SESSION_NOT_PREPARED');
    }
    if (sender) {
      assertTrustedInvitationSender(sender, browserPort, request.targetTabId);
    }
    if (prepared.phase === 'capturing_processed') {
      return snapshotPreparedSession({ refreshOffscreen: true });
    }
    clearInvitationExpiryTimer();
    await restoreActionSurface();
    prepared = {
      ...prepared,
      phase: 'invitation_expired',
      invitationExpiredAt: Date.now(),
      error: null,
    };
    return snapshotPreparedSession();
  }

  async function presentInvitation(request, sender) {
    if (!prepared || prepared.targetTabId !== request.targetTabId) {
      throw new Error('AUDIO_DULLING_QA_SESSION_NOT_PREPARED');
    }
    assertTrustedInvitationSender(sender, browserPort, request.targetTabId);
    if (prepared.phase === 'waiting_for_toolbar_action' && prepared.actionSurface) {
      return snapshotPreparedSession();
    }
    try {
      await claimActionSurface();
    } catch (error) {
      prepared = {
        ...prepared,
        phase: 'action_claim_failed',
        error: resolveFailureCode(error),
      };
      throw error;
    }
    clearInvitationExpiryTimer();
    invitationExpiryTimer = globalThis.setTimeout?.(() => {
      invitationExpiryTimer = null;
      if (!prepared || prepared.phase !== 'waiting_for_toolbar_action') return;
      const expiryRequest = createPreparedRequest(
        AUDIO_DULLING_QA_ACTIONS.INVITATION_EXPIRED,
      );
      void expireInvitation(expiryRequest).catch((error) => {
        if (prepared) {
          prepared = {
            ...prepared,
            phase: 'action_restore_failed',
            error: resolveFailureCode(error),
          };
        }
        console.error('[SuikinkutsuQa] Invitation expiry restore failed:', error);
      });
    }, prepared.invitationWindowMs) ?? null;
    invitationExpiryTimer?.unref?.();
    return snapshotPreparedSession();
  }

  async function failActionPulse(error) {
    clearInvitationExpiryTimer();
    let failure = error;
    let restoreFailed = false;
    try {
      await restoreActionSurface();
    } catch (restoreError) {
      failure = restoreError;
      restoreFailed = true;
    }
    if (prepared) {
      prepared = {
        ...prepared,
        phase: 'action_pulse_failed',
        badgePhase: restoreFailed ? 'restore_failed' : 'restored',
        error: resolveFailureCode(failure),
      };
    }
    return failure;
  }

  async function settleActionPulse(surface) {
    if (
      !prepared
      || prepared.phase !== 'waiting_for_toolbar_action'
      || prepared.actionSurface !== surface
    ) {
      return;
    }
    try {
      await requireActionWrite(
        () => audioBrowserPort.actionSetBadgeBackgroundColorResult(
          surface.targetTabId,
          SUIKINKUTSU_ACTION_BADGE_SETTLED_COLOR,
        ),
        'AUDIO_DULLING_QA_ACTION_BADGE_SETTLE_FAILED',
      );
      prepared = {
        ...prepared,
        badgePhase: 'settled',
        badgeSettledAt: Date.now(),
      };
    } catch (error) {
      const failure = await failActionPulse(error);
      console.error('[SuikinkutsuQa] Action badge settle failed:', failure);
    }
  }

  async function arriveInvitation(request, sender) {
    if (!prepared || prepared.targetTabId !== request.targetTabId) {
      throw new Error('AUDIO_DULLING_QA_SESSION_NOT_PREPARED');
    }
    assertTrustedInvitationSender(sender, browserPort, request.targetTabId);
    if (prepared.phase === 'capturing_processed') {
      return snapshotPreparedSession({ refreshOffscreen: true });
    }
    if (
      prepared.phase !== 'waiting_for_toolbar_action'
      || !prepared.actionSurface
    ) {
      throw new Error('AUDIO_DULLING_QA_INVITATION_NOT_ACTIVE');
    }
    if (prepared.invitationArrivedAt !== undefined) {
      return snapshotPreparedSession();
    }

    const surface = prepared.actionSurface;
    clearActionPulseTimer();
    try {
      await requireActionWrite(
        () => audioBrowserPort.actionSetBadgeBackgroundColorResult(
          surface.targetTabId,
          SUIKINKUTSU_ACTION_BADGE_PULSE_COLOR,
        ),
        'AUDIO_DULLING_QA_ACTION_BADGE_PULSE_FAILED',
      );
    } catch (error) {
      const failure = await failActionPulse(error);
      throw failure;
    }
    if (
      !prepared
      || prepared.phase !== 'waiting_for_toolbar_action'
      || prepared.actionSurface !== surface
    ) {
      await restoreActionSurface(surface);
      return snapshotPreparedSession({ refreshOffscreen: true });
    }
    prepared = {
      ...prepared,
      invitationArrivedAt: Date.now(),
      badgePhase: 'pulse',
      error: null,
    };
    actionPulseTimer = globalThis.setTimeout?.(() => {
      actionPulseTimer = null;
      void settleActionPulse(surface);
    }, SUIKINKUTSU_ACTION_PULSE_MS) ?? null;
    actionPulseTimer?.unref?.();
    return snapshotPreparedSession();
  }

  async function handleToolbarActionClicked(tab) {
    if (
      !prepared
      || prepared.phase !== 'waiting_for_toolbar_action'
      || !prepared.actionSurface
    ) {
      return Object.freeze({ handled: false, reason: 'not_armed' });
    }
    const clickedTabId = Number(tab?.id);
    if (clickedTabId !== prepared.targetTabId) {
      return Object.freeze({ handled: false, reason: 'different_tab' });
    }
    if (
      requireWebOrigin(
        tab?.url,
        'AUDIO_DULLING_QA_ACTION_TAB_ORIGIN_INVALID',
      ) !== prepared.targetOrigin
    ) {
      return Object.freeze({ handled: false, reason: 'different_origin' });
    }

    clearInvitationExpiryTimer();
    const contentRequest = createPreparedRequest(
      AUDIO_DULLING_QA_ACTIONS.CONTENT_STATUS,
    );
    try {
      await restoreActionSurface();
      prepared = {
        ...prepared,
        phase: 'capturing_processed',
        actionClickedAt: Date.now(),
        activeUrl: tab.url,
        error: null,
      };
      const result = await coordinator.startArmedTab(prepared.targetTabId, {
        captureCurrentActiveTab: true,
        requestPermission: false,
      });
      if (
        result?.ok !== true
        || result.status !== AUDIO_DULLING_SESSION_STATUS.CAPTURING
      ) {
        throw new Error(result?.error || 'AUDIO_DULLING_QA_CAPTURE_FAILED');
      }
      prepared = {
        ...prepared,
        capturedAt: Date.now(),
      };
      await requireContentDelivery(
        browserPort,
        prepared.targetTabId,
        buildContentRequest(contentRequest, AUDIO_DULLING_QA_ACTIONS.CONTENT_STATUS, {
          status: 'capturing_processed',
          detail: 'Suikinkutsu applied',
        }),
      );
      return Object.freeze({
        handled: true,
        state: await snapshotPreparedSession({ refreshOffscreen: true }),
      });
    } catch (error) {
      await coordinator.stopTab(prepared.targetTabId, {
        reason: 'qa_toolbar_activation_failed',
      });
      prepared = {
        ...prepared,
        phase: 'capture_failed',
        error: resolveFailureCode(error),
      };
      await requireContentDelivery(
        browserPort,
        prepared.targetTabId,
        buildContentRequest(contentRequest, AUDIO_DULLING_QA_ACTIONS.CONTENT_STATUS, {
          status: 'failed',
          detail: prepared.error,
        }),
      ).catch(() => undefined);
      throw error;
    }
  }

  async function updateSession(request) {
    if (!prepared || prepared.targetTabId !== request.targetTabId) {
      throw new Error('AUDIO_DULLING_QA_SESSION_NOT_PREPARED');
    }
    const result = await coordinator.reconcileTab({
      tabId: prepared.targetTabId,
      url: prepared.targetUrl,
      hostname: new URL(prepared.targetUrl).hostname,
      runtimeSnapshot: createRuntimeSnapshot(request.payload.config),
      source: 'audio_dulling_qa_update',
    });
    if (result?.ok !== true) {
      throw new Error(result?.error || 'AUDIO_DULLING_QA_UPDATE_FAILED');
    }
    prepared = {
      ...prepared,
      config: request.payload.config,
      updatedAt: Date.now(),
    };
    return snapshotPreparedSession({ refreshOffscreen: true });
  }

  async function snapshotPreparedSession({
    refreshOffscreen = false,
    refreshContent = false,
  } = {}) {
    if (!prepared) return null;
    const state = refreshOffscreen
      ? await coordinator.refreshTabState(prepared.targetTabId)
      : coordinator.getTabState(prepared.targetTabId);
    const interventionAdmission = refreshContent
      ? await requireContentDelivery(
          browserPort,
          prepared.targetTabId,
          buildContentRequest(
            createPreparedRequest(AUDIO_DULLING_QA_ACTIONS.CONTENT_SNAPSHOT),
            AUDIO_DULLING_QA_ACTIONS.CONTENT_SNAPSHOT,
          ),
        )
      : null;
    return Object.freeze({
      ...prepared,
      state,
      interventionAdmission,
    });
  }

  async function dispatch(request, sender) {
    if (request.action === AUDIO_DULLING_QA_ACTIONS.PREPARE) {
      assertTrustedQaAutomationHarnessSender(sender, browserPort, {
        errorCode: 'AUDIO_DULLING_QA_HARNESS_SENDER_UNTRUSTED',
      });
      return prepareSession(request);
    }
    if (request.action === AUDIO_DULLING_QA_ACTIONS.INVITATION_PRESENTED) {
      return presentInvitation(request, sender);
    }
    if (request.action === AUDIO_DULLING_QA_ACTIONS.INVITATION_ARRIVED) {
      return arriveInvitation(request, sender);
    }
    if (request.action === AUDIO_DULLING_QA_ACTIONS.INVITATION_EXPIRED) {
      return expireInvitation(request, sender);
    }
    assertTrustedQaAutomationHarnessSender(sender, browserPort, {
      errorCode: 'AUDIO_DULLING_QA_HARNESS_SENDER_UNTRUSTED',
    });
    if (request.action === AUDIO_DULLING_QA_ACTIONS.UPDATE) {
      return updateSession(request);
    }
    if (request.action === AUDIO_DULLING_QA_ACTIONS.SNAPSHOT) {
      return snapshotPreparedSession({
        refreshOffscreen: true,
        refreshContent: true,
      });
    }
    if (request.action === AUDIO_DULLING_QA_ACTIONS.STOP) {
      return stopPreparedSession(request);
    }
    throw new Error('AUDIO_DULLING_QA_ACTION_INVALID');
  }

  const actions = Object.create(null);
  [
    AUDIO_DULLING_QA_ACTIONS.PREPARE,
    AUDIO_DULLING_QA_ACTIONS.INVITATION_PRESENTED,
    AUDIO_DULLING_QA_ACTIONS.INVITATION_ARRIVED,
    AUDIO_DULLING_QA_ACTIONS.INVITATION_EXPIRED,
    AUDIO_DULLING_QA_ACTIONS.UPDATE,
    AUDIO_DULLING_QA_ACTIONS.SNAPSHOT,
    AUDIO_DULLING_QA_ACTIONS.STOP,
  ].forEach((action) => {
    actions[action] = (message, sender, sendResponse) => {
      let request;
      try {
        request = parseAudioDullingQaRequest(message);
      } catch (error) {
        sendResponse?.({
          success: false,
          error: resolveFailureCode(error),
        });
        return false;
      }
      void dispatch(request, sender).then(
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
    };
  });

  return {
    actions,
    browserEvents: Object.freeze({
      handleActionClicked: handleToolbarActionClicked,
    }),
  };
}

export default createAudioDullingQaMessageRoutes;
