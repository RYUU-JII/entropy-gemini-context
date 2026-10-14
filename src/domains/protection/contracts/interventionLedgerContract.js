import {
  PROTECTION_CANONICAL_ARTIFACT_IDS,
  isCanonicalArtifactId,
} from '../catalog/artifactFamilyCatalog.js';

const {
  BARRIER,
  GATE,
  FLARE,
  ECHO,
} = PROTECTION_CANONICAL_ARTIFACT_IDS;

export const INTERVENTION_LEDGER_VERSION = 1;

/**
 * Bounded ring capacity. The ledger is an observation window, not a history
 * store: durable intervention history stays in the stats/IndexedDB owners.
 */
export const INTERVENTION_LEDGER_CAPACITY = 240;

export const INTERVENTION_SURFACE_IDS = Object.freeze({
  GATE_ENTRY_CHECKPOINT: 'gate:entryCheckpoint',
  GATE_RETURN_GUARD: 'gate:returnGuard',
  GATE_ISOLATION: 'gate:isolation',
  BARRIER_DETOUR_SPREAD: 'barrier:detourSpreadGuard',
  BARRIER_CONSUMPTION_BOUNDARY: 'barrier:ensoGate',
  FLARE_SITE_FURIN: 'flare:siteFurin',
  FLARE_GLOBAL_SENTINEL: 'flare:globalSentinel',
  FLARE_PRESAGE: 'flare:presage',
  ECHO_TAB_EVAPORATION: 'echo:tabEvaporation',
});

/**
 * Every surface that can interrupt the user, keyed by the artifact family that
 * owns it. `gateKind` is the runtime discriminator carried by gate intervention
 * payloads; surfaces that are not gate interstitials declare `null`.
 */
export const INTERVENTION_SURFACE_CATALOG = Object.freeze({
  [INTERVENTION_SURFACE_IDS.GATE_ENTRY_CHECKPOINT]: Object.freeze({
    id: INTERVENTION_SURFACE_IDS.GATE_ENTRY_CHECKPOINT,
    familyId: GATE,
    gateKind: 'entryCheckpoint',
  }),
  [INTERVENTION_SURFACE_IDS.GATE_RETURN_GUARD]: Object.freeze({
    id: INTERVENTION_SURFACE_IDS.GATE_RETURN_GUARD,
    familyId: GATE,
    gateKind: 'returnGuard',
  }),
  [INTERVENTION_SURFACE_IDS.GATE_ISOLATION]: Object.freeze({
    id: INTERVENTION_SURFACE_IDS.GATE_ISOLATION,
    familyId: GATE,
    gateKind: 'isolation',
  }),
  [INTERVENTION_SURFACE_IDS.BARRIER_DETOUR_SPREAD]: Object.freeze({
    id: INTERVENTION_SURFACE_IDS.BARRIER_DETOUR_SPREAD,
    familyId: BARRIER,
    gateKind: 'detourSpreadGuard',
  }),
  [INTERVENTION_SURFACE_IDS.BARRIER_CONSUMPTION_BOUNDARY]: Object.freeze({
    id: INTERVENTION_SURFACE_IDS.BARRIER_CONSUMPTION_BOUNDARY,
    familyId: BARRIER,
    gateKind: null,
  }),
  [INTERVENTION_SURFACE_IDS.FLARE_SITE_FURIN]: Object.freeze({
    id: INTERVENTION_SURFACE_IDS.FLARE_SITE_FURIN,
    familyId: FLARE,
    gateKind: null,
  }),
  [INTERVENTION_SURFACE_IDS.FLARE_GLOBAL_SENTINEL]: Object.freeze({
    id: INTERVENTION_SURFACE_IDS.FLARE_GLOBAL_SENTINEL,
    familyId: FLARE,
    gateKind: null,
  }),
  [INTERVENTION_SURFACE_IDS.FLARE_PRESAGE]: Object.freeze({
    id: INTERVENTION_SURFACE_IDS.FLARE_PRESAGE,
    familyId: FLARE,
    gateKind: null,
  }),
  [INTERVENTION_SURFACE_IDS.ECHO_TAB_EVAPORATION]: Object.freeze({
    id: INTERVENTION_SURFACE_IDS.ECHO_TAB_EVAPORATION,
    familyId: ECHO,
    gateKind: null,
  }),
});

export const INTERVENTION_PHASES = Object.freeze({
  OFFERED: 'offered',
  SHOWN: 'shown',
  // Policy wanted to intervene and something stopped it at that moment.
  SUPPRESSED: 'suppressed',
  // Pre-authorized: an earlier decision already covers this surface, so it will
  // not be offered until the pass lapses. Recorded once per grant, not once per
  // skipped dispatch.
  EXEMPTED: 'exempted',
  RESOLVED: 'resolved',
});

export const INTERVENTION_DECISIONS = Object.freeze({
  CONTINUE: 'continue',
  LEAVE: 'leave',
  DISMISSED: 'dismissed',
  EXPIRED: 'expired',
  SUPERSEDED: 'superseded',
});

const SURFACE_ID_SET = new Set(Object.keys(INTERVENTION_SURFACE_CATALOG));
const PHASE_SET = new Set(Object.values(INTERVENTION_PHASES));
const DECISION_SET = new Set(Object.values(INTERVENTION_DECISIONS));

