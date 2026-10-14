# Zen Pond Seam Map

- Status: Active
- Owner: repository architecture, Zen theme
- Last validated against code: 2026-10-11
- Path policy: planning-allowed
- Canonical for: Zen pond subtree classification, named seam target map, staged relocation order
- Companion to:
  - `docs/architecture/repository/repository-structure-review.md`
  - `src/themes/plugins/zen/widgets/signals/signalScanner/README.md`
  - `src/themes/plugins/zen/widgets/signals/signalScanner/ZEN_POND_ARCHITECTURE.md`

## User-selected render quality

`domains/settings/config/zenRenderPreset.js` owns the persisted preference.
`runtime/zenRenderQuality.js` separates graphics budgets from frame policy;
`runtime/zenMainWorkerRenderBudget.js` projects the single Home selection into
Pond/Bonsai. `pond/runtime/zenSignalScannerConfig.js` and
`pond/runtime/zenPondViewportPolicy.js` own field/ambient budgets and target
resolution. `pixiWaterPresentationRuntime.js` applies the selected filter scale.
Default `full` and `balanced` target 60fps; explicit `low` targets 30fps. No
automatic tier selection or physical-worker replacement is added. The complete
flow is specified in `zen-pond-render-worker-spec.md`'s explicit preset section.

## Purpose

이 문서는 Zen pond subtree를 "widget 내부의 큰 폴더"가 아니라
plugin-owned subsystem으로 읽기 위한 repository-level 지도다.

목표는 두 가지다.

1. 현재 `signalScanner` 아래에 어떤 concern이 섞여 있는지 고정한다.
2. 이후 relocation을 할 때 어디를 thin shell로 남기고 어디를 pond seam으로 옮길지 기준을 만든다.

## Environment and Surface Light Owners

- `runtime/environment/zenWorldSolar.js`: actual day geometry for fixed/realtime clocks.
- `runtime/environment/zenWorldLunar.js`: the real moon (position, illuminated fraction, bright-limb angle) from the same epoch and coordinates; world `moonlight` is non-zero only while it is up.
- `runtime/environment/zenWorldLighting.js`: direct/diffuse illumination and small cloud-ray sampling.
- `runtime/environment/zenWorldBotanicalMaterialLighting.js`: shared day/moon pigment projection for bonsai bark and attached/airborne/landed petals; native paint/gradient mapping preserves alpha.
- `runtime/petals/zenPetalEventDirector.js`: input-boundary release policy and exclusive active-time petal micro-events; consumes canonical weather/time channels without owning weather or seasons. Qualified post-rain releases wait for `after_rain` or a clear completed-front handoff, never an internal lull. A bounded consumed-front set and sample-time continuity checks prevent replay across recent front changes and clock skips; hidden/opening/cover discard observations without a queue.
- `runtime/rain/zenRainStreakGeometry.js`, `zenRainStreakRuntime.js`,
  `createZenRainPixiMesh.js` and `zenRainCanvas.js`: bounded airborne rain inside
  the admitted Bonsai sky, between static back material and the tree. Both
  explicit backends share 16 seeded identities, clipped quads and the existing
  worker active clock. Layout compilation is change-only; wind displacement is
  continuous across input commits. No sky texture rebake, extra canvas, timer,
  worker, weather authority or per-drop water collision is introduced.
- `runtime/environment/zenWorldMaterialPalette.js`: projects canonical cloud/rain/daylight onto solar sky pigments, shared by the canvas sky and ambient inscription contrast. Compiled sky/shell projections reuse identical consumed inputs rather than rebuilding palettes on each draw.
- `model/bonsai/rendering/zenBonsaiOpenAirBackdrop.js`: gradient, horizon, veil and continuous solar glow consume that same weather sky palette. Generic and Plume composition caches share the bounded material paint signature, including cloud/rain/light attenuation and excluding wind/event/absolute-cloud-phase metadata. Sky has no animated painter or baked wind strokes; the existing tree/rain/petal motion expresses wind.
- `runtime/environment/zenWorldCloudField.js`: world-seeded density bytes and absolute sky phase shared with GPU projection.
- `pond/renderers/pixi/waterSurfaceField/pixiWaterSkyReflectionShader.js`: reflected-view angular sky/cloud lookup after benthic refraction, using existing normals/view.
- `pond/renderers/pixi/waterSurfaceField/pixiWaterSurfaceFieldConsumerShader.js`: shared-normal dual-scale GGX core and analytic coverage shoulder under `orthographic_scatter_v1`; no independent glint population or surface texture.
- `pond/renderers/pixi/waterSurfaceField/PixiWaterSurfaceFieldFilter.js`: density texture lifecycle and material-light uniforms; no extra cloud pass.
- `pond/renderers/worker/core/zenPondWorkerEnvironmentPresentation.js`: slow world targets, cloud scalar cadence, declared numeric interpolation.
- `pond/runtime/core/zenCadenceProfile.js`: water-pass interval crossing with unchanged phase offsets; no multi-update catch-up.
- `pond/renderers/pixi/scene/pixiSceneWaterEffectsPass.js`: previous water render clock, advanced on every render independently of sampled telemetry.

These owners do not rebake Pond static material or introduce secondary weather
providers. `environment` remains the sole world snapshot semantic payload.

Static material has a separate, narrow ownership chain:

- `pond/world/pondPalettes.js` authors calibrated pigment stops; `pixiSceneBackgroundFxController.js` consumes them without a shared cyan remix or exposure bake.
- `pond/renderers/pixi/ZenBenthicMaterialFilter.js` applies explicit hard-light/soft-light relief to the actual rendered base/depth backdrop. It borrows the water-effects layer's two textures and reads their descriptor transforms/coverage.
- `pixiSceneGraphLifecycle.js` groups only floor material below rocks and koi; `pixiSurfaceSourceBakeRuntime.js` caches that group and hides it on cache hits. The extra filter draw and temporary input target occur only on static refresh.
- `waterSurfaceField/PixiWaterSurfaceFieldFilter.js` applies live material illumination once, followed by sky reflection and shared-field analytic highlights. There is no fixed postFx sprite or view-independent sheen film in this canonical path.

