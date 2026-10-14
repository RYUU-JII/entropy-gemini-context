# Storage Architecture Target

Gate pruning presentation metadata uses `chrome.storage.local` key
`presentation.gate_pruning`, owned by `GatePruningPresentationStore`. The exact
record is `{ version: 1, completed: true }`; absence means uncompleted and any
other record is invalid. Writes are idempotent after an actual explicit selected
tab closure, never after viewing/dismissing the tutorial. Full app reset clears
the receipt after admitted work drains. It is excluded from durable export and
has no timestamps, tab identifiers, URLs or history.

- Status: Active
- Date: 2026-03-31
- Scope: Extension-wide storage design for settings, runtime checkpoints, stats, logs, CLSE, assets, and large model state
- Canonical owner/topology source: `docs/system-architecture/**`
- This document is authoritative for storage backend selection, release V1 data-shape detail, strict validation, and developer reset rules, but it does not replace system-architecture owner/path decisions.
- Supersedes for new work:
  - `README.md` storage guide
  - `AGENTS.md` storage bullets
  - storage references in `docs/architecture/repository/storage-stats-tracking-boundary-map.md`
  - storage references in `docs/architecture/runtime/friction-filter-injection-architecture.md`

- Owner: platform storage
- Last validated against code: 2026-08-08
- Path policy: current-only
- Canonical for: storage backend and data-shape detail for the canonical storage boundary

## Recorded protection charge — 2026-10-14

Stats daily/hourly fact rows use schema V2. Every domain has mandatory finite
nonnegative `protectedActive` and exactly 24 `hourlyProtectedActive` values;
each is bounded by its corresponding observed active fact and their sum equals
the domain charge. Hourly `domainsDelta` carries mandatory `protectedActive`.
The existing active-watermark collector records this charge only during effective
protected foreground collection. Policy transitions seal the old prefix before
the new committed settings become visible in the existing stats mutation lane.
Goal edits do not clear counters or delivery receipts.

The disposable `projectProtectionBudgetWindow` owns reset-hour charge projection
for Sites and protection runtime. Current membership cannot reclassify earlier
charge; explicit recording exclusion/consent admission still governs current
reads. Observed `active`, analytical category projections and optional interval
coverage never reconstruct charge. V1/missing charge fields reject unchanged at
typed reads, writes and snapshot import. DB topology/version, snapshot envelope
and independent stats-event schema remain V1. No automatic pre-release migration
or erasure is introduced; an old development profile requires the explicit reset
owner described in the versioning policy.

## Optional active interval coverage — 2026-09-14

GuidanceStateStore owns the exact local `guidance_state` document and
GuidanceSessionStore owns the exact session `guidance_presentation_session`.
The public GuidanceRepository is the only feature entrypoint. State retains
fixed-catalog viewed/dismissed/completed receipts, one install intent/fact,
latest presented journey day and latest reserved/sent/uncertain delivery.
Neither surface enters export/import or historical stats. Full reset clears
them through the drained maintenance owner; analytics reset preserves them.
The SettingsStore initializer upgrades exact stored three-field notification
configuration once with `journey.enabled=false`; canonical reads then require
the four-field contract and never perform a legacy-value fallback.

`hourly_stats.domainsDelta[hostname].activeUsageIntervals` is an optional array of
exact `[startEpochMs,endEpochMs]` pairs. Present data must be sorted, nonoverlapping,
finite, positive-duration and inside its hourly bucket; at most 32 pairs per hour
and their duration sum cannot exceed that row's active total. Absent data means
unmeasured timing. An empty present array also supplies no positive interval.
No migration synthesizes timing from old totals. Validation remains strict for
all other fields and invalid present coverage is rejected.

Only the existing admitted protected foreground sealer requests this detail.
Aggregator active-watermark deduplication precedes interval insertion, so replay
cannot duplicate time. Adjacent slices coalesce, real gaps remain; when saturated,
the most recent exact pairs survive and the query marks incomplete coverage.
Calendar-day materialization carries at most 768 pairs per domain. The same typed
stats repository transaction, retention, export/import validation and erasure
govern both totals and coverage. There is no second session/history backend.

Site Furin's activity-day DTO clips these facts at the canonical reset boundary
and labels its committed snapshot timestamp. It never extrapolates current idle,
intervention, pending entry, unsealed foreground or worker-downtime intervals.
See `sentinel-flare-site-furin-chime-spec.md` for graph/interaction semantics.

## 1) Why This Exists

Settings KV, session checkpoints, historical stats, encrypted logs, CLSE buckets, and asset caches have different owners and durability needs. Treating them as one generic store would make the system hard to reason about and easy to accidentally re-couple.

This document freezes the active storage philosophy and data-shape rules so implementation stays aligned.

## 2) Non-Negotiable Principles

1. One data class has one canonical home.
2. A storage backend is chosen by data shape and runtime needs, not by convenience.
3. `window.localStorage` is never the canonical source for business data.
4. Blocking/protection decisions must not depend on IndexedDB reads.
5. Raw event logs are not the source of truth for dashboard UX.
6. "Today" is an in-flight state; past days are finalized historical state.
7. No feature code writes directly to a generic storage helper for business-critical data.
8. Settings reads and cache hydration never migrate, delete, or rewrite stored
   values. Present settings use the exact current contract; malformed, retired,
   or incomplete values fail explicitly. Incompatible development profiles use
   the explicit whole-profile reset procedure before release validation.

### Presence-aware settings and key reads

`SettingsStore` and `KeyStore` request physical key arrays from Chrome Storage.
Only a key absent from the returned own properties may use explicit bootstrap
defaults. Present `null` or `undefined` is corruption: settings documents reject
with `SETTINGS_DOCUMENT_CONTRACT_INVALID`. The persistent KeyStore owns only the
current `keys.security_vault` record: strict `entropy-local-keyring` V1 by default,
or optional `entropy-log-key-vault` V1 wrapping only log AES while retaining local
protection HMAC keys. Existing full-wrapped `entropy-security-vault` V1 stays exact
until the Dashboard-only explicit separation action verifies current proof and
preserves all keys/ID. Present malformed/null material produces
`SECURITY_VAULT_ENVELOPE_INVALID` incompatible status. Retired plaintext key names
are presence diagnostics only, never read/repair/migration paths. Secret creation
belongs exclusively to the admitted `ensureLocalVault` pre-init owner or explicit
vault setup, while whole-profile reset owns removal. Read-only repository getters
never create keys; prepared status routes invoke the explicit owner before reading.
`ProfileResetLifecycleStore` also reads a physical key array. A present null or
undefined journal remains present and fails lifecycle normalization with
`PROFILE_RESET_LIFECYCLE_STATE_INVALID`; it cannot authorize pristine-profile
bootstrap, reset replacement, or ordinary writes.
`getDocuments` returns only present validated documents; export and merge use
that presence directly, without synthetic null documents.
Encrypted backup payloads serialize absent settings documents as null and retain
present empty documents as empty objects. An absent storage-schema marker is
represented by the current schema constant at export; present invalid metadata
fails. No secret documents or keyring fields are omitted from encrypted backups.

`SettingsDocumentRepository.commitItems` returns `{ changedKeys, previousItems }`
after the existing `SettingsStore` FIFO read/modify/write receives its storage ACK.
The previous values belong to the same serialized read as the physical mutation;
only changed documents are written. `SettingsPersistenceCapability` uses this
in-memory receipt for its existing semantic changed-key metadata rather than
reading settings twice. `SettingsStore.set` keeps its changed-key array API.
Key-material reads/validation still precede document writes, and local caches
advance only after all required document and key writes succeed. Partial
durability still rejects and follows the existing SettingsService rehydration
contract; no cross-backend atomicity, persisted receipt or new recovery path is
introduced.

### Current settings and development profiles

`SettingsService` hydrates canonical settings through the existing serialized
read boundary without a pre-hydration mutation. The persistence capability
validates present filter settings on both reads and writes; only absent keys
may receive documented initialization defaults. Retired settings are not
interpreted, erased, or converted by ordinary reads or startup.

Every present settings field uses its existing domain shape contract, including
solar-location profiles, protection preset catalogs/assignments, Sentinel stay
decisions and the boolean anchor flag. Domain hash lists contain unique canonical
SHA-256 base64url digests; goal hash maps contain those digest keys and positive
integer minute values. `domainHashing.js` owns those pure hash collection
validators. The unused `engineState` key has no current producer or contract and
is not admitted into settings documents.

`src/platform/storage/settings/settingsStoredValueContract.js` validates those
values at physical settings I/O. `storageKeyRegistry.js` owns only document/key
topology and structural admission; lightweight boot readers do not load the
domain normalizers through that registry.

Development profiles carrying incompatible settings must use
`docs/operations/runbooks/pre-release-development-profile-reset.md`. That
explicit profile reset is the only development cleanup path; hydration failure
never authorizes an automatic reset or a per-key rewrite. Historical exports
remain untouched and must meet the current import contract.

### Adaptive filter data shapes

`filterSettings.blur`, `filterSettings.saturation`, `filterSettings.brightness`,
`filterSettings.contrast`, and `filterSettings.colorSaturation` are exactly
`{ isActive: boolean, value: integer 0..100 }`; `filterSettings.textRhythm` retains
the binary `{ isActive: boolean, value: true }` marker. No saved level, band,
compiled physical value, or accumulated adjustment is allowed. Compiled visual
plans carry `strength`, `effectiveStrength`, named `band` and physical `value`
from the settings-domain profile owner. Bootstrap caches retain that compiled
contract and modifier arbitration metadata.
Neither snapshots nor telemetry may round-trip through stored-settings normalization.
See `docs/architecture/runtime/friction-filter-injection-architecture.md` §3.4
for owners and priority rules. Reads and writes reject old or incomplete shapes;
§3.6 requires an explicit development-profile reset for incompatible persisted
settings. Values are never silently substituted or destructively reset on read.

Lens grayscale retains the existing `saturation` key. Its independent media
saturation child writes `colorSaturation`; brightness and contrast keep their
own numeric entries. New settings enable media saturation and brightness while
blur, contrast and independent grayscale default OFF. Existing stored choices
are unchanged. No additional storage owner or mirror is introduced.

## 3) Storage Taxonomy

Furin's daily presentation cap is a small durable operational policy receipt,
distinct from in-flight usage/debt state. `nudge.daily_receipt` has the exact V2
`{ version: 2, dateStr, fullSite, global, sites, siteEnds }` contract, a 1024-entry
bound for each host map and one activity-day retention. `global`, `sites` and
`fullSite` prove actual Furin display, exclusively with
`source: 'actual_presentation'`. `siteEnds[host]` is exactly
`{ runId, presentedAt, renderer, scopes }`: `site_furin` and `budget_horizon`
have `['site']`; `combined_global_furin` has `['global', 'site']`.
The Horizon renderer is reserved vocabulary for P2, not an active presentation
route. One existing serialized nudge writer commits actual Site display plus
its Site end, or actual combined Global display plus its Site end. Combined
Global never manufactures a `sites` display. Typed validation binds the Furin
renderers' run/timestamp evidence and the single actual Site full opportunity.

