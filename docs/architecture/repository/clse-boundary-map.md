# CLSE Boundary Map

- Status: Active
- Owner: dashboard Experiment CLSE lab, CLSE settings store, background CLSE message route, behavior CLSE service, CLSE storage repository
- Last validated against code: 2026-10-09
- Path policy: current-only
- Canonical for: CLSE dashboard consumption/control readiness, settings mutation, runtime heartbeat/checkpoint lifecycle, diagnostic queries, baseline commands, and CLSE storage ownership
- Companion to:
  - `docs/architecture/repository/storage-stats-tracking-boundary-map.md`
  - `docs/architecture/repository/settings-command-boundary-map.md`
  - `docs/architecture/repository/background-runtime-boundary-map.md`

## Purpose

CLSE is a diagnostic and behavior-signal subsystem. It must not make failed
runtime queries look like an ordinary disabled state, and it must not bypass the
typed CLSE settings/storage seams just because the dashboard surface is a debug
lab.

The practical reading question is:

```text
Can the dashboard distinguish disabled CLSE, unavailable CLSE runtime,
and failed CLSE storage reads without inventing a second source of truth?
```

## System Flow

CLSE dashboard consumption:

```text
ExperimentHubTab
  -> home readiness: preference + protocol only
  -> experimentLabCatalog section="clse"
  -> ExperimentLabOutlet
  -> CLSELab
       -> status query through CLSELab.sendCLSEMessage()
       -> runtime CLSE message route -> CLSEMessageHandler
       -> CLSEServiceClient / ClseRepository
       -> canonical useCLSEStore control snapshot
       -> controls remain inert while that snapshot is pending/failed
```

CLSE settings flow:

```text
CLSELab
  -> useCLSEStore.setEnabled() / setSensitivityScale() / setAlertCooldownMs()
  -> clseSettingsClient.dispatchClseSettingsPatch()
  -> settingsCommandBus channel "clse"
  -> SettingsService.applySettingsChange
  -> ClseSettingsStore / settings.core document
  -> CLSE service sync from stored settings
```

CLSE diagnostic storage flow:

```text
CLSEService / detectors
  -> ClseRepository
  -> ClseStore
  -> IndexedDB CLSE object stores
  -> CLSEMessageHandler query response
  -> CLSELab logs/personal-baseline/status views
```

CLSE runtime-ingress flow:

```text
AlarmScheduler oneMinuteTick -> CLSEServiceClient.runCLSEHeartbeat()
or runtime message/webNavigation/tab/window/idle callback
  -> capture shared ProfileMutationRuntimeGate generation at listener arrival
  -> runCaptured(exact admission)
  -> CLSE policy check
  -> ring buffer / navigation loop persistence / heartbeat storage tail
  -> response commit or event completion before lease release
```

CLSE worker-restart checkpoint flow:

```text
collector mutation or oneMinuteTick heartbeat
  -> timer-free ClseCheckpointWriteScheduler admission
  -> collector writes coalesce to at most one admission per 5 seconds
  -> heartbeat force-admits one final write after settle/prune/rollup
  -> capture the latest compact ring/activity/loop/aggregation-cursor snapshot
  -> ClseRuntimeCheckpointRepository owner-local FIFO write
  -> chrome.storage.session runtime.clse_checkpoint
  -> fresh worker validates and restores before startAll()
  -> initial idle query and immediate heartbeat share ActivityCollector mutation FIFO
```

CLSE personal-baseline flow:

```text
completed 10s / 60s bucket
  -> same-grain detector comparison
  -> BaselineManager.observeCompletedBucket(grain, bucket)
  -> Huber-bounded feature update
  -> ClseRepository / exact clse_baseline record
  -> clseBaselineStatePolicy grain/evidence derivation at evaluatedAt
  -> buildCLSEBaselineSummary() read-time status/confidence
  -> one getCLSEStatus().baseline DTO
```

CLSE completed-calendar-day flow:

```text
first worker heartbeat or next local completion boundary
  -> settle and persist current 60s / rolling 5min windows
  -> clseDailySummary.completeCLSEDailySummaries()
  -> ClseRepository.getFirstBucket60s() bounded typed cursor
  -> persisted daily-summary rows identify completed dates
  -> read and commit each missing observed local day separately
  -> only after completion succeeds: prune retained source tiers
```

