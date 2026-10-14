# Zen Pond Shadow and Viewport Contract

- Status: Active
- Owner: Zen pond scene presentation
- Last validated against code: 2026-10-13
- Path policy: current-only
- Canonical for: Pond shadow projection, viewport transforms and background resize ownership
- Companions: `zen-top-shadow-spec.md`, `zen-pond-render-worker-spec.md`

## One environment, one projection

`pixiFrameChannels` resolves `shadowLight` once from the canonical numeric sun
vector, direct sunlight, diffuse skylight and light RGB. The pure owner is
`pond/runtime/zenPondShadowProjection.js`; it does not solve astronomy, choose
weather, read time or apply cloud transmission again. The vector points toward
the sun. Cast displacement points in the opposite XY direction. The same
snapshot feeds canopy, decor form/cast material and scene-owned koi shadows.

`contracts/zenWaterOptics.js` owns the air-to-water refraction ratio. The same
`shadowLight` snapshot also contains the mean refracted upward sun vector.
`projectZenPondSubmergedShadow` uses it for bottom-cast koi and grounded rocks;
their directional form lighting consumes the same refracted vector.
surface plants and canopy retain the air-space projection. Connected caustics
consume its downward counterpart, and their live surface-normal shader uses
the same ratio. This adds no independent sun, water field or clock. Below-horizon
direct light remains off; refraction never manufactures a night cast.

Each RGB share is direct/(direct+sky), using the common sky tint. Zero incident
light defines zero shares. Below the horizon direct share is zero; the consumer
does not invent a moon bearing. Direct cast has no minimum opacity. Contact AO
and broad canopy sky occlusion have separate local roles.

Projection uses the height above the receiving plane, with a continuous
`maxReach * tanh(rawReach / maxReach)` presentation bound. This limits long
horizon casts without moving a grounded object's base or changing sun bearing.
Penumbra increases with height and reach. All lengths are logical world units,
independent of backing-store DPR.

## Support and receiver geometry

`pond/contracts/zenPondShadowGeometry.js` is the elevation owner. Water is Z=0,
positive Z is up. Normalized bathymetry/fish depth is converted only here at
48 logical world units per unit depth. This is an authored presentation scale,
not a measurement in metres or a new physical-depth simulation.

| Caster | Support / receiver | Height and contact |
| --- | --- | --- |
| Rock | Sampled immutable pond bottom | Base equals receiver; top is base + 0.32 × size. One continuously stretched footprint remains attached to the fixed base. |
| Lily pad | Water surface | Base 0; top min(1.8, 0.025 × size). Thin contact and short cast, no floor-sized floating blob. |
| Flower | Water surface or a nearby actual pad material | Base 0.04 × size; top 0.22 × size. One selected bloom silhouette can shade each pad, clipped by the pad's own material alpha. |
| Koi | Sampled bottom below its existing normalized depth | Cast length follows the source-to-bottom gap; approaching bottom shortens it. Scene sync owns the receiver. |

The source shape comes from the same seeded geometry as the body, before any
contact halo is added. Lily notches, bud/bloom petals and rock outlines therefore
remain meaningful in the shadow. Geometry masks share the color texture record
and lease lifetime. Color is rooted at the entity; flower masks have an explicit
flower-center anchor transformed with the rendered body rotation and scale. Missing geometry/receiver/light is a diagnosable failure.

The product water-lily bud is a compact folded petal cup with one shared apex
and a narrow green calyx. Its base meets the existing 0.298 × size stem socket;
seeded phase provides a small lean. `decorLilyPadWaterLily.js` owns this shape
for both pigment and mask replay. Opening/bloom geometry and the separate
botanical comparison profile retain their own shapes.

`ZenDecorMaterialMesh` preserves pigment and local folds, and applies broad form
lighting from the world sun transformed into object coordinates. Shape casts
are local multiply meshes, with fixed bounded sampling. Rock
casts continuously stretch one seeded silhouette from their attached base; a narrow fixed base contact shares the
same local draw and remains under diffuse illumination. The contact is a
one-world-unit exterior ring around the unchanged base silhouette, weighted by
the common direct-plus-sky shares. The shadow-facing half uses a monotonic inverse
warp in object space, compiled from the same solar offset and local form radii.
The sun-facing half stays fixed and receiver displacement is capped at the
common projection's reach. Five receiver-space penumbra taps soften this one
continuous outline; they never union spaced copies of the stone footprint.
Grounded rendering uses at most 10 local mask
reads (5 cast + 5 contact); without direct light the cast sampling is skipped, leaving
5 contact reads. Floating casts use 3 reads. Rock fragment results are cached
as described below; floating casts remain live. Both vanish with zero incident
light. Translating the whole rock shadow is forbidden. Iris keeps its local crown contact without a generic solar oval.

