import { withDynamicImportRecovery } from '../../../../platform/extension/dynamicImportRecovery.js';
import { SETTINGS_SECTION_IDS } from './config/sections.js';

export const SETTINGS_SECONDARY_SECTION_IDLE_TIMEOUT_MS = 1200;
const SETTINGS_SECONDARY_SECTION_IDLE_FALLBACK_DELAY_MS = 32;
export const SETTINGS_SECONDARY_SECTION_IDS = Object.freeze([
  SETTINGS_SECTION_IDS.SAFETY,
  SETTINGS_SECTION_IDS.WORKSPACE,
  SETTINGS_SECTION_IDS.PROTECTION,
]);

const loadSafetySectionModule = withDynamicImportRecovery(
  () => import('./sections/SettingsSafetySection.jsx'),
  { boundaryId: 'dashboard-settings-safety' },
);
const loadWorkspaceSectionModule = withDynamicImportRecovery(
  () => import('./sections/SettingsWorkspaceSection.jsx'),
  { boundaryId: 'dashboard-settings-workspace' },
);
const loadProtectionSectionModule = withDynamicImportRecovery(
  () => import('./sections/SettingsProtectionSection.jsx'),
  { boundaryId: 'dashboard-settings-protection' },
);

const SECTION_MODULE_DEFINITIONS = Object.freeze({
  [SETTINGS_SECTION_IDS.SAFETY]: Object.freeze({
    load: loadSafetySectionModule,
  }),
  [SETTINGS_SECTION_IDS.WORKSPACE]: Object.freeze({
    load: loadWorkspaceSectionModule,
  }),
  [SETTINGS_SECTION_IDS.PROTECTION]: Object.freeze({
    load: loadProtectionSectionModule,
  }),
});

const sectionModuleRecords = new Map();

function requireSecondarySectionDefinition(sectionId) {
  const definition = SECTION_MODULE_DEFINITIONS[sectionId];
  if (!definition) {
    throw new Error(`SETTINGS_SECONDARY_SECTION_MODULE_UNDECLARED:${String(sectionId)}`);
  }
  return definition;
}

function isRenderableSectionComponent(candidate) {
  return typeof candidate === 'function'
    || (
      candidate !== null
      && typeof candidate === 'object'
      && typeof candidate.$$typeof === 'symbol'
    );
}

function reportSectionModuleFailure(sectionId, error) {
  console.error(`[settings-section-module] Failed to load "${sectionId}".`, error);
}

function getOrCreateSectionModuleRecord(sectionId) {
  const definition = requireSecondarySectionDefinition(sectionId);
  const cachedRecord = sectionModuleRecords.get(sectionId);
  if (cachedRecord) return cachedRecord;

  const record = {
    status: 'loading',
    module: null,
    error: null,
    promise: null,
  };
  sectionModuleRecords.set(sectionId, record);

  let loadResult;
  try {
    loadResult = definition.load();
  } catch (error) {
    loadResult = Promise.reject(error);
  }

  record.promise = Promise.resolve(loadResult)
    .then((loadedModule) => {
      if (!isRenderableSectionComponent(loadedModule?.default)) {
        throw new Error(`SETTINGS_SECONDARY_SECTION_MODULE_DEFAULT_EXPORT_INVALID:${sectionId}`);
      }
      record.status = 'ready';
      record.module = loadedModule;
      return loadedModule;
    })
    .catch((error) => {
      record.status = 'error';
      record.error = error;
      reportSectionModuleFailure(sectionId, error);
      throw error;
    });

  return record;
}

export function isSettingsSecondarySectionId(sectionId) {
  return Object.prototype.hasOwnProperty.call(SECTION_MODULE_DEFINITIONS, sectionId);
}

export function loadSettingsSecondarySectionModule(sectionId) {
  return getOrCreateSectionModuleRecord(sectionId).promise;
}

export function preloadSettingsSecondarySectionModule(sectionId) {
  return loadSettingsSecondarySectionModule(sectionId);
}

export function getReadySettingsSecondarySectionComponent(sectionId) {
  requireSecondarySectionDefinition(sectionId);
  const record = sectionModuleRecords.get(sectionId);
  return record?.status === 'ready' ? record.module.default : null;
}

export function clearSettingsSecondarySectionModuleRecord(sectionId) {
  requireSecondarySectionDefinition(sectionId);
  sectionModuleRecords.delete(sectionId);
}

function observeSpeculativeSectionPreload(sectionId) {
  // The canonical record retains and reports the exact error. This observer only
  // prevents a speculative idle/intent request from becoming an unhandled promise.
  void preloadSettingsSecondarySectionModule(sectionId).catch(() => undefined);
}

export function scheduleSettingsSecondarySectionPreloads({
  host = typeof window === 'undefined' ? null : window,
} = {}) {
  let cancelled = false;
  let idleCallbackId = 0;
  let fallbackTimerId = 0;
  const admit = () => {
    if (cancelled) return;
    SETTINGS_SECONDARY_SECTION_IDS.forEach(observeSpeculativeSectionPreload);
  };

  if (host && typeof host.requestIdleCallback === 'function') {
    idleCallbackId = host.requestIdleCallback(admit, {
      timeout: SETTINGS_SECONDARY_SECTION_IDLE_TIMEOUT_MS,
    });
  } else {
    fallbackTimerId = globalThis.setTimeout(
      admit,
      SETTINGS_SECONDARY_SECTION_IDLE_FALLBACK_DELAY_MS,
    );
  }

  return () => {
    cancelled = true;
    if (idleCallbackId && host && typeof host.cancelIdleCallback === 'function') {
      host.cancelIdleCallback(idleCallbackId);
    }
    if (fallbackTimerId) globalThis.clearTimeout(fallbackTimerId);
  };
}

export function preloadSettingsSecondarySectionIntent(sectionId) {
  if (!isSettingsSecondarySectionId(sectionId)) return false;
  observeSpeculativeSectionPreload(sectionId);
  return true;
}

export function getSettingsSecondarySectionModuleState(sectionId) {
  requireSecondarySectionDefinition(sectionId);
  const record = sectionModuleRecords.get(sectionId);
  return Object.freeze({
    status: record?.status || 'idle',
    error: record?.error || null,
  });
}

export function resetSettingsSecondarySectionModuleRecordsForTests() {
  sectionModuleRecords.clear();
}
