# Zen Tools Artifact Widgets

This folder owns Zen visual recipes for Tools Tab artifacts. The widgets should
feel like separate objects painted with the same brush, not clones built from one
shape kit.

## Canonical Widget Map

- `Artifact_Lens` -> `Shoji.jsx`
- `Artifact_Veil` -> `Enso.jsx`
- `Artifact_Brake` -> `TomeIshi.jsx`
- `Artifact_Monolith` -> `Ishidouro.jsx`
- `Artifact_Gate` -> `ShishiOdoshi.jsx`
- `Artifact_Lethe` -> `GreatWave.jsx`
- `Artifact_SentinelFlare` -> `Furin.jsx`

## Workflow Sheets

The retained gallery engine and comparison harness for all seven artifacts are owned by
`docs/architecture/themes/zen/zen-artifact-engine-review.md`. Enso's daily star
layout and TomeIshi's canonical SVG geometry now live in shared presentation
recipes. ShishiOdoshi's default and normalized tuning live in
`recipes/zenShishiOdoshiTuning.js`, so the runtime widget does not load Tuner UI
to obtain constants. `ArtifactGalleryVisual` -> `ZenArtifactGalleryVisual.jsx` owns the production
gallery canvas. Entries above remain standalone ritual/reference widgets.

Some artifacts open a full-rail confirmation sheet instead of their control
garden. Those sheets are ordinary declared widgets, resolved through
`getThemeWidget(themeId, ...)` by the dashboard card that owns the workflow:

- `ArtifactMemoryPurgeReview` -> `ZenMemoryPurgeReview.jsx` (Lethe / 망각의 물결)

The dashboard's `MemoryPurgeReviewSurface` stays the owner of the view model
(totals, ordering, handler contracts) and asks a theme for a sheet only when
that theme declares one; the console-shaped default surface is what every other
theme still renders.

## Shared Contract

All canonical Zen artifact widgets consume
`useZenArtifactRenderChannels(...)`. That adapter translates the shared
`useArtifactRenderChannels(...)` output into Zen-local names:

- signature color
- continuous daylight, night-depth, low-sun, twilight, deep-night, and phase environment channels
- visual weight
- still/ambient/full motion budget
- full-quality runtime budget

The gallery's Zen canvas receives the same dashboard ambient presentation as
the shell and `ArtifactRenderer`. `ZenArtifactCanvas` and
`ZenKaresansuiGround` use its continuous light direction and canonical
ivory/cedar/plum/indigo chromatic state; they do not own a day/dusk button,
local clock, private solar calculation, or a second warm-to-night curve.

## Gallery Placement

Every Zen artifact stands on the karesansui centre: the Zen scene spec puts
`artifact_origin` on `karesansui_center` and declares no per-artifact offset.
Each scene declares `ground` in `zenArtifactGalleryGeometry.js`, the point in
its own local pixels that rests on that centre: the contact on the visual axis
for standing objects (Tome-ishi, Ishidouro, Shishi-odoshi's stand on its floor
line), or the sand point below the body for floating ones (Shoji, Enso, Furin,
Great Wave). The scene root is placed so `ground` lands on the stage's bottom
centre. Placement is in scene pixels, so contact holds at every viewport size;
do not reintroduce world-unit offsets for a fixed-size scene.

A scene may also declare `lintelY`, a support it hangs from but does not draw.
Furin does: it hangs on its own short cord (so the bell keeps a wind-chime
pendulum) from a lintel that `ZenArtifactWorkspaceLintel` paints across the
workspace, translucent and soft-edged, over the left threshold and behind the
control rail. The gallery's `lintel` workspace slot only carries the stage
anchor; the height comes from the scene. Furin is raised clear of the
karesansui so it reads as its own place. The canvas keeps only the cord's tie
(`supportStyle: 'lintel'`).

## Karesansui Ground

`ZenKaresansuiGround` is a lit heightfield, not drawn lines. Rake marks are a
ridge/furrow profile laid out in ground-plane world space (parallel strokes and
concentric rings around the artifact); the shader turns its gradient into a
normal and lights it with the ambient sun (moonlight at night). Shade takes the
sky ambient tint and lit crests the sun's, which is where the softness comes
from.

