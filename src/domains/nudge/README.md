# nudge domain

Canonical home for content-side friction, feed-flow sensing, Enso interaction,
Sentinel Flare runtime, and nudge presentation behavior.

This directory is an umbrella for several bounded contexts. It is not a shared
utility bucket and it does not expose one broad domain facade. External callers
use the narrow named modules below and keep lifecycle, DOM, storage, worker, and
theme ownership separate.

Read the relevant Active map before changing code:

- `docs/architecture/repository/friction-nudge-effect-boundary-map.md`
- `docs/architecture/repository/nudge-main-runtime-boundary-map.md`
- `docs/architecture/repository/nudge-worker-runtime-boundary-map.md`
- `docs/architecture/runtime/feed-flow-runtime-target-architecture.md`
- `docs/architecture/runtime/dom-targeting-runtime-architecture.md`

## Canonical Owner Map

| Area | Owner | Canonical paths | Boundary |
| --- | --- | --- | --- |
| Shared nudge vocabulary | cross-nudge contracts and capability facts | `core/**`, including `core/targetingHealthContract.js` | content-free constants and fail-loud capability/health projections only; no DOM, selector, storage, or recovery authority |
| Site identity and target-profile mechanics | selector-free identity catalog and generic profile contract | `targeting/siteIdentityCatalog.js`, `targeting/contracts/targetProfileContracts.js` | canonical site id, strict schema/merge validation, immutable compilation, and provenance only; no owner target meaning |
| Owner-local target declarations | behavior, interaction, text, visual, Social Metrics, FeedFlow, and Short-form owners | `behavior/behaviorTargetProfiles.js`, `interaction/interactionTargetProfiles.js`, `text/textTargetProfiles.js`, `visual/mediaTargetProfiles.js`, `visual/socialMetrics/adapters/socialMetricTargetProfiles.js` and its named host profile modules, `feed-flow/registry/feedSurfaceProfiles.js`, `short-form/rules.js` | each owner declares and consumes its own target semantics; another owner's profile is never a fallback |
| Sentinel Flare host | content runtime host and selected worker bridge | `runtime/SentinelProtocolHost.js`, `runtime/NudgeOverlayHost.js`, `runtime/SentinelProtocolWorkerBridge.js` | one content host: Site DOM/SVG and Global selected worker; failure never switches renderers |
| Runtime context and admission | context/profile/entry policy | `runtime/nudgeRuntimeContext.js`, `runtime/sentinelFlareProtocolProfile.js`, `runtime/nudgeEntrySeamGate.js`, `runtime/sentinelProtocolEntryPolicy.js` | canonicalize inputs and decide entry without owning persistence |
| Lifecycle ledger | run/tab session state and terminal outbox contracts | `runtime/session/**` | background-safe, content-free session contracts; no broad session barrel |
| Furin daily delivery | full/brief day policy and actual-presentation receipts | `runtime/session/furinDailyPolicy.js` | existing nudge session lock; only this owner accesses the typed durable daily receipt; no timer, usage/debt mirror, or read-time transition |
| Goal identity and new-selection priority | exact semantic binding and pure priority projection | `runtime/goalEpisodeBinding.js`, `runtime/projectReadyGoalPriority.js` | these two named modules may import only the pure `furinDailyReceiptContract.js` storage contract; no repository/store access, new clock, or storage owner |
| Worker protocol | extension-frame worker messages, public-host admission, and worker entry | `runtime/NudgeProtocol.js`, `runtime/NudgeExtensionFrameWorkerProbeProtocol.js`, `runtime/frame-host/**`, `nudgeSwarm.worker.js` | background-issued one-time capability authenticates the transferred MessagePort; serializable data-plane messages only; no DOM or storage owner transfer |
| Runtime debugger | page-local diagnostics, baseline/delta analysis, health projection, and explicit debug controls | `runtime-debugger/RuntimeDebuggerRuntime.js`, `runtime-debugger/RuntimeDebuggerOverlay.js`, `runtime-debugger/RuntimeDebuggerOverlayStyle.js`, `runtime-debugger/RuntimeDebuggerMeasurementGuide.js`, `runtime-debugger/RuntimeDebuggerProbeCatalog.js`, `runtime-debugger/RuntimeDebuggerEffectProbe.js`, `runtime-debugger/core/**` | one overlay/session owner; every tab has a strict measurement recipe, validity comes from the shared content-free vocabulary, Short-form opportunity proof stays independent from the product classifier, producer counters remain monotonic, and debug source leases never emit production lifecycle identity |
| Feed sensing and endpoint control | feed observation, readiness, safety, native endpoint lifecycle | `feed-flow/**`, `attention/**` | DOM-bearing context stays content-local; observations crossing a boundary are selector-free |
| Enso interaction | click/feed admission, shared spawn policy, episode lifecycle | `interaction/**`, `interactionManager.js` | one source-scoped interaction owner; no timer-only or background trigger |
| Behavior sensing | content behavior signals and judge | `behavior/**` | behavior facts only; it does not become protection policy truth |
| Content effects | visual, text, input, navigation, indicator, media and short-form managers | `visual/**`, `textShuffleManager.js`, `text/textShuffleTargetResolver.js`, `text/textShuffleMutationQueue.js`, `text/textShuffleOwnershipLedger.js`, `effects/**`, `indicator/**`, `media/**`, `video/**`, `video-skip/**`, `short-form/ShortFormBlockManager.js`, `short-form/shortFormTargetResolver.js`, `short-form/platforms/**`, root effect managers | lifecycle owners apply compiled effects and provide explicit cleanup; Text queue/resolver/ledger and Short-form platform resolvers own only their named state or action-intent boundary |
| Input visual brake brush | root listener/caret owner plus private brush motion and rendering context | `inputVisualBrakeManager.js`, `input-visual-brake/**` | one binary setting selects one canonical brush profile; the root manager may perform one ephemeral caret measurement per rendered input point, while the context receives geometry/timing only and owns cadence-derived pressure, arc-length samples, join-zone rewetting, positional drying, and shared-edge Canvas ribbon rendering |
| Protocol scene and simulation | ritual state, renderer, swarm engine, scene assets | `nudge/**`, `protocols/**`, `rendering/**`, `engine/**` | presentation implementation; not dispatch, storage, or policy authority |
| Koi rendering adapters | theme-consumable koi geometry/render adapters | `koi/adapters/**`, `koi/render/**` | render contracts only; theme consumers do not gain nudge lifecycle ownership |
| Ambient presentation | nudge-owned ambient/garden effects | `garden/**`, `effects/gardenAmbient/**` | bounded presentation effects with explicit teardown |

