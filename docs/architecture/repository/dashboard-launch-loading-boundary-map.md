# Dashboard Launch And Loading Boundary Map

- Status: Active
- Owner: repository architecture, dashboard app
- Last validated against code: 2026-10-09
- Path policy: current-only
- Canonical for: dashboard boot sequence, launch context, tab registry/loading gate, Main/Tools keep-alive exceptions, and dashboard owner seams
- Companion to:
  - `docs/system-architecture/06-dashboard-launch-and-loading.md`
  - `docs/apps/dashboard/dashboard-boot-sequence-architecture.md`
  - `docs/architecture/repository/settings-command-boundary-map.md`
  - `docs/architecture/repository/theme-engine-boundary-map.md`

## Purpose

Zen groups canonical `main`/`sites` routes into one retained Main pane through
`workspaces/garden/gardenRouteFamily.js`. DashboardLayout projects only sidebar
navigation to one Garden item; canonical route visibility, progression and params
remain unchanged. MainPanel supplies the independently lazy/error-bounded Sites
slot first on the Sites route, then retaining that admitted DOM and presentation
state while its runtime/query consumers are parked elsewhere. This scoped Garden
retention preserves the closing paper motion and drafts; it is not a global tab
keep-alive policy. Internal mode changes do not run whole-pane motion.
`bootstrap/useDashboardLaunchIntentHandoff.js` retains only an initial Sites
request interrupted by First Vision and consumes it once through the canonical
navigation owner after boot, scene and progression admission. Blocked clicks are
not queued. `useDashboardRenderRuntime` treats both Garden routes as live scene
workload, keeping speculative artifact GPU preparation out of their shared Worker.

Zen's app-wide petal surface is one lazy `ZenAppPetalHost` mounted by
`DashboardPage` outside tab panes. It is not a tab preload or first-frame gate.
The host consumes only the narrow `api/petalField.js` and `api/petalSource.js`
seams; the field renderer graph stays out of the dashboard boot static closure.
Boot, ceremony, consent and reduced-motion gates suspend its cosmetic activity.
Navigating tabs retains its field and last Home source without waking the parked
Home renderers. Home unmount releases its exact source-owner identity; the
memory-only snapshot is neither a persisted business cache nor a new reader of
canonical bonsai storage.

The Zen boot renderer owns a one-shot stroke. Stroke completion releases its
Worker and admission lease while the last canvas pixels remain for Main readiness
and the shell fade. First-frame readiness does not settle presentation completion:
any subsequent Worker failure or admission revocation must also settle the shell's
completion promise as failed. A settled first-frame promise must never suppress
that terminal notification.

The shell lifetime owner prepares opacity compositing from mount. After theme
and core readiness it allows root paint beneath the opaque shell, keeping the
root inert and pointer-blocked until the existing visual release. Paint
preparation is not a new readiness gate or proof of GPU presentation; failures
and hard-timeout still restore input without waiting for animation frames.

Tools critical preparation also admits the first visible controller/schema and
its exact scene through `preloadToolsInitialArtifact.js`, using the shared
disclosure resource and navigation's visible ordering. This does not mount a
controller or settings hooks. No all-family sweep is admitted.

Tools critical widgets include `ArtifactIcons`, `ArtifactPanel`, `ArtifactCanvas`
and the declared `ArtifactGalleryVisual`. Navigation selection joins the same
preload as pointer/focus intent, so a click without earlier intent starts module
and widget work together. Gallery capability resolution reads the surface
descriptor without creating a lazy component. Gallery code preparation is owned
by `themes/core/tools/artifactGalleryPreparation.js`; it allocates no resources.

Dashboard rendering lifetime is separately owned by
`layout/useDashboardRenderRuntime.js` and
`themes/core/runtime/dashboardRenderRuntime.js`. Zen reserves the existing
physical Worker and artifact session for the dashboard lifetime. After boot-shell
dismissal and Garden parking, input-quiet idle admission can warm one actual artifact scene; explicit
Tools selection starts the same preparation alongside module loading. This work
adds no boot-critical or Main composite first-frame requirement. The host adopts
the same renderer/cache, parked artifacts produce no frames, and final theme or
dashboard release disposes unused resources. Other themes declare no such owner.

This map audits the dashboard launch/loading path after the storage, settings,
and theme boundary cleanup. It keeps the app shell readable from boot to active
tab render without hiding route resolution, theme widget loading, hydration
errors, or tab runtime retention behind parallel policies.

The practical reading question is:

```text
Can a dashboard surface explain how it launches and becomes ready without
inventing a second tab policy, a hidden settings reader, or a sibling-tab import?
```

## System Flow

Protected-site registration URLs are intake-only navigation.
`dashboardLaunchContext.readDashboardRouteRequest` parses
`setup=site-registration` through the shared intent contract and produces Main
params `{ registrationIntent: { domain, goalMinutes } }`. DashboardContent
retains that request through First Vision's selection lock; the covered surface
receives no registration params. Once Main opens the actual dialog, its same-tab
ACK clears params and `consumeDashboardSiteRegistrationRoute` removes only the
matching setup/domain/goal query keys through `history.replaceState`, preserving
other query/hash/history state. Reload therefore does not repeat an acknowledged
setup, and neither URL intake nor consumption commits settings or permissions.

The shared `useSiteRegistrationJourney` hook projects canonical protocol
membership and progression milestones for Sidebar, Sites and Main. A ready
first-registration policy hides or reveals Sites navigation; unresolved state
keeps that entry explicitly busy rather than admitting direct registration.
Sites owns loading/error/retry and retained management-frame admission. External
Sites Add routes pass through `resolveDashboardRegistrationJourneyRoute`, so
they use Main until the canonical journey admits direct addition.

Visible boot starts outside React and stays theme-light:

```text
dashboard boot shell
  -> dashboardBootShellThemeContext
  -> theme core boot shell seam
  -> bootManager themeReady gate

dashboard entry named stages
  -> dashboardEntryStageTraceContract
  -> dashboardThemeBootRuntimeHandoff
  -> theme core dashboardBootRuntime
  -> one startup reservation adopted by the first Zen Home channel
  -> dashboard entry import
```

