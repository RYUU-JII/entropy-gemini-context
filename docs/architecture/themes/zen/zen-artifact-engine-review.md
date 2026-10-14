# Zen Artifact Engine Review

- Status: Active
- Owner: Zen artifact presentation, visual QA composition
- Last validated against code: 2026-10-14
- Path policy: current-only
- Canonical for: the production Zen gallery engine, seven-scene comparison, resource lifetime and evidence limits

## Scope

All seven scenes execute in one Pixi v7 WebGL renderer through
`presentation/artifacts/engine/zenArtifactEngine.js`. The production consumer is the declared `ArtifactGalleryVisual` widget.
The named visual harness keeps the original widget references. Individual
`Artifact_*` registry entries retain standalone content-ritual ownership. Existing Shoji and GreatWave widgets now share their pure material and
geometry recipes with the comparison executor. This is explicit surface composition, not a backend fallback, settings mirror
or cross-theme substitute.

## Owners

| Concern | Owner |
| --- | --- |
| Dashboard lease, idle/selection preparation and mounted canvas adoption | `src/themes/core/runtime/dashboardRenderRuntime.js`, `src/apps/dashboard/layout/useDashboardRenderRuntime.js`, `runtime/worker/ZenArtifactGallerySession.js` |
| Artifact logical channel, frame requests and bitmap ownership | `runtime/worker/ZenArtifactWorkerClient.js`, `zenArtifactRendererRuntime.js`, `zenArtifactWorkerProtocol.js` |
| Document-only named SVG layer compiler | `presentation/artifacts/engine/zenSvgMaterialCompiler.js`, `zenFurinMaterials.js` |
| Registry-independent Zen surface material policy | `presentation/artifacts/zenArtifactSurfacePolicy.js`; reused by `themes/core/toolsVisualPolicy.js` for document consumers |
| Renderer, generation-fenced selection, scheduling, resource cache | `src/themes/plugins/zen/presentation/artifacts/engine/zenArtifactEngine.js` |
| Karesansui heightfield pass on the gallery's existing renderer | `presentation/artifacts/karesansui/zenKaresansuiHeightfieldRenderer.js`; engine-owned lazy mesh/shader lifetime |
| Complete React presentation request/candidate/commit and prepaint submit | `src/themes/core/tools/useArtifactPresentationCommit.js`, `src/apps/dashboard/tabs/tools/components/ArtifactRenderer.jsx` |
| Validated material key and descriptor snapshot | `src/themes/plugins/zen/presentation/artifacts/engine/zenArtifactDescriptor.js` |
| Gallery stage/canvas origin conversion | `src/themes/plugins/zen/presentation/artifacts/engine/zenArtifactGalleryGeometry.js`, `src/themes/core/tools/artifactStageGeometry.js` |
| Shoji canonical camera, face materials and geometry constants | `src/themes/plugins/zen/presentation/artifacts/shoji/zenShojiRecipe.js` |
| GreatWave canonical grid, row tone and arc constants | `src/themes/plugins/zen/presentation/artifacts/engine/zenGreatWaveRecipe.js` |
| Shoji plane projection and texture executor | `src/themes/plugins/zen/presentation/artifacts/engine/zenShojiScene.js` |
| GreatWave atlas, sprites and bounded material pass | `src/themes/plugins/zen/presentation/artifacts/engine/zenGreatWaveScene.js` |
| One-time gradient/shadow material compilation | `src/themes/plugins/zen/presentation/artifacts/engine/zenMaterialRaster.js` |
| Shared sampled CSS timing curve | `src/themes/plugins/zen/presentation/artifacts/engine/zenArtifactTiming.js` |
| Enso shared deterministic star layout and brush-to-texture executor | `src/themes/plugins/zen/presentation/artifacts/engine/zenEnsoRecipe.js`, `zenEnsoScene.js`; narrow `createZenEnsoBrushCompiler` and shared stroke geometry stay in `presentation/ZenEnsoCanvas.js` |
| TomeIshi shared canonical SVG recipe and layer executor | `src/themes/plugins/zen/presentation/artifacts/engine/zenTomeIshiRecipe.jsx`, `zenTomeIshiScene.js` |
| Ishidouro static stone compiler, glow and particles | `src/themes/plugins/zen/presentation/artifacts/engine/zenIshidouroScene.js` |
| Furin layer compiler and retained joint hierarchy | `src/themes/plugins/zen/presentation/artifacts/engine/zenFurinScene.js`; geometry/pose: `widgets/tools/recipes/zenFurinGeometry.js`; dynamics: `zenFurinPhysics.js`; materials/wind: `zenFurinSceneRecipe.jsx` / `zenFurinRuntimeRecipe.js` |
| Shared Furin inscription catalog | `widgets/tools/recipes/zenFurinInscriptions.js`; immutable glyphs and meaning-key identities consumed through the declared gallery and Site selection paths |
| Furin gallery daily inscription selection | `widgets/tools/recipes/zenFurinInscriptions.js` → `resolveDailyFurinMantra`; existing activity-day rotation over the shared catalog, consumed by the gallery descriptor and standalone widget |
| Furin fixed-top paper curve and rim-contact envelope | `widgets/tools/recipes/zenFurinPaper.js`, `zenFurinImpact.js`; SVG clipped bands and retained Pixi face meshes share the same curve, rows and simulation clock |
| ShishiOdoshi layer compiler, live water displacement and capture mask | `src/themes/plugins/zen/presentation/artifacts/engine/zenShishiOdoshiScene.js`; canonical recipe/physics stay in `widgets/tools/recipes/zenShishiOdoshi*Recipe.*` |
| Shishi stage offset, water/lip origin and ground impact coordinates | `src/themes/plugins/zen/widgets/tools/recipes/zenShishiOdoshiGeometry.js`; shared by standalone SVG, comparison/Pixi and Gate ground decoration |
| Preparation-only canonical SVG serialization, image decode and rasterization | `src/themes/plugins/zen/presentation/artifacts/engine/zenSvgRaster.jsx` |
| Deterministic comparison physics clock and frozen reference composition | `src/themes/plugins/zen/presentation/artifacts/engine/zenSimulationClock.js`, `ZenKineticArtifactReference.jsx` |
| Fixed render budget and platform loop | `src/themes/core/tools/artifactMotionBudget.js`, `src/platform/rendering/renderLoop.js` |
| Comparison inputs, snapshots, lifecycle checks and diagnostics | `src/apps/visual-harness/scenes/ZenArtifactEngineScene.jsx` |
| Remaining five scenes: candidate timings and canonical presentation references | `src/apps/visual-harness/scenes/ZenArtifactCollectionScene.jsx` |
| Named capture declarations and browser requirements | `src/apps/visual-harness/sceneCatalog.js`, `scripts/qa/catalog/qaTargetRegistry.mjs` |

