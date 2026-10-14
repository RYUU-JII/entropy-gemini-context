# Tracking Consumption Facts

- Status: Active
- Owner: tracking, behavior consumption, protection, platform storage
- Last validated against code: 2026-09-10
- Path policy: current-only
- Canonical for: confirmed foreground consumption facts, session checkpoint, protected-set aggregation, browser environment point evidence, shared consumption context, and Gate consumed-context projection

## Shipped boundary

Enso's operational cadence added on 2026-09-12 does **not** consume this
collection-admitted foreground total. Its bounded policy state is owned by
InterventionAdmissionService (`intervention-admission-runtime.md`). Existing
foreground/browser/idle callbacks and the same minute inventory supply the
consent-independent operational foreground observations through
`trackingEnsoCadenceBridge.js`. Historical consent/exclusions and stats ACK remain
unchanged here. Cadence adds no browser listener, inventory query or timer; its
one extra foreground scope interpretation is performed on the existing inventory.
Enso counts focused protected foreground exposure while unlocked, including
native idle and silent media. It does not claim measured attention or reuse the
historical active-time definition. Lock/blur/background/unknown never add Enso
time; foreground idling can mature at most one opportunity, which still needs a
fresh content boundary. Analytics active-time semantics below remain unchanged.

The existing inventory also projects `buildGateEntryPresence` for operational
Gate approval (see `intervention-admission-runtime.md`). It returns only
`{ observedAt, presence }`, independently of analytics consent/exclusions, without
recording domains, durations, history or pressure. `trackingTickRunner` delivers
this point after the existing stats batch using the same browser/settings
observation receipt. Existing confirmed foreground and protected-audio callbacks
provide positive activity between beats. No additional listener, inventory query,
heartbeat, usage ledger or recovery model is installed. Statistical environment
collection still follows its consent policy; missing scope stays unknown.

Normal tick acquisition now precedes stats mutation admission. The existing
Tracking observation owner issues a single-use receipt for inventory/focus and
checks browser/settings, foreground revision, idle state and date before any
settlement mutation. Points keep acquisition time even when the stats lane is
delayed; usage facts still use the admitted settlement time. One invalidated
pre-mutation observation may be reacquired outside the lane. Historical rollover
also prepares inventory outside the mutation FIFO, using cached idle and a receipt
bound to its previous date / exact boundary. Validation precedes foreground and
domain-session closure. The existing calendar barrier still waits for complete
historical settlement, load and prime. The execution/drain contract is in
`docs/architecture/repository/storage-stats-tracking-boundary-map.md`.

This is the foreground and environment-context foundation of the proposed
`docs/architecture/runtime/protected-consumption-flow-architecture.md`.
The fact owner does not install a pressure score, recovery threshold, candidate
selection engine, or new scheduler.
The descriptive model now consumes these facts under
`consumption-memory-runtime.md`. It does not replace this fact contract or its
unevaluated pressure/recovery/switching policy states. The bounded Zen entry
overflow extension is now a live consumer of the separately owned warm memory,
as specified in `consumption-memory-runtime.md`. Simulated journey comparisons
remain evaluation evidence under `consumption-memory-model-evaluation.md`;
they are not live usage observations or another policy authority.

The input provider now joins the same Tracking snapshot to the admission
owner's bounded committed exposure window. Its `consumptionContext.intervention`
projection divides the latest foreground receipt into unoccupied, acknowledged
presented and uncertain milliseconds. It does not change Tracking's checkpoint,
raw totals, historical stats or Gate consumed-context projection. See
`intervention-admission-runtime.md` for the source/retention/uncertainty contract.

```text
existing browser events / existing tracking heartbeat / idle / rollover
  -> TrackingForegroundUsageLedger / TrackingForegroundSegmentSealer
  -> collection admission + shared protected-host scope
  -> durable stats acknowledgement
  -> TrackingConsumptionLedger (serialized derived checkpoint)
  -> advance existing active-tab source cursor

TabTimeTracker.getConsumptionFlowSnapshot
  -> ProtectionRuntimeInputProvider (one read per evaluation)
     -> gateConsumedContextProjection -> existing Gate decision pipeline
     -> behavior/consumption/consumptionContext -> raw runtime input explanation

existing Tracking tab batch inventory + passive windowsGet focus read
  -> trackingConsumptionEnvironment (collection admission + shared scope)
  -> TrackingConsumptionLedger (worker-local point after successful batch)
  -> same getConsumptionFlowSnapshot

successful existing batch -> TrackingConsumptionLedger.runAfterFacts snapshot capture
  -> Tracking-owned derived lane (source/stats/protection do not await model I/O)
  -> ConsumptionMemoryService joins existing contexts/media/admission exposure
  -> typed model_state state + cursor CAS -> warm consumptionContext.memory
```

