# Zen Water Surface Field Architecture

- Status: Active
- Owner: Zen pond visual runtime
- Last validated against code: 2026-10-05
- Last updated: 2026-10-05
- Path policy: current-only
- Canonical for: Zen pond water-surface state generation and its render consumers

## Decision

The Zen pond has one world-space water-surface truth: `ZenWaterSurfaceField`.

The field is rendered once at an aspect-preserving, quality-scaled resolution
before the pond world pass. Yoonseul, optional screen refraction, semantic
disturbances, procedural rain ripples, and benthic caustic lighting must read the
same field sample. They must not synthesize their own moving surface in the
default path.

The canonical dependency direction is:

```text
cause -> derived physical channel -> shared surface field -> presentation result
```

Presentation values such as yoonseul speed, opacity, or patch shape are never
allowed to drive surface phase, energy, direction, or disturbance state.

## Single-Surface Ownership Rationale

The release V1 renderer forbids four unrelated motion owners:

- yoonseul generated a private procedural normal in the final surface filter
- optional refraction generated or reused a second height basis
- caustics scrolled baked random tiles in the water-effects layer
- taps, koi wakes, and petals rendered as ring sprites above the filtered water

Each effect could be attractive in isolation, but there was no surface whose
shape all four effects agreed on. A dominant advection axis therefore read as a
moving overlay, while interaction rings could not bend the reflection or
refraction that visually surrounded them.

## Render Flow

```text
authoritative frame contract
  weather cloud / overcast / rain / wind envelope
  water clarity / reflection stability tuning
                       |
                       v
              zenWaterSurfaceCause
                       |
                       v
      surface phaseRate / gravityWaveEnergy /
      capillaryWaveEnergy / directionalSpread
                       +
      procedural rain cells
                       +
      tap / koi wake / petal semantic disturbances
                       |
                       v
              ZenWaterSurfaceField
       low-resolution height + analytic derivatives
          R/G slope, B height, A curvature
                  |
                  +--> PixiWaterSurfaceFieldFilter
                  |      yoonseul / reflection / optional refraction
                  |      -> pond surface render
                  |
                  +--> zenWaterCausticReceiverShader
                         refracted receiver-area gather
                         +--> ZenWaterConnectedCausticOverlay
                         |      bathymetry depth/normal receiver input
                         |      -> one bottom light draw
                         +--> ZenKoiMaterialMesh
                                current fish depth/form input
                                -> existing koi body draw
```

## Ownership Table

| Concern | Canonical owner | Inputs | Output |
| --- | --- | --- | --- |
| World environment authority | `zenWorldEnvironmentAuthority.js` + Main scene projection | reality, fixed Lab, or ceremony-midday mode; clock, location, world, weather facts | one signed authority revision shared semantically by Main pond and bonsai |
| Weather event schedule | `zenWorldWeatherEventDirector.js` | local calendar day and absolute weather hour only | daily regime, rain-front kind, event phase, continuous event envelopes |
| Weather and solar sample | `zenWorldEnvironmentKernel.js` + `zenWorldSolar.js` + `zenWorldLighting.js` + `zenWorldEnvironmentTimeline.js` | strict authority, event envelopes, and solar state | immutable source-stamped world snapshot containing cloud, overcast, rain, direction, intensity, gust, and ambient facts |
| Pond environment projection | `zenPondEnvironmentProjection.js` | immutable world snapshot plus pond cause tuning | prevalidated dynamic water/atmosphere target and no-bake signature |
| Water surface cause | `zenWaterSurfaceCause.js` | canonical wind, clarity, stability tuning | immutable water-surface cause |
| Physical surface channels | `zenWaterDerivation.js` | water-surface cause | phase rate, gravity/capillary energy, spread, roughness |
| Interaction disturbance | `zenSurfaceDisturbance.js` + simulation systems | tap, koi wake, petal impulses | presentation-free disturbance state |
| Ambient, rain, and disturbed surface | `ZenWaterSurfaceField` | physical channels, rain intensity, and semantic disturbances | multi-direction spectral height and ring displacement |
| Field shader dialect | `zenWaterSurfaceFieldShaderDialect.js` | actual Pixi `renderer.context.webGLVersion` (1 or 2) | GLSL ES 1.00 or 3.00 representation of the same field equations |
| Surface geometry contract | `ZenWaterSurfaceField` | ambient and interaction height | slope, height, curvature texture |
| Optical domain | `zenWaterOpticalDomain.js` | canonical 48-unit depth, existing interior field size | guard-expanded domain at unchanged interior texel density |
| Optical light visibility | `ZenWaterLightTransport` + `zenWaterLightTransportShader` | admitted canopy placement, masks, projection, light shares | one shared narrow/broad beam, sky, and composite-transfer map |
| Light transport shader dialect | `zenWaterLightTransportShaderDialect.js` | actual transport renderer context version and authored six-crown pair | equivalent GLSL100 or GLSL300 light-map interface |
| Floor pigment and relief | `pondPalettes.js` + `ZenBenthicMaterialFilter` | authored palette, rendered base/depth, existing primary/detail textures | cached floor material with explicit hard-light/soft-light composition |
| Floor material shader dialect | `zenPondMaterialShaderDialect.js` (`benthic_material`) | actual presentation renderer version, public default Filter vertex, authored relief fragment | equivalent raw GLSL100 or explicit GLSL300 Filter interface |
| Yoonseul and optics | `PixiWaterSurfaceFieldFilter` | field normal, material, light, view | reflection, glints, bounded refraction |
| Surface consumer shader dialect | `zenWaterSurfaceFieldFilterShaderDialect.js` | actual Pixi context version, public `Filter.defaultVertexSrc`, selected authored fragment | equivalent GLSL100 or GLSL300 Filter interface |
| Benthic caustic light | `ZenWaterConnectedCausticOverlay` + `zenWaterCausticReceiverShader` | shared field normals, world sunlight, bathymetry depth/normal receiver | refracted bottom-layer light focus |
| Connected caustic shader dialect | `zenWaterConnectedCausticShaderDialect.js` | actual presentation renderer context version and authored connected pair | equivalent GLSL100 or GLSL300 bottom-light interface |
| Koi caustic light | `ZenKoiMaterialMesh` + `zenWaterCausticReceiverShader` | same field/light, current fish depth and cached form | pigment-modulated light in the existing body draw |
| Caustic lifetime and admission | `ZenWaterBenthicCausticOverlay` superclass + `zenPondCausticPresentation.js` | canonical direct light and visibility gates | shared enable/suppress/dispose state; no product curvature-algorithm selection |
| Pond Lab comparisons | comparison yoonseul shader assembly | explicit Pond Lab algorithm selection | comparison-only output |