This warp does not rebake pigment, mineral normals or the seeded silhouette.
The existing cropped rock-cast result cache includes its compiled warp inputs
and refreshes on a changed light/pose signature at the existing sync cadence.
Unchanged light reuses the cached result; there is no new texture or render pass.

`zenPondMaterialShaderDialect.js` selects the decorative material/cast and Koi
body/tail shadow source interfaces from the admitted scene WebGL version before
their native mesh/rope/geometry allocation. WebGL1 keeps the complete authored
pair; WebGL2 preserves effective highp, smooth varyings, uniforms and all existing
mask/penumbra/contact/coverage arithmetic, using the existing material attribute
locations (`aTextureCoord=0`, `aVertexPosition=1`) and fragment output zero.
The fragment keeps its authored varying subset; unused vertex varyings are not
removed or turned into another visual algorithm. Native Pixi compilation,
reflection, caches, geometry/draw/blend and owned/borrowed texture lifetimes stay
canonical. Invalid context/source fails loudly rather than choosing another
shader. The native second link and attribute binds are removed by the GLSL300
interface; full-quality readiness and the two real prime frames are unchanged.

### Product rock mineral maps

`renderers/pixi/zenRockMineralMaterial.js` owns the cold, deterministic mineral
pigment and filtered silhouette-derived height slopes. The shape seed, tone,
axis and roughness select restrained coherent pigment; fine detail attenuates
on small rocks. Neither map bakes a sun, moon, water tint, clock or weather.
Chamfer distances follow the actual organic silhouette; separable filtering
precedes differentiation so raster steps do not become false ribs.

`pixiSceneTextureFactories.js` replays geometry through
`zenDecorGeometryMasks.js`, then admits completed pigment and normal/coverage
canvases. Existing color dimensions and square mask dimensions remain fixed.
The explicit `zen-rock-mineral-rgba8-v1` encoding stores straight normal RGB
and the exact existing silhouette alpha in the existing mask texture. No third
texture, persistent height buffer or frame-time Canvas work is introduced.
Grounded cast/contact consumers still read alpha only. The broad baked contact
oval is removed; the existing one-unit exterior contact remains authoritative.

`ZenDecorMaterialMesh` samples the form map in body-local mask coordinates and
unpremultiplies its RGB before decoding. Canonical world sun is transformed
into those same object coordinates. Other decor and optional profile records
explicitly declare `analytic` form and keep their existing material response.
Missing or invalid encoding fails explicitly. Normal and pigment identities
are included in the shared texture/cache lifetime; material result signatures
include form map identity/version, encoding, mask size and light response.
The product rock material draw adds one local texture sample on result-cache
misses, with no extra draw pass; its cold CPU cost and actual total-frame cost
must remain distinct from topology claims.

### Night decor material

`pixiScenePlantSync.js` consumes canonical `nightDepth` and `moonlight`; missing
or invalid unit channels fail explicitly. When the effects owner confirms the
shared water material pass is attached, rock RGB tint continuously yields to
neutral pigment with night depth. Submerged rocks are therefore illuminated
once by that pass. Daytime and detached-renderer tint retain their calibration.
Floating pads sit above water optics and own a bounded silver-green night tint
and 55% pigment desaturation. Other flower/iris tints retain their response.

`ZenDecorMaterialMesh` shades convex edges using analytic support-relative
radius, or the product rock's encoded surface normal, and the existing moonlight
scalar, without a lunar bearing, extra cast, alpha lift
or constant pixel floor. Both night uniforms are zero in daytime and included
in the decor bake signature. Pigment, masks, positions and world shadow light
remain unchanged by time/weather. Night response adds no texture variant,
pass, timer or environment owner; the product mineral form sampler described
above is shared by day/night. Material result updates use the existing sync/cache cadence.

## Cache and ordering

### Koi materials and distance softness

`ZenKoiMaterialMesh.js` owns the solar body material and both shadow meshes.
Body color, side shade and highlight are consolidated into one material rope
with two texture reads; `koiTextureCache/bakeBody.js` owns its pigment and static
cross-section/reflectance map. See the locomotion/material companion contract.

