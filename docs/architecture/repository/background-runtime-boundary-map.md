# Background Runtime Boundary Map

- Status: Active
- Owner: repository architecture, background app
- Last validated against code: 2026-08-07
- Path policy: current-only
- Canonical for: background service-worker entry, app kernel composition, message routing, stats runtime wiring, storage support split, and retired hub guards
- Companion to:
  - `docs/system-architecture/05-background-runtime-owners.md`
  - `docs/architecture/repository/protection-content-runtime-boundary-map.md`
  - `docs/architecture/repository/storage-stats-tracking-boundary-map.md`

## Purpose

The named `@settings-propagation-qa-fixture` build projection owns development
settings task fault leases. `backgroundKernelSettingsPropagationBindings.js`
composes its broadcast port; development build-capability routes expose only
its trusted disposable-helper controls. The public projection is the unchanged
broadcast function and public routes remain empty. The normal coordinator and
settings service do not contain fault-state, response overrides or extra paths.

This map audits the background runtime after the old service hub split. It is
meant to answer which owner handles startup, message routing, stats tick state,
storage support actions, browser ports, and best-effort runtime recovery.

The [original hub decomposition plan](../../archive/legacy-plans/background-hub-decomposition-plan.md)
is historical context only. Current owner decisions follow this map and
`docs/system-architecture/05-background-runtime-owners.md`.

The practical reading question is:

```text
Can a background change identify its owner without reviving a retired hub,
putting domain state in the app kernel, or adding a silent browser/runtime fallback?
```

## Build Artifact Boundaries

Source ownership remains with the runtime/domain/platform seams below. Build
grouping is limited to named contracts: `extension-message-contracts` for four
dependency-free wire modules, `background-i18n-locales` for generated background
copy, and `runtime-i18n-primitives` for the four pure metadata/translator
definitions declared by `scripts/i18n/runtimeI18nChunkContract.mjs`. Exact-owner
and zero-dependency guards prevent these chunks from becoming business hubs.

`scripts/release/workerRuntimeChunkContract.mjs` separately declares the fourteen
worker control and typed telemetry modules in `worker-runtime-control`. This
owner may statically consume the descriptor/base `dashboard-boot-low-level`
chunk, but that base owner must not import worker control back. Popup and the
Dashboard `main.jsx` wrapper static closures exclude worker control. The
Dashboard HTML boot shell retains its declared `ZenSoftBootShell.js` worker
consumer under the existing boot file/byte budgets. Existing worker users admit
it through their canonical source imports; Background keeps
its MV3 static graph without runtime `import()`.

The Background `maxFiles` value is an advisory topology reference. Extra files
require a visible warning, while byte ceilings, forbidden module inventories,
unique source/entry ownership and MV3 static linking remain enforced. Current
measurements and the explicit `fileCountPolicy` contract are owned by
`docs/operations/ci/quality-gate.md` and `scripts/ci/quality-gate.config.json`.
File count alone is not evidence of cold-wake cost.

## Native protected-tab grouping (2026-10-09)

`ProtectedTabGroupService` owns the optional browser presentation projection.
`backgroundKernelTabManagementBindings` composes its strict browser port, typed
session repository, canonical settings reader and the shared
`ProtectionRuntimeInputProvider.readProtectedTabInventory` reader. Group membership
never supplies protection scope, Gate admission or the protected-tab budget.

The optional `tabGroups` grant is requested only by the Dashboard toggle's user
gesture. The default preference is off. Enabling gathers currently eligible open
tabs once; subsequent browser events admit each eligible tab once. One group per
window receives an initial `Entropy` title and grey color. Existing groups, pinned
tabs, user metadata edits and manual removal are respected. OFF, global pause,
Barrier pause or permission revocation stops new additions and clears the global
protected-count badge; it leaves existing native groups intact. The count includes
protected Gate sessions and remains independent of which tabs are grouped.

Browser events enter the existing `waitForFullInit` generation-captured FIFO.
Native effects also hold the shared profile mutation admission, so reset/import
drains them before clearing session IDs. The domain serializes native effects and
rereads the tab, permission, preference and scope before grouping. Native failures
emit `tab_management_projection_failed` and return an explicit failed status;
settings propagation rejects that result. Gate navigation may proceed after this
optional projection fails, preserving the mandatory protection boundary. There is
no alternate grouping API, polling loop or inferred group ownership by title.

Before any Gate redirect, the controller asks this owner to ungroup only a tab
that Entropy itself inserted. This avoids deliberately saving the Gate URL inside
an owned group. Group save/sync remains Chrome-controlled; the extension cannot
promise local-only native groups or disable Chrome sync. Manual native grouping
and a failed ungroup operation retain that platform limitation.

