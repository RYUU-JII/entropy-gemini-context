# Zen Canopy Light Transfer Spec

- Status: Active
- Owner: Zen pond visual runtime
- Last validated against code: 2026-10-05
- Path policy: current-only
- Canonical for: Zen pond canopy geometry, komorebi illumination, and rendered visibility
- Companion: `docs/architecture/themes/zen/zen-water-surface-field-architecture.md`

## Visual Contract

코모레비는 가장자리 수관의 잎틈을 통과한 직사광이다. 중앙의 열린 물과
가장자리의 그늘을 함께 유지하여, 틈빛이 주변 잎그늘과 대비되어 읽혀야 한다.
밝기 관계는 같은 재질에서 `열린 직사광 >= 잎틈 직사광 > 잎그늘`이다.
잎 하나하나가 화면의 주제가 되지 않도록 윤곽은 부드럽게 뭉개고,
수관 안쪽으로 갈수록 차광이 사라지는 비대칭 사이드 비네트로 표현한다.
이 비네트는 수관의 차광 분포이며 별도의 검은 화면 오버레이가 아니다.

밝은 물 위에 독립적인 SCREEN/ADD 빛무늬를 얹지 않는다. 이미 직사광을
받는 바탕에 그림자 구멍을 뚫은 다음 빛을 더하면 동일한 직사광을 두 번
계산하게 된다. 수면의 윤슬과 caustic은 별도 물리적 소비자가 표현한다.

## Ownership

| Concern | Owner |
| --- | --- |
| Immutable leaf geometry and visibility texture bake | `src/themes/plugins/zen/pond/renderers/pixi/waterEffects/textureBake/canopy.js` |
| Model identifiers, texture budget, maximum occlusion | `src/themes/plugins/zen/pond/contracts/zenPondCanopyMaterial.js` |
| Common-light consumption and diagnostic transfer samples | `src/themes/plugins/zen/pond/renderers/pixi/waterEffects/passes/zenCanopyLightTransfer.js` |
| One-draw MULTIPLY light transfer | `src/themes/plugins/zen/pond/renderers/pixi/waterEffects/passes/ZenCanopyLightTransferMesh.js` |
| Authored shader source and actual-context dialect selection | `src/themes/plugins/zen/pond/renderers/pixi/waterEffects/passes/zenCanopyLightTransferShaderDialect.js` |
| Cached per-height solar projection, penumbra selection and cropped raster support | `src/themes/plugins/zen/pond/renderers/pixi/waterEffects/passes/ZenCanopyLightTransferMesh.js` |
| Common light dispatch, wind sway, gap admission, actual visibility | `src/themes/plugins/zen/pond/renderers/pixi/waterEffects/passes/pixiWaterEffectsCanopyPass.js` |
| Resource binding and update dispatch | `src/themes/plugins/zen/pond/renderers/pixi/waterEffects/layer/createPixiWaterEffectsLayerCore.js` |
| Diagnostic DTO projection | `src/themes/plugins/zen/pond/renderers/pixi/waterEffects/layer/probeBuilder.js` |

`directSunlight`, `diffuseSkylight`, and `sunDirectionX/Y/Z` arrive through the
canonical environment lighting channels. `pixiFrameChannels` resolves
`shadowLight` once through `runtime/zenPondShadowProjection.js`; canopy, decor
and koi consume that same light snapshot. Cloud transmission has already been
applied to `directSunlight`; the canopy consumer must not multiply it again or
reconstruct it from cloud coverage. Missing/non-finite lighting is an explicit
contract failure.

## Geometry and Texture Contract

One seeded leaf geometry produces two `512 x 512` textures. The seed belongs to
scene geometry and is unchanged by clock, sunlight, weather, or quality updates.
Each atlas contains two `256 x 256` islands and four `128 x 128` islands.
Six independently seeded branch masses form four unequal corner crowns and two
sparse side accents. Their sizes are `0.62 / 0.50 / 0.36 / 0.32 / 0.30 / 0.28`
times the shorter dimension of canonical `visibleWorldBounds`. The material
contract owns each viewport anchor, outward offset, edge orientation and density.
Clock changes do not choose or relocate anchors. Three heights (`0.028`, `0.047`,
`0.072` of that extent) give separate branch masses different solar displacement
and softness. These are independent silhouettes, not repeated copies of one mask.
The centre remains open and breaks between crowns avoid a continuous dark border.
Resize changes vertex placement, preserving atlas identity, seed and square grain.