The local day closes for summary purposes five minutes after midnight, when
rolling five-minute windows with a previous-day start have finished. Both source
queries use `[local midnight, next local midnight)`; the next midnight is a
calendar operation, including DST. This remains a calendar diagnostic summary,
independent of the configured analysis cycle boundary.

The summary row keyed by `dateStr` is the durable completion marker. Worker RAM
only suppresses repeated checks after a successful heartbeat in the same local
completion period. A restart discovers existing completion rows and fills holes
from retained 60-second sources, even if no new rollup was produced. Existing
completed rows are not rewritten; failed reads/writes reject the heartbeat and
leave pruning unstarted so the next heartbeat can retry. Successful empty source
queries create no synthetic history. Catch-up is bounded by daily-summary
retention and uses one-row source cursors; it does not load already completed
days' full bucket arrays. Source rows removed by an earlier release's retention
cannot be reconstructed from the longer-lived five-minute tier, which lacks the
required 60-second totals.

## Owner Table

| Concern | Owner | Key files | Output | Forbidden shortcut |
| --- | --- | --- | --- | --- |
| Dashboard workspace | Experiment CLSE lab | `src/apps/dashboard/tabs/experiment/clse/CLSELab.jsx` | status/log/personal-baseline view state reachable while CLSE is disabled | separate CLSE navigation tab, hiding the enable control, or treating failed queries as empty arrays/disabled status |
| Dashboard settings state | CLSE store | `src/apps/dashboard/stores/useCLSEStore.js` | CLSE enabled/sensitivity/cooldown state plus `loadError` | direct CLSE storage reads from the tab |
| Settings mutation | CLSE settings client | `src/apps/dashboard/stores/clseSettingsClient.js` | CLSE settings command result | generic protocol/settings patch from CLSE UI |
| Runtime route | background CLSE route | `src/apps/background/services/runtime/messageRoutes/clseMessageRoutes.js` | routed CLSE message response | constructing the handler without settings/repository owners |
| Runtime command/query | CLSE message handler | `src/domains/tracking/background/CLSEMessageHandler.js` | status, buckets, aggression logs, baseline command result | deferred owner failure or unbounded log query |
| Runtime CLSE status | CLSE service client and status contract | `src/domains/behavior/CLSEServiceClient.js`, `src/domains/behavior/clseStatusContract.js` | disabled or loaded CLSE runtime status with one exact public projection | importing heavy CLSE service when release capability is off or spreading producer extras across the boundary |
| Heartbeat clock | tracking `AlarmScheduler` and background alarm handler | `src/domains/tracking/background/AlarmScheduler.js`, `src/domains/tracking/background/trackingBrowserEventHandlers.js`, `src/domains/behavior/CLSEServiceClient.js` | one shared `oneMinuteTick` dispatch into CLSE | CLSE-owned alarm registration or service-worker `setInterval` as a durable clock |
| Runtime checkpoint | typed CLSE session repository, exact schema, and timer-free write scheduler | `src/platform/storage/runtime/ClseRuntimeCheckpointRepository.js`, `src/platform/storage/runtime/clseRuntimeCheckpointContract.js`, `src/domains/behavior/runtime/ClseCheckpointWriteScheduler.js`, `src/domains/behavior/CLSEService.js` | compact ring/activity/loop/cursor snapshot in `runtime.clse_checkpoint`; latest three closed 10-second buckets plus the current bucket | fallback reads, partial hydration, swallowed writes, persistent timer coalescing, or clear outside the checkpoint FIFO |
| Diagnostic persistence | CLSE repository/store | `src/platform/storage/clse/ClseRepository.js`, `src/platform/storage/internal/indexeddb/stores/ClseStore.js` | typed CLSE bucket/log/baseline rows plus one serialized baseline-epoch write order | direct `dbManager` CLSE CRUD or unfenced baseline/log writes |
| Daily completion | CLSE heartbeat and calendar summary owner | `src/domains/behavior/CLSEService.js`, `src/domains/behavior/clseDailySummary.js` | idempotent per-date summaries recovered from retained source rows before pruning | worker-memory-only completion, multi-day totals under one date, completion after a failed source write, or synthesizing lost 60-second totals from another tier |
| Baseline persistence contract | platform CLSE contract | `src/platform/storage/clse/clseBaselineStorageContract.js` | exact versioned, physically feasible evidence/feature-stat record | persisting status/confidence or detector thresholds as a second truth |
| Baseline lifecycle policy | behavior baseline state owner | `src/domains/behavior/clseBaselineStatePolicy.js` | grain thresholds, feature scale, freshness, status, confidence | duplicating lifecycle math in manager or transport validator |
| Baseline learning/read projection | behavior baseline owner | `src/domains/behavior/detection/BaselineManager.js`, `src/domains/behavior/clseBaselineReadContract.js` | same-grain online update and one camelCase status summary | cross-grain comparison, self-classification, trusting transported derived state, or leaking the persisted row to UI |
| Detection sensitivity policy | behavior detection-policy owner | `src/domains/behavior/detection/clseDetectionPolicy.js`, passed by `CLSEService.js` | exact policy DTO and one monotonic threshold scale for 10s aggression and 60s sustained detection | storing sensitivity on `BaselineManager`, detector-local defaults, or reversing scale semantics between paths |
| Explicit baseline rewrite | CLSE reset command -> `BaselineManager.reset()` -> `ClseStore.resetBaseline()` | `src/domains/behavior/CLSEService.js`, `src/domains/behavior/detection/BaselineManager.js`, `src/platform/storage/internal/indexeddb/stores/ClseStore.js` | one empty canonical v2 row with a strictly advanced epoch and all replaced-epoch aggression diagnostics cleared in one transaction | normal-read migration, shape reinterpretation, baseline-only delete, or a second repair owner |
| Full app CLSE reset | profile coordinator quiesce -> build-selected terminal `resetCLSEData()` | `CLSEServiceClient.js`, `CLSEService.js`, `CLSEService.public.js`, `clseMaintenanceStorage.js` | retiring worker drains the epoch lane, clears every durable CLSE row without decoding it, discards manager memory, and stays closed until extension runtime reload | evaluating discarded baseline evidence, date-range pruning, reloading/resuming the old collector graph, clearing before quiesce, best-effort success, or direct coordinator CRUD |
| Runtime ingress admission | background profile mutation gate -> CLSE client port -> service/collectors | `CLSEServiceClient.js`, `clseProfileMutationRuntimeAdmission.js`, `CLSEService.js`, `collectors/*.js` | arrival-generation capture and one response/event-lifetime lease | per-collector reset flags, post-reset replay, running the collector task after admission rejection, or releasing navigation before loop persistence settles |