The kernel separately injects the same Gate controller into the existing settings
runtime adapter. Changes to `gateConfig`, `artifactControlState`, `blockedUrls`,
`allowedUrls`, `filteringMode` or `relaxationSchedule` refresh pending Detour
sessions once from current canonical policy, including hidden Gate pages. This
runs before the optional group projection and does not depend on `tabGroups`
permission. The subsequent content protection broadcast does not repeat the Gate
refresh. Tab-removal refreshes remain with the browser-event owner; session
identity, current eligibility, exact-URL handoff and release authority remain with
`GateInterstitialController`.

`ProtectedTabGroupsRepository` stores only the exact V1 browser-session ownership
receipt; absence initializes an empty session, malformed presence rejects without
rewriting. Browser restart does not reclaim restored groups by their title.

## System Flow


Core composition creates GuidanceService with typed repository, progression,
canonical settings and notification ports. Kernel binds the canonical global
cap reader after protection composition. Trusted dashboard/popup routes carry
profile generation and sender-bound presentation claims under the existing
profile runtime gate. Guidance does not own protected intervention dispatch.
Its full-reset clear joins the required durable maintenance wave. Details are
owned by [Guidance Runtime](../guidance/guidance-runtime.md).

Intervention admission is gated by profile-generation boot settlement plus its
own typed session/settings readers. It does not await the full tracking init
promise, whose startup content reconciliation may itself await an admission
request. Sender admission and reset/import mutation gates still apply. The
router owns this readiness selection, not intervention policy or cached grants.

Cold global-cap evaluation retains its awaited settings, activity-day cap,
session flag, protection broadcast, and optional notification owners. Only the
startup call supplies `checkGlobalCapStatus(now, { reportBootPhase })` with a
synchronous diagnostic port. Its closed phases are `settings`, `cap`,
`session_read`, `session_write`, `broadcast`, and `notification`; each entered
phase reports started/settled and a failure boolean through the bootstrap
coordinator's existing milestone reporter. Unentered conditional phases have no
milestone. The coordinator admits only the twelve corresponding
`post_dashboard_global_cap_<phase>_started|settled` names and emits no cap values,
domains, tab identities, owner payloads, or error text. Ordinary runtime cap
checks supply no reporter. This worker-local evidence neither persists a new
history nor changes full-init ordering, deadlines, browser fan-out, or failures.

`trackingRuntimeCoordinator.checkGlobalCapStatus` owns one worker-local serial
lane across settings hydration, cap reading, checkpoint reading, protection
broadcast, the post-success checkpoint write, and optional notification. Each
separately admitted call enters in invocation order and rereads the canonical
checkpoint after its predecessor settles, so overlapping alarm and authorized
runtime-session support checks cannot concurrently act on the same old checkpoint. The
lane's internal tail records settlement only; the original operation result or
exact rejection remains with its caller. Failure admits no automatic retry or
coalesced successor: only another explicit check runs. No checkpoint is written
before successful protection application, and this lane adds no storage owner,
timer, timeout, or readiness bypass. It does not serialize unrelated settings
propagation.

An unsuccessful global-cap protection broadcast retains a bounded projection
of the dispatch summary in `TRACKING_RUNTIME_COORDINATOR_GLOBAL_CAP_APPLY_FAILED`:
counts and at most eight tab IDs, failure codes/messages/reasons, with explicit
omission counts and text limits. Target URL fields and raw payloads are excluded.
Missing result fields remain diagnostic `null`, never fabricated success or zero
failures. The failure still rejects full init and cannot write the cap checkpoint
or emit a transition notification; error-only browser consumers must retain the
same underlying failure without depending on Dispatcher warning visibility.

Enso cadence projection delivery is separately admitted through the existing
`runProfileMutationAdmittedTask` port at protection composition. The admission
service owns one active send and one latest pending snapshot. Its canonical
state mutations do not wait for this optional delivery ACK; reset/import still
drains admitted delivery work. Exact cleanup probes and destructive conclusions
stay in the serialized admission lane. Receiver generations and the complete
receipt contract are owned by the Active intervention admission document.

The service-worker entry stays facade-only:

```text
background/index.js
  -> TrackingService
  -> BackgroundAppKernel
  -> BackgroundBootstrapCoordinator
```

Kernel composition wires owners without owning their mutable state:

```text
BackgroundAppKernel
  -> core service/repository construction
  -> protection runtime bindings
  -> tracking runtime bindings
  -> storage support bindings
  -> message router bindings
  -> bootstrap coordinator bindings
```

The protection browser port forwards the exact third-argument frame/document
target unchanged. Its separate fourth argument bounds control-probe delivery;
the timeout never changes addressing or admits a late response. The architecture
guard checks both forwarding and the named timeout, with the actual callback/
late-reply behavior covered by `backgroundKernelProtectionBrowserPort.test.js`.

