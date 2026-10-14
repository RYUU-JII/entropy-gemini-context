import {
  RITUAL_SURFACE_PRIORITIES,
  RITUAL_SURFACE_TYPES,
} from './ritualSurfaceLadder.js';
import { canPreemptIntervention } from './interventionPolicy.js';
import interventionAdmissionClient from './interventionAdmissionClient.js';

// The ladder itself lives in a DOM-free module so the background tab closure
// arbiter can rank the same surfaces without importing this file's input
// guards. Re-exported here because this is the seam every caller already knows.
export { RITUAL_SURFACE_PRIORITIES, RITUAL_SURFACE_TYPES };

export const RITUAL_SURFACE_INPUT_POLICY_MODES = Object.freeze({
  PASSIVE: 'passive',
  LOCK_TO_SURFACE: 'lock_to_surface',
});

export const RITUAL_SURFACE_STRICT_INPUT_EVENTS = Object.freeze([
  'auxclick',
  'beforeinput',
  'click',
  'contextmenu',
  'dblclick',
  'dragstart',
  'drop',
  'input',
  'keydown',
  'keypress',
  'keyup',
  'mousedown',
  'mouseup',
  'paste',
  'pointerdown',
  'pointerup',
  'touchend',
  'touchmove',
  'touchstart',
  'wheel',
]);

const activeClaims = new Map();
let nextClaimSerial = 1;
let surfaceObserver = null;
let activeInputGuard = null;
let handoffInProgress = false;

function requireSurfaceType(type) {
  if (!Object.prototype.hasOwnProperty.call(RITUAL_SURFACE_PRIORITIES, type)) {
    throw new Error(`RITUAL_SURFACE_TYPE_INVALID:${String(type)}`);
  }
  return type;
}

function requireOwnerId(ownerId) {
  const normalized = typeof ownerId === 'string' ? ownerId.trim() : '';
  if (!normalized) {
    throw new Error('RITUAL_SURFACE_OWNER_ID_REQUIRED');
  }
  return normalized;
}

function normalizeScope(scope) {
  return typeof scope === 'string' && scope.trim() ? scope.trim() : '';
}

function normalizeMetadata(metadata) {
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? { ...metadata }
    : {};
}

function resolveComposedPath(event = null) {
  if (!event || typeof event !== 'object') return [];
  if (typeof event.composedPath === 'function') {
    const path = event.composedPath();
    return Array.isArray(path) ? path : [];
  }
  const path = [];
  let cursor = event.target || null;
  while (cursor) {
    path.push(cursor);
    cursor = cursor.parentNode || cursor.host || null;
  }
  return path;
}

function normalizeEventTypes(eventTypes) {
  if (!Array.isArray(eventTypes)) return RITUAL_SURFACE_STRICT_INPUT_EVENTS;
  const normalized = eventTypes
    .map((eventName) => (typeof eventName === 'string' ? eventName.trim() : ''))
    .filter(Boolean);
  return normalized.length ? Object.freeze([...new Set(normalized)]) : RITUAL_SURFACE_STRICT_INPUT_EVENTS;
}

function normalizeInputPolicy(inputPolicy) {
  if (!inputPolicy || typeof inputPolicy !== 'object') {
    return {
      mode: RITUAL_SURFACE_INPUT_POLICY_MODES.PASSIVE,
      eventTypes: Object.freeze([]),
    };
  }
  const mode = Object.values(RITUAL_SURFACE_INPUT_POLICY_MODES).includes(inputPolicy.mode)
    ? inputPolicy.mode
    : RITUAL_SURFACE_INPUT_POLICY_MODES.PASSIVE;
  const eventTypes = mode === RITUAL_SURFACE_INPUT_POLICY_MODES.PASSIVE
    ? Object.freeze([])
    : normalizeEventTypes(inputPolicy.eventTypes);
  return {
    mode,
    eventTypes,
    rootRef: inputPolicy.rootRef || inputPolicy.root || null,
    resolveAllowedRoots: typeof inputPolicy.resolveAllowedRoots === 'function'
      ? inputPolicy.resolveAllowedRoots
      : null,
    isEnabled: typeof inputPolicy.isEnabled === 'function' ? inputPolicy.isEnabled : null,
    isAllowedEvent: typeof inputPolicy.isAllowedEvent === 'function' ? inputPolicy.isAllowedEvent : null,
    onBlockedInput: typeof inputPolicy.onBlockedInput === 'function' ? inputPolicy.onBlockedInput : null,
    windowRef: inputPolicy.windowRef || null,
  };
}