The typed `FurinDailyReceiptRepository` is accessed through the existing nudge
session lane. Actual shown commits before session state; failed reads/writes
are explicit errors. An absent row is created only by the first actual display.
V1 presence rejects untouched with `FURIN_DAILY_RECEIPT_VERSION_UNSUPPORTED:1`;
no prior session shown markers, fabricated receipts or converter supply V2
evidence. Incompatible development profiles require the explicit full reset.
The receipt is excluded from snapshots, retained by analytics reset and cleared
by full profile reset. Full lifecycle and failure semantics are in
[Furin daily delivery policy](../runtime/furin-daily-delivery-policy.md).

| Data class | Canonical store | Why |
| --- | --- | --- |
| User settings, policy, permissions, theme, locale, small preferences | `chrome.storage.local` | Small, durable, needed at boot, shared across extension contexts |
| Security metadata and secrets | `chrome.storage.local` under isolated namespaces | Durable, small, must be separated from ordinary settings reads/exports |
| Runtime session state, in-flight aggregates, flush cursors, pending work | `chrome.storage.session` | Survives service-worker restarts during the browser session without becoming long-term history |
| Historical stats, event logs, CLSE buckets, caches, large model state | IndexedDB | Large, retention-driven, query/index oriented |
| UI-only convenience state and debug flags | `window.localStorage` | Non-canonical, page-scoped convenience only |

## 4) Canonical Store Split

### 4.1) `chrome.storage.local`

`settings.core.nudgeConfig.goalEnds` contains the independent `site` and `global`
reminder booleans. It is the sole persisted activation owner; the old stored
`enabled` field rejects unchanged. A named `setGoalEndEnabled(scope, enabled)`
command updates one scope inside serialized settings preparation, preserving
the latest sibling preference, presage and episode parameters. Only absent
configuration receives the named default (both scopes OFF). Runtime-only
aggregate activation is derived and never persisted. Settings Protection is
the public editor; the explicitly approved Global installation journey uses
the same contract. Existing `globalCapNotifyOnExceeded` remains a separate
system-notification preference and does not control Furin.

`settings.core.coolingCurve` is the exact preset/four-family-mode/nullable-advanced
contract owned by `coolingCurvePolicy`. Named preset/family/advanced commands apply
against the latest settings inside serialized preparation, then persist the full
validated shape. Preset selection clears advanced parameters atomically. Absence
uses the named default boundary; malformed presence and retired
`globalFrictionLevel` reject unchanged and require the explicit development-profile
reset when incompatible. No legacy conversion or additional curve storage exists.
The curve and derived-cache lifecycle are specified in
[Cooling curve runtime](../runtime/cooling-curve-runtime.md).

Use `chrome.storage.local` for snapshot/KV data only.

Namespaces:

- `settings.core`
- `settings.rules`
- `settings.ui`
- `settings.security`
- `bootstrap.cache_generation`
- `bootstrap.friction`
- `bootstrap.root_visual`
- `progression.state`
- `runtime.profile_reset_lifecycle`
- `meta.storage_schema`
- `keys.security_vault` (one strict local, log-only wrapped or full-wrapped record; no mirrors or retired individual keys)

Rules:

- `stats_hourly` may include `feedHistoryReceipts` for cumulative feed-history
  idempotence and `feedHistoryResetAt` for an analytics-deletion replay fence.
  These are typed extensions of the existing row, not new object stores or
  alternative backends. Receipt absence is valid; malformed/empty presence is
  invalid. Facts and receipts are installed atomically by the normal hourly
  writer; erasure and its empty timestamp-only fence share one clear transaction.
  Receipt membership uses the persisted bucket identity rather than current local
  timezone, and per-host receipt totals cannot exceed the recorded facts. Retention
  and snapshot contracts follow the hourly owner. Daily copies are derived only.

- Values must stay small and boot-friendly.
- Reads should be snapshot reads, not ad hoc key scraping.
- Settings reads for background/content startup must come from this layer plus in-memory cache.
- Cycle reset policy and other user-durable cycle preferences belong here; runtime cycle checkpoints do not.
- The cycle reset-policy owner commits `monitor_cycleSettings` through the serialized
  SettingsService mutation lane and advances its runtime view only from the exact
  committed acknowledgement. A separate runtime repository for the same setting is
  forbidden.
- Artifact-owned durable controls such as `gateConfig`, `nudgeConfig`, and `relaxationSchedule` remain canonical `settings.core` state; they do not move into session storage, rules documents, or derived runtime snapshots. Release V1 defines `relaxationSchedule` directly as the recurring relaxation contract (`intent: relaxation` windows with canonical day ownership). Configured activity is derived only from its non-empty `blocks` array; no independent enabled field exists.
- App chrome preferences such as `app-theme`, `app_language`, `sidebarDisplayMode`, and `zen_render_preset` remain canonical `settings.ui` state and must use the preference/settings command path.
- Security controls such as `masterPasscodeHash`, `requirePasscodeForReset`, and `highSecurityMode` remain canonical `settings.security` state and must use the security settings store/query service.
- Progression-owned durable unlock state belongs to the small `progression.state` local document; large history and stat windows stay in IndexedDB and may be read only as aggregate facts outside hot paths.
- Within one admitted profile generation, ProgressionService alone advances
  `progression.state.updatedAtMs` strictly on each acknowledged durable write:
  `max(event/result time, previous commit + 1)`. It is a logical commit timestamp,
  not a second use-day clock. An absent optional progression row has a stable
  uncommitted zero-time baseline; reads do not mint revisions from wall time or
  persist defaults. Zero creation metadata is not a calendar-use fact.
  The development session's existing `updatedAtMs`
  likewise orders debug selections under the same queue. Dashboard accepts a
  disclosure response only if neither owner timestamp regresses; broadcasts
  carry invalidation and generation, never a competing state payload. The
  current persisted shapes are unchanged. Explicit profile mutation starts a
  fresh generation/page; named QA session cleanup may remove its disposable
  debug row only through generation-checked ProgressionService admission.
- The first-bloom opening receipt is the named true entry
  `completedMilestoneIds['milestone.bonsai.firstBloomOpened']` in that existing
  typed progression document. A valid map without the ID is unopened; malformed
  entries are invalid. The background progression queue alone consumes it after
  a generation-fenced explicit Dashboard command verifies the Bonsai policy's
  canonical full-form day threshold
  eligibility and spent First Vision. Its storage ACK precedes presentation;
  repeated claims cannot replay. No new field/key, schema bump, migration, UI
  storage flag, or derived pending flag is persisted. The normal profile reset
  clears it with progression; tree identity changes do not.
- `runtime.profile_reset_lifecycle` is the durable cross-context profile-mutation
  journal and admission generation. The background `ProfileMutationCoordinator`
  serializes export/reset/import, commits `resetting` before any clear, drains all
  registered writers in producer-before-queue/store dependency order, and alone
  commits `complete` or `failed`. A successful terminal mutation seals the old
  worker locally as `reload_pending`; its response returns an exact handoff
  descriptor. After that response settles, a trusted Dashboard ACK must match the
  durable lifecycle and local gate before `chrome.runtime.reload()`. `failed` remains closed across browser and
  service-worker restarts; only a new explicitly authorized reset/import may
  recover the terminal task, never normal runtime admission.
- Background bootstrap waits at this admission gate before starting any mutable
  runtime owner. Only trusted full-reset and snapshot-import control messages
  dispatch outside full-init readiness, so interrupted workers can reach the
  same coordinator without reopening normal runtime work.
- Full settings dumps from generic callers are forbidden.
- Unknown settings keys must fail validation instead of falling through to any other backend.
- Full export/import and inspector-style snapshots must route through support capabilities, not generic settings query APIs.
- The only raw backend owners are `src/platform/storage/internal/chrome-storage/localArea.js` and store-specific adapters built on top of it.
- Mixed compatibility facades are forbidden; there is no shared `browserStorage.js` seam.

### 4.2) `chrome.storage.session`

Use `chrome.storage.session` for checkpoint data only.

Keys:

- `runtime.active_tab`
- `runtime.tab_navigation_state`
- `runtime.cycle_checkpoint`
- `runtime.clse_checkpoint`
- `runtime.nudge_debt`
- `runtime.nudge_ack`
- `runtime.pending_nudges`
- `runtime.nudge_lease`
- `runtime.nudge_terminal`
- `runtime.nudge_terminal_outbox`
- `runtime.special_session`
- `runtime.history_cleanup_activation`
- `runtime.tab_evaporation`
- `runtime.settings_propagation`

Rules:

- Session data is the canonical home for in-flight state, not for history.
- `runtime.tab_evaporation` is owned by `TabEvaporationCheckpointRepository` and
  written only by `TabEvaporationManager`. Version 1 holds `policyKey` (the
  normalized scope/timeout signature) and `tabs[]` with `tabId`, `url`,
  `lastAccessed`, `inactiveSince`. It is local session observation data, never
  historical browsing data or removal authority. Absence starts fresh;
  malformed present data rejects. Worker restart preserves observation only;
  current settings and final live tab state must still authorize each removal.
  OFF/scope/timeout changes clear it through the durable runtime adapter barrier.
  A failed clear blocks new sweeps; no RAM or secondary-storage recovery exists.
  Unchanged observations cause no write. Session loss starts a new interval.
- `runtime.history_cleanup_activation` records only completion of the current
  loaded-extension activation catch-up. It contains no URLs or history data and
  prevents ordinary MV3 worker wakes from repeating a full history scan. An
  activation without the optional history permission records a completed
  no-capability decision; `permissions.onAdded(history)` clears that decision
  before the background owner performs a forced full catch-up. A failed grant
  catch-up remains uncheckpointed so the next activation can retry.
- `runtime.cycle_checkpoint` captures a full immutable snapshot per mutation and
  serializes writes through its owner-local Promise tail. A failed write rejects the
  activity caller without poisoning the next queued checkpoint write.
- `runtime.clse_checkpoint` keeps an exact versioned schema for the activity cursor,
  loop-detector maps, aggregation cursors, and a compact ring recovery window. The
  ring payload contains the latest three closed 10-second buckets plus the current
  bucket. A timer-free scheduler admits collector-triggered writes at most once per
  five seconds, while the one-minute heartbeat force-admits a post-settle snapshot.
  Admitted writes capture the latest state when their owner-local FIFO operation
  runs. This explicitly accepts up to five seconds of uncheckpointed mutation and
  omits older in-memory buckets; historical rollups remain in IndexedDB. Only an
  absent key is first-run state, while present null, partial, extra, or non-finite
  data fails validation. Disable/reset/quiesce drain the lane before explicit clear.
- Presence-aware reads distinguish an absent checkpoint from an existing null
  or malformed current record. Active-tab and navigation checkpoints use exact
  validators and serialized full-snapshot write lanes.
- A restored domain-session `pending_commit` is replayed only after canonical
  settings hydration and current collection-admission validation. Policy rejection
  uses the named pending-discard seam before any stats write; it is not reinterpreted
  from the checkpoint's historical collection mode.
- Nudge debt/ack/pending lifecycle data stays in session only; do not mirror it into `model_state`.
- Issued nudge pending entries retain the actual site hostname as an owner fact,
  including global-protocol runs whose day key uses `__global_protocol__`. Phase
  transitions must preserve it; the pseudo-host is never a recovery/outcome host.
- `runtime.nudge_terminal_outbox` is keyed by run id and stores immutable terminal
  facts plus required/completed effect stages, retry counts, and a bounded failure
  code. Terminal mutation and outbox enqueue share one nudge-session write. A
  completed entry is retained for at most seven days and the newest 256 completed
  entries; pending entries are never pruned as if they had succeeded.
