# Zen Sentinel Flare Render Pipeline

- Status: Active
- Owner: zen theme architecture, nudge runtime
- Last validated against code: 2026-10-02
- Path policy: current-only
- Canonical for: Zen nudge protocol render ownership, site furin/global sentinel renderer split, global sentinel concept canon, and worker sequence ownership

## Intent

Sentinel Flare has two protocol experiences:

- `site_furin`: a local site allowance boundary presented by the canonical Furin SVG,
  recorded site-use intervals, cumulative Catch, and an explicit Leave/Continue choice
- `global_sentinel`: a budget-triggered simulation crash where the page/world
  boundary is exposed and slim shadow koi attempt to resynchronize the user

The protocols share the host/session/lifecycle composition, with an explicit
division of render ownership:

```text
SentinelProtocolHost.start
  -> Site: host_dom / furin_svg
     -> createZenFurinPresentation + SiteFurinReflectionView
  -> Global: extension_frame_worker
     -> NudgeExtensionFrameWorkerRuntime
     -> src/pages/nudge-render-host.html
     -> src/apps/nudge-render-host/main.js
     -> nudgeSwarm.worker.js
     -> NudgeSwarmEngine
     -> drawNudgeProtocolSceneBackground + drawNudgeEntity + drawNudgeProtocolSceneForeground
```

The page host owns DOM, copy, ritual state, lifecycle, and terminal outcomes.
Site uses the shared Zen Furin vector/physics and host visible-frame clock; it
never activates a koi worker. For Global, the extension-frame host owns the
iframe bridge and OffscreenCanvas transfer, while the selected worker owns
entity simulation, hit testing, canvas background/effects, adaptive quality,
and low-frequency render diagnostics. This division is not a worker fallback.

## Concept Canon

Sentinel Flare is not a warning popup. It is a diegetic interruption that helps
the user detach from the original content loop while the intervention runs.

The worldview canon is owned by
`docs/architecture/themes/artifacts/sentinel-flare-activation-spec.md`. Renderer
work should express that canon without promoting it into a global Zen-theme
philosophy. In particular, the web is not framed as evil, and sentinels are not
villains. The conflict is about where agency and rhythm sit inside a tilted web
ecology.

`site_furin` is the chime protocol. The shared Furin descends above committed
site-use intervals; holding its paper gathers those intervals before reflection.
Its current canon is the [Site Furin chime spec](../artifacts/sentinel-flare-site-furin-chime-spec.md).
The earlier koi Return Current implementation is archived and has no active
production, debug, manual-QA, or preview path.

`global_sentinel` is the crash protocol. It is not "the system warning the user
that the budget is over." The budget breach activates a prearranged simulation
fracture. The world begins to crash; shadow koi are sentinel/recovery processes
sent to seal the fracture and resynchronize the user back into the smooth content
simulation.

The global protocol may leave the Zen pond vocabulary. Outside the shadow koi,
its visual language should be explicitly liminal and alien to the ordinary Zen
pond: washi bleaching, white LCD fields, over-corrected paper smoothness,
colored repair seams, glass fractures, rendering glitches, and flat LCD channel
faults. The shared grammar with `site_furin` is ritual pacing, deliberate choice,
and attention detachment; Site's chime does not acquire the Global koi renderer.

Global success means the crash opens enough for the user to resist
resynchronization. Global failure means the sentinels seal the fracture, the
simulation over-corrects, and the original content returns with media paused.
Playback resumes only through the user's own action.

HUD, numeric countdowns, and visible progress meters are diagnostic surfaces, not
the intended user-facing language. User-facing progress should be diegetic:
the Furin and gathered site-use intervals for `site_furin`, bleaching/repair
fronts for sync pressure, and cracks/channel faults for sentinel defeat. The
Site choice controls retain their accessible hold feedback.

The global game contract is owned by
`docs/architecture/themes/artifacts/sentinel-flare-activation-spec.md`. Renderer
work must express that contract instead of inventing a separate score, HUD, or
win condition. In particular, `syncPressure`, `fracture`, and
`sentinelIntegrity` are gameplay meanings first and visual parameters second.

Timing work uses an `armed -> commit` model at the content entry seam. The
protocol may arm as soon as the budget condition is true, but should commit at a
content or attention boundary when possible: reward-entry/continuation clicks,
media transition points, feed/item boundaries, or a short idle pause. A hard cap
is allowed so the protocol cannot be avoided indefinitely. The current v1
implementation commits global sentinel on interactive click/key boundaries,
media pause/end transitions, idle, or cap; richer feed-item boundary evidence can
extend the same seam later.

### Koi Semantics

Active Global koi roles have different visual meanings. Site's bell retains
the painted koi motif from the canonical Furin artifact but has no simulated
koi entity.

- `global_sentinel` repair koi are shadow koi: system homeostasis units biased toward
  repair and resynchronization. They are not angry enemies. They should read as
  inevitable recovery processes exposing repair cores, sealing seams, and
  dissolving back into the content layer on failure.
  `NudgeShadowKoiPolicy` gives both the small koi and the enlarged recovery actor
  a nearly opaque black body and fin roots. The shared Canvas fin renderer keeps
  that density through the inner half and softens only the tips; a narrow black
  penumbra softens the silhouette. Colored perimeter strokes and decorative body
  cracks are absent. This preserves one shadow mass at viewport scale without
  exposing overlapping fin/body shapes as transparent layers. Geometry and
  gameplay cues remain owned by their existing model and interaction renderers.
