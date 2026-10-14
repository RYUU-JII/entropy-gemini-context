# Behavior Engine Documentation

- Status: Active
- Owner: behavior domain
- Last validated against code: 2026-10-01
- Path policy: current-only
- Canonical for: behavior domain baseline and runtime responsibilities

## 1. Scope
`src/domains/behavior` is the CLSE (Cognitive Load Sensing Engine) module.
It collects user interaction signals locally, aggregates them into time buckets, detects overload patterns, and emits alerts/events.

## 2. Module Boundaries

### Runtime Orchestration
- File: `src/domains/behavior/CLSEService.js`
- Responsibility:
  - Feature runtime lifecycle (`initCLSE`, `syncCLSEFromStoredSettings`)
  - Collector startup/shutdown
  - 10s -> 60s -> 5min rollup pipeline
  - Baseline update trigger
  - Event bus and alert broadcast

### Settings Persistence
- Files:
  - `src/apps/background/services/SettingsService.js`
  - `src/domains/tracking/background/CLSEMessageHandler.js`
  - `src/domains/behavior/clseSettings.js`
- Responsibility:
  - Canonical persistence for `clse_enabled`, `clse_sensitivity_scale`, `clse_alert_cooldown_ms`
  - Settings patch normalization and routing through the shared settings apply pipeline
  - Runtime adapter handoff from persisted settings into `CLSEService`

### Data Schema and Constants
- Files:
  - `src/domains/behavior/clseSchema.js`
  - `src/platform/storage/clse/clseBaselineStorageContract.js`
  - `src/domains/behavior/clseBaselineReadContract.js`
- Responsibility:
  - Bucket schemas (`10s`, `60s`, `5min`)
  - Exact persisted baseline record and first-run value
  - Dashboard-safe baseline status/read projection
  - Store names and constants

### In-memory Buffer
- File: `src/domains/behavior/data/RingBuffer.js`
- Responsibility:
  - 10-second bucket write path
  - Counter/update helpers (`increment`, `add`, `set`, `updateWelford`)
  - Recent bucket extraction for spike analysis/rollup

### Collectors (Signal Ingestion)
- Entry: `src/domains/behavior/collectors/index.js`
- Files:
  - `ActivityCollector.js`: active/idle time
  - `TabCollector.js`: tab switch/open/focus visibility
  - `NavCollector.js`: navigation/same-site/cross-site/back-forward
  - `ScrollCollector.js`: scroll event/abs delta/dir change/velocity samples
  - `ContentCollector.js`: content/feed growth
  - `MediaCollector.js`: seek/rate/play-pause changes
  - `CLSEGate.js`: pluggable allow/deny gate
  - `CLSEContentReporter.js`: content-script side batched reporter

The content-side mutation lease and feed-item seed/subtree scan are owned by
`BehaviorHub` only while precision insights are allowed and
`CLSEContentReporter` reports active collection demand. Precision OFF or CLSE
collection OFF releases that shared observer subscription and clears
selector/seen state; Feed Flow keeps its own separate `ObserverHub`
subscription and does not consume this CLSE scan. A transient unsubscribe
failure keeps mutation callbacks disabled, retains the owner handle, and uses a
bounded cleanup retry instead of forgetting the lease.