function summarizeInputPolicy(policy) {
  if (!policy || policy.mode === RITUAL_SURFACE_INPUT_POLICY_MODES.PASSIVE) {
    return {
      mode: RITUAL_SURFACE_INPUT_POLICY_MODES.PASSIVE,
      eventTypes: [],
    };
  }
  return {
    mode: policy.mode,
    eventTypes: [...policy.eventTypes],
  };
}

function summarizeClaim(claim) {
  if (!claim) return null;
  return {
    type: claim.type,
    ownerId: claim.ownerId,
    priority: claim.priority,
    scope: claim.scope,
    serial: claim.serial,
    metadata: { ...claim.metadata },
    inputPolicy: summarizeInputPolicy(claim.inputPolicy),
  };
}

function findDominantClaim() {
  let dominant = null;
  activeClaims.forEach((claim) => {
    if (!dominant) {
      dominant = claim;
      return;
    }
    if (claim.priority > dominant.priority) {
      dominant = claim;
      return;
    }
    if (claim.priority === dominant.priority && claim.serial > dominant.serial) {
      dominant = claim;
    }
  });
  return dominant;
}

/**
 * A single observer of every arbitration outcome.
 *
 * The per-claim onSuppress/onRelease callbacks belong to whoever made the
 * claim, so they can only tell that owner about its own surface. This seam
 * exists for the opposite reader: something that needs the whole picture -
 * which surface took the screen, which one wanted it and was refused, and how
 * each episode ended - without every surface having to report itself.
 */
function notifySurfaceObserver(event) {
  if (typeof surfaceObserver !== 'function') return;
  try {
    surfaceObserver(event);
  } catch (error) {
    // Arbitration decides what the user sees. An observer that throws is a
    // broken reader, and must not be allowed to break the decision, but it is
    // reported rather than swallowed.
    console.error('[RitualSurfaceArbiter] surface observer failed', error);
  }
}

export function setRitualSurfaceObserver(observer = null) {
  if (observer !== null && typeof observer !== 'function') {
    throw new Error('RITUAL_SURFACE_OBSERVER_INVALID');
  }
  surfaceObserver = observer;
}

export const RITUAL_SURFACE_OBSERVER_EVENTS = Object.freeze({
  CLAIMED: 'claimed',
  REFUSED: 'refused',
  SUPPRESSED: 'suppressed',
  RELEASED: 'released',
});

function notifySuppressed(claim, byClaim, reason) {
  notifySurfaceObserver({
    kind: RITUAL_SURFACE_OBSERVER_EVENTS.SUPPRESSED,
    surface: summarizeClaim(claim),
    by: summarizeClaim(byClaim),
    reason,
  });
  if (typeof claim?.onSuppress !== 'function') return;
  claim.onSuppress({
    reason,
    claim: summarizeClaim(claim),
    by: summarizeClaim(byClaim),
  });
}

function notifyReleased(claim, reason) {
  notifySurfaceObserver({
    kind: RITUAL_SURFACE_OBSERVER_EVENTS.RELEASED,
    surface: summarizeClaim(claim),
    by: null,
    reason,
  });
  if (typeof claim?.onRelease !== 'function') return;
  claim.onRelease({
    reason,
    claim: summarizeClaim(claim),
  });
}

