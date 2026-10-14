# Friction Nudge Effect Boundary Map

- Status: Active
- Owner: repository architecture, nudge runtime, protection runtime
- Last validated against code: 2026-08-18
- Enso time-policy ownership validated: 2026-09-13
- Shared Horizon/Furin phase ownership validated: 2026-10-13
- Media discovery, hold and guard ownership validated: 2026-09-27; ordinary presentation consolidated: 2026-10-09
- Path policy: current-only
- Canonical for: content-side friction effect ownership, protection envelope application, nudge/behavior manager boundaries, signal gates, runtime debugger ownership, and bounded recovery rules
- Companion to:
  - `docs/architecture/repository/protection-content-runtime-boundary-map.md`
  - `docs/architecture/runtime/friction-filter-injection-architecture.md`
  - `docs/architecture/runtime/dom-targeting-runtime-architecture.md`
  - `docs/domains/protection/protection-settings-propagation-policy.md`
  - `docs/operations/qa/real-site-e2e.md`
  - `docs/architecture/runtime/feed-flow-runtime-target-architecture.md`
  - `docs/architecture/runtime/intervention-admission-runtime.md`

## Purpose

This map audits the runtime after a protection decision has reached content.
It does not replace the content bootstrap map; it answers how compiled
protection features become visual, text, input, click, scroll, video,
short-form, infinite-scroll, nudge-game, and debug effects.

The practical reading question is:

```text
Can a new friction effect identify its policy owner, activation boundary,
manager owner, cleanup path, and diagnostics path without adding a second
effect runner or silently recovering from missing runtime truth?
```

## System Flow

Background policy compiles an envelope before content sees any feature state:

```text
settings / rules / schedule / artifact state
  -> ProtectionRuntimeInputProvider / ProtectionRuntimeInputAssembler
  -> ProtectionPolicyCompiler
  -> ProtectionEnvelopeBuilder
  -> ProtectionDispatcher
```

An armed, engaged, or cleanup artifact adds `runtime_artifact` provenance only
to filter children that are already active in the resolved policy. Family
readiness cannot turn a configured or suppressed child ON. Short-form blocking,
video-skip protection, and detour protection retain independent activation.

Content applies only the envelope runtime truth:

```text
PROTECTION_UPDATE
  -> ProtectionController
  -> ProtectionActivationEngine
  -> ProtectionFrictionModifierRuntime
  -> ProtectionStateApplier
  -> ProtectionRegistry
  -> nudge effect managers
```

Keyed effects are mounted by individual feature key:

```text
compiledFeatures.inputVisualBrake
  -> keyedProtectionEffects[inputVisualBrake]
  -> InputVisualBrakeManager
```

Global effects consume the whole compiled feature set:

```text
compiledFeatures
  -> VisualManager / TextPipeline / SocialMetricsManager
```

Text Shuffle's owner-local profiles preserve Instagram identity/action links
and TikTok creator-profile destinations, including split mention/tag nodes.
Generic reading links and YouTube video-title links retain their eligibility.
Reparenting and selector-owned href changes revalidate and restore the exact
owned text; `tests/textShuffleSocialIdentity.test.js` protects these boundaries.
Instagram's reading surface additionally includes directed text spans within
article/standalone main owners. A post dialog containing an article is a reading
surface; ordinary dialogs and app indicators remain exempt. Caption/comment row
wrappers may carry `role=button` around a list item with an h1/h3 reading/author
heading. Only that structural row is exempted from the role-button exclusion;
nested action controls, native buttons, links, headers and timestamps remain
excluded. This uses the existing profile, mutation revalidation and text ledger,
including restoration when a row loses its heading structure. Selector changes
require native Chrome grammar checks alongside DOM-fixture tests.
Instagram uses the primary visual presentation owner
`text/textShufflePresentation.js` through the existing ownership ledger.
Connected ON/OFF/ON checks on 2026-10-13 reproduced React #418 only with shuffle;
load plus a 1000ms admission still reproduced it on a subsequent native reload.
Load does not prove that Instagram has hydrated every reading row. This owner
therefore never changes Instagram Text values or inserts/replaces its children.
It admits single-Text-node leaves and caption prefixes consisting only of native
Text/BR nodes followed by identity/tag links with whitespace-only separators.
One exact leading Text owner projects the prefix; links retain their native
boxes, source and destinations, with generated separator whitespace. It projects
deterministic shuffled content through CSS, preserving native source for hydration,
selection/copy and accessibility. Empty generated alternative text prevents a
second spoken copy. Prose interleaved after links and other mixed actions remain intact;
there is no mutation fallback for those runs. Latest host text remains canonical.
Owned pseudo-elements reset inherited host pseudo geometry before their content
and typography apply. Instagram's standalone detail renderer otherwise gives its
span ::after display:block and height:0, leaving the generated reading lines
outside the parent flow. A native comparison restored inline/auto geometry and
expanded a long comment's parent from 18px to 46px without changing native text.
The ledger indexes exact projected-node/parent ownership, releases old-parent
presentation on reparenting and restores only owned attributes/custom properties.
OFF removes the owned stylesheet after restoring the tracked set. It adds no
observer, timer, hydration introspection or document scanner; the existing bounded
queue remains the only content ingress. Other sites retain their native text
presentation. `textShufflePresentation.test.js`, `textShuffleSocialIdentity.test.js`
and the friction architecture guard protect this boundary.

Behavior signals are sidecar inputs, not policy truth:

```text
ProtectionController.startProtectionRuntimeSidecars()
  -> BehaviorHub
  -> BehaviorJudge / ScrollSignalTracker
  -> ProtectionSignalGate
  -> VisualEffectManager or effect-specific runtime
```

Debugging stays behind the shared runtime debugger shell:

```text
frictionDebug flag
  or dev debugConfig.runtimeDebuggerEnabled on a protected site
  -> ProtectionController runtime-debugger sidecar
  -> RuntimeDebuggerRuntime
  -> v2 baseline/delta session
  -> runtime contention / ObserverHub / social metrics / visual / text / short-form / video / feed-flow / self-tab Sentinel probes
```

## Canonical Owner Table

Instagram Home Short-form collapse leaves the native article/inline layout owner
in place. While this feature owns the Home surface, its stylesheet excludes only
direct article columns from native scroll anchoring (`overflow-anchor: none`),
so the host virtualizer alone owns feed offset correction. The route-scoped root
marker and style are released by the same manager on surface exit/disable;
other site surfaces and page scrollers retain their normal anchoring. This adds
no scroll writes, spacer edits or feed/network ownership. Target-outcome and
Runtime Debugger correlation use the current `collapse` mode.

| Concern | Canonical owner | Canonical path | Source of truth | Forbidden shortcut |
| --- | --- | --- | --- | --- |
| Native scroll write facts | Domain-neutral physical write boundary | `src/lib/dom/programmaticScrollWrites.js` | per-scroller all-write and adjustment-only revisions from `scrollInputOrchestrator` and `FeedEndpointBoundaryMotion`; explicit assistance/adjustment purposes | inferring user provenance from nearby gestures, consuming/expiring write facts, or treating a policy verdict as an observed write |
| Feature key catalog | protection feature catalog | `src/domains/protection/protocol/features/featureCatalog.js` | changed-key and compiled-feature key definitions | ad hoc string keys in feature dispatch logic |
| Post-commit settings propagation | settings propagation coordinator | `src/apps/background/services/runtime/support/BackgroundSettingsPropagationCoordinator.js` | ordered refresh/runtime-adapter/script-sync/broadcast stages after committed settings changes | feature code running its own post-commit retry loop |
| Managed content-script registration | content script registration sync | `src/domains/tracking/background/ManagedContentScriptSync.js`, `src/domains/tracking/background/ContentScriptOrchestrator.js` | host-scoped registered content scripts, prepaint CSS registrations, and catch-up tab injection plan | feature code directly registering or injecting content scripts |
| Content script session state | tab content session registry | `src/domains/tracking/background/TabContentSessionRegistry.js` | per-tab bootstrap/document readiness state and stale/failed waiters | trusting content bootstrap messages after navigation invalidation |
| Content runtime diagnostics snapshot | content runtime diagnostics store | `src/domains/tracking/background/ContentRuntimeDiagnostics.js`, `src/domains/tracking/background/ContentScriptOrchestrator.js` | bounded bootstrap/dispatch/sync diagnostic ledger plus session/sync snapshot | empty diagnostics snapshot when the store is missing |
| Policy evaluation | protection policy engine | `src/domains/protection/background/protocol/engine/ProtectionPolicyEvaluator.js`, `src/domains/protection/background/protocol/engine/ProtectionPolicyCompiler.js` | class/feature activation and compiled feature plan | content-side policy recomputation |
| Runtime envelope | protection envelope contract | `src/domains/protection/protocol/contracts/envelope.js` | snapshot/patch schema, catalog feature keys, revisions, compiled payload shapes | legacy monolith `filters` payload or uncataloged feature keys as truth |
| Dispatch targeting | protection dispatch planner | `src/domains/protection/background/protocol/dispatch/ProtectionDispatchPlanner.js` | full/domain/active/feature-targeted broadcast plan | feature code choosing tabs directly |
| Protection/nudge content mutation lane | protection dispatcher + serial queue | `src/domains/protection/background/ProtectionDispatcher.js`, `src/domains/protection/background/protocol/dispatch/ProtectionDispatchSerialQueue.js` | per-tab exact document/URL-bound protection/Gate transaction, awaited production `NUDGE_START`, and settings-disable update -> acknowledged `NUDGE_STOP` -> session terminalization | dashboard hook or settings message handler running a second fan-out, detached production START, or stop/terminalization after releasing the tab lane |
| Content activation | activation engine | `src/domains/protection/content/runtime/ProtectionActivationEngine.js` | envelope-only activation and fail-closed behavior | best-effort activation from legacy payloads |
| Envelope patch state | state applier | `src/domains/protection/content/ProtectionStateApplier.js` | current envelope revision and patch merge state | accepting stale/future patches silently |
| Content-local runtime friction modifiers | protection friction modifier runtime | `src/domains/protection/content/runtime/ProtectionFrictionModifierRuntime.js`, `src/domains/protection/runtime/frictionModifierResolver.js` | local runtime modifier intents and resolved filter snapshot before effect application | teaching individual effect managers about cross-feature runtime policy |
| Background/session friction modifiers | protection friction modifier session repository | `src/platform/storage/runtime/FrictionModifierSessionRepository.js`, `src/domains/protection/runtime/frictionModifierSessionState.js`, `src/domains/protection/background/TrackingProtectionService.js` | active scoped session modifier intents from `runtime.friction_modifiers` projected into envelope compilation; No active release writer is currently registered | writing session modifiers from feature code without declaring the release owner, trigger, dispatch/resync policy, and guardrail update in this boundary |
| Effect registry | protection registry | `src/domains/protection/content/ProtectionRegistry.js` | keyed/global effect ownership, compiled-plan-to-single-setting projection, and diagnostics wrapping | mounting managers directly from `ProtectionController` or sending a full compiled map through persisted settings normalization |
| Global visual filters | visual manager | `src/domains/nudge/visual/visualManager.js` | root/media/text visual CSS, media candidate/context selection, and observer lifecycle | per-effect duplicate style injection or broad container filters that double-apply media blur |
| Content target profiles | selector-free site identity + generic profile mechanics + owner-local declarations | `src/domains/nudge/targeting/siteIdentityCatalog.js`, `src/domains/nudge/targeting/contracts/targetProfileContracts.js`, `src/domains/nudge/behavior/behaviorTargetProfiles.js`, `src/domains/nudge/interaction/interactionTargetProfiles.js`, `src/domains/nudge/text/textTargetProfiles.js`, `src/domains/nudge/visual/mediaTargetProfiles.js`, `src/domains/nudge/visual/socialMetrics/adapters/socialMetricTargetProfiles.js`, `src/domains/nudge/feed-flow/registry/feedSurfaceProfiles.js` | one canonical site id, strict owner schema, explicit merge policy, immutable owner profile, generic defaults, and explicit domain exceptions; target meaning stays with the consuming owner | a cross-owner selector catalog, mutable raw declarations, unknown/dead fields, rebuilding profiles in hot paths, importing another owner's target meaning, or resolving host aliases independently per consumer |
| Content-free targeting health | cross-nudge contract plus owner projectors | `src/domains/nudge/core/targetingHealthContract.js`, `src/domains/nudge/visual/socialMetrics/core/targetingHealthProjector.js`, `src/domains/nudge/runtime-debugger/core/runtimeDebuggerShortFormTargetingHealth.js` | exact frozen vocabulary, fail-loud canonical snapshots, latest-operation Social evidence correlated to the current epoch/site/activation signature, operation-local conserved terminal-disposition scalars with exact target-bound reconciliation classification and zero unclassified reconciliation writes, and independent Short-form completeness projection | cumulative or older decisions or apply/cleanup cost phases as terminal authority; DOM/selector/text/path payloads; a new scanner; product/oracle classifier deduplication; persistence; profile mutation; or recovery authority in the shared contract |
| Selector attribute dependencies | generic DOM mechanical contract + owning observer-interest compiler | `src/lib/dom/selectorAttributeDependencies.js`, `src/domains/nudge/visual/socialMetrics/core/observerInterestPlan.js`, `src/domains/nudge/visual/socialMetrics/adapters/redditSemanticMutationAttributes.js` | validated lowercase selector attributes, adapter-declared semantic mutation attributes, owner attributes, exact scan-root signatures, and initial-scan-only high-churn classification | static observer filters that omit matcher dependencies, scan-root overrides hidden by stale signatures, or a shared primitive choosing owner failure/recovery policy |
| Text Rhythm profile and text mutation | settings profile + text pipeline | `src/domains/settings/config/textRhythmProfile.js`, `src/domains/nudge/textPipeline.js`, `src/domains/nudge/textShuffleManager.js`, `src/lib/textShuffle.js` | one compiled Text Rhythm profile owning spacing/opacity/blur on the canonical reading-layout target surface, a broader effect target surface reserved for separately activated text shadow, and one deterministic zero-to-five-word distance distribution that unifies fixed-word density and bounded sentence displacement without a sentence probability gate | applying Text Rhythm transition/filter/opacity selectors to the broader link/button/span effect surface, persisted physical child settings, separate probability/strength/strategy controls, unbounded displacement, or independent text mutation managers |
| Social metrics visuals | lazy social metrics composition root plus explicit runtime peers | `src/domains/nudge/visual/lazySocialMetricsManager.js`, `src/domains/nudge/visual/socialMetricsManager.js`, `src/domains/nudge/visual/socialMetrics/core/diagnosticsRuntimeBridge.js`, `src/domains/nudge/visual/socialMetrics/core/diagnosticsSnapshotRuntime.js`, `src/domains/nudge/visual/socialMetrics/core/ownedMutationRuntimeBridge.js`, `src/domains/nudge/visual/socialMetrics/core/scanRuntimeBridge.js`, `src/domains/nudge/visual/socialMetrics/adapters/redditShadowMetricsOwner.js` | social metric exposure/removal, shared top-document observation, independent closure-state peers behind frozen ports, bounded Reddit action-bar shadow ownership, and content-free health/debug projection | eager loading for inactive metrics, manager-bound mixins/private accessors, peer state mutation outside ports, duplicate overlays, generic shadow-tree observation, or unbounded per-card observers |
| Retained input delay implementation | isolated input delay manager, outside release feature registration/import closure | `src/domains/nudge/inputDelayManager.js` | standalone visual input snapshot delay and its focused tests; no production mount | release activation, delaying DOM values, or reading bypassed/sensitive surfaces |
| Input visual brake | input visual brake manager + private brush context | `src/domains/nudge/inputVisualBrakeManager.js`, `src/domains/nudge/input-visual-brake/InkBrushSession.js`, `src/domains/nudge/input-visual-brake/InkBrushCanvasRenderer.js`, `src/domains/nudge/input-visual-brake/inkBrushProfile.js` | binary activation plus one canonical profile, ephemeral caret measurement, geometry-only arc-length stroke, cadence pressure, join-zone rewetting, positional drying, and shared-edge Canvas ribbon rendering | reading sensitive surfaces, passing input values into the brush context, retaining mirrored text, DOM-stamp fallback, or putting input contents in diagnostics/messages/storage |
| Click pause | interaction manager | `src/domains/nudge/interactionManager.js`, `src/domains/nudge/interaction/clickTargetResolver.js` | `clickDelay`-owned short commit pause, synthetic replay, native/sensitive gesture bypass, and an independently releasable shared-listener lease | reading Enso readiness/config, changing reward-drift state, replaying native media controls, or owning the Enso presentation lifecycle |
| Enso intent gate | interaction manager + content-boundary contracts | `src/domains/nudge/interactionManager.js`, `src/domains/nudge/interaction/ClickBoundaryClassifier.js`, `src/domains/nudge/interaction/ensoGateReadiness.js`, `src/domains/nudge/interaction/EnsoGateGesture.js`, `src/domains/nudge/interaction/EnsoGateNavigation.js`, `src/domains/nudge/interaction/ensoGateSurface.js` | classified new-content clicks combine with the shared cadence receipt and exact admission lease; shared listener ownership, lateral distance/time qualification, retry and enter/leave semantics remain local | a click score or transition count changing the selected interval, a timer replaying a click, native/sensitive control interception, debug permission as production authority, or detaching another owner's listeners |
| Detour-spread Gate | Gate interstitial controller + Gate app | `src/domains/protection/background/GateInterstitialController.js`, `src/apps/gate/GateInterstitialApp.jsx` | foreground over-budget protected entry opens the same-tab top-level Gate; fresh global inventory, selected closure and exact-URL resume retain the shared admission/closure owners | opener notices/rails, content iframes, a group-specific budget, silent target replacement or synthetic external-close decisions/passes/receipts |
| Enso source and permit ownership | content-local source/permit owner | `src/domains/nudge/interaction/EnsoSpawnPolicy.js`, `src/domains/nudge/interaction/ensoSpawnSources.js` | independent click/feed activation leases, one exact reserved/attached/presented permit, and monotone actual presentation identity; default dev/public use the background admission client | source first-grace clocks, content-local cross-source cooldown, per-source repeat timestamps, admitting from a diagnostic cache, or counting endpoint attachment as presentation |
| Enso foreground cadence | background admission service + operational tracking bridge | `src/domains/protection/background/runtime/InterventionAdmissionService.js`, `src/domains/protection/background/runtime/ensoCadencePolicy.js`, `src/domains/tracking/background/trackingEnsoCadenceBridge.js`, `src/domains/nudge/runtime/interventionAdmissionClient.js` | one protected-site foreground interval across tabs, 8/12/20-minute presets from `src/domains/settings/config/ensoIntervalPolicy.js`, existing session checkpoint and exact-document receipt; no backlog or read-time accrual | a second clock/writer, deriving attention from speed or native idle, background audio duration as foreground time, synthesizing unknown gaps, or resetting the interval before actual automatic reflection end |
| Feed boundary observation and opportunity | factual state + boundary judge | `src/domains/nudge/feed-flow/session/FeedBoundaryState.js`, `src/domains/nudge/feed-flow/judge/FeedBoundaryJudge.js` | actual forward counts, content-local reference and current behavior; independent goal demand or periodic due receipt plus a new confirmed advance creates one opportunity, with 5-second freshness and current inhibitors | dose/pressure/tempo accumulation, forged Enso eligibility for a goal, supply-only advancement or candidate creation, stale behavior frozen into a candidate, or structural confidence interpreted as user attention |
| Historical consumption-pattern research | explicit offline evaluation workspace | `scripts/dev/enso-model-research/researchBoundaryContract.mjs`; retained `src/domains/nudge/attention/consumptionPatternClassifier.js` | archived pure pattern/weight hypothesis is reproducible through explicit research/test imports; no production consumer | a runtime import, automatic collection, hidden candidate weighting, or interpreting synthetic labels as measured user intent |
| Historical reward/feed evidence research | explicit offline evaluation workspace | `scripts/dev/enso-model-research/README.md`, `scripts/dev/enso-model-research/researchBoundaryContract.mjs`; retained attention modules under `src/domains/nudge/attention/` | earlier reward drift, bounded feed window and dopamine-binge fusion remain research-only; active source imports are rejected by `check:enso:research-boundary` | restoring background analysis under history permission, a second observation lifetime, or granting the old load/confidence outputs production admission authority |
| Historical reward rearm research | archived policy model | retained `src/domains/nudge/interaction/EnsoRewardRearmPolicy.js`; research boundary contract | former post-presentation score/rearm hypothesis is retained only for reproducible tests; current `ensoGateReadiness.js` reads the shared cadence | an active rearm score, threshold memory, per-source repeat timer, or a presentation path mutating research evidence |
| Page-media activity evidence | shared video observation owner + page-media activity observer | pure snapshot vocabulary `src/domains/nudge/media/pageMediaActivityContract.js`; runtime owners `src/domains/nudge/video/VideoElementObserver.js`, `src/domains/nudge/media/PageMediaActivityObserver.js`, `src/domains/nudge/media/pageMediaElements.js`, `src/domains/nudge/media/mediaConsumptionEvidence.js` | one shared mutation lifetime per document and its reachable author shadow roots, canonical live-video delivery, audio-only discovery, playback listener ownership, content-free activity snapshot, and short-lived media-consumption evidence; offline consumers may read the pure version contract without loading DOM observers | feature-local `MutationObserver` or polling, a second shadow observer, a parallel video scan, raw DOM/media retention in evidence, or treating activity evidence as presentation authority |
| Shared intervention admission | background browser-session service + pure kernel + typed session repository | `src/domains/protection/background/runtime/InterventionAdmissionService.js`, `src/domains/nudge/runtime/interventionAdmissionClient.js`, `src/domains/nudge/runtime/interventionAdmissionKernel.js`, `src/platform/storage/runtime/InterventionAdmissionRepository.js` | default dev/public discrete presentations share exact leases, ordinary non-preemption, isolation exception and 45-second post-end recovery | content-local cooldown authority, rank-based preemption, unbounded candidate queues or charging unshown reservations |
| Automatic Furin entry lifetime | screen capability/action evidence, shared boundary and protection receiver | `src/domains/nudge/runtime/furinEntryBoundary.js`, `src/domains/nudge/runtime/nudgeEntrySeamGate.js`, `src/domains/nudge/feed-flow/FeedBoundaryEpisodeCoordinator.js`, `src/domains/protection/content/ProtectionController.js` | supported feeds require Horizon encounter and fresh continuation even with Enso OFF; declared non-feed new-content click consumes an exact prepared permit; hidden/exit cancels exact work; accepted waiting is separate from final paint | broad click/key or generic pause/ended admission, timer/idle interruption, treating comment scroll as primary-media completion, unsafe-feed-to-action substitution, late replay, or treating acceptance/cancellation as presentation |
| Goal-bound Furin policy and cancellation | background dispatch/admission plus existing nudge session lane | `src/domains/nudge/runtime/goalEpisodeBinding.js`, `src/domains/protection/background/protocol/dispatch/ProtectionGoalEpisodeInvalidator.js`, `src/domains/nudge/runtime/session/nudgeSessionGoalCancellationState.js` | exact host/day/reset/targets/scopes/profile/tab/document identity; fresh privileged-transition policy checks; cancelling checkpoint before exact lease/document cleanup and terminalization | global revision as semantic policy, relabeling an existing owner, stale final callbacks, cleanup timeout treated as release, or new admission while cancellation remains owned |
| Goal delivery and readout | single typed daily writer plus passive host/day projection | `src/domains/nudge/runtime/session/furinDailyPolicy.js`, `src/domains/nudge/runtime/session/readFurinGoalEndState.js`, `src/domains/protection/runtime/goalEndSummary.js`, `src/domains/protection/contracts/goalEndSummaryContract.js` | V2 actual Site display and Site end, or actual combined Global and Site end, in one write; later Sites remain eligible/brief; Filter receives strict attainment/delivery/waiting DTO | fake Site display, Global covering future hosts/goals, session-shown conversion, UI-derived ratios, diagnostic-cache authority, or a read entering mutation/admission lanes |
| Feed observation lifetime | independent document producer | `src/domains/nudge/feed-flow/FeedObservationRuntime.js`; lazy history demand `src/domains/protection/content/runtime/feedObservationSidecar.js` | one FeedFlow/supply lifetime shared by permitted history and one shared boundary consumer; existing visible-document 250 ms beat samples for history, due periodic cadence, goal boundary demand, exposure or an explicitly open dev inspection; retryable cleanup and BFCache suspension | duplicate observers, a dev inspection changing production cadence, history enabling retired research, or an independent model timer/writer |
| Historical feed tempo research | explicit offline evaluation workspace | `scripts/dev/enso-model-research/README.md`; retained `FeedTempoEpisodeAssembler.js`, `FeedTempoProfileLearner.js`, `FeedTempoRuntime.js`, `FeedTempoPersistentProfileService.js`; typed `src/platform/storage/model/FeedTempoProfileCheckpointRepository.js` | archived episode/baseline algorithms and explicit injected-repository tests; existing historical checkpoints remain manageable, but production constructs no tempo service and registers no restore/commit route | runtime import or hydration, automatic history-triggered model writes, live research write fences, raw item identity/URL retention, or using an archived baseline for eligibility |
| Generic feed topology certification | content read-only probe/runtime plus background certificate owner | content `src/domains/nudge/feed-flow/topology/FeedLocalTopologyProbe.js`, `FeedTopologyCertificationRuntime.js`, `FeedTopologyPersistenceClient.js`; background `FeedTopologyPersistentCertificationService.js`, `src/apps/background/services/runtime/messageRoutes/feedTopologyCertificateMessageRoutes.js`; typed storage `src/platform/storage/model/FeedTopologyCertificateCheckpointContract.js`, `FeedTopologyCertificateCheckpointRepository.js` | class-independent direct-sibling structural descriptor, one corroboration/invalidation fact per document session, epoch-fenced multi-session/multi-day certificate with decay/TTL/fingerprint rotation, and fresh live-match evidence | DOM mutation outside the endpoint lease, raw DOM/text/path/selector/class persistence, content-side storage, server lookup, session-memory certificate fallback, one-session promotion, stale certificate use, treating shadow learning as actuation authority, or a second feed DOM writer |
| Scroll friction | pure frosted-stone dynamics + gesture-ownership kernels, then scroll orchestrator through interaction manager | `src/domains/nudge/behavior/frostedStoneDynamics.js`, `src/domains/nudge/behavior/scrollGestureOwnership.js`, `src/domains/nudge/behavior/scrollInputOrchestrator.js`, `src/domains/nudge/interactionManager.js`; preview consumer `src/apps/dashboard/tabs/filter/preview/ScrollDelayPreview.jsx` | binary activation of one canonical 1000ms `frosted_stone` light material; every normalized delta becomes a signed impulse; momentum and kinetic energy derive from one mass; Stribeck low-speed grip/high-speed glide, viscous drag, bounded energy, fixed substep time integration, natural opposing-input cancellation, one 140ms input-target lease, dominant-axis noise lock, independent per-surface motion bodies, nearest axis-capable surface ownership even at its boundary, boundary momentum dissipation without ancestor/root retargeting, context-only lease release, suspension-time dissipation without replay displacement, shared runtime/preview behavior, deferred managed-scroll verification, internal actuation state, and scroll-failure diagnostics | public strength levels, policy-driven retuning of the canonical delay, per-event target hopping within one gesture, ancestor/root momentum handoff, cross-surface momentum transfer or cancellation on focus/target change, global one-controller-per-axis ownership, frozen suspension momentum, cadence/distance clutch gates, direct-coupling travel, release timers, acceleration scores, special reverse gains, easing profiles, or separate scroll replay queues |
| Main-thread cooperative scheduling | platform scheduler seam plus protection, Visual/Text, and Social Metrics lifecycle owners | `src/platform/scheduling/mainThreadCooperativeScheduler.js`, `src/platform/scheduling/cooperativeMutationBatchQueue.js`, `src/domains/protection/content/ProtectionStateApplier.js`, `src/domains/protection/content/runtime/ProtectionFrictionModifierRuntime.js`, `src/domains/nudge/visual/visualManager.js`, `src/domains/nudge/visual/mediaFilterController.js`, `src/domains/nudge/textShuffleManager.js`, `src/domains/nudge/visual/socialMetrics/core/scanRuntimeBridge.js` | Chrome/Whale 129 fail-loud `scheduler.yield()` continuation, canonical 3ms slice deadline, owner-order preservation, exact activation/update/scan generations, and stale-continuation settlement | direct feature reads of `globalThis.scheduler`, timer/idle/microtask fallbacks, yielding inside scroll physics rAF, stale DOM writes, or treating one indivisible `querySelectorAll()` as sliced work |
| Video and short-form guards | video manager facade + shared video observation owner | `src/domains/nudge/video/index.js`, `src/domains/nudge/video/VideoManager.js`, `src/domains/nudge/video/VideoElementObserver.js`, `src/domains/nudge/video-skip/VideoSkipManager.js`, `src/domains/nudge/video-skip/videoSkipEventHandlers.js`, `src/domains/nudge/video-skip/videoSkipGestureContext.js`, `src/domains/nudge/video-skip/videoSkipListenerLedger.js`, `src/domains/nudge/video-skip/videoSkipMediaAdapter.js`, `src/domains/nudge/video-skip/videoSkipMainWorldActuator.js`, `src/domains/nudge/video-skip/VideoSkipMainWorldActuatorTransport.js`, `src/domains/nudge/video-skip/videoSkipRuntimeDiagnostics.js`, `src/domains/nudge/video-skip/videoSkipControlSurfaceCatalog.js`, `src/domains/nudge/video-skip/VideoSkipControlSurfaceRuntime.js`, `src/platform/storage/runtime/VideoSkipPoolRepository.js`, `src/platform/storage/runtime/VideoSkipPoolWriteTransport.js`, `src/platform/storage/runtime/VideoSkipPoolWriteCoordinator.js`, `src/apps/background/services/runtime/messageRoutes/videoSkipPoolMessageRoutes.js`, `src/domains/tracking/background/ContentScriptOrchestrator.js`, `src/domains/nudge/short-form/ShortFormBlockManager.js`, `src/domains/nudge/short-form/shortFormTargetOutcome.dev.js`, `src/domains/nudge/short-form/shortFormTargetOutcome.public.js` | one document/shadow video registry, feature-isolated facade lifecycle, port-scoped video event judgment, transactional listener ownership, one selected media actuator per command, sender-derived YouTube MAIN-world actuation, background-owned video-pool persistence, video skip seek transaction, media-gesture classification, owner-local platform control profiles, policy-synchronized non-destructive timeline locking for YouTube/X/Instagram/TikTok/Reddit including reachable author-shadow controls and explicitly declared native-player controls, runtime diagnostics projection, short-form lifecycle, and a build-selected exact owner-target outcome correlation seam | direct child-manager mounting from registry, per-consumer shadow observers, parallel whole-document video scans, content-context pool writes, caller-selected MAIN-world tab/frame/origin, YouTube-to-native actuation fallback, page-global relay APIs, generic unscoped slider interception, physically removing player-owned controls, unconditional closed-shadow, canvas, or child-frame control claims, or a helper retaining or mutating manager lifecycle ownership |
| Dev-only VideoSkip control-surface QA | named QA protocol + typed exact-tab bridge | `scripts/qa/protocols/videoSkipControlSurfaceQaProtocol.mjs`, `src/domains/nudge/video-skip/automation/videoSkipControlSurfaceQaContract.dev.js`, `src/apps/background/services/runtime/messageRoutes/videoSkipControlSurfaceQaMessageRoutes.dev.js`, `src/domains/protection/content/buildCapabilityContentRelay.dev.js` | trusted harness sender, stable exact web tab, content readiness, one QA session id, manager-owned runtime snapshot, trusted timeline input, and explicit STOP/teardown evidence | persisted settings/site-rule mutation, activating over a product-owned VideoSkip runtime, arbitrary tab/frame delivery, broad player discovery fallback, or inclusion in public builds |
| Media frame observation | top-frame registry reporter + iframe probe + tracking orchestrator | `src/apps/content/topFrameMediaDiagnosticsReporter.js`, `src/apps/content/mediaFrameProbe.js`, `src/domains/nudge/video/VideoElementObserver.js`, `src/domains/tracking/background/ContentScriptOrchestrator.js`, `src/domains/tracking/background/TabContentSessionRegistry.js` | top-frame canonical registry counts and iframe incremental counts keyed by tab/frame/document with an explicit observation mode | top-frame probe scans, treating observed iframe video presence as content effect activation, or treating frame observation as dispatch readiness |
| Enso Feed Horizon runtime config | versioned config seam | `src/domains/nudge/feed-flow/config/ensoFeedHorizonRuntimeConfig.js`, producer `src/domains/protection/background/runtime/EnvelopeAdapter.js` | exact `enso-feed-horizon-runtime-config-v4`: `contractVersion`, `intervalMs`, `sensing`, `inhibitors`; shared preset materialization with strict shape/version validation; `infiniteScrollGuard` remains the execution/diagnostic wire key | runtime level/dose/episode/seam tuning, flat persisted guard reads, implicit legacy translation, a second interval mapper, or a visual timeline controlling eligibility |
| Shared feed-horizon episode / native feed endpoint | shared episode coordinator + purpose-specific admission + topology and endpoint owners | `src/domains/nudge/feed-flow/FeedBoundaryEpisodeCoordinator.js`, periodic API `src/domains/nudge/interaction/EnsoRuntimeEpisodeManager.js`, `src/domains/nudge/interaction/EnsoFeedSurfaceEntryGrace.js`, `src/domains/nudge/interaction/ensoFeedEpisodeAdmission.js`, `src/domains/nudge/feed-flow/index.js`, `src/domains/nudge/feed-flow/judge/FeedBoundaryJudge.js`, `src/domains/nudge/feed-flow/learning/FeedStructureLearner.js`, `src/domains/nudge/feed-flow/actuation/FeedActuationSafetyJudge.js`, `src/domains/nudge/feed-flow/actuation/FeedEndpointBoundaryResolver.js`, `src/domains/nudge/feed-flow/terminus/FeedEndpointLease.js`, `src/domains/nudge/feed-flow/terminus/FeedTerminusController.js` | a fresh confirmed-advance opportunity, ready/safe capability and exact purpose lease must agree; periodic work also requires cadence and semantic-surface grace; goal demand works independently; attachment, actual encounter, fresh continuation and final Furin/Gate are distinct phases of one episode | a supply poll creating/reviving a candidate, goal demand forging cadence, expired reservation replay, attachment reported as exposure, prelude reported as final Furin, stillness opening a question, unsupported topology fallback, or parallel DOM/network actuation |
| FeedFlow validation diagnostics | FeedFlow dev-only ledger + real-site action-boundary oracle | `src/domains/nudge/feed-flow/diagnostics/FeedFlowDiagnosticLedger.js`, `src/domains/nudge/feed-flow/diagnostics/feedFlowDiagnosticState.js`, `scripts/e2e/sites/feedConsumptionValidation.mjs`, `scripts/e2e/sites/siteRuntimeBrowser.mjs` | bounded content-free intent/advance evidence, opaque dominant-scan trace, and scalar scan-cost counters from the product owner, independently matched to content-signature/active-media trusted-input opportunities by the diagnostic harness | product or browser-driving agent grading its own transitions, page-script scrolling as opportunity proof, raw text/URL/selector/DOM/item-key retention, oracle layout reads in release/control cost lanes, or counting `armed_idle` as a false negative |
| DOM observer hub | shared observer hub | `src/lib/dom/ObserverHub.js` | shared top-document mutation observer subscriptions, merged observe options, observer perf/failure snapshot | silent observer fallback, duplicate top-document observers, or top-frame shadow-root media probes outside `VideoElementObserver` |
| Behavior sidecar | behavior hub | `src/domains/nudge/behavior/BehaviorHub.js` | always-on local behavior signals plus precision/CLSE-demand-owned mutation reporting and signal subscriptions | treating behavior signals as compiled feature truth or retaining a mutation/feed scan without a CLSE reporter consumer |
| Signal cleanup | protection signal gate | `src/domains/protection/content/runtime/ProtectionSignalGate.js`, `src/domains/protection/content/runtime/protectionSignalGateKeys.js` | in-flight signal cleanup callbacks | manager-local signal flags without centralized cleanup |
| Runtime diagnostics | protection diagnostics | `src/domains/protection/content/runtime/protectionRuntimeDiagnostics.js` | feature mount/unmount/error event ledger | silent effect failures |
| Runtime debugger | runtime debugger shell + v2 session/probe catalog | `src/domains/nudge/runtime-debugger/RuntimeDebuggerRuntime.js`, `src/domains/nudge/runtime-debugger/RuntimeDebuggerShortFormOracle.js`, `src/domains/nudge/runtime-debugger/contention/runtimeContentionLedger.dev.js`, `src/domains/nudge/runtime-debugger/contention/runtimeContentionLedger.public.js`, `src/domains/nudge/runtime-debugger/discovery/runtimeDiscoveryLedger.dev.js`, `src/domains/nudge/runtime-debugger/discovery/runtimeDiscoveryLedger.public.js`, `src/domains/nudge/runtime-debugger/RuntimeDebuggerOverlay.js`, `src/domains/nudge/runtime-debugger/RuntimeDebuggerOverlayStyle.js`, `src/domains/nudge/runtime-debugger/RuntimeDebuggerMeasurementGuide.js`, `src/domains/nudge/runtime-debugger/RuntimeDebuggerEffectProbe.js`, `src/domains/nudge/runtime-debugger/RuntimeDebuggerProbeCatalog.js`, `src/domains/nudge/runtime-debugger/core/**` | one baseline/latest/delta session, bounded operation events, explicit probe validity, dev-only conditional opportunity/effect proof, item/full export reports, a dev-only monotonic contention timeline for physics-scroll frames, producer-owned work spans and browser long tasks with separately measured instrumentation overhead and a public no-op alias, a typed bounded-window union plus bounded scalar owner/subscriber span timeline with no extra DOM read, zero-extra-read candidate-strategy projections, bounded cross-owner shared-flush co-activity evidence, dev-only session-scoped WeakMap identity proof for roots/candidates/effect targets already held by existing owners with a public no-op alias, one strict per-tab measurement guide, and one Shadow DOM presentation surface with private Zen-default override tokens | new floating debug overlays, a second raw MutationObserver/store/report owner, debugger-owned DOM traversal, retaining DOM nodes in reports, labeling same-frame or style/layout-phase temporal overlap as causal proof, calling renderer residual page-owned cost, sampling only aggregate owner totals without the scroll-frame time axis, treating shared-flush or exact-node overlap as redundant work without matching purpose/output proof, comparing owner-specific aggregate root/candidate units as equivalent, producer counter resets on session start, cumulative-last-snapshot summaries, inactive zeroes presented as efficiency, generic page-theme token inheritance, or expensive backdrop compositing inside the measurement surface |
| Content teardown | bootstrap controller and runtime modifier cleanup | `src/apps/content/bootstrapController.js`, `src/domains/protection/content/runtime/ProtectionFrictionModifierRuntime.js`, `src/domains/protection/content/ProtectionRegistry.js` | runtime effects clear once through the registry; protection sidecars own indicator teardown | second cleanup facade, duplicate direct manager cleanup, or relying on navigation/page unload as cleanup |

