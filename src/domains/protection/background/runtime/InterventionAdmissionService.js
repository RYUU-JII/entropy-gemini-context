import { InterventionAdmissionRepository } from '../../../../platform/storage/runtime/InterventionAdmissionRepository.js';
import {
  createInterventionAdmissionState, reduceInterventionAdmission,
  requireInterventionAdmissionState,
} from '../../../nudge/runtime/interventionAdmissionKernel.js';
import {
  INTERVENTION_RECOVERY_MS, INTERVENTION_CANDIDATE_TTL_MS,
  INTERVENTION_RESERVATION_TTL_MS, isMandatoryIntervention,
  requireInterventionKind, startsInterventionRecovery, holdsInterventionLane,
  requireInterventionRevocationReason,
} from '../../../nudge/runtime/interventionPolicy.js';
import { isForegroundTab } from '../protocol/dispatch/ProtectionDispatchTransport.js';
import {
  createInterventionExposureWindow, requireInterventionExposureWindow,
  advanceInterventionExposureWindow, recordInterventionExposureEnd, projectInterventionExposureSnapshot,
} from './interventionExposureWindow.js';
import { createEnsoCadenceState, requireEnsoCadenceState, configureEnsoCadence, advanceEnsoCadence,
  resetEnsoCadence, isEnsoReflection, projectEnsoCadence, requireEnsoCadencePoint, ENSO_CADENCE_MAX_OBSERVATION_GAP_MS } from './ensoCadencePolicy.js';
import { DEFAULT_ENSO_INTERVAL_PRESET, resolveEnsoIntervalMs } from '../../../settings/config/ensoIntervalPolicy.js';
import { requireGoalEpisodeBinding, evaluateGoalEpisodeBinding, areGoalEpisodeBindingsEqual } from '../../../nudge/runtime/goalEpisodeBinding.js';
import { resolveActivityDayWindow } from '../../../stats/shared/activityDay.js';
import { requireNudgeCancellationReason, normalizePendingEntry } from '../../../nudge/runtime/session/nudgeSessionCore.js';

function text(value, code) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(code);
  return value;
}

function isGoalEndpoint(owner) { return owner.source === 'goal_feed_horizon'; }
function isAutomaticFurin(owner) { return owner?.manual === false && ['site_furin', 'global_sentinel'].includes(owner.kind); }

function requireGoalReceipt(owner, receipt) {
  if (!isGoalEndpoint(owner)) return;
  if (!['boundaryPresentedAt', 'finalPresentedAt'].every(key => Number.isSafeInteger(receipt?.[key]) && receipt[key] >= 0)
    || receipt.boundaryPresentedAt !== receipt.presentedAt
    || (receipt.finalPresentedAt > 0 && (receipt.boundaryPresentedAt <= 0 || receipt.finalPresentedAt < receipt.boundaryPresentedAt))) {
    throw new Error('INTERVENTION_GOAL_PRESENTATION_RECEIPT_INVALID');
  }
}

function requireOwner(owner) {
  if (!owner || !Number.isInteger(owner.tabId) || owner.tabId < 0) {
    throw new Error('INTERVENTION_TAB_REQUIRED');
  }
  text(owner.documentId, 'INTERVENTION_DOCUMENT_REQUIRED');
  text(owner.requestId, 'INTERVENTION_REQUEST_REQUIRED');
  requireInterventionKind(owner.kind);
  if (typeof owner.manual !== 'boolean') throw new Error('INTERVENTION_MODE_REQUIRED');
  if (owner.gateKind !== null && !['entryCheckpoint', 'returnGuard', 'detourSpreadGuard', 'isolation'].includes(owner.gateKind)) {
    throw new Error('INTERVENTION_GATE_KIND_INVALID');
  }
  if ((owner.kind === 'gate_interstitial') !== (owner.gateKind !== null)) throw new Error('INTERVENTION_GATE_OWNER_INVALID');
  if (isGoalEndpoint(owner)) {
    const purpose = owner.kind === 'site_furin' ? 'site_goal' : owner.kind === 'global_sentinel' ? 'global_goal' : null;
    if (purpose === null || owner.purpose !== purpose || owner.manual !== false || owner.gateKind !== null) {
      throw new Error('INTERVENTION_GOAL_PURPOSE_INVALID');
    }
  } else if (Object.hasOwn(owner, 'purpose')) throw new Error('INTERVENTION_GOAL_PURPOSE_UNEXPECTED');
  if (isAutomaticFurin(owner)) {
    const binding = requireGoalEpisodeBinding(owner.goalBinding);
    if (binding.purpose !== (owner.kind === 'site_furin' ? 'site_goal' : 'global_goal')) throw new Error('INTERVENTION_GOAL_BINDING_SCOPE_MISMATCH');
    if (binding.tabId !== owner.tabId || binding.documentId !== owner.documentId) throw new Error('INTERVENTION_GOAL_BINDING_DOCUMENT_MISMATCH');
  } else if (Object.hasOwn(owner, 'goalBinding')) throw new Error('INTERVENTION_GOAL_BINDING_UNEXPECTED');
  return owner;
}

function initialState() {
  return { version: 1, kernel: createInterventionAdmissionState({ globalMinimumGapMs: INTERVENTION_RECOVERY_MS }), owner: null, blockers: [], lastEnded: null };
}

function validateState(state) {
  if (!state || state.version !== 1 || !Array.isArray(state.blockers)
    || !Object.hasOwn(state, 'owner') || !Object.hasOwn(state, 'lastEnded')
    || state.owner === undefined || state.lastEnded === undefined) throw new Error('INTERVENTION_SESSION_INVALID');
  requireInterventionAdmissionState(state.kernel);
  if (Object.hasOwn(state, 'exposureWindow')) requireInterventionExposureWindow(state.exposureWindow);
  if (Object.hasOwn(state, 'ensoCadence')) requireEnsoCadenceState(state.ensoCadence);
  if (state.kernel.globalMinimumGapMs !== INTERVENTION_RECOVERY_MS) throw new Error('INTERVENTION_SESSION_POLICY_INVALID');
  if (Boolean(state.owner) !== Boolean(state.kernel.activeLease)) throw new Error('INTERVENTION_SESSION_OWNER_MISMATCH');
  for (const owner of [state.owner, ...state.blockers, state.lastEnded].filter(Boolean)) {
    requireOwner(owner);
    text(owner.leaseId, 'INTERVENTION_SESSION_LEASE_REQUIRED');
    if (!Number.isSafeInteger(owner.reservedUntil) || !Number.isSafeInteger(owner.presentedAt)
      || owner.presentedAt < 0 || !Number.isSafeInteger(owner.observedAt)
      || owner.observedAt < 0 || owner.reservedUntil <= owner.observedAt) throw new Error('INTERVENTION_SESSION_TIMELINE_INVALID');
    if (isGoalEndpoint(owner)) {
      requireGoalReceipt(owner, owner);
      if (!Object.hasOwn(owner, 'endpointAttachedAt') || !Number.isSafeInteger(owner.endpointAttachedAt)
        || owner.endpointAttachedAt < 0 || owner.endpointAttachedAt >= owner.reservedUntil
        || (owner.boundaryPresentedAt > 0 && (owner.endpointAttachedAt <= 0 || owner.boundaryPresentedAt < owner.endpointAttachedAt))) {
        throw new Error('INTERVENTION_GOAL_ENDPOINT_RECEIPT_INVALID');
      }
    // Ordinary Enso's optional lifecycle extension keeps its existing shape.
    } else if (Object.hasOwn(owner, 'endpointAttachedAt') && (owner.kind !== 'enso_gate'
      || !Number.isSafeInteger(owner.endpointAttachedAt) || owner.endpointAttachedAt <= 0
      || owner.endpointAttachedAt >= owner.reservedUntil)) throw new Error('INTERVENTION_ENDPOINT_RECEIPT_INVALID');
  }
  if (state.owner && state.owner.leaseId !== state.kernel.activeLease.leaseId) throw new Error('INTERVENTION_SESSION_LEASE_MISMATCH');
  if (state.blockers.some((owner) => !isMandatoryIntervention(owner))) throw new Error('INTERVENTION_SESSION_BLOCKER_INVALID');
  return state;
}

