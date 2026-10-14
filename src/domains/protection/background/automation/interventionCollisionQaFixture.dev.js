import { isForegroundTab } from '../protocol/dispatch/ProtectionDispatchTransport.js';
import { requireAtomicContentSessionSnapshot, resolveReadyContentDocumentId } from '../protocol/dispatch/ProtectionDispatchLifecyclePrimitives.js';

export function captureCollisionEnsoFixtureDocument(contentScriptOrchestrator, tabId, targetUrl) {
  if (typeof contentScriptOrchestrator?.getTabSessionSnapshot !== 'function') {
    throw new Error('COLLISION_QA_CONTENT_SESSION_OWNER_REQUIRED');
  }
  const snapshot = requireAtomicContentSessionSnapshot(contentScriptOrchestrator, tabId);
  const documentId = resolveReadyContentDocumentId(snapshot.session);
  if (!documentId || snapshot.session.url !== targetUrl) throw new Error('COLLISION_QA_CONTENT_DOCUMENT_REQUIRED');
  return Object.freeze({
    documentId, generation: snapshot.generation,
    assertCurrent() {
      const current = requireAtomicContentSessionSnapshot(contentScriptOrchestrator, tabId);
      if (current.generation !== snapshot.generation
        || resolveReadyContentDocumentId(current.session) !== documentId
        || current.session.url !== targetUrl) throw new Error('COLLISION_QA_CONTENT_DOCUMENT_CHANGED');
    },
  });
}

// Controlled admission prerequisite for the disposable collision fixture only.
// This is explicitly synthetic operational state, never a usage observation.
// The production request, foreground check, recovery and lease lifecycle remain
// unchanged. The caller owns trusted harness / exact local target validation.
export function prepareCollisionEnsoCandidate(service, tabId, fixtureDocument) {
  if (!Number.isSafeInteger(tabId) || tabId < 0) throw new Error('COLLISION_QA_TAB_UNAVAILABLE');
  if (!Object.isFrozen(fixtureDocument) || typeof fixtureDocument?.assertCurrent !== 'function'
    || typeof fixtureDocument.documentId !== 'string' || !fixtureDocument.documentId) {
    throw new Error('COLLISION_QA_CONTENT_DOCUMENT_FENCE_REQUIRED');
  }
  const observationRevision = service.ensoObservationRevision;
  return service.run('qaCollisionPrepareEnsoCandidate', async (state) => {
    fixtureDocument.assertCurrent();
    if (state.owner || state.blockers.length) throw new Error('COLLISION_QA_ENSO_OWNER_ACTIVE');
    if (service.now() < state.kernel.globalNotBefore) throw new Error('COLLISION_QA_ENSO_RECOVERY_ACTIVE');
    if (!await isForegroundTab(tabId, service.browserPort)) throw new Error('COLLISION_QA_ENSO_FOREGROUND_REQUIRED');
    fixtureDocument.assertCurrent();
    await service.ensureEnsoPolicy(state);
    fixtureDocument.assertCurrent();
    if (service.ensoObservationRevision !== observationRevision) throw new Error('COLLISION_QA_ENSO_OBSERVATION_CHANGED');
    if (!state.ensoCadence.enabled) throw new Error('COLLISION_QA_ENSO_POLICY_DISABLED');
    if (service.ensoClosedInterval !== null) throw new Error('COLLISION_QA_ENSO_OBSERVATION_PENDING');
    if (state.ensoCadence.consumedMs >= state.ensoCadence.intervalMs) throw new Error('COLLISION_QA_ENSO_ALREADY_DUE');

    const preparedAt = service.now();
    const before = Object.freeze({ ...state.ensoCadence });
    state.ensoCadence = { ...state.ensoCadence,
      consumedMs: state.ensoCadence.intervalMs,
      observedAt: preparedAt,
      awaySince: null,
      revision: state.ensoCadence.revision + 1,
    };
    await service.save(state);
    fixtureDocument.assertCurrent();
    if (service.ensoObservationRevision !== observationRevision || service.ensoClosedInterval !== null) {
      throw new Error('COLLISION_QA_ENSO_OBSERVATION_CHANGED');
    }
    // This anchor is part of the declared synthetic prerequisite, not a fake
    // tracking receipt. No clock, historical data, or diagnostic read is changed.
    service.ensoObservationRevision += 1;
    service.ensoAnchor = { mode: 'consuming', tabId, observedAt: preparedAt };
    return Object.freeze({
      kind: 'collision_enso_operational_prerequisite', synthetic: true,
      naturalConsumptionObserved: false, tabId, documentId: fixtureDocument.documentId, preparedAt,
      before, after: Object.freeze({ ...state.ensoCadence }),
    });
  });
}
