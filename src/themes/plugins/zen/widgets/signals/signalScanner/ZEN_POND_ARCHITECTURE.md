# Zen Pond Architecture

Last Updated: 2026-07-30

## Purpose

Zen Pond is a worker-owned pond runtime.
Its job is to turn a small set of scene causes and direct controls into one authoritative frame bundle that all simulation and rendering consumers read from.

## System Shape

The canonical runtime shape is:

`cause -> derived channels -> authoritative frame bundle -> consumers`

Around that pipeline there are two support planes:

- `control plane`: main thread sends commands, worker returns snapshots/events.
- `world plane`: worker manages static scene state, ambient populations, fish roster, and per-frame simulation state.

## Layer Model

### 1. Cause Layer

Cause data is small, explicit, and explainable.
It should answer "what changed in the scene?" rather than "how should one specific effect look?"

Canonical cause groups:

- `scene cause`: `timeMode`, `manualHour`, `envCloudiness`, `envWaterClarity`
- `operational direct controls`: `pondPaletteId`, `padDensity`, `flowerChance`
- `creature controls`: koi appearance and swim-model parameters

Cause data must stay compact.
Do not treat per-effect visual knobs as cause data.

### 2. Derived Channel Layer

The worker resolves causes into semantic channel groups.
These groups are the only place where scene meaning should be derived.

Canonical derived channels:

- `lighting`: daylight envelope, moonlight, direct light, ambient light, scene brightness
- `atmosphere`: cloud cover, occlusion, wind intensity, tint, reflection opportunity
- `waterMedium`: clarity, turbidity, transmittance, scatter, bottom visibility
- `surface`: wave energy, roughness, refraction response, specular response, temporal excitation
- `biotic`: petal spawn gain, glimmer density gain, ecosystem response

If a new derived value cannot be placed in one of these groups, the model is probably underspecified.

### 3. Authoritative Frame Bundle

Each worker render tick should produce one authoritative frame bundle.
Consumers must read from this bundle instead of recomputing environment meaning locally.

The frame bundle should contain:

- `cause`: normalized cause snapshot
- `channels`: derived channel groups
- `frameEnv`: compact renderer-facing values
- `temporal`: smoothed temporal modulation state
- `quality`: resolved quality profile and intensity scale

The frame bundle is read-only consumer input.

## Control Plane

The main thread owns business state.
The worker owns simulation state.

Main-thread owned state:

- settings
- appearance persistence
- session seed / reroll intent
- roster source data (`domainCandidates`)
- lock intent and other user commands

Koi roster policy:

- `domainCandidates` is the single public source of truth for live koi.
- `presentationMode` may switch the projection into a ceremonial first-vision frame, but it must not introduce a second roster source.
- `buildZenKoiRosterFrame` is the canonical projector from source data to the read-only koi roster frame consumed by the surface and worker.
- Roster memory observes completed live frames for persistence only; it must not write back into React render inputs or own the active roster.

Worker-owned state:

- fish entities
- ripples and ambient entities
- hit-testing
- hover / selection derivation
- frame bundle
- scene graph and renderer resources

Canonical command channels:

- `scene_session`
- `resize`
- `input`
- `runtime_params`
- `fish_roster`

Canonical event classes:

- `ready`
- `first_frame_ack`
- `readiness`
- `metrics`
- `hover_badge_anchor_frame`
- `renderer_event`
- interaction snapshots derived by the worker

The main thread may mirror worker-derived interaction data for UI display, but that mirror is not the authority.

### Readiness And First Frame Reveal

The pond worker owns render readiness.
The React surface may display a palette-matched underpaint while the worker canvas is hidden, but it must not claim the pond is live before the worker reports a committed first frame.

Canonical readiness path:

`worker controller -> zenPondReadiness -> useZenWorkerRendererMount -> ZenSignalScannerSurface -> ZenSignalScannerView`

For current runtime, worker admission also requires roster-memory plus exact
appearance and activity ModelState hydration ACKs. Synchronous cache reads never
start hydration and never return an empty map before that ACK; reads or writes
while unhydrated fail loudly. Missing roster memory means no prior roster and is
read as empty without a write-on-read bootstrap. Malformed state and durable
read/write/clear failures are named runtime errors, never permission to continue
from empty or in-memory state. First Vision is the deliberate inverse: its
isolated projection is ready immediately and performs zero model-cache access.

Readiness phases are explicit runtime state, not visual guesses:

- `attached`: canvas host exists.
- `starting`: worker runtime start was requested.
- `worker_ready`: worker init returned capabilities.
- `first_frame_committed`: first render tick completed and `first_frame_ack` was received.
- `degraded` / `failed`: timeout, init failure, or runtime failure surfaced as diagnosable state.

The view may fade out the underpaint only after `first_frame_committed`.
It must not use an unrelated static color wash as a hidden loading fallback.
If a heavy water-effects layer becomes available after the first committed frame, it should ramp its effect gates in rather than popping on at full strength.

## World Plane

Worker world management is split by rebuild cost and ownership.

### Static Scene Compile

Rebuild only when layout-defining inputs change.

Examples:

- pond layout
- lily layout
- rock layout
- bathymetry field generation and key sync
- bathymetry-to-depth texture projection
- ambient masks

### Field Ownership

The pond has two canonical fields with intentionally different lifetimes.

- `world/fields/zenPondBathymetryField.js` is the immutable world-space bottom
  geometry SSOT. Worker world sync owns one field per scene-generation key and
  shares the same reference with simulation and Pixi consumers.
- `renderers/pixi/waterSurfaceField/ZenWaterSurfaceField.js` is the dynamic
  height/slope/curvature field updated from water causes and disturbances.

