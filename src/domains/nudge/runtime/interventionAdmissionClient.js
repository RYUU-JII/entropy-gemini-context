import { MESSAGE_ACTIONS } from '../../../platform/messaging/messageTypes.js';
import { runtimeSendMessageReliable, runtimeOnMessageAddListener, isExtensionContextInvalidatedError } from '../../../platform/messaging/runtime/runtimeMessaging.js';
import { requireInterventionKind, requireInterventionRevocationReason } from './interventionPolicy.js';
import { createInterventionActivationTrace, recordInterventionLifecycleEvent } from './interventionLifecycleDiagnostics.js';
import { createRandomUuid } from '../../../lib/randomUuid.js';
import { requireGoalEpisodeBinding, areGoalEpisodeBindingsEqual } from './goalEpisodeBinding.js';

function requireGoalPurpose({ kind, source, manual, purpose }) {
  if (source !== 'goal_feed_horizon') {
    if (purpose !== null) throw new Error('INTERVENTION_GOAL_PURPOSE_UNEXPECTED');
    return;
  }
  const expected = kind === 'site_furin' ? 'site_goal' : kind === 'global_sentinel' ? 'global_goal' : null;
  if (expected === null || purpose !== expected || manual !== false) throw new Error('INTERVENTION_GOAL_PURPOSE_INVALID');
}

/** A transport projection, not a scheduler. Synchronous input producers request
 * one short reservation. Clicks consume it on a subsequent input; Feed Horizon
 * may complete its still-current boundary on the existing observation beat.
 * Receiving permission itself never replays input, starts a surface or retries.
 */
