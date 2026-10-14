# Experiment Debug Boundary Map

- Status: Active
- Owner: dashboard development Experiment hub and debug-lab surfaces
- Last validated against code: 2026-10-04
- Path policy: current-only
- Canonical for: development-only Experiment hub, lab catalog/outlet, CLSE diagnostics UI, worker runtime telemetry diagnostics, Sentinel protocol lab controls, ceremony preview/replay, stats pipeline diagnostics, Zen pond/bonsai debug fixtures, and the detached Zen pond render research boundary
- Companion to:
  - `docs/architecture/repository/background-runtime-boundary-map.md`
  - `docs/architecture/repository/storage-stats-tracking-boundary-map.md`
  - `docs/architecture/repository/nudge-main-runtime-boundary-map.md`
  - `docs/architecture/repository/nudge-worker-runtime-boundary-map.md`
  - `docs/architecture/repository/zen-pond-seam-map.md`

## Purpose

The Experiment tab is an app-owned, development-build-only debug switchboard.
It is not a Zen theme capability and its source graph is excluded from public
builds by the build-selected entry alias. It may compose lab controls and
diagnostic readers, but it must not become the source of truth for worker
runtime state, stats facts, Sentinel protocol runtime state, ceremony progress,
CLSE runtime/settings state, or Zen presentation data.

The practical reading question is:

```text
Can a failed diagnostic read stay visible as a failed diagnostic read,
without the Experiment tab inventing empty runtime truth or a legacy route?
```

## System Flow

Experiment shell:

```text
ExperimentHubTab
  -> useDashboardTabReadiness(tabId="experiment", surfaceId="home")
  -> preference/protocol-ready home shell
  -> experimentLabCatalog
  -> ExperimentLabOutlet (one named boundary, selected module owner only)
       -> workspace owner: ExperimentWorkspace
            -> useDashboardTabReadiness(surfaceId=selectedSection)
            -> selected diagnostic/presentation lab
       -> CLSE owner: experiment/clse/CLSELab
            -> local status query + control-store pending/error gate
            -> useCLSEStore + validated CLSE runtime messages
```

Worker runtime telemetry:

```text
WorkerRuntimePanel
  -> readWorkerRuntimeEvents()
  -> readWorkerRuntimePersistenceStatus()
  -> readPersistedWorkerRuntimeEvents()
  -> WorkerRuntimeTelemetryStore
  -> WorkerRuntimeEventRepository
  -> generation-bound WORKER_RUNTIME_EVENT_CACHE transport
  -> trusted background route / local background persistence port
  -> WorkerRuntimeEventCapability + ProfileMutationRuntimeGate
  -> WorkerRuntimeEventStore
  -> chrome.storage.local worker_runtime_events
```

Sentinel protocol lab:

```text
SentinelProtocolLab
  -> useProtectionNudgeDispatchControl()
  -> extension-page runtime DEBUG_* Sentinel messages
  -> background nudge/protection runtime owners
  -> content/runtime diagnostics and full protocol timeline
```

Ceremony preview:

```text
CeremonyPreviewLab
  -> CeremonyOverlay
  -> platform ceremony renderer registry
  -> progressionUnlockDebugClient
  -> trusted dev-only background progression route
  -> sole background ProgressionService + typed session projection owner
  -> reload after preview-mode ACK
  -> ordinary Main presentation conductor performs First Vision
```

Stats diagnostics:

```text
StatsPipelineDiagnosticsLab
  -> runtime stats/debug messages
  -> browser source surface callbacks (alarms, tabs, windows, idle)
  -> strict browser permission snapshot
  -> stats runtime health, storage inspector, trend/domain facts
  -> local diagnosis report and copy-only report preview
```

Artifact instrument preview:

```text
ExperimentWorkspace artifact lab (non-Zen)
  -> ExperimentArtifactPreview + OS reduced-motion preference
  -> buildExperimentArtifactPreviewContext
  -> canonical widget/family mapping + releaseChildren
  -> explicit ephemeral configured-child fixture
  -> buildArtifactActivityState / buildArtifactPresentationState
  -> resolveArtifactRenderState / buildArtifactRenderContext
  -> selected theme's standalone instrument
```

The lab's existing active toggle is a synthetic configured intent, and its color,
cycle state and tuning remain local preview inputs. The active Experiment tab and
artifact section admit preview motion; leaving that surface parks it, and reduced
motion keeps every vector loop still. Parking retains the configured child posture.
The context marks `diagnostics.fixture.source="experiment_synthetic"`,
`scope="artifact_preview"` and `persisted=false`; its presentation activity is
not evidence of real protection, deletion or a completed ritual. This bridge reads
no business store and writes no settings/storage. Unknown themes, widget mappings
or malformed preview inputs fail explicitly. Zen's four existing artifact rituals
keep their original props and execution owner outside this bridge.

Zen presentation fixtures:

```text
ExperimentWorkspace pond/bonsai labs
  -> synthetic fixture builders and local controls
  -> bonsai lab starts with its explicit synthetic preview enabled, so absent
     canonical evidence cannot leave the canvas empty
  -> one compact command bar for mode/model/fixture actions
  -> Single preview stage + one lifecycle/shape inspector
  -> A/B full-width comparison stage with no nested scroll owner
  -> preference-basin learning: render-sensitive active25, same-seed single-factor questions
  -> adaptive spatial questions: explore/broad low-mid-high, establish ladder/bracket + periodic wide probe, confirm basin boundary
  -> PASS = abstention + predictive freshness consumption; BOTH_GOOD = acceptable tie / indifference evidence + 0.5 calibration audit
  -> stable basin soft-penalty feeds optimizer in the same latent keyspace
  -> bonsai model default/reset = g15_4; classic2/classic = explicit comparisons
  -> G15.4 uses the product life-state adapter; Classic2 comparison keeps an
     isolated ephemeral lineage + ephemeral_scrub wood clock
  -> theme widgets with explicit experimental props
  -> Zen pond scanner with rosterAuthoritySource="experiment_synthetic"
  -> one retained dashboard pond runtime; leaving Home parks the canvas and
     entering Pond Lab reattaches that same exact logical channel
  -> no in-dashboard dual scanner; categorical A/B belongs to the detached
     Comparison Studio and Single is the only performance topology
  -> no persisted Zen runtime truth
```

Pond Lab control audit (2026-09-08):

- Cache hard reset is one visible action with pending/failure feedback. It clears
  persisted koi appearance, activity-profile and roster caches, retains tuning,
  then requests a serialized renderer replacement. It is not a GPU-cache-only
  action; the UI states that scope in both locales.
- Runtime status consumes scanner readiness events, including actual first-frame
  acknowledgement and failure details. Cache-clear completion and runtime-ready
  status are distinct. A settings click alone is never labelled a worker ACK.
- Water controls respect parent water/surface/layer gates. Disabling optics or
  refraction clears dependent options instead of re-enabling the parent. Child
  selections survive a water master toggle, and gated controls display inactive.
- Koi shadows, komorebi and tap/koi/petal disturbance sources are exposed through
  their existing canonical debug-toggle keys. Shadow/disturbance gates are
  independent of the water material master; the UI labels that master accordingly.
- Event-model authoring and numeric controls use `koiEventMotionLimits.js`, the
  same ranges as the integrator. Trailing-body wavelength has its own 3.2 upper
  limit; continuous-spine retains 6. Existing tuning is retained, while controls
  display the effective clamped value. Event-only head controls are unavailable
  in CPG and kinematic models. Grace projection spans the event stiffness range
  instead of saturating every value at the integrator's upper limit.
- The environment-channel panel is explicitly a settings-derived preview, not
  worker telemetry. A calculation failure is visible instead of ten zero values.
- The workbench keeps one canvas beside four inspector sections: scene, water
  and light, koi, and diagnostics. `pondTunerFlowModel.js` owns section-to-group
  mapping; model-inapplicable precision groups are omitted. Numeric controls
  accept typed values within the same bounds as sliders. Feel macros disclose
  that they overwrite the related precision values.
- Effect isolation stores the exact prior toggle selection and enables one
  effect with its required gates. Restore returns that selection; unrelated
  controls are disabled during isolation. Copy experiment includes the fixture,
  tuning, visual profile, requested effects, isolation and scanner readiness.
- `dashboard/capture --surface=pond-lab --theme=zen` owns the ephemeral browser
  journey for four sections, canvas retention, effect isolation/restore and hard
  reset through the actual UI. It observes a new renderer first frame after
  reset, without claiming per-effect GPU or long-duration performance proof.
- Rock-contact research now replaces the narrow shadow geometry contract:
  support-relative height is scaled by 0.62, preserving the fixed base and
  silhouette contact ring. The retired full-scene ambient-mask facade is removed.
  Candidate texture/material exports, canopy fields, shader patch anchors and
  standalone development aliases follow the current product module contracts.

Detached Zen pond render research:

```text
scripts/dev/zen-pond-render-research
  -> fixed scenario + deterministic synthetic-domain input
  -> optional visual-only Comparison Studio parent
     -> two isolated, independently compiled renderer page lifetimes
     -> aligned A/B columns compose categorical floor, plant, rock,
        komorebi, caustics, and sky-reflection axes
     -> at most one fixed-port renderer server per visible slot
     -> concurrent telemetry marked invalid and never used for performance
  -> product ZenSignalScannerContainer
  -> product ZenHomeRendererWorkerSession
  -> pond_only: exact product pond logical channel + Pixi renderer
  -> home_contention: staged pond ACK, then actual Classic2 bonsai channel
  -> one physical zen_home_renderer lease for both logical channels
  -> product worker CPU telemetry + telemetry-gated Pixi GPU timer query
  -> sequential baseline page close
  -> optional candidate build with exact compile-time module replacement
  -> screenshot + metrics + provenance artifacts
```

This standalone lane is complementary to the dashboard Pond Lab. The dashboard
lab is an in-app manual fixture surface. The detached lane gives an agent a
loopback host, a stable browser RPC, compile-time candidate slots, and
sequential measurement without booting the extension dashboard. It still uses
the product pond channel; it is not an independent Canvas2D approximation or a
second renderer owner.

## Owner Table