function sameLease(owner, identity) {
  return !!owner && owner.leaseId === identity.leaseId
    && owner.tabId === identity.tabId && owner.documentId === identity.documentId;
}

function denied(reason, state) {
  return { accepted: false, reason, lease: null, notBefore: state.kernel.globalNotBefore };
}

function clipEnsoIntervalAtPresentation(interval, state) {
  if (interval === null) return null;
  const presented = [state.owner, ...state.blockers].filter(owner => owner?.presentedAt > 0);
  const endedAt = presented.reduce((at, owner) => Math.min(at, owner.presentedAt), interval.endedAt);
  return endedAt > interval.startedAt ? { ...interval, endedAt } : null;
}

/** Browser-session admission authority. No candidate queue, alarm or cooldown timer.
 * Every mutation reads the canonical checkpoint inside one serialized lane.
 * The lane includes revocation and destructive resolution, so a stale callback
 * cannot pass authorization then race a new admission across an await.
 */
export class InterventionAdmissionService {
  constructor({ repository = new InterventionAdmissionRepository(), browserPort, gateRepository, onGatePresented = null,
    runProfileMutationAdmittedTask,
    readGoalAuthorization = null,
    readGoalPriority = null,
    readEnsoPolicy = () => ({ enabled: true, intervalMs: resolveEnsoIntervalMs(DEFAULT_ENSO_INTERVAL_PRESET) }), now = () => Date.now(),
    record = (event, details) => console.debug('[InterventionAdmission]', event, details) }) {
    if (typeof runProfileMutationAdmittedTask !== 'function') throw new Error('INTERVENTION_PROFILE_ADMISSION_REQUIRED');
    this.runProfileMutationAdmittedTask = runProfileMutationAdmittedTask;
    this.repository = repository;
    this.browserPort = browserPort;
    this.gateRepository = gateRepository;
    this.onGatePresented = onGatePresented;
    this.now = now;
    this.record = record;
    this.tail = Promise.resolve();
    this.runningOperation = null;
    this.queuedOperations = 0;
    this.exposureRecordingInitialization = null;
    this.readEnsoPolicy = readEnsoPolicy;
    this.readGoalAuthorization = readGoalAuthorization;
    this.readGoalPriority = readGoalPriority;
    this.goalAuthorizationRevision = 0;
    this.ensoAnchor = null;
    this.ensoObservationRevision = 0;
    this.ensoReceiver = null;
    this.ensoReceiverGeneration = 0;
    this.ensoNotificationPending = null;
    this.ensoNotificationTask = null;
    this.ensoClosedInterval = null;
  }

  observe(event, owner, details = {}) {
    this.record(event, { tabId: owner.tabId, documentId: owner.documentId,
      requestId: owner.requestId ?? null, leaseId: owner.leaseId ?? null,
      kind: owner.kind ?? null, ...details });
  }

  run(operation, work, diagnostic = null) {
    // Recording must precede every callback that can wait on stats. Memory
    // joins this one initialization, never a later admission mutation tail.
    const initialized = this.beginExposureRecording();
    return this.enqueue(operation, async (state) => {
      await initialized;
      return work(state);
    }, diagnostic);
  }

  enqueue(operation, work, diagnostic = null) {
    const queuedAt = this.now();
    const blockedBy = this.runningOperation;
    const queueDepth = this.queuedOperations++;
    if (diagnostic) this.observe('cadence_read_queued', diagnostic, { operation, cadenceReadId: diagnostic.cadenceReadId, blockedBy, queueDepth });
    const task = this.tail.then(async () => {
      this.queuedOperations -= 1;
      this.runningOperation = operation;
      const startedAt = this.now();
      let status = 'failed';
      try {
        const record = await this.repository.read();
        if (!record || typeof record.found !== 'boolean') throw new Error('INTERVENTION_SESSION_READ_INVALID');
        const state = record.found ? validateState(record.value) : initialState();
        const result = await work(state);
        status = 'completed';
        return result;
      } finally {
        this.runningOperation = null;
        if (diagnostic) this.observe('cadence_read_settled', diagnostic, { operation, cadenceReadId: diagnostic.cadenceReadId, blockedBy, queueDepth, status,
          queueWaitMs: Math.max(0, startedAt - queuedAt), runMs: Math.max(0, this.now() - startedAt) });
      }
    });
    this.tail = task.then(() => undefined, (error) => {
      console.error('[InterventionAdmission] operation failed', error);
    });
    return task;
  }

  async save(state) {
    // Begin the optional recording capability only on an explicit lifecycle
    // commit. Existing owners/cooldown survive unchanged; earlier time is unknown.
    state.exposureWindow = Object.hasOwn(state, 'exposureWindow')
      ? advanceInterventionExposureWindow(state.exposureWindow, this.now())
      : createInterventionExposureWindow(this.now());
    await this.repository.write(validateState(state));
  }

  endInState(state, owner, at, { presentedAt = owner.presentedAt,
    finalPresentedAt = isGoalEndpoint(owner) ? owner.finalPresentedAt : presentedAt, reason = 'ended' } = {}) {
    if (isGoalEndpoint(owner)) {
      owner.finalPresentedAt = finalPresentedAt;
      if (presentedAt > 0) owner.boundaryPresentedAt = presentedAt;
    }
    if (presentedAt > 0 && !isEnsoReflection(owner)) {
      // Manual/other presentations do not reset production cadence, but their
      // occupied duration must still be excluded when no Tracking beat occurred.
      if (!Object.hasOwn(state, 'ensoCadence')) state.ensoCadence = createEnsoCadenceState();
      this.applyClosedEnsoInterval(state);
      const anchor = this.ensoAnchor;
      const interval = anchor?.mode === 'consuming' && presentedAt > anchor.observedAt
        ? { startedAt: anchor.observedAt, endedAt: presentedAt } : null;
      state.ensoCadence = advanceEnsoCadence(state.ensoCadence, {
        point: { observedAt: at, tabId: anchor?.tabId ?? null, mode: anchor?.mode ?? 'unknown' },
        interval, intervalMs: state.ensoCadence.intervalMs,
      });
      if (anchor) this.ensoAnchor = { ...anchor, observedAt: at };
      this.ensoClosedInterval = null;
    }
    if (Object.hasOwn(state, 'exposureWindow')) {
      state.exposureWindow = recordInterventionExposureEnd(state.exposureWindow, owner, at, {
        presentedAt, confirmedEnd: reason === 'ended' || reason === 'document_handoff',
      });
    }
    if (owner === state.owner) {
      if (presentedAt > 0 && state.kernel.activeLease.phase === 'reserved') {
        state.kernel = reduceInterventionAdmission(state.kernel, { type: 'presented', leaseId: owner.leaseId, now: presentedAt }).state;
      }
      state.kernel = reduceInterventionAdmission(state.kernel, {
        type: state.kernel.activeLease.phase === 'presented' ? 'released' : 'aborted',
        leaseId: owner.leaseId, now: at,
      }).state;
      state.owner = null;
    } else {
      state.blockers = state.blockers.filter((entry) => entry !== owner);
      if (presentedAt > 0 && startsInterventionRecovery(owner)) {
        state.kernel = { ...state.kernel, globalNotBefore: Math.max(state.kernel.globalNotBefore, at + INTERVENTION_RECOVERY_MS) };
      }
    }
    state.lastEnded = { ...owner, presentedAt, endedAt: at, reason };
    if (presentedAt > 0 && isEnsoReflection(owner)) {
      state.ensoCadence = resetEnsoCadence(Object.hasOwn(state, 'ensoCadence') ? state.ensoCadence : createEnsoCadenceState(), at);
      // A shown ritual is the new cadence origin. An old foreground anchor
      // cannot add its occupied time after release or worker reconciliation.
      if (this.ensoAnchor) this.ensoAnchor = { ...this.ensoAnchor, observedAt: at };
      this.ensoClosedInterval = null;
    }
  }