## Responsive viewport owners

`contracts/zenPondRegistrationPresentation.js` owns Home's normalized visible-water
fish/editor anchors and the selected invitation's bounded waiting target. Home
and the native hint consume its height-aware `editorTopCss`; the worker's pure
layout resolver consumes actual CSS viewport dimensions before projecting into
world bounds, refreshing only when those dimensions change. Home
passes the nullable selected entity ID through the existing input control path;
the worker's fish system consumes it using the existing motor and formation
steering input. The native editor stays fixed in the water aperture, with no
per-frame pose stream, new worker channel, persistence or renderer replacement.
The scanner view owns the unboxed anchor guidance/native keyboard entry and
suppresses water hits while that editor is active.

Koi movement, event-spine lifetime and pond fin projection are governed by
[`zen-koi-locomotion-and-fin-presentation.md`](../themes/zen/zen-koi-locomotion-and-fin-presentation.md).
That contract also names Home's stable protected-site selection and the worker's
`zenFishRosterEntitySync` / `zenKoiRosterTransit` bank-crossing lifecycle. Site
identity persists across selection; live crossings serialize texture admission
and retain full opacity until every body segment has left the visible pond.
The same contract names `zenKoiInteractionStimulus` for bounded click reaction
admission/lifetime, `zenKoiBehaviorMemory` for local needs and committed companions,
and `zenFishSimulationSystem` for the simulation-time behavior clock/cache. These
are worker-local presentation behaviors; they do not own persisted energy, risk,
selection or business state. `zenKoiPersonality` derives stable behavior temperament
without changing the existing randomized locomotor parameters.
The shared event integrator owns velocity integration; `koiEventManeuver` owns
finite turn strokes and angular impulse. `zenKoiSurfaceWake` consumes each model's
propulsive power to admit surface packets with continuous depth coupling.
`waterSurfaceField/zenWaterCausticReceiverShader` owns the bounded refracted
receiver-area gather shared by the bottom overlay and the existing koi body draw.
Its bounded principal-contraction ridge uses the canonical 48-world-unit
depth conversion; authored contrast gain is separate from ray travel. A guarded
field domain preserves interior density and off-crop incoming light.
The world-space aperture varies with shared surface height,
receiver depth and turbidity; it does not create a second moving pattern.
`ZenPondBenthicReceiverTexture` owns upward bottom normals; `ZenKoiMaterialMesh`
uses fish depth and the cached curved form. `pixiWaterPresentationRuntime` passes
the borrowed field/light descriptor before entity sync. `ZenWaterLightTransport`
projects the admitted canopy into one shared, change-refreshed 256-long-edge
map; consumers distinguish refracted entry visibility, surface beam and sky.
It adds at most one small refresh draw, with no second water field or worker.
`koiEventBodyFrame` owns the neutral
spine and cached curvature coefficients; `pixiKoiFinPose` owns attached web projection.
`ZenKoiMaterialMesh` owns the solar/moonlit body material and prefiltered bottom-cast
meshes. `koiTextureCache/bakeBody` and `packShadow` own their cold-baked data maps;
the existing scene fish sync supplies the common world light and receiver gap.
The current eye-omission visual trial is owned only by
`model/koi/koiFishRenderBodyCoreMethods.js` (`1e1c1e0cb`, 2026-10-10). Cold body
baking consumes this method through `createPixiKoiTextureBakeSource`; it does
not define a second eye toggle. Native texture fixtures reflect the current
trial while preserving the earlier eyed body hashes as test-only controls.
Restoring just the shared eye primitive must reproduce those hashes, and all
pixel differences must lie within the authored eye coverage. This documents
the current trial rather than approving a permanent visual design.
`resolveZenKoiMoonlightPresence` in `koiFishMaterialExecutor` projects canonical
night/moon channels into a bounded display-only strength when the surface material
pass is attached. The same curved body form supplies a pond-space authored silver
key; it is not a physical moon bearing, new shadow or separate animation loop.
`pixiWaterSurfaceFieldUniformResolver` owns the silver-blue night visibility in
the existing linear-light material pass. It raises pale pigment without a
constant RGB floor, extra tint stage or change to world irradiance.
Body shape construction uses the canonical straight-spine `Path2D` and current
segment-wave inputs without allocating a scratch Canvas. Body/fin/tail raster,
shadow silhouette and shadow blur owners retain their Canvas surfaces and
explicit platform failure signals. `createPixiKoiTextureCacheCore` admits the
three completed opaque RGBA8 maps (body form and packed body/tail coverage)
directly through public `BaseTexture.fromBuffer`, with no output Canvas or data
mirror. Their exact bytes, dimensions, resolution, LINEAR sampling, disabled
mipmaps and original `BaseTexture.defaultOptions` are preserved. Invalid kind,
typed array, dimensions or byte length fails with
`ZEN_PIXI_KOI_RGBA8_SOURCE_INVALID`; it is not clipped or replaced. Texture-owned
shadow bounds, cache keys, refcounts and deferred base-texture disposal retain
their existing owners. Shape data is not retained across cache admissions:
live segment waves are absent from the texture keys, so body/shadow acquisition
continues to construct each admission's current shape independently.

- `pond/runtime/zenPondViewportPolicy.js`: panel-matched world extent, settled timing and raster/field pixel budgets.
- `pond/runtime/zenPondSpatialReflow.js`: retained cluster anchors, live entity/history/disturbance coordinate transfer.
- `pond/renderers/worker/core/zenPondWorkerWorldSync.js`: settled transaction, bathymetry and sync-signature commit.
- `pond/control/runtimeClient/mountZenPondWorkerRendererCore.js`: one trailing resize timer and viewport-space input transport.
- `pond/renderers/pixi/ZenPixiSceneRenderer.js`: in-place world/target/optics resize; no renderer remount.
- `pond/runtime/kernel/createZenSignalScannerSimKernel.js`: live system extents with unchanged simulation clock.

The Active behavior contract is `themes/zen/zen-pond-shadow-and-viewport-spec.md`.

## Current Footprint