| Concern | Owner | Key files | Output | Forbidden shortcut |
| --- | --- | --- | --- | --- |
| Lab switchboard | dashboard Experiment hub | `src/apps/dashboard/tabs/experiment/ExperimentHubTab.jsx` | lightweight stable home/shell and selected-section navigation | importing every diagnostic runtime on home or owning worker/stats/nudge/ceremony/CLSE runtime state |
| Lab catalog/readiness | dashboard Experiment catalog | `src/apps/dashboard/tabs/experiment/experimentLabCatalog.js` | canonical section ids/order/copy ids and selected-section hydration/widget profile | duplicating section lists in the tab or loading every lab dependency on home |
| Heavy diagnostic workspace | dashboard Experiment workspace | `src/apps/dashboard/tabs/experiment/ExperimentWorkspace.jsx` | selected non-CLSE diagnostic/presentation lab and section readiness | loading the whole workspace on Experiment home or becoming a canonical runtime owner |
| Non-Zen artifact preview fixture | Experiment artifact preview bridge | `ExperimentArtifactPreview.jsx`, `experimentArtifactPreviewContext.js` | exact theme/family context, explicit ephemeral released-child intent, retained color/cycle/tuning inputs and section/reduced-motion admission | real business facts, settings/store reads or writes, cross-theme substitution, inferred missing child values, or replacing Zen's ritual caller |
| Selected async lab | dashboard Experiment outlet | `src/apps/dashboard/tabs/experiment/ExperimentLabOutlet.jsx` | selected `workspace` or `clse` module through one named Suspense boundary | generic nested lab runtime, static CLSE/workspace import from the hub, or hiding the Experiment shell |
| CLSE diagnostics UI | Experiment CLSE lab | `src/apps/dashboard/tabs/experiment/clse/CLSELab.jsx` | controls, status, buckets, logs, and personal-baseline diagnostics | a separate CLSE navigation tab, hiding the enable control while disabled, or treating failed queries as empty data |
| Worker telemetry memory | worker telemetry store | `src/platform/workers/runtime/WorkerTelemetry.js` | bounded in-memory runtime events | making persisted read failure look like zero events |
| Worker telemetry persistence client | worker runtime event repository | `src/platform/storage/runtime/WorkerRuntimeEventRepository.js` | fixed-key transport and one captured profile generation per producer lifetime | direct Chrome storage writes, recapturing generation at debounce flush, caller-provided fallback arrays |
| Worker telemetry persistence owner | background worker runtime event capability/route + typed store | `src/platform/storage/runtime/WorkerRuntimeEventCapability.js`, `src/apps/background/services/runtime/messageRoutes/workerRuntimeEventMessageRoutes.js`, `src/platform/storage/internal/chrome-storage/stores/WorkerRuntimeEventStore.js` | `worker_runtime_events` cache, trusted generation-bound requests, one FIFO writer, terminal drain and mutation-only clear | untrusted senders, stale generation writes, malformed cache rows collapsing into zero events, old producer writes after reset/import |
| Worker telemetry UI | worker runtime panel | `src/apps/dashboard/tabs/experiment/WorkerRuntimePanel.jsx` | event filters, counters, visible read/clear/persist failures | clearing the panel on storage read failure |
| Sentinel lab control | Sentinel protocol lab | `src/apps/dashboard/tabs/experiment/SentinelProtocolLab.jsx` | debug config controls, spawn trace, timeline | empty catches around timeline/config/diagnostic actions |
| Ceremony preview | ceremony preview lab + dev session projection command | `src/apps/dashboard/tabs/experiment/CeremonyPreviewLab.jsx`, `src/apps/dashboard/progression/progressionUnlockDebugClient.js`, `FirstVisionDevelopmentProjection.dev.js` | local overlay preview plus non-durable full First Vision replay | creating a Dashboard progression service, importing its repository, or resetting canonical progression for ordinary replay |
| Stats pipeline diagnostics | stats diagnostics lab | `src/apps/dashboard/tabs/experiment/StatsPipelineDiagnosticsLab.jsx` | local report, strict permission snapshot, and copyable diagnostic bundle | treating missing or malformed browser/runtime owners as empty canonical facts |
| Stats rules benchmark | stats rules benchmark lab | `src/apps/dashboard/tabs/experiment/StatsSitesBenchmarkLab.jsx` | synthetic benchmark report with explicit empty transition/effect owners | writing policy/settings from benchmark data |
| Zen pond/bonsai fixtures | Experiment workspace + classic workspace runtime config | `ExperimentWorkspace.jsx`, `ZenPondExperimentLab.jsx`, `zenClassicWorkspaceRuntimeConfig.js`, pond fixture helpers | one retained single-renderer pond preview, local synthetic candidates, an enabled-on-entry ephemeral bonsai preview, Classic2-default bonsai controls, and clipboard snapshots | mounting a second pond scanner, persisting synthetic fixture state, advancing durable lineage, or treating legacy `classic` as the production baseline |
| Detached Zen pond render research | loopback research host + product pond/Home renderer channels | `scripts/dev/zen-pond-render-research/**`, `ZenSignalScannerContainer.jsx`, `ZenCoreStatusClassicHome.jsx`, `ZenHomeRendererWorkerSession.js` | independently composed categorical floor/plant/rock/komorebi/caustics/sky-reflection A/B pages, fixed-input product-render captures, pond-only versus real Home contention, single-renderer performance measurement, sequential automation, and local artifacts | copying the pond/bonsai, hydrating durable bonsai state, importing research from `src`, mounting two pond channels in one renderer page, treating concurrent A/B cost as evidence, or treating a research alias as product fallback |

## Function Ledger

