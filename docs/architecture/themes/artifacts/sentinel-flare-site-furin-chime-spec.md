# Site Furin — time punctuation

- Status: Active
- Owner: nudge runtime and Zen presentation
- Last validated against code: 2026-10-08
- Path policy: current-only
- Canonical for: Site Furin presentation, visible exit clock and choice lifecycle

Site Furin marks the end of the user's chosen site allowance. Its composition is
one hanging glass chime, a compact committed total/goal, one gesture caption, and
two choices: make a breeze and close this tab, or continue viewing. Both choices are
available as soon as visible presentation is acknowledged. The washi starts
blank and participates in the closing ritual; Site has no
catch, interval-gathering game or delayed reflection panel. Global Sentinel keeps
its independent minigame.

The surface uses a neutral charcoal ground, warm paper controls and a restrained
red koi accent. The vertical composition is centered without a dashboard card,
green lighting, vignette or visible timeline. The short entrance sway settles;
hover does not commit a choice or manufacture wind. Full arrival is 900 ms and
brief is 450 ms. The user makes a breeze through a deliberate pointer down,
sweep and release across the Furin's air region. Keyboard and assistive single
activation offer the same closing outcome without a precision gesture.

The intentional asymmetry includes sensory closure feedback. After the
resolution ACK, a bounded 2200 ms ritual moves the paper, reveals ink and a brief
meaning, and fades the surface before authorized tab removal. Chime feedback
follows actual eligible clapper contact in the shared simulation. Continue is
a small, clearly labeled single-activation text control with a neutral 220 ms
fade. It causes no broken object, lost progress or reprimand. Reduced motion
uses a silent 1600 ms static ink/meaning interval instead of wind and swinging,
leaving time to read the four-character inscription's meaning.
Full and brief use the same exit durations. These timings and the sensory
reward are product hypotheses; no behavioral benefit is claimed measured.

Each Site presentation draws one of the six reviewed four-character inscriptions
uniformly from the immutable shared Zen catalog. The draw is held for that
presentation: hover, an uncommitted gesture, cancellation and a failed-close
retry do not redraw it. A new presentation draws again, with repeats allowed.
Only the chosen inscription's short localized meaning appears after ink reveal;
there is no rarity, collectible count, history or persisted selection. Gallery
inscriptions use the same catalog through their existing daily rotation.

## Owners

| Responsibility | Canonical owner |
| --- | --- |
| Daily full/brief selection, allowance and admission | Existing daily V2 receipt and intervention admission owners; scoped actual Site/combined delivery and brief later Site after Global |
| Automatic entry boundary | `runtime/sentinelProtocolEntryPolicy.js`, `runtime/furinEntryBoundary.js` → shared feed Horizon or classified prepared non-feed action; exact goal binding and background revalidation |
| Session state and visible exit clock | `runtime/SentinelProtocolSessionController.js` → `nudge/nudgeGameSiteFurinProtocol.js` via `nudge/sentinelProtocolAdapters.js` |
| Lifecycle, generation fences and visible frame clock | `runtime/SentinelProtocolHost.js` and its lifecycle/frame controllers |
| Overlay composition and styles | `runtime/NudgeOverlayHost.js`, `nudge/siteFurinChimeStyles.js` |
| Summary, wind gesture and choice intent | `nudge/SiteFurinReflectionView.js`; no private clock |
| Reflection DTO validation | `nudge/siteFurinReflectionModel.js`; never writes or reconstructs stats |
| Committed usage facts | Stats `activeUsageIntervals.js`, existing aggregator/materializer/typed repository |
| Activity-day projection and delivery | `statsActivityDayUsageQueryService.js` → `ProtectionRuntimeInputProvider.js` → `TrackingProtectionService.js` → `ProtectionNudgeDispatchMessageBuilder.js` |
| Canonical artifact graphic and physics | `src/themes/plugins/zen/api/furin.js` → `ZenFurinPresentation.js`; shared `zenFurinVector.js`, `zenFurinSceneRecipe.jsx`, `zenFurinGeometry.js`, `zenFurinPhysics.js`, `zenFurinRuntimeRecipe.js` |
| Shared inscription catalog and one-presentation selection | `src/themes/plugins/zen/widgets/tools/recipes/zenFurinInscriptions.js`; `ZenFurinPresentation.js` holds one draw and projects its ID to the view's localized meaning. `src/themes/plugins/zen/api/furin.js` exposes the presenter and catalog to the visual harness. |
| Paper curvature and contact cue projection | `widgets/tools/recipes/zenFurinPaper.js`, `zenFurinImpact.js` under the Zen plugin; shared by SVG and Pixi |
| Scroll/focus isolation | Surface arbiter's strict Site input policy + `runtime/SiteFurinPageIsolation.js` |
| Media hold | Lifecycle controller → `media/PageMediaHold.js` |
| Browser evidence | `sentinel/site-furin/runtime` via `scripts/qa/protocols/sentinelProtocolQaProtocol.mjs` |