export function createInterventionAdmissionClient({
  send = runtimeSendMessageReliable, listen = runtimeOnMessageAddListener,
  now = () => Date.now(), report = (error) => console.error('[InterventionAdmissionClient]', error),
  record = recordInterventionLifecycleEvent,
} = {}) {
  let ticket = null;
  let pending = null;
  let revision = 0;
  let terminal = null;
  let tail = Promise.resolve();
  let listenerInstalled = false;
  let documentInvalidated = false;
  let contextInvalidated = false;
  let cleanupTicket = null;
  let contextInvalidationHandler = null;
  let contextInvalidationTask = null;
  const reportedErrors = new WeakSet();
  const stopped = () => ({ accepted: false, reason: 'extension_context_invalidated' });
  let lastLifecycle = null;

  function observe(event, evidence, details = {}) {
    lastLifecycle = Object.freeze({ ...evidence, ...details, event, at: now() });
    record(event, lastLifecycle);
  }

  function reportFailure(error) {
    if (error && typeof error === 'object') {
      if (reportedErrors.has(error)) return;
      reportedErrors.add(error);
    }
    report(error);
  }

  function invalidateContext() {
    if (contextInvalidated) return;
    contextInvalidated = true;
    observe('transport_stopped', ticket?.evidence ?? pending?.evidence, { reason: 'extension_context_invalidated' });
    documentInvalidated = true;
    revision += 1;
    ensoCadence = null;
    cadenceRead = null;
    if (lastRequest) lastRequest = Object.freeze({ ...lastRequest, status: 'cancelled', reason: 'extension_context_invalidated' });
    // The old extension cannot acknowledge lifecycle messages. Still release
    // every local effect; preserve failed cleanup ownership for diagnostics.
    const current = ticket;
    const failures = current ? runTicketCleanups(current, 'extension_context_invalidated') : [];
    failures.forEach(reportFailure);
    if (failures.length === 0 && ticket === current) ticket = null;
    terminal = null;
    notifyContextInvalidation();
  }

  function notifyContextInvalidation() {
    if (!contextInvalidated || !contextInvalidationHandler || contextInvalidationTask) return;
    // Invoke synchronously so the content owner closes admission before another
    // callback can start work. Observe its asynchronous cleanup completion too.
    try {
      contextInvalidationTask = Promise.resolve(contextInvalidationHandler({ reason: 'extension_context_invalidated' }));
    } catch (error) {
      contextInvalidationTask = Promise.reject(error);
    }
    void contextInvalidationTask.catch(reportFailure);
  }

  function setContextInvalidationHandler(handler) {
    if (typeof handler !== 'function') throw new Error('INTERVENTION_CONTEXT_INVALIDATION_HANDLER_REQUIRED');
    if (contextInvalidationHandler && contextInvalidationHandler !== handler) throw new Error('INTERVENTION_CONTEXT_INVALIDATION_OWNER_ALREADY_BOUND');
    contextInvalidationHandler = handler;
    notifyContextInvalidation();
  }
  // Last candidate outcome only; never read by admission or retry policy.
  let lastRequest = null;
  let ensoCadence = null;
  let cadenceRead = null;
  let cadenceRequestedAt = 0;

  function receiveCadence(value) {
    if (!value || value.version !== 1 || typeof value.eligible !== 'boolean'
      || !['consumedMs', 'intervalMs', 'remainingMs', 'revision', 'observedAt'].every(
        (key) => Number.isSafeInteger(value[key]) && value[key] >= 0)
      || value.intervalMs <= 0 || value.consumedMs > value.intervalMs
      || value.remainingMs !== value.intervalMs - value.consumedMs
      || (value.eligible && (value.remainingMs !== 0 || value.reason !== 'consumption_interval_due'))
      || typeof value.reason !== 'string') throw new Error('ENSO_CADENCE_DTO_INVALID');
    if (ensoCadence && value.revision < ensoCadence.revision) return;
    ensoCadence = Object.freeze({ ...value });
  }

  function refreshEnsoCadence() {
    installListener();
    if (documentInvalidated) return Promise.resolve(null);
    if (cadenceRead) return cadenceRead;
    const generation = revision;
    const cadenceAtStart = ensoCadence;
    const cadenceReadId = createRandomUuid();
    cadenceRequestedAt = now();
    const work = enqueue({ operation: 'enso_cadence', cadenceReadId }).then((result) => {
      if (generation === revision) receiveCadence(result.cadence);
      return ensoCadence;
    });
    cadenceRead = work;
    void work.then(() => { if (cadenceRead === work) cadenceRead = null; },
      (error) => {
        if (cadenceRead === work) cadenceRead = null;
        // A push can refresh the projection without changing policy revision.
        // This failed read owns only the receipt it started with.
        if (generation === revision && ensoCadence === cadenceAtStart) ensoCadence = null;
        reportFailure(error);
      });
    return work;
  }

  function getEnsoCadence() {
    const stale = !ensoCadence || now() - ensoCadence.observedAt > 90_000;
    const returned = ['not_consuming', 'not_foreground', 'observation_stale'].includes(ensoCadence?.reason)
      && globalThis.document?.visibilityState !== 'hidden';
    if ((stale || returned) && !documentInvalidated && now() - cadenceRequestedAt >= 10_000) {
      void refreshEnsoCadence().catch(() => { /* reported by the read owner */ });
    }
    return stale ? null : ensoCadence;
  }

  async function message(payload) {
    const sentAt = now();
    const result = await send({ action: MESSAGE_ACTIONS.INTERVENTION_ADMISSION, ...payload }, { timeoutMs: 2_000 });
    if (!result?.ok || !result.response || result.response.error) {
      const reason = result?.response?.error || result?.error || 'INTERVENTION_TRANSPORT_FAILED';
      const error = new Error(`INTERVENTION_TRANSPORT_FAILED:${reason}:operation=${payload.operation}:request=${payload.requestId ?? 'none'}:elapsedMs=${now() - sentAt}`);
      error.code = reason;
      error.operation = payload.operation;
      if (payload.operation === 'enso_cadence') {
        error.cadenceReadId = payload.cadenceReadId;
        error.message += `:cadenceReadId=${payload.cadenceReadId}`;
      }
      throw error;
    }
    if (payload.operation !== 'request' && result.response.accepted !== true) throw new Error(`INTERVENTION_LIFECYCLE_REJECTED:${result.response.reason}`);
    return result.response;
  }

  function enqueue(payload, onFailure = null, evidence = null, canSend = null) {
    const queuedAt = now();
    const task = tail.then(async () => {
      if (contextInvalidated) return stopped();
      if (canSend && !canSend()) return { accepted: false, reason: 'candidate_cancelled' };
      if (payload.operation === 'enso_cadence') observe('cadence_read_sent', null, {
        cadenceReadId: payload.cadenceReadId, queueWaitMs: Math.max(0, now() - queuedAt),
      });
      try {
        const result = await message(payload);
        if (evidence && payload.operation !== 'request') observe('receipt_acknowledged', evidence, {
          operation: payload.operation, leaseId: payload.leaseId,
        });
        return result;
      }
      catch (error) {
        if (!isExtensionContextInvalidatedError(error)) {
          if (evidence) observe('receipt_failed', evidence, { operation: payload.operation, leaseId: payload.leaseId ?? null, error: error.message });
          throw error;
        }
        invalidateContext();
        return stopped();
      }
    });
    tail = task.then(() => undefined, (error) => {
      reportFailure(error);
      // A failed local cleanup retains the ticket, but must not poison the
      // transport lane needed by an explicit later cleanup or exact receipt.
      try { onFailure?.(error); } catch (cleanupError) { reportFailure(cleanupError); }
    });
    return task;
  }

  function finish(lease, reason = 'owner_released') {
    if (!ticket || ticket.lease !== lease) return false;
    // A nested surface release cannot acknowledge the whole ticket while a
    // sibling cleanup has not settled (or can still fail).
    if (cleanupTicket === ticket) return true;
    const ended = ticket;
    ticket = null;
    terminal = { leaseId: lease.leaseId, presentedAt: ended.presentedAt,
      boundaryPresentedAt: ended.boundaryPresentedAt, finalPresentedAt: ended.finalPresentedAt };
    observe('locally_released', ended.evidence, { reason, presentedAt: ended.presentedAt });
    if (!contextInvalidated) void enqueue({ operation: 'ended', leaseId: lease.leaseId }, null, ended.evidence);
    return true;
  }

  function runTicketCleanups(current, reason) {
    if (cleanupTicket) throw new Error('INTERVENTION_CLEANUP_REENTRY');
    const failures = [];
    observe('cleanup_started', current.evidence, { reason });
    cleanupTicket = current;
    try {
      for (const cleanup of [...current.cleanups]) {
        try {
          const result = cleanup({ reason });
          if (result && typeof result.then === 'function') {
            void Promise.resolve(result).catch(reportFailure);
            throw new Error('INTERVENTION_ASYNC_CLEANUP_UNSUPPORTED');
          }
          current.cleanups.delete(cleanup);
        } catch (error) {
          current.cleanups.add(cleanup);
          failures.push(error);
        }
      }
    } finally { cleanupTicket = null; }
    observe(failures.length ? 'cleanup_failed' : 'cleanup_completed', current.evidence, {
      reason, errors: failures.map(error => error.message),
    });
    return failures;
  }

  function revoke(reason) {
    const current = ticket;
    if (!current) return true;
    const failures = runTicketCleanups(current, reason);
    if (failures.length === 1) throw failures[0];
    if (failures.length > 1) throw new AggregateError(failures, 'INTERVENTION_CLEANUP_FAILED');
    if (ticket === current) finish(current.lease, reason);
    return true;
  }

  function installListener() {
    if (contextInvalidated) return;
    try { installListenerCore(); }
    catch (error) {
      if (!isExtensionContextInvalidatedError(error)) throw error;
      invalidateContext();
    }
  }

  function installListenerCore() {
    if (listenerInstalled) return;
    if (listen((request, _sender, respond) => {
      if (request.type !== 'INTERVENTION_ADMISSION_CONTROL') return false;
      if (request.operation === 'enso_cadence') {
        try {
          if (documentInvalidated) throw new Error('INTERVENTION_DOCUMENT_INVALIDATED');
          receiveCadence(request.cadence);
          respond({ accepted: true });
        } catch (error) { reportFailure(error); respond({ accepted: false, error: error.message }); }
        return false;
      }
      if (documentInvalidated) {
        respond({ leaseId: request.leaseId, active: false, presentedAt: 0, boundaryPresentedAt: 0,
          finalPresentedAt: 0, cleaned: false, error: 'INTERVENTION_DOCUMENT_INVALIDATED' });
        return false;
      }
      const current = ticket?.lease.leaseId === request.leaseId ? ticket : null;
      try {
        const revocationReason = request.operation === 'revoke'
          ? requireInterventionRevocationReason(request.reason) : null;
        const presentedAt = current?.presentedAt || (terminal?.leaseId === request.leaseId ? terminal.presentedAt : 0);
        if (current && request.operation === 'revoke') revoke(revocationReason);
        else if (current && !current.endpointAttachedAt && !current.presentedAt && now() >= current.lease.reservedUntil) revoke('reservation_expired');
        const proof = current || (terminal?.leaseId === request.leaseId ? terminal : null);
        respond({ leaseId: request.leaseId, active: ticket?.lease.leaseId === request.leaseId, presentedAt,
          boundaryPresentedAt: proof ? proof.boundaryPresentedAt : 0,
          finalPresentedAt: proof ? proof.finalPresentedAt : 0, cleaned: true });
      } catch (error) {
        reportFailure(error);
        respond({ leaseId: request.leaseId, active: true, cleaned: false, error: error.message });
      }
      return false;
    }) !== true) throw new Error('INTERVENTION_CONTROL_LISTENER_UNAVAILABLE');
    listenerInstalled = true;
    globalThis.window?.addEventListener('pagehide', () => {
      revision += 1;
      documentInvalidated = true;
      if (pending) observe('request_cancelled', pending.evidence, { reason: 'document_exit' });
      ensoCadence = null;
      cadenceRead = null;
      if (lastRequest) lastRequest = Object.freeze({ ...lastRequest, status: 'cancelled', reason: 'document_exit' });
      try { revoke('document_exit'); } catch (error) { reportFailure(error); }
      finally { terminal = null; }
    });
    globalThis.window?.addEventListener('pageshow', (event) => {
      if (contextInvalidated || !event.persisted || !documentInvalidated) return;
      if (ticket) { reportFailure(new Error('INTERVENTION_DOCUMENT_RESTORE_CLEANUP_PENDING')); return; }
      // BFCache restores the same document with a fresh transport generation.
      // Old presentation proof stays invalid; restoration itself is no input.
      revision += 1;
      documentInvalidated = false;
      void refreshEnsoCadence().catch(() => { /* reported by the read owner */ });
    });
  }

  async function prepare({ kind, source = kind, manual = false, purpose = null, goalBinding = null, observedAt = now(), lifecycleTrace = null }) {
    requireInterventionKind(kind);
    requireGoalPurpose({ kind, source, manual, purpose });
    installListener();
    if (contextInvalidated) return stopped();
    if (documentInvalidated) return { accepted: false, reason: 'document_invalidated' };
    const automaticFurin = manual === false && ['site_furin', 'global_sentinel'].includes(kind);
    if (automaticFurin) requireGoalEpisodeBinding(goalBinding);
    else if (goalBinding !== null) throw new Error('INTERVENTION_GOAL_BINDING_UNEXPECTED');
    if (ticket || pending) return { accepted: false, reason: 'local_intervention_active' };
    const generation = revision;
    const requestId = `content:${createRandomUuid()}`;
    const evidence = Object.freeze({ ...(lifecycleTrace ?? createInterventionActivationTrace()), kind, source, manual, purpose, requestId });
    observe('request_pending', evidence, { observedAt });
    lastRequest = Object.freeze({ requestId, kind, source, observedAt,
      status: 'pending', reason: null, notBefore: null });
    const candidate = { kind, source, cancelled: false, evidence };
    pending = candidate;
    const isCurrent = () => generation === revision && !candidate.cancelled;
    const work = enqueue({ operation: 'request', kind, manual, requestId, observedAt,
      ...(automaticFurin ? { source, goalBinding } : {}),
      ...(source === 'goal_feed_horizon' ? { source, purpose } : {}) }, null, evidence, isCurrent);
    try {
      const result = await work;
      if (isCurrent()) {
        lastRequest = Object.freeze({ requestId, kind, source, observedAt,
          status: result.accepted ? 'accepted' : 'denied',
          leaseId: result.accepted ? result.lease.leaseId : null,
          reason: result.reason ?? null, notBefore: result.notBefore ?? null });
      }
      if (!result.accepted) {
        observe(isCurrent() ? 'request_denied' : 'request_cancelled', evidence, { reason: result.reason });
        if (contextInvalidated) return stopped();
        return isCurrent() ? result : { accepted: false, reason: 'candidate_stale' };
      }
      const lease = Object.freeze(result.lease);
      if (automaticFurin && !areGoalEpisodeBindingsEqual(lease.goalBinding, goalBinding)) throw new Error('INTERVENTION_GOAL_LEASE_BINDING_INVALID');
      if (source === 'goal_feed_horizon' && (lease.kind !== kind || lease.source !== source
        || lease.purpose !== purpose || lease.manual !== false)) throw new Error('INTERVENTION_GOAL_LEASE_INVALID');
      const leaseEvidence = Object.freeze({ ...evidence, leaseId: lease.leaseId,
        tabId: lease.tabId ?? null, documentId: lease.documentId ?? null });
      observe('lease_granted', leaseEvidence);
      if (!isCurrent() || now() >= lease.reservedUntil) {
        observe('grant_discarded', leaseEvidence, { reason: isCurrent() ? 'reservation_expired' : 'candidate_cancelled' });
        if (isCurrent()) lastRequest = Object.freeze({ ...lastRequest, status: 'expired', reason: 'candidate_stale' });
        await enqueue({ operation: 'ended', leaseId: lease.leaseId }, null, leaseEvidence);
        return { accepted: false, reason: 'candidate_stale' };
      }
      ticket = { lease, source, purpose, evidence: leaseEvidence, consumed: false,
        endpointAttachedAt: 0, presentedAt: 0, boundaryPresentedAt: 0, finalPresentedAt: 0,
        boundaryReceipt: null, boundaryAcknowledged: false, goalEndpointAdopted: false, cleanups: new Set() };
      return { accepted: true, lease };
    } catch (error) {
      if (isCurrent()) {
        lastRequest = Object.freeze({ requestId, kind, source, observedAt,
          status: 'failed', reason: error.message, notBefore: null });
      }
      throw error;
    } finally {
      if (pending === candidate) pending = null;
    }
  }

  function cancelPending(scope = null) {
    if (scope !== null) {
      requireInterventionKind(scope.kind);
      if (typeof scope.source !== 'string' || !scope.source.trim()) throw new Error('INTERVENTION_CANCEL_SOURCE_REQUIRED');
    }
    const matches = (kind, source) => scope === null || (scope.kind === kind && scope.source === source);
    if (pending && matches(pending.kind, pending.source) && !pending.cancelled) {
      pending.cancelled = true;
      observe('request_cancelled', pending.evidence, { reason: 'candidate_cancelled' });
    }
    if (lastRequest && matches(lastRequest.kind, lastRequest.source)) {
      lastRequest = Object.freeze({ ...lastRequest, status: 'cancelled', reason: 'candidate_cancelled' });
    }
    if (ticket && !ticket.consumed && matches(ticket.lease.kind, ticket.source)) finish(ticket.lease, 'candidate_cancelled');
  }

  function tryReserve({ kind, source = kind, manual = false, purpose = null, goalBinding = null, observedAt = now(), lifecycleTrace = null }) {
    requireGoalPurpose({ kind, source, manual, purpose });
    const automaticFurin = manual === false && ['site_furin', 'global_sentinel'].includes(kind);
    if (contextInvalidated) return { ...stopped(), lease: null };
    if (documentInvalidated) return { accepted: false, lease: null, reason: 'document_invalidated' };
    if (automaticFurin) requireGoalEpisodeBinding(goalBinding);
    if (ticket && !ticket.consumed && (ticket.source !== source || now() >= Math.min(ticket.lease.reservedUntil, ticket.lease.observedAt + 5_000))) {
      finish(ticket.lease, ticket.source !== source ? 'source_replaced' : 'prepared_boundary_expired');
    }
    if (ticket && !ticket.consumed && ticket.lease.kind === kind && ticket.source === source && ticket.lease.manual === manual) {
      if (automaticFurin && !areGoalEpisodeBindingsEqual(ticket.lease.goalBinding, goalBinding)) {
        return { accepted: false, lease: null, reason: 'goal_binding_mismatch' };
      }
      ticket.consumed = true;
      return { accepted: true, lease: ticket.lease };
    }
    if (!ticket && !pending) void prepare({ kind, source, manual, purpose, goalBinding, observedAt, lifecycleTrace }).catch(reportFailure);
    return { accepted: false, lease: null, decision: { decision: 'defer', reason: 'fresh_boundary_required', notBefore: 0 } };
  }

  function canCompletePrepared({ kind, source = kind, manual = false, goalBinding = null }) {
    return !!(!documentInvalidated && ticket && !ticket.consumed && ticket.lease.kind === kind
      && ticket.source === source && ticket.lease.manual === manual
      && (manual || !['site_furin', 'global_sentinel'].includes(kind)
        || areGoalEpisodeBindingsEqual(ticket.lease.goalBinding, goalBinding))
      && globalThis.document?.visibilityState !== 'hidden'
      && now() < Math.min(ticket.lease.reservedUntil, ticket.lease.observedAt + 5_000));
  }

  function present(lease) {
    if (contextInvalidated) return;
    if (!ticket || ticket.lease !== lease) throw new Error('INTERVENTION_PRESENT_LEASE_MISMATCH');
    const goal = ticket.source === 'goal_feed_horizon';
    if (goal && (!ticket.goalEndpointAdopted || !ticket.boundaryAcknowledged)) throw new Error('INTERVENTION_GOAL_HANDOFF_REQUIRED');
    if (ticket.finalPresentedAt) return;
    if (globalThis.document?.visibilityState === 'hidden') { revoke('presentation_hidden'); throw new Error('INTERVENTION_PRESENTATION_HIDDEN'); }
    if (!ticket.endpointAttachedAt && now() >= lease.reservedUntil) { revoke('reservation_expired'); throw new Error('INTERVENTION_RESERVATION_EXPIRED'); }
    ticket.consumed = true;
    ticket.finalPresentedAt = now();
    if (!ticket.presentedAt) ticket.presentedAt = ticket.finalPresentedAt;
    const evidence = ticket.evidence;
    observe('locally_presented', evidence, { presentedAt: ticket.presentedAt, finalPresentedAt: ticket.finalPresentedAt });
    void enqueue({ operation: 'presented', leaseId: lease.leaseId }, () => {
      if (ticket?.lease === lease) revoke('presentation_rejected');
    }, evidence);
  }

  function authorizeGoal(lease) {
    if (contextInvalidated) return Promise.resolve(stopped());
    if (!ticket || ticket.lease !== lease || lease.manual !== false
      || !['site_furin', 'global_sentinel'].includes(lease.kind)) throw new Error('INTERVENTION_GOAL_AUTHORIZATION_LEASE_MISMATCH');
    const current = ticket;
    return enqueue({ operation: 'authorize_goal', leaseId: lease.leaseId }, () => {
      if (ticket === current) revoke('goal_authorization_rejected');
    }, current.evidence).then(result => {
      if (result.accepted !== true || ticket !== current) throw new Error('INTERVENTION_GOAL_AUTHORIZATION_STALE');
      return result;
    });
  }

  function attachEndpoint(lease) {
    if (contextInvalidated) return false;
    if (!ticket || ticket.lease !== lease) throw new Error('INTERVENTION_ENDPOINT_LEASE_MISMATCH');
    const periodic = lease.kind === 'enso_gate' && ticket.source === 'feed_horizon';
    const goal = ticket.source === 'goal_feed_horizon';
    if ((!periodic && !goal) || ticket.cleanups.size === 0) {
      throw new Error('INTERVENTION_ENDPOINT_OWNER_REQUIRED');
    }
    if (ticket.endpointAttachedAt) return true;
    if (globalThis.document?.visibilityState === 'hidden') { revoke('presentation_hidden'); throw new Error('INTERVENTION_PRESENTATION_HIDDEN'); }
    if (now() >= lease.reservedUntil) { revoke('reservation_expired'); throw new Error('INTERVENTION_RESERVATION_EXPIRED'); }
    // A mounted endpoint owns a lifecycle, not a waiting candidate. Preserve
    // that ownership while the current item is read; actual encounter is later.
    ticket.endpointAttachedAt = now();
    const evidence = ticket.evidence;
    observe('endpoint_attached', evidence, { endpointAttachedAt: ticket.endpointAttachedAt });
    void enqueue({ operation: 'endpoint_attached', leaseId: lease.leaseId }, () => {
      if (ticket?.lease === lease) revoke('endpoint_attachment_rejected');
    }, evidence);
    return true;
  }

  function boundaryPresented(lease) {
    if (contextInvalidated) return Promise.resolve(stopped());
    if (!ticket || ticket.lease !== lease) throw new Error('INTERVENTION_BOUNDARY_LEASE_MISMATCH');
    if (ticket.source !== 'goal_feed_horizon' || !ticket.consumed || !ticket.endpointAttachedAt
      || ticket.cleanups.size === 0) throw new Error('INTERVENTION_GOAL_ENDPOINT_REQUIRED');
    if (globalThis.document?.visibilityState === 'hidden') { revoke('presentation_hidden'); throw new Error('INTERVENTION_PRESENTATION_HIDDEN'); }
    if (ticket.boundaryReceipt) return ticket.boundaryReceipt;
    const current = ticket;
    current.boundaryPresentedAt = now();
    current.presentedAt = current.boundaryPresentedAt;
    observe('boundary_presented', current.evidence, { boundaryPresentedAt: current.boundaryPresentedAt });
    current.boundaryReceipt = enqueue({ operation: 'boundary_presented', leaseId: lease.leaseId }, () => {
      if (ticket === current) revoke('boundary_presentation_rejected');
    }, current.evidence).then(result => {
      if (result.accepted !== true || ticket !== current) throw new Error('INTERVENTION_GOAL_BOUNDARY_STALE');
      current.boundaryAcknowledged = true;
      return result;
    });
    return current.boundaryReceipt;
  }

  function adoptPreparedFurin({ kind, manual, leaseId, source }) {
    requireInterventionKind(kind);
    if (contextInvalidated) return { ...stopped(), lease: null };
    if (documentInvalidated || manual !== false || !ticket || ticket.lease.leaseId !== leaseId
      || !['site_furin', 'global_sentinel'].includes(kind)
      || ticket.lease.kind !== kind || ticket.lease.manual !== false
      || ticket.source !== source || !['goal_feed_horizon', 'furin_entry_action'].includes(source)
      || !ticket.consumed || ticket.finalPresentedAt || ticket.goalEndpointAdopted
      || (source === 'goal_feed_horizon' ? (!ticket.endpointAttachedAt || !ticket.boundaryAcknowledged
        || !ticket.boundaryPresentedAt) : now() >= ticket.lease.reservedUntil)
      || globalThis.document?.visibilityState === 'hidden') {
      return { accepted: false, lease: null, reason: 'furin_handoff_invalid' };
    }
    ticket.goalEndpointAdopted = true;
    observe('furin_handoff_adopted', ticket.evidence, { boundaryPresentedAt: ticket.boundaryPresentedAt });
    return { accepted: true, lease: ticket.lease, reason: 'furin_handoff_adopted' };
  }

  function adoptPresentedGoalEndpoint({ kind, manual, leaseId }) {
    return adoptPreparedFurin({ kind, manual, leaseId, source: 'goal_feed_horizon' });
  }

  function bind(lease, cleanup) {
    if (contextInvalidated) throw new Error('INTERVENTION_EXTENSION_CONTEXT_INVALIDATED');
    if (!ticket || ticket.lease !== lease) throw new Error('INTERVENTION_BIND_LEASE_MISMATCH');
    ticket.consumed = true;
    ticket.cleanups.add(cleanup);
    const ownedTicket = ticket;
    return () => ownedTicket.cleanups.delete(cleanup);
  }

  return Object.freeze({
    getEnsoCadence, refreshEnsoCadence,
    setContextInvalidationHandler,
    enabled: true, prepare, tryReserve, canCompletePrepared, attachEndpoint, boundaryPresented,
    adoptPresentedGoalEndpoint, adoptPreparedFurin, authorizeGoal, present, bind, release: finish, abort: finish,
    currentLease: (kind) => ticket?.lease.kind === kind ? ticket.lease : null,
    reserveEnso: ({ source, now: observedAt, manual = false, lifecycleTrace = null }) => tryReserve({ kind: 'enso_gate', source, observedAt, manual, lifecycleTrace }),
    reserveCandidate: (candidate, { now: observedAt }) => tryReserve({ kind: candidate.kind, source: candidate.kind, observedAt }),
    getSnapshot: () => ({ enabled: true, contextInvalidated, state: { activeLease: ticket?.lease || null },
      endpointAttachedAt: ticket?.endpointAttachedAt ?? 0,
      source: ticket?.source ?? null, purpose: ticket?.purpose ?? null,
      boundaryPresentedAt: ticket?.boundaryPresentedAt ?? 0, finalPresentedAt: ticket?.finalPresentedAt ?? 0,
      boundaryAcknowledged: ticket?.boundaryAcknowledged ?? false,
      presentedAt: ticket?.presentedAt ?? 0, pending: pending !== null, lastRequest, lastLifecycle, ensoCadence }),
    cancelPending,
    drain: async () => { await tail; if (contextInvalidationTask) await contextInvalidationTask; },
  });
}

export const interventionAdmissionClient = createInterventionAdmissionClient();
export default interventionAdmissionClient;