React boot resolves business readiness through one app boot manager:

`MainPanel` forwards the progression unlock disclosure as a render input. Its
memo comparison must observe disclosure identity changes even when all other
props are stable: loading completion admits Home mounting and its exact first
frame work. A later unrelated boot update must not be required to reveal it.
The first-visit recovery slot follows the same render-input rule: its appearance
and removal update Main immediately without waiting for navigation or replacing
the retained Garden host.

```text
DashboardPage
  -> DashboardAdmissionBoundary (one lifecycle subscription and vault status controller)
  -> read-only lifecycle capture; closed reset -> existing profile recovery
  -> SecurityVaultBoundary (local preparation/retry or explicit full-wrapper separation)
  -> protectionReady profile generation / compatibility readiness and lease admission
  -> DashboardSetupAdmission (canonical protocol initialization/subscription)
       -> protocol ready context; UNSET remains fail-closed in collection
  -> useDashboardBoot
  -> bootManager
  -> apps/boot exact prewarm snapshot contract
  -> preference/analysis initialization starts in parallel; protocol reuses its admitted store
  -> preference/protocol core gate
  -> coreReady gate
  -> main tab first-frame gate
  -> dismissible dashboard
  -> sidebar and ordinary navigation remain available without selecting consent
  -> explicit shadow action / retained registration intent opens existing Main editor
       -> after First Vision/capacity/shadow admission
       -> UNSET: domain, initially unchecked protected-site recording, Start
       -> site + complete five-key policy in one conditional typed ACK/reconciliation
       -> or explicit Browse -> conditional full OFF acknowledgement
       -> chosen profiles retain their current policy and existing editor
```

`DashboardSetupCanvas` emits `entropy:dashboard-setup-surface` only after it
mounts. The boot shell releases its opaque/input cover for that page and records
only shell dismissal; it does not ACK profile, core, Main, First Vision or a
viewed guidance receipt. Normal boot and the Main scene conductor run while
UNSET remains closed to collection. First-use interaction follows those owners;
it never advances First Vision or progression to reveal a form. The context
supplies the editor's policy choice and commit status; it neither opens the editor
automatically nor restricts ordinary tab navigation. Sidebar DOM and geometry
remain present through UNSET and First Vision. Boot and scene-focus locks, and
the independent first-registration Sites route policy, remain authoritative.
Denial or failed reconciliation remains inline with the registration draft.
The outer profile-generation owner unmounts Main on reset/import; stale commands
cannot acquire a new-generation settings lease.

`bootstrap/dashboardMainBootReadiness.js` bounds Main's callbacks to the document's
first ready/degraded ACK. Theme or canvas changes may restart Main's visual
coordinator after boot; those later ACKs do not re-enter `bootManager`. Stale
callbacks consult the same canonical boot snapshot, while direct duplicate
manager ACKs retain their explicit failure contract. Forced release still permits
an eventual first ACK without clearing its degraded state.

Cold background startup exposes a narrower read milestone without declaring the
whole service ready:

```text
BackgroundBootstrapCoordinator
  -> stats retention/cache + cycle + settings + CLSE bootstrap settle
  -> start BootPrewarmService.ensureWarm()
  -> dashboard boot-read readiness
  -> dispatch GET_BOOT_PREWARM_SNAPSHOT / GET_ANALYSIS_BOOTSTRAP_SNAPSHOT
  -> unrelated bookmark/nudge/content-script/alarm/focus startup tail continues
```

Tab launch and loading compose a leaf loading-policy seam with the active tab
registry. The readiness hook never imports the registry that dynamically loads
its owning tab:

```text
dashboardLaunchContext
  -> tabs/registry
       -> tabs/loadingPolicy
  -> DashboardLayout
       -> preloadDashboardTabIntent on sidebar pointer/focus intent
  -> MainPanel
       -> isRuntimeActive (selected pane only)
       -> isPresented / isExiting (stacked motion lifetime)
  -> active tab chunk
       -> useDashboardTabReadiness
            -> tabs/loadingPolicy
            -> canonical theme widget chunk state
  -> policy-owned loading frame / tab-root loading-error-ready surface
```

Experiment is the single named section-level exception to the standard tab-root
gate. Its shell remains visible while the selected development lab resolves:

```text
ExperimentHubTab
  -> home preference/protocol readiness
  -> experimentLabCatalog
  -> stable Experiment shell/home
  -> ExperimentLabOutlet (one named nested async boundary)
       -> workspace owner: ExperimentWorkspace + selected-section readiness
       -> CLSE owner: experiment/clse/CLSELab + local status/control pending
  -> selected lab loading/error/ready surface
```

Settings keeps the default Permissions surface in the tab entry and defers only
the two secondary presentation graphs:

```text
SettingsTab ready content
  -> synchronous Permissions section
  -> post-ready bounded idle or section pointer/pointer-down/focus intent
       -> shared Settings Safety / Workspace module record
       -> ready component direct render, or named local pending/error/retry
```

Theme widget readiness stays in the theme registry seam:

```text
tabs/loadingPolicy declares widget contracts
  -> useDashboardTabReadiness / bootSurfaceWarmup
  -> themes/core/registry preload
  -> plugin-owned widget loader
```

## Canonical Owner Table

