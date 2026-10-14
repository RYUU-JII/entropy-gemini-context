# Zen Water Surface Field

- Status: Active
- Owner: Zen pond Pixi water presentation runtime
- Canonical for: the world-space surface state consumed by yoonseul, optional refraction, semantic disturbances, and benthic/koi caustic lighting

`ZenWaterSurfaceField` renders one aspect-preserving low-resolution texture before
the pond world pass with one texture-free mesh draw. Its channels are the surface
contract:

- `R/G`: signed world-space slope
- `B`: signed height
- `A`: signed curvature/focus signal

The field reads only authoritative physical frame channels and presentation-free
`zenSurfaceDisturbance` models. It computes spectral and ring height, slope, and
curvature analytically in one field evaluation. Quality policy owns a long edge
of 256, 320, or 384 texels and a disturbance budget of 8, 10, or 12.

`zenWaterSurfaceFieldShaderDialect.js` selects the field's shader pair once from
the actual Pixi `renderer.context.webGLVersion`, before field resources are
allocated. WebGL1 retains the exact GLSL ES 1.00 sources. WebGL2 uses the same
field equations in GLSL ES 3.00 with explicit attribute locations matching
Pixi's existing name order (`aTextureCoord=0`, `aVertexPosition=1`), a location-zero
output and explicit highp in both stages. Only stage interfaces and the reserved
identifiers `sample`/`active` are adapted. Missing/invalid context version fails
explicitly; no context probe or compile retry is added. The public Pixi compiler,
reflection/cache/binding and resource lifetime remain authoritative. Its native
GLSL300 path omits the additional attribute bind/relink. This changes neither
the field math and full effects nor its quality, draw budget or startup readiness.

The ambient spectrum has nine analytic carriers. Three broad bands mix incident
and reflected motion with signed travel ratios `0.45/-0.50/-0.55` and phase
scales `0.40/0.46/0.54`; their amplitudes preserve expected individual height
variance. This is an authored basin response rather than an actual bank-boundary
reflection solve or fluid current vector. The former `30.8` middle carrier is
split into `25.7/31.9/39.2` crossings, with travel ratios `0.86/-0.79/0.73` and
phase scale `0.78`. Its expected unbent independent-space/time height and slope
variances are preserved, while the fourth-frequency-moment curvature proxy
increases approximately `10.59%`. Those moment constraints do not guarantee
equal finite-frame or optical brightness. The finest `53.8/82.1/126.7` bands
retain their amplitudes and phase scale `1.0`, so their glint support is retained.

Every band scales the same shared `uTime`, including its carrier, curved-front
travel, and slow turnover. Rain and semantic disturbance clocks are unchanged.
The middle split raises the low-resolution analytic evaluation budget from
seven to nine; texture allocation, texture fetches, draws, and passes are unchanged.

Rain uses the canonical `energy_efficient_v1` field model. It keeps two
procedural grid candidates per field pixel and quality-owned target budgets of
16, 24, or 36 rings; the model does not own grid sizing, quality policy, or
render cadence. Rain intensity at or below `0.015` exits the rain kernel before
cell hashes are evaluated.

Each active cell derives an event phase and impact mass from its existing
temporal and position hashes. Mass varies lifetime, maximum radius, progressive
energy loss, and amplitude; event phase varies birth time and ring width. The
ring expands with a bounded polynomial travel curve, loses energy throughout
its lifetime, diffuses in width as it travels, and enters a terminal fade at
80% of normalized age. The rain kernel uses no `exp` or `pow` evaluations.

Semantic tap, koi-wake, and petal disturbances also disperse their packet width
as they propagate. The explicit tap-ring projection derives its trailing crest
spacing from the same phase wavelength used by the surface-field shader, so the
packet opens over time instead of preserving a fixed pixel gap. A disturbance
commits one zero-energy settled sample before runtime compaction.

The consumer reuses its existing field sample and adds a bounded diffuse-sky
visibility drive when rain is active, so overcast rain remains legible without
rain sprites, another draw, or another texture fetch.

