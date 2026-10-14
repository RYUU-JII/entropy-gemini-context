# Zen Koi Locomotion and Fin Presentation

- Status: Active
- Owner: Zen pond simulation and Pixi presentation
- Last validated against code: 2026-10-05
- Path policy: current-only
- Canonical for: Koi locomotion, behavior and roster lifecycle, event-family momentum, spine articulation, and fin/body presentation ownership
- Scope: pond attention/living behavior, event-family momentum, default event spine, fin and body presentation

## Owners

| Concern | Canonical owner under `src/themes/plugins/zen/pond/` |
| --- | --- |
| Algorithm choice and inactive-rig disposal | `model/koi/koiDynamics.js` |
| Identity-stable behavior temperament | `model/koi/zenKoiPersonality.js`, instantiated by `KoiSimulationFish.js` |
| Bounded neighbor queries and companion identity | `model/koi/koiNeighborGrid.js` |
| Click admission and reaction lifetime | `runtime/zenKoiInteractionStimulus.js` |
| Living needs and committed social partner | `runtime/zenKoiBehaviorMemory.js` |
| Approach/linger/leave intentions and steering authority | `runtime/zenKoiBehaviorIntent.js` |
| Behavior clock, intent cache, sleep wake-up and integration handoff | `runtime/systems/zenFishSimulationSystem.js` |
| Event forces, swimming clock, drag, velocity integration | `model/koi/koiEventFsmRuntime.js` |
| Speed/slip safety and locomotion state | `model/koi/koiModelCalibration.js` |
| Standalone curvature research helper (not the default motor) | `model/koi/koiEventBodyFrame.js` |
| Propulsion-phase wake admission and continuous surface coupling | `model/koi/zenKoiSurfaceWake.js` |
| Standalone stroke research helper (not the default motor) | `model/koi/koiEventManeuver.js` |
| Default event spine and restrained head counter-motion | `model/koi/koiEventFsmPose.js` |
| Independent continuous-spine research model | `model/koi/koiContinuousBodyRig.js` |
| Root-attached fin pitch/sweep and articulated tail web projection | `renderers/pixi/pixiKoiFinPose.js` |
| Web pigment, edge translucency and static fin rays | `renderers/pixi/koiTextureCache/bakeFinTail.js` |
| Solar/caustic/moonlit body material and prefiltered body/tail shadow meshes | `renderers/pixi/ZenKoiMaterialMesh.js` |
| Articulated bottom-cast fin quads and shared cold atlas | `renderers/pixi/ZenKoiFinShadowMesh.js`, `renderers/pixi/koiTextureCache/bakeFinShadow.js` |
| View-depth pigment and receiver-distance cast response | `renderers/pixi/zenKoiWaterMaterial.js` |
| Body material source dialect and actual-context validation | `renderers/pixi/zenKoiMaterialShaderDialect.js` |
| Bounded night presence and canonical moonlight projection | `renderers/pixi/koiFishMaterialExecutor.js`, `renderers/pixi/entitySync/pixiSceneFishSync.js` |
| Shared refracted caustic receiver sampler | `renderers/pixi/waterSurfaceField/zenWaterCausticReceiverShader.js` |
| Live water-to-body texture/uniform handoff | `renderers/pixi/pixiWaterPresentationRuntime.js` |
| Pigment and packed cross-section/reflectance bake | `renderers/pixi/koiTextureCache/bakeBody.js` |
| Packed shadow coverage and per-column support bounds | `renderers/pixi/koiTextureCache/packShadow.js` |
| Autonomous shadow-only invitation presentation | `renderers/pixi/zenKoiShadowSentinelPresentation.js` |
| Shared visible-water registration anchors and selected-shadow waiting target | `contracts/zenPondRegistrationPresentation.js` |
| Resize translation of both body representations | `runtime/zenPondSpatialReflow.js` |
| Protected-site membership stabilization | Dashboard Home `zenProtectedSiteKoiSelection.js`, `useZenProtectedSiteKoiCandidates.js` |
| Serialized live roster reconciliation | `runtime/zenFishRosterEntitySync.js` |
| Opaque bank entry/exit destinations and full-body completion | `runtime/zenKoiRosterTransit.js` |

The default remains `event_fsm_life_v1`. V1 and V2 are independent Pond Lab
algorithm identities, not migration versions. Their event integrator is shared;
V2 retains its own continuous body rig and appendage hints.

## Site identity, admission and bank crossings

### Hover and selection presentation

