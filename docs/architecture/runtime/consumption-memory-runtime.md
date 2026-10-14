# Protected consumption memory runtime

- Status: Active
- Owner: tracking / behavior consumption / platform model storage
- Last validated against code: 2026-10-07
- Path policy: current-only
- Canonical for: browser-audible continuity evidence, observed interval join, durable consumption model checkpoint, purpose admission, and warm runtime memory read

## Scope and flow

The shared Shishi entry approval added on 2026-09-11 is owned by
`GateRuntimeStateOwner`, as specified in `intervention-admission-runtime.md`.
Consumption memory neither grants nor revokes approval. Its bounded Shishi
intensity consumer extends the foreground entry wait; pressure cannot summon a
Gate mid-use, and entry approval cannot suppress Enso/Furin. Operational ten-minute
departure is not certified rest and does not feed this model's outside law.

The descriptive memory model runs after the existing Tracking batch. Its first
live consumer is the Zen entry-checkpoint foreground wait. Gate
eligibility/passes, return/pruning/isolation, other themes, Furin debt/timing,
Enso and Feed/Mukheun tempo keep their existing policies. Synthetic comparisons
use the same intensity law; they do not certify human effectiveness.

```text
existing browser event ingress -> Tracking media continuity fence
existing one-minute Tracking batch -> admitted inventory/environment point
  -> same Tracking ledger: foreground facts + bounded audible intervals
  -> capture committed facts on the Tracking source lane
  -> one running + one replaceable latest post-fact observation (included in quiescence)
     -> committed admission exposure read
     -> one pure interval join -> one pure memory model
     -> epoch/revision CAS: memory and applied cursor in one model_state row
ProtectionRuntimeInputProvider -> Tracking warm memory read -> common context
```

## Owners

### Frozen Gate recent-use description (2026-09-11)

`src/domains/protection/domain/gateRecentConsumption.js` projects the same raw
`consumptionContext.usage.latestProtectedRun` into `gate_recent_consumption_v1`.
It describes committed foreground duration and the last observed endpoint across
contiguous protected domains. It neither calls this a complete session nor
counts entry attempts, extrapolates missing time, or calls time since the last
record rest. A newly observed noncontiguous run replaces the prior run, exactly
as the Tracking fact owner specifies. This is distinct from the slower-decaying
consumption memory used for intensity.

`ProtectionRuntimeInputAssembler` selects it once into entry/return telemetry;
the existing TrackingProtectionService → canonicalArtifactTelemetry → Gate
session metrics path carries it. `GateInterstitialController` validates/clones
the DTO and preserves the existing episode's value on revalidation. The DTO has
`contract, status, evaluatedAt, reason, lastObservedAt, foregroundMs`; unavailable
observations use explicit reasons and null values, never invented zero use.
Missing older-session capability is omitted, not repaired from live/history
reads. All new assembled entry/return candidates carry it. Collection disabled,
unobserved, superseded and clock-regressed coverage cannot display retained
numbers. Malformed present data rejects with a named error.

The minimal Zen Gate does not display this DTO. Its validated transport remains
available to the existing session owner and QA; it adds no UI counter, history
query or content observer. It is not an assertion of attention/media consumption.