## Function Ledger

| Boundary function | Input | Output | Failure / missing-data policy |
| --- | --- | --- | --- |
| `useCLSEStore.initialize()` | optional boot prewarm | CLSE enabled state | invalid or failed status read throws and sets `loadError` |
| `useCLSEStore.refreshStatus()` | none | refreshed CLSE enabled state | invalid or failed status read throws and sets `loadError` |
| `requireCanonicalCLSEControlSnapshot()` | exact boot-prewarm controls | enabled/sensitivity/cooldown DTO | extra or missing control fields fail; this is not a runtime baseline snapshot |
| `requireCanonicalCLSEStatusSnapshot()` | exact CLSE runtime status response | explicit runtime/control/diagnostic projection plus one baseline summary or `null` | missing/extra fields, malformed nested state, impossible lifecycle combinations, retired flat calibration fields, or sustained reference facts that contradict the summary's 60s profile/reset epoch fail |
| `BaselineManager.observeCompletedBucket()` | exact grain and completed bucket | accepted/ineligible update result | verifies `start + grain duration <= evaluatedAt`; low exposure and duplicate/older buckets do not update; future, still-open, malformed, or cross-grain input throws |
| `resolveCLSEBaselineProfileState()` | exact-grain evidence/profile plus `evaluatedAt` | deterministic sparse/forming/stable status and confidence | future evidence and unknown grains fail; no receiver wall-clock reads |
| `buildCLSEBaselineSummary()` | canonical materialized baseline plus `evaluatedAt` | current status/confidence/profile read DTO | status/confidence are derived at the named evaluation time and never read from persisted fields |
| `requireCanonicalCLSEBaselineSummary()` | transported baseline read DTO | defensive clone of the exact DTO | re-derives every profile and aggregate; contradictory evidence, status, confidence components, or overall values fail |
| `createCLSEDetectionPolicy()` / `requireCanonicalCLSEDetectionPolicy()` | current service-owned sensitivity scale | exact `clse_detection_sensitivity_v1` DTO | missing, extra, non-finite, or out-of-range policy state fails before detection |
| `resolveCLSEDetectionThreshold()` / `resolveCLSEPositiveZThresholdBand()` | canonical policy plus positive base threshold(s) | monotonically scaled absolute or positive-z decision thresholds | a larger scale always raises thresholds; descriptive baseline evidence and scores are not rewritten |
| `dispatchClseSettingsPatch()` | canonical CLSE settings patch | settings command result | failures remain channel-visible |
| `prepareCanonicalSettingsItems()` CLSE admission | any submitted CLSE flat setting key | the same requested-key subset after exact control validation | missing keys are used only to complete the validation DTO; malformed submitted values fail before persistence |
| `CLSELab.sendCLSEMessage()` | CLSE message type and payload | validated runtime response | `success:false`, missing response, and invalid response shape throw |
| `CLSELab.fetchData()` | active lab status refresh | validated current status/control DTO | latest status revision wins; partial status DTOs and initial/later failures show error/warning surfaces |
| `CLSELab.fetchDiagnostics()` | selected Logs subsection | validated buckets/events and aggression logs | separate revision/error ownership prevents status polling from clearing diagnostics failures; later polls retain valid rows |
| `CLSELab.enqueueControlCommit()` | sensitivity/cooldown draft at pointer, blur, or keyboard boundary | serialized typed-store write plus canonical status refresh | intermediate range movement never writes; stale commits cannot release a newer draft guard |
| `createClseMessageRoutes()` | boot prewarm, settings patch owner, CLSE repository | route table | missing owners throw at route construction |
| `createCLSEMessageHandler()` | settings patch owner, CLSE repository | handler | unauthorized senders get explicit failure responses |
| `CLSE_SET_ENABLED` / `CLSE_SET_SENSITIVITY` / `CLSE_SET_ALERT_COOLDOWN` | trusted dashboard payload | settings patch through CLSE command owner | malformed mutation payload throws `CLSE_SETTING_PAYLOAD_INVALID:*` before persistence; bounded numeric clamp still applies to valid numbers |
| `CLSE_GET_BUCKETS` | trusted sender | bucket/events DTO | repository errors and malformed event rows return `success:false` with named error |
| `CLSE_GET_AGGRESSION_LOGS` | range/limit | logs DTO | range and limit are clamped; repository errors return `success:false` |
| `runCLSEProfileMutationIngress()` | required capture/run port, exact label, task | task result under one shared-gate lease | capture executes before the first Promise turn; closed/changed generation rejects without invoking the task |
| `runCLSEHeartbeat()` | shared `oneMinuteTick` timestamp | settled collectors, pruned loop state, rollups, baseline flush, and committed checkpoint | rejection propagates to the background best-effort task owner; CLSE does not register another alarm |
| `completeCLSEDailySummaries()` | admitted repository and heartbeat timestamp | persisted missing observed calendar days and successful completion boundary | source/summary failures reject; committed earlier dates remain progress for the next worker; source pruning follows successful completion |
| `ClseRepository.getFirstBucket60s()` | bounded source timestamp range | first validated 60-second bucket or explicit `null` for no source | a one-row IndexedDB cursor rejects malformed records and storage failures; no unbounded bucket materialization |
| `resetCLSEData()` | explicitly authorized full profile reset after terminal quiesce | all six CLSE object stores cleared after their ACKs, plus the active runtime's session checkpoint | uses `clearAllCLSEStorage()` through the typed repository in every build; discarded baseline and row values are not decoded; any clear/flush failure rejects and the runtime remains terminal |
| `ClseRuntimeCheckpointRepository.readOptional()` | registered session key | absent result or frozen exact checkpoint | only `found:false` is first-run; malformed present values reject |
| `ClseRuntimeCheckpointRepository.set()` / `clear()` | exact checkpoint or explicit clear command | completed session mutation | null is not an implicit clear and failed writes reject without poisoning the next FIFO item |

