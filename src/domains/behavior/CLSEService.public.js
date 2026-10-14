import {
  clearAllCLSEStorage,
  clearCLSEHistoricalData,
} from './clseMaintenanceStorage.js';
import ClseRepository from '../../platform/storage/clse/ClseRepository.js';

const clseRepository = ClseRepository.getInstance();
let clseSnapshotImportTail = Promise.resolve();
const PROFILE_MUTATION_PHASES = Object.freeze({
  OPEN: 'open',
  QUIESCING: 'quiescing',
  QUIESCED: 'quiesced',
  QUIESCE_FAILED: 'quiesce_failed',
});
let profileMutationPhase = PROFILE_MUTATION_PHASES.OPEN;
let profileMutationQuiescePromise = null;

function assertProfileMutationQuiesced() {
  if (profileMutationPhase !== PROFILE_MUTATION_PHASES.QUIESCED) {
    throw new Error(`CLSE_TERMINAL_MUTATION_REQUIRES_QUIESCED:${profileMutationPhase}`);
  }
}

function enqueueTerminalMutation(task) {
  if (typeof task !== 'function') {
    throw new Error('CLSE_STORAGE_MUTATION_TASK_REQUIRED');
  }
  const pending = clseSnapshotImportTail.then(task);
  clseSnapshotImportTail = pending.catch(() => undefined);
  return pending;
}

export function configureCLSEBrowserPort() {}

export function configureCLSEProfileMutationRuntimeAdmission() {}

export async function initCLSE() {
  return false;
}

export async function syncCLSEFromStoredSettings() {
  return null;
}

export function getCLSEStatus() {
  return null;
}

export function getCLSERecentEvents() {
  return [];
}

export async function resetCLSEBaseline() {
  return false;
}

export async function deleteCLSEData() {
  return clearCLSEHistoricalData();
}

export async function resetCLSEData() {
  assertProfileMutationQuiesced();
  return enqueueTerminalMutation(() => clearAllCLSEStorage());
}

export function quiesceCLSEForProfileMutation() {
  if (profileMutationPhase === PROFILE_MUTATION_PHASES.QUIESCING) {
    return profileMutationQuiescePromise;
  }
  if (profileMutationPhase === PROFILE_MUTATION_PHASES.QUIESCED) {
    return Promise.resolve(Object.freeze({ quiesced: true, reused: true }));
  }
  if (
    profileMutationPhase !== PROFILE_MUTATION_PHASES.OPEN
    && profileMutationPhase !== PROFILE_MUTATION_PHASES.QUIESCE_FAILED
  ) {
    return Promise.reject(new Error(
      `CLSE_PROFILE_MUTATION_PHASE_INVALID:${profileMutationPhase}`,
    ));
  }

  profileMutationPhase = PROFILE_MUTATION_PHASES.QUIESCING;
  profileMutationQuiescePromise = enqueueTerminalMutation(
    () => clseRepository.flushBaselineEpochWrites(),
  ).then(() => {
    profileMutationPhase = PROFILE_MUTATION_PHASES.QUIESCED;
    return Object.freeze({ quiesced: true, reused: false });
  }).catch((cause) => {
    profileMutationPhase = PROFILE_MUTATION_PHASES.QUIESCE_FAILED;
    const error = new Error('CLSE_PROFILE_MUTATION_QUIESCE_FAILED');
    error.code = 'CLSE_PROFILE_MUTATION_QUIESCE_FAILED';
    error.cause = cause;
    throw error;
  });
  return profileMutationQuiescePromise;
}

export function runCLSEStorageSnapshotImport(importTask) {
  assertProfileMutationQuiesced();
  return enqueueTerminalMutation(importTask);
}

export function recordCLSEShortDwell() {}