| Concern | Owner |
| --- | --- |
| Browser ingress fence before async admission/per-tab queue | `src/domains/tracking/background/trackingBrowserEventHandlers.js` -> `TabTimeTracker.invalidateConsumptionMediaObservation` |
| Existing inventory acquisition and collection scope | `src/domains/tracking/background/trackingTabActivityBatchSettlement.js`, `trackingConsumptionEnvironment.js` in the same folder |
| Worker-local media window and receipt revision | `src/domains/tracking/background/trackingConsumptionMediaWindow.js`, owned by `TrackingConsumptionLedger.js` in the same folder |
| Foreground facts, writer serialization and quiescence | Existing `src/domains/tracking/background/TrackingConsumptionLedger.js`; session schema unchanged |
| Continuous collection admission proof | Existing `SettingsService` through `src/apps/background/services/settingsCollectionAdmission.js`; warm worker-local boundary, no new persisted settings/history |
| Interval interpretation | `src/domains/behavior/consumption/consumptionObservedIntervals.js` |
| Model commit and warm read | `src/domains/behavior/consumption/ConsumptionMemoryService.js`; pure law in `consumptionMemoryModel.js` in the same folder |
| Typed durable record and snapshot | `src/platform/storage/model/ConsumptionMemoryCheckpointRepository.js`, `ConsumptionMemoryCheckpointContract.js`, `ModelStateSnapshotContract.js` |
| Tracking profile drain/reset composition | `src/domains/tracking/background/trackingProfileMutationRuntime.js`; delegates existing admission/source/session owners |
| Frozen entry intensity | `src/domains/protection/domain/shishiConsumptionLevel.js`, selected only by `ProtectionRuntimeInputAssembler`; existing Gate metrics/session transports it to `src/apps/gate/gateShishiRitual.js` |
| Profile generation and collection admission composition | `src/apps/background/services/runtime/backgroundKernelCoreServices.js`, existing `ProfileResetLifecycleRepository` |
| Presentation evidence | Existing `InterventionAdmissionService`; no second exposure writer |

No browser listener, observer, tab registry, content report, independent tick,
retry timer or fallback is added.

## Browser-audible evidence

The exact media DTO is `{ contract: 'consumption_browser_audible_window_v1',
observedThroughAt, intervals: [{ startedAt, endedAt }] }`. Only positive
intervals are retained. An empty list does not prove media absence or rest.

A bridge requires two enabled, protected-audible-positive inventory points,
the same settings version, no intervening browser ingress fence, and no fence
or settings change during either inventory. Every existing tab/navigation/focus
event invalidates continuity synchronously before queued work. Even unrelated
events can sacrifice a bridge. This avoids a new per-tab registry and never
multiplies time by the number of audible tabs.

The maximum bridge is **120 seconds**, twice the existing **60-second** Tracking
beat: normal delivery jitter is admitted, missed long gaps are rejected. Retain
**one hour / 256 intervals**, matching the existing bounded context horizon.
These are observation bounds, not another cooldown/timer. Worker recreation
loses anchors; a new point is required. Browser sleep below the bound,
delayed/coalesced platform events, intra-interval schedule/scope changes and
`Tab.audible` semantics limit precision. This is browser-signal continuity,
not proof of attention or exact playback time. Silent video is not certified.

Point-only callers may explicitly omit continuity receipts; they cannot create
media intervals. Failed inner settlement does not publish its point. Background
stats may still await their outer batch save after point publication; this is
not a cross-store atomic commit. Settings reapplication can break a media bridge
but never resets durable memory.

## Ordered interpretation

The post-fact task reads retained confirmed protected foreground contexts,
positive media intervals and the existing admission exposure window. It splits
at all boundaries and covers exactly the committed cursor through the current
batch boundary. Interval precedence is:

1. Before the positively observed continuous collection admission boundary,
   missing exposure coverage, or uncertain occupancy -> `unknown`.
2. Acknowledged presentation and confirmed end -> `intervention` (freeze).
3. Confirmed protected foreground -> `protected_use`.
4. Positive protected browser-audible continuity -> `protected_media`.
5. Otherwise -> `unknown`.

Foreground/media overlap contributes once. No outside time is fabricated from
silence or broader consent. The existing pure law remains: use time constant
**30 minutes**, outside half-life **10 minutes**, unknown aging half-life
**90 minutes**. The live adapter produces no certified `outside`; these are
product assumptions, not human-study findings. Switching remains unevaluated.

