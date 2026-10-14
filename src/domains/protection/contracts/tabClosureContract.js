import {
  RITUAL_SURFACE_PRIORITIES,
  RITUAL_SURFACE_TYPES,
} from '../../nudge/runtime/ritualSurfaceLadder.js';
import { INTERVENTION_SURFACE_IDS } from './interventionLedgerContract.js';

/** Closure reasons are explicit. Resolution requires the current admission
 * lease/session; numeric surface order is diagnostic metadata, never authority. */

export const TAB_CLOSURE_TIERS = Object.freeze({
  /**
   * An intervention is concluding under its exact current admission identity.
   */
  RESOLUTION: 'resolution',
  /**
   * The user pointed at a specific tab in an intervention's own UI. Not a
   * competing conclusion: the targets are named, but the source Gate session
   * must still own admission when removal executes.
   */
  SELECTION: 'selection',
  /**
   * Integrity removal of a tab that cannot prove what it claims to be. Above
   * the ladder because it is not an interruption at all.
   */
  EVICTION: 'eviction',
});

export const TAB_CLOSURE_REQUESTERS = Object.freeze({
  ENSO_GATE_LEAVE: 'enso_gate_leave',
  SITE_FURIN_LEAVE: 'site_furin_leave',
  GATE_INTERSTITIAL_LEAVE: 'gate_interstitial_leave',
  GATE_INTERSTITIAL_ESCAPE: 'gate_interstitial_escape',
  GATE_INTERSTITIAL_SELECTION: 'gate_interstitial_selection',
  GATE_INTERSTITIAL_UNAUTHORIZED: 'gate_interstitial_unauthorized',
});

/**
 * Each requester declares the tier it belongs to, the surface whose authority
 * it closes on behalf of, and the ledger surface id its refusals are recorded
 * under. `surfaceType` is null for tiers that do not compete.
 */
export const TAB_CLOSURE_REQUESTER_CATALOG = Object.freeze({
  [TAB_CLOSURE_REQUESTERS.SITE_FURIN_LEAVE]: Object.freeze({
    id: TAB_CLOSURE_REQUESTERS.SITE_FURIN_LEAVE,
    tier: TAB_CLOSURE_TIERS.RESOLUTION,
    surfaceType: RITUAL_SURFACE_TYPES.SITE_FURIN,
    ledgerSurfaceId: null,
  }),
  [TAB_CLOSURE_REQUESTERS.ENSO_GATE_LEAVE]: Object.freeze({
    id: TAB_CLOSURE_REQUESTERS.ENSO_GATE_LEAVE,
    tier: TAB_CLOSURE_TIERS.RESOLUTION,
    surfaceType: RITUAL_SURFACE_TYPES.ENSO_GATE,
    ledgerSurfaceId: INTERVENTION_SURFACE_IDS.BARRIER_CONSUMPTION_BOUNDARY,
  }),
  [TAB_CLOSURE_REQUESTERS.GATE_INTERSTITIAL_LEAVE]: Object.freeze({
    id: TAB_CLOSURE_REQUESTERS.GATE_INTERSTITIAL_LEAVE,
    tier: TAB_CLOSURE_TIERS.RESOLUTION,
    surfaceType: RITUAL_SURFACE_TYPES.GATE_INTERSTITIAL,
    ledgerSurfaceId: null,
  }),
  [TAB_CLOSURE_REQUESTERS.GATE_INTERSTITIAL_ESCAPE]: Object.freeze({
    id: TAB_CLOSURE_REQUESTERS.GATE_INTERSTITIAL_ESCAPE,
    tier: TAB_CLOSURE_TIERS.RESOLUTION,
    surfaceType: RITUAL_SURFACE_TYPES.GATE_INTERSTITIAL,
    ledgerSurfaceId: null,
  }),
  [TAB_CLOSURE_REQUESTERS.GATE_INTERSTITIAL_SELECTION]: Object.freeze({
    id: TAB_CLOSURE_REQUESTERS.GATE_INTERSTITIAL_SELECTION,
    tier: TAB_CLOSURE_TIERS.SELECTION,
    surfaceType: null,
    ledgerSurfaceId: null,
  }),
  [TAB_CLOSURE_REQUESTERS.GATE_INTERSTITIAL_UNAUTHORIZED]: Object.freeze({
    id: TAB_CLOSURE_REQUESTERS.GATE_INTERSTITIAL_UNAUTHORIZED,
    tier: TAB_CLOSURE_TIERS.EVICTION,
    surfaceType: null,
    ledgerSurfaceId: null,
  }),
});

export const TAB_CLOSURE_OUTCOMES = Object.freeze({
  /** The tab was closed. */
  CLOSED: 'closed',
  /** A higher intervention owns the tab. The requester must stand down. */
  REFUSED: 'refused',
  /** The close was authorized and attempted, but the browser rejected it. */
  FAILED: 'failed',
});

export const TAB_CLOSURE_REFUSAL_REASONS = Object.freeze({
  GATE_SESSION_ACTIVE: 'gate_session_active',
});

export function resolveTabClosureRequester(requesterId) {
  const descriptor = TAB_CLOSURE_REQUESTER_CATALOG[requesterId];
  if (!descriptor) {
    throw new Error(`TAB_CLOSURE_REQUESTER_INVALID:${String(requesterId)}`);
  }
  return descriptor;
}

/**
 * A requester's standing on the interruption ladder. Tiers that do not compete
 * have no standing and are never ranked against anything.
 */
export function resolveTabClosurePriority(descriptor) {
  return descriptor.surfaceType === null
    ? null
    : RITUAL_SURFACE_PRIORITIES[descriptor.surfaceType];
}