  async ensureEnsoPolicy(state) {
    const previous = Object.hasOwn(state, 'ensoCadence') ? state.ensoCadence : createEnsoCadenceState();
    const next = configureEnsoCadence(previous, await this.readEnsoPolicy(), this.now());
    if (!Object.hasOwn(state, 'ensoCadence') || next !== previous) {
      state.ensoCadence = next;
      await this.save(state);
    }
    return state.ensoCadence;
  }

  cadenceSnapshot(state, reason = null) {
    const cadence = state.ensoCadence;
    const blocked = reason || (!cadence.enabled ? 'disabled'
      : (state.owner?.presentedAt > 0 || state.blockers.some(owner => owner.presentedAt > 0)) ? 'active_intervention'
        : this.ensoAnchor?.mode !== 'consuming' ? 'not_consuming'
          : this.now() - this.ensoAnchor.observedAt > ENSO_CADENCE_MAX_OBSERVATION_GAP_MS ? 'observation_stale' : null);
    return projectEnsoCadence(cadence, cadence.intervalMs, blocked);
  }

  // Existing browser ingress closes a known foreground interval synchronously.
  // The receipt is committed only by that ingress's admitted lifecycle task.
  // Neither browser events in another tab nor a read install a second clock.
  captureEnsoCadenceBoundary(at = this.now()) {
    if (!Number.isSafeInteger(at) || at < 0) throw new Error('ENSO_CADENCE_TIME_INVALID');
    const anchor = this.ensoAnchor;
    this.ensoAnchor = null;
    if (anchor?.mode === 'consuming' && at >= anchor.observedAt) {
      if (this.ensoClosedInterval !== null) throw new Error('ENSO_CADENCE_UNSETTLED_ANCHOR');
      this.ensoClosedInterval = { startedAt: anchor.observedAt, endedAt: at };
    }
    return { revision: ++this.ensoObservationRevision, observedAt: at,
      interval: anchor?.mode === 'consuming' && at >= anchor.observedAt ? { startedAt: anchor.observedAt, endedAt: at } : null };
  }

  captureEnsoCadenceObservation() { return this.ensoObservationRevision; }

  interruptEnsoDeparture(observedAt) {
    if (!Number.isSafeInteger(observedAt) || observedAt < 0) throw new Error('ENSO_CADENCE_TIME_INVALID');
    return this.run('interruptEnsoDeparture', async state => {
      await this.ensureEnsoPolicy(state);
      const previous = state.ensoCadence;
      if (observedAt < previous.observedAt || previous.awaySince === null) return { accepted: false, reason: 'no_current_departure' };
      // Positive protected audio only interrupts departure; it neither credits
      // exposure nor moves the foreground interval watermark/anchor.
      state.ensoCadence = { ...previous, awaySince: null, revision: previous.revision + 1 };
      await this.save(state);
      return { accepted: true };
    });
  }

  applyClosedEnsoInterval(state) {
    const interval = this.ensoClosedInterval;
    if (interval !== null) {
      state.ensoCadence = advanceEnsoCadence(state.ensoCadence, {
        point: { observedAt: interval.endedAt, tabId: null, mode: 'unknown' }, interval: clipEnsoIntervalAtPresentation(interval, state),
        intervalMs: state.ensoCadence.intervalMs,
      });
    }
    return interval;
  }

  async settleEnsoCadenceBoundary(receipt) {
    return this.run('settleEnsoCadenceBoundary', async state => {
      await this.ensureEnsoPolicy(state);
      if (receipt.revision !== this.ensoObservationRevision && this.ensoClosedInterval === null) {
        return { accepted: false, reason: 'observation_stale' };
      }
      // One closed receipt precedes every later foreground point, even when
      // cross-tab callbacks finish asynchronous preparation out of ingress order.
      const closed = this.applyClosedEnsoInterval(state);
      state.ensoCadence = advanceEnsoCadence(state.ensoCadence, { point: { observedAt: receipt.observedAt, tabId: null, mode: 'unknown' },
        intervalMs: state.ensoCadence.intervalMs,
        occupied: [state.owner, ...state.blockers].some(owner => owner?.presentedAt > 0) });
      await this.save(state);
      if (this.ensoClosedInterval === closed) this.ensoClosedInterval = null;
      this.pushEnsoCadence(state, 'not_consuming');
      this.ensoReceiver = null;
      return { accepted: true };
    });
  }

  observeEnsoCadence(point, { revision = this.ensoObservationRevision, isCurrent = () => true } = {}) {
    requireEnsoCadencePoint(point);
    return this.run('observeEnsoCadence', async state => {
      await this.ensureEnsoPolicy(state);
      if (revision !== this.ensoObservationRevision || !isCurrent()) return { accepted: false, reason: 'observation_stale' };
      const closed = this.applyClosedEnsoInterval(state);
      const anchor = this.ensoAnchor;
      const interval = anchor?.mode === 'consuming' && point.observedAt >= anchor.observedAt
        ? { startedAt: anchor.observedAt, endedAt: point.observedAt } : null;
      state.ensoCadence = advanceEnsoCadence(state.ensoCadence, { point, interval: clipEnsoIntervalAtPresentation(interval, state),
        intervalMs: state.ensoCadence.intervalMs, continuity: anchor !== null });
      await this.save(state);
      if (this.ensoClosedInterval === closed) this.ensoClosedInterval = null;
      if (revision !== this.ensoObservationRevision || !isCurrent()) return { accepted: false, reason: 'observation_stale' };
      this.ensoAnchor = { ...point };
      this.pushEnsoCadence(state);
      return { accepted: true, cadence: this.cadenceSnapshot(state) };
    });
  }

  readEnsoCadence({ tabId, documentId, cadenceReadId = null }) {
    // Optional correlation only; sender-derived document identity remains authority.
    if (cadenceReadId !== null && (typeof cadenceReadId !== 'string' || !/^[\w-]{1,64}$/.test(cadenceReadId))) {
      throw new Error('ENSO_CADENCE_READ_ID_INVALID');
    }
    return this.run('readEnsoCadence', async state => {
      await this.ensureEnsoPolicy(state);
      const foreground = await isForegroundTab(tabId, this.browserPort);
      if (foreground) {
        this.ensoReceiverGeneration += 1;
        this.ensoReceiver = Object.freeze({ tabId, documentId });
      }
      return { accepted: true, cadence: this.cadenceSnapshot(state,
        foreground && this.ensoAnchor?.tabId === tabId ? null : 'not_foreground') };
    }, { tabId, documentId, cadenceReadId });
  }

