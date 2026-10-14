import { isPlainObject } from '../storageValueUtils.js';

export const STORAGE_LOCAL_DOC_KEYS = Object.freeze({
  CORE: 'settings.core',
  RULES: 'settings.rules',
  UI: 'settings.ui',
  SECURITY: 'settings.security',
  META: 'meta.storage_schema',
});

export const STORAGE_LOCAL_CACHE_KEYS = Object.freeze({
  BOOTSTRAP_CACHE_GENERATION: 'bootstrap.cache_generation',
  BOOTSTRAP_FRICTION: 'bootstrap.friction',
  BOOTSTRAP_ROOT_VISUAL: 'bootstrap.root_visual',
  WORKER_RUNTIME_EVENTS: 'worker_runtime_events',
});

export const STORAGE_LOCAL_STATE_KEYS = Object.freeze({
  GUIDANCE_STATE: 'guidance_state',
  GATE_PRUNING_PRESENTATION: 'presentation.gate_pruning',
  FURIN_DAILY_RECEIPT: 'nudge.daily_receipt',
  PROFILE_RESET_LIFECYCLE: 'runtime.profile_reset_lifecycle',
  PROGRESSION_STATE: 'progression.state',
});

export const STORAGE_LOCAL_KEY_KEYS = Object.freeze({
  SECURITY_VAULT: 'keys.security_vault',
});

// Retired names exist only to diagnose an incompatible profile and to support
// an explicitly requested whole-profile reset. They are never key read paths.
export const RETIRED_PLAINTEXT_KEY_STORAGE_KEYS = Object.freeze([
  'keys.log_crypto_jwk', 'keys.domain_hmac_secret', 'keys.clse_hmac_secret',
]);

export const KEY_MATERIAL_FIELDS = Object.freeze({
  LOG_CRYPTO_JWK: 'logCryptoJwk', DOMAIN_HMAC_SECRET: 'domainHmacSecret', CLSE_HMAC_SECRET: 'clseHmacJwk',
});

export const STORAGE_SESSION_KEYS = Object.freeze({
  SECURITY_VAULT_KEYRING: 'runtime.security_vault_keyring',
  GUIDANCE_PRESENTATION: 'guidance_presentation_session',
  DASHBOARD_BOOT_PRESENTATION: 'presentation.dashboard_boot',
  ACTIVE_TAB: 'runtime.active_tab',
  DOMAIN_SESSION: 'runtime.domain_session',
  CONSUMPTION_FLOW: 'runtime.consumption_flow',
  CYCLE_CHECKPOINT: 'runtime.cycle_checkpoint',
  STATS_CLEANUP_DATE: 'runtime.stats_cleanup_date',
  STATS_HEALTH: 'runtime.stats_health',
  TAB_NAVIGATION_STATE: 'runtime.tab_navigation_state',
  GLOBAL_CAP_STATE: 'runtime.global_cap_state',
  GLOBAL_SENTINEL_OUTCOME: 'runtime.global_sentinel_outcome',
  SCHEDULE_STATE: 'runtime.schedule_state',
  SCHEDULE_OCCURRENCE_SKIP: 'runtime.schedule_occurrence_skip',
  SPECIAL_SESSION: 'runtime.special_session',
  FRICTION_MODIFIERS: 'runtime.friction_modifiers',
  PENDING_POPUP_BLOCK_DOMAINS: 'runtime.pending_popup_block_domains',
  NUDGE_PENDING: 'runtime.pending_nudges',
  NUDGE_DEBT: 'runtime.nudge_debt',
  NUDGE_LEASE: 'runtime.nudge_lease',
  NUDGE_TERMINAL: 'runtime.nudge_terminal',
  NUDGE_TERMINAL_OUTBOX: 'runtime.nudge_terminal_outbox',
  NUDGE_SHOWN: 'runtime.nudge_shown',
  NUDGE_ACK: 'runtime.nudge_ack',
  GATE_INTERSTITIAL_SESSIONS: 'runtime.gate_interstitial_sessions',
  GATE_ENTRY_APPROVAL: 'runtime.gate_entry_approval',
  GATE_RETURN_LOCK: 'runtime.gate_return_lock',
  INTERVENTION_LEDGER: 'runtime.intervention_ledger',
  INTERVENTION_ADMISSION: 'runtime.intervention_admission',
  NOTIFICATION_STATE: 'runtime.notification_state',
  HISTORY_CLEANUP_ACTIVATION: 'runtime.history_cleanup_activation',
  TAB_EVAPORATION: 'runtime.tab_evaporation',
  PROTECTED_TAB_GROUPS: 'runtime.protected_tab_groups',
  SETTINGS_PROPAGATION: 'runtime.settings_propagation',
  VIDEO_SKIP_POOL: 'runtime.video_skip_pool',
  PROGRESSION_UNLOCK_DEBUG: 'runtime.progression_unlock_debug',
  CLSE_CHECKPOINT: 'runtime.clse_checkpoint',
});