2026-04-18 기준 `src/themes/plugins/zen/widgets/signals/signalScanner`는
총 13개 file 규모이며, source file은 9개만 남아 있다.
worker/control/Pixi/core/tuner/kernel/runtime/model/world/state/storage/contracts
mirror shim은 제거된 상태다.

initial landing:

- `src/themes/plugins/zen/pond/app/*`
- `src/themes/plugins/zen/pond/control/*`
- `src/themes/plugins/zen/pond/control/runtimeClient/*`
- `src/themes/plugins/zen/pond/renderers/pixi/*`
- `src/themes/plugins/zen/pond/renderers/worker/*`
- `src/themes/plugins/zen/pond/roster/*`
- `src/themes/plugins/zen/pond/runtime/*`
- `src/themes/plugins/zen/pond/model/koi/*`
- `src/themes/plugins/zen/pond/world/*`
- `src/themes/plugins/zen/pond/contracts/*`
- `src/themes/plugins/zen/pond/state/*`
- `src/themes/plugins/zen/pond/storage/*`
- `src/themes/plugins/zen/pond/tuner/*`

현재는 scanner/tuner container, top-level control seam,
worker runtime client internals, worker boot/core,
Pixi renderer plane, runtime/model/world seam,
contracts/state/storage/tuner schema seam,
scanner/tuner orchestration surface와 scanner app hooks가
`zen/pond/*` canonical home으로 이동했고,
widget subtree에는 docs, manifest-facing entry, view shell, overlay,
tuner subcomponents만 남아 있다.

초기 landing 당시 분포:

| Zone | Files | Notes |
| --- | ---: | --- |
| `renderers` | 86 | Pixi renderer plane 53, worker renderer plane 33 |
| `koi` | 33 | fish model, appearance, motion, render logic |
| `runtime` | 33 | cause/channel/frame resolution, loop, kernel, systems |
| `core` | 11 | widget runtime entry, hooks, orchestration |
| `tuner` | 11 | tuning UI + env controls |
| `decor` | 10 | pond decor entities |
| `state` | 9 | ownership contract, selectors, stores |
| `storage` | 6 | pond storage surface |
| `app` | 3 | container layer |
| `infra` | 3 | persistence-side support |

추가 신호:

- top-level docs가 이미 별도로 존재한다.
  - `README.md`
  - `ZEN_POND_ARCHITECTURE.md`
  - `ZEN_POND_VISUAL_QA.md`
- top-level runtime assets와 constants도 subsystem root 성격이 강했다.
  - canonical homes:
    - `src/themes/plugins/zen/pond/world/entities.js`
    - `src/themes/plugins/zen/pond/world/pondPalettes.js`
    - `src/themes/plugins/zen/runtime/environment/zenWorldEnvironmentTimeline.js`
    - `src/themes/plugins/zen/runtime/environment/zenWorldWeatherEventDirector.js`
    - `src/themes/plugins/zen/pond/runtime/core/zenPondEnvironmentProjection.js`
    - `src/themes/plugins/zen/pond/renderers/pixi/*`

즉, 현재 경로는 UI shell 아래 feature folder라기보다
worker/runtime/render/model/persistence를 함께 품은 subsystem root에 가깝다.

## Current Reading

현재 canonical map은 아래 세 층으로 읽힌다.

1. widget shell
2. pond control/runtime/worker plane
3. pond world/render/model plane

구체적으로는:

- `app`, `core`, `ui`는 widget shell 성격이다.
- `control`, `renderers`, `runtime`, `model`, `world`, `contracts`, `state`, `storage`는 pond subsystem canonical owner다.
- `app`는 scanner/tuner container, orchestration surface, app hooks owner다.
- `tuner`는 leaf UI subcomponent만 widget에 남고, orchestration/schema/env authority는 pond canonical seam으로 이동했다.

지금은 canonical owner가 `zen/pond/*`로 이동했고,
worker/control/Pixi/core/tuner/kernel/runtime/model/world/state/storage/contracts
mirror shim은 제거되었다.
남은 과제는 widget leaf UI를 현재처럼 유지할지,
장기적으로 pond app presentation seam으로 더 묶을지 결정하는 정도다.

## Target Reading

목표는 `widgets/signals`를 thin entry seam으로 줄이고,
pond subsystem의 canonical owner를 named seam으로 보이게 만드는 것이다.

권장 target map:

| Target seam | Owns |
| --- | --- |
| `src/themes/plugins/zen/widgets/signals/*` | thin UI entry, dashboard/widget-facing shells |
| `src/themes/plugins/zen/runtime/environment/*` | cross-surface clock, solar, weather, ambient grammar, signed authority, immutable world sample, and domain-neutral material projection |
| `src/themes/plugins/zen/runtime/petals/*` | sole app-wide airborne-petal simulation, fixed budget, shared material, and transient landing receiver bridge |
| `src/themes/plugins/zen/pond/app/*` | scanner/tuner container composition |
| `src/themes/plugins/zen/pond/control/*` | main-thread runtime bridge, worker client, control policy |
| `src/themes/plugins/zen/pond/roster/*` | canonical koi roster snapshot contracts and projections |
| `src/themes/plugins/zen/pond/runtime/*` | cause, channels, frame contract, sim kernel, systems |
| `src/themes/plugins/zen/pond/renderers/pixi/*` | Pixi scene orchestration, water effects, texture caches |
| `src/themes/plugins/zen/pond/renderers/worker/*` | worker boot/runtime/control handlers |
| `src/themes/plugins/zen/pond/model/koi/*` | koi entity, appearance, motion, render math |
| `src/themes/plugins/zen/pond/world/decor/*` | decor entities and ambient world pieces |
| `src/themes/plugins/zen/pond/world/fields/*` | immutable world-space geometry fields, including canonical bathymetry |
| `src/themes/plugins/zen/pond/contracts/*` | pond runtime/render/test contracts |
| `src/themes/plugins/zen/pond/state/*` | pond-specific store/selectors/ownership contracts |
| `src/themes/plugins/zen/pond/storage/*` | pond persistence surface |
| `src/themes/plugins/zen/pond/tuner/*` | tuner schema, controls, env panels |

Static decor seed owner note:

- `pond/runtime/zenSignalScannerConfig.js` owns pad/flower layout admission.
  Its scoped layout RNG combines scene generation key, world extent, requested
  count and flower chance. Every generated `LilyPad`/`WaterLilyBloom`, including
  the final zero-flower placement, receives that RNG for appearance, stage and
  animation phases; global `Math.random` does not author seeded scene decor.
- `pond/world/decor/*` owns the resulting immutable size/appearance and live
  motion. The seed contract does not add elapsed-day flower growth, change
  size/placement equations or alter renderer texture/camera ownership.
- `tests/themes/zenPondSceneDeterminism.test.js` verifies a compact aperture
  that rejects both placement passes and exercises the final flower admission.

Visual-profile owner note:

- `contracts/zenPondVisualProfile.js` owns the exact four-axis product DTO.
- `state/stores/useZenSettingsStore.js` and
  `storage/repositories/zenVisualProfileRepository.js` own its UI-only selection
  and typed page-local persistence.
- `renderers/pixi/visualProfiles/compileZenPondVisualRenderPlan.js` compiles one
  immutable strategy bundle per scene mount. Entity sync, water texture bake,
  komorebi, and canonical caustic consumers receive functions/classes from that
  bundle; they do not import research descriptors or switch profile IDs per frame.
- Every product sunlight profile uses `connected_sunweb_v1` through
  `ZenWaterConnectedCausticOverlay`; only `lacyKomorebi` remains profile-specific.
  `ZenWaterBenthicCausticOverlay` owns their shared lifetime and admission, while
  its one-tap curvature shader has no active product algorithm selection and
  cannot act as a missing-receiver fallback.
- `renderers/pixi/waterEffectsTextureGenerators.js` may skip wrapped Canvas2D
  copies whose conservative bounds cannot intersect the current tile. It must
  preserve the center/boundary draw order, random consumption, texture dimensions,
  material inputs, and blend operations; this is clipped-work elimination, not a
  visual profile or quality policy.
- `renderers/pixi/pixiWaterEffectsTextureBake.js` admits the completed mist blur
  Canvas directly, eliminating only the final same-size identity copy. Its nine
  wrapped blur draws, filter, dimensions, RNG consumption, source/blur context
  attributes and Texture-owned lifetime remain unchanged. Native full-RGBA fixtures
  and selected-source Canvas/GPU sampling protect pixel correctness; they do not
  establish startup latency or a named QA PASS. Decor Canvas backends are unchanged.
- `renderers/pixi/pixiWaterEffectsLayerLoader.js` is the single in-worker factory
  cache for the water-effects layer. Renderer module admission commits its validated
  factory into this cache, and the first-frame transition consumes that same admitted
  identity; a second factory identity is a canonical conflict, not a fallback.
- `src/themes/plugins/zen/runtime/worker/zenPixiWorkerRuntime.js` is the physical
  Home Worker's only direct Pixi package surface. Pond renderer files consume the
  narrower `renderers/pixi/zenPondPixiRuntime.js` projection and Bonsai consumes the
  shared worker seam directly. Worker-owned renderers must not import the `pixi.js`
  umbrella or independently install Pixi runtime packages.
  This seam alone registers the native `batch` subclass with public
  `extensions.add` and injects `BatchRenderer`/`BatchShaderGenerator`/`Program` into the pure
  `renderers/pixi/zenPondSpriteBatchShader.js` factory. Only the Pond host sets
  `zenPondSpriteBatchDialect: true`; unflagged Bonsai/Artifact renderers and actual
  WebGL1 contexts retain native generation. Public `generateShader` chooses after
  context admission; a lazy, uncompiled native `Program` preserves native source
  precision preparation before `createZenPondSpriteBatchWebGL2Sources` transforms
  only shader interfaces. Actual WebGL2 uses GLSL300 with native alphabetical
  attributes `aColor=0`, `aTextureCoord=1`, `aTextureId=2`, `aVertexPosition=3` and
  output 0. A cached native generator retains the linear sampler ladder and
  converts only `texture2D` to `texture`. Pixi skips its attribute bind/relink
  branch; capacity, reflection/cache, packing/pools, order and disposal stay native.
  Invalid actual versions or attribute layouts fail explicitly. This seam owns no
  GL calls, compiler, metadata, global settings/prototype mutation, retry or quality
  policy. Pond has no Graphics path: native Graphics' pluginName-only direct-shader
  cache must not inherit this dialect and reuse it in a different WebGL1 context.
  The balanced sampler-tree candidate was removed after preparation regressed.
  Equivalent source and removal of native relink alone do not prove startup speed;
  exact-run native-program/first-tick/reveal comparisons remain required.
  The same canonical package seam separately registers a native `tilingSprite`
  subclass and injects `TilingSpriteRenderer`/`Shader` into the pure
  `renderers/pixi/zenPondTilingSpriteShader.js` factory. Only the Pond host sets
  `zenPondTilingSpriteDialect: true`. Public `contextChange` validates a flagged
  renderer's actual version before calling native `super.contextChange` once.
  Unflagged Bonsai/Artifact and WebGL1 shaders remain native. For flagged WebGL2,
  `createZenPondTilingSpriteWebGL2Sources` converts only the public simple shader's
  source interface to GLSL300: lowp in both stages, original transform/UV/color
  math and uniforms stay unchanged; attributes are `aTextureCoord=0` and
  `aVertexPosition=1`, output 0. Public `Shader.from` receives the original
  `uniformGroup`, preserving the exact uniforms/globals sharing, and the replaced
  temporary Shader is destroyed without modifying its Program/cache. Native
  general tiling shader, render/QuadUv/wrap/state/blend/draw and GL lifetime remain
  native. Invalid actual versions or source contracts fail explicitly. No extra
  GL queries, compiler/cache ownership, global mutations or retry is introduced.
  The worker boundary guard allows exactly these two named plugin registrations;
  actual program/first-tick/reveal measurements determine any latency gain.