No new browser listener, tab query, polling loop, queue of interventions, or
time authority is introduced. Tracking remains the source of foreground
intervals. Admission, run leases, screen ownership, and tab closure are unchanged.
The existing batch performs one additional passive window read when its
last-focused active tab identifies a window. This does not focus or activate it.

## Owners and meaning

| Concern | Owner | Meaning / lifetime |
| --- | --- | --- |
| Tab creation, committed/completed navigation, foreground relation, per-host return and media-maintenance hint | `src/domains/tracking/background/NavigationContinuityService.js` | Existing bounded `runtime.tab_navigation_state`; navigation intent is not proof of consumption. |
| Foreground interval | `src/domains/tracking/background/trackingForegroundSegmentSealer.js` | Exact tab, host, start/end, audible signal, protected classification, and whether the source closed. Emitted only after collection admission and durable stats ACK. |
| Protected classification | `src/domains/protection/background/protectedHostnameScope.js` -> `ProtectionScopeResolver` | Shared by live protected-tab inventory and consumption. Includes plain/hashed rules, schedule and isolation exceptions. No classification reconstructed from tab title or Gate state. |
| Derived consumption state | `src/domains/tracking/background/TrackingConsumptionLedger.js`, `trackingConsumptionFlowState.js` | One serialized writer; protected foreground total, contiguous protected run, observed outside foreground run, bounded protected contexts, and source watermark. |
| Browser environment point | `src/domains/tracking/background/trackingConsumptionEnvironment.js` | Classifies existing batch inventory and actual window focus. The same ledger serializes the latest point in worker memory; it is not another usage interval or historical stream. |
| Browser-audible continuity | `src/domains/tracking/background/trackingConsumptionMediaWindow.js` | Same ledger owns a bounded worker-local positive continuity window; existing browser ingress fences anchors before async admission. See `consumption-memory-runtime.md`. |
| Descriptive memory | `src/domains/behavior/consumption/ConsumptionMemoryService.js` | Post-batch observation in the same ledger lane; typed durable state/cursor and a separate warm read. No new raw history or intervention policy. |
| Common consumption context | `src/domains/behavior/consumption/consumptionContext.js` | Pure explanation from one Tracking snapshot. Reports observed state, coverage, usage, departure and recovery blockers; recovery, switching and pressure remain `not_evaluated`. |
| Session checkpoint | `src/platform/storage/runtime/TrackingConsumptionRepository.js` | `runtime.consumption_flow` in session storage. Same checkpoint contains facts and applied watermark. Survives worker recreation, tab navigation and ordinary settings reapplication. |
| Consumed-context interpretation | `src/domains/protection/background/runtime/gateConsumedContextProjection.js` | Gate's existing minimum dwell / time window applied to closed, confirmed protected contexts. No Gate-local dwell writer. |
| Gate decisions / passes | `src/domains/protection/background/runtime/GateRuntimeStateOwner.js` | Existing policy state, intervention decisions and passes. These are not usage history and are not migrated to the consumption checkpoint. |
| Historical statistics | Existing stats repositories | Historical/analytics truth remains IndexedDB; the derived session checkpoint is not another historical statistics backend. |

The app coordinator delegates Gate state; it no longer exposes a
`getGateProtectedContextSnapshot` method. The input provider must receive the
Tracking snapshot reader explicitly. Missing or malformed input rejects the
operation rather than restoring a Gate-local history.
The provider projects both Gate contexts and `consumptionContext` from that
single read, including when the entry checkpoint is disabled. The common context
is available on the provider's raw input. Zen entry freezes a bounded extension
from its memory projection at candidate creation; common pressure/recovery/
switching labels remain unevaluated. This does not alter Gate enablement, passes,
Furin's budget conditions, or document-local Enso/Mukheun tempo.

## Data and ordering contract