An open admission reservation/presentation is not finalized yet. The admission
snapshot publishes `settledThroughAt`: the earliest open reservation, clipped to
its retained coverage. Model commits stop there. After confirmed end, the next
ordinary batch applies the now-final interval once; no timer or end-triggered
replay is added. Uncertain closed/disappeared intervals are final unknown.
Retrospective reads clip retained history even if admission committed after the
query timestamp; only a query before retained coverage is ahead-of-query.
If an owner stays open beyond the one-hour window, the lost prefix becomes
unknown and only the retained suffix waits. This bounds waiting evidence.
A crash after stats ACK but before model CAS can lose worker-local media;
retained foreground/exposure within proven continuous collection admission can
replay, while unproven/lost/trimmed evidence is unknown.
This is not a durable raw observation journal.

The admission owner shares one `beginExposureRecording()` initialization promise.
Every admission operation enqueues initialization before its own work, including
presentation callbacks that can await stats. The first enabled post-fact task
joins that same promise, never a later admission operation. This ordering also
prevents analytics reset from waiting on a model task whose initialization is
behind a presentation callback waiting on that reset. Recording starts at the
initialization commit, without rewriting existing owner/cooldown or fabricating
earlier clear time. It is not a candidate or exposure. Failure rejects the
dependent operation; a later admission operation or existing batch can retry.
The source/stats lane never waits for this work. Subsequent observation uses
passive `readExposureSnapshot()`; it does not reconcile or join the admission
mutation lane.

### Descriptive failure isolation

Tracking owns two serialization tails: source facts and derived model work.
`runAfterFacts` retains one running job and one latest pending job. Superseded
pending callers receive `coalesced`; no owed intervention is dropped (these are
observation jobs, not dispatch candidates). Execution captures retained committed
facts on the source lane and the join clips them to the requested time. This
also bounds retained snapshots when source I/O is slow. The durable cursor and
bounded fact/exposure windows recover intervening evidence; trimmed gaps remain
unknown. `resetAfterFacts` drains accepted work and fences new model submissions
through the explicit model/source erasure barrier. Source reads/writes and the existing
schedule/cap/nudge checks never await model IDB or exposure initialization.
`trackAllTabsBatch` exposes `memoryCompletion` for explicit completion consumers;
ordinary ticks do not wait for it. No second scheduler or independent timer exists.
Initialization/read/join/CAS failure publishes the explicit `failed` memory state
and the `[consumption-memory] Observation unavailable` diagnostic, without
substituting a score or failing the source batch. The next explicit batch can
retry from the durable cursor. Profile quiescence drains **both** tails, and
analytics erasure waits for preceding model work before its revision-fenced reset.
This isolation is the descriptive-model contract, not a silent recovery path.

## Durable record and consent

Existing IndexedDB `model_state` stores one key `protected_consumption_memory_v1`
with shape `{ contract, profileEpoch, stateRevision, model, policyEvidence? }`.
`model.throughAt`, `sequence` and `lastInput` are its applied cursor. No duplicate
cursor, domain/tab identity, URL, title, input content or raw history is stored.
No store/index topology change or Chrome/localStorage mirror is introduced.

The profile lifecycle owner resolves and admits the expected generation. The
typed model read verifies it and the installed aggregate root; null is not an
epoch discovery fallback. Commits use the existing atomic revision/epoch CAS.
State and cursor advance only after ACK. A failure exposes `failed` without a
speculative projection. The next explicit batch rereads the canonical record
and may retry; there is no hidden retry loop. Snapshot export/merge rejects any
durable model epoch that differs from the installed header/aggregate before
rebasing; key-specific error codes do not limit that invariant.

Initialization is the first explicit admitted observation commit, with zero at
that boundary, not proof of a rested person. Warm reads never initialize or
restore. Workers start `not_ready` until observation restores the row, rather
than offering a new zero baseline. Unobserved restart gaps age as unknown;
browser-session fact loss does not delete this durable row.