- The global starter is a colored shikigami accompanied by its apparently
  ordinary shadow. The user's first accepted contact releases the shikigami;
  its surviving shadow reveals the independent system unit. Both roles use the
  same KoiFish model and do not introduce a second gameplay entity or renderer.
- Dashboard koi may carry both body and shadow as an implicit bridge between the
  two reads, but the render pipeline should keep this as an eerie visual hint,
  not explanatory copy.

This distinction is local to Sentinel Flare/Furin presentation. Do not use it to
rename common entity classes, storage fields, protocol ids, or other artifact
families.

## Current Decision

Use the declared `host_dom / furin_svg` strategy for Site and the selected
`extension_frame_worker` with `NudgeSwarmEngine + KOI_SCHOOL` for Global.
Neither path substitutes for the other on failure.

Protocol routing and render ownership live in the scene descriptor from
`src/domains/nudge/protocols/nudgeProtocolScene.js`:

- `renderer.kind + renderer.actorStyle`
- `background.owner + background.mode`
- `spawnPolicy`
- `motionPolicy`
- `interaction.hitMode`
- `statePolicy`
- diagnostics field names

`global_sentinel` must not route to a separate mature pond renderer. That path
made the page-scale global fish read as oversized ink blobs and detached the
global look from the intended slim shadow-koi visual language.

## Active Protocol Scenes

### site_furin

`site_furin` uses the scene declared by `resolveSiteFurinScene`:

- renderer: `furin_svg`, actor style: `artifact_furin`
- background: `host_dom / furin_chime`
- hit mode: `none`; completion mode: `visible_interval`
- progression: arrival, cumulative Catch, condensation, reflection
- choice: Leave after presentation, or Continue after its own visible hold
- cancellation: Catch retains gathered progress; Continue resets; hidden/blur
  cancels intent and hidden time advances neither action

`NudgeOverlayHost` owns the shared overlay and chime controls.
`createZenFurinPresentation` owns the canonical vector/physics;
`SiteFurinReflectionView` projects committed reflection facts and session
progress without a private clock. The host's existing frame loop advances only
presented-visible Site frames and sleeps when the presentation settles.
The chime spec owns full/brief durations, reduced-motion presentation, input
isolation, media hold, receipt/choice ACKs, and exact teardown. No koi school,
worker canvas, synthetic collision, or speed score is part of this path.

### global_sentinel

`global_sentinel` uses:

- renderer: `koi_school`
- actor style: `shadow_koi`
- background: `global_sentinel_field`
- hit mode: `remove_and_dormant`
- completion: simulation collapse

The global protocol retains its own simulation/outcome contract and selected
worker renderer. Site shares the host/session/lifecycle owners, not the canvas.

The canonical read is: the crash device has fired, and sentinels are trying to
repair the page/world boundary. Do not frame this scene as a global-budget alert
or an administrative warning.

Its default scene policy is the `sentinel_field`/`central_field` path: slim
shadow koi spawn inside a white LCD simulation-break panel. Grid lines are
uniform LCD cells; colored horizontal/vertical bands are damaged panel line
defects; crack paths are foreground glass fractures drawn after the koi. They
are not graph/ledger rails or fish movement lanes.

### Global Entry Transition

The global scene starts with a short starter compression while fullscreen settles.
The real initiating gesture requests fullscreen before the asynchronous worker
reservation completes. The reserved click then starts the canonical 18.5-second
revelation: glass impact, shikigami release and shadow separation, independent
departure, LCD sector failure, blackout, false calm, and the giant's recovery pass.

```text
armed commit
  -> awaiting_start colored shikigami with attached shadow
  -> real gesture: fullscreen request + reserve starter hit and normalized point
  -> settle viewport and publish corrected bounds
  -> commit starter at corrected point
  -> glass impact / detached shadow / independent departure
  -> LCD sector failure / black / damaged LCD / false calm
  -> giant return / white backlight wake / fixed-origin recovery / quiet handoff
  -> three action-relative repair_race acts
```

During `awaiting_start`, the real page should still read as present. The active
contract allows native scroll as the only page-liveness signal while blocking
navigation/editing inputs at the protocol gate. Once the starter is accepted,
the gate blocks wheel, touch pan, middle-button autoscroll, and scroll keys over
both the page and ritual surface until the claim is released. Blocked input should feed back
into the starter koi through a body-contained sealing core, polarized seam
contraction, or quiet ripple. Do
keep a persistent tutorial onscreen. One short initial timing hint may remain
through the first two accepted strokes. Accessibility uses
one pointer-transparent semantic button: it receives focus in `awaiting_start`,
updates its label for `repair_race`, and routes Enter/Space or screen-reader
activation to the same serialized worker/main commit contract. Focus is applied
only after the overlay becomes visible and the selected worker runtime has
crossed first-frame readiness; before that the action remains hidden and
disabled. Tab/Shift+Tab remain in this one-control loop instead of escaping to
the covered page. The engine selects
the actual starter or canonical repair-entity center; the host must not guess a
viewport coordinate. Because a screen reader cannot perceive the canvas-only
vulnerability window, semantic repair uses center-window quality `1`. If the
starter handoff has no live repair entity yet, the engine creates the next
canonical entity within the existing spawn budget before committing it. This is
an explicit accessibility accommodation; pointer timing and hit efficiency stay
unchanged.