const CANONICAL_SESSION_STORAGE_KEYS = new Set(Object.values(STORAGE_SESSION_KEYS));

export const FLAT_KEY_TO_DOCUMENT = Object.freeze({
  relaxationSchedule: STORAGE_LOCAL_DOC_KEYS.CORE,
  gateConfig: STORAGE_LOCAL_DOC_KEYS.CORE,
  tabManagement: STORAGE_LOCAL_DOC_KEYS.CORE,
  filteringMode: STORAGE_LOCAL_DOC_KEYS.CORE,
  filterSettings: STORAGE_LOCAL_DOC_KEYS.CORE,
  artifactControlState: STORAGE_LOCAL_DOC_KEYS.CORE,
  rulesMode: STORAGE_LOCAL_DOC_KEYS.CORE,
  globalGoal: STORAGE_LOCAL_DOC_KEYS.CORE,
  globalCapNotifyOnExceeded: STORAGE_LOCAL_DOC_KEYS.CORE,
  coolingCurve: STORAGE_LOCAL_DOC_KEYS.CORE,
  insightsMode: STORAGE_LOCAL_DOC_KEYS.CORE,
  insightsConsent: STORAGE_LOCAL_DOC_KEYS.CORE,
  dataCollectionMode: STORAGE_LOCAL_DOC_KEYS.CORE,
  precisionInsightsMode: STORAGE_LOCAL_DOC_KEYS.CORE,
  precisionInsightsSignals: STORAGE_LOCAL_DOC_KEYS.CORE,
  permissionMode: STORAGE_LOCAL_DOC_KEYS.CORE,
  historyCleanupForBlocked: STORAGE_LOCAL_DOC_KEYS.CORE,
  concealBlockedBookmarks: STORAGE_LOCAL_DOC_KEYS.CORE,
  tabEvaporationForBlocked: STORAGE_LOCAL_DOC_KEYS.CORE,
  tabEvaporationTimeoutMinutes: STORAGE_LOCAL_DOC_KEYS.CORE,
  indicatorConfig: STORAGE_LOCAL_DOC_KEYS.CORE,
  debugConfig: STORAGE_LOCAL_DOC_KEYS.CORE,
  nudgeConfig: STORAGE_LOCAL_DOC_KEYS.CORE,
  notificationsConfig: STORAGE_LOCAL_DOC_KEYS.CORE,
  solar_location_profile: STORAGE_LOCAL_DOC_KEYS.CORE,
  monitor_cycleSettings: STORAGE_LOCAL_DOC_KEYS.CORE,
  isAnchorUnlocked: STORAGE_LOCAL_DOC_KEYS.CORE,
  clse_enabled: STORAGE_LOCAL_DOC_KEYS.CORE,
  clse_sensitivity_scale: STORAGE_LOCAL_DOC_KEYS.CORE,
  clse_alert_cooldown_ms: STORAGE_LOCAL_DOC_KEYS.CORE,
  blockedUrls: STORAGE_LOCAL_DOC_KEYS.RULES,
  allowedUrls: STORAGE_LOCAL_DOC_KEYS.RULES,
  trackingExcludedUrls: STORAGE_LOCAL_DOC_KEYS.RULES,
  siteGoals: STORAGE_LOCAL_DOC_KEYS.RULES,
  siteGoalMeta: STORAGE_LOCAL_DOC_KEYS.RULES,
  siteRuleTimeline: STORAGE_LOCAL_DOC_KEYS.RULES,
  sentinelStayDecisions: STORAGE_LOCAL_DOC_KEYS.RULES,
  protectionPresetCatalog: STORAGE_LOCAL_DOC_KEYS.RULES,
  protectionPresetAssignments: STORAGE_LOCAL_DOC_KEYS.RULES,
  'app-theme': STORAGE_LOCAL_DOC_KEYS.UI,
  app_language: STORAGE_LOCAL_DOC_KEYS.UI,
  sidebarDisplayMode: STORAGE_LOCAL_DOC_KEYS.UI,
  zen_render_preset: STORAGE_LOCAL_DOC_KEYS.UI,
  masterPasscodeHash: STORAGE_LOCAL_DOC_KEYS.SECURITY,
  requirePasscodeForReset: STORAGE_LOCAL_DOC_KEYS.SECURITY,
  highSecurityMode: STORAGE_LOCAL_DOC_KEYS.SECURITY,
  blockedUrlHashes: STORAGE_LOCAL_DOC_KEYS.SECURITY,
  allowedUrlHashes: STORAGE_LOCAL_DOC_KEYS.SECURITY,
  siteGoalHashes: STORAGE_LOCAL_DOC_KEYS.SECURITY,
});

