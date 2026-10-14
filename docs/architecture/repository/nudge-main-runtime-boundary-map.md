# Nudge Main Runtime Boundary Map

- Status: Active
- Owner: repository architecture, nudge runtime, artifact runtime
- Last validated against code: 2026-10-13
- Path policy: current-only
- Canonical for: Sentinel Flare content-host activation, runtime context, ritual/outcome lifecycle, copy, debug spawn diagnostics, and navigation recovery boundaries
- Companion to:
  - `docs/architecture/repository/friction-nudge-effect-boundary-map.md`
  - `docs/architecture/repository/nudge-worker-runtime-boundary-map.md`
  - `docs/architecture/themes/zen/zen-sentinel-render-pipeline.md`

## Purpose

This map audits the main-thread host for Sentinel Flare. It covers the content
overlay, start/stop orchestration, runtime context, ritual state, terminal
sequence, lifecycle messages, telemetry/debug surface, and navigation recovery.

Site Furin uses the explicit host DOM/SVG render strategy; Global Sentinel uses the selected worker runtime documented in the worker map. See the [Site Furin chime contract](../themes/artifacts/sentinel-flare-site-furin-chime-spec.md).

The practical reading question is:

```text
Can a Sentinel Flare change identify the content host, selected render runtime,
ritual/outcome owner, and recovery path without adding a second host, a hidden
worker/main fallback, or an undiagnosed navigation branch?
```

## Current Runtime Status

Site Furin's Leave conclusion follows host → `nudgeGameControl.closeSiteFurinTab`
→ `SITE_FURIN_CLOSE_CURRENT_TAB` → `TabClosureArbiter` → exact admission probe →
browser tab removal. The host retains its lease and control listener until the
operation settles, and exposes failure/retry through `SiteFurinReflectionView`.
The recovery-dashboard navigation helper remains a separate Global path.

