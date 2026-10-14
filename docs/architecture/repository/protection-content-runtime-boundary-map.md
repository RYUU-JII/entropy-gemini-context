# Protection And Content Runtime Boundary Map
- Status: Active
- Owner: repository architecture, protection runtime, tracking runtime
- Last validated against code: 2026-10-13
- Path policy: current-only
- Canonical for: protection dispatch, content bootstrap, gate presentation, prepaint/root-visual handoff, and recovery boundary map
- Companion to:
  - `docs/system-architecture/05-background-runtime-owners.md`
  - `docs/architecture/runtime/content-runtime-target-architecture.md`
  - `docs/architecture/runtime/friction-filter-injection-architecture.md`
  - `docs/architecture/runtime/bootstrap-friction-snapshot-architecture.md`
  - `docs/architecture/repository/storage-stats-tracking-boundary-map.md`
  - `docs/architecture/repository/protection-runtime-snapshot-bridge-boundary-map.md`

## Purpose

This map audits the runtime path that turns background protection decisions into
content-side effects. It uses the same practical mapping shape as the
storage/stats/tracking map: source-of-truth path first, owner contracts second,
and fallback/legacy triage last.

The key question is whether content runtime behavior can be read from system
level down to functions without discovering a hidden policy reader, storage
fallback, or second injection owner.

## System Flow

```text
settings/cache + tab/browser events
  -> background protection runtime input assembly
  -> ProtectionEngine / policy compilers
  -> ProtectionDispatcher
  -> ProtectionDispatchTransport
  -> ContentScriptOrchestrator ensure-ready gate
  -> content loader
  -> bootstrapController receiver install
  -> receiver_ready
  -> ProtectionController authoritative apply/clear
  -> active sidecars
```

The prepaint/root-visual fast path is derived from the same background runtime
truth. It is not a policy reader.

P1-C uses strict protection envelope V2. Snapshot and patch carry the required
quantized `coolingCurve` projection; malformed/absent metadata or V1 input is
rejected without mutating accepted receiver state. ACK sources are
`envelope_v2_snapshot` / `envelope_v2_patch`. This is an explicit protocol cutover,
with no V1 decoder. The background-only curve resolver composes enabled effects;
content applies the compiled plan and never calculates usage progress.
The existing tracking tick owns state-change dispatch and derived-cache renewal
through `CoolingCurveStepRefreshCoordinator`, the ordinary dispatcher and managed
registration owners. See [Cooling curve runtime](../runtime/cooling-curve-runtime.md)
and [Bootstrap snapshot lifecycle](../runtime/bootstrap-friction-snapshot-architecture.md).

### Permission ingress and execution revocation (2026-09-18)

`trackingServiceBootstrap` synchronously calls the required
`invalidateContentPermissions` binding for scripting/origin grants and removals,
before entering the history/bookmark/permission full-init FIFO. The kernel wires
this to `ProtectionDispatcher.invalidateDispatchPermissionCaches` and
`ContentScriptOrchestrator.invalidatePermissions`. This ingress only revokes RAM
authority; storage, registration reconciliation and teardown remain under their
existing admitted owners. History/bookmark-only permission events do not revoke
content preparation. `trackingPopupBlockFlow` no longer owns cache invalidation.

The dispatch permission gate increments a worker-local revision on clear. Late
permission API replies may neither refill the cache nor admit execution. Its
immutable returned state has private receipt identity; protection apply, Gate
dispatch and ordinary nudge mutation recheck that receipt at their existing
fences. `PROTECTION_DISPATCH_PERMISSION_CHANGED` is explicit cancellation, not
missing permission, a navigation proof, or successful apply. An already-issued
browser mutation is not undone by revocation; existing cleanup still owns it.
Routine managed-content-script and prepaint registration sync instead calls
`ProtectionDispatcher.refreshDispatchPermissionCaches`: it drops cached lookup
results without revoking already-issued permission receipts. Registration sync
does not change native grants and must not cancel a concurrent dispatch solely
because its permission cache was refreshed. Actual permission-event ingress
still calls `invalidateDispatchPermissionCaches`, invalidating all prior
receipts and in-flight lookups. Settings broadcasts retain their existing hard
invalidation, cancellation and per-document dispatch fences.
`ProtectionDispatchTransport` consumes the caller's `contentMutationFence`
before initial preparation, after readiness, before receiver recovery and after
recovery readiness. Protection/Gate delivery supplies its permission fence;
nudge presage/start passes the existing mutation fence. A delayed missing-receiver
reply therefore cannot create fresh reinjection authority. Post-send ACK handling
stays with the caller so exact Gate/navigation settlement remains intact.

The orchestrator independently owns the revision of its preparation work. It
aborts pending readiness at ingress and fences queued syncs, registration-plan
preparation, catch-up workers, inventory reads and readiness handoffs. Its fence
is passed to `ManagedContentScriptSync`; there is no second permission snapshot
or new persisted generation. An issued registration batch settles and commits
its observed signatures, but cannot launch stale catch-up. Unfinished targets
remain in the existing pending list and are re-admitted against current scope
and live tabs. `CONTENT_SCRIPT_PERMISSIONS_CHANGED` / `managed_sync_cancelled`
distinguish that result from successful reconciliation.

Revocation does not assert that existing page effects have disappeared. The
full-init FIFO may still delay registration removal and exact teardown ACKs
behind history/bookmark work. Browser calls already issued also retain their
settlement obligation. No polling, detached teardown or instant-cleanup guarantee
is introduced; actual cleanup failure remains visible and retryable.

Permission/scope teardown uses `ContentScriptOrchestrator.teardownContentForTab`
to revoke dispatch readiness immediately and address `CONTENT_RUNTIME_TEARDOWN`
to the tracked `documentId`. Its payload carries a unique `teardownId` and the
owned `attemptId`; the content control channel rejects a different attempt.
`bootstrapController` invalidates the attempt synchronously, invokes every
cleanup owner even if one fails, and awaits effect/sidecar cleanup and stale-state
publication. Only then may the control channel return an ACK echoing the type,
teardown ID, and attempt ID. Missing, mismatched, negative, and transport-failed
ACKs fail managed reconciliation, with the stale document identity retained for
the next sync retry. Late responses cannot overwrite a newer document/attempt.
Missing tracked identity is an explicit teardown failure, never tab-wide delivery.
Navigation-only records with the exact `absent` state (null document/attempt,
zero injection attempts) have no runtime to tear down. The orchestrator checks
the current record before delivery and records `teardown_not_required` with
`runtime_absent`; it does not treat failed/stale runtimes or missing ACKs as
absent. Aggregate failures preserve bounded per-tab causes in the error message
so the propagation checkpoint retains the underlying failure evidence.

A cleanup gate belongs to its document. When bootstrap telemetry actually
replaces the registry's prior document, the orchestrator revokes pending
readiness and advances the document-exit fence only if the accepted document
matches the trusted top-frame sender. It then releases the old cleanup gate;
an in-flight old teardown still settles and reports its failure to its caller,
but cannot block or stale the replacement. Same-document reinjection, rejected
telemetry, missing identity and a sender/document mismatch do not release the
gate. Frame-media invalidation follows this same accepted transition, rather
than the unaccepted incoming document ID. This is not proof that the old
document's effects were cleaned.

After a settled cleanup failure, the Orchestrator's existing native top-frame
location probe can also prove document exit without a webNavigation event.
It requires an unchanged registry generation and cleanup/navigation/permission
ownership plus one exact-URL frame-0 result with a distinct document ID. Only
that old cleanup gate ends; same-document or unproven results remain pending,
and ordinary readiness must still succeed. The proof and refusal diagnostics
and no-retry contract are owned by the Content Runtime target architecture.

Full protection apply/clear likewise await owner settlement before applied
diagnostics and successful ACKs. Effect isolation collects failures while
allowing siblings to finish; it must not convert a failed owner into completion.
Keyed effect deduplication shares any pending promise, and an operation epoch
prevents an older completion from recording success for a later same-signature
operation.

The installed `ProtectionController` receiver epoch also owns its pending full
update. Teardown invalidates that epoch synchronously. After history admission
and after effect settlement, the controller rechecks the captured epoch before
starting subsequent effects or publishing prepaint cleanup, applied diagnostics,
status indicator, debugger state and a successful ACK. Late startup callbacks
cannot update behavior context for a revoked receiver. A revoked operation sends
the explicit negative `PROTECTION_RECEIVER_OPERATION_CANCELLED` ACK with
`superseded: true`; this lifecycle cancellation cannot overwrite a regenerated
receiver's successful receipt or convert an actual owner failure into success.

Controller apply/clear failures keep the same bounded aggregate-cause summary in
the negative ACK, environment probe and first console argument. The first console
argument includes the phase and error text: console consumers that collapse object
arguments must still see the actual failure, rather than a generic `Object` label.
This diagnostic projection does not suppress or convert failed application into a
successful receipt.

Detour spread uses the same-tab, top-level Gate page at an actual foreground
protected entry or activation when the global protected-tab inventory exceeds
the current budget. Background creation and loading count immediately, but never
notify or redirect the opener, activate the child, or move window focus. Settings
and periodic snapshots cannot create a Detour entry. Ordinary admission and its
shared recovery rules still apply; Detour is not a mandatory isolation boundary.
The managed-group owner receives `beforeGateNavigation(tabId)` before a Gate
redirect, and the dispatcher mutation fence is rechecked after that await.
Operational grouping failure is diagnosed without disabling Gate protection.
A full-page navigation unloads media and loses in-page scroll/form state; returning
to an already-open page restores the exact original URL, not its former document.

The shared detour presentation is the White Night Predator's unfolded light:
`ZenPredatorHorizon.jsx` owns its empty black interior, asymmetric white photon
rim and sparse bent field filaments; `gatePredator.css` owns the
full-page/narrow composition. Only the page clips the illustration: the
body crosses layout columns without a rectangular graphic enclosure. One
container-relative size and centre govern the rim, suspended fragments and
collapse endpoint; the narrow layout exposes the lower-left arc above its list.
Before submission only the lantern's sleeping white core is visible; selected
tabs wait in a compact, reversible cluster beside it. Selection briefly deforms
the core without revealing the void. The submit transition owns one 1600ms
sequence: 0–112ms white contraction, 144–304ms rapid horizon expansion,
then radial tab stretching/consumption and a return to the sleeping core.
Entering the gate or selecting a tab cannot reveal the black interior.
Slow crest modulation and sparse dust preserve an unreadable, absent interior
instead of adding a pupil, surface, orbital grid or fast particle shower.
The white core leaves a separate screen-space afterimage through 400ms, with
about 100ms of overlap after the horizon opens. The opening boundary has a
briefly delayed sector; fill, rim, crest and exterior mask share interpolated
quadratic contours so white light and empty interior deform together. During
consumption only the selected seat angles develop inward folds, with the
narrow layout using its own seat vectors. Contours are generated on selection
change; finite CSS path interpolation owns the motion.
Exterior-masked white filaments carry independent tangential currents around
that boundary. Each selected seat owns a local `ZenPredatorIntake` lip:
submission reveals it facing inward and retracts it as the fragment stretches
along its radius. Its text and favicon dissolve into white light first, leaving
the luminous shell to be consumed. Seat vectors and angles resolve together for narrow
layouts. These effects use owned CSS/WAAPI animations and honor reduced motion;
no continuous JavaScript simulation or extra decision delay is introduced.
The resting and revealed radii share one centre and seat vectors. The bounded
20ms seat stagger ends within the existing presentation hold. Reduced motion
keeps the white core and skips the reveal/consumption entirely.
This cosmic motif is the explicit visual identity of branch erasure,
not an interactive eye or an alternate Zen gate ritual.
`useGateTabTransferMotion.js` measures the clicked source before selection,
carries that source to the suspended fragment, restores keyboard focus and
cancels owned animations on rapid selection, submission and unmount. The
selection remains reversible until the existing submit command. Its 1600ms
presentation hold does not delay the background close command. Reduced motion
uses immediate state changes; no business state or browser APIs move into the
illustration. The named detour render scenes include Korean selected, narrow
and in-flight captures alongside the full-page and closing views.
The opening desktop/narrow scenes seek 320ms after submit, closing desktop/narrow seeks 760ms,
and the ember scene seeks the returned core; pre-submit scenes remain dormant.