Palette, sediment, depth color, caustics, and shadow appearance are projections;
they do not own or regenerate bottom geometry. A depth texture is never sampled
back into simulation truth.

Scene fish sync owns shadow receiver selection, ordering, display lifecycle,
and texture leases. `model/koi/zenKoiShadowTransport.js` owns only the pure
depth-span projection shared by possible receivers.
`renderers/pixi/pixiKoiBodyReceiverEffectLease.js` provides that owner a lazy
body-receiver effect seam; it owns a local slot and body-rope stencil only,
while `PixiKoiFish` invokes lifecycle sync hooks. It does not own receiver
selection or scene ordering and allocates nothing on the product-default path.
Bathymetry depth-material
cutover, bathymetry-driven bottom distance, koi-on-koi receiver shadows, and
continuous 2.5D koi depth remain research-only and have not cut over to the
active product scene.

### Ambient Population

Rebuild or resize only when density- or ecosystem-defining inputs change.

Examples:

- particles
- petals
- glimmers
- water lilies

### Fish Roster

Rebuild only when roster or appearance data changes.

Examples:

- domain list
- risk values
- appearance profile

### Per-Frame Simulation

Update every simulation step only for state that is actually dynamic.

Examples:

- fish motion
- ripple motion
- petal drift
- glimmer lifecycle

Layout, population, roster, and per-frame simulation must use separate dirty keys.

## Consumer Rules

Consumers must not derive scene semantics from raw env input when the frame bundle already provides them.

Canonical consumers:

- fish simulation
- ambient simulation
- Pixi scene orchestration
- water effects
- overlay / monitor UI

Consumers may smooth or interpolate values over time, but they should not redefine the meaning of light, cloud, or water state independently.

## Hard Rules

- Resolve environment meaning once per worker render tick.
- Keep cause data small and explicit.
- Put semantic derivation in derived channels, not scattered renderer passes.
- Keep one authoritative frame bundle for all consumers.
- Use worker hit-test results as the source for hover/select derivation.
- Separate dirty keys for layout, population, roster, and frame simulation.
- Keep static bathymetry and the dynamic water-surface field as separate owners.
- Never recover world geometry from a baked depth/material texture.
- Do not introduce standalone side-profile contracts unless they are consumed as canonical channel data.
- Do not reintroduce effect-specific legacy tuning into the canonical cause path.

## Non-goals

- Main-thread simulation
- renderer-local environment authority
- tab or workspace split for env control
- direct authoring through low-level per-effect legacy knobs

## Module Map

### Cause and Frame Resolution

- `runtime/core/zenCauseModel.js`
- `runtime/core/zenChannelAssembly.js`
- `runtime/core/zenEnvCore.js`
- `runtime/core/zenFrameContract.js`
- `runtime/zenWaterDerivation.js`
- `runtime/zenWaterFrameState.js`

### Control Plane

- `src/themes/plugins/zen/pond/control/zenMainSignalScannerRuntime.js`
- `src/themes/plugins/zen/pond/control/zenPondReadiness.js`
- `src/themes/plugins/zen/pond/control/ZenPondWorkerRuntimeClient.js`
- `src/themes/plugins/zen/pond/control/useZenWorkerRendererMount.js`
- `src/themes/plugins/zen/pond/control/runtimeClient/`
- `src/themes/plugins/zen/pond/app/ZenSignalScannerSurface.jsx`
- `src/themes/plugins/zen/pond/renderers/worker/core/`

### World Plane

- `src/themes/plugins/zen/pond/contracts/zenPondBathymetryContract.js`
- `src/themes/plugins/zen/pond/world/fields/zenPondBathymetryField.js`
- `src/themes/plugins/zen/pond/renderers/worker/core/zenPondWorkerWorldSync.js`
- `src/themes/plugins/zen/pond/runtime/zenAmbientEntitySync.js`
- `src/themes/plugins/zen/pond/runtime/zenFishRosterEntitySync.js`
- `src/themes/plugins/zen/pond/runtime/zenRockLayoutSync.js`
- `src/themes/plugins/zen/pond/runtime/zenSignalScannerConfig.js`

### Simulation

- `src/themes/plugins/zen/pond/runtime/zenSignalScannerLoop.js`
- `src/themes/plugins/zen/pond/runtime/kernel/`
- `src/themes/plugins/zen/pond/runtime/systems/`
- `src/themes/plugins/zen/pond/model/koi/`
- `src/themes/plugins/zen/pond/model/koi/zenKoiShadowTransport.js`
- `src/themes/plugins/zen/pond/model/koi/koiSpatialBounds.js`
- `src/themes/plugins/zen/pond/world/decor/`

### Rendering

- `src/themes/plugins/zen/pond/renderers/pixi/ZenPixiSceneRenderer.js`
- `src/themes/plugins/zen/pond/renderers/pixi/scene/`
- `src/themes/plugins/zen/pond/renderers/pixi/waterEffects/`
- `src/themes/plugins/zen/pond/renderers/pixi/pixiFrameChannels.js`
- `src/themes/plugins/zen/pond/renderers/pixi/pixiWaterTemporalChannel.js`

### UI and Tuning

- `src/themes/plugins/zen/pond/app/ZenSignalScannerContainer.jsx`
- `src/themes/plugins/zen/pond/app/ZenKoiTunerPanel.jsx`
- `src/themes/plugins/zen/pond/contracts/`
- `src/themes/plugins/zen/pond/tuner/koiTunerSchema.js`
- `src/themes/plugins/zen/pond/tuner/env/`
- `src/themes/plugins/zen/pond/state/`
- `src/themes/plugins/zen/pond/storage/`