Koi body and tail shadows each read one packed RGB coverage texture. The
`koiTextureCache/packShadow.js` cold bake filters the **entire** silhouette at
0.65, 3 and 7 logical-unit radii, storing one coverage field per channel with
opaque alpha. Live material interpolates adjacent channels from the common
projection's penumbra, combined with a small profile softness term. The core
softens along with its perimeter. Direct-light opacity remains separate; no
opacity/color or solar state is baked into the mask identity.

Only the repeated-read scratch canvas requests `willReadFrequently: true` at
its first context creation. Pigment and upload canvases retain their ordinary
context settings. Packing collects column support in the same row-major pass
as alpha-to-RGB conversion, then normalizes the small bounds array. It must not
rescan all three packed channels just to recover those bounds. The three blur
radii, coverage threshold and opaque-alpha texture contract remain unchanged.

Each packed mask has 16 logical units of padding. The body shadow rope extends
its two end caps and remaps interior UVs to preserve pigment-spine registration;
the tail adjusts its normalized anchor for the same padding. Packed fields also
store per-column support bounds. The active softness band's bounds crop rope
width and UVs together. Folding the old full transparent rectangle inside a
sharp C-turn is forbidden: its overlapping triangles produce radial dark streaks.
Coverage bounds and UVs are cached until the texture or active band changes;
the cropped positions follow the existing spine on each geometry update.

`contracts/zenKoiShadowMaterial.js` is the renderer-independent owner of coverage
padding, blur radii and penumbra weights. Cold baking and live meshes consume
the same contract directly. Texture-cache code must not import GPU mesh or
shader implementations for these values; the Pond worker architecture guard
protects this direction. No compatibility re-export is retained on the mesh.

The body shape and tail are separate leased shadow textures. Their key includes
shape, size, variant and visual geometry tuning, excluding pigment, opacity,
profile blur and solar state. Palette changes may therefore reuse a valid shape
mask. No per-frame Canvas bake, blur filter, mask render target or texture variant
is introduced. The small body/tail meshes remain live because the fish moves.
These are bottom casts, not koi-on-koi receiver shadows or a new depth simulation.

`koiTextureCache/bakeFinTail.js` replays the same authored main/sub fin webs into
pigment-independent, partly transmitting coverage. `bakeFinShadow.js` packs
both padded families into one atlas with the same three blur bands. The atlas
shares the existing shadow record/key/refcount/disposal lifecycle; color,
solar/weather state and live articulation do not enter its identity. A partial
shadow-bundle failure releases its completed textures before propagating.
`ZenKoiFinShadowMesh` projects the four actual fin sprite poses into the same
bottom receiver as the body and tail. Four quads use one atlas sample per pixel,
one additional draw per visible ordinary koi, and retained position/UV buffers.
Folding, mirroring and rotation reuse the admitted appendage pose. Root coverage
is reduced to avoid a dark overlap seam with the body. No live Canvas, blur
filter or offscreen target is added. Zero-strength ordinary casts hide the fin
mesh. Invitation silhouettes keep their existing visible black fins; assignment
fades the new bottom fin cast in with material presence, avoiding double fins.

`zenKoiWaterMaterial.js` distinguishes normalized view depth from fish-to-bottom
gap. View depth/turbidity continuously reduce common body/appendage pigment gain;
the existing body draw also softens local shading, saturation and wet sheen while
preserving alpha and seeded textures. Receiver travel/turbidity attenuate the
cast and widen its prefiltered penumbra. A deeper fish can therefore lose body
contrast while its nearer-bottom shadow becomes sharper and more attached.
Direct/diffuse light remains the common opacity authority. Night readability
keeps the existing authored silver key without introducing a lunar cast bearing.

For an active roster entry/exit, the head may lie outside the finite bathymetry
while the body or its cast still overlaps the pond. `sampleZenKoiShadowBottomDepth`
in `runtime/zenPondShadowProjection.js` samples the nearest point on the bottom
receiver rectangle along the committed bank axis for this lifecycle only. The caster's coordinates and body
geometry remain unchanged. Ordinary residents still use strict world coordinates;
non-finite coordinates fail with `ZEN_POND_SHADOW_FIELD_INVALID:koi.x/koi.y`.
This projection ends when the crossing ends; it does not extend the bathymetry,
provide a second depth source, or conceal a failed simulation.

### Floor and decor results

`surfaceStaticBaseContainer` contains only `floorMaterialContainer`: authored
base/depth and benthic relief. `surfaceDynamicContainer` orders cosmic backdrop,
rock casts, rocks, koi and particles. Rock material uniforms and solar movement
are excluded from the static floor cache. The live benthic caustic overlay stays
between the floor and decor; combining floor and rocks would change this order.
Both rocks and bottom casts remain
beneath the water optics. Floating plants remain above that optical group.