Paths in `runtime/`, `nudge/`, and `media/` above are under `src/domains/nudge/`.

## Copy and caption

The fixed caption sits directly below the Furin frame. Before a choice it gives
the press/sweep/release instruction and explicitly states that the tab closes.
Keyboard focus replaces that pointer instruction with Enter/Space guidance in
the same reserved space. There is no large visible heading; the allowance
announcement remains an accessible heading. The compact usage line names today's
committed total and the chosen allowance, with the hostname retained for assistive
reading. Continue remains a small, plainly labeled text action.

After the Leave ACK, guidance fades within 180 ms and the usage/Continue details
within 240 ms, preserving layout. The existing ink clock reveals the selected
four-character inscription; its short localized meaning replaces guidance in
the same centered caption slot.
It stays fixed while the paper moves. The display omits the redundant reading
and exit headline, longer explanations, exhortations and reward rankings.
The accessible status still announces impending tab closure. Meaning, detail
fades and terminal fade all consume the canonical visible exit clock. A failed
close restores the blank paper, guidance and both choices with an error only for
that exceptional state. Retired catch/hold/timeline locale copy has no active
consumer and is removed rather than preserving instructions for old interactions.

## Runtime contract

`site allowance + committed reflection DTO → entry boundary → admission prepare → dominant surface claim → overlay + immediate media hold → canonical Furin SVG → visible paint acknowledgement → presented receipt + immediate choices → explicit gesture/activation → absorbed receipt → resolution ACK → host-visible exit sequence → tab close or media release/resume + teardown`

The host session owns one presented-visible frame clock. Arrival changes only
`arrival` to `choice`; waiting does not mark the session completed or emit an
absorbed receipt. Leave and Continue are available at any presented phase.
Continue sets an explicit immediate intent, with no hold threshold. Pointer
release commits Leave only after a deliberate sweep; cancellation, lost capture,
blur or hiding clears an uncommitted wind gesture. Keyboard Enter/Space and
assistive activation can explicitly choose Leave without imitating pointer
speed. A pending choice disables both paths.

Only a successful lifecycle resolution ACK permits the host to call
`beginSiteFurinExit`. The protocol records `exitChoice`, `exitElapsedMs` and
`exitDurationMs`; progress exposes those values plus `exitProgress` and
`exitComplete`. Arrival and exit consume the same presented-visible frames.
The host wakes its existing frame loop and projects progress into the view and
presenter. The view's close promise resolves from a host update observing
`exitComplete`; no view, presenter or sound timeout advances the exit lifecycle.
The finished animation never marks the session completed or chooses an outcome.

Site uses explicit `host_dom` / `furin_svg`; Global uses
`extension_frame_worker`. This is declared render ownership, not a failure
fallback. Production, debug, QA and preview Site surfaces do not instantiate a
koi school. Dynamic load/paint failure aborts the same host and releases its
claim. Late activation cannot commit a newer run. Hidden/unpresented time
contributes zero; a delayed frame contributes at most 50 ms, matching the
presenter's frame cap. Settings
reapplication does not reset an active session.

The root remains a modal focus surface. Page body inertness and native overflow
locks supplement the arbiter's wheel, touch, scroll-key and middle-button policy.
The page is not reparented or geometrically scaled. Teardown restores only styles
still owned by the lease. After arrival and physical settling the host loop
sleeps; a deliberate wind gesture or acknowledged exit wakes the same loop.
Reduced motion directly shows the static assembly, retains both explicit choices
and spends its readable static exit interval on the same visible clock.