Procedural cloud, precipitation, and wind use one continuous absolute
weather-hour axis. A rain front can begin at any local hour and can remain
active across midnight. The event director advances a coherent cloud build,
one to three bounded rain cells, genuine dry `lull` intervals, and an
`after_rain` recovery instead of sampling rain as an unrelated scalar. Each
cell has continuous `drizzle -> rain -> easing` ramps. Front, cell, and
midnight boundaries are numerically continuous. `daylight` and `nightDepth`
remain solar-only channels; `overcastWeight` cannot turn a cloudy day into a
synthetic night. Wind direction is interpolated by the shortest angular path in
the worker presentation layer, so neither the solar angle nor a day-index
boundary can rotate the surface as an unrelated visual side effect.

Main reality uses `procedural_event_v1`. Its local deterministic schedule has
`passing_shower`, `steady_rain`, and `sunshower` events. Passing showers use
one to three 20-90 minute cells inside a two-to-six-hour precipitation window;
steady rain lasts three to twelve hours with low-frequency easing; sunshowers
use one or two 15-50 minute cells. Every five-day calendar block contains at
least one rain front, with small seasonally weighted extras, but the event's
start hour is sampled across the full day rather than attached to a fixed visit
or clock window. This guarantee reads no browsing, friction, score, habit,
progression, session, or visit state: worsening usage can neither unlock nor
suppress rain. It also needs no weather API, location request, per-visit counter,
or new persisted weather store.

The Main scene projection publishes the same `environmentMode` to the pond and
bonsai. Both resolve it through `zenWorldWeatherAuthority.js`, so cloud-front
light and wind reach the adjacent bonsai while rain remains a water-surface
effect. This changes only the bonsai render environment; it does not write or
reinterpret cultivation, vitality, habit, friction, or progression state.

Pond Lab uses `fixed_lab_v1`, including an explicit rain cause for deterministic
authoring. First Vision maps its `ceremony_midday` projection to
`ceremony_clear_v1`, so a procedural storm cannot leak into the reserved bright
presentation. An unknown projection or weather authority mode fails loudly
instead of falling back to another source.

## Solar, Cloud and Material Light Contract

`runtime/environment/zenWorldSolar.js` supplies the actual altitude, azimuth,
sunrise/noon/sunset and day length for both fixed and realtime clocks. Low solar
irradiance or overcast weather never increases `nightDepth`. The versioned world
snapshot exposes canonical semantics only at `environment`; the former parallel
ambient/weather/base-environment DTOs are removed. Model revision participates in
sample identity and Pond material tuning never alters a world sample.

The `solar3` presentation basis rotates the previous shared XY light by +90°
in screen coordinates (+X right, +Y down): east is left, south is up, west is
right and north is down. `sunAngle` and `sunDirectionX/Y` use this same basis;
the astronomical `solarState` azimuth, altitude, sunrise/noon/sunset and day
length remain untouched. Pond, cloud-ray projection, bonsai and shell lighting
consume the one rotated world sample. No consumer adds a second rotation.

`zenWorldCloudField.js` owns a periodic 128×128 RGBA density grid keyed by world
seed. UV is `direction.xy / max(direction.z, .12) * .16 + phase`; texture sampling
uses repeat addressing and bilinear texel centers. The same threshold/edge width
and density are used by the CPU sun ray and GPU reflected view ray. Phase comes
from absolute epoch, not mount randomness or accumulated frame count. Macro
weather controls coverage/thickness independently of the ray's sun visibility.
The small pond uses one direct-sun transmission scalar; reflected clouds sample
`reflect(-V,N)` with the existing bounded top-view camera and shared surface
normal. A five-tap angular footprint softens cloud detail as roughness increases.
Top-view Fresnel remains small; roughness never acts as a noon brightness knob.

The canonical `directSunlight` already includes cloud attenuation. Water,
canopy, caustics and specular presentation must not multiply that transmission a
second time. `diffuseSkylight` is separate. `airHaze` drives above-water mist;
water-medium turbidity controls submerged absorption/scattering only.

`PixiWaterSurfaceFieldFilter` owns one density texture (65,536 bytes), allocated
once per world seed and explicitly destroyed. It adds no render pass. The old
random white cloud-wash texture, two tiling sprites and independent drift pass
are removed. Scene graph cloud-source lists are empty: reflected sky cannot enter
the benthic refraction/bake. Reflection diagnostics live on the surface filter.

Static background texture stores the exact authored, calibrated palette stops,
with no shared cyan substrate, encoded-RGB brightness multiplier, coarse color
quantization, or baked daylight/night exposure. Time and weather do not allocate
a different pigment texture. The existing surface pass lights its base sample
once in linear RGB, then adds view-dependent sky reflection and bounded local
highlights. The highlight shoulder leaves the base unchanged when added radiance
is zero. The fixed scene-wide postFx sprite and canonical broad sheen/gold wash
are removed; they must not reintroduce another illumination owner above material.
A bounded night material visibility response is presentation exposure, not a
world irradiance or day/night fallback. Dawn/noon/dusk chroma comes from the
shared ambient grammar and numeric RGB targets.