- Background bootstrap drains pending nudge terminal effects only after settings
  cache hydration and `runtime.settings_propagation` restore. The outbox does not
  reuse or widen the settings-propagation checkpoint.
- Tab teardown writes its aborted terminal and run-keyed outbox in the same
  session patch, then schedules pending effects only for the affected tab.
  Missing global-run hostname truth, split pending/lease ownership, and a missing
  scheduling receipt are contract failures rather than attribution fallbacks.
- `runtime.special_session` stores only the in-flight isolation timer and temporary allowed hosts. The durable allowed-site list remains settings-owned.
- `runtime.settings_propagation` is the versioned pending/failed outbox for post-commit settings effects. It stores semantic changed keys, enabled stages, retry counts, applied stages, and an explicit terminal failure outcome; it never stores a second canonical settings snapshot.
- Background bootstrap restores a pending propagation checkpoint before normal reconciliation. Successful completion clears it; exhausted retries retain the failed outcome for diagnostics instead of silently abandoning it.
- Data here must be idempotent to rebuild from on service-worker restart.
- Browser restart may clear it; the design must tolerate that.
- The only raw backend owner is `src/platform/storage/internal/chrome-storage/sessionArea.js`.

### 4.3) IndexedDB

Use IndexedDB for history, append/upsert buckets, encrypted diagnostics, favicon/theme caches, and large state.

Active store ids validated against code:

- `stats_hourly`
- `stats_daily`
- `stats_feature_pack_daily`
- `intervention_exposures`
- `intervention_effect_daily`
- `usage_logs`
- `favicons`
- `model_state`
- `zen_artifacts`
- `clse_buckets_60s`
- `clse_buckets_5min`
- `clse_loop_events`
- `clse_baseline`
- `clse_aggression_logs`
- `clse_daily_summaries`

Rules:

- IndexedDB is not queried on the hot path for content blocking, prepaint, or root visual refinement.
- Every store must have an explicit retention or cache policy.
- Every store must have an explicit current contract. The release-V1 topology is
  frozen and has no runtime migrator.
- The numeric database version is not sufficient admission. The exact store set,
  store key path/auto-increment contract, and index set/index contract must match.
  A same-version mismatch is surfaced as
  `INDEXED_DB_RELEASE_V1_RESET_REQUIRED` with its exact `INDEXED_DB_V1_*_MISMATCH`
  reason preserved.
- Ordinary analytics/app reset clears records only; it cannot remove or recreate
  object stores or indexes. Development topology mismatch uses the named
  whole-profile reset runbook, never record clear, read-time repair, or automatic
  DB deletion.
- The IndexedDB connection owner latches a canonical reset-required failure for
  its runtime lifetime. Typed stores must not repeatedly reopen and revalidate the
  same incompatible physical database; the explicit reset plus extension reload
  starts a fresh connection-owner lifetime.
- `versionchange` is terminal for the current JavaScript connection-owner
  lifetime. The manager closes the active handle and any late open result and does
  not reopen the deleted/replaced database from the same live Dashboard or
  background context. Only extension reload creates a fresh admission lifetime.
- The durable reset generation is a reserved `model_state` profile-epoch row.
  Full reset clears model state and commits a new epoch equal to its `resetId` in
  one IndexedDB transaction. The background-owned typed generation initializer
  installs the reserved row with its aggregate, and every later aggregate CAS
  reads that row in the same transaction and requires exact equality with the
  proposal `profileEpoch`. This atomic check closes the TOCTOU gap left between a
  session notification and an actual durable write.

### 4.4) `window.localStorage`

Allowed uses only:

- debug flags
- purely visual UI convenience state local to a page
- temporary developer toggles with no business meaning

Required seams:

- generic page-local helpers route through `src/platform/browser/pageLocalStorage.js`
  - VideoSkip's `entropy_mirage_easter_egg_date` is cosmetic presentation frequency
    only; changing/removing it cannot affect seek enforcement, media control,
    cooldown or admission. It is origin-local convenience state, not a cross-tab
    atomic claim or extension-wide policy. See the friction effect boundary map.
- debug flags route through `src/platform/browser/dev/**`
- theme preference mirror routes through `src/themes/core/state/themePreferenceRepository.js`
- public Zen visual UI state routes through `src/themes/plugins/zen/state/ZenProductionUiState.js`
- the public low-level page-local owner is `src/platform/storage/themes/zen/ZenUiLocalStorage.js`
- development-only Zen workspace state routes through the build-selected
  `@zen-development-workspace-state-entry`; only its dev entry may reach
  `src/themes/plugins/zen/state/ZenWorkspaceState.js` and
  `src/platform/storage/themes/zen/ZenWorkspaceStorage.js`

Additional rules:

- feature modules must not call raw `window.localStorage` directly
- page-local mirrors must stay resettable and must not become a second source of truth
- worker runtime telemetry must keep its immediate UI snapshot in memory and its durable copy in a typed store, not a parallel localStorage mirror
- Zen workspace localStorage is limited to UI-only config/tuning and debug/runtime
  flags. Those values may use defaults only for missing keys; storage
  unavailability, malformed payloads, and boundary I/O failures must surface as
  explicit errors.
- Public builds do not initialize or probe development workspace keys. Public
  Classic/Home uses its production contract, while a development-only mutation
  request fails with a named unavailable-capability error.
- Zen bonsai seed, canonical latent, structure input, generation input,
  `identityRevision`, and lineage are business data and must not be written to or
  bootstrapped from `window.localStorage`.
- normal runtime reads only canonical release V1 ModelStateStore keys and has no retired-key read or cleanup graph
- `src/platform/storage/themes/zen/ZenThemeModelStateContract.js` is the key-by-key release V1 value and snapshot-admission registry for every Zen `model_state` entry. Typed reads and writes validate through that registry; an unknown key, a wrong-key value, or a malformed durable/model record fails before the feature owner receives it.
- `zen_bonsai_presentation_state_v1` is retired from that active registry. Bonsai boot has no durable render-current checkpoint, typed read/write method, snapshot admission, legacy read-through, or per-key cleanup path; development profiles that still contain the retired row use the named whole-profile reset runbook.
- Koi appearance and activity-profile entries are explicitly discardable derived caches. A malformed cache reads as a cache miss for cold rebuild, and those two keys are excluded from snapshot export/import. Every other registered Zen model-state key is durable/model state and must pass its exact V1 validator during snapshot export and import.
- Normal `ZenThemeModelState.getValue()` reads do not accept caller defaults and fail when durable/model state is absent. A feature owner may observe first-run absence only through `getValueForBootstrap()` or persist a canonical initial payload through `bootstrapValue()`; caches must use normal reads and are the only class that maps missing data to a rebuild miss.
- baseline 이전 development data는 `docs/operations/runbooks/pre-release-development-profile-reset.md`의 전체 profile reset으로만 폐기한다
- Zen bonsai artifacts must validate durable entries before hydration, admit only the canonical stored `treeType: 'sakura'`, and must not read through to legacy page-local storage when the durable repository is present but malformed. A save command may default an omitted tree type to `sakura`, but an explicitly unknown type fails loudly.
- Zen current-runtime Main Classic2 uses the single typed ModelState entry
  `zen_bonsai_profile_aggregate_v1` through
  `ZenBonsaiProfileAggregateRepository`. Its exact aggregate contract co-locates:
  the active Sakura identity (`treeSeed`, canonical latent, structure mode/depth,
  topology reference height, canonical `learningProgress` and canopy distribution,
  monotonic `identityRevision`), the identity fingerprint, the current
  `classic2_development_lineage_release_v1` state, and transaction-facing
  `stateRevision`, plus top-level durable `profileEpoch`. Habit observation cannot
  retire, block, or delete candidate topology. Identity revision remains excluded
  from the identity fingerprint.
- A complete identity commit verifies the expected identity revision/fingerprint,
  advances identity and state revision once, and clears the old lineage in the
  same aggregate CAS. A lineage commit is admitted only for that exact active
  identity. The typed repository strictly reads and normalizes, computes its
  synchronous proposal outside IndexedDB, then uses the epoch-aware
  `compareAndSetValueWithProfileEpoch()` typed CAS chain. Conflicts supply a
  strict-normalized next input for at
  most four attempts; exact-reference no-change uses verify-only CAS. Feature
  repositories never bootstrap a missing aggregate; background bootstrap is the
  sole typed first-install owner. Missing aggregate, corrupt state,
  policy/version mismatch, malformed conflict, retry
  exhaustion, stale identity, and same-identity graph drift are errors.
  Transaction-resolver/updateEntry fallback is forbidden.
- The reserved profile-epoch row is the canonical reset generation; the
  aggregate's `profileEpoch` is a stamped fence, not a second epoch owner.
  Revision numbers may restart under a fresh epoch, but no proposal from the old
  epoch may bootstrap or CAS the new aggregate even when numeric revisions match.
- Current Home is the only durable aggregate consumer. First Vision and named
  debug/read-only scenes use isolated in-memory lineage. Experiment edits a
  page-local in-memory draft and performs zero durable writes until `Apply to
  Main`, which commits one complete identity in one CAS. It may not persist
  intermediate seed/latent/structure/learning changes.
- The retired bonsai localStorage business keys and
  `zen_bonsai_classic2_lineage_state_v1` have no read-through, migration, cleanup,
  or dual-write path in normal runtime.
- Zen Sobol cold-start cache may treat only version/profile/TTL mismatches as cache misses; malformed current-version cache payloads must fail loudly instead of being dropped
- Zen main presentation admits only boot-scoped `current` and `first_vision` decisions. It owns no dedicated ledger or period-snapshot store; progression owns first-vision durability and stats/model owners retain their current facts.

Forbidden uses:

- canonical settings
- policy/rules
- current-day aggregates
- historical stats
- durable model state
- anything the service worker must understand

## 5) Target Data Model

### 5.1) Settings Domain

Logical owner: `SettingsStore`

Responsibilities:

- Load/save canonical settings snapshots from `chrome.storage.local`
- Serialize flat-key read-modify-write, whole-document write, and clear operations through one instance queue
- Return physical flat-key changes to `SettingsPersistenceCapability` without exposing document races to callers
- Feed the background settings stack that derives semantic changed keys, canonical `committedItems`, and the in-memory hot-read cache
- Never expose secrets through general settings payloads

Physical model:

- Small namespaced documents, not one giant mixed bag
- Policy/rules and UI preferences are separate documents

### 5.2) Session/Runtime Domain

Logical owner: `RuntimeSessionStore`

Responsibilities:

- Restore canonical in-flight state after service-worker restart
- Checkpoint pending work owned by runtime/session domains
- Hold runtime-only cycle and CLSE checkpoints such as
  `runtime.cycle_checkpoint` and `runtime.clse_checkpoint`
- Keep cycle activity, rollover, and habitual-wake checkpoint writes separate from
  reset-policy settings mutations; normal activity causes no local-settings write
- Hold the versioned `runtime.settings_propagation` post-commit outbox without becoming a settings mirror

Physical model:

- Small checkpoint objects in `chrome.storage.session`
- Idempotent upserts only

### 5.3) Stats Domain

Logical owner: `StatsAggregateStore`

Target model:

- `stats_hourly`: one durable fact-ledger row per local date/hour, including `status: open | sealed`, per-domain facts in `domainsDelta`, and exact domain-pair aggregates in `transitionEdgesDelta`; every domain delta carries explicit background `committedThroughAt`, foreground `activeCommittedThroughAt`, and `collection` checkpoints
- `stats_daily`: one materialized finalized summary row per past day, including `dayData.transitionEdges`, rebuildable from hourly rows only through an explicit materialization or repair boundary

