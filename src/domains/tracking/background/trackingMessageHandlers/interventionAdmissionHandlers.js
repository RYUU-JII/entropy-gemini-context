import { MESSAGE_ACTIONS } from '../../../../platform/messaging/messageTypes.js';
import { BUILD_INCLUDE_DEBUG_TOOLS } from '../../../../platform/build/releaseCapabilities.js';
import { isTrustedExtensionPageSender, resolveSenderDocumentId, resolveTrustedSenderTabId } from '../../../../platform/security/senderTrust.js';
import { getInterventionAdmissionService } from '../../../protection/background/runtime/InterventionAdmissionService.js';
import { runAsyncHandler } from './runtimeHandlerUtils.js';

export function createInterventionAdmissionHandlers() {
  return {
    [MESSAGE_ACTIONS.INTERVENTION_ADMISSION]: (request, sender, sendResponse) => runAsyncHandler(sendResponse, async () => {
      const owner = getInterventionAdmissionService();
      const tabId = resolveTrustedSenderTabId(sender);
      const documentId = resolveSenderDocumentId(sender);
      if (tabId === null || !documentId) throw new Error('INTERVENTION_SENDER_DOCUMENT_REQUIRED');
      if (request.operation === 'gate_presented') {
        if (sender.frameId !== 0 || (sender.documentLifecycle !== undefined && sender.documentLifecycle !== 'active')
          || !isTrustedExtensionPageSender(sender) || !new URL(sender.url).pathname.endsWith('/gate.html')
          || new URL(sender.url).searchParams.get('session') !== request.sessionId) throw new Error('INTERVENTION_GATE_SENDER_INVALID');
        const session = await owner.gateRepository.getSessionByTabId(tabId);
        if (session?.sessionId !== request.sessionId || session.gatePageUrl !== sender.url
          || (session.gateKind === 'detourSpreadGuard' && session.metrics.gateDocumentId !== documentId)) {
          throw new Error('INTERVENTION_GATE_SENDER_INVALID');
        }
        return owner.presentGate(request.sessionId, tabId);
      }
      if (sender.frameId !== 0 || isTrustedExtensionPageSender(sender)) throw new Error('INTERVENTION_TOP_CONTENT_REQUIRED');
      if (request.operation === 'enso_cadence') return owner.readEnsoCadence({ tabId, documentId, cadenceReadId: request.cadenceReadId });
      if (request.operation === 'request') {
        if (request.manual && !BUILD_INCLUDE_DEBUG_TOOLS) throw new Error('INTERVENTION_MANUAL_UNAVAILABLE');
        return owner.request({ tabId, documentId, kind: request.kind, gateKind: null,
          requestId: request.requestId, observedAt: request.observedAt, manual: request.manual === true,
          ...(!request.manual && ['site_furin', 'global_sentinel'].includes(request.kind)
            ? { source: request.source, goalBinding: request.goalBinding } : {}),
          ...(request.source === 'goal_feed_horizon' ? { source: request.source, purpose: request.purpose } :
            Object.hasOwn(request, 'purpose') ? { purpose: request.purpose } : {}) });
      }
      return owner.transition({ tabId, documentId, leaseId: request.leaseId }, request.operation);
    }, (error) => ({ accepted: false, reason: 'admission_failed', error: error.message })),
  };
}
