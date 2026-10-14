# Main Tab Home Surface Boundary Map

- Status: Active
- Owner: dashboard Main tab, HomeScan workspace, theme widget registry, dashboard status controller, main presentation conductor
- Last validated against code: 2026-10-13
- Path policy: current-only
- Canonical for: Main tab first-frame gate, home scan projection, theme widget owner resolution, and presentation-scene handoff
- Companion to:
  - `docs/architecture/repository/dashboard-launch-loading-boundary-map.md`
  - `docs/architecture/repository/theme-engine-boundary-map.md`
  - `docs/system-architecture/06-dashboard-launch-and-loading.md`
  - `docs/system-architecture/03-theme-plugin-and-zen.md`

## Purpose

`workspaces/garden/ZenGardenFrame.jsx` owns the app-level Zen stage composition:
stable pond and Bonsai measurement slots, the rhythm slot, and injected garden
planes/pressure dock. It owns no controller, query, geometry resolver or ACK.
Home supplies those slots with no support readout or footer after the measured
stage. MainPanel maps Zen's canonical `main` and `sites` routes to one retained
Main pane. MainTab supplies the Garden mode and a separately admitted Sites
workspace slot; it never imports the Sites tab. Other themes retain separate panes.
The common paper edge starts at the pond/pressure boundary and rises with the
ledger. Pointer drag affects presentation progress only; release requests the
canonical route. Click, Enter/Space and ArrowUp/Down use the same edge. The paper
slides vertically over 220ms and covers the pond from stage top to graph top,
ending at the rear Bonsai panel line. It paints behind the original overhanging
canopy; transparent canvas overlap is intentional. Reduced motion removes
settling movement. Bonsai and measured anchors have no mode key or mode-dependent
geometry. After first admission, embedded Sites keeps its DOM/drafts while closed
with runtime and presentation inactive; its queries remain parked.

When a drag interrupts settling, GardenFrame reads the painted sheet position
against its existing viewport for the control's gesture origin. The first admitted
move takes over that position instead of snapping to the committed route endpoint.
Closing takeover waits for the current Pond receipt; a release while still waiting
retains the same preparation/commit owner. Pointer-click suppression after a drag
never consumes a later keyboard or assistive activation.
The edge and paper use the same percentage translation inside fixed work-area
viewports. Resizing updates those viewports immediately; it never animates an
absolute edge coordinate away from the graph. `data-work-area-motion` admits the
220ms settling transition after the first route change. Presentation viewports
and paper use non-scrolling clips; embedded Sites alone owns content scrolling,
including native keyboard focus while the paper is partly held open.

Ledger ink and controls use a separate straight reading edge; the paper still
covers the complete `workAreaRect` beneath the overhanging Bonsai. The narrow
`themes/plugins/zen/api/homeCanopyReading.js` seam evaluates the renderer's
immutable full-history organ envelope with the same Home camera policy in CSS
coordinates, including the analytical maximum whole-tree sway. Its normalized
left bound is independent of visible growth, bloom, seasonal alpha, weather and
raster quality. The shared envelope collector retains the existing blossom,
girth and nine-world-unit paint reserve; this does not resize or refit the tree.
The existing classic Home runtime publishes the prepared envelope through
`onHomeCanopyReadingEnvelope`, tagged by the current presentation scene and
committed garden-bed layout signature. Home composition projects that bound
through its stage-local `canopyViewportRect`; neither a transparent canvas
allocation nor a per-frame alpha/DOM measurement defines readable space.

GardenFrame receives only the resulting `textSafeRightCssPx` and exposes
`--zen-garden-text-safe-right` on `.zen-garden-pathways`: a nonnegative CSS-pixel
inset from the paper's right edge, excluding the Sites-owned reading gutter.
`data-reading-ready` and `data-text-safe-right` expose the same admission and
measurement for diagnostics. A missing or stale scene/layout receipt keeps
reading content inert and hidden until ready, without changing paper geometry,
canvas identity, route, Worker activity or the exact presentation ACK. Portrait
composition explicitly has zero canopy inset. Sites alone applies the inset to
ink/controls; rules and hover paint may continue beneath the crown.

`workspaces/garden/gardenSurfaceActivity.js` projects required workspace and
surface-presentation booleans into independent Pond/Bonsai activity. Pathways keeps
Bonsai active and parks Pond. `useGardenModeTransition.js` owns only uncommitted
preparation: Sites code readiness precedes route commit; Pond return activates
its renderer behind the ledger and waits for an actual current-scene receipt.
The 15-second resume deadline diagnoses a missing current-scene presentation
without replacing the committed ledger; a ready gesture may remain held longer.
Request generations fence late imports and cancellations. The same receipt
also admits close-drag exposure: pointer-down prepares Pond behind the sheet,
but a deferred receipt cannot commit navigation. The sheet stays closed until
that current-scene receipt arrives, follows the drag thereafter, and commits
only on accepted release. Cancellation parks the preparation again.
It is independent of boot's one-time first-visual callbacks. Home gates registration
and koi hover by visible Pond. The pressure graph remains a common domain entry
in both modes. Only its currently hovered/focused favicon is actionable and opens
that domain's notebook directly. No pressure selection popup or independent
selection Escape owner remains.
Roster preparation follows Pond runtime activity. Home gates
materialization/frame acceptance and growth by Bonsai, and the composite ACK
deadline/first viewport notification by both. Parking one surface cannot spend
the composite ACK deadline or block the other's valid materialization. Composite
resume revalidates actual accepted frame evidence against the exact scene and
Bonsai input/materialization rather than waiting for a duplicate ACK. Bonsai's
existing accepted-frame state survives parking with its retained canvas; actual
materialization invalidation clears it. Pond parking clears its live receipt
because its controller may be disposed, so its return requires a real frame. Physical
Worker/session admission, shared quality budgets, Pond's bounded park lifetime
and Bonsai's retained controller remain with their existing Zen owners.
Home admits Bonsai's renderer in the same render that satisfies its current
identity, measured-surface and model materialization gates. A layout-committed
lifetime latch retains that admission while parked; abandoned ready renders
cannot open it. The current scene and actual-frame ACK requirements are unchanged.

Main keeps first-site invitation receipts at the actual pond/non-Zen registration
entry; it emits no independent contextual coach card. Non-Zen registration and
Journey controls share a wrapping normal-flow action row. Zen's existing pond
placement and single First Vision conductor remain authoritative.
The Journey details own the explanation of growth on protected-site use days.
Main has no generic help disclosure, Bonsai feedback disclosure, portal host or
conditional content region below the scene. The graph and integrated bed themselves
form the landscape garden's lower frame and reach the shell's lower edge. This
boundary is unconditional: lifecycle readiness, feedback content and debug state
cannot create another footer or reduce the measured stage. Canonical habit signals
still drive activation and debug diagnostics through the existing Bonsai experience
model; they have no lower support output adapter. Renderer readiness, exact scene
ACK, growth and First Vision retain their existing owners. Public Main does not
enable the Bonsai debug popup. Development Main admits
the panel only with `BUILD_INCLUDE_DEBUG_TOOLS`, a resolved lifecycle input and an
unlocked current scene; First Vision and named capture profiles retain their exact
inputs. Home owns local growth/bloom/activation preview intent before computing the complete
materialization input signature. The Zen debug projection marks those requests as
`debug_progression_preview` / `read_only`; the target owner applies the explicit
preview fields over the displayed committed life-state snapshot, without changing
canonical release or habit facts. Other health fields remain at that captured
baseline while either growth/bloom force is active. Renderer/scene ACK
must still match that complete preview request. Reset restores the original input,
and unmount discards the controls. Activation remains a separate render-only force,
consumed directly from Home's control port. All three force fields must be null
before ordinary first-bloom presentation is eligible, so two presentation owners
cannot apply conflicting debug and ceremony poses.

Development Bonsai panel placement is supplied through Layout's
`DashboardDevelopmentDockContext` and the existing `bonsaiLifeDebugControls`
presentation port. Layout owns the right host, open state, 56px launcher / 320px
panel and reserved margin; Home passes placement, and the theme renders through
that supplied host without importing dashboard code. This is outside the measured
Garden and creates no scene footer. The runtime keeps debug values and identity
commands. Accepted worker-frame diagnostics distinguish forced zero from null
unscored presentation. Durable reroll uses the existing action policy / aggregate
CAS only; no ephemeral identity can mutate. Unsupported planter/style buttons
are not offered by the frame-seam / Plume surface.

Dashboard's first-visit recording failure reaches Main through the explicit
`firstVisitSupportSlot` presentation port in Layout/MainPanel. Main displays its
retry in a normal-flow support row only while presented and interaction is
unlocked; unrelated tabs receive no slot. `useDashboardFirstVisit` retains the
record command, generation validation, error and retry authority. The support row
creates no document-level floating card and does not alter the First Vision
conductor or its focus admission.

Home resolves each retained scanner, core, pressure and rhythm widget through a
stable default shallow-memo boundary. Editor, guidance and frame-receipt updates
do not rerun an unchanged surface's model/hooks. All props participate: scene,
activity, renderer budget, model and callback changes still reach the widget;
its own state, subscriptions and context retain their normal React updates.
Pressure-site filtering retains its array identity while its source candidates
and theme are unchanged. These are presentation optimizations, never alternate
settings/model owners, ACKs or scene-admission rules.