The visible title is Branch pruning (곁가지 절단); the body has no entity name or
lore caption. The submit control sits below the body, outside the void. Initial
guidance follows selection and submission in two short steps; a five-second
selection idle interval brightens the rim three times and emphasizes the control.
`GatePruningPresentationStore` owns `presentation.gate_pruning` in local storage:
absence explicitly means no successful pruning receipt, while malformed records
fail visibly. The authorized session query projects `pruningTutorialCompleted`;
the prepaint bootstrap makes no completion claim. Only a nonempty explicit
selection with a successful background closure writes the idempotent receipt,
including a selection that closes the gate's own tab. Close and receipt share
profile-mutation admission so reset drains both. Viewing/selecting/dismissing,
failed closure, and integrity/escape closure cannot complete the tutorial.
The receipt has no tab data, is excluded from snapshots, and is cleared by full
app reset (preserved by analytics reset). No tutorial write command is exposed
to the gate UI. Persistence errors propagate, never masquerade as completion.

`tabs.onUpdated` observations carry their browser-ingress timestamp through
runtime admission. The Gate controller discards an observation older than the
active session's `issuedAt`, so a delayed pre-Gate URL event cannot delete a
newer session; post-issuance navigation retains fail-closed escape handling.

Detour source dispatch remains fenced to the original content document, including
the explicitly permissionless `documentId: null` route. Successful `tabs.update`
commits a terminal redirected disposition; no later assertion refers to the
deliberately replaced content document. The top-level Gate query verifies the exact
live Gate URL, session and tab, requires frame 0 and an active document, and binds
`metrics.gateDocumentId`. Concurrent first queries from the same active Gate
document bind idempotently; a different document winning the bind race retains
its authority. Decisions require that exact Gate document binding. Presentation
acknowledgment and periodic inventory refresh start only after the first
authorized GET, never from the URL bootstrap snapshot alone.
Detour renders the existing boot shell until that GET supplies its authorized
budget inventory; it does not diagnose an incomplete bootstrap as invalid.
Selection/refresh failures keep readable localized guidance while console diagnostics retain the
exact cause code. A successful periodic refresh clears only its own refresh
error; it cannot erase an unresolved explicit-selection failure.
Denial is read-only: an old URL, history entry, frame or session cannot mutate a
successor. A BFCache restoration reauthorizes on persisted `pageshow`. Visible
Gate-page acknowledgment alone records presentation; no content-surface admission
or iframe completion protocol remains.

`ProtectionRuntimeInputProvider.readProtectedTabInventory({now})` is the shared
inventory owner, independent of Detour enablement. It classifies live tabs using
current settings, special-session and schedule-skip facts. A Gate tab counts only
through its exact live session URL mapped to its original URL; closed or departed
Gate pages cannot be resurrected. The budget is browser-wide, independent of
native groups or window count. The Gate refreshes that inventory before selection
and again before resuming a kept current tab. A changed selected URL is never
substituted silently. New tabs during closure can keep the Gate pending with an
actionable budget error; no destructive selection is automatically retried.
Inventory count/list remain available during pause. Its `detourEnabled` applies
the same canonical `describeArtifactControlStateForFamily(..., 'barrier')`
overlay as the profile owner, so global pause or Barrier suspension releases a
pending Detour through ordinary admitted exact-URL resume. The Controller also
requires the current tab's exact original URL to remain in that protected
inventory; removing its protection cannot leave it locked because unrelated
tabs remain over budget. Settings propagation invokes `refreshDetourSessions`
for policy changes; the visible Gate's periodic authorized GET revalidates the
same facts. Neither path records an explicit choice, receipt or pass.
Optional scripting/host-access or `tabGroups` revocation does not disable this
full-page Gate: its existing permissionless admission lane remains valid and
native grouping owns its separate permission behavior.

Selected closure, including the current Gate tab, is one immutable arbiter batch.
Inside `selectGate`, the arbiter compares the pending source session, exact actual
Gate URL and Gate document binding, checks the source and every selected target's
live/pending URL, then rechecks canonical identity. An exact current target Gate
session may project to its original content URL. Any missing, changed or navigating
target refuses the whole batch. Chrome has no atomic compare-URL-and-remove API;
this bounded check does not promise atomicity after the final browser read or
all-or-nothing removal on browser failure.

A successful selection that includes current closes it. Keeping current marks the
session resuming and navigates directly to its exact original URL after fresh
budget validation. A navigation failure restores pending state and remains
visible/retryable. External manual closes use `refreshDetourSessions` and the same
fresh-budget/document handoff; they do not synthesize a user decision, tutorial
receipt or pass. Explicit successful selection retains its existing narrow
kept-tab Entry pass; neither path grants host/global approval. Suppressed Entry or
Return children are not queued, and the resumed page receives ordinary current
policy evaluation. Duplicate exact choices share one task; conflicting choices
reject without creating another queue.

```text
background protected child is created / loading
  -> canonical inventory count changes; opener and focus stay unchanged
foreground protected entry / activation over budget
  -> ordinary admission -> same-tab Gate URL
  -> authorized current inventory -> explicit selected batch
  -> current selected: close current; current kept: exact original URL resumes
manual closes satisfy budget
  -> fresh inventory + exact Gate authority -> original URL resumes, no receipt/pass
```

```text
ProtectionDispatcher dispatch result
  -> FrictionBootstrapCoordinator
  -> BootstrapSnapshotRepository
  -> bootstrap.root_visual
  -> PrepaintVisualPlanCompiler
  -> ManagedContentScriptSync host-exact CSS tiers
  -> content loader root visual refinement
  -> ProtectionController truth apply suppresses prepaint
```

The dashboard snapshot projection is also derived from the final compiled
runtime plan. It is not a settings normalization path.

```text
RuntimeSnapshotBuilder final plan.filterPlan (materialized level + value entries)
  -> compiledRuntimeFilterPlanContract validation
  -> protectionRuntimeSnapshotBridge
  -> canonical artifact telemetry-owned projection
```

Teardown is explicit:

```text
permission/scope/reset/navigation trigger
  -> ContentScriptOrchestrator teardown
  -> CONTENT_RUNTIME_TEARDOWN
  -> content clears effects and sidecars
  -> CONTENT_BOOTSTRAP_STATE stale
  -> TabContentSessionRegistry stops dispatch targeting
```

Media-frame observation is a separate sidecar path and does not make content
sidecars dispatch-ready. The V4 child receiver additionally accepts exact-document
HTML media hold commands subordinate to an existing top-document intervention;
it owns no iframe protection policy or full content runtime. The command and
platform-limit contract lives in `friction-nudge-effect-boundary-map.md` under
"Embedded HTML media hold and support boundary".

```text
ManagedContentScriptSync media-frame registration
  -> mediaFrameProbe all-frames inventory / authenticated media receiver
     -> top frame no-op
     -> child-frame incremental inventory
  -> topFrameMediaDiagnosticsReporter
     -> canonical VideoElementObserver registry
  -> CONTENT_MEDIA_FRAME_STATE
  -> ContentScriptOrchestrator
  -> TabContentSessionRegistry frame ledger
  -> content runtime diagnostics snapshot
```

## Canonical Owner Table