The dev-only Gate consumption QA read is wired at message composition from the
existing Tracking flow/warm memory and Gate session (with frozen policy reason)
readers. It owns no model, batch, clock override, persisted trace or admission
mutation. Only the trusted harness dev route can invoke it; phase evidence is
written by the named QA protocol outside the extension profile.

Protection dispatcher composition receives `resolveProtectionRuntime` and
`getGlobalCapState`, not a second direct stats cache reader. The nudge dispatch
runner validates `runtimeSnapshot.activityDay` from the canonical provider;
the guard must not require the retired `loadStatsCache`/`getStatsCache` wiring.
The filter-indicator message reader likewise consumes the existing activity-day
usage range owner; its guard requires that reader rather than three retired
stats-cache/date/load callbacks.
The content-facing indicator query derives its site from the browser-owned
sender document URL. A supplied URL may only name the same web hostname; missing
sender identity, non-web URLs and cross-site requests fail before settings,
usage or runtime reads. The parent tab URL cannot authorize an embedded sender
to read another site's indicator data.

Favicon capture uses the same composition rule:

```text
backgroundKernelCoreServices
  -> inject platform/browser/faviconFetch.fetchFaviconDataUrl
  -> tracking/background/FaviconService capture and cache coordination
  -> platform/storage/assets/FaviconRepository
  -> platform/storage/internal/indexeddb/stores/FaviconStore
```

The platform cache-reader seam accepts validated bounded image data without a
request, or reads only the extension-owned Chrome `_favicon/` local-cache
endpoint through the canonical own-origin asset adapter. HTTP(S) icon candidates
are observations, never remote request destinations. Chrome's extension API
explicitly disables favicon-server fallback. Missing local images retain the
last committed cache image or the UI's explicit monogram; no remote retry exists.
Malformed inputs reject before a timer or fetch. The seam retains its 2.5-second
abort timeout, 256 KiB binary/data-URL budgets, MIME validation and
service-worker-safe Blob conversion. The domain neither imports `apps/**` nor
gains browser/runtime implementation details. Host permissions do not authorize
network egress; extension-page `connect-src` permits only the extension origin.

Runtime messages route through explicit routes and then domain/action handlers:

```text
runtime.onMessage
  -> BackgroundMessageRouter
  -> dashboard boot-read actions wait for dashboardBootReadinessPromise
     -> stats/cache/cycle/settings/CLSE owners ready + prewarm started
  -> all other actions wait for full initPromise
  -> every non-mutation action acquires one ProfileMutationRuntimeGate lease
     until its response commits
  -> popup / CLSE / tracking runtime routes
  -> nudge frame-host capability route issues only to trusted top-frame content
     and consumes only from the exact extension render-host tab/frame/session
  -> action message bindings
  -> domain handlers or app support services
```

`RESET_APP_DATA` and `IMPORT_STORAGE_SNAPSHOT` are the only control-plane
actions outside that runtime lease. They enter `ProfileMutationCoordinator`,
which closes and drains the shared gate before any durable clear/import. A
closed-generation recovery request must carry the exact observed `resetId`;
ordinary messages received behind the fence fail and are never replayed into the
next profile.
The coordinator quiesces registered participants sequentially in composition
dependency order, with producers before the queues and stores they can reach.
After the destructive task it publishes durable `committed` and `complete`, then
seals the old worker gate as local `reload_pending`. The storage action handler
returns the exact `{ contract, operation, resetId }` handoff descriptor in the
successful response and does not reload. After that original response Promise
settles, the Dashboard starts one narrow `PROFILE_MUTATION_RESPONSE_ACK` with the
unchanged descriptor. The eager control path revalidates the trusted Dashboard
sender, durable `complete` lifecycle, and local `reload_pending` gate before the
narrow `chrome.runtime.reload()` port runs. No participant, repository, or gate
is resumed in place; only fresh-worker bootstrap binds the completed generation.
Readiness-delayed ingress captures an opaque generation admission at arrival and
consumes it exactly once immediately before dispatch. The admission owns both the
durable profile generation and the monotonic local fence revision sampled before
the lifecycle read. Every close, failure seal, terminal reload seal, and
authorized failed-mutation recovery advances that local revision. A pre-close
capture therefore cannot survive into a terminal or recovery phase and fails
with `PROFILE_MUTATION_RUNTIME_ADMISSION_GENERATION_CHANGED` before the business
owner runs.

Browser listeners remain synchronously registered for MV3 wake-up, while event
execution has one FIFO readiness owner:

```text
history / bookmark / permission / notification callback
  -> BackgroundBootstrapCoordinator.waitForFullInit()
  -> canonical full init promise
  -> ProfileMutationRuntimeGate lease
  -> original event owner, once and in arrival order
```

