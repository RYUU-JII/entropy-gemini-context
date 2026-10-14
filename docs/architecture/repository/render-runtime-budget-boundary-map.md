# Render Runtime Budget Boundary Map

- Status: Active
- Owner: repository architecture, platform rendering, visual runtime owners
- Last validated against code: 2026-10-10
- Path policy: current-only
- Canonical for: render measurement, resource budgets, surface-local adaptation, and semantic isolation

## Decision

Entropy does not have an app-global quality tier. Platform rendering exposes
only three neutral primitives: loop scheduling, a render-resource envelope,
and a measured render-health sample. Each surface is fixed by default. A
surface may opt into adaptation only when it owns an explicit governor and
effect profiles.

This keeps measurement reusable without making every renderer implement every
quality level.

## Canonical Layers

1. Activity and accessibility decide whether a surface should run. Existing
   owners retain `still`, `ambient`, `full`, visibility, and reduced-motion.
2. The host measures update work, render work, frame interval, dropped-frame
   ratio, visibility, viewport size, and effective DPR into `RenderHealthSample`.
3. Platform resolves target FPS, DPR cap, and maximum viewport pixels. It does
   not name pressure levels or visual effects.
4. An adaptive domain may interpret samples through its own hysteretic
   governor. Fixed surfaces stop at layer 3.
5. The surface owner maps a small cost envelope into effect-specific counts,
   blur caps, history lengths, and optional passes.
6. Protocol meaning, actor counts, interaction, simulation cadence,
   progression, persistence, and worker admission never depend on render
   pressure.

## Canonical Owners

| Concern | Canonical owner | Canonical path |
| --- | --- | --- |
| Shared render loop | platform rendering | `src/platform/rendering/renderLoop.js` |
| Resource envelope and viewport resolution | platform rendering | `src/platform/rendering/renderBudgetContract.js` |
| Raw DPR observation and React subscription | platform rendering / UI kit | `src/platform/rendering/devicePixelRatio.js`, `src/ui-kit/hooks/useDevicePixelRatio.js` |
| React surface visibility observation | UI kit | `src/ui-kit/hooks/useElementVisibility.js`, `src/ui-kit/rendering/useVisibilityGate.js` |
| Renderer-neutral health observation | platform rendering | `src/platform/rendering/renderHealthSample.js` |
| Nudge pressure transition | Nudge rendering | `src/domains/nudge/rendering/nudgeRenderPressureGovernor.js` |
| Nudge cost envelope and effect profiles | Nudge rendering | `src/domains/nudge/rendering/nudgeRenderBudget.js`, `src/domains/nudge/rendering/profiles/**` |
| Zen Home fixed Pond/Bonsai budgets | Zen runtime | `src/themes/plugins/zen/runtime/zenMainWorkerRenderBudget.js` |
| Garden surface activity projection | dashboard garden workspace | `src/apps/dashboard/workspaces/garden/gardenSurfaceActivity.js` |
| Zen app-wide petal fixed budget | Zen petal runtime | `src/themes/plugins/zen/runtime/petals/zenAppPetalBudget.js` |
| Artifact activity and fixed budget | theme artifact pipeline | `src/themes/core/tools/artifactMotionBudget.js` |
| Production surface inventory | repository CI | `scripts/ci/render-runtime-surface-catalog.mjs` |
| Worker admission and failure degradation | platform workers | `src/platform/workers/runtime/**` |

## Production Surface Policy

Zen Home keeps one admitted physical Worker with independent Pond/Bonsai logical
channels. The app's garden activity projection can park Pond while Bonsai remains
active without adding a scheduler, Worker, budget owner or polling loop. Frame
retention and channel activity are separate: existing Pond runtime parking may
dispose its controller after its 120-second idle window, while Bonsai's retained
controller and sibling Worker leases keep their declared lifetime. Main currently
presents both surfaces; common Main/Sites hosting is a later integration step.

`useElementVisibility` acquires its IntersectionObserver and delayed-target frame
retry only while active. Parking releases both and rejects late callbacks from
that lease; returning reacquires observation against the current retained target
with fresh visibility. This observation lifetime does not replace or dispose the
surface's canvas, renderer, or Worker.

