import { createClseMessageRoutes } from './messageRoutes/clseMessageRoutes.js';
import { createPopupBlockMessageRoutes } from './messageRoutes/popupBlockMessageRoutes.js';
import { createTrackingRuntimeMessageRoutes } from './messageRoutes/trackingRuntimeMessageRoutes.js';
import { createProgressionMessageRoutes } from './messageRoutes/progressionMessageRoutes.js';
import { createGuidanceMessageRoutes } from './messageRoutes/guidanceMessageRoutes.js';
import { createProfileGenerationMessageRoutes } from './messageRoutes/profileGenerationMessageRoutes.js';
import {
  createFeedTopologyCertificateMessageRoutes,
} from './messageRoutes/feedTopologyCertificateMessageRoutes.js';
import { createVideoSkipPoolMessageRoutes } from './messageRoutes/videoSkipPoolMessageRoutes.js';
import { createNudgeFrameHostCapabilityMessageRoutes } from './messageRoutes/nudgeFrameHostCapabilityMessageRoutes.js';
import { createWorkerRuntimeEventMessageRoutes } from './messageRoutes/workerRuntimeEventMessageRoutes.js';
import { createContentBootstrapSnapshotMessageRoutes } from './messageRoutes/contentBootstrapSnapshotMessageRoutes.js';
import { createSecurityVaultMessageRoutes, SECURITY_VAULT_ACTIONS } from './messageRoutes/securityVaultMessageRoutes.js';
import { createBuildCapabilityMessageRoutes } from '@build-capability-message-routes';
import { createQaProgressionProvisioningMessageRoutes } from '@qa-progression-provisioning-routes';
import {
  MESSAGE_ACTIONS,
  MESSAGE_TYPES,
} from '../../../../platform/messaging/messageTypes.js';
import { PROGRESSION_DEBUG_ACTIONS } from '@progression-debug-actions';
import {
  isProfileResetWriteAdmissionClosed,
} from '../../../../platform/storage/runtime/ProfileResetLifecycleRepository.js';
import { isTrustedDashboardPageSender } from '../../../../platform/security/senderTrust.js';
import { resolveSettingsProfileRecovery } from '../../../../platform/storage/settings/SettingsProfileRecoveryContract.js';

const DASHBOARD_BOOT_READ_ACTIONS = new Set([
  // Settings hydration settles before this milestone; content reads need no
  // bookmark, global-cap, or managed content-script catch-up completion.
  MESSAGE_ACTIONS.GET_SETTINGS,
  MESSAGE_ACTIONS.GET_BOOT_PREWARM_SNAPSHOT,
  MESSAGE_ACTIONS.GET_ANALYSIS_BOOTSTRAP_SNAPSHOT,
  MESSAGE_ACTIONS.GET_ARTIFACT_DISCLOSURE_SNAPSHOT,
  MESSAGE_ACTIONS.GET_FIRST_VISION_PROGRESSION_SNAPSHOT,
]);

const PROFILE_GENERATION_BOOT_SETTLEMENT_ACTIONS = new Set([
  MESSAGE_ACTIONS.GET_PROFILE_GENERATION_READINESS,
  // Admission owns its typed session/settings readiness. Waiting for tracking
  // catch-up here can block the very content start that catch-up is awaiting.
  MESSAGE_ACTIONS.INTERVENTION_ADMISSION,
  // Boot protection fanout awaits Global START and its authenticated frame.
  // The RAM capability broker is constructed before bootstrap; its child
  // handshake must not wait for the full-init parent that awaits presentation.
  MESSAGE_ACTIONS.ISSUE_NUDGE_FRAME_HOST_CAPABILITY,
  MESSAGE_ACTIONS.CONSUME_NUDGE_FRAME_HOST_CAPABILITY,
]);