## Function Ledger

| Boundary function | Input | Output | Failure policy |
| --- | --- | --- | --- |
| `createBackgroundSettingsPropagationCoordinator().schedulePostCommitEffects` | committed changed keys and requested post-commit stages | merged ordered propagation task with bounded retry | enabled stages require a handler; retry resumes from the failed stage unless new work resets the start stage |
| `createManagedContentScriptSync().syncManagedContentScripts` | settings cache, explicit permission-owner snapshots, script file manifests, prepaint plan | registered domains, missing domains, matches, prepaint plan, catch-up tab plan | false scripting permission is a normal missing-permission result; missing or malformed permission-owner output throws before registration planning; absent script ids may be reconciled by register and other apply failures throw so propagation can retry |
| `createContentScriptOrchestrator().syncManagedContentScripts` | managed sync snapshot and tracked tab sessions | catch-up injection, last sync snapshot, stale session reconciliation | catch-up injection failures reject and keep failed tab targets pending for the next sync |
| `createContentScriptOrchestrator().getDiagnosticsSnapshot` | trusted debug request tab scope and limit | content runtime diagnostic events, current sessions, and last sync snapshot | diagnostics store is required; missing store throws `CONTENT_RUNTIME_DIAGNOSTICS_REQUIRED` instead of returning an empty snapshot |
| `createContentScriptOrchestrator().executeVideoSkipMainWorldCommand` | trusted top-frame content sender-derived tab/frame/page URL plus typed seek/play command | bounded `youtube_player` actuation result from one exact MAIN-world frame | only HTTPS YouTube origins are admitted; the injected executor rechecks the exact hostname after navigation, unavailable player methods reject, and arbitrary functions or caller-selected targets are not accepted |
| `createTabContentSessionRegistry().noteBootstrapState` / `waitForDispatchReady` | content bootstrap status, document id, tab navigation, timeout | dispatch-ready session state or closed wait result | unsupported statuses are ignored; stale/failed/non-positive waits close false; late phase regressions do not downgrade ready sessions |
| `createProtectionDispatchPlanner().finalizePlan` | changed keys, tabs, settings cache | broadcast mode and message targets | known non-content changed keys target no content tabs; unknown changed keys fail closed to full broadcast with reason |
| `ProtectionDispatcher.broadcastSettingsUpdate` nudge-stop reconciliation | committed `nudgeConfig` change and canonical settings cache | one queued per-target protection update plus exact-document `NUDGE_STOP` ACK and canonical session terminalization when disabled | missing or negative update/stop acknowledgement fails the target summary so the durable settings coordinator retries the broadcast stage; the lane is not released between update, stop, and terminalization |
| `createEnvelopeAdapter().buildEnvelopeInput` / `ProtectionPolicyCompiler.compilePolicy` | resolved filters, activation map, feature catalog | activation/compiled feature maps and stable feature hashes | activation and compiled maps must share the content runtime feature catalog; dormant/extension-context settings such as `audioDulling` must not enter content envelopes; nested object key order must not churn feature hashes |
| `buildProtectionEnvelope` / patch delta | previous envelope state, next decision, feature hashes and payload maps | snapshot or patch envelope with activation/compiled upserts/removes | patch key discovery must include activation/compiled payload keys, not only hashes; missing hashes must not hide changed or removed features; stable payload comparison prevents object-order patch churn |
| `createRuntimeSnapshotBuilder().build` | resolved full envelope state plus snapshot/patch wire envelope and dispatch context | effective runtime plan and dispatch decision paired with the exact wire envelope | validate the wire envelope through the canonical snapshot/patch contract; derive `shouldApply` from full `envelopeResult.state.activation`, never from snapshot-only fields absent on a valid patch |
| `resolveActivationPlan` | `PROTECTION_UPDATE` message | activation plan with filters | envelope is required; invalid envelope keys/payloads request resync before mutation; empty compiled maps fail closed; invalid/future patch requests resync and does not mutate |
| `deriveProtectionActivationState` / `buildFiltersToApply` / `buildActiveFilterContext` | envelope snapshot/patch, compiled feature truth, activation map | current content envelope state, activation-gated filters, and active-filter context token | stale patches are ignored; future/missing-base patches request resync; compiled `isActive` cannot activate a feature without matching activation truth; uncataloged or malformed compiled entries throw instead of becoming runtime configs; malformed active-filter context inputs throw instead of becoming an empty context |
| `ProtectionFrictionModifierRuntime.applyProtectionRuntimeEffectsCooperatively` / `applyProtectionRuntimeEffects` / `clearProtectionRuntimeEffects` | compiled background filters and fullscreenPolicy, independent fullscreen preference, fullscreen-video events, effect owners | one fullscreen projection passed to registry effect owners | full activation awaits its cooperative epoch; clear/new apply invalidates stale continuations; fullscreen consumes the background policy without interpreting schedule/goal sources or adding modifiers; duplicate events do not reapply; clear tears down listeners before effects |
| `resolveFrictionModifiedFilters` | normalized filter entries plus scoped modifier intents | materialized level bands and Text Rhythm profile bands | only adjustable filters accept intensity modifiers; repeated directions saturate at one band, opposite directions resolve by priority, suspension deactivates before materialization, and inactive user entries never become active |
| `FrictionModifierSessionRepository` / `frictionModifierSessionState` | `runtime.friction_modifiers`, scoped runtime modifier intents, current hostname projection | active domain/global modifier list for envelope compilation | session state stores modifier intents rather than per-domain filter levels/profiles; expired modifiers are pruned during normalization; domain modifiers only project onto matching hostnames and opposite-direction intensity conflicts resolve by modifier priority; release code must not call session writer methods until an active writer owner and dispatch/resync trigger are declared here |
| `applyProtectionEffectsCooperatively` / `applyProtectionEffects` | compiled filters, registry arrays, exact activation epoch | ordered manager update/mount/unmount calls and cooperative settlement | the full activation path preserves global-then-keyed owner order and yields between owners; stale epochs stop before the next owner; scheduler contract errors reject instead of becoming a false-success activation; ordinary effect exceptions remain logged and isolated; the synchronous path remains for early bootstrap |
| `createDiagnosticKeyedEffect` | feature key, mount, unmount | deduped diagnostic keyed effect | successful mount/unmount diagnostics are recorded only after the owner step succeeds; mount/unmount failures restore the previous signature, record protection diagnostics, and rethrow to caller warning boundary |
| `applyProtectionEffects` global effects | global filter snapshot, context, effect owners | visual/text/social owner updates | registry projects social metrics through `projectCompiledRuntimeSocialMetricsSetting()`; sync throws and async rejections warn with the owning global effect label instead of becoming an unlabeled lazy-manager miss |
| `clearAllProtectionEffects` | teardown/clear trigger | keyed/global effect cleanup and non-debug nudge stop | cleanup failures warn by keyed effect or global owner label, then continue clearing the rest |
| `ObserverHub.subscribe` / `_flush` | subscriber callback and observe options | active shared `MutationObserver`, subscriber-projected mutation payload, removed-node delivery, debug snapshot, and dev-only contention flush/subscriber spans | observe failures roll back the subscription and throw; canonical option plans share one single-pass payload projection, enqueue-time mutation-kind masks prevent a second flush-wide kind scan, aggregate debug payloads are built only while measured, and kind-disjoint plans do not scan the batch; measured snapshots separate subscriber callback work from debug bookkeeping/snapshot-read overhead and expose queue wait, flush shape, and attribute-name counts; the contention span reuses those already-held scalar timings and performs no DOM read; Visual/Text subscribers synchronously retain only dedupable payload identity and return, while their DOM traversal/write work belongs to the platform cooperative queue; each subscriber receives only its requested subtree scope, mutation kinds, and attributes; final unsubscribe cancels pending frame/watchdog work and releases queued mutation nodes; callback failures record `ObserverHub` runtime failures while remaining subscribers continue |
| `VideoElementObserver.subscribe` / `subscribeMediaMutations` / `getLiveVideos` / `reconcileExistingVideos` | document mutations plus reachable author shadow roots | one live-video registry with per-subscriber replay and added/removed delivery, plus the same owner-projected mutation stream for page-media consumers | document-tree observation uses one `ObserverHub` lease; connected ancestor/descendant additions collapse to one scan, each added light/shadow subtree discovers videos and reachable author shadow hosts in one descendant traversal, removals reconcile the live registry without rescanning detached subtrees, and initial video/shadow discovery follows the same traversal contract; each reachable author shadow root has one shared local observer; media-mutation subscribers receive the owner-projected added/removed nodes and already-discovered videos without opening another observer or rescanning video descendants; a failed video delivery retries only the exact consumer/video pair on a bounded schedule; unsubscribe/removal cancels pending retries; disconnected videos and shadow hosts release strong ownership |
| `PageMediaActivityObserver.subscribe` / `reconcile` | owner-projected media mutations, live videos, audio-only discovery, and local playback events | versioned content-free playing/audible counts, active-since time, and subscriber-multiplexed snapshot | the first subscriber acquires one `VideoElementObserver.subscribeMediaMutations` lease and the last releases it; video discovery remains with `VideoElementObserver`; activity state owns no polling or direct document/shadow observer; invalid owner contracts and teardown failures throw |
| `projectPageMediaConsumptionEvidence` / `evaluateSuikinkutsuInterventionCandidate` | strict page-media snapshot, evaluation time, and Suikinkutsu reveal delay | expiring media evidence followed by either an explicit ineligible reason or one immutable Suikinkutsu candidate | unknown versions/sources, future timestamps, and invalid counts fail loudly; the projector retains no DOM/media identity; the candidate policy has no admission or presentation authority |
| Historical `classifyInterventionConsumptionPattern` research | explicitly supplied archived reward/feed/media evidence and evaluation time | reproducible pure pattern and weight projection | research/test only; production imports are forbidden and no live classifier or candidate weight is registered |
| `reduceInterventionAdmission` | immutable admission state and one typed candidate/lifecycle event | immutable next state, explicit decisions, and at most one reserved winner lease | stale candidates are swallowed; blocked context swallows; active leases defer without queuing; a global gap defers only candidates that can survive it and swallows candidates that expire first; deterministic priority/weight/time/kind ordering selects one winner; only `presented` then `released` commits cooldown; duplicate request ids, unsupported concurrency contracts, mismatched leases, and malformed inputs throw |
| Historical `InterventionAdmissionShadow.observe` research | explicitly supplied candidate/admission decisions and synthetic epoch | archived counterfactual winner/agreement projection | the former local admission runtime is isolated from production; no live 160 ms shadow, ranking, timer, storage or page-global authority |
| `interventionAdmissionRuntime.dev` consumption projection / `InterventionAdmissionArbiter.request` / lifecycle | laboratory fixture only (no production consumers), latest validated binge/media evidence, one immutable candidate or exact lease, and local clock | current non-persistent consumption profile, profile-weighted candidate, one content-local dev admission state, and subscriber notification on actual state transitions | evidence retention is bounded by classifier freshness; artifacts cannot assign another artifact's weight; rejected requests do not mutate admission state; exact lease identity and phase are required; no candidate queue is retained |
| `createTrackingEnsoCadenceBridge.capture` / `settle` / `refresh` / `observeBatch` | existing foreground-affecting browser ingress and minute inventory, exact receipt revision and current protected scope | bounded operational foreground interval and current point delivered to the admission lane | no new listener, timer, tab query or historical writer; stale async receipts are fenced, navigation identity must agree, and missing focus/scope cannot be guessed |
| `InterventionAdmissionService.captureEnsoCadenceBoundary` / `settleEnsoCadenceBoundary` / `observeEnsoCadence` | fenced operational receipts, interval preset, current ownership and session checkpoint | one saturated foreground counter and exact-document cadence projection | reads do not accrue; unknown gaps are not bridged; actual automatic reflection end resets cadence, while unshown failure/manual QA preserve it; restart never reconstructs an unknown live anchor |
| `interventionAdmissionClient.getEnsoCadence` / `refreshEnsoCadence` | exact-document push/read and revision | latest validated receipt or explicit unavailable state | no local duration extrapolation or second storage writer; stale receipt cannot grant eligibility and replacement-document callbacks cannot restore it |
| `EnsoSpawnPolicy.reserve` / `commit` / `release` shared-admission bridge | current Enso source decision and canonical content admission client | local source permit plus exact browser-session lease, or explicit rejection | default dev/public both require admission; grant receipt alone never presents; a fresh eligible input consumes the short reservation; commit follows actual view creation and release follows cleanup |
| `VideoManager.setVideoSkipEnabled` / `setShortFormBlockEnabled` / `remove` | keyed protection lifecycle calls | feature-isolated child-manager transitions or explicit whole-facade cleanup | changing short-form state cannot reapply video skip, changing video skip cannot restart short-form, and whole-facade cleanup attempts both owners before reporting aggregate failure |
| `noteContentMediaFrameState` / `noteMediaFrameState` | trusted top-registry or iframe-probe report plus sender frame identity | frame-aware diagnostic session state with canonical top/frame identity and explicit observation mode | sender frame `0` accepts only `top_frame_canonical`; child frames accept only `frame_probe_incremental`; records observation only and iframe enforcement requires a separate explicit dispatch/control contract |
| `BehaviorHub.init` / `teardown` / `_emit` | base DOM listeners, scroll observer, precision/CLSE mutation demand, behavior subscribers | initialized behavior sidecar and gated behavior signals | base listeners and wheel tracking do not depend on telemetry; the shared mutation lease/feed seed exists only while precision telemetry and the CLSE reporter's collection flag are both active; init/enable failures roll back partial ownership; mutation unsubscribe failures retain the handle for bounded retry while selector callbacks remain disabled; subscriber failures record `behaviorHub` diagnostics without blocking later subscribers; feed-item selector failures skip that sensing pass without becoming feature truth |
| `InputDelayManager.createInputSnapshot` | supported text input event | overlay-only value/selection visual snapshot | bypass/contenteditable/password surfaces are rejected before snapshot; selection/style/cleanup failures record `inputDelay` errors |
| `InputDelayManager.apply` / `remove` | compiled input-delay value, document/window listeners, root marker, tracked overlays | active input-delay listener and overlay ownership | apply/remove events are emitted only after listener/root ownership transitions succeed; failed remove attempts keep the manager retryable |
| `InputVisualBrakeManager.resolveBrushPoint` | supported input caret/style/scroll metadata plus one ephemeral local value read for the rendered input point | measured caret-relative geometry only | password/email/tel/OTP/username/payment-like surfaces stay abstract; mirror create/value-read/measurement failures record `inputVisualBrake` errors and use the diagnosed estimate path for that focused surface |
| `observeInkBrushInput` / `commitInkBrushPoint` / `advanceInkBrushSession` | canonical brush profile, input timing/type, caret geometry, frame time | immediate input admission, bounded-lag arc-length samples, cadence-derived pressure, feathered join-zone rewetting, drying-stroke revival, lift, and positional drying frames | the feature is binary and has no strength level; deletion/history lift without geometry reads; line breaks lift before a next-line stroke; IME composition suspends auto-lift and commits one final caret point; pause lifts deterministically; only the most recent nearby drying stroke can revive within the profile window; old samples compact without discarding the stroke origin; the session never accepts text content |
| `createInkBrushCanvasRenderer` / `renderInkBrushFrame` | geometry-only brush frame and local Canvas owner | one shared-edge variable-width ribbon, continuous deterministic bristle paths, local pressure bloom, and tail-first per-sample drying | context creation/resize/frame failures record `inputVisualBrake` diagnostics; there is no DOM-stamp, per-sample rounded stamp, or cross-renderer fallback |
| `InputVisualBrakeManager.apply` / `remove` | compiled binary input-visual-brake activation, document/window listeners, root marker, caret-measured Canvas overlays | active input-visual-brake listener, canonical brush session, renderer, and overlay ownership | obsolete level-shaped entries are rejected at settings normalization and never enter content runtime; apply/remove events are emitted only after listener/root ownership transitions succeed; failed remove attempts keep the manager retryable |
| `InteractionManager.applyClickDelay` / `removeClickDelay` | compiled `clickDelay` distribution, neutral shared listeners, `data-click-delay-active`, pending click state | independent click-pause listener lease and commit-pause/replay runtime | it never reads Enso readiness/config or clears Enso evidence/presentation; removing it preserves a live `ensoGate` or feed lease |
| `InteractionManager.applyEnsoGate` / `removeEnsoGate` | compiled `ensoGate` activation, neutral shared listeners, root marker, shared cadence receipt and presentation state | independent click-intent source lease and new-content boundary admission | it does not require `clickDelay`; removal retains click-pause/feed ownership and does not start, erase or rearm a reward model |
| `EnsoSpawnPolicy.configure` / `evaluate` / `reserve` / `attachEndpoint` / `commit` / `release` | named click/feed source, exact local permit and shared browser-session transport | independent source activation with one reserved/attached/presented episode | no source first-grace/cooldown clock; attachment requires an owned cleanup callback and is not presentation; click view creation or actual Horizon encounter commits once; abort before presentation preserves global time; exact cleanup releases the lease |
| `EnsoFeedSurfaceEntryGrace.observe` / `evaluate` / `reset` | canonical item-independent `semanticSurfaceId` and current content-local time | feed-only 2-minute surface-entry grace and remaining-time diagnostic | same-family item routes preserve entry time, real family change resets it, and missing/conflicting IDs fail; it cannot gate click-intent, rewrite cadence or restore a source cooldown |
| `interactionManager.replayClick` | delayed click or Enso enter plan | explicit synthetic click replay outcome | failed replay records `click_replay_failed`/feature error; replay never updates an Enso score or cadence counter |
| Historical `advanceRewardDriftEvidence` / `projectRewardDriftEvidence` research | explicit transition fixtures, evaluation time and archived tuning | reproducible bounded decaying reward hypothesis | research/test imports only; no active transition observer, per-click projection or presentation rearm owner |
| Historical `FeedBingeObservationWindow.recordAdvance` / `projectFeedFlowBingeEvidence` research | explicit advance/supply replay and archived window configuration | reproducible feed load/confidence hypothesis | no production window or supply-poll projection; the current factual boundary state cannot import this owner |
| Historical `resolveDopamineBingeDetection` research | explicit reward/feed snapshots | reproducible bounded fusion hypothesis | not a production candidate source; synthetic results do not measure attention, addiction or user intent |
| `resolveEnsoFeedEpisodeAdmission` | current shared cadence receipt, fresh feed opportunity, readiness/safety/capability, semantic-entry grace and source/permit decision | immutable admitted/withheld/pending local result identifying the blocked stage | production requires due cadence and all local contracts; manual inspection bypasses waiting only, not ownership/safety; reservation/surface failure cannot retain a successful local verdict |
| `InteractionManager.acquireInteractionListenerLease` / `releaseInteractionListenerLease` | named click-pause, Enso click-intent, feed-episode, or debug owner | one neutral shared document-listener lifecycle | attach happens for the first owner and detach for the last; the transport carries no feature policy, and releasing one owner cannot clear another owner's listeners or active state |
| `InteractionManager.requestEnsoGate` | admitted `feed_horizon` token, connected Terminus anchor, outcome callback, held feed listener lease, committed feed-horizon permit | production Enso gate with no click replay and one exactly-once enter/leave/neutral/suppressed outcome | renewed demand is required; timer/debug APIs and uncommitted/foreign permits cannot spawn it; a missing lease/admission/anchor fails closed; higher ritual suppression settles through the same outcome callback |
| `finishEnsoGateGesture` / `rearmEnsoGateGesture` | lateral point, elapsed time, release/cancel reason and exact retained surface/permit | enter, leave, neutral cancellation or in-place retry | current release direction chooses the outcome; no circle, paused ink, second confirmation or click-through; short/vertical attempts retry; cancellation does not replay or navigate |
| `InteractionManager.applyScroll` / `removeScroll` | compiled canonical 1000ms binary scroll-friction value | scroll manager ownership, the `frosted_stone` light-stage config, and canonical `data-scroll-friction-active` runtime state | the settings boundary rejects noncanonical values and level-shaped entries; schedule and protection intensity modifiers may suspend the feature but cannot retune its strength; malformed compiled values fail before touching the orchestrator; root state and delay configuration roll back together, and apply/remove events are emitted only after config/cleanup succeeds |
| `applyFrostedStoneImpulse` / `advanceFrostedStoneMotion` / `dissipateFrostedStoneMotion` | normalized signed deltas, current momentum, elapsed time, and canonical material constants | energy-capped signed momentum, visible frame displacement from bounded 240Hz substeps, or elapsed-time friction with no replay displacement | invalid state/material/time fails explicitly; opposing input is ordinary impulse subtraction; a frame gap spends excess elapsed time on dissipation before integrating at most one visible frame, so resume cannot freeze momentum or create a catch-up jump |
| `resolveScrollGestureInput` / `isScrollGestureAxisLeaseActive` | normalized wheel deltas, gesture time, and current axis leases | dominant-axis-filtered impulse deltas plus one bounded target lease per axis | a lease expires after 140ms; a deliberate orthogonal input may switch the lock; invalid policy/state/time fails explicitly instead of retaining ambiguous ownership |
| `allowsScrollBoundaryHandoff` | computed axis-specific `overscroll-behavior` in non-inertial native-chain bridge paths | whether resistance/forward-boundary target discovery may continue through a nested boundary | only `auto` chains; `contain` and `none` stop discovery; Frosted Stone wheel ownership never uses this helper to retarget momentum; unknown computed values fail explicitly instead of widening the boundary |
| `navigateAwayFromEnsoGate` | enso-gate leave decision | current-tab close or `about:blank` redirect result | background close and redirect step failures warn by phase; final failure returns `false` |
| `scrollInputOrchestrator._syncListening` | delay, observer, resistance, and exact forward-boundary ownership state | browser wheel/scroll/context listener state | listener attach/detach failures record `scrollFriction` errors; owner state rolls back and success events are emitted only after listener sync succeeds |
| `scrollInputOrchestrator._onWheel` / `createPagedScrollIntentActuator` / `setActuationLock` | normalized native wheel input, canonical feed-surface route, and current actuation ownership | one observer notification and, only when unlocked, continuous Frosted Stone shaping or one paged-surface snap | an actuation lock suppresses Entropy-owned scroll shaping but never censors the input-observation stream; continuous Frosted Stone input resolves the nearest axis-capable surface even when it is already at the boundary, consumes that input, and dissipates there instead of retargeting an ancestor/root surface; canonical `youtube:shorts` accumulates signed intent for 140 ms, then commits at most one viewport-aligned instant delta and absorbs input during its 360 ms commit lock without creating a physics rAF controller; dev contention evidence records `scrollPagedIntent` input/commit spans and requires zero physics frames on this surface, while continuous surfaces retain Frosted Stone frame evidence; route/lifecycle supersession cancels the delayed write; default-prevented or zero-delta input remains excluded, and locked input records `wheel_actuation_locked` diagnostics |
| `scrollInputOrchestrator._startMiddleAutoScroll` / `_stopMiddleAutoScroll` | middle-click autoscroll session and active mouse/key/blur listeners | active or stopped autoscroll session | active-listener attach failures fail closed; detach failures keep the session active and record `scrollFriction` diagnostics |
| `scrollInputOrchestrator._applyManagedDelta` | physics-motion/middle-autoscroll target and delta | instant applied scroll delta, next-frame verification, and controller continuity | CSS smooth behavior cannot add a second easing owner; underread is judged from the next position sample; programmatic scroll application failure records `scrollFriction` error and stops the failing controller; severe under-application on a still-scrollable target records `managed_scroll_underread_bypass` and temporarily lets native/site wheel handling proceed |
| `VideoSkipManager.apply` / `remove` | compiled video-skip policy, storage pool, shared video registry, transactional listener ledger, and DOM listeners | active video-skip manager ownership and feature gate | existing and late videos reach the manager only through shared-observer replay/delivery; manager apply/reapply reads the registry snapshot for diagnostics but never starts a parallel whole-document reconcile or delayed rescan; each exact tracked player eagerly admits its current timeline and owns one bounded child-list observer for late control hydration, so cursor/pointer projection exists before the first seek input without a document-wide mutation scan; listener attach commits only after every binding succeeds, while the default profile owns only behavior-critical runtime/target listeners and the dedicated page-local Video Skip debug flag opts into detailed media-event listeners; failed cleanup or final storage flush deactivates the gate and retains exact retry ownership, while apply fails with `VIDEO_SKIP_CLEANUP_RETRY_REQUIRED`; `manager_remove` waits for a successful final flush; Instagram generic range controls require explicit progress/seek/scrub semantics or a wide horizontal range geometry inside the tracked player or geometry-bounded Reels media envelope before the control-surface owner marks or intercepts them, so localized square volume sliders remain outside the timeline lock |
| `createVideoSkipEventHandlers` | manager-owned live video state plus a fail-loud capability port | exact behavior/diagnostic handler table and per-event seek/telemetry judgment | does not install listeners, retain state, own gate/storage/adapters/timers, or commit attach/detach lifecycle; manager capabilities are resolved dynamically when each event runs |
| `VideoSkipManager._blockForwardSeek` / `_revert` | user forward seek, policy mode, current video state, one command-scoped media adapter | revert window, adapter-owned seek/play, bounded loader recovery, indicator update, and stable-time reset | native and YouTube commands select exactly one actuator; unavailable YouTube player APIs fail loudly without native fallback; an unexecuted, rejected, or unverifiable seek aborts the transaction and cannot emit `revert_completed`; loader recovery reuses one resolution for its seek/play pair |
| `VideoSkipPoolRepository.persist` / `teardown` | content-local cooldown projection, typed read subscription, and background write transport | ordered merge commands, committed V1 snapshot projection, and observable `storage_persist` failure | content contexts never call the pool store writer; queued commands serialize the live pool at execution time, retain retry ownership on rejection, and apply the coordinator-returned canonical snapshot; a write rejected because the extension context is gone ends the repository instead of retrying — it detaches its page listeners so an orphaned content script cannot schedule another write |
| `VideoSkipPoolWriteCoordinator.merge` | trusted content merge command and canonical session pool store | single background write queue and monotonic `max(cooldownUntil)` checkpoint | every command reads the canonical checkpoint inside the background queue before deciding whether to write; shorter/equal candidates cannot rewrite storage, so concurrent pagehide/teardown cannot regress the deadline |
| `ShortFormBlockManager.apply` / `remove` | URL listeners, URL poller, shared observer, resolver-produced action intents, notice/hidden-target cleanup | active short-form manager ownership and root marker state | `shortFormTargetResolver.js` and `platforms/**` read/classify DOM and return frozen intents without mutation; apply/remove events are emitted only after observer/listener/timer/root cleanup ownership transitions succeed; observer work drops detached nodes and collapses connected ancestor/descendant roots before resolution; failed remove attempts keep the manager retryable |
| `ShortFormBlockManager._pruneTargetsInRoot` / `_removeTarget` | host rule, selectors, platform artifacts, prune target | redirect, hide, measurable feed-slot collapse, remove, or recycled-card restore result plus product diagnostics | selector/closest/query failures, redirect, and DOM mutation failures record `shortFormBlock` errors; selector failures fail closed before pruning; Facebook Reels recognition is anchored to same-host `/reel` or `/reels` routes and links, and uses reversible hide mode rather than volatile class or global label matching; Instagram Home promotes a Reel link only to an owning `article` that also contains video, then reversibly collapses the article and its direct content containers to a hidden, clipped 1px native feed slot, while navigation/profile entrypoints retain ordinary reversible collapse; TikTok redirects recommendation/following routes to `/explore`, keeps a deliberately selected `/@user/video/id` article, and reversibly hides only its later `recommend-list-item-container` siblings; this owner does not enable or configure Feed Flow; safety-aware YouTube grid, horizontal shelf, guide, channel, filter-chip, feed-card, and continuation artifacts are owned only by their dedicated classifiers instead of a duplicate generic selector pass; a YouTube Shorts filter chip is inferred from an exact Shorts semantic label inside a tab-role/tablist structure under a chip-cloud or search-header component, targets the structural chip owner without relying on volatile style classes, and is hidden reversibly; a YouTube horizontal shelf is eligible independent of its localized title only when it owns a horizontal list with a Shorts lockup and a resolved YouTube-host `/shorts/<media>` link, and it rejects the whole-shelf action when any `/watch`, `/live`, or `/clip` media link is present; generic `ytd-rich-item-renderer` cards are eligible only on an explicit channel Shorts route, while the allowlisted media wrappers require the same Shorts media evidence and standard-media rejection; child-list and `href` mutations promote to and coalesce by the owning wrapper, tab, or horizontal shelf; eligible wrappers and horizontal shelves are hidden reversibly, and an owner that is recycled into non-Shorts media has its marker restored with a `restored` counter and `target_reconciled_visible` event; `target_pruned` is emitted only after successful hide/remove/collapse |
| `SocialMetricsManager.update` / `remove` | compiled-plan-projected canonical social metrics setting, shared observer, scan queue, cleanup helpers, host-owned metric roots, and the platform cooperative scheduler | active social metrics markers and observer ownership | runtime state resolves only the single setting; scan state is `queued -> collecting -> applying -> terminal_cleanup -> settled`; root selector queries, 64-node candidate filters, YouTube semantic scope cursor steps, union materialization, and candidate discovery/provenance batches yield only at exact generation-checked 3 ms boundaries while each browser selector query remains atomic; semantic adapters expose only `scopes + createScopeCursor(scope)`, the runtime requeues one `cursor.next()` result per `semantic_query` unit, and YouTube preserves facet/candidate order while batching watch links and text candidates by eight; its synchronous collector drains the same cursor; selector-first semantic-union order and exact node identity are preserved; configuration updates await settlement and roll back on asynchronous collection failure, while mutation failures stay diagnosed and isolated; `ObserverHub` remains the only top-document observer while Reddit feedback counts may lease at most 24 `shreddit-post` open shadow roots, coalesce each root's hydration work, and own the matching shadow style/marker cleanup; capped semantic mutation discovery resolves local owners before broad descendant discovery within the declared cap, and selector-specific ancestry caches dedupe nested sources without letting an ancestor batch consume the cap ahead of its causal target; timeout-forced candidate apply work retains the 3 ms idle slice, coalesces row/cluster cleanup across fast slices, and schedules cleanup at a 48 ms threshold plus terminal/cancel/failure settlement; failed cleanup retains its exact operation closure for lifecycle retry instead of admitting a later scan over unresolved ownership; Reddit detail right-rail feedback hides the complete localized count row so labels, units, and the internal separator do not remain; X Today’s News is bounded to `news_sidebar_article_*` roots and only their text leaf spans, then projects the combined metadata so `timeSignals` removes both elapsed time and `Trending now`, `viewCounts` removes post volume, category context remains, and cleanup restores the exact original; TikTok semantic ownership is bounded to stable `data-e2e` surfaces and comment owners: it preserves action buttons/icons, removes Explore/profile/comment numbers, and hides the complete non-interactive thumbnail view indicator including its decorative play glyph; update failures roll back root marker/observer/scan state before rethrowing; candidate selector failures record the query phase instead of becoming empty scans; cleanup failures record `socialMetricsManager` diagnostics and keep the manager retryable |
| `FeedBoundaryEpisodeCoordinator.apply` / `remove` / `requestGoalEntry` / `cancelGoalEntry` / `getGoalEntrySnapshot` | independent periodic config or exact Site/Global goal demand, screen/surface evidence, producer consumer, Terminus and admission lease | one purpose-owned Horizon-to-Enso or Horizon-to-Furin episode, with separate reservation, attachment, encounter, final display and cleanup | goal demand never fakes cadence or enables disabled filters; fresh action required for final handoff; unsupported/mixed media waits; unshown failure preserves cadence; actual prelude alone gives recovery without Furin credit; incomplete cleanup remains retryable |
| `readFurinGoalEndState` / `buildGoalEndSummary` | passive typed daily and session reads, fresh assembled goal/day/recording facts and the binding owner's semantic signature | strict host/day Site/Global read DTO through the snapshot bridge to Filter status | no mutation lock, new storage/timer, read-time expiry, new admission or inferred display; durable actual receipt wins; unsupported/error metadata must match current semantic policy; cancellation evidence names exact cleanup without claiming delivery |
| `FeedInputCapture.start` / `stop` | browser input, visibility, wheel-orchestrator, and `ObserverHub` subscription | active feed-flow input capture listeners and activity classification | document-tree mutations must use `ObserverHub`; the capture consumes the hub's deduplicated added-node count without rewalking raw records, and route refresh occurs before document surfaces skip feed-item discovery; startup failures tear down partial listeners/subscriptions and rethrow; closest selector failures record `infiniteScrollGuard` diagnostics; stop runs every teardown step before throwing `FEED_INPUT_CAPTURE_STOP_FAILED` |
| `FeedAdvanceCoordinator.handleIntent` / `handleMutation` / `handleActivity` / `_schedulePagedScan` / `_resolveDominantItem` | explicit user demand, native scroll motion, shared-observer mutation churn, media-play ownership, one settled paged-feed scan timer owner, and host-profile dominant candidates | one canonical outermost dominant identity, a non-emitting pre-gesture adapter baseline, and at most one confirmed paged advance per explicit gesture | surface start/reset and gesture-outside settled mutation/media-play observations synchronize the current dominant item without fabricating consumption, while initial churn cannot defer that baseline past 320 ms; a media-play event inside recent demand schedules the same bounded/coalesced paged scan so a playback-owner swap with no later DOM mutation is not deferred to the next gesture; paged native scroll only coalesces settled observation and cannot rearm demand or inflate backtrack intent; while explicit demand is still recent, even a zero-fresh-item paged mutation batch may reschedule the bounded settled scan so virtualized attribute/media swaps are not deferred to the next gesture; before the first confirmation, mutation churn cannot postpone an already scheduled earlier 140 ms scan, while an unconfirmed gesture retains at most one 1,400 ms final confirmation and confirmed same-gesture work returns to trailing-edge coalescing; timer lateness is included in the emitted scan timestamp; stable content links exclude query/fragment churn from identity while path changes remain revisions, and a bounded 128-entry session alias prevents same-content DOM remounts from becoming consumption; ready, currently playing media ownership outranks geometry only among rendered viewport-intersecting candidates; nested card/player/video matches collapse before geometry reads, then current viewport hits are promoted ahead of bounded leading/trailing DOM candidates so a long retained prefix cannot starve the visible item while geometry reads remain capped; later same-gesture identity churn is neither emitted nor committed into the adapter until the current winner is non-emittingly reconciled immediately before the next explicit demand, preventing transient churn from becoming a zero-delay next-gesture transition; timer callback failures record `feed_flow_paged_scan` through `infiniteScrollGuard` diagnostics and rethrow |
| `FeedFlowDiagnosticLedger.record` / `matchFeedConsumptionJourney` | sanitized FeedFlow intent/scan/advance facts plus per-step trusted-input oracle samples | transport-aligned 32-entry mixed ledger, independently retained 32-entry confirmed-advance ring with bounded gesture/confirmation/opaque-winner causal capsules, 24-entry opaque dominant-winner trace, raw/collapsed/nested candidate and same-gesture suppression cost totals, exact TP/FN/FP/duplicate matching, and measured/armed-idle/insufficient/broken state | the public build records nothing; the ledger never retains raw DOM/content/item identity; advance-retention gaps and unavailable samples stay insufficient while dropped intent or dominant-scan rows cannot erase complete advance proof; a measured mismatch fails instead of being hidden by equal cumulative totals |
| `ContinuousAdvanceAdapter.recordProgress` | forward scroll delta, active scroller, container height, gesture and novelty evidence | confirmed continuous advance including accumulated subthreshold distance | same-scroller forward remainder is bounded by idle; backward input, scroller/surface change, and reset clear it so smooth scrolling is not invisible and stale distance cannot cross contexts |
| `FeedFlowRuntime.start` / `recordAdvanceEvent` / `recordSupplyReadout` / `stop` | capture/coordinator facts, semantic surface, supply, `FeedBoundaryState`, `FeedBoundaryJudge`, topology/readiness/safety and trigger bridge | actual movement, latest fresh opportunity, content-local placement context and sanitized statistics/debug snapshot | missing/nonfinite/negative advance counters fail; supply maintains or invalidates but never creates movement/opportunity; semantic reset requires manager acknowledgement; unsupported placement stays observe-only; no dose/tempo model or local consumption clock; partial cleanup errors remain explicit |
| Historical `FeedTempoEpisodeAssembler.recordAdvance` / `flush` / profile replay | explicit offline paged advances, lifecycle fixtures and injected repository | reproducible dwell/baseline comparison and storage-contract tests | comparison precedes learning inside the archived hypothesis; production has no hydration, commit route, research write fence or personal-model I/O; typed old checkpoints are preserved without starting a writer |
| `FeedStructureLearner.observe` | content-free surface, supply, transition, turnover, and container-stability observations | bounded `pending` / `warming` / `ready` / `volatile` / `invalid` readiness snapshot | raw text, selectors, paths, and unsupported fields are rejected; readiness requires independent dynamic corroboration and container stability, not elapsed time alone |
| `FeedFlowRuntime.getActuationContext` / `FeedTerminusController.arm` / `FeedEndpointBoundaryResolver.resolve` | admitted Enso feed-episode token plus feed readiness/safety and content-local selector/reference/scroller context | allowlisted stable endpoint plan or diagnosable pending/unsafe result | DOM-bearing context never enters bridge/background/storage; missing admission/not-ready/unsafe/observe-only remain idle; endpoint engage/frame failure returns through `onEpisodeFailure` so manager aborts the permit instead of leaving a silent reservation; unresolved plans do not mount a viewport overlay |
| `FeedEndpointLease.commit` / `release` / `scrollInputOrchestrator.engageForwardBoundary` | resolved named-topology endpoint plan, bounded following branches, declared tail layout, exact scroller position | in-place future-branch isolation, tracked restore metadata, site-painted tail, exact forward boundary, mutation reconciliation, and atomic restoration | isolation and boundary are one lease; artifact relative order and final adjacency are explicit invariants; active adapters retain every site branch under its native parent, preserve or collapse only as catalog-declared, and restore exact inline/inert/aria state; ownership loss, bound overflow, or unrecoverable forward drift invalidates instead of selecting another adapter, overlay, or network gate |
| `FeedTerminusController.resolveContinueIntent` | exactly one Enso outcome after renewed demand | neutral retry, canonical retreat, or ENTER-only continue acknowledgement and endpoint release | Enso request retains the endpoint; neutral retains Horizon, leave/suppressed retreat, and enter clears local factual continuation state; the next interval belongs to background admission, with no local continue-pass timer |
| `FeedFlowTriggerBridge.publish` | canonical feed-flow observation | latest snapshot, readiness/safety bridge message, shared-debugger semantic snapshot, and local observation callback | the snapshot bridge is the sole background statistics/debug path; strict enum/content-free normalization rejects malformed contracts, durable-counter delivery is not automatically retried, public builds keep failed transport settlements out of the page console, dev friction-debug emits named debug/warning codes, and neither pressure nor a snapshot direct-trigger field may activate generic protection strategy/artifacts |
| `BehaviorHub.updateContext` | active filters/domain/protection state and precision-insights consent | behavior signal context, telemetry-owned media and CLSE mutation leases, and signal-gate state | behavior signals cannot reopen disabled protection features; disabling precision telemetry releases the BehaviorHub mutation subscription, feed selector/seen state, video listeners, and strong video references; repeated ON/OFF updates cannot layer subscriptions |
| `ProtectionSignalGate.setFeatureEnabled` | signal key and enabled state | centralized cleanup callbacks | disabling a signal key clears in-flight manager state; cleanup hook failures record feature diagnostics while remaining hooks continue |
| `RuntimeDebuggerRuntime.arm` / `_tick` / `_resetSession` / `_copyText` / `_reloadForObservation` | debug flag state, protected-site debug config, debugger actions, canonical protection activation, and observer/social/visual/text/short-form/video/feed/Sentinel snapshots | version-2 baseline/latest/delta session, bounded per-operation events, validity-classified probe results, Short-form opportunity/effect proof ledger, scope JSON, item summary, full agent-ready report, reload capture, and sender-tab-scoped Sentinel reads | debugger is disabled unless explicitly enabled; session start and “new baseline” never reset producer-owned counters; the Short-form oracle uses a bounded shared-ObserverHub subscription, validates resolved YouTube/Instagram/Facebook/TikTok link hosts, and judges current opportunity/effect state without accepting a detached anchor or arbitrary descendant marker as proof; TikTok opportunity links are limited to the stable `nav-foryou` and `nav-following` owners with matching same-host recommendation paths; hidden/removed effects require an owner marker or a successful operation tuple attached to the exact owner target through the Short-form-owned opaque WeakMap seam, and a removed child opportunity may inherit that proof only through its retained DOM ancestor chain and an owner `mode=remove` tuple; a connected card that stops being Shorts is retired only after prior product proof and a matching owner `restored` tuple; generation, operation id, flush id, and delivery sequence must match the retained owner operation, so unrelated nodes in one flush cannot prove each other; observed and retired counts remain explicit, and `restored` participates in session counter deltas; no page copy or raw URL is exported; pause captures one final forced sample before freezing the export horizon; compact arrays mark total/retained/omitted counts instead of silently truncating evidence; inactive/unavailable/armed-idle/insufficient/broken/measured stay distinct; a zero denominator is `not_measured`; mount/sample/copy/reload/render/probe failures remain bounded inside the one debugger seam |
| `FeedSurfaceRegistry` / `GenericSurfaceClassifier` / `GenericFeedItemDiscovery` / `FeedAdvanceCoordinator` | host feed profiles, local raw route, site selectors, DOM feed roots, input/mutation stream | canonical item-independent `semanticSurfaceId`/route family/mode, supply revalidation demand + completeness (fresh count only when complete), separately confirmed dominant transitions | raw item pathname remains local context rather than reset identity; continuous skips supply discovery after scroll-write reconciliation; incomplete supply requests existing dominant revalidation without asserting novelty; TikTok keeps feed-item identity selectors separate from the raw-video dominant fallback and collapses nested matches to one outer item; document surfaces are excluded; invalid explicit feed selectors record `infiniteScrollGuard` diagnostics and fail closed instead of falling through to generic surface/item guesses |
| `VisualManager.update` / `remove` | resolved visual filter config, immutable site selector profile, root attributes, shared media observer, media composite effects, root filter cache | active visual manager ownership and reconciled media/root state | update failures roll back partial root/filter/observer ownership before rethrowing; media blur compiles candidate/context/geometry/keyword evidence and selector-derived observer attributes once per selector profile, preserves descendant rescans only for context-sensitive attributes, rejects self-only container attributes and unrelated roots before discovery, checks current discovery membership on style-only mutations of already-owned media, skips qualification replay while membership survives because additive composition tracks the host filter, and schedules exact local cancellation when membership is lost, promotes sibling short-form link mutations to their owning context, reconciles sibling dirty roots in one batch, preserves the global next-target union across nested dirty roots, owns media blur through zero-duration filling additive Web Animation effects rather than host inline style, validates additive support once per document, tracks owned effect activity in the cache instead of synchronously reading browser animation timing state on repeated no-op scans, leaves host filter changes as the live underlying value without rebase reads or style-write feedback, cancels the exact owned effect when a target becomes ineligible or detaches, fails explicitly when additive composition is unavailable, replaces repeated unknown-dimension polling with load/metadata events plus one settle check and one late fallback, releases unresolved candidates after that fallback when no future readiness signal can arrive (eventless, already ready, or readiness event consumed), retains only genuinely pending img/video readiness listeners under the bounded expiry, and performs no repeated identical effect update; callback-entry timing exposes preparation, queue, outcome, managed-style skip counts, composite create/update/recreate/cancel counts and durations, and debug-overhead counters; VisualManager consumes already-resolved filter strength; root-filter preload-state failures record `visualManager` diagnostics; remove cleanup failures keep the manager retryable |
| Visual observer batch admission / `filterRelevantMediaMutationRoots` | owner-classified mutation batch, dirty roots, compiled profile, and owned media Set | root admission with the same reconciliation decision used for cooperative application | direct owned roots use Set membership; only batches without removal work, retained attribute roots or promoted context roots skip tracked-descendant enumeration; unclassified calls default to reconciliation; eligibility loss retains P1 restore admission; local discovery and declared context promotion remain unchanged, without a new observer, reverse index or persistent cache |
| `VisualManager.updateCooperatively` / `applyMediaFiltersToRootsCooperatively` | resolved initial Visual plan, exact update token, root list, selector profile, and media composite owner | immediate root/observer ownership followed by 3ms-bounded initial candidate filtering, plan materialization, restore writes, and apply writes | the production protection path awaits exact completion; every continuation rechecks the current token before further DOM work; selector result order, dedupe, two-phase membership resolution, and restore-before-apply order match the synchronous owner; one browser `querySelectorAll()` remains indivisible; friction-debug temporarily retains the synchronous initial scan until per-slice attribution replaces its single-operation measurement contract |
| `TextShuffleManager.update` / `disable` | exact distance-distribution shuffle sub-profile, shared observer, `textShuffleTargetResolver`, `textShuffleMutationQueue`, and `textShuffleOwnershipLedger` | active lifecycle plus resolver context, bounded queue/cursor state, and exact original/shuffled/parent/target-owner ownership | manager-to-resolver/queue/ledger dependencies are one-way and queue/ledger do not import each other; separate probability/strength/strategy/pass/minimum-ratio, level/value/inner-shuffle, and omission inputs are rejected; zero distance derives fixed-word density, positive distances derive bounded swaps against original word positions including protected anchors, and any movable distribution guarantees one bounded pair for an otherwise unchanged eligible sentence when such a pair exists; update failures roll back partial observer/apply/debug-marker ownership before rethrowing; direct selector roots never widen to body when a valid selector has zero matches; added descendants normalize to their closest direct text target, and unstarted nested subtree work coalesces without discarding an in-progress cursor; an exact root re-enqueued after its cursor starts retains one coalesced replay debt so nodes inserted behind the cursor are revisited after the current pass; initial and new-content backlogs enter through browser idle admission; host rewrites may consume one bounded queue chunk during cooperative ingress (see F24); both are count- and time-slice-bounded even after an idle timeout, retain a continuation cursor, and do not schedule an empty follow-up for manager-authored text mutations; mutation inputs collapse by parent ancestry without pairwise subtree comparison, while the ledger indexes tracked nodes by exact parent and matched target owner so unrelated roots never scan the global tracked set; removed-subtree cleanup walks only that detached subtree and resolves exact parent ownership from the WeakMap index, so public marker loss cannot hide restoration and unrelated tracked surfaces are not scanned; queue work releases before ledger restore, newer SPA-authored text survives, and same-batch eligible reparenting remains intact; selector-derived attribute and deepest child-list dependency roots are batch-deduplicated before local target-owner revalidation, restoring text when an existing surface becomes exempt or no longer matches a relational selector and re-enqueuing surfaces that become eligible; disable cleanup failures keep the manager retryable |