### Resolution contract

All production raster cap choices use **1, 1.25, 1.5, or 2**. This is a shared
resource vocabulary, not an application-wide quality setting. Each surface still
owns its cap and total pixel budget. `resolveRenderResolution` delegates to
`resolveRasterResolution`; static canvases use the latter without declaring an
unrelated animation cadence. Both resolve `min(raw DPR, cap, sqrt(pixel budget /
CSS area))` and floor backing dimensions. Actual ratios such as 1.1 or 1.75 are
preserved when the cap and pixel budget permit them. Pixel pressure can require
a ratio below 1; no downstream host, worker or geometry helper may raise it.

Main Pond retains cap 1.25 and its preset pixel budget; embedded Bonsai retains
1.5 / 4,665,600 pixels. Artifact canvas remains 2 / 8,294,400 pixels. First Vision
ceremony uses 1.25 / 3,779,136; other ceremonies, production Canvas2D backgrounds,
Enso/boot, ink, activation and landing surfaces use cap 2 / 8,294,400 pixels.
These are per-target allocation limits, not total process/GPU memory limits.
Research-owned raster exports remain explicit local profiles. SVG/DOM geometry
and internal water-field/world-texture scales are not browser DPR policy.

`devicePixelRatio.js` observes exact-resolution media queries and re-arms on raw
DPR change. It also observes window resize; callers coalesce work or compare
effective geometry before allocation. React consumers use the UI-kit adapter.
There is no global pressure state, worker-global DPR or stored quality mirror.

The artifact host/session key resource replacement by effective fixed-canvas
resolution: raw 2.5 → 3 adopts the same capped renderer/cache; 1 → 2 replaces the
generation and rejects late old frames. CSS geometry still changes independently.
Pond applies the shared pixel calculation at the actual worker viewport rather
than passing a pre-limited continuous value as if it were a cap policy.

The retained Zen gallery engine and comparison harness use the fixed artifact
envelope and platform loop. Its named owner and measurement limits are in
[`zen-artifact-engine-review.md`](../themes/zen/zen-artifact-engine-review.md).
The production Karesansui ground borrows this same renderer/context for static
requests. Its existing heightfield contract bounds each temporary backbuffer to
4,096 pixels per edge and 6,291,456 pixels total; synchronous bitmap transfer and
`finally` restore the gallery dimensions without changing its resolution budget.
The ground pass owns no additional canvas, context, Worker or render target.
It is classified separately in the surface catalog and introduces no adaptive
policy. Gallery retention is seven entries / 48 MiB source textures.
Production artifact scenes execute in the existing admitted dashboard Worker;
the UI platform loop requests at most one Worker animation frame at a time.
Parking stops requests and rejects late frames. There is at most one unconsumed
bitmap plus the displayed bitmap, each `640 × 960 × effectiveDPR² × 4` bytes
(2.34 MiB at DPR 1, 9.375 MiB at the DPR 2 cap). Driver render buffers and GPU
texture overhead are outside this source/output accounting. Worker update/submit
timings and UI bitmap sink timing use separate clock domains. No quality or
simulation policy is changed by this transport.

| Surface | Policy | Measurement | Resolution |
| --- | --- | --- | --- |
| Global Sentinel worker | adaptive, owner-local | actual update + render work | DPR and viewport-pixel cap |
| Site Furin SVG | fixed; visible host frames, sleeps after settling | phase/timing diagnostics; GPU work unmeasured | vector / CSS; no canvas budget |
| Zen Home Pond | fixed full presentation | diagnostics only | DPR and viewport-pixel cap |
| Zen Home Bonsai | fixed Home cadence | diagnostics only | DPR and viewport-pixel cap |
| Zen app-wide petal field | fixed 60fps ceiling, at most 48 airborne petals | none; no adaptive policy | DPR 1.5 cap, 4,665,600 backing pixels |
| Tools artifacts | activity-aware fixed | diagnostics only | owner-local |
| Gate and ceremonies | fixed | none | owner-local |
| Theme signal/status canvases | fixed | none | owner-local |
| Matrix/Starfield backgrounds, lightweight transitions, landing motion | explicit local fixed behavior | none | owner-local |
| Research and visual harnesses | non-production local profile | as required by the harness | owner-local |