  pushEnsoCadence(state, reason = null) {
    const receiver = this.ensoReceiver;
    if (!receiver) return;
    const foreground = this.ensoAnchor?.tabId === receiver.tabId;
    // Snapshot at commit, not at send time. One in flight plus one latest pending
    // projection; neither an event history nor a second admission authority.
    this.ensoNotificationPending = Object.freeze({ receiver, generation: this.ensoReceiverGeneration,
      cadence: Object.freeze(this.cadenceSnapshot(state, reason || (foreground ? null : 'not_foreground'))) });
    this.startEnsoNotifications();
  }

  startEnsoNotifications() {
    if (this.ensoNotificationTask || !this.ensoNotificationPending) return;
    // Register immediately against the existing reset/import fence. This promise
    // is deliberately independent of the admission mutation tail.
    const task = this.runEnsoNotificationDrain();
    this.ensoNotificationTask = task;
    void task.then(() => this.finishEnsoNotifications(task), error => {
      const cancelled = ['PROFILE_MUTATION_RUNTIME_ADMISSION_CLOSED', 'PROFILE_MUTATION_RUNTIME_ADMISSION_GENERATION_CHANGED'].includes(error.code);
      this.record(cancelled ? 'cadence_notification_cancelled' : 'cadence_notification_failed', { reason: error.message });
      this.ensoNotificationPending = null;
      this.finishEnsoNotifications(task);
    });
  }

  async runEnsoNotificationDrain() {
    // Production uses runAdmittedLocal, which can reject synchronously at the
    // fence. Enter it before any await, but settle both throw/reject as delivery
    // failure so an already committed mutation cannot fail retroactively.
    const task = this.runProfileMutationAdmittedTask({ label: 'enso_cadence_notification', task: async () => {
      while (this.ensoNotificationPending) {
        const job = this.ensoNotificationPending;
        this.ensoNotificationPending = null;
        if (job.generation !== this.ensoReceiverGeneration) continue;
        await this.deliverEnsoCadence(job);
      }
    } });
    if (!task || typeof task.then !== 'function') throw new Error('INTERVENTION_PROFILE_ADMISSION_TASK_INVALID');
    await task;
  }

  finishEnsoNotifications(task) {
    if (this.ensoNotificationTask !== task) return;
    this.ensoNotificationTask = null;
    // A commit can arrive between the admitted drain finishing and this callback.
    if (this.ensoNotificationPending) this.startEnsoNotifications();
  }

  async deliverEnsoCadence({ receiver, generation, cadence }) {
    let reason = null;
    try {
      const result = await this.browserPort.tabsSendMessage(receiver.tabId, {
        type: 'INTERVENTION_ADMISSION_CONTROL', operation: 'enso_cadence', cadence,
      }, { frameId: 0, documentId: receiver.documentId }, { timeoutMs: 800 });
      if (result?.error || result?.response?.accepted !== true) {
        reason = result?.error || result?.response?.error || 'ENSO_CADENCE_NOTIFICATION_UNACKNOWLEDGED';
      }
    } catch (error) { reason = error.message; }
    if (reason !== null) {
      this.observe('cadence_notification_unavailable', receiver, { reason, cadenceRevision: cadence.revision });
      // An old receiver's failure cannot evict a newer document binding.
      if (generation === this.ensoReceiverGeneration) {
        this.ensoReceiver = null;
        this.ensoReceiverGeneration += 1;
        this.ensoNotificationPending = null;
      }
    }
  }

  async probe(owner, operation = 'inspect', reason = null) {
    return this.browserPort.tabsSendMessage(owner.tabId, {
      type: 'INTERVENTION_ADMISSION_CONTROL', operation, leaseId: owner.leaseId,
      ...(operation === 'revoke' ? { reason: requireInterventionRevocationReason(reason) } : {}),
    }, { frameId: 0, documentId: owner.documentId }, { timeoutMs: 800 });
  }

  async evaluateGoalOwner(binding, { tabId = null, documentId = null } = {}) {
    const goalBinding = requireGoalEpisodeBinding(binding);
    if ((tabId !== null && tabId !== goalBinding.tabId) || (documentId !== null && documentId !== goalBinding.documentId)) {
      return { valid: false, reason: 'goal_document_owner_changed' };
    }
    if (typeof this.readGoalAuthorization !== 'function') throw new Error('INTERVENTION_GOAL_AUTHORIZATION_OWNER_REQUIRED');
    let revision = this.goalAuthorizationRevision;
    let facts = await this.readGoalAuthorization({ goalBinding, tabId, now: this.now() });
    if (typeof facts?.isCurrent !== 'function') throw new Error('INTERVENTION_GOAL_AUTHORIZATION_FENCE_REQUIRED');
    if (revision !== this.goalAuthorizationRevision || facts.isCurrent() !== true) {
      // One bounded semantic re-read preserves an edit whose relevant values
      // are unchanged. Both reads use the same canonical owner and authority.
      revision = this.goalAuthorizationRevision;
      facts = await this.readGoalAuthorization({ goalBinding, tabId, now: this.now() });
      if (typeof facts?.isCurrent !== 'function') throw new Error('INTERVENTION_GOAL_AUTHORIZATION_FENCE_REQUIRED');
    }
    if (revision !== this.goalAuthorizationRevision || facts.isCurrent() !== true) return { valid: false, reason: 'goal_authorization_overtaken' };
    if (typeof facts.documentCurrent !== 'boolean' || typeof facts.permissionAvailable !== 'boolean') {
      throw new Error('INTERVENTION_GOAL_DOCUMENT_AUTHORITY_REQUIRED');
    }
    const pending = normalizePendingEntry(facts.pending);
    if (pending?.phase === 'entry_cancelling') {
      if (pending.runId !== goalBinding.runId || (tabId !== null && pending.tabId !== tabId)
        || !areGoalEpisodeBindingsEqual(pending.goalBinding, goalBinding)) {
        return { valid: false, reason: 'goal_pending_owner_changed' };
      }
      return { valid: false, reason: requireNudgeCancellationReason(pending.cancellationReason) };
    }
    if (!facts.documentCurrent) return { valid: false, reason: 'goal_document_owner_changed' };
    if (!facts.permissionAvailable) return { valid: false, reason: 'goal_permission_unavailable' };
    const current = evaluateGoalEpisodeBinding(goalBinding, facts);
    if (!current.valid) return current;
    if (resolveActivityDayWindow({ now: this.now(), resetHour: facts.activityDay.resetHour }).startDateStr !== facts.activityDay.dateStr) {
      return { valid: false, reason: 'activity_day_basis_changed' };
    }
    if (!pending || pending.runId !== goalBinding.runId || (tabId !== null && pending.tabId !== tabId)
      || !areGoalEpisodeBindingsEqual(pending.goalBinding, goalBinding)) {
      return { valid: false, reason: 'goal_pending_owner_changed' };
    }
    return { ...current, authorizationRevision: revision,
      isCurrent: () => facts.isCurrent() === true
        && resolveActivityDayWindow({ now: this.now(), resetHour: facts.activityDay.resetHour }).startDateStr === facts.activityDay.dateStr };
  }

  validateGoalBinding(goalBinding, options = {}) {
    return this.run('validateGoalBinding', async () => {
      const { valid, reason } = await this.evaluateGoalOwner(goalBinding, options);
      return { valid, reason };
    });
  }