const PROFILE_GENERATION_RESPONSE_ACTIONS = new Set([
  MESSAGE_ACTIONS.GET_PROFILE_GENERATION_READINESS,
  MESSAGE_ACTIONS.GET_ARTIFACT_DISCLOSURE_SNAPSHOT,
  MESSAGE_ACTIONS.GET_FIRST_VISION_PROGRESSION_SNAPSHOT,
  MESSAGE_ACTIONS.RECORD_FIRST_VISION_PRESENTED,
  MESSAGE_ACTIONS.RECORD_FIRST_VISION_SPENT,
  MESSAGE_ACTIONS.RECORD_DASHBOARD_FIRST_VISIT,
  MESSAGE_ACTIONS.CLAIM_BONSAI_FIRST_BLOOM,
  MESSAGE_ACTIONS.RECORD_SITE_REGISTRATION_INVITATIONS_ADMITTED,
  ...[PROGRESSION_DEBUG_ACTIONS.SET_UNLOCK_DAY, PROGRESSION_DEBUG_ACTIONS.SET_UNLOCK_MODE,
    PROGRESSION_DEBUG_ACTIONS.CLEAR_UNLOCK_OVERRIDE,
    PROGRESSION_DEBUG_ACTIONS.COMPLETE_FIRST_VISION_PREVIEW].filter(Boolean),
  ...(PROGRESSION_DEBUG_ACTIONS.RESET_FIRST_VISION
    ? [PROGRESSION_DEBUG_ACTIONS.RESET_FIRST_VISION]
    : []),
]);

const PROFILE_MUTATION_CONTROL_ACTIONS = new Set([
  MESSAGE_ACTIONS.RESET_APP_DATA,
  MESSAGE_ACTIONS.IMPORT_STORAGE_SNAPSHOT,
  MESSAGE_ACTIONS.PROFILE_MUTATION_RESPONSE_ACK,
]);

const DASHBOARD_PROFILE_GENERATION_BOUND_SETTINGS_ACTIONS = new Set([
  MESSAGE_ACTIONS.SET_SETTINGS,
  MESSAGE_ACTIONS.RETRY_SETTINGS_PROPAGATION,
  MESSAGE_ACTIONS.WAIT_SETTINGS_PROPAGATION,
]);

const FULL_INIT_PREREQUISITE_MESSAGE_TYPES = new Set([
  MESSAGE_TYPES.CONTENT_BOOTSTRAP_STATE,
  MESSAGE_TYPES.CONTENT_BOOTSTRAP_SNAPSHOT,
]);

function requireProfileMutationActionHandlers(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('BACKGROUND_MESSAGE_ROUTER_PROFILE_MUTATION_ACTION_HANDLERS_REQUIRED');
  }
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== PROFILE_MUTATION_CONTROL_ACTIONS.size
    || keys.some((key) => !PROFILE_MUTATION_CONTROL_ACTIONS.has(key))
  ) {
    throw new Error('BACKGROUND_MESSAGE_ROUTER_PROFILE_MUTATION_ACTION_HANDLERS_INVALID');
  }
  PROFILE_MUTATION_CONTROL_ACTIONS.forEach((action) => {
    if (typeof value[action] !== 'function') {
      throw new Error(`BACKGROUND_MESSAGE_ROUTER_PROFILE_MUTATION_ACTION_HANDLER_REQUIRED:${action}`);
    }
  });
  return value;
}

function registerRoutes(target, routes, kind) {
  if (!routes || typeof routes !== 'object') return;

  Object.entries(routes).forEach(([key, handler]) => {
    if (typeof handler !== 'function') {
      throw new Error(`INVALID_${kind.toUpperCase()}_HANDLER:${key}`);
    }
    if (Object.prototype.hasOwnProperty.call(target, key)) {
      throw new Error(`DUPLICATE_${kind.toUpperCase()}_ROUTE:${key}`);
    }
    target[key] = handler;
  });
}

function buildFailureResponse(message, errorCode, error = null) {
  const response = { success: false, error: errorCode };
  if (PROFILE_GENERATION_RESPONSE_ACTIONS.has(message?.action)) {
    response.profileGeneration = Object.prototype.hasOwnProperty.call(
      message || {},
      'profileGeneration',
    ) ? message.profileGeneration : null;
  }
  if (message?.action === MESSAGE_ACTIONS.GET_PROFILE_GENERATION_READINESS) {
    const settingsProfileRecovery = resolveSettingsProfileRecovery(error);
    if (settingsProfileRecovery !== null) response.settingsProfileRecovery = settingsProfileRecovery;
  }
  return response;
}