`pixiDecorBakeRuntime.js` owns two lazy, resolution-1 render-result caches:
one for rock cast RGB transfer and one for rock material color. Each is cropped
to its source bounds, rounded outward and clipped to the committed world, so
the combined RGBA8 color allocation is at most `8 * worldWidth * worldHeight`
bytes (driver attachments/overhead excluded). Targets resize in place and are
destroyed with the scene. This is an explicit memory-for-fragment-work tradeoff;
it does not lower the quality of the source masks or the water field.

The cast target clears to opaque white and the replacement sprite uses multiply;
the body target clears to transparent black and uses normal premultiplied alpha.
This preserves colored cast multiplication and overlap over the moving caustic
backdrop. Both sprites occupy the original decor sequence. The floor baker hides
the whole dynamic container, including these sprites, while capturing the floor.

`ZenDecorMaterialMesh` and `ZenDecorShadowMesh` provide exact shader-input
signatures, including geometry, texture identity/version, sun/direct/sky shares,
cast offset, penumbra and contact coverage. Draw-derived uniforms are excluded.
Rock sync admits cache validation at its existing cadence (5 Hz plus texture
prune admissions); unchanged input reuses the texture. Time/weather can change
the cached result without regenerating pigment or silhouette. Pose, roster,
world-policy and resize changes invalidate or change the signature. Empty or
fully dark casts hide the cached sprite. Bake failure restores temporary state
and raises `ZEN_SURFACE_BAKE_RENDER_FAILED`; it is not a silent live-render path.

The water pass returns its current admission plan separately from sampled
diagnostics. Floor/cloud cache validation reads that current plan. A scheduled
material/background update only permits signature validation; it does not force
an unchanged floor to rebake. The existing `staticBaseBakeMs` timing includes
floor and decor result-cache submissions; the GPU query covers their draws.

Whole-scene lily-cluster and object-benthic blob masks are retired. Contact AO
is local to the supporting object. No scene-size texture is allocated to restore
those masks. Pigment and silhouette do not rebake on time/weather/resize changes.
Floating decor uses individual material/cast draws; these tradeoffs need actual runtime
measurement before claiming improved total-frame or p95 performance.

## World, camera and resize

`pond/runtime/zenPondViewportPolicy.js` owns the responsive policy. The measured
pond panel selects a world with a 720-unit short edge and the panel's aspect
(rounded to one world unit). The resulting water rectangle is shared by
composition, camera, optics and input. There is no permanent 16:9 overscan.
In landscape Home, the measured inner pond viewport stops just beyond the shared
water/sky edge: its continuation is 1% of the shorter visible CSS water dimension.
The outer grid slot stays unchanged for composition measurement. Its CSS aperture
still clips at the exact edge; this small continuation is part of the one committed
water rectangle and never grants movement across the whole hidden sky panel.
Resident head clearance is unchanged, allowing body/fin clipping near the boundary.
Object size, elevation and velocity are logical-world quantities, independent
of CSS size or device pixels. Main-thread pointers cross as viewport coordinates;
the worker maps them using its currently committed world/camera.

The resize transaction has two phases:

1. CSS size + explicit DPR snapshot → coalesced worker resize → backing store,
   committed viewport, uniform cover camera and optical bounds. The old world
   temporarily fills the panel during an active drag.
2. The mount client's single 200 ms trailing timer sends `settled: true` through
   the same resize channel. `commitZenPondViewportReflow` resolves the new world,
   moves existing entities, updates bathymetry and sync signatures, and resizes
   the existing scene and simulation kernel synchronously. A pending startup
resize is committed after both owners exist. Disposal clears the timer.

Water-layer extents are updated through the factory's declared live object
groups. A failed resize reports `ZEN_POND_RESIZE_FAILED` through the existing
fatal control-channel owner; a partially applied spatial transaction must not
continue as a healthy scene. The reflow counter advances only after every owner
has completed.

`zenPondSpatialReflow.js` captures cluster anchors and group-local offsets. Pad
colonies and their nearest flowers move together; rock hierarchy groups retain
body size, relative placement and support heights. Anchors are retained across
repeated resizes to avoid cumulative clamping drift. Initial plant count scales
with visible water area; subsequent resize preserves the existing population.
Pad colony centers use a 2% short-edge inset (minimum 12 world units), so mature
discs may straddle an aperture. Resize allows partial cropping of floating
pad/flower groups, using 45% of the group's half extent as center clearance
(minimum 12 world units), or its authored smaller edge clearance when it already
straddles the aperture, instead of forcing every silhouette inside.
Flower/pad offsets and retained anchors remain shared; grounded rocks and irises
keep full silhouette clearance. No hidden-area population or second layout is added.
True content/policy replacement invalidates the captured composition.

