import {
  FEED_HORIZON_INSPECTION_COMMANDS,
  FEED_HORIZON_INSPECTION_HANDOFF_MODES,
  createInactiveFeedHorizonInspectionSnapshot,
  normalizeFeedHorizonInspectionControl,
} from './feedHorizonInspectionContract.dev.js';
import {
  recordProtectionFeatureEvent,
} from '../../../protection/content/runtime/protectionRuntimeDiagnostics.js';

const HOST_ID = 'entropy-feed-horizon-inspection';
const REQUIRED_OWNER_METHODS = Object.freeze([
  'abortInspectionEpisode',
  'beginInspectionEpisode',
  'getEndpointDecision',
  'getEpisodeSnapshot',
  'hasEpisodeOwnership',
  'isRuntimeActive',
  'restoreProductionSpawnTiming',
]);
const TERMINAL_FAILURE_REASON = /(?:failed|invalidat|ownership)/i;

const STYLE = `
  :host {
    all: initial;
    position: fixed;
    top: 20px;
    left: 50%;
    z-index: 2147483647;
    transform: translateX(-50%);
    pointer-events: none;
  }
  .panel {
    box-sizing: border-box;
    width: min(440px, calc(100vw - 32px));
    padding: 14px 16px 15px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 16px;
    background: rgba(14, 14, 16, 0.92);
    box-shadow: 0 16px 52px rgba(0, 0, 0, 0.5);
    color: rgba(255, 255, 255, 0.94);
    font: 600 13px/1.35 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    letter-spacing: -0.01em;
    backdrop-filter: blur(18px);
  }
  .eyebrow {
    margin-bottom: 4px;
    color: #25f4ee;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.13em;
    text-transform: uppercase;
  }
  .title {
    margin-bottom: 11px;
    color: #fff;
    font-size: 15px;
    font-weight: 750;
  }
  .steps {
    display: grid;
    gap: 7px;
  }
  .step {
    display: grid;
    grid-template-columns: 18px 1fr auto;
    gap: 8px;
    align-items: center;
    color: rgba(255, 255, 255, 0.45);
  }
  .step[data-state="active"] { color: rgba(255, 255, 255, 0.98); }
  .step[data-state="complete"] { color: rgba(255, 255, 255, 0.72); }
  .dot {
    display: grid;
    width: 16px;
    height: 16px;
    place-items: center;
    border: 1px solid rgba(255, 255, 255, 0.24);
    border-radius: 999px;
    font-size: 10px;
  }
  .step[data-state="active"] .dot {
    border-color: #fe2c55;
    background: #fe2c55;
    box-shadow: 0 0 0 4px rgba(254, 44, 85, 0.15);
  }
  .step[data-state="complete"] .dot {
    border-color: #25f4ee;
    color: #25f4ee;
  }
  .value {
    color: rgba(255, 255, 255, 0.58);
    font-variant-numeric: tabular-nums;
    font-size: 12px;
  }
  .note {
    margin-top: 11px;
    padding-top: 9px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.58);
    font-size: 11px;
    font-weight: 550;
  }
  :host([data-phase="failed"]) .panel {
    border-color: rgba(254, 44, 85, 0.68);
    box-shadow: 0 16px 52px rgba(0, 0, 0, 0.56), 0 0 0 1px rgba(254, 44, 85, 0.16);
  }
  :host([data-phase="failed"]) .eyebrow {
    color: #ff6b87;
  }
`;

function requireOwner(owner) {
  if (
    !owner
    || typeof owner !== 'object'
    || REQUIRED_OWNER_METHODS.some((methodName) => typeof owner[methodName] !== 'function')
  ) {
    throw new Error('FEED_HORIZON_INSPECTION_OWNER_INVALID');
  }
  return owner;
}

function roundTimestamp(value, fallback = Date.now()) {
  return Math.max(0, Math.round(Number(value) || fallback));
}