Alarm/tab/window/navigation handlers acquire the same gate after their full-init
wait. Their detached best-effort tasks acquire independent leases, so the
mutation drain includes work that outlives the outer callback. Bootstrap prewarm
and startup favicon capture likewise acquire independent leases synchronously
before `init()` can finish. `runtime.onSuspend` continues to bypass full init for
the suspend budget, but its notification disposal and log/debt flushes are awaited
by the one owning admitted task before that lease is released.

Tracking tab lifecycle reactions use one in-memory FIFO per tab before their
full-init/admission body starts. Loading, completion, History, commit, removal,
replacement, creation, and activation for the same tab therefore cannot overtake
one another; different tabs and non-tab event families still run in parallel.
Within a reaction, the short foreground/stats mutation sections enter
`statsRuntimeService.runStatsMutationBatch`; the lane supplies its real wall-clock
timestamp when the mutation actually starts. Alarm ticks, idle transitions, and
the suspend settlement use the same lane. A handler that resumes after browser
I/O must revalidate the current foreground owner before applying its result, so
an older `tabs.get()` result cannot replace a newer active-tab transition.

Startup managed-content reconciliation owns an independent profile-mutation
lease and remains awaited by the full-init promise. This lifetime binding keeps
a fresh worker's waking ingress open until receiver readiness settles; failures
remain best-effort bootstrap diagnostics. `CONTENT_BOOTSTRAP_STATE` and
intervention admission retain their dedicated prerequisite/profile-generation
readiness routes so catch-up can settle without waiting for normal full-init
dispatch. The exact catch-up contract is owned by
`docs/architecture/repository/protection-content-runtime-boundary-map.md`.

CLSE uses that same gate rather than a subsystem reset flag. Background
composition injects only the gate's `capture` and `runCaptured` seams through
`CLSEServiceClient`. Heartbeat and every background collector listener capture at
arrival; navigation awaits its loop-detector persistence callback inside the
lease, and the three response-bearing CLSE runtime messages keep `return true`
until the admitted task commits its response. The content-side reporter is only
an emitter; its messages acquire ownership at the background collector ingress.
CLSE's serialized storage-mutation lifecycle remains the inner owner for stopping
collectors, draining its storage tail, replacing/reloading the baseline, and
resuming detectors.

Idle initialization is also part of the ordinary ingress contract. Bootstrap
awaits the initial idle query, while initial/query/state-change transitions use a
local admitted lease before mutating idle state. They do not become a delayed
post-reset callback.

`backgroundKernelBrowserEventBindings.js` owns only event-to-handler mapping.
Ordinary event rejection/throw observation belongs to the narrow
`backgroundKernelBrowserEventListener.js` registration seam; `runtime.onMessage`
stays on its dedicated response-bearing listener contract.
Dispatcher-owned tab-update hard failures additionally project `tabUpdateStatus`,
`settlementReason` and `historyIngressOrder` into this console seam. These fields
describe why a lifecycle cancellation could not be proven; they change no
settlement or retry policy. The projector accepts only loading/complete, a bounded
lowercase reason token and before/after-receipt order, without copying URLs,
document identities or arbitrary diagnostic objects.

Rejected full init never enters a partial owner and records
`BACKGROUND_FULL_INIT_EVENT_GATE_REJECTED`. `runtime.onSuspend` is the explicit
exception: it performs terminal best-effort settlement immediately because
waiting for startup can consume the worker suspend budget.
Permission callbacks await popup-intent processing and managed-content resync
before releasing the FIFO slot. Browser and notification listener families keep
separate idempotent registration state, so retrying a failed notification
registration cannot add the already-installed browser listeners again.

Stats tick and rollover sequencing belongs to the stats runtime service, not the app kernel:

```text
backgroundKernelTrackingStatsBindings
  -> statsTickRuntimeService
  -> statsRuntimeService.runStatsMutationBatch
  -> durable hourly/daily stats owners
```

Storage support is split by support concern:

```text
backgroundKernelStorageSupportBindings
  -> backgroundKernelZenProfileGenerationFactory
     -> ZenBonsaiProfileGenerationGenesis
     -> ZenBonsaiProfileAggregateStorageContract
  -> backgroundKernelProfileMutationRuntimeLifetimePort
  -> BackgroundMaintenanceCoordinator
  -> BackgroundStorageSnapshotService
  -> BackgroundStorageInspectorService
```

First-install generation creation is part of ordered background bootstrap, not a
Dashboard resource side effect:

```text
BackgroundAppKernel
  -> createBackgroundKernelZenProfileGenerationInitializer
  -> BackgroundBootstrapCoordinator / trackingServiceBootstrap
  -> waitForProfileMutationAdmission
  -> ModelStateRepository.initializeProfileGeneration
  -> remaining mutable bootstrap owners
```

## Canonical Owner Table