`PixiKoiFish.updateFocusGlow` owns the existing shared soft-disc sprite. Registered
fish use a compact ellipse aligned to the rendered head/tail axis. Hover eases in
lightly; selection separately eases its stronger alpha and small extent change,
so changing hover to selection does not jump at the same timestamp. Daytime tint
is pale ivory; canonical `nightDepth` continuously projects silver-blue tint and
a bounded night emphasis. The attached water pass still owns illumination.
This is interaction presentation, not a new lunar irradiance or direction.

The existing `ZenPixiSceneRenderer` monotonic `renderTimeMs` crosses entity sync
to the fish renderer. Fade and restrained pulse use that clock, never frame
counts, another timer or wall time. Missing light/time or reversed time fails
explicitly when the sprite is present. The invitation retains its broad pearl
geometry and independent attend cue; the first-site reveal retains its existing
receipt/lifetime. No new texture, draw, filter, selection owner or worker message
is introduced. Hover, domain lock and selected UID admission stay in the existing
worker interaction/controller contract.
The public worker input API forwards `hoverTarget` on the existing
`SET_INPUT_STATE` payload, including its explicit null clear; it must not drop
the external rail intent between the controller and worker hit-test owner.

The existing renderer metrics expose aggregate `focusHoveredCount`,
`focusSelectedCount` and `focusGlowVisibleCount`. The isolated pressure-rail
journey samples these through its existing on-request debug metrics bridge to
prove that native hover/selection reaches a rendered fish. These are bounded
diagnostic observations, not a per-frame DOM or worker hover-anchor stream.

New domain locks received by the existing worker input handler admit one quiet
`tap` packet marked `selectionCue` at that fish's current head/tail midpoint.
Unchanged locks, hover and dismissal do not emit packets; the worker consumes
the direct-click/controller lock handoff so a pointer tap is not doubled.
This handoff is transient input deduplication and resets with the worker; it
does not own selection. Retiring or unrepresented domains emit no cue.
The existing surface event queue and simulation clock release the weaker packet
within approximately 1.05 seconds. The Pixi ripple owner uses one shared thin
ring, tinted ivory to silver-blue by canonical frame `nightDepth`, below the
lily-pad layer. Its fixed origin does not track a swimming fish, reveal it
through foliage, trigger behavior stimuli, or allocate a new timer, message,
texture family or overlay layer. Source telemetry remains in the `tap` bucket.

Each explicit Main registration ACK names a particular `invitationEntityId` and assigns that shadow's live pose and
UID to that site and admits a single worker-local
`runtime/zenFirstSiteKoiReveal.js` receipt. Only remaining registration places admit a new domainless shadow with
the existing stroke/momentum bank crossing; its instance UID seeds a varying
boundary and lane. A matching provisional site from an earlier roster sync is
removed before assignment, preventing duplicate bodies. Assignment preserves any
already-started entry transit and is consumed once by receipt ID. Exhausting the
finite budget assigns its last shadow even though no invitation remains desired.
Other site arrivals/replacements retain ordinary serialized bank crossings. The existing
Pixi focus halo fades this cue over 4.8 monotonic seconds; repeated roster syncs
do not restart it, a later domain cannot inherit it, and no new particles,
movement event, persistent progression state or texture is introduced. Renderer
metrics expose the currently visible `firstSiteRevealCount` for bounded QA.
The read-only `invitationEnteringCount` distinguishes a successor crossing the
bank from a resident; render-visible counts alone include offscreen entrants.
`shadowSentinelCount` counts invitations rendered as shadow coverage without a
material body. The sentinel's coverage shares the existing body/tail shadow
geometry; its moving fins are translucent black masks, with no pigment detail.
It is an authored autonomous silhouette at zero projection offset, not a solar
cast from an invisible body, so its opacity stays readable at night and when
ordinary cast shadows are disabled. Assignment retains the UID and live spine
while pigment emerges with a 1.2-second smoothstep. Body/tail material alpha and
fin pigment blend from the existing silhouette; the container stays opaque.
Coverage projection and opacity ease into the ordinary cast shadow, including
a fade to zero when casts are disabled. The 4.8-second focus cue stays separate.
`PixiKoiFish.prepareFirstSiteMaterial` advances the existing texture cache's
explicit preparation lease by one body/form/tail/fin bake stage per rendered
frame. Until the complete bundle commits, the retained silhouette keeps swimming;
only then does the pigment clock start. Cancellation, disposal or a bake error
releases partial resources through the existing disposal owner. Completed bundles
retain the same keys, bytes, reference counting and LRU admission. This is a
worker-local pending presentation, with no optimistic site commit, extra Worker,
canvas, timer, animation loop or alternate renderer. The existing metrics DTO
exposes the minimum `firstSiteMaterialPresence` among active assignment cues.