## Recovery Versus Fallback

| Class | Allowed? | Rule |
| --- | --- | --- |
| Release capability disabled | Yes | `CLSEServiceClient` may return an explicit disabled status without loading the lab service. |
| Boot prewarm | Yes | boot snapshot may hydrate known CLSE enabled state; later store reads still own validation. |
| Initial dashboard load error | No fallback | failed status/log reads show an error surface instead of empty debug data. |
| Polling refresh error | Visible degradation | existing data may remain visible, but the last refresh failure must stay visible. |
| Partial CLSE status DTO | No fallback | throw `CLSE_STATUS_RESPONSE_INVALID` / `CLSE_STATUS_INVALID`; do not fill missing sensitivity or cooldown controls from UI defaults. |
| Sparse CLSE baseline | Explicit normative mode | detectors keep the named normative-only policy for their own grain; they do not borrow the other grain or fabricate stable evidence. |
| Malformed/materialized predecessor baseline | No fallback | the typed store rejects it; normal reads do not migrate or reinterpret old threshold/day-count shapes. |
| Malformed CLSE event rows | No fallback | throw `CLSE_EVENTS_QUERY_INVALID_RESULT`; do not stamp missing timestamps with current time. |
| Malformed CLSE settings mutation payload | No fallback | throw `CLSE_SETTING_PAYLOAD_INVALID:*`; do not coerce missing booleans to `false` or non-numeric controls to defaults. |
| Missing persisted CLSE feature flag | Documented initialization default | `ClseSettingsStore` requests the canonical boolean default from `SettingsStore`; a present non-boolean still throws `CLSE_SETTINGS_VALUE_CONTRACT_INVALID:clse_enabled`. |
| Empty bucket/log data | Yes | empty arrays are valid only when the runtime query succeeded and returned arrays. |
| Settings write failure | No silent recovery | store throws, command channel records failure, and the CLSE lab shows the error. |
| Control snapshot pending/failure | Shell-first, inert controls | status/diagnostic UI may render, but enable/sensitivity/cooldown controls stay disabled until `useCLSEStore.loaded`; `loadError` remains visible with an explicit retry. |
| Previous CLSE settings keys | No | release V1 typed stores accept only current settings/security keys. |
| Direct DB access | No | CLSE diagnostics go through `ClseRepository` / `ClseStore`. |