function resolveNamedFailureCode(error, fallbackCode) {
  if (typeof error?.code === 'string' && error.code) return error.code;
  if (typeof error?.message === 'string' && error.message) return error.message;
  return fallbackCode;
}

function resolveDashboardBootReadinessFailureCode(error) {
  if (typeof error?.code === 'string' && error.code) return error.code;
  return 'DASHBOARD_BOOT_READINESS_FAILED';
}

function sendDispatchFailure(sendResponse, error, message) {
  console.error('[Router] Message dispatch failed:', error);
  sendResponse?.(buildFailureResponse(message, 'SERVICE_DISPATCH_FAILED'));
}

function resolveRuntimeAdmissionLabel(message) {
  const discriminator = typeof message?.action === 'string' && message.action.trim()
    ? message.action.trim()
    : typeof message?.type === 'string' && message.type.trim()
      ? message.type.trim()
      : 'untyped';
  return `message:${discriminator}`;
}

function isProfileMutationRuntimeAdmissionError(error) {
  return typeof error?.code === 'string'
    && error.code.startsWith('PROFILE_MUTATION_RUNTIME_');
}

function sendProfileMutationAdmissionFailure(sendResponse, error, message) {
  console.error('[Router] Profile mutation admission blocked message:', error);
  sendResponse?.(buildFailureResponse(
    message,
    error?.code || 'PROFILE_MUTATION_RUNTIME_ADMISSION_FAILED',
  ));
}

function createDashboardProfileGenerationAdmissionError({
  code,
  expectedProfileGeneration = null,
  observedProfileGeneration = null,
} = {}) {
  const error = new Error(code);
  error.code = code;
  error.expectedProfileGeneration = expectedProfileGeneration;
  error.observedProfileGeneration = observedProfileGeneration;
  return error;
}

function assertDashboardProfileGenerationAdmission({
  admission,
  message,
  sender,
} = {}) {
  if (
    !DASHBOARD_PROFILE_GENERATION_BOUND_SETTINGS_ACTIONS.has(message?.action)
    || !isTrustedDashboardPageSender(sender)
  ) {
    return;
  }
  const expectedProfileGeneration = message?.expectedProfileGeneration;
  if (
    typeof expectedProfileGeneration !== 'string'
    || !expectedProfileGeneration.trim()
    || expectedProfileGeneration.trim() !== expectedProfileGeneration
  ) {
    throw createDashboardProfileGenerationAdmissionError({
      code: 'PROFILE_MUTATION_RUNTIME_CLIENT_GENERATION_REQUIRED',
      expectedProfileGeneration,
      observedProfileGeneration: admission?.profileGeneration || null,
    });
  }
  if (expectedProfileGeneration !== admission?.profileGeneration) {
    throw createDashboardProfileGenerationAdmissionError({
      code: 'PROFILE_MUTATION_RUNTIME_ADMISSION_GENERATION_CHANGED',
      expectedProfileGeneration,
      observedProfileGeneration: admission?.profileGeneration || null,
    });
  }
}

