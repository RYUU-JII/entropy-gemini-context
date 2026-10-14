# Nudge Worker Runtime Boundary Map

- Status: Active
- Owner: repository architecture, nudge runtime, platform workers
- Last validated against code: 2026-09-09
- Path policy: current-only
- Canonical for: Sentinel Flare content worker host, extension-frame render activation, OffscreenCanvas ownership, worker spawn telemetry, and worker failure boundaries
- Companion to:
  - `docs/architecture/repository/friction-nudge-effect-boundary-map.md`
  - `docs/architecture/workers/worker-runtime-control-plane.md`
  - `docs/architecture/themes/zen/zen-sentinel-render-pipeline.md`

## Purpose

This map audits the active Sentinel Flare worker path. It answers which layer
owns the start signal, iframe render host, OffscreenCanvas transfer, worker loop,
spawn diagnostics, and failure reporting.

The practical reading question is:

```text
Can a nudge worker change identify the exact activation owner and failure path
without adding a silent main-thread fallback, a second renderer, or an
undiagnosed cleanup branch?
```

## Current Runtime Status

The active content nudge render path is `extension_frame_worker`.

```text
SentinelProtocolHost.start
  -> NudgeExtensionFrameWorkerRuntime.activate
  -> src/pages/nudge-render-host.html
  -> src/apps/nudge-render-host/main.js
  -> nudgeSwarm.worker.js
  -> NudgeSwarmEngine
  -> FIRST_FRAME
```

The iframe is an extension-owned host for MV3/CSP compatibility. It is not a
second renderer. The physical render worker for the active session is
`nudgeSwarm.worker.js`.

`nudge_content_swarm` is still registered in the shared worker runtime control
plane, but that direct prepared content-worker path is disabled by flag and is
not the default source of render truth.

The extension-frame host distinguishes debug probes from the persistent
`nudge_swarm` runtime. Public builds may disable debug tools and probe admission,
but that flag must not disable the persistent production render session.

Worker `READY` is boot evidence, not presentation readiness. The selected
runtime becomes active only after the frame host reports `FIRST_FRAME`; the main
host must not report start success, `NUDGE_PRESENTED`, or page-media suppression
before that event.

Worker activation failure is loud. The current start path does not silently
recover by switching to a main-thread renderer after the extension-frame worker
was selected.

The runtime owns one frame-navigation invariant: its render-host iframe must
have no `srcdoc` attribute. Presence, including an empty value, overrides the
canonical extension `src` and rejects as
`extension_frame_worker:frame_host_navigation_overridden:srcdoc`. The owner
checks after append, on that frame's `load`, at active-readiness entry and its
existing deadline, and before authenticated channel/event admission. A load
callback is bound to the exact frame and session and is removed on destroy.
The failure uses existing worker-error, waiter settlement and host teardown;
it never removes the attribute, retries navigation, changes the deadline or
chooses another host. This identifies the invalid navigation state, not the
external attribute writer or a successful game presentation.

## System Flow

Runtime host selection starts in `SentinelProtocolHost` and is routed through
`SentinelProtocolWorkerBridge`:

```text
src/domains/nudge/runtime/SentinelProtocolHost.js
  -> src/domains/nudge/runtime/SentinelProtocolWorkerBridge.js
  -> runtimeHost defaults to extension_frame_worker
  -> supportsRuntime()
  -> activateSelectedRuntime()
```

Runtime-host selection enters through
`src/domains/nudge/runtime/SentinelProtocolHost.js` and its named worker bridge;
there is no compatibility game entrypoint.

The extension-frame activation data plane is:

```text
NudgeExtensionFrameWorkerRuntime
  -> background issues one tab/session/nonce-bound capability to the trusted top-frame content sender
  -> runtimeGetURL("src/pages/nudge-render-host.html")
  -> create hidden iframe inside the nudge scene
  -> public HOST_READY carries no authority
  -> send START with the one-time capability and a transferred MessagePort
  -> src/apps/nudge-render-host/main.js
  -> exact render-host extension frame consumes the capability through background
  -> all later commands/events use the authenticated MessagePort only
  -> transferControlToOffscreen()
  -> new Worker(nudgeSwarm.worker.js?worker&url)
  -> INIT
  -> READY
  -> ACTIVATE
  -> FIRST_FRAME / STATS / SPAWN_STATUS / HIT_RESULT / ERROR
```