Key decision:

- Do not rewrite the entire day document on every tick.
- Current-hour projection reuses cache-owned domain/edge maps and patches only dirty keys. A materializer-only out-of-band prepared-bucket registration lets the internal store avoid repeating the same full domain validation immediately before `put`. The registration is one-shot after DB acquisition, snapshots top-level keys/references, and revisions reused domain/edge maps so a newer materialization invalidates an older registration. Raw mutation inside those trusted maps is intentionally covered by materializer-only ownership plus the serialized stats save lane rather than another O(K) scan. Unmarked snapshot/recovery/external rows must satisfy the same exact 15-key and nested-payload V2 contract as the read boundary and are never type-coerced. A synchronous `put`/structured-clone failure aborts the whole hourly upsert transaction. IndexedDB still clones the monolithic hourly row, so coarse behavior sources must batch writes rather than commit per observation.
- The system writes hour bucket facts, not day snapshots.
- The current hour is durable as an `open` bucket and overwritten in place only when that hour is dirty, until it is sealed. Closed-hour corrections and clean force drains do not rewrite an unchanged open row.
- `sealed` means clock-closed. A named late mutation may still replace that hour while its calendar day is the active runtime day; after historical finalization, normal runtime no longer mutates the day.
- The runtime prepares a loaded StatsDay once and caches each materialized hour. A scoped mutation rebuilds only its dirty domain and transition-edge keys while top-level hour totals are recomputed; an unscoped caller promotes the hour to a full scan.
- Each stats service-worker lifetime owns one non-persisted 128-bit runtime epoch created by the runtime owner through browser cryptographic randomness. A successful hourly fact write is a numeric stats runtime revision boundary inside that epoch. Any facts read cache created under another epoch or before the current revision is stale, even if its TTL has not expired.
- A day summary is materialized when the day closes. Normal historical reads never create or repair `stats_daily`; any rebuild from hourly rows belongs to an explicit materialization or repair entrypoint.
- A calendar day is the storage partition; an activity day is a query/projection lens over calendar buckets, defaulting to 04:00 local time.
- Temporal reads must declare `basis: calendar | activity`, `grain`, and optional `resetHour`; activity reads use the current cycle reset policy when `resetHour` is omitted.
- Reset-hour changes invalidate derived activity-basis read caches and typed unspent semantic snapshots for affected periods. They do not rewrite the calendar-hour fact ledger.
- Current-policy category totals are not canonical stored facts.
- If category rollups are stored, they are recorded-time helpers or accelerators, not the source of truth for current-policy dashboard projections.
- Dashboard-facing reads must expose their `basis`/`readModel` metadata. The default facts read basis is `durable_hourly_and_daily_facts` with runtime checkpoint overlay disabled.
- Dashboard-facing facts and rules read caches are read-through accelerators only. Reuse requires a cache window that covers the request and a matching stats runtime epoch/revision identity; a larger fresh facts range may serve a smaller range without another IndexedDB read and must preserve both fields. Identity mismatch must trigger a DB read or explicit invalidation error, never a silent empty read model.
- Release V1 hourly rows require domain cursors and `bucketUtcOffsetMinutes` at creation/import. The normal reader never infers a missing domain cursor from `updatedAt` or `sealedAt`; missing or malformed identity data fails validation. The offset must be an integer east-positive value in the inclusive `[-840, 840]` range.
- Normal hourly writes, reads, and the final backup-import check share the same canonical row validator. `dateStr` must be a real local calendar date, while `dateStr`, `hour`, `bucketStartTs`, and east-positive `bucketUtcOffsetMinutes` form one identity that remains valid if the current OS timezone later changes. Domain-map keys are canonical host/IP keys; URL paths, delimiters, whitespace, and JavaScript prototype-reserved keys are rejected.
- Historical runtime reads consult `stats_daily` first. They inspect hourly rows only when the required daily summary is absent, to diagnose orphaned durable evidence without imposing an hourly scan on normal past-day reads.
- The release V1 physical ledger shape is one row per local date/hour with a `domainsDelta` map. Any post-public schema change requires a separate architecture decision; no speculative upgrader is retained.
- Domain transition edge facts live only inside the canonical hourly ledger and its daily materialization. They store domain-pair aggregates, never raw URL paths, titles, content, search queries, or exact navigation timelines. Reads use the shared canonical domain validator; malformed aggregate rows fail the read instead of disappearing from the result.

### 5.4) Event Log Domain

Logical owner: `EventLogStore`

Target model:

- Append-only encrypted rows in the `usage_logs` IndexedDB store
- Appends admitted in the same microtask are encrypted and committed in ordered
  batches of at most 100 rows per IndexedDB transaction. Each `append()` Promise
  resolves only after its batch transaction commits.
- The batching queue is transient scheduling state, not a durability buffer. It has
  no interval/timeout; `flush()`, maintenance, clear, and profile quiesce synchronously
  dispatch pending entries into the serialized operation lane before their own work.
- A non-terminal batch failure rejects the affected append callers without poisoning
  the next queued batch. Release-V1 reset-required failures remain terminal.
- Used for diagnostics and analysis only
- Never used for dashboard totals or hot runtime decisions
- Rolling retention is 7 days, owned by `src/platform/storage/retention/storageRetentionPolicy.js`

### 5.5) CLSE Domain

Logical owner: `ClseStore`

Target model:

- Preserve dedicated CLSE bucket stores
- Keep in-flight collector state in the typed
  `ClseRuntimeCheckpointRepository` session owner. The service restores it before
  collectors start and settles elapsed activity on the shared one-minute alarm;
  service-worker `setInterval` is not a runtime clock or persistence mechanism.
- Keep the versioned online baseline record in the dedicated `clse_baseline`
  store. It persists exact-grain evidence and feature mean/variance only;
  freshness-sensitive status, confidence, and sigma are derived by the behavior
  read contract and are not duplicate stored authorities.
- Normal `clse_baseline` reads reject malformed or predecessor rows. The named
  CLSE baseline reset command is an explicit user-requested replacement and
  writes an empty canonical v2 value without interpreting the invalid row. Its
  typed store transaction also clears all aggression diagnostics tied to the
  replaced baseline epoch.
- The current release-V1 `clse_aggression_logs` record persists explicit baseline decision
  provenance (`reference_mode`, `baseline_status`, `baseline_grain`,
  `baseline_reset_epoch`); the predecessor `baseline_calibrated` boolean is
  rejected. Repository writes are serialized around reset, and the typed store
  transaction requires the referenced epoch to match the current baseline.
  Stale baseline snapshots and stale diagnostic rows fail explicitly.
- Snapshot preflight treats `clse_baseline` plus `clse_aggression_logs` as one
  epoch bundle: zero or one baseline row, no orphan logs, and exact reset-epoch
  equality. Export and import use the repository epoch lane. Merge with a
  baseline clears old aggression rows in the same transaction before inserting
  the canonical imported bundle; an empty CLSE bundle preserves existing state.
- Keep CLSE separate from product stats
- Rolling diagnostic retention is tiered: 60s buckets stay short, 5min buckets stay longer, daily summaries stay longest, and loop/aggression diagnostics remain short. All retention values are owned by `src/platform/storage/retention/storageRetentionPolicy.js`
- `clse_baseline` remains durable until explicit CLSE reset/app reset
- Full app reset enters the build-selected `resetCLSEData` application command,
  never raw repository CRUD from the maintenance coordinator. After terminal
  quiesce, active and public builds both use the typed owner to clear every CLSE
  object store without decoding discarded baseline/history rows or applying
  timestamp/date cutoffs. The active runtime also clears its session checkpoint
  and drains the epoch lane; only fresh-worker bootstrap creates a new baseline.
  Failure is a required reset failure, not a best-effort warning.
- Storage snapshot import enters the build-selected
  `runCLSEStorageSnapshotImport` command around the complete exclusive task.
  Active collection is suspended and flushed first; canonical baseline storage
  reloads into memory and detectors are rebuilt after success or failure.
  Replace without a baseline bootstraps one empty first-run row. Reload/restart
  failures are fatal and diagnosable.
- CLSE writes require runtime precision collection allowance. `clse_enabled` is the service capability flag; `precisionInsightsMode` is the hostname-level collection gate.

Collection-policy settings:

- `dataCollectionMode`: canonical source for domain usage fact creation scope.
- `insightsConsent`: explicit user admission for local collection, not a second scope SSOT. `unset` and `later` deny usage and precision collection; `protected_only` cannot authorize all-sites collection; `all_sites` authorizes only the current `dataCollectionMode` scope.
- `precisionInsightsMode`: canonical source for high-resolution behavior collection scope.
- `precisionInsightsSignals`: canonical per-signal opt-out map for supported precision collection (`clse`, `navigation`). Pointer/input signal ids are retired and ignored at the policy boundary.
- `insightsMode`: analysis/synthesis depth only; it must not infer raw collection scope.

### 5.6) Asset and Large-State Domain

Logical owners:

- `FaviconStore`
- `ModelStateStore`
- `ZenArtifactStore`

Target model:

- Favicons go to the `favicons` cache store
- `FaviconRepository` owns serialized cache mutation, clear revision fencing,
  and post-commit change notifications. Tracking's shared capture coordinator
  retains one running and one latest pending capture per domain, coalesces identical
  requests, and reuses persisted images for 24 hours before visit-driven local-cache refresh.
  Candidate-list changes retain a fresh image when the highest-ranked candidate is
  still its selected source; a new preferred source or different provided image
  bytes trigger capture. Before enqueueing a save, capture invalidates its memory
  entry so concurrent and post-commit notification reads follow the repository's
  mutation tail. Stored images remain readable when refresh fails. `FaviconQueryService` owns bounded
  presentation read caching and invalidation; `TabTimeTracker` owns no image bytes.
  Capture reads only Chrome's extension-owned local favicon cache or bounded
  provided image data. Observed HTTP(S) icon URLs are source identities, never
  remote destinations; Chrome's extension API disables server fallback. Missing
  usable local images keep the visible monogram and never trigger a download.
- Durable user-facing Zen artifacts go to `zen_artifacts`
- Normal-runtime Zen artifact mutation is collection-scoped and generation-bound:
  `ZenArtifactRepository.replaceArtifactCollectionForProfileGeneration()` requires the
  Dashboard-admitted aggregate `profileEpoch`, while `ZenArtifactStore` compares it with
  the reserved `model_state` epoch and replaces removed rows, next rows, and collection
  meta in one `[zen_artifacts, model_state]` transaction. Individual epoch-blind
  put/delete/meta mutation APIs are not active seams.
- Full profile reset rotates the canonical `model_state` epoch before invoking the typed
  `clearForProfileMutation()` artifact owner in the same required task. These operations
  must not be parallel siblings because an old page writer could otherwise commit between
  artifact clear and epoch rotation.
- If a new non-favicon asset cache is introduced, add a named typed store instead of reviving a generic `asset_cache` bucket
- Large Zen/learning/model payloads move out of `window.localStorage`
- `ModelStateStore.compareAndSetEntryWithProfileEpoch()` is the only normal-runtime
  model-state CAS primitive. `expectedRevision: null` means no entry; an existing
  entry with a missing or null `value` is malformed, not absent. The transaction
  verifies the exact reserved epoch and canonical aggregate root before compare or
  write. Epoch-blind `getEntries/get/getAll/set/putEntries/deleteEntries/compareAndSetEntry`
  remain public only as fail-loud retired seams and never open IndexedDB. Domain
  validation, proposal computation, conflict normalization, and bounded retry stay
  outside the transaction in the typed repository. Retired updater-in-transaction
  and direct typed-lineage set paths must not return as fallbacks.