The unnamed invitation uses `runtime/zenInvitationKoiPresentation.js` for shared
initial spawn/patrol bounds centred above Home's native entry in exposed water. Bank-arriving
successors retain the full pond rectangle after arrival, avoiding a snap into
the initial invitation nook. This worker-local patrol mode is set at spawn and
validated by the bounds owner. Its attend glide and hover halo use the same
body-contour `containsPoint` test as ordinary koi hover/click, without a separate
proximity radius. The selected registration shadow also attends while its native
editor is open. Forces, wall avoidance and velocity integration remain in the
existing motor. Its idle restrained halo deepens on body hover instead of borrowing
the selected-site state.
Worker hit-test feedback carries the invitation action and exact `clickEntityId`.
The existing renderer event channel emits `invitation_membership_changed` only
when physically admitted shadow identities change; it carries no domains,
settings or persistence. Native entry and uncommitted popup continuation choose
only these actual identities, never a shadow still waiting in the serial queue.
The scanner keeps an unboxed native registration entry inside the exposed water
for keyboard access. An active `garden.first_site` guidance claim displays its
short instruction there; the anchor presenter acknowledges the claim only after
its visible frame paints. Later entries become visible on invitation hover or
native keyboard focus. There is no separate corner capsule or hover card.
`contracts/zenPondRegistrationPresentation.js` owns the normalized visible-water
fish/editor anchors shared by Home's native editor and worker movement. The
native editor and hint use its `editorTopCss` expression, which reserves 260 CSS
pixels below the entry with a 76 CSS-pixel minimum when the viewport is short.
The pure viewport resolver applies the same expression using actual CSS height,
and the worker maps its upward-adjusted fish anchor into the visible world
rectangle. Its layout snapshot refreshes only when CSS viewport dimensions
change; logical world height is never mistaken for CSS height. The
existing `SET_INPUT_STATE` carries an explicit nullable
`invitationRegistrationEntityId`; its worker-local input ref targets only that
admitted shadow. The simulation passes its bounded waiting circuit through the
existing formation steering input and eases activity as it arrives, preserving
the existing motor, spine and momentum. A pending bank transit finishes before
waiting movement takes control. Once invited out of its initial nook, the shadow
retains the full pond patrol on cancellation, avoiding a clamp back to narrow
spawn bounds. Closing the editor clears the input identity.
While the native editor is open the water hit surface is inactive; the rest of
Home stays live. Inputs never follow per-frame fish poses. These are transient
presentation states; registration still uses the canonical command and retains
the same live fish identity on its matching ACK.
During First Vision replacement, Home includes the empty pond's invitation in
the current roster under the opaque cover, while its interaction action remains
locked. Unlocking after uncover changes admission only, not population. The
initial invitation must not enter later through the ordinary live bank-crossing queue.
New qualified-use grants explicitly use `invitationArrivalMode=bank`, while
previously admitted grants reconstruct `resident`. Their scene-frame contract
declares `deferredInvitationCount` and reports actual `pendingInvitationCount`.
The exact roster signature remains mandatory; only missing bank invitations may
be deferred, never registered site fish or First Vision members. This allows
dashboard reveal before the later serial arrivals, while startup minimum count
excludes the explicitly deferred shadows. No alternate renderer or timeout bypass
is introduced.

Each registered site retains its domain-derived appearance identity and stable
behavior temperament. Home builds the full registered-site candidate pool from
canonical settings and current stats, then holds at most five presentation
members. This local selection state retains only domain IDs and admission clocks;
it does not own pressure/protection facts or reintroduce a removed registration.
The public `domainCandidates` frame remains the worker roster authority.

Normal replacement requires 60 seconds of residence plus a challenger that has
continuously exceeded the weakest eligible incumbent for 15 seconds. The margin
is both 20% and 60,000 weighted-pressure milliseconds. Focused domains are retained
while registered. Removed registrations are dropped from the desired roster
immediately. Retained membership order is stable; current pressure values still
update. The hook owns one deadline timer only while a review is pending and the
Zen Home surface is active, releasing it on deactivation/unmount. A zero-pressure
tie never causes rotation for novelty.

The worker reconciles the latest desired entries against its existing entities.
`fishRef.rosterLifecycle` owns only pending worker presentation reconciliation and
spawn inputs; it is neither persisted nor a second roster source. Retained entities
keep their UID, motor phase and momentum. Obsolete pending requests are replaced
by the newest roster, while a committed crossing finishes without reversal.
Outdated site bindings are released immediately, including fish awaiting their
turn to leave; these visual-only entities no longer represent current site facts.