| `createCooperativeMutationBatchQueue` | Visual/Text ObserverHub payloads, current-generation guard, owner consumer, platform continuation | deduped latest pending node/mutation batch, latest flush id, queue wait, and one serial cooperative drain | subscriber ingress performs no DOM traversal or write; every drain yields before taking the latest batch; cancel invalidates the exact generation and clears strong pending identity; scheduler/consumer failure clears that batch and reports through the feature owner without timer, idle, or microtask fallback |
| Visual/Text observer cooperative consumers | coalesced mutation batch plus current selector/config/ownership epoch | Visual media reconciliation or Text ownership revalidation followed by its existing idle apply queue | Visual uses the same 3ms candidate/write sequence as initial reconciliation and excludes scheduler pauses from active duration; Text bounds revalidation/enqueue at the platform deadline, records `observer_ingress`, and preserves its separate 3ms idle cursor for text application; release, disable, and config supersession prevent stale continuations from writing |

Instagram Reel hydration uses the same evidence boundary before and after media
insertion. A Reel link inside an `article` without video is incomplete evidence:
the resolver waits rather than sending that article through generic pruning.
Late video insertion rechecks its owning article. Confirmed Home Reels remain
blocked, but no longer reserve their original full-height blank area. The
manager's `collapse` mode retains the native article, clips its contents, and
sets its block size and direct content containers to 1px. The nonzero box keeps
a measurable slot for native feed virtualization; it is not a visible notice,
an alternate feed renderer, or a pagination controller. Host inline styles and
children remain intact. CSS owns the geometry; no new observer, layout polling,
scroll write, or host spacer-padding mutation is introduced.
An already hidden target is a no-op only when its current collapse marker
matches the resolved prune mode; mode changes update the marker and failed
writes restore its exact previous value. Recycling to a normal post or disabling
the effect removes the owned markers and restores native layout. Navigation and
profile links outside articles keep ordinary reversible `display:none` hiding.
Coverage: `tests/shortFormInstagramRules.test.js`.

