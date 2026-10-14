# Worker Runtime Control Plane

- Status: Active
- Date: 2026-05-09
- Owner: platform workers
- Last validated against code: 2026-10-03
- Path policy: current-only
- Canonical for: worker runtime surface registry, grouped context/lane budgets, degradation policy, and worker admission

## Intent

The project uses multiple worker styles because MV3 contexts, OffscreenCanvas renderers, content overlays, and request/response compute jobs have different lifecycle constraints.

The control plane is the shared operational layer above those implementations. It does not force every worker into one physical pool. It makes each worker surface declare the same core facts:

- surface id
- worker id
- owner path
- source script path
- execution context
- lane
- priority
- task types
- timeout budget
- degradation mode
- status
- admission group
- UI admission rank and preemption eligibility

The runtime SSOT is `src/platform/workers/runtime/WorkerRuntimeRegistry.js`.

## Contexts And Lanes

Canonical contexts live in `src/platform/workers/runtime/types.js`.

- `background`: service-worker side runtime such as crypto
- `ui`: dashboard/theme/runtime UI surfaces
- `content`: page/content injected runtimes

Canonical lanes:

- `secure`: sensitive background work
- `compute`: non-render compute and model work
- `render`: visual render workers
- `ceremony`: full-screen global ceremony playback

Budgets live in `src/platform/workers/runtime/config.js`.
`WorkerRuntimeAdmissionController` is the single context-wide owner that resolves
the global, admission-group, and lane budgets. Every active UI worker must acquire
an admitted worker session before physical construction; UI owners must not
interpret `maxWorkers`, burst limits, lane limits, or pool size locally.

The normal UI policy reserves two independent steady slots under the same
controller:

- `presentation`: one steady worker, with one additional presentation worker for
  at most the configured 15-second burst window
- `compute`: one strict, task-active request worker with no burst

The corresponding steady/burst context totals are two and three. Low-core UI
contexts retain one presentation slot and one task-active compute slot but disable
the presentation burst. Lane budgets refine those groups: compute is one, render
is one steady/two during the presentation burst, and ceremony is one. A compute
lease is released when its request queue becomes idle; a memoized request-client
object must not monopolize the compute lane between tasks.

The steady presentation owner for mounted Zen Home is `zen_home_renderer`
(`400`, strict, non-preemptible). It admits exactly one physical Worker through
`ZenHomeRendererWorkerSession` and multiplexes the exact `pond` and `bonsai`
logical channels inside that session. Those channels are not separate registry
surfaces, leases, ranks, or capacity units. They are exclusive to mounted Zen
Home. Experiment and standalone bonsai preview canvases use their declared local
Canvas2D research renderer as the primary lab path; they must not acquire a Home
logical channel or present that local path as Home worker degradation. A/B model
evaluation remains a separate strict `zen_ab_trial` compute surface.

Ceremony (`300`) and dashboard boot (`200`) are preemptible burst presentation
sessions. In a normal UI context they may use the second presentation slot for
at most the configured 15-second burst window; low-core contexts have no such
burst slot. A higher-ranked candidate may replace only a lower-ranked
preemptible lease. Neither Boot nor Ceremony may displace or duplicate the
non-preemptible Home lease. Denial, revocation, or burst expiry must follow the
registered failure/degradation contract; it must not trigger a second Home
Worker, a surface-local admission retry, or local capacity inflation.

Compute ranks remain canonical registry metadata: explicit latent/VNext
optimization is `250`, A/B evaluation is `150`, and VNext preference training is
`125`. All current compute surfaces are strict and non-preemptible, so those ranks
do not form a compute handoff order. If the compute group is occupied, competing
compute admission is denied rather than displacing the active task.

## Surface Registry

Every new worker surface must be registered before implementation code depends on it.

Active examples:

- `crypto`: background secure request worker, explicit local main-thread degradation
- `zen_bonsai_model`: strict product compute worker (`200`, non-preemptible),
  owning only deterministic Plume study preparation and life projection. It uses
  the existing one-slot compute budget independently of Boot/Home presentation
  admission. The requesting mounted surface retains its private seed study DTO
  and latest accepted projection while parked, with no hidden computation.
  Structural PROJECT excludes fixed camera history and binds exact preparation/source
  identity; the client always reattaches that preparation's retained camera. Equal
  normalized growth only rebinds admitted immutable pose to latest life/appearance,
  without a compute request or repeated structural transforms. Full current scene
  acknowledgement remains required;
  seed/model changes and unmount discard them. The worker terminates on
  request-idle, parking, cancellation and unmount. No storage,
  experimental gate, retry loop, local fallback or idle lease is allowed. Typed
  seed/projection identity rejects stale/mismatched results. The model artifact
  guard requires this storage-free, render-free closure in public and dev builds.