| Concern | Canonical owner | Canonical path | Source of truth | Forbidden shortcut |
| --- | --- | --- | --- | --- |
| Service-worker entry | background entry facade | `src/apps/background/index.js` | one import and service start call | direct Chrome listener or service construction in entry |
| Tracking service facade | background service facade | `src/apps/background/services/TrackingService.js` | forwards to app kernel | message routing or settings/protection construction in facade |
| App composition root | background app kernel | `src/apps/background/services/runtime/BackgroundAppKernel.js` | dependency wiring and long-lived service assembly | owning message branches, tick state, or storage semantics |
| Startup/listener ordering | bootstrap coordinator | `src/apps/background/services/runtime/BackgroundBootstrapCoordinator.js` | full init promise, FIFO browser-event gate, dashboard boot-read milestone, and idempotent listener registration | domain owner registering browser listeners directly or callback-specific init waits |
| Message routing | background message router | `src/apps/background/services/runtime/BackgroundMessageRouter.js` | route selection, readiness-class selection, and dispatch | raw storage/stats/protection mutation in router |
| Shared wire-contract artifact | Vite build composition | `vite.config.js`, `src/platform/messaging/contracts/messageTypes.js`, `src/domains/nudge/media/frameMediaProtocol.js`, `src/domains/schedule/contracts/scheduleRuntimeState.js`, `src/platform/storage/support/storageSupportTaskContract.js` | the exact four dependency-free contracts share `extension-message-contracts`: message/media vocabulary, transported Schedule DTO validation, and storage-support task IDs; source owners stay unchanged and the artifact has no static/dynamic/CSS imports | runtime, storage or UI owner absorption; adding the protection runtime snapshot bridge with its semantic dependencies; background dynamic imports; raising closure budgets to accommodate a protocol |
| Public nudge frame-host admission | ephemeral capability broker + exact sender route | `src/domains/nudge/runtime/frame-host/NudgeFrameHostCapabilityBroker.js`, `src/apps/background/services/runtime/messageRoutes/nudgeFrameHostCapabilityMessageRoutes.js` | secure-random TTL ticket issued to the trusted top-frame content sender and consumed once by the exact render-host tab/path/frame/session/nonce | reusable/durable token, URL/query secret, arbitrary extension-page consumer, or parent-origin trust |
| Profile mutation runtime admission | background mutation gate + coordinator | `src/apps/background/services/runtime/support/ProfileMutationRuntimeGate.js`, `src/apps/background/services/runtime/support/ProfileMutationCoordinator.js` | one shared in-flight lease count; ordered producer-before-queue/store quiesce; durable `resetting -> committed -> complete`; local `reload_pending` seal | per-feature reset flags, replaying closed-generation ingress, or rebinding/reopening old owners |
| Terminal profile mutation response handoff | exact handoff contract + Dashboard ACK client + eager background control path + runtime lifetime port | `src/platform/messaging/contracts/profileMutationResponseHandoff.js`, `src/apps/dashboard/bootstrap/profileMutationResponseAckClient.js`, `src/apps/background/services/runtime/backgroundKernelProfileMutationControlBindings.js`, `src/apps/background/services/runtime/backgroundKernelProfileMutationRuntimeLifetimePort.js` | successful reset/import returns one exact descriptor; only its trusted post-settlement ACK may reload after durable/local fence revalidation | mutation-handler reloads, timer/watchdog reloads, ACK mutation authority, or continuing normal work in the sealed worker |
| Action message wiring | action binding helpers | `src/apps/background/services/runtime/backgroundKernelActionMessageBindings.js` and sibling action bindings | action-to-owner delegation | one generic action hub growing business state |
| Content indicator notebook navigation | indicator navigation action owner | `src/domains/tracking/background/trackingMessageHandlers/indicatorNavigationHandlers.js` | trusted top-frame sender, current browser-tab origin and fixed own-extension Sites route through the required `indicatorNavigation.browserPort` | arbitrary request URLs/domains as navigation targets, exposed Dashboard resources, or reuse of intervention navigation authority |
| Dev-only build-capability toolbar action | build-selected message route plus canonical browser-event registration | `src/apps/background/services/runtime/messageRoutes/audioDullingQaMessageRoutes.dev.js`, `src/apps/background/services/runtime/backgroundKernelBrowserEventBindings.js` | exact prepared-tab `action.onClicked` event, admitted after full init; public route exposes no handler | feature route directly registering `chrome.action.onClicked`, synthetic invocation, or public no-op action handler |
| Protection runtime wiring | protection runtime bindings/coordinator | `src/apps/background/services/runtime/ProtectionRuntimeCoordinator.js`, `src/apps/background/services/runtime/backgroundKernelProtection*.js` | injected browser ports and dispatch wiring | domain protection owners reaching into Chrome APIs |
| Gate runtime state | Gate domain state owner behind an app delegation facade | `src/domains/protection/background/runtime/GateRuntimeStateOwner.js`, `src/apps/background/services/runtime/ProtectionRuntimeStateCoordinator.js`, `src/domains/protection/background/TrackingProtectionService.js` | per-host entry/return/intervention windows, foreground continuity application and construction-time validation of the exact state port; confirmed consumed contexts are read from TrackingConsumptionLedger through gateConsumedContextProjection | app coordinator-owned Gate maps/normalization, a second Gate state cache, malformed continuity/context repair, or silently skipped Gate decisions |
| Tracking browser event wiring | tracking runtime/browser bindings | `src/apps/background/services/runtime/backgroundKernelTrackingRuntimeBindings.js`, `src/apps/background/services/runtime/backgroundKernelTrackingBrowserBindings.js` | injected ports plus tracking-domain owner calls | browser event handlers owning durable stats facts |
| Favicon capture and persistence | tracking capture owner + platform browser adapter + typed asset repository | `src/domains/tracking/background/FaviconService.js`, `src/platform/browser/faviconFetch.js`, `src/platform/storage/assets/faviconDataUrlPolicy.js`, `src/platform/storage/assets/FaviconRepository.js` | app-injected local browser-cache port, domain capture/cache sequencing, validated data URL, and IndexedDB `favicons` row | domain importing app helpers, app-owned fetch policy, raw `FaviconStore` access, or a fallback fetch path |
| Stats tick/rollover sequencing | stats domain runtime | `src/domains/stats/background/runtime/statsTickRuntimeService.js` | mutation-batch delegation and day-boundary settle/prime | app runtime coordinator as canonical stats state |
| Content-flow aggregate collection | stats collection owner plus FeedFlow runtime state owner behind an app delegation facade | `src/domains/stats/background/collection/behaviorTelemetryRecorder.js`, `src/domains/protection/background/runtime/FeedFlowRuntimeStateOwner.js`, `src/apps/background/services/runtime/ProtectionRuntimeStateCoordinator.js` | exact content-free signal or pure feed delta to durable aggregate facts, followed by domain-owned expected-order baseline commit and ACK | secondary tick metrics, broad behavior-event unions, app coordinator-owned feed state, or baseline advance before durable stats |
| Storage support maintenance | background support coordinator | `src/apps/background/services/runtime/support/BackgroundMaintenanceCoordinator.js` | reset/clear/repair/import after-effects | generic storage support hub |
| Storage snapshot support | background snapshot service plus build-selected CLSE storage lifecycle | `src/apps/background/services/runtime/support/BackgroundStorageSnapshotService.js`, `src/domains/behavior/CLSEServiceClient.js` | exclusive export/import orchestration; import suspends and reloads CLSE around the complete task | inspector/maintenance owning snapshots, or raw import racing active CLSE writes |
| Zen profile generation composition | background composition adapter plus narrow Zen genesis/storage contracts | `src/apps/background/services/runtime/backgroundKernelZenProfileGenerationFactory.js`, `src/themes/plugins/zen/model/ZenBonsaiProfileGenerationGenesis.js`, `src/platform/storage/themes/zen/ZenBonsaiProfileAggregateStorageContract.js` | one lineage-null destination-epoch aggregate payload shared by sole first-install bootstrap, reset, and snapshot import; `ZenBonsaiClassic2IdentityContract.js` owns identity fingerprint meaning | Dashboard/resource bootstrap, storage layer inventing seed/identity, runtime rebuilding a post-reset aggregate, or background importing the mutable lineage/render model graph |
| Storage inspector support | background inspector service | `src/apps/background/services/runtime/support/BackgroundStorageInspectorService.js` | inspector DTO assembly | snapshot service serving inspector queries |
| Browser API ports | background kernel port helpers | `src/apps/background/services/runtime/backgroundKernel*BrowserPort.js`, `src/apps/background/services/runtime/backgroundKernelBrowserEventListener.js`, `src/apps/background/services/runtime/backgroundKernelPermissionBrowserPort.js` | injected Chrome API adapters, fail-loud ordinary-event observation, and strict permission API normalization | domain/background owners calling `chrome.*` directly or loose permission fallbacks |