## Runtime Contract

### Shared Karesansui render pass (2026-10-12)

The artifact engine owns the only production gallery WebGL renderer/context.
`GROUND` requires the initialized engine and delegates to `engine.renderGround`;
the heightfield borrows that renderer and owns only its mesh, geometry and shader.
It never creates another canvas, WebGL context or Worker. Its existing GLSL 300
heightfield, lighting and sub-pixel sampling require the admitted WebGL2 renderer.

Each changed ground request synchronously resizes the shared backbuffer to the
contract-bounded ground pixel dimensions, renders the opaque full-screen mesh
through Pixi and transfers its ImageBitmap. A `finally` restores the previous
gallery screen size at the same renderer resolution, including on draw/transfer
failure. The pass uses no pixel readback or additional render target. The UI's
previously transferred gallery bitmap remains displayed; the next artifact draw
repaints the restored canvas. Synchronous pass/transfer prevents channel messages
from interleaving. Ground work does not change scene selection, animation time,
scene caches or artifact frame counters. Engine disposal releases the pass before
destroying the shared renderer; the pass never loses the borrowed context.

### Furin armed presentation (2026-09-14)

An enabled but unengaged Flare projects `armed → arming → settle` through
`artifactPresentation.js` and `simulationRuntime.js`. Furin's existing wind
recipe applies a quiet 0.3 ambient multiplier in this mode; `live` retains
its activity-scaled breeze, while `halt` has no autonomous wind. Reduced motion
and parking still suppress simulation through the canonical frame eligibility.
The prior physics replacement accidentally removed the `settle` breeze while
leaving decorative motion active. No new state, wind timer or gallery-only
physics solver is introduced by this repair.

The relative-air drag revision uses 0.3 to keep the bell's small armed motion
visible within the existing ten-second review, while the lighter paper leads
the response and quiet armed contact stays silent.

The koi is paint attached to the bell. Neither the SVG recipe nor Pixi executor
independently translates/rotates the motif. The shared bell outline has rounded
shoulders and soft reflections while retaining the fixed top/rim coordinates,
inner contact geometry, clapper and paper joints. The comparison QA now also
configures the actual Pixi scene with the ordinary armed presentation, measures
joint movement and fixed paint-local coordinates, and captures `furin-armed`.
The unconfigured `isActive` replay alone is insufficient to verify ON-idle motion.