## HTML Mount Ownership

`src/domains/nudge/indicator/view.js` owns the non-exported
`mountIndicatorTemplate(shadow)`; `src/domains/nudge/runtime/NudgeOverlayHost.js`
owns the non-exported `mountNudgeOverlayTemplate(shadow)`. Both accept only a
target ShadowRoot and mount fixed shipped CSS/markup constants, including the
overlay's `NUDGE_GAME_TEMPLATE`. Localized and runtime indicator badge values
use DOM construction and `textContent` instead of HTML interpolation.

`FastStyleEngine.setHtml()` is retired without a generic `setTrustedHtml`
replacement. `check:security:surface` protects the two private mount contracts
and constant provenance. Its schema 2 HTML sink inventory still detects direct
operator-count changes; it is not a safety proof for other sinks. Review scope
and the remaining sink owners are documented in
`docs/operations/runbooks/chrome-web-store-submission-guide.md`.

## Recovery Versus Fallback

| Class | Allowed? | Rule |
| --- | --- | --- |
| Unknown changed keys in dispatch planning | Bounded | Full broadcast is a fail-closed propagation strategy, not a secondary policy source |
| Known non-content changed keys in dispatch planning | No content dispatch | Dormant or extension-context settings such as `filterSettings.audioDulling` are classified separately from unknown keys and must not trigger tab queries or content broadcasts |
| Post-commit propagation retry | Bounded | A failed stage logs its owner stage and retries from that stage; missing handlers fail loudly instead of silently skipping requested work |
| Missing managed script id during registration sync | Bounded | Chrome may report an absent registered script id; this is a registration-state reconciliation and may proceed to register the canonical config |
| Managed/prepaint content-script apply failure | No silent success | Non-reconciliation update, unregister, or register failures throw to the orchestrator/propagation retry path instead of returning a successful sync snapshot |
| Open-tab catch-up injection failure | No silent success | Failed catch-up tab injection rejects the orchestrator sync, records the failed tab targets in the snapshot, and retries those targets on the next sync |
| Missing content runtime diagnostics store | No empty snapshot | Debug diagnostics require the canonical `ContentRuntimeDiagnostics` store; missing store throws through the trusted debug message route instead of fabricating empty events |
| Bootstrap cache/language/permission/foreground side reads | Bounded | Dispatcher may continue when derived bootstrap refresh, language candidate reads, permission lookups, or foreground-tab checks fail, but the failure must record a content runtime diagnostic or receiver-missing diagnostic field |
| Unsupported or late content bootstrap session state | No state mutation | Unknown bootstrap statuses and late phase regressions cannot rewrite the tab session's document/url/readiness state |
| Non-positive dispatch-ready wait timeout | Bounded | `waitForDispatchReady` resolves `false` immediately unless the tab is already dispatch-ready |
| Periodic dispatch reconciliation | Bounded | Full sweep is allowed to correct missed lazy updates at the planner interval |
| Feature hash object order drift | No patch churn | Feature hashes use stable key ordering so semantically identical compiled configs do not produce noisy patch upserts |
| Patch delta hash metadata missing | No silent no-op | Delta key discovery includes activation/compiled payload maps, and hashless compiled changes/removes still emit patch upserts/removes |
| Dormant or extension-context filter setting in content envelope | No content fallback | Release content envelopes include only `PROTECTION_FEATURE_CATALOG`; research settings such as `audioDulling` stay outside the content-runtime feature map |
| Public audio-dulling runtime actions | No release handler | Dev QA owns its typed exact-tab route; release action handlers must not wire capture target lookup, tab-query fallback logic, or audio capture dependencies |
| Envelope missing or legacy payload | No activation fallback | Activation fails closed and clears effects instead of applying legacy `filters` as truth |
| Envelope feature key/payload schema | No runtime contamination | The envelope contract rejects uncataloged activation/compiled/revision keys, unknown patch remove keys, scalar feature payloads, and malformed feature revision values before content runtime state mutates |
| Empty compiled feature map | No activation fallback | Activation fails closed instead of treating an empty compiled object as “no effects” |
| Compiled active without activation truth | No activation fallback | `buildFiltersToApply` forces a compiled feature inactive unless `activation.features[key].enabled === true` |
| Stale envelope patch/snapshot | Bounded | Ignore stale updates without mutating current runtime state |
| Future or base-mismatched patch | Bounded | Request background resync and do not mutate; request delivery failure must log |
| Keyed effect repeat mount | Bounded | Dedup identical configs in `ProtectionRegistry`; forced cleanup resets the signature |
| Keyed effect mount/unmount failure | No false success | Failed mount/unmount attempts must not advance the registry signature as if the owner step succeeded; diagnostics record the failure and the same transition remains retryable |
| Global effect async failure | No unlabeled miss | Promise rejections from lazy global effect owners must warn at the `applyProtectionEffects` boundary with the owner label, not only inside the lazy loader |
| Compiled social-metrics projection | No settings round-trip | `ProtectionRegistry` extracts the validated `socialMetrics` entry from the compiled plan; it must not pass materialized adaptive profile entries through `normalizeFilterSettings()` |
| Individual effect failure | Bounded | Record/log failure and continue unrelated cleanup/application work |
| ObserverHub observe/subscriber failure | Bounded | Observe failures must not return a successful subscription; subscriber failures are recorded in the shared observer debug snapshot and must not spawn manager-local observer fallbacks |
| BehaviorHub init/teardown/subscriber failure | Bounded | BehaviorHub init failures must not leave the sidecar marked initialized; teardown failures are reported and retryable; subscriber callback failures must not block later subscribers or become feature truth |
| BehaviorHub feed-item selector failure | Bounded | Feed-item sensing is sidecar metadata; invalid feed selectors record `behaviorHub` diagnostics and skip the seed/mutation scan instead of failing open or killing unrelated behavior signals |
| Visual manager lifecycle failure | No false success | Shared observer, target observer, root filter, media filter, temporal, root attribute, and video-container ownership transitions must not leave visual update/remove looking successful; root-filter preload-state failures record `visualManager` diagnostics, and failed remove attempts keep the manager retryable |
| Fullscreen visual relaxation | Independent Lens preference and background-declared presentation policy | `filterSettings.fullscreenVisualRelaxation` defaults ON for new settings and is always visible. VideoSkipGuard is unrelated. Active grayscale/blur/brightness/contrast/colorSaturation project once: normal→relaxed, ordinary reinforced→normal, schedule relaxation→temporary visual suspension, target exhaustion→reinforced unchanged. Text Rhythm and other protections are unaffected by fullscreen. Local results never become background/bootstrap truth. See friction-filter-injection-architecture §3.5–3.6. |
| Text Rhythm adaptive intensity | Explicit bounded profile | The persisted setting is binary. Normal execution uses the zero-to-five distance distribution `[42,22,16,10,7,3]`; routine policy strengthening uses reinforced `[8,12,17,22,23,18]`; schedule relaxation overrides routine strengthening and selects `relaxed`; exceptional Furin overrun overrides schedule and selects `reinforced`; suspension wins over every band; no modifier can activate a user-disabled entry or stack beyond one band |
| Text shuffle lifecycle failure | No false success | Shared observer, idle apply, pending queue, debug marker, and text restoration transitions must not leave text-shuffle update/disable looking successful; failed disable attempts keep the manager retryable |
| Visual/text target selector failure | No silent empty set | Invalid media candidate/context/overlay or direct text target/exclusion selectors record the owning global effect diagnostic and stop that scan instead of treating failure as no matches or widening to body |
| Visual media selector failure | No guessed continuation | Invalid visual media candidate, context, or overlay-exempt selectors record `visualManager` diagnostics and fail closed instead of falling through to an undeclared domain or generic continuation |
| Social metrics candidate selector failure | No silent empty scan | Initial scan selector failures record `socialMetricsManager` diagnostics and fail update; mutation rescan selector failures abort that scan with diagnostics without changing canonical activation truth |
| YouTube social-metric root relevance selector failure | No guessed relevance | Root relevance selector failures record `youtube_root_relevance_selector_failed` through `socialMetricsManager` and skip that dirty-root scan instead of treating every root as relevant |
| Feed-flow explicit selector failure | No guessed continuation | Invalid feed surface, discovery, dominant-item, or closest selectors record `infiniteScrollGuard` diagnostics; explicit selector syntax failures do not fall through to generic surface/item guessing |
| Feed endpoint resolution/lease failure | No visual or network fallback | Unsupported semantic-surface/profile/mode tuple stays `observe_only`; unresolved/unstable topology, lease failure, or invalidation records `infiniteScrollGuard` diagnostics and does not mount a viewport veil, mutate an unallowlisted lane, or intercept feed network requests |
| Input delay manager lifecycle failure | No false success | Listener and root-marker ownership transitions must not emit input-delay apply/remove success before the owner step succeeds; failed remove attempts keep the manager retryable |
| Input delay visual snapshot failure | Bounded | Selection/style/overlay cleanup failures record `inputDelay` feature errors; do not delay the actual DOM value or create a secondary input source |
| Input delay bypassed/sensitive surface | No snapshot | Bypassed, unsupported contenteditable, password, and disabled/read-only surfaces must return before reading input value |
| Input visual brake manager lifecycle failure | No false success | Listener and root-marker ownership transitions must not emit input-visual-brake apply/remove success before the owner step succeeds; failed remove attempts keep the manager retryable |
| Input visual brake metadata failure | Bounded | Caret/style/glyph/cleanup failures record `inputVisualBrake` feature errors and may use abstract placement, but must not read input value |
| Input visual brake Canvas failure | No renderer fallback | Canvas context creation/resize/frame failures record `inputVisualBrake` errors; the manager does not revive the retired DOM-stamp/tide renderer or substitute another theme effect |
| Click pause manager lifecycle failure | No false success | Listener and root-marker ownership transitions must not emit delay distribution success before the owner step succeeds; failed remove attempts keep the manager retryable without clearing Enso ownership |
| Enso gate manager lifecycle failure | No false success | Listener, source-permit, surface and root-marker transitions remain independently retryable; failure cannot enable/disable click pause or rewrite the shared cadence |
| Enso cadence evidence unavailable | Explicit withheld state | Missing/stale receipt cannot be interpreted as zero use or a due interval; content never extrapolates time. The next current boundary rechecks the shared receipt and local conditions; no old score/rearm fallback is consulted |
| Enso spawn reservation or surface failure | Retryable without false exposure | A reservation serializes one attempt. Endpoint attachment preserves ownership while the current item finishes; only click view creation or actual Horizon encounter reports presentation. An unshown failure releases its exact permit without resetting cadence, and future input is evaluated again |
| Retired click-enso gate alias | No runtime compatibility path | `InteractionManager` reads only canonical `ensoGate`; alias-only `clickEnsoGate` config cannot enable the Enso gate |
| Click boundary selector syntax failure | Bounded | Invalid host selectors record an error on the active owner (`ensoGate` first, otherwise `clickDelay`) once per feature/selector/operation instead of silently guessing a target |
| Enso-gate leave redirect | Bounded | Background tab close is primary; `about:blank` redirect is allowed only as the documented leave-navigation degradation and every thrown step must warn |
| Synthetic click replay failure | No silent success | A replay throw or non-replayable target cannot emit `click_replayed`; replay has no Enso score or cadence-write authority |
| Scroll manager apply/remove failure | No false success | `manager_apply` and `manager_remove` events must only be emitted after the scroll manager and orchestrator ownership transition succeeds; failed remove attempts keep the manager retryable |
| Malformed scroll-friction delay | No silent disable | Invalid compiled delay values record `scrollFriction` diagnostics and throw before subscribing or applying a zero-delay config |
| Scroll observer/resistance callback failure | Bounded | Callback exceptions record `scrollFriction` feature errors; they must not create a second scroll path or hide the failure behind console-only warnings |
| Scroll listener lifecycle failure | No false activation | Wheel/scroll/context listener attach or detach failures record `scrollFriction` diagnostics and must not report delay/resistance ownership as successfully changed |
| Middle-click autoscroll active-listener failure | No false activation/deactivation | Active listener attach failures must not leave autoscroll active; detach failures must not mark the session stopped until listeners are actually removed |
| Middle-click autoscroll exclusion selector failure | No silent activation | Selector evaluation failures record `scrollFriction` once per selector operation and fail closed without starting autoscroll |
| Programmatic physics scroll failure or under-application | Bounded | The failing controller stops after recording a `scrollFriction` feature error; severe under-application records `managed_scroll_underread_bypass` and temporarily fails open to native/site wheel handling for that axis. Do not loop failing frames or fall back to a separate replay queue |
| Video manager lifecycle failure | No false success | `manager_apply` and `manager_remove` events must only be emitted after shared observer, storage flush, listener, and cleanup ownership transitions succeed; failed remove attempts deactivate manager/gate, retain unresolved owners for exact retry, reject reapply until cleanup completes, and omit the success event |
| Video seek revert failure | No silent success | A blocked user seek must not be reported as cleanly handled if the adapter seek/current-time write fails, never executes, or stays away from the native target; record the failing phase, abort the transaction, and do not emit `revert_completed` |
| Video post-revert loader stall | Bounded | A was-playing revert may perform one adapter-owned loader recovery seek/play when ready/buffer/network state indicates no useful load progress; record `revert_loader_recovery_requested` instead of silently looping |
| Video pool persist rejection or cross-context conflict | Single-writer convergence | Content repositories report rejected merge commands as `storage_persist`, retain their error owner for teardown retry, and never write `chrome.storage.session` directly; an invalidated extension context is the one terminal rejection — it is recorded as the `extension_context_invalidated` diagnostics event rather than a fault, and no further write is attempted; the background coordinator serializes read-merge-write and preserves the maximum deadline across simultaneous tab teardown |
| Media-frame probe sidecar | Bounded observation and admitted HTML media hold | The all-frames probe reports cached video presence and ready/visibility state; V4 adds the exact-document hold receiver below. It cannot activate `VideoSkipManager`, mutate policy, or mark a tab dispatch-ready |
| Video listener attach/detach failure | Transactional | Attach validates the full binding table and rolls back in reverse order before video ownership commits; rollback/detach failures retain only unresolved bindings in the pending cleanup ledger, record exact event/group diagnostics, and cannot emit a complete attach/detach success event |
| Video observer subscriber delivery failure | Bounded exact retry | Failure in one consumer cannot block later consumers; the observer clears only that delivery mark and retries the exact consumer/video pair at 50/250/1000 ms, then records exhaustion; unsubscribe or video removal cancels the retry |
| Short-form manager lifecycle failure | No false success | `manager_apply` and `manager_remove` events must only be emitted after shared observer, URL listener/poller, hidden-target, style, notice, and root-marker ownership transitions succeed; failed remove attempts keep the manager retryable |
| Short-form rule missing for host | Bounded | Unsupported hosts acquire no URL/click listeners, URL poller, or shared observer lease; they remove the short-form root marker and record `rule_missing_for_host`, without guessing selectors from another platform |
| Short-form prune mode missing | No legacy default | Each platform rule must explicitly choose `hide` or `remove`; missing mode records `shortFormBlock` error and does not fall back to remove |
| Short-form selector or DOM mutation failure | No silent success | Selector, closest/querySelector/querySelectorAll, redirect, hide, remove, notice, and teardown failures record `shortFormBlock` errors; selector failures fail closed before pruning, and success events are emitted only after the target mutation succeeds |
| Social metrics lifecycle failure | No false success | Shared observer, bounded Reddit shadow observers/styles, scan timers, scan queue, mark cleanup, artifact restore, and root marker failures must not leave update/remove looking successful; failed cleanup attempts record `socialMetricsManager` diagnostics and keep the manager retryable |
| Enso feed-episode manager lifecycle failure | No false success | `manager_apply` must only be emitted after shared Enso listener lease, FeedFlow runtime, signal gate, supply probe, Terminus, and debugger ownership transitions succeed; failed apply attempts disable the signal gate, release acquired owners, and restore the previous versioned Feed Horizon runtime config |
| Feed-input capture lifecycle/classification failure | Bounded | Listener subscription/attach failures must not leave partial capture active; activity closest selector failures record `infiniteScrollGuard` diagnostics; detach failures use the single listener list, attempt remaining teardown, and then throw for manager diagnostics |
| Feed-flow runtime start failure | No false activation | Runtime start failures clear partial surface/capture/coordinator state and rethrow instead of leaving runtime-local state looking partially active |
| Feed-flow paged scan timer failure | No silent async miss | Both the fast settled phase and its optional final-deadline phase stay inside the single paged scan timer owner; failures must report through `infiniteScrollGuard` diagnostics and rethrow, and no secondary timer path may treat failures as no transition |
| Feed-flow runtime stop failure | Bounded | Capture, coordinator, burst, and trigger-bridge cleanup remain one stop sequence; one owner failure must not skip later cleanup or leave runtime-local state marked running |
| Feed-flow statistics/debug bridge failure | Bounded | Feed-flow observation belongs to the shared runtime debugger and snapshot bridge; bridge publish/callback failures record diagnostics and cannot be recovered by promoting the snapshot to generic protection pressure/direct-trigger authority |
| Runtime debugger internal failure | Bounded | Debugger mount, sample, copy, render, and reload-observe failures are recorded in the shared `entropy.runtimeDebugger` payload/status; the debugger may pause failed sampling but must not create a secondary diagnostic store or overlay |
| Terminus endpoint arm/frame failure | No silent success | Boundary resolve, lease commit, tail-surface mount, frame, or exact-forward-boundary failures record `infiniteScrollGuard` errors; failures release/roll back endpoint ownership and never mount a viewport overlay or emit false activation |
| Enso feed outcome failure | No silent success | A renewed-demand request keeps Terminus committed until one Enso outcome is confirmed. Only `enter` may call `FeedFlowRuntime.markContinue`; `leave`/`suppressed` require canonical retreat; `neutral` keeps the endpoint and resets pull intent. Callback failure cannot masquerade as resolution |
| Enso feed-episode cleanup failure | Retryable owner boundary | Timer/probe failures remain bounded, but an unconfirmed Terminus/surface/permit/listener/source release sets `CLEANUP_FAILED`; a new apply fails as `ENSO_RUNTIME_EPISODE_CLEANUP_PENDING` until the same episode/controller owner finishes retained ownership instead of layering a second lifecycle |
| Direct manager mount from controller | No | New effects must be registered through keyed/global registry ownership |
| Behavior signal as feature truth | No | BehaviorHub may emit signals only after `ProtectionSignalGate` allows the feature |
| Signal-gate cleanup failure | Bounded | Failed cleanup hooks record the owning feature diagnostic with `phase: signal_gate_cleanup`, then the gate continues running remaining cleanup hooks |
| New debug overlay | No | Extend the shared runtime debugger rather than adding another visible debug surface |
| Page-local debugger flags | Bounded | Allowed only as debug UI state, never as canonical protection data |