export const FLAT_KEY_TO_KEYSTORE = Object.freeze({
  domainHmacSecret: KEY_MATERIAL_FIELDS.DOMAIN_HMAC_SECRET,
});

export const SETTINGS_DOCUMENT_KEYS = Object.freeze([
  STORAGE_LOCAL_DOC_KEYS.CORE,
  STORAGE_LOCAL_DOC_KEYS.RULES,
  STORAGE_LOCAL_DOC_KEYS.UI,
  STORAGE_LOCAL_DOC_KEYS.SECURITY,
]);

export const KNOWN_FLAT_SETTING_KEYS = Object.freeze([
  ...Object.keys(FLAT_KEY_TO_DOCUMENT),
  ...Object.keys(FLAT_KEY_TO_KEYSTORE),
]);

export function resolveSettingsDocumentKey(flatKey) {
  return typeof flatKey === 'string' ? (FLAT_KEY_TO_DOCUMENT[flatKey] || null) : null;
}

export function resolveKeyStoreStorageKey(flatKey) {
  return typeof flatKey === 'string' ? (FLAT_KEY_TO_KEYSTORE[flatKey] || null) : null;
}

export function resolveSessionStorageKey(sessionKey) {
  if (typeof sessionKey !== 'string') return null;
  const trimmed = sessionKey.trim();
  if (!trimmed) return null;
  return CANONICAL_SESSION_STORAGE_KEYS.has(trimmed) ? trimmed : null;
}

export function getSessionStorageReadKeys(sessionKey) {
  const canonicalKey = resolveSessionStorageKey(sessionKey);
  return canonicalKey ? [canonicalKey] : [];
}

export function isCanonicalSettingsKey(flatKey) {
  return !!resolveSettingsDocumentKey(flatKey) || !!resolveKeyStoreStorageKey(flatKey);
}

export function requireSettingsDocument(documentKey, value) {
  if (!isPlainObject(value)) {
    const error = new Error('SETTINGS_DOCUMENT_CONTRACT_INVALID');
    error.documentKey = documentKey;
    throw error;
  }
  for (const key of Object.keys(value)) {
    if (FLAT_KEY_TO_DOCUMENT[key] !== documentKey) {
      const error = new Error('SETTINGS_DOCUMENT_KEY_INVALID:' + key);
      error.documentKey = documentKey;
      error.key = key;
      throw error;
    }
  }
  return value;
}

export function flattenSettingsDocuments(rawDocuments = {}) {
  const source = isPlainObject(rawDocuments) ? rawDocuments : {};
  const flattened = {};
  SETTINGS_DOCUMENT_KEYS.forEach((documentKey) => {
    if (!Object.prototype.hasOwnProperty.call(source, documentKey)) return;
    const documentValue = requireSettingsDocument(documentKey, source[documentKey]);
    Object.assign(flattened, documentValue);
  });
  return flattened;
}