export function createBackgroundMessageRouter({
  securityVault,
  profileMutationActionHandlers,
  popupBlock,
  clse,
  trackingRuntime,
  progression,
  guidance,
  profileGenerationReadiness,
  feedTopologyPersistentCertificationService,
  videoSkipPoolWrite,
  nudgeFrameHostCapability,
  workerRuntimeEventCapability,
  contentBootstrapSnapshot,
  buildCapabilityRoutes,
  handleActionMessage,
  getInitPromise,
  getDashboardBootReadinessPromise,
  getProfileGenerationBootSettlementPromise,
  readProfileMutationLifecycle,
  profileMutationRuntimeGate,
} = {}) {
  const resolvedProfileMutationActionHandlers = requireProfileMutationActionHandlers(
    profileMutationActionHandlers,
  );
  if (typeof handleActionMessage !== 'function') {
    throw new Error('BACKGROUND_MESSAGE_ROUTER_ACTION_HANDLER_REQUIRED');
  }
  if (typeof getInitPromise !== 'function') {
    throw new Error('BACKGROUND_MESSAGE_ROUTER_INIT_PROMISE_OWNER_REQUIRED');
  }
  if (typeof getDashboardBootReadinessPromise !== 'function') {
    throw new Error('BACKGROUND_MESSAGE_ROUTER_DASHBOARD_BOOT_READINESS_OWNER_REQUIRED');
  }
  if (typeof getProfileGenerationBootSettlementPromise !== 'function') {
    throw new Error('BACKGROUND_MESSAGE_ROUTER_PROFILE_GENERATION_BOOT_SETTLEMENT_OWNER_REQUIRED');
  }
  if (typeof readProfileMutationLifecycle !== 'function') {
    throw new Error('BACKGROUND_MESSAGE_ROUTER_PROFILE_LIFECYCLE_OWNER_REQUIRED');
  }
  if (
    !profileMutationRuntimeGate
    || typeof profileMutationRuntimeGate.acquireLocal !== 'function'
    || typeof profileMutationRuntimeGate.capture !== 'function'
    || typeof profileMutationRuntimeGate.acquireCaptured !== 'function'
  ) {
    throw new Error('BACKGROUND_MESSAGE_ROUTER_PROFILE_MUTATION_RUNTIME_GATE_REQUIRED');
  }

  const actionRoutes = Object.create(null);
  const typeRoutes = Object.create(null);
  const buildCapabilityRouteModule = createBuildCapabilityMessageRoutes(
    buildCapabilityRoutes,
  );
  const handleBuildCapabilityActionClicked = (
    buildCapabilityRouteModule?.browserEvents?.handleActionClicked
  );
  if (
    handleBuildCapabilityActionClicked !== null
    && handleBuildCapabilityActionClicked !== undefined
    && typeof handleBuildCapabilityActionClicked !== 'function'
  ) {
    throw new Error('BACKGROUND_MESSAGE_ROUTER_ACTION_CLICK_HANDLER_INVALID');
  }

  const routeModules = [
    createSecurityVaultMessageRoutes(securityVault),
    createPopupBlockMessageRoutes(popupBlock),
    createClseMessageRoutes(clse),
    createTrackingRuntimeMessageRoutes({ trackingRuntime }),
    createProgressionMessageRoutes(progression),
    createGuidanceMessageRoutes(guidance),
    createProfileGenerationMessageRoutes({ profileGenerationReadiness }),
    createFeedTopologyCertificateMessageRoutes({
      feedTopologyPersistentCertificationService,
    }),
    createVideoSkipPoolMessageRoutes(videoSkipPoolWrite),
    createNudgeFrameHostCapabilityMessageRoutes({
      capabilityBroker: nudgeFrameHostCapability,
    }),
    createWorkerRuntimeEventMessageRoutes({ workerRuntimeEventCapability }),
    createContentBootstrapSnapshotMessageRoutes(contentBootstrapSnapshot),
    buildCapabilityRouteModule,
    createQaProgressionProvisioningMessageRoutes(progression),
  ];

  routeModules.forEach((routeModule) => {
    registerRoutes(actionRoutes, routeModule?.actions, 'action');
    registerRoutes(typeRoutes, routeModule?.types, 'type');
  });
  registerRoutes(
    actionRoutes,
    resolvedProfileMutationActionHandlers,
    'profile_mutation_control_action',
  );

  function dispatchMessage(message, sender, sendResponse, reportRoutePhase) {
    reportRoutePhase?.('handler_started');
    try {
      const action = message?.action;
      if (action && typeof actionRoutes[action] === 'function') {
        return actionRoutes[action](message, sender, sendResponse);
      }

      const type = message?.type;
      if (type && typeof typeRoutes[type] === 'function') {
        return typeRoutes[type](message, sender, sendResponse);
      }

      return handleActionMessage(message, sender, sendResponse);
    } finally {
      reportRoutePhase?.('handler_returned');
    }
  }

  function dispatchMessageWithAdmissionLease(release, message, sender, sendResponse, reportRoutePhase) {
    let released = false;
    const releaseOnce = () => {
      if (released) return;
      released = true;
      release();
    };
    const admittedSendResponse = (payload) => {
      releaseOnce();
      return sendResponse?.(payload);
    };

    try {
      const handled = dispatchMessage(message, sender, admittedSendResponse, reportRoutePhase);
      if (handled !== true) releaseOnce();
      return handled;
    } catch (error) {
      releaseOnce();
      throw error;
    }
  }

  function dispatchAdmittedMessage(message, sender, sendResponse, reportRoutePhase) {
    if (PROFILE_MUTATION_CONTROL_ACTIONS.has(message?.action)) {
      return dispatchMessage(message, sender, sendResponse, reportRoutePhase);
    }
    reportRoutePhase?.('acquire_started');
    let release;
    try {
      release = profileMutationRuntimeGate.acquireLocal({
        label: resolveRuntimeAdmissionLabel(message),
      });
    } finally {
      reportRoutePhase?.('acquire_settled');
    }
    return dispatchMessageWithAdmissionLease(release, message, sender, sendResponse, reportRoutePhase);
  }

  async function dispatchCapturedMessage(admission, message, sender, sendResponse, reportRoutePhase) {
    reportRoutePhase?.('acquire_started');
    let release;
    try {
      release = await profileMutationRuntimeGate.acquireCaptured({ admission });
    } finally {
      reportRoutePhase?.('acquire_settled');
    }
    try {
      assertDashboardProfileGenerationAdmission({ admission, message, sender });
    } catch (error) {
      release();
      throw error;
    }
    return dispatchMessageWithAdmissionLease(release, message, sender, sendResponse, reportRoutePhase);
  }

  function handleMessage(message, sender, sendResponse, reportRoutePhase) {
    const usesProfileMutationResponseAck = (
      message?.action === MESSAGE_ACTIONS.PROFILE_MUTATION_RESPONSE_ACK
    );
    const usesProfileMutationControlPlane = PROFILE_MUTATION_CONTROL_ACTIONS.has(
      message?.action,
    );
    const usesDashboardBootReadiness = DASHBOARD_BOOT_READ_ACTIONS.has(message?.action);
    const usesDashboardProfileGeneration = (
      DASHBOARD_PROFILE_GENERATION_BOUND_SETTINGS_ACTIONS.has(message?.action)
      && isTrustedDashboardPageSender(sender)
    );
    const usesProfileGenerationBootSettlement = PROFILE_GENERATION_BOOT_SETTLEMENT_ACTIONS.has(
      message?.action,
    );
    const isFullInitPrerequisite = FULL_INIT_PREREQUISITE_MESSAGE_TYPES.has(message?.type);
    const readinessFailureCode = usesProfileGenerationBootSettlement
      ? 'PROFILE_GENERATION_BOOT_SETTLEMENT_FAILED'
      : usesDashboardBootReadiness
        ? 'DASHBOARD_BOOT_READINESS_FAILED'
        : 'SERVICE_INIT_FAILED';
    let readinessPromise = null;
    reportRoutePhase?.('readiness_started');
    try {
      if (SECURITY_VAULT_ACTIONS.includes(message?.action)) {
        readinessPromise = null;
      } else if (usesProfileMutationResponseAck) {
        readinessPromise = Promise.resolve();
      } else if (usesProfileMutationControlPlane) {
        readinessPromise = Promise.resolve(readProfileMutationLifecycle()).then((lifecycle) => {
          if (isProfileResetWriteAdmissionClosed(lifecycle)) return undefined;
          const initPromise = getInitPromise();
          if (initPromise !== null && typeof initPromise?.then !== 'function') {
            throw new Error('SERVICE_INIT_PROMISE_INVALID');
          }
          return initPromise
            ? initPromise.then(
              () => undefined,
              () => undefined,
            )
            : undefined;
        });
      } else if (isFullInitPrerequisite) {
        readinessPromise = null;
      } else if (usesProfileGenerationBootSettlement) {
        readinessPromise = getProfileGenerationBootSettlementPromise();
      } else if (usesDashboardBootReadiness) {
        readinessPromise = getDashboardBootReadinessPromise();
      } else {
        readinessPromise = getInitPromise();
      }
      if (usesDashboardProfileGeneration && readinessPromise === null) {
        readinessPromise = Promise.resolve();
      }
      if (
        (usesProfileGenerationBootSettlement && typeof readinessPromise?.then !== 'function')
        || (readinessPromise !== null && typeof readinessPromise?.then !== 'function')
      ) {
        throw new Error(usesProfileGenerationBootSettlement
          ? 'PROFILE_GENERATION_BOOT_SETTLEMENT_PROMISE_INVALID'
          : usesDashboardBootReadiness
            ? 'DASHBOARD_BOOT_READINESS_PROMISE_INVALID'
            : 'SERVICE_INIT_PROMISE_INVALID');
      }
    } catch (error) {
      reportRoutePhase?.('readiness_settled');
      if (usesProfileGenerationBootSettlement) {
        console.error('[Router] Profile generation boot settlement failed:', error);
        sendResponse?.(buildFailureResponse(
          message,
          resolveNamedFailureCode(
            error,
            'PROFILE_GENERATION_BOOT_SETTLEMENT_FAILED',
          ),
          error,
        ));
      } else if (usesDashboardBootReadiness) {
        console.error('[Router] Dashboard boot readiness failed:', error);
        sendResponse?.(buildFailureResponse(
          message,
          resolveDashboardBootReadinessFailureCode(error),
          error,
        ));
      } else {
        sendDispatchFailure(sendResponse, error, message);
      }
      return false;
    }

    if (readinessPromise) {
      if (reportRoutePhase) {
        void readinessPromise.then(
          () => reportRoutePhase('readiness_settled'),
          () => reportRoutePhase('readiness_settled'),
        );
      }
      if (!usesProfileMutationControlPlane) reportRoutePhase?.('capture_started');
      let admissionPromise;
      try {
        admissionPromise = usesProfileMutationControlPlane
          ? Promise.resolve(null)
          : profileMutationRuntimeGate.capture({
            label: resolveRuntimeAdmissionLabel(message),
          });
      } catch (error) {
        if (!usesProfileMutationControlPlane) reportRoutePhase?.('capture_settled');
        throw error;
      }
      void admissionPromise.catch(() => undefined);
      if (reportRoutePhase && !usesProfileMutationControlPlane) {
        void admissionPromise.then(
          () => reportRoutePhase('capture_settled'),
          () => reportRoutePhase('capture_settled'),
        );
      }
      Promise.all([readinessPromise, admissionPromise]).then(async ([, admission]) => {
        try {
          const handled = admission === null
            ? dispatchAdmittedMessage(message, sender, sendResponse, reportRoutePhase)
            : await dispatchCapturedMessage(admission, message, sender, sendResponse, reportRoutePhase);
          if (handled !== true) {
            sendResponse?.(buildFailureResponse(message, 'SERVICE_NOT_HANDLED_ASYNC'));
          }
        } catch (error) {
          if (isProfileMutationRuntimeAdmissionError(error)) {
            sendProfileMutationAdmissionFailure(sendResponse, error, message);
          } else {
            sendDispatchFailure(sendResponse, error, message);
          }
        }
      }).catch((error) => {
        if (isProfileMutationRuntimeAdmissionError(error)) {
          sendProfileMutationAdmissionFailure(sendResponse, error, message);
          return;
        }
        console.error(`[Router] ${readinessFailureCode} blocked message dispatch:`, error);
        sendResponse?.(buildFailureResponse(
          message,
          usesProfileGenerationBootSettlement
            ? resolveNamedFailureCode(error, readinessFailureCode)
            : usesDashboardBootReadiness
              ? resolveDashboardBootReadinessFailureCode(error)
              : readinessFailureCode,
          error,
        ));
      });
      return true;
    }

    reportRoutePhase?.('readiness_settled');
    try {
      return dispatchAdmittedMessage(message, sender, sendResponse, reportRoutePhase);
    } catch (error) {
      if (isProfileMutationRuntimeAdmissionError(error)) {
        sendProfileMutationAdmissionFailure(sendResponse, error, message);
      } else {
        sendDispatchFailure(sendResponse, error, message);
      }
      return false;
    }
  }

  return {
    handleMessage,
    handleBuildCapabilityActionClicked,
  };
}