All crowns use the same world-space leaf-length ranges: `0.022–0.034` of the
shorter visible dimension for layered foliage, `0.018–0.029` for lacy foliage.
The smaller crown has proportionally fewer leaves rather than miniature grain.
Leaf opacity is `0.38–0.72`; connected spine segments feed short secondary twigs
instead of every branch radiating from one root. Four irregular apertures per
cluster replace circular punched holes.

Direct penumbra endpoints are baked at `0.008` and `0.022` of that world extent,
converted separately to each island's texel scale. Unpunched and perforated
silhouettes receive matching blur after holes are cut. Four data channels store
both endpoints in one texture, so solar softness adds no texture reads or live
blur. The common projection's height/reach penumbra selects a smooth blend of
the endpoints. Higher branches and longer casts soften more; nearby branches
retain more detail. This is a bounded material approximation, not a full optical
simulation or an altitude-controlled opacity gain.

Both masks also receive the same baked coverage envelope. Distance from the
nearest outer atlas boundary fades in over `0.014 * extent` to avoid a hard
rectangle when the sun projects a crown inward. Distance into the crown from
its anchored sides fades out smoothly between `0.045` and `0.19 * extent`.
Each crown uses its declared edge signs; side accents have one anchored side.
Its density scales the same envelope for direct and sky. This only attenuates the
existing foliage; it cannot create shadow in an empty mask. The direct envelope
is inside the projected texture, so it follows the same solar displacement as
the leaves. No fixed screen-space clipping term can pin a direct cast in place.

- `canopyDirectOcclusionTexture`: unassociated RGBA **data**, uploaded through
  `BaseTexture.fromBuffer(Uint8Array, ...)`. RG are crisp unpunched/perforated
  silhouettes; BA are soft unpunched/perforated silhouettes. Alpha is the fourth
  independent mask, not coverage. Never upload these bytes through a canvas,
  which would premultiply RGB and lose mask information. The shader interpolates
  RG/BA, then the komorebi control selects unpunched or perforated occlusion.
  It never adds a separate light sprite.
- `canopySkyOcclusionTexture`: alpha encodes the same unpunched foliage after a
  broader blur of `0.024` times the shorter visible dimension (about `17.9 px`
  at `744 px`). This represents obstruction of the diffuse sky; narrow
  direct-light gaps do not open the entire hemisphere. The existing native
  Canvas blur/readback produces `ImageData.data`; after the unchanged coverage
  alpha operation, `BaseTexture.fromBuffer` retains that same Uint8ClampedArray
  as RGBA8 without copying it back into a canvas. Both the full-resolution
  canopy mesh and `ZenWaterLightTransport` sample only its alpha channel.
  Its native BufferResource uses unassociated-alpha upload (`NPM`); RGB may
  differ from the former CanvasResource premultiplication path and is not an
  optical input. The immutable shared cache retains the array for native
  context reupload and releases it through the existing `destroy(true)` path.
  This removes one `putImageData` call and the retained sky Canvas carrier;
  blur geometry, alpha bytes, UV orientation and the two-texture budget remain
  unchanged. Full native CPU Canvas alpha-oracle and native BufferResource
  identity/lifetime tests protect this representation. This copy removal does
  not establish a GPU queue, first-link or whole-boot speed improvement.

Both textures use linear sampling without mipmaps, preserving island boundaries
and the exact source memory budget. UV clamping uses half-texel-inset bounds.

The CPU coverage bake separates the same monotonic smoothstep envelope by axis.
Each crown uses two transient Float64 x-axis lookup arrays and double y-row
factors, then stores `min(edgeX, edgeY) * max(innerX, innerY) * density` in the
existing Float32 image with the original multiplication order. At 512-square,
the six crowns allocate 16 KiB of lookup arrays in total (4 KiB for the largest
crown); they add no retained cache or texture. Both coordinates retain the
original `right - left` span denominator and the y loop retains `bottom - top`,
including odd-size atlas rounding. Geometry, Canvas drawing/blur, direct RGBA
packing, sky alpha, shaders, pass admission and quality are unchanged. Independent
original-distance full-image byte checks and native CPU Canvas seeded layered/
lacy pack checks live in `tests/themes/zenCanopyLightTransfer.test.js`.
Allocation-inclusive isolated Node CPU timing does not establish a Chrome GPU,
first-link synchronization or whole-boot speed improvement.