The first accepted click fixes the activation's crack origin. That coordinate
may drive local rupture, short RGB/scanline twitch, ink disappearance, and the
initial crack impulse. It must not reseed the activation-wide crack skeleton:
`simulationBreakSeed` keeps the geometry stable for the whole run, while the
click point anchors the origin.

The scene is a failed projection, not a room behind a physical screen. Cracks
retain glass-like material: dark tapered cores, directional glints and attached
facets. The shadow has time to separate before electrical failure begins at
2350ms, while the shadow is still departing. Surviving sectors retain the flat live page while other sectors lose
their LCD signal; the whole panel is dark at 6700ms. At 7350ms the damaged LCD
field returns with the original fracture intact; it is not already a completed
white recovery surface. A silent false calm lasts until the giant returns at
9500ms. That one pass writes the white backlight behind its measured head and
seals the fixed glass network behind its measured tail through 17000ms. Both
fronts come from the same retained actor pose, including its bounded address
fault; there is no independent wipe clock. A quiet handoff ends at 18500ms.
The public `WHITE_FIELD` stage identifier marks field availability, not completion
of the white repaint. Crack origin, network scale and seed remain fixed throughout
recovery. Reduced motion omits the giant sweep and discontinuities: dark damaged
field at 7350ms, white/full-fracture field at 9500ms, retained fracture at 17000ms.
It retains discrete sector loss and the opaque cut. The initial and repair
phases contain no spatial opening or tunnel. Only success creates depth from
the existing crack contour. The glass and LCD material owners shade the stable
skeleton; the host prepares the viewport without a competing exposure clock.

The simulation-break damage is seed-driven. A single activation resolves one
`simulationBreakSeed`, then the worker reuses that seed for the whole session so
crack topology, glass chips, light leaks, and line defects stay fixed. Sync
pressure should reveal bleaching, repair, and resynchronization pressure. Koi
defeat should advance stable crack growth and may add sentinel-local dissolution
feedback such as ink scatter. Seed `0` is the canonical visual reference used by
the preview harness; production activations derive a nonzero seed from the
runtime session timing unless an explicit debug seed is supplied.

Implementation, 2026-09-09: the canonical entry is 18500ms. Its emotional
contract is restrained digital cosmic horror: a familiar colored shikigami loses
its cast shadow, revealing an independent system sentinel. The first shadow and
the enormous returning sentinel share the same retained KoiFish actor and sparse
spatial faults. Continuous RGB noise, target swarms and
an ink missile travelling to the crack center are retired.

The public stage boundaries in GLOBAL_SENTINEL_ENTRY_STAGES are the only entry
clock: impact 0, detachment 350, departure 1700, overlapping electrical cascade
2350, shadow exit 6100, opaque power cut 6700, white field 7350, giant return 9500,
repair complete 17000, and handoff 18500ms. The fullscreen owner invokes the browser API in the real input
gesture, then the starter reservation waits for stable viewport bounds before
committing the crack. The entry seed and normalized origin remain fixed.

ZenSentinelInvocation.js composes a retained shadow and an independent colored
shikigami. At the accepted starter commit, NudgeSwarmEngine keeps the original
shadow actor and requests one visual-only fork through
`NudgeShadowKoiEntity.forkRetainedShikigamiPresentation` and
`KoiSimulationFish.forkSentinelPresentationRig`. The native v1 owner explicitly
copies the current pose, body history, fin phases, velocity and mutable motor
memory; it shares only resolved read-only model/style inputs. Unsupported model
or invalid rig state fails with `KOI_SENTINEL_PRESENTATION_FORK_SOURCE_INVALID`
or a named fork rig/frame error. No constructor, global random draw or global
roster UID allocation participates in the fork. Its positive half-integer
`sentinelPresentationSamplingId` occupies a visual-only namespace; its event
randomInt port has instance-local seeded state. The normal actor's motor math,
random stream and sampling identity remain unchanged.

The ally uses a calm 0.28 forward intent through the existing native analog motor
at 60Hz and its natural Zen palette. Shadow hold/recoil/faults do not move or deform that independent
rig. Its visual release runs from 2200 to 3400ms on the same entry elapsed clock;
this does not alter any public entry stage or gameplay timer. The engine updates
at most one ally until 3400ms, pauses it with the existing modal/hidden runtime
loop, and clears it at that boundary, terminal transition, reset or destroy.
It never enters the live hit roster, entity budget or public input route.
At fullscreen starter commit, `NudgeShadowKoiEntity.reanchorGlobalStarterPose`
rigidly remaps the native pose to the accepted contact. History, aliased event
centerline and tail points are transformed exactly once; velocity, fin phases,
wave memory and actor identity are retained. Teleport/reset is not this seam.
`koi/ZenSentinelDeparture.js` commits one outward course along that native heading,
with bounded bursts and address faults. It never steers back toward an overshot
exit, hands the departing actor to roaming, or turns an edge origin inward.
`NudgeShadowKoiEntity.advanceRetainedPresentation` keeps that
same shadow KoiFish through departure and giant return. Both roles use native
body/propulsion/fin math; neither interpolates world positions or pulls a rigid
sprite. The native offscreen arena contains the complete committed run so its
walls cannot reflect the actor before the body and tail leave by 6100ms. Shadow cruise
tuning is restored at departure end. The current three accepted repair acts,
54s/60s game budgets, first-frame handshake and semantic/pointer input contract
remain owned by their existing runtime seams.

