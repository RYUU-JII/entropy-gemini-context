import {
  FRAME_MEDIA_VERSION, FRAME_MEDIA_LEASE_MS, FRAME_MEDIA_MAX_FRAMES, FRAME_MEDIA_MAX_ORIGINS,
  requireFrameMediaHold, requireFrameMediaReady, requireFrameMediaResult, requireFrameMediaId,
} from '../../../nudge/media/frameMediaProtocol.js';
import { MESSAGE_TYPES } from '../../../../platform/messaging/messageTypes.js';

const HOLD_KINDS = new Set(['site_furin', 'global_sentinel', 'gate_interstitial']);
const COMMAND_TIMEOUT_MS = 3_500;

function emptyEvidence(frame) {
  const permissionDenied = frame.accessAllowed === false;
  return { frameId: frame.frameId, documentId: frame.documentId,
    status: permissionDenied ? 'permission_required' : frame.topReachable ? 'managed_by_top'
      : frame.observation === 'observed' ? 'ready' : 'failed',
    pause: !permissionDenied && frame.observation === 'observed' ? 'supported' : 'unavailable',
    resume: !permissionDenied && frame.observation === 'observed' ? 'supported' : 'unavailable', seek: 'unsupported',
    commandAccepted: false, verifiedPaused: false, errorCode: permissionDenied ? 'FRAME_MEDIA_HOST_PERMISSION_REQUIRED'
      : frame.observation === 'failed' ? 'FRAME_MEDIA_OBSERVATION_FAILED' : null,
    observedCount: frame.observedMediaCount, attemptedCount: 0, pausedCount: 0,
    failedCount: 0, resumedCount: 0, resumeFailedCount: 0 };
}

function originPattern(url) {
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('FRAME_MEDIA_WEB_ORIGIN_REQUIRED');
  // Chrome match patterns do not carry ports.
  return `${parsed.protocol}//${parsed.hostname}/*`;
}

/** Ephemeral transport leases, subordinate to InterventionAdmissionService.
 * No policy/settings/storage authority. Receivers enforce their own lease deadline
 * if this worker exits. A top heartbeat and trusted READY reconstruct transport.
 */