Only one entry or exit is in flight. The departing fish follows its current course
toward a committed bank. Its head, every spine joint and appendage clearance must
cross that bank before the entity is removed. An incoming fish is constructed
outside a domain-seeded bank/lane, facing inward, and swims until its body clears
the bank before ordinary behavior resumes. The existing integrator and body/fin
oscillators perform the motion; there is no position tween, timer despawn or alpha
fade. The transit owns a temporarily expanded movement rectangle on its one bank
and a navigation heading; ordinary fish retain their normal bounds. The event
executor finishes existing strokes and does not admit new random events during
the crossing. Transit wakes the fish and retains a bounded cruise activity floor.
Normalized bank/lane coordinates are resolved against current viewport bounds on
every step, preserving committed crossings through resize.

Departures and arrivals interleave so the number of simulated fish never exceeds
the greater of the old/new admitted counts. For the product Home this is five.
The first population is composed inside the pond to preserve first-frame boot
readiness, and the existing invitation-to-first-site ceremony reuses its fish.
First Vision's authored formation spawn remains separate. An explicit world reset
clears the reconciliation state; a renderer-only rebuild may retain it.

All roster fish, including queued exits, are opaque. The unused presence-memory
helper does not append lingering fish to the live roster. Entity-sync no longer
schedules opacity fades; the shared optional opacity transition utility still
distinguishes its unstarted `null` from frame zero for non-roster callers.

Appearance overrides continue through the existing appearance map → roster
projector → worker normalization → `setAppearanceProfile` path. CPU canvas textures
are baked on a Pixi cache miss, including while a newly admitted fish is offscreen.
Live entry admission therefore spreads new bundles across separate crossings.
Body cache keys include fin style as well as actual pigment/pattern/form inputs;
pressure, rank, position, phase and opacity do not rebake pigment. Released bundles
remain eligible for bounded LRU reuse (220 body / 220 shadow keys); references are
released on renderer disposal, with final GPU destruction deferred by its owner.

Reroll commands already update the per-domain seed/palette through the typed Zen
model repository, without changing behavioral identity. This is a development
capability, not yet a durable product customization contract: the existing
appearance key is explicitly discardable, expires after 45 days, has a 3,000-entry
cap, and is excluded from profile snapshot export/import. Product reroll must add
a durable typed customization owner and snapshot contract before promising that
user-chosen appearances survive cache eviction/reset. Do not silently make the
derived appearance cache a durable source of truth.

## Attention and living behavior

Primary pointer-down enters through `app/hooks/useZenInteractionController.js`,
the existing input snapshot/client, and the worker input handler. Right-button
and secondary-pointer presses do not emit taps. The handler maps viewport to
world coordinates once, emits the shared surface tap, performs the existing
selection/action hit test, and pushes one tokenized behavior stimulus. Selection
and invitation actions keep their existing owners. There is no second DOM input
listener, renderer polling path, or direct geometry mutation from input.

Stimuli retain the four-entry/108-tick bound. The fish system admits each token
once, choosing at most two concurrent responders by distance, curiosity, current
fatigue, vigilance and sleep. Reach varies from 236 to 380 world units with the
authored curiosity range; a close tap may startle a timid fish. Direct selection
has priority within the same two-response budget. If necessary, it releases an
older ambient reaction, then an older direct reaction. Repeated nearby taps raise
vigilance without restarting a committed reaction or its motor stroke.

An admitted fish stores one reaction independently of the short surface stimulus.
After a small individual delay it orients, approaches, lingers and leaves along
a curved departure. A startle escapes briefly and then leaves. Phase deadlines
bound even unreachable targets; total lifetime is at most 420 ticks after onset,
followed by a response cooldown. Reaction kind and orbit side are chosen once at
admission, rather than switching between notice/startle at a moving distance
threshold. Reaction activity uses the existing focus wake-up input to sleep,
without selecting or visually locking additional fish.

`steeringAuthority` is an optional bounded intent modifier, default zero. It
attenuates ordinary roam/center direction while an attended target owns movement,
and increases the existing heading filter's response. Life-model intentions own
pointer attraction; the integrator does not add a second unconditional cursor
pull. Boundary and neighbor avoidance remain active. The event integrator owns angular motion and pose: attention supplies intent
rather than setting heading, teleporting the fish or resetting the wave phase.