## Function Ledger

| Boundary function | Input | Output | Failure policy |
| --- | --- | --- | --- |
| `startTrackingService` | service-worker startup | app kernel start promise | facade only; no alternate startup path |
| `createBackgroundAppKernel` | repository/service dependencies | kernel start/register facade | on-demand construction; helper logic stays outside kernel |
| `createBackgroundMessageRouter` | route dependencies, full init promise, dashboard boot-read promise | `handleMessage` | full init failure returns `SERVICE_INIT_FAILED`; dashboard boot-read failure preserves the owner's explicit `error.code`, or reports `DASHBOARD_BOOT_READINESS_FAILED` for an untyped failure. Only generation-readiness responses carry an owned settings recovery descriptor. |
| `createNudgeFrameHostCapabilityBroker.issue` / `.consume` | trusted route-resolved tab plus session/nonce, then exact host token | one ephemeral authorization receipt | missing secure randomness, expiry, reuse, capacity, sender/binding mismatch, and unknown token fail loudly; no storage or post-restart acceptance |
| `createProfileMutationRuntimeGate` | durable lifecycle reader | admitted task/lease plus exclusive drain, terminal seal, and failure controls | new ingress fails with `PROFILE_MUTATION_RUNTIME_ADMISSION_CLOSED`; exact authorized recovery may re-enter drain from `failed` but can never reopen normal admission |
| `createProfileMutationCoordinator` | lifecycle repository, runtime gate, ordered reset participants | exclusive reset/import or stable read | drains producers before downstream queues/stores, publishes `committed` then `complete`, and seals `reload_pending`; any failure remains closed |
| `createBackgroundKernelProfileMutationControlBindings` | reset/import handlers plus exact ACK request | eager three-action control map | reset/import retain authorization and mutation authority; ACK has reload authority only after exact Dashboard/lifecycle/gate validation and bypasses lazy bootstrap without acquiring mutation authority |
| `createBackgroundKernelProfileMutationRuntimeLifetimePort` | validated exact profile-mutation handoff descriptor | terminal runtime reload | malformed descriptors and reload failure are named; there is no gate reopen, participant resume, timeout, or watchdog fallback |
| `addObservedBackgroundBrowserListener` | ordinary extension event, handler, diagnostic label | registered listener preserving the handler return value | Promise rejection is observed once; synchronous throw is named and rethrown; `runtime.onMessage` does not use this seam |
| `createAudioDullingQaMessageRoutes().browserEvents.handleActionClicked` | real toolbar click tab from the canonical listener seam | one exact-tab dev QA capture activation | missing invitation, tab/origin mismatch, unpinned action, capture failure, and action restoration failure are explicit; no popup or synthetic-click fallback |
| `createStatsTickRuntimeService` | tab-time tracker and stats mutation-batch owner | stats tick/rollover runtime owner | throws on missing required owner dependencies |
| `createIndicatorNavigationActionHandlers` | required browser port and trusted top-frame `OPEN_SITE_RECORD` request | fixed Sites notebook navigation for the sender hostname | denies missing/changed source tabs and invalid destinations; reports failed tab creation without a successful navigation ACK |
| `createFaviconService` | repository, tab-time cache owner, capture policy, and required local browser-cache reader | favicon capture/query/debug owner | enabled capture without the reader throws; invalid or unavailable local image content remains an explicit capture miss, never a remote request or alternate storage read |
| `createBehaviorTelemetryRecorder` | durable content-flow stats owner | exact V1 content-flow signal and trusted-source feed-delta recorder | no secondary tick buffer, broad event fallback, or session backup path |
| `createBackgroundKernelStorageSupportBindings` | support dependencies | snapshot/inspector/maintenance action surface | delegates to split support owners |
| `createBackgroundKernelZenProfileGenerationState` | destination profile epoch | canonical aggregate plus matching ModelState initial entry | invalid epoch or aggregate contract fails before backend mutation |
| `createBackgroundKernelZenProfileGenerationInitializer` | typed ModelState repository, lifecycle repository, shared runtime gate | required `initializeZenProfileGeneration` bootstrap port | holds an admitted runtime lease, reasserts the exact lifecycle generation, atomically installs or reuses the canonical epoch/aggregate pair, and rejects partial, malformed, or mismatched state |
| `createBackgroundBootstrapCoordinator` | listener ports and runtime handlers | init/register/start, `waitForFullInit`, plus dashboard boot-read readiness contract | missing readiness report fails with `BACKGROUND_DASHBOARD_BOOT_READINESS_NOT_REPORTED`; rejected full init records `BACKGROUND_FULL_INIT_EVENT_GATE_REJECTED` and remains terminal for the worker lifetime |