Main registration uses `ZenInvitationKoiRegistrationEditor` and its local
`zenFirstSiteRegistration.css`. For UNSET, `DashboardFirstUseContext` exposes
canonical consent and the explicit conditional Browse command. A fresh garden
starts with the canonical Day0 resident shadow and a closed editor. Clicking that
shadow or its keyboard entry opens the editor only after active Main, dismissed
boot, unlocked First Vision interaction, available capacity and actual shadow
admission. UNSET consent never opens the editor, hides navigation or adds a
separate footer setup action. An explicit routed registration request retains its
existing in-water continuation through First Vision and ordinary navigation during
its interaction lock. First use asks
for a domain and initially unchecked recording, then Start; its goal is explicitly
null. `UPSERT_SITE_RULE.firstUseRecording` commits protection and all five policy
keys together: checked means protected-site/basic with precision off, unchecked OFF.
Existing protected lists are described as that scope rather than one domain only.
Denial retains the draft and checkbox without a policy write. Cancel returns to
the same shadow and retains the draft. Browse is an explicit action inside the
opened editor and commits OFF without a site. Ordinary sidebar navigation does
not choose a recording policy; collection stays fail-closed while UNSET. Chosen profiles
cannot be overwritten. Exact existing protection returns `already_protected` and
completes the policy without consuming or assigning another shadow. A newly covering
ancestor is explicitly rejected; it cannot acknowledge an uncommitted choice.

Every registration uses the same native address editor inside the actual pond
viewport, below a stable water anchor, with no body portal, modal focus trap,
whole-dashboard scrim, choice-card picker or completion card. Registration
creates protection without a time goal; Sites is the sole site/global time editor.
A routed address starts as a compact site confirmation; an empty explicit request
opens the address field. Edit expands that same address without committing
anything. Ordinary navigation to hidden Sites returns to the closed Main garden;
public Sites add requests stay in Sites. Permission and command failures remain inline. Pending work blocks
duplicate submission and editor Escape, but does not trap dashboard navigation.
The submitted form remains visible while its command settles, even when the
canonical membership update has already consumed the last available place.
Every close path retains transient address and recording choices by shadow identity;
a successful registration clears it. Closing restores native pond-entry focus
after that entry remounts, without taking focus from another dashboard surface.

An exact allow-list match returns the canonical `confirm_move` admission to the
editor. The editor presents the site, frozen first-use recording
choice when applicable, and move explanation
in the same water position. Back or Escape returns to that unchanged draft.
Only explicit approval calls `handleConfirmProtectedSiteMove`, which validates
the exact normalized allowed-to-blocked admission and invokes the protocol
store's atomic `moveSiteRule` command without a time goal and with both list acknowledgements.
There is no nested confirmation dialog. Shared settings feedback still owns
propagation failures and retry; only a reconciled successful command receipt
consumes a shadow. The short, unboxed completion status stays at the input
position for four seconds and adds protection-applied copy only for a succeeded
propagation receipt. It writes no progression or storage state.

`JourneyProgress` labels development full-access projection explicitly. Its existing
expanded detail shows both effective preview day and canonical recorded day;
preview day 5 never claims five canonical use days.

Zen projects the central `site_registration_journey_v1` invitation count: one
domainless shadow per unused finite registration place, none at capacity, and
one repeatable invitation after the five-day unlimited release. Stable
`invitationSlots` identities live in the retained Home presentation; they are
separate from the five representative site fish. The typed progression milestone
`admittedInvitationCapacity` remembers which grants have been presented across
document lifetimes. New grants serially admit shadows from varying banks/lanes;
already admitted grants reconstruct resident and ordinary tab activation retains
identity. The first empty garden composes its initial shadow in exposed water.

Home supplies the selected `invitationRegistrationEntityId` through the existing
pond input control plane. The shared `zenPondRegistrationPresentation` contract
owns normalized water/editor anchors; only that admitted shadow approaches a
slow waiting circuit using its existing motor. The editor does not follow
per-frame fish poses. Cancellation clears that presentation input without
consuming capacity or clamping the fish back into its initial nook. Editing
disables other pond hits and hides its native invitation hint, while the rest of
the dashboard remains available.

An explicit command ACK carries the clicked identity in transient
`invitationAssignment`. Home forwards the command receipt unchanged and consumes
that selected slot without a pending-domain mirror or another post-ACK query.
The worker assigns that exact shadow's live pose, spine and UID to the registered
site, including the last finite slot. A successor arrives only if capacity
remains. Ordinary roster refresh/rotation never assigns one. The receipt
temporarily admits the registered site into the five representatives even if
that set was full. First Vision and inactive Main expose no registration action.

The first-site guidance anchor opts into `presentation: 'anchor'`. Canonical
guidance claims and receipts stay in the guidance owner; the Zen pond paints one
unboxed, native instruction and acknowledges a verified visible frame. Later
entry is discoverable on shadow hover or native keyboard focus. The editor's
transient guidance interaction retains the first-site claim and suppresses
unrelated automatic guides; successful site ACK completes a presented claim.
After save, requested propagation settlement and canonical reconciliation, Home
starts guidance completion without awaiting it in the registration pending
lifetime. The guidance provider still owns presentation/complete/release receipt
ordering, refresh and visible failures. Editor close and the koi assignment do
not wait for that independent guidance bookkeeping.
There is no separate lower-left first-site guide.

Non-Zen Home owns one bounded, wrapping corner action row for the registration
entry and Main's `journeyProgressSlot`. Both controls participate in the same
flow; neither independently overlays the other. `JourneyProgress` owns its
shipping guidance content, while Main retains Zen's existing corner placement
outside the pond/bonsai geometry and clipping boundary.

`useSiteRegistrationJourney` shares the canonical progression query and hydrated
protected registrations with Sites. `mainSiteRegistrationAvailability.js` maps
the guidance DTO without recomputing policy. A routed request at a full budget
opens in-water boundary guidance with the next qualified-use-day increase and a
ledger continuation. The background command remains the sole admission owner.
Dashboard launch/route owners supply the uncommitted `registrationIntent`; Home
never re-reads the URL. The editor waits for active/unlocked Main and an actual
physically admitted shadow before consuming an available-capacity route. The
worker's bounded membership-change event keeps native keyboard entry and popup
continuation from choosing a queued shadow.

Home's landscape garden uses one pond field beneath the Plume canopy and a
`frame-seam` support. The composition owner supplies a rear vertical pond
aperture, transparent canopy allocation, graph bounds and the full-cover ledger sheet.
`zenHomeFrameSeamGeometry` is the shared CSS/device construction for the planting
anchor behind the horizontal foreground. Its polygons also supply the DOM occlusion
surfaces, so pond input and petal landing cannot pass through the rear plane,
or foreground. There is no separate stone or pot in landscape Home. The graph
ends at the integrated bed's left footing; no segment runs under the foreground,
and data baselines remain horizontal.
`ZenHomeGardenPlanes` paints the broad rear plane and its water-side contact
shadow from the same measured aperture used for input occlusion. The worker's
static foreground layer bakes the lower contact shadow and rim; neither shadow
adds animation work or an input-blocking area over otherwise exposed water.
The rear edge stands at 68% of stage width with identical top and bottom X,
following the selected straight architectural composition. The canopy may
cross this boundary onto water. The outer pond slot remains measurement-only.
Its inner renderer viewport ends at that same edge plus 1% of the shorter visible
water dimension; CSS clipping preserves the sharp line. The existing worker
viewport policy therefore gives optics, input, spawn and resident movement this
bounded extent rather than the complete width behind the sky. Normal koi head
clearance still applies; body, tail and fins may meet the cut. No second movement
rectangle, Home-specific worker message or per-frame geometry stream is added.
The integrated bed uses a horizontal front face
9% of scene height and a top plane 3.8% of scene height; the root follows its
shared soil seam. This geometry changes presentation only.

The garden-bed frame also carries `rearPaperEdge` in surface-local CSS pixels.
The DOM aperture consumes that line and `zenHomeGardenBedCanvasProjection`
compiles it once into device coordinates for the worker. `resolveZenHomeSkyPlane`
uses it to clip the sky to the same fixed boundary; the field name describes
the existing geometry DTO, not the material. `zenBonsaiOpenAirBackdrop` paints
the canonical world sky with a cool upper atmosphere, warm low horizon and
diffuse night illumination. Horizon and clouds depend on viewport/time/weather,
not tree position, growth or health. The former cast wood shadow, silhouette
recipe and renderer texture have been retired. Root/soil and bed contact shadows
remain in the existing support painters. Atmosphere still bakes in the static
back layer with no additional animation loop.