function derivePhase(snapshot) {
  if (snapshot.feedbackPresentedAt > 0) return 'enso_would_open';
  if (!snapshot.endpointReady) return 'endpoint_preparing';
  if (!snapshot.boundaryReached) return 'endpoint_ready';
  if (snapshot.holdRemainingMs > 0) return 'still_hold';
  if (snapshot.controlsLive) return 'renewed_demand_ready';
  return 'boundary_reached';
}

function stepState({ complete, active }) {
  if (complete) return 'complete';
  if (active) return 'active';
  return 'pending';
}

function isTerminalFailureReason(reason) {
  return TERMINAL_FAILURE_REASON.test(String(reason || ''));
}

export class FeedHorizonInspectionSession {
  constructor({
    documentRef = typeof document !== 'undefined' ? document : null,
  } = {}) {
    this._document = documentRef;
    this._owner = null;
    this._state = Object.freeze(createInactiveFeedHorizonInspectionSnapshot());
    this._lastEpisodeSnapshot = null;
    this._pendingEndpointDecision = null;
    this._host = null;
    this._root = null;
    this._signature = '';
    this._cycle = 0;
  }

  connectOwner(owner) {
    const normalizedOwner = requireOwner(owner);
    if (this._owner && this._owner !== normalizedOwner && this.isActive()) {
      throw new Error('FEED_HORIZON_INSPECTION_OWNER_REPLACEMENT_ACTIVE');
    }
    this._owner = normalizedOwner;
    return this;
  }

  isActive() {
    return this._state.active === true;
  }

  resolvePendingEndpointDecision(canonicalDecision, {
    endpointCommitted = false,
  } = {}) {
    if (!this.isActive() || endpointCommitted) return canonicalDecision;
    if (!this._pendingEndpointDecision) {
      throw new Error('FEED_HORIZON_INSPECTION_PENDING_ENDPOINT_DECISION_MISSING');
    }
    return this._pendingEndpointDecision;
  }

  resolveSurfaceEntryGrace({
    canonicalDecision,
    surfaceSnapshot,
    now = Date.now(),
  } = {}) {
    if (!this.isActive()) {
      if (typeof canonicalDecision !== 'function') {
        throw new Error('FEED_HORIZON_INSPECTION_CANONICAL_GRACE_REQUIRED');
      }
      return canonicalDecision();
    }
    if (!surfaceSnapshot?.semanticSurfaceId) {
      throw new Error('ENSO_FEED_SURFACE_GRACE_NOT_OBSERVED');
    }
    return Object.freeze({
      semanticSurfaceId: surfaceSnapshot.semanticSurfaceId,
      enteredAt: roundTimestamp(surfaceSnapshot.enteredAt, now),
      graceMs: Math.max(0, Math.round(Number(surfaceSnapshot.graceMs) || 0)),
      remainingMs: 0,
      allowed: true,
      reason: 'available',
    });
  }

  getStillGateMs() {
    return this.isActive() ? this._state.stillGateMs : null;
  }