Furin's paper is curved below its fixed top tie, using two retained face meshes
with shared SVG band coordinates. The contact pulse follows the contacted rim
side and simulation-time envelope. `furin-impact` captures the first actual
contact in canonical wind at 89.2 seconds and fails if no physical cue exists;
it does not inject an impact. Physics tests separately verify both sides,
quiet/separating contacts, debounce-independent momentum and frame partitioning.

### Dashboard Worker presentation (2026-09-13)

The gallery's canonical production backend is `ZenArtifactWorkerClient` and the
`artifacts` logical channel of the existing admitted `zen_home_renderer` session.
This historically named physical session now serves dashboard surfaces; its
stable admission ID is retained, and pond/bonsai first-frame gates are unchanged.
The gallery does not create an independent Worker. Its private Pixi renderer,
seven-scene cache and scene updates execute in `zenArtifactRendererRuntime`.
The comparison harness explicitly runs the same engine with its UI SVG compiler.
It is not a production fallback.

The gallery host observes DPR changes through re-armed resolution media queries
and resize events. It releases the old logical client before acquiring the new
resolution generation, keeps the same output canvas and previous bitmap, and
fences old prepared publications until the new complete frame commits. An
attached host owns this transition; speculative preparation never replaces it.
CSS-only viewport changes retain the existing renderer and material cache.

`zenArtifactSceneModules.loadZenArtifactSceneFactory` is the Worker scene import
owner. Its lazy imports statically select only each named factory; the engine
receives a construction function, never the module namespace. Reference-only
exports such as the Shishi SVG pose projector therefore remain outside the
production Worker closure. UI intent preparation
in `zenArtifactModules` imports only the Worker client and selected SVG compiler.
The Pixi executor uses the existing narrow CSP-safe Worker runtime exports.
The GreatWave executor imports the Zen material policy directly; it must not
pull all theme manifests through the document's general profile resolver.
Enso's shared brush renderer requires explicit width/height/DPR input. Only its
document mounting owner measures the DOM/global DPR; Worker consumers use their
channel's validated resolution. Physical routing imports message identities
only, leaving artifact descriptor validation in the lazy channel closure.
Canvas recipes use Pixi's declared environment canvas adapter; SVG recipes are
compiled by `zenSvgMaterialCompiler` in the document and transferred as named
ImageBitmap layers. That compiler imports no Pixi and retains no material cache.
The scene asset owner releases imported bitmaps with its texture cache entry.

The Worker renders a complete frame to OffscreenCanvas and transfers its bitmap.
`prepareFrame` coalesces queued inputs and keeps generation identity; `commitFrame`
consumes the exact prepared bitmap synchronously in the existing React layout
commit. The publication callback identity fences the entire requested DOM frame,
including geometry-only changes, but is not a pixel preparation input.
`zenArtifactDescriptor.snapshotZenArtifactDescriptor` projects only the selected
scene's construction inputs. `ZenArtifactGalleryVisual` stabilizes that snapshot
by its canonical material identity and Enso's live constellation visibility;
unused color, activity, weight, daily state and mantra inputs cannot invalidate
another scene's pending or displayed pixels. It also projects only the live
inputs consumed by each scene: Shoji/GreatWave/TomeIshi/Ishidouro have no configure
presentation, Enso consumes constellation visibility, Furin consumes simulation
and ambient eligibility, and ShishiOdoshi additionally consumes connected ground.
Unused ground/scene-state changes cannot reprepare a material-only scene.
Equal pixel inputs keep the same preparation in flight.
An already displayed matching ticket uses `reuseDisplayedFrame` in the same layout
commit. This checks client/displayed generation and ticket ownership, keeps the
current canvas, consumes no bitmap again and does not restart simulation. Parking,
new pixel preparation, disposal and DPR replacement invalidate that reuse. Actual
ground/simulation/material/DPR changes still require a complete new frame.
Stale/unconsumed bitmaps are closed. The physical
session owner also closes transferred frames for released/stale channel sessions.

