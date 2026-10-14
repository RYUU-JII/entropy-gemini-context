# Intervention admission and recovery

- Status: Active
- Owner: protection background runtime / nudge presentation
- Last validated against code: 2026-10-13
- Path policy: current-only
- Canonical for: cross-document intervention admission, recovery, preemption and conclusion authority

## Owners

| Boundary | Owner | Contract |
| --- | --- | --- |
| Candidate evidence | Existing Enso reward/feed owners, ProtectionNudgeDispatchRunner, GateInterstitialController, page-media observer | Observations and usage/debt remain with their current owners. Admission does not reset them. |
| Browser-session admission | `src/domains/protection/background/runtime/InterventionAdmissionService.js` | One serialized lane reads/writes the session checkpoint, executes the existing pure admission kernel, and verifies document cleanup. No deferred candidate queue, alarm, or recovery timer. |
| Enso operational consumption interval | `src/domains/protection/background/runtime/ensoCadencePolicy.js`, composed by `InterventionAdmissionService.js` | One bounded browser-session counter in the admission checkpoint. The shared admission lane checks time eligibility and resets it after an actually presented reflection ends. |
| Enso projection delivery | `InterventionAdmissionService.js`, with the existing `runProfileMutationAdmittedTask` port from `backgroundKernelProtectionBindings.js` | One active delivery and one replaceable latest pending snapshot, outside the mutation lane and inside the profile drain lifetime. No policy decisions, persistence, retry or wake-up timer. |
| Enso foreground interval receipts | `src/domains/tracking/background/trackingEnsoCadenceBridge.js`, existing `trackingBrowserEventHandlers.js` / `trackingTickRunner.js` | Existing foreground/browser/idle ingress and minute inventory provide operational observations independently of historical collection consent. No added listener, timer, DOM observer, inventory query or historical writer. |
| Exact tab liveness | `src/apps/background/services/runtime/backgroundKernelProtectionBrowserPort.js` / `tabsGetLiveness` | Strict `tabs.get` lookup accepts only Chrome's explicit `No tab with id: N` for the requested tab as absence. Missing APIs, malformed replies and all other errors preserve ownership and fail explicitly. |
| Persistence | `src/platform/storage/runtime/InterventionAdmissionRepository.js` | Typed access to `chrome.storage.session` key `runtime.intervention_admission`. Absence initializes a new browser session. Malformed presence/read/write failures are errors, never RAM/localStorage recovery. |
| Content transport | `src/domains/nudge/runtime/interventionAdmissionClient.js` | One short pending reservation per document, exact lease lifecycle, local cleanup callbacks and document-bound control replies. No selection/ranking/cooldown authority. |
| Shared goal feed episode | `src/domains/nudge/feed-flow/FeedBoundaryEpisodeCoordinator.js` | Existing Site/Global eligibility supplies explicit goal demand; one exact goal-kind lease covers Horizon placement, encounter and Furin handoff independently of periodic Enso. |
| Goal semantic identity | `src/domains/nudge/runtime/goalEpisodeBinding.js` | Exact immutable host/day/targets/scopes/profile/tab/document binding; one pure relevant-policy signature, separate from appearance revisions |
| Goal authorization/priority read composition | `src/apps/background/services/runtime/backgroundGoalAuthorizationReaders.js` | Complete canonical runtime/settings/profile/session/daily reads fenced by the settings commit version; bounded semantic reread and ephemeral freshness proof |
| Goal invalidation | `src/domains/protection/background/protocol/dispatch/ProtectionGoalEpisodeInvalidator.js`, `src/domains/nudge/runtime/session/nudgeSessionGoalCancellationState.js` | Fence old authorization, retain cancelling session ownership, prove exact admission/content cleanup, then terminalize |
| Screen and input | `src/domains/nudge/runtime/ritualSurfaceArbiter.js` | Keeps document-local screen/input ownership. Ranking alone cannot suppress an ordinary intervention. Same-owner replacement requires the exact prior claim serial. |
| Destructive conclusion | `src/domains/protection/background/runtime/TabClosureArbiter.js` | Exact admission lease/document or Gate session identity, with authorization and browser operation in the admission lane. Delayed Enso/Furin conclusions cannot act on a replacement. |
| Exposure interval evidence | `src/domains/protection/background/runtime/interventionExposureWindow.js` | Same admission commit and source identity; bounded union of acknowledged presented intervals and uncertain reservation/end intervals. No independent journal writer or storage key. |

## Policy and scope

Enso-named cadence/kind/source owners below are internal execution vocabulary.
The user-facing periodic choice is **Tools -> Barrier -> Consumption interval**
(`소비 간격`), for both click and feed routes. It is independent of the Zen
Enso artwork in Veil and of Site/Global goal attainment.

### Goal-bound automatic Furin (P1-B, 2026-10-13)

Automatic Furin carries one exact `goalBinding` V1 through dispatch, session,
content preparation and admission. Its fields are `version`, `key`, `runId`,
`tabId`, `documentId`, `profileGeneration`, `hostname`, `dateStr`, `resetHour`,
`purpose`, `coveredScopes`, `siteTargetMs`, `globalTargetMs` and
`policySignature`. Uncovered targets are explicitly null. The binding does not
move to another tab/document/day or gain a scope when a new goal is reached.
Present invalid pending/owner bindings fail; there is no predecessor conversion.

`projectGoalEpisodePolicySignature` owns the semantic signature: relevant
recording mode/consent, Site host recording when covered, Global recording and
its contributing domains when covered, nudge enable, protection/application
and Furin eligibility. Covered goal values, day/reset hour and profile generation
have separate exact fields. Theme, language, curve appearance and an unrelated
global settings revision do not invalidate otherwise current work. Site needs
that host's recording basis. Global uses the independent canonical Global cap
basis; exclusion of the current host alone does not erase recorded Global time
from other admitted protected hosts.

The binding and `projectReadyGoalPriority` modules may import the pure typed
daily contract for date/receipt validation. This exact named seam does not allow
either module to import a repository/store; `furinDailyPolicy` remains the only
nudge-domain daily repository owner.

The service's `readGoalAuthorization` composition supplies fresh canonical
settings/runtime/activity-day/profile facts and a passive exact pending read.
`backgroundGoalAuthorizationReaders.js` brackets the complete async read with
the canonical settings commit version, allows one reread of that same owner,
and fails explicitly with `BACKGROUND_GOAL_AUTHORIZATION_READ_SUPERSEDED` if it
is overtaken again. Its ephemeral `isCurrent` closure fences later commits;
admission checks it before/after awaited writes and re-evaluates semantic policy
rather than cancelling merely because an unrelated version changed. This adds
no settings mirror, timer, deferred queue or migration path.
The same complete read proves the active top-frame document/hostname and exact
current scripting/origin permission as strict `documentCurrent` and
`permissionAvailable` booleans. Missing/invalid browser proof rejects authority;
it does not assume a surviving content script still has permission. Frame,
settings and permission APIs are separate observations, so final transition and
post-await fences remain necessary.
`validateGoalBinding` checks them; reserve, endpoint attachment, boundary
encounter and final authorization repeat the check. Content's
`authorizeGoal(lease)` uses `authorize_goal` before final Host preparation.
`validateGoalPresentation` also requires the exact document/lease/run binding
and current actual final-paint proof before the daily presentation writer can
commit. Appearance changes cannot mint a new binding or a displayed receipt.
An in-flight relevant ingress increments `goalAuthorizationRevision`, so an
awaited old validation cannot grant or acknowledge overtaken work.