export function createFrameMediaControlBroker({
  readAdmission, readTopSession, hasPermission, sendMessage,
  onDiagnostic, now = Date.now,
} = {}) {
  for (const port of [readAdmission, readTopSession, hasPermission, sendMessage, onDiagnostic]) {
    if (typeof port !== 'function') throw new Error('FRAME_MEDIA_BROKER_PORT_REQUIRED');
  }
  const tabs = new Map();
  const lanes = new Map();
  let permissionRevision = 0;

  function record(errorCode, tabId) { onDiagnostic('frame_media_control', { tabId, errorCode }); }
  function stateFor(tabId) {
    if (!tabs.has(tabId)) tabs.set(tabId, { tabId, frames: new Map(), holds: new Map(), requiredOrigins: [],
      documentId: null, generation: 0, ended: new Map(), releasing: new Map(), retired: new Set(), originHints: [], originLimit: false });
    return tabs.get(tabId);
  }
  function enqueue(tabId, operation) {
    const previous = lanes.get(tabId);
    const task = (previous ? previous.catch(() => undefined) : Promise.resolve()).then(operation);
    lanes.set(tabId, task);
    const clear = () => { if (lanes.get(tabId) === task) lanes.delete(tabId); };
    task.then(clear, clear);
    return task;
  }
  async function deliver(tabId, message, options) {
    let timer;
    try {
      const delivery = await Promise.race([
        sendMessage(tabId, message, options),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('FRAME_MEDIA_COMMAND_TIMEOUT')), COMMAND_TIMEOUT_MS); }),
      ]);
      if (!delivery || delivery.error) throw new Error('FRAME_MEDIA_RECEIVER_UNAVAILABLE');
      return delivery.response;
    } finally { clearTimeout(timer); }
  }
  function isCurrent(state, frame, generation) {
    return state.generation === generation && state.frames.get(frame.frameId) === frame;
  }
  function forgetFrameReceipts(state, frameId) {
    for (const hold of [...state.holds.values(), ...state.releasing.values()]) hold.receipts.delete(frameId);
  }
  function currentReceipt(frame, hold) {
    const receipt = hold.receipts.get(frame.frameId);
    return receipt?.documentId === frame.documentId && receipt.instanceId === frame.instanceId
      && receipt.inventoryRevision === frame.inventoryRevision && receipt.evidenceRevision === frame.evidenceRevision
      && receipt.expiresAt > now() ? receipt : null;
  }
  async function permitted(url) {
    const allowed = await hasPermission({ permissions: ['scripting'], origins: [originPattern(url)] });
    if (typeof allowed !== 'boolean') throw new Error('FRAME_MEDIA_PERMISSION_RESULT_INVALID');
    return allowed;
  }
  async function command(tabId, state, frame, hold, action, resume = false) {
    const generation = state.generation;
    const evidenceRevision = frame.evidenceRevision;
    const revision = permissionRevision;
    const evidence = emptyEvidence(frame);
    const applying = action === 'begin' || action === 'renew';
    if (frame.topReachable) { frame.evidence = evidence; return evidence; }
    try {
      if (applying || (action === 'end' && resume)) {
        const allowed = await permitted(frame.url);
        if (revision !== permissionRevision || !isCurrent(state, frame, generation)) throw new Error('FRAME_MEDIA_AUTHORITY_CHANGED');
        frame.accessAllowed = allowed;
        if (!frame.accessAllowed) {
          forgetFrameReceipts(state, frame.frameId);
          frame.evidence = { ...evidence, status: 'permission_required', pause: 'unavailable', resume: 'unavailable',
            errorCode: 'FRAME_MEDIA_HOST_PERMISSION_REQUIRED' };
          return frame.evidence;
        }
        if (revision !== permissionRevision || !isCurrent(state, frame, generation)) throw new Error('FRAME_MEDIA_AUTHORITY_CHANGED');
      }
      // READY may follow our own discovery or a routine observation report. Only
      // an exact successful lease receipt can suppress another begin. A heartbeat
      // with a later deadline still sends one renew to extend receiver enforcement.
      const receipt = applying ? currentReceipt(frame, hold) : null;
      if (receipt && receipt.expiresAt >= hold.expiresAt) return frame.evidence;
      const commandAction = applying ? (receipt ? 'renew' : 'begin') : action;
      hold.receipts.delete(frame.frameId);
      const payload = { version: FRAME_MEDIA_VERSION, action: commandAction, holdId: hold.holdId,
        instanceId: frame.instanceId, documentId: frame.documentId,
        expiresAt: Math.min(hold.expiresAt, now() + FRAME_MEDIA_LEASE_MS), resume };
      const raw = await deliver(tabId, { type: MESSAGE_TYPES.CONTENT_MEDIA_FRAME_CONTROL, payload }, { documentId: frame.documentId });
      const result = requireFrameMediaResult(raw, payload);
      if (action !== 'revoke' && revision !== permissionRevision) throw new Error('FRAME_MEDIA_AUTHORITY_CHANGED');
      const next = { ...emptyEvidence(frame), status: frame.accessAllowed === false ? 'permission_required' : result.accepted ? result.status : 'failed',
        commandAccepted: result.accepted,
        verifiedPaused: result.accepted && result.pausedCount > 0 && result.failedCount === 0 && result.status === 'held',
        errorCode: frame.accessAllowed === false ? 'FRAME_MEDIA_HOST_PERMISSION_REQUIRED' : result.errorCode,
        observedCount: result.observedCount, attemptedCount: result.attemptedCount,
        pausedCount: result.pausedCount, failedCount: result.failedCount,
        resumedCount: result.resumedCount, resumeFailedCount: result.resumeFailedCount };
      if (isCurrent(state, frame, generation) && frame.evidenceRevision === evidenceRevision) {
        frame.evidence = next;
        if (applying && frame.observation === 'observed' && result.accepted && result.status === 'held' && result.failedCount === 0
          && result.errorCode === null && payload.expiresAt > now()) {
          hold.receipts.set(frame.frameId, { documentId: frame.documentId, instanceId: frame.instanceId,
            inventoryRevision: frame.inventoryRevision, evidenceRevision, expiresAt: payload.expiresAt });
        }
      }
      return next;
    } catch (error) {
      hold.receipts.delete(frame.frameId);
      const failure = { ...emptyEvidence(frame), status: frame.accessAllowed === false ? 'permission_required'
        : error.message === 'FRAME_MEDIA_RECEIVER_UNAVAILABLE' ? 'receiver_unavailable' : 'failed', errorCode: error.message };
      if (isCurrent(state, frame, generation) && frame.evidenceRevision === evidenceRevision) frame.evidence = failure;
      record(error.message, tabId);
      return failure;
    }
  }
  async function discover(tabId) {
    // A discovery broadcast cannot actuate media. Only independently authenticated
    // READY messages register receivers; the broadcast response is never evidence.
    try {
      await deliver(tabId, { type: MESSAGE_TYPES.CONTENT_MEDIA_FRAME_CONTROL_DISCOVER,
        payload: { version: FRAME_MEDIA_VERSION } });
    } catch (error) { record(error.message, tabId); }
  }
  async function authorize(context, state, leaseId = null) {
    const revision = permissionRevision;
    const top = readTopSession(context.tabId);
    if (top && (top.documentId !== context.documentId || ['stale', 'failed'].includes(top.status))) {
      throw new Error('FRAME_MEDIA_TOP_DOCUMENT_STALE');
    }
    if (!await permitted(context.url)) throw new Error('FRAME_MEDIA_TOP_PERMISSION_REQUIRED');
    const admission = await readAdmission();
    if (!admission || !Array.isArray(admission.blockers)) throw new Error('FRAME_MEDIA_ADMISSION_INVALID');
    const owner = [admission.owner, ...admission.blockers].find(candidate => candidate
      && candidate.tabId === context.tabId && candidate.documentId === context.documentId
      && (leaseId === null || candidate.leaseId === leaseId)
      && HOLD_KINDS.has(candidate.kind) && (candidate.presentedAt > 0 || candidate.reservedUntil > now()));
    if (!owner) throw new Error('FRAME_MEDIA_ADMISSION_REQUIRED');
    if (revision !== permissionRevision || tabs.get(context.tabId) !== state
      || (state.documentId && state.documentId !== context.documentId)) {
      throw new Error('FRAME_MEDIA_AUTHORITY_CHANGED');
    }
    return owner;
  }
  async function requiredOrigins(state, origins, revision = permissionRevision) {
    const missing = [];
    const candidates = new Set([...origins, ...[...state.frames.values()].map(frame => new URL(frame.url).origin)]);
    const availability = await Promise.all([...candidates].map(async origin => ({ origin, allowed: await permitted(origin) })));
    if (revision !== permissionRevision || tabs.get(state.tabId) !== state) throw new Error('FRAME_MEDIA_AUTHORITY_CHANGED');
    availability.forEach(({ origin, allowed }) => { if (!allowed) missing.push(origin); });
    state.originHints = origins;
    state.originLimit = missing.length > FRAME_MEDIA_MAX_ORIGINS;
    state.requiredOrigins = missing.slice(0, FRAME_MEDIA_MAX_ORIGINS);
  }
  function snapshot(tabId, holdId = null, released = false) {
    const state = tabs.get(tabId);
    const frames = state ? [...state.frames.values()].map(frame => ({ ...frame.evidence })) : [];
    const activeHolds = state ? [...state.holds.values()].filter(hold => hold.expiresAt > now()).length : 0;
    const missing = state ? [...state.requiredOrigins] : [];
    const failed = frames.some(frame => ['partial', 'receiver_unavailable', 'permission_required', 'failed'].includes(frame.status));
    const pending = frames.length === 0 || frames.some(frame => frame.status === 'ready');
    const status = released ? (failed ? 'partial' : 'released')
      : activeHolds ? (failed || missing.length ? 'partial' : pending ? 'pending' : 'applied')
        : frames.length ? 'released' : 'unavailable';
    return { version: FRAME_MEDIA_VERSION, holdId, status,
      coverage: frames.length ? 'known_frames' : 'unknown', frames, requiredOrigins: missing,
      errorCode: state?.originLimit ? 'FRAME_MEDIA_ORIGIN_LIMIT' : missing.length ? 'FRAME_MEDIA_HOST_PERMISSION_REQUIRED' : null, activeHolds };
  }
  function ready(context, payload) {
    const data = requireFrameMediaReady(payload);
    const state = stateFor(context.tabId);
    if (state.retired.has(`${context.documentId}:${data.instanceId}`)) throw new Error('FRAME_MEDIA_RECEIVER_RETIRED');
    const existing = state.frames.get(context.frameId);
    if (!existing && state.frames.size >= FRAME_MEDIA_MAX_FRAMES) throw new Error('FRAME_MEDIA_FRAME_LIMIT');
    const unchanged = existing?.documentId === context.documentId && existing.instanceId === data.instanceId;
    if (unchanged && data.inventoryRevision < existing.inventoryRevision) throw new Error('FRAME_MEDIA_INVENTORY_REVISION_STALE');
    if (existing && !unchanged) retire(state, existing.documentId, existing.instanceId);
    const inventoryChanged = unchanged && (existing.observation !== data.observation
      || existing.observedMediaCount !== data.observedMediaCount || existing.topReachable !== data.topReachable
      || existing.url !== context.url || existing.inventoryRevision !== data.inventoryRevision);
    const frame = unchanged ? existing : { ...context, ...data, evidenceRevision: 0 };
    Object.assign(frame, { ...data, url: context.url });
    if (!unchanged || inventoryChanged || data.observation === 'failed') {
      frame.evidenceRevision += 1;
      forgetFrameReceipts(state, context.frameId);
      frame.evidence = emptyEvidence(frame);
    }
    state.frames.set(context.frameId, frame);
    return { success: true, documentId: context.documentId };
  }
  function retire(state, documentId, instanceId) {
    state.retired.add(`${documentId}:${instanceId}`);
    if (state.retired.size > 256) {
      state.retired.delete(state.retired.values().next().value);
      record('FRAME_MEDIA_RETIRED_IDENTITY_LIMIT', state.tabId);
    }
  }
  function activateReady(context) {
    return enqueue(context.tabId, async () => {
      const state = tabs.get(context.tabId);
      const frame = state?.frames.get(context.frameId);
      if (!frame || frame.documentId !== context.documentId) return;
      for (const hold of [...state.holds.values()]) {
        if (hold.expiresAt <= now()) { state.holds.delete(hold.holdId); continue; }
        try { await authorize(hold.context, state, hold.admissionLeaseId); }
        catch (error) {
          await releaseHold(context.tabId, state, hold, false, 'revoke');
          record(error.message, context.tabId);
          continue;
        }
        await command(context.tabId, state, frame, hold, 'begin');
      }
    });
  }
  function exited(context, payload) {
    if (payload?.version !== FRAME_MEDIA_VERSION) throw new Error('FRAME_MEDIA_EXIT_INVALID');
    requireFrameMediaId(payload.instanceId);
    const state = tabs.get(context.tabId);
    if (state) retire(state, context.documentId, payload.instanceId);
    const frame = state?.frames.get(context.frameId);
    if (frame && frame.documentId === context.documentId && frame.instanceId === payload.instanceId) {
      forgetFrameReceipts(state, context.frameId);
      state.frames.delete(context.frameId);
    }
    return { success: true };
  }
  async function support(tabId) {
    const revision = permissionRevision;
    const state = tabs.get(tabId);
    if (!state) return snapshot(tabId);
    await requiredOrigins(state, state.originHints, revision);
    await Promise.all([...state.frames.values()].map(async frame => {
      const allowed = await permitted(frame.url);
      if (revision !== permissionRevision) throw new Error('FRAME_MEDIA_AUTHORITY_CHANGED');
      if (tabs.get(tabId) !== state || state.frames.get(frame.frameId) !== frame) return;
      const wasDenied = frame.accessAllowed === false;
      frame.accessAllowed = allowed;
      if (!allowed || wasDenied) forgetFrameReceipts(state, frame.frameId);
      if (!allowed) frame.evidence = emptyEvidence(frame);
      else if (wasDenied) frame.evidence = { ...emptyEvidence(frame), errorCode: 'FRAME_MEDIA_NEW_HOLD_REQUIRED' };
    }));
    return snapshot(tabId);
  }
  async function releaseHold(tabId, state, hold, resume, action = 'end') {
    state.holds.delete(hold.holdId);
    state.releasing.set(hold.holdId, hold);
    try {
      await Promise.all([...state.frames.values()].map(frame => command(tabId, state, frame, hold, action, resume)));
    } finally { state.releasing.delete(hold.holdId); }
  }
  function hold(context, payload) {
    const request = requireFrameMediaHold(payload);
    return enqueue(context.tabId, async () => {
      const state = stateFor(context.tabId);
      for (const lease of [...state.holds.values()]) {
        if (lease.expiresAt <= now()) await releaseHold(context.tabId, state, lease, false, 'revoke');
      }
      const existing = state.holds.get(request.holdId);
      if (request.action === 'end') {
        const ended = state.ended.get(request.holdId);
        if (ended) {
          if (ended.documentId !== context.documentId || ended.resume !== request.resume) throw new Error('FRAME_MEDIA_END_MISMATCH');
          return structuredClone(ended.result);
        }
        if (existing && existing.context.documentId !== context.documentId) throw new Error('FRAME_MEDIA_HOLD_DOCUMENT_MISMATCH');
        let resumeDenied = false;
        if (existing) {
          let resume = request.resume;
          if (resume) {
            const currentTop = readTopSession(context.tabId);
            resume = (!currentTop || (currentTop.documentId === context.documentId && !['stale', 'failed'].includes(currentTop.status)))
              && await permitted(context.url) && tabs.get(context.tabId) === state;
          }
          resumeDenied = resume !== request.resume;
          await releaseHold(context.tabId, state, existing, resume, resumeDenied ? 'revoke' : 'end');
        }
        else record('FRAME_MEDIA_HOLD_NOT_FOUND', context.tabId);
        // A missing transport lease cannot authorize resume after worker loss.
        const result = { ...snapshot(context.tabId, request.holdId, true),
          ...(resumeDenied ? { status: 'partial', errorCode: 'FRAME_MEDIA_RESTORE_AUTHORITY_LOST' } : {}),
          ...(!existing ? { status: 'unavailable', errorCode: 'FRAME_MEDIA_HOLD_NOT_FOUND' } : {}) };
        state.ended.set(request.holdId, { documentId: context.documentId, resume: request.resume, result });
        if (state.ended.size > 16) state.ended.delete(state.ended.keys().next().value);
        return structuredClone(result);
      }
      if (state.ended.has(request.holdId)) throw new Error('FRAME_MEDIA_HOLD_ALREADY_ENDED');
      let authority;
      try { authority = await authorize(context, state, existing ? existing.admissionLeaseId : null); }
      catch (error) {
        if (existing) await releaseHold(context.tabId, state, existing, false, 'revoke');
        throw error;
      }
      if (!existing && state.holds.size >= 4) throw new Error('FRAME_MEDIA_HOLD_LIMIT');
      state.documentId = context.documentId;
      const lease = { holdId: request.holdId, context, admissionLeaseId: authority.leaseId,
        expiresAt: now() + FRAME_MEDIA_LEASE_MS, receipts: existing ? existing.receipts : new Map() };
      state.holds.set(request.holdId, lease);
      await requiredOrigins(state, request.frameOrigins);
      await Promise.all([...state.frames.values()].map(frame => command(context.tabId, state, frame, lease, request.action)));
      // Do not await the rediscovery/READY cycle in the tab's serialized lane.
      // Periodic discovery also recovers a missing READY from an otherwise idle
      // frame. Exact successful receipts suppress its duplicate begin command.
      void discover(context.tabId);
      return snapshot(context.tabId, request.holdId);
    });
  }
  function invalidateTab(tabId, reason) {
    const state = tabs.get(tabId);
    if (!state) return;
    state.generation += 1;
    const oldHolds = [...state.holds.values(), ...state.releasing.values()];
    state.holds.clear();
    tabs.delete(tabId);
    // Exact documents only: never release/resume media in the replacement page.
    void Promise.all(oldHolds.map(lease => releaseHold(tabId, state, lease, false, 'revoke')))
      .catch(error => record(error.message, tabId));
    record(reason, tabId);
  }
  function invalidatePermissions() {
    permissionRevision += 1;
    const revision = permissionRevision;
    for (const [tabId, state] of tabs) {
      // Cancellation bypasses the tab lane so it can fence an in-flight play().
      // Only exact owned leases/documents receive this no-resume cleanup command.
      void (async () => {
        const leases = [...state.holds.values(), ...state.releasing.values()];
        const topDenied = leases.length > 0 && !await permitted(leases[0].context.url);
        if (revision !== permissionRevision) throw new Error('FRAME_MEDIA_AUTHORITY_CHANGED');
        await Promise.all([...state.frames.values()].map(async frame => {
          const allowed = !topDenied && await permitted(frame.url);
          if (revision !== permissionRevision) throw new Error('FRAME_MEDIA_AUTHORITY_CHANGED');
          if (allowed) return;
          frame.accessAllowed = false;
          await Promise.all(leases.map(lease => command(tabId, state, frame, lease, 'revoke', false)));
          frame.evidence = { ...emptyEvidence(frame), status: 'permission_required', pause: 'unavailable', resume: 'unavailable',
            errorCode: 'FRAME_MEDIA_HOST_PERMISSION_REQUIRED' };
        }));
        if (topDenied) state.holds.clear();
        await requiredOrigins(state, state.originHints, revision);
      })().catch(error => record(error.message, tabId));
    }
  }
  return { ready, activateReady, exited, hold, snapshot, support, invalidateTab, invalidatePermissions };
}