  control(rawControl) {
    const control = normalizeFeedHorizonInspectionControl(rawControl);
    const owner = requireOwner(this._owner);
    if (control.command === FEED_HORIZON_INSPECTION_COMMANDS.DISARM) {
      return this._disarm(owner);
    }
    if (control.command === FEED_HORIZON_INSPECTION_COMMANDS.ARM && this.isActive()) {
      throw new Error('FEED_HORIZON_INSPECTION_ALREADY_ACTIVE');
    }
    const rearming = control.command === FEED_HORIZON_INSPECTION_COMMANDS.REARM;
    if (rearming && !this.isActive() && this._cycle === 0) {
      throw new Error('FEED_HORIZON_INSPECTION_REARM_INACTIVE');
    }
    if (!owner.isRuntimeActive()) {
      throw new Error('ENSO_FEED_HORIZON_INSPECTION_MANAGER_INACTIVE');
    }
    if (!rearming && owner.hasEpisodeOwnership()) {
      throw new Error('ENSO_FEED_HORIZON_INSPECTION_EPISODE_ACTIVE');
    }
    const decision = owner.getEndpointDecision();
    if (
      decision?.readiness?.status !== 'ready'
      || decision?.actuationSafety?.status !== 'safe'
      || decision?.actuationSafety?.capability === 'observe_only'
    ) {
      throw new Error('ENSO_FEED_HORIZON_INSPECTION_ENDPOINT_NOT_READY');
    }
    if (rearming && this.isActive()) {
      if (owner.abortInspectionEpisode('runtime_debugger_inspection_rearm') !== true) {
        throw new Error('FEED_HORIZON_INSPECTION_REARM_ABORT_NOT_CONFIRMED');
      }
    }
    if (owner.hasEpisodeOwnership()) {
      throw new Error('ENSO_FEED_HORIZON_INSPECTION_EPISODE_ACTIVE');
    }

    const now = Date.now();
    this._cycle += 1;
    this._state = Object.freeze({
      ...createInactiveFeedHorizonInspectionSnapshot(),
      active: true,
      cycleId: this._cycle,
      source: 'runtime_debugger_full_chain',
      startedAt: now,
      command: control.command,
      stillGateMs: control.stillGateMs,
      handoffMode: control.handoffMode,
      phase: 'endpoint_preparing',
      finishedReason: null,
    });
    this._pendingEndpointDecision = Object.freeze({
      ...decision,
      state: 'interrupt',
      candidateState: 'interrupt',
      armed: true,
      opportunityReady: true,
      inhibitors: Object.freeze([]),
      seam: Object.freeze({
        fire: true,
        decision: 'inspection_forced',
        waitedMs: 0,
        observedGapMs: 0,
        requiredGapMs: 0,
        hardLimitMs: 0,
      }),
      reasons: Object.freeze([
        ...(Array.isArray(decision.reasons) ? decision.reasons : []),
        'runtime_debugger_inspection_forced',
      ]),
    });
    try {
      this._render();
      const episodeSnapshot = owner.beginInspectionEpisode({ now });
      if (!episodeSnapshot || typeof episodeSnapshot !== 'object') {
        throw new Error('ENSO_FEED_HORIZON_INSPECTION_ADMISSION_NOT_CONFIRMED');
      }
      this.observeEpisodeSnapshot(episodeSnapshot, { now });
      recordProtectionFeatureEvent(
        'infiniteScrollGuard',
        'enso_feed_horizon_inspection_started',
        {
          cycleId: this._state.cycleId,
          command: control.command,
          decisionId: decision.decisionId || '',
          capability: decision.actuationSafety.capability,
          handoffMode: control.handoffMode,
        },
      );
      return episodeSnapshot;
    } catch (error) {
      if (owner.hasEpisodeOwnership()) {
        owner.abortInspectionEpisode('runtime_debugger_inspection_start_failed');
      }
      this.finish('start_failed');
      throw error;
    }
  }

  _disarm(owner) {
    if (!this.isActive()) {
      this._clearTerminalFailure();
      this._removeSurface();
      return owner.getEpisodeSnapshot({ now: Date.now() });
    }
    if (owner.abortInspectionEpisode('runtime_debugger_inspection_disarm') !== true) {
      throw new Error('ENSO_FEED_HORIZON_INSPECTION_ABORT_NOT_CONFIRMED');
    }
    this.finish('runtime_debugger_disarmed');
    return owner.getEpisodeSnapshot({ now: Date.now() });
  }

  handleContinueIntent({ requestedAt = Date.now() } = {}) {
    if (
      !this.isActive()
      || this._state.handoffMode !== FEED_HORIZON_INSPECTION_HANDOFF_MODES.FEEDBACK_ONLY
    ) {
      return Object.freeze({ handled: false, accepted: false });
    }
    const presentedAt = roundTimestamp(requestedAt);
    this._state = Object.freeze({
      ...this._state,
      phase: 'enso_would_open',
      controlsLive: true,
      holdRemainingMs: 0,
      feedbackPresentedAt: presentedAt,
    });
    this._render();
    recordProtectionFeatureEvent(
      'infiniteScrollGuard',
      'enso_feed_gate_feedback_presented',
      {
        cycleId: this._state.cycleId,
        presentedAt,
        stillGateMs: this._state.stillGateMs,
        requestEnsoGateCalled: false,
      },
    );
    return Object.freeze({ handled: true, accepted: true });
  }