The client uses the platform render loop solely to request bounded Worker frames.
After awaiting channel initialization, the client rechecks its request generation
before dispatching preparation. Parking or supersession during INIT cannot send
a stale scene build; disposal and initialization failures still reject explicitly.
Already dispatched work remains fenced at bitmap publication.
At most one animation request is in flight; elapsed time is accumulated with the
same 250ms catch-up cap. The Worker runs no additional autonomous artifact ticker.
Parking stops requests, rejects late presentation and keeps the last displayed
frame. Later entry renders a fresh frame from cached materials. Request/response
and material compilation timeouts fail explicitly; there is no alternate backend.
`displayP95Ms` measures bitmap sink CPU submission separately from Worker timings.
Worker animation reads the engine's lightweight time accessor; it does not
construct a diagnostic snapshot to advance time. INIT/PREPARE return an exact
snapshot, while DRAW includes one only at the existing 1200ms metrics cadence.
The client retains that diagnostic sample, with its `sampledAtMs` and Worker
clock identity. Every DRAW receipt also carries the exact submitted `frameCount`
and simulation `timeMs`, read from the successful engine draw without building a
snapshot. Client inspection overlays these latest counters on the retained sample;
`sampledAtMs`, scene inspection and percentiles keep their sampled semantics.
`frameCount` counts Worker submissions, including an in-flight frame whose bitmap
is discarded after parking; `displayedFrames` counts UI bitmap consumption.
Inspection does not request per-frame p95 sorts, and parking QA can compare exact
frame progress within an interval shorter than the diagnostics cadence.

`ZenArtifactGallerySession` retains the same logical channel while the Zen
dashboard reservation or its mounted host exists. The dashboard theme lifetime
also retains the existing physical Worker across empty visual-channel intervals.
The final reservation/host release disposes the cache and channel; the physical
owner terminates only after all dashboard/startup leases and channels are gone.
After the boot shell has been dismissed and Main is parked, existing input-quiet idle admission may
prepare one actual Shoji frame using the canonical ambient night depth. Its
unshown bitmap is closed and no animation loop starts. Tools selection starts
this same preparation immediately alongside UI module admission. The mounted
host adopts it; there is no second warmup renderer or cache. Idle preparation
can be cancelled before dispatch; dispatched work is fenced on release/adoption.
GPU preparation is never started speculatively while Main is visible: synchronous
context creation would block its sibling Pond/Bonsai channel on the shared thread.

The sections below describe the shared scene engine's internal preparation and
comparison API. Production presentation uses the bitmap contract above instead
of submitting WebGL from React.

Module preparation is owned by the narrow theme seam
`src/themes/core/tools/artifactGalleryPreparation.js`. The Tools tab's existing
boot/intent preloader starts the declared client module alongside its critical
widgets. Selected-family admission and gallery navigation intent additionally
load only the requested SVG compiler when needed. `zenArtifactModules.js` owns
these UI imports; `zenArtifactSceneModules.js` owns the Worker scene imports.
Code-only preload creates no resources. GPU/material preparation is separately
owned by the dashboard lifetime above. Other canonical themes explicitly declare
no additional gallery runtime.

Controller admission resolves the actual gallery widget via
`getArtifactGalleryWidgetType`, as navigation and rendering do. A Zen selection
does not wait for its unused standalone `Artifact_*` widget. Controller/widget
and requested module failures remain visible at their existing loading boundary.
Tab boot admission, input-quiet scheduling and kept-alive parking are unchanged.
Gallery type resolution uses `hasDeclaredThemeWidget`, avoiding an uninitialized
lazy component allocation just to inspect capability. The tab's critical widget
list includes its navigation icons so they cannot suspend the prepared workspace.

The engine owns one canvas/context for its lifetime and creates no Pixi
Application or automatic ticker. `prepare` imports only the requested scene,
bakes its materials, and caches its retained scene graph. `select` commits only
the latest request, renders the incoming scene, and retains the renderer. An
older asynchronous preparation cannot change the displayed scene. Both a
currently displayed scene and the latest requested scene are protected from
cache eviction. A rejected preparation is an explicit rejected operation; the
consumer must surface it. No substitute renderer is selected.

Gallery scene preparation and frame application are separate operations.
`prepareSelection` returns an engine-owned generation ticket without drawing;
the current requested material remains protected from eviction until committed.
`commitSelection` validates ticket identity and material identity, applies live
presentation/origin, and draws synchronously. A stale ticket returns superseded;
a foreign ticket, mismatched descriptor or invalid origin fails explicitly.
The displayed ticket can be reused for geometry/live-input changes without
starting another preparation. `select` is the imperative harness composition of
these same two operations, not a second rendering path.

`ArtifactRenderer` assembles one complete frame request including the gallery's
pure placement closure. `useArtifactPresentationCommit` owns its committed frame
and current prepared candidate. The host requests a complete Worker frame for
each changed normalized pixel input; materials are rebuilt only when their canonical
key changes. DOM-only publication changes reuse matching pixels.
It publishes a synchronous submit callback for those exact
inputs. React renders that candidate's placement and stage FX together;
the owner calls its submit callback in a layout effect before paint, then records
the successful frame. Request identity prevents an interrupted or late candidate
from replacing a newer selection, including an older publication arriving after
the current candidate in the same React batch. Superseded tickets restore the previous DOM
frame before paint. There is no `flushSync` or separate placement/FX retention.
The retained shell disables CSS FX interpolation; Pixi owns scene animation.
Parking pauses immediately and reactivation renders from retained materials.