The current checkpoint is exact schema version 1:
`{ schemaVersion, lastSegment, protectedForegroundMs, protectedRun, outsideRun, contexts }`.
Segments contain exactly
`{ tabId, hostname, startedAt, endedAt, isProtected, audible, closed }`.
Runs contain `{ startedAt, endedAt, foregroundMs }`.
Present null, partial/extra fields, invalid interval ordering or non-finite
numbers are errors. Only a missing key bootstraps. There is no legacy read.

The sealer submits the complete original interval, including an interval whose
stats commit already succeeded. The derived owner clips it against its one
foreground watermark before updating any counter or context. Replayed/older
receipts add nothing; overlapping receipts from different hosts/tabs/scopes
are a diagnosable ownership error. A receipt write failure rejects and prevents
the active source cursor from advancing. A subsequent stats-ACK replay can
finish the derived commit. Reads return committed clones; failed writes do not
publish a speculative snapshot. The write lane remains usable after rejection.

A close exactly at a just-sealed heartbeat boundary can close that receipt
without creating duration. A close for a different tab/host/time cannot close a
new source. Adjacent heartbeats, including audible toggles, coalesce into a
single context. A later different source closes the preceding open context at
its last observed endpoint; it does not fabricate elapsed time in the gap.

Profile reset/import uses Tracking's existing quiesce admission: accepted work
drains, new work rejects, and the terminal profile transaction owns deletion.
Explicit analytics/debug/runtime-session erasure calls `TabTimeTracker.resetState()`
and clears this derived checkpoint together with the source cursors and the
descriptive model (empty revision-fenced checkpoint). Settings reapplication
validates the existing foreground boundary without opening a closed segment or
retiming an admitted live segment. Revocation uses the canonical sealer to
discard its unadmitted suffix and retire even a paused session cursor. Only a
fresh foreground observation can reopen it; settings are not such evidence.
Reapplication does not call the erasure seam. Worker
initialization loads it lazily through the serialized owner. No stats-history
reconstruction is used when the session key is absent.

## Browser environment and common context contract

The checkpoint schema above is unchanged. The read DTO adds `environment`,
either null (not observed in this worker) or the exact point shape
`{ observedAt, admission, foreground, protectedMedia, idleState }`.
This point is worker-local, has no identities, and creates no new storage key.
`observedAt` is the admitted Tracking batch boundary, not an atomic browser
snapshot guarantee. Browser inventories, focus and scope reads are sequential
observations; known conflicts are retained as unknown.
The read DTO also includes the exact `consumption_browser_audible_window_v1`
`media` projection. It is worker-local evidence, never part of the session
checkpoint schema. A recreated worker starts without a continuity anchor while
the separately durable model keeps its existing memory/cursor.

- A foreground classification requires actual `Window.focused === true`, one
  active candidate and matching tab/window/URL inventory. `lastFocusedWindow`
  alone is insufficient. Pending changes to another host remain unknown.
  `trackingForegroundObservation.js` supplies that same proof to batch foreground
  settlement and environment classification. A known blur, missing focus or
  conflicting inventory cannot reopen a foreground source through an active-tab
  fallback. Replacement similarly requires a known focused-window relation;
  a null relation after blur does not promote an active replacement. Background
  audible evidence remains separate.
- `protectedMedia` means the browser's `Tab.audible` point signal anywhere in
  the inventory, including background tabs. Present/absent/unknown are distinct.
  Known protected audio is positive evidence even if other tabs are incomplete;
  missing audio flags or an unclassifiable audible host prevent an absence claim.
- Collection consent and hostname exclusions apply before classification. A
  disabled point has unknown foreground/media/idle fields. This adds no consent
  scope or content observation. Idle/locked is retained as a signal, not rest.
- A successful existing batch publishes its point through the ledger's same
  serialized admission lane. A failed read or batch leaves the older point and
  its original timestamp. Older points are ignored; identical receipts replay;
  contradictory values at the same boundary reject explicitly. Reset clears
  the point; worker recreation restores usage but starts environment unknown.
- `protected_consumption_context_v1` reports `state` **as of `stateAsOf`**, plus
  `coverage.environmentAt`, `usageThroughAt`, `unobservedMs` and `idleState`.
  `observed` means a valid point exists, not that it remains current indefinitely.
  A newer usage receipt supersedes an older environment point; regressed clocks,
  disabled collection and missing observations are explicit. Reads do not add
  elapsed consumption or recovery. No freshness deadline or rest timer is added.