The two supported model IDs are `canopy_branch_visibility_layered_v6` and
`canopy_branch_visibility_lacy_v6`. They change leaf and gap grain while preserving
the same illumination contract. Both share `canopy_direct_diffuse_transfer_v1`.
The botanical seed role is `canopy-branch-aperture-v6`, keyed independently by
crown ID. This model revision intentionally changes composition. Within v6,
the persisted `sceneGenerationKey` and model select the same geometry across
mounts; only scene reroll changes it.

The actual admitted `renderer.context.webGLVersion` travels through water
presentation, layer core, sprite state and sprite factory to the mesh. WebGL1
retains the authored source bytes passed to native `Shader.from`. WebGL2 selects
GLSL ES 300 with the same authored `highp`, projection/attenuation math, two atlas
reads, typed uniforms, geometry and draw. Its five attribute locations preserve
Pixi's alphabetical native layout (`aAtlasBounds` 0, `aCrownIndex` 1,
`aProjectionScale` 2, `aTextureCoord` 3, `aVertexPosition` 4); four smooth varyings
and fragment output 0 preserve the interface. Native Pixi retains compilation,
reflection, program caching, binding and lifetime. Invalid versions fail with
`ZEN_CANOPY_LIGHT_TRANSFER_WEBGL_VERSION_INVALID` before layer texture acquisition
or mesh geometry allocation. Source selection adds no GL query, compile-error
retry, target, draw or change to pass admission. The dialect's native call
reduction does not establish a wall-time gain; canonical QA measures that
separately. Full source parity and native Mesh construction/render/disposal are
covered by `tests/themes/zenCanopyLightTransferShaderDialect.test.js`.

## Illumination Transfer

For each color channel, the incident budget is the sum of the canonical direct
sunlight, tinted by `lightChannels`, and diffuse skylight, tinted by
`[0.78, 0.90, 1.00]`. The direct occlusion response is bounded at `0.62`; broad
sky occlusion is bounded at `0.22`.

```text
beam = directSunlight * lightColor
sky  = diffuseSkylight * skyColor

directShare = 0.62 * beam / (beam + sky)
skyShare    = 0.22 * sky  / (beam + sky)

transfer = 1 - directOcclusion * directShare - skyOcclusion * skyShare
output   = existingMaterial * transfer
```

If the incident budget is exactly zero, both shares are zero and the transfer
is the identity. This is the defined unlit state, not missing-state recovery.

The mesh is MULTIPLY blended. Open pixels produce white (`transfer = 1`), so the
shared mesh has no effect outside the leaf geometry. Its opacity controls
coverage of the transfer, including parent scene reveal alpha, exactly once.
There is no additive output, no opaque dark vignette, and no per-frame texture
rebake. Water optics additionally borrows the admitted placement and uniforms
through `ZenWaterLightTransport`: one at-most-256-long-edge target is refreshed
only when canopy presentation changes. It records narrow/broad direct, sky and
existing composite transfer for entry-aware caustics and separate surface
reflection. It neither changes this full-resolution mesh nor takes ownership
of its atlases. See `zen-water-surface-field-architecture.md` for its independent
allocation/lookup budget and approximate double-shading compensation.

## Solar, Weather, and Night Behavior

The sky footprint remains attached to the composed canopy. Only the direct UV
is displaced away from the canonical sun, using `projectZenPondShadow` for each
crown's height. Reach is bounded at `0.12 * extent * sqrt(height / 0.072)`;
nearby branches retain shorter reach even at the horizon. High sun shortens
displacement. The shared solar3 world orientation maps east to screen left,
south to top and west to right, so a northern reference day reads morning left
through noon above to evening right. Astronomy, altitude, latitude and seasons
remain unchanged; all directional lighting consumers share this orientation.
Fixed sky UV and direct UV share only a small wind sway.
Sampling outside an island returns zero occlusion and cannot bleed into the
other atlas island. This is an explicit viewport-framing canopy, while physical
rocks, plants and koi retain world positions. See
`zen-pond-shadow-and-viewport-spec.md` for the common height/camera boundary.

When a cloud obscures the sun, direct gap contrast and direct leaf contrast
weaken together. Diffuse canopy shade remains because the sky is still partly
obstructed. At zero direct light, the gap and adjacent leaf share the same
broad diffuse response. Cloud coverage does not independently darken this pass.

At night, no direct sunlight means no komorebi. If the environment supplies a
nonzero diffuse sky channel, the same bounded diffuse shade can remain. When
both incident channels are zero, the mesh is hidden and it does not invent a
nighttime light source or a standing black overlay.