- `ModelStateStore.initializeProfileGeneration()` is the only pristine-store install
  primitive. It validates the canonical aggregate and empty durable koi-roster root
  through `ZenThemeModelStateContract`, then commits exactly the reserved epoch row,
  `zen_bonsai_profile_aggregate_v1`, and `zen_koi_roster_memory_v1` in one
  transaction. During background bootstrap it may materialize only the missing
  koi-roster root of an otherwise valid installed generation; malformed existing
  roster state still fails loudly. Epoch-aware generic get/set/bootstrap/CAS require
  the installed epoch-plus-aggregate gate and cannot create either generation root.
  `ModelStateStore.assertProfileGenerationInitialized()` provides the read-only
  exact-generation proof used by cross-context admission. `ModelStateRepository`
  hard-closes all epoch-blind read/write surfaces. The store
  also rejects aggregate-root mutation through generic set/bootstrap/put/delete or
  epoch-blind CAS; only initialize/reset/exact epoch CAS may mutate that key.
- `ProfileCompatibilityContract` owns one current development-profile baseline and
  the exact reset-only recovery descriptor. `ZenProfilePersistenceDescriptor`
  enumerates the current aggregate, identity, candidate-graph, and spine-condition
  contracts covered by that baseline, while the storage architecture guard pins the
  exact descriptor. A persistence-semantic cutover updates that descriptor and bumps
  the current baseline; it does not append runtime migration code or a historical
  descriptor registry.
- Only a missing pre-baseline field, a lower baseline, or feature rows without the
  reserved header are expected reset states. Current-baseline malformed data remains
  a fatal contract violation, and a higher baseline is a downgrade-blocked failure.
  No owner may infer reset eligibility from a feature-local error code.

### 5.7) Support / Snapshot / Maintenance Control Plane

Logical owners:

- `StorageSnapshotCapability`
- `StorageInspectorCapability`
- app/runtime orchestration services for reset/import/repair

Target model:

- snapshot export/import and inspector query are separate public surfaces
- reset/clear/repair/retention orchestration must be explicit runtime services, not one generic support hub
- platform support capabilities do not directly own runtime cache invalidation or app-wide reset semantics
- storage change subscriptions route through `src/platform/storage/internal/chrome-storage/storageChangeBus.js`, not ad hoc listeners

### 5.8) Recommended IndexedDB Record Shapes

`stats_hourly`

- key: `bucketStartTs` (local date/hour bucket start)
- optional `interventionHistoryReceipts`: Gate aggregate deduplication receipts,
  owned by `interventionHistoryReceipt.js` and committed with `domainsDelta` by
  `StatsAggregateStore`. Each receipt contains `exposureId`, `hostname`, `event`,
  `at`, `shownAt`, `dateStr`, and `bucketStartTs`; identity is `(exposureId, event)`
  within the existing profile lifetime. The source exposure fixes event time and
  bucket identity. Replays cannot use their new arrival time or reinterpret a
  different local-date/hour identity (`INTERVENTION_HISTORY_SOURCE_MISMATCH`).
  Maximum 128 receipts per hour, 24 hours per runtime day; excess fails explicitly
  before aggregate mutation (`INTERVENTION_HISTORY_CAPACITY_EXCEEDED`), with no
  eviction or unreceipted increment. This is a storage capacity, not Gate policy.
  Validators check unique identities, bucket/date membership, and counter coverage.
  Receipt retention/erasure follows the hourly row. The daily read index deliberately
  omits this capability; runtime reconstruction reads receipts from hourly facts.
- indexes: `dateStr`, `dateStr+hour`
- fields:
  - `bucketStartTs`
  - `bucketUtcOffsetMinutes` (east-positive offset recorded for this bucket)
  - `dateStr`
  - `hour`
  - `totalsDelta`
  - `byCategoryDelta`
  - `domainsDelta`
    - each domain delta includes `committedThroughAt`
    - each domain delta includes `activeCommittedThroughAt`
    - each domain delta includes `collection`
  - `sessionsDelta`
  - `switchesDelta`
  - `transitionEdgesDelta`
  - `cursorCheckpointVersion`
  - `status: open | sealed`
  - `schemaVersion`
  - `sealedAt`
  - `updatedAt`

`stats_daily`

- key: `dateStr`
- indexes: `finalizedAt`
- fields:
  - `dateStr`
  - `dayData`
    - `totals`
    - `domains`
    - `byCategory`
    - `switches`
    - `sessions`
    - `transitionEdges`
    - `hourlyRollup`
    - `schemaVersion`
  - `finalizedAt`
  - `sourceHourlyRevision`
- role: materialized summary/read index, never a second source of truth for current-policy projections

`stats_feature_pack_daily`

- lifecycle owner: `StatsFeaturePackStore` (`pruneBefore` / `clearAll` only); exact V1 snapshot import/export remains owned by `IndexedDbSnapshotRepository`
- key: `id` (`dateStr|domain`)
- indexes: `dateStr`, `domain`, `dateStr+domain`, `generatedAt`, `sourceStatsRevision`
- primary fields: `dateStr`, `domain`, `featurePackVersion`, `generatedAt`, `sourceStatsRevision`, `policyFingerprint`, `permissionCoverage`, `source`, `features`, `dataCoverage`, `integrityHash`, `schemaVersion`
- role: dormant exact-V1 snapshot/store compatibility surface; its runtime repository exposes no upsert, point-read, or range-read seam, never a canonical usage fact or fallback read path
- retention: bounded by the same source-fact horizon as stats facts. Any future model-input activation must introduce an explicit writer/consumer and bounded backfill contract rather than reviving rollover-time speculative writes.

`intervention_exposures`

- owner: `InterventionEffectStore`
- key: `exposureId`
- indexes: `dateStr`, `domain`, `shownAt`, `outcomeAt`, `artifactFamily+artifactId`, `dateStr+domain`
- primary fields: `dateStr`, `domain`, `shownAt`, `gateKind`, `artifactFamily`, `artifactId`, `level`, `outcome`, `outcomeAt`, `outcomeLatencyMs`, `recordedOutcomeEvents`, `updatedAt`, `schemaVersion`
- optional `historyFacts`: newly recorded exposures preserve the first fact for
  each of `shown`, `continued`, `left`, `escape_closed`, `reentered` (at most five).
  Each fact holds `at`, `shownAt`, `dateStr`, and `bucketStartTs`. It is installed in
  the same existing transaction as the exposure and daily-effect counter. Duplicate
  events retain their original fact, including the reentry timing anchor; later
  outcomes cannot overwrite earlier event times. New reentry flags derive from
  that fact. Absent capability in retained historical rows remains unknown, not a
  synthesized first-event timestamp. Such rows remain readable/importable; the
  Gate aggregate recorder rejects missing facts (`SITE_INTERVENTION_HISTORY_FACT_REQUIRED`).
- role: short-retention exposure/outcome ledger keyed by one intervention exposure

Gate historical recording has two durable boundaries: exposure/effect, then
hourly aggregate/receipt. They are not one transaction. Explicit retries after a
partial failure use the committed first event and an atomic hourly receipt to
avoid double increments; the dirty-RAM duplicate path must still await its durable
barrier. No automatic replay, outbox, legacy rewrite, or new storage backend is
introduced. The existing profile admission/drain and erase/import owner scopes
these identities; receipts are not authorization tokens and do not replace the
profile generation fence. Retention expiry is not an invitation to replay old
inputs. `tests/interventionHistoryRecording.test.js` verifies the two stores,
snapshot validation, capacity, profile drain, and Gate marker failure boundaries.

`intervention_effect_daily`

- owner: `InterventionEffectStore`
- key: `id` (`dateStr|domain|artifactFamily|artifactId|gateKind|level`)
- indexes: `dateStr`, `domain`, `artifactFamily+artifactId`, `dateStr+domain`, `updatedAt`
- primary fields: `dateStr`, `domain`, `artifactFamily`, `artifactId`, `gateKind`, `level`, `interventionClass`, `resistanceEligible`, `effectivenessEligible`, `severity`, `holdDurationMs`, `levelRecipeVersion`, `artifactVector`, `strategyState`, `intensityVector`, `counters`, `updatedAt`, `schemaVersion`
- role: long-retention daily intervention-effect aggregate updated atomically with exposure outcomes
- outcome invariant: an outcome requires an existing canonical `intervention_exposures` row for the same `exposureId`; missing exposure context is never synthesized from an outcome payload

`usage_logs`

- key: auto increment
- indexes: `timestamp`, `logType`
- retention: rolling 7-day encrypted diagnostics, pruned by the background storage retention job
- fields:
  - `timestamp`
  - `logType`
  - `iv`
  - `payload`
  - `schemaVersion`

`favicons`

- key: `domain`
- indexes: none
- retention: rebuildable cache until explicit clear/reset
- fields:
  - `domain`
  - `dataUrl`
  - `updatedAt`

`model_state`

- key: `key`
- indexes: `updatedAt`
- retention: durable large model/runtime state until explicit replacement or reset
- fields:
  - `key`
  - `value`
  - `updatedAt`
- reserved storage-lifecycle profile-epoch row:
  - key: `__model_state_profile_epoch__`
  - canonical owner: ModelState reset lifecycle, not the Zen feature
  - exact value: `{ kind: 'model_state_profile_epoch', contract: 'model_state_profile_epoch_v1', profileEpoch, developmentBaseline }`
  - bootstrap may initialize it; full reset replaces it with the exact session
    lifecycle `resetId` and current development baseline in the same transaction that
    clears model state
  - the row is the sole runtime compatibility classifier: an expected older/missing
    baseline yields exact reset-only recovery; current malformed content stays fatal
  - feature aggregate rows may stamp this value but cannot mutate the reserved row
  - store owner APIs: `getEntryWithProfileEpoch()`,
    `compareAndSetEntryWithProfileEpoch()`, `resetForProfileEpoch()`; repository
    CAS wrapper: `compareAndSetValueWithProfileEpoch()`
- canonical protected consumption memory entry:
  - key/contract: `protected_consumption_memory_v1`
  - exact value: `{ contract, profileEpoch, stateRevision, model, policyEvidence? }`; the exact
    pure model includes its epoch, applied sequence, through-time, last input,
    bounded memory and duration/coverage accounting
  - owner: `ConsumptionMemoryCheckpointRepository` and
    `ConsumptionMemoryCheckpointContract`; the existing Tracking ledger lane
    serializes `ConsumptionMemoryService` observations and quiescence
  - current optional policyEvidence stores exact lower/upper possible memory and
    its cursor; absent capability preserves the model with explicitly unavailable
    quality until the next admitted observation starts bounds [0,1]; malformed
    bounds/cursor/containment reject. Model, bounds and cursor share the CAS.
  - one ModelState revision/profile-epoch CAS commits model and cursor together;
    synchronous domain-usage consent/settings-version admission runs before put
  - no URL/tab journal, session/localStorage mirror, independent timer or
    history rebuild; a missing admitted row explicitly begins at the current
    boundary, malformed state fails, worker/browser restart restores the row
    - durable and included in exact snapshots; export/merge rejects every durable
      model's installed epoch mismatch before rebasing; import rebases outer epoch,
      model epoch and last-input epoch together; stale writers reject at the typed CAS
  - explicit analytics/runtime erasure writes an empty next revision;
    terminal profile reset/import drains Tracking before its transaction and
    discards the old warm projection; consent disable stops observation/write
      without silently deleting prior admitted history; worker-local continuous
      consent proof in SettingsService bounds joined intervals after enable/hydration,
      including operational exposure, without another persistent consent journal
  - evidence, aging and consumer limits:
    `docs/architecture/runtime/consumption-memory-runtime.md`