- `zen_home_renderer`: one strict UI OffscreenCanvas render session with exact
  `pond` and `bonsai` logical channels
- `dashboard_boot_renderer`: UI render worker, presentation degradation allowed
- `ceremony_overlay_renderer`: UI ceremony worker, presentation degradation allowed
- Zen experimental model workers: UI compute workers behind experimental gates

Registered non-active examples:

- `nudge_content_swarm`: content render worker, currently disabled by flag

The detailed content nudge worker boundary is tracked in
`docs/architecture/repository/nudge-worker-runtime-boundary-map.md`; its
active render path is `extension_frame_worker`, which uses an extension iframe
host to load `nudgeSwarm.worker.js` with OffscreenCanvas. The registered
`nudge_content_swarm` surface is the disabled direct prepared content-worker
path, and its admission owner is
`src/domains/nudge/runtime/NudgePreparedWorkerRuntime.js`.

`WorkerRequestClient` callers should build base config with
`createWorkerRequestClientConfig(surfaceId, overrides)`. Unknown surface ids and
unknown surface task keys must throw. The generated config carries the
canonical `surfaceId`, status, kind, activation flag, and `degradationMode`
from this registry; caller overrides may tune worker construction and
init/request timeouts but must not replace canonical surface or admission metadata.

## Optional Request Lifecycle Evidence

`WorkerRequestClient` accepts an optional `onLifecycleEvent` function. A supplied
non-function throws `WORKER_LIFECYCLE_OBSERVER_INVALID`; no observer is installed
by default. Events carry the page's `performance.now()` and
`performance.timeOrigin`, the worker id, and the request type/options/message id
where that identity exists. `request_start` occurs before awaiting initialization;
`request_initialized` follows successful readiness. The remaining boundaries are
`init_start`, `worker_created`, `init_post_start/end`, `init_ready_received`,
`request_post_start/end`, `response_received`, `response_resolved` and `disabled`.
This does not reinterpret the existing request telemetry elapsed time, which
starts after initialization. Observers own no queue, admission, timeout, retry,
worker or scheduling decision.

Observer exceptions are failures, not ignored measurements. Initialization and
request setup failures converge on the existing disable/rejection path; message
observer and response-resolution failures preserve their named telemetry stages
and reject affected work. Disable finishes exact pending-request, timer and worker
cleanup before invoking its observer; an observer failure there emits a
`worker_fail` at `lifecycleObserver`/`disabled` without preventing release.
Request post failures retain the existing idle-release contract. No callback may
turn a failed request into a successful empty result.

Zen Plume opts into this seam only with an enabled development trace and the
explicit debug build capability. `ZenBonsaiPlumeModelDiagnostics.js` owns bounded
timing metadata and physical worker names; the product contract is documented in
`docs/architecture/themes/zen/zen-g15-product-engine.md`. Realm-local durations
must remain distinct. A page timestamp and a worker timestamp must not be
subtracted directly merely because both use `performance.now()`.

The canonical CPU-profile collector may install a development-only native binding
that pauses Plume immediately before each RESULT. That bounded pause lets the
collector stop/archive the exact worker segment before normal request-idle
termination and acknowledge the same request. The pause is recorded separately;
ordinary boot has no binding, wait or extended worker lifetime. A missing receipt,
profile segment or acknowledgement is incomplete evidence or an explicit failure,
never a reason to replace the worker owner, retain an idle lease or raise a
product readiness budget.

## Request Failure Visibility

`WorkerRequestClient` owns the request envelope and the generic worker
availability failure shape. If initialization cannot even reach a ready worker,
the client must preserve the concrete reason in `lastDisableReason`, telemetry,
and the thrown structured error:

- missing `Worker` API: `WORKER_API_UNAVAILABLE`
- missing worker factory: `WORKER_FACTORY_UNAVAILABLE`
- init timeout: `WORKER_INIT_TIMEOUT`

Callers may decide how to present or degrade from that error according to the
surface's registered degradation mode, but they must not collapse these reasons
into an empty result or a generic success path.