`ZenBenthicMaterialFilter.js` owns relief composition inside
`floorMaterialContainer`, which groups background, depth and the two existing
benthic texture descriptors. Pixi 7 WebGL maps its hard-light and soft-light enum
values to normal alpha blending, so enums cannot express this material contract.
The filter samples the actual rendered floor backdrop and applies primary
hard-light followed by detail soft-light; it does not reconstruct the base/depth
formulas. Neutral 0.5 relief and zero opacity preserve the backdrop. The
filter handles premultiplied alpha, preserves backdrop coverage, and uses Pixi's
sprite matrix for pooled/cropped inputs and each source's tiling transform.
Rocks and their shape casts are live children of `surfaceDynamicContainer`,
outside both this material group and `staticBaseSources`, beneath the shared
water optics. The floor cache therefore cannot rebake because the sun changed
a rock material uniform or cast transform. Whole-scene object AO and lily
cluster blob masks are removed; contact AO belongs to each local material.
See `zen-pond-shadow-and-viewport-spec.md`.

The existing water-effects layer owns both textures and descriptor state. The
two descriptors remain in recursive static-cache signatures and diagnostics but
are not drawn as sprites. Static cache refresh costs one temporary floor input
render target and one additional filter draw; cache hits hide the entire floor
group and add zero floor filter passes. Detaching destroys only the filter, not
its borrowed textures. The static cache and Pixi filter pool retain their own
render-target lifecycle ownership.

The presentation sprite binder forwards its actual admitted
`renderer.context.webGLVersion` to the floor Filter. The fixed `benthic_material`
descriptor in `zenPondMaterialShaderDialect.js` validates that numeric context and
the source interface before native Filter allocation. WebGL1 preserves its null
vertex and complete authored fragment. WebGL2 preserves the public
`Filter.defaultVertexSrc` crop/UV/projection math, makes its native effective
highp explicit, and changes only `aVertexPosition=0`, smooth `vTextureCoord`,
texture-call spelling and fragment output zero. The authored fragment's highp
already supersedes native Program's prepended default fragment precision, so
omitting that earlier declaration does not reduce effective precision. All
uniforms, samplers, relief/PM-alpha math, padding/resolution and borrowed-source
lifetime remain unchanged. Pixi retains Filter application, pooled input targets,
compilation/reflection/context cache and disposal; its GLSL300 handling simply
skips the attribute bind and second link. No compiler override, capability query,
default-precision mutation, fallback/retry or readiness/quality change is added.

The worker samples macro solar/weather at 30–60 seconds while visible and up to
120 seconds while hidden, interpolates explicit numeric presentation fields at 100ms, then samples the
small cloud-ray lookup from that presented descriptor. CPU sun transmission and
GPU reflection therefore use identical density and absolute phase throughout a
weather transition. No separate light lag follows a future cloud target.
Cyclic cloud phases use shortest wrap interpolation. RGB/chromatic
weights interpolate numerically; texture bake, date/solar solving and color
string parsing are forbidden in this interpolation path. Fixed clock targets
keep both sun and clouds at the selected epoch.

Canopy is one light-transfer Mesh with direct and diffuse occlusion masks from
the same asymmetric, visible-bounds-framed foliage. It restores direct visibility through gaps without
emission. The open center remains brightest, gaps never exceed open sun, and
leaf shade retains diffuse skylight. Overcast suppresses direct gap contrast
while preserving softer canopy shade. See `zen-top-shadow-spec.md`.

## Field Algorithm

The ambient field uses nine broad-to-fine directional bands. The bands are
distributed around and across the canonical wind axis, use non-commensurate
frequencies, derive angular speed from a gravity-capillary dispersion relation,
curve their wave fronts, and turn phase locally. No single `flow * time`
translation owns the whole surface.

The three broad bands mix incident and reflected components with signed travel
ratios `0.45`, `-0.50`, and `-0.55`. Their phase scales are `0.40`, `0.46`, and
`0.54`, applied coherently to carrier phase, curved-front travel, and slow
turnover. This is an authored basin response: it does not solve reflection at
actual pond banks or represent a fluid current vector. Changing propagation
sign alone can cancel an aggregate direction while individual crests still
move quickly; these broad scales instead slow those crests and increase their
standing-wave contribution. Amplitude normalization preserves each band's
expected independent-space/time height variance,
`Anew = Aold * sqrt((1 + rold^2) / (1 + rnew^2))`; finite interference and optical
brightness are not held constant.

The former coherent `30.8` middle band is split into `25.7`, `31.9`, and `39.2`
crossings, at authored angles `-1.58`, `0.49`, and `2.21` around the spread-scaled
wind axis. Their signed travel ratios are `0.86`, `-0.79`, and `0.73`, each with
phase scale `0.78`. The group preserves the former band's expected unbent
independent-space/time height and slope variances. Its fourth-frequency-moment
curvature proxy increases by approximately `10.59%`; curved fronts, spatial
interference, receiver projection, and BRDF response do not imply equal optical
brightness. This introduces crossing scales instead of dimming a repeated
ridge with a presentation mask or adding localized amplitude envelopes.

The three finest capillary bands keep a bounded slope-energy budget while using
denser non-commensurate frequencies `53.8`, `82.1`, and `126.7`. Their amplitudes
and phase scale `1.0` remain unchanged by the broad/middle motion revision, so
the finer glint turnover retains its existing normal support. Each fine band also
reuses its existing slow turnover phase to rotate by a small independent angle;
the interference identity therefore evolves instead of translating forever as
one fixed pattern.

All nine bands derive their scaled phase from the single shared `uTime`.
Procedural rain continues to use the original clock, and semantic disturbance
lifetimes and propagation remain owned by their existing simulation models.

Each spectral band returns height, first derivative, and second derivative in a
single analytic evaluation. Semantic ring disturbances use the same analytic
derivative contract. The generator therefore derives slope and curvature
without evaluating the full field at four neighboring texels, and expensive
surface construction is paid once per field texel rather than repeated inside
each full-resolution effect.