- canonical Zen bonsai current-tree entry:
  - key: `zen_bonsai_profile_aggregate_v1`
  - value kind/contract: `zen_bonsai_profile_aggregate` /
    `zen_bonsai_profile_aggregate_v1`
  - value fields: `profileEpoch`, `stateRevision`, `identityRevision`, exact
    `activeIdentity`, `activeIdentityFingerprint`, nullable exact `lineageState`
  - `activeIdentity` fields: Sakura tree type/seed, canonical latent/version,
    structure mode/depth, topology reference height, canonical generation inputs,
    and matching `identityRevision`
  - `lineageState`, when present, must carry that exact identity revision and
    fingerprint; it is not an independently rotatable record
- canonical Feed tempo adaptive-profile checkpoint:
  - key: `feed_tempo_adaptive_profile_checkpoint_v1`
  - value contract: `feed_tempo_adaptive_profile_checkpoint_v1`
  - schema baseline: V2; the stable physical key/contract id does not imply a
    V1 value envelope
  - logical owner: `FeedTempoPersistentProfileService`
  - typed repository: `FeedTempoProfileCheckpointRepository`
  - value fields: exact schema/contract, `profileEpoch`, `stateRevision`,
    checkpoint timestamps, and at most 16 content-free semantic-surface profiles
    with at most 128 timestamped numeric samples each; paged profiles retain
    dwell evidence and continuous profiles retain screenful evidence
  - semantics: cross-session online-learning checkpoint, not a permanent
    baseline or a fixed user truth
  - update contract: compare against the earlier decay-projected profile, then
    commit one eligible unassisted episode with one epoch-aware CAS; conflicts
    retry from the strict current record for at most four attempts
  - decay/policy contract: evidence half-life 30 days, confidence-freshness
    half-life 7 days, adaptive-center movement at most 4% per eligible episode,
    and five-second normative anchor capped to `0.75x..1.25x`
  - missing key is allowed only as first-observation absence. A readable lower
    schema is the one explicit pre-release cutover seam: V1 is deleted under the
    typed repository and relearned because its missing screenful evidence cannot
    be synthesized. Malformed/current-invalid/higher-schema, stale-epoch, and
    unknown-key state fail loudly
  - snapshot behavior: included as current model state and rebased to the
    destination `profileEpoch`; no legacy schema transform is performed
  - forbidden: direct content IndexedDB, `chrome.storage`/`window.localStorage`
    mirror, session-memory recovery, intervention-sample writes, and any
    detector/admission/actuation consumer
- canonical generic feed-topology certificate checkpoint:
  - key: `feed_topology_certificate_checkpoint_v1`
  - value contract: `feed_topology_certificate_checkpoint_v1`
  - logical owner: `FeedTopologyPersistentCertificationService`
  - typed repository: `FeedTopologyCertificateCheckpointRepository`
  - value fields: exact schema/contract, `profileEpoch`, `stateRevision`,
    checkpoint timestamps, and at most 32 per-host/surface certificates
  - persisted topology fields: content-free enum/depth descriptor, exact
    fingerprint, bounded observation IDs/days, counts, decayed evidence,
    certificate revision/timestamps, and invalidation counters
  - certification contract: at least 3 distinct document-session observations,
    at least 2 UTC days, effective evidence at least 2.4 after a 14-day
    half-life, and a 30-day TTL from the latest corroboration
  - update contract: one trusted corroboration or invalidation fact enters one
    current-profile CAS; conflicts retry from the strict winner for at most
    four attempts, duplicate IDs and stale observations are no-change results,
    fingerprint drift starts a fresh learning revision, and learner
    volatility/invalidity explicitly invalidates the matching fingerprint
  - actuation admission is not stored: content must restore the certificate,
    obtain three fresh matching live probes at least 750ms apart within the
    ten-second live-proof TTL, and re-probe exact lane/scroller/branch ownership
    immediately before endpoint planning; post-proof validation is bounded to
    2.5 seconds for certified topology and 10 seconds for submitted shadow topology
  - missing key is allowed only as first-observation absence; malformed,
    wrong-version, stale-epoch, and unknown-key state fail loudly
  - snapshot behavior: included as current model state and rebased to the
    destination `profileEpoch`; no legacy schema transform is performed
  - forbidden: DOM node/text/path/selector/class persistence, direct content
    IndexedDB, `chrome.storage`/`window.localStorage` mirror, server lookup,
    session-memory certificate fallback, or a second feed DOM writer

`zen_artifacts`

- key: `id`
- indexes: `theme_artifact_record`, `updatedAt`
- normal mutation owner: `ZenArtifactRepository` ->
  `ZenArtifactStore.replaceArtifactCollectionForProfileGeneration()`
- concurrency fence: exact `model_state.__model_state_profile_epoch__` equality checked in
  the same transaction that replaces the collection and meta
- reset owner: background terminal profile-mutation coordinator ->
  `ZenArtifactRepository.clearForProfileMutation()`, strictly after epoch rotation
- fields:
  - `id`
  - `recordType`
  - `themeId`
  - `artifactType`
  - `updatedAt`
  - `schemaVersion`
  - artifact-specific payload fields

### 5.9) Write Ownership

Only one logical owner may write each domain:

- `SettingsStore` -> `chrome.storage.local`
- `RuntimeSessionStore` -> `chrome.storage.session`
- stats collection runtime -> in-memory working state
- `StatsAggregateStore` -> `stats_hourly`, `stats_daily`, including transition-edge aggregates
- `StatsFeaturePackStore` -> lifecycle prune/clear for `stats_feature_pack_daily`; `IndexedDbSnapshotRepository` -> exact V1 snapshot export/import only
- `InterventionEffectStore` -> `intervention_exposures`, `intervention_effect_daily`
- `EventLogStore` -> `usage_logs`
- `ClseStore` -> CLSE stores
- `FaviconStore` -> `favicons`
- `ModelStateStore` -> `model_state`
- `ZenArtifactStore` -> `zen_artifacts`

Feature modules must go through these owners, not raw storage helpers or retired compatibility seams.

## 6) Write Path Design

### 6.1) Settings Writes

1. UI updates a typed settings command.
2. `src/domains/settings/config/settingsCommandContract.js` supplies canonical key/owner/runtime-delivery/security/ACK metadata, and `settingsDashboardCommandContract.js` derives the Dashboard channel/retry/ACK projection. Dashboard clients, runtime transport, sender/redaction policy, and ACK validation consume those narrow contracts rather than duplicating action or key lists.
3. Background settings owner validates/canonicalizes independent keys through that registry, reconciles cross-key invariants in `settingsCanonicalPatch.js`, and sends the patch to `SettingsPersistenceCapability`.
4. `SettingsPersistenceCapability` computes physical changes while returning only requested semantic keys plus exact `filterSettings.<featureKey>` diffs.
5. `SettingsStore` serializes every settings-document mutation before updating the `chrome.storage.local` snapshot document.
6. `SettingsService` refreshes its in-memory cache/version and returns canonical `committedItems`; transport and dashboard reject an invalid or pending-key-incomplete ACK and apply only this acknowledged payload. Cross-key owner commands run derivation from a deep-cloned canonical snapshot through `commitSettingsMutation` inside this same serialized lane, so a failed prepare callback cannot mutate live cache truth.
7. `SettingsService` builds a post-commit plan and schedules the single `BackgroundSettingsPropagationCoordinator` executor.
8. The coordinator checkpoints pending work in `runtime.settings_propagation`, runs ordered stages with bounded retries, and clears or retains the checkpoint according to the explicit outcome.
9. Protection fan-out succeeds only when the target acknowledgement summary has no failures.
10. Snapshot import, full reset, and derived-artifact repair use
   `SettingsService.runExclusiveExternalSettingsMutation`: the raw mutation and
   immediate cache rehydration stay in the settings lane, a durable full
   reconcile is scheduled before releasing it, and task completion is awaited
   only after the lane is free.

Never do:

- direct feature-level `setLocal({ arbitraryKey: ... })`
- mixed writes to both IndexedDB settings and `chrome.storage.local`
- parallel settings-document read-modify-write paths outside the `SettingsStore` queue
- treating a requested patch as the canonical commit ACK
- a second post-commit effect executor outside `BackgroundSettingsPropagationCoordinator`
- snapshot/reset/repair code that directly chains cache refresh, bookmark sync,
  runtime-adapter sync, managed-script sync, or protection broadcast

### 6.2) Stats Writes

1. Runtime events update a request-scoped stats projection.
2. The same mutation boundary awaits `statsHourlyProjectionCommitter` and upserts dirty closed hours plus the current local date/hour as durable `stats_hourly` rows. The collector supplies per-hour dirty domain/transition-edge scopes; legacy or unscoped callers deliberately trigger a full scan.
3. When an hour closes, the same `stats_hourly` row is replaced with `status: sealed`.
4. When a day closes normally, `finalizeHistoricalDayFacts` atomically commits the sealed hourly rows and one `stats_daily` row. The dormant feature-pack store is not part of this hot path.
5. Raw behavior/intelligence logs are optional parallel writes to `usage_logs`.

Rollover ordering is explicit: settle the previous foreground ledger and active domain session, force-finalize that day, load the requested new day, then prime the new foreground/session cursors. Concurrent date requests re-check the runtime date after every shared load or rollover promise; the runtime never rolls backward.

Cold-start orphan recovery is a narrower write seam than normal rollover. `readHistoricalMaterializationDateIndex` discovers candidate dates in one readonly hourly+daily transaction through the `stats_hourly.dateStr` index's `nextunique` key cursor, the `stats_daily` primary-key range, and the existing `stats_daily.finalizedAt` index's key-only cursor. The cursor validates both the canonical date primary key and a primitive finite-number `finalizedAt` index key; a daily primary key without that exact marker is an explicit corruption failure rather than a trusted finalized day. Normal finalized dates therefore do not clone or normalize either store's full payload during worker bootstrap. Only dates present in the hourly key set and absent from the verified daily key set enter the existing strict per-date hourly reader, and those payload reads run serially so a damaged daily index cannot fan out into retention-window-sized concurrent transactions. The repository carries those validated durable hourly rows together with the derived day summary. `finalizeRecoveredHistoricalDayFacts` re-reads and compares those rows inside the hourly+daily transaction, leaves existing `sealed` rows untouched, rewrites only rows requiring the `open → sealed` metadata transition, and inserts the missing `stats_daily` marker. It must not re-expand the day projection or rewrite every hourly row; a concurrent hourly change or an already-present daily marker is an explicit failure.

Day-finalization rule:

- past days must become immutable `stats_daily` records
- "today" must never be persisted by repeatedly overwriting the finalized daily store
- if a day is re-finalized for repair, it must replace only that day's row and update `sourceHourlyRevision`

Why this is the target:

