import {
  STORAGE_LOCAL_CACHE_KEYS,
  STORAGE_LOCAL_DOC_KEYS,
  STORAGE_LOCAL_KEY_KEYS,
  STORAGE_LOCAL_STATE_KEYS,
  STORAGE_SESSION_KEYS,
} from './storageKeyRegistry.js';
import { STORAGE_RETENTION_DAYS } from '../../retention/storageRetentionPolicy.js';

const ENTRYPOINTS = Object.freeze({
  SETTINGS: 'src/platform/storage/internal/chrome-storage/stores/SettingsStore.js',
  BOOTSTRAP: 'src/platform/storage/internal/chrome-storage/stores/BootstrapSnapshotStore.js',
  KEYS: 'src/platform/storage/internal/chrome-storage/stores/KeyStore.js',
  RUNTIME_SESSION: 'src/platform/storage/internal/chrome-storage/stores/RuntimeSessionStore.js',
  RUNTIME_FLAGS: 'src/platform/storage/internal/chrome-storage/session/RuntimeFlagStore.js',
  NUDGE_SESSION: 'src/platform/storage/internal/chrome-storage/session/NudgeSessionStore.js',
  WORKER_RUNTIME_EVENTS: 'src/platform/storage/internal/chrome-storage/stores/WorkerRuntimeEventStore.js',
  PROGRESSION_STATE: 'src/platform/storage/internal/chrome-storage/stores/ProgressionStateStore.js',
  STATS: 'src/platform/storage/internal/indexeddb/stores/StatsAggregateStore.js',
  STATS_FEATURE_PACKS: 'src/platform/storage/internal/indexeddb/stores/StatsFeaturePackStore.js',
  INTERVENTION_EFFECTS: 'src/platform/storage/internal/indexeddb/stores/InterventionEffectStore.js',
  EVENT_LOGS: 'src/platform/storage/internal/indexeddb/stores/EventLogStore.js',
  FAVICONS: 'src/platform/storage/internal/indexeddb/stores/FaviconStore.js',
  MODEL_STATE: 'src/platform/storage/internal/indexeddb/stores/ModelStateStore.js',
  ZEN_ARTIFACTS: 'src/platform/storage/internal/indexeddb/stores/ZenArtifactStore.js',
  CLSE: 'src/platform/storage/internal/indexeddb/stores/ClseStore.js',
  GATE_INTERVENTION_SESSION: 'src/platform/storage/internal/chrome-storage/session/GateInterventionSessionStore.js',
  INTERVENTION_LEDGER: 'src/platform/storage/internal/chrome-storage/session/InterventionLedgerStore.js',
  PROFILE_RESET_LIFECYCLE: 'src/platform/storage/runtime/ProfileResetLifecycleRepository.js',
});

const RUNTIME_FLAG_KEYS = new Set([
  STORAGE_SESSION_KEYS.GLOBAL_CAP_STATE,
  STORAGE_SESSION_KEYS.GLOBAL_SENTINEL_OUTCOME,
  STORAGE_SESSION_KEYS.SCHEDULE_STATE,
  STORAGE_SESSION_KEYS.SCHEDULE_OCCURRENCE_SKIP,
  STORAGE_SESSION_KEYS.SPECIAL_SESSION,
]);

const NUDGE_SESSION_KEYS = new Set([
  STORAGE_SESSION_KEYS.NUDGE_PENDING,
  STORAGE_SESSION_KEYS.NUDGE_DEBT,
  STORAGE_SESSION_KEYS.NUDGE_LEASE,
  STORAGE_SESSION_KEYS.NUDGE_TERMINAL,
  STORAGE_SESSION_KEYS.NUDGE_TERMINAL_OUTBOX,
  STORAGE_SESSION_KEYS.NUDGE_SHOWN,
  STORAGE_SESSION_KEYS.NUDGE_ACK,
]);

const GATE_INTERVENTION_SESSION_KEYS = new Set([
  STORAGE_SESSION_KEYS.GATE_INTERSTITIAL_SESSIONS,
]);