function toFiniteCoordinate(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function resolveRitualSurfaceInputPoint(event = null) {
  const x = toFiniteCoordinate(event?.clientX);
  const y = toFiniteCoordinate(event?.clientY);
  return x !== null && y !== null ? { x, y } : null;
}

function resolveRootRefValue(rootRef) {
  return typeof rootRef === 'function' ? rootRef() : rootRef;
}

function appendRootCandidate(roots, root) {
  if (!root) return;
  if (Array.isArray(root)) {
    root.forEach((entry) => appendRootCandidate(roots, entry));
    return;
  }
  roots.push(root);
}

function resolvePolicyAllowedRoots(policy, event, path) {
  const roots = [];
  appendRootCandidate(roots, resolveRootRefValue(policy.rootRef));
  if (policy.resolveAllowedRoots) {
    appendRootCandidate(roots, policy.resolveAllowedRoots({
      event,
      path,
      point: resolveRitualSurfaceInputPoint(event),
    }));
  }
  return roots;
}

function isInsideAllowedRoot(event, roots, path) {
  if (!roots.length) return false;
  return roots.some((root) => {
    if (!root) return false;
    if (path.includes(root)) return true;
    const target = event?.target || null;
    return Boolean(
      target
        && typeof target.nodeType === 'number'
        && typeof root.contains === 'function'
        && root.contains(target),
    );
  });
}

function isInputPolicyEnabled(policy, event, path) {
  if (policy.mode === RITUAL_SURFACE_INPUT_POLICY_MODES.PASSIVE) return false;
  if (!policy.eventTypes.includes(event?.type)) return false;
  if (!policy.isEnabled) return true;
  return policy.isEnabled({
    event,
    path,
    point: resolveRitualSurfaceInputPoint(event),
  }) !== false;
}

export function shouldBlockRitualSurfaceInput(event = null, inputPolicy = null) {
  const policy = normalizeInputPolicy(inputPolicy);
  const path = resolveComposedPath(event);
  if (!isInputPolicyEnabled(policy, event, path)) return false;
  const context = {
    event,
    path,
    point: resolveRitualSurfaceInputPoint(event),
    roots: resolvePolicyAllowedRoots(policy, event, path),
  };
  if (policy.isAllowedEvent?.(context) === true) return false;
  return !isInsideAllowedRoot(event, context.roots, path);
}

export function blockRitualSurfaceInputEvent(event = null) {
  if (!event || typeof event !== 'object') return;
  if (typeof event.preventDefault === 'function' && event.cancelable !== false) {
    event.preventDefault();
  }
  if (typeof event.stopImmediatePropagation === 'function') {
    event.stopImmediatePropagation();
    return;
  }
  event.stopPropagation?.();
}

export function installRitualSurfaceInputGuard(inputPolicy = null) {
  const policy = normalizeInputPolicy(inputPolicy);
  const windowRef = policy.windowRef || (typeof window !== 'undefined' ? window : null);
  if (
    policy.mode === RITUAL_SURFACE_INPUT_POLICY_MODES.PASSIVE
    || !windowRef?.addEventListener
  ) {
    return { release() {} };
  }

  const listenerOptions = { capture: true, passive: false };
  const handleInput = (event) => {
    if (!shouldBlockRitualSurfaceInput(event, policy)) return;
    blockRitualSurfaceInputEvent(event);
    policy.onBlockedInput?.({
      eventType: event?.type || '',
      key: typeof event?.key === 'string' ? event.key : '',
      point: resolveRitualSurfaceInputPoint(event),
    });
  };

  policy.eventTypes.forEach((eventName) => {
    windowRef.addEventListener(eventName, handleInput, listenerOptions);
  });

  return {
    release() {
      policy.eventTypes.forEach((eventName) => {
        windowRef.removeEventListener(eventName, handleInput, { capture: true });
      });
    },
  };
}

function syncDominantInputGuard() {
  activeInputGuard?.release?.();
  activeInputGuard = null;
  const dominant = findDominantClaim();
  if (!dominant) return;
  activeInputGuard = installRitualSurfaceInputGuard(dominant.inputPolicy);
}

export function getRitualSurfacePriority(type) {
  return RITUAL_SURFACE_PRIORITIES[requireSurfaceType(type)];
}

export function getRitualSurfaceSnapshot() {
  return {
    active: Array.from(activeClaims.values()).map(summarizeClaim),
    dominant: summarizeClaim(findDominantClaim()),
  };
}

export function releaseRitualSurfaceClaim(claimOrOwnerId, { reason = 'release' } = {}) {
  const ownerId = typeof claimOrOwnerId === 'string'
    ? claimOrOwnerId
    : claimOrOwnerId?.ownerId;
  const serial = typeof claimOrOwnerId === 'string'
    ? null
    : claimOrOwnerId?.serial;
  const normalizedOwnerId = requireOwnerId(ownerId);
  const activeClaim = activeClaims.get(normalizedOwnerId);
  if (!activeClaim) return false;
  if (serial !== null && serial !== undefined && activeClaim.serial !== serial) return false;
  activeClaims.delete(normalizedOwnerId);
  syncDominantInputGuard();
  notifyReleased(activeClaim, reason);
  return true;
}

export function claimRitualSurface({
  type: rawType,
  ownerId: rawOwnerId,
  scope: rawScope = '',
  metadata: rawMetadata = null,
  inputPolicy: rawInputPolicy = null,
  onSuppress = null,
  onRelease = null,
  replaceClaim = null,
  admissionLease = null,
} = {}) {
  const type = requireSurfaceType(rawType);
  const ownerId = requireOwnerId(rawOwnerId);
  const priority = getRitualSurfacePriority(type);
  if (handoffInProgress) return { accepted: false, reason: 'handoff_in_progress', claim: null, suppressed: [] };
  const previousClaim = activeClaims.get(ownerId) || null;
  if (previousClaim && replaceClaim?.serial !== previousClaim.serial) {
    return { accepted: false, reason: 'owner_already_active', active: summarizeClaim(previousClaim), claim: null, suppressed: [] };
  }
  if (previousClaim) {
    activeClaims.delete(ownerId);
  }

  const dominant = findDominantClaim();
  if (dominant && !canPreemptIntervention(
    { kind: type, gateKind: rawMetadata?.gateKind },
    { kind: dominant.type, gateKind: dominant.metadata?.gateKind },
  )) {
    if (previousClaim) {
      activeClaims.set(ownerId, previousClaim);
    }
    notifySurfaceObserver({
      kind: RITUAL_SURFACE_OBSERVER_EVENTS.REFUSED,
      surface: summarizeClaim({ type, ownerId, priority, scope: normalizeScope(rawScope) }),
      by: summarizeClaim(dominant),
      reason: 'blocked_by_active_surface',
    });
    return {
      accepted: false,
      reason: 'blocked_by_active_surface',
      active: summarizeClaim(dominant),
      claim: null,
      suppressed: [],
    };
  }

  const claim = {
    type,
    ownerId,
    priority,
    scope: normalizeScope(rawScope),
    serial: nextClaimSerial,
    metadata: normalizeMetadata(rawMetadata),
    inputPolicy: normalizeInputPolicy(rawInputPolicy),
    onSuppress,
    onRelease,
    admissionLease,
  };
  nextClaimSerial += 1;
  claim.release = (options = {}) => releaseRitualSurfaceClaim(claim, options);

  const suppressedClaims = [];
  activeClaims.forEach((activeClaim, activeOwnerId) => {
    if (activeOwnerId === ownerId) return;
    suppressedClaims.push(activeClaim);
  });
  // Cleanup is acknowledged before handing input to the new surface. Throwing
  // cleanup retains the old claim; a half-cleaned surface cannot grant ownership.
  handoffInProgress = true;
  try {
    suppressedClaims.forEach((suppressedClaim) => {
      notifySuppressed(suppressedClaim, claim, 'mandatory_preemption');
      suppressedClaim.unbindAdmission?.();
      activeClaims.delete(suppressedClaim.ownerId);
    });
  } finally { handoffInProgress = false; }
  if (admissionLease) {
    const unbind = interventionAdmissionClient.bind(admissionLease, ({ reason }) => {
      if (activeClaims.get(ownerId)?.serial !== claim.serial) return;
      notifySuppressed(claim, null, reason);
      releaseRitualSurfaceClaim(claim, { reason });
    });
    const releaseCallback = claim.onRelease;
    claim.unbindAdmission = unbind;
    claim.onRelease = (details) => { unbind(); releaseCallback?.(details); };
  }
  previousClaim?.unbindAdmission?.();
  activeClaims.set(ownerId, claim);
  syncDominantInputGuard();
  notifySurfaceObserver({
    kind: RITUAL_SURFACE_OBSERVER_EVENTS.CLAIMED,
    surface: summarizeClaim(claim),
    by: null,
    reason: 'accepted',
  });

  return {
    accepted: true,
    reason: 'accepted',
    active: summarizeClaim(findDominantClaim()),
    claim,
    suppressed: suppressedClaims.map(summarizeClaim),
  };
}

export function clearRitualSurfaceArbiterForTest() {
  activeClaims.clear();
  nextClaimSerial = 1;
  surfaceObserver = null;
  activeInputGuard?.release?.();
  activeInputGuard = null;
}