Since 2026-10-14 `zenBonsaiNightSky` adds structure over that unchanged
palette, so the panel reads as a framed sky rather than a display. An
ichimonji-bokashi band of the zenith's own pigment, slightly deeper with a faint
indigo lean, runs from the frame's top edge to a fifth of the sky. A clear night
carries a star field fixed in CSS pixels from the sky's top-left (a resize or
DPR change shows more or less of the same sky, never a reshuffle). The panel
reads from ground at the bottom to open sky at the top, so density follows
height: about 4.6 stars per 64 CSS px cell at the top edge, 1.5 at mid-panel,
thinning to none below 0.86 of the sky. Brightness is skewed toward faint points; bright stars
appear first as twilight deepens, cloud and rain remove them, moonlight washes
out faint stars before bright ones, and the low haze band thins and then
clears them. Only the bright tail (about a tenth) twinkles, slowly (2–5 s,
down to 58% brightness). The bake states who owns that tail: Plume Pixi bakes
the sky without it (`omit`) and a sprite layer behind rain and the tree changes
only alpha per frame (one batched draw, resynced only with the baked sky);
Plume Canvas repaints it inline (`animated`); G15 has no star layer and bakes it
at rest brightness (`rest`). The world paint signature (`zen-world-paint-v2`)
now bands moonlight, because the baked stars read it. Home has no
reduced-motion signal in its render options; the twinkle follows the same
always-on motion as wind sway and koi.

The real moon (2026-10-14) comes from the canonical world, not the sky painter.
`lunarCalculations` (SunCalc moon formulas) gives its topocentric position,
illuminated fraction and bright-limb angle; `zenWorldLunar` samples it from the
same time and coordinates as the sun, and the environment carries
`moonAltitudeRadians`, `moonAzimuthSouthRadians`, `moonParallacticAngle`,
`moonBrightLimbAngle` and `moonIllumination` (`moonPhase` keeps its existing
meaning, the illuminated fraction, and `moonAge` is now the real lunation age).
World `moonlight` is non-zero only while the moon is up and is dimmed near the
horizon, so a moonless night is darker for the pond and blossoms too, and its
faint stars return. `zenBonsaiSkyMoon` places the moon on the panel as a
south-facing elevation view: east left, west right over ±120° of azimuth,
altitude 0 just behind the bed's rear edge (0.9 of the sky) up to the zenith at
0.04. The 10 CSS px disc turns its bright limb toward the sun from the
parallactic angle, carries faint near-side maria and earthshine on a crescent,
warms near the horizon, shows as a pale day moon once a good part is lit, keeps
its brightness under thin cloud while its halo widens, and is hidden by thick
cloud or rain. A moving body needs a live owner, so the `celestial` ownership
(renamed from the twinkle-only option) also covers the moon: Plume Canvas
paints it inline (`animated`); Plume Pixi bakes the sky without it (`omit`)
and a one-sprite layer above the stars and below rain, clipped to the sky
polygon, moves it on each environment sample and repaints its small texture
only when its appearance changes; a static `rest` bake (G15) leaves it out.
The moon therefore does not enter the paint signature and never rebakes the
sky. The panel's sun placement predates the September solar-axis rotation and
still maps south to the right; aligning it with this projection is a separate
change.

`zenPressureRailTonePolicy` owns the rail's ivory frame material, consuming the
same ambient L3 bottom color as the surrounding frame. The full 34px face
remains the input target; its 9px allocation is frame-colored at rest. Hover,
touch exploration or keyboard focus reveals only that domain's policy pigment
mixed with the ivory frame. No dark bank, inset channel or extra hover line is
painted; no block rises or gains an enclosing border.
Ordering, shares and policy semantics remain in their existing owners. Readiness
uses straight tallies in the same ivory face without invented segments. The
rail consumes `ZEN_PRESSURE_FRAME_STYLE`; hover or keyboard focus reveals the
domain's in-place favicon action without a selection popup.
The pond's `zen_garden.clear` palette in `pond/world/pondPalettes.js`
uses quieter jade stops; depth, water lighting and other water-quality states
remain owned by their existing material policies.

The rail's pigment and favicon share a 180ms opacity/color response, without
changing quantitative widths or hit targets. The portrait pressure slot and
compact stage's exposed frame use the L3 bottom material, including the
unoccupied end of the pressure row; its measured allocation stays unchanged.
Reduced motion removes those transitions. Ledger rules consume the
same ambient edge as the shell; its disclosures use the canonical warm overlay
paper and shallow contact shadow. The management menu anchors to the actual
entry row height, so coarse-pointer target sizing cannot move it onto the row.
Selection retains its wash while hovered, and the ellipsis does not rotate.
At the resting Pond boundary the paper edge owns the single hairline; the rail
does not add a second adjacent line. With the ledger raised, the rail owns its
lower boundary and the paper edge moves with the sheet.

The rhythm marker overlays the upper right frame, so it does not subtract its
height from the bonsai canvas. Landscape retains its original 1.58:0.96 grid
allocation and transparent pondward canopy reserve, capped at 52% of pond width.
The physical support remains independent of that reserve. The root remains on
the exact foreground seam. `workAreaRect` is a stage-local CSS-pixel sheet from
the stage's top-left corner to the rear panel line, ending at the graph's top.
It covers the pond's top padding and extends beneath transparent crown paint
and the foreground instead of treating the whole canvas as an exclusion zone.
Pathways uses this full-cover sheet while Pond keeps its own aperture. Portrait
uses the existing Pond slot. These bounds are independent of mode. The camera prefers
the right frame and shifts the root along that seam only as mature crown bounds
require. The shallow foreground starts beneath the lower graph,
avoiding a visible vertical step at its left end. Plume's single Home
camera policy, `ZenBonsaiPlumeHomeFraming`, fits the full mature history to 73% of
the expanded paint height, with explicit width/height constraint diagnostics.
Its v8 policy restores the original 58% limit across the expanded transparent
paint width and retains complete history paint reserves. Narrow crowns retain
the 73% height target; uniform fitting gives broad crowns pondward air. The
preferred root is 90% across the measured bonsai slot, about 18 CSS px right of
the earlier 86% point in a 450px slot; actual full-history feasibility owns its
position. Width diagnostics distinguish composition limits from physical fit.
The v6 crown appearance targets slightly smaller blossoms while preserving
retained-flower identities, scaffold girth and initial closed-bud cues.
Its mature wood volume centroid and full-history crown endpoints choose a fixed
pondward horizontal sign, with the farther endpoint left of that center. It does
not rewrite growth or flip direction during activation. Product rendering uses
the shared full-quality Home DPR cap of 2, under the existing total-pixel budget.

`bedInsetLeftCssPx` remains separate from physical support geometry and the DPR
compiler owns its device inset. The canvas remains pointer-transparent above
exposed water. Portrait, Landing and Lab explicitly select `planter`; the strict
layout/projection contract requires the support kind. A missing kind is an error.

The Home measurement owner reads all four slot rectangles only after the layout
host's canonical `--ui-viewport-width` / `--ui-viewport-height` projection matches
the current window. Native resize can change CSS dimensions before the viewport
owner's RAF/React commit updates `data-ui-layout`; that uncommitted epoch retains
the last frame without compiling mixed-mode geometry. The host's style and layout
attribute commits both trigger measurement, including resizes within one mode.
Malformed epoch projections and invalid geometry in the current committed epoch
remain explicit failures; no alternate layout, empty graph or CSS reconstruction
is admitted.

The layout compiler preserves the scene and rim extent of anchors admitted by
its 1.5 CSS-pixel measurement tolerance. It quantizes adjacent scene and clearance
lengths once. Its surface covers the complete measured right edge plus the existing
boundary paint reserve; flooring that width would expose up to one CSS pixel of sky
beside the foreground stone. Home projects that same reserve as its landscape
`overflow-clip-margin` and uses `overflow: clip`, which creates no scroll container.
This local clip sits outside the visible edge; the dashboard console frame owns
the final crop. Neither stage width, transparent canopy allocation nor graph input
is expanded to accommodate paint. Edge-adjacent slots retain their scene/rim extent.
The DPR compiler rounds shared scene edges once and allocates a covering whole
CSS-pixel canvas compatible with the backing-store owner's floor rule. It must
preserve the complete scene and the device-pixel overshoot at fractional DPRs.
The graph's logical right edge is the same profile `bedLeftX` as the foreground
footing. The front-face paint extends left by the existing boundary overshoot
to close antialiasing and device-rounding gaps at that joint. This paint-only
coverage does not extend graph input or change the shared logical seam.
Out-of-tolerance DOM bounds and undersized serialized contracts still fail.

The development capture profile projects its declared pressure fixture through
`applyZenMainCapturePressureRailProps` at the actual rail input. Overriding only
the historical scan snapshot's `rhythmTopSites` does not populate the current
Zen candidate-based rail. The public build-selected projection is an identity
function. This QA-only fixture changes no canonical user data or readiness rule.

This map audits the dashboard Main tab after the launch/loading cleanup. The
Main tab is allowed to build display view models for the home surface, but it
must not invent runtime truth, substitute another theme widget silently, or
hide first-frame readiness behind a generic loaded state.

The practical reading question is:

```text
Can the first dashboard surface be traced from boot readiness and runtime
snapshots into explicit theme widgets, without dashboard code creating a
parallel theme/runtime fallback?
```

## System Flow

Main tab readiness:

```text
DashboardPage
  -> DashboardLayout / MainPanel
  -> MainTab
  -> useDashboardTabReadiness(tabId="main", widget theme id)
  -> loading/error/ready tab surface
```

Home scan projection:

```text
MainTab
  -> isRuntimeActive=false parks status/cycle/protection subscriptions
  -> useStatusController({ isRuntimeActive })
  -> useProtectionRuntimeSubscription({ enabled: isRuntimeActive })
  -> buildHomeScanSnapshot() only while runtime-active
  -> retained last-active display projection while inactive
  -> HomeScanWorkspace
      -> deterministic session-summary presentation adapter
      -> non-Zen + post-first-frame idle admission
      -> named main-session-summary-ai async enrichment
```

Theme widget handoff:

```text
theme preference id
  -> resolveMainWidgetThemeId()
  -> lightweight plugin surface descriptor mainWidgetThemeId assertion
  -> HomeScanWorkspace getThemeWidget()
  -> requireThemeWidget() explicit missing-widget error
  -> SignalScanner / CoreStatus / PressureRail + RhythmMarker or HomeBriefCard
```

Presentation-scene handoff:

```text
DashboardPage shared foreground observation
  -> useMainPresentationScene(presentationActive)
  -> mainPresentationProjection
  -> MainTab
  -> HomeScanWorkspace
  -> Zen pond/bonsai/rhythm props with explicit interaction lock/read-only lens
```

`DashboardPage` also publishes the passive `DashboardPresentationAdmission`
snapshot to Home and Guidance. It combines that same visible/focused document
observation with actual boot/scene release and exclusive First Vision/general
ceremony admission. It owns neither a scene decision nor a domain claim. General
ceremony waits behind the complete First Vision lifecycle; its request generation
fences replacement/completion. Contextual consumers require the shared admission
and their own readiness gates, with an explicit provider in isolated fixtures.

First-frame gate:

```text
HomeScanWorkspace Zen theme widgets
  -> one admitted zen_home_renderer physical session
  -> exact pond logical-channel first-frame ACK
  -> exact bonsai logical-channel first-frame ACK when Zen composite is required
  -> first viewport boot-frame ack, or live committed viewport ack for the reserved first-vision stage
  -> non-Zen Home workspace post-paint ack otherwise
  -> MainTab first-frame metadata
  -> bootManager.reportMainTabFirstFrameReady()
```

## Owner Table

| Concern | Owner | Key files | Output | Forbidden shortcut |
| --- | --- | --- | --- | --- |
| Viewport shell layout | dashboard layout runtime | `layout/useViewportRuntime.js`, `layout/DashboardLayout.jsx`, `layout/Scaler.jsx`, `themes/styles/console.css` | canonical `layoutMode` and dock/drawer placement; fitted landscape frame centered inside the actual asymmetric margin box | width-only breakpoints overriding a portrait-desktop topology, theme-specific sidebar DOM, or translating the whole frame to simulate its margin box |
| Main tab loading/readiness | dashboard loading policy and active registry | `MainTab.jsx`, `tabs/loadingPolicy.js`, `tabs/registry.js`, `useDashboardTabReadiness.js` | acyclic loading/error/ready surface | readiness hook importing the dynamic tab registry or leaf widget marking tab ready alone |
| Main presentation/runtime lifecycle | dashboard tab renderer plus Main runtime gates | `layout/MainPanel.jsx`, `MainTab.jsx`, `useRuntimeParkedStoreSlice.js` | separate presented/exiting/runtime-active signals and last-active display retention | stacked exit motion authorizing controller requests or worker animation |
| Main widget theme owner | main tab theme registry plus lightweight theme descriptor seam | `tabs/main/themeRegistry.js`, `themes/core/surfaceDescriptor.js`, `themes/plugins/<themeId>/surfaceDescriptor.js` | canonical widget theme id shared with the full manifest | normalizing invalid widget owner to default theme or importing the full profile just for widget ownership |
| Home surface composition | HomeScan workspace plus app garden frame | `HomeScanWorkspace.jsx`, `src/apps/dashboard/workspaces/garden/ZenGardenFrame.jsx` | theme widget props and stable slot composition | shared frame importing tab controllers or theme runtime internals |
| Garden surface activity | app garden workspace | `src/apps/dashboard/workspaces/garden/gardenSurfaceActivity.js` | explicit workspace, Pond, Bonsai and composite activity | splitting physical Workers or treating a single active surface as a composite ACK |
| Zen Home composition geometry | Home measurement and pure composition resolver plus Zen public garden-bed/reading contracts | `home/useZenHomeCompositionLayoutFrame.js`, `home/zenHomeCompositionLayoutFrame.js`, `themes/plugins/zen/api/homeGardenBed.js`, `themes/plugins/zen/api/homeCanopyReading.js` | one CSS-pixel frame with garden-bed projection inputs, pressure data bounds, full-cover ledger `workAreaRect`, and a separately projected text/control inset | duplicated intrusion constants, using transparent canvas allocation as text exclusion, observing resized inner data bounds, per-frame alpha measurement, theme runtime reading Home CSS, or either side relabeling coordinates without DPR compilation |
| Zen Home pressure domain entry | Home stage placement plus PressureRail widget presentation | `home/ZenHomePressureDock.jsx`, `home/homeScanWorkspace.css`, `ZenPressureRail.jsx`, `ZenPressureSegments.jsx` | one current hover/focus favicon action in the quantitative graph, direct canonical domain intent | popup portals, nested buttons, independent selection/timer state or changing quantitative allocation on hover |
| Zen dashboard ambient petal field | DashboardPage shell plus Zen `petalField` public contract | `themes/plugins/zen/api/petalField.js`, `presentation/petals/ZenAppPetalLayer.jsx`, `runtime/petals/*`, pond Worker input control | one viewport-wide emitter across tabs and layouts; bounded landings received by the visible pond | bonsai-slot origins, a Home-only emitter, pond initial spawning/replenishment, or treating landings as pointer state |
| Runtime/status facts | dashboard status/protection hooks | `useStatusController.js`, `useProtectionRuntimeSubscription.js` | status controller and runtime snapshot | home surface writing runtime truth |
| Pressure-rail readiness and semantic disposition | stats status visible-domain read model and stats candidate policy | `statsStatusVisibleDomainReadModel.js`, `buildStatusDomainCandidatePool.js` | `pressureRailReadiness` plus canonical `policyDisposition` | Home inferring readiness from an empty array or a theme recomputing policy thresholds |
| Home display projection | home view-model builders | `buildHomeScanSnapshot.js`, pressure-profile/home-brief helpers | display-only scan snapshot | treating empty display defaults as persisted facts |
| Session-summary AI enrichment | Main local async boundary plus dashboard AI panel | `sessionSummaryPresentation.js`, `SessionSummaryAiEnrichment.jsx`, `SessionSummaryAiPanel.jsx` | deterministic brief first, optional non-Zen narration overlay after idle | AI provider/capability graph in the Zen or Main first-frame static closure |
| Theme widget implementation | theme registry seam | `themes/core/registry/index.js` | explicit widget component or null | cross-theme widget substitution |
| Zen Home physical renderer | platform admission plus Zen Home session owner | `platform/workers/runtime/WorkerRuntimeRegistry.js`, `themes/plugins/zen/runtime/worker/ZenHomeRendererWorkerSession.js`, `zenHomeRendererWorkerProtocol.js` | one admitted `zen_home_renderer` Worker and exact `pond`/`bonsai` logical channels | per-widget Worker admission, a second Home Worker, or local capacity policy |
| First-frame readiness | MainTab first-visual coordinator | `MainTab.jsx`, `firstVisual/useZenHomeFirstVisualCoordinator.js` | exact pond/bonsai channel ACK composite or non-Zen post-paint boot metadata | physical Worker readiness or one channel ACK standing in for both visual parts |
| Main presentation scene | presentation conductor | `useMainPresentationScene.js`, Zen scene projection | typed projection and interaction policy | legacy first-vision booleans owned by nested widgets |
| Dashboard presentation admission and local lifetime | DashboardPage plus passive presentation seams | `presentation/DashboardPresentationAdmission.jsx`, `usePresentationSessionLifetime.js`, `activePresentationClock.js` | one visible/focused observation, exclusive/contextual admission, theme/boot generation fencing and active dream dwell | UI eligibility inference, a durable event queue, old-session callbacks advancing a new reducer or wall time consuming unseen First Vision |
| First-bloom eligibility and opening | progression policy/service plus Home presentation hook | `progressionBonsaiRelease.js`, `useBonsaiFirstBloom.js`, `bonsaiFirstBloomAdmission.js` | domain `bonsaiFirstBloom.eligible`, a once-only durable opening and exact-frame/foreground-gated regional playback | deriving eligibility from artifact journey completion, duplicate foreground listeners or an opened receipt cancelling the claiming tab's playback |
| Dev-only dashboard capture and Zen Main profile | generic dashboard QA target plus dashboard capture-profile alias | `scripts/qa/protocols/dashboardCaptureQaProtocol.mjs`, `apps/dashboard/qa/zenMainCaptureProfileContract.js`, `zenMainCaptureProfile.dev.js`, `zenMainCaptureProfile.public.js` | one named-surface capture harness; Zen Main composes canonical progression with an isolated koi roster and shared weather; the declared environment clock defaults to fixed and can use the canonical realtime clock for periodic-refresh diagnosis | one browser protocol per tab, public-build activation, raw storage writes, page-scene substitution, or divergent pond/bonsai weather |
| Zen scene environment projection | Zen scene projection plus world environment authority/kernel | `zenMainSceneProjection.js`, `runtime/environment/zenWorldEnvironmentAuthority.js`, `zenWorldEnvironmentKernel.js`, `zenWorldWeatherEventDirector.js` | one behavior-independent authority sampled through the shared kernel, then Pond/Bonsai domain projections or one explicit ceremony-clear mode | nested renderer recalculating solar/weather, inferring weather source from cloud or usage values, or pond and bonsai selecting different Main policy |