  observeEpisodeSnapshot(episodeSnapshot, { now = Date.now() } = {}) {
    if (!this.isActive() || !episodeSnapshot || typeof episodeSnapshot !== 'object') {
      return this.getSnapshot();
    }
    const endpoint = episodeSnapshot.endpoint || {};
    const endpointReady = endpoint.leaseState === 'committed' && endpoint.active === true;
    const boundaryReached = endpoint.boundaryReached === true;
    const boundaryReachedAt = boundaryReached
      ? roundTimestamp(endpoint.boundaryReachedAt, now)
      : 0;
    const holdRemainingMs = boundaryReached
      ? Math.max(0, Math.round(Number(endpoint.holdRemainingMs) || 0))
      : Math.max(0, Number(this._state.stillGateMs) || 0);
    const next = {
      ...this._state,
      endpointReady,
      boundaryReached,
      boundaryReachedAt,
      holdRemainingMs,
      controlsLive: endpoint.controlsLive === true,
    };
    next.phase = derivePhase(next);
    this._state = Object.freeze(next);
    this._lastEpisodeSnapshot = episodeSnapshot;
    this._render();
    return this.getSnapshot();
  }

  finish(reason = 'resolved') {
    if (!this.isActive()) {
      if (this._state.phase === 'failed' && isTerminalFailureReason(reason)) return true;
      this._clearTerminalFailure();
      this._removeSurface();
      return true;
    }
    const previous = this._state;
    const retainFailure = isTerminalFailureReason(reason);
    this._state = Object.freeze(retainFailure
      ? {
        ...previous,
        active: false,
        phase: 'failed',
        controlsLive: false,
        finishedReason: reason,
      }
      : {
        ...createInactiveFeedHorizonInspectionSnapshot(),
        cycleId: previous.cycleId,
        finishedReason: reason,
      });
    this._lastEpisodeSnapshot = null;
    this._pendingEndpointDecision = null;
    if (retainFailure) this._render();
    else this._removeSurface();
    this._owner?.restoreProductionSpawnTiming?.();
    recordProtectionFeatureEvent(
      'infiniteScrollGuard',
      'enso_feed_horizon_inspection_finished',
      {
        cycleId: previous.cycleId,
        reason,
        startedAt: previous.startedAt,
      },
    );
    return true;
  }

  prepareAutomationSession() {
    if (this.isActive()) {
      throw new Error('FEED_HORIZON_INSPECTION_AUTOMATION_START_ACTIVE');
    }
    this._clearTerminalFailure();
    this._removeSurface();
    return true;
  }

  clearSurface() {
    this._clearTerminalFailure();
    this._removeSurface();
    return true;
  }

  getSnapshot() {
    return { ...this._state };
  }