## Current Findings

### F1. Store-level CLSE failure visibility is already explicit

Status: keep.

`useCLSEStore` owns `loadError` and rejects invalid `CLSE_GET_STATUS` reads.
Settings writes go through the CLSE command channel and refresh after failed
writes without pretending the write succeeded.

### F2. CLSE message route owner construction is explicit

Status: keep.

`createClseMessageRoutes()` and `createCLSEMessageHandler()` require the boot
prewarm owner, settings patch owner, and CLSE repository at construction time.
This keeps route setup failures visible before the first dashboard query.

### F3. CLSE lab query failures no longer collapse to empty data

Status: fixed in the 2026-06-29 CLSE tab pass.

The tab now treats failed runtime messages, missing responses, and invalid
bucket/log response shapes as errors. Initial load failures render the dashboard
error surface; later polling failures leave existing data on screen with an
explicit warning.

### F4. CLSE manual actions now surface failed commands

Status: fixed in the 2026-06-29 CLSE tab pass.

Enable/disable, sensitivity, alert cooldown, and baseline reset failures are
shown in the CLSE workspace instead of being caught and discarded. Force
calibration is retired: evidence maturity cannot be changed by mutating a day
counter. Baseline reset is a confirmed destructive action in both the normal
baseline view and the explicit load-error recovery surface; the copy names the
new learning epoch and the atomic removal of its associated aggression
diagnostics before the command can run.

### F5. CLSE status DTO controls are strict

Status: fixed in the 2026-07-01 CLSE status contract pass.

`requireCanonicalCLSEStatusSnapshot()` now owns the runtime status response
shape shared by the background handler, dashboard store, and CLSE lab. A status
response with only `isEnabled` is no longer enough; `sensitivityScale`,
`alertCooldownMs`, initialization state, runtime diagnostics, and the single
`baseline` summary must be present. The contract has an exact outer key set and
explicitly projects the sustained-load, loop, alert, and baseline subtrees; it
does not spread owner extras into the public DTO.