| Boundary function | Input | Output | Failure / missing-data policy |
| --- | --- | --- | --- |
| `getExperimentLabSections()` | build-selected lab feature switches | ordered visible section ids | optional sections are filtered in the catalog; CLSE remains visible while disabled |
| `normalizeExperimentLabSectionId()` | section id and enabled policy | `home` or canonical visible lab section | unknown/hidden ids return the explicit home fallback and do not propagate |
| `getExperimentLabReadinessProfile()` | selected section id | exact surface id, hydration keys, and widget types | unknown ids resolve to the home profile; CLSE dependencies never block home |
| `buildExperimentArtifactPreviewContext()` | canonical non-Zen theme/widget, local active/color/cycle fixture, surface admission and reduced motion | shared versioned render context with explicit synthetic provenance and only canonical released children | rejects invalid theme/widget/input/catalog with visible diagnostics; fixture configuration survives parking without authorizing runtime work |
| `getExperimentLabModuleOwner()` | selected section id | `workspace`, `clse`, or no owner for home | every non-home section has exactly one module owner; unknown/home ids do not invent a loader |
| `preloadExperimentLabSection()` | section intent | selected module-owner promise or explicit home no-op result | rejected workspace/CLSE imports are evicted and never cached as success; recognized stale hashed-chunk fetches enter shared one-time build-generation reload recovery |
| `CLSELab.sendCLSEMessage()` | CLSE diagnostic message type/payload | validated runtime response | missing/failed/malformed responses throw and reach the lab error/warning surface |
| `CLSELab.fetchData()` | active lab status refresh | validated current status/control DTO | latest status revision wins; initial failures show the lab error surface and later failures retain data with a visible warning |
| `CLSELab.fetchDiagnostics()` | selected Logs subsection | buckets/events and aggression logs | diagnostics have an independent revision/error owner; polling retains the last valid rows instead of replacing them with a whole-lab loader |
| `CLSELab.enqueueControlCommit()` | slider interaction-boundary value | serialized settings command then canonical status refresh | drag movement stays local; only the latest draft may release its dirty guard, and a failed commit restores canonical status visibly |
| `readPersistedWorkerRuntimeEvents()` | none | persisted worker runtime event array | storage read failures throw; missing key is an empty event list; malformed cache values or event rows throw `WORKER_RUNTIME_EVENTS_INVALID` |
| `WorkerRuntimeEventRepository.captureWriteAdmission()` | producer's first persistence admission | sticky profile-generation promise | transport/admission failure stays visible; the same producer never recaptures a later generation |
| `WorkerRuntimeEventCapability.request()` | fixed-key cache operation + captured generation | acknowledged diagnostic cache result | common runtime gate and durable lifecycle reject closed/stale requests |
| `WorkerRuntimeEventCapability.quiesceForProfileMutation()` / `clearForProfileMutation()` | profile replacement participant / cleanup | cancelled telemetry debounce, drained write tail, removed cache | failures reject the mutation; the old producer lifetime stays terminal |
| `readWorkerRuntimePersistenceStatus()` | none | persisted mirror health snapshot | write mirror failures remain visible as status and memory-only telemetry |
| `WorkerRuntimePanel.refreshWorkerRuntimeSummary()` | optional UI refresh policy | merged memory + persisted events | read failure keeps memory events visible and shows an error |
| `WorkerRuntimePanel.clearWorkerRuntimeSummary()` | user clear action | cleared memory/persisted event cache | clear failure stays visible even if the follow-up read succeeds |
| `SentinelProtocolLab.refreshTimeline()` | runtime timeline query | timeline snapshot | failed responses and thrown errors update `timelineError` |
| `SentinelProtocolLab.updateDebugConfig()` | debug config patch | settings-store mutation | rejected writes update the lab status surface |
| `CeremonyPreviewLab.handleReplayFirstVision()` | replay click | typed `first_vision_preview` session command, then reload | command failure shows an error; reload only follows successful session ACK; canonical progression is untouched |
| `StatsPipelineDiagnosticsLab.runDiagnostics()` | optional target domain | local diagnostic report | failed diagnostic assembly is reported as run failure; per-step diagnostic failures stay in the report |
| `StatsSitesBenchmarkLab.runBenchmarks()` | synthetic stats scenarios | report-only rules snapshot benchmark | must wire all required stats query owners, including explicit empty transition/effect readers |
| `buildExperimentPondSyntheticDomainCandidates()` | local seed | lab-only Zen pond domain candidates | candidates must be passed with `rosterAuthoritySource="experiment_synthetic"` and must not be relabeled as stats facts |
| `ZenPondExperimentLab()` | active lab state, synthetic/live fixture, strict visual profile | one `SignalScanner` beside the section inspector, attached through the retained dashboard pond runtime | fixture key/roster updates do not mint a competing hard-reset token; the retained owner fences a late release from the previous tab lease; hidden tabs cannot reacquire on reset; A/B evaluation uses the detached Comparison Studio |
| `buildZenKoiRosterSnapshot()` synthetic profile admission | `experiment_synthetic_domain_candidates` plus an explicit non-persistent activity profile per candidate | complete worker-safe fish roster without model-storage hydration | synthetic candidates missing a valid profile fail; live stats candidates cannot inject this lab-only profile path |
| `createZenPondResearchRuntime()` | fixed scenario, seed, and compile-time variant | visible state plus `window.__ENTROPY_ZEN_POND_RESEARCH__` RPC | unknown inputs, missing debug telemetry, product worker failure, and first-frame timeout remain explicit errors |
| `buildZenPondComparisonCompositeManifest()` | exact categorical floor, plant, rock, komorebi, caustics, and sky-reflection selection | one deduplicated research-only compile-time replacement manifest | missing/unknown axes, duplicate targets, and unregistered product/candidate paths fail; shared plant/rock texture ownership is resolved by an explicit combination adapter |
| `startZenPondComparisonStudioServer()` | exact A/B visual-axis selections, scenario, surface, and Compare/Single mode | controller page plus at most one isolated renderer server per visible slot | unknown selections fail; an axis change closes and recompiles only its slot; Compare is visual-only, while Single closes the right slot before admitting measurement |
| `injectDebugSurfaceDisturbances()` | exact debug-only source fixture | non-persistent worker admission request plus canonical simulation telemetry delta | unknown/malformed sources fail; an ambiguous post-commit timeout is not retried because it could duplicate an event |
| `resolveZenPondResearchVariantModuleReplacement()` | exact imported module plus registered variant | candidate module path, one declared promoted-strategy original dependency, or no replacement for the product baseline | only product pond targets and research-local candidate paths are valid; the Ishigumi shared-module seam may bypass only its exact base rock target; unknown/missing/out-of-root/cross-candidate paths fail the build |
| `agentRunner.mjs` | scenario set, baseline variant, optional candidate variant | sequential screenshots, metrics, provenance, and candidate-minus-baseline deltas | every page/context/server closes before the next variant; it never creates a side-by-side pond performance comparison |
| `buildZenPondResearchValidRunPortfolio()` | source-stable audit manifests plus exact scenario/surface groups | exactly three valid repeats per group, rejected-run ledger, median/ranges, probe quantiles, frame pacing, and typed GPU support | fingerprint/environment mismatch, duplicate groups, missing metrics, or any valid-repeat count other than the requested three fails loudly |
| `resolveZenClassicExperimentBonsaiGrowthModel()` | requested comparison model + active lab policy | Classic2 by default; explicit `classic` comparison while the experiment surface is active | an inactive/non-experiment caller is not allowed to opt into the lab model seam |
| `resolveZenBonsaiClassic2WoodClockPolicyForLineageMode()` | exact Classic2 lineage mode | `ephemeral_preview -> ephemeral_scrub`; `durable_main -> persisted_history` | Experiment cannot select a clock separately; its slider may rewind displayed ephemeral wood but cannot lower or write Main `maxObservedGrowth` |
| `copyTextToClipboard()` | serialized debug snapshot | clipboard success boolean | browser clipboard degradation is local to copy feedback only |