The `orthographic_scatter_v1` consumer reads one field texel and evaluates a
dual-scale GGX distribution around that canonical normal: a sharp resolved-wave
core plus a low-weight, broader capillary shoulder. Both lobes share geometry
and Fresnel terms. Coverage roughness is bounded to `0.20..0.38`, with
`0.34..0.24` unfocused-to-focused weight before curvature modulation. Curvature
broadens the response instead of sharpening already busy regions. There is no
independent finite-facet population, extra field fetch, or presentation-owned
patch mask.

The consumer preserves those angular coverage bounds while lifting visible
wave-shaped glints. The luminance crossing is `smoothstep(0.008, 0.12, luma)`;
specular gain is `0.52`, with peak compression `1 / (1 + 1.8 * luma)` and
crossing gain `0.018 + 0.024 * abs(curvature)`. These presentation constants
live in the same yoonseul model contract. They strengthen finite reflected-light
fragments without narrowing the shoulder into point sparkles, adding an
independent pattern, or changing physical slope/phase. Their pixel size follows
the real surface and viewport; no fixed pixel-size guarantee is implied.

At oblique solar angles, the same coverage distribution receives a bounded
relative-contrast response. It compares `D_GGX(NoH, coverageAlpha)` with
`D_GGX(halfVector.z, coverageAlpha)`, the flat surface under the exact same
sun/view pair. The ratio crosses smoothly at `1.6..4.5`; neutral/flat waves
receive no accent. Solar obliqueness (`1 - clamp(sun.z, 0, 1)`) weights this
response at `0.18..0.76`. Shared-field absolute curvature shapes the fragments
at `0.006..0.024`, above RGBA8's neutral curvature floor `1/255`.
The accent gain is `0.085 + 0.020 * abs(curvature)`, multiplied by actual solar
radiance, `NoL`, view visibility, existing drive and canopy transport. This is
an authored visibility response to the existing BRDF shoulder, not a physical
irradiance reconstruction. It adds one GGX reference evaluation, no field
fetch, mask texture, draw, clock, view/light remap or extra facet population.
Fragments fade and turn over with the existing field's normals and curvature;
morning/evening do not start an independent timed sparkle sequence. Solar-zero
and disabled states retain zero solar highlights.

The finite-facet revision and localized field envelopes were reverted after
the reloaded Main view showed unreadable highlights and concentrated reflection.
This contract describes the restored shared-field and analytic-shoulder path.

The top-view pond blends `0.94..1.0` toward the orthographic view. That same view
owns the half-vector, `NoV`, and Fresnel inputs together; presentation must not
patch `NoH`, invent a light direction or add a screen-space corridor to force
highlights. Solar highlights disappear when direct sunlight is zero. Independent
sky reflection uses the fixed clear-sky color and the world cloud density lookup
at `reflect(-V,N)`, with the existing Fresnel and moonlit night adaptation. It
does not add a directional clear-sky gradient.

The generator pays nine analytic bands on one quality-bounded field
(`256` to `384` reference edges with aspect-independent cell budgets). The
middle split adds two analytic evaluations relative to the former seven-band
field, with no additional texture, texture fetch, draw, or pass. The consumer
performs one field fetch and compact BRDF work. This is a static
workload description, not a measured GPU timing or visual acceptance claim.

The field generator computes its texel metric once per fragment. Semantic ring
disturbances reject pixels in squared-distance space, then share one square-root
distance between primary and secondary rings. Wind and sun vectors arrive
normalized from their CPU owners and are not normalized again per fragment.
The capillary GGX shoulder adds only bounded arithmetic at output resolution.

Rain is a separate procedural contribution inside this same low-resolution field;
it does not allocate Pixi display objects, textures, disturbance records, or draw
calls. Two offset jittered cell lattices represent approximately `16`, `24`, or
`36` simultaneous ripple opportunities for low, balanced, and full quality. Each
field pixel evaluates only its own cell in each lattice, so visible density does
not multiply the per-pixel candidate count beyond two. The compact polynomial
ring rejects outside pixels in squared-distance space and pays one square root
only near a live ring. Rain contributes height and slope; it intentionally omits
a separate curvature/caustic packet.

Physical `waveEnergy`, `roughness`, `phaseRate`, gravity/capillary energy, and
directional spread derive only from the named wind, gust, stability, and rain
causes.
Comparison `speedMultiplier`, ripple irregularity, and refraction controls are
downstream projections for explicit Pond Lab selections; they cannot feed the
canonical field. `waterTemporalProjection` is not evaluated when the canonical
field is the only active consumer.

The interior quality budget uses reference edges `256` for low, `320` for balanced, and
`384` for full quality, with interior cells capped at `edge² × 9/16` by
`zenPondViewportPolicy.js`. Both dimensions follow the actual pond aspect;
full quality is 384×216 at 16:9 and 288×288 at 1:1. A guard of
`64 + 0.05 * worldHeight` world units is added on each side, rounded up to
whole field texels. The single target grows without reducing interior density.
All consumers use the shared world-to-texture map; the generator evaluates the
same waves outside the crop, without clamping, wrapping or mirroring them.
This covers the maximum flat Snell travel at 48-unit depth, inverse correction
and derivative aperture. The crop is not interpreted as an opaque pond bank.
A settled resize preserves
field time and texture identity, resizing its allocation and updating the quad,
rain grid and aspect uniforms. The texture uses
linear sampling so presentation passes can recover a continuous normal without
another procedural surface evaluation.

## Interaction Contract

`zenSurfaceDisturbance.js` owns disturbance state independently of Pixi. It
accepts explicit `tap`, `koi_wake`, and `petal` sources and advances physical
radius, width, damping, amplitude, and secondary-wave state in simulation.

Direct taps use one asymmetric analytic wave packet: a leading crest, trailing
trough, and weaker return crest share the same height, first-derivative, and
second-derivative evaluation. TAP does not allocate a second independent ring,
and its phase width is prefiltered to at least `1.5` field texels. This keeps
clicks legible across quality tiers while costing less than two separately
evaluated ring packets. Koi wakes and petals retain the compact symmetric
packet.