  _render() {
    const terminalFailure = this._state.phase === 'failed';
    if (!this.isActive() && !terminalFailure) {
      this._removeSurface();
      return;
    }
    if (!this._document?.documentElement) {
      throw new Error('FEED_HORIZON_INSPECTION_DOCUMENT_UNAVAILABLE');
    }
    if (!this._host) this._mountSurface();
    const state = this._state;
    const holdSeconds = Math.max(0, state.holdRemainingMs / 1000).toFixed(1);
    const gateSeconds = state.stillGateMs === null
      ? 'canonical'
      : `${Math.round(state.stillGateMs / 1000)}초`;
    const signature = JSON.stringify([
      state.phase,
      state.endpointReady,
      state.boundaryReached,
      holdSeconds,
      state.controlsLive,
      state.feedbackPresentedAt,
      state.finishedReason,
    ]);
    if (signature === this._signature) return;
    this._signature = signature;
    this._host.dataset.phase = state.phase;

    const endpointState = stepState({
      complete: state.endpointReady,
      active: !state.endpointReady,
    });
    const boundaryState = stepState({
      complete: state.boundaryReached,
      active: state.endpointReady && !state.boundaryReached,
    });
    const holdComplete = state.controlsLive || state.feedbackPresentedAt > 0;
    const holdState = stepState({
      complete: holdComplete,
      active: state.boundaryReached && !holdComplete,
    });
    const wouldOpenState = stepState({
      complete: state.feedbackPresentedAt > 0,
      active: state.controlsLive && state.feedbackPresentedAt === 0,
    });
    const rows = [
      ['endpoint', 'Endpoint 준비', endpointState, state.endpointReady ? 'committed' : 'resolving'],
      ['boundary', 'Boundary 도달', boundaryState, state.boundaryReached ? 'reached' : 'waiting'],
      ['hold', `${gateSeconds} hold`, holdState, state.boundaryReached && !holdComplete ? `${holdSeconds}s` : (holdComplete ? 'done' : 'waiting')],
      ['would-open', 'Enso would open', wouldOpenState, state.feedbackPresentedAt > 0 ? 'confirmed' : 'waiting'],
    ];
    if (terminalFailure) {
      rows.push(['failure', 'Inspection 종료', 'active', 'failed']);
    }
    const steps = this._root.querySelector('.steps');
    steps.replaceChildren(...rows.map(([id, label, rowState, value]) => {
      const row = this._document.createElement('div');
      row.className = 'step';
      row.dataset.step = id;
      row.dataset.state = rowState;
      const dot = this._document.createElement('span');
      dot.className = 'dot';
      dot.textContent = rowState === 'complete' ? '✓' : '';
      const text = this._document.createElement('span');
      text.textContent = label;
      const result = this._document.createElement('span');
      result.className = 'value';
      result.textContent = value;
      row.append(dot, text, result);
      return row;
    }));
    const title = this._root.querySelector('.title');
    title.textContent = terminalFailure
      ? 'Feed Horizon inspection ended'
      : 'Feed Horizon';
    const note = this._root.querySelector('.note');
    note.textContent = terminalFailure
      ? `Endpoint ownership lost — inspection ended. ${state.finishedReason}`
      : (
        state.handoffMode === FEED_HORIZON_INSPECTION_HANDOFF_MODES.FEEDBACK_ONLY
          ? 'feedback-only · production requestEnsoGate는 호출하지 않습니다.'
          : 'production handoff · renewed demand 뒤 canonical Enso Gate를 호출합니다.'
      );
  }

  _mountSurface() {
    const stale = this._document.getElementById?.(HOST_ID);
    stale?.remove?.();
    const host = this._document.createElement('div');
    host.id = HOST_ID;
    host.dataset.phase = this._state.phase;
    const root = host.attachShadow?.({ mode: 'open' });
    if (!root) {
      throw new Error('FEED_HORIZON_INSPECTION_SHADOW_ROOT_REQUIRED');
    }
    const style = this._document.createElement('style');
    style.textContent = STYLE;
    const panel = this._document.createElement('section');
    panel.className = 'panel';
    panel.setAttribute('role', 'status');
    panel.setAttribute('aria-live', 'polite');
    const eyebrow = this._document.createElement('div');
    eyebrow.className = 'eyebrow';
    eyebrow.textContent = 'Dev inspection';
    const title = this._document.createElement('div');
    title.className = 'title';
    title.textContent = 'Feed Horizon';
    const steps = this._document.createElement('div');
    steps.className = 'steps';
    const note = this._document.createElement('div');
    note.className = 'note';
    panel.append(eyebrow, title, steps, note);
    root.append(style, panel);
    this._document.documentElement.appendChild(host);
    this._host = host;
    this._root = root;
    this._signature = '';
  }

  _removeSurface() {
    const host = this._host || this._document?.getElementById?.(HOST_ID) || null;
    host?.remove?.();
    this._host = null;
    this._root = null;
    this._signature = '';
  }

  _clearTerminalFailure() {
    if (this._state.phase !== 'failed') return;
    const previous = this._state;
    this._state = Object.freeze({
      ...createInactiveFeedHorizonInspectionSnapshot(),
      cycleId: previous.cycleId,
      finishedReason: previous.finishedReason,
    });
  }
}

export default FeedHorizonInspectionSession;
