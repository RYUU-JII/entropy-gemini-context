// Non-feed Furin entry consumes a prepared permit on an actual new-content
// action. Feed pages belong to the shared Horizon owner. Idle/cap may retire a
// candidate; neither elapsed time nor generic media controls authorize a ritual.

import { showSentinelPresageSignal } from './nudgePresageSignal.js';
import { classifyFurinEntryAction, classifyFurinEntrySurface, FURIN_ENTRY_SURFACE_MODES } from './furinEntryBoundary.js';

const DEFAULT_SITE_IDLE_MS = 1800;
const DEFAULT_SITE_CAP_MS = 12000;
const DEFAULT_GLOBAL_IDLE_MS = 1200;
const DEFAULT_GLOBAL_CAP_MS = 4200;

export const SENTINEL_ENTRY_SEAM_PROTOCOLS = Object.freeze({
  SITE: 'site',
  GLOBAL: 'global',
});

export const SENTINEL_ENTRY_SEAM_COMMITS = Object.freeze({
  IDLE: 'idle',
  BOUNDARY: 'boundary',
  MEDIA: 'media_transition',
  CAP: 'cap',
  CANCEL: 'cancel',
});

const SEAM_ACTIVITY_EVENTS = Object.freeze([
  'wheel',
  'scroll',
  'pointerdown',
  'keydown',
  'touchmove',
]);

const BOUNDARY_EVENTS = Object.freeze([
  'click',
]);

function normalizeProtocolScope(value) {
  return value === SENTINEL_ENTRY_SEAM_PROTOCOLS.GLOBAL
    ? SENTINEL_ENTRY_SEAM_PROTOCOLS.GLOBAL
    : SENTINEL_ENTRY_SEAM_PROTOCOLS.SITE;
}