Admission follows existing **domain usage collection consent**, not a new
precision-input/CLSE permission. SettingsService provides a warm
`{ enabled, observedSince, revision }` proof at its canonical cache-apply boundary.
A revoke invalidates proof before settings persistence awaits; OFF/ON changes
revision even within one millisecond or between Tracking batches. A canonical
collection/protection-scope change suspends admission and advances both proof
revision and settings observation version before the persistence await. Its ACK
resumes continuous consent from the original `observedSince`; it does not erase
admitted foreground preceding an unrelated scope edit. Failed writes may have
reached storage, so they invalidate continuity. Failed hydration and a scope
change discovered by hydration also invalidate it. The next successful
hydration starts new proof. Uncertain external writes invalidate it before
invoking that owner. Repeated unchanged cache application preserves proof.
The settings version is a monotonic observation generation, not a count of
successful writes: uncertainty may advance it without a commit. Both captured
model tokens and browser-audible anchors are fenced by these boundaries.
Proof time cannot move backwards within a worker. Only admitted foreground and
scope-filtered audible evidence enter the join, and **all** evidence (including
operational intervention history) before `observedSince` is unknown.

OFF suppresses observation reads/writes and returns `disabled` without the warm
projection. The task captures admission when the source batch completes and
checks its settings version, proof revision and enabled state before I/O and
synchronously immediately before IndexedDB put. Re-enable preserves the durable
memory, returns `not_ready` until the next successful observation, and cannot
backfill OFF-period exposure. A failed observation returns `failed` until retry.

This positive proof is intentionally worker-local. After worker recreation,
current persisted ON does not certify earlier consent. The uncommitted prefix
before first settings hydration is unknown, even if retained foreground or a
completed exposure is available. Already committed memory/durations are kept;
no fresh zero is offered. This can lose up to the pending interval at restart
(not bounded to one tick if commits were failing). It is explicit observation
loss, not a claim of outside/rest. A future durable consent-interval contract
would be required to certify that prefix; settings/history is not reconstructed
from defaults or operational admission. No second settings source is introduced.

Explicit Tracking analytics/debug/runtime reset commits an empty model before
clearing source checkpoints. Its new revision fences stale writers and has no
retained duration/history. Full reset/import instead uses the existing terminal
drain and transaction; it then discards warm state without recreating storage.
Export validates the row. Import validates/rebases both checkpoint and model/input
epochs. Ordinary settings reapplication never invokes these erasure seams.
Settings propagation validates the existing foreground source; it cannot reopen
a closed segment or replace the start of an admitted live segment. A revoked
source is retired by the canonical sealer, including its paused session cursor;
re-entry requires the ordinary foreground observer.

## Read and action boundary

`TabTimeTracker.getConsumptionMemorySnapshot({ now })` is synchronous and warm.
The provider exposes its validated DTO as `consumptionContext.memory`, with
`not_ready`, `disabled`, `failed`, `ahead_of_query` or `ready`. Only ready contains
the pure projection. Reads never query IndexedDB, advance a cursor, enqueue
work or request an intervention. `pressure: not_evaluated` denotes the
unadopted global pressure taxonomy, distinct from descriptive memory and its narrow entry-intensity consumer.

## Policy evidence and first live actuator

The current optional checkpoint/projection capability `policyEvidence` is exact
`{ contract: 'consumption_policy_evidence_v1', throughAt, lowerMemory, upperMemory }`.
It is a range under this model's laws, not a probability or mental-state label.
Known intervals apply the same pure evolution to both bounds. Unknown/disabled
intervals and read gaps evolve the lower bound as possible outside and the upper
as possible protected use. The nominal unknown aging remains unchanged. Bounds,
nominal model and cursor commit atomically in the same typed row; import/rebase
and erasure preserve their consistency. No new pressure store or history exists.

An existing current checkpoint without this capability retains its model and
starts evidence at [0,1] at that cursor on the next admitted commit. Missing
capability is explicit unavailable evidence, never zero or another storage
read. A new explicitly initialized model starts [0,0], which still does not
certify rest. The typed validator rejects malformed bounds/cursor/nominal
containment. This capability absence seam is owned here and guarded by the
checkpoint/runtime tests; it exits as each retained row is next observed.