The primary 390ms address fault begins at 1880ms: a 65ms held pose, a backward
displacement along the live heading, localized raster slices and a separating
secondary silhouette. A second, weaker 260ms fault occurs at a seeded time in
the later swim. Two bounded bursts interrupt the slower native cruise.
The returning giant retains its paired diagnostic
pulses 650ms into its pass. Reduced motion suppresses held poses, recoil, raster
slices and doubled silhouettes. The actor reference belongs to the
engine session and is cleared on reset; material helpers cannot create actors.

The sequence harness integrates every entry timestep before capture; jumping
the clock alone is invalid evidence for this movement. Its four dedicated fault
beats and native-resolution views cover cruise, hold, backward recoil and split.

GlobalSentinelLcdMaterial.js partitions the display along the first canonical
primary paths. Sectors corrupt at deterministic distinct times; unpainted
sectors retain the actual live page at its original coordinates. The final
foreground cut covers every layer. There is no DOM clone, page screenshot,
perspective face displacement, or opening behind the monitor during entry.

The committed starter impact exposes the complete first glass network on its
first presented frame, including branches attached to the exact primary nodes.
Its tips and contact mark do not lengthen with entry age. The electrical cascade
changes LCD visibility and driver faults, not glass propagation. The dark damaged
field retains that complete network before the giant returns.
ZenSentinelRecoverySweep.js returns that same actor already giant from completely
outside the left edge. Its measured body and tail extent determine a constant
scale and head-first passage; there is no small koi growing in the display center.
`resolveZenSentinelRecoverySurface` derives white backlight columns from its head
and retained fracture columns from its tail, using one pose and address fault.
Its silhouette does not fade while it is still crossing the viewport. Reduced
motion has no specimen, translation or moving wipe; existing stage boundaries
own the discrete damaged, white/full-fracture and retained-fracture displays. The
geometry never scales inward: pixels ahead keep the full fracture and pixels
behind keep an inner prefix between the first two propagation nodes at default
starter damage 0.25. Reveal and rewind measure cumulative screen-space path distance,
then project that distance back to the original node index; existing vertices
stay fixed and only the exposed tip is interpolated. Three accepted followup
strikes release seeded stress intervals on those same outer paths, with the
outermost run reserved for the final act at the protocol policy's fracture
threshold (0.92 by default). Material pressure is normalized by that exact
threshold passed from engine diagnostics, including supported policy overrides.
The inner arrest proportion is a material constant, not a second win condition. During an
accepted rupture, every path takes its new arrested length from the protocol's
accepted damage immediately. Angular-neighbour delays and elapsed-time tip
growth are prohibited. The
renderer cannot create an additional hit or damage owner.
White and page surfaces use the same
`GlobalSentinelLcdMaterial.drawGlobalSentinelGlassFracture` pass for physical
primary and secondary cracks. It alone calls GlobalSentinelGlassStroke.js for
their narrow neutral hairline and attached bevel/chips under one top-left light. Absolute-distance
material samples and local segment normals keep already exposed edges fixed
as their prefix grows; glass adds no RGB rail or bloom. RGB remains confined
to narrow original driver islands. Quality budgets cap per-segment detail.

The shared `direction_distributed` geometry keeps six or seven ordered primary
directions, the exact accepted impact and the activation seed. Propagation nodes
have unequal spacing, with three compact impact nodes and longer outer runs.
An asymmetric sector distribution and one outer stress jog replace an evenly
spaced star and repeated lateral waves. Inputs within `64 * Number.EPSILON` of
an edge own an inward direction sector from the outset; the accepted origin
is never moved and a path is never retried. Bounded perpendicular deviations
remain inside each direction's disjoint sector and
the viewport; increasing axial projection prevents loops or crossing primaries.
LCD and Room panel boundaries still consume these same frozen paths. LCD
clipping may extend a sector to the viewport edge; those extensions never enter
the physical ray, arrest distance, or glass paint pass. Entry `surfacePaths`
metadata references the frozen skeleton directly and owns no separate reveal
calculation or renderer. Glass
shading joins each polyline in one continuous narrow face with restrained
directional glints and attached irregular facets. There is no additional radial
micro-web or second decorated fracture network. Canonical secondary branches
remain attached to an exact node of their declared primary: entry and white-field
projection reveal them only after the parent's visible prefix reaches that node.
Each branch is one short, seeded forward fork with two unequal runs. The full
candidate must remain in bounds and avoid existing segments before admission;
the existing nullable visual-branch contract omits a rejected candidate without
retrying, clipping its origin, or leaving partial segments. Primary and Rift
geometry remain unchanged.
White-field primary and branch detail share the pre-existing glass sample budget;
electrical fault zones, driver cues, repair authority and all clocks are unchanged.