| Concern | Canonical owner | Canonical path | Source of truth | Forbidden shortcut |
| --- | --- | --- | --- | --- |
| Protection policy decision | protection background domain | `src/domains/protection/background/**` | runtime snapshot / compiled envelope | content-side settings read, popup/dashboard policy recompute |
| Protection dispatch | protection dispatcher | `src/domains/protection/background/ProtectionDispatcher.js` | background runtime decision inside one exact document/URL-bound tab transaction | direct content send before receiver-ready gate or public-queue reentry for an internal retry |
| Content-mutation serialization | protection dispatch serial queue + dispatcher transaction fence | `src/domains/protection/background/protocol/dispatch/ProtectionDispatchSerialQueue.js`, `src/domains/protection/background/ProtectionDispatcher.js` | rejection-resilient per-tab FIFO generation, synchronous ready-document admission identity, canonical URL/hostname fence, removal tombstone, and final eviction | tracking-only queues, null-document semantic dispatch, dequeue-time rebinding to a newer document, or a second Gate/nudge tab lane |
| Tab-update dispatch protocol | protection tab-update dispatch protocol | `src/domains/protection/background/protocol/dispatch/ProtectionTabUpdatedDispatchProtocol.js` | privately issued one-use ingress receipt and receipt-bound closed `applied` / `superseded` outcome | returning a raw success beside typed supersession, forging same-shaped outcomes, or re-owning receipt state in transport/listener code |
| Foreground dispatch cancellation | protection foreground dispatch protocol | `src/domains/protection/background/protocol/dispatch/ProtectionForegroundDispatch.js` | exact-task immutable evidence from the private serial queue and a branded cancellation outcome for activation, focus, and replacement | error-code-only suppression, treating cancellation as an ACK, publishing an active snapshot, or continuing the old event's nudge leg |
| Dispatch lifecycle primitives | protection dispatch lifecycle primitives | `src/domains/protection/background/protocol/dispatch/ProtectionDispatchLifecyclePrimitives.js` | the owned-lifecycle-error brand plus the exact identity readers (`resolveExactDispatchDocumentId`, `resolveExactDispatchHistoryUrl`, `resolveReadyContentDocumentId`, `requireAtomicContentSessionSnapshot`) shared by the dispatcher and its settlement modules | re-declaring the brand or an identity reader in a settlement module, or importing the dispatcher back from one to reach them |
| Dispatch settlement proofs | protection dispatch settlement proofs | `src/domains/protection/background/protocol/dispatch/ProtectionDispatchSettlementProofs.js` | ordered proofs converting a private queue invalidation into a named owned cancellation: pre-ACK History, pending tab-update History, pending tab-update committed, and the weaker navigation supersession claim | accepting an error by shape rather than queue provenance, settling on a lifecycle tag the ledger never issued, or settling a receipt that is still the tab's lifecycle head |
| Live-admission reconciliation | protection live-admission reconciliation | `src/domains/protection/background/protocol/dispatch/ProtectionLiveAdmissionReconciliation.js` | staged correlation, atomic before/after session snapshots around one `tabs.get`, exact document-location probe with CAS refresh, and exact admission recapture for a ready-session URL mismatch | probing before the receipt and error attest one correlation, treating an unproven live URL as convergence, or recapturing an admission that does not bind the exact observed generation |
| Dispatch settlement diagnostics | protection dispatch settlement diagnostics | `src/domains/protection/background/protocol/dispatch/ProtectionDispatchSettlementDiagnostics.js` | the tab-updated settlement diagnostic payload as pure field tables, where every reported field is a narrowing projection to its exact expected type or `null`, plus the before/after receipt ingress ordering | reporting a field without its type narrowing, recording from inside the builder, or letting a second caller mint a settlement payload shape of its own |
| Receiver-ready protection catch-up | tracking content protection sync | `src/domains/tracking/background/trackingContentProtectionSync.js` | bounded document/attempt reservation FIFO plus exact expected/current-document supersession classification | treating an unknown, malformed, same-document, URL-only, or attempt-only mismatch as benign supersession |
| Dispatch transport and receiver recovery | protection dispatch transport | `src/domains/protection/background/protocol/dispatch/ProtectionDispatchTransport.js` | receiver-ready gated tab message delivery; forced recovery requires an exact version/document/attempt/session-generation capability ACK and performs one post-ACK send | ad hoc `tabs.sendMessage` calls, delay ladders, or local reinjection retry loops |
| Dispatch permission gate | protection dispatch permission gate | `src/domains/protection/background/protocol/dispatch/ProtectionDispatchPermissionGate.js` | scripting/exact-current-origin permission state, bounded lookup diagnostics, skip-log throttling, and explicit-false admission before content readiness/injection | dispatcher-local permission caches, domain-wildcard substitution, permission checks after `ensureContentScriptReady`, or silent permission lookup failures |
| Dispatch payload builder | protection dispatch payload builder | `src/domains/protection/background/protocol/dispatch/ProtectionDispatchPayloadBuilder.js` | `PROTECTION_UPDATE` payload, normalized policy projection, envelope merge, and stable payload signature | dispatcher-local payload, policy, or signature assembly |
| Dispatch state ledger | protection dispatch state ledger | `src/domains/protection/background/protocol/dispatch/ProtectionDispatchStateLedger.js` | last payload signature/context, previous envelope revision/state, and a bounded receiver revision floor learned from an exact stale ACK | dispatcher-local parallel Maps, persisted dispatch state, or treating a stale/non-mutating ACK as committed state |
| Dev-only Suikinkutsu audio research | protection runtime + runtime QA in the dev profile; no public runtime owner | `docs/architecture/runtime/audio-dulling-runtime-architecture.md`, `src/apps/background/services/runtime/messageRoutes/audioDullingQaMessageRoutes.dev.js`, `scripts/qa/protocols/audioDullingQaProtocol.mjs` | trusted human QA ritual and exact-tab coordinator in dev; no public dispatcher, runtime binding, sender action, offscreen entry, or emitted capture artifact | importing the dev QA bridge/coordinator into a public release path or fabricating the browser-required invocation |
| Gate dispatch and session | protection gate dispatch bridge + Gate controller | `src/domains/protection/background/protocol/dispatch/ProtectionGateDispatchBridge.js`, `src/domains/protection/background/GateInterstitialController.js`, `src/platform/storage/runtime/GateInterventionSessionRepository.js` | exact source mutation fence, authorized ephemeral session, same-tab top-level navigation and closed preserved/redirected disposition for every Gate | unowned tab/session mutation, reason-string inference, pre-visible shown evidence, or restoring a retired inline transport |
| Dev Gate QA transport | QA automation trust + Gate automation contract/route | `src/platform/security/qaAutomationHarnessTrust.dev.js`, `src/domains/protection/background/automation/gateQaAutomationContract.dev.js`, `src/apps/background/services/runtime/messageRoutes/gateQaAutomationMessageRoutes.dev.js` | exact trusted harness sender, bounded entry-checkpoint request, controller-owned presentation/session proof/cleanup | arbitrary runtime snapshots, raw session-storage seeding or reads, public-build inclusion, or direct `gate.html` fixtures treated as runtime evidence |
| Detour foreground entry | tracking browser event handlers + runtime input provider | `src/domains/tracking/background/trackingBrowserEventHandlers.js`, `src/domains/protection/background/ProtectionRuntimeInputProvider.js` | explicit foreground ingress plus canonical browser-wide protected inventory | opener notice, background redirect/focus, settings ticks interpreted as entry, or a group-specific budget |
| Nudge dispatch context | protection nudge dispatch context | `src/domains/protection/background/protocol/dispatch/ProtectionNudgeDispatchContext.js` | runtime nudge theme/language context, trigger target, recovery copy, and navigation-only dashboard recovery URL | dispatcher-local language/theme fallbacks, recovery URL assembly, target-minute facts in URL params, or duplicated trigger-target math |
| Nudge dispatch runner | protection nudge dispatch runner | `src/domains/protection/background/protocol/dispatch/ProtectionNudgeDispatchRunner.js` | nudge dispatch order, public trigger API, and transport send orchestration | dispatcher-local nudge lease, stats threshold, timeline, or nudge message assembly |
| Nudge dispatch gate | protection nudge dispatch gate + atomic session run owner | `src/domains/protection/background/protocol/dispatch/ProtectionNudgeDispatchGate.js`, `src/domains/nudge/runtime/session/nudgeSessionDispatchState.js` | foreground/debt/stats eligibility, in-flight lock, atomic dispatch begin, and exact pre-presentation abort | runner-local gate state, send-before-pending ordering, stats threshold checks, or lease-only cleanup branches |
| Nudge dispatch message builder | protection nudge dispatch message builder | `src/domains/protection/background/protocol/dispatch/ProtectionNudgeDispatchMessageBuilder.js` | protocol profile derivation, recovery-aware config merge, and `NUDGE_START` payload shape | runner-local nudge payload/profile assembly |
| Nudge dispatch timeline | protection nudge dispatch timeline | `src/domains/protection/background/protocol/dispatch/ProtectionNudgeDispatchTimeline.js` | forced debug sentinel timeline formatting for nudge dispatch phases | runner-local sentinel timeline source/phase/status formatting |
| Content injection and exact-document probe | tracking content orchestrator | `src/domains/tracking/background/ContentScriptOrchestrator.js` | receiver-ready-gated catch-up/recovery plus narrowly typed executions, including same-build runtime rebind through `CONTENT_RUNTIME_PROBE` and one read-only isolated-world `location.href` document proof | `executeScript` outside orchestrator, treating an empty worker-local registry as proof that loader injection is required, treating injection completion as receiver readiness, arbitrary function injection, broad frame targeting, or caller-selected probe code |
| Registration diff | managed content sync | `src/domains/tracking/background/ManagedContentScriptSync.js` | desired top-frame loader, media-frame probe, and prepaint registration plan from explicit permission owners | recovery injection from registration owner or empty permission snapshots |
| Content session state | session registry | `src/domains/tracking/background/TabContentSessionRegistry.js` | `tabId` plus document/session metadata, receiver capability version, registry-global monotonic session generation with an atomic frozen snapshot, exact generation+document+old-URL CAS refresh, explicit navigation invalidation, non-invalidating scope metadata refresh, and observed media frame sessions | tab-only stale resurrection, generation reuse after eviction/ABA, reconstructed multi-read identity, non-CAS URL repair, or treating a managed-registration scope refresh as document navigation |
| Media-frame observation | top-frame registry reporter + iframe probe + tracking orchestrator | `src/apps/content/topFrameMediaDiagnosticsReporter.js`, `src/apps/content/mediaFrameProbe.js`, `src/domains/nudge/video/VideoElementObserver.js`, `src/domains/tracking/background/ContentScriptOrchestrator.js` | canonical top-registry and incremental child-frame reports keyed by tab/frame/document and observation mode | top-frame probe scans or treating frame observation as dispatch/control authority; the separate admitted HTML media hold contract is owned by `FrameMediaControlBroker` |
| Content bootstrap | content bootstrap controller | `src/apps/content/bootstrapController.js` | local bootstrap state + background handshake | sidecar-ready treated as receiver-ready |
| Runtime effect apply | content protection controller | `src/domains/protection/content/ProtectionController.js` | dispatcher protection envelope | bootstrap snapshot as writer, feature-local listeners or retired Gate iframe start/stop handling |
| Content activation diagnostics | content protection diagnostics | `src/domains/protection/content/runtime/protectionRuntimeDiagnostics.js` | separate last-delivery-attempt evidence and last-successfully-applied activation state | letting stale, resync-required, rejected, or failed-mutation attempts replace applied `activeFilterKeys` truth |
| Detour gate presentation | Gate controller + canonical Gate app | `src/domains/protection/background/GateInterstitialController.js`, `src/apps/gate/GateInterstitialApp.jsx` | top-level White Night Predator selection, exact Gate document authorization, fresh inventory, selected closure and automatic exact-URL return | opener notice/rail, content iframe, silent target replacement, fake external-close receipt/pass, or group count as budget truth |
| Early runtime bootstrap | content bootstrap early-runtime owner | `src/domains/protection/content/bootstrapEarlyRuntime.js` | already-compiled `bootstrap.friction.runtime` entries | treating compiled `level + value` entries as raw settings and normalizing them again |
| Compiled runtime filter projection | protection compiled-plan contract | `src/domains/protection/contracts/compiledRuntimeFilterPlanContract.js` | validated compiled entries plus narrow artifact-telemetry and social-metrics projections | reusing persisted `normalizeFilterSettings()` on executable filter entries |
| Fast root visual | bootstrap snapshot store | `src/platform/storage/bootstrap/BootstrapSnapshotRepository.js` | background-owned `bootstrap.root_visual` plus current-only `bootstrap.cache_generation`; generation mismatch deletes both derived bootstrap documents before projection | settings fallback, legacy-shape conversion, retaining prior cache generations, or IndexedDB read on hot path |
| Prepaint CSS | prepaint plan compiler + managed sync | `PrepaintVisualPlanCompiler.js`, `ManagedContentScriptSync.js` | fresh root-visual projection | global `*://*/*` prepaint CSS |

## Function Ledger