Lifecycle validation follows the service's real transitions. An enabled runtime
that has completed initialization must expose its baseline and live detector
states. A fully inactive, never-initialized client cannot expose a baseline, and
a disabled snapshot cannot claim live buckets or detector state. An initializing
or recovery-state runtime may be enabled before initialization completes, while
a runtime disabled after prior use may retain its learned baseline. These two
valid transitions are not collapsed into an invented `baseline === isEnabled`
rule. Boot prewarm has a separate exact three-control projection and does not
claim baseline truth.

### F6. CLSE event rows no longer get synthetic timestamps

Status: fixed in the 2026-07-01 CLSE event diagnostics pass.

`CLSE_GET_BUCKETS` now validates recent runtime events and persisted loop event
rows before combining them for the dashboard. Missing event timestamps or event
types throw `CLSE_EVENTS_QUERY_INVALID_RESULT` through the existing query
failure response instead of being stamped with `Date.now()` and shown as a fresh
diagnostic event.

### F7. CLSE settings mutation payloads are explicit

Status: fixed in the 2026-07-01 CLSE mutation payload pass.

The background CLSE message handler now rejects malformed setting mutation
payloads before calling the settings pipeline. Missing or stringified booleans
no longer become `false`/`true`, and non-numeric sensitivity or cooldown values
no longer normalize to UI defaults. Valid numeric values still pass through the
bounded CLSE setting normalizers before persistence.

### F8. CLSE baseline has one materialized owner and one read projection

Status: fixed in the 2026-07-12 personal-baseline pass.

The `clse_baseline` record stores exact-grain evidence and online feature
statistics only. Its contract rejects impossible exposure totals, feature
statistics without eligible observations, invalid calendar keys, and evidence
newer than the row. `BaselineManager` compares a completed bucket before
learning from it and applies a bounded Huber update.

`clseBaselineStatePolicy.js` is the single lifecycle-policy owner shared by the
manager projection and read validator. The DTO carries `evaluatedAt`, so
freshness is reproducible after transport instead of depending on the
receiver's clock. `requireCanonicalCLSEBaselineSummary()` re-derives each
profile status and every confidence component, including `overall`, then checks
the aggregate. A zero-evidence profile therefore cannot claim stable/full
confidence, and future evidence fails loudly. `getCLSEStatus()` exposes only
this projection. Persisted thresholds, calibration-day bypasses, duplicate
status fields, and direct manager exports are retired.

The status contract does not validate the sustained detector and baseline
summary as unrelated shape-valid objects. Once a 60-second evaluation exists,
the detector's `baselineStatus`, derived `referenceMode`, `baselineGrain`, and
`baselineResetEpoch` must equal the exact 60-second profile and summary reset
epoch. The serialized baseline-replacing storage lifecycle quiesces the runtime
and recreates its detector state after reloading the baseline, preventing an
old epoch from being transported beside the new summary.

Sensitivity is a prescriptive detection input, not learned personal state.
`CLSEService` owns the current settings value and creates one exact detection
policy for each completed-bucket comparison. Both 10-second aggression and
60-second sustained detection apply the same monotonic contract: a larger
scale raises absolute decision thresholds and positive-z lift thresholds; a
smaller scale lowers them. Evidence-eligibility gates and descriptive baseline
DTOs are unchanged. `BaselineManager` therefore has no sensitivity field or
setter/getter, and changing sensitivity cannot mutate or reclassify learned
evidence.

Normal initialization still rejects malformed or predecessor baseline rows.
The explicit `CLSE_RESET_BASELINE` command is the only rewrite seam: it performs
a typed overwrite with an empty canonical v2 record without reading the
rejected row through as business state or interpreting predecessor fields. The
same IndexedDB transaction clears retained
aggression diagnostics because their decisions belong to the replaced baseline
epoch; this also prevents v1 rows with the retired boolean from poisoning every
strict v2 log query. A rejected initialization promise is not cached, so an
operator reset or a later valid read can recover without restarting the
background worker. Enabled-runtime initialization failures propagate to the
caller, clear the cached init promise, and leave `isInitialized=false`; they are
never converted into a disabled-looking `false`. An explicit reset restarts the
enabled runtime after its atomic rewrite, so the command is a complete recovery
flow rather than a storage-only repair.