Boot/profile recovery is independent of successful settings hydration. The
profile gate initially renders a bounded pending surface; normal Dashboard
content mounts only after required core hydration. Exact current settings
corruption exposes `DashboardProfileMutationRecovery` through the named settings
descriptor, while unknown failures use `DashboardBootRecoverySurface`. Failed
React-entry stages use error-only `dashboardBootFailureSurface.js`. All recovery
surfaces publish only `DASHBOARD_BOOT_RECOVERY_EVENT_NAME` presentation readiness
so the shell releases without claiming canonical core/frame/profile readiness.
Document reload is explicit; there is no automatic migration, per-key repair,
alternate snapshot, or silent default. Full reset uses the existing eager reset
control plane and exact response ACK. Failed ACK start retains that receipt for
explicit handoff retry; a successful reset is never repeated by that retry.
The recovery surface always exposes a labeled diagnostic region containing the
prior lifecycle code and, after a failed request, the latest owner/transport
error code. They remain distinct and require no disclosure or another reset
attempt. Request/ACK alerts reference the latest code for accessible reading. Only
`RESET_AUTH_REQUIRED` and `RESET_AUTH_FAILED` ask the user to correct their
settings protection PIN; unrelated failures use a diagnostic request-failure
message. A failed ACK start likewise displays its code beside the existing
receipt-only handoff retry.
The same admission owner checks the read-only reset lifecycle before exposing
local preparation/unlock. A keyless failed/interrupted profile therefore shows recovery,
not fresh preparation. Healthy absent keys are prepared by the background owner,
and the default `unlocked/local` profile has no password form. Vault lock suspends generation readiness without replacing
the lifecycle subscription. An initiating vault reset keeps its response/ACK
surface through lifecycle events; a request failure without a success receipt
yields to closed-lifecycle recovery. Recovery retains its instance through
descriptor/lifecycle transitions. Neither retention can admit normal runtime or
reuse an old document after its generation has closed.

`SecurityVaultControllerProvider` projects the admission owner's same status and
publish function into Settings; optional data-lock controls create no second
status subscription. `DashboardProfileMutationController` similarly retains the
initiating Settings full-reset or replace-import request/receipt outside Dashboard runtime. Lifecycle closure
unmounts all key-dependent children while the stable handoff canvas receives the
response. ACK-start failure offers only receipt retry; failure without a receipt
yields to the existing lifecycle recovery. Neither context reads storage directly.