| Boundary function | Input | Output | Failure policy |
| --- | --- | --- | --- |
| `createProtectionDispatcher().dispatchProtectionUpdate` | runtime snapshot, tab, hostname | content message result or structured skip/failure diagnostic | fail/skip with reason; receiver-missing recovery goes through orchestrator; derived bootstrap refresh failures record diagnostics |
| `createProtectionTabLifecycleLedger().captureTabUpdated` / `noteCommitted` / `noteHistory` / `closeTab` | raw tab lifecycle ingress plus one atomic content-session snapshot | process-local monotonic ingress identity, latest tab lifecycle state, exact committed/History proof, and removal tombstone | Dispatcher is eager and the ledger is the only ingress/proof owner; committed and History invalidation use their exact proof generation as the serial queue tag; stale URL reactions stop before protection work; loading then complete for the same URL remains an ordered valid pair, and a later commit on that same URL likewise keeps the receipt current; History, removal, and any different URL — a commit that lands elsewhere included — supersede earlier updates |
| `createProtectionTabUpdatedIngressReceipt` / `claimProtectionTabUpdatedIngressReceipt` / `createProtectionTabUpdatedDispatchOutcome` / `consumeProtectionTabUpdatedDispatchOutcome` | exact raw ingress identity and Dispatcher result | one-use receipt plus exactly one closed `applied` or `superseded` outcome correlated by tab and ingress sequence | only issued receipts/outcomes pass; success carries the dispatch result inside `applied`; known lifecycle overtakes carry a compatible named error code inside `superseded`; hard failures reject and same-shaped external values fail loud |
| `createTabLifecycleEventQueue().enqueue` | tab id plus admitted browser reaction | same-tab FIFO before full-init/admission body execution | rejection cannot poison the next task; different tabs remain parallel; the queue owns ordering only and never owns lifecycle truth. Two per-tab serializers stack, and the split is by question: this one orders *browser reactions* for a tab and carries no generation, fence, or document identity, while `ProtectionDispatchSerialQueue` orders *content mutations* for a tab and is the only one that can be invalidated. Work needing a fence belongs in the dispatch lane; work that merely must not interleave with another browser event belongs here |
| `createProtectionDispatchSerialQueue().enqueue` / `invalidateTab` / `closeTab` / `evictTab` | tab id, owned content-mutation task, lifecycle reason | same-tab content-mutation FIFO plus generation fence, privately issued queue-error provenance, raw-ingress invalidation, removal admission close, or final state eviction | rejected tasks cannot poison the next generation; tabs remain parallel; removal closes admission before admitted terminalization and final eviction; admission rejection or terminalization failure must still final-evict both the exact dispatcher lane and `ContentScriptOrchestrator` session; a queued task must not reacquire the public queue from inside its transaction; same-shaped external errors do not pass the queue provenance predicate |
| `createTrackingContentProtectionSync().reserve` / `start` | exact bootstrap document/attempt plan plus captured profile admission | succeeded, failed, suppressed, typed lifecycle cancellation, or typed `bootstrap_protection_sync_document_superseded` settlement | a navigation/remove owner cancels only reservations whose exact captured state generation it overtook and whose AbortSignal retains that owner's exact reason; this records `bootstrap_protection_sync_cancellation_settled` without a console error. Only a non-empty expected document and a distinct non-empty current document, correlated to the exact tab/reservation, proves old-document supersession; transport/admission/transaction mismatch and the detailed post-dispatch `CONTENT_BOOTSTRAP_PROTECTION_SYNC_DOCUMENT_STALE:document_replaced` proof are non-error settlements, while same-current, malformed, missing, generic `context_changed`, and unowned cancellation-shaped evidence remain hard failures |
| `createProtectionDispatchSettlementProofs()` proofs | private queue error plus the claiming ingress receipt | a more specific owned lifecycle error, or the original error untouched | never a swallow: each proof returns its input unless every named condition holds. Provenance comes from the queue's private issuance predicate, not from error shape. The exact proofs are tried first; the supersession proof sees only what they declined, and requires a navigation reason, a tag the tab's monotonic `historyGeneration` has reached, and a receipt strictly behind the current lifecycle head. A receipt that is still the head stays hard |
| `createProtectionLiveAdmissionReconciliation().inspectLiveAdmissionTabUpdateReconciliation` | private `ADMISSION_CONTEXT_MISMATCH:ready_session_url_mismatch` raised at admission capture, plus the claiming receipt | readmitted admission, delayed-tab-update supersession, or a refusal carrying its bounded diagnostic | staged: `correlateLiveAdmissionReceipt` must first derive one identity the receipt and error both attest, then an unchanged atomic snapshot must bracket a single `tabs.get`, then an exact document-scoped `location.href` probe with generation+document+old-URL CAS may run. Every stage refuses with evidence rather than widening scope, and an admission recapture is accepted only when it binds the exact generation just observed |
| `createProtectionDispatcher().sendProtectionUpdate` | tab id, canonical URL, optional expected document, dispatch overrides | exact document/URL-bound protection transaction, including at most one same-transaction fresh snapshot retry, a permissionless Gate redirect, an explicit permission skip, or a receipt-bound closed tab-update outcome | a claimed tab-update receipt always resolves as `applied` with its dispatch result or as a proof-compatible `superseded`; success cannot escape as an untyped value. A committed-navigation queue invalidation is benign only when the private queue error, exact committed generation/tag/certificate, and strictly later ingress sequence agree, with either complete receipt identity or complete identity absence and an actual document/URL change; it then becomes `protection_committed_navigation_superseded`. Ready identity is captured synchronously at enqueue; a raw tab-update receipt also binds the atomic content-session generation when one exists. A pre-init receipt with no ready identity may use only the private admission error's exact generation/document/session URL as its correlation baseline, then must pass the same unchanged atomic snapshot plus live-tab proof before supersession or exact-document probe/CAS refresh. Explicit-false scripting/current-origin permission is resolved before content readiness, probing, or injection. Its serial admission-fenced lane may still commit a non-content Gate redirect; inactive Gate work remains preserved and ordinary dispatch returns a typed skip without touching the content owner. Only a private owned `ADMISSION_CONTEXT_MISMATCH` raised before queue/content/Gate work may perform one `tabs.get`. Live URL equal to the unchanged ready-session URL retains the existing typed supersession. If that lookup races a canonical writer, Dispatcher may continue without a probe only when the frozen after-snapshot is a strictly newer ready generation at the same exact document/requested URL, the live tab is at that URL with no pending URL or the same requested pending URL, and a fresh admission recapture binds the exact after-generation. Otherwise, live URL equal to the receipt URL with no pending navigation requires one exact-document `location.href` probe, registry generation+document+old-URL CAS, and a fresh admission capture before the normal serial transaction. If that probe alone returns no result during an exact `loading` receipt, while the unchanged ready-session generation, receipt-bound document, exact live requested URL, absent pending URL, and pre-mutation dispositions all still match, Dispatcher emits a non-mutating delayed-update supersession and leaves the existing content effects untouched for the later committed/history/complete owner; this is not same-document proof and cannot commit dispatch state. `complete`, malformed probe shape, a third/pending URL, or any mutation-started path remains hard. A competing canonical writer may count as idempotent convergence only when the CAS proof and re-read snapshot show a newer ready generation with the same document already at the exact requested URL. A private transaction context mismatch/stale error supersedes only under exact receipt/admission/transaction/current generation monotonicity and same-document preservation; an identity-less loading receipt additionally requires a non-null exact admission document preserved through the transaction/current snapshot, while admission without document identity remains hard. If receipt URL differs from requested URL, the admission generation itself must have advanced and proven the requested URL before the later overtake. A no-ready-identity `loading` receipt supersedes document replacement only under private recovery mismatch, or a private after-send expected-document fence that carries strictly increasing transaction/current generations, plus current bootstrap identity, explicit invalid-document ownership, and an exact-document URL probe. Other lookup/probe failure, equal or malformed generation, a pending third URL, third live URL, changed or unlinked document, malformed identity, unproven downstream errors, or ABA remain hard; validated stale ACK retains only the receiver floor and requires a fresh applied ACK, while a second stale is terminal and cannot start a nudge |
| `sendMessageWithRecovery` / `normalizeTabsSendMessageResult` | tab id, content message, browser-port result, orchestrator readiness owner, optional exact transaction admission | direct/recovered delivery result or structured diagnostic failure | an exact frozen transaction document/URL admission is synchronously revalidated against the ready session and avoids a duplicate readiness await; callers without it still await orchestrator readiness; `{ response, error }`, `ok:false`, and `success:false` results are failures; a response returned after cooperative abort is normalized first, and ordinary protection delivery remains aborted; receiver-missing re-enters forced readiness once, requires the issued capability proof for the exact document/attempt/session generation, and makes one immediate post-ACK send with no delay retry ladder |
| `createProtectionDispatchPermissionGate().getState` | current tab HTTP(S) URL, browser permission port, current time | allowed state, `permissionState`, or missing permission reason | derives and checks only the exact current-origin pattern; lookup failures record that origin in diagnostics and preserve unknown permission state instead of fabricating a deny; explicit false permissions skip dispatch before message send |
| `buildProtectionDispatchPayload` | hostname, runtime snapshot, settings cache, URL | protection update payload, envelope result, dispatch metadata, trace id, and stable signature | strips volatile trace id from signature; no storage reads or policy recompute outside runtime snapshot/settings cache projection |
| `createProtectionDispatchStateLedger().getPreviousEnvelopeInput` / `commitDispatchSuccess` / `resetDispatchAttempt` / `resetTab` | tab id, payload signature, envelope result, last dispatch context, exact stale receiver revision | previous envelope input, unchanged signature decision, planner context, failed-attempt state retaining only the highest receiver floor, or fully cleared lifecycle state | in-memory only; failed delivery/gate/permission attempts discard signature/state but retain the known floor, successful commit consumes it, and committed navigation/tab eviction clears it; no persistence or alternate policy source |
| `requireProtectionUpdateAcknowledgement` | transport result and content response | applied envelope ACK or typed stale/malformed/document-stale failure | exact post-ensure frame/document identity binds the send and must match at commit; stale or non-mutating replies never commit |
| `createProtectionGateDispatchBridge().present` / `refreshBootstrap` | tab, snapshot, theme preference and mandatory synchronous mutation fence | closed preserved/redirected presentation or derived bootstrap refresh | fence around async reads; redirect is terminal; invalid disposition fails; derived refresh failure is diagnostic-only |
| `createGateInterstitialController().presentForRuntimeSnapshot` | tab, snapshot, mandatory mutation fence and canonical owners | serialized same-tab Gate redirect or preserved skip | source-fenced reads/staging/group release/navigation; exact staged rollback on failure; terminal redirect never rechecks the destroyed document |
| `createGateInterstitialController().handleTabNavigation` / `readTabSession` | tab id, observed URL, browser-ingress timestamp, presentation transaction/watermark, active repository session | gate-page ownership, delayed pre-redirect observation rejection, resume/escape outcome, or read-only session-commit proof | processing an old URL observation as a post-Gate escape, feature-local session reads, or weakening post-watermark fail-closed navigation |
| `readProtectedTabInventory` / `refreshDetourSessions` | current settings/session/tab inventory and exact pending Gate identity | canonical global count/list/cap or budget-cleared exact-URL handoff | stale Gate projection fails; selected URLs are not replaced; external closes produce no decision/pass/tutorial receipt; resume failure stays pending |
| `createProtectionNudgeDispatchContext().resolveRuntimeContext` / `buildRecoveryAwareNudgeConfig` | nudge config, runtime snapshot, theme preference, runtime language, hostname | normalized nudge runtime context plus recovery-aware copy and dashboard URL | language/theme read failures record diagnostics before bounded default normalization; dispatcher must not duplicate recovery copy or URL assembly |
| `createProtectionNudgeDispatchRunner().maybeTriggerProtectionNudge` / `triggerDetached` | tab id, URL, runtime snapshot override, debug overrides, optional exact content-mutation fence, stats/settings/runtime owners | dispatched nudge result, structured skip, detached diagnostic, and sentinel timeline events | production callers await the runner inside the dispatcher tab lane through exact `NUDGE_START` ACK or terminal skip; force-debug remains a separately authorized seam; begin-session failure cleanup uses the exact begin receipt; an exact START ACK overtaken only by same-document History URL invalidation preserves content/background ownership for next-route reconciliation, while committed document replacement aborts the run |
| `createProtectionNudgeDispatchGate().evaluateReadiness` / `beginDispatch` / `abortDispatchAfterFailure` / `readEpisodeOwnerSnapshot` / `markEpisodeAbsorbedAfterDispatch` | tab id, hostname/date/key, trigger target, browser port, stats cache, timeline owner, optional site owner snapshot | readiness result, atomic dispatching pending+lease evidence, exact abort diagnostic, or structured site absorption CAS result | force debug bypasses the production ledger and its lifecycle messages are non-mutating; normal send starts only after issued-run persistence; abort cannot erase a run already marked presented; site absorption requires the exact pre-transport six-ledger generation |
| `buildProtectionNudgeStartMessage` | config, runtime snapshot, trigger target, debt/force/debug state, dispatch context, host/date/key/run id | `NUDGE_START` message, nudge reason, protocol profile, runtime context, recovery-aware config | no browser/storage reads; payload shape comes from runtime snapshot plus nudge dispatch context only |
| `createProtectionNudgeDispatchTimeline` | timeline recorder, force flag, tab, URL, hostname | normalized forced debug timeline events | runtime dispatches do not record timeline noise; forced debug events carry route/source/phase/status in one place |
| `createManagedContentScriptSync().syncManagedContentScripts` | settings cache, permission-owner snapshots, script file manifests, prepaint plan | registered domains, missing domains, matches, media-frame sidecar summary, prepaint plan, and catch-up tab plan | explicit false scripting permission returns missing-permission state; missing/malformed permission owners throw `MANAGED_CONTENT_SCRIPT_*` errors before registration planning; media-frame registration failures throw `MEDIA_FRAME_CONTENT_SCRIPT_*` errors |
| `createProtectionRuntimeCoordinator().sendProtectionUpdate` | direct protection dispatch plus optional prepaint registration owner | dispatch result and an admitted coalesced registration tail | direct dispatch does not wait for global managed-registration sync; one active sync plus one dirty rerun absorbs bursts. Settings broadcast still awaits its exact prepaint registration update before completing |
| `createContentScriptOrchestrator().syncManagedContentScripts` | registration diff plus catch-up tab plan | registration snapshot and catch-up summary whose successes reached `receiver_ready` / `active` | each catch-up target goes through `ensureContentScriptReady`; an `executeScript` completion without dispatch readiness is a failure, remains in the pending catch-up set, and is retried by `BackgroundSettingsPropagationCoordinator` for settings and service-init paths |
| `createContentScriptOrchestrator().refreshReadyDocumentUrlFromExactProbe` / `TabContentSessionRegistry.compareAndRefreshReadyDocumentUrl` | exact tab, generation, top-frame document ID, stale ready URL, and distinct requested URL | one document-targeted read-only `location.href` proof followed by a monotonic URL-only session commit or exact idempotent convergence observation | requires exactly one frame-0 result whose returned document ID and canonical URL equal the request; registry commit is an exact generation+document+old-URL CAS and preserves status, attempt, and bootstrap ownership. A stale-generation result exposes actual ready/document/next-URL equality so Dispatcher may accept only a newer same-document session already at the exact requested URL and recapture admission from that generation. Missing scripting, wrong result shape/frame/document/URL, equal generation, third URL, document change, or unproven concurrent change is terminal and never widens to a tab/frame scan |
| `ensureContentScriptReady` | tab id, URL, reason | `{ ok, source, reason }` readiness result | explicit `missing_scripting_permission`, `inject_failed`, `dispatch_ready_timeout`, or bootstrap failure |
| `noteBootstrapState` | trusted bootstrap message carrying document id plus attempt id/started-at | current dispatch readiness state | stale/failed states are terminal until reinjection or explicit state transition; older cross-document telemetry and older same-document attempts cannot replace the current dispatch-ready session |
| `failBootstrapInjection` | tab id, exact pending injection reason/generation, URL, error, failed-at | frozen `{ failed, session }` lease settlement | only the exact current pending lease may enter `failed` and clear pending/owner state; a superseded failure returns `failed:false` without mutating the newer injection, while malformed ownership input fails loud |
| `markNavigated` / `refreshTabUrl` / `refreshScope` | browser document navigation, History API URL change, or managed-registration scope reconciliation | invalidated document session or metadata-only URL/reason refresh | only committed document navigation invalidates document ids and media-frame sessions; History and in-scope refresh update canonical URL metadata while preserving the current `receiver_ready` / `active` document |
| `noteContentMediaFrameState` / `noteMediaFrameState` | trusted top-registry or child-frame probe message plus sender frame identity | observed media frame session keyed by tab/frame/document with canonical frame kind and observation mode | invalid sender frame ids are ignored; sender frame `0` requires `top_frame_canonical`, child frames require `frame_probe_incremental`; navigation marks sessions stale; frame observation never counts as dispatch-ready |
| `bootstrapContentRuntime` | document-start loader import plus canonical attempt lease | `bootstrapping -> receiver_ready -> active` or named stale no-op | every local/background commit is fenced by the same attempt identity; pre-receiver current-attempt exceptions publish `failed`; post-receiver current-attempt sidecar failures keep `receiver_ready`; revoked attempts cannot publish `receiver_ready`, `active`, or `failed` |
| `applyEarlyRuntimeBootstrapSnapshot` | fresh host-scoped friction snapshot plus current-attempt assertion | selected compiled early-runtime features | consumes snapshot `runtime` as compiled feature truth; checks ownership after the async read and immediately before effect application; does not pass materialized `value` entries back through raw settings normalization |
| `requireCompiledRuntimeFilterPlan` / `projectCompiledRuntimeFilterPlanForTelemetry` | final runtime filter plan | validated executable entries / telemetry-owned state projection | rejects missing or mismatched materialized values and never re-normalizes compiled entries as persisted settings |
| `projectCompiledRuntimeSocialMetricsSetting` | final runtime filter plan | canonical single social-metrics setting | validates compiled siblings, requires the owned entry, and never passes the full plan to a settings-map resolver |
| `installProtectionRuntimeReceiver` / `teardownProtectionRuntimeReceiver` | receiver listener and page-local runtime marker | installed/removed content message receiver | listener registration is authoritative; marker write/clear failures record environment diagnostics and do not become readiness truth |
| `recordProtectionRuntimeActivationAttempt` / `recordProtectionRuntimeActivationApplied` | resolved envelope attempt plus successful effect mutation | bounded attempt provenance plus last-applied runtime activation | every delivery records an attempt, but only a successful mutation commits applied activation; a non-mutating or failed attempt cannot rewrite applied keys |
| `readContentLoaderRootVisualSnapshot` | hostname + current time | fresh host-scoped root visual entry | missing/stale/inactive returns no fast visual; it does not read settings |
| `buildPrepaintVisualPlanFromRootVisualSnapshot` | fresh root visual snapshot | host-exact CSS tier plan | inactive/stale/empty root filter returns no plan |
| `clearFrictionSnapshot` | hostname or all | cleared boot cache | stale fast path is removed before rebuild |