- Outside foreground evidence and absence of audible media do not establish
  restorative rest: silent video and attention are not covered. Positive audio
  is only a recovery blocker here; it is never added to foreground milliseconds.

### Deferred switching interpretation

The future interpreter belongs in `behavior/consumption`, consuming actual
Navigation transitions joined to confirmed usage lineage. Heartbeat, midnight,
idle and settings interval splits must not become user switches. Same-domain
tab moves and protected-domain moves can have distinct evidence while sharing
one protected-use flow. No second tab registry, observer or Gate-local score is
reserved. For now `switching.status` and `pressure.status` are `not_evaluated`,
not zero scores; no transition frequency weights or additional history exist.

## Continuous use, away evidence, and time values

- Protected A 20 minutes -> protected B 15 minutes at the same boundary is one
  35-minute protected run, including a move to another tab on the same host.
- A confirmed outside foreground interval ends that contiguous run and starts
  an `outsideRun`. It does not clear `protectedForegroundMs`. A one-second visit
  is recorded as one second; it is not interpreted as enough recovery.
- Unknown gaps break *proven continuity*. They do not create an outside run or
  reduce the accumulated protected total. The read model reports
  `observedThroughAt`, `unobservedMs`, `clockRegressed` and
  `recovery: not_evaluated`; it never extrapolates to the read time.
- The protected total is since the browser-session checkpoint began, not a
  daily total or a pressure score. The latest protected run can be historical
  when the current segment is outside; readers must use the accompanying source.
- Recent protected context identities are bounded to one hour / 128 entries,
  matching the horizon and count of existing navigation foreground events.
  These are observation-memory bounds, not rest/cooldown parameters. Aggregate
  run length does not shrink when identities expire.
- Gate retains its existing **12-second** minimum, **10-minute** context window,
  and **48-context** limit. Only the source becomes confirmed protected usage.
  No new user-facing wait duration is introduced.

## Coverage and limits

The stream is explicitly `collection-admitted-foreground`. Existing collection
consent and hostname exclusions still apply. Absence of receipts is not proof
of non-use. This is not a new collection permission. As with existing admitted
history, consent changes stop new admission; explicit deletion owners govern
erasure. No content text, full URL, title or DOM is stored in this checkpoint.

The shared scope is evaluated at the sealer's admitted end boundary. The stream
does not reconstruct exact intra-interval rule/schedule changes. Existing
settings boundary settlement is retained; a contradictory overlapping receipt
fails rather than relabeling an already committed interval.

The segment `audible` bit is Tracking's foreground media observation, not proof
of attention. The environment now adds inventory-wide audible point evidence;
background media duration/linger/stale metrics remain in existing stats owners.
Navigation transitions remain in NavigationContinuityService. Feed,
editor/묵흔 input patterns, CLSE, pattern labels and artifact feedback have not
been merged into this model. There is deliberately no second normalized event
bus that republishes all of them.

Idle/unfocused/offline time is not yet positively classified as restorative
rest. Browser restart clears session checkpoints; durable cross-browser-session
behavior memory remains a later typed model-state task. Gate's other volatile
return/pass policy fields remain unchanged. This cutover must not be reported
as full Gate history persistence or a completed app-wide consumption engine.

## Verification owners

- `tests/trackingConsumptionFlow.test.js`: cross-domain/tab continuity,
  short outside visits, missing observations, source conflicts/replay, storage
  failure/restart, profile quiesce, shared hashed/isolation scope, and Gate projection.
- `tests/statsTrackingDurabilityIntegration.test.js`: actual stats barrier and
  active checkpoint ordering, worker restore, concurrent collection and rollover.
- `tests/consumptionEnvironmentContext.test.js`: focus/inventory conflict,
  protected audio, consent, unknown coverage, no extrapolation, and worker restart.
- `tests/tabTimeTrackerBackgroundPressure.test.js` and
  `tests/protectionRuntimeInputProvider.test.js`: actual batch/window-port wiring,
  failed observation/retry, and one common read with Gate enabled or disabled.
- Existing Tracking, Gate owner/provider and app-composition regressions remain
  authoritative. `scripts/ci/check-tracking-browser-events-architecture.mjs`
  guards the common source and the removal of Gate-local consumed-context state.

Runtime/browser observations require the named QA control plane. Unit or build
success is not a named browser QA PASS.
