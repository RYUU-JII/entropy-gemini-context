# Storage, Stats, And Tracking Boundary Map

- Status: Active
- Owner: repository architecture, platform storage, stats domain
- Last validated against code: 2026-08-07
- Path policy: current-only
- Canonical for: current storage/stats/tracking owners and release V1 failure boundaries

## Consumption model work and lifecycle composition

The existing Tracking derived lane retains one running and one latest pending
observation, with an explicit erasure barrier. Profile mutation uses the same
admission owner; `trackingProfileMutationRuntime.js` composes the existing
source/model, active-tab and domain-session drains and terminal RAM reset.
`TabTimeTracker` delegates these operations and existing state accessors.
No new timer, tab registry, settings storage or foreground source is introduced.
The atomic uncertainty capability and frozen Zen entry-intensity boundary are
owned by `docs/architecture/runtime/consumption-memory-runtime.md`.

## Release V1 Contract

- `EntropyDB` version is `1`; the fresh creation path installs the complete
  current store/index layout.
- IndexedDB snapshot format is `1`; import preflights every row against the
  exact current contract before any mutation.
- `chrome.storage.local`, `chrome.storage.session`, and IndexedDB expose only
  current registry keys and typed records.
- only a missing current key may bootstrap. Existing malformed or
  wrong-contract data fails loudly.
- normal runtime has no DB upgrade branch, old-key read-through, previous-shape
  conversion, retired-key cleanup, or automatic database deletion.
- pre-baseline development data is removed only through
  `docs/operations/runbooks/pre-release-development-profile-reset.md`.

Manifest V3, Web Crypto identifiers such as `AES-GCM`, browser APIs, and npm
dependency versions are externally owned and are not persistence-contract
versions.

## Canonical Owner Map

Gate history provenance (P3a, 2026-09-18): `InterventionEffectStore` owns immutable
first-event facts; `statsCollector` validates and applies matching aggregate receipts;
`statsBucketMaterializer` restores/projects them; `StatsAggregateStore` atomically
writes receipts with hourly counters and excludes them from the daily read index.
The narrow shape/integrity contract is `src/domains/stats/contracts/interventionHistoryReceipt.js`.
The Gate recorder consumes the committed source fact, not the retry arrival time.
No added queue, timer, storage key, or policy authority participates in this path.

| Data or decision | Canonical owner | Backend / output | Forbidden shortcut |
| --- | --- | --- | --- |
| settings and policy | `SettingsService` through platform settings capability and typed stores | namespaced `chrome.storage.local` documents | raw Chrome storage, unknown-key acceptance, cache as a second truth |
| in-flight runtime checkpoints | typed runtime repositories | registered `chrome.storage.session` keys | durable business history in session storage |
| historical stats facts | stats repositories and typed IndexedDB stores | `stats_hourly`, `stats_daily`, transition/effect stores | dashboard reconstruction from raw logs or empty fallback on read failure |
| event logs and CLSE | typed log/CLSE repositories | IndexedDB stores with exact rows | direct DB access from UI/domain features |
| model and theme durable state | typed model/theme repositories | IndexedDB `model_state` and owned stores | page-local business-data mirrors or cross-model fallback |
| assets and disposable caches | typed asset/cache owners; favicon capture policy in tracking plus injected platform fetch adapter | IndexedDB or owner-local cache keys; favicon rows through `FaviconRepository` / `FaviconStore` | treating a cache miss as business-state migration, raw store access, or domain-to-app fetch imports |
| collection scope and admission | `dataCollectionPolicy.js` | `dataCollectionMode` scope plus explicit `insightsConsent` admission | inferring consent from host permission, protection registration, defaults, or analysis depth |

## Runtime Flow

```text
canonical settings command
  -> SettingsService serialized mutation lane
  -> typed SettingsStore write
  -> canonical committedItems + semantic changedKeys
  -> durable settings propagation checkpoint
  -> tracking/protection/runtime adapters
  -> stats fact writers
  -> typed stats read models
  -> dashboard consumers
```

The cache hydration path is read-only. It accepts current settings documents,
updates the in-memory cache, and never writes a conversion patch.

