import { cloneFeedFlowSnapshot } from '../../../protection/contracts/feedFlowSnapshotBridge.js';
import FeedFlowDiagnosticLedger from './FeedFlowDiagnosticLedger.js';
import { normalizeFeedTempoDiagnosticSnapshot } from '../tempo/feedTempoContracts.js';

let latestSnapshot = null;
let latestSupplySnapshot = null;
let latestTempoSnapshot = null;
let latestBingeSnapshot = null;
const diagnosticLedger = new FeedFlowDiagnosticLedger();

function cloneSupplySnapshot(snapshot = null) {
  if (!snapshot || typeof snapshot !== 'object') {
    return { active: false, readout: null, interaction: null };
  }
  return {
    active: snapshot.active === true,
    checkedAt: Math.max(0, Math.round(Number(snapshot.checkedAt) || 0)),
    readout: snapshot.readout && typeof snapshot.readout === 'object'
      ? { ...snapshot.readout }
      : null,
    interaction: snapshot.interaction && typeof snapshot.interaction === 'object'
      ? { ...snapshot.interaction }
      : null,
  };
}

export function publishFeedFlowDiagnosticSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw new Error('FEED_FLOW_DIAGNOSTIC_SNAPSHOT_REQUIRED');
  }
  latestSnapshot = cloneFeedFlowSnapshot(snapshot);
  return cloneFeedFlowSnapshot(latestSnapshot);
}

export function getFeedFlowDiagnosticSnapshot(now = Date.now()) {
  const snapshot = cloneFeedFlowSnapshot(latestSnapshot);
  if (!snapshot) return null;
  const normalizedNow = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  return {
    ...snapshot,
    stale: Number(snapshot.expiresAt) <= normalizedNow,
  };
}

export function publishFeedSupplyDiagnosticSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw new Error('FEED_SUPPLY_DIAGNOSTIC_SNAPSHOT_REQUIRED');
  }
  latestSupplySnapshot = cloneSupplySnapshot(snapshot);
  return cloneSupplySnapshot(latestSupplySnapshot);
}

export function getFeedSupplyDiagnosticSnapshot() {
  return cloneSupplySnapshot(latestSupplySnapshot);
}

export function publishFeedTempoDiagnosticSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw new Error('FEED_TEMPO_DIAGNOSTIC_SNAPSHOT_REQUIRED');
  }
  latestTempoSnapshot = normalizeFeedTempoDiagnosticSnapshot(snapshot);
  return globalThis.structuredClone(latestTempoSnapshot);
}

export function getFeedTempoDiagnosticSnapshot() {
  return latestTempoSnapshot ? globalThis.structuredClone(latestTempoSnapshot) : null;
}

function cloneFeedBingeDiagnosticSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw new Error('FEED_BINGE_DIAGNOSTIC_SNAPSHOT_REQUIRED');
  }
  if (
    snapshot.observation?.source !== 'enso_feed_observation_window'
    || snapshot.evidence?.kind !== 'feed_flow'
  ) {
    throw new Error('FEED_BINGE_DIAGNOSTIC_CONTRACT_INVALID');
  }
  return {
    version: 1,
    observedAt: Math.max(0, Math.round(Number(snapshot.observedAt) || 0)),
    observation: globalThis.structuredClone(snapshot.observation),
    evidence: globalThis.structuredClone(snapshot.evidence),
  };
}

export function publishFeedBingeDiagnosticSnapshot(snapshot) {
  latestBingeSnapshot = cloneFeedBingeDiagnosticSnapshot(snapshot);
  return cloneFeedBingeDiagnosticSnapshot(latestBingeSnapshot);
}

export function getFeedBingeDiagnosticSnapshot() {
  return latestBingeSnapshot
    ? cloneFeedBingeDiagnosticSnapshot(latestBingeSnapshot)
    : null;
}

export function getFeedFlowDiagnosticLedgerSnapshot() {
  return diagnosticLedger.getSnapshot();
}

export function recordFeedFlowDiagnosticEvent(type, details = {}) {
  return diagnosticLedger.record(type, details);
}

export function startFeedFlowDiagnosticMeasure() {
  return diagnosticLedger.startMeasure();
}

export function readFeedFlowDiagnosticElapsedMs(startedAt) {
  return diagnosticLedger.elapsedMs(startedAt);
}

export function resetFeedFlowDiagnosticLedger() {
  return diagnosticLedger.reset();
}

export function clearFeedFlowDiagnosticSnapshot() {
  latestSnapshot = null;
  latestSupplySnapshot = null;
  latestTempoSnapshot = null;
  latestBingeSnapshot = null;
  diagnosticLedger.reset();
}