The worker implementation is:

```text
nudgeSwarm.worker.js
  -> createNudgeSwarmEngine()
  -> resolveNudgeProtocolScene(config)
  -> drawNudgeProtocolSceneBackground()
  -> drawNudgeEntity()
```

Only Global Sentinel uses this worker engine. Site Furin is the explicit host DOM/SVG strategy described in [the chime contract](../themes/artifacts/sentinel-flare-site-furin-chime-spec.md); a Site swarm init fails with `site_furin_has_no_swarm`.

## Canonical Owner Table

The Global Sentinel repair pass stays inside the worker canvas. The engine
captures the current rhythm beat's canonical fracture site, normalized actor
source and pre-hit damage in its existing hit-aftermath record.
`src/domains/nudge/rendering/GlobalSentinelRepairMaterial.js` derives sites from
the shared skeleton and paints local LCD restoration and contact response.
`GlobalSentinelLcdMaterial.drawGlobalSentinelGlassFracture` alone paints the
primary/branch network, shared by entry and white LCD. Repair rupture only
validates that pass's selected ray; it never retraces it. The LCD material
normalizes accepted damage by the actual protocol threshold supplied through
engine diagnostics and scene options. Clipping extensions remain panel-only.
Only attached optical/contact settling uses elapsed time. Canonical
game state, diagnostic fracture, input and terminal ownership remain unchanged.
No host DOM seam, persistent state or additional crack topology is created.
The entry retains the starter's actual `NudgeShadowKoiEntity` / `KoiFish` actor
for the detached spy and its giant return. The session-scoped presentation
reference survives expiry of the transient ink burst; engine teardown releases
it. `ZenSentinelRecoverySweep.js` uses that same actor through the foreground
draw seam. Starter commit reanchors the same native pose and its aliased rig
points once at the settled viewport contact, preserving motor memory. The shadow
keeps one native outward course until its complete body and tail leave; the same
actor then returns already giant from offscreen, without central growth.
`GLOBAL_SENTINEL_ENTRY_STAGES` owns the shared 18500ms clock:
impact 0–350, detachment 350–1700, shadow departure 1700–6100, overlapping
electrical cascade 2350–6700, power loss 6700–7350, white-field false calm
7350–9500, giant return and repair 9500–17000, quiet handoff 17000–18500ms.
`GlobalSentinelLcdMaterial.js` keeps the original seed, origin and LCD geometry
fixed while the giant's passage reveals the restored surface.

`nudgeGameEngineControl.js` holds spawn, split and input until entry finishes;
the first small-koi approach begins at 20300ms and its active window at 22900ms.
The canonical protocol then owns three accepted resistance acts: `discovery`,
`system_surge`, `final_decision`. Later acts start from the preceding accepted
stroke, not a free-running metronome. `repair_beat` admits only one live repair
sentinel and no splits. Missing a window repeats the current act and repairs
only volatile damage; stable damage and completed acts survive. The final
4500ms contact window holds 0.1x actor motion, while the protocol clock remains
real time. Starter plus three accepted acts is mandatory even for high-impulse
configurations. The default pressure clock is 54000ms, with a 60000ms hard cap.

`fractureRepairBeatIndex` identifies the exact missed seam; rendering must not
derive it from elapsed time or a now-retired fixed cadence. Accepted hit
aftermath remains visible during the following act's breath, where the new
beat index is intentionally -1. `SentinelProtocolDiagnosticsBuilder` projects
the same act, phase, timing and repair index from the selected runtime; it must
not combine a stale main-engine phase with active worker telemetry.
The shared `projectGlobalSentinelRhythmStats` projection in
`nudgeGameRuntimeUtils.js` is used by worker `STATS`, stats normalization,
extension-frame diagnostics and the main diagnostic builder. The frame host
forwards this payload unchanged; missing phase evidence stays missing rather
than inheriting a previous frame's phase.