The dispatcher invalidator runs on existing settings, ordinary dispatch/tick,
and permission/navigation ingress. It first marks the exact unserved session
`ENTRY_CANCELLING`, then cancels the matching admission owner and obtains the
exact document's `NUDGE_STOP` cleanup proof, and only then terminalizes that run.
A failed cleanup keeps the cancelling checkpoint and rejects new admission;
normal later ingress retries that same owner. The first serialized transition
stores `cancellationReason` on that checkpoint. `markNudgeGoalCancelling` returns
the exact frozen binding/cause receipt; repeated or concurrent callers reuse
that first cause for admission cleanup and terminal/outbox writes, even if the
goal is restored while cleanup is failing. Admission revalidation also reads
that stored cause only after matching the exact pending binding; a later policy
change cannot reclassify an already-owned cancellation. A cancelling checkpoint without a
valid cause rejects untouched; other phases cannot carry that field. There is no cancellation timer,
replacement replay, or successful release inferred from a timeout. Cancelled
preludes preserve real boundary occupancy/recovery without final Furin credit.
An ordinary dispatch abort cannot delete `ENTRY_CANCELLING`. A producer abort
during sibling cleanup returns the explicit non-terminal `cancellation_pending`
receipt; its message ACK says `terminalCommitted: false` and schedules no effects.
Only the invalidator, after exact admission and document cleanup proof, calls
`completeNudgeGoalCancellation` with the original binding. That named entry
reuses the full abort transaction for terminal, debt and outbox, then schedules
the existing terminal-effect drain. A late START ACK or failed sibling cleanup
therefore preserves retry ownership and the first cause. The canonical admission
boundary normalizes raw pending facts with the same phase/cause contract.
Already acknowledged final delivery retains its original cap and identity;
ending a live displayed surface never fabricates a choice or removes that fact.

`tabs.onUpdated` loading/complete is not document departure: Shorts item changes
can emit both while the same top document and goal entry remain alive.
`ProtectionDispatcher.revalidateNudgesForTab` delegates to
`ProtectionNudgeTeardownCoordinator.reconcileLiveDocument`, which
snapshots exact active run bindings and reads the native frame-0 document. It
preserves all phases bound to that document and terminalizes only captured runs
bound to a different document through the existing abort/outbox/debt owner.
Top-frame committed navigation runs the same reconciliation. The canonical
committed ingress sequence and removal/eviction state fence the native document probe,
session-lock admission, reads and final write; overtaken or missing proof is an
explicit error when an owner exists, never an inferred disappearance. An empty
owner snapshot grants no authority and requires no native probe. Existing settings, permission,
ordinary dispatch and privileged-transition owners retain unserved policy
cancellation with its exact cleanup ACK. Final daily receipts survive
real departure; manual/debug hosts have no automatic goal-session checkpoint.

New automatic selection is **Global -> Site -> periodic Barrier reflection**.
The dispatch candidate owner filters actual attainment and V2 daily eligibility
before choosing Global/Site. Before a new optional Enso grant, the admission
service also reads `projectReadyGoalPriority` through the fenced canonical
reader; a reached, enabled, unserved goal returns `goal_priority`. It repeats
the fresh check before publishing a newly persisted grant. This is not
request-order preference and does not preempt an already attached/displayed
ordinary owner. Near goals, recording-unavailable goals and already delivered
Global cannot suppress a valid periodic opportunity. No catch-up question is
queued.

### Lifecycle correlation and cancellation (2026-09-16)

`interventionLifecycleDiagnostics.js` creates immutable **diagnostic** activation
labels. It neither grants authority nor stores policy. The existing content
diagnostics history (120 entries) records `intervention_lifecycle` events; the
client retains only its last lifecycle outcome. No extra journal, scan or timer
is introduced. Session admission still persists only the existing owner and
request/lease identity. Worker recreation does not recover past diagnostic rings.

The causal paths are:

- Enso: settings task/commit/execution → envelope trace/revision (background
  dispatch diagnostics) → explicit effect context → source activation → request →
  exact lease. `ProtectionStateApplier` passes context to keyed effects;
  `ProtectionRegistry` does not include diagnostic context in its dedup signature.
  An unchanged effect retains its original activation provenance. Click and feed
  source owners capture the context when configured, before delayed input.
- Sentinel/Site Furin: envelope trace → `nudge_admission_bound` and production
  `runId` → host activation → request → exact lease. Manual starts have no
  production run ID and explicitly carry null provenance. A run binding proves
  dispatch intent, not grant, paint or cleanup.
  Manual Global's Room 478 navigation identifier is its already-issued exact
  manual Global admission lease ID; automatic Global retains the production run
  ID. This navigation-only handoff does not change null manual production
  provenance or authorize navigation: the existing exact lease/tab/document
  resolution remains required. Missing or invalid manual lease identity fails
  explicitly, without manufacturing an ID or selecting the automatic identity.

Client evidence distinguishes `request_pending`, `request_denied`,
`request_cancelled`, `lease_granted`, `grant_discarded`, `endpoint_attached`,
`boundary_presented`, `furin_handoff_adopted`, `locally_presented`,
`locally_released`, `cleanup_failed` and `cleanup_completed`.
`receipt_acknowledged` includes its operation (`presented`, `ended` or
`endpoint_attached` or `boundary_presented`); only the matching successful background response produces
it. Local release does not prove durable end. `receipt_failed` retains that
distinction. Background admission diagnostics use the checkpoint's existing
tab/document/request/lease IDs and record `transition_committed` only after the
typed store write. Optional cadence notification runs outside the mutation lane;
its failure cannot fail an already committed transition response. The committed
event is storage evidence, not delivery or presentation evidence. Required
cleanup proofs, session writes and destructive conclusions remain serialized.

The background's document/lease-scoped `revoke` control carries its explicit
canonical `reason`. The client validates it before cleanup and passes it unchanged
to every bound producer, so goal cancellation and the first terminal/outbox
commit retain `goal_values_changed` (or the actual relevant rejection). Only a
mandatory intervention preemption sends `mandatory_preemption`. A missing or
malformed revocation reason fails cleanup acknowledgement and retains the exact
owner; it is never replaced with a generic cause. Inspect controls grant no
revocation authority and need no reason.

OFF cancels an unsent candidate before its turn in the transport lane. An issued
request still settles and ends only its exact late grant. Pagehide closes new
request admission; only an explicit persisted pageshow may reopen the document
after successful cleanup. A failed presentation cleanup retains the lease but
does not poison the transport lane needed by a later explicit cleanup receipt.
Sentinel host stop synchronously cancels Site Furin's pending first-paint rAF and
timeout; it does not wait for a frame in a hidden document. Issued dynamic imports
and worker activation results still settle under the existing epoch/root fence.
The entry owner retains its exact starting Host through `retainStartingHost`.
An abort synchronously invokes `cancelStartedHost` only when that automatic Host
still owns the matching run, so hidden/surface reset/STOP/teardown cannot leave
prepaint work to appear later. A late start result cannot revive the ended entry.
Host also stops an automatic, still-starting unpainted surface on visibility
loss; manual and already-presented visibility pause semantics remain unchanged.

These activation labels are never compared for policy, read as settings state, added to the
admission wire contract or persisted. Bounded history and console retention mean
this is correlation of available evidence, not a permanent end-to-end audit log.
Request IDs use independent UUIDs rather than timestamp/local-counter identity;
same-millisecond requests in different content instances remain distinguishable.
Activation IDs remain separate from request IDs and have no admission authority.

HTTP content identity uses the same stateless `src/lib/randomUuid.js` UUID-v4
primitive as secure content: `crypto.getRandomValues`, without an alternate weak
source or a `randomUUID` capability assumption. Missing entropy fails before an
activation/request is committed. Feed producer and topology IDs use this same
primitive; they retain their own lifetimes and are not admission identities.

`INTERVENTION_ADMISSION` waits for the existing profile-generation boot
settlement milestone, not completion of tracking/startup content reconciliation.
The service still owns typed session reads and current settings readiness, and
the router still applies sender and profile-mutation admission. This removes the
content-start/full-bootstrap dependency without declaring all background work
ready. Transport errors identify operation, request and elapsed milliseconds;
Enso's configure continuation does not log the same error a second time.

Site Furin Leave uses `SITE_FURIN_CLOSE_CURRENT_TAB` through the existing tab
closure arbiter. The trusted main-frame sender supplies tab/document identity;
the payload supplies only its exact lease. The arbiter requires `site_furin`
kind, and the serialized service probes the presented owner before browser
removal. The host retains ownership while awaiting closure. Explicit removal
failure restores the conclusion token for an explicit retry; a thrown work
operation does not. Success consumes the token, and duplicate/wrong-document or
wrong-kind requests cannot close a tab. A lost reply does not prove cancellation
of a browser operation. Page destruction can precede delivery of the close ACK.