## Recovery Versus Fallback

The runtime intentionally has recovery paths, but they must not become semantic
fallbacks.

| Class | Allowed? | Rule |
| --- | --- | --- |
| Receiver-missing reinjection | Yes | Only `ContentScriptOrchestrator` may perform it, and failures remain diagnosable |
| Dispatch-ready wait/retry | Yes | Waits for `receiver_ready`; it does not bypass the readiness gate |
| Already-open-tab catch-up | Yes | Dynamic registration produces exact catch-up targets, but a target succeeds only after the orchestrator observes `receiver_ready` / `active`; settings changes and fresh service init both enter the durable propagation executor, and timeout targets remain pending for bounded retry |
| Media-frame sidecar catch-up failure | Bounded | Records `media_frame_sidecar_inject_failed`; top-frame loader readiness remains authoritative |
| Permission lookup failure | Bounded | Lookup failures record diagnostics and leave `permissionState` unknown; explicit missing permissions skip dispatch before content send |
| Suikinkutsu unavailable in public | No active release seam | Dev QA fails explicitly when capture or human invocation is unavailable; public code exposes no no-op capture API, and research modules stay outside the public static closure |
| Receiver installed marker write failure | Bounded | Marker write/clear failures are diagnostics only; they do not block listener registration or replace bootstrap `receiver_ready` truth |
| Status indicator bootstrap settings read/default | No active seam | The settled authoritative `PROTECTION_UPDATE` supplies indicator settings and protection state; sidecar startup does not read settings or reset that state |
| Post-receiver sidecar activation failure | Bounded | Keeps the installed receiver dispatch-ready as `receiver_ready` with degraded diagnostics; it does not promote to `active` or downgrade the session to `failed` |
| Root-visual cache miss | Yes | Suppress fast prepaint/root visual and wait for authoritative dispatch |
| Dev raw-source bootstrap candidate | Yes | Development-only candidate injected by build constants; production starts with bundled artifacts |
| Classic content-script runtime probe | Bounded | `loader.js` and the child-frame-only `mediaFrameProbe.js` may touch the raw extension runtime namespace because registered content scripts are classic files; the probe may additionally read `chrome.dom.openOrClosedShadowRoot` for its declared author-shadow inventory capability. Module code resolves the DOM capability through the canonical extension API port. The exception must not become storage, tabs, scripting, or policy access; a pre-version probe without teardown requires navigation/reload and must not be layered with a second probe |
| Settings read from content hot path | No | Content must not recompute policy from settings |
| Second injection owner | No | Registration sync, dispatcher, dashboard, or debug tools must not call `executeScript` |
| Bootstrap snapshot as canonical policy | No | Snapshots are derived boot caches and may be invalidated at any time |

## First-Pass Findings

### F1. Current docs still described a settings fallback

Status: fixed in this pass.

`friction-filter-injection-architecture.md` described early bootstrap cache
failure as continuing through a settings fallback. Current code does not need
that interpretation: `loader.js` suppresses prepaint/root visual when the root
visual reader fails or returns stale/inactive data, while the authoritative
background dispatch path remains the source of truth.

### F2. Runtime recovery is currently explicit enough to keep

Status: keep.

`ContentScriptOrchestrator` owns dispatch-ready wait, reinjection, teardown,
and diagnostics. `ProtectionDispatcher` records receiver-missing diagnostics and
returns structured failure if recovery cannot establish readiness. This is a
bounded recovery path, not a second policy source.

Managed registration produces the exact already-open-tab catch-up plan for a
fresh worker lifetime or newly granted domain. The orchestrator executes that
plan through `ensureContentScriptReady`, so `executeScript` completion alone is
not a successful catch-up. Targets that never publish `receiver_ready` or
`active` remain in the pending catch-up set and fail the current sync with
`CONTENT_SCRIPT_CATCH_UP_READINESS_FAILED`. The outer bootstrap treats unrelated
startup owners independently, but the catch-up task itself is written to the
settings propagation checkpoint and retries the failed stage across worker
restart. The real MV3 lifecycle harness requires a `service_init`
`catch_up_readiness_completed` event with at least one attempted target and no
failure after worker revival.

`trackingRuntimeCoordinator.syncManagedContentScripts` validates the incoming
worker-local `propagationContext` and passes that same identity to the
orchestrator. Its permission-cache refresh wrapper must retain the settings
execution AbortSignal so superseded registration/catch-up work is revocable.
Non-settings callers retain the explicit null-context contract.

Registration convergence and worker-lifetime open-tab catch-up use separate
domain caches. A registration-only prepaint sync may win startup scheduling,
but it cannot mark those domains as catch-up reconciled; the following
`service_init` sync must still query the already-open tabs and drive each target
through dispatch readiness. Every `service_init` attempt re-enumerates all
registered domains: an earlier attempt that observed an empty settings scope,
or another open-tab sync that won startup ordering, cannot consume the later
canonical startup proof. Already-ready runtimes are only rechecked, not
reinjected. Removed domains are pruned from both views so a later re-addition is
catch-up eligible again.

The `service_init` catch-up task is awaited by the background full-init promise.
This lifetime binding keeps the message or event that wakes a fresh MV3 worker
open until receiver readiness settles, preventing suspension between tab
enumeration and `catch_up_readiness_completed`. Catch-up failures remain
best-effort bootstrap diagnostics and do not reject full initialization.

A fresh worker first sends `CONTENT_RUNTIME_PROBE`. A same-build, dispatch-ready
response is accepted only after the orchestrator's fixed top-frame
`location.href` execution proves the exact URL and returns a concrete document
ID, and the probe carries the exact receiver-capability contract version; the
registry is then rebound without executing `loader.js`. Missing receivers,
build or capability mismatches, non-ready state, or unproven document identity
enter the normal loader injection path. Worker-local cache emptiness never forces
dynamic content-script unregister/register: registration applies through
`updateContentScripts`, with unregister/register reserved for Chrome's explicit
missing/not-fully-registered response.

Managed-registration reconciliation is not a navigation source. For an
in-scope tracked tab it calls the registry's `refreshScope` metadata seam, so a
YouTube-style SPA URL change observed during settings sync cannot turn the live
document `stale`. Browser navigation events continue to call `markNavigated`,
which invalidates the exact document id and its media-frame sessions.

`contentScriptOrchestratorState.js` owns only sync snapshot normalization,
catch-up target normalization, catch-up readiness summary shape, and diagnostics-shape
assertions. It must not call `executeScript`, send teardown messages, wait for
dispatch readiness, or become a second content-runtime execution owner.

### F3. Prepaint remains derived and host-scoped

Status: keep.

`PrepaintVisualPlanCompiler` only projects fresh `bootstrap.root_visual` entries
into host-exact CSS registrations. It does not read settings, IndexedDB, or tab
policy directly.

### F4. Dispatcher transport now has its own owner seam

Status: fixed in this pass.

`ProtectionDispatcher.js` remains the protection decision orchestrator, but the
receiver-ready send path is now owned by `ProtectionDispatchTransport`. The new
transport seam owns browser-port shape validation, tab message result
normalization, receiver-missing diagnostics, foreground-tab lookup, and bounded
receiver-missing retry through `ContentScriptOrchestrator`. It is not a second
dispatcher facade: it cannot build policy payloads, query tabs, or send before
`ensureContentScriptReady` returns readiness.

Permission lookup caching and repeated skip-log throttling also moved out of
the dispatcher into `ProtectionDispatchPermissionGate`. Explicit missing
scripting or host permissions skip before content readiness, runtime probing,
injection, or send for protection updates and ordinary nudge START/STOP work.
The permissionless protection lane retains only the separately authorized Gate
redirect capability under the same serial admission fence; inactive Gate evaluation
returns the permission skip without touching content ownership.
Permission API failures remain bounded diagnostics and do not become silent
denies or a dispatcher-local cache branch. Host checks use the current tab's
exact origin; they do not widen a granted origin into scheme or subdomain
wildcards.

`ProtectionDispatchPayloadBuilder` now owns `PROTECTION_UPDATE` payload
construction, policy projection, indicator/debug/data-collection setting
normalization, envelope merge, and stable signature assembly. The dispatcher
receives those values as a dispatch artifact and must not duplicate payload or
signature construction locally.

Payload signatures, previous envelope revision/state, last tab dispatch context,
and the receiver revision floor now live in `ProtectionDispatchStateLedger`.
The ledger is in-memory bookkeeping only. Failed gate/permission/delivery attempts
drop speculative signature/state while retaining the highest receiver-proven
revision. A validated stale ACK causes one strictly newer fresh snapshot retry
inside the same dispatcher transaction; only its exact applied ACK commits.
A second stale or delivery failure passes to the durable settings coordinator
without losing the highest floor. Successful commit consumes that floor;
committed top-frame navigation and tab eviction perform the full lifecycle reset.
The ledger must not become storage or policy truth.

Protection envelope acknowledgements and Gate surface acknowledgements are
different protocols. An applied protection ACK has an exact source/stale/revision
shape. A stale ACK proves no mutation, is returned as a typed failure, and may
contribute only its validated receiver revision floor. The dispatcher fences the
ACK with the post-ensure ready content `documentId`; the transport also targets
that exact top-frame document rather than an unbound tab receiver. Browser committed-navigation
handling resets the dispatcher ledger and the content session together. Retryable
settings-stage and checkpoint-write attempts are warnings; only a retry-exhausted
retained task or a terminal checkpoint durability failure is an extension error.

Suikinkutsu has no public dispatcher hook. The coordinator, offscreen graph,
activation surface, and exact-tab bridge are executable only through the
trusted human dev QA route, while `ProtectionDispatcher`, its eager app binding, and
the public runtime binding surface expose no capture API. Public builds exclude
the offscreen input and fail if any capture module or signature enters the
emitted closure.

Gate interstitial presentation and derived bootstrap refresh now route through
`ProtectionGateDispatchBridge`. The dispatcher no longer resolves gate theme
presentation or assembles bootstrap refresh arguments directly; bootstrap
refresh failure remains diagnostic-only and cannot become a second policy
source.