| Concern | Canonical owner | Canonical path | Source of truth | Forbidden shortcut |
| --- | --- | --- | --- | --- |
| Runtime host selection | Sentinel protocol worker bridge | `src/domains/nudge/runtime/SentinelProtocolWorkerBridge.js` | `workerRuntimeHost`, default `extension_frame_worker`, selected/active runtime routing | feature-local host flags that bypass `SentinelProtocolHost` |
| Extension-frame worker runtime | nudge extension-frame runtime | `src/domains/nudge/runtime/NudgeExtensionFrameWorkerRuntime.js` | iframe session id, nonce, one-time capability request, MessagePort bootstrap, distinct worker-boot and first-frame readiness, active stats | direct iframe construction outside the runtime, window-postMessage data plane, or treating worker `READY` as active presentation |
| Frame-host capability admission | ephemeral broker + exact sender route | `src/domains/nudge/runtime/frame-host/NudgeFrameHostCapabilityBroker.js`, `src/apps/background/services/runtime/messageRoutes/nudgeFrameHostCapabilityMessageRoutes.js` | secure-random, TTL-bounded, one-time capability bound to top-frame issuer tab plus exact render-host session/nonce consumer | trusting arbitrary parent origin/source, putting the capability in the iframe URL, accepting another extension page, or retaining a reusable token |
| Authenticated frame-host channel | render-host channel owner | `src/domains/nudge/runtime/frame-host/NudgeRenderHostChannel.js` | capability-verified `START` bootstrap and exclusive MessagePort command/event plane | accepting `WORKER_MESSAGE`/`DEACTIVATE` from the public parent window or treating first-message wins as authentication |
| Extension render host page | nudge render host app | `src/pages/nudge-render-host.html`, `src/apps/nudge-render-host/main.js` | canvas transfer, worker construction, authenticated message forwarding, `FIRST_FRAME` evidence, debug-probe admission, and persistent `nudge_swarm` admission independent of the debug-tools build flag | content page constructing `nudgeSwarm.worker.js` directly, raw parent-window command handling, or gating the production persistent runtime behind debug tooling |
| Worker implementation | nudge worker runtime | `src/domains/nudge/nudgeSwarm.worker.js` | OffscreenCanvas loop, protocol messages, stats emission | protocol-specific renderer branches in the worker shell |
| Swarm engine | nudge render engine | `src/domains/nudge/engine/NudgeSwarmEngine.js` | entities, spawn cadence, split cadence, hit behavior, Nudge-owned render-pressure state, draw calls, and Global logical live-limit enforcement | reintroducing `GlobalSentinelRenderer` or `ZenSentinelEngine`, or letting render pressure erase declared ritual actors |
| Protocol scene routing | nudge protocol scene | `src/domains/nudge/protocols/nudgeProtocolScene.js` | renderer kind, actor style, background mode, spawn/motion/hit policy | ad hoc protocol routing in host, worker, or draw helpers |
| Engine execution control | nudge engine control helper | `src/domains/nudge/nudge/nudgeGameEngineControl.js` | `scenePhase + protocolProgress` resolved into clock/spawn/split/input/render modes consumed by `NudgeSwarmEngine` | direct worker/engine checks that reinterpret Global game phases or terminal scenes |
| Worker protocol | nudge worker protocol | `src/domains/nudge/runtime/NudgeProtocol.js` | message type catalog and session envelope | string messages outside the protocol enum |
| Worker telemetry | in-memory nudge runtime | `NudgeExtensionFrameWorkerRuntime` | immediate UI/debug snapshot including Canvas backend, effective DPR, and frame-work timing only | localStorage or durable worker telemetry mirrors without a typed store |
| Direct prepared content-worker path | disabled worker bridge | `src/domains/nudge/runtime/NudgePreparedWorkerRuntime.js` | registry status gate for `nudge_content_swarm` | treating disabled prepared path as active fallback truth |
| Debug spawn diagnostics | Sentinel protocol host + selected worker runtime | `SentinelProtocolHost.spawnDebug`, selected runtime waiters | runtime, phase, rejection reason, diagnostics object | resolving debug spawn as success without worker/main ownership evidence |

## Function Ledger

