import { INTERVENTION_COLLISION_QA_ACTION, parseInterventionCollisionQaRequest,
  createCollisionFurinCandidate } from '../../../../../domains/protection/background/automation/interventionCollisionQaContract.dev.js';
import { assertTrustedQaAutomationHarnessSender } from '../../../../../platform/security/qaAutomationHarnessTrust.dev.js';
import { InterventionAdmissionRepository } from '../../../../../platform/storage/runtime/InterventionAdmissionRepository.js';
import { getInterventionAdmissionService } from '../../../../../domains/protection/background/runtime/InterventionAdmissionService.js';
import { getSession } from '../../../../../domains/nudge/runtime/session/nudgeSessionStore.js';
import { NUDGE_SESSION_KEYS } from '../../../../../domains/nudge/runtime/session/nudgeSessionShared.js';
import { MESSAGE_TYPES } from '../../../../../platform/messaging/messageTypes.js';
import { TAB_CLOSURE_REQUESTERS } from '../../../../../domains/protection/contracts/tabClosureContract.js';
import { captureCollisionEnsoFixtureDocument, prepareCollisionEnsoCandidate } from '../../../../../domains/protection/background/automation/interventionCollisionQaFixture.dev.js';

export function createInterventionCollisionQaMessageRoutes({ browserPort, gateInterstitialController,
  contentScriptOrchestrator, maybeTriggerProtectionNudge, requestTabClosure } = {}) {
  async function execute(message, sender) {
    assertTrustedQaAutomationHarnessSender(sender, browserPort, { errorCode: 'COLLISION_QA_SENDER_UNTRUSTED' });
    const request = parseInterventionCollisionQaRequest(message);
    const tab = await browserPort.tabsGet(request.targetTabId);
    if (tab?.id !== request.targetTabId) throw new Error('COLLISION_QA_TAB_UNAVAILABLE');
    const url = new URL(tab.url);
    const local = url.protocol === 'http:' && /^collision-[ab]\.localhost$/u.test(url.hostname);
    const gate = gateInterstitialController.isGatePageUrl(tab.url);
    if (!local && !(gate && ['read', 'replay_enso_end'].includes(request.operation))) throw new Error('COLLISION_QA_LOCAL_FIXTURE_REQUIRED');
    if (request.operation === 'read') {
      const admission = await new InterventionAdmissionRepository().read();
      const nudge = await getSession(Object.fromEntries(Object.values(NUDGE_SESSION_KEYS).map((key) => [key, {}])));
      return { now: Date.now(), admission, nudge, gate: await gateInterstitialController.readTabSession(tab.id) };
    }
    if (request.operation === 'prepare_enso_candidate') {
      const fixtureDocument = captureCollisionEnsoFixtureDocument(contentScriptOrchestrator, tab.id, tab.url);
      return prepareCollisionEnsoCandidate(getInterventionAdmissionService(), tab.id, fixtureDocument);
    }
    if (request.operation === 'furin') {
      if (typeof maybeTriggerProtectionNudge !== 'function') throw new Error('COLLISION_QA_DISPATCH_OWNER_REQUIRED');
      return maybeTriggerProtectionNudge(tab.id, tab.url, {
        force: false, runtimeOverride: createCollisionFurinCandidate(request.payload.scope, url.hostname),
      });
    }
    if (request.operation === 'stop_auto') {
      const result = await browserPort.tabsSendMessage(tab.id, { type: MESSAGE_TYPES.NUDGE_STOP,
        payload: { runIds: [request.payload.runId] } }, { frameId: 0 });
      if (result.error) throw new Error(`COLLISION_QA_STOP_FAILED:${result.error}`);
      return result.response;
    }
    if (request.operation === 'replay_enso_end') {
      const service = getInterventionAdmissionService();
      const record = await new InterventionAdmissionRepository().read();
      if (!record.found || (!record.value.owner && record.value.blockers.length === 0)
        || record.value.owner?.leaseId === request.payload.leaseId
        || record.value.blockers.some((owner) => owner.leaseId === request.payload.leaseId)) throw new Error('COLLISION_QA_RETIRED_LEASE_REQUIRED');
      const identity = { ...request.payload, tabId: tab.id };
      const ended = await service.transition(identity, 'ended');
      if (typeof requestTabClosure !== 'function') throw new Error('COLLISION_QA_CLOSURE_OWNER_REQUIRED');
      const closure = await requestTabClosure({ tabId: tab.id, documentId: identity.documentId,
        admissionLease: { leaseId: identity.leaseId }, requester: TAB_CLOSURE_REQUESTERS.ENSO_GATE_LEAVE,
        reason: 'qa_retired_conclusion_replay' });
      return { ended, closure };
    }
    const now = Date.now();
    let open = true;
    try {
      return await gateInterstitialController.presentForRuntimeSnapshot({ tabId: tab.id, url: tab.url, now,
        presentationMode: 'blocking', runtimeSnapshot: { scope: { isBlockedDomain: true,
          specialSession: { active: true, mode: 'isolation', id: request.requestId, endsAt: now + 120_000 } } },
        mutationFence: { assertCurrent(phase) { if (!open || !phase) throw new Error('COLLISION_QA_GATE_PHASE_REQUIRED'); } },
      });
    } finally { open = false; }
  }
  return { actions: { [INTERVENTION_COLLISION_QA_ACTION]: (message, sender, respond) => {
    void execute(message, sender).then(
      (result) => respond({ success: true, requestId: message.requestId, result }),
      (error) => respond({ success: false, requestId: message.requestId, error: error.message,
        ...(error.code === 'PROTECTION_DISPATCH_PERMISSION_CHANGED' ? { diagnostic: {
          phase: error.phase, expectedRevision: error.expectedRevision, currentRevision: error.currentRevision,
        } } : {}),
      }),
    );
    return true;
  } } };
}