## Function Ledger

| Boundary function | Input | Output | Failure / missing-data policy |
| --- | --- | --- | --- |
| `resolveViewportLayoutMode()` | orientation plus viewport width/height | `landscape`, `portrait-compact`, or `portrait-desktop` | exact viewport tier only; content evidence never participates |
| `resolveMainWidgetThemeId()` | active theme id and lightweight surface descriptor | canonical main widget theme id | missing/invalid descriptor owner throws |
| `useDashboardTabReadiness()` | tab id, widget theme id, active state | loading/error/ready phase | widget preload errors surface at tab root |
| `useRuntimeParkedStoreSlice()` | canonical Zustand store, narrow selector, Main runtime activity | current active projection or retained last-active display projection | parked value is never persisted or used as canonical truth; reactivation reads current store state |
| `resolveDashboardPresentationAdmission()` | accepted foreground, boot/scene release, First Vision lifecycle and pending general ceremony | passive exclusive/contextual admission snapshot | missing inputs/provider fail explicitly; no eligibility, persistence or renderer authority |
| `buildHomeScanSnapshot()` | status controller, protocol state, protection runtime snapshot | display-only home scan snapshot | missing runtime facts become empty display state, not storage/runtime truth |
| `buildSessionSummaryPresentationSignature()` | deterministic summary draft and locale | presentation-only current-result identity | never becomes an AI request or provider cache key |
| `SessionSummaryAiEnrichment` | non-Zen theme, runtime-active Main, dismissed boot shell, unlocked interaction | idle-admitted named async panel or local retry | no capability I/O before lazy panel mount; Zen admission is always zero |
| `requireThemeWidget()` | widget theme id, widget type, component | component | missing widget throws explicit error |
| `resolveZenHomeCompositionLayoutFrame()` | measured outer stage, pond, bonsai, and pressure-rail slots | CSS-pixel garden-bed frame, full-cover ledger `workAreaRect`, stage-relative pressure `dataRect` and decorative `seamWidth` | initial incomplete measurements remain pending; transient 0x0 retains the last valid frame and controller; invalid geometry or a rail detached from the pond throws an explicit layout-contract error |
| `createZenAppPetalField()` / `resolveZenAppPetalRate()` | viewport, retained Home biotic signal, canonical environment projection, conductor-projected petal presentation, and active simulation time | bounded app-wide airborne petals and receiver landings | ambient awaits source; explicit opening supply is bounded independently; pausing never accumulates catch-up emissions; no minimum population replenishment |
| `markFirstFramePartReady()` | exact pond-channel, bonsai-channel, and first-viewport ACK metadata | first-frame metadata | waits for all three Zen parts; one physical `zen_home_renderer` readiness signal cannot collapse the two logical visual ACKs; the reserved first-vision stage uses live committed viewport evidence because capture hold is intentionally disabled |
| `resolveZenMainCaptureProfile()` / `applyZenMainCaptureProjection()` | explicit dev-only `zen-main-v1` URL activation and validated koi/bonsai/time/weather/environment-clock values | deterministic isolated roster plus shared weather and declared fixed or realtime clock | public alias is a strict no-op; invalid requested states fail instead of silently defaulting; realtime preserves the production environment refresh cadence |
| `resolveZenSceneEnvironmentPolicy()` | typed scene `environmentMode` | weather authority plus optional ceremony hour shared by pond and bonsai | unknown projected mode throws; no weather-source fallback |
| `projectZenPondEnvironment()` / `projectZenBonsaiEnvironment()` | strict world authority or immutable sample | source-stamped domain target and dynamic/bake signatures | renderer-local solar/weather interpretation and time-bucket cache invalidation are forbidden |
| `resolveZenPondProjectionEnvironmentPolicy()` | typed pond projection | the shared scene environment policy | null projection is explicit Lab policy; malformed or unknown projected mode throws |
| tab-root failure reporting | widget/hydration failure or Main module/render exception | explicit degraded Main first-frame failure metadata | analysis, widget, module, and render failures cannot remain hidden behind the boot shell or wait for hard timeout |
| first-frame timeout/failure effect | active ready Zen main with missing ack or failed visual runtime | degraded first-frame metadata plus diagnostic error | fail-open is diagnosable and names missing parts or failed runtime |

## Recovery Versus Fallback

| Class | Allowed? | Rule |
| --- | --- | --- |
| Empty home display values | Yes | view-model builders may render zero/empty state for absent facts |
| Missing theme widget | No fallback | `requireThemeWidget()` throws; another theme widget is not substituted |
| Invalid main widget owner | No fallback | surface descriptor `mainWidgetThemeId` must already be canonical |
| First-frame timeout or visual runtime failure | Bounded | boot may proceed with degraded metadata and diagnostic errors |
| Presentation read-only lens | Yes | projected scenes can read alternate rhythm/domain state without writing live selection |
| Legacy first-vision prop path | No | Main presentation projection is the scene contract |
| Runtime snapshot unavailable | Visible/empty projection only | home scan can show empty cards, but cannot write runtime state |
| Empty pressure candidate set | No data substitution | pressure rail renders its explicit collecting/observed-empty state and never substitutes current-day projection totals |

## Current Findings

### F1. Main first-frame readiness is explicit and diagnosable

Status: keep.

Zen main waits for the exact pond-channel, bonsai-channel, and first-viewport
acknowledgements before reporting clean readiness. Pond and Bonsai share one
physical `zen_home_renderer` Worker, but their frame/materialization evidence and
ACKs remain independent; physical Worker readiness and an ACK from only one
channel are insufficient. Other themes report readiness after the tab-root gate
and a post-paint Home workspace commit, rather than depending on a Zen runtime
callback they do not implement. The timeout path is fail-open only for the boot
experience and still reports degraded metadata with missing component readiness.
If a visual runtime reports explicit terminal first-frame failure, such as
`pond:readiness:failed`, `bonsai:lineage_failed`, or
`bonsai:failed_mount_or_update`, the boot manager
records an explicit diagnostic error and releases as degraded readiness rather
than promoting the whole dashboard boot to `failed`.
The reserved first-vision stage keeps its scene live rather than freezing a boot
capture, so its first-viewport acknowledgement comes from the same validated
pond, bonsai, and rhythm inputs after the Home commit. A degraded boot defers the
still-pending first vision to a later boot and settles this session on `current`.

While boot capture is active, `useZenHomeFirstViewportBootFrame` invalidates its
captured Bonsai part when the canonical lifecycle input signature changes, even
if the replacement materialization is not ready yet. This lets the renderer
receive the new input and produce the exact token that the workspace expects;
retaining the old input until the new token arrives creates a readiness deadlock.
The existing frame hold during reveal remains unchanged, and a pending replacement
is never advertised as a ready first viewport.

Once the boot hold ends, the existing release effect retires its captured inputs
after the retained commit, even when current signatures have advanced within
the same scene generation. The signature-match matrix remains diagnostic; data
does not have to revert to the captured snapshot for steady rendering to resume.
Pond and Bonsai's existing renderer owners retain their painted Canvas while
current inputs/materialization prepare and still own actual frame ACKs. The
boot capture does not add a replacement readiness gate or keep controlling
canonical inputs after dismissal. This effect is a React commit lifecycle seam,
not proof of a native browser paint.

### F2. Main widget owner resolution now asserts canonical ids

Status: fixed in the 2026-06-29 Main tab pass.

`resolveMainWidgetThemeId()` now validates the plugin surface descriptor's
`mainWidgetThemeId` owner with `assertCanonicalThemeId`. Invalid descriptor owners fail at the Main tab
theme seam instead of being normalized to the default theme or propagated into
widget lookup.

### F3. HomeScanWorkspace already rejects missing widget contracts

Status: keep.

`HomeScanWorkspace` retrieves widgets through the public theme registry and
calls `requireThemeWidget()` for required slots. This preserves the no
cross-theme-fallback rule for the first dashboard surface.

### F4. Home scan snapshot is a display projection, not a runtime owner

Status: keep.

`buildHomeScanSnapshot()` tolerates absent runtime facts by producing empty or
zero-valued display state. That is acceptable because it does not persist,
mutate runtime, or claim that collection succeeded. Runtime/subscription errors
belong to the owning hooks and background surfaces.

### F5. The old first-vision prop path stays retired

Status: keep.

Main presentation state flows through `mainPresentationProjection`. Existing
tests verify that the workspace receives the projection instead of a legacy
first-vision snapshot prop. The same projection owns pond weather source:
`reality` selects local event weather, while `ceremony_midday` selects a clear
fixed presentation. The event schedule depends on the local calendar and worker
clock, never on browsing or habit quality. The pond renderer cannot infer or
override that source.