Development friction-debug enablement belongs to the page-local flag helpers in
`platform/browser/dev/frictionDebugFlags.js` and explicit in-memory leases. The
public build entry remains disabled. Neither entry reads or writes Chrome storage.
Reload-observe must save its origin-local enable/open/capture flags through
`platform/browser/pageLocalStorage.js`; persistence failure reports a visible
status and prevents reload. There is no extension-global flag API or cache.
`RuntimeFlagRepository` continues to own only its declared scheduling/cap session
state and is not a debug-flag storage substitute. The storage boundary guard
checks actual property-access syntax, including aliased extension namespaces,
optional chains, bracket access and destructuring.

## First-Pass Findings

### F1. The main effect path is already a narrow registry

Status: keep.

`ProtectionController` does not mount individual managers directly. It delegates
activation to `ProtectionActivationEngine`, filter application to
`ProtectionStateApplier`, and effect ownership to `ProtectionRegistry`. This is
the right choke point for future effect additions.

### F2. `fallback_full` is a fail-closed dispatch plan

Status: documented keep.

The `fallback_full` reason in `ProtectionDispatchPlanner` does not create a
second feature source. It broadens propagation when changed-key intent is
unclear. This is acceptable because the content side still applies only compiled
envelope truth.

### F3. Patch resync request failure was silent

Status: fixed in this pass.

When content receives an invalid/future protection patch, it asks background for
a resync. That send failure used to be swallowed with an empty catch. The catch
now logs the reason, expected/received base revisions, and trace id so failed
recovery is diagnosable.

### F4. Effect failure containment is intentional but must stay visible

Status: settlement contract corrected on 2026-09-05.

Effect owners isolate failures so one broken effect does not prevent siblings
from running. Full cooperative activation and `clearAllProtectionEffects` await
owner promises and reject with an aggregate failure after siblings settle;
warnings alone cannot certify success. The controller awaits both apply and clear
before committing applied diagnostics or a successful ACK. The synchronous
`applyProtectionEffects` entry used by early/fullscreen presentation retains its
owner-labelled diagnostic containment and does not certify a protection ACK.
Lazy owners must return their promise chain to this settlement boundary.

Automatic Site Furin and Global Sentinel entry candidates keep `NUDGE_START`
pending only through the current attention seam and surface startup. They do not
wait for the user's ritual outcome. `beginSentinelEntrySeam` cancels immediately
when the document is already hidden, becomes hidden, or exits through `pagehide`.
Its existing CANCEL settlement clears idle/cap timers, activity/boundary/lifetime
listeners and presage ownership. The controller returns the exact negative
`entry_cancelled` START acknowledgement without starting the host; the runner
recognizes only the exact four-field reply and two-field nested start result,
then awaits a successful abort receipt for only the issued unpresented run
before returning a named `entry_cancelled` terminal skip and releasing its
in-flight owner. Partial/malformed replies remain dispatch failures; an abort
exception or missing exact abort receipt remains a hard failure. The normal
cancellation uses debug diagnostics rather than a failed-start warning.
The background kernel architecture guard protects the exact negative reply
shape, awaited issued-run abort receipt, hard cleanup failure and final
in-flight release ordering.
Returning to a visible document cannot replay that candidate. Existing STOP,
document/epoch fences and shared intervention exclusivity remain in force.
Regression coverage: `tests/nudgeEntrySeamGate.test.js`,
`tests/protectionControllerNudgeDebugSpawn.test.js`, and
`tests/protectionNudgeDispatchRunner.test.js`.

### F5. Runtime debugger ownership is unified

Status: keep.

Observer, social metrics, visual media, text shuffle, short-form, shared video,
click/video guards, feed-flow, and Sentinel probes live under the one
`RuntimeDebuggerRuntime` shell. The shell delegates session math/reporting to
`runtime-debugger/core/**` and activation-aware validity to
`RuntimeDebuggerProbeCatalog`; future diagnostics should add a probe and tab to
those seams, not create another floating debugger surface.

FeedFlow contributes a dev-only bounded semantic ledger to that shell. Session
reset may clear this debugger-owned ledger, but must not reset cumulative
producer counters. The independent real-site opportunity oracle remains outside
the product runtime and enters only the diagnostic analysis result; it is not a
second content observer or a source of FeedFlow decisions.

The real-site diagnostic harness reaches that same owner only through the
dev-only typed automation contract, trusted background route, and content
relay. Those files are transport seams: they target one verified tab and call
the existing session/snapshot/report methods; they do not own another overlay,
store, sanitizer, or report shape. Public builds resolve the route to no actions
and the relay to a no-op, and `check-public-build-debug-surface` must continue to
prove that the dev contract and debugger signatures are absent. The paired dev
diagnostic/public release execution contract is canonical in
`docs/operations/qa/real-site-e2e.md`.

### F6. Click pause and Enso Gate have independent feature ownership

Status: fixed in this pass.

`clickDelay` now owns only the short commit pause and synthetic replay.
Its canonical stored value remains `1200` ms with a `450` ms sampling spread.
`canonicalBinaryFilterProfiles.js` owns the actual pause projection: scale
`0.625`, floor `600` ms and ceiling `900` ms, giving a `750` ms midpoint.
`sampleClickPauseMs` preserves explicitly shorter samples through the floor;
larger samples are projected monotonically into that pause window. These are
product defaults, not Enso cadence or additional public intensity settings.
`ensoGate` independently classifies native new-content clicks and requests shared
admission when the background consumption interval is due. When
both are active, a ready Enso gate takes precedence and click pause applies only
to the remaining eligible clicks. Removing either feature retains the other's
listener lease and state. The common listener transport is policy-neutral;
`clickDelay` and `ensoGate` own separate source leases and separate
`data-click-delay-active` / `data-enso-gate-active` root markers.

`interactionManager.replayClick` returns an explicit replay outcome. Failed
synthetic clicks record a `clickDelay` feature error and `click_replay_failed`
instead of `click_replayed`; replay has no score or cadence-write authority.
Click boundary selector guards still tolerate invalid host selectors, but syntax
failures record on the active feature owner. Click-pause diagnostics contain no
Enso readiness payload; Enso readiness and content boundaries are recorded only
under `ensoGate`.
Enso-gate gesture canvas context failures are recorded once per gate instance
without blocking the gate decision path. Enso-gate leave navigation still has
the documented tab-close then `about:blank` sequence, but each thrown
close/redirect step is now warned by phase, and a final `false` navigation
result records an `ensoGate` feature error so the degradation is visible.

### F6a. Enso Gate has one canonical runtime key

Status: fixed in this pass.

`InteractionManager.applyEnsoGate` reads only the canonical `ensoGate` config
for click-Enso behavior. The retired `clickEnsoGate` alias and the old nested
`clickDelay.ensoGate` runtime shape are not accepted. `applyClickDelay` receives
only delay-distribution input and cannot configure Enso.

### F6b. Click pause and Enso interval have separate settings

`clickDelay` remains Brake's commit-pause feature. `ensoGate` owns Veil's
Off / 8 / 12 / 20-minute selection, with 12 minutes the default; the same interval
is compiled for click and Feed Horizon paths. `ensoIntervalPolicy.js` is the
single preset definition. Settings reads and hydration accept the exact current
contract without converting old tuning or mutating storage. Incompatible
development settings require the explicit whole-profile reset procedure.

### F6c. Cadence, boundary and admission have separate owners

The current contract is
[Feed Flow Runtime](../runtime/feed-flow-runtime-target-architecture.md) together
with [Intervention admission](../runtime/intervention-admission-runtime.md).
Background `InterventionAdmissionService` owns one bounded foreground-time
counter across protected sites using the existing operational tracking ingress.
It saturates at one opportunity and never banks a queue. Read operations do not
add time. Speed, dose, pressure and personal tempo do not alter the interval.
This operational foreground duration is not an attention or addiction measure.

A due receipt alone does not display Enso. Click readiness still requires an
eligible new-content action; Feed Horizon requires a fresh confirmed forward
boundary and current local inhibitors, semantic-surface grace and placement
safety. A prepared feed reservation can complete on the existing supply beat
within the original 5-second opportunity, but the beat cannot create or revive
a boundary. Denied/expired attempts require current conditions and new input.

`EnsoSpawnPolicy` owns named click/feed source leases and one exact permit,
without first-grace or cooldown clocks. Background admission owns cross-document
exclusivity, mandatory preemption, interval reset and common recovery. A mounted
endpoint is attached, not presented. Actual click view creation or Horizon
encounter commits presentation once; only an actually presented automatic
reflection ending starts the next interval. Unshown failure and manual QA do not
reset production cadence. Source teardown cannot release another owner's lease.

Earlier reward-drift, dopamine-binge, dose/maturity, rearm and personal-tempo
algorithms are [offline research](../../../scripts/dev/enso-model-research/README.md).
Their retained source paths are an explicit research/test import set, forbidden
from the active dependency graph. There is no parallel runtime analysis, hidden
profile hydration/writer, research write fence or score fallback.

### F6c.1. Barrier consumption boundary

The stable runtime key is `ensoGate`; its artifact owner is Barrier. Once the existing cadence, fresh content boundary and admission lease permit an intervention, one fullscreen surface pauses the consumption flow. Drag from its center at least 112 px horizontally (bounded to 30% of narrow viewport width), for at least 420 ms. Release left to end this visit or right to continue. The current release direction is authoritative; crossing an earlier side does not latch a choice. Vertical or short gestures rearm in place. Escape, visibility loss and window blur cancel neutrally; pointer cancellation rearms without replay or navigation. ArrowLeft/ArrowRight held for the same minimum time provide keyboard operation.

The surface keeps the exact input lock and spawn permit until settlement or cleanup. No incomplete ink, circle, seal or separate reopening step remains. The existing cadence, media pause, navigation/closure authorization, stale-lease refusal and original-click replay owners remain unchanged. Focus moves to the named dialog on admission and returns only to its connected former control when the dialog still owns focus at removal.

### F6c.2. Barrier boundary presentation

`ensoGateView` and `ensoGateStyle` own one fullscreen, box-free threshold. The moving central boundary and two destination labels reflect the same gesture frame. Zen uses a charcoal ground and quiet stone texture. Other themes use their own canonical palette. Readiness is announced through one live region; reduced motion removes transitions. The render-only `visual/zen/enso-gate` scene captures armed, drawing and both qualified directions using production owners. It does not certify real consumption timing.

Regression coverage: `ensoGateGesture.test.js`, `ensoGatePresentation.test.js`, `interactionManagerClickBypass.test.js`, `interactionManagerEnsoFeedEpisode.test.js` and `ensoGateQaAdmission.test.js`.

### F6d. A fresh feed boundary admits one purpose-owned Horizon episode

Public ownership is Barrier's **Consumption interval** (`소비 간격`) in Tools,
for both classified-click and feed routes. Enso-named cadence and execution
modules below are internal names; the Zen Enso artwork remains Veil's separate
presentation. No settings/storage rename is implied by this distinction.

`FeedObservationRuntime` owns the shared document producer. `FeedBoundaryState`
records actual forward movement; `FeedBoundaryJudge` combines independent goal
demand or the background periodic due receipt with a new advance and current behavior. Supply observes availability
and topology, not consumption. Typing, selection, interactive actions and backward
search can invalidate an unreserved opportunity; passive supply cannot preserve
an expired one. Structural confidence establishes placement evidence only.

`resolveEnsoFeedEpisodeAdmission` requires the current due receipt, fresh
opportunity, surface grace, ready/safe non-observe-only capability and source
permit. `FeedBoundaryEpisodeCoordinator` owns the exact background reservation,
surface claim, attached endpoint, actual encounter and continuation. The existing
`EnsoRuntimeEpisodeManager` path re-exports this same class/singleton; it cannot
construct a second actuator. Periodic Enso retains its own source and cadence
policy. Goal `requestGoalEntry` supplies independent demand even when Enso is
OFF, with one `site_furin` / `global_sentinel` lease and matching explicit
`site_goal` / `global_goal` purpose.
[The topology contract](../runtime/feed-topology-certification-runtime.md) retains
the existing named adapter/certificate and bounded geometry owners.

A successfully attached endpoint can wait beyond a short candidate lifetime so
the current readable item can finish. Attachment does not consume presentation
or reset the interval. The user may remain at Horizon; stillness does not end the
episode or summon another gate. `HorizonContinueGesture` under
`src/domains/nudge/feed-flow/terminus/` separates the arriving input from a later
forward gesture: wheel bursts require 350 ms silence, key repeat cannot start
one, and pointer pulls retain their press identity/start time. Wheel silence is
an input-grouping heuristic, not a measurement of intention. The physical lease
and motion owners carry those facts without making policy decisions. The
controller can request continuation only on an accepted threshold-crossing
input, never from its frame loop. Existing still-gate time alone cannot qualify
an ongoing gesture. Deliberate renewed forward demand uses
`InteractionManager.requestEnsoGate` within a periodic episode. A goal episode
instead acknowledges `boundaryPresented`, then transfers its exact lease once
through `adoptPresentedGoalEndpoint` to Furin after fresh continuation; no Enso
question precedes Furin. Actual boundary contact is exposure, and actual Furin
paint is a separate final display. Mandatory preemption and common recovery
remain the background owner's decisions. Prelude-only departure earns recovery
without Furin daily delivery or cadence reset.

Terminus stays committed while the Gesture Gate is active. Neutral resets pull
and gesture authority and keeps Horizon; backward input and pointer end/cancel/
reversal also clear continuation evidence. Leave/suppressed use canonical retreat; enter acknowledges
`FeedFlowRuntime.markContinue` and releases the endpoint. There is no local
continue-pass timer or second consumption reset. Failed attachment, cancellation,
configuration change and surface change release the exact owned resources; failure
before presentation preserves accrued time. Shared listener leases keep click
pause, click Enso and feed ownership independent during teardown.

### F7. Scroll friction callback and actuation failures are diagnostic events

Status: fixed in this pass.

`scrollInputOrchestrator` now records `scrollFriction` feature errors for
observer callback failures, resistance callback failures, and failed managed
scroll application. A failed physics scroll application stops that controller
instead of looping through repeated frame failures or introducing a secondary
scroll replay path. If a site severely under-applies programmatic scroll while
the target still has native scroll room, the orchestrator records
`managed_scroll_underread_bypass` and temporarily lets site/native wheel handling
own that axis instead of continuing to swallow input. Middle-click autoscroll
exclusion selector failures record
`scrollFriction` diagnostics and fail closed without starting autoscroll.
Releasing scroll resistance also resyncs listeners so the wheel hook does not
stay installed after the last scroll-friction consumer is gone. Malformed
compiled delay values now fail before `InteractionManager` subscribes to the
scroll orchestrator or applies an accidental zero-delay config.

The canonical wheel material is `frosted_stone`. The public contract is binary:
enabled always materializes the 1000ms light-stage material, and disabled
removes the effect. There are no internal strength bands for delay values, so
schedule and protection intensity modifiers cannot turn the public setting
into a hidden strength control.

`frostedStoneDynamics` is the DOM-free motion SSOT. Every normalized wheel delta
becomes a signed impulse, momentum is updated by ordinary vector addition, and
velocity and kinetic energy derive from the material mass. Opposing input thus
cancels existing momentum before reversing it without a counter-brake gain or a
direction-specific release rule. Total kinetic energy is capped rather than
buffering excess delta in a replay queue.

The material uses a Stribeck friction curve: low speed remains in a high-
friction `grip` region, while repeated impulses can cross into the lower-
friction `glide` region before naturally returning through grip as energy is
dissipated. Viscous drag guarantees finite settling. Time integration uses
bounded 240Hz substeps. A resumed frame may translate at most 40ms of motion;
excess elapsed time advances friction without returning displacement. This keeps
60Hz and 120Hz travel consistent while preventing both a background-tab catch-up
jump and momentum frozen at its pre-suspension value. The orchestrator retains
only input normalization, target and controller ownership, DOM actuation,
fail-open underread handling, and
diagnostics. `scrollGestureOwnership` is the second DOM-free kernel: it owns one
140ms wheel-gesture lease and the dominant-axis noise lock. The first eligible
target remains the axis owner while that gesture is active, even when pointer
hit-testing moves over a sibling scroller. A new gesture may replace that owner,
but that changes only where new impulses are delivered. The prior surface keeps
its own motion body and dissipates its existing momentum independently; a new
surface begins from its own momentum state rather than inheriting or cancelling
the prior surface's tail.

Independent surfaces may therefore settle concurrently on the same axis. The
only cross-controller transfer is native-like scroll chaining: when a leased
nested target reaches a real boundary and its computed `overscroll-behavior` for
that axis is `auto`, the orchestrator transfers the remaining signed momentum
once to the first eligible composed-tree ancestor, zeroes the source axis, and
moves the lease with it. `contain` and `none` dissipate at the source boundary.
A page that still reports native scroll room is not a boundary: managed scroll
is applied with `instant` behavior and verified against the next position sample,
preventing CSS `scroll-behavior: smooth` or scroll-snap latency from being
mistaken for an immediate actuation failure. Repeated severe underread still
enters the bounded native-wheel bypass described above.

Pointer, touch, keyboard, focus, window-blur, and hidden-document changes release
only the input gesture lease. Existing surface motion remains owned by that
surface. If animation frames pause while hidden, the first resumed frame consumes
the wall-clock gap through dissipation-only integration before any visible step,
so the tail neither jumps nor resumes forever from stale momentum. The dashboard
preview imports both pure kernels instead of maintaining a second easing or
ownership implementation. Infinite-scroll viscosity remains separately owned by
the shared resistance seam and is not another always-on scroll material.

### F8. Input delay snapshot failures stay visible and overlay-only

Status: fixed in this pass.

`inputDelayManager` remains a visual-overlay delay, not an input replay or DOM
value delay. Unsupported and bypassed surfaces are rejected before creating a
snapshot, while selection metadata, style snapshot, font readiness, frame
update, and cleanup failures now record `inputDelay` feature errors instead of
falling through empty catches.

This retained implementation has no release feature registration or production
mount/import caller. The former `resolvedFrictionEffects` bootstrap cleanup
facade only kept it in the content import closure while repeating eight registry
cleanups. The 2026-10-12 settings wiring audit removes that facade; canonical
runtime cleanup and sidecar cleanup each retain their own settlement obligation.
Full retirement of the isolated input-delay implementation is a separate task.

### F9. Input visual brake caret reads stay ephemeral, sensitive-safe, and diagnostic

Status: fixed in this pass.

`inputVisualBrakeManager` owns the narrow exception required to place Shoji ink
against the rendered caret rather than `selectionStart * averageGlyphWidth`.
Every renderable input beat is admitted immediately. A non-sensitive `textarea`,
text input, or search input may read its current local value once for that brush
point. The value is mirrored inside a closed shadow root, the caret marker is
measured, and all mirrored text is cleared synchronously before the input
handler returns. The feature has one binary setting and one canonical profile;
typing cadence changes pressure, width, bloom, joining, and drying motion rather
than selecting a stored strength level. The manager does not retain text or
include it in diagnostics, messages, storage, or learning payloads.

The private `input-visual-brake` context receives only timing, input type, and
caret geometry. `InkBrushSession` joins nearby forward points into one
arc-length-parameterized stroke, keeps the rendered tip within a canonically bounded
lag, refreshes wetness only across the feathered join zone, and lifts on a pause,
deletion, history operation, or line break. IME composition holds the current
stroke without sampling interim text and connects the final committed caret
point back into that stroke. A nearby most-recent drying stroke may likewise
revive within its bounded profile window, preserving its older drying tail while
rewetting only the join. `InkBrushCanvasRenderer` turns those
samples into one variable-width ribbon built from ordered left/right edge
chains. One arc-length multi-stop gradient applies dry tone and late alpha loss
across the complete silhouette, so no cell tiles or rounded stamps become
visible; deterministic bristle paths cross the whole stroke. Fast-input pressure
stays confined to a local bloom, while sample distance and wet time move drying
from tail to tip. A Canvas failure cannot fall back to the retired DOM renderer.