| Boundary function | Input | Output | Failure policy |
| --- | --- | --- | --- |
| `SentinelProtocolHost.start` | runtime config with optional runtime host metadata | start outcome for selected worker host only after `FIRST_FRAME` | unsupported, failed, timed-out, or pre-first-frame errored selected worker returns a rejected outcome and stops without presentation lifecycle or media suppression |
| `supportsWorkerRuntime` | selected host and browser APIs | boolean eligibility | extension-frame unsupported is an explicit selected-host failure, not a main-render fallback |
| `NudgeExtensionFrameWorkerRuntime.activate` | container, bounds, config, runtime context, protocol start | requested worker activation or rejected outcome | invalid config/support/post/start failures carry `extension_frame_worker_*` reject reasons |
| `NudgeExtensionFrameWorkerRuntime.rejectOverriddenFrameNavigation` | current owned frame and activation | unchanged valid frame or existing worker-error settlement | any `srcdoc` presence rejects explicitly; frame attributes remain untouched, stale frame/session loads are ignored, and no observer, extra timer or host retry is introduced |
| capability issue / consume | trusted top-frame content sender; then exact extension render-host frame with matching tab/session/nonce/token | one short-lived, one-time authorization receipt | missing secure randomness, stale/unknown token, sender/path/frame mismatch, reuse, or binding mismatch rejects loudly before worker construction |
| render host `START` bootstrap | session, nonce, capability, transferred MessagePort, dimensions, config, render mode, runtime mode | authenticated MessagePort plus OffscreenCanvas worker session | arbitrary parent origin is not identity; only background-consumed capability may bind the port. Public builds admit persistent `nudge_swarm` regardless of debug-tools flag; disabled debug tools reject probe sessions, and host support failures terminate constructed worker state |
| render host channel command | authenticated MessagePort message with exact session/nonce | forwarded worker command or teardown | window `WORKER_MESSAGE`/`DEACTIVATE`, wrong port/session/nonce, and repeated `START` are ignored; there is no window data-plane fallback |
| `nudgeSwarm.worker INIT` | OffscreenCanvas, bounds, dpr, theme, config | `READY` with render-budget policy id | missing canvas/context causes explicit worker errors instead of host fallback |
| `nudgeSwarm.worker ACTIVATE` | bounds, dpr, theme, config, protocol progress snapshot | active OffscreenCanvas render loop | activation failure posts `ERROR` and stops runtime state |
| render host `FIRST_FRAME` emission / `NudgeExtensionFrameWorkerRuntime.waitForActive` | rendered stats or rendered spawn evidence plus bounded timeout | first-frame-backed active outcome | worker `READY` alone remains boot-only; missing first frame, timeout, or worker error rejects active readiness |
| `nudgeSwarm.worker SET_PROTOCOL_PROGRESS` | host protocol progress snapshot | updated engine control authority | missing required Global game phase fails through `resolveNudgeEngineControl` instead of guessing |
| `NudgeSwarmEngine.init` | ctx, bounds, config, theme, protocol start | reset entity simulation | protocol scene resolves from config before rendering starts; Site rejects with `site_furin_has_no_swarm` |
| `NudgeSwarmEngine.handlePointer` | primary-pointer canvas coordinates | serial-correlated hit result with accepted time, efficiency, point, and outcome snapshot | `global_sentinel` first accepts starter koi to begin `repair_race`, then removes only vulnerable sentinels through scene interaction policy |
| `NudgeSwarmEngine.handleEligibleGlobalTarget` | semantic activation command | engine-selected canonical entity-center hit | accessibility may bypass the visual vulnerability timing at deterministic center-window efficiency, but cannot guess a coordinate, bypass spawn budget, or become a second outcome owner |
| `NudgeExtensionFrameWorkerRuntime.forceSpawnAndWait` | spawn hint and timeout | rendered/rejected/timeout outcome | unavailable/inactive/not-ready worker returns explicit rejection reason |
| `NudgeExtensionFrameWorkerRuntime.handleHostMessage` | iframe events | boot readiness, first-frame readiness, normalized stats, telemetry, spawn lifecycle | stale session/nonce messages do not mutate active runtime state; only `FIRST_FRAME` settles active waiters successfully |

## Recovery Versus Fallback