`WorkerRequestClient` includes the registered surface metadata in thrown
availability errors and worker runtime event details so strict failures and
documented presentation degradation remain distinguishable at the telemetry
boundary.
Offscreen presentation surfaces that do not use `WorkerRequestClient` must still
carry the same boundary truth. `zen_home_renderer` is strict: physical admission,
Worker, envelope, and channel-session failures remain named failures on that
surface. Pond and Bonsai clients must preserve the exact logical channel and
failure stage; physical Worker readiness or one channel's frame ACK must never
stand in for the other channel's ACK. `dashboard_boot_renderer` and
`ceremony_overlay_renderer` may degrade visually according to their registered
policy, but worker unavailability, worker `error` messages, `Worker.onerror`,
timeouts, and mount failures must emit `worker_fail` with `surfaceId`,
`surfaceKind`, `surfaceStatus`, `degradationMode`, and failure stage metadata.
Presentation degradation is not a success path or an alternate Home renderer.
Strict Zen model worker clients must propagate unavailable workers as
structured errors with the registered surface metadata; they must not return
`null` for init failure and rely on each caller to rediscover the missing
worker as a separate validation error.
Model-capable Zen compute workers are generation-pinned compute owners, not
extension storage lifecycle observers. Their closure must use
`ZenWorkerModelRepository` plus the pinned profile-generation lease and must not
contain `ProfileResetLifecycleRepository`, lifecycle-backed Zen repository
composition, or internal Chrome storage modules. Staleness is rejected by the
request/result generation ACK, the client pre/post admission checks, and the
transactional ModelState reserved-epoch comparison.
Strict worker result payloads must also preserve shape failures. For example,
Zen A/B trial evaluation results require `{ entries: Array }` and cold-start
results require `{ pool: Array }`; malformed worker `RESULT` payloads must
reject as structured worker errors instead of being converted to empty arrays.
Strict optimizer and trainer worker clients must at least require object-shaped
`RESULT.result` payloads before returning to their callers; deeper domain
normalization may still happen in the owning controller/model layer.
The deprecated VNext preference-training hook must not synthesize a local
trainer model when the registered preference trainer worker returns malformed
training output; it may decline to update the model, but it must not turn that
worker contract failure into a successful model write.
Strict renderer worker clients must also reject unsupported response message
types. Zen pond renderer events, debug messages, and malformed `RESULT.result`
payloads are not request successes even if they carry a `result` field.

`WorkerTelemetry` keeps the immediate diagnostics stream in memory and mirrors
persisted diagnostic events into `worker_runtime_events`. The persisted mirror is
not canonical worker truth, but mirror write failures must still be visible:
they update the telemetry persistence status and append a memory-only
`worker_fail` event with `taskType="persist_worker_runtime_events"`. The failure
event must not recursively schedule another persisted write.

`WorkerTaskQueue` and `WorkerPool` must also preserve failure stage evidence.
Queue capacity, cancel, and clear events keep their dedicated event types, while
task execution failures emit `worker_fail` with task id, priority, cancel/dedupe
keys, message, and error code. Pool lease, factory, and run failures emit
`worker_fail` with `slotIndex`, `stage`, message, and error code. Callers may map
these events into surface-specific worker ids/task types, but they must not drop
the failure merely because the request promise already rejected.

## UI Admission Lifecycle

`src/platform/workers/runtime/WorkerRuntimeAdmissionController.js` owns active
leases, grouped/lane capacity, and burst expiry.
`AdmittedWorkerRuntimeSession.js` binds one lease to one physical Worker so
constructor failure, transfer/init failure, `Worker.onerror`, timeout, explicit
terminate, and unmount all converge on one idempotent release.
`ZenHomeRendererWorkerSession.js` is the sole physical owner for Zen Home. Pond
and Bonsai each acquire one exact logical channel from it; a channel acquire does
not acquire another platform lease or construct another Worker. Either channel
may release independently, and releasing the last channel terminates the physical
session and releases its lease. A retained/parked shared Home Worker still holds
the steady presentation lease and is not free capacity. When one channel closes
while its sibling remains, the owner sends the exact channel/session-scoped
`zen_home_renderer_channel_release` envelope so worker-side state is torn down
even if an abrupt caller path did not complete the channel's inner `DISPOSE`.
Release and immediate reacquire are serialized at that channel boundary.
An uncaught logical runtime rejection is latched as a terminal physical failure
and reported through the Worker error boundary; a rejected channel FIFO must not
remain alive as a silently poisoned partial renderer.
Every physical Worker callback is generation-fenced. A late message, error, or
revocation callback captured from a terminated physical generation cannot fail
or terminate a newer Home session.
The dashboard theme-runtime seam may create one pre-channel startup reservation
for the Zen Home session. That reservation owns the same physical admission and
sends one owner-only world-prepare command before React mount. The first real
Pond or Bonsai channel atomically adopts it; dashboard initialization failure or
explicit reservation release terminates an otherwise unadopted worker and
releases the platform lease. It does not create a second capacity class or a
second physical worker.
The physical Home entry installs the shared Pixi Worker environment exactly once.
Logical Pond/Bonsai runtimes only assert that invariant and never mutate a shared
Worker-global DPR. Channel pixel ratios remain explicit renderer inputs.
Lab-local bonsai canvases do not participate in this lifecycle. Their explicit
`lab_preview` owner renders synthetic or ephemeral research state on the main
thread and cannot be substituted for the Home worker owner.