Receiver-ready catch-up carries one dispatcher-owned opaque mutation fence through
that bridge into `GateInterstitialController`. It captures the original expected
content document, canonical URL/hostname, serial generation and abort signal and
stays synchronous. Queued/async reads, session staging, managed-group release and
`tabs.update` remain source-fenced. A successful Gate navigation intentionally
replaces the document and returns terminal `documentDisposition: redirected`;
callers perform no later original-document assertion. Failure before that terminal
point restores only the exact staged session, never a successor. Detour has no
prepared START/STOP, content surface ACK or iframe transport path.

Nudge dispatch context, recovery copy, runtime language/theme normalization,
trigger-target resolution, and recovery dashboard URL assembly now live in
`ProtectionNudgeDispatchContext`. This keeps `ProtectionDispatcher` focused on
dispatch orchestration and prevents nudge presentation metadata from spreading
into local helper branches.

Nudge dispatch eligibility, stats threshold checks, foreground gating, lease
handling, sentinel timeline recording, and `NUDGE_START` delivery now live in
`ProtectionNudgeDispatchRunner`. The dispatcher no longer owns nudge lease
state or nudge message assembly. Production dispatch is awaited inside the same
per-tab content-mutation lane as protection and Gate work, so settings disable
cannot overtake an in-flight START before its exact ACK/terminal skip. The
trusted force-debug seam retains its explicit public runner path and does not
become production ordering authority.

`TrackingProtectionService` projects one narrow `activityDay` context from the
canonical runtime input stats: `{ basis: 'activity-day', dateStr, resetHour,
activeMs }`. Both active and inactive snapshots carry that context; absent
current-day/domain facts mean zero observed usage, while missing day-basis
metadata or invalid usage rejects. This is a runtime projection, not another
stats store. The dispatch runner uses its date for site/global episode keys and
its site usage for site thresholds; global thresholds retain the policy's
explicit blocked-usage observation. The gate requires an explicit observation
and never reads the calendar cache. Thus midnight before the configured reset
neither reopens a shown episode nor makes a terminal global release/max-filter
decision expire immediately under a different date. Terminal persistence keeps
the exact issued episode date, and the runtime input owner evaluates that date
against the same current activity day. Missing context fails with
`PROTECTION_NUDGE_DISPATCH_ACTIVITY_DAY_INVALID`; dispatch has no independent
clock-derived day or raw stats-cache accessors.

Inside the runner, second-level ownership is split again. `ProtectionNudgeDispatchGate`
owns foreground/debt/stats/in-flight/lease/pending decisions;
`ProtectionNudgeDispatchMessageBuilder` owns protocol profile and `NUDGE_START`
payload shape; `ProtectionNudgeDispatchTimeline` owns forced debug timeline
event formatting. The runner should remain an order-of-operations coordinator,
not a second home for those policies.

Protection background browser permission calls now route through
`backgroundKernelPermissionBrowserPort`. Missing permission APIs, browser
callback errors, and non-boolean permission results reject at the app-runtime
port boundary, letting `ProtectionDispatchPermissionGate` record lookup
diagnostics and preserve unknown `permissionState` instead of receiving a
silent `null` or `false` fallback from the port.

### F5. Receiver marker failures stay diagnostic-only

Status: fixed in this pass.

`ProtectionController` writes `__entropyProtectionRuntimeReceiverInstalled__`
as a page-local observation marker, but listener registration and bootstrap
state remain the authoritative readiness path. Marker write or clear failures
now record `recordProtectionEnvironmentProbe` entries with the failing phase and
warn once at the controller boundary. They do not block receiver installation,
do not publish `receiver_ready`, and do not introduce a second readiness source.

### F6. Managed content sync permission owners are explicit

Status: fixed in the 2026-06-30 managed content sync permission pass.

`ManagedContentScriptSync` owns the desired dynamic registration diff for the
main content loader and host-exact prepaint CSS. It may return a normal
missing-permission snapshot when the scripting permission owner says
`false`, but it must not treat missing Chrome APIs, malformed permission
snapshots, or non-boolean scripting checks as empty permission state.

Resolution:

- `createManagedContentScriptSync()` now requires `hasScriptingPermission` and
  `getGrantedPermissions` owners at construction.
- malformed owner results throw `MANAGED_CONTENT_SCRIPT_*` errors before
  registration or unregister planning.
- `backgroundKernelContentScriptBindings.js` wires
  `permissionsContainsStrict()` and `permissionsGetAllStrict()` into the
  registration owner.
- `check:tab-time-tracker:architecture` rejects direct loose permission
  readers and optional permission snapshot reads in this seam.

### F7. Status indicator initialization consumes the authoritative update

Status: fixed in the 2026-10-12 settings wiring audit.

The receiver can settle `PROTECTION_UPDATE` while post-receiver sidecars are
still starting. The former indicator bootstrap requested settings separately
and wrote an unblocked default after that authoritative application, hiding the
protected-site indicator. That duplicate settings read/default path is removed:
the settled update is the sole initialization owner for indicator settings and
protection state, including valid unprotected plans. Sidecar startup never
overwrites that state.

The lazy indicator facade also owns a lifecycle epoch. Teardown revokes pending
view invocations and cache writes before clearing the loaded view, so an import
started by an old update cannot recreate the indicator after runtime cleanup or
overwrite a newer lifecycle's module cache. Producer-specific reason epochs
continue to own video/short-form cancellation.

Bootstrap teardown clears compiled runtime effects once through
`clearProtectionRuntimeEffects` and `ProtectionRegistry.clearAllProtectionEffects`.
The duplicate `clearResolvedFriction` facade is removed, including its unused
input-delay import. Protection sidecar teardown alone owns indicator teardown;
bootstrap does not invoke that same owner a second time. Every sibling cleanup
still starts and settles before the exact teardown ACK, including on failure.

### F8. Older cross-document bootstrap telemetry cannot replace current readiness

Status: fixed in the 2026-07-04 protection/content dispatch audit.

`TabContentSessionRegistry` already rejected explicitly invalidated document ids
and late `bootstrapping` / `receiver_ready` phase regressions. The missing case
was an older, different document reporting a terminal `active` or `failed`
state after a newer document had already become dispatch-ready. That could make
old telemetry look like the current content session when navigation/reinjection
ordering was unlucky.

Resolution:

- `noteBootstrapState()` now classifies older cross-document bootstrap messages
  as stale before they can replace a current `receiver_ready` / `active`
  session.
- the rejected document id is remembered in `invalidDocumentIds`, so subsequent
  late reports from that document continue to be ignored.
- `check:content-runtime:bootstrap-contract` requires the stale cross-document
  guard in `TabContentSessionRegistry`.

### F9. Fresh worker registration reconciliation recognizes Chrome's current error

Status: fixed in the 2026-07-12 MV3 lifecycle pass.

A fresh service-worker owner has empty in-memory registration signatures. When
Chrome answers `updateContentScripts()` with `does not exist or is not fully
registered`, `ManagedContentScriptSync` now classifies that exact result as the
bounded missing-registration reconciliation case and performs the canonical
unregister/register sequence. Other update failures remain loud and do not
fall through to re-registration.

### F10. Global content diagnostics do not become a tab-zero query

Status: fixed in the 2026-07-12 MV3 lifecycle pass.

`normalizeDiagnosticsTabId()` now preserves `null`, `undefined`, and blank input
as the unfiltered diagnostics scope. It no longer lets `Number(null) === 0`
silently hide worker-level catch-up and registration events behind a tab-zero
filter.

### F11. History API navigation preserves the live content session

Status: fixed in the 2026-07-12 MV3 lifecycle pass.

`tabs.onUpdated` loading/complete is not a document-identity authority because
Chrome can emit it for `pushState`, `replaceState`, and same-document history
traversal. Content invalidation now follows top-frame
`webNavigation.onCommitted`; History API signals preserve the exact document,
refresh its canonical session URL, invalidate work admitted for the prior URL,
and update navigation continuity without stale/reinject churn. An exact
`NUDGE_START` ACK that wins the race before this same-document
invalidation is a terminal content mutation: the nudge background run is preserved so content
ownership is not orphaned. The next URL transaction reconciles any remaining
route state. The document-scoped bootstrap registry and
receiver-missing recovery remain the authority when the optional
`webNavigation` capability is unavailable.

### F12. Same-document bootstrap attempts have one conditional write lease

Status: fixed in the 2026-07-14 runtime lifecycle pass.

`loader.js` creates one monotonic attempt identity and a cancellable in-flight lease. Recovery
revokes the prior lease before starting its replacement; controller state commits, early runtime
effects, fire-and-forget publish diagnostics, and loader completion all verify that same identity.
`TabContentSessionRegistry` rejects older or identity-less same-document completion telemetry once
a current attempt is known. A revoked attempt completes as
`CONTENT_BOOTSTRAP_ATTEMPT_STALE_NOOP` and cannot publish late `receiver_ready` or `failed` state.

### F13. Protection dispatches share one exact-context causal lane

Status: fixed in the 2026-08-12 protection catch-up convergence pass; cancellation
adjudication reworked in the 2026-08-28 pass recorded below.

`ProtectionDispatchSerialQueue` is the one per-tab content-mutation lane for
bootstrap catch-up, settings broadcast, ordinary refresh, Gate settlement, and
production nudge START/STOP work. A ready session contributes document and URL
identity synchronously at enqueue, while a non-ready session must become ready
inside the queued body before semantic work begins. Queue generation, exact
document, and canonical URL/hostname are checked across all await/send/commit
boundaries. A validated stale protection ACK schedules one private fresh
snapshot retry without public queue reentry; a second stale is terminal and
cannot trigger nudge work. Settings disable keeps update, exact STOP ACK, and
session terminalization in one target transaction. Raw removal closes admission,
admitted teardown terminalizes the run, and only then does final owner eviction
delete dispatcher/content state. Dispatcher construction is eager; its lifecycle
ledger records the removal tombstone at raw ingress, so there is no second lazy
buffer, replay phase, or publication race. A profile-admission rejection or
terminalization exception still final-evicts both the exact dispatcher tab state
and `ContentScriptOrchestrator` session. Because same-tab lifecycle reactions are
FIFO, final eviction deletes the exact removal tombstone; if a newer lifecycle is
already present, the older removal finalizer leaves that ledger state untouched.

Foreground activation, focus and replacement reactions call this protection
transaction once. Its protected-content leg already evaluates the nudge from
the same runtime snapshot and document fence, including an unchanged protection
signature; the reaction does not start a second standalone nudge transaction.
Gate completion, permissionless skips and terminal stale ACKs therefore retain
their original outcome without another nudge attempt. The tab-update completion
reaction may still evaluate a standalone nudge after its later stats/continuity
updates, and tick/debug entrypoints retain their independent owners.

Receiver-ready catch-up's 2000 ms deadline remains a hard failure. A Dispatcher
wrapper may report `PROTECTION_DISPATCH_ABORTED`; the sync owner restores its
`CONTENT_BOOTSTRAP_PROTECTION_SYNC_TIMEOUT` identity only when a private WeakMap
retains that reservation's exact timeout Error and its AbortSignal still carries
that same object as its reason. Bounded phase/timeoutMs diagnostics survive this
projection. Unowned or lifecycle aborts are not reclassified; no success, retry or
longer deadline is introduced. Bootstrap snapshot transport errors additionally
name the registered operation and elapsed time, and the post-receiver warning
prints its error as text so the extension Errors view does not hide it as Object.

Receiver-ready catch-up treats an old document as superseded only when exact
typed evidence names the reservation's expected document and a distinct current
document for the same tab. This includes transport/admission/transaction
document mismatch and the post-dispatch reservation assertion's detailed
`CONTENT_BOOTSTRAP_PROTECTION_SYNC_DOCUMENT_STALE` with
`reason: document_replaced`. Expected/current IDs containing surrounding
whitespace are malformed, not supersession proof. `trackingContentProtectionSync` records the bounded
non-error `bootstrap_protection_sync_document_superseded` diagnostic, and only
the Dispatcher-owned exact protection-send settlement may classify the same
proven mismatch as `protection_document_superseded`. The tracking reaction only
one-use consumes that branded result against the immutable raw-ingress receipt.
Same-current, missing/malformed identity, and
generic `context_changed` mismatches continue through the hard failure path.