const INTERVENTION_LEDGER_KEYS = new Set([
  STORAGE_SESSION_KEYS.INTERVENTION_LEDGER,
]);

function createLocalSurface({
  id,
  owner,
  canonicalEntrypoint,
  evolutionMode = 'exact',
  retention,
  resetPolicy,
  exportPolicy,
}) {
  return {
    id,
    owner,
    backend: 'chrome.storage.local',
    canonicalEntrypoint,
    evolutionMode,
    version: 1,
    retention,
    resetPolicy,
    exportPolicy,
  };
}

function createSessionSurface(id) {
  if (id === STORAGE_SESSION_KEYS.PROTECTED_TAB_GROUPS) {
    return {
      id, owner: 'ProtectedTabGroupsRepository', backend: 'chrome.storage.session',
      canonicalEntrypoint: 'src/platform/storage/runtime/ProtectedTabGroupsRepository.js',
      evolutionMode: 'reset', version: 1,
      retention: 'Browser-session native group IDs, processed tab IDs and Entropy-inserted members only; no URLs or titles.',
      resetPolicy: 'Cleared by browser-session termination, full profile reset and backup restore after mutation drain.',
      exportPolicy: 'exclude_from_durable_export',
    };
  }
  if (id === STORAGE_SESSION_KEYS.SECURITY_VAULT_KEYRING) {
    return {
      id, owner: 'SecurityVaultSessionStore', backend: 'chrome.storage.session',
      canonicalEntrypoint: 'src/platform/storage/security/KeyMaterialRepository.js',
      evolutionMode: 'reset', version: 1,
      retention: 'Plaintext keyring in trusted extension contexts for the browser session only.',
      resetPolicy: 'Cleared by browser session termination, explicit lock, profile reset, and backup restore.',
      exportPolicy: 'exclude_from_durable_export',
    };
  }
  if (id === STORAGE_SESSION_KEYS.GUIDANCE_PRESENTATION) {
    return { id, owner: 'GuidanceSessionStore', backend: 'chrome.storage.session',
      canonicalEntrypoint: 'src/platform/storage/guidance/GuidanceRepository.js', evolutionMode: 'reset', version: 1,
      retention: 'One bounded presentation claim and development-only preview receipts.',
      resetPolicy: 'Cleared by browser session reset and full profile reset; claims are generation-bound.',
      exportPolicy: 'exclude_from_durable_export' };
  }
  if (id === STORAGE_SESSION_KEYS.DASHBOARD_BOOT_PRESENTATION) {
    return {
      id,
      owner: 'DashboardBootPresentationStore',
      backend: 'chrome.storage.session',
      canonicalEntrypoint: 'src/platform/storage/presentation/DashboardBootPresentationStore.js',
      evolutionMode: 'reset',
      version: 1,
      retention: 'Completed Enso presentation in the current browser session.',
      resetPolicy: 'Cleared on browser session reset and resetAppData.',
      exportPolicy: 'exclude_from_durable_export',
    };
  }

  const owner = RUNTIME_FLAG_KEYS.has(id)
    ? 'RuntimeFlagStore'
    : (
      GATE_INTERVENTION_SESSION_KEYS.has(id)
        ? 'GateInterventionSessionStore'
        : (
          INTERVENTION_LEDGER_KEYS.has(id)
            ? 'InterventionLedgerStore'
            : (NUDGE_SESSION_KEYS.has(id) ? 'NudgeSessionStore' : 'RuntimeSessionStore')
        )
    );
  const canonicalEntrypoint = RUNTIME_FLAG_KEYS.has(id)
    ? ENTRYPOINTS.RUNTIME_FLAGS
    : (
      GATE_INTERVENTION_SESSION_KEYS.has(id)
        ? ENTRYPOINTS.GATE_INTERVENTION_SESSION
        : (
          INTERVENTION_LEDGER_KEYS.has(id)
            ? ENTRYPOINTS.INTERVENTION_LEDGER
            : (NUDGE_SESSION_KEYS.has(id) ? ENTRYPOINTS.NUDGE_SESSION : ENTRYPOINTS.RUNTIME_SESSION)
        )
    );

  return {
    id,
    owner,
    backend: 'chrome.storage.session',
    canonicalEntrypoint,
    evolutionMode: 'reset',
    version: 1,
    retention: 'Session-scoped checkpoint data; browser restart may clear it.',
    resetPolicy: 'Cleared by runtime-session reset flows and resetAppData.',
    exportPolicy: 'exclude_from_durable_export',
  };
}