## Lifecycle and Diagnostics

The pass calls `setLightTransfer` on the single mesh. That method sets uniforms,
alpha, and visibility together, using the actual admitted light shares. Generic
sprite alpha-visibility helpers do not overwrite this mesh's visibility.
Disabling the layer hides that same mesh. There is no independent
`komorebiSprite` whose alpha can diverge from its rendered visibility.

- `komorebiActive`: the mesh is visible and admitted direct gap contrast exceeds
  `0.001`.
- `komorebiAlpha`: rendered direct gap contrast, not emitted opacity.
- `komorebiMaximumAlpha`: the `0.62` direct occlusion bound, shared by both models.
- `canopyTransferModelId`, `canopyDirectContrast`, `canopyDiffuseContrast` identify
  the actual transfer and its two contributors.
- `canopyOpenTransfer`, `canopyGapTransfer`, `canopyShadeTransfer` expose unit-mask
  RGB reference samples. They are mathematical reference ratios, not pixel
  measurements or measured on-screen brightness.
- Texture coverage and gap/foliage counts report the baked geometry.
- `komorebiTextureCount/Size/RawTextureBytes` report the shared canopy's two
  512-square textures and 2 MiB allocation. Cache hits retain geometry metrics
  while reporting zero new texture-build time.
- `canopyDrawCount` reports the one visible shared mesh. `komorebiDrawCount`
  reports that same draw only while direct gap contrast is active; these counts
  must not be added. Worker telemetry, client metrics, and debug summaries
  preserve the same allocation, geometry, visibility, and transfer fields.
- Hidden reasons distinguish unavailable texture baking, a disabled effect,
  a hidden canopy mesh, and absence of direct illumination.

## Budget and Acceptance

- Two existing 512-square RGBA textures: `2 MiB` uncompressed source budget.
- One mesh, ten quads (40 vertices / 60 indices), one draw and two texture reads
  per covered pixel. Each corner uses two disjoint L-support strips; side accents
  use one. Support includes the maximum solar/wind displacement, clips to the
  viewport, and omits the provably empty interior before rasterization. No discard,
  scissor mutation or per-frame vertex allocation is required.
- Projection uniforms retain their typed arrays. Six bounded projections and
  softness selection are recomputed only when the common sun vector or visible
  extent changes. UV projection happens in the vertex shader, not per fragment.
- No second water-surface field, private animated normal, or new moving light
  noise. Geometry textures are baked only at the existing scene boundary.
- Open water retains its input brightness; gap brightness never exceeds open
  brightness; direct sun produces clear gap-versus-leaf contrast.
- Removing direct light removes that contrast while preserving mild diffuse
  occlusion. Removing all incident light hides the mesh.
- Toggling/revealing effects updates actual rendered visibility and diagnostics
  coherently; parent alpha never becomes a second attenuation multiplication.
- Sparse canopy updates consume all elapsed tick time since the preceding
  update. The 14-frame opacity response remains approximately 233 ms at the
  canonical 60 Hz clock; changing pass cadence cannot lengthen the fade.
  Disabling the canopy clears its pending elapsed time without rebaking masks.
- A general material `fullUpdate` does not admit canopy or atmosphere work.
  Each reads its own cadence flag; initialization, explicit `forceUpdate`, and
  effect gate changes apply immediately. At the fixed 60 Hz clock the canopy
  admission remains every 8 slots (7.5 Hz), independent of the every-6-slot
  material update. Atmosphere also accumulates skipped elapsed time so cadence
  cannot slow its drift. Cloud reflection now belongs to the surface filter;
  its layer flag admits diagnostics, not a retired cloud draw pass.
- The canonical water cadence owner (`runtime/core/zenCadenceProfile.js`) admits
  work when the previous-to-current render interval crosses a phased cadence
  bucket. A renderer may skip the exact 60 Hz slot without starving the pass.
  `pixiSceneWaterEffectsPass.js` advances this previous clock every render,
  independently of sampled diagnostics. First admission, clock reset, and
  explicit refresh run once; a long gap never triggers multiple catch-up draws.
  This interval policy is scoped to water passes and preserves their phase
  offsets; ambient simulation and other clock consumers remain separate owners.
- Focused numerical and lifecycle coverage lives in
  `tests/themes/zenCanopyLightTransfer.test.js`. Browser appearance remains a
  separate canonical QA check and cannot be inferred from unit ratios alone.