| Class | Allowed? | Rule |
| --- | --- | --- |
| Extension-frame worker selected but unsupported | No silent fallback | Start rejects with an extension-frame reason and tears down the session |
| Extension-frame worker activation fails | No silent fallback | Host/worker error enters selected worker failure path |
| Render-host frame has `srcdoc`, including empty | No navigation repair | Diagnose `frame_host_navigation_overridden:srcdoc` through the same selected-runtime failure path; leave the attribute untouched and release owned load listeners during teardown |
| Worker `READY` without `FIRST_FRAME` | No presentation fallback | Boot readiness does not settle active waiters; the bounded first-frame wait rejects and tears down without `NUDGE_PRESENTED` or media suppression |
| Persistent `nudge_swarm` in a public build | Required production path | The debug-tools flag may disable probe sessions only; it must not block the persistent extension-frame runtime |
| Direct `nudge_content_swarm` prepared path disabled | Bounded | It remains registered-disabled and must not become active truth unless registry, docs, tests, and smoke coverage change together |
| Browser lacks worker or OffscreenCanvas APIs | No hidden renderer swap | Selected worker start reports unsupported rather than silently switching renderer owners |
| Worker loop failure before presentation | No silent fallback | Worker posts `ERROR`, active/spawn waiters reject, and start tears down without presentation lifecycle or media suppression |
| Worker `ERROR` after `FIRST_FRAME` | No degraded continuation | Main host emits `NUDGE_ABORTED`, stops the session, tears down the worker/overlay, and restores suppressed media |
| Stale iframe or worker session messages | Bounded | Session/nonce guards ignore stale messages without mutating current runtime |
| Public WAR parent sends `START` | No unauthenticated admission | Parent origin/source cannot distinguish the isolated content world from page JavaScript. Background must consume the exact one-time capability before the host binds the transferred MessagePort or constructs a worker. |
| Capability broker unavailable, restarted, expired, or mismatched | No channel fallback | Selected runtime rejects through its worker activation failure path; the host never accepts a first-message-wins window channel. |
| Authenticated bootstrap times out or the host reports `ERROR` on the MessagePort | No window fallback | Runtime failure remains loud and the selected worker/overlay tears down through the existing lifecycle. |
| Worker telemetry persistence | No | Worker telemetry remains immediate UI/debug memory unless a typed store is added |
| Worker-owned storage or business policy reads | No | Worker renders nudge entities only; business policy remains outside the worker |

## First-Pass Findings

### F1. Active content render path is extension-frame worker

Status: keep.

`SentinelProtocolHost` defaults to `extension_frame_worker`, and the render host app loads
`nudgeSwarm.worker.js` from an extension page. Architecture work should improve
that path directly instead of reviving the direct prepared worker path as a
parallel renderer.

The persistent `nudge_swarm` path is production runtime, not a debug probe. The
debug-tools build flag may remove probe admission, but public builds must still
admit persistent sessions.

### F2. Global uses one worker engine; Site has an explicit DOM strategy

Status: strengthened.

`nudgeSwarm.worker.js` is a message and OffscreenCanvas shell around
`NudgeSwarmEngine`. `global_sentinel` no longer owns a separate
`GlobalSentinelRenderer` or `ZenSentinelEngine` branch. Its visual differences
flow through `nudgeProtocolScene.js` and `NudgeProtocolSceneBackground.js`.
`GlobalSentinelDisplayEffects.js` is a narrow display-stress helper beneath that
same renderer owner; it cannot select protocol state or generate a second crack
topology.
`GlobalSentinelLcdMaterial.js` derives flat panel partitions and bounded material microfractures from that skeleton; `GlobalSentinelGlassMaterial.js` shades its glass edges and owns the final opaque outage pass. Neither helper selects protocol state or supplies Room aperture anchors.
The default skeleton is the seeded normalized-space `direction_distributed`
archetype; named comparison archetypes remain explicit. The narrow
`globalSentinelFractureGeometry.js` helper beneath the scene owner provides its
primary directions and shared impact-bleed contour. LCD and Rift consume the
same seed/origin contour, with the terminal aperture fixed at damage `0.4`.
Rift's black interior and edge stay clipped to that small opening, preserving
the surrounding LCD. Geometry is frozen independently of viewport projection;
invalid seed, origin, or bounds is an explicit error, never a replacement plan.
LCD source-driver columns and rows are allocated from the existing render
profile as a scene-wide detail budget divided among canonical panels; adding
directions does not multiply that work. Seeded fault zones and all five entry
fault cues remain unchanged, and render pressure still reduces detail only.
The global fracture, sync-pressure, and repair arithmetic is shared with the
host through `nudgeGameGlobalSentinelProtocol.js`; the engine adds entity
hit-testing, vulnerability windows, crack-origin capture, and visual diagnostics
around that common protocol state.