- `renderers/pixi/createZenPondPixiRendererHost.js` owns Pond's direct public
  `Renderer`/`Container` allocation and independent stage/renderer disposal. Its
  actual WebGL context must expose stencil; it never creates a disposable context
  for renderer suitability detection. Scene options, view identity, viewport and
  explicit frame-loop ownership remain with `ZenPixiSceneRenderer.js`.
  Debug capability plus explicit render telemetry may observe the original
  constructor and existing required stencil read; the worker engine publishes
  `startup_renderer_admission` through its existing timeline. These are inclusive
  native wall spans that may include driver/shared Home GPU raster queue waits,
  not isolated context, shader or GPU execution costs. Disabled observation adds no clock/GL
  calls, and enabled observation adds no GL calls or changes native results/errors.
- `renderers/pixi/waterEffects/passes/zenCanopyLightTransferShaderDialect.js`
  selects only the authored canopy source interface from the actual admitted
  renderer version passed through the presentation/layer/sprite factory chain.
  WebGL1 source bytes and native ownership remain unchanged. WebGL2 uses
  GLSL300 with the original highp/math, five native attribute locations and
  output 0. The six-crown array, two mask reads, ten quads, MULTIPLY transfer
  and native Shader/Mesh geometry/cache/disposal stay with their existing owners.
- `renderers/pixi/telemetry/zenCanopyPreparationResearch.js` separately owns
  the debug-only `dashboard/boot --canopy-preparation=before-first-draw`
  experiment. First-frame asset preparation invokes the public native
  `ShaderSystem.generateProgram(shader)` once after layer READY and before
  any Pond draw; the native cache is reused at the normal bind. This is an
  explicit scheduling experiment, not behavior added to program diagnostics.
  Default native mode and production execute no experiment. The Active worker
  spec and QA control plane restrict admission to the full fixed noon fixture
  with program observation, require total startup/count parity, prohibit cache
  inspection, GL queries, retry and yield, and define its removal condition.
- `model/koi/KoiSimulationFish.js` owns renderer-neutral Koi state and motion.
  `model/koi/KoiFish.js` is the Canvas-capable public subclass. Pond worker roster
  code imports the simulation class directly and must not recover it through
  `world/entities.js`, which also exposes the Canvas-capable public surface.
- `rocks=ishigumi` selects a worker-owned layout strategy before ambient entity
  materialization. All other rock profiles retain the canonical product layout.
- `world/decor/decorHeroRock.js` owns `resolveZenRockShape`: the product's
  softened organic outline varies by deterministic waterworn/elongated/slab/
  wedge/fractured/shouldered families. Pigment, clipping, outline stroke and
  geometry-mask baking consume the same points. `getZenRockCollisionRadius`
  owns the existing conservative placement radius; both layout and the outline's
    bounded envelope consume it. The optional natural-profile silhouette
    projection remains independently selected.
- `renderers/pixi/zenRockMineralMaterial.js` cold-bakes product rock pigment and
  filtered silhouette-derived surface normals. `pixiSceneTextureFactories.js`
  admits pigment at the existing color dimensions and packs normals into the
  existing silhouette RGB, preserving alpha exactly. `ZenDecorMaterialMesh`
  decodes that explicitly tagged form map; other decor/profile records retain
  their declared analytic form. Color and packed coverage share the existing
  two-texture cache lease and deferred disposal.
- The shape RNG and `pixiSceneTextureCache.js` share `buildZenRockShapeSeedKey`.
  Discrete family choices cannot alias through coarse numeric seed rounding.
- `runtime/zenRockLayoutSync.js` seeds constructor appearance independently of
  layout RNG when no explicit research RNG is supplied. Promotion and filler
  paths share that stream; adding appearance variation cannot reshuffle placement.
- Product exposes only Single mode. The two-slot A/B composition and build-time
  module replacement graph remain under `scripts/dev/zen-pond-render-research/**`.

핵심은 "어디로 옮길까"보다 "pond owner가 widget tree 밖에서 읽히는가"다.

Ambient petal ownership:

- `model/sakura/sakuraPetalMaterial.js` owns the product blossom palette,
  three notched petal outlines and pigment stops. Plume's 24-tile atlas and
  `runtime/petals/zenPetalMaterial.js` reuse that outline/body gradient; the latter bakes one detached-petal
  material for Canvas2D and Pixi at the same detail resolution. Landings retain
  the field's size/opacity; no pond-local palette substitution is permitted.

- `runtime/environment/zenWorldBotanicalMaterialLighting.js` applies the same
  canonical night/moon recipe to attached blossoms and detached petals. Authored
  color IDs remain in the landing DTO. Airborne projection uses its existing
  authority sampling; the Pond Worker compiles realm-local material functions
  at `normalizeRuntimeEnv`'s slow target seam and carries that stepped material
  through numeric interpolation. It is not an IPC payload or a second clock.
  Airborne blur bakes and landed Pixi records lazily repaint their existing
  canvases only when that 0.05-grain material signature changes. Cache keys remain
  color/form/focus, with one retained material generation and unchanged bounds;
  landed textures/sprites are reused, including after culling or a petal-free
  interval. Canvas and Pixi consume the same material, without changing landing
  size, alpha, rotation, lifetime or ripple admission.

- `api/petalField.js` exposes the lazy dashboard field; `api/petalSource.js`
  exposes its memory-only Home source. `ZenAppPetalHost` lives outside tab panes.
  Its quantized retained biotic snapshot reuses the existing Home publication;
  neither Lab publication nor pond tuning can create another emission owner.
