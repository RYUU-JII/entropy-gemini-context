import { BUILD_INCLUDE_CLSE_LABS } from '../../platform/build/releaseCapabilities.js';
import { CLSE_CONSTANTS } from './clseSchema.js';
import {
  createCLSEProfileMutationRuntimeAdmission,
  requireCLSEProfileMutationRuntimeAdmission,
} from './clseProfileMutationRuntimeAdmission.js';
import * as CLSEServiceModule from '@clse-service-runtime';

const DISABLED_CLSE_STATUS = Object.freeze({
  isInitialized: false,
  isEnabled: false,
  bucketCount: 0,
  sustainedLoadState: null,
  loopStats: null,
  sensitivityScale: 1,
  alertCooldownMs: CLSE_CONSTANTS.ALERT_COOLDOWN_DEFAULT_MS,
  alert: null,
  baseline: null,
});

const CLSE_SYNC_SETTING_KEYS = Object.freeze([
  'clse_enabled',
  'clse_sensitivity_scale',
  'clse_alert_cooldown_ms',
]);

let clseServicePromise = null;
let loadedCLSEService = null;
let clseBrowserPort = null;
let clseProfileMutationRuntimeAdmission = null;

function cloneDisabledStatus() {
  return { ...DISABLED_CLSE_STATUS };
}

function shouldLoadCLSEService() {
  return BUILD_INCLUDE_CLSE_LABS === true;
}

function hasRelevantCLSESetting(changedKeys) {
  if (!Array.isArray(changedKeys) || changedKeys.length === 0) {
    return true;
  }
  return changedKeys.some((key) => CLSE_SYNC_SETTING_KEYS.includes(key));
}

function loadCLSEService() {
  if (!shouldLoadCLSEService()) {
    return Promise.resolve(null);
  }
  const runtimeAdmission = requireCLSEProfileMutationRuntimeAdmission(
    clseProfileMutationRuntimeAdmission,
  );
  if (loadedCLSEService) {
    return Promise.resolve(loadedCLSEService);
  }
  clseServicePromise ||= Promise.resolve()
    .then(() => {
      loadedCLSEService = CLSEServiceModule;
      if (clseBrowserPort) {
        loadedCLSEService.configureCLSEBrowserPort?.(clseBrowserPort);
      }
      loadedCLSEService.configureCLSEProfileMutationRuntimeAdmission(
        runtimeAdmission,
      );
      return loadedCLSEService;
    })
    .catch((error) => {
      clseServicePromise = null;
      loadedCLSEService = null;
      console.error('[CLSEServiceClient] Failed to load CLSE service.', error);
      throw error;
    });
  return clseServicePromise;
}

export function configureCLSEBrowserPort(browserPort) {
  clseBrowserPort = browserPort || null;
  loadedCLSEService?.configureCLSEBrowserPort?.(clseBrowserPort);
}

export function configureCLSEProfileMutationRuntimeAdmission({
  captureAdmission,
  runCapturedTask,
} = {}) {
  clseProfileMutationRuntimeAdmission = createCLSEProfileMutationRuntimeAdmission({
    captureAdmission,
    runCapturedTask,
  });
  loadedCLSEService?.configureCLSEProfileMutationRuntimeAdmission(
    clseProfileMutationRuntimeAdmission,
  );
}

export async function initCLSE() {
  const service = await loadCLSEService();
  return service ? service.initCLSE() : false;
}

export async function runCLSEHeartbeat(options = {}) {
  const service = await loadCLSEService();
  if (!service) return false;
  return service.runCLSEHeartbeat(options?.now);
}

export async function syncCLSEFromStoredSettings(options = {}) {
  if (!hasRelevantCLSESetting(options?.changedKeys)) {
    return getCLSEStatus();
  }
  const service = await loadCLSEService();
  return service ? service.syncCLSEFromStoredSettings(options) : cloneDisabledStatus();
}

export function getCLSEStatus() {
  if (!loadedCLSEService) {
    return cloneDisabledStatus();
  }
  return loadedCLSEService.getCLSEStatus();
}

export function getCLSERecentEvents() {
  if (!loadedCLSEService) return [];
  return loadedCLSEService.getCLSERecentEvents();
}

export async function resetCLSEBaseline() {
  const service = await loadCLSEService();
  if (!service) return false;
  await service.resetCLSEBaseline();
  return true;
}

export async function deleteCLSEData() {
  if (!shouldLoadCLSEService()) {
    return CLSEServiceModule.deleteCLSEData();
  }
  const service = await loadCLSEService();
  return service.deleteCLSEData();
}

export async function resetCLSEData() {
  return CLSEServiceModule.resetCLSEData();
}

export function quiesceCLSEForProfileMutation() {
  if (typeof CLSEServiceModule.quiesceCLSEForProfileMutation !== 'function') {
    throw new Error('CLSE_PROFILE_MUTATION_QUIESCE_OWNER_REQUIRED');
  }
  return CLSEServiceModule.quiesceCLSEForProfileMutation();
}

export function runCLSEStorageSnapshotImport(importTask) {
  return CLSEServiceModule.runCLSEStorageSnapshotImport(importTask);
}

export function recordCLSEShortDwell(count = 1) {
  if (!shouldLoadCLSEService()) return;
  void loadCLSEService()
    .then((service) => {
      service?.recordCLSEShortDwell(count);
    })
    .catch((error) => {
      console.error('[CLSEServiceClient] Failed to record short dwell.', error);
    });
}