Active UI request surfaces enter the same lifecycle through
`WorkerRequestClient`. `createWorkerRequestClientConfig()` marks canonical active
UI request surfaces as admission-required, the request client acquires before its
factory runs, and task-active compute sessions terminate and release after the
last request settles. Offscreen presentation owners keep their explicit admitted
session because their request client is only the protocol data plane. Zen Home
admits once at the shared physical session boundary, never once per logical
renderer channel.

Admission denial and revocation are named runtime failures. A strict surface must
fail through its existing worker-only path. A `presentation_degrade` surface may
continue only through its documented presentation behavior, and must preserve the
admission reason in worker failure telemetry. It must never report denial as a
successful worker mount or start an undeclared main-thread business path. No
surface may respond by retrying through a second physical Home Worker, borrowing
another lane, or widening the configured context/group/lane capacity.

`check:worker-runtime:admission-boundary` derives every active UI surface from the
registry. It requires frozen admission group/rank/preemption metadata, requires
presentation constructors to live inside the admitted-session seam, requires UI
request owners to use the admission-aware `WorkerRequestClient`, and rejects any
Zen-local `WorkerPool` or runtime-budget resolver.

## Degradation Policy

Degradation mode is an explicit surface property, not a hidden fallback path.

- `strict`: no semantic fallback; failure surfaces as a runtime failure
- `local_main_thread`: the owner already has a documented local path for the same business result
- `presentation_degrade`: visual ceremony/rendering may simplify or skip without changing business state
- `disabled_by_flag`: registered implementation exists but runtime activation is intentionally off

Business/runtime logic must not invent new fallback paths at call sites. If a new degradation mode is needed, update this document, the registry, and tests in the same change.
`local_main_thread` is still an explicit runtime degradation, not a silent
success path. `crypto` may preserve the same encrypted/decrypted business result
on the main thread when the registered worker is unavailable or fails, but the
owner must emit `fallback_used` with the registered surface metadata, concrete
task type, reason, and evidence that the business result was preserved.

## Ceremony Admission

The Ceremony engine enters through `ceremony_overlay_renderer`.

The initial contract:

- context: `ui`
- lane: `ceremony`
- priority: `interactive`
- degradation mode: `presentation_degrade`
- first use case: first-vision descent into seedling reality

Ceremony and dashboard boot are temporary presentation burst consumers. Their
documented visual degradation may skip or simplify their own presentation, but
it must not become a fallback renderer for Zen Home. They do not create Home
channels, reserve a second steady Home lease, retry admission behind the
controller, or increase the presentation budget.

Ceremony playback may degrade visually if worker rendering is unavailable, but it must not alter progression state by itself. Progression milestones remain owned by `src/domains/progression/**`.
If `ceremony_overlay_renderer` cannot use its worker and falls back to the
main-canvas renderer for presentation continuity, that is still a worker surface
failure. The overlay must emit `worker_fail` with the registered surface
metadata, failure stage, and `degradationMode="presentation_degrade"` before the
visual fallback continues.

## Boundaries

- Do not create new worker ids as component-local strings when the surface belongs in the registry.
- Do not retain an idle strict compute lease or recreate a UI compute pool outside the central admission controller.
- Do not widen a render worker into a general compute worker to bypass lane budgets.
- Do not move stats, progression, or security business state into render workers.
- Do not use a planned surface in runtime code until its status, owner, script path, and tests are updated.
- Do not construct extension-internal request workers from `chrome.runtime.getURL()` or raw `web_accessible_resources` source paths. `use_dynamic_url` may intentionally return a dynamic web-accessible origin, while `Worker()` in extension pages/background contexts needs a same-origin package URL. Bundle internal worker scripts through Vite worker URL imports or literal `new URL(..., import.meta.url)` worker construction.
- Do not replace specialized worker data planes with a single global pool unless a measured bottleneck proves that control-plane admission is insufficient.