`zenArtifactGalleryGeometry` derives canvas centring and scene-root placement
from the shared stage size, canvas overscan and each body's canonical height.
Body-bottom in canvas coordinates maps to the stage bottom; canvas overscan is
not another world anchor. Gallery world anchor/offset remain with sceneRuntime.

`tests/artifactGalleryPresentationCommit.test.jsx` exercises all 42 directed
family transitions, warm return, latest-request ordering, geometry/activity
updates and parking, including DOM-before-submit order and no material rebuild for
geometry-only changes. `artifactPresentationCommit.test.jsx` covers interrupted
batches/stale receipts. Engine lifetime tests cover ticket ownership and cache
pinning. These simulate GPU submission; browser evidence remains separately named.

The comparison defaults to four entries / 24 MiB. Production admits seven
entries / 48 MiB uncompressed source textures so a complete warm traversal can
reuse materials. Preparation concurrency is bounded by the entry limit. This counts the RGBA dimensions of
owned material canvases, not total process or GPU memory: renderer buffers,
filter render targets, driver allocations, and CPU/GPU copies are separate.
Texture preparation can temporarily allocate an incoming scene before pruning;
an individual scene exceeding the budget is disposed and rejected. Textures are
private to the owning renderer; engine-code reuse does not imply sharing them
with the Pond worker/context.

Engine snapshots report the renderer constructor interval with explicit
`clockDomain` and `timeOriginMs`; production uses the Worker clock.
Render receipts report the exact CPU submission interval as well as duration.
The optional named QA startup probe observes document WebGL calls only and cannot
decompose production Worker calls;
constructor and first-submit timings are separate phases, and neither is GPU
execution time. Call interception belongs exclusively to the QA protocol and is
absent from the application runtime.

`play` uses the platform loop at the artifact's fixed 60 fps budget, with
document visibility and reduced-motion controls. `pause` removes the loop;
`draw(timeMs)` permits deterministic single-frame rendering. Static scenes have
no polling loop. Presentation time does not advance while suspended. Gallery physics consumes the existing canonical equations without ritual
callbacks. No settings write or progression decision lives here.
Explicit disposal releases scene graphs, shaders/filters, textures, timer
queries, listeners, and renderer. Context loss stops rendering and reports
`ZEN_ARTIFACT_WEBGL_CONTEXT_LOST`; there is no hidden Canvas2D fallback.

Material factories may finish asynchronously. The engine snapshots validated
inputs before awaiting imports, tracks in-flight asset owners, rejects allocations
after disposal, and checks lifetime again after decoding. Blob URLs are revoked
on success and failure. Measurement reset never cancels material preparation.
The source-texture limit is checked before allocating each new Pixi texture.

## Scene Representation

Shoji retains the canonical 25.25 / -38.5 degree camera, 1200 px perspective,
face overlap, day/night material inputs, float keyframes and independent shadow
keyframes. Three visible planes use projective UVs. Their geometry/UV buffers
are immutable; the float changes a uniform, preserving the small depth-dependent
translation that a flattened bitmap would lose. Paper, wood, face finishes and
the blurred floor shadow are baked once per presentation/resolution.

GreatWave retains 20 rows × 7 columns, row/column phases, four arcs per wave and
opaque occlusion order. Twenty row tiles share one atlas; 140 sprites move
without regenerating paths. A single clipped material pass applies the original
soft-light, multiply and screen treatments over the content aperture. Atlas
sampling and this pass use at least 2× resolution to limit double-sampling blur
at DPR 1. That is a declared rendering cost, not adaptive quality.
The shared grid recipe exposes numeric viewBox dimensions; only the document
widget builds the SVG viewBox through the common coordinate helper. The Worker
consumes the same numeric geometry without importing that document helper.

The material compiler supports only the gradient/shadow syntax emitted by these
recipes. Unknown syntax throws. CSS and Canvas/WebGL rasterization can still
differ at subpixel edges and blur kernels; sharing parameters is not proof of
pixel identity. The DOM reference remains the visual comparison source.

Enso compiles the canonical held cosmic brush once and retains star sprites;
its daily layout seed is shared with the widget. The comparison takes explicit
day/constellation inputs and never reads or writes the daily reveal checkpoint.
TomeIshi shares its actual SVG recipe with the production widget, splitting
the stone/contact layer and the pulsing apex. Ishidouro recompiles the CSS stone
construction into a static texture, with separate core/rays/particles. Its
material compiler and the Enso star sprite are visual approximations to review.