- avoids full-day overwrite amplification
- reduces repeated recomputation
- makes worker restarts recoverable
- keeps historical reads fast

Runtime memory rule:

- service-worker memory may cache or project the current day, but it is not the canonical facts store
- dirty-hour state means "not yet durably committed" and carries the union of changed domain/transition-edge keys. It should be cleared only after the relevant hourly rows are written; concurrent mutations retain their merged scope through the next save loop.
- suspend-time flushes are best-effort only and must not be the primary durability boundary
- default dashboard facts queries read durable facts only; a runtime-memory overlay is unsupported unless a separate Active spec and typed query seam are introduced
- storage inspector ledger reads are diagnostics/audit reads; dashboard product projections must read through the stats facts query contract above
- runtime-health session storage is a coalesced diagnostic mirror, not a fact ledger. Repeated successful saves persist as one latest trailing snapshot within five seconds; force saves, failures, and profile-mutation quiesce persist immediately and absorb any pending tail.

### 6.3) Cache And Theme Artifact Writes

1. Validate payload size and shape before persistence.
2. Upsert into the typed store that owns the concept, such as `favicons` or `zen_artifacts`.
3. Apply the store-specific retention/reset policy. Rebuildable caches may be evicted, while user-facing theme artifacts stay durable until explicit delete/reset.

## 7) Read Path Design by User Journey

### 7.1) Content Script / Early Apply / Blocking Decision

Source of truth:

- in-memory settings cache
- `chrome.storage.local` bootstrap/settings snapshot

Must not do:

- IndexedDB read
- raw log query

### 7.2) Popup / Dashboard Overview

Source of truth:

- past days: `stats_daily`
- today/activity day: `stats_hourly` rows, including `open` current-hour and `sealed` closed-hour buckets
- service-worker memory/runtime checkpoints must not be overlaid onto dashboard facts queries

Result:

- instant summary without scanning logs

### 7.3) Dashboard Day Detail

Source of truth:

- finalized day: `stats_daily`
- today's detail: `stats_hourly`

If hourly charts are needed:

- read hourly rows for that single day only

### 7.4) Diagnostic / Analysis Panels

Source of truth:

- `usage_logs`
- CLSE stores

These are lazy, opt-in reads. They are not product hot paths.

### 7.5) Backup / Restore / Support Export

Source of truth:

- `storageSnapshotService`
- background support inspector / repair actions

Rules:

- durable export must include canonical `chrome.storage.local` documents plus IndexedDB durable stores
- runtime session checkpoints are excluded from normal backup because they are rebuildable in-flight state
- every backup uses the bounded `entropy-encrypted-storage-snapshot` V1 envelope;
  the complete settings/security, progression, keyring and durable IndexedDB
  payload is encrypted under an independently supplied strong backup passphrase
- vault and backup cryptography share fixed PBKDF2-SHA256 600,000 iterations,
  fresh random 16-byte salt/12-byte IV, AES-256-GCM with 128-bit tag and header AAD;
  canonical version/encoding/size checks precede derivation (32 MiB backup limit)
- `preflightStorageSnapshot` authenticates the backup and every log record,
  validates current-only settings/progression/IndexedDB shapes, and prepares the
  imported keyring through `KeyMaterialRepository.prepareRestoredVault` before
  profile quiescence. Omitted `restorePassphrase` selects canonical automatic
  local mode; an explicitly supplied value must satisfy the strong passphrase
  contract and prepares the wrapped mode. Empty, null or weak values never select
  local mode. The independent backup passphrase remains mandatory in both modes
- prepared plaintext remains in a module-private WeakMap behind a one-shot
  capability; no runtime response or persistent cache contains that plaintext
- restore supports only exact `replace`; merge would mix event logs protected by
  different keys. Plaintext legacy envelopes and secret-opt-in modes are rejected
- Settings document preflight uses `settingsStoredValueContract` just like typed
  IO. Unknown/retired/misplaced keys and malformed present values reject before
  any lifecycle mutation. Null denotes absence; an empty object remains present
- every IndexedDB preflight validates and copies the current envelope and rows;
  admitted object identity never substitutes for validation. The background
  owner captures its private input before asynchronous admission
- destination keys are installed only through the canonical prepared key-record
  owner, preserving the authenticated source AES/domain/CLSE keyring. No fresh
  data keys are generated during restore. The portable encrypted V1 format is
  unchanged and contains no source device protection mode or local vault record
- trusted session keyring state is cleared during installation and terminal
  runtime cleanup. Local restore returns `vaultState: unlocked`, `vaultMode: local`
  and the next worker admits the persisted local record automatically. Optional
  passphrase restore returns `vaultState: locked`, `vaultMode: passphrase` and
  requires that phrase after the terminal worker reload. Neither result resumes
  the old runtime or bypasses the Dashboard response ACK and profile lifecycle
- cross-backend commit remains an explicit saga: validation is all-or-nothing,
  while commit-time failures surface through the terminal profile lifecycle
- store-level import/export code must stay behind a single snapshot service instead of feature-local ad hoc backup paths
- diagnostic inspector reads must stay extension-page-only and summarize storage instead of dumping raw rows into normal UI
- repair actions must run through background with the same destructive-action authorization policy as reset/export/import paths
- non-terminal mutations outside typed settings patches must run inside
  `SettingsService.runExclusiveExternalSettingsMutation`; explicit no-change
  repairs rehydrate without a version bump or fan-out, and partial mutation or
  hydration failure schedules full reconciliation before surfacing
- full reset and snapshot import instead require terminal profile-mutation
  quiescence, then run inside `SettingsService.runExclusiveTerminalSettingsMutation`.
  The callback still declares `{ settingsChanged, result }`, but the old worker
  does not rehydrate settings or create a post-commit propagation task. It must
  be a synchronous owner function that immediately enters the first downstream
  terminal owner and returns the resulting promise chain; native `async` owners
  are rejected before invocation so they cannot re-enter SettingsService and
  self-deadlock
- before terminal settings replacement, the settings propagation participant
  drains its active stage and clears `runtime.settings_propagation`. Snapshot
  runtime-session cleanup may then remove the complete session set; fresh-worker
  bootstrap owns the next settings hydration and propagation lifetime
- snapshot export validates the reserved profile-epoch row but never serializes
  it as portable theme data. If a bonsai aggregate exists, its stamped
  `profileEpoch` must exactly match that row or export fails loudly. Any physical
  feature row, including a snapshot-excluded discardable cache, requires the
  reserved epoch; an epochless cache-only store is not treated as empty export.
- every encrypted replace snapshot import is a profile-generation replacement. Pure
  preflight finishes before the background owner commits
  `runtime.profile_reset_lifecycle=resetting`; that lifecycle's `resetId` then
  becomes the required destination epoch. The source snapshot epoch is provenance,
  not destination concurrency authority.
- before either backend mutates, the background composition factory prepares one
  canonical bonsai aggregate stamped with the destination epoch. The storage
  layer validates that payload but never synthesizes a seed or identity itself.
- the IndexedDB import transaction always writes the reserved destination epoch
  and one aggregate atomically. Aggregate priority is: imported aggregate rebased
  to the destination, otherwise a valid existing merge aggregate rebased to the
  destination, otherwise the prepared canonical aggregate. Every merge reads and
  validates all existing `model_state` rows before replacing the epoch, rejects
  unknown/malformed durable rows, any epochless feature row, or an installed epoch
  whose aggregate is missing, and explicitly deletes discardable caches. Prepared
  aggregate selection is legal only for replace or a physically pristine merge
  destination. Pure preflight derives every exact V1 store's canonical `keyPath`
  from the schema and rejects duplicate primary keys before opening IndexedDB,
  including duplicate aggregate rows. Import never installs an epoch by itself.
  Snapshot runtime-session cleanup runs only after the propagation participant
  has drained and cleared its checkpoint, so it removes the complete session
  set. `runtime.profile_reset_lifecycle` is outside that cleanup because it is a
  durable local control record and is never portable snapshot data.
- successful snapshot import commits durable `complete`, seals the old worker as
  local `reload_pending`, and returns the exact handoff descriptor. The mutation
  handler never reloads. Once its response Promise settles, the Dashboard sends
  the unchanged descriptor through `PROFILE_MUTATION_RESPONSE_ACK`; only the eager
  trusted ACK path may revalidate the durable/local fences and call
  `chrome.runtime.reload()`. The quiesced JavaScript lifetime is not reinitialized
  in place. Failed import commits `failed`, leaves profile writes closed, and
  requires an explicit retry or full reset.
- full app reset commits `runtime.profile_reset_lifecycle=resetting` before the
  first clear. Cross-context writers close admission and drain their current write
  tail against that generation before destructive phases begin. A failed reset
  commits `failed` and must not silently reopen admission.
- rejected initial `resetting` write acknowledgements do not prove whether the
  write committed. The lifecycle repository attaches an owner-scoped attempt
  receipt; the coordinator closes and drains its runtime gate and all participants,
  then re-reads the journal. It may acknowledge a new `failed` fence only when the
  entire observed record equals the attempted record or its exact predecessor.
  Any drift rejects reconciliation without overwriting the observed journal.
  The original error remains primary, and the coordinator's lifecycle-write
  diagnostic receipt retains all drain/quiesce/reconciliation failures. Without
  an acknowledged failure fence, the old lifetime remains closed and requires
  reload. Pre-write validation, read, and admission errors carry no attempt receipt
  and do not terminate an otherwise open runtime.
- the nonportable `worker_runtime_events` diagnostic cache has one background
  writer, `WorkerRuntimeEventCapability`. Its fixed-key trusted transport and
  injected background-local port both use the common runtime gate, exact durable
  profile-generation admission, and the typed store's FIFO. Producers capture one
  generation before debounce and never rebind it at flush. Both full reset and
  snapshot import cancel pending telemetry persistence, drain admitted operations,
  and use the capability's mutation-only clear. Late requests from the retired
  lifetime cannot recreate the cache; persistence failures remain visible in the
  memory diagnostic stream and status snapshot.
- an open lifecycle whose ModelState header reports an expected old/missing development
  baseline can still reach the eager `RESET_APP_DATA` control action after failed normal
  initialization settles. This is a user-authorized full reset, not automatic boot
  recovery. Once the lifecycle closes, the request must use the exact observed reset id.
- Dashboard generation readiness also awaits strict SettingsService hydration
  between durable generation checks. Model readiness alone cannot acknowledge a
  settings-ready Dashboard. The physical validator brands current-contract
  failures for `settings.core`, `settings.rules`, and `settings.ui`; only these
  owned errors produce an exact `settings_profile_recovery_v1` descriptor and a
  reset-only surface. Message/code pattern matching does not classify failures.
  The trusted response consumer validates the descriptor and matching outer code
  before recreating its owned error receipt. The terminal reset lane never
  rehydrates the broken settings. `settings.security` corruption offers no such
  descriptor: authentication still requires its canonical security read, and the
  development-profile reset runbook owns explicit physical recovery.
- the model-state clear phase, reserved durable profile-epoch write, and prepared
  canonical bonsai aggregate use one IndexedDB transaction. The new epoch is the
  reset lifecycle's exact `resetId`. There is no committed epoch-without-aggregate
  state in which an old or restarted runtime may synthesize another identity.