- Camera: `sceneRuntime` owns one ground camera (`ground.camera`: horizon a few
  pixels above the ground top, focal = the scene's `camera.perspective`, units
  that put the karesansui centre at depth 1). Ring sizes convert from screen
  pixels at the centre to world units by dividing by focal. The gate's ripple
  foreshortening (`ground.rippleProjection.ellipseAspect`) is that camera's
  eye height, so rings and ripples share one ellipse. `ring.baseRyPercent` is
  no longer read.
- Rendering: the frame is rendered by the artifact worker on the existing
  artifact channel (`ZEN_ARTIFACT_MESSAGE.GROUND`) through the initialized
  gallery engine's existing WebGL2 renderer and `OffscreenCanvas`, then shown
  through a `bitmaprenderer` canvas. The heightfield owns only its mesh,
  geometry and shader. Each synchronous pass transfers its bitmap and restores
  the gallery dimensions in `finally`, without another context or pixel readback.
  It is static: one request is in flight at most, a
  newer request supersedes the queued one, and nothing re-renders unless the
  resolved request key changes. Request shape and validation live in
  `presentation/artifacts/karesansui/zenKaresansuiHeightfieldContract.js`.
- Failure: a ground render error is reported on the artifact channel (the
  client fails and the widget throws), never as a terminal fault of the shared
  home renderer worker.
- Tuning prototype: `prototypes/karesansui-heightfield-prototype.html`.

## Rules For New Work

- Keep activation decisions outside these widgets.
- Use `environment.daylight`, `environment.nightDepth`,
  `environment.lowSun`, and `environment.lightVector` for time-responsive
  materials. Do not reconstruct a binary `sceneMode` inside a widget.
- Use `isVisuallyActive` for still-state presentation only; floating, pulsing,
  ticking, simulation, and other continuous motion must use the shared motion
  channels. Use `shouldAnimateActiveVisual` for lightweight motion that should
  continue whenever the artifact is active.
- Do not import `useVisibilityGate` in canonical artifact bodies.
- Do not create widget-local runtime loops for simulation artifacts.
- Standalone rituals use `useArtifactSimulationController`; the gallery uses
  its one platform loop and bounded continuous clock with canonical physics.
- Keep geometry and drawing local to the widget recipe.
- Use `ARTIFACT_SVG_FILTER_REGIONS` for SVG filter regions so viewBox-space and
  object-bounding-box-space coordinates do not mix implicitly.
- Use `createArtifactSvgViewBox(...)` for artifact SVG bodies instead of
  hand-assembling `0 0 width height` strings.
- Keep simulation physics, quality profiles, particles, and daily/text recipes in
  runtime recipe files when a widget grows beyond simple presentation.
- Keep the Enso body backed by `ZenEnsoCanvas` in static completed mode.

## Important Visual Contract

`Enso.jsx` must render the same brush logic as the Zen boot Enso, but without
the drawing animation. The standalone artifact state is the completed loop,
with head and tail connected.

The gallery Enso (`zenEnsoScene.js`) is staged instead, by how many of Veil's
released signals are on (`visualState.activeCount` of `stageCount`), in the
reverse of the other artifacts. With none it is the held circle (`HELD`
form: the complete stroke stopped short at full load) filled with the cosmos
and full stars; each signal takes stars away and dims the rest; with all of
them the cosmos drains to plain ink and the brush finishes the same stroke
(`drawClosure` in `ZenEnsoCanvas.js`) at the width it stopped, drying into
the head. Turning a signal back off washes the ink plate, finished stroke and
all, back into the open cosmos. The stage is a live presentation
input animated in place; it is not part of the material key, so toggling a
signal never rebuilds the scene. Without ambient motion the stage settles at
once. Enso has no separate dimmed "off" look.

## Simulation Recipe Split

- `Furin.jsx` is the thin presentation adapter for motion values and DOM/SVG.
  `recipes/zenFurinRuntimeRecipe.js` owns wind mode resolution, quality budget
  mapping, mutable physics state, impact stepping, washi texture data, and the
  daily mantra recipe.
- `ShishiOdoshi.jsx` is the thin presentation adapter for scene recipes and
  motion values. `recipes/zenShishiOdoshiRuntimeRecipe.js` owns ground
  projection normalization, ripple math, mouth/stream geometry bridges, quality
  budget mapping, reusable physics/frame state, and per-step simulation output.
  The Gate drives it in pour mode; a `heldFillWindow` (the return lock) fills
  the tube on that window's clock without spilling, and a requested pour then
  tips it from wherever the hold left it.