  invalidateGoalAuthorization() { this.goalAuthorizationRevision += 1; }

  async readReadyGoalPriority(candidate) {
    if (typeof this.readGoalPriority !== 'function') throw new Error('INTERVENTION_GOAL_PRIORITY_OWNER_REQUIRED');
    const read = () => this.readGoalPriority({ tabId: candidate.tabId, documentId: candidate.documentId, now: this.now() });
    let priority = await read();
    if (typeof priority?.isCurrent !== 'function') throw new Error('INTERVENTION_GOAL_PRIORITY_FENCE_REQUIRED');
    if (priority.isCurrent() !== true) {
      priority = await read();
      if (typeof priority?.isCurrent !== 'function') throw new Error('INTERVENTION_GOAL_PRIORITY_FENCE_REQUIRED');
      if (priority.isCurrent() !== true) throw new Error('INTERVENTION_GOAL_PRIORITY_READ_OVERTAKEN');
    }
    if (!priority || typeof priority.goalReady !== 'boolean'
      || (priority.goalReady ? !['global_goal_ready', 'site_goal_ready'].includes(priority.reason) : priority.reason !== null)) {
      throw new Error('INTERVENTION_GOAL_PRIORITY_FACTS_INVALID');
    }
    return priority;
  }

  validateGoalPresentation(identity) {
    return this.run('validateGoalPresentation', async state => {
      const binding = requireGoalEpisodeBinding(identity.goalBinding);
      const owner = [state.owner, ...state.blockers].find(entry => sameLease(entry, identity));
      if (!owner || !isAutomaticFurin(owner) || binding.key !== identity.key || binding.runId !== identity.runId
        || !areGoalEpisodeBindingsEqual(owner.goalBinding, binding)) return { accepted: false, reason: 'goal_presentation_owner_changed' };
      const current = await this.evaluateGoalOwner(binding, { tabId: owner.tabId });
      if (!current.valid) return { accepted: false, reason: current.reason };
      const result = await this.probe(owner);
      const receipt = result?.response;
      if (result?.error || !receipt || receipt.leaseId !== owner.leaseId || receipt.active !== true || receipt.cleaned !== true
        || receipt.error || !Number.isSafeInteger(receipt.presentedAt) || receipt.presentedAt <= 0
        || !Number.isSafeInteger(receipt.finalPresentedAt) || receipt.finalPresentedAt <= 0
        || receipt.finalPresentedAt < receipt.presentedAt || receipt.finalPresentedAt > this.now()) {
        return { accepted: false, reason: 'goal_final_presentation_unconfirmed' };
      }
      requireGoalReceipt(owner, receipt);
      const finalCurrent = await this.evaluateGoalOwner(binding, { tabId: owner.tabId });
      if (!finalCurrent.valid) return { accepted: false, reason: finalCurrent.reason };
      if (isGoalEndpoint(owner)) {
        if (owner.boundaryPresentedAt <= 0) return { accepted: false, reason: 'goal_boundary_required' };
        if (!owner.finalPresentedAt) owner.finalPresentedAt = this.now();
      } else if (!owner.presentedAt) {
        if (!owner.endpointAttachedAt && this.now() >= owner.reservedUntil) return { accepted: false, reason: 'reservation_expired' };
        const at = this.now();
        if (owner === state.owner) state.kernel = reduceInterventionAdmission(state.kernel, { type: 'presented', leaseId: owner.leaseId, now: at }).state;
        owner.presentedAt = at;
      }
      await this.save(state);
      if (finalCurrent.authorizationRevision !== this.goalAuthorizationRevision || finalCurrent.isCurrent() !== true) {
        const settled = await this.evaluateGoalOwner(binding, { tabId: owner.tabId });
        if (!settled.valid) return { accepted: false, reason: settled.reason };
      }
      return { accepted: true, lease: { ...owner } };
    });
  }

  cancelGoalBinding(goalBinding, { reason = 'goal_binding_cancelled' } = {}) {
    const binding = requireGoalEpisodeBinding(goalBinding);
    text(reason, 'INTERVENTION_GOAL_CANCELLATION_REASON_REQUIRED');
    return this.run('cancelGoalBinding', async state => {
      const owner = [state.owner, ...state.blockers].find(entry => isAutomaticFurin(entry)
        && areGoalEpisodeBindingsEqual(entry.goalBinding, binding));
      if (!owner) return { accepted: true, cleaned: true, leaseId: null };
      await this.revokeGoalOwner(state, owner, reason);
      return { accepted: true, cleaned: true, leaseId: owner.leaseId };
    });
  }

  async revokeGoalOwner(state, owner, reason) {
    const result = await this.probe(owner, 'revoke', reason);
    const receipt = result?.response;
    if (result?.error || !receipt || receipt.leaseId !== owner.leaseId || receipt.active !== false
      || receipt.cleaned !== true || receipt.error || !Number.isSafeInteger(receipt.presentedAt) || receipt.presentedAt < 0) {
      throw new Error('INTERVENTION_GOAL_INVALIDATION_CLEANUP_UNCONFIRMED');
    }
    requireGoalReceipt(owner, receipt);
    this.endInState(state, owner, this.now(), { presentedAt: Math.max(owner.presentedAt, receipt.presentedAt),
      ...(isGoalEndpoint(owner) ? { finalPresentedAt: Math.max(owner.finalPresentedAt, receipt.finalPresentedAt) } : {}), reason });
    await this.save(state);
  }

  revalidateGoalOwners() {
    return this.run('revalidateGoalOwners', async state => {
      const cancelled = [];
      for (const owner of [state.owner, ...state.blockers].filter(isAutomaticFurin)) {
        // Final actual presentation keeps its historical identity and may
        // finish. A prelude alone still needs cancellation on goal changes.
        if (isGoalEndpoint(owner) ? owner.finalPresentedAt > 0 : owner.presentedAt > 0) continue;
        const current = await this.evaluateGoalOwner(owner.goalBinding, { tabId: owner.tabId });
        if (current.valid) continue;
        await this.revokeGoalOwner(state, owner, current.reason);
        cancelled.push({ leaseId: owner.leaseId, tabId: owner.tabId, goalBinding: owner.goalBinding, reason: current.reason });
      }
      return { accepted: true, cancelled };
    });
  }