Furin keeps the canonical pendulum equations and nested bell/striker/paper
pivots, with two baked paper faces selected by cosine of yaw. ShishiOdoshi keeps
the canonical fill/tip/strike simulation. The back of the mouth, water and
front rim are distinct ordered layers; simulation pose controls the water's
capture height, free-fall opacity and tail. Both narrow meshes now sample one
canonical transparent water material with subtle sub-pixel refraction. The SVG
recipe uses a cross-sectional reflection gradient; neither path keeps the former
turbulence/emission material. Water, lip and ripple colors come from
`zenShishiOdoshiWaterMaterial.js`, independently of artifact-family color.
Broken wave crests, floor contact, curved splash sheets and refracted teardrops are
shared SVG material layers baked once for Pixi. Lip and ground droplets use the same
ballistic pose in both adapters (sampled keyframes for SVG, direct sampling for
Pixi); ground droplets land at the contact plane and fade instead of hovering.
The geometry leaf owns one shallow floor basis for the equal-height posts,
axle, top cuts and wave ellipses. Gravel contacts and the stone shadow retain
the shallow aspect with screen-level silhouettes. The rock's shared placement,
vertical compression and contact point tuck its footprint between the posts
without changing the tube's striking crown. Both adapters place the soft floor
shadow from that same contact point. Floor rotation
never rotates the upright splash or its ballistic trajectories. The crown has
separate width/height envelopes above a fixed contact, with no additional particles.
Frozen SVG references omit the secondary ballistic droplets; still comparison
does not certify their motion. Wave opacity fades at both ends of its cycle. Static origins stay outside
animated transforms, including the wave groups' local `(0,0)` contact point.
Water SVG transforms explicitly set Motion's `originX/originY` to zero with
`transformBox: view-box`; its default fill-box center depends on the asymmetric
painted contour and would move the contact point as the wave expands.
Two baked tube shadows interpolate with ground proximity. SVG moving highlights
and GPU refraction remain presentation equivalents, not a pixel-equality claim.
Secondary shimmer, fish, water highlights and particles remain approximate
raster/composite equivalents, recorded by the comparison harness.

Shishi's lip particles place the immutable stream origin on an outer SVG group
and the live vertical offset on an inner Motion group. A CSS transform on the
same element would override the SVG transform attribute and detach the particles
from the mouth. Gate's wet ground decoration lives inside the transformed tube
stage and uses the same ground-impact point plus scene offset; viewport-relative
left/bottom coordinates are not another effect origin. Geometry does not own
the ritual clock, admission, overflow duration or material color. The named
Gate runtime target checks actual mouth/ground alignment in portrait and
landscape, including a real overflow capture.

Furin now uses fixed physical ties in SVG user coordinates, shared with the
retained Pixi hierarchy and Site SVG presentation. No fill-box measurement,
bounds-derived pivot or independent depth translation remains. The bell tie is
(0,30), internal clapper pivot (0,34), clapper length 60, and lower cord 64;
all are relative to the support (150,20). The 112-unit washi is tied at its top
centre; torsion/flex cannot displace that point. A short ceramic clapper hits
the lower inner glass wall (half-width 28, clapper radius 4). The contact limit
is derived from this geometry, never independently tuned.

The three-angle generalized-coordinate model retains exact link lengths and
solves a coupled 3x3 mass matrix at fixed 240 Hz substeps under existing 60 Hz
presentation clocks (maximum 250 ms / 60 substeps per call). Heavy glass and
paper body inertia, gravity in SVG units/second², per-second damping and contact
impulses replace hand-tuned angular-speed multipliers. Wind acts primarily on
the paper; tension transmits it to the clapper/bell. Bounded damped yaw and one
shear mode approximate washi flex, not full cloth or 3D aerodynamics. Settle
has zero ambient wind. There is no additional loop, dependency or persistence.
The inspection snapshot exposes simulation mode and physics time. Gallery QA
requires physics/render progress in settle and additionally requires pose motion
in live; a settled zero-wind pose is not a frozen renderer. These fields are
diagnostics, not simulation inputs or new activation policy.
Material glow is low-opacity and local to the glass; the front rim is an
explicit layer above the clapper. Geometry and physics are shared; SVG/CSS and
Pixi rasterization still require visual comparison.

SVG compilation serializes canonical recipes through React's static serializer
and decodes a self-contained SVG once. It neither screenshots a live DOM nor
uses foreignObject. This preparation-only serializer is lazy with the SVG scene compiler. Its
cold chunk/decode cost is included in the extension journey. It must not enter
boot or standalone content closures through an eager import.
Comparison simulation replay uses integer 60 Hz ticks and resets on backward seeks; it
accepts up to one hour of explicit comparison time. Repeated still captures
do not advance physics. No ritual callbacks are attached in this comparison.