The neighbor cache contains at most three entries with stable UIDs. A 220-unit
query covers the authored social ranges and reserves one entry for a committed
companion within reach. Two nearest neighbors remain available for avoidance.
The partner, parallel/trailing mode and side persist for roughly 3.5–6 seconds,
then release with a cooldown; losing/removing the partner releases it immediately
at the next behavior evaluation. Companion admission follows increasing UID order
and requires compatible travel direction, so mutual and longer following cycles
cannot form. Side is selected from the animal's current relative position.
The `accompany` phase aligns heading with the companion, uses a 14-unit lateral
spacing band and at most 0.42 radians of lateral trim, and corrects longitudinal
spacing with throttle rather than turning back. It does not reuse a point goal's
tangential linger or reverse-bearing leave. Companion heading smoothing has a
24-behavior-tick time constant. Point-goal position filters likewise integrate
elapsed behavior ticks, preserving their response time at the six-tick cache
cadence. Ordinary micro-goal identity no longer depends on rounded
target coordinates or the random intent-window index; phase durations are fixed
at admission. Presentation formations retain exclusive movement ownership and
clear ordinary attention/social goals.

`behaviorTemperament` is derived from entity identity: curiosity, activity,
laziness, boldness and sociality. The pre-existing randomized `personality`
remains the locomotor variation input for speed/acceleration and sleep profiles.
Changing behavioral temperament must not reroll that random sequence or retune
the already-calibrated cruise. Unbound ephemeral entities use their runtime UID;
no new persisted personality or interaction history is introduced.

Four bounded worker-local need values evolve slowly: vigilance, fatigue,
exploration and social need. Strong turns/bursts build fatigue; rest dissipates it.
Inspection satisfies exploration and time beside a companion satisfies social
need. Vigilance decays after input. These values bias future action choice and
reaction admission; they never multiply the cruise-speed envelope or represent
business risk, health/death, measured metabolism, or user obligations.

The fish system integrates a 60-Hz-equivalent behavior clock from elapsed step
duration. Ordinary intent/need evaluation runs every six ticks; input phase,
focus and formation transitions invalidate the cache immediately. Motion still
integrates on every simulation step. Resize moves stored reaction/micro-goal
coordinates and invalidates the intent cache without resetting phase or needs.
A new fish system explicitly clears its previous intentions before starting a
new behavior clock; fish bodies and motor strokes remain intact. All added state
is bounded and worker-local, with no GPU pass, texture work, or storage write.

## Cruise navigation and momentum contract

The current default V1 uses `koiEventFsmRuntime.js` for direct, smoothed steering
and `koiEventFsmPose.js` for a trailing spine. The standalone curvature/stroke
helpers in `koiEventBodyFrame.js` and `koiEventManeuver.js` are not its active
motor. Their regional contraction, carrier-yield and committed-stroke behavior
must not be presented as controls or guarantees of the running default model.
V2 shares the event integrator and keeps its independent continuous body rig.

One event oscillator drives the swimming wave and propulsion phase. Squared
cosine of the tail-sweep phase supplies two propulsion pulses per cycle. The
phase uses the same core position and spatial wavelength limit as the trailing
pose. This is an authored visual model, not measured koi hydrodynamics.

Ordinary event-family navigation samples five bounded roam candidates when a
route ends and favors useful distance ahead of the current heading. A route's
lifetime accounts for distance and current speed, with a bounded timeout of
360–1200 model ticks. Reaching a body-scaled arrival region selects the next
route before the fish starts orbiting the old point. Formation and committed
bank-crossing headings retain their own owners. Attention still attenuates roam
steering; neighbor and wall avoidance remain active. There is no second constant
pull toward the pond center because the roam destinations are already bounded.

Ordinary autonomous cruise/glide yaw is limited by speed times step duration
divided by turn radius. The nominal radius is 1.35 body lengths in cruise and
1.8 while gliding, capped by available pond dimensions for compact viewports.
Wall proximity progressively restores sharper steering. Manual rudder input
and explicit turn/C-turn events keep their separate response limits. The model
turn cap is applied before heading integration; calibration reports that same
applied angle. This does not claim timestep equivalence for the preexisting
manual/strong-turn executor.

Glide and manual release/brake suppress propulsive drive. Speed calibration
must not inject a minimum-speed recovery in glide, sleep or active braking.
It also must not apply the powered maximum-speed correction during a glide:
coasting inherits the preceding stroke's momentum. Powered modes retain their
speed envelope. Explicit braking remains an integrator force.