| Concern | Canonical owner | Canonical path | Source of truth | Forbidden shortcut |
| --- | --- | --- | --- | --- |
| Lifecycle/vault/generation admission | dashboard admission boundary + existing lifecycle hook | `src/apps/dashboard/bootstrap/DashboardAdmissionBoundary.jsx`, `useDashboardProfileMutationLifecycle.js` | canonical lifecycle read/subscription before vault UI; protectionReady generation readiness; initiating reset response/ACK retention | a second lifecycle owner, keyless failed profile treated as fresh setup, or re-admitting an old closed document |
| Initiating full reset / encrypted restore response | admission-scoped profile mutation controller | `src/apps/dashboard/security/DashboardProfileMutationController.jsx` | one pending request and retained successful response; existing ACK dispatch and receipt-only retry | retaining key-dependent runtime behind a closed lifecycle or reissuing a committed reset/restore |
| Visible boot shell lifecycle | dashboard boot shell | `src/apps/dashboard/bootShell.js` | boot shell mount, root reveal, dismiss, hard timeout | React tab graph deciding visible boot shell |
| Dashboard runtime stage admission | dashboard app entry | `src/apps/dashboard/main.jsx`, `src/apps/dashboard/dashboardReactHost.jsx`, `src/apps/dashboard/bootstrap/dashboardDocumentThemeInitialization.js`, `src/i18n/dashboardConfig.js` | one bootstrap call admits React host, Dashboard-profile i18n, document-theme, and App imports; document theme initializes before the single React render request | hiding the full App graph or every tab dictionary in a static `main.jsx` closure or moving React/theme business owners into `bootShell.js` |
| Dashboard entry stage trace | dashboard entry trace contract | `src/apps/dashboard/bootstrap/dashboardEntryStageTraceContract.js` | bounded stage/phase event identity plus marks/full projection; marks derives duration from elapsed start/ready events | identical payload-free event names whose missing details erase stage identity |
| Theme boot runtime handoff | dashboard bootstrap handoff owner | `src/apps/dashboard/bootstrap/dashboardThemeBootRuntimeHandoff.js`, `src/themes/core/runtime/dashboardBootRuntime.js` | one dynamic preparation promise and one pending release intent until the reservation is adopted or returned | component-local reservation variables, direct Zen worker imports, or losing a late reservation after a sibling stage/profile/React failure |
| Tab dictionary readiness | i18n projection and dashboard loading preloader | `src/i18n/dashboardResources.js`, `src/i18n/dashboardDeferredResources.js`, `src/apps/dashboard/loading/preloadDashboardTab.js` | shell/Main bootstrap dictionaries plus cached deferred tab dictionaries settled with tab module readiness | rendering a tab before its namespaces settle or building a feature-owned locale map |
| Development HUD admission and external layout | dashboard layout plus build-selected HUD entry | `src/apps/dashboard/layout/DashboardLayout.jsx`, `src/apps/dashboard/components/DashboardDevelopmentHud.{dev,public}.*` | post-shell-dismiss lazy HUD joined with deferred Tools dictionary; layout owns expanded state and reserves left margin for the 56px launcher or 320px panel plus gap; time and progression share one external panel; public module is a no-op | loading Tools copy or controls before Main first frame; overlaying the panel behind/inside Sidebar; component-local duplicate geometry/open state; shipping dev HUD dependencies in public |
| Development Bonsai right dock | dashboard layout and Home's explicit theme control port | `layout/DashboardDevelopmentDockContext.js`, `layout/DashboardLayout.jsx`, `tabs/main/home/HomeScanWorkspace.jsx` | app owns right host/open state/56px or 320px margin; Home passes placement and preview intent through `bonsaiLifeDebugControls`; theme owns the panel view and renderer commands; preparing diagnostics keep its close control alive | theme importing dashboard code; renderer owning app margins; duplicate Home activation state; using diagnostic frame receipts as business state |
| Boot-only theme hint | dashboard boot shell theme context | `src/apps/dashboard/bootstrap/dashboardBootShellThemeContext.js` | theme preference mirror for startup shell only | importing the prewarm validator, full launch context, or tab registry into boot shell |
| Dashboard boot state machine | dashboard boot manager | `src/apps/dashboard/bootstrap/bootManager.js` | themeReady/coreReady/mainTabFirstFrameReady gates | leaf component declaring dashboard ready |
| Dashboard user-control release | dashboard boot manager | `isDashboardUserControlReleased()` in `src/apps/dashboard/bootstrap/bootManager.js` | normal dismissible readiness or explicit forced visual release | treating `dismissible` alone as the post-timeout navigation lock |
| Boot prewarm business contract | cross-entry app boot contract | `src/apps/boot/bootPrewarmSnapshotContract.js` | exact preference/protocol/analysis/CLSE snapshot composition and validation shared by producer and consumer | platform messaging importing domain/settings/theme policy or background/dashboard owning separate validators |
| Boot prewarm snapshot read | dashboard prewarm client | `src/apps/dashboard/bootstrap/bootPrewarmClient.js` | best-effort background prewarm snapshot request | dashboard building a second bootstrap store |
| Launch tab context | dashboard launch context | `src/apps/dashboard/bootstrap/dashboardLaunchContext.js` | route request, persisted tab hint, warmup context | component-local route/localStorage parsing |
| Surface warmup | dashboard boot surface warmup | `src/apps/dashboard/bootstrap/bootSurfaceWarmup.js` | Main-only critical warmup, then post-first-frame priority-ordered tab groups and named deferred data/widget work under one cancellable generation | manual tab/widget/data preload lists outside policy/registry or treating a timeout as admission-only telemetry |
| Navigation/boot dependency preload | dashboard loading preloader | `src/apps/dashboard/loading/preloadDashboardTab.js` | policy-scoped module or critical-widget preload with shared promise state | Sidebar or boot code inventing separate tab/theme loader caches |
| Development tab-entry measurement | build-profile telemetry alias | `@dashboard-tab-entry-telemetry` → `dashboardTabEntryTelemetry.dev.js` / public no-op | intent/selection/render trace, module and named data cache miss/join/hit, runtime/permission I/O counters, readiness/retry stages, usable paint, and long tasks in development only; boot-owned pending events stay outside later navigation traces | shipping observer/debug state in public or adding measurement-owned readiness truth |
| Tab module record | dashboard loading preloader | `src/apps/dashboard/loading/preloadDashboardTab.js` | one promise plus validated resolved component per tab | boot/intent and `React.lazy` creating unrelated imports or changing a retained tab's element type after resolution |
| Dynamic-import generation recovery | platform extension runtime | `src/platform/extension/dynamicImportRecovery.js` | stale hashed-chunk classification plus one document reload per boundary and runtime build id | feature-local reload markers, retrying the same missing URL indefinitely, or preserving old dev chunks in a public artifact |
| Tab loading/readiness policy | dashboard tab loading policy | `src/apps/dashboard/tabs/loadingPolicy.js` | loading class/frame, intent/boot preload scope and priority, post-first-frame data preload ids, named local async boundaries, route eligibility, readiness scope, hydration keys, and widget contracts for every possible tab id | component/data loaders, active-tab availability, or registry import in the policy leaf |
| Active tab registry | dashboard tab registry | `src/apps/dashboard/tabs/registry.js` | build-profile-selected tab ids/loaders, priority-ordered boot ids, mode/viewport visibility, keep-alive, and active policy projection; public Filter factory is `null`, development may expose a disabled entry | duplicated hydration/widget lists, importing the public-excluded Filter implementation, or readiness hook importing the registry |
| Layout and tab mount | dashboard layout/main panel | `src/apps/dashboard/layout/DashboardLayout.jsx`, `src/apps/dashboard/layout/MainPanel.jsx`, `src/apps/dashboard/workspaces/garden/gardenRouteFamily.js` | active tab render and transition retention; Zen main/sites share one Main pane and sidebar entry while preserving canonical routes; independently admitted Sites retains its DOM with queries parked when closed | sibling tab controller imports, hidden global tab tree, or a second idle preload loop |
| Workspace Back input | dashboard navigation provider and active workspace handlers | `src/apps/dashboard/hooks/useDashboardNavigationButtonLock.js`, `src/apps/dashboard/DashboardPage.jsx` | one physical mouse Back gesture admits one highest-priority active handler; Escape respects local consumption, editing and IME; Sites handles internal layers before Garden closes the sheet | competing global listeners, browser history as a second route owner, or a single gesture closing multiple layers |
| Loading frame | dashboard loading surface | `src/apps/dashboard/loading/DashboardTabStateSurfaces.jsx` | policy-owned frame identity shared by Suspense and semantic readiness | tab components hardcoding unrelated skeleton geometry |
| Tab readiness gate | dashboard loading hook | `src/apps/dashboard/loading/useDashboardTabReadiness.js` | tab/lab surface hydration plus canonical theme widget preload state; retry calls only failed preference/protocol/analysis owners or widget preload | private ready caches, synthetic retry data, or leaf semantic fallback that hides missing hydration |
| Experiment lab catalog | dashboard Experiment catalog | `src/apps/dashboard/tabs/experiment/experimentLabCatalog.js` | section ids, copy ids, selected-section hydration/widget readiness | forcing every lab dependency onto Experiment home |
| Experiment home shell | dashboard Experiment hub | `src/apps/dashboard/tabs/experiment/ExperimentHubTab.jsx` | lightweight catalog and stable shell | importing the heavy workspace or CLSE module on home |
| Experiment async lab outlet | dashboard Experiment outlet | `src/apps/dashboard/tabs/experiment/ExperimentLabOutlet.jsx` | selected `workspace` or `clse` module owner through one named boundary | generic nested Suspense runtime or public-build import of lab code |
| Experiment heavy workspace | dashboard Experiment workspace | `src/apps/dashboard/tabs/experiment/ExperimentWorkspace.jsx` | non-CLSE diagnostic sections and their selected-section readiness | loading all diagnostics on Experiment home |
| Schedule special-session action boundary | dashboard Schedule action workspace | `src/apps/dashboard/tabs/schedule/ScheduleTab.jsx`, `components/ScheduleSpecialSessionWorkspace.jsx` | base Schedule stays ready; isolation controller/panel and allowlist subscription load only after the named action opens | importing the special-session controller/panel into the base Schedule graph or treating action pending as tab readiness |
| Main session-summary AI enrichment | dashboard Main local enrichment boundary | `tabs/main/home/SessionSummaryAiEnrichment.jsx`, `apps/dashboard/ai/SessionSummaryAiPanel.jsx` | non-Zen clean-first-frame idle mount; capability I/O begins only after panel mount | admitting AI/provider code into Zen or the Main critical static closure |
| Rules first-selection data preload | dashboard registry + Rules resources | `src/apps/dashboard/tabs/registry.js`, `tabs/sites/preloadSitesTabData.js`, `tabs/sites/controller/sitesPolicySnapshotResource.js`, `sitesSiteDetailResource.js` | policy-named dynamic loader after Main first frame; same snapshot/detail cache and in-flight promise used by Sites hooks | widening the critical boot snapshot, statically importing Sites data owners into boot, or keeping a separate warmup-only cache |
| Artifact selection preparation | Tools artifact gallery/controller resources | `src/apps/dashboard/tabs/tools/preloadToolsInitialArtifact.js`, `components/useArtifactGalleryController.js`, `selectedArtifactControllerResource.js`, `SelectedArtifactControllerBoundary.jsx` | Tools critical work prepares shared widgets plus the first visible controller/schema and scene; no idle/neighbor sweep; subsequent selection intent joins the same widget/controller records and commits after both ACKs | committing a cold widget/controller, maintaining separate caches, or allowing stale retry completion to replace newer state |
| Tools support action boundary | Tools support visibility/workspace | `src/apps/dashboard/tabs/tools/useStorageSupportVisibility.js`, `components/StorageSupportWorkspace.jsx` | shortcut visibility stays light; inspector controller/panel load only after the named action opens | importing storage capability/IDB owners into the base Tools graph or treating support state as tab readiness |
| Settings secondary-section boundaries | dashboard Settings module resource/boundary | `tabs/settings/settingsSectionModuleResource.js`, `tabs/settings/SettingsSecondarySectionBoundary.jsx`, `tabs/settings/sections/*` | Permissions stays synchronous; Safety/Workspace presentation modules share idle/intent/render records and local explicit retry | moving Settings controllers into duplicate chunks, preloading before ready content, or flashing a lazy fallback for an already-ready record |
| Protection control plane | dashboard protection hooks | `src/apps/dashboard/hooks/useProtectionArtifactsControlPlane.js` and sibling control hooks | base shared settings/runtime control; selected-only destructive Echo hooks remain behind the Tools controller boundary | Filter importing the full control plane for a runtime snapshot or Tools mounting selected-only workflows eagerly |
| Main presentation scene | dashboard presentation conductor | `src/apps/dashboard/presentation/useMainPresentationScene.js`, `mainPresentationSessionState.js` | typed commit-driven decision and scene token after boot/progression inputs | nested Zen/main components, independent timers, or overlay callbacks competing for scene ownership |
| Settings persistence from dashboard | dashboard typed stores/clients | `src/apps/dashboard/stores/**`, settings clients | typed store method or settings command bus channel | feature code importing settings services directly |
| Theme widget implementation | theme registry seam | `src/themes/core/registry/index.js`, `src/themes/core/loaders/widgets.js` | plugin declarations plus one validated module promise/component record shared by preload and `React.lazy` | dashboard importing plugin internals, parallel widget caches, or accepting a malformed preload ACK |