The single wheel observer is leased by `BehaviorHub` whenever canonical
precision admission is active, independently of whether the scroll-friction
intervention or CLSE reporter is enabled. That shared observation feeds the
coarse spike accumulator and, when present, the CLSE reporter; scroll-friction
does not acquire a duplicate no-op subscriber. When no CLSE reporter exists,
the wheel callback stops after coarse spike admission instead of running the
optional scroll tracker, and the shared orchestrator does not construct the
previously unused ancestor `targetPath`. The scroll DOM observer remains
CLSE-only. Video `seeking` remains attached for the independent behavior-judge
contract, while CLSE-only `ratechange`/`play`/`pause` listeners are not attached
without a reporter. `BehaviorHub` installs neither observer during telemetry-off
initialization. The separate aggregate content-flow message is not a generic
behavior bus: its exact V1 contract admits only
`scroll_spike` and `short_media_attention`, awaits a background durable ACK with
a two-second sender bound for every variant, and
never sends raw scroll frames, click/drag/input events, page content, hostname,
or the hub's live filter context. Wheel spikes are counted locally for ten
seconds and sent as bounded `{ scrollSpikeBursts, fastScrollBursts }` batches;
the raw pixel delta never crosses the message boundary. The source keeps one
delivery in flight, caps each batch at 10,000 and the pending queue at eight,
and drops further source observations with one saturation diagnostic instead of
throwing on every wheel event; that diagnostic episode resets when admission is
revoked and re-enabled. It does not retry a failed non-idempotent count batch.
Sender failures remain one `warn` console argument, formatted through
`runtimeDiagnosticConsole` by `src/domains/nudge/core/telemetry.js`. The flat
diagnostic names `messageType`, aggregate `kind`, and the actual sender phase
(`validation`, `transport`, or `commit_acknowledgement`) together with the error
and its cause chain. It never includes the signal measurements or page context.
These phases describe the sender's observed failure boundary; a transport
`TIMEOUT` alone does not identify a background boot, queue, storage, or browser
failure. Deadlines and failed-batch retry policy remain unchanged. Coverage:
`tests/contentFlowSignalTransport.test.js` and `tests/runtimeDiagnosticConsole.test.js`.
The open bucket caches numeric local-hour bounds, so the wheel hot path performs
only range/count checks instead of rebuilding `Date` objects and formatted hour
keys for every spike. Local-hour changes split the batch so same-day attribution
remains exact. If delivery is delayed across a local-date boundary, the exact
counts are retained but attributed to the actual flush day/hour. This is an
explicit current-day admission rule, not a historical correction or backfill.

The public build includes this narrow local-only content-flow capability
independently of CLSE Labs. Admission is still enforced by the background
precision-insights policy for the trusted sender hostname; enabling the build
capability is not consent and does not enable CLSE collectors or overlays. A
non-admitted document creates no spike counter or timer; admission revocation
discards unsent counts. Visibility and page-exit drains are best effort and do
not claim unload-time durability.

Short-media reports from multiple tracked videos are reduced for one second to
one `{ observedAt, watchMs }` payload. The accumulator preserves exact total watched time
and treats each completed window as one stable attention observation. It keeps
the final accepted source `observedAt` for same-date delivery, including an hour
boundary, and rebases only a batch delayed past local midnight to its actual
flush time so current-day admission cannot create a stale historical write. Window
completion continues on its one-second clock while a prior durable ACK is
pending; delivery remains single-flight and the completed-window queue is
capped at eight, with at most 10,000 source reports in the active window. An
active-window or completed-queue saturation drops only the excess report/window
with an explicit, coalesced diagnostic and exact dropped-signal/watch-time
counters instead of extending the aggregation window indefinitely. Admission revocation
discards the active partial window and completed queue, but does not retry or
duplicate an already admitted delivery. Hidden/page-exit hooks seal the active
partial window and start only a best-effort drain; unload durability is not
claimed. The background per-tab content-flow FIFO is capped at eight operations
and 128 active tabs. Its enqueue-to-response lease, including FIFO wait, expires
after 1.5 seconds, leaving a 500ms margin inside the sender's two-second delivery
timeout. A running timeout releases queued response leases, poisons that tab
until the original task actually settles, and therefore never opens a second
writer over a hung non-idempotent commit.

Feed-flow snapshot delivery uses a separate lane built from the same bounded
keyed-commit primitive: depth eight, 128 active tabs, a 1.5-second background
lease, and a two-second sender timeout. Its FIFO covers trusted URL lookup,
boundary normalization, prepare, durable content-flow projection, baseline
commit, and the commit ACK; protection refresh is not part of that commit
lease. Running timeout poisoning prevents durable-writer overlap. Feed
snapshots are not coalesced because each accepted revision may carry a distinct
durable delta. The captured content hostname is fixed before queue admission
and must match the trusted sender/tab URL resolved when the entry runs, so a
queued old document cannot be attributed to a hostname reached by a later
navigation. The background message boundary validates, recursively freezes,
and marks the canonical snapshot once, and the state owner consumes that
immutable marked object without repeating the same normalization in the same
realm.