Aggression diagnostics persist the exact decision provenance
`reference_mode`, `baseline_status`, `baseline_grain`, and
`baseline_reset_epoch`. The current release-V1 row accepts only producer-valid
combinations: aggression is `bucket_10s`, bounded-adaptive means stable,
normative-only means sparse/forming and carries zero uncomputed z-scores. The
retired `baseline_calibrated` boolean is not accepted because it collapses three
independent contract dimensions into one ambiguous flag.

`BaselineManager` serializes flush/reset mutations to preserve revision and
dirty-state ordering. `ClseRepository` serializes baseline and aggression epoch
writes, while `ClseStore` performs the authoritative same-transaction epoch
check. Therefore an old flush cannot overwrite a reset row, a diagnostic
launched before reset completes before the atomic clear, and a delayed old-epoch
write that arrives afterward fails explicitly instead of being silently
dropped or reinserted.

Portable snapshot export and import join that same repository epoch lane.
Preflight accepts at most one canonical baseline row; aggression rows require
that row and every `baseline_reset_epoch` must equal its `reset_epoch`. The
relationship is checked before IndexedDB is opened and again on export through
the same exact preflight. A merge carrying a baseline replaces the retained
aggression-log set in the same IndexedDB transaction before inserting the
canonical imported bundle; only a snapshot with no CLSE baseline or aggression
rows preserves the existing epoch bundle.

`runCLSEStorageSnapshotImport()` is the build-selected terminal lane around the
complete profile import task. Before it can run, `quiesceCLSEForProfileMutation()`
stops collectors, drains admitted navigation/heartbeat work, flushes manager and
repository lanes, and seals the retiring worker. Import then runs under the same
serialized epoch lane, performs a final flush, discards manager memory, and does
not reload storage or recreate detectors. Import failure remains primary and a
final-flush failure is attached diagnostically; successful mutation is not
reported if that flush fails. Replace without a baseline is bootstrapped by the
new runtime as the canonical first-run empty row. The public build follows the
same terminal no-resume contract without collector ownership.

Full app reset uses the separate terminal `resetCLSEData()` command after the
profile coordinator has quiesced CLSE. Both active and public builds clear all
six CLSE object stores through `clearAllCLSEStorage()` and the typed repository.
The active build also clears the session checkpoint within its existing FIFO
and drains the epoch lane before and after terminal mutation. No discarded
baseline is loaded, evaluated or advanced; future timestamps, incompatible
string keys and expired records are all removed without date-range pruning.
All manager/runtime references are discarded, and only fresh-worker bootstrap
may create a new canonical first-run baseline. The retiring worker never
reloads or restarts. `BackgroundMaintenanceCoordinator` treats this as a required
tail step and never calls `clseRepository.clear()` directly. By contrast, the
explicit `CLSE_RESET_BASELINE` operator command is a normal, open-admission
mutation: it retains the existing quiesce -> rewrite -> reload -> resume
lifecycle so that a profile mutation is not required for a baseline-only repair.

### F9. CLSE settings use one strict generic-command admission

Status: fixed in the 2026-07-13 first-run settings pass.

The dashboard CLSE client uses its named command channel, but persistence still
converges on the generic background settings mutation lane. That canonical
patch boundary revalidates every submitted `clse_enabled`,
`clse_sensitivity_scale`, and `clse_alert_cooldown_ms` value through the exact
CLSE control contract before calling persistence. Validation-only defaults do
not widen the committed patch or acknowledgement.

A genuinely missing `clse_enabled` key is different from a malformed present
value. `ClseSettingsStore.getFeatureEnabled()` now requests a concrete boolean
default through `SettingsStore` and validates the resolved snapshot. It does
not use an `undefined` sentinel, persist a read-time default, or reinterpret a
present string as disabled.

### F10. CLSE dashboard ownership moved under the Experiment hub

Status: fixed in the 2026-07-13 Experiment integration pass.

The independent `clse` registry entry and its build aliases are retired. That
entry was hidden until `clseEnabled=true`, even though its own UI contained the
only dashboard enable action. The resulting first-run reachability cycle is
removed by making CLSE a development Experiment section that remains selectable
while disabled. Experiment home waits only for preference/protocol readiness;
selecting CLSE loads `CLSELab`, which owns its status request and exposes the
canonical store's pending/error state while keeping its controls inert. Dashboard
boot still initializes the canonical CLSE store, and runtime/message/storage
owners are unchanged.

### F11. CLSE Chrome ingress uses the shared profile-generation gate