Drag scales the **lost** velocity fraction and integrates elapsed model time.
Multiplying retained velocity by a friction multiplier above one is forbidden.
Coasting has positive forward drag at 7.5% of the individual's powered friction
loss plus 0.1% base loss per model tick. Lateral retention is 0.96 per model tick
while coasting; the slip guard also allows a wider, more gradual drift than in
powered swimming. Manual release and autonomous glide use the same coast drag.
These losses remain dissipative and mass-dependent; no continuing propulsion,
speed floor or storage state is added. Velocity calibration runs before position
integration and posing. Boundary resolution can subsequently redirect velocity.

At default size and tuning, the seeded straight release regression retains
about 76% of entry speed after one second and 33% after four seconds. It checks
zero drive, monotonic decay, continued decay to rest, timestep agreement for
straight coasting, curved glide and explicit braking. These are authored
regression bounds, not empirical drag coefficients.

## Articulation and lifetime

The default pose follows each preceding joint using its previous water position,
adds the shared travelling wave and turn counter-bend, and limits local angles
before preserving exact segment spacing. Tail wave memory limits abrupt changes.
`coreSegment`, stiffness and wavelength use the event-family motion ranges
shared with the tuner. This trailing representation is resolution-dependent;
standalone curvature-integral tests do not establish its live behavior.

`eventBodyFrame.centerline` references the displayed `history` in this rig.
Its minimal maneuver record is a presentation/diagnostic shape, not an active
stroke executor. Resize and roster pose transformations must transform aliased
history/centerline points only once. V2 retains its separate rig state. Model
switching and geometry changes remain owned by the existing dynamics and
geometry boundaries. No unbounded trajectory buffer, new GPU work or persistence
is added by the cruise-navigation and drag changes.

## Fin and appearance contract

The shared body silhouette, breed blueprint, color identity and appendage root
geometry remain owned by their existing geometry/material contracts. Pond Pixi
adds root-attached foreshortening to the existing fin sprites: the local +Y web
span narrows during recovery, opens during braking and responds to banking.
Station keeping reduces sweep amplitude while preserving steering authority.
This is a projected planar web, not a new 3D mesh or depth-buffer occluder.

For default event/V1, the caudal sprite follows the physical distal segment plus
at most 0.10 radians of local web continuation. It does not add another yaw-rate
or banking rotation: the articulated spine already contains that maneuver.
Other rigs retain their own tail projection. The V1 caudal web remains a static
sprite; this seam does not introduce independent web deformation or an oscillator.

Fin rays are drawn only during the existing texture bake, clipped inside the
authored web. This adds no sprite, filter, render target, per-frame texture
variant, random pattern reroll or per-frame Canvas drawing. Runtime transforms
continue on the existing appendage cadence, attached to the current body pose.

The pond body now uses one `ZenKoiMaterialRope` in place of the three color,
multiply-shade and screen-highlight ropes. Its two baseline texture reads are pigment
and an opaque RGB data map: signed cross-section normal, up normal and local
reflectance. The map reuses the existing body radius and bake coordinates.
Sparse ginrin response is static and doitsu skin remains smoother; neither
changes the seeded pigment or introduces a shimmer clock.

The live rope cross-axis comes from its existing geometry. Curvature therefore
changes local light-facing direction without another pose solver. Solar direct
shares and direction come from the same `shadowLight` as other pond materials.
The camera does not rotate the sun in model coordinates. A broad wet-skin sheen
uses a fixed multiplication chain; there are no fragment noise loops, normal
map regeneration, extra render targets or full-body blur filters. The half-light
vector is calculated in the vertex stage. Color and projected fin transforms
retain their existing owners. Ordinary bottom casts include four articulated
fin quads in one additional atlas mesh; they reuse those exact transforms and
the existing packed shadow material, without an offscreen receiver pass. The
shared refracted mean sun, view-depth pigment response and receiver-gap softness
are specified in `zen-pond-shadow-and-viewport-spec.md`.

The 2026-10-02 moonlit presentation uses the same body draw and cached normal/
reflectance map. `resolveZenKoiMoonlightPresence` reads required finite unit
`nightDepth`/`moonlight` from the existing frame: `nightDepth * (0.16 +
sqrt(moonlight) * 0.6)`. The first term is authored night readability for the
shikigami presentation, not physical irradiance. World moonlight already includes
phase and cloud attenuation; this projection does not apply another weather gate.
Entity sync enables it only while the canonical surface material pass is attached;
detached/comparison paths explicitly project zero. The mesh scales it by
`1 - normalizedDepth * 0.5`; depth never changes alpha, anatomy or solar light.