  async reconcile(state) {
    for (const owner of [state.owner, ...state.blockers].filter(Boolean)) {
      // Tab liveness precedes document inspection. The strict port accepts
      // only Chrome's exact missing-tab error as proof; arbitrary API errors
      // cannot release ownership or be mistaken for document disappearance.
      const liveness = await this.browserPort.tabsGetLiveness(owner.tabId);
      if (liveness?.tabId !== owner.tabId || !['alive', 'gone'].includes(liveness?.status)) {
        throw new Error('INTERVENTION_TAB_LIVENESS_INVALID');
      }
      if (liveness.status === 'gone') {
        this.endInState(state, owner, this.now(), { reason: 'tab_gone' });
        await this.save(state);
        this.observe('owner_end_committed', owner, { reason: 'tab_gone' });
        continue;
      }
      // Gate session validity is owned by the existing session repository.
      if (owner.gateKind !== null) {
        const session = await this.gateRepository.getSessionByTabId(owner.tabId);
        if (owner.presentedAt === 0 && this.now() > owner.reservedUntil) {
          this.endInState(state, owner, this.now(), { reason: 'reservation_expired' });
          await this.save(state);
          this.observe('owner_end_committed', owner, { reason: 'reservation_expired' });
          continue;
        }
        if (session?.sessionId === owner.requestId) continue;
        // A newly granted reservation has not yet staged its Gate session.
        if (owner.presentedAt === 0 && this.now() <= owner.reservedUntil) continue;
        this.endInState(state, owner, this.now(), { reason: 'gate_session_gone' });
        await this.save(state);
        this.observe('owner_end_committed', owner, { reason: 'gate_session_gone' });
        continue;
      }
      const result = await this.probe(owner);
      if (result.error) {
        const frame = await this.browserPort.webNavigationGetFrame({ tabId: owner.tabId, frameId: 0 });
        // An unreachable but still current document is uncertainty, not expiry.
        if (frame && frame.documentId === owner.documentId) throw new Error('INTERVENTION_OWNER_UNREACHABLE');
        this.endInState(state, owner, this.now(), { reason: 'document_gone' });
        await this.save(state);
        this.observe('owner_end_committed', owner, { reason: 'document_gone' });
        continue;
      }
      const receipt = result.response;
      if (!receipt || receipt.leaseId !== owner.leaseId || typeof receipt.active !== 'boolean'
        || !Number.isSafeInteger(receipt.presentedAt) || receipt.presentedAt < 0) throw new Error('INTERVENTION_PROBE_INVALID');
      requireGoalReceipt(owner, receipt);
      // Inactive is not cleanup proof: a document can invalidate its transport
      // while still retaining input/media ownership after a failed teardown.
      if (receipt.cleaned !== true || receipt.error) {
        this.observe('cleanup_unconfirmed', owner, { error: receipt.error ?? null });
        throw new Error('INTERVENTION_RECONCILIATION_CLEANUP_UNCONFIRMED');
      }
      this.observe('owner_probe_confirmed', owner, { active: receipt.active, presentedAt: receipt.presentedAt });
      if (!receipt.active) {
        // Before the acquire response arrives the content legitimately has no
        // ticket. A reservation cannot be reclaimed inside that delivery window.
        if (owner.presentedAt === 0 && this.now() <= owner.reservedUntil) continue;
        const presentedAt = Math.max(receipt.presentedAt, owner.presentedAt);
        this.endInState(state, owner, this.now(), { presentedAt,
          ...(isGoalEndpoint(owner) ? { finalPresentedAt: Math.max(owner.finalPresentedAt, receipt.finalPresentedAt) } : {}),
          reason: 'content_released' });
        await this.save(state);
        this.observe('owner_end_committed', owner, { reason: 'content_released', presentedAt });
      }
    }
  }

  request(candidate) {
    requireOwner(candidate);
    return this.run('request', async (state) => {
      let authorization = null;
      const now = this.now();
      if (!Number.isSafeInteger(candidate.observedAt) || candidate.observedAt > now || now - candidate.observedAt >= INTERVENTION_CANDIDATE_TTL_MS) return denied('candidate_stale', state);
      await this.reconcile(state);
      if (isAutomaticFurin(candidate)) {
        const current = await this.evaluateGoalOwner(candidate.goalBinding, { tabId: candidate.tabId });
        if (!current.valid) return denied(current.reason, state);
        authorization = current;
      }
      const mandatory = isMandatoryIntervention(candidate);
      if (!mandatory && !await isForegroundTab(candidate.tabId, this.browserPort)) return denied('background_tab', state);
      const existing = [state.owner, ...state.blockers].find((entry) => entry?.requestId === candidate.requestId && entry.tabId === candidate.tabId && entry.documentId === candidate.documentId);
      if (existing) return { accepted: true, lease: { ...existing }, reason: 'existing' };
      if (!mandatory && (state.owner || state.blockers.some(holdsInterventionLane))) return denied('active_intervention', state);
      if (!mandatory && !candidate.manual && this.now() < state.kernel.globalNotBefore) return denied('global_gap', state);
      if (candidate.kind === 'enso_gate' && !candidate.manual) {
        await this.ensureEnsoPolicy(state);
        const cadence = this.cadenceSnapshot(state, this.ensoAnchor?.tabId === candidate.tabId ? null : 'not_foreground');
        if (!cadence.eligible) return { ...denied(cadence.reason, state), cadence };
        const priority = await this.readReadyGoalPriority(candidate);
        if (priority.goalReady) return denied('goal_priority', state);
      }
      if (mandatory && state.owner) {
        const previous = state.owner;
        if (previous.gateKind === null) {
          const result = await this.probe(previous, 'revoke', 'mandatory_preemption');
          const receipt = result.response;
          if (result.error || !receipt || receipt.leaseId !== previous.leaseId || receipt.active !== false || receipt.cleaned !== true || receipt.error
            || !Number.isSafeInteger(receipt.presentedAt) || receipt.presentedAt < 0) throw new Error('INTERVENTION_PREEMPTION_CLEANUP_UNCONFIRMED');
          requireGoalReceipt(previous, receipt);
          this.endInState(state, previous, this.now(), { presentedAt: Math.max(receipt.presentedAt, previous.presentedAt),
            ...(isGoalEndpoint(previous) ? { finalPresentedAt: Math.max(previous.finalPresentedAt, receipt.finalPresentedAt) } : {}),
            reason: 'mandatory_preemption' });
        } else {
          // A navigated Gate is replaced only in its own tab. Other tabs keep
          // their owned review; isolation still enforces its separate boundary.
          if (previous.tabId === candidate.tabId) this.endInState(state, previous, this.now(), { reason: 'mandatory_preemption' });
        }
        await this.save(state);
      }
      const requestedAt = this.now();
      if (isAutomaticFurin(candidate) && (authorization.authorizationRevision !== this.goalAuthorizationRevision || authorization.isCurrent() !== true)) {
        const current = await this.evaluateGoalOwner(candidate.goalBinding, { tabId: candidate.tabId });
        if (!current.valid) return denied(current.reason, state);
        authorization = current;
      }
      if (requestedAt - candidate.observedAt >= INTERVENTION_CANDIDATE_TTL_MS) return denied('candidate_stale', state);
      let leaseId;
      if (mandatory) {
        leaseId = `mandatory:${state.kernel.nextLeaseSerial}`;
        state.kernel = { ...state.kernel, nextLeaseSerial: state.kernel.nextLeaseSerial + 1 };
      } else {
        const gap = state.kernel.globalNotBefore;
        const kernel = candidate.manual ? { ...state.kernel, globalNotBefore: 0 } : state.kernel;
        const result = reduceInterventionAdmission(kernel, { type: 'requested', now: requestedAt, candidates: [{
          kind: candidate.kind, requestId: candidate.requestId, requestedAt,
          validUntil: candidate.observedAt + INTERVENTION_CANDIDATE_TTL_MS,
          evidenceRevision: candidate.observedAt, priority: 0, weight: 1, exclusivity: 'exclusive',
        }] });
        if (!result.winner) return denied(result.decisions[0].reason, state);
        state.kernel = { ...result.state, globalNotBefore: gap };
        leaseId = result.winner.leaseId;
      }
      const owner = { ...candidate, leaseId, reservedUntil: requestedAt + INTERVENTION_RESERVATION_TTL_MS, presentedAt: 0,
        ...(isGoalEndpoint(candidate) ? { endpointAttachedAt: 0, boundaryPresentedAt: 0, finalPresentedAt: 0 } : {}) };
      if (mandatory) state.blockers.push(owner); else state.owner = owner;
      // New ownership invalidates any old conclusion, regardless of rank/kind.
      state.lastEnded = null;
      await this.save(state);
      if (candidate.kind === 'enso_gate' && !candidate.manual) {
        let priority;
        try { priority = await this.readReadyGoalPriority(candidate); }
        catch (error) {
          this.endInState(state, owner, this.now(), { reason: 'goal_priority_unconfirmed' });
          await this.save(state);
          throw error;
        }
        if (priority.goalReady) {
          this.endInState(state, owner, this.now(), { reason: 'goal_priority' });
          await this.save(state);
          return denied('goal_priority', state);
        }
      }
      if (isAutomaticFurin(candidate) && (authorization.authorizationRevision !== this.goalAuthorizationRevision || authorization.isCurrent() !== true)) {
        const current = await this.evaluateGoalOwner(candidate.goalBinding, { tabId: candidate.tabId });
        if (current.valid) return { accepted: true, lease: { ...owner }, reason: 'reserved' };
        // No grant has left this lane, so no content endpoint can own this new
        // reservation. End it here instead of publishing a stale permission.
        this.endInState(state, owner, this.now(), { reason: current.reason });
        await this.save(state);
        return denied(current.reason, state);
      }
      return { accepted: true, lease: { ...owner }, reason: 'reserved' };
    }).then(result => {
      this.observe(result.accepted ? 'admission_granted' : 'admission_denied', result.lease ?? candidate, { reason: result.reason });
      return result;
    }, error => {
      this.observe('admission_failed', candidate, { error: error.message });
      throw error;
    });
  }