## Shared glass chime

Gallery and Site consume the actual `zenFurinSceneRecipe.jsx` through the narrow
Zen artifact seam. The early Zen glass silhouette and materials are restored
from the 2026-02-21 design (`776289299`), with its top tie normalized to y=0.
The refined contour narrows the shoulders and carries its widest region lower
through a continuous side curve, retaining a gently tapered, nonspherical shell.
The mouth has a 1.5-unit vertical radius for a near-frontal view; its silhouette,
rim shimmer and separate foreground lip consume that shared geometry depth.
The softly narrowed shell has a 40-unit opening; the shared 20-unit rim
half-width is also the clapper's contact boundary. Bell center/rim are 30/56
units below the top tie. The upper cord is 30 units, the paper cord 44 units,
and the washi is 32 × 96 units. This fits the complete
assembly within the shared 300 × 360 stage. Material bounds, rim and highlights
consume the same geometry as physics.

Lightly theme-tinted glass, one soft shoulder reflection, painted koi, a slender
glass striker with a luminous end bead and warm paper supply its character.
Painted koi have no autonomous local animation. The striker has a 24-unit
suspension cord and an 80 × 2-unit rod in a 104-unit chain; its pivot is two
units above the bell tie and its collision radius is half its filled width. Contact
occurs when the rod's side reaches the rim at its actual height, not when an
invisible tip sphere reaches a vertical wall.

Dynamics run at fixed 240 Hz through a coupled three-angle mass matrix. Bell
inertia uses the geometry's effective shell width/height approximation; the
striker uses its 64-unit center of mass and distributed 80-unit rod inertia.
Wind drag follows squared relative horizontal air speed, with an effective
paper area reduced by swing and yaw. These are tuned presentation physics,
not measured material constants. Still air also damps moving bodies. The
existing ambient wind scale remains 1.86, with a 0.3 quiet armed multiplier;
quiet armed wind adds no contact cues.

The short, taut cords keep exact lengths and shared pivots. Paper flex is a
damped material response: its top tie stays fixed and lateral displacement
increases quadratically toward the bottom. SVG uses clipped affine bands;
Pixi bends two retained face meshes with the same row coordinates and curve.
SVG bands overlap opaque paper to prevent antialiasing seams; each whole face
receives its shadow once rather than repeating that filter at each band.
Yaw foreshortens the entire curved leaf around its top center. Materials are
compiled once for Pixi; bending adds no texture uploads, Pixi live filters or private loop.

Collision correction and momentum exchange occur on every inward contact,
independently of sound/effect eligibility. A cue requires more than 6 stage
units/s of lateral approach speed at rim height and a 300 ms debounce. Quiet
or separating contact remains silent. Strength follows approach speed; the
restrained shimmer and 420 ms expanding pulse use the simulation clock. The
pulse originates on the contacted side of the rim in bell coordinates, never
at the lower clapper bead. Pausing cannot leave an independent effect timer
running. Landing's authored response remains an explicit narrative cue,
separate from gallery/Site physical contact history.

`supportStyle` is a declared recipe option: gallery uses `branch`, Site uses
`thread`. Both share the same support pivot, glass, clapper, paper and pose;
unknown styles throw. The simple Site thread continues above the viewport.
Gallery restores the early 160 × 8-unit wooden support and center knot. The
support's material bounds include its full width and shadow; it does not
introduce a second Site drawing. Cord paint
uses explicit joint-local `userSpaceOnUse` gradients so a vertical line stays
visible. Matrix attachment diagnostics verify ties; named gallery QA separately
verifies visible paint.

The Site presenter uses the shared coupled pendulum with a single 900 ms entrance
breeze and damping. Deliberate pointer wind enters through the presentation's
`setWind` seam; acknowledged Leave invokes `blow` with the chosen direction.
These inputs act through shared physics under the host frame loop. There is no
catch damping, private timer or Pixi instance. Full/brief choice timing cannot
kick the clapper or generate sound. Wind preview remains silent before the
resolution ACK. During the acknowledged Leave sequence only an eligible real
inward contact requests the Furin cue; there is no timer-triggered replacement
chime. Quiet contact and reduced motion remain silent. Ink and meaning consume
canonical exit progress. The old detached breeze-trace path is retired: paper,
cord and glass motion communicate the air's effect. Gallery simulation settings
do not drive the Site session. Position, velocity, paper torsion/flex and entrance
spring must all settle before the host sleeps.