The files currently at the domain root are retained content-runtime or worker
entry seams:

- `inputDelayManager.js`
- `inputVisualBrakeManager.js`
- `interactionManager.js`
- `navigationButtonLockManager.js`
- `nudgeSettingsClient.js`
- `nudgeSwarm.worker.js`
- `textManager.js`
- `textPipeline.js`
- `textShuffleManager.js`

The root is frozen. New implementation belongs in an existing bounded context
or in a newly named context added to this map and its architecture guard in the
same change. Relocating the retained files is a separate cutover; do not create
forwarding facades to simulate that move.

Content teardown clears runtime effects through
`protection/content/runtime/ProtectionFrictionModifierRuntime.js` and its
`ProtectionRegistry` owners. It does not call a second nudge cleanup facade.
The retained `inputDelayManager.js` has no release feature registration or
production mount/import caller; it remains an isolated implementation under
its focused tests until its separate retirement.

## Public Seams

There is intentionally no umbrella index at the nudge domain root. A module is
public only for the bounded role named here or in one of the Active maps.

- Protection content runtime may use the root effect-manager seams,
  `behavior/BehaviorHub.js`, `behavior/BehaviorJudge.js`,
  `visual/statusIndicator.js`, and the named Sentinel entry-policy modules.
- Content target owners may use `targeting/siteIdentityCatalog.js`,
  `targeting/contracts/targetProfileContracts.js`, and their own named profile
  module. The mechanical contract does not permit importing another owner's
  target declaration as a backup.
- `input-visual-brake/**` is private to `inputVisualBrakeManager.js`; callers do
  not pass input values or take over its session/renderer lifecycle.