Status: fixed in the 2026-07-14 profile mutation pass.

`CLSEServiceClient` receives the background gate's narrow `capture` and
`runCaptured` methods once at composition. `CLSEService` requires that port before
starting collectors and passes one shared admission owner to all of them. The
tracking-owned `oneMinuteTick` heartbeat and each background runtime-message,
navigation, tab, window, idle, and initial-query callback capture at listener arrival. A token
that crosses profile-generation close fails before its task can touch collector
state; the retiring worker never reopens.

Navigation now awaits the service-owned loop persistence callback inside the
captured lease. An old callback therefore cannot resolve `loopDetector` again
after reset and append a loop event to the new detector generation. Scroll,
content, and media handlers still return `true` synchronously, but commit their
response only after the admitted task ends; admission failure returns the existing
explicit `profile_mutation_admission_rejected` response with the gate's named
error code and performs no ring-buffer mutation. Collector-task and response-commit
failures use `collector_task_failed` and `response_commit_failed` with stable
`CLSE_PROFILE_MUTATION_RUNTIME_*` codes instead of collapsing to `reason=error`.
The serialized CLSE storage owner deliberately has two dispositions. Normal
explicit baseline repair uses resumable quiesce/reload. Profile reset/import
uses terminal quiesce/mutate/flush and leaves the old worker closed. Neither
path is duplicated by collector ingress guards or a recovery fallback.

### F12. CLSE worker continuity has one alarm and one compact session checkpoint

Status: fixed in the 2026-08-19 MV3 lifecycle pass.

`AlarmScheduler` remains the sole owner of the extension's `oneMinuteTick` alarm.
The background alarm handler calls the public `CLSEServiceClient` seam; CLSE no
longer registers or clears an independent alarm, and activity/loop cleanup has no
service-worker interval. Each heartbeat settles elapsed activity, prunes loop
maps, completes rollup work, and awaits the checkpoint write.

`runtime.clse_checkpoint` keeps an exact versioned schema but intentionally uses a
compact recovery window: the latest three closed 10-second buckets and the current
bucket, together with the activity cursor, loop maps, and aggregation cursors. A
timer-free scheduler admits collector-triggered writes at most once per five
seconds; an admitted write captures the latest state when its FIFO operation runs,
and every heartbeat force-admits a final post-settle/post-prune snapshot. This
trades at most the coalescing window and older in-memory ring history for materially
lower session-storage write pressure; IndexedDB rollups remain the historical owner.

The repository distinguishes absent from present-invalid data, rejects
partial/extra/non-finite records, and uses explicit `clear()` rather than
null-as-delete. Failed writes reject their admitted callers without poisoning the
next FIFO item. Fresh workers restore the compact ring, activity cursor, loop maps,
and aggregation cursors before collectors start. The initial idle query is itself
queued, so an immediate heartbeat cannot race it and regress the restored activity
cursor. Disable, baseline reset, profile quiesce, and failed startup drain owned work
before the checkpoint is cleared.

## Re-Audit Checklist

- Run `npm run check:background-kernel:architecture` after CLSE route/handler owner changes.
- Run `npm run test:file -- tests/clseCheckpointWriteScheduler.test.js tests/clseProfileMutationIngress.test.js tests/clseBaselineStorageContract.test.js tests/clseBaselineManager.test.js tests/clseServiceRecovery.test.js tests/clseMv3RuntimeContinuity.test.js tests/clseRuntimeCheckpointRepository.test.js tests/clsePublicSnapshotImport.test.js tests/clseRepository.test.js tests/indexedDbImportSnapshotHardening.test.js tests/backgroundStorageSnapshotService.test.js tests/clseStatusContract.test.js tests/clseStore.test.js tests/clseMessageHandlerSecurity.test.js tests/clseMessageRoutes.test.js tests/useCLSEStoreSettingsBus.test.js tests/useCLSEStoreStorageSync.test.js tests/dashboardTabReadiness.test.jsx tests/experimentTabLoadingContract.test.jsx tests/clseLabPermissionFailure.test.jsx` after CLSE baseline/route/store/snapshot/readiness changes.
- Run `npm run check:dashboard:i18n-contract` and `npm run check:i18n:dynamic-families` after CLSE dashboard copy changes.
- Confirm `CLSELab` does not catch failed commands without surfacing a visible error state.