## Recovery Versus Fallback

| Class | Allowed? | Rule |
| --- | --- | --- |
| Missing worker event key | Yes | an absent `worker_runtime_events` key means no persisted events |
| Malformed worker event cache | No fallback | an existing `worker_runtime_events` value must be an event-object array; malformed values throw `WORKER_RUNTIME_EVENTS_INVALID` |
| Worker event storage read failure | No fallback | the error must reach the panel and remain visible |
| Worker event storage write mirror failure | Visible diagnostics | the memory stream remains canonical for immediate telemetry, and the mirror failure is recorded as memory-only telemetry |
| Worker event clear failure | No fallback | local events may be cleared, but persisted clear failure remains visible |
| Sentinel polling failure | Visible degradation | the lab keeps existing timeline data and updates `timelineError` |
| Sentinel debug settings write failure | No silent recovery | rejected writes must update the status surface |
| Ceremony preview play | Yes | preview state is local and does not mutate progression |
| First-vision visual replay | Narrow dev projection | must go through the typed session client and existing Main conductor; no canonical milestone write or durable reset |
| First-vision durable reset | Restricted dev action | explicit canonical mode and focused canonical-progression tests only; ordinary Experiment UI cannot call it |
| Stats diagnostic heuristics | Report-only | diagnostic stages can warn/fail, but cannot rewrite stats facts |
| Browser source surface read failure | No empty fallback | missing `alarms`, `windows`, or `idle` callback owners must appear as owner-unavailable evidence, not empty alarms/null windows/default idle state |
| Browser permission snapshot read failure | No empty fallback | malformed permission snapshots must remain diagnostic step errors from `permissionsGetAllStrict()`, not `{ permissions: [], origins: [] }` |
| Stats rules benchmark empty evidence | Lab-only fixture | empty transition edges and intervention effects must be named fixture owners, not missing query-service owners |
| Selected Experiment module loading | Named async boundary | `ExperimentLabOutlet` may show the policy-owned Experiment frame for the selected workspace or CLSE module while keeping the hub shell mounted |
| Replaced hashed lab chunk | Bounded document recovery | `dynamicImportRecovery.js` may reload once per lab owner/runtime build id; a repeated same-generation failure stays on the explicit lab error surface and manual reload action |
| CLSE status/query failure | No empty fallback | initial failure shows the lab error surface; polling failure may retain the last valid data only with an explicit warning |
| Zen synthetic pond data | Lab-only fixture | synthetic candidates are props for rendering tests with `dataIsolationMode` and `experiment_synthetic` authority, not runtime truth |
| Detached pond scene key | Lab-origin UI/debug storage only | the host writes only the product scene-generation workspace key on its separate loopback origin before a full renderer remount | the host cannot hydrate product stats/settings, reuse extension storage, or claim bit-exact replay while product motion RNG remains non-deterministic |
| Detached pond candidate | Compile-time research replacement | one registered candidate or validated comparison composition may replace exact product pond modules for a separately built page lifetime | no runtime fallback, no product import of research, no duplicate target owner, no two logical pond channels inside one renderer page, no concurrent A/B performance claim, and no automatic promotion |
| Zen bonsai lab renderer | Explicit lab-local owner | Experiment and standalone preview canvases use the `lab_preview` Canvas2D renderer; they never acquire the singleton Home `bonsai` worker channel, while A/B evaluation remains on strict `zen_ab_trial` compute with a worker-local pinned generation repository |
| Zen bonsai reverse scrub | Lab-only presentation | the ephemeral lineage may retain decisions reached at the furthest slider value, while displayed Classic2 wood uses `min(currentLifeGrowth, maxObservedGrowth)` | no durable lineage write, no history rewind, and no second growth model owner |
| Zen bonsai workbench layout | Experiment presentation composition | Single owns one stage plus one inspector; A/B owns the full stage and may not introduce a candidate-body scroll container | duplicating lifecycle controls above and beside the canvas, retaining the retired full-width pot study, or keeping the inspector mounted in A/B |
| Zen bonsai A/B learning policy | `SakuraLearningFactorPolicy` + `SakuraPreferenceBasinModel` + `SakuraPreferenceLearningPolicy` + `SakuraPreferenceBasinObjective` | active factor admission, compatible history projection, recent basin/broad ledgers, exact next focus/center/gap, PASS recovery/freshness consumption, BOTH_GOOD tie calibration, and optimizer soft guidance/frozen unresolved axes | all-65 equal coverage, fixed-center questions, mixed-axis credit assignment, PASS-as-tie, stale decisive-only validation windows, active-acquisition AUC as an unlock gate, step-count-masked pairwise loss, feature-only pairwise optimization, neural readiness as optimize gate, or untracked profile fallback |
| Clipboard fallback | UI-only | copy failures may return false for feedback; copied data is not canonical |