  transition(identity, operation) {
    return this.run('transition', async (state) => {
      let authorization = null;
      const owner = [state.owner, ...state.blockers].find((entry) => sameLease(entry, identity));
      if (!owner) {
        this.observe('transition_rejected', identity, { operation, reason: 'stale_lease' });
        return { accepted: false, reason: 'stale_lease' };
      }
      if (operation !== 'ended' && isAutomaticFurin(owner)) {
        const current = await this.evaluateGoalOwner(owner.goalBinding, { tabId: owner.tabId });
        if (!current.valid) return { accepted: false, reason: current.reason };
        authorization = current;
      }
      if (operation === 'authorize_goal') {
        if (!isAutomaticFurin(owner)) return { accepted: false, reason: 'goal_owner_required' };
        return { accepted: true, lease: { ...owner } };
      }
      if (operation === 'endpoint_attached') {
        if ((owner.kind !== 'enso_gate' && !isGoalEndpoint(owner)) || owner.gateKind !== null) return { accepted: false, reason: 'endpoint_owner_invalid' };
        if (!owner.endpointAttachedAt) {
          const at = this.now();
          if (at >= owner.reservedUntil || owner.presentedAt) return { accepted: false, reason: 'reservation_expired' };
          owner.endpointAttachedAt = at;
        }
      } else if (operation === 'boundary_presented') {
        if (!isGoalEndpoint(owner) || owner.endpointAttachedAt <= 0) return { accepted: false, reason: 'goal_endpoint_required' };
        if (!owner.boundaryPresentedAt) {
          const at = this.now();
          if (owner === state.owner) state.kernel = reduceInterventionAdmission(state.kernel, { type: 'presented', leaseId: owner.leaseId, now: at }).state;
          owner.presentedAt = at;
          owner.boundaryPresentedAt = at;
        }
      } else if (operation === 'presented') {
        if (isGoalEndpoint(owner)) {
          if (owner.boundaryPresentedAt <= 0) return { accepted: false, reason: 'goal_boundary_required' };
          if (!owner.finalPresentedAt) owner.finalPresentedAt = this.now();
        } else if (!owner.presentedAt) {
          const at = this.now();
          if (!Object.hasOwn(owner, 'endpointAttachedAt') && at >= owner.reservedUntil) return { accepted: false, reason: 'reservation_expired' };
          if (owner === state.owner) state.kernel = reduceInterventionAdmission(state.kernel, { type: 'presented', leaseId: owner.leaseId, now: at }).state;
          owner.presentedAt = at;
        }
      } else if (operation === 'ended') {
        this.endInState(state, owner, this.now());
      } else throw new Error('INTERVENTION_TRANSITION_INVALID');
      await this.save(state);
      if (operation !== 'ended' && isAutomaticFurin(owner)
        && (authorization.authorizationRevision !== this.goalAuthorizationRevision || authorization.isCurrent() !== true)) {
        const current = await this.evaluateGoalOwner(owner.goalBinding, { tabId: owner.tabId });
        if (!current.valid) return { accepted: false, reason: current.reason };
      }
      this.observe('transition_committed', owner, { operation, presentedAt: owner.presentedAt,
        ...(isGoalEndpoint(owner) ? { boundaryPresentedAt: owner.boundaryPresentedAt, finalPresentedAt: owner.finalPresentedAt } : {}) });
      this.pushEnsoCadence(state);
      return { accepted: true, lease: { ...owner } };
    }).catch(error => {
      this.observe('transition_failed', identity, { operation, error: error.message });
      throw error;
    });
  }

  endGate(sessionId) {
    return this.run('endGate', async (state) => {
      const owner = [state.owner, ...state.blockers].find((entry) => entry?.gateKind !== null && entry?.requestId === sessionId);
      if (!owner) return false;
      this.endInState(state, owner, this.now());
      await this.save(state);
      this.pushEnsoCadence(state);
      return true;
    });
  }

  async presentGate(sessionId, tabId) {
    const result = await this.run('presentGate', async (state) => {
      const owner = [state.owner, ...state.blockers].find((entry) => entry?.requestId === sessionId && entry.tabId === tabId);
      if (!owner || owner.gateKind === null) return { accepted: false, reason: 'stale_gate' };
      if (!owner.presentedAt) {
        if (this.now() > owner.reservedUntil) return { accepted: false, reason: 'reservation_expired' };
        owner.presentedAt = this.now();
        if (owner === state.owner) state.kernel = reduceInterventionAdmission(state.kernel, { type: 'presented', leaseId: owner.leaseId, now: owner.presentedAt }).state;
        await this.save(state);
      }
      if (typeof this.onGatePresented !== 'function') throw new Error('INTERVENTION_GATE_PRESENTATION_OWNER_REQUIRED');
      const presentation = await this.onGatePresented(sessionId, tabId, owner.presentedAt);
      if (!presentation || !Object.isFrozen(presentation) || presentation.sessionId !== sessionId || presentation.tabId !== tabId
        || presentation.presentedAt !== owner.presentedAt || typeof presentation.completion?.then !== 'function') {
        throw new Error('INTERVENTION_GATE_PRESENTATION_RECEIPT_INVALID');
      }
      return { accepted: true, presentation };
    });
    if (!result.accepted) return result;
    // Keep the external ACK behind durable history, without holding the shared
    // admission tail. The Gate owner has already admitted the full continuation
    // into the profile lifetime before returning this immutable receipt.
    await result.presentation.completion;
    return { accepted: true };
  }