const GATE_KIND_TO_SURFACE_ID = Object.freeze(
  Object.values(INTERVENTION_SURFACE_CATALOG).reduce((acc, definition) => {
    if (definition.gateKind) acc[definition.gateKind] = definition.id;
    return acc;
  }, {}),
);

function assertSurfaceCatalog() {
  Object.entries(INTERVENTION_SURFACE_CATALOG).forEach(([key, definition]) => {
    if (definition?.id !== key) {
      throw new Error(`[interventionLedgerContract] Surface key/id mismatch for "${key}".`);
    }
    if (!isCanonicalArtifactId(definition.familyId)) {
      throw new Error(`[interventionLedgerContract] Surface "${key}" declares an unknown family.`);
    }
    if (definition.gateKind !== null && typeof definition.gateKind !== 'string') {
      throw new Error(`[interventionLedgerContract] Surface "${key}" declares an invalid gate kind.`);
    }
  });
}

assertSurfaceCatalog();

export function getInterventionSurfaceDefinition(surfaceId) {
  return INTERVENTION_SURFACE_CATALOG?.[surfaceId] || null;
}

export function isInterventionSurfaceId(value) {
  return typeof value === 'string' && SURFACE_ID_SET.has(value);
}

/**
 * Maps a gate intervention payload `gateKind` onto its ledger surface id.
 * Returns null for kinds that do not own a ledger surface so callers can decide
 * whether that is a contract violation in their context.
 */
export function resolveGateKindSurfaceId(gateKind) {
  const normalized = typeof gateKind === 'string' ? gateKind.trim() : '';
  return GATE_KIND_TO_SURFACE_ID?.[normalized] || null;
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeHostname(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeTabId(value) {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric >= 0 ? numeric : null;
}

function normalizeShortCode(value) {
  return typeof value === 'string' ? value.trim().slice(0, 96) : '';
}

/**
 * Write path. Throws on contract violations so a miswired call site fails
 * loudly instead of silently writing an unreadable row.
 */
export function createInterventionLedgerRecord({
  surfaceId,
  phase,
  scope,
  decision = null,
  reason = '',
  sessionId = '',
  at,
  sequence,
} = {}) {
  if (!isInterventionSurfaceId(surfaceId)) {
    throw new Error(`INTERVENTION_LEDGER_SURFACE_ID_INVALID:${String(surfaceId)}`);
  }
  if (typeof phase !== 'string' || !PHASE_SET.has(phase)) {
    throw new Error(`INTERVENTION_LEDGER_PHASE_INVALID:${String(phase)}`);
  }
  if (!isPlainObject(scope)) {
    throw new Error('INTERVENTION_LEDGER_SCOPE_REQUIRED');
  }
  if (decision !== null && !DECISION_SET.has(decision)) {
    throw new Error(`INTERVENTION_LEDGER_DECISION_INVALID:${String(decision)}`);
  }
  if (decision !== null && phase !== INTERVENTION_PHASES.RESOLVED) {
    throw new Error(`INTERVENTION_LEDGER_DECISION_PHASE_INVALID:${phase}`);
  }
  const normalizedAt = Number(at);
  if (!Number.isInteger(normalizedAt) || normalizedAt < 0) {
    throw new Error('INTERVENTION_LEDGER_TIMESTAMP_INVALID');
  }
  const normalizedSequence = Number(sequence);
  if (!Number.isInteger(normalizedSequence) || normalizedSequence < 1) {
    throw new Error('INTERVENTION_LEDGER_SEQUENCE_INVALID');
  }

  return Object.freeze({
    surfaceId,
    familyId: INTERVENTION_SURFACE_CATALOG[surfaceId].familyId,
    phase,
    scope: Object.freeze({
      hostname: normalizeHostname(scope.hostname),
      tabId: normalizeTabId(scope.tabId),
    }),
    decision,
    reason: normalizeShortCode(reason),
    sessionId: normalizeShortCode(sessionId),
    at: normalizedAt,
    sequence: normalizedSequence,
  });
}

/**
 * Read path. Returns null for rows that cannot be trusted so one corrupt entry
 * cannot brick the whole observation window.
 */
export function normalizeStoredInterventionLedgerRecord(value) {
  if (!isPlainObject(value)) return null;
  if (!isInterventionSurfaceId(value.surfaceId)) return null;
  if (!PHASE_SET.has(value.phase)) return null;
  if (value.decision !== null && !DECISION_SET.has(value.decision)) return null;
  const at = Number(value.at);
  if (!Number.isInteger(at) || at < 0) return null;
  const sequence = Number(value.sequence);
  if (!Number.isInteger(sequence) || sequence < 1) return null;

  return Object.freeze({
    surfaceId: value.surfaceId,
    familyId: INTERVENTION_SURFACE_CATALOG[value.surfaceId].familyId,
    phase: value.phase,
    scope: Object.freeze({
      hostname: normalizeHostname(value.scope?.hostname),
      tabId: normalizeTabId(value.scope?.tabId),
    }),
    decision: value.decision ?? null,
    reason: normalizeShortCode(value.reason),
    sessionId: normalizeShortCode(value.sessionId),
    at,
    sequence,
  });
}

export const INTERVENTION_LEDGER_SURFACE_ID_LIST = Object.freeze([...SURFACE_ID_SET]);