The engine's simulation is a render-side mirror, not terminal authority. Every
accepted global hit returns its serial, worker acceptance time, exact efficiency,
accepted entity-center/pointer point, accept-time viewport ratios, and full
outcome snapshot. The main-thread session preserves those ratios as the
rupture/Room 478 origin across any in-flight resize, then recomputes and
atomically validates the outcome fields before advancing the
canonical ritual. Misses must cross both the extension-frame and prepared-worker
bridges so the host can release its single in-flight input.

Worker-local `globalSentinelGamePhase` diagnostics never feed engine-control
permission. `SET_PROTOCOL_PROGRESS` supplies the Host-owned phase used for
clock, spawn, split, and input modes; missing or invalid global progress rejects
initialization instead of reconstructing permission from the render mirror.

`global_sentinel` also owns an engine-local pre-race state. Before the starter
koi click, worker stats report `awaiting_start`, engine control reports
`spawnMode: starter_only`, organic spawn/split pressure is paused, and the
starter koi is the only clickable target. The first accepted click records the
crack origin and starts the normal repair race. Do not move this starter
hit-test or crack-origin capture into the worker shell, and do not duplicate
run-permission decisions outside `nudgeGameEngineControl.js`.

Site no longer publishes worker progress or semantic guide messages. Its former controller, water renderer and motion implementation are archived.

### F3. Direct prepared worker remains disabled

Status: documented keep.

`nudge_content_swarm` is a registered disabled surface in the platform worker
registry. It can stay as an explicit non-active surface, but it must not be used
as a fallback or duplicate active runtime without a deliberate cutover.

### F4. Worker telemetry is debug-only

Status: keep.

Stats, spawn lifecycle, and worker support snapshots are immediate runtime/debug
evidence. They are not durable business data and must not become storage truth
without a typed-store boundary update.

### F5. First rendered frame is the activation barrier

Status: strengthened.

`WORKER_READY` records worker boot only. `FIRST_FRAME` is the evidence that may
settle selected-runtime active waiters and allow the main host to report start
success, emit `NUDGE_PRESENTED`, and suppress page media. A later worker error
aborts the lifecycle and tears the intervention down instead of leaving a dead
overlay or switching renderer owners.

## Verification Targets

Use these checks when this boundary changes:

- `npm run test:file -- tests/nudgeFrameHostCapabilityBroker.test.js tests/nudgeRenderHostChannel.test.js tests/nudgeExtensionFrameWorkerProbe.test.js tests/nudgeExtensionFrameWorkerRuntime.test.js tests/nudgeGameRuntimeCanvasMode.test.js tests/sentinelProtocolHostFacade.test.js tests/sentinelProtocolHostSessionModel.test.js tests/sentinelProtocolSessionController.test.js tests/sentinelProtocolTerminalController.test.js tests/sentinelProtocolWorkerBridge.test.js tests/sentinelProtocolTimerController.test.js tests/sentinelProtocolPresentationAdapter.test.js tests/sentinelProtocolDiagnosticsBuilder.test.js tests/globalSentinelEntryController.test.js tests/nudgeSwarmWorkerEntry.test.js tests/nudgeSwarmEngine.test.js tests/nudgeProtocolSceneBackground.test.js tests/sentinelFlareProtocolProfile.test.js tests/nudgeGameTemplateProtocolOwnership.test.js tests/nudgeGameEngineControl.test.js tests/nudgeGameMediaSuppression.test.js tests/nudgeGameLifecycle.test.js`
- `npm run build` after extension-frame host admission or public-build flag changes
- `npm run check:security:surface`
- `npm run check:docs:paths`
- `git diff --check`

### Reserved global starter during viewport preparation (2026-09-08)

`POINTER_DOWN` and `ACTIVATE_ELIGIBLE_GLOBAL_TARGET` accept the explicit
`starterPhase: prepare` interaction with `commit: false`. The engine reserves
one validated starter ID and its normalized impact; the reply carries those
facts and the same interaction serial. No game/ink clock or fracture is started.
After host-owned fullscreen settling and canonical RESIZE publication, the input
controller sends `POINTER_DOWN` with `starterPhase: commit` on the same serial.
The engine requires the reservation and starter input mode, maps its stored ratios
to the new bounds and commits exactly once. This prevents re-hit-testing a moved
koi after fullscreen. Reset clears the reservation. Normal Global repair retains its existing contract. Site does not enter this worker input path. Host prepare/miss replies cannot masquerade as
committed protocol outcomes.