For `PROTECTION_DISPATCH_PERMISSION_CHANGED` only, receiver-ready failure and
queued-retry diagnostics preserve `phase`, `expectedRevision`, and
`currentRevision`; the terminal console error preserves the same fields. The
phase is a lowercase colon-separated owner token of at most 96 characters and
revisions are non-negative safe integers with current strictly greater than
expected. Malformed metadata and unrelated error properties are omitted; no
URL, settings, or raw error object is copied. This projection changes no
permission fence, retry, success classification, or log severity.

If receiver-ready cancellation and dispatch queue invalidation happen at the same
ingress, the non-foreground/non-tab-update Dispatcher path checks the issuing
queue's immutable exact-task evidence before honoring the caller's already-aborted
signal. The existing `PROTECTION_DISPATCH_ABORTED` assertion then lets the sync
reservation settle only its own generation/abort-reason cancellation. A live
signal, error from another task/queue, runtime failure, or unproven error remains
hard. This does not classify a queue cancellation as a content ACK.

For dispatch-eligible HTTP(S) `tabs.onUpdated` loading/complete,
`ProtectionTabLifecycleLedger` freezes the exact tab/status/URL/sequence together
with one atomic ready-session snapshot before any admission await. Tracking does
not maintain a parallel sequence or History map. It queues same-tab reactions and
checks ledger currentness before handler work and again before dispatch; a newer
different URL, a commit that lands on a different URL, History ingress, or removal
therefore cancels stale work at the causal source. The same-URL loading/complete
pair stays valid and executes in FIFO order, and so does a receipt whose URL a
later commit confirms: the commit proves the navigation the receipt asked for
rather than displacing it. `ProtectionDispatcher.sendProtectionUpdate` claims the surviving
receipt once before dispatch work, and its direct catch is the only owner
allowed to combine private lifecycle-error provenance with committed/document/History
proof. The settlement constructor has a closed disposition-to-error matrix and
binds the result to that exact claimed receipt; the reaction consumes it once.
Immediately before a committed-navigation settlement, Dispatcher re-reads the
latest committed certificate and requires the private queue error's exact
generation tag, the same tab/document/URL certificate, and
`receiptIngressSequence < committedIngressSequence`. A receipt must carry either
all three ready identity fields or none of them, and a ready receipt must show
an actual document or URL transition. Only that proof projects
`protection_committed_navigation_superseded`; malformed or stale commit evidence
and forged same-shaped queue errors remain hard.
Immediately before a History settlement, Dispatcher also re-reads the live
certificate and requires exact generation/tag/sequence/document/old URL/new URL
equality plus the current ready-session identity. A newer valid or invalid
History observation, committed navigation, removal, or eviction therefore
revokes an already-created error snapshot; even a later certificate with the
same URL/document values is hard when its generation differs.
The outer browser-admission wrapper never examines lifecycle error fields, so a
same-shaped Gate, stats, nudge, or forged error remains terminal. Coordinator
recognition only stops prepaint/snapshot side effects and passes the branded
result back to the immediate tracking consumer.

`ProtectionDispatcher`'s own `PROTECTION_DISPATCH_EXPECTED_DOCUMENT_STALE`
error therefore carries the exact `tabId`, `expectedDocumentId`, and
`currentDocumentId`; it is eligible for the same non-error settlement only when
all three values pass that proof. A `loading` receipt captured before any ready
identity has one narrower recovery exception: the private transport error must
name distinct expected/current documents, the current canonical bootstrap
session must be ready on the exact requested URL, and a document-targeted probe
must reproduce that same document and URL before and after the proof. A delayed
`tabs.onUpdated` URL alone is not a monotonic lifecycle proof. The History-based
same-document exception begins at a
top-frame `webNavigation.onHistoryStateUpdated` event with exact document ID,
old ready-session URL, distinct new URL, and a process-local browser ingress
sequence. Dispatcher records these values with a generation that advances synchronously with its
serial-queue History invalidation. Only while that latest certificate still
matches the current ready session's exact document/new URL may an admission
mismatch carry `reason: same_document_history_overtaken`. The later
`tabs.onUpdated` boundary additionally proves the exact prior URL, same tab, and
a process-local browser ingress sequence strictly after the History event, and
`status: complete`, before Dispatcher settlement as
`protection_history_context_superseded`. Committed navigation, tab removal,
eviction, a newer History generation, missing/malformed document identity, and
any old/current URL mismatch clear or reject the certificate. A bare
`requestedUrl != sessionUrl` is never supersession evidence. Dispatcher inspects
that divergence before constructing an Error. Its only non-History reconciliation
path is narrower: the raw receipt, typed mismatch descriptor, and frozen
before snapshot must agree on generation `G`, document `D`, and stale session URL
`S`. If the live lookup itself observes an after snapshot at strictly newer
generation `H`, Dispatcher continues directly only when that snapshot is ready at
exact `D/R`, the live tab is also at `R`, any pending URL is absent or exactly `R`,
and a fresh admission recapture binds exact `H/D/R`. Otherwise the frozen after
snapshot must still equal `G/D/S`; the single live-tab read must prove the exact
receipt URL `R` with no pending navigation and `R != S`; then the orchestrator executes exactly
one read-only script against `documentIds:[D]` and accepts exactly one frame-0
result carrying document `D` and canonical `location.href === R`. The registry
alone may then CAS `G + D + S -> R`, advancing generation without changing
status, attempt, or bootstrap ownership. If another canonical writer wins that
CAS, the registry exposes its actual ready/document/next-URL equality; Dispatcher
continues only when a re-read proves a strictly newer ready generation already
at exact `D/R` and a fresh admission recapture binds to that generation.
Dispatcher otherwise does not manufacture a benign settlement. A private
transaction context mismatch/stale error may correlate an initially
identity-less `loading` receipt only when admission had already captured a
non-null document at exact requested URL `R`, that document equals the
transaction/current document, the current generation is strictly newer than
the admission/transaction floor, and the current ready session preserves that
document at distinct URL `T`. Admission without document identity remains hard.
After admission, an initially identity-less `loading` receipt may also observe the admitted document
being replaced after an acknowledged content send. That error is benign only when
the private fence carries `currentGeneration > transactionGeneration`, the current
bootstrap session is the exact requested URL at a distinct document and explicitly
lists the old transaction document in `invalidDocumentIds`, a document-targeted probe
reproduces the new document/URL, and a second atomic snapshot preserves its attempt
identity and nondecreasing status. A missing invalid-document link, equal generation,
probe mismatch, or another replacement remains hard. Separately,
other private transaction context mismatch/stale errors have a separate typed
`protection_same_document_url_superseded` exit only when receipt `G/D/S`,
requested URL `R`, exact `D/R` admission/transaction generation, a strictly
newer current generation, and the current ready `D/T` all agree. If `S != R`,
the admission generation must itself be newer than `G`, closing the chained
`S -> R -> T` proof without using wall-clock order. Equal generation, missing scripting, wrong or
extra results, another frame/document/URL, unproven CAS conflict, a pending third
URL, a third live URL, and document loss remain hard and project only bounded error
codes, generations, and equality booleans. The eager Dispatcher records raw
History context synchronously in the same lifecycle ledger that issued tab-update
receipts. There is no no-owner interval or forwarding wrapper. Invalid History
identity advances lifecycle order and clears the prior certificate without
manufacturing a replacement proof. The typed settlement/rejection/URL-reconciliation diagnostic projects only status,
disposition, optional error code, tab/document identity, phase, generations, ingress
order, and equality/probe/CAS booleans; raw old/current URL paths remain internal
proof and are not written to diagnostics.

The certificate is bounded multi-use rather than one-shot: repeated exact late
`complete` reactions for the same tab/document/current URL assert the same stale
proposition. Its lifetime ends at the next History ingress (including one whose
identity is invalid), committed navigation, removal, or eviction; successful
cancellation alone does not delete it.

Tab removal/replacement has a separate `protection_tab_removed` superseded
disposition. Only the dispatch queue's private invalidation for this exact task,
matching tab ID, `PROTECTION_DISPATCH_SERIAL_QUEUE_TAB_EVICTED` code and
`tab_removed`/`tab_replaced` reason can produce it. The dispatcher consumes the
existing ingress receipt and returns the typed settlement; it does not fabricate
an applied ACK. Downstream errors carrying the same public code without private
task provenance still reject. The browser listener logger does not suppress
errors by message text. See the dispatcher permission-gate regression tests.

The `complete` restriction is causal: a later full navigation can emit a
`loading` update that reverses the prior History URL before its committed event
arrives. Such loading mismatches remain hard even when an older certificate
still exists; the certificate is only for delayed completion of the proven
same-document transition.

The ingress sequence is assigned synchronously at each raw History, committed,
removal, and tab-update callback by the Dispatcher-owned lifecycle ledger.
Wall-clock equality or rollback is not
ordering evidence. A completion entered before History can therefore never
enter the delayed-completion disposition, even when both callbacks share the
same millisecond. It instead has a separate causal disposition: when an old
`complete` tab-update ingress is already waiting and History enters later, the
exact same certificate with `tabUpdateIngressSequence < historyIngressSequence`
settles `protection_history_pending_tab_update_superseded`. Equality is hard.
The wall-clock observation timestamp remains diagnostic metadata only and is
never an at-or-after causal gate.

An admitted, already-ready dispatch can also be invalidated during Gate theme
resolution. The serial queue binds that invalidation to the exact History
generation through `invalidationTag`. Only the audited
`gate_mutation:gate_bridge_after_theme_resolution` fence can wrap it as
`PROTECTION_DISPATCH_HISTORY_PRE_ACK_CANCELED`, because the Bridge ordering pins
that fence after theme resolution and before the Gate controller call,
repository staging, content delivery, or ACK. The wrapper additionally requires
`ensureSource: session_dispatch_ready`, exact tab/document/A-to-B certificate
identity, current ready session, and matching generation/tag. A tabs update may
consume it only when its exact old URL has `complete` status and its ingress
sequence is strictly earlier than History. Injection, reinjection, dispatch-wait,
other phases, missing/mismatched tags, and any started presentation/delivery/ACK
remain ineligible for that phase-specific pre-ACK wrapper. Gate session staging
is rolled back only by its exact redirect owner before a lifecycle error is rethrown.

The outer `tabs.onUpdated` catch has one separate general History-cancellation
settlement for an in-flight old `complete` reaction. It first requires private
`ProtectionDispatchSerialQueue` issuance provenance, then exact queue tag/latest
History generation, `receipt sequence < History sequence`, receipt `D/A`, and
current ready session `D/B` identity. Only then may it project the existing
`protection_history_pending_tab_update_superseded` result after all transaction
cleanup has completed. A forged queue-shaped error, loading receipt,
equal/reversed sequence, stale certificate, document mismatch, or A/B mismatch
remains hard.

The same catch has a separate committed-navigation cancellation settlement.
`ProtectionTabLifecycleLedger.noteCommitted` issues a canonical URL/document
certificate and uses its monotonic generation as the queue invalidation tag.
Only a privately issued queue error carrying that exact tag, the live latest
certificate, a strictly later committed ingress sequence, and complete receipt
identity shape becomes `PROTECTION_DISPATCH_COMMITTED_NAVIGATION_CANCELED` and
then `protection_committed_navigation_superseded`. Raw URLs stay inside the
proof; diagnostics expose only committed document identity, generation, ingress
order, phase, and the closed disposition. Equal/reversed order, a revoked
certificate, incomplete receipt identity, or unchanged ready document/URL is
hard.

A receiver-ready attempt that fails while its exact higher same-attempt retry is
already `scheduled` or `running` records
`bootstrap_protection_sync_retry_pending`. A retry for another attempt, a
same/lower record, or a settled record cannot defer the failure. With no exact
queued owner, and when the terminal retry itself fails, the failure diagnostic
and one flat, code-bearing `console.error` are both emitted. The deferral diagnostic names the exact
`pendingSyncAttempt` and closed `pendingStatus` (`scheduled` or `running`) that
owns recovery.

Committed navigation and tab removal/replacement are different from delivery
failure. The raw lifecycle owner stores the exact new state generation and the
exact locally issued abort reason before aborting every pending receiver-ready
reservation. Async settlement is non-error only when that reservation's signal
still carries the same reason and the new generation strictly overtook its
captured generation; it records `bootstrap_protection_sync_cancellation_settled`.
Generic aborts, timeouts, foreign same-shaped errors, and cancellation without
that generation/reason correlation remain hard.