export function beginSentinelEntrySeam({
  windowRef = typeof window !== 'undefined' ? window : null,
  documentRef = typeof document !== 'undefined' ? document : null,
  protocolScope: rawProtocolScope = SENTINEL_ENTRY_SEAM_PROTOCOLS.SITE,
  idleMs,
  capMs,
  presage = true,
  presageConfig = null,
  presageCount = 1,
  protocolIntensity = 0.62,
  commitOnBoundary = false,
  getBoundaryEvidence = null,
} = {}) {
  if (getBoundaryEvidence !== null && typeof getBoundaryEvidence !== 'function') {
    throw new Error('FURIN_ENTRY_BOUNDARY_EVIDENCE_READER_INVALID');
  }
  const startedAtMs = Date.now();
  const protocolScope = normalizeProtocolScope(rawProtocolScope);
  const resolvedIdleMs = Number.isFinite(Number(idleMs))
    ? Number(idleMs)
    : (protocolScope === SENTINEL_ENTRY_SEAM_PROTOCOLS.GLOBAL ? DEFAULT_GLOBAL_IDLE_MS : DEFAULT_SITE_IDLE_MS);
  const resolvedCapMs = Number.isFinite(Number(capMs))
    ? Number(capMs)
    : (protocolScope === SENTINEL_ENTRY_SEAM_PROTOCOLS.GLOBAL ? DEFAULT_GLOBAL_CAP_MS : DEFAULT_SITE_CAP_MS);
  let settledResolve = null;
  let settledReject = null;
  let settledCommit = '';
  let idleTimer = null;
  let capTimer = null;
  let presageHandle = null;
  let surface = null;

  const settled = new Promise((resolve, reject) => {
    settledResolve = resolve;
    settledReject = reject;
  });

  function clearTimers() {
    if (idleTimer !== null) {
      windowRef?.clearTimeout(idleTimer);
      idleTimer = null;
    }
    if (capTimer !== null) {
      windowRef?.clearTimeout(capTimer);
      capTimer = null;
    }
  }

  function unbindActivityListeners() {
    if (!windowRef?.removeEventListener) return;
    SEAM_ACTIVITY_EVENTS.forEach((eventName) => {
      windowRef.removeEventListener(eventName, handleActivity, { capture: true });
    });
  }

  function unbindBoundaryListeners() {
    if (windowRef?.removeEventListener) {
      BOUNDARY_EVENTS.forEach((eventName) => {
        windowRef.removeEventListener(eventName, handleBoundary, { capture: true });
      });
    }
  }

  function unbindDocumentLifetimeListeners() {
    documentRef?.removeEventListener?.('visibilitychange', handleVisibilityChange);
    windowRef?.removeEventListener?.('pagehide', handlePageHide);
  }

  function removePresage({ fade = false } = {}) {
    const handle = presageHandle;
    presageHandle = null;
    if (!handle) return;
    handle.dismiss?.({ immediate: !fade });
  }

  function settle(committedBy, details = {}, error = null) {
    if (settledCommit) return;
    settledCommit = committedBy;
    clearTimers();
    unbindActivityListeners();
    unbindBoundaryListeners();
    unbindDocumentLifetimeListeners();
    if (committedBy === SENTINEL_ENTRY_SEAM_COMMITS.CANCEL) {
      removePresage({ fade: false });
    }
    if (error !== null) {
      settledReject(error);
      return;
    }
    settledResolve({
      committedBy,
      commitReason: details.commitReason || committedBy,
      eventType: details.eventType || '',
      protocolScope,
      waitedMs: Math.max(0, Date.now() - startedAtMs),
      boundaryProof: details.boundaryProof || null,
    });
  }

  function armIdleTimer() {
    if (!windowRef) return;
    if (idleTimer !== null) {
      windowRef.clearTimeout(idleTimer);
    }
    idleTimer = windowRef.setTimeout(
      () => settle(SENTINEL_ENTRY_SEAM_COMMITS.CANCEL, { commitReason: 'entry_idle_expired' }),
      Math.max(0, Number(resolvedIdleMs) || 0),
    );
  }

  function handleActivity() {
    if (settledCommit) return;
    armIdleTimer();
  }

  function handleBoundary(event) {
    if (settledCommit || !commitOnBoundary) return;
    let proof;
    try { proof = classifyFurinEntryAction(event, readBoundaryEvidence()); }
    catch (error) {
      settle(SENTINEL_ENTRY_SEAM_COMMITS.CANCEL, {}, error);
      return;
    }
    if (!proof.allowed) return;
    // The exact prepared permit already belongs to this native action. An
    // unprepared/refused action remains entirely native, with no later replay.
    event.preventDefault();
    event.stopImmediatePropagation();
    settle(SENTINEL_ENTRY_SEAM_COMMITS.BOUNDARY, {
      commitReason: proof.reason,
      eventType: event.type,
      boundaryProof: proof,
    });
  }

  function readBoundaryEvidence() {
    const evidence = getBoundaryEvidence === null
      ? { surface: classifyFurinEntrySurface(documentRef) } : getBoundaryEvidence();
    if (!evidence || typeof evidence.then === 'function' || !evidence.surface) {
      throw new Error('FURIN_ENTRY_BOUNDARY_EVIDENCE_REQUIRED');
    }
    surface = evidence.surface;
    return evidence;
  }

  function handleVisibilityChange() {
    if (documentRef?.visibilityState !== 'hidden') return;
    settle(SENTINEL_ENTRY_SEAM_COMMITS.CANCEL, {
      commitReason: 'document_hidden',
      eventType: 'visibilitychange',
    });
  }

  function handlePageHide() {
    settle(SENTINEL_ENTRY_SEAM_COMMITS.CANCEL, {
      commitReason: 'document_exit',
      eventType: 'pagehide',
    });
  }

  if (documentRef?.visibilityState === 'hidden') {
    settle(SENTINEL_ENTRY_SEAM_COMMITS.CANCEL, { commitReason: 'document_hidden' });
  } else if (!windowRef) {
    settle(SENTINEL_ENTRY_SEAM_COMMITS.CANCEL, { commitReason: 'window_unavailable' });
  } else if (readBoundaryEvidence().surface.mode !== FURIN_ENTRY_SURFACE_MODES.ACTION_BOUNDARY) {
    settle(SENTINEL_ENTRY_SEAM_COMMITS.CANCEL, { commitReason: surface.reason });
  } else {
    documentRef?.addEventListener?.('visibilitychange', handleVisibilityChange);
    windowRef.addEventListener('pagehide', handlePageHide);
    if (presage) {
      void showSentinelPresageSignal({
        windowRef,
        documentRef,
        protocolScope,
        protocolIntensity,
        count: presageCount,
        presageConfig,
        isCurrent: () => !settledCommit,
      }).then((handle) => {
        if (settledCommit) handle?.dismiss({ immediate: true });
        else presageHandle = handle;
      }).catch((error) => console.error('[SentinelEntrySeam] presage failed', error));
    }
    SEAM_ACTIVITY_EVENTS.forEach((eventName) => {
      windowRef.addEventListener(eventName, handleActivity, { capture: true, passive: true });
    });
    if (commitOnBoundary) {
      BOUNDARY_EVENTS.forEach((eventName) => {
        windowRef.addEventListener(eventName, handleBoundary, { capture: true, passive: false });
      });
    }
    armIdleTimer();
    capTimer = windowRef.setTimeout(
      () => settle(SENTINEL_ENTRY_SEAM_COMMITS.CANCEL, { commitReason: 'entry_cap_expired' }),
      Math.max(Number(resolvedIdleMs) || 0, Number(resolvedCapMs) || 0),
    );
  }

  return {
    settled,
    getSurface() { return surface; },
    // the overlay's own scrim takes over from the presage
    release() {
      removePresage({ fade: true });
    },
    cancel() {
      settle(SENTINEL_ENTRY_SEAM_COMMITS.CANCEL);
    },
  };
}