The executable inventory in `scripts/ci/render-runtime-surface-catalog.mjs`
classifies shared-loop and shared-budget consumers and prevents an unowned
adaptive policy from appearing silently.

The petal field is a single lazy dashboard Canvas2D surface outside retained tab
panes. `ZenAppPetalLayer.jsx` uses `runRenderLoop` and `resolveRenderResolution`
with its named fixed budget. It introduces no Worker, quality tier, or per-frame
React state. Activity/reduced-motion/visibility gates stop the loop; paused time
cannot become emission debt. The pond receives bounded landing events through its
existing physical Home Worker and owns only landed petal lifetime.
Supply compilation runs only at source/viewport/world-input changes. The visual
release director integrates one bounded phase on the existing active clock;
it adds no timer, worker, browser event, particle population, or retained debt.

Bonsai airborne rain uses `runtime/rain/*` inside the existing admitted renderer,
not a dashboard canvas. Its 16 recurring identities share the worker's active
time, with no inactive catch-up. Sparse seeded periods leave real gaps between
fast streaks. The two untextured Pixi meshes retain eight streaks per bucket;
empty buckets submit no draw or vertex update. Explicit Canvas2D rendering paints
the same clipped quads at the back/tree seam. Static sky bakes do not consume
active rain time. Layout, continuous weather projection and pose revisions are
separate; input changes cannot create a second weather clock or pending supply.

The petal release director qualifies a rainy front only after eight active
seconds at rain >= .35. A single post-rain release requires rain <= .04 and
.35 active seconds of clear confirmation, shares the existing exclusive phase
plan, adds at most eight petal-equivalents of emission credit and has a 45 active-second
cooldown. Opening, cover, hidden reset and conflicting shower phases discard
that opportunity rather than queue it. Weather scheduling remains independent
of usage, friction and progression; this is transient presentation state only.
Existing randomized spawn thresholds remain authoritative: this credit bound
is not an exact eight-entity counter, and the airborne population cap stays 48.
Opening excludes ambient release events rather than adding another rate source.
First Vision reuses this same field and its 48-petal budget with a bounded opening
supply envelope. Its opaque-cover hold freezes airborne state and active time;
release resumes the same identities and eases to ambient supply. The separate
30fps ceremony surface renders only radiance/cover and owns no petal population.

Matrix and both Starfield background owners use the platform `runRenderLoop`
instead of owning interval/RAF variants. They opt into document-visibility pause
and reduced-motion static-frame behavior, while the shared loop keeps target-FPS
pacing independent of 60/120/144Hz display refresh and cancels all listeners and
scheduled frames at disposal.

The shared loop admits at most one render per scheduler callback. Its pacing
clock carries signed phase error with a bounded 0.1ms timestamp tolerance;
rounding near a deadline must not drop a 60Hz render or cause catch-up bursts.
`onRender.elapsedMs` is accumulated active time since the preceding render,
including scheduler callbacks that did not render. Each callback's elapsed
contribution is bounded by `maxElapsedMs`; simulation retains its fixed step
and catch-up limit. Startup, wake and resume initialize one simulation-step
delta and discard suspended time. Render pacing and render elapsed time are
separate clocks: a 120/144Hz scheduler must not slow a 60fps animation.

Zen Pond presentation cadence is owned by
`src/themes/plugins/zen/pond/runtime/core/zenCadenceProfile.js`. Water, ambient
entity sync, static entity sync and texture-cache pruning admit an update when
the interval from the previous render crosses a due slot. Skipped slots coalesce
into one update; identical clocks do not replay updates. The renderer supplies
`previousRenderTimeMs` (`null` on initialization), so a low render rate cannot
starve a pass by repeatedly missing its exact modulo phase. Simulation cadence
remains under its existing fixed-step owner.

Zen Pond's development GPU timer brackets the complete renderer tick: surface
field submission, cloud/static bakes, world render and stage composition. CPU
stage timings still measure submission work, not GPU completion. GPU timing is
asynchronous and Pond-local; it excludes Bonsai and browser compositing and is
not a dashboard FPS measurement. The public build retains its disabled telemetry
boundary.