## Current Findings

### F1. Experiment tab is still a switchboard, not a runtime owner

Status: keep.

`ExperimentHubTab` opens on a lightweight home hub without importing
`ExperimentWorkspace` or CLSE. The single outlet then resolves the selected
`workspace` or `clse` module owner. `ExperimentWorkspace` composes the heavy
diagnostic sections and passes explicit experimental props to theme widgets.
Synthetic pond and bonsai controls stay local to the lab surface. Synthetic pond candidates enter the Zen scanner only through
`domainCandidates` plus
`rosterAuthoritySource="experiment_synthetic"` and `dataIsolationMode`; live pond
domain candidates use `stats_snapshot`, while target-mode live inputs use only
`signalScannerTargets`.

The hub is app-owned across themes in development builds. Public builds replace
the entry at the bundler boundary, so none of the Experiment or CLSE lab source
is reachable from the public dashboard graph.

### F2. Worker runtime persisted event reads no longer accept fallback arrays or malformed cache rows

Status: fixed in the 2026-06-29 experiment debug pass; tightened in the
2026-07-01 event-cache validation pass.

`WorkerRuntimeEventStore.get()`, `WorkerRuntimeEventRepository.get()`, and
`readPersistedWorkerRuntimeEvents()` now distinguish a missing storage key from
a failed storage read. The panel keeps memory events visible and shows the read
or clear error instead of showing an empty event stream.

`WorkerRuntimeEventStore` now also treats an existing non-array
`worker_runtime_events` value, or an array containing non-object event rows, as
`WORKER_RUNTIME_EVENTS_INVALID`. The debug cache is allowed to be absent, but it
is not allowed to be corrupt and still look empty.

Persisted mirror write failures also stay visible. `WorkerTelemetry` keeps the
live stream in memory, updates a persistence status snapshot, and appends a
memory-only `worker_fail` event for `persist_worker_runtime_events` without
recursively scheduling another mirror write.

Persistence is now owned solely by the background capability. Dashboard producers
capture a profile generation before their first debounced persistence and keep
that admission for their entire JavaScript lifetime. The fixed-key cache transport
admits only trusted extension pages; the background uses an injected local port
to the same capability. Both paths use the shared runtime gate and exact durable
generation check. There is no direct-storage client or storage fallback.

Full reset and snapshot import terminally cancel pending telemetry timers, drain
admitted persistence and the typed store's FIFO, and remove the nonportable cache
through the capability. A late old producer cannot recreate it after the new
profile generation is installed. Live memory diagnostics and explicit persistence
errors remain available in the retired lifetime until runtime reload.

### F3. Sentinel protocol lab no longer drops debug action failures

Status: fixed in the 2026-06-29 experiment debug pass.

Timeline polling, target refresh, spawn/stop follow-up refresh, diagnostics
refresh, debug config writes, and timeline clear failures now land on the
existing `timelineError` or status surfaces.

### F4. Ceremony replay uses the non-durable progression projection

Status: fixed in the 2026-07-22 development-projection pass.

First Vision replay goes through the typed dev session client and sole
background `ProgressionService`. It reloads only after preview mode is
persisted, then delegates the actual scene and ceremony to the ordinary Main
presentation conductor. Projected presented/spent acknowledgements do not write
canonical progression, and completion returns to the default development mode.
The standalone ceremony-card play action remains a local overlay preview.

### F5. Stats diagnostics intentionally aggregate failures as report evidence

Status: keep under watch.