- Background protection/tracking may use content-free
  `runtime/session/*State.js`, `runtime/session/*Contract.js`,
  `runtime/session/nudgeSessionCore.js`,
  `runtime/session/nudgeSessionStore.js`,
  `runtime/session/nudgeSessionShared.js`, and
  `runtime/sentinelOutcomeContract.js`. It must not import overlay, renderer,
  feed DOM, or interaction managers.
- Background goal authorization may use `runtime/goalEpisodeBinding.js` and
  `runtime/projectReadyGoalPriority.js`. The shared feed owner consumes the
  immutable binding; it does not compute budgets or choose goals. The passive
  `runtime/session/readFurinGoalEndState.js` queries existing typed owners for
  the host/day readout without acquiring the mutation lock or writing state.
  Only `furinDailyPolicy.js` accesses the daily receipt repository; the two
  named pure-contract readers above do not acquire persistence authority.
- The nudge render-host app may use `runtime/NudgeProtocol.js`, the worker probe
  protocol, and `runtime/frame-host/NudgeRenderHostChannel.js`. The public WAR
  page may emit unauthenticated readiness only; worker start requires the
  background-issued one-time capability, and all later commands/events remain
  on the authenticated `MessagePort`. Worker messages must remain serializable.
- Dashboard diagnostics may use runtime context/profile normalizers and declared
  debug/presentation projections. It does not call the production host or write
  lifecycle state.
- Page runtime debugging uses only the named `runtime-debugger/**` seams. New
  cost probes publish bounded snapshots/operations into the v2 baseline session;
  they do not reset manager counters, persist page evidence, or mount their own
  floating surface. Overlay presentation stays behind
  `RuntimeDebuggerOverlayStyle.js`: use only the explicit
  `--entropy-runtime-debugger-*` host overrides, do not import a theme plugin or
  inherit generic page theme tokens, and do not add backdrop compositing cost to
  the page being measured. `RuntimeDebuggerMeasurementGuide.js` is the single
  owner for per-tab activation, baseline, stimulus, valid-signal, and caution
  copy; a new visible tab must add an explicit guide instead of inheriting a
  generic fallback. Hint open/closed state remains local and non-persistent.
- Theme code may use `koi/adapters/**` and `koi/render/**` as render seams.
  Theme plugins do not own admission, session state, outcome, or fallback.
- Feature-family `index.js` files are local to their named context. They are
  not permission to add a new umbrella barrel above them.

The lifecycle ledger is deliberately exposed as narrow files rather than a
barrel so imports reveal whether a caller reads a gate, commits a phase, owns an
episode, or drains a terminal outbox.

## Forbidden Boundaries

- No new implementation file at `src/domains/nudge/*`; choose a bounded
  context.
- No umbrella root index or runtime-session barrel.
- No cross-owner target catalog, target-profile fallback, or duplicate hostname
  resolver beside `targeting/siteIdentityCatalog.js`.
- No background or dashboard import of DOM-bearing feed, overlay, renderer, or
  interaction owners.
- No theme-owned admission, lifecycle, terminal outcome, persistence, or
  cross-theme fallback.
- No runtime-debugger path carrying a production key/run id or sending
  production presented/resolved/aborted messages.
- No raw DOM node, selector, page text, or URL path crossing message, storage,
  telemetry, or learning boundaries.
- No second Sentinel host, worker-to-main renderer fallback, mirror session
  store, or legacy read path.
- No direct storage or browser API ownership in a nudge feature when the
  canonical platform/background owner already exists.
- No new independent Barrier/Loop Breaker actuator that bypasses the Active
  Feed Horizon and Enso admission contracts.

## Change Protocol

1. Start from the relevant Active boundary map and confirm the real owner.
2. Put implementation in the owning bounded context, not the umbrella root.
3. If an external consumer is required, add the smallest named seam and record
   its allowed consumers here.
4. Update this README, the relevant Active map, and
   `check:nudge-domain:owner-architecture` together when a top-level owner or
   public seam changes.
5. Keep session, worker, debug, DOM, and theme DTOs explicit and fail loudly on
   malformed canonical state.
6. For a relocation, cut imports over in one change and delete the retired path;
   do not leave a compatibility facade.
7. Run the nudge owner guard, the relevant focused tests, and the build/release
   gate appropriate to the changed boundary.