## Verification and Evidence

`visual/zen/artifact-engine` and `visual/zen/artifact-engine-retina` use DPR 1
and 2 respectively and explicitly require WebGL. They compare the original
widgets with the candidate, verify repeated selection without rebuilding,
reject stale admission, assert no idle redraw and prove explicit disposal.
Shoji day/dusk/night/float and active/inactive GreatWave are captured at fixed
times. Reference motion is frozen after Framer's initial scheduled style write.

`visual/zen/artifact-collection` and `visual/zen/artifact-collection-retina`
cover the remaining five at DPR 1/2, using 640 px specimens. They measure only
the candidate renderer, exercise cache eviction across five scene identities,
check same-scene reuse and retain the same canvas/context. Their canonical
reference presentations are frozen; autonomous secondary effects are omitted
and are not a pixel-equality oracle. Furin/Shishi reference composition goes
through the named `ZenKineticArtifactReference` presentation seam, without
mounting a business controller. The other widget references use the registry.

Collection timing includes the lantern's night rays and ShishiOdoshi's 5–7.55s
dump/free-fall/ripple interval. After measurement, the fixture records 3-second
VP9 previews separately. A synchronous, optional `onFrame` observation copies
the submitted canvas onto an opaque recording canvas in the same task; copying
and video encoding do not run during measured intervals. The temporary media
tracks and recorder are stopped on completion or component disposal. Captures
emit `ZEN_ARTIFACT_COLLECTION_REVIEW`, `ZEN_ARTIFACT_COLLECTION_VIDEOS`, and
`ZEN_FURIN_ORIGINS` into normal QA console evidence. The static serializer is
declared in Vite's visual-harness dependency optimization to avoid an initial
optimizer-triggered page reload; production Vite modes are unaffected.

ShishiOdoshi's canonical default/normalized tuning now belongs to
`widgets/tools/recipes/zenShishiOdoshiTuning.js`. The widget and experiment
Tuner both import it. Normal artifact loading no longer imports the Tuner UI
just to obtain its constants. `api/lab.js` keeps its public named exports.

Steady measurements show one backend at a time, allow a 350 ms warm-up and
observe 2200 ms. Page rAF intervals are scheduling observations, not presented
FPS or renderer CPU costs; the browser can schedule at 120 Hz while this engine
renders at 60 Hz. Instrumented update/submit duration measures JS command work,
not GPU completion or CSS compositor work. Scene selection receipts also stop
at command submission, not screen presentation. Cold lazy-import timings from
the Vite harness are not extension launch benchmarks.

The dev fixture explicitly enables the existing Pixi GPU timer against the
actual renderer context. It reports extension availability, completed samples,
disjoint/errors and unavailable reasons. Its bracket covers only this renderer;
there is no equivalent GPU measurement of the CSS/SVG reference. Headless
evidence is not physical-GPU certification even when hardware is classified.
The existing Pond telemetry activation path is unchanged.

Production evidence uses the actual extension gallery journey below. Component
captures alone do not establish dashboard transition performance.


## Production gallery

`widgets/tools/ZenArtifactGalleryVisual.jsx` owns the canvas. The narrow core
seam `core/tools/artifactGalleryRenderer.js` chooses a declared shared gallery
widget, otherwise the theme's canonical individual widget. Tools critical
preparation includes the shared host module; per-family controller admission
and control-panel reset keys remain independent. The canvas ancestor has a
stable key across Zen families. Readiness is acknowledged after render submit.
The previous scene remains rendered until the incoming material commits.
Compilation errors reach the existing dashboard error boundary; no substitute
backend is selected.

The host consumes the canonical render context, including partial visual
weight, Enso intensity, daily Furin mantra, connected ground, and live/settle/halt
state. `zenLiveSimulationClock.js` bounds catch-up to 250 ms and has no QA
replay one-hour ceiling. Same-family material updates transfer the simulation
clock; halt resets to the canonical rest pose. Tools parking pauses the host;
document visibility and reduced motion are handled by the platform loop.

`widgets/tools/useZenEnsoConstellation.js` retains the existing UI-only daily
reveal checkpoint and timing for both hosts. The engine only draws explicit
visibility; revealing the constellation reuses the baked layer. Standalone
Gate/Furin effect controllers and their callbacks are unchanged.
The retained hook samples the current local date on existing ambient renders,
runtime re-entry, and document visibility return, without a second clock. The
existing 42-second reveal timer resamples the date if its exposure crosses
midnight; both constellation and checkpoint use that reveal date, and the
independent six-second dismissal still completes after date reconciliation.