`StatsPipelineDiagnosticsLab` catches individual diagnostic steps so it can
produce a path report. That is allowed because the failures are preserved as
step errors and critical-path stages, and the report is copy/debug output only.

### F6. Stats rules benchmark wires the full query-service owner set

Status: fixed in the 2026-06-29 experiment benchmark pass.

`StatsSitesBenchmarkLab` builds synthetic stats facts to stress the Rules
snapshot read model. Because `createStatsAnalysisQueryService()` requires facts,
transition-edge, intervention-effect, cycle, and settings owners, the benchmark
must provide explicit fixture owners for all of them. Empty transition edges and
intervention effects are part of the benchmark input contract and are recorded
in the report read-model contract; they are not missing owners and not canonical
runtime truth.

### F7. Stats diagnostics expose missing browser surface owners

Status: fixed in the 2026-06-29 stats pipeline diagnostics pass.

`StatsPipelineDiagnosticsLab` reads browser callback surfaces for alarms,
focused window, and idle state, plus the strict browser permission snapshot.
Missing callback owners now produce explicit `*_UNAVAILABLE` evidence and
visible observation codes. Malformed permission snapshots stay as
`PERMISSIONS_GET_ALL_RESULT_INVALID` diagnostic evidence from
`permissionsGetAllStrict()` instead of becoming an empty permission set. In
particular, a missing alarms owner is not allowed to collapse into an empty
alarm list and masquerade as `tick_alarm_missing`.

### F8. Bonsai lab converges on Classic2 without becoming a history owner

Status: fixed in the 2026-07-11 Classic2 convergence pass.

The bonsai model selector now opens and resets on `classic2`; `classic` remains
available only as a named comparison. The workspace runtime config, rather than
the tab, owns the model and time policies. Experiment always uses ephemeral
lineage and `ephemeral_scrub`, so a high→low→high slider sequence can reproduce
the requested stage without changing the durable Main lineage. Home keeps
`persisted_history` and therefore continues to render from monotonic
`maxObservedGrowth`. The tab owns only the synthetic input values and selected
comparison id. Its canvas also owns an explicit local `lab_preview` render path.
It must not acquire the singleton `zen_home_renderer` Bonsai channel, which is
reserved for mounted Home; this local path is the lab's primary renderer rather
than a fallback from a failed Home worker. Candidate evaluation itself remains on
the strict `zen_ab_trial` compute worker. That worker receives the exact
Dashboard generation and uses `ZenWorkerModelRepository`; it does not reconnect
to Home rendering or subscribe to the Dashboard's Chrome-storage lifecycle.

The Classic workbench composition is intentionally asymmetric by mode. Single
uses one compact command bar, one large preview stage, and one inspector; the
inspector is the only visible owner of synthetic lifecycle sliders. A/B removes
that inspector and gives the two candidates the full remaining stage. Its
question strip and secondary actions are fixed-height siblings of a
`minmax(0, 1fr)` candidate grid, and the candidate body must not own vertical
scroll. The former full-width experimental pot study is not part of the
Classic2 primary workbench. Single preview instead creates an explicit measured
`lab-preview` garden-bed layout frame, compiles it through the shared
CSS-pixel-to-device-pixel projection seam, and gives the local Canvas2D renderer
the canonical `frame-garden-bed` style plus one render-only material choice.
This is a lab compositor input, not Home layout reuse or persisted workspace
state. A/B keeps a neutral fixed comparison planter until a separately specified
pair projection can guarantee identical measured surfaces for both candidates.

### F9. CLSE now has a reachable UI consumer without becoming a runtime owner

Status: fixed in the 2026-07-13 Experiment integration pass.

The former CLSE tab was visible only when `clseEnabled` was already true, while
its own toggle was the only dashboard control that could enable it. The
independent registry entry therefore created a first-run reachability cycle.
CLSE now appears unconditionally as an Experiment lab in development builds.
The Experiment home waits only for preference/protocol readiness. Selecting CLSE
loads its module through the single `ExperimentLabOutlet` boundary; the lab then
owns its status query and keeps settings controls inert until the canonical
`useCLSEStore` control snapshot is loaded. Initial entry requests status only;
buckets/events and aggression logs are deferred until Logs is selected and then
queried together under an independent diagnostics revision/error state. Status
polling does not replace valid log rows, slider movement stays local until an
interaction boundary, and lab deactivation invalidates in-flight UI commits
without changing the canonical store, runtime, message, or storage owners.

### F10. Pond renderer research is detached without copying the product pond

Status: established in the 2026-07-26 phase-1 research-host pass and extended
with phase-2 Home contention/GPU telemetry and the 2026-07-27 deterministic
ablation/valid-run portfolio pass.

The standalone host imports `ZenSignalScannerContainer`, the existing synthetic
domain fixture, and the canonical Home worker path directly. Each synthetic
candidate carries an explicit non-persistent activity profile because the
worker contract requires one while isolated labs must not hydrate the canonical
model cache. Fixed scenarios
make dry overcast daylight, clear night, and multiple rain intensities
independently reproducible. Product storage hydration is disabled and the
loopback origin writes only the scene-generation debug key before remount.

Candidate changes are compile-time replacements registered outside `src`.
Baseline and candidate execute in separate page and server lifetimes because
the actual product renderer admits one `pond` logical channel. The runner
records existing worker telemetry and screenshots but does not call a visual
winner.