Password/email/tel and autocomplete-identified password, OTP, username,
contact, or payment surfaces remain on abstract placement and do not read caret
or value metadata. The existing input/composition event ingress rechecks current
type and autocomplete tokens before each input beat, including sectioned payment
tokens and textarea autocomplete. A field that becomes sensitive releases its
existing closed caret mirror before further geometry sampling; an ordinary field
can regain precise placement through the same owner. Focus-out releases previously
owned state even after a field becomes disabled, read-only, or a non-text input.
Element cleanup attempts every owned resource and retains failed ownership for a
retry; manager removal finishes sibling cleanup before reporting an aggregate
failure and cannot acknowledge successful removal while an element remains owned.
`caret_mirror_create`, `caret_value_read`, and
`caret_mirror_measure` failures record an `inputVisualBrake` feature error and
use the existing caret-index/style estimate only for rendering. Mirror-create
degradation lasts until that element is released on focus-out; value or measure
failures are retried on a later rendered point, so the estimate cannot become
an undeclared durable source of truth.

### F10. Video skip guard revert and lifecycle failures stay visible

Status: fixed in this pass.

`VideoSkipManager` keeps the prior seek-anchor race fix: `timeupdate` cannot
advance the stable anchor before `seeking` decides whether a user jump should be
blocked. Video discovery includes reachable author shadow roots through
`VideoElementObserver`, while document-level observation still goes through the
shared `ObserverHub`. Manager apply/remove treats shared video observation,
storage, gesture, fullscreen, listener, and indicator ownership as one visible lifecycle:
apply rolls back partial ownership before rethrowing, and remove records
`VIDEO_SKIP_MANAGER_REMOVE_FAILED` instead of emitting `manager_remove` when
cleanup is incomplete. The final storage flush is also part of remove commit:
`manager_remove` is deferred until it resolves, while rejection records
`manager_remove_storage_flush` and leaves the success event absent. Any partial
cleanup failure deactivates manager and gate instead of restoring a hollow
active flag; unresolved ownership remains retryable, and apply rejects with
`VIDEO_SKIP_CLEANUP_RETRY_REQUIRED` until remove finishes that cleanup. A
rejected final flush likewise keeps the repository owner and its diagnostics
callback so a later remove can retry the same canonical pool before success.

Blocked seek reverts now resolve one command-scoped media adapter before
touching playback state. YouTube delegates only through the typed
`VideoSkipMainWorldActuatorTransport` command. The trusted background route
derives tab id, top-frame id, and page URL from `MessageSender`; callers cannot
select or override those targets. `ContentScriptOrchestrator` remains the sole `executeScript` owner and invokes the self-contained
`videoSkipMainWorldActuator.js` executor in one exact MAIN-world frame. That
executor rechecks the current HTTPS YouTube hostname against the sender-derived
hostname before calling `movie_player.seekTo()` or `playVideo()`, returns only a
bounded result, and creates no page-global relay API. Unavailable player methods
fail loudly and never fall through to native `currentTime` or `video.play()`.
Other hosts use the native video adapter. A was-playing revert can perform one
bounded loader recovery seek/play when ready/buffer/network state suggests the
player stopped making load progress after the revert, with one adapter
resolution shared by that seek/play pair. The guard records
`videoSkipGuard` feature errors when adapter seek/play, current-time writes,
pointer block, video listener attach/detach, or debug
media snapshot reads throw. Runtime Debugger's general measurement lease keeps
shared observation counters available without enabling Video Skip's detailed
event trace; only the dedicated `friction_video_skip_debug` page-local flag
enables that trace. Debug media snapshots include `TimeRanges` read failures as
`debug_media_snapshot` diagnostics instead of silently truncating buffered or
seekable context. `videoSkipListenerLedger.js` owns separate behavior-critical
and detailed-diagnostic binding tables, reverse attach rollback, best-effort
detach, and unresolved binding projection. The normal profile attaches 12
listeners per video; an explicitly enabled detailed trace adds 9 diagnostic
listeners. `video_handlers_attached` and
`video_handlers_detached` are emitted only for complete transitions; incomplete
detach stays retryable. Gate-off cleanup also cancels the scheduled revert frame
before clearing timers and the reverting attribute, so a stale callback cannot
issue a later seek/play command. MAIN-world commands are asynchronous: the
transaction becomes accepted only after the typed background response succeeds,
then starts the protection window. A failed command, a command that does not
settle before the separate command timeout, or exhausted native/YouTube position verification records
`revert_aborted`, clears every transaction owner, and cannot emit
`revert_completed` or resume playback as though enforcement succeeded.
`revert_aborted` is emitted through the manager-owned `_recordVideoEvent`
diagnostic helper, which preserves optional debug media enrichment while routing
the event to the canonical `videoSkipGuard` protection diagnostics owner.

`VideoSkipPoolRepository` owns the content-local ordered command queue and read
projection, but not the persistent writer. Every immediate or delayed command
attaches an explicit rejection observer, reports the rejected V1 snapshot to
`VideoSkipManager` as `storage_persist`, and retains retry ownership through a
failed teardown. `VideoSkipPoolWriteTransport` sends the canonical merge command
to the trusted background route. `VideoSkipPoolWriteCoordinator` is the only
owner allowed to call the pool store writer: its single queue performs
read-merge-write and persists only a longer `cooldownUntil`, so simultaneous tab
teardown cannot let a stale context overwrite a longer deadline. The returned
canonical snapshot and storage subscription update each local projection.

`videoSkipMediaAdapter.js` owns hostname-scoped YouTube/native selection and
delegates the selected `seek`/`play` command only. Native writes stay in the
adapter; concrete YouTube page-player calls belong to the self-contained
MAIN-world actuator. Neither layer caches page player identity across timed
commands, because SPA player identity may change between the initial revert and
a later resume. One adapter resolution is reused inside the asynchronous
loader-recovery seek/play pair. The manager retains phases, diagnostics,
verification scheduling, stable/revert anchors, async transaction identity,
cooldown state, and every timer.

`videoSkipEventHandlers.js` owns only construction and judgment dispatch for the
18 runtime video events. `VideoSkipManager` supplies a fail-loud capability port
whose closures resolve the live manager methods at event time, preserving one
state/lifecycle owner and test/runtime instrumentation. The event module retains
no state and cannot attach listeners, change the signal gate, construct storage,
select adapters, directly schedule revert work, or commit video ownership.
Stable-position and progress-sample mutations return through manager-owned port
commands.

`videoSkipGestureContext.js` owns the stateless fullscreen, custom-control,
keyboard, scrub-continuation, and recent-window projections. The manager keeps
the actual gesture timestamp and hold-window state. Generic gestures remain on
the 1.8-second window while media-seek context remains on the separate
3.5-second window. `videoSkipRuntimeDiagnostics.js` owns read-only media,
pool, seek-state, DOM-event, and frame projections plus the canonical
`videoSkipGuard` error recorder. Neither helper owns gate state, storage,
video attachment, stable/revert anchors, timers, or seek/play commands.

`videoSkipControlSurfaceCatalog.js` owns exact control meaning for YouTube, X,
Instagram, TikTok, and Reddit, plus an explicit `native_control_surface` capability profile
for declared Video.js/JW Player/Plyr controls or exact video-linked controls.
An unknown author player without that evidence remains post-seek-only; unrelated sliders
are never inferred to be media controls. `VideoSkipControlSurfaceRuntime.js` projects the
same canonical manager policy onto the resolved player surface without removing
page-owned DOM. The shipped policy is unconditional `hard_block`; legacy
cooldown input is normalized at the settings boundary and the dormant pool does
not unlock the shipped guard. For declared author controls, the played-progress rail stays visible, while
known scrubber handles and preview affordances are hidden. A platform selector
cannot classify an entire timeline container as a concealable handle. Capture-phase pointer, touch,
and classified media-seek keyboard input are blocked only when the composed
event path contains both a declared timeline target and a declared player root
connected to a currently tracked video. This prevents a volume or unrelated
page slider from becoming an accidental control target. Timeline hover is not
a visual-effect input. Idle pointermove/mousemove exits before
player/timeline ownership reconciliation; shared mutations and policy updates
already maintain that projection. Pressed drag movement still receives capture
blocking. The admitted rail remains pointer-hit-testable so its
restrained-seek cursor appears on hover and capture listeners receive blocked
attempts. Do not apply `pointer-events: none` to the rail; only hidden handles
and previews lose pointer hit testing. A pointer block carries the exact tracked video resolved
from that player root, and only an admitted blocked input or blocked seek may
bind and pulse the transient indicator frame. Allowed ad, small-delta,
unattributed, disconnected, and untracked-player seeks do not pulse it. When the
bound video disconnects or loses renderable geometry, the indicator releases
the target and its animation frame instead of retaining a hidden mini-player.

`src/domains/nudge/indicator/view.js` owns ordinary content feedback. An enabled
indicator exposes one compact edge status with owner-projected usage and a direct
Sites link; it has no hover information box. Missing usage is loading/unavailable,
never synthesized as zero. Its existing drag/settings ownership is preserved.
Admitted blocked video and short-form attempts share one 1.6-second factual reason
at the viewport edge, including when the persistent indicator is OFF. Repeated
attempts extend one burst without repeating its live announcement. Producers
retain enforcement and diagnostics; the view owns no protection decision.
The existing inward frame pulse follows only the exact bound video.

The runtime consumes `VideoElementObserver` delivery through manager-owned
video attach/detach calls. The manager also supplies its existing
`subscribeMediaMutations` seam: one runtime lease receives the shared document
and reachable-shadow added/removed-node and relevant attribute batches. It creates no feature-local observer
or polling lifetime. Added roots are deduplicated, then queried only where they
intersect a tracked player's timeline scope; when an added ancestor contains a
tracked scope, only that scope is queried. Unrelated page subtrees are not
scanned for controls. Initial attachment uses the same bounded player scope.
Removed targets are pruned from the existing target ledger. This keeps controls
inserted after the video locked without another document or shadow observation
owner. Teardown releases only this runtime's mutation subscription, preserving
other shared consumers; release failures are reported and remain retryable.
The runtime installs static CSS once in the document and once per reachable
author shadow root that contains a tracked video. Removing the final video
releases its shadow style and timeline scope.
Each attach records a content-free projection receipt with the profile id, root
kind, and whether the declared player root matched, so selector drift is a
diagnosable state rather than an implicit generic-player fallback.
Browser-native video controls use a separate, explicit platform projection. Each
tracked video receives an owned attribute and only its
`::-webkit-media-controls-timeline` is locked under the active document policy.
Chromium native slider input can remain wholly inside the UA event path, including
keyboard events; capture listeners and a longer gesture window cannot fix that.
The native timeline alone uses `display: none`; play, volume, captions, time
labels and fullscreen retain native ownership. A visible inert rail is deliberately
not used: its clicks fall through to native video play/pause or double-click
fullscreen behavior. No coordinate heuristic or whole-video input suppression
compensates for that ambiguity. The owner is `VideoSkipControlSurfaceRuntime`,
and the diagnostics are `nativeTimelineProjection: chromium_hidden_timeline`
plus per-video `nativeTimelineLockProjected`.
Removing the owner, disabling policy or removing `controls` releases the projection.
No UA shadow traversal, internal DOM mutation, extra observer or replacement panel
is introduced. Native CSS prevention does not prove a blocked attempt was observed
and therefore does not fabricate blocked counters or attempted-action feedback. The named
native QA target and lifecycle/ownership tests protect this platform seam.

The seek transaction remains the defense for observed or bounded blocked-seek
follow-up paths. Absence of a recent input is `seek_allowed_unattributed` with
`input_origin_unobserved`, never proof of a programmatic seek. Its nested
`seekingEvent` records attribution and native projection within the existing bounded
diagnostic budget. Known ad transitions retain explicit exemption. Programmatic
source/resume behavior is not indiscriminately blocked to compensate for hidden
input. Closed author roots are reachable only where the explicit Chrome DOM
capability exists. Arbitrary UA internals, canvas controls, and child-frame seek
controls remain unsupported projection boundaries.
Reachable author roots own capture listeners as well as styles, so closed-root
event retargeting cannot hide the actual control path from that root's listener.
Duplicate delivery across window/root capture is ignored. Root migration updates
both style and listener ownership; a different document is rejected even for a
shadow-root video. Controls in an independent shadow tree require an explicit
association and are not inferred from proximity.
`VideoSkipManager` retains policy resolution, lifecycle, cooldown deadline,
diagnostics, video ownership, and teardown ownership.

`VideoElementObserver` now multiplexes all top-document consumers through one
`ObserverHub` lease and one observer per reachable author shadow root. Its live
registry replays existing videos to later consumers and emits removal only
after the element is disconnected, so SPA reparenting does not churn handlers.
If one consumer rejects delivery, later consumers still run and only that exact
consumer/video pair retries at 50/250/1000 ms; unsubscribe or video removal
cancels its retry timer. Pending or exhausted pairs cannot restart through a
reconcile call, and `VideoSkipManager` no longer attaches directly from registry
snapshots, leaving subscriber delivery as the single consumption route.
`BehaviorHub` leases that media observation only for precision telemetry, while
`VideoSkipManager` consumes the same registry continuously. Late-player recovery
is canonical subscriber delivery; the manager owns no parallel delayed DOM
reconcile schedule. The video facade also
dispatches video-skip and short-form lifecycle changes independently; changing
one feature no longer reapplies the other. The retired status-indicator
playback-rate callback was removed because the view never invoked it, so it
cannot remain as a second undeclared media actuator.

Top-frame media diagnostics now consume that same registry through
`TopFrameMediaDiagnosticsReporter`; the classic `mediaFrameProbe` exits without
installing an observer in the top frame. Child frames, where the module content
runtime and its canonical registry do not run, perform one initial inventory
and then update a cached live-video set only from added/removed subtrees. New
reachable author shadow roots receive local observers that are disconnected with detached
hosts. A mutation report reads the cached count and cannot restart a document
scan. The background ledger derives `topFrame`/`frameKind` from sender frame
identity and rejects a mismatched observation mode.
The iframe probe state is versioned and exposes teardown so later reinjection
can replace its observer/listener ownership. A probe loaded before that teardown
contract cannot be retired in place; reinjection marks it `upgradeBlocked` and
waits for navigation/reload instead of layering another probe.

### F11. Short-form pruning has explicit platform modes and honest success

Status: fixed in this pass.

`ShortFormBlockManager` keeps lifecycle and actuation ownership under the video
manager facade. Generic DOM targeting lives in `shortFormTargetResolver.js`,
while YouTube and TikTok classification live in
`short-form/platforms/youtubeShortFormResolver.js` and
`short-form/platforms/tiktokShortFormResolver.js`; these resolvers return frozen
action intents and never mutate DOM or own listeners, timers, or diagnostics.
Platform removal behavior remains explicit on each short-form rule:
YouTube declares `remove`, while Instagram, Facebook, and TikTok declare `hide` to avoid
physically removing React-owned feed cards. Facebook uses same-host `/reel` and
`/reels` route/link evidence and does not depend on volatile generated classes
or a global `Reels`/`릴스` text scan. TikTok uses `/explore` as its safe route,
removes For You/Following navigation, and delegates the single-video
selected-versus-follow-up classification to `tiktokShortFormResolver.js`; it does
not change Feed Flow. The manager no longer defaults missing
`pruneMode` to remove. Selector, closest/querySelector/querySelectorAll,
redirect, hide/remove, notice, and hidden-style
cleanup failures record `shortFormBlock` feature errors, and `target_pruned` is
recorded only after a target was actually hidden or removed. Manager
apply/remove now treats URL listeners, URL polling, the shared observer,
notices, hidden-target restoration, hidden-style cleanup, and the root marker as
one visible lifecycle; `manager_apply`/`manager_remove` are recorded only after
those ownership transitions succeed. Platform-specific selector helpers use the
same diagnostic/fail-closed seam, so broken YouTube or Instagram DOM selector
contracts cannot masquerade as empty scans.

Unsupported-host admission completes the enabled lifecycle without acquiring
listeners, polling, or an observer lease. The initial refresh still removes the
root marker and records `rule_missing_for_host`; repeated ON is deduplicated,
and OFF/reapply retains the same diagnostic and retryable cleanup contract.
Supported hosts retain their existing URL polling, including while hidden.

YouTube label changes use the same shared subscription (`characterData`, text
child additions/removals, and the existing title/aria-label/tab-title/href
attributes). `youtubeShortFormResolver.js` owns admission to local label scopes;
ordinary card text is not a reason to rescan its shelf. The platform resolver
emits a channel-tab restore only with the expected `youtube_shorts_channel_tab`
prune reason. `ShortFormBlockManager` owns the weak effect-reason record and
checks that condition before restoring. It records successful hide/revalidation,
deletes on restoration, and resets after successful OFF restoration. The map is
actuation provenance, not a semantic cache or a new discovery index. Positive
intents for the same target suppress negative intents within that resolution
batch. Failed selector reads retain the existing effect. Filter chips retain
their existing restoration semantics and guide entries their remove mode.

YouTube horizontal shelf slot membership uses the same childList subscription.
`youtubeShortFormResolver.js` admits additions/removals of direct Elements in
the exact `#items` selected by the shelf classifier, even when the changed slot
has no known media evidence. Ancestor shelves sharing that selected list are
included; `shortFormTargetResolver.js` collapses their roots within the batch.
This lets unknown additions restore a shelf and final unknown removals requalify
it without admitting ordinary metadata or Text/comment-only slot churn. The
resolver retains no persistent cache and changes no listener or actuation
ownership. Structural selector failures use the existing diagnostic seam and
do not revoke an effect from an unreadable result.

### F12. Feed Horizon is a common boundary with one admitted purpose

Status: fixed in this pass.

`FeedFlowRuntime` owns factual boundary observation and endpoint readiness/safety;
`FeedBoundaryEpisodeCoordinator` combines periodic cadence or explicit goal
demand with local admission and episode ownership. Its single consumer and
Terminus instance serve periodic Enso or Site/Global Furin; the Enso module is
a thin re-export. The selector-free supply probe measures availability and
structure, and cannot create a consumption boundary.
A bounded, content-free
`FeedStructureLearner` publishes `pending`, `warming`, `ready`, `volatile`, or
`invalid`; an unknown or unstable structure stays observe-only. The safety
judge also requires an allowlisted profile/mode endpoint adapter, sufficient
decision confidence, and a connected candidate anchor. The manager therefore
arms Terminus only after the purpose-specific admission agrees with
advance-only `opportunityReady`, readiness and safety. Periodic work additionally
requires its due receipt, source permit and local Enso grace. Goal demand never
rewrites that receipt or steals an existing ordinary owner. It supplies DOM-bearing actuation
context through a content-local getter that never enters the trigger bridge or
persistence.

`FeedTerminusStageMachine` consumes opportunity plus admission/readiness/safety and owns only
episode-local still-gate escalation. Missing admission, not-ready, and unsafe states stay
idle, so FeedFlow candidate states cannot become a second presentation judge.
`feedEndpointAdapterCatalog` keeps unknown/generic structures observe-only and
names the exact X/Instagram/Facebook/YouTube Home plus TikTok/Reels/Shorts
semantic-surface/profile/mode tuple and topology;
`FeedEndpointBoundaryResolver` requires stable lane/anchor/scroller geometry;
the shared declared-topology inspection treats an omitted paged
`activeScroller` as no competing evidence and retains the exact resolved
catalog scroller, while any explicitly observed different scroller fails
closed in both the early probe and final resolver;
and `FeedEndpointLease` commits bounded in-place future-branch isolation, the
site-painted tail layout, and the scroller's exact forward boundary as one atomic owner. The late
exact endpoint-lease commit preserves that episode across readiness/safety recession
caused by its own supply isolation; explicit lease invalidation still aborts through
`onEpisodeFailure`. Actual forward-boundary contact commits the periodic spawn
permit or acknowledges goal boundary occupancy on the same goal lease.
The invisible renewed-demand capture surface mounts only inside that tail and
must not render a parallel question, hint, or leave action. Resolve/commit/invalidation
failures remain diagnostic and never fall back to a fixed viewport veil,
another site's adapter, or content-side network interception. Release restores
the original sibling order only through the exact purpose-owned outcome/cleanup contract; if canonical
continue/retreat acknowledgement fails, the episode remains diagnosable rather
than reporting false resolution. The retired `InfiniteScrollManager`, Barrier
child, and background `INFINITE_SCROLL_DETECTED` strategy path are not
compatibility seams and must not be reintroduced.

### F13. Runtime debugger failures stay inside the shared debugger seam

Status: fixed in this pass.

`RuntimeDebuggerRuntime` remains the only shared observer/social/effect,
protection-runtime, video-skip, feed-flow, and Sentinel protocol debug shell.
Its v2 session captures a sanitized baseline and latest snapshot, stores only
bounded numeric change samples and operation events, and derives every item or
full report from that same evidence. Producer-owned ObserverHub, Social Metrics,
Visual, Text, Short-form, and Video counters are not reset by session start or
“new baseline.” The debugger-owned FeedFlow semantic ledger is reset at that
boundary so retained action matching cannot cross sessions, while its public
alias remains a no-op. Probe states explicitly distinguish inactive, unavailable,
armed-idle, insufficient, broken, and measured; `0/0` is never an efficiency
result. If a lazy owner such as Social Metrics loads after the baseline, the
generic classifier first reports `insufficient / baseline_coverage_missing`,
then canonical targeting-health projection exposes the probe as strict
`broken / targeting_health_probe_contract_invalid`. The real-site runner owns a
single bounded diagnostic rebaseline only for that exact transition and only
after every physical pending field and other required owner settles. General
broken/unavailable owner states and a failed re-settle remain fail-loud; an owner
snapshot failure reports unavailable instead of pretending the effect was
canonically inactive. A protection
`runtimeDebuggerEnabled` force-open acquires only an in-memory friction-debug
lease. Turning that protection setting off calls the debugger-owned
`releaseForcedArm()` seam so the lease cannot keep itself alive as a false
global-debug signal; closing a forced capture or tearing down the debugger also
releases it immediately. It does not persist another debug setting. Page overlays
read Sentinel protocol history only through the sender-tab-scoped debug action;
the full Sentinel protocol timeline remains an extension-page lab/dashboard
read. Overlay mount
failures now leave the debugger unarmed with an explicit internal error. Session
sampling, copy/export, render, reload-observe, terminus dry-run, Sentinel probe,
and cleanup failures are recorded in a bounded debugger error ledger that is
included in the copied `entropy.runtimeDebugger` payload and shown on the
existing log tab. Raw JSON and per-item logs retain bounded baseline/latest,
counter delta, event, and debugger-error evidence. Item summaries are compact
projections of validity, canonical counters, bounded recent events, and
domain-specific context; full reports are cross-probe summaries and do not
duplicate the raw session payload. Overview/log tabs disable item export instead
of silently widening to the full session. Counter delta excludes gauges, ratios,
averages, maxima, and timestamps, admits explicitly named counters that appear
after the reload baseline, and reports sample/event ring truncation. When a
producer operation counter advances farther than its bounded recent-operation
tail, the session records an `evidenceGap` and marks event retention incomplete;
events unavailable at the producer are kept distinct from events later evicted
by the debugger session ring. Click Gate and Video Skip keep their domain-specific
narratives in the same compact v2 item report.

The dev-only Runtime Contention Timeline remains the scheduler/Worker decision
instrument for rollout expansion. Production scheduling is owned separately by
the platform cooperative scheduler: full protection activation yields between
effect owners, Visual initial/mutation reconciliation yields at canonical 3ms
JavaScript/DOM-write boundaries, and Text mutation ingress yields before handing
off to its existing idle apply cursor. Scroll physics stays synchronous inside its
`requestAnimationFrame`; its frame opportunity improves because competing entry
work returns control. The contention timeline itself does not schedule product
work and does not observe or scan the DOM. While a Runtime Debugger session is
active, existing owners publish
only monotonic scalar spans: the physics-scroll owner records each controller
rAF interval, wheel-input-to-first-frame latency, and callback work,
`ObserverHub` records a flush plus exact
subscriber callback subspans; Social Metrics, Text Shuffle, Visual Media, and
Short-form record their already-owned candidate/chunk/filter/prune work; and
Interaction, Input Delay, Input Visual Brake, and FeedFlow record only their
already-entered synchronous event callback work. A supported browser
`longtask` observer supplies independent main-thread stalls. The trusted QA
relay may additionally request one validated, at-most-30-second action window
on the same document `performance.now()` clock. The ledger clips retained Scroll
Physics and producer-owner spans to that window and reports their interval union,
per-owner non-additive coverage, long-task overlap, and retention proof.
ObserverHub subscriber spans now measure only payload ingress for Visual/Text;
their deferred owner spans are recorded separately and still count once in the
interval union. The QA runner compares that union with CDP renderer task/script/
layout/style deltas; the difference is named renderer residual because it still
combines page work, browser work, and Entropy owners that have not published a
span. It is never labeled page-owned cost without a stronger trace.
The same trusted-action renderer window is collected in the public release and
extension-disabled control without loading Runtime Debugger. Their median
difference is the shipping Entropy observation; the diagnostic owner union is
explanatory evidence rather than a substitute for that control. A page-side
isolated-world `long-animation-frame` observer associates 50 ms-plus frames and
blocking duration with those windows. It persists only source buckets
(`entropy_extension`, `page`, `third_party`, `unknown`), never raw script URLs,
and fails to an explicit unavailable state when the API is unsupported.
Each frame additionally keeps at most 64 sanitized script timing spans with only
the same source bucket, monotonic execution interval, and forced style/layout
duration. The diagnostic action window keeps at most 384 scalar owner and nested
ObserverHub-subscriber spans. The QA analyzer intersects those two bounded
timelines with the LoAF interval and its `styleAndLayoutStart` tail, reporting
same-frame owner overlap, style/layout-phase overlap, and extension-script/owner
overlap separately. Any retention or timing-shape gap makes that correlation
incomplete; even complete overlap remains correlation evidence rather than a
causal or invalidation-owner verdict.
The real-feed QA route also owns strict `combined`, `scroll`, `visual`, and
`text` feature profiles. Each isolated profile keeps the same trusted action
contract and receives its own repeat-matched extension-disabled control, so
browser style/layout work induced by one effect can be separated without
mislabeling nested diagnostic owner spans as additive CPU time.
The bounded ledger
derives a refresh-rate-relative late-frame threshold from retained scroll
intervals, classifies both delayed animation frames and delayed input-first
frames, and reports which spans overlap the wait window before each worst frame.
That overlap is explicitly correlation evidence, never a causal verdict.
All rings report retention loss, no DOM node is retained, no extra DOM read is
performed, setup/record/snapshot/observer-callback overhead stays separate, and
the public alias contains only inert functions. Scheduler admission, task
priority, chunk-size changes, or Worker transfer are allowed only after repeated
representative captures show a stable owner/phase concentration; unattributed
late frames remain evidence to widen measurement, not permission to move DOM
work off-thread speculatively.