## Function Ledger

| Boundary function | Input | Output | Failure policy |
| --- | --- | --- | --- |
| `resolveDashboardBootShellThemeId` | boot-only theme preference mirror | startup theme id | canonicalizes at startup boundary; does not import prewarm, storage runtime, or tab policy |
| `startBootSequence` | store initialization functions | boot snapshot | prewarm snapshot failures are optional in every build profile; preference/protocol failures remain blocking errors; optional CLSE/analysis/warmup errors are recorded |
| `ensureBootSequenceStarted` | React dashboard owner initialization functions | current boot run or settled boot snapshot | StrictMode/HMR lifecycle reattachment reuses canonical module state; direct `startBootSequence` duplicate calls remain explicit errors |
| `fetchBootPrewarmSnapshot` | background dashboard boot-read route | normalized snapshot or explicit request/response/shape error | transport timeout is `BOOT_PREWARM_REQUEST_TIMEOUT`; unavailable prewarm is never reported as a clean `null` delivery |
| `reportThemeReady` | shell readiness metadata | updated boot gate | degraded shell remains visible in boot state |
| `reportMainTabFirstFrameReady` | main first-frame metadata | updated boot gate | degraded first frame remains visible in boot state |
| `buildDashboardLaunchContext` | allowed tabs and route/storage inputs | target tab id and params | invalid/inaccessible tab resolves through registry-owned fallback candidates |
| `readDashboardRouteRequest` | dashboard URL query | route request and typed params | notification launch `source` is preserved only as `notification`, not arbitrary query text |
| `warmupDashboardSurface` | launch context + generation signal + deadline | critical Main boot-surface preload summary with admitted/settled/pending/skipped counts | a positive timeout bounds the returned promise even when an admitted import remains pending |
| `warmupDashboardSurfaceInteractive` | launch context + policy boot scopes/priorities + generation signal | post-clean-first-frame tab-group summary | target is first, remaining groups follow explicit priority; timeout/abort stops queued admission and never participates in boot correctness |
| `warmupDashboardSurfaceDeferred` | launch context + generation signal | named data and policy-declared widget summary | starts only after an unexpired interactive wave; it does not append generic ActivityGraph/CorePreview/CoreStatus work |
| `getDashboardTabBootDataPreloadEntries` | tab id + route-aware preload context | policy-named lazy data preload entries | undeclared/missing ids fail explicitly; feature loader remains dynamic and runs only in the post-first-frame wave |
| `preloadDashboardTabIntent` | enabled tab id and theme id | policy-scoped module/widget preload | unknown/disabled work is not invented; loader rejection remains explicit to the caller |
| `preloadDashboardTabBoot` | enabled tab id and theme id | policy-scoped boot dependency preload | `none`, `module`, and `critical` remain explicit; boot does not widen the policy locally |
| `preloadDashboardTabModule` / `getPreloadedDashboardTabComponent` | tab id | shared module promise and validated resolved component | invalid default exports fail; stale hashed-chunk fetches enter shared one-time generation recovery; `MainPanel` keeps a successful component choice stable, while a failed attempt is evicted and explicit retry creates a fresh lazy identity |
| `withDynamicImportRecovery` | module loader, boundary id, runtime build id | loaded module, one-time document reload, or terminal rejection | only recognized dynamic-import fetch failures reload; the same boundary/build id cannot auto-reload twice; ordinary module exceptions remain explicit |
| `getDashboardTabLoadingPolicyDefinition` | possible tab id | leaf loading/readiness descriptor | unknown tab returns no policy; it does not claim build-selected tab availability |
| `getDashboardTabReadinessProfile` | tab id and optional lab `surfaceId` | exact hydration/widget profile | unknown tab returns no profile; Experiment home does not inherit CLSE dependencies |
| `getDashboardTabLoadingFrameId` | possible tab id | canonical loading frame id | unknown ids receive only the neutral stack presentation frame, never business readiness |
| `getDashboardTabLoadingPolicy` | tab id | registry-derived loading policy | missing tab returns no policy |
| `getDashboardTabAllowedAsyncBoundaryIds` | tab id | exact policy-declared local boundary ids | unknown tabs and undeclared boundaries remain unavailable |
| `useDashboardTabReadiness` | tab id, theme id, optional surface id | tab/lab readiness phase/error plus failed-owner retry | missing policy, unknown hydration keys, missing required theme, malformed widget ACK, non-ready canonical state, and preload failures surface explicitly; retry re-enters only failed canonical store/widget owners and never fabricates fallback data |
| `DashboardActionAsyncBoundary` loader-owned mode | named boundary id, `loadAction`, `renderAction` | local pending/content/error plus explicit retry callback; one lazy identity per attempt retained above the suspended action subtree | surrounding workspace renders cannot restart a pending import; explicit retry creates a fresh lazy identity; remounting the same rejected module-scope lazy object is not recovery |
| `SessionSummaryAiEnrichment` | Main widget theme, runtime activity, boot-shell dismissal, deterministic draft | `main-session-summary-ai` idle admission or local retry | Zen and pre-first-frame paths perform no module/capability admission; inactivity unmounts the panel |
| `scheduleSettingsSecondarySectionPreloads` / `preloadSettingsSecondarySectionIntent` | ready active Settings content or Safety/Workspace navigation intent | one shared validated module record per secondary section | unstarted idle work is cancelled on inactivity; failure remains explicit and ready records render directly without Suspense fallback |
| `preloadExperimentLabSection` | selected Experiment section id | selected module-owner promise | home is a no-op; stale hashed-chunk fetches use shared generation recovery; other or repeated workspace/CLSE failures remain on the selected lab surface |
| artifact `handlePreloadIndex` / `handleSelectIndex` | disclosed artifact intent or requested index | intent warms the shared widget/controller pair; current artifact remains until both are canonically `ready` and its workflow admits navigation, then one controlled selection commit | stale/missing/failed targets never replace the current artifact; pending destructive review requires explicit Cancel/Confirm; retry is local and stale controller/workflow generations cannot overwrite current state |
| `shouldDashboardTabKeepAlive` | tab id | registry-declared retention decision | retention is explicit and does not enter loading policy |