`dashboard/capture --surface=artifacts --theme=zen --artifact-journey` traverses
seven families twice and all 14 directed neighbouring pairs in the real extension, observes continuous canvas identity,
checks warm material reuse, rapid latest intent, parking and return. The named
protocol writes `dashboard-artifact-journey.json`. Click-to-submit and second-rAF
paint opportunity are not physical display latency. Renderer diagnostics are
gated by `BUILD_INCLUDE_DEBUG_TOOLS`, not Vite's serve-only DEV flag.

The host module stays lightweight during Tools preloading. Pixi/engine code is
imported in the Worker when its artifact channel is prepared. Vite isolates React's static SVG serializer in
`vendor-react-static-svg` so it does not inflate the shared client React chunk
for popup and other surfaces. The same scene compiler serves QA and production.
Parked gallery geometry retains the last valid measured dimensions, including
the brief interval before ResizeObserver reports the returning tab's size.

Production Enso uses `createZenEnsoBrushCompiler`, the no-paper held-stroke API
in the shared brush module. It retains one scratch ink layer, a compiled cosmic
texture, the live ink texture and star sprites for the engine scene's cache
lifetime. Enso stage changes update that retained ink texture instead of
rebuilding the scene. The compiler shares stroke construction, deposits and
closure with `createZenEnsoRenderer`; it does not import the document renderer's
paper generation, static snapshot cache or playback APIs into the Worker
closure. The standalone document renderer keeps its bounded snapshot cache.
First cold preparation is still synchronous and must not be described as
zero-cost.

### Furin gallery inscription curation (2026-10-08)

The immutable shared catalog in `widgets/tools/recipes/zenFurinInscriptions.js`
holds six four-character inscriptions. The gallery retains its existing
activity-day rotation. Site draws uniformly once per presentation and keeps that
draw through cancellation and failed-close retries; a new presentation may repeat
the same entry. The shared inscription owner also owns gallery daily selection;
the worker receives the selected four-character descriptor and consumes only the
Furin physics recipe. The Home worker artifact guard rejects the document-side
inscription catalog/selection module from its closure. Nature, calm attention and tea culture guide the selection;
instructional slogans and self-reproach are excluded. There is no rarity,
collectible count or persisted selection. Gallery gains no translation UI;
Site shows just the chosen short meaning. These glosses document the reading:

| Gallery inscription | Korean gloss | English gloss |
| --- | --- | --- |
| 清風明月 | 맑은 바람, 밝은 달 | A clear breeze, a bright moon |
| 明鏡止水 | 맑고 고요한 마음 | A clear, still mind |
| 一期一会 | 단 한 번의 만남 | Each encounter, only once |
| 和敬清寂 | 조화 · 존중 · 맑음 · 고요 | Harmony · Respect · Purity · Calm |
| 一行三昧 | 한 가지에 온전히 머묾 | Fully present in one act |
| 行雲流水 | 흐르는 구름과 물처럼 | Like moving clouds and flowing water |

Meanings follow the Japan Kanji Aptitude Testing Foundation's entries for
[清風明月](https://www.kanjipedia.jp/kotoba/0003893300),
[明鏡止水](https://www.kanjipedia.jp/kotoba/0006681200) and
[行雲流水](https://www.kanjipedia.jp/kotoba/0002175300), Urasenke's
[一期一会 discussion](https://urasenke.org/essays/) and
[四規 explanation](https://www.urasenke.or.jp/textc/tan/syudo/syudo2.html), and
Engakuji's [一行三昧 explanation](https://www.engakuji.or.jp/blog/27846/).
The glosses do not assign moral success, productivity or a correct browsing
choice to the inscription.

## Cold preparation attribution

Selection receipts distinguish the material's original `loadMs` (dynamic import completion), `bakeMs` (scene factory), and `prepareMs` from the selection's `firstFrame.updateMs` and `firstFrame.submitMs`. Cached receipts retain the original preparation times. Submit duration can include lazy texture upload/rasterization and shader compilation; it is not GPU elapsed time. Do not attribute click-to-submit to the brush or water simulation.

The shared Enso scene hashes the canonical artifact seed before calling the
numeric-seed brush compiler, matching the standalone widget. Its explicit
width/height/resolution belongs to the scene asset owner; the compiler neither
measures a document nor consults a document snapshot cache. The document
renderer still synchronizes dimensions before its static snapshot lookup, and
an animated draw after a snapshot hit initializes the shared brush normally.
The boot worker retains the full renderer's progressive practice form and has
a separate JS/cache realm. Neither its clock nor its snapshot state is shared
with the gallery.