### F6. Zen live rhythm is passive and selection-projected

Status: current.

Zen Home uses one restrained architectural field without an outer material slab
or inset outline. In landscape, the pond occupies both grid columns beneath the
right bonsai measurement anchor. The composition resolver supplies one vertical
aperture shared by pond clipping, the rear garden plane, and input/landing
occlusion. The Home stage owns the aperture, its sky-colored perimeter and
vertically fading contact edge. The rear SVG fill extends the existing one-CSS-pixel
boundary overshoot past the top/right/bottom perimeter. Landscape Home and its SVG
allow that paint overflow; the dashboard's existing panel viewport owns the final
crop. Input and landing polygons retain their exact measured bounds; the boundary,
tree and stage stay fixed. This prevents lighter frame pixels from leaking through
a second rasterized edge without adding a cover strip. The worker paints the existing open-air
atmosphere inside the shared rear receiver, in its existing static back layer.
The inscription consumes sky-contrast ink from the ambient presentation; the exact
frame-seam projection is owned by
[the Zen product engine](../themes/zen/zen-g15-product-engine.md#home-pond-facing-canopy-and-frame-seam--2026-09-28).
The pond and pressure rail remain flush to the left edge, and no separate bottom
mat or gap is introduced above `ZenPressureRail`. The landscape pressure slot
spans both columns and the right margin for measurement; its data region ends
at the integrated stone bed's left footing. The remaining slot is transparent
and pointer-transparent, letting the worker-owned bed meet the lower datum.
Pressure segments and their input surface are laid out entirely inside the
shorter measured data region, never hidden under the bed. The expanded tree
canvas stays pointer-transparent, while the readout shares the same endpoint
over exposed water. Pond and bonsai do not acquire individual card chrome.
`ZenRhythmMarker` remains a noninteractive inscription absolutely positioned in
the upper-right negative space without consuming bonsai height. The Home-only
`frame-garden-bed` presentation uses `frame-seam` support in landscape and
`planter` support in portrait. Home measures the actual stage, pond,
bonsai, and outer pressure-rail rectangles through one observer lifecycle.
`homeCompositionLayoutFrame` contains the garden-bed subframe, graph data bounds,
and readout safe bounds. Landscape data and readout use the stone-footing
boundary resolved from the same garden projection; pressure shares, site
membership, Other aggregation and selection remain unchanged.
Portrait does not invent an intrusion and retains its local data/readout width.
The readout is bottom-anchored to the rail top within the pond height.
Only outer slots are measured, so applying
the inner data width cannot create a resize feedback loop. Pressure-only changes
preserve the garden subframe identity. The renderer receives that unchanged
`homeGardenBedLayoutFrame` contract and compiles it through the active DPR exactly once
into a device-pixel projection; it does not infer app grid tracks or read Home
CSS. Once committed, the frame is retained through transient 0x0 tab/layout
measurements so the same canvas/controller and same-identity ACKed paint remain
mounted. Exact current readiness always remains keyed by scene, input, and
materialization ACK. While the physical canvas, scene, and active tree identity
stay the same, an input/materialization-only transition keeps the last exact-ACK
paint visible and replaces it at the next exact ACK; that retained paint cannot
satisfy current/composite readiness. A changed scene or tree identity, or a
replaced canvas, closes the paint latch. The ordinary scene backdrop
remains clipped to the scene viewport. One
projected quad mesh derives the outer rim, opening, soil, front rim, front face,
and planting anchor. The camera maps the world-space trunk base to that planting
anchor in scene-local coordinates, while the compositor alone applies the scene
viewport origin. Layer order is backdrop, rear rim and soil, contact shadow and
rear/proximal nebari roots, tree wood with its basal flare, exposed front root
runs and moss, then front rim and face. The nebari owner must not paint a
second basal collar over the trunk: the root-order wood ribbon owns that flare,
while front roots cross the wood layer only after leaving its silhouette. This
keeps Canvas2D static layers and the Pixi branch rig on the same origin without
separately aligned DOM bed planes.
The garden-bed projection does not own ambient motion. `DashboardPage` mounts one
lazy `petalField` layer outside the tab panes, covering the dashboard viewport,
including the sidebar and portrait layouts. `ZenAppPetalLayer` uses Canvas2D and
the platform render loop; `runtime/petals/zenAppPetalField.js` is the sole ambient and First Vision
airborne-petal emitter. Neither the bonsai aperture nor its branches are an origin.
The field consumes the existing Home topology biotic publication, forwarded by
the Home workspace callback, as a retained cosmetic snapshot. The memory-only
source store quantizes unit fields to 0.02 and publishes only changed signatures;
this is no new lifecycle owner. It does not fetch/materialize bonsai state, subscribe to cultivation
updates, or wake parked Home renderers. Ambient emits nothing before a source arrives;
other tabs retain the last Home signal. Preview/Lab publishers do not replace
that source, and Home unmount clears only its exact owner identity. First Vision
uses the same mounted field with `zenMainSceneProjection.petals`: committed/presenting
select opening, covering disables landings, covered current preparation/commit
freezes airborne identities, and uncovering eases supply toward ambient while
keeping landings disabled until settled. `zenAppPetalPresentation.js` owns the
explicit opening envelope (3.6 petals/second before viewport scaling,
at most 8 active seconds, 0.7-second rise and
2-second settle). It does not require a bonsai source. Existing airborne petals
retain their identities, positions and
material across cover/release; pending handoffs retire at cover without replay.
The shared airborne cap is 48; landing batches remain capped at 24. The platform
First Vision renderer
owns radiance/opaque cover and the release-gated clock only, with no particle
generator, sprite material, or petal configuration. Its exact current-frame and
spent-ACK gates remain authoritative. Lab replay goes through the same session
conductor, without a standalone First Vision overlay preview.
Ambient emission rate varies continuously with growth/bloom/vitality rather
than maintaining a minimum particle count. Hidden, reduced-motion, and blocked
presentation pauses do not accumulate a burst for resume.
`runtime/petals/zenPetalEmission.js` owns that supply projection. Full unit
capacity/bloom/readiness supplies 3.6 petals/second at 1440x900 before wind
scaling, about 9.5x the previous reference. Smooth release across published bloom
0.12–0.62 calibrates the projection to Plume's already-attenuated availability:
the canonical full-growth capture source (0.70 capacity, 0.56 bloom, 0.60
readiness) supplies about 1.99/second at that viewport, while maximum life
supplies about 3.37/second. Early-growth preview remains about one petal/minute.
`zenAppPetalField.setInputs` compiles that policy only when the source's four
values, viewport, or sampled environmental release inputs change. Simulation
steps receive only elapsed active time and never reproject bloom, area, weather,
or supply. Equivalent publications and presentation-only changes keep the same
policy revision. Canonical world `petals` moderates day/night supply (nighttime
floor 72%); rain attenuates sustained release by up to 58%. Seasons remain owned
by the world clock/weather and botanical source, without another seasonal curve.
`runtime/petals/zenPetalEventDirector.js` owns one mutually exclusive visual
release sequence: waiting (7–12 seconds), gathering (0.7–1), shower (2.1–2.9),
settling (1.3–1.8). A cycle redistributes the baseline supply with a mean-one
piecewise-linear envelope, integrating crossed boundaries exactly. Randomness
is consumed at transitions, on a stream separate from particle identities.
The shared sampled gust sets each next cycle's strength; a rain onset may shorten
one quiet interval but cannot restart, stack, or queue a shower. Sparse preview
does not run release events. Opening and its settle suppress this sequence;
covered freezes it, and visibility/reduced-motion clearing discards transient
event state and emission credit. Supply, flight and opening retain one emitter,
the same active clock, and the unchanged live/landing caps.
The active visible pond registers its canvas aperture as a landing receiver.
The scanner supplies its transparent pointer-input plane by ref alongside the
canvas. Hit testing accepts that exact live plane; unrelated overlays, controls
and retired planes still occlude landings. Geometry and clipping remain owned by
the visible canvas aperture, including after retained-runtime reattachment.
Viewport CSS pixels are mapped through its effective geometry and canonical cover
transform; field movement is never attracted to the pond. A bounded landing batch
preserves petal identity and appearance through the existing pond Worker channel.
The pond owns only floating/resting lifetime and the single water-impact disturbance;
it does not spawn or replenish ambient petals. Pointer updates cannot overwrite a
landing batch, and retired receiver sessions cannot replay it. The old Home transit,
its public API, and the pond's autonomous falling population are removed together.
The field contributes no Main first-frame readiness requirement.
Attached blossoms and falling petals share the pure pigment/gradient leaf
`model/sakura/sakuraPetalMaterial.js`. The app and pond both bake the same
`runtime/petals/zenPetalMaterial.js` painter, three product palette colors and
six silhouettes; neither renderer remaps a received color to an older palette.
Base size coefficients are 5.2–6.6 CSS pixels for background, 5–5.8 for surface,
and 9–14 for foreground. `runtime/petals/zenPetalFlight.js` owns seeded drift,
shared gusts, reversing zigzag flutter and signed face/edge/reverse-face flips.
Seeded flight recipes mix gliding (40%), wide pendulum (38%) and tumble/dive
(22%), with base descent 125–190 CSS pixels/second before orientation, depth,
wind and brief dive projection. Rain continuously reduces lateral flutter by
up to 45% and increases descent by up to 18%, without reseeding a trajectory.
Opacity remains
0.82–0.96 before the 0.45-second entry fade. Surface petals align to a full face
before landing; other layers continue their tumble through the pond plane.
Landing preserves size, pigment and opacity with no water-only shrink; pond
bakes use the same 16-unit detail resolution as airborne sprites. The pond
declines sizes above six canonical world units after CSS/logical/cover mapping,
without a ripple or impact rescaling. The layer's `landedPetalCount` diagnostic
counts accepted worker handoffs, not a second supply or persisted state.
`runtime/petals/zenPetalDepth.js` gives each airborne identity a stable view depth.
Background projection scales size by 0.78–0.9x and motion by 0.72–0.9x.
Foreground size/motion grow nonlinearly from 1.25x/1.15x to 2.4x/1.9x, reaching
a 33.6 CSS pixel coefficient at the nearest slice. Depth through 0.94 stays
sharp; only the closest camera slice gradually receives defocus. The final
180 CSS pixels before the virtual surface landing plane ease size and motion
toward 1x while retaining sharp focus.
The worker receives the already-focused base appearance, with no depth payload
or water-only snap. A declined landing continues at that focused plane.
`zenPetalSpriteCache.js` lazily bakes seven blur radii (0–2.4 source pixels in
0.4-pixel steps) from the shared sharp material. The 72x72 RGBA cache has at most
126 entries / 2.50 MiB, independent of viewport and DPR, and releases all backing
stores with its layer. Frame rendering draws far to near using cached images;
the frame canvas never applies a blur filter or an extra blur pass. Texture and
blurred-texture counts are exposed only as bounded QA diagnostics.
This changes only pot geometry/composition and
does not change bonsai topology, genetics, or cultivation state. The leaf
widgets keep explicit `frameVariant` inputs instead of inferring Home context or
duplicating outer card chrome. The live surface does not render the old 24-hour
waveform or expose an hour-selection state. With no selected domain,
`ZenRhythmMarker` stays a local-time and broad-day-phase inscription. Time,
phase, arc light, and ink tone come from the dashboard's canonical Zen ambient
presentation, shared with the pond/bonsai environment rather than recomputed by
the marker. In landscape, the clock sits inward and below the rear plane's
upper-right perimeter, occupying its open air above the crown. Large tabular
numerals consume the theme UI face and a restrained glass reflection derived
from the existing garden sky and contrast ink. This gives the environmental
inscription a material presence within the 2D/2.5D composition. Date and phase
form one quieter line below it. The redundant phase-color dot is removed;
reduced-transparency and forced-color preferences use a solid text face. With a
selected domain, an aligned `dailyFlow.pressureProfile` may contribute its
hourly `targetPressureMs` values as passive ink traces on the day arc. The
marker does not derive a typical window, forecast, current-pressure judgment,
safe period, recommendation, or aggregate substitute. A selected/profile
domain mismatch suppresses the trace instead of showing stale or unrelated
pressure.
The rail has one live recent-pressure meaning in release V1. It does not switch
to a second period-summary or current-day source. The stats read model owns an
explicit `pressureRailReadiness` contract. Fewer than three completed observed
activity days produces a frame-token-only `collecting` rail; sufficient evidence
then completes exactly once as `ready`. Ready content is either `pressure` or
`no_pressure`; the latter is a final calm result rather than another readiness
phase. Seven observed days marks the evidence stable without changing the rail's
meaning. Positive-day, total-pressure, and visible-candidate evidence must be
jointly positive or jointly empty; a partial tuple fails loudly instead of
rendering a misleading empty rail.
Candidate policy semantics are also upstream-owned as `policyDisposition`.
The Zen widget maps that semantic id to its palette and does not duplicate risk,
trend, volatility, over-limit, or selection-score thresholds.

Ready segments retain canonical pressure shares for values and aggregation.
`ZenHomePressureDock` passes its measured `dataRect.width` to the rail; initial
unmeasured geometry remains pending. `layoutZenPressureRail` owns presentation
width allocation: a hard 32 CSS-pixel minimum per positive named segment and
positive Other segment, with remaining width allocated proportionally among
unconstrained segments. There is no logarithmic remapping or correction-budget
cap that can override the icon floor. Below the total hard minimum the row keeps
its minimum canvas width and scrolls horizontally; icons never silently shrink.
Only data or measured-width changes invoke the bounded (at most six-item) solver.
The current Zen pond and rail share one represented-site list: at most five
registered domains admitted by Home's residence/challenge policy. Retained order
is stable; `visibleRank` is its display slot. `pressureRank` is separately computed
over the full registered-site pool by current weighted pressure and stable tie
priority. Readouts use `pressureRank`, never the display slot. Every named rail
segment identifies its same-domain koi assignment; physical bank crossings may
still be pending in the worker after the desired membership changes.
All remaining pressure is one non-site `other` aggregate with no koi,
including the full-width case where none of the represented sites has pressure.
Koi remain site entities; they do not double as controls for changing the rail's
sort or filtering basis.
The renderer uses visual pixel widths, while native DOM hit testing resolves
the actual painted button during width transitions. The former synthetic 26px
hit expansion and sub-26px favicon suppression are removed. Keyboard controls
stay in stable display order. The 34px row holds a 24px favicon with 5px vertical
and at least 4px horizontal space. Icon-local borders, padding, background plates
and shadows are removed for loaded images; a shared bank edge and incision
dividers retain the composition. Hover/focus/afterglow controls opacity; mounted
icons remain mounted while their domain remains represented, avoiding repeated
query/image admission on every hover. Width transitions last 480ms and respect
reduced motion. The readout rule opens from the selected segment's corrected
visual center; it does not infer that position from canonical pressure shares.
Other is recomputed from actual pressure before visual layout,
so removing a representative transfers its pressure into Other without changing
the total or treating its corrected display width as data.

`ui-kit/Favicon` separates CSS `size` from optional `sourceSize`. Zen requests a
64px browser favicon for its 24px display and uses its `unframed` presentation.
An explicit larger source request prioritizes the existing manifest-owned browser
favicon seam over the stored data URL, so a late low-resolution cache response
cannot replace that selected raster. Default callers retain cached-first ordering.
The existing UI-only source failure sequence and typed query cache remain intact;
no new remote source, storage path or image upscale service is introduced. A larger
request cannot manufacture detail absent from the browser's original favicon.
The current hovered or keyboard-focused domain reveals one in-place favicon
button. Its action routes through the existing Main controller to the matching
Sites notebook. Cell background clicks reveal no popup and do not lock a target;
touch first reveals and the next favicon tap opens. There are no nested buttons,
portal readouts, pressure-owned Escape listeners or lingering favicon afterglow.
The graph and icon share one hover/focus region and publish the existing transient
external-hover and engagement channels only while the Pond is interactive.
Quantitative shares, minimum icon cells and pointer allocation do not change on
interaction. The material joint has no site identity; Other remains a non-action
aggregate. Pressure ranks use weighted pressure, never literal elapsed duration.
The Pond's own koi selection and idle-release owner remain separate.

The landscape projection keeps visible water to the left and the bonsai anchored
on the right; the pond's full-span measurement slot is clipped by the shared
vertical aperture. Its grid tracks and slot placement are owned by the same
`data-ui-layout` mode that the geometry compiler reads; viewport-width utility
breakpoints cannot independently choose a conflicting Home arrangement.
`portrait-desktop` reuses the same mounted widget DOM and assigns
it to a bounded full-width pond, a left-anchored partial-width pressure stratum, and a lower
approximately 68/32 bonsai/rhythm row. App-owned grid areas own this
orientation projection; the theme owns its paint and the vertical rhythm
inscription. Evidence, selection, and clock updates may change content inside
the reserved slots but cannot change their tracks, visibility, or mount state.
The landscape-only top, seam, and right frame tracks do not introduce a new
horizontal separator between the pressure stratum and the portrait lower row,
and compact portrait keeps its safe single-column stack. Outside landscape the
garden-bed front body remains inside the bonsai slot rather than reusing the
landscape gutter intrusion.

First Vision reuses this exact slab and aperture DOM. Its Zen projection may
set the `first_vision_focus` paint token on the existing console frame and Home
root so the sidebar/rhythm chrome is gently attenuated and the pond/bonsai
aperture edges glow. That token is absent in resolving, deferred, and settled
current states; within the active viewport layout mode it cannot alter grid
tracks, visibility, mounting, or pointer semantics.

### F7. G15.4 product materialization is part of bonsai first-frame readiness

Status: current.

Zen Home still runs in the classic workspace/control/render family but selects
the `g15_4` production model through `zenClassicWorkspaceRuntimeConfig`. The
engine may prepare a deterministic graph once surface identity is available,
while first-frame admission remains closed until the exact canonical lifecycle
materialization is ready. The product life-state adapter then derives the event
resolution and presentation parameters used for the visible G15 scene.
Presentation treats a new order-zero lineage as a trunk handoff or trunk
bifurcation rather than as a generic scaffold fork. It may bridge the visible
wood shoulder and its paint value across that immutable lineage boundary, but
it must not merge, relabel, or feed the presentation decision back into the
developmental graph.

A first-order bough whose projected base is at least 42 percent of its incoming
order-zero trunk radius is a structural trunk branch for paint purposes. Its
shoulder and opening ink value inherit the parent trunk before blending into the
bough's own bark value. Its flat brush head may be buried beneath the parent
bole within the junction envelope so no cap seam remains exposed; this
classification is presentation-only and must not change scheduler axis order,
node position, or lineage ownership.

A seed, phenotype, lifecycle signature, presentation scene, or canvas identity
change invalidates readiness in the same render. Generation or scene-command
failure is terminal for the visual surface and never downgrades to Classic2,
Classic, vNext, or detached research. First Vision and Lab preview may supply
isolated presentation inputs, but they cannot create a second product topology
owner or advance Classic2 lineage state. The renderer's exact ACK remains keyed
to the current scene, lifecycle input, materialization, tree identity, and
physical canvas before paint is considered ready.

### F8. Home worker count is owned by the platform admission controller

Status: current.

Pond and Bonsai mount as sibling logical visual surfaces inside one physical
`zen_home_renderer` session. `ZenHomeRendererWorkerSession` is the sole physical
owner: it acquires the platform's one strict, non-preemptible steady presentation
lease, constructs one Worker, and routes messages through the exact `pond` and
`bonsai` channel/session envelopes. The dashboard's `artifacts` logical channel
uses this same physical owner, with a private renderer and transferable completed
frames; it contributes no Main first-frame ACK. Channel acquisition does not create a second
lease, rank, budget, or Worker. Each channel keeps its own frame,
materialization, failure, and scene-commit ACK contract; neither channel may use
the other's ACK or physical readiness as evidence.

`zenMainWorkerRenderBudget` projects the fixed Home Pond and Bonsai render
contracts only; it neither samples pressure nor coordinates worker scheduling,
and it does not own worker capacity. Dashboard Boot and Ceremony are bounded,
preemptible burst presentation consumers and never alternate owners of Home's
steady capacity. Denial, revocation, or channel failure must surface through the
registered strict/degradation contract. It must not cause a main-thread Home
fallback, a second physical Home Worker, a surface-local admission retry, or
capacity inflation. Releasing one logical channel leaves the physical session
alive for the others. Termination requires no logical channels, no startup
reservation and no dashboard lifetime lease. `retainDashboard()` is owned by
`themes/core/runtime/dashboardRenderRuntime.js` through the dashboard layout hook;
it retains the same physical generation across tab transitions. A
retained/parked shared Home Worker remains live capacity until that termination.
The surviving physical session receives an exact channel/session release
envelope for the departed logical surface, so abrupt unmount and immediate
reacquire cannot retain or reuse the old worker-side channel generation.
The theme-core dashboard boot-runtime seam may ask this same owner for one
pre-channel startup reservation. It starts world-runtime import early but owns
no visual ACK; the first actual Home channel adopts the reservation, so the
steady lease and physical-worker count remain exactly one.
The Home entry also owns one-time Pixi Worker environment installation. Pond and
Bonsai keep explicit per-channel pixel state; no logical renderer may use a
Worker-global DPR as shared mutable truth.

The artifact channel's measured exclusive production closure adds 32 modules,
84,498 raw bytes and 34,956 gzip bytes after removing the general theme catalog
from GreatWave and separating Enso's document metrics owner. Only that measured
increment is added to the prior closure/module baselines (1,808,989 raw,
572,320 gzip, 536 modules); the existing Main growth is still measured against
the old baseline plus this declared addition. Entry baselines and 3% warning / 8%
failure thresholds stay unchanged. The same exclusive byte increment extends the
absolute closure envelope to 2,084,498 raw / 634,956 gzip bytes, preserving the
prior Main headroom and the checker's hard-limit-above-growth-line invariant.
The resulting measured total (1,852,727 raw / 589,841 gzip) is below even the old
absolute limits; it is the changed ownership baseline that requires this explicit
envelope accounting. No existing Main growth or forbidden dependency is waived.
The artifact checker reports `artifacts` separately and forbids UI SVG compilers,
React, and the general theme catalog in the Worker closure. This baseline change
accounts for the new canonical seven-scene owner; it is not a performance result.
Pond channel acquisition sends one exact channel/session prepare envelope before
PING. The Home entry uses it to overlap the Pond renderer graph, Pond logical
runtime, and Bonsai logical runtime within the already-admitted physical
generation. The preparation is not awaited by the data-plane queue; later
commands join the same terminal promises. An exact Bonsai Pixi INIT separately
starts the Pixi renderer factory admission before awaiting the Bonsai logical
runtime. Neither path creates a second lease, retry, synthetic readiness signal,
or main-thread fallback; admission failure is terminal for the shared physical
generation.
Pond admission start/end, engine module-wait milestones, Bonsai Pixi admission
lead/duration/remaining INIT wait, and client first-frame timings are the
evidence set for this boundary.
The production worker artifact gate reads its accepted baseline, bounded-growth
policy, and absolute emergency limits only from
`scripts/ci/quality-gate.config.json`. The Main/Home boundary document does not
duplicate those mutable byte or module values. The gate continues to reject
storage, model-repository, research, or experiment-only modules regardless of
bundle size. Baseline changes require a public-artifact owner/closure audit and
matching evidence in `docs/operations/ci/quality-gate.md`; a threshold increase
is never the default response to incidental growth.
Dev/research-only Pixi GPU timer-query code is also forbidden in the public
closure. Detailed runtime-health timeline capture is compiled out there while
the worker keeps an explicit build-disabled diagnostic snapshot.

### F9. Canonical growth catch-up is presentation-only

Status: current.

Only after the renderer ACKs the exact current scene, lifecycle-input signature,
and bonsai materialization key may Home overlay a short acknowledgement of
canonical qualified-use days accumulated since the last Main viewing. Merely
preparing the materialization or displaying a retained prior ACK paint is
insufficient. The tree is already at its
progression-owned release age; the overlay neither interpolates business state
nor joins the composite first-frame contract. Its source is
`canonicalBonsaiRelease.qualifiedUseDayCount`, capped by Bonsai's own full-form
policy rather than the artifact journey display count or completion target.
Its auto-ack timer runs only while the exact Home frame and shared contextual
admission are available; a general Dashboard ceremony, First Vision or inactive
document withholds it. The page-local record ignores session debug projections
and cannot grant, delay, or reconstruct progression, lineage, cultivation, or
First Vision.

At canonical full-form release, the domain-eligible click-driven first bloom
replaces the generic growth acknowledgement. A claimed regional playback keeps
its transient identity after the opened receipt makes domain eligibility false;
shared admission pauses/resumes the same event without another claim.

### F10. Session-summary AI is a post-first-frame non-Zen enrichment

Status: current.

Home statically imports only the pure session-summary presentation adapter.
The request/task/provider graph begins at `SessionSummaryAiEnrichment`, which is
declared as `main-session-summary-ai` in loading policy. Zen never admits that
boundary. Non-Zen admits it only after the clean Main frame has dismissed the
boot shell and an idle slot is available. The deterministic brief remains the
visible truth while the optional chunk is absent or loading; a chunk failure is
shown locally with an explicit fresh-lazy retry. Runtime inactivity unmounts the
panel so generation/preparation cannot continue behind a retained Main pane.

## Re-Audit Checklist

Main owns the first protected-registration entry and Popup continuations during
the initial registration journey. Existing Sites management opens immediately
after a canonical registration, independently of direct Popup registration.
The dashboard route boundary parses `setup=site-registration` into a typed,
uncommitted `registrationIntent`; explicit Add requests before Sites management
opens use the same intent builder. First Vision's selection lock retains that intent in dashboard state
while withholding it from the covered Main surface. Main acknowledges it only
after opening the actual in-water registration editor. Same-tab navigation carries the
acknowledgement back to clear params and the matching launch URL through
`consumeDashboardSiteRegistrationRoute`, rather than reopening on reload or the
next entry.
External Sites Add routes obey the same progression projection as native
navigation. Before management opens they continue in Main; a visible Sites
workspace owns its inline registration note under canonical capacity admission. The Sites
management tab appears after the first canonical successful registration and
stays available after deletion; canonical journey query failures remain explicit
and retryable rather than admitting independent registration.

- Run `npm run test:file -- tests/mainWidgetThemeRegistry.test.js tests/mainTabLoadingContract.test.jsx tests/mainSessionSummaryAiEnrichment.test.jsx tests/dashboardLoadingPolicy.test.js tests/themes/themeWidgetRegistry.test.js` after Main tab/theme widget owner changes.
- Run `npm run check:dashboard:owner-architecture` after dashboard tab registry, loading, or sibling-tab ownership changes.
- Run `npm run check:theme-seam-role-architecture` after theme id canonicalization or widget seam changes.
- Confirm new home widgets are declared in theme manifests and `tabs/loadingPolicy.js` before being required by `HomeScanWorkspace`.
- Confirm new presentation scenes enter through `mainPresentationProjection`, not component-local special booleans.
- Run `npm run check:worker-runtime:admission-boundary` after changing the
  `zen_home_renderer` physical owner, logical channels, or presentation capacity.