After entry, one repair unit works on one actual fracture section. The three
acts are discovery, system_surge and final_decision. Each starts from the previous
accepted action; a miss retries the current act and never skips the story.
The first contact opens 22900ms after starter commit. The final window lasts
4500ms with 0.1 motion scale. The giant is the single entry recovery process,
not a persistent background opponent behind these smaller repair units.
`ZenSentinelRecoverySweep.js` projects that retained actor only during entry.
Later acts show the existing small unit, its actual contacted fracture section,
and the consequence of an accepted intervention. No bank silhouette, separate
actor, clock, contact window or input authority is added.
Canonical game hard limit is 60000ms; the protocol owns each contact window
before the terminal sequence.

`nudgeVisuals.js` projects the engine's exact vulnerability bit. Approach and
lock retain a matte, unbroken seal; a full telegraph alone cannot draw the open
glass lips. Both boundaries of the accepted window retain the contrasting lips
and split circular gate, while the existing mid-window quality cue may breathe.
This changes no eligibility, window duration, semantic activation or clock.

GlobalSentinelRepairMaterial.js occludes the contacted crack with a narrow
restored LCD strip and small neutral compression marks. Miss closure receives its exact
fractureRepairBeatIndex from the protocol, never reconstructing it from a
copied rhythm. A successful hit removes the local repair unit into raster strips.
The LCD glass pass presents the accepted arrested fracture immediately, while
RepairMaterial only answers the exact contacted seal with a short local incision
and attached glint. It validates the selected LCD ray as ownership proof; it
cannot reconstruct, trace, splice or decorate that network again. The opaque repair
strip is removed at acceptance, without a delayed fade-in or 70ms cover removal.
Attached branches share the same immediate damage projection. No connecting beam runs to
the central impact. The 1.6 second normal and 2.2 second final aftermath remains
visible through the next act's breath even when no live target exists. Local
contact response uses accepted elapsed time rather than a fraction of that differing
normal/final aftermath duration. A short exponentially damped optical/contact
response changes edge opening and reflection only; it cannot advance tips,
delay fracture visibility or translate the network. Existing missed-contact
patch and stitch restoration remain separate from physical fracture paint.
Reduced motion shows the same immediate accepted fracture through the LCD pass
and performs no additional rupture-contact Canvas pass. Renderer presentation
cannot create acceptance, a new fracture origin or a damage channel.

All simulated fracture channels, hit eligibility and success remain protocol
owned. Renderer projections converge to the canonical damage and cannot alter
input or outcomes. Success removes every fish then holds the identical fracture
alone for 4 seconds. Only afterward does the shared 2.6 second rift timeline create
space from those lines. The explicit invitation is disabled until formation
finishes; its pointer hit polygon is the actual aperture, with keyboard/ARIA
access. The field outside darkens to the Room478 handoff surface before
navigation, preserving origin, seed and viewport geometry. HUD stays off by
default and has no role in making the cinematic readable.

TerminalController issues one `Date.now` epoch-millisecond Rift start. Host
retains it and sends the same `startedAtMs` through `SET_SCENE_PHASE` to the
selected worker and engine. Both the opening timer and aperture progress use
that start; message delivery and same-phase replay cannot restart the formation.
Missing or invalid wire timestamps fail explicitly. Worker `performance.now`
samples measure work and frames, never the game phase's epoch clock. The existing
2.6-second opening and thirty-second invitation durations remain unchanged.

The deterministic sequence harness captures the production engine at the stage
boundaries and native material views, including shadow separation, complete
white fracture, readable giant, repair passage, all three acts, local rupture,
fracture-only ending, and aperture formation. Named runtime QA waits on observed
ACTIVE windows instead of duplicating a fixed tempo or shortening the policy.
The same ordered engine run also captures the first accepted contact at
0, 16, 70, 240 and 440ms for immediate rupture, the next presented frame and
unchanged arrested tips during optical settling
inspection. These source-render stills establish stage ordering and material
continuity; they do not certify MV3 admission, presented frame rate or the
operator's perceived timing.

The glass material assumption is an annealed glass sheet whose broken pieces
remain held by a backing/interlayer, rather than a tempered pane's full granular
fragmentation. This is an explicit cinematic material choice, not a claim about
the operator's monitor. Dynamic fracture is projected as a sub-frame event;
display cadence is not a physical crack-speed constant. The accepted damage
scalar selects deterministic load-limited retained lengths, not a computed
stress-intensity factor or finite-element solution. No extra damage memory is
created. The protocol's explicit 1200ms missed-contact repair and the giant's
fictional recovery remain authoritative exceptions to irreversible residual
glass damage. Experimental basis and limits are recorded in
[the research and verification report](../../../../reports/real-use-fixes-2026-10-01.md).

The post-success `rift` phase keeps that ownership and continuity. It freezes
the activation seed and first-click origin, then selects the first or second
node of every primary crack path with the same seed, sorts those nodes around
the impact point, and uses them as the stable tear anchors for the Room 478
threshold. The aperture mouth stays inside those anchors so a long second-node
crack cannot turn the entrance into one oversized shard; the remaining segment
continues visibly from the mouth to its selected node. The retained glass surface recedes as depth forms from the fracture contour. The worker canvas owns the visible void, perspective field, glass lip,
and crack continuation. The shadow DOM owns only one transparent semantic button
positioned over the impact region; it must not draw another polygon, visible
label, coordinate, countdown, or progress rail. The deterministic comparison
scene is `sentinel/global-sentinel-rift-entry`. Main Sentinel diagnostics expose
the product-owned `globalSentinelRiftOpenProgress` and
`globalSentinelRiftInviteOpen` state so attach-only runtime QA can distinguish
the first rift frame from the fully opened semantic invitation without owning a
parallel timer or geometry model.

