import { RITUAL_SURFACE_TYPES } from './ritualSurfaceLadder.js';

// A minimum recovery interval, independent of the much longer Enso repeat policy.
export const INTERVENTION_RECOVERY_MS = 45_000;
export const INTERVENTION_CANDIDATE_TTL_MS = 5_000;
export const INTERVENTION_RESERVATION_TTL_MS = 10_000;
export const INTERVENTION_KINDS = Object.freeze([
  ...Object.values(RITUAL_SURFACE_TYPES), 'suikinkutsu',
]);

// Isolation enforces an explicitly active no-entry session, and the return
// lock a site that was fully left; neither asks anything. Entry and tab-spread
// reviews are invitations to reconsider, even when rendered as Gates.
const MANDATORY_GATE_KINDS = new Set(['isolation', 'returnGuard']);

export function isMandatoryIntervention({ kind, gateKind } = {}) {
  return kind === RITUAL_SURFACE_TYPES.GATE_INTERSTITIAL && MANDATORY_GATE_KINDS.has(gateKind);
}

// Recovery spaces out questions, and one question holds the lane at a time.
// A closed return lock asks none: it neither starts recovery (the entry
// checkpoint that may follow it must not be swallowed by that gap) nor keeps
// another site's question from being asked while it stands.
export function startsInterventionRecovery({ gateKind } = {}) {
  return gateKind !== 'returnGuard';
}

export function holdsInterventionLane({ gateKind } = {}) {
  return gateKind !== 'returnGuard';
}

export function canPreemptIntervention(candidate, current) {
  return isMandatoryIntervention(candidate) && !isMandatoryIntervention(current);
}

export function requireInterventionKind(kind) {
  if (!INTERVENTION_KINDS.includes(kind)) throw new Error('INTERVENTION_KIND_INVALID');
  return kind;
}

export function requireInterventionRevocationReason(reason) {
  if (typeof reason !== 'string' || !reason || reason !== reason.trim()) {
    throw new Error('INTERVENTION_REVOCATION_REASON_REQUIRED');
  }
  return reason;
}