The Feed tab reads `EnsoRuntimeEpisodeManager`'s content-free episode snapshot
beside FeedFlow sensing evidence, so a withheld Horizon names the exact
admission blockers instead of being inferred from semantic `interrupt`. Its
Terminus dry-run satisfies the current controller with an explicit debug-only
admission and horizon-engagement acknowledgement, then resolves on renewed
demand or retreat without calling the production Enso gate.
The separate dev-only full-chain inspection action remains fail-closed on real
FeedFlow readiness, actuation safety, and allowlisted endpoint capability. It
bypasses automatic waiting using an exact `manual:true` shared reservation; the
owned episode then uses the production manager, endpoint lease, and renewed-demand
threshold. Its default `production` handoff continues through
`InteractionManager.requestEnsoGate` and Enso outcome callbacks. An explicit,
bounded `feedback_only` handoff may override only the still-gate duration and
replace that final Enso request with dev-only on-page feedback.
An open dev inspection explicitly demands supply/topology observation on the
existing visible-document beat, including warmup before ARM; it does not enable
research collection or change cadence. Stopping the session releases this demand.
Stopping inspection or resolving its episode removes manual state and feedback;
production interval state is preserved. Old live-research commands explicitly
reject with `RUNTIME_DEBUGGER_FEED_RESEARCH_OFFLINE_ONLY`.

`RuntimeDebuggerShortFormOracle` is a dev-only probe inside that same shell, not
a new diagnostic owner. It subscribes to the shared `ObserverHub`, records a
bounded 1,024-opportunity node-identity ledger, and recognizes Short-form
opportunities through
URL-path, structural, and transient exact-label evidence without retaining page
text or raw links. A target is causally proven only by Entropy's hidden marker
or a Short-form-owned WeakMap tuple on the exact owner target which matches the
retained owner operation's generation, operation id, flush id, and delivery
sequence. When the owner removes a shelf, a child opportunity may use that
tuple only while its retained DOM parent chain reaches the recorded shelf and
the owner tuple says `mode=remove`; a sibling or unrelated target from the same
flush remains unproven. Lineage reads are bounded to 32 ancestors and are only
performed for removal/reconciliation candidates, plus one exact-target read
when first capturing a marker-backed operation. The WeakMap is an opaque,
non-enumerable correlation index, not a session/store/report owner; its public
build alias is a stateless no-op. No
opportunity is `armed_idle`; all causally proven terminal effects are
`measured`; a settled visible opportunity is `broken`; an unproven terminal or
capacity/query/operation-contract evidence gap is `insufficient`; repeated
observations beyond the bound cannot be interpreted as completeness. Its probe
and snapshot time remain debugger
overhead, and the public alias/build continues to exclude the entire debugger
surface.
A failed reload-observe attempt removes its `reload` capture marker so a later live
session cannot be mislabeled. Standard Social Metrics audit performs no selector-by-selector
requery; explicit deep audit is bounded, reports its own overhead, and is
released back to standard when the page session closes. A failed sampling tick pauses the debugger session instead of
repeatedly throwing through the interval, but no secondary diagnostic store,
mirror, or overlay is introduced.

`RuntimeDebuggerOverlay` is the only page-local presentation owner. Its Shadow
DOM style uses a restrained paper/ink/sage Zen default through private
`--entropy-runtime-debugger-*` override tokens, so a deliberate host override is
possible without importing a theme plugin or inheriting generic page
`--color-*` variables. The overlay keeps UI copy separate from monospaced
evidence, exposes the active capture/validity state before the detail body, and
keeps item logs, item summaries, the full report, and raw JSON as explicit
actions. Tabs implement the ARIA tab contract and Left/Right/Home/End keyboard
navigation; Escape ends the current observation. Reduced-motion and forced-color
modes remain usable. Backdrop blur is forbidden because the debugger must not
add an avoidable compositor cost to the page whose runtime cost it is measuring.
The overlay host holds a module-local media-observation exclusion lease, so its
periodic Shadow DOM render cannot create VideoElementObserver work attributed to
the product page, and a page-authored DOM attribute cannot claim that exclusion.

`RuntimeDebuggerMeasurementGuide` owns one strict recipe for every visible tab:
activation/precondition, baseline choice, representative stimulus, valid capture
signals, and interpretation cautions. The Social guide separates product-cost
standard audit from selector-level deep-audit overhead; Click separates real
routing decisions from debug Enso force-spawn; Feed separates passive supply
measurement from DOM-bearing Terminus dry-run; Sentinel separates debug launch
connectivity from production admission. The overlay's hint disclosure is local
render state only, updates with the active tab, and is never persisted or added
to the sampled evidence. Escape closes the hint before it can end the current
observation session. Adding a tab without a matching recipe fails the guide
contract rather than showing a generic fallback.

### F14. Signal-gate cleanup failures are no longer console-only

Status: fixed in this pass.

`BehaviorHub` still emits gated behavior signals only after
`ProtectionSignalGate` says the owning feature is enabled, so behavior signals
cannot reopen a disabled protection feature. When a gate turns off,
`ProtectionSignalGate.setFeatureEnabled` continues running all registered
cleanup hooks, but hook exceptions now record the owning feature diagnostic with
`phase: signal_gate_cleanup` instead of only warning to the console. This keeps
in-flight cleanup centralized without adding manager-local signal flags or a
second diagnostics store.

### F15. Keyed effect diagnostics now track successful owner transitions

Status: fixed in this pass.

`createDiagnosticKeyedEffect` used to advance its dedup signature and record
mount/unmount diagnostics before the underlying manager step succeeded. A thrown
mount could therefore look mounted in diagnostics, while a thrown unmount could
leave the wrapper signature inactive and block a normal retry. The wrapper now
records successful mount/unmount diagnostics only after the owner call returns,
restores the previous signature on failure, records the feature error, and keeps
the failed transition retryable. Lazy video/short-form/infinite-scroll manager
mounts are not reported as active until the lazy owner step resolves; lazy load
or method failures restore the signature, record the owning feature diagnostic,
and reject back to the caller warning boundary. `ProtectionStateApplier` now
attaches named async warning handlers for keyed effects as well as global
effects, so a lazy keyed manager failure cannot look like a successful content
effect application. Global effect warnings include the global owner label
instead of an anonymous `Global Effect Error`.

### F16. Activation filters no longer fall back to compiled `isActive`

Status: fixed in this pass.

The background compiler emits both `activation.features` and
`compiledFeatures` for the same feature catalog. Content runtime now preserves
that split: `resolveActivationPlan` rejects empty or unknown compiled feature
payloads, and `buildFiltersToApply` only treats a compiled feature as active
when the matching activation entry explicitly enables it. A compiled entry
without activation truth is carried as inactive instead of using its own
`isActive` flag as a fallback source of runtime truth.

Envelope validation now rejects uncataloged activation, compiled, revision, and
patch remove keys before `ProtectionStateApplier` can merge them into runtime
state. It also rejects scalar feature payloads and malformed feature revision
values; if a direct caller reaches `buildFiltersToApply` with an uncataloged key
or scalar compiled entry, the function throws instead of producing a runtime
config. `buildActiveFilterContext` follows the same rule: malformed filter maps
or entries throw, and falsy but explicit values such as `0` stay visible in the
context token instead of collapsing to the generic `on` label.

### F17. Background compiler emits catalog-aligned stable envelope maps

Status: fixed in this pass.

`EnvelopeAdapter` and `ProtectionPolicyCompiler` now have test coverage that
locks activation and compiled feature maps to the same content-runtime
`PROTECTION_FEATURE_CATALOG`. Dormant or extension-context settings such as
`audioDulling` remain outside content envelopes even if they appear in default
filter settings. Feature hashes are also stable across nested object key order,
so equivalent compiled configs do not create unnecessary patch upserts simply
because a nested value object was assembled in a different order.

### F18. Patch delta no longer depends only on feature hashes

Status: fixed in this pass.

`buildProtectionEnvelope` previously discovered patch keys from
`featureHashes` alone. If a previous or next state was missing hash metadata,
compiled feature changes or removals could be treated as a no-op even though
the activation/compiled payload maps had changed. Patch delta now builds its key
set from activation entries, compiled entries, and hashes together. If hashes
are missing, compiled payloads are compared directly with stable key ordering,
so changed and removed features still produce upserts/removes while object key
order alone does not create patch churn.

### F19. Content runtime diagnostics cannot masquerade as empty

Status: fixed in this pass.

`ContentScriptOrchestrator.getDiagnosticsSnapshot` now requires the canonical
`ContentRuntimeDiagnostics` store. If the store is not wired, the trusted debug
route returns `CONTENT_RUNTIME_DIAGNOSTICS_REQUIRED` instead of a successful
snapshot with empty events. This keeps bootstrap, dispatch, managed-sync, and
catch-up failures diagnosable instead of letting a missing diagnostics seam look
like a quiet runtime.

### F20. Audio-dulling action lookup was removed from public tracking actions

Status: fixed in this pass.

`audioDulling` has a trusted human-only dev QA route, but release sender policy
does not register its capture actions. The tracking runtime action handler no
longer contains the old tab-candidate lookup chain or receives audio capture
dependencies from the background kernel. Public promotion requires a fresh
explicit action seam instead of accidentally leaning on dev QA or dormant
lookup fallbacks. The public dispatcher, eager app binding, and protection runtime
bindings expose no capture methods, and the public artifact guard rejects the
offscreen/capture closure if it is reintroduced.

### F21. Dispatcher side-read failures now leave diagnostics

Status: fixed in this pass.

`ProtectionDispatcher` no longer hides failed friction bootstrap refreshes,
nudge runtime-language candidate reads, dispatch permission lookups, or
foreground-tab checks behind empty catches. These side reads remain bounded and
non-authoritative, but failures now record
`friction_bootstrap_refresh_failed`,
`nudge_runtime_language_store_read_failed`, or
`nudge_runtime_ui_language_read_failed` in the existing content runtime
diagnostics ledger. Permission lookup failures also record
`dispatch_scripting_permission_lookup_failed` or
`dispatch_host_permission_lookup_failed`, and receiver-missing diagnostics carry
the permission lookup error fields instead of reducing them to `unknown`.
Foreground-tab lookup failures record `nudge_foreground_tab_lookup_failed`
before the nudge flow keeps the existing `background_tab` skip result.

### F22. Direct selector owners replaced stale target markers

Status: fixed in this pass.

Text Rhythm's blur/opacity/spacing projection is CSS-selector driven, its internal
shuffle owner owns the bounded direct traversal, and media blur owns candidate/context inference plus direct
inline-filter reconciliation. The retired `nudge/core/targets` marker registry,
its visual/video target attributes, and the uncalled `TextTargetRegistry` no
longer run full-document marking scans or attach duplicate observers. Invalid
media candidate/context/overlay selectors still record `visualManager`
diagnostics and fail closed. Invalid text target/exclusion selectors record
`textPipeline` diagnostics and do not widen a valid zero-match selector to the
whole body. Visual manager observer installation and release failures retain
named lifecycle phases; partial `update` state is rolled back, and failed
`remove` remains retryable instead of looking like a clean visual teardown.

### F23. Feed-flow explicit selector failures no longer look like generic discovery

Status: fixed in this pass.

Feed surface classification, fresh item discovery, and dominant-item transition
scans now share the `infiniteScrollGuard` diagnostic seam for selector
exceptions. Invalid explicit feed selectors fail closed and record the failing
phase (`generic_surface_query_selector`, `feed_item_discovery_query_selector`,
`feed_item_discovery_match_selector`, `feed_flow_query_selector`, or
`feed_flow_closest_selector`) instead of falling back to generic repeated-card
or dominant-item guessing. Feed input activity classification reports
`feed_input_closest_selector` failures through the same seam when browser
selector evaluation fails. This preserves generic discovery for unknown hosts
while making broken configured selectors visible as configuration/runtime
failures.

### F24. Text shuffle direct selector failures no longer widen to body scope

Status: fixed in this pass.

`textShuffleTargetResolver.js` owns the direct Text Shuffle selector boundary,
while `TextShuffleManager` owns lifecycle and actuation. Its selector guards
must not translate invalid selectors into
empty scans and then fall back to `document.body`. Text shuffle target,
overlay-exemption, and exclusion selector failures now record `textPipeline`
diagnostics with the failing operation. When root collection fails because a
configured selector cannot be evaluated, the resolver returns no roots instead of
broadening to the whole body. Overlay and exclusion selector failures fail closed
for mutation, so broken site-specific selectors cannot make text corruption
escape its declared target boundary.

Attribute-driven ownership revalidation now consumes the ledger's lazy
`iterateMutationRevalidation` cursor. It walks only the affected subtree's
elements and exact-parent index, independently of the public shuffle marker;
child-list inputs keep the ancestor target-owner lookup. Empty visits and
indexed text both consume the existing cooperative ingress slice budget.
Batch deduplication stays in the ledger and generation/restore actuation stays
in the manager. The mutation queue is unchanged. Marker loss cannot prevent
ancestor exemption or target-membership revocation from restoring owned text.
This does not change removed-subtree collection or broaden observer interest.

Host text rewrites (2026-09-17): initial scans and newly discovered content keep
their debounce/idle admission. A batch that changes an already-owned text value,
or removes owned text while adding replacement content, can flush one bounded
mutation-queue chunk within the existing cooperative ingress continuation. It
checks the current generation, revalidates live eligibility, cancels the superseded
debounce/idle handle, and shares the remaining ingress time budget plus the queue's
existing visit/success limits. Remaining work retains its idle-admitted cursor;
there is no additional observer, hover listener, full-document scan, or prepaint
guarantee. This removes the extra 120ms debounce and idle wait for small rewrites.
An exact rewrite of the same original value reuses the ledger's stored shuffled
value without releasing its markers. Different source text is still adopted as
the new canonical value and restored on disable. Attribute-only changes that
retain eligibility never restore text. Coverage:
`tests/textShuffleHoverRewrite.test.js` uses native jsdom MutationObserver delivery
through ObserverHub and the YouTube target profile, holds idle callbacks back,
and exercises repeated source writes, node/subtree replacements, exemption,
disable, and bounded repair of a large batch.

### F25. BehaviorHub feed-item sensing no longer throws on selector syntax

Status: fixed in this pass.

`BehaviorHub` owns local behavior signals and optional feed-item sensing used for
CLSE content metadata. The mutation lease, initial feed seed, and added-subtree
selector scan exist only while precision insights are allowed and a content
CLSE reporter reports active collection demand; either OFF transition releases
the lease and its selector/seen state. A broken
`feedObservationItemTargets` selector from the Behavior-owned target profile
should not be converted into generic feed guessing, but it also should not kill
unrelated wheel, scroll, video, and subscriber behavior signals. Feed seed and mutation
scans now evaluate feed selectors through a small diagnostic seam. Selector
syntax failures record `behaviorHub` errors with the operation
(`feed_seed_query`, `feed_item_match`, or `feed_mutation_query`) and skip that
feed-item sensing pass.

Behavior mutation discovery (2026-09-19) collapses connected overlapping added
Elements by current light-DOM ancestry before querying. The receipt retains the
original added-node count; detached roots cannot enter the node-novelty WeakSet.
The existing epoch-local WeakSet, demand gates and seed semantics remain owned
by BehaviorHub. Seed and subtree query results reuse synchronous selector
membership while retaining MAIN/role=main exclusion. Selector failure diagnostics
remain at root matching and query boundaries. This adds no observer, persistent
root index or content-identity authority; tests live in
`tests/behaviorHubLifecycle.test.js`.

### F26. Social metrics candidate selector failures no longer look like empty scans

Status: fixed in this pass.

Social metrics hiding is an actuator: if the configured selector plan cannot be
evaluated during initial activation, the manager must not appear active with an
empty candidate set. Candidate collection now records
`candidate_selector_query` or `candidate_semantic_query` before the update
rollback path runs. Mutation-driven rescans are bounded sidecar work after the
feature is already active; those scan failures record `scan_collect_failed` and
abort the queued scan without changing activation truth or guessing alternate
selectors.

Facebook photo reply labels also declare the observed plain-wrapper owner in
`facebookProfile.js`: the photo panel is `[role="main"] +
[role="complementary"]`, and its comment section directly owns an
`h2[dir="auto"]` whose normalized native text is exactly `댓글`.
The native `div > h2[dir="auto"] ~ div` relation declares only that section's
following thread subtrees. They can admit the native
`[role="button"] > span > span[dir="auto"]` leaf, and the closest thread's parent
must retain that direct heading. The classifier and apply owner require zero
element children and prove the exact reply scope independently of the
complementary action-leaf candidate selector. Nested unrelated headings, prose outside the comment
section, other complementary panels and pagination summaries are not evidence.
The existing article-sibling declaration remains its own supported shape.
The exact `답글 count개 보기` classifier removes only the quantity through the
existing per-manager reply-label owner; native controls, icons and handlers stay
intact. The existing scan and mutation-root plans consume these declarations,
without another observer or generic scan. Host rewrites remain the exact restore
source, the existing mutation-root seam sends a changed photo section heading's
local parent for ownership revalidation even after `dir="auto"` is revoked.
A changed node immediately preceding a complementary panel sends that exact
following panel through the same bounded seam, so loss of the adjacent main role
also revokes owned replies; the classifier remains the activation authority.
Feedback OFF restores the projection.
Coverage: `tests/socialMetricsFacebookReplyLabel.test.js`.

### F27. Selector plans and mutation delivery are bounded by owner

Status: fixed in this pass.

`resolveSiteId()` resolves hostname aliases once through the selector-free
site identity catalog. `createTargetProfileResolver()` validates each owner's
schema and merge-policy coverage, returns a deeply frozen owner profile, and
exposes `generic` versus `domain_exception` provenance plus exception keys.
Behavior, interaction, text, visual media, and Social Metrics compile separate
target declarations; a field owned by one is not a fallback for another.
Feed-surface routing keeps its candidate/dominant item semantics in
`feedSurfaceProfiles.js` while consuming the same canonical site id, so aliases
such as `youtu.be` cannot drift between profile owners.

`ObserverHub` still owns one merged browser observer, but canonicalized option
plans share a single-pass payload projection, an enqueue-time kind mask avoids a
second flush-wide kind scan, kind-disjoint plans skip the batch, and an aggregate
payload exists only while perf measurement is active. Queue wait, attribute-only/
child-only/mixed/tiny flush shapes, attribute-name counts, debug bookkeeping, and
snapshot-read overhead stay explicit beside subscriber callback work. Each
subscriber receives only its requested subtree scope, mutation types, and
attribute names; perf mode no longer performs a second periodic console snapshot.
BehaviorHub does not subscribe at all without a live precision/CLSE mutation
consumer; Feed Flow keeps its independent semantic subscription without
inheriting BehaviorHub feed-selector work. Feed Flow refreshes route identity
before mutation dispatch and does not run generic item discovery on a document
surface such as YouTube Watch.
Media selector plans derive the attribute observation set once, then preserve
subtree discovery only for context-sensitive attributes and reject self-only
container changes before selector work. Relevant sibling roots reconcile in one
batch, the next-target union prevents a nested dirty root from causing an effect
cancel/create pair, and each accepted target owns one zero-duration filling
additive Web Animation filter effect. Additive support is verified once per
document instead of inspecting every target effect. The animation composes after the host filter without
writing the target's inline style, so host style changes remain the live
underlying value and cannot strip the Entropy effect or trigger base-filter
recalculation. Reconciliation updates an existing effect only when the resolved
managed filter changes, cancellation restores the host state by removing only
the exact owned animation, unsupported additive composition fails explicitly,
root CSS-variable mutations do not trigger full media rescans, and zero-work
batches do not sweep tracked targets. Unknown-dimension targets use media readiness events, one
settle fallback, one bounded late check only for readiness-less or already-consumed
event paths, and one independent expiry instead of recursive polling.
Short-form and video mutation work drops
detached roots and collapses ancestor/descendant additions before evaluation;
video removal checks the live registry instead of rescanning detached subtrees.
Text-shuffle mutation work retains a bounded cursor. Added/removed inputs use
Set-backed parent ancestry rather than pairwise subtree comparisons, and the
ownership ledger indexes exact parent and matched target owner. Relational
child-list changes therefore revalidate only the affected owner, batch-dedupe
the same tracked node across sibling or mixed mutation roots, and still restore
or re-enqueue both sides of a `:has(...)` eligibility transition without a
global tracked-node scan. Removed-subtree cleanup checks indexed tracked
membership instead of walking unrelated DOM and cancels any cursor that still
owns detached nodes. A watchdog prevents
queued MutationRecords from retaining DOM indefinitely when animation frames
stall. Social Metrics routes mutation kind/attribute evidence to eligible
active groups before queue admission; owner-marker attributes are exact and
YouTube additionally applies host-owned root relevance. Capped semantic
discovery runs its bounded local-owner pass before broad descendant discovery
regardless of payload order, caches selector ancestry across nested sources,
keeps additions inside broad YouTube owners on the exact added subtree, and
decomposes an added broad owner to discovered child semantic roots before
retaining the broad owner itself.
Candidate application remains 3 ms
time-sliced, while adapter row/cluster cleanup coalesces across fast slices and
requests its first runnable cleanup at a 48 ms threshold or at the terminal scan
boundary. Cancel and failure paths attempt the same exact pending cleanup; a failed attempt retains its
closure for lifecycle retry and blocks later scan admission.
Reddit feedback discovery additionally registers only the first 24 connected
`shreddit-post` open shadow roots. Each root owns one local observer and one
marker stylesheet because document CSS and `ObserverHub` cannot cross that
boundary. Shadow hydration batches are debounced into host-scoped dirty scans;
detached hosts, feedback deactivation, and manager removal disconnect the local
observer and remove both the stylesheet and engagement markers. This does not
widen `ObserverHub` or create a generic shadow-tree scanner.
Detail-page `reddit-pdp-right-rail-post` recommendations stay in the ordinary
document observer path. Their localized like/comment metrics are one exact row
target rather than two number targets, so hiding feedback also removes the
labels, units, and middle separator without duplicate target writes.
Light-DOM comment scores use the direct
`[slot="actionRow"][data-testid="seeker-action-row"] > faceplate-number`
contract; `more_replies` counters remain outside that selector and visible.
Its exact WeakMap node identity keeps repeated decisions distinct from similar
DOM paths, while a chunk-scoped FastStyle write recorder separates decisions
from physical writes and consumes only exact owner-authored marker/text echoes.
Recorder-off calls do not perform serialized style/class/text evidence reads.
The ledger uses ObserverHub root/reconnect epoch plus monotonic delivery
sequence, with a five-second wall-clock backstop. It has a zero-pending no-read
path and Set-backed linear payload projection; privacy-safe scalar expiry,
invalidation, mismatch, unobserved-target, and excess counters prevent fail-open
work from looking like clean settle. Its pending count participates in settle
checks. Mutation-rule skips and host-root relevance skips are separate;
prevalidated roots avoid a second host query. YouTube root relevance also fails
closed through its owner diagnostic instead of widening a broken selector to
every dirty root. Child/text mutations on other adapters still expose aggregate
fan-out rather than exact mutation-to-root correlation. The last unsubscribe
cancels both scheduled flush paths and releases the queued nodes.

Diagnostic scan evidence distinguishes admission/merge from execution. An
executed scan is duplicate only when group, activation signature, exact root
identity set, and causal flush signature all match inside one measurement
epoch. Avoidable full rescan requires code proof that prevalidated dirty roots
were sufficient. Missing proof is `unavailable`, never a zero. Ownership
record/filter timing remains product cost; selector/provenance/write/scan-
evidence probes remain debugger overhead.

### F28. Social metrics consumes one compiled-plan projection

Status: fixed in the 2026-07-13 compiled filter-plan contract pass.

`ProtectionRegistry` previously passed the entire executable filter map into
`resolveCanonicalSocialMetricsSetting()`. That resolver owned persisted settings,
so the unrelated materialized blur entry failed the persisted
settings contract before `SocialMetricsManager.update()` ran. The registry now
uses `projectCompiledRuntimeSocialMetricsSetting()` to validate the compiled map
and hand the manager only `{ isActive, value }`. `core/runtimeState.js` resolves
visibility directly from that single setting and cannot send the full compiled
map back through persisted normalization. The current compiled blur contract is `{ isActive, band, value }`; stored blur remains `{ isActive, value: true }`, as defined by the friction injection architecture §3.4.