## Factual usage projection

The existing consent-admitted foreground sealer remains the only collector.
Only a positively resolved protected-host segment enables exact interval
capture. Ordinary all-sites-minimal domain totals do not acquire this detail.
Stats commits optional exact `[start,end]` intervals alongside the same active
total/watermark in existing IndexedDB hourly rows. Adjacent heartbeats coalesce;
gaps are preserved. There is no new logger, mirror, history store or poll.
Coverage remains bounded to 32 intervals per domain/hour (768 per calendar day).
Saturation keeps recent exact intervals with partial coverage; older rows remain
explicitly unmeasured. Reset/export/retention follow the stats row lifecycle.

Activity-day projection uses the canonical reset hour and includes confirmed
parts of the ongoing session through the stated collection time. It does not
extrapolate the unsealed suffix or entry-boundary waiting time. The DTO remains
frozen for this presentation; this redesign changes no collection/storage path.
The surface displays only the committed active total and chosen goal; the
hostname remains available to assistive reading.
Missing records show an explicit unavailable message and do not block either
choice. Timeline display and interval counts are retired from this surface.

## Media and exit

Leave closes the current browser tab. After the production resolution ACK the
host drains presentation receipts and sends its live admission lease through
`nudgeGameControl.closeSiteFurinTab` to the trusted main-frame handler and
`TabClosureArbiter`. It must not release the lease/surface first or substitute
recovery-dashboard navigation. Failed/unconfirmed closure keeps the surface,
shows an accessible error and re-enables choices. Only an explicit retry uses
the current document/lease authority. Resolution records the choice; browser
removal is a separate outcome.

The breeze celebrates acknowledged intent, not confirmed browser removal. The
pre-choice tab-close instruction and accessible closing status make that
distinction explicit. The surface and
exact admission lease remain live during the host-clock sequence and receipt
drain. A failed or unconfirmed close calls `resetSiteFurinExit`, clears pending
intent and completion state, restores the blank paper, original guidance and
both choices, and shows an accessible error. The same inscription remains selected
for an explicit retry. The reset preserves visible arrival
time; waiting cannot replay the sequence or retry browser removal. Only a fresh
explicit choice can retry using the still-current document and lease authority.
It never leaves an invisible retry panel.

Continue retains media-resume and teardown semantics. Current-document,
open-shadow and accessible same-origin HTML media pause immediately. Capture
listeners suppress later play attempts and subtree observers discover inserted
players/roots. No continuous full-page poll is installed. Only players playing
at entry may resume on explicit continue; new autoplay attempts stay paused.
Abort/leave do not auto-resume. Resolve ACK and run identity must succeed before
playback is released. Cross-origin reach belongs to the separate declared frame
media owner; local DOM evidence alone cannot claim it, closed-shadow or Web
Audio reach. Inaccessible-frame diagnostics remain explicit.

## Retirement and evidence

The old Return Current ritual remains offline under
`docs/archive/implementations/site-furin-return-current-2026-09-13/`; it has no
runtime import or manual-original switch. Global Sentinel and general koi
systems remain independent.

Runtime QA waits for arrival, proves the session remains active without passive
completion, checks cancellation of an uncommitted wind gesture and hover/scroll
isolation, then checks a single Continue activation through ACK/neutral exit and
teardown. The runtime Leave journey separately checks deliberate sweep/release
and exact authorized tab closure. Focused state, view, presenter and host
lifecycle tests cover keyboard/assistive activation, ACK-before-reward ordering,
visible-clock pauses, reduced motion and visible explicit retry after closure
failure. Diagnostics include renderer, phase, visible
arrival, exit choice/elapsed/progress, committed reflection availability, physical
contacts, scroll lock and media reach. Source captures show actual product
components at arrival, choice, acknowledged breeze and narrow width. Their
synthetic facts are explicit and are not admission, collection or real-user
benefit evidence. Behavioral evaluation must distinguish the immediate leave
rate from comprehension, accidental choices, perceived pressure and repeat-use
burden; the sensory completion remains an unvalidated hypothesis.