The content transport treats the messaging layer's explicit `Extension context
invalidated` error as a terminal extension lifecycle state. It records
`contextInvalidated` in its diagnostic snapshot, invalidates cadence and request
generations, stops queued and future sends, and runs every local cleanup with
reason `extension_context_invalidated` without sending an end receipt. BFCache
restoration cannot revive this state; a fresh content script is required. Failed
cleanup remains visible and is reported; unrelated transport failures still
reject and are reported once per error object. This is termination, not a
fallback admission path or permission to bypass the background owner.

Default development and public builds use this owner. The former opt-in
Enso/Suikinkutsu local admission runtime is a laboratory fixture; production
consumers do not import its build alias. Its 160 ms counterfactual shadow and
consumption weights have no authority over production admission.

Content transport exposes only its last immutable request outcome for diagnostics
(`lastRequest`, plus current `pending`). This metadata is not an admission cache,
retry policy or persistence writer; cancellation/pagehide invalidates it. An
injected Enso admission transport supplies `getSnapshot` alongside its lifecycle
methods. The isolated null-transport policy has no transport evidence.
Feed candidates request this transport only on a current confirmed-advance decision.
For an already pending Feed Horizon, the existing observation beat may complete
that boundary's prepared permission within the original 5s fresh window, provided
the latest decision still grants the opportunity and all admission checks pass.
`canCompletePrepared` reads the exact unconsumed ticket, source/manual identity,
visibility and original deadline; diagnostic `lastRequest` remains outside policy.
This does not create an opportunity on a supply poll or replay a past input.
Clicks still require the next eligible input; the candidate/observation distinction
and future endpoint placement are owned by the Feed Flow Active contract.

The content cleanup callback carries its actual termination reason through the
surface arbiter: explicit `revoke` is `mandatory_preemption`, whereas unshown
expiry, hidden presentation, rejected presentation receipt and page exit are
`reservation_expired`, `presentation_hidden`, `presentation_rejected` and
`document_exit`. These reasons change diagnostics only, not eligibility, expiry,
cleanup acknowledgement or recovery. A stopped inspection must stop its QA input
driver immediately; it cannot keep scrolling until a generic commit timeout.

Covered discrete presentations are Enso click/feed episodes (including the
dry-boundary-to-gesture continuation), Site Furin, Global Furin, standalone
Presage, Gate reviews/notices, and the Suikinkutsu invitation. Site/Global game
simulation, animation, audio design, and HUD default-off remain unchanged.
Continuous filters (e.g. saturation, click delay, audio processing), passive
status indicators, dashboard ceremonies and user-requested navigation are not
scheduled intervention presentations. This is not an assertion that every UI
or persistent friction effect stops while an intervention is open.

Entry checkpoint and detour-spread review are ordinary behavioral
interventions, including their full-screen/blocking render mode. Under
`kind: gate_interstitial`, `gateKind: isolation` (an explicitly active no-entry
session) and `gateKind: returnGuard` (the return lock on a fully left site) are
mandatory. There is no all-Gates exception. Multiple mandatory boundaries can
exist on their respective tabs. Isolation blocks new ordinary admissions; a
return lock asks nothing, so it neither holds the ordinary lane nor starts
recovery when it ends (see Return lock). Integrity eviction and explicitly selected
tab removal retain their separate requester tiers; selected-tab removal also
requires the originating Gate session to still own admission.

Detour selection captures the exact top-level Gate page URL, original content URL,
bound Gate document ID and selected tab IDs/content URLs. Frame-0 active-document
query authorization binds `metrics.gateDocumentId`; a decision cannot rebind it. `TabClosureArbiter`
validates them inside `selectGate` against the current pending source session,
then inspects the live source and every target and their pending URLs in parallel.
The source's live URL must be the exact Gate URL, even when it is kept. A current target Gate page is accepted only when that
target's canonical session maps its exact Gate URL to the selected content URL.
After those lookups, the source identity and selected entries are checked again
before browser removal. Changed, missing, malformed or navigating targets refuse
the whole requested batch; browser lookup failures stay explicit. Caller-provided
targets cannot replace entries in the canonical source snapshot. Tab IDs at this
destructive boundary must be numeric, nonnegative safe integers.

An own-tab pruning choice uses that same selected batch, so its source stays
retryable after failed browser removal. Successful source removal may already
have cleared its session when the controller records the authorized decision and
pruning receipt. The checks bound stale-target races; Chrome does not provide an
atomic compare-URL-and-remove operation, and a failed multi-tab browser removal
does not prove that none of its targets closed.
The live source lookup uses `tabs.get`, which does not expose document identity:
a same-URL reload before Gate-document reauthorization is not independently
proven by this lookup. A changed canonical source document binding still refuses
the pending selection; the arbiter adds no second browser document-query owner.

Gate refresh retains a selected tab only while its numeric ID and exact content
URL match the previous inventory. Title, icon, active state, order and window
metadata refresh the presentation without resetting selection. Missing or changed
targets are removed from the selection individually; the final closure still
uses the existing fresh canonical batch validation and never substitutes a target.

Manual QA bypasses automatic trigger eligibility and recovery, but shares
exclusivity. It cannot replace an active production or manual session, and
production cannot restart/stop manual Furin. Mandatory isolation remains an
exception. Public builds reject manual admission.

The dev-only collision target has a separate controlled prerequisite at
`protection/background/automation/interventionCollisionQaFixture.dev.js`.
After proving that an ordinary Enso request is refused before its interval is
due, the trusted harness on the exact `collision-a.localhost` /
`collision-b.localhost` fixture may request the payload-free
`prepare_enso_candidate` operation. The target requires its owned ephemeral
browser. The fixture uses this service's existing serialized `run` / `save`
lane, refuses an active owner, recovery, a background tab, a disabled policy or
an unsettled browser observation, and prepares the current interval's due
counter plus a current **synthetic** consuming anchor. No arbitrary duration,
clock, history, entry decision, kernel or lease can be supplied. No production
admission branch is bypassed; the subsequent request remains `manual: false`.

The route captures the canonical content-session generation, document ID and
exact fixture URL before queuing the preparation. Its document fence is checked
inside the serialized lane, after foreground/policy awaits and after persistence
before installing the synthetic anchor. A queued navigation or same-URL document
replacement cannot authorize a different document. A change racing persistence
fails the run without installing the anchor; the existing disposable-profile
cleanup remains responsible for that failed fixture's committed checkpoint.

The immutable before/after receipt labels this as a synthetic operational
prerequisite and explicitly denies natural-consumption evidence. It certifies
ordinary arbitration, presentation, preemption and the real post-presentation
cadence reset for a prepared candidate, not elapsed foreground consumption or
detector timing. The fixture adds no persistence key or runtime timer and is
absent from public/release route composition. The exact disposable profile is
removed by the existing QA cleanup owner, including on preparation failure.
Enso automation preserves the actual bounded admission refusal in its error
code so missing cadence and rendering failures remain distinguishable.

Feed Horizon inspection ARM/REARM uses the existing Runtime Debugger command
owner to await a `manual:true` Enso reservation before connecting the endpoint.
`EnsoSpawnPolicy` forwards that mode to the same admission client; an automatic
reservation cannot consume a prepared manual ticket. Cancelling the command or
automation session invalidates its revision and ends only the exact late lease.
Automatic feed opportunities still require a fresh confirmed advance, while the
explicit manual command does not depend on another automatic observation.

## Time and lifecycle

### Enso consumption interval (2026-09-12)

Automatic Enso eligibility now uses one protected-site consumption interval across
tabs/documents. `ensoIntervalPolicy.js` owns the user presets: 8, 12 (default), or
20 minutes. These are product starting hypotheses, not empirically calibrated
attention thresholds. Cadence does not detect problematic use. Content owns the
next eligible reward/feed boundary, entry/return grace and Horizon experience;
the shared service independently checks current cadence before reserving Enso.

The `ensoCadence` capability in the existing admission session checkpoint holds
only version, enabled policy, interval, consumed milliseconds, observation/reset
watermarks, observed-departure start and revision. Absence explicitly initializes
this new capability at zero; no old Enso score/cooldown is interpreted. Malformed
presence fails. Browser restart clears the session; worker recreation preserves
the counter but deliberately starts without a live foreground anchor. Unknown
time is not filled in. Reads never add elapsed milliseconds.

Only an actually focused protected foreground tab can accrue time, provided the
browser is not locked. Native idle is deliberately included: lack of mouse or
keyboard input does not distinguish quiet reading, muted video and an unattended
foreground page. Audio is not an accrual condition. Background audio, browser
blur, lock and unknown foreground evidence never add time. This is **time open
in the foreground**, not measured active use or attention. An unattended but
still focused foreground page can make one opportunity due; no backlog is banked.
Return/focus alone cannot summon Enso: content still requires the next fresh
eligible content boundary and its existing return grace. This deliberately trades
some early eligibility after foreground idling for consistent quiet-reading and
muted-video behavior. The current item can still finish. No new content heartbeat,
attention estimator or media scanner is introduced. Active/idle transitions and
audio toggles do not close/reopen the cadence anchor; lock transitions still do.

The existing minute inventory seals long dwell. Existing foreground-affecting
tab/window/navigation/idle ingress closes the live anchor before async work;
its admitted handler commits that exact bounded interval and reopens only after
current foreground/scope evidence. Thus rapid protected-tab switching retains
short observed intervals instead of losing every interrupted minute. Background
tab updates do not close the foreground anchor. No interval longer than 120
seconds is bridged; one missed ordinary beat is tolerated, longer gaps are
unknown. Raw ingress revisions and the existing browser/settings inventory
receipt fence late observations. Historical collection permission, exclusions,
stats ACK and `TrackingConsumptionLedger` are not cadence prerequisites.

Accrual saturates at one opportunity; waiting at a boundary never banks a queue.
While an actually presented intervention owns the screen, no new consumption is
credited. Actual automatic Enso, Site Furin, Global Furin or ordinary Shishi
reflection end starts the next interval at zero. This includes real Horizon
encounter through the end of its periodic Enso episode; endpoint attachment
alone is not presentation. A Furin-owned prelude encounter starts actual
occupancy, but only its `finalPresentedAt` (actual Furin) earns Furin reflection
credit. Ending after the prelude alone keeps accrued cadence and starts ordinary
whole-episode recovery. Cancellation/failure before any presentation and manual
QA do not reset production cadence. Mandatory isolation does not create a new
voluntary reflection credit. Furin's usage/debt is unchanged. The existing
45-second common recovery still applies independently after actual presentation
end.

Ten minutes of observed operational departure resets cadence, reusing Shishi's
existing departure boundary. Five minutes outside pauses it. This is a session
boundary, not certified cognitive recovery. Only the complete existing inventory
can establish outside/blur/lock with absent protected audio; a tab transition alone
cannot assert that absence. Unknown observations, lost worker anchors and gaps
over 120 seconds break the departure run. The existing positive protected-audio
callback also interrupts departure between inventory beats without accruing any
audio duration or changing the foreground anchor. Enso off/on starts a fresh interval;
changing the interval preserves already accrued time, with at most one due
opportunity. For example, nine accrued minutes under the 12-minute preset become
due when changed to 8; an already saturated 8-minute period changed to 20 needs
12 more foreground minutes. Time spent waiting beyond the former threshold was not
banked. Checkpoint and runtime interval validation accept exactly these three
presets, not arbitrary finite durations. Ordinary settings reapplication preserves
the counter.

Content reads `INTERVENTION_ADMISSION operation: enso_cadence` at entry/settings
and on a stale boundary. The service returns `{ accepted: true, cadence }`, where
cadence is `{ version: 1, eligible, consumedMs, intervalMs, remainingMs,
observedAt, reason, revision }`. The existing control receiver accepts the same
DTO under `INTERVENTION_ADMISSION_CONTROL operation: enso_cadence`. Existing
observations and reflection end push updates to one exact registered foreground
document. Departure captures a paused snapshot then retires the observation
receiver; the captured final notification can still deliver unless a subsequent
read replaces its receiver generation. Missed delivery removes only the failed
generation's receiver and pending snapshot; an older failure cannot evict a newer
binding. A read registers the current document again. No scheduled retries or
wake-up timer exist.

### Enso execution and receipt contract (2026-09-18)

After a successful canonical commit, notification captures an immutable DTO and
exact tab/document destination. The service owns at most one in-flight send and
one latest pending snapshot. Pending projections may coalesce; admission
mutations, lease receipts and statistical facts may not. `observedAt` remains
the source observation time, never the later dispatch time. Before dispatch,
receiver generation fences superseded pending work. An already issued Chrome
message is not retractable by this owner; an 800 ms transport timeout bounds
waiting, not physical delivery. Content still checks DTO revision/freshness and
document lifetime; receiving a projection never grants a lease.

The delivery drain is registered synchronously through the existing profile
admission gate's `runAdmittedLocal` port, with no extra durable lifecycle read.
Reset/import waits for an admitted drain to settle. A synchronous fence rejection
cannot turn a producer's already committed state into a failed transition. The
owner also observes asynchronous rejection from its task port; a drain whose admission is
still pending when the fence closes cannot publish. Failure to enter the drain
is recorded as `cadence_notification_cancelled` for a closed/changed generation,
or `cadence_notification_failed` for an unexpected admission failure. A failed
send/negative ACK records `cadence_notification_unavailable`. No snapshot is
persisted or replayed after worker recreation. A notification failure is an
explicit projection-delivery failure, not a substitute policy or storage path.

An optional `cadenceReadId` (bounded to 64 word/hyphen characters) correlates a
content `cadence_read_sent` and transport failure with background
`cadence_read_queued` / `cadence_read_settled`. The sender-derived document/tab
remain authoritative; the correlation label is never stored or compared for
eligibility. Diagnostics record local content queue wait and background queue
wait/run duration, queued depth and the operation running at enqueue time.
Depth excludes that running operation; `blockedBy` is not a complete predecessor
chain. Elapsed values are local clock deltas, not synchronized cross-context
timestamps. Only bounded counters/current-operation state are retained by the
service; existing diagnostic sinks determine retention. A queued event without
a settled event means incomplete evidence, not proof of deadlock or cancellation.

A failed content read invalidates only the receipt it began with and only in
its original document/activation generation. A newly accepted push survives that
failure, including when policy revision is unchanged. Rejected/older/malformed
pushes do not protect the old receipt. This does not extend the 90-second
freshness limit, reconstruct elapsed consumption, grant permission or replay input.

Gate presentation awaits the operational `preparePresented` receipt inside the
shared mutation lane; its historical `completion` is awaited outside that lane,
before the external ACK. The Gate history section below defines the identity,
ordering and profile-drain contract. Mandatory checkpoint and cleanup waits still
remain, so this separation does not guarantee every cadence read finishes within
its 2-second transport deadline.

`tests/ensoCadenceRuntime.test.js` covers cross-tab short intervals, five/ten-minute
departure, worker gaps, saturation, actual/unshown/manual endings, preset changes,
raw ingress fencing and operational idle/media classification. These synthetic
contracts are not measurements of human intervention quality or a browser QA PASS.

### Shishi input and presentation (2026-10-07)

Zen entry/return Gates show the bamboo and destination hostname, with one short
instruction in the existing inscription: waiting enters; pouring closes this tab.
There are no separate normal-state Leave/Enter controls, countdown, progress,
recent-use summary or held gesture. The idle bamboo neither fills nor strikes.

`src/apps/gate/useZenGateWait.js` owns a document-local monotonic wait. Only
visible, focused time counts; blur/hidden/pagehide stop its timer and focus
resumes the remaining time. `gateShishiRitual.js` supplies 10 seconds, plus the
frozen bounded intensity extension for entry checkpoints only. Completion
submits canonical Continue while the document remains visible and focused. The
clock never reserves admission or persists state; background still authorizes
the resulting decision. A longer canonical `holdUntil` must also expire before
submission; it never disables pouring or causes automatic rejection/retry loops.

Leave is available as soon as the canonical session is authorized. One click on
the bamboo, its native focused Enter/Space activation, or Escape latches Leave
and cancels waiting. The unstyled native hit area has an accessible pour/leave
name. `GateInterstitialApp` owns one 900ms pour/strike cue followed by 120ms
before canonical Leave submission. Cue, submission and the shared Zen recipe's
requested pose use the same `performance.now()` choice origin. Frame delays or
hidden rendering do not extend those deadlines. The recipe renders the same pour
but no render callback grants either decision. Immediate choice latches prevent
mixed/repeated inputs from submitting both outcomes.

Pagehide/unmount cancel the old document's cue and conclusion timers. A BFCache
restore reauthorizes the session, resets the wait and remounts the idle bamboo;
old query/decision replies cannot act on the restored epoch. Invalid intensity
fails explicitly before input is enabled. A separate polite screen-reader status
announces the outcome without moving the visible layout.

A transient decision failure keeps the authorized Gate and the chosen outcome.
It exposes a local error and an explicit retry; Zen foreground waiting cannot
resubmit while that error is pending. Retry submits the same canonical decision
without replaying the pour. A stale or refused session remains an unavailable
state and cannot gain fresh authority through this UI.

The dashboard/ambient Shishi keeps its autonomous physics. Mandatory isolation
uses the existing Torii boundary and has no Shishi entry-choice clock. Background
admission, configured holds, decision authorization and shared entry approval
retain their canonical owners.

### Shared entry intent (2026-09-11)

`GateRuntimeStateOwner` owns ordinary entry intent through
`gateEntryApprovalPolicy.js` and the typed `GateEntryApprovalRepository`.
This is an operational decision checkpoint, not a new pressure model or scheduler.
One real Continue on `entryCheckpoint` approves entry across all
protected hosts and tabs. Continuing past an expired return lock is not an entry
decision: it neither grants nor renews approval (see Return lock below). Navigation, reload, settings reapplication, pressure,
Enso/Furin presentation and short worker restarts do not revoke that choice.
Only the input assembler consumes approval to suppress ordinary entry/return
candidates. These require a fresh foreground entry/return boundary (12 seconds);
there is no queued catch-up or expiry callback.

Ten minutes of observed departure end approval. The existing Tracking inventory
and heartbeat supply operational presence independently of analytics consent:
protected foreground while unlocked, or protected audible media anywhere, keeps
the flow engaged. With no protected audio, outside foreground, no focused browser
window, or a locked browser can count as departure. Idle alone cannot certify
departure while a protected page remains foreground. Unknown evidence breaks
the departure run. Samples must be at most 120 seconds apart (one ordinary
60-second beat may be missed); a larger unobserved gap starts a new run. This
checkpoint survives ordinary MV3 worker suspension; missing wall-clock time is
never filled in by a read. Positive protected foreground/audio browser events
interrupt departure between beats. Existing browser/settings ingress receipts
invalidate in-flight inventory, including during persistence.

Ten minutes is an initial entry-intent boundary, not cognitive recovery: it
preserves the discussed five-minute search/work detour and exceeds the existing
two-minute rapid-return window. It does not reset consumption memory, usage,
Furin debt or descriptive tempo research. Enso independently uses the same
ten-minute observed-departure boundary for its consumption cadence, and may
interrupt ongoing use at an eligible content boundary under common admission.
Silent reading/video and attention cannot
be inferred perfectly from browser idle/audio signals.

Ordinary 15-minute host-entry grants, five-minute host-return grants and the
30-second tab causal relay are removed. Detour Continue still means only "keep
this tab": its existing 15-minute tab exemption is named `keptTabPassUntil` and
never approves a protected-site flow or exempts detour budget enforcement.
Return-only configurations retain their rapid-return trigger range; this patch
does not turn them into universal first-entry gates.

Approval and navigation execute inside the existing admission `selectGate`
lane, after exact displayed-session and pending-status checks. Approval storage
failure leaves the Gate pending and retryable. A committed choice remains valid
if subsequent navigation fails. Repeated submissions cannot repeat navigation.
Leave, cancellation, mere presentation and manual QA fixtures do not grant
approval. Mandatory isolation and exact tab-closure authority remain unchanged.

Ordinary and isolation Leave retain the current canonical session through the
browser close attempt. Only Chrome's explicit failed-removal result restores the
same admission conclusion token; an ambiguous throw does not. The controller
captures shown-history identity and admits its existing history task before
removal. That task waits for the actual close result; a failed or unknown result
releases its slot without writing resolved history or waiting on shown history.
The background architecture guard recognizes this explicit awaited
`effectCompletion` failure branch inside `enqueueGateHistory`; it still rejects
false-return fallbacks elsewhere in either Gate controller. Required recorder
methods continue to fail at owner composition before any historical task starts.
Successful removal precedes operational Leave and session cleanup, so a failed
close cannot count as a completed Leave or orphan its still-open Gate. The
profile lifetime owns successful history even if tab removal deletes the session
first or a reset begins during the browser call. A post-close cleanup failure
never renews destructive authority or permits another tab removal. There is no
new history writer, retry timer or replay queue.
Trusted dev QA can release only its exact session's approval; newer/foreign
approval is preserved. This cleanup is not a production expiry mechanism and
has no public message route. Browser/extension session reset clears the session
checkpoint; document/settings reapplication does not.

Verification uses the existing `consumption/protected-sites --scope=entry`
target for real Continue, cross-domain/tab reuse and worker restart. Its optional
`--verify-departure` observes the full ten-minute boundary without clock injection.
`intervention/collision/runtime` establishes that same real approval before its
Enso/Furin fixtures, so approval cannot silently become a shared-admission bypass.
The inventory/approval/input-assembler regressions also cover short outside
detours, unknown evidence, background audio and missing heartbeat gaps.

`interventionPolicy.js` owns a 45,000 ms minimum recovery interval measured from
the end of an actually presented intervention. It is not a product claim that
45 seconds is optimal. It reuses the prior admission experiment's conservative
interval, exceeds the existing Flare plan's 30-second reentry interval, and is
much shorter than Enso's 8/12/20-minute foreground-consumption intervals. The
consumption cadence also applies. Measuring from end ensures a long ritual
does not consume its recovery while the person is still interacting.

Candidates expire after 5 seconds. Unattached reservations have a 10-second maximum
pre-presentation lifetime to allow transport and worker first-frame preparation.
A grant held for a synchronous input producer must still be consumed on a fresh
source boundary within the candidate's 5-second window. A reservation is not
an exposure; failed rendering, cancellation, or expiry before presentation
does not advance the exposure timestamp or recovery deadline.

Feed Horizon has one explicit lifetime extension: after the exact DOM endpoint
lease is committed and the surface mounts/renders, the periodic spawn owner or
shared goal coordinator invokes the client's `endpoint_attached` transition.
An Enso `feed_horizon` source or exact goal `goal_feed_horizon` source must have
bound cleanup ownership. The service accepts attachment inside the reservation
deadline and persists `endpointAttachedAt` on that same owner. Attachment does
not change kernel presentation, exposure or recovery. Its receipt survives
worker restart; malformed presence is rejected.

Goal owners retain the final kind (`site_furin` or `global_sentinel`) throughout
the episode. They persist `source: 'goal_feed_horizon'`, exact matching
`purpose: 'site_goal' | 'global_goal'`, `manual: false`, and initialized
`endpointAttachedAt`, `boundaryPresentedAt`, `finalPresentedAt` fields. The
existing typed session checkpoint owns these facts; there is no additional
store or history writer. Ordinary owners retain their existing shape. Missing
or invalid fields on a present goal owner reject rather than being migrated or
defaulted. Enso cadence eligibility is checked only for the periodic Enso kind;
a goal purpose cannot bypass the ordinary exclusion, foreground or recovery
rules.

`boundaryPresented(lease)` sends `boundary_presented` and returns the exact
background acknowledgement. It records `presentedAt` and `boundaryPresentedAt`
as the first actual occupancy. It does not mark final Furin display. After this
ACK and a fresh deliberate continuation, `adoptPresentedGoalEndpoint({ kind,
manual: false, leaseId })` can transfer only that current, consumed, same-kind
goal lease once. The final host retains it and calls `present` after actual
Furin paint, setting `finalPresentedAt` without moving the occupancy origin.
There is no release/re-reserve or recovery between the phases. A prelude alone
cannot authorize a destructive Furin conclusion or earn its cadence reset.

Goal handoff also carries synchronous
`onClaimTransferred({ leaseId, previousClaim, claim })`. Immediately after the
Host replaces the exact same-owner claim, and before any async import/paint,
the coordinator validates the lease and previous handle, drops the now-stale
claim serial, confirms `resolveContinueIntent('enter')` and physical Terminus
disarm, then returns **`true`**. Only that confirmation transfers whole-lease
release authority to Host. A Promise, false return or cleanup failure rejects
the transfer. Host cleans its newly acquired claim but cannot end the composite
lease while the coordinator still owns unresolved physical cleanup; the exact
goal owner remains retryable. After successful transfer, Host may stop during
prepaint without leaving an endpoint behind or releasing an unclean sibling.
Boundary cancellation never disarms an unrelated periodic Terminus while a
goal producer is merely waiting behind it.

Before starting the final host, the content entry owner reclassifies the live
media inventory and requires the same document, origin, normalized host,
profile, item-independent semantic surface, route family, surface mode and
content class. A same-feed item URL change (such as Shorts advancing to another
video) preserves this identity. Watch, another feed family, another document or
newly unsupported primary media rejects the handoff. This capability check does
not replace exact background goal/document authorization, endpoint encounter or
fresh continuation, and does not loosen non-feed action URL permits.

An attached endpoint may be encountered after a long read without a replacement reservation.
The content client still requires a visible document and an exact live lease for presentation;
the service requires the persisted attachment receipt to allow a post-deadline encounter.
Rejected attachment acknowledges no lifetime extension and revokes only the exact bound
surface. A stale callback cannot release its replacement. If reading ends before encounter,
cleanup ends the reservation without exposure/recovery. Existing uncertain exposure interval
semantics remain; attachment alone is not a claim that the user saw the endpoint.

Horizon stillness keeps the existing exclusive owner: no auto-Enso, auto-Furin
or idle-end timer. A separate ordinary goal remains deferred while an episode
owns the surface; mandatory isolation retains its cleanup-proved preemption.
Hidden, page exit, explicit outcomes and endpoint invalidation remain the
lifetime owner boundaries.

The sequence is observation -> candidate -> durable reservation -> optional endpoint attachment -> actual
presentation confirmation -> cleanup/end. The content receipt is bound to the
trusted top-frame sender's tab/document and lease. Gate pages separately confirm
their visible ready UI; issuing a redirect is not the admission presentation
commit. Furin dispatch distinguishes an accepted `phase: 'entry_waiting'`
preparation with the exact `runId`
from actual final host presentation. Acceptance does not mean `contentRendered`
and cannot mark shown or commit coalesced Site absorption. Actual final display
retains its existing lifecycle acknowledgement and exact run owner.

The existing Furin session owner separately records
`NUDGE_PENDING_PHASES.ENTRY_WAITING` through
`src/domains/nudge/runtime/session/nudgeSessionDispatchState.js` /
`markNudgeEntryWaiting`. Only the exact same-run/tab waiting ACK, after the
dispatch document fence, admits that transition under the existing session lock.
It is owned waiting rather than the short transport/dispatching candidate, so
the ordinary 90-second dispatch deadline cannot expire a readable Horizon.
There is no extra timer, waiting map or storage key. Actual host paint advances
it to `PRESENTED`; waiting cannot directly become a completed episode, shown
receipt or user choice. A late waiting ACK cannot regress an actual presented
phase. Existing exact run/tab cancellation and navigation owners clear unshown
waiting with their existing debt semantics; worker restart reads it through
`readActiveNudgeOwnerForTab` rather than inventing replacement work.

`ENTRY_CANCELLING` is also owned unshown work. It cannot transition to presented
or episode-completed and has no dispatch deadline that frees it before cleanup.
The original binding remains on pending phase changes and new bound terminal
metadata. Older unbound terminal metadata has no scoped policy authority. Only
the durable V2 daily receipt proves final delivery; shown, choice and terminal
maps are not substitutes.

A different production run cannot replace the current content entry owner;
`production_entry_owned` leaves it intact for a fresh later attempt. Full
protection clear cancels that exact pending entry through its owner before
clearing effect runtimes. Turning only periodic Enso/Barrier off preserves a
still-authorized Furin boundary demand.

Worker restart reloads the checkpoint. Before another candidate is granted,
the owner probes the exact document, or consults the canonical Gate session.
A disappeared presented document starts conservative recovery when disappearance
is observed. An unreachable still-current document is an explicit blocked error,
not a lease-timeout fallback. A live content receipt can recover actual exposure
when the original presentation ACK was lost. Profile settings reapplication,
tab switches, and document navigation do not clear the session deadline.
Closing the browser, extension reload/update, or full profile reset can clear
Chrome's session storage; this is a browser-session policy, not durable history.

### Return lock (2026-10-12)

`returnGuard` (되돌림 울림) is no longer a question about a quick return. It is a
per-site lock with nothing to decide. `GateRuntimeStateOwner` owns it through
`gateReturnLockPolicy.js` and the typed `GateReturnLockRepository`
(`runtime.gate_return_lock`).

- Site: the base domain of a protected host, so `www.`/`m.` subdomains share
  one lock.
- Presence: Tracking tab events (removed, replaced, URL change or loading)
  queue `observeGateSitePresence`, which reads the protected-tab inventory of
  real web tabs when it runs. Gate pages are not presence: a tab held at a Gate
  has not entered its site.
- Entered: a site counts as entered after a real tab stayed on it for 5 seconds,
  so a Gate redirect is never entering-and-leaving.
- Lock: when an entered site has no real tab left (last tab closed or navigated
  elsewhere), it is closed for 15 minutes from that moment. A site with any tab
  still open is never locked; tab spread stays the detour guard's concern.
- Forgiveness: reopening the site within 10 seconds of leaving withdraws the
  lock as if it never left (a slip or Ctrl+Shift+T). The lock only holds after
  that window.
- While locked, the site's tabs are turned away and are not counted as a new
  visit. Other protected sites keep following shared entry approval.
- Gate: the input assembler raises `RETURN_GUARD_REQUIRED` at a fresh foreground
  entry while the lock holds, regardless of entry approval or media maintenance.
  It outranks detour and entry in `GATE_INTERVENTION_PRIORITY`, and its hold is
  the lock (`holdUntil` = lock end). Admission treats it as mandatory, like
  isolation, so recovery gaps or another active intervention cannot deny it.
  It does not hold the ordinary lane, and ending it starts no recovery, so the
  entry checkpoint that may follow is never swallowed.
- After the lock: Continue only resumes the original URL without approval. The
  site is judged again; without approval the entry checkpoint asks first.
- Zen presentation: the Shishi bamboo fills on the lock's own clock (from the
  moment the site was left to the lock end) through a thin stream, tilting by
  its balance and glistening at the mouth near the brim, but it never spills
  before the end. When the lock ends on a focused, visible page, the filled tube
  tips by itself and its clack submits Continue. Pouring is still the
  visitor's Leave and still closes the tab.
- Off: turning the guard off writes the empty state. Browser restart clears it
  with session storage.

## Consumption exposure read boundary (2026-09-09)

`runtime.intervention_admission` version 1 admits the optional **current**
`exposureWindow` capability. Absence explicitly means interval recording has
not begun; it never denotes an empty historical interval. Existing active
owners, blockers and recovery are preserved. `beginExposureRecording()` owns one
shared initialization promise on the existing admission lane. Every admission
operation enqueues initialization before its work and any presentation callback;
the first enabled Tracking post-fact task joins the same promise. Thus a stats
reset draining model work cannot join a later admission callback waiting for
that reset. Initialization failure rejects dependent work; a later explicit
admission operation or Tracking batch may retry. Source/stats/protection work
does not await the derived model task. Recording starts at the initialization
commit's time. This records a known start even
if no intervention has occurred, preserving active owners and recovery. Reads neither
initialize nor repair data. Present null, malformed or extra nested fields
reject. This is not a legacy-key reader or a reconstruction from `lastEnded`.

The exact shape is `{ version: 1, startedAt, updatedAt, intervals }`, with
intervals `{ startedAt, endedAt, kind: 'presented' | 'uncertain' }`.
It contains no host/tab/document identities, content, model score or statistics.
Recording is operational session evidence about this app's interventions;
it does not expand collection consent or create durable personal history.

- Reservation through presentation ACK is uncertain, not exposure. Cancellation
  before presentation remains uncertain evidence and consumes no exposure/cooldown.
- Only a recorded presentation ACK followed by an explicit `ended` or exact
  acknowledged document handoff can produce a `presented` interval. It means
  acknowledged presentation ownership, not measured gaze or foreground visibility
  throughout. The caller's existing lifecycle semantics remain authoritative.
- An open owner, missing tab/document, recovered/lost end ACK, and mandatory
  preemption without this explicit end boundary remain uncertain. The interval
  must not be reported as exact visible duration or clear consumption time.
- Exposure end and ownership/recovery commit atomically in the same repository
  write. Failure publishes neither; replay and stale callback guards remain the
  existing admission service's responsibility. No second timer, queue or writer.
- Gate Continue passes `documentHandoff: true` through its existing `selectGate`
  lane. Only an acknowledged update of the exact source tab ends that presented
  owner and commits recovery/exposure there. Worker recreation retains the same
  presentation timestamp. Later navigation/session cleanup is idempotent; it
  cannot reclassify a confirmed Continue as a missing-session uncertain end.
  An explicit browser rejection restores the same Gate session to pending and
  preserves its admission for retry. A malformed or thrown operation does not
  certify an end, and no nested admission call is made from the callback.
- Union overlapping owners once, with uncertainty taking precedence. Retain at
  most one hour / 256 disjoint intervals. Trimming advances coverage start;
  time before that boundary becomes unknown, never implicitly clear. One hour
  matches Tracking's bounded context horizon; the cap covers the ordinary
  45-second policy density with room for reservations and mandatory boundaries.
  It is a memory bound, not a user-facing cooldown. Browser close/profile reset
  retains the existing session-storage lifecycle.

`InterventionAdmissionService.readExposureSnapshot({ now })` reads one committed
typed repository snapshot directly. It does not reconcile, join the mutation
lane, probe a browser, write, or start an IndexedDB query. This avoids reentrant
deadlock when a presentation callback needs a runtime input. The post-Tracking
model observer uses only this passive read: it must never await the admission
mutation lane while holding a stats batch (presentation can await stats). A concurrent newer commit can certify a retrospective query inside retained
history. `ahead_of_query` now means the query predates retained coverage. The
exact snapshot includes `settledThroughAt`: earliest open reservation clipped
to coverage/query time, or the query time when none is open. Model observations
wait at that boundary until end confirmation; an over-one-hour open span loses
only the trimmed prefix to unknown. Missing coverage has null settled-through.
Malformed data still fails. Backwards write clocks
reject rather than erase or rebase history.

The runtime input provider reads this snapshot alongside the one Tracking
snapshot and uses `behavior/consumption/consumptionExposureContext.js` to project
only the last confirmed foreground receipt. The DTO adds
`consumptionContext.intervention.latestForeground` with disjoint
`unoccupiedForegroundMs`, `presentedMs`, and `uncertainMs`, plus exact receipt
bounds and protected scope. These add to that receipt's elapsed time. Raw
Tracking aggregates, stats, Gate passes and hold policy remain unchanged.
Unoccupied foreground is not media-free/rest evidence. This is a revisable query
projection; it is not a model commit cursor or a cross-owner atomic history feed.

Verification: `tests/interventionExposureWindow.test.js` covers typed commit
ordering, failed-write replay, unknown/open/disappeared boundaries, retention,
old valid owner preservation and passive reads. Provider/binding regressions
cover the live read wiring. The named Gate runtime QA verifies open uncertainty
and a closed presented interval through its trusted dev-only read action.

## Retry and deduplication

Content cancellation is scoped to the requesting kind and source. Turning off
an Enso source invalidates its pending/prepared admission even while another Enso
source stays enabled; it does not end another source or a consumed live surface.
The in-flight transport may settle, but its cancelled grant is ended and cannot
be consumed by a later ON. A fresh source boundary must request again. Reapplying
the same enabled configuration does not end the source's current activation.

Sentinel/Furin owns its run identity and mode before awaiting admission. Its
public `hasLifecycleOwnership()` includes preparing, reserved and mounted work;
`isActive()` remains a presentation predicate. Production OFF stops that pending
owner too, while preserving debug-owned starts. The start epoch fences every
late grant; STOP's exact run matching can address the pending run.

Denied candidates are not queued. Enso retains its detector/rearm observations
and retries on a subsequent source action/opportunity, with fresh local
eligibility. Permission delivery alone does not spawn or replay a click.
Furin's Site and Global automatic starts classify the current screen through
`furinEntryBoundary.js`. Qualified feeds require the shared Horizon prelude even
with periodic Enso OFF; unknown/unsafe feeds never become the non-feed path.
Declared non-feed entry accepts only a classified new-content primary click
that consumes its exact prepared permit synchronously in the same document.
`adoptPreparedFurin` transfers that consumed `furin_entry_action` lease once to
the matching host kind. Unprepared input passes natively; a late grant never
replays the input or starts an overlay on the destination. Broad interactive
clicks/keys, idle/cap expiry and generic pause/ended do not qualify. Primary-media
contexts lacking semantic current-content/end/successor proof remain
unsupported/waiting. Site's integrated ritual remains part of the same final
game. The seam itself does not expose a second Presage.
Standalone Presage requires its own admission. Suikinkutsu does not subscribe to
recovery completion or schedule a retry at the shared deadline; it re-evaluates
on renewed media evidence. Existing initial sustained-media timing remains.

Furin pending/shown/debt, run leases, terminal outbox, day episode generation and
CAS absorption remain canonical. [Furin daily delivery](furin-daily-delivery-policy.md)
adds the distinct durable actual-presentation cap: one Site full across hosts,
later host brief delivery once each, and Global shown suppresses later Site that day.
Shown departure remains an abort without re-debt, not a completed user choice.
A blocked/failed start cannot mark shown or
absorb Site debt. A Global presentation can still absorb the matching coalesced
Site cause after actual start and exact generation comparison. Distinct genuine
obligations remain eligible for future fresh attempts; priority does not erase
them or play them back in a burst.

## Handoff and failure limits

Ordinary reconciliation, mandatory preemption, and destructive conclusion all
require an exact content-control receipt with `cleaned: true` and no `error`.
`active: false` alone is not release proof. In particular, page-exit cleanup may
fail while the document invalidates its presentation proof: that response keeps
the session lease owned and raises
`INTERVENTION_RECONCILIATION_CLEANUP_UNCONFIRMED`. A later exact clean receipt or
the existing proven tab/document disappearance boundary may settle that owner;
no timer, diagnostic projection, or speculative expiry may erase it.

The content admission cleanup callback is synchronous. Revocation runs every
registered owner even if one throws, removes successful callbacks, and retains
failed callbacks and the lease for explicit retry. A nested owner release cannot
end the ticket while that sweep is running. A returned Promise is an unsupported
cleanup contract and produces `INTERVENTION_ASYNC_CLEANUP_UNSUPPORTED`, never a
successful receipt. Sentinel/Furin retains its failed cleanup ownership, run and
mode and rejects new starts until an explicit stop succeeds; its surface and
admission lease are released only after the resource cleanup and reset complete.

The admission client binds one terminal context-invalidation handler owned by
`bootstrapController`. On detection it closes its transport first, attempts local
ticket cleanup, and invokes the content owner once. Bootstrap revokes the attempt
and performs the normal independent cleanup sweep without sending a stale-state
publication into the dead extension context. A cleanup failure remains reported
and observable; invalidation is not a cleanup-success ACK. This is a reaction to
an observed platform failure, not a guaranteed reload/disable notification or a
new polling mechanism. Same-context bootstrap after that terminal event fails
with `CONTENT_RUNTIME_EXTENSION_CONTEXT_INVALIDATED`.

`lastRequest` is a passive candidate diagnostic: request/kind/source identity,
accepted lease identity, cancellation and failure are retained through settlement.
Cancellation never becomes retry authority and no history or timer is added.

Mandatory preemption asks the exact content owner to clean screen/input/media
and callbacks before acknowledging transfer. A failed cleanup keeps admission
blocked. All delayed terminal continuations capture an epoch; STOP carries exact
run identities. An old release is harmless. Enso close and Furin navigation do
not fall back to local history/location/window-close when authority is missing.

An exact content conclusion uses the existing admission-control inspection,
addressed with both `frameId: 0` and the issued `documentId`, inside the same
serialized lane as the browser operation. It does not require optional
`webNavigation`. The receipt must match the lease, acknowledge clean state and
a positive presentation timestamp no later than the background presentation
receipt, and retain the expected live/recently-ended state. The two clocks are
not required to be equal. The existing two-second ended-lease limit is checked
again after inspection. A control probe is bounded to 800 ms; transport failure,
invalid proof, or late response cannot consume the conclusion or mutate a tab.
`pagehide` invalidates both live and retained terminal proof, including BFCache
restoration; a new presentation requires a fresh admission.

Room 478 explicitly marks its same-tab operation as a `documentHandoff`. After
the browser acknowledges that exact tab without an error, the resolution lane
ends and persists only the authorized lease before allowing another admission.
This completion starts the normal shared recovery interval; manual QA may bypass
the interval only under the existing manual policy. It does not depend on an
`ended` message surviving destruction of the previous document. A late content
release or replay cannot end a successor lease. A failed, missing, or different-tab
receipt retains ownership and fails explicitly. Other resolution operations keep
their existing completion semantics.

Reconciliation first checks the exact owner's tab through `tabsGetLiveness`,
bounded to 800 ms. An explicit missing-tab result ends only that lease with
`tab_gone` and persists the ordinary recovery interval. This is the regular tab
lifecycle branch, before Gate/session or content-document inspection; it does not
use the permissive `tabsGet` getter or infer disappearance from document lookup
failure. It also recovers an earlier acknowledged handoff whose content ended
message was lost, once that exact tab is verifiably closed. Live tabs continue
through the existing document/session checks. Unavailable APIs, mismatched IDs,
invalid results and other browser errors keep ownership and raise
`INTERVENTION_TAB_LOOKUP_*`; no session reset or speculative release is allowed.

Optional `webNavigation` is still consulted by reconciliation only when an exact
document receiver is unreachable. An unavailable API raises
`INTERVENTION_DOCUMENT_LOOKUP_UNAVAILABLE`; it cannot be interpreted as a gone
document or release an uncertain owner. This explicit blocked state preserves
ownership until the existing reconciliation authority can establish it. Room 478
navigation preserves admission refusal reasons and original proof errors in its
structured response instead of flattening them to a tab-update failure.

The presentation DOM and Chrome session storage are not one atomic transaction.
If the document and worker disappear in the narrow interval after first paint
but before any presentation receipt is persisted or recoverable, the remaining
reservation alone cannot prove exposure. No exposure is invented for an unshown
reservation. Browser QA must distinguish this platform loss window from normal
worker-restart recovery, and must not describe unit tests as a long-running
cross-tab browser certification.

## Verification contract

### Gate history commit and execution boundary (P3a/P3b, 2026-09-18)

`presentGate` awaits `GateInterstitialController.preparePresented` inside the
admission lane: exact admission presentation commit →
`GateRuntimeStateOwner.recordGateInterventionShown` operational mutation →
immutable internal `{sessionId, tabId, presentedAt, completion}` receipt. The
controller synchronously registers the continuation with the existing profile
`runAdmittedLocal` owner **before the operational await**, so a concurrent choice
or removal can capture the upcoming shown dependency. The continuation waits on
an explicit preparation result; operational failure rejects historical completion
and runs no historical writes. No receipt returns before preparation succeeds.
The public `presentGate`
Promise awaits `completion` **outside** the admission tail; the response contains
only `{accepted: true}` after historical exposure/effect → hourly aggregate/receipt
→ session `metrics.admissionPresentedAt` marker completes. A frozen receipt is
internal lifetime ownership, not a transferable authorization or wire DTO.
The marker does not precede durable history. `recordPresented` remains a full
completion adapter for explicit controller callers; production composition uses
`preparePresented`.
Operational Gate state and historical counters have different authorities; historical
recording must not become a condition for deciding the operational policy mutation.

P3a makes explicit history retries idempotent through immutable first-event facts
and hourly receipts committed with their counters. A failed marker may retry history
without another shown increment. P3b retains only unsettled work by session, bounded
to 128 sessions and the five fixed history event kinds per session. Duplicates share
one pending event; entries are removed on settlement. A capacity error is explicit,
never an eviction or fallback. Decisions/navigation capture an immutable payload
and the pending shown completion or canonical completed marker before removing the
session. Outcomes wait for successful shown completion and sequence behind prior
outcomes; they are never awaited inside `selectGate`. Unconfirmed presentation or a
failed shown task records a named failure instead of inventing an exposure.

Every historical task acquires its profile lease synchronously before any predecessor
await. Reset/import drains already-admitted work; later admissions reject. The
typed `GateInterventionSessionRepository` serializes its read/modify/write and clear
operations through its existing background singleton. A late completion uses only
`updateSession`, so it cannot resurrect a removed session, overwrite another tab's
mutation, or mark its replacement. Reads remain snapshots; this is not cross-context
storage CAS. Diagnostic SHOWN is admitted at operational presentation, before history
wait or later decisions; it does not assert historical durability.

This change does not advance the external Gate ACK, add retry/polling/outbox, or
claim worker-termination replay. Slow history may still delay **that Gate's** ACK;
it no longer occupies the shared admission lane and delays unrelated Enso reads.
Existing profile drain waits for real settlement, not a timeout surrogate. Tests
`gateHistoryExecution`, `gateInterventionSessionRepository`, and
`interventionHistoryRecording` cover these boundaries, including composed owners
with deferred real IndexedDB aggregate commits.

The dev-only named `intervention/collision/runtime` browser target composes the
existing owners under fixed candidate fixtures; its scope and authority are in
`docs/operations/qa/entropy-qa-control-plane.md`. It adds no production scheduler,
observer, policy selector, storage writer or recovery timer. An explicit ordinary
admission option on the existing Enso debug realization is confined to detector
QA; default human realization continues to request manual exclusivity.
That realization may consume an ordinary lease only with the identical receipt
object returned by its own preceding prepare. A copied/stale receipt or default
manual invocation cannot adopt an existing production owner. Gate QA reports
the admission owner's refusal reason separately from invalid presentation/ACK.

The collision fixture preserves the production daily Furin receipt: full Site A,
manual-owner exclusion and the still-eligible brief Site B/Gate competition run
before the first Global presentation. Global then absorbs the outstanding Site A
obligation. The candidate carries a canonical unavailable reflection (no segments
or represented time); it does not invent measured history. Competition waits for
the existing content entry-seam diagnostic in the exact current document and the
canonical brief pending candidate, delivers native input, and immediately requests
Gate. Evidence distinguishes a shared-admission refusal from Gate navigation
cancelling content delivery; a single visible winner alone proves neither. Every
competition records whether Furin dispatch already settled before the Gate request,
so completed-owner exclusion is not labeled concurrent admission. Final success
requires no operational owner/blocker/pending candidate and no intervention surface
in either fixture tab. Every
started request settles before cleanup, the exact winning owner is ended, and real
wall-clock recovery completes before the next production candidate. No daily
receipt is cleared or moved to another date to keep later candidates eligible.

`tests/interventionAdmissionService.test.js` and
`tests/interventionAdmissionClient.test.js` exercise cross-kind exclusion,
concurrent tabs, persisted recovery/restart, failed reservations, expiry,
mandatory cleanup, old callbacks, manual isolation and unavailable owners.
Existing Enso, Furin, Gate, media and closure regression suites protect their
integration seams. Browser evidence uses only named `npm run qa -- ...` targets;
an existing human owner is preserved and reported as unavailable capacity.

Gate navigation/delivery does not consume shown counters. `recordPresented`
records them only after visible top-level Gate-page acknowledgement, once per
canonical Gate session. Detour has no content-surface admission or notice episode.
Its shared canonical inventory counts exact Gate originalURL projections globally.
A successful explicit selected batch retains the existing narrow kept-tab Entry
pass; external manual closes that satisfy the current budget resume the exact URL
without a synthetic decision, pass or tutorial receipt. Click Enso synchronous input uses a short pre-reservation;
if permission is not available on that input, the action passes through and a
subsequent fresh eligible input may consume it. There is no captured-click replay.

An existing ordinary Gate in a different tab is preserved when isolation must
block another tab; both remain identified, and ordinary admissions stay closed.
The same-tab isolation redirect tears down the prior document. Content-based
rituals acknowledge synchronous input/media/surface cleanup before handoff.