The host's pending start owns an activation label and production run ID before
admission resolves. The admission client connects that label to request/lease
outcomes in the existing content diagnostic ring. `isActive()` remains a visible
runtime check; stop callers use `hasLifecycleOwnership()` for preparing or failed
cleanup states. Site Furin's first-paint wait belongs to this same host: stop
cancels its rAF and timer immediately, independently of future document frames.
Late import/worker settlement is fenced by the exact start epoch/root. See the
[admission lifecycle contract](../runtime/intervention-admission-runtime.md#lifecycle-correlation-and-cancellation-2026-09-16).

`src/domains/nudge/runtime/SentinelProtocolHost.js` is the content host and
session orchestrator. Callers import that canonical owner directly; the retired
`nudgeGame.js` facade does not exist.

```text
ProtectionDispatcher / content bootstrap
  -> production NUDGE_START with issued key + run id
Runtime debugger / dashboard Lab
  -> authorized NUDGE_DEBUG_START without production lifecycle identity
  -> ProtectionController exact goal-bound entry (both automatic scopes; debug bypasses)
  -> qualified feed Horizon + fresh continuation, or classified prepared new-content action
  -> SentinelProtocolHost.start(config)
  -> NudgeOverlayHost.ensure
  -> runtime context + protocol scene + copy presentation
  -> Global: NudgeExtensionFrameWorkerRuntime.activate + FIRST_FRAME
  -> Site: immediate HTML media hold + canonical Furin SVG + visible paint acknowledgement
  -> markSentinelNudgePresented
  -> Global: protocol page-media suppression
```

Global Sentinel uses `extension_frame_worker`; Site Furin uses `host_dom` and the canonical artifact Furin SVG. The latter does not instantiate a koi worker.

The local `NudgeSwarmEngine` instance in `SentinelProtocolHost` remains available for
diagnostic snapshots and non-active code paths, but selected worker activation is
the current production render path. Unsupported or failed selected worker starts
return rejected outcomes; they must not silently switch to a main-thread renderer.

Worker boot readiness is not presentation readiness. `WORKER_READY` only proves
that the worker initialized; `SentinelProtocolHost.start` must await the selected
runtime's `FIRST_FRAME` before reporting start success, sending
`NUDGE_PRESENTED`, or suppressing page media.

## System Flow

Start sequence:

```text
ProtectionController.startSentinelProtocolHostAtEntrySeam
  -> automatic Site/Global: current-policy-bound safe entry; idle/cap cancels
  -> admitted Site: chime interval inside the same SentinelProtocolHost session
  -> debug: immediate Global / Site chime presentation
SentinelProtocolHost.start
  -> claim tab ritual surface ownership
  -> normalize runtime host and context
  -> ensure overlay host
  -> apply theme/protocol/copy presentation
  -> reset ritual and terminal state
  -> supportsWorkerRuntime()
  -> startWorkerRuntime()
  -> waitForActive() until selected worker FIRST_FRAME
  -> startLoop() for host-owned HUD/ritual/protocol progress
  -> markNudgePresented()
  -> suppressProtocolPageMedia()
```

Worker render sequence:

```text
startWorkerRuntime()
  -> NudgeExtensionFrameWorkerRuntime.activate()
  -> protocolProgress snapshot travels beside config
  -> iframe render host
  -> nudgeSwarm.worker.js
  -> NudgeSwarmEngine
  -> FIRST_FRAME evidence returns through the selected runtime
```

Global starter sequence:

```text
SentinelProtocolHost loop
  -> global progress reads awaiting_start until explicit starter click
  -> selected worker renders starter koi and reports awaiting_start stats
  -> starter koi click fixes crack origin and starts repair_race
  -> host ritual state advances from the same hit result
```

User outcome lifecycle:

Global starter viewport preparation is owned by
`SentinelProtocolFullscreenController` and `SentinelProtocolInputController`.
The trusted pointer/semantic gesture first queues the visible starter reservation,
then synchronously requests fullscreen before returning from that same gesture.
This orders the original bounds ahead of browser resize messages without awaiting
a worker response or losing transient user activation. A fullscreen video is not
the ritual document surface: the document root is requested as its own layer,
and teardown exits only the layer owned by this session. A pre-existing root
fullscreen remains externally owned. After request settlement, preparation needs
100ms without a resize and two consecutive animation-frame samples with equal,
positive finite window bounds. Only then are worker bounds published and the
reserved starter committed. This bounded preparation cancels its timers, frame
callback and resize listener on stop; the existing 800ms viewport and 1200ms
request deadlines remain explicit failures. It does not create a steady render
loop or advance the game/crack clock before commit. Optional platform denial is
reported and keeps the documented settled-window presentation path.

```text
worker HIT_RESULT / modal action
  -> ritual state
  -> terminal sequence for global success/failure
  -> NUDGE_RESOLVED or NUDGE_ABORTED lifecycle message
  -> stop + explicit teardown
```

Debug control lifecycle:

```text
canonical debugConfig + build capability authorization
  -> readActiveNudgeOwnerForTab(target tab)
  -> reject mutating debug control while a production owner is active
  -> NUDGE_DEBUG_START / CONFIG / SPAWN / STOP
  -> content admission rejects replacement of an active/pending auto session
  -> debug lifecycle remains local and never sends production presented/resolved/aborted messages
```

QA-profile Sentinel lifecycle:

```text
trusted entropy-e2e.html sender
  -> dev-only Sentinel QA background route
  -> stable HTTP(S) target + content readiness check
  -> NUDGE_DEBUG_START / SNAPSHOT / STOP
  -> canonical host/session/selected-worker diagnostics
  -> human input or bounded CDP pointer/semantic input
  -> Global: fully opened rift -> semantic invite -> background-owned exact
     sender-tab Room 478 navigation -> rendered Room handoff evidence
  -> Site/abort only: typed STOP cleanup
  -> structured phase evidence; optional explicit screenshots
```

Cross-context teardown lifecycle:

```text
settings disable / tab switch / window blur
  -> enter ProtectionDispatcher per-tab content-mutation lane
  -> live content NUDGE_STOP exact-document acknowledgement attempt
  -> canonical tab session terminalization before lane release
navigation / tab removal / tab replacement
  -> raw ingress closes or invalidates dispatcher admission
  -> no recovery injection into the departing document
  -> canonical tab session terminalization before owner eviction
terminalization
  -> terminal + run-keyed aborted outbox in one session patch
  -> tab-scoped pending outbox drain schedule; bootstrap remains the restart replay owner
```

## Canonical Owner Table

| Concern | Canonical owner | Canonical path | Source of truth | Forbidden shortcut |
| --- | --- | --- | --- | --- |
| Content runtime host | Sentinel protocol host | `src/domains/nudge/runtime/SentinelProtocolHost.js` | one active overlay/runtime session, owner composition, start/stop ordering, selected-runtime readiness | a second Sentinel Flare host or role-specific behavior folded back into the composition root |
| Overlay DOM host | nudge overlay host | `src/domains/nudge/runtime/NudgeOverlayHost.js` | shadow root, scene, canvas container, modal, HUD refs | scattered DOM creation from runtime helpers |
| Runtime host selection | Sentinel protocol worker bridge + host session model | `src/domains/nudge/runtime/SentinelProtocolWorkerBridge.js`, `src/domains/nudge/runtime/SentinelProtocolHostSessionModel.js` | `workerRuntimeHost`, default `extension_frame_worker`, selected/active runtime routing, protocol-change reset model | feature-local worker host flags |
| Runtime context | nudge runtime context | `src/domains/nudge/runtime/nudgeRuntimeContext.js` | theme/language/variant normalization | propagating raw theme aliases past the boundary |
| Runtime copy | nudge copy config | `src/domains/nudge/nudge/nudgeGameCopyConfig.js`, `src/domains/settings/i18n/nudgeCopy.js` | localized protocol/message copy | feature-local English copy fallback |
| Automatic entry and goal lifetime | protection content controller + shared boundary + background policy owners | `src/domains/protection/content/ProtectionController.js`, `src/domains/nudge/runtime/furinEntryBoundary.js`, `src/domains/nudge/runtime/nudgeEntrySeamGate.js`, `src/domains/nudge/feed-flow/FeedBoundaryEpisodeCoordinator.js`, `src/domains/nudge/runtime/goalEpisodeBinding.js` | exact goal binding, mandatory qualified-feed Horizon before Site/Global Furin, or classified prepared non-feed new-content action; actual final display remains separate from accepted waiting | broad click/key/media/idle commits, timer-forced overlay, goal revision relabeling or unsupported-feed substitution |
| Debug control authorization | support debug policy + nudge session owner reader | `src/domains/tracking/background/trackingMessagePolicies/supportDebugPolicy.js`, `src/domains/nudge/runtime/session/nudgeSessionOwnerState.js` | build capability, canonical `debugConfig`, runtime-debugger capability, and active production owner for the target tab | trusting sender scope alone, using `force` as authorization, or mutating a tab with an active production owner |
| Debug content admission | protection content controller + host session model | `src/domains/protection/content/ProtectionController.js`, `src/domains/nudge/runtime/SentinelProtocolHostSessionModel.js` | dedicated debug message types, pending entry-seam mode, and active host mode | debug config/spawn/stop replacing or cancelling an auto session |
| Debug spawn/probe execution | Sentinel protocol debug controller | `src/domains/nudge/runtime/SentinelProtocolDebugController.js` | debug spawn outcome normalization, selected-runtime spawn routing, and bounded worker admission probes | debug outcome shaping and probe setup duplicated in the host composition root |
| Dev-only Sentinel QA transport | Sentinel QA contract + background route | `src/domains/nudge/runtime/automation/sentinelProtocolQaAutomationContract.dev.js`, `src/apps/background/services/runtime/messageRoutes/sentinelProtocolQaAutomationMessageRoutes.dev.js` | exact trusted harness sender, bounded Site/Global payload, stable target tab, canonical debug messages, and typed response | page-world globals, raw storage injection, arbitrary runtime config, or inclusion in public builds |
| Tab ritual surface arbitration | nudge ritual surface arbiter | `src/domains/nudge/runtime/ritualSurfaceArbiter.js` | one dominant visual/protective surface per tab, non-preemptive ordinary claims, mandatory isolation cleanup, dominant input policy guard | feature-local `if Enso/Shishi/presage/global` condition ladders or ad hoc page-input blockers |
| Site Furin input gate | site Furin input gate + ritual surface arbiter | `src/domains/nudge/runtime/nudgeSiteFurinInputGate.js`, `src/domains/nudge/runtime/ritualSurfaceArbiter.js` | overlay pointer input and focused reflection-button activation remain available while wheel, touch, scroll-key, and middle-button auto-scrolling are blocked until claim release | reusing the narrower global awaiting-start event list or relying on canvas `touch-action` as the page scroll lock |
| Global starter gate | Global entry model + Sentinel global-entry runtime + selected worker runtime | `src/domains/nudge/runtime/GlobalSentinelEntryController.js`, `src/domains/nudge/runtime/SentinelProtocolGlobalEntryRuntime.js`, `NudgeSwarmEngine`, `nudgeGameGlobalSentinelProtocol` | `awaiting_start`, blocked-input feedback, rupture-reveal state/timers, first accepted starter click, crack origin, and repair-race start | letting page navigation/editing inputs leak through or rebuilding feedback/reveal state in the host |
| Global accepted-surface isolation | Global page isolation + content host | `src/domains/nudge/runtime/GlobalSentinelPageIsolation.js`, `src/domains/nudge/runtime/SentinelProtocolHost.js` | exact native DOM/style lease after accepted starter; original-page inertness, native scroll lock and viewport pointer hit-test through terminal/Rift/ACK wait | changing awaiting-start scroll policy, adding another event gate, or releasing covered-page hover/scroll before teardown |
| Scene presentation | nudge scene helper | `src/domains/nudge/nudge/nudgeGameScene.js` | scene phase, protocol scope, style vars | ad hoc class/style mutations for new phases |
| Engine execution control | nudge engine control helper | `src/domains/nudge/nudge/nudgeGameEngineControl.js` | `scenePhase + protocolProgress + modal/terminal` to engine clock/spawn/split/input/render authority | worker/engine-local phase ladders that independently decide when spawning or input is allowed |
| Worker protocol progress | Sentinel protocol session controller + protocol adapters | `src/domains/nudge/runtime/SentinelProtocolSessionController.js`, `src/domains/nudge/nudge/sentinelProtocolAdapters.js`, `SET_PROTOCOL_PROGRESS` | Global progress snapshot consumed by selected worker engine control; Site stays host-owned | deriving site furin phase or global starter state independently inside worker shell |
| Theme presentation | nudge theme presentation helper | `src/domains/nudge/nudge/nudgeGameThemePresentation.js` | runtime theme CSS vars and Zen scene class | large theme-specific style maps inside `SentinelProtocolHost` |
| Protocol presentation | Sentinel presentation controller + DOM adapter | `src/domains/nudge/runtime/SentinelProtocolPresentationController.js`, `src/domains/nudge/runtime/SentinelProtocolPresentationAdapter.js` | ritual text/projection, HUD telemetry cadence, theme/scene application, and narrow DOM mutations | presentation state, telemetry publication, or ritual copy rebuilt in the host composition root |
| Protocol diagnostics | Sentinel protocol diagnostics builder | `src/domains/nudge/runtime/SentinelProtocolDiagnosticsBuilder.js` | dashboard/debug diagnostic field assembly for state and spawn telemetry | ad hoc dashboard diagnostic fields built in unrelated runtime layers |
| Protocol session progression | Sentinel protocol session controller | `src/domains/nudge/runtime/SentinelProtocolSessionController.js` | active site/global state pair, progress resolution, worker progress, accepted input advancement, Site presented-visible frames, completion delay, global failure check | mutating site/global protocol state directly in `SentinelProtocolHost` |
| Protocol pointer choreography | Sentinel protocol input controller | `src/domains/nudge/runtime/SentinelProtocolInputController.js` | Global canvas pointer routing, worker hit-result validation, and starter miss handling | pointer-mode ladders or pending starter state in the host composition root |
| Fullscreen preparation | Sentinel fullscreen controller | `src/domains/nudge/runtime/SentinelProtocolFullscreenController.js` | optional request, bounded resize settling, cancellation and owned fullscreen exit | opening fullscreen before a validated starter or starting cracks while bounds change |
| Host session model | Sentinel protocol host session model | `src/domains/nudge/runtime/SentinelProtocolHostSessionModel.js` | initial/reset state pair, config-change detection, stop reset primitive | hand-built reset bundles inside host lifecycle branches |
| Worker bridge | Sentinel protocol worker bridge | `src/domains/nudge/runtime/SentinelProtocolWorkerBridge.js` | selected/active runtime lookup, message posting, support checks, activation routing, stats/telemetry snapshots | direct prepared/extension runtime branching inside protocol logic |
| Presentation readiness barrier | Sentinel protocol host + worker bridge + selected runtime | `src/domains/nudge/runtime/SentinelProtocolHost.js`, `src/domains/nudge/runtime/SentinelProtocolWorkerBridge.js`, `src/domains/nudge/runtime/NudgeExtensionFrameWorkerRuntime.js` | `FIRST_FRAME`-backed `waitForActive()` result before host-loop start, start success, lifecycle presentation, or media suppression | treating iframe host-ready or worker `READY` as a presented intervention |
| Selected render runtime | worker bridge + worker companion map | `src/domains/nudge/runtime/SentinelProtocolWorkerBridge.js`, `NudgeExtensionFrameWorkerRuntime`, render host app, `nudgeSwarm.worker.js` | active worker session and render stats | main-thread render fallback after selected worker failure |
| Lifecycle timers | Sentinel protocol timer controller | `src/domains/nudge/runtime/SentinelProtocolTimerController.js` | named ritual, terminal, global reveal, rift, and escape timeout/interval ownership | anonymous host-local timer ids scattered through protocol branches |
| Content lifecycle + media | Sentinel protocol lifecycle controller | `src/domains/nudge/runtime/SentinelProtocolLifecycleController.js` | presented/absorbed/aborted/resolved state, resolve-intent reservation, unconfirmed presented-authority fencing, page lifecycle listeners, and post-first-frame media suppression/restore | lifecycle flags, unload handlers, or media suppressor state stored directly in the host composition root |
| Host frame scheduling | Sentinel protocol frame-loop controller | `src/domains/nudge/runtime/SentinelProtocolFrameLoop.js` | one RAF lifecycle and bounded frame-delta delivery | extra render RAF loops or worker/main mixed canvas ownership |
| Host frame meaning | Sentinel protocol host | `src/domains/nudge/runtime/SentinelProtocolHost.js` | frame-time orchestration, protocol/HUD update dispatch, and selected-runtime/main-canvas selection | moving ritual or worker ownership into the generic RAF controller |
| Global simulation arithmetic | nudge global protocol core | `src/domains/nudge/nudge/nudgeGameGlobalSentinelProtocol.js` | shared fracture, sync-pressure, repair, and outcome progress for host and worker diagnostics | duplicated global pressure/fracture calculators in the host or engine |
| Runtime state | selected runtime + local machine | `src/domains/nudge/runtime/NudgeRuntimeMachine.js` | selected worker stage, last error, local lifecycle stage | constructing worker adapters only to mirror main state |
| Spawn budget and hit policy | worker engine + protocol scene | `NudgeSwarmEngine`, `nudgeProtocolScene.js` | named spawn block reasons and scene interaction policy | boolean-only spawn failures without named reason |
| Protocol game state | protocol session controller + protocol adapters + protocol cores | `src/domains/nudge/runtime/SentinelProtocolSessionController.js`, `src/domains/nudge/nudge/sentinelProtocolAdapters.js`, `nudgeGameSiteFurinProtocol`, `nudgeGameGlobalSentinelProtocol` | Site arrival/choice and uninterrupted Continue hold from presented-visible time, and global simulation phases/progress, through one adapter surface | treating pointer input, wall-clock waiting or worker stats as Site completion, resurrecting the deleted hit-count ritual helper, or adding protocol state directly to the host |
| Terminal/outcome flow | Sentinel protocol terminal controller + nudge terminal sequence helper | `src/domains/nudge/runtime/SentinelProtocolTerminalController.js`, `src/domains/nudge/nudge/nudgeGameTerminalSequence.js` | terminal sequence state, active global outcome, rift invite, media restore, resolution ACK policy, boolean-ACK reward-navigation gate, and pre-modal sequence timing | duplicating sequence/outcome/rift state in `SentinelProtocolHost` or rendering code |
| Session gate state | nudge session runtime | `src/domains/nudge/runtime/session/**` | atomic lease+pending begin with exact goal binding; `dispatching / entry_waiting / entry_cancelling / presented / episode_completed`; debt/terminal/shown/ack and terminal outbox under one lock; actual V2 daily receipt is separate | send-before-pending gaps, waiting/cancelling expiry treated as release, orphan lifecycle authorization, synthetic absorption, terminal-without-intent writes or hidden lock failures |
| Terminal effect delivery | nudge terminal effect coordinator + outbox state | `src/domains/tracking/background/NudgeTerminalEffectCoordinator.js`, `src/domains/nudge/runtime/session/nudgeTerminalOutboxState.js` | immutable run facts, required/completed stages, bounded failure evidence, message-time scheduling, and bootstrap replay after settings propagation restore | key-only checkpointing, inline-only side effects, reusing `runtime.settings_propagation`, or treating in-memory tracking projection as terminal truth |
| Cross-context teardown | protection nudge teardown coordinator + protection dispatcher serial lane | `src/domains/protection/background/protocol/dispatch/ProtectionNudgeTeardownCoordinator.js`, `src/domains/protection/background/protocol/dispatch/ProtectionDispatchSerialQueue.js`, `src/domains/protection/background/ProtectionDispatcher.js` | awaited production START through exact content ACK/terminal skip, live exact-document/run-ID STOP followed by matching-run terminal+outbox commit before lane release, tab-scoped drain scheduling, and gone-tab admission close -> terminalization -> final eviction | treating content stop ACK as background terminal evidence, detached production START, direct browser-event session aborts, releasing the lane before terminalization, or evicting a removed/replaced tab before terminalization |
| Runtime lifecycle messages | nudge lifecycle helper + Sentinel protocol host | `src/domains/nudge/nudge/nudgeGameLifecycle.js`, `src/domains/nudge/runtime/SentinelProtocolHost.js` | `NUDGE_PRESENTED` only after Global worker `FIRST_FRAME` or Site visible SVG paint; production lifecycle requires the exact issued run/tab owner and actual site hostname; presented and terminal response loss retry the identical run; presented authority left unconfirmed after bounded retries or explicitly rejected tears down the local protocol; debug lifecycle remains content-local | raw Chrome messaging, presented state before the selected renderer has paint evidence, continuing without confirmed presented authority, pseudo-host outcome attribution, lifecycle retry with changed identity, or any debug lifecycle request entering the background production handler |
| Page media suppression lifecycle | Sentinel protocol host + Sentinel media suppressor | `src/domains/nudge/runtime/SentinelProtocolHost.js`, `src/domains/nudge/nudge/nudgeGameMediaSuppression.js` | suppression starts only after selected-worker `FIRST_FRAME`; stop/terminal flows restore tracked media | suppressing page media while worker activation is still requested/boot-ready or leaving media suppressed after worker failure |
| HUD telemetry/debug mirror | nudge HUD telemetry helper | `src/domains/nudge/nudge/nudgeGameHudTelemetry.js` | in-memory/debug-only telemetry event and global mirror | telemetry as durable business state or localStorage source |
| Navigation and recovery | nudge control helper + trusted tracking message route + protection browser port | `src/domains/nudge/nudge/nudgeGameControl.js`, `src/domains/tracking/background/trackingMessageHandlers/nudgeCycleHandlers.js`, `src/apps/background/services/runtime/backgroundKernelProtectionBrowserPort.js` | canonical Room 478 handoff construction, exact trusted sender-tab `tabsUpdate`, ACK-validated runtime dashboard open, close/history/origin recovery ladder | navigating an extension page directly from the content world, trusting a payload tab id or arbitrary URL, treating a rejected/malformed runtime response as navigation success, or silent navigation fallbacks |
| Ritual sound cue dispatch | app sound runtime + Sentinel audio adapter | `src/domains/sound/runtime/appSoundRuntime.js`, `src/domains/nudge/nudge/nudgeGameAudio.js` | declared sound cue ids, theme sound pack resolution, bounded sound diagnostics | hard-coded audio file paths or WebAudio synths inside `SentinelProtocolHost` |

## Function Ledger

| Boundary function | Input | Output | Failure policy |
| --- | --- | --- | --- |
| `SentinelProtocolHost.start` | runtime config with explicit auto/debug mode, optional context, and bounded worker activation timeout | selected worker start outcome only after `FIRST_FRAME` | debug admission rejects before teardown when an auto host is active; unsupported, activation-failed, timed-out, superseded, or pre-first-frame worker outcomes reject without `NUDGE_PRESENTED` or media suppression |
| `normalizeNudgeWorkerRuntimeHost` | requested host | `extension_frame_worker` or explicit `content_worker` | absent/unknown host selects `extension_frame_worker`; explicit host is still bounded by support checks |
| `supportsWorkerRuntime` | selected runtime host | boolean eligibility | unsupported selected host rejects start rather than switching renderer owners |
| `startWorkerRuntime` | selected runtime host, bounds, config, protocol start | selected worker activation outcome | activation failure preserves selected host reject reason |
| `SentinelProtocolWorkerBridge.waitForActive` / selected runtime `waitForActive` | selected runtime and timeout | `FIRST_FRAME`-backed active outcome | missing runtime, worker error, or timeout returns a structured rejection; worker `READY` alone cannot resolve active |
| `buildWorkerProtocolProgress` | active host ritual/global state | minimal Global game-phase snapshot for worker control; Site has no worker dispatch | missing Global progress is not inferred by the worker runtime |
| `advanceSiteFurinFrame` | frame interval, presented flag, document visibility, Continue intent | decorative full 900 ms / brief 450 ms arrival and 750 ms uninterrupted hold; choices open at presentation | no passive completion or absorption; release cancels hold; hidden/unpresented time contributes zero; stalls capped at 100 ms |
| `applyRuntimeContext` | runtime context + config | active theme/language/variant | invalid theme ids fail through `assertNudgeRuntimeThemeId` instead of drifting |
| `normalizeSentinelFlareProtocolProfile` | nudge protocol profile input | scope, intensity, variant, escalation reason | malformed explicit scope/variant or scope/variant mismatch throws |
| `resolveNudgeProtocolScene` | normalized config | protocol scene descriptor | site/global renderer policy resolves before either strategy starts |
| `resolveNudgeEngineControl` | scene phase, protocol scene/progress, modal and terminal state | engine clock/spawn/split/input/render modes plus block reason | missing or unknown global phases throw instead of being treated as a runnable scene |
| `resolveGlobalSentinelSimulationProgress` | global ritual state and config | `awaiting_start`, `repair_race`, terminal progress | pre-start state reports zero sync pressure and cannot expire until the starter click |
| `startSentinelProtocolHostAtEntrySeam` / `beginSentinelEntrySeam` | NUDGE_START config, exact goal binding and current screen/input evidence | immediate debug start or exact owned automatic entry waiting/continuation result | idle/cap cancels rather than forcing display; unsupported primary-media/feed contexts wait; background revalidates before final presentation |
| `authorizeNudgeDebugControl` / `readActiveNudgeOwnerForTab` | debug source and target tab | authorization plus active production owner snapshot | disabled build/config/runtime debugger rejects; mutating debug control rejects while production ownership is active |
| `claimRitualSurface` / `releaseRitualSurfaceClaim` | surface type, owner id, scope, suppress/release callbacks | accepted claim or blocked result with active owner | lower-priority visual surfaces are suppressed centrally; callers do not own pairwise collision rules |
| `createNudgeTerminalSequenceState` | global outcome | terminal sequence state | malformed outcomes or explicit modes throw named terminal-sequence errors |
| `createSentinelProtocolTerminalController` | timer/controller callbacks and global outcome | terminal sequence, rift invite, media restore, navigation, and lifecycle resolution flow | terminal state resets at session boundaries; failed Room 478 handoff capture, unconfirmed resolution, structured-false navigation, or thrown navigation closes the invite, diagnoses the failure, and tears down without further navigation; stale terminal epochs cannot stop replacement sessions |
| `resolveSentinelRoom478HandoffRunId` | explicit auto/debug mode, issued production run ID, exact admission lease | production run ID for auto, issued manual Global lease ID for debug | missing/invalid identity or unknown mode throws; neither mode selects the other identity |
| `navigateSentinelRoom478` / `OPEN_NUDGE_ROOM_478` | mode-selected navigation identifier, seed, normalized origin, and trusted content sender tab | structured background navigation ACK for the canonical Room 478 URL on the same exact tab | content never assigns an extension URL directly; background rebuilds the URL, ignores payload tab identity, proves the exact document lease through bounded control inspection, and preserves explicit admission refusal, proof error, malformed handoff, update error, or mismatched tab receipt |
| `markSentinelNudgePresented` / `markSentinelNudgeAborted` | lifecycle state and reason | queued lifecycle send metadata and local lifecycle flags | presented transport loss retries the same run; explicit rejection is non-retryable; any authority left unconfirmed after the bounded attempt fail-closes the local host with a named diagnostic |
| `markSentinelNudgeResolved` | lifecycle state and reason | final lifecycle result with structured send result | resolve intent is reserved before transport so abort cannot overtake it; send failure returns `resolved: false`, tears down the overlay, and gates success-reward navigation |
| `beginNudgeRun` / `abortNudgeRunBeforePresentation` | exact key, run id, tab id, actual hostname, protocol claim | one session patch containing dispatching pending+lease, or exact pre-presentation abort fence | a different live owner rejects; the runner never sends `NUDGE_START` before the issued-run evidence exists; an already-presented run is not erased by a late dispatch error |
| `markNudgeGoalCancelling` / `createProtectionGoalEpisodeInvalidator().revalidate` / `completeNudgeGoalCancellation` | original exact goal binding, fresh policy/day/profile facts and first cancellation cause | retained cancelling checkpoint + frozen binding/cause receipt -> matching admission and content cleanup -> named full terminal/debt/outbox commit and existing effect drain | failed cleanup retains ownership and first cause; generic dispatch abort refuses cancelling, producer abort only ACKs non-terminal pending; missing cause rejects untouched; no synthetic Site shown/ACK or absorption path |
| `markNudgeResolved` / `markNudgeAborted` | exact key, run id, tab id and immutable terminal facts | atomic terminal mutation plus run-keyed pending outbox entry, or idempotent same-owner replay receipt | opposite status/tab/key conflicts; terminal truth is never committed without its effect intent |
| `createNudgeTerminalEffectCoordinator().scheduleDrain` / `drainPendingEffects` | pending outbox entries | scheduled receipt or replayed stage checkpoints | message response waits only for terminal+intent commit; worker restart resumes pending stages after settings propagation restore |
| `createProtectionNudgeTeardownCoordinator().stopLiveTab` / `terminalizeGoneTab` | live or gone tab id, reason, timestamp | content stop result when applicable plus canonical terminalization and scheduled-receipt evidence | stop transport failure still terminalizes; split run/tab owners, missing global hostname truth, terminal conflict, and missing scheduler receipt fail loudly |
| `handleSelectedWorkerRuntimeFailure` | selected worker error after presentation readiness | named recovery diagnostic, `NUDGE_ABORTED`, stop/teardown, and media restore | an already-presented intervention never remains mounted as a workerless overlay or silently changes renderer owner |
| `publishSentinelTelemetrySnapshot` / `clearPublishedSentinelTelemetry` | debug snapshot/global key | debug event/global mirror result | debug mirror failures are visible but non-canonical |
| `playAppSoundCue` via `playSentinelFurinPreludeChime` | declared cue id plus Sentinel Furin context | scheduled theme sound cue or bounded diagnostic false | missing cue/pack/asset does not substitute another sound and does not block ritual progression |

## Recovery Versus Fallback

### Diagnostic HUD

The runtime debugger's sender-tab force action preserves a concrete dispatch
error as its response error; the generic skip reason remains separate in the
dispatch result. Its Sentinel timeline view displays the bounded owner error
before scope or reason, with the dispatch reason shown separately. The existing
timeline retention, string limits and HTML escaping remain authoritative; this
presentation does not add storage, change activation or retry a failed start.
The same failure response and sender-tab timeline carry only the existing public
START diagnostics `runtimeStage`, `lastError`, `hostConnected`,
`hostChannelAuthenticated`, `workerBootReady`, and `workerFirstFrameReady`.
`SentinelProtocolTimeline.projectSentinelStartFailureDiagnostics` owns this
closed projection: the two strings retain at most 220 characters, booleans retain
their exact type, and absent or invalid values are `null`/unavailable rather than
false. No diagnostic object is available when the content START response lacks
one. Before `START_FAIL` and cleanup, the Host projects the exact selected
worker readiness outcome's diagnostic snapshot and overlays only those six
fields onto its existing main failure response. It does not reread the retired
worker or retain the readiness outcome's raw payload. The canonical host
diagnostic builder preserves the selected worker's authentication boolean,
and the dispatch runner, timeline and page probe use
the same projector without retaining raw worker payloads, URL, capability,
nonce or session fields. Timeline snapshots clone the six-field object; its
existing retention also bounds failure diagnostics. The HUD escapes every value
and shows missing diagnostics explicitly without reading private runtime state.

HUD visibility is the explicit normalized `hudVisible` option, not an automatic
consequence of the development build. Runtime and debug settings default it off;
human Site/Global QA setup also defaults it off, with `--hud-visible=true` as the
explicit diagnostic view. Structured host/worker QA snapshots remain available
without the HUD. Automated Sentinel runtime targets retain their declared HUD
default.

Global HUD keeps the actual `ENTROPY_RUNTIME_BUILD_INFO.buildId` in the title
element's inspection metadata; it must not maintain a manually dated build stamp.
The compact, noninteractive panel has no animated decoration. Its visible
telemetry is limited to input/view, entry stage/clock, origin/runtime, and
hit/render timing. Full structured runtime snapshots remain the diagnostic owner.
The display reads approved input
count, crack threshold, repair pressure, remaining time, and last hit quality
from canonical protocol progress. The old fracture-derived dormant count is not
presented as a caught-fish count. Entry labels consume
`resolveGlobalSentinelRuptureRevealPresentation` from the entry owner, including
LCD failure, power-off, giant-koi recovery, rewind, and handoff. No independent
HUD timeline or game state is maintained. Only active entry diagnostics use a
50ms refresh interval; normal HUD refresh stays at 200ms and hidden HUDs do not
format or publish text. Renderer timings read selected-runtime stats and missing
measurements display as unavailable, never as zero-cost frames.

Production `NUDGE_STOP` (including tab-switch/window-blur teardown) only stops
the auto host. A debug host acknowledges with `stopped: false` and
`reason: debug_session_owned`; only `NUDGE_DEBUG_STOP` owns debug cancellation.
This keeps manual QA alive across operator focus changes without changing the
automatic detector thresholds. Production START also rejects with
`production_control_blocked_by_debug` while a debug host is active, before
arming an attention seam; the host repeats the admission check at actual start.
The existing reverse rejection (`debug_control_blocked_by_production`) remains.
This is an explicit content-local debug ownership boundary, not a production
cooldown or a setting override. Normal production ritual priority, mandatory
Gate authority, and background lifecycle ownership are unchanged.

| Class | Allowed? | Rule |
| --- | --- | --- |
| Selected worker unsupported | No silent fallback | Start rejects with selected runtime evidence and stops |
| Selected worker activation fails | No silent fallback | Start preserves the structured rejection reason from the worker path |
| Worker `READY` without `FIRST_FRAME` | No presentation fallback | Start remains pending until the bounded first-frame barrier, then rejects and tears down without presentation lifecycle or media suppression |
| Worker `ERROR` after `FIRST_FRAME` | No degraded continuation | Host records the worker failure, emits `NUDGE_ABORTED`, stops the session, tears down the overlay/worker, and restores suppressed media |
| Missing scene phase | Boundary default | Absent phase defaults to ritual at the scene helper boundary; malformed explicit phases throw |
| Invalid runtime theme id | No silent fallback | Theme id must assert through the runtime context boundary |
| Invalid protocol profile | No site/furin fallback | Explicit malformed protocol scope/variant and mismatches throw before ritual/copy presentation |
| Main canvas renderer after worker failure | No | Worker failure must not be reinterpreted as a main-render success path |
| Furin audio cue failure | Bounded | App sound runtime and Sentinel audio adapter report named diagnostics without blocking ritual progression |
| Session lock work failure | No silent fallback | Failing operation rejects, emits `nudge_session_lock_work_failed`, and later queued work continues |
| Invalid terminal outcome | No success fallback | Unknown terminal outcomes or explicit modes throw named errors |
| Navigation after user leaves | Bounded | Runtime dashboard open counts only after a structured success ACK; rejected, malformed, or failed sends continue through close, history, and origin replacement with named diagnostics |
| Room 478 entry | Exact background owner | Content submits only the canonical handoff; the trusted route rebuilds the extension URL and updates only `sender.tab.id`. Invalid handoff, missing tab-update owner, update error, or mismatched updated-tab identity fails loudly; no direct content-world extension-page navigation is retained. |
| HUD telemetry global mirror | Debug only | Debug mirror/event cannot become source of truth or durable state |

## First-Pass Findings

### F1. Main thread is host, not current render owner

Status: documented keep.

The content host still owns overlay structure, runtime context, copy, ritual
orchestration, terminal controller wiring, and lifecycle messages. The selected
worker runtime owns canvas rendering for the active path.

### F2. Extension-frame worker is the default host

Status: keep.

`workerRuntimeHost` defaults to `extension_frame_worker` and resets to that host
on stop. Debug callers may explicitly request `content_worker`, but that path is
not the production default and remains bounded by worker-surface admission.

### F3. Protocol scene routing is the visual SSOT

Status: strengthened.

`nudgeProtocolScene.js` declares the renderer strategy before activation. The shared host selects Site `host_dom/furin_svg` or Global `extension_frame_worker`, each with its own paint acknowledgement. This explicit strategy is not a failure fallback. Admission and lifecycle remain common.

The session controller owns Site visible-frame progression; the worker never infers it. Global snapshots still enter the worker engine through the existing control helper. Pointer movement changes Site presentation only.

### F4. Global start is explicit after commit

Status: milestone active.

Global commit does not mean the repair race clock has started. The content host
and selected worker must agree on `awaiting_start` until the starter koi is
clicked. Main-thread ritual progress owns the same phase vocabulary as worker
stats, while the worker engine owns starter koi hit testing and crack-origin
capture. Future input-gate work belongs at the content host/protocol gate, not
inside policy/storage layers.

Global input is a single-flight, serial-correlated boundary. The worker returns
the accepted timestamp, exact hit efficiency, accepted point plus accept-time
viewport ratios, and complete protocol outcome snapshot. The ratios remain the
canonical rupture/Room 478 origin if the viewport changes before the response;
the Host must not derive them again from response-time bounds.
`SentinelProtocolSessionController` recomputes that
outcome from its host-owned state and commits only after every canonical field
matches; a missing, stale, or divergent result tears the ritual down instead of
letting the canvas and lifecycle disagree. Worker misses are also delivered so
the in-flight gate cannot remain stuck.

The same Host snapshot is the only phase input to `resolveNudgeEngineControl`.
Worker-local diagnostics may drive rendering and validated outcome computation,
but cannot open input, spawn, or clock permission. A global engine activation
without a canonical `protocolSystem + gamePhase` snapshot fails explicitly.

The semantic accessibility command is separate from physical pointer timing.
It selects the engine-owned starter or repair entity center and applies a
deterministic center-window hit; when the post-starter school is empty, the
engine admits one bounded canonical spawn before activation. Physical pointer
input still requires the primary pointer/button and the declared vulnerability
window. Global activation also fails loudly when `maxTotalSpawned` is below the
minimum stroke budget implied by the canonical fracture policy.

## Verification Targets

Use these checks when this boundary changes:

- `npm run test:file -- tests/sentinelProtocolHostFacade.test.js tests/sentinelProtocolHostSessionModel.test.js tests/sentinelProtocolSessionController.test.js tests/sentinelProtocolTerminalController.test.js tests/sentinelProtocolWorkerBridge.test.js tests/sentinelProtocolTimerController.test.js tests/sentinelProtocolPresentationAdapter.test.js tests/sentinelProtocolDiagnosticsBuilder.test.js tests/globalSentinelEntryController.test.js tests/nudgeGameRuntimeCanvasMode.test.js tests/nudgeExtensionFrameWorkerProbe.test.js tests/nudgeExtensionFrameWorkerRuntime.test.js tests/nudgeSwarmWorkerEntry.test.js tests/sentinelFlareProtocolProfile.test.js tests/nudgeGameTemplateProtocolOwnership.test.js tests/nudgeGameGlobalSentinelProtocol.test.js tests/nudgeGameEngineControl.test.js tests/nudgeGameMediaSuppression.test.js tests/nudgeGameLifecycle.test.js tests/nudgeSessionOwnerState.test.js tests/protectionControllerNudgeDebugSpawn.test.js tests/protectionNudgeDispatchMessageBuilder.test.js tests/supportDebugPolicy.test.js tests/supportActionHandlers.test.js tests/trackingMessageHandlerNudgeLifecycleContract.test.js tests/nudgeSwarmEngine.test.js`
- `npm run check:docs:paths`
- `git diff --check`

### Global starter viewport preparation (2026-09-09)

An eligible initial pointer or semantic keyboard action requests fullscreen
synchronously in that gesture, before worker acknowledgement consumes time.
The input controller then sends serialized starter preparation. The selected
engine reserves the hit entity and normalized impact coordinates without changing
fracture, repair clocks or ink lifetime. A missed target never starts the film.
Viewport preparation awaits the same fullscreen promise and a quiet resize
interval. The host publishes canonical canvas bounds before the same interaction
serial commits its reserved starter. The engine maps its stored ratios to that
settled viewport and starts the canonical entry timeline.
Repeated input is blocked during preparation; reset cancels pending preparation.

Fullscreen is an optional platform presentation seam, not game authority.
Unsupported or rejected requests emit named diagnostics through
`reportSentinelRuntimeRecoveryFailure` and commit in the settled existing window.
There is no substitute fullscreen API. Another awaiting-start gesture may retry a
denied request; later gameplay clicks never request fullscreen. The
exception lasts only while fullscreen remains optional browser presentation.
A hung request (1200ms) or continuously unstable viewport (800ms) rejects the
input preparation and tears down the protocol; it cannot reveal moving cracks.
Only fullscreen acquired by this controller is exited. Late owned acquisition
after cancellation is released without cancelling a replacement session's waits
or fullscreen ownership. Pre-existing fullscreen is preserved.
The controller's bounded timers/listeners are cleaned on settle or cancellation.
Tests: `tests/sentinelProtocolFullscreenController.test.js`,
`tests/sentinelProtocolInputController.test.js`, `tests/nudgeSwarmEngine.test.js`.

### Global ending and spatial handoff (2026-09-09)

After selected-worker presentation and starter acceptance, the host retains one
prepared `GlobalSentinelPageIsolation` lease before acquiring native DOM ownership.
A partial acquisition or restoration failure leaves that exact handle available
to the existing explicit stop retry; successful restoration retires ownership.
The overlay is an exact independent child of
the document element, outside the page body. The lease makes that body inert,
freezes native document/body overflow and overscroll, and lets the overlay root
own viewport pointer hit-testing. Event rejection alone cannot suppress native
scrollbar dragging or CSS hover on the covered page. Awaiting-start retains its
declared native scroll policy. Existing arbiter input authority and semantic focus
routing remain separate owners. The lease spans entry, repair, terminal, Rift
opening and resolution/navigation acknowledgement, and stop releases its exact
owned styles/attributes without overwriting later external changes. It adds no
new timer, observer, admission state or input eligibility rule.

`nudgeGameTerminalSequence` owns actor departure and a four-second settle after
their fade completes. The existing worker fracture surface remains mounted
throughout that quiet interval. Success then enters `rift`; the explicit action
stays disabled until the shared `GLOBAL_SENTINEL_RIFT_APERTURE_OPEN_MS` has
elapsed. The thirty-second invitation clock begins after opening, not on the
last successful hit. No hover-triggered navigation exists.
TerminalController captures one Rift `startedAtMs` in `Date.now` epoch
milliseconds before phase callbacks. Host retains it for the phase and forwards
it unchanged through `SET_SCENE_PHASE` to the worker engine. Aperture progress
and the opening timer both use that timestamp, including delayed message receipt;
same-phase replay cannot reset it. The wire rejects a missing or invalid
timestamp explicitly. Worker-local performance samples are not phase clocks.

`SentinelProtocolHost.syncRiftInviteGeometry` projects the selected runtime's
canonical seed and committed origin through the same fracture/aperture resolvers
used by Room 478. `NudgeOverlayHost.setRiftInviteGeometry` owns only the DOM
hit region and its keyboard-accessible button. A small or edge-clipped aperture
gets a transparent 44px minimum target contained within the viewport (or the
available extent on a smaller viewport), with an inset visible focus ring.
The canvas contour does not grow to match that target. The visible material
continues to belong to the renderer; no rectangular text button covers it.
After aperture opening, the existing localized action label is also projected
into a small visible caption beside the aperture. The caption is pointer-transparent
and shares the invitation's hidden state; it cannot widen the target or navigate.
This makes the next deliberate action visible without a second copy owner or HUD.
Resize reprojects that same geometry without generating a new fracture.

The default `direction_distributed` skeleton spreads six or seven seeded primary
directions in normalized space; exact boundary origins select an inward sector
before generation. Existing named comparison archetypes remain explicit choices.
This is a product design adaptation of the prototype, not its viewport-dependent
generator. `globalSentinelFractureGeometry` owns the shared 32-point impact bleed
contour. LCD damage and the small Rift aperture consume that contour from the
same seed and exact origin; Rift uses terminal damage `0.4` and the existing
puncture clock. Selected primary first/second nodes remain the crack ledger,
not the aperture size. Rift interior and edge are clipped inside the contour,
so white LCD and fracture material remain outside it. Invalid explicit geometry
fails loudly. No protocol phase, three-act duration, admission, or outcome changes.

The terminal controller captures the admission lease and handoff before async
resolution. It retains the original overlay until exact-tab Room 478 navigation
is acknowledged, and fences subsequent cleanup with the terminal epoch. Failure
is diagnosed and tears down without redirecting to an unrelated destination.
Media restoration, resolution, navigation, and cleanup exceptions belong to the
terminal operation's named stage. The Host records the original error through
`reportSentinelRuntimeRecoveryFailure` (`terminal_media_restore`,
`terminal_resolution`, `terminal_navigation`, or `terminal_cleanup`) and its
existing `lastRuntimeError`. Restoration or resolution rejection attempts the
canonical stop once before settling as a structured failure (or `false` for
Rift entry); timer-triggered endings own the same rejection path. Navigation and
stop use separate error boundaries, so a cleanup error cannot be classified as a
navigation error or cause an automatic second stop. The exact failed cleanup
owner remains available for an explicit stop retry, including when that stop
advanced the terminal epoch before throwing. Stage diagnostics are recorded
after stop's ordinary state reset. A stale rejection is diagnosed as stale and
cannot stop or overwrite the runtime error of a replacement session. No alternate
navigation, playback restart, eligibility rule, or terminal timing is introduced.
`resolveSentinelRoom478HandoffRunId` selects the Room 478 URL's navigation
identifier explicitly by mode: automatic Global uses its issued production run
ID; manual/debug Global uses its already-issued manual Global admission lease
ID. Missing or invalid identity fails the handoff capture. The navigation
identifier does not become production lifecycle provenance: debug's production
run ID remains null. This selection creates no identity and supplies no fallback
between modes. Background navigation still authorizes the exact admission lease,
trusted sender tab and document before updating that tab.
The Room 478 background handler opts into the admission service's explicit
`documentHandoff` completion. A successful exact-tab update ends and persists the
authorized lease in the same serialized lane, so document destruction cannot lose
the only ownership release. A failed update retains ownership; stale later content
cleanup cannot release the next intervention.
Room 478 starts with the same aperture and fracture vertices in viewport
coordinates, holds them briefly, then transforms those vertices into floor lines
as the room becomes visible. Its parent never scales or offsets that geometry.
Cross-document browser paint timing remains a real QA concern; matching the
geometry does not guarantee a zero-frame navigation discontinuity.

## Cross-intervention admission (2026-09-09)

Room 478 presents one always-available, explicitly labelled return action. The
duplicate still-phase return control is removed; Escape and the existing exact
navigation/departure owner remain unchanged. Repeat breathing remains available
only in still and cannot replay after pause or departure.

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

## Site Furin cutover — 2026-09-13

The Site strategy shares this host/session/lifecycle, with DOM owned by NudgeOverlayHost and visuals through the narrow Zen api/furin seam. The host frame loop is the only Site interval clock. No Site worker FIRST_FRAME, spawn diagnostics, gesture acquisition, full-screen request, school assembly or return dwell remains active. The selected-worker requirements elsewhere in this map apply to Global. PageMediaHold and SiteFurinPageIsolation own immediate HTML media hold, replay prevention, inert page controls and native overflow. Explicit Site resolution ACK precedes playback/navigation. See the current chime spec for reach limitations and archive location.

The 2026-10-02 composition presents the shared glass chime, factual total/goal and
two immediate choices. Paper catching and timeline gathering are retired. A
presented Leave or completed Continue hold marks explicit absorption before the
canonical resolution ACK; passive arrival never does. The presenter has no
pointer-driven motion and sleeps after physical settling. An acknowledged Close
starts one automatic 600 ms breeze/cue before removal while retaining the exact
admission lease. Continue retains a neutral fade. Failed closure cancels the
filled animations and restores visible controls.