function createIndexedDbSurface({
  id,
  owner,
  canonicalEntrypoint,
  evolutionMode,
  retention,
  resetPolicy,
  exportPolicy,
}) {
  return {
    id,
    owner,
    backend: 'indexeddb',
    canonicalEntrypoint,
    evolutionMode,
    version: 1,
    retention,
    resetPolicy,
    exportPolicy,
  };
}

export const STORAGE_SURFACE_REGISTRY = Object.freeze([
  createLocalSurface({
    id: STORAGE_LOCAL_DOC_KEYS.CORE,
    owner: 'SettingsStore',
    canonicalEntrypoint: ENTRYPOINTS.SETTINGS,
    retention: 'Durable canonical settings document.',
    resetPolicy: 'Cleared by resetAppData; preserved by analytics-only resets.',
    exportPolicy: 'include_in_storage_snapshot',
  }),
  createLocalSurface({
    id: STORAGE_LOCAL_DOC_KEYS.RULES,
    owner: 'SettingsStore',
    canonicalEntrypoint: ENTRYPOINTS.SETTINGS,
    retention: 'Durable canonical rules and target document.',
    resetPolicy: 'Cleared by resetAppData; preserved by analytics-only resets.',
    exportPolicy: 'include_in_storage_snapshot',
  }),
  createLocalSurface({
    id: STORAGE_LOCAL_DOC_KEYS.UI,
    owner: 'SettingsStore',
    canonicalEntrypoint: ENTRYPOINTS.SETTINGS,
    retention: 'Durable extension UI preference document.',
    resetPolicy: 'Cleared by resetAppData.',
    exportPolicy: 'include_in_storage_snapshot',
  }),
  createLocalSurface({
    id: STORAGE_LOCAL_DOC_KEYS.SECURITY,
    owner: 'SettingsStore',
    canonicalEntrypoint: ENTRYPOINTS.SETTINGS,
    retention: 'Durable security metadata document.',
    resetPolicy: 'Cleared by privileged reset flows only.',
    exportPolicy: 'include_in_encrypted_storage_snapshot',
  }),
  createLocalSurface({
    id: STORAGE_LOCAL_DOC_KEYS.META,
    owner: 'SettingsStore',
    canonicalEntrypoint: ENTRYPOINTS.SETTINGS,
    retention: 'Durable storage metadata document.',
    resetPolicy: 'Replaced only by exact V1 import flows; removed on resetAppData.',
    exportPolicy: 'include_in_storage_snapshot',
  }),
  createLocalSurface({
    id: STORAGE_LOCAL_CACHE_KEYS.BOOTSTRAP_CACHE_GENERATION,
    owner: 'BootstrapSnapshotStore',
    canonicalEntrypoint: ENTRYPOINTS.BOOTSTRAP,
    evolutionMode: 'rebuild',
    retention: 'Current bootstrap cache generation marker; no historical generations are retained.',
    resetPolicy: 'Recreated before background bootstrap cache projection after reset or generation change.',
    exportPolicy: 'exclude_from_durable_export',
  }),
  createLocalSurface({
    id: STORAGE_LOCAL_CACHE_KEYS.BOOTSTRAP_FRICTION,
    owner: 'BootstrapSnapshotStore',
    canonicalEntrypoint: ENTRYPOINTS.BOOTSTRAP,
    evolutionMode: 'rebuild',
    retention: 'Short-lived rebuildable bootstrap cache with TTL.',
    resetPolicy: 'Invalidated and rebuilt by bootstrap refresh flows, resetAppData, and storage snapshot import.',
    exportPolicy: 'exclude_from_durable_export',
  }),
  createLocalSurface({
    id: STORAGE_LOCAL_CACHE_KEYS.BOOTSTRAP_ROOT_VISUAL,
    owner: 'BootstrapSnapshotStore',
    canonicalEntrypoint: ENTRYPOINTS.BOOTSTRAP,
    evolutionMode: 'rebuild',
    retention: 'Short-lived rebuildable root-visual bootstrap cache for document-start preload.',
    resetPolicy: 'Invalidated and rebuilt by bootstrap refresh flows, resetAppData, and storage snapshot import.',
    exportPolicy: 'exclude_from_durable_export',
  }),
  createLocalSurface({
    id: STORAGE_LOCAL_CACHE_KEYS.WORKER_RUNTIME_EVENTS,
    owner: 'WorkerRuntimeEventStore',
    canonicalEntrypoint: ENTRYPOINTS.WORKER_RUNTIME_EVENTS,
    evolutionMode: 'reset',
    retention: 'Short-lived debug/runtime telemetry cache for worker diagnostics.',
    resetPolicy: 'Cleared through the background worker-runtime event capability by debug reset flows, resetAppData, and storage snapshot import after terminal producer/write drain.',
    exportPolicy: 'exclude_from_durable_export',
  }),
  createLocalSurface({
    id: STORAGE_LOCAL_STATE_KEYS.PROFILE_RESET_LIFECYCLE,
    owner: 'ProfileResetLifecycleRepository',
    canonicalEntrypoint: ENTRYPOINTS.PROFILE_RESET_LIFECYCLE,
    evolutionMode: 'exact',
    retention: 'Durable profile mutation generation and recovery fence.',
    resetPolicy: 'Never cleared by profile data reset; replaced only by a terminal mutation or the next explicitly admitted profile mutation.',
    exportPolicy: 'exclude_from_durable_export',
  }),
  createLocalSurface({
    id: STORAGE_LOCAL_STATE_KEYS.GATE_PRUNING_PRESENTATION,
    owner: 'GatePruningPresentationStore',
    canonicalEntrypoint: 'src/platform/storage/presentation/GatePruningPresentationStore.js',
    evolutionMode: 'exact',
    retention: 'One durable completion receipt after an actual user-selected Gate tab closure; no tab data.',
    resetPolicy: 'Cleared by resetAppData; closure and receipt share profile mutation admission.',
    exportPolicy: 'exclude_from_storage_snapshot',
  }),
  createLocalSurface({
    id: STORAGE_LOCAL_STATE_KEYS.FURIN_DAILY_RECEIPT,
    owner: 'FurinDailyReceiptRepository',
    canonicalEntrypoint: 'src/platform/storage/nudge/FurinDailyReceiptRepository.js',
    evolutionMode: 'exact',
    retention: 'One activity-day of actual Furin presentation receipts, at most 1024 site hosts; no debt or run state.',
    resetPolicy: 'Cleared by resetAppData; next activity-day presentation replaces the receipt.',
    exportPolicy: 'exclude_from_storage_snapshot',
  }),
  createLocalSurface({
    id: STORAGE_LOCAL_STATE_KEYS.PROGRESSION_STATE,
    owner: 'ProgressionStateStore',
    canonicalEntrypoint: ENTRYPOINTS.PROGRESSION_STATE,
    evolutionMode: 'exact',
    retention: 'Small durable progression unlock and milestone snapshot; aggregate history stays in IndexedDB owners.',
    resetPolicy: 'Cleared by resetAppData; export/import follows storage snapshot stateEntries.',
    exportPolicy: 'include_in_storage_snapshot',
  }),
  createLocalSurface({
    id: STORAGE_LOCAL_STATE_KEYS.GUIDANCE_STATE,
    owner: 'GuidanceStateStore',
    canonicalEntrypoint: 'src/platform/storage/guidance/GuidanceRepository.js',
    retention: 'Bounded contextual guide receipts, one first-install intent and latest journey notification delivery.',
    resetPolicy: 'Cleared on full profile reset; preserved on analytics reset and import.',
    exportPolicy: 'exclude_from_storage_snapshot',
  }),
  createLocalSurface({
    id: STORAGE_LOCAL_KEY_KEYS.SECURITY_VAULT,
    owner: 'KeyStore',
    canonicalEntrypoint: ENTRYPOINTS.KEYS,
    retention: 'One trusted local keyring by default; optional log-key wrapping leaves protection keys admitted. Existing full-key wraps require explicit separation.',
    resetPolicy: 'Cleared only by an explicit whole-profile reset; replaced by encrypted backup restore.',
    exportPolicy: 'rewrap_keyring_inside_encrypted_storage_snapshot',
  }),
  ...Object.values(STORAGE_SESSION_KEYS).map((id) => createSessionSurface(id)),
  createIndexedDbSurface({
    id: 'usage_logs',
    owner: 'EventLogStore',
    canonicalEntrypoint: ENTRYPOINTS.EVENT_LOGS,
    evolutionMode: 'exact',
    retention: `Rolling ${STORAGE_RETENTION_DAYS.USAGE_LOGS}-day encrypted event log retention plus transient flush buffer.`,
    resetPolicy: 'Cleared by resetAnalyticsData and resetAppData.',
    exportPolicy: 'include_in_storage_snapshot',
  }),
  createIndexedDbSurface({
    id: 'stats_hourly',
    owner: 'StatsAggregateStore',
    canonicalEntrypoint: ENTRYPOINTS.STATS,
    evolutionMode: 'exact',
    retention: 'Durable hourly fact ledger, including open and sealed buckets, subject to stats retention jobs.',
    resetPolicy: 'Cleared by analytics/app reset flows.',
    exportPolicy: 'include_in_storage_snapshot',
  }),
  createIndexedDbSurface({
    id: 'stats_daily',
    owner: 'StatsAggregateStore',
    canonicalEntrypoint: ENTRYPOINTS.STATS,
    evolutionMode: 'exact',
    retention: 'Required historical daily summary/read index after rollover, subject to stats retention jobs.',
    resetPolicy: 'Cleared by analytics/app reset flows.',
    exportPolicy: 'include_in_storage_snapshot',
  }),
  createIndexedDbSurface({
    id: 'stats_feature_pack_daily',
    owner: 'StatsFeaturePackStore',
    canonicalEntrypoint: ENTRYPOINTS.STATS_FEATURE_PACKS,
    evolutionMode: 'exact',
    retention: `${STORAGE_RETENTION_DAYS.STATS_FEATURE_PACK_DAILY}-day dormant derived-row retention, bounded by the source-fact horizon.`,
    resetPolicy: 'Cleared by analytics/app reset flows; retained only for exact V1 snapshot compatibility.',
    exportPolicy: 'include_in_storage_snapshot',
  }),
  createIndexedDbSurface({
    id: 'intervention_exposures',
    owner: 'InterventionEffectStore',
    canonicalEntrypoint: ENTRYPOINTS.INTERVENTION_EFFECTS,
    evolutionMode: 'exact',
    retention: `${STORAGE_RETENTION_DAYS.INTERVENTION_EXPOSURES}-day intervention exposure/outcome ledger.`,
    resetPolicy: 'Cleared by analytics/app reset flows.',
    exportPolicy: 'include_in_storage_snapshot',
  }),
  createIndexedDbSurface({
    id: 'intervention_effect_daily',
    owner: 'InterventionEffectStore',
    canonicalEntrypoint: ENTRYPOINTS.INTERVENTION_EFFECTS,
    evolutionMode: 'exact',
    retention: `${STORAGE_RETENTION_DAYS.INTERVENTION_EFFECT_DAILY}-day daily intervention effect aggregate retention.`,
    resetPolicy: 'Cleared by analytics/app reset flows.',
    exportPolicy: 'include_in_storage_snapshot',
  }),
  createIndexedDbSurface({
    id: 'favicons',
    owner: 'FaviconStore',
    canonicalEntrypoint: ENTRYPOINTS.FAVICONS,
    evolutionMode: 'rebuild',
    retention: 'Rebuildable favicon cache until explicit clear/reset.',
    resetPolicy: 'Cleared by favicon-cache support action and resetAppData.',
    exportPolicy: 'include_in_storage_snapshot',
  }),
  createIndexedDbSurface({
    id: 'model_state',
    owner: 'ModelStateStore',
    canonicalEntrypoint: ENTRYPOINTS.MODEL_STATE,
    evolutionMode: 'exact',
    retention: 'Durable large model/runtime state until explicit replacement or clear.',
    resetPolicy: 'Cleared by resetAppData.',
    exportPolicy: 'include_in_storage_snapshot',
  }),
  createIndexedDbSurface({
    id: 'zen_artifacts',
    owner: 'ZenArtifactStore',
    canonicalEntrypoint: ENTRYPOINTS.ZEN_ARTIFACTS,
    evolutionMode: 'exact',
    retention: 'Durable user-facing Zen artifact state.',
    resetPolicy: 'Cleared by resetAppData.',
    exportPolicy: 'include_in_storage_snapshot',
  }),
  createIndexedDbSurface({
    id: 'clse_buckets_60s',
    owner: 'ClseStore',
    canonicalEntrypoint: ENTRYPOINTS.CLSE,
    evolutionMode: 'exact',
    retention: `${STORAGE_RETENTION_DAYS.CLSE_60S_BUCKETS}-day rolling CLSE 60-second aggregation retention.`,
    resetPolicy: 'Cleared by CLSE reset/app reset flows.',
    exportPolicy: 'include_in_storage_snapshot',
  }),
  createIndexedDbSurface({
    id: 'clse_buckets_5min',
    owner: 'ClseStore',
    canonicalEntrypoint: ENTRYPOINTS.CLSE,
    evolutionMode: 'exact',
    retention: `${STORAGE_RETENTION_DAYS.CLSE_5MIN_BUCKETS}-day rolling CLSE 5-minute aggregation retention.`,
    resetPolicy: 'Cleared by CLSE reset/app reset flows.',
    exportPolicy: 'include_in_storage_snapshot',
  }),
  createIndexedDbSurface({
    id: 'clse_loop_events',
    owner: 'ClseStore',
    canonicalEntrypoint: ENTRYPOINTS.CLSE,
    evolutionMode: 'exact',
    retention: `${STORAGE_RETENTION_DAYS.CLSE_DIAGNOSTICS}-day rolling CLSE diagnostic retention.`,
    resetPolicy: 'Cleared by CLSE reset/app reset flows.',
    exportPolicy: 'include_in_storage_snapshot',
  }),
  createIndexedDbSurface({
    id: 'clse_baseline',
    owner: 'ClseStore',
    canonicalEntrypoint: ENTRYPOINTS.CLSE,
    evolutionMode: 'exact',
    retention: 'Durable CLSE calibration baseline until explicit reset.',
    resetPolicy: 'Reset by CLSE baseline reset or resetAppData.',
    exportPolicy: 'include_in_storage_snapshot',
  }),
  createIndexedDbSurface({
    id: 'clse_aggression_logs',
    owner: 'ClseStore',
    canonicalEntrypoint: ENTRYPOINTS.CLSE,
    evolutionMode: 'exact',
    retention: `${STORAGE_RETENTION_DAYS.CLSE_DIAGNOSTICS}-day rolling CLSE diagnostic retention.`,
    resetPolicy: 'Cleared by CLSE reset/app reset flows.',
    exportPolicy: 'include_in_storage_snapshot',
  }),
  createIndexedDbSurface({
    id: 'clse_daily_summaries',
    owner: 'ClseStore',
    canonicalEntrypoint: ENTRYPOINTS.CLSE,
    evolutionMode: 'exact',
    retention: `${STORAGE_RETENTION_DAYS.CLSE_DAILY_SUMMARIES}-day rolling CLSE daily summary retention.`,
    resetPolicy: 'Cleared by CLSE reset/app reset flows.',
    exportPolicy: 'include_in_storage_snapshot',
  }),
]);

export function getStorageSurfaceRegistryEntry(id) {
  return STORAGE_SURFACE_REGISTRY.find((entry) => entry.id === id) || null;
}

export default STORAGE_SURFACE_REGISTRY;