The Rift material projects its vanishing point, horizon and distant light from
the actual small mouth extent, never the viewport extent. The glass lip retains
a readable inset inside that same contour. Completion of the existing aperture
clock stabilizes a warmer threshold light; it does not enable the semantic
invitation or change its thirty-second lifetime. Reduced motion holds interior
motes, depth oscillation and rim breathing still. Existing detail counts and
structural bloom caps apply, including large viewports. The completed Rift
fixture uses the product contour for its transparent hit region and the product
invitation-duration constant; it is a material capture, not runtime handoff proof.

### Historical pre-cinematic crack growth study

This section records the earlier material exploration. The September 9 cinematic
contract above owns active timing, roles, progress thresholds and repair behavior.
Do not implement the old stage timing or central recall described below.

The desired read is continuous structural failure under repair pressure, not a
large crack decal that appears as soon as the protocol starts. One activation
should have one stable fracture skeleton; successive valid interventions should
open more of that skeleton while sentinels attempt to seal it. Different
activations may select a different skeleton from the activation seed, but a
single activation must not reseed crack geometry per hit.

#### Visual Model

Represent the global break as four layered quantities derived from `fracture`
and `syncPressure`:

- `length`: how far each crack path has propagated.
- `branchPresence`: which secondary branches are allowed to appear.
- `aperture`: how wide/dark the opened split reads.
- `debrisLeak`: LCD channel faults, attached facets and dead-column damage. This stage value never makes the live page visible.

These quantities should not all rise at the same rate. Early fracture should
mostly affect `length`; mid fracture should add branching; late fracture should
increase `aperture` and `debrisLeak`.

#### Fracture Stages

Use staged response bands rather than a single `resolveDamageAppear()` curve for
all crack features:

| Fracture range | Screen read | Allowed effects |
| --- | --- | --- |
| `0.00-0.15` | surface stress | hairline cracks only, subtle LCD defects, no large dark gaps |
| `0.15-0.35` | first rupture | primary crack length grows, still thin, minimal chips |
| `0.35-0.55` | spread | branch cracks begin, joints brighten, line defects break |
| `0.55-0.72` | open breach | liquid-crystal bleed and dead columns grow; attached facets become visible |
| terminal success | escape | after the terminal sequence, the existing crack contour first acquires depth |
| terminal failure | resync | aperture closes first, leaks/chips disappear, seams over-clean the surface |

The early range is intentionally restrained. A valid first hit should register as
the screen beginning to fail, not as the final break pattern already being
painted.

Late aperture is formed by chipped faces between neighboring primary paths,
with thin polarizer/channel fringes along their edges. Do not represent page
release as uniformly thick colored strokes laid directly over every crack;
hairlines may widen locally, but connected irregular windows must carry the
terminal read.

#### Stable Variation

Repeat avoidance belongs at activation scope, not hit scope:

- `simulationBreakSeed` selects one crack archetype and per-path variation for
  the whole activation.
- Hit serial and hit coordinates must not alter crack topology, path anchors, or
  chip positions.
- Per-hit feedback may drive only non-geometric stress intensity, such as a
  short glow along existing crack tips or a temporary repair-seam flicker.
- Seed `0` remains the deterministic reference pattern for preview and tests.

Initial archetypes should stay few and legible:

- `diagonal_spine`: one dominant diagonal spine with restrained branches.
- `center_spider`: a central stress node with short radial paths.
- `edge_tear`: cracks enter from one edge as if the simulation surface is being
  damaged; only post-success rift traversal opens spatial depth.
- `horizontal_lcd_split`: a panel-line rupture that spreads laterally before
  branching.

All archetypes use the same render pipeline and state inputs. They are shape
families, not separate renderer branches.

#### Repair Language

Repair must feel like sentinels are closing the same fracture skeleton:

- `syncPressure` reduces `aperture` before it erases `length`.
- Repair seams should follow existing crack paths, not wash over the whole
  screen uniformly.
- Leaks and chips fade before primary hairlines disappear.
- Near failure, seams should become over-clean and slightly artificial, matching
  the resynchronization canon.

The current scalar repair model may remain the game-state owner. Per-crack
repair ledgers are a future extension and should not be introduced just to tune
vNext visuals.

#### Implementation Steps

1. Add small stage helpers in
   `src/domains/nudge/rendering/NudgeProtocolSceneBackground.js`, for example
   `resolveFractureStageProfile(fracture, syncPressure, terminalResync)`.
2. Split foreground damage rendering so crack length, width/aperture, branch
   visibility, chips, leaks, and defects each read from the stage profile instead
   of from one shared `damage` value.
3. Retune `LCD_CRACK_PATHS` and `LCD_CRACK_BRANCH_PATHS` starts/spans so early
   fracture reveals short hairlines. Primary paths should grow over a wider
   fracture interval; branches should be gated until mid fracture.
4. Add an activation-scoped archetype resolver from `simulationBreakSeed`. Keep
   seed `0` pinned to the current/default reference archetype unless preview
   baselines are intentionally updated.
5. Route archetype selection through existing protocol scene/background inputs.
   Do not add a second global-only renderer, DOM HUD state, or worker-shell style
   branch.