Favicon capture follows a split owner flow: `FaviconService` owns tracking-side
capture admission, ordered source identity selection, cooldown, and per-domain
sequencing. `src/platform/browser/faviconFetch.js` reads only the extension-owned
Chrome `_favicon/` endpoint through `fetchPackagedExtensionAsset`, with a
2.5-second timeout, 256 KiB limits and service-worker-safe PNG conversion. The
exact local response must have PNG signature/IHDR, dimensions at most 256×256,
and successful worker decoding with matching dimensions; its original bytes are
then projected to `data:image/png`. Chrome's proprietary missing/BMP response
metadata is not the payload format contract. Persisted/provided image MIME
admission is unchanged. Observed HTTP(S) icon URLs identify capture work; neither their host,
path nor query is used as a remote request destination. Validated bounded image
data needs no request. Malformed input and unavailable local images produce the
existing explicit optional-capture miss. Chrome's extension favicon API disables
favicon-server fallback; no host permission grants a download exception.

This adapter contract follows the pinned Chromium 150.0.7871.124 owners:
[`FaviconBackend` PNG encoding](https://chromium.googlesource.com/chromium/src/+/refs/tags/150.0.7871.124/components/favicon/core/favicon_backend.cc#586),
[`favicon_util` raw bitmap delivery](https://chromium.googlesource.com/chromium/src/+/refs/tags/150.0.7871.124/chrome/browser/extensions/favicon/favicon_util.cc#48),
and [`ExtensionURLLoader` proprietary MIME](https://chromium.googlesource.com/chromium/src/+/refs/tags/150.0.7871.124/extensions/browser/extension_protocols.cc).

`faviconDataUrlPolicy.js` owns persisted image validation. `FaviconRepository`
is the only public path to `FaviconStore`. Background composition injects only
the required platform cache-reader port, never a remote-fetch permission port.
UI reads the same browser-local endpoint and the canonical persisted cache;
injected presentation sources must be validated data URLs. A miss retains the
last committed local image or the visible monogram. There is no scheme rewrite,
domain-to-app import, remote image attempt or secondary storage source.

Content sends one bounded, ranked candidate batch, and tab capture enters the
same coordinator. Candidates are attempted sequentially until a usable image is
available. Each domain retains one running request and at most one latest pending
request. Identical requests share results; a superseded pending request settles
with `captured: false`. Admission runs inside that lane so asynchronous policy
checks cannot reorder observations. Repeated running input supersedes a different
pending input and rejoins the running result. Fresh persisted rows are reused for
24 hours on revisit, including after the service worker restarts. Expired rows
stay readable for presentation while a visit attempts refresh; a failed refresh
does not erase the last usable image. Known source changes can refresh sooner in
the current worker lifetime. The persisted row remains exactly
`{ domain, dataUrl, updatedAt }`; there is no metadata migration. Refresh reads
only the browser-local endpoint through own-extension `force-cache` reads and
rejects redirects. The observed icon URL is never requested.

`FaviconRepository` serializes writes and clears. Clear advances its local
revision before storage work; a capture admitted against an older revision cannot
write after clear. Clear is acknowledged only after its IndexedDB transaction
commits. Favicon bytes are not stored in `TabTimeTracker`'s URL bookkeeping.
After a committed save/clear, the repository emits a local change signal; the
background composition broadcasts `FAVICON_CACHE_CHANGED` to extension pages.

Presentation reads use one shared `FaviconQueryService` per JavaScript context:
normalized-domain in-flight deduplication, bounded LRU, five-minute positive TTL,
and fifteen-second empty-result TTL. Only successful, validated owner replies
enter the cache; transport/owner failures reject. Change signals invalidate the
affected domain (or all domains for clear), fence older in-flight replies, and
refresh subscribed images. Content indicator reads use the same query service
with bounded TTL; extension-page broadcasts do not target content scripts.
`GET_FAVICON_DATA` is read-only and never triggers network capture. Theme color
analysis may read repository records directly when it needs `updatedAt`.

`ui-kit/Favicon.jsx` keeps its existing letter identity visible until the selected
image source completes a usable load. Failed or undersized images retain that
identity while the existing candidate sequence advances. Image nodes are keyed
by source so late events cannot mark a newly selected source as failed. This is
presentation state only; it adds no fetch or persistence path.
Dashboard, popup, and gate use that same component. Viewport admission for site
lists and browser-first high-density raster selection remain presentation policies.

## Runtime Checkpoint Contract

- The consumption environment point shares Tracking's serialized writer but
  stays in worker memory. The existing batch supplies inventory and a passive
  actual-focus window read; `behavior/consumption/consumptionContext.js` only
  interprets the shared read DTO. It writes no storage, grants no recovery, and
  leaves switching/pressure explicitly unevaluated.

- `runtime.consumption_flow` is a bounded derived foreground checkpoint owned
  by `TrackingConsumptionLedger` through `TrackingConsumptionRepository`.
  Stats durable ACK precedes the derived checkpoint; the active source cursor
  advances last. Facts and replay watermark commit together. Context identities
  retain at most one hour / 128 entries, while the browser-session aggregate is
  not reset by tab navigation or ordinary settings reapplication. Collection
  admission is inherited from the existing sealer. It is not historical stats,
  a recovery verdict, or cross-browser-session model storage. Exact shape,
  profile quiesce and Gate projection are specified in
  `docs/architecture/runtime/tracking-consumption-facts.md`.

- `RuntimeSessionRepository.readOptional(key)` performs a presence-aware read.
  Only `found: false` is a missing-key bootstrap; an existing `null` or malformed
  value is current data and must fail validation.
- `runtime.active_tab` is validated by `trackingActiveTabCheckpoint.js`. The
  record has exactly `{ tabId, hostname, startedAt, audible }`; numeric strings,
  boolean coercion, extra fields, and invalid field relationships are rejected.
- `runtime.domain_session` is one exact in-flight intent, never a per-host dwell
  mirror. Its `active` shape is exactly
  `{ phase, sessionId, hostname, startedAt }`; finalization first replaces it
  with exact `pending_commit`
  `{ phase, sessionId, hostname, startedAt, endedAt, durationMs, targetDateStr }`.
  The owner serializes `readOptional`/`set`/`remove`, preserves the same
  `sessionId` across worker restarts, and removes a pending intent only after
  the stats owner durably acknowledges it. The sole non-write exit is an
  explicit collection-policy rejection after canonical settings hydration;
  an `unset`/`later` or scope-mismatched pending intent is discarded before
  replay. Missing is distinct from stored `null`, and malformed/extra fields
  fail loudly.
- Current collection admission is revalidated before active-session finalization
  as well as pending replay. A revoked active session is abandoned without a
  session fact instead of being finalized under its earlier scope.
- `runtime.tab_navigation_state` is validated by
  `navigationContinuityCheckpoint.js`, including every nested completed,
  committed, created, host, foreground, and foreground-event entry. Only an
  already-valid but expired entry may be dropped by TTL hygiene.
- Both active-tab and navigation owners capture a full snapshot when
  persistence is requested and serialize writes through an owner-local Promise
  tail. A failed write rejects its caller but does not poison the next newer
  write.
- `runtime.cycle_checkpoint` follows the same full-snapshot and owner-local tail
  contract. Foreground activity awaits that commit, while reset-policy mutation
  uses the separate named SettingsService owner for `monitor_cycleSettings`.
  Normal activity never rewrites settings, and one combined settings/session
  best-effort save is not a valid cycle-state commit.
- Cycle policy defaults to a user-controlled 04:00 boundary. Analysis can only
  propose a recommendation, including for an existing `mode: auto` record;
  only a manual setting or explicit recommendation acceptance may schedule a
  future boundary change. At the validated policy input/application boundary,
  `CycleStateManager` performs a one-shot cancellation of a present
  `pending.reason: adaptive` intent through the SettingsService action
  `cycle_unconfirmed_reset_cancel`. It preserves the effective hour and history,
  restores the selected manual hour to that effective hour, and lets fresh
  completed observed days produce a new recommendation. No fabricated
  recommendation evidence or read-time alternate policy is installed. The
  cancellation branch exits as soon as that pending intent is removed; accepted
  `manual` and `recommendation` intents keep their scheduled application.
- `runtime.clse_checkpoint` is the exact versioned session snapshot owned by
  `ClseRuntimeCheckpointRepository`. It contains the 10-second ring, activity
  cursor, loop-detector maps, and aggregation cursors. Collector mutations and
  the shared one-minute heartbeat await a single FIFO write lane; a rejected write
  reaches the caller without poisoning later writes. Disable/reset/quiesce drain
  that lane and call the explicit clear seam. Present null, partial, extra, or
  non-finite records are invalid rather than missing/bootstrap state.
- Adaptive cycle analysis captures the policy snapshot and owner revision before
  awaiting stats. A result whose policy revision or manager lifecycle generation
  changed is an explicit stale no-op; it cannot restore a dismissed recommendation
  or overwrite a reset/import reload.
- Active-tab reads return snapshots. Segment timestamp changes go through the
  active-tab owner instead of mutating a shared live object.

### Stats batch admission and durable acknowledgement

- Normal `trackingTickRunner` acquires inventory through
  `trackingTabActivityObservation` **before** joining the stats mutation lane.
  It first completes the canonical idle refresh (whose state-change callback can
  itself require a stats batch), then reads both tab inventories and actual window
  focus. `settleTabActivityObservation` consumes a tracker-local, single-use receipt.
  The browser ingress/settings receipt, active-tab revision (including focus ABA),
  cached idle state and calendar date are checked at admission and again after
  asynchronous scope reads, immediately before the first mutation. Neither a
  caller-created DTO nor a consumed receipt can authorize settlement.
- One pre-mutation supersession may reacquire outside the lane; a second fails
  with `TRACKING_TAB_ACTIVITY_OBSERVATION_SUPERSEDED` and its reason. Storage failure,
  partial collection and combined task/save failure never enter this retry path.
  Tick's existing single-flight and profile drain own acquisition as well as
  settlement. There is no new timer, polling, event listener, stored snapshot or
  fallback inventory. Browser calls are not atomic: the receipt fences known
  events/state changes, not events the browser has not yet delivered.
- Browser points retain acquisition time; stats facts/cursor/cap use the later
  timestamp admitted by the calendar owner. Settings/scope are re-evaluated during
  settlement, not copied into a new policy cache. Scope/session reads, foreground
  settlement and required durable writes remain inside the mutation lane.
  Historical rollover uses `prepareRolloverTabActivityObservation` before entering
  `runStatsRolloverMutationBatch`. The receipt additionally binds the previous
  date and its exact next-midnight boundary. `settleRolloverTabActivityObservation`
  checks the receipt and scope before closing the foreground cursor or finalizing
  its domain session; those effects then precede inventory settlement in the same
  mutation batch. An incompatible, forged or consumed receipt cannot authorize
  historical settlement. One pre-mutation supersession may reacquire outside the
  FIFO; browser read failures and partial settlement/storage failures propagate.
  Actual environment points keep acquisition time, not the historical cutoff.
  The existing rollover Promise owns acquisition/drain and the calendar barrier
  remains closed until historical finalize, new-day load and prime succeed. Moving
  browser I/O outside the mutation FIFO does not allow new-day facts to bypass
  that barrier. Rollover reads event-owned cached idle: refreshing idle while the
  calendar barrier is held could recursively wait for that same barrier.
  `trackAllTabsBatch` remains an explicit combined observation API; normal tick
  and historical rollover do not use it as an alternate/fallback path.
  Background elapsed application likewise reads `getCurrentIdleState` when it
  has no admitted batch override; a browser/navigation stats batch must not
  recursively refresh idle. The existing event listener and normal tick refresh
  remain the idle state owner, with no additional cache or timer.

- Ordinary `runStatsMutationBatch` admission loads the calendar day before
  joining the mutation lane and passes one `{ now, dateStr }` to its task. If
  the day advances while the request waits, admission repeats before any task
  mutation. Tracking callers use that admitted timestamp for collection.
  Web-navigation intent and tab-context counters each use their own admitted
  timestamp; the original browser event timestamp stays in navigation continuity
  only. A delayed event therefore never loads an older calendar date inside a
  newer admitted batch. Admission drain tails resolve without task result
  payloads so completed batches do not retain the prior lifetime's results.
- `runStatsRolloverMutationBatch` is the separate rollover-only entrypoint. It
  requires an active rollover and an exact loaded date/boundary, and joins the
  same FIFO normally. Rollover settlement and prime never recursively call the
  ordinary admission path or run a nested batch inline. An active batch can
  still read its loaded date while an external rollover waits behind it.
- `commitStatsMutation({ requireDurableCommit: true })` is a real IndexedDB
  barrier even inside a coalesced batch. Foreground elapsed, pending domain
  session completion, content-flow ACK, and intervention recording use this
  contract before their caller advances a checkpoint or acknowledges another
  owner. An idempotent retry must also cross the barrier when there are no new
  aggregate changes, since an earlier attempt can still be dirty in memory.
- A required barrier during an unfinished calendar rollover writes only the
  unfinalized hourly facts. The successful rollover batch's final drain alone
  atomically installs the complete historical daily summary. A failed task may
  persist its partial hourly progress but cannot finalize the day. Normal
  background/domain bookkeeping still coalesces into the enclosing batch.
- `tests/statsTrackingDurabilityIntegration.test.js` connects the actual
  tracking checkpoint, collector, persistence, tick, and rollover owners to
  verify storage ordering, failed-write retry, overlapping content ACKs, and
  midnight admission. Calendar storage boundaries remain separate from the
  user's configurable activity-day/cycle read projections.
- `trackingTabActivityBatchSettlement` shares each hostname's scope read across
  consumption-environment, Gate-presence and Enso projections of one inventory.
  The lookup uses that batch's settings snapshot and admitted time, is discarded
  after the batch, and never substitutes for foreground settlement or dispatch
  admission. Analytics consent/exclusions are still applied independently from
  operational protection. The next batch rereads the canonical scope owner;
  failed reads reject the observation rather than installing an empty scope.
  This is per-host read deduplication, not an atomic browser/policy snapshot.
- `statsRuntimeHealthLedger.record*` synchronously accepts diagnostics in RAM;
  its return is not a session-storage ACK, including failure and forced-save
  milestones. The existing owner holds one active write plus latest RAM state,
  with no per-event promise queue. Normal milestones use a 5-second throttle and
  one trailing timer; failure/force/important incidents request the next immediate
  write and absorb that timer. A completed write advances only its captured
  `persistedRevision` and mirror metadata, never replaces newer RAM counters.
- Hydration holds a fixed-size field overlay and counter delta. A successful
  session read merges them once, including explicit null/error clears. A failed
  read leaves `available: false` and a visible hydration error; it cannot authorize
  overwriting unread history. Only explicit `init`/quiesce retries that read.
  Mirror failures retain dirty RAM and `lastHealthWriteError`, log once per failed
  attempt, and do not self-retry. New recording demand or an explicit barrier may
  retry a write. The read DTO's `persistence` receipt is worker-local, not stored.
- Explicit `init` remains a hydration/mirror barrier (including startup).
  `statsRuntimeService` closes/drains the stats producer before closing/draining
  the health consumer, so accepted saves and snapshot-import's required flush
  can record completion/failure. Failed producer quiescence forbids deletion and
  retains this dependent diagnostic consumer for terminal retry; other profile
  participants still follow the coordinator's independent close attempts.
  Failed health drain stays closed and rejects until an explicit retry succeeds.
  A successful quiesce leaves no timer or write capable of recreating deleted keys.
- Tick, foreground cursor, content ACK and cap evaluation still follow the real
  IndexedDB stats barrier; diagnostic read/write delay is absent from their record
  calls. Worker loss can drop unmirrored diagnostics, including urgent milestones;
  neither immediate demand nor a 5-second timer guarantees persistence under MV3
  suspension. This seam does not weaken facts/checkpoint durability.

The retired `runtime.tick_metrics` and `runtime.last_tracked_at` keys had no
semantic reader. Their tick buffer, timer, bootstrap restore, and message-side
secondary accumulation paths are deleted; durable stats facts, CLSE short-dwell
signals, tactical counts, and content-flow aggregates remain with their named
owners.

## IndexedDB And Snapshot Flow

```text
DBManager open EntropyDB @ version 1
  -> applyIndexedDbV1Schema({ db }) on first creation
  -> typed stores

snapshot V1
  -> pure exact metadata/document/key/count validation
  -> preflightIndexedDbV1ImportSnapshot
  -> stop on any rejected input before stats/CLSE/settings/session side effects
  -> exclusive external settings mutation lane
  -> typed Chrome storage + IndexedDbSnapshotRepository commit
```

Wrong snapshot format, unknown store field, malformed row, invalid stats bucket
identity, duplicate canonical primary keys inside any exact V1 store, invalid import
mode/secret flag, declared-count mismatch, malformed key material, or contract mismatch rejects before mutation. Merge and replace
use the same preflight contract. Full app reset drains every sibling clear in a
required phase before recovery/reload begins, including when one sibling fails.

## Stats Facts And Read Models

- `stats_hourly` is the durable current-day fact ledger; the current local hour
  is the only normally overwritten `open` row.
- `sealed` is a clock-closed state. A current runtime day may replace an explicitly dirty late hour at the same primary key; historical-finalized days are immutable in normal runtime.
- `stats_daily` is the finalized historical read index.
- every V1 hourly row explicitly carries its cursor and timezone identity;
  readers do not infer missing values from timestamps.
- every hourly `sessionsDelta` exactly carries `{ count, totalMs, lastCommit }`.
  `lastCommit` is `null` except in the session's ending-hour bucket, where it
  contains `{ sessionId, endedAt }`; this cursor makes a replayed pending intent
  idempotent for both day and domain session aggregates.
- read caches require a covering range and matching stats runtime revision.
- Protection's cap checks and general runtime input share the existing eight-day
  activity-day projection. The facts owner caches a covering range for 15 seconds;
  the activity-day owner reuses it only for the same facts identity, day, reset hour,
  span and recording-policy fingerprint. A one-day cap read followed by an eight-day
  runtime read expands the facts range and replaces the single projection cache;
  a smaller request is not proof of less work. The composed query-owner cases in
  `tests/protectionRuntimeInputProvider.test.js` distinguish cold, warm, revision
  invalidation and TTL expiry, with nudge configured both OFF and ON.
- `statsFactsQueryService` owns a single fresh canonical read after its privately
  branded revision invalidation, including invalidated shared queries. It emits
  debug `STATS_FACTS_QUERY_REVISION_RETRY`; the second attempt's settlement ends
  recovery. Repeated invalidation and repository failures reject. Stale facts,
  empty-range substitution, alternate storage, timers and write replay remain
  forbidden. The Active stats baseline and focused query tests own this contract.
- dashboard status, rules, and site-detail DTOs come from named read-model
  owners; UI code does not repair or reinterpret facts.

## Content-Flow Telemetry Contract

Feed-flow snapshots cross the content/background boundary as cumulative,
content-free observations. `trackingSpecialRuntimeHandlers` resolves the
trusted sender tab, document, and URL, then carries
`{ tabId, documentId, normalized hostname }`
through `TrackingProtectionService` into
`FeedFlowRuntimeStateOwner`; `ProtectionRuntimeStateCoordinator` remains the
background-app delegation facade, and hostname alone is not a source identity.

The protection domain owner owns live accepted order and projection per tab:

- `(checkedAt, snapshotRevision)` must advance within a tab session. An exact
  repeated tuple with identical content is idempotent; a conflicting duplicate
  or a revision regression is an explicit error.
- Live burst metrics may reset while the detector state remains unchanged.
  This owner neither calculates historical deltas nor gates historical facts
  by the detector state. Metric comparisons are diagnostic projections only.
- the host-level feed snapshot remains a derived runtime/diagnostic projection
  over the bounded per-tab cache. Clearing a protection-runtime projection
  does not discard the per-tab live ordering baseline.
- document loading and tab removal clear the matching per-tab source state.
  The in-memory source cache is capped. It may prune only an expired
  `state=none` source whose episode has explicitly ended; if no such entry is
  available, admission fails with
  `PROTECTION_FEED_FLOW_SOURCE_CAPACITY_EXCEEDED` instead of evicting an active
  source and losing live source-order validation.

`FeedContentFlowHistoryAccumulator` owns cumulative history per producer and local
hour. `feedContentFlowHistory.js` owns its exact content-free DTO and metric
projection. Each DTO carries producer UUID, bucket start, interval start, last
changed observation time, sequence, and cumulative counts/maxima. Heartbeats
retain history sequence/time. OFF-to-ON rotates the producer and rebases existing
progress; mixed pre-consent dwell is excluded until a fresh burst. A detector
`none` does not suppress observed progress. Pressure/interrupt counts are retained
as detector diagnostics and are not analysis evidence.

`behaviorTelemetryRecorder` binds that DTO to the trusted document and hostname.
`statsCollector` compares it with `feedHistoryReceipts` from the canonical loaded
hourly facts, applies only the additional count/max contribution, and updates its
receipt synchronously. The materializer writes both into the same `stats_hourly`
row through `StatsAggregateRepository.upsertHourlyFactBuckets`; there is no
separate session watermark or receipt writer. Same-source regressions/conflicts
fail; old or duplicate delivery still awaits the existing dirty durable barrier.
Worker recreation hydrates receipts with the facts. A live cache duplicate is
therefore still submitted to this independent durable owner.

The optional `feedHistoryReceipts` field is absent when no receipted contribution
exists; a present empty/malformed field is invalid. Receipts are bounded to 256
document/producer pairs per hour, fail explicitly at capacity, inherit hourly
retention/export, and contain no DOM, input text or URLs. Bucket identity uses its
stored offset on reads, never the machine's later timezone. Receipt count sums
and maxima cannot exceed the corresponding persisted domain facts. Daily summary
copies are derived materialization only and are never the replay admission source.

Selected Sites detail scopes `feedHistoryReceipts` and
`interventionHistoryReceipts` to the same managed-domain set as the projected
domain facts before normalization. Receipt identity/shape is still validated;
selected receipts retain their fact-coverage checks, and an empty scoped receipt
set is omitted. The shared historical range is unchanged. This projection cannot
carry another site's receipts after removing that site's facts.

Analytics deletion installs an empty current-hour row with `feedHistoryResetAt`
in the same transaction that clears history. A pre-reset interval receives a
successful live ACK requesting a producer reset; it contributes no facts. The
content owner rebases at its latest raw observation, rotates its producer, and
resumes only new observations. This marker contains only the deletion timestamp;
deleted observations and receipts are not retained as tombstones. Full profile
reset continues through the terminal profile-mutation owners.

Feed snapshot acceptance is a three-stage owner protocol: the protection
domain owner first prepares the live snapshot without advancing its per-tab baseline,
the stats owner durably admits cumulative history when present, and only then does the domain owner
commit the prepared snapshot with an expected-order check. The runtime message
channel stays alive through all three stages and acknowledges the content
sender only after commit. A failed stats write leaves live ordering unchanged;
the historical receipt/facts remain paired, so retry cannot apply a count twice.
The trusted URL lookup -> boundary normalization -> prepare -> durable stats ->
baseline commit -> commit ACK path runs in a per-tab bounded FIFO built from the
same keyed commit primitive as the aggregate signal lane. Its depth is eight,
its active-tab capacity is 128, and its 1.5-second enqueue-to-response lease
sits inside the sender's two-second timeout. A running timeout poisons the tab
until the original task settles, so it cannot open a second writer; snapshots
are not coalesced by the live owner. Same-hour later cumulative messages can cover
an earlier delivery failure. Unacknowledged data at hour rollover/page exit remains
best effort: this contract guarantees idempotent durable admission, not lossless
delivery. Old-day history is rejected rather than backfilled. The content-captured hostname is fixed before enqueue and must match the
trusted sender/tab hostname resolved when that entry runs. A queued old document
therefore fails loudly instead of being attributed to a hostname reached after
navigation. Structured-clone input is validated once at the background message
boundary, recursively frozen, and then marked in-realm, allowing the protection
owner to consume the exact immutable canonical object without repeating
normalization.

Protection refresh is a derived post-commit projection, not part of the feed
commit ACK. Its separate map admits at most 128 tabs and stores only one running
plus one latest pending request per tab. A 1.5-second timeout is diagnostic: a
hung operation keeps ownership until it really settles, so timeout never opens
overlapping refresh work. Failure, timeout, or capacity pressure cannot report
an already durable feed commit as failed. Each actual refresh first reads the
current tab URL and requires its hostname to match the committed source;
navigation mismatch, missing URL, and lookup failure skip dispatch with named
diagnostics. A later canonical feed/runtime update is the recovery path, so the
lane neither retries indefinitely nor sends an old-host projection to a new
document.

The separate content-flow signal message is an exact V1 union containing only
`scroll_spike` and `short_media_attention`. It carries no hostname or behavior
context; trusted sender-tab identity supplies the hostname. Raw scroll frames,
click/backspace/drag/history/video-skip events, and feed pressure aliases are
not admitted. Scroll spikes are reduced at the source to exact
`{ scrollSpikeBursts, fastScrollBursts }` counts in a ten-second window, split
at local-hour boundaries, capped at 10,000 observations per batch and eight
pending batches. A saturated source drops further observations and emits only
one diagnostic per saturation episode, avoiding an exception/log storm on the
wheel hot path; revocation/re-enable also resets that suppression state. The
open bucket caches numeric local-hour bounds; accepted spikes use range/count
checks and resolve a new `Date` boundary only when a bucket is opened. Same-day
delivery keeps the observed hour. A batch delayed past midnight preserves its
exact counts but uses the actual flush day/hour, so it cannot become a stale historical write;
this is current-day attribution rather than correction/backfill. Only one batch
per document is in flight; normal scheduling starts the next send ten seconds
after the prior ACK. The sender waits at most
two seconds for the durable stats acknowledgement for either signal variant and
does not retry counters that do not yet have
a durable idempotency key. Background commits are also serialized per trusted
tab through a FIFO capped at eight in-flight-plus-pending operations, so a
scroll batch and short-media signal cannot race into concurrent stats writes;
the active-tab map is capped at 128 and each enqueue-to-response lease, including
FIFO wait, is capped at 1.5 seconds. This leaves 500ms inside the sender's
two-second delivery timeout for the named failure response. A running timeout
poisons that tab until its original task really settles, so queued leases are
released without starting an overlapping writer. Capacity
overflow fails with a named error. Short-media source emissions are reduced for
one second to bounded `{ watchMs }` aggregates so concurrent videos preserve
exact watched time without producing one message/write per video. Its window
clock keeps completing batches independently of ACK latency; delivery is
single-flight, at most eight completed windows wait behind it, and one active
window admits at most 10,000 source reports. Active-window or queue saturation
drops only the excess report/window with explicit dropped-watch-time diagnostics
rather than silently stretching the window or growing memory. Each batch keeps
its final accepted source `observedAt` when delivery remains on the same local
date, so an hour-boundary ACK delay does not move the observation. Only a batch
delayed past local midnight is rebased to its actual flush time, preserving
current-day admission without writing a stale historical row.
Policy-off recording allocates neither a counter nor a timer, and policy
revocation discards the active partial window and completed unsent batches.
Visibility-hidden, `pagehide`, and `beforeunload` seal the partial short-media
window and initiate only a best-effort drain. The background policy check is the queue
admission linearization point; a non-idempotent write already admitted before a
revocation may finish, but is neither retried nor overlapped. All
visibility/page-exit drains are best effort. For scroll specifically, the
twelve-second scheduling-plus-ACK window describes one partial batch, not the
whole queue and not unload durability.

## Domain Collection Observation Contract

- `stats-domain-collection-observation-v1` is the current projection DTO for
  per-domain collection provenance. It carries the observed state, exact source
  domain count, first/last capture timestamps, and the canonical collection-mode
  sets that were present on the owned domain facts.
- A stats-day row and a domain observation are separate facts. A global
  `hasStatsDay` marker says only that the date-level stats row exists; it must not
  make every domain on that date observed. Domain series, selected-site facts,
  and hourly data coverage derive observation only from the domain collection
  DTO.
- An owned domain row with valid collection provenance and zero usage is an
  observed zero. A missing owned domain row is unobserved. Read models preserve
  that distinction through weekly/baseline series and Site Pull coverage instead
  of inferring coverage from zero-filled 24-hour arrays.
- Multi-date and activity-day window projection scopes domain provenance to the
  included hours. Repeated dates for one exact domain extend the capture range
  without inflating `sourceDomainCount`; later canonical-root aggregation may
  sum that count only across distinct owned domain rows.
- Site intel takes today's hourly and nested session/behavior/navigation facts
  only from its explicit `todayProjection` owner. A positive registry total,
  weekly row, or current hour must not repair an empty/missing today projection,
  and today's shape must not be copied into an empty habit-hourly reference.
- Selected Rules detail uses the same longest-managed-target owner resolution as
  the Rules registry. When managed roots are nested, each exact observed host is
  projected into only its longest canonical owner set; usage, transitions, and
  intervention-effect reads must use that owned set rather than suffix-expanding
  across a more specific managed root. Owned transition/effect reads address
  those index keys directly and do not scan every indexed domain.

## Failure Policy

| Condition | Required result |
| --- | --- |
| missing current key with documented bootstrap owner | initialize current V1 value |
| existing `null` checkpoint or malformed nested checkpoint | explicit checkpoint contract error |
| malformed/current key with wrong record | explicit error |
| existing malformed log/domain/CLSE key material | explicit error; never rotate or treat as missing |
| backend read/write rejection | explicit owner error and diagnostics |
| stale read cache revision | cache miss or explicit invalidation error |
| unknown collection/model/storage ID | explicit error |
| pre-baseline developer profile | manual whole-profile reset; no runtime conversion |

## Guardrails

- `npm run check:release-v1:baseline`
- `npm run check:storage:architecture-boundaries`
- `npm run check:stats:read-model-architecture`
- `npm run check:tab-time-tracker:architecture`
- `npm run check:background-kernel:architecture`

A real post-public V2 requires a separate architecture decision naming the
owner, transition boundary, telemetry, tests, and retirement condition. The
repository does not keep a speculative upgrader for that future decision.

## Sites current-recording read admission

The shared dataCollectionPolicy owner governs collection and historical read
admission. Sites requests are checked against current SettingsService policy;
a stale caller fingerprint fails explicitly with STATS_SITES_POLICY_CHANGED.
Activity-day and Sites projections resolve admitted exact domains once, retain
longest-root ownership, and preserve an explicitly empty domain set as empty.
An empty selection must never expose unfiltered aggregate/hourly totals.

Recording-off and excluded protected domains retain settings and saved caps but
publish unavailable usage, not observed zero. Selected policy-only detail performs
no history/evidence IO. Runtime protocol budget projection reads the same admission
owner and suppresses stale time-derived inputs while preserving non-time protection.
No secondary timer, persisted privacy flag, history deletion or storage owner is
introduced. See stats-engine-baseline and protection-settings-propagation-policy
for the DTO and runtime details.