One fixed pond-space key `[-0.36, -0.48, 0.8]` gives the curved body a broad
silver sheen and a restrained unlit side. It is an authored presentation direction,
not a moon-position model or a new world light/shadow bearing. The existing live
cross-axis changes the response as a koi bends/turns. A vertex half vector and
fixed multiplication chain replace any need for a sparkle clock, halo emitter,
noise loop, added texture reads, texture bake or render pass. Day presence is
exactly zero. `setMoonlightPresence(null)` explicitly disables it for standalone
callers; malformed active lighting/depth fails. The shared surface pass remains
the single material illumination owner, including fins/tail with their existing
pigment and geometry. Solar shadow and caustic admission remain unchanged.

Connected caustics reuse this body draw as a dynamic receiver. The water runtime
passes one stable, borrowed descriptor after updating the common surface/solar
uniforms and before fish sync. `zenWaterCausticReceiverShader` is shared with the
bottom overlay: one inverse lookup and four refracted projection derivatives,
with identical phase, Snell ratio, footprint, attenuation and strength. Active,
nontransparent body fragments add five field reads (seven total); inactive
night/debug/comparison states skip them. No extra draw, sampler texture, render
target, field update, random phase or texture rebake is introduced.

The receiver uses pond coordinates after the rope's local visual scale/pivot,
before the ancestor camera transform. Fish depth locates the back; the existing
cross-section map adds side depth using `(1 - upNormal) * size * visualScale *
0.22 / ZEN_POND_SHADOW_DEPTH_WORLD_UNITS`, clamped to normalized depth one. The
same curved normal gates incident light. Body depth therefore changes projected
features independently of the bottom. Pigment modulates the added light and
alpha remains unchanged. This is a bounded curved receiver approximation with
an authored projection scale, not volumetric transport or a full 3D body.
Fins/tail retain their existing material. `null` is the explicit inactive binding
for standalone callers; malformed active receivers fail. Fish never destroy the
borrowed surface texture, and disabled receivers release the binding to EMPTY.

The body material source dialect is selected once from the admitted scene's
`app.renderer.context.webGLVersion`. Entity sync forwards that scalar through
`PixiKoiFish` and display creation to `ZenKoiMaterialRope`; missing/non-numeric or
unsupported versions fail with `ZEN_KOI_MATERIAL_WEBGL_VERSION_INVALID` before
texture leases, display/shadow creation or native rope allocation. WebGL1 keeps
the complete authored vertex/fragment inputs to native `Shader.from`. WebGL2
keeps their effective `highp`, 25 combined uniforms, five smooth varyings, all
solar/moonlit/caustic arithmetic and texture reads. It changes only the GLSL300
interface: alphabetical native locations `aKoiAcross=0`, `aTextureCoord=1`,
`aVertexPosition=2`, `texture()` and fragment output 0. A malformed conversion
interface fails with `ZEN_KOI_MATERIAL_SHADER_SOURCE_INVALID`; compile-error
retry, capability queries and source/cache mutation are absent. Native Pixi
retains compiler/reflection/cache, rope geometry, draw, binding and lifetime.
Body/tail shadow source dialects use the separate fixed `koi_shadow` descriptor
in `zenPondMaterialShaderDialect.js`. Display creation forwards the same admitted
numeric version into both shadow constructors, before native rope/quad allocation.
Their WebGL1 pair remains byte-for-byte intact; WebGL2 preserves highp, five
combined uniforms, smooth `vUv`, the one packed-mask read and all weight/alpha
math, with `aTextureCoord=0`, `aVertexPosition=1` and output zero. Shadow program
caches remain native and shared between the rope/tail while their uniform groups,
geometry, mask leases and destruction retain their existing separate owners.
The source change adds no draw, texture, scheduling or quality adjustment and
preserves the two actual startup prime frames. Full source parity, native
75-to-71-operation difference, cache, render and resource lifetime are checked
by `tests/themes/zenKoiMaterialShaderDialect.test.js`; runtime latency/pixel
evidence remains the canonical QA owner's responsibility.

See the companion shadow contract for the three-band coverage cache, end padding
and C-turn support bounds. Body geometry, extra cross-axis attributes and shadow
support transforms still update when the fish moves. Texture generation remains
at appearance/shape cache misses; sun, pose, depth and opacity do not rebake masks.

## Verification

Live cruise/glide regression owner: `tests/themes/zenKoiCruiseMomentum.test.js`.
It checks real event-model coast/brake steps and seeded life-system trajectories.
The retained expressive-stroke/curve tests below concern the standalone research
helpers; their exact shape/impulse expectations are not a PASS for the current
trailing default. The full historical stroke suite was not validated by this change.