6. Rework repair erasure to reduce aperture and leak/chip visibility before
   hiding hairline length. Repair seams should continue following the crack
   skeleton.
7. Keep koi removal feedback separate from crack topology. Ink disappearance may
   remain tied to the removed sentinel position, but cracks must stay
   activation-stable.

#### Test Contracts

Focused tests should lock the following behavior:

- `fracture = 0` with hit/impact diagnostics still draws no foreground cracks.
- Low fracture draws fewer/shorter crack segments than mid fracture.
- Mid fracture enables branch segments that are absent at low fracture.
- High fracture enables chips/leaks/aperture effects that are absent or minimal
  at low fracture.
- Same `simulationBreakSeed` and fracture state produce identical crack
  geometry across frames.
- Different nonzero seeds may select different archetypes or path variation.
- Hit serial and hit point do not change crack geometry inside an activation.
- Rising `syncPressure` visibly reduces aperture/leaks before removing all
  hairlines.

Recommended focused verification:

- `npm run test:file -- tests/nudgeProtocolSceneBackground.test.js`
- `npm run test:file -- tests/nudgeSwarmEngine.test.js tests/nudgeSwarmWorkerEntry.test.js`
- `git diff --check`

## Worker Model

There is one active content nudge render worker per active Sentinel Flare
session.

The extension iframe is not a second renderer. It is the MV3-compatible host that
loads the extension page and transfers a canvas to `nudgeSwarm.worker.js`.

The registered `nudge_content_swarm` worker surface is the older direct content
worker admission path. It may remain registered as a disabled prepared surface,
but it is not the default active path and must not be treated as a parallel source
of render truth.

## Relationship To Zen Pond

The main Zen pond renderer is a separate UI theme renderer:

```text
zen_home_renderer / pond logical channel -> Pixi retained pond scene
```

`zen_home_renderer` is the single admitted physical Zen Home renderer; its
`pond` and `bonsai` channels keep separate logical protocols and ACKs. Sentinel
does not acquire either Home channel or create another Home Worker.

It should not be reused wholesale inside content nudge overlays. The pond runtime
has dashboard-scale world state, richer biotic behavior, retained Pixi objects,
and different lifecycle constraints.

Sharing should happen below runtime ownership:

- shared koi silhouette/geometry ideas
- shared appearance tokens where they are meaningful
- shared actor style contracts
- future shared render-core utilities if they can stay context-agnostic

The content nudge runtime keeps its own worker loop and entity state because it
has different activation, hit, budget, and teardown semantics.

## Retired Paths

The following deleted symbols/modules are retired and must not be reintroduced
as active runtime branches:

- `GlobalSentinelRenderer`
- `ZenSentinelEngine`
- `ZenSentinelStore`
- `ZenSentinelProfiles`
- `ZenSentinelTelemetry`
- `ZenSentinelKoiRenderAdapter`
- `NUDGE_PROTOCOL_RENDERERS.GLOBAL_SENTINEL`

Global protocol code such as `nudgeGameGlobalSentinelProtocol.js` and
`sentinelOutcomeContract.js` is not retired. Those modules own protocol policy
and result state, not a separate canvas renderer.

## Ownership Rules

- `SentinelProtocolHost` starts and stops the intervention, owns runtime context,
  worker bridge calls, terminal controller wiring, copy, and lifecycle messages.
- `SentinelProtocolHostSessionModel` owns protocol-change detection and
  start/stop reset primitives.
- `SentinelProtocolSessionController` owns active site/global protocol state,
  progress resolution, worker progress, accepted-input advancement, completion
  delay, and global failure checks.
- `SentinelProtocolWorkerBridge` owns selected/active worker runtime lookup,
  message posting, support checks, activation routing, and worker stats snapshots.
- `SentinelProtocolTimerController` owns named ritual, terminal, global reveal,
  rift, and escape timers.
- `SentinelProtocolTerminalController` owns global terminal sequence, active
  outcome, rift invite, media restore, navigation, and lifecycle resolution
  callbacks, including the shared epoch timestamp for Rift formation.
- `SentinelProtocolPresentationAdapter` owns DOM class/style/text application
  from host presentation models.
- `SentinelProtocolDiagnosticsBuilder` owns protocol state and spawn diagnostic
  field assembly.
- `NudgeExtensionFrameWorkerRuntime` owns the iframe session, start signal,
  nonce/session filtering, worker diagnostics, and debug spawn waiters.
- `src/apps/nudge-render-host/main.js` owns the extension-frame canvas transfer
  and worker message forwarding.
- `nudgeSwarm.worker.js` owns the worker message shell and OffscreenCanvas loop.
- `NudgeSwarmEngine` owns spawn cadence, split cadence, hit behavior, adaptive
  quality, background drawing, entity update, and entity draw calls.
- `nudgeProtocolScene.js` owns protocol-scene routing and the declared Site
  host-DOM / Global worker strategy. Global engine differences must be represented
  there before they reach the engine; Site presentation follows the chime owners.
- `NudgeProtocolSceneBackground.js` owns the stable simulation-break skeleton,
  staged reveal, repair, and terminal breach composition.
  `GlobalSentinelDisplayEffects.js` may only decorate that owned geometry with
  LCD/display stress from the inputs passed by the engine.