## Recovery Versus Fallback

| Class | Allowed? | Rule |
| --- | --- | --- |
| Boot shell hard timeout | Bounded | Shell may fail open visually, but boot state keeps timeout/degraded diagnostics |
| Boot/profile recovery surface | Required | pending admission is bounded for display; failure has explicit reload, physically validated settings descriptor has confirmed reset; shell release is presentation-only |
| Optional lazy pipeline error | Bounded | CLSE, analysis, and surface warmup errors are recorded; preference/protocol remain blocking |
| Route/inaccessible tab fallback | Yes | Only tab registry fallback candidates choose the accessible tab |
| Untyped notification source query | No fallback | `tab=schedule` keeps notification params only for typed notification intent/source values |
| Suspense skeleton | Yes | Skeleton/frame loading is presentation-only and does not decide readiness |
| Tab-root readiness error | Required | hydration/widget failures must show error state instead of pretending loaded |
| Stale hashed dynamic-import URL | Bounded recovery | A shared platform seam may reload the document once per boundary/runtime build id so the page enters the current artifact generation; a repeated failure remains visible and user-controlled |
| Truth-independent shell first | Bounded | Shell/geometry may render before owner data, but affected controls stay inert and no business values are fabricated |
| Experiment lab boundary | Named exception | `ExperimentLabOutlet` may suspend only the selected dev lab while the Experiment shell remains mounted |
| Schedule special-session boundary | Named action | `schedule-special-session` may load only after the isolation action opens; the timeline/editor remain the committed tab truth |
| Tools storage support boundary | Named action | `tools-storage-support` may load only after its shortcut opens; the gallery remains the committed tab truth |
| Main session-summary AI boundary | Named enrichment | `main-session-summary-ai` may load only for runtime-active non-Zen Main after the clean first frame and an idle slot; deterministic brief remains authoritative |
| Settings secondary-section boundary | Named presentation | `settings-safety` and `settings-workspace` may load only after Settings ready content; Permissions stays committed and a ready record renders without a lazy fallback |
| Artifact selection preload | Local progressive state | the committed artifact remains visible while a requested renderer prepares; only the navigation slot is pending/error |
| Arbitrary nested async fallback | No | Tabs cannot add boundaries that are absent from loading policy or replace tab truth with a local fallback |
| Main/Tools tab keep-alive | Narrow exceptions | Registry-declared `main` heavy/presentation continuity and `tools` gallery canvas/cache continuity; inactive work remains parked |
| Hard-timeout user-control release | Bounded | Shell and tab navigation fail open, while readiness remains degraded and an unfinished First Vision remains unconsumed in `DEFERRED` current presentation |
| Hidden global tab tree | No | Tabs outside the declared Main/Tools retention must unmount when inactive; no dashboard-wide keep-alive resurrection |
| Sibling tab imports | No | Tabs may use shared app hooks/seams, not each other's tab controllers |
| Direct settings service import | No | Dashboard feature code must use typed stores/settings clients |

## First-Pass Findings

### F1. Owner guard coverage is strong

Status: keep.