Zen Bonsai's G15 Pixi bake owns its display tree, mask geometry, filters and
textures. `src/themes/plugins/zen/runtime/pixi/destroyZenBonsaiG15Bake.js`
releases those resources on rebake, resize, failed partial construction and
final disposal. Display-tree teardown does not implicitly own texture or filter
disposal. Unchanged Sakura viewport masks and unchanged Koi cache diagnostic
snapshots reuse their existing presentation resources; geometry or cache/reference
changes invalidate the corresponding cached result.

## Startup Scheduler Liveness Contract

- `runRenderLoop` owns one neutral, explicit startup-liveness opt-in:
  `startupFrameWatchdogMs`, `isStartupFramePending`, and
  `onStartupFrameSchedulerFallback`. The rAF-versus-timeout race is eligible only
  for `frameScheduler: 'auto'`, a valid positive watchdog, and an exact `true`
  startup-pending predicate.
- Each eligible schedule has one settlement owner. The first rAF or timeout
  callback cancels the losing handle and invokes the frame callback exactly once;
  dispose cancels both possible handles. The watchdog does not create a second
  render loop.
- Once startup pending becomes false, `auto` returns to pure rAF on hardware that
  exposes rAF. Callers that select explicit `raf` or `timeout`, and callers that do
  not opt in, retain their existing scheduler behavior.
- Zen Pond is the current production consumer. Its worker lifecycle supplies a
  `120ms` watchdog only before Pond `FIRST_FRAME_ACK`. The pending predicate stays
  true while Pond is inactive; the loop's canonical paused cadence re-observes
  activity so an inactive-to-active transition cannot remain parked behind a dead
  worker rAF. This platform seam does not own Zen readiness stages, error codes,
  ACK timing, quality policy, or failure degradation.
- Pond's logical first-frame ACK deadline remains `10,000ms`. A watchdog timeout
  records bounded startup progress and advances the same loop; it never restarts
  or extends that deadline. Pre-ACK render exceptions are surfaced immediately by
  the Zen owner, while the normal/post-ACK path remains pure rAF and retains its
  existing 3-strike render-error breaker.

## Nudge Adaptation Contract

- Hardware concurrency and device memory select only the initial pressure
  state. Runtime decisions use measured work.
- Slow frame intervals and dropped frames count as pressure only when measured
  CPU/GPU work is also material. Browser scheduling stalls are not treated as
  renderer overload.
- Hidden and suspended frames are excluded.
- Degrade and recovery require different sustained windows to prevent
  oscillation.
- A pressure change schedules resolution resize at the next frame boundary;
  it does not clear a just-rendered frame.
- One compact cost envelope feeds effect-local resolvers. Effect renderers do
  not branch on a global tier string.

## Non-Negotiable Invariants

- No app-global quality singleton, persisted quality state, or quality message
  synchronization.
- Render health and pressure are memory-only operational observations.
- Render pressure cannot reduce semantic actor counts, interaction targets,
  protocol timing, simulation update cadence, or progression state.
- Reduced motion is accessibility/activity state, not a performance tier.
- Worker admission/failure degradation remains independent from render
  pressure.
- Startup callback liveness is an explicit scheduler opt-in, not a quality tier,
  render-pressure signal, semantic fallback, or alternate renderer authority.
- Unknown levels, invalid samples, and invalid resource budgets fail explicitly
  at their owner boundary.
- Fixed is the default; adaptation is an owner-local opt-in.

## Migration Rules

- New heavy production effects first declare a fixed owner budget and viewport
  pixel cap. Add adaptation only after actual-work instrumentation shows a need.
- Theme-specific counts and materials stay in local profile resolvers; platform
  rendering cannot acquire theme knowledge.
- When a legacy tier is removed, producer, consumers, tests, docs, and CI cut
  over together. Do not retain compatibility re-exports or dual runtime paths.
- Lab profiles remain local research contracts and cannot become production
  settings through fallback.

## Verification

- platform resource and health-contract unit tests
- Nudge actual-work governor and cost-profile tests
- semantic invariants across every Nudge pressure state
- surface inventory and architecture CI
- targeted host/worker/resolution tests
- full release build after worker or architecture changes