The input assembler alone selects `shishi_consumption_level_v3`. Non-ready
reads, unavailable capability, unobserved/disabled/intervention coverage and
observations older than **120 seconds** retain baseline with an explicit reason.
For usable evidence, smoothstep(lower memory) proposes at most **3600ms** extra
foreground entry wait. The difference between upper/lower proposed effects
measures the possible policy error: at **150ms** or above retain baseline; below it taper the
extension continuously by (1 - error/150ms), then quantize to **50ms**. Band
labels do not alter the curve. The nominal score is never replaced with zero.
120s matches two existing 60s observations; 150ms bounds uncertainty in visible
policy effect; 50ms avoids meaningless precision. These are provisional UX
bounds, not empirically established psychological thresholds.
The 2026-09-11 timing expansion retains the absolute 150ms uncertainty limit;
it does not scale that limit with the larger effect. Consequently some ambiguous
observations that previously yielded a small extension now retain baseline.
This is withholding an unsupported stronger effect, not erasing memory.

The controller deep-copies the selected value to existing
`session.metrics.shishiIntensity`, preserving it on session reuse regardless of
later model/settings reads. The repository validates it. Existing metrics
carry it through canonical telemetry/payload/session routes. The UI reads only
the admitted session and adds `waitExtensionMs` to the **10s** foreground wait.
Only Zen `entryCheckpoint` consumes it: baseline is 10s, maximum 13.6s. Return
uses 10s, while isolation renders the existing Torii boundary. Hidden/unfocused
time is paused. Completing that foreground wait submits Continue without an
extra action. Clicking the bamboo pours and leaves in about 1s at every intensity;
there are no separate visible Leave/Enter controls.

These are provisional product timing choices, not measured psychological
thresholds. Entry eligibility, configured hold/pass semantics and shared entry
approval remain separate. Stats retain extension/reason in their existing
intensity vector. The session-only DTO version is `shishi_consumption_level_v3`;
new/retained entry sessions require this valid shape. Missing, malformed or stale
contracts fail explicitly rather than using a read-time compatibility path.
Trusted QA creates an explicitly labeled baseline or maximum value without
writing model history or taking another session. The named runtime target
checks transport and the native wait/action.

No gate omission, forecast-based Furin suppression, restorative outside producer,
switching penalty, pressure labels or UI statistics ships with this consumer.
Those require separate policy/evidence review.

### Meaning of non-protected foreground

`environment.foreground = outside` describes one inventory point: a positively
focused web tab, admitted by collection consent, that is outside the current
protected scope. It is not an interval and does not prove that protected media
or silent content was absent between points. Neither a tab switch nor a short
non-protected visit resets a streak or the durable memory. The live join records
such an uncertified gap as `unknown`, with nominal slow aging and widening
policy bounds. The 10-minute outside half-life remains a pure-model capability,
not an enabled browser recovery policy. Certifying an outside interval would
require an explicit evidence contract under the same Tracking owner, including
focus, media, scope/consent changes, sleep and worker loss; no additional signal
collector or inference from absent events is admitted by this change.

## Verification

`tests/consumptionMemoryRuntime.test.js` runs the actual typed repository and
ModelStateStore on fake IndexedDB transactions: replay, service recreation,
failed put, consent races, snapshot rebasing, erasure fences, media boundaries
and interval union. Tracking/provider regressions protect composition, reset,
quiescence and unchanged decision inputs. This does not substitute for named
browser/MV3 evidence or human calibration.

`gate/entry-checkpoint/consumption` adds real local-page/browser evidence using
ordinary Tracking beats: a nonzero bounded level reaches the actual authorized
Gate, stays frozen across worker recreation and completes through the foreground
wait, without an additional Enter action.
Further protected consumption, a five-minute uncertified outside interval and
protected return must retain the same entry approval with exactly one exposure.
The test keeps ordinary entry enabled throughout. Short outside observation is
not certified recovery; band/cap and longer pattern comparisons also remain
covered by the real-owner integration and pure-law regressions.