`check-dashboard-owner-architecture` locks the boot theme context, launch
context, tab registry, shared protection hooks, typed settings boundaries,
removed compatibility seams, and no sibling-tab import rule. This is the right
kind of architecture guard: it checks ownership, not incidental component shape.

### F2. The old launch/loading doc overstated keep-alive removal

Status: fixed in this pass.

The current code intentionally retains Main presentation and the Tools gallery
when the registry declares their `keepAlive` policy. Loading policy still
excludes keep-alive, and inactive runtime work remains parked. Other tabs are
active-only; these two retention cases are narrow registry-declared exceptions.

`MainPanel` also keeps stacked exit presentation separate from runtime authority.
It supplies `isPresented`, `isExiting`, and selected-only `isRuntimeActive` to every
pane. The old `isActive` prop temporarily remains presentation-compatible while
tab roots migrate, but it is not a valid new effect/request/worker gate. Main is
fully migrated: its status/cycle/protection work parks immediately, its last active
display projection remains mounted, and reactivation reads current canonical store
state rather than treating the retained frame as business truth.

Sites, Schedule, Tools, and Settings now consume the same runtime authority for
their expensive work. Their outgoing panes retain the last committed presentation,
while Sites data resources, Schedule protocol/analysis projections, Tools
protocol/analysis projections, and Settings protocol/security projections stop
observing background store churn. Permission reads may still complete in the shared
resource cache, but a generation check prevents inactive Settings/Tools trees from
committing those completions into local UI state.

### F3. Tab loader/readiness cycle

Status: fixed in the 2026-07-13 dependency-cycle pass.

`registry.js` dynamically loads tab roots, and those roots use
`useDashboardTabReadiness`. The hook previously imported `registry.js` again,
forming one lazy-import strongly connected component across the registry,
readiness hook, and standard tab roots. `loadingPolicy.js` now owns the immutable
loading/hydration/widget descriptors without importing the registry or any tab
component. Both the registry and readiness hook depend on that leaf, so the
loader graph stays acyclic while the active registry remains the sole owner of
build-selected tab availability.

Theme capability filtering in that leaf reads `themes/core/surfaceDescriptor.js`,
not `pluginCatalog.js` or `profile.js`. Theme widget registry/loader and tab-icon
lookup use the same plugin-owned lightweight descriptor, while full manifests
derive the corresponding widget owner/path/icon fields from it. This removes the
full all-theme manifest graph from capability/ID checks. Vite assigns the descriptor
factory/catalog and all plugin descriptors to the existing boot-safe
`dashboard-boot-low-level` manual chunk before any broad plugin grouping. Full
manifest-derived catalog/profile/tools policy modules instead coalesce with the existing
`pluginCatalog` output. Plugin friction presentations are assigned first to their narrow
`theme-friction-presentations` output, so the shared background friction seam does not
inherit the broad manifest graph. This preserves narrow source seams with bounded context files.
The dashboard boot artifact guard reads both the Vite manifest and Rollup module
inventory: bootManager must statically reach the descriptor owner chunk, and that closure
must not contain `pluginCatalog.js` or any plugin `manifest.js`.
The widget registry no longer imports the synchronous appearance registry;
DashboardPage reads backgrounds/transitions through `themes/core/registry/appearance.js`
after its own module admission. This prevents the boot widget-preload path from
reacquiring the full profile/catalog graph through `BootSequence` translation.

Theme definition/profile reads now use `catalog.js` -> plugin `theme.js` and
`profile.js` -> `runtime/profileCatalog.js` -> plugin `profile.js` respectively.
Full manifests consume those same plugin-owned sources but no longer sit on the
Dashboard definition/profile read path. Manifest-only motion, Schedule, sound,
and tools policy seams remain strict `pluginCatalog` consumers and are admitted
only when their owning surface asks for them. Vite preserves the split as
`theme-definitions`, `theme-profiles`, and `pluginCatalog` chunks so a narrow
source import cannot be recombined into the broad manifest evaluation unit.

### F4. Boot timeout is fail-open but diagnosable

Status: keep.

The visible boot shell can dismiss on timeout to avoid trapping the user behind
a loader. That is a UI recovery path, not a source-of-truth fallback, because
`bootManager` records timeout/degraded state and does not mark missing
preference/protocol initialization as clean readiness.

### F5. Warmup follows the surface that boot actually renders

Status: fixed in the 2026-07-10 boot optimization pass.

The dashboard renders `main` until the release gate opens, so correctness-critical
warmup loads only the Main tab chunk and its theme widgets. A clean Main first-frame
commit then admits a low-priority interactive wave from each tab's
`bootPreloadScope`; a deep-linked non-Main target is ordered first and remaining
tabs follow explicit `bootPreloadPriority`. Groups are bounded to two concurrent
tabs and combine module + critical widgets instead of
serializing a module wave and a later widget wave. Sites, Schedule, and Tools are
the current latency-sensitive boot targets; Settings remains intent-only. Schedule
is intentionally first because its module-only group is cheapest, followed by Rules
and then visual-heavy Tools. After the interactive wave completes within budget,
policy-named data resources run before explicitly declared enrichment widgets.
Rules uses that wave for its snapshot and first selected detail while sharing the
same resources with the eventual tab hooks. `MainPanel` does not run a competing
preload loop. All three warmup stages return at their positive wall-clock deadline;
in-flight imports may finish in their shared cache, while queued entries stop on
deadline or generation abort. Every admitted entry receives a combined
generation/deadline `AbortSignal`; staged data preloaders must check it before
starting follow-up I/O or committing results. Already-admitted `import()` calls are
not physically cancellable and may still finish in their shared cache.
Tools critical preparation carries that same signal through the tab preloader
and checks it after disclosure readiness, before admitting the selected-family
controller/widget/runtime loaders. Its deferred disclosure preloader also checks
after module readiness, before beginning the query. Cancellation withdraws only
the caller's admission; shared module and disclosure records remain available
to other consumers.
Forced/degraded/failed release cancels that generation.

### F6. Loading policy now controls perceived geometry and intent work

Status: fixed in the 2026-07-13 tab-loading contract pass.

