import { MESSAGE_ACTIONS } from '../../../../../platform/messaging/messageTypes.js';
import { normalizeDomain } from '../../../../../lib/domain.js';
import { isHostnameInList } from '../../../../../lib/index.js';
import { isTrustedExtensionPageSender } from '../../../../../platform/security/senderTrust.js';
import { buildSiteRegistrationRejectionResponse } from '../../../../../domains/progression/contracts/siteRegistrationRejection.js';

function resolvePopupDomain(message) {
  return normalizeDomain(message?.domain || message?.hostname || '');
}

function resolvePopupRequestDomain(message, sender) {
  if (!isTrustedExtensionPageSender(sender)) {
    return { ok: false, error: 'UNTRUSTED_SENDER' };
  }

  const domain = resolvePopupDomain(message);
  if (!domain) {
    return { ok: false, error: 'INVALID_DOMAIN' };
  }

  return { ok: true, domain };
}

function buildPopupBlockState(settingsCache, domain) {
  const blockedUrls = Array.isArray(settingsCache?.blockedUrls) ? settingsCache.blockedUrls : [];
  return isHostnameInList(domain, blockedUrls);
}

export function createPopupBlockMessageRoutes({
  popupBlockFlow,
  settingsService,
  settingsCache,
  progressionService,
} = {}) {
  if (typeof progressionService?.readSiteRegistrationJourney !== 'function') {
    throw new Error('POPUP_SITE_REGISTRATION_JOURNEY_OWNER_REQUIRED');
  }
  const runPopupBlockHandler = ({
    operation,
    successPayload,
    errorCode,
    enforceRegistrationJourney = false,
  }) => (message, sender, sendResponse) => {
    (async () => {
      const request = resolvePopupRequestDomain(message, sender);
      if (!request.ok) {
        sendResponse({ success: false, error: request.error });
        return;
      }
      if (Object.hasOwn(message, 'goalMinutes')) throw new Error('POPUP_REGISTRATION_TIME_FORBIDDEN');

      if (enforceRegistrationJourney) {
        await settingsService.ensureSettingsCache();
        const access = await progressionService.readSiteRegistrationJourney({
          protectedSiteCount: new Set(settingsCache.blockedUrls).size,
          allowedSiteCount: new Set(settingsCache.allowedUrls).size,
        });
        if (access.requiresDashboardRegistration && !buildPopupBlockState(settingsCache, request.domain)) {
          sendResponse({ success: true, domain: request.domain, blocked: false, pending: false, requiresDashboard: true });
          return;
        }
      }

      await operation({
        domain: request.domain,
        message,
        sender,
      });
      const payload = await successPayload(request.domain, message);
      sendResponse(payload);
    })().catch((error) => {
      const registrationRejection = buildSiteRegistrationRejectionResponse(error);
      if (registrationRejection !== null) {
        sendResponse(registrationRejection);
        return;
      }
      sendResponse({ success: false, error: error?.message || errorCode });
    });

    return true;
  };

  return {
    actions: {
      [MESSAGE_ACTIONS.POPUP_QUEUE_BLOCK_DOMAIN]: runPopupBlockHandler({
        enforceRegistrationJourney: true,
        operation: async ({ domain }) => {
          await popupBlockFlow.queuePendingPopupBlockDomain(domain);
          await popupBlockFlow.processPendingPopupBlockDomains('popup_queue');
        },
        successPayload: async (domain) => {
          await settingsService.ensureSettingsCache();
          const blocked = buildPopupBlockState(settingsCache, domain);
          return {
            success: true,
            domain,
            blocked,
            pending: !blocked,
          };
        },
        errorCode: 'POPUP_QUEUE_BLOCK_FAILED',
      }),

      [MESSAGE_ACTIONS.POPUP_COMMIT_BLOCK_DOMAIN]: runPopupBlockHandler({
        enforceRegistrationJourney: true,
        operation: async ({ domain }) => {
          await popupBlockFlow.queuePendingPopupBlockDomain(domain);
          await popupBlockFlow.processPendingPopupBlockDomains('popup_commit');
        },
        successPayload: async (domain) => {
          await settingsService.ensureSettingsCache();
          const blocked = buildPopupBlockState(settingsCache, domain);
          if (!blocked) {
            return { success: false, error: 'PERMISSION_MISSING', domain };
          }

          return {
            success: true,
            domain,
            blocked: true,
          };
        },
        errorCode: 'POPUP_COMMIT_BLOCK_FAILED',
      }),

      [MESSAGE_ACTIONS.POPUP_CANCEL_BLOCK_DOMAIN]: runPopupBlockHandler({
        operation: async ({ domain }) => {
          await popupBlockFlow.cancelPendingPopupBlockDomain(domain);
        },
        successPayload: async (domain) => ({
          success: true,
          domain,
        }),
        errorCode: 'POPUP_CANCEL_BLOCK_FAILED',
      }),
    },
  };
}