- `GlobalSentinelLcdMaterial.js` owns pixel-space projection, arrested path
  distances, LCD clipping, and the single physical glass pass shared by entry
  and white-field damage. Electrical rails are LCD faults, not additional cracks.
- `GlobalSentinelRepairMaterial.js` owns local seal/restoration and contact
  response; it cannot repaint a primary or branch path. Protocol accepted damage
  and the supplied policy threshold remain its upstream authorities.

## Forbidden Shortcuts

- Do not describe or implement `global_sentinel` as a budget-warning popup.
- Do not add a second global-only renderer branch.
- Do not route global sentinel to the Zen pond Pixi runtime.
- Do not let the direct `nudge_content_swarm` prepared path become a silent
  fallback for the extension-frame path.
- Do not reintroduce the deleted `zenSentinel` runtime folder as an active path.
- Do not put protocol-specific style decisions directly in the worker shell when
  they belong in `nudgeProtocolScene.js` or `NudgeProtocolSceneBackground.js`.
- Do not make visible HUD, countdown, or meter UI the primary user-facing
  progression language for either protocol.
- Do not create a renderer-owned score, progress, or win condition that bypasses
  the global game contract in the activation spec.
- Do not let the fastest route through the ritual read as "click the targets and
  return to content." The interaction should redirect attention away from the
  original content loop while it runs.

## Verification Targets

The selected research presentation is projected through the current product
protocol, with its three accepted acts and 54s/60s clocks preserved.
The LCD material owns the accepted hit's immediate arrested-fracture projection.
`GlobalSentinelRepairMaterial` removes the seal at acceptance and owns only a
55ms optical decay at that contact; elapsed time never propagates a crack tip.
The shared `displayFracture` equals accepted damage during rupture and follows
only the protocol's explicit missed-contact repair during restoration.
Reduced motion omits the contact impulse. This presentation
does not introduce the prototype's five-contact success policy, four-miss
termination policy, or first-encounter persistence.

Room 478 owns its standalone `room478Arrival` and `room478Garden` surfaces.
Arrival reuses the frozen canonical LCD panel vertices and settled white
material, with a maximum 1600×1000 texture and foreground surface. The existing
experience's active elapsed time gates paint at 30Hz; no additional frame loop
or page-image capture is created. Panels leave around the same small impact
contour while the selected static garden remains fixed. Completion, resize,
destroy and asset failure release the old foreground and material cache.

Use these focused checks when this boundary changes:

- `npm run test:file -- tests/sentinelProtocolHostFacade.test.js tests/sentinelProtocolHostSessionModel.test.js tests/sentinelProtocolSessionController.test.js tests/sentinelProtocolTerminalController.test.js tests/sentinelProtocolWorkerBridge.test.js tests/sentinelProtocolTimerController.test.js tests/sentinelProtocolPresentationAdapter.test.js tests/sentinelProtocolDiagnosticsBuilder.test.js tests/globalSentinelEntryController.test.js tests/nudgeSwarmWorkerEntry.test.js tests/nudgeSwarmEngine.test.js tests/sentinelFlareProtocolProfile.test.js tests/nudgeGameTemplateProtocolOwnership.test.js tests/nudgeExtensionFrameWorkerRuntime.test.js tests/nudgeGameRuntimeCanvasMode.test.js`
- `git diff --check`

Visual QA should compare Site Furin over a real page with its host backdrop,
canonical bell, reflection intervals, and visible hold/cancellation behavior.
Its vector-only sequence fixture does not prove admission, media, or lifecycle
receipts. Global sentinel should be compared as a simulation break: a
white LCD/washi field with sentinels, front-glass cracks, light leaks, repair
seams, and channel faults locked to the flat display surface. Page readability is not
the target for that protocol; attention detachment and the crash/resync story are.

### Discrete entry failures and live-page projection

`nudgeGameGlobalSentinelEntryFaults.js` samples the five public
`GLOBAL_SENTINEL_ENTRY_FAULT_CUES` (2350/3190/4020/5060/6100ms). Fracture panels
are subdivided into two or three electrical address banks each, without adding
new glass lines. These banks receive seeded group assignments and latch delays;
even a three-ray fracture has failures at all five cues. A region loses sync, briefly
re-exposes the live page, then stays opaque; no alpha tween drives its death.
Driver columns blink and jump on their own cadence, while glass coordinates
remain fixed. Full-field power loss is a single opaque cut, not a fade.

`SentinelProtocolPresentationAdapter` projects those same cue times into three
short backdrop-filter strips under the worker canvas. They alter the actual
page's color/contrast without copying page content, changing its layout, or
moving the fracture origin. Existing entry presentation updates own sampling;
there is no extra animation clock or unowned page style mutation. Reset removes
the transient class. Reduced motion omits all row flashes/re-exposures.

The global audio controller passes the same fault cue array to the Zen synth.
Each cut combines a short electrical transient and a low pressure impact. The
existing finite voice lease cancels all scheduled entry sounds on reset/stop.

`SentinelProtocolFullscreenController.getSnapshot()` exposes actual fullscreen,
request status, activation/focus/visibility at request and the platform error in
host diagnostics even when HUD is off. A settled request with no fullscreen
element is diagnosed explicitly. Background semantic QA remains windowed;
actual operator input is required to verify native fullscreen. No browser flags
or synthetic activation bypass the policy.