The leaf policy now declares `loadingFrameId`, `intentPreloadScope`,
`bootPreloadScope`, post-first-frame data preload ids, named local async boundary
ids, and readiness scope in addition to hydration/widgets. `MainPanel` Suspense and the
tab readiness surface resolve the same frame, so Tools reserves its real
artifact workspace geometry instead of swapping a generic settings skeleton for
an aperture-and-control-rail layout. Sidebar hover/focus/pointer intent calls one
dashboard preloader seam. Boot uses the same seam and promise caches: lightweight
tabs can declare module-only preparation, visual tabs can declare their tab-root
critical widgets, and manifestation/enrichment widgets stay out of the blanket wave.

The theme widget loader owns one validated module record and chunk state. Preload
and `React.lazy` consume the same promise; a missing/non-renderable default export
evicts the record instead of producing a false ready ACK. Dashboard readiness checks
both `{ loaded: true, key }` and matching canonical `ready` state. A widget already
prepared by boot or intent preload is therefore ready on the first readiness render
instead of being hidden by a second dashboard-local cache. If lookup already exposed
a lazy component, later readiness preserves that exact element type; only a preload
that completes before first lookup returns the resolved component directly. Tab modules likewise share one resolved-component
record between boot, intent, and render; `MainPanel` locks the first successful
component choice for its lifetime so a lazy-to-direct swap cannot remount kept-alive
Main. A rejected attempt is the exception: the shared record is evicted and explicit
local retry creates a fresh `React.lazy` identity instead of remounting the same rejected payload.
Terminal widget chunk failures follow the same rule: they reject and evict instead
of being converted into a renderable error widget with a false `ready` state.

Tools also preserves the committed artifact during gallery navigation. Pointer,
pointer-down, and focus intent warm the same target widget and selected-family
controller records consumed by selection/render. A cold target is committed only
after both ACKs are canonically ready; failure stays on the requested horizon slot with retry rather than
replacing the aperture/control rail with a whole-tab skeleton. The gallery fully
materializes only the selected artifact card; siblings retain navigation shells.
Echo permission/preview/backup/confirmation hooks live only in its selected-family
controller chunk; Flare debug Spawn/Halt remains owned by Experiment Lab.
While an Echo preview, review, backup, or accepted confirmation is pending, that
controller owns selection admission and keeps Echo mounted until explicit Cancel
or Confirm settles. Controller inactivity invalidates late UI completions without
misreporting or duplicating a canonical mutation that was already accepted.
The hidden storage-support workflow is a separately named action boundary and
does not import its controller/panel until `Alt+Shift+I` opens it.

Schedule follows the same policy-owned action rule for isolation sessions. The
base Schedule graph keeps only the trigger and pure panel id contract; the
special-session controller, allowlist subscription, and panel enter through the
`schedule-special-session` workspace only after the user opens that action.

Settings keeps Permissions in its static entry graph and moves only Safety and
Workspace presentation composition into two policy-named chunks. The first ready
Settings commit schedules both through a bounded idle callback, while section
pointer, pointer-down, and focus intent joins the same validated module records.
Already-ready records render the resolved component directly; rejected records
stay on the selected section until its explicit retry. Controllers, capability
reads, and mutation status remain single-owned by `SettingsTab`.

### F7. Experiment is a named lab-section exception; CLSE is no longer a tab

Status: fixed in the 2026-07-13 Experiment integration pass.

Experiment is a development-only app diagnostic hub, not a Zen theme feature.
Its lightweight `ExperimentHubTab` waits only for preference/protocol and does
not import the heavy workspace. The selected section resolves through
`experimentLabCatalog`; `ExperimentLabOutlet` is the policy-named lab-section
module boundary and selects either the shared `ExperimentWorkspace` owner or the
CLSE owner. CLSE remains visible there even while disabled, which
removes the former circular route where the only enable control lived inside a
tab that was hidden until CLSE was already enabled. The CLSE store/runtime and
boot initialization remain canonical; only its independent navigation entry and
build alias were retired.

### F8. Hashed chunk recovery is shared and generation-bounded

Status: fixed in the 2026-07-13 stale Experiment chunk pass.

Tab modules, Experiment lab modules, and theme widgets can all be requested
after an unpacked extension artifact has been rebuilt. The old page then holds a
hashed URL that no longer exists in the new output. `dynamicImportRecovery.js`
owns that platform condition: recognized dynamic-import fetch failures trigger
one document reload per logical boundary and runtime build id. A successful load
clears the marker; a repeated failure in the same generation stays explicit.
This does not retain old chunks, change `emptyOutDir`, or let a public artifact
keep development-only Experiment code.

## Verification Targets

Use these checks when this boundary changes:

- `npm run check:dashboard:owner-architecture`
- `npm run check:dashboard:boot-artifact-contract` (after a build)
- `npm run check:theme-public-entry-boundaries`
- `npm run check:theme-shared-seams:architecture`
- `npm run check:ui-kit:owner-boundaries`
- `npm run test:file -- tests/dashboardLoadingPolicy.test.js tests/dashboardTabReadiness.test.jsx tests/mainPanelUnmountContract.test.jsx tests/mainPanelMotionProfileContract.test.jsx tests/mainPanelLoadingFallbackContract.test.jsx tests/mainTabLoadingContract.test.jsx tests/mainSessionSummaryAiEnrichment.test.jsx tests/useRuntimeParkedStoreSlice.test.jsx`
- `npm run test:file -- tests/dashboardTabIntentPreload.test.js tests/sidebarTabIntentContract.test.jsx tests/dashboardTabStateSurfaces.test.jsx tests/experimentTabLoadingContract.test.jsx tests/clseLabPermissionFailure.test.jsx`
- `npm run test:file -- tests/settingsSectionModuleResource.test.js tests/settingsSecondarySectionBoundary.test.jsx tests/settingsShellSectionIntent.test.jsx tests/settingsPermissionProjection.test.js tests/settingsTabSecurityFailureSurface.test.jsx`
- `npm run test:file -- tests/dashboardLaunchContext.test.js tests/bootCoordinator.test.js tests/dashboardBootShellStartup.test.js tests/bootShellRendererReadiness.test.js`