The field accepts at most `8`, `10`, or `12` active disturbances by quality
tier. A fixed typed scratch buffer selects the strongest candidates without
per-frame object mapping or sorting, then encodes world center, radius, width,
secondary radius, amplitude, and bounded trailing-wave strength. These
disturbances change the surface used by yoonseul, reflection, refraction, and
benthic light instead of adding an unrelated bright ring afterward.

The rain ripple budget is not part of this semantic-disturbance cap. Rain has no
per-drop records and therefore cannot evict a tap, koi wake, or petal impulse.

When `surface_field` is selected, the comparison ring projection receives no
source and stays hidden. When a comparison algorithm is explicitly selected in
Pond Lab, the Pixi presentation layer may project semantic disturbances into
comparison-only rings. Those graphics are consumers, never simulation state.

## Caustic Contract

Every product sunlight profile uses `connected_sunweb_v1` through
`ZenWaterConnectedCausticOverlay`. It projects refracted rays from the shared
surface onto actual receiver depth and normals; sunlight profile selection only
changes komorebi styling (`lacyKomorebi` remains specific to `lacy_connected`).
The overlay sits above the static pond bottom and below koi, petals, glimmers,
and surface presentation. The existing koi body draw shares the same receiver
projection. Baked scrolling caustic textures are not allocated, and the
comparison sprite gate is held at zero in the same frame.

`zenWaterConnectedCausticShaderDialect.js` selects the connected overlay pair
from the actual `renderer.context.webGLVersion` passed by the presentation
factory's connected branch. Only numeric `1` and `2` are admitted; invalid or
missing versions fail with `ZEN_CONNECTED_CAUSTIC_WEBGL_VERSION_INVALID`
before superclass geometry, shader, receiver texture or container attachment.
Malformed authored interfaces fail with
`ZEN_CONNECTED_CAUSTIC_SHADER_SOURCE_INVALID`. WebGL1 retains the complete
original source bytes. WebGL2 expresses the same highp vertex/fragment math,
18 combined uniforms and smooth `vTextureCoord` in GLSL300, with existing native
alphabetical locations `aTextureCoord=0`, `aVertexPosition=1` and output 0.
Only the source interface, texture-call spelling and output name change. The
shared receiver equations, six receiver/field reads, shared light-transport
read, quad geometry, SCREEN draw, visibility admission and owned/borrowed
resource lifetime stay the same. Pixi still owns `Shader.from`, compilation,
reflection, context cache and binding; its GLSL300 branch omits the two
attribute binds and second link. The temporary superclass shader retains its
existing disposal. The comparison superclass, koi body and other shaders are
outside this seam. No capability query, compiler override, global mutation or
compile-error retry is introduced. Quality, render ordering and both actual
prime-frame ACKs remain unchanged. Source/native tests protect this contract;
wall-time and pixel evidence remain the canonical QA runner's responsibility.

`ZenWaterBenthicCausticOverlay` remains the shared lifetime/admission superclass.
Its one-tap curvature shader is not selected by active product render plans and
is not a missing-receiver fallback. The connected receiver derives the largest
principal contraction from the symmetric refracted Jacobian in world metric.
It lights the convergence crest, rather than both `abs(det J) = 0` boundaries
of an overfocused bundle. With optical depth scale `s = 48 / worldHeight` and
`c = clamp(maxEigenvalue(I - sym(J)) * 0.8 / s, 0, 8)`,
the response is `1.85 * c^6 / (64 + c^6)`. Compared with the previous fourth-power
response, half brightness occurs at contraction `2` rather than approximately
`1.245`. This suppresses weak converging shoulders and reserves bright coverage
for the crest, preserving its peak and the authored aperture. It is monotone through a fold,
bounded, and zero for flat or wholly expanding bundles. A saddle can focus
along its contracting axis. No second outline or separate halo is drawn.
The response follows the existing field clock, with one shader owner for bottom
and koi body and no independent pattern or noise. This is an authored light-ridge
approximation, not inverse-area irradiance or full forward photon accumulation.

The `causticsEnabled` debug control still owns whether caustic light is visible.
It gates the benthic field consumer for the default path and the comparison
sprite pass only for explicitly selected Pond Lab algorithms. Field demand is independent of surface-filter
demand: a caustic-only debug/world policy still generates the canonical field
and renders the benthic overlay without attaching the surface optics filter.

### Connected receiver projection and propulsion coupling (2026-09-27)

The product overlay uses five shared surface samples and one scene-lifetime
bathymetry receiver sample in a single bottom draw. The receiver is a
`48 x 32 RGBA8` texture (6,144 pixel bytes), derived once per scene from canonical
bathymetry. The receiver projection introduces no extra pass, worker, moving
noise field, or surface-field owner. The shared canopy transport map below has
its own bounded refresh draw. One center sample corrects the flat refracted inverse
lookup; four axial neighbor samples estimate the Jacobian of the same refracted
surface. Axis-aligned derivatives preserve a unit flat-surface area independently
of sun bearing and viewport aspect. Only focused bundles add light; no consumer
creates a separate moving pattern or a positive-curvature divergence mask.