- `runtime/petals/zenAppPetalField.js` is the only ambient airborne emitter.
  Its positions use viewport CSS pixels. Bonsai canvas/branch positions are not
  inputs, and the field covers every dashboard layout and tab.
  `zenPetalEmission.js` owns the continuous biotic supply projection: full unit
  capacity/bloom/readiness produces 3.6 petals/second at 1440x900 before wind
  scaling, about 9.5x the previous reference. A smooth release from published
  bloom 0.12 to 0.62 respects Plume's already-attenuated visible-flower supply.
  The canonical full-growth capture source (0.70 capacity, 0.56 bloom, 0.60
  readiness) supplies about 1.99/second at that reference viewport; maximum life
  supplies about 3.37/second. Early-growth preview remains about one petal/minute.
  Its mean-one abundance envelope varies by at most 12–20%
  with wind, using the field's existing active simulation clock. The live cap is
  48; landing batches remain capped at 24. `zenAppPetalPresentation.js` owns
  source-independent opening supply at 3.6 petals/second before viewport scaling
  and the shared abundance envelope, for at most eight active seconds with a
  0.7-second rise and two-second settle.
  `zenPetalFlight.js` owns each identity's seeded flight recipe, shared-gust
  drift, reversing zigzag flutter and signed face/edge/reverse-face tumbling.
  Base descent is 125–215 CSS pixels/second; orientation-dependent drag varies
  its multiplier from 0.72 to 1.18 before depth projection and vertical wind.
  Only surface petals align to a full face before handoff; background/foreground
  flight continues past the pond without another simulation or clock.
  `zenPetalDepth.js` projects per-petal distance into size, motion and focus;
  `zenPetalSpriteCache.js` owns bounded, lazy blur texture bakes. The immutable
  depth sample selects background (20%), surface (52%), or foreground (28%).
  Only small surface-layer petals converge to the sharp base material and may
  cross a virtual landing plane. Background/foreground petals retain their
  distance and tumble while passing the pond. Raw depth stays local; the
  strict `depthLayer: surface` admission tag crosses the worker seam.
  Base size coefficients are 5.2–6.6 CSS px for background, 5–5.8 for surface,
  and 9–14 for foreground. Background projection scales size by 0.78–0.9 and
  motion by 0.72–0.9. Foreground size/motion grow nonlinearly to 2.4x/1.9x,
  reaching a 33.6 CSS px coefficient at the nearest slice. Depth through 0.94
  stays sharp; only the closest camera slice gradually receives defocus.
  Surface size/motion converge to 1x over the final 180 CSS pixels before the
  virtual landing plane. Tumble may temporarily show a thin edge. Larger surface
  petals still pass the world-size admission below without impact rescaling.
- The visible scanner registers its actual canvas aperture as a receiver. The
  scanner's exact transparent input plane is supplied by ref for DOM hit testing;
  it is not a visual occluder. Other overlays and controls still reject landings.
  Canvas geometry and clipping remain authoritative for the full petal footprint,
  including rounded corners and sibling overlays. Surface crossings interpolate
  the swept trajectory to the exact sampled height, rather than an overshot frame
  endpoint. A declined candidate continues falling and is never offered again. The
  field sends bounded appearance-preserving landing batches through the existing
  pond control/client/worker channel. Landing events are not latest-value pointer
  state; pointer movement cannot replace them.
- `pond/world/decor/decorFlowerPetal.js` owns only received floating/resting
  petals, their water/pad behavior and terminal fade. Water impacts use the
  existing semantic `petal` disturbance source exactly once. Initial fill,
  target-count replenishment, and autonomous airborne/falling presence are retired.
  A standalone Pond/Lab without the app field has no ambient petal supply.
- Pond admission also checks apparent size in canonical world coordinates after
  the CSS/logical/cover transforms. Sizes above six world units are declined
  without spawning an entity, making a ripple or shrinking the petal at impact.
  This cap is relative to the fixed 720-unit world short edge and remains smaller
  than the radius-10 young lily-pad tail. Accepted landings retain exact size.
- Receiver lifetime and de-duplication are transient presentation concerns;
  no persisted event queue, second physical Worker, or legacy emitter fallback
  is allowed.

Worker runtime protocol note:

- Dashboard UI ambient projection and renderer temporal authority are distinct
  named seams. `SYNC_ENVIRONMENT_AUTHORITY` carries only semantic realtime/fixed,
  location, world, and weather deltas; it cannot be folded into
  `SYNC_RUNTIME_PARAMS` or trigger a water-layer apply.
- Realtime Pond/Bonsai clocks are worker-local. Bonsai uses its fine environment
  render signature for dynamic state and the canonical coarse environment bake
  signature for static-layer cache invalidation.
  Bonsai refresh deadlines use the existing monotonic performance clock, while
  world sampling uses canonical wall time. A real inactive-to-active transition
  refreshes realtime weather once; repeated active signals and fixed scenes
  cannot trigger extra samples.
- Worker-local does not mean duplicated semantics: every realm samples the same
  `zenWorldEnvironmentKernel.js` from a strict `ZenWorldEnvironmentAuthority`.
  Pond and Bonsai then consume explicit domain projections recording the source
  authority revision and sample ID.
- Pond main creates only the signed authority through
  `useZenPondEnvironmentAuthority.js`; it does not build a parallel environment
  target. The Pond worker owns sampling/projection on its slow refresh boundary.
  Bonsai uses `useZenBonsaiEnvironmentState.js` and must not import the Pond hook.
- Pond-only visual research replaces `zenPondEnvironmentDynamicTarget.js`, not
  the global world timeline. This keeps a detached Pond material experiment from
  silently changing Dashboard ambient or Bonsai environment semantics.
- Pond's frame path interpolates only the declared continuous, angular, and cyclic
  fields. Authority validation, solar/weather resolution, material projection,
  signature generation, and schema normalization stay on control or slow target
  refresh boundaries.
- Worker telemetry is pull/edge oriented: first-frame acknowledgement, explicit metrics flushes, and runtime-health diagnostics.
- Detailed runtime-health timelines and Pixi GPU timer queries are dev/research
  build capabilities. Public workers expose explicit disabled snapshots and the
  artifact gate rejects the GPU timer implementation from their closure.
- Frame-by-frame hover badge anchor traffic is not a canonical protocol seam. Hover/selection facts cross through interaction feedback and the interaction store; the widget view may change cursor/emphasis from those facts, but it must not subscribe to a worker-driven badge-anchor stream.
- `check:zen-pond-worker:architecture` rejects the retired hover anchor message path.
- Main-thread control owns canonical persisted activity-profile snapshots. Worker
  simulation may import only the named worker-safe energy math seam and must reject
  a bound fish whose DTO is missing or invalid. `storage/**`, Zen model repositories,
  model state, and main-thread snapshot builders are forbidden in the Vite Pond
  worker sub-build closure.
- The public build emits a worker-specific module inventory. The Pond artifact
  checker validates source module ids plus the emitted worker raw/gzip budget, so
  renaming a worker chunk cannot conceal an ownership regression.

Water-surface named seam:

- `contracts/zenPondFrameMetrics.js` owns the shared renderer-observation DTO,
  numeric precision and canonical model-ID readers for Worker telemetry and
  main runtime client consumption. Zero-valued effect gains survive the
  boundary unchanged. Sampling, first-frame ACK, journals and message envelopes
  remain with their existing owners; neither endpoint defines another copy of
  the frame/water-effects field projection.
- `renderers/pixi/pixiWaterEffectsTextureCache.js` shares textures while references
  are live. The last release evicts the entry immediately and queues GPU texture
  destruction through `shared/pixiDeferredTextureDisposal.js`; this is not a
  time-based retained cache. Generation admission and explicit hard clear remain
  with this same cache owner.
- `src/themes/plugins/zen/runtime/environment/zenWorldWeatherAuthority.js` owns explicit `procedural_event_v1`,
  `fixed_lab_v1`, and `ceremony_clear_v1` source modes. Main scene projection
  selects the mode and this same seam maps it to one weather authority plus an
  optional ceremony hour; runtime does not infer one from cloud values. The pond
  and adjacent Main bonsai consume the same policy; bonsai receives only render
  lighting and wind, never a cultivation-state mutation.
- `src/themes/plugins/zen/runtime/environment/zenWorldWeatherEventDirector.js` owns local-calendar daily regimes,
  at least one rain front per aligned five-day block, full-day deterministic onset,
  cross-midnight ownership, `passing_shower` / `steady_rain` / `sunshower`,
  bounded rain cells, dry lulls, and continuous event envelopes. Usage,
  friction, progression, browsing, visit, and session state are forbidden
  inputs. Adjacent front dates derive from the canonical local-calendar
  `dayIndex` using Gregorian year/leap-day boundaries. The weather-hour axis is
  local civil time: DST repeated hours resample the same weather, and skipped
  hours do not enqueue missed effects.
- `src/themes/plugins/zen/runtime/environment/zenWorldEnvironmentTimeline.js` projects event envelopes into continuous cloud,
  dry-overcast, rain, and wind state on one absolute weather-hour axis. Solar
  day/night remains orthogonal.
- `runtime/core/zenWaterSurfaceCause.js` validates and freezes the wind, clarity, and stability inputs used for water physics.
- `runtime/zenWaterDerivation.js` owns physical water channels. Yoonseul presentation parameters cannot feed phase or energy.
- `runtime/surface/zenSurfaceDisturbance.js` and `runtime/systems/*` own tap, koi-wake, and petal disturbance state without renderer objects.
- Airborne petal landings use the existing `LAND_PETALS` handoff and
  `zenPondPetalLandingReceiver` to emit one `petal` disturbance at the admitted
  pond-world coordinate. Duplicate/inactive/stale/rejected landings emit none;
  a petal resting on a lily pad does not strike the water. These disturbances
  share the quality-owned 8/10/12 field slots with tap and koi wakes.
- `renderers/pixi/waterSurfaceField/*` owns the shared height/slope/curvature
  field, including two-candidate procedural rain cells, and its consumers:
  surface optics, benthic light and the submerged koi body material. Rain does not consume semantic disturbance
  slots or allocate per-drop renderer objects.
  Bonsai sky rain and top-down pond rain are distinct projections of the same
  canonical weather. A sky-edge exit is not a pond-world intersection and must
  not be relocated into a synthetic landing. Exact visible rain-to-water
  coupling would require a shared world trajectory/receiver projection first.
- `renderers/pixi/pixiWaterSurfaceFilter.js` is legacy Pond Lab comparison infrastructure and must reject the canonical field mode.

Static-field and scene-shadow named seams:

- `contracts/zenPondBathymetryContract.js` and
  `world/fields/zenPondBathymetryField.js` own the static, immutable pond-bottom
  geometry SSOT. `renderers/worker/core/zenPondWorkerWorldSync.js` owns its
  scene-generation key and worker lifetime. Palette, weather, caustic state,
  sediment, and output texture size are presentation inputs and cannot reroll
  this field.
- The bathymetry-specific exports in `renderers/pixi/pondDepthTexture.js` are
  one-way presentation projections, not geometry owners. Their presence does
  not by itself cut the active depth-material resolver over to bathymetry.
  Consumers sample the field; they never recover depth by reading Canvas
  pixels or color.
- Static bathymetry and dynamic `ZenWaterSurfaceField` remain separate because
  they have different causes, rebuild keys, and lifetimes. They may meet in a
  renderer consumer, but neither field owns or caches the other.
- `renderers/pixi/waterSurfaceField/ZenPondBenthicReceiverTexture.js` is the
  one-way GPU projection where those fields meet for connected caustics. It
  encodes canonical bathymetry depth and bottom normal once per scene; the live
  caustic shader combines that receiver with `ZenWaterSurfaceField` refraction.
  All product sunlight profiles consume its `48 x 32 RGBA8` receiver (6,144
  pixel bytes). The single bottom draw reads five field samples plus one receiver
  sample; the existing koi body draw reads five field samples. Admitted canopy
  adds two shared transport-map reads to each receiver and one to surface optics.
  Night/off and
  daylight suppression submit zero caustic draws/fetches, with the koi caustic
  binding inactive. The receiver adds no pass, physical worker, or water-field
  owner; the separate canopy transport map has a bounded change-only refresh.
  It cannot infer receiver geometry from static-base color or become a second
  bathymetry owner.
- `runtime/zenPondShadowProjection.js` owns common away-from-sun projection and
  direct/diffuse RGB shares. `pixiFrameChannels.shadowLight` is the one per-frame
  snapshot; it introduces no clock, weather or sun solver.
  `contracts/zenWaterOptics.js` owns the ratio shared by its mean underwater ray
  and the live caustic shader. Grounded rocks and koi consume submerged
  projection; surface plants and canopy retain the air ray.
  `renderers/pixi/ZenKoiFinShadowMesh.js` consumes the existing four fin poses in
  one bottom-cast atlas draw; `koiTextureCache/bakeFinShadow.js` owns its cold
  padded atlas under the ordinary shadow lease. `zenKoiWaterMaterial.js` projects
  view depth/turbidity separately from receiver-gap cast attenuation/softness.
  `contracts/zenKoiShadowMaterial.js` owns the shared coverage padding, blur
  radii and penumbra weights. Cold texture baking and live GPU meshes import
  this renderer-independent leaf directly; texture-cache code must not import
  `ZenKoiMaterialMesh.js` to obtain constants. The Pond worker architecture
  guard enforces this dependency direction and the consumer-specific shared
  projector: submerged for fish, air-space for surface plants and canopy.