  resolve(identity, work, { documentHandoff = false, requiredKind = null } = {}) {
    if (typeof documentHandoff !== 'boolean') throw new Error('INTERVENTION_DOCUMENT_HANDOFF_MODE_INVALID');
    if (requiredKind !== null) requireInterventionKind(requiredKind);
    return this.run('resolve', async (state) => {
      const owner = [state.owner, ...state.blockers, state.lastEnded].find((entry) => sameLease(entry, identity));
      if (requiredKind !== null && owner?.kind !== requiredKind) {
        return { outcome: 'refused', refusalReason: 'intervention_kind_mismatch', refusedBy: owner?.kind, closedTabIds: [], error: null };
      }
      if (!owner || owner.resolutionUsed || owner.presentedAt <= 0 || (isGoalEndpoint(owner) && owner.finalPresentedAt <= 0)
        || (owner === state.lastEnded && (state.owner || state.blockers.length || this.now() - owner.endedAt > 2_000 || owner.reason !== 'ended'))) {
        return { outcome: 'refused', refusalReason: 'stale_intervention', refusedBy: state.owner?.kind, closedTabIds: [], error: null };
      }
      // Address both the main frame and the exact owning document.
      // A trusted sender alone is insufficient: the owning content instance
      // must still acknowledge its exposure and live/recently-ended lease.
      // tabs.sendMessage needs no optional webNavigation permission.
      const result = await this.probe(owner);
      if (result?.error) throw new Error(`INTERVENTION_RESOLUTION_PROBE_FAILED:${result.error}`);
      const receipt = result?.response;
      if (!receipt || receipt.leaseId !== owner.leaseId || typeof receipt.active !== 'boolean'
        || receipt.cleaned !== true || receipt.error || !Number.isSafeInteger(receipt.presentedAt)) {
        throw new Error('INTERVENTION_RESOLUTION_PROBE_INVALID');
      }
      requireGoalReceipt(owner, receipt);
      // Content stamps actual presentation before its asynchronous background
      // receipt. Those timestamps share an epoch, not an equality contract.
      if (receipt.presentedAt <= 0 || receipt.presentedAt > owner.presentedAt
        || (isGoalEndpoint(owner) && (receipt.finalPresentedAt <= 0 || receipt.finalPresentedAt > owner.finalPresentedAt))
        || receipt.active !== (owner !== state.lastEnded)) {
        return { outcome: 'refused', refusalReason: 'stale_intervention_document', refusedBy: owner.kind, closedTabIds: [], error: null };
      }
      if (owner === state.lastEnded && this.now() - owner.endedAt > 2_000) {
        return { outcome: 'refused', refusalReason: 'stale_intervention', refusedBy: owner.kind, closedTabIds: [], error: null };
      }
      owner.resolutionUsed = true;
      await this.save(state);
      const outcome = await work();
      // Only a confirmed browser removal failure is retryable. An ambiguous
      // throw/timeout must not renew a one-use destructive conclusion.
      if (outcome?.outcome === 'failed') {
        owner.resolutionUsed = false;
        await this.save(state);
      }
      if (documentHandoff) {
        // The same-tab navigation can destroy content before its ended IPC
        // arrives. Only an acknowledged operation on this exact tab completes
        // ownership here, inside the existing serialized resolution lane.
        if (outcome?.error || !Number.isInteger(outcome?.tab?.id) || outcome.tab.id !== owner.tabId) {
          throw new Error(outcome?.error || 'INTERVENTION_DOCUMENT_HANDOFF_UNCONFIRMED');
        }
        if (owner !== state.lastEnded) {
          this.endInState(state, owner, this.now(), { reason: 'document_handoff' });
          await this.save(state);
        }
      }
      return outcome;
    });
  }

  resolveGate(sessionId, tabId, work) {
    return this.run('resolveGate', async (state) => {
      const owner = [state.owner, ...state.blockers, state.lastEnded].find((entry) => entry?.requestId === sessionId && entry.tabId === tabId && entry.gateKind !== null);
      if (!owner || owner.resolutionUsed || !owner.presentedAt || (owner === state.lastEnded && (state.owner || state.blockers.length || this.now() - owner.endedAt > 2_000 || owner.reason !== 'ended'))) return {
        outcome: 'refused', refusalReason: 'stale_gate_session', refusedBy: 'gate_interstitial', closedTabIds: [], error: null,
      };
      owner.resolutionUsed = true;
      await this.save(state);
      const outcome = await work();
      // A confirmed browser rejection leaves this exact Gate conclusion
      // available for an explicit retry. An ambiguous throw never renews it.
      if (outcome?.outcome === 'failed') {
        owner.resolutionUsed = false;
        await this.save(state);
      }
      return outcome;
    });
  }

  selectGate(sessionId, sourceTabId, work, { documentHandoff = false } = {}) {
    if (typeof documentHandoff !== 'boolean') throw new Error('INTERVENTION_DOCUMENT_HANDOFF_MODE_INVALID');
    return this.run('selectGate', async (state) => {
      const owner = [state.owner, ...state.blockers].find((entry) => entry?.requestId === sessionId && entry.tabId === sourceTabId && entry.gateKind !== null);
      const session = await this.gateRepository.getSessionByTabId(sourceTabId);
      if (!owner?.presentedAt || session?.sessionId !== sessionId) return {
        outcome: 'refused', refusalReason: 'stale_gate_selection', refusedBy: 'gate_interstitial', closedTabIds: [], error: null,
      };
      const outcome = await work();
      if (documentHandoff) {
        // An explicit browser rejection did not hand off the document. Keep
        // this exact owner for the user's retry; no exposure end is certified.
        if (outcome?.error) return outcome;
        if (!Number.isInteger(outcome?.tab?.id) || outcome.tab.id !== owner.tabId) {
          throw new Error('INTERVENTION_DOCUMENT_HANDOFF_UNCONFIRMED');
        }
        // Continue destroys the Gate document before its browser navigation
        // callback can settle. Commit its exact acknowledged handoff in this
        // same lane, so later cleanup/reconciliation cannot invent an end time.
        this.endInState(state, owner, this.now(), { reason: 'document_handoff' });
        await this.save(state);
        this.pushEnsoCadence(state);
      }
      return outcome;
    });
  }

  snapshot() { return this.run('snapshot', async (state) => { await this.reconcile(state); return state; }); }

  beginExposureRecording() {
    if (!this.exposureRecordingInitialization) {
      const initialization = this.enqueue('beginExposureRecording', async (state) => {
        if (!Object.hasOwn(state, 'exposureWindow')) await this.save(state);
      });
      this.exposureRecordingInitialization = initialization;
      void initialization.catch(() => {
        if (this.exposureRecordingInitialization === initialization) this.exposureRecordingInitialization = null;
      });
    }
    return this.exposureRecordingInitialization;
  }

  async readExposureSnapshot({ now = this.now() } = {}) {
    // Read one committed repository snapshot, without reconciliation or joining
    // the mutation lane. Safe even inside an admitted presentation callback.
    const record = await this.repository.read();
    if (!record || typeof record.found !== 'boolean') throw new Error('INTERVENTION_SESSION_READ_INVALID');
    return projectInterventionExposureSnapshot(record.found ? validateState(record.value) : null, now);
  }

  async readPresentationBusy() {
    const record = await this.repository.read();
    if (!record || typeof record.found !== 'boolean') throw new Error('INTERVENTION_SESSION_READ_INVALID');
    if (record.found === false) return false;
    const state = validateState(record.value);
    return state.owner !== null || state.blockers.length > 0;
  }
}

let service = null;
export function configureInterventionAdmissionService(options) {
  if (service) throw new Error('INTERVENTION_ADMISSION_ALREADY_CONFIGURED');
  service = new InterventionAdmissionService(options);
  return service;
}
export function getInterventionAdmissionService() {
  if (!service) throw new Error('INTERVENTION_ADMISSION_NOT_CONFIGURED');
  return service;
}