## Recovery Versus Fallback

| Class | Allowed? | Rule |
| --- | --- | --- |
| Dashboard boot read before full init completes | Bounded | The declared `GET_SETTINGS`, boot prewarm, analysis bootstrap, artifact disclosure, and First Vision snapshot reads pass after the named dashboard boot-read milestone; failure preserves the owner's typed diagnostic code, with `DASHBOARD_BOOT_READINESS_FAILED` for untyped failures. An error message does not authorize settings reset. |
| Frame-host capability before full init completes | Bounded | Exact `ISSUE_NUDGE_FRAME_HOST_CAPABILITY` and `CONSUME_NUDGE_FRAME_HOST_CAPABILITY` wait for profile-generation boot settlement and preserve generation capture/acquire/response release. The RAM broker is constructed before bootstrap. Startup Global START awaits its child frame handshake, so that child cannot await the parent full-init promise. Exact sender/session/nonce/tab admission and one-time consumption remain required. |
| Other message before async init completes | Bounded | Outside declared prerequisite/control-plane and early readiness actions, Router waits for the full init promise and reports `SERVICE_INIT_FAILED` on failure |
| Message/browser event during profile mutation | No replay | shared runtime admission rejects it against the closed generation; the caller/event observer receives the named failure instead of executing it after reset |
| Browser callback before async init completes | Bounded | Coordinator FIFO queues history/bookmark/permission/notification callbacks; a rejected init records `BACKGROUND_FULL_INIT_EVENT_GATE_REJECTED` without calling the owner |
| Service-worker suspend during async init | Explicit exception | `runtime.onSuspend` does not wait for full init; terminal settlement/flush work runs immediately within the suspend budget and remains diagnostically best-effort |
| Best-effort browser event side effect | Bounded | Failures must emit named diagnostics; empty catches are forbidden |
| Stats commit debounce | Yes | Debounce is owned by stats tick runtime and cannot become a second cache |
| Tick metrics session backup | No | The write-only backup and in-memory duplicate were retired; durable stats and named runtime-health records are the only retained paths |
| Browser port injection | Required | Domain owners receive ports; direct `chrome.*` access is guarded |
| Favicon local-cache port injection | Required | `backgroundKernelCoreServices` injects `src/platform/browser/faviconFetch.js`; only the exact own-extension `_favicon/` endpoint may be read, and the tracking domain cannot import an app helper or choose a remote network path |
| Retired analytics coordinator | No | Do not recreate the retired analytics coordinator file or route tick state through it |
| Retired storage support hub | No | Snapshot, inspector, and maintenance remain split |
| Empty no-op browser port | No | History/bookmark owners validate injected methods and fail loudly |