- every Zen generic model read/write owns one immutable context generation lease.
  Its get/set/delete and insert-if-missing bootstrap compare the reserved profile
  epoch and canonical aggregate root in the same IndexedDB transaction. A
  first-run `null` physical epoch is never admissible to generic operations;
  background bootstrap must first run the typed profile-generation initializer.
  A partial root requires an explicit reset.
  A lease captured while admission is closed is permanently rejected, and a
  stale context never adopts the latest epoch.
- bonsai aggregate reads and CAS validate the reserved IDB epoch against that same
  lifecycle lease. An aggregate/IDB pair from one generation cannot become READY
  while generic Zen state is fenced to another generation. Dashboard/theme runtime
  has no aggregate bootstrap mutation. Missing aggregate in any physical state is
  `ZEN_BONSAI_PROFILE_AGGREGATE_DISAPPEARED`.
- after a successful mutation response, the extension runtime reloads only from
  its exact trusted post-settlement ACK. The old background never creates another lazy Zen model owner; only fresh-worker
  bootstrap constructs an owner for the completed generation. No new generation
  lease is given to an old in-memory learning model or pending timer.
- Dashboard feature runtime mounting is admission-gated. A `resetting` or `failed`
  lifecycle mounts only the passcode-authorized recovery control surface; it does
  not mount feature timers and cannot enter an ErrorBoundary reload loop.
- An open lifecycle alone is not Dashboard generation readiness. The background
  bootstrap publishes a dedicated settlement barrier immediately after its sole
  atomic generation initializer finishes; that barrier is ordering only and never
  generation authority. After the barrier, a trusted request captured by the
  shared runtime gate must prove the requested lifecycle generation, reserved IDB
  epoch, and canonical bonsai aggregate in one readonly invariant check and then
  recheck lifecycle admission. Only the exact ACK permits the Dashboard generation
  lease and Zen repository bind. A failed first initializer settles only that
  worker's ordering barrier. Successful reset/import recovery seals and reloads
  the old worker; a fresh worker creates a new barrier and judges readiness from
  current durable truth.
- full app reset divides required clears into ordered phases. Each phase drains
  all sibling promises with `Promise.allSettled` before a named phase failure is
  surfaced, so no orphaned late clear may run after CLSE/stats/settings recovery.

## 8) What Must Not Survive the Refactor

- Generic `DataManager.getLocal()` / `setLocal()` as the business-data entry point
- IndexedDB-backed settings as the main settings store
- whole-day stats overwrite on every save
- feature modules writing business data directly to `window.localStorage`
- dashboard totals computed from raw encrypted logs

## 9) Release V1 Baseline

Current baseline

- this document is the authoritative storage target
- typed stores exist for settings, runtime session, keys, model state, and stats aggregates
- canonical settings live in `chrome.storage.local`
- current-day open-hour facts and finalized stats live in `stats_hourly` and `stats_daily`
- generic `DataManager` has been retired from app code
- durable backup/restore flows now center on `storageSnapshotService`
- runtime entry points for support backup/restore are `EXPORT_STORAGE_SNAPSHOT` and `IMPORT_STORAGE_SNAPSHOT`
- import must run through background so buffered writes are flushed before restore and runtime caches can be re-hydrated after restore
- import and full reset now use the exclusive external settings mutation seam;
  their settings effects are executed only by the durable propagation coordinator
- hidden Tools support mode now reads `GET_STORAGE_INSPECTOR_SNAPSHOT` and executes guarded repair tasks through `RUN_STORAGE_SUPPORT_ACTION`

Remaining completion work

- keep feature-local persistence behind typed stores only

## 10) Refactor Guardrails

1. No new business-data writes to `window.localStorage`.
2. No new settings keys in IndexedDB.
3. No new feature code may import raw storage helpers directly.
4. No code may reintroduce a mixed low-level storage facade that combines local/session/listener ownership.
5. All new stores need retention/contract/index notes in their module header.
6. Release V1 runtime must not contain IndexedDB upgrade branches, old-key read-through, previous-shape normalizers, compatibility cleanup, or automatic database deletion. A public V2 requires a separate architecture decision.
7. The release-V1 object-store/index topology is frozen. Store additions,
   removals, key-path/auto-increment changes, and index set/contract changes
   require that V2 architecture decision; they must not be shipped under the
   existing numeric version `1`.
8. Zen `model_state` additions must first add one canonical key, one V1 value validator, one durability class, and one snapshot-admission decision to `ZenThemeModelStateContract.js`; feature code and snapshot code may not infer those policies independently.
9. Settings document mutations must remain serialized across flat writes, document writes, and clear.
10. Post-commit settings work must use the strict `runtime.settings_propagation` checkpoint owner; memory-only retry queues and settings-document mirrors are forbidden.
11. External/full-document settings mutation, settings-key reset, and hash-artifact
   repair must share the SettingsService mutation lane and must not implement a
   manual post-mutation fan-out.
12. Settings command/key/ACK facts must have one domain-owned declarative registry. Client wiring, message sender scope, redaction/write-ACK policy, transport request construction, and ACK validation must derive from it; a second wrapper registry or broad untyped settings facade is forbidden.

## 11) Success Criteria

- protection/runtime hot paths depend only on local snapshot state
- the current day is recoverable after service-worker restart
- historical dashboard reads never scan raw logs
- day-level overwrite writes are gone
- settings are no longer canonical in IndexedDB
- large Zen/model state is no longer canonical in `window.localStorage`
- every store has retention and exact release V1 contract rules
- `EntropyDB` and snapshot export/import each accept version `1` only
- same-version V1 store/index contract drift fails as a named whole-profile reset
  requirement; ordinary record clear is never presented as topology repair
- malformed/wrong-contract data fails loudly; only missing current keys may bootstrap

## Dashboard presentation receipt

`presentation.dashboard_boot` is a chrome.storage.session presentation checkpoint
owned by `DashboardBootPresentationStore`. Missing means no completed presentation
in this browser session; present must be exactly `{ version: 1, ensoCompleted: true }`.
Completion selects the 2200ms repeat animation instead of the 3300ms initial
animation (both include brush hold); it never suppresses animation. Reduced
motion remains static. Browser/extension session reset and full reset clear it;
portable snapshots exclude it. The retired local-area receipt is not read,
migrated, or used as a fallback. First Vision remains independent.

## Shared intervention checkpoint (2026-09-09)

The same record now permits optional `exposureWindow` with exact shape
`{ version: 1, startedAt, updatedAt, intervals }`; each interval is exactly
`{ startedAt, endedAt, kind: 'presented' | 'uncertain' }`. The admission service
alone commits it together with lease/recovery changes. First lifecycle commit
starts coverage; absent capability is unobserved and reads never initialize or
backfill it. This preserves already-valid owners without a legacy read or a
runtime migration. Invalid presence rejects. One hour / 256 disjoint intervals
bound retention; trimmed time is unknown. A passive committed read supplies
the latest Tracking-receipt overlap without reconstructing stats, writing a
second checkpoint, or using IndexedDB in a blocking decision. Complete evidence
and clock semantics are in `docs/architecture/runtime/intervention-admission-runtime.md`.

`InterventionAdmissionRepository` is the typed owner of `runtime.intervention_admission`
in `chrome.storage.session`. `InterventionAdmissionService` is its only domain
writer. The versioned state contains the existing admission kernel, one ordinary
lease, mandatory isolation owners and the latest exact terminal identity. Recovery
is 45 seconds after actual presentation ends. Settings application and document
replacement do not reset it; browser/extension session reset can. Absent state
initializes a browser session; malformed persisted state fails explicitly. There
is no localStorage mirror, second timer authority or queued candidate store.

The same admission checkpoint supports a goal-owned feed endpoint with final
kind `site_furin` or `global_sentinel`, exact `source: 'goal_feed_horizon'`,
matching `purpose: 'site_goal' | 'global_goal'`, `manual: false` and initialized
`endpointAttachedAt`, `boundaryPresentedAt`, `finalPresentedAt` timestamps.
`presentedAt` starts at actual boundary encounter; final Furin paint separately
sets `finalPresentedAt`. Only the final display grants Furin reflection credit
or destructive conclusion authority. Ordinary owner shapes are preserved;
missing/invalid goal fields reject without a read-time conversion. No new
storage row or durable Horizon log is introduced. Furin's existing session
pending map gains the exact `entry_waiting` phase through its serialized writer;
this owned wait is distinct from dispatch timeout and daily actual-display
receipts, and ends only through existing exact run/tab cancellation or paint.

P1-B automatic Furin owners and pending entries retain the exact `goalBinding`
V1: key/run/tab/document/profile identity, host/day/reset hour, purpose/covered
scopes, covered Site/Global target milliseconds and the relevant-policy
signature. Missing or invalid present bindings reject without stamping old
pending work. Every phase update retains that original binding. The same pending
map's `entry_cancelling` phase closes final presentation while exact admission
and document cleanup is retried; it cannot expire into repeat permission or
transition to presented/completed. Only this phase carries required canonical
`cancellationReason`, fixed by its first serialized transition and reused by
retries/concurrent revalidation through an exact binding/cause receipt. Missing
or invalid cause on a present cancelling entry rejects untouched; presence on
another phase also rejects. No legacy fill, separate cache or new storage key
is allowed. Generic dispatch/producer abort cannot remove this checkpoint before
exact cleanup completes. Producer cancellation ACKs are explicitly non-terminal.
The invalidator's named completion reuses the existing full abort transaction
to atomically preserve terminal/debt/outbox cause and then schedule existing
terminal effects. New bound terminal metadata may retain that
binding and the real reason. Older unbound terminal metadata grants no policy
or delivery authority and is not a migration source.

The host/day `goalEndSummary` is an ephemeral strict read DTO. The existing
typed session read and durable daily read do not acquire a mutation lock or
write defaults. Actual durable receipts outrank transient session evidence.
The dashboard reads the projection through the runtime snapshot; it adds no
storage key, history log, admission authority, time accumulator or daily writer.

See [intervention admission](../runtime/intervention-admission-runtime.md) for
reservation expiry, lost-document handling and the observable first-paint limit.

### Gate entry approval session checkpoint

`GateEntryApprovalRepository` is the typed access owner of
`runtime.gate_entry_approval` in `chrome.storage.session`.
`GateRuntimeStateOwner` is its sole business writer. The exact V1 shape is
`{ version, decisionAt, sessionId, approved, observedAt, awaySince }`.
Absence means no explicit entry approval in this browser session; malformed
presence and IO errors fail explicitly. There is no settings/local/IDB mirror,
legacy host-pass read, periodic write timer or analytics history. Owner-serialized
writes preserve the last decision identity after expiry to reject replay.
The existing Tracking tick and browser event lanes drain through the existing
profile mutation gate before session reset. See
`docs/architecture/runtime/intervention-admission-runtime.md` for policy.

### Gate return lock session checkpoint

`GateReturnLockRepository` is the typed access owner of
`runtime.gate_return_lock` in `chrome.storage.session`.
`GateRuntimeStateOwner` is its sole business writer, through
`gateReturnLockPolicy.js`. The exact V1 shape is
`{ version, observedAt, present: { [siteKey]: since }, locks: { [siteKey]: { presentSince, leftAt, until } } }`,
keyed by base-domain site. Absence means nothing is held in this browser
session; malformed presence and IO errors fail explicitly. Turning the return
guard off writes the empty state, so no stale presence can arm a lock later.
There is no settings/local/IDB mirror or analytics history. Browser restart
clears it with the rest of session storage. See
`docs/architecture/runtime/intervention-admission-runtime.md` for policy.