After a successful baseline commit, protection refresh enters a separate
derived per-tab lane. It holds at most one running request and one replaceable
latest pending request per tab, with at most 128 active tabs. A 1.5-second
timeout emits a diagnostic but does not release a still-running refresh or
start overlapping work; failure, timeout, or capacity pressure cannot turn the
already durable feed ACK into a failure. Before dispatch, this lane reads the
current tab URL again and skips with a named diagnostic if lookup fails or the
current hostname no longer matches the committed feed source. This seam has no
legacy fallback: a skipped refresh is recovered by a later canonical runtime
update rather than by projecting an old host into a new document.

### Detectors (Signal Interpretation)
- Entry: `src/domains/behavior/detection/index.js`
- Files:
  - `BehaviorAggressionScorer.js`: per-domain aggression score
  - `clseDetectionPolicy.js`: exact service-owned sensitivity policy and monotonic decision-threshold scaling
  - `LoadSpikeDetector.js`: 10s burst/spike detection
  - `SustainedLoadDetector.js`: multi-window sustained load detection
  - `LoopDetector.js`: repeated page/site revisit loop detection
  - `BaselineManager.js`: same-grain personal baseline learning/update/z-score

`BaselineManager` is descriptive only and carries no sensitivity setting.
`CLSEService` passes the current detection policy explicitly to the 10-second
and 60-second paths. A larger sensitivity scale raises both absolute decision
thresholds and positive-z lift thresholds; a smaller scale lowers them.

### Spike Protocol (Observe-only Contract)
- Entry: `src/domains/behavior/spike/index.js`
- Files:
  - `SpikeSignalSchema.js`: exact release V1 spike-signal DTO and validator
  - `SpikeProtocolEngine.js`: observe-only protocol snapshot builder
- Responsibility:
  - Admit only the current V1 signal fields; a CLSE producer must build that DTO
    explicitly rather than relying on old event names or timestamp aliases
  - Keep spike signals out of stats scoring and Zen bonsai damage
  - Produce `suggestedProtocol` hints without emitting nudges or interrupts

### Utilities
- Files:
  - `src/domains/behavior/utils/hmacKey.js`
  - `src/domains/behavior/utils/index.js`
- Responsibility:
  - HMAC-based privacy-preserving site/page keys for loop detection

The CLSE HMAC utility shares one initialization promise within its runtime.
It publishes the in-memory key only after importing validated stored material
or receiving the typed key repository's durable write ACK for a new key.
Read, crypto, and persistence failures reject all waiting callers and release
the initialization promise; a later call reads canonical storage again.
Failed initialization never authorizes signing with an unpersisted key.
The utility's explicit key reset blocks new acquisition, drains the current
initialization before deleting persisted material, and invalidates its cache
even if deletion fails. A later acquisition re-reads canonical storage; the
reset itself continues to reject its deletion failure.

### UI Overlay
- File: `src/domains/behavior/CLSEAlertOverlay.js`
- Responsibility:
  - Content-side alert rendering for CLSE events

## 3. Data Flow (Domain Units)

1. Background/content runtime first checks `precisionInsightsMode` through `dataCollectionPolicy`; collectors are disabled unless the active hostname is allowed for precision behavior analysis.
2. Collectors write metrics into the 10s ring buffer in memory.
3. `CLSEService` heartbeat analyzes completed 10s buckets for spikes/aggression logs.
4. Every minute, 10s buckets are rolled up into a persisted 60s bucket.
5. Every 5 minutes, persisted 60s buckets are rolled up into a 5min bucket.
6. At day rollover, CLSE writes a compact daily summary for long-horizon analysis, while detailed 60s/5min buckets stay on shorter retention tiers.
7. A completed 10s bucket is scored against the earlier `bucket_10s` profile,
   then admitted to its Huber-bounded online update. The completed 60s rollup
   follows the same compare-before-observe order against `bucket_60s`.