The refracted flat sun direction is computed once per overlay update from the
same normalized world sun. Bottom normals point toward increasing depth because
bottom elevation is negative depth. Projected travel uses the same
`ZEN_POND_SHADOW_DEPTH_WORLD_UNITS = 48` conversion as physical object shadows,
normalized by world height. The former `0.8 * worldHeight` travel was unrelated
to scene depth and pushed entire strips of inverse samples outside the field.
The `0.8 / s` ridge contrast gain is an authored response only; it never changes
the ray path, source location, bathymetry or physical depth.
One inverse correction is limited to .012 UV per axis. The sample aperture uses
scene-height units: `0.0055 + depthPhase * mix(0.010, 0.018, aperturePhase)
+ turbidity * 0.007`, where `depthPhase = smoothstep(0.25, 1.0, depth)` and
`aperturePhase = clamp(0.5 + 2 * surfaceHeight, 0, 1)`. Surface height is decoded
from the existing center sample's B channel. The aperture breathes with the
broad water surface rather than introducing an independent patch mask or clock.
UV offsets and Jacobian cross terms account for world aspect; only a minimum
1.25-field-texel footprint depends on texture resolution. Longer or murkier paths
favor broader creases, with varying local scale instead of exposing the finest
glint waves as a uniform wire grid. Shared field detail and reflection/glints
are unchanged. The projection retains five field plus one receiver reads and
does not add a surface solve.
This remains a bounded local gather approximation. It does not accumulate all
forward ray arrivals or fully reconstruct visibility at folded/discontinuous
receiver geometry; no photon map or extra caustic render target is implied.
The existing direct-light strength/gates and SCREEN composition remain; cloud
transmission is not applied a second time. Beyond the scene-lifetime receiver,
no new texture, render target or pass is allocated. Night and disabled/suppressed
caustics submit zero bottom draws and zero caustic field/receiver reads; existing
koi body draws continue with their caustic binding inactive. The bottom receiver
is destroyed by the overlay; the shared field is borrowed and destroyed only
by its own owner.

`model/koi/zenKoiSurfaceWake.js` receives each motion model's existing power phase,
then admits one packet per stroke/departure and fades amplitude continuously with
fish depth. It feeds the existing `koi_wake` source, so these packets disturb
reflection/refraction and the caustic ray geometry together. It changes no water
field resolution, cadence, rain kernel or quality-owned disturbance budget.

## Canopy-to-water light transport (2026-09-28)

`ZenWaterLightTransport` borrows the exact admitted `canopyLayouts`, direct/sky
atlases, per-crown projection, wind, gap control and light shares from
`ZenCanopyLightTransferMesh`. It does not regenerate foliage or solve shadows.
After the existing canopy update, `pixiWaterPresentationRuntime` refreshes a
256-long-edge RGBA8 target only if source identity, textures, pose, reveal or
bounds changed. The map includes a canopy/entry guard outside the visible crop.
Disabled, not-yet-admitted or zero-light canopy is the explicit identity state;
an admitted but malformed source throws `ZEN_WATER_CANOPY_OPTICAL_SOURCE_INVALID`.

`zenWaterLightTransportShaderDialect.js` selects the representation from the
existing renderer's actual `context.webGLVersion` before any target, geometry,
shader or mesh allocation. Only numeric `1` and `2` are admitted; missing or
invalid versions fail with `ZEN_WATER_LIGHT_TRANSPORT_WEBGL_VERSION_INVALID`,
and malformed authored interfaces fail with
`ZEN_WATER_LIGHT_TRANSPORT_SHADER_SOURCE_INVALID`. WebGL1 retains the exact
generated six-crown source pair. WebGL2 expresses the same highp math and
12 combined uniforms, including `uLayout[6]` and `uCrownProjection[6]`, in
GLSL300. It makes the existing alphabetical attribute locations
`aTextureCoord=0`, `aVertexPosition=1`, smooth `vUv` and output 0 explicit.
Only interface declarations, texture-call spelling and output name change.
Native Pixi `Shader.from` still owns compilation, array reflection, context
cache and binding; its GLSL300 branch skips two attribute binds and the second
link. Target sizing, quad/NONE draw, change-only refresh, borrowed canopy
arrays/atlases and owned map lifetime stay unchanged. No capability query,
global mutation, compiler replacement or compile-error retry is introduced.
Quality, render order and both actual prime-frame ACKs stay unchanged. Focused
source/native tests protect this contract; canonical QA owns latency/pixel
evidence.

R/G encode current/broad prefiltered direct transmission; B encodes broad sky
transmission. Crown overlaps multiply transmission. A stores the luminance of
the existing final canopy RGB transfer, including admitted opacity exactly once.
The original full-resolution canopy mesh and both 512-square atlases are unchanged.
One refresh draw reads at most two atlas samples for each of six crowns, skipping
samples outside crown support; no ray march, readback, live blur or second clock.
The target occupies at most 256 KiB. Source atlases remain canopy-owned.

Caustics read beam transmission at the corrected refracted **entry**, not at the
floor pixel. Depth and turbidity blend R/G (`0.65 * depthPhase + 0.35 * turbidity`)
to approximate an expanding angular/spatial footprint. This is not an assertion
that water scattering recreates sharp caustics in complete shade. Existing path
attenuation still removes focused energy. Yoonseul reads the surface point and
uses a smaller roughness-dependent aperture blend. Sky reflection and diffuse
rain response use B, so a blocked sun cannot hard-cut the sky hemisphere.

Each optical contribution replaces the generic final-composite attenuation via
`visibility / max(0.08, A)`, bounded at 2.5. This is an achromatic compensation
for the existing post-composite shade, not an extra source of light. It avoids
double darkening and lets displaced caustics cross a projected canopy boundary.
It is approximate under colored transfer, SCREEN blending and tone mapping;
there is no claim of exact radiometric energy conservation.

Active canopy adds two light-map reads per caustic pixel (entry and receiver),
one shared read per surface pixel (sky and glints), and no new koi draw. Bottom
total is eight reads; body total is seven optical reads plus pigment/form.
Inactive canopy adds zero map reads. Runtime probes report actual map allocation,
refresh draw, lookup counts and guard-expanded surface dimensions. The water
runtime owns/destroys the map; all three consumers borrow it.