`home_contention` first waits for the pond ACK and then mounts
`ZenCoreStatusClassicHome` with a read-only First Vision presentation identity.
This avoids durable profile hydration and startup-compilation order becoming a
steady-state cost confound. The session snapshot must show the exact
`["bonsai", "pond"]` logical channels on one physical lease before measurement.
The pressure/rhythm visuals remain declared synthetic fixtures; their
statistics and storage controllers are not copied into the lab.

Pixi GPU timing is admitted only when the existing worker telemetry budget is
enabled. It wraps the world/stage render submission with non-blocking
`EXT_disjoint_timer_query` sampling, keeps a bounded pending-query queue, and
reports unsupported/disjoint/failure states explicitly. Headless SwiftShader
may not expose the extension, so CPU comparison validity and GPU comparison
validity remain separate. A source-boundary guard prevents product imports from
the research directory and is part of the prebuild architecture checks.
The timer-query implementation is a dev/research build capability and is
excluded from the public Zen Home worker closure. Public builds retain the same
metrics shape with `reason="build_capability_disabled"`; they do not silently
claim a zero GPU cost. The worker artifact contract forbids the timer module
from re-entering the public closure.
The detailed worker boot/runtime-health event timeline follows the same build
capability. Public workers return an explicit disabled snapshot and do not
capture stacks, retain event arrays, or build timeline budget projections.

The ablation runner does not treat a requested-toggle snapshot as owner proof.
For each case it preserves the sent commit, waits for a newer worker frame and
the expected owner probe, captures the render result, and evaluates CPU sample
eligibility separately from the probe contract. A probe may pass while a short
SwiftShader performance window remains invalid; zero-frame or unsupported-GPU
samples never become synthetic savings.

Fish shadow and canonical `koi_wake`/`tap`/`petal` disturbance sources have
debug-only independent controls. Deterministic disturbance fixtures are
research-owned, non-persistent worker inputs. Canonical requested/admitted/
suppressed source truth remains in product simulation telemetry; the lab records
before/after deltas but cannot become a second simulation or ripple owner.
Malformed fixtures, unknown effects, missing worker commits, settle timeouts,
and probe mismatches fail loudly. A fixture request is not retried after an
ambiguous post-commit timeout because it could duplicate the event.

Mid-matrix browser/worker failures write `ablation-failure.json` before the
runner exits. The valid-run merger may combine several audit manifests only
when content fingerprint and browser environment are exact matches and each
requested scenario/surface group has exactly three valid runs. Invalid attempts
remain listed as rejected evidence. GPU query support remains a typed
supported/unsupported state with unsupported quantiles `null`, never `0`.

## Re-Audit Checklist

- Run `npm run test:file -- tests/workerRuntimeEventStore.test.js tests/workerRuntimeEventRepository.test.js tests/workerRuntimeEventCapability.test.js tests/workerRuntimeEventMessageRoutes.test.js tests/workerRuntimeContracts.test.js tests/workerRuntimePanelPersistenceContract.test.jsx` after worker telemetry persistence changes.
- Run `npm run test:file -- tests/experimentTabLoadingContract.test.jsx tests/clseLabPermissionFailure.test.jsx tests/statsSitesBenchmarkLabContract.test.jsx tests/ceremonyPreviewLabProgressionReset.test.jsx tests/firstVisionPresentationEventPlan.test.js tests/ceremonyOverlayWatchdog.test.jsx tests/ceremonyRendererCore.test.js` after Experiment/CLSE/Ceremony lab changes.
- Run `npm run check:background-kernel:architecture` after Sentinel debug message route or runtime owner changes.
- Run `npm run check:dashboard:i18n-contract` after Experiment tab copy changes.
- Run `npm run test:file -- tests/experimentTabLoadingContract.test.jsx tests/zenClassicWorkspaceRuntime.test.js tests/themes/zenBonsaiClassic2LineageProjection.test.js tests/themes/zenWorkerSingleOwnerContract.test.js` after Classic2 lab model/clock or renderer-owner changes.
- Run `npm run check:zen:architecture` after Classic2 model, lineage, or wood-clock boundary changes.
- Run `npm run test:file -- tests/statsPipelineDiagnosticsLabContract.test.jsx` after stats pipeline diagnostic source-surface changes.
- Run `npm run check:security:surface` after stats diagnostics browser permission snapshot changes.
- Run `npm run check:zen-pond-research:boundary` after detached pond scenarios, variants, host ownership, or candidate paths change.
- Run `npm run test:file -- tests/themes/zenPondResearchHarness.test.js tests/themes/zenPondComparisonComposition.test.js` and `npm run build:zen:pond-render-research` after the detached host contract, comparison composition, or build adapter changes.
- Run the focused pond worker/control tests after adding an ablation ID,
  worker debug action, owner probe, or telemetry field; verify both
  `pond_only` and `home_contention` for owner-application claims.
- Run `npm run audit:zen:pond-render-research -- --scenario dry_overcast_midday,steady_rain_midday --repeats 3` after product pond renderer or telemetry changes when a controlled real-Chromium rain-cost comparison is needed.
- Run `npm run audit:zen:pond-render-research -- --scenario steady_rain_midday --all-surfaces --repeats 3` when pond-only versus shared-worker Home contention is the question; read `contentionComparisons` and keep unsupported GPU-query results separate from CPU validity.
- Confirm new Experiment debug labs expose failures on a visible lab status surface instead of empty catches or empty arrays.