- Actual simulation: phase agreement, displacement after calibration, bounded
  straight-swim head/tail motion, exact segment lengths, steering and braking.
- Expressive turns: both directions across four starting wave phases, posterior
  actuation during fast yaw, retained large-angle turns, and exact agreement
  between applied and reported yaw. Large head-to-tail angles alone are not a
  quality criterion: anterior curvature and normalized tail excursion must have
  useful amplitude as well as upper bounds through sustained steering, reversal,
  sizes and joint counts. A rigid forebody is not an acceptance criterion.
- Curve shape: at most one significant curvature sign reversal in cruise over a
  full stroke and the wavelength range; bounded reversals during maneuvers;
  equivalent curves across joint counts; no inheritance of local prior folds.
- Transmission and mass: regional contraction peaks share the loading window,
  followed by departure thrust. Upward-facing left/right routine and C-turns
  must show opposing head/chest and tail/chest arm rotations during loading,
  then posterior follow-through. Faster forward travel clears retained course
  sooner; a resting fish relaxes it without adding yaw or thrust. Rotation preserves the anterior mass
  point before velocity integration. Static curvature supplies no angular
  impulse, return strokes do not force reverse yaw, and cruising corrections do
  not retrigger finite gestures or suppress the carrier. A held steering bias
  requires actual wave phase advance to turn. Inflection checks ignore near-straight cancellation using
  curvature normalized by body length, independent of the joint count.
- Coasting: non-increasing speed without flow; no injected drive or speed floor.
- Lifetime: coefficient reuse, parameter invalidation, model switch and resize.
- Actual Pixi transforms: root attachment, mirrored neutral fins, recovery
  foreshortening, braking spread and bank asymmetry.
- Offline Canvas/Pixi component images and CPU pose benchmarks are component
  evidence only. Full-product appearance/FPS requires canonical browser QA.

## Biological reference and limits

[Wu et al. (2007), routine koi turns](https://pubmed.ncbi.nlm.nih.gov/18055627/)
observes body/tail bending during the first turning stage followed by a return
stroke; much of the heading change happens during the initial bend. The old
"complete preload, then rotate" description was too literal.
[Yang et al. (2009)](https://www.jstage.jst.go.jp/article/jbse/4/1/4_1_67/_pdf)
separates body deformation from whole-body motion and examines single-beat turns
and cruising turns. These motivate the model's structure. The envelope, pivot,
delay, limits and force gains remain authored visual parameters, not coefficients
fitted to these experiments. Ordinary pond turns are not escape fast-start data.
[Spierts and van Leeuwen (1999), carp C/S starts](https://research.wur.nl/en/publications/kinematics-and-muscle-dynamics-of-c-and-s-starts-of-carp-cyprinus/)
informs the separate sharp-turn gesture. The authored 30% anchor and impulse
gains do not claim to reconstruct a measured mass distribution or wake.

The reduced representation also draws on the distinction between amplitude,
wavenumber and travelling/standing components in
[Complex modal analysis of the movements of swimming fish](https://www.sciencedirect.com/science/article/pii/S016521251830009X).
The present implementation is a prescribed, low-dimensional curvature model,
not a chain of independently solved muscle torques or an elastic fluid solver.

## Propulsion and surface interaction

All three current locomotion families publish their own stroke, power, lateral
sweep sign and powered/coasting state into the fish-owned `surfaceWake` record.
`zenKoiSurfaceWake` consumes it only after the new tail pose commits. Event V1
uses the same tail-sweep stroke as propulsion and the finite maneuver's departure
impulse; V2 and the CPG/hybrid comparisons publish their explicit model signals.
There is no independent wake oscillator, random spread or repeating timer source.
The sampler admits a rising power crossing with hysteresis and a twelve-tick
minimum ordinary-packet spacing. A sharp maneuver suppresses ordinary packets
until the single departure crossing. Coasting/braking cannot emit even while
residual velocity is high. Suppressed/deep strokes still advance the latch, so
resurfacing cannot replay old power. This does not modify velocity or body pose.

Surface amplitude couples continuously to normalized fish depth, with full
coupling through .06 and a cubic fade to zero at .55. Impulse carries the squared
coupling because the field derives amplitude through its square root. Only the
koi-wake source allows zero impulse/amplitude; the tap and petal minimum remains.
The existing shared field, semantic source telemetry, finite packet lifetimes
and quality-owned selection budgets are unchanged. These are small radial wave
packets behind the moving tail, not a fluid simulation or a new particle layer.