8. The materialized baseline persists only exact-grain evidence and online
   feature statistics. Sparse/forming/stable status and confidence are derived
   at read time, so freshness cannot become a second stored truth.
9. Detectors use an explicit normative-only mode until their own exact-grain
   profile is stable, then a risk-only bounded adaptive mode. Absolute risk is
   always the floor; positive same-grain deviation may add capped evidence but
   personal history can never lower or veto the normative signal. Detectors
   never borrow the other grain.
10. Aggression diagnostics carry the baseline reset epoch. Baseline flush,
    diagnostic persistence, and reset share one serialized repository order,
    while the store rejects stale-epoch writes in the same transaction.
11. Detectors emit events; service broadcasts alerts and keeps recent event cache.
12. Spike protocol snapshots may be built from exact V1 signals for diagnostics/future orchestration only. Malformed or predecessor event shapes fail loudly.

Spike protocol snapshots are not score ledger entries. They must not change `score`, `displayScore`, bonsai vitality, or any UI interrupt state. Until a future nudge/interrupt owner is introduced, the protocol mode remains `observe_only`.

## 4. Public API Surface
- `initCLSE`
- `syncCLSEFromStoredSettings`
- `resetCLSEBaseline`
- `resetCLSEData` (full app-reset owner; build-selected active/public implementation)
- `deleteCLSEData`
- `recordCLSEShortDwell`
- `getCLSEStatus`
- `getCLSERecentEvents`
- `getCLSEAlertState`
- `addEventListener`

## 5. Stability Rules Applied in Refactor

1. Async message listeners now return `true` and always resolve `sendResponse` to avoid message port close races.
2. Navigation callback invocation is fail-safe (Promise rejection and sync throw both guarded).
3. SPA navigation also flows into loop-detection callback path.
4. Baseline learning is same-grain, exposure-gated, one-step-lagged, and
   Huber-bounded so one anomalous bucket cannot classify itself or dominate the
   learned center.
5. Baseline status has hard day/sample/active-exposure gates. Confidence is a
   diagnostic projection, not a bypass around those gates.
6. Sustained-load severity history is bounded and escalation emits with cooldown to reduce alert spam.
7. Content reporter flushes once on stop and caps per-interval velocity sample growth.
8. Baseline reset writes a new empty typed record with a new reset epoch and
   clears every aggression diagnostic tied to the previous reset epoch in the
   same store transaction;
   there is no read-time migration, force-calibration command, or synthetic
   evidence mutation.
9. Full app reset never deletes the baseline row ahead of an active manager.
   It advances the canonical epoch first, then clears historical tiers; builds
   without the CLSE runtime clear all CLSE stores through the public reset
   implementation.

## 6. Privacy and Storage Notes
- No CLSE data is sent outside the device.
- Time-series buckets/logs persist in IndexedDB through the CLSE repository and typed stores.
- The online baseline uses the dedicated `clse_baseline` store. Its record is
  materialized model state, not a mirror of the raw bucket stores; malformed or
  predecessor shapes fail the current contract.
- 10s buckets are memory-only. 60s buckets, 5min buckets, and daily summaries use separate retention tiers so long-term analysis does not require retaining high-density detail.
- CLSE settings persist through the shared settings pipeline into canonical `chrome.storage.local` settings documents.
- Loop detector keys are HMAC-derived and non-reversible.
- `clse_enabled` is a service capability flag, not collection consent by itself. High-resolution behavior collection additionally requires `precisionInsightsMode: protected_sites` and protected-site membership for the active hostname.
- Click, drag, and input-derived behavior signals are not CLSE collection inputs and must not be reintroduced through engagement counters.