## First-Pass Findings

### F1. Old hub retirement is already guarded

Status: keep.

The retired analytics coordinator and retired storage support hub are both
blocked by dedicated CI scripts. The service-worker entry and tracking service
facade are also guarded so startup cannot quietly grow a second composition
root.

### F2. Kernel size is controlled by helper imports, not by hiding owners

Status: keep.

`BackgroundAppKernel.js` is still a large composition root, but its guard checks
that routing, browser ports, protection dispatch, storage support, and runtime
bindings stay in named helper modules. This is the
right compromise for a service-worker composition root.

### F3. The secondary tick buffer is retired

Status: fixed and guarded.

`backgroundKernelTickBuffer.js`, `behaviorMetricsCollector.js`, and
`tickMetricsBackupService.js` formed a write-only duplicate metrics path. They
are deleted, and the storage/TabTimeTracker guards reject their return.

### F4. Best-effort recovery is explicitly diagnosable

Status: keep.

The background kernel architecture guard checks that best-effort failures in
tracking bootstrap, browser event handling, nudge window blur, protection
runtime, and memory purge emit named diagnostics instead of empty catches. This
matches the no-silent-fallback rule while preserving non-blocking runtime work.
Core tracking browser-event reads, stats/continuity mutations, gate-state
updates, and protection dispatch are not best-effort: their rejected Promises
reach `backgroundKernelBrowserEventListener.js`. Only steps explicitly routed
through a named best-effort boundary may be isolated from the ordinary event
result.

### F5. Full init failure stays terminal for the worker lifetime

Status: fixed in the 2026-07-12 MV3 lifecycle pass.

`BackgroundBootstrapCoordinator.getInitPromise()` returns the rejected init
promise after startup failure instead of returning `null` once the promise has
settled. Normal messages and browser events therefore continue to fail through
their explicit init gate; they cannot dispatch into a partially initialized
kernel until Chrome creates a new service-worker lifetime.

## Verification Targets

Use these checks when this boundary changes:

- `npm run check:background-entrypoint:facade`
- `npm run check:tracking-service:facade`
- `npm run check:background-kernel:architecture`
- `npm run check:tracking-analytics:retired`
- `npm run check:background-storage-support:retired`
- `npm run check:storage:architecture-boundaries`
- `npm run check:tab-time-tracker:architecture`
- `npm run check:bus:sender-boundaries`
- `npm run test:file -- tests/nudgeFrameHostCapabilityBroker.test.js tests/trackingServiceFacade.test.js tests/backgroundMessageRouter.test.js tests/backgroundBootstrapCoordinator.test.js tests/statsTickRuntimeService.test.js tests/behaviorTelemetryRecorder.test.js tests/backgroundMaintenanceCoordinator.test.js tests/backgroundStorageSnapshotService.test.js`
- `node scripts/e2e/mv3LifecycleE2E.mjs --dist=<built-extension-dir>`

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