Yoonseul uses the canonical `orthographic_scatter_v1` consumer model. The
top-down pond evaluates the specular crossing with a `0.94..1.0` top-view blend
so the central Home crop does not pin highlight energy to one screen edge. A
bounded analytic GGX coverage shoulder (`0.20..0.38` roughness,
`0.34..0.24` unfocused-to-focused weight) broadens separated glint support
without another field sample, texture fetch, or draw. The sharp core and
coverage shoulder use the same surface normal and actual sun/view half-vector;
there is no independent finite-facet population. The exact model ID and
bounds are owned by
`contracts/zenWaterSurfaceFieldYoonseulModel.js` and are carried through the
filter probe, worker telemetry, runtime-client metrics, and debug summary.
That model also owns the brighter crossing response: luminance `0.008..0.12`,
specular gain `0.52`, peak compression `1.8`, and crossing gain
`0.018 + 0.024 * abs(curvature)`. Coverage width is retained so the existing
wave-shaped fragments remain legible; no point mask or independent clock is added.
Oblique sunlight also reveals the existing GGX coverage shoulder where the
actual wave reflects more than the flat surface under the same sun/view pair.
The ratio crosses at `1.6..4.5`, solar obliqueness at `0.18..0.76`, and shared
curvature at `0.006..0.024` (above RGBA8's neutral `1/255` floor). The bounded
gain `0.085 + 0.020 * abs(curvature)` still consumes actual solar radiance,
`NoL`, drive and canopy transport. One extra GGX reference evaluation adds no
texture fetch, draw, independent animation, or physical-field change.

Sky reflection remains independent of the solar highlights. A fixed clear-sky
color mixes with the existing world cloud field sampled at `reflect(-V,N)`;
there is no directional clear-sky gradient. Fresnel remains small in top view.
Night retains the existing moonlit environment/material adaptation, while
direct-sun highlights disappear when solar radiance is zero.

`PixiWaterSurfaceFieldFilter` samples the field for yoonseul, reflection, and
optional refraction. Every product sunlight profile uses
`ZenWaterConnectedCausticOverlay` (`connected_sunweb_v1`) in a layer above the
static pond bottom and below dynamic entities. This is independent of canopy
styling: only `lacyKomorebi` remains specific to the `lacy_connected` profile.
`ZenWaterBenthicCausticOverlay` remains the shared lifetime/admission superclass;
its one-tap curvature shader is not an active product algorithm selection or a
missing-receiver fallback.

The surface field owns only the refracting cause: the overlay projects those
rays onto a scene-lifetime `ZenPondBenthicReceiverTexture` built directly from
the canonical bathymetry field. The `48 x 32 RGBA8` receiver contains 6,144 pixel
bytes and encodes bottom depth, bottom normal, and semantic receiver coverage
without recovering geometry from pond color pixels. Five surface-field samples
estimate the refracted ray-bundle area: one inverse lookup correction and four
axis-aligned samples. Optical depth uses the canonical 48 world units per
normalized depth unit, divided by scene height. The single field has an external
guard at unchanged interior density, mapped by `zenWaterOpticalDomain.js`.
No screen-edge visibility mask removes incoming light. The symmetric Jacobian is converted
to world metric before taking its largest principal contraction. Flat or wholly
expanding bundles add no focus; a saddle can focus along its contracting axis.

The shared shader lights a single convergence crest with
`1.85 * c^6 / (64 + c^6)`, where `c` is principal contraction times the authored
contrast gain `0.8 / opticalDepthScale`, clamped to `0..8`. Contrast gain does not
change transport distance.
The stronger threshold reduces the bright area of weak converging shoulders
while retaining the peak, single crest and existing world-space aperture.
It no longer lights both determinant-zero boundaries of an overfocused bundle.
This bounded authored ridge response is not full forward photon accumulation.

One receiver fetch anchors direction, attenuation, and softness to the pond
bottom. The aperture radius is `0.0055 + depthPhase * mix(0.010, 0.018,
aperturePhase) + turbidity * 0.007` in scene-height units, with a minimum of
1.25 field texels. `depthPhase = smoothstep(0.25, 1.0, depth)` and
`aperturePhase = clamp(0.5 + 2 * surfaceHeight, 0, 1)` uses the already sampled B
channel. Local crest scale varies with broad water height and receiver depth;
the surface/reflection field retains its fine detail. The projection adds no
taps, noise, clock or pass. The bottom upward normal uses positive depth
gradients. Active bottom lighting
therefore costs one draw with five field reads plus one receiver read per pixel.
When canopy is admitted, `ZenWaterLightTransport` supplies two additional shared
map reads: soft beam transmission at the refracted entry, and generic canopy
transfer at the receiver to avoid double shading. One small 256-long-edge RGBA8
target reuses the canopy's admitted placement, atlas and pose; refresh occurs only
on changed state. Surface optics shares one map read for narrow solar and broad
sky response. See the Active architecture's canopy-to-water transport contract
for footprint, allocation, composition limits and shadow scope.
Night/off and daylight suppression submit zero caustic draws and texture reads.
The overlay owns and destroys the receiver texture; it only borrows the dynamic
surface texture, which is destroyed by `ZenWaterSurfaceField` alone.

`zenWaterCausticReceiverShader` owns that common five-tap projection.
`ZenKoiMaterialMesh` also consumes it within the existing body draw, using fish
depth and its cached curved cross-section instead of the bottom receiver map.
The water runtime forwards the shared texture and light state to entity sync;
there is no additional fish draw, texture, render target, field owner, worker,
or clock. Active body coverage adds five field reads to its existing pigment/form
pair, plus two borrowed light-map reads when canopy is active. Night/off and suppressed states keep the normal body draw but skip caustic
reads and unbind the borrowed field. Fish disposal never destroys the shared
water resource.
`PixiWaterSurfaceFilter` exists only for explicitly selected Pond Lab comparison
modes; it
rejects `surface_field` instead of acting as its runtime owner or fallback.

Missing renderer, frame, or required channel state is an error. The runtime does
not substitute phase noise, comparison GGX, sprite ripples, or tiled caustics.