- `contracts/zenPondShadowGeometry.js` owns support-relative elevation and the
  single normalized-depth to logical-world-unit conversion. Active rock/fish
  sync samples canonical bathymetry; leaf/flower receivers are the water or
  actual pad material. Geometry-derived silhouettes and local form/cast meshes
  live in `zenDecorGeometryMasks.js` and `ZenDecorMaterialMesh.js`.
- `runtime/zenCoverMath.js` owns camera/crop math. Renderer-derived
  `visibleWorldBounds` also frames canopy; physical entities stay in the fixed
  scene. `control/runtimeClient/zenPondViewportMetrics.js` owns CSS-size/DPR
  signature and one resolution-change observer. See
  `docs/architecture/themes/zen/zen-pond-shadow-and-viewport-spec.md`.
- `model/koi/zenKoiShadowTransport.js` and
  `renderers/pixi/pixiKoiBodyReceiverEffectLease.js` remain detached research
  seams, not active projection authorities. The lazy receiver lease allocates
  nothing until acquired and introduces no alpha-mask render target.
- Bathymetry depth-material cutover, sparse koi-on-koi receiver shadows and
  continuous 2.5D koi depth remain Pond Lab candidates under
  `scripts/dev/zen-pond-render-research/**`; product may not import them. The
  current support-height/bottom-gap shadow port does not imply those cutovers.

## Mapping Rules

이동 시에는 아래 기준을 유지한다.

1. React view surface만 `widgets/signals/*`에 남긴다.
2. worker boot, runtime client, renderer policy는 widget layer에 두지 않는다.
3. cause/channel/frame resolution은 renderer 하위가 아니라 pond runtime owner에 둔다.
4. koi와 decor는 renderer의 하위가 아니라 pond world/model concern으로 읽히게 둔다.
5. tuning UI는 widget에 붙어 보일 수 있어도, schema/env authority는 pond seam에 둔다.
6. local docs는 subsystem root로 옮기고, widget layer에는 thin README만 남긴다.

## Suggested Relocation Order

한 번에 대이동하지 말고 아래 순서로 자르는 것이 안전하다.

### Cut 1. Introduce the pond root

- `src/themes/plugins/zen/pond/README.md`
- `src/themes/plugins/zen/pond/{app,control,runtime,renderers,model,world,state,storage,tuner}/`

이 단계에서는 broad move보다 canonical destination만 먼저 만든다.

### Cut 2. Move control plane first

landed:

- `src/themes/plugins/zen/pond/app/*`
- `src/themes/plugins/zen/pond/control/*`
- `src/themes/plugins/zen/pond/control/runtimeClient/*`
- `src/themes/plugins/zen/pond/renderers/worker/*`

이 컷이 중요한 이유는 main-thread widget shell과 worker control plane을 먼저 분리할 수 있기 때문이다.

### Cut 3. Move renderer plane

landed:

- `src/themes/plugins/zen/pond/renderers/pixi/**`
- `src/themes/plugins/zen/pond/renderers/pixi/pondDepthTexture.js`
- `src/themes/plugins/zen/pond/renderers/pixi/waterEffectsTextureGenerators.js`

이 컷이 끝나면 pond visual runtime의 canonical owner가 renderer seam으로 읽힌다.

### Cut 4. Move runtime and world plane

landed:

- `src/themes/plugins/zen/pond/runtime/**`
- `src/themes/plugins/zen/pond/model/koi/**`
- `src/themes/plugins/zen/pond/world/decor/**`
- `src/themes/plugins/zen/pond/world/entities.js`
- `src/themes/plugins/zen/pond/world/pondPalettes.js`
- `src/themes/plugins/zen/runtime/environment/zenWorldEnvironmentTimeline.js`
- `src/themes/plugins/zen/runtime/environment/zenWorldWeatherEventDirector.js`
- `src/themes/plugins/zen/pond/runtime/core/zenPondEnvironmentProjection.js`

이 단계 이후 공용 환경 semantic core는 Zen runtime environment seam으로 승격되고,
pond에는 물/날씨 target을 소비하는 domain projection과 simulation만 남는다.

### Cut 5. Move state/storage/tuner seams

landed:

- `src/themes/plugins/zen/pond/contracts/**`
- `src/themes/plugins/zen/pond/state/**`
- `src/themes/plugins/zen/pond/storage/**`
- `src/themes/plugins/zen/pond/tuner/**`

이 단계에서 pond의 contract, business state, persistence surface, tuner schema/env authority도 widget tree 밖 canonical owner로 이동한다.

### Cut 6. Reduce widget shell

최종적으로 widget layer에는 아래 정도만 남기는 것이 목표다.

- signal scanner compatibility entry
- tuner manifest-facing entry
- presentational view shell
- overlay UI shell
- tuner UI subcomponents
- plugin manifest-facing registration seam

## Exit Criteria

다음 상태가 되면 Zen pond의 filesystem map은 건강하다고 본다.

1. 신규 작업자가 `widgets/signals/signalScanner` 전체를 뒤지지 않고 pond runtime owner를 바로 찾을 수 있다.
2. worker/client/runtime/render/model/storage ownership이 폴더명만 보고도 분리된다.
3. widget layer가 pond persistence/runtime internals를 직접 소유하지 않는다.
4. local docs가 subsystem root와 일치한다.

## Non-Goals

이 문서의 목표는 아래가 아니다.

- Pixi renderer 세부 설계를 다시 정하는 것
- pond visual tuning 값을 지금 당장 재조정하는 것
- worker protocol 자체를 이번 단계에서 바꾸는 것

현재 목표는 Zen pond를 repository 지도에서
"큰 widget 폴더"가 아니라 "named subsystem"으로 읽히게 만드는 것이다.