This models overhead canopy, not full scene visibility. Submerged rocks retain
their existing bottom cast and must not turn off surface glints. Plant casts,
inter-object submerged occlusion, reflected foliage color and multiple-path
transport are not newly simulated. Physical foundations: [GPU Gems caustics](https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-2-rendering-water-caustics),
[PBRT area lights](https://pbr-book.org/4ed/Light_Sources/Area_Lights), and
[PBRT transmittance](https://pbr-book.org/4ed/Volume_Scattering/Transmittance).
The packed apertures and composition compensation are project-specific heuristics.

## Dynamic koi receiver

`waterSurfaceField/zenWaterCausticReceiverShader.js` owns the five-tap refracted
projection shared by `ZenWaterConnectedCausticOverlay` and `ZenKoiMaterialMesh`.
The bottom retains its single bathymetry receiver lookup and SCREEN blend. The
body uses its existing form texture, current normalized fish depth and pond UV
coordinates before camera transforms, and adds pigment-modulated light within
its existing draw. It does not sample the bottom caustic output or pin its depth
to bathymetry. Cross-section relief uses the common shadow depth-unit conversion;
the shared optical projection uses the same 48-world-unit depth conversion,
guarded field mapping and authored principal-contraction response as the bottom receiver.

`pixiWaterPresentationRuntime.runEffectsPass` publishes a stable borrowed
`koiCausticReceiver` only for an active connected-caustic consumer. Entity/fish
sync forwards it in the same frame. Night, disabled caustics and explicitly
selected comparison consumers deactivate the binding; they do not spawn a new
water field for fish. Active body coverage adds five field reads and, when canopy
is active, two shared transport-map reads, with no body-specific draw/target.
The body owns its uniforms but borrows the field and
small solar arrays. Disable/dispose clears texture references; only the water
field owner destroys the shared texture. `zenKoiSolarMaterial.test.js` protects
camera independence, receiver depth updates, array reuse and borrowed lifetime.

## Failure Policy

`surface_field` is the persisted default and has no runtime fallback.

- missing renderer: `ZEN_WATER_SURFACE_FIELD_RENDERER_MISSING`
- missing frame identity: `ZEN_WATER_SURFACE_FIELD_FRAME_CONTRACT_MISSING`
- missing required channel: `ZEN_WATER_SURFACE_FIELD_CHANNEL_MISSING:*`
- missing water cause: `ZEN_WATER_SURFACE_CAUSE_MISSING:*`
- missing worker wind cause: `ZEN_POND_WORKER_WIND_CAUSE_MISSING:*`
- invalid weather authority: `ZEN_WEATHER_AUTHORITY_*`
- invalid weather event clock or regime: `ZEN_WEATHER_EVENT_TIME_INVALID:*`,
  `ZEN_WEATHER_REGIME_UNHANDLED:*`
- invalid scene environment projection: `ZEN_SCENE_PRESENTATION_ENVIRONMENT_MODE_INVALID:*`
- invalid disturbance source: `ZEN_SURFACE_DISTURBANCE_SOURCE_INVALID:*`
- malformed encoded disturbance: `ZEN_WATER_SURFACE_FIELD_DISTURBANCE_INVALID:*`
- missing bound texture: `ZEN_PIXI_WATER_SURFACE_FIELD_REQUIRED`
- canonical field sent to comparison filter: `ZEN_PIXI_CANONICAL_SURFACE_FIELD_FILTER_REQUIRED`
- stale shader variant: `ZEN_PIXI_WATER_SURFACE_SHADER_VARIANT_STALE`

The runtime must not silently substitute phase noise, comparison GGX, ring sprites,
or baked caustic tiles for any of these failures.

## Release V1 Tuning Contract

`pond/contracts/zenPondTuningContract.js` owns contract version `1` and the
strict `projectZenPondTuningV1` / `requireZenPondTuningV1` boundary.
`tuningStore.js` persists only `zen_pond_tuning_v1`, with `surface_field` as its
explicit default. Missing state may bootstrap that payload. A malformed payload,
wrong contract, or predecessor shape fails loudly; runtime does not rewrite it
or infer a surface mode. Pond Lab comparison algorithms are explicit current
selections, not storage compatibility paths.

## Observability

Worker water telemetry exposes:

- `surfaceFieldActive`
- `surfaceFieldReady`
- `surfaceFieldCausticsEnabled`
- `surfaceFieldCausticStrength`
- `surfaceFieldWidth` / `surfaceFieldHeight`
- `surfaceFieldCadenceTier`
- `surfaceFieldDisturbanceCount`
- `surfaceFieldDisturbanceCandidateCount`
- `surfaceFieldDisturbanceDroppedCount`
- `surfaceFieldRainIntensity`
- `surfaceFieldRainRippleTargetBudget`
- `surfaceFieldRainRippleCellCount`
- `surfaceFieldRainCandidateEvaluationsPerPixel`
- `weatherRegime`
- `weatherEventScheduled` / `weatherEventActive`
- `weatherEventId` / `weatherEventKind` / `weatherEventPhase`
- `weatherEventProgress` / `weatherEventPhaseProgress`
- `weatherFrontWeight` / `postRainWeight`
- `guaranteedRainDay`
- `surfaceFieldSubmitMs`
- `surfaceMaterialRoughness`
- `surfacePhaseRate`
- `yoonseulFocus`

`surfaceFieldSubmitMs` measures CPU submission time, not asynchronous GPU time.
Visual GPU comparisons still require the same debug toggles and a fresh worker
reload.

## Canonical Paths

- `src/themes/plugins/zen/pond/renderers/pixi/waterSurfaceField/ZenWaterSurfaceField.js`
- `src/themes/plugins/zen/pond/renderers/pixi/waterSurfaceField/zenWaterSurfaceFieldShader.js`
- `src/themes/plugins/zen/pond/renderers/pixi/waterSurfaceField/zenWaterSurfaceFieldShaderDialect.js`
- `src/themes/plugins/zen/pond/renderers/pixi/waterSurfaceField/pixiWaterSurfaceFieldConsumerShader.js`
- `src/themes/plugins/zen/pond/renderers/pixi/waterSurfaceField/PixiWaterSurfaceFieldFilter.js`
- `src/themes/plugins/zen/pond/renderers/pixi/waterSurfaceField/zenWaterSurfaceFieldFilterShaderDialect.js`
- `src/themes/plugins/zen/pond/renderers/pixi/waterSurfaceField/ZenWaterBenthicCausticOverlay.js`
- `src/themes/plugins/zen/pond/renderers/pixi/waterSurfaceField/ZenWaterConnectedCausticOverlay.js`
- `src/themes/plugins/zen/pond/renderers/pixi/waterSurfaceField/ZenPondBenthicReceiverTexture.js`
- `src/themes/plugins/zen/pond/renderers/pixi/waterSurfaceField/zenWaterCausticReceiverShader.js`
- `src/themes/plugins/zen/pond/renderers/pixi/ZenKoiMaterialMesh.js`
- `src/themes/plugins/zen/pond/runtime/core/zenWaterSurfaceCause.js`
- `src/themes/plugins/zen/runtime/environment/zenWorldEnvironmentAuthority.js`
- `src/themes/plugins/zen/runtime/environment/zenWorldEnvironmentKernel.js`
- `src/themes/plugins/zen/runtime/environment/zenWorldEnvironmentTimeline.js`
- `src/themes/plugins/zen/runtime/environment/zenWorldWeatherAuthority.js`
- `src/themes/plugins/zen/runtime/environment/zenWorldWeatherEventDirector.js`
- `src/themes/plugins/zen/pond/runtime/core/zenPondEnvironmentProjection.js`
- `src/themes/plugins/zen/pond/runtime/surface/zenSurfaceDisturbance.js`
- `src/themes/plugins/zen/pond/renderers/pixi/pixiWaterPresentationRuntime.js`
- `src/themes/plugins/zen/pond/renderers/pixi/pixiWaterSurfaceFilter.js`
- `src/themes/plugins/zen/pond/renderers/pixi/scene/pixiSceneWaterEffectsPass.js`

## Guardrail

`tests/themes/zenWaterSurfaceFieldShaderDialect.test.js` protects the actual-context
dialect boundary, the byte-identical supported GLSL100 source, fixed GLSL300
interface/identifier adaptations, field-equation parity and the original Pixi
generator's attribute/reflection/link behavior. The dialect owner reads no GL
capability query: WebGL1 uses the existing source and WebGL2 declares version300,
explicit attribute locations `aTextureCoord=0`/`aVertexPosition=1`, and one
location-zero fragment output. Both stages retain highp. Missing or unsupported
context version fails before field allocation. Pixi remains the compiler,
reflection, cache and resource owner; there is no compile retry or cross-dialect
fallback. Field quality, physical cause, uniforms, pass/draw budgets and the two
real-frame startup ACK remain unchanged. The native version300 generator skips
its additional attribute bind/relink; actual wall-time and pixel parity require
runtime evidence rather than an assumed saving from the omitted call.

The separate surface consumer dialect is owned by
`zenWaterSurfaceFieldFilterShaderDialect.js`. Water presentation passes the actual
`renderer.context.webGLVersion` to `PixiWaterSurfaceFieldFilter` at creation.
WebGL1 retains `super(null, selectedFragment)`, the public native default vertex
and byte-identical production/optics fragments. WebGL2 expresses that same vertex
UV/crop math and authored highp fragment equations with attribute
`aVertexPosition=0`, smooth `vTextureCoord`, `texture()` and fragment output 0.
Production retains all 35 combined uniforms; optics retains its 40. Native
`Filter`/`Program`/`ShaderSystem` retain apply, linking, reflection, cache and
lifetime. Missing/unsupported versions fail before native allocation with
`ZEN_WATER_SURFACE_FIELD_FILTER_WEBGL_VERSION_INVALID`; malformed conversion
interfaces fail with `ZEN_WATER_SURFACE_FIELD_FILTER_SHADER_SOURCE_INVALID`.
There is no capability query, compile-error retry or cross-dialect fallback.
Resolution, field bindings, material/light calculations, pass admission and the
two actual prime-frame ACK remain unchanged. Complete source parity, native
reflection, Filter apply and borrowed/owned texture lifetime are protected by
`tests/themes/zenWaterSurfaceFieldFilterShaderDialect.test.js`; the worker lifecycle
test protects the two-prime contract. Native bind/relink omission alone does not
prove latency or pixel equivalence; canonical QA supplies that evidence.

`tests/themes/zenWaterSurfaceField.test.js` protects quality-scaled resolution,
the two-candidate procedural rain budget, semantic disturbance selection, and
analytic derivative contracts. `tests/themes/zenSceneEnvironmentAuthority.test.js`
protects weather-mode isolation, dry-overcast/rain separation, and midnight
continuity. `tests/themes/zenWeatherEventDirector.test.js` protects behavior
independence, the five-day rain-front guarantee, full-day onset distribution,
bounded rain-cell durations, dry lulls, cross-midnight ownership, and numeric
continuity. `tests/zenMainSceneProjection.test.js` and
`tests/themes/zenClassicHomeRendererLifecycle.test.jsx` protect the shared
pond/bonsai environment-mode handoff, while
`tests/themes/zenPixiBonsaiRuntimePresentation.test.js` protects weather-only
bonsai shading without cultivation-state mutation.
`tests/themes/zenWorldEnvironmentContract.test.js` protects signed authority
identity, deterministic world sampling, source-stamped Pond/Bonsai projections,
separate dynamic/bake invalidation domains, and the typed worker interpolation
fast path.
`tests/themes/zenWaterLayerMapping.test.js` protects the dedicated default
filter and rejects legacy noise, mask, and full-scene caustic ownership in that
shader. `tests/themes/zenWaterPresetRegression.test.js` now measures the
canonical field presentation resolver rather than the legacy yoonseul model.
These run under `npm run check:zen:pond-visual-contract`.

## User-selected presentation cost (2026-09-06)

Home defaults to `full`. Explicit `balanced` retains 60fps output while reducing
field reference edge to 320 and water-filter resolution to .68 (full: 384/.82).
Power saving (`low`) uses 30fps output and 256/.55; fish simulation stays 60Hz.
`zenRenderQuality.js` owns graphics/frame axes and `zenSignalScannerConfig.js`
projects the field/ambient policy. `pixiWaterPresentationRuntime` applies filter
resolution at creation/reuse. Sun, curved receivers, canonical wave cause and
material strength remain the same; fewer pixels and bounded candidates provide
the reduction. No alternate low-quality shader, automatic tier or field owner.