Fish heads move proportionally and their entire history translates by the same
delta, preserving body shape, heading, velocity and animation phase. Active
surface disturbances, petal landing targets and interaction stimuli move into
the new space. The existing simulation loop keeps its clocks and cadence state.
No roster/session sync or worker/renderer remount is used for a resize.

The new bathymetry extent has the same seed phase, keyed independently of world
size. The source field and caustic receiver are updated in the same transaction.
The event koi's unposed centerline receives the same translation as its displayed
spine, preserving cached articulation through a settled resize. When the trailing
body's centerline aliases displayed history, that array is translated only once; see
[`zen-koi-locomotion-and-fin-presentation.md`](zen-koi-locomotion-and-fin-presentation.md).
The canonical dynamic water field retains its texture object and time; only its
allocation/quad and aspect uniforms change. Floor bake targets resize and
invalidate. Procedural decor/canopy textures and material pools remain leased;
tiled material extents update without stretching the texture grain.

`pixiSceneBackgroundFxController` retains the base/depth texture leases while
their sprites are still bound. Resize marks a pending material refresh; the
first eligible background update bypasses the normal cadence, binds the new
extent-dependent textures, and only then releases the old ones. A disabled
water policy keeps that refresh pending until water is enabled. Base cache keys
include the committed extent as well as pigment, so repeated resizes back to the
same extent do not acquire duplicate leases. A disposal timer may run between
resize and the next frame without invalidating any bound texture. Releasing at
resize time is forbidden: a destroyed texture can throw during Pixi's local
bounds calculation for the floor bake, leave its temporary parent unrestored,
and cause a later world traversal to fail with `null.transform`.

Raster allocation is bounded separately from world geometry. Display resolution
is limited by actual DPR, the quality cap, maximum 1.25 DPR, and a 1920×1080 pixel
budget. The intermediate world target uses camera scale × display resolution,
with the same pixel ceiling, so a small panel does not allocate a 720-pixel-short
backing store merely because the logical world uses that scale. Static floor
caches remain world-resolution, invalidated only when their extent changes.
Water-field tiers use the former 16:9 cell budgets (`edge² × 9/16`), distributed
across the current aspect; a square full-quality field is 288×288, not 384×384.

Canopy uses the same visible bounds for six asymmetric corner/side branch masses
in three height bands; its shared solar3 light and packed penumbra projection are
owned by `zen-top-shadow-spec.md`. Ishigumi placement uses the actual water rectangle with
body padding instead of the intersection of hypothetical 1.1–1.9 cover cameras.
A pure DPR change reallocates raster resources without reflowing world geometry.
`viewportReflowCount` and `sceneLayout` are available through the canonical
metrics projection and dashboard resize evidence. They certify applied spatial
transactions, not GPU timing or texture identity on their own.

## Verification

- Shared projection: bearing reversal, high/horizon sun, grounded base, support
  heights, fish-to-bottom gap and zero direct/all light.
- Geometry material: actual Canvas masks, lily notch and bloom states, receiver
  transforms, local-light rotation and paired texture disposal.
- Cache/lifecycle: unchanged-light hits, shader-only invalidation, cast clear/blend,
  floor/caustic/decor order, bounds/resize, empty/policy transitions and disposal.
- Camera/lifecycle: static floor versus cached rock and live floating casts, viewport-matched world after settle,
  DPR-only transitions and immediate use of committed viewport dimensions.
- Canonical `dashboard/capture`: clear noon, morning/evening, overcast, night and
  an in-place resize. Images establish appearance; they do not certify physical
  GPU performance or a full 2.5D receiver simulation.

## Explicit quality pixel budgets (2026-09-06)

The 1920×1080 cap remains the `full` default. The user-selected `balanced` and
`low` profiles cap main/world targets at 1600×900 and 1280×720 respectively.
Both initial allocation and viewport resize receive `qualityProfile.renderPixelBudget`.
They keep the same world coordinates, crop geometry, fish roster and sun/depth
projection. Water-filter resolution is .82/.68/.55; this is separate from both
the target pixel budget and the shared field's 384/320/256 reference edge.