### F29. Page-entry effect work now cooperates without delaying scroll physics

Status: adopted first tranche.

Full `PROTECTION_UPDATE` activation now awaits ordered cooperative effect
application. A newer activation or clear invalidates the prior epoch, and the
message acknowledgement is emitted only after the current epoch settles.
Cancellation is checked after every awaited owner, including the last one, and
before final completion. Superseded work cannot commit applied diagnostics.
`VisualManager` establishes root CSS and observer ownership synchronously, then
splits its initial media candidate filtering, plan materialization, and writes
at the platform-owned 3ms deadline. Visual/Text mutation subscribers likewise
return after coalescing identity and perform traversal/revalidation/write work in
generation-cancelled cooperative continuations. Exact update tokens stop stale
continuations after every yield. The scroll controller's physics rAF remains
synchronous; an await there would add frame latency instead of relieving
competing page-entry work. YouTube Shorts does not enter that loop: one 140ms
intent window resolves to at most one viewport snap, followed by a 360ms commit
lock. Social Metrics collection now yields between root/semantic/candidate-batch
units, narrows added YouTube subtrees before semantic work, decomposes newly
added broad YouTube containers when narrower semantic roots are already present,
and keeps its existing idle-admitted 3ms apply cursor; repeated real-site
comparison remains the rollout gate.

### F30. Root restoration and ObserverHub option transitions

On teardown or a first inactive plan, `rootFilterController` adopts loader preload
ownership before restoring the root inline filter. It preserves the latest
page-owned filter value and priority, including a page removal or a write whose
observer microtask has not run yet. This requires no document traversal.
`ObserverHub` drains native `takeRecords()` into its existing batch before an
option reconnect. The final unsubscribe discards pending work. Subscriber
payloads remain filtered even when one batch spans multiple option epochs.

## Verification Targets

Use these checks when this boundary changes:

- `npm run test:file -- tests/mainThreadCooperativeScheduler.test.js tests/cooperativeMutationBatchQueue.test.js tests/pagedScrollIntentActuator.test.js tests/scrollInputOrchestrator.test.js tests/protectionKeyedEffectDedup.test.js tests/protectionControllerNudgeDebugSpawn.test.js tests/visualManagerLifecycle.test.js tests/textShuffleManagerLifecycle.test.js tests/socialMetricsRuntimePeerContracts.test.js tests/socialMetricsScanController.test.js`
- `npm run check:content-runtime:bootstrap-contract`
- `npm run check:content-script:ownership`
- `npm run check:bus:sender-boundaries`
- `npm run check:nudge-manager:facade`
- `npm run check:nudge-abort:facade`
- `npm run check:nudge-terminal:facade`
- `npm run check:nudge-lifecycle:facade`
- `npm run test:file -- tests/compiledRuntimeFilterPlanContract.test.js tests/protectionActivationEngine.test.js tests/protectionProtocolContracts.test.js tests/protectionKeyedEffectDedup.test.js tests/socialMetricsManager.apiContract.test.js tests/protectionSignalGateCleanup.test.js tests/protectionDispatchPlanner.test.js tests/protectionControllerNudgeDebugSpawn.test.js tests/contentRuntimeDiagnostics.test.js tests/contentScriptOrchestrator.test.js tests/trackingMessageHandlerSecurity.test.js tests/audioDullingActionHandlers.test.js tests/actionSenderPolicy.test.js`
- `npm run test:file -- tests/inputDelayManager.test.js tests/inputInkBrushSession.test.js tests/inputVisualBrakeManager.test.js tests/scrollGestureOwnership.test.js tests/frostedStoneDynamics.test.js tests/scrollInputOrchestrator.test.js tests/clickBoundaryClassifier.test.js tests/ensoGateGesture.test.js tests/ensoGateStroke.test.js tests/ensoGateNavigation.test.js tests/ensoGateTimeline.test.js tests/textPipelineDirectSelectors.test.js tests/textShuffleDirectSelectors.test.js tests/videoSkipManagerSeekGuard.test.js tests/shortFormInstagramRules.test.js tests/frictionTargetingPerformanceGuards.test.js tests/runtimeDebuggerOverlay.test.js`
- `npm run test:file -- tests/targetProfileContracts.test.js tests/siteTargetProfiles.test.js tests/targetingHealthContract.test.js tests/socialMetricsTargetingHealthProjector.test.js tests/runtimeDebuggerShortFormTargetingHealth.test.js tests/feedSurfaceProfiles.test.js tests/observerHubPerfDebug.test.js tests/fastStyleEngineIdempotency.test.js tests/visualManagerMediaGate.test.js tests/visualManagerLifecycle.test.js tests/textEffectTargetSelectors.test.js tests/textShuffleManagerLifecycle.test.js tests/lazySocialMetricsManager.test.js tests/clickTargetResolverProfile.test.js`

## Cooperative startup and scan demand (2026-09-05)

`ProtectionRegistry` declares `root` and `input` startup phases. The cooperative
applier starts VisualManager's synchronous root phase, then input/click/scroll
listeners before invoking BehaviorHub's activation-context update. Deferred media
and social work does not delay those starts; final ACK still waits for every
invoked effect and checks the current epoch. The debug environment history records
`effect_startup` (root/input synchronous phase completion relative to receipt) and
`effect_ack_ready`. These timestamps are phase boundaries, not compositor paint
measurements. Inactive, unloaded Social Metrics cancels its invocation token without
starting an import; a loaded owner still receives OFF cleanup.

Visual media mutation batches with additions only skip both the full tracked-target
restore pass and disconnected-target cleanup. Relevant attribute changes and promoted
context roots reconcile through a local light-DOM NodeIterator and owned Set membership,
without disconnected cleanup. Actual removals retain global disconnected cleanup.
Full document/configuration reconciliation retains its existing ownership route. Managed
style no-ops remain filtered by the existing observer. No root-to-target index or
new observer is added. `ownershipElementVisits`, `trackedTargetVisits` and `additionOnlyBatches` extend the
existing debug funnel; measurement never adds a DOM traversal.

`VideoElementObserver` remains the single video/audio/iframe inventory per document
and its reachable author shadow roots. A traversal collects all three element
kinds; audio activity and hold consumers do not repeat DOM discovery.
`observe: false` subscribers are passive. Only a real video/media-mutation consumer
or an explicit diagnostic demand starts observation. Runtime discovery uses a
TreeWalker cursor across 3 ms cooperative slices, checks generation/connectivity,
and cancels queued traversal when the last consumer leaves. A suspended cursor
invalidated by removal replays only its affected root, selected against weak
cursor ancestry captured before yielding (including author shadow hosts) and
retained for that job. Delayed removal can recover an earlier root after the job
has advanced to another; unrelated roots do not replay. Parent-chain validation on
continuation also catches detach/cross-parent movement before delayed ObserverHub
delivery. Same-parent reorder whose entire job finishes before that delivery
remains an existing completeness limitation. `removalReplayChecks`, `removalReplaysQueued` and
`removalReplaysAvoided` expose this work without another observer or cache.
Added-only batches do not restart inventory. Shared subscriber delivery deduplicates replay. Discovery visits,
slices, total CPU and maximum slice duration are debug-only counters. Individual DOM
operations can exceed the budget; the budget is a cooperative yield target.
Each measured slice also records a `videoObservation/discovery_slice` span in the
existing bounded Runtime Contention Ledger, excluding time spent awaiting a yield.

`whenSettled` exposes discovery completion/failure. VideoManager includes it in
VideoSkip/ShortForm activation completion.
Initial listener-delivery failures reject readiness and roll back the initiating
feature; rollback is fenced by the facade's feature epoch so a late failed ON cannot
remove a newer ON. Dynamic addition failures retain their bounded per-pair retry.

Explicit `reconcileExistingVideos` remains a synchronous, consumer-required
one-shot API used by PageMediaActivityObserver's explicit reconcile. The
`synchronousInitialInventory` subscription option gives PageMediaHold one fresh
admission snapshot. It replaces any suspended initial discovery, preserving queued
removal/control facts, rather than starting a second initial traversal. The cached
`getMediaSnapshot` returns videos, audio, frames and observed roots. Mutation
delivery includes `observedAudio` and `observedFrames` from the same traversal and
normalizes overlapping added roots before discovery and delivery. Removed audio
and frames are pruned from the inventory without traversing removed subtrees.
`inventoryVisits` counts both synchronous and cooperative traversal visits when
debug observation is enabled. Reconciliation enrolls newly found roots as
observers as well as registering their media. Late roots can also
enter through `registerMediaRoot`, bounded document-event recovery (at most 16
composed-path entries), or lifecycle reconciliation. A root attached to an existing
host with no DOM, lifecycle, or composed event remains undiscovered until one of
those signals occurs. There is no global `attachShadow` patch or polling scanner.

### Media capability and hold contract (2026-09-27)

`media/mediaShadowRootAccess.js` owns the module-side Chrome DOM read capability.
`open_and_closed` means `chrome.dom.openOrClosedShadowRoot` exists;
`open_only` is an explicit platform capability, not recovery from a failed read.
API failure rejects discovery and is diagnosed. Only HTML author hosts are read;
SVG and native control hosts are excluded. The registered classic frame probe
duplicates this narrow capability check because it cannot import module code.
No media URL, title, DOM snapshot, or user input is added to frame diagnostics.

`getVideoElementObserverForDocument` shares one owner per exact document.
The top document uses ObserverHub; same-origin iframe documents use their own
owner. Its Window `pageshow` binding owns an AbortController acquired while the
document is reachable. Teardown aborts that exact native listener instead of
reading `removeEventListener` on a WindowProxy that may have navigated cross-origin.
Successful bindings retire independently; an actual abort/removal failure keeps
only the failed binding for explicit cleanup retry and propagates its original
error (multiple failures remain an AggregateError). This does not extend DOM reach
or resume eligibility after frame navigation.
Top-video counts never include iframe videos. PageMediaHold subscribes to
these owners, including their observed-root and media/frame projections, and owns
only frame-document acquisition and play/source listeners. It never rescans audio
or iframe subtrees. PageMediaActivityObserver also consumes the shared audio
inventory directly. Gate and Global use the
same hold contract as Site Furin. Global has no periodic document sweep; its
product volume-transition timers remain. Enso retains its declared one-shot policy.

A pause counts as successful only when `paused === true` after the command.
Per-element failures produce explicit diagnostics while other elements continue.
Resume eligibility records the exact original playing element, source identity,
source epoch, and document/frame membership. Source replacement, `emptied`,
`loadstart`, disconnection, or iframe navigation invalidates it. Newly started
media is held but is not eligible for automatic resume. Global manual completion
restores only after a successful canonical acknowledgement in the same runtime
epoch; its volume restore changes only values still owned by that hold.
Cleanup failure retains the exact lease for retry.
Media operation and cleanup diagnostics use `formatRuntimeDiagnostic` in the
first console argument, preserving the remote operation or local cleanup phase
and native error/cause in plain-text collectors. Local cleanup still attempts
each independent owner, throws the original children in `AggregateError`, and
retains failed owners for explicit retry. An inaccessible frame remains an
explicit unsupported DOM reach observation, not verified media failure.
Local hold listeners and entries are scoped to acquired documents and their exact
iframe ancestry. Adopting media or an author shadow host into an unrelated live
document retires local control. `captureMediaScope` preserves that same identity
for Global volume writes after observer cleanup, so a legitimate surface ramp
continues while external adoption or iframe replacement ends volume ownership.

Frame probe V5 reports from its cached inventory on a fixed 200 ms first-dirty
deadline; ongoing mutations cannot postpone delivery indefinitely. Top and frame
reports expose `status`, `observationError`, `shadowRootAccess`, and
`lateShadowDiscovery`. Only `observed` can carry an integer `videoCount` and
matching boolean `hasVideo`; inactive/observing/failed reports use null counts.
The background ledger validates and preserves these fields. Counts represent
observation, never enforcement or dispatch readiness. Cross-origin HTML media
hold uses the separately authenticated command contract below; observation alone
does not activate it. Older report shapes require probe reinjection
or navigation instead of a legacy read path.

The classic probe collapses ancestor/descendant additions within each native
mutation batch before scanning. Removal-only batches prune the live media and
shadow-root inventories without walking the removed tree. A same-document move
still scans its added root once so a newly attached author shadow root is not
missed. Idle ready-state/pageshow recovery shares the existing report deadline;
active holds and BFCache restoration reconcile immediately, and admission flushes
any pending recovery before taking its original-playing cohort. This adds no
periodic DOM sweep. Debug counters expose full/subtree scans, visited nodes,
collapsed roots, removal prunes, READY sends/suppressions and begin/renew commands.
Ordinary acknowledged or pending healthy READY observations deduplicate; failed
observations, explicit DISCOVER and reinjection remain reportable.

### Embedded HTML media hold and support boundary (2026-09-27)

| Concern | Owner | Authority / evidence |
| --- | --- | --- |
| Top-document hold | `media/PageMediaHold.js`, `media/FrameMediaHoldClient.js` | Existing Site Furin, Global Sentinel and Gate lifecycle; synchronous local hold plus asynchronous remote lease |
| Wire shape and capability statuses | `media/frameMediaProtocol.js` | Version 1; bounded IDs, frame receipts and permission hints; no stored settings |
| Remote command admission and routing | `protection/background/runtime/FrameMediaControlBroker.js` | Exact top document and existing `InterventionAdmissionService` lease; injected browser ports |
| Chrome sender identity | `tracking/background/trackingFrameMediaHandlers.js` | Chrome tab/frame/document metadata; extension-page-only support query |
| Child actuation | `apps/content/mediaFrameProbe.js` | Classic V5 receiver, one existing document/shadow inventory, native video/audio state |
| Permission and navigation revocation | `tracking/background/ContentScriptOrchestrator.js` | Existing lifecycle invalidation, exact old-document cleanup |

The full content runtime remains top-frame-only. Managed registration grants the
small media receiver access only to already granted HTTP(S) origins, independently
of protected-site enrollment. Granting an embedded provider never appends it to
`blockedUrls` or `allowedUrls`. PageMediaHold's bounded iframe-origin hints are
permission diagnostics, never trusted actuation targets. Nested receivers report
their own Chrome sender identities. No `<all_urls>` grant is requested by this
feature and opaque/sandboxed/about/blob frames are not promised coverage.

The top client begins one UUID lease and renews every 15 seconds. The broker
requires the same top document, current origin permission, and an existing
reserved/presented Site Furin, Global Sentinel or Gate admission. A reservation
is valid before the surface's presentation acknowledgement; remote media work
does not block that acknowledgement. Subsequent renewals bind the same admission
lease. End may clean up after admission resolution, but resuming additionally
requires current top/child permission and the same top document. Content pages
cannot query or command arbitrary tabs. No MAIN-world media injection is added.

READY binds a per-document receiver instance UUID to Chrome's document ID; only
background-origin commands with both identities can operate it. READY also carries
a required monotonic `inventoryRevision`: media membership/source changes invalidate
old command receipts even when the media count is unchanged. An exact successful
hold/frame receipt can suppress duplicate begin commands; permission and admission
checks remain mandatory. Receipts are bounded by the existing hold/frame limits
and include document, receiver instance, inventory revision and lease deadline.
Each heartbeat still broadcasts DISCOVER to recover a receiver whose first READY
was lost. Its forced READY preserves the revision of unchanged inventory and does
not trigger another begin after a successful renewal. New receivers, changed
inventory, expired/failed receipts and worker-state loss require fresh actuation.
`tabs.sendMessage`
targets that exact document ID. A discovery broadcast only asks receivers to send
authenticated READY messages. A frame reachable through every ancestor document
is `managed_by_top`, so the local hold alone pauses/resumes it. A top-origin
grandchild underneath an inaccessible cross-origin ancestor needs remote control.
Global remote media pauses immediately; volume animation remains local only.

Receivers verify `paused === true` after pause. Observation, command acceptance,
and verified pause are distinct fields; an empty observed frame is never marked
verified stopped media. Resume records only originally playing elements and checks
exact element/document/source identity and epoch. An idle receiver is explicitly
`ready`, not an unavailable receiver or an already verified pause. Changed/failed
inventory invalidates older command evidence. Permission reads carry the current
permission revision so an older successful read cannot undo revocation evidence.
Resume checks the source again. Newly started media is stopped
without automatic-resume eligibility. A changed source, detached element, failed
play(), new hold, cancellation, pagehide or lease expiry fences pending playback.
Multiple overlapping holds release playback only after the last eligible release;
any no-resume release makes that cohort ineligible. Playback promise validation is
bounded to two seconds and autoplay refusal stays an explicit partial result.
Permission revocation tombstones the current receiver hold ID; granting access
again requires a fresh intervention/hold or a fresh receiver document. Renewing a
revoked hold does not quietly restore control or playback.

Each receiver lease expires within the top lease's 60-second deadline. Expiry,
permission revocation and navigation clear enforcement without starting playback.
No-resume cancellation bypasses a queued resume so the receiver can fence an
in-flight play promise. A page-exit receipt retires only the matching old instance;
BFCache restoration creates a new instance. If the exit message cannot be delivered,
the receiver records `exitReportError` and bounded `exitReportDetails` (lifecycle
reason, captured document/instance, transport versus rejection versus send exception,
and returned error text/code), cleans its local resources, and the broker
retains uncertainty until a replacement handshake or explicit failure. Superseded
and exited document/instance identities are tombstoned (256 per tab; exhaustion
records `FRAME_MEDIA_RETIRED_IDENTITY_LIMIT`) so delayed READY cannot resurrect
old ownership. The broker never interprets a missing receiver as zero media.

The broker owns ephemeral transport state, not a second session checkpoint. After
MV3 worker loss a still-active top heartbeat revalidates the canonical admission
and rediscovery rebuilds receiver routing. If end arrives without that transport
lease, `FRAME_MEDIA_HOLD_NOT_FOUND` explicitly denies automatic restoration; child
TTL still ends enforcement. Successful end receipts are bounded to 16 per tab for
idempotent acknowledgement retries. Frame inventory is bounded to 64 and missing
origin hints to 32; exceeding the origin bound is `FRAME_MEDIA_ORIGIN_LIMIT`.

`GET_MEDIA_FRAME_SUPPORT` is a read-only extension-page query. `known_frames` means
only the registered receivers were inspected; `unknown` does not mean the page
contains no media. Neither status claims complete frame-tree coverage. Permission
required, failed observation, missing receiver and rejected command remain visible
diagnostic states. Canvas/WebCodecs/WebAudio-only playback and cross-frame seek
are unsupported in this contract; there is no guessed tab mute or generic player
fallback. Exit condition for these platform limits is an explicit adapter or a
revised platform capability, with matching docs and browser evidence.

Verification owners: `tests/frameMediaControlBroker.test.js`,
`tests/frameMediaHoldClient.test.js`, `tests/mediaFrameProbe.test.js`, and the
named browser target `media/frame-hold`. The friction architecture guard protects
separate admission, exact document targeting and top-only full-runtime ownership.

Seek commands carry an owned temporary UUID/source-fingerprint media marker.
The YouTube MAIN executor validates the exact marked video and its source before
calling its owning player. A response acknowledges command execution; the manager
still verifies actual position before completing enforcement. Source changes or
replacement invalidate the transaction. Generic gestures and bounded drag state
are attributed to one tracked player; a gesture in another player cannot provide
user intent for a seek in this one.

## Public effect failure and inspection seams (2026-09-05)

The content receiver uses `ProtectionStateApplier.formatProtectionEffectFailure`
to retain up to eight aggregate cause messages (400 characters each) in the
existing string error response. No stacks or additional page context are added.
This lets failed settings propagation retain the underlying owner failure instead
of only `PROTECTION_EFFECT_APPLICATION_FAILED`.

The public `feedHorizonInspection.public.js` adapter implements every production
call made by `FeedBoundaryEpisodeCoordinator`, including
`resolvePendingEndpointDecision`. It passes through the canonical decision and
never enables inspection. `tests/feedHorizonPublicSeam.test.js` constructs the
real episode manager with this public adapter and verifies that the production
decision remains unchanged. Development-only inspection coverage cannot replace
this public-adapter integration check or the clean public MV3 browser target.

## Ordinary content presentation consolidation (2026-10-09)

Mirage, its repeated-attempt detection, five phase timers, phrase generation,
whiteout/shutters and page-local frequency reader/writer are retired. Existing
origin-local UI data is left untouched; runtime has no legacy read or migration.
Video seek/speed enforcement, exact-player input targeting and the frame pulse
retain their existing owners. No cosmetic sequence can delay or suspend them.

The lazy StatusIndicator facade exposes `showAttemptReason(kind)` and a
loaded-view-only `clearAttemptReason(kind)` for video/shortform. Each producer
cancels only its own currently displayed reason; pending imports are fenced by
kind-specific epochs so OFF cannot replay an old reason. One display/timer
replaces the prior player banner and top-right short-form notice. Failures remain
producer diagnostics, not a transient success/error toast.

## Cross-intervention admission (2026-09-09)

The Active [intervention admission contract](../runtime/intervention-admission-runtime.md)
owns the shared browser-session policy. `InterventionAdmissionService` serializes
reservations, actual presentation, cleanup, recovery and destructive conclusions.
Its typed session repository persists the active owner and 45-second post-end
deadline across worker restart, tab switches and document replacement.

Ordinary Enso, Site/Global Furin, Presage, Gate review/notice and Suikinkutsu
presentations cannot preempt one another. Only an active isolation Gate is a
mandatory boundary. Screen/input ownership stays in `ritualSurfaceArbiter`;
priority metadata cannot grant preemption or authorize a stale tab close.
Candidates are bounded and re-evaluated at producer boundaries, never replayed
from a cooldown queue. Automatic Furin STOP carries the captured run IDs through
content cleanup and background terminalization. Manual Furin keeps its isolation.

### Visual structural short-form context invalidation (2026-09-20)

`mediaTargetProfiles.js` declares YouTube grid/lockup structural mutation
dependencies independently of the Instagram descendant-link classification seam.
`mediaFilterController.js` compiles the declaration; `observerController.js`
promotes relevant childList evidence additions/removals to their live enclosing
grids and feeds the existing reconciliation queue. All enclosing grids can depend
on the same descendant evidence, so root collapse follows owner collection.
Only changed subtrees inside a declared grid are searched for lockup evidence.
Ordinary metadata does not qualify, and removal retains the old live parent for
strength withdrawal. The existing classifier, additive effect, host inline
filter preservation, selector diagnostics and generation/OFF cancellation remain
with their current owners. Batch-local Maps/Sets expire after root admission;
the change adds no observer, long-lived index or cross-owner classifier.
Element-free records exit before structural ancestry reads. Removed-node parent
edges live only for the current observer batch: a removed/moved wrapper may be
empty by delivery, but a later evidence change still reaches its former grid.
The graph walk deduplicates visited nodes, respects light-DOM boundaries and
admits connected owners only; it is not a DOM history cache across batches.
Post-native-delivery detached rewrites are covered by a current-state revocation
pass: affected removal grids without live lockup evidence are promoted only when
the existing effect cache still owns a connected non-base filter below them.
This adds no stored dependency index or native observer callback work. Positive
grids and base-only grids avoid media reclassification; negative removal contexts
can incur one existing tracked-set enumeration, and each context query is atomic.
The cooperative consumer still rechecks generation and current target eligibility.


## Artifact realignment — 2026-10-09

Current ownership supersedes previous family examples: Veil owns socialMetrics, timeSignals and shortformBlock; Brake owns clickPause, scrollFriction, inputVisualBrake and skipFriction; Barrier owns textRhythm, intentThreshold and detourSpreadGuard, plus the existing auxiliary tabManagement preference. The canonical catalog and runtime binding apply this ownership to disclosure, family pause, configuration, execution and telemetry. Periodic Feed Horizon and the cadence remain one Barrier episode. Site/Global Furin use the shared Horizon under their own goal purpose; no parallel actuator is added.

The retained `timeAnchor` runtime ID owns Barrier's `ensoGate`, derived
`infiniteScrollGuard`, and `textRhythm` policy provenance. Its definition no
longer suppresses or attributes Veil's short-form block or Brake's skip guard.
Short-form/seek observations cannot engage or prefer this runtime artifact.
The periodic boundary still requires its own cadence and fresh admission; an
armed policy state does not grant a decision or replay.

Lens release children expose independent ON/OFF plus integer 0–100 strengths. Persisted visual filter values are numeric strengths, and the visual profile owner compiles strength/effectiveStrength and physical CSS for the current adaptive band. Present boolean visual settings are incompatible pre-release data and reject without rewriting or wiping. The 101 quantized grayscale prepaint assets match the exact compiled strength; only admitted host tiers are registered.

`filterCapabilityCatalog` emits numeric default strength requests for policy
lanes. `frictionModifierResolver` validates settings and compiled plans at their
distinct admission branches, then recompiles compiled visuals from `strength`.
`fullscreenVisualPolicy` also steps down from that original strength. Compiled
CSS values never become settings or the next compilation's numeric input.

The periodic boundary uses a single horizontal gesture: drag from the center left to finish, right to continue; at least 420 ms and the declared travel distance are required, and release confirms. Keyboard arrow hold/release is equivalent. Partial strokes retry without retained ink; cancel is neutral and cannot replay or navigate. Existing admission, cadence, feed endpoint, replay and tab-closure authorities remain mandatory. The Zen skip attempt is represented by a Tome Ishi stone resistance pulse inside the video boundary, with reduced motion honored.