The content-session registry separates a pending orchestrator injection reason
from a certified bootstrap owner reason. `noteInjecting` starts the pending
marker; only its subsequent `receiver_ready` transition certifies the owner for
that document, while failure, stale state, replacement, and committed navigation
clear it. Protection-sync suppression recognizes only the closed generated
reason set `protection_dispatch_transaction`,
`protection_dispatch_transaction:dispatch_ready_retry`,
`protection_dispatch_transaction:receiver_missing`,
`protection_dispatch_transaction:receiver_missing:dispatch_ready_retry`, `protection_update`,
`protection_update:dispatch_ready_retry`, `protection_update:receiver_missing`,
and `protection_update:receiver_missing:dispatch_ready_retry`. An unrelated or
prefix-only injection still runs normal catch-up. The original dispatcher lane
continues to own and surface its result; suppression only prevents a competing
force-snapshot from the certified receiver-ready handshake.
The suppression diagnostic also reports the exact content-free
`bootstrapOwnerReason` from that closed enum; it never projects page content or
URL paths.

An `active + loader_reinjected` report may also certify the pending reason, but
only through the existing strict reinjection/adoption identity fence and only
when the previous document is absent or exactly the incoming document. Arbitrary
active reports never certify ownership. Any nonempty previous/incoming document
mismatch clears both pending and certified owner state even when the previous
status was `injecting`, so document A's injection intent cannot suppress normal
catch-up for document B.

Each pending injection also carries the registry's monotonic
`bootstrapInjectionGeneration`. If both bounded dispatch-ready waits expire,
the orchestrator releases only the pending marker whose exact generated reason
and generation match the retry it owns. This terminal `dispatch_ready_timeout`
release does not mark the document session failed and cannot clear a newer
injection. A late ready report after the released lease therefore remains
unowned and schedules normal protection catch-up instead of suppressing it.
The same reason/generation lease fences loader execution failure: only the
currently matching injection may commit `failed` and clear its pending/owner
state. An older normal injection that finishes after a newer force injection
has started or become ready reports its own `inject_failed` result with
`failedCommitted:false`, but cannot overwrite the newer session or owner. The
failure settlement preserves the registry's latest URL rather than restoring
the older injection request URL.

#### 2026-08-28: cancelled is not failed

A dispatch cancelled by the tab navigating away was reaching `tabs.onUpdated` as a
hard listener rejection. Three separate causes, each a place where the lane knew the
answer and was not asked.

The lifecycle ledger holds one proof per tab: `noteCommitted` clears `historyProof`
and `noteHistory` clears `committedProof`. A second lifecycle event landing before the
catch block ran erased the evidence the exact proofs needed, so a provably cancelled
dispatch surfaced as an error. A weaker supersession proof now covers that case. Its
claim is narrower than the exact proofs and stated separately: `invalidateTab` is
reached only from `markTabNavigated` and `markTabUrlChanged`, both driven by real
`webNavigation` events, and each stamps its tag from the tab's monotonic
`historyGeneration`. A queue error carrying a navigation reason and a tag the ledger
has reached therefore proves a navigation cancelled the dispatch, even when the proof
object naming the winning document is gone. The receipt must still be strictly behind
the current lifecycle head; a receipt that is the head was overtaken by nothing and
stays hard.

`prepareContentMutationTransaction` asserted its fence only after
`ensureProtectionDispatchTransactionReady` returned, but readiness failures are raised
inside that call. Navigation cancels the lane through the fence, not through
`abortSignal`, so the fence never got to speak and the receiver was blamed for a
document the user had already left. The fence is now asked first on the failure path;
if the lane is still current the original readiness failure stands unchanged.

`TabContentSessionRegistry` did not treat `web_navigation_committed` as an
invalidating reason, so a session with no recorded URL survived it, and `commitSession`
settles waiters only for a status it can transition into while an `absent` session stays
`absent`. A pending `waitForDispatchReady` therefore burned its full budget on a document
already navigated away from, holding the lane for the whole window. A top-frame commit
replaces the document by definition and now invalidates unconditionally, and navigation
settles pending waiters whatever the prior status. `absent` is still preserved as a
status: there was never a receiver to make stale.

The ready budget itself moved from 1.5s to 3s on both sides of the handshake. The
content bundle import sits on the critical path to `receiver_ready` and does not fit a
warm-path budget on a busy page. `ensureContentScriptReady` spends the budget twice, so
the worst case for a genuinely dead receiver is double it — which is why the waiter
release above had to land in the same pass.

Adjudication is now two ordered passes rather than nested calls: proofs reduce over the
error strongest-first, and escalations are a table consulted only when the direct
inspector could not settle. Adding a case is a list entry. The proofs and the
live-admission pipeline moved to their own modules over
`ProtectionDispatchLifecyclePrimitives`, which exists so neither has to import the
dispatcher back.

Lane re-entrancy has no runtime guard and cannot cheaply have one: a second `enqueue`
for a tab whose body is running is indistinguishable from legitimate queuing without
async context tracking, and a false positive would break ordinary dispatch. The
convention — lane-free twins such as `sendNudgeStopForTransaction` beside
`sendNudgeStopForTab`, and the `nudgeDispatchRunner.*` methods beside the dispatcher
closures of the same name — is enforced statically instead by
`tests/protectionDispatchLaneReentrancy.test.js`, which walks the functions reachable
inside a lane body and rejects any bare call to a lane-acquiring entrypoint.

#### 2026-08-28: adjudication shape, and where the guards look

A follow-up structural pass on the same lane. No behavior changed; what changed is
whether a reader can find the rule that governs a case.

Settlement inspection results carry a type. `settledDispatchInspection`,
`readmittedDispatchInspection`, and `refusedDispatchInspection` live in
`ProtectionDispatchLifecyclePrimitives` and are the only ways to construct one, so a
branch cannot return an ad hoc object that happens to have the right keys.

`inspectTabUpdatedDispatchSettlement` is an ordered table rather than an if-chain.
`readTabUpdatedSettlementFacts` reads the six shared facts once and passes them down --
previously each branch read them from the enclosing scope, so in principle two branches
could observe different sessions. Five named inspectors then declare the predicate that
selects them, and the three History-overtake variants, which differed only in predicate,
required receipt field, and which URL to compare, are folded into `HISTORY_OVERTAKE_PROOFS`.

The Gate leg of `sendProtectionUpdateAttempt` is `runGateDispatchLeg`, with an explicit
contract: it returns `{ done: true, result }` for the six exits that end the attempt, or
`{ done: false, gateThemePresentation }` to hand off to the content leg. The three loose
`let`s the Gate accumulated -- surface acknowledged, content mutation disposition, and the
overtaken URL -- are owned by `gateOvertakeArbiter`, which also holds the two overtake
acceptors next to the state they set.

The two dispatch routes share their Gate rules rather than holding private copies. The
permitted and permissionless routes are the same machine under different permissions:
`acceptGateRedirectCommittedOvertake` (a redirect controller phase may proceed through the
committed navigation it just caused) and `settleGateInterstitialPresented` (the tail every
Gate presentation ends with) are single definitions both call. Bootstrap refresh and fence
assertions stay per-route, because those genuinely differ.

The settlement diagnostic payload is a field table in
`ProtectionDispatchSettlementDiagnostics`, a pure builder the dispatcher wraps. Every
reported field is a narrowing projection -- exact expected type or `null` -- which is what
keeps a malformed error from putting an arbitrary value in a log line.

**Guard ownership follows the code.** These extractions moved invariants out of
`ProtectionDispatcher.js`, and both static contract guards asserted every token against
that file, so they failed 66 and 1 times respectively without blocking anything: neither
runs inside `npm run build`. The invariants had not been lost, only relocated. When a
dispatch lifecycle invariant moves modules, `check:content-runtime:bootstrap-contract` and
`check:background-kernel:architecture` must be retargeted in the same change. Both are in
the verification set below; run them there, because a green `npm run build` says nothing
about either.

#### 2026-09-17: foreground dispatch lifecycle cancellation

`tabs.onActivated`, `windows.onFocusChanged`, and replacement-tab dispatch pass
their closed `foregroundSource` to `sendProtectionUpdate` and
`maybeTriggerProtectionNudge`. `ProtectionForegroundDispatch.js` owns settlement
for these sources; the existing tab-update receipt protocol remains separate.
The serial queue retains immutable invalidation evidence tied to the exact task
callback and issuing queue. Each dispatch creates a fresh callback. Only that
task's queue-issued navigation invalidation with a positive lifecycle tag, or
`tab_removed` / `tab_replaced` eviction, can produce a branded `cancelled` outcome.
This proof survives final eviction without retaining a second tab lifecycle store.

`ProtectionRuntimeCoordinator` forwards foreground ownership to both dispatch
legs and passes cancellation through without prepaint sync or runtime snapshot
publication. The dispatcher records `foreground_protection_dispatch_cancelled` with the source,
route, tab ID, phase, reason, and navigation tag. Tracking consumes the branded
outcome and ends the old event before its nudge continuation. This is cancellation,
not a successful content acknowledgement, retry, or permission grant. Errors from
runtime calculation, transport, ACK validation, readiness timeout without a real
lifecycle invalidation, other tasks/queues, or forged error objects remain hard.
The generic browser listener continues reporting every unhandled rejection.

Verification: `tests/protectionForegroundDispatch.test.js`,
`tests/protectionDispatcherPermissionGate.test.js`, and
`tests/trackingBrowserEventHandlers.test.js` cover exact ownership, navigation,
removal/replacement, continuation termination, and preservation of real failures.
`tests/protectionRuntimeCoordinator.test.js` verifies ownership forwarding.

## Verification Targets

Use these checks when this boundary changes:

- `npm run check:content-runtime:bootstrap-contract`
- `npm run check:content-script:ownership`
- `npm run check:background-kernel:architecture`
- `npm run check:tab-time-tracker:architecture`
- `npm run check:storage:architecture-boundaries`
- `npm run test:file -- tests/backgroundKernelProtectionDispatcherBindings.test.js tests/trackingBrowserEventHandlers.test.js tests/trackingContentProtectionSync.test.js tests/protectionDispatcherPermissionGate.test.js`
- `npm run test:file -- tests/protectionDispatchSerialQueue.test.js tests/protectionDispatchPayloadBuilder.test.js tests/protectionDispatchTransport.test.js tests/protectionDispatchPermissionGate.test.js tests/protectionDispatchStateLedger.test.js tests/protectionAudioDullingDispatchBridge.test.js tests/protectionGateDispatchBridge.test.js tests/protectionNudgeDispatchContext.test.js tests/protectionNudgeDispatchGate.test.js tests/protectionNudgeDispatchMessageBuilder.test.js tests/protectionNudgeDispatchTimeline.test.js tests/protectionNudgeDispatchRunner.test.js tests/protectionDispatcherPermissionGate.test.js tests/protectionDispatchPlanner.test.js tests/contentScriptOrchestrator.test.js tests/managedContentScriptSyncPermissionMode.test.js`
- `node scripts/ci/check-content-runtime-browser-like-contract.mjs`
- `node scripts/e2e/mv3LifecycleE2E.mjs --dist=<built-extension-dir>`
- `npm run test:file -- tests/contentScriptOrchestrator.test.js tests/contentRuntimeRecoveryIntegration.test.js tests/contentLoaderRootVisualPreload.test.js tests/protectionDispatcherPermissionGate.test.js tests/prepaintVisualPlanCompiler.test.js tests/protectionControllerNudgeDebugSpawn.test.js`

## Passive top-frame media diagnostics (2026-09-05)

TopFrameMediaDiagnosticsReporter subscribes passively by default. RuntimeDebugger
holds an observing diagnostic lease only during an explicit live/QA session. The
reporter shares product consumers' canonical inventory; switching demand releases
its previous lease. With no observing consumers, the registry stops discovery and
releases its document/shadow observers even if a passive reporter remains.

The top-frame report carries `inactive`, `observing`, `observed`, or `failed`.
Only `observed` has numeric `videoCount` and boolean `hasVideo`; other states carry
nulls. TabContentSessionRegistry and ContentScriptOrchestrator preserve these values
rather than presenting an unobserved document as an observed zero. Child-frame probe
counts keep their existing incremental observation contract. Discovery failure is
reported and cannot certify effect readiness. Frame observations never establish
policy activation, permissions, or dispatch readiness.
