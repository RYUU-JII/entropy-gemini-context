import {
  ENSO_SPAWN_SOURCE_SET,
} from './ensoSpawnSources.js';

export const ENSO_INTERVENTION_KIND = 'enso';
export const ENSO_INTERVENTION_PRIORITY = 30;

const ENSO_CANDIDATE_TTL_MS = 2_000;
function normalizeNow(value, label) {
  const numeric = Math.round(Number(value));
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error(`${label}:${String(value)}`);
  }
  return numeric;
}

function normalizeWeight(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 1) {
    throw new Error(`ENSO_INTERVENTION_WEIGHT_INVALID:${String(value)}`);
  }
  return numeric;
}

export function createEnsoInterventionCandidate({
  source,
  requestSerial,
  now = Date.now(),
  weight = 1,
} = {}) {
  if (!ENSO_SPAWN_SOURCE_SET.has(source)) {
    throw new Error(`ENSO_INTERVENTION_SOURCE_INVALID:${String(source)}`);
  }
  const requestedAt = normalizeNow(now, 'ENSO_INTERVENTION_NOW_INVALID');
  const serial = normalizeNow(
    requestSerial,
    'ENSO_INTERVENTION_REQUEST_SERIAL_INVALID',
  );
  if (serial < 1) {
    throw new Error('ENSO_INTERVENTION_REQUEST_SERIAL_INVALID');
  }
  return Object.freeze({
    requestId: `enso:${source}:${serial}`,
    kind: ENSO_INTERVENTION_KIND,
    requestedAt,
    validUntil: requestedAt + ENSO_CANDIDATE_TTL_MS,
    evidenceRevision: serial,
    priority: ENSO_INTERVENTION_PRIORITY,
    weight: normalizeWeight(weight),
    exclusivity: 'exclusive',
  });
}

export default createEnsoInterventionCandidate;
